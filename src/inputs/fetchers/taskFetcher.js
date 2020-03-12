const invertListMap = require('../../utils/commonFunctions').invertListMap;
const HELP_STATUS = require('../../utils/commonFields').HELP_STATUS;

/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetTaskFetcher} */
  const taskFetcher = {};

  const Op = models.sequelize.Op;

  // INTERNAL FUNCTIONS ------------------------------------------------------------------------------
  /**
   * Requests fetching of agglos and hoods by name
   * @param {Array<JetBaseTaskRequest>} taskRequests 
   * @return {JetFetchRequests}*/
  const baseFetchRequest = function(taskRequests){

    const aggloNames = {};
    taskRequests
      .filter(taskReq => taskReq.depCityLocation)
      .filter(taskReq => taskReq.depCityLocation.area.aggloName)
      .map(taskReq => taskReq.depCityLocation.area.aggloName)
      .forEach(aggloName => !aggloNames[aggloName] ? (aggloNames[aggloName] = true) : false);

    taskRequests
      .filter(taskReq => taskReq.arrCityLocation)
      .filter(taskReq => taskReq.arrCityLocation.area.aggloName)
      .map(taskReq => taskReq.arrCityLocation.area.aggloName)
      .forEach(aggloName => !aggloNames[aggloName] ? (aggloNames[aggloName] = true) : false);

    const hoodNames = {};
    taskRequests
      .filter(taskReq => taskReq.depCityLocation)
      .filter(taskReq => taskReq.depCityLocation.area.neighborhoodName)
      .map(taskReq => taskReq.depCityLocation.area.neighborhoodName)
      .forEach(hoodName => !hoodNames[hoodName] ? (hoodNames[hoodName] = true) : false);

    taskRequests
      .filter(taskReq => taskReq.arrCityLocation)
      .filter(taskReq => taskReq.arrCityLocation.area.neighborhoodName)
      .map(taskReq => taskReq.arrCityLocation.area.neighborhoodName)
      .forEach(hoodName => !hoodNames[hoodName] ? (hoodNames[hoodName] = true) : false);

    /** @type {JetFetchRequests} */const fetchRequests = {
      aggloNames: Object.keys(aggloNames),
      hoodNames: Object.keys(hoodNames)
    };

    return fetchRequests;
  };


  /**
   * @param {Array<JetBaseTaskRequest>} requests
   * @return {{users: Array<string>, travs: Array<string>}}
   */
  const getAddresses = function(requests){
    const users = {};
    const travs = {};

    requests
      .filter(taskReq => taskReq.depCityLocation)
      .filter(taskReq => taskReq.depCityLocation.marker.userRef)
      .map(taskReq => taskReq.depCityLocation.marker.userRef)
      .forEach(userAddressId => !users[userAddressId] ? (users[userAddressId] = true) : false);

    requests
      .filter(taskReq => taskReq.arrCityLocation)
      .filter(taskReq => taskReq.arrCityLocation.marker.userRef)
      .map(taskReq => taskReq.arrCityLocation.marker.userRef)
      .forEach(userAddressId => !users[userAddressId] ? (users[userAddressId] = true) : false);

    requests
      .filter(taskReq => taskReq.depCityLocation)
      .filter(taskReq => taskReq.depCityLocation.marker.travelerRef)
      .map(taskReq => taskReq.depCityLocation.marker.travelerRef)
      .forEach(travAddressId => !travs[travAddressId] ? (travs[travAddressId] = true) : false);

    requests
      .filter(taskReq => taskReq.arrCityLocation)
      .filter(taskReq => taskReq.arrCityLocation.marker.travelerRef)
      .map(taskReq => taskReq.arrCityLocation.marker.travelerRef)
      .forEach(travAddressId => !travs[travAddressId] ? (travs[travAddressId] = true) : false);

    return {
      users: Object.keys(users),
      travs: Object.keys(travs)
    };
  };

  /**
   * Provisional only - fetch both sets of departure and arrival airports
   * @param {Array<JetProvisionalTaskRequest>} provRequests
   * @param {JetFetchRequests} out 
   */
  const addAirports = function(provRequests, out = {}){
    const iatas = {};
    provRequests
      .forEach(taskReq => {
        taskReq.arrAirports.forEach(airpt => {
          iatas[airpt.airportCode] = true;
        });

        taskReq.depAirports.forEach(airpt => {
          iatas[airpt.airportCode] = true;
        });
      });

    out.airportIds = Object.keys(iatas);
  };

  
  /**
   * 
   * @param {JetProvisionalTaskRequest} taskRequest 
   * @param {boolean} dep
   * @return {Promise<void>} 
   */
  const fetchCustAddressProvisionalHoods = function(taskRequest, dep){
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


  /**
   * @param {JetFromViaTaskRequest} taskRequest 
   * @param {boolean} dep 
   * @return {Promise<void>}
   */
  const fetchCustAddressHood = function(taskRequest, dep){
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


  /**
   * 
   * @param {JetProvisionalTaskRequest} taskRequest 
   * @param {boolean} dep 
   * @return {Promise<void>}
   */
  const fetchExistAddressProvisionalHoods = function(taskRequest, dep){
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


  /**
   * 
   * @param {JetTaskRequestFromVia} taskRequest 
   * @param {boolean} dep 
   * @return {Promise<void>}
   */
  const fetchExistAddressHood = function(taskRequest, dep){
    const address = dep ? taskRequest.depCityLocation.address : taskRequest.arrCityLocation.address;
    const airport = dep ? taskRequest.via.DepAirport : taskRequest.via.ArrAirport;

    return address
      .findNeighborhood(airport)
      .then(hood => populateTaskHood(taskRequest,dep,hood,true));
  };

  /**
   * + Add hood.id to .task.[arr|dep]_neighborhood_id
   * + Add hood to .task.[Arr|Dep]Neighborhood
   * + Add hood to .[arr|dep]CityLocation but only if addToRequest is true
   * 
   * @param {JetTaskRequestFromVia} taskRequest 
   * @param {boolean} dep 
   * @param {JetNeighborhoodInstance} hood 
   */
  const populateTaskHood = function(taskRequest, dep, hood, addToRequest = false){
    if(dep){
      taskRequest.task.dep_neighborhood_id = hood ? hood.id : null;
      taskRequest.task.DepNeighborhood = hood;
      if(addToRequest) taskRequest.depCityLocation.hood = hood;
      
    } else {
      taskRequest.task.arr_neighborhood_id = hood ? hood.id : null;
      taskRequest.task.ArrNeighborhood = hood;
      if(addToRequest) taskRequest.arrCityLocation.hood = hood;
    }   
  };
  // END of INTERNAL FUNCTIONS -----------------------------------------------------------------------


  // PUBLIC METHODS ----------------------------------------------------------------------------------
  taskFetcher.provisionalInfos = function(userId, provRequests){
    const fetchRequests = baseFetchRequest(provRequests);
    addAirports(provRequests,fetchRequests);
    const addressRefs = getAddresses(provRequests);

    return Promise.all([
      models.handlers.fetch.fields(fetchRequests,{extend: ['airport']}),
      models.handlers.fetch.addresses(userId,addressRefs.users,addressRefs.travs)
    
    ]).then(([infos,addressInfos]) => {
      infos.aggloIdMap = invertListMap(infos.aggloMap,'id');
      infos.hoodIdMap = invertListMap(infos.hoodMap,'id');
      Object.assign(infos,addressInfos); // userAddressMap, travAddressMap, travMap
      infos.addressIdMap = {};
      return infos;
    });
  };

  
  taskFetcher.viaInfos = function(userId,fromViaRequests,userTrips,travMap = null){
    const fetchRequests = baseFetchRequest(fromViaRequests);
    const addressRefs = getAddresses(fromViaRequests);

    return Promise.all([
      models.handlers.fetch.fields(fetchRequests),
      models.handlers.fetch.addresses(userId,addressRefs.users,addressRefs.travs,travMap),
      models.Trip.createTripUserMap(userTrips)   
    
    ]).then(([infos,addressInfos,tripMaps]) => {
      infos.aggloIdMap = Object.assign(invertListMap(infos.aggloMap,'id'),tripMaps.aggloIdMap);
      infos.airportIdMap = tripMaps.airportIdMap;
      infos.hoodIdMap = invertListMap(infos.hoodMap,'id');
      Object.assign(infos,addressInfos); // userAddressMap, travAddressMap, travMap
      infos.addressIdMap = {};
      return {infos,tripMaps};
    });
  };


  taskFetcher.updateInfos = function(userId,all){
    const fetchRequests = baseFetchRequest(all);
    const addressRefs = getAddresses(all);

    return Promise.all([
      models.handlers.fetch.fields(fetchRequests),
      models.handlers.fetch.addresses(userId,addressRefs.users,addressRefs.travs)
    
    ]).then(([infos,addressInfos]) => {
      infos.aggloIdMap = invertListMap(infos.aggloMap,'id');
      infos.hoodIdMap = invertListMap(infos.hoodMap,'id');
      Object.assign(infos,addressInfos); // userAddressMap, travAddressMap, travMap
      
      infos.addressIdMap = Object.assign(
        invertListMap(addressInfos.userAddressMap,'id'),
        invertListMap(addressInfos.userAddressMap, 'id')
      );

      return infos;
    });
  };


  taskFetcher.existingInfos = function(infos,all,provisionals,fromVias){
    const viaIds = {};
    const missingAirportIds = {};
    const missingHoodIds = {};
    const missingAddressIds = {};
 
    all.forEach(taskReq => {
      const task = taskReq.task;
      if(task.dep_neighborhood_id && !infos.hoodIdMap[task.dep_neighborhood_id])
        missingHoodIds[task.dep_neighborhood_id] = true;

      if(task.arr_neighborhood_id && !infos.hoodIdMap[task.arr_neighborhood_id])
        missingHoodIds[task.arr_neighborhood_id] = true;

      if(task.dep_address_id && !infos.addressIdMap[task.dep_address_id])
        missingAddressIds[task.dep_address_id] = true;

      if(task.arr_address_id && !infos.addressIdMap[task.arr_address_id])
        missingAddressIds[task.arr_address_id] = true;

      if(task.via_id)
        viaIds[task.via_id] = true;

      task.TasksViasTravelers
        .filter(m => m.status !== HELP_STATUS.helpee)
        .forEach(m => viaIds[m.via] = true);

    });

    fromVias.forEach(taskReq => {
      const task = taskReq.task;
      if(task.dep_airport_id)
        missingAirportIds[task.dep_airport_id] = true;

      if(task.arr_airport_id)
        missingAirportIds[task.arr_airport_id] = true;
    });

    provisionals.forEach(taskReq => {
      const task = taskReq.task;
      taskReq.depAirports.forEach(entry => missingAirportIds[entry.airportCode] = true);
      taskReq.arrAirports.forEach(entry => missingAirportIds[entry.airportCode] = true);
      task.TasksAirports.forEach(taskAirpt => missingAirportIds[taskAirpt.airport_id] = true);
    });

    const aggloIdMap = {};
    return Promise.all([
      models.Via.createViaMap(Object.keys(viaIds),Object.keys(missingAirportIds)),
      models.Neighborhood.createHoodIdMap(Object.keys(missingHoodIds)),
      models.Airport.createExtendedAirportMap(Object.keys(missingAirportIds),aggloIdMap),
      models.Address.createAddressIdMap(Object.keys(missingAddressIds)),
    ]).then(([viaIdMap,missingHoodMap,missingAirportMap,missingAddressMap]) => {
      infos.viaIdMap = viaIdMap;
      infos.hoodIdMap = Object.assign(invertListMap(infos.hoodMap,'id'),missingHoodMap);
      infos.airportIdMap = missingAirportMap;
      infos.aggloIdMap = aggloIdMap;
      infos.addressIdMap = Object.assign(infos.addressIdMap,missingAddressMap);
    });
  };


  taskFetcher.fromVias = function(taskIds){
    return !taskIds.length
      ? Promise.resolve([])
      : models.Task.findAll({
        where: {id: {[Op.in]: taskIds}},
        attributes: models.queries.FETCH_UPDATE_FROMVIA_TASK.attributes,
        include: models.queries.FETCH_UPDATE_FROMVIA_TASK.include
      });
  };


  taskFetcher.provisionals = function(taskIds){
    return !taskIds.length
      ? Promise.resolve([])
      : models.Task.findAll({
        where: {id: {[Op.in]: taskIds}},
        attributes: models.queries.FETCH_UPDATE_PROVISIONAL_TASK.attributes,
        include: models.queries.FETCH_UPDATE_PROVISIONAL_TASK.include        
      });
  };


  taskFetcher.reviewInfos = function(assemblies,userId,travMap,potentialPax=[]){
    const airportIds = {};
    const hoodIds = {};
    const addressIds = {};
    const allTravelerIds = {};
    const viaIds = {};

    if(potentialPax.length > 0){
      potentialPax.forEach(pax => {
        viaIds[pax.via_id] = true;
        allTravelerIds[pax.traveler_id] = true;
      });
    }

    assemblies.forEach(assembly => {
      assembly.mapReferences(airportIds,hoodIds,addressIds,allTravelerIds);
      assembly.mapVias(viaIds);
    });

    /** @type {JetFetchRequests} */const fetchRequests = {
      airportIds: Object.keys(airportIds),
      hoodIds: Object.keys(hoodIds),
      addressIds: Object.keys(addressIds),
      travelerIds: Object.keys(allTravelerIds),
      viaIds: Object.keys(viaIds)
    };

    return Promise.all([
      models.handlers.fetch.fields(fetchRequests,{travMap, extend: ['airport']}),
      models.UsersAddresses.findUserAddresses(userId,Object.keys(addressIds)),
      models.TravelersAddresses.findTravelersAddresses(Object.keys(travMap),Object.keys(addressIds))
    ])
      .then(([infos,userAddresses,travelersAddresses]) => {
        infos.aggloIdMap = {};

        infos.userAddressMap = {};
        infos.travAddressMap = {};

        // add a UsersAddresses object to the addresses, and creates a map by address id
        // (1) Task.createResponse looks up all entries of the map to find a match on the address id
        // (2) retrieves address.UsersAddresses to populate userRef field
        
        // Here creates a map with the same logic from the userAddress instances associated with the logged user
        userAddresses.forEach(userAddress => {
          const address = infos.addressIdMap[userAddress.address_id];
          address.UsersAddresses = userAddress;
          infos.userAddressMap[userAddress.id] = address;
        });

        // see above for travelerAddressMap
        travelersAddresses.forEach(travAddress => {
          const address = infos.addressIdMap[travAddress.address_id];
          address.TravelersAddresses = travAddress;
          infos.travAddressMap[travAddress.id] = address;
        });

        return infos;
      });
  };


  taskFetcher.provisionalHoods = function(provisionals){
    const depCustomAddressReqs = provisionals
      .filter(taskReq => taskReq.depCityLocation && taskReq.depCityLocation.customAddress);

    const arrCustomAddressReqs = provisionals
      .filter(taskReq => taskReq.arrCityLocation && taskReq.arrCityLocation.customAddress);

    const depMissingHoodReqs = provisionals
      .filter(taskReq => taskReq.depCityLocation && !taskReq.depCityLocation.hood && !taskReq.depCityLocation.customAddress);

    const arrMissingHoodReqs = provisionals
      .filter(taskReq => taskReq.arrCityLocation && !taskReq.arrCityLocation.hood && !taskReq.arrCityLocation.customAddress);

    return Promise.all([
      ...depCustomAddressReqs.map(taskReq => fetchCustAddressProvisionalHoods(taskReq,true)),
      ...arrCustomAddressReqs.map(taskReq => fetchCustAddressProvisionalHoods(taskReq,false)),
      ...depMissingHoodReqs.map(taskReq => fetchExistAddressProvisionalHoods(taskReq,true)),
      ...arrMissingHoodReqs.map(taskReq => fetchExistAddressProvisionalHoods(taskReq,false)) 
    ]);
  };


  taskFetcher.boundHoods = function(fromVias){
    const depCustomAddressReqs = fromVias
      .filter(taskReq => taskReq.depCityLocation && taskReq.depCityLocation.customAddress);

    const arrCustomAddressReqs = fromVias
      .filter(taskReq => taskReq.arrCityLocation && taskReq.arrCityLocation.customAddress);

    const depMissingHoodReqs = fromVias
      .filter(taskReq => taskReq.depCityLocation && !taskReq.depCityLocation.hood && !taskReq.depCityLocation.customAddress);

    const arrMissingHoodReqs = fromVias
      .filter(taskReq => taskReq.arrCityLocation && !taskReq.arrCityLocation.hood && !taskReq.arrCityLocation.customAddress);

    // if the dep or arr hoods were matched, populates the task in taskRequest.task directly
    fromVias
      .filter(taskReq => taskReq.depCityLocation && taskReq.depCityLocation.hood)
      .forEach(taskReq => populateTaskHood(taskReq,true,taskReq.depCityLocation.hood));

    fromVias
      .filter(taskReq => taskReq.arrCityLocation && taskReq.arrCityLocation.hood)
      .forEach(taskReq => populateTaskHood(taskReq,false,taskReq.arrCityLocation.hood));

    return Promise.all([
      ...depCustomAddressReqs.map(taskReq => fetchCustAddressHood(taskReq,true)),
      ...arrCustomAddressReqs.map(taskReq => fetchCustAddressHood(taskReq,false)),
      ...depMissingHoodReqs.map(taskReq => fetchExistAddressHood(taskReq,true)),
      ...arrMissingHoodReqs.map(taskReq => fetchExistAddressHood(taskReq,false))
    ]);
  };

  taskFetcher.extendedAddresses = function(infos){
    const addressIds = infos.addressIdMap ? Object.keys(infos.addressIdMap) : [];

    return addressIds.length
      ? models.Address.findAll({
        where: {id: {[Op.in]: addressIds}},
        attributes: models.queries.FETCH_ASSOCIATED_ADDRESS.attributes,
        include: models.queries.FETCH_ASSOCIATED_ADDRESS.include
      }).then(addresses => {
        addresses.forEach(address => infos.addressIdMap[address.id] = address);
      })
      : Promise.resolve();
  };


  return taskFetcher;
};