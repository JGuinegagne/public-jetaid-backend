const moment = require('moment'); 

// NOTES:
// n-m association between traveler and task
// This represents the potential "helpees" of a task - also known as "beneficiaries"
// These travelers may not have booked their trip yet, and thus not be associated to a via.

module.exports = function(sequelize,DataTypes) {

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetTaskTravelerModel} */
  const taskTravelerModel = sequelize.define('TasksTravelers',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4} 
    }    
  },{
    underscored: true
  });

  /** @param {JetModels} models */
  taskTravelerModel.associate = function(models){
    taskTravelerModel.belongsTo(models.Traveler,{foreignKey: 'traveler_id'});
    taskTravelerModel.belongsTo(models.Task,{foreignKey: 'task_id'});
  };

  // MODEL METHODS
  taskTravelerModel.buildFromProvisionalRequest = function(taskRequest){
    const task = taskRequest.task;

    return taskRequest.beneficiaries.map(travReq => {
      return taskTravelerModel.build({
        task_id: task.id,
        traveler_id: travReq.userTraveler.traveler_id
      });
    });
  };

  taskTravelerModel.updateProvisionalRequest = function(taskRequest){
    const task = taskRequest.task;

    /** @type {{[travId: string]: JetTaskTravelerInstance} */
    const curTravMap = {};
    task.TasksTravelers.forEach(taskTrav => curTravMap[taskTrav.traveler_id] = taskTrav);
    
    /** @type {{[travId: string]: boolean}} */
    const updTravMap = {};
    taskRequest.beneficiaries.forEach(beneficiary => updTravMap[beneficiary.userTraveler.traveler_id] = true);

    return {
      delTaskTravelerIds: Object.keys(curTravMap)
        .filter(travId => !updTravMap[travId])
        .map(travId => curTravMap[travId].id),
      newTaskTravelers: Object.keys(updTravMap)
        .filter(travId => !curTravMap[travId])
        .map(travId => taskTravelerModel.build({
          task_id: task.id,
          traveler_id: travId
        }))
    };
  };

  // INSTANCE METHODS
  /** @param {JetTaskTravelerInstance} oBeneficiary */
  taskTravelerModel.prototype.createdAtCompare = function(oBeneficiary){
    /** @type {JetTaskTravelerInstance} */ const beneficiary = this;

    let joinTime = moment(beneficiary.created_at);
    let oJoinTime = moment(oBeneficiary.created_at);

    if(!joinTime.isValid())
      joinTime = moment();

    if(!oJoinTime.isValid())
      oJoinTime = moment();

    const diff = joinTime.diff(oJoinTime,'ms');

    if(diff !== 0)
      return diff;
    else
      return beneficiary.id.localeCompare(oBeneficiary.id);
  };

  /** @param {{[travelerId: string]: JetTravelerInstance}} travelerIdMap*/
  taskTravelerModel.prototype.toBeneficiary = function(travelerIdMap){
    /** @type {JetTaskTravelerInstance} */ const taskTrav = this;

    const traveler = travelerIdMap[taskTrav.traveler_id];
    if(!traveler)
      throw new Error('TaskTraveler: traveler could not be found');

    const beneficiary = Object.assign({},traveler);
    Object.setPrototypeOf(beneficiary,traveler);

    beneficiary.TasksTravelers = taskTrav;
    return beneficiary;
  };

  

  return taskTravelerModel;

};