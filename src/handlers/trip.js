/** @param {JetModels} models */
module.exports = function(models){
  const Op = models.sequelize.Op;

  /** @type {JetTripHandler} */
  const tripHandler = {};

  tripHandler.updateVias = async function(trip, finalVias, remVias, delVias, t = null){
    // A bit complex mechanics here:
    // -- there is a "unique" constraint on [trip_id, ordinal] in via table
    // -- need to be careful in order to avoid violating it on update/insert
    // ---- A) start by removing deleted via
    // ---- B) for each final via, check if saving the via will result in a conflict (using ordinalViaIdMap as check)
    // ------ if not, save the via instance, remove the original ordinal of this via from ordinalViaIdMap
    // ------ if yes, buffer it for later in delayedVia (and save the ordinal)
    // ---- C) for each delayed via, check if it can be saved now
    // ------ if still no, mark it as conflict, and save the instance with a dummy ordinal initially
    // ---- D) for each conflict via, save using the proper ordinal
    // in most cases: C and D will be just Promise.all([Promise.resolve])
    const opt = t ? {transaction: t} : {};

    /** @type {{[ordinal: number]: string}} */
    const ordinalViaIdMap = {};

    remVias.forEach(via => {
      ordinalViaIdMap[via.ordinal] = via.id;
    });

    try{
      if(delVias.length) // will trigger hook cascadeRiderPax in Vias
        await models.Via.destroy(Object.assign({where: {id: {[Op.in]: delVias.map(via => via.id)}}},opt));

        /** @type {Array<{via: JetViaInstance, ordinal: number}>} */
      const delayedVias = [];

      await Promise.all(
        finalVias.map((via,ind) => {
          if(ordinalViaIdMap[ind] && ordinalViaIdMap[ind] !== via.id){
            delayedVias.push({via, ordinal: ind});
            return Promise.resolve(via);
          
          } else {
            if(via.ordinal >= 0)
              delete ordinalViaIdMap[via.ordinal];
            
            via.ordinal = ind;
            return via.save(opt);
          }
        })
      );

      if(!delayedVias.length){
        trip.vias = finalVias;
        return trip;
      }
          

      /** @type {Array<{via: JetViaInstance, ordinal: number}>} */
      const conflictVias = [];

      await Promise.all(
        delayedVias.map((delayedVia,ind) => {
          if(ordinalViaIdMap[delayedVia.ordinal]){
            conflictVias.push({via: delayedVia.via, ordinal: delayedVia.ordinal});
            delayedVia.via.ordinal = 1000 + ind;
            return delayedVia.via.save(opt);

          } else {
            delayedVia.via.ordinal = delayedVia.ordinal;
            return delayedVia.via.save(opt);
          }
        })
      );

      if(!conflictVias.length){
        trip.vias = finalVias;
        return trip;
      }
          
      await Promise.all(
        conflictVias.map(conflictVia => {
          conflictVia.via.ordinal = conflictVia.ordinal;
          return conflictVia.via.save(opt);
        })
      );

      trip.vias = finalVias;
      return trip;

    } catch(error){
      return Promise.reject(error);
    }
  };

  return tripHandler;
};