
const resAttr = require('../utils/commonResAttr');
const AIRPORT_TYPES = require('../utils/commonFields').AIRPORT_TYPES;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;
  
  /** @type {JetAirportModel} */
  const airportModel = sequelize.define('Airport', {
    id: {
      type: SeqTypes.CHAR(3),
      primaryKey: true,
      allowNull: false
    },
    icao: {
      type: SeqTypes.CHAR(4),
      unique: true,
      allowNull: false
    },
    name: {type: SeqTypes.STRING(50), allowNull: false},
    local_name: {type: SeqTypes.STRING(50)},
    latitude: {type: SeqTypes.DECIMAL, allowNull: false},
    longitude: {type: SeqTypes.DECIMAL, allowNull: false},
    timezone: {type: SeqTypes.DECIMAL},
    status: {
      type: SeqTypes.ENUM, 
      values: AIRPORT_TYPES,
      defaultValue: AIRPORT_TYPES[0]
    },
    pic: {type: SeqTypes.INTEGER}
  }, {
    underscored: true
  });


  /** @param {JetModels} models */
  airportModel.associate = function(models){

    this.belongsTo(models.Country,{foreignKey: 'country_id'});
    this.belongsTo(models.Agglo, {foreignKey: 'primary_agglo', as: 'PrimaryAgglo'});

    const airportAggloModel = sequelize.define('AirportsAgglos', {
      distance: {type: SeqTypes.DECIMAL, allowNull: false}
    }, {
      underscored: true
    });

    this.belongsToMany(models.Agglo, {through: airportAggloModel});
    models.Agglo.belongsToMany(this, {through: airportAggloModel});

    this.hasMany(models.Terminal, {foreignKey: 'airport_id', onDelete: 'cascade'});

    // MODEL METHODS REQUIRING MODELS
    airportModel.createExtendedAirportMap = function(iatas, aggloIdMap = null){
      if(!iatas.length)
        return Promise.resolve({});

      return airportModel.findAll({
        where: {id: {[Op.in]: iatas}},
        attributes: models.queries.FETCH_ASSOCIATED_AIRPORT.attributes,
        include: models.queries.FETCH_ASSOCIATED_AIRPORT.include
      }).then(airports => {
        const map = {};
  
        airports.forEach(airport => {
          map[airport.id] = airport;
        });

        if(aggloIdMap){
          airports.forEach(airport => {
            airport.Agglos.forEach(agglo => aggloIdMap[agglo.id] =  agglo);
          });
        }
  
        return map;
      });   
    };
  };

  // MODEL METHODS
  airportModel.createAirportMap = function(iatas){
    if(!iatas.length)
      return {};

    return airportModel.findAll({
      where: {id: {[Op.in]: iatas}},
      attributes: resAttr.AIRPORT_MAP_ATTRIBUTES
    }).then(airports => {
      const map = {};

      airports.forEach(airport => {
        map[airport.id] = airport;
      });

      return map;
    });
  };

  // INSTANCE METHODS
  airportModel.prototype.createProvisionalResponse = function(){
    /** @type {JetAirportInstance} */
    const airport = this;
    const provHood = airport.TasksAirports.Neighborhood;

    /** @type {JetProvisionalTaskBound} */
    const provResponse = {
      airportCode: airport.id,
      airportName: airport.name,
      boundNeighborhood: provHood ? provHood.name : null,
      boundAgglo: provHood && provHood.Agglo ? provHood.Agglo.name : null
    };

    return provResponse;
  };


  return airportModel;
};