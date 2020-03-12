const express = require('express');

const auth = require('../authorization');
const checkMsg = require('../checkMsg');

/** @type {JetModels} */
const models = require('../../models');

const resAttr = require('../../utils/commonResAttr');
const fieldProperties = require('../../utils/fieldProperties');

const RIDE_STATUS = require('../../utils/commonFields').RIDE_STATUS;
const RIDER_STATUS = require('../../utils/commonFields').RIDER_STATUS;

const Op = models.sequelize.Op;


// ************************************************************************************************
/** Rides routes:
* + GET/review: review ride 
* + GET/find: finds rides using ownRiderRef param as filter
* + POST/agree: agrees to a change counter from the admins of a ride applied to, and join the ride
* + GET/ride_rider_id: gets details on one particular ride based on owner's rideRider id
* + POST/ride_rider_id/save: saves a ride
* + DELETE/ride_rider_id/save: unsaves a ride
* + POST/ride_rider_id/apply: applies to join a ride  with a changeRequest param (may be empty)
* + DELETE/ride_rider_id/apply: cancels an application to join a ride
* + PUT/ride_rider_id/apply: udpates the change request of a join application
* + POST/ride_rider_id/leave: leaves the current ride and reactivate suspended ride
* + POST/ride_rider_id/write: writes an additional message to the rideRider channel
*
* TODO --> update ALL counters of pending applications when accept a counter
*/
const router = express.Router();



// ************************************************************************************************
// COMMON FUNCTIONS

/** Fetches the ride, filtering rider and ownRideRider info associated with:
 * + the target ride identified by the request param :ride_rider_id
 * + the filtering rider identified by the token param: riderId
 * + rideRider associated to the ride and the rider, if any
 * 
 * On success, will add req.ride, req.rider, req.curRideRider, and finally
 * req.travUserTravMap to map the travelers of the target ride to the private infos of the logged
 * user identified by req.payload.id.
 * 
 * Used in conjunction with ride_rider_id in routes: /get, /save, /apply, /write
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const fetchProspectiveRide = async function(req, res, next){

  if(!req.query 
    || typeof req.query.ownRiderRef !== 'string' 
    || req.query.ownRiderRef.toString('hex') !== req.query.ownRiderRef
  )
    return res.status(422).send({errors: {rider: 'Filtering parameter ownRiderRef cannot be null for this request.'}});

  /** @type {string} */
  const ownRiderId = req.query.ownRiderRef;

  if(!req.rideRider || !req.rideRider.ride_id){
    return res.status(422).send({errors: {ride: 'Missing id of the target ride'}}); 
  }

  try {
    await Promise.all([
      models.Ride
        .findById(req.rideRider.ride_id, models.queries.FETCH_PUBLIC_RIDE)
        .then(ride => {
          req.ride = ride;

          if(ride){
            const travIds = ride.getTravelerIds();
            const riderIds = ride.getRiderIds();
            if(!travIds.length){ // <-- implies riderIds is not empty
              return Promise.reject({errors: {ride: 'Ride was found but no traveler were associated'}});
            } else {
              return Promise.all([
                models.UsersTravelers
                  .createTravUserTravMap(req.payload.id,travIds)
                  .then(travUserTravMap => req.travUserTravMap = travUserTravMap),
                models.RidersUsers
                  .createRiderUserRiderMap(riderIds)
                  .then(riderUserRiderMap => req.riderUserRiderMap = riderUserRiderMap)
              ]);
            }

          } else {
            return Promise.reject({errors: {ride: 'Ride could not be found'}});
          }
        }),


      models.RidersUsers.findByPk(ownRiderId, {
        attributes: resAttr.RIDER_USER_ATTRIBUTES,
        include: [models.queries.FETCH_RIDER_HOODAGGLOTERM]
      
      }).then(riderUser => {
        if(!riderUser)
          return Promise.reject({status: 404, riderUser: 'Filtering rider could not be found'});

        if(riderUser.user_id !== req.payload.id)
          return Promise.reject({status: 403, riderUser: 'Logged user not authorized'});

        if(!riderUser.Rider)
          return Promise.reject({status: 404, rider: 'Filtering rider could not be found'});

        else {
          const rider = riderUser.Rider;
          delete riderUser.Rider;
          rider.UserLinks = [riderUser];

          req.ownRiderId = riderUser.rider_id;
          req.rider = rider;
          return riderUser.rider_id;
        }
        
      }).then(riderId => models.RidesRiders
        .findOne(Object.assign(
          models.queries.FETCH_SELECT_RIDE_RIDER, {
            where: {[Op.and]: [
              {ride_id: req.rideRider.ride_id},
              {rider_id: riderId}
            ]}
          })
        )
      ).then(rideRider => {
          req.curRideRider = rideRider;
        
          if(rideRider){
            return Promise.all([

              rideRider.request_id
                ? models.RideRiderRequest.findById(rideRider.request_id, models.queries.FETCH_RIDE_RIDER_REQUEST)
                  .then(request => req.curRequest = request)
                : Promise.resolve(),

              rideRider.counter_id
                ? models.RideRiderRequest.findById(rideRider.counter_id, models.queries.FETCH_RIDE_RIDER_REQUEST)
                  .then(counter => req.curCounter = counter)
                : Promise.resolve(),

              rideRider.convo_id
                ? models.Convo.findById(rideRider.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
                  .then(convo => {
                    req.convo = convo;
                  })
                : Promise.resolve()
            ]);

          } else {
            return Promise.resolve();
          }
        })
    ]);
    next();

  } catch(error){
    next(error);
  }
};

/** Checks the validity of an 'apply' or 'counter' request for change of a ride
 * 
 * When valid, will add proper fields to the req.body.changeRequest field.
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const checkChangeRequest = function(req, res, next){
  if(!req.body || !req.body.changeRequest){
    return res.status(422).send({errors: {request: 'Missing field "changeRequest" in body of the request'}});
  }

  /**@type {JetRideChangeRequest} */
  const changeReq = req.body.changeRequest;
  const errors = {};

  if(!models.RideRiderRequest.isValidChangeRequest(changeReq,errors)){ // TODO: use async?
    return res.status(422).send(errors);
  }  

  if(req.body.message && !models.Message.isValidRequest(req.body.message)){
    return res.status(422).send(errors);
  }
  
  next();
};


/** Fetches the ride associated with the rideRider saved in req.rideRider. 
 * On success, will add: 
 * + req.ride
 * + req.travUserTravMap to map the travelers of the target ride
 * to the private infos of the logged user identified by req.payload.id
 * + req.riderUser to keep track of the rider-user id of the filtering rider
 * 
 * Used in routes: /leave
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const fetchScheduledRide = async function(req, res, next){
  
  if(!req.rideRider || !req.rideRider.ride_id){
    return res.status(422).send({errors: {rideId: 'Missing id of the target ride'}}); 
  }

  try {

    const riderUser = await models.RidersUsers.findOne({
      attributes: resAttr.RIDER_USER_ATTRIBUTES,
      where: {[Op.and]: [
        {rider_id: req.rideRider.rider_id},
        {user_id: req.payload.id}
      ]}
    });
    
    if(!riderUser){
      return res.status(403).send({errors: {userRider: 'selected rideRider is not linked to the logged user'}});
    }

    req.riderUser = riderUser;
    
    // fetch the scheduled ride and trav->userTrav map necessary to create the response  
    await Promise.all([
      models.Ride
        .findById(req.rideRider.ride_id, models.queries.FETCH_PUBLIC_RIDE)
        .then(ride => {
          if(!ride)
            return Promise.reject({errors: {ride: 'Ride could not be found'}});
    
          req.ride = ride;
          const travIds = ride.getTravelerIds();
          const riderIds = ride.getRiderIds();
      
          if(!travIds.length)
            return Promise.reject({errors: {ride: 'Ride was found but no traveler were associated'}});
          
          return Promise.all([
            models.UsersTravelers
              .createTravUserTravMap(req.payload.id,travIds)
              .then(travUserTravMap => req.travUserTravMap = travUserTravMap),
            models.RidersUsers
              .createRiderUserRiderMap(riderIds)
              .then(riderUserRiderMap => req.riderUserRiderMap = riderUserRiderMap)
          ]);
        }),

      req.rideRider.convo_id
        ? models.Convo
          .findById(req.rideRider.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(convo => req.convo = convo)
        : Promise.resolve()
    ]);

    next();

  } catch(error){
    next(error);
  }
};


/** Retrieves the 'applicant' parameter with respect to a ride
 * 
 * On success, will add a req.applicant property
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const retrieveApplicant = async function(req, res, next){
  if(!req.query || typeof req.query.applicant !== 'string'){
    return res.status(422).send({errors: {applicant: 'applicant parameter is missing or is not a string'}});
  
  } else if(req.query.applicant.toString('hex') !== req.query.applicant){
    return res.status(422).send({errors: {applicant: 'applicant parameter must be an hex string'}});
  }

  try{
    const rideRider = await models.RidesRiders.findById(req.query.applicant,{
      attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
      include: [{
        model: models.Ride,
        // need ALL fields here
        include: models.queries.FETCH_PUBLIC_RIDE.include
      },{
        model: models.Rider,
        attributes: models.queries.FETCH_RIDER_TRAVSHOODTERM.attributes,
        include: models.queries.FETCH_RIDER_TRAVSHOODTERM.include
      }]
    });

    if(!rideRider){
      return res.status(404).send({errors: {applicant: 'ride-rider identified by applicant parameter could not be found'}});
    }

    
    /** @type {Array<string>} */
    const rideTravelerIds = rideRider.Ride.getTravelerIds();
    const riderIds = rideRider.Ride.getRiderIds();

    if(!rideTravelerIds.length){
      return res.status(500).send({rideRider: 'ride was identified but no associated travelers were found'});
    }

    if(riderIds.indexOf(rideRider.rider_id) === -1)
      riderIds.push(rideRider.rider_id);

    req.applicant = rideRider;
    req.ride = rideRider.Ride;
    req.rider = rideRider.Rider;

    await Promise.all([
      models.UsersTravelers
        .createTravUserTravMap(req.payload.id, rideTravelerIds)
        .then(travUserTravMap => req.travUserTravMap = travUserTravMap),

      models.RidersUsers
        .createRiderUserRiderMap(riderIds)
        .then(riderUserRiderMap => req.riderUserRiderMap = riderUserRiderMap),

      rideRider.request_id
        ? models.RideRiderRequest
          .findById(rideRider.request_id, {include: models.queries.FETCH_RIDE_RIDER_REQUEST.include})
          .then(request => req.request = request)
        : Promise.resolve(),

      rideRider.counter_id 
        ? models.RideRiderRequest
          .findById(rideRider.counter_id, {include: models.queries.FETCH_RIDE_RIDER_REQUEST.include})
          .then(counter => req.counter = counter)
        : Promise.resolve(),

      rideRider.convo_id
        ? models.Convo
          .findById(rideRider.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(convo => req.convo = convo)
        : Promise.resolve()
    ]);

    next();

  } catch(error){
    next(error);
  }
};


/** Retrieves the 'author' parameter as a rideRider of an existing ride.
 * 
 * On success, will add a req.author property
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const retrieveAuthor = async function(req, res, next){
  if(!req.query || typeof req.query.author !== 'string'){
    return res.status(422).send({errors: {author: 'author parameter is missing or is not a string'}});
  
  } else if(req.query.author.toString('hex') !== req.query.author){
    return res.status(422).send({errors: {author: 'author parameter must be an hex string'}});
  }

  let convoId = req.rideRider ? req.rideRider.convo_id : null;

  try{
    const [author,convo] = await Promise.all([
      models.RidesRiders.findById(req.query.author, {
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
        include: [{
          model: models.Ride,
          // need ALL fields here
          include: models.queries.FETCH_PUBLIC_RIDE.include
        },{
          model: models.Rider,
          attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES,
          include: [{
            model: models.User,
            attributes: resAttr.PUBLIC_USER_ATTRIBUTES,
            through: {
              attributes: resAttr.RIDER_USER_ATTRIBUTES
            }
          }]
        }]
      }),

      convoId
        ? models.Convo.findById(convoId, models.queries.FETCH_RIDE_RIDER_CONVO)
        : Promise.resolve(null)      
    ]);

    if(!author){
      return res.status(404).send({errors: {author: 'ride-rider identified by author parameter could not be found'}});
    }

    if(!author.Rider || !author.Rider.Users.find(user => user.RidersUsers.user_id === req.payload.id)){
      return res.status(403).send({errors: {author: 'ride-rider author is not associated with the logged user'}});
    }

    if(!fieldProperties.riderStatusAllowsMessage(author.status)){
      return res.status(403).send({errors: {author: `author status ${author.status} does not allow to post message`}});
    }

    /** @type {Array<string>} */
    const rideTravelerIds = author.Ride.getTravelerIds();
    const riderIds = author.Ride.getRiderIds();

    if(!rideTravelerIds.length){
      return res.status(500).send({rideRider: 'ride was identified but no associated travelers were found'});
    }

    if(riderIds.indexOf(author.rider_id) === -1)
      riderIds.push(author.rider_id);

    req.author = author;
    req.ride = author.Ride;
    req.convo = convo;

    await Promise.all([
      models.UsersTravelers
        .createTravUserTravMap(req.payload.id, rideTravelerIds)
        .then(travUserTravMap => req.travUserTravMap = travUserTravMap),
      models.RidersUsers
        .createRiderUserRiderMap(riderIds)
        .then(map => req.riderUserRiderMap = map),
      req.rideRider
        ? Promise.resolve() // even if the rideRider does not have a convo yet, keep it, otherwise will always override
        : author.convo_id
          ? models.Convo.findById(author.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
            .then(convo => req.convo = convo)
          : Promise.resolve()
    ]);

    next();

  } catch(error){
    next(error);
  }
};




// ************************************************************************************************
// Route get/find: fetch all the rides that match the criteria of a certain rider
// Expecting request in the form api/rides/find and a token with a riderId field
// This token.riderId is populated by a call to api/filters/assign/:rider_user_id
// STEP #1: from the token.riderId:
// -- fetch the rider information
// -- in parallel to STEP #2: find all the rideRider
// STEP #2: from the infos of the rider:
// -- fetch all the rides matching the criteria of the filtering rider
// FINALLY: combine rideRider infos 
router.get('/find', auth.required, async (req,res,next) => {  
  if(!req.query 
    || typeof req.query.ownRiderRef !== 'string' 
    || req.query.ownRiderRef.toString('hex') !== req.query.ownRiderRef
  )
    return res.status(422).send({
      errors: {rider: 'Filtering parameter ownRiderRef cannot be null for this request.'}
    });

  /** @type {string} */
  const ownRiderRef = req.query.ownRiderRef;


  try{
    // GET/FIND ROUTE: STEP #1 ------------------------------------------------------------
    const rider = await models.RidersUsers.findByPk(ownRiderRef, {
      attributes: resAttr.RIDER_USER_ATTRIBUTES,
      include: [models.queries.FETCH_SEARCH_RIDER]

    }).then(userRider => {
      if(userRider && userRider.Rider){
        const _rider = userRider.Rider;
        delete userRider.Rider;
        _rider.UserLinks = [userRider];
        return _rider;
      }
      return null;
    })
      
    if(!rider)
      return res.status(404).send({errors: {rides: 'filtering rider could not be found'}});

    if(!rider.UserLinks 
      || !rider.UserLinks.length 
      || rider.UserLinks[0].user_id !== req.payload.id
    )
      return res.status(403).send({errors: {riderUser: 'logged user not authorized'}});

    const riderRef = rider.UserLinks[0].rider_id;

    const currentRide = rider.Rides.length ? rider.Rides[0] : null; 
    // End of GET/FIND ROUTE: STEP #1 ----------------------------------------------------- 


    // GET/FIND ROUTE: STEP #2 ------------------------------------------------------------
    if(!rider){
      return res.status(404).send({errors: {rides: 'Filtration rider could not be found'}});
    }
    
    const rideWhere = {where: {
      [Op.and]: [
        {status: {[Op.in]: RIDE_STATUS.searchables}},
        {public: true},
        {date: {[Op.in]: [rider.date]}},
        {toward: rider.toward},
        {airport_id: rider.airport_id},
        {agglo_id: rider.Neighborhood.agglo_id}
      ]}
    };

    if(currentRide)
      rideWhere.where[Op.and].push({id: {[Op.not]: currentRide.id}});


    const [ridesRider,allRides] = await Promise.all([
      models.RidesRiders.findAll({
        where: {rider_id: riderRef},
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES
      }),
      models.Ride.findAll(
        Object.assign(rideWhere,models.queries.FETCH_SELECT_RIDE)
      ) 
    ]);
    // End of GET/FIND ROUTE: STEP #2 -----------------------------------------------------


    if(!allRides.length){
      return res.status(200).send({ridesCount: 0, rides: []});
    }

    /** @type {{[rideId: string]: JetRideRiderInstance}} */
    const rideRideRiderMap = {};
    ridesRider.forEach(rideRider => {
      rideRideRiderMap[rideRider.ride_id] = rideRider;
    });

    const errors = {};
    const rideResponses = allRides.map(ride => {
      const rideRider = rideRideRiderMap[ride.id];
      if(rideRider && !fieldProperties.riderStatusAllowsFind(rideRider.status)){
        return null;
      }
      return ride.createListResponse(rider, rideRider, errors, ownRiderRef);
    }).filter(resp => !!resp);

    if(!rideResponses){
      return res.status(422).send(errors);
    }

    return res.status(200).send({
      rideCount: rideResponses.length, 
      rides: rideResponses.sort((r1,r2) => -(r1.matchPercentile - r2.matchPercentile))
    });
    // ------------------------------------------------------------------------------------

  } catch (error){
    next(error);
  }
});


// ************************************************************************************************
// Route get/review: fetch all the rides for all the riders of an user
// Expecting request in the form api/rides/review
// Provides breakdown of scheduled / open / pending (applied for) / saved rides
// STEP #1: from the logged user:
// -- find all userRiders
// -- in parallel of STEP #3: find all userTravelers
// STEP #2: from all the riders identified in STEP #1: 
// -- find all the rideRiders
// -- in parallel of STEP #3: fetch all the rider infos
// STEP #3: from all the rides identified in STEP #2:
// -- fetch all the ride infos
// FINALLY: combine responses based on rideRiders for each category, avoiding ride duplicates
// within each category
router.get('/review', auth.required, async (req,res,next) => {  
  try{
    // GET/REVIEW ROUTE: STEP #1 ----------------------------------------------------------
    const step3Requests = [];

    step3Requests.push(models.UsersTravelers.createUserTravsMap(req.payload.id));

    const riderUsers = await models.RidersUsers.findAll({
      attributes: resAttr.RIDER_USER_ATTRIBUTES,
      where: {user_id: req.payload.id}
    });

    const response = {         
      scheduledRideCount: 0,
      openRideCount: 0,
      pendingRideCount: 0,
      savedRideCount: 0,
      applicantCount: 0,

      scheduledRides: [],
      openRides: [],
      pendingRides: [],
      savedRides: [],
      applicants: [] 
    };
      
    if(!riderUsers.length){
      return res.status(200).send(response);
    }
    // End of GET/REVIEW ROUTE: STEP #1 ---------------------------------------------------


    // GET/REVIEW ROUTE: STEP #2 ----------------------------------------------------------
    // --> fetch filtering riders infos
    step3Requests.push(models.Rider.findAll(Object.assign(models.queries.FETCH_RIDER_TRAVSHOODTERM,{
      where: {id: {[Op.in]: riderUsers.map(riderUser => riderUser.rider_id)}}
    })));

    // --> fetch all associated rides from rideRider (except status 'denied' and 'left')
    const allRideRiders = await models.RidesRiders.findAll({
      attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
      where: {[Op.and]: [
        {rider_id: {[Op.in]: riderUsers.map(riderUser => riderUser.rider_id)}},
        {status: {[Op.notIn]: RIDER_STATUS.exclusions}}
      ]}
    });
    // End of GET/REVIEW ROUTE: STEP #2 --------------------------------------------------- 


    // GET/REVIEW ROUTE: STEP #3 ----------------------------------------------------------
    /** Used as an organizer: fetches separately the rides - which require pulling a lot of infos - and the rideRiders
     * in order to avoid duplicating querying infos on rides. 
     * @type {{[rideId: string]: {ride: JetRideInstance, rideRiders: Array<JetRideRiderInstance>}}} */
    const rideIdMap = {};
    const adminRideIds = [];

    const allRideIds = allRideRiders
      .map(rideRider => {
        if(fieldProperties.riderStatusAllowsApprove(rideRider.status) && !adminRideIds.includes(rideRider.ride_id)){
          adminRideIds.push(rideRider.ride_id);
        }

        if(!rideIdMap[rideRider.ride_id]){
          rideIdMap[rideRider.ride_id] = {ride: null, rideRiders: [rideRider]};
          return rideRider.ride_id;              
        } else {
          rideIdMap[rideRider.ride_id].rideRiders.push(rideRider);
          return null;
        }    
      })
      .filter(rideId => !!rideId);

    if(!allRideIds.length){
      return res.status(200).send(response);
    }

    step3Requests.push(
      models.Ride.findAll(
        Object.assign(models.queries.FETCH_PUBLIC_RIDE, {
          where: {id: {[Op.in]: allRideIds}}
        })
      ),
      models.RidesRiders.findApplicants(adminRideIds)
    );

    const [travUserTravMap,allRiders,allRides,allApplicants] = await Promise.all(step3Requests);
    // End of GET/REVIEW ROUTE: STEP #3 --------------------------------------------------- 


    // --> GET/REVIEW mapping: add ride to rideId -> {ride, rideRiders}
    allRides.forEach(ride => rideIdMap[ride.id].ride = ride);

    /** @type {{[riderId: string]: JetRiderUserInstance}} */
    const riderUserRiderMap = {};
    riderUsers.forEach(ru => riderUserRiderMap[ru.rider_id] = ru);
 
    // --> GET/REVIEW route: compile response
    const errors = {};

    /** Avoids duplication of rides within each category
     * @type {{[key: string]: Array<string>}} */
    const matchedRideIds = {scheduled: [], open: [], pending: [], saved: []};

    // populate the rides by categories: scheduled / pending / open / saved
    allRideRiders.forEach(rideRider => {
      const ride = rideIdMap[rideRider.ride_id] 
        ? rideIdMap[rideRider.ride_id].ride 
        : null;

      if(!ride || !rideRider.status || !RIDER_STATUS.review.includes(rideRider.status))
        return null; // go to next rideRider

      const filterRider = allRiders.find(rider => rider.id === rideRider.rider_id);
      const riderUser = riderUserRiderMap[filterRider.id];

      const rideResponse = ride.createPublicResponse(
        filterRider,
        rideRider,
        errors,
        travUserTravMap,
        riderUser ? riderUser.id : null
      );

      if(rideResponse){
        switch(rideRider.status){
        case 'applied':
          if(!matchedRideIds.pending.includes(ride.id)){
            response.pendingRides.push(rideResponse);
            matchedRideIds.pending.push(ride.id);
          }
          break;

        case 'joined':
        case 'admin' :
          if(!matchedRideIds.scheduled.includes(ride.id)){
            response.scheduledRides.push(rideResponse);
            matchedRideIds.scheduled.push(ride.id);
          }
          break;

        case 'driver':
        case 'provider':
        case 'owner':
          if(rideResponse.riderCount > 1){
            if(!matchedRideIds.scheduled.includes(ride.id)){
              response.scheduledRides.push(rideResponse);
              matchedRideIds.scheduled.push(ride.id);
            }
          } else {
            if(!matchedRideIds.open.includes(ride.id)){
              response.openRides.push(rideResponse);
              matchedRideIds.open.push(ride.id);
            }
          }
          break;

        case 'saved':
          if(!matchedRideIds.saved.includes(ride.id)){
            response.savedRides.push(rideResponse);
            matchedRideIds.saved.push(ride.id);
          }
          break;

        default:
        }
      }
    });

    // ALL applicants to ride that have owner/admins rider to which the user is associated.
    allApplicants.forEach(applicant => {
      /** @type {JetApplicantResponse} */
      const applicantResp = applicant.createPublicResponse(travUserTravMap);
      const rideInfo = rideIdMap[applicant.ride_id];
      const grantor = rideInfo
        ? rideInfo.rideRiders
          .find(rideRider => rideRider.ride_id === applicant.ride_id && RIDER_STATUS.allowApprove.includes(rideRider.status))
        : null;
      applicantResp.rideRef = grantor ? grantor.id : null;

      if(applicantResp.rideRef) // <-- final check: adds ONLY if user is associated to a rider who is able to grant approval
        response.applicants.push(applicantResp);
    });

    response.scheduledRideCount = response.scheduledRides.length;
    response.pendingRideCount = response.pendingRides.length;
    response.openRideCount = response.openRides.length;
    response.savedRideCount = response.savedRides.length;
    response.applicantCount = response.applicants.length;

    return res.status(200).send(response);
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route POST/agree: rider agrees to the counter from a ride admin and joins the ride
// This will suspend the ride, and cancel other applications
// Expecting a request in the form POST api/rides/agree and a parameter 'applicant'
// representing the ride_rider_id of the application.
//
// Will update the rideRider.Request to match the counter and join the ride
router.post('/agree', auth.required, checkChangeRequest, checkMsg.optional, retrieveApplicant, async (req,res,next) => {
  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideRiderInstance} */
  const applicant = req.applicant;

  /** @type {JetRideRiderRequestInstance} */
  const curRequest = req.request;

  /** @type {JetRideRiderRequestInstance} */
  const curCounter = req.counter;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;

  /** @type {JetRideChangeRequest} */
  const acceptedCounter = req.body.changeRequest;


  if(!curRequest){
    return res.status(404).send({errors: {changeRequest: 'current change request not found'}});
  
  } else if (!curCounter){
    return res.status(404).send({errors: {counter: 'current counter to change request not found'}});
  
  }

  try{
    await curRequest.updateFromChangeRequest(acceptedCounter,ride);
  
    if(curRequest.differsFrom(curCounter)){
      return res.status(403).send({errors: {counter: 'Synchronization error: the current counter has changed'}});

    } else {
      const errors = {};
      await Promise.all([
        curRequest
          .saveAndUpdateDrops(ride,acceptedCounter)
          .then(request => {
            return ride.admit(applicant, req.rider, request, curCounter);
          }),
        req.body.message
          ? curConvo
            ? curConvo.createRideRiderMessage(ride,applicant,req.body.message,req.payload.id,errors)
            : models.Convo
              .createRideRiderConvo(applicant)
              .then(convo => {
                curConvo = convo;
                convo.createRideRiderMessage(ride,applicant,req.body.message,req.payload.id,errors);
              })
          : Promise.resolve()
      ]);

      if(curConvo && !req.convo){
        applicant.convo_id = curConvo.id;
        await applicant.save({fields: ['convo_id']});
      }

      const riderUser = req.riderUserRiderMap[applicant.rider_id];
      const [rideResp,msgResp] = await Promise.all([
        models.Ride.findById(applicant.ride_id, models.queries.FETCH_PUBLIC_RIDE)
          .then(_ride => {
            return _ride 
              ? _ride.createPublicResponse(
                applicant.Rider, 
                applicant, 
                errors, 
                req.travUserTravMap,
                riderUser ? riderUser.id : null      
              )
              : null;
          }),
        (req.body.message
          ? models.Convo.findById(curConvo.id, models.queries.FETCH_RIDE_RIDER_CONVO)
          : Promise.resolve(curConvo)
        ).then(_convo => {
          return _convo 
            ? _convo.createRideRiderResponse(req.payload.id, applicant, ride.Riders, req.riderUserRiderMap)
            : [];
        })
      ]);
      
      if(!rideResp){
        return res.status(500).send({ride: 'Ride was joined but could not be retrieved afterwards'});
      }

      return res.status(200).send({
        ride: rideResp, 
        messages: msgResp
      });
    }

  } catch(error){
    next(error);
  }
});



// ************************************************************************************************
// Register param :ride_rider_id of the target ride
// Expecting request in the form api/rides/:ride_rider_id
// Adds fields .rideRider
router.param('ride_rider_id', (req, res, next, id) => {
  models.RidesRiders.findById(id, {attributes: resAttr.RIDE_RIDER_ATTRIBUTES})
    .then(rideRider => {
      if(rideRider){
        req.rideRider = rideRider;
        next();
      } else {
        return res.status(404).json({errors: {rideRider: 'link ride-rider could not be found'}});
      }

    }).catch(next);
});


// ************************************************************************************************
// Route get: review the details of one particular ride
// Expecting request in the form api/rides/:ride_rider_id
router.get('/:ride_rider_id', auth.optional, async (req, res, next) => {

  /** @type {string} */
  const ownRiderRef = req.query && typeof req.query.ownRiderRef === 'string'
    && req.query.ownRiderRef.toString('hex') === req.query.ownRiderRef
      ? req.query.ownRiderRef
      : null;

  try{
    // GET ROUTE: STEP #1 -----------------------------------------------------------------
    await Promise.all([

      // fetch the ride info
      models.Ride.findById(
        req.rideRider.ride_id, 
        models.queries.FETCH_PUBLIC_RIDE
        
      ).then(ride => {
        req.ride = ride;
        if(ride && req.payload.id && ride.Riders.length){
          const rideTravelerIds = ride.getTravelerIds();
          const riderIds = ride.getRiderIds();
          return Promise.all([
            models.UsersTravelers
              .createTravUserTravMap(req.payload.id,rideTravelerIds)
              .then(travUserTravMap => {
                req.travUserTravMap = travUserTravMap;
              }),
            models.RidersUsers
              .createRiderUserRiderMap(riderIds)
              .then(map => {
                req.riderUserRiderMap = map;
              })
          ]);
        }
      }),

      // if a filtering rider is registered, fetch it
      !ownRiderRef
        ? Promise.resolve()
        : models.RidersUsers.findByPk(ownRiderRef,{
          attributes: resAttr.RIDER_USER_ATTRIBUTES,
          include: [models.queries.FETCH_RIDER_HOODAGGLOTERM]
        }).then(riderUser => {

          const rider = riderUser && riderUser.Rider
            ? riderUser.Rider
            : null;

          if(!rider)
            return Promise.reject({status: 404, rider: 'Rider could not be found'});

          if(riderUser.user_id !== req.payload.id)
            return Promise.reject({status: 403, riderUser: 'Logged user is not authorized'});

          delete riderUser.Rider;
          rider.UserLinks = [riderUser];
          req.rider = rider;
          return riderUser.rider_id
        
        // fetch the ride-rider associated with the filtering rider and ride
        // this will enable to populate private traveler fields
        }).then(riderId => 
          models.RidesRiders.findOne(
            Object.assign(
              models.queries.FETCH_SELECT_RIDE_RIDER,{
              where: {[Op.and]: [
                {ride_id: req.rideRider.ride_id},
                {rider_id: riderId}
              ]}        
            })
          )
        ).then(rideRider => {

          req.rideRider = rideRider;

          return rideRider && rideRider.convo_id
            ? models.Convo.findById(rideRider.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
              .then(convo => {
                req.convo = convo;
              })
            : Promise.resolve();
        })
    ])

    // End of GET ROUTE: STEP #1 ----------------------------------------------------------

    /** @type {JetRideInstance} */
    const ride = req.ride;

    /** @type {JetConvoInstance} */
    const convo = req.convo;

    if(!req.ride){
      return res.status(404).json({errors: {ride: 'Ride could not be found'}});
    }

    const errors = {};
    const rideResponse = ride.createPublicResponse(
      req.rider, 
      req.rideRider, 
      errors, 
      req.travUserTravMap,
      ownRiderRef
    );

    const messages = convo && req.rideRider
      ? convo.createRideRiderResponse(req.payload.id,req.rideRider,ride.Riders,req.riderUserRiderMap) 
      : [];

    if(!rideResponse){
      return res.status(422).send(errors);
    }

    return res.status(200).send({ride: rideResponse, messages});
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route post save: save one particular ride as a candidate for a rider
// This information will be shared across all the user of this rider
// Expecting request in the form POST api/rides/:ride_rider_id/save
// No body required
router.post('/:ride_rider_id/save', auth.required, fetchProspectiveRide, async (req, res, next) => {

  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetConvoInstance} */
  const convo = req.convo;

  try{
    /** @type {JetRideRiderInstance} */
    const curRideRider = req.curRideRider
      ? req.curRideRider
      : models.RidesRiders.build({
        rider_id: req.ownRiderId,
        ride_id: req.rideRider.ride_id,
        status: RIDER_STATUS.none,
        joined_at: null
      });

    
    if(fieldProperties.riderStatusAllowsSave(curRideRider.status)){
      curRideRider.status = RIDER_STATUS.saved;
      await curRideRider.save();
      
      const errors = {};
      const rideResponse = ride.createPublicResponse(
        req.rider, 
        curRideRider, 
        errors, 
        req.travUserTravMap,
        req.rider.UserLinks[0].id
      );

      const msgResponse = convo 
        ? convo.createRideRiderResponse(req.payload.id, curRideRider, ride.Riders, req.riderUserRiderMap)
        : [];

      if(!rideResponse){
        return res.status(422).send(errors);
      } else {
        return res.status(200).send({ride: rideResponse, messages: msgResponse});
      }
    }

    return res.status(403).send(`The current status ('${curRideRider.status}') already automatically saves this ride`);
    // ------------------------------------------------------------------------------------

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route del save: unsave one particular ride as a candidate for a rider
// This information will be shared across all the user of this rider
// Expecting request in the form DELETE api/rides/:ride_rider_id/save
router.delete('/:ride_rider_id/save', auth.required, fetchProspectiveRide, async (req,res,next) => {
  
  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideRiderInstance} */
  let curRideRider = req.curRideRider;

  /** @type {JetConvoInstance} */
  let convo = req.convo;

  try{
    if(curRideRider){
      if(RIDER_STATUS.saved === curRideRider.status){
        await curRideRider.destroy();
        curRideRider = null;
        convo = null;

      } else {
        return res.status(403).send(`The current status ('${curRideRider.status}') does not allow to save or unsave the ride`);
      }
    }

    const errors = {};
    const rideResponse = ride.createPublicResponse(
      req.rider, 
      curRideRider, 
      errors, 
      req.travUserTravMap,
      req.rider.UserLinks[0].id
    );
    const msgResponse = convo
      ? convo.createRideRiderResponse(req.payload.id,curRideRider,ride.Riders,req.riderUserRiderMap)
      : [];
    
    if(!rideResponse){
      return res.status(422).send(errors);
    } else {
      return res.status(200).send({ride: rideResponse, messages: msgResponse});
    }
    
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route post apply: apply to join one particular ride as a rider
// This information will be shared across all the user of this rider
// Expecting request in the form POST api/rides/:ride_rider_id/apply
//
// Relies on middleware checkChangeRequest (if change was provided in req) before fetching ride info
// Relies on middleware fetchOneRide (for the info of the related ride, ownRider and filteringRider)
//
// STEP #1: if rider can apply to the ride: 
// -- build or update rideRiderRequest instance and fetch neighborhood and terminal stops
// -- otherwise throw an error
// STEP #2: if changes were requested, persits the rideRiderRequest instance and
// -- then create/update or delete the terminalStopDrops and cityStopDrops associated with it
// STEP #3: fetch the newly created rideRiderRequest
router.post('/:ride_rider_id/apply', 
  auth.required, checkChangeRequest, checkMsg.optional, fetchProspectiveRide, 
  async (req, res, next) => {
  
    /** @type {JetRideInstance} */
    const ride = req.ride;

    /** @type {JetConvoInstance} */
    const curConvo = req.convo;

    /** @type {JetRideChangeRequest} */
    const changeRequest = req.body.changeRequest;


    if(!RIDE_STATUS.searchables.includes(ride.status)){
      return res.status(403).send({errors: {rideStatus: `Impossible to apply a ride whose status is ${ride.status}`}});
    }

    try{
    // POST/APPLY ROUTE: STEP #1 ----------------------------------------------------------
      const hadRideRider = !!req.curRideRider;

      /** @type {JetRideRiderInstance} */
      const curRideRider = req.curRideRider
        ? req.curRideRider
        : models.RidesRiders.build({
          rider_id: req.ownRiderId,
          ride_id: req.rideRider.ride_id,
          status: RIDER_STATUS.none,
          joined_at: null
        });

      if(fieldProperties.riderStatusAllowsApply(curRideRider.status)){
        const hadRequest = !!curRideRider.Request;

        /** @type {JetRideRiderRequestInstance} */
        let curRequest = req.curRequest ? req.curRequest : null;

        if(changeRequest.hasChange){
          if(curRequest)
            await curRequest.updateFromChangeRequest(changeRequest, ride);
          else
            curRequest = await models.RideRiderRequest.buildFromChangeRequest(changeRequest, curRideRider, ride);
        }

        const curCounter = req.curCounter;
        // END of POST/APPLY ROUTE: STEP #1 ---------------------------------------------------


        // POST/APPLY ROUTE: STEP #2 ----------------------------------------------------------
        curRideRider.status = RIDER_STATUS.applied;
        const errors = {};

        const saveConvo = models.handlers.convo.rideRiderSaver(
          curConvo, ride, curRideRider, req.payload.id, req.body.message, errors
        );

        if(changeRequest.hasChange){
          if(hadRideRider){
            await Promise.all([
              curRequest
                .saveAndUpdateDrops(ride,changeRequest)
                .then(() => curRideRider.request_id = curRequest.id),
              saveConvo()

            ]);
            await curRideRider.save({fields: ['request_id','status','convo_id']});

          } else {
            await curRideRider.save();
            await Promise.all([
              curRequest
                .saveAndUpdateDrops(ride,changeRequest)
                .then(() => curRideRider.request_id = curRequest.id),
              saveConvo()
            ]);
            await curRideRider.save({fields: ['request_id','convo_id']});
          }

        } else {
          if(!hadRideRider){
            await curRideRider.save();
            await saveConvo();
            await req.body.message
              ? curRideRider.save({fields: ['convo_id']})
              : Promise.resolve(null);
          
          } else {
            await saveConvo();
            await curRideRider.save(hadRideRider ? {fields: ['status','convo_id']} : {});
          }

          if(hadRequest){ // which means hasRideRider as well
            await curRequest.destroy();
            curRequest = null;
          }    
        }
        // END of POST/APPLY ROUTE: STEP #2 ---------------------------------------------------


        // POST/APPLY ROUTE: STEP #3 ----------------------------------------------------------
        const [updatedReq,updatedConvo] = await Promise.all([         
          changeRequest.hasChange
            ? models.RideRiderRequest.findById(curRequest.id, models.queries.FETCH_RIDE_RIDER_REQUEST)
            : Promise.resolve(curRequest),
          req.body.message
            ? models.Convo.findById(curRideRider.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
            : Promise.resolve(curConvo)
        ]);
        // END of POST/APPLY ROUTE: STEP #3 ---------------------------------------------------

        const rideResponse = ride.createPublicResponse(
          req.rider, 
          curRideRider, 
          errors, 
          req.travUserTravMap,
          req.rider.UserLinks[0].id
        );
        const rideReqResponse = updatedReq ? updatedReq.createResponse(ride) : null;
        const counterResponse = curCounter ? curCounter.createResponse(ride): null;
        const msgResponse = updatedConvo 
          ? updatedConvo.createRideRiderResponse(req.payload.id,curRideRider,ride.Riders,req.riderUserRiderMap)
          : [];

        return rideResponse
          ? res.status(200).send({
            ride: rideResponse, 
            request: rideReqResponse, 
            counter: counterResponse,
            messages: msgResponse
          })
          : res.status(422).send(errors);
      // ------------------------------------------------------------------------------------
      }

      return res.status(403).send({
        errors: {riderStatus: `The current status ('${curRideRider.status}') does not allow to create a new application request`}
      });
    // ------------------------------------------------------------------------------------
  
    } catch(error){
      next(error);
    }
  });


// ************************************************************************************************
// Route delete apply: cancel a pending application to join one particular ride as a rider
// This information will be shared across all the user of this rider
// Expecting request in the form DELETE api/rides/:ride_rider_id/apply
router.delete('/:ride_rider_id/apply', auth.required, fetchProspectiveRide, async (req, res, next) => {
  
  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideRiderInstance} */
  const curRideRider = req.curRideRider;

  if(!curRideRider){
    return res.status(404).send({errors: {rideRider: 'Ride-rider not found'}});

  } else if(curRideRider.status !== RIDER_STATUS.applied){
    return res.status(403).send({
      errors: {riderStatus: `Cannot pull an application when the current ride-rider status is ${curRideRider.status}`}
    });
  }

  try{
    await curRideRider.destroy();

    const errors = {};
    const rideResponse = ride.createPublicResponse(
      req.rider, 
      null, 
      errors, 
      req.travUserTravMap,
      req.rider.UserLinks[0].id
    );
    return res.status(200).send({ride: rideResponse, messages: []});
  
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route put apply: modify an application to join one particular ride as a rider
// This information will be shared across all the user of this rider
// Expecting request in the form PUT api/rides/:ride_rider_id/apply
//
// Relies on middleware checkChangeRequest (if change was provided in req) before fetching ride info
// Relies on middleware fetchOneRide (for the info of the related ride, ownRider and filteringRider)
//
// STEP #1: if an application by this rider to this ride exists: 
// -- build or update rideRiderRequest instance and fetch neighborhood and terminal stops
// -- otherwise throw an error
// STEP #2: if changes were requested, persits the rideRiderRequest instance and
// -- then create/update or delete the terminalStopDrops and cityStopDrops associated with it
// STEP #3: fetch the newly created or updated rideRiderRequest
router.put('/:ride_rider_id/apply', 
  auth.required, checkChangeRequest, checkMsg.optional, fetchProspectiveRide, 
  async (req, res, next) => {

    /** @type {JetRideInstance} */
    const ride = req.ride;

    /** @type {JetRideRiderRequestInstance} */
    let curRequest = req.curRequest;

    /** @type {JetRideRiderInstance} */
    const curRideRider = req.curRideRider;

    /** @type {JetConvoInstance} */
    const curConvo = req.convo;

    /** @type {JetRideChangeRequest} */
    const changeRequest = req.body.changeRequest;

    if(!curRideRider){
      return res.status(404).send({
        errors: {rideRider: 'Pending application could not be found'}
      });
    } else if(curRideRider.status !== RIDER_STATUS.applied){
      return res.status(403).send({
        errors: {riderStatus: `Cannot pull an application when the current ride-rider status is ${curRideRider.status}`}
      });
    }

    const hadRequest = !!curRequest;
    const linkConvo = !curConvo && req.body.message;

    try{

    // PUT/APPLY ROUTE: STEP #1 -----------------------------------------------------------
      curRequest = curRequest
        ? changeRequest.hasChange
          ? await curRequest.updateFromChangeRequest(changeRequest, ride)
          : curRequest
        : changeRequest.hasChange
          ? await models.RideRiderRequest.buildFromChangeRequest(changeRequest, curRideRider, ride)
          : null;

      const curCounter = req.curCounter;
      // END of PUT/APPLY ROUTE: STEP #1 ----------------------------------------------------


      // PUT/APPLY ROUTE: STEP #2 -----------------------------------------------------------
      curRideRider.status = RIDER_STATUS.applied;
      curRideRider.request_id = changeRequest.hasChange ? curRequest.id : null;

      const errors = {};
      const saveConvo = models.handlers.convo.rideRiderSaver(
        curConvo,ride,curRideRider,req.payload.id,req.body.message,errors
      );

      if(changeRequest.hasChange){
        await Promise.all([
          curRequest.saveAndUpdateDrops(ride,changeRequest).then(() => curRideRider.request_id = curRequest.id),
          saveConvo()
        ]);
        if(!hadRequest || linkConvo){
          await curRideRider.save({fields: ['request_id','convo_id']});
        }
    
      } else if(hadRequest){
        await Promise.all([
          curRequest.destroy().then(() => curRideRider.request_id = null),
          saveConvo()
        ]);
        if(linkConvo){
          await curRideRider.save({fields: ['convo_id']});
        }
    
      }
      // END of PUT/APPLY ROUTE: STEP #2 ----------------------------------------------------


      // PUT/APPLY ROUTE: STEP #3 -----------------------------------------------------------
      const [updatedReq,updatedConvo] = await Promise.all([
        changeRequest.hasChange
          ? models.RideRiderRequest.findById(curRequest.id, models.queries.FETCH_RIDE_RIDER_REQUEST)
          : Promise.resolve(curRequest),
        req.body.message
          ? models.Convo.findById(curRideRider.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          : Promise.resolve(curConvo)
      ]);
      // END of PUT/APPLY ROUTE: STEP #3 ----------------------------------------------------

      const rideResponse = ride.createPublicResponse(
        req.rider, 
        curRideRider, 
        errors, 
        req.travUserTravMap,
        req.rider.UserLinks[0].id
      );
      const rideReqResponse = updatedReq ? updatedReq.createResponse(ride) : null;
      const counterResponse = curCounter ? curCounter.createResponse(ride) : null;
      const msgResponse = updatedConvo ? updatedConvo.createRideRiderResponse(req.payload.id,curRideRider,ride.Riders,req.riderUserRiderMap) : null;

      return rideResponse
        ? res.status(200).send({
          ride: rideResponse, 
          request: rideReqResponse, 
          counter: counterResponse,
          messages: msgResponse
        })
        : res.status(422).send(errors);
    // ------------------------------------------------------------------------------------

    } catch(error){
      next(error);
    }
  });



// ************************************************************************************************
// Route POST/leave: rider directs to leave its current ride
// This will reactivate the suspended ride, if any
// Expecting request in the form POST api/rides/:ride_rider_id/leave
router.post('/:ride_rider_id/leave', auth.required, checkMsg.optional, fetchScheduledRide, async (req, res, next) => {

  /** @type {JetRideRiderInstance} */
  const rideRider = req.rideRider;

  /** @type {JetRideInstance} */
  const curRide = req.ride;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;

  try{
    if(RIDER_STATUS.keyRider.includes(rideRider.status)){
      await curRide.dropCarProvider(true);
    
    } else if(RIDER_STATUS.rideUniques.includes(rideRider.status)){
      await curRide.dropOwner(true);
    
    } else {
      await curRide.expel(rideRider,RIDER_STATUS.left);
    }

    const errors = {};
    curConvo = await models.handlers.convo.rideRiderSaver(
      curConvo,curRide,rideRider,req.payload.id,req.body.message,errors
    )();
    
    const [chgRide, chgRideRider] = await Promise.all([
      models.Ride.findById(curRide.id, models.queries.FETCH_PUBLIC_RIDE),
      models.RidesRiders.findById(rideRider.id, {
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
        include: [{
          model: models.Rider,
          attributes: models.queries.FETCH_RIDER_HOODAGGLOTERM.attributes,
          include: models.queries.FETCH_RIDER_HOODAGGLOTERM.include
        }]
      }),
      req.body.message
        ? models.Convo.findById(curConvo.id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(_convo => curConvo = _convo)
        : Promise.resolve(curConvo)
    ]);
  
    if(chgRideRider && chgRideRider.Rider)
      chgRideRider.Rider.UserLinks = [req.riderUser];

    const rideResponse = chgRide && chgRideRider
      ? chgRide.createPublicResponse(
        chgRideRider.Rider,
        chgRideRider,
        errors,
        req.travUserTravMap,
        req.riderUser.id
      )
      : null;
    const msgResponse = rideResponse && curConvo
      ? curConvo.createRideRiderResponse(req.payload.id,chgRideRider,chgRide.Riders,req.riderUserRiderMap)
      : [];
  
    return res.status(200).send({
      ride: rideResponse,
      messages: msgResponse
    });

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route POST/write: rider writes a message to the rideRider convo passed as param
// Will check whether the rideRider is authorized to write on this thread
// Expecting a request in the form POST api/rides/write and a parameter 'author'
// representing the ride_rider_id of the application.
//
// Will update the rideRider.Request to match the counter and join the ride
router.post('/:ride_rider_id/write', auth.required, checkMsg.required, retrieveAuthor, async (req, res, next) => {
  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideRiderInstance} */
  const target = req.rideRider;

  /** @type {JetRideRiderInstance} */
  const author = req.author;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;

  try {
    const errors = {};
    curConvo
      ? await curConvo.createRideRiderMessage(ride,author,req.body.message,req.payload.id,errors)
      : await models.Convo
        .createRideRiderConvo(target)
        .then(convo => {
          curConvo = convo;
          return convo.createRideRiderMessage(ride,author,req.body.message,req.payload.id,errors);
        });

    if(curConvo && !req.convo){
      target.convo_id = curConvo.id;
      await target.save({fields: ['convo_id']});
    }

    const riderUser = req.riderUserRiderMap[author.rider_id];
    const [rideResp,msgResp] = await Promise.all([
      models.Ride.findById(author.ride_id, models.queries.FETCH_PUBLIC_RIDE)
        .then(_ride => {
          return _ride 
            ? _ride.createPublicResponse(
              author.Rider,
              author,
              errors,
              req.travUserTravMap,
              riderUser ? riderUser.id : null
            )
            : null;
        }),
      models.Convo.findById(curConvo.id, models.queries.FETCH_RIDE_RIDER_CONVO)
        .then(_convo => {
          return _convo 
            ? _convo.createRideRiderResponse(req.payload.id,author,ride.Riders,req.riderUserRiderMap)
            : [];
        })
    ]);
    
    if(!rideResp){
      return res.status(500).send({ride: 'Message was posted but the ride could not be retrieved afterwards'});
    }

    return res.status(200).send({
      ride: rideResp, 
      messages: msgResp
    });

  } catch(error){
    next(error);
  }
});


module.exports = router;