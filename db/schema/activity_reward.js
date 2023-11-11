const dbHelper = require('../dbhelper')

const { Schema, model } = dbHelper

const schema = new Schema({
  activity_id: { type: Schema.Types.ObjectId, ref: 'activity' },
  account_id: Number,
  win: {
    type: Boolean,
    default: false,
  },
  claimed: {
    type: Boolean,
    default: false,
  },
  claim_gift: {
    type: Boolean,
    default: false,
  },
  paid: {
    type: Boolean,
    default: false,
  },
  ad_count: {
    type: Number,
    default: 0,
  },
  start_time: Number,
  end_time:Number,
}, {
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ account_id: -1, activity_id: -1 }, { unique: false })
schema.index({ account_id: -1, end_time: -1,  start_time: -1 }, { unique: false })
schema.index({ activity_id: -1, win: 1 }, { unique: false })
schema.index({ paid: -1 }, { unique: false })
schema.set('toJSON', { getters: true, virtuals: true })
module.exports = model('activity_reward', schema)