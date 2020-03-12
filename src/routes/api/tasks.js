const express = require('express');

const auth = require('../authorization');
const resAttr = require('../../utils/commonResAttr');

/** @type {JetModels} */
const models = require('../../models');

const HELP_STATUS = require('../../utils/commonFields').HELP_STATUS;
const TASK_QUERY_TYPE = require('../../utils/commonFields').TASK_QUERY_TYPE;

const TaskAssembly = models.handlers.TaskAssembly;
const generateMap = require('../../utils/commonFunctions').generateMap;
const invertMap = require('../../utils/commonFunctions').invertMap;

const router = express.Router();
const Op = models.sequelize.Op;


// ************************************************************************************************
// COMMON FUNCTIONS
/** @param {Array<string>} taskIds
 * @param {string} userId
 * @param {JetInfos} infos
 * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
const createProvisionalTasksResponse = function(taskIds, userId, infos, travMap){
  if(!taskIds || !taskIds.length)
    return Promise.resolve([]);
    
  return Promise.all([
    models.Task.findAll({
      where: {id: {[Op.in]: taskIds}},
      attributes: models.queries.FETCH_REVIEW_PROVISIONAL_TASK.attributes,
      include: models.queries.FETCH_REVIEW_PROVISIONAL_TASK.include
    }),
    models.TasksUsers.findAll({
      where: {[Op.and]: [
        {task_id: {[Op.in]: taskIds}},
        {user_id: userId}
      ]},
      attributes: resAttr.TASK_USER_ATTRIBUTES
    }),
    models.TasksTravelers.findAll({
      where: {task_id: {[Op.in]: taskIds}},
      attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
    }).then(beneficiaries => {
      const map = generateMap(beneficiaries,'traveler_id');
      return models.Traveler
        .createMap(Object.keys(map))
        .then(travelerIdMap => {
          return [beneficiaries,travelerIdMap];
        });
    }),
    models.inputs.task.fetch.extendedAddresses(infos)

  ]).then(([tasks,userTasks,[beneficiaries,travelerIdMap]]) => {
    infos.travelerIdMap = travelerIdMap;

    const taskAssembly = TaskAssembly.createAssembly('ownProvTask'); 
    taskAssembly.addTasks(...tasks);
    taskAssembly.addTasksUsers(...userTasks);
    taskAssembly.addBeneficiaries(...beneficiaries);
    taskAssembly.assemble(infos,generateMap(userTasks,'task_id'));

    return taskAssembly.createResponses(travMap,infos);
  });
};


/** 
 * @param {Array<string>} taskIds
 * @param {string} userId
 * @param {JetInfos} infos
 * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
const createFromViaTasksResponse = function(taskIds, userId, infos, travMap){
  if(!taskIds || !taskIds.length)
    return Promise.resolve([]);

  return Promise.all([
    models.Task.findAll({
      where: {id: {[Op.in]: taskIds}},
      attributes: models.queries.FETCH_REVIEW_FROMVIA_TASK.attributes
    }),
    models.TasksUsers.findAll({
      where: {[Op.and]: [
        {task_id: {[Op.in]: taskIds}},
        {user_id: userId}
      ]},
      attributes: resAttr.TASK_USER_ATTRIBUTES
    }),
    models.TasksViasTravelers.findAll({
      where: {[Op.and]: [
        {task_id: {[Op.in]: taskIds}},
        {status: {[Op.in]: HELP_STATUS.travelerUnique}}
      ]},
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
    }).then(members => {
      const map = generateMap(members,'traveler_id');
      return models.Traveler.createMap(Object.keys(map))
        .then(travelerIdMap => {
          return [members,travelerIdMap];
        });
    }),
    models.inputs.task.fetch.extendedAddresses(infos)

  ]).then(([tasks,userTasks,[members,travelerIdMap]]) => {
    infos.travelerIdMap = travelerIdMap;
    const taskAssembly = TaskAssembly.createAssembly('ownTask'); 
    taskAssembly.addTasks(...tasks);
    taskAssembly.addTasksUsers(...userTasks);
    taskAssembly.addMembers(...members);
    taskAssembly.assemble(infos,generateMap(userTasks,'task_id'));

    return taskAssembly.createResponses(travMap,infos);
  });
};



// ************************************************************************************************
// ROUTE POST/CREATE: creates a set of new tasks from scratch
// Expecting requests in the form api/tasks/create
//
// STEP#1: retrieves airport, travelers, neighborhood, addresses data for each field of each request
// STEP#2: checks the validity of each requests based on the results of step#1
// -- returns an error if any field of any request cannot be matched
// -- if all ok: builds, but doesn't persist new address and task instances
// -- if all ok: fetches all travelers required to be associated with each task instance
// STEP#3: persists new address and tasks instances
// STEP#4: associate new task instances with airports, travelers and users
// STEP#5: fetch resulting instances and format them for http response
router.post('/create',auth.required, async (req, res, next) => {
  if(!req.body || !req.body.tasks || !Array.isArray(req.body.tasks))
    return res.status(422).send({errors: {tasks: 'create: request must include a body.tasks of type "array"'}});

  /** @type {Array<JetProvisionalTaskRequest>} */
  const taskRequests = req.body.tasks;

  /** @type {string} */
  const userId = req.payload.id;
  const errorResp = {errors: {}};

  if(!taskRequests.every((taskRequest,ind) => models.inputs.task.validate.provisional(taskRequest,ind,errorResp)))
    return res.status(422).send(errorResp);

  try{
    // POST/CREATE STEP #1: Retrieves data for each requests: ------------------------------

    const infos = await models.inputs.task.fetch.provisionalInfos(userId,taskRequests);
    const travMap = infos.travMap;

    if(!models.inputs.task.populate.provisionalRequests(taskRequests,infos,travMap,errorResp))
      return res.status(422).send(errorResp);

    // Builds, but does not persist, all tasks instances
    taskRequests.forEach(taskRequest =>  {
      taskRequest.task = models.inputs.task.build.provisional(taskRequest,userId);
    });
    // End of POST/CREATE STEP #1 ---------------------------------------------------------


    // POST/CREATE ROUTE STEP #2: fetches all the users associated with the travelers -----
    // in the task requests to create taskUser instance
    // create all the custom


    const allTravelerIds = models.inputs.task.get.beneficiaryIds(taskRequests);

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(allTravelerIds),
      models.inputs.task.fetch.provisionalHoods(taskRequests)
    ]);

    if(!taskRequests.every((taskReq,tInd) => models.inputs.task.validate.provisionalHoods(taskReq,infos,errorResp,tInd)))
      return res.status(422).send(errorResp);


    // End of POST/CREATE STEP #2 ---------------------------------------------------------

    // POST/CREATE STEP #3: Persist task instances ----------------------------------------
    await Promise.all(taskRequests.map(taskReq => {
      const depCustAddress = taskReq.depCityLocation && taskReq.depCityLocation.customAddress
        ? taskReq.depCityLocation.address : null;

      const arrCustAddress = taskReq.arrCityLocation && taskReq.arrCityLocation.customAddress
        ? taskReq.arrCityLocation.address : null;

      return Promise.all([
        depCustAddress ? depCustAddress.save() : Promise.resolve(depCustAddress),
        arrCustAddress ? arrCustAddress.save() : Promise.resolve(arrCustAddress)
      ])
        .then(() => taskReq.task.save())
        .then(() => {
          const taskTravelers = models.TasksTravelers.buildFromProvisionalRequest(taskReq);
          const taskUsers = models.TasksUsers.buildFromProvisionalRequest(taskReq,travUsersMap);
          const taskAirports = models.TasksAirports.buildFromRequest(taskReq);

          return Promise.all([
            ...taskTravelers.map(taskTrav => taskTrav.save()),
            ...taskUsers.map(taskUser => taskUser.save()),
            ...taskAirports.map(taskAirport => taskAirport.save())
          ]);
        });
    }));
    // End of POST/CREATE STEP #3 ---------------------------------------------------------


    // POST/CREATE STEP #4: Fetch resulting rider instance --------------------------------
    const taskIds = taskRequests.map(taskReq => taskReq.task.id);
    const taskResponses = await createProvisionalTasksResponse(taskIds,userId,infos,travMap);

    // End of POST/CREATE STEP #4 ---------------------------------------------------------
    return res.status(200).send({tasks: taskResponses});
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE POST/ADD: creates a set of new tasks derived from via
// Expecting requests in the form api/tasks/add
router.post('/add',auth.required,async (req, res, next) => {
  if(!req.body || !req.body.tasks || !Array.isArray(req.body.tasks))
    return res.status(422).send({errors: {tasks: 'create: request must include a body.tasks of type "array"'}});

  /** @type {Array<JetTaskRequestFromVia>} */
  const taskRequests = req.body.tasks;

  if(!taskRequests.length)
    return res.status(422).send({errors: {tasks: 'Tasks may not be an empty array'}});

  /** @type {string} */
  const userId = req.payload.id;
  const errors = {errors: {}};

  if(!taskRequests.every((taskRequest,ind) => models.inputs.task.validate.fromVia(taskRequest,ind,errors)))
    return res.status(422).send(errors);

  const tripUserIds = {};
  taskRequests.forEach(task => (tripUserIds[task.tripUser] = true));

  try{

    // POST/ADD ROUTE STEP #1: retrieves the tripUser and trav->UserTrav map ---------------
    const [userTrips,travMap] = await Promise.all([
      models.TripsUsers.findAll({
        where: {id: {[Op.in]: Object.keys(tripUserIds)}},
        attributes: resAttr.TRIP_USER_ATTRIBUTES
      }),
      models.UsersTravelers.createUserTravsMap(userId)
    ]);

    if(!userTrips || !userTrips.every((userTrip,ind) => {
      if(userTrip.user_id !== userId){
        errors.errors[`task${ind}`] = 'tasks: userTrip ref not associated with the logged user';
        return false;
      }
      return true;
    }))
      return res.status(403).send(errors);
    // End of POST/ADD ROUTE STEP #1 ------------------------------------------------------ 

    
    // POST/ADD ROUTE STEP #2: fetches trips infos and tasks requests address info --------
    const {infos,tripMaps} = await models.inputs.task.fetch.viaInfos(userId,taskRequests,userTrips,travMap);
    infos.tripUserIdMap = generateMap(userTrips,'trip_id');

    if(!models.inputs.task.populate.fromViaRequests(taskRequests,infos,tripMaps.tripUserMap,errors))
      return res.status(422).send(errors);

    // Builds, but does not persist, all tasks instances
    taskRequests.forEach(taskRequest =>  {
      taskRequest.task =  models.inputs.task.build.fromVia(taskRequest,userId);
    });
    // End of POST/ADD ROUTE STEP #2 ------------------------------------------------------


    // POST/ADD ROUTE STEP #3:  ---- fetches all the users associated with the travelers -- 
    // in the task requests to create taskUser instance.
    // Builds custom addresses and fetches their neighborhoods
    const allTravelerIds = models.inputs.task.get.fromViaMemberIds(taskRequests);

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(allTravelerIds),
      models.inputs.task.fetch.boundHoods(taskRequests)
    ]);

    if(!taskRequests.every((taskReq,tInd) => models.inputs.task.validate.hoods(taskReq,infos,errors,tInd)))
      return res.status(422).send(errors);
    // End of POST/ADD ROUTE STEP #3 -------------------------------------------------------


    // POST/ADD STEP #4: Persist task instances --------------------------------------------
    await Promise.all(taskRequests.map(taskReq => {
      const depCustAddress = taskReq.depCityLocation && taskReq.depCityLocation.customAddress
        ? taskReq.depCityLocation.address : null;
      const arrCustAddress = taskReq.arrCityLocation && taskReq.arrCityLocation.customAddress
        ? taskReq.arrCityLocation.address : null;

      return Promise.all([
        depCustAddress ? depCustAddress.save() : Promise.resolve(depCustAddress),
        arrCustAddress ? arrCustAddress.save() : Promise.resolve(arrCustAddress)
      ])
        .then(() => taskReq.task.save())
        .then(() => {
          const taskViaTravelers = models.TasksViasTravelers.buildFromViaRequest(taskReq);
          const taskUsers = models.TasksUsers.buildFromViaRequest(taskReq,travUsersMap);

          return Promise.all([
            ...taskViaTravelers.map(taskViaTrav => taskViaTrav.save()),
            ...taskUsers.map(taskUser => taskUser.save()),
          ]);
        });
    }));
    // End of POST/ADD STEP #4 ------------------------------------------------------------

    // POST/ADD STEP #5: Fetch resulting task instances -----------------------------------
    const taskIds = taskRequests.map(taskReq => taskReq.task.id);
    const taskResponses = await createFromViaTasksResponse(taskIds,userId,infos,travMap);

    // End of POST/ADD STEP #5 ------------------------------------------------------------
    return res.status(200).json({tasks: taskResponses});
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route update: 
// Expecting request in the form PUT api/tasks/
router.put('/', auth.required, async (req, res, next) => {
  if(!req.body.viaTasks || !Array.isArray(req.body.viaTasks))
    return res.status(422).send({errors: {tasks: 'Body must include a viaTasks field of type array'}});

  if(!req.body.provisionalTasks || !Array.isArray(req.body.provisionalTasks))
    return res.status(422).send({errors: {tasks: 'Body must include a provisionalTasks field of type array'}});
  
  if (!req.body.viaTasks.length && !req.body.provisionalTasks.length)
    return res.status(422).send({errors: {tasks: 'Either viaTasks and/or provisionalTasks must not be empty'}});

  /** @type {Array<JetFromViaTaskUpdateRequest>} */
  const viaTaskRequests = req.body.viaTasks;

  /** @type {Array<JetProvisionalTaskUpdateRequest>} */
  const provTaskRequests = req.body.provisionalTasks;

  /** @type {Array<JetTaskUpdateMixin & JetBaseTaskRequest>} */
  const allTaskRequests = [
    ...viaTaskRequests,
    ...provTaskRequests
  ];

  const errors = {errors: {}};

  if(!viaTaskRequests.every((taskReq, ind) => models.inputs.task.validate.fromViaUpdate(taskReq,ind,errors))
    || !provTaskRequests.every((taskReq, ind) => models.inputs.task.validate.provisionalUpdate(taskReq,ind,errors))){
    return res.status(422).send(errors);
  }

  /** @type {string} */
  const userId = req.payload.id;
  const taskUserIds = {};

  viaTaskRequests.forEach(taskReq => taskUserIds[taskReq.userRef] = true);
  provTaskRequests.forEach(taskReq => taskUserIds[taskReq.userRef] = true);

  try{
    // PUT ROUTE: STEP #1: Fetch the referenced taskUsers --------------------------------------
    const userTasks = await models.TasksUsers.findAll({
        where: {id: {[Op.in]: Object.keys(taskUserIds)}},
        attributes: resAttr.TASK_USER_ATTRIBUTES
      });

    // CHECK #1: all taskUser ref were found
    if(!allTaskRequests.every((taskReq,ind) => models.inputs.task.validate.update(userId,userTasks,taskReq,errors,ind)))
      return res.status(404).send(errors);

    const viaTaskIds = {};
    const provTaskIds = {};

    viaTaskRequests.forEach(taskReq => viaTaskIds[taskReq.taskUser.task_id] = true);
    provTaskRequests.forEach(taskReq => provTaskIds[taskReq.taskUser.task_id] = true);
    // End of PUT ROUTE: STEP #1 --------------------------------------------------------------


    // PUT ROUTE: STEP #2: Fetches the referenced tasks ---------------------------------------
    // Also fetches the infos required by the change requests

    const [infos,userTrips] = await Promise.all([
      models.inputs.task.fetch.updateInfos(userId,allTaskRequests),
      models.TripsUsers.findAll({
        where: {user_id: userId},
        attributes: resAttr.TRIP_USER_ATTRIBUTES
      }),
      models.inputs.task.fetch
        .fromVias(Object.keys(viaTaskIds))
        .then(viaTasks => {
          viaTaskRequests.forEach(taskReq => {
            taskReq.task = viaTasks.find(viaTask => viaTask.id === taskReq.taskUser.task_id);
            taskReq.via = taskReq.task.via;
          });
        }),
      models.inputs.task.fetch
        .provisionals(Object.keys(provTaskIds))
        .then(provTasks => {
          provTaskRequests.forEach(taskReq => {
            taskReq.task = provTasks.find(provTask => provTask.id === taskReq.taskUser.task_id);
          });          
        })
    ]);

    const travMap = infos.travMap;
    infos.tripUserIdMap = generateMap(userTrips,'trip_id');

    if(!allTaskRequests.every((taskReq,ind) => {
      if(!taskReq.task){
        errors.errors[`taskReq${ind}`] = 'tasks: Referenced task could not be found';
        return false;
      }
      return true;
    }))
      return res.status(404).send(errors);
    // End of PUT ROUTE: STEP #2 --------------------------------------------------------------


    // PUT ROUTE: STEP #3: Fetches the via for the tasks linked to a via ----------------------
    // Also fetches the via of ALL non-helpees members
    // Also fetches the address solely linked to a task

    await models.inputs.task.fetch.existingInfos(infos,allTaskRequests,provTaskRequests,viaTaskRequests);

    if(!models.inputs.task.populate.provisionalRequests(provTaskRequests,infos,travMap,errors)
      | !models.inputs.task.populate.fromViaUpdateRequests(viaTaskRequests,infos,travMap,errors))
      return res.status(422).send(errors);

    provTaskRequests.forEach(taskReq => models.inputs.task.populate.changeType(taskReq));
    // End of PUT ROUTE: STEP #3 --------------------------------------------------------------


    // PUT ROUTE STEP #4: fetch all the users associated with the travelers in the task -------
    // requests.
    // Create custom address and fetch their neighborhoods to create taskUser, taskTraveler
    // and viaTaskTraveler instances.
    const viaTravelerIds = models.inputs.task.get.fromViaMemberIds(viaTaskRequests,true);
    const provTravelerIds = models.inputs.task.get.beneficiaryIds(provTaskRequests,true);
    const allTravelerIds = [
      ...viaTravelerIds,
      ...provTravelerIds.filter(travId => !viaTravelerIds.includes(travId))
    ];

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(allTravelerIds),
      models.inputs.task.fetch.provisionalHoods(provTaskRequests),
      models.inputs.task.fetch.boundHoods(viaTaskRequests)
    ]);

    if(!provTaskRequests.every((taskReq,tInd) => models.inputs.task.validate.provisionalHoods(taskReq,infos,errors,tInd))
      || !viaTaskRequests.every((taskReq,tInd) => models.inputs.task.validate.hoods(taskReq,infos,errors,tInd))){
      return res.status(422).send(errors);
    }



    // End of PUT ROUTE: STEP #4 --------------------------------------------------------------


    // PUT STEP #5: Save tasks instances ------------------------------------------------------
    /** @type {{[addressId: string]: boolean}} */
    const unlinkedAddresses = {};

    await Promise.all(
      allTaskRequests.map(taskReq => {
        return Promise.all([
          taskReq.depCityLocation && taskReq.depCityLocation.customAddress
            ? taskReq.depCityLocation.address.save()
            : Promise.resolve(null),
          taskReq.arrCityLocation && taskReq.arrCityLocation.customAddress
            ? taskReq.arrCityLocation.address.save()
            : Promise.resolve(null)
        ]).then(() => {
          if(taskReq.viaTask)
            models.inputs.task.build.updateFromVia(taskReq,unlinkedAddresses);
          else
            models.inputs.task.build.updateProvisional(taskReq,unlinkedAddresses);
          
          return taskReq.task.save();
        });
      })
    );

    const newTaskTravs = [];
    const delTaskTravIds = [];
    const newTaskViaTravs = [];
    const delTaskViaTravIds = [];
    const newTaskUsers = [];
    const delTaskUserIds = [];
    const newTaskAirports = [];
    /** @type {Array<JetTaskAirportInstance>} */
    const toUpdTaskAirports = [];
    const delTaskAirports = [];

    viaTaskRequests.forEach(taskRequest => {
      const updTaskUsers = models.TasksUsers.updateFromViaRequest(taskRequest,travUsersMap);
      const updTaskViaTravelers = models.TasksViasTravelers.updateFromViaRequest(taskRequest);

      newTaskUsers.push(...updTaskUsers.newTaskUsers);
      delTaskUserIds.push(...updTaskUsers.delTaskUserIds);
      newTaskViaTravs.push(...updTaskViaTravelers.newTaskViaTravelers);
      delTaskViaTravIds.push(...updTaskViaTravelers.delTaskViaTravelerIds);
    });

    provTaskRequests.forEach(taskRequest => {
      const updTaskTravs = models.TasksTravelers.updateProvisionalRequest(taskRequest);
      const updTaskUsers = models.TasksUsers.updateProvisionalRequest(taskRequest,travUsersMap);
      const updTaskAirports = models.TasksAirports.updateProvisionalRequest(taskRequest);
      
      newTaskTravs.push(...updTaskTravs.newTaskTravelers);
      delTaskTravIds.push(...updTaskTravs.delTaskTravelerIds);
      newTaskUsers.push(...updTaskUsers.newTaskUsers);
      delTaskUserIds.push(...updTaskUsers.delTaskUserIds);
      newTaskAirports.push(...updTaskAirports.newTaskAirports);
      toUpdTaskAirports.push(...updTaskAirports.updTaskAirports);   
      delTaskAirports.push(...updTaskAirports.delTaskAirports);   
    });
    // End of POST/CREATE STEP #5 ---------------------------------------------------------


    // PUT STEP #6: Update for each taskRequest: ------------------------------------------
    // for provisional requests only: task-traveler associations (beneficiaries)
    // for requests linked to a via: task-via-traveler associations
    // for both: task-user association based on these new task-traveler and 
    // task-via-traveler entries.
    // also destroy unlinked address instances not associated with any user/traveler
    await Promise.all([
      ...allTaskRequests.map(taskReq => taskReq.task.propagate(infos,errors,taskReq.changeType)),
      ...newTaskViaTravs.map(taskViaTrav => taskViaTrav.save()),
      ...newTaskTravs.map(taskTrav => taskTrav.save()),
      ...newTaskUsers.map(taskUser => taskUser.save()),
      ...newTaskAirports.map(taskAirport => taskAirport.save()),
      ...toUpdTaskAirports.map(taskAirport => taskAirport.save({fields: ['neighborhood_id']})),
      delTaskViaTravIds.length
        ? models.TasksViasTravelers.destroy({where: {id: {[Op.in]: delTaskViaTravIds}}})
        : Promise.resolve(),
      delTaskTravIds.length
        ? models.TasksTravelers.destroy({where: {id: {[Op.in]: delTaskTravIds}}})
        : Promise.resolve(),
      delTaskUserIds.length
        ? models.TasksUsers.destroy({where: {id: {[Op.in]: delTaskUserIds}}})
        : Promise.resolve(),
      ...delTaskAirports.map(taskAirport => taskAirport.destroy()),
      models.Address.handleUnlinks(unlinkedAddresses)
    ]);
    // End of POST/CREATE STEP #6 ---------------------------------------------------------


    // PUT STEP #7: Fetch resulting task instances ----------------------------------------
    const [viaTaskResponses,provTaskResponses] = await Promise.all([
      createFromViaTasksResponse(Object.keys(viaTaskIds),userId,infos,travMap),
      createProvisionalTasksResponse(Object.keys(provTaskIds),userId,infos,travMap)
    ]);

    // End of POST/ADD STEP #7 ------------------------------------------------------------
    return res.status(200).send({
      viaTasks: viaTaskResponses,
      provisionalTasks: provTaskResponses
    });
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Route delete: 
// Expecting request in the form DELETE api/tasks
// Expecting parameter taskRef='hexstring' & taskRef='hexstring' etc...
router.delete('/',auth.required, async (req, res, next) => {
  const taskUserIds = (req.query.taskRef
    ? Array.isArray(req.query.taskRef) ? req.query.taskRef : [req.query.taskRef]
    : [])
    .filter(taskUserId=> taskUserId.toString('hex') === taskUserId);

  /** @type {string} */
  const password = req.query ? req.query.password : null;

  if(!taskUserIds.length)
    return res.status(422).send({errors: {taskRef: 'Must provide at least one valid taskRef to delete'}});
  
  if(!password || typeof password !== 'string')
    return res.status(422).send({errors: {password: 'Must provide the user password as parameters'}});


  try{
    const [taskUsers,user] = await Promise.all([
      models.TasksUsers.findAll({
        where: {id: {[Op.in]: taskUserIds}},
        attributes: resAttr.TASK_USER_ATTRIBUTES
      }),
      models.User.findByPk(req.payload.id)
    ]);

    if(taskUsers.length < taskUserIds.length)
      return res.status(404).send({errors: {taskRefs: 'Not all referenced taskRef could be found, none was deleted'}});

    if(taskUsers.some(taskUser => taskUser.user_id !== req.payload.id))
      return res.status(403).send({errors: {taskRefs: 'The logged user is not authorized to delete at least one of the referenced tasks'}});

    if(await !user.validPassword(password))
      return res.status(403).send({errors: {password: 'is invalid'}});

    await models.Task.destroy({
      where: {id: {[Op.in]: taskUsers.map(taskUser => taskUser.task_id)}},
      individualHooks: true
    });

    return res.status(203).send({success:'tasks were deleted'});

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route get/review: 
// Expecting request in the form GET api/tasks/review
router.get('/review', auth.required, async (req, res, next) => {
  try{
    // GET/REVIEW ROUTE: STEP #1 ----------------------------------------------------------
    /** @type {string}*/
    const userId = req.payload.id;

    const response = {
      ownViaTaskCount: 0,
      ownProvisionalTaskCount: 0,
      otherViaTaskCount: 0,
      otherProvisionalTaskCount: 0,
      potentialTaskCount: 0,

      /** @type {Array<JetTaskResponse>} */
      ownViaTasks: [],
      /** @type {Array<JetProvisionalTaskResponse>} */
      ownProvisionalTasks: [],
      /** @type {Array<JetTaskResponse>} */
      otherViaTasks: [],
      /** @type {Array<JetProvisionalTaskResponse>} */
      otherProvisionalTasks: [],
      /** @type {Array<JetPotentialTaskResponse>} */
      potentialTasks: []
    };

    const [userTasks,travMap] = await Promise.all([
      models.TasksUsers.findAll({
        where: {user_id: userId},
        attributes: resAttr.TASK_USER_ATTRIBUTES
      }),
      models.UsersTravelers.createUserTravsMap(userId)
    ]);

    if(!Object.keys(travMap).length)
      return res.status(200).send(response);

    const allTravelerIds = Object.keys(travMap);
    // End of GET/REVIEW ROUTE: STEP #1 --------------------------------------------------- 


    // GET/REVIEW ROUTE: STEP #2 ----------------------------------------------------------
    const [tasksTravelers, tasksViasTravelers, potentialHelpees] = await Promise.all([
      models.TasksTravelers.findAll({
        where: {task_id: {[Op.in]: userTasks.map(userTask => userTask.task_id)}},
        attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
      }),
      models.TasksViasTravelers.findAll({
        where: {[Op.and]: [
          {task_id: {[Op.in]: userTasks.map(userTask => userTask.task_id)}},
          {[Op.or]: [
            {status: {[Op.in]: HELP_STATUS.publicReview}},
            {traveler_id: {[Op.in]: allTravelerIds}}
          ]}
        ]},
        attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
      }),
      models.ViasTravelers.findAll({
        where: {
          [Op.and]: [
            {traveler_id: {[Op.in]: allTravelerIds}},
            {volunteer: true} // testing: set to FALSE
          ]
        },
        attributes: resAttr.VIA_TRAVELER_ATTRIBUTES
      })
    ]);

    /** @type {{[viaId: string]: boolean}} */
    const potentialViaIds = {};
    potentialHelpees.forEach(pax => potentialViaIds[pax.via_id] = true);

    if(!userTasks.length && !potentialHelpees.length)
      return res.status(200).send(response);
    // End of GET/REVIEW ROUTE: STEP #2 --------------------------------------------------- 


    // GET/REVIEW ROUTE: STEP #3 ----------------------------------------------------------
    const ownProvAssembly = TaskAssembly.createAssembly('ownProvTask');
    const otherProvAssembly = TaskAssembly.createAssembly('otherProvTask');
    const ownAssembly = TaskAssembly.createAssembly('ownTask');
    const otherAssembly = TaskAssembly.createAssembly('otherTask');

    tasksTravelers
      .forEach(taskTrav => {
        if(travMap[taskTrav.traveler_id]) // <-- associated to a traveler who is a beneficiary: own task
          ownProvAssembly.addBeneficiaries(taskTrav);
        else // <-- some other user's task
          otherProvAssembly.addBeneficiaries(taskTrav);
      });

    tasksViasTravelers
      .filter(taskViaTrav => taskViaTrav.status === HELP_STATUS.helpee)
      .forEach(taskViaTrav => {
        if(travMap[taskViaTrav.traveler_id]){
          ownAssembly.addMembers(taskViaTrav);
          potentialViaIds[taskViaTrav.via_id] = false;
        } else
          otherAssembly.addMembers(taskViaTrav);
      });

    tasksViasTravelers
      .filter(taskViaTrav => taskViaTrav.status !== HELP_STATUS.helpee)
      .forEach(taskViaTrav => {

        const taskId = taskViaTrav.task_id;
        if(ownProvAssembly.has(taskId))
          ownProvAssembly.addMembers(taskViaTrav);
        
        else if(otherProvAssembly.has(taskId))
          otherProvAssembly.addMembers(taskViaTrav);

        else if(ownAssembly.has(taskId))
          ownAssembly.addMembers(taskViaTrav);

        else if(otherAssembly.has(taskId))
          otherAssembly.addMembers(taskViaTrav);
      });

    // FILTER taskViaTraveler for otherTasks that are NOT helper / backup and NOT associated to a known traveler
    otherProvAssembly.restrictMembers(travMap);

    await Promise.all([
      ownAssembly.queryTasks(),
      otherAssembly.queryTasks(),
      ownProvAssembly.queryTasks(),
      otherProvAssembly.queryTasks()
    ]);
    // End of GET/REVIEW ROUTE: STEP #3 --------------------------------------------------- 


    // GET/REVIEW ROUTE: STEP #4 ----------------------------------------------------------
    const [infos,userTrips] = await Promise.all([
      models.inputs.task.fetch.reviewInfos(
        [ownAssembly,otherAssembly,ownProvAssembly,otherProvAssembly],
        userId,
        travMap,
        potentialHelpees.filter(pax => potentialViaIds[pax.via_id])
      ),
      models.TripsUsers.findAll({
        where: {user_id: userId},
        attributes: resAttr.TRIP_USER_ATTRIBUTES
      }),
    ]);   

    infos.tripUserIdMap = generateMap(userTrips,'trip_id');
    
    const potentialTaskVias = Object.keys(infos.viaIdMap)
      .filter(viaId => potentialViaIds[viaId])
      .map(viaId => infos.viaIdMap[viaId]);

    // End of GET/REVIEW ROUTE: STEP #4 --------------------------------------------------- 


    // GET/REVIEW ROUTE: ------------------------------------------------------------------
    const userTasksMap = generateMap(userTasks, 'task_id');
    ownAssembly.assemble(infos,userTasksMap);
    otherAssembly.assemble(infos,userTasksMap);
    ownProvAssembly.assemble(infos,userTasksMap);
    otherProvAssembly.assemble(infos,userTasksMap);

    response.ownViaTasks = ownAssembly.createResponses(travMap,infos);
    response.otherViaTasks = otherAssembly.createResponses(travMap,infos);
    response.ownProvisionalTasks = ownProvAssembly.createResponses(travMap,infos);
    response.otherProvisionalTasks = otherProvAssembly.createResponses(travMap,infos);
    response.potentialTasks = potentialTaskVias.map(via => via.createPotentialTask(infos))

    response.ownViaTaskCount = response.ownViaTasks.length;
    response.otherViaTaskCount = response.otherViaTasks.length;
    response.ownProvisionalTaskCount = response.ownProvisionalTasks.length;
    response.otherProvisionalTaskCount = response.otherProvisionalTasks.length;
    response.potentialTaskCount = response.potentialTasks.length;

    return res.status(200).send(response);
    // End of GET/REVIEW ROUTE: STEP #5 ---------------------------------------------------

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Route get/fromtrip: 
// Expecting request in the form GET api/tasks/fromtrip
// Unlike other routes of tasks, does not rely on taskAssembly
// to construct the response.
router.get('/fromtrip', auth.required, async (req, res, next) => {
  try{
    // GET/FROMTRIP ROUTE: STEP #1 ----------------------------------------------------------
    const tripRef = req.query ? req.query.tripRef : null

    if(typeof tripRef !== 'string' || tripRef.toString('hex') !== tripRef)
      return res.status(422).send(
        {errors: {tripRef: 'request must have a \'tripRef\' param of type "hex" string'}}
      );

    /** @type {string}*/
    const userId = req.payload.id;

    const response = {
      /** @type {Array<JetTaskResponse>} */
      ownViaTasks: [],
      /** @type {Array<JetPotentialTaskResponse>} */
      potentialTasks: []
    };

    const [tripUser,travMap] = await Promise.all([
      models.TripsUsers.findByPk(tripRef,{
        attributes: resAttr.TRIP_USER_ATTRIBUTES,
        include: [{
          model: models.Trip,
          attributes: resAttr.TRIP_ATTRIBUTES,
          include: models.queries.FETCH_VIAS          
        }]
      }),
      models.UsersTravelers.createUserTravsMap(userId)
    ]);

    if(!tripUser)
      return res.status(404).send({errors: {tripRef: 'trip could not be found'}});

    if(tripUser.user_id !== userId)
      return res.status(403).send({errors: {tripRef: 'user is not allowed to retrieve this trip.'}});

    if(!tripUser.Trip || !tripUser.Trip.vias)
      return res.status(404).send({errors: {trip: 'trip could not be found'}});
    // End of GET/FROMTRIP ROUTE: STEP #1 --------------------------------------------------- 


    // GET/FROMTRIP ROUTE: STEP #2 ----------------------------------------------------------
    /** @type {{[travId: string]: JetUserTravelerInstance}} */
    const invTravMap = Object.keys(invertMap(travMap,'traveler_id'));
    const viaIds = tripUser.Trip.vias.map(via => via.id);

    const [userTasks, userAddressMap, travAddressMap] = await Promise.all([
      models.TasksUsers.findAll({
        attributes: resAttr.TASK_USER_ATTRIBUTES,
        where: {user_id: userId},
        include: Object.assign(
          {where: {via_id: {[Op.in]: viaIds}}},
          models.queries.FETCH_EXTENDED_DETAILS_FROMVIA_TASK
        )
      }),
      models.UsersAddresses.createFullAddressMap(userId),
      Object.keys(travMap).length
        ? models.TravelersAddresses.createFullAddressMap(invTravMap)
        : Promise.resolve({})
    ]);

    /** @type {JetInfos} */
    const infos = {
      userAddressMap,
      travAddressMap,
      travMap
    };
    infos.tripUserIdMap = generateMap([tripUser],'trip_id');
    infos.viaIdMap = generateMap(tripUser.Trip.vias,'id');

    // identify the vias for which there is no associated via
    const existingTaskViaIds = {};
    userTasks.forEach(ut => existingTaskViaIds[ut.Task.via_id] = true);

    const potentialTaskVias = tripUser.Trip.vias
      .filter(via => !existingTaskViaIds[via.id])
      .filter(via => !!via.Travelers
        .find(t => t.ViasTravelers.volunteer === true) // TODO: set this to false
      );

    // End of GET/FROMTRIP ROUTE: STEP #2 --------------------------------------------------- 


    // GET/FROMTRIP ROUTE: STEP #3 ----------------------------------------------------------
    if(!userTasks)
      return res.status(500).send({errors: {tasks: 'could not be retrieved'}});

    response.ownViaTasks = userTasks.map(userTask => 
      userTask.Task.createPrivateResponse(userTask.id,travMap,infos)
    );

    response.potentialTasks = potentialTaskVias.map(t => 
      t.createPotentialTask(infos)
    );

    return res.status(200).send(response);
    // End of GET/REVIEW ROUTE: STEP #3 --------------------------------------------------- 


  } catch(error){
    next(error);
  }
});


router.param('task_user_id', (req,res,next,taskUserId) => {
  if(typeof taskUserId !== 'string' || taskUserId.toString('hex') !== taskUserId)
    return res.status(422).send({errors: {taskRef: 'is invalid'}});

  return models.TasksUsers
    .findByPk(taskUserId, {attributes: resAttr.TASK_USER_ATTRIBUTES})
    .then(taskUser => {
      req.taskUser = taskUser;
      next();
    }).catch(next);
});


// ************************************************************************************************
// Route GET/taskRef
// Expecting request in the form GET/:task_user_id/review
// The logged user MUST be an admin: beneficiary or helpee
router.get('/:task_user_id/review', auth.required, async (req, res, next) => {
    /** @type {JetTaskUserInstance} */ const taskUser = req.taskUser;
    /** @type {string} */ const userId = req.payload.id;

    if(taskUser.user_id !== userId)
      return res.status(403).send({errors: 
        {task: 'logged user is not authorized to unlink this task'}
      });

      
    try{
      const [task,travMap] = await Promise.all([
        models.Task
          .findByPk(taskUser.task_id, models.queries.FETCH_TASK_FULL),
        models.UsersTravelers.createUserTravsMap(userId)
      ]);

      if(!task)
        return res.status(404).send({errors: 
          {task: 'could not be found'}
        });

      const taskType = task.TasksTravelers.length 
        ? TASK_QUERY_TYPE.beneficiary 
        : TASK_QUERY_TYPE.member;    
        
      if(taskType === TASK_QUERY_TYPE.beneficiary){
        const beneficiary = task.getBeneficiaryRef(travMap);

        if(!beneficiary)
          return res.status(403).send({errors: 
            {user: 'Logged user is not authorized to make decisions for this task'}
          });
  
      } else {
        const helpee = task.TasksViasTravelers.find(m => m.status === HELP_STATUS.helpee && !!travMap[m.traveler_id]);
        if(!helpee)
          return res.status(403).send({errors: 
            {user: 'Logged user is not authorized to make decisions for this task'}
          });
      }

      await task.populate(userId,travMap,false,req.taskUser);
      return res.status(200).send({task: task.createOwnerResponse(userId,travMap)});

    } catch(error){
      next(error);
    }
});



// ************************************************************************************************
// Route POST/UNLINK
// Expecting request in the form POST/:task_user_id/unlink
// Removes association between the via and task, creating a provisional task
router.post('/:task_user_id/unlink', auth.required, async (req, res, next) => {
  /** @type {JetTaskUserInstance} */ const taskUser = req.taskUser;
  /** @type {string} */ const userId = req.payload.id;

  if(taskUser.user_id !== userId)
    return res.status(403).send({errors: 
      {tasks: 'logged user is not authorized to unlink this task'}
    });

  try {
    const task = await models.Task.findById(taskUser.task_id, models.queries.FETCH_UPDATE_FROMVIA_TASK);
    if(!task)
      return res.status(404).send({tasks: 'task could not be found'});

    const travMap = await Promise.all([
      models.UsersTravelers.createUserTravsMap(userId),
      models.sequelize.transaction(async t => {
        return await models.handlers.task.unlink(task,t);
      })
    ]);

    await task.populate(userId,travMap);
    return res.status(200).send({task: task.createOwnerResponse(userId,travMap)});

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route POST/LINK: 
// Expecting request in the form POST api/tasks/:task_user_id/link
// Requires param tripref (trip_user_id) and optional param ordinal as number, default = 0
// Fetches the task and the via matching trip_id = tripref and ordinal
// Associates the task to the via, if compatible, changing it from a provisional- to a via- task
router.post('/:task_user_id/link', auth.required, async (req, res, next) => {
  /** @type {JetTaskUserInstance} */ const taskUser = req.taskUser;
  /** @type {string} */ const userId = req.payload.id;

  /** @type {string} */
  const tripRef = req.query.tripref;
  const ordinal = req.query.ordinal || 0;

  if(typeof tripRef !== 'string' || tripRef.toString('hex') !== tripRef)
    return res.status(422).send({errors: {tasks: 'link: tripref is not valid'}});
  
  if(typeof ordinal !== 'number' || ordinal < 0)
    return res.status(422).send({errors: {tasks: 'link: if provided, ordinal must be a number'}});

  if(taskUser.user_id !== userId)
    return res.status(403).send({errors: {tasks: 'logged user is not authorized to unlink this task'}});

  try {
    /** @type {JetInfos} */
    const infos = {};

    const [task,via] = await Promise.all([
      models.Task.findById(taskUser.task_id, models.queries.FETCH_UPDATE_PROVISIONAL_TASK),
      models.TripsUsers.findById(tripRef, resAttr.TRIP_USER_ATTRIBUTES)
        .then(tripUser => {
          if(!tripUser)
            return Promise.reject({tasks: 'unlink: tripref could not be found'});

          else if(tripUser.user_id !== userId)
            return Promise.reject({tasks: 'unlink: logger user not authorized to access this tripref'});

          infos.tripUserIdMap = generateMap(tripUser,'trip_id');
          const viaWhere = {};
          if(typeof ordinal === 'number')
            viaWhere[Op.and] = [
              {trip_id: tripUser.trip_id},
              {ordinal: ordinal}
            ];
          else
            viaWhere.trip_id = tripUser.trip_id;

          return models.Via
            .findOne(Object.assign({where: viaWhere}, models.queries.FETCH_TASK_VIA))
            .then(via => {
              if(via)
                infos.viaIdMap = {[via.id]: via};
              return via;
            });
        })
    ]);

    if(!task)
      return res.status(404).send({errors: {tasks: 'task could not be found'}});

    const travMap = await Promise.all([
      models.UsersTravelers.createUserTravsMap(userId),
      models.sequelize.transaction(async t => {
        return await models.handlers.task.link(task,via,[],t);
      })
    ]);

    await task.populate(userId,travMap);
    return res.status(200).send({task: task.createOwnerResponse(userId,travMap,infos)});

  } catch(error){
    next(error);
  }
});

module.exports = router;

