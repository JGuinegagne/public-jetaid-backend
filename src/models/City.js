/** Utility to match cities whose name does not show up as 'null' in google
 * but which are not mapped in the same way in cities.
 * @type {{[countyLookupName: string]: string}}*/
const UNMAPPED_CITIES = {
  manhattan: 'newyork',
  newyorkcity: 'newyork'
};

module.exports = function(sequelize,DataTypes) {
  let lastId = 0;

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;

  /** @type {JetCityModel} */
  const cityModel = sequelize.define('City', {
    id: {
      type: SeqTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    name: {type: SeqTypes.STRING(50), allowNull: false},
    agglo_name: {type: SeqTypes.STRING(50)},
    local_name: {type: SeqTypes.STRING(50)},
    lookup_name: {type: SeqTypes.STRING(50), allowNull: false},
    agglo_local_name: {type: SeqTypes.STRING(50), allowNull: false},
    state_code: {type: SeqTypes.STRING(8)},
    latitude: {type: SeqTypes.DECIMAL},
    longitude: {type: SeqTypes.DECIMAL},
    population: {type: SeqTypes.INTEGER},
    pic: {type: SeqTypes.INTEGER},
    suburban: {type: SeqTypes.BOOLEAN, defaultValue: false},
    special_agglo: {type: SeqTypes.BOOLEAN, defaultValue: false},
    ignore_pop: {type: SeqTypes.BOOLEAN, defaultValue: false},
    zone: {type: SeqTypes.STRING(5), defaultValue: null}
  }, {
    underscored: true,
    indexes: [{
      name: 'country_state_city',
      attributes: [
        'country_id',
        'state_code',
        {attribute: 'name', collate: 'en_US', order: 'DESC'}
      ]
    }]
  });

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  cityModel.associate = function(models){

    const citiesNamesModel = sequelize.define('CitiesNames', {
      name: {type: SeqTypes.STRING(50), allowNull: false},
      agglo_name: {type: SeqTypes.STRING(50)},
    });

    this.belongsToMany(models.Language,{through: citiesNamesModel});
    models.Language.belongsToMany(this,{through: citiesNamesModel});

    this.belongsTo(models.State,{foreignKey: 'state_id'});
    this.belongsTo(models.Country,{foreignKey: 'country_id'});


    cityModel.createFromGeocode = function(countryCode,lat,lng,geocode){
      if(lat === null || lat === undefined 
        || lng === null || lng === undefined)
        return Promise.resolve(null);

      if(typeof countryCode !== 'string'
        || typeof +lat !== 'number'
        || typeof +lng !== 'number'
        || !geocode
        || typeof geocode.cityName !== 'string')
        return Promise.resolve(null);
  
      const cityName = geocode.cityName;

      // finds the closest city in the same country that is
      // 1) associated to a neighborhood
      return Promise.all([
        seq.query(`
          select C.id, C.name, C.suburban, C.agglo_name, C.agglo_local_name,
          C.zone, C.state_id, C.state_code,
          point(C.longitude,C.latitude)<@>point(${lng},${lat}) as distance,
          NC.neighborhood_id, N.agglo_id
          from "Cities" C
          left outer join "NeighborhoodsCities" NC on (C.id = NC.city_id)
          left outer join "Neighborhoods" N on (N.id = NC.neighborhood_id)
          where C.country_id='${countryCode}'
          order by distance ASC limit 1
        `,{}
        ),
        seq.query('select max(id) from "Cities"')
      ]).then(([resp,maxResp]) => {
          if(resp && Array.isArray(resp) && resp.length > 0){
            /** @type {Array<any>} */
            const data = resp[0];
            const maxId = maxResp[0][0].max;
  
            const cityData = Array.isArray(data) && data.length
              ? Object.assign({},data[0])
              : null;
  
            if(!cityData) 
              return Promise.resolve(null);
  
            delete cityData.neighborhood_id;
            delete cityData.agglo_id;
  
            const hoodIds = {};
            const aggloIds = {};

            data.forEach(entry => {
              if(typeof entry.neighborhood_id === 'number' 
                && typeof entry.agglo_id === 'number'){
                  hoodIds[entry.neighborhood_id] = true;
                  aggloIds[entry.agglo_id] = true;
                }
            });
  
            return models.City
              .create({
                id: maxId+1,
                name: cityName,
                agglo_name: cityData.agglo_name,
                local_name: cityName,
                agglo_local_name: cityData.agglo_local_name,
                lookup_name: cityModel.createLookupName(cityName),
                state_code: cityData.state_code,
                latitude: +lat,
                longitude: +lng,
                population: null,
                suburban: cityData.suburban,
                special_agglo: false,
                ignore_pop: false,
                zone: cityData.zone,
                country_id: countryCode,
                state_id: cityData.state_id

              }).then(city => {
                if(!city) 
                  return Promise.resolve(null);

                if( Object.keys(aggloIds).length && Object.keys(hoodIds).length){
                  return Promise.all([
                    models.Agglo
                      .addCityAgglos(city.id,Object.keys(aggloIds)),
                    models.Neighborhood
                      .addCityHoods(city.id,Object.keys(hoodIds))
                      
                  ]).then(() => city);
                }

                return Promise.resolve(city);
              })
          }
          return Promise.resolve(null);
        })
    }
  };

  cityModel.createLookupName = function(name){
    name = name.substr(0,50)
      .toLowerCase()
      .replace(/ /g,'')
      .replace(/-|\.|'|,/g,'');   

    const chgName = UNMAPPED_CITIES[name.toLowerCase()];
    return chgName ? chgName : name;
  }



  return cityModel;
};
