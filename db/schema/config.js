const dbHelper = require('../dbhelper')

const { Schema, model } = dbHelper

const schema = new Schema({
  key: String,
  value: Schema.Types.Mixed, 
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ key: -1 }, { unique: true })
schema.set('toJSON', { getters: true, virtuals: true})
module.exports = model('config', schema)