
module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;
  
  /** @type {JetAddressInfoModel} */
  const addressInfoModel = sequelize.define('AddressInfo', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}
    },
    building_name: {type: SeqTypes.STRING},
    apartment_identifier: {type: SeqTypes.STRING(8)},
    floor_identifier: {type: SeqTypes.STRING(8)},
    postcode: {type: SeqTypes.STRING(8)},
    building_description: {type: SeqTypes.TEXT('medium')},
    access_description: {type: SeqTypes.TEXT('medium')},
    city: {type: SeqTypes.STRING(50)},
    state: {type: SeqTypes.STRING(50)},
  }, {
    underscored: true
  });


  // MODEL STATIC METHODS
  addressInfoModel.associate = function(models){
    /** @type {JetAddressModel} */
    const addressModel = models['Address'];

    this.belongsTo(addressModel,{foreignKey: 'address_id'});
    this.hasOne(addressModel, {foreingKey: 'address_info_id'});
  };

  addressInfoModel.buildFromFields = function(infos,address_id=null){
    return addressInfoModel.build({
      building_name: infos.buildingName ? infos.buildingName : null,
      apartment_identifier: infos.apartmentIdentifier ? infos.apartmentIdentifier : null,
      floor_identifier: infos.floorIdentifier ? infos.floorIdentifier : null,
      postcode: infos.postcode ? infos.postcode : null,
      building_description: infos.buildingDescription ? infos.buildingDescription : null,
      access_description: infos.accessDescription ? infos.accessDescription : null,
      city: infos.city ? infos.city : null,
      state: infos.state ? infos.state : null,
      address_id
    });
  };

  return addressInfoModel;
};