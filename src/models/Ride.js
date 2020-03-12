const moment = require('moment');
const _ = require('lodash');

const fieldProperties = require('../utils/fieldProperties');
const utils = require('../utils/commonFunctions');
const statusPriority = require('../utils/fieldProperties').getRiderStatusPriority;

const RIDE_STATUS = require('../utils/commonFields').RIDE_STATUS;
const RIDE_TYPES = require('../utils/commonFields').RIDE_TYPES;
const RIDE_WAYS = require('../utils/commonFields').RIDE_WAYS;
const PAY_PREFS = require('../utils/commonFields').PAY_PREFS;
const SMOKE_PREFS = require('../utils/commonFields').SMOKE_PREFS;
const PET_PREFS = require('../utils/commonFields').PET_PREFS;
const CURB_PREFS = require('../utils/commonFields').CURB_PREFS;
const RIDER_STATUS = require('../utils/commonFields').RIDER_STATUS;


module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetRideModel} */
  const rideModel = sequelize.define('Ride', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}       
    },
    date: {type: SeqTypes.DATEONLY, allowNull: false},
    start_time: {type: SeqTypes.TIME},
    status: {type: SeqTypes.ENUM, values: RIDE_STATUS.values, allowNull: false, defaultValue: RIDE_STATUS.dft},
    type: {type: SeqTypes.ENUM, values: RIDE_TYPES.values, allowNull: false, defaultValue: RIDE_TYPES.dft},
    toward: {type: SeqTypes.ENUM, values: RIDE_WAYS.values, allowNull: false, defaultValue: RIDE_WAYS.dft},
    
    seat_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 2},
    luggage_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 2},
    baby_seat_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 0},
    sport_equip_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 0},
    
    pay_method: {type: SeqTypes.ENUM, values: PAY_PREFS.values, allowNull: false, defaultValue: PAY_PREFS.dft},
    smoke_policy: {type: SeqTypes.ENUM, values: SMOKE_PREFS.values, allowNull: false, defaultValue: SMOKE_PREFS.dft},
    pet_policy: {type: SeqTypes.ENUM, values: PET_PREFS.values, allowNull: false, defaultValue: PET_PREFS.dft},
    curb_policy: {type: SeqTypes.ENUM, values: CURB_PREFS.values, allowNull: false, defaultValue: CURB_PREFS.dft},
    
    public: {type: SeqTypes.BOOLEAN, allowNull: false, defaultValue: true},
  }, {
    underscored: true
  });

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  rideModel.associate = function(models){

    this.belongsTo(models.Airport, {foreignKey: 'airport_id'});
    this.belongsTo(models.Agglo, {foreignKey: 'agglo_id'});
    this.belongsTo(models.User, {foreignKey: 'creator_id', as: 'Creator'});

    this.belongsToMany(models.Neighborhood, {through: models.RidesNeighborhoods, as: 'CityStops'});
    this.belongsToMany(models.Terminal, {through: models.RidesTerminals, as: 'TerminalStops'});

    this.hasMany(models.RidesRiders, {foreignKey: 'ride_id', as: 'RiderLinks'});
    this.hasMany(models.RidesTerminals, {foreignKey: 'ride_id'});
    this.hasMany(models.RidesNeighborhoods, {foreignKey: 'ride_id'});

    // INSTANCE METHODS REQUIRING MODELS
    /** 
     * @param {JetRiderInstance} rider 
     * @param {JetTransaction} t*/
    this.prototype.saveInitial = async function(rider, suspend = false, t = null){
    /** @type {JetRideInstance} */
      const ride = this;
      const opt = t ? {transaction: t}: {};
      
      if(suspend){
        ride.status = RIDE_STATUS.inactive;
      }

      try{
        await ride.save(opt);
      
        const rideRider = await models.RidesRiders
          .create({
            ride_id: ride.id,
            rider_id: rider.id,
            status: suspend ? RIDER_STATUS.suspend : fieldProperties.getCreatorRiderStatus(ride.type),
            joined_at: suspend ? null : new Date()  
          }, opt);
  
        await Promise.all([
          models.RidesNeighborhoods.create({
            ride_id: ride.id,
            ride_rider_id: rideRider.id,
            neighborhood_id: rider.neighborhood_id,
            ordinal: 0
          },opt),
  
          (typeof rider.terminal_id === 'number')
            ? models.RidesTerminals.create({
              ride_id: ride.id,
              ride_rider_id: rideRider.id,
              terminal_id: rider.terminal_id,
              ordinal: 0
            },opt)
            : Promise.resolve()
        
        ]);
  
        return ride;
      } catch(error){
        return Promise.reject(error);
      }
    };

    /** 
     * @param {JetRideRiderInstance} applicantLink
     * @param {JetRiderInstance} applicant
     * @param {JetRideRiderRequestInstance} changeReq
     * @param {JetRideRiderRequestInstance} counter*/
    rideModel.prototype.admit = async function(applicantLink, applicant, changeReq = null, counter = null){
      /** @type {JetRideInstance} */
      const ride = this;

      // FIRST: performs checks
      if(!applicantLink || !applicant){
        return Promise.reject({ride: 'Rider or rideRider info is missing'});

      } else if(!this.mayAdmit(applicant)){
        return Promise.reject({ride: 'This rider is not compatible with this ride'});

      } else if(changeReq && !this.mayApplyChange(changeReq)){
        return Promise.reject({ride: 'Change request is not compatible with this ride'});
      }

      try{
        const {curRideRider, curRide} = await applicantLink.findCurrentRide(ride);

        if(curRide){
          if(curRide.countCoRiders() > 0){
            return Promise.reject({ride: 'The rider has already joined a ride'});
          }
          curRide.status = RIDE_STATUS.inactive;
          curRideRider.status = RIDER_STATUS.suspend;
        }

        // SECOND: update the rideRider status
        applicantLink.status = RIDER_STATUS.joined;
        applicantLink.joined_at = new Date();
        let closeRide = null;

        // THIRD: update ride per admitted rideRider request
        if(changeReq){
          changeReq.modifyRide(ride);
          closeRide = changeReq.closeRequested();
        }

        return models.sequelize.transaction(async t => {
          await Promise.all([
            changeReq
              ? models.handlers.ride.updateStops( ride,applicantLink.id, 
                {neighborhood_id: changeReq.neighborhood_id, ordinal: changeReq.neighborhood_ordinal},
                {terminal_id: changeReq.terminal_id, ordinal: changeReq.terminal_ordinal},
                changeReq.NeighborhoodDrops.map(cityStopDrop => cityStopDrop.city_stop_id), 
                changeReq.TerminalDrops.map(termStopDrop => termStopDrop.terminal_stop_id),
                t )
              : Promise.resolve(),

            curRide ? 
              curRide.save({fields: ['status'], transaction: t})
              : Promise.resolve(curRide), 

            curRideRider 
              ? curRideRider
                .save({fields: ['status'], transaction: t})
                .then(() => applicantLink.save({fields: ['status','joined_at'], transaction: t}))
              : applicantLink.save({fields: ['status','joined_at'], transaction: t}),

            counter 
              ? counter.destroy({transaction: t}) 
              : Promise.resolve(null)

          ]);
          
          applicant.RidesRiders = applicantLink;
          ride.Riders.push(applicant);
          ride.updateUsage(closeRide);
          
          await ride.save({transaction: t});
          return ride;
        });
        
      } catch(error){
        return Promise.reject(error);
      }
    };


    /** Voluntary removal of a rider (not an owner/driver/provider) - either expelled by owner or voluntary leave
     * but not by changes to the rider cascading to the rides
     * @param {JetRideRiderInstance} rideRider
     * @param {JetRiderStatus} newStatus*/
    rideModel.prototype.expel = function(rideRider, newStatus = null, reactivate = true){
      /** @type {JetRideInstance} */
      const ride = this;

      // performs checks
      if(!rideRider){
        return Promise.reject({ride: 'RideRider info is missing'});
      
      } else if(!RIDER_STATUS.riderUniques.includes(rideRider.status)){
        return Promise.reject({ride: 'Ride-rider link does not indicate that the rider has joined the ride'});
      
      } else if (RIDER_STATUS.rideUniques.includes(rideRider.status)){
        return Promise.reject({ride: `Ride.expel() may cannot be used on the ride's ${rideRider.status}`});
      
      } else if(!ride.Riders|| !ride.Riders.length || !ride.Riders[0].RidesRiders)
        return Promise.reject({ride: 'Ride.expel() ride arg must have Riders field populated'});
      
      const coRider = ride.Riders.find(rider => rider.RidesRiders.id === rideRider.id);
      if(!coRider){
        return Promise.reject({ride: 'Rider to be expelled could not be found in the ride'});
      }


      return models.sequelize.transaction(async t => {
        try{
          const out = await models.handlers.ride
            .removeCoRider(ride,coRider,t,newStatus,reactivate,false);
          return out.ride;

        } catch(error){
          return Promise.reject(error);
        }
      });
    };


    /** Handles cases where owner/driver/provider leaves a ride for reasons other than updates (for example to join another ride)*/
    rideModel.prototype.dropOwner = async function(suspend = true){
      /** @type {JetRideInstance} */
      const ride = this;    
      
      const owner = ride.getOwner();
      if(!owner)
        return Promise.reject({ride: 'Ride owner could not be found in dropOwner'});

      const coRidersCount = ride.countCoRiders();

      if(coRidersCount > 1  && !RIDE_TYPES.carPools.includes(ride.type)){
        return models.sequelize.transaction(async t => {
          return await models.handlers.ride.spinOff(ride, s => owner.createRide(s,suspend),t);
        });

      } else if(coRidersCount ===1){
        return models.sequelize.transaction(async t => {
          try{
            const ride = models.handlers.ride.removeRiders(ride, t);
            return suspend ? await models.handlers.ride.suspendRide(ride,t) : ride;
          } catch(error){
            return Promise.reject(error);
          }
        });
      
      } else {
        return suspend
          ? models.sequelize.transaction(async t => await models.handlers.ride.suspendRide(ride,t))
          : ride.destroy().then(() => null);
      }
    };

    /** Case where a coRider receives significant changes that makes it incompatible with its current ride. 
     * @param {JetRiderInstance} rider*/
    rideModel.prototype.dropOut = function(rider, reactivate = true, reset = true){
      /** @type {JetRideInstance} */
      const ride = this;

      const riderId = rider.id 
        ? rider.id 
        : rider.RidesRiders && rider.RidesRiders.rider_id
          ? rider.RidesRiders.rider_id
          : null;

      if(!riderId){
        return Promise.reject({ride: 'DropOut: Rider id could not be identified'});
      }

      if(!ride.Riders || !ride.Riders.length || !ride.Riders[0].RidesRiders){
        return Promise.reject({ride: 'DropOut: Ride.Riders field must be populated'});
      }

      const rideRider = ride.Riders.find(rider => rider.RidesRiders.rider_id === riderId);
      if(!rideRider){
        return Promise.reject({ride: 'DropOut: rider could not be found among the ride\'s riders'});
      }

      return models.sequelize.transaction(async t => {
        try{
          const out = await models.handlers.ride.removeCoRider(ride, rider, t, RIDER_STATUS.left, reactivate, reset);
          return out.coRiderRide;         
        }catch(error){
          return Promise.reject(error);
        }
      });
    };


    /** Handles case where owner/driver/provider receives significant changes that makes it incompatible with its current ride
     * @param {JetRiderInstance} updOwner */
    rideModel.prototype.reset = function(suspend = false, updOwner = null){
    /** @type {JetRideInstance} */
      const ride = this;    
    
      const curOwner = ride.getOwner();
      if(!curOwner){
        return Promise.reject({ride: 'Dissolve: Ride provider/driver could not be found'});
      }

      if(updOwner && updOwner.id !== curOwner.RidesRiders.rider_id){
        return Promise.reject({ride: 'Dissolve: overriding owner id does not match the database entry'});
      }

      const owner = updOwner ? updOwner : curOwner;
      const coRidersCount = ride.countCoRiders();

      if(coRidersCount > 1 && !RIDE_TYPES.carPools.includes(ride.type)){
        return models.sequelize.transaction(t => {
          return models.handlers.ride.spinOff(ride, () => owner.createRide(t,suspend),t);
        });

      } else if(coRidersCount ===1){
        return models.sequelize.transaction(async t => {
          try{
            const updatedRide = await models.handlers.ride.removeRiders(ride, t);
            return models.handlers.ride.resetRide(updatedRide,t,suspend,owner);
          } catch(error){
            return Promise.reject(error);
          }
        });
      
      } else {
        return models.sequelize.transaction(t => models.handlers.ride.resetRide(ride,t,suspend,owner));
      }
    };
  };



  // INSTANCE METHODS
  rideModel.prototype.getAvailableSeats = function(){
    return Math.max(this.seat_count - this.Riders.map(rider => rider.seat_count).reduce((sum,count) => sum+count,0));
  };

  rideModel.prototype.getAvailableLuggages = function(){
    return Math.max(this.luggage_count - this.Riders.map(rider => rider.luggage_count).reduce((sum,count) => sum+count, 0));
  };

  rideModel.prototype.getAvailableBabySeats = function(){
    return Math.max(this.baby_seat_count - this.Riders.map(rider => rider.baby_seat_count).reduce((sum,count) => sum+count, 0));
  };

  rideModel.prototype.getAvailableSportEquip = function(){
    return Math.max(this.sport_equip_count - this.Riders.map(rider => rider.sport_equip_count).reduce((sum,count) => sum+count, 0));
  };

  rideModel.prototype.getTravelerIds = function(){
    /** @type {JetRideInstance} */
    const ride = this;
    const travIdMap = {};
    if(ride.Riders){
      ride.Riders.forEach(rider => {

        if(rider.TravelerLinks){
          rider.TravelerLinks.forEach(riderTrav => travIdMap[riderTrav.traveler_id] = true);
        
        } else if (rider.Travelers){
          rider.Travelers.forEach(traveler => travIdMap[traveler.RidersTravelers.traveler_id] = true);
        }
      });
    }
    
    return Object.keys(travIdMap);
  };

  rideModel.prototype.getAdminRiderIds = function(){
    /** @type {JetRideInstance} */
    const ride = this;
    const adminRiderIds = [];

    if(ride.Riders){
      adminRiderIds.push(
        ...ride.Riders
          .map(rider => rider.RidesRiders.rider_id)
          .filter(status => RIDER_STATUS.allowApprove.includes(status))
      );
    }

    return adminRiderIds;
  };

  rideModel.prototype.getRiderIds = function(){
    /** @type {JetRideInstance} */
    const ride = this;
    return ride.Riders
      ? ride.Riders.map(rider => rider.RidesRiders.rider_id)
      : [];
  };

  rideModel.prototype.getOwner = function(){
    /** @type {JetRideInstance} */
    const ride = this;
    if(!ride.Riders){
      throw new Error({ride: 'getOwner needs ride.Riders fields populated'});
    }

    if(ride.status === RIDE_STATUS.inactive)
      ride.Riders.find(rider => rider.RidesRiders === RIDER_STATUS.suspend)
    
    const admins = ride.Riders
      .filter(rider => RIDER_STATUS.rideUniques.includes(rider.RidesRiders.status))
      .sort((r1,r2) => 
        statusPriority(r1.RidesRiders.status) - statusPriority(r2.RidesRiders.status)
      );

    return admins.length ? admins[0] : null;
  };

  rideModel.prototype.getCoRiders = function(){
    /** @type {JetRideInstance} */
    const ride = this;
    if(!ride.Riders){
      throw new Error({ride: 'getCoRiders needs ride.Riders fields populated'});
    }

    return ride.Riders.filter(rider => RIDER_STATUS.riderUniques.includes(rider.RidesRiders.status) 
      && !RIDER_STATUS.rideUniques.includes(rider.RidesRiders.status));
  };

  rideModel.prototype.countCoRiders = function(){
    /** @type {JetRideInstance} */
    const ride = this;

    if(!ride.Riders)
      throw new Error({ride: 'ride.Riders field must be populated to call countCoRider()'});

    const riderStatuses = ride.Riders.map(rider => rider.RidesRiders.status);

    return ( ride.status === RIDE_STATUS.inactive
      ? riderStatuses.filter(status => status !== RIDER_STATUS.suspend && RIDER_STATUS.riderUniques.includes(status))
      : riderStatuses.filter(status => RIDER_STATUS.riderUniques.includes(status) && !RIDER_STATUS.rideUniques.includes(status))
    ).length;
  };

  rideModel.prototype.getActiveStatus = function(){
    /** @type {JetRideInstance} */
    const ride = this;
    if(ride.Riders && ride.countCoRiders >= ride.seat_count){
      return RIDE_STATUS.full;
    }
    return RIDE_STATUS.open;
  };

  /** internal function to be used by buildFromRider and updateFromRider
   * @param {JetRiderInstance} rider 
   * @param {JetRideType} type 
   * @param {boolean} publicRide
   * @return {JetRideAttributes}*/
  const createAttributes = function(rider, type, publicRide){

    type = RIDE_TYPES.values.includes(type)
      ? type 
      : rider.pref ? fieldProperties.getDftRideType(rider.pref)
        : RIDE_TYPES.dft;

    const seatCount = fieldProperties.getDftSeatCount(type);
    const luggageCount = fieldProperties.getDftLuggageCount(type);
    const babySeatCount = fieldProperties.getDftBabySeatCount(type);
    const sportEquipCount = fieldProperties.getDftSportEquipCount(type);

    const availSeats = Math.max(seatCount - rider.seat_count, 0);

    return {
      date: rider.date,
      start_time: rider.dep_time,
      status: availSeats > 0 ? RIDE_STATUS.dft : RIDE_STATUS.full,
      type,
      toward: rider.toward,

      seat_count: seatCount,
      luggage_count: luggageCount,
      baby_seat_count: babySeatCount,
      sport_equip_count: sportEquipCount,

      pay_method: PAY_PREFS.dft,
      smoke_policy: SMOKE_PREFS.dft,
      pet_policy: PET_PREFS.dft,
      curb_policy: CURB_PREFS.dft,

      public: publicRide,

      airport_id: rider.airport_id,
      agglo_id: rider.Neighborhood ? rider.Neighborhood.agglo_id : null,
    };
  };


  // INSTANCE METHODS
  /** @param {JetRiderInstance} rider
   * @param {JetRideType} type
   * @param {boolean} publicRide*/
  rideModel.prototype.updateFromRider = function(rider, type = null, publicRide = null){
    /** @type {JetRideInstance} */
    const ride = this;

    type = type ? type : ride.type;
    publicRide = typeof publicRide === 'boolean' ? publicRide : ride.public;
    const newAttributes = createAttributes(rider, type, publicRide);
    Object.keys(newAttributes).forEach(key => {
      ride[key] = newAttributes[key];
    });
  };


  rideModel.prototype.createBaseResponse = function(ref, provideInfo = false, riderCount = 1){
    /** @type {JetRideInstance} */
    const ride = this;

    const terminals = ride.TerminalStops;
    const hoods = ride.CityStops;

    const airportStops = terminals 
      ? terminals
        .sort((t1,t2) => t1.RidesTerminals.ordinal - t2.RidesTerminals.ordinal)
        .map(terminal => {
          const rideTerminal = terminal.RidesTerminals;
          const resp = {
            terminalCode: terminal.code,
            terminalName: terminal.name,
            ordinal: rideTerminal ? rideTerminal.ordinal : 100,
          };
          if(provideInfo)
            resp.riderRef = rideTerminal ? rideTerminal.ride_rider_id : null;
          return resp;
        }).filter(resp => resp.ordinal < 100)
      : [];

    const cityStops = hoods
      ? hoods
        .sort((h1,h2) => h1.RidesNeighborhoods.ordinal - h2.RidesNeighborhoods.ordinal)
        .map(hood => {
          const rideHood = hood.RidesNeighborhoods;
          const resp = {
            neighborhoodName: hood.name,
            ordinal: rideHood.ordinal
          };
          if(provideInfo)
            resp.riderRef = rideHood ? rideHood.ride_rider_id : null;
          return resp;
        })
      : [];

    /** @type {JetRideBaseResponse} */
    const response = {
      ref,
      date: moment(ride.date).format('YYYY-MM-DD'),
      startTime: moment(ride.start_time,'HH:mm').format('HH:mm'),
      type: ride.type,
      toward: ride.toward,
      slots: {
        seatCount: ride.getAvailableSeats(),
        luggageCount: ride.getAvailableLuggages(),
        babySeatCount: ride.getAvailableBabySeats(),
        sportEquipCount: ride.getAvailableSportEquip()
      },
      riderCount,
      airport: {
        airportName: ride.Airport ? ride.Airport.name : null,
        airportCode: ride.airport_id
      },
      agglo: {
        aggloName: ride.Agglo ? ride.Agglo.name : null
      },
      airportStops,
      cityStops,
      policies: {
        payMethod: ride.pay_method,
        smokePolicy: ride.smoke_policy,
        petPolicy: ride.pet_policy,
        curbPolicy: ride.curb_policy
      }
    };

    return response;
  };

  /** @param {JetRiderInstance} filterRider
   * @param {JetRideRiderInstance} ownRideRider 
  * @param {{[errorType: string]: string}} errors
  * @param {string} userRef*/
  rideModel.prototype.createListResponse = function(filterRider, ownRideRider, errors, userRef=null){
    /** @type {JetRideInstance} */
    const ride = this;

    /** @type {JetRiderInstance} */
    const rideOwner = ride.Riders && ride.Riders.length ? ride.Riders[0]: null;
    if(!rideOwner){
      errors['ride'] = 'createSelectResponse: Ride was found to be empty';
      return null;

    } else if(!rideOwner.RidesRiders){
      errors['ride'] = 'createSelectResponse: Ride owner could not be associated with the ride';
      return null;

    } else if (!rideOwner.RidesRiders.id) {
      errors['ride'] = 'createSelectResponse: Ride owner id could not be retrieved';
      return null;
    }

    /** @type {JetRideSelectResponse} */
    const response = ride.createBaseResponse(rideOwner.RidesRiders.id,false,ride.Riders.length);
    response.owner = rideOwner.createRideOwnerResponse();
    response.querierStatus = ownRideRider ? ownRideRider.status : null;
    response.querierRef = ownRideRider ? ownRideRider.id : null;
    response.userRef = userRef;
    response.matchPercentile = ride.estimateMatchPercentile(filterRider);

    return response;
  };


  /** @param {JetRiderInstance} filterRider 
   * @param {JetRideRiderInstance} ownRideRider 
   * @param {{[errorType: string]: string}} errors
   * @param {{[travelerId: string]: JetUserTravelerInstance}} travUserTravMap */
  rideModel.prototype.createPublicResponse = function(filterRider, ownRideRider, errors, travUserTravMap = {}, userRef=null){
    /** @type {JetRideInstance} */
    const ride = this;

    const riders = ride.Riders ? ride.Riders
      .filter(rider => rider.hasJoinedRide())
      .sort((r1,r2) => r1.joinTimeCompare(r2))
      : [];

    if(!riders.length){
      errors['rideResponse'] = 'Ride was found to be empty';
      return null;

    } else if (!riders[0].RidesRiders){
      errors['rideResponse'] = 'Ride owner could not be associated with the ride';
      return null;

    } else if (!riders[0].RidesRiders.id){
      errors['rideResponse'] = 'Ride owner id could not be retrieved';
      return null;
    }

    /** @type {Array<JetCurrentRideRiderResponse>} */
    const riderResponses = riders.map((rider,ord) => {
      return rider.createRideRiderResponse(travUserTravMap, ord);
    });

    const refRider = filterRider
      ? riders.find(rider => rider.RidesRiders.rider_id === filterRider.id 
          && RIDER_STATUS.allowApprove.includes(rider.RidesRiders.status))
      : ride.getOwner();

    const ref = refRider 
      ? refRider.RidesRiders.id 
      : ride.getOwner().RidesRiders.id;

    /** @type {JetRidePublicResponse} */
    const response = ride.createBaseResponse(ref, true, riders.length);
    response.riders = riderResponses;

    response.cost = ride.estimateCost(filterRider);
    response.querierStatus = ownRideRider ? ownRideRider.status : null;
    response.querierRef = ownRideRider ? ownRideRider.id : null;
    response.userRef = userRef;

    return response;
  };


  /** @param {JetRiderInstance} withRider
   * @return {number}*/
  rideModel.prototype.estimateMatchPercentile = function(withRider){
    if(!withRider){
      return 0;
    }

    /** @type {JetRideInstance} */
    const ride = this;
    let perc = 1;

    // -- deal killers --> not the same airport, agglo or direction
    if(ride.airport_id !== withRider.airport_id)
      return 0;

    if(withRider.Neighborhood && ride.agglo_id !== withRider.Neighborhood.agglo_id)
      return 0;

    if(withRider.toward !== ride.toward)
      return 0;

    const rideDateTime = utils.calculateDateTime(ride.date,ride.start_time);
    const riderDateTime = utils.calculateDateTime(withRider.date,withRider.dep_time);
    const dateTimeDiff = rideDateTime.diff(riderDateTime,'m');

    // -- time penalties
    if(Math.abs(dateTimeDiff) > 15){
      if(dateTimeDiff < 0){
        if(dateTimeDiff < -120)
          perc -= 0.8;
        else if (dateTimeDiff < -90)
          perc -= 0.7;
        else if (dateTimeDiff < -60)
          perc -= 0.6;
        else if(dateTimeDiff < -45)
          perc -= 0.5;
        else if(dateTimeDiff < -30)
          perc -= 0.3;
        else 
          perc -= 0.2;
      
      } else {
        if(dateTimeDiff > 120)
          perc -= 0.6;
        else if (dateTimeDiff > 90)
          perc -= 0.5;
        else if (dateTimeDiff > 60)
          perc -= 0.4;
        else if(dateTimeDiff > 45)
          perc -= 0.3;
        else if(dateTimeDiff > 30)
          perc -= 0.2;
        else 
          perc -= 0.1;
      }
    }

    // -- terminal penalty
    if(withRider.terminal_id && !ride.TerminalStops.includes(withRider.terminal_id)){
      perc -= 0.1;
    }

    // -- neighborhood penalty
    if(!ride.CityStops.includes(withRider.neighborhood_id)){
      perc -= 0.2; // TODO: refine based on airport / neighborhood distance
    }

    // -- availabilities penalty
    const availableSeats = ride.getAvailableSeats();
    const availableLuggages = ride.getAvailableLuggages();
    const availableBabySeats = ride.getAvailableBabySeats();
    const availableSportEquips = ride.getAvailableSportEquip();

    if(availableSeats < withRider.seat_count){
      perc -= 0.4 * Math.abs(availableSeats - withRider.seat_count);
    }

    if(availableLuggages < withRider.luggage_count){
      perc -= 0.2 * Math.abs(availableLuggages - withRider.luggage_count); 
    }

    if(availableBabySeats < withRider.baby_seat_count){
      perc -= 0.1;
    }

    if(availableSportEquips < withRider.sport_equip_count){
      perc -= 0.1;
    }

    // -- preferences penalty (for now, riders have no prefs - to be added)
    perc += fieldProperties.getPayMatchPenalty(ride.pay_method, PAY_PREFS.flex);
    perc += fieldProperties.getSmokeMatchPenalty(ride.pay_method, SMOKE_PREFS.flex);
    perc += fieldProperties.getPetMatchPenalty(ride.pay_method, PET_PREFS.flex);
    perc += fieldProperties.getCurbMatchPenalty(ride.pay_method, CURB_PREFS.flex);

    return Math.max(_.round(perc,2),0);
  };


  /** @param {JetRiderInstance} withRider 
   * @return {{percentile: number, factors: Array<{val: number, name: string}>}}*/
  rideModel.prototype.listMatchFactors = function(withRider){
    return {
      percentile: withRider ? 1 : 1,
      factors: [{val: 1,name: 'allGood'}]
    };
  };


  /** @param {JetRiderInstance} withRider
   * @return {JetCostResponse}*/
  rideModel.prototype.estimateCost = function(withRider){
    return {
      currency: 'USD',
      val: withRider ? 50 : 50,
      lower: 35,
      upper: 75
    };
  };



  /** @param {JetRideRiderInstance} rideRider */
  rideModel.prototype.allowSave = function(rideRider = null){
    return !!rideRider && !RIDER_STATUS.exclusions.includes(rideRider.status);
  };

  /** @param {JetRiderInstance} rider */
  rideModel.prototype.mayAdmit = function(rider){
    /** @type {JetRideInstance} */
    const ride = this;

    const rideDateTime = utils.calculateDateTime(this.date, this.start_time);
    const riderDateTime = utils.calculateDateTime(rider.date, rider.dep_time);
    const hourDiff = rideDateTime.diff(riderDateTime,'h');

    if(Math.abs(hourDiff) > 12){
      return false;
    }

    /** @type {Array<string>} */
    const rideTravelerIds = [];

    ride.Riders.forEach(rider => {
      rideTravelerIds.push(...rider.Travelers.map(trav => trav.id));
    });
    const riderTravelers = rider.Travelers.map(trav => trav.id);

    if(riderTravelers.some(travId => rideTravelerIds.includes(travId))){
      return false;
    }

    if(ride.airport_id !== rider.airport_id){
      return false;
    }

    if(!rider.Neighborhood || ride.agglo_id !== rider.Neighborhood.agglo_id){
      return false;
    }

    if(!rider.toward || ride.toward !== rider.toward){
      return false;
    }

    return true;
  };

  /** @param {JetRideRiderRequestInstance} changeReq */
  rideModel.prototype.mayApplyChange = function(changeReq){
    /** @type {JetRideInstance} */
    const ride = this;
    
    // check that the times are compatible
    const rideDateTime = utils.calculateDateTime(ride.date, ride.start_time);
    const riderDateTime = utils.calculateDateTime(changeReq.date, changeReq.start_time);
    const hourDiff = rideDateTime.diff(rideDateTime.subtract(riderDateTime),'h');

    if(Math.abs(hourDiff) > 24){
      return false;
    }

    // check that the hood drops will not leave the ride going nowhere
    let hoodStopCount = ride.CityStops.length;

    // check that requested hood agglo matches ride agglo
    if(changeReq.RequestedNeighborhood && changeReq.RequestedNeighborhood.agglo_id !== ride.agglo_id){
      return false;
    } else {
      hoodStopCount++;
    }

    // check that requested terminal airport matches ride airport
    if(changeReq.RequestedTerminal && changeReq.RequestedTerminal.airport_id !== ride.airport_id){
      return false;
    }

    const dropCityStopIds = changeReq.NeighborhoodDrops.map(hoodDrop => hoodDrop.city_stop_id);
    const curCityStopIds = ride.CityStops.map(cityStop => cityStop.id);

    dropCityStopIds.forEach(cityStopId => {
      if(curCityStopIds.includes(cityStopId)){
        hoodStopCount--;
      }
    });

    if(hoodStopCount <= 0){
      return false;
    }

    return true;
  };

  /** @param {JetRiderInstance} rider */
  rideModel.prototype.mayKeep = function(rider){
    /** @type {JetRideInstance} */
    const ride = this;

    // basic checks: same airport, same toward, same agglo
    if(ride.agglo_id !== (rider.Neighborhood ? rider.Neighborhood.agglo_id : null
      || ride.airport_id !== rider.airport_id)){
      return false;
    }
    
    const riderId = rider.id 
      ? rider.id
      : rider.RidesRiders ? rider.RidesRiders.rider_id : null;
    
    // check that the times are compatible
    const rideDateTime = utils.calculateDateTime(ride.date, ride.start_time);
    const riderDateTime = utils.calculateDateTime(rider.date, rider.dep_time);

    const curRiders = ride.Riders
      ? ride.Riders
        .filter(rider => RIDER_STATUS.riderUniques.includes(rider.RidesRiders.status))
        .filter(rider => rider.RidesRiders.rider_id !== riderId)
      : [];

    const lastDateTime = curRiders
      .map(rider=>utils.calculateDateTime(rider.date,rider.dep_time))
      .reduce((lastTime,riderTime) => riderTime.isAfter(lastTime) ? riderTime : lastTime, rideDateTime);

    const minuteDiffs = riderDateTime.diff(lastDateTime,'m');

    // either at most 10 minutes LATER or six hours earlier
    return minuteDiffs <= 10 && minuteDiffs > -360;
  };

  /** @param {boolean} closeRide*/
  rideModel.prototype.updateUsage = function(closeRide = null){
    /** @type {JetRideInstance} */
    const ride = this;

    const rideUsage = {seat: 0, luggage: 0, babySeat: 0, sportEquip: 0};
        
    rideUsage.seat = ride.Riders.map(rider => rider.seat_count).reduce((sum,count) => sum+count, 0);
    rideUsage.luggage = ride.Riders.map(rider => rider.luggage_count).reduce((sum,count) => sum+count, 0);
    rideUsage.babySeat = ride.Riders.map(rider => rider.baby_seat_count).reduce((sum,count) => sum+count, 0);
    rideUsage.sportEquip = ride.Riders.map(rider => rider.sport_equip_count).reduce((sum,count) => sum+count, 0);

    ride.seat_count = Math.max(ride.seat_count, rideUsage.seat);
    ride.luggage_count = Math.max(ride.luggage_count, rideUsage.luggage);
    ride.baby_seat_count = Math.max(ride.baby_seat_count, rideUsage.babySeat);
    ride.sport_equip_count = Math.max(ride.sport_equip_count, rideUsage.sportEquip);

    if(ride.getAvailableSeats()){
      ride.status = closeRide === true 
        ? RIDE_STATUS.closed 
        : RIDE_STATUS.open;

    } else {
      ride.status = closeRide === true
        ? RIDE_STATUS.closed
        : RIDE_STATUS.full;
    }
  };


  // MODEL METHODS
  rideModel.buildFromRider = function(rider, type, publicRide = true){
    if(rider){
      const rideAttributes = createAttributes(rider, type, publicRide);
      rideAttributes.creator_id = rider.creator_id;

      return rideModel.build(rideAttributes);

    } else
      return null;
  };


  return rideModel;
};