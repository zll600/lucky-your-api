const { getRandomIntInclusive, weightedRandom } = require('./')
const configBusiness = require('../business/configBusiness')
const { PROJECT_NAME } = require('../constants')
const { redisCluster } = require('../lib/redis_cluster')
const { getCurrentDate } = require('./date')
const { setAccountFirstOpenBoxAsync } = require('./user')
function diamondsDraw(rateArray) {
  const weightIndex = weightedRandom(rateArray)

  return weightIndex
}

function voucherDraw(accountVoucher, rateArrayList) {
  const voucherCount = accountVoucher || 0
  const rateArray = rateArrayList[voucherCount]
  const weightIndex = weightedRandom(rateArray)

  return weightIndex
}

async function openBox(boxRewards, accountVoucher, accountId) {
  const rewards = []
  for (const { key, rate } of boxRewards) {
    const idx = weightedRandom([100 - rate, rate])

    if (idx === 0) continue

    const configReward = await configBusiness.getConfigValue(key)
    let count = 0
    if (configReward && configReward.type === 'diamonds') {
      const opened = await setAccountFirstOpenBoxAsync(accountId)
      if (!opened) {
        count = getRandomIntInclusive(12, 15)
      } else {
        count = diamondsDraw(configReward.rate_array)
      }
    } else if (configReward && configReward.type === 'voucher') {
      const accountVoucherCount = (accountVoucher && accountVoucher[configReward.voucher_type]) || 0
      count = voucherDraw(accountVoucherCount, configReward.rate_array) 

      // 做最后核验 不能让兑换券个数大于等于100
      if(accountVoucherCount + count >= 100) {
        count = 0
      }
    }

    if (count === 0) continue

    rewards.push({
      type: configReward.type,
      voucher_type: configReward.voucher_type,
      count,
    })
  }

  return rewards
}

function getAccountGetDiamondBitmapKey() {
  return `${PROJECT_NAME}_account_get_diamonds`
}

async function setAccountGetDiamondAsync(accountId) {
  const key = getAccountGetDiamondBitmapKey()

  return redisCluster.setbit(key, accountId, 1)
}

async function getAccountGetDiamondAsync(accountId) {
  const key = getAccountGetDiamondBitmapKey()

  return redisCluster.getbit(key, accountId, 1)
}

function getAccountShowCashBarBitmapKey() {
  return `${PROJECT_NAME}_account_show_cash_bar`
}

async function setAccountShowCashBarAsync(accountId) {
  const key = getAccountShowCashBarBitmapKey()

  return redisCluster.setbit(key, accountId, 1)
}

async function getAccountShowCashBarAsync(accountId) {
  const key = getAccountShowCashBarBitmapKey()

  return redisCluster.getbit(key, accountId, 1)
}

function getDateAccountWatchVideoBoxGiftRedisKey(timezoneOffset) {
  const currentDate = getCurrentDate(timezoneOffset)
 
  debug(`${PROJECT_NAME}:watch_video_box_gift_count:${currentDate}`)

  return `${PROJECT_NAME}:watch_video_box_gift_count:${currentDate}`
}

async function getDateAccountWatchVideoBoxGiftCountAsync(accountId, timezoneOffset) {
  const key = getDateAccountWatchVideoBoxGiftRedisKey(timezoneOffset)
  const count = await redisCluster._cluster.zscore(key, accountId)

  return parseInt(count|| '0')
}

async function setDateAccountWatchVideoBoxGiftCountAsync(accountId, timezoneOffset, score = 1) {
  const key = getDateAccountWatchVideoBoxGiftRedisKey(timezoneOffset)

  return redisCluster.zincrbyEx(key, score, accountId, 7 * 86400)
}

module.exports = {
  getAccountGetDiamondAsync,
  getAccountShowCashBarAsync,
  getDateAccountWatchVideoBoxGiftCountAsync, 
  openBox,
  setAccountGetDiamondAsync,
  setAccountShowCashBarAsync,
  setDateAccountWatchVideoBoxGiftCountAsync,
}