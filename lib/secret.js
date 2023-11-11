const key = '_yJhbGciOiJIUzI1'
const iv = '!@#$%^&*()_+QWER'
const crypto = require('crypto')

/**
 * 加密方法
 * @param key 加密key
 * @param iv       向量
 * @param data     需要加密的数据
 * @returns string
 */
function encrypt(data) {
  if (typeof data === 'object') {
    data = JSON.stringify(data)
  }
  let cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  let crypted = cipher.update(data, 'utf8', 'binary')
  crypted += cipher.final('binary')
  crypted = Buffer.from(crypted, 'binary').toString('base64')

  return crypted
};

/**
 * 解密方法
 * @param key      解密的key
 * @param iv       向量
 * @param crypted  密文
 * @returns string
 */
function decrypt(crypted) {
  if (typeof crypted === 'object') {
    crypted = JSON.stringify(crypted)
  }
  crypted = Buffer.from(crypted, 'base64').toString('binary')
  var decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
  var decoded = decipher.update(crypted, 'binary', 'utf8')
  decoded += decipher.final('utf8')

  return decoded
};
// console.log(encrypt('5fae1ad6ce9fc733d0e17ef5'))
module.exports = {
  encrypt,
  decrypt,
}

