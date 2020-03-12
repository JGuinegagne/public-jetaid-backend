const commonFields = require('./commonFields');

/** @param {JetRideType} rideType
 * @return {number}*/
const getDftSeatCount = function(rideType){
  if(!rideType || !commonFields.RIDE_TYPES.values.includes(rideType)){
    return 0;
  } else switch(rideType){
  case 'shareCab': return 3;
  case 'cabRide': return 3;
  case 'relativeCar': return 3;
  case 'ownCar' : return 4;
  case 'rentalCar': return 4;
  default: return 0;
  }
};

/** @param {JetRideType} rideType
 * @return {number}*/
const getDftLuggageCount = function(rideType){
  if(!rideType || !commonFields.RIDE_TYPES.values.includes(rideType)){
    return 0;
  } else switch(rideType){
  default: return 4;
  }
};

/** @param {JetRideType} rideType
 * @return {number}*/
const getDftBabySeatCount = function(rideType){
  if(!rideType || !commonFields.RIDE_TYPES.values.includes(rideType)){
    return 0;
  } else switch(rideType){
  default: return 0;
  }
};

  /** @param {JetRideType} rideType
 * @return {number}*/
const getDftSportEquipCount = function(rideType){
  if(!rideType || !commonFields.RIDE_TYPES.values.includes(rideType)){
    return 0;
  } else switch(rideType){
  default: return 0;
  }
};

/** @param {JetRiderPref} riderPref 
 * @return {JetRideType}*/
const getDftRideType = function(riderPref){
  if(!riderPref || !commonFields.RIDER_PREFS.values.includes(riderPref)){
    return commonFields.RIDE_TYPES.dft;
  } else switch(riderPref){
  default: return 'shareCab';
  }
};

/** @param {JetRideType} rideType 
 * @return {JetRiderStatus}*/
const getCreatorRiderStatus = function(rideType){
  switch(rideType){
  case 'ownCar': return 'driver';
  case 'rentalCar': return 'driver';
  case 'cabRide': return 'driver';
  case 'relativeCar': return 'provider';
  default: return 'owner';
  }
};

/** @param {JetRiderStatus} riderStatus*/
const riderStatusAllowsFind = function(riderStatus){
  return riderStatus
    && commonFields.RIDER_STATUS.values.includes(riderStatus) 
    && !commonFields.RIDER_STATUS.exclusions.includes(riderStatus);
};

/** @param {JetRiderStatus} riderStatus*/
const riderStatusAllowsPersist = function(riderStatus){
  return riderStatus 
    && commonFields.RIDER_STATUS.values.includes(riderStatus)
    && !commonFields.RIDER_STATUS.keyRider.includes(riderStatus);
};

/** @param {JetRiderStatus} riderStatus*/
const riderStatusAllowsSave = function(riderStatus){
  return riderStatus 
    && commonFields.RIDER_STATUS.allowSave.includes(riderStatus);
};

/** @param {JetRiderStatus} riderStatus*/
const riderStatusAllowsApply = function(riderStatus){
  return riderStatus 
    && commonFields.RIDER_STATUS.allowApply.includes(riderStatus);
};

/** @param {JetRiderStatus} riderStatus*/
const riderStatusAllowsJoin = function(riderStatus){
  return riderStatus
    && commonFields.RIDER_STATUS.allowJoin.includes(riderStatus);
};

/** @param {JetRiderStatus} riderStatus */
const riderStatusAllowsApprove = function(riderStatus){
  return riderStatus
    && commonFields.RIDER_STATUS.allowApprove.includes(riderStatus);
};

/** @param {JetRiderStatus} riderStatus */
const riderStatusAllowsMessage = function(riderStatus){
  return riderStatus
    ? commonFields.RIDER_STATUS.allowApprove.includes(riderStatus)
      || commonFields.RIDER_STATUS.isPending.includes(riderStatus)
    : false;
};

/** @param {JetRiderStatus} riderStatus */
const getRiderStatusPriority = function(riderStatus){
  if(!riderStatus || !commonFields.RIDER_STATUS.riderUniques.includes(riderStatus))
    return 100;
  else switch(riderStatus){
  case 'driver': return 0;
  case 'provider' : return 1;
  case 'owner': return 2;
  default: return 10;
  }
};

/** @param {JetPayPref} ridePayPolicy
 * @param {JetPayPref} riderPayPref*/
const getPayMatchPenalty = function(ridePayPolicy, riderPayPref){
  if(commonFields.PAY_PREFS.values.includes(ridePayPolicy) 
    && commonFields.PAY_PREFS.values.includes(riderPayPref)
    && ridePayPolicy !== riderPayPref
    && ridePayPolicy !== commonFields.PAY_PREFS.flex
    && riderPayPref !== commonFields.PAY_PREFS.flex){
    return -0.1;
  }
  return 0;
};

/** @param {JetSmokePref} rideSmokePolicy
 * @param {JetSmokePref} riderSmokePref*/
const getSmokeMatchPenalty = function(rideSmokePolicy, riderSmokePref){
  if(commonFields.SMOKE_PREFS.values.includes(rideSmokePolicy) 
    && commonFields.SMOKE_PREFS.values.includes(riderSmokePref)
    && rideSmokePolicy !== riderSmokePref
    && rideSmokePolicy !== commonFields.SMOKE_PREFS.flex
    && riderSmokePref !== commonFields.SMOKE_PREFS.flex){
    return -0.05;
  }
  return 0;
};

/** @param {JetSmokePref} ridePetPolicy
 * @param {JetSmokePref} riderPetPref*/
const getPetMatchPenalty = function(ridePetPolicy, riderPetPref){
  if(commonFields.CURB_PREFS.values.includes(ridePetPolicy) 
    && commonFields.CURB_PREFS.values.includes(riderPetPref)
    && ridePetPolicy !== riderPetPref
    && ridePetPolicy !== commonFields.CURB_PREFS.flex
    && riderPetPref !== commonFields.CURB_PREFS.flex){
    return 0;
  }
  return 0;
};

/** @param {JetCurbPref} rideCurbPolicy
 * @param {JetCurbPref} riderCurbPref*/
const getCurbMatchPenalty = function(rideCurbPolicy, riderCurbPref){
  if(commonFields.CURB_PREFS.values.includes(rideCurbPolicy) 
    && commonFields.CURB_PREFS.values.includes(riderCurbPref)
    && rideCurbPolicy !== riderCurbPref
    && rideCurbPolicy !== commonFields.CURB_PREFS.flex
    && riderCurbPref !== commonFields.CURB_PREFS.flex){
    return -0.1; // TODO: refine
  }
  return 0;
};

/** @param {JetHelpStatus} helpStatus */
const getMemberStatusPriority = function(helpStatus){
  if(helpStatus){
    switch(helpStatus){
    case commonFields.HELP_STATUS.helpee: return 0;
    case commonFields.HELP_STATUS.helper: return 1;
    case commonFields.HELP_STATUS.backup: return 2;
    default: return 100;
    }
  }
  return 100;
};

/** @param {JetChangeType} currentType 
 * @param {JetChangeType} newType
 * @return {JetChangeType} */
const getChangeType = function(currentType, newType){
  if(newType === 'breaking')
    return 'breaking';

  else switch(currentType){
  case 'breaking': return 'breaking';
  case 'restrictive': return newType === 'expanding' ? 'breaking' : 'restrictive';
  case 'expanding': return newType === 'restrictive' ? 'breaking' : 'expanding';
  default: return newType;
  }
};

module.exports = {
  getDftSeatCount,
  getDftLuggageCount,
  getDftBabySeatCount,
  getDftSportEquipCount,
  getDftRideType,
  getCreatorRiderStatus,
  riderStatusAllowsFind,
  riderStatusAllowsPersist,
  riderStatusAllowsSave,
  riderStatusAllowsApply,
  riderStatusAllowsJoin,
  riderStatusAllowsApprove,
  riderStatusAllowsMessage,
  getRiderStatusPriority,
  getPayMatchPenalty,
  getSmokeMatchPenalty,
  getPetMatchPenalty,
  getCurbMatchPenalty,
  getMemberStatusPriority,
  getChangeType
};