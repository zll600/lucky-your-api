const { MISSING_HEADERS } = require('../enum/code')

const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_APP_CLIENT = `${ProjectName}-Client`
const HEADER_KEY_APP_NAME = `${ProjectName}-App-Name`
const HEADER_KEY_APP_VERSION = `${ProjectName}-App-Version`
const HEADER_KEY_CLIENT_OS_VERSION = `${ProjectName}-Client-OS-Version`
const HEADER_KEY_DEVICE_ID = `${ProjectName}-Device-ID`
const HEADER_KEY_LOCALE = `${ProjectName}-Locale`
// 暂时先用固定的token来鉴权，之后会换成jwt
const HEADER_KEY_VOYAGER_API_KEY = 'API-Key'
const VOYAGER_API_KEY = 'p5DqGsYcOFucDadCvfWyjgrbk3Bs1RE1'

async function visitor(ctx, next) {
  if (!ctx.headers.get(HEADER_KEY_VOYAGER_API_KEY) || ctx.headers.get(HEADER_KEY_VOYAGER_API_KEY) !== VOYAGER_API_KEY) {
    return ctx.throw('Missing headers!', 401, {
      code: MISSING_HEADERS,
      message: 'Missing headers!',
    })
  }
  
  ctx.state.luckydate = {
    app_client: ctx.headers.get(HEADER_KEY_APP_CLIENT),
    app_client_os_version: parseInt(ctx.headers.get(HEADER_KEY_CLIENT_OS_VERSION)) || 0,
    app_name: ctx.headers.get(HEADER_KEY_APP_NAME) || 'luckyyou',
    app_version: parseInt(ctx.headers.get(HEADER_KEY_APP_VERSION)) || 0,
    locale: ctx.headers.get(HEADER_KEY_LOCALE),
    visitor_id: parseInt(ctx.headers.get(HEADER_KEY_ACCOUNT_ID)) || 0,
    device_id: ctx.headers.get(HEADER_KEY_DEVICE_ID),
  }
  await next()
}

module.exports = visitor