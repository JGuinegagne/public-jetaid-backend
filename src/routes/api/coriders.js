const express = require('express');

const auth = require('../authorization');
const checkMsg = require('../checkMsg');

/** @type {JetModels} */
const models = require('../../models');

const resAttr = require('../../utils/commonResAttr');
const fieldProps = require('../../utils/fieldProperties');

const RIDER_STATUS = require('../../utils/commonFields').RIDER_STATUS;

const Op = models.sequelize.Op;

// ************************************************************************************************
/** coriders router: handles decisions as owner/admin of a ride
* + GET/ride_rider_id: reviews the application to join the ride as ride admin 
* + POST/ride_rider_id/admit: accepts the application to join the ride with all requested changes
* + POST/ride_rider_id/expel: removes a rider from the ride
* + POST/ride_rider_id/deny: reject a rider application to join the ride
* + POST/ride_rider_id/counter: creates a counter proposal to a rider wishing to join who requests changes
* + PUT/ride_rider_id/counter: updates a counter proposal to a rider wishing to join who requests changes
* + PUT/ride_rider_id/killoff: TEST ONLY: forcibly deletes a ride-rider association

* TODO --> update ALL counters of pending applications when accept a counter
*/
const router = express.Router();



// ************************************************************************************************
// COMMON FUNCTIONS

/** On success, will add:
 * + req.travUserTravMap to map the travelers of the target ride to the private infos of the logged
 * user identified by req.payload.id
 * + req.grantor as the rideRider associated with the ride on behalf of which the logged user
 * makes decisions on the application to join the ride.
 * + req.request as the change request associated with the application
 * + req.counter as the existing counter to this application 
 * 
 * @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next*/
const fetchGrantor = async function(req, res, next){
  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideRiderInstance}*/
  const corider = req.corider;

  if(!ride || !corider){
    return res.status(404).send({rideRider: 'ride or co-rider could not be found'});
  }

  try{
    const travIdMap = {};
    ride.getTravelerIds().forEach(travId => travIdMap[travId] = true);
    corider.Rider.TravelerLinks.forEach(riderTrav => {
      if(!travIdMap[riderTrav.traveler_id])
        travIdMap[riderTrav.traveler_id] = true;
    });

    const riderIds = ride.getRiderIds();
    
    const allRiderIds = new Array(...riderIds);
    if(!allRiderIds.includes(corider.rider_id)){
      allRiderIds.push(corider.rider_id);
    }

    const eligibleRiders = ride.Riders
      .filter(rider => fieldProps.riderStatusAllowsApprove(rider.RidesRiders.status));

    if(!Object.keys(travIdMap).length){
      return res.status(500).send({rideRider: 'ride was identified but no associated travelers were found'});
    
    } else if(!eligibleRiders.length){
      return res.status(500).send({rideRider: 'no rider eligible to approve join application was found'});
    
    }

    await Promise.all([
      models.UsersTravelers
        .createTravUserTravMap(req.payload.id, Object.keys(travIdMap))
        .then(map => {
          req.travUserTravMap = map;
        }),

      models.Traveler
        .findAll({
          where: {id: {[Op.in]: Object.keys(travIdMap)}},
          attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES.concat(['id'])
        })
        .then(travelers => {
          ride.Riders.forEach(rider => models.RidersTravelers.populateTravelers(rider,travelers));
          models.RidersTravelers.populateTravelers(corider.Rider,travelers);
        }),
      
      models.RidersUsers
        .findAll({
          attributes: resAttr.RIDER_USER_ATTRIBUTES,
          where: {rider_id: {[Op.in]: allRiderIds}}
        })
        .then(riderUsers => {
          req.coRiderUsers = riderUsers
            .filter(riderUser => riderUser.rider_id === corider.rider_id)
            .map(riderUser => riderUser.user_id);

          /** @type {{[riderId: string]: Array<JetRiderUserInstance>}} */
          const riderUserRiderMap = {};

          riderUsers.forEach(userRider => {
            if(riderIds.includes(userRider.rider_id)){
              if(riderUserRiderMap[userRider.rider_id]){
                riderUserRiderMap[userRider.rider_id].push(userRider);
              } else {
                riderUserRiderMap[userRider.rider_id]= [userRider];
              }
            }
          });

          req.riderUserRiderMap = riderUserRiderMap;
          const eligibleIds = Object.keys(riderUserRiderMap)
            .map(key => {
              if(riderUserRiderMap[key].find(riderUser => riderUser.user_id === req.payload.id)){
                return key;
              }
              return null;
            }).filter(riderId => !!riderId);

          const eligibleGrantors = eligibleRiders
            .filter(rider => eligibleIds.includes(rider.RidesRiders.rider_id));

          const riderGrantor = eligibleGrantors.length 
            ? eligibleGrantors
              .reduce((prevGrantor,rider) => {

                return RIDER_STATUS.rideUniques.includes(rider.RidesRiders.status) ? rider : prevGrantor;
              }, eligibleGrantors[0])
            : null;

          req.grantor = riderGrantor ? riderGrantor.RidesRiders : null;
          req.riderUser = riderGrantor 
            ? riderUserRiderMap[riderGrantor.RidesRiders.rider_id] 
            : null;
        }),
      models.RideRiderRequest
        .findAll({
          where: {ride_rider_id: corider.id},
          include: models.queries.FETCH_RIDE_RIDER_REQUEST.include  
        }).then(rideRiderRequests => {
          req.request = null;
          req.counter = null;
      
          rideRiderRequests.forEach(request => {
            if(request.counter === false){
              req.request = request;
            
            } else if (request.counter === true){
              req.counter = request;
            }
          });
        })
    ]);

    if(!req.grantor){
      return res.status(403).send({rideRider: 'No admin/owner riders of this ride are associated with the logged user'});
    }
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
const checkCounter= function(req, res, next){
  if(!req.body || !req.body.counter){
    return res.status(422).send({errors: {request: 'Missing field "counter" in body of the request'}});
  }

  /**@type {JetRideChangeRequest} */
  const counter = req.body.counter;
  const errors = {};

  if(!models.RideRiderRequest.isValidChangeRequest(counter,errors)){ // TODO: use async?
    return res.status(422).send(errors);
  }  
  next();
};




// ************************************************************************************************
// Register param :ride_rider_id of the target application
// Expecting request in the form api/coriders/:ride_rider_id
// On success, adds fields:
// + req.corider, a rideRider instance populated with Ride and Convo
// + req.ride, a ride instance populated by Riders, CityStops and TerminalStops
// + req.convo from rideRider.Convo, populated by messages
router.param('ride_rider_id', (req, res, next, id) => {
  
  return models.RidesRiders
    .findById(id, models.queries.FETCH_CORIDER)
    .then(corider => {
      if(!corider){
        return res.status(404).send({rideRider: 'target co-rider could not be found'});
        
      } else if(!corider.Ride){
        return res.status(404).send({ride: 'target co-rider was found but no associated ride could be retrieved'});
            
      }

      req.corider = corider;
      req.ride = corider.Ride;
      req.convo = corider.Convo;

      next();
    }).catch(next);
});


// ************************************************************************************************
// Route get/:ride_rider_id: review the details of an application
// Expecting request in the form api/coriders/:ride_rider_id
router.get('/:ride_rider_id', auth.required, fetchGrantor, async (req, res, next) => {
  try {
    /** @type {JetRideRiderInstance} */
    const applicant = req.corider;

    /** @type {JetRideInstance} */
    const ride = req.ride;

    const errors = {};

    const rideResponse = ride.createPublicResponse(
      applicant, 
      req.grantor, 
      errors, 
      req.travUserTravMap,
      req.riderUser.id
    );
    const applicantResponse = applicant.createPublicResponse(req.travUserTravMap);
    applicantResponse.rideRef = rideResponse.ref;
    
    const rideReqResponse = req.request ? req.request.createResponse() : null;
    const counterResponse = req.counter ? req.counter.createResponse() : null;
    const msgResponse = applicant.Convo 
      ? applicant.Convo.createRideRiderResponse(
        req.payload.id,
        req.grantor,
        ride.Riders,
        req.riderUserRiderMap,
        req.corider.id,
        req.coRiderUsers)
      : [];
    
    return res.status(200).send({
      ride: rideResponse,
      applicant: applicantResponse,
      request: rideReqResponse, 
      counter: counterResponse,
      messages: msgResponse
    });

  } catch (error){
    next(error);
  }
});


// ************************************************************************************************
// Route post/:ride_rider_id/accept: accept application to join a ride
// -- Add the rider to the ride, and update the ride to fit with ALL the changes listed in
// ---- the applicant.Request
// -- Deletes the applicant.counter entry, if any
// Expecting request in the form api/coriders/:ride_rider_id/accept
router.post('/:ride_rider_id/admit', auth.required, checkMsg.optional, fetchGrantor, async (req, res, next) => {
  try {

    /** @type {JetRideRiderInstance} */
    const applicant = req.corider;

    /** @type {JetRideInstance} */
    let ride = req.ride;

    /** @type {JetRideRiderRequestInstance} */
    const changeReq = req.request;

    /** @type {JetRideRiderRequestInstance} */
    const counterReq = req.counter;

    /** @type {JetRideRiderInstance} */
    const grantor = req.grantor;

    /** @type {JetConvoInstance} */
    let curConvo = req.convo;

    const errors = {};
    await Promise.all([
      ride.admit(applicant, applicant.Rider, changeReq, counterReq),
      (req.body.message && !curConvo
        ? models.Convo.createRideRiderConvo(applicant)
          .then(_convo => curConvo = _convo)
        : Promise.resolve()
      ).then(() => {
        if(req.body.message){
          return curConvo.createRideRiderMessage(ride,applicant,req.body.message,req.payload.id,errors);
        }
      })
    ]);

    if(!req.convo && curConvo){
      applicant.convo_id = curConvo.id;
      await applicant.save({fields: ['convo_id']});
    }

    const [rideResp,msgResp] = await Promise.all([
      models.Ride
        .findById(applicant.ride_id, models.queries.FETCH_PUBLIC_RIDE)
        .then(ride => {
          return ride 
            ? ride.createPublicResponse(null, grantor, errors, req.travUserTravMap, req.riderUser.id) 
            : null;
        }),

      req.body.message
        ? models.Convo
          .findById(applicant.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(convo_ => {
            return convo_ 
              ? convo_.createRideRiderResponse(
                req.payload.id, 
                grantor, 
                ride.Riders, 
                req.riderUserRiderMap, 
                applicant.id, 
                req.coRiderUsers
              ) : Promise.resolve([]);
          })
        : curConvo
          ? Promise.resolve(curConvo.createRideRiderResponse(
            req.payload.id, 
            grantor, 
            ride.Riders, 
            req.riderUserRiderMap,
            applicant.id, 
            req.coRiderUsers
          )) : Promise.resolve([])
    ]);
    
    if(!rideResp){
      return res.status(500).send({ride: 'Ride was joined but could not be retrieved afterwards'});
    }

    return res.status(200).send({
      ride: rideResp,
      messages: msgResp
    });

  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route post/:ride_rider_id/expel: remove a rider from the ride
// Expecting request in the form api/coriders/:ride_rider_id/expel
router.post('/:ride_rider_id/expel', auth.required, checkMsg.optional, fetchGrantor, async (req,res,next) => {
  try{
    /** @type {JetRideRiderInstance} */
    const expelee = req.corider;

    /** @type {JetRideInstance} */
    const ride = req.ride;

    /** @type {JetConvoInstance} */
    let curConvo = req.convo;

    const errors = {};
    await Promise.all([
      ride.expel(expelee, RIDER_STATUS.applied),
      (req.body.message && !curConvo
        ? models.Convo.createRideRiderConvo(expelee)
          .then(_convo => curConvo = _convo)
        : Promise.resolve()
      ).then(() => {
        if(req.body.message){
          return curConvo.createRideRiderMessage(ride,expelee,req.body.message,req.payload.id,errors);
        }
      })
    ]);

    if(!req.convo && curConvo){
      expelee.convo_id = curConvo.id;
      await expelee.save({fields: ['convo_id']});
    }

    const [rideResp,msgResp] = await Promise.all([
      models.Ride
        .findById(expelee.ride_id, models.queries.FETCH_PUBLIC_RIDE)
        .then(ride => {
          return ride 
            ? ride.createPublicResponse(null, req.grantor, errors, req.travUserTravMap, req.riderUser.id) 
            : null;
        }),

      req.body.message
        ? models.Convo
          .findById(expelee.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(convo_ => {
            return convo_ 
              ? convo_.createRideRiderResponse(
                req.payload.id, 
                req.grantor, 
                ride.Riders, 
                req.riderUserRiderMap,
                expelee.id, 
                req.coRiderUsers
              ) : Promise.resolve([]);
          })
        : curConvo
          ? Promise.resolve(curConvo.createRideRiderResponse(
            req.payload.id, 
            req.grantor, 
            ride.Riders, 
            req.riderUserRiderMap,
            expelee.id, 
            req.coRiderUsers
          ))
          : Promise.resolve([])
    ]);

    if(!rideResp){
      return res.status(500).send({ride: 'Rider was expelled but resulting ride could not be retrieved afterwards'});
    }

    return res.status(200).send({
      ride: rideResp,
      messages: msgResp
    });
        
  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route post/:ride_rider_id/reject: permanently rejects the application of a rider to join
// Expecting request in the form api/coriders/:ride_rider_id/deny
router.post('/:ride_rider_id/deny',auth.required, checkMsg.optional, fetchGrantor, async (req, res, next) => {
  try{
    /** @type {JetRideRiderInstance} */
    const applicant = req.corider;

    /** @type {JetRideInstance} */
    let ride = req.ride;

    /** @type {JetRideRiderInstance} */
    const grantor = req.grantor;

    /** @type {JetConvoInstance} */
    let curConvo = req.convo;

    const errors = {};
    await Promise.all([
      grantor.deny(applicant, req.request, req.counter),
      (req.body.message && !curConvo
        ? models.Convo.createRideRiderConvo(applicant)
          .then(_convo => curConvo = _convo)
        : Promise.resolve()
      ).then(() => {
        if(req.body.message){
          return curConvo.createRideRiderMessage(ride,applicant,req.body.message,req.payload.id,errors);
        }
      })
    ]);

    if(!req.convo && curConvo){
      applicant.convo_id = curConvo.id;
      await applicant.save({fields: ['convo_id']});
    }


    const [rideResp,msgResp] = await Promise.all([
      models.Ride
        .findById(applicant.ride_id, models.queries.FETCH_PUBLIC_RIDE)
        .then(ride => {
          return ride 
            ? ride.createPublicResponse(null, req.grantor, errors, req.travUserTravMap, req.riderUser.id) 
            : null;
        }),

      req.body.message
        ? models.Convo
          .findById(applicant.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(convo_ => {
            return convo_ 
              ? convo_.createRideRiderResponse(
                req.payload.id, 
                req.grantor, 
                ride.Riders, 
                req.riderUserRiderMap,
                applicant.id, 
                req.coRiderUsers
              ) : Promise.resolve([]);
          })
        : curConvo
          ? Promise.resolve(curConvo.createRideRiderResponse(
            req.payload.id, 
            req.grantor, 
            ride.Riders, 
            req.riderUserRiderMap,
            applicant.id, 
            req.coRiderUsers
          )) : Promise.resolve([])
    ]);

    if(!rideResp){
      return res.status(500).send({ride: 'Rider was denied but resulting ride could not be retrieved afterwards'});
    }

    return res.status(200).send({
      ride: rideResp,
      messages: msgResp
    });

  } catch (error){
    next(error);
  }
});


// ************************************************************************************************
// Route POST/:ride_rider_id/counter: proposes different changes to a rider asking to join the ride
// Expecting request in the form api/coriders/:ride_rider_id/counter
// Body must include 'counter' field of type JetRideChangeRequest
router.post('/:ride_rider_id/counter', checkCounter, auth.required, checkMsg.optional, fetchGrantor, async (req, res, next) => {
  
  /** @type {JetRideRiderInstance} */
  const applicant = req.corider;

  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideChangeRequest} */
  const counterReq = req.body.counter;

  /** @type {JetRideRiderRequestInstance} */
  let curCounter = req.counter;

  /** @type {JetRideRiderRequestInstance} */
  const curRequest = req.request;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;
  
  if(!curRequest){
    return res.status(404).send({errors: {request: 'cannot define a counter for a ride-rider which has no request'}});
  }

  if(curCounter){
    return res.status(422).send({errors: {counter: 'counter already exists for this ride-rider, use put route'}});
  }

  try {
    curCounter = await models.RideRiderRequest.buildFromChangeRequest(counterReq,req.corider,ride,true);

    if(!curCounter.differsFrom(curRequest)){
      return res.status(422).send({errors: {counter: 'no difference between counter and request, use "/admit" router'}});
    }

    const errors ={};
    await Promise.all([
      curCounter.saveAndUpdateDrops(ride,counterReq),
      (req.body.message && !curConvo
        ? models.Convo.createRideRiderConvo(applicant)
          .then(_convo => curConvo = _convo)
        : Promise.resolve()
      ).then(() => {
        if(req.body.message){
          return curConvo.createRideRiderMessage(ride,applicant,req.body.message,req.payload.id,errors);
        }
      })
    ]).then(() => {
      applicant.counter_id = curCounter.id;
      if(curConvo && !req.convo){
        applicant.convo_id = curConvo.id;
        return applicant.save({fields: ['convo_id','counter_id']});
      
      } else {
        return applicant.save({fields: ['counter_id']});
      }
    });

    const [counterResp,convoResp] = await Promise.all([
      models.RideRiderRequest
        .findById(curCounter.id,models.queries.FETCH_RIDE_RIDER_REQUEST)
        .then(updatedCounter => updatedCounter.createResponse(ride)),

      req.body.message
        ? models.Convo
          .findById(applicant.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(convo_ => {
            return convo_ 
              ? convo_.createRideRiderResponse(
                req.payload.id, 
                req.grantor, 
                ride.Riders, 
                req.riderUserRiderMap,
                applicant.id, 
                req.coRiderUsers
              ) : Promise.resolve([]);
          })
        : curConvo
          ? Promise.resolve(curConvo.createRideRiderResponse(
            req.payload.id, 
            req.grantor, 
            ride.Riders, 
            req.riderUserRiderMap,
            applicant.id, 
            req.coRiderUsers
          )) : Promise.resolve([])
    ]);

    return res.status(200).send({
      ride: ride.createPublicResponse(req.corider.Rider,req.grantor,errors,req.travUserTravMap, req.riderUser.id),
      applicant: applicant.createPublicResponse(req.travUserTravMap),
      request: curRequest.createResponse(ride),
      counter: counterResp,
      messages: convoResp
    });

  } catch(error){
    next(error);
  }
});

// ************************************************************************************************
// Route PUT/:ride_rider_id/counter: proposes different changes to a rider asking to join the ride
// Expecting request in the form api/coriders/:ride_rider_id/counter
// Body must include 'counter' field of type JetRideChangeRequest
router.put('/:ride_rider_id/counter',checkCounter,  auth.required, checkMsg.optional, fetchGrantor, async (req, res, next) => {
  /** @type {JetRideRiderInstance} */
  const applicant = req.corider;
  
  /** @type {JetRideInstance} */
  const ride = req.ride;

  /** @type {JetRideChangeRequest} */
  const counterReq = req.body.counter;

  /** @type {JetRideRiderRequestInstance} */
  let curCounter = req.counter;

  /** @type {JetRideRiderRequestInstance} */
  const curRequest = req.request;

  /** @type {JetConvoInstance} */
  let curConvo = req.convo;

  if(!curRequest){
    return res.status(404).send({errors: {request: 'cannot update a counter for a ride-rider which has no request'}});
  }

  if(!curCounter){
    return res.status(404).send({errors: {counter: 'Counter not found for this ride-rider'}});
  }
  
  try {
    await curCounter.updateFromChangeRequest(counterReq, ride);

    if(!curCounter.differsFrom(curRequest)){
      return res.status(422).send({errors: {counter: 'no difference between counter and request, use "/admit" router'}});
    }

    const errors ={};
    await Promise.all([
      curCounter.saveAndUpdateDrops(ride,counterReq),
      (req.body.message && !curConvo
        ? models.Convo.createRideRiderConvo(applicant)
          .then(_convo => curConvo = _convo)
        : Promise.resolve()
      ).then(() => {
        if(req.body.message){
          return Promise.all([
            curConvo.createRideRiderMessage(ride,applicant,req.body.message,req.payload.id,errors),
            req.convo ? Promise.resolve() : applicant.update('convo_id',curConvo.id)
          ]);
        }
      })
    ]);

    const [counterResp,convoResp] = await Promise.all([
      models.RideRiderRequest
        .findById(curCounter.id,models.queries.FETCH_RIDE_RIDER_REQUEST)
        .then(updatedCounter => updatedCounter.createResponse(ride)),

      req.body.message
        ? models.Convo
          .findById(applicant.convo_id, models.queries.FETCH_RIDE_RIDER_CONVO)
          .then(_convo => _convo
            ? _convo.createRideRiderResponse(
              req.payload.id, 
              req.grantor, 
              ride.Riders, 
              req.riderUserRiderMap, 
              applicant.id, 
              req.coRiderUsers
            ) : []
          )
        : Promise.resolve(curConvo 
          ? curConvo.createRideRiderResponse(
            req.payload.id, 
            req.grantor, 
            ride.Riders, 
            req.riderUserRiderMap,
            applicant.id, 
            req.coRiderUsers
          ) : []
        )
    ]);
 
    return res.status(200).send({
      ride: ride.createPublicResponse(req.corider.Rider,req.grantor,errors,req.travUserTravMap,req.riderUser.id),
      applicant: applicant.createPublicResponse(req.travUserTravMap),
      request: curRequest.createResponse(ride),
      counter: counterResp,
      messages: convoResp
    });


  } catch(error){
    next(error);
  }
});


// ************************************************************************************************
// Route delete/:ride_rider_id/killoff: deletes the ride-rider link
// Expecting request in the form api/coriders/:ride_rider_id/killoff
// !!! TO BE USED ONLY FOR TESTING !!!
router.delete('/:ride_rider_id/killoff',auth.required, fetchGrantor, async (req, res, next) => {
  try{
    /** @type {JetRideInstance} */
    const ride = req.ride;

    /** @type {JetRideRiderInstance} */
    const applicant = req.corider;

    /** @type {JetRideRiderInstance} */
    const grantor = req.grantor;

    await grantor.killoff(applicant);

    const errors = {};
    return res.status(200).send({
      ride: ride.createPublicResponse(req.corider.Rider,req.grantor,errors,req.travUserTravMap,req.riderUser.id),
      messages: []
    });

  } catch(error){
    next(error);
  }
});

module.exports = router;