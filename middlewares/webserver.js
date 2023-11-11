const { WRONG_HEADERS } = require('../enum/code')
const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_DEVICE_ID = `${ProjectName}-Device-ID`
const API_KEY = '53067de2-e24e-4f6b-a08e-aa7df3921104'
const HEADER_API_KEY = `${ProjectName}-Web-API-Key`
async function webServer(ctx, next) {
  const accountId = parseInt(ctx.headers.get(HEADER_KEY_ACCOUNT_ID) || '0', 10)
  const deviceId = ctx.headers.get(HEADER_KEY_DEVICE_ID)
  const apiKey = ctx.headers.get(HEADER_API_KEY)

  if (API_KEY !== apiKey) {
    return ctx.throw('Wrong Headers', 401, {
      code: WRONG_HEADERS,
      message: 'Wrong Headers!',
    })
  }

  if (accountId <= 0) {
    return ctx.throw('Wrong Headers', 401, {
      code: WRONG_HEADERS,
      message: 'Wrong Headers!',
    })
  }

  ctx.state.luckydate = {
    account_id: accountId,
    device_id: deviceId,
  }
  await next()
}

module.exports = webServer