const { httpError } = require('./http')
const { requireUser } = require('./auth')
const { getDb } = require('./db')
const { getMaxBytes } = require('./config')
const { resolveRequestServer, isLegacyDefaultServer } = require('./server')

const SERVER_KEYS = new Set(['_id', '_openid', 'userId', 'uid', 'accountUserId', 'platform', 'serverId', 'createdAt', 'updatedAt', 'lastWriteAt', 'payload', 'schemaVersion'])
const ROLLING_SERVER_START_AT = 1780230000000

function storageUserId(userId, serverId) {
  return isLegacyDefaultServer(serverId) ? userId : `${serverId}:${userId}`
}

async function handlePull(req) {
  const { userId, platform } = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  const docUserId = storageUserId(userId, serverId)
  const col = getDb().collection(require('./config').getCollectionName('playerData'))
  let res = await col.where({ userId: docUserId, serverId }).limit(1).get()
  let doc = (res && Array.isArray(res.data) && res.data[0]) || null
  if (!doc && isLegacyDefaultServer(serverId)) {
    const legacyRes = await col.where({ userId }).limit(5).get()
    const legacyDocs = (legacyRes && Array.isArray(legacyRes.data)) ? legacyRes.data : []
    doc = legacyDocs.find((item) => !item.serverId) || null
  }
  if (!doc) {
    return { exists: false, schemaVersion: 0, updatedAt: 0, payload: {}, serverId }
  }
  return {
    exists: true,
    schemaVersion: Number(doc.schemaVersion || 0),
    updatedAt: Number(doc.updatedAt || 0),
    payload: cleanPayload(doc.payload || {}),
    platform,
    serverId,
  }
}

async function handlePush(req) {
  const { userId, platform } = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  const body = req.body || {}
  const schemaVersion = normalizePositiveInt(body.schemaVersion || body.dataVersion || 1, 'BAD_SCHEMA', 'schemaVersion 非法')
  const updatedAt = normalizePositiveInt(body.updatedAt || Date.now(), 'BAD_UPDATED_AT', 'updatedAt 非法')
  const baseRemoteUpdatedAt = normalizeNonNegativeInt(body.baseRemoteUpdatedAt || 0, 'BAD_BASE_REMOTE_UPDATED_AT', 'baseRemoteUpdatedAt 非法')
  const payload = cleanPayload(body.payload)
  if (isCrossServerLegacyPayload(payload, serverId)) {
    return { updatedAt, savedAt: Date.now(), mode: 'ignored_cross_server_legacy', sizeBytes: 0 }
  }

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
  const docUserId = storageUserId(userId, serverId)
  let existingRes = await col.where({ userId: docUserId, serverId }).limit(1).get()
  let existing = (existingRes && Array.isArray(existingRes.data) && existingRes.data[0]) || null
  if (!existing && isLegacyDefaultServer(serverId)) {
    const legacyRes = await col.where({ userId }).limit(5).get()
    const legacyDocs = (legacyRes && Array.isArray(legacyRes.data)) ? legacyRes.data : []
    existing = legacyDocs.find((item) => !item.serverId) || null
  }
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
    userId: docUserId,
    uid: docUserId,
    accountUserId: userId,
    serverId,
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
      userId: docUserId,
      uid: docUserId,
      accountUserId: userId,
      serverId,
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

  try {
    const addRes = await col.add({ ...doc, createdAt: now })
    return { updatedAt, savedAt: now, mode: 'insert', sizeBytes: size, id: addRes && (addRes.id || addRes._id) }
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    await col.where({ userId: docUserId }).update({
      ...doc,
      payload: _.set(payload),
      payloadKeys: _.set(Object.keys(payload)),
      lastWriteAt: now,
    })
    return { updatedAt, savedAt: now, mode: 'update_duplicate', sizeBytes: size }
  }
}

function isDuplicateKeyError(error) {
  const msg = error && error.message ? error.message : String(error || '')
  return msg.indexOf('E11000') >= 0 || msg.indexOf('duplicate key') >= 0 || msg.indexOf('dup key') >= 0
}

function isCrossServerLegacyPayload(payload, serverId) {
  if (isLegacyDefaultServer(serverId)) return false
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const summary = payload.analyticsSummary || {}
  const firstSeenAt = Number(summary.firstSeenAt || 0)
  if (!firstSeenAt || firstSeenAt >= ROLLING_SERVER_START_AT) return false
  const stageClearRecord = payload.stageClearRecord || {}
  const stageCount = Object.keys(stageClearRecord).length
  const petCount = Array.isArray(payload.petPool) ? payload.petPool.length : 0
  const cultLv = payload.cultivation && Number(payload.cultivation.level || 0)
  return stageCount >= 20 || petCount >= 20 || cultLv >= 20 || Number(payload.bestFloor || 0) >= 20
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
