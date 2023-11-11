const { MISSING_HEADERS } = require('../enum/code')

const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_DEVICE_ID = `${ProjectName}-Device-ID`
const HEADER_KEY_APP_VERSION = `${ProjectName}-App-Version`

async function account(ctx, next) {
  const accountId = parseInt(ctx.headers.get(HEADER_KEY_ACCOUNT_ID)) || 0
  const appVersion = parseInt(ctx.headers.get(HEADER_KEY_APP_VERSION)) || 0
  const deviceId = ctx.headers.get(HEADER_KEY_DEVICE_ID)

  if (!deviceId) {
    return ctx.throw(401, 'Missing headers', {
      code: MISSING_HEADERS,
      message: 'Missing headers',
    })
  }

  ctx.state.luckydate = {
    account_id: accountId,
    device_id: deviceId,
    app_version: appVersion,
    country_code: 'PH',
  }
  await next()
}
module.exports = account