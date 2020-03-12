
const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetAirlineModel} */
  const airlineModel = sequelize.define('Airline', {
    id: {
      type: SeqTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      autoIncrement: true
    },
    iata: {type: SeqTypes.CHAR(2)},
    icao: {type: SeqTypes.CHAR(3), unique: true},
    name: {type: SeqTypes.STRING, allowNull: false},
    alt_name: {type: SeqTypes.STRING},
    active: {type: SeqTypes.BOOLEAN, defaultValue: true}
  },{
    underscored: true
  });

  /** @param {JetModels} models */
  airlineModel.associate = function(models){
    const countryModel = models.Country;

    airlineModel.belongsTo(countryModel, {foreignKey: 'country_id'});
  };

  // MODEL METHODS
  airlineModel.createIdMap = function(ids){
    if(!Array.isArray(ids) || !ids.length)
      return Promise.resolve({});

    return airlineModel.findAll({
      where: {id: {[Op.in]: ids}},
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES
    }).then(airlines => {
      const map = {};
      airlines.forEach(airline => map[airline.id] = airline);
      return map;
    });
  };

  airlineModel.createIataMap = function(iatas){
    if(!Array.isArray(iatas) || !iatas.length)
      return Promise.resolve({});

    return airlineModel.findAll({
      where: {iata: {[Op.in]: iatas}},
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES
    }).then(airlines => {
      const map = {};

      airlines.forEach(airline => {
        map[airline.iata] = airline;
      });

      return map;
    });
  };

  airlineModel.createIcaoMap = function(icaos){
    if(!Array.isArray(icaos) || !icaos.length)
      return Promise.resolve({});

    return airlineModel.findAll({
      where: {icao: {[Op.in]: icaos}},
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES
    }).then(airlines => {
      const map = {};

      airlines.forEach(airline => {
        map[airline.icao] = airline;
      });

      return map;
    });
  };

  airlineModel.pullByName = function(names){
    if(!Array.isArray(names) || !names.length){
      return [];
    }

    return airlineModel.findAll({
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES,
      where: seq.where(seq.literal('name'),' similar to ', seq.literal(`'%(${names.join('|')})%'`))
    });
  };

  // INSTANCE METHODS
  airlineModel.prototype.checkNameMatch = function(lookUp){
    if(typeof lookUp === 'string'){
      lookUp = lookUp.toLowerCase();
      
      /** @type {JetAirlineInstance} */
      const airline = this;

      if(airline.name.toLowerCase().includes(lookUp)){
        return true;
      } else if (airline.alt_name && airline.alt_name.toLowerCase.includes(lookUp)){
        return true;
      }
    }

    return false;
  };



  return airlineModel;
  
};