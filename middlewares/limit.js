const { PROJECT_NAME: ProjectName } = require('../constants')
const HEADER_KEY_ACCOUNT_ID = `${ProjectName}-Account-ID`
const { redisCluster } = require('../lib/redis_cluster')
function checkAccountSameSecondDup(purpose, seconds = 2) {
  return async (ctx, next) => {
    const accountId = parseInt(ctx.headers.get(HEADER_KEY_ACCOUNT_ID)) || 0
    if (!accountId) {
      return await next()
    }

    let targetPurpose = ''
    if (typeof purpose === 'function') {
      targetPurpose = await purpose(ctx)
    }

    if (typeof purpose === 'string') {
      targetPurpose = purpose
    }

    if (!targetPurpose) {
      return await next()
    }
    const key = `${targetPurpose}-lock:${accountId}`
    const v = await redisCluster.set(key, 'true', 'NX', 'EX', seconds)

    if (v === null) {
      console.error(`[checkAccountSameSecondDup][${targetPurpose}] ${accountId} too frequent`)
      throw new Error('Error: too frequent') 
    }

    await next()
  }
}

module.exports = checkAccountSameSecondDup 