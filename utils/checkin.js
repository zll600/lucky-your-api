const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const _ = require('lodash')

const checkinBusiness = require('../business/account_checkinBusiness')
const { logBigQueryAsync } = require('./googlecloud')
const { datadogIncrement } = require('../utils/datadog')
const {
  getDateStrByTimeZoneAndFormat,
  getDiffDate,
} = require('./date')
const { PROJECT_NAME } = require('../constants')
dayjs.extend(utc)


async function getAccountCheckIn(accountId, timezoneOffset, fixMaxLen, checkInLength) {
  let result = []
  const currentTime = new Date()
  const currentDate = getDateStrByTimeZoneAndFormat(currentTime, timezoneOffset, 'YYYY-MM-DD')
  const startDate = dayjs(currentDate).subtract(checkInLength - 1, 'day').format('YYYY-MM-DD')

  result = await checkinBusiness.getListByCondition(
    {
      account_id: accountId,
      check_in_date: { $gte: startDate },
    },
    checkInLength,
    1,
    {
      check_in_date: -1,
    },
  )

  if (result && result.length > 0) {
    result = _.orderBy(result, ['check_in_date'], ['asc'])

    const claimedModel = result.find(item => item.claimed)
    if (claimedModel && claimedModel.check_in_date !== currentDate) {
      result = result.filter(item => item.check_in_date > claimedModel.check_in_date)
    }
    
    const lastDate = (result[result.length - 1] && result[result.length - 1].check_in_date) || currentDate
    if (lastDate !== currentDate) {
      result.push({
        account_id: accountId,
        check_in_date: currentDate,
        check_in_type: 0,
        day_continue: getDiffDate(lastDate, currentDate),
      })
    }

    const index = _.findLastIndex(result, item => item.day_continue > fixMaxLen)
    if (index >= 0) {
      result = result.slice(index)
    }
    let idx = 0
    const tempResult = []
    for (const checkIn of result) {
      // 补中间缺省位
      if (idx > 0 && checkIn.day_continue > 1) {
        for (let index = checkIn.day_continue - 1; index >= 1; index--) {
          tempResult.push({
            account_id: accountId,
            check_in_date: dayjs(checkIn.check_in_date).subtract(index, 'day').format('YYYY-MM-DD'),
            check_in_type: 0,
            day_continue: 1,
          })
        }
      }
      tempResult.push(checkIn)
      idx++
    }
    result = tempResult
  }

  // 补末位缺省位
  const lastDate = result.length > 0 
    ? result[result.length - 1].check_in_date 
    : dayjs(currentDate).subtract(1, 'day').format('YYYY-MM-DD')
  const len = result.length
  for (i = 1; i <= checkInLength - len; i++) {
    result.push({
      account_id: accountId,
      check_in_date: dayjs(lastDate).add(i, 'day').format('YYYY-MM-DD'),
      check_in_type: 0,
      day_continue: 1,
    })
  }

  return {
    list: result,
    current_date: currentDate,
  }
}

// 签到
async function setAccountCheckIn(accountId, timezoneOffset) {
  const currentTime = new Date()
  const currentDateStr = getDateStrByTimeZoneAndFormat(currentTime, timezoneOffset, 'YYYY-MM-DD')
  const accountCheckIn = await checkinBusiness.getOneByConditionAndSortBy({
    account_id: accountId,
  }, {
    check_in_date: -1,
  })

  let checkInmodel = {
    account_id: accountId,
    check_in_date: currentDateStr,
    check_in_type: 1,
    day_continue: 0,
  }
  if (accountCheckIn) {
    if (accountCheckIn.check_in_date !== currentDateStr) {
      checkInmodel.day_continue = getDiffDate(accountCheckIn.check_in_date, currentDateStr)
    } else {
      checkInmodel = null
    }
  }

  if (checkInmodel) {
    await checkinBusiness.insert(checkInmodel)
    delete checkInmodel.day_continue
    logBigQueryAsync(
      'events',
      'lucky_you_check_in',
      Object.assign({}, { ...checkInmodel }, { created_at: new Date() }))
    datadogIncrement(`${PROJECT_NAME}_check_in`)
  }
}

//补签
async function fixAccountCheckIn(accountId, dateStr, fixMaxLen) {
  if (fixMaxLen <= 1) {
    throw new Error('Can not fix check in!')
  }
  const [beforeAccountCheckIn, afterAccountCheckIn] = await Promise.all([
    checkinBusiness.getOneByConditionAndSortBy({
      account_id: accountId,
      check_in_date: { $lt: dateStr },
    }, {
      check_in_date: -1,
    }),
    checkinBusiness.getOneByConditionAndSortBy({
      account_id: accountId,
      check_in_date: { $gt: dateStr },
    }, {
      check_in_date: 1,
    }),
  ])

  if (!beforeAccountCheckIn || !afterAccountCheckIn) {
    throw new Error('Not found account checkin records!')
  }

  if (getDiffDate(beforeAccountCheckIn.check_in_date, afterAccountCheckIn.check_in_date) > fixMaxLen) {
    throw new Error('Parameter error!')
  }
  const fixCheckInModel = {
    account_id: accountId,
    check_in_date: dateStr,
    check_in_type: 2,
    day_continue: getDiffDate(beforeAccountCheckIn.check_in_date, dateStr),
  }
  await Promise.all([
    checkinBusiness.insert(fixCheckInModel),
    checkinBusiness.findOneAndUpdate({
      account_id: accountId,
      check_in_date: afterAccountCheckIn.check_in_date,
    }, {
      day_continue: getDiffDate(dateStr, afterAccountCheckIn.check_in_date),
    }),
  ])
  delete fixCheckInModel.day_continue
  logBigQueryAsync(
    'events',
    'lucky_you_check_in',
    Object.assign({}, { ...fixCheckInModel }, { created_at: new Date() }),
  )
  datadogIncrement(`${PROJECT_NAME}_fix_check_in`)
}

module.exports = {
  fixAccountCheckIn,
  getAccountCheckIn,
  setAccountCheckIn,
}