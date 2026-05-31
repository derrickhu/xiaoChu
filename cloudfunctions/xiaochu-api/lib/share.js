const { requireUser } = require('./auth')
const { collection, getDb } = require('./db')
const { resolveRequestServer } = require('./server')

const CLAIM_BATCH_LIMIT = 20
const INVITE_DAILY_PER_INVITER = 20
const INVITE_TOTAL_PER_INVITER = 200

async function handleRecordInvite(req) {
  const user = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  const body = req.body || {}
  const inviter = normalizeWxUserId(body.inviter)
  const newUser = user.userId
  if (!inviter) return { recorded: false, reason: 'no_inviter' }
  if (inviter === newUser) return { recorded: false, reason: 'self' }

  const col = collection('inviteRecords')
  const existed = await col.where({ newUser, serverId }).limit(1).get()
  if (existed && existed.data && existed.data.length > 0) {
    return { recorded: false, reason: 'already_recorded' }
  }

  const total = await col.where({ inviter, serverId }).count()
  if ((total && total.total) >= INVITE_TOTAL_PER_INVITER) {
    return { recorded: false, reason: 'total_limit' }
  }

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const _ = getDb().command
  const daily = await col.where({ inviter, serverId, createdAt: _.gte(dayStart.getTime()) }).count()
  if ((daily && daily.total) >= INVITE_DAILY_PER_INVITER) {
    return { recorded: false, reason: 'daily_limit' }
  }

  await col.add({
    inviter,
    inviterOpenId: stripWxPrefix(inviter),
    newUser,
    newUserOpenId: stripWxPrefix(newUser),
    serverId,
    platform: 'wx',
    granted: false,
    createdAt: Date.now(),
  })
  return { recorded: true }
}

async function handleClaimInvites(req) {
  const user = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  const inviter = user.userId
  const col = collection('inviteRecords')
  const res = await col.where({ inviter, serverId, granted: false }).limit(CLAIM_BATCH_LIMIT).get()
  const rows = (res && res.data) || []
  let count = 0
  for (const rec of rows) {
    try {
      await col.doc(rec._id).update({ granted: true, grantedAt: Date.now() })
      count++
    } catch (error) {
      console.warn('[share] mark granted failed', rec._id, error && error.message ? error.message : error)
    }
  }
  const total = await col.where({ inviter, serverId }).count()
  return { count, total: (total && total.total) || 0 }
}

function normalizeWxUserId(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^[a-z]+:/.test(raw)) return raw
  return `wx:${raw}`
}

function stripWxPrefix(value) {
  return String(value || '').replace(/^wx:/, '')
}

module.exports = {
  handleRecordInvite,
  handleClaimInvites,
}
