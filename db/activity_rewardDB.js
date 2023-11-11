const db = require('./schema/activity_reward')
const BaseDB = require('./baseDB')
module.exports = class Activity_rewardDB extends BaseDB {
  static getDB() {
    return db
  }

  static async getListByCondition(condition, pageSize, pageNo, sort) {
    const db = this.getDB()

    return db
      .find(condition)
      .populate('activity_id')
      .sort(sort)
      .skip((pageNo - 1) * pageSize)
      .limit(pageSize)
      .exec()
  }
}