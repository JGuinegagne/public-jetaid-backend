const express = require('express');
const moment = require('moment');

const auth = require('../authorization');

/** @type {JetModels} */
const models = require('../../models');

const resAttr = require('../../utils/commonResAttr');

const router = express.Router();
const Op = models.sequelize.Op;

// ************************************************************************************************
// COMMON FUNCTIONS

/** Fetches all the info necessary to display a collections of trips to a user
 * @param {string} userId of the user to which the info is displayed
 * @param {Array<string>} tripIds of the trip instances to be fetched
 * @param {{[travId: string]: JetUserTravelerInstance}} travUserTravMap
 * @return {Promise<Array<JetTripResponse>>}*/
const createTripsResponse = function(userId, tripIds, travUserTravMap = {}){
  return models.Trip.findAll({
    where: {id: {[Op.in]: tripIds}},
    attributes: resAttr.TRIP_ATTRIBUTES,
    include: [
      {
        model: models.User,
        attributes: resAttr.LOGIN_USER_ATTRIBUTES,
        where: {id: userId},
        through: {
          attributes: resAttr.TRIP_USER_ATTRIBUTES
        }
      },
      models.queries.FETCH_VIAS
    ]
  }).then(trips => {
    trips.sort((t1,t2) => t1.compareTo(t2));
    return trips.map(trip => trip.createResponse(trip.Users[0].TripsUsers, travUserTravMap));
  });
};



// ************************************************************************************************
// Route post: creates a set of new trips
// Expecting request in the form POST api/trips
// For each trips:
//
// STEP #1: 
// -- pulls the airports, terminals, airlines associated to each requests
// STEP #2: 
// -- creates and persists the trip instance
// -- creates and persists each via instance
// -- pulls all the users associated with all the travelers
// STEP #3:
// -- associate the correct travelers to each changed or new vias
// -- associate the correct users to the trip based on the travelers of each vias
// STEP #4:
// -- pulls the final trip results with its associated vias, travelers and users
router.post('/', auth.required, async (req, res, next) => {
  if(!req.body.trips || !Array.isArray(req.body.trips)){
    return res.status(422).send({errors: {trips: 'Request must includes a \'trips\' property of type Array'}});
  }

  /** @type {Array<JetTripRequest>}*/ const tripRequests = req.body.trips;
  /** @type {JetErrors}*/ const errors = {errors: {}};

  if(!tripRequests.length){
    return res.status(422).send({errors: {trips: 'Request.body.trips must not be empty'}});

  } else if(!tripRequests.every((tripRequest,ind) => {
    return models.inputs.trip.validate.request(tripRequest,ind,errors,false);
  })){
    return res.status(422).send(errors);
  }

  try{
    // STEP #1: fetch the required data to populate each trip/via requests ----------------
    const infos = await models.inputs.trip.fetch.infos(tripRequests,req.payload.id);

    // then populate each trip request, returns an error if not possible
    if(!models.inputs.trip.populate.requests(tripRequests,infos,errors))
      return res.status(422).send(errors);
    // END of STEP #1 ---------------------------------------------------------------------

    
    // STEP #2: create and persist trip / via entries in the database ---------------------
    const travelerIds = models.inputs.trip.get.travelerIds(tripRequests);

    // build trips and vias instances   
    tripRequests.forEach(tripRequest => {
      tripRequest.trip = models.inputs.trip.build.trip(tripRequest,req.payload.id);
      
      tripRequest.vias.forEach(viaRequest => {
        viaRequest.via = models.inputs.trip.build.via(tripRequest.trip,viaRequest);
      });

      tripRequest.vias
        .sort((vr1,vr2) => vr1.via.compareByStartDateTime(vr2.via))
        .forEach((viaReq,ord) => {
          viaReq.via.ordinal = ord; 
        });
    });

    const [travUsersMap] = await Promise.all([
      models.UsersTravelers.createTravsUsersMap(travelerIds),
      ...tripRequests.map(tripRequest => {
        return tripRequest.trip
          .save()
          .then(() => {
            return Promise.all(tripRequest.vias.map(viaReq => viaReq.via.save()));
          });
      })
    ]);
    // END of STEP #2 ---------------------------------------------------------------------


    // STEP #3: create via-travelers and trip-users associations --------------------------
    /** @type {Array<JetTripUserInstance>} */const newTripUsers = [];
    /** @type {Array<JetViaTravelerInstance>} */ const newPassengers = [];

    tripRequests.forEach(tripRequest => {
      newTripUsers.push(...models.TripsUsers.buildFromRequest(tripRequest,travUsersMap));
      
      tripRequest.vias.forEach(viaRequest => {
        newPassengers.push(...models.ViasTravelers.buildFromRequest(viaRequest));
      });
    });

    await Promise.all([
      ...newTripUsers.map(tripUser => tripUser.save()),
      ...newPassengers.map(pax => pax.save())
    ]);
    // END of STEP #3 ---------------------------------------------------------------------


    // STEP #4: fetch the resulting Trips extended infos ----------------------------------
    const tripResp = await createTripsResponse(
      req.payload.id, 
      tripRequests.map(tripReq => tripReq.trip.id),
      infos.travMap
    );
    // END of STEP #4 ---------------------------------------------------------------------

    return res.status(200).send(tripResp);
  
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route put: update one particular trip
// Expecting request in the form api/trips/
//
// STEP #1: 
// -- pulls the referenced tripUser
// STEP #2: 
// -- pulls the trip associated to trip User
// -- pulls the airports, terminals, airlines associated to each requests
// STEP #3:
// -- adds new vias, update changed vias, destroy removed vias
// -- pulls all the viaTravelers
// -- pulls all the tripsUsers currently associated with the trip
// -- pulls all the users associated with all the travelers
// STEP #4:
// -- associate the correct travelers to each changed or new vias
// -- associate the correct users to the trip based on the travelers of each vias
// STEP #5:
// -- pulls the final trip results with its associated vias, travelers and users
router.put('/', auth.required, async (req,res,next) => {
  if(!req.body.trip)
    return res.status(422).send({errors: {trips: 'Request must includes a "trip" property'}});
  
  if(!req.body.trip.tripUser || !req.body.trip.tripUser.ref)
    return res.status(422).send({errors: {tripUser: 'Request must include a trip.tripUser.ref property'}});

  /** @type {JetTripRequest}*/ const tripRequest = req.body.trip;
  /** @type {JetErrors} */const errors = {errors: {}};

  if(!models.inputs.trip.validate.request(tripRequest,0,errors,true))
    return res.status(422).send({errors});

  // the presence of tripUser.ref is checked in isValidTripRequest
  const tripUserRef = tripRequest.tripUser.ref;

  // PUT STEP #1: retrieves the tripUser instance ------------------------------------------------
  try{
    const tripUser = await models.TripsUsers.findById(tripUserRef, {attributes: resAttr.TRIP_USER_ATTRIBUTES});
    if(!tripUser)
      return res.status(404).send({errors: {tripUser: 'Trip couldn\'t be found'}});
    // END of PUT STEP #1 ------------------------------------------------------------------------


    // PUT STEP #2: fetches the trip, current vias and association data of requested vias --------
    const [trip,tripUsers,infos] = await Promise.all([
      models.Trip.findById(tripUser.trip_id, models.queries.FETCH_UPDATING_TRIP),
      models.TripsUsers.findAll({where: {trip_id: tripUser.trip_id}, attributes: resAttr.TRIP_USER_ATTRIBUTES}),
      models.inputs.trip.fetch.infos([tripRequest],req.payload.id)
    ]);

    if(!trip)
      return res.status(404).send({trips: 'trip could not be found'});
    
    trip.id = tripUser.trip_id;
    trip.UserLinks = tripUsers;
    tripRequest.trip = trip;

    // populate the trip update request

    if(!models.inputs.trip.populate.updateRequest(tripRequest, infos, errors))
      return res.status(422).send(errors);
    // END of PUT STEP #2 --------------------------------------------------------------------- 


    // PUT STEP #3: compares the current and existing vias ------------------------------------
    // persists the 'add' vias
    // remove the 'del' vias
    // update the 'chg' vias
    const finalTravIds = models.inputs.trip.get.finalTravelerIds(tripRequest);
    
    const[updTrip,travUsersMap] = await Promise.all([
      models.sequelize.transaction(t => models.handlers.trip.updateVias(
        tripRequest.trip,
        tripRequest.finalVias,
        tripRequest.remainingVias,
        tripRequest.delVias
        ,t
      )), // <-- will trigger "cascadeRiderPax" hook in via for deleted vias
      // <------ will cascade to rider->rides, pax->members & tasks
      models.UsersTravelers.createTravsUsersMap(finalTravIds)
    ]);
    // END of PUT STEP #3 -----------------------------------------------------------------


    // PUT STEP #4: update associations ---------------------------------------------------
    const tripUsersWrapper = models.TripsUsers.updateFromRequest(tripRequest,travUsersMap,req.payload.id);

    /** @type {Array<JetViaTravelerInstance>} */const delPassengers = [];
    /** @type {Array<JetViaTravelerInstance>} */const chgPassengers = [];
    /** @type {Array<JetViaTravelerInstance>} */const newPassengers = [];

    tripRequest.vias
      .filter(viaRequest => viaRequest.update === 'chg' || viaRequest.update === 'add')
      .forEach(viaRequest => {
        const paxWrapper = models.ViasTravelers.updateFromRequest(viaRequest);

        delPassengers.push(...paxWrapper.delPassengers);
        newPassengers.push(...paxWrapper.newPassengers);
        chgPassengers.push(...paxWrapper.chgPassengers);
      });

    await Promise.all([
      ...tripRequest.vias
        .filter(viaRequest => viaRequest.update === 'chg')
        .map(viaRequest => viaRequest.via.propagate()), // <-- propagates changes to rider->rides, own tasks->members and members->tasks
      ...tripUsersWrapper.delTripUsers.map(tripUser => tripUser.destroy()),
      ...tripUsersWrapper.newTripUsers.map(tripUser => tripUser.save()),
      tripUsersWrapper.updTripUser
        ? tripUsersWrapper.updTripUser.save({fields: ['alias']})
        : Promise.resolve(tripUser),
      delPassengers.length // will trigger hook cascadeRiderTasker in ViasTravelers (pax), cascading to riders->rides, members->tasks
        ? models.ViasTravelers.destroy({where: {id: {[Op.in]: delPassengers.map(pax => pax.id)}}})
        : Promise.resolve([]),
      ...chgPassengers.map(pax => pax.save({fields: ['volunteer']})),
      ...newPassengers.map(pax => pax.save())
    ]);
    // END of PUT STEP #4 -----------------------------------------------------------------

    // PUT STEP #5: fetch the resulting Trips extended infos ------------------------------
    const tripResponse = await createTripsResponse(req.payload.id,[updTrip.id],infos.travMap);
    // END of PUT STEP #5 -----------------------------------------------------------------
    
    return res.status(200).json(tripResponse.length ? tripResponse[0] : {});

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Register param :user_trip_id
// Expecting request in the form api/trips/:user_trip_id
// Adds fields .tripUser
// This param should be registered after POST and PUT trips
router.param('user_trip_id',(req,res,next,id) => {
  models.TripsUsers.findById(id, {attributes: resAttr.TRIP_USER_ATTRIBUTES})
    .then(tripUser => {
      if(tripUser){
        req.tripUser = tripUser;
        next();
      } else {
        return res.status(404).send({errors: {tripUser: 'link user-trip not found'}});
      }
    }).catch(next);
});

// ************************************************************************************************
// AUTHENTICATION MIDDLEWARE
/** Checks that the logged user is associated with the target trip
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next */
const checkAuth = function(req, res, next){
  if(!req.tripUser || !req.payload || !req.payload.id){
    return res.status(404).send({errors: {user: 'user-trip link not found'}});
  }

  if(req.tripUser && req.payload && req.tripUser.user_id !== req.payload.id){
    return res.status(403).send({erros: {tripUser: 'logged user is not authorized to alter this trip'}});
  }
  next();
};


// ************************************************************************************************
// Route put: update one particular trip
// Expecting request in the form api/trips/alias
// change the alias of a trip - no other changes
// ************************************************************************************************
router.put('/:user_trip_id/alias', auth.required, async (req, res, next) => {
  try {
    /** @type {JetTripUserInstance} */
    const tripUser = req.tripUser;
    if(typeof req.body.alias !== 'string')
      return res.status(422).send({errors: {alias: 'Alias update request must have a body.alias of type string'}});

    if(!tripUser.setAlias(req.body.alias))
      return res.status(422).send({errors: {alias: 'Requested alias is invalid'}});

    return tripUser
      .save({fields: ['alias']})
      .then(() => res.status(200).send(tripUser.createResponse()));

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route delete: delete one particular trip
// Expecting request in the form api/trips/:user_trip_id
// Will need to cascade to the rides
router.delete('/:user_trip_id', auth.required, checkAuth, async (req,res,next) => {
  try{
    const password = req.query ? req.query.password : null;
    if(!password || typeof password !== 'string')
      return res.status(422).send({errors: {password: 'Must pass password as parameter'}});

    const user = await models.User.findByPk(req.tripUser.user_id);
    if(!user)
      return req.status(404).send({errors: {user: 'User not found'}});

    if(!await user.validPassword(password))
      return res.status(403).send({errors: {password: 'Is invalid'}});

    const trip = await models.Trip.findById(req.tripUser.trip_id, {attributes: ['id']});

    if(trip){
      await trip.destroy();
      return res.status(203).send({success: 'Trip was removed'});

    } else {
      return res.status(404).send({errors: {trip: 'Trip could not be found'}});
    }

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Route get: obtain info on one particular trip
// Expecting request in the form api/trips/:user_trip_id
router.get('/:user_trip_id', auth.required, checkAuth, async (req,res,next) => {
  try{
    const userTravelersMap = await models.UsersTravelers.createUserTravsMap(req.payload.id);
    const tripResp = await createTripsResponse(req.payload.id,[req.tripUser.trip_id],userTravelersMap);

    if(tripResp && tripResp.length){
      return res.status(200).json(tripResp[0]);
    } else {
      return res.status(404).send({errors: {trip: 'Could not fetch trip infos'}});
    }
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route get: list all trips associated to a particular user
// Expecting request in the form api/trips/
// Optional parameters: 
// -- travelers: filters on trips whose vias include at least one of the travelers
// -- minStartDate: filters on trips for which the first via starts on or after this date
// -- maxStartDate: filters on trips for which the first via starts on or before this date
// -- minEndDate: filters on trips for which the last via ends on or after this date
// -- maxEndDate: filters on trips for which the last via ends on or before this date
// -- limit
// -- offset
router.get('/',auth.required, async (req,res,next) => {
  // LIMIT & OFFSET filters
  const limit = req.query.number && Number.isInteger(Number(req.query.number))
    ? Number(req.query.number) : 5;

  const offset = req.query.offset && Number.isInteger(Number(req.query.offset))
    ? Number(req.query.offset) : 0;

  // TRAVELERS filter
  const queryTravelers = req.query.traveler 
    ? Array.isArray(req.query.traveler) 
      ? req.query.traveler 
      : [req.query.traveler]
    : [];

  const filterTravelers = queryTravelers.filter(travId => travId.toString('hex') === travId);
  
  /** @type {{[travId: string]: boolean}} */
  const travelerFilter= {};

  // DATE filters
  const minStartDate = req.query.minstartdate && moment(req.query.minstartdate,'YYYY-MM-DD').isValid()
    ? moment(req.query.minstartdate,'YYYY-MM-DD') : null;

  const maxStartDate = req.query.maxstartdate && moment(req.query.maxstartdate,'YYYY-MM-DD').isValid()
    ? moment(req.query.maxstartdate,'YYYY-MM-DD') : null;

  const minEndDate = req.query.minenddate && moment(req.query.minenddate,'YYYY-MM-DD').isValid()
    ? moment(req.query.minenddate,'YYYY-MM-DD') : null;

  const maxEndDate = req.query.maxenddate && moment(req.query.maxenddate,'YYYY-MM-DD').isValid()
    ? moment(req.query.maxenddate,'YYYY-MM-DD') : null;

  // checks that the date filters are consistent
  if(minStartDate && maxStartDate && minStartDate.isAfter(maxStartDate,'d')){
    return res.status(422).send({errors: {date: 'Min start date must be same or before max start date'}});
  }

  if(minEndDate && maxEndDate && minEndDate.isAfter(maxEndDate,'d')){
    return res.status(422).send({errors: {date: 'Min end date must be same or before max end date'}});
  }

  if(minStartDate && maxEndDate && minStartDate.isAfter(maxEndDate,'d')){
    return res.status(422).send({errors: {date: 'Min start date must be same of before max end date'}});
  }

  // ENFORCE filters
  // --> travelers: at least one via must have one of the travelers
  /** @type {(trip: JetTripInstance) => boolean}*/
  const filterByTravelers = filterTravelers.length 
    ? (trip) => !!trip.vias.find(via => {
      return !!via.Travelers.find(traveler => {
        return !!travelerFilter[traveler.ViasTravelers.traveler_id];
      });
    })
    : null;

  // --> start date: dep_date of the first via of a trip
  /** @type {(trip: JetTripInstance) => boolean}*/
  const startDateFilter = minStartDate && maxStartDate
    ? via => moment(via.dep_date).isSameOrAfter(minStartDate,'d') && moment(via.dep_date).isSameOrBefore(maxStartDate,'d')
    : minStartDate 
      ? via => moment(via.dep_date).isSameOrAfter(minStartDate,'d')
      : maxStartDate 
        ? via => moment(via.dep_date).isSameOrBefore(maxStartDate,'d')
        : null;

  // --> end date: arr_date of the last via of a trip
  /** @type {(trip: JetTripInstance) => boolean}*/
  const endDateFilter = minEndDate && maxEndDate
    ? via => moment(via.arr_date).isSameOrAfter(minEndDate,'d') && moment(via.arr_date).isSameOrBefore(maxEndDate,'d')
    : minEndDate 
      ? via => moment(via.arr_date).isSameOrAfter(minEndDate,'d')
      : maxEndDate 
        ? via => moment(via.arr_date).isSameOrBefore(maxEndDate,'d')
        : null;

  // --> combine start and end date filters
  /** @type {(trip: JetTripInstance) => boolean}*/
  const filterByDates = (minStartDate || maxStartDate) && (minEndDate || maxEndDate)
    ? trip => startDateFilter(trip.vias[0]) && endDateFilter(trip.vias[trip.vias.length - 1])
    : (minStartDate || maxStartDate)
      ? trip => startDateFilter(trip.vias[0])
      : (minEndDate || maxEndDate)
        ? trip => endDateFilter(trip.vias[trip.vias.length - 1])
        : null;

  // --> final filter: combines travelers and dates filters
  /** @type {(trip: JetTripInstance) => boolean}*/
  const filterTrip = filterByTravelers && filterByDates
    ? trip => trip.vias.length ? filterByTravelers(trip) && filterByDates(trip) : false
    : filterByTravelers
      ? trip => trip.vias.length ? filterByTravelers(trip) : false
      : filterByDates
        ? trip => trip.vias.length ? filterByDates(trip) : false
        : trip => trip.vias.length;
  

  // STEP #1: fetch all the trips associated with the user making the request -------------
  // then filter them according to the parameters -----------------------------------------
  try{
    const [extendedUser,userTravelersMap] = await Promise.all([
      models.User.findById(req.payload.id, {
        attributes: ['public_name'],
        include: [{
          model: models.Trip,
          attributes: resAttr.TRIP_ATTRIBUTES,
          through: {
            attributes: resAttr.TRIP_USER_ATTRIBUTES,
          },
          include: models.queries.FETCH_VIAS
        }]
      }),
      models.UsersTravelers.createUserTravsMap(req.payload.id)
    ]);

    if(!extendedUser){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(!extendedUser.Trips){
      return res.status(500).send({errors: {trips: 'Trip list could not be retrieved'}});
    }

    if(filterTravelers.length){
      Object.keys(userTravelersMap).forEach(travId => {
        const userTrav = userTravelersMap[travId];
        travelerFilter[travId] = filterTravelers.includes(userTrav.id);
      });
    }

    // --> enforce filter and sort chronologically (ASC by start date of the first via)
    const trips = extendedUser.Trips
      .filter(filterTrip)
      .sort((t1,t2) => t1.compareTo(t2))
      .filter((t,index) => index >= offset && index - offset < limit);
    // END of STEP #1 -----------------------------------------------------------------------


    // STEP #2: format and return filtered trips --------------------------------------------
    if(trips.length){
      return res.status(200).send({
        tripsCount: trips.length, 
        trips: trips.map(trip => trip.createResponse(trip.TripsUsers,userTravelersMap))
      });
    } else {
      return res.status(200).send({tripsCount: 0, trips: []});
    }
    // END of STEP #2 -----------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});



module.exports = router;