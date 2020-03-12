const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetTravelerPhoneModel} */
  const travelerPhoneModel = sequelize.define('TravelersPhones', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}                
    },
    alias: {type: SeqTypes.STRING(20)}
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  travelerPhoneModel.associate = function(models){
    this.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    this.belongsTo(models.Phone, {foreignKey: 'phone_id'});
  };

  // MODEL METHODS
  travelerPhoneModel.createMap = function(travId, travPhoneIds){
    if(travPhoneIds.length){
      return travelerPhoneModel.findAll({
        attributes: resAttr.TRAVELER_PHONE_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: travPhoneIds}},
            {traveler_id: travId}
          ]
        }
      }).then(travPhones => {
        const map = {};

        travPhones.forEach(travPhone => {
          map[travPhone.id] = travPhone;
        });

        return map;
      });

    } else {
      return Promise.resolve({}); 
    }
  };

  /** @param {JetPhoneRequest} fields */
  travelerPhoneModel.prototype.updateAndSaveFromFields = function(fields){

    /** @type {JetTravelerPhoneInstance} */
    const travelerPhone = this;
    let hasChange = false;

    if(typeof fields.alias === 'string' && fields.alias !== travelerPhone.alias){
      travelerPhone.alias = fields.alias;
      hasChange = true;
    }

    return hasChange ? travelerPhone.save() : Promise.resolve(travelerPhone);
  };

  return travelerPhoneModel;
};