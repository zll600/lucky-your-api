const db = require('./schema/account_checkin')  
const BaseDB = require('./baseDB')
module.exports = class Account_checkinDB extends BaseDB {
  static getDB() {
    return db
  }
}