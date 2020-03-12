const crypto = require('crypto');
const jsonwt = require('jsonwebtoken');

const {secret} = require ('../../config');

const USER_TRAVELER_STATUSES = require('../utils/commonFields').USER_TRAVELER_STATUSES;

module.exports = function(sequelize, DataTypes){
  /** @type {JetDataTypes}*/
  const SeqTypes = DataTypes;
  
  /** @type {JetSequelize} */
  const seq = sequelize;
  const Validator = seq.Validator;  

  // DEFINITION
  /** @type {JetUserModel} */
  const userModel = sequelize.define('User',
    {
      id: {
        type: SeqTypes.UUID,
        primaryKey: true,
        allowNull: false,
        defaultValue: SeqTypes.UUIDV4,
        validate: {isUUID: 4},
      },
      email: {
        type: SeqTypes.STRING, 
        allowNull: false, 
        unique: {
          name: 'email',
          msg: 'Email is already in use.'
        }, 
        validate: {isEmail: {
          args: true,
          msg: 'Email is invalid.'
        }
        }
      },
      salt: {type: SeqTypes.CHAR(32), allowNull: false},
      iteration: {type: SeqTypes.INTEGER, allowNull: false},
      hash: {type: SeqTypes.BLOB, allowNull: false},
      public_name: {type: SeqTypes.STRING(20), allowNull: false}      
    }, {
      underscored: true
    }
  );

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  userModel.associate = function(models){
    this.hasMany(models.UsersTravelers, {foreignKey: 'user_id', as: 'TravelerLinks'});

    this.belongsToMany(models.Traveler, {through: models.UsersTravelers});
    this.belongsToMany(models.Trip, {through: models.TripsUsers});
    
    // INSTANCE METHODS REQUIRING MODELS
    /** @param {JetTravelerInstance} traveler 
     * @param {JetUserTravelerRequest} userTravReq
     * @param {JetUserTravelerInstance}*/
    userModel.prototype.buildUserTraveler = function(traveler, userTravReq){
      /** @type {JetUserInstance} */
      const user = this;
      const isSelf = traveler.email && traveler.email === user.email;

      const nickname = userTravReq.nickname
        ? userTravReq.nickname
        : traveler.public_name;

      const relation = userTravReq.relation;

      const status = isSelf 
        ? USER_TRAVELER_STATUSES.active
        : USER_TRAVELER_STATUSES.dft; 
      
      const ordinal = user.Travelers.reduce((ord,entry) => Math.max(ord,entry.UsersTravelers.ordinal + 1),0);

      return models.UsersTravelers.build({
        user_id: user.id,
        traveler_id: traveler.id,
        nickname,
        relation,
        status,
        ordinal: Math.max(ordinal,0)
      });
    };
  };


  // INSTANCE METHODS that do not require associations
  // creates the hash, iteration and salt for the user
  userModel.prototype.setPassword = function(pwd) {
    this.salt = crypto.randomBytes(16).toString('hex');
    this.iteration = 10000;
	
    return new Promise((resolve,reject) => {
      crypto.pbkdf2(pwd,this.salt,this.iteration,512,'sha512', (err, derivedKey) => {
        if(err){
          return reject(err);
        }
        this.hash = derivedKey;
        return resolve();
      });
    });    
  };

  // returns TRUE if the password in valid
  /* eslint-disable no-undef*/
  userModel.prototype.validPassword = function(pwd) {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(pwd,this.salt,this.iteration,512,'sha512', (err,derivedKey) => {
        if(err){
          return reject(err);
        }    
        return resolve(this.hash.equals(derivedKey));
      });
    });
  };
  /* eslint-enable no-undef*/

  // create jwt for a user who has successfully logged in
  userModel.prototype.createJwt = function(riderId = null) {
    const today = new Date();
    const expiration = new Date(today);
    expiration.setDate(expiration.getDate() + 7);

    return new Promise((resolve,reject) => {
      jsonwt.sign({
        id: this.id,
        riderId: riderId,
        exp: Math.round(expiration.getTime()/1000),
      }, secret, (err, encoded) => {
        if(err){
          reject(err);
        } else {
          resolve(encoded);
        }
      });
    });
  };

  // private response to a user login
  userModel.prototype.createResponse = function(riderId = null) {
    return this.createJwt(riderId).then((token) => {
      return {
        name: this.public_name,
        email: this.email,
        token,
      };
    });
  };


  userModel.prototype.createProfileResponse = function(){
    /** @type {JetUserInstance} */
    const user = this;

    const travelers = user.Travelers.sort((t1,t2) => t1.UsersTravelers.ordinal - t2.UsersTravelers.ordinal);

    /** @type {JetUserProfileResponse} */
    const resp = {
      profile: {
        name: user.public_name,
        email: user.email
      },
      travelersCount: travelers.length,
      addressesCount: user.Addresses.length,
      phonesCount: user.Phones.length,
      emailsCount: user.Emails.length,

      travelers: travelers.map(traveler => traveler.createUserListResponse()),
      addresses: user.Addresses.map(address => address.createSelectionResponse(address.UsersAddresses,null)),
      phones: user.Phones.map(phone => phone.createProfileResponse(phone.UsersPhones.id, phone.UsersPhones.alias)),
      emails: user.Emails.map(email => email.createProfileResponse(email.UsersEmails.id))
    };

    return resp;

  };

  /** @param {JetUserRequest} userReq */
  userModel.prototype.updateFromRequest = function(userReq){
    /** @type {JetUserInstance} */
    const user = this;
    let hasChange = false;

    // change email
    if(userReq.profile.email 
        && typeof userReq.profile.email === 'string' 
        && user.email !== userReq.profile.email
    ){
      user.email = userReq.profile.email;
      hasChange = true;
    }

    // change public name
    if(userReq.profile.name
      && typeof userReq.profile.name === 'string' 
      && user.public_name !== userReq.profile.name
      ){
      user.public_name = userReq.profile.name;
      hasChange = true;
    }

    return hasChange;
  };

  // MODEL METHODS
  userModel.isValidRequest = function(userReq, errors){
    if(!userReq.profile){
      errors.errors['user'] = 'User update request needs a profile field';
      return false;
    }

    if(typeof userReq.profile.name === 'string' && !userReq.profile.name){
      errors.errors['user'] = 'User.profile name must not be empty';
      return false;
    }

    if(typeof userReq.profile.email === 'string' && !Validator.isEmail(userReq.profile.email)){
      errors.errors['user'] = 'User.profile email field is not valid';
      return false;
    }

    return true;
  };


  return userModel;
};

