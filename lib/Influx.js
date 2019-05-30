const Influx = require('influx');
const _ = require('lodash');
const multilog = require('../multilogger');

const influx = {
  intializeInflux: (server, name, password, port, username) => {
    return new Influx.InfluxDB({
      host: server,
      database: name,
      port,
      password,
      username,
      schema: [
        {
          measurement: 'number_of_requests',
          fields: {
            requests: Influx.FieldType.INTEGER,
            amountOf1xx: Influx.FieldType.INTEGER,
            amountOf2xx: Influx.FieldType.INTEGER,
            amountOf3xx: Influx.FieldType.INTEGER,
            amountOf4xx: Influx.FieldType.INTEGER,
            amountOf5xx: Influx.FieldType.INTEGER,
          },
          tags: [],
        },
        {
          measurement: 'multilogger',
          fields: {
            responseTime: Influx.FieldType.FLOAT,
            cpuUsage: Influx.FieldType.FLOAT,
            memoryUsage: Influx.FieldType.FLOAT,
            requests: Influx.FieldType.INTEGER,
            host: Influx.FieldType.STRING,
            ip: Influx.FieldType.STRING,
          },
          tags: [
            'statusCode',
            'statusMessage',
            'method',
            'path',
            'url',
            'ip',
            'osHost',
            'country',
            'geohash',
            'client',
            'body',
            'query',
            'params',
            'auth',
            'errorMessage',
            'errorStack',
            'totalMemory',
          ],
        },
      ],
    });
  },

  writeToDatabase: async (influx, name) => {
    influx
      .getDatabaseNames()
      .then(names => {
        if (!names.includes(name)) {
          return influx.createDatabase(name);
        }
      })
      .catch(err => {
        console.error(`Error creating Influx database!`);
      });

    const pointsToWrite = [];
    const multiLogData = multilog.getData();

    // write away data about express requests
    if (_.size(multiLogData) > 0) {
      pointsToWrite.push({
        measurement: 'number_of_requests',
        fields: {
          requests: multiLogData.length,
          amountOf1xx: _.size(
            _.filter(multiLogData, object => {
              return _.startsWith(object.statusCode, '1');
            }),
          ),
          amountOf2xx: _.size(
            _.filter(multiLogData, object => {
              return _.startsWith(object.statusCode, '2');
            }),
          ),
          amountOf3xx: _.size(
            _.filter(multiLogData, object => {
              return _.startsWith(object.statusCode, '3');
            }),
          ),
          amountOf4xx: _.size(
            _.filter(multiLogData, object => {
              return _.startsWith(object.statusCode, '4');
            }),
          ),
          amountOf5xx: _.size(
            _.filter(multiLogData, object => {
              return _.startsWith(object.statusCode, '5');
            }),
          ),
        },
        tags: {},
      });

      _.forEach(multiLogData, async object => {
        pointsToWrite.push({
          measurement: 'multilogger',
          tags: {
            statusCode: object.statusCode,
            statusMessage: object.statusMessage,
            method: object.method,
            path: object.path,
            url: object.url,
            ip: object.ip,
            osHost: object.osHost,
            country: object.location && object.location.country ? object.location.country : ' ',
            geohash: object.location && object.location.geohash ? object.location.geohash : ' ',
            client: object.clientInfo,
            auth: object.auth,
            body: object.body,
            query: object.query,
            params: object.params,
            errorMessage: JSON.stringify(object.errorMessage.errorMessage) || ' ',
            errorStack: JSON.stringify(object.errorMessage.errorStack) || ' ',
          },
          fields: {
            responseTime: object.responseTime,
            requests: multiLogData.length,
            host: object.hostname,
            ip: object.ip,
          },
        });
      });
    }

    // writes away custom logs
    const customLogData = multilog.getCustomData();
    if (customLogData && _.size(customLogData) > 0) {
      _.forEach(customLogData, async metric => {
        pointsToWrite.push({
          measurement: 'databaseMetrics',
          tags: metric,
          fields: { timing: metric.timing },
        });
      });
    }

    // writes away data about the instance
    const instanceData = multilog.getInstanceData();

    pointsToWrite.push({
      measurement: 'instances',

      tags: {
        hostname: instanceData.hostname,
      },
      fields: {
        cpuUsage: instanceData.cpuUsage,
        memoryUsed: instanceData.memory.used,
        memoryFree: instanceData.memory.free,
        requests: _.size(multiLogData),
        hostname: instanceData.hostname,
      },
    });

    multilog.emptyAllData();

    try {
      await Promise.all(_.chunk(pointsToWrite, 50), chunk => influx.writePoints(chunk));
    } catch (err) {
      console.log('influx write error');
    }

    // clears all logs of the current interval
  },
};

module.exports = influx;
