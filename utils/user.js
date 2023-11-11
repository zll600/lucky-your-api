const requestIp = require('request-ip')
const axios = require('axios')
const { PROJECT_NAME } = require('../constants')
const { redisCluster } = require('../lib/redis_cluster')
const accountBusiness = require('../business/accountBusiness')
const cashOutBusiness = require('../business/cash_outBusiness')
const { LAST_LOGIN_TIME, SHOW_BEGINNER_GUIDE, SHOW_CASH_OUT_BAR } = require('../enum/account')
const { getCurrentDate } = require('../utils/date')
function getIpStackUrl(ip) {
  const API_KEY = '68edeb8a3f7e82937bf9daa5b8bda74e'

  return `http://api.ipstack.com/${ip}?access_key=${API_KEY}`
}

function getClientIp(req) {
  return requestIp.getClientIp(req)
}

async function getCountryCodeByIpAsync(req) {
  try {
    const ip = getClientIp(req)
    const response = await axios.get(getIpStackUrl(ip))
    const newIpInfo = response && response.data

    return (newIpInfo && newIpInfo.country_code) || 'PH'
  } catch (error) {
    console.error(error)
  }
}

function getAccountCacheKey(accountId) {
  debug(`${PROJECT_NAME}_account:${accountId}`)

  return `${PROJECT_NAME}_account:${accountId}`
}

const accountAttrbuteOnlyInCacheArray = [LAST_LOGIN_TIME, SHOW_BEGINNER_GUIDE, SHOW_CASH_OUT_BAR]
async function updateAccountAttributeAsync(accountId, fieldKey, value) {
  const key = getAccountCacheKey(accountId)
  if (!accountAttrbuteOnlyInCacheArray.includes(fieldKey)) {
    await accountBusiness.findOneAndUpdate({ id: accountId }, { [fieldKey]: value })
  }

  return redisCluster._cluster.hset(key, fieldKey, value)
}

async function getAccountAttributesAsync(accountId, keys) {
  const key = getAccountCacheKey(accountId)
  const values = await redisCluster._cluster.hmget(key, keys)

  const hasValidValues = !values.some(value => value === null)
  if (!hasValidValues) {
    return values
  }

  const account = await accountBusiness.getOneByCondition({ id: accountId })
  if (!account) {
    return []
  }

  const total = {}
  for (const key of keys) {
    if (!accountAttrbuteOnlyInCacheArray.includes(key)) {
      total[key] = account[key]
    }
  }

  if (Object.keys(total).length > 0) {
    await redisCluster._cluster.hmset(key, total)
  }

  return await redisCluster._cluster.hmget(key, keys)
}

async function getAccountCashOutRuleAsync(accountId, countryCashRules, hasCashOut) {
  if (!countryCashRules) {
    return []
  }

  let availableCashOutRules = countryCashRules.filter(item => item.available)
  if (hasCashOut) {
    availableCashOutRules = availableCashOutRules.filter(item => !item.new_user)
  }
  const oneTimeRules = availableCashOutRules.filter(item => item.one_time)
  const promises = []
  let excludeCashRuleIds = []
  for (const { id } of oneTimeRules) {
    promises.push(cashOutBusiness.getOneByCondition({ account_id: accountId, cash_rule_id: id }))
  }

  if (promises.length > 0) {
    const payModels = await Promise.all(promises)
    excludeCashRuleIds = payModels.filter(item => !!item).map(item => item.cash_rule_id)
  }

  return availableCashOutRules.filter(item => !excludeCashRuleIds.includes(item.id))
}

function getDateCashOutKey(date) {
  return `${PROJECT_NAME}:cash_out_bitmap:${date}`
}

async function addDateCashOutAsync(accountId, timezoneOffset) {
  const currentDate = getCurrentDate(timezoneOffset)
  const key = getDateCashOutKey(currentDate)

  return redisCluster.setbitEx(key, accountId, 1, 7 * 86400)
}

async function getDateCashOutAsync(accountId, timezoneOffset) {
  const currentDate = getCurrentDate(timezoneOffset)
  const key = getDateCashOutKey(currentDate)

  return redisCluster.getbit(key, accountId)
}

function getAccountFirstOpenBoxBitmapKey() {
  return `${PROJECT_NAME}:account_first_open_box_bitmap`
}

async function setAccountFirstOpenBoxAsync(accountId) {
  const key = getAccountFirstOpenBoxBitmapKey()

  return redisCluster.setbit(key, accountId, 1)
}

function getAccountFirstOpenOfferwallBitmapKey() {
  return `${PROJECT_NAME}:account_first_open_offerwall_bitmap`
}

async function setAccountFirstOpenOfferwallAsync(accountId) {
  const key = getAccountFirstOpenOfferwallBitmapKey()

  return redisCluster.setbit(key, accountId, 1)
}

async function getAccountFirstOpenOfferwallAsync(accountId) {
  const key = getAccountFirstOpenOfferwallBitmapKey()

  return redisCluster.getbit(key, accountId)
}

module.exports = {
  addDateCashOutAsync,
  getAccountAttributesAsync,
  getAccountCashOutRuleAsync,
  getAccountFirstOpenOfferwallAsync,
  getCountryCodeByIpAsync,
  getClientIp,
  getDateCashOutAsync,
  updateAccountAttributeAsync,
  setAccountFirstOpenBoxAsync,
  setAccountFirstOpenOfferwallAsync,
}