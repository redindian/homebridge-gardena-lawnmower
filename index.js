const API_URI = 'https://smart.gardena.com/v1/';

const rp = require('request-promise-native');
const jq = require('json-query');

let Service, Characteristic;

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-gardena", "HomebridgeGardena", MyRobo);
};

function MyRobo(log, config) {
  this.log = log;
  this.username = config['username'];
  this.password = config['password'];
  this.locationId = config['location-id'];
  this.mowerId = config['mower-id'];

  this.manufactInfo = config['mower'];
  this.modelInfo = config['model'];
  this.serialNumberInfo = config['serial-number'];
}

MyRobo.prototype = {

  getToken: function () {
    const me = this;
    return new Promise((resolve, reject) => {
      let token = me.token;
      if (token && token.expires && token.expires > Date.now()) {
        resolve(me.token.token);
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
          me.log("getToken", {data});
          const expires = Date.now() + data['attributes']['expires_in'] - 5000;
          token = {
            token: data.id,
            expires: expires
          };
          me.log("getToken", {token});
          me.token = token;
          resolve(me.token.token);
        })
        .catch(function (err) {
          me.log("Cannot get Token.", {options}, err.statusCode, err.statusMessage);
          reject(err);
        });
    });
  },

  getMowerId: function () {
    const me = this;
    return new Promise((resolve, reject) => {
      if (me.mowerId) {
        resolve(me.mowerId);
      } else {
        const err = "Please set Mower ID (mower-id) in config.";
        me.log("Cannot get Mower ID", err);
        reject(err);
      }
    });
  },

  getDevicesMowerId: async function () {
    const query = 'devices[category=mower].id';
    const mowerId = await this.queryDevices(query);
    this.log('getDevicesMowerId', {mowerId});
    return mowerId;
  },

  getDevicesMowerProperties: async function () {
    const query = 'devices[category=mower].abilities[type=robotic_mower][properties]';
    return await this.queryDevices(query);
  },

  getDevicesMowerStatus: async function () {
    const query = 'devices[category=mower].abilities[type=robotic_mower][properties][name=status].value';
    return await this.queryDevices(query);
  },

  getDevicesBatteryProperties: async function () {
    const query = 'devices[category=mower].abilities[type=battery_power].properties[name=level].value';
    return await this.queryDevices(query);
  },

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
    this.log('queryDevices', {data, query, result});
    return result ? result.value : null;
  },

  getDevices: async function () {
    return await this.callApi(
      'GET',
      API_URI + 'devices'
    );
  },

  callApi: async function (method, uri, qs, body) {
    const me = this;
    const locationId = this.locationId;
    const token = await this.getToken();

    return new Promise((resolve, reject) => {
      qs = qs || {
        locationId: locationId
      };
      const options = {
        method: method,
        uri: uri,
        qs: qs,
        body: body,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Authorization-Provider': 'husqvarna',
        },
        json: true // Automatically parses the JSON string in the response
      };

      rp(options)
        .then(function (response) {
          resolve(response);
        })
        .catch(function (err) {
          me.log("Cannot call API.", {options}, err.statusCode, err.statusMessage);
          reject(err);
        });

    });
  },

  getMowerOnCharacteristic: async function (next) {
    const status = await this.getDevicesMowerStatus();
    const mowing = this.isMowingStatus(status) ? 1 : 0;
    this.log('getMowerOnCharacteristic', {status, mowing});
    next(null, mowing);
  },

  isMowingStatus: function (status) {
    return ['ok_cutting', 'ok_cutting_timer_overridden'].includes(status);
  },

  getBatteryLevelCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryLevel();
    this.log('getBatteryLevelCharacteristic', {value});
    next(null, value);
  },

  getChargingStateCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryCharging();
    this.log('getChargingStateCharacteristic', {value});
    next(null, value);
  },

  getLowBatteryCharacteristic: async function (next) {
    const value = await this.getDevicesBatteryLevel();
    const low = value < 20;
    this.log('getLowBatteryCharacteristic', {value, low});
    next(null, low);
  },

  sendMowerCommand: async function (command, parameters) {
    const me = this;

    const mowerId = await this.getMowerId();
    const locationId = this.locationId;
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
          'Authorization': 'Bearer ' + token,
          'Authorization-Provider': 'husqvarna',
        },
        json: true // Automatically parses the JSON string in the response
      };

      rp(options)
        .then(function (response) {
          me.log('sendMowerCommand', response);
          resolve(response);
        })
        .catch(function (err) {
          me.log("Cannot send command.", {options}, err.statusCode, err.statusMessage);
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

    let humidityService = new Service.HumiditySensor("Battery level");
    humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on('get', this.getBatteryLevelCharacteristic.bind(this));
    this.services.push(humidityService);

    /* Switch Service */

    /*
    let switchService = new Service.Switch("Auto/Home");
    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchOnCharacteristic.bind(this))
      .on('set', this.setSwitchOnCharacteristic.bind(this));
    this.services.push(switchService);
    */

    /* Fan Service */

    let fanService = new Service.Fan("Mowing");
    fanService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getMowerOnCharacteristic.bind(this))
      .on('set', this.setMowerOnCharacteristic.bind(this));
    this.services.push(fanService);

    /* If Robonect HX - fetch temp from temp sensor. Otherwise, fetch battery temp. */
    /*
        if (this.card === "HX") {
          let tempService = new Service.TemperatureSensor("Temperature");
          tempService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getTemperatureCharacteristic.bind(this));
          this.services.push(tempService);
          this.tempService = tempService;
        } else {
          let tempService = new Service.TemperatureSensor("Battery temperature");
          tempService
            .getCharacteristic(Characteristic.CurrentTemperature)
            .on('get', this.getBatteryTemperatureCharacteristic.bind(this));
          this.services.push(tempService);
          this.tempService = tempService;
        }
    */

    /*
    this.informationService = informationService;
    this.batteryService = batteryService;
    this.humidityService = humidityService;
    this.switchService = switchService;
    this.fanService = fanService;
     */

    return this.services;
  },
  /*
  getBatteryLevelCharacteristic: function (next) {
    const me = this;
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
        return next(null, obj.status.battery);
      });
  },

  getChargingStateCharacteristic: function (next) {
    const me = this;
    request({
        url: me.statusUrl,
        method: 'GET',
      },
      function (error, response, body) {
        var chargingStatus = 0;
        if (error) {
          me.log(error.message);
          return next(error);
        }
        var obj = JSON.parse(body);
        if (obj.status.status === 4) {
          chargingStatus = 1;
        }
        return next(null, chargingStatus);
      });
  },

  getLowBatteryCharacteristic: function (next) {
    const me = this;
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
        if (obj.status.battery < 20) {
          return next(null, 1);
        } else {
          return next(null, 0);
        }

      });
  },

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

  getMowerOnCharacteristic: function (next) {
    const me = this;
    var mowing = 0;
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
        if (obj.status.status === 2 || obj.status.status === 5) {
          mowing = 1;
        }
        return next(null, mowing);
      });
  },

  setMowerOnCharacteristic: function (on, next) {
    const me = this;
    if (on) {
      me.setModeUrl = me.setAutoModeUrl;
    } else {
      me.setModeUrl = me.setEodModeUrl;
    }
    request({
      url: me.setModeUrl,
      method: 'GET',
    },
      function (error, response, body) {
        if (error) {
          me.log(error.message);
          return next(error);
        }
        return next();
      });
  },

  getTemperatureCharacteristic: function (next) {
    const me = this;
    var temperature = 0;
    request({
        url: me.tempUrl,
        method: 'GET',
      },
      function (error, response, body) {
        if (error) {
          me.log(error.message);
          return next(error);
        }
        var obj = JSON.parse(body);
        temperature = obj.health.climate.temperature;
        return next(null, temperature);
      });
  },
  getBatteryTemperatureCharacteristic: function (next) {
    const me = this;
    var temperature = 0;
    request({
        url: me.batteryUrl,
        method: 'GET',
      },
      function (error, response, body) {
        if (error) {
          me.log(error.message);
          return next(error);
        }
        var obj = JSON.parse(body);
        temperature = obj.battery.temperature;
        temperature = temperature / 10;
        return next(null, temperature);
      });
  }
   */
};