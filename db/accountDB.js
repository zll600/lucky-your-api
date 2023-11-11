const db = require('./schema/account')  
const BaseDB = require('./baseDB')
module.exports = class AccountDB extends BaseDB {
  static getDB() {
    return db
  }
}