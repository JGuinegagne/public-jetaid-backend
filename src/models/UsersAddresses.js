const resAttr = require('../utils/commonResAttr');

const ADDRESS_TYPES = require('../utils/commonFields').ADDRESS_TYPES;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetUserAddressModel} */
  const userAddressModel = sequelize.define('UsersAddresses', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    alias: {type: SeqTypes.STRING(8), allowNull: false},
    type: {
      type: SeqTypes.ENUM,
      values: ADDRESS_TYPES.values
    }
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  userAddressModel.associate = function(models){
    this.belongsTo(models.User, {foreignKey: 'user_id'});
    this.belongsTo(models.Address, {foreignKey: 'address_id'});

    // MODEL METHODS REQUIRING MODELS
    userAddressModel.createAddressMap = function(userId, userAddressIds){
      return userAddressModel.findAll({
        attributes: resAttr.USER_ADDRESS_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: userAddressIds}},
            {user_id: userId}
          ]
        },
        include: [{
          model: models.Address,
          attributes: resAttr.ADDRESS_EXTENDED_ATTRIBUTES
        }]
      }).then(userAddresses => {
        const map = {};

        userAddresses.forEach(userAddress => {
          const address = userAddress.Address;
          map[userAddress.id] = address;
          address.UsersAddresses = userAddress;
        });

        return map;
      });
    };

    userAddressModel.createFullAddressMap = function(userId){
      return userAddressModel.findAll({
        attributes: resAttr.USER_ADDRESS_ATTRIBUTES,
        where: {user_id: userId},
        include: [{
          model: models.Address,
          attributes: resAttr.ADDRESS_ATTRIBUTES,
          include: [{
            model: models.AddressInfo,
            attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
          }]
        }]
      }).then(userAddresses => {
        const map = {};

        userAddresses.forEach(userAddress => {
          const address = userAddress.Address;
          map[userAddress.id] = address;
          address.UsersAddresses = userAddress;
        });

        return map;
      });      
    };
  };

  // MODEL METHODS
  userAddressModel.createMap = function(userId, userAddressIds){
    if(Array.isArray(userAddressIds) && userAddressIds.length){
      return userAddressModel.findAll({
        attributes: resAttr.USER_ADDRESS_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: userAddressIds}},
            {user_id: userId}
          ]
        }
      }).then(userAddresses => {
        const map = {};

        userAddresses.forEach(userAddress => {
          map[userAddress.id] = userAddress;
        });

        return map;
      });

    } else {
      return Promise.resolve({}); 
    }
  };

  userAddressModel.findUserAddresses = function(userId, addressIds){
    if(!userId || userId.toString('hex') !== userId || !Array.isArray(addressIds) || !addressIds.length)
      return Promise.resolve([]);

    return userAddressModel.findAll({
      attributes: resAttr.USER_ADDRESS_ATTRIBUTES,
      where: {
        [Op.and]: [
          {address_id: {[Op.in]: addressIds}},
          {user_id: userId}
        ]
      }
    });
  };

  // INSTANCE METHOD
  /** @param {JetReferencedAddressRequest} fields */
  userAddressModel.prototype.updateAndSaveFromFields = function(fields){

    /** @type {JetUserAddressInstance} */
    const userAddress = this;

    if(fields.references){
      let hasChange = false;

      if(typeof fields.references.alias === 'string' && fields.references.alias !== userAddress.alias){
        userAddress.alias = fields.references.alias;
        hasChange = true;
      }

      if(typeof fields.references.type === 'string'
        && ADDRESS_TYPES.values.includes(fields.references.type) 
        && fields.references.type !== userAddress.type){
        userAddress.type = fields.references.type;
        hasChange = true;
      }

      return hasChange ? userAddress.save() : Promise.resolve(userAddress);
    }

    return Promise.resolve(userAddress);
  };



  return userAddressModel;
};