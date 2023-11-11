const model = require('../db/account_checkinDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Account_checkinBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}