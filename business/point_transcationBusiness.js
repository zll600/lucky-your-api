const model = require('../db/point_transcationDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Point_transcationBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}