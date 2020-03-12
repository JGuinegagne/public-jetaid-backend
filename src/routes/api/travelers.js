const express = require('express');
const moment = require('moment');

const auth = require('../authorization');
const resAttr = require('../../utils/commonResAttr');
const isValidHex = require('../../utils/commonFunctions').isValidHex;

/** @type {JetModels} */
const models = require('../../models');
const Validator = require('../../models').sequelize.Validator;
const Op = require('../../models').sequelize.Op;

const router = express.Router();
moment.locale('en-US');

// ----------------------------------------------------------------------------------
// response utility
/** @type {(userTrav: JetUserTravelerInstance, traveler: JetTravelerInstance) => {userTraveler: JetUserTravelerResponse, traveler: JetTravelerProfileResponse}}*/
const createFullProfileResponse = function(userTrav, traveler){
  return Object.assign(
    {userTraveler: userTrav.createResponse()},
    traveler.createProfileResponse()
  );
};

// ----------------------------------------------------------------------------------
// Route post: creates a new traveler and associate it with the current user
// Adds fields .userTraveler, .user and .traveler to req
router.post('/', auth.required, async (req, res, next) => {
  if(!req.body){
    return res.status(422).send({errors: {body: 'Create traveler request must have a body'}});
  }

  const errors = {};
  if(!models.Traveler.isValidRequest(req.body, errors)){
    return res.status(422).send(errors);
  }

  try{
    const [user,oTraveler] = await Promise.all([
      models.User.findById(req.payload.id, {
        include: [{
          model: models.Traveler,
          attributes: ['public_name'],
          through: {
            attributes: ['id','nickname','status','relation','ordinal'],
            order: [['ordinal','ASC']]
          }
        }]
      }),
      req.body.traveler.email
        ? models.Traveler.findOne({
          attributes: ['email'],
          where: {email: {[Op.iLike]: req.body.traveler.email}}
        })
        : Promise.resolve(null)
    ]);

    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(oTraveler){
      return res.status(403).send({errors: {email: 'This email is already associated with a traveler'}});
    }

    let traveler = models.Traveler.buildFromRequest(req.body);
    const userTrav = user.buildUserTraveler(traveler,req.body.userTraveler);  

    await traveler.save();
    await userTrav.save();

    traveler = await models.Traveler.findById(traveler.id, models.queries.FETCH_TRAVELER_PROFILE);

    return res.status(200).send(createFullProfileResponse(userTrav,traveler));
  
  } catch(error){
    next(error);
  }
});


// Route post/link: creates a link between the traveler identified by its email and the curent user
// Expecting request in the form api/travelers/link
// with req.body.traveler {email} to identify the traveler 
// and req.body.userTraveler {nickname,relation} to define the user-traveler association
router.post('/link', auth.required, async (req, res, next) => {
  if(!req.body.traveler){
    return res.status(422).send({errors: {traveler: 'Request needs to provide a traveler'}});
  }
    
  if(!req.body.userTraveler){
    return res.status(422).send({errors: {userTraveler: 'Request needs to provide a userTraveler'}});
  }

  if(!req.body.traveler.email || !Validator.isEmail(req.body.traveler.email)){
    return res.status(422).send({errors: {travelerEmail: 'Request needs to provide a valid traveler.email'}});  
  }

  if(!req.body.password){
    return res.status(422).send({errors: {password: 'Request needs to provide a password'}});  
  }

  const errors = {};
  if(!models.UsersTravelers.isValidRequest(req.body.userTraveler)){
    return res.status(422).send(errors);
  }

  try{
    const [user,traveler] = await Promise.all([
      models.User.findById(req.payload.id, {
        include: [{
          model: models.Traveler,
          attributes: ['id','public_name'],
          through: {
            attributes: ['id','nickname','status','relation','ordinal'],
            order: [['ordinal','ASC']]
          }
        }]
      }),
      models.Traveler.findOne({
        where: {email: {[Op.iLike]: req.body.traveler.email}},
        attributes: resAttr.LINK_TRAVELER_ATTRIBUTES,
        include: models.queries.FETCH_TRAVELER_PROFILE.include
      })
    ]);

    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(!traveler){
      return res.status(404).send({errors: {email: `No traveler associated with email: ${req.body.traveler.email}`}});
    }

    if(user.Travelers.find(trav => trav.id === traveler.id)){
      return res.status(403).send({errors: {alreadyAssociated: 'Traveler is already associated with the logged user'}});
    }

    if(!await user.validPassword(req.body.password))
      return res.status(403).send({errors: {password: 'is invalid'}});

    const userTrav = user.buildUserTraveler(traveler,req.body.userTraveler);
    await userTrav.save();
  
    return res.json(createFullProfileResponse(userTrav,traveler));

  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// Register param :user_traveler_id
// Expecting request in the form api/travelers/:user_traveler_id
// Adds fields .userTraveler
router.param('user_traveler_id',(req,res,next,id) => {
  models.UsersTravelers.findById(id).then(userTraveler => {
    if(!userTraveler)
      return res.status(404).send({errors: {userTraveler: 'link user-traveler could not be found'}});

    req.userTraveler = userTraveler;
    next();
  }).catch(next);
});

// ----------------------------------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
/** Checks that the logged user is associated with the target traveler
 * @param {Request} req 
 * @param {Response} res 
 * @param {NextFunction} next */
const checkAuth = function(req, res, next){
  if(!req.userTraveler || !req.payload.id){
    return res.status(404).send({errors: {userTraveler: 'user-traveler link not found'}});
  }

  if(req.userTraveler && req.payload && req.userTraveler.user_id !== req.payload.id){
    return res.status(403).send({erros: {userTraveler: 'logged user is not authorized to update this traveler'}});
  }
  next();
};


// ----------------------------------------------------------------------------------
// Route get: review a traveler private profile
// Expecting request in the form api/travelers/:user_traveler_id/profile
// Adds fields .userTraveler, .user and .traveler to req
router.get('/:user_traveler_id/profile', auth.required, checkAuth, async (req,res,next) => {
  try{
    const traveler = await models.Traveler.findById(req.userTraveler.traveler_id, models.queries.FETCH_TRAVELER_PROFILE);
    
    if(!traveler){
      return res.status(404).send({errors: {traveler: 'traveler could not be found'}});
    }
    return res.status(200).send(createFullProfileResponse(req.userTraveler, traveler));

  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// Route delete: unlink an existing traveler from a user
// Expecting request in the form api/travelers/:user_traveler_id
// Permanently delete the traveler if it isn't associated with any user anymore
router.delete('/:user_traveler_id',auth.required, checkAuth, async (req, res, next) => {
  if(!req.query || typeof req.query.password !== 'string'){
    return req.status(422).send({errors: {password: 'is missing'}});
  }

  /** @type {string} */ const password = req.query.password;

  try{
    /** @type {JetUserTravelerInstance} */
    const userTraveler = req.userTraveler;
    const travId = req.userTraveler.traveler_id;

    const user = await models.User.findByPk(userTraveler.user_id);
    if(!user)
      return req.status(404).send({errors: {user: 'User not found'}});

    if(!await user.validPassword(password))
      return res.status(403).send({errors: {password: 'Is invalid'}});

    await userTraveler.destroy();

    if(await models.UsersTravelers.count({where: {traveler_id: travId}}) <= 0){
      const traveler = await models.Traveler.findById(travId, {attributes: ['id']});
      await traveler.destroy();
      return res.status(203).send({success: 'Traveler was deleted'});
    }
    
    return res.status(203).send({success: 'Link between user and traveler was removed'});

  } catch (error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// Update private user profile: change infos such as emails or addresses
// Returns traveler profile response
router.put('/:user_traveler_id/profile', auth.required, checkAuth, async (req, res, next) => {
  // PUT/profile STEP #0: Validate new address/phone/email requests
  if(!req.body || !req.body.traveler){
    return res.status(422).send({errors: {traveler: 'Request to update a traveler profile must have a "traveler" field'}});
  }

  if(!req.body.userTraveler){
    return res.status(422).send({errors: {userTraveler: 'Request to update a traveler profile must have a "userTraveler" field'}});
  }

  /** @type {Array<JetReferencedAddressRequest>} */
  const newAddressRequests = req.body.newAddresses && Array.isArray(req.body.newAddresses)
    ? req.body.newAddresses : [];

  /** @type {Array<JetPhoneRequest>} */
  const newPhoneRequests = req.body.newPhones && Array.isArray(req.body.newPhones)
    ? req.body.newPhones : [];

    /** @type {Array<string>} */
  const newEmails = req.body.newEmails && Array.isArray(req.body.newEmails)
    ? req.body.newEmails : [];
  
  
  const errors = {errors: {}};
  if( !newAddressRequests.every((addressReq,ind) => models.Address.isValidRequest(addressReq,errors,ind))
    | !newPhoneRequests.every((phoneReq,ind) => models.Phone.isValidRequest(phoneReq,errors,ind))
    | !newEmails.every((emailReq,ind) => models.Email.isValidRequest(emailReq,errors,ind))
  ){  
    return res.status(422).send(errors);
  }

  const newEmailRequests = models.Email.convertToRequests(newEmails);

  // PUT/profile STEP #0: Validate edit address/phone/email requests
  /** @type {Array<JetReferencedAddressRequest>} */
  const editAddressRequests = req.body.updatedAddresses && Array.isArray(req.body.updatedAddresses)
    ? req.body.updatedAddresses : [];

  /** @type {Array<JetPhoneRequest>} */
  const editPhoneRequests = req.body.updatedPhones && Array.isArray(req.body.updatedPhones)
    ? req.body.updatedPhones : [];

  /** @type {Array<JetEmailRequest>} */
  const editEmailRequests = req.body.updatedEmails && Array.isArray(req.body.updatedEmails)
    ? req.body.updatedEmails : [];
  

  if(!editAddressRequests.every((addressReq,ind) => models.Address.isValidEdit(addressReq,errors,ind))
    | !editPhoneRequests.every((phoneReq,ind) => models.Phone.isValidEdit(phoneReq,errors,ind))
    | !editEmailRequests.every((emailReq,ind) => models.Email.isValidEdit(emailReq,errors,ind))){
    return res.status(422).send(errors);
  }

  // PUT/profile STEP #0: Validate unlink address/phone/email requests
  /** @type {Array<string>} */
  const unlinkedAddressIds = req.body.deletedAddresses && Array.isArray(req.body.deletedAddresses)
    ? req.body.deletedAddresses : [];

  /** @type {Array<string>} */
  const unlinkedPhoneIds = req.body.deletedPhones && Array.isArray(req.body.deletedPhones)
    ? req.body.deletedPhones : [];

  /** @type {Array<string>} */
  const unlinkedEmailIds = req.body.deletedEmails && Array.isArray(req.body.deletedEmails)
    ? req.body.deletedEmails.filter(id => id && id.toString('hex') === id) : [];

  if(!unlinkedAddressIds.every(isValidHex('deleteAddress',errors))
    | !unlinkedPhoneIds.every(isValidHex('deletePhone',errors))
    | !unlinkedEmailIds.every(isValidHex('deleteEmail',errors))){
    return res.status(422).send(errors);
  }
  

  try {  
    // PUT/profile route: STEP #1 -------------------------------------------------------------------------
    // Fetch user, traveler, geocode info of the addresses (new & edit)
    // Fetch requested travelersAddresses and map it as travAddressId -> travAddress instance
    // Does the same for requested travelersPhones and travelersEmails
    /** @type {JetUserTravelerInstance} */
    const userTraveler = req.userTraveler;
    const travId = userTraveler.traveler_id;

    /* eslint-disable no-unused-vars */
    const [user,traveler,emailTraveler,_unused,travAddressMap,travPhoneMap,travEmailMap]
    /* eslint-enable no-unused-vars */
      
      = await Promise.all([
        models.User.findById(req.userTraveler.user_id),
        models.Traveler.findById(req.userTraveler.traveler_id),
        req.body.traveler.email
          ? models.Traveler.findOne({
            where: {email: {[Op.iLike]: req.body.traveler.email}}, 
            attributes: ['id']
          })
          : Promise.resolve(null),
        models.Address.fetchGeocodeInfos([
          ...newAddressRequests,
          ...editAddressRequests
        ]),
        models.TravelersAddresses.createMap(
          travId,
          [
            ...editAddressRequests.map(editReq => editReq.references.ref),
            ...unlinkedAddressIds
          ]
        ),
        models.TravelersPhones.createMap(
          travId,
          [
            ...editPhoneRequests.map(editReq => editReq.ref),
            ...unlinkedPhoneIds
          ]
        ),
        models.TravelersEmails.createMap(
          travId,
          [
            ...editEmailRequests.map(editReq => editReq.ref),
            ...unlinkedEmailIds
          ]
        )
      ]);
    // PUT/profile route: End of STEP #1 ------------------------------------------------------------------


    // PUT/profile route: STEP #2 -------------------------------------------------------------------------
    // Checks that the user, traveler were found
    // Checks that all referenced travelerAddress, travelerPhone and travelerEmail were found
    // Then proceed to master update
    // -- create new address (and addressInfo), phone and email instance, and associate with traveler
    // -- update and save address (and addressInfo), phone and email instances
    // -- unlink address, phone and emails, and delete them if no longer associated with any user/traveler
    // -- update and save traveler instance
    // -- update and save userTraveler instance
    if(!user){
      return res.status(404).send({errors: {user: 'User not found'}});
    }

    if(!traveler){
      return res.status(404).send({errors: {traveler: 'Traveler not found'}});
    }

    if(emailTraveler && emailTraveler.id !== traveler.id){
      return res.status(403).send({errors: {email: 'Email already exists'}});
    }

    if(
      ! editAddressRequests.every((editReq,ind) => {
        const travAddress = travAddressMap[editReq.references.ref];
        if(travAddress){
          editReq.travAddress = travAddress;
          return true;
        }

        errors.errors[`editAddress${ind}`] = 'address to be edited could not be found or be matched to the traveler';
        return false;
      
      }) | !editPhoneRequests.every((editReq,ind) => {
        const travPhone = travPhoneMap[editReq.ref];
        if(travPhone){
          editReq.travPhone = travPhone;
          return true;
        }
  
        errors.errors[`editPhone${ind}`] = 'phone to be edited could not be found or be matched to the traveler';
        return false;
      
      }) | !editEmailRequests.every((editReq,ind) => {
        const travEmail = travEmailMap[editReq.ref];
        if(travEmail){
          editReq.travEmail = travEmail;
          return true;
        }
  
        errors.errors[`editEmail${ind}`] = 'email to be edited could not be found or be matched to the traveler';
        return false;
      })){
      return res.status(404).send(errors);
    }


    if(
      !unlinkedAddressIds.every((addressId, ind) => {
        if(!travAddressMap[addressId]){
          errors.errors[`deleteAddress${ind}`] = 'address to be deleted could not be found or be matched to the traveler';
          return false;        
        }
        return true;
      }) | !unlinkedPhoneIds.every((phoneId, ind) => {
        if(!travPhoneMap[phoneId]){
          errors.errors[`deletePhone${ind}`] = 'phone to be deleted could not be found or be matched to the traveler';
          return false;        
        }
        return true;
      }) | !unlinkedEmailIds.every((emailId, ind) => {
        if(!travEmailMap[emailId]){
          errors.errors[`deleteEmail${ind}`] = 'email to be deleted could not be found or be matched to the traveler';
          return false;        
        }
        return true;
      })) {
      return res.status(404).send(errors);
    }

    delete errors.errors;
    

    // MASTER UPDATE
    await Promise.all([
      ...newAddressRequests.map(addressReq => {
        addressReq.address = models.Address.buildFromFields(addressReq);

        return addressReq.address
          .save()
          .then(() => {
            if(addressReq.createInfos && addressReq.infos){
              addressReq.addressInfo = models.AddressInfo.buildFromFields(addressReq.infos,addressReq.address.id);
              addressReq.address.address_info_id = addressReq.addressInfo.id;
              return addressReq.addressInfo.save();
            }
            return Promise.resolve(null);
          }).then(() => {
            return Promise.all([
              addressReq.address.addTraveler(traveler,addressReq.references.alias, addressReq.references.type),
              addressReq.address
                .findCountryStateCity(addressReq.details)
                .then(() => addressReq.address.save())
            ]);
          });
      }),

      ...newPhoneRequests.map(phoneReq => {
        phoneReq.phone = models.Phone.buildFromFields(phoneReq);
        return phoneReq.phone
          .saveInstance(phoneReq.countryCode)
          .then(() => {
            return phoneReq.alias 
              ? phoneReq.phone.addTraveler(traveler,phoneReq.alias) 
              : phoneReq.phone.addTraveler(traveler);
          });
      }),

      ...newEmailRequests.map(emailReq => {
        emailReq.emailInstance = models.Email.buildFromFields(emailReq);
        return emailReq.emailInstance
          .save()
          .then(() => emailReq.emailInstance.addTraveler(traveler));
      }),

      editAddressRequests.length
        ? models.Address.findAll({
          where: {id: {[Op.in]: editAddressRequests.map(addressReq => addressReq.travAddress.address_id)}},
          include: {
            model: models.AddressInfo,
            attributes: resAttr.ADDRESS_INFO_ATTRIBUTES.concat(['id'])
          }
        }).then(addresses => {
          addresses.forEach(address => {
            const editReq = editAddressRequests.find(addressReq => addressReq.travAddress.address_id === address.id);
            editReq.address = address;
          });

          if(!editAddressRequests.every((editReq,ind) => {
            if(!editReq.address){
              errors[`editAddress${ind}`]= 'edit address could not be found';
              return false;
            }
            return true;
          })){
            return Promise.reject(errors);
          }

          return Promise.all([
            ...editAddressRequests.map(addressReq => addressReq.address.updateAndSaveFromFields(addressReq)),
            ...editAddressRequests.map(addressReq => addressReq.travAddress.updateAndSaveFromFields(addressReq))
          ]);
        }) 
        : Promise.resolve(),

      editPhoneRequests.length
        ? models.Phone.findAll({
          where: {id: {[Op.in]: editPhoneRequests.map(phoneReq => phoneReq.travPhone.phone_id)}}
        }).then(phones => {
          phones.forEach(phone => {
            const editReq = editPhoneRequests.find(phoneReq => phoneReq.travPhone.phone_id === phone.id);
            phone.updateFromFields(editReq);
            editReq.phone = phone;
          });

          if(!editPhoneRequests.every((editReq,ind) => {
            if(!editReq.phone){
              errors[`editPhone${ind}`]= 'edit phone could not be found';
              return false;
            }
            return true;
          })){
            return Promise.reject(errors);
          }

          return Promise.all([
            ...editPhoneRequests.map(phoneReq => {
              return phoneReq.countryCode
                ? phoneReq.phone.saveInstance(phoneReq.countryCode)
                : phoneReq.phone.save();
            }),
            ...editPhoneRequests.map(phoneReq => phoneReq.travPhone.updateAndSaveFromFields(phoneReq))
          ]);
        })
        : Promise.resolve(),

        
      editEmailRequests.length
        ? models.Email.findAll({
          where: {id: {[Op.in]: editEmailRequests.map(emailReq => emailReq.travEmail.email_id)}}
        }).then(emails => {
          emails.forEach(email => {
            const editReq = editEmailRequests.find(emailReq => emailReq.travEmail.email_id === email.id);
            email.updateFromFields(editReq);
            editReq.email = email;
          });

          return Promise.all(emails.map(email => email.save()));
        })
        : Promise.resolve(),
      
      ...unlinkedAddressIds.map(travAddressId => {
        const travAddress = travAddressMap[travAddressId];
        return travAddress
          .destroy()
          .then(() => {
            return models.Address
              .shouldRemove(travAddress.address_id)
              .then(resp => resp ? models.Address.destroy({where: {id: travAddress.address_id}}) : Promise.resolve());
          });
      }),

      ...unlinkedPhoneIds.map(travPhoneId => {
        const travPhone = travPhoneMap[travPhoneId];
        return travPhone
          .destroy()
          .then(() => {
            return models.Phone
              .countUsersTravelers(travPhone.phone_id)
              .then(count => {
                return count <= 0 ? models.Phone.destroy({where: {id: travPhone.phone_id}}) : Promise.resolve();
              });
          });
      }),

      ...unlinkedEmailIds.map(travEmailId => {
        const travEmail = travEmailMap[travEmailId];
        return travEmail
          .destroy()
          .then(() => {
            return models.Email
              .countUsersTravelers(travEmail.email_id)
              .then(count => {
                return count <= 0 ? models.Email.destroy({where: {id: travEmail.email_id}}) : Promise.resolve();
              });
          });
      }),

      traveler.updateFromRequest(req.body)
        ? traveler.save()
        : Promise.resolve(traveler),

      userTraveler.updateFromRequest(user,traveler,req.body.userTraveler)
        ? userTraveler.save()
        : Promise.resolve(userTraveler)
    ]);
    // PUT/profile route: End of STEP #2 ------------------------------------------------------------------

  
    // PUT/profile route: STEP #3 -------------------------------------------------------------------------
    // Fetch resulting traveler profile
    const profile = await models.Traveler.findById(userTraveler.traveler_id, models.queries.FETCH_TRAVELER_PROFILE)
      .then(trav => trav ? createFullProfileResponse(userTraveler,trav) : null);
  
    //  ---------------------------------------------------------------------------------------------------
    return profile
      ? res.status(200).send(profile)
      : res.status(500).send({errors: {traveler: 'traveler profile was updated but could not be retrieved afterwards'}});
  
  } catch(error){
    next(error);
  }
});
  


module.exports = router;