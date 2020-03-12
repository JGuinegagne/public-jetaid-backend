const jwt =require('express-jwt');

const {secret} = require('../../config');

// JWT PARSER MIDDLEWARES ------------------------------------------
// This module pulls the jwt from the request header 'authorization'
// decrypt it using the appropriate secret and adds the result
// to the 'payload' property of the request
// -----------------------------------------------------------------
const extractToken = (req) => {
  if(req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Token'){
    return req.headers.authorization.split(' ')[1];
  }

  return null;
};

const required = jwt({
  secret,
  userProperty: 'payload',
  credentialsRequired: true,
  getToken: extractToken
});

const optional = jwt({
  secret,
  userProperty: 'payload',
  credentialsRequired: false,
  getToken: extractToken
});

/** Container grouping the middlewares to decrypt header.authorization json webtoken */
const auth = {
  /**
	 * Jwt middleware reading property from a req.header.authorization. It will
	 * block further execution of other handlers if the jwt is absent or fails
	 * to authenticate.
	 * 
	 * If the token is identified, decrypt and extract the .id component to
	 * add it to the req.payload which becomes accessible to other handlers
	 * 
	 */
  required,
  /**
	 * Jwt middleware reading property from a req.header.authorization.
	 * 
	 * If the token is identified, decrypt and extract the .id component to
	 * add it to the req.payload which becomes accessible to other handlers
	 */
  optional
};

module.exports = auth;