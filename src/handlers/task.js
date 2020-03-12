const moment = require('moment');

const resAttr = require('../utils/commonResAttr');
const createTime = require('../utils/commonFunctions').createTime;

const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;
const VIA_BOUND = require('../utils/commonFields').VIA_BOUND;

/** @param {JetModels} models */
module.exports = function(models){
  
  const Op = models.sequelize.Op;
  
  /** @type {JetTaskHandler} */
  const taskHandler = {};

  taskHandler.populateCustAddressProvisionalHoods = function(taskRequest, dep){
    const address = dep ? taskRequest.depCityLocation.address : taskRequest.arrCityLocation.address;
    const airportReqs = dep ? taskRequest.depAirports : taskRequest.arrAirports;
    const details = dep ? taskRequest.depCityLocation.details : taskRequest.arrCityLocation.details;

    return address
      .findCountryStateCity(details)
      .then(() => {
        return address
          .createNeighborhoodMap(airportReqs.map(airptReq => airptReq.airport))
          .then(map => {
            airportReqs.forEach(airptReq => {
              airptReq.hood = map[airptReq.airport.id];
            });
          });
      });
  };

  taskHandler.populateCustAddressTaskHood = function(taskRequest, dep){
    const address = dep ? taskRequest.depCityLocation.address : taskRequest.arrCityLocation.address;
    const airport = dep ? taskRequest.via.DepAirport : taskRequest.via.ArrAirport;
    const details = dep ? taskRequest.depCityLocation.details : taskRequest.arrCityLocation.details;

    return address
      .findCountryStateCity(details)
      .then(() => {
        return address
          .findNeighborhood(airport)
          .then(hood => {
            if(dep){
              taskRequest.depCityLocation.hood = hood;
              taskRequest.task.dep_neighborhood_id = hood ? hood.id : null;
              taskRequest.task.DepNeighborhood = hood;
            } else {
              taskRequest.arrCityLocation.hood = hood;
              taskRequest.task.arr_neighborhood_id = hood? hood.id : null;
              taskRequest.task.ArrNeighborhood = hood;
            }
          });
      });
  };

  taskHandler.populateExistAddressProvisionalHoods = function(taskRequest, dep){
    const address = dep ? taskRequest.depCityLocation.address : taskRequest.arrCityLocation.address;
    const airportReqs = dep ? taskRequest.depAirports : taskRequest.arrAirports;

    return address
      .createNeighborhoodMap(airportReqs.map(airptReq => airptReq.airport))
      .then(map => {
        airportReqs.forEach(airptReq => {
          airptReq.hood = map[airptReq.airport.id];
        });
      });
  };

  taskHandler.populateExistAddressTaskHood = function(taskRequest, dep){
    const address = dep ? taskRequest.depCityLocation.address : taskRequest.arrCityLocation.address;
    const airport = dep ? taskRequest.via.DepAirport : taskRequest.via.ArrAirport;

    return address
      .findNeighborhood(airport)
      .then(hood => {
        if(dep){
          taskRequest.depCityLocation.hood = hood;
          taskRequest.task.dep_neighborhood_id = hood ? hood.id : null;
          taskRequest.task.DepNeighborhood = hood;
        } else {
          taskRequest.arrCityLocation.hood = hood;
          taskRequest.task.arr_neighborhood_id = hood ? hood.id : null;
          taskRequest.task.ArrNeighborhood = hood;
        }
      });
  };


  taskHandler.updateTaskers = async function(task, updatedTaskers = [], t =  null) {
    if(!task)
      return Promise.reject({taskHandler: 'updateTaskers: task may not be null'});

    if(!updatedTaskers || !Array.isArray(updatedTaskers))
      return Promise.reject({taskHandler: 'updateTaskers: taskers must be of type array'});

    if(updatedTaskers.some(entry => entry.member.status === HELP_STATUS.helpee || entry.status === HELP_STATUS.helpee))
      return Promise.reject({taskHandler: 'updateTaskers: taskers may not have the status "helpee"'});

    const opt = t ? {transaction: t, fields: ['status','rank']} : {fields: ['status','rank']};

    const taskId = task.getId();

    if(!taskId)
      return Promise.reject({taskHandler: 'updateTaskers: could not retrieve the task id'});


    const newHelperCount = updatedTaskers.filter(entry => entry.status === HELP_STATUS.helper).length;
    if(newHelperCount > 1) // int used as boolean, only possible values 0 | 1
      return Promise.reject({taskHandler: 'updateTaskers: may not request more than one helper'});

    // updated member: helper -> backup insert at required rank >> DONE
    // updated member: [any] -> helper: update current helper to proper backup rank >> DONE
    // updated member: backup -> [any]: update backup position >> DONE
    // updated member: [helper] -> [any]: if possible, promote backup to helper and reajust other backups >> DONE

    /**@type {{[memberId: string]: {member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}} */
    const toUpdateMembers = {};

    /** @type {Array<{member: JetTaskViaTravelerInstance, newRank: number}>} */
    const backups = [];

    /** @type {string}*/
    let currentHelperId;

    // first, set rank to 0 for all except backups
    // save updated backups
    updatedTaskers
      .forEach(entry => {
        switch(entry.status){
        case HELP_STATUS.backup:
          backups.push({member: entry.member, newRank: entry.rank});
          break;
        default: entry.newRank = 0;
        }
      });




    // second, if there is a new helper:
    // checks if the previous one is updated (say to 'backup' or 'cancelled')
    // otherwise, looks up the current helper and if found, change to first backup
    if(newHelperCount){
      const currentHelper = task.TasksViasTravelers.find(member => member.status === HELP_STATUS.helper);
      currentHelperId = currentHelper ? currentHelper.id : null;

      const prevHelperEntry = currentHelperId ? updatedTaskers.find(entry => entry.member.id === currentHelperId) : null;
      if(!prevHelperEntry && currentHelper){
        updatedTaskers.push({member: currentHelper, status: HELP_STATUS.backup, rank: -1});
        backups.push({member: currentHelper, newRank: -1});
      }
    
    // third, if there is no new helper but the previous helper was removed, check if can promote one backup
    } else {
      const removedHelper = updatedTaskers.find(entry => entry.member.status === HELP_STATUS.helper && entry.status !== HELP_STATUS.helper);
      if(removedHelper){
        const possibleBackups = task.TasksViasTravelers
          .filter(member => {
            return member.status === HELP_STATUS.backup && !updatedTaskers.find(entry => entry.member.id === member.id);
          });

        possibleBackups.sort((b1,b2) => b1.rank - b2.rank);
        const promotedBackup = possibleBackups.length ? possibleBackups[0] : null;

        if(promotedBackup){
          updatedTaskers.push({member: promotedBackup, status: HELP_STATUS.helper, rank: 0});
        }
      }
    }

    
    // fourth, eliminate entry that require no change and store the others in the map toUpdateMembers
    updatedTaskers
      .filter(entry => entry.status !== entry.member.status || entry.rank !== entry.member.rank)
      .forEach(entry => {
        toUpdateMembers[entry.member.id] = entry;
      });

    

    // fifth, go over the EXISTING backups and map their current rank to handle db insertion
    // add the missing backups (members requested to update + current remaining members)
    // sort them assign the index as the newRank (to ensure 0,1,2... without empty)
    // pick up the resulting updates
    const backupRankMap = {};
    backups.push(...task.TasksViasTravelers
      .filter(member => member.status === HELP_STATUS.backup)
      .filter(member => {
        backupRankMap[member.rank] = true;
        return !toUpdateMembers[member.id];
      })
      .map(member => ({member, newRank: member.rank}))
    );

    backups.sort((b1,b2) => b1.newRank - b2.newRank);
    backups.forEach((b,ind) => {
      if(b.newRank !== ind){
        const entry = toUpdateMembers[b.member.id];
        if(entry)
          entry.rank = ind;
        else
          toUpdateMembers[b.member.id] = {
            member: b.member,
            status: HELP_STATUS.backup,
            rank: ind
          };
      }
    });



    // sixth: convenience function to convert the map into an iterable
    const toUpdateEntries = Object.keys(toUpdateMembers)
      .map(memberId => {
        const entry = toUpdateMembers[memberId];
        return entry;
      });

    const adminTravIds = task.getAdminTravelerIds();
    const taskNoticeRequests = Object.keys(toUpdateMembers)
      .map(memberId => {
        const entry = toUpdateMembers[memberId];

        const {type,subType,side}= models.TaskNotice.inferTypes(
          entry.member ? entry.member.status : null,
          entry.status,
          entry.member ? entry.member.rank : 0,
          entry.rank
        );

        return {
          member: entry.member,
          helpeeIds: adminTravIds,
          type,
          subType,
          side
        };
      }).filter(val => !!val.member && !!val.subType);


    try{
      /** @type {Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>} */
      const delayedEntries = [];

      /** @type {Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>} */
      const conflictEntries = [];

      // update the entries that do not conflict (either with the existing helper, or with the {backup,rank})
      // on conflict, buffer for later in delayedEntries
      await Promise.all(
        toUpdateEntries.map(entry => {
          let skip = false;

          switch(entry.status){
          case HELP_STATUS.backup:
            if(backupRankMap[entry.rank])
              skip = true;
            break;
          case HELP_STATUS.helper:
            if(currentHelperId)
              skip = true;
            break;
          default:
          }

          if(skip){
            delayedEntries.push(entry);
            return Promise.resolve(entry.member);
          }

          // buffer status and update AFTER save
          const prevStatus = entry.member.status;
          const prevRank = entry.member.rank;

          entry.member.status = entry.status;
          entry.member.rank = entry.rank;

          return entry.member
            .save(opt)
            .then(() => {
              switch(prevStatus){
              case HELP_STATUS.backup:
                delete backupRankMap[prevRank];
                break;
              case HELP_STATUS.helper:
                currentHelperId = null;
                break;
              default:
              }
            });
        })
      );

      // check if delayed entry are now cleared to persist (because previously conflicting entries were updated)
      // if still conflicting, store into conflictEntries
      await Promise.all(
        delayedEntries.map(entry => {
          let skip = false;

          switch(entry.status){
          case HELP_STATUS.backup:
            if(backupRankMap[entry.rank])
              skip = true;
            break;
          case HELP_STATUS.helper:
            if(currentHelperId)
              skip = true;
            break;
          default:
          }

          entry.member.status = entry.status;
          if(skip){
            conflictEntries.push(entry);
            if(entry.status === HELP_STATUS.backup)
              entry.member.rank = entry.rank + 1000;
            else if(entry.status === HELP_STATUS.helper)
              entry.member.status = 'invited'; // buffer as invited, will change back to helper at next step

          } else {
            entry.member.rank = entry.rank;
          }

          return entry.member.save(opt);
        })
      );

      await Promise.all( // no more possible conflicts at this stage
        conflictEntries.map(entry => {
          entry.member.status = entry.status;
          entry.member.rank = entry.rank;
          return entry.member.save(opt);
        })
      );

      // update the task instance itself so that the response reflects the changes
      toUpdateEntries.forEach(entry => {
        const memberId = entry.member.id;
        const curMember = task.TasksViasTravelers.find(m => m.id === memberId);

        if(curMember){
          curMember.status = entry.status;
          curMember.rank = entry.rank;
        } else {
          task.TasksViasTravelers.push(entry.member);
        }
      });

      setTimeout(() => {
        models.handlers.notice
          .dispatchTaskNotices(taskNoticeRequests,null)
          .catch(error => models.handlers.notice
            .handleNoticeError('Update taskers',error)
          );
        }
      ); 

      return task;

    } catch(error){
      return Promise.reject(error);
    }
  };


  taskHandler.link = function(task, via, exceptPassengerIds = [], t = null){
    if(!task)
      return Promise.reject({taskHandler: 'link: task may not be null'});

    if(!via)
      return Promise.reject({taskHandler: 'link: via may not be null'});

    if(!Array.isArray(exceptPassengerIds))
      return Promise.reject({taskHandler: 'link: if provided, exceptPassengerIds must be of type array'});

    const opt = t ? {transaction: t} : {};
    const taskId = task.id
      ? task.id
      : task.TasksTravelers && task.TasksTravelers.length
        ? task.TasksTravelers[0].task_id
        : task.Beneficiaries && task.Beneficiaries.length
          ? task.Beneficiaries[0].TasksTravelers.task_id
          : null;

    if(!taskId)
      return Promise.reject({taskHandler: 'link: task id could not be retrieved'});

    // Retrieves the passengers of the via
    const viaTravelers = via.ViasTravelers
      ? via.ViasTravelers.filter(passenger => !passenger.volunteer && !exceptPassengerIds.includes(passenger.id))
      : via.Travelers
        ? via.Travelers
          .map(traveler => traveler.ViasTravelers)
        : [];

    if(!viaTravelers.length)
      return Promise.reject({taskHandler: 'link: via does not have any passengers, or required fields are not populated'});


    const helpees = viaTravelers.filter(passenger => !passenger.volunteer && !exceptPassengerIds.includes(passenger.id));
    if(!helpees.length)
      return Promise.reject({taskHandler: 'link: there was no passenger left in via after excluding volunteers and specified travelers'});

    // Retrieves the beneficiaries of the provisional tasks
    const currentBeneficiaries = task.TasksTravelers
      ? task.TasksTravelers
      : task.Beneficiaries
        ? task.Beneficiaries.map(b => b.TasksTravelers)
        : null;

    // Retrieves the members of the provisional tasks
    const currentMembers = task.TasksViasTravelers
      ? task.TasksViasTravelers
      : task.Members
        ? task.Members.map(traveler => traveler.TasksViasTravelers)
        : []; // danger here: if task not populated, won't fail but also won't check if "helpees" are already present

    // Verifies that the provisional task does not have any helpees linked to a via already, otherwise it is a "via-task"
    if(currentMembers.filter(m => m.status === HELP_STATUS.helper).length)
      return Promise.reject({taskHandler: 'link: task is not provisional because it has member with status "helpee"'});

    // Lists the provisional beneficiaries that will not be converted into a member with status "helpee"
    /** traveler ids still associated with the task */
    const remainTravIds = {};
    currentMembers.forEach(m => remainTravIds[m.traveler_id] = true);
    helpees.forEach(h => remainTravIds[h.traveler_id] = true);

    const provAirpts = task.TasksAirports
      ? task.TasksAirports
      : task.ProvisionalAirports
        ? task.ProvisionalAirports.map(airport => airport.TasksAirports)
        : [];

    if(!provAirpts.length)
      return Promise.reject({taskHandler: 'link: could not retrieve provisional airports'});

    const provFlightIds = task.TasksFlights
      ? task.TasksFlights
      : task.ProvisionalFlights
        ? task.ProvisionalFlights.map(flight => flight.TasksFlights.id)
        : [];

    const newMembers = helpees.map(passenger => passenger.buildMember(task,HELP_STATUS.helpee));
    
    task.dep_airport_id = typeof via.dep_airport_id === 'number'
      ? via.dep_airport_id
      : via.DepAirport
        ? via.DepAirport.id
        : null;

    task.arr_airport_id = typeof via.arr_airport_id === 'number'
      ? via.arr_airport_id
      : via.ArrAirport
        ? via.ArrAirport.id
        : null;

    const startTime = createTime(via.dep_time);
    const startDate = moment(via.dep_date);

    const endTime = createTime(via.arr_date);
    const endDate = moment(via.arr_airport_id);

    task.flight_id = via.flight_id;
    task.via_id = viaTravelers[0].via_id;

    if(!startTime.isValid())
      return Promise.reject({taskHandler: 'link: via start time is not valid'});
    
    if(!endTime.isValid())
      return Promise.reject({taskHandler: 'link: via end time is not valid'});


    if(!startDate.isValid())
      return Promise.reject({taskHandler: 'link: via start date is not valid'});
    
    else if(!task.earliest_date || !task.latest_date)
      return Promise.reject({taskHandler: 'link: earliest_date and latest_date fields must be populated'});

    else {
      const earliestDate = moment(task.earliest_date);
      const latestDate = moment(task.latest_date); 

      if(earliestDate.isValid() && startDate.isBefore(earliestDate))
        return Promise.reject({taskHandler: 'link: provisional earliest date must be before via dep date'});

      if(latestDate.isValid() && startDate.isAfter(latestDate))
        return Promise.reject({taskHandler: 'link: provisional latest date must be after via dep date'});
    }

    if(!endDate.isValid())
      return Promise.reject({taskHandler: 'link: via end date is not valid'});

    if(task.dep_airport_id !== 'number')
      return Promise.reject({taskHandler: 'link: via dep airport id is not valid'});
    
    else if(!provAirpts.find(taskAirpt => taskAirpt.bound === VIA_BOUND.departure && taskAirpt.airport_id === task.dep_airport_id))
      return Promise.reject({taskHandler: 'link: via departure airport is not among the provisional airports'});


    if(typeof task.arr_airport_id !== 'number')
      return Promise.reject({taskHandler: 'link: via arr airport id is not valid'});
    
    else if(!provAirpts.find(taskAirpt => taskAirpt.bound === VIA_BOUND.arrival && taskAirpt.airport_id === task.arr_airport_id))
      return Promise.reject({taskHandler: 'link: via arrival airport is not among the provisional airports'});

    if (task.flight_id && provFlightIds.length && !provFlightIds.includes(task.flight_id))
      return Promise.reject({taskHandler: 'link: via flight is not among the provisional flights'});

    task.start_date = startDate.toDate();
    task.start_time = startTime.format('HH:mm');
    task.end_date = startDate.toDate();
    task.end_time = endTime.format('HH:mm');
    task.earliest_date = null;
    task.latest_date = null;
    task.earliest_time = null;
    task.latest_time = null;

    const updatedMembers = currentMembers
      .filter(m => m.status !== HELP_STATUS.helpee)
      .concat(newMembers);

    return Promise.all([
      // removes the provisional airport entries
      models.TasksAirports.destroy(Object.assign({where: {id: {[Op.in]: provAirpts.map(provAirpt => provAirpt.airport_id)}}},opt)),

      // removes the provisional flights entries
      provFlightIds.length
        ? models.TasksFlights.destroy(Object.assign({where: {id: {[Op.in]: provFlightIds}}}, opt))
        : Promise.resolve(),

      // removes the beneficiaries
      currentBeneficiaries && currentBeneficiaries.length
        ? models.TasksTravelers.destroy(Object.assign({where: {id: {[Op.in]: currentBeneficiaries.map(b => b.id)}}}, opt))
        : models.TasksTravelers
          .findAll({where: {task_id: taskId}, attributes: ['id']})
          .then(taskTravs => {
            if(taskTravs.length)
              models.TasksTravelers.destroy(Object.assign({where: {id: {[Op.in]: taskTravs.map(taskTrav => taskTrav.id)}}}));
          }),

      // persists the change in the task instance itself
      task.save(Object.assign({fields: resAttr.TASK_SWITCH_ATTRIBUTES},opt)),

      // add the new members with status "helpees"
      ...newMembers.map(m => m.save(opt)),

      // add/removes taskUser instances
      models.TasksUsers
        .updateTaskUsers(task,updatedMembers,[])
        .then(([delTaskUserIds,newTaskUsers]) => {
          return Promise.all([
            delTaskUserIds.length
              ? models.TasksUsers.destroy(Object.assign({where: {id: {[Op.in]: delTaskUserIds}}},opt))
              : Promise.resolve(),
            ...newTaskUsers.map(taskUser => taskUser.save(opt))
          ]);
        })

    ]).then(() => {
      delete task.Beneficiaries;
      delete task.TasksTravelers;
      delete task.TasksAirports;
      delete task.TasksFlights;
      delete task.ProvisionalAirports;
      delete task.ProvisionalFlights;

      task.TasksViasTravelers.push(...newMembers);
      return task;
    });
  };


  taskHandler.unlink = function(task, t = null){
    if(!task)
      return Promise.reject({taskHandler: 'link: task may not be null'});

    const opt = t ? {transaction: t} : {};

    const helpees = task.TasksViasTravelers
      ? task.TasksViasTravelers.filter(m => m.status === HELP_STATUS.helpee)
      : task.Members
        ? task.Members
          .filter(m => m.TasksViasTravelers.status === HELP_STATUS.helpee)
          .map(m => m.TasksViasTravelers)
        : [];

    if(!helpees.length)
      return Promise.reject({taskHanlder: 'unlink: no member with status "helpee" were found'});

    const taskId = helpees[0].task_id;      

    task.earliest_date = task.start_date;
    task.latest_date = task.latest_date;
    task.earliest_time = '00:00';
    task.latest_time = '23:59';
    task.via_id = null;
    task.flight_id = null;

    if(!task.dep_airport_id || !task.arr_airport_id)
      return Promise.reject({taskHandler: 'unlink: task dep or arr airport not found'});

    const depTaskAirpt = models.TasksAirports.build({
      task_id: taskId,
      airport_id: task.dep_airport_id,
      bound: VIA_BOUND.departure,
      neighborhood_id: task.dep_neighborhood_id // if the task is directly associated with a dep hood
    });

    const arrTaskAirpt = models.TasksAirports.build({
      task_id: taskId,
      airport_id: task.arr_airport_id,
      bound: VIA_BOUND.arrival,
      neighborhood_id: task.arr_neighborhood_id // if the task is directly associated with a dep hood
    });

    const beneficiaries = helpees.map(helpee => helpee.buildBeneficiary());

    // NO NEED to handle taskUser
    // all previous helpees remain as provisional beneficiaries
    // previous members remain to

    return Promise.all([
      // if the task is associated to a dep address, fetch the corresponding hood for the dep TaskAirport
      // in any case, persist the dep TaskAirport instance
      task.dep_address_id
        ? models.Address
          .findHood(task.dep_address_id,task.dep_airport_id)
          .then(hood => {
            depTaskAirpt.neighborhood_id = hood ? hood.id : null;
            return depTaskAirpt.save(opt);
          })
        : depTaskAirpt.save(opt),

      // same for the add address / arr TaskAirport
      task.arr_address_id
        ? models.Address
          .findHood(task.arr_airport_id,task.arr_airport_id)
          .then(hood => {
            arrTaskAirpt.neighborhood_id = hood ? hood.id : null;
            return arrTaskAirpt.save(opt);
          })
        : arrTaskAirpt.save(opt),

      // persist the changes in the task instance itself
      task.save(Object.assign({fields: resAttr.TASK_SWITCH_ATTRIBUTES},opt)),

      // delete the members whose status is 'helpee'
      models.TasksViasTravelers.destroy(Object.assign({where: {id: {[Op.in]: helpees.map(h => h.id)}}},opt)),

      // persists the beneficiaries (TasksTravelers)
      ...beneficiaries.map(b => b.save(opt))

    ]).then(() => {
      task.TasksTravelers = beneficiaries;
      task.TasksAirports = [depTaskAirpt,arrTaskAirpt];
      task.TasksFlights = [];
      task.TasksViasTravelers = task.TasksViasTravelers.filter(m => m.status !== HELP_STATUS.helpee);

      delete task.via;
      return task;
    });
  };


  taskHandler.cascade = async function(deletedPassengers, t = null){
    if(!deletedPassengers.length)
      return Promise.resolve();

    const opt = t ? {transaction: t} : {};

    try {
      /** @type {{[taskId: string]: {task: JetTaskInstance, remTravIds: Array<string>, toCascade: boolean}}} */
      const taskMap = {};

      /** @type {{[paxId: string]: JetViaTravelerInstance}} */
      const delPaxMap = {};

      // STEP #0 if TasksViasTravelers field is not populated, fetches the pax-tasks and populates the pax
      if(!deletedPassengers.every(pax => !!pax.TasksViasTravelers)){
        const paxTasks = await models.TasksViasTravelers.findAll({
          where: {via_traveler_id: {[Op.in]: deletedPassengers.map(pax => pax.id)}},
          attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
        });

        deletedPassengers.forEach(pax => {
          pax.TasksViasTravelers = paxTasks
            .filter(paxTask => paxTask.via_traveler_id === paxTask.id);
        });

      }

      // SET all deleted passenger in a map format for ease of access
      // SET all task in a map
      deletedPassengers.forEach(pax => {
        pax.TasksViasTravelers.forEach(m => taskMap[m.task_id] = {});
        delPaxMap[pax.id] = pax;
      });
      
      // STEP #1: 
      // fetches all task instances
      if(Object.keys(taskMap).length){
        const tasks = await models.Task.findAll(
          Object.assign(
            {where: {id: {[Op.in]: Object.keys(taskMap)}}},
            models.queries.FETCH_TASK_PASSENGERCASCADE
          )
        );

        /** @type {{[travId: string]: boolean}} */
        const travelerMap = {};
        
        // extracts ALL travelers related to each task
        // identify which traveler will remain
        const emptyTasks = [];

        tasks.forEach(task => {
          const remTravMap = {};
          const entry = taskMap[task.id];
          entry.removedMembers = task.TasksViasTravelers.find(m => delPaxMap[m.id] && HELP_STATUS.taskers.include(m.status));

          task.TasksViasTravelers = task.TasksTravelers.filter(m => !delPaxMap[m.id]);
          task.TasksViasTravelers.forEach(m => {
            remTravMap[m.traveler_id] = true;
          });

          task.TasksTravelers.forEach(b => {
            remTravMap[b.traveler_id] = true;
          });

          if(!Object.keys(remTravMap)){
            emptyTasks.push(task);
            delete taskMap[task.id];
          
          } else if(!task.TasksTravelers.length && !!task.TasksTravelers.filter(m => m.status === HELP_STATUS.helpee).length){
            emptyTasks.push(task);
            delete taskMap[task.id];

          } else {
            entry.task = task;
            entry.remTravIds = Object.keys(remTravMap);
            Object.keys(remTravMap).forEach(travId => travelerMap[travId] = true);
          }
        });

        // STEP #2: 
        // a) fetch all user-traveler associations
        // b) deletes empty tasks or task with no helpees
        const [travUserTravsMap] = await Promise.all([
          models.UsersTravelers.createTravsUsersMap(Object.keys(travelerMap)),
          emptyTasks.length
            ? models.Task.destroy(Object.assign({where: {id: {[Op.in]: emptyTasks.map(task => task.id)}}, individualHooks: true},opt))
            : Promise.resolve()
        ]);

        /** @type {Array<string>} */ const delTaskUserIds = [];
        /** @type {Array<JetTaskInstance>} */const toCascadeTasks = [];

        // For each task entry, finds which users remain after taking out the deleted passengers 
        Object.keys(taskMap).forEach(taskId => {
          const entry = taskMap[taskId];
          
          const remUserIds = [];
          entry.remTravIds.forEach(travId => {
            const travUsers = travUserTravsMap[travId];
            travUsers.forEach(travUser => remUserIds[travUser.user_id] = true);
          });

          delTaskUserIds.push(...entry.task.TasksUsers
            .filter(taskUser => !remUserIds[taskUser.user_id])
            .map(taskUser => taskUser.id)
          );

          if(entry.toCascade)
            toCascadeTasks.push(entry.task);
        });


        // STEP #3: 
        // a) cascade tasks for which a tasker was removed
        // b) deletes userTask instances
        return Promise.all([
          delTaskUserIds.length
            ? models.TasksUsers.destroy(Object.assign({where: {id: {[Op.in]: delTaskUserIds}}},opt))
            : Promise.resolve(),
          toCascadeTasks.length
            ? taskHandler.cascadeTaskers(toCascadeTasks,t)
            : Promise.resolve()
        ]);


      } else
        return Promise.resolve();


    } catch(error) {
      return Promise.reject(error);
    }
  };


  taskHandler.cascadeTaskers = async function(tasks, t = null){
    const opt = t ? {transaction: t, fields: ['status','rank']} : {fields: ['status','rank']};

    /** @type {Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>} */
    const entries = [];

    /** @type {{[taskId: string]: {[rank: number]: JetTaskViaTravelerInstance}}} */
    const backUpMap = {};

    try{
      tasks.forEach(task => {
        const mapEntry = {};
        const backups = task.TasksViasTravelers
          .filter(b => b.status === HELP_STATUS.backup)
          .sort((b1,b2) => b1.rank - b2.rank);
  
        const helper = task.getHelper();
  
        if(!helper && backups.length){
          entries.push({member: backups.splice(0,1), status: HELP_STATUS.helper, rank: 0});
        }
  
        backups.forEach((b,ind) => {
          mapEntry[b.rank] = b;
          if(b.rank !== ind)
            entries.push({member: b, status: HELP_STATUS.backup, rank: ind});
        });
  
        backUpMap[task.id] = mapEntry;
      });
  
      if(!entries.length)
        return Promise.resolve();

      /** @type {Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>} */
      const delayedEntries = [];
  
      await Promise.all(entries.map(entry => {
        if(entry.status === HELP_STATUS.backup){
          const taskBackUpMap = backUpMap[entry.member.task_id];
          if(taskBackUpMap[entry.rank]){
            delayedEntries.push(entry);
            return Promise.resolve(entry.member);
          }

          delete taskBackUpMap[entry.member.rank];
        }

        entry.member.status = entry.status;
        entry.member.rank = entry.rank;
        return entry.member.save(opt);
      }));

      if(!delayedEntries.length)
        return;

      /** @type {Array<{member: JetTaskViaTravelerInstance, status: JetHelpStatus, rank: number}>} */
      const conflictEntries = [];

      await Promise.all(delayedEntries.map(entry => { // AT THIS POINT, necassarily a backup
        const taskBackUpMap = backUpMap[entry.member.task_id];
        if(taskBackUpMap[entry.rank]){
          entry.member.rank += 1000;
          conflictEntries.push(entry);
        } else 
          entry.member.rank = entry.rank;

        return entry.member.save(opt);
      }));


      if(!conflictEntries)
        return;

      return Promise.all(conflictEntries.map(entry => {
        entry.member.status = entry.status;
        entry.member.rank = entry.rank;
        return entry.member.save(opt);
      }));


    } catch(error){
      return Promise.reject(error);
    }


  };

  return taskHandler;
};