const model = require('../db/device_infoDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Device_infoBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}