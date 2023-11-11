const { genCode } = require('./referralcode')
function generateAccountsWithRefreralCode(accounts, key = 'id') {
  return accounts.filter(item => !!item).map(item => {
    item = item.toJSON()
    item.referral_code = genCode(item[key])

    return item
  })
}

function formatGeolocation(account) {
  let accountWrapper = null
  
  if (
    account 
    && account.geolocation
    && account.geolocation.coordinates
    && account.geolocation.coordinates.length === 2
  ) {
    const tempAccount = typeof account.toJSON === 'function' ? account.toJSON() : account
    accountWrapper = Object.assign(tempAccount, { geolocation:  {
      latitude: `${account.geolocation.coordinates[1]}`,
      longitude: `${account.geolocation.coordinates[0]}`,
    }})
  }

  return accountWrapper || account
}
module.exports = {
  formatGeolocation,
  generateAccountsWithRefreralCode, 
}