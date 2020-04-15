[![npm](https://img.shields.io/npm/v/homebridge-gardena-mower.svg?style=plastic)](https://www.npmjs.com/package/homebridge-gardena-mower)
[![npm](https://img.shields.io/npm/dt/homebridge-gardena-mower.svg?style=plastic)](https://www.npmjs.com/package/homebridge-gardena-mower)
[![GitHub last commit](https://img.shields.io/github/last-commit/neuhausf/homebridge-gardena-mower.svg?style=plastic)](https://github.com/neuhausf/homebridge-gardena-mower)
# homebridge-gardena-mower

This [homebridge](https://github.com/nfarina/homebridge) plugin provides homekit support for Gardena lawnmowers. The requirement is a smart robot with [smart system](https://www.gardena.com/int/products/smart) connection (e.g. smart SILENO City).
The connection is implemented in the form of a fan, as Homekit does not yet support lawnmowers. When switched on, the robot runs for 3 hours (configurable via `mowingDurationSeconds`). Switching off means parking.

## Usage

`npm install -g homebridge-gardena-mower`

## Configuration
You can also configure this plugin via [ConfigUI-X's settings](https://github.com/oznu/homebridge-config-ui-x/wiki/Developers:-Plugin-Settings-GUI) feature.

``` json
"accessories": [
	{  
		"accessory": "gardena-mower",  
		"name": "name-of-your-mower",  
		"manufacturer": "Mower Manufacturer",  
		"model": "Mower Model",
		"mowingDurationSeconds": 10800,
		"username": "Gardena Username",
		"password": "Gardena Password"
	}  
],
```

## Credits
This plugin is a fork from [homebridge-gardena-lawnmower](https://github.com/redindian/homebridge-gardena-lawnmower) by [redindian](https://github.com/redindian)
