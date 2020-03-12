const moment = require('moment');
const validator = require('validator');

const PAY_PREFS = require('../utils/commonFields').PAY_PREFS;
const SMOKE_PREFS = require('../utils/commonFields').SMOKE_PREFS;
const PET_PREFS = require('../utils/commonFields').PET_PREFS;
const CURB_PREFS = require('../utils/commonFields').CURB_PREFS;

module.exports = function(sequelize,DataTypes) {

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetRideRiderRequestModel} */
  const rideRiderRequestModel = sequelize.define('RideRiderRequest', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4} 
    },
    counter: {type: SeqTypes.BOOLEAN, allowNull: false, defaultValue: false},

    date: {type: SeqTypes.DATEONLY},
    start_time: {type: SeqTypes.TIME},

    seat_count: {type: SeqTypes.INTEGER},
    luggage_count: {type: SeqTypes.INTEGER},
    baby_seat_count: {type: SeqTypes.INTEGER},
    sport_equip_count: {type: SeqTypes.INTEGER},

    pay_method: {type: SeqTypes.ENUM,values: PAY_PREFS.values},
    smoke_policy: {type: SeqTypes.ENUM, values: SMOKE_PREFS.values},
    pet_policy: {type: SeqTypes.ENUM, values: PET_PREFS.values},
    curb_policy: {type: SeqTypes.ENUM, values: CURB_PREFS.values},

    close_ride: {type: SeqTypes.BOOLEAN},
    neighborhood_ordinal: {type: SeqTypes.INTEGER},
    terminal_ordinal: {type: SeqTypes.INTEGER}
    
  },{
    name: {singular: 'RideRiderRequest', plural: 'RideRiderRequests'},
    tableName: 'RideRiderRequests',
    underscored: true
  });

  /** @param {JetModels} models*/
  rideRiderRequestModel.associate = function(models){
    this.belongsTo(models.RidesRiders, {foreignKey: 'ride_rider_id'});
    this.belongsTo(models.Neighborhood, {as: 'RequestedNeighborhood', foreignKey: 'neighborhood_id'});
    this.belongsTo(models.Terminal, {as: 'RequestedTerminal', foreignKey: 'terminal_id'});

    this.hasMany(models.NeighborhoodDrop, {foreignKey: 'request_id'});
    this.hasMany(models.TerminalDrop, {foreignKey: 'request_id'});



    // INSTANCE METHODS REQUIRING MODELS
    /** @param {JetRideChangeRequest} changeReq
     * @param {JetRideInstance} ride
    */
    rideRiderRequestModel.prototype.updateFromChangeRequest = async function(changeReq, ride){
    /** @type {JetRideRiderRequestInstance} */
      const curRideRiderReq = this;

      curRideRiderReq.date = changeReq.newDate;
      curRideRiderReq.start_time = changeReq.newStartTime;

      curRideRiderReq.seat_count = changeReq.newRequirements.seatCount;
      curRideRiderReq.luggage_count = changeReq.newRequirements.luggageCount;
      curRideRiderReq.baby_seat_count = changeReq.newRequirements.babySeatCount;
      curRideRiderReq.sport_equip_count = changeReq.newRequirements.sportEquipCount;

      curRideRiderReq.pay_method = changeReq.newPolicies.payMethod;
      curRideRiderReq.smoke_policy = changeReq.newPolicies.smokePolicy;
      curRideRiderReq.pet_policy = changeReq.newPolicies.petPolicy;
      curRideRiderReq.curb_policy = changeReq.newPolicies.curbPolicy;

      curRideRiderReq.close_ride = changeReq.closeRide;

      curRideRiderReq.terminal_ordinal = changeReq.newTerminalStop && typeof changeReq.newTerminalStop.ordinal === 'number' 
        ? changeReq.newTerminalStop.ordinal : null;
      curRideRiderReq.neighborhood_ordinal = changeReq.newCityStop && typeof changeReq.newCityStop.ordinal === 'number' 
        ? changeReq.newCityStop.ordinal : null;

      const fetchReqs = [];
      const curReqHoodName = curRideRiderReq.RequestedNeighborhood ? curRideRiderReq.RequestedNeighborhood.name : '####';
      const curReqTermCode = curRideRiderReq.RequestedTerminal ? curRideRiderReq.RequestedTerminal.code : '####';
      
      const updateHood = changeReq.newCityStop 
        && typeof changeReq.newCityStop.neighborhoodName === 'string' 
        && changeReq.newCityStop.neighborhoodName !== curReqHoodName;

      const updateTerm = changeReq.newTerminalStop
        && typeof changeReq.newTerminalStop.terminalCode === 'string'
        && changeReq.newTerminalStop.terminalCode !== curReqTermCode;

      try{
        if(updateHood){
          fetchReqs.push(models.Neighborhood.findOne({
            where: {[Op.and]: [
              {agglo_id: ride.agglo_id},
              {name: changeReq.newCityStop.neighborhoodName}
            ]},
            attributes: ['id']
          }));
        }
  
        if(updateTerm){
          fetchReqs.push(models.Terminal.findOne({
            where: {[Op.and]: [
              {airport_id: ride.airport_id},
              {code: changeReq.newTerminalStop.terminalCode}
            ]}
          }));
        }
  
        const fetchResults = fetchReqs.length ? await Promise.all(fetchReqs) : [];
  
  
        if(updateHood){
          const newHood = fetchResults[0];
          if(newHood){
            curRideRiderReq.neighborhood_id = newHood.id;
          } else {
            return Promise.reject({
              rideRiderRequest: `Neighborhood "${changeReq.newCityStop.neighborhoodName}" not found for the ride agglo`
            });
          }
        }
  
        if(updateTerm){
          const newTerm = fetchResults[updateHood ? 1 : 0];
          if(newTerm){
            curRideRiderReq.terminal_id = newTerm.id;
          } else {
            return Promise.reject({
              rideRiderRequest: `Terminal "${changeReq.newTerminalStop.terminalCode}" not found for the ride airport`
            });
          }
        }
  
        return curRideRiderReq;

      } catch(error){
        return Promise.reject(error);
      }
    };


    /** @param {JetRideInstance} ride
    * @param {JetRideRiderInstance} rideRider
    * @param {JetRideChangeRequest} changeReq */
    rideRiderRequestModel.prototype.saveAndUpdateDrops = function(ride, changeReq){
      /** @type {JetRideRiderRequestInstance} */
      const thisReq = this;

      if(!thisReq.TerminalDrops){
        thisReq.TerminalDrops = [];
      }

      if(!thisReq.NeighborhoodDrops){
        thisReq.NeighborhoodDrops = [];
      }

      /** @type {Array<JetTerminalDropInstance>} */
      const curTermDrops = thisReq.TerminalDrops;

      /** @type {Array<JetNeighborhoodDropInstance>} */
      const curHoodDrops = thisReq.NeighborhoodDrops;

      /** @type {function(string): JetTerminalInstance} */
      const getTermStop = Array.isArray(ride.TerminalStops)
        ? termStopId => ride.TerminalStops.find(term => term.RidesTerminals.ride_rider_id === termStopId)
        : () => null;

      /** @type {function(string): JetNeighborhoodInstance} */
      const getHoodStop = Array.isArray(ride.CityStops)
        ? hoodStopId => ride.CityStops.find(hood => hood.RidesNeighborhoods.ride_rider_id === hoodStopId)
        : () => null;


      /** @type {Array<JetTerminalInstance>} */
      const reqTermStopDrop = changeReq.terminalStopDrops.map(getTermStop).filter(termStop => !!termStop);
      
      /** @type {Array<JetNeighborhoodInstance>} */
      const reqCityStopDrop = changeReq.cityStopDrops.map(getHoodStop).filter(cityStop => !!cityStop);


      const newTermStopDrops = reqTermStopDrop
        .filter(termStop => !curTermDrops.find(curTermStop => curTermStop.terminal_stop_id === termStop.id));
    
      const newHoodStopDrops = reqCityStopDrop
        .filter(cityStop => !curHoodDrops.find(curCityStop => curCityStop.city_stop_id === cityStop.id));  
    
      const cancelledTermStopDrops = curTermDrops
        .filter(curTermStop => !reqTermStopDrop.find(termStop => termStop.RidesTerminals.id === curTermStop.terminal_stop_id));

      const cancelledHoodStopDrops = curHoodDrops
        .filter(curCityStop => !reqCityStopDrop.find(cityStop => cityStop.RidesNeighborhoods.id === curCityStop.city_stop_id));
    
      return thisReq.save()
        .then(() => {
          const dropReqs = [];

          if(newTermStopDrops.length){
            dropReqs.push(...newTermStopDrops.map(termStop => {
              const termDrop = models.TerminalDrop.build({
                request_id: thisReq.id,
                terminal_stop_id: termStop.RidesTerminals.id
              });

              thisReq.TerminalDrops.push(termDrop);
              return termDrop.save();
            }));
          }

          if(newHoodStopDrops.length){
            dropReqs.push(...newHoodStopDrops.map(hoodStop => {
              const hoodDrop = models.NeighborhoodDrop.build({
                request_id: thisReq.id,
                city_stop_id: hoodStop.RidesNeighborhoods.id
              });

              thisReq.NeighborhoodDrops.push(hoodDrop);
              return hoodDrop.save();
            }));
          }

          if(cancelledTermStopDrops.length){
            cancelledTermStopDrops.forEach(termStopDrop => {
              thisReq.TerminalDrops.splice(thisReq.TerminalDrops.indexOf(termStopDrop),1);
            });
            dropReqs.push(...cancelledTermStopDrops.map(termStopDrop => termStopDrop.destroy()));
          }

          if(cancelledHoodStopDrops.length){
            cancelledHoodStopDrops.forEach(hoodStopDrop => {
              thisReq.NeighborhoodDrops.splice(thisReq.NeighborhoodDrops.indexOf(hoodStopDrop),1);
            });
            dropReqs.push(...cancelledHoodStopDrops.map(cityStopDrop => cityStopDrop.destroy()));
          }

          return dropReqs.length 
            ? Promise.all(dropReqs).then(() => (thisReq)) 
            : Promise.resolve(thisReq);

        });
    };


    // STATIC METHODS REQUIRING MODELS
    rideRiderRequestModel.buildFromChangeRequest = async function(changeReq, rideRider, ride, counter=false){

      try{
        const rideRiderReq = rideRiderRequestModel.build({
          ride_rider_id: rideRider.id,
          counter,
    
          date: changeReq.newDate,
          start_time: changeReq.newStartTime,
    
          seat_count: changeReq.newRequirements.seatCount,
          luggage_count: changeReq.newRequirements.luggageCount,
          baby_seat_count: changeReq.newRequirements.babySeatCount,
          sport_equip_count: changeReq.newRequirements.sportEquipCount,
    
          pay_method: changeReq.newPolicies.payMethod,
          smoke_policy: changeReq.newPolicies.smokePolicy,
          pet_policy: changeReq.newPolicies.petPolicy,
          curb_policy: changeReq.newPolicies.curbPolicy,
    
          close_ride: changeReq.closeRide,
    
          terminal_ordinal: changeReq.newTerminalStop ? changeReq.newTerminalStop.ordinal : null,
          neighborhood_ordinal: changeReq.newCityStop ? changeReq.newCityStop.ordinal : null,
        });

        const reqHoodName = changeReq.newCityStop 
          ? changeReq.newCityStop.neighborhoodName : null;

        const reqTermCode = changeReq.newTerminalStop 
          ? changeReq.newTerminalStop.terminalCode : null;

        const fetchReqs = []; 

        if(reqHoodName){
          fetchReqs.push(models.Neighborhood.findOne({
            where: {[Op.and]: {
              agglo_id: ride.agglo_id,
              name: reqHoodName
            }},
            attributes: ['id']
          }));
        }

        if(typeof reqTermCode === 'string'){
          fetchReqs.push(models.Terminal.findOne({
            where: {[Op.and]: [
              {airport_id: ride.airport_id},
              {code: reqTermCode}
            ]},
            attributes: ['id']
          }));
        }

        const fetchResults = fetchReqs.length ? await Promise.all(fetchReqs) : [];

        if(reqHoodName){
          const hood = fetchResults[0];
          if(hood){
            rideRiderReq.neighborhood_id = hood.id;
          } else {
            return Promise.reject({
              rideRiderRequest: `Neighborhood "${changeReq.newCityStop.neighborhoodName}" not found for the ride agglo`
            });
          }
        }

        if(reqTermCode){
          const term = fetchResults[reqHoodName ? 1 : 0];
          if(term){
            rideRiderReq.terminal_id = term.id;
          } else {
            return Promise.reject({
              rideRiderRequest: `Terminal "${changeReq.newTerminalStop.terminalCode}" not found for the ride airport`
            });
          }
        }

        return Promise.resolve(rideRiderReq);
      
      } catch(error){
        return Promise.reject(error);
      }
    };
  };


  // STATIC METHODS
  rideRiderRequestModel.isValidChangeRequest = function(changeReq, errors){
    if(changeReq){
      changeReq.hasChange = false;

      if(changeReq.newDate){
        if(moment(changeReq.newDate,'YYYY-MM-DD').isValid()){
          changeReq.newDate = moment(changeReq.newDate,'YYYY-MM-DD').toDate();
          changeReq.hasChange = true;
        } else {
          errors['changeRequest date'] = {newDate: 'New date must be of format YYYY-MM-DD'};
          return false;
        }
      }

      if(changeReq.newStartTime){
        if(moment(changeReq.newStartTime,'HH:mm').isValid()){
          changeReq.newStartTime = moment(changeReq.newStartTime, 'HH:mm').format('HH:mm');
          changeReq.hasChange = true;
        } else {
          errors['changeRequest startTime'] = {newStartTime: 'New start time must be of format HH:mm'};
          return false;          
        }
      }

      if(!changeReq.cityStopDrops || !Array.isArray(changeReq.cityStopDrops)){
        errors['changeRequest cityStopDrops'] = {cityStopDrops: 'City stops to be dropped must of type array (but may be empty)'};
        return false;         
      } else if (changeReq.cityStopDrops.length){
        if(!changeReq.cityStopDrops.every(entry => validator.isUUID(entry,4))){
          errors['changeRequest cityStopDrops'] = {cityStopDrops: 'City stops entries must be uuid'};
          return false;           
        }
        changeReq.hasChange = true;
      }

      if(!changeReq.terminalStopDrops || !Array.isArray(changeReq.terminalStopDrops)){
        errors['changeRequest terminalStopDrops'] = {terminalStopDrop: 'Terminal stops to be dropped must of type array (but may be empty)'};
        return false;    
      } else if(changeReq.terminalStopDrops.length){
        if(!changeReq.terminalStopDrops.every(entry => validator.isUUID(entry,4))){
          errors['changeRequest terminalStopDrops'] = {terminalStopDrops: 'Terminal stops entries must be uuid'};
          return false;           
        }
        changeReq.hasChange = true;        
      }

      if(changeReq.newCityStop
        && changeReq.newCityStop.hasOwnProperty('ordinal')
        && changeReq.newCityStop.hasOwnProperty('neighborhoodName')){
        if(typeof changeReq.newCityStop.neighborhoodName !== 'string' 
          || !Number.isInteger(Number(changeReq.newCityStop.ordinal))){
          errors['changeRequest newCityStop'] = {newCityStop: 'If present, newCityStop must have neighborhoodName and ordinal field'
            +'\nwhich must be of type string and integer.'};
          return false;
        }
        changeReq.hasChange = true; 
      }

      if(changeReq.newTerminalStop 
        && changeReq.newTerminalStop.hasOwnProperty('ordinal') 
        && changeReq.newTerminalStop.hasOwnProperty('terminalCode')){
        if(typeof changeReq.newTerminalStop.terminalCode !== 'string'
          || !Number.isInteger(Number(changeReq.newTerminalStop.ordinal))){
          errors['changeRequest newTerminalStop'] = {newCityStop: 'If present, newTerminalStop must have terminalCode and ordinal fields'
            +'\nwhich must be of type string and integer.'};
          return false;
        }
        changeReq.hasChange = true; 
      }

      if(changeReq.newRequirements){
        const newReqs = changeReq.newRequirements;
        
        if(typeof newReqs.seatCount !== 'undefined'){
          if(!Number.isInteger(Number(newReqs.seatCount)) || Number(newReqs.seatCount) <= 0){
            errors['changeRequest seatCount'] = {seatCount: 'If present, newRequirement.seatCount must be a strictly positive integer'};
            return false;          
          }
          newReqs.seatCount = Number(newReqs.seatCount);
          changeReq.hasChange = true; 
        } else {
          newReqs.seatCount = null;
        }

        if(typeof newReqs.luggageCount !== 'undefined'){
          if(!Number.isInteger(Number(newReqs.luggageCount)) || Number(newReqs.luggageCount) <= 0){
            errors['changeRequest luggageCount'] = {luggageCount: 'If present, newRequirement.luggageCount must be a positive integer'};
            return false;          
          }
          newReqs.luggageCount = Number(newReqs.luggageCount);
          changeReq.hasChange = true; 
        } else {
          newReqs.luggageCount = null;
        }

        if(typeof newReqs.babySeatCount !== 'undefined'){
          if(!Number.isInteger(Number(newReqs.babySeatCount)) || Number(newReqs.babySeatCount) <= 0){
            errors['changeRequest babySeatCount'] = {babySeatCount: 'If present, newRequirement.babySeatCount must be a positive integer'};
            return false;          
          }
          newReqs.babySeatCount = Number(newReqs.babySeatCount);
          changeReq.hasChange = true; 
        } else {
          newReqs.babySeatCount = null;
        }

        if(typeof newReqs.sportEquipCount !== 'undefined'){
          if(!Number.isInteger(Number(newReqs.sportEquipCount)) || Number(newReqs.sportEquipCount) <= 0){
            errors['changeRequest sportEquipCount'] = {sportEquipCount: 'If present, newRequirement.sportEquipCount must be a positive integer'};
            return false;          
          }
          newReqs.sportEquipCount = Number(newReqs.sportEquipCount);
          changeReq.hasChange = true; 
        } else {
          newReqs.sportEquipCount = null;
        }
        
      } else {
        errors['changeRequest newRequirements'] = {newRequirement: 'Ride change request must have a field "newRequirement"'};
        return false;        
      }


      if(changeReq.newPolicies){
        const newPols = changeReq.newPolicies;
        
        if(newPols.payMethod){
          if(!PAY_PREFS.values.includes(newPols.payMethod)){
            errors['changeRequest payMethod'] = {payMethod: `If present, payMethod must be among [ ${PAY_PREFS.values.join(' | ')} ]`};
            return false;          
          }
          changeReq.hasChange = true; 
        } else {
          newPols.payMethod = null;
        }

        if(newPols.smokePolicy){
          if(!SMOKE_PREFS.values.includes(newPols.smokePolicy)){
            errors['changeRequest smokePolicy'] = {smokePolicy: `If present, smokePolicy must be among [ ${SMOKE_PREFS.values.join(' | ')} ]`};
            return false;          
          }
          changeReq.hasChange = true; 
        } else {
          newPols.smokePolicy = null;
        }

        if(newPols.petPolicy){
          if(!PET_PREFS.values.includes(newPols.petPolicy)){
            errors['changeRequest petPolicy'] = {petPolicy: `If present, petPolicy must be among [ ${PET_PREFS.values.join(' | ')} ]`};
            return false;          
          }
          changeReq.hasChange = true; 
        } else {
          newPols.petPolicy = null;
        }

        if(newPols.curbPolicy){
          if(!CURB_PREFS.values.includes(newPols.curbPolicy)){
            errors['changeRequest curbPolicy'] = {curbPolicy: `If present, curbPolicy must be among [ ${CURB_PREFS.values.join(' | ')} ]`};
            return false;          
          }
          changeReq.hasChange = true; 
        } else {
          newPols.curbPolicy = null;
        }

      } else {
        errors['changeRequest newPolicies'] = {newPolicies: 'Ride change request must have a field "newPolicies"'};
        return false;            
      }

      if(typeof changeReq.closeRide === 'undefined'){
        errors['changeRequest closeRide'] = {closeRide: 'Ride change request must have a field "close ride"'};
        return false;         
      } else if(typeof changeReq.closeRide === 'boolean'){
        changeReq.hasChange = true; 
      } else {
        changeReq.closeRide = null;
      }

      return true;
    }

    return false;
  };


  // INSTANCE METHODS
  /** @param {JetRideInstance} ride */
  rideRiderRequestModel.prototype.modifyRide = function(ride){
    /** @type {JetRideRiderRequest} */
    const changeReq = this;

    ride.date = changeReq.date && moment(changeReq.date,'YYYY-MM-DD').isValid() 
      ? moment(changeReq.date,'YYYY-MM-DD').toDate()
      : ride.date;

    ride.start_time = changeReq.start_time
      ? moment(changeReq.start_time,'HH:mm').format('HH:mm')
      : ride.start_time;

    ride.seat_count = typeof changeReq.seat_count === 'number' ? changeReq.seat_count : ride.seat_count;
    ride.luggage_count = typeof changeReq.luggage_count === 'number' ? changeReq.luggage_count : ride.luggage_count;
    ride.baby_seat_count = typeof changeReq.baby_seat_count === 'number' ? changeReq.baby_seat_count : ride.baby_seat_count;
    ride.sport_equip_count = typeof changeReq.sport_equip_count === 'number' ? changeReq.sport_equip_count : ride.sport_equip_count;

    ride.pay_method = PAY_PREFS.values.includes(changeReq.pay_method) ? changeReq.pay_method : ride.pay_method;
    ride.smoke_policy = SMOKE_PREFS.values.includes(changeReq.smoke_policy) ? changeReq.smoke_policy : ride.smoke_policy;
    ride.pet_policy = PET_PREFS.values.includes(changeReq.pet_policy) ? changeReq.pet_policy : ride.pet_policy;
    ride.curb_policy = CURB_PREFS.values.includes(changeReq.curb_policy) ? changeReq.curb_policy : ride.curb_policy;
  };

  rideRiderRequestModel.prototype.closeRide = function(){
    /**@type {JetRideRiderRequestInstance} */
    const request = this;
    return typeof request.close_ride === 'boolean' ? request.close_ride : null;
  };

  /** @param {JetRideInstance} ride
   * @return {JetRideChangeResponse}*/
  rideRiderRequestModel.prototype.createResponse = function(ride){
    /** @type {JetRideRiderRequestInstance} */
    const rideReq = this;

    const termStopDrops = rideReq.TerminalDrops ? rideReq.TerminalDrops : [];
    const hoodStopDrops = rideReq.NeighborhoodDrops ? rideReq.NeighborhoodDrops : [];
    
    /** @type {JetRideChangeResponse} */
    const resp = {
      newDate: rideReq.date ? moment(rideReq.date,'YYYY-MM-DD').format('YYY-MM-DD') : null,
      newStartTime: rideReq.start_time ? moment(rideReq.start_time,'HH:mm').format('HH:mm') : null,
    };

    if(rideReq.RequestedNeighborhood){
      resp.newCityStop = {
        ordinal: rideReq.neighborhood_ordinal,
        neighborhoodName: rideReq.RequestedNeighborhood.name
      };
    } else {
      resp.newCityStop = {ordinal: null, neighborhoodName: null};
    }

    if(rideReq.RequestedTerminal){
      resp.newTerminalStop = {
        ordinal: rideReq.terminal_ordinal,
        terminalName: rideReq.RequestedTerminal.name,
        terminalCode: rideReq.RequestedTerminal.code
      };
    } else {
      resp.newTerminalStop = {ordinal: null, terminalName: null, terminalCode: null};
    }

    resp.terminalStopDrops = termStopDrops
      .map(termStopDrop => {
        const termStop = ride.TerminalStops.find(termStop => termStop.RidesTerminals.id === termStopDrop.terminal_stop_id);
        return termStop ? termStop.RidesTerminals.ride_rider_id : null;
      }).filter(rideRiderId => !!rideRiderId);

    resp.cityStopDrops = hoodStopDrops
      .map(hoodStopDrop => {
        const hoodStop = ride.CityStops.find(hoodStop => hoodStop.RidesNeighborhoods.id === hoodStopDrop.city_stop_id);
        return hoodStop ? hoodStop.RidesNeighborhoods.ride_rider_id : null;
      }).filter(rideRiderId => !! rideRiderId);

    resp.newRequirements = {
      seatCount: rideReq.seat_count,
      luggageCount: rideReq.luggage_count,
      babySeatCount: rideReq.baby_seat_count,
      sportEquipCount: rideReq.sport_equip_count
    };

    resp.newPolicies = {
      payMethod: rideReq.pay_method,
      smokePolicy: rideReq.smoke_policy,
      petPolicy: rideReq.pet_policy,
      curbPolicy: rideReq.curb_policy
    };

    resp.closeRide = rideReq.close_ride;

    return resp;
  };

  /** @param {JetRideRiderRequestInstance} oReq*/
  rideRiderRequestModel.prototype.differsFrom = function(oReq){

    /** @type {JetRideRiderRequestInstance} */
    const req = this;

    if(!oReq){
      throw Error('Cannot compare a request with a null object');
    }

    req.start_time = req.start_time
      ? moment(req.start_time,'HH:mm').format('HH:mm')
      : null;

    oReq.start_time = oReq.start_time
      ? moment(oReq.start_time,'HH:mm').format('HH:mm')
      : null;

    const fields = [
      'ride_rider_id','date','start_time',
      'seat_count','luggage_count','baby_seat_count','sport_equip_count',
      'pay_method','smoke_policy','pet_policy','curb_policy',
      'close_ride',
      'terminal_id', 'terminal_ordinal',
      'neighborhood_id','neighborhood_ordinal'
    ];

    if(fields.some(field => {
      const v = req[field];
      const o = oReq[field];

      //console.log(`FIELD: ${field}: ${v}, ${o}`);
      return typeof v === 'undefined' || typeof o === 'undefined'
        ? true : v !== o; 
    })){
      return true;
    }

    if(req.TerminalDrops.some(termDrop => !oReq.TerminalDrops.find(oTermDrop => oTermDrop.terminal_stop_id === termDrop.terminal_stop_id))
      || oReq.TerminalDrops.some(oTermDrop => req.TerminalDrops.find(termDrop => termDrop.terminal_stop_id === oTermDrop.terminal_stop_id))
      || req.NeighborhoodDrops.some(hoodDrop => !oReq.NeighborhoodDrops.find(oHoodDrop => oHoodDrop.city_stop.id === hoodDrop.city_stop_id))
      || oReq.NeighborhoodDrops.some(oHoodDrop => req.NeighborhoodDrops.find(hoodDrop => hoodDrop.city_stop_id === oHoodDrop.city_stop_id))){
      return true;
    }

    return false;
  };

  rideRiderRequestModel.prototype.closeRequested = function(){
    /** @type {JetRideRiderRequestInstance} */
    const request = this;
    return typeof request.close_ride === 'boolean' ? request.close_ride : false;
  };


  return rideRiderRequestModel;
};