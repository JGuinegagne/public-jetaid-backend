const RIDER_STATUS = require('../utils/commonFields').RIDER_STATUS;

const resAttr = require('../utils/commonResAttr');
const fieldProps = require('../utils/fieldProperties');


module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetRideRiderModel} */
  const rideRiderModel = sequelize.define('RidesRiders', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4} 
    },
    status: {
      type: SeqTypes.ENUM, 
      values: RIDER_STATUS.values, 
      defaultValue: RIDER_STATUS.dft,
      allowNull: false
    },
    joined_at: {type: SeqTypes.DATE}
  },{
    underscored: true
  });

  /** @param {JetModels} models */  
  rideRiderModel.associate = async function(models){
    this.belongsTo(models.Ride, {foreignKey: 'ride_id'});
    this.belongsTo(models.Rider, {foreignKey: 'rider_id'});
    this.belongsTo(models.RideRiderRequest, {foreignKey: 'request_id', as: 'Request'});
    this.belongsTo(models.RideRiderRequest, {foreignKey: 'counter_id', as: 'Counter'});

    this.belongsTo(models.Convo, {foreignKey: 'convo_id'});

    // MODEL METHODS REQUIRING MODELS
    rideRiderModel.findApplicants = function(rideIds){
      if(!rideIds || !rideIds.length){
        return Promise.resolve([]);
      }

      return rideRiderModel.findAll({
        where: {
          [Op.and]: [
            {ride_id: {[Op.in]: rideIds}},
            {status: RIDER_STATUS.applied}
          ]
        },
        attributes: models.queries.FETCH_APPLICANT.attributes,
        include: models.queries.FETCH_APPLICANT.include

      }).then(applicants => {
        const applTravMap = {};
        applicants.forEach(appl => appl.Rider.TravelerLinks.forEach(applTrav => {
          if(!applTravMap[applTrav.traveler_id])
            applTravMap[applTrav.traveler_id] = true;
        }));

        return Object.keys(applTravMap).length
          ? models.Traveler.findAll({
            where: {id: {[Op.in]: Object.keys(applTravMap)}},
            attributes: resAttr.PUBLIC_TRAVELER_ATTRIBUTES.concat(['id'])
          }).then(travelers => {
            applicants.forEach(appl => {
              appl.Rider.Travelers = appl.Rider.TravelerLinks.map(applTrav => {
                const trav = travelers.find(_trav => _trav.id === applTrav.traveler_id);
                if(trav)
                  trav.RidersTravelers = applTrav;
                return trav;
              });
            });
            return applicants;
          })
          : applicants;
      });
    };


    // INSTANCE METHODS REQUIRING MODELS
    /** @param {{[travelerId: string]: JetUserTravelerInstance}} travUserTravMap*/
    rideRiderModel.prototype.createPublicResponse = function(travUserTravMap){
      
      /** @type {JetRideRiderInstance} */
      const rideRider = this;
      return models.Rider.createResponse(rideRider.Rider, rideRider, travUserTravMap, null);
    };

    /** @param {JetRideInstance} targetRide */
    rideRiderModel.prototype.findCurrentRide = async function(targetRide = null){
      try{
        if(RIDER_STATUS.riderUniques.includes(this.status))
          return Promise.resolve({curRideRider: this, curRide: targetRide});
  
        const curRideRider = await rideRiderModel.findOne({
          attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
          where: {[Op.and]: [
            {rider_id: this.rider_id},
            {status: {[Op.in]: RIDER_STATUS.riderUniques}}
          ]}
        });
  
        if(!curRideRider){
          return Promise.resolve({curRideRider, curRide: null});
        }
  
        const curRide = await models.Ride.findById(curRideRider.ride_id, models.queries.FETCH_SUSPENDED_RIDE);
        return {curRideRider,curRide};
  
      } catch(error){
        return Promise.reject(error);
      }
    };


    rideRiderModel.prototype.findSuspendRide = async function(toReset=false){
      try{
        const suspRideRider = await rideRiderModel.findOne({
          attributes: resAttr.RIDE_RIDER_ATTRIBUTES,
          where: { [Op.and]: [
            {rider_id: this.rider_id},
            {status: RIDER_STATUS.suspend}
          ]}
        });

        if(!suspRideRider){
          return Promise.resolve({suspRideRider, suspRide: null});
        }

        // --> inefficient in the case of toReset: 
        // found the rideRider, yet it fetches the rider through the rideRider again
        const suspRide = await models.Ride.findById(
          suspRideRider.ride_id,
          toReset 
            ? models.queries.FETCH_SUSPENDED_RIDE
            : {attributes: resAttr.RIDE_ACTIVATE_ATTRIBUTES}
        );

        return Promise.resolve({suspRideRider, suspRide});

      } catch(error){
        return Promise.reject(error);
      }
    };

  }; // <--- END OF METHODS REQUIRING MODELS


  // INSTANCE METHODS
  rideRiderModel.prototype.mayPersistRide = function(){
    return fieldProps.riderStatusAllowsPersist(this.status);
  };

  rideRiderModel.prototype.isMainRider = function(){
    return RIDER_STATUS.rideUniques.includes(this.status);
  };


  /** @param {JetRideInstance} ride
   * @param {JetTransaction} t*/
  rideRiderModel.prototype.upgrade = function(ride, t = null){
    if(!ride || typeof ride.status === 'undefined'){
      return Promise.resolve();
    }

    this.status = fieldProps.getCreatorRiderStatus(ride.status);
    const opt = {fields: ['status']};
    if(t){
      opt.transaction = t;
    }

    return this.save(opt);
  };


  /** @param {JetRideRiderInstance} o */
  rideRiderModel.prototype.compareTo = function(o){
    const p1 = fieldProps.getRiderStatusPriority(this.status);
    const op1 = fieldProps.getRiderStatusPriority(o.status);

    if(p1 !== op1)
      return p1 - op1;
    else
      return this.joined_at - o.joined_at;
  };


  /** @param {JetRideRiderInstance} applicant*
   * @param {JetRideRiderRequestInstance} request
   * @param {JetRideRiderRequestInstance} counter*/
  rideRiderModel.prototype.deny = function(applicant, request = null, counter = null){
    /** @type {JetRideRiderInstance} */
    const rejector = this;

    if(!applicant){
      return Promise.reject({rideRider: 'applicant to be rejected is null'});
    }

    if(applicant.status !== RIDER_STATUS.applied){
      return Promise.reject({rideRider: `rideRider.status of applicant to be rejected must be ${RIDER_STATUS.applied}, was ${applicant.status}`});
    }

    if(!fieldProps.riderStatusAllowsApprove(rejector.status)){
      return Promise.reject({rideRider: 'referenced rideRider is not authorized to reject this application'});
    }

    applicant.status = RIDER_STATUS.denied;

    return Promise.all([
      applicant.save({fields: ['status']}),
      request ? request.destroy() : Promise.resolve(null),
      counter ? counter.destroy() : Promise.resolve(null)
    ]).then(() => applicant);
  };

  
  /** @param {JetRideRiderInstance} applicant*/
  rideRiderModel.prototype.killoff = function(applicant){
    /** @type {JetRideRiderInstance} */
    const rejector = this;

    if(!applicant){
      return Promise.reject({rideRider: 'applicant to be rejected is null'});
    }
 
    const possibleStatus = [RIDER_STATUS.applied,RIDER_STATUS.denied];
    if(!possibleStatus.includes(applicant.status)){
      return Promise.reject({rideRider: `rideRider.status of applicant to be rejected must be ${possibleStatus.join(' / ')}, was ${applicant.status}`});
    }
 
    if(!fieldProps.riderStatusAllowsApprove(rejector.status)){
      return Promise.reject({rideRider: 'referenced rideRider is not authorized to reject this application'});
    }   
    
    return applicant.destroy();
  };


  // MODEL METHODS
  rideRiderModel.compareTo = function(r1, r2){
    return r1 && r2 ? r1.compareTo(r2) : 0;
  };

  return rideRiderModel;
};