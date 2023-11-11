/*
 * @Description: In User Settings Edit
 * @Author: your name
 * @Date: 2019-09-11 14:14:15
 * @LastEditTime: 2019-09-11 14:14:15
 * @LastEditors: your name
 */
const Koa = require('koa')
const app = new Koa()
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const logger = require('koa-logger')
const _ = require('lodash')
const Router = require('koa-router')
const cors = require('koa2-cors')
const koaBody = require('koa-body')

const { recursiveDirFile } = require('./utils')
const { ERROR } = require('./enum/code')
const { feed } = require('./middlewares')
// error handler
onerror(app)
app.use(cors())
// middlewares
app.use(koaBody({
  multipart: true,
  formidable: {
    maxFileSize: 20000 * 1024 * 1024,    // 设置上传文件大小最大限制，默认2M
  },
}))
app.use(bodyparser({
  enableTypes: ['json', 'form', 'text'],
}))
app.use(json())
app.use(logger())

app.use(async (ctx, next) => {
  ctx.headers.get = (key) => {
    return ctx.headers[key.toLocaleLowerCase()]
  }

  await next()
})

// feed
app.use(feed)

app.use(async (ctx, next) => {
  try {
    await next()
  } catch (error) {
    console.error(error)
    if (!error.code) {
      ctx.status = 500
      ctx.body = {
        code: ERROR,
        message: error.message,
      }
    } else {
      ctx.body = {
        code: error.code || 102,
        message: error.message,
      }
    }
  }
})

let routesArray = recursiveDirFile('./routes')
routesArray = _.sortBy(routesArray)
routesArray.forEach(routeItem => {
  const pathName = `./${routeItem.replace(/(\.\/|\.js)/g, '')}`
  const r = require(pathName)
  if (r instanceof Router) {
    app.use(r.routes(), r.allowedMethods())
  }
})

// error-handling
app.on('error', (err, ctx) => {
  debug(err)
  debug('server error', err, ctx)
})
module.exports = app
