
const REGIONS = require('../utils/commonFields').REGIONS;

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;

  // DEFINITION
  /** @type {JetCountryModel} */
  const countryModel = sequelize.define('Country', {
    code: { 
      type: SeqTypes.CHAR(2),
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: SeqTypes.STRING(50),
      allowNull: false
    },
    region: {
      type: SeqTypes.ENUM,
      values: REGIONS,
      allowNull: false
    },
    local_name: {type: SeqTypes.STRING(50)},
    phone: {type: SeqTypes.STRING(3)},
    flag_emoji: {type: SeqTypes.CHAR(2)},
    pic: {type: SeqTypes.INTEGER},
    has_states: {type: SeqTypes.BOOLEAN, defaultValue: false},
    state_title: {type: SeqTypes.STRING(20)}
  }, {
    underscored: true,
    timestamps: false
  });


  // MODEL STATIC METHODS
  countryModel.associate = function(models){
    /** @type {JetCurrencyModel} */
    const currencyModel = models['Currency'];

    this.belongsTo(currencyModel, {foreignKey: 'currency_id'});


    /** @type {JetLanguageModel} */
    const languageModel = models['Language'];

    const countriesNamesModel = sequelize.define('CountriesNames', {
      name: {type: SeqTypes.STRING(20), allowNull: false}
    }, {
      underscored: true
    });

    this.belongsToMany(languageModel,{through: countriesNamesModel});
    languageModel.belongsToMany(this,{through: countriesNamesModel});
  };


  return countryModel;
};
