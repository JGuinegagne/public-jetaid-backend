const express = require('express');

const auth = require('../authorization');
const checkMsg = require('../checkMsg');

const resAttr = require('../../utils/commonResAttr');

/** @type {JetModels} */
const models = require('../../models');

const TASK_STATUS = require('../../utils/commonFields').TASK_STATUS;
const TASK_QUERY_TYPE = require('../../utils/commonFields').TASK_QUERY_TYPE;
const HELP_STATUS = require('../../utils/commonFields').HELP_STATUS;

const Op = models.sequelize.Op;

const router = express.Router();


// ************************************************************************************************
// COMMON FUNCTIONS

/** Retrieves params reqtype {bnf | mbr} and taskref {task_traveler_id | task_via_traveler_id}:
 * + member (task-via-traveler) or beneficiary (task-traveler) for via- or provisional- task, respectively,
 * and save as req.member or req.beneficiary
 * + passenger (via-traveler) of the filtration helper
 * + target task
 * + via of the filtration helper
 * + curMember (task-via-traveler) where via_traveler_id = viaTraveler.id and task_id = task.id
 * + taskUsersMap (useId -> task-user) for which task_id = task.id
 * 
 * Checks that the logged user is associated to the passenger's traveler
 * 
 * On success, populates req.passenger (of the querier), req.member or req.beneficiary (of the target)
 * req.task, req.passenger (populated with its via), req.curMember, req.refType = bnf | mbr and req.taskUsersMap
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const retrieveTask = async function(req, res, next){
  /** @type {JetViaTravelerInstance} */const passenger = req.passenger;
  /** @type {string} */ const userId = req.payload.id;

  const reqType = req.query.reqtype;
  const taskRef = req.query.taskref;

  if(typeof reqType !== 'string' || !TASK_QUERY_TYPE.values.includes(reqType))
    return res.status(422).send({taskers: 'Missing query task ref specification'});

  if(typeof taskRef !== 'string' || taskRef.toString('hex') !== taskRef)
    return res.status(422).send({taskers: 'No valid task reference was provided'});

  let taskId = '';

  try {
    switch(reqType){

    case TASK_QUERY_TYPE.beneficiary:
      await Promise.all([
        models.UsersTravelers.findOne({
          where: {[Op.and]: [
            {user_id: userId},
            {traveler_id: passenger.traveler_id}
          ]},
          attributes: resAttr.USER_TRAVELER_ATTRIBUTES
        }),
        models.TasksTravelers.findById(taskRef,{attributes: resAttr.TASK_TRAVELER_ATTRIBUTES}),

      ]).then(([userTrav,beneficiary]) => {
        req.beneficiary = beneficiary;
        req.refType = TASK_QUERY_TYPE.beneficiary;
        taskId = beneficiary ? beneficiary.task_id : null;
        req.travMap = userTrav ? {[userTrav.traveler_id]: userTrav} : null;
      });
      break;
  
    case TASK_QUERY_TYPE.member:
      await Promise.all([
        models.UsersTravelers.findOne({
          where: {[Op.and]: [
            {user_id: userId},
            {traveler_id: passenger.traveler_id}
          ]},
          attributes: resAttr.USER_TRAVELER_ATTRIBUTES
        }),
        models.TasksViasTravelers.findById(taskRef, {attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES}),
      ]).then(([userTrav,member]) => {
        req.member = member;
        req.refType = TASK_QUERY_TYPE.member;
        taskId = member ? member.task_id : null;
        req.travMap = userTrav ? {[userTrav.traveler_id]: userTrav} : null;
      });
      break;
  
    default: return res.status(500).send({passengers: 'Task ref type not handled'});
    }

    if(!taskId)
      return res.status(404).send({passengers: 'Task could not be found'});

    if(!req.travMap)
      return res.status(403).send({passengers: 'Logged user not authorized to act on behalf of this passenger'});

    const [[task,curMember,travMap],via,taskUsersMap] = await Promise.all([
      Promise.all([
        (req.refType === TASK_QUERY_TYPE.beneficiary
          ? models.Task.findById(taskId, models.queries.FETCH_DETAILS_PROVISIONAL_TASK)
          : models.Task.findById(taskId, models.queries.FETCH_DETAILS_FROMVIA_TASK)
        ),
        models.TasksViasTravelers.findOne({
          where: {[Op.and]: [
            {task_id: taskId},
            {via_traveler_id: passenger.id}
          ]},
          attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
          include: models.queries.FETCH_TASK_VIA_TRAVELER_CONVO
        })
      ]).then(([task,curMember]) => {
        if(!task)
          return Promise.reject({taskers: 'Target task could not be found'});
        
        const fetchAddresses = curMember && curMember.isAuthorized();
        
        /** @type {JetTaskRequestExtracts} */
        const infos = {addressMap: {}};

        if(task.dep_address_id && fetchAddresses)
          infos.addressMap[task.dep_address_id] = null;
        if(task.arr_address_id && fetchAddresses)
          infos.addressMap[task.arr_address_id] = null;

        return Promise.all([
          task.createTravMap(userId,req.travMap),
          models.inputs.task.fetch.extendedAddresses(infos)
        
        ]).then(([travMap]) => {
          task.DepAddress = task.dep_address_id && fetchAddresses ? infos[task.dep_address_id] : null;
          task.ArrAddress = task.arr_address_id && fetchAddresses ? infos[task.arr_address_id] : null;
          return [task,curMember,travMap];
        });
      }),
      
      models.Via.findById(req.passenger.via_id, models.queries.FETCH_FILTERING_VIA),
      models.TasksUsers.createTaskUsersMap(taskId)
    ]);

    if(!task)
      return res.status(404).send({passengers: 'Target task could not be found'});
  
    if(!via)
      return res.status(404).send({passengers: 'Passenger\'s travel info could not be found'});

    task.taskUsersMap = taskUsersMap;
    req.task = task;
    req.travMap = travMap;

    req.passenger.Via = via;
    req.curMember = curMember;

    req.convo = curMember ? curMember.Convo : null;
    next();

  } catch(error){
    next(error);
  }
};


// ************************************************************************************************
// Register param :via_traveler_id
// Adds fields .passenger to req
router.param('via_traveler_id',(req, res, next, viaTravelerId) => {
  models.ViasTravelers.findById(viaTravelerId, {attributes: resAttr.VIA_TRAVELER_ATTRIBUTES})
    .then(viaTraveler => {
      if(viaTraveler){
        req.passenger = viaTraveler;
        next();
      } else
        return res.status(404).send({passengers: 'passenger reference could not be found'});
    }).catch(next);
});



// ************************************************************************************************
// ROUTE GET/FIND: finds compatible tasks for a specified passenger
router.get('/:via_traveler_id/find',auth.required, async (req, res, next) => {
  /** @type {JetViaTravelerInstance} */ const passenger = req.passenger;
  /** @type {string} */ const userId = req.payload.id;

  try {
    // GET/FIND ROUTE: STEP #1 ------------------------------------------------------------
    const [userTrav,via] = await Promise.all([
      models.UsersTravelers.findOne({
        where: {[Op.and]: [
          {user_id: userId},
          {traveler_id: passenger.traveler_id}
        ]},
        attributes: resAttr.USER_TRAVELER_ATTRIBUTES
      }),
      models.Via.findById(passenger.via_id, models.queries.FETCH_FILTERING_VIA)
    ]);
    // End of GET/FIND ROUTE: STEP #1 ----------------------------------------------------- 


    // GET/FIND ROUTE: STEP #2 ------------------------------------------------------------
    if(!userTrav)
      return res.status(403).send({passengers: 'Logged user not authorized to act on behalf of this passenger'});

    if(!via)
      return res.status(404).send({passengers: 'Could not find the filtration via'});

    const viaTaskWhere = {
      [Op.and]: [
        {start_date: via.dep_date},
        {flight_id: via.flight_id},
        {status: {[Op.in]: TASK_STATUS.searchables}}
      ]
    };

    const [membershipsMap, userTaskMap, travMap, viaTasks, provTasks] = await Promise.all([
      models.TasksViasTravelers.createMembershipsMap(passenger.id),
      models.TasksUsers.createUserTasksMap(userId),
      models.UsersTravelers.createUserTravsMap(userId),
      models.Task.findAll({
        where: viaTaskWhere,
        attributes: models.queries.FETCH_FIND_FROMVIA_TASK.attributes,
        include: models.queries.FETCH_FIND_FROMVIA_TASK.include   
      }),
      models.Task.findAll(models.queries.find_provTasks(via))
    ]);
    // End of GET/FIND ROUTE: STEP #2 ----------------------------------------------------- 

    const airportMap = {};
    airportMap[via.DepAirport.id] = via.DepAirport;
    airportMap[via.ArrAirport.id] = via.ArrAirport;

    const resp = {
      viaTaskCount: 0,
      provTaskCount: 0,

      viaTasks: [],
      provisionalTasks: [],
    };

    if(!viaTasks.length && !provTasks.length)
      return res.status(200).send(resp);

    resp.viaTasks.push(
      ...viaTasks.map(viaTask => viaTask.createFindResponse(airportMap, membershipsMap, userTaskMap,travMap))
    );
    resp.provisionalTasks.push(
      ...provTasks
        .sort((t1,t2) => t1.earliestDateTimeCompare(t2))
        .map(provTask => provTask.createProvisionalFindResponse(airportMap, membershipsMap, userTaskMap,travMap))
    );
    resp.viaTaskCount = resp.viaTasks.length;
    resp.provTaskCount = resp.provisionalTasks.length;

    return res.status(200).send(resp);
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE get/review : review the details of one particular task
// requires parameters: 
// -- reqtype {prov | via} for 'provisional' task (no via booked yet) or 'via' task
// -- taskref (task_traveler_id or task_via_traveler_id) of the TARGET task
router.get('/:via_traveler_id/review', auth.required, retrieveTask, (req, res) => {
  /** @type {JetTaskInstance} */
  const task = req.task;
  
  /** @type {JetTaskViaTravelerInstance} */
  const curMember = req.curMember;

  /** @type {JetConvoInstance} */
  const convo = req.convo;

  const taskUser = task.taskUsersMap[req.payload.id];
  const taskResp = task.createHelperResponse(taskUser, req.travMap, curMember);
  const messages = convo
    ? convo.createTaskTaskerResponse(req.payload.id,curMember,null,task)
    : [];

  return res.status(200).send({task: taskResp, messages});
});


// ************************************************************************************************
// ROUTE get/write : write to the helpees / helpee members of a one particular task
// requires parameters: 
// -- reqtype {prov | via} for 'provisional' task (no via booked yet) or 'via' task
// -- taskref (task_traveler_id or task_via_traveler_id) of the TARGET task
router.post('/:via_traveler_id/write', auth.required, checkMsg.required, retrieveTask, async (req, res, next) => {
  /** @type {JetTaskInstance} */
  const task = req.task;

  /** @type {JetViaTravelerInstance} */
  const passenger = req.passenger;

  /** @type {JetTaskViaTravelerInstance} */
  let curMember = req.curMember;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;

  try {
    if(!curMember){
      curMember = passenger.buildMember(task,HELP_STATUS.contacted);
      await Promise.all([
        curMember.save(),
        models.TasksUsers
          .buildTaskUsers([curMember],task.taskUsersMap)
          .then(newTaskUsers => Promise.all(newTaskUsers.map(taskUser => taskUser.save())))
      ]);
    }

    /**@type {JetErrors} */
    const errors = {errors: {}};
    await models.handlers.convo
      .taskerSaver(curConvo,task,curMember,req.payload.id,req.body.message,errors,true)()
      .then(convo => curConvo = convo);

    if(curConvo && !req.convo){
      curMember.convo_id = curConvo.id;
      await curMember.save({fields: ['convo_id']});
    }

    const taskUser = task.taskUsersMap[req.payload.id];
    const taskResp = task.createHelperResponse(taskUser, req.travMap, curMember);
    const messages = curConvo
      ? curConvo.createTaskTaskerResponse(req.payload.id,curMember,null,task)
      : [];

    return res.status(200).send({task: taskResp, messages});

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE post/apply : apply to join one particular task as a helper or backup
// requires parameters: 
// -- reqtype {prov | via} for 'provisional' task (no via booked yet) or 'via' task
// -- taskref (task_traveler_id or task_via_traveler_id) of the TARGET task
router.post('/:via_traveler_id/apply',auth.required, checkMsg.optional, retrieveTask, async (req, res, next) => {
  /** @type {JetTaskInstance} */
  const task = req.task;

  /** @type {JetViaTravelerInstance} */
  const passenger = req.passenger;

  /** @type {JetTaskViaTravelerInstance} */
  let curMember = req.curMember;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;

  try{
    /**@type {JetErrors} */
    const errors = {errors: {}};

    if(!passenger.isCompatible(task,errors))
      return res.status(403).send(errors);

    if(!curMember){
      curMember = passenger.buildMember(task,HELP_STATUS.applied);
      await Promise.all([
        curMember.save(),
        models.TasksUsers
          .buildTaskUsers([curMember],task.taskUsersMap)
          .then(newTaskUsers => Promise.all(newTaskUsers.map(taskUser => taskUser.save())))
      ]);
    } else {
      curMember.status = HELP_STATUS.applied;
    }

    await models.handlers.convo
      .taskerSaver(curConvo,task,curMember,req.payload.id,req.body.message,errors,true)()
      .then(convo => curConvo = convo);

    if(curConvo && !req.convo){
      curMember.convo_id = curConvo.id;
      await curMember.save({fields: ['convo_id','status']});
    } else
      await curMember.save({fields: ['status']});

    const taskUser = task.taskUsersMap[req.payload.id];
    const taskResp = task.createHelperResponse(taskUser, req.travMap, curMember);
    const messages = curConvo
      ? curConvo.createTaskTaskerResponse(req.payload.id,curMember,null,task)
      : [];

    return res.status(200).send({task: taskResp, messages});

  } catch(error){
    next(error);
  }
});


module.exports = router;