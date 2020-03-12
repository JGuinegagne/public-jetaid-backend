const moment = require('moment');
const createTime = require('../../utils/commonFunctions').createTime;


/** @param {JetModels} models */
module.exports = function(models){

  /** @type {JetTaskValidator} */
  const taskValidator = {};

  // INTERNAL FUNCTIONS ------------------------------------------------------------------------------
  /** Internal function only for checks common between provisional and fromVia tasks
   * @type {(req: JetBaseTaskRequest, index?: number, errorResp: JetErrors, ) => boolean} */
  const baseValidator = (request, index = 0,errorResp = {errors:{}}) => {
    if(!request.preferences)
      request.preferences = {publicTask: true};
  
    else{
      if(typeof request.preferences.publicTask !== 'boolean'){
        errorResp.errors[`taskRequest${index}`] = 'Task.isValidRequest: request.preferences.publicTask must be a boolean';
        return false;
      }
    }

    if(request.depCityLocation && !models.Address.isValidCityStopRequest(request.depCityLocation,errorResp,'Task.depCityLocation',index)){
      errorResp.errors[`taskRequest${index}`] = 'Task.isValidRequest: provided depCityLocation request is not valid';
      return false;
    }

    if(request.arrCityLocation && !models.Address.isValidCityStopRequest(request.arrCityLocation,errorResp,'Task.arrCityLocation',index)){
      errorResp.errors[`taskRequest${index}`] = 'Task.isValidRequest: provided arrCityLocation request is not valid';
      return false;
    }

    return true;
  };
  // END of INTERNAL FUNCTIONS -----------------------------------------------------------------------


  taskValidator.provisional = function(request,index = 0,errorResp){
    if(!baseValidator(request,errorResp,index))
      return false;

    // -- ELIGIBLE DATES
    const earliestDate = moment(request.earliestDate);
    const latestDate = moment(request.latestDate);

    if(!earliestDate.isValid()){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.earliestDate property is not valid';
      return false;
    }

    if(!latestDate.isValid()){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.latestDate property is not valid';
      return false;      
    }

    if(earliestDate.isAfter(latestDate,'d')){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.latestDate must be after request.earliestDate';
      return false;       
    }

    request.earliestDate = earliestDate.format('YYYY-MM-DD');
    request.latestDate = latestDate.format('YYYY-MM-DD');


    // -- ELIGIBLE HOURS OF THE DAY
    const earliestTime = createTime(request.earliestTime ? request.earliestTime : '00:00');
    const latestTime = createTime(request.latestTime ? request.latestTime: '23:59');

    if(!earliestTime.isValid){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.earliestTime property is not valid';
      return false;
    }

    if(!latestTime.isValid){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.latestTime property is not valid';
      return false;
    }

    if(earliestTime.isAfter(latestTime)){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.latestTime must be after request.earliestTime';
      return false;   
    }
    request.earliestTime = earliestTime.format('HH:mm');
    request.latestTime = latestTime.format('HH:mm');


    if(!request.beneficiaries || !Array.isArray(request.beneficiaries) || !request.beneficiaries.length){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request.beneficiaries must be an array and must not be empty';
      return false;
    }

    if(!request.beneficiaries.every((entry,ind) => {
      if(typeof entry !== 'string' || entry.toString('hex') !== entry){
        errorResp.errors[`taskRequest${index} beneficiary${ind}`] = 'isValidProvisionalRequest: beneficiary must have a userRef property of type "hex" string';
        return false;
      }
      return true;
    })){
      return false;
    }
    request.beneficiaries = request.beneficiaries.map(entry => ({userRef: entry}));


    // -- ELIGIBLE DEP AIRPORTS
    if(!request.depAirports || !Array.isArray(request.depAirports)){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request must have a depAirports property of type "array"';
      return false;
    
    } else if(!request.depAirports.every((airpt,ind) => {
      if(typeof airpt!== 'string' || !/^[A-Z]{3}$/.test(airpt.toUpperCase())){
        errorResp.errors[`taskRequest${index} depAirport${ind}`] = `airport code ${airpt} is not valid`;
        return false;
      }
      return true;
    })){
      return false;
    }
    request.depAirports = request.depAirports.map(entry => ({airportCode: entry.toUpperCase()}));


    // -- ELIGIBLE ARR AIRPORTS
    if(!request.arrAirports || !Array.isArray(request.arrAirports)){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request must have a arrAirports property of type "array"';
      return false;      
    
    } else if(!request.arrAirports.every((airpt,ind) => {
      if(typeof airpt !== 'string' || !/^[A-Z]{3}$/.test(airpt.toUpperCase())){
        errorResp.errors[`taskRequest${index} arrAirport${ind}`] = `airport code ${airpt} is not valid`;
        return false;
      }
      return true;
    })){
      return false;
    }
    request.arrAirports = request.arrAirports.map(entry => ({airportCode: entry.toUpperCase()}));


    // -- ELIGIBLE FLIGHTS
    if(!request.flights || !Array.isArray(request.flights)){
      errorResp.errors[`taskRequest${index}`] = 'isValidProvisionalRequest: request must have a flights property of type "array"';
      return false;         
    }
    // TODO: check flights

    return true;
  };


  taskValidator.fromVia = function(request, index = 0, errorResp = {errors: {}}){
    if(!baseValidator(request,errorResp,index))
      return false;

    if(typeof request.tripUser !== 'string' || request.tripUser.toString('hex') !== request.tripUser){
      errorResp.errors[`taskRequest${index}`] 
        = 'isValidFromViaRequest: request.tripUser must be of an "hex" string';
      return false;
    }

    if(typeof request.viaOrdinal !== 'number' || !Number.isInteger(request.viaOrdinal) || request.viaOrdinal < 0){
      errorResp.errors[`taskRequest${index}`] 
        = 'isValidFromViaRequest: request.viaOrdinal must be a positive integer';
      return false;
    }

    if(!request.members || !Array.isArray(request.members) || !request.members.length){
      errorResp.errors[`taskRequest${index}`] 
        = 'isValidFromViaRequest: request.members must be an array and must not be empty';
      return false;
    }

    if(!request.members.every((entry,ind) => {
      if(typeof entry!== 'string' || entry.toString('hex') !== entry){
        errorResp.errors[`taskRequest${index} member${ind}`] 
          = 'isValidFromViaRequest: member must be of type "hex" string';
        return false;
      }
      return true;
    })){
      return false;
    }
    request.members = request.members.map(entry => ({viaRef: entry}));
    
    return true;
  };


  taskValidator.provisionalUpdate = function(request,index = 0,errorResp = {errors: {}}){
    if(!request.userRef || request.userRef.toString('hex') !== request.userRef){
      errorResp.errors[`taskRequest${index}`] 
        = 'isValidProvisionalUpdateRequest: request must have a userRef property of type "hex" string';
      return false;
    }

    request.viaTask = false;
    return taskValidator.provisional(request, errorResp, index);
  };


  taskValidator.fromViaUpdate = function(request,index=0,errorResp = {errors: {}}){
    if(!request.userRef || request.userRef.toString('hex') !== request.userRef){
      errorResp.errors[`taskRequest${index}`] = 'isValidFromViaUpdateRequest: request must have a userRef property of type "hex" string';
      return false;
    }

    if(!baseValidator(request,errorResp,index))
      return false;

    const startTime = request.startTime ? createTime(request.startTime) : null;
    const endTime = request.endTime ? createTime(request.endTime) : null;
  
    if(startTime){
      if(!startTime.isValid()){
        errorResp.errors[`taskRequest${index}`] = 'isValidFromViaUpdateRequest: request.startTime property is not valid';
        return false;
      }
      request.startTime = startTime.format('HH:mm');
    }

    if(endTime){
      if(!endTime.isValid){
        errorResp.errors[`taskRequest${index}`] = 'isValidFromViaUpdateRequest: request.endTime property is not valid';
        return false;
      }
      request.endTime = endTime.format('HH:mm');
    }

    if(!request.members || !Array.isArray(request.members) || !request.members.length){
      errorResp.errors[`taskRequest${index}`] = 'isValidFromViaRequest: request.members must be an array and must not be empty';
      return false;
    }
  
    if(!request.members.every((entry,ind) => {
      if(typeof entry !== 'string' || entry.toString('hex') !== entry){
        errorResp.errors[`taskRequest${index} member${ind}`] = 'isValidFromViaRequest: member must be of type "hex" string';
        return false;
      }
      return request.viaTask = true;
    })){
      return false;
    }
    request.members = request.members.map(entry => ({viaRef: entry}));
    return true;
  };

  taskValidator.update = function(userId,userTasks,request,errors,index = 0){
    const taskUser = userTasks.find(userRider => userRider.id === request.userRef);
    if(!taskUser){
      errors.errors[`userTask${index}`] = 'Task could not be found';
      return false;
    }
    request.taskUser = taskUser;

    if(request.taskUser.user_id !== userId){
      errors.errors[`userTask${index}`] = 'Logged user could not be matched with the task reference';
      return false;
    }
    return true;
  };


  taskValidator.provisionalHoods = function(taskRequest, infos, errors, tInd = 0){
    if(taskRequest.depCityLocation && !taskRequest.depAirports.every((entry,aInd) => {
      if(!entry.hood){
        errors.errors[`task${tInd} depAirport${aInd}`] = 'Departure city location could not find a neighborhood whose '
            +`agglo is associated to airport "${entry.airportCode}".`;
        return false;
      }
      infos.hoodIdMap[entry.hood.id] = entry.hood;
      if(!infos.aggloIdMap[entry.hood.agglo_id])
        infos.aggloIdMap[entry.hood.agglo_id] = entry.hood.Agglo;
      return true;
    })){
      return false;
    }

    if(taskRequest.arrCityLocation && !taskRequest.arrAirports.every((entry,aInd) => {
      if(!entry.hood){
        errors.errors[`task${tInd} arrAirport${aInd}`] = 'Arrival city location could not find a neighborhood whose '
            +`agglo is associated to airport "${entry.airportCode}".`;
        return false;
      }
      infos.hoodIdMap[entry.hood.id] = entry.hood;
      if(!infos.aggloIdMap[entry.hood.agglo_id])
        infos.aggloIdMap[entry.hood.agglo_id] = entry.hood.Agglo;
      return true;
    })){
      return false;
    }

    return true;
  };

  taskValidator.hoods = function(taskRequest, infos, errors, tInd){
    if(taskRequest.depCityLocation){
      if(!taskRequest.task.DepNeighborhood){
        errors.errors[`task${tInd} depAirport`] = 'Departure city location could not find a neighborhood whose '
        +`agglo is associated to airport "${taskRequest.via.DepAirport.id}".`;
        return false;
      } else {
        const hood = taskRequest.task.DepNeighborhood;
        infos.hoodIdMap[hood.id] = hood;
        if(!infos.aggloIdMap[hood.agglo_id])
          infos.aggloIdMap[hood.agglo_id] = hood.Agglo;
      }
    } 

    if(taskRequest.arrCityLocation){
      if(!taskRequest.task.ArrNeighborhood){
        errors.errors[`task${tInd} arrAirport`] = 'Arrival city location could not find a neighborhood whose '
          +`agglo is associated to airport "${taskRequest.via.ArrAirport.id}".`;
        return false;
      } else {
        const hood = taskRequest.task.ArrNeighborhood;
        infos.hoodIdMap[hood.id] = hood;
        if(!infos.aggloIdMap[hood.agglo_id])
          infos.aggloIdMap[hood.agglo_id] = hood.Agglo;        
      }
    }

    return true;
  };

  return taskValidator;
};