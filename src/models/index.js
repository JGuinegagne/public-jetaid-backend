'use strict';

var fs        = require('fs');
var path      = require('path');
var Sequelize = require('sequelize');
var basename  = path.basename(__filename);
var env       = process.env.NODE_ENV || 'test';
var config    = require(__dirname + '/../../config.json')[env];

var db        = {};

/* eslint-disable no-redeclare */
if (config.use_env_variable) {
  var sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  var sequelize = new Sequelize(config.database, config.username, config.password, config);
}
/* eslint-enable no-redeclare */

db.sequelize = sequelize;
db.Sequelize = Sequelize;

fs.readdirSync(__dirname)
  .filter(file => {
    return (file.indexOf('.') !== 0) && (file !== basename) && (file.slice(-3) === '.js');
  })
  .forEach(file => {
    var model = sequelize['import'](path.join(__dirname, file));
    db[model.name] = model;
  });

db.queries = require('../utils/commonQueries')(db);
db.handlers = {};
db.inputs = {};

/** 
 * @param {string} name 
 * @return {JetInputManager}*/
const inputHandler = (name) => {
  /** @type {JetInputManager} */
  let handler = db.inputs[name];
  if(handler)
    return handler;
  
  handler = {
    fetch: {},
    validate: {},
    populate: {},
    build: {},
    get: {}
  };

  db.inputs[name] = handler;
  return db.inputs[name];
};

// GENERATE the handlers
fs.readdirSync(__dirname + '/../handlers/')
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const handler = require(path.join(__dirname + '/../handlers/',file))(db);
    db.handlers[file.slice(0,file.length-3)] = handler;
  });

// GENERATE the inputs
// each must have a field "fetch", "validate", "populate", "build" and "get"
fs.readdirSync(__dirname + '/../inputs/fetchers')
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const handler = inputHandler(file.slice(0,file.length-10));
    handler.fetch = Object.assign(handler.fetch,require(path.join(__dirname + '/../inputs/fetchers',file))(db));
  });

fs.readdirSync(__dirname + '/../inputs/validators')
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const handler = inputHandler(file.slice(0,file.length-12));
    handler.validate = Object.assign(handler.validate,require(path.join(__dirname + '/../inputs/validators',file))(db));
  });

fs.readdirSync(__dirname + '/../inputs/populators')
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const handler = inputHandler(file.slice(0,file.length-12));
    handler.populate = Object.assign(handler.populate,require(path.join(__dirname + '/../inputs/populators',file))(db));    
  });

fs.readdirSync(__dirname + '/../inputs/builders')
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const handler = inputHandler(file.slice(0,file.length-10));
    handler.build = Object.assign(handler.build,require(path.join(__dirname + '/../inputs/builders',file))(db));    
  });

fs.readdirSync(__dirname + '/../inputs/getters')
  .filter(file => file.indexOf('.') !== 0 && file.slice(-3) === '.js')
  .forEach(file => {
    const handler = inputHandler(file.slice(0,file.length-9));
    handler.get = Object.assign(handler.get,require(path.join(__dirname + '/../inputs/getters',file))(db));    
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});


module.exports = db;
