const moment = require('moment');

const commonFunc = require('../utils/commonFunctions');

const TASK_TYPE = require('../utils/commonFields').TASK_TYPE;
const TASK_STATUS = require('../utils/commonFields').TASK_STATUS;
const VIA_BOUND = require('../utils/commonFields').VIA_BOUND;
const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;
const CHANGE_TYPE = require('../utils/commonFields').CHANGE_TYPE;

const calcDateTime = commonFunc.calculateDateTime;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetTaskModel} */
  const taskModel = sequelize.define('Task',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4},
    },
    type: {
      type: SeqTypes.ENUM,
      defaultValue: TASK_TYPE.dft,
      values: TASK_TYPE.values,
      allowNull: false
    },
    status: {
      type: SeqTypes.ENUM,
      defaultValue: TASK_TYPE.dft,
      values: TASK_STATUS.values,
      allowNull: false
    },
    start_date: {type: SeqTypes.DATEONLY},
    start_time: {type: SeqTypes.TIME},
    end_date: {type: SeqTypes.DATEONLY},
    end_time: {type: SeqTypes.TIME},
    earliest_date: {type: SeqTypes.DATEONLY},
    latest_date: {type: SeqTypes.DATEONLY},
    earliest_time: {type: SeqTypes.TIME},
    latest_time: {type: SeqTypes.TIME}
  },{
    underscored: true
  });

  /** @param {JetModels} models */
  taskModel.associate = function(models){

    taskModel.belongsTo(models.Convo, {foreignKey: 'convo_id'});
    taskModel.belongsTo(models.Flight, {foreignKey: 'flight_id'});
    taskModel.belongsTo(models.Via, {foreignKey: 'via_id'});
    taskModel.belongsTo(models.User, {as: 'Creator', foreignKey: 'creator_id'});

    taskModel.belongsTo(models.Airport, {as: 'DepAirport', foreignKey: 'dep_airport_id'});
    taskModel.belongsTo(models.Airport, {as: 'ArrAirport', foreignKey: 'arr_airport_id'});
    taskModel.belongsTo(models.Neighborhood, {as: 'DepNeighborhood', foreignKey: 'dep_neighborhood_id'});
    taskModel.belongsTo(models.Neighborhood, {as: 'ArrNeighborhood', foreignKey: 'arr_neighborhood_id'});
    taskModel.belongsTo(models.Address, {as: 'DepAddress', foreignKey: 'dep_address_id'});
    taskModel.belongsTo(models.Address, {as: 'ArrAddress', foreignKey: 'arr_address_id'});

    taskModel.belongsToMany(models.Traveler, {through: models.TasksViasTravelers, foreignKey: 'task_id', as: 'Members'});
    taskModel.belongsToMany(models.Via, {through: models.TasksViasTravelers, foreignKey: 'task_id'});
    taskModel.belongsToMany(models.ViasTravelers, {through: models.TasksViasTravelers, foreignKey: 'task_id'});

    taskModel.belongsToMany(models.Traveler, {through: models.TasksTravelers, foreignKey: 'task_id', as: 'Beneficiaries'});
    taskModel.belongsToMany(models.Airport, {through: models.TasksAirports, foreignKey: 'task_id', as: 'ProvisionalAirports'});
    taskModel.belongsToMany(models.Flight, {through: models.TasksFlights, foreingKey: 'task_id', as: 'ProvisionalFlights'});

    taskModel.hasMany(models.TasksViasTravelers, {foreignKey: 'task_id'});
    taskModel.hasMany(models.TasksTravelers, {foreignKey: 'task_id'});
    taskModel.hasMany(models.TasksAirports, {foreignKey: 'task_id'});
    taskModel.hasMany(models.TasksFlights, {foreignKey: 'task_id'});
    taskModel.hasMany(models.TasksUsers, {foreignKey: 'task_id'});

    // HOOKS
    taskModel.afterDestroy('delAddressHook', (task) => {
      if(task.dep_address_id || task.arr_address_id){
        Promise.all([
          task.dep_address_id
            ? models.Address
              .shouldRemove(task.dep_address_id)
              .then(resp => resp ? models.Address.destroy({where: {id: task.dep_address_id}}) : Promise.resolve(null))
            : Promise.resolve(null),
          task.arr_address_id
            ? models.Address
              .shouldRemove(task.arr_address_id)
              .then(resp => resp ? models.Address.destroy({where: {id: task.arr_address_id}}) : Promise.resolve(null))
            : Promise.resolve(null)
        ]).catch(error => console.log(error));  
      }
    });


    // MODEL METHODS REQUIRING MODELS
    // This function requires models and is accessed thru instance methods that do not, but it is only used internally
    taskModel.createCityLocationResponse = function(address, infos, hood = null){
      if(!address && !hood)
        return {};

      const userAddressId = address
        ? address.UsersAddresses
          ? address.UsersAddresses.id
          : Object.keys(infos.userAddressMap)
            .find(key => infos.userAddressMap[key].UsersAddresses.address_id === address.id)
        : null;
      
      const travAddressId = address
        ? address.TravelersAddresses
          ? address.TravelersAddresses.id
          : Object.keys(infos.travAddressMap)
            .find(key => infos.travAddressMap[key].TravelersAddresses.address_id === address.id)
        : null;

      const userAddress = userAddressId 
        ? address.UsersAddresses || infos.userAddressMap[userAddressId].UsersAddresses 
        : null;
      const travAddress = travAddressId 
        ? address.TravelersAddresses || infos.travAddressMap[travAddressId].TravelersAddresses 
        : null;

      return models.Address.createCityLocationResponse(address,userAddress,travAddress,hood);
    };
    // <-- END of MODEL METHODS REQUIRING MODELS

    
    /** 
     * @param {string} userId
     * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
    taskModel.prototype.createTravMap = function(userId,travMap = {}){
      if(!userId)
        return Promise.resolve(travMap);

      /** @type {JetTaskInstance} */
      const task = this;
      
      const beneficiaries = task.Beneficiaries || [];
      const curMembers = (task.Members || [])
        .filter(member => HELP_STATUS.publicReview.includes(member.TasksViasTravelers.status));
  
      const out = {};
      beneficiaries.forEach(beneficiary => out[beneficiary.TasksTravelers.traveler_id] = true);
      curMembers.forEach(member => out[member.TasksViasTravelers.traveler_id] = true);
  
      return Object.keys(out).length
        ? models.UsersTravelers.createTravUserTravMap(userId,Object.keys(out),travMap)
        : Promise.resolve(travMap);
    };

    /** 
     * @param {string} userId
     * @param {{[travelerId: string]: JetUserTravelerInstance}} travMap
     * @param {JetTaskUserInstance} taskUser*/
    taskModel.prototype.populate = function(userId, travMap = {}, extended = false, taskUser = null){
      /** @type {JetTaskInstance} */
      const task = this;

      const prov = task.TasksAirports && task.TasksAirports.length;
      const taskId = task.id 
        ? task.id
        : task.TasksTravelers && task.TasksTravelers.length
          ? task.TasksTravelers[0].task_id
          : task.TasksViasTravelers[0].task_id;

      const hoodIds = {};
      const airportIds = {};
      const addressIds = {};
      const travelerIds = {};
      const flightIds = {};
      const viaIds = {};

      if(typeof task.dep_neighborhood_id === 'number')
        hoodIds[task.dep_neighborhood_id] = true;
      if(typeof task.arr_neighborhood_id === 'number')
        hoodIds[task.arr_neighborhood_id] = true;

      if(task.dep_airport_id)
        airportIds[task.dep_airport_id] = true;
      if(task.arr_airport_id)
        airportIds[task.arr_airport_id] = true;

      if(task.TasksAirports)
        task.TasksAirports.forEach(taskAirport => airportIds[taskAirport.airport_id] = true);
      
      if(task.dep_address_id)
        addressIds[task.dep_address_id] = true;
      if(task.arr_address_id)
        addressIds[task.arr_address_id] = true;

      if(task.TasksTravelers)
        task.TasksTravelers.forEach(beneficiary => travelerIds[beneficiary.traveler_id] = true);
      
      if(task.TasksViasTravelers){
        task.TasksViasTravelers
          .filter(member => HELP_STATUS.publicReview.includes(member.status))
          .forEach(member => {
            travelerIds[member.traveler_id] = true;
            if(extended)
              viaIds[member.via_id] = true;
          });

        if(extended){
          task.TasksViasTravelers
            .filter(member => HELP_STATUS.searchables.includes(member.status))
            .forEach(member => {
              travelerIds[member.traveler_id] = true;
              viaIds[member.via_id] = true;
            });          
        }
      }

      if(task.flight_id)
        flightIds[task.flight_id] = true;

      /** @type {JetFetchRequests} */const fetchRequests = {
        hoodIds: Object.keys(hoodIds),
        airportIds: Object.keys(airportIds),
        addressIds: Object.keys(addressIds),
        travelerIds: Object.keys(travelerIds),
        flightIds: Object.keys(flightIds)
      };

      // prototype.populate --> fetches missing data
      return Promise.all([
        models.handlers.fetch.fields(fetchRequests,{userId,travMap}),
        models.Terminal.createMapFromAirports(fetchRequests.airportIds),
        taskUser
            ? Promise.resolve({[taskUser.user_id]: taskUser})
            : models.TasksUsers.createTaskUsersMap(taskId),
        models.UsersAddresses.findUserAddresses(userId,Object.keys(addressIds)),
        models.TravelersAddresses.findTravelersAddresses(Object.keys(travMap),Object.keys(addressIds)),
        models.Via.createViaMap(Object.keys(viaIds))

      ]).then(([infos,terminalIdMap,taskUsersMap,userAddresses,travAddresses,viaIdMap]) => {
        if(prov){
          task.ProvisionalAirports = task.TasksAirports.map(taskAirport => taskAirport.toProvisionalAirport(infos.airportIdMap,infos.hoodIdMap));
          task.Beneficiaries = task.TasksTravelers.map(taskTrav => taskTrav.toBeneficiary(infos.travelerIdMap));
          task.ProvisionalFlights = task.TasksFlights.map(taskFlight => taskFlight.toFlight(infos.lightIdMap));
          
        } else {
          task.DepNeighborhood =typeof task.dep_neighborhood_id === 'number'
            ? infos.hoodIdMap[task.dep_neighborhood_id]
            : null;

          task.ArrNeighborhood = typeof task.arr_neighborhood_id === 'number'
            ? infos.hoodIdMap[task.arr_neighborhood_id]
            : null;

          task.DepAirport = task.dep_airport_id
            ? infos.airportIdMap[task.dep_airport_id]
            : null;

          task.ArrAirport = task.arr_airport_id
            ? infos.airportIdMap[task.arr_airport_id]
            : null;

          task.Flight = task.flight_id ? infos.flightIdMap[task.flight_id] : null;
        }

        task.DepAddress = task.dep_address_id
          ? infos.addressIdMap[task.dep_address_id]
          : null;

        task.ArrAddress = task.arr_address_id
          ? infos.addressIdMap[task.arr_address_id]
          : null;

        if(task.DepAddress){
          task.DepAddress.TravelersAddresses = travAddresses.find(travAddress => travAddress.address_id === task.dep_address_id);
          task.DepAddress.UsersAddresses = userAddresses.find(userAddresses => userAddresses.address_id === task.dep_address_id);
        }
        
        if(task.ArrAddress){
          task.ArrAddress.TravelersAddresses = travAddresses.find(travAddress => travAddress.address_id === task.arr_address_id);
          task.ArrAddress.UsersAddresses = userAddresses.find(userAddresses => userAddresses.address_id === task.arr_address_id);
        }

        task.Members = task.TasksViasTravelers
          .filter(member => HELP_STATUS.publicReview.includes(member.status))
          .map(taskViaTrav => taskViaTrav.toMember(infos.travelerIdMap));

        if(extended)
          task.NonTaskers = task.TasksViasTravelers
            .filter(member => HELP_STATUS.searchables.includes(member.status))
            .map(taskViaTrav => taskViaTrav.toNonTasker(infos.travelerIdMap,viaIdMap));
        
        task.taskUsersMap = taskUsersMap;
        infos.viaIdMap = viaIdMap;
        infos.terminalIdMap = terminalIdMap;
        infos.userAddressMap = {};
        infos.travAddressMap = {};

        return infos;
        
      });
    }; // <--- end of prototype.populate


    /** 
     * @param {JetInfos} infos 
     * @param {JetErrors} errors
     * @param {JetChangeType} changeType */
    taskModel.prototype.propagate =  function(infos, errors = {errors: {}}, changeType = 'breaking'){
      /** @type {JetTaskInstance}*/ const task = this;

      if(changeType === 'minimal')
        return Promise.resolve(task);
      else if(!CHANGE_TYPE.values.includes(changeType))
        throw Error('task: task.propagate changeType argument is not valid');

      try{
        // for each prov task request, get the members (except )        
        const taskers = changeType === 'breaking' || changeType === 'restrictive' ? task.getTaskers() : [];
        const nonTaskers = changeType === 'breaking' || changeType === 'restrictive' ? task.getNonTaskers() : [];
        const incompatibles = changeType === 'breaking' || changeType === 'expanding' ? task.getIncompatibles() : [];

        taskers.forEach(m => m.populateVia(infos));
        nonTaskers.forEach(m => m.populateVia(infos));
        incompatibles.forEach(m => m.populateVia(infos));

        const updatedMembers = [
          ...taskers
            .filter((m,ind) => !m.via.isCompatible(task,errors,ind))
            .map(m => ({member: m, status: HELP_STATUS.incompatible, rank: 0})),
          ...nonTaskers
            .filter((m,ind) => !m.via.isCompatible(task,errors,ind))
            .map(m => ({member: m, status: HELP_STATUS.incompatible, rank: 0})),
          ...incompatibles
            .filter((m,ind) => m.via.isCompatible(task,errors,ind))
            .map(m => ({member: m, status: HELP_STATUS.contacted, rank: 0}))
        ];
  
        return updatedMembers.length
          ? models.sequelize.transaction(t => models.handlers.task.updateTaskers(task,updatedMembers,t))
          : Promise.resolve(task);
  
      } catch(error){
        return Promise.reject(error);
      }
    };


    /** 
     * @param {JetTaskViaTravelerInstance} tasker
     * @param {JetHelpStatus} status
     * @param {number} rank*/
    taskModel.prototype.admit = async function (tasker, status, rank = 0){
      /**@type {JetTaskInstance} */
      const task = this;

      /** @type {JetErrors} */
      const errors = {errors: {}};

      if(!tasker.via)
        return Promise.reject({task: 'admit: tasker.via must be populated'});

      if(!HELP_STATUS.eligibles.includes(tasker.status))
        return Promise.reject({task: `Member's status: ${tasker.status} is not eligible to be admitted`});

      try{
        if(!tasker.via.isCompatible(task,errors)){
          await models.sequelize.transaction(async t => {
            const updTask = await models.handlers.task.updateTaskers(task,[{member: tasker, status, rank}],t);
            return updTask;
          }); 
          return Promise.reject({task: 'admit: tasker is no longer compatible'});
        }
        
        if(!status || !HELP_STATUS.taskers.includes(status))
          return Promise.reject({task: 'Required status is not valid'});        

        if(rank === null){
          rank = status === HELP_STATUS.backup
            ? task.getNextBackupRank()
            : 0;
        }

        return models.sequelize.transaction(async t => {
          const updTask = await models.handlers.task.updateTaskers(task,[{member: tasker, status, rank}],t);

          // in the case where populate is NOT called after admit, adds the tasker as a Member
          if(updTask.Members && tasker.Traveler && !updTask.Members.find(m => m.TasksViasTravelers.id === tasker.id)){
            tasker.Traveler.TasksViasTravelers = tasker;
            updTask.Members.push(tasker.Traveler);
          }
          return updTask;
        });
      } catch(error){
        return Promise.reject(error);
      }
    };

    /** 
     * @param {JetTaskViaTravelerInstance} tasker
     * @param {JetHelpStatus} status*/
    taskModel.prototype.expel = async function (tasker, status = HELP_STATUS.applied){
      /**@type {JetTaskInstance} */
      const task = this;

      /** @type {JetErrors} */
      const errors = {errors: {}}; 
      
      if(!HELP_STATUS.taskers.includes(tasker.status))
        return Promise.reject({task: 'The member is not currently a tasker, hence it cannot be expelled'});

      if(!tasker.via)
        return Promise.reject({task: 'expel: tasker.via must be populated'});

      if(tasker.via.isCompatible(task,errors)){
        if(!HELP_STATUS.searchables.includes(status))
          return Promise.reject({task: 'The request status after expelling the tasker is not valid'});
      } else {
        status = HELP_STATUS.incompatible;
      }

      try{
        return models.sequelize.transaction(async t => {
          const updTask = await models.handlers.task.updateTaskers(task,[{member: tasker, status, rank: 0}], t);

          // where task.Member is already populated, updates the Member status
          if(updTask.Members){
            const curMember = updTask.Members.find(m => m.TasksViasTravelers.id === tasker.id);
            curMember.status = tasker.status;
            curMember.rank = tasker.rank;
          }
          return updTask;
        });
      } catch(error) {
        return Promise.reject(error);
      }
    };

    /** 
     * @param {JetTaskViaTravelerInstance} tasker
     * @param {JetHelpStatus} status
     * @param {number} rank*/
    taskModel.prototype.promote = async function (tasker, status = HELP_STATUS.helper, rank = 0){
      /**@type {JetTaskInstance} */
      const task = this;

      /** @type {JetErrors} */
      const errors = {errors: {}}; 

      if(tasker.status !== HELP_STATUS.backup)
        return Promise.reject({task: 'The member is not currently a backup, hence it cannot be promoted'});

      if(!tasker.via)
        return Promise.reject({task: 'promote: tasker.via must be populated'});

      try{
        if(tasker.via.isCompatible(task,errors)){
          if(!HELP_STATUS.taskers.includes(status))
            return Promise.reject({task: 'The resulting status of a promoted backup must be "helper" or "backup"'});
        } else {
          status = HELP_STATUS.incompatible;
          await models.sequelize.transaction(async t => {
            return models.handlers.task.updateTaskers(task,[{member: tasker, status, rank: 0}], t);
          });

          return Promise.reject({task: 'The backup to be promoted was no longer compatible with the task and was therefore excluded'});
        }

        return models.sequelize.transaction(async t => {
          const updTask = await models.handlers.task.updateTaskers(task,[{member: tasker, status, rank}], t);

          // update task.Members if this field is populated
          if(task.Members){
            task.Members.forEach(m => {
              const taskViaTrav = task.TasksViasTravelers.find(tvt => tvt.id === m.TasksViasTravelers.id);
              if(taskViaTrav){
                m.TasksViasTravelers.status = taskViaTrav.status;
                m.TasksViasTravelers.rank = taskViaTrav.rank;
              }
            });
          }
          return updTask;
        });
      } catch(error){
        return Promise.reject(error);
      }
    };


    /** @param {Array<JetMemberRequest>} requests */
    taskModel.prototype.applyMemberRequests = async function(requests){
      /**@type {JetTaskInstance} */
      const task = this;

      try{
        return models.sequelize.transaction(async t => {
          const updTask = await models.handlers.task.updateTaskers(task,requests, t);

          if(task.Members){
            task.Members.forEach(m => {
              const taskViaTrav = task.TasksViasTravelers.find(tvt => tvt.id === m.TasksViasTravelers.id);
              if(taskViaTrav){
                m.TasksViasTravelers.status = taskViaTrav.status;
                m.TasksViasTravelers.rank = taskViaTrav.rank;
              }
            });
          }

          return updTask;
        });      

      } catch(error) {
        return Promise.reject(error);
      }

    };
    // <-- END of INSTANCE METHODS REQUIRING MODELS 
  };

  // MODEL METHODS


  // INSTANCE METHODS
  /** @param {JetTaskInstance} oTask*/
  taskModel.prototype.dateTimeCompare = function(oTask){
    /** @type {JetTaskInstance} */
    const task = this;

    const dateTime = calcDateTime(task.start_date,task.start_time);
    const oDateTime = calcDateTime(oTask.start_date,oTask.start_time);
    
    return dateTime.isValid() && oDateTime.isValid()
      ? dateTime.diff(oDateTime,'s')
      : dateTime.isValid()
        ? -1
        : oDateTime.isValid()
          ? 1 
          : 0; 
  };


  /** @param {JetTaskInstance} oTask */
  taskModel.prototype.earliestDateTimeCompare = function(oTask){
    /** @type {JetTaskInstance} */
    const task = this;

    const dateTime = calcDateTime(task.earliest_date,task.earliest_time);
    const oDateTime = calcDateTime(oTask.earliest_date,oTask.earliest_time);
    
    return dateTime.isValid() && oDateTime.isValid()
      ? dateTime.diff(oDateTime,'s')
      : dateTime.isValid()
        ? -1
        : oDateTime.isValid()
          ? 1 
          : 0;    
  };


  // UPDATERS --------------------------------------------------------------------------------------
  /** @param {JetInfos} infos */
  taskModel.prototype.updateMembers = function(infos){
    /** @type {JetTaskInstance} */
    const task = this;

    if(!task.Members)
      task.Members = [];
    
    if(task.TasksViasTravelers){
      task.Members = task.Members
        .filter(m => !!task.TasksViasTravelers.find(tvt => m.TasksViasTravelers.id === tvt.id && HELP_STATUS.publicReview.includes(tvt.status)));

      task.TasksViasTravelers
        .filter(tvt => HELP_STATUS.publicReview.includes(tvt.status))
        .forEach(tvt => {
          const member = task.Members.find(m => m.TasksViasTravelers.id === tvt.id);
          if(member){
            member.TasksViasTravelers.status = tvt.status;
            member.TasksViasTravelers.rank = tvt.rank;
          } else {
            const traveler = infos.travelerIdMap[tvt.traveler_id];

            if(traveler){
              const member = Object.assign({TasksViasTravelers: tvt},traveler);
              Object.setPrototypeOf(member,traveler);
              task.Members.push(member);
            }
          }
        });
    }
  };

  /** @param {JetTaskRequestExtracts} infos */
  taskModel.prototype.updateNonTaskers = function(infos){
    /** @type {JetTaskInstance} */
    const task = this;

    if(!task.NonTaskers)
      task.NonTaskers = [];

    if(task.TasksViasTravelers){
      task.NonTaskers = task.NonTaskers
        .filter(m => !!task.TasksViasTravelers.find(tvt => m.id === tvt.id && !HELP_STATUS.publicReview.includes(tvt.status)));
        
      task.TasksViasTravelers
        .filter(tvt => !HELP_STATUS.publicReview.includes(tvt.status))
        .forEach(tvt => {
          const nonTasker = task.NonTaskers.find(m => m.id === m.id);
          if(nonTasker){
            nonTasker.status = tvt.status;
            nonTasker.rank = tvt.rank;
          } else {
            const traveler = infos.travelerIdMap[tvt.traveler_id];
            const via = infos.viaIdMap[tvt.via_id];
            if(traveler && via){
              tvt.Traveler = Object.assign({},traveler);
              Object.setPrototypeOf(tvt.Traveler,traveler);

              tvt.via = Object.assign({},via);
              Object.setPrototypeOf(tvt.via,via);
  
              task.NonTaskers.push(tvt);
            }
          }
        });
    }
  };



  // GETTERS ------------------------------------------------------------------------------------
  taskModel.prototype.isProvisional = function(){
    /** @type {JetTaskInstance} */ const task = this; 
    return !task.via_id && !task.Via;
  };

  taskModel.prototype.getId = function(){
    /** @type {JetTaskInstance} */ const task = this;  
    
    if(task.id)
      return task.id;

    else if(task.TasksViasTravelers && task.TasksViasTravelers.length)
      return task.TasksViasTravelers[0].task_id;

    else if(task.TasksTravelers && task.TasksTravelers.length)
      return task.TasksTravelers[0].task_id;

    else if(task.Members && task.Members.length)
      return task.Members[0].TasksViasTravelers.task_id;

    else if(task.Beneficiaries && task.Beneficiaries.length)
      return task.Beneficiaries[0].TasksTravelers.task_id;
    
    return null;  
  };

  taskModel.prototype.getViaRef = function(){
    /** @type {JetTaskInstance} */
    const task = this;

    const taskViaTravs = task.TasksViasTravelers
      ? task.TasksViasTravelers
      : task.Members
        ? task.Members.map(m => m.TasksViasTravelers)
        : [];

    const helpees = taskViaTravs.filter(m => m.status === HELP_STATUS.helpee);
    helpees.sort((m1,m2) => m1.statusCompare(m2));

    return helpees.length ? helpees[0].id : null;
  };

  /** @param {{[travId: string]: JetUserTravelerInstance}} travMap */
  taskModel.prototype.getBeneficiaryRef = function(travMap = null){
    /** @type {JetTaskInstance} */
    const task = this;

    const eligibleBeneficiaries = task.TasksTravelers
      ? task.TasksTravelers.filter(b => travMap ? !!travMap[b.traveler_id] : true)
      : task.Beneficiaries
        ? task.Beneficiaries.map(b => b.TasksTravelers).filter(b => travMap ? !!travMap[b.traveler_id] : true)
        : [];

    if(!eligibleBeneficiaries.length)
      return null;
    
    return eligibleBeneficiaries.sort((b1,b2) => b1.createdAtCompare(b2))[0];
  };


  taskModel.prototype.getBeneficiaryTravelerIds = function(){
    /** @type {JetTaskInstance} */
    const task = this;

    const taskTravelers = task.TasksTravelers;
    const out = {};

    if(taskTravelers)
      taskTravelers.forEach(taskTrav => out[taskTrav.traveler_id] = true);
    else {
      const taskViaTravelers = task.TasksViasTravelers;
      if(taskViaTravelers)
        taskViaTravelers
          .filter(taskViaTrav => taskViaTrav.status === HELP_STATUS.helpee)
          .forEach(taskViaTrav => out[taskViaTrav.traveler_id] = true);
    }

    return Object.keys(out);
  };

  taskModel.prototype.getAdminTravelerIds = function() {
    /** @type {JetTaskInstance} */
    const task = this;
    const out = {};

    if(task.TasksTravelers && task.TasksTravelers.length > 0){
      task.TasksTravelers.forEach(travTask => out[travTask.traveler_id] = true);
    
    } else if(task.Beneficiaries && task.Beneficiaries.length > 0){
      task.Beneficiaries.forEach(b => out[b.TasksTravelers.traveler_id] = true);
    
    } else if(task.TasksViasTravelers && task.TasksViasTravelers.length > 0){
      task.TasksViasTravelers
        .filter(taskViaTrav => taskViaTrav.status === HELP_STATUS.helpee)
        .forEach(taskViaTrav => out[taskViaTrav.traveler_id] = true);      

    } else if(task.Members){
      task.Members
        .filter(m => m.TasksViasTravelers.status === HELP_STATUS.helpee)
        .forEach(m => out[m.TasksViasTravelers.traveler_id] = true);        
    }

    return Object.keys(out);    
  }


  /** @param {Array<string>} addlTravIds */
  taskModel.prototype.getTravelerIds = function(...addlTravIds){
    /** @type {JetTaskInstance} */
    const task = this;
    const out = {};

    if(Array.isArray(addlTravIds))
      addlTravIds.forEach(travId => out[travId] = true);
    
    if(task.TasksTravelers)
      task.TasksTravelers.forEach(beneficiary => out[beneficiary.traveler_id] = true);
    
    if(task.TasksViasTravelers)
      task.TasksViasTravelers.forEach(member => out[member.traveler_id] = true);

    return Object.keys(out);
  };

  taskModel.prototype.getHelpeeIds = function(){
    /** @type {JetTaskInstance} */
    const task = this;  
    
    const memberLinks = task.TasksViasTravelers;

    return memberLinks
      ? memberLinks
        .filter(memberLink => memberLink.status === HELP_STATUS.helpee)
        .map(memberLink => memberLink.id)
      : [];
  };

  taskModel.prototype.getNextBackupRank = function(){
    /** @type {JetTaskInstance} */
    const task = this;  
    
    if(task.TasksViasTravelers){
      return task.TasksViasTravelers
        .filter(member => member.status === HELP_STATUS.backup)
        .reduce((maxRank,member) => Math.max(maxRank,member.rank + 1),0);
    } else if(task.Members){
      return task.Members
        .filter(member => member.TasksViasTravelers.status === HELP_STATUS.backup)
        .reduce((maxRank,member) => Math.max(maxRank,member.rank + 1),0);
    } else
      throw new Error('Task: .TasksViasTravelers or .Members must be populated when calling getNextBackupRank()');
  };

  taskModel.prototype.getHelper = function(){
    /** @type {JetTaskInstance} */
    const task = this;

    if(task.TasksViasTravelers){
      return task.TasksViasTravelers
        .find(member => member.status === HELP_STATUS.helper);
    } else if(task.Members){
      return task.Members
        .filter(member => member.TasksViasTravelers.status === HELP_STATUS.helper);
    } else
      throw new Error('Task: .TasksViasTravelers or .Members must be populated when calling getHelper()');
  };

  taskModel.prototype.getTaskers = function(){
    /** @type {JetTaskInstance} */
    const task = this;
    
    if(task.TasksViasTravelers){
      return task.TasksViasTravelers
        .filter(member => HELP_STATUS.taskers.includes(member.status));
    } else if(task.Members){
      return task.Members
        .filter(member => HELP_STATUS.taskers.includes(member.TasksViasTravelersstatus));
    } else
      throw new Error('Task: .TasksViasTravelers or .Members must be populated when calling getTaskers()');
  };

  taskModel.prototype.getNonTaskers = function(){
    /** @type {JetTaskInstance} */
    const task = this;
    
    if(task.TasksViasTravelers){
      return task.TasksViasTravelers
        .filter(member => !HELP_STATUS.publicReview.includes(member.status) && member.status !== HELP_STATUS.incompatible);
    } else if(task.Members){
      return task.Members
        .filter(member => !HELP_STATUS.publicReview.includes(member.status) && member.status !== HELP_STATUS.incompatible);
    } else
      throw new Error('Task: .TasksViasTravelers or .Members must be populated when calling getNonTaskers()');    
  };

  taskModel.prototype.getIncompatibles = function(){
    /** @type {JetTaskInstance} */
    const task = this;
    
    if(task.TasksViasTravelers){
      return task.TasksViasTravelers
        .filter(member => member.status === HELP_STATUS.incompatible);
    } else if(task.Members){
      return task.Members
        .filter(member => member.status === HELP_STATUS.incompatible);
    } else
      throw new Error('Task: .TasksViasTravelers or .Members must be populated when calling getIncompatibles()');    
  };

  /** @param {boolean} dep*/
  taskModel.prototype.getAirportIds = function(dep){
    /** @type {JetTaskInstance} */
    const task = this;

    if(task.ProvisionalAirports && task.ProvisionalAirports.length)
      return task.ProvisionalAirports
        .filter(provAirpt => provAirpt.TasksAirports.bound === dep ? VIA_BOUND.departure : VIA_BOUND.arrival)
        .map(provAirpt => provAirpt.TasksAirports.airport_id);
    else
      return dep ? task.dep_airport_id : task.arr_airport_id;
  };

  // RESPONSES ----------------------------------------------------------------------------------
  /** 
   * @param {string} userRef
   * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
  taskModel.prototype.createProvisionalResponse = function(userRef, travMap, addProvisionals = true, private=false){
    /** @type {JetTaskInstance} */
    const task = this;

    // Ensures consistency in the return
    task.Beneficiaries.sort((b1,b2) => {
      return b1.TasksTravelers.createdAtCompare(b2.TasksTravelers);
    });

    task.Members.sort((m1,m2) => 
      m1.TasksViasTravelers.statusCompare(m2.TasksViasTravelers)
    );

    /** @type {JetProvisionalTaskResponse} */
    const resp = {
      userRef,
      travRef: task.Beneficiaries.length ? task.Beneficiaries[0].TasksTravelers.id : null,

      type: task.type,
      status: task.status,
      earliestDate: moment(task.earliest_date).format('YYYY-MM-DD'),
      latestDate: moment(task.latest_date).format('YYYY-MM-DD'),
      earliestTime: moment(task.earliest_time,'HH:mm').format('HH:mm'),
      latestTime: moment(task.latest_time,'HH:mm').format('HH:mm'),

      beneficiaries: task.Beneficiaries.map(beneficiary => beneficiary.createBeneficiaryResponse(travMap)),
      members: task.Members
        .filter(member => private 
          || member.TasksViasTravelers.traveler_id in travMap
          || HELP_STATUS.publicReview.includes(member.TasksViasTravelers.status)
        )
        .map(member => member.createTaskMemberResponse(travMap))
    };

    if(addProvisionals){
      
      resp.depAirports = task.ProvisionalAirports
        .filter(airport => airport.TasksAirports.bound === VIA_BOUND.departure)
        .map(airport => airport.createProvisionalResponse());
    
      resp.arrAirports = task.ProvisionalAirports
        .filter(airport => airport.TasksAirports.bound === VIA_BOUND.arrival)
        .map(airport => airport.createProvisionalResponse());
    
      resp.flights = []; // TODO
    }

    return resp;
  };



  /** 
  * @param {string} userRef
  * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
  taskModel.prototype.createResponse = function(userRef,travMap,private=false){
    /** @type {JetTaskInstance} */
    const task = this;

    task.Members.sort((m1,m2) => m1.TasksViasTravelers.statusCompare(m2.TasksViasTravelers));

    /** @type {JetTaskResponse} */
    const resp = {
      userRef, 
      viaRef: task.getViaRef(),
      type: task.type,
      status: task.status,

      dep: {
        airportCode: task.DepAirport.id,
        airportName: task.DepAirport.name,
        boundNeighborhood: task.DepNeighborhood ? task.DepNeighborhood.name : null,
        boundAgglo: task.DepNeighborhood && task.DepNeighborhood.Agglo ? task.DepNeighborhood.Agglo.name : null,
        date: moment(task.start_date).format('YYYY-MM-DD'),
        time: moment(task.start_time,'HH:mm').format('HH:mm')
      },

      arr: {
        airportCode: task.ArrAirport.id,
        airportName: task.ArrAirport.name,
        boundNeighborhood: task.ArrNeighborhood ? task.ArrNeighborhood.name : null,
        boundAgglo: task.ArrNeighborhood && task.ArrNeighborhood.Agglo ? task.ArrNeighborhood.Agglo.name : null,
        date: moment(task.end_date).format('YYYY-MM-DD'),
        time: moment(task.end_time,'HH:mm').format('HH:mm')
      },

      flight: {}, // TODO

      members: task.Members
        .filter(member => private 
          || member.TasksViasTravelers.traveler_id in travMap
          || HELP_STATUS.publicReview.includes(member.TasksViasTravelers.status)
        )
        .map(member => member.createTaskMemberResponse(travMap,private))
    };

    return resp;
  };

  /** 
  * @param {string} userRef
  * @param {{[travId: string]: JetUserTravelerInstance}} travMap
  * @param {JetInfos} infos*/
  taskModel.prototype.createPrivateProvisionalResponse = function(userRef,travMap,infos){
    /** @type {JetTaskInstance} */
    const task = this;

    /** @type {JetPrivateProvisionalTaskReponse} */
    const resp = task.createProvisionalResponse(userRef,travMap,true,true);

    resp.depLocation = taskModel.createCityLocationResponse(task.DepAddress,infos,task.DepNeighborhood);
    resp.arrLocation = taskModel.createCityLocationResponse(task.ArrAddress,infos,task.ArrNeighborhood);

    return resp;
  };

  /** 
   * @param {string} userRef
  * @param {{[travId: string]: JetUserTravelerInstance}} travMap
  * @param {JetInfos} infos*/
  taskModel.prototype.createPrivateResponse = function(userRef, travMap, infos){
    /** @type {JetTaskInstance} */
    const task = this;

    /** @type {JetPrivateTaskResponse} */
    const resp = task.createResponse(userRef,travMap,true);

    // below is very messy: patch to provide tripRef and viaOrdinal
    if(task.via_id && infos && infos.viaIdMap && infos.tripUserIdMap){
      const via = infos.viaIdMap[task.via_id];
      if(via && via.trip_id){
        const tripUser = infos.tripUserIdMap[via.trip_id];
        resp.tripRef = tripUser ? tripUser.id : null;
        resp.viaOrdinal = via.ordinal;
      }
    }

    resp.depLocation = taskModel.createCityLocationResponse(task.DepAddress,infos,task.DepNeighborhood);
    resp.arrLocation = taskModel.createCityLocationResponse(task.ArrAddress,infos,task.ArrNeighborhood);
    return resp;
  };

  /** 
   * @param {{[airportId: string]: JetAirportInstance}} airportMap 
   * @param {{[taskId: string]: JetTaskViaTravelerInstance}} membershipsMap
   * @param {{[taskId: string]: JetTaskUserInstance}} userTasksMap
   * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
  taskModel.prototype.createFindResponse = function(airportMap, membershipsMap = {}, userTasksMap = {}, travMap = {}, ){
    /** @type {JetTaskInstance} */
    const task = this;

    const taskUser = userTasksMap[task.id];

    // Maps Dep and Arr airports to those of the filtering via
    task.DepAirport = airportMap[task.dep_airport_id];
    task.ArrAirport = airportMap[task.arr_airport_id];

    /** @type {JetViaTaskFindResponse} */
    const resp = task.createResponse(taskUser ? taskUser.id : null,travMap);
    
    const ownMembership = membershipsMap[task.id];
    if(ownMembership){
      resp.querierRef = ownMembership.id;
      resp.querierStatus = ownMembership.status;
    } else {
      resp.querierRef = null;
      resp.querierStatus = null;
    }

    return resp;
  };

  /** 
   * @param {{[airportId: string]: JetAirportInstance}} airportMap 
   * @param {{[taskId: string]: JetTaskViaTravelerInstance}} membershipsMap
   * @param {{[taskId: string]: JetTaskUserInstance}} userTasksMap
   * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
  taskModel.prototype.createProvisionalFindResponse = function(airportMap, membershipsMap = {}, userTasksMap = {}, travMap = {}){
    /** @type {JetTaskInstance} */
    const task = this;

    const taskUser = userTasksMap[task.id];

    // Inserts Dep and Arr airports of the filtering via
    task.ProvisionalAirports = task.TasksAirports
      .filter(taskAirport => airportMap[taskAirport.airport_id])
      .map(taskAirport => {
        const airport = airportMap[taskAirport.airport_id];
        airport.TasksAirports = taskAirport;
        return airport;
      });

    /** @type {JetProvisionalTaskFindResponse} */
    const resp = task.createProvisionalResponse(taskUser ? taskUser.id : null, travMap, false);
    
    resp.dep = task.ProvisionalAirports
      .find(airpt => airpt.TasksAirports.bound === VIA_BOUND.departure)
      .createProvisionalResponse();
      
    resp.arr = task.ProvisionalAirports
      .find(airpt => airpt.TasksAirports.bound === VIA_BOUND.arrival)
      .createProvisionalResponse();

    resp.flight = {}; // TODO

    const ownMembership = membershipsMap[task.id];
    if(ownMembership){
      resp.querierRef = ownMembership.id;
      resp.querierStatus = ownMembership.status;
    } else {
      resp.querierRef = null;
      resp.querierStatus = null;
    }

    return resp;
  };

  /** 
   * @param {JetTaskUserInstance} taskUser
   * @param {{[travId: string]: JetUserTravelerInstance}} travMap
   * @param {JetTaskViaTravelerInstance} curMember
   * @param {JetInfos} infos*/
  taskModel.prototype.createHelperResponse = function(
    taskUser = null, 
    travMap = {}, 
    curMember = null, 
    infos = {userAddressMap: {}, travAddressMap: {}}
  ) {

    /** @type {JetTaskInstance} */
    const task = this;

    /** @type {(JetTaskResponse | JetProvisionalTaskResponse) & JetQuerierTaskMixin} */
    let resp;
    
    if(task.isProvisional()){
      if(!task.ProvisionalAirports){ // taskers routes will have it populated, passengers routes won't
        task.ProvisionalAirports = task.TasksAirports.map(taskAirport => {
          const airport = taskAirport.Airport;
          delete taskAirport.Airport;
          airport.TasksAirports = taskAirport;
          return airport;
        });
      }

      resp = curMember && HELP_STATUS.revealAddress.includes(curMember.status)
        ? task.createPrivateProvisionalResponse(taskUser ? taskUser.id : null, travMap,infos)
        : task.createProvisionalResponse(taskUser ? taskUser.id : null, travMap);
       
    } else {
      resp = curMember && HELP_STATUS.revealAddress.includes(curMember.status)
        ? task.createPrivateResponse(taskUser ? taskUser.id : null, travMap, infos)
        : task.createResponse(taskUser ? taskUser.id : null, travMap);
    }
 
    // makes sure the querying member is part of the response [messy: consider deleting this]
    // if(resp.members && curMember 
    //   && !resp.members.find(m => m.taskRef === curMember.id)){

    //     const traveler = Object.assign({},curMember.Traveler);
    //     Object.setPrototypeOf(traveler,curMember.Traveler);
    //     traveler.TasksViasTravelers = curMember;
    //     resp.members.push(traveler.createTaskMemberResponse(travMap,true));
    //   }

    resp.querierRef = curMember ? curMember.id : null;
    resp.querierStatus = curMember ? curMember.status : null;
    
    return resp;
  };

  /** 
   * @param {string} userId
   * @param {{[travelerId: string]: JetUserTravelerInstance}} travMap
   * @param {JetInfos} infos*/
  taskModel.prototype.createOwnerResponse = function(userId, travMap = {}, infos = {userAddressMap: {}, travAddressMap: {}}){
    /** @type {JetTaskInstance} */
    const task = this;
    const taskUser = task.taskUsersMap
      ? task.taskUsersMap[userId]
      : null;
    const userRef = taskUser ? taskUser.id : null;

    const prov = task.isProvisional();

    return prov
      ? task.createPrivateProvisionalResponse(userRef, travMap, infos)
      : task.createPrivateResponse(userRef, travMap, infos);
  };

  return taskModel;
};