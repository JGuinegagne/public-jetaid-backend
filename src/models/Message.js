const moment = require('moment');

const CONTENT_LENGTH = 140;

module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;
  
  /** @type {JetMessageModel} */
  const messageModel = sequelize.define('Message',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}       
    },
    content: {
      type: SeqTypes.TEXT,
      allowNull: false
    },
    posted_at: {
      type: SeqTypes.DATE,
      defaultValue: new Date(),
      allowNull: false
    }
  },{
    underscored: true
  });

  /** @param {JetModels} models */
  messageModel.associate = function(models){
    messageModel.belongsTo(models.User, {as: 'Author', foreign_key: 'author_id'});
    messageModel.belongsTo(models.Convo, {foreign_key: 'convo_id'});

    messageModel.belongsToMany(models.User, {through: models.MessagesUsers});
    models.User.belongsToMany(messageModel, {through: models.MessagesUsers});
  };

  // MODEL METHODS
  messageModel.isValidRequest = function(msgReq, errors = {}){
    if(typeof msgReq.content !== 'string'){
      errors.message = 'Req.body.message must have a "content" property of type string';
      return false;
      
    } else if (msgReq.content.length > CONTENT_LENGTH){
      errors.message = 'Req.body.message.content must not be longer than 140 characters';
      return false;
    }

    return true;
  };

  messageModel.buildFromRequest = function(convo, msgReq, authorId, errors){
    try{
      
      if(typeof msgReq.dateTime === 'number' && msgReq.dateTime < 1e12){
        msgReq.dateTime *= 1000; // convert to milliseconds
      }

      const postingTime = msgReq.dateTime && moment(msgReq.dateTime).isValid()
        ? moment(msgReq.dateTime).toDate()
        : new Date();

      return messageModel.build({
        content: msgReq.content,
        posted_at: postingTime,
        convo_id: convo.id,
        author_id: authorId
      });

    } catch(error){
      errors.message = error.toString();
      return null;
    }    
  };

  messageModel.createInConvo = function(convo, msgReq, authorId, errors){
    const msg = messageModel.buildFromRequest(convo, msgReq, authorId, errors);
    if(!msg){
      return Promise.reject(errors);
    }

    return msg.save();
  };

  /** @param {JetMessageInstance} oMsg */
  messageModel.prototype.postedTimeCompare = function(oMsg){
    /** @type {JetMessageInstance} */
    const msg = this;
  
    if(!msg.posted_at || !oMsg.posted_at){
      return 0;
    }
  
    const postedTime = moment(msg.posted_at);
    const oPostedTime = moment(oMsg.posted_at);
  
    if(postedTime.isValid() && oPostedTime.isValid())
      return postedTime.diff(oPostedTime,'ms');
    else 
      return postedTime ? -1 : (oPostedTime ? 1 : 0);
  };


  return messageModel;  
};