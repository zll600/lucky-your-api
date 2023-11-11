const db = require('./schema/gift')  
const BaseDB = require('./baseDB')
module.exports = class GiftDB extends BaseDB {
  static getDB() {
    return db
  }
}