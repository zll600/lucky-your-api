const dbHelper = require('../dbhelper')
const payStatus = require('../../enum/transcation/pay_status')
const { Schema, model } = dbHelper

const schema = new Schema({
  account_id: Number,
  country_code: String,
  amount: Number,
  gold_coins: Number,
  fee: Number,
  cash_balance: Number,
  diamonds_balance: Number,
  gold_coins_balance: Number,
  ewallet: Schema.Types.Mixed,
  purpose: String,
  memo: String,
  pay_status: {
    type: String,
    enum: [
      payStatus.PENDING,
      payStatus.RESOLVED,
      payStatus.ERROR,
      payStatus.CANCELED,
    ],
    default: payStatus.PENDING,
  },
  cash_rule_id: String,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ account_id: -1, purpose: -1 }, { unique: false })
schema.index({ account_id: -1, cash_rule_id: -1 }, { unique: false })
schema.index({ account_id: -1, pay_status: -1 }, { unique: false })
schema.index({ purpose: -1 }, { unique: false })
schema.index({ account_id: -1, created_at: -1 }, { unique: false})
schema.set('toJSON', { getters: true, virtuals: true })

module.exports = model('cash_out', schema)