
const resAttr = require('../utils/commonResAttr');
const nameToKey = require('../utils/commonFunctions').convertNameToKey;

const AGGLO_TYPES = require('../utils/commonFields').AGGLO_RANKS;
const DFT_RANK = require('../utils/commonFields').DFT_RANK;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;
  
  /** @type {JetAggloModel} */
  const aggloModel = sequelize.define('Agglo', {
    id: {
      type: SeqTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {type: SeqTypes.STRING(50), allowNull: false},
    local_name: {type: SeqTypes.STRING(50), allowNull: false},
    rank: {type: SeqTypes.ENUM, values: AGGLO_TYPES, defaultValue: DFT_RANK},
    latitude: {type: SeqTypes.DECIMAL, allowNull: false},
    longitude: {type: SeqTypes.DECIMAL, allowNull: false},
    pic: {type: SeqTypes.INTEGER},
    multi_country: {type: SeqTypes.BOOLEAN, allowNull: false, defaultValue: false},
    population: {type: SeqTypes.INTEGER}
  }, {
    underscored: true
  });

  const citiesAgglosModel = seq.define('CitiesAgglos', {
    main_association: {type: SeqTypes.BOOLEAN, defaultValue: false}
  }, {
    underscored: true
  });


  /** @param {JetModels} models */
  aggloModel.associate = function(models){

    this.belongsTo(models.Country, {foreignKey: 'primary_country', as: 'PrimaryCountry'});
    this.belongsTo(models.State, {foreignKey: 'primary_state', as: 'PrimaryState'});
    this.belongsTo(models.City, {foreignKey: 'primary_city', as: 'PrimaryCity'});
    this.hasMany(models.Neighborhood, {foreignKey: 'agglo_id', onDelete: 'cascade'});

    const agglosNamesModel = sequelize.define('AgglosNames', {
      name: {type: SeqTypes.STRING(20), allowNull: false}
    }, {
      underscored: true
    });

    this.belongsToMany(models.Language,{through: agglosNamesModel});

    this.belongsToMany(models.Country, {through: 'AgglosCountries'});
    models.Country.belongsToMany(this, {through: 'AgglosCountries'});

    aggloModel.belongsToMany(models.City, {through: citiesAgglosModel});
    models.City.belongsToMany(aggloModel, {through: citiesAgglosModel});

  };

  // MODEL METHODS
  aggloModel.createMap = function(aggloIds){
    if(!Array.isArray(aggloIds) || !aggloIds.length)
      return Promise.resolve({});
    
    return aggloModel.findAll({
      where: {id: {[Op.in]: aggloIds}},
      attributes: resAttr.AGGLO_GEOMAP_ATTRIBUTES
    });
  };

  aggloModel.createAggloMap = function(aggloNames){
    if(!Array.isArray(aggloNames) || !aggloNames.length)
      return Promise.resolve(aggloNames);

    return aggloModel.findAll({
      where: {name: {[Op.in]: aggloNames}},
      attributes: resAttr.AGGLO_GEOMAP_ATTRIBUTES
    }).then(agglos => {
      const map = {};

      agglos.forEach(agglo => {
        const key = nameToKey(agglo.name);
        if(!map[key]) 
          map[key] = [agglo];
        else
          map[key].push(agglo);
      });

      return map;
    });
  };

  aggloModel.addCityAgglos = function(cityId,aggloIds) {
    if(!cityId || !Array.isArray(aggloIds) || !aggloIds.length)
      return Promise.resolve();

    const cityAggloEntries = aggloIds.map(aggloId => ({
      agglo_id: aggloId,
      city_id: cityId,
      main_association: false
    }));

    return citiesAgglosModel.bulkCreate(cityAggloEntries);
  }
  
  return aggloModel; 
};