const Influx = require('influx');
const _ = require('lodash');
const multilog = require('../multilogger');

const influxFunctions = {
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
            statusCode: Influx.FieldType.STRING,
            statusMessage: Influx.FieldType.STRING,
            method: Influx.FieldType.STRING,
            osHost: Influx.FieldType.STRING,
            country: Influx.FieldType.STRING,
            geohash: Influx.FieldType.STRING,
            client: Influx.FieldType.STRING,
            body: Influx.FieldType.STRING,
            query: Influx.FieldType.STRING,
            params: Influx.FieldType.STRING,
            auth: Influx.FieldType.STRING,
            errorMessage: Influx.FieldType.STRING,
            errorStack: Influx.FieldType.STRING,
            totalMemory: Influx.FieldType.FLOAT,
          },
          tags: ['path', 'url', 'geohash', 'country'],
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
      influx.writeMeasurement('number_of_requests', [
        {
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
        },
      ]);

      influx.writeMeasurement(
        'multilogger',
        _.map(multiLogData, object => {
          return {
            tags: {
              path: object.path,
              url: object.url,
              geohash: object.location && object.location.geohash ? object.location.geohash : ' ',
              country: object.location && object.location.country ? object.location.country : ' ',
              city: object.location && object.location.city ? object.location.city : 'notFound',
            },
            fields: {
              responseTime: object.responseTime,
              requests: multiLogData.length,
              host: object.hostname,
              country: object.location && object.location.country ? object.location.country : ' ',
              geohash: object.location && object.location.geohash ? object.location.geohash : ' ',
              city: object.location && object.location.city ? object.location.city : 'notFound',
              errorMessage: JSON.stringify(object.errorMessage.errorMessage) || ' ',
              errorStack: JSON.stringify(object.errorMessage.errorStack) || ' ',
              client: object.clientInfo,
              auth: object.auth,
              body: object.body,
              query: object.query,
              params: object.params,
              ip: object.ip,
              method: object.method,
              statusCode: object.statusCode,
              statusMessage: object.statusMessage,
            },
          };
        }),
      );
    }

    // writes away custom logs
    const customLogData = multilog.getCustomData();
    if (customLogData && _.size(customLogData) > 0) {
      influx.writeMeasurement(
        'customMetrics',
        _.map(customLogData, metric => {
          return {
            tags: {
              name: metric.name,
            },
            fields: { timing: metric.timing },
          };
        }),
      );
    }
    multilog.emptyAllData();
    // writes away data about the instance
    const instanceData = await multilog.getInstanceData();
    influx.writeMeasurement('performance', [
      {
        tags: {
          hostname: instanceData.hostname,
        },
        fields: {
          cpuUsage: instanceData.cpuUsage,
          memoryUsed: instanceData.memory.active,
          memoryFree: instanceData.memory.free,
          requests: _.size(multiLogData),
          hostname: instanceData.hostname,
          memoryTotal: (instanceData.memory.total / Math.pow(1024, 3)).toFixed(2),
        },
      },
    ]);
    // clears all logs of the current interval
  },
};

module.exports = influxFunctions;
