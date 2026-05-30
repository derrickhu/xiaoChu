const tcb = require('@cloudbase/node-sdk')
const { getCollectionName } = require('./config')

let app = null

function getApp() {
  if (app) return app
  app = tcb.init({ env: process.env.TCB_ENV || tcb.SYMBOL_CURRENT_ENV })
  return app
}

function getDb() {
  return getApp().database()
}

function collection(suffix) {
  return getDb().collection(getCollectionName(suffix))
}

module.exports = {
  getApp,
  getDb,
  collection,
}
