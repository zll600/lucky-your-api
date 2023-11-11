const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')

dayjs.extend(utc)

/**
 * @param   {string}  timeZoneOffset: Time offset which indicates the timezone
 * @return  {object}  An object which contains start and end of day timestamp
 */
function getStartAndEndOfDayByTimeZone(timeZoneOffset) {
  const timeZoneOffsetInMillis = parseTimeZoneOffset(timeZoneOffset)
  const startOfDay = getStartOfDay(timeZoneOffsetInMillis)

  return {
    start_of_day: startOfDay,
    end_of_day: new Date(startOfDay.getTime() + 86400000 - 1),
  }
}

/**
 * @param   {string}  timeZoneOffset: Time offset which indicates the timezone
 * @return  {object}  An object which contains start and end of day timestamp
 */
function getStartAndEndOfMonthByTimeZone(timeZoneOffset) {
  const startOfMonth = dayjs().locale('customer_week', { weekStart: 1 })
    .utc()
    .timezoneOffset(timeZoneOffset)
    .startOf('month')
  const endOfMonth = dayjs().locale('customer_week', { weekStart: 1 })
    .utc()
    .timezoneOffset(timeZoneOffset)
    .endOf('month')

  return {
    start_of_month: startOfMonth.toDate(),
    end_of_month: endOfMonth.toDate(),
  }
}

function getLocalUTCDate(timeZoneOffset) {
  const timeZoneOffsetInMillis = parseTimeZoneOffset(timeZoneOffset)

  return new Date(Date.now() + timeZoneOffsetInMillis)
}

function getStartOfDay(timeZoneOffsetInMillis) {
  const utcStartOfDay = new Date(parseInt(Date.now() / 86400000) * 86400000)
  const localStartOfDay = new Date(
    utcStartOfDay.getTime() - timeZoneOffsetInMillis,
  )
  if (localStartOfDay.getTime() > Date.now()) {
    return new Date(localStartOfDay.getTime() - 86400000)
  } else if (Date.now() - localStartOfDay.getTime() > 86400000) {
    return new Date(localStartOfDay.getTime() + 86400000)
  }

  return localStartOfDay
}

function parseTimeZoneOffset(timeZoneOffset) {
  if (typeof timeZoneOffset !== 'string') {
    return 0
  }
  if (timeZoneOffset === 'Z') {
    return 0
  }

  const regex = /^(\+|-)(\d{2}):(\d{2})$/
  if (regex.test(timeZoneOffset)) {
    const match = timeZoneOffset.match(regex)
    const sign = match[1] === '+' ? 1 : -1
    const hour = parseInt(match[2])
    const minute = parseInt(match[3])

    return sign * (hour * 60 + minute) * 60 * 1000
  }

  return 0
}

function getDateDiffString(date1, date2) {
  const diffInSeconds = Math.floor(
    Math.abs(date1.getTime() - date2.getTime()) / 1000,
  )
  if (diffInSeconds === 0) {
    return '0 seconds'
  } else if (diffInSeconds === 1) {
    return '1 second'
  } else if (diffInSeconds < 60) {
    return `${diffInSeconds} seconds`
  } else if (diffInSeconds < 3600) {
    const diffInMinutes = Math.floor(diffInSeconds / 60)

    return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'}`
  } else if (diffInSeconds < 86400) {
    const diffInHours = Math.floor(diffInSeconds / 3600)

    return `${diffInHours} hour${diffInHours === 1 ? '' : 's'}`
  }

  const diffInDays = Math.floor(diffInSeconds / 86400)

  return `${diffInDays} day${diffInDays === 1 ? '' : 's'}`
}

function getDateStringUntilTomorrow(timeZoneOffset) {
  const { end_of_day: endOfDay } = getStartAndEndOfDayByTimeZone(timeZoneOffset)

  return getDateDiffString(new Date(), endOfDay)
}

function dayjsTimezonePlugin(_, c, d) {
  const regex = /^(\+|-)\d{2}:\d{2}$/

  c.prototype.timezoneOffset = function (input = '+08:00') {
    if (typeof input !== 'string' || !regex.test(input)) {
      throw new Error('Illegal input')
    }

    const [hOffset, mOffset] = input.split(':')
    const hOffsetNumber = parseInt(hOffset)
    const mOffsetNumber = parseInt(mOffset)
    const ins = d(this.toDate(), { locale: this.$L, utc: true }).add(hOffsetNumber, 'hour')
    if (mOffsetNumber > 0) {
      if (hOffsetNumber > 0) {
        return ins.add(mOffsetNumber, 'minute')
      }

      return ins.subtract(mOffsetNumber, 'minute')
    }

    return ins
  }

  d.timezoneOffset = function (input) {
    if (typeof input !== 'string' || !regex.test(input)) {
      throw new Error('Illegal input')
    }

    const [hOffset, mOffset] = input.split(':')
    const hOffsetNumber = parseInt(hOffset)
    const mOffsetNumber = parseInt(mOffset)
    const ins = d(this.toDate(), { locale: this.$L, utc: true }).add(hOffsetNumber, 'hour')
    if (mOffsetNumber > 0) {
      if (hOffsetNumber > 0) {
        return ins.add(mOffsetNumber, 'minute')
      }

      return ins.subtract(mOffsetNumber, 'minute')
    }

    return ins
  }
}

dayjs.extend(dayjsTimezonePlugin)
const weekRangeByTimezoneOffsetMap = {}

function getDateFormat(dayjsModel) {
  const year = dayjsModel.year()
  const month = dayjsModel.month() + 1
  const date = dayjsModel.date()

  return `${year}${(`${month}`).padStart(2, '0')}${`${date}`.padStart(2, '0')}`
}

function getWeekRangeByTimezoneOffset(timezoneOffset) {
  const startWeek = dayjs().locale('customer_week', { weekStart: 1 })
    .utc()
    .timezoneOffset(timezoneOffset)
    .startOf('week')
  const endWeek = startWeek.add(6, 'day')
  const currentStartWeeklyDate = getDateFormat(startWeek)
  const currentEndWeeklyDate = getDateFormat(endWeek)

  const prevStartWeeklyDate = getDateFormat(startWeek.subtract(7, 'day'))
  const prevEndWeeklyDate = getDateFormat(startWeek.subtract(1, 'day'))
  const key = `${timezoneOffset}:${currentStartWeeklyDate}`
  if (!weekRangeByTimezoneOffsetMap[key]) {
    const startWeekVal = startWeek.valueOf()
    weekRangeByTimezoneOffsetMap[key] = {
      current: {
        start_date: parseInt(currentStartWeeklyDate, 10),
        end_date: parseInt(currentEndWeeklyDate, 10),
        start_time: startWeekVal,
        end_time: startWeekVal + 604799999,
      },
      prev: {
        start_date: parseInt(prevStartWeeklyDate, 10),
        end_date: parseInt(prevEndWeeklyDate, 10),
      },
    }
  }

  return weekRangeByTimezoneOffsetMap[key]
}

function getDuration(startDate, endDate) {
  const now = dayjs(startDate)
  const deadline = (dayjs(endDate))
  const d = dayjs.duration(deadline.diff(now))

  return {
    day: d.days(),
    hour: d.hours(),
    minute: d.minutes(),
    second: d.seconds(),
  }
}

function getDateStrByTimeZoneAndFormat(date, timezoneOffset, formatStr) {
  return dayjs(date).utc().timezoneOffset(timezoneOffset).format(formatStr)
}

function isUserRegisteredInPeriod(createdAt, n, unit) {
  const deadline = dayjs.utc(createdAt).add(n, unit)

  return dayjs.utc().isBefore(deadline)
}

function getCurrentDate(timezoneOffset) {
  return parseInt(dayjs.utc().timezoneOffset(timezoneOffset).format('YYYYMMDD'))
}

function getDiffDate(startDate, endDate) {
  return dayjs(endDate).utc().diff(dayjs(startDate).utc(), 'day')
}

function getCurrentDateStringByFormat(timezoneOffset, formatStr) {
  let d = dayjs.utc()
  if (timezoneOffset) {
    d = d.timezoneOffset(timezoneOffset)
  }

  return d.format(formatStr)
}

function calcFutureTime(unit, number) {
  return dayjs.utc().add(number, unit).toDate()
}
module.exports = {
  calcFutureTime,
  dayjsTimezonePlugin,
  getCurrentDate,
  getCurrentDateStringByFormat,
  getDateDiffString,
  getDateStrByTimeZoneAndFormat,
  getDateStringUntilTomorrow,
  getDiffDate,
  getDuration,
  getLocalUTCDate,
  getStartAndEndOfDayByTimeZone,
  getStartAndEndOfMonthByTimeZone,
  getWeekRangeByTimezoneOffset,
  isUserRegisteredInPeriod,
}
