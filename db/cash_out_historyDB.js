const db = require('./schema/cash_out_history')  
const BaseDB = require('./baseDB')
module.exports = class Cash_out_historyDB extends BaseDB {
  static getDB() {
    return db
  }
}