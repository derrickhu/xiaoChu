// 云函数：自动创建所需数据库集合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const COLLECTIONS = ['playerData', 'leaderboard', 'rankAll', 'rankDaily', 'rankDex', 'rankCombo']

exports.main = async (event, context) => {
  const db = cloud.database()
  const created = []
  const existed = []
  const errors = []

  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name)
      created.push(name)
    } catch (e) {
      // 集合已存在（errCode可能是-501001或-501007）
      if (e.errCode === -501001 || e.errCode === -501007 || (e.message && (e.message.indexOf('already exist') !== -1 || e.message.indexOf('ALREADY_EXIST') !== -1 || e.message.indexOf('Table exist') !== -1))) {
        existed.push(name)
      } else {
        errors.push({ name, error: e.message || e.errMsg || String(e) })
      }
    }
  }

  return { created, existed, errors }
}
