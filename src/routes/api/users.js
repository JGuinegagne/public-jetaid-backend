const express = require('express');

const auth = require('../authorization');
const passport = require('../../utils/passport');
const resAttr = require('../../utils/commonResAttr');
const isValidHex = require('../../utils/commonFunctions').isValidHex;

/** @type {JetModels} */
const models = require('../../models');
const Op = require('../../models').Sequelize.Op;

const router = express.Router();

// ----------------------------------------------------------------------------------
/**
 * @param {string} userResp*/
const createShortResponse = function(userResp){
  return {user: userResp};
};


// ----------------------------------------------------------------------------------
// POST/register: creates a new user
// Expecting request containing body.user = {name,email,password}
// Returns short response with the jwt and user public name
// Note: field email is unique
router.post('/register', async (req, res, next) => {
  if(typeof req.body.user.name !== 'string' || !req.body.user.name){
    return res.status(422).send({errors: {name: 'Name cannot be blank'}});
  }

  if(typeof req.body.user.password !== 'string' || !req.body.user.password){
    return res.status(422).send({errors: {password: 'Password cannot be blank'}});
  }

  try {
    const oUser = await models.User.findOne({
      where: {email: {[Op.iLike]: req.body.user.email}},
      attributes: ['id']
    });

    if(oUser){
      return res.status(403).send({errors: {email: 'An user with this email already exists'}});
    }

    /** @type {string}*/
    let name = req.body.user.name;
    name = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      
    const user = models.User.build({
      email: req.body.user.email,
      public_name: name
    });

    await user.setPassword(req.body.user.password);
    await user.save();
    const userResp = await user.createResponse();
    return res.status(200).send(createShortResponse(userResp));
    
  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// DELETE/user: deletes a user
// Use for tests ONLY
router.delete('/user',auth.required, async (req, res, next) => {
  if(!req.query || typeof req.query.password !== 'string' || !req.query.password){
    return res.status(422).send({errors: {
      password: 'Delete user request needs to a "password" param of type string'}
    });
  }

  /** @type {string} */
  const password = req.query.password;

  try{
    const user = await models.User.findByPk(req.payload.id);
    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(await user.validPassword(req.query.password)){
      await user.destroy();
      return res.status(203).send({success: 'User was removed'});

    } else {
      return res.status(403).send({errors: {password: 'Invalid password'}});
    }
    
  } catch(error){
    next(error);
  }

});


// ----------------------------------------------------------------------------------
// POST/login route: identifies an existing user
// Expecting request containing body.user = {email,password}
// Returns response = {welcomeJSON}
router.post('/login',(req, res, next) => {
  if(!req.body.user){
    return res.status(422).send({errors: {user: 'Login request needs to provide an user'}});
  }

  if(!req.body.user.email){
    return res.status(422).send({errors: {email: 'Email cannot be blank'}});
  }

  if(!req.body.user.password){
    return res.status(422).send({errors: {password: 'Password cannot be blank'}});
  }

  passport.authenticate('local', (err,user,info) => {
    if(err){
      next(err);
    }

    if(user){
      /** @type {JetUserInstance} */
      const _user = user;
      
      _user
        .createResponse()
        .then(userResp => res.status(200).send(createShortResponse(userResp)));

    } else {
      return info 
        ? res.status(403).send({errors: {password: 'is invalid'}}) 
        : res.status(404).send({errors: {email: 'User could not be found'}});
    }
  })(req,res,next);
});


// ----------------------------------------------------------------------------------
// PUT/password route: updates the password
// Critical change: requires current password verification
// Expecting request containing body.user = {oldPassword,newPassword}
// Returns response = {welcomeJSON}
router.put('/password', auth.required, async (req, res, next) => {
  if(!req.body.user){
    return res.status(422).send({errors: {user: 'Change Password request needs to provide an user'}});
  }

  if(typeof req.body.user.oldPassword !== 'string'){
    return res.status(422).send({errors: {oldPassword: 'Old password cannot be blank'}});
  }

  if(typeof req.body.user.newPassword !== 'string'){
    return res.status(422).send({errors: {newPassword: 'New password cannot be blank'}});
  }

  try{
    const user = await models.User.findById(req.payload.id);
    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(await user.validPassword(req.body.user.oldPassword)){
      await user.setPassword(req.body.user.newPassword);
      await user.save({fields: ['hash','salt','iteration']});
      const resp = await user.createResponse();
      return res.status(200).send(createShortResponse(resp));

    } else {
      return res.status(403).send({errors: {password: 'Invalid password'}});
    }
    
  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// PUT/email route: updates the email, the main identifier of the account
// Critical change: requires current password verification
// Expecting request containing body.user = {password,newEmail}
// Returns response = {welcomeJSON}
router.put('/email', auth.required, async (req, res, next) => {
  if(!req.body.user){
    return res.status(422).send({errors: {user: 'Change Email request needs to provide an user'}});
  }

  if(typeof req.body.user.password !== 'string'){
    return res.status(422).send({errors: {password: 'Old email cannot be blank'}});
  }

  if(typeof req.body.user.newEmail !== 'string'){
    return res.status(422).send({errors: {newEmail: 'New email cannot be blank'}});
  }

  /**@type {string} */
  const newEmail = req.body.user.newEmail;

  try{
    const user = await models.User.findByPk(req.payload.id);
    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(await user.validPassword(req.body.user.password)){
      if(await models.User.findOne({where: {email: req.body.user.newEmail}})){
        return res.status(403).send({errors: {email: 'Email already exists'}});
      }

      user.email = newEmail.toLowerCase();
      await user.save({fields: ['email']});
      const resp = await user.createResponse();
      return res.status(200).send(createShortResponse(resp));

    } else {
      return res.status(403).send({errors: {password: 'Invalid password'}});
    }
    
  } catch(error){
    next(error);
  }
});

// ----------------------------------------------------------------------------------
// GET/user route: checks that the existing token is still valid
// No body required, just relies on token in "authorization" header
// Returns short response with jwt and user public name
router.get('/user', auth.required, async (req, res, next) => {
  
  const user = await models.User.findById(req.payload.id, {attributes: resAttr.USER_MAP_ATTRIBUTES});

  try {
    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    const userResp = await user.createResponse();
    return res.status(200).send(createShortResponse(userResp));

  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// GET/profile route: retrieves user info and associated travelers
// No body required, authentication required
// Returns response = {profileJSON}
router.get('/profile', auth.required, async (req, res, next) => {
  try {
    const user = await models.User.findById(req.payload.id, models.queries.FETCH_USER_PROFILE);

    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    return res.status(200).send(user.createProfileResponse());

  } catch (error) {
    next(error);
  }
});

// ----------------------------------------------------------------------------------
// GET/ping route: does nothing - used in test only to setup postman tests
router.get('/ping', (req, res, next) => {
  try{
    return res.status(200).send('roger');
  } catch(error){
    next(error);
  }
});


// ----------------------------------------------------------------------------------
// PUT/alias route: change user alias
// Requires authentication from "authorization" header
// Returns response = {profileJSON}
router.put('/name',auth.required, async (req, res, next) => {
  if(!req.body)
    return res.status(422).send({errors: {user: 'User update requests must have a body'}});

  if(!req.body.name || typeof req.body.name !== 'string')
    return res.status(422).send({
      errors: {alias: 'User alias update request body must have an "name" field of type string'}
    });
    

  try{
    const user = await models.User.findByPk(
      req.payload.id, 
      {attributes: resAttr.PROFILE_USER_ATTRIBUTES}
    );

    if(user.updateFromRequest({profile: req.body}))
      await user.save({fields: ['public_name']});
    
    const userResp = await user.createResponse();
    return res.status(200).send(userResp);

  } catch(error){
    next(error);
  }
  
});


// ----------------------------------------------------------------------------------
// PUT/profile route: change user profile infos, or its addresses, phones or emails
// Requires authentication from "authorization" header
// Returns response = {profileJSON}
router.put('/profile', auth.required, async (req, res, next) => {
  // PUT/profile STEP #0: Validate new address/phone/email requests
  const errors = {errors: {}};

  if(!req.body){
    return res.status(422).send({errors: {user: 'User update requests must have a body'}});

  } else if(!models.User.isValidRequest(req.body,errors)){
    return res.status(422).send(errors);
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
    // Fetch requested usersAddresses and map it as userAddressId -> userAddress instance
    // Does the same for requested usersPhones and usersEmails
    const userId = req.payload.id;

    /* eslint-disable no-unused-vars */
    const [user,_unused,userAddressMap,userPhoneMap,userEmailMap]
    /* eslint-enable no-unused-vars */
      
      = await Promise.all([
        models.User.findById(userId, {attributes: resAttr.PROFILE_USER_ATTRIBUTES}),
        models.Address.fetchGeocodeInfos([
          ...newAddressRequests,
          ...editAddressRequests
        ]),
        models.UsersAddresses.createMap(
          userId,
          [
            ...editAddressRequests.map(editReq => editReq.references.ref),
            ...unlinkedAddressIds
          ]
        ),
        models.UsersPhones.createMap(
          userId,
          [
            ...editPhoneRequests.map(editReq => editReq.ref),
            ...unlinkedPhoneIds
          ]
        ),
        models.UsersEmails.createMap(
          userId,
          [
            ...editEmailRequests.map(editReq => editReq.ref),
            ...unlinkedEmailIds
          ]
        )
      ]);
    // PUT/profile route: End of STEP #1 ------------------------------------------------------------------


    // PUT/profile route: STEP #2 -------------------------------------------------------------------------
    // Checks that the user was found
    // Checks that all referenced userAddress, userPhone and userEmail were found
    // Then proceed to master update
    // -- create new address (and addressInfo), phone and email instance, and associate with user
    // -- update and save address (and addressInfo), phone and email instances
    // -- unlink address, phone and emails, and delete them if no longer associated with any user/traveler
    // -- update and save user instance
    if(!user){
      return res.status(404).send({errors: {user: 'User could not be found'}});
    }

    if(
      ! editAddressRequests.every((editReq,ind) => {
        const userAddress = userAddressMap[editReq.references.ref];
        if(userAddress){
          editReq.userAddress = userAddress;
          return true;
        }

        errors.errors[`editAddress${ind}`] = 'address to be edited could not be found or be matched to the user';
        return false;
      
      }) | !editPhoneRequests.every((editReq,ind) => {
        const userPhone = userPhoneMap[editReq.ref];
        if(userPhone){
          editReq.userPhone = userPhone;
          return true;
        }
  
        errors.errors[`editPhone${ind}`] = 'phone to be edited could not be found or be matched to the user';
        return false;
      
      }) | !editEmailRequests.every((editReq,ind) => {
        const userEmail = userEmailMap[editReq.ref];
        if(userEmail){
          editReq.userEmail = userEmail;
          return true;
        }
  
        errors.errors[`editEmail${ind}`] = 'email to be edited could not be found or be matched to the user';
        return false;
      })){
      return res.status(404).send(errors);
    }


    if(
      !unlinkedAddressIds.every((addressId, ind) => {
        if(!userAddressMap[addressId]){
          errors.errors[`deleteAddress${ind}`] = 'address to be deleted could not be found or be matched to the user';
          return false;        
        }
        return true;
      }) | !unlinkedPhoneIds.every((phoneId, ind) => {
        if(!userPhoneMap[phoneId]){
          errors.errors[`deletePhone${ind}`] = 'phone to be deleted could not be found or be matched to the user';
          return false;        
        }
        return true;
      }) | !unlinkedEmailIds.every((emailId, ind) => {
        if(!userEmailMap[emailId]){
          errors.errors[`deleteEmail${ind}`] = 'email to be deleted could not be found or be matched to the user';
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
              return addressReq.addressInfo.save()
            }
            return Promise.resolve(null);
          }).then(() => {
            return Promise.all([
              addressReq.address.addUser(user,addressReq.references.alias, addressReq.references.type),
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
              ? phoneReq.phone.addUser(user,phoneReq.alias) 
              : phoneReq.phone.addUser(user);
          });
      }),

      ...newEmailRequests.map(emailReq => {
        emailReq.emailInstance = models.Email.buildFromFields(emailReq);
        return emailReq.emailInstance
          .save()
          .then(() => emailReq.emailInstance.addUser(user));
      }),

      editAddressRequests.length
        ? models.Address.findAll({
          where: {id: {[Op.in]: editAddressRequests.map(addressReq => addressReq.userAddress.address_id)}},
          include: {
            model: models.AddressInfo,
            attributes: resAttr.ADDRESS_INFO_ATTRIBUTES.concat(['id'])
          }
        }).then(addresses => {
          addresses.forEach(address => {
            const editReq = editAddressRequests.find(addressReq => addressReq.userAddress.address_id === address.id);
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
            ...editAddressRequests.map(addressReq => addressReq.userAddress.updateAndSaveFromFields(addressReq))
          ]);
        }) 
        : Promise.resolve(),

      editPhoneRequests.length
        ? models.Phone.findAll({
          where: {id: {[Op.in]: editPhoneRequests.map(phoneReq => phoneReq.userPhone.phone_id)}}
        }).then(phones => {
          phones.forEach(phone => {
            const editReq = editPhoneRequests.find(phoneReq => phoneReq.userPhone.phone_id === phone.id);
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
            ...editPhoneRequests.map(phoneReq => phoneReq.userPhone.updateAndSaveFromFields(phoneReq))
          ]);
        })
        : Promise.resolve(),

        
      editEmailRequests.length
        ? models.Email.findAll({
          where: {id: {[Op.in]: editEmailRequests.map(emailReq => emailReq.userEmail.email_id)}}
        }).then(emails => {
          emails.forEach(email => {
            const editReq = editEmailRequests.find(emailReq => emailReq.userEmail.email_id === email.id);
            email.updateFromFields(editReq);
            editReq.email = email;
          });

          return Promise.all(emails.map(email => email.save()));
        })
        : Promise.resolve(),
      
      ...unlinkedAddressIds.map(userAddressId => {
        const userAddress = userAddressMap[userAddressId];
        return userAddress
          .destroy()
          .then(() => {
            return models.Address
              .shouldRemove(userAddress.address_id)
              .then(resp => resp ? models.Address.destroy({where: {id: userAddress.address_id}}) : Promise.resolve());
          });
      }),

      ...unlinkedPhoneIds.map(userPhoneId => {
        const userPhone = userPhoneMap[userPhoneId];
        return userPhone
          .destroy()
          .then(() => {
            return models.Phone
              .countUsersTravelers(userPhone.phone_id)
              .then(count => {
                return count <= 0 ? models.Phone.destroy({where: {id: userPhone.phone_id}}) : Promise.resolve();
              });
          });
      }),

      ...unlinkedEmailIds.map(userEmailId => {
        const userEmail = userEmailMap[userEmailId];
        return userEmail
          .destroy()
          .then(() => {
            return models.Email
              .countUsersTravelers(userEmail.email_id)
              .then(count => {
                return count <= 0 ? models.Email.destroy({where: {id: userEmail.email_id}}) : Promise.resolve();
              });
          });
      }),

      user.updateFromRequest(req.body)
        ? user.save({fields: resAttr.PROFILE_USER_ATTRIBUTES})
        : Promise.resolve(user),
    ]);
    // PUT/profile route: End of STEP #2 ------------------------------------------------------------------

  
    // PUT/profile route: STEP #3 -------------------------------------------------------------------------
    // Fetch resulting traveler profile
    const profile = await models.User.findById(userId, models.queries.FETCH_USER_PROFILE)
      .then(user => user ? user.createProfileResponse() : null);
  
    //  ---------------------------------------------------------------------------------------------------
    return profile
      ? res.status(200).send(profile)
      : res.status(500).send({errors: {user: 'user profile was updated but could not be retrieved afterwards'}});
  
  } catch(error){
    next(error);
  }



});


module.exports = router;
