const model = require('../db/cash_out_historyDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Cash_out_historyBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}