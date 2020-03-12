module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;
    
  /** @type {JetRideTerminalModel} */
  const terminalStopModel = sequelize.define('RidesTerminals', {
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
  terminalStopModel.associate = function(models){
    this.belongsTo(models.Ride, {foreignKey: 'ride_id'});
    this.belongsTo(models.Terminal, {foreignKey: 'terminal_id'});
    this.belongsTo(models.RidesRiders, {foreignKey: 'ride_rider_id'});
  };
    
  return terminalStopModel;
};