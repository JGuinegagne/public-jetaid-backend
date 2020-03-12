const resAttr = require('../utils/commonResAttr');

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  const SeqTypes = DataTypes;

  /** @type {JetSequelize} */
  const seq = sequelize;
  const Op = seq.Op;

  /** @type {JetUserEmailModel} */
  const userEmailModel = sequelize.define('UsersEmails', {
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
  userEmailModel.associate = function(models){
    this.belongsTo(models.User, {foreignKey: 'user_id'});
    this.belongsTo(models.Email, {foreignKey: 'email_id'});
  };

  // MODEL METHODS
  userEmailModel.createMap = function(userId, userEmailIds){
    if(Array.isArray(userEmailIds) && userEmailIds.length){
      return userEmailModel.findAll({
        attributes: resAttr.USER_EMAIL_ATTRIBUTES,
        where: {
          [Op.and]: [
            {id: {[Op.in]: userEmailIds}},
            {user_id: userId}
          ]
        }
      }).then(userEmails => {
        const map = {};

        userEmails.forEach(userEmail => {
          map[userEmail.id] = userEmail;
        });

        return map;
      });

    } else {
      return Promise.resolve({}); 
    }
  };

  return userEmailModel;
};