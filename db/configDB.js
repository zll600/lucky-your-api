const db = require('./schema/config')  
const BaseDB = require('./baseDB')
module.exports = class ConfigDB extends BaseDB {
  static getDB() {
    return db
  }
}