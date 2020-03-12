const moment = require('moment');

const CONVO_TYPES = require('../utils/commonFields').CONVO_TYPES;
const MESSAGE_STATUS = require('../utils/commonFields').MESSAGE_STATUS;

module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;

  /** @type {JetConvoModel} */
  const convoModel = sequelize.define('Convo',{
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}       
    },
    type: {
      type: SeqTypes.ENUM,
      values: CONVO_TYPES.values,
      defaultValue: CONVO_TYPES.values,
      allowNull: false
    }
  },{
    underscored: true
  });

  /**@param {JetModels} models */
  convoModel.associate = function(models){
    
    this.belongsTo(models.Ride, {foreignKey: 'ride_id'});
    this.belongsTo(models.RidesRiders, {foreignKey: 'ride_rider_id'});

    this.belongsTo(models.Task, {foreignKey: 'task_id'});
    this.belongsTo(models.TasksViasTravelers, {foreignKey: 'task_via_traveler_id'});

    this.hasMany(models.Message, {foreignKey: 'convo_id'});

    // INSTANCE METHODS REQUIRING MODELS
    /** 
     * @param {JetRideInstance} ride
     * @param {JetRideRiderInstance} rideRider
     * @param {JetMessageRequest} msgReq
     * @param {string} authorId
     * @param {JetErrors} errors*/
    convoModel.prototype.createRideRiderMessage = function (ride, rideRider, msgReq, authorId, errors){
      const msg = models.Message.buildFromRequest(this,msgReq,authorId,errors);
      if(!msg){
        return Promise.reject(errors);
      }

      const msgRiders = ride.getAdminRiderIds();
      if(!msgRiders.includes(rideRider.rider_id)){
        msgRiders.push(rideRider.rider_id);
      }
      
      return seq.transaction(t => {
        return Promise.all([
          msg.save({transaction: t}),
          models.RidersUsers.createRiderUserRiderMap(msgRiders)
        
        ]).then(([newMsg,map]) => {
          const assocReqs = [];
          const mappedUsers = {};

          Object.keys(map).forEach(riderId => {
            const riderUsers = map[riderId];
  
            riderUsers.forEach(riderUser => {
              if(!mappedUsers[riderUser.user_id]){
                assocReqs.push(models.MessagesUsers.create({
                  user_id: riderUser.user_id,
                  message_id: msg.id,
                  status: riderUser.user_id === authorId 
                    ? MESSAGE_STATUS.sent 
                    : MESSAGE_STATUS.pending
                },{transaction: t}));

                mappedUsers[riderUser.user_id] = true;
              }
            });
          });
    
          return Promise.all(assocReqs).then(() => newMsg);
        });
      }).then(newMsg => (newMsg))
        .catch(error => (Promise.reject(error)));
    };


    /** 
     * @param {JetTaskInstance} task
     * @param {JetTaskViaTravelerInstance} tasker
     * @param {JetMessageRequest} msgReq
     * @param {string} authorId
     * @param {JetErrors} errors*/
    convoModel.prototype.createTaskTaskerMessage = function(task, tasker, msgReq, authorId, errors){
      const msg = models.Message.buildFromRequest(this,msgReq,authorId,errors);

      if(!msg)
        return Promise.reject(errors);

      const benefTravIds = task.getBeneficiaryTravelerIds();
      if(!benefTravIds.includes(tasker.traveler_id))
        benefTravIds.push(tasker.traveler_id);

      return seq.transaction(t => {
        return Promise.all([
          msg.save({transaction: t}),
          models.UsersTravelers.createTravsUsersMap(benefTravIds)
        
        ]).then(([newMsg,travUsersTravMap]) => {
          const userIds = {};
          Object.keys(travUsersTravMap).forEach(travId => {
            travUsersTravMap[travId].forEach(userTrav => userIds[userTrav.user_id] = true);
          });

          return Promise.all([
            ...Object.keys(userIds)
              .map(userId => models.MessagesUsers.create({
                user_id: userId,
                message_id: msg.id,
                status: userId === msg.author_id
                  ? MESSAGE_STATUS.sent
                  : MESSAGE_STATUS.pending
              },{transaction: t}))
          ]).then(() => newMsg);
        });
      }).then(newMsg => newMsg)
        .catch(error => Promise.reject(error));
    };

    // <-- END of METHODS REQUIRING MODELS
  };

  // MODEL METHODS
  convoModel.buildRideRiderConvo = function(rideRider){
    return convoModel.build({
      ride_rider_id: rideRider.id,
      type: CONVO_TYPES.rideRider
    });
  };

  convoModel.createRideRiderConvo = function(rideRider){
    return convoModel.create({
      ride_rider_id: rideRider.id,
      type: CONVO_TYPES.rideRider
    });
  };

  convoModel.createTaskTaskerConvo = function(tasker){
    return convoModel.create({
      task_via_traveler_id: tasker.id,
      type: CONVO_TYPES.tasker
    });
  };


  // INSTANCE METHODS
  /** @param {string} userId
   * @param {JetRideRiderInstance} ownRideRider
   * @param {Array<JetRiderInstance>} riders
   * @param {{[riderId: string]: Array<JetRiderUserInstance>}} riderUserRiderMap
   * @param {string} coRiderRef
   * @param {Array<string>} coRiderUsers*/
  convoModel.prototype.createRideRiderResponse = function(userId, ownRideRider, riders, riderUserRiderMap, coRiderRef = null, coRiderUsers = []){
    /** @type {JetConvoInstance} */
    const convo = this;

    /** @type {Array<JetRideMessageResponse>} */
    const resp = [];

    /** @type {(rider: JetRiderInstance) => string} */
    const getRiderId = riders && riders.length
      ? riders[0].id
        ? rider => (rider.id)
        : rider => rider.RidesRiders.rider_id
      : () => null;

    /** Finds all matching riders from the traveler and the provider trav_id->userTrav map
     * @type {(authorId: string) => Array<JetRiderInstance>} */
    const findRiders = riders && riders.length && riderUserRiderMap
      ? authorId => {
        const authorRiders = [];
        riders.forEach(rider => {
          const riderId = getRiderId(rider);
          const riderUsers = riderId ? riderUserRiderMap[riderId] : null;
          if(riderUsers && !!riderUsers.find(riderUser => riderUser.user_id === authorId)){
            authorRiders.push(rider);
          }
        });

        return authorRiders;
      } : () => [];

    convo.Messages.sort((m1,m2) => m1.postedTimeCompare(m2)); // <-- should be ordered already, but in case it is not
    convo.Messages.forEach(message => {
      // fetch either the current user or the most senior rider in this ride which has a connection to the message author
      let msgRef = null;
      
      if(message.Author.id === userId)
        msgRef = ownRideRider.id;
      
      else if(coRiderRef && coRiderUsers.includes(message.Author.id))
        msgRef = coRiderRef;

      else {
        const curRideRiders = findRiders(message.Author.id)
          .sort((r1,r2)=> r1.RidesRiders.compareTo(r2.RidesRiders))
          .map(rider => rider.RidesRiders.id);
        
        msgRef = curRideRiders.length ? curRideRiders[0] : null;
      }


      /** @type {JetRideMessageResponse} */ 
      const msgResp = {
        ref: msgRef,
        authorName: message.Author ? message.Author.public_name : null,
        timeStamp: moment(message.posted_at).format('YYYY-MM-DD HH:mm:ss'),
        content: message.content
      };

      resp.push(msgResp);
    });

    return resp;
  };

  
  /** @param {string} userId
   * @param {JetTaskViaTravelerInstance} ownMember
   * @param {JetTaskTravelerInstance} ownBeneficiary
   * @param {JetTaskInstance} task*/
  convoModel.prototype.createTaskTaskerResponse = function(userId, ownMember, ownBeneficiary, task){
    /** @type {JetConvoInstance} */
    const convo = this;

    const beneficiaries = task.TasksTravelers
      ? task.TasksTravelers
      : task.Beneficiaries
        ? task.Beneficiaries.map(traveler => traveler.TasksTravelers)
        : [];

    const members = task.TasksViasTravelers
      ? task.TasksViasTravelers
      : task.Members
        ? task.Members.map(member => member.TasksViasTravelers)
        : [];

    convo.Messages.sort((m1,m2) => m1.postedTimeCompare(m2));
    return convo.Messages.map(message => {

      /**@type {string} */ let memberRef;
      /**@type {string} */ let beneficiaryRef;
      /**@type {string} */ let authorName;
      if(message.author_id){
        if(message.author_id === userId){
          memberRef = ownMember ? ownMember.id : null;
          beneficiaryRef = ownBeneficiary ? ownBeneficiary.id : null;
          const taskUser = task.taskUsersMap ? task.taskUsersMap[userId] : null;
          authorName = taskUser && taskUser.User ? taskUser.User.public_name : null;

        } else {
          const authId = message.author_id;
          const taskUser = task.taskUsersMap ? task.taskUsersMap[authId] : null;

          if(taskUser){
            const authTravMap = {};
            taskUser.User.TravelerLinks.forEach(userTrav => authTravMap[userTrav.traveler_id] = true);
            authorName = taskUser.User.public_name;

            const eligibleMembers = members
              .filter(member => !!authTravMap[member.traveler_id])
              .sort((m1,m2) => m1.statusCompare(m2));

            const eligibleBeneficiaries = beneficiaries
              .filter(beneficiary => !!authTravMap[beneficiary.traveler_id])
              .sort((b1,b2) => b1.createdAtCompare(b2));

            memberRef = eligibleMembers.length ? eligibleMembers[0].id : null;
            beneficiaryRef = eligibleBeneficiaries.length ? eligibleBeneficiaries[0].id : null;
          }
        }
      }
      
      /** @type {JetTaskerMessageResponse} */
      const msgResp = {
        memberRef,
        beneficiaryRef,
        authorName,
        timeStamp: moment(message.posted_at).format('YYYY-MM-DD HH:mm:ss'),
        content: message.content
      };

      return msgResp;
    });
  };


  return convoModel;
  
};