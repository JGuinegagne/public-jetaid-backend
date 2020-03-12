module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /**@type {JetRiderTravelerModel} */
  const riderTravelerModel = sequelize.define('RidersTravelers', {
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
  riderTravelerModel.associate = function(models){
    this.belongsTo(models.Rider, {foreignKey: 'rider_id'});
    this.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    this.belongsTo(models.ViasTravelers, {foreignKey: 'via_traveler_id'});
  };

  riderTravelerModel.buildFromViaRequest = function(riderRequest){
    const rider = riderRequest.rider;

    return riderRequest.travelers.map(travReq => {
      return riderTravelerModel.build({
        rider_id: rider.id,
        traveler_id: travReq.viaTraveler.traveler_id
      });
    });
  };

  riderTravelerModel.buildFromFullRequest = function(riderRequest){
    const rider = riderRequest.rider;

    return riderRequest.travelers.map(travReq => {
      return riderTravelerModel.build({
        rider_id: rider.id,
        traveler_id: travReq.userTraveler.traveler_id
      });
    });
  };

  riderTravelerModel.updateFromRequest = function(riderRequest){
    const rider = riderRequest.rider;
    const curRiderTravelers = riderRequest.rider.TravelerLinks;
    const allTravelerIds = riderRequest.fromVia 
      ? riderRequest.travelers.map(travReq => (travReq.viaTraveler ? travReq.viaTraveler : travReq.userTraveler).traveler_id)
      : riderRequest.travelers.map(travReq => travReq.userTraveler.traveler_id);

    const out = {};

    out.delRiderTravs = curRiderTravelers.filter(riderTrav => !allTravelerIds.includes(riderTrav.traveler_id));
    out.newRiderTravs = allTravelerIds
      .filter(travId => !curRiderTravelers.find(riderTrav => riderTrav.traveler_id === travId))
      .map(travId => {
        return  riderTravelerModel.build({
          rider_id: rider.id,
          traveler_id: travId
        });
      });

    return out;
  };

  riderTravelerModel.populateTravelers = function(rider, travelers){
    rider.Travelers = rider.TravelerLinks.map(riderTrav => {
      const traveler = travelers.find(trav => trav.id === riderTrav.traveler_id);
      if(traveler){
        const trav = Object.assign({},traveler);
        Object.setPrototypeOf(trav,traveler);
        trav.RidersTravelers = riderTrav;
        return trav;
      } 
      return null;
    });
  };


  return riderTravelerModel;
};