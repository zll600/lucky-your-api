const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_DEVICE_ID = `${ProjectName}-Device-ID`
const HEADER_KEY_APP_VERSION = `${ProjectName}-App-Version`
// 暂时先用固定的token来鉴权，之后会换成jwt

async function account(ctx, next) {
  const accountId = parseInt(ctx.headers.get(HEADER_KEY_ACCOUNT_ID) || '0') || 0
  const appVersion = parseInt(ctx.headers.get(HEADER_KEY_APP_VERSION) || '0') || 0
  const deviceId = ctx.headers.get(HEADER_KEY_DEVICE_ID) || ''

  ctx.state.luckyyou = {
    account_id: accountId,
    device_id: deviceId,
    app_version: appVersion,
  }
  await next()
}
module.exports = account