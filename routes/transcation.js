const router = require('koa-router')()
const { account, checksum, login, limit } = require('../middlewares')

const accountBusiness = require('../business/accountBusiness')
const activityBusiness = require('../business/activityBusiness')
const activityRewardBusiness = require('../business/activity_rewardBusiness')
const configBusiness = require('../business/configBusiness')
const cashOutBusiness = require('../business/cash_outBusiness')

const { add, divide } = require('../utils/float')
const { t, locale } = require('../i18n')
const { OK, WRONG_PARAMETERS } = require('../enum/code')
const { datadogIncrement } = require('../utils/datadog')
const { execCashoutInQueue } = require('../utils/transcation')
const { PROJECT_NAME } = require('../constants')
const {
  addDateCashOutAsync,
  getAccountCashOutRuleAsync,
  getDateCashOutAsync,
} = require('../utils/user')
const { getCurrentDateStringByFormat } = require('../utils/date')
const { setAccountShowCashBarAsync } = require('../utils/box')
const payStatus = require('../enum/transcation/pay_status')

router.prefix('/transcation')
// 钻石交换为PHP
router.post('/exchange-diamond', checksum, login, account, limit('exchange-diamond'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const { diamonds } = ctx.request.body

    const [account, configCashRate] = await Promise.all([
      accountBusiness.getOneByCondition({ id: accountId }),
      configBusiness.getConfigValue('gold_coin_to_cash_rate'),
    ])

    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    if ((account.diamonds || 0) < diamonds) {
      throw new Error('You don\'t have enough diamonds!')
    }

    const goldCoins = diamonds * 200
    const newAccount = await accountBusiness.findOneAndUpdate(
      { id: accountId },
      {
        diamonds: add(account.diamonds || 0, -diamonds, 2),
        gold_coins: add(account.gold_coins || 0, goldCoins, 2),
      },
    )

    const cashRate = configCashRate[account.country_code] || configCashRate['PH'] 
    const newDiamonds = (newAccount && newAccount.diamonds) || 0
    const newCash = divide((newAccount && newAccount.gold_coins) || 0, cashRate, 2)
    ctx.body = {
      code: OK,
      data: {
        cash: newCash,
        cash_balance_text: `​₱${newCash}`,
        diamonds: newDiamonds,
        diamond_balance_text: `${newDiamonds}`,
      },
    }
  } catch (error) {
    throw error
  }
})

// 提取现金
router.post('/cash-out', checksum, login, account, limit('cash-out'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const { cash_rule_id: cashRuleId } = ctx.request.body

    const [account, configCashRules, cashOutHourRange, configCashRate] = await Promise.all([
      accountBusiness.getOneByCondition({ id: accountId }),
      configBusiness.getConfigValue('cash_out_rules'),
      configBusiness.getConfigValue('cash_out_duration_hour_range'),
      configBusiness.getConfigValue('gold_coin_to_cash_rate'),
    ])

    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const countryCode = (account && account.country_code) || 'PH'
    const countryCashRule = configCashRules[countryCode]
    const timezoneOffset = (account && account.time_zone_offset) || '+08:00'
    const cashRate = configCashRate[account.country_code] || configCashRate['PH']

    const hour = parseInt(getCurrentDateStringByFormat(timezoneOffset, 'HH'))
    if (hour < cashOutHourRange.min_hour || hour >= cashOutHourRange.max_hour) {
      throw new Error(t('out_of_cash_out_duration_time', locale(countryCode)))
    }

    if (!countryCashRule) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const cashRule = countryCashRule.find(item => item.id === cashRuleId)
    if (!cashRule) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    if (cashRule.one_time) {
      const oneTimePayModel = await cashOutBusiness.getOneByCondition({
        account_id: accountId,
        cash_rule_id: cashRuleId,
      })
      if (oneTimePayModel) {
        throw new Error('Internal server error!')
      }
    }

    const cash = cashRule.amount
    const cashGoldCoins = cash * cashRate
    if (!account.ewallet) {
      throw new Error(t('add_ewallet_first', locale(countryCode)))
    }

    if ((account.diamonds || 0) < cashRule.fee) {
      throw new Error(t('diamond_not_enough', locale(countryCode)))
    }

    if ((account.gold_coins || 0) < cashGoldCoins) {
      throw new Error(t('cash_not_enough', locale(countryCode)))
    }

    const pendingPay = await cashOutBusiness.getOneByCondition({
      account_id: accountId,
      pay_status: payStatus.PENDING,
    })
    
    if (pendingPay) {
      throw new Error(t(
        'cash_out_have_in_pending',
        locale(countryCode),
        { X: pendingPay.amount },
      ))
    }

    const todayCashOut = await getDateCashOutAsync(accountId, timezoneOffset)
    if (todayCashOut) {
      throw new Error(t('cash_out_every_day_one_time', locale(countryCode)))
    }

    const payModel = await cashOutBusiness.insert({
      account_id: accountId,
      country_code: account.country_code || 'PH',
      amount: cash,
      gold_coins: cashGoldCoins,
      fee: cashRule.fee,
      diamonds_balance: account.diamonds,
      gold_coins_balance: account.gold_coins,
      ewallet: account.ewallet,
      cash_rule_id: cashRuleId,
      purpose: 'Cash out',
      pay_status: payStatus.PENDING,
    })

    const queueResult = await execCashoutInQueue(payModel, cashRule.withdrawal_hour)
    if (!queueResult) {
      throw new Error('Withdraw error!')
    }

    const newDiamonds = add(account.diamonds || 0, -cashRule.fee, 2)
    const newGoldCoins = add(account.gold_coins || 0, -cashGoldCoins, 2)
    const newCash = divide(newGoldCoins, cashRate, 2)

    const [cashOutRules] = await Promise.all([
      getAccountCashOutRuleAsync(accountId, countryCashRule, true),
      accountBusiness.findOneAndUpdate(
        { id: accountId },
        { diamonds: newDiamonds, gold_coins: newGoldCoins },
      ),
      addDateCashOutAsync(accountId, timezoneOffset),
    ])

    ctx.body = {
      code: OK,
      data: {
        cash: newCash,
        cash_balance_text: `​₱${newCash}`,
        diamonds: newDiamonds,
        diamond_balance_text: `${newDiamonds}`,
        cash_out_amount: cash,
        cash_out_rules: cashOutRules,
        last_pay_model: payModel,
      },
    }
  } catch (error) {
    throw error
  }
})

// 领取活动奖励
router.post('/claim-activity', checksum, login, account, limit('claim-activity'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const { activity_id: activityId } = ctx.request.body

    const [activity, accountActivityReward, account, configCashRate] = await Promise.all([
      activityBusiness.getOneByCondition({ _id: activityId }),
      activityRewardBusiness.getOneByCondition({ activity_id: activityId, account_id: accountId }),
      accountBusiness.getOneByCondition({ id: accountId }),
      configBusiness.getConfigValue('gold_coin_to_cash_rate'),
    ])

    if (!account || !activity || !activity.drawed) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    if (!accountActivityReward || !accountActivityReward.win) {
      throw new Error('Haven\'t join the activity!')
    }

    if (accountActivityReward.claimed) {
      throw new Error('You have Claimed!')
    }

    datadogIncrement(`${PROJECT_NAME}_claim_count`, [`type:${activity.type}`])

    const cashRate = configCashRate[account.country_code] || configCashRate['PH']
    const cashGoldCoins = activity.amount * cashRate

    const newAccount = await accountBusiness.findOneAndUpdate(
      { id: accountId },
      { gold_coins: add(account.gold_coins || 0, cashGoldCoins, 2) },
    )

    const activityReward = await activityRewardBusiness.findOneAndUpdate({
      activity_id: activityId,
      account_id: accountId,
    }, {
      claimed: true,
    })

    const showCashBar = await setAccountShowCashBarAsync(accountId)
    const newCash = divide((newAccount && newAccount.gold_coins) || 0, cashRate, 2)
    const newDiamonds = newAccount.diamonds || 0
    ctx.body = {
      code: OK,
      data: {
        activity_reward: activityReward,
        show_cash_bar: showCashBar === 0,
        cash_balance_text: `​₱${newCash}`,
        diamonds: newDiamonds,
        cash: activity.amount,
      },
    }
  } catch (error) {
    throw error
  }
})

module.exports = router