/** @param {JetModels} models */
module.exports = function(models){
  /** @type {JetRiderFetcher} */
  const riderFetcher = {};

  // INTERNAL FUNCTIONS ----------------------------------------------------------------------------
  /** 
   * @param {Array<JetRiderRequest>} riderRequests
   * @return {JetFetchRequests}*/
  const createFetchRequest = function(riderRequests){

    /** @type {JetFetchRequests} */const fetchRequests = {
      aggloNames: riderRequests
        .filter(req => typeof req.cityLocation.area.aggloName === 'string')
        .map(req => req.cityLocation.area.aggloName),

      hoodNames: riderRequests
        .filter(req => typeof req.cityLocation.area.neighborhoodName === 'string')
        .map(req => req.cityLocation.area.neighborhoodName),

      userAddressIds: riderRequests
        .filter(req => typeof req.cityLocation.marker.userRef === 'string')
        .map(req => req.cityLocation.marker.userRef),

      travAddressIds: riderRequests
        .filter(req => typeof req.cityLocation.marker.travelerRef === 'string')
        .map(req => req.cityLocation.marker.travelerRef)
    };

    return fetchRequests;
  };

  /** 
   * @param {Array<JetRiderFullRequest>} riderRequests
   * @return {JetFetchRequests}*/
  const createFullFetchRequest = function(riderRequests){
    const fetchRequests = createFetchRequest(riderRequests);

    const airportCodes = {};
    riderRequests.forEach(req => airportCodes[req.airportLocation.airportCode] = true);
    fetchRequests.airportIds= [...Object.keys(airportCodes)];
    fetchRequests.terminalKeys = [];
    fetchRequests.userTravIds = [];

    riderRequests.forEach(request => {
      if(request.airportLocation.airportCode && request.airportLocation.terminalCode){
        const termKey = request.airportLocation.airportCode.toUpperCase() + request.airportLocation.terminalCode.toLowerCase();
        fetchRequests.terminalKeys.push(termKey);
      }

      request.travelers
        .filter(travRequest => travRequest.userRef)
        .forEach(travRequest => {
          fetchRequests.userTravIds.push(travRequest.userRef);
        });
    });

    return fetchRequests;
  };


  /** 
   * @param {Array<JetRiderInstance>} riders
   * @param {JetFetchRequets} fetchRequests*/
  const addRidersInfos = function(riders,fetchRequests){
    fetchRequests.addressIds= riders
      .filter(rider => !!rider.address_id)
      .map(rider => rider.address_id);

    fetchRequests.hoodIds = riders
      .filter(rider => rider.neighborhood_id)
      .map(rider => rider.neighborhood_id);

    fetchRequests.terminalIds = riders
      .filter(rider => typeof rider.terminal_id === 'number')
      .map(rider => rider.terminal_id);

    fetchRequests.viaIds = riders
      .filter(rider => !!rider.via_id)
      .map(rider => rider.via_id);
  };
  // END of INTERNAL FUNCTIONS -----------------------------------------------------------------------




  // PUBLIC METHODS ----------------------------------------------------------------------------------
  riderFetcher.infos = function(userId, riderRequests){
    const requests = createFetchRequest(riderRequests);
    return models.handlers.fetch.fields(requests, {userId, extend: ['airport']});
  };

  riderFetcher.fullInfos = function(userId, riderRequests){
    const requests = createFullFetchRequest(riderRequests);
    return models.handlers.fetch.fields(requests,{userId, extend: ['airport']});
  };

  riderFetcher.updateInfos = function(userId,riders,updateRequests){
    const requests = createFullFetchRequest(updateRequests);
    addRidersInfos(riders,requests);

    return models.handlers.fetch.fields(requests,{userId, extend: ['airport']});
  };

  return riderFetcher;
};