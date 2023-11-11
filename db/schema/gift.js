const dbHelper = require('../dbhelper')

const { Schema, model } = dbHelper

const schema = new Schema({
  name: String,
  type: String,
  price: Number,
  order: Number,
  country_code: String,
  start_time: Date,
  end_time: Date,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.set('toJSON', { getters: true, virtuals: true })

module.exports = model('gift', schema)