const model = require('../db/counterDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class CounterBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}