const resAttr = require('../utils/commonResAttr');

const ADDRESS_TYPES = require('../utils/commonFields').ADDRESS_TYPES;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetTravelerAddressModel} */
  const travelerAddressModel = sequelize.define('TravelersAddresses', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    alias: {type: SeqTypes.STRING(20), allowNull: false},
    type: {
      type: SeqTypes.ENUM,
      values: ADDRESS_TYPES.values
    }
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  travelerAddressModel.associate = function(models){
    this.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    this.belongsTo(models.Address, {foreignKey: 'address_id'});

    //MODEL METHODS REQUIRING MODELS
    travelerAddressModel.createAddressMap = function(travAddressIds,travMap){
      if(!Array.isArray(travAddressIds) || !travAddressIds.length)
        return Promise.resolve({});

      return travelerAddressModel.findAll({
        where: {id: {[Op.in]: travAddressIds}},
        attributes: resAttr.TRAVELER_ADDRESS_ATTRIBUTES
      }).then(travAddresses => {
        const addressIds = [];

        travAddresses.forEach(travAddress => {
          if(travMap[travAddress.traveler_id]){
            addressIds.push(travAddress.address_id);
          }
        });

        return !addressIds.length
          ? []
          : models.Address.findAll({
            where: {id: {[Op.in]: addressIds}},
            attributes: resAttr.ADDRESS_EXTENDED_ATTRIBUTES
          }).then(addresses => {
            const map = {};
            
            travAddresses.forEach(travAddress => {
              /** @type {JetAddressInstance} */
              const address = addresses.find(address => address.id = travAddress.address_id);
              map[travAddress.id] = address;
              if(address){
                address.TravelersAddresses = travAddress;
              }
            });

            return map;
          });
      });
    };

    travelerAddressModel.createFullAddressMap = function(travelerIds){
      if(!Array.isArray(travelerIds) || !travelerIds.length)
        return Promise.resolve({});

      return travelerAddressModel.findAll({
        where: {traveler_id: {[Op.in]: travelerIds}},
        attributes: resAttr.TRAVELER_ADDRESS_ATTRIBUTES
      }).then(travAddresses => {
        const addressIds = {};

        travAddresses.forEach(travAddress => {
          if(!addressIds[travAddress.address_id]){
            addressIds[travAddress.address_id] = true;
          }
        });

        return !addressIds.length
          ? []
          : models.Address.findAll({
            where: {id: {[Op.in]: addressIds}},
            attributes: resAttr.ADDRESS_ATTRIBUTES,
            include: [{
              model: models.AddressInfo,
              attributes: resAttr.ADDRESS_INFO_ATTRIBUTES
            }]
          }).then(addresses => {
            const map = {};
            
            travAddresses.forEach(travAddress => {
              /** @type {JetAddressInstance} */
              const address = addresses.find(address => address.id = travAddress.address_id);
              map[travAddress.id] = address;
              if(address){
                address.TravelersAddresses = travAddress;
              }
            });

            return map;
          });
      });
    }; // <-- END of MODEL METHODS REQUIRING MODELS
  };

  // MODEL METHODS
  travelerAddressModel.createMap = function(travId, travAddressIds){
    if(Array.isArray(travAddressIds) && travAddressIds.length){
      return travelerAddressModel.findAll({
        attributes: resAttr.TRAVELER_ADDRESS_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: travAddressIds}},
            {traveler_id: travId}
          ]
        }
      }).then(travAddresses => {
        const map = {};

        travAddresses.forEach(travAddress => {
          map[travAddress.id] = travAddress;
        });

        return map;
      });

    } else {
      return Promise.resolve({}); 
    }
  };

  travelerAddressModel.createAddressMap = function(travIds, addressIds){
    if(!Array.isArray(travIds) || !travIds.length || !Array.isArray(addressIds) || !addressIds.length)
      return Promise.resolve({});

    return travelerAddressModel.findAll({
      attributes: resAttr.TRAVELER_ADDRESS_ATTRIBUTES,
      where: {
        [Op.and]: [
          {address_id: {[Op.in]: addressIds}},
          {traveler_id: {[Op.in]: travIds}}
        ]
      }
    }).then(travAddresses => {
      const map = {};
      travAddresses.forEach(travAddress => map[travAddress.id] = travAddress);
      return map;
    });
  };

  travelerAddressModel.findTravelersAddresses = function(travelerIds, addressIds){
    if(!Array.isArray(travelerIds) || !travelerIds.length || !Array.isArray(addressIds) || !addressIds.length)
      return Promise.resolve([]);

    return travelerAddressModel.findAll({
      attributes: resAttr.TRAVELER_ADDRESS_ATTRIBUTES,
      where: {
        [Op.and]: [
          {address_id: {[Op.in]: addressIds}},
          {traveler_id: {[Op.in]: travelerIds}}
        ]
      }
    });
  };

  
  // INSTANCE METHOD
  /** @param {JetReferencedAddressRequest} fields */
  travelerAddressModel.prototype.updateAndSaveFromFields = function(fields){

    /** @type {JetTravelerAddressInstance} */
    const travAddress = this;

    if(fields.references){
      let hasChange = false;

      if(typeof fields.references.alias === 'string' && fields.references.alias !== travAddress.alias){
        travAddress.alias = fields.references.alias;
        hasChange = true;
      }

      if(typeof fields.references.type === 'string'
        && ADDRESS_TYPES.values.includes(fields.references.type) 
        && fields.references.type !== travAddress.type){
        travAddress.type = fields.references.type;
        hasChange = true;
      }

      return hasChange ? travAddress.save() : Promise.resolve(travAddress);
    }

    return Promise.resolve(travAddress);
  };

  return travelerAddressModel;
};