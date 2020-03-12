/** @type {JetModels} */
const models = require('../models');

// MESSAGE ANALYSIS MIDDLEWARE -------------------------------------
// Analyzes message requests
// -----------------------------------------------------------------

/** @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @return {void} */
const checkOptionalMessageRequest = function(req, res, next){
  // delete request have no body: convert params to body
  if(req.query 
    && typeof req.query.msgContent ==='string' 
    && req.query.msgContent.length > 0){
      if(!req.body) req.body = {};
      req.body.message = {
        content: req.query.msgContent,
      }

      if(req.query.dateTime)
        req.body.message.msgContent = req.query.msgContent;
    }

  if(req.body && req.body.message){
    const errors = {};
    if(!models.Message.isValidRequest(req.body.message, errors))
      return res.status(422).send(errors);
  } else {
    if(!req.body){
      req.body = {};
    }
    req.body.message = null;
  }
  next();
};

/** @param {Request} req
 * @param {Response} res
 * @param {NextFunction} next
 * @return {void}*/
const checkMessageRequest = function(req,res,next){
  if(!req.body || !req.body.message){
    return res.status(422).send({errors: {message: 'req.body.message not found'}});
  }

  const errors = {};
  if(!models.Message.isValidRequest(req.body.message, errors)){
    return res.status(422).send(errors);
  }

  next();
};

const msgs = {
  /** Checks the validity of a new message request conveyed in req.body.message
   * 
   * + if valid, the message will be kept in req.body.message
   * + otherwise, returns an error and stops execution */
  required: checkMessageRequest,

  /** Checks the validity of a new message request conveyed in req.body.message
   * 
   * + if present and valid, the message will be kept in req.body.message
   * + if present and invalid, returns an error and stops execution
   * + otherwise, req.body.message will be set to null*/
  optional: checkOptionalMessageRequest
};

module.exports = msgs;