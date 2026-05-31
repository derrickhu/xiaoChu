const { httpError } = require('./http')
const { requireUser } = require('./auth')
const { collection } = require('./db')
const { resolveRequestServer, isLegacyDefaultServer } = require('./server')

const VALID_TIERS = ['qi_refine', 'core', 'spirit', 'mahayana', 'ascend']
const LIST_SIZE = 100
const FETCH_CAP_DEFAULT = 200
const WEEKLY_REWARD_TIERS = [
  { maxRank: 1, soulStone: 100, uniFrag: 3, label: 'top1' },
  { maxRank: 3, soulStone: 60, uniFrag: 2, label: 'top3' },
  { maxRank: 10, soulStone: 30, uniFrag: 1, label: 'top10' },
  { maxRank: Infinity, soulStone: 10, uniFrag: 0, label: 'participate' },
]

function rankingUid(userId, serverId) {
  return isLegacyDefaultServer(serverId) ? userId : `${serverId}:${userId}`
}

function isDuplicateKeyError(error) {
  const msg = error && error.message ? error.message : String(error || '')
  return msg.indexOf('E11000') >= 0 || msg.indexOf('duplicate key') >= 0 || msg.indexOf('dup key') >= 0
}

async function addOrUpdateOnDuplicate(col, record, where) {
  try {
    await col.add(record)
    return 'insert'
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error
    await col.where(where).update(record)
    return 'update_duplicate'
  }
}

async function handleSubmit(req) {
  const user = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  user.serverId = serverId
  const body = req.body || {}
  const action = String(body.action || 'submit')
  if (action === 'submit') return submitTower(user, body)
  if (action === 'submitAndGetAll') {
    if (Number(body.floor || 0) > 0) await submitTower(user, body)
    return listTower(user, { ...body, realmTier: body.queryRealmTier })
  }
  if (action === 'submitDexCombo') return submitDexCombo(user, body)
  if (action === 'submitStage') return submitStage(user, body)
  throw httpError(400, 'BAD_ACTION', `unknown submit action: ${action}`)
}

async function handleList(req) {
  const user = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: false })
  user.serverId = serverId
  const body = req.body || {}
  const action = String(body.action || '')
  const tab = String(body.tab || req.query.tab || '').toLowerCase()
  if (action === 'getAll' || tab === 'all' || tab === 'tower') return listTower(user, body)
  if (action === 'getAllWeekly' || tab === 'allweekly' || tab === 'towerweekly') return listTowerWeekly(user, body)
  if (action === 'getStage' || tab === 'stage') return listStage(user, body)
  if (action === 'getDex' || tab === 'dex') return listDex(user, body)
  if (action === 'getCombo' || tab === 'combo') return listCombo(user, body)
  throw httpError(400, 'BAD_ACTION', `unknown list action: ${action || tab}`)
}

async function handleAction(req) {
  const body = req.body || {}
  const action = String(body.action || '')
  if (action === 'checkWeeklyReward') {
    const user = requireUser(req)
    const { serverId } = await resolveRequestServer(req, { requireOpen: false })
    user.serverId = serverId
    return checkWeeklyReward(user, body)
  }
  if (action === 'claimWeeklyReward') {
    const user = requireUser(req)
    const { serverId } = await resolveRequestServer(req, { requireOpen: true })
    user.serverId = serverId
    return claimWeeklyReward(user, body)
  }
  if (['submit', 'submitAndGetAll', 'submitDexCombo', 'submitStage'].includes(action)) return handleSubmit(req)
  if (['getAll', 'getAllWeekly', 'getStage', 'getDex', 'getCombo'].includes(action)) return handleList(req)
  throw httpError(400, 'BAD_ACTION', `unknown ranking action: ${action}`)
}

async function submitTower(user, body) {
  const floor = toInt(body.floor)
  if (floor <= 0) throw httpError(400, 'BAD_FLOOR', '无效层数')
  const record = {
    uid: rankingUid(user.userId, user.serverId),
    userId: user.userId,
    platform: user.platform,
    serverId: user.serverId,
    nickName: normalizeText(body.nickName || body.nickname || '修士', 32),
    avatarUrl: normalizeText(body.avatarUrl || '', 512),
    floor,
    pets: Array.isArray(body.pets) ? body.pets.slice(0, 5).map((p) => ({ name: p.name, attr: p.attr })) : [],
    weapon: body.weapon ? { name: body.weapon.name } : null,
    totalTurns: toInt(body.totalTurns),
    realmTier: normalizeTier(body.realmTier),
    timestamp: Date.now(),
  }

  const result = await upsertBest(collection('rankAll'), user.userId, user.serverId, record, isBetterTower)
  await submitDexCombo(user, body)
  const weekly = await upsertWeekly(user.userId, user.serverId, record)
  return { code: 0, msg: '提交成功', improved: result.improved, weekly }
}

async function submitStage(user, body) {
  const totalStars = toInt(body.totalStars)
  const clearCount = toInt(body.clearCount)
  if (totalStars <= 0 && clearCount <= 0) return { code: 0, msg: '无可提交秘境成绩' }
  const record = {
    uid: rankingUid(user.userId, user.serverId),
    userId: user.userId,
    platform: user.platform,
    serverId: user.serverId,
    nickName: normalizeText(body.nickName || body.nickname || '修士', 32),
    avatarUrl: normalizeText(body.avatarUrl || '', 512),
    totalStars,
    clearCount,
    eliteClearCount: toInt(body.eliteClearCount),
    farthestChapter: toInt(body.farthestChapter),
    farthestNormalChapter: toInt(body.farthestNormalChapter),
    farthestNormalOrder: toInt(body.farthestNormalOrder),
    farthestEliteChapter: toInt(body.farthestEliteChapter),
    farthestEliteOrder: toInt(body.farthestEliteOrder),
    realmTier: normalizeTier(body.realmTier),
    timestamp: Date.now(),
  }
  await upsertBest(collection('rankStage'), user.userId, user.serverId, record, isBetterStage)
  return { code: 0, msg: '提交成功' }
}

async function submitDexCombo(user, body) {
  const nickName = normalizeText(body.nickName || body.nickname || '修士', 32)
  const avatarUrl = normalizeText(body.avatarUrl || '', 512)
  const realmTier = normalizeTier(body.realmTier)
  const petDexCount = toInt(body.petDexCount)
  const masteredCount = toInt(body.masteredCount)
  const collectedCount = toInt(body.collectedCount)
  const maxCombo = toInt(body.maxCombo)

  if (petDexCount > 0 || masteredCount > 0 || collectedCount > 0) {
    await upsertBest(collection('rankDex'), user.userId, user.serverId, {
      uid: rankingUid(user.userId, user.serverId),
      userId: user.userId,
      platform: user.platform,
      serverId: user.serverId,
      nickName,
      avatarUrl,
      petDexCount,
      masteredCount,
      collectedCount,
      realmTier,
      timestamp: Date.now(),
    }, isBetterDex)
  }

  if (maxCombo > 0) {
    await upsertBest(collection('rankCombo'), user.userId, user.serverId, {
      uid: rankingUid(user.userId, user.serverId),
      userId: user.userId,
      platform: user.platform,
      serverId: user.serverId,
      nickName,
      avatarUrl,
      maxCombo,
      realmTier,
      timestamp: Date.now(),
    }, isBetterCombo)
  }
  return { code: 0, msg: '提交成功' }
}

async function listTower(user, body) {
  const tier = body.realmTier ? normalizeTier(body.realmTier) : null
  const filters = tier ? { realmTier: tier } : null
  const records = await fetchServerRecords(collection('rankAll'), user.serverId, filters, 'floor')
  return buildRankResponse(records, user.userId, compareTower, { serverId: user.serverId, realmTier: tier })
}

async function listTowerWeekly(user, body) {
  const periodKey = body.periodKey || currentPeriodKey()
  const tier = body.realmTier ? normalizeTier(body.realmTier) : null
  const filters = tier ? { periodKey, realmTier: tier } : { periodKey }
  const records = await fetchServerRecords(collection('rankAllWeekly'), user.serverId, filters, 'floor')
  return buildRankResponse(records, user.userId, compareTower, { serverId: user.serverId, periodKey, realmTier: tier })
}

async function listStage(user, body) {
  const tier = body.realmTier ? normalizeTier(body.realmTier) : null
  const filters = tier ? { realmTier: tier } : null
  const records = await fetchServerRecords(collection('rankStage'), user.serverId, filters, 'totalStars')
  return buildRankResponse(records, user.userId, compareStage, { serverId: user.serverId, realmTier: tier })
}

async function listDex(user) {
  const records = await fetchServerRecords(collection('rankDex'), user.serverId, null, 'masteredCount')
  return buildRankResponse(records, user.userId, compareDex, { serverId: user.serverId })
}

async function listCombo(user) {
  const records = await fetchServerRecords(collection('rankCombo'), user.serverId, null, 'maxCombo')
  return buildRankResponse(records, user.userId, compareCombo, { serverId: user.serverId })
}

async function fetchServerRecords(col, serverId, filters, orderField) {
  const base = filters || null
  if (!isLegacyDefaultServer(serverId)) {
    return fetchRecords(col, { ...(base || {}), serverId }, orderField)
  }
  const current = await fetchRecords(col, { ...(base || {}), serverId }, orderField)
  const legacy = await fetchRecords(col, base, orderField)
  const seen = Object.create(null)
  const merged = []
  for (const item of current.concat(legacy.filter((row) => !row.serverId))) {
    const key = item._id || `${item.uid || item.userId || ''}:${item.timestamp || ''}`
    if (key && seen[key]) continue
    if (key) seen[key] = true
    merged.push(item)
  }
  return merged
}

async function fetchRecords(col, where, orderField) {
  let query = col
  if (where) query = query.where(where)
  const res = await query.orderBy(orderField, 'desc').limit(FETCH_CAP_DEFAULT).get()
  return (res && Array.isArray(res.data)) ? res.data : []
}

function buildRankResponse(records, userId, compareFn, extra) {
  const deduped = deduplicateByUid(records, compareFn)
  const list = deduped.slice(0, LIST_SIZE).map((item, index) => ({ ...item, rank: index + 1, isMe: item.uid === userId || item.userId === userId }))
  const idx = deduped.findIndex((item) => item.uid === userId || item.userId === userId)
  return { code: 0, list, myRank: idx >= 0 ? idx + 1 : -1, ...(extra || {}) }
}

async function upsertBest(col, userId, serverId, record, betterFn) {
  const rankUid = rankingUid(userId, serverId)
  const nextRecord = { ...record, uid: rankUid, userId, serverId }
  let res = await col.where({ uid: rankUid, serverId }).get()
  let docs = (res && Array.isArray(res.data)) ? res.data : []
  if (!docs.length && isLegacyDefaultServer(serverId)) {
    const legacyRes = await col.where({ uid: userId }).limit(5).get()
    const legacyDocs = (legacyRes && Array.isArray(legacyRes.data)) ? legacyRes.data : []
    docs = legacyDocs.filter((item) => !item.serverId || item.serverId === serverId)
  }
  if (docs.length > 1) {
    docs.sort(compareByBetterFn(betterFn))
    for (let i = 1; i < docs.length; i += 1) {
      try { await col.doc(docs[i]._id).remove() } catch (_) {}
    }
  }
  const existing = docs[0] || null
  if (!existing) {
    const mode = await addOrUpdateOnDuplicate(col, nextRecord, { uid: rankUid })
    return { mode, improved: true }
  }
  const improved = betterFn(nextRecord, existing)
  const patch = improved ? nextRecord : {
    nickName: nextRecord.nickName,
    avatarUrl: nextRecord.avatarUrl,
    platform: nextRecord.platform,
    uid: rankUid,
    userId,
    serverId,
    updatedProfileAt: Date.now(),
  }
  await col.doc(existing._id).update(patch)
  return { mode: 'update', improved }
}

async function upsertWeekly(userId, serverId, baseRecord) {
  const periodKey = currentPeriodKey()
  if (!baseRecord || toInt(baseRecord.floor) <= 0) return { ok: false, reason: 'no_floor', periodKey }
  const col = collection('rankAllWeekly')
  const rankUid = rankingUid(userId, serverId)
  const weeklyRecord = { ...baseRecord, uid: rankUid, userId, serverId, periodKey, timestamp: Date.now() }
  try {
    let res = await col.where({ uid: rankUid, serverId, periodKey }).get()
    let docs = (res && Array.isArray(res.data)) ? res.data : []
    if (!docs.length && isLegacyDefaultServer(serverId)) {
      const legacyRes = await col.where({ uid: userId, periodKey }).limit(5).get()
      const legacyDocs = (legacyRes && Array.isArray(legacyRes.data)) ? legacyRes.data : []
      docs = legacyDocs.filter((item) => !item.serverId || item.serverId === serverId)
    }
    if (!docs.length) {
      const mode = await addOrUpdateOnDuplicate(col, weeklyRecord, { uid: rankUid, periodKey })
      return { ok: true, reason: mode, periodKey }
    }
    docs.sort(compareTower)
    for (let i = 1; i < docs.length; i += 1) {
      try { await col.doc(docs[i]._id).remove() } catch (_) {}
    }
    const existing = docs[0]
    if (isBetterTower(weeklyRecord, existing)) {
      await col.doc(existing._id).update(weeklyRecord)
      return { ok: true, reason: 'update_better', periodKey }
    }
    await col.doc(existing._id).update({ nickName: weeklyRecord.nickName, avatarUrl: weeklyRecord.avatarUrl, uid: rankUid, userId, serverId })
    return { ok: true, reason: 'update_profile_only', periodKey }
  } catch (error) {
    return { ok: false, reason: error && error.message ? error.message : String(error), periodKey }
  }
}

async function checkWeeklyReward(user, body) {
  const periodKey = body.periodKey || lastPeriodKey()
  const rankUid = rankingUid(user.userId, user.serverId)
  let claimRes = await collection('weeklyReward').where({ uid: rankUid, serverId: user.serverId, periodKey }).limit(1).get()
  let claimed = !!(claimRes && claimRes.data && claimRes.data.length)
  if (!claimed && isLegacyDefaultServer(user.serverId)) {
    claimRes = await collection('weeklyReward').where({ uid: user.userId, periodKey }).limit(1).get()
    claimed = !!(claimRes && claimRes.data && claimRes.data.length)
  }
  const rank = await computeWeeklyRank(user.userId, user.serverId, periodKey)
  const tier = pickWeeklyRewardTier(rank)
  if (!tier) return { code: 0, periodKey, rank: -1, reward: null, claimed, canClaim: false }
  return {
    code: 0,
    periodKey,
    rank,
    reward: { soulStone: tier.soulStone, uniFrag: tier.uniFrag, label: tier.label },
    claimed,
    canClaim: !claimed,
  }
}

async function claimWeeklyReward(user, body) {
  const periodKey = body.periodKey || lastPeriodKey()
  const rank = await computeWeeklyRank(user.userId, user.serverId, periodKey)
  const tier = pickWeeklyRewardTier(rank)
  if (!tier) return { code: 0, periodKey, rank: -1, reward: null, justGranted: false, claimed: false }
  const col = collection('weeklyReward')
  const rankUid = rankingUid(user.userId, user.serverId)
  let claimRes = await col.where({ uid: rankUid, serverId: user.serverId, periodKey }).limit(1).get()
  if (!(claimRes && claimRes.data && claimRes.data.length > 0) && isLegacyDefaultServer(user.serverId)) {
    claimRes = await col.where({ uid: user.userId, periodKey }).limit(1).get()
  }
  if (claimRes && claimRes.data && claimRes.data.length > 0) {
    return { code: 0, periodKey, rank, reward: { soulStone: tier.soulStone, uniFrag: tier.uniFrag, label: tier.label }, justGranted: false, claimed: true }
  }
  await addOrUpdateOnDuplicate(col, {
    uid: rankUid,
    userId: user.userId,
    openId: user.openId,
    platform: user.platform,
    serverId: user.serverId,
    periodKey,
    rank,
    soulStone: tier.soulStone,
    uniFrag: tier.uniFrag,
    label: tier.label,
    claimedAt: Date.now(),
  }, { uid: rankUid, periodKey })
  return { code: 0, periodKey, rank, reward: { soulStone: tier.soulStone, uniFrag: tier.uniFrag, label: tier.label }, justGranted: true, claimed: true }
}

async function computeWeeklyRank(userId, serverId, periodKey) {
  const records = await fetchRecords(collection('rankAllWeekly'), { serverId, periodKey }, 'floor')
  if (!records.length) return -1
  const deduped = deduplicateByUid(records, compareTower)
  const idx = deduped.findIndex((item) => item.uid === userId || item.userId === userId)
  return idx >= 0 ? idx + 1 : -1
}

function pickWeeklyRewardTier(rank) {
  if (!rank || rank <= 0) return null
  for (const tier of WEEKLY_REWARD_TIERS) {
    if (rank <= tier.maxRank) return tier
  }
  return null
}

function lastPeriodKey() {
  return currentPeriodKey(Date.now() - 7 * 86400000)
}

function deduplicateByUid(records, compareFn) {
  const map = Object.create(null)
  records.forEach((record) => {
    const key = record.userId || record.uid || record._id
    if (!key) return
    if (!map[key] || compareFn(record, map[key]) < 0) map[key] = record
  })
  return Object.keys(map).map((key) => map[key]).sort(compareFn)
}

function compareByBetterFn(betterFn) {
  return (a, b) => {
    if (betterFn(a, b)) return -1
    if (betterFn(b, a)) return 1
    return compareTimeDesc(a, b)
  }
}

function compareTower(a, b) {
  if (toInt(a.floor) !== toInt(b.floor)) return toInt(b.floor) - toInt(a.floor)
  const aTurns = toInt(a.totalTurns)
  const bTurns = toInt(b.totalTurns)
  if (aTurns !== bTurns) {
    if (aTurns > 0 && bTurns > 0) return aTurns - bTurns
    if (aTurns > 0) return -1
    if (bTurns > 0) return 1
  }
  return compareTimeDesc(a, b)
}

function compareStage(a, b) {
  if (toInt(a.totalStars) !== toInt(b.totalStars)) return toInt(b.totalStars) - toInt(a.totalStars)
  if (toInt(a.eliteClearCount) !== toInt(b.eliteClearCount)) return toInt(b.eliteClearCount) - toInt(a.eliteClearCount)
  if (toInt(a.clearCount) !== toInt(b.clearCount)) return toInt(b.clearCount) - toInt(a.clearCount)
  return compareTimeDesc(a, b)
}

function compareDex(a, b) {
  if (toInt(a.masteredCount) !== toInt(b.masteredCount)) return toInt(b.masteredCount) - toInt(a.masteredCount)
  if (toInt(a.collectedCount) !== toInt(b.collectedCount)) return toInt(b.collectedCount) - toInt(a.collectedCount)
  if (toInt(a.petDexCount) !== toInt(b.petDexCount)) return toInt(b.petDexCount) - toInt(a.petDexCount)
  return compareTimeDesc(a, b)
}

function compareCombo(a, b) {
  if (toInt(a.maxCombo) !== toInt(b.maxCombo)) return toInt(b.maxCombo) - toInt(a.maxCombo)
  return compareTimeDesc(a, b)
}

function isBetterTower(next, prev) { return compareTower(next, prev) < 0 }
function isBetterStage(next, prev) { return compareStage(next, prev) < 0 }
function isBetterDex(next, prev) { return compareDex(next, prev) < 0 }
function isBetterCombo(next, prev) { return compareCombo(next, prev) < 0 }

function compareTimeDesc(a, b) {
  return toTime(b.timestamp || b.updatedAt) - toTime(a.timestamp || a.updatedAt)
}

function currentPeriodKey(dateOverride) {
  const d = new Date(dateOverride || Date.now())
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (tmp.getUTCDay() + 6) % 7
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

function normalizeTier(tier) {
  const value = String(tier || '').trim()
  return VALID_TIERS.indexOf(value) >= 0 ? value : 'qi_refine'
}

function normalizeText(value, maxLen) {
  return String(value || '').trim().slice(0, maxLen)
}

function toInt(value) {
  const n = Number(value || 0)
  return Number.isFinite(n) ? Math.floor(n) : 0
}

function toTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

module.exports = {
  handleSubmit,
  handleList,
  handleAction,
}
