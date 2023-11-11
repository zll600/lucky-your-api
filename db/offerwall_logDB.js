const db = require('./schema/offerwall_log')  
const BaseDB = require('./baseDB')
module.exports = class Offerwall_logDB extends BaseDB {
  static getDB() {
    return db
  }
}