module.exports = function(sequelize) {

  /** @type {JetTaskFlightModel} */
  const taskFlightModel = sequelize.define('TasksFlights',{},{underscored: true});
    
  /** @param {JetModels} models */
  taskFlightModel.associate = function(models){
    taskFlightModel.belongsTo(models.Flight,{foreignKey: 'flight_id'});
    taskFlightModel.belongsTo(models.Task,{foreignKey: 'task_id'});
  };

  // INSTANCE METHODS
  /** @param {{[flightId: string]: JetFlightInstance}} flightMap */
  taskFlightModel.prototype.toFlight = function(flightMap){
    /** @type {JetTaskFlightInstance}*/  const taskFlight = this;

    const flight = flightMap[taskFlight.flight_id];
    if(!flight)
      throw new Error('TaskFlight: flight could not be found');

    const provFlight = Object.assign({},flight);
    Object.setPrototypeOf(provFlight, flight);

    provFlight.TasksFlights = taskFlight;
    return provFlight;
  };
    
  return taskFlightModel;
};