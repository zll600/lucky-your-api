const dbHelper = require('../dbhelper')

const { Schema, model } = dbHelper

const schema = new Schema({
  account_id: Number,
  voucher: Schema.Types.Mixed,
  box: Schema.Types.Mixed,
  opened: Schema.Types.Boolean,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ account_id: -1 }, { unique: true })

module.exports = model('account_gift', schema)