const router = require('koa-router')()
const { eventAccount, checksum, internal } = require('../middlewares')

const activityRewardBusiness = require('../business/activity_rewardBusiness')
const accountBusiness = require('../business/accountBusiness')
const cashOutBusiness = require('../business/cash_outBusiness')
const cashOutHistoryBusiness = require('../business/cash_out_historyBusiness')

const { mapHandler, typeEventMap } = require('../utils/event')
const { logBigQueryAsync } = require('../utils/googlecloud')
const { OK } = require('../enum/code')
const { add } = require('../utils/float')
const _ = require('lodash')
const payStatusEnum = require('../enum/transcation/pay_status')
router.prefix('/events')

router.post('/', checksum, eventAccount, async (ctx) => {
  const { account_id: accountId, device_id: deviceId } = ctx.state.luckydate
  const {
    event,
    payload: _payload,
  } = ctx.request.body
  try {
    const payload = _.isObject(_payload) ? _payload : JSON.parse(_payload || '{}') 
    const type = typeEventMap[event]
    if (type) {
      await mapHandler[type](ctx, accountId, deviceId, event, payload)
    } else {
      await mapHandler.onlyBigquery(ctx, accountId, deviceId, event, payload)
    }
  } catch (error) {
    throw error
  }
})

router.post('/abandon/pay-success', internal, async (ctx) => {
  try {
    const {
      transcation_id: transcationId,
      country_code: countryCode,
      amount,
      ewallet,
    } = ctx.request.body
    const activityReward = await activityRewardBusiness.findOneAndUpdate({ _id: transcationId }, { paid: true })

    logBigQueryAsync('transcation', 'lucky-you-cash-out', {
      account_id: activityReward.account_id,
      activity_id: activityReward.activity_id.toString(),
      country_code: countryCode,
      transcation_id: transcationId,
      amount,
      ewallet: JSON.stringify(ewallet),
      created_at: new Date(),
    })

    ctx.body = {
      code: OK,
      data: null,
    }
  } catch (error) {
    throw error
  }
})

router.post('/pay-success', internal, async (ctx) => {
  try {
    const {
      transcation_id: transcationId,
      country_code: countryCode,
      amount,
      ewallet,
      cash_out_error: cashOutError,
    } = ctx.request.body
    const payStatus = cashOutError ? payStatusEnum.ERROR : payStatusEnum.RESOLVED
    const [payModel] = await Promise.all([
      cashOutBusiness.findOneAndUpdate(
        { _id: transcationId }, 
        { pay_status: payStatus },
      ),
      cashOutHistoryBusiness.insert({
        transcation_id: transcationId,
        pay_status: payStatus,
      }),
    ])

    const {
      account_id: accountId,
      gold_coins: goldCoins,
      gold_coins_balance: goldCoinsBalance,
      diamonds_balance: diamondsBalance,
      fee,
    } = payModel

    // 打款失败将用户的钻石和现金还回去
    if (cashOutError) {
      const account = await accountBusiness.getOneByCondition({ id: accountId })
      if (account) {
        const newDiamonds = add(account.diamonds || 0, fee, 2)
        const newGoldCoins = add(account.gold_coins || 0, goldCoins, 2)
        await accountBusiness.findOneAndUpdate(
          { id: accountId },
          { diamonds: newDiamonds, gold_coins: newGoldCoins },
        )
      }
    }

    logBigQueryAsync('transcation', 'cash_out_history', {
      account_id: accountId,
      country_code: countryCode,
      amount,
      fee,
      gold_coins: goldCoins,
      gold_coins_balance: goldCoinsBalance,
      diamonds_balance: diamondsBalance,
      ewallet: JSON.stringify(ewallet),
      purpose: 'Cash out',
      pay_status: payStatus,
      created_at: new Date(),
    })

    ctx.body = {
      code: OK,
      data: null,
    }
  } catch (error) {
    throw error
  }
})

module.exports = router