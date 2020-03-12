
const moment = require('moment');

const resAttr = require('../utils/commonResAttr');

const AGE_BRACKETS = require('../utils/commonFields').TRAVELER_AGE_BRACKETS;
const GENDERS = require('../utils/commonFields').TRAVELER_GENDERS;
const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Validator = seq.Validator;
  const Op = seq.Op;

  // DEFINITION
  /** @type {JetTravelerModel} */
  const travelerModel = sequelize.define('Traveler', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4},
    },
    email: {
      type: SeqTypes.STRING,
      unique: {
        name: 'email',
        msg: 'Email is already in use'
      },
      validate: {
        isEmail: {args: true, msg: 'Email is invalid'}
      },
    },
    first_name: {type: SeqTypes.STRING(20), allowNull: false},
    middle_name: {type: SeqTypes.STRING(20)},
    last_name: {type: SeqTypes.STRING(20), allowNull: false},
    dob: {type: SeqTypes.DATEONLY},
    public_name: {type: SeqTypes.STRING(20), allowNull: false},
    age_bracket: {type: SeqTypes.ENUM, values: AGE_BRACKETS},
    gender: {type: SeqTypes.ENUM, values: GENDERS},
    pic: {type: SeqTypes.INTEGER}
  }, {
    underscored: true        
  });
 

  /** @param {JetModels} models */
  travelerModel.associate = function(models) {
    this.belongsToMany(models.User, {through: models.UsersTravelers});
    this.belongsToMany(models.Via, {through: models.ViasTravelers});

    // MODEL METHODS REQUIRING MODELS
    travelerModel.isValidRequest = function(travReq, errors){
      if(!travReq.traveler){
        errors.errors = {traveler: 'Request needs to provide a traveler'};
        return false;
      }
    
      if(!travReq.userTraveler){
        errors.errors = {userTraveler: 'Request needs to provide a userTraveler'};
        return false;
      }
    
      if(!travReq.traveler.firstName){
        errors.errors = {firstName: 'First name cannot be blank'};
        return false;
      }
    
      if(!travReq.traveler.lastName){
        errors.errors = {lastName: 'Last name cannot be blank'};
        return false;
      }
    
      if(!travReq.traveler.publicName){
        errors.errors = {publicName: 'Public name cannot be blank'};
        return false;
      }
    
      if(travReq.traveler.dob && moment(travReq.traveler.dob).isValid()){
        travReq.traveler.dob = moment(travReq.traveler.dob).startOf('day').toDate();
      }
    
      if(typeof travReq.traveler.middleName !== 'string'){
        travReq.traveler.middleName = null;
      }
    
      // PROBLEM with Validator -- temporarily delegate to the front end
      // if(typeof travReq.traveler.email === 'string' || !Validator.isEmail(travReq.traveler.email)){
      //   errors.errors = {email: `traveler email '${travReq.traveler.email}' format is invalid`};
      //   return false;
      //   // travReq.traveler.email = null;
      // }
    
      if(typeof travReq.traveler.ageBracket === 'string' && !AGE_BRACKETS.includes(travReq.traveler.ageBracket)){
        errors.errors = {ageBracket: `If provided, age bracket must be among ${AGE_BRACKETS.join('|')}, was ${travReq.traveler.ageBracket}`};
        return false;
        // travReq.traveler.age_bracket = null;
      }
    
      if(typeof travReq.traveler.gender === 'string' && !GENDERS.includes(travReq.traveler.gender)){
        errors.errors = {gender: `If provided, gender must be among ${GENDERS.join('|')}, was ${travReq.traveler.gender}`}
        return false;
        // travReq.gender = null;
      }
  
      if(!models.UsersTravelers.isValidRequest(travReq.userTraveler,errors,travReq.traveler.publicName)){
        return false;
      }
  
      return true;
    };
  };

  // MODEL METHODS
  travelerModel.buildFromRequest = function(travReq){
    const trav = travReq.traveler;
    return travelerModel.build({
      email: trav.email ? trav.email.toLowerCase() : null,
      first_name: trav.firstName,
      last_name: trav.lastName,
      middle_name: trav.middleName,
      dob: trav.dob,
      public_name: trav.publicName,
      age_bracket: trav.ageBracket,
      gender: trav.gender,
      pic: trav.pic
    });
  };

  travelerModel.createMap = function(travIds){
    if(!Array.isArray(travIds) || !travIds.length)
      return Promise.resolve({});

    return travelerModel.findAll({
      where: {id: {[Op.in]: travIds}},
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES.concat(['id'])
    }).then(travelers => {
      const outMap = {};

      travelers.forEach(traveler => outMap[traveler.id] = traveler);
      return outMap;
    });
  };

  
  // INSTANCE METHODS
  travelerModel.prototype.createProfileResponse = function(){
    /** @type {JetTravelerInstance} */
    const trav = this;


    /** @type {JetTravelerProfileResponse} */
    const resp = {
      profile: {
        email: trav.email,
        firstName: trav.first_name,
        middleName: trav.middle_name,
        lastName: trav.last_name,
        dob: moment(trav.dob).isValid() ? moment(trav.dob).format('YYYY-MM-DD') : null,
        publicName: trav.public_name,
        ageBracket: trav.age_bracket,
        gender: trav.gender,
        pic: trav.pic
      },

      addressesCount: trav.Addresses.length,
      phonesCount: trav.Phones.length,
      emailsCount: trav.Emails.length,

      addresses: trav.Addresses.map(address => address.createSelectionResponse(null,address.TravelersAddresses)),
      phones: trav.Phones.map(phone => phone.createProfileResponse(phone.TravelersPhones.id, phone.TravelersPhones.alias)),
      emails: trav.Emails.map(email => email.createProfileResponse(email.TravelersEmails.id))
    };

    return resp;
  };

  travelerModel.prototype.createUserListResponse = function(){
    /** @type {JetTravelerInstance} */
    const trav = this; 

    /** @type {JetTravelerListResponse} */
    const resp = {
      ref: trav.UsersTravelers.id,
      primary: trav.UsersTravelers.primary_user,
      nickname: trav.UsersTravelers.nickname,
      relation: trav.UsersTravelers.relation,
      status: trav.UsersTravelers.status,
      pic: trav.pic,
      ordinal: trav.UsersTravelers.ordinal
    };

    return resp;
  };

  travelerModel.prototype.createViaResponse = function(ordinal = 0){
    /** @type {JetTravelerInstance} */
    const trav = this; 

    /** @type {JetViaTravelerResponse} */
    const resp = {
      viaRef: trav.ViasTravelers.id,
      userRef: trav.UsersTravelers ? trav.UsersTravelers.id : null,
      publicName: trav.UsersTravelers ? trav.UsersTravelers.nickname : trav.public_name,
      relation: trav.UsersTravelers ? trav.UsersTravelers.relation : null,
      ageBracket: trav.age_bracket,
      gender: trav.gender,
      pic: trav.pic,
      bookingStatus: trav.ViasTravelers.booking_status,
      volunteer: trav.ViasTravelers.volunteer,
      ordinal
    };

    return resp;
  };

  /** @param {{[travId: string]: JetUserTravelerInstance}} travMap
   * @param {JetViaInstance} via*/
  travelerModel.prototype.createRiderResponse = function(travMap = {}, via = null){
    /** @type {JetTravelerInstance} */
    const trav = this;

    const userTrav = travMap[trav.RidersTravelers.traveler_id];
    const travId = trav.RidersTravelers.traveler_id;
    
    /** @type {JetViaTravelerInstance}  */
    let viaTrav;

    if(via){
      if(via.Travelers){
        viaTrav = via.Travelers
          .map(t => t.ViasTravelers)
          .find(vt => vt.traveler_id === travId);
      
       } else if(via.ViasTravelers){
         viaTrav = via.ViasTravelers
          .find(vt => vt.traveler_id === travId); 
       }
    }
    
    /** @type {JetTravelerResponse} */
    const resp = {
      riderRef: trav.RidersTravelers.id,
      userRef: userTrav ? userTrav.id : null,
      viaRef: viaTrav ? viaTrav.id : null,
      publicName: userTrav ? userTrav.nickname : trav.public_name,
      relation: userTrav ? userTrav.relation : null,
      ageBracket: trav.age_bracket,
      gender: trav.gender,
      pic: trav.pic,
      ordinal: userTrav ? userTrav.ordinal : 10000
    };

    return resp;
  };

  /** @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
  travelerModel.prototype.createBeneficiaryResponse = function(travMap = {}){
    /** @type {JetTravelerInstance} */
    const trav = this;
    const userTrav = travMap[trav.TasksTravelers.traveler_id];

    /** @type {JetTaskMemberResponse} */
    const resp = {
      beneficiaryRef: trav.TasksTravelers.id,
      userRef: userTrav ? userTrav.id : null,
      publicName: userTrav ? userTrav.nickname : trav.public_name,
      relation: userTrav ? userTrav.relation : null,
      ageBracket: trav.age_bracket,
      gender: trav.gender,
      pic: trav.pic,
    };

    return resp;
  };

  /** @param {{[travId: string]: JetUserTravelerInstance}} travMap*/
  travelerModel.prototype.createTaskMemberResponse = function(travMap = {},private=false){
    /** @type {JetTravelerInstance} */
    const trav = this;
    const userTrav = travMap[trav.TasksViasTravelers.traveler_id];
    if(!private)
      private = trav.id && userTrav;

    /** @type {JetTaskMemberResponse} */
    const resp = {
      taskRef: trav.TasksViasTravelers.id,
      userRef: userTrav ? userTrav.id : null,
      viaRef: private ? trav.TasksViasTravelers.via_traveler_id : null,
      publicName: userTrav ? userTrav.nickname : trav.public_name,
      relation: userTrav ? userTrav.relation : null,
      ageBracket: trav.age_bracket,
      gender: trav.gender,
      pic: trav.pic,
      status: trav.TasksViasTravelers 
        ? trav.TasksViasTravelers.status
        : trav.TasksTravelers
          ? HELP_STATUS.helpee
          : null,
      rank: trav.TasksViasTravelers
        ? trav.TasksViasTravelers.rank
        : null
    };

    return resp;
  };


  /** @param {JetTravelerRequest} travReq */
  travelerModel.prototype.updateFromRequest = function(travReq){
    /** @type {JetTravelerInstance} */
    const traveler = this;

    let hasChange = false;

    // change email
    if(typeof travReq.traveler.email === 'string' && traveler.email !== travReq.traveler.email){
      traveler.email = travReq.traveler.email.toLowerCase();
      hasChange = true;
    }

    // change first name
    if(typeof travReq.traveler.firstName !== 'undefined' && traveler.first_name !== travReq.traveler.firstName){
      traveler.first_name = travReq.traveler.firstName;
      hasChange = true;
    }

    // change last name
    if(typeof travReq.traveler.lastName !== 'undefined' && traveler.last_name !== travReq.traveler.lastName){
      traveler.last_name = travReq.traveler.lastName;
      hasChange = true; 
    }

    // change middle name
    if(typeof travReq.traveler.middleName !== 'undefined' && traveler.middle_name !== travReq.traveler.middleName){
      traveler.middle_name = travReq.traveler.middleName;
      hasChange = true; 
    }

    // change dob
    if(typeof travReq.traveler.dob !== 'undefined'){
      let newDob = moment(travReq.traveler.dob);
      if(newDob.isValid()){
        newDob = moment(travReq.traveler.dob).startOf('day').toDate();

        if(newDob !== traveler.dob){
          traveler.dob = newDob;
          hasChange = true;
        }
      }
    }

    // change public name
    if(typeof travReq.traveler.publicName !== 'undefined' && traveler.public_name !== travReq.traveler.publicName){
      traveler.public_name = travReq.traveler.publicName;
      hasChange = true;
    }

    // change age bracket
    if(typeof travReq.traveler.ageBracket !== 'undefined' 
      && traveler.age_bracket !== travReq.traveler.ageBracket
      && AGE_BRACKETS.includes(travReq.traveler.ageBracket)){
      traveler.age_bracket = travReq.traveler.ageBracket; 
      hasChange = true; 
    }
    
    // change gender
    if(typeof travReq.traveler.gender !== 'undefined'
      && GENDERS.includes(travReq.traveler.gender)
      && traveler.gender !== travReq.traveler.gender){
      traveler.gender = travReq.traveler.gender;
      hasChange = true;
    }

    return hasChange;
  };


  

  return travelerModel;
};