const dbHelper = require('../dbhelper')
const { Schema, model } = dbHelper

const schema = new Schema({
  account_id: Number,
  device_id: String,
  app_version_code: Number,
  country_code: String,
  device_model: String,
  device_type: String,
  ips: [String],
  os_version: Number,
  // fb:fbSchema
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ created_at: -1 }, { unique: false })
schema.index({ updated_at: -1 }, { unique: false })
schema.index({ account_id: 1, device_id: 1 }, { unique: false })
schema.index({ created_at: 1, updated_at: -1 }, { unique: false })
schema.set('toJSON', { getters: true, virtuals: true })
module.exports = model('Session', schema)