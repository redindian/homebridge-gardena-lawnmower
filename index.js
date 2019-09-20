const API_URI = 'https://smart.gardena.com/v1/';

const rp = require('request-promise-native');
const jq = require('json-query');

let Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-gardena-lawnmower", "HomebridgeGardena", MyRobo);
};

function MyRobo(log, config) {
  this.log = log;
  this.username = config['username'];
  this.password = config['password'];
  this.manufactInfo = config['manufacturer'];
  this.modelInfo = config['model'];
  this.serialNumberInfo = config['serial'];

  this.user_id = null;
  this.locationId = null;

  // this.getUserId();
  this.getLocationsLocationId();
}

MyRobo.prototype = {

  getToken: function () {
    const me = this;

    return new Promise((resolve, reject) => {
      let token = me.token;
      me.log('getToken', 'try token.expires: ' + (token ? token.expires : 'null'));
      if (token && token.expires && token.expires > Date.now()) {
        me.log('getToken', 'use token');
        resolve(me.token);
        return;
      }

      const options = {
        method: 'POST',
        uri: API_URI + 'auth/token',
        body: {data: {type: 'token', attributes: {username: this.username, password: this.password}}},
        json: true // Automatically stringifies the body to JSON
      };

      rp(options)
        .then(function (response) {
          const data = response.data;
          me.log('getToken', 'Successful login');

          // Handle attributes
          const attributes = data['attributes'];
          const expires = Date.now() + attributes['expires_in'] - 5000;
          const provider = attributes['provider'];
          const user_id = attributes['user_id'];

          me.locationId = null;
          me.user_id = user_id;

          // Set token
          token = {
            token: data.id,
            expires: expires,
            provider: provider,
            user_id: user_id,
          };

          me.token = token;
          resolve(me.token);
        })
        .catch(function (err) {
          me.log('Cannot get Token', {options}, err.statusCode, err.statusMessage);
          reject(err);
        });
    });
  },

  getUserId: async function () {
    if (!this.user_id) {
      this.log('getUserId', 'get user_id');
      const token = await this.getToken();
      const user_id = token.user_id;
      this.user_id = user_id;
      this.log('getUserId', {user_id});
    }

    return this.user_id;
  },

  getLocationsLocationId: async function () {
    if (this.locationId === null) {
      this.log('getLocationsLocationId', 'get locationId');
      const query = 'locations[0].id';
      const locationId = await this.queryLocations(query);
      this.log('getLocationsLocationId', {locationId});
      this.locationId = locationId;

    }
    return this.locationId;
  },

  queryLocations: async function (query) {
    const data = await this.getLocations();
    const result = jq(query, {data});
    // this.log('queryLocations', {data, query, result});
    return result ? result.value : null;
  },

  getLocations: async function () {
    const user_id = await this.getUserId();

    return await this.callApi(
      'GET',
      API_URI + 'locations',
      {
        locationId: null,
        user_id: user_id,
      }
    );
  },

  getDevicesMowerId: async function () {
    if (!this.mowerId) {
      this.log('getDevicesMowerId', 'set mowerId');
      const query = 'devices[category=mower].id';
      const mowerId = await this.queryDevices(query);
      this.log('getDevicesMowerId', {mowerId});
      this.mowerId = mowerId;
    }
    return this.mowerId;
  },

  // getDevicesMowerProperties: async function () {
  //   const query = 'devices[category=mower].abilities[type=robotic_mower][properties]';
  //   return await this.queryDevices(query);
  // },

  getDevicesMowerStatus: async function () {
    const query = 'devices[category=mower].abilities[type=robotic_mower][properties][name=status].value';
    return await this.queryDevices(query);
  },

  // getDevicesBatteryProperties: async function () {
  //   const query = 'devices[category=mower].abilities[type=battery_power].properties[name=level].value';
  //   return await this.queryDevices(query);
  // },

  getDevicesBatteryLevel: async function () {
    const query = 'devices[category=mower].abilities[type=battery_power].properties[name=level].value';
    return await this.queryDevices(query);
  },

  getDevicesBatteryCharging: async function () {
    const query = 'devices[category=mower].abilities[type=battery_power].properties[name=charging].value';
    return await this.queryDevices(query);
  },

  queryDevices: async function (query) {
    const data = await this.getDevices();
    const result = jq(query, {data});
    // this.log('queryDevices', {data, query, result});
    return result ? result.value : null;
  },

  getDevices: async function () {
    const locationId = await this.getLocationsLocationId();

    return await this.callApi(
      'GET',
      API_URI + 'devices',
      {
        locationId: locationId
      }
    );
  },

  callApi: async function (method, uri, qs, body) {
    const me = this;
    const token = await this.getToken();

    return new Promise((resolve, reject) => {
      const options = {
        method: method,
        uri: uri,
        qs: qs,
        body: body,
        headers: {
          'Authorization': 'Bearer ' + token.token,
          'Authorization-Provider': token.provider,
        },
        json: true // Automatically parses the JSON string in the response
      };

      rp(options)
        .then(function (response) {
          resolve(response);
        })
        .catch(function (err) {
          me.log('Cannot call API.', {options}, err.statusCode, err.statusMessage);
          reject(err);
        });

    });
  },

  getMowerOnCharacteristic: async function (next) {
    const status = await this.getDevicesMowerStatus();
    const mowing = this.isMowingStatus(status) ? 1 : 0;
    // this.log('getMowerOnCharacteristic', {status, mowing});
    next(null, mowing);
  },

  isMowingStatus: function (status) {
    return ['ok_cutting', 'ok_cutting_timer_overridden'].includes(status);
  },

  getBatteryLevelCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryLevel();
    // this.log('getBatteryLevelCharacteristic', {value});
    next(null, value);
  },

  getChargingStateCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryCharging();
    // this.log('getChargingStateCharacteristic', {value});
    next(null, value);
  },

  getLowBatteryCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryLevel();
    const low = value < 20;
    // this.log('getLowBatteryCharacteristic', {value, low});
    next(null, low);
  },

  sendMowerCommand: async function (command, parameters) {
    const me = this;

    const locationId = await this.getLocationsLocationId();
    const mowerId = await this.getDevicesMowerId();
    const token = await this.getToken();

    return new Promise((resolve, reject) => {
      const body = {
        name: command
      };
      if (parameters) {
        body.parameters = parameters;
      }
      const options = {
        method: 'POST',
        uri: API_URI + 'devices/' + mowerId + '/abilities/mower/command',
        body: body,
        qs: {
          locationId: locationId
        },
        headers: {
          'Authorization': 'Bearer ' + token.token,
          'Authorization-Provider': token.provider,
        },
        json: true // Automatically parses the JSON string in the response
      };

      rp(options)
        .then(function (response) {
          me.log('sendMowerCommand', response);
          resolve(response);
        })
        .catch(function (err) {
          me.log('Cannot send command.', {options}, err.statusCode, err.statusMessage);
          reject(err);
        });
    });
  },

  setMowerOnCharacteristic: function (on, next) {
    this.log('setMowerOnCharacteristic', {on});

    if (on) {
      // start_override_timer, start_resume_schedule
      this.sendMowerCommand('start_override_timer', {
        duration: 180
      }).then(() => next()).catch(next);
    } else {
      // park_until_next_timer, park_until_further_notice
      this.sendMowerCommand('park_until_next_timer')
        .then(() => next()).catch(next);
    }
  },

  getServices: function () {
    this.services = [];

    /* Information Service */

    let informationService = new Service.AccessoryInformation();
    informationService
      .setCharacteristic(Characteristic.Manufacturer, this.manufactInfo)
      .setCharacteristic(Characteristic.Model, this.modelInfo)
      .setCharacteristic(Characteristic.SerialNumber, this.serialNumberInfo);
    this.services.push(informationService);

    /* Battery Service */

    let batteryService = new Service.BatteryService();
    batteryService
      .getCharacteristic(Characteristic.BatteryLevel)
      .on('get', this.getBatteryLevelCharacteristic.bind(this));
    batteryService
      .getCharacteristic(Characteristic.ChargingState)
      .on('get', this.getChargingStateCharacteristic.bind(this));
    batteryService
      .getCharacteristic(Characteristic.StatusLowBattery)
      .on('get', this.getLowBatteryCharacteristic.bind(this));
    this.services.push(batteryService);

    /* Humidity Service */
    /*
        let humidityService = new Service.HumiditySensor('Battery');
        humidityService
          .getCharacteristic(Characteristic.CurrentRelativeHumidity)
          .on('get', this.getBatteryLevelCharacteristic.bind(this));
        this.services.push(humidityService);
    */
    /* Switch Service */

    /*
    let switchService = new Service.Switch('Auto/Home');
    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchOnCharacteristic.bind(this))
      .on('set', this.setSwitchOnCharacteristic.bind(this));
    this.services.push(switchService);
    */

    /* Fan Service */

    let fanService = new Service.Fan('Mowing');
    fanService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getMowerOnCharacteristic.bind(this))
      .on('set', this.setMowerOnCharacteristic.bind(this));
    this.services.push(fanService);

    return this.services;
  },
  /*
    getSwitchOnCharacteristic: function (next) {
      const me = this;
      var onn = false;
      request({
          url: me.statusUrl,
          method: 'GET',
        },
        function (error, response, body) {
          if (error) {
            me.log(error.message);
            return next(error);
          }
          var obj = JSON.parse(body);
          if (obj.status.mode === 0) {
            onn = true;
          }
          return next(null, onn);
        });
    },

    setSwitchOnCharacteristic: function (on, next) {
      const me = this;
      if (on) {
        me.setModeUrl = me.setAutoModeUrl;
      } else {
        me.setModeUrl = me.setHomeModeUrl;
      }
      request({
          url: me.setModeUrl,
          method: 'GET',
        },
        function (error, response) {
          if (error) {
            me.log(error.message);
            return next(error);
          }
          return next();
        });
    },
     */
};