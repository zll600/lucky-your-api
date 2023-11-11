const db = require('./schema/cash_out')  
const BaseDB = require('./baseDB')
module.exports = class Cash_outDB extends BaseDB {
  static getDB() {
    return db
  }
}