const { WRONG_HEADERS } = require('../enum/code')
const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_DEVICE_ID = `${ProjectName}-Device-ID`
const INTERNAL_ACCOUNT_ID = 'luckyyou'
const INTERNAL_DEVICE_ID = '53067de2-e24e-4f6b-a08e-aa7df3921104'
async function internal(ctx, next) {
  const accountId = ctx.headers.get(HEADER_KEY_ACCOUNT_ID)
  const deviceId = ctx.headers.get(HEADER_KEY_DEVICE_ID)
  
  if (accountId !== INTERNAL_ACCOUNT_ID || deviceId !== INTERNAL_DEVICE_ID) {
    return ctx.throw('Wrong Headers', 401, {
      code: WRONG_HEADERS,
      message: 'Wrong Headers!',
    } )
  }
  await next()
}

module.exports = internal