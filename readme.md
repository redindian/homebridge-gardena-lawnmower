# Homebridge support for Gardena lawnn mowers

This Homebridge plugin provides homekit support for Gardena lawnmowers. The requirement is a smart robot with smart system connection (e.g. smart SILENO City).
The connection is implemented in the form of a fan, as Homekit does not yet support lawnmowers. When switched on, the robot runs for 3 hours (in future configurable via a parameter). Switching off means parking.

## Usage

`npm install -g homebridge-gardena-mower`

Config as below:  
``` json
{  
	"accessory": "gardena-mower",  
	"name": "name-of-your-mower",  
	"manufacturer": "Mower Manufacturer",  
	"model": "Mower Model",  
	"username": "Gardena Username",
	"password": "Gardena Password"
}  
```

## Credits:
This plugin is a fork from [homebridge-gardena-lawnmower](https://github.com/redindian/homebridge-gardena-lawnmower) by [redindian](https://github.com/redindian)