const express = require('express');
const moment = require('moment');

const auth = require('../authorization');
const checkMsg = require('../checkMsg');

/** @type {JetModels} */
const models = require('../../models');

const resAttr = require('../../utils/commonResAttr');

const TASK_QUERY_TYPE = require('../../utils/commonFields').TASK_QUERY_TYPE;
const HELP_STATUS = require('../../utils/commonFields').HELP_STATUS;
const dateTime = require('../../utils/commonFunctions').calculateDateTime;

const router = express.Router();

const Op = models.sequelize.Op;

// ************************************************************************************************
// COMMON FUNCTIONS

/** Checks whether the logged user is authorized to act as a tasker for the task.
 * On success, populates:
 * + task, itself populated with taskUsersMap
 * + travMap (travId->UserTraveler) 
 * + infos enabling to populate the passengers (airports, terminals, flights)
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const checkCredentials = async function(req, res, next) {
  /** @type {JetTaskUserInstance} */
  const taskUser = req.taskUser;

  /** @type {string} */
  const userId = req.payload.id;

  if(userId !== taskUser.user_id)
    return res.status(403).send({helper: 'The logged user is not associated with this reference'});

  try{
    const [task,travMap] = await Promise.all([
      models.Task.findById(taskUser.task_id, models.queries.FETCH_FILTERING_TASK),
      models.UsersTravelers.createUserTravsMap(userId)
    ]);

    if(!task)
      return res.status(404).send({helpers: 'Task could not be found'});

    const taskType = task.isProvisional()
      ? TASK_QUERY_TYPE.beneficiary 
      : TASK_QUERY_TYPE.member;

    if(taskType === TASK_QUERY_TYPE.beneficiary){
      req.beneficiary = task.getBeneficiaryRef(travMap);
      req.ownMember = null;

      if(!req.beneficiary)
        return res.status(403).send({helpers: 'The logged user is not authorized to manage this task'});
    
    } else {
      req.ownMember = task.TasksViasTravelers.find(m => m.status === HELP_STATUS.helpee && !!travMap[m.traveler_id]);
      req.beneficiary = null;
    
      if(!req.ownMember)
        return res.status(403).send({helpers: 'The logged user is not authorized to manage this task'});
    } 

    const infos = await task.populate(userId,travMap,true);

    req.task = task;
    req.travMap = travMap;
    req.infos = infos;
    req.taskType = taskType;

    next();

  } catch(error){
    next(error);
  }
};


/** Checks that body.taskers is present and of the correct type
 * 
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next */
const checkTaskerRequests = function(req, res, next) {
  if(!req.body)
    return res.status(422).send({helpers: 'This request must have a body'});

  const members = req.body.members;
  const errors = {errors: {}};
  if(!models.TasksViasTravelers.prevalidateMemberRequests(members,errors))
    return res.status(422).send(errors);

  req.memberRequests = members;
  next();
};


/** Checks whether the logged user is authorized to act as a tasker for the task.
 * On success, populates:
 * + task, itself populated with taskUsersMap
 * + travMap (travId->UserTraveler) 
 * + beneficiary (taskTraveler)
 * + ownMember (taskViaTraveler)
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const retrieveTask = async function(req, res, next){
  /** @type {JetTaskUserInstance} */
  const taskUser = req.taskUser;

  /** @type {string} */
  const userId = req.payload.id;

  /** @type {JetViaTravelerInstance} */
  const passenger = req.passenger;

  if(userId !== taskUser.user_id)
    return res.status(403).send({helper: 'The logged user is not associated with this reference'});

  try{
    const [task,via,traveler,travMap] = await Promise.all([
      models.Task.findById(taskUser.task_id, models.queries.FETCH_TASK_FULL),
      models.Via.findById(passenger.via_id, models.queries.FETCH_FILTERING_VIA),
      models.Traveler.findById(passenger.traveler_id, {attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES}),
      models.UsersTravelers.createUserTravsMap(userId)
    ]);

    if(!task)
      return res.status(404).send({helpers: 'Task could not be found'});
    
    if(!via)
      return res.status(404).send({helpers: 'Passenger\'s travel details could not be found'});
    passenger.via = via;

    if(!traveler)
      return res.status(404).send({helopers: 'Passenger\'s traveler details could not be found'});
    passenger.Traveler = traveler;

    /** @type {JetErrors} */
    const errors = {errors: {}};

    if(!passenger.via.isCompatible(task,errors))
      return res.status(422).send(errors);

    const taskType = task.TasksTravelers.length 
      ? TASK_QUERY_TYPE.beneficiary 
      : TASK_QUERY_TYPE.member;

    if(taskType === TASK_QUERY_TYPE.beneficiary){
      req.beneficiary = task.TasksTravelers.find(b => !!travMap[b.traveler_id]);
      req.ownMember = null;

      if(!req.beneficiary)
        return res.status(403).send({helpers: 'The logged user is not authorized to manage for this task'});
    
    } else {
      req.ownMember = task.TasksViasTravelers.find(m => m.status === HELP_STATUS.helpee && !!travMap[m.traveler_id]);
      req.beneficiary = null;
    
      if(!req.ownMember)
        return res.status(403).send({helpers: 'The logged user is not authorized to manage this task'});
    } 

    await task.populate(userId, travMap);
    req.task = task;
    req.travMap = travMap;
    req.passenger = passenger;
    next();

  } catch(error){
    next(error);
  }
};


// ************************************************************************************************
// PARAM: register the parameter identifying the task: task_user_id
router.param('task_user_id', (req, res, next, taskUserId) => {
  return models.TasksUsers
    .findById(taskUserId, {attributes: resAttr.TASK_USER_ATTRIBUTES})
    .then(taskUser => {
      if(!taskUser)
        return res.status(404).send({helper: 'Task-user reference could not be found'});
        
      req.taskUser = taskUser;
      next();
    })
    .catch(error => {
      next(error);
    });
});


// ************************************************************************************************
// ROUTE GET/find: finds all travelers and members matching a task
router.get('/:task_user_id/find', auth.required, checkCredentials, async(req, res, next) => {
  /** @type {JetTaskInstance} */ const task = req.task;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;
  /** @type {JetTaskRequestExtracts} */ const infos = req.infos;

  try{
    const taskTravIds = task.getTravelerIds();

    const viaWhere = {[Op.and]: []};
    /** @type {moment.Moment} */let earliest;
    /** @type {moment.Moment} */let latest;

    if(req.taskType === TASK_QUERY_TYPE.beneficiary){
      earliest = dateTime(task.earliest_date,task.latest_time);
      latest = dateTime(task.latest_date,task.latest_time);

      viaWhere[Op.and].push({dep_airport_id: {[Op.in]: task.getAirportIds(true)}}),
      viaWhere[Op.and].push({arr_airport_id: {[Op.in]: task.getAirportIds(false)}}),
      viaWhere[Op.and].push({dep_date: {[Op.between]: [task.earliest_date, task.latest_date]}});
      viaWhere[Op.and].push({dep_time: {[Op.between]: [task.earliest_time, task.latest_time]}});

      if(task.TasksFlights && task.TasksFlights.length)
        viaWhere[Op.and].push({flight_id: {[Op.in]: task.TasksFlights.map(taskFlight => taskFlight.flight_id)}});

    } else {
      const taskDateTime = dateTime(task.start_date, task.start_time);
      earliest = moment(taskDateTime).subtract(6,'h'); // 12 hours window
      latest = moment(taskDateTime).add(6,'h');

      const earliestTime = moment().startOf('day').add(earliest.hours(),'h').add(earliest.minutes(),'m');
      const latestTime = moment().startOf('day').add(latest.hours(),'h').add(latest.minutes(),'m');

      viaWhere[Op.and].push({dep_airport_id: task.getAirportIds(true)});
      viaWhere[Op.and].push({arr_airport_id: task.getAirportIds(false)});

      viaWhere[Op.and].push({
        dep_date: earliest.isSame(latest,'day')
          ? earliest.format('YYYY-MM-DD')
          : {[Op.between]: [earliest.format('YYYY-MM-DD'), latest.format('YYYY-MM-DD')]}
      });

      viaWhere[Op.and].push({
        dep_time: earliestTime.isSameOrBefore(latestTime)
          ? {[Op.between]: [earliestTime.format('HH:mm'),latestTime.format('HH:mm')]}
          : {[Op.notBetween]: [latestTime.format('HH:mm'),earliestTime.format('HH:mm')]}
      });

      if(task.flight_id)
        viaWhere[Op.and].push({flight_id: task.flight_id});
    }

    /** @type {Array<JetPassengerResponse>} */
    const passengerResponses = [];
    await models.Via
      .findAll({
        where: viaWhere,
        attributes: resAttr.VIA_UPDATE_ATTRIBUTES,
        include: [{
          model: models.ViasTravelers,
          attributes: models.queries.FETCH_FINDPASSENGER.attributes,
          include: models.queries.FETCH_FINDPASSENGER.include,
          where: {[Op.and]: [
            {traveler_id: {[Op.notIn]: taskTravIds}},
            {volunteer: true}
          ]},
          required: true
        }]
      }).then(vias => {
        vias.forEach(via => {
          const viaTime = dateTime(via.dep_date,via.dep_time);

          if(viaTime.isValid() && viaTime.isBetween(earliest,latest,'m','[]')) {
            passengerResponses.push(
              ...via.ViasTravelers.map(viaTrav => viaTrav.createPassengerFindResponse(travMap,infos))
            );
          }
        });
      });

    const nonTaskerResponses = task.NonTaskers.map(member => member.createFindMemberResponse(travMap,infos));

    return res.status(200).send({
      task: task.createOwnerResponse(req.payload.id,travMap,infos),
      knownCount: nonTaskerResponses.length,
      otherCount: passengerResponses.length,
      knownPassengers: nonTaskerResponses,
      otherPassengers: passengerResponses
    });

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE GET/review: manages existing members
router.get('/:task_user_id/review', auth.required, checkCredentials, (req, res, next) => {
  /** @type {JetTaskInstance} */ const task = req.task;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;
  /** @type {JetTapskRequestExtracts} */ const infos = req.infos;

  try{
    return res.status(200).send({
      task: task.createOwnerResponse(req.payload.id,travMap,infos),
      knownPassengers: task.NonTaskers.map(member => member.createFindMemberResponse(travMap,infos)),
      knownCount: task.NonTaskers.length
    });

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE POST/manage: manages existing members
// Requires body.members to be populated, with each entry: {ref: task_via_traveler_id, status, rank?}
router.post('/:task_user_id/manage', auth.required, checkTaskerRequests, checkCredentials, async (req, res, next) => {
  /** @type {JetTaskInstance} */ const task = req.task;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;
  /** @type {JetTaskRequestExtracts} */ const infos = req.infos;
  /** @type {Array<JetMemberRequest>} */ const memberRequests = req.memberRequests;

  try{

    /** @type {JetErrors} */
    const errors = {errors: {}};

    if(!memberRequests.every((memberRequest,ind) => models.TasksViasTravelers.isValidMemberRequest(task,memberRequest,errors,ind)))
      return res.status(404).send(errors);

    const updTask = await task.applyMemberRequests(memberRequests);
    updTask.updateMembers(infos);
    updTask.updateNonTaskers(infos);

    return res.status(200).send({
      task: updTask.createOwnerResponse(req.payload.id,travMap,infos),
      knownPassengers: task.NonTaskers.map(member => member.createFindMemberResponse(travMap,infos)),
      knownCount: task.NonTaskers.length
    });

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// PARAM: register the via-traveler reference identifying the target passenger
router.param('via_traveler_id', (req, res, next, viaTravelerId) => {
  if(typeof viaTravelerId !== 'string' || viaTravelerId.toString('hex') !== viaTravelerId)
    return res.status(422).send({helper: 'passenger reference is not valid'});
    
  return Promise.all([
    models.ViasTravelers.findById(viaTravelerId,models.queries.FETCH_PASSENGER),
    models.TasksViasTravelers.findOne({
      where: {[Op.and]: [
        {task_id: req.taskUser.task_id},
        {via_traveler_id: viaTravelerId}
      ]},
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
    })
  ]).then(([passenger,member]) => {
    if(!passenger)
      return res.status(404).send({helpers: 'target passenger could not be found'});
    if(member)
      return res.status(403).send({helpers: 'member instance already exists for this passenger'});
    req.passenger = passenger;
    next();
  }).catch(next);
});


// ************************************************************************************************
// ROUTE GET/:task_user_id/via_traveler_id: review the details of a passenger
router.get('/:task_user_id/:via_traveler_id', auth.required, retrieveTask, (req, res) => {
  /** @type {JetTaskInstance} */ const task = req.task;
  /** @type {JetTaskRequestExtracts} */ const infos = req.infos;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;
  /** @type {JetViaTravelerInstance} */ const passenger = req.passenger;

  return res.status(200).send({
    task: task.createOwnerResponse(req.payload.id,travMap,infos),
    passenger: passenger.createPassengerResponse(travMap)
  });
});

// ************************************************************************************************
// ROUTE POST/:task_user_id/via_traveler_id/invite: review the details of a passenger
router.post('/:task_user_id/:via_traveler_id/invite', auth.required, retrieveTask, checkMsg.optional, async (req, res, next) => {
  /** @type {JetTaskInstance} */ const task = req.task;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;
  /** @type {JetTaskRequestExtracts} */ const infos = req.infos;
  /** @type {JetViaTravelerInstance} */ const passenger = req.passenger; 
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  
  try{
    const newMember = passenger.buildMember(task,HELP_STATUS.invited);
    newMember.Task = task;

    await Promise.all([
      newMember.saveAndNotify(null,0,req.payload.id),
      models.TasksUsers
        .buildTaskUsers([newMember],task.taskUsersMap)
        .then(newTaskUsers => Promise.all(newTaskUsers.map(taskUser => taskUser.save())))
    ]);
  
    /**@type {JetErrors} */
    const errors = {errors: {}};
    const convo = await models.handlers.convo
      .taskerSaver(null,task,newMember,req.payload.id,req.body.message,errors)();
  
    if(convo){
      newMember.convo_id = convo.id;
      await newMember.save({fields: ['convo_id']});
    }
  
    const taskResp = task.createOwnerResponse(req.payload.id, travMap, infos);
    const taskerResp = newMember.createMemberResponse(travMap);
    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,task)
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

router.post('/:task_user_id/:via_traveler_id/write', auth.required, retrieveTask, checkMsg.required, async (req, res, next) => {
  /** @type {JetTaskInstance} */ const task = req.task;
  /** @type {{[travId: string]: JetUserTravelerInstance}} */ const travMap = req.travMap;
  /** @type {JetTaskRequestExtracts} */ const infos = req.infos;
  /** @type {JetViaTravelerInstance} */ const passenger = req.passenger; 
  /** @type {JetTaskTravelerInstance} */ const beneficiary = req.beneficiary;
  /** @type {JetTaskViaTravelerInstance} */ const ownMember = req.ownMember;
  
  try{
    const newMember = passenger.buildMember(task,HELP_STATUS.contacted);
    newMember.task = task;
    await Promise.all([
      newMember.save(),
      models.TasksUsers
        .buildTaskUsers([newMember],task.taskUsersMap)
        .then(newTaskUsers => Promise.all(newTaskUsers.map(taskUser => taskUser.save())))
    ]);
  
    /**@type {JetErrors} */
    const errors = {errors: {}};
    const convo = await models.handlers.convo
      .taskerSaver(null,task,newMember,req.payload.id,req.body.message,errors)();
  
    if(!convo)
      return res.status(500).send({helpers: 'new member convo could not be created'});

    newMember.convo_id = convo.id;
    await newMember.save({fields: ['convo_id']});
  
    const taskResp = task.createOwnerResponse(req.payload.id, travMap, infos);
    const taskerResp = newMember.createMemberResponse(travMap);
    const messages = convo
      ? convo.createTaskTaskerResponse(req.payload.id,ownMember,beneficiary,task)
      : [];
  
    return res.status(200).send({task: taskResp, tasker: taskerResp, messages});

  } catch(error){
    next(error);
  }
});

module.exports = router;