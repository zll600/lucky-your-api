const axios = require('axios')

const cacheExchangeRate = {}

async function getExchangeRate(baseCurrency, targetCurrency) {
  const cacheTimeMilliseconds = 180 * 1000
  const key = '8938440cca9c586a8c1a3a56a2347f67'
  const url = `https://api.exchangeratesapi.io/v1/latest?access_key=${key}&base=${baseCurrency}&format=1`
  if (
    !cacheExchangeRate[baseCurrency] 
    || cacheExchangeRate[baseCurrency].updated_at <= Date.now() - cacheTimeMilliseconds
  ) {
    const { data } = await axios.get(url)
    const currentRates = data.rates
    cacheExchangeRate[baseCurrency] = {
      updated_at: Date.now(),
      rates: currentRates,
    }
  }

  if (
    cacheExchangeRate[baseCurrency] 
    && cacheExchangeRate[baseCurrency].updated_at > Date.now() - cacheTimeMilliseconds
  ) {
    const rates = cacheExchangeRate[baseCurrency].rates

    return rates[targetCurrency]
  }

  throw new Error('Get exchange rate error!')
}

function getCountryCurrency(countryCode) {
  switch (countryCode) {
  case 'PH':
    return 'PHP'
  default:
    return 'SGD'
  }
}

module.exports = {
  getExchangeRate,
  getCountryCurrency,
}