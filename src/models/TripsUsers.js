module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetTripUserModel} */
  const tripUserModel = sequelize.define('TripsUsers', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    alias: {type: SeqTypes.STRING(20)}
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  tripUserModel.associate = function(models){
    tripUserModel.belongsTo(models.Trip,{foreignKey: 'trip_id'});
    tripUserModel.belongsTo(models.User,{foreignKey: 'user_id'});

    // MODEL METHODS REQUIRING MODELS
    tripUserModel.updateFromRequest = function(tripRequest, travUsersMap, loggedUserId = null){
      const trip = tripRequest.trip;
      const curTripUsers = trip.UserLinks;
      const requestAlias = tripRequest.tripUser.alias;
  
      /** @type {{[userId: string]: boolean}} */
      const allUsers = {};
  
      const allTravelerIds = models.inputs.trip.get.finalTravelerIds(tripRequest);
  
      allTravelerIds.forEach(travId => {
        const travUsers = travUsersMap[travId];
        travUsers.forEach(travUser => allUsers[travUser.user_id] = true);
      });
      
      const out = {};
  
      out.delTripUsers = curTripUsers.filter(tripUser => !allUsers[tripUser.user_id]);
      out.newTripUsers = Object.keys(allUsers)
        .filter(userId => !curTripUsers.find(tripUser => tripUser.user_id === userId))
        .map(userId => {
          return tripUserModel.build({
            trip_id: trip.id,
            user_id: userId
          });
        });

      out.updTripUser = loggedUserId ? curTripUsers.find(tripUser => tripUser.user_id === loggedUserId) : null;
      if(out.updTripUser && typeof requestAlias === 'string')
        out.updTripUser.alias = requestAlias;
        
      return out;
    }; // <-- END OF METHODS REQUIRING MODELS
  };

  tripUserModel.buildFromRequest = function(tripRequest, travUsersMap){
    const trip = tripRequest.trip;
    const requestedAlias = tripRequest.tripUser.alias;
    const firstVia = tripRequest.vias[0];

    /** @type {{[travId: string]: boolean}} */ const travIds = {};
    tripRequest.vias.forEach(viaReq => {
      viaReq.travelers.forEach(pax => travIds[pax.userTraveler.traveler_id] = true);
    });

    /** @type {{[userId: string]: boolean}} */
    const userIds = {};

    Object.keys(travIds).forEach(travId => {
      const travUsers = travUsersMap[travId];
      travUsers.forEach(travUser => userIds[travUser.user_id] = true);
    });

    return Object.keys(userIds).map(userId => {
      const alias = trip.creator_id === userId && requestedAlias
        ? requestedAlias
        : `${firstVia.dep.airport.id}-${firstVia.arr.airport.id}`;

      return tripUserModel.build({
        trip_id: trip.id,
        user_id: userId,
        alias
      });
    });
  };

  // INSTANCE METHODS
  tripUserModel.prototype.setAlias = function(alias) {
    /** @type {JetTripUserInstance} */
    const tripUser = this;
        
    if(!alias){
      tripUser.alias = null;
      return true;

    } else if(typeof alias === 'string' && alias.length <= 20){
      tripUser.alias = alias;
      return true;
    }
    return false;
  };

  tripUserModel.prototype.createResponse = function(){
    /** @type {JetTripUserInstance} */
    const tripUser = this;
    return {
      ref: tripUser.id,
      alias: tripUser.alias
    };
  }





  return tripUserModel;
};