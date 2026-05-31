const { collection } = require('./db')
const { httpError } = require('./http')

const DEFAULT_SERVER_ID = 's1'
const OPEN_STATUSES = new Set(['open'])
const VALID_STATUSES = new Set(['open', 'maintenance', 'upcoming', 'closed'])

const FALLBACK_SERVERS = [
  {
    serverId: 's1',
    name: '一服',
    status: 'open',
    isLegacyDefault: true,
    isRecommended: false,
    sort: 1,
    openAt: 0,
    zone: 1,
    notice: '老玩家默认所在服务器',
    visible: true,
  },
  {
    serverId: 's2',
    name: '二服',
    status: 'open',
    isLegacyDefault: false,
    isRecommended: true,
    sort: 2,
    openAt: 0,
    zone: 2,
    notice: '新服开启，独立新进度',
    visible: true,
  },
]

function normalizeServerId(value) {
  const id = String(value || '').trim().toLowerCase()
  return /^s[1-9][0-9]{0,3}$/.test(id) ? id : DEFAULT_SERVER_ID
}

function normalizeServer(raw) {
  const item = raw || {}
  const serverId = normalizeServerId(item.serverId || item.id)
  const status = VALID_STATUSES.has(item.status) ? item.status : 'open'
  return {
    serverId,
    id: serverId,
    name: item.name || serverId.toUpperCase(),
    status,
    isLegacyDefault: !!item.isLegacyDefault,
    isRecommended: !!item.isRecommended,
    sort: Number(item.sort || 0),
    openAt: Number(item.openAt || 0),
    zone: Number(item.zone || String(serverId).replace(/^s/, '')) || 0,
    notice: item.notice || '',
    visible: item.visible !== false,
  }
}

function getFallbackServers() {
  return FALLBACK_SERVERS.map(normalizeServer)
}

async function listServers() {
  try {
    const res = await collection('servers').where({ visible: true }).orderBy('sort', 'asc').limit(100).get()
    const rows = (res && Array.isArray(res.data)) ? res.data : []
    const list = rows.map(normalizeServer).filter((s) => s.visible)
    if (list.length) return { code: 0, servers: list, fallback: false }
  } catch (error) {
    console.warn('[server] list servers fallback:', error && error.message ? error.message : error)
  }
  return { code: 0, servers: getFallbackServers(), fallback: true }
}

async function handleListServers() {
  return listServers()
}

async function getServerById(serverId) {
  const id = normalizeServerId(serverId)
  try {
    const res = await collection('servers').where({ serverId: id }).limit(1).get()
    const doc = (res && Array.isArray(res.data) && res.data[0]) || null
    if (doc) return normalizeServer(doc)
  } catch (error) {
    console.warn('[server] get server fallback:', id, error && error.message ? error.message : error)
  }
  return getFallbackServers().find((s) => s.serverId === id) || null
}

async function resolveRequestServer(req, opts) {
  const options = opts || {}
  const body = req.body || {}
  const query = req.query || {}
  const id = normalizeServerId(body.serverId || query.serverId || query.server || options.defaultServerId || DEFAULT_SERVER_ID)
  const server = await getServerById(id)
  if (!server && options.strict) throw httpError(400, 'BAD_SERVER', `服务器不存在: ${id}`)
  if (options.requireOpen && server && !OPEN_STATUSES.has(server.status)) {
    throw httpError(403, 'SERVER_NOT_OPEN', server.notice || `服务器不可进入: ${id}`)
  }
  return { serverId: id, server: server || { serverId: id, status: 'open' } }
}

async function zoneToServerId(zone) {
  const n = Number(zone)
  if (Number.isFinite(n) && n > 0) {
    try {
      const res = await collection('servers').where({ zone: Math.floor(n) }).limit(1).get()
      const doc = (res && Array.isArray(res.data) && res.data[0]) || null
      if (doc) return normalizeServerId(doc.serverId)
    } catch (error) {
      console.warn('[server] zone map fallback:', zone, error && error.message ? error.message : error)
    }
    const fallback = getFallbackServers().find((s) => s.zone === Math.floor(n))
    if (fallback) return fallback.serverId
  }
  return DEFAULT_SERVER_ID
}

function isLegacyDefaultServer(serverId) {
  return normalizeServerId(serverId) === DEFAULT_SERVER_ID
}

module.exports = {
  DEFAULT_SERVER_ID,
  normalizeServerId,
  normalizeServer,
  getFallbackServers,
  listServers,
  handleListServers,
  resolveRequestServer,
  zoneToServerId,
  isLegacyDefaultServer,
}
