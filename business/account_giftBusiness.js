const model = require('../db/account_giftDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Account_giftBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}