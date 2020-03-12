const resAttr = require('../utils/commonResAttr');
const nameToKey = require('../utils/commonFunctions').convertNameToKey;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetNeighborhoodModel} */
  const neighborhoodModel = sequelize.define('Neighborhood', {
    id: {
      type: SeqTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {type: SeqTypes.STRING(50), allowNull: false},
    local_name: {type: SeqTypes.STRING(50), allowNull: false},
    description: {type: SeqTypes.STRING, allowNull: false},
    distance: {type: SeqTypes.FLOAT, allowNull: false},
    latitude: {type: DataTypes.DECIMAL, allowNull: false},
    longitude: {type: SeqTypes.DECIMAL, allowNull: false},
    suburb: {type: SeqTypes.BOOLEAN, defaultValue: false},
    own_population: {
      type: SeqTypes.INTEGER, 
      defaultValue: 0, 
      allowNull: false
    }, weight: {
      type: SeqTypes.INTEGER,
      defaultValue: 1,
      allowNull: false
    }
  }, {
    underscored: true
  });

  const neighborhoodsCitiesModel = seq.define('NeighborhoodsCities',{},{
    underscored: true
  });

  /** @param {JetModels} models */
  neighborhoodModel.associate = function(models){
    this.belongsTo(models.Agglo,{foreignKey: 'agglo_id'});
    this.belongsTo(models.City,{foreignKey: 'default_city', as: 'DefaultCity'});
    
    const neighborhoodsNamesModel = sequelize.define('NeighborhoodsNames', {
      name: {type: SeqTypes.STRING(50), allowNull: false}
    }, {
      underscored: true
    });

    this.belongsToMany(models.Language,{through: neighborhoodsNamesModel});
    models.Language.belongsToMany(this,{through: neighborhoodsNamesModel});

    this.belongsToMany(
      models.City,
      {through: neighborhoodsCitiesModel, as: 'Townships'}
    );

    models.City.belongsToMany(
      neighborhoodModel,
      {through: neighborhoodsCitiesModel, as: 'Suburbs'}
    );

    neighborhoodsCitiesModel.belongsTo(models.City,{foreignKey: 'city_id'});
    neighborhoodsCitiesModel.belongsTo(models.Neighborhood,{foreignKey: 'neighborhood_id'});

    // this.belongsToMany(models.City, {
    //   through: 'NeighborhoodsCities',
    //   foreignKey: 'neighborhood_id',
    //   otherKey: 'city_id',
    //   as: 'Townships'
    // });

    // models.City.belongsToMany(this, {
    //   through: 'NeighborhoodsCities',
    //   foreignKey: 'city_id',
    //   otherKey: 'neighborhood_id',
    //   as: 'Suburbs'
    // });

    models.City.hasMany(this,{foreignKey: 'default_city', as: 'SubHoods'});


    // MODEL METHODS REQUIRING MODELS
    neighborhoodModel.createHoodIdMap = function(hoodIds){
      if(!Array.isArray(hoodIds) || !hoodIds.length)
        return Promise.resolve({});

      return neighborhoodModel.findAll({
        where: {id: {[Op.in]: hoodIds}},
        attributes: models.queries.FETCH_ASSOCIATED_HOOD.attributes,
        include: models.queries.FETCH_ASSOCIATED_HOOD.include
      }).then(hoods => {
        const outMap = {};

        hoods.forEach(hood => outMap[hood.id] = hood);
        return outMap;
      });
    }; // <-- END of METHODS REQUIRING MODELS
  };

  // MODEL METHODS
  neighborhoodModel.createHoodMap = function(hoodNames){
    if(!Array.isArray(hoodNames) || !hoodNames.length)
      return Promise.resolve({});

    return neighborhoodModel.findAll({
      where: {name: {[Op.in]: hoodNames}},
      attributes: resAttr.HOOD_GEOMAP_ATTRIBUTES
    }).then(hoods => {
      const map = {};

      hoods.forEach(hood => {
        const key = nameToKey(hood.name);

        if(map[key]){
          map[key].push(hood);
        } else{
          map[key] = [hood];
        }
      });

      return map;
    });
  };


  neighborhoodModel.addCityHoods = function(cityId,hoodIds) {
    if(!cityId || !Array.isArray(hoodIds) || !hoodIds.length)
      return Promise.resolve();

    const cityHoodEntries = hoodIds.map(hoodId => ({
      city_id: cityId,
      neighborhood_id: hoodId
    }));

    return neighborhoodsCitiesModel
      .bulkCreate(cityHoodEntries);
  }

  return neighborhoodModel;
};