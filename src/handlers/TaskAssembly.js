const resAttr = require('../utils/commonResAttr');

const TASK_ASSEMBLER_TYPE = require('../utils/commonFields').TASK_ASSEMBLER_TYPE;
const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;


/** @param {JetModels} models */
module.exports = function(models){
  const Op = models.sequelize.Op;

  // TASK ASSEMBLER MAP CLASS: helper to manage assembly of task(s)
  class TaskAssembly{
    /** @param {JetTaskAssemblerType} type */
    constructor (type){
      /** @type {{[taskId: string]: JetTaskAssembler}} */
      this.map = {};
      this.type = TASK_ASSEMBLER_TYPE.values.includes(type)
        ? type : null;

      if(!this.type)
        throw new Error('taskHandler: TaskAssemblerMap.type is invalid');
    } 

    /** @param {JetTaskAssemblerType} type */
    static createAssembly(type){
      return new TaskAssembly(type);
    }

    /** 
     * @param {string} taskId
     * @return {JetTaskAssembler}*/
    get(taskId){
      if(typeof taskId !== 'string' || taskId.toString('hex') !== taskId)
        throw new Error('taskHandler: TaskAssemblerMap requested a taskId that is not an "hex" string');

      const entry = this.map[taskId];
      if(!entry){
        const newEntry = {members: []};
        if(TASK_ASSEMBLER_TYPE.provisionals.includes(this.type))
          newEntry.beneficiaries = [];

        return this.map[taskId] = newEntry;
      }
      return entry;
    }

    /** @param {Array<JetTaskTravelerInstance>} beneficiaries*/
    addBeneficiaries(...beneficiaries){
      beneficiaries.forEach(beneficiary => {
        if(!TASK_ASSEMBLER_TYPE.provisionals.includes(this.type))
          throw new Error('taskHandler: TaskAssemblerMap.addBeneficiary called on an instance not linked to provisional tasks');
        const entry = this.get(beneficiary.task_id);
        entry.beneficiaries.push(beneficiary);
      });
    }

    /** @param {Array<JetTaskViaTravelerInstance>} members */
    addMembers(...members){
      members.forEach(member => {
        const entry = this.get(member.task_id);
        entry.members.push(member);
      });
    }

    /** @param {Array<JetTaskInstance>} tasks */
    addTasks(...tasks){
      tasks.forEach(task => {
        const entry = this.get(task.id);
        entry.task = task;
      });
    }

    /** @param {Array<JetTaskUserInstance>} taskUser*/
    addTasksUsers(...tasksUsers){
      tasksUsers.forEach(taskUser => {
        const entry = this.get(taskUser.task_id);
        entry.userRef = taskUser.id;
      });
    }

    getTaskIds(){
      return Object.keys(this.map);
    }

    getTasks(){
      return Object.keys(this.map).map(taskId => this.map[taskId].task);
    }

    /** @param {string} taskId */
    has(taskId){
      return !!this.map[taskId];
    }

    /** @param {{[travId: string]: JetUserTravelerInstance}} travMap */
    restrictMembers(travMap){
      if(TASK_ASSEMBLER_TYPE.restricted.includes(this.type)){
        Object.keys(this.map).forEach(taskId => {
          const entry = this.map[taskId];
          entry.members = entry.members.filter(member => HELP_STATUS.travelerUnique.includes(member)
            || !!travMap[member.traveler_id]);
        });
      }
    }

    /**
     * @param {{[airportId: string]: boolean}} airportIds 
     * @param {{[hoodId: number]: boolean}} hoodIds 
     * @param {{[addressId: string]: boolean}} addressIds 
     * @param {{[travelerId: string]: boolean}} travelerIds
     * */
    mapReferences(airportIds,hoodIds,addressIds,travelerIds){
      Object.keys(this.map).forEach(taskId => {
        const entry = this.map[taskId];

        entry.members.forEach(helper => travelerIds[helper.traveler_id] = true);

        if(TASK_ASSEMBLER_TYPE.provisionals.includes(this.type))
          entry.beneficiaries.forEach(beneficiary => travelerIds[beneficiary.traveler_id] = true);

        const task = entry.task;

        if(typeof task.dep_neighborhood_id === 'number')
          hoodIds[task.dep_neighborhood_id] = true;
        if(typeof task.arr_neighborhood_id === 'number')
          hoodIds[task.arr_neighborhood_id] = true;

        if(task.dep_airport_id)
          airportIds[task.dep_airport_id] = true;
        if(task.arr_airport_id)
          airportIds[task.arr_airport_id] = true;

        if(task.TasksAirports) // <-- only for provisionalTasks
          task.TasksAirports.forEach(taskAirport => {
            airportIds[taskAirport.airport_id] = true;
            if(typeof taskAirport.neighborhood_id === 'number')
              hoodIds[taskAirport.neighborhood_id] = true;
          });

        if(task.dep_address_id)
          addressIds[task.dep_address_id] = true;
        if(task.arr_address_id)
          addressIds[task.arr_address_id] = true;
      });
    }

    /** @param {{[viaId: string]: boolean}} viaIds */
    mapVias(viaIds) {
      if(this.type !== 'ownTask') return;

      Object.keys(this.map).forEach(taskId => {
        const entry = this.map[taskId];
        const task = entry.task;

        if(task.via_id)
          viaIds[task.via_id] = true;
      });
    }

    /**
     * @param {JetInfos} infos
     * @param {{[taskId: string]: JetTaskUserInstance}} userTasksMap*/
    assemble(infos, userTasksMap){
      Object.keys(this.map).forEach(taskId => {
        const entry= this.map[taskId];
        const taskUser = userTasksMap[taskId];
        entry.userRef = taskUser ? taskUser.id : null;

        const task = entry.task;
        if(task.dep_airport_id)
          task.DepAirport = infos.airportIdMap[task.dep_airport_id];
        
        if(task.arr_airport_id)
          task.ArrAirport = infos.airportIdMap[task.arr_airport_id];
    
        if(typeof task.dep_neighborhood_id === 'number')
          task.DepNeighborhood = infos.hoodIdMap[task.dep_neighborhood_id];
    
        if(typeof task.arr_neighborhood_id === 'number')
          task.ArrNeighborhood = infos.hoodIdMap[task.arr_neighborhood_id];

        if(task.DepNeighborhood && !task.DepNeighborhood.Agglo)
          task.DepNeighborhood.Agglo = infos.aggloIdMap[task.DepNeighborhood.agglo_id];

        if(task.ArrNeighborhood && !task.ArrNeighborhood.Agglo)
          task.ArrNeighborhood.Agglo = infos.aggloIdMap[task.ArrNeighborhood.agglo_id];  
    
        if(task.dep_address_id)
          task.DepAddress = infos.addressIdMap[task.dep_address_id];
    
        if(task.arr_address_id)
          task.ArrAddress = infos.addressIdMap[task.arr_address_id];

        task.Members = entry.members
          .filter(taskViaTrav => taskViaTrav.task_id === task.id)
          .map(taskViaTrav => {
            const refTrav = infos.travelerIdMap[taskViaTrav.traveler_id];
            const trav = Object.assign({},refTrav);
            Object.setPrototypeOf(trav,refTrav);

            trav.TasksViasTravelers = taskViaTrav;
            return trav;
          });
    
        if(TASK_ASSEMBLER_TYPE.provisionals.includes(this.type)){
          task.Beneficiaries = entry.beneficiaries
            .filter(taskTrav => taskTrav.task_id === task.id)
            .map(taskTrav => {
              const refTrav = infos.travelerIdMap[taskTrav.traveler_id];
              const trav = Object.assign({},refTrav);
              Object.setPrototypeOf(trav,refTrav);
              trav.TasksTravelers = taskTrav;
              return trav;
            });

          task.ProvisionalAirports = task.TasksAirports
            .map(taskAirpt => {
              const refAirpt = infos.airportIdMap[taskAirpt.airport_id];

              if(!refAirpt)
                return null;

              // copy the airport prototype and field values
              /** @type {JetAirportInstance} */
              const airpt = Object.assign(Object.create(refAirpt),refAirpt);

              if(typeof taskAirpt.neighborhood_id === 'number' && !taskAirpt.Neighborhood){
                taskAirpt.Neighborhood = infos.hoodIdMap[taskAirpt.neighborhood_id];
                
                if(taskAirpt.Neighborhood && !taskAirpt.Neighborhood.Agglo)
                  taskAirpt.Neighborhood.Agglo = infos.aggloIdMap[taskAirpt.Neighborhood.agglo_id];
              }

              airpt.TasksAirports = taskAirpt;
              return airpt;
            }).filter(airpt=> !!airpt);
        }
      });
    }

    queryTasks(){
      if(!Object.keys(this.map).length)
        return Promise.resolve();

      switch(this.type){
      case 'ownTask': 
        return models.Task.findAll({
          where: {id: {[Op.in]: this.getTaskIds()}},
          attributes: resAttr.TASK_ATTRIBUTES.concat(['id']),
        }).then(tasks => {
          tasks.forEach(task => this.map[task.id].task = task);
        });

      case 'otherTask':
        return models.Task.findAll({
          where: {id: {[Op.in]: this.getTaskIds()}},
          attributes: resAttr.TASK_ATTRIBUTES.concat(['id']),
        }).then(tasks => {
          tasks.forEach(task => {
            const entry = this.map[task.id];
            if(!entry.members.find(member => HELP_STATUS.revealAddress.includes(member.status))){
              task.dep_address_id = null;
              task.arr_address_id = null;
            }
            entry.task = task;
          });
        });

      case 'ownProvTask':
        return models.Task.findAll({
          where: {id: {[Op.in]: this.getTaskIds()}},
          attributes: models.queries.FETCH_REVIEW_PROVISIONAL_TASK.attributes,
          include: models.queries.FETCH_REVIEW_PROVISIONAL_TASK.include
        }).then(tasks => {
          tasks.forEach(task => this.map[task.id].task = task);
        });

      case 'otherProvTask':
        return models.Task.findAll({
          where: {id: {[Op.in]: this.getTaskIds()}},
          attributes: models.queries.FETCH_REVIEW_PROVISIONAL_TASK.attributes,
          include: models.queries.FETCH_REVIEW_PROVISIONAL_TASK.include
        }).then(tasks => tasks.forEach(task => {
          const entry = this.map[task.id];
          if(!entry.members.find(member => HELP_STATUS.revealAddress.includes(member.status))){
            task.dep_address_id = null;
            task.arr_address_id = null;
          }
          entry.task = task;
        }));

      default: return Promise.resolve();
      }
    }

    /**
     * @param {{[travId: string]: JetUserTravelerInstance}} travMap
     * @param {JetInfos} infos */
    createResponses(travMap, infos = {userAddressMap: {}, travAddressMap: {}}){
      const arrayForm = Object.keys(this.map).map(taskId=> this.map[taskId]);
      
      if(!arrayForm.length)
        return [];

      if(TASK_ASSEMBLER_TYPE.provisionals.includes(this.type))
        arrayForm.sort((e1,e2) => e1.task.earliestDateTimeCompare(e2.task));
      else
        arrayForm.sort((e1,e2) => e1.task.dateTimeCompare(e2.task));
      
      switch(this.type){
      case 'ownTask':
        return arrayForm.map(entry => entry.task.createPrivateResponse(entry.userRef,travMap,infos));

      case 'otherTask':
        return arrayForm.map(entry =>entry.task.createResponse(entry.userRef,travMap));
      
      case 'ownProvTask':
        return arrayForm.map(entry => entry.task.createPrivateProvisionalResponse(entry.userRef,travMap,infos));
      
      case 'otherProvTask':
        return arrayForm.map(entry => entry.task.createProvisionalResponse(entry.userRef,travMap));

      default: return [];
      }
    }
  }

  return TaskAssembly;
};