module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;
  
  /** @type {JetRideNeighborhoodModel} */
  const cityStopModel = sequelize.define('RidesNeighborhoods', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    ordinal: {
      type: SeqTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  },{
    underscored: true
  });
  
    /** @param {JetModels} models*/
  cityStopModel.associate = function(models){
    this.belongsTo(models.Ride, {foreignKey: 'ride_id'});
    this.belongsTo(models.Neighborhood, {foreignKey: 'neighborhood_id'});
    this.belongsTo(models.RidesRiders, {foreignKey: 'ride_rider_id'});
  };
  
  return cityStopModel;
};