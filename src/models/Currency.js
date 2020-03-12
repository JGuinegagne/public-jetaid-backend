
module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  /** @type {JetCurrencyModel} */
  const currencyModel = sequelize.define('Currency', {
    code: {
      type: SeqTypes.CHAR(3),
      primaryKey: true,
      allowNull: false
    },
    name: {type: SeqTypes.STRING(50), allowNull: false},
    digit: {type: SeqTypes.INTEGER, allowNull: false, default: 2}
  }, {
    underscored: true,
    timestamps: false
  });

  return currencyModel;
};