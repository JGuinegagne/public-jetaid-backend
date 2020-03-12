module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetNeighborhoodDropModel} */
  const neighborhoodDropModel = sequelize.define('NeighborhoodDrop', {
    request_id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    city_stop_id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false        
    }
  }, {
    tableName: 'NeighborhoodDrops',
    name: {singular: 'NeighborhoodDrop', plural: 'NeighborhoodDrops'},
    underscored: true
  });

  /** @param {JetModels} models*/
  neighborhoodDropModel.associate = function(models){
    this.belongsTo(models.RideRiderRequest, {as: 'Request', foreignKey: 'request_id'});
    this.belongsTo(models.RidesNeighborhoods, {as: 'CityStop', foreignKey: 'city_stop_id'});
  };

  return neighborhoodDropModel;
};
