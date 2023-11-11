const db = require('./schema/session')  
const BaseDB = require('./baseDB')
module.exports = class SessionDB extends BaseDB {
  static getDB() {
    return db
  }
}