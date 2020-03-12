const express = require('express');
const moment = require('moment');

const auth = require('../authorization');

/** @type {JetModels} */
const models = require('../../models');
const resAttr = require('../../utils/commonResAttr');

const RIDE_WAYS = require('../../utils/commonFields').RIDE_WAYS;
const Op = models.sequelize.Op;
const invertMap = require('../../utils/commonFunctions').invertMap;

const router = express.Router();

// ************************************************************************************************
// Filter lists: 
// Expecting request in the form GET api/filters/extended
// Returns: 
// -- existing riders matching the criteria
// -- potential riders matching the criteria (for vias for which no riders were created)
// -- all travelers associated with this user
// -- all addresses associated with this user + its travelers
// Optional parameters: 
// -- travelers: filters on trips whose vias include at least one of the travelers
// -- minStartDate: filters on trips for which the first via starts on or after this date
// -- maxStartDate: filters on trips for which the first via starts on or before this date
// -- toward: filters on riders to or from the city
router.get('/extended',auth.required, async (req,res,next) => {

  // TRAVELERS filter
  const userTravReqs = (req.query.traveler 
    ? Array.isArray(req.query.traveler) ? req.query.traveler : [req.query.traveler]
    : [])
    .filter(travId => travId.toString('hex') === travId);
  
    // DATE filters
  const minStartDate = req.query.minstartdate && moment(req.query.minstartdate,'YYYY-MM-DD').isValid()
    ? moment(req.query.minstartdate,'YYYY-MM-DD') : null;
  
  const maxStartDate = req.query.maxstartdate && moment(req.query.maxstartdate,'YYYY-MM-DD').isValid()
    ? moment(req.query.maxstartdate,'YYYY-MM-DD') : null;
  
    // checks that the date filters are consistent
  if(minStartDate && maxStartDate && minStartDate.isAfter(maxStartDate,'d')){
    return res.status(422).send({errors: {date: 'Min start date must be same or before max start date'}});
  }

  // TOWARD filter
  const towardFilter = typeof req.query.toward === 'string' && RIDE_WAYS.includes(req.query.toward)
    ? req.query.toward : null;
  

  // GET/EXTENDED ROUTE STEP #1: Fetch userTraveler, riders, vias, addresses --------------
  const userId = req.payload.id;
  
  try{
    const travMap = userTravReqs.length
      ? await models.UsersTravelers.createMap(userId,userTravReqs)
      : await models.UsersTravelers.createUserTravsMap(userId);

    // End of GET/EXTENDED ROUTE STEP #1 --------------------------------------------------
  
  
    // GET/EXTENDED ROUTE STEP #2: Fetch riders, vias, addresses --------------------------
  
    // --> GET/EXTENDED ROUTE STEP #2: riders
    const dateFilter = minStartDate && maxStartDate
      ? {date: {[Op.between]: [minStartDate.toDate(),maxStartDate.toDate()]}}
      : minStartDate 
        ? {date: {[Op.gte]: minStartDate.toDate()}}
        : maxStartDate
          ? {date: {[Op.lte]: maxStartDate.toDate()}}
          : null;

    const riderWhere = towardFilter && dateFilter
      ? {[Op.and]: [{toward: towardFilter},dateFilter]}
      : towardFilter
        ? {toward: towardFilter}
        : dateFilter
          ? dateFilter
          : {};
  
    // --> GET/EXTENDED ROUTE STEP #2: vias
    const viaWhere = minStartDate && maxStartDate
      ? {[Op.or]: [{
        [Op.and]: [{toward: 'city'},{arr_date: {[Op.between]: [minStartDate.toDate(),maxStartDate.toDate()]}}]
      },{
        [Op.and]: [{toward: 'airport'},{dep_date: {[Op.between]: [minStartDate.toDate(),maxStartDate.toDate()]}}]
      }]
      } : minStartDate
        ? {[Op.or]: [{
          [Op.and]: [{toward: 'city'},{arr_date: {[Op.gte]: minStartDate.toDate()}}]
        },{
          [Op.and]: [{toward: 'airport'},{dep_date: {[Op.gte]: minStartDate.toDate()}}]
        }]
        } : maxStartDate
          ? {[Op.or]: [{
            [Op.and]: [{toward: 'city'},{arr_date: {[Op.lte]: maxStartDate.toDate()}}]
          },{
            [Op.and]: [{toward: 'airport'},{dep_date: {[Op.lte]: maxStartDate.toDate()}}]
          }]
          } : {};    

    /** @type {{[travId: string]: JetUserTravelerInstance}} */
    const invTravMap = Object.keys(invertMap(travMap,'traveler_id'));

    const [userRiders, userTrips, userAddressMap, travAddressMap] = await Promise.all([
      models.RidersUsers.findAll({
        attributes: resAttr.RIDER_USER_ATTRIBUTES,
        where: {user_id: userId},
        include: [Object.assign(models.queries.FETCH_LIST_RIDER,{where: riderWhere})]
      }),
      models.TripsUsers.findAll({
        attributes: resAttr.TRIP_USER_ATTRIBUTES,
        where: {user_id: userId},
        include: [{
          model: models.Trip,
          attributes: resAttr.TRIP_ATTRIBUTES,
          include: [Object.assign(viaWhere,models.queries.FETCH_VIAS)]          
        }]
      }),
      models.UsersAddresses.createFullAddressMap(userId),
      Object.keys(travMap).length
        ? models.TravelersAddresses.createFullAddressMap(invTravMap)
        : Promise.resolve({})
    ]);

    /** @type {JetInfos} */
    const infos = {
      userAddressMap,
      travAddressMap
    };
    // End of GET/EXTENDED ROUTE STEP #2 --------------------------------------------------
  
  
    // GET/EXTENDED ROUTE: Format responses -----------------------------------------------
    // maps viaIds that already have riders to skip potentialRiders for them
    const exceptToCityViaIds = [];
    const exceptToAirptViaIds = [];
  
    // --> existing riders
    const riderResponses = userRiders
      .sort((ur1,ur2) => ur1.Rider.startTimeCompare(ur2.Rider))
      .map(userRider => {
        const rider = userRider.Rider;
  
        if(rider && rider.via_id){
          if(rider.toward === 'city'){
            exceptToCityViaIds.push(rider.via_id);
          } else {
            exceptToAirptViaIds.push(rider.via_id);
          }
        }
        return rider.createPrivateResponse(userRider,infos,travMap,{userTrips: userTrips});
      });
      
    // --> potential riders (from vias not yet associated with a rider)
    /** @type {Array<{tripRef: string, via: JetViaInstance}>} */
    const unmappedToCityRider = [];
  
    /** @type {Array<{tripRef: string, via: JetViaInstance}>} */
    const unmappedToAirptRider = [];
  
    userTrips.forEach(userTrip => {
      const tripRef = userTrip.id;
      const trip = userTrip.Trip;
  
      trip.vias.forEach(via => {
        if(!exceptToAirptViaIds.includes(via.id))
          unmappedToAirptRider.push({tripRef,via});

        if(!exceptToCityViaIds.includes(via.id))
          unmappedToCityRider.push({tripRef, via});
      });
    });
  
    const toCityResponses = unmappedToCityRider
      .sort((v1,v2) => v1.via.compareByStartDateTime(v2.via))
      .map(v1 => v1.via.createPotentialRider(v1.tripRef,true,travMap));
  
    const toAirptResponses = unmappedToAirptRider
      .sort((v1,v2) => v1.via.compareByStartDateTime(v2.via))
      .map(v1 => v1.via.createPotentialRider(v1.tripRef,false,travMap));    
      
    
    // --> travelers
    const travelerResponses = Object.keys(travMap)
      .map(key => travMap[key].createResponse());

    // --> addresses
    const userAddressResponses = Object.keys(infos.userAddressMap)
      .map(key => {
        const address = infos.userAddressMap[key];
        return address 
          ? address.createSelectionResponse(address.UsersAddresses)
          : null;
      }).filter(resp => !!resp);

    const travAddressResponses = Object.keys(infos.travAddressMap)
      .map(key => {
        const address = travAddressMap[key];
        return address
          ? address.createSelectionResponse(null, address.TravelersAddresses)
          : null;
      }).filter(resp => !!resp);

    return res.status(200).json({
      riderCount: riderResponses.length,
      potentialRiderCount: toCityResponses.length + toAirptResponses.length,
      travelerCount: travelerResponses.length,
      addressCount: userAddressResponses.length + travAddressResponses.length,
      
      riders: riderResponses,
      potentialRiders: toCityResponses.concat(toAirptResponses),
      travelers: travelerResponses,
      addresses: userAddressResponses.concat(travAddressResponses)
    });
    // GET/EXTENDED ROUTE: End of format responses ----------------------------------------
    
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Filter lists: 
// Expecting request in the form GET api/filters/extended
// Returns: 
// -- existing riders matching the criteria
// -- potential riders matching the criteria (for vias for which no riders were created)
// -- all travelers associated with this user
// -- all addresses associated with this user + its travelers
// Required parameters: 
// -- tripRef: user-trip-ref
router.get('/fromtrip',auth.required, async (req,res,next) => {
  const tripRef = req.query ? req.query.tripRef : null

  if(typeof tripRef !== 'string' || tripRef.toString('hex') !== tripRef)
    return res.status(422).send({errors: {tripRef: 'param must be of type "hex" string'}});

  // GET/FROMTRIP ROUTE STEP #1: Fetch userTraveler, riders, vias, addresses --------------
  const userId = req.payload.id;
  
  try{
    const [travMap,tripUser] = await Promise.all([
      models.UsersTravelers.createUserTravsMap(userId),
      models.TripsUsers.findByPk(tripRef,{
        attributes: resAttr.TRIP_USER_ATTRIBUTES,
        include: [{
          model: models.Trip,
          attributes: resAttr.TRIP_ATTRIBUTES,
          include: models.queries.FETCH_VIAS          
        }]
      }),
    ]);

    if(!tripUser)
      return res.status(404).send({errors: {tripRef: 'trip could not be found'}});

    if(tripUser.user_id !== userId)
      return res.status(403).send({errors: {tripRef: 'user is not allowed to retrieve this trip.'}});

    if(!tripUser.Trip || !tripUser.Trip.vias)
      return res.status(404).send({errors: {trip: 'trip could not be found'}});
    // End of GET/FROMTRIP ROUTE STEP #1 --------------------------------------------------
  
  
    // GET/FROMTRIP ROUTE STEP #2: Fetch riders, addresses --------------------------------
  
    // --> GET/FROMTRIP ROUTE STEP #2: riders  

    /** @type {{[travId: string]: JetUserTravelerInstance}} */
    const invTravMap = Object.keys(invertMap(travMap,'traveler_id'));
    const viaIds = tripUser.Trip.vias
      .map(via => via.id);

    const [userRiders, userAddressMap, travAddressMap] = await Promise.all([
      models.RidersUsers.findAll({
        attributes: resAttr.RIDER_USER_ATTRIBUTES,
        where: {user_id: userId},
        include: Object.assign(
          {where: {via_id: {[Op.in]: viaIds}}},
          models.queries.FETCH_LIST_RIDER
        )
      }),
      models.UsersAddresses.createFullAddressMap(userId),
      Object.keys(travMap).length
        ? models.TravelersAddresses.createFullAddressMap(invTravMap)
        : Promise.resolve({})
    ]);

    /** @type {JetInfos} */
    const infos = {
      userAddressMap,
      travAddressMap
    };
    // End of GET/FROMTRIP ROUTE STEP #2 --------------------------------------------------
  
  
    // GET/FROMTRIP ROUTE: Format responses -----------------------------------------------
    // maps viaIds that already have riders to skip potentialRiders for them
    const exceptToCityViaIds = [];
    const exceptToAirptViaIds = [];
  
    // --> existing riders
    const riderResponses = userRiders
      .sort((ur1,ur2) => ur1.Rider.startTimeCompare(ur2.Rider))
      .map(userRider => {
        const rider = userRider.Rider;
  
        if(rider && rider.via_id){
          if(rider.toward === 'city'){
            exceptToCityViaIds.push(rider.via_id);
          } else {
            exceptToAirptViaIds.push(rider.via_id);
          }
        }
        return rider
          .createPrivateResponse(userRider,infos,travMap,{userTrips: [tripUser]});
      });
      
    // --> potential riders (from vias not yet associated with a rider)
    /** @type {JetViaInstance[]} */
    const unmappedToCityRider = [];
  
    /** @type {JetViaInstance[]} */
    const unmappedToAirptRider = [];
  
    const trip = tripUser.Trip;
    trip.vias.forEach(via => {
      if(!exceptToAirptViaIds.includes(via.id))
        unmappedToAirptRider.push(via);

      if(!exceptToCityViaIds.includes(via.id))
        unmappedToCityRider.push(via);
    });
  
    const toCityResponses = unmappedToCityRider
      .sort((v1,v2) => v1.compareByStartDateTime(v2))
      .map(v1 => v1.createPotentialRider(tripRef,true,travMap));
  
    const toAirptResponses = unmappedToAirptRider
      .sort((v1,v2) => v1.compareByStartDateTime(v2))
      .map(v1 => v1.createPotentialRider(tripRef,false,travMap));    
      
    
    // --> travelers
    const travelerResponses = Object.keys(travMap)
      .map(key => travMap[key].createResponse());

    // --> addresses
    const userAddressResponses = Object.keys(infos.userAddressMap)
      .map(key => {
        const address = infos.userAddressMap[key];
        return address 
          ? address.createSelectionResponse(address.UsersAddresses)
          : null;
      }).filter(resp => !!resp);

    const travAddressResponses = Object.keys(infos.travAddressMap)
      .map(key => {
        const address = travAddressMap[key];
        return address
          ? address.createSelectionResponse(null, address.TravelersAddresses)
          : null;
      }).filter(resp => !!resp);

    return res.status(200).json({
      riderCount: riderResponses.length,
      potentialRiderCount: toCityResponses.length + toAirptResponses.length,
      travelerCount: travelerResponses.length,
      addressCount: userAddressResponses.length + travAddressResponses.length,
      
      riders: riderResponses,
      potentialRiders: toCityResponses.concat(toAirptResponses),
      travelers: travelerResponses,
      addresses: userAddressResponses.concat(travAddressResponses)
    });
    // GET/FROMTRIP ROUTE: End of format responses ----------------------------------------
    
  } catch(error){
    next(error);
  }
});







// ************************************************************************************************
// Register param :user_rider_id
// Expecting request in the form api/filters/assign/:rider_user_id
// Adds fields .userRider
// NO LONGER USED
// router.param('user_rider_id', (req, res, next, id) => {
//   models.RidersUsers.findById(id, {attributes: resAttr.RIDER_USER_ATTRIBUTES})
//     .then(userRider=> {
//       if(userRider){
//         req.userRider = userRider;
//         next();

//       } else {
//         return res.status(404).json({errors: {rideRider: 'link user-rider could not be found'}});
//       }

//     }).catch(next);
// });


// ************************************************************************************************
// Route assign: Add rider information to the webtoken to handle further calls
// Expecting request in the form POST api/filters/assign/:rider_user_id
// NO LONGER USED
// router.post('/assign/:user_rider_id', auth.required, async (req, res, next) => {
//   try{
//     if(req.userRider.user_id === req.payload.id){
//       const user = await models.User.findById(req.payload.id, {attributes: resAttr.USER_MAP_ATTRIBUTES} );
//       if(!user){
//         return res.status(404).send({errors: {filter: 'User could not be found'}});
//       }
//       const riderId = req.userRider ? req.userRider.rider_id : null;
//       const out = await user.createResponse(riderId);

//       return res.status(200).send({user: out});
    
//     } else {
//       return res.status(403).send({errors: {filter: 'Logged user not authorized to use this filter'}});
//     }

//   }catch(error){
//     next(error);
//   }
// });



module.exports = router;