const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetUserPhoneModel} */
  const userPhoneModel = sequelize.define('UsersPhones', {
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
  userPhoneModel.associate = function(models){
    this.belongsTo(models.User, {foreignKey: 'user_id'});
    this.belongsTo(models.Phone, {foreignKey: 'phone_id'});
  };

  // MODEL METHODS
  userPhoneModel.createMap = function(userId, userPhoneIds){
    if(Array.isArray(userPhoneIds) && userPhoneIds.length){
      return userPhoneModel.findAll({
        attributes: resAttr.USER_PHONE_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: userPhoneIds}},
            {user_id: userId}
          ]
        }
      }).then(userPhones => {
        const map = {};

        userPhones.forEach(userPhone => {
          map[userPhone.id] = userPhone;
        });

        return map;
      });

    } else {
      return Promise.resolve({}); 
    }
  };

  // MODEL METHODS
  /** @param {JetPhoneRequest} fields */
  userPhoneModel.prototype.updateAndSaveFromFields = function(fields){

    /** @type {JetUserPhoneInstance} */
    const userPhone = this;
    let hasChange = false;

    if(typeof fields.alias === 'string' && fields.alias !== userPhone.alias){
      userPhone.alias = fields.alias;
      hasChange = true;
    }

    return hasChange ? userPhone.save() : Promise.resolve(userPhone);
  };

  return userPhoneModel;
};