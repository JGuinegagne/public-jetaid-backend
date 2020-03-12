module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;
  
  /** @type {JetTerminalDropModel} */
  const terminalDropModel = sequelize.define('TerminalDrop', {
    request_id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    terminal_stop_id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false        
    }
  }, {
    tableName: 'TerminalDrops',
    name: {singular: 'TerminalDrop', plural: 'TerminalDrops'},
    underscored: true
  });
  
    /** @param {JetModels} models*/
  terminalDropModel.associate = function(models){
    this.belongsTo(models.RideRiderRequest, {as: 'Request', foreignKey: 'request_id'});
    this.belongsTo(models.RidesTerminals, {as: 'TerminalStop', foreignKey: 'terminal_stop_id'});
  };
  
  return terminalDropModel;
};