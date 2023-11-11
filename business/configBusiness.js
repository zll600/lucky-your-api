const model = require('../db/configDB')
const BaseBusiness = require('./baseBusiness')

const configMap = {}
module.exports = class ConfigBusiness extends BaseBusiness {
  static getModel() {
    return model
  }

  static async getConfigValue(key) {
    if (configMap[key] && configMap[key].value && configMap[key].created_at > Date.now() - 60 * 1000) {
      return configMap[key].value
    }

    const configModel = await this.getOneByCondition({ key })
    if (!configModel) {
      return undefined
    }

    configMap[key] = {
      value: configModel.value,
      created_at: Date.now(),
    }

    return configMap[key].value
  }
}