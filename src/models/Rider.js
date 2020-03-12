const moment = require('moment');

const resAttr = require('../utils/commonResAttr');

const calcDateTime = require('../utils/commonFunctions').calculateDateTime;
const uniques = require('../utils/commonFunctions').uniques;

const RIDE_WAYS = require('../utils/commonFields').RIDE_WAYS;
const RIDE_TYPES = require('../utils/commonFields').RIDE_TYPES;
const RIDER_PREFS = require('../utils/commonFields').RIDER_PREFS;
const RIDER_STATUS = require('../utils/commonFields').RIDER_STATUS;



module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetRiderModel} */
  const riderModel = sequelize.define('Rider',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}       
    },
    date: {type: SeqTypes.DATEONLY, allowNull: false},
    dep_time: {type: SeqTypes.TIME},

    pref: {type: SeqTypes.ENUM, values: RIDER_PREFS.values, allowNull: false, defaultValue: RIDER_PREFS.dft},
    toward: {type: SeqTypes.ENUM, values: RIDE_WAYS.values, allowNull: false, defaultValue: RIDE_WAYS.dft},

    seat_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 1},
    luggage_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 1},
    baby_seat_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 0},
    sport_equip_count: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 0} 
  },{
    underscored: true
  });


  /** @param {JetModels} models */  
  riderModel.associate = function(models){
    this.belongsTo(models.Address, {foreignKey: 'address_id'});
    this.belongsTo(models.Neighborhood, {foreignKey: 'neighborhood_id'});
    this.belongsTo(models.Airport, {foreignKey: 'airport_id'});
    this.belongsTo(models.Terminal, {foreignKey: 'terminal_id'});
    
    this.belongsTo(models.Via, {foreignKey: 'via_id'});
    this.belongsTo(models.User, {foreignKey: 'creator_id', as: 'Creator'});

    this.belongsToMany(models.Traveler, {through: models.RidersTravelers});
    models.Traveler.belongsToMany(this, {through: models.RidersTravelers});
    
    this.belongsToMany(models.Ride, {through: models.RidesRiders});
    models.Ride.belongsToMany(this, {through: models.RidesRiders});

    this.belongsToMany(models.User, {through: models.RidersUsers});
    models.User.belongsToMany(this, {through: models.RidersUsers});

    this.hasMany(models.RidesRiders, {as: 'Connections', foreignKey: 'rider_id'});
    this.hasMany(models.RidersTravelers, {as: 'TravelerLinks', foreignKey: 'rider_id'});
    this.hasMany(models.RidersUsers, {as: 'UserLinks', foreignKey: 'rider_id'});

    // HOOKS
    this.beforeBulkDestroy('cascadeRidesAddresses', async ({where}) => {

      if(where && where.id){
        try{
          const riders = await models.Rider.findAll(Object.assign({where},models.queries.FETCH_RIDER_VIACASCADE));
          const addressIds = uniques(riders.filter(r => !!r.address_id).map(r => r.address_id));
          
          return Promise.all([
            models.sequelize.transaction(t => models.handlers.ride.cascade(riders,t)),
            
            addressIds.length
              ? Promise.all(
                addressIds.map(addressId => models.Address.shouldRemove(addressId).then(remove => ({addressId,remove})))
              ).then(resp => {
                const toRemoveIds = resp.filter(r => r.remove).map(r => r.addressId);

                return toRemoveIds.length
                  ? models.Address.destroy({where: {id: {[Op.in]: toRemoveIds}}})
                  : Promise.resolve(null);
              })
              : Promise.resolve(null)
          ]);

        } catch(error){
          return Promise.reject(error);
        }
      }

      return Promise.resolve();
    });


    // used in ViasTravelers -> beforeBulkDestroy hook and Via -> beforeBulkDestroy hook
    this.afterDestroy('delAddressHook', (rider) => {
      if(rider.address_id){
        models.Address
          .shouldRemove(rider.address_id)
          .then(resp => resp ? models.Address.destroy({where: {id: rider.address_id}}) : Promise.resolve(null))
          .catch(error => console.log(error));
      }
    });


    // INSTANCE METHODS REQUIRING MODELS
    /** @param {JetTransaction} t*/
    this.prototype.createRide = function(t = null, suspend = false, type = RIDE_TYPES.dft, publicRide = true){
      /** @type {JetRiderInstance} */
      const rider = this;
      const ride = models.Ride.buildFromRider(rider, type, publicRide);
      return ride.saveInitial(rider, suspend, t);
    };

    // MODEL METHODS REQUIRING MODELS

    // INSTANCE METHODS REQUIRING MODELS
    /** @param {JetRiderRideSpecs} rideSpecs */
    riderModel.prototype.propagate = async function(rideSpecs){
      /** @type {JetRiderInstance} */
      const rider = this;

      try{
        // ensures that the field Connections and BasicInfos are populated for the rider
        // immediately resolved if the fields have been populated already
        await Promise.all([
          rider.fetchConnections(),
          rider.fetchBasicInfos()
        ]);

        // fetches additional infos on the CurrentRide (if any) and the pending applications
        // immediately resolved if the fields have been populated already
        await Promise.all([
          rider.fetchCurrentRide(),
          rider.fetchApplications()
        ]);

        /** TRUE if rider has an active ride to which it is NOT the owner/driver/provider, FALSE otherwise */
        const hasJoined = rider.CurrentRide && !rider.CurrentRide.RidesRiders.isMainRider();
        
        /** TRUE if a riderRequest was passed as argument, and it is asking to create a ride, FALSE otherwise */
        const createRide = rideSpecs 
          ? typeof rideSpecs.createRide === 'boolean' 
            ? rideSpecs.createRide
            : false
          : false;

        if(!rider.CurrentRide){ // <-- NO active ride, there CANNOT be a suspended ride
          if (createRide){
            return models.sequelize.transaction( t=> {
              return rider.createRide(t,false,rideSpecs.rideType,rideSpecs.public);
            });
          }
        
        } else if(hasJoined){  // <-- NOT ride owner: MAY or MAY NOT have a suspended ride to reactivate
          
          if(!rider.CurrentRide.mayKeep(rider)){  // <-- breaking changes: cannot stay in this ride 
            // tries to reactivate the suspended ride and update it
            rider.CurrentRide = await rider.CurrentRide.dropOut(rider,true,true);

            // if no suspended ride was found and the riderRequest asks to create a ride, create it
            if(!rider.CurrentRide && createRide){
              return models.sequelize.transaction( t=> {
                return rider.createRide(t,false,rideSpecs.rideType,rideSpecs.ride.public);
              });
            }
          }
          return rider;

        } else { // <-- IS ride owner: will NOT have a suspended ride

          if(!rider.CurrentRide.mayKeep(rider) || rider.CurrentRide.countCoRiders === 0){
            // if there are 2+ coRiders, leave the ride and form a new one
            // otherwise stay in the ride, kick out coRiders and update it
            return rider.CurrentRide.reset(false,rider);
          }
          return rider;
        }
      } catch(error){
        return Promise.reject(error);
      }
    };

    riderModel.prototype.fetchBasicInfos = function (){
      /** @type {JetRiderInstance} */
      const rider = this;
      
      let hasHood = typeof rider.neighborhood_id !== 'undefined';
      if(!hasHood)
        hasHood = rider.Neighborhood && typeof rider.Neighborhood.id !== 'undefined';

      let hasAirport = typeof rider.airport_id !== 'undefined';
      if(!hasAirport)
        hasAirport = rider.Airport && typeof rider.Airport.id !== 'undefined';

      let hasTerminal = typeof rider.terminal_id !== 'undefined';
      if(!hasTerminal){
        hasTerminal = rider.Terminal && typeof rider.Terminal.id !== 'undefined';
        if(hasTerminal){
          rider.terminal_id = rider.Terminal.id;
        }
      }

      if(hasHood && hasAirport && hasTerminal){
        return Promise.resolve();
      }

      return riderModel
        .findById(rider.id, {attributes: ['airport_id','neighborhood_id','terminal_id']})
        .then(dbEntry => {
          rider.neighborhood_id = hasHood ? rider.neighborhood_id : dbEntry.neighborhood_id;
          rider.airport_id = hasAirport ? rider.airport_id : dbEntry.airport_id;
          rider.terminal_id = hasTerminal ? rider.terminal_id : dbEntry.terminal_id;
        });
    };


    riderModel.prototype.fetchCurrentRide = async function(){
      /** @type {JetRiderInstance} */
      const rider = this;

      if(rider.CurrentRide)
        return Promise.resolve();

      if(rider.Rides){ // <-- if rider.Rides is populated, look for the current ride directly using ride.RidesRiders.status
        rider.CurrentRide = rider.Rides.find(ride => RIDER_STATUS.riderUniques.includes(ride.RidesRiders.status));
        if(!rider.CurrentRide)
          return Promise.resolve(); // --> no current ride
        
        else if(rider.CurrentRide && rider.CurrentRide.Riders && rider.CurrentRide.TerminalStops && rider.CurrentRide.CityStops)
          return Promise.resolve(); // --> current ride, and all required fields are populated
        
        return models.Ride
          .findById(rider.CurrentRide.RidesRiders.ride_id, models.queries.FETCH_CURRENT_RIDE) // --> populate missing fields
          .then(ride => {
            if(ride){
              ride.RidesRiders = rider.CurrentRide.RidesRiders;
            }
            rider.CurrentRide = ride;
          });
      }

      try {
        const rideRider = rider.Connections
          ? rider.Connections.find(conn => RIDER_STATUS.riderUniques.includes(conn.status))
          : await models.RidesRiders.findOne({
            where: {
              [Op.and]: [
                {rider_id: rider.id},
                {status: {[Op.in]: RIDER_STATUS.riderUniques}}
              ]
            },
            attributes: resAttr.RIDE_RIDER_ATTRIBUTES
          });

        if(!rideRider){
          return;
        }

        rider.CurrentRide = await models.Ride.findById(rideRider.ride_id, models.queries.FETCH_CURRENT_RIDE);
        if(rider.CurrentRide){
          rider.CurrentRide.RidesRiders = rideRider;
        }
        return;

      } catch(error){
        return Promise.reject(error);
      }
    };


    riderModel.prototype.fetchApplications = async function(){
      /** @type {JetRiderInstance} */
      const rider = this;
  
      if(rider.Applications)
        return Promise.resolve();
  
      try {
        rider.Applications = rider.Connections
          ? rider.Connections.filter(conn => RIDER_STATUS.isPending.includes(conn.status))
          : await models.RidesRiders.findAll({
            where: {
              [Op.and]: [
                {rider_id: rider.id},
                {status: {[Op.in]: RIDER_STATUS.isPending}}
              ]
            },
            attributes: resAttr.RIDE_RIDER_ATTRIBUTES
          });
  
      } catch(error){
        return Promise.reject(error);
      }
    };
  
    
    riderModel.prototype.fetchConnections = function(){
      /** @type {JetRiderInstance} */
      const rider = this;
  
      if(rider.Connections)
        return Promise.resolve();
  
      if(rider.Rides){
        rider.Connections = rider.Rides.map(ride => ride.RidesRiders);
        return Promise.resolve();
      }
  
      return models.RidesRiders.findAll({
        where: {rider_id: rider.id},
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES
      }).then(riderRides => {
        rider.Connections = riderRides;
      });
    };

    /** 
     * @param {JetRiderUserInstance} riderUser
    * @param {JetInfos} infos
    * @param {{[travId: string]: JetUserTravelerInstance}} travMap
    * @param {{userTrips: JetTripUserInstance[], via: JetViaInstance}} options*/
    riderModel.prototype.createPrivateResponse = function(riderUser,infos,travMap,options = {}){
      /** @type {JetRiderInstance} */
      const rider = this;
      const address = rider.Address;

      /** @type {JetUserAddressInstance} */
      const userAddress = address && infos.userAddressMap
        ? Object.keys(infos.userAddressMap)
          .reduce((prevVal,key) => {
            if(prevVal)
              return prevVal;

            const userAddress = infos.userAddressMap[key].UsersAddresses;
            return userAddress.address_id === address.id ? userAddress : null;
          },null)
        : null;

      /** @type {JetTravelerAddressInstance} */
      const travAddress = address && infos.travAddressMap
        ? Object.keys(infos.travAddressMap)
          .reduce((prevVal,key) => {
            if(prevVal)
              return prevVal;

            const travAddress = infos.travAddressMap[key].TravelersAddresses;
            return travAddress.address_id === address.id ? travAddress : null;
          },null)
        : null;
        
      const ride = rider.Rides.length ? rider.Rides[0] : null;

      /** @type {string}*/ let tripRef;
      /** @type {JetViaInstance} */ let via;

      if(options){

        if(options.userTrips && rider.via_id){
          options.userTrips.find(ut => {
            if(ut.Trip && ut.Trip.vias){
              via = ut.Trip.vias
                .find(v => v.id === rider.via_id);
  
              if(via){
                tripRef = ut.id;
                return true;
              }
            }
            return false;
          });
        
        } else if(options.via){
          via = options.via;
          tripRef = null;
        }
      }

      const response = {
        ref: riderUser.id,
        date: moment(this.date).format('YYYY-MM-DD'),
        startTime: moment(this.dep_time,'HH:mm').format('HH:mm'),
        toward: rider.toward,
        pref: rider.pref,
        travelers: rider.Travelers
          .map(traveler => traveler.createRiderResponse(travMap,via))
          .sort((tr1,tr2) => tr1.ordinal - tr2.ordinal),
        airportLocation: {
          airportName: rider.Airport.name,
          airportCode: rider.Airport.id,
          terminalName: rider.Terminal ? rider.Terminal.name : null,
          terminalCode: rider.Terminal ? rider.Terminal.code : null
        },
        cityLocation: models.Address
          .createCityLocationResponse(address,userAddress,travAddress,rider.Neighborhood),
        requirements: {
          seatCount: rider.seat_count,
          luggageCount: rider.luggage_count,
          babySeatCount: rider.baby_seat_count,
          sportEquipCount: rider.sport_equip_count
        },
        currentRide: {
          ref: ride && ride.RidesRiders ? ride.RidesRiders.id : null,
          rideStatus: ride ? ride.status : null,
          rideType: ride ? ride.type : null,
          riderStatus: ride && ride.RidesRiders ? ride.RidesRiders.status : null
        },
        tripRef: tripRef ? tripRef : null,
        viaOrdinal: via ? via.ordinal : null
      };

      return response;
    };
  
  }; //<-- END OF METHODS REQUIRING MODELS


  // MODEL METHODS
  riderModel.getStartTimeChangeScore = function(minutesChg){
    if(minutesChg > 0){
      if(minutesChg <=5) return 1;
      if(minutesChg <=10) return 2;
      if(minutesChg <=15) return 4;
      if(minutesChg <=20) return 6;
      if(minutesChg <=30) return 8;
      return 10;

    } else if(minutesChg < -10){
      if(minutesChg >= -20) return 1;
      if(minutesChg >= -30) return 2;
      if(minutesChg >= -45) return 3;
      if(minutesChg >= -60) return 4;
      if(minutesChg >= -90) return 5;
      if(minutesChg >= -120) return 6;
      if(minutesChg >= -180) return 7;
      if(minutesChg >= -240) return 8;
      if(minutesChg >= -300) return 9;
      return 10;
    }
    return 0;
  };

  riderModel.getTravChangeScore = function(prevRider, updateRequest){
    const prevRiderCount = prevRider.TravelerLinks.length;
    const newRiderCount = updateRequest.travelers.length;
    let score = 0;

    if(prevRiderCount < newRiderCount)
      return score = 10;
    else if(prevRiderCount > newRiderCount){
      score += 5*(prevRiderCount - newRiderCount);
    }
    
    const reqChgs = {};

    reqChgs.seats = updateRequest.requirements.seatCount 
      ? Math.max(updateRequest.requirements.seatCount,newRiderCount) : newRiderCount;
    reqChgs.seats -= prevRider.seat_count;

    reqChgs.luggages = updateRequest.requirements.luggageCount 
      ? updateRequest.requirements.luggageCount : prevRider.luggage_count;
    reqChgs.luggages -= prevRider.luggage_count;

    reqChgs.babySeats = updateRequest.requirements.babySeatCount
      ? updateRequest.requirements.babySeatCount : prevRider.baby_seat_count;
    reqChgs.babySeats -= prevRider.baby_seat_count;

    reqChgs.sportEquips = updateRequest.requirements.sportEquipCount
      ? updateRequest.requirements.sportEquipCount : prevRider.sport_equip_count;
    reqChgs.sportEquips -= prevRider.sport_equip_count;

    if(reqChgs.seats > 0 || reqChgs.babySeats > 0 || reqChgs.babySeats > 0)
      return 10;
    
    score += Math.abs(reqChgs.seats)* 5 
      + (reqChgs.luggages > 0 ? reqChgs.luggages * 2 : 0);

    return score;
  };

  riderModel.createResponse = function(rider, rideRider, travUserTravMap = {}){
    /** @type {JetRideRiderResponse} */
    const response = {
      ref: rideRider ? rideRider.id : null,
      date: rider.date,
      startTime: rider.dep_time,
      terminalCode: rider.Terminal ? rider.Terminal.code : null,
      terminalName: rider.Terminal ? rider.Terminal.name : null,
      neighborhoodName: rider.Neighborhood ? rider.Neighborhood.name : null,
      travelers: rider.Travelers.map(traveler => traveler.createRiderResponse(travUserTravMap)),
      usage: {
        seatCount: rider.seat_count,
        luggageCount: rider.luggage_count,
        babySeatCount: rider.baby_seat_count,
        sportEquipCount: rider.sport_equip_count
      }
    };
    return response;    
  };


  // INSTANCE METHODS
  riderModel.prototype.getCurrentRideId = function(){
    /** @type {JetRiderInstance} */
    const rider = this;

    const curRide = rider.Rides.filter(ride => RIDER_STATUS.riderUniques.includes(ride.RidesRiders.status));
    return curRide.length ? curRide[0].RidesRiders.ride_id : null;
  };

  riderModel.prototype.getPendingApplicationIds = function(){
    /** @type {JetRiderInstance} */
    const rider = this;

    const curAppls = rider.Rides.filter(ride => RIDER_STATUS.isPending.includes(ride.RidesRiders.status));
    return curAppls.length ? curAppls.map(ride => ride.RidesRiders.ride_rider_id) : [];
  };


  riderModel.prototype.createRideOwnerResponse = function(){
    /** @type {JetRiderInstance} */
    const rider = this;

    const owner = rider.Travelers && rider.Travelers.length ? rider.Travelers[0]: null;
    const coRiderCount = rider.Travelers ? Math.max(rider.Travelers.length -1,0) : 0;

    /** @type {JetRideOwnerResponse} */
    const response = {
      publicName: owner ? owner.public_name : 'Someone',
      pic: owner ? owner.pic : null,
      usage: {
        seatCount: rider.seat_count,
        luggageCount: rider.luggage_count,
        babySeatCount: rider.baby_seat_count,
        sportEquipCount: rider.sport_equip_count
      },
      coRiderCount
    };
    
    return response;
  };


  /** @param {{[travelerId: string]: JetUserTravelerInstance}} travelerUserTravMap  
   * @param {number} ordinal*/
  riderModel.prototype.createRideRiderResponse = function(travelerUserTravMap = {}, ordinal = 0){
    /** @type {JetRiderInstance} */
    const rider = this;
    const rideRider = rider.RidesRiders;

    const resp = riderModel.createResponse(rider, rideRider, travelerUserTravMap);
    resp.ordinal = ordinal;
    resp.status = rideRider.status;
    return resp;
  };
  

  /** @param {JetRiderInstance} oRider */
  riderModel.prototype.startTimeCompare = function(oRider){
    /** @type {JetRiderInstance} */
    const rider = this;

    const dateTime = calcDateTime(rider.date,rider.dep_time);
    const oDateTime = calcDateTime(oRider.date,oRider.dep_time);
    
    return dateTime.isValid() && oDateTime.isValid()
      ? dateTime.diff(oDateTime,'s')
      : dateTime.isValid()
        ? -1
        : oDateTime.isValid()
          ? 1 
          : 0;
  };

  riderModel.prototype.hasJoinedRide = function(){
    return this.RidesRiders && this.RidesRiders.status
      && RIDER_STATUS.riderUniques.includes(this.RidesRiders.status);
  };


  /** @param {JetRiderInstance} oRider */
  riderModel.prototype.joinTimeCompare = function(oRider){
    /** @type {JetRiderInstance} */
    const rider = this;

    if(!rider.RidesRiders || !oRider.RidesRiders){
      return 0;
    }

    const joinTime = moment(rider.RidesRiders.joined_at);
    const oJoinTime = moment(oRider.RidesRiders.joined_at);

    if(joinTime.isValid() && oJoinTime.isValid())
      return joinTime.diff(oJoinTime,'ms');
    else 
      return joinTime ? -1 : (oJoinTime ? 1 : 0);
  };

  /** 
   * @param {Array<string>} fields
   * @param {JetInfos} infos*/
  riderModel.prototype.populate = function(fields,infos){
    /** @type {JetRiderInstance} */
    const rider = this;

    if(!Array.isArray(fields))
      throw new Error('Rider.populate fields arg must be an array of string');

    fields
      .map(field => field.toLowerCase())
      .forEach(field => {
        switch(field){
        case 'neighborhood':
        case 'hood':
          if(infos.hoodIdMap && typeof rider.neighborhood_id === 'number')
            rider.Neighborhood = infos.hoodIdMap[rider.neighborhood_id];
          break;

        case 'airport':
          if(infos.airportIdMap && rider.airport_id)
            rider.Airport = infos.airportIdMap[rider.airport_id];
          break;

        case 'terminal':
          if(infos.terminalIdMap && typeof rider.terminal_id === 'number')
            rider.Terminal = infos.terminalIdMap[rider.terminal_id];
          break;

        case 'address':
          if(infos.addressIdMap && rider.address_id)
            rider.Address = infos.addressIdMap[rider.address_id];
          break;

        case 'via':
          if(infos.viaIdMap && rider.via_id)
            rider.via = infos.viaIdMap[rider.via_id];
          break;
        
        default: 
        }
      });

  };




  return riderModel;
};