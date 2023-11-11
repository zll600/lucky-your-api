const _ = require('lodash')
const activityBusiness = require('../business/activityBusiness')
const activityRewardBusiness = require('../business/activity_rewardBusiness')
const configBusiness = require('../business/configBusiness')
const { PROJECT_NAME: projectName, PROJECT_NAME } = require('../constants')
const { redisCluster } = require('../lib/redis_cluster')
const { getBitMapOffsets } = require('../utils')
const { getCurrentDate } = require('./date')
const { datadogIncrementWithValue } = require('./datadog')
const { logBigQueryAsync } = require('./googlecloud')
const pendActivityMap = {}

async function getActivity(countryCode = 'PH', configActivityRule) {
  const {
    type: activityType,
    interval_seconds: intervalSeconds,
    amount,
    ad_count: adCount,
    new_user: newUser,
    currency,
  } = configActivityRule
  // Read cache 
  const cachePendingActivity = pendActivityMap[`${activityType}_${countryCode}`]
  if (
    cachePendingActivity
    && cachePendingActivity.start_time
    && cachePendingActivity.end_time
    && cachePendingActivity.start_time <= Date.now()
    && cachePendingActivity.end_time > Date.now()
  ) {
    return cachePendingActivity
  }

  // Read DB
  const pendingActivity = await activityBusiness.getOneByCondition({
    start_time: { $lte: Date.now() },
    end_time: { $gt: Date.now() },
    type: activityType,
    country_code: countryCode,
  })
  if (pendingActivity) {
    pendActivityMap[`${activityType}_${countryCode}`] = pendingActivity

    return pendingActivity
  }

  // Add activity and return 
  const lastFinishActivity = await activityBusiness.getOneByConditionAndSortBy({
    end_time: { $lte: Date.now() },
    type: activityType,
    country_code: countryCode,
  })

  if (!lastFinishActivity) {
    throw new Error('There is no finished activity!')
  }
  let endTime = lastFinishActivity.end_time
  while (endTime < Date.now()) {
    endTime += intervalSeconds * 1000
  }

  const newPendingActivity = await activityBusiness.findOneAndUpdate({
    type: activityType,
    end_time: endTime,
    country_code: countryCode,
  },
  {
    type: activityType,
    amount,
    ad_count: adCount,
    country_code: countryCode,
    end_time: endTime,
    start_time: endTime - intervalSeconds * 1000,
    new_user: newUser,
    currency,
  })
  pendActivityMap[`${activityType}_${countryCode}`] = newPendingActivity

  return newPendingActivity
}

function getActivityAdDisplayCountKey(activityId) {
  return `${projectName}:activity_ad_display_count:${activityId}`
}

async function getActivityAdCountAsync(activityId, accountId) {
  const key = getActivityAdDisplayCountKey(activityId)
  const count = await redisCluster.zscore(key, accountId)

  return count
}

async function incrActivityAdCountAsync(activityId, accountId, incrNumber = 1) {
  const key = getActivityAdDisplayCountKey(activityId)

  return redisCluster.zincrbyEx(key, incrNumber, accountId, 30 * 86400)
}

async function getActivityAdCountByScore(activityId, maxScore, minScore) {
  const key = getActivityAdDisplayCountKey(activityId)

  return redisCluster._cluster.zrevrangebyscore(key, maxScore, minScore)
}

function getActivityNewUserKey(activityId) {
  return `${projectName}:activity_new_user_bitmap:${activityId}`
}

async function addNewUserInActivityAsync(activityId, accountId) {
  const key = getActivityNewUserKey(activityId)

  return redisCluster.setbitEx(key, accountId, 1, 7 * 86400)
}

async function getActivityNewUserAccountIdsAsync(activityId) {
  const key = getActivityNewUserKey(activityId)

  return getBitMapOffsets(key)
}

function getUVKey(timezoneOffset) {
  const currentDate = getCurrentDate(timezoneOffset)

  return `${projectName}:user_visitor_bitmap:${currentDate}`
}

function setHasStatisticsUVAsync(accountId, timezoneOffset) {
  const key = getUVKey(timezoneOffset)

  return redisCluster.setbitEx(key, accountId, 1, 7 * 86400)
}

function getWatchVideoBitmapKey(timezoneOffset) {
  const currentDate = getCurrentDate(timezoneOffset)

  return `${projectName}:watch_video_bitmap:${currentDate}`
}

async function getAccountWatchVideoAsync(accountId, timezoneOffset) {
  const key = getWatchVideoBitmapKey(timezoneOffset)

  return redisCluster.setbitEx(key, accountId, 1, 7 * 86400)
}

function getWatchVideoTypeBitmapKey(timezoneOffset, type) {
  const currentDate = getCurrentDate(timezoneOffset)

  return `${projectName}:watch_video_bitmap_${type}:${currentDate}`
}

async function getAccountWatchVideoTypeAsync(accountId, type, timezoneOffset) {
  const key = getWatchVideoTypeBitmapKey(timezoneOffset, type)

  return redisCluster.setbitEx(key, accountId, 1, 7 * 86400)
}

async function getWinAccountIdsAsync(activity, drawCount) {
  let winUserAccountIds = []
  for (let i = activity.ad_count; i >= 1; i--) {
    const oldUserAccountIds = await getActivityAdCountByScore(activity._id, i, `(${i - 1}`)
    if (oldUserAccountIds.length >= drawCount) {
      const winOldUserAccountIds = _.sampleSize(oldUserAccountIds, drawCount)

      winUserAccountIds = winUserAccountIds.concat(winOldUserAccountIds)
      break
    }

    winUserAccountIds = winUserAccountIds.concat(oldUserAccountIds)
    drawCount -= oldUserAccountIds.length
  }

  return winUserAccountIds
}

async function getWinAccountIds(activity, ecpm, exchangeRate, rewardPercent) {
  if (activity.total_ad_display_count === 0) {
    return []
  }
  const totalMoney = activity.total_ad_display_count * ecpm * exchangeRate / 1000
  if (activity.new_user && activity.new_user.win_percent) {
    const newUserAccountIds = await getActivityNewUserAccountIdsAsync(activity._id)
    const needWinNewUserCount = newUserAccountIds.length * activity.new_user.win_percent / 100

    // 新用户超支
    const drawCount = Math.floor(
      (totalMoney * rewardPercent / 100 - needWinNewUserCount * activity.amount) / activity.amount)
    if (drawCount <= 0) {
      return _.sampleSize(newUserAccountIds, needWinNewUserCount)
    }

    return newUserAccountIds.concat(await getWinAccountIdsAsync(activity, drawCount))
  }

  const drawCount = Math.floor(totalMoney * rewardPercent / (activity.amount * 100))

  return getWinAccountIdsAsync(activity, drawCount)
}

async function drawActivityAsync(countryCode) {
  const [configRewardRule, ecpm, exchangeRate, rewardPercent] = await Promise.all([
    configBusiness.getConfigValue('activity_rule'),
    configBusiness.getConfigValue('ad_ecpm'),
    configBusiness.getConfigValue('exchange_rate'),
    configBusiness.getConfigValue('reward_percent'),
  ])
  if (!configRewardRule || !configRewardRule[countryCode]) {
    throw new Error('Config reward rule error')
  }

  const countryRule = configRewardRule[countryCode]
  for (const rule of countryRule) {
    const activity = await activityBusiness.getOneByConditionAndSortBy({
      type: rule.type,
      country_code: countryCode,
      end_time: { $lte: Date.now() },
      drawed: false,
      total_ad_display_count: { $gt: 0 },
    }, {
      end_time: -1,
    })

    if (!activity) {
      continue
    }

    const winAccountIds = await getWinAccountIds(activity, ecpm[countryCode], exchangeRate[countryCode], rewardPercent)
    console.log('winAccountIds>>>>>>', JSON.stringify(winAccountIds, null, 2))
    if (winAccountIds && winAccountIds.length > 0) {
      datadogIncrementWithValue(`${PROJECT_NAME}_win_count`, winAccountIds.length, [`type:${activity.type}`])
      datadogIncrementWithValue(
        `${PROJECT_NAME}_win_money_amount`,
        winAccountIds.length * activity.amount,
        [`type:${activity.type}`],
      )
      
      await winAccountIds.map(accountId => {
        logBigQueryAsync('transcation', 'lucky_you_diamonds', {
          account_id: accountId,
          amount: activity.amount * 100,
          purpose: `draw_${activity.type}_win`,
          country_code: countryCode,
          paid: false,
          created_at: new Date(),
          money_amount: activity.amount, 
        })

        return activityRewardBusiness.findOneAndUpdate({
          account_id: parseInt(accountId, 10),
          activity_id: activity._id,
        }, {
          win: true,
        })
      })
    }
    await activityBusiness.findOneAndUpdate({ _id: activity._id }, { drawed: true })
  }
}

function getDrawAdSessionRedisKey(adSessionId, type) {
  return `${projectName}:${type}:${adSessionId}`
}

async function setDrawAdSessionIdAsync(adSessionId, type, expireSeconds) {
  const key = getDrawAdSessionRedisKey(adSessionId, type)

  return redisCluster.setex(key, expireSeconds, 1)
}

async function getDrawAdSessionIdAsync(adSessionId, type) {
  const key = getDrawAdSessionRedisKey(adSessionId, type)

  return redisCluster.get(key)
}

async function delDrawAdSessionIdAsync(adSessionId, type) {
  const key = getDrawAdSessionRedisKey(adSessionId, type)

  return redisCluster.del(key)
}

async function drawJob() {
  const countryCodes = ['PH']
  try {
    for (const countryCode of countryCodes) {
      await drawActivityAsync(countryCode)
    }
  } catch (error) {
    console.log(error)
  } finally {
    // process.exit(0)
  }

}

module.exports = {
  addNewUserInActivityAsync,
  delDrawAdSessionIdAsync,
  drawActivityAsync,
  drawJob,
  getActivity,
  getActivityAdCountAsync,
  getDrawAdSessionIdAsync,
  getAccountWatchVideoAsync,
  getAccountWatchVideoTypeAsync,
  incrActivityAdCountAsync,
  setDrawAdSessionIdAsync,
  setHasStatisticsUVAsync,
}