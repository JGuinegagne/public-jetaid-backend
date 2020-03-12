const geowrapper = require('../../seeder_helpers/geowrapper');
const geolib = require('geolib');
const resAttr = require('../utils/commonResAttr');

const ADDRESS_TYPES = require('../utils/commonFields').ADDRESS_TYPES;

/** Utility to match cities whose name shows up as 'null' in google (NY boroughs)
 * @type {{[countyLookupName: string]: string}}*/
const NULL_CITIES_COUNTYKEYS = {
  kingscounty: 'brooklyn',
  bronxcounty: 'bronx',
  queenscounty: 'queens',
  richmondcounty: 'statenisland'
};

/** Country codes for which states ought to be displayed.
 * @type {string[]}*/
const STATE_COUNTRIES = ['US','CA','MX','GB','DE','AU'];


module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetAddressModel} */
  const addressModel = sequelize.define('Address', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    street_name: {type: SeqTypes.STRING(50)},
    street_number: {type: SeqTypes.STRING(20)},
    latitude: {type: SeqTypes.DECIMAL},
    longitude: {type: SeqTypes.DECIMAL},
    locator: {type: SeqTypes.STRING},
    provider: {type: SeqTypes.STRING(20)}
  }, {
    underscored: true
  });

  // MODEL STATIC METHODS
  /** @param {JetModels} models */
  addressModel.associate = function(models){

    this.belongsTo(models.City, {foreignKey: 'city_id'});
    this.belongsTo(models.State, {foreignKey: 'state_id'});
    this.belongsTo(models.Country, {foreignKey: 'country_id'});
    this.belongsTo(models.AddressInfo, {foreignKey: 'address_info_id'});

    const userModel = models['User'];
    const travelerModel = models['Traveler'];

    this.belongsToMany(userModel, {through: models.UsersAddresses});
    userModel.belongsToMany(this, {through: models.UsersAddresses});

    this.belongsToMany(travelerModel, {through: models.TravelersAddresses});
    travelerModel.belongsToMany(this, {through: models.TravelersAddresses});

    models.UsersAddresses.belongsTo(addressModel, {foreignKey: 'address_id'});
    models.TravelersAddresses.belongsTo(addressModel, {foreignKey: 'address_id'});

    // MODEL METHOD REQUIRING MODELS
    addressModel.shouldRemove = function(id){
      return Promise.all([
        models.UsersAddresses.count({where: {address_id: id}}),
        models.TravelersAddresses.count({where: {address_id: id}})    
      ]).then(([userCount,travCount]) => {
        return (userCount + travCount) === 0;
      });
    };

    addressModel.createAddressIdMap = function(addressIds){
      if(!Array.isArray(addressIds) || !addressIds.length)
        return Promise.resolve({});

      return addressModel.findAll({
        where: {id: {[Op.in]: addressIds}},
        attributes: models.queries.FETCH_ASSOCIATED_ADDRESS.attributes,
        include: models.queries.FETCH_ASSOCIATED_ADDRESS.include
      }).then(addresses => {
        const outMap= {};
        addresses.forEach(address => outMap[address.id] = address);
        return outMap;
      });
    };

    addressModel.findHood = async function(addressId, airportId){
      if(typeof addressId !== 'string' || typeof airportId !== 'string')
        return null;

      try{
        const [address,airport] = await Promise.all([
          addressModel.findById(addressId,models.queries.FETCH_ASSOCIATED_ADDRESS),
          models.Airport.findById(airportId,models.queries.FETCH_ASSOCIATED_AIRPORT)
        ]);

        if(!address)
          return Promise.reject({address: 'findHoodId: address could be found'});

        if(!airport)
          return Promise.reject({airport: 'findHood: airport cannot be found'});

        return await address.findNeighborhood(airport);

      } catch(error){
        return Promise.reject(error);
      }
    };

    // INSTANCE METHODS REQUIRING MODELS
    /** Create the UserAddress association
    * @param {JetUserInstance} user 
    * @param {string} alias 
    * @param {string} type */
    this.prototype.addUser = function(user, alias = 'home', type = ADDRESS_TYPES.dft) {
      alias = alias ? alias.substr(0,8) : 'home';
      if(type && ADDRESS_TYPES.values.includes(type.toLowerCase())){
        type = type.toLowerCase();
      } else {
        type = ADDRESS_TYPES.dft;
      }
      return models.UsersAddresses.create({
        user_id: user.id,
        address_id: this.id,
        alias,
        type
      });
    };
 
    /** Create the TravelerAddress association
    * @param {JetTravelerInstance} user 
    * @param {string} alias 
    * @param {string} type */
    this.prototype.addTraveler = function(traveler, alias = 'home', type = ADDRESS_TYPES.dft) {
      alias = alias ? alias.substr(0,8) : 'home';
      
      if(type && ADDRESS_TYPES.values.includes(type.toLowerCase())){
        type = type.toLowerCase();
      } else {
        type = ADDRESS_TYPES.dft;
      }
      return models.TravelersAddresses.create({
        traveler_id: traveler.id,
        address_id: this.id,
        alias,
        type
      });
    };

    this.prototype.findCountryStateCity = function(details){
      /** @type {JetAddressInstance} */
      const address = this;

      let countryCode = 'US';
      let stateCode = null;
      let cityLookupName = '';

      if(details.countryCode && String(details.countryCode).length === 2 ){
        countryCode = details.countryCode;
      }

      if(details.stateCode && STATE_COUNTRIES.includes(countryCode)){
        stateCode = models.State.readStateCode(details.stateCode);
      }

      if(details.cityName){
        cityLookupName = models.City.createLookupName(details.cityName);

      } else if (details.countyHint){
        cityLookupName = models.City.createLookupName(details.countryHint); // here we use cityLookupName as a buffer
        cityLookupName = NULL_CITIES_COUNTYKEYS[cityLookupName] 
          ? NULL_CITIES_COUNTYKEYS[cityLookupName] : cityLookupName;
      }

      if(stateCode){
        return Promise.all([
          models.Country.findById(countryCode, {attributes: ['code']}),
          models.State.findOne({where: {country_id: countryCode, code: stateCode}, attributes: ['id']}),
          models.City.findOne({where: {
            country_id: countryCode, 
            state_code: stateCode, 
            lookup_name: cityLookupName
          }, attributes: ['id']})
        
        ]).then(([country,state,city]) => {  
          address.country_id = country ? country.code : null;
          address.state_id = state ? state.id : null;
          address.city_id = city ? city.id : null;
          return address;

        });

      } else {
        return Promise.all([
          models.Country.findById(countryCode, {attributes: ['code']}),
          models.City.findOne({where: {
            country_id: countryCode, 
            state_code: stateCode, 
            lookup_name: cityLookupName
          }})
        ]).then(([country,city]) => {
          address.country_id = country ? country.code : null;

          if(city){
            address.city_id = city.id;
            return address;
          
          } else{
            return geowrapper
              .queryAddressDetails(address.latitude, address.longitude)
              .then(geoInfos => {
                return models.City
                  .createFromGeocode(
                    countryCode,
                    address.latitude,
                    address.longitude,
                    geoInfos
                  ).then(city => {
                    address.city_id = city ? city.id : null;
                  })
              })
          }
        });
      }
    };

    /** @param {JetReferencedAddressRequest} addressReq*/
    addressModel.prototype.updateAndSaveFromFields = function(addressReq){
      /** @type {JetAddressInstance} */
      const address = this;
      
      if(addressReq.location){
        address.latitude = addressReq.location.latitude ? addressReq.location.latitude : address.latitude;
        address.longitude = addressReq.location.longitude ? addressReq.location.longitude : address.longitude;
        address.locator = addressReq.location.locator ? addressReq.location.locator : address.locator;
        address.provider = addressReq.location.provider ? addressReq.location.provider : address.provider;
      }
  
      if(addressReq.details){
        address.street_name = addressReq.details.streetName ? addressReq.details.streetName : address.street_name;
        address.street_number = addressReq.details.streetNumber ? addressReq.details.streetNumber : address.street_number;
      }
  
      if(addressReq.infos){
        const infos = addressReq.infos;
        if(address.AddressInfo){
          address.AddressInfo.building_name = infos.buildingName ? infos.buildingName : null;
          address.AddressInfo.apartment_identifier = infos.apartmentIdentifier ? infos.apartmentIdentifier : null;
          address.AddressInfo.floor_identifier = infos.floorIdentifier ? infos.floorIdentifier : null;
          address.AddressInfo.postcode = infos.postcode ? infos.postcode : address.AddressInfo.postcode;
          address.AddressInfo.building_description = infos.buildingDescription ? infos.buildingDescription : null;
          address.AddressInfo.access_description = infos.accessDescription ? infos.accessDescription : null;

          return Promise.all([
            addressReq.geolocated 
              ? address
                .findCountryStateCity(addressReq.details)
                .then(() => address.save())
              : address.save(),
            address.AddressInfo.save()
          ]);
        
        } else {
          const addressInfo = models.AddressInfo.buildFromFields(addressReq.infos);
          address.address_info_id = addressInfo.id;
          addressInfo.address_id = address.id;
        
          return Promise.all([
            addressInfo.save(),
            addressReq.geolocated 
              ? address.findCountryStateCity(addressReq.details) 
              : Promise.resolve(address)
          ]).then(() => address.save());
        }
      
      } else {
        return address.save();
      }
    };

    this.prototype.shouldRemove = function(){
      return Promise.all([
        models.UsersAddresses.count({where: {address_id: this.id}}),
        models.TravelersAddresses.count({where: {address_id: this.id}}),
        models.Rider.findOne({where: {address_id: this.id}, attributes: ['address_id']}),
        models.Task.findOne({
          where: {[Op.or]: [
            {dep_address_id: this.id},
            {arr_address_id: this.id}
          ]},
          attributes: ['id']
        })
      ]).then(([userCount,travCount,rider,task]) => userCount + travCount + (rider ? 1 : 0) + (task ? 1 : 0) <= 0);
    };

    /** 
     * @param {{latitude: number, longitude: number}} addressPos
     * @param {JetNeighborhoodInstance} hood 
    * @return {number} dist hood-address*/
    const evaluateSubHood = (addressPos, hood) => {
      return geolib.getDistance(addressPos,{latitude: hood.latitude, longitude: hood.longitude});
    };

    /**
     * @param {{latitude: number, longitude: number}} addressPos
     * @param {Array<JetNeighborhoodInstance} hoods */
    const evaluateEligibleHoods = (addressPos, hoods) => {
      if(hoods.length === 1){
        return hoods[0];
      
      } else if(hoods.length > 1){
        return hoods                
          .map(hood => {
            return {
              dist: evaluateSubHood(addressPos, hood),
              value: hood
            };
          })
          .sort((e1,e2)=> e1.val - e2.val)[0]
          .value;
      }
      return null;
    };

    /* Finds a neighborhood based on an airport, using the address own latitude and longitude.
    (1) uses the agglos associated to an airport, and order for them to minimize the expression:
    val = [ distance(address-agglo)^2 + distance(airport-agglo)^2 ]
    (2) fetches all the neighborhoods that are: 
      (i) associated with the city of the address
      (ii) of an agglo associated with the airport
    (3) starting from the agglo of the lowest val to highest, finds the closest neighborhood to
    the address associated to the city.*/

    /** @param {JetAirportInstance} airport */
    this.prototype.findNeighborhood = function(airport){
      /** @type {JetAddressInstance} */
      const address = this;

      if(!airport){
        return Promise.reject({matchNeighborhood: 'Airport instance was null'});
      }

      const addressPos = {latitude: address.latitude, longitude: address.longitude};
      const airptPos = {latitude: airport.latitude, longitude: airport.longitude};

      /** @param {JetAggloInstance} agglo 
       * @return {number} sum of squared dist airpt-address, address-agglo*/
      const evaluateAgglo = (agglo) => {
        const aggloPos = {latitude: agglo.latitude, longitude: agglo.longitude};
        const addressAggloDist = geolib.getDistance(addressPos,aggloPos)/1000;
        const airptAggloDist = geolib.getDistance(airptPos,aggloPos)/1000;

        return Math.pow(addressAggloDist,2) + Math.pow(airptAggloDist,2);
      };

      /** @type {Array<{val: number, agglo: JetAggloInstance} */
      const airptAgglos = (airport.Agglos 
        ? airport.Agglos
        : airport.PrimaryAgglo ? [airport.PrimaryAgglo] : [])
        .map(agglo => {
          return {
            val: evaluateAgglo(agglo),
            agglo
          };
        }).sort((e1,e2)=> e1.val - e2.val);

      if(typeof address.city_id === 'number'){
        return models.City.findById(address.city_id, {
          attributes: ['name','lookup_name'],
          include: [{
            model: models.Neighborhood,
            as: 'SubHoods',
            attributes: ['id','name','latitude','longitude','agglo_id'],
            where: {agglo_id: {[seq.Op.in]: airptAgglos.map(entry => entry.agglo.id)}},
            required: false
          },{
            model: models.Neighborhood,
            as: 'Suburbs',
            attributes: ['id','name','latitude','longitude','agglo_id'],
            where: {agglo_id: {[seq.Op.in]: airptAgglos.map(entry => entry.agglo.id)}},
            required: false
          }]
        }).then(city => {
          if(!city){
            return Promise.resolve(false);
          }

          /** @type {Array<JetNeighborhoodInstance>} */
          const suburbs = city.Suburbs ? city.Suburbs : [];

          /** @type {Array<JetNeighborhoodInstance>} */
          const subHoods = city.SubHoods ? city.SubHoods : [];

          /** @type {JetNeighborhoodInstance} */
          let foundHood = null;

          for(let entry of airptAgglos){
            const eligibleHoods = [];
            const suburb = suburbs.find(sub => sub.agglo_id === entry.agglo.id);

            if(suburb){
              eligibleHoods.push(suburb);
            }

            subHoods
              .filter(hood => hood.agglo_id === entry.agglo.id)
              .forEach(hood => eligibleHoods.push(hood));

            foundHood = evaluateEligibleHoods(addressPos,eligibleHoods);
            if(foundHood){
              break;
            }
          }

          return foundHood;

        });
      } else
        return Promise.resolve(null);
    };

    this.prototype.findNeighborhoodWithinAgglo = function(aggloId){
      if(typeof aggloId !== 'number' || aggloId < 0){
        return Promise.reject(new Error('Address: cannot identify a neighborhood because the provided agglo is null'));

      } else if(typeof this.city_id === 'number'){
        return models.City.findById(this.city_id, {
          attributes: resAttr.CITY_RESPONSE_ATTRIBUTES.concat(['id']),
          include: [{
            model: models.Neighborhood,
            as: 'SubHoods',
            attributes: resAttr.HOOD_GEOMAP_ATTRIBUTES,
            where: {agglo_id: aggloId},
            required: false
          },{
            model: models.Neighborhood,
            as: 'Suburbs',
            attributes: resAttr.HOOD_GEOMAP_ATTRIBUTES,
            where: {agglo_id: aggloId},
            required: false
          }]
        }).then(city => {
          if(!city){
            return Promise.resolve(false);
          }

          /** @type {Array<JetNeighborhoodInstance>} */
          const suburbs = city.Suburbs ? city.Suburbs : [];

          /** @type {Array<JetNeighborhoodInstance>} */
          const subHoods = city.SubHoods ? city.SubHoods : [];

          const addressPos = {latitude: this.latitude, longitude: this.longitude};
          const eligibleHoods = [].concat(...suburbs).concat(...subHoods);

          return evaluateEligibleHoods(addressPos,eligibleHoods);
        });
      
      } else {
        return Promise.reject(new Error('Address: cannot identify a neighborhood because address is not mapped to any city'));

      } 
    };

    /** @param {Array<JetAirportInstance>} airports */
    this.prototype.createNeighborhoodMap = function(airports){
      /** @type {JetAddressInstance} */
      const address = this;
      const addressPos = {latitude: address.latitude, longitude: address.longitude};

      /** @type {{[airportIata: string]: JetAddressHoodSearchEntry} */
      const airportMap = {};
      airports.forEach(airport => {
        airportMap[airport.id] = {
          airport, 
          airportPos: {latitude: airport.latitude, longitude: airport.longitude}, 
          agglos: [],
          hood: null};
      });


      /** @param {JetAggloInstance} agglo 
       * @param {{latitude: number, longitude: number}} airptPos
       * @return {number} sum of squared dist airpt-address, address-agglo*/
      const evaluateAgglo = (agglo, airptPos) => {
        const aggloPos = {latitude: agglo.latitude, longitude: agglo.longitude};
        const addressAggloDist = geolib.getDistance(addressPos,aggloPos)/1000;
        const airptAggloDist = geolib.getDistance(airptPos,aggloPos)/1000;

        return Math.pow(addressAggloDist,2) + Math.pow(airptAggloDist,2);
      };

      /** @type {{[aggloId: number]: boolean} */
      const aggloMap = {};
      
      airports.forEach(airport => {
        const mapEntry = airportMap[airport.id];
        mapEntry.aggloEntries = (airport.Agglos 
          ? airport.Agglos
          : airport.PrimaryAgglo
            ? [airport.PrimaryAgglo] : []
        ).map(agglo => ({val: evaluateAgglo(agglo,mapEntry.airportPos), agglo}))
          .sort((e1,e2) => e1.val - e2.val);

        mapEntry.aggloEntries.forEach(entry => (aggloMap[entry.agglo.id] = true));
      });

      console.log(address)
      console.log(airports)

      if(typeof this.city_id === 'number' && airports.length > 0){
        return models.City.findById(this.city_id, {
          attributes: ['name','lookup_name'],
          include: [{
            model: models.Neighborhood,
            as: 'SubHoods',
            attributes: ['id','name','latitude','longitude','agglo_id'],
            where: {agglo_id: {[seq.Op.in]: Object.keys(aggloMap)}},
            required: false
          },{
            model: models.Neighborhood,
            as: 'Suburbs',
            attributes: ['id','name','latitude','longitude','agglo_id'],
            where: {agglo_id: {[seq.Op.in]: Object.keys(aggloMap)}},
            required: false
          }]

        }).then(city => {
          if(!city){
            return Promise.resolve(false);
          }

          /** @type {{[airportIata: string]: JetNeighborhoodInstance}} */
          const outMap = {};

          Object.keys(airportMap).forEach(airportIata => {
            const entry = airportMap[airportIata];

            for(let aggloEntry of entry.aggloEntries){
              const eligibleHoods = [];
              const suburb = city.Suburbs.find(sub => sub.agglo_id === aggloEntry.agglo.id);
              if(suburb)
                eligibleHoods.push(suburb);

              eligibleHoods.push(...city.SubHoods
                .filter(hood => hood.agglo_id === aggloEntry.agglo.id)
              );

              entry.neighborhood = evaluateEligibleHoods(addressPos,eligibleHoods);
              if(entry.neighborhood){
                entry.neighborhood.Agglo = aggloEntry.agglo;
                break;
              }
            }

            outMap[airportIata] = entry.neighborhood;
          });

          return outMap;
        });
      } else
        return Promise.reject({address: 'createNeighborhoodMap: airports or address input not valid'});

    };


    this.prototype.updateFromFields = function(fields){
      if(typeof fields.location.latitude === 'number' && typeof fields.location.longitude === 'number'){
        if(fields.location.latitude !== this.latitude && fields.location.longitude !== this.longitude){
          this.street_name = fields.details.streetName;
          this.street_number = fields.details.streetNumber;
          this.latitude = fields.location.latitude;
          this.longitude = fields.location.longitude;
          this.locator = fields.location.locator;
          this.provider = fields.location.provider; 
        }
        return true;
      } else {
        return false;
      }
    };
  };


  addressModel.prototype.createFullResponse = function(){
    /** @type {JetAddressInstance} */
    const address = this;

    const city = address.City;
    const state = address.State;
    const country = address.Country;
    const addressInfo = address.AddressInfo;

    return {
      location: {
        latitude: address.latitude,
        longitude: address.longitude,
        locator: address.locator,
        provider: address.provider
      },
      details: {
        streetName: address.street_name,
        streetNumber: address.street_number,
        cityName: city ? city.name : null,
        stateName: state ? state.name : null,
        stateCode: state ? state.code : null,
        countryName: country ? country.name : null,
        countryCode: country ? country.code : null
      },
      infos: {
        buildingName: addressInfo ? addressInfo.building_name : null,
        apartmentIdentifier: addressInfo ? addressInfo.apartment_identifier : null,
        floorIdentifier: addressInfo ? addressInfo.floor_identifier : null,
        postcode: addressInfo ? addressInfo.postcode : null,
        buildingDescription: addressInfo ? addressInfo.building_description : null,
        accessDescription: addressInfo ? addressInfo.access_description : null
      }
    };
  };
  

  /** @param {JetUserAddressInstance} userAddress
   * @param {JetTravelerInstance} travelerAddress*/
  addressModel.prototype.createSelectionResponse = function(userAddress, travelerAddress){
    /** @type {JetAddressInstance} */
    const address = this;

    const response = address.createFullResponse();
    response.marker = {
      userRef: null,
      travelerRef: null,
      alias: null,
      type: null
    };

    if(userAddress){
      response.marker.userRef = userAddress.id;
      response.marker.alias = userAddress.alias;
      response.marker.type = userAddress.type;
    
    } else if(travelerAddress){
      response.marker.travelerRef = travelerAddress.id;
      response.marker.alias = travelerAddress.alias;
      response.marker.type = travelerAddress.type; 
      
      const userTrav = travelerAddress.UsersTravelers;
      if(userTrav)
        response.marker.userTravelerRef = userTrav.id;
    }

    return response;
  };


  // MODEL STATIC METHODS
  addressModel.isValidRequest = function(addressReq, errors, ind = 0, checkLonLat = true){
    if(!addressReq.references){
      errors.errors[`address${ind}`] = 'address request must have a references field';
      return false;
    }

    if(!addressReq.location){
      errors.errors[`address${ind}`] = 'address request must have a location field';
      return false;
    }

    if(!addressReq.details){
      errors.errors[`address${ind}`] = 'address request must have a details field';
      return false;
    }

    if(checkLonLat && typeof addressReq.location.latitude !== 'number'){
      errors.errors[`address${ind}`] = 'address.location must have a "latitude" field of type number';
      return false;
    }

    if(checkLonLat && typeof addressReq.location.longitude !== 'number'){
      errors.errors[`address${ind}`] = 'address.location must have a "longitude" field of type number';
      return false;
    }

    return true;
  };

  addressModel.isValidEdit = function(addressReq, errors, ind = 0){
    if(!addressModel.isValidRequest(addressReq, errors, ind, false)){
      return false;
    }

    if(typeof addressReq.references.ref !== 'string' || addressReq.references.ref !== addressReq.references.ref.toString('hex')){
      errors.errors[`address${ind}`] = 'address.references.ref must be an hex string';
      return false;
    }

    return true;
  };

  addressModel.isValidCityStopRequest = function(cityStopReq, errors, lbl = 'CityStopRequest', ind = 0){
    lbl+= ind;
    if(cityStopReq.marker){
      if(typeof cityStopReq.marker.travelerRef === 'string' 
        && cityStopReq.marker.travelerRef.toString('hex') !== cityStopReq.marker.travelerRef){
        errors.errors[lbl] = 'cityStop.travelerRef, if provided, must be an hex string';
        return false;                 
      }

      if(typeof cityStopReq.marker.userRef === 'string' && cityStopReq.marker.userRef.toString('hex') !== cityStopReq.marker.userRef){
        errors.errors[lbl] = 'cityStop.marker.userRef, if provided, must be an hex string';
        return false;               
      }

    } else {
      errors.errors[lbl] = 'cityStop must have a "marker" field';
      return false; 
    }

    if(cityStopReq.location){
      // no requirement for now
    } else {
      errors.errors[lbl] = 'cityStop must have a "location" field';
      return false;             
    }

    if(cityStopReq.details){
      // no requirement for now
    } else {
      errors.errors[lbl] = 'cityStop must have a "details" field';
      return false;             
    }

    if(cityStopReq.area){
      // no requirement for now
    } else {
      errors.errors[lbl] = 'cityStop must have an "area" field';
      return false;             
    }

    return true;
  };

  addressModel.fetchGeocodeInfos = function(addressRequests){
    if(!addressRequests.length)
      return Promise.resolve([]);

    return Promise.all(
      addressRequests.map(editRequest => {
        if(typeof editRequest.location.latitude === 'number' && typeof editRequest.location.longitude === 'number'){
          return addressModel.updateRequestFields(editRequest);
        }
        return Promise.resolve(editRequest);
      })
    );
  };

  addressModel.updateRequestFields = async function(addressReq){
    const latitude = Number(addressReq.location.latitude);
    const longitude = Number(addressReq.location.longitude);
      
    if(!addressReq.location.locator || !addressReq.location.provider || addressReq.location.provider !== geowrapper.PROVIDER){
      return geowrapper.queryAddressDetails(latitude, longitude)
        .then(geoinfos => {
          addressReq.location.locator = geoinfos.locator;
          addressReq.location.provider = geoinfos.provider;
      
          if(!addressReq.details){
            addressReq.details = {};
          }

          addressReq.geolocated = true;

          addressReq.details.streetName = addressReq.details.streetName ? addressReq.details.streetName : geoinfos.streetName;
          addressReq.details.streetNumber = addressReq.details.streetNumber ? addressReq.details.streetNumber : geoinfos.streetNumber;
          addressReq.details.cityName = geoinfos.cityName;
          addressReq.details.stateCode = geoinfos.stateCode;
          addressReq.details.countryCode = geoinfos.countryCode;

          if(!addressReq.infos){
            addressReq.createInfos = !!geoinfos.zipcode
            addressReq.infos = {};
          } else {
            addressReq.createInfos = true;
          }

          addressReq.infos.postcode = addressReq.infos.postcode ? addressReq.infos.postcode : geoinfos.zipcode;
          return addressReq;
        });
    }

    if(addressReq.infos)
      addressReq.createInfos = true;
    
    return Promise.resolve(addressReq);
  }; 

  addressModel.isValidType = function(type){
    return type && ADDRESS_TYPES.values.includes(type);
  };

  addressModel.buildFromFields = function(fields){
    return addressModel.build({
      street_name: fields.details.streetName,
      street_number: fields.details.streetNumber,
      latitude: fields.location.latitude,
      longitude: fields.location.longitude,
      locator: fields.location.locator,
      provider: fields.location.provider
    });
  };

  addressModel.handleUnlinks = function(unlinkedAddressIds){
    if(!unlinkedAddressIds || !Object.keys(unlinkedAddressIds).length)
      return Promise.resolve();

    return Promise.all(Object.keys(unlinkedAddressIds).map(addressId => {
      return addressModel
        .shouldRemove(addressId)
        .then(remove => {
          unlinkedAddressIds[addressId] = remove;
        });
    })).then(() => {
      const toRemoveIds = Object.keys(unlinkedAddressIds)
        .filter(addressId => unlinkedAddressIds[addressId]);

      return toRemoveIds.length > 0
        ? addressModel.destroy({where: {id: {[Op.in]: toRemoveIds}}})
        : Promise.resolve();
    });
  };

  addressModel.createBlankSelectionResponse = function(){
    /** @type {JetAddressSelectionResponse} */
    const resp = {
      marker: {
        userRef: null,
        travelerRef: null,
        alias: null,
        type: null
      },
      location: {
        latitude: null,
        longitude: null,
        locator: null,
        provider: null
      },
      details: {
        streetName: null,
        streetNumber: null,
        cityName: null,
        stateName: null,
        stateCode: null,
        countryName: null,
        countryCode: null
      },
      infos: {
        buildingName: null,
        apartmentIdentifier: null,
        floorIdentifier: null,
        postcode: null,
        buildingDescription: null,
        accessDescription: null
      }
    };
    return resp;
  };

  addressModel.createCityLocationResponse = function(address, userAddress=null, travAddress=null, hood=null){
    /** @type {JetCityLocationResponse} */
    const resp = address
      ? address.createSelectionResponse(userAddress,travAddress)
      : addressModel.createBlankSelectionResponse();

    resp.area = {
      neighborhoodName: hood ? hood.name : null,
      aggloName: hood && hood.Agglo ? hood.Agglo.name : null
    };

    return resp;
  };

  return addressModel;
};
