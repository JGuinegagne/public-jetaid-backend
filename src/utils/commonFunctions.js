const moment = require('moment');

/** @param {Date} date 
 * @param {string} time
 * @return {moment.Moment}*/
const calculateDateTime = function(date, time){
  return moment(date,'YYYY-MM-DD').startOf('d')
    .add(moment(time,'HH:mm').minutes(),'m')
    .add(moment(time,'HH:mm').hours(),'h');
};

const createTime = function(time){
  return moment().startOf('d')
    .add(moment(time,'HH:mm').minutes(),'m')
    .add(moment(time,'HH:mm').hours(),'h');
};

/** @type {<T>(entries: Array<T>) => Array<T>}*/
const uniques = (entries) => {
  const out = {};

  entries.forEach(entry => out[entry] = true);
  return Object.keys(out);
};

/** @param {string} fieldName 
 * @param {string} label
 * @param {JetErrors} errors
 * @return {(entry: object, ind: number) => boolean}*/
const validHex = (fieldName, label, errors) => (entry, ind = 0) => {
  const field = entry[fieldName];
  if(typeof field !== 'string' || field.toString('hex') !== field){
    errors.errors[`${label}${ind}`] = `${field} is not a valid "hex" string`;
    return false;
  }

  return true;
};

/** @param {string} label
 * @param {JetErrors} errors
 * @return {(val: string, ind: number) => boolean}*/
const isValidHex = (label, errors) => (val, ind=0) => {
  if(typeof val !== 'string' || val.toString('hex') !== val){
    errors.errors[`${label}${ind}`] = 'is not a valid "hex" string';
  }

  return true;
};

/** Utility used to format city, agglos and neighborhood keys
 * @param {string} name
 * @return {string} formatted name without space, comma, period or dash*/
const convertNameToKey = function(name){
  return name.substr(0,50)
    .toLowerCase()
    .replace(/ /g,'')
    .replace(/-|\.|'|,/g,'');
};

/** Indexes a map of entries based on their unique parameter keyName instead of the current indexing
 * 
 * e.g. travId->userTrav ==> userTravId->userTrav
 * @type {<T>(map: {[key: string]: T}, keyName: string) => {[key: string]: T}} */
const invertMap = function(map, keyName){
  const outMap = {};

  Object.keys(map).forEach(key => {
    const entry = map[key];
    outMap[entry[keyName].toString()] = entry;
  });

  return outMap;
};

/** Converts an array of entry into a map for easy lookup.
 * 
 * @type {<T>(entries: Array<T>, keyName: string) => {[key: string]: T}} */
const generateMap = function(entries, keyName){
  const outMap = {};
  entries.forEach(entry => {
    outMap[entry[keyName].toString()] = entry;
  });
  return outMap;
};

/** Convert a map:key->entries[] into map:keyName->entry  
 * 
 * @type {<T>(map: {[key: string]: Array<T>}, keyName: string) => {[keyName: string]: T}}*/
const invertListMap = function(listMap, keyName){
  const outMap = {};

  Object.keys(listMap).forEach(key => {
    const entries = listMap[key];
    entries.forEach(entry => outMap[entry[keyName].toString()] = entry);
  });

  return outMap;
};

/** Combines, without duplicates, the results of the method for each element of the list
 * @type {<T>(list: Array<T>, method: (entry: T) => string) => Array<string>}*/
const combineIds = function(list, method){
  const map = {};

  return list
    .map(method)
    .filter(key => !map[key] ? (map[key] = true) : false);
};

/** Combines, without duplicates, the results of the method for each element of the list
 * @type {<T>(list: Array<T>, method: (entry: T) => Array<string>) => Array<string>}*/
const combineIdLists = function(list, method){
  const map ={};
  list
    .map(method)
    .map(ids => ids.filter(id => !map[id] ? (map[id] = true) : false));
  return Object.keys(map);
};

module.exports = {
  calculateDateTime,
  createTime,
  uniques,
  validHex,
  isValidHex,
  convertNameToKey,
  invertMap,
  generateMap,
  invertListMap,
  combineIds,
  combineIdLists
};