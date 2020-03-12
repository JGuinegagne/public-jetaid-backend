
module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetFlightModel} */
  const flightModel = sequelize.define('Flight', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    code: {type: SeqTypes.STRING(6), allowNull: false},
    version: {type: SeqTypes.INTEGER, allowNull: false, defaultValue: 0},
    dep_time: {type: SeqTypes.TIME},
    arr_time: {type: SeqTypes.TIME},
    day_diff: {type: SeqTypes.INTEGER, defaultValue: 0, allowNull: false},
    has_layover: {type: SeqTypes.BOOLEAN, defaultValue: false, allowNull: false},
    operating: {type: SeqTypes.BOOLEAN, defaultValue: true, allowNull: false}
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  flightModel.associate = function(models){
    const airlineModel = models.Airline;
    const airportModel = models.Airport;
    const terminalModel = models.Terminal;

    flightModel.belongsTo(airlineModel, {as: 'Airline', foreignKey: 'airline_id'});
    flightModel.belongsTo(airportModel, {as: 'DepAirport' ,foreignKey: 'dep_airport_id'});
    flightModel.belongsTo(airportModel, {as: 'ArrAiport', foreignKey: 'arr_airport_id'});
    flightModel.belongsTo(terminalModel, {as: 'DepTerminal', foreignKey: 'dep_terminal_id'});
    flightModel.belongsTo(terminalModel, {as: 'ArrTerminal', foreignKey: 'arr_terminal_id'});
    flightModel.belongsTo(flightModel, {as: 'OperatingFlight', foreignKey: 'operating_id'});

    // MODEL METHODS REQUIRING MODELS
    flightModel.createFlightMap = function(flightIds){
      if(!Array.isArray(flightIds) || !flightIds.length)
        return Promise.resolve({});

      return flightModel.findAll({
        where: {id: {[Op.in]: flightIds}},
        attributes: models.queries.FETCH_ASSOCIATED_FLIGHT,
        include: models.queries.FETCH_ASSOCIATED_FLIGHT

      }).then(flights => {
        const map = {};
        flights.forEach(flight => map[flight.id] = flight);
        return map;
      });
    };

    // <-- end of METHODS REQUIRING MODELS
  };

  return flightModel;
};