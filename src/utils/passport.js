const passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

/** @type {JetModels} */
const models = require('../models');
const User = models.User;

const Op = require('../models').Sequelize.Op;

// IDENTIFICATION METHODS ------------------------------------------
// This module handles various ways to sign in
// 'local' relies on the user entering email / passport
// -----------------------------------------------------------------
passport.use('local', new LocalStrategy({
  usernameField: 'user[email]',
  passwordField: 'user[password]',
  session: false
},
async (email, password, done) => {
  try{
    const user = await User.findOne({where: {email: {[Op.iLike]: email}}});
    if(!user){
      return done(null, false, null);
    }
    if(await user.validPassword(password)){
      return done(null,user);
    } else {
      return done(null,false,{password: 'is invalid'});
    }
  } catch (error){
    return done(error,false);
  }
}));

module.exports = passport;
