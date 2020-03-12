/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetFetchHandler} */
  const fetchHandler = {};

  /** @type {(lbl: string) => string} */
  const toDbNameMatch= (lbl) => {
    const splitLbl  = lbl.toLowerCase().split(' ');
    for (let i = 0; i < splitLbl.length; i++) {
      splitLbl[i] = splitLbl[i].charAt(0).toUpperCase() + splitLbl[i].slice(1);
    }
    
    return splitLbl.join(' ');
  };

  /** @type {<T>(entries: Array<T>) => Array<T>}*/
  const uniques = (entries) => {
    const out = {};

    entries.forEach(entry => out[entry] = true);
    return Object.keys(out);
  };

  fetchHandler.fields = async function(requests, opt = {userId: null, travMap: null, extend: []}){

    /** @type {JetInfos} */
    const out = {};

    opt = opt ? opt : {};

    const userId = typeof opt.userId === 'string' && opt.userId.toString('hex') === opt.userId ? opt.userId : null;
    if(opt.travMap){
      out.travMap = opt.travMap;
    }

    /** @type {Array<JetExtendOption>} */
    const extensions = Array.isArray(opt.extend) ? opt.extend : [];

    /** @type {Array<Promise<void>>} */
    const fetchPromises = [];

    try{
      Object.keys(requests)
        .forEach(field => {
          const entries = requests[field];
          const key = field.replace(/ /g,'').replace('_','').replace('-','').toLowerCase();

          /* eslint-disable no-case-declarations */
          switch(key){

          case 'aggloname':
          case 'agglonames':
          /** @type {Array<string>} */ 
            const aggloNames = uniques(entries
              .filter(aggloname => typeof aggloname === 'string' && aggloname.length > 1)
              .map(toDbNameMatch)
            );

            if(aggloNames.length)
              fetchPromises.push(models.Agglo
                .createAggloMap(aggloNames)
                .then(aggloMap => {
                  out.aggloMap = aggloMap;
                })
              );
            else
              out.aggloMap = {};
            break;
  
          case 'hoodname':
          case 'hoodnames':
          case 'neighborhoodname':
          case 'neighborhoodnames':
          /** @type {Array<string>} */ 
            const hoodNames = uniques(entries
              .filter(hoodName => typeof hoodName === 'string' && hoodName.length > 1)
              .map(toDbNameMatch)
            );

            if(hoodNames.length)
              fetchPromises.push(models.Neighborhood
                .createHoodMap(hoodNames)
                .then(hoodMap => {
                  out.hoodMap = hoodMap;
                })
              );
            else
              out.hoodMap = {};

            break;
  
          case 'terminalkey':
          case 'terminalkeys':
          /** @type {Array<string>} */
            const terminalKeys = uniques(entries
              .filter(terminalKey => typeof terminalKey === 'string' && terminalKey.length > 3)
            );

            if(terminalKeys.length)
              fetchPromises.push(models.Terminal
                .createTerminalMap(terminalKeys)
                .then(terminalMap => {
                  out.terminalMap = terminalMap;
                })
              );
            else
              out.terminalMap = {};
            break;
  
          case 'airport':
          case 'airports':
          case 'airportid':
          case 'airportids':
          /** @type {Array<string>} */
            const airportIds = uniques(entries
              .filter(airportId => typeof airportId === 'string' && /^[A-Z]{3}$/.test(airportId.toUpperCase()))
              .map(airportId => airportId.toUpperCase())
            );

            if(airportIds.length)
              fetchPromises.push(
                (extensions.includes('airport') 
                  ? models.Airport.createExtendedAirportMap(airportIds) 
                  : models.Airport.createAirportMap(airportIds)
                ).then(airportMap => {
                  out.airportIdMap = airportMap;
                })
              );
            else
              out.airportIdMap = {};

            break;
  
          case 'terminal':
          case 'terminals':
          case 'terminalid':
          case 'terminalids':
          /** @type {Array<number>} */
            const terminalIds = uniques(entries.filter(entry => Number.isInteger(Number(entry))));

            if(terminalIds.length)
              fetchPromises.push(models.Terminal
                .createMap(terminalIds)
                .then(terminalMap => {
                  out.terminalIdMap = terminalMap;
                })
              );
            else
              out.terminalIdMap = {};
            break;
  
          case 'useraddress':
          case 'useraddresses':
          case 'useraddressid':
          case 'useraddressids':
          /** @type {Array<string>} */
            const userAddressIds = uniques(entries.filter(entry => typeof entry === 'string' && entry.toString('hex') === entry));

            if(userAddressIds.length && userId){
              fetchPromises.push(models.UsersAddresses
                .createAddressMap(userId, userAddressIds)
                .then(userAddressMap => {
                  out.userAddressMap = userAddressMap;
                })
              );              
            } else
              out.userAddressMap = {};

            break;
  
          case 'travmap':
          case 'travaddress':
          case 'travaddresses':
          case 'travaddressid':
          case 'travaddressids':
          case 'traveleraddressid':
          case 'traveleraddressids':
          case 'traveleraddress':
          case 'traveleraddresses':
          /** @type {Array<string>} */
            const travAddressIds = uniques(entries.filter(entry => typeof entry === 'string' && entry.toString('hex') === entry));

            if(travAddressIds.length){
              if(out.travMap){
                fetchPromises.push(models.TravelersAddresses
                  .createAddressMap(travAddressIds,out.travMap)
                  .then(travAddressMap => {
                    out.travAddressMap = travAddressMap;
                  })
                );      

              } else if(userId){
                fetchPromises.push(models.UsersTravelers
                  .createUserTravsMap(userId)
                  .then(travMap => {
                    out.travMap = travMap;
                    return models.TravelersAddresses
                      .createAddressMap(travAddressIds,travMap)
                      .then(travAddressMap => {
                        out.travAddressMap = travAddressMap;
                      });
                  })
                );                  
              }

            } else if(userId && key === 'travmap'){
              fetchPromises.push(models.UsersTravelers
                .createUserTravsMap(userId)
                .then(map => {
                  out.travMap = map;
                })
              );
            }
            break;

          case 'address':
          case 'addresses':
          case 'addressid':
          case 'addressids':
            const addressIds = uniques(entries.filter(entry => typeof entry === 'string' && entry.toString('hex') === entry));

            if(addressIds.length){
              fetchPromises.push(models.Address
                .createAddressIdMap(addressIds)
                .then(map => {
                  out.addressIdMap = map;
                })
              );
            } else
              out.addressIdMap = {};
            break;
  
          case 'agglo':
          case 'agglos':
          case 'aggloid':
          case 'aggloids':
          /** @type {Array<number>} */
            const aggloIds = uniques(entries.filter(entry => typeof entry === 'number' && Number.isInteger(entry)));

            if(aggloIds.length)
              fetchPromises.push(models.Agglo
                .createMap(aggloIds)
                .then(aggloIdMap => {
                  out.aggloIdMap = aggloIdMap;
                })
              );
            else
              out.aggloIdMap = {};
            break;
  
          case 'hood':
          case 'hoods':
          case 'hoodid':
          case 'hoodids':
          /** @type {Array<number>} */
            const hoodIds = uniques(entries.filter(entry => Number.isInteger(Number(entry))));

            if(hoodIds.length)
              fetchPromises.push(models.Neighborhood
                .createHoodIdMap(hoodIds)
                .then(hoodIdMap => {
                  out.hoodIdMap = hoodIdMap;
                })
              );
            else
              out.hoodIdMap = {};
            break;
  
          case 'via':
          case 'vias':
          case 'viaid':
          case 'viaids':
            /** @type {Array<string>} */
            const viaIds = uniques(entries.filter(entry => typeof entry === 'string' && entry.toString('hex') === entry));

            if(viaIds.length){
              fetchPromises.push(models.Via
                .createViaMap(viaIds)
                .then(viaMap => {
                  out.viaIdMap = viaMap;
                })
              );
            } else
              out.viaIdMap = {};
            break;

          case 'airlines':
          case 'airline':
          case 'airlineids':
          case 'airlineid':
            /** @type {Array<string>} */
            const airlineIds = uniques(entries.filter(entry => typeof entry === 'number' && Number.isInteger(entry)));
            if(airlineIds){
              fetchPromises.push(models.Airline
                .createIdMap(airlineIds)
                .then(airlineMap => {
                  out.airlineIdMap = airlineMap;
                })
              );
            } else
              out.airlineIdMap = {};
            break;

          case 'airlineicao':
          case 'airlineicaos':
          case 'icao':
          case 'icaos':
            /** @type {Array<string>} */
            const icaos = uniques(entries
              .filter(entry => typeof entry === 'string' && /^[A-Z]{3}$/.test(entry.toUpperCase()))
              .map(entry => entry.toUpperCase())
            );

            if(icaos.length){
              fetchPromises.push(models.Airline
                .createIcaoMap(icaos)
                .then(icaoMap => {
                  out.airlineIcaoMap = icaoMap;
                })
              );
            } else 
              out.airlineIcaoMap = {};
            break;

          case 'airlineiata':
          case 'airlineiatas':
            /** @type {Array<string>} */
            const iatas = uniques(entries
              .filter(entry => typeof entry === 'string' && /^[A-Z]{2}$/.test(entry.toUpperCase()))
              .map(entry => entry.toUpperCase())
            );

            if(iatas.length){
              fetchPromises.push(models.Airline
                .createIataMap(iatas)
                .then(iataMap => {
                  out.airlineIataMap = iataMap;
                })
              );
            } else
              out.airlineIataMap = {};
            break;

          case 'airlinenames':
          case 'airlinename':
            const airlineNames = uniques(entries
              .filter(entry => typeof entry === 'string')
              .map(entry => toDbNameMatch(entry))
            );

            if(airlineNames.length){
              fetchPromises.push(models.Airline
                .pullByName(airlineNames)
                .then(airlines => {
                  out.potentialAirlines = airlines;
                })
              );
            }
            break;

          case 'usertrav':
          case 'usertravs':
          case 'usertravid':
          case 'usertravids':
            const userTravIds = uniques(entries
              .filter(entry => typeof entry === 'string' && entry.toString('hex') === entry)
            );

            if(userTravIds.length && userId){
              fetchPromises.push(models.UsersTravelers
                .createMap(userId,userTravIds)
                .then(map => {
                  out.userTravMap = map;
                })
              );
            }
            break;

          case 'traveler':
          case 'travelers':
          case 'travelerid':
          case 'travelerids':
            const travIds = uniques(entries
              .filter(entry => typeof entry === 'string' && entry.toString('hex') === entry)
            );

            if(travIds.length){
              fetchPromises.push(models.Traveler
                .createMap(travIds)
                .then(map => {
                  out.travelerIdMap = map;
                })
              );
            } else
              out.travelerIdMap = {};

            break;

          case 'flight':
          case 'flights':
          case 'flightid':
          case 'flightids':
            const flightIds = uniques(entries.filter(entry => typeof entry === 'string' && entry.toString('hex') === entry));

            if(flightIds.length){
              fetchPromises.push(models.Flight
                .createFlightMap(flightIds)
                .then(map => {
                  out.flightIdMap = map;
                }));
            } else
              out.flightIdMap = {};
            
            break;
  
          default: 
          }
        /* eslint-enable no-case-declarations */
        });

      await Promise.all(fetchPromises);
      return out;

    } catch(error){
      return Promise.reject(error);
    }
  };


  fetchHandler.addresses = function(userId, userAddressIds, travAddressIds, travMap = null){
    if(typeof userId !== 'string' || userId.toString('hex') !== userId)
      return Promise.reject('fetch.addresses: userId must be an "hex" string');

    const reqUserAddressIds = uniques(userAddressIds)
      .filter(entry => typeof entry === 'string' && entry.toString('hex') === entry);

    const reqTravAddressIds = uniques(travAddressIds)
      .filter(entry => typeof entry === 'string' && entry.toString('hex') === entry );

    return Promise.all([
      models.UsersAddresses.createAddressMap(userId,reqUserAddressIds),
      (!travMap 
        ? models.UsersTravelers.createUserTravsMap(userId)
        : Promise.resolve(travMap)
      ).then(map => {
        return models.TravelersAddresses
          .createAddressMap(reqTravAddressIds,map)
          .then(travAddressMap => ({map,travAddressMap}));
      })

    ]).then(([userAddressMap,{map,travAddressMap}]) => {
      /** @type {JetInfos} */
      const infos = {
        travMap: map,
        userAddressMap,
        travAddressMap,
      };

      return infos;
    });
  };



  return fetchHandler;
};