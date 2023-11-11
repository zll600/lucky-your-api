const router = require('koa-router')()
const { account, checksum, login, limit } = require('../middlewares')
const {
  fixAccountCheckIn,
  getAccountCheckIn,
  setAccountCheckIn,
} = require('../utils/checkin')

const accountBusiness = require('../business/accountBusiness')
const configBusiness = require('../business/configBusiness')

const { OK, WRONG_PARAMETERS } = require('../enum/code')

router.prefix('/check-in')

router.get('/list', checksum, account, async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const [fixMaxLen, checkInLength, account] = await Promise.all([
      configBusiness.getConfigValue('check_in_allow_fix_max_len'),
      configBusiness.getConfigValue('check_in_length'),
      accountBusiness.getOneByCondition({ id: accountId }),
    ])

    const timezoneOffset = (account && account.time_zone_offset) || '+08:00'
    const {
      list,
      current_date: currentDate,
    } = await getAccountCheckIn(
      accountId,
      timezoneOffset,
      fixMaxLen, 
      checkInLength,
    )
    ctx.body = {
      code: OK,
      data: {
        check_in_list: list,
        current_date: currentDate,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/', checksum, login, account, limit('check_in'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou

    const [fixMaxLen, checkInLength, account] = await Promise.all([
      configBusiness.getConfigValue('check_in_allow_fix_max_len'),
      configBusiness.getConfigValue('check_in_length'),
      accountBusiness.getOneByCondition({ id: accountId }),
    ])
    
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const timezoneOffset = account.time_zone_offset || '+08:00'
    await setAccountCheckIn(accountId, timezoneOffset)
    const {
      list,
      current_date: currentDate,
    } = await getAccountCheckIn(
      accountId,
      timezoneOffset,
      fixMaxLen, 
      checkInLength,
    )
    ctx.body = {
      code: OK,
      data: {
        check_in_list: list,
        current_date: currentDate,
      },
    }
  } catch (error) {
    throw error
  }
})

router.post('/fix', checksum, login, account, limit('fix_check_in'), async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const {date_str: dateStr} = ctx.request.body
    const [fixMaxLen, checkInLength, account] = await Promise.all([
      configBusiness.getConfigValue('check_in_allow_fix_max_len'),
      configBusiness.getConfigValue('check_in_length'),
      accountBusiness.getOneByCondition({ id: accountId }),
    ])
    
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters',
      })
    }

    const timezoneOffset = account.time_zone_offset || '+08:00'
    await fixAccountCheckIn(accountId, dateStr, fixMaxLen)
    const {
      list,
      current_date: currentDate,
    } = await getAccountCheckIn(
      accountId,
      timezoneOffset,
      fixMaxLen, 
      checkInLength,
    )
    ctx.body = {
      code: OK,
      data: {
        check_in_list: list,
        current_date: currentDate,
      },
    }
  } catch (error) {
    throw error
  }
})

module.exports = router