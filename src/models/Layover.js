
module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetLayoverModel} */
  const layoverModel = sequelize.define('Layover',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    dep_time: {type: SeqTypes.TIME},
    arr_time: {type: SeqTypes.TIME},
    day_diff: {type: SeqTypes.INTEGER, defaultValue: 0, allowNull: false},
    ordinal: {type: SeqTypes.INTEGER, defaultValue: 0, allowNull: false}
  }, {
    underscored: true
  });

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  layoverModel.associate = function(models){
    const flightModel = models.Flight;
    const airportModel = models.Airport;
    const terminalModel = models.Terminal;

    flightModel.hasMany(this,{as: 'Layovers'});
    this.belongsTo(airportModel,{foreignKey: 'airport_id'});
    this.belongsTo(terminalModel,{as: 'ArrTerminal', foreignKey: 'arr_terminal_id'});
    this.belongsTo(terminalModel,{as: 'DepTerminal', foreignKey: 'dep_terminal_id'});
  };


  return layoverModel;  
};