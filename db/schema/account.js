const dbHelper = require('../dbhelper')
const counter = require('./counter')

const { Schema, model } = dbHelper

const schema = new Schema({
  id: Number,
  email: String,
  country_code: String,
  time_zone_offset: String,
  name: String,
  first_time_login: Schema.Types.Mixed,
  device_type: String,
  join_activity: {
    type: Boolean,
    value: false,
  },
  diamonds: {
    type: Number,
    value: 0,
  },
  cash: {
    type: Number,
    value: 0,
  },
  gold_coins: {
    type: Number,
    value: 0,
  },
  ewallet: Schema.Types.Mixed,
  ad_count: {
    type: Number,
    value: 0,
  },
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ id: -1 }, { unique: true })
schema.index({ email: -1 }, { unique: true })
schema.index({ 'ewallet.type': -1, 'ewallet.ewallet_number': -1 }, { unique: true })
schema.index({ created_at: -1 }, { unique: false })
schema.set('toJSON', { getters: true, virtuals: true })
schema.pre('save', function (next) {
  const account = this
  counter.findOneAndUpdate({ key: 'account' }, { $inc: { seq_num: 1 } }, { upsert: true }, (err, doc, _) => {
    if (err) {
      return console.log(err)
    }

    account.id = ((doc && doc.seq_num) || 0) + 1
    next()
  })
})
module.exports = model('account', schema)