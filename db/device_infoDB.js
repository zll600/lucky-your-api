const db = require('./schema/device_info')  
const BaseDB = require('./baseDB')
module.exports = class Device_infoDB extends BaseDB {
  static getDB() {
    return db
  }
}