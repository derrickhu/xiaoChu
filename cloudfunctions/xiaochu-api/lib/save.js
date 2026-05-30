const { httpError } = require('./http')
const { requireUser } = require('./auth')
const { getDb } = require('./db')
const { getMaxBytes } = require('./config')

const SERVER_KEYS = new Set(['_id', '_openid', 'userId', 'uid', 'platform', 'createdAt', 'updatedAt', 'lastWriteAt', 'payload', 'schemaVersion'])

async function handlePull(req) {
  const { userId, platform } = requireUser(req)
  const col = getDb().collection(require('./config').getCollectionName('playerData'))
  const res = await col.where({ userId }).limit(1).get()
  const doc = (res && Array.isArray(res.data) && res.data[0]) || null
  if (!doc) {
    return { exists: false, schemaVersion: 0, updatedAt: 0, payload: {} }
  }
  return {
    exists: true,
    schemaVersion: Number(doc.schemaVersion || 0),
    updatedAt: Number(doc.updatedAt || 0),
    payload: cleanPayload(doc.payload || {}),
    platform,
  }
}

async function handlePush(req) {
  const { userId, platform } = requireUser(req)
  const body = req.body || {}
  const schemaVersion = normalizePositiveInt(body.schemaVersion || body.dataVersion || 1, 'BAD_SCHEMA', 'schemaVersion 非法')
  const updatedAt = normalizePositiveInt(body.updatedAt || Date.now(), 'BAD_UPDATED_AT', 'updatedAt 非法')
  const baseRemoteUpdatedAt = normalizeNonNegativeInt(body.baseRemoteUpdatedAt || 0, 'BAD_BASE_REMOTE_UPDATED_AT', 'baseRemoteUpdatedAt 非法')
  const payload = cleanPayload(body.payload)

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw httpError(400, 'BAD_PAYLOAD', 'payload 必须是 object')
  }
  const size = Buffer.byteLength(JSON.stringify(payload), 'utf8')
  const maxBytes = getMaxBytes()
  if (size > maxBytes) {
    throw httpError(413, 'PAYLOAD_TOO_LARGE', `payload 超限: ${size}B > ${maxBytes}B`)
  }

  const db = getDb()
  const _ = db.command
  const col = db.collection(require('./config').getCollectionName('playerData'))
  const existingRes = await col.where({ userId }).limit(1).get()
  const existing = (existingRes && Array.isArray(existingRes.data) && existingRes.data[0]) || null
  if (existing) {
    const prevUpdatedAt = Number(existing.updatedAt || 0)
    if (updatedAt < prevUpdatedAt || baseRemoteUpdatedAt < prevUpdatedAt) {
      throw httpError(409, 'STALE_UPDATE', `服务端已有更新版本 remote=${prevUpdatedAt} > local=${updatedAt}, base=${baseRemoteUpdatedAt}`, {
        remote: {
          exists: true,
          schemaVersion: Number(existing.schemaVersion || 0),
          updatedAt: prevUpdatedAt,
          payload: cleanPayload(existing.payload || {}),
        },
      })
    }
  }

  const now = Date.now()
  const doc = {
    userId,
    uid: userId,
    platform,
    schemaVersion,
    updatedAt,
    baseRemoteUpdatedAt,
    payload,
    payloadKeys: Object.keys(payload),
    lastWriteAt: now,
  }

  if (existing && existing._id) {
    // 存档是完整快照：payload 必须整体替换，不能让 SDK 把嵌套对象展开成点路径更新。
    // 否则旧存档中某个中间字段为 null（如 loginSign.pendingDoubleRewards）时，
    // 更新 payload.loginSign.pendingDoubleRewards.soulStone 会触发 Cannot create field ...。
    await col.doc(existing._id).update({
      userId,
      uid: userId,
      platform,
      schemaVersion,
      updatedAt,
      baseRemoteUpdatedAt,
      payload: _.set(payload),
      payloadKeys: _.set(Object.keys(payload)),
      lastWriteAt: now,
    })
    return { updatedAt, savedAt: now, mode: 'update', sizeBytes: size }
  }

  const addRes = await col.add({ ...doc, createdAt: now })
  return { updatedAt, savedAt: now, mode: 'insert', sizeBytes: size, id: addRes && (addRes.id || addRes._id) }
}

function cleanPayload(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input
  const out = {}
  Object.keys(input).forEach((key) => {
    if (!SERVER_KEYS.has(key)) out[key] = input[key]
  })
  return out
}

function normalizePositiveInt(value, code, message) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) throw httpError(400, code, message)
  return Math.floor(n)
}

function normalizeNonNegativeInt(value, code, message) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw httpError(400, code, message)
  return Math.floor(n)
}

module.exports = {
  handlePull,
  handlePush,
}
