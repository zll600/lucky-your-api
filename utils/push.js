const admin = require('firebase-admin')
const notificationBusiness = require('../business/notificationBusiness')
const serviceAccount = require('../firebase.config.json')

const app = admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

async function pushAsync(data, token) {
  await pushTokensAsync(data, [token])
}

async function pushTokensAsync(data, tokens) {
  const notificationId = (data && data.business && data.business.notification_id) || -1
  const res = await app.messaging().sendMulticast({
    tokens,
    data: { data: JSON.stringify(data) },
  })

  await notificationBusiness.findOneAndUpdate(
    { id: notificationId },
    {
      $inc:
      {
        success_count: res.successCount,
        failure_count: res.failureCount,
      },
    },
  )
}

/**
 * 此方法 不要使用 findOneAndUpdate 
 * 利用mongoose的insert触发ID自增 
 * @param {拼接id字符串} pushId 
 * @param {push数据} data 
 * @returns 
 */
async function getNotifacationId(pushId, data) {
  let model = await notificationBusiness.getOneByCondition({ push_id: pushId })

  if (!model) {
    model = await notificationBusiness.insert({ push_id: pushId, data: data })
  }

  return model.id
}

function getPushData(title, message, template = 'common', action = 'open_app', payload = {}, uiPayload = {}) {
  return {
    ui: {
      template,
      payload: {
        title,
        message,
        ...uiPayload,
      },
    },
    business: {
      action,
      payload,
    },
  }
}

// async function test() {
//   const pushId = 'account_verify:passed'
//   const data = getPushData('test verify', 'this is test message')
//   const notificationId = await getNotifacationId(pushId, data)
//   data.business.notification_id = notificationId
//   await pushAsync(data, 'cINUt_1DSrirldXrrHD55G:APA91bETgUHLjA_0hDbccLzpkSU8Bf1do9niPR25D4dUksf3qUHVapnNWy4SdLRU63CkqpkD5ch0QAU6mZFAknEex0IWTEPSCpAPUYwo_y2-temWU8oxXMJVpJG3NBrCMJL67syG23Cg')
// }

module.exports = {
  getNotifacationId,
  getPushData,
  pushAsync,
  pushTokensAsync, 
}