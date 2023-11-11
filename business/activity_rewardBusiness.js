const model = require('../db/activity_rewardDB')
const BaseBusiness = require('./baseBusiness')
module.exports = class Activity_rewardBusiness extends BaseBusiness {
  static getModel() {
    return model
  }
}