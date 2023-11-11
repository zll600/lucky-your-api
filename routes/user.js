const router = require('koa-router')()
const axios = require('axios')
const _ = require('lodash')

const { account, checksum, login, visitor } = require('../middlewares')
const accountBusiness = require('../business/accountBusiness')
const activityRewardBusiness = require('../business/activity_rewardBusiness')
const sessionBusiness = require('../business/sessionBusiness')
const configBusiness = require('../business/configBusiness')
const accountGiftBusiness = require('../business/account_giftBusiness')
const cashOutBusiness = require('../business/cash_outBusiness')
const cashOutHistoryBusiness = require('../business/cash_out_historyBusiness')

const { getEmailErrorMessage, checkGcashNumber } = require('../utils')
const { generateToken, generatePayload, verify } = require('../lib/jwt')
const { OK, WRONG_HEADERS, WRONG_PARAMETERS } = require('../enum/code')
const { datadogIncrement } = require('../utils/datadog')

const { PROJECT_NAME } = require('../constants')
const {
  getAccountAttributesAsync,
  getAccountCashOutRuleAsync,
  getCountryCodeByIpAsync,
  updateAccountAttributeAsync,
} = require('../utils/user')
const { t, locale } = require('../i18n')
const { setHasStatisticsUVAsync } = require('../utils/activity')
const { logBigQueryAsync } = require('../utils/googlecloud')
const { LAST_LOGIN_TIME } = require('../enum/account')
const { divide } = require('../utils/float')
router.prefix('/user')
router.post('/refresh-token', checksum, account, async (ctx, _) => {
  const bearToken = ctx.headers.get('Authorization')
  if (!bearToken) {
    throw new Error('Missing Headers!')
  }
  const token = bearToken.split(' ')[1]
  const verifyModel = verify(token)
  const { account_id: accountId, device_id: deviceId } = ctx.state.luckyyou
  if (!verifyModel || !verifyModel.result) {
    return ctx.throw('Wrong Headers', 401, {
      code: WRONG_HEADERS,
      message: 'Wrong Headers!',
    })
  }
  if (verifyModel.account_id !== accountId || verifyModel.device_id !== deviceId) {
    return ctx.throw('Wrong Parameters', 401, {
      code: WRONG_PARAMETERS,
      message: 'Wrong Parameters!',
    })
  }

  const expiredAt = 86400000
  try {
    const payload = generatePayload(deviceId, accountId, expiredAt)
    const newToken = generateToken(payload)

    logBigQueryAsync('events', 'lucky_you_uv_events', {
      account_id: accountId,
      name: 'refresh_token',
      created_at: new Date(),
    })

    ctx.body = {
      code: OK,
      data: {
        token: newToken,
        expired_at: expiredAt,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/create-google', checksum, visitor, async (ctx, _) => {
  const clientOSVersion = ctx.state.luckydate.app_client_os_version
  const {
    access_token: accessToken,
    email,
    display_name: displayName,
    device_id: deviceId,
    device_type: deviceType,
    device_model: deviceModel,
    placement,
    app_version_code: appVersionCode,
    time_zone_offset: timeZoneOffset,
  } = ctx.request.body


  const emailErrorMessage = getEmailErrorMessage(email)
  if (emailErrorMessage) {
    console.error(`[sessions/create-google] Invalid email: ${email}`)
    throw new Error(emailErrorMessage)
  }

  const [countryCode, newUserEmails] = await Promise.all([
    getCountryCodeByIpAsync(ctx.request),
    configBusiness.getConfigValue('new_user_emails'),
  ])
  if (process.env.NODE_ENV === 'production') {
    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${accessToken}`)
    if (!response
      || !response.data
      || response.data.email !== email
      || response.data.email_verified !== 'true'
    ) {
      console.error(`[sessions/create-google] Invalid access token: ${accessToken}`)
      throw new Error('Invalid access token')
    }
  }

  const newEmail = newUserEmails.includes(email) ? `${email}.${Date.now()}`: email 
  let account = await accountBusiness.getOneByCondition({ 
    email: newEmail,
  })
  if (!account) {
    account = await accountBusiness.insert({
      email: newEmail,
      name: displayName,
      country_code: countryCode,
      first_time_login: {
        method: 'google',
        device_type: deviceType,
        placement,
      },
      time_zone_offset: timeZoneOffset,
      device_type: deviceType,
      updated_at: new Date(),
    })
    datadogIncrement(`${PROJECT_NAME}_new_user`, ['register_method:google', `country_code:${countryCode}`])
  }

  if (!account) {
    throw new Error('Not found Account')
  }

  const accountId = account.id

  const hasStatisticsUV = await setHasStatisticsUVAsync(accountId, account.time_zone_offset || '+08:00')
  if (!hasStatisticsUV) {
    datadogIncrement(`${PROJECT_NAME}_DAU_statictics`)
  }

  const payload = generatePayload(deviceId, accountId)
  const token = generateToken(payload)

  await sessionBusiness.findOneAndUpdate({
    account_id: accountId,
    device_id: deviceId,
  }, {
    country_code: countryCode,
    device_type: deviceType,
    device_model: deviceModel,
    app_version_code: appVersionCode,
    os_version: clientOSVersion,
  })

  ctx.body = {
    code: OK,
    data: {
      account: {
        id: account.id,
        email: account.email,
      },
      token,
    },
  }
})

router.get('/join-activities', checksum, login, account, async (ctx) => {
  try {
    const {
      page_size: pageSize = '20',
      page_number: pageNumber = '1',
    } = ctx.request.query
    const { account_id: accountId } = ctx.state.luckyyou
    const account = await accountBusiness.getOneByCondition({ id: accountId })
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters!',
      })
    }

    const condition = {
      account_id: accountId,
    }

    const [list, count] = await Promise.all([
      activityRewardBusiness.getListByCondition(
        condition,
        parseInt(pageSize, 10),
        parseInt(pageNumber, 10),
        { created_at: -1 },
      ),
      activityRewardBusiness.getCountByCondition(condition),
    ])

    const now = Date.now()
    const result = list.map(item => {
      item = item.toJSON()
      item.activity = item.activity_id
      item.activity.remaining_time = item.activity.end_time - now
      delete item.activity_id

      return item
    })
    ctx.body = {
      code: OK,
      data: {
        list: result,
        total_count: count,
        country_code: account.country_code,
        ewallet: account.ewallet,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/add-ewallet', checksum, login, account, async (ctx) => {
  try {
    const {
      account_id: accountId,
    } = ctx.state.luckyyou
    const {
      ewallet_number: ewalletNumber,
      type,
    } = ctx.request.body

    if (!['GCash'].includes(type)) {
      throw new Error('Not surrport!')
    }

    if (type === 'GCash' && checkGcashNumber(ewalletNumber)) {
      throw new Error(checkGcashNumber(ewalletNumber))
    }

    const [otherAccount, account] = await Promise.all([
      accountBusiness.getOneByCondition({
        'ewallet.type': type,
        'ewallet.ewallet_number': ewalletNumber,
      }),
      accountBusiness.getOneByCondition({ id: accountId }),
    ])

    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    if (otherAccount) {
      throw new Error(t('ewallet_bind_by_other', locale(account.country_code), { X: ewalletNumber }))
    }

    await accountBusiness.findOneAndUpdate(
      { id: accountId },
      { ewallet: { type, ewallet_number: ewalletNumber } },
    )

    ctx.body = {
      code: OK,
      data: null,
    }
  } catch (error) {
    throw error
  }
})

router.get('/account-profile', checksum, login, account, async (ctx) => {
  try {
    const {
      account_id: accountId,
    } = ctx.state.luckyyou

    const account = await accountBusiness.getOneByCondition({ id: accountId })
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    // 7天不登录 清空钻石、现金数据
    const [_lastLoginTime, configCashRate] = await Promise.all([
      getAccountAttributesAsync(accountId, [LAST_LOGIN_TIME]),
      configBusiness.getConfigValue('gold_coin_to_cash_rate'),
    ])
    const lastLoginTime = _lastLoginTime || Date.now()
    const currentTime = Date.now()
    if (currentTime - lastLoginTime >= 86400000 * 7) {
      await accountBusiness.findOneAndUpdate(
        { id: accountId },
        { diamonds: 0, cash: 0 },
      )
      logBigQueryAsync(
        'events',
        'lucky_you_clear_data_long_time_no_login',
        {
          account_id: accountId,
          last_login_time: parseInt(lastLoginTime),
          current_login_time: currentTime,
          data: JSON.stringify({
            diamonds: account.diamonds,
            cash: account.cash,
          }),
          created_at: new Date(),
        },
      )
    }

    const [
      adminAccountIds,
    ] = await Promise.all([
      configBusiness.getConfigValue('admin_account_ids'),
      updateAccountAttributeAsync(accountId, LAST_LOGIN_TIME, currentTime),
    ])

    const cashRate = configCashRate[account.country_code] || configCashRate['PH']
    const cash = divide(account.gold_coins || 0, cashRate, 2)
    const diamonds = account.diamonds || 0
    ctx.body = {
      code: OK,
      data: {
        is_admin: adminAccountIds.includes(accountId),
        country_code: account.country_code || 'PH',
        diamonds: diamonds,
        diamond_balance_text: `${diamonds}`,
        cash: cash,
        cash_balance_text: `​₱${cash}`,
        ewallet: account.ewallet,
        balance_page_url: 'https://web.goluckyyou.com/cash',
      },
    }
  } catch (error) {
    throw error
  }
})

router.get('/cash-rule', checksum, login, account, async (ctx) => {
  try {
    const {
      account_id: accountId,
    } = ctx.state.luckyyou

    const account = await accountBusiness.getOneByCondition({ id: accountId })
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const countryCode = (account && account.country_code) || 'PH'
    const [configCashRules, payModel] = await Promise.all([
      configBusiness.getConfigValue('cash_out_rules'),
      cashOutBusiness.getOneByConditionAndSortBy({ account_id: accountId }, { created_at: -1 }),
    ])
    const cashOutRules = await getAccountCashOutRuleAsync(
      accountId,
      configCashRules[countryCode] || [],
      !!payModel,
    )
    ctx.body = {
      code: OK,
      data: {
        cash_out_rules: cashOutRules,
        last_pay_model: payModel,
      },
    }
  } catch (error) {
    throw error
  }
})

router.get('/account-gift', checksum, account, async (ctx) => {
  try {
    const {
      account_id: accountId,
    } = ctx.state.luckyyou
    let totalBoxCount = 0
    const accountGift = await accountGiftBusiness.getOneByCondition({ account_id: accountId })

    if (accountGift && accountGift.box) {
      for (const count of Object.values(accountGift.box)) {
        totalBoxCount += count
      }
    }

    ctx.body = {
      code: OK,
      data: {
        total_box_count: totalBoxCount,
      },
    }
  } catch (error) {
    throw error
  }
})

router.get('/account-email', async (ctx) => {
  try {
    const {
      page_size: pageSize = '20',
      page_number: pageNumber = '1',
    } = ctx.request.query
    const accounts = await accountBusiness.getListByCondition(
      {},
      parseInt(pageSize),
      parseInt(pageNumber),
      { created_at: -1 },
    )
    const result = []
    if (accounts) {
      for (const account of accounts) {
        result.push(account.email)
      }
    }
    ctx.body = {
      code: OK,
      data: {
        result,
      },
    }
  } catch (error) {
    throw error
  }
})

router.get('/cash-out-history', checksum, login, account, async (ctx) => {
  try {
    const {
      page_size: pageSize = '20',
      page_number: pageNumber = '1',
    } = ctx.request.query
    const { account_id: accountId } = ctx.state.luckyyou
    const account = await accountBusiness.getOneByCondition({ id: accountId })
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters!',
      })
    }

    const condition = {
      account_id: accountId,
    }

    const [list, count] = await Promise.all([
      cashOutBusiness.getListByCondition(
        condition,
        parseInt(pageSize, 10),
        parseInt(pageNumber, 10),
        { created_at: -1 },
      ),
      cashOutBusiness.getCountByCondition(condition),
    ])

    const transcationIds = list.map(item => item._id.toString())
    const transcationHistories = await cashOutHistoryBusiness.getByCondition({
      transcation_id: { $in: transcationIds },
    })
    
    ctx.body = {
      code: OK,
      data: {
        list,
        total_count: count,
        cash_out_histories: _.sortBy(transcationHistories, ['created_at']), 
        country_code: account.country_code,
      },
    }
  } catch (error) {
    throw error
  }
})
module.exports = router