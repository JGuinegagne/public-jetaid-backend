const moment = require('moment');

const resAttr = require('../utils/commonResAttr');
const memberPriority = require('../utils/fieldProperties').getMemberStatusPriority;
const uniques = require('../utils/commonFunctions').uniques;

const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;

// NOTES: tri-way l-m-n association between a task, a via and a traveler
// This represents all participants in a task: helper, backup(s), helpee(s)
// Also represents all the previous associations between a passenger (traveler-via) with a task
// Also known as "members"
module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;
  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetTaskViaTravelerModel} */
  const taskViaTravelerModel = sequelize.define('TasksViasTravelers',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    status: {
      type: SeqTypes.ENUM,
      values: HELP_STATUS.values,
      defaultValue: HELP_STATUS.dft,
      allowNull: false
    },
    rank: {
      type: SeqTypes.INTEGER,
      defaultValue: 0,
      allowNull: false
    }
  },{
    name: {singular: 'TaskViaTraveler', plural: 'TasksViasTravelers'},
    underscored: true,
    tableName: 'TasksViasTravelers'
  });

  /** @param {JetModels} models */
  taskViaTravelerModel.associate = function(models){

    taskViaTravelerModel.belongsTo(models.Task, {foreignKey: 'task_id'});
    taskViaTravelerModel.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    taskViaTravelerModel.belongsTo(models.Via, {foreignKey: 'via_id'});
    taskViaTravelerModel.belongsTo(models.Convo, {foreignKey: 'convo_id'});

    models.Via.hasMany(taskViaTravelerModel, {foreignKey: 'via_id'});
    models.ViasTravelers.hasMany(taskViaTravelerModel, {foreignKey: 'via_traveler_id'});


    // MODEL METHODS REQUIRING MODELS
    taskViaTravelerModel.populate = function(members, fields){
      /** @type {Array<Promise<void>>} */const fetchPromises = [];

      Object.keys(fields).forEach(field => {
        const key = field.replace(/ /g,'').replace('_','').replace('-','').toLowerCase();

        /* eslint-disable no-case-declarations */
        switch(key){
        case 'task':
        case 'tasks':
          const taskIds = uniques(members.map(members => members.task_id));

          if(taskIds.length){
            fetchPromises.push(models.Task.findAll({
              where: {id: {[Op.in]: taskIds}},
              attributes: models.queries.FETCH_TASK_VIACASCADE.attributes,
              include: models.queries.FETCH_TASK_VIACASCADE.include
            }).then(tasks => {
              members.forEach(m => m.Task = tasks.find(t => t.id === m.task_id));
            }));
          }

          break;

        default:
        }
        /* eslint-enable no-case-declarations */
      });

      return Promise.all(fetchPromises).then(() => members);
    };

    // INSTANCE METHODS REQUIRING MODELS
    taskViaTravelerModel.prototype.buildBeneficiary = function(){
      /** @type {JetTaskViaTravelerInstance} */
      const member = this;

      if(member.status !== HELP_STATUS.helpee)
        throw Error('TaskViaTraveler: attempt to build a beneficiary from a member that is not an helpee');

      return models.TasksTravelers.build({
        task_id: member.task_id,
        traveler_id: member.traveler_id
      });
    };


    /**
     * @param {JetHelpStatus} prevStatus
     * @param {number} prevRank
     * @param {string} userId
     * @param {sequelize.InstanceSaveOptions} opt*/
    taskViaTravelerModel.prototype.saveAndNotify = function(prevStatus,prevRank=0,userId=null,opt={}){
      /** @type {JetTaskViaTravelerInstance} */
      const member = this;
      const task = member.Task;

      if(!task) 
        return Promise.reject({errors: {taskViaTraveler: 'saveAndNotify(): member.Task must be populated'}});
      
      const adminTravIds = task.getAdminTravelerIds();

      return member
        .save(opt)
        .then(upMember => {
          setTimeout(() => {
            const {type,subType,side} = models.TaskNotice.inferTypes(
              prevStatus,
              member.status,
              prevRank,
              member.rank
            );
            
            models.handlers.notice.dispatchTaskNotice(
              member,
              adminTravIds,
              type,
              subType,
              userId,
              side
            ).catch(error => models.handlers.notice
              .handleNoticeError('Save task member',error)
            );
          });

          return upMember;
        });
    }

    // <-- END of METHODS REQUIRING MODELS
  };

  // MODEL METHODS
  taskViaTravelerModel.buildFromViaRequest = function(taskRequest){
    const task = taskRequest.task;

    return taskRequest.members.map(travReq => {
      return taskViaTravelerModel.build({
        task_id: task.id,
        via_id: travReq.viaTraveler.via_id,
        traveler_id: travReq.viaTraveler.traveler_id,
        via_traveler_id: travReq.viaTraveler.id,
        status: HELP_STATUS.helpee
      });
    });
  };

  taskViaTravelerModel.updateFromViaRequest = function(taskRequest){
    const task = taskRequest.task;

    /** @type {Array<JetTaskViaTravelerInstance>} */
    const curBeneficiaryMembers = [];
    task.via.ViasTravelers
      .forEach(viaTrav => curBeneficiaryMembers.push(
        ...viaTrav.TasksViasTravelers.filter(taskViaTrav => taskViaTrav.status === HELP_STATUS.helpee && taskViaTrav.task_id === task.id)
      ));

    return {
      delTaskViaTravelerIds: curBeneficiaryMembers
        .filter(taskViaTrav => !taskRequest.members.find(member => member.viaTraveler.traveler_id === taskViaTrav.traveler_id))
        .map(taskViaTrav => taskViaTrav.id),

      newTaskViaTravelers: taskRequest.members
        .filter(member => !curBeneficiaryMembers.find(taskViaTrav => taskViaTrav.traveler_id === member.viaTraveler.traveler_id))
        .map(member => taskViaTravelerModel.build({
          task_id: task.id,
          via_id: member.viaTraveler.via_id,
          traveler_id: member.viaTraveler.traveler_id,
          via_traveler_id: member.viaTraveler.id,
          status: HELP_STATUS.helpee
        }))
    };
  };

  taskViaTravelerModel.createMembershipsMap = function(viaTravId){
    return taskViaTravelerModel.findAll({
      where: {via_traveler_id: viaTravId},
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES

    }).then(taskViaTravelers => {
      const outMap = {};
      taskViaTravelers.forEach(taskViaTrav => outMap[taskViaTrav.id] = taskViaTrav);
      return outMap;
      
    });
  };

  taskViaTravelerModel.prevalidateMemberRequests = function(memberRequests,errors){
    if(!Array.isArray(memberRequests)){
      errors.errors['memberRequests'] = 'request.body must have a "taskers" field of type "array"';
      return false;
    }

    const backupRanks = {};
    const taskerRefs = {};
    return memberRequests.every((memberRequest,index) => {
      if(typeof memberRequest.ref !== 'string' || memberRequest.ref.toString('hex') !== memberRequest.ref){
        errors.errors[`memberRequest ${index}`] = 'request must have a "ref" field of type "hex" string';
        return false;
      }

      if(taskerRefs[memberRequest.ref]){
        errors.errors[`memberRequest ${index}`] = `ref ${memberRequest.ref} may not be duplicated`;
        return false;
      }
      taskerRefs[memberRequest.ref] = true;

      if(typeof memberRequest.status !== 'string' || !HELP_STATUS.manageables.includes(memberRequest.status)){
        errors.errors[`memberRequest ${index}`] = 'request must have a valid "status" field';
        return false;
      }

      if(memberRequest.status === HELP_STATUS.backup){
        if(typeof memberRequest.rank !== 'number' || memberRequest.rank <0){
          errors.errors[`memberRequest ${index}`] = 'backup request must have a "rank" field positive or zero';
          return false;
        }

        if(backupRanks[memberRequest.rank]){
          errors.errors[`memberRequest ${index}`] = `backup rank ${memberRequest.rank} may not be duplicated`;
          return false;          
        }

        backupRanks[memberRequest.rank] = true;
      } else {
        memberRequest.rank = 0;
      }

      return true;
    });
  };

  taskViaTravelerModel.isValidMemberRequest = function(task, request, errors, index = 0){
    const member = task.TasksViasTravelers.find(member => member.id === request.ref);

    if(!member){
      errors.errors[`memberRequest ${index}`] = 'member could not be found';
      return false;
    }

    request.member = member;

    if(member.status === HELP_STATUS.helpee){
      errors.errors[`memberRequest ${index}`] = 'not authorized to modify the status of an "helpee"';
      return false;
    }

    if(member.via && !member.via.isCompatible(task,errors,index)){
      if(!HELP_STATUS.taskers.includes(request.status)){ 
        request.status = HELP_STATUS.incompatible;
        return true; // is not compatible but non-tasker request --> update requested status and validate
      } else
        return false;
    }

    switch(member.status){
    case HELP_STATUS.helper:
    case HELP_STATUS.backup:
    case HELP_STATUS.applied:
      if(!HELP_STATUS.taskers.includes(request.status) && request.status !== HELP_STATUS.applied){
        errors.errors[`memberRequest ${index}`] = `member status "${request.status}" not valid when current status is ${member.status}`;
        return false;        
      }
      return true;

    case HELP_STATUS.invited:
    case HELP_STATUS.contacted:
      if(request.status === HELP_STATUS.applied){
        errors.errors[`memberRequest ${index}`] = `member status "${request.status}" not valid when current status is ${member.status}`;
        return false;
      }
      return true;
    default:
      errors.errors[`memberRequest ${index}`] = `member's status "${member.status} may not be altered by a task admin"`;
      return false;
    }
  };


  // INSTANCE METHODS
  taskViaTravelerModel.prototype.isAuthorized = function(){
    /**@type {JetTaskViaTravelerInstance} */
    const taskViaTraveler = this;
    return HELP_STATUS.revealAddress.includes(taskViaTraveler.status);
  };

  /** @param {JetTaskViaTravelerInstance} oMember */
  taskViaTravelerModel.prototype.statusCompare = function(oMember){
    /**@type {JetTaskViaTravelerInstance} */
    const member = this;

    const statusDiff = memberPriority(member) - memberPriority(oMember);
    if (statusDiff !== 0)
      return statusDiff;

    else if(member.status === HELP_STATUS.helpee){
      const createTimeDiff = moment(member.created_at).diff(oMember.created_at,'s');
      if(createTimeDiff !== 0)
        return createTimeDiff;
      else
        return member.id.localeCompare(oMember.id);

    } else
      return member.rank - oMember.rank;
  };

  /** @param {{[travelerId: string]: JetTravelerInstance}} travelerIdMap*/
  taskViaTravelerModel.prototype.toMember = function(travelerIdMap){
    /** @type {JetTaskViaTravelerInstance} */ const taskViaTrav = this;

    const traveler = travelerIdMap[taskViaTrav.traveler_id];
    if(!traveler)
      throw new Error('TaskTraveler: traveler could not be found');

    const member = Object.assign({},traveler);
    Object.setPrototypeOf(member,traveler);

    member.TasksViasTravelers = taskViaTrav;
    return member;
  };

  /** 
   * @param {{[travelerId: string]: JetTravelerInstance}} travelerMap
   * @param {{[viaId: string]: JetViaInstance}} viaIdMap*/
  taskViaTravelerModel.prototype.toNonTasker = function(travelerIdMap,viaIdMap){
    /** @type {JetTaskViaTravelerInstance} */ const taskViaTrav = this;

    const via = viaIdMap[taskViaTrav.via_id];
    const traveler = travelerIdMap[taskViaTrav.traveler_id];
    if(via && traveler){
      taskViaTrav.via = Object.assign({},via);
      Object.setPrototypeOf(taskViaTrav.via,via);

      taskViaTrav.Traveler = Object.assign({},traveler);
      Object.setPrototypeOf(taskViaTrav.Traveler,traveler);

      return taskViaTrav;
    } else
      return null;
  };  


  /** @param {{[travelerId: string]: JetUserTravelerInstance}} */
  taskViaTravelerModel.prototype.createMemberResponse = function(travMap = {}){
    /** @type {JetTaskViaTravelerInstance} */const taskViaTrav = this;

    const traveler = taskViaTrav.Traveler;
    const via = taskViaTrav.via;

    if(!traveler)
      throw new Error('TaskViaTraveler: traveler field was not populated');

    traveler.TasksViasTravelers = taskViaTrav;
    delete taskViaTrav.Traveler;

    return via 
      ? Object.assign(
          traveler.createTaskMemberResponse(travMap),
          via.createPassengerViaResponse()     
        )
      : traveler.createTaskMemberResponse(travMap);
  };

  /** 
   * @param {{[travelerId: string]: JetUserTravelerInstance}} travMap
   * @param {JetInfos} infos*/
  taskViaTravelerModel.prototype.createFindMemberResponse = function(travMap = {}, infos = {}){
    /** @type {JetTaskViaTravelerInstance} */const taskViaTrav = this;

    const traveler = taskViaTrav.Traveler;
    const via = taskViaTrav.via;

    if(traveler && via){
      delete taskViaTrav.Traveler;
      traveler.TasksViasTravelers = taskViaTrav;

      /** @type {JetNonTaskerResponse} */
      const resp = Object.assign({passenger: traveler.createTaskMemberResponse(travMap)},via.assemblePassengerViaResponse(infos));
      return resp;
    } else
      throw new Error('TaskViaTraveler: member.Traveler and member.via must be populated');
  };  

  /** @param {JetInfos} infos*/
  taskViaTravelerModel.prototype.populateVia = function(infos){
    /** @type {JetTaskViaTravelerInstance} */const member = this;
    
    if(!infos || !infos.viIdaMap)
      throw new Error('TaskViaTraveler: infos.viaIdMap must be populated when calling populateVia on taskViaTraveler instance');

    const via = infos.viaIdMap[member.via_id];

    if(!via)
      throw new Error('TasksViaTraveler: member\'s via not found');

    member.via = Object.assign({},via);
    Object.setPrototypeOf(member.via,via);
  };


  taskViaTravelerModel.prototype.createMemberUpdate = function(){
    /** @type {JetTaskViaTravelerInstance} */const member = this;

    switch(member.status){
    case 'incompatible':
      if(member.via.isCompatible(member.Task)){
        return {member, status: HELP_STATUS.contacted, rank: 0};
      }
      break;

    case 'helper':
      throw new Error('TasksViasTravelers.createMemberUpdate: method called on member whose status is "helper"');
    
    default: // all other would be set to 'incompatible' --> to do: set more incompatible state for 
      if(!member.via.isCompatible(member.Task))
        return {member, status: HELP_STATUS.incompatible, rank: 0};
    }
    
    return null; 
  };
  
  
  return taskViaTravelerModel;
};