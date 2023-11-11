const router = require('koa-router')()

const accountBusiness = require('../business/accountBusiness')
const activityBusiness = require('../business/activityBusiness')
const activityRewardBusiness = require('../business/activity_rewardBusiness')
const configBusiness = require('../business/configBusiness')
const deviceInfoBusiness = require('../business/device_infoBusiness') 

const { account, checksum, login, limit } = require('../middlewares')
const {
  getCountryCodeByIpAsync,
  getAccountAttributesAsync,
  getAccountFirstOpenOfferwallAsync,
} = require('../utils/user')
const {
  addNewUserInActivityAsync,
  delDrawAdSessionIdAsync,
  drawJob,
  getActivity,
  incrActivityAdCountAsync,
  getAccountWatchVideoAsync,
  getAccountWatchVideoTypeAsync,
  setHasStatisticsUVAsync,
} = require('../utils/activity')
const { OK, WRONG_PARAMETERS } = require('../enum/code')
const { datadogIncrement } = require('../utils/datadog')
const { PROJECT_NAME } = require('../constants')
const { logBigQueryAsync } = require('../utils/googlecloud')
const { getDateAccountWatchVideoBoxGiftCountAsync } = require('../utils/box')
const { LAST_LOGIN_TIME } = require('../enum/account')
router.prefix('/activity')

router.get('/list', checksum, account, async (ctx) => {
  try {
    const {
      account_id: accountId,
      device_id: deviceId,
    } = ctx.state.luckyyou
    let countryCode = ''
    let timeZoneOffset = '+08:00'
    let adCount = 0
    let watchVideoGiftBoxCount = 0
    let showBeginnerGuide = true
    let showOfferWallWarning = false
    if (!accountId || accountId < 0) {
      countryCode = await getCountryCodeByIpAsync(ctx.request)
    } else {
      const account = await accountBusiness.getOneByCondition({ id: accountId })
      if (!account) {
        return ctx.throw('Wrong Parameters', 401, {
          code: WRONG_PARAMETERS,
          message: 'Wrong Parameters',
        })
      }

      const [
        _watchVideoGiftBoxCount,
        [_lastLoginTime],
        showOfferWallWarningValue,
      ] = await Promise.all([
        getDateAccountWatchVideoBoxGiftCountAsync(
          accountId,
          account.time_zone_offset || '+08:00',
        ),
        getAccountAttributesAsync(accountId, [LAST_LOGIN_TIME]),
        getAccountFirstOpenOfferwallAsync(accountId),
      ])
      watchVideoGiftBoxCount = _watchVideoGiftBoxCount
      countryCode = account.country_code
      timeZoneOffset = account.time_zone_offset || '+08:00'
      adCount = account.ad_count
      showOfferWallWarning = showOfferWallWarningValue === 0 
    }

    const [
      activityRule,
      giftBoxAdCount,
      boxType,
      watchVideoBoxGiftCountLimit,
      deviceInfo,
      offerwallList,
      configCashRate,
    ] = await Promise.all([
      configBusiness.getConfigValue('activity_rule'),
      configBusiness.getConfigValue('gift_box_ad_count'),
      configBusiness.getConfigValue('box_type'),
      configBusiness.getConfigValue('every_day_watch_ad_box_gift_count_limit'),
      deviceInfoBusiness.getOneByCondition({ device_id: deviceId }),
      configBusiness.getConfigValue('offerwall_list'),
      configBusiness.getConfigValue('gold_coin_to_cash_rate'),
    ])
    if (!activityRule) {
      return ctx.throw('Internal Server Error', 401, {
        code: WRONG_PARAMETERS,
        message: 'Internal Server Error',
      })
    }

    if (!activityRule[countryCode]) {
      countryCode = 'PH'
    }

    if (deviceInfo && !deviceInfo.show_beginner_guide) {
      showBeginnerGuide = false
    } else {
      datadogIncrement(`${PROJECT_NAME}_show_beginner_guide_dialog`)
      await deviceInfoBusiness.findOneAndUpdate(
        { device_id: deviceId }, 
        { show_beginner_guide: false, account_id: accountId },
      )
    }

    const activityCountryRule = activityRule[countryCode]
    const countryOfferWallList = offerwallList[countryCode] || []
    const cashRate = configCashRate[countryCode] || configCashRate['PH']
    let activities = await Promise.all(activityCountryRule.map(item => getActivity(countryCode, item)))
    if (!activities) {
      return ctx.throw('Internal Server Error', 401, {
        code: WRONG_PARAMETERS,
        message: 'Internal Server Error',
      })
    }

    let activityRewards = []
    const activityIds = []
    const now = Date.now()
    activities = activities.map(activity => {
      activity = activity.toJSON()
      activity.remaining_time = activity.end_time - now
      activity.ad_display_count = 0
      activityIds.push(activity._id.toString())

      return activity
    })

    logBigQueryAsync('events', 'lucky_you_uv_events', {
      account_id: accountId,
      device_id: deviceId,
      name: 'get_activity_list',
      created_at: new Date(),
      country_code: countryCode,
    })
    
    if (accountId && accountId > 0) {
      activityRewards = await activityRewardBusiness.getByCondition({
        account_id: accountId,
        activity_id: {
          $in: activityIds,
        },
      })
      for (const activity of activities) {
        const activityReward = activityRewards.find(item => item.activity_id.toString() === activity._id.toString())
        activity.ad_display_count = activityReward ? activityReward.ad_count : 0
      }

      const hasStatisticsUV = await setHasStatisticsUVAsync(accountId, timeZoneOffset)
      if (!hasStatisticsUV) {
        datadogIncrement(`${PROJECT_NAME}_DAU_statictics`)
      }
    }

    ctx.body = {
      code: OK,
      data: {
        activities,
        country_code: countryCode,
        ad_count: adCount || 0,
        gift_box_ad_count: giftBoxAdCount,
        box_type: boxType,
        config_watch_video_gift_box_count_limit: watchVideoBoxGiftCountLimit,
        watch_video_gift_box_count: watchVideoGiftBoxCount,
        show_beginner_guide: showBeginnerGuide,
        login_success: accountId > 0,
        offerwall_list: countryOfferWallList,
        show_offer_wall_warning: showOfferWallWarning,
        cash_rate: cashRate,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/watch-ad', checksum, account, login, limit('activity-display-ad'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const { activity_type: activityType, ad_id: adId } = ctx.request.body
    const [account, activityRule] = await Promise.all([
      accountBusiness.getOneByCondition({ id: accountId }),
      configBusiness.getConfigValue('activity_rule'),
    ])

    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const countryCode = activityRule[account.country_code] ? account.country_code : 'PH'

    const activityCountryRule = activityRule[countryCode]
    let activities = await Promise.all(activityCountryRule.map(item => getActivity(countryCode, item)))
    if (!activities) {
      return ctx.throw('Internal Server Error', 401, {
        code: WRONG_PARAMETERS,
        message: 'Internal Server Error',
      })
    }

    const activity = activities.find(item => item.type === activityType)
    if (!activity) {
      return ctx.throw('Internal Server Error', 401, {
        code: WRONG_PARAMETERS,
        message: 'Internal Server Error',
      })
    }
    const activityId = activity._id

    const activityReward = await activityRewardBusiness.getOneByCondition(
      {
        activity_id: activityId,
        account_id: accountId,
      },
    )

    if (activityReward && activityReward.ad_count && activityReward.ad_count >= activity.ad_count) {
      throw new Error('You have reached the limit!')
    }

    const watchedAd = await delDrawAdSessionIdAsync(adId, `draw_${activity.type}`)
    if (process.env.NODE_ENV === 'production' && !watchedAd) {
      throw new Error(' Haven\'t watched video!')
    }

    datadogIncrement(`${PROJECT_NAME}_watch_video_count`, [`type:${activity.type}`])
    const [
      hasWatch,
      typeHasWatch,
      watchVideoBoxGiftCountLimit,
      accountWatchVideoBoxGiftCount,
    ] = await Promise.all([
      getAccountWatchVideoAsync(accountId, account.time_zone_offset || '+08:00'),
      getAccountWatchVideoTypeAsync(accountId, activity.type, account.time_zone_offset || '+08:00'),
      configBusiness.getConfigValue('every_day_watch_ad_box_gift_count_limit'),
      getDateAccountWatchVideoBoxGiftCountAsync(
        accountId,
        account.time_zone_offset || '+08:00',
      ),
    ])

    if (!hasWatch) {
      datadogIncrement(`${PROJECT_NAME}_watch_video_user_count`)
    }

    if (!typeHasWatch) {
      datadogIncrement(`${PROJECT_NAME}_watch_video_type_user_count`, [`type:${activity.type}`])
    }

    const incAdCount = accountWatchVideoBoxGiftCount >= watchVideoBoxGiftCountLimit ? 0 : 1
    const promiseArray = [
      accountBusiness.findOneAndUpdate(
        { id: accountId },
        { join_activity: true, $inc: { ad_count: incAdCount } },
      ),
      activityRewardBusiness.findOneAndUpdate({
        account_id: accountId,
        activity_id: activityId,
      }, {
        account_id: accountId,
        activity_id: activityId,
        end_time: activity.end_time,
        start_time: activity.start_time,
        $inc: { ad_count: 1 },
      }),
      activityBusiness.findOneAndUpdate(
        { _id: activityId },
        { $inc: { total_ad_display_count: 1 } },
      ),
      incrActivityAdCountAsync(activityId, accountId, 1),
    ]
    if (!account.join_activity) {
      promiseArray.push(addNewUserInActivityAsync(activityId, accountId))
    }
    const [newAccount] = await Promise.all(promiseArray)

    const activityRewards = await activityRewardBusiness.getByCondition({
      account_id: accountId,
      activity_id: {
        $in: activities.map(item => item._id),
      },
    })

    activities = activities.map(activity => {
      activity = activity.toJSON()
      activity.remaining_time = activity.end_time - Date.now()
      const activityReward = activityRewards.find(item => item.activity_id.toString() === activity._id.toString())
      activity.ad_display_count = activityReward ? activityReward.ad_count : 0

      return activity
    })

    ctx.body = {
      code: OK,
      data: {
        activities,
        ad_count: (newAccount && newAccount.ad_count) || 0,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/draw-activity', async (ctx) => {
  try {
    await drawJob()
    ctx.body = {
      code: OK,
      data: null,
    }
  } catch (error) {
    throw error
  }
})

module.exports = router