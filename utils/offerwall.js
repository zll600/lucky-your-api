const accountBusiness = require('../business/accountBusiness')
const offerwallBusiness = require('../business/offerwall_logBusiness')
const configBusiness = require('../business/configBusiness')

const { sha1, md5 } = require('.')
const { add, divide} = require('../utils/float')
const { logBigQueryAsync } = require('../utils/googlecloud')

const PRIVATE_KEY = 'fd4e7b'

const _addOfferWall = async (query, accountId, eventId, amount, platform) => {
  const account = await accountBusiness.getOneByCondition({ id: accountId })
  if (!account) {
    throw new Error('Invalid account id')
  }

  const [claimed, configCashRate] = await Promise.all([
    offerwallBusiness.getOneByCondition({
      account_id: accountId,
      event_id: eventId,
    }),
    configBusiness.getConfigValue('gold_coin_to_cash_rate'),
  ])
  if (claimed) {
    console.error(`[${platform}/callback] ${accountId} Already rewarded ${amount}, event id: ${eventId}`)
    throw new Error('Already rewarded')
  }
  
  console.log(`[${platform}/callback] ${JSON.stringify(query)}`)
  
  const countryCode = account.country_code || 'PH'
  const cashRate = configCashRate[countryCode] || configCashRate['PH']
  const cashAmount = divide(amount, cashRate, 2)
  const newGoldCoins = add(account.gold_coins || 0, amount, 2)
  await accountBusiness.findOneAndUpdate(
    {
      id: accountId,
    },
    { 
      gold_coins: newGoldCoins,
    },
  )
  
  await offerwallBusiness.insert({
    account_id: accountId,
    event_id: eventId,
    amount: cashAmount,
    gold_coin_amount: amount,
    platform: platform,
    country_code: countryCode,
    payload: query,
  })

  logBigQueryAsync('transcation', 'offerwall_log', {
    account_id: accountId,
    event_id: eventId,
    amount: cashAmount,
    gold_coin_amount: amount,
    platform: platform,
    country_code: countryCode,
    payload: JSON.stringify(query || {}),
    created_at: new Date(),
  }) 
}

const okspin = async (query) => {
  const {
    account_id: accountId,
    signature,
    app_id: appId,
    trans_uuid: transId,
    gaid,
    country,
    placement_id: placementId,
    amount: _amount,
  } = query

  const amount = parseInt(_amount || '0')
  const concatenate = [
    transId,
    accountId,
    appId,
    country,
    placementId,
    gaid,
    'zBbs626az6xCclcCxVHFv8E0ivXsy612',
  ].join('')

  if (sha1(concatenate) !== signature) {
    throw new Error('Illegal request!')
  }

  await _addOfferWall(query, accountId, transId, amount, 'ok_spin')

  return {
    status: 'success!',
  }
}

const ironsource = async (query) => {
  const accountId = parseInt(query.appUserId) || 0
  const amount = parseInt(query.rewards || '0')
  const eventId = query.eventId
  const signature = query.signature
  const timestamp = query.timestamp

  if (accountId === 0) {
    throw new Error('Invalid account id')
  } else if (amount === 0) {
    throw new Error('Invalid amount')
  } else if (!eventId) {
    throw new Error('Invalid ironsource event id')
  }

  const computedSig = md5(`${timestamp}${eventId}${accountId}${amount}${PRIVATE_KEY}`)
  if (signature !== computedSig) {
    throw new Error('Invalid sig')
  }

  await _addOfferWall(query, accountId, eventId, amount, 'iron_source')

  return {
    result: 'success',
    status: `${eventId}:OK`,
  }
}

module.exports = {
  okspin,
  ironsource,
}
