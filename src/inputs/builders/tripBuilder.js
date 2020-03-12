const moment = require('moment');
const createTime = require('../../utils/commonFunctions').createTime;

/** @param {JetModels} models */
module.exports = function(models){
  
  /** @type {JetTripBuilder} */
  const tripBuilder = {};

  tripBuilder.trip = function(tripRequest, userId){
    // TODO: use vias to determine trip type
    return models.Trip.build({
      creator_id: userId
    });
  };

  tripBuilder.via = function(trip, viaRequest){
    return models.Via.build({
      dep_date: moment(viaRequest.dep.date).format('YYYY-MM-DD'),
      arr_date: moment(viaRequest.arr.date).format('YYYY-MM-DD'),
      dep_time: moment(viaRequest.dep.time,'HH:mm').format('HH:mm'),
      arr_time: moment(viaRequest.arr.time,'HH:mm').format('HH:mm'),
      dep_airport_id: viaRequest.dep.airport.id,
      arr_airport_id: viaRequest.arr.airport.id,
      dep_terminal_id: viaRequest.dep.terminal ? viaRequest.dep.terminal.id : null,
      arr_terminal_id: viaRequest.arr.terminal ? viaRequest.arr.terminal.id : null,
      airline_id: viaRequest.flight && viaRequest.flight.airline 
        ? viaRequest.flight.airline.id
        : null,
      trip_id: trip.id,
    });
  };

  tripBuilder.request = function(tripRequest){
    const trip = models.Trip.build({});
    tripRequest.trip = trip;
    
    tripRequest.vias.forEach(viaRequest => {
      const via = tripBuilder.via(trip,viaRequest);
      viaRequest.via = via;
    });

    trip.vias = tripRequest.vias.map(viaReq => viaReq.via);
  };
  

  tripBuilder.updateVia = function(via, viaRequest){
    const reqDepDate = moment(viaRequest.dep.date);
    const reqArrDate = moment(viaRequest.arr.date);
    const reqDepTime = createTime(viaRequest.dep.time);
    const reqArrTime = createTime(viaRequest.arr.time);

    viaRequest.taskChg = 'minimal';
    // there CANNOT be any change in {dep|arr} airports or {dep|arr} date (see matchesRequest)

    // if viaRequest has a flight and via doesn't or has a different one, need to update tasks
    if(viaRequest.flight.flight && via.flight_id !== viaRequest.flight.flight.id){ 
      viaRequest.taskChg = 'breaking';
    }

    via.dep_date = reqDepDate.format('YYYY-MM-DD');
    via.arr_date = reqArrDate.format('YYYY-MM-DD');
    via.dep_time = reqDepTime.format('HH:mm');
    via.arr_time = reqArrTime.format('HH:mm');
    
    via.dep_airport_id = viaRequest.dep.airport.id;
    via.arr_airport_id = viaRequest.arr.airport.id;
    via.dep_terminal_id = viaRequest.dep.terminal ? viaRequest.dep.terminal.id : null;
    via.arr_terminal_id = viaRequest.arr.terminal ? viaRequest.arr.terminal.id : null;
    via.airline_id = viaRequest.flight && viaRequest.flight.airline ? viaRequest.flight.airline.id : null;
    via.flight_id = viaRequest.flight && viaRequest.flight.flight ? viaRequest.flight.flight.id : null;
  };

  return tripBuilder;
};