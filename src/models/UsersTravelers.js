
const resAttr = require('../utils/commonResAttr');

const RELATIONS = require('../utils/commonFields').USER_TRAVELER_RELATIONS;
const STATUSES = require('../utils/commonFields').USER_TRAVELER_STATUSES;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  // DEFINITION
  /** @type {JetUserTravelerModel} */
  const userTravelerModel = sequelize.define('UsersTravelers', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4},
    },
    primary_user: {
      type: SeqTypes.BOOLEAN,
      defaultValue: false
    },
    nickname: {type: SeqTypes.STRING(20)},
    status: {
      type: SeqTypes.ENUM,
      values: RELATIONS.values,
      defaultValue: RELATIONS.dft
    },
    relation: {
      type: SeqTypes.ENUM,
      values: STATUSES.values,
      defaultValue: STATUSES.dft
    },
    ordinal: {
      type: SeqTypes.INTEGER
    }
  }, {
    underscored: true
  });

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  userTravelerModel.associate = function(models) {
    this.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    this.belongsTo(models.User, {foreignKey: 'user_id'});
  };


  // INSTANCE METHODS
  userTravelerModel.prototype.createResponse = function(){
    /** @type {JetUserTravelerInstance} */
    const userTrav = this;

    /** @type {JetUserTravelerResponse} */
    const resp = {
      ref: userTrav.id,
      primary: userTrav.primary_user,
      nickname: userTrav.nickname,
      relation: userTrav.relation,
      status: userTrav.status
    };

    return resp;
  };

  userTravelerModel.prototype.createSelectionResponse = function(){
    /** @type {JetUserTravelerInstance} */
    const userTraveler = this;
    const traveler = userTraveler.Traveler;

    return {
      userTraveler: userTraveler.createResponse(),
      profile: {
        ageBracket: traveler ? traveler.age_bracket : null,
        gender: traveler ? traveler.gender : null,
        pic: traveler ? traveler.pic : null
      }
    };
  };

  /** @param {JetUserInstance} user
   * @param {JetTravelerInstance} traveler
   * @param {JetUserTravelerRequest} userTravReq */
  userTravelerModel.prototype.updateFromRequest = function(user, traveler, userTravReq){
    /** @type {JetUserTravelerInstance} */
    const userTrav = this;
    const isSelf = traveler.email === user.email;
    let hasChange = true;

    if(typeof userTravReq.nickname === 'string' 
      && userTrav.nickname !== userTravReq.nickname){
      userTrav.nickname = userTravReq.nickname.substr(0,20);
      hasChange = true;
    }

    if(typeof userTravReq.relation === 'string' 
        && userTrav.relation !== userTravReq.relation
        && RELATIONS.values.includes(userTravReq.relation)){
      userTrav.relation = userTravReq.relation;
      hasChange = true;

    } else if(isSelf && !userTravReq.relation && !userTrav.relation){
      hasChange = userTrav.relation !== RELATIONS.dft;
      userTrav.relation = RELATIONS.dft;
    }
    
    return hasChange;
  };

  // MODEL METHODS
  userTravelerModel.isValidRequest = function(userTravReq, errors, travPublicName = ''){
    if(typeof userTravReq.nickname === 'string'){
      userTravReq.nickname = userTravReq.nickname.substr(0,20);
    } else {
      userTravReq.nickname = travPublicName;
    }

    if(typeof userTravReq.relation === 'string'){
      if(!RELATIONS.values.includes(userTravReq.relation)){
        errors.errors = {userTraveler: `UserTraveler relation must be among ${RELATIONS.values.join('|')}`};
        return false;
      }
    } else {
      userTravReq.relation = null;
    }

    return true;
  };

  userTravelerModel.createTravUserTravMap = async function(userId, travIds, outMap = {}){
    if(!travIds || !travIds.length){
      return Promise.reject({errors: {userTraveler: 'cannot map trav->userTrav from empty [travelerId] argument'}});
    }
    
    try{
      const userTravs = await userTravelerModel.findAll({
        attributes: resAttr.USER_TRAVELER_ATTRIBUTES,
        where: {
          [Op.and]: [
            {user_id: userId},
            {traveler_id: {[Op.in]: travIds}}
          ]
        }
      });

      userTravs.forEach(userTrav => {
        outMap[userTrav.traveler_id] = userTrav;
      });

      return outMap;

    } catch(error){
      return Promise.reject(error);
    }
  };

  userTravelerModel.createMap = function(userId, userTravIds){
    return userTravelerModel.findAll({
      attributes: resAttr.USER_TRAVELER_ATTRIBUTES,
      where: {[Op.and]: [
        {id: {[Op.in]: userTravIds}},
        {user_id: userId}
      ]}
    }).then(userTravelers => {
      const map = {};

      userTravelers.forEach(userTrav => {
        map[userTrav.id] = userTrav;
      });

      return map;
    });
  };

  userTravelerModel.createTravsUsersMap = function(travelerIds){
    return userTravelerModel.findAll({
      attributes: resAttr.USER_TRAVELER_ATTRIBUTES,
      where: {traveler_id: {[Op.in]: travelerIds}}

    }).then(userTravelers =>{
      const map = {};

      userTravelers.forEach(userTrav => {
        if(!map[userTrav.traveler_id]){
          map[userTrav.traveler_id] = [userTrav];
        } else {
          map[userTrav.traveler_id].push(userTrav);
        }
      });

      return map;
    });
  };

  userTravelerModel.createUserTravsMap = function(userId){
    if(typeof userId !== 'string' || userId.toString('hex') !== userId )
      return Promise.reject({errors: {userTraveler: 'createUserTravsMap userId arg must be an hex string'}});

    return userTravelerModel.findAll({
      where: {user_id: userId},
      attributes: resAttr.USER_TRAVELER_ATTRIBUTES
    }).then(userTravelers => {
      const map = {};
      userTravelers.forEach(userTrav => {
        map[userTrav.traveler_id] = userTrav;
      });

      return map;
    });
  };

  return userTravelerModel;
};
