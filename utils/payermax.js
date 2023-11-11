const md5 = require('md5-node')
const axios = require('axios')
const { PAYERMAX } = require('../customer.config')
const payermaxTranscationBusiness = require('../business/payermax_transcationBusiness')
const { logBigQueryAsync } = require('./googlecloud')
const { PAID, FAILED } = require('../enum/payermax/status')

if (typeof Object.entries !== Function) {
  Object.entries = function (obj) {
    const ownProps = Object.keys(obj)
    i = ownProps.length,
    resArray = new Array(i)

    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]]

    return resArray
  }
}

function signForMd5(post_data, secret_key) {
  return md5(formatSignStr(post_data) + 'key=' + secret_key).toUpperCase()
}

function formatSignStr(post_data) {
  let sign = ''
  const entries = Object.entries(post_data).sort()
  if (entries.length < 1) {
    return sign
  }
  for ([k, v] of entries) {
    if (k == null || v == null || k == 'sign') {
      continue
    }
    if (v instanceof Object) {
      sign += k + '=' + formatSignStr(v) + '&'
    } else {
      sign += k + '=' + v + '&'
    }
  }

  return sign
}

function verifyForMd5(post_data, secret_key, sign) {
  return sign == signForMd5(post_data, secret_key)
}


async function getToken() {
  const { data, status } = await axios.post(
    PAYERMAX.url,
    {
      merchantId: PAYERMAX.merchantId,
      bizType: 'token',
      version: '1.0',
      secretKey: PAYERMAX.secret,
    },
    { headers: { 'Content-Type': 'application/json' } },
  )

  if (status === 200 && data && data.bizCode === '0000') {
    return data.data
  }

  return ''
}

getToken()
async function getOrder(orderId) {
  const payload = {
    merchantId: PAYERMAX.merchantId,
    bizType: 'payTransQuery',
    version: '2.5',
    orderId,
  }

  payload['sign'] = signForMd5(payload, PAYERMAX.secret)
  const { data } = await axios.post(
    PAYERMAX.url,
    payload,
    { headers: { 'Content-Type': 'application/json' } },
  )

  if (data.bizCode === '0000' && verifyForMd5(data.data, PAYERMAX.secret, data.data.sign)) {
    return data.data
  }

  return null
}

async function updateOrderStatus(
  status,
  orderId,
  tradeOrderNo = '',
  errorCode = '',
  errorMsg = '',
) {
  const doc = { status }

  const paymaxOrderInfo = {}
  if (errorCode) {
    paymaxOrderInfo.error_code = errorCode
  }

  if (errorMsg) {
    paymaxOrderInfo.error_msg = errorMsg
  }

  if (tradeOrderNo) {
    paymaxOrderInfo.trade_order_no = tradeOrderNo
  }
  const order = await payermaxTranscationBusiness.findOneAndUpdate(
    { _id: orderId },
    Object.assign(doc, { ...paymaxOrderInfo }),
  )

  if (!order) {
    throw new Error('Not found order!')
  }

  const row = {
    account_id: order.account_id,
    order_id: orderId,
    merchant_id: order.merchant_id,
    total_amount: order.total_amount,
    currency: order.currency,
    country_code: order.country_code,
    status: status,
    created_at: new Date(),
  }
  logBigQueryAsync('transcation', 'payermax_transcation', Object.assign(row, { ...paymaxOrderInfo }))
}

module.exports = {
  getOrder,
  getToken,
  updateOrderStatus,
  verifyForMd5,
}