const router = require('koa-router')()
const { account, checksum, login } = require('../middlewares')

const accountBusiness = require('../business/accountBusiness')
const configBusiness = require('../business/configBusiness')
const giftBusiness = require('../business/giftBusiness')

const { OK, WRONG_PARAMETERS } = require('../enum/code')

router.prefix('/gift')

router.get('/list', checksum, login, account, async (ctx) => {
  try {
    const { account_id: accountId } = ctx.state.luckyyou
    const [account, configRewardRule, configBoxType, configVoucherType] = await Promise.all([
      accountBusiness.getOneByCondition({ id: accountId }),
      configBusiness.getConfigValue('activity_rule'),
      configBusiness.getConfigValue('box_type'),
      configBusiness.getConfigValue('voucher_list'),
    ])
    if (!account) {
      return ctx.throw('Wrong Parameters', 401, {
        code: WRONG_PARAMETERS,
        message: 'Wrong Parameters!',
      })
    }

    const countryCode = configRewardRule[account.country_code] ? account.country_code : 'PH'
    let diamonds = account.diamonds
    const giftList = await giftBusiness.getListByCondition(
      {
        start_time: { $lte: new Date() },
        end_time: { $gt: new Date() },
        country_code: countryCode,
      },
      1000,
      1,
      { order: 1 },
    )

    const isDebug = process.env.NODE_ENV !== 'production'
    ctx.body = {
      code: OK,
      data: {
        diamonds,
        list: giftList,
        country_code: account.country_code,
        ewallet: account.ewallet,
        config_box_type: configBoxType.filter(item => isDebug || !item.is_debug),
        config_voucher_type: configVoucherType.filter(item => isDebug || !item.is_debug),
      },
    }
  } catch (error) {
    throw error
  }
})

module.exports = router