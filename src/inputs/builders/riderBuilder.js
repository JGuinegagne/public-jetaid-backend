/** @param {JetModels} models */
module.exports = function(models){
  
  /** @type {JetRiderBuilder} */
  const riderBuilder = {};

  
  riderBuilder.fromVia = function(fromViaRequest, creatorId){
    const useArr = fromViaRequest.toward === 'city';
    const refVia = fromViaRequest.refVia;

    const date = useArr ? refVia.arr_date : refVia.dep_date;
    const dep_time = useArr ? refVia.arr_time : refVia.dep_time;
    const airportId = useArr ? refVia.arr_airport_id : refVia.dep_airport_id;
    const terminalId = useArr ? refVia.arr_terminal_id : refVia.dep_terminal_id;

    const addressId = fromViaRequest.cityLocation.address 
      ? fromViaRequest.cityLocation.address.id : null;

    const neighborhoodId = !addressId && fromViaRequest.cityLocation.hood
      ? fromViaRequest.cityLocation.hood.id : null;

    const rider = models.Rider.build({
      date,
      dep_time,
      pref: fromViaRequest.preferences.ridePref,
      toward: fromViaRequest.toward,
      
      seat_count: fromViaRequest.requirements.seatCount,
      luggage_count: fromViaRequest.requirements.luggageCount,
      baby_seat_count: fromViaRequest.baby_seat_count,
      sport_equip_count: fromViaRequest.sport_equip_count,

      address_id: addressId,
      neighborhood_id: neighborhoodId,
      via_id: refVia.id,
      airport_id: airportId,
      terminal_id: terminalId,
      creator_id: creatorId
    });

    rider.Neighborhood = fromViaRequest.cityLocation.hood || null;
    return rider;
  };


  riderBuilder.fromFull = function(fullRequest, creatorId){
    const addressId = fullRequest.cityLocation.address 
      ? fullRequest.cityLocation.address.id : null;
    
    const neighborhoodId = !addressId && fullRequest.cityLocation.hood
      ? fullRequest.cityLocation.hood.id : null;

    const terminalId = fullRequest.airportLocation.terminal && typeof fullRequest.airportLocation.terminal.id === 'number'
      ? fullRequest.airportLocation.terminal.id : null;
    const rider = models.Rider.build({
      date: fullRequest.date,
      dep_time: fullRequest.startTime,
      pref: fullRequest.preferences.ridePref,
      toward: fullRequest.toward,

      seat_count: fullRequest.requirements.seatCount,
      luggage_count: fullRequest.requirements.luggageCount,
      baby_seat_count: fullRequest.requirements.babySeatCount,
      sport_equip_count: fullRequest.requirements.sportEquipCount,

      address_id: addressId,
      neighborhood_id: neighborhoodId,
      via_id: null,
      airport_id: fullRequest.airportLocation.airport.id,
      terminal_id: terminalId,
      creator_id: creatorId
    });

    rider.Neighborhood = fullRequest.cityLocation.hood || null;
    return rider;
  };

  return riderBuilder;
};
