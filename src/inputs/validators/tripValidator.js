const moment = require('moment');

const VIA_CHANGES = require('../../utils/commonFields').VIA_CHANGE_TYPES;

/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetTripValidator} */
  const tripValidator = {};

  tripValidator.request = function(tripRequest, ind, errors, isUpdate = false){
    if(isUpdate){
      if(!tripRequest.tripUser ||  !tripRequest.tripUser.ref 
        || tripRequest.tripUser.ref.toString('hex') !== tripRequest.tripUser.ref){
        errors['tripRequest' + ind] = 'Update trip request must have a tripUser.ref of type string "hex"';
        return false;
      }
    }

    if(!tripRequest.vias || !Array.isArray(tripRequest.vias)){
      errors['tripRequest' + ind]= 'Trip request must have a "vias" property';
      return false;
    
    } else if(!tripRequest.vias.length){
      errors['tripRequest' + ind]= 'TripRequest.vias must not be empty';
      return false;
    
    } else {
      return tripRequest.vias.every((viaRequest, index) => {
        return tripValidator.viaRequest(viaRequest, index, errors, isUpdate);
      });
    }
  };


  tripValidator.viaRequest = function(viaRequest, ind, errors, isUpdate = false) {
    if(!viaRequest.dep){
      errors['viaRequest' + ind]= 'Via request must have a \'dep\' property';
      return false;
  
    } else {
      if(typeof viaRequest.dep.airportCode !== 'string' || viaRequest.dep.airportCode.length !== 3){
        errors['viaRequest' + ind] = 'ViaRequest.dep must have an "\'AirportCode\' property of exactly 3 char';
        return false;    
      } else {
        viaRequest.dep.airportCode = viaRequest.dep.airportCode.toUpperCase();
      }

      if(!viaRequest.dep.date){
        errors['viaRequest' + ind] = 'ViaRequest.dep must have a \'date\' property';
        return false;
      
      } else {
        const depDate = moment(viaRequest.dep.date);
        if(!depDate.isValid()){
          errors['viaRequest' + ind] = 'ViaRequest.dep.date is invalid';
          return false;
        }
      }

      if(!viaRequest.dep.time){
        errors['viaRequest' + ind] = 'ViaRequest.dep must have an \'time\' property';
        return false;         
      } else {
        const depTime = moment(viaRequest.dep.date, ['HH:mm', 'HH:mm:ss']);
        if(!depTime.isValid()){
          errors['viaRequest' + ind] = 'ViaRequest.dep.time is invalid';
          return false;
        } 
      }
    }

    if(!viaRequest.arr){
      errors['viaRequest' + ind]= 'Via request must have an \'arr\' property';
      return false;
      
    } else {
      if(typeof viaRequest.arr.airportCode !== 'string' || viaRequest.arr.airportCode.length !== 3){
        errors['viaRequest' + ind] = 'ViaRequest.arr must have an \'airportCode\' property of exactly 3 char';
        return false;    
      } else {
        viaRequest.arr.airportCode = viaRequest.arr.airportCode.toUpperCase();
      }

      if(!viaRequest.arr.date){
        errors['viaRequest' + ind] = 'ViaRequest.arr must have a \'date\' property';
        return false;
          
      } else {
        const arrDate = moment(viaRequest.arr.date);
        if(!arrDate.isValid()){
          errors['viaRequest' + ind] = 'ViaRequest.arr.date is invalid';
          return false;
        }
      }
    
      if(!viaRequest.arr.time){
        errors['viaRequest' + ind] = 'ViaRequest.arr must have an \'time\' property';
        return false;         
      } else {
        const arrTime = moment(viaRequest.arr.date, ['HH:mm', 'HH:mm:ss']);
        if(!arrTime.isValid()){
          errors['viaRequest' + ind] = 'ViaRequest.arr.time is invalid';
          return false;
        } 
      }
    }

    if(!viaRequest.travelers || !Array.isArray(viaRequest.travelers)){
      errors['viaRequest' + ind] = 'ViaRequest must have a property \'travelers\' of type array';
      return false;
  
    } else if(!viaRequest.travelers.length){
      errors['viaRequest' + ind] = 'ViaRequest.travelers must not be empty';
      return false;        
    } else if (!viaRequest.travelers.every(trav => {
      return typeof trav.ref === 'string' && trav.ref.toString('hex') === trav.ref;
    })){
      errors['viaRequest' + ind] = 'ViaRequest[travelers.ref] must be an hex string';
      return false;        
    }

    if(!viaRequest.flight){
      errors['viaRequest' + ind] = 'ViaRequest must have a property \'flight\' of type object.';
      return false;    
    }

    if(isUpdate){
      if(typeof viaRequest.update !== 'string'){
        errors['viaRequest' + ind] = 'ViaRequest must include an update property';
        return false;

      } else if(!VIA_CHANGES.includes(viaRequest.update)){
        errors['viaRequest' + ind] = 'ViaRequest.update must be either "add", "del", "chg" or "idm"';
        return false;
      }

      if(viaRequest.ordinal && !Number.isInteger(viaRequest.ordinal)){
        errors['viaRequest' + ind] = 'If present, viaRequest.ordinal must be of type integer';
      }
    }

    return true;
  };

  return tripValidator;
};