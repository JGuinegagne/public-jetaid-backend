const VIA_BOUND = require('../utils/commonFields').VIA_BOUND;

module.exports = function(sequelize, DataTypes) {

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetTaskAirportModel} */
  const taskAirportModel = sequelize.define('TasksAirports',{
    bound: {
      type: SeqTypes.ENUM,
      values: VIA_BOUND.values,
      defaultValue: VIA_BOUND.dft,
      allowNull: false
    }
  },{underscored: true});
  
  /** @param {JetModels} models */
  taskAirportModel.associate = function(models){
    taskAirportModel.belongsTo(models.Airport,{foreignKey: 'airport_id'});
    taskAirportModel.belongsTo(models.Task,{foreignKey: 'task_id'});
    taskAirportModel.belongsTo(models.Neighborhood,{foreignKey: 'neighborhood_id'});
  };

  // MODEL METHODS
  taskAirportModel.buildFromRequest = function(taskRequest){
    const task = taskRequest.task;

    const depTaskAirports = taskRequest.depAirports.map(depAirptReq => {
      return taskAirportModel.build({
        task_id: task.id,
        airport_id: depAirptReq.airport.id,
        neighborhood_id: depAirptReq.hood ? depAirptReq.hood.id : null,
        bound: VIA_BOUND.departure
      });
    });

    const arrTaskAirports = taskRequest.arrAirports.map(arrAirportReq => {
      return taskAirportModel.build({
        task_id: task.id,
        airport_id: arrAirportReq.airport.id,
        neighborhood_id: arrAirportReq.hood ? arrAirportReq.hood.id : null,
        bound: VIA_BOUND.arrival
      });
    });

    return [
      ...depTaskAirports,
      ...arrTaskAirports
    ];
  };

  taskAirportModel.updateProvisionalRequest = function(taskRequest){
    const task = taskRequest.task;

    /** Current taskAirport instances in the database, split between departure / arrival categories
     * @type {{dep: {[airportId: string]: JetTaskAirportInstance}, arr: {[airportId: string]: JetTaskAirportInstance}}} */
    const curAirportMap = {
      dep: {},
      arr: {}
    };

    task.TasksAirports.forEach(taskAirport => {
      if(taskAirport.bound === VIA_BOUND.departure)
        curAirportMap.dep[taskAirport.airport_id] = taskAirport;

      else if (taskAirport.bound === VIA_BOUND.arrival)
        curAirportMap.arr[taskAirport.airport_id] = taskAirport;
    });


    /** Requested iatas for these tasks, split between departure / arrival categories
     * @type {{dep: {[airportId: string]: boolean, arr: {[airportId: string]: boolean}}}} */
    const remainingAirportMap = {
      dep: {},
      arr: {}
    };


    /** @type {Array<JetTaskAirportInstance>}*/
    const newTaskAirports = [];

    /** @type {Array<JetTaskAirportInstance>}*/
    const updTaskAirports = [];

    taskRequest.depAirports.forEach(airptReq => {
      const curEntry = curAirportMap.dep[airptReq.airport.id];
      const curHoodId = curEntry && typeof curEntry.neighborhood_id === 'number' ? curEntry.neighborhood_id : null;
      const newHoodId = airptReq.hood ? airptReq.hood.id : null;

      if(curEntry && curHoodId !== newHoodId){
        curEntry.neighborhood_id = newHoodId;
        updTaskAirports.push(curEntry);
      
      } else if(!curEntry){
        newTaskAirports.push(taskAirportModel.build({
          task_id: task.id,
          airport_id: airptReq.airport.id,
          bound: VIA_BOUND.departure,
          neighborhood_id: newHoodId
        }));
      }

      remainingAirportMap.dep[airptReq.airport.id] = true;
    });

    taskRequest.arrAirports.forEach(airptReq => {
      const curEntry = curAirportMap.arr[airptReq.airport.id];
      const curHoodId = curEntry && typeof curEntry.neighborhood_id === 'number' ? curEntry.neighborhood_id : null;
      const newHoodId = airptReq.hood ? airptReq.hood.id : null;

      if(curEntry && curHoodId !== newHoodId){
        curEntry.neighborhood_id = newHoodId;
        updTaskAirports.push(curEntry);
      
      } else if(!curEntry){
        newTaskAirports.push(taskAirportModel.build({
          task_id: task.id,
          airport_id: airptReq.airport.id,
          bound: VIA_BOUND.arrival,
          neighborhood_id: newHoodId
        }));
      }

      remainingAirportMap.arr[airptReq.airport.id] = true;
    });
    
    return { 
      delTaskAirports:  [
        ...Object.keys(curAirportMap.dep)
          .filter(iata => !remainingAirportMap.dep[iata])
          .map(iata => curAirportMap.dep[iata]),
        
        ...Object.keys(curAirportMap.arr)
          .filter(iata => !remainingAirportMap.arr[iata])
          .map(iata => curAirportMap.arr[iata])
      ],

      newTaskAirports,
      updTaskAirports
    };
  };


  // INSTANCE METHODS
  /** 
   * @param {{[airportId: string]: JetAirportInstance}} airportMap
   * @param {{[hoodId: number]: JetNeighborhoodInstance}} hoodMap*/
  taskAirportModel.prototype.toProvisionalAirport = function(airportIdMap, hoodIdMap){
    /** @type {JetTaskAirportInstance} */
    const taskAirport = this;

    const refAirport = airportIdMap[taskAirport.airport_id];

    if(!refAirport)
      throw new Error('taskAirport: airport could not be matched');
    
    const airport = Object.assign({},refAirport);
    Object.setPrototypeOf(airport,refAirport);
    airport.TasksAirports = taskAirport;

    const refHood = typeof taskAirport.neighborhood_id === 'number'
      ? hoodIdMap[taskAirport.neighborhood_id]
      : null;

    if(refHood){
      taskAirport.Neighborhood = Object.assign({},refHood);
      Object.setPrototypeOf(taskAirport.Neighborhood, refHood);
    }

    return airport;
  };
  
  return taskAirportModel;
};