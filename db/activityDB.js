const db = require('./schema/activity')  
const BaseDB = require('./baseDB')
module.exports = class ActivityDB extends BaseDB {
  static getDB() {
    return db
  }
}