const STATES_LOOKUP = {
  'england': 'ENG',
  'scotland': 'SCT',
  'wales': 'WLS',
  'northernireland': 'NIR'
};

module.exports = function(sequelize,DataTypes) {
  /** @type {JetDataTypes} */
  let SeqTypes = DataTypes;
  
  // DEFINITION
  /** @type {JetStateModel} */
  const stateModel = sequelize.define('State', {
    id: {
      type: SeqTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    name: {type: SeqTypes.STRING(50), allowNull: false},
    local_name: {type: SeqTypes.STRING(50), allowNull: false},
    code: {type: SeqTypes.STRING(8)},
    pic: {type: SeqTypes.INTEGER}
  }, {
    underscored: true
  });

  // MODEL STATIC METHODS
  stateModel.associate = function(models){
    /** @type {JetLanguageModel} */
    const languageModel = models['Language'];

    /** @type {JetCountryModel} */
    const countryModel = models['Country'];

    const statesNamesModel = sequelize.define('StatesNames', {
      name: {type: SeqTypes.STRING(50), allowNull: false}
    }, {
      underscored: true
    });

    this.belongsToMany(languageModel,{through: statesNamesModel});
    languageModel.belongsToMany(this,{through: statesNamesModel});

    this.belongsTo(countryModel, {foreignKey: 'country_id'});
  };

  stateModel.readStateCode = function(code){
    if(!code) return null;

    key = code.substr(0,50)
      .toLowerCase()
      .replace(/ /g,'')
      .replace(/-|\.|'|,/g,'');

    const res = STATES_LOOKUP[key];
    return res ? res : code;
  }

  return stateModel;
};