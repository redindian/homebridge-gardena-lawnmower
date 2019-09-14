var Service, Characteristic;
const request = require('request');
const rp = require('request-promise-native');
const url = require('url');

module.exports = function (homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-gardena", "HomebridgeGardena", myRobo);
};

function myRobo(log, config) {
  this.log = log;
  this.username = config['username'];
  this.password = config['password'];
  this.locationid = config['locationid'];
  this.mowerId = config['mowerId'] ;

  this.manufactInfo = config['mower'];
  this.modelInfo = config['model'];
  this.serialNumberInfo = config['serial-number'];
}

myRobo.prototype = {
  getToken: function () {
    return new Promise((resolve, reject) => {
      if (this.token && this.token.expires && this.token.expires > Date.now()) {
        resolve(this.token.token);
      } else { }
      var options = {
        method: 'POST',
        uri: 'https://iam-api.dss.husqvarnagroup.net/api/v3/token',
        body: { data: { type: 'token', attributes: { username: this.username, password: this.password } } },
        json: true // Automatically stringifies the body to JSON
      };

      rp(options)
        .then(function (response) {
          const token = {
            token: response.data.id
          };
          token.expires = Date.now() + response.data.attributes.expires_in - 5000;

          this.token = token;
          resolve(this.token.token);
        })
        .catch(function (err) {
          console.log("Cannot get Token.");
          reject(err);
        });
    });
  },
  getMoverId: function () {
    return new Promise((resolve, reject) => {
      resolve(this.moverId); // FIXME
    });
  },
  getMowerOnCharacteristic: function (next) {
    const me = this;

    const mowerId = this.getMoverId();
    const locationId = this.locationid;
    const token = this.getToken();

    const options = {
      uri: 'https://smart.gardena.com/sg-1/devices/' + mowerId,
      qs: {
        locationId: locationId
      },
      headers: {
        'Authorization': 'Bearer ' + token
      },
      json: true // Automatically parses the JSON string in the response
    };

    const response =  rp(options);
    const state = response.devices.device_state;
    var mowing = 0;
    if (state === 'ok') {
      mowing = 0;
    }
    // WHAT IS MOWING

    next(null, mowing);

  },
  sendMowerCommand(command, parameters) {
    return new Promise((resolve, reject) => {
      const me = this;

      const mowerId =  this.getMoverId();
      const locationId =  this.locationid;
      const token =  this.getToken();

      const body = {
        name: command
      };
      if (parameters) {
        body.parameters = parameters;
      }
      const options = {
        method: 'POST',
        uri: 'https://smart.gardena.com/sg-1/devices/' + mowerId + '/mower/command',
        body: body,
        qs: {
          locationId: locationId
        },
        headers: {
          'Authorization': 'Bearer ' + token
        },
        json: true // Automatically parses the JSON string in the response
      };
    });
  },

  setMowerOnCharacteristic: function (on, next) {

    if (on) {
      this.sendMowerCommand('start_override_timer', {
        duration: 60
      }).then((value) => next()).catch(next);

    } else {
      this.sendMowerCommand('park_until_next_timer')
        .then((value) => next()).catch(next);
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
/*
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
*/
    /* Humidity Service */
/*
    let humidityService = new Service.HumiditySensor("Battery level");
    humidityService
      .getCharacteristic(Characteristic.CurrentRelativeHumidity)
      .on('get', this.getBatteryLevelCharacteristic.bind(this));
    this.services.push(humidityService);
*/
    /* Switch Service */

    let switchService = new Service.Switch("Auto/Home");
    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getSwitchOnCharacteristic.bind(this))
      .on('set', this.setSwitchOnCharacteristic.bind(this));
    //this.services.push(switchService);

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
    this.informationService = informationService;
  /*  this.batteryService = batteryService;
    this.humidityService = humidityService;*/
    this.switchService = switchService;
    this.fanService = fanService;

    return this.services;

  },
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
  /*
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
  */
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
};