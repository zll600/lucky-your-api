let client = {
  increment() {},
  gauge() {},
  histogram() {}, 
}
if (process.env.NODE_ENV === 'production') {
  const StatsD = require('hot-shots')
  client = new StatsD()
}

function datadogIncrement(stat, tags) {
  client.increment(stat, 1, tags)
}

function datadogIncrementWithValue(stat, val, tags) {
  client.increment(stat, val, tags)
}

function datadogGauge(stat, value, tags) {
  client.gauge(stat, value, tags)
}

function datadogHistogram(stat, value, tags) {
  client.histogram(stat, value, tags)
}

module.exports = {
  datadogIncrement,
  datadogIncrementWithValue,
  datadogGauge,
  datadogHistogram,
}