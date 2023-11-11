const locales = ['en']

function t(key, locale, args) {
  if (!locales.includes(locale)) {
    locale = 'en'
  }

  const filename = `./locales/${locale}.json`
  const strings = require(filename)
  const enStrings = require('./locales/en.json')
  const result = strings[key] || enStrings[key]

  if (args) {
    return Object.keys(args).reduce((result, key) => {
      const regex = new RegExp(`\{${key}\}`, 'g')

      return result.replace(regex, args[key])
    }, result)
  }

  return result
}

function locale(countryCode) {
  const localeMap = {
    AR: 'es',
    BR: 'pt',
    CO: 'es',
    ID: 'id',
    MX: 'es',
    PT: 'pt',
    TH: 'th',
    VN: 'vi',
  }
  if (Object.keys(localeMap).includes(countryCode)) {
    return localeMap[countryCode]
  }

  return 'en'
}

module.exports = {
  locale,
  t,
}
