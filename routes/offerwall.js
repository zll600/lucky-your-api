const router = require('koa-router')()
const {okspin, ironsource} = require('../utils/offerwall')

router.prefix('/offerwall')

router.get('/ok-spin', async (ctx) => {
  try {
    const query = ctx.request.query
    const result = await okspin(query)
    ctx.body = result
  } catch (error) {
    throw error
  }
})

router.get('/iron-source', async (ctx) => {
  try {
    const query = ctx.request.query
    const result = await ironsource(query)
    ctx.body = result
  } catch (error) {
    throw error
  }
})

module.exports = router