const invertMap = require('../../utils/commonFunctions').invertMap;

/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetTripPopulator} */
  const tripPopulator = {};

  // INTERNAL METHODS ------------------------------------------------------------------------------------
  /**
   * @param {JetTripInstance} trip 
   * @param {JetViaRequest} viaRequest 
   * @return {JetViaInstance}*/
  const findVia = function(trip, viaRequest){
    const eligibleVias = [];
    trip.vias.forEach(via => {
      if(via.matchesRequest(viaRequest)){
        eligibleVias.push(via);
      }
    });

    if(eligibleVias.length ===1){ // size=1 --> returns it 
      return eligibleVias[0];
  
    } else if(!eligibleVias.length){ // size=0 --> returns null
      return null;
  
    } else { // else, returns the closest match in terms of ordinal
      return eligibleVias
        .sort((via1, via2) => 
          Math.abs(via1.ordinal - viaRequest.ordinal) - Math.abs(via2.ordinal - viaRequest.ordinal)
        )[0];
    }    
  };


  // PUBLIC METHODS --------------------------------------------------------------------------------------
  tripPopulator.requests = function(tripRequests, infos, errors){
    infos.travMap = invertMap(infos.userTravMap,'traveler_id');

    return tripRequests.every((tripRequest,tNum) => {
      return tripRequest.vias.every((via,vNum) => {
        via.dep.airport = infos.airportIdMap[via.dep.airportCode];
        via.arr.airport = infos.airportIdMap[via.arr.airportCode];

        if(!via.dep.airport){
          errors.errors[`trip${tNum} via${vNum}`] = 'departure airport could not be found';
          return false;              
        }

        if(!via.dep.airport){
          errors.errors[`trip${tNum} via${vNum}`] = 'arrival airport could not be found';
          return false;              
        }

        const depTerminal = via.dep.terminalCode ? infos.terminalMap[via.dep.airport.id + via.dep.terminalCode.toLowerCase()] : null;
        const arrTerminal = via.arr.terminalCode ? infos.terminalMap[via.arr.airport.id + via.arr.terminalCode.toLowerCase()] : null;
          
        via.dep.terminal = depTerminal ? depTerminal : null;
        via.arr.terminal = arrTerminal ? arrTerminal : null;

        if(via.dep.terminalCode && !via.dep.terminal){
          errors.errors[`trip${tNum} via${vNum}`] = 'departure terminal could not be found';
          return false;              
        }

        if(via.arr.terminalCode && !via.arr.terminal){
          errors.errors[`trip${tNum} via${vNum}`] = 'arrival terminal could not be found';
          return false;              
        }

        if(via.flight && via.flight.keyType){
          switch(via.flight.keyType){
          case 'iata': via.flight.airline = infos.airlineIataMap[via.flight.airlineCode]; break;
          case 'icao': via.flight.airline = infos.airlineIcaoMap[via.flight.airlineCode]; break;
          case 'name': via.flight.airline = infos.potentialAirlines.find(airline => airline.checkNameMatch(via.flight.airlineName)); break;
          default:
          }

          if(!via.flight.airline){
            errors.errors[`trip${tNum} via${vNum}`] = 'airline could not be found';
            return false;
          }
        }

        if(!via.travelers.every((trav,travNum) => {
          trav.userTraveler = infos.userTravMap[trav.ref];

          if(!trav.userTraveler){
            errors.errors[`trip${tNum} via${vNum} traveler${travNum}`] = 'traveler could not be matched to the logged user';
            return false;
          }
          return true;
        })){
          return false;
        }

        return true;
      });
    });
  };


  tripPopulator.updateRequest = function(tripRequest, infos, errors){
    const trip = tripRequest.trip;

    if(!tripPopulator.requests([tripRequest],infos,errors))
      return false;

    tripRequest.addVias = [];
    tripRequest.delVias = [];
    tripRequest.finalVias = [];

    let hasViaErrors = false;
    tripRequest.vias.forEach((viaRequest,vNum) => {
    /** @type {JetViaInstance} */
      let via;

      switch(viaRequest.update){
      case 'idm': 
        via = findVia(trip,viaRequest);
        viaRequest.via = via;
        break;

      case 'add': 
        via = models.inputs.trip.build.via(trip,viaRequest);
        if(via){
          via.trip_id = trip.id;
          via.ordinal = -1;
          viaRequest.via = via;
          tripRequest.addVias.push(via);
        }
        break;
    
      case 'del':
        via = findVia(trip,viaRequest);
        if(via){
          tripRequest.delVias.push(via);
          viaRequest.via = via;
        } else {
          errors.errors[`via-${vNum}`] = 'The via to be deleted could not be found';
          hasViaErrors = false;
        }
        break;
    
      case 'chg':
        via = findVia(trip,viaRequest);
        if(via){
          viaRequest.prevVia = Object.assign({},via);
          Object.setPrototypeOf(viaRequest.prevVia,via);
          models.inputs.trip.build.updateVia(via,viaRequest);
          viaRequest.via = via;
        } else {
          errors.errors[`via-${vNum}`] =  'The changed via could not be found';
          hasViaErrors = true;
        }
        break;

      default:
        errors.errors[`via-${vNum}`] = 'Request must be matched to add, del or chg';
        hasViaErrors = true;
      }
    });

    if(!hasViaErrors){
      tripRequest.remainingVias = trip.vias.filter(via => !tripRequest.delVias.includes(via));
      tripRequest.finalVias.push(...tripRequest.remainingVias);
      tripRequest.finalVias.push(...tripRequest.addVias);
      tripRequest.finalVias.sort((via1, via2) => via1.compareByStartDateTime(via2));
    }

    return !hasViaErrors;
  };

  return tripPopulator;
};