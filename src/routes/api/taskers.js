const express = require('express');

const auth = require('../authorization');
const checkMsg = require('../checkMsg');

const resAttr = require('../../utils/commonResAttr');

/** @type {JetModels} */
const models = require('../../models');

const HELP_STATUS = require('../../utils/commonFields').HELP_STATUS;

const router = express.Router();
const Op = models.sequelize.Op;


// ************************************************************************************************
// COMMON FUNCTIONS

/** Checks whether the passenger's traveler is associated with the logged user
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const checkCredentials = function(req, res, next){
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {string} */ const userId = req.payload.id;

  return models.UsersTravelers
    .findOne({
      where: {[Op.and]: [
        {user_id: userId},
        {traveler_id: member.traveler_id}
      ]},
      attributes: resAttr.USER_TRAVELER_ATTRIBUTES
    }).then(userTrav => {
      if(!userTrav)
        return res.status(403).send({taskers: 'logged user not authorized to act on behalf of this tasker'});
      req.travMap = {[userTrav.traveler_id]: userTrav};
      next();
    }).catch(next);
};


// ************************************************************************************************
// PARAM: register the task_via_traveler reference
router.param('task_via_traveler_id', (req, res, next, memberId) => {
  if(typeof memberId !== 'string' || memberId.toString('hex') !== memberId)
    return res.status(422).send({helper: 'task member reference is not valid'});
    
  return models.TasksViasTravelers
    .findById(memberId,models.queries.FETCH_MEMBER)
    .then(member => {
      if(!member)
        return res.status(404).send({taskers: 'target task member could not be found'});
      req.member = member;
      next();
    }).catch(next);
});


// ************************************************************************************************
// ROUTE get/:task_via_traveler : retrieves details of one particular tasker
router.get('/:task_via_traveler_id', auth.required, checkCredentials, async (req,res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ 
  const member = req.member;

  /** @type {{[travId: string]: JetUserTravelerInstance}} */ 
  const travMap = req.travMap;

  try{

    const convo = member.Convo;
    const infos = await models.UsersTravelers
      .createUserTravsMap(req.payload.id)
      .then(() => member.Task.populate(req.payload.id,travMap));

    const taskUser = member.Task.taskUsersMap[req.payload.id];
    const taskResp = member.Task.createHelperResponse(taskUser, travMap, member,infos);
    const taskerResp = member.createMemberResponse(travMap);

    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,member,null,member.Task)
      : [];

    return res.status(200).send({
      task: taskResp,
      tasker: taskerResp,
      messages
    });

  } catch(error){
    next(error);
  }
})



// ************************************************************************************************
// ROUTE post/:task_via_traveler/join : accepts invitation to join a task
router.post('/:task_via_traveler_id/join', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    if(member.status !== HELP_STATUS.invited)
      return res.status(403).send({member: 'Passenger has not been invited to this task'});

    const currentHelper = member.Task.getHelper();
    const status = currentHelper ? HELP_STATUS.backup : HELP_STATUS.helper;
    const rank = status === HELP_STATUS.backup ? member.Task.getNextBackupRank(): 0;

    const [{updTask,infos},convo] = await Promise.all([
      Promise.all([
        member.Task.admit(member, status, rank),
        models.UsersTravelers.createTravUserTravMap(req.payload.id,member.Task.getTravelerIds(),travMap)
      ]).then(([task]) => {
        return task
          .populate(req.payload.id,travMap)
          .then((infos) => ({updTask: task,infos}));
      }),
      models.handlers.convo
        .taskerSaver(member.Convo, member.Task,member,req.payload.id,req.body.message,errors,true)()
    ]);

    member.status = status;
    member.rank = rank;

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id','status']});
    }

    const taskUser = updTask.taskUsersMap[req.payload.id];
    const taskResp = updTask.createHelperResponse(taskUser, travMap, member, infos);
    const taskerResp = member.createMemberResponse(travMap);  
    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,member,null,member.Task)
      : [];

    return res.status(200).send({
      task: taskResp, 
      tasker: taskerResp, 
      messages
    });
  
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE post/:task_via_traveler/apply : offers to join a task following pre-established contact
router.post('/:task_via_traveler_id/apply', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    if(HELP_STATUS.privateReview.includes(member.status))
      return res.status(403).send({member: 'Passenger is already a member of this task'});
    else if(member.status === HELP_STATUS.invited)
      return res.status(403).send({member: 'Passenger has already been invited to this task: use join route instead'});

    const status = member.via.isCompatible(member.Task,errors)
      ? HELP_STATUS.applied
      : HELP_STATUS.incompatible;

    if(status === HELP_STATUS.incompatible){
      if(member.status === HELP_STATUS.incompatible)
        return res.status(403).send({tasker: 'Passenger/`s travel details are incompatible with this task'});

      else {
        const prevStatus = member.status;
        const prevRank = member.rank;

        member.status = status;
        member.rank = 0;
        await member.saveAndNotify(prevStatus,prevRank,req.payload.id,{fields: ['status']})
        return res.status(403).send({tasker: 'Passenger\'s travel details are incompatible with this task'});
      }
    }

    const prevStatus = member.status;
    const prevRank = member.rank;
    member.status = status;
    member.rank = 0;

    const [convo,infos] = await Promise.all([
      models.handlers.convo
        .taskerSaver(member.Convo, member.Task,member,req.payload.id,req.body.message,errors,true)(),
      models.UsersTravelers
        .createUserTravsMap(req.payload.id)
        .then(() => member.Task.populate(req.payload.id,travMap)),
      await member.saveAndNotify(prevStatus,prevRank,req.payload.id,{fields: ['status']})
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id','status']});
    }

    const taskUser = member.Task.taskUsersMap[req.payload.id];
    const taskResp = member.Task.createHelperResponse(taskUser, travMap, member,infos);
    const taskerResp = member.createMemberResponse(travMap);  
    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,member,null,member.Task)
      : [];

    return res.status(200).send({
      task: taskResp, 
      tasker: taskerResp,
      messages});
  
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE delete/invite : remove the application to join a particular task as a helper or backup
// requires parameters: 
router.delete('/:task_via_traveler_id/apply', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    if(member.status !== HELP_STATUS.applied)
      return res.status(403).send({member: 'Passenger status must be applied'});

    const status = member.via.isCompatible(member.Task,errors)
      ? HELP_STATUS.pulled
      : HELP_STATUS.incompatible;

    if(status === HELP_STATUS.incompatible){
      if(member.status === HELP_STATUS.incompatible)
        return res.status(403).send({tasker: 'Passenger/`s travel details are incompatible with this task'});

      else {
        const prevStatus = member.status;
        const prevRank = member.rank;
        member.status = status;
        member.rank = 0;
        await member.saveAndNotify(prevStatus,prevRank,req.payload.id,{fields: ['status']})
        return res.status(403).send({tasker: 'Passenger\'s travel details are incompatible with this task'});
      }
    }

    member.status = status;
    member.rank = 0;

    const [convo,infos] = await Promise.all([
      models.handlers.convo
        .taskerSaver(member.Convo, member.Task,member,req.payload.id,req.body.message,errors,true)(),
      models.UsersTravelers
        .createUserTravsMap(req.payload.id)
        .then(() => member.Task.populate(req.payload.id,travMap)),
      member.save({fields: ['status','rank']}),
    ]);

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id','status']});
    }

    const taskUser = member.Task.taskUsersMap[req.payload.id];
    const taskResp = member.Task.createHelperResponse(taskUser, travMap, member, infos);
    const taskerResp = member.createMemberResponse(travMap);  
    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,member,null,member.Task)
      : [];

    return res.status(200).send({
      task: taskResp, 
      tasker: taskerResp,
      messages
    });
  
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE post/:task_via_traveler/write : write a message to the helpees using pre-established contact
router.post('/:task_via_traveler_id/write', auth.required, checkCredentials, checkMsg.required, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    const [convo,infos] = await Promise.all([
      models.handlers.convo
        .taskerSaver(member.Convo, member.Task,member,req.payload.id,req.body.message,errors,true)()
        .then(convo => {
          if(convo && !member.Convo){
            member.convo_id = convo.id;
            member.Convo = convo;
            return member.save({fields: ['convo_id']}).then(() => convo);
          }
          return convo;
        }),
      models.UsersTravelers
        .createUserTravsMap(req.payload.id)
        .then(() => member.Task.populate(req.payload.id,travMap))
    ]);

    const taskUser = member.Task.taskUsersMap[req.payload.id];
    const taskResp = member.Task.createHelperResponse(taskUser, travMap, member,infos);
    const taskerResp = member.createMemberResponse(travMap);  
    const messages = convo.createTaskTaskerResponse(req.payload.id,member,null,member.Task);

    return res.status(200).send({
      task: taskResp, 
      tasker: taskerResp,
      messages
    });

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE post/leave : cancels "helper" or "backup" status
router.post('/:task_via_traveler_id/leave', auth.required, checkCredentials, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskViaTravelerInstance} */ const member = req.member;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    if(!HELP_STATUS.taskers.includes(member.status))
      return res.status(403).send({member: 'Member status does not corresponds to a tasker.'});

    const [{updTask,infos},convo] = await Promise.all([
      Promise.all([
        member.Task.expel(member,HELP_STATUS.invited),
        models.UsersTravelers.createTravUserTravMap(req.payload.id,member.Task.getTravelerIds(),travMap)
      ]).then(([task]) => {
        return task
          .populate(req.payload.id,travMap)
          .then((infos) => ({updTask: task,infos}));
      }),
      models.handlers.convo
        .taskerSaver(member.Convo, member.Task,member,req.payload.id,req.body.message,errors,true)()
    ]);

    member.status = HELP_STATUS.invited;
    member.rank = 0;

    if(convo && !member.Convo){
      member.convo_id = convo.id;
      member.Convo = convo;
      await member.save({fields: ['convo_id','status']});
    }

    const taskUser = updTask.taskUsersMap[req.payload.id];
    const taskResp = updTask.createHelperResponse(taskUser, travMap, member,infos);
    const taskerResp = member.createMemberResponse(travMap);  
    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,member,null,member.Task)
      : [];

    return res.status(200).send({
      task: taskResp, 
      tasker: taskerResp,
      messages
    });
  
  } catch(error){
    next(error);
  }
});


module.exports = router;