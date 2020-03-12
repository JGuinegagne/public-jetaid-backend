const resAttr = require('../utils/commonResAttr');

const HELP_STATUS = require('../utils/commonFields').HELP_STATUS;

module.exports = function(sequelize,DataTypes) {

  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetTaskUserModel} */
  const taskUserModel = sequelize.define('TasksUsers',{
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
  taskUserModel.associate = function(models){
    taskUserModel.belongsTo(models.User,{foreignKey: 'user_id'});
    taskUserModel.belongsTo(models.Task,{foreignKey: 'task_id'});

    taskUserModel.createTaskUsersMap = function(taskId){
      return taskUserModel.findAll({
        where: {task_id: taskId},
        attributes: models.queries.FETCH_TASK_USERS.attributes,
        include: models.queries.FETCH_TASK_USERS.include
      }).then(taskUsers => {
        const outMap = {};
  
        taskUsers.forEach(taskUser => outMap[taskUser.user_id] = taskUser);
        return outMap;
      });
    };


    taskUserModel.buildTaskUsers = async function(newMembers, taskUsersMap = {}, travsUsersMap = {}){
      if(!newMembers.length)
        return Promise.resolve([]);

      const taskId = newMembers[0].task_id;

      if(newMembers.some(m => m.task_id !== taskId))
        return Promise.reject({taskUsers: 'buildTaskUsers: all newMembers must belong to the same task'});

      const newTravIds = newMembers.map(m => m.traveler_id);
      const missingTravIds = newTravIds
        .filter(travId => !travsUsersMap[travId]);
  
      try{
        await Promise.all([
          missingTravIds.length
            ? models.UsersTravelers
              .createTravsUsersMap(missingTravIds)
              .then(missingMap => Object.assign(travsUsersMap,missingMap))
            : Promise.resolve(travsUsersMap),
          !Object.keys(taskUsersMap)
            ? taskUserModel
              .createTaskUsersMap(newMembers[0].task_id)
              .then(map => taskUsersMap = map)
            : Promise.resolve(taskUsersMap)
        ]);

        if(missingTravIds.length){
          Object.assign(travsUsersMap, await models.UsersTravelers.createTravsUsersMap(missingTravIds));
        }

        const missingUserIds = {};
        newTravIds.forEach(travId => {
          const userTravelers = travsUsersMap[travId];
          userTravelers.forEach(userTrav => {
            if(!taskUsersMap[userTrav.user_id])
              missingUserIds[userTrav.user_id] = true;
          });
        });

        return Object.keys(missingUserIds).map(userId => taskUserModel.build({
          user_id: userId,
          task_id: taskId
        }));
  
      } catch(error){
        return Promise.reject(error);
      }
    };


    taskUserModel.updateTaskUsers = async function(task, updTaskViaTravelers = [], updTaskTravelers = [], travUsersMap = {}){
      const allTravIds = {};
      updTaskViaTravelers.forEach(m => allTravIds[m.traveler_id] = true);
      updTaskTravelers.forEach(m => allTravIds[m.traveler_id] = true);

      const taskId = updTaskViaTravelers.length
        ? updTaskViaTravelers[0].task_id
        : updTaskTravelers.length
          ? updTaskTravelers[0].task_id
          : task.id;

      if(!taskId)
        throw new Error('taskUser: updateTaskUsers() could not retrieve the task id');

      try{
        const [taskUserMap] = await Promise.all([
          taskUserModel.findAll({
            where: {task_id: taskId},
            attributes: resAttr.TASK_USER_ATTRIBUTES
          }).then(taskUsers => {
            /** @type {{[userId: string]: JetTaskUserInstance}} */
            const outMap = {};
            taskUsers.forEach(taskUser => outMap[taskUser.user_id] = taskUser);
            return outMap;
          }),
          Object.keys(allTravIds).every(id => !!travUsersMap[id])
            ? Promise.resolve(travUsersMap)
            : models.UsersTravelers
              .createTravsUsersMap(Object.keys(allTravIds).filter(id => !travUsersMap[id]))
              .then(addlMap => {
                Object.keys(addlMap).forEach(travId => {
                  travUsersMap[travId] = addlMap[travId];
                });
              })
        ]);

        
        const allUserIds = {};
        allTravIds.forEach(travId => {
          const travUsers = travUsersMap[travId];
          travUsers.forEach(travUser => allUserIds[travUser.user_id] = true);
        });

        const newTaskUsers = Object.keys(allUserIds)
          .filter(userId => !!taskUserMap[userId])
          .map(userId => taskUserModel.build({
            task_id: taskId,
            user_id: userId
          }));

        const delTaskUserIds = Object.keys(taskUserMap)
          .filter(userId => !!allUserIds[userId]);

        return {delTaskUserIds, newTaskUsers};

      } catch(error){
        return Promise.reject(error);
      }

    }; // <-- END of METHODS REQUIRING MODELS
  };

  
  // MODEL METHODS
  taskUserModel.buildFromProvisionalRequest = function(taskRequest, travUsersMap){
    const task = taskRequest.task;
    const userIds = {};

    taskRequest.beneficiaries.forEach(beneficiaryReq => {
      const travUsers = travUsersMap[beneficiaryReq.userTraveler.traveler_id];
      travUsers.forEach(travUser => userIds[travUser.user_id] = true );
    });

    return Object.keys(userIds).map(userId => {
      return taskUserModel.build({
        task_id: task.id,
        user_id: userId
      });
    });
  };

  taskUserModel.buildFromViaRequest = function(taskRequest, travUsersMap){
    const task = taskRequest.task;
    const userIds = {};

    taskRequest.members.forEach(memberReq => {
      const travUsers = travUsersMap[memberReq.viaTraveler.traveler_id];
      travUsers.forEach(travUser => userIds[travUser.user_id] = true );
    });

    return Object.keys(userIds).map(userId => {
      return taskUserModel.build({
        task_id: task.id,
        user_id: userId
      });
    });
  };

  taskUserModel.updateFromViaRequest = function(taskRequest, travUsersMap){
    const task = taskRequest.task;

    /** @type {{[userId: string]: JetTaskUserInstance}} */
    const curUserTaskMap = {};
    task.TasksUsers.forEach(taskUser => curUserTaskMap[taskUser.user_id] = taskUser);

    /** @type {{[travelerId: string]: JetTaskViaTravelerInstance}} */
    const beneficiaryMembers = {};
    /** @type {{[travelerId: string]: JetTaskViaTravelerInstance}} */
    const nonBeneficiaryMembers = {};

    task.via.ViasTravelers.forEach(viaTrav => {
      viaTrav.TasksViasTravelers
        .filter(taskViaTrav => taskViaTrav.status === HELP_STATUS.helpee && taskViaTrav.task_id === task.id)
        .forEach(taskViaTrav => beneficiaryMembers[taskViaTrav.traveler_id] = taskViaTrav);
    });

    task.TasksViasTravelers.forEach(taskViaTrav => nonBeneficiaryMembers[taskViaTrav.traveler_id] = taskViaTrav);

    const curBeneficiaryIds = Object.keys(beneficiaryMembers);
    const otherBeneficiaryIds = Object.keys(nonBeneficiaryMembers);
    const updatedBeneficiaryIds = taskRequest.members.map(member => member.viaTraveler.traveler_id);

    const curBeneficiaryUsers = {};
    curBeneficiaryIds.forEach(travId => {
      const users = travUsersMap[travId];
      users.forEach(userTrav => curBeneficiaryUsers[userTrav.user_id] = true);
    });

    const otherTravelerUsers = {};
    otherBeneficiaryIds.forEach(travId => {
      const users = travUsersMap[travId];
      users.forEach(userTrav => otherTravelerUsers[userTrav.user_id] = true);
    });

    const updatedBeneficiaryUsers = {};
    updatedBeneficiaryIds.forEach(travId => {
      const users = travUsersMap[travId];
      users.forEach(userTrav => updatedBeneficiaryUsers[userTrav.user_id] = true);
    });

    return {
      delTaskUserIds:  Object.keys(curBeneficiaryUsers)
        .filter(userId => !updatedBeneficiaryUsers[userId] && !otherTravelerUsers[userId])
        .map(delUserId => curUserTaskMap[delUserId] ? curUserTaskMap[delUserId].id : null)
        .filter(taskUserId => !!taskUserId),

      newTaskUsers: Object.keys(updatedBeneficiaryUsers)
        .filter(userId => !curBeneficiaryUsers[userId] && !otherTravelerUsers[userId])
        .map(userId => taskUserModel.build({
          user_id: userId,
          task_id: task.id
        }))
    };
  };

  taskUserModel.updateProvisionalRequest = function(taskRequest,travUsersMap){
    const task = taskRequest.task;

    /** @type {{[userId: string]: JetTaskUserInstance}} */
    const curUserTaskMap = {};
    task.TasksUsers.forEach(taskUser => curUserTaskMap[taskUser.user_id] = taskUser);

    const curBeneficiaryIds = task.TasksTravelers.map(taskTrav => taskTrav.traveler_id);
    const externalMemberIds = task.TasksViasTravelers.map(taskTrav => taskTrav.traveler_id);
    const updBeneficiaryIds = taskRequest.beneficiaries.map(beneficiary => beneficiary.userTraveler.traveler_id);

    const curBeneficiaryUsers = {};
    curBeneficiaryIds.forEach(travId => {
      const users = travUsersMap[travId];
      users.forEach(userTrav => curBeneficiaryUsers[userTrav.user_id] = true);
    });

    const extMemberUsers = {};
    externalMemberIds.forEach(travId => {
      const users = travUsersMap[travId];
      users.forEach(userTrav => extMemberUsers[userTrav.user_id] = true);
    });

    const updBeneficiaryUsers = {};
    updBeneficiaryIds.forEach(travId => {
      const users = travUsersMap[travId];
      users.forEach(userTrav => updBeneficiaryUsers[userTrav.user_id] = true);
    });

    return {
      delTaskUserIds: Object.keys(curBeneficiaryUsers)
        .filter(userId => !updBeneficiaryUsers[userId] && !extMemberUsers[userId])
        .map(delUserId => curUserTaskMap[delUserId] ? curUserTaskMap[delUserId].id : null)
        .filter(taskUserId => !!taskUserId),

      newTaskUsers: Object.keys(updBeneficiaryUsers)
        .filter(userId => !curBeneficiaryUsers[userId] && !extMemberUsers[userId])
        .map(userId => taskUserModel.build({
          task_id: task.id,
          user_id: userId
        }))
    };
  };

  taskUserModel.createUserTasksMap = function(userId){
    return taskUserModel.findAll({
      where: {user_id: userId},
      attributes: resAttr.TASK_USER_ATTRIBUTES
    }).then(taskUsers => {
      const outMap = {};

      taskUsers.forEach(taskUser => outMap[taskUser.task_id] = taskUser);
      return outMap;
    });
  };




  return taskUserModel;

};