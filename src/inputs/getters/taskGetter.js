
module.exports = function(){
  
  /** @type {JetTaskGetter} */
  const taskGetter = {};


  taskGetter.beneficiaryIds = function(taskRequests, isUpdate = false){
    const travIdMap = {};

    taskRequests.forEach(taskReq => {
      taskReq.beneficiaries.forEach(travReq => {
        if(!travIdMap[travReq.userTraveler.traveler_id]){
          travIdMap[travReq.userTraveler.traveler_id] = true;
        }
      });


    });

    if(isUpdate){
      taskRequests.forEach(taskReq => {
        const task = taskReq.task;
        task.TasksTravelers.forEach(taskTrav => travIdMap[taskTrav.traveler_id] = true);
        task.TasksViasTravelers.forEach(taskViaTrav => travIdMap[taskViaTrav.traveler_id] = true);
      });
    }
    return Object.keys(travIdMap);
  };
  

  taskGetter.fromViaMemberIds = function(taskRequests, isUpdate = false){
    const travIdMap = {};

    taskRequests.forEach(taskReq => {
      taskReq.members.forEach(travReq => {
        if(!travIdMap[travReq.viaTraveler.traveler_id]){
          travIdMap[travReq.viaTraveler.traveler_id] = true;
        }
      });
    });

    if(isUpdate){
      taskRequests.forEach(taskReq => {
        const task = taskReq.task;
        const via = taskReq.via;
        
        task.TasksViasTravelers.forEach(taskViaTrav => {
          travIdMap[taskViaTrav.traveler_id] = true;
        });

        via.ViasTravelers.forEach(viaTrav => {
          viaTrav.TasksViasTravelers
            .filter(taskViaTrav => taskViaTrav.task_id === task.id)
            .forEach(taskViaTrav => travIdMap[taskViaTrav.traveler_id] = true);
        });
      });
    }
    return Object.keys(travIdMap);
  };


  return taskGetter;

};