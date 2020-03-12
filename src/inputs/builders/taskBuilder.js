const TASK_STATUS = require('../../utils/commonFields').TASK_STATUS;

/** @param {JetModels} models */
module.exports = function(models){
  
  /** @type {JetTaskBuilder} */
  const taskBuilder = {};

  taskBuilder.provisional = function(taskRequest, creatorId){
    const depAddressId = taskRequest.depCityLocation && taskRequest.depCityLocation.address
      ? taskRequest.depCityLocation.address.id : null;

    const arrAddressId = taskRequest.arrCityLocation && taskRequest.arrCityLocation.address
      ? taskRequest.arrCityLocation.address.id : null;

    const depHood = !depAddressId && taskRequest.depCityLocation
      ? taskRequest.depCityLocation.hood : null;

    const arrHood = !arrAddressId && taskRequest.arrCityLocation
      ? taskRequest.arrCityLocation.hood : null;

    const task = models.Task.build({
      type: taskRequest.type,
      status: TASK_STATUS.dft,
      earliest_date: taskRequest.earliestDate,
      latest_date: taskRequest.latestDate,
      earliest_time: taskRequest.earliestTime,
      latest_time: taskRequest.latestTime,

      dep_neighborhood_id: depHood ? depHood.id : null,
      arr_neighborhood_id: arrHood ? arrHood.id : null,
      dep_address_id: depAddressId,
      arr_address_id: arrAddressId,

      creator_id: creatorId
    });

    return task;
  };


  taskBuilder.fromVia = function(taskRequest, creatorId){
    const depAddressId = taskRequest.depCityLocation && taskRequest.depCityLocation.address
      ? taskRequest.depCityLocation.address.id : null;

    const arrAddressId = taskRequest.arrCityLocation && taskRequest.arrCityLocation.address
      ? taskRequest.arrCityLocation.address.id : null;

    const depHood = !depAddressId && taskRequest.depCityLocation
      ? taskRequest.depCityLocation.hood : null;

    const arrHood = !arrAddressId && taskRequest.arrCityLocation
      ? taskRequest.arrCityLocation.hood : null;


    const task = models.Task.build({
      type: taskRequest.type,
      status: TASK_STATUS.dft,
      start_date: taskRequest.via.dep_date,
      start_time: taskRequest.via.dep_time,
      end_date: taskRequest.via.arr_date,
      end_time: taskRequest.via.arr_time,

      dep_airport_id: taskRequest.via.dep_airport_id,
      arr_airport_id: taskRequest.via.arr_airport_id,
      dep_neighborhood_id: depHood ? depHood.id : null,
      arr_neighborhood_id: arrHood ? arrHood.id : null,
      dep_address_id: depAddressId,
      arr_address_id: arrAddressId,

      via_id: taskRequest.via.id,
      flight_id: taskRequest.via.flight_id,
      creator_id: creatorId
    });

    return task;    
  };


  taskBuilder.update = function(taskRequest,unlinkedAddresses){
    const task = taskRequest.task;
    task.type = taskRequest.type;

    if(taskRequest.depCityLocation){
      const depAddress = taskRequest.depCityLocation.address;
      const depHood = taskRequest.depCityLocation.hood;

      if(task.dep_address_id){
        if(depAddress && !depAddress.id !== task.dep_address_id)
          unlinkedAddresses[task.dep_address_id] = true;
        else if(!depAddress)
          unlinkedAddresses[task.dep_address_id] = true;
      }

      task.dep_address_id = depAddress ? depAddress.id : null;
      task.dep_neighborhood_id = depHood ? depHood.id : null;
    } else {
      if(task.dep_address_id)
        unlinkedAddresses[task.dep_address_id] = true;

      task.dep_address_id = null;
      task.dep_neighborhood_id = null;
    }

    if(taskRequest.arrCityLocation){
      const arrAddress = taskRequest.arrCityLocation.address;
      const arrHood = taskRequest.arrCityLocation.hood;
      
      if(task.arr_address_id){
        if(arrAddress && arrAddress.id !== task.arr_address_id)
          unlinkedAddresses[task.arr_address_id] = true;
        else if(!arrAddress)
          unlinkedAddresses[task.arr_address_id] = true;
      }

      task.arr_address_id = arrAddress ? arrAddress.id : null;
      task.arr_neighborhood_id = arrHood ? arrHood.id : null;
    } else {
      if(task.arr_address_id)
        unlinkedAddresses[task.arr_address_id] = true;

      task.arr_address_id = null;
      task.arr_neighborhood_id = null;
    }
  };

  taskBuilder.updateFromVia = function(taskRequest,unlinkedAddresses = []){
    taskBuilder.update(taskRequest,unlinkedAddresses);

    const task = taskRequest.task;
    if(taskRequest.startTime)
      task.start_time = taskRequest.startTime;

    if(taskRequest.endTime)
      task.end_time = taskRequest.endTime;
  };

  taskBuilder.updateProvisional = function(taskRequest,unlinkedAddresses = []){
    const task = taskRequest.task;

    taskBuilder.update(taskRequest,unlinkedAddresses);

    task.earliest_date = taskRequest.earliestDate;
    task.latest_date = taskRequest.latestDate;
    task.earliest_time = taskRequest.earliestTime;
    task.latest_time = taskRequest.latestTime;
  };

  return taskBuilder;
};