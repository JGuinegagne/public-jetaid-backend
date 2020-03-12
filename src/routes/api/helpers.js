const express = require('express');

const auth = require('../authorization');
const checkMsg = require('../checkMsg');

/** @type {JetModels} */
const models = require('../../models');

const TASK_QUERY_TYPE = require('../../utils/commonFields').TASK_QUERY_TYPE;
const HELP_STATUS = require('../../utils/commonFields').HELP_STATUS;

const router = express.Router();

// ************************************************************************************************
// COMMON FUNCTIONS
/** Checks whether the logged user is authorized to act as an admin for the task.
 * On success, populates:
 * + travMap (travId->UserTraveler) 
 * + beneficiary (taskTraveler)
 * + ownMember (taskViaTraveler)
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const checkCredentials = async function(req, res, next){

  /** @type {JetTaskInstance} */ const task = req.member.Task;
  /** @type {string} */const userId = req.payload.id;
  
  if(!req.payload.id)
    return res.status(403).send({user: 'No logged user detected'});

  const taskType = task.TasksTravelers.length ? TASK_QUERY_TYPE.beneficiary : TASK_QUERY_TYPE.member;

  try{
    const travMap = await models.UsersTravelers.createUserTravsMap(userId);

    if(taskType === TASK_QUERY_TYPE.beneficiary){
      req.beneficiary = task.getBeneficiaryRef(travMap);
      req.ownMember = null;

      if(!req.beneficiary)
        return res.status(403).send({user: 'Logged user is not authorized to make decisions for this task'});

    } else {
      req.ownMember = task.TasksViasTravelers.find(m => m.status === HELP_STATUS.helpee && !!travMap[m.traveler_id]);
      req.beneficiary = null;

      if(!req.ownMember)
        return res.status(403).send({user: 'Logged user is not authorized to make decisions for this task'});
    }

    await task.populate(userId,travMap);
    next();

  } catch(error){
    next(error);
  }
};


// ************************************************************************************************
// PARAM: register the parameter identifying the target member: task_via_traveler_id
router.param('task_via_traveler_id', (req, res, next, memberId) => {
  return models.TasksViasTravelers
    .findById(memberId, models.queries.FETCH_MEMBER)
    .then(member => {
      if(!member)
        return res.status(404).send({member: 'Target member could not be found'});
      
      req.member = member;

      if(!member.Task)
        return res.status(404).send({task: 'Task could not be found'});

      next();
    })
    .catch(error => {
      next(error);
    });
});

// ************************************************************************************************
// ROUTE GET/:member_id: review a specific task
// member_id (task_via_traveler_id) identifies an existing task-passenger relation
router.get('/:task_via_traveler_id', auth.required, checkCredentials, (req, res) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  const messages = member.Convo
    ? member.Convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,member.Task)
    : [];

  return res.status(200).send({
    task: member.Task.createOwnerResponse(req.payload.id,travMap),
    tasker: member.createMemberResponse(travMap),
    messages
  });
});

// ************************************************************************************************
// ROUTE POST/:member_id/invite: invite to join a specific task
// member_id (task_via_traveler_id) identifies an existing task-passenger relation
router.post('/:task_via_traveler_id/invite', auth.required ,checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    if(!member.via.isCompatible(member.Task,errors))
      return res.status(403).send(errors);
    
    if(!HELP_STATUS.invitables.includes(member.status))
      return res.status(403).send({memberStatus: `Member whose status is ${member.status} cannot be invited`});

    const prevStatus = member.status;
    member.status = 'invited';

    const [convo] = await Promise.all([
      models.handlers.convo
        .taskerSaver(member.Convo,member.Task,member,req.payload.id,req.body.message,errors)(),
      member.saveAndNotify(prevStatus,0,req.payload.id,{fields: ['status']})
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      await member.save({fields: ['convo_id']});
    }

    return res.status(200).send({
      task: member.Task.createOwnerResponse(req.payload.id,travMap),
      tasker: member.createMemberResponse(travMap),
      messages: convo 
        ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,member.Task)
        : []
    });

  } catch(error){
    next(error);
  }
});


router.delete('/:task_via_traveler_id/invite', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};
    
    if(member.status !== HELP_STATUS.invited)
      return res.status(403).send({memberStatus: 'The member status is not "invited"'});
    
    const prevStatus = member.status;  
    member.status = member.via.isCompatible(member.Task,errors)
      ? 'cancelled'
      : HELP_STATUS.incompatible;
    
    const [convo] = await Promise.all([
      models.handlers.convo
        .taskerSaver(member.Convo,member.Task,member,req.payload.id,req.body.message,errors)(),
      member.saveAndNotify(prevStatus,0,req.payload.id,{fields: ['status']})
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      await member.save({fields: ['convo_id']});
    }

    return res.status(200).send({
      task: member.Task.createOwnerResponse(req.payload.id,travMap),
      tasker: member.createMemberResponse(travMap),
      messages: convo 
        ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,member.Task)
        : []
    });
  } catch(error){
    next(error);
  }  
});

router.post('/:task_via_traveler_id/write', auth.required, checkCredentials, checkMsg.required, async (req,res,next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    const convo = await models.handlers.convo
      .taskerSaver(member.Convo,member.Task,member,req.payload.id,req.body.message,errors)();

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id']});
    }

    return res.status(200).send({
      task: member.Task.createOwnerResponse(req.payload.id,travMap),
      tasker: member.createMemberResponse(travMap),
      messages: convo 
        ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,member.Task)
        : []
    });

  } catch(error){
    next(error);
  }
});

router.post('/:task_via_traveler_id/admit', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    const currentHelper = member.Task.getHelper();
    const reqStatus = typeof req.query.status === 'string' && HELP_STATUS.taskers.includes(req.query.status)
      ? req.query.status
      : currentHelper
        ? HELP_STATUS.backup
        : HELP_STATUS.helper;

    const reqRank = typeof req.query.rank === 'number' && req.query.rank >= 0
      ? req.query.rank
      : null;

    /**@type {JetErrors} */
    const errors = {errors: {}};

    const [updTask,convo] = await Promise.all([
      member.Task.admit(member, reqStatus, reqRank),
      models.handlers.convo
        .taskerSaver(member.Convo,member.Task,member,req.payload.id,req.body.message,errors)()
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id']});
    }

    return res.status(200).send({
      task: updTask.createOwnerResponse(req.payload.id,travMap),
      tasker: member.createMemberResponse(travMap),
      messages: convo 
        ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,updTask)
        : []
    });
  } catch(error){
    next(error);
  }
});

router.post('/:task_via_traveler_id/expel', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    const reqStatus = typeof req.query.status === 'string' && HELP_STATUS.taskers.includes(req.query.status)
      ? req.query.status
      : HELP_STATUS.applied;

    /**@type {JetErrors} */
    const errors = {errors: {}};

    const [updTask,convo] = await Promise.all([
      member.Task.expel(member, reqStatus),
      models.handlers.convo
        .taskerSaver(member.Convo,member.Task,member,req.payload.id,req.body.message,errors)()
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id']});
    }

    return res.status(200).send({
      task: updTask.createOwnerResponse(req.payload.id,travMap),
      tasker: member.createMemberResponse(travMap),
      messages: convo 
        ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,updTask)
        : []
    });
  } catch(error){
    next(error);
  }  
});

router.post('/:task_via_traveler_id/promote', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    const reqStatus = typeof req.query.status === 'string' && HELP_STATUS.taskers.includes(req.query.status)
      ? req.query.status
      : HELP_STATUS.helper;

    const reqRank = typeof req.query.rank === 'number' && req.query.rank >= 0
      ? req.query.rank
      : 0;

    /**@type {JetErrors} */
    const errors = {errors: {}};      

    const [updTask,convo] = await Promise.all([
      member.Task.promote(member,reqStatus,reqRank),
      models.handlers.convo
        .taskerSaver(member.Convo,member.Task,member,req.payload.id,req.body.message,errors)()
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id']});
    }

    return res.status(200).send({
      task: updTask.createOwnerResponse(req.payload.id,travMap),
      tasker: member.createMemberResponse(travMap),
      messages: convo 
        ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,updTask)
        : []
    });
  } catch(error){
    next(error);
  }
});


router.delete('/:task_via_traveler_id/killoff',auth.required, checkCredentials, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {{[travelerId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  if(HELP_STATUS.publicReview.includes(member.status))
    return res.status(403).send({members: 'cannot killoff an helper or backup - expel first'});

  try{
    await member.destroy();
    return res.status(200).send({
      task: member.Task.createOwnerResponse(req.payload.id,travMap)
    });
  } catch(error){
    next(error);
  }
});


module.exports = router;