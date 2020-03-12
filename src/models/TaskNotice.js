const moment = require('moment');

const TASK_NOTICE_TYPE = require('../utils/commonFields').TASK_NOTICE_TYPE;
const TASK_NOTICE_SUBTYPE = require('../utils/commonFields').TASK_NOTICE_SUBTYPE;
const NOTICE_STATUS = require('../utils/commonFields').NOTICE_STATUS;
const NOTICE_SIDE = require('../utils/commonFields').NOTICE_SIDE;

module.exports = function(sequelize,DataTypes) {

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetTaskNoticeModel} */
  const taskNoticeModel = seq.define('TaskNotice',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4} 
    },
    type: {
      type: SeqTypes.ENUM,
      defaultValue: TASK_NOTICE_TYPE.dft,
      values: TASK_NOTICE_TYPE.values,
      allowNull: false
    },
    sub_type: {
      type: SeqTypes.ENUM,
      defaultValue: TASK_NOTICE_SUBTYPE.dft,
      values: TASK_NOTICE_SUBTYPE.values,
      allowNull: false
    },
    side: {
      type: SeqTypes.BOOLEAN,
      defaultValue: NOTICE_SIDE.dft,
      values: NOTICE_SIDE.values,
      allowNull: false
    },
    status: {
      type: SeqTypes.ENUM,
      defaultValue: NOTICE_STATUS.dft,
      values: NOTICE_STATUS.values,
      allowNull: false
    }
  },{
    name: {singular: 'TaskNotice', plural: 'TaskNotices'},
    tableName: 'TaskNotices',
    underscored: true
  });

  /** @param {JetModels} models */
  taskNoticeModel.associate = function(models){
    this.belongsTo(models.TasksViasTravelers, {foreignKey: 'task_via_traveler_id'});
    this.belongsTo(models.Task, {foreignKey: 'task_id'});
    this.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    this.belongsTo(models.User, {foreignKey: 'user_id', as: 'Notifier'});

    this.belongsToMany(models.User, {through: models.UserTaskNotice});


    // MODEL method requiring models
    taskNoticeModel.buildFromRequest = function(member,type,subType,userId,side=NOTICE_SIDE.twoWay){
      const notice = taskNoticeModel.build({
        type: type,
        sub_type: subType,
        status: NOTICE_STATUS.active,
        side,
        task_via_traveler_id: member.id,
        task_id: member.task_id,
        traveler_id: member.traveler_id,
        user_id: userId && userId.toString('hex') === userId
          ? userId : null
      });

      return notice;
    }
  }


  taskNoticeModel.inferTypes = function(oldStatus,newStatus,oldRank=0,newRank=0){
    /** @type {{type: JetTaskNoticeType, subType: JetTaskNoticeSubType, side: JetNoticeSide}} */
    const resp = {type: 'status_change', subType: null};
    if(!newStatus) return resp;
    switch(newStatus){
      case 'applied':
        if(!oldStatus) resp.subType = 'has_applied';
        else switch(oldStatus){
          case 'backup':
          case 'helper':
            resp.subType = 'was_expelled';
            break;
          case 'applied':
          case 'invited':
            resp.subType = 'unknown';
            break;
          default: 
            resp.subType = 'has_applied';
        }
        break;

      case 'backup':
        if(!oldStatus) 
          resp.subType = 'unknown';

        else switch(oldStatus){
          case 'applied':
            resp.subType = 'was_admitted_backup';
            break;

          case 'invited':
            resp.subType = 'joined_as_backup';
            break;

          case 'helper': 
            resp.subType = 'was_demoted_backup'; 
            break;

          case 'backup':
            resp.type = 'rank_change';
            if(oldRank > newRank) resp.subType = 'rank_upgrade';
            else if(oldRank < newRank) resp.subType = 'rank_downgrade';
            break;
          default:
        }
        break;

      case 'cancelled':
        if(oldStatus === 'invited') 
          resp.subType = 'invite_was_cancelled';
        break;

      case 'contacted':
        resp.subType = 'unknown'; // should not happen
        break;

      case 'helpee':
        resp.subType = 'unknown'; // for now
        break;

      case 'helper': 
        if(oldStatus){
          switch(oldStatus){
            case 'applied':
              resp.subType = 'was_admitted_helper';
              break;

            case 'invited':
              resp.subType = 'joined_as_helper';
              break;

            case 'backup':
              resp.subType = 'was_promoted_helper';
              break;

            default:
          }
        }
          
        break;
      
      case 'incompatible':
        if(oldStatus && oldStatus !== 'incompatible')
          resp.subType = 'now_incompatible';
        break;

      case 'invited':
        if(!oldStatus) 
          resp.subType = 'was_invited';

        else switch(oldStatus){
          case 'helper': 
          case 'backup':
            resp.subType = 'has_left';
            break;
        
          case 'pulled':
          case 'contacted': 
          case 'cancelled':
            resp.subType = 'was_invited';
            break;

          default:
        }
        break;

      case 'pulled':
        if(oldStatus === 'applied')
          resp.subType = 'has_pulled_application';
          break;

      default:
    }

    if(!resp.subType) {
      resp.subType = 'unknown';
      resp.side = null;
    
    } else switch(resp.subType){
      case 'has_applied':
      case 'has_left':
      case 'has_pulled_application':
      case 'joined_as_backup':
      case 'joined_as_helper':
        resp.side = NOTICE_SIDE.toAdmins;
        break;

      case 'was_invited':
      case 'invite_was_cancelled':
      case 'was_admitted_backup':
      case 'was_admitted_helper':
      case 'was_expelled':
        resp.side = NOTICE_SIDE.toMember;
        break;

      // following can happen in more than one way-> notify both parties
      case 'was_promoted_helper': 
      case 'was_demoted_backup':
      case 'now_incompatible':
      case 'rank_upgrade':
      case 'rank_downgrade':
        resp.side = NOTICE_SIDE.twoWay;
        break;

      // cases: 
      default: resp.side = NOTICE_SIDE.twoWay;
    }


    return resp;
  };


  /** @param {{[noticeId: string]: JetUserTaskNoticeInstance}} userNoticeMap
   * @param {{[taskId: string]: JetTaskUserInstance}} taskIdMap */
  taskNoticeModel.prototype.createResponse = function(userNoticeMap = {}, taskIdMap = {}){
    /** @type {JetTaskNoticeInstance} */
    const notice = this;

    const notifier = notice.Notifier;
    const taskUser = taskIdMap[notice.task_id];
    const userNotice = userNoticeMap[notice.id];

    /** @type {JetTaskNoticeResponse} */
    const resp ={
      memberRef: notice.task_via_traveler_id,
      taskRef: taskUser ? taskUser.id : null,
      noticeRef: userNotice ? userNotice.id : null,
      type: notice.type,
      subType: notice.sub_type,
      ownTask: userNotice ? userNotice.task_admin : null,
      timeStamp: moment(notice.updated_at).format('YYYY-MM-DD HH:mm:ss'),
      notifier: notifier ? notifier.public_name : null
    }

    return resp;
  }

  return taskNoticeModel;
};