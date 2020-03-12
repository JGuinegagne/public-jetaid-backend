
module.exports = function(){
  
  /** @type {JetRiderGetter} */
  const riderGetter = {};

  riderGetter.fullTravelerIds = function(riderRequests){
    const travIdMap = {};

    riderRequests.forEach(riderReq => {
      riderReq.travelers.forEach(travReq => {
        if(!travIdMap[travReq.userTraveler.traveler_id]){
          travIdMap[travReq.userTraveler.traveler_id] = true;
        }
      });
    });
    return Object.keys(travIdMap);
  };
  
  riderGetter.viaTravelerIds = function(riderRequests){
    const travIdMap = {};

    riderRequests.forEach(riderReq => {
      riderReq.travelers.forEach(travReq => {
        if(!travIdMap[travReq.viaTraveler.traveler_id]){
          travIdMap[travReq.viaTraveler.traveler_id] = true;
        }
      });
    });
    return Object.keys(travIdMap);
  };

  riderGetter.updateTravelerIds = function(riderRequests){
    const travIdMap = {};

    riderRequests.forEach(riderReq => {
      riderReq.travelers.forEach(travReq => {
        const travId = travReq.viaRef
          ? travReq.viaTraveler.traveler_id
          : travReq.userTraveler.traveler_id;

        if(!travIdMap[travId]){
          travIdMap[travId] = true;
        }
      });
    });

    return Object.keys(travIdMap);
  };

  riderGetter.unlinkedAddressIds = function(riderRequests){
    const unlinkedAddressIds = {};

    riderRequests.forEach(riderReq => {
      const rider = riderReq.rider;
      const newAddress = riderReq.cityLocation.address;
      if(rider.address_id && !newAddress)
        unlinkedAddressIds[rider.address_id]= true;

      if(newAddress && rider.address_id && newAddress.id !== rider.address_id)
        unlinkedAddressIds[rider.address_id]= true;
    });

    return Object.keys(unlinkedAddressIds);
  };

  return riderGetter;
};