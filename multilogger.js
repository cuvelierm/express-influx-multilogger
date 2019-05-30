let data = [];
let customData = [];

module.exports = {
  init: ({
    interval = 1000,
    database: {
      type = 'influx',
      server = '127.0.0.1',
      name = 'myMultilogDb',
      password = '',
      port = 3000,
      username = '',
    } = {},
  }) => {
    return databaseInitializer.initializer(server, name, password, port, username, type, interval);
  },
  log: ({ extended = true, development = false }) => {
    return logger.log(extended, development);
  },
  error: () => {
    return multiError();
  },
  pushToData: object => {
    return data.push(object);
  },
  pushCustomData: object => {
    return customData.push(object);
  },
  emptyAllData: () => {
    data = [];
    customData = [];
  },
  getData: () => {
    return data;
  },
  getCustomData: () => {
    return customData;
  },
  getInstanceData: () => {
    return {
      hostname: os.hostname(),
      cpuUsage: si.cpuCurrentspeed().avg,
      memory: si.mem(),
    };
  },
  insertDatabaseCallSpeed: object => {
    return logger.addToObject(object);
  },
  insertCustomLog: ob => {
    return logger.addToObject(ob);
  },
};

const _ = require('lodash');

const logger = require('./lib/Logger');
const multiError = require('./lib/MultiError');
const databaseInitializer = require('./lib/DatabaseInitializer');
const os = require('os');
const si = require('systeminformation');
