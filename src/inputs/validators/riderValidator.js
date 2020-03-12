const moment = require('moment');

const RIDE_WAYS = require('../../utils/commonFields').RIDE_WAYS;
const RIDE_TYPES = require('../../utils/commonFields').RIDE_TYPES;
const RIDER_PREFS = require('../../utils/commonFields').RIDER_PREFS;

const PAY_PREFS = require('../../utils/commonFields').PAY_PREFS;
const SMOKE_PREFS = require('../../utils/commonFields').SMOKE_PREFS;
const PET_PREFS = require('../../utils/commonFields').PET_PREFS;
const CURB_PREFS = require('../../utils/commonFields').CURB_PREFS;


/** @param {JetModels} models */
module.exports = function(models){
  /** @type {JetRiderValidator} */
  const riderValidator = {};


  riderValidator.request = function(riderRequest, ind, errors, fromVia = true){
    if(fromVia){
      if(typeof riderRequest.viaOrdinal === 'undefined' || !Number.isInteger(Number(riderRequest.viaOrdinal))){
        errors.errors['riderRequest' + ind] = 'Rider request must have a "viaOrdinal" field of type integer';
        return false;
      }
   
    } else {
      /** @type {JetRiderFullRequest} */
      const request = riderRequest;
      if(!request.date || !moment(request.date).isValid()){
        errors.errors['riderRequest' + ind] = 'Rider request must have a "date" field of type date';
        return false;          
      }

      if(!request.startTime || !moment(request.startTime,'hh:mm').isValid()){
        errors.errors['riderRequest' + ind] = 'Rider request must have a "startTime" field of type time';
        return false;          
      }

      if(!request.airportLocation){
        errors.errors['riderRequest' + ind] = 'Rider request must have an "airportLocation" field';
        return false;          
      
      } else {
        if(!request.airportLocation.airportCode || !/^[A-Z]{3}$/.test(request.airportLocation.airportCode)){
          errors.errors['riderRequest' + ind] = 'RiderRequest.airportLocation.airportCode must be a 3 letter iata code';
          return false;            
        }
        request.airportLocation.airportCode = request.airportLocation.airportCode.toUpperCase();

        if(typeof request.airportLocation.terminalCode !== 'string'){
          request.airportLocation.terminalCode = null;
        }
      }
    }

    if(!riderRequest.toward || !RIDE_WAYS.values.includes(riderRequest.toward)){
      errors.errors['riderRequest' + ind] = `Rider request must have a "toward" field and its value must be in: ${RIDE_WAYS.values.join(',')}`;
      return false;        
    }

    if(!riderRequest.cityLocation){
      errors.errors['riderRequest' + ind] = 'Rider request must have a "cityLocation" field';
      return false;  

    } else if(!models.Address.isValidCityStopRequest(riderRequest.cityLocation,errors,'RiderRequest.cityLocation',ind))
      return false;


    if(riderRequest.travelers && Array.isArray(riderRequest.travelers) && riderRequest.travelers.length){
      if(!riderRequest.travelers.every((traveler, index) => {
        if(fromVia){
          if(!traveler.viaRef || traveler.viaRef.toString('hex') !== traveler.viaRef){
            errors.errors['riderRequest' + ind + ' traveler' + index] = 'Each traveler must have a "viaRef" field of type hex string';
            return false;              
          }
        } else {
          if(!traveler.userRef || traveler.userRef.toString('hex') !== traveler.userRef){
            errors.errors['riderRequest' + ind + ' traveler' + index] = 'Each traveler must have a "userRef" field of type hex string';
            return false;
          }
        }
        return true;
      })){
        return false;
      }

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "travelers" field of type array, which cannot be empty';
      return false;         
    }

    if(riderRequest.requirements){
      const reqs = riderRequest.requirements;
      reqs.babySeatCount = typeof reqs.babySeatCount === 'number' && Number.isInteger(reqs.babySeatCount)
        ? Math.max(reqs.babySeatCount, 0) : 0;

      reqs.seatCount = typeof reqs.seatCount === 'number' && Number.isInteger(reqs.seatCount)
        ? Math.max(reqs.seatCount,riderRequest.travelers.length + reqs.babySeatCount) 
        : riderRequest.travelers.length + reqs.babySeatCount;

      reqs.luggageCount = typeof reqs.luggageCount === 'number' && Number.isInteger(reqs.luggageCount)
        ? Math.max(reqs.luggageCount, 0) : riderRequest.travelers.length;

      reqs.sportEquipCount = typeof reqs.sportEquipCount === 'number' && Number.isInteger(reqs.sportEquipCount)
        ? Math.max(reqs.sportEquipCount, 0) : 0;

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "requirements" field';
      return false; 
    }

    if(riderRequest.preferences){
      const prefs = riderRequest.preferences;
      prefs.ridePref = prefs.ridePref && RIDER_PREFS.values.includes(prefs.ridePref)
        ? prefs.ridePref : RIDER_PREFS.dft;

      prefs.payPref = prefs.payPref && PAY_PREFS.values.includes(prefs.payPref)
        ? prefs.payPref : PAY_PREFS.dft;

      prefs.smokePref = prefs.smokePref && PAY_PREFS.values.includes(prefs.smokePref)
        ? prefs.smokePref : SMOKE_PREFS.dft;

      prefs.petPref = prefs.petPref && SMOKE_PREFS.values.includes(prefs.petPref)
        ? prefs.petPref : PET_PREFS.dft;

      prefs.curbPref = prefs.curbPref && CURB_PREFS.values.includes(prefs.curbPref)
        ? prefs.curbPref : CURB_PREFS.values;

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "preferences" field';
      return false;         
    }

    if(riderRequest.ride && typeof riderRequest.ride.createRide === 'boolean'){
      const rideReq = riderRequest.ride;
      if(rideReq.createRide){
        if(!rideReq.rideType || !RIDE_TYPES.values.includes(rideReq.rideType)){
          errors.errors['riderRequest' + ind] = `RiderRequest.ride must have a field "rideType" with a value among ${RIDE_TYPES.values.join(',')}`;
          return false;         
        }

        if(typeof rideReq.publicRide !== 'boolean' || Boolean(rideReq.publicRide) !== rideReq.publicRide){
          errors.errors['riderRequest' + ind] = 'RiderRequest.ride must have a field "publicRide" of type boolean';
          return false;         
        }
      }

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "ride" field with a field createRide of type boolean';
      return false;         
    }

    if(riderRequest.ride && riderRequest.ride.createRide){
      if(!riderRequest.ride.rideType || !RIDE_TYPES.values.includes(riderRequest.ride.rideType)){
        errors.errors[`riderRequest${ind}`] = 'When requesting a ride, a valid rideType must be provided';
        return false;
      }
    }
    return true;
  };


  riderValidator.updateRequest = function(request, ind, errors){
    if(request.startTime && !moment(request.startTime,'hh:mm').isValid()){
      errors.errors['riderRequest' + ind] = 'Rider request "startTime" is in valid "hh:mm" format';
      return false;          
    }

    if(typeof request.useHoodOnly !== 'boolean'){
      errors.errors['riderRequest' + ind] = 'Rider request must have a field "useHoodOnly" of type boolean';
      return false;       
    }

    if(typeof request.fromVia !== 'boolean'){
      errors.errors['riderRequest' + ind] = 'Rider request must have a field "fromVia" of type boolean';
      return false; 
    }

    const fromVia = request.fromVia;
    
    if(request.airportLocation){
      if(typeof request.airportLocation.terminalCode === 'string'){
        request.airportLocation.terminalCode = request.airportLocation.terminalCode.toLowerCase();
      } else {
        request.airportLocation.terminalCode = null;
        request.airportLocation.airportCode = null;
      }
     
    } else {
      errors.errors[`riderRequest${ind}`] = 'Rider request must have a field "AirportLocation"';
      return false;
    }

    
    if(!request.cityLocation){
      errors.errors['riderRequest' + ind] = 'Rider request must have a "cityLocation" field';
      return false;   
    
    } else if (!models.Address.isValidCityStopRequest(request.cityLocation,errors,'RiderRequest.cityLocation',ind))
      return false;


    if(request.travelers && Array.isArray(request.travelers) && request.travelers.length){
      if(!request.travelers.every((traveler, index) => {
        if(fromVia){
          let hasRef = false;
          if(traveler.viaRef && traveler.viaRef.toString('hex') === traveler.viaRef){
            traveler.userRef = null;
            hasRef = true;           
          } else if(traveler.userRef && traveler.userRef.toString('hex') === traveler.userRef){
            traveler.viaRef = null;
            hasRef = true;
          }

          if(!hasRef){
            errors.errors['riderRequest' + ind + ' traveler' + index] = 'Each traveler must have a "viaRef" field of type hex string';
            return false;
          }

        } else {
          traveler.viaRef = null;
          if(!traveler.userRef || traveler.userRef.toString('hex') !== traveler.userRef){
            errors.errors['riderRequest' + ind + ' traveler' + index] = 'Each traveler must have a "userRef" field of type hex string';
            return false;
          }
        }
        return true;
      })){
        return false;
      }

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "travelers" field of type array, which cannot be empty';
      return false;         
    }

    if(request.requirements){
      const reqs = request.requirements;
      reqs.babySeatCount = typeof reqs.babySeatCount === 'number' && Number.isInteger(reqs.babySeatCount)
        ? Math.max(reqs.babySeatCount, 0) : null;

      reqs.seatCount = typeof reqs.seatCount === 'number' && Number.isInteger(reqs.seatCount)
        ? Math.max(reqs.seatCount,request.travelers.length + reqs.babySeatCount) 
        : null;

      reqs.luggageCount = typeof reqs.luggageCount === 'number' && Number.isInteger(reqs.luggageCount)
        ? Math.max(reqs.luggageCount, 0) : null;

      reqs.sportEquipCount = typeof reqs.sportEquipCount === 'number' && Number.isInteger(reqs.sportEquipCount)
        ? Math.max(reqs.sportEquipCount, 0) : null;

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "requirements" field';
      return false; 
    }

    if(request.ride && typeof request.ride.createRide === 'boolean'){
      const rideReq = request.ride;
      if(rideReq.createRide){
        if(!rideReq.rideType || !RIDE_TYPES.values.includes(rideReq.rideType)){
          errors.errors['riderRequest' + ind] = `RiderRequest.ride must have a field "rideType" with a value among ${RIDE_TYPES.values.join(',')}`;
          return false;         
        }

        if(typeof rideReq.publicRide !== 'boolean' || Boolean(rideReq.publicRide) !== rideReq.publicRide){
          errors.errors['riderRequest' + ind] = 'RiderRequest.ride must have a field "publicRide" of type boolean';
          return false;         
        }
      }

    } else {
      errors.errors['riderRequest' + ind] = 'Rider request must have a "ride" field with a field createRide of type boolean';
      return false;         
    }

    return true;
  };

  return riderValidator;
};