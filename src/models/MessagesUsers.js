const MESSAGE_STATUS = require('../utils/commonFields').MESSAGE_STATUS;

module.exports = function(sequelize,DataTypes) {
  
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetMessageUserModel} */
  const messageUserModel = sequelize.define('MessagesUsers',{
    message_id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false
    },  
    user_id: {
      type: SeqTypes.UUID,
      primaryKey: true,
      allowNull: false
    },
    status: {
      type: SeqTypes.ENUM,
      values: MESSAGE_STATUS.values,
      defaultValue: MESSAGE_STATUS.dft,
      allowNull: false,
    }
  },{
    underscored: true
  });

  /** @param {JetModels} models */
  messageUserModel.associate = function(models){
    messageUserModel.belongsTo(models.User, {foreignKey: 'user_id'});
    messageUserModel.belongsTo(models.Message, {foreignKey: 'message_id'});
  };

  return messageUserModel;
};