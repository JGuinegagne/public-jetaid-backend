const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetRiderUserModel} */
  const riderUserModel = sequelize.define('RidersUsers', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4} 
    }        
  },{
    underscored: true    
  });

  /** @param {JetModels} models */  
  riderUserModel.associate = function(models){
    riderUserModel.belongsTo(models.Rider, {foreignKey: 'rider_id'});
    riderUserModel.belongsTo(models.User, {foreignKey: 'user_id'});
  };

  // MODEL METHODS
  riderUserModel.buildFromViaRequest = function(riderRequest,travUsersMap){
    const rider = riderRequest.rider;
    const userIds = {};

    riderRequest.travelers.forEach(travReq => {
      const travUsers = travUsersMap[travReq.viaTraveler.traveler_id];
      travUsers.forEach(travUser => {
        if(!userIds[travUser.user_id]){
          userIds[travUser.user_id] = true;
        }
      });
    });

    return Object.keys(userIds).map(userId => {
      return riderUserModel.build({
        rider_id: rider.id,
        user_id: userId
      });
    });
  };

  riderUserModel.buildFromFullRequest = function(riderRequest, travUsersMap){
    const rider = riderRequest.rider;
    const userIds = {};

    riderRequest.travelers.forEach(travReq => {
      const travUsers = travUsersMap[travReq.userTraveler.traveler_id];
      travUsers.forEach(travUser => {
        if(!userIds[travUser.user_id]){
          userIds[travUser.user_id] = true;
        }
      });
    });

    return Object.keys(userIds).map(userId => {
      return riderUserModel.build({
        rider_id: rider.id,
        user_id: userId
      });
    });
  };

  riderUserModel.updateFromRequest = function(riderRequest, travUsersMap){
    const rider = riderRequest.rider;
    const curRiderUsers = rider.UserLinks;
    const allUsers = {};

    const allTravelerIds = riderRequest.fromVia
      ? riderRequest.travelers.map(travReq => (travReq.viaTraveler ? travReq.viaTraveler : travReq.userTraveler).traveler_id)
      : riderRequest.travelers.map(travReq => travReq.userTraveler.traveler_id);

    allTravelerIds.forEach(travId => {
      const travUsers = travUsersMap[travId];
      travUsers.forEach(travUser => {
        if(!allUsers[travUser.user_id]){
          allUsers[travUser.user_id] = true;
        }
      });
    });
    
    const out = {};

    out.delRiderUsers = curRiderUsers.filter(riderUser => !allUsers[riderUser.user_id]);
    out.newRiderUsers = Object.keys(allUsers)
      .filter(userId => !curRiderUsers.find(riderUser => riderUser.user_id === userId))
      .map(userId => {
        return riderUserModel.build({
          rider_id: rider.id,
          user_id: userId
        });
      });

    return out;
  };


  riderUserModel.createRiderUserRiderMap = function(riderIds){
    if(!Array.isArray(riderIds) || !riderIds.length){
      return Promise.reject({errors: {riderUser: 'requested riderIds are empty or not an array'}});
    }

    return riderUserModel.findAll({
      where: {rider_id: {[Op.in]: riderIds}},
      attributes: resAttr.RIDER_USER_ATTRIBUTES
    }).then(ridersUsers => {
      const map = {};
      
      ridersUsers.forEach(riderUser => {
        if(map[riderUser.rider_id])
          map[riderUser.rider_id].push(riderUser);
        
        else
          map[riderUser.rider_id] = [riderUser];    
      });

      return map;
    });
  };

  return riderUserModel;
};