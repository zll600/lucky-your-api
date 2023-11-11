const model = require('../db/sessionDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class SessionBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}