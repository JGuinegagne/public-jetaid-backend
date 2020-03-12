class DataAccessor {

  /** @param {JetInfos} info */
  constructor(info = {}){
    this.infos = info;
  }

  /** @param {number} id */
  getHood(id){
    return this.infos.hoodIdMap ? this.infos.hoodIdMap[id] : null;
  }

  /** @param {number} id */
  getAgglo(id){
    return this.infos.aggloIdMap ? this.infos.aggloIdMap[id] : null;
  }

  /** @param {number} id */
  getTerminal(id){
    return this.infos.terminalIdMap ? this.infos.terminalIdMap[id] : null;
  }

  /** @param {string} iata */
  getAirport(iata){
    return this.infos.airportIdMap ? this.infos.airportIdMap[iata] : null;
  }

  /** @param {string} id */
  getUserAddress(id){
    return this.infos.userAddressMap ? this.infos.userAddressMap[id] : null;
  }

  /** @param {string} id */
  getTravAddress(id){
    return this.infos.travAddressMap ? this.infos.travAddressMap[id] : null;
  }

  /** @param {string} id */
  getVia(id){
    return this.infos.viaIdMap ? this.infos.viaIdMap[id] : null;
  }

  /** @param {string} name */
  matchAgglos(name){
    return this.infos.aggloMap ? this.infos.aggloMap[name] : null;
  }

  /** @param {string} name */
  matchHood(name){
    return this.infos.hoodMap ? this.infos.hoodMap[name] : null;
  }

  /** @param {string} key */
  matchTerminal(key){
    return this.infos.terminalMap ? this.infos.terminalMap[key] : null;
  }
}

module.exports = DataAccessor;