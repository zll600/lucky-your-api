const CHARS = [
  'F',
  'L',
  'G',
  'W',
  '5',
  'X',
  'C',
  '3',
  '9',
  'Z',
  'M',
  '6',
  '7',
  'Y',
  'R',
  'T',
  '2',
  'H',
  'S',
  '8',
  'D',
  'V',
  'E',
  'J',
  '4',
  'K',
  'Q',
  'P',
  'U',
  'A',
  'N',
  'B',
]

const options = {
  CHARS_LENGTH: 32,
  CODE_LENGTH: 8,
  SLAT: 1234561,
  PRIME1: 3,
  PRIME2: 11,
}

function genCode(id) {
  return gen(id, options.CODE_LENGTH)
}

function gen(id, length) {
  // 补位
  const _id = id * options.PRIME1 + options.SLAT
  //将 id 转换成32进制的值
  const b = []
  // 32进制数
  b[0] = _id
  for (let i = 0; i < options.CODE_LENGTH - 1; i++) {
    b[i + 1] = b[i] / options.CHARS_LENGTH
    // 按位扩散
    b[i] = (b[i] + i * b[0]) % options.CHARS_LENGTH
  }

  let tmp = 0
  for (let i = 0; i < length - 2; i++) {
    tmp += b[i]
  }
  b[length - 1] = (tmp * options.PRIME1) % options.CHARS_LENGTH

  // 进行混淆
  const codeIndexArray = []
  for (let i = 0; i < options.CODE_LENGTH; i++) {
    codeIndexArray[i] = b[(i * options.PRIME2) % options.CODE_LENGTH]
  }

  const code = codeIndexArray.map((index) => CHARS[Math.floor(index)]).join('')

  return code
}

/**
 * 将邀请码解密成原来的id
 *
 * @param code 邀请码
 * @return id
 */
function decode(code) {
  if (code.length != options.CODE_LENGTH) {
    return null
  }
  // 将字符还原成对应数字
  const a = []
  for (let i = 0; i < options.CODE_LENGTH; i++) {
    const c = code[i]
    const index = CHARS.findIndex((char) => char === c)
    if (index === -1) {
      // 异常字符串
      return null
    }
    a[(i * options.PRIME2) % options.CODE_LENGTH] = index
  }

  const b = []
  for (let i = options.CODE_LENGTH - 2; i >= 0; i--) {
    b[i] = (a[i] - a[0] * i + options.CHARS_LENGTH * i) % options.CHARS_LENGTH
  }

  let res = 0
  for (let i = options.CODE_LENGTH - 2; i >= 0; i--) {
    res += b[i]
    res *= i > 0 ? options.CHARS_LENGTH : 1
  }
  const id = (res - options.SLAT) / options.PRIME1

  return id
}

module.exports = {
  genCode,
  decode,
}