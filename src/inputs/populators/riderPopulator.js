const moment = require('moment');

const invertMap = require('../../utils/commonFunctions').invertMap;
const nameToKey = require('../../utils/commonFunctions').convertNameToKey;

/** @param {JetModels} models */
module.exports = function(models){
  
  /** @type {JetRiderPopulator} */
  const riderPopulator = {};

  riderPopulator.fullTravelers = function(riderRequest, infos, index, errors){
    const userTravMap = infos.userTravMap;
    return riderRequest.travelers.every((travReq,tNum) => {
      travReq.userTraveler = userTravMap[travReq.userRef];
      if(!travReq.userTraveler){
        errors.errors[`riderRequest${index} traveler${tNum}`] = 'user-traveler id could not be matched to logged user';
        return false;
      }
      return true;
    });
  };
  
  
  riderPopulator.viaTravelers = function(riderRequest, infos, index, errors){
    const refVia = riderRequest.refVia;
    return riderRequest.travelers.every((travReq, ind) => {
  
      const viaTrav = refVia.ViasTravelers.find(pax => pax.id === travReq.viaRef);
      if(!viaTrav){
        errors.errors[`riderRequest${index}-traveler${ind}`] = 'ViaRider association id is not valid';
        return false;
      }
      travReq.viaTraveler = viaTrav;
      return true;
    });
  };
  
  
  riderPopulator.cityStop = function(riderRequest,infos,index,errors,findHood){
    // -- check #1: either by providing the ref to an existing address through a travelerAddress ref
    if(riderRequest.cityLocation.marker.travelerRef){
      const address = infos.travAddressMap[riderRequest.cityLocation.marker.travelerRef];
      if(address){
        riderRequest.cityLocation.address = address;
        riderRequest.cityLocation.customAddress = false;
      } else {
        errors.errors[`riderRequest${index}`] = `Referenced address ${riderRequest.cityLocation.marker.travelerRef} could not be found`;
        return false;
      }
  
      // -- check #2: or by providing the ref to an existing address through a userAddress ref
    } else if(riderRequest.cityLocation.marker.userRef){
      const address = infos.userAddressMap[riderRequest.cityLocation.marker.userRef];
      if(address){
        riderRequest.cityLocation.address = address;
        riderRequest.cityLocation.customAddress = false;
      } else {
        errors.errors[`riderRequest${index}`] = `Referenced address ${riderRequest.cityLocation.marker.useRef} could not be found`
            + ' or was not associated to the logged user';
        return false;
      }          
  
      // -- check #3: or by providing the lat and longitude of the address directly
    } else if(typeof riderRequest.cityLocation.location.latitude === 'number'
        && typeof riderRequest.cityLocation.location.longitude === 'number'){
      const address = models.Address.buildFromFields(riderRequest.cityLocation);
      if(address){
        riderRequest.cityLocation.address = address;
        riderRequest.cityLocation.customAddress = true;
      } else {
        errors.errors[`riderRequest${index}`] = 'Custom address is not valid';
        return false;
      }
  
      // -- check #4: or finally by providing a pair agglo/neighborhood directly
    } else if(typeof riderRequest.cityLocation.area.neighborhoodName === 'string'
        && typeof riderRequest.cityLocation.area.aggloName === 'string'){
      const hood = findHood(riderRequest,index,errors);
      riderRequest.cityLocation.customAddress = false;
      if(!hood){
        return false;
      } else {
        riderRequest.cityLocation.hood = hood;
      }
  
    } else {
      errors.errors[`riderRequest${index}`] = 'No valid address was provided';
      return false;
    }
  
    return true;
  };
  
  
  riderPopulator.fromViaRequests = function(vias,riderRequests,infos,errors){
    /** 
     * @param {JetRiderFromViaRequest} riderViaRequest 
     * @param {number} index
     * @param {JetErrors} errors
     * @return {JetNeighborhoodInstance}*/
    const findHood = function(riderViaRequest, index, errors){
      const aggloName = riderViaRequest.cityLocation.area.aggloName;
      const hoodName = riderViaRequest.cityLocation.area.neighborhoodName;
  
      const aggloKey = nameToKey(aggloName);
      const hoodKey = nameToKey(hoodName);
      const via = riderViaRequest.refVia;
      const airport = riderViaRequest.toward === 'city' ? via.ArrAirport : via.DepAirport;
  
      const potentialAgglos = infos.aggloMap[aggloKey];
      const potentialHoods = infos.hoodMap[hoodKey];
  
      if(!potentialAgglos || !potentialAgglos.length){
        errors.errors[`riderRequest${index}`] 
            = `Agglo "${aggloName}" could not be found`;
        return null;          
      }
  
      if(!potentialHoods || !potentialHoods.length){
        errors.errors[`riderRequest${index}`] 
            = `Neighborhood "${hoodName}" could not be found`;
        return null;
      }
        
      if(!airport || !airport.Agglos || !airport.Agglos.length){
        errors.errors[`riderRequest${index}`] 
            = 'Referenced via does not have an airport entry or its airport is not associated with any agglomeration';
        return null;
      }
          
      const airptAggloIds = airport.Agglos.map(agglo => agglo.id);
      const eligibleAggloIds = potentialAgglos
        .map(agglo => agglo.id)
        .filter(aggloId => airptAggloIds.includes(aggloId));
  
      if(!eligibleAggloIds.length){
        errors.errors[`riderRequest${index}`] 
            = `Agglo "${riderViaRequest.cityLocation.area.aggloName}" is not associated with airport "${airport.name}"`;
        return null;
      }
  
      const eligibleHoods = potentialHoods
        .filter(hood => eligibleAggloIds.includes(hood.agglo_id));
  
      if(eligibleHoods.length){
        // small risk here: two agglos with same name, associated to same airport, with two hoods of same name --> unlikely
        return eligibleHoods[0];
      } else {
        errors.errors[`riderRequest${index}`] = `Agglo "${riderViaRequest.cityLocation.area.aggloName}" is not associated `
              + `with agglo "${riderViaRequest.cityLocation.area.aggloName}"`;
        return null;
      } 
    };
  
      /** Map viaOrdinal -> [JetRiderInstance] for POST/ADD ROUTE
       * @type {{[viaOrdinal: string]: Array<JetRiderInstance>}} */
    const existingRidersMap = {};
    vias.forEach(via => {
      existingRidersMap[via.ordinal] = via.Riders;
    });
  
    // Performs riderRequests checks vs vias fetched from the database
    // If every viaRequest passes, links the RiderRequest to its via
    return riderRequests.every((riderRequest, index) => {
      const viaOrdinal = riderRequest.viaOrdinal;
      const refVia = vias.find(via => via.ordinal === viaOrdinal);
  
      // POST/ADD CHECK #1: verify that the referenced via exists for this trip
      if(!refVia){
        errors.errors[`riderRequest${index}`] = `No via could be found with ordinal: ${viaOrdinal}`;
        return false;
      }
  
      // -- links the referenced via instance to the viaRequest.
      riderRequest.refVia = refVia;
  
  
      // POST/ADD CHECK #2: verify that there is no rider instance associated to the via/traveler pair already
      const currentTravelerIds = refVia.ViasTravelers.map(pax => pax.traveler_id);
      const existingRiders = existingRidersMap[viaOrdinal];
  
      if(existingRiders && existingRiders.some(rider => {
        return rider.TravelerLinks.some(riderTrav => currentTravelerIds.includes(riderTrav.traveler_id));
      })){
        errors.errors[`riderRequest${index}`] = 'At least one Riders instance with the same traveler(s) already exists';
        return false;
      }
  
      // CHECK #3: verify that all the travelers to be linked to the Riders instance are associated to the referenced via
      if(!riderPopulator.viaTravelers(riderRequest, infos, index, errors)){
        return false;
      }
  
      // CHECK #4: verify that a valid location was provided
      if(!riderPopulator.cityStop(riderRequest,infos,index,errors,findHood)){
        return false;
      }
  
      return true;
    });
  };
  
    
  riderPopulator.fullRequests = function(riderRequests,infos,errors){
    /** 
     * @param {JetRiderFullRequest} riderRequest
     * @param {number} index
     * @param {JetErrors} errors
     * @return {JetNeighborhoodInstance}*/
    const findHood = function(riderRequest, index, errors){
      const aggloName = riderRequest.cityLocation.area.aggloName;
      const hoodName = riderRequest.cityLocation.area.neighborhoodName;
  
      const aggloKey = nameToKey(aggloName);
      const hoodKey = nameToKey(hoodName);
      const airport = riderRequest.airportLocation.airport;
  
      const potentialAgglos = infos.aggloMap[aggloKey];
      const potentialHoods = infos.hoodMap[hoodKey];
  
      if(!potentialHoods || !potentialHoods.length){
        errors[`riderRequest${index}`] = `Neighborhood "${riderRequest.cityLocation.area.neighborhoodName}" could not be found`;
        return null;
      }
      
      if(!potentialAgglos || !potentialAgglos.length){
        errors[`riderRequest${index}`] = `Agglo "${riderRequest.cityLocation.area.aggloName}" could not be found`;
        return null;          
      }
        
      const airptAggloIds = airport.Agglos.map(agglo => agglo.id);
      const eligibleAggloIds = potentialAgglos
        .map(agglo => agglo.id)
        .filter(aggloId => airptAggloIds.includes(aggloId));
  
      if(!eligibleAggloIds.length){
        errors[`riderRequest${index}`] = `Agglo "${riderRequest.cityLocation.area.aggloName}" is not associated with airport "${airport.name}"`;
        return null;
      }
  
      const eligibleHoods = potentialHoods
        .filter(hood => eligibleAggloIds.includes(hood.agglo_id));
  
      if(eligibleHoods.length){
        // potential risk here: if two agglo with same name, associated to same airport, with two hoods with same name --> unlikely
        return eligibleHoods[0]; 
      } else {
        errors[`riderRequest${index}`] = `Agglo "${riderRequest.cityLocation.area.aggloName}" is not associated `
            + `with agglo "${riderRequest.cityLocation.area.aggloName}"`;
        return null;
      } 
    };
  
      // Performs riderRequests checks vs entries fetched from the database
      // If every rider request passes, fetches the address data
    return riderRequests.every((riderRequest, index) => {
  
      // verify that a valid airport was provided
      const airport = infos.airportIdMap[riderRequest.airportLocation.airportCode];
      if(!airport){
        errors[`riderRequest${index}`] = `Referenced airport ${riderRequest.airportLocation.airportCode} could not be found`;
        return false;
      } else
        riderRequest.airportLocation.airport = airport;
  
  
        // verify that a valid terminal was provided, otherwise set it to null (non-breaking)
      const terminalCode = riderRequest.airportLocation.terminalCode;
      const terminalKey = terminalCode ? airport.id.toUpperCase() + terminalCode.toLowerCase() : null;
  
      if(terminalKey){
        const terminal = infos.terminalMap[terminalKey];
        if(!terminal){
          errors.errors[`riderRequest${index}`] = `Referenced terminal ${riderRequest.airportLocation.terminalCode} could not be found`;
          return false;
        
        } else if(terminal.airport_id !== riderRequest.airportLocation.airport.id){
          errors.errors[`riderRequest${index}`] 
              = `Referenced terminal was found but was not found to be within the airport ${riderRequest.airportLocation.airportCode}.`;
          return false;
        }
        riderRequest.airportLocation.terminal = terminal;
        
      } else {
        riderRequest.airportLocation.terminal = null;
      }
  
      // verify that valid travelers, all associated with the users, where provided
      if(!riderPopulator.fullTravelers(riderRequest,infos,index,errors)){
        return false;
      }
  
      // verify that a valid location was provided
      if(!riderPopulator.cityStop(riderRequest,infos,index,errors,findHood)){
        return false;
      }
  
      return true;
    });
  };
  
  
  riderPopulator.updateRequests = function(riderRequests,infos,errors){
    /** @param {number} riderInd
       * @param {number} aggloId
       * @param {string} hoodName*/
    const findHood = function(riderInd, aggloId, hoodName){
      const hoodKey = nameToKey(hoodName);
      const potentialHoods = infos.hoodMap[hoodKey];
  
      if(typeof aggloId !== 'number' || !potentialHoods || !potentialHoods.length){
        errors.errors[`rider${riderInd} neighborhood`] = 'Current neighborhood entry was null or not associated to any agglo.';
        return null;
      }
      const hood = potentialHoods.find(hood => hood.agglo_id === aggloId);
        
      if(!hood){
        errors.errors[`rider${riderInd} hood`] = `No neighborhood ${hoodName} could be found within the rider's agglo`;
      }
      return hood;
    };
  
    const userTravMap = infos.travMap
      ? invertMap(infos.travMap,'id')
      : infos.userTravMap
        ? infos.userTravMap
        : {};

    let changeScore = 0;
  
    return riderRequests.every((riderRequest, ind) => {  
      const rider = riderRequest.rider;
      rider.populate(['neighborhood','airport'],infos);
  
      const via = rider.via_id ? infos.viaIdMap[rider.via_id] : null;
      const curAddress = rider.address_id ? infos.addressIdMap[rider.address_id] : null;
      const curHood = infos.hoodIdMap[rider.neighborhood_id];
  
      // ---> check and update startTime
      if(riderRequest.startTime){
        const reqStartTime = moment(riderRequest.startTime,'HH:mm');
        const curStartTime = moment(rider.dep_time,'HH:mm');
  
        if(!reqStartTime.isSame(curStartTime)){
          if(via){
            const prevDepTime = moment(rider.dep_time,'HH:mm');
            const viaStartTime = rider.toward === 'city' 
              ? moment(via.arr_time,'HH:mm').format('HH:mm') 
              : moment(via.dep_time,'HH:mm').format('HH:mm');
            if(rider.toward === 'city'){
              if(reqStartTime.isAfter(moment(via.arr_time,'HH:mm'))){
                rider.dep_time = reqStartTime.format('HH:mm');
              } else {
                errors[`rider ${ind} start time`] = `Rider start time cannot be before via arrival time (${viaStartTime})`;
                return false;
              }
            } else {
              if(reqStartTime.isBefore(moment(via.dep_time,'HH:mm'))){
                rider.dep_time = reqStartTime.format('HH:mm');
              } else {
                errors[`rider ${ind} start time`] = `Rider start time cannot be before via departure time (${viaStartTime})`;
                return false;
              }
            }
            changeScore += models.Rider.getStartTimeChangeScore(moment(rider.dep_time,'HH:mm').diff(prevDepTime,'m'));
  
          } else {
            changeScore += models.Rider.getStartTimeChangeScore(moment(reqStartTime,'HH:mm').diff(rider.dep_time,'m'));
            rider.dep_time = reqStartTime.format('HH:mm');
          }
        }
      }
  
      // ---> populate airport
      const airportCode = rider.airport_id.toUpperCase();
      riderRequest.airportLocation.airport = infos.airportIdMap[rider.airport_id];
  
      // ---> check and update terminal
      const terminalCode = riderRequest.airportLocation.terminalCode;
      const terminalKey = terminalCode && airportCode ? airportCode.toUpperCase() + terminalCode.toLowerCase() : null;
  
  
      if(terminalKey){
        const terminal = infos.terminalMap[terminalKey];
        if(!terminal){
          errors.errors[`riderRequest${ind}`] = `Referenced terminal ${riderRequest.airportLocation.terminalCode} could not be found`;
          return false;
        
        } else if(terminal.airport_id !== rider.airport_id){
          errors.errors[`riderRequest${ind}`] 
              = `Referenced terminal was found but was not found to be within the airport ${riderRequest.airportLocation.airportCode}.`;
          return false;
        }
        riderRequest.airportLocation.terminal = terminal;
        riderRequest.rider.terminal_id = terminal.id;
        
      } else {
        riderRequest.airportLocation.terminal = null;
      }
  
      // ---> check and update travelers
      if(!riderRequest.travelers.every((travReq, travInd) => {
        if(travReq.viaRef){
          if(via){
            const pax = via.ViasTravelers.find(pax => pax.id === travReq.viaRef);
            if(!pax){
              errors.errors[`rider${ind} traveler${travInd}`] = 'Traveler viaRef could not be matched to the via associated to this rider';
              return null;
            }
            travReq.viaTraveler = pax;
            return true;
  
          } else {
            errors.errors[`rider${ind} traveler${travInd}`] = 'Traveler references a via Ref but no via is associated to this rider';
            return null;
          }
  
        } else if(travReq.userRef){
          const userTrav = userTravMap[travReq.userRef];
          if(!userTrav){
            errors.errors[`rider${ind} traveler${travInd}`] = 'User-traveler ref could not be found for the logged user';
            return null;
          }
          travReq.userTraveler = userTrav;
          return true;
        }
        errors.errors[`rider${ind} traveler${travInd}`] = 'Neither a viaRef nor a userRef was provided to identify the traveler';
        return false;
      })){
        return false;
      }
  
      changeScore += models.Rider.getTravChangeScore(rider,riderRequest);
  
  
      // --> check and update address (starts with default settings)
      riderRequest.cityLocation.address = curAddress;
      riderRequest.cityLocation.customAddress = false;
      riderRequest.cityLocation.hood = curHood;
  
      // ----> option #1: update the address based on a userRef
      if(riderRequest.cityLocation.marker.userRef){
        const newAddress = infos.userAddressMap[riderRequest.cityLocation.marker.userRef];
  
        if(newAddress){
          riderRequest.cityLocation.address = newAddress;
          riderRequest.cityLocation.customAddress = false;
          riderRequest.cityLocation.hood = newAddress.id !==rider.address_id 
            ? null : curHood; // <-- if repeat same address, keep hood
            
        } else {
          return false;
        }
      } 
        
      // ----> option #2: update the address based on a travelerRef
      else if (riderRequest.cityLocation.marker.travelerRef) {
        const newAddress = infos.travAddressMap[riderRequest.cityLocation.marker.travelerRef];
  
        if(newAddress){
          riderRequest.cityLocation.address = newAddress;
          riderRequest.cityLocation.customAddress = false;
          riderRequest.cityLocation.hood = newAddress.id !==rider.address_id 
            ? null : curHood; // <-- if repeat same address, keep hood
            
        } else {
          return false;
        }
      }
  
      // ----> option #3: unlinks the address and replaces by a neighborhood
      else if(riderRequest.useHoodOnly){
        const hoodName = riderRequest.cityLocation.area.neighborhoodName;
        const newHood = findHood(ind,curHood.agglo_id,hoodName);
  
        if(newHood){
          riderRequest.cityLocation.address = null;
          riderRequest.cityLocation.customAddress = false;
          riderRequest.cityLocation.hood = newHood;
        } else {
          return false; // <-- error is handled by findHood
        }
      }
  
      // ----> option #4: updates the address field and indicates that the city/state/country needs updating
      else if(!riderRequest.useHoodOnly){
  
        if(curAddress){
          if(curAddress.updateFromFields(riderRequest.cityLocation)){
            riderRequest.cityLocation.address = curAddress;
            riderRequest.cityLocation.customAddress = true;
            riderRequest.cityLocation.hood = null;  
          }
        } else {
          riderRequest.cityLocation.address = models.Address.buildFromFields(riderRequest.cityLocation);
          riderRequest.cityLocation.customAddress = true;
          riderRequest.cityLocation.hood = null;
        }
      }
  
      // --> check and update seat requirements
      const reqs = riderRequest.requirements;
      const travCount = riderRequest.travelers.length;
  
      if(typeof reqs.babySeatCount === 'number' && Number.isInteger(reqs.babySeatCount)){
        rider.baby_seat_count = Math.max(reqs.babySeatCount, 0);
      }
  
      if(typeof reqs.seatCount === 'number' && Number.isInteger(reqs.seatCount)){
        rider.seat_count = Math.max(reqs.seatCount, travCount + rider.baby_seat_count);
      } else if(rider.seat_count < travCount+ rider.baby_seat_count){
        rider.seat_count = travCount + rider.baby_seat_count;
      }
  
      if(typeof reqs.luggageCount === 'number' && Number.isInteger(reqs.luggageCount)){
        rider.luggage_count = Math.max(reqs.luggageCount, 0);
      }
  
      if(typeof reqs.sportEquipCount === 'number' && Number.isInteger(reqs.sportEquipCount)){
        rider.sport_equip_count = Math.max(reqs.sportEquipCount, 0);
      }

      // --> check and update preferences
      const preferences = riderRequest.preferences;

      if(typeof preferences.ridePref === 'string')
        rider.pref = preferences.ridePref;
  
      riderRequest.changeScore = changeScore;
  
      return true;
    });
  };
  
  
  /** @param {JetRiderFromViaRequest} request*/
  const findMissingHoodFromVia = function(request){
    const rider = request.rider;
    const via = request.refVia;
      
    if(!via){
      return Promise.reject('Rider: Cannot find a neighborhood from a null refVia instance');
    }
      
    const address = request.cityLocation.address;
    if(!address){
      return Promise.reject('Rider: Cannot find a neighborhood from a null address instance');
    }
      
    const airport = request.toward === 'city' ? request.refVia.ArrAirport : request.refVia.DepAirport;
    if(!airport){
      return Promise.reject('Rider: Cannot find a neighborhood from a null airport instance');        
    }

    return address
      .findNeighborhood(airport)
      .then(hood => {
        request.cityLocation.hood = hood;
        rider.neighborhood_id = hood ? hood.id : null;
        rider.Neighborhood = hood;
      });
  };
  
  
  
  riderPopulator.missingHoodFromVia = function(requests){
    const customAddressReqs = requests
      .filter(riderReq => riderReq.cityLocation.customAddress);
  
    const missingHoodReqs = requests
      .filter(riderReq => !riderReq.cityLocation.hood && !riderReq.cityLocation.customAddress);
  
    return Promise.all([
      ...missingHoodReqs.map(findMissingHoodFromVia),
      ...customAddressReqs.map(riderRequest => {
        return riderRequest.cityLocation.address
          .findCountryStateCity(riderRequest.cityLocation.details)
          .then(() => findMissingHoodFromVia(riderRequest));
      })
    ]);
  };
      
  
  /** @param {JetRiderFullRequest} request*/
  const findMissingHoodFromFull = function(request){
    const rider = request.rider;
        
    const address = request.cityLocation.address;
    if(!address){
      return Promise.reject('Rider: Cannot find a neighborhood from a null address instance');
    }
      
    const airport = request.airportLocation.airport;
    if(!airport){
      return Promise.reject('Rider: Cannot find a neighborhood from a null airport instance');        
    }
      
    return address
      .findNeighborhood(airport)
      .then(hood => {
        request.cityLocation.hood = hood;
        rider.neighborhood_id = hood ? hood.id : null;
        rider.Neighborhood = hood;
      });
  };
  
  riderPopulator.missingHoodFromFull = function(requests){
    const customAddressReqs = requests
      .filter(riderReq => riderReq.cityLocation.customAddress);
  
    const missingHoodReqs = requests
      .filter(riderReq => !riderReq.cityLocation.hood && !riderReq.cityLocation.customAddress);
  
  
    return Promise.all([
      ...missingHoodReqs.map(findMissingHoodFromFull),
      ...customAddressReqs.map(riderRequest => {
        return riderRequest.cityLocation.address
          .findCountryStateCity(riderRequest.cityLocation.details)
          .then(() => findMissingHoodFromFull(riderRequest));
      })
    ]);
  };
  
    
  /** @param {JetRiderUpdateRequest} request*/
  const findMissingHoodUpdate = function(request){
    const rider = request.rider;
          
    const address = request.cityLocation.address;
    if(!address){
      return Promise.reject('Rider: Cannot find a neighborhood from a null address instance');
    }
        
    const airport = request.airportLocation.airport;
    if(!airport){
      return Promise.reject('Rider: Cannot find a neighborhood from a null airport instance');        
    }
        
    return address
      .findNeighborhoodWithinAgglo(rider.Neighborhood.agglo_id)
      .then(hood => {
        request.cityLocation.hood = hood;
        rider.neighborhood_id = hood ? hood.id : null;
        rider.Neighborhood = hood;
      });
  };
  
  riderPopulator.missingHoodUpdate = function(requests){
    const customAddressReqs = requests
      .filter(riderReq => riderReq.cityLocation.customAddress);
  
    const missingHoodReqs = requests
      .filter(riderReq => !riderReq.cityLocation.hood && !riderReq.cityLocation.customAddress);
  
    return Promise.all([
      ...missingHoodReqs.map(findMissingHoodUpdate),
      ...customAddressReqs.map(riderRequest => {
        return riderRequest.cityLocation.address
          .findCountryStateCity(riderRequest.cityLocation.details)
          .then(() => findMissingHoodUpdate(riderRequest));
      })
    ]);
  };

  return riderPopulator;
};