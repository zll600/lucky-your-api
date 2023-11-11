const model = require('../db/activityDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class AccountBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}