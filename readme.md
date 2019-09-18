# Homebridge-Lawnmower for Gardena Smart System

## Credits:
This is based upon [Homebridge-Lawnmower for Gardena Smart System](https://www.npmjs.com/package/homebridge-lawnmower) by [Thorsten Pohl](https://www.npmjs.com/~thpohl)

Which is based upon the great [Homebridge Plugin for Robonect](https://www.npmjs.com/package/homebridge-robonect) by [Larsan](https://www.npmjs.com/~larsan).

## Usage

`npm install -g homebridge-lawnmower`

Config as below:  
``` json
{  
	"accessory": "HomebridgeGardena",  
	"name": "name-of-your-mower",  
	"mower": "Mower make",  
	"model": "Mower Model",  
	"username": "Gardena Username",
	"password": "Gardena Password",
	"location-id": "yourlocationId",
	"mower-id":"yourmowerid"
}  
```
