const moment = require('moment');

const invertMap = require('../../utils/commonFunctions').invertMap;
const nameToKey = require('../../utils/commonFunctions').convertNameToKey;
const createTime = require('../../utils/commonFunctions').createTime;
const changeType = require('../../utils/fieldProperties').getChangeType;

const VIA_BOUND = require('../../utils/commonFields').VIA_BOUND;

/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetTaskPopulator} */const taskPopulator = {};

  // INTERNAL FUNCTIONS ------------------------------------------------------------------------------
  /**
   * 
   * @param {JetBaseTaskRequest} taskRequest 
   * @param {boolean} dep 
   * @param {number} index 
   * @param {JetErrors} errors 
   * @param {JetInfos} infos 
   * @param {(taskReq: JetBaseTaskRequest, dep: boolean, index: number, errors: JetErrors) => JetNeighborhoodInstance} findHood 
   */
  const populateCityStop = function(taskRequest,dep,index,errors,infos,findHood){
    const cityLocation = dep ? taskRequest.depCityLocation : taskRequest.arrCityLocation;
    if(!cityLocation)
      return true;

    const lbl = `taskRequest${index} ${dep ? 'dep':'arr'}Location`;

    // -- check #1: either by providing the ref to an existing address through a travelerAddress ref
    if(cityLocation.marker.travelerRef){
      const address = infos.travAddressMap[cityLocation.marker.travelerRef];
      if(address){
        cityLocation.address = address;
        cityLocation.customAddress = false;
        infos.addressIdMap[address.id] = address; 
      } else {
        errors.errors[lbl] = `Referenced address ${cityLocation.marker.travelerRef} could not be found`;
        return false;
      }
  
    // -- check #2: or by providing the ref to an existing address through a userAddress ref
    } else if(cityLocation.marker.userRef){
      const address = infos.userAddressMap[cityLocation.marker.userRef];
      if(address){
        cityLocation.address = address;
        cityLocation.customAddress = false;
        infos.addressIdMap[address.id] = address; 
      } else {
        errors.errors[lbl] = `Referenced address ${cityLocation.marker.useRef} could not be found`
          + ' or was not associated to the logged user';
        return false;
      }          
  
    // -- check #3: or by providing the lat and longitude of the address directly
    } else if(typeof cityLocation.location.latitude === 'number'
      && typeof cityLocation.location.longitude === 'number'){
      const address = models.Address.buildFromFields(dep ? taskRequest.depCityLocation : taskRequest.arrCityLocation);
      if(address){
        cityLocation.address = address;
        cityLocation.customAddress = true;
        infos.addressIdMap[address.id] = address; 
      } else {
        errors.errors[lbl] = 'Custom address is not valid';
        return false;
      }
  
    // -- check #4: or finally by providing a pair agglo/neighborhood directly
    } else if(typeof cityLocation.area.neighborhoodName === 'string'
      && typeof cityLocation.area.aggloName === 'string'){
      const hood = findHood(taskRequest,dep,index,errors);
      cityLocation.customAddress = false;
      if(!hood){
        return false;
      } else {
        cityLocation.hood = hood;
      }

    } else {
      errors.errors[lbl] = 'A city stop is requested but no valid address or neighborhood was provided';
      return false;
    }

    return true;
  }; 


  /**
   * @param {JetProvisionalTaskRequest} taskRequest 
   * @param {{[travId: string]: JetUserTravelerInstance}} userTravMap 
   * @param {JetErrors} errors 
   * @param {number} index 
   */
  const populateProvisionalBeneficiaries = function(taskRequest, userTravMap, errors, index = 0){
    return taskRequest.beneficiaries.every((travReq,tNum) => {
      travReq.userTraveler = userTravMap[travReq.userRef];
      if(!travReq.userTraveler){
        errors.errors[`taskRequest${index} traveler${tNum}`] = 'user-traveler id could not be matched to logged user';
        return false;
      }
      return true;
    });
  };

  /**
   * @param {JetTaskRequestFromVia} taskRequest 
   * @param {JetErrors} errors 
   * @param {number} index 
   */
  const populateFromViaMembers = function(taskRequest, errors, index = 0){
    const refVia = taskRequest.via;
    return taskRequest.members.every((travReq, ind) => {

      const viaTraveler = refVia.ViasTravelers.find(viaTrav=> viaTrav.id === travReq.viaRef);
      if(!viaTraveler){
        errors.errors[`taskRequest${index}-traveler${ind}`] = 'via-traveler association id is not valid';
        return false;
      }
      travReq.viaTraveler = viaTraveler;
      return true;
    });
  };


  /**
   * @param {JetInfos} infos
   * @return {(taskRequest: JetTaskRequestFromVia, dep: boolean, index: number, errors: JetErrors) => JetNeighborhoodInstance}
   */
  const findFromViaHood = (infos) => (taskRequest, dep, index, errors) => {
    const aggloName = dep
      ? taskRequest.depCityLocation
        ? taskRequest.depCityLocation.area.aggloName
        : null
      : taskRequest.arrCityLocation
        ? taskRequest.arrCityLocation.area.aggloName
        : null;

    const hoodName = dep
      ? taskRequest.depCityLocation
        ? taskRequest.depCityLocation.area.neighborhoodName
        : null
      : taskRequest.arrCityLocation
        ? taskRequest.arrCityLocation.area.neighborhoodName
        : null;

    if(!aggloName || !hoodName)
      return null;

    const aggloKey = nameToKey(aggloName);
    const hoodKey = nameToKey(hoodName);
    const via = taskRequest.via;
    const airport = dep ? via.DepAirport : via.ArrAirport;

    const potentialAgglos = infos.aggloMap[aggloKey];
    const potentialHoods = infos.hoodMap[hoodKey];

    if(!potentialAgglos || !potentialAgglos.length){
      errors.errors[`taskRequest${index}`] = `Agglo "${aggloName}" could not be found`;
      return null;          
    }

    if(!potentialHoods || !potentialHoods.length){
      errors.errors[`taskRequest${index}`] = `Neighborhood "${hoodName}" could not be found`;
      return null;
    }
        
    if(!airport || !airport.Agglos || !airport.Agglos.length){
      errors.errors[`taskRequest${index}`] 
            = 'Referenced via does not have an airport entry or its airport is not associated with any agglomeration';
      return null;
    }
          
    const airptAggloIds = airport.Agglos.map(agglo => agglo.id);
    const eligibleAggloIds = potentialAgglos
      .map(agglo => agglo.id)
      .filter(aggloId => airptAggloIds.includes(aggloId));

    if(!eligibleAggloIds.length){
      errors.errors[`taskRequest${index}`] 
            = `Agglo "${taskRequest.cityLocation.area.aggloName}" is not associated with airport "${airport.name}"`;
      return null;
    }

    const eligibleHoods = potentialHoods.filter(hood => eligibleAggloIds.includes(hood.agglo_id));

    if(eligibleHoods.length){
      // small risk here: two agglos with same name, associated to same airport, with two hoods of same name --> unlikely
      return eligibleHoods[0];
    } else {
      errors.errors[`taskRequest${index}`] = `Neighborhood "${hoodName}" is not associated with agglo "${aggloName}"`;
      return null;
    } 
  };



  
  // END of INTERNAL FUNCTIONS -----------------------------------------------------------------------


  // PUBLIC METHODS ----------------------------------------------------------------------------------
  taskPopulator.provisionalRequests = function(taskRequests,infos,travMap,errors){
    /** @param {JetProvisionalTaskRequest} taskRequest
     * @param {boolean} dep
     * @param {number} index
     * @param {JetErrors} errors
     * @return {JetNeighborhoodInstance}*/
    const findHood = function(taskRequest, dep, index, errors){
      const aggloName = dep
        ? taskRequest.depCityLocation
          ? taskRequest.depCityLocation.area.aggloName
          : null
        : taskRequest.arrCityLocation
          ? taskRequest.arrCityLocation.area.aggloName
          : null;

      const hoodName = dep
        ? taskRequest.depCityLocation
          ? taskRequest.depCityLocation.area.neighborhoodName
          : null
        : taskRequest.arrCityLocation
          ? taskRequest.arrCityLocation.area.neighborhoodName
          : null;

      if(!aggloName || !hoodName)
        return null;
        
      const aggloKey = nameToKey(aggloName);
      const hoodKey = nameToKey(hoodName);
      const airports = dep 
        ? taskRequest.depAirports.map(entry => entry.airport) 
        : taskRequest.arrAirports.map(entry => entry.airport);

      const potentialAgglos = infos.aggloMap[aggloKey];
      const potentialHoods = infos.hoodMap[hoodKey];

      if(!potentialHoods || !potentialHoods.length){
        errors.errors[`taskRequest${index}`] = `Neighborhood "${hoodName}" could not be found`;
        return null;
      }
      
      if(!potentialAgglos || !potentialAgglos.length){
        errors.errors[`riderRequest${index}`] = `Agglo "${aggloName}" could not be found`;
        return null;          
      }
        
      const airportsAggloIds = {};
      airports.forEach(airport => airport.Agglos.forEach(agglo => airportsAggloIds[agglo.id] = true));
      const eligibleAggloIds = potentialAgglos
        .map(agglo => agglo.id)
        .filter(aggloId => airportsAggloIds[aggloId]);

      if(!eligibleAggloIds.length){
        errors.errors[`taskRequest${index}`] = `Agglo "${aggloName}" is not associated with any of the selected airports"`;
        return null;
      }

      const eligibleHoods = potentialHoods
        .filter(hood => eligibleAggloIds.includes(hood.agglo_id));

      if(eligibleHoods.length){
        // potential risk here: if two agglo with same name, associated to same airport, with two hoods with same name --> unlikely
        return eligibleHoods[0]; 
      } else {
        errors.errors[`taskRequest${index}`] = `Neighborhood "${hoodName}" is not associated with agglo "${aggloName}"`;
        return null;
      } 
    };

    const invMap = invertMap(travMap,'id');
    infos.addressMap = infos.addressMap ? infos.addressMap : {};

    // Performs taskRequests checks vs entries fetched from the database
    // If every task request passes, fetches the address data
    return taskRequests.every((taskRequest, index) => {

      // verify that valid departure airports were provided
      if(!taskRequest.depAirports.every((depAirpt,ind) => {
        depAirpt.airport = infos.airportIdMap[depAirpt.airportCode];
        if(!depAirpt.airport){
          errors.errors[`taskRequest${index} depAirport${ind}`] = `Referenced airport ${depAirpt.airportCode} could not be found`;
          return false;
        }
        return true;
      })){
        return false;
      }

      // verify that valid arrival airports were provided
      if(!taskRequest.arrAirports.every((arrAirpt,ind) => {
        arrAirpt.airport = infos.airportIdMap[arrAirpt.airportCode];
        if(!arrAirpt.airport){
          errors.errors[`taskRequest${index} arrAirport${ind}`] = `Referenced airport ${arrAirpt.airportCode} could not be found`;
          return false;
        }
        return true;
      })){
        return false;
      }

      // verify that valid travelers, all associated with the users, where provided
      if(!populateProvisionalBeneficiaries(taskRequest,invMap,errors,index))
        return false;

      // verify that a valid location was provided
      if(!populateCityStop(taskRequest,true,index,errors,infos,findHood)
        || !populateCityStop(taskRequest,false,index,errors,infos,findHood))
        return false;

      const depHood = taskRequest.depCityLocation ? taskRequest.depCityLocation.hood : null;
      const arrHood = taskRequest.arrCityLocation ? taskRequest.arrCityLocation.hood : null;

      if(depHood && !taskRequest.depAirports.every((airpt,ind) => {
        if(!airpt.airport.Agglos.find(agglo => agglo.id === depHood.agglo_id)){
          errors.errors[`taskRequest${index} depAirport${ind}`] = 
            `Neighborhood ${taskRequest.depCityLocation.hood.name} cannot be associated with airport ${airpt.airport.name}`;
          return false;
        }
        airpt.hood = depHood;
        return true;
      })){
        return false;
      }

      if(arrHood && !taskRequest.arrAirports.every((airpt,ind) => {
        if(!airpt.airport.Agglos.find(agglo => agglo.id === arrHood.agglo_id)){
          errors.errors[`taskRequest${index} arrAirport${ind}`] = 
            `Neighborhood ${taskRequest.arrCityLocation.hood.name} cannot be associated with airport ${airpt.airport.name}`;
          return false;
        }
        airpt.hood = arrHood;
        return true;
      })){
        return false;
      }

      return true;
    });
  };


  taskPopulator.fromViaRequests = function(taskRequests, infos, tripMap, errors){
    const findHood = findFromViaHood(infos);
    infos.addressIdMap = infos.addressMap ? infos.addressIdMap : {};
    infos.viaIdMap = {};

    // Performs taskRequests checks vs vias fetched from the database
    // If every taskFromViaRequest passes, links the viaRequest to its via
    return taskRequests.every((taskRequest, index) => {
      
      // POST/ADD CHECK #1: verify that the referenced trip and via exist
      taskRequest.trip = tripMap[taskRequest.tripUser];
      if(!taskRequest.trip){
        errors.errors[`taskRequest${index}`] = 'Task: trip could not be found';
        return false;
      }

      taskRequest.via = taskRequest.trip.vias.find(via => via.ordinal === taskRequest.viaOrdinal);
      if(!taskRequest.via){
        errors.errors[`taskRequest${index}`] = `No via could be found with ordinal: ${taskRequest.viaOrdinal}`;
        return false;
      }

      // POST/ADD CHECK #2: verify that all the travelers to be linked to the Task instance are associated to the referenced via
      if(!populateFromViaMembers(taskRequest, errors, index)){
        return false;
      }

      // POST/ADD CHECK #3: verify that no task instance exists for any of the requested beneficiaries
      const memberIds = taskRequest.members.map(member=> member.viaTraveler.traveler_id);
      const via = taskRequest.via;
      if(via.ViasTravelers.some(viaTrav => {
        return viaTrav.TasksViasTravelers.some(taskViaTrav => memberIds.includes(taskViaTrav.traveler_id) && taskViaTrav.task_id != via.id);
      })){
        errors.errors[`taskRequest${index}`] = 'At least one Task referring to a requested member already exists';
        return false;
      }
      infos.viaIdMap[via.id] = via;

      // POST/ADD CHECK #4: verify that a valid location was provided
      if(!populateCityStop(taskRequest,true,index,errors,infos,findHood)
        || !populateCityStop(taskRequest,false,index,errors,infos,findHood))
        return false;

      return true;
    });
  };

  taskPopulator.fromViaUpdateRequests = function(requests,infos,travMap,errors){
    const findHood = findFromViaHood(infos);
    infos.addressIdMap = infos.addressIdMap ? infos.addressIdMap : {};

    return requests.every((taskRequest,index) => {
      const task = taskRequest.task;

      // PUT-->VIA TASK CHECK #1: verify that the via was found
      if(!task.via_id){
        errors.errors[`taskRequest${index}`] = 'Task to be updated is not associated with a via, it should be flagged as provisional';
        return false;
      } else if(!infos.viaIdMap[taskRequest.task.via_id]){
        errors.errors[`taskRequest${index}`] = 'Could not retrieve the via associated to the task to be updated';
        return false;
      }
      task.via = infos.viaIdMap[taskRequest.task.via_id];
      task.via.populate(['airports'],infos);
      taskRequest.via = task.via;

      // PUT-->VIA TASK CHECK #2: verify that all the travelers to be linked to the Task instance are associated to the referenced via
      if(!populateFromViaMembers(taskRequest, index, errors))
        return false;

      // PUT--> VIA TASK CHECK #3: verify that a valid location was provided
      if(!populateCityStop(taskRequest,true,index,errors,infos,findHood)
        || !populateCityStop(taskRequest,false,index,errors,infos,findHood)){
        return false;
      }

      return true;
    });
  };
  

  taskPopulator.changeType = function(provUpdReq){
    const task = provUpdReq.task;
    provUpdReq.changeType = 'minimal';

    if(provUpdReq.viaTask)
      throw Error('task: assessChangeType may only be called on provisional update requests');

    // STEP #1: checks discrepancies in earliest and latest dates
    const taskEarliestDate = moment(task.earliest_date);
    const taskLatestDate = moment(task.latest_date);
    const reqEarliestDate = moment(provUpdReq.earliestDate);
    const reqLatestDate = moment(provUpdReq.latestDate);

    if(taskEarliestDate.isValid() && reqEarliestDate.isValid() && !taskEarliestDate.isSame(reqEarliestDate,'day')){
      if(taskEarliestDate.isBefore(reqEarliestDate,'day'))
        provUpdReq.changeType = changeType(provUpdReq.changeType,'restrictive');
      else 
        provUpdReq.changeType = changeType(provUpdReq.changeType,'expanding');
    }

    if(taskLatestDate.isValid() && reqLatestDate.isValid() && !taskLatestDate.isSame(reqLatestDate,'day')){
      if(taskLatestDate.isAfter(reqLatestDate,'day'))
        provUpdReq.changeType = changeType(provUpdReq.changeType,'expanding');
      else 
        provUpdReq.changeType = changeType(provUpdReq.changeType,'restrictive');
    }

    if(provUpdReq.changeType === 'breaking')
      return; // CAN STOP HERE

    // STEP #2: checks discrepancies in earliest and latest times
    const taskEarliestTime = createTime(task.earliest_time);
    const taskLatestTime = createTime(task.latest_time);
    const reqEarliestTime = createTime(provUpdReq.earliestTime);
    const reqLatestTime = createTime(provUpdReq.latestTime);

    if(taskEarliestTime.isValid() && reqEarliestTime.isValid() && !taskEarliestTime.isSame(reqEarliestTime,'minute')){
      if(taskEarliestTime.isAfter(reqEarliestTime,'minute'))
        provUpdReq.changeType = changeType(provUpdReq.changeType,'restrictive');
      else
        provUpdReq.changeType = changeType(provUpdReq.changeType,'expanding');
    }

    if(taskLatestTime.isValid() && reqLatestTime.isValid() && !taskLatestTime.isSame(reqLatestTime,'minute')){
      if(taskLatestTime.isBefore(reqLatestTime,'minute'))
        provUpdReq.changeType = changeType(provUpdReq.changeType,'restrictive');
      else
        provUpdReq.changeType = changeType(provUpdReq.changeType,'expanding');
    }

    if(provUpdReq.changeType === 'breaking')
      return; // CAN STOP HERE

    // STEP #3: checks discrepancies in arrival and departure airports
    const taskDepAirportIds = task.TasksAirports.filter(taskAirpt => taskAirpt.bound === VIA_BOUND.departure);
    const taskArrAirportIds = task.TasksAirports.filter(taskAirpt => taskAirpt.bound === VIA_BOUND.arrival);

    const addlDepAirports = provUpdReq.depAirports
      .filter(entry => !taskDepAirportIds.find(id => entry.airport.id === id))
      .map(entry => entry.airport.id);
    const addlArrAirports = provUpdReq.arrAirports
      .filter(entry => !taskArrAirportIds.find(id => entry.airport.id === id))
      .map(entry => entry.airport.id);

    const missingDepAirports = taskDepAirportIds
      .filter(id => !provUpdReq.depAirports.find(entry => entry.airport.id === id));
    const missingArrAirports = taskArrAirportIds
      .filter(id => !provUpdReq.arrAirports.find(entry => entry.airport.id === id));

    if(missingDepAirports.length || missingArrAirports.length)
      provUpdReq.changeType = changeType(provUpdReq.changeType,'restrictive');

    if(addlDepAirports.length || addlArrAirports.length)
      provUpdReq.changeType = changeType(provUpdReq.changeType,'expanding');

    if(provUpdReq.changeType === 'breaking')
      return; // CAN STOP HERE

    // STEP #4: checks discrepancies in flights: TODO
  };


  return taskPopulator;
};

