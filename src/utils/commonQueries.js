
const resAttr = require('./commonResAttr');
const enums = require('./commonFields');

/** @param {JetModels} models */
module.exports = function(models){
  const Op = models.Sequelize.Op;

  /** @type {JetQueries} */
  const queries = {};

  queries.FETCH_USER_PROFILE = {
    model: models.User,
    attributes: resAttr.PROFILE_USER_ATTRIBUTES,  
    include: [{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      through: {
        attributes: resAttr.USER_TRAVELER_ATTRIBUTES.concat(['primary_user'])
      }
    },{
      model: models.Address,
      attributes: resAttr.ADDRESS_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES
      }, {
        model: models.State,
        attributes: resAttr.STATE_RESPONSE_ATTRIBUTES
      }, {
        model: models.City,
        attributes: resAttr.CITY_RESPONSE_ATTRIBUTES
      }, {
        model: models.AddressInfo,
        attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
      }],
      through: {
        attributes: resAttr.USER_ADDRESS_ATTRIBUTES
      }
    },{
      model: models.Phone,
      attributes: resAttr.PHONE_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_PHONE_ATTRIBUTES
      }],
      through: {
        attributes: resAttr.USER_PHONE_ATTRIBUTES
      }
    },{
      model: models.Email,
      attributes: resAttr.EMAIL_ATTRIBUTES,
      through: {
        attributes: resAttr.USER_EMAIL_ATTRIBUTES
      }
    }]
  };
  
  queries.FETCH_TRAVELER_PROFILE = {
    model: models.Traveler,
    include: [{
      model: models.Address,
      attributes: resAttr.ADDRESS_ATTRIBUTES,
      through: {
        attributes: resAttr.TRAVELER_ADDRESS_ATTRIBUTES
      },
      include: [{
        model: models.AddressInfo,
        attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
      },{
        model: models.City,
        attributes: resAttr.CITY_RESPONSE_ATTRIBUTES
      },{
        model: models.State,
        attributes: resAttr.STATE_RESPONSE_ATTRIBUTES
      },{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Phone,
      attributes: resAttr.PHONE_ATTRIBUTES,
      through: {
        attributes: resAttr.TRAVELER_PHONE_ATTRIBUTES
      },
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_PHONE_ATTRIBUTES
      }]
    },{
      model: models.Email,
      attributes: resAttr.EMAIL_ATTRIBUTES,
      through: {
        attribues: resAttr.TRAVELER_EMAIL_ATTRIBUTES
      }
    }]
  };
  
  
  queries.FETCH_VIAS = {
    model: models.Via,
    order: [['ordinal','ASC']],
    include: [{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      through: {
        attributes: resAttr.VIA_TRAVELER_ATTRIBUTES
      }
    },{
      model: models.Airline,
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES
    },{
      model: models.Airport,
      as: 'DepAirport',
      attributes: resAttr.AIRPORT_MAP_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES   
      }]
    }, {
      model: models.Airport,
      as: 'ArrAirport',
      attributes: resAttr.AIRPORT_MAP_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES      
      }]
    },{
      model: models.Terminal,
      as: 'DepTerminal',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    },{
      model: models.Terminal,
      as: 'ArrTerminal',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    }]
  };
  
  queries.FETCH_UPDATING_TRIP = {
    model: models.Trip,
    attributes: resAttr.TRIP_ATTRIBUTES,
    include: [{
      model: models.Via,
      attributes: resAttr.VIA_UPDATE_ATTRIBUTES,
      include: [{
        model: models.ViasTravelers,
        attributes: resAttr.VIA_TRAVELER_ATTRIBUTES
      }]
    }]
  };

  queries.FETCH_RIDER_TRIP = {
    model: models.Trip,
    attributes: resAttr.TRIP_ATTRIBUTES,
    include: [{
      model: models.Via,
      attributes: resAttr.VIA_UPDATE_ATTRIBUTES,
      include: [{
        model: models.ViasTravelers,
        attributes: resAttr.VIA_TRAVELER_ATTRIBUTES
      },{
        model: models.Airport,
        as: 'DepAirport',
        attributes: resAttr.AIRPORT_GEOMAP_ATTRIBUTES,
        include: [{
          model: models.Agglo,
          attributes: resAttr.AGGLO_GEOMAP_ATTRIBUTES
        }]
      }, {
        model: models.Airport,
        as: 'ArrAirport',
        attributes: resAttr.AIRPORT_GEOMAP_ATTRIBUTES,
        include: [{
          model: models.Agglo,
          attributes: resAttr.AGGLO_GEOMAP_ATTRIBUTES 
        }]
      },{
        model: models.Terminal,
        as: 'DepTerminal',
        attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
      },{
        model: models.Terminal,
        as: 'ArrTerminal',
        attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
      },{
        model: models.Rider,
        attributes: ['id'],
        include: [{
          model: models.RidersTravelers,
          attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES,
          as: 'TravelerLinks'
        }]
      }]
    }]
  };
  
  
  queries.FETCH_RIDER = {
    model: models.Rider,
    attributes: resAttr.RIDER_PRIVATE_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
      }
    },{
      model: models.Airport,
      attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES 
      }]
    },{
      model: models.Terminal,
      attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES
    },{
      model: models.Address,
      attributes: resAttr.ADDRESS_ATTRIBUTES.concat(['id']),
      include: [{
        model: models.AddressInfo,
        attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
      },{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES 
      }, {
        model: models.State,
        attributes: resAttr.STATE_RESPONSE_ATTRIBUTES
      }, {
        model: models.City,
        attributes: resAttr.CITY_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Neighborhood,
      attributes: resAttr.HOOD_RESPONSE_ATTRIBUTES,
      include: [{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Ride,
      attributes: resAttr.RIDE_SUMMARY_ATTRIBUTES,
      through: {
        attributes: resAttr.JOINED_RIDE_ATTRIBUTES,
        where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}}
      }
    },{
      model: models.Via,
      attributes: resAttr.RIDER_VIA_ATTRIBUTES,
      include: [{
        model: models.ViasTravelers,
        attributes: resAttr.VIA_TRAVELER_ATTRIBUTES
      }]
    }]
  };
  
  queries.FETCH_UPDATING_RIDER = {
    model: models.Rider,
    attributes: resAttr.RIDER_UPDATE_ATTRIBUTES,
    include: [{
      model: models.RidersTravelers,
      attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES,
      as: 'TravelerLinks'
    },{
      model: models.RidesRiders,
      attributes: resAttr.RIDE_RIDER_ATTRIBUTE,
      as: 'Connections',
    },{
      model: models.RidersUsers,
      attributes: resAttr.RIDER_USER_ATTRIBUTES,
      as: 'UserLinks'
    },{
      model: models.Via,
      attributes: resAttr.RIDER_VIA_ATTRIBUTES,
      include: [{
        model: models.ViasTravelers,
        attributes: resAttr.VIA_TRAVELER_ATTRIBUTES
      }]
    }]
  };

  queries.FETCH_LIST_RIDER = {
    model: models.Rider,
    attributes: resAttr.RIDER_FILTER_ATTRIBUTES,
    include: queries.FETCH_RIDER.include
  };

  queries.FETCH_SEARCH_RIDER = {
    model: models.Rider,
    attributes: resAttr.RIDER_SEARCH_ATTRIBUTES,
    include: [{
      model: models.Neighborhood,
      attributes: resAttr.HOOD_MAP_ATTRIBUTES
    },{
      model: models.Ride,
      attributes: ['id'],
      through: {
        where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}}
      }
    }]  
  };

  queries.FETCH_RIDER_HOODAGGLOTERM = {
    model: models.Rider,
    attributes: resAttr.RIDER_PRIVATE_ATTRIBUTES.concat(['id','airport_id']),
    include: [{
      model: models.Neighborhood,
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      include: [{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Terminal,
      attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES
    }]
  };
  
  queries.FETCH_RIDER_TRAVSHOODTERM = {
    model: models.Rider,
    attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES.concat(['id','airport_id']),
    include: [{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES.concat(['id']),
      through: {
        attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
      }  
    },{
      model: models.Neighborhood,
      attributes: resAttr.HOOD_MAP_ATTRIBUTES
    }, {
      model: models.Terminal,
      attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES
    }]
  };

  queries.FETCH_CURRENT_RIDE = {
    model: models.Ride,
    attributes: resAttr.RIDE_PUBLIC_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.Rider,
      attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}}
      }
    },{
      model: models.Neighborhood,
      as: 'CityStops',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_CITYSTOP_ATTRIBUTES
      }
    },{
      model: models.Terminal,
      as: 'TerminalStops',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_TERMINALSTOP_ATTRIBUTES
      }
    }]
  };
  
  queries.FETCH_SUSPENDED_RIDE = {
    model: models.Ride,
    attributes: resAttr.RIDE_PUBLIC_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.Rider,
      attributes: ['id'],
      through: {
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
        where: {status: enums.RIDER_STATUS.suspend}
      }
    },{
      model: models.Neighborhood,
      as: 'CityStops',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_CITYSTOP_ATTRIBUTES
      }
    },{
      model: models.Terminal,
      as: 'TerminalStops',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_TERMINALSTOP_ATTRIBUTES
      }
    }]
  };
  
  queries.FETCH_APPLICANT= {
    model: models.RidesRiders,
    attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
    include: [{
      model: models.Rider,
      attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES.concat(['id','airport_id']),
      include: [{
        model: models.RidersTravelers,
        as: 'TravelerLinks',
        attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES 
      },{
        model: models.Neighborhood,
        attributes: resAttr.HOOD_MAP_ATTRIBUTES
      }, {
        model: models.Terminal,
        attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES
      }]   
    }]
  };

  queries.FETCH_APPLICATION = {
    model: models.RidesRiders,
    attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
    include: [{
      model: models.RideRiderRequest,
      as: 'Request',
      attributes: resAttr.RIDE_RIDER_REQUEST_ATTRIBUTES
    },{
      model: models.RideRiderRequest,
      as: 'Counter',
      attributes: resAttr.RIDE_RIDER_REQUEST_ATTRIBUTES
    },{
      model: models.Rides,
      attributes: resAttr.RIDE_PUBLIC_ATTRIBUTES.concat(['id']),
      include: [{
        model: models.Rider,
        attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES,
        through: {
          attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
          where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}}
        }
      }]
    }]
  };


  queries.FETCH_PUBLIC_RIDE = {
    model: models.Ride,
    attributes: resAttr.RIDE_PUBLIC_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.Rider,
      attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES.concat(['id']),
      through: {
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}}, // ONLY the current riders
      },
      include: [{
        model: models.Traveler,
        attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES.concat(['id']),
        through: {
          attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
        }
      },{
        model: models.Terminal,
        attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
      },{
        model: models.Neighborhood,
        attributes: resAttr.HOOD_MAP_ATTRIBUTES
      }]
    },{
      model: models.Airport,
      attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES
    },{
      model: models.Agglo,
      attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
    },{
      model: models.Neighborhood,
      as: 'CityStops',
      attributes: resAttr.HOOD_RESPONSE_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_CITYSTOP_ATTRIBUTES
      }
    },{
      model: models.Terminal,
      as: 'TerminalStops',
      attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_TERMINALSTOP_ATTRIBUTES
      }
    }]
  };
  
  queries.FETCH_SELECT_RIDE = {
    model: models.Ride,
    attributes: resAttr.RIDE_PUBLIC_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.Rider,
      attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.RIDER_STATUS.rideUniques}}, // ONLY the owner
      },
      include: [{
        model: models.Traveler,
        attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
        through: {
          attributes: ['id']
        }
      }]
    },{
      model: models.Airport,
      attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES
    },{
      model: models.Agglo,
      attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES
    },{
      model: models.Neighborhood,
      as: 'CityStops',
      attributes: resAttr.HOOD_RESPONSE_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_CITYSTOP_ATTRIBUTES
      }
    },{
      model: models.Terminal,
      as: 'TerminalStops',
      attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES,
      through: {
        attributes: resAttr.RIDE_TERMINALSTOP_ATTRIBUTES
      }
    }]
  };

  queries.FETCH_SELECT_RIDE_RIDER = {
    model: models.RidesRiders,
    attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
    include: [{
      model: models.Rider,
      attributes: ['id'],
      include: [{
        model: models.Traveler,
        attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
        through: {
          attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
        }
      }]
    }]
  };
  
  queries.FETCH_RIDE_RIDER_REQUEST = {
    model: models.RideRiderRequest,
    attributes: resAttr.RIDE_RIDER_REQUEST_ATTRIBUTES,
    include: [{
      model: models.TerminalDrop,
      attributes: resAttr.RIDEREQUEST_TERMINALSTOPDROP_ATTRIBUTES
    },{
      model: models.NeighborhoodDrop,
      attributes: resAttr.RIDEREQUEST_CITYSTOPDROP_ATTRIBUTES
    },{
      model: models.Neighborhood,
      as: 'RequestedNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES
    },{
      model: models.Terminal,
      as: 'RequestedTerminal',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    }]

  };
  
  queries.FETCH_RIDE_RIDER_CONVO = {
    model: models.Convo,
    attributes: resAttr.RIDER_CONVO_ATTRIBUTES,
    include: [{
      model: models.Message,
      attributes: resAttr.MESSAGE_ATTRIBUTES,
      order: [['posted_at','ASC'],['created_at','ASC']],
      include: [{
        model: models.User,
        as: 'Author',
        attributes: resAttr.USER_MAP_ATTRIBUTES
      }]
    }]
  };

  queries.FETCH_CORIDER = {
    model: models.RidesRiders,
    attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
    include: [{  // <-- coRider in question
      model: models.Rider,
      attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES.concat(['id','airport_id']),
      include: [{
        model: models.RidersTravelers,
        as: 'TravelerLinks',
        attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES 
      },{
        model: models.Neighborhood,
        attributes: resAttr.HOOD_MAP_ATTRIBUTES
      }, {
        model: models.Terminal,
        attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES
      }]   
    },{ // <-- current ride with all current riders
      model: models.Ride,
      attributes: resAttr.RIDE_PUBLIC_ATTRIBUTES.concat(['id']),
      include: [{
        model: models.Rider,
        attributes: resAttr.RIDER_FROMRIDE_ATTRIBUTES.concat(['id']),
        through: {
          attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
          where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}}, // ONLY the current riders
        },
        include: [{
          model: models.RidersTravelers,
          as: 'TravelerLinks',
          attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
        },{
          model: models.Terminal,
          attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
        }]
      },{
        model: models.Airport,
        attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES
      },{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      },{
        model: models.Neighborhood,
        as: 'CityStops',
        attributes: resAttr.HOOD_RESPONSE_ATTRIBUTES,
        through: {
          attributes: resAttr.RIDE_CITYSTOP_ATTRIBUTES
        }
      },{
        model: models.Terminal,
        as: 'TerminalStops',
        attributes: resAttr.TERMINAL_RESPONSE_ATTRIBUTES,
        through: {
          attributes: resAttr.RIDE_TERMINALSTOP_ATTRIBUTES
        }
      }]
    },
    queries.FETCH_RIDE_RIDER_CONVO // <-- rideRider convo
    ]
  };

  queries.FETCH_ASSOCIATED_HOOD = {
    model: models.Neighborhood,
    attributes: resAttr.HOOD_MAP_ATTRIBUTES,
    include: [{
      model: models.Agglo,
      attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
    }]
  };

  queries.FETCH_ASSOCIATED_ADDRESS = {
    model: models.Address,
    attributes: resAttr.ADDRESS_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.City,
      attributes: resAttr.CITY_RESPONSE_ATTRIBUTES
    },{
      model: models.State,
      attributes: resAttr.STATE_RESPONSE_ATTRIBUTES
    },{
      model: models.Country,
      attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES
    },{
      model: models.AddressInfo,
      attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
    }]
  };

  queries.FETCH_ASSOCIATED_AIRPORT = {
    model: models.Airport,
    attributes: resAttr.AIRPORT_GEOMAP_ATTRIBUTES,
    include: {
      model: models.Agglo,
      attributes: resAttr.AGGLO_GEOMAP_ATTRIBUTES
    }
  };

  queries.FETCH_ASSOCIATED_FLIGHT = {
    model: models.Flight,
    attributes: resAttr.FLIGHT_MAP_ATTRIBUTES,
    include: [{
      model: models.Airline,
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES
    }]
  };

  // TASK RELATED QUERIES -----------------------------------------------------------------
  // --------------------------------------------------------------------------------------
  queries.FETCH_ASSOCIATED_VIA = {
    model: models.Via,
    attributes: resAttr.VIA_UPDATE_ATTRIBUTES,
    include: [{
      model: models.ViasTravelers,
      attributes: resAttr.VIA_TRAVELER_ATTRIBUTES,
      include: [{
        model: models.TasksViasTravelers,
        attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.HELP_STATUS.travelerUnique}},
        required: false
      }]
    }]
  };

  queries.FETCH_TASK_TRIP = {
    model: models.Trip,
    attributes: resAttr.TRIP_ATTRIBUTES.concat(['id']),
    include: [queries.FETCH_ASSOCIATED_VIA]
  };


  queries.FETCH_UPDATE_PROVISIONAL_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_PROVISIONAL_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.TasksTravelers,
      attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
    },{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,     
    },{
      model: models.TasksAirports,
      attributes: resAttr.TASK_AIRPORT_ATTRIBUTES
    }, {
      model: models.TasksUsers,
      attributes: resAttr.TASK_USER_ATTRIBUTES
    }]
  };

  queries.FETCH_UPDATE_FROMVIA_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_ATTRIBUTES.concat(['id']),
    include: [
      queries.FETCH_ASSOCIATED_VIA,
      {
        model: models.TasksUsers,
        attributes: resAttr.TASK_USER_ATTRIBUTES
      },
      {
        model: models.TasksViasTravelers,
        where: {status: {[Op.not]: enums.HELP_STATUS.helpee}},
        attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
        required: false
      }
    ]
  };

  queries.FETCH_REVIEW_PROVISIONAL_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_PROVISIONAL_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.TasksAirports,
      attributes: resAttr.TASK_AIRPORT_ATTRIBUTES
    }]
  };

  queries.FETCH_REVIEW_FROMVIA_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
    }]
  };

  queries.FETCH_FILTERING_VIA = {
    model: models.Via,
    attributes: resAttr.VIA_UPDATE_ATTRIBUTES,
    include: [{
      model: models.Airline,
      attributes: resAttr.AIRLINE_MAP_ATTRIBUTES
    },{
      model: models.Airport,
      as: 'DepAirport',
      attributes: resAttr.AIRPORT_MAP_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES   
      }]
    }, {
      model: models.Airport,
      as: 'ArrAirport',
      attributes: resAttr.AIRPORT_MAP_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES      
      }]
    },{
      model: models.Terminal,
      as: 'DepTerminal',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    },{
      model: models.Terminal,
      as: 'ArrTerminal',
      attributes: resAttr.TERMINAL_MAP_ATTRIBUTES
    }]
  };

  queries.FETCH_FIND_FROMVIA_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.Traveler,
      as: 'Members',
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      through: {
        attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.HELP_STATUS.publicReview}},
      }
    },{
      model: models.Neighborhood,
      as: 'DepNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES
    },{
      model: models.Neighborhood,
      as: 'ArrNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES
    }]
  };

  queries.find_provTasks = function(via){
    const taskWhere = {
      [Op.and]: [
        {earliest_date: {[Op.lte]: via.dep_date}},
        {latest_date: {[Op.gte]: via.dep_date}},
        {status: {[Op.in]: enums.TASK_STATUS.searchables}}
      ]
    };

    const airptWhere = {
      [Op.or]: [
        {[Op.and]: [
          {bound: enums.VIA_BOUND.departure},
          {airport_id: via.dep_airport_id}
        ]},
        {[Op.and]: [
          {bound: enums.VIA_BOUND.arrival},
          {airport_id: via.arr_airport_id}
        ]}
      ]
    };

    return {
      model: models.Task,
      where: taskWhere,
      attributes: resAttr.TASK_PROVISIONAL_ATTRIBUTES.concat(['id']),
      include: [{
        model: models.TasksAirports,
        attributes: resAttr.TASK_AIRPORT_ATTRIBUTES,
        where: airptWhere,
        required: true,
        include: [{
          model: models.Neighborhood,
          attributes: resAttr.HOOD_MAP_ATTRIBUTES,
          include: [{
            model: models.Agglo,
            attributes: resAttr.AGGLO_MAP_ATTRIBUTES
          }]
        }]
      },{
        model: models.Traveler,
        as: 'Beneficiaries',
        attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
        through: {
          attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
        }
      }]
    };
  };

  queries.FETCH_DETAILS_FROMVIA_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_ATTRIBUTES,
    include: [{
      model: models.Airport,
      as: 'DepAirport',
      attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Airport,
      as: 'ArrAirport',
      attributes: resAttr.AIRPORT_RESPONSE_ATTRIBUTES,
      include: [{
        model: models.Country,
        attributes: resAttr.COUNTRY_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      as: 'Members',
      through: {
        attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.HELP_STATUS.privateReview}}
      }
    },{
      model: models.Neighborhood,
      as: 'DepNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      include: [{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Neighborhood,
      as: 'ArrNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      include: [{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      }]
    }]
  };

  // EXTENDED DETAILS for a via-task
  // used in tasks/fromtrip route to get the full task details without
  // retrieving the via.
  queries.FETCH_EXTENDED_DETAILS_FROMVIA_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_ATTRIBUTES,
    include: [
      ...queries.FETCH_DETAILS_FROMVIA_TASK.include,
      {
        model: models.Address,
        as: 'DepAddress',
        attributes: resAttr.ADDRESS_EXTENDED_ATTRIBUTES,
        include: [{
          model: models.AddressInfo,
          attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
        }]
      },{
        model: models.Address,
        as: 'ArrAddress',
        attributes: resAttr.ADDRESS_EXTENDED_ATTRIBUTES,
        include: [{
          model: models.AddressInfo,
          attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
        }]
      }
    ]
  };


  queries.FETCH_DETAILS_PROVISIONAL_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_PROVISIONAL_ATTRIBUTES,
    include: [{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      as: 'Members',
      through: {
        attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
        where: {status: {[Op.in]: enums.HELP_STATUS.privateReview}}
      }
    },{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES,
      as: 'Beneficiaries',
      through: {
        attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
      }      
    },{
      model: models.TasksAirports,
      attributes: resAttr.TASK_AIRPORT_ATTRIBUTES,
      include: [{
        model: models.Neighborhood,
        attributes: resAttr.HOOD_MAP_ATTRIBUTES,
        include: [{
          model: models.Agglo,
          attributes: resAttr.AGGLO_MAP_ATTRIBUTES
        }]
      },{
        model: models.Airport,
        attributes: resAttr.AIRPORT_MAP_ATTRIBUTES
      }]
    },{
      model: models.TasksFlights,
      attributes: resAttr.TASK_FLIGHT_ATTRIBUTES
    },{
      model: models.Neighborhood,
      as: 'DepNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      include: [{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      }]
    },{
      model: models.Neighborhood,
      as: 'ArrNeighborhood',
      attributes: resAttr.HOOD_MAP_ATTRIBUTES,
      include: [{
        model: models.Agglo,
        attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
      }]
    }]
  };

  queries.FETCH_TASK_VIA_TRAVELER_CONVO = {
    model: models.Convo,
    attributes: resAttr.TASK_CONVO_ATTRIBUTES,
    include: [{
      model: models.Message,
      attributes: resAttr.MESSAGE_EXTENDED_ATTRIBUTES,
      order: [['posted_at','ASC'],['created_at','ASC']]
    }]
  };

  queries.FETCH_TASK_USERS = {
    model: models.TasksUsers,
    attributes: resAttr.TASK_USER_ATTRIBUTES,
    include: [{
      model: models.User,
      attributes: resAttr.USER_MAP_ATTRIBUTES,
      include: [{
        model: models.UsersTravelers,
        as: 'TravelerLinks',
        attributes: resAttr.USER_TRAVELER_ATTRIBUTES
      }]
    }]
  };

  queries.FETCH_TASK_FULL = {
    model: models.Task,
    attributes: resAttr.TASK_FULL_ATTRIBUTES,
    include: [{
      model: models.TasksAirports,
      attributes: resAttr.TASK_AIRPORT_ATTRIBUTES,
      include: [{
        model: models.Neighborhood,
        attributes: resAttr.HOOD_RESPONSE_ATTRIBUTES,
        include: [{
          model: models.Agglo,
          attributes: resAttr.AGGLO_RESPONSE_ATTRIBUTES
        }]
      }]
    },{
      model: models.TasksFlights,
      attributes: resAttr.TASK_FLIGHT_ATTRIBUTES
    },{
      model: models.TasksTravelers,
      attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
    },{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
      where: {status: {[Op.in]: enums.HELP_STATUS.privateReview}},
      required: false
    }]
  };

  queries.FETCH_FILTERING_TASK = {
    model: models.Task,
    attributes: resAttr.TASK_FULL_ATTRIBUTES,
    include: [{
      model: models.TasksAirports,
      attributes: resAttr.TASK_AIRPORT_ATTRIBUTES
    },{
      model: models.TasksFlights,
      attributes: resAttr.TASK_FLIGHT_ATTRIBUTES
    },{
      model: models.TasksTravelers,
      attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
    },{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
      // find ALL members
    }]
  };

  queries.FETCH_MEMBER = {
    model: models.TasksViasTravelers,
    attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
    include: [
      queries.FETCH_FILTERING_VIA,
      queries.FETCH_TASK_VIA_TRAVELER_CONVO,
      queries.FETCH_TASK_FULL,
      {
        model: models.Traveler,
        attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES
      }
    ]
  };

  queries.FETCH_PASSENGER = {
    model: models.ViasTravelers,
    attributes: resAttr.VIA_TRAVELER_ATTRIBUTES,
    include: [{
      model: models.Traveler,
      attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES
    }]
  };

  queries.FETCH_PASSENGERVIA = {
    model: models.Via,
    attributes: resAttr.VIA_UPDATE_ATTRIBUTES,
    include: [{
      model: models.Airline,
      attributes: resAttr.AIRLINE_RESPONSE_ATTRIBUTES
    }]
  };

  queries.FETCH_FINDPASSENGER = {
    model: models.ViasTravelers,
    attributes: resAttr.VIA_TRAVELER_ATTRIBUTES,
    include: [
      queries.FETCH_PASSENGERVIA,
      {
        model: models.Traveler,
        attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES
      }]
  };


  // CASCADING QUERIES -----------------------------------------------
  queries.FETCH_RIDER_VIACASCADE = {
    model: models.Rider,
    attributes: resAttr.RIDER_VIADELETE_ATTRIBUTES,
    include: [{
      model: models.RidesRiders,
      attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
      as: 'Connections',
      where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}},
      required: false
    }]
  };

  queries.FETCH_RIDER_PASSENGERCASCADE = {
    model: models.Rider,
    attributes: resAttr.RIDER_VIADELETE_ATTRIBUTES,
    include: [{
      model: models.RidesRiders,
      attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
      as: 'Connections',
      where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}},
      required: false
    },{
      model: models.RidersTravelers,
      attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
    }]
  };
  
  queries.FETCH_PASSENGER_VIACASCADE = {
    model: models.ViasTravelers,
    attributes: resAttr.VIA_TRAVELER_ATTRIBUTES,
    include: [{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES,
      where: {status: {[Op.in]: enums.HELP_STATUS.publicReview}}
    }]
  };

  queries.FETCH_RIDE_RIDERCASCADE = {
    model: models.Ride,
    attributes: resAttr.RIDE_ACTIVATE_ATTRIBUTES,
    include: [{
      model: models.RidesRiders,
      attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
      where: {status: {[Op.in]: enums.RIDER_STATUS.riderUniques}},
      as: 'RiderLinks'
    },{
      model: models.RidesTerminals,
      attributes: resAttr.RIDE_TERMINALSTOP_ATTRIBUTES
    },{
      model: models.RidesNeighborhoods,
      attributes: resAttr.RIDE_CITYSTOP_ATTRIBUTES
    }]
  };

  queries.FETCH_TASK_PASSENGERCASCADE = {
    model: models.Task,
    attributes: resAttr.TASK_FULL_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
    },{
      model: models.TasksTravelers,
      attributes: resAttr.TASK_TRAVELER_ATTRIBUTES
    },{
      model: models.TasksUsers,
      attributes: resAttr.TASK_USER_ATTRIBUTES
    }]
  };

  queries.FETCH_TASK_VIACASCADE = {
    model: models.Task,
    attributes: resAttr.TASK_ATTRIBUTES.concat(['id']),
    include: [{
      model: models.TasksViasTravelers,
      attributes: resAttr.TASK_VIA_TRAVELER_ATTRIBUTES
    }]
  };

  return queries;
};
