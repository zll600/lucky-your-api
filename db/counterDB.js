const db = require('./schema/counter')  
const BaseDB = require('./baseDB')
module.exports = class CounterDB extends BaseDB {
  static getDB() {
    return db
  }
}