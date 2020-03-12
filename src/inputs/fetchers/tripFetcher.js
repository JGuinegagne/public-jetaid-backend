/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetTripFetcher} */
  const tripFetcher = {};

  // INTERNAL FUNCTIONS ------------------------------------------------------------------------------
  /** 
   * @param {Array<JetTripRequest>} tripRequests 
   * @return {JetFetchRequests} */
  const createFetchRequest = function(tripRequests){

    // Setup fetch request mandatory fields
    /** @type {JetFetchRequests} */ 
    const fetchRequests = {
      airportIds: [],
      userTravIds: []
    };

    tripRequests.forEach(tripRequest => {

      // -- #1-1: for each trip, retrieves airport, terminal, travelers, airline (iata & icao) and flight and save it
      // -- Next step will check if these airports, terminals, travelers, airlines and flights exist
      // -- Do the same for each via within each trip
      tripRequest.vias.forEach(via => {
        const depAirport = via.dep.airportCode;
        const arrAirport = via.arr.airportCode;
        const depTerminalKey = via.dep.terminalCode ? depAirport.toUpperCase() + via.dep.terminalCode.toLowerCase() : null;
        const arrTerminalKey = via.arr.terminalCode ? arrAirport.toUpperCase() + via.arr.terminalCode.toLowerCase() : null;
        
        let foundAirlineKey = false;
        if(via.flight && typeof via.flight.airlineCode === 'string'){
          const code = via.flight.airlineCode.toUpperCase();
          via.flight.airlineCode = code;

          if(/^[A-Z]{2}$/.test(code)){
            via.flight.keyType = 'iata';
            if(fetchRequests.airlineIatas)
              fetchRequests.airlineIatas.push(code);
            else
              fetchRequests.airlineIatas= [code];

            foundAirlineKey = true;

          } else if (/^[A-Z]{3}$/.test(code)){
            via.flight.keyType = 'icao';
            if(fetchRequests.airlineIcaos)
              fetchRequests.airlineIcaos.push(code);
            else
              fetchRequests.airlineIcaos = [code];

            foundAirlineKey = true;
          }
        }
  
        if(!foundAirlineKey && via.flight && typeof via.flight.airlineName === 'string'){
          const name = via.flight.airlineName.toLowerCase();
          via.flight.keyType = 'name';
          if(fetchRequests.airlineNames)
            fetchRequests.airlineNames.push(name);
          else
            fetchRequests.airlineNames = [name];
        }
  
        if(via.travelers && via.travelers.length){
          via.travelers.forEach(entry => {
            if(entry.ref && entry.ref.toString('hex') === entry.ref)
              fetchRequests.userTravIds.push(entry.ref);
          });
        }
        
        fetchRequests.airportIds.push(depAirport);
        fetchRequests.airportIds.push(arrAirport);  
  
        if(depTerminalKey){
          if(fetchRequests.terminalKeys)
            fetchRequests.terminalKeys.push(depTerminalKey);
          else
            fetchRequests.terminalKeys = [depTerminalKey];

        }
  
        if(arrTerminalKey){
          if(fetchRequests.terminalKeys)
            fetchRequests.terminalKeys.push(arrTerminalKey);
          else
            fetchRequests.terminalKeys = [arrTerminalKey];
        }
      });
    });
  
    return fetchRequests;
  };

  // END of INTERNAL FUNCTIONS -----------------------------------------------------------------------

  // PUBLIC METHODS ----------------------------------------------------------------------------------
  tripFetcher.infos = function(tripRequests, userId){
    const fetchRequest = createFetchRequest(tripRequests);
    return models.handlers.fetch.fields(fetchRequest,{userId});
  };


  

  return tripFetcher;
};