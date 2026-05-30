const { httpError } = require('./http')
const { getDb } = require('./db')
const { getCollectionName, gameKeyUpper } = require('./config')

const COLLECTION_SUFFIXES = [
  'playerData',
  'rankAll',
  'rankAllWeekly',
  'rankStage',
  'rankDex',
  'rankCombo',
  'weeklyReward',
  'pendingGifts',
  'inviteRecords',
]

async function handleInitCollections(req) {
  requireAdmin(req)
  const db = getDb()
  const created = []
  const existed = []
  const errors = []
  for (const suffix of COLLECTION_SUFFIXES) {
    const name = getCollectionName(suffix)
    try {
      if (typeof db.createCollection !== 'function') throw new Error('db.createCollection unavailable')
      await db.createCollection(name)
      created.push(name)
    } catch (error) {
      const msg = error && (error.message || error.errMsg) ? (error.message || error.errMsg) : String(error)
      if (/already|exist|Table exist|ALREADY/i.test(msg) || error.errCode === -501001 || error.errCode === -501007) {
        existed.push(name)
      } else {
        errors.push({ name, error: msg })
      }
    }
  }
  return { created, existed, errors }
}

async function handleImportBatch(req) {
  requireAdmin(req)
  const body = req.body || {}
  const suffix = normalizeSuffix(body.collection)
  if (!COLLECTION_SUFFIXES.includes(suffix)) throw httpError(400, 'BAD_COLLECTION', `不允许导入集合: ${suffix}`)
  const docs = Array.isArray(body.docs) ? body.docs : []
  if (docs.length > 200) throw httpError(400, 'TOO_MANY_DOCS', '单批最多 200 条')
  const col = getDb().collection(getCollectionName(suffix))
  let inserted = 0
  let updated = 0
  let skipped = 0
  for (const input of docs) {
    const doc = cleanDoc(input)
    const where = buildUniqueWhere(suffix, doc)
    if (!where) { skipped++; continue }
    const existed = await col.where(where).limit(1).get()
    const row = existed && existed.data && existed.data[0]
    if (row && row._id) {
      await col.doc(row._id).update(doc)
      updated++
    } else {
      await col.add(doc)
      inserted++
    }
  }
  return { collection: getCollectionName(suffix), inserted, updated, skipped }
}

async function handleStats(req) {
  requireAdmin(req)
  const body = req.body || {}
  const names = Array.isArray(body.collections) && body.collections.length ? body.collections : COLLECTION_SUFFIXES
  const db = getDb()
  const counts = {}
  for (const rawName of names) {
    const suffix = normalizeSuffix(rawName)
    if (!COLLECTION_SUFFIXES.includes(suffix)) continue
    const col = db.collection(getCollectionName(suffix))
    try {
      const res = await col.count()
      counts[suffix] = res && (res.total || res.count || 0)
    } catch (error) {
      counts[suffix] = { error: error && (error.message || error.errMsg) ? (error.message || error.errMsg) : String(error) }
    }
  }
  return { counts }
}

async function handleListKeys(req) {
  requireAdmin(req)
  const body = req.body || {}
  const suffix = normalizeSuffix(body.collection)
  if (!COLLECTION_SUFFIXES.includes(suffix)) throw httpError(400, 'BAD_COLLECTION', `不允许查询集合: ${suffix}`)
  const offset = Math.max(0, Number(body.offset || 0) | 0)
  const limit = Math.max(1, Math.min(1000, Number(body.limit || 500) | 0))
  const keyFields = keyFieldsFor(suffix)
  const projection = { _id: true, updatedAt: true, timestamp: true, createdAt: true, migratedAt: true }
  keyFields.forEach(k => { projection[k] = true })
  const res = await getDb().collection(getCollectionName(suffix)).skip(offset).limit(limit).field(projection).get()
  const data = (res && res.data) || []
  return {
    collection: getCollectionName(suffix),
    offset,
    limit,
    rows: data.map(doc => ({ _id: doc._id, key: uniqueKeyForDoc(suffix, doc), updatedAt: doc.updatedAt, timestamp: doc.timestamp, createdAt: doc.createdAt, migratedAt: doc.migratedAt })),
  }
}

function keyFieldsFor(suffix) {
  if (suffix === 'playerData') return ['userId']
  if (suffix === 'rankAllWeekly' || suffix === 'weeklyReward') return ['uid', 'periodKey']
  if (suffix.startsWith('rank')) return ['uid']
  if (suffix === 'pendingGifts') return ['orderId']
  if (suffix === 'inviteRecords') return ['newUser']
  return []
}

function uniqueKeyForDoc(suffix, doc) {
  if (suffix === 'playerData') return doc.userId || ''
  if (suffix === 'rankAllWeekly' || suffix === 'weeklyReward') return `${doc.uid || ''}|${doc.periodKey || ''}`
  if (suffix.startsWith('rank')) return doc.uid || ''
  if (suffix === 'pendingGifts') return doc.orderId || ''
  if (suffix === 'inviteRecords') return doc.newUser || ''
  return ''
}

function normalizeSuffix(value) {
  const gameKey = require('./config').getGameKey()
  return String(value || '').replace(new RegExp(`^${gameKey}_`), '')
}

function requireAdmin(req) {
  const expected = process.env[`${gameKeyUpper()}_ADMIN_KEY`] || ''
  if (!expected) throw httpError(500, 'NO_ADMIN_KEY', `${gameKeyUpper()}_ADMIN_KEY 未配置`)
  const headers = req.headers || {}
  const headerName = `x-${gameKeyUpper().toLowerCase().replace(/_/g, '-')}-admin-key`
  const got = headers[headerName] || headers['x-admin-key'] || (req.body && req.body.adminKey) || ''
  if (got !== expected) throw httpError(403, 'BAD_ADMIN_KEY', '管理密钥无效')
}

function cleanDoc(input) {
  const out = { ...(input || {}) }
  delete out._id
  return out
}

function buildUniqueWhere(suffix, doc) {
  if (suffix === 'playerData') return doc.userId ? { userId: doc.userId } : null
  if (suffix === 'rankAllWeekly') return doc.uid && doc.periodKey ? { uid: doc.uid, periodKey: doc.periodKey } : null
  if (suffix.startsWith('rank')) return doc.uid ? { uid: doc.uid } : null
  if (suffix === 'weeklyReward') return doc.uid && doc.periodKey ? { uid: doc.uid, periodKey: doc.periodKey } : null
  if (suffix === 'pendingGifts') return doc.orderId ? { orderId: doc.orderId } : null
  if (suffix === 'inviteRecords') return doc.newUser ? { newUser: doc.newUser } : null
  return null
}

module.exports = {
  handleInitCollections,
  handleImportBatch,
  handleStats,
  handleListKeys,
}
