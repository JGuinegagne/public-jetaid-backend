const resAttr = require('../utils/commonResAttr');

/** @type {<T>(entries: Array<T>) => Array<T>}*/
const uniques = (entries) => {
  const out = {};

  entries.forEach(entry => out[entry] = true);
  return Object.keys(out);
};

const BOOKING_STATUS = require('../utils/commonFields').BOOKING_STATUSES;

// NOTES
// n-m association between via and traveler
// Also known as "passenger"

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetViaTravelerModel} */
  const viaTravelerModel = sequelize.define('ViasTravelers', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    booking_status: {
      type: SeqTypes.ENUM,
      values: BOOKING_STATUS
    },
    volunteer: {
      type: SeqTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    underscored: true,
    name: {singular: 'ViaTraveler', plural: 'ViasTravelers'}
  });
  

  /** @param {JetModels} models */
  viaTravelerModel.associate = function(models){
    viaTravelerModel.belongsTo(models.Via, {foreignKey: 'via_id'});
    viaTravelerModel.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});

    // MODEL METHODS REQUIRING MODELS
    viaTravelerModel.beforeBulkDestroy('cascadeRiderTasker',async ({where}) => {
      if(where && where.id){
        try{
          const paxIds = where.id[Op.in] ? where.id[Op.in] : [where.id];

          const [riders,passengers] = await Promise.all([
            models.RidersTravelers.findAll({
              where: {via_traveler_id: {[Op.in]: paxIds}},
              attributes: resAttr.RIDER_TRAVELER_ATTRIBUTES
              
            }).then(ridersTravelers => {
              const riderIds = uniques(ridersTravelers.map(rt => rt.rider_id));

              if(riderIds.length) {
                return models.Rider
                  .findAll(Object.assign({where: {via_id: {[Op.in]: paxIds}}}, models.queries.FETCH_RIDER_PASSENGERCASCADE))
                  .then(riders => {
                    riders.forEach(rider => {
                      rider.TravelerLinks = rider.TravelerLinks.filter(tl => !ridersTravelers.find(rt => rt.id === tl.id));
                    });

                    return riders;
                  });

              } else {
                /** @type {Array<JetRiderInstance>} */const riders = [];
                return Promise.resolve(riders);
              }
            }),
            models.ViasTravelers.findAll(Object.assign({where: {via_id: {[Op.in]: paxIds}}},models.queries.FETCH_PASSENGER_VIACASCADE))
          ]);

          // rider which have no traveler left should be removed
          const emptyRiders = riders.filter(r => r.TravelerLinks.length === 0);

          // TODO, handle case of riders which still have travelers (update the rides capabilities)
          // const reducedRiders = riders.filter(r => r.TravelerLinks.length);

          return models.sequelize.transaction(t => {

            return Promise.all([
              models.handlers.ride
                .cascade(emptyRiders,t)
                .then(() => Promise.all(emptyRiders.map(rider => rider.destroy({transaction: t})))), // <-- will delete the address
              
              models.handlers.task.cascade(passengers,t)
            ]);
          });

        } catch(error){
          return Promise.reject(error);
        }
      }

      return Promise.resolve();
    });
    

    // INSTANCE METHODS REQUIRING MODELS
    viaTravelerModel.prototype.buildMember = function(task,status){
      /** @type {JetViaTravelerInstance} */
      const passenger = this;

      if(task.Members && task.Members.find(member => member.TasksViasTravelers.traveler_id === passenger.traveler_id))
        throw new Error('viaTraveler: The traveler is already a member');
  
      if(task.TasksViasTravelers && task.TasksViasTravelers.find(pax => pax.traveler_id === passenger.traveler_id))
        throw new Error('viaTraveler: The traveler is already a member');
  
      let taskId = task.id;
      if(!taskId){
        if(task.Beneficiaries && task.Beneficiaries.length)
          taskId = task.Beneficiaries[0].TasksTravelers.task_id;
        
        else if(task.Members && task.Members.length)
          taskId = task.Members[0].TasksViasTravelers.task_id;
  
        else if(task.TasksViasTravelers && task.TasksViasTravelers.length)
          taskId = task.TasksViasTravelers[0].task_id;
        
        else if(task.TasksTravelers && task.TasksTravelers.length)
          taskId = task.TasksTravelers[0].task_id;
  
        else throw new Error('viaTraveler: The task id could not be retrieved from the task');
      }
  
      const member = models.TasksViasTravelers.build({
        task_id: taskId,
        via_id: passenger.via_id,
        traveler_id: passenger.traveler_id,
        via_traveler_id: passenger.id,
        status
      });

      member.Traveler = passenger.Traveler;
      member.via = passenger.via
      return member;
    };

    // <-- END of METHODS REQUIRING MODELS
  };

  // MODEL METHODS
  viaTravelerModel.buildFromRequest = function(viaRequest){
    const via = viaRequest.via;

    return viaRequest.travelers.map(viaTravReq => {
      return viaTravelerModel.build({
        via_id: via.id,
        traveler_id: viaTravReq.userTraveler.traveler_id,
        volunteer: viaTravReq.volunteer,
        booking_status: BOOKING_STATUS[0]
      });
    });
  };

  viaTravelerModel.updateFromRequest = function(viaRequest){
    if(!viaRequest.update || viaRequest.update === 'del' || viaRequest.update === 'idm')
      throw new Error('ViaTravelers: updateFromRequest must be called on a via whose change status is "chg" or "add"');

    const via = viaRequest.via;
    const curPassengers = via.ViasTravelers || [];
    const allTravelerIds = viaRequest.travelers.map(travReq => travReq.userTraveler.traveler_id);

    const out = {};

    out.delPassengers = curPassengers.filter(pax=> !allTravelerIds.includes(pax.traveler_id));
    
    out.newPassengers = allTravelerIds
      .filter(travId => !curPassengers.find(pax => pax.traveler_id === travId))
      .map(travId => {
        const paxRequest = viaRequest.travelers.find(req => req.userTraveler.traveler_id === travId);
        return  viaTravelerModel.build({
          via_id: via.id,
          traveler_id: travId,
          volunteer: paxRequest.volunteer,
          booking_status: BOOKING_STATUS[0]
        });
      });
    
    out.chgPassengers = curPassengers
      .filter(pax => !!allTravelerIds.includes(pax.traveler_id))
      .filter(pax => {
        const paxReq = viaRequest.travelers.find(req => req.userTraveler.traveler_id === pax.traveler_id);
        
        if(paxReq.volunteer !== pax.volunteer){
          pax.volunteer = paxReq.volunteer;
          return true;
        }
        return false;
      });

    return out;
  };


  // INSTANCE METHODS
  /** @param {JetTaskInstance} task
   * @param {JetErrors} errors*/
  viaTravelerModel.prototype.isCompatible = function(task,errors,ind = 0){
    /**@type {JetViaTravelerInstance} */
    const passenger = this;

    if(!passenger.Via){
      errors.errors[`passenger${ind}`] = 'isCompatible: passenger\'s via must be populated';
      return false;
    }

    return passenger.Via.isCompatible(task,errors,ind);
  };


  /** @param {{[travId: string]: JetUserTravelerInstance}} travMap */
  viaTravelerModel.prototype.createPassengerResponse = function(travMap = {}){
    /** @type {JetViaTravelerInstance} */
    const passenger = this;
    
    const traveler = passenger.Traveler;
    const via = passenger.via;

    if(traveler && via){
      traveler.ViasTravelers = passenger;
      traveler.UsersTravelers = travMap[passenger.traveler_id];
      delete passenger.Traveler;

      /** @type {JetPassengerResponse} */
      const viaTravResp = Object.assign({passenger: traveler.createViaResponse()},via.createPassengerViaResponse());
      delete viaTravResp.ordinal;
      return viaTravResp;
    } else
      throw new Error('ViaTraveler: passenger.Traveler and passenger.via must be populated');
  };


  /** 
   * @param {{[travId: string]: JetUserTravelerInstance}} travMap
   * @param {JetInfos} infos*/
  viaTravelerModel.prototype.createPassengerFindResponse = function(travMap = {}, infos = {}){
    /** @type {JetViaTravelerInstance} */
    const passenger = this;
    
    const traveler = passenger.Traveler;
    const via = passenger.via;

    if(traveler && via){
      traveler.ViasTravelers = passenger;
      traveler.UsersTravelers = travMap[passenger.traveler_id];
      delete passenger.Traveler;

      /** @type {JetPassengerResponse} */
      const viaTravResp = Object.assign({passenger: traveler.createViaResponse()},via.assemblePassengerViaResponse(infos));
      delete viaTravResp.ordinal;
      return viaTravResp;
    } else
      throw new Error('ViaTraveler: passenger.Traveler and passenger.via must be populated');
  };

  return viaTravelerModel;
};
