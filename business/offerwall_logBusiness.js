const model = require('../db/offerwall_logDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Offerwall_logBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}