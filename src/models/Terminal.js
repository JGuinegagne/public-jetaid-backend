
const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;

  const Op = seq.Op;

  /** @type {JetTerminalModel} */
  const terminalModel = sequelize.define('Terminal', {
    id: {
      type: SeqTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    code: {type: SeqTypes.STRING(20), allowNull: false},
    name: {type: SeqTypes.STRING(50)},
    domestic_time: {type: SeqTypes.INTEGER},
    international_time: {type: SeqTypes.INTEGER},
    operating: {type: SeqTypes.BOOLEAN}
  }, {
    underscored: true
  });

 
  /** @param {JetModels} models */
  terminalModel.associate = function(models){

    /** @type {JetAirportModel} */
    const airportModel = models['Airport'];

    this.belongsTo(airportModel, {foreignKey: 'airport_id'});
  };

  // MODEL METHODS
  terminalModel.createMap = function(terminalIds){
    if(!Array.isArray(terminalIds) || !terminalIds.length)
      return Promise.resolve({});

    return terminalModel.findAll({
      where: {id: {[Op.in]: terminalIds}},
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    }).then(terminals => {
      const outMap = {};

      terminals.forEach(terminal => outMap[terminal.id] = terminal);
      return outMap;
    });
  };

  terminalModel.createTerminalMap = function(keys){
    if(!Array.isArray(keys) || !keys.length)
      return Promise.resolve({});

    return terminalModel.findAll({
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES,
      where: seq.where(seq.literal('airport_id || lower(code)'), ' in ', seq.literal(`('${keys.join('\',\'')}')`))
    }).then(terminals => {
      const map = {};

      terminals.forEach(terminal => {
        map[terminal.airport_id + terminal.code.toLowerCase()] = terminal;
      });

      return map;
    });
  };

  /** @param {Array<string>} airportIds */
  terminalModel.createMapFromAirports = function(airportIds){
    if(!Array.isArray(airportIds) || !airportIds.length)
      return Promise.resolve({});

    return terminalModel.findAll({
      where: {airport_id: {[Op.in]: airportIds}},
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    }).then(terminals => {
      const map = {};
      terminals.forEach(terminal => map[terminal.id] = terminal);
      return map;
    });
  };

  return terminalModel;
};