const model = require('../db/giftDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class GiftBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}