const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetTravelerEmailModel} */
  const travelerEmailModel = sequelize.define('TravelersEmails', {
    id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: SeqTypes.UUIDV4,
      validate: {isUUID: 4}                
    },
  }, {
    underscored: true
  });

  /** @param {JetModels} models */
  travelerEmailModel.associate = function(models){
    this.belongsTo(models.Traveler, {foreignKey: 'traveler_id'});
    this.belongsTo(models.Email, {foreignKey: 'email_id'});
  };

  // MODEL METHODS
  travelerEmailModel.createMap = function(travId, travEmailIds){
    if(travEmailIds.length){
      return travelerEmailModel.findAll({
        attributes: resAttr.TRAVELER_EMAIL_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: travEmailIds}},
            {traveler_id: travId}
          ]
        }
      }).then(travEmails => {
        const map = {};

        travEmails.forEach(travEmail => {
          map[travEmail.id] = travEmail;
        });

        return map;
      });

    } else {
      return Promise.resolve({}); 
    }
  };

  return travelerEmailModel;
};