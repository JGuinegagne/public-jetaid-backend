const express = require('express');

/** @type {JetModels} */
const models = require('../../models');
const auth = require('../authorization');
const resAttr = require('../../utils/commonResAttr');

const router = express.Router();
const Op = models.sequelize.Op;

// ************************************************************************************************

/** @param {Array<string>} riderIds
 * @param {string} userId
 * @param {JetInfos} infos
 * @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
const createRidersResponse = function(riderIds, userId, infos, travMap){
  return Promise.all([
    models.Rider.findAll({
      where: {id: {[Op.in]: riderIds}},
      attributes: models.queries.FETCH_RIDER.attributes,
      include: models.queries.FETCH_RIDER.include
    }),
    models.RidersUsers.findAll({
      where: {[Op.and]: [
        {rider_id: {[Op.in]: riderIds}},
        {user_id: userId}
      ]},
      attributes: resAttr.RIDER_USER_ATTRIBUTES
    }),
    models.TripsUsers.findAll({
      where: {user_id: userId},
      attributes: resAttr.TRIP_USER_ATTRIBUTES
    })
  ]).then(([riders,userRiders,userTrips]) => {
    return riders
      .sort((r1,r2) => r1.startTimeCompare(r2))
      .map(rider => {
        const riderUser = userRiders.find(userRider => userRider.rider_id === rider.id);
        const resp = rider.createPrivateResponse(riderUser,infos,travMap,{via: rider.via});

        const tripUser = rider.via && rider.via.trip_id
          ? userTrips.find(tu => tu.trip_id === rider.via.trip_id)
          : null;

        if(tripUser){
          resp.tripRef = tripUser.id;
          resp.viaOrdinal = rider.via.ordinal;
        }

        return resp;
      });
  });
};



// ************************************************************************************************
// ROUTE POST/ADD: creates a set of riders (and maybe rides) associated with a single trip
// Expecting request in the form POST api/rides/add
//
// STEP#1: retrieves an extended tripUser instance and checks it matches the logged user
// STEP#2: checks the validity of each requests based on the results of step#1
// -- returns an error if any field of any request cannot be matched
// -- if all ok: builds, but doesn't persist new addresses and rider instances from the ref via
// -- if all ok: fetches all travelers required to be associated with the rider instance
// STEP#3: persists new addresses and riders instances
// STEP#4: associate new rider instances with addresses, travelers and users
// STEP#5: fetch resulting instances and format them for http response
router.post('/add', auth.required, async(req,res,next) => {
  if(!req.body.tripUser || typeof req.body.tripUser.ref !== 'string' 
      || req.body.tripUser.ref.toString('hex') !== req.body.tripUser.ref){
    return res.status(422).send({errors: {userTrip: 'Body must include a userTrip.ref hex string field'}});
  }
  
  /** @type {string} */
  const tripUser = req.body.tripUser.ref;

  if(!req.body.riders || !Array.isArray(req.body.riders)){
    return res.status(422).send({errors: {riders: 'Body must include a riders field of type array'}});
  
  } else if (!req.body.riders.length){
    return res.status(422).send({errors: {riders: 'Riders field is an empty array'}});
  }

  /** @type {Array<JetRiderFromViaRequest>} */
  const riderRequests = req.body.riders;

  /** @type {string} */
  const userId = req.payload.id;
  const errors = {errors: {}};

  if(!riderRequests.every((riderRequest,ind) => models.inputs.rider.validate.request(riderRequest,ind,errors,true))){
    return res.status(422).send({errors});
  }

  
  try{
    // POST/ADD ROUTE STEP #1: retrieves the tripUser and trav->UserTrav map --------------
    const userTrip = await models.TripsUsers.findById(req.body.tripUser.ref, {attributes: resAttr.TRIP_USER_ATTRIBUTES});

    if(!userTrip){
      return res.status(404).send({errors: {trip: 'Trip could not be found'}});
    }

    if(userTrip.user_id !== req.payload.id){
      return res.status(403).send({errors: {userTrip: 'Looged user is not authorized to create rides associated with this trip'}});
    }
    // End of POST/ADD ROUTE STEP #1 ------------------------------------------------------ 


    // POST/ADD ROUTE STEP #2: fetches trip info and rider requests address info ----------
    const [trip,infos] = await Promise.all([
      models.Trip.findById(userTrip.trip_id, models.queries.FETCH_RIDER_TRIP),
      models.inputs.rider.fetch.infos(req.payload.id, riderRequests)
    ]);

    if(!trip){
      return res.status(404).send({errors: {trip: 'trip could not be retrieved'}});
    }

    if(!models.inputs.rider.populate.fromViaRequests(trip.vias,riderRequests,infos,errors)){
      return res.status(422).send(errors);
    }

    // Builds, but does not persist, all riders instances
    riderRequests.forEach(riderRequest => {
      riderRequest.rider = models.inputs.rider.build.fromVia(riderRequest,userId);
    });

    // End of POST/ADD ROUTE STEP #2 ------------------------------------------------------ 


    // POST/ADD ROUTE STEP #3: builds custom address and fetches their neighborhoods ------
    // also fetches all the users associated with the travelers in the rider requests
    // to create riderUser instance
    const allTravelers = models.inputs.rider.get.viaTravelerIds(riderRequests);

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(allTravelers),
      models.inputs.rider.populate.missingHoodFromVia(riderRequests)
    ]);

    if(!riderRequests.every((riderReq,index) => {
      if(!riderReq.cityLocation.hood){
        errors.errors[`rider${index}`] = 'Rider\'s address could not be associated with a neighborhood';  
        return false;
      }
      return true;
    })){
      return res.status(422).send(errors);
    }

    // End of POST/ADD STEP #3 ------------------------------------------------------------


    // POST/ADD STEP #4: Persist rider instances ------------------------------------------
    await Promise.all(riderRequests.map(riderReq => {
      const custAddress = riderReq.cityLocation.customAddress;

      return ( custAddress
        ? riderReq.cityLocation.address.save()
        : Promise.resolve(riderReq.cityLocation.address)
      )
        .then(() => riderReq.rider.save())
        .then(() => {
          const riderTravelers = models.RidersTravelers.buildFromViaRequest(riderReq);
          const riderUsers = models.RidersUsers.buildFromViaRequest(riderReq, travUsersMap);
          riderReq.ride = riderReq.ride.createRide
            ? models.Ride.buildFromRider(riderReq.rider,riderReq.ride.rideType,riderReq.ride.public)
            : null;
          return Promise.all([
            ...riderTravelers.map(riderTrav => riderTrav.save()),
            ...riderUsers.map(riderUser => riderUser.save()),
            riderReq.ride 
              ? riderReq.ride.saveInitial(riderReq.rider) 
              : Promise.resolve(riderReq.ride)
          ]);
        });

    }));
    // End of POST/ADD STEP #4 ------------------------------------------------------------

    
    // POST/ADD STEP #5: Fetch resulting rider instance -----------------------------------
    const riderIds = riderRequests.map(riderReq => riderReq.rider.id);
    const riderResponses = await createRidersResponse(riderIds,userId,infos,infos.travMap);

    // End of POST/ADD STEP #5 ------------------------------------------------------------
    return res.status(200).send({riders: riderResponses});
    // ------------------------------------------------------------------------------------
  
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// ROUTE POST/CREATE: creates a set of riders (and maybe rides) not associated to a Trip
// Expecting request in the form POST api/rides/create
//
// STEP#1: retrieves airport, terminals, travelers, neighborhood, addresses data for each field of each request
// STEP#2: checks the validity of each requests based on the results of step#1
// -- returns an error if any field of any request cannot be matched
// -- if all ok: builds, but doesn't persist new addresses and rider instances
// -- if all ok: fetches all travelers required to be associated with the rider instance
// STEP#3: persists new addresses and riders instances
// STEP#4: associate new rider instances with addresses, travelers and users
// STEP#5: fetch resulting instances and format them for http response
router.post('/create', auth.required, async (req, res, next) => {
  if(!req.body.riders || !Array.isArray(req.body.riders)){
    return res.status(422).send({errors: {riders: 'Body must include a riders field of type array'}});
  
  } else if (!req.body.riders.length){
    return res.status(422).send({errors: {riders: 'Riders field is an empty array'}});
  }

  /** @type {Array<JetRiderFullRequest>} */
  const riderRequests = req.body.riders;

  /** @type {string} */
  const userId = req.payload.id;
  const errors = {errors: {}};

  if(!riderRequests.every((riderRequest, ind) => models.inputs.rider.validate.request(riderRequest,ind,errors,false))){
    return res.status(422).send({errors});
  }

  try{
    // POST/CREATE STEP #1: Retrieves data for each entries: ------------------------------
    const infos = await models.inputs.rider.fetch.fullInfos(req.payload.id,riderRequests);

    if(!models.inputs.rider.populate.fullRequests(riderRequests,infos,errors)){
      return res.status(422).send(errors);
    }

    // Builds, but does not persist, all rider instances
    riderRequests.forEach(riderRequest => {
      riderRequest.rider = models.inputs.rider.build.fromFull(riderRequest, userId);
    });
    // End of POST/CREATE STEP #1 ---------------------------------------------------------


    // POST/CREATE ROUTE STEP #2: builds custom address and fetches their neighborhoods ---
    // also fetches all the users associated with the travelers in the rider requests
    // to create riderUser instance
    const allTravelers = models.inputs.rider.get.fullTravelerIds(riderRequests);

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(allTravelers),
      models.inputs.rider.populate.missingHoodFromFull(riderRequests)
    ]);

    if(!riderRequests.every((riderReq,index) => {
      if(!riderReq.cityLocation.hood){
        errors.errors[`rider${index}`] = 'Rider\'s address could not be associated with a neighborhood';  
        return false;
      }
      return true;
    })){
      return res.status(422).send(errors);
    }
    // End of POST/CREATE STEP #2 ---------------------------------------------------------


    // POST/CREATE STEP #3: Persist rider instances ---------------------------------------
    await Promise.all(riderRequests.map(riderReq => {
      const custAddress = riderReq.cityLocation.customAddress;

      return ( custAddress
        ? riderReq.cityLocation.address.save()
        : Promise.resolve(riderReq.cityLocation.address)
      )
        .then(() => riderReq.rider.save())
        .then(() => {
          const riderTravelers = models.RidersTravelers.buildFromFullRequest(riderReq);
          const riderUsers = models.RidersUsers.buildFromFullRequest(riderReq, travUsersMap);
          riderReq.ride = riderReq.ride.createRide
            ? models.Ride.buildFromRider(riderReq.rider,riderReq.ride.rideType,riderReq.ride.public)
            : null;
          return Promise.all([
            ...riderTravelers.map(riderTrav => riderTrav.save()),
            ...riderUsers.map(riderUser => riderUser.save()),
            riderReq.ride 
              ? riderReq.ride.saveInitial(riderReq.rider) 
              : Promise.resolve(riderReq.ride)
          ]);
        });

    }));
    // End of POST/CREATE STEP #3 ---------------------------------------------------------

    
    // POST/CREATE STEP #4: Fetch resulting rider instance --------------------------------
    const riderIds = riderRequests.map(riderReq => riderReq.rider.id);
    const riderResponses = await createRidersResponse(riderIds,userId,infos,infos.travMap);

    // End of POST/CREATE STEP #4 ---------------------------------------------------------
    return res.status(200).send({riders: riderResponses});
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Route put: 
// Expecting request in the form PUT api/riders
// Allows only changes for:
// -- terminal (for the same airport)
// -- startTime (if compatible with via)
// -- addresses (if can be matched to a neighborhood of the same agglo)
// -- neighborhood (if associated to the same agglo)
// -- travelers (if the rider is associated to a via, such a via must be associated to traveler)
// -- requirements (but seats count must be higher than the travelers count)
// 
// STEP #1: fetch an array of RiderUser instances and checks whether the logged user is associated with them
//
// STEP #2: fetch airports, terminals, neighborhoods, agglos, vias, travelers based on the rider and rider requests
//
// STEP #3: if all requests are legit:
// save the new/updated custom address
// remove the unlinked addresses which are not associated to any entries anymore in the database
// save the updated rider instance
// update the associations: rider-traveler and rider-user
// -- if a ride is already associated with the rider, update it:
// ---- if alone in the ride, just update it
// ---- if the rider is the primary rider, check compatibilty
// ---- if the rider is a co-rider, check compatibility
// -- if no ride exists, create one from the rider
//
// STEP #4: fetch the resulting rider instances and format them in JSON for response
router.put('/',auth.required,async (req, res, next) => {
  if(!req.body.riders || !Array.isArray(req.body.riders)){
    return res.status(422).send({errors: {riders: 'Body must include a riders field of type array'}});
  
  } else if (!req.body.riders.length){
    return res.status(422).send({errors: {riders: 'Riders field is an empty array'}});
  }

  /** @type {Array<JetRiderUpdateRequest>} */
  const riderRequests = req.body.riders;
  const errors = {errors: {}};
  
  if(!riderRequests.every((riderRequest, ind) => models.inputs.rider.validate.updateRequest(riderRequest,ind,errors)))
    return res.status(422).send({errors});

  try{
    // PUT ROUTE: STEP #1: Fetch the referenced riderUser and userTrav map -------------------
    /** @type {string} */
    const userId = req.payload.id;

    const userRiders = await models.RidersUsers.findAll({
      where: {id: {[Op.in]: riderRequests.map(request => request.ref)}},
      attributes: resAttr.RIDER_USER_ATTRIBUTES
    });
  
    // CHECK #1: all riderUser ref can be matched
    if(!riderRequests.every((riderRequest,ind) => {
      const userRider = userRiders.find(userRider => userRider.id === riderRequest.ref);
      if(!userRider){
        errors.errors[`userRider${ind}`] = 'Rider could not be found';
        return false;
      }
      riderRequest.riderUser = userRider;
      return true;
    })){
      return res.status(404).send(errors);
    }

    // CHECK #2: all riderUser can be matched to the logged user
    if(!riderRequests.every((riderRequest,ind) => {
      if(riderRequest.riderUser.user_id !== userId){
        errors.errors[`userRider${ind}`] = 'Logged user could not be matched with rider reference';
        return false;
      }
      return true;
    })){
      return res.status(403).send(errors);
    }

    const riderIds = riderRequests.map(riderRequest => riderRequest.riderUser.rider_id);
    // End of PUT ROUTE: STEP #1 ----------------------------------------------------------


    // PUT ROUTE: STEP #2: Fetch the riders instances -------------------------------------
    // then fetch the infos and populate the riders
    const riders = await models.Rider
      .findAll({
        where: {id: {[Op.in]: riderIds}},
        attributes: models.queries.FETCH_UPDATING_RIDER.attributes,
        include: models.queries.FETCH_UPDATING_RIDER.include
      });

    if(!riderRequests.every((riderRequest,ind) => {
      riderRequest.rider = riders.find(rider => rider.id === riderRequest.riderUser.rider_id);
      riderRequest.airportLocation.airportCode = riderRequest.rider.airport_id;      

      if(!riderRequest.rider){
        errors.errors[`rider${ind}`] = 'Rider could not be found';
        return false;
      }
      return true;
    })){
      return res.status(404).send(errors);
    }
    // End of PUT ROUTE: STEP #2 ----------------------------------------------------------



    // PUT ROUTE: STEP #3: Fetch the rider/rider requests details -------------------------
    // then populate each rider in preparation for update
    const infos = await models.inputs.rider.fetch.updateInfos(req.payload.id,riders,riderRequests);
    
    if(!models.inputs.rider.populate.updateRequests(riderRequests,infos,errors))
      return res.status(422).send(errors);
    // End of PUT ROUTE: STEP #2 ----------------------------------------------------------


    // PUT ROUTE STEP #4: creates custom address and fetches their neighborhoods ----------
    // + fetches all the users associated with the travelers in the rider requests
    // to create riderUser instance
    // + fetches the current ride, the suspended ride and the pending applications for
    // all significant update request
    const unlinkedAddresses = models.inputs.rider.get
      .unlinkedAddressIds(riderRequests)
      .map(addressId => ({addressId, remove: true}));

    const allTravelers = models.inputs.rider.get.updateTravelerIds(riderRequests);

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(allTravelers),
      models.inputs.rider.populate.missingHoodUpdate(riderRequests),
      ...unlinkedAddresses.map(entry => {
        return models.Address
          .shouldRemove(entry.addressId)
          .then(remove => entry.remove = remove);
      })
    ]);

    if(!riderRequests.every((riderReq,index) => {
      if(!riderReq.cityLocation.hood){
        errors.errors[`rider${index}`] = 'Rider\'s address could not be associated with a neighborhood';  
        return false;
      }
      riderReq.rider.neighborhood_id = riderReq.cityLocation.hood.id;
      return true;
    })){
      return res.status(404).send(errors);
    }
    // End of POST/CREATE STEP #4 ---------------------------------------------------------


    // PUT STEP #5: Save rider instances --------------------------------------------------
    await Promise.all(
      riderRequests.map(riderReq => {
        return ( riderReq.cityLocation.customAddress
          ? riderReq.cityLocation.address.save()
          : Promise.resolve(riderReq.cityLocation.address)
        ).then(() => {
          riderReq.rider.address_id = riderReq.cityLocation.address ?
            riderReq.cityLocation.address.id : null;
          return riderReq.rider.save();
        });
      })
    );

    const newRiderTravs = [];
    const delRiderTravs = [];
    const newRiderUsers = [];
    const delRiderUsers = [];

    riderRequests.forEach(riderRequest => {
      const updRiderTravs = models.RidersTravelers.updateFromRequest(riderRequest);
      const updRiderUsers = models.RidersUsers.updateFromRequest(riderRequest,travUsersMap);

      newRiderTravs.push(...updRiderTravs.newRiderTravs);
      delRiderTravs.push(...updRiderTravs.delRiderTravs);
      newRiderUsers.push(...updRiderUsers.newRiderUsers);
      delRiderUsers.push(...updRiderUsers.delRiderUsers);
    });
    // End of POST/CREATE STEP #5 ---------------------------------------------------------


    // PUT STEP #6: Update rider-traveler, rider-user, and ride-rider associations --------
    // also destroy unlinked address instances not associated with any user/traveler
    await Promise.all([
      ...riderRequests.map(riderReq => riderReq.rider.propagate(riderReq.ride)),
      ...newRiderTravs.map(riderTrav => riderTrav.save()),
      ...newRiderUsers.map(riderUser => riderUser.save()),
      ...delRiderTravs.map(riderTrav => riderTrav.destroy()),
      ...delRiderUsers.map(riderUser => riderUser.destroy()),
      unlinkedAddresses.length
        ? models.Address.destroy({where: {id: {[Op.in]: unlinkedAddresses.map(entry => entry.addressId)}}})
        : Promise.resolve()
    ]);
    // End of POST/CREATE STEP #6 ---------------------------------------------------------

    // PUT ROUTE STEP #7: Fetch resulting rider instances ---------------------------------
    const riderResponses = await createRidersResponse(riderIds,userId,infos,infos.travMap);

    // End of PUT STEP #7 -----------------------------------------------------------------
    return res.status(200).send({riders: riderResponses});
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Route delete: 
// Expecting request in the form DELETE api/riders
// Expecting parameter riderRef='hexstring' & riderRef='hexstring' etc...
router.delete('/',auth.required, async (req,res,next) => {

  /** @type {Array<string>} */
  const riderUserIds = (req.query.riderRef
    ? Array.isArray(req.query.riderRef) ? req.query.riderRef : [req.query.riderRef]
    : [])
    .filter(riderUserId=> riderUserId.toString('hex') === riderUserId);

  /** @type {string} */
  const password = req.query ? req.query.password : null;

  if(!riderUserIds.length){
    return res.status(422).send({errors: {riderRef: 'Must provide at least one riderRef to delete'}});
  }

  if(!password || typeof password !== 'string')
    return res.status(422).send({errors: {password: 'Must provide the user password as parameters'}})
  
  try{
    const [riderUsers,user] = await Promise.all([
      models.RidersUsers.findAll({
        where: {id: {[Op.in]: riderUserIds}},
        attributes: resAttr.RIDER_USER_ATTRIBUTES
      }),
      models.User.findByPk(req.payload.id)
    ]);

    if(!user)
      return res.status(404).send({errors: {user: 'User could not be found'}});

    if(riderUsers.length < riderUserIds.length){
      return res.status(404).send({errors: 
        {riderUser: `${riderUserIds.length - riderUsers.length} rider(s) could not be found`}
      });
    }

    if(riderUsers.some(riderUser => riderUser.user_id !== req.payload.id)){
      return res.status(403).send({errors: {riderUser: 'The logged user is not authorized to delete at least one referenced rider'}});
    }

    if(await !user.validPassword(password))
      return res.status(403).send({errors: {password: 'is not valid'}});

    const riderIds = {};
    riderUsers.forEach(riderUser => riderIds[riderUser.rider_id] = true);

    if(riderUserIds.length > Object.keys(riderIds).length)
      return res.status(404).send({riders: `requested to delete ${Object.keys(riderUserIds).length} rider reference(s), only ${riderIds.length} were found`});

    await models.Rider.destroy({where: {id: {[Op.in]: Object.keys(riderIds)}}}); // will trigger "cascadeRidesAddresses" hook in Rider
    return res.status(203).send({success: 'riders were deleted'});

  } catch(error){
    next(error);
  }
});


module.exports = router;
