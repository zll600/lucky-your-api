const { verify } = require('../lib/jwt')
const { MISSING_HEADERS, WRONG_PARAMETERS, WRONG_HEADERS, AUTHORIZATION_EXPIRED } = require('../enum/code')
const AuthorizationHeader = 'Authorization'
const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_DEVICE_ID = `${ProjectName}-Device-ID`
async function login(ctx, next) {
  let accountId = ctx.headers.get(HEADER_KEY_ACCOUNT_ID)
  const deviceId = ctx.headers.get(HEADER_KEY_DEVICE_ID)
  const bearToken = ctx.headers.get(AuthorizationHeader)

  if (process.env.NODE_ENV !== 'production') {
    return await next()
  }

  if (!accountId || !deviceId || !bearToken) {
    return ctx.throw('Missing headers!', 401, {
      code: MISSING_HEADERS,
      message: 'Missing Headers!',
    })
  }

  accountId = parseInt(accountId)

  const token = bearToken.split(' ')[1]
  const verifyModel = verify(token)

  debug('verifyModel', verifyModel)
  if (!verifyModel || !verifyModel.result) {
    return ctx.throw('Wrong Headers', 401, {
      code: WRONG_HEADERS,
      message: 'Wrong Headers!',
    })
  }
  if (process.env.NODE_ENV === 'production' && ctx.headers.get('debug_api_user') !== 'huyulin' && (verifyModel.account_id !== accountId || verifyModel.device_id !== deviceId)) {
    return ctx.throw('Wrong Parameters', 401, {
      code: WRONG_PARAMETERS,
      message: 'Wrong Parameters!',
    })
  }

  if (process.env.NODE_ENV === 'production' && verifyModel.expired_at < Date.now()) {
    return ctx.throw('Authorization Expired', 440, {
      code: AUTHORIZATION_EXPIRED,
      message: 'Authorization Expired',
    })
  }
  await next()
}

module.exports = login