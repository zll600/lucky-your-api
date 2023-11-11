const dbHelper = require('../dbhelper')
const { Schema, model } = dbHelper

const schema = new Schema({
  account_id: Number,
  type: String,
  amount: Number,
  purpose: String,
  memo: String,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ account_id: 1, created_at: -1 }, { unique: false })
schema.set('toJSON', { getters: true, virtuals: true })
module.exports = model('Point_transcation', schema)