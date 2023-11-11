const dbHelper = require('../dbhelper')
const {Schema, model} = dbHelper

const schema=new Schema({
  key: String,
  seq_num: {
    type: Number,
    default: 0,
  },
},{
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

schema.statics.findAndModify = function (query, sort, doc, options, callback) {
  return this.collection.findAndModify(query, sort, doc, options, callback)
}
schema.index({ key: -1 }, { unique: true })
schema.set('toJSON', { getters: true, virtuals: true})
module.exports = model('Counter', schema)