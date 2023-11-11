const { datadogHistogram } =  require('../utils/datadog')

async function feed(ctx, next) {
  const countryCode = (ctx.state && ctx.state.luckydate && ctx.state.luckydate.country_code) || 'Other'
  const start = new Date()
  await next()
  const ms = new Date() - start
  debug(`${ctx.method} ${ctx.url} - ${ms}ms`)
  if (feedMap[ctx.request.path]) {
    datadogHistogram(feedMap[ctx.request.path], ms, [`country_code:${countryCode}`])
  }
}

const feedMap = {
  '/box/opened-boxes': 'draw_notes_feed_durating',
  '/user/points': 'user_diamonds_feed_duration',
}

module.exports = feed