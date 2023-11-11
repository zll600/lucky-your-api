const dbHelper = require('../dbhelper')

const { Schema, model } = dbHelper

const schema = new Schema({
  account_id: Number,
  check_in_date: String,
  check_in_type: Number, // 0:未签到 1:签到 2:补签
  day_continue: Number, // 距离上次打卡天数
  claimed: Boolean, // 当天奖励是否领取
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ account_id: -1, check_in_date: -1}, { unique: true })
schema.index({ account_id: -1, check_in_date: 1}, { unique: true })
schema.index({ account_id: -1, created_at: -1}, { unique: false })
module.exports = model('account_checkin', schema)