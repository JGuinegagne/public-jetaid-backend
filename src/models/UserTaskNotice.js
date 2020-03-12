const USER_NOTICE_STATUS = require('../utils/commonFields').USER_NOTICE_STATUS;
const taskNoticeAttr = require('../utils/commonResAttr').USER_TASK_NOTICE_ATTRIBUTES;

module.exports = function(sequelize,DataTypes) {

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;

  const Op = seq.Op;

  /** @type {JetUserTaskNoticeModel} */
  const userTaskNoticeModel = seq.define('UserTaskNotice', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4} 
    },
    status: {
      type: SeqTypes.ENUM,
      defaultValue: USER_NOTICE_STATUS.dft,
      values: USER_NOTICE_STATUS.values,
      allowNull: false
    },
    task_admin: {
      type: SeqTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  },{
    name: {singular: 'UserTaskNotice', plural: 'UsersTaskNotices'},
    tableName: 'UsersTaskNotices',
    underscored: true
  });

  /** @param {JetModels} models */
  userTaskNoticeModel.associate = function(models){
    this.belongsTo(models.TaskNotice, {foreignKey: 'task_notice_id'});
    this.belongsTo(models.User, {foreignKey: 'user_id'});
  }


  userTaskNoticeModel.createUsersTaskNotices = function(noticeId, userIds){
    if(!noticeId || !userIds)
      return Promise.resolve([]);
      
    if( (!userIds.admins || !userIds.admins.length)
      && (!userIds.taskers || !userIds.taskers.length) )  
      return Promise.resolve([]);

    if(!userIds.admins) userIds.admins = [];
    userIds.taskers = (userIds.taskers || [])
      .filter(id => userIds.admins.indexOf(id) < 0);

    return userTaskNoticeModel.bulkCreate([
      ...userIds.admins.map(userId => ({
        task_notice_id: noticeId,
        user_id: userId,
        status: USER_NOTICE_STATUS.pending,
        task_admin: true
      })),
      ...userIds.taskers.map(userId => ({
        task_notice_id: noticeId,
        user_id: userId,
        status: USER_NOTICE_STATUS.pending,
        task_admin: false
      })),
    ]);
  }

  userTaskNoticeModel.createOrUpdateUsersTaskNotices = function(noticeId,userIds){
    if(!noticeId || !userIds)
      return Promise.resolve([]);

    if( (!userIds.admins || !userIds.admins.length)
      && (!userIds.taskers || !userIds.taskers.length) )  
      return Promise.resolve([]);

    if(!userIds.admins) userIds.admins = [];
    userIds.taskers = (userIds.taskers || [])
      .filter(id => userIds.admins.indexOf(id) < 0);

    const allUserIds = userIds.admins.concat(userIds.taskers);
      
    return userTaskNoticeModel.findAll({
      where: {task_notice_id: noticeId},
      attributes: taskNoticeAttr
    
    }).then(entries => {
      const missingEntries = allUserIds
        .filter(userId => entries.findIndex(e => e.user_id === userId) === -1)
        .map(userId => ({
          task_notice_id: noticeId,
          user_id: userId,
          status: USER_NOTICE_STATUS.pending,
          task_admin: userIds.admins.indexOf(userId) > -1
        }));

      const toDeleteUserEntries = entries.filter(entry =>
        allUserIds.findIndex(userId => entry.user_id === userId) === -1
      );

      const toUpdateEntries = entries.filter(entry =>
        allUserIds.findIndex(userId => entry.user_id === userId) > -1
      );

      toUpdateEntries.forEach(entry => {
        entry.status = USER_NOTICE_STATUS.pending
        entry.task_admin = userIds.admins.indexOf(entry.user_id) > -1
      });

      return Promise.all([
        missingEntries.length
          ? userTaskNoticeModel.bulkCreate(missingEntries)
          : Promise.resolve([]),

        ...toUpdateEntries.map(entry => 
          entry.save({fields: ['status','task_admin']})
        ),

        toDeleteUserEntries.length
          ? userTaskNoticeModel.destroy({where: {
            [Op.and]: [
              {task_notice_id: noticeId},
              {user_id: {[Op.in]: toDeleteUserEntries.map(entry => entry.user_id)}}
            ]
          }})
          : Promise.resolve(0)
      ]);
    })
  }


  return userTaskNoticeModel;
}