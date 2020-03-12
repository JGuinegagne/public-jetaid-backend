module.exports = function(){
  
  /** @type {JetTripGetter} */
  const tripGetter = {};

  tripGetter.travelerIds = function(tripRequests){
    const travIdMap = {};

    tripRequests.forEach(tripRequest => {
      tripRequest.vias.forEach(via => {
        via.travelers.forEach(trav => {
          if(!travIdMap[trav.userTraveler.traveler_id]){
            travIdMap[trav.userTraveler.traveler_id] = true;
          }
        });
      });
    });

    return Object.keys(travIdMap);
  };

  tripGetter.finalTravelerIds = function(tripRequest){
    const travIdMap = {};

    tripRequest.vias.forEach(viaRequest => {
      const via = viaRequest.via;
      if(tripRequest.finalVias.includes(via)){
        viaRequest.travelers.forEach(travReq => {
          if(!travIdMap[travReq.userTraveler.traveler_id]){
            travIdMap[travReq.userTraveler.traveler_id] = true;
          }
        });
      }
    });

    return Object.keys(travIdMap);
  };


  return tripGetter;
};