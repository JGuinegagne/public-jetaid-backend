const { series } = require('gulp');
const { exec } = require('child_process');

function unseed(cb){
  exec('node_modules/.bin/sequelize db:seed:undo --seed \'20180906154350-rides.js\'',cb);
}

function unseedtrips(cb){
  exec('node_modules/.bin/sequelize db:seed:undo --seed \'20180620210353-trips.js\'',cb);
}

function unseedprofiles(cb){
  exec('node_modules/.bin/sequelize db:seed:undo --seed \'20180524124539-profileInfos.js\'',cb);
}

function unseedtravelers(cb){
  exec('node_modules/.bin/sequelize db:seed:undo --seed \'20180521123607-demo-travelers\'',cb);
}

function seedtravelers(cb){
  exec('node_modules/.bin/sequelize db:seed --seed \'20180521123607-demo-travelers\'',cb);
}

function seedprofiles(cb){
  exec('node_modules/.bin/sequelize db:seed --seed \'20180524124539-profileInfos.js\'',cb);
}

function seedtrips(cb){
  exec('node_modules/.bin/sequelize db:seed --seed \'20180620210353-trips.js\'',cb);
}

function seed(cb){
  exec('node_modules/.bin/sequelize db:seed --seed \'20180906154350-rides.js\'',cb);
}

function createFrontEndAirports(cb){
  exec('node frontend_helpers/createAirportFile.js',cb);
}

function createFrontEndAirlines(cb){
  exec('node frontend_helpers/createAirlineFile.js',cb);
}

exports.unseed = series(unseed,unseedtrips,unseedprofiles);
exports.reseed = series(seedprofiles,seedtrips,seed);
exports.resetseed = series(unseed,unseedtrips,unseedprofiles,seedprofiles,seedtrips,seed);
exports.frontendfiles = series(createFrontEndAirports,createFrontEndAirlines);