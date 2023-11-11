const dbHelper = require('../dbhelper')
const { Schema, model } = dbHelper

const schema = new Schema({
  account_id: Number,
  event_id: String,
  gold_coin_amount: Number,
  amount: Number,
  platform: String,
  country_code: String,
  payload: Schema.Types.Mixed,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ account_id: -1, event_id: -1}, { unique: false })
schema.set('toJSON', { getters: true, virtuals: true })

module.exports = model('offerwall_log', schema)