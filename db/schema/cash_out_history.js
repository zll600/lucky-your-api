const dbHelper = require('../dbhelper')

const { Schema, model } = dbHelper
const payStatus = require('../../enum/transcation/pay_status')
const schema = new Schema({
  transcation_id: {type: Schema.Types.ObjectId, ref: 'cash_out'},
  pay_status: {
    type: String,
    enum: [
      payStatus.PENDING,
      payStatus.RESOLVED,
      payStatus.ERROR,
      payStatus.CANCELED,
      payStatus.IN_CASH_QUEUE,
    ],
    default: payStatus.PENDING,
  },
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ transcation_id: -1 }, { unique: false })

schema.set('toJSON', { getters: true, virtuals: true })

module.exports = model('cash_out_history', schema)