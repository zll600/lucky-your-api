const axios = require('axios')
const cashOutHistoryBusiness = require('../business/cash_out_historyBusiness')
const { logBigQueryAsync } = require('./googlecloud')
const { BUZZBREAK_HOST, PROJECT_NAME } = require('../constants')
const { datadogIncrementWithValue } = require('./datadog')
const { IN_CASH_QUEUE } = require('../enum/transcation/pay_status')
async function postCashOutToBuzzBreak(payModel, withdrawalHour) {
  let result = false
  const {
    account_id: accountId,
    country_code: countryCode,
    ewallet,
    amount,
    _id,
  } = payModel

  const bodyData = {
    country_code: countryCode,
    account_id: accountId,
    ewallet: ewallet,
    amount: amount,
    purpose: 'luckyyou:reward',
    memo: 'drawed',
    transcation_id: _id.toString(),
    due_date: new Date(Date.now() + withdrawalHour * 60 * 60 * 1000),
  }

  const { data } = await axios.post(
    `${BUZZBREAK_HOST}/voyager/points/luckyyou`,
    bodyData,
    {
      headers: {
        'Content-Type': 'application/json',
        'Voyager-Manager-API-Key': 'Z6mVVx76JwJafhKpy8IvILEqjoGmtQDS',
      },
    })
  result = data.status === 'success'

  return result
}

async function execCashoutInQueue(payModel, withdrawalHour) {
  let result = false
  await cashOutHistoryBusiness.insert({
    transcation_id: payModel._id,
    pay_status: payModel.pay_status,
  })
  const cashOutResult = await postCashOutToBuzzBreak(payModel, withdrawalHour)
  if (cashOutResult) {
    await cashOutHistoryBusiness.insert({
      transcation_id: payModel._id,
      pay_status: IN_CASH_QUEUE,
    })
    datadogIncrementWithValue(`${PROJECT_NAME}_cash_out_amount`, payModel.amount, [`amount:${payModel.amount}`])
    logBigQueryAsync('transcation', 'cash_out_history', {
      account_id: payModel.account_id,
      country_code: payModel.country_code,
      amount: payModel.amount,
      fee: payModel.fee,
      gold_coins_balance: payModel.gold_coins_balance,
      diamonds_balance: payModel.diamonds_balance,
      ewallet: JSON.stringify(payModel.ewallet),
      purpose: 'Cash out',
      pay_status: payModel.pay_status,
      created_at: new Date(),
    })

    result = true
  }

  return result
}
module.exports = {
  execCashoutInQueue,
}
