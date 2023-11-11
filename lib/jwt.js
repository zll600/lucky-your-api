const jwt = require('jsonwebtoken')
const { SECRET_KEY } = require('../customer.config')
const header = {
  'alg': 'HS256',
  'typ': 'jwt',
}
const base64Header = base64Encoding(header)
function base64Encoding(obj) {
  let objStr = JSON.stringify(obj)
  let buffer = Buffer.from(objStr)

  return buffer.toString('base64')
}

function base64ToUTF8(base64Str) {
  let buffer = Buffer.from(base64Str, 'base64')

  return buffer.toString('utf8')
}

// let payloadTemplate={
//     device_id:'',
//     account_id: '',
//     expired:1000*60*60*24
// }
function getSign(payload) {
  const base64Payload = base64Encoding(payload)
  const sign = jwt.sign(`${base64Header}.${base64Payload}`, SECRET_KEY, { algorithm: header.alg })

  return sign
}

module.exports = {
  generatePayload(deviceId, accountId, expired = 86400000) {
    return {
      device_id: deviceId,
      account_id: accountId,
      expired,
      expired_at: Date.now() + expired,
    }
  },
  generateToken(payload) {
    let sign = getSign(payload)
    let base64Payload = base64Encoding(payload)

    return `${base64Header}.${base64Payload}.${sign}`
  },
  verify(token) {
    let splitToken = token.split('.')
    if (splitToken.length < 3) return { result: false }

    let currentHeader = splitToken[0]
    let currentPayload = splitToken[1]

    const sign = splitToken.slice(2, splitToken.length).join('.')
    const decryptedStr = jwt.verify(sign, SECRET_KEY, { algorithm: header.alg })

    if (typeof decryptedStr === 'object') return { result: false }

    let splitSign = decryptedStr.split('.')
    if (splitSign.length != 2) return { result: false }

    let signHeader = splitSign[0]
    let signPayload = splitSign[1]
    if (signHeader !== currentHeader || signPayload !== currentPayload) return { result: false }

    let payload = JSON.parse(base64ToUTF8(signPayload))
    let { account_id, device_id, expired, expired_at } = payload

    return { result: true, account_id, device_id, expired, expired_at }
  },
}
