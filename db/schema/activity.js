const dbHelper = require('../dbhelper')
const { Schema, model } = dbHelper

const schema = new Schema({
  start_time: Number,
  end_time: Number,
  amount: Number,
  type: String,
  country_code: String,
  ad_count: Number,
  currency: String,
  drawed: {
    type: Boolean,
    default: false,
  },
  total_ad_display_count: {
    type: Number,
    default: 0,
  },
  new_user: Schema.Types.Mixed,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: false },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ type: -1, country_code: -1, end_time: -1 }, { unique: true })
schema.index({ 
  type: -1,
  country_code: -1,
  end_time: -1,
  drawed: -1,
  total_ad_display_count: -1,
}, { unique: true })
schema.set('toJSON', { getters: true, virtuals: true })

module.exports = model('activity', schema)