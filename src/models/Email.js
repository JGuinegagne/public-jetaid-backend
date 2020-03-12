module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Validator = seq.Validator;

  /** @type {JetEmailModel} */
  const emailModel = sequelize.define('Email', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}     
    },
    email: {
      type: SeqTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: {
          args: true,
          msg: 'Email is invalid.'
        }
      }
    },
    verified: {type: SeqTypes.BOOLEAN, defaultValue: false}
  }, {
    indexes: [{
      attributes: ['email']
    }],
    underscored: true
  });

  /** @param {JetModels} models */
  emailModel.associate = function(models){
    const userModel = models['User'];
    const travelerModel = models['Traveler'];

    this.belongsToMany(userModel, {through: models.UsersEmails});
    userModel.belongsToMany(this, {through: models.UsersEmails});

    this.belongsToMany(travelerModel, {through: models.TravelersEmails});
    travelerModel.belongsToMany(this, {through: models.TravelersEmails});

    // MODEL METHODS
    emailModel.countUsersTravelers = function(id){
      return Promise.all([
        models.UsersEmails.count({where: {email_id: id}}),
        models.TravelersEmails.count({where: {email_id: id}})    
      ]).then(([userCount,travCount]) => userCount+travCount);
    };

    // INSTANCE METHODS REQUIRING MODELS
    this.prototype.countUsersTravelers = function(){
      return Promise.all([
        models.UsersEmails.count({where: {email_id: this.id}}),
        models.TravelersEmails.count({where: {email_id: this.id}})
      ]).then(([userCount,travCount]) => ({userCount,travCount}));
    };
  };


  // MODEL METHODS
  emailModel.isValidRequest = function(email, errors, ind=0){
    if(!email || !Validator.isEmail(email)){
      errors.errors[`email${ind}`] = `email ${email} is not valid`;
      return false;
    }

    return true;
  };

  emailModel.convertToRequests = function(emails){
    return emails.length
      ? emails.map(email => ({email, verified: false}))
      : [];
  };

  emailModel.isValidEdit = function(emailReq, errors, ind = 0){
    if(typeof emailReq.email !== 'string'){
      errors.errors[`email${ind}`] = 'edit request must have a field email of type string';
      return false;
    }

    if(!emailModel.isValidRequest(emailReq.email, errors, ind)){
      return false;
    }

    if(typeof emailReq.ref !== 'string' || emailReq.ref.toString('hex') !== emailReq.ref){
      errors.errors[`email${ind}`] = 'edit request must have a field ref of type hex string';
      return false;
    }

    return true;
  };

  emailModel.buildFromFields = function(emailReq){
    return emailModel.build({
      email: emailReq.email.toLowerCase(),
      verified: false
    });
  };

  // INSTANCE METHODS
  /** @param {JetEmailRequest} fields*/
  emailModel.prototype.updateFromFields = function(fields){
    /** @type {JetEmailInstance} */
    const email = this;

    email.email = fields.email ? fields.email.toLowerCase() : email.email;
    email.verified = false;
  };

  /** @param {string} ref */
  emailModel.prototype.createProfileResponse = function(ref){
    /** @type {JetEmailInstance} */
    const email = this;

    /** @type {JetEmailFullResponse} */
    const resp = {
      ref,
      email: email.email,
      verified: email.verified
    };
    
    return resp;
  };

  return emailModel;
};