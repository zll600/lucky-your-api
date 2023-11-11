const _ = require('lodash')
const { PROJECT_NAME } = require('../constants')
const { redisCluster } = require('../lib/redis_cluster')
function computeDiamonds(adCount, currentWin) {
  const randomInt = _.sample([0, 1])
  if (randomInt === 0 && !currentWin) {
    return 0
  }

  const maxCount = Math.floor(adCount / 2) === 0 ? 1 : Math.floor(adCount / 2)
  const randomArray = _.range(1, maxCount + 1, 1)
  const diamondsCount = _.sample(randomArray)

  return diamondsCount
}

function getClaimGiftBitmapKey() {
  return `${PROJECT_NAME}:claim_gift_bitmap`
}

async function getAccountClaimGiftAsync(accountId) {
  const key = getClaimGiftBitmapKey()

  return redisCluster.setbit(key, accountId, 1)
}

module.exports = {
  computeDiamonds,
  getAccountClaimGiftAsync,
}