const TRIP_TYPES = require('../utils/commonFields').TRIP_TYPES;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize; 
  const Op = seq.Op;

  /** @type {JetTripModel} */
  const tripModel = sequelize.define('Trip', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    type: {type: SeqTypes.ENUM, values: TRIP_TYPES}
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  tripModel.associate = function(models){
    tripModel.belongsTo(models.User, {as: 'Creator', foreignKey: 'creator_id'});
    
    tripModel.belongsToMany(models.User, {through: models.TripsUsers});

    tripModel.hasMany(models.Via, {foreignKey: 'trip_id'});
    tripModel.hasMany(models.TripsUsers, {foreignKey: 'trip_id', as: 'UserLinks'});

    // MODEL METHODS REQUIRING MODELS
    tripModel.createTripUserMap = function(userTrips){
      /** @type {{[tripId: string]: JetTripUserInstance}} */
      const tripIds = {};
      userTrips.forEach(userTrip => tripIds[userTrip.trip_id] = userTrip);
  
      if(!Object.keys(tripIds))
        return Promise.reject({Trip: 'createTripUserMap: userTrip ids was empty'});

      return tripModel.findAll({
        where: {id: {[Op.in]: Object.keys(tripIds)}},
        attributes: models.queries.FETCH_TASK_TRIP.attributes,
        include: models.queries.FETCH_TASK_TRIP.include
      }).then(trips => {
        const tripUserMap = {};
        const airportIds = {};

        trips.forEach(trip => {
          const userTrip = tripIds[trip.id];
          trip.TripsUsers = userTrip;
          tripUserMap[userTrip.id] = trip;

          trip.vias.forEach(via => {
            airportIds[via.dep_airport_id] = true;
            airportIds[via.arr_airport_id] = true;
          });
        });

        return models.Airport
          .createExtendedAirportMap(Object.keys(airportIds))
          .then(airportIdMap => {
            const aggloIdMap ={};

            Object.keys(airportIdMap).forEach(iata => {
              const airport = airportIdMap[iata];
              airport.Agglos.forEach(agglo => aggloIdMap[agglo.id] = agglo);
            });

            // populates the trip
            trips.forEach(trip => {
              trip.vias.forEach(via => {
                via.DepAirport = airportIdMap[via.dep_airport_id];
                via.ArrAirport = airportIdMap[via.arr_airport_id];
              });
            });

            return {
              tripUserMap,
              airportIdMap,
              aggloIdMap
            };
          });
      });
    }; // <-- END of METHODS REQUIRING MODELS
  };
  
  // MODEL INSTANCE METHODS
  /** @param {JetTripInstance} o*/
  tripModel.prototype.compareTo = function(o){
    /** @type {JetViaInstance} */
    const t_firstVia = this.vias[0];

    /** @type {JetViaInstance} */
    const o_firstVia = o.vias[0];

    return t_firstVia.compareByStartDateTime(o_firstVia);
  };

  /** @param {JetTripUserInstance} userTrip
   * @param {{[travelerId: string]: JetUserTravelerInstance}} travUserTravMap*/
  tripModel.prototype.createResponse = function(userTrip,travUserTravMap){
    /** @type {JetTripInstance} */
    const trip = this;

    const vias = trip.vias.sort((v1,v2) => v1.ordinal - v2.ordinal);

    /** @type {JetTripResponse} */
    const resp = {
      userTrip: userTrip.createResponse(),
      summary: {
        type: trip.type
      },
      viasCount: vias.length,
      vias: vias.map(via => via.createResponse(travUserTravMap))
    };

    return resp;
  };

  return tripModel;
};