module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetPhoneModel} */
  const phoneModel = sequelize.define('Phone', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}     
    },
    dial: {
      type: SeqTypes.STRING(12), 
      allowNull: false,
      validate: {is: /^[0-9]{5,12}$/}
    },
    local_text: {type: SeqTypes.BOOLEAN, defaultValue: true},
    intl_text: {type: SeqTypes.BOOLEAN, defaultValue: false},
    local_voice: {type: SeqTypes.BOOLEAN, defaultValue: true},
    intl_voice: {type: SeqTypes.BOOLEAN, defaultValue: false},
    local_data: {type: SeqTypes.BOOLEAN, defaultValue: true},
    intl_data: {type: SeqTypes.BOOLEAN, defaultValue: false},
    landline: {type: SeqTypes.BOOLEAN, defaultValue: false}
  },{
    underscored: true,
    // there is also an index on country_dial - added in the migration file
  });

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  phoneModel.associate = function(models){
    const countryModel = models['Country'];
    const addressModel = models['Address'];
    const userModel = models['User'];
    const travelerModel = models['Traveler'];

    this.belongsTo(countryModel, {foreignKey: 'country_id'});
    this.belongsTo(addressModel,{foreignKey: 'address_id'});

    this.belongsToMany(userModel,{through: models.UsersPhones});
    userModel.belongsToMany(this,{through: models.UsersPhones});

    this.belongsToMany(travelerModel,{through: models.TravelersPhones});
    travelerModel.belongsToMany(this,{through: models.TravelersPhones});

    // PHONE METHODS REQUIRING MODELS
    phoneModel.countUsersTravelers = function(id){
      return Promise.all([
        models.UsersPhones.count({where: {phone_id: id}}),
        models.TravelersPhones.count({where: {phone_id: id}})    
      ]).then(([userCount,travCount]) => userCount+travCount);
    };


    // INSTANCE METHODS REQUIRING MODELS
    this.prototype.saveInstance = function(countryCode){
      /** @type {JetPhoneInstance} */
      const phone = this;

      if(!countryCode || typeof countryCode !== 'string' || countryCode.length != 2){
        countryCode = 'US';
      }

      return models.Country.findById(countryCode).then(country => {
        phone.country_id = country.code;
        return phone.save();
      });
    };

    this.prototype.addUser = function(user, alias = 'cell'){
      alias = alias.substr(0,8);
      return models.UsersPhones.create({
        user_id: user.id,
        phone_id: this.id,
        alias
      });
    };

    this.prototype.addTraveler = function(traveler, alias = 'cell'){
      alias = alias.substr(0,8);
      return models.TravelersPhones.create({
        traveler_id: traveler.id,
        phone_id: this.id,
        alias
      });
    };
  };


  // MODEL STATIC METHODS
  phoneModel.buildFromFields = function(fields){
    const params = {};
    params.dial = fields.dial;
    if(typeof fields.localVoice === 'boolean') params.local_voice = fields.localVoice;
    if(typeof fields.intlVoice === 'boolean') params.intl_voice = fields.intlVoice;
    if(typeof fields.localText === 'boolean') params.local_text = fields.localText;
    if(typeof fields.intlText === 'boolean') params.intl_text = fields.intlText;
    if(typeof fields.localData === 'boolean') params.local_data = fields.localData;
    if(typeof fields.intlData === 'boolean') params.intl_data = fields.intlData;
    if(typeof fields.landline === 'boolean') params.landline = fields.landline;

    if(params.landline){
      params.intl_voice = params.intl_voice ? params.intl_voice : true;
      params.local_text = params.local_text ? params.local_text : false;
      params.intl_text = params.intl_text ? params.intl_text : false;
      params.local_data = params.local_data ? params.local_data : false;
      params.intl_data = params.intl_data? params.intl_data : false;
    }

    return phoneModel.build(params);
  };

  // INSTANCE METHODS
  phoneModel.prototype.updateFromFields = function(fields){
    /** @type {JetPhoneInstance} */
    const phone = this;
    
    phone.dial = typeof fields.dial === 'string' && /^[0-9]{5,12}$/.test(fields.dial) ? fields.dial : phone.dial;
    phone.local_voice = typeof fields.localVoice === 'boolean' ? fields.localVoice : phone.local_voice;
    phone.intl_voice = typeof fields.intlVoice === 'boolean' ? fields.intlVoice : phone.intl_voice;
    phone.local_text = typeof fields.localText === 'boolean' ? fields.localText : phone.local_text;
    phone.intl_text = typeof fields.intlText === 'boolean' ? fields.intlText : phone.intlText;
    phone.local_data = typeof fields.localData === 'boolean' ? fields.localData : phone.local_data;
    phone.intl_data = typeof fields.intlData === 'boolean' ? fields.intlData : phone.intl_data;
    phone.landline = typeof fields.landline === 'boolean' ? fields.landline : phone.landline;
  };

  /** @param {string} ref userPhone.id or travelerPhone.id
   * @param {string} alias userPhone.alias or travelerPhone.alias*/
  phoneModel.prototype.createProfileResponse = function(ref, alias = null){
    /** @type {JetPhoneInstance} */
    const phone = this;
    const country = phone.Country;

    /** @type {JetPhoneFullResponse} */
    const resp = {
      ref,
      alias,
      countryCode: country.code,
      countryFlag: country.flag_emoji,
      countryName: country.name,
      ext: country.phone,
      dial: phone.dial,
      localText: phone.local_text,
      intlText: phone.intl_text,
      localVoice: phone.local_voice,
      intlVoice: phone.intl_voice,
      localData: phone.local_data,
      intlData: phone.intl_data,
      landline: phone.landline
    };

    return resp;
  };

  // MODEL METHODS
  phoneModel.isValidRequest = function(phoneReq, errors, ind = 0){
    if(typeof phoneReq.countryCode !== 'string' || !/^\w\w$/.test(phoneReq.countryCode)){
      errors.errors[`phone${ind}`] = 'must have a valid country identified by its 2 letter code';
      return false;
    }
    phoneReq.countryCode = phoneReq.countryCode.toUpperCase();

    if(typeof phoneReq.dial !== 'string' || !/^[0-9]{5,12}$/.test(phoneReq.dial)){
      errors.errors[`phone${ind}`] = 'dial is not valid';
      return false;
    }

    return true;
  };

  phoneModel.isValidEdit = function(phoneReq, errors, ind = 0){
    if(typeof phoneReq.ref !== 'string' || phoneReq.ref.toString('hex') !== phoneReq.ref){
      errors.errors[`phone${ind}`] = 'phone.ref must be an hex string';
      return false;
    }

    if(typeof phoneReq.countryCode === 'string' && !/^\w\w$/.test(phoneReq.countryCode)){
      errors.errors[`phone${ind}`] = 'must have a valid country identified by its 2 letter code';
      return false;
    }
    phoneReq.countryCode = phoneReq.countryCode ? phoneReq.countryCode.toUpperCase() : null;

    if(typeof phoneReq.dial === 'string' && !/^[0-9]{5,12}$/.test(phoneReq.dial)){
      errors.errors[`phone${ind}`] = 'dial is not valid';
      return false;
    }

    return true;
  };

  return phoneModel;
};