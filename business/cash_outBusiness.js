const model = require('../db/cash_outDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Cash_outBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}