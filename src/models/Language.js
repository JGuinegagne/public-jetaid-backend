
module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  // DEFINITION
  /** @type {JetLanguageModel} */
  const languageModel = sequelize.define('Language', {
    code: {
      type: SeqTypes.STRING(6),
      primaryKey: true,
      allowNull: false
    },
    name: {type: SeqTypes.STRING(50)},
    pic: {type: SeqTypes.INTEGER}
  }, {
    underscored: true,
    timestamps: false
  });

  return languageModel;
    
};