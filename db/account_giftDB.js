const db = require('./schema/account_gift')  
const BaseDB = require('./baseDB')
module.exports = class Account_giftDB extends BaseDB {
  static getDB() {
    return db
  }
}