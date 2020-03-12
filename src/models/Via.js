
const moment = require('moment');

const resAttr = require('../utils/commonResAttr');
const calcDateTime = require('../utils/commonFunctions').calculateDateTime;
const createTime = require('../utils/commonFunctions').createTime;
const changeType = require('../utils/fieldProperties').getChangeType;

const VIA_BOUND = require('../utils/commonFields').VIA_BOUND;
const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;

const START_MINUTES_TOLERANCE = 6*60; // six hours
const VIACHANGE_MINUTES_TOLENRANCE = 10;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetViaModel} */
  const viaModel = sequelize.define('Via', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    dep_date: {type: SeqTypes.DATEONLY, allowNull: false},
    arr_date: {type: SeqTypes.DATEONLY, allowNull: false},
    dep_time: {type: SeqTypes.TIME},
    arr_time: {type: SeqTypes.TIME},
    ordinal: {type: SeqTypes.INTEGER, defaultValue: 0, allowNull: false},
  }, {
    name: {singular: 'via', plural: 'vias'}, // otherwise sequelize uses 'vium' as singular
    underscored: true,
    tableName: 'Vias'
  });

  /** @param {JetModels} models */
  viaModel.associate = function(models){

    viaModel.belongsTo(models.Trip, {foreignKey: 'trip_id'});
    viaModel.belongsTo(models.Airport, {as: 'DepAirport', foreignKey: 'dep_airport_id'});
    viaModel.belongsTo(models.Airport, {as: 'ArrAirport', foreignKey: 'arr_airport_id'});
    viaModel.belongsTo(models.Terminal, {as: 'DepTerminal', foreignKey: 'dep_terminal_id'});
    viaModel.belongsTo(models.Terminal, {as: 'ArrTerminal', foreignKey: 'arr_terminal_id'});
    viaModel.belongsTo(models.Airline, {foreignKey: 'airline_id'});    
    viaModel.belongsTo(models.Flight, {foreignKey: 'flight_id'});
    viaModel.belongsTo(models.Layover, {foreignKey: 'layover_id'});

    viaModel.belongsToMany(models.Traveler, {through: models.ViasTravelers});

    viaModel.hasMany(models.ViasTravelers, {foreignKey: 'via_id'});
    viaModel.hasMany(models.Task, {foreignKey: 'via_id'});
    viaModel.hasMany(models.Rider, {foreignKey: 'via_id', onDelete: 'cascade', hooks: true});


    // HOOKS
    viaModel.beforeBulkDestroy('cascadeRiderPax',async ({where}) => {
      if(where && where.id){
        try{
          /** @type {Array<string>} */
          const viaIds = where.id[Op.in] ? where.id[Op.in] : [where.id];

          const [riders,passengers] = await Promise.all([
            models.Rider.findAll(Object.assign({where: {via_id: {[Op.in]: viaIds}}},models.queries.FETCH_RIDER_VIACASCADE)),
            models.ViasTravelers.findAll(Object.assign({where: {via_id: {[Op.in]: viaIds}}},models.queries.FETCH_PASSENGER_VIACASCADE))
          ]);

          return models.sequelize.transaction(t => {

            return Promise.all([
              models.handlers.ride
                .cascade(riders,t)
                .then(() => Promise.all(riders.map(rider => rider.destroy({transaction: t})))), // <-- will delete the address
              
              models.handlers.task.cascade(passengers,t)
            ]);
          });

        } catch(error) {
          return Promise.reject(error);
        }
      }

      return Promise.resolve();
    });


    viaModel.beforeDestroy('cascadeRiderPax', async (via) => {
      try{
        const [riders,passengers] = await Promise.all([
          models.Rider.findAll(Object.assign({where: {via_id: via.id}},models.queries.FETCH_RIDER_RIDERCASCADE)),
          models.ViasTravelers.findAll(Object.assign({where: {via_id: via.id}},models.queries.FETCH_PASSENGER_VIACASCADE))
        ]);

        return models.sequelize.transaction(t => {

          return Promise.all([
            models.handlers.ride
              .cascade(riders,t)
              .then(() => Promise.all(riders.map(rider => rider.destroy({transaction: t})))),
            
            models.handlers.task.cascade(passengers,t)
          ]);
        });

      } catch(error){
        return Promise.reject(error);
      }
    });


    // MODEL METHODS REQUIRING MODELS
    viaModel.createViaMap = function(viaIds, extended = true){
      if(!Array.isArray(viaIds) || !viaIds.length)
        return Promise.resolve({});
  
      return viaModel.findAll({
        where: {id: {[Op.in]: viaIds}},
        attributes: extended
          ? models.queries.FETCH_ASSOCIATED_VIA.attributes
          : models.queries.FETCH_PASSENGERVIA.attributes,
        include: extended
          ? models.queries.FETCH_ASSOCIATED_VIA.include
          : models.queries.FETCH_PASSENGERVIA.include
      }).then(vias => {
        const viaMap = {};

        vias.forEach(via => viaMap[via.id] = via);
        return viaMap;
      });
    }; 
    
    // INSTANCE METHODS REQUIRING MODELS
    /**
     * Propagates a change in via to associated riders, passengers, and taskers
     * This can only involve changes in time, terminal, airline and/or flight*/
    viaModel.prototype.propagate = function(){
      /** @type {JetViaInstance} */const via = this;

      return Promise.all([

        // propagate to riders (1/3)
        // update all riders by calling rider.propagate (TODO: handle case where two riders of the same ride are linked to the same via)
        models.Rider.findAll({
          where: {via_id: via.id},
          attributes: models.queries.FETCH_RIDER_VIACASCADE.attributes,
          include: models.queries.FETCH_RIDER_VIACASCADE.include
        
        }).then(riders => {
          return Promise.all(
            riders.filter(rider => {
              const newTerminalId = rider.toward === 'city' ? via.arr_airport_id : via.dep_airport_id;
              const newTime = rider.toward === 'city' ? via.arr_time : via.dep_time; // TODO: offset time

              if(newTerminalId !== rider.terminal_id || newTime !== rider.dep_time){
                rider.terminal_id = newTerminalId;
                rider.dep_time = newTime;

                return true;
              }
              return false; // no need to update riders if neither terminal nor dep_time changes
            }).map(rider => rider.propagate())
          );
        }),

        // propagate to tasks (2/3)
        // update all tasks linked to this via, ie for which helpees use this via (will automatically pickup the helpees)
        models.Task.findAll({
          where: {via_id: via.id},
          attributes: models.queries.FETCH_TASK_VIACASCADE.attributes,
          include: models.queries.FETCH_TASK_VIACASCADE.include
        
        }).then(tasks => {
          /** @type {Array<JetTaskInstance>} */ const breakingTasks = [];
          /** @type {Array<JetTaskInstance>} */ const changedTasks = [];

          tasks.forEach(task => {
            const chgType = via.updateTask(task);

            switch(chgType){
            case 'breaking': breakingTasks.push(task); break;
            case 'minimal': changedTasks.push(task); break;
            default:
            }
          });

          /** @type {JetInfos} */ const infos = {viaIdMap: {}};
          infos.viaIdMap[via.id] = via;
          
          /** @type {JetErrors} */ const errors = {errors: {}}; 

          return Promise.all([
            ...breakingTasks.map(async task => {
              try{
                await task.save({fields: ['flight_id','start_date','start_time']});
                await task.propagate(infos,errors,'breaking');
              } catch(error){
                return Promise.reject(error);
              }
            }),

            ...changedTasks.map(task => task.save({fields: ['flight_id','start_date','start_time']}))
          ]);
        }),

        // propagate to members (task-via-traveler) (3/3)
        // check if helpers/backups is affected by the change in via.
        models.TasksViasTravelers.findAll({
          where: {[Op.and]: [
            {via_id: via.id},
            {status: {[Op.not]: HELP_STATUS.helpee}}
          ]},
          attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
        
        }).then(async taskers => {
          /** @type {JetInfos} */const infos = {viaIdMap: {}};
          infos.viaIdMap[via.id] = via;
          
          try{
            await models.TasksViasTravelers.populate(taskers,['task']); // populates task
            
            /** @type {{[taskId: string]: {task: JetTaskInstance, updatedMembers: Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>}} */
            const taskMap = {};

            taskers.forEach(tasker => {
              if(!taskMap[tasker.task_id])
                taskMap[tasker.task_id] = {task: tasker.Task, updatedMembers: []};

              const mUpdate = tasker.createMemberUpdate();

              if(mUpdate)
                taskMap[tasker.task_id].updatedMembers.push(mUpdate);
            });

            const toUpdate = Object.keys(taskMap)
              .map(taskId => taskMap[taskId])
              .filter(entry => !!entry.updatedMembers.length);

            return toUpdate.length
              ? Promise.all(toUpdate.map(entry => {
                models.sequelize.Transaction(t => models.handlers.task.updateTaskers(entry.task, entry.updatedMembers,t));
              }))
              : Promise.resolve();

          } catch(error){
            return Promise.reject(error);
          }  
        })

        // fetch riders thru via -> update terminal / dep_time -> call rider.propagate
        // fetch tasks thru via -> update dep_terminal, arr_terminal, start_time, end_time, flight_id, set change type, create infos, call task.propagate
        // fetch tasksViasTravelers thru via excluding status = "helpee" -> retrieves related tasks, check compatibility, update status -> call updateTaskers
      ]);
    }; // <-- END of INSTANCE METHODS REQUIRING MODELS

  };
  

  // MODEL METHODS
  // nothing for now


  // INSTANCE METHODS
  /** @param {JetViaInstance} oVia */
  viaModel.prototype.compareByStartDateTime = function(oVia){
    /** @type {JetViaInstance} */
    const via = this;

    const dateTime = calcDateTime(via.dep_date,via.dep_time);
    const oDateTime = calcDateTime(oVia.dep_date,oVia.dep_time);
    return dateTime.isBefore(oDateTime) ? -1 : dateTime.isAfter(oDateTime) ? 1 : 0;
  };


  /** Checks whether a via matches a request
   * @param {JetViaRequest} viaRequest 
   * @return {boolean}*/
  viaModel.prototype.matchesRequest = function(viaRequest){
    /** @type {JetViaInstance} */
    const via = this;
    let isMatch = moment(via.dep_date).isSame(moment(viaRequest.dep.date),'d')
      && moment(via.arr_date).isSame(moment(viaRequest.arr.date),'d')
      && via.dep_airport_id === viaRequest.dep.airportCode
      && via.arr_airport_id === viaRequest.arr.airportCode;
    return isMatch;
  };


  /** 
   * @param {Array<string>} fields
   * @param {JetInfos} infos*/
  viaModel.prototype.populate = function(fields, infos){
    /** @type {JetViaInstance} */
    const via = this;

    if(!Array.isArray(fields))
      throw new Error('Via.populate fields arg must be an array of string');

    fields
      .map(field => field.toLowerCase())
      .forEach(field => {
        switch(field){
        case 'airport':
        case 'airports':
          if(infos.airportIdMap){
            if(via.dep_airport_id)
              via.DepAirport = infos.airportIdMap[via.dep_airport_id];

            if(via.arr_airport_id)
              via.ArrAirport = infos.airportIdMap[via.arr_airport_id];
          } 
          break;

        case 'terminal':
        case 'terminals':
          if(infos.terminalIdMap){
            if(typeof via.dep_terminal_id === 'number')
              via.DepTerminal = infos.terminalIdMap[via.dep_terminal_id];

            if(typeof via.arr_terminal_id === 'string')
              via.ArrTerminal = infos.terminalIdMap[via.arr_terminal_id];
          } 
          break;

        case 'airline':
        case 'airlines':
          if(infos.airlineIdMap && typeof via.airline_id === 'number')
            via.Airline = infos.airlineIdMap[via.airline_id];
          break;

        case 'flight':
        case 'flights':
          if(infos.flightIdMap && via.flight_id)
            via.Flight = infos.flightIdMap[via.flight_id];
          break;

        default:
        }
      });

    return via;
  };


  /** @param {boolean} dep*/
  viaModel.prototype.createBoundResponse = function(dep){
    /** @type {JetViaInstance} */
    const via = this;

    const airport = dep ? via.DepAirport : via.ArrAirport;
    const terminal = dep ? via.DepTerminal : via.ArrTerminal;

    /** @type {JetViaBound} */
    const boundResp = {
      airportCode: airport.id,
      airportName: airport.name,
      airportCountryCode: airport.Country.code,
      airportCountryName: airport.Country.name,
      airportCountryFlag: airport.Country.flag_emoji,
      terminalCode: terminal ? terminal.code : null,
      terminalName: terminal ? terminal.name : null,
      date: moment(dep ? via.dep_date : via.arr_date).format('YYYY-MM-DD'),
      time: moment(dep ? via.dep_time : via.arr_time,'HH:mm').format('HH:mm')
    };

    return boundResp;
  };


  /** @param {{[travId: string]: JetUserTravelerInstance}} travUserTravMap*/
  viaModel.prototype.createResponse = function(travUserTravMap){
    /** @type {JetViaInstance} */
    const via = this;

    const airline = via.Airline;
    const flight = via.Flight;

    const travelers = via.Travelers
      .map(traveler => {
        traveler.UsersTravelers = travUserTravMap[traveler.ViasTravelers.traveler_id];

        traveler.viaOrdinal = traveler.UsersTravelers 
          ? traveler.UsersTravelers.ordinal : 10000;
        return traveler;
      }).sort((t1,t2) => t1.viaOrdinal - t2.viaOrdinal);

    /** @type {JetViaResponse} */
    const resp = {
      ordinal: via.ordinal,
      dep: via.createBoundResponse(true),
      arr: via.createBoundResponse(false),
      flight: {
        airlineIata: airline ? airline.iata : null,
        airlineIcao: airline ? airline.icao : null,
        airlineName: airline ? airline.name : null,
        flightCode: flight ? flight.code : null,
        legOrdinal: 0
      },
      travelers: travelers.map((trav,ordinal) => trav.createViaResponse(ordinal))
    };

    return resp;
  };


  viaModel.prototype.createPassengerViaResponse = function(){
    /** @type {JetViaInstance} */
    const via = this;

    const airline = via.Airline;
    const flight = via.Flight;

    /** @type {JetPassengerViaResponse} */
    const resp = {
      dep: {
        date: moment(via.dep_date).format('YYYY-MM-DD'),
        time: moment(via.dep_time,'HH:mm').format('HH:mm'),
        airportCode: via.dep_airport_id,
        airportName: via.DepAirport ? via.DepAirport.name : null,
        terminalCode: via.DepTerminal ? via.DepTerminal.code : null,
        terminalName: via.DepTerminal ? via.DepTerminal.name : null
      },

      arr: {
        date: moment(via.arr_date).format('YYYY-MM-DD'),
        time: moment(via.arr_time,'HH:mm').format('HH:mm'),
        airportCode: via.arr_airport_id,
        airportName: via.ArrAirport ? via.ArrAirport.name : null,
        terminalCode: via.ArrTerminal ? via.ArrTerminal.name : null,
        terminalName: via.ArrTerminal ? via.ArrTerminal.name : null
      },

      flight: {
        airlineIata: airline ? airline.iata : null,
        airlineIcao: airline ? airline.icao : null,
        airlineName: airline ? airline.name : null,
        flightCode: flight ? flight.code : null,
        legOrdinal: flight ? 0 : null
      }
    };

    return resp;
  };


  /** @param {JetInfos} infos*/
  viaModel.prototype.assemblePassengerViaResponse = function(infos){
    /** @type {JetViaInstance} */
    const via = this;

    const airline = via.Airline;
    const flight = via.flight_id ? infos.flightIdMap[via.flight_id] : null;
    const depAirport = via.dep_airport_id ? infos.airportIdMap[via.dep_airport_id] : null;
    const arrAirport = via.arr_airport_id ? infos.airportIdMap[via.arr_airport_id] : null;
    const depTerminal = via.dep_terminal_id ? infos.terminalIdMap[via.dep_terminal_id] : null;
    const arrTerminal = via.arr_terminal_id ? infos.terminalIdMap[via.arr_terminal_id] : null;

    /** @type {JetPassengerViaResponse} */
    const resp = {
      dep: {
        date: moment(via.dep_date).format('YYYY-MM-DD'),
        time: moment(via.dep_time,'HH:mm').format('HH:mm'),
        airportCode: via.dep_airport_id,
        airportName: depAirport ? depAirport.name : null,
        terminalCode: depTerminal ? depTerminal .code : null,
        terminalName: depTerminal  ? depTerminal .name : null,
      },

      arr: {
        date: moment(via.arr_date).format('YYYY-MM-DD'),
        time: moment(via.arr_time,'HH:mm').format('HH:mm'),
        airportCode: via.arr_airport_id,
        airportName: arrAirport ? arrAirport.name : null,
        terminalCode: arrTerminal ? arrTerminal.name : null,
        terminalName: arrTerminal ? arrTerminal.name : null,
      },

      flight: {
        airlineIata: airline ? airline.iata : null,
        airlineIcao: airline ? airline.icao : null,
        airlineName: airline ? airline.name : null,
        flightCode: flight ? flight.code : null,
        legOrdinal: flight ? 0 : null
      }      
    };

    return resp;
  };


  /** 
   * @param {string} tripRef
   * @param {toCity} boolean
   * @param {{[travelerId: string]: JetUserTravelerInstance}} travelerUserTravMap */
  viaModel.prototype.createPotentialRider = function(tripRef, toCity = true, travelerUserTravMap = {}){
    /** @type {JetViaInstance} */
    const via = this;  

    /** @type {JetRideWay} */
    const toward = toCity ? 'city' : 'airport';
    const date = toCity ? moment(via.arr_date).format('YYYY-MM-DD') : moment(via.dep_date).format('YYYY-MM-DD');
    const startTime = toCity ? moment(via.arr_time,'HH:mm').format('HH:mm') : moment(via.dep_time,'HH:mm').format('HH:mm');

    const airport = toCity ? via.ArrAirport : via.DepAirport;
    const terminal = toCity ? via.ArrTerminal : via.DepTerminal;

    const travelers = via.Travelers.map(trav => {
      const viaTrav = trav.ViasTravelers;
      const userTrav = travelerUserTravMap[viaTrav.traveler_id];

      return {
        userRef: userTrav ? userTrav.id : null,
        viaRef: viaTrav.id,
        publicName: userTrav ? userTrav.nickname : trav.public_name,
        ageBracket: trav.age_bracket,
        gender: trav.gender,
        relation: userTrav ? userTrav.relation : null,
        pic: trav.pic
      };
    });

    /** @type {JetPotentialRiderResponse} */
    const potentialRider = {
      tripRef,
      viaOrdinal: via.ordinal,
      date,
      startTime,
      toward,
      airportLocation: {
        airportCode: airport.id,
        airportName: airport.name,
        terminalCode: terminal ? terminal.code : null,
        terminalName: terminal ? terminal.name : null
      },
      travelers,
      requirements: {
        seatCount: travelers.length,
        luggageCount: travelers.length
      }
    };

    return potentialRider;
  };


  /** @param {string} tripRef
   * @param {JetInfos} infos
   * @returns {JetPotentialTaskResponse}*/
  viaModel.prototype.createPotentialTask = function(infos = {}){
    /** @type {JetViaInstance} */
    const via = this;  

    const tripUser = via.trip_id && infos.tripUserIdMap
      ? infos.tripUserIdMap[via.trip_id]
      : null;

    const startDate = moment(via.dep_date).format('YYYY-MM-DD')
    const startTime = moment(via.dep_time,'HH:mm').format('HH:mm');
    const endDate = moment(via.arr_date).format('YYYY-MM-DD');
    const endTime = moment(via.arr_time,'HH:mm').format('HH:mm');

    // two possibilities: either via is populated, use populated fields
    // or populate from the JetInfos object.
    const depAirport = via.DepAirport
      ? via.DepAirport
      : infos.airportIdMap[via.dep_airport_id];
    const arrAirport = via.ArrAirport
      ? via.ArrAirport
      : infos.airportIdMap[via.arr_airport_id];

    /** @type {JetViaTravelerResponse[]} */
    let passengers = [];
    
    if(via.ViasTravelers){ // via not populated (tasks/review)
      passengers = via.ViasTravelers.map(viaTrav => {
        const traveler = infos.travelerIdMap[viaTrav.traveler_id];
        traveler.ViasTravelers = viaTrav;
        if(!traveler.UsersTravelers)
          traveler.UsersTravelers = infos.travMap[viaTrav.traveler_id];
        return traveler.createViaResponse();
      });
    
    } else { // via populated (tasks/fromtrip)
      passengers = via.Travelers.map(traveler => {
        if(!traveler.UsersTravelers)
          traveler.UsersTravelers 
            = infos.travMap[traveler.ViasTravelers.traveler_id];
        return traveler.createViaResponse();
      })
    }

    return {
      tripRef: tripUser ? tripUser.id : null,
      viaOrdinal: via.ordinal,
      dep: {
        date: startDate,
        time: startTime,
        airportCode: via.dep_airport_id,
        airportName: depAirport ? depAirport.name : null,
        boundAgglo: null,
        boundNeighborhood: null
      },
      arr: {
        date: endDate,
        time: endTime,
        airportCode: via.arr_airport_id, 
        airportName: arrAirport ? arrAirport.name : null,
        boundAgglo: null,
        boundNeighborhood: null
      },
      flight: {
        // nothing for now
      },
      passengers
    };
  }


  /** 
   * @param {JetTaskInstance} task
   * @param {JetErrors} errors*/
  viaModel.prototype.isCompatible = function(task, errors = {errors: {}}, ind = 0){
    if(!task){
      errors.errors[`passenger${ind}`] = 'via.isCompatible: the target task must be provided';
      return false;
    }

    /** @type {JetViaInstance} */
    const ownVia = this;
    const provTask = task.isProvisional();

    const depAirportCode = ownVia.dep_airport_id 
      ? ownVia.dep_airport_id
      : ownVia.DepAirport
        ? ownVia.DepAirport.id
        : null;
      
    const arrAirportCode = ownVia.arr_airport_id
      ? ownVia.arr_airport_id
      : ownVia.ArrAirport
        ? ownVia.ArrAirport.id
        : null;

    if(!depAirportCode || !arrAirportCode){
      errors.errors[`passenger${ind}`] = 'via.isCompatible: could not retrieve the passenger dep or arr airport';
      return false;
    }

    const depDate = moment(ownVia.dep_date);
    if(!depDate.isValid()){
      errors.errors[`passenger${ind}`] = 'via.isCompatible: could not retrieve the passenger dep date';
      return false;
    }

    const depTime = createTime(ownVia.dep_time);
    if(!depTime.isValid()){
      errors.errors[`passenger${ind}`] = 'via.isCompatible: could not retrieve the passenger dep time';
      return false;      
    }

    if(provTask){
      const taskAirports = task.TasksAirports
        ? task.TasksAirports
        : task.ProvisionalAirports
          ? task.ProvisionalAirports.map(airpt => airpt.TasksAirports)
          : [];

      // TEST #1: airports are matching
      if(!taskAirports.find(taskAirpt => {
        return taskAirpt.airport_id === depAirportCode && taskAirpt.bound === VIA_BOUND.departure;
      })){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: departure airport is not eligible';
        return false;
      }

      if(!taskAirports.find(taskAirpt => {
        return taskAirpt.airport_id === arrAirportCode && taskAirpt.bound === VIA_BOUND.arrival;
      })){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: arrival airport is not eligible';
        return false;
      }

      // TEST #2: date and time are within range
      const earliestDate = moment(task.earliest_date);
      const latestDate = moment(task.latest_date);
      const earliestTime = createTime(task.earliest_time);
      const latestTime = createTime(task.latest_time);

      if(depDate.isBefore(earliestDate)){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: departure date is too early';
        return false;

      } else if (depDate.isAfter(latestDate)){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: departure date is too late';
        return false;
      }

      if(depTime.isBefore(earliestTime)){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: departure time is too early';
        return false;

      } else if (depTime.isAfter(latestTime)){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: departure time is too early';
        return false;        
      }

      // TEST #3: TODO: flight is eligible
      

    } else { // via task
      // TEST #1: airports are matching
      const taskDepAirportCode = task.dep_airport_id
        ? task.dep_airport_id
        : task.DepAirport
          ? task.DepAirport.id
          : null;

      const taskArrAirportCode = task.arr_airport_id
        ? task.arr_airport_id
        : task.ArrAirport
          ? task.ArrAirport.id
          : null;      

      if(depAirportCode !== taskDepAirportCode){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: departure airport does not match';
        return false;
      }

      if(arrAirportCode !== taskArrAirportCode){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: arrival airport does not match';
        return false;
      }

      // #TEST #2: dates are matching
      const depDateTime = calcDateTime(ownVia.dep_date, ownVia.dep_time);
      const taskDateTime = calcDateTime(task.start_date, task.start_time);

      if(Math.abs(depDateTime.diff(taskDateTime,'m')) > START_MINUTES_TOLERANCE){
        errors.errors[`passenger${ind}`] = 'via.isCompatible: flight date/time are not compatible';
        return false;
      }

      // TEST #3: flights are matching
      const ownFlightCode = ownVia.flight_id
        ? ownVia.flight_id
        : ownVia.Flight
          ? ownVia.Flight.id
          : null;

      const taskFlightCode = task.flight_id
        ? task.flight_id
        : task.Flight
          ? task.Flight.id
          : null;

      if(taskFlightCode !== ownFlightCode){
        errors.errors[`passengers${ind}`] = 'via.isCompatible: flights are not matching';
        return false;
      }
    }

    return true;
  };


  /** @param {JetTaskInstance} task*/
  viaModel.prototype.updateTask = function(task){
    /** @type {JetViaInstance} */const via = this;

    /** @type {JetChangeType} */
    let chgType = task.flight_id !== via.flight_id ? 'breaking' : 'none';
    const taskDateTime = calcDateTime(task.start_date,task.start_time);
    const viaDateTime = calcDateTime(via.start_date,via.start_time);

    if(Math.abs(viaDateTime.diff(taskDateTime)) > VIACHANGE_MINUTES_TOLENRANCE)
      chgType = 'breaking';
    else if(!taskDateTime.isSame(viaDateTime))
      chgType = changeType(chgType,'minimal');

    task.start_time = via.dep_time;
    task.end_time = via.arr_time;
    task.flight_id = via.flight_id;

    return chgType;
  };

  
  return viaModel;
};