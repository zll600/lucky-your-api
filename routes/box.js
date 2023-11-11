const router = require('koa-router')()
const _ = require('lodash')
const { account, checksum, login, limit } = require('../middlewares')

const accountBusiness = require('../business/accountBusiness')
const configBusiness = require('../business/configBusiness')
const accountGiftBusiness = require('../business/account_giftBusiness')
const accountCheckInBusiness = require('../business/account_checkinBusiness')

const { OK, WRONG_PARAMETERS } = require('../enum/code')
const { logBigQueryAsync } = require('../utils/googlecloud')
const { datadogIncrement } = require('../utils/datadog')
const {
  openBox,
  setAccountShowCashBarAsync,
  getDateAccountWatchVideoBoxGiftCountAsync,
  setDateAccountWatchVideoBoxGiftCountAsync,
} = require('../utils/box')
const { weightedRandom } = require('../utils')
const { PROJECT_NAME } = require('../constants')
const { getCurrentDate } = require('../utils/date')
const { getAccountCheckIn } = require('../utils/checkin')
const { divide } = require('../utils/float')

router.prefix('/box')

router.get('/list', checksum, login, account, async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou

    const accountGift = await accountGiftBusiness.getOneByCondition({ account_id: accountId })
    ctx.body = {
      code: OK,
      data: {
        box: (accountGift && accountGift.box) || [],
        voucher: (accountGift && accountGift.voucher) || [],
        opened: (accountGift && accountGift.opened) || false,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/claim', checksum, login, account, limit('claim-box'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const { claim_type: claimType } = ctx.request.body

    const [account, taskTypeBoxMap, watchVideoBoxGiftCountLimit] = await Promise.all([
      accountBusiness.getOneByCondition({ id: accountId }),
      configBusiness.getConfigValue('task_type_box_map'),
      configBusiness.getConfigValue('every_day_watch_ad_box_gift_count_limit'),
    ])

    const boxType = taskTypeBoxMap[claimType]
    if (!account || !boxType) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const timezoneOffset = account.time_zone_offset || '+08:00'
    let boxCount = 0
    let chargeAdCount = account.ad_count
    let totalBoxCount = 0
    let watchVideoGiftCount = 0
    if (claimType === 'ad_10') {
      if (account.ad_count < 10) {
        throw new Error('You are not watching enough videos!')
      }

      watchVideoGiftCount = await getDateAccountWatchVideoBoxGiftCountAsync(
        accountId,
        timezoneOffset,
      )
      if (watchVideoGiftCount >= watchVideoBoxGiftCountLimit) {
        throw new Error('Parameters error!')
      }

      watchVideoGiftCount += 1
      boxCount = Math.floor(account.ad_count / 10)
      chargeAdCount = account.ad_count % 10

      await Promise.all([
        accountBusiness.findOneAndUpdate({ id: accountId }, { ad_count: chargeAdCount }),
        setDateAccountWatchVideoBoxGiftCountAsync(accountId, timezoneOffset, 1),
      ])

      logBigQueryAsync(
        'events',
        'lucky_you_watch_video_box_gift_limit',
        {
          account_id: accountId,
          date: `${getCurrentDate(timezoneOffset)}`,
          account_box_count: watchVideoGiftCount,
          created_at: new Date(),
        },
      )
    } else if (claimType === 'check_in') {
      const [fixMaxLen, checkInLength] = await Promise.all([
        configBusiness.getConfigValue('check_in_allow_fix_max_len'),
        configBusiness.getConfigValue('check_in_length'),
      ])

      const { list } = await getAccountCheckIn(accountId, timezoneOffset, fixMaxLen, checkInLength)
      if (!list) {
        throw new Error('Internal Server Error!')
      }

      if (list.findIndex(item => item.check_in_type === 0) >= 0) {
        throw new Error('Parameter Error!')
      }

      const lastCheckIn = list[list.length - 1]
      if (lastCheckIn && lastCheckIn.claimed) {
        throw new Error('Has claimed!')
      }

      await accountCheckInBusiness.findOneAndUpdate({
        account_id: accountId,
        check_in_date: lastCheckIn.check_in_date,
      }, {
        claimed: true,
      })
      boxCount = 1

    }

    datadogIncrement(`${PROJECT_NAME}_claim_chest`, [`claim_type:${claimType}`])

    if (boxCount >= 1) {
      const accountGift = await accountGiftBusiness.findOneAndUpdate(
        {
          account_id: accountId,
        },
        {
          $inc: { [`box.${boxType}`]: boxCount },
        },
      )

      if (accountGift && accountGift.box) {
        for (const count of Object.values(accountGift.box)) {
          totalBoxCount += count
        }
      }

      logBigQueryAsync('events', 'lucky_you_claim_box', {
        account_id: accountId,
        claim_type: claimType,
        box_type: boxType,
        box_count: boxCount,
        country_code: account.country_code || 'PH',
        created_at: new Date(),
      })
    }

    ctx.body = {
      code: OK,
      data: {
        box_count: boxCount,
        ad_count: chargeAdCount,
        total_box_count: totalBoxCount,
        config_watch_video_gift_box_count_limit: watchVideoBoxGiftCountLimit,
        watch_video_gift_box_count: watchVideoGiftCount,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/open', checksum, login, account, limit('open-box', 1), async (ctx) => {
  try {
    const {
      account_id: accountId,
    } = ctx.state.luckyyou
    const {
      box_type: boxType,
    } = ctx.request.body

    const [account, accountGift, boxRewards, configCashRate] = await Promise.all([
      accountBusiness.getOneByCondition({ id: accountId }),
      accountGiftBusiness.getOneByCondition({ account_id: accountId }),
      configBusiness.getConfigValue(`${boxType}_box_rewards`),
      configBusiness.getConfigValue('gold_coin_to_cash_rate'),
    ])

    if (!accountGift || !boxRewards) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    if (!accountGift.box || accountGift.box[boxType] <= 0) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    datadogIncrement(`${PROJECT_NAME}_open_chest`, [`box_type:${boxType}`])
    let newBoxRewards = boxRewards
    const isNew = boxRewards.findIndex(item => _.isArray(item.key)) >= 0
    if (isNew) {
      const weightArray = boxRewards.map(item => item.rate)
      const idx = weightedRandom(weightArray)
      newBoxRewards = boxRewards[idx].key.map(item => {
        return {
          key: item,
          rate: 100,
        }
      })
    }
    const rewards = await openBox(newBoxRewards, accountGift.voucher, accountId)
    const promiseArray = []
    let diamonds = account.diamonds
    let box = (accountGift && accountGift.box) || {}
    let voucher = (accountGift && accountGift.voucher) || {}
    let showCashBar = 1
    if (rewards && rewards.length > 0) {
      for (const reward of rewards) {
        logBigQueryAsync('events', 'lucky_you_open_box', {
          account_id: accountId,
          box_type: boxType,
          country_code: account.country_code || 'PH',
          reward: JSON.stringify(reward),
          created_at: new Date(),
        })

        if (reward.type === 'diamonds') {
          promiseArray.push(accountBusiness.findOneAndUpdate(
            { id: accountId },
            { $inc: { diamonds: reward.count } },
          ))

          logBigQueryAsync('transcation', 'lucky_you_diamonds', {
            account_id: accountId,
            amount: reward.count,
            purpose: `open_box_${boxType}`,
            country_code: account.country_code || 'PH',
            data: JSON.stringify({
              rewards,
            }),
            paid: false,
            created_at: new Date(),
          })

          showCashBar = await setAccountShowCashBarAsync(accountId)
        } else if (reward.type === 'voucher') {
          promiseArray.push(accountGiftBusiness.findOneAndUpdate(
            {
              account_id: accountId,
            },
            {
              $inc: {
                [`voucher.${reward.voucher_type}`]: reward.count,
              },
            },
          ))
        }
      }
      promiseArray.push(accountGiftBusiness.findOneAndUpdate(
        {
          account_id: accountId,
        },
        {
          opened: true,
          $inc: { [`box.${boxType}`]: -1 },
        },
      ))
    }

    if (promiseArray.length > 0) {
      await Promise.all(promiseArray)
      const [newAccount, newAccountGift] = await Promise.all([
        accountBusiness.getOneByCondition({ id: accountId }),
        accountGiftBusiness.getOneByCondition({ account_id: accountId }),
      ])
      diamonds = newAccount.diamonds
      box = (newAccountGift && newAccountGift.box) || {}
      voucher = (newAccountGift && newAccountGift.voucher) || {}
    }

    const cashRate = configCashRate[account.country_code] || configCashRate['PH']
    const cash = divide(account.gold_coins || 0, cashRate, 2)
    ctx.body = {
      code: OK,
      data: {
        rewards,
        diamonds,
        cash_balance_text: `​₱${cash}`,
        account_box: box,
        account_voucher: voucher,
        show_cash_bar: showCashBar === 0,
      },
    }
  } catch (error) {
    throw error
  }
})

module.exports = router