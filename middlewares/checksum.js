const dayjs = require('dayjs')
const utc = require('dayjs/plugin/utc')
const {
  crc32,
  md5,
  sortObjectByKeys,
  toUnicodeString,
} = require('../utils')
const { redisCluster } = require('../lib/redis_cluster')

dayjs.extend(utc)
const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const HEADER_KEY_APP_VERSION = `${ProjectName}-App-Version`
const PLAIN_TEXT_PREFIX = 'buzzbreaknews'
const PLAIN_TEXT_SUFFIX = 'xG876#0A'
async function checksum(ctx, next) {
  const req = ctx.request
  const accountId = parseInt(req.get(HEADER_KEY_ACCOUNT_ID)) || 0
  const { nonce, checksum, t } = req.method === 'GET' ? req.query : req.body
  const app_version = ctx.headers.get(HEADER_KEY_APP_VERSION)
  if (!nonce) {
    throw new Error('There is no nonce')
  }
  debug('headers>>>>>>>', ctx.headers)
  debug('params>>>>>>>>', req.method === 'GET' ? req.query : req.body)
  const date = dayjs.utc().format('YYYYMMDDHH')
  const slot = crc32(nonce) % 1024
  const key = `nonce:${date}:${slot}`

  const cnt = await redisCluster.sadd(key, nonce)
  redisCluster.expire(key, 60)
  if (!cnt) {
    console.error(
      `[middleware][checksum] ${accountId} nonce error, nonce: ${nonce}, `
      + `url: ${req.originalUrl}`,
    )
    throw new Error('Nonce must be unique')  
  }

  if (checksum && t) {
    const now = Date.now()
    if (Math.abs(now - t) > 10 * 60 * 1000) {
      console.error(
        `[middleware][gamechecksum] ${accountId} time error, client time:${t}, server time: ${now}, `
        + `diff time: ${Math.abs(now - t)}, app_version: ${app_version}`,
      )
    }

    const params = Object.keys(req.method === 'GET' ? req.query : req.body)
      .filter(key => !['checksum'].includes(key))
      .reduce((accu, key) => {
        accu[key] = req.method === 'GET' ? req.query[key] : req.body[key]

        return accu
      }, {})
    const plainText = JSON.stringify(sortObjectByKeys(params))
    debug('plainText>>>>>>',plainText)
    const md5String = md5(toUnicodeString(`${PLAIN_TEXT_PREFIX}${plainText}${PLAIN_TEXT_SUFFIX}`))
    debug(md5String, checksum)
    if (md5String.slice(8, 24) !== checksum) {
      console.error(
        `[middleware][gamechecksum] ${accountId} sign error, client sign: ${checksum}, `
        + `server sign: ${md5String.slice(8, 24)}, plainText: ${plainText}, app_version: ${app_version}`,
      )
      throw new Error('Illegal request')
    }
  } else {
    console.error(
      `[middleware][gamechecksum] ${accountId} request has no time or checksum, time:${t}, checksum: ${checksum}, `
      + `app_version: ${app_version}`,
    )
    throw new Error('Illegal request') 
  }
  await next()
}

module.exports = checksum