const { logBigQueryAsync } = require('../utils/googlecloud')
const { datadogHistogram, datadogIncrement } = require('../utils/datadog')
const { setDrawAdSessionIdAsync } = require('./activity')
const accountBusiness = require('../business/accountBusiness')
const { getCurrentDate } = require('../utils/date')
const { PROJECT_NAME } = require('../constants')
const { redisCluster } = require('../lib/redis_cluster')
const { setAccountFirstOpenOfferwallAsync } = require('../utils/user')
const typeEventMap = {
  install_referrer: 'onlyBigquery',
  api_load: 'feed',
  web_load: 'feed',
  ad_flow: 'ad',
  show_beginner_guide: 'showBeginnerGuide',
  app_open: 'appOpen',
  offerwall_click: 'offerwallClick',
}

async function insertBigqueryEvent(accountId, deviceId, event, payload) {
  const account = await accountBusiness.getOneByCondition({id: accountId})
  let countryCode = ''
  if (account) {
    countryCode = account.country_code
  }
  const row = {
    event_name: event,
    account_id: accountId,
    country_code: countryCode,
    created_at: new Date(),
    device_id: deviceId,
    payload: JSON.stringify(payload),
  }

  logBigQueryAsync('events', 'luckyyou_stream_events', row)

  return countryCode
}

const mapHandler = {
  feed: async (ctx, accountId, deviceId, event, payload) => {
    const { duration_in_millis: durationMillis , placement } = payload
    datadogHistogram(`${PROJECT_NAME}_app_feed_duration`, durationMillis, [`placement:${placement}`])

    // await insertBigqueryEvent(accountId, deviceId, event, payload)

    return ctx.body = {
      code: 0,
      data: null,
    }
  },
  onlyBigquery: async (ctx, accountId, deviceId, event, payload) => {
    await insertBigqueryEvent(accountId, deviceId, event, payload)

    return ctx.body = {
      code: 0,
      data: null,
    } 
  },
  ad: async (ctx, accountId, deviceId, event, payload) => {
    if (
      payload.flow_step === 'impression'
    ) {
      const adSessionId = payload.ad_session_id

      await setDrawAdSessionIdAsync(adSessionId, payload.placement, 600)
    }

    if (
      payload.flow_step === 'click'
    ) {
      datadogIncrement(`${PROJECT_NAME}_ad_click`, [`platform:${payload.platform}`])
    }

    await insertBigqueryEvent(accountId, deviceId, event, payload)

    return ctx.body = {
      code: 0,
      data: null,
    }
  },
  showBeginnerGuide: async (ctx, accountId, deviceId, event, payload) => {
    const currentDate = getCurrentDate('+00:00')
    const key = `${PROJECT_NAME}:beginner_guide:${deviceId}:${currentDate}`
    const oldValue = await redisCluster._cluster.get(key)
    if (!oldValue) {
      datadogIncrement(`${PROJECT_NAME}_enter_show_beginner_guide`)
      await redisCluster._cluster.setex(key, 86400 * 3, '1')
    }
    await insertBigqueryEvent(accountId, deviceId, event, payload)

    return ctx.body = {
      code: 0,
      data: null,
    } 
  },
  appOpen: async (ctx, accountId, deviceId, event, payload) => {
    const countryCode = await insertBigqueryEvent(accountId, deviceId, event, payload)
    
    logBigQueryAsync('events', 'lucky_you_uv_events', {
      account_id: accountId,
      device_id: deviceId,
      name: 'app_open',
      created_at: new Date(),
      country_code: countryCode,
    })

    return ctx.body = {
      code: 0,
      data: null,
    } 
  },
  offerwallClick: async (ctx, accountId, deviceId, event, payload) => {
    if (accountId > 0 ) {
      await setAccountFirstOpenOfferwallAsync(accountId)
      await insertBigqueryEvent(accountId, deviceId, event, payload)
    }

    return ctx.body = {
      code: 0,
      data: null,
    }  
  },
}

module.exports = {
  typeEventMap,
  mapHandler,
}
