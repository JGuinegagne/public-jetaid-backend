const moment = require('moment');

const fieldProperties = require('../utils/fieldProperties');

const resAttr = require('../utils/commonResAttr');
const RIDE_STATUS = require('../utils/commonFields').RIDE_STATUS;
const RIDER_STATUS = require('../utils/commonFields').RIDER_STATUS;

/** @param {JetModels} models */
module.exports = function(models){
  
  const Op = models.sequelize.Op;

  /** @type {JetRideHandler} */
  const rideHandler = {};

  rideHandler.updateStops = async function(
    ride, newRideRiderStopId, 
    reqCityStop, reqTermStop, toRemoveCityStopIds, toRemoveTermStopIds, 
    t=null, rideOwner = ride.getOwner()
  ){
    const rideOwnerId = rideOwner.id || rideOwner.RidesRiders.rider_id;
    if(!ride.Riders.find(rider => rider.RidesRiders.rider_id === rideOwnerId)){
      return Promise.reject({rideHandler: 'updateStops: rideOwner args is not a member of the ride'});
    }

    const opt = t ? {transaction: t} : {};
  
    const rideCityStopIds = ride.CityStops
      ? ride.CityStops.map(cityStop => cityStop.RidesNeighborhoods.id)
      : ride.RidesNeighborhoods
        ? ride.RidesNeighborhoods.map(rideHood => rideHood.id)
        : [];

    const rideTermStopIds = ride.TerminalStops
      ? ride.TerminalStops.map(termStop => termStop.RidesTerminals.id)
      : ride.RidesTerminals
        ? ride.RidesTerminals.map(rideTerminal => rideTerminal.id)
        : [];
  
    // Small risk here: unmatched NeighborhoodDrop and TerminalDrop may persist in the database
    const dropCityStopIds = toRemoveCityStopIds.filter(stopId => rideCityStopIds.includes(stopId));
    const dropTermStopIds = toRemoveTermStopIds.filter(stopId => rideTermStopIds.includes(stopId));
  
    const createCityStop = reqCityStop && typeof reqCityStop.neighborhood_id === 'number';
    const createTermStop = reqTermStop && typeof reqTermStop.terminal_id === 'number';
  
    // Handles cases where a rider is removed from the ride, causing its city/airport stop to be removed, whereas it is the only such stop left
    // If that happens, the city stop/ airport stop will be replaced by the owner stop
    const dropAllCityStop = rideCityStopIds.length === dropCityStopIds.length && !createCityStop;
    const dropAllTermStop = rideTermStopIds.length === dropTermStopIds.length && !createTermStop;
  
    // Create the new city / terminal stop, update the other ones
    // all the while avoiding hitting the unique constraints on [ride_id , ordinal]
    /** @type {Array<JetRideNeighborhoodInstance>} */
    const cityStops = ride.CityStops
      .map(hood => hood.RidesNeighborhoods)
      .filter(cityStop => !dropCityStopIds.includes(cityStop.id))
      .sort((s1,s2) => s1.ordinal - s2.ordinal);
  
    /** @type {Array<JetRideTerminalInstance>} */
    const termStops = ride.TerminalStops
      .map(term => term.RidesTerminals)
      .filter(termStop => !dropTermStopIds.includes(termStop.id))
      .sort((s1,s2) => s1.ordinal - s2.ordinal);
        
    /** @type {{[ordinal: number]: JetRideNeighborhoodInstance}} */
    const cityOrdMap = {};
    cityStops.forEach(cityStop => cityOrdMap[cityStop.ordinal] = cityStop);
    const cityStopCount = cityStops.length + createCityStop ? 1 : 0;
  
    /** @type {{[ordinal: number]: JetRideTerminalInstance}} */
    const termOrdMap = {};
    termStops.forEach(termStop => termOrdMap[termStop.ordinal] = termStop);
    const termStopCount = termStops.length + createTermStop ? 1 : 0;
  
  
    // creates the new rideNeighborhood instance (cityStop), if requested
    if(createCityStop){
      const targetOrdinal = typeof reqCityStop.ordinal === 'number'
        ? reqCityStop.ordinal : cityStopCount;
  
      const ind = targetOrdinal === 0 ? 0 : cityStops.findIndex(cityStop => cityStop.ordinal > targetOrdinal);
  
      const newCityStop = models.RidesNeighborhoods.build({
        ride_id: ride.id,
        ride_rider_id: newRideRiderStopId,
        neighborhood_id: reqCityStop.neighborhood_id,
        ordinal: targetOrdinal,
      });
  
      if(ind >=0){  
        cityStops.splice(ind,0,newCityStop);
      } else
        cityStops.push(newCityStop);
        
    } else if (dropAllCityStop){
      cityStops.push(models.RidesNeighborhoods.build({
        ride_id: ride.id,
        ride_rider_id: rideOwner.RidesRiders.id,
        neighborhood_id: rideOwner.neighborhood_id,
        ordinal: 0
      }));
    }
  
    cityStops.forEach((cityStop,ind) => cityStop.ordinal = ind);
  
  
    // creates the new rideTerminal instance (airportStop), if requested
    if(createTermStop){
      const targetOrdinal = typeof reqTermStop.ordinal === 'number'
        ? reqTermStop.ordinal : termStopCount;
  
      const ind = targetOrdinal === 0 ? 0 : termStops.findIndex(termStop => termStop.ordinal > targetOrdinal);
      const newTermStop = models.RidesTerminals.build({
        ride_id: ride.id,
        ride_rider_id: newRideRiderStopId,
        terminal_id: reqTermStop.terminal_id,
        ordinal: targetOrdinal
      });
  
      if(ind >= 0){
        termStops.splice(ind,0,newTermStop);
      } else {
        termStops.push(newTermStop);
      }
  
    } else if (dropAllTermStop){
      termStops.push(models.RidesTerminals.build({
        ride_id: ride.id,
        ride_rider_id: rideOwner.RidesRiders.id,
        terminal_id: rideOwner.terminal_id,
        ordinal: 0
      }));        
    }
  
    termStops.forEach((termStop,ind) => termStop.ordinal = ind);
  
  
    // creates the buffers to assign new ordinals to cityStops and termStops
    /** @type {Array<{stop: JetRideNeighborhoodInstance, ordinal: number}>} */
    const delayedCityStops = [];
  
    /** @type {Array<{stop: JetRideNeighborhoodInstance, ordinal: number}>} */
    const conflictCityStops = [];
  
    /** @type {Array<{stop: JetRideTerminalInstance, ordinal: number}>} */
    const delayedTermStops = [];
  
    /** @type {Array<{stop: JetRideTerminalInstance, ordinal: number}>} */
    const conflictTermStops = [];          
  
  
    // finally returns one big promise:
    // -- step 1: remove the stop entries being deleted
    // -- step 2: save the stop entries whose ordinal does not conflict with existing entries
    // -- step 3: save the stop entries whose ordinal no longer conflict after step 2, save the others with dummy ordinals
    // -- step 4: save the stop entries of step 3 with correct ordinals
    try{

      await  Promise.all([ // Remove requested drops
        dropCityStopIds.length
          ? models.RidesNeighborhoods.destroy(Object.assign({where: {id: {[Op.in]: dropCityStopIds}}}, opt))
          : Promise.resolve(null),
        dropTermStopIds.length
          ? models.RidesTerminals.destroy(Object.assign({where: {id: {[Op.in]: dropTermStopIds}}}, opt))
          : Promise.resolve(null),
          
      ]); 
      
      // Persist the stops whose ordinal does not conflict with existing entries
      await Promise.all([
        ...cityStops.map(cityStop => {
          if(cityOrdMap[cityStop.ordinal] && cityOrdMap[cityStop.ordinal].id !== cityStop.id){
            delayedCityStops.push({stop: cityStop, ordinal: cityStop.ordinal});
            return Promise.resolve(cityStop);
          } else {
            delete cityOrdMap[cityStop.ordinal];
            return cityStop.save(opt);
          }
        }),
        ...termStops.map(termStop => {
          if(termOrdMap[termStop.ordinal] && termOrdMap[termStop.ordinal].id !== termStop.id){
            delayedTermStops.push({stop: termStop, ordinal: termStop.ordinal});
            return Promise.resolve(termStop);
          } else {
            delete termOrdMap[termStop];
            return termStop.save(opt);
          }
        })
      ]);
          
      // Tries again after the update of the first set of entries, otherwise use dummy ordinals
      await Promise.all([
        ...delayedCityStops.length
          ? delayedCityStops.map((entry,ind) => {
            if(cityOrdMap[entry.ordinal]){
              entry.stop.ordinal = 1000+ind;
              conflictCityStops.push({stop: entry.stop, ordinal: entry.ordinal});
            }
            return entry.stop.save(opt);
          })
          : [Promise.resolve(null)],
        ...delayedTermStops.length
          ? delayedTermStops.map((entry,ind) => {
            if(termOrdMap[entry.ordinal]){
              entry.stop.ordinal = 1000+ind;
              conflictTermStops.push({stop: entry.stop, ordinal: entry.ordinal});
            }
            return entry.stop.save(opt);
          })
          : [Promise.resolve([])]
      ]);
          
      // Finally, reverts dummy ordinals to the proper values
      await Promise.all([
        ...conflictCityStops.length
          ? conflictCityStops.map(entry => {
            entry.stop.ordinal = entry.ordinal;
            return entry.stop.save(opt);
          })
          : [Promise.resolve(null)],
        ...conflictTermStops.length
          ? conflictTermStops.map(entry => {
            entry.stop.ordinal = entry.ordinal;
            return entry.stop.save(opt);
          })
          : [Promise.resolve(null)]
      ]);

      return ride;

    } catch(error){
      return Promise.reject(error);
    }
  };
  
  
  rideHandler.removeRiders = async function(ride, t= null, owner = ride.getOwner()){
    const coRiders = ride.Riders ? ride.Riders.filter(rider => !RIDER_STATUS.rideUniques.includes(rider.RidesRiders.status)) : null;
  
    if(!coRiders){
      return Promise.reject({ride: 'field Riders must be populated for arg ride of removeRiders()'});
    }
  
    if(!owner){
      return Promise.reject({ride: 'owner could not be found for ride arg of removeRiders()'});
    }
  
    const oRiderRefs = coRiders.map(rider => rider.RidesRiders.id);
    const ownerRef = owner.RidesRiders.id;
  
    const cityStopDrops = ride.CityStops
      .filter(cityStop => oRiderRefs.includes(cityStop.RidesNeighborhoods.ride_rider_id))
      .map(cityStop => cityStop.RidesNeighborhoods.id);
  
    const termStopDrops = ride.TerminalStops
      .filter(termStop => oRiderRefs.includes(termStop.RidesTerminals.ride_rider_id))
      .map(termStop => termStop.RidesTerminals.id); 
  
    ride.Riders = ride.Riders.filter(rider => rider.RidesRiders.rider_id !== owner.RidesRiders.id);
    ride.updateUsage();
  
    coRiders.forEach(rider => rider.RidesRiders.status = RIDER_STATUS.left);
  
    try{
      await Promise.all([
        ...coRiders.map(oRider => rideHandler.reactivateSuspendedRide(oRider.RidesRiders,t)),
        rideHandler.updateStops(ride,ownerRef,null,null,cityStopDrops,termStopDrops,t,owner)
      ]);
  
      return ride;

    } catch(error){
      return Promise.reject(error);
    }

  };
  

  rideHandler.removeCoRider = async function(ride, coRider, t=null, newStatus = RIDER_STATUS.left, reactivate=true, reset=false){
    const opt = t ? {transaction: t} : {};
        
    newStatus = RIDER_STATUS.values.includes(newStatus) && !RIDER_STATUS.riderUniques.includes(newStatus)
      ? newStatus : RIDER_STATUS.left;
  
    const riderId = coRider.id 
      ? coRider.id 
      : coRider.RidesRiders && coRider.RidesRiders.rider_id ? coRider.RidesRiders.rider_id : null;
  
    if(!riderId)
      return Promise.reject({ride: 'removeCoRider: riderId cannot be null'});
  
    const target = ride.Riders.find(rider => rider.RidesRiders.rider_id === riderId);
    if(!target){
      return Promise.reject({ride: 'removeCoRider: coRider not found in the ride'});
        
    } else if(RIDER_STATUS.rideUniques.includes(target.RidesRiders.status)){
      return Promise.reject({ride: 'removeCoRider: coRider may not the owner/provider/driver'});
    }
  
    const cityStopDrops = ride.CityStops
      .filter(cityStop => cityStop.RidesNeighborhoods.ride_rider_id === target.RidesRiders.id)
      .map(cityStop => cityStop.RidesNeighborhoods.id);
  
    const termStopDrops = ride.TerminalStops
      .filter(termStop => termStop.RidesTerminals.ride_rider_id === target.RidesRiders.id)
      .map(termStop => termStop.RidesTerminals.id); 
  
    ride.Riders.splice(ride.Riders.indexOf(target),1);
    ride.updateUsage();
        
    target.RidesRiders.status = newStatus;
    target.RidesRiders.joined_at = null;
  
    try{
      /* eslint-disable no-unused-vars */
      const [_,suspRide] = await Promise.all([
      /* eslint-enable no-unused-vars */
        ride.save(opt),
        rideHandler.updateStops(ride,null,null,null,cityStopDrops,termStopDrops,t),
        reactivate
          ? rideHandler.reactivateSuspendedRide(target.RidesRiders,t,reset,target)
          : Promise.resolve(null)
      ]);
        
      return {ride,suspRide};
    } catch(error){
      return Promise.reject(error);
    }

  };
  

  rideHandler.suspendRide = async function(ride, t = null){
    const opt = t ? {transaction: t} : {};
    const owner = ride.getOwner();
    const ownerLink= owner ? owner.RidesRiders : null;
  
    if(!owner || !ownerLink){
      return Promise.reject({ride: 'Ride owner or owner.RidesRiders could not be found'});
    }
  
    ownerLink.status = RIDER_STATUS.suspend;
    ride.status = RIDE_STATUS.inactive;
  
    try{
      await Promise.all([
        ownerLink.save(Object.assign({field: ['status']},opt)),
        ride.save(Object.assign({field: ['status']},opt))
      ]);
    } catch(error){
      return Promise.reject(error);
    }
  };


  rideHandler.reactivateSuspendedRide = async function(rideRider, t = null, reset = true, coRider = null){
    const opt = t ? {transaction: t} : {};  
    
    if(!rideRider || RIDER_STATUS.rideUniques.includes(rideRider.status))
      return Promise.reject({rideHandler: 'reactivateSuspendedRide() called on a rideRider null or whose status is still in the ride'});

    try{
      return Promise.all([
        rideRider.findSuspendRide(reset),
        !coRider && reset // fetches the coRider if it was not provided and need to reset the ride
          ? models.Rider.findById(rideRider.rider_id, {attributes: resAttr.RIDER_RESETRIDE_ATTRIBUTES})
          : Promise.resolve(coRider),
        rideRider.save(Object.assign({fields: ['status','joined_at']},opt)),
     
      ]).then(([{suspRideRider,suspRide},coRider]) => {
        if(!suspRideRider || !suspRide){
          return suspRide = null;

        } else {
          suspRideRider.status = fieldProperties.getCreatorRiderStatus(suspRide.type);
          suspRideRider.joined_at = new Date();
          suspRide.status = suspRide.getActiveStatus();
          if(reset){
            suspRide.updateFromRider(coRider);
          }
          return Promise.all([
            suspRideRider.save(Object.assign({fields: ['status','joined_at']},opt)),
            reset
              ? Promise.all([
                suspRide.save(opt),
                rideHandler.resetRideStops(suspRide,t,coRider,suspRideRider)
              ])
              : suspRide.save(Object.assign({fields: ['status']},opt))
          ]).then(() => suspRide);
        }
      });      

    } catch(error){
      return Promise.reject(error);
    }    
  };
  
  
  rideHandler.resetRide = async function(ride, t=null, suspend=false, owner= ride.getOwner(), ownerLink = ride.getOwner().RidesRiders){
    const opt = t ? {transaction: t} : {};
  
    if(!ride.Riders && ride.countCoRiders() > 0){
      return Promise.reject({ride: 'cannot reset a ride that still has coRiders'});
    }
  
    ownerLink.status = suspend ? RIDER_STATUS.suspend : fieldProperties.getCreatorRiderStatus(ride.type);
    ride.status = suspend ? RIDE_STATUS.inactive : ride.getActiveStatus();
  
    if(typeof owner.neighborhood_id !== 'number'){
      return Promise.reject({ride: 'resetRideStops owner.neighborhood_id must be populated'});
    }
    ride.updateFromRider(owner);
       
    try{
      await Promise.all([
        ride.save(opt),
        ownerLink.save(Object.assign({fields: ['status']},opt)),
        rideHandler.resetRideStops(ride,t,owner,ownerLink)
      ]);
      return ride;
    
    } catch(error){
      return Promise.reject(error);
    }
  };
  
  
  rideHandler.resetRideStops = async function(ride, t=null, owner = ride.getOwner(), ownerLink = ride.getOwner().RidesRiders){
    const opt = t ? {transaction: t} : {};
  
    if(!ride.CityStops || !ride.TerminalStops){
      return Promise.reject({ride: 'resetRideStop: ride arg must have its CityStops and TerminalStops populated'});
    }
  
    if(ride.CityStops.some(stop => stop.RidesNeighborhoods.ride_rider_id !== ownerLink.id)){
      return Promise.reject({ride: 'resetRideStop: can only reset an empty ride, found a city stop not be associated with the owner'});
    }
  
    if(ride.TerminalStops.some(stop => stop.RidesTerminals.ride_rider_id !== ownerLink.id)){
      return Promise.reject({ride: 'resetRideStop: can only reset an empty ride, found a terminal stop not be associated with the owner'});
    }
  
    if(typeof owner.neighborhood_id !== 'number'){
      return Promise.reject({ride: 'resetRideStop: owner.neighborhood_id must be populated and not null'});
    }
  
    if(typeof owner.terminal_id === 'undefined'){
      return Promise.reject({ride: 'resetRideStop: owner.terminal_id must be populated'});
    }
  
    const cityStop = ride.CityStops.map(stop => stop.RidesNeighborhoods).find(stop => stop.ride_rider_id === ownerLink.id);
    let termStop = ride.TerminalStops.map(stop => stop.RidesTerminals).find(stop => stop.ride_rider_id === ownerLink.id);
  
    if(!cityStop){
      return Promise.reject({ride: 'resetRideStop: no city stop was found for the owner'});
    }
  
    const saveCityStop = cityStop.neighborhood_id !== owner.neighborhood_id;
    cityStop.neighborhood_id = owner.neighborhood_id;
  
    let saveTermStop = false;
    if(termStop && termStop.terminal_id !== owner.terminal_id){
      termStop.terminal_id = owner.terminal_id;
      saveTermStop = true;
    } else if (!termStop && typeof owner.terminal_id === 'number'){
      termStop = models.RidesTerminals.build({
        ride_id: ownerLink.ride_id,
        terminal_id: owner.terminal_id,
        ride_rider_id: ownerLink.id,
        ordinal: 0
      });
      ride.TerminalStops.push({id: owner.terminal_id, RidesTerminals: termStop});
      saveTermStop = true;
    }
  
    try{
      await Promise.all([
        saveCityStop
          ? cityStop.save(Object.assign({fields: ['neighborhood_id']},opt))
          : Promise.resolve(cityStop),
        saveTermStop
          ? termStop.save(opt)
          : Promise.resolve(termStop)
      ]);

      return ride;

    } catch(error){
      return Promise.reject(error);
    } 
  };
  
  
  rideHandler.spinOff = async function(ride, postSpinOffHandler, t=null){
    const opt = t ? {transaction: t} : t;
  
    const curOwner = ride.getOwner();
    if(!curOwner)
      return Promise.reject({ride: 'owner to spin off could not be found in the ride'});
  
    const coRiders = ride.getCoRiders();
    if(!coRiders || !coRiders.length)
      return Promise.reject({ride: 'could not find any coRiders in spinOff call'});
  
    const cityStopDrops = ride.CityStops
      .filter(cityStop => cityStop.RidesNeighborhoods.ride_rider_id === curOwner.RidesRiders.id)
      .map(cityStop => cityStop.RidesNeighborhoods.id);
  
    const termStopDrops = ride.TerminalStops
      .filter(termStop => termStop.RidesTerminals.ride_rider_id === curOwner.RidesRiders.id)
      .map(termStop => termStop.RidesTerminals.id);
  
    const newOwner = coRiders
      .sort((r1,r2) => moment(r1.RidesRiders.joined_at).diff(r2.RidesRiders.joined_at))[0];
  
    ride.Riders.splice(ride.Riders.indexOf(curOwner),1);
    ride.updateUsage(); // TODO: handle close/open ride
  
    curOwner.RidesRiders.status = RIDER_STATUS.left;
    curOwner.RidesRiders.joined_at = null;
  
    try{
      const newRide = await curOwner.RidesRiders
        .save(Object.assign({fields: ['status','joined_at']},opt))
        .then(() => {
          return Promise.all([
            postSpinOffHandler(t),
            newOwner.RidesRiders
              .upgrade(ride, t)
              .then(() => rideHandler.updateStops(ride,null,null,null,cityStopDrops,termStopDrops,t,newOwner))
          ]).then(([newRide]) => newRide);
        });

      return newRide;
    } catch(error){
      return Promise.reject(error);
    }
  };


  rideHandler.cascade = async function(deletedRiders, t = null){
    if(!deletedRiders.length)
      return Promise.resolve();

    const opt = t ? {transaction: t} : {};

    try {
      /** @type {{[rideId: string]: {ride: JetRideInstance, removedConns: Array<JetRideRiderInstance>, riderConns: Array<JetRideRiderInstance>}}} */
      const rideMap = {};

      /** @type {{[paxId: string]: JetRiderInstance}} */
      const delRiderMap = {};

      // SET all deleted riders in a map format for ease of access
      // SET all rides in a map
      deletedRiders.forEach(rider => {
        rider.Connections.forEach(c => rideMap[c.ride_id] = {});
        delRiderMap[rider.id] = rider;
      });

      // STEP #1: 
      // fetches all task instances
      if(Object.keys(rideMap).length){
        const rides = await models.Ride.findAll(
          Object.assign(
            {where: {id: {[Op.in]: Object.keys(rideMap)}}},
            models.queries.FETCH_RIDE_RIDERCASCADE
          )
        );

        /** @type {Array<string>} */
        const emptyRideIds = [];

        rides.forEach(ride => {
          const entry = rideMap[ride.id];
          entry.ride = ride;
          entry.removedConns = ride.RiderLinks.filter(rr => !!delRiderMap[rr.rider_id]);
          ride.RiderLinks = ride.RiderLinks
            .filter(rr => RIDER_STATUS.riderUniques.includes(rr.status) && !delRiderMap[rr.rider_id]);

          entry.riderConns = ride.RiderLinks
            .filter(rr => !delRiderMap[rr.rider_id] && RIDER_STATUS.riderUniques.includes(rr.status));

          if(!entry.riderConns.length) {
            emptyRideIds.push(ride.id);
            delete rideMap[ride.id];
          }
        });

        return Promise.all([
          
          // DESTROY empty rides
          emptyRideIds.length
            ? models.Ride.destroy(Object.assign({where: {id: {[Op.in]: emptyRideIds}}},opt))
            : Promise.resolve(),

          // FOR rides with other riders:
          ...Object.keys(rideMap).map(rideId => {
            const entry = rideMap[rideId];
            const delKeyConn = entry.removedConns.find(rr => RIDER_STATUS.keyRider.includes(rr));
            
            // CASE #1 - KEY MEMBER (driver or provider): reactivate other riders suspended ride, then destroy the ride
            if(delKeyConn){
              entry.riderConns.forEach(rr => {
                rr.status = RIDER_STATUS.left;
                rr.joined_at = null;
              });

              return Promise.all(
                entry.riderConns.map(rr => rideHandler.reactivateSuspendedRide(rr,t))
              ).then(() => entry.ride.destroy(opt));
            }

            const ownerConn = entry.removedConns.find(rr => RIDER_STATUS.rideUniques.includes(rr.status));
            
            // CASE #2 - OWNER: either
            // a) >= 2 riders left: spin off (promote one of the remaining rider)
            // b) otherwise reactivate the other rider's suspended ride, then destroy the ride
            if(ownerConn){
              const activeConns = entry.ride.RiderLinks.filter(rr => RIDER_STATUS.riderUniques.includes(rr.status));

              if(activeConns.length>1){ // means owner and more than 1 rider left, promote a rider to owner and keep the ride
                const newOwnerConn = activeConns
                  .sort((r1,r2) => moment(r1.RidesRiders.joined_at).diff(r2.RidesRiders.joined_at))[0];

                const cityStopDropIds = entry.ride.RidesNeighborhoods
                  .filter(rideHood => entry.removedConns.find(conn => conn.id === rideHood.ride_rider_id))
                  .map(rideHood => rideHood.id);

                const termStopDropIds = entry.ride.RidesTerminals
                  .filter(rideTerm => entry.removedConns.find(conn => conn.id === rideTerm.ride_rider_id))
                  .map(rideTerm => rideTerm.id);

                entry.ride.updateUsage(false);
                return newOwnerConn
                  .upgrade(entry.ride,t)
                  .then(() => rideHandler.updateStops(entry.ride,null,null,cityStopDropIds,termStopDropIds,t));
              
              } else { // only one rider left, reactive rider's suspended ride, then dissolve the ride
                const conn = activeConns[0];
                conn.status = RIDER_STATUS.left;
                conn.joined_at = null;
                return rideHandler
                  .reactivateSuspendedRide(conn,t)
                  .then(() => entry.ride.destroy(opt));
              }
            }

            // CASE #3 - CO-RIDER: remove the terminal/city stops associated with the removed riders
            const cityStopDropIds = entry.ride.RidesNeighborhoods
              .filter(rideHood => entry.removedConns.find(conn => conn.id === rideHood.ride_rider_id))
              .map(rideHood => rideHood.id);

            const termStopDropIds = entry.ride.RidesTerminals
              .filter(rideTerm => entry.removedConns.find(conn => conn.id === rideTerm.ride_rider_id))
              .map(rideTerm => rideTerm.id);

            entry.ride.updateUsage(false);
            
            return rideHandler
              .updateStops(entry.ride,null,null,null,cityStopDropIds,termStopDropIds,t);
          })
        ]);
      } else
        return Promise.resolve();


    } catch(error){
      return Promise.reject(error);
    }
  }; // <-- end of CASCADE



  // rideHandler.prepareForRidersDelete = function(riderIds){
  //   return models.RidesRiders
  //     .findAll({
  //       where: {rider_id: {[Op.in]: riderIds}},
  //       attributes: ['id','ride_id','rider_id','status','joined_at'],
  //       include: [{model: models.Ride, attributes: ['id','status']}]
    
  //     }).then(rideRiders => {
      
  //     /** @type {{[rideId: string]: {ride: JetRideInstance, rideRider: JetRideRiderInstance, oRideRiders: Array<JetRideRiderInstance>}}} */
  //       const rideIdRideMap = {};
  //       rideRiders.forEach(rideRider => {

  //         if(!rideIdRideMap[rideRider.ride_id] || rideRider.isMainRider()){
  //           rideIdRideMap[rideRider.ride_id] = {
  //             ride: rideRider.Ride, 
  //             rideRider,
  //             oRideRiders: []
  //           };
  //         }
  //       });

  //       return models.RidesRiders.findAll({
  //         where: {[Op.and]: [
  //           {ride_id: {[Op.in]: Object.keys(rideIdRideMap)}},
  //           {rider_id: {[Op.notIn]: riderIds}}
  //         ]}
  //       }).then(oRidesRiders => {
  //         oRidesRiders.forEach(oRideRider => {
  //           rideIdRideMap[oRideRider.ride_id].oRideRiders.push(oRideRider);
  //         });

  //         const updateReqs = [];

  //         Object.keys(rideIdRideMap).forEach(rideId => {
  //           const rideInfos = rideIdRideMap[rideId];

  //           // if ride is empty, delete it
  //           if(!rideInfos.oRideRiders.length){
  //             updateReqs.push(rideInfos.ride.destroy());
          
  //           } else if (!rideInfos.rideRider.mayPersistRide()){
  //             updateReqs.push(rideInfos.ride.dropCarProvider(false));
          
  //           } else {
  //           // if main rider, needs to assign a new main rider
  //             if(rideInfos.rideRider.isMainRider()){
  //               updateReqs.push(rideInfos.ride.dropOwner(false));
  //             } else {
  //               updateReqs.push(rideInfos.ride.expel(rideInfos.rideRider, null));
  //             }
  //           }
  //         });
  //         return Promise.all(updateReqs);
  //       });
  //     }).catch(error => console.log(error));
  // };

  return rideHandler;
};