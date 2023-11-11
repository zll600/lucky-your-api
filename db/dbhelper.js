/*
 * @Description: In User Settings Edit
 * @Author: your name
 * @Date: 2019-08-08 10:54:43
 * @LastEditTime: 2019-09-11 10:39:36
 * @LastEditors: Please set LastEditors
 */
const mongoose = require('mongoose')
// eslint-disable-next-line no-undef
if (process.env.NODE_ENV !== 'production') {
  mongoose.set('debug',true)
}
const config = require('../customer.config')
const conn = mongoose.createConnection(config.MONGODB_BUZZBREAK_USER_CENTER, {
  dbName: 'luckyyou',
  useNewUrlParser: true,
})

const Schema = mongoose.Schema
module.exports = {
  db: conn,
  Schema: Schema,
  model: (modelName, schema) => { return conn.model(modelName, schema) },
}
