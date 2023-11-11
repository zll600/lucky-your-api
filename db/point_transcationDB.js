const db = require('./schema/point_transcation')  
const BaseDB = require('./baseDB')
module.exports = class Point_transcationDB extends BaseDB {
  static getDB() {
    return db
  }
}