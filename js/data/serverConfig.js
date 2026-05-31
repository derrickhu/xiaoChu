/**
 * 滚服配置（客户端兜底 + 本地选择记录）
 * 服务端 xiaochu_servers / /server/list 是权威来源；这里保证网络异常时仍可进一服/二服。
 */
const P = require('../platform')

const DEFAULT_SERVER_ID = 's1'
const SELECTED_SERVER_KEY = 'xiaochu_selected_server'
const LOCAL_SAVE_PREFIX = 'wxtower_v1'
const VALID_STATUS = { open: true, maintenance: true, upcoming: true, closed: true }

const FALLBACK_SERVERS = [
  {
    serverId: 's1',
    name: '紫霄仙域',
    status: 'open',
    isLegacyDefault: true,
    isRecommended: false,
    sort: 1,
    openAt: 0,
    zone: 1,
    notice: '老玩家默认所在服务器',
    visible: true,
    fallback: true,
  },
  {
    serverId: 's2',
    name: '逍遥剑宗',
    status: 'open',
    isLegacyDefault: false,
    isRecommended: true,
    sort: 2,
    openAt: 0,
    zone: 2,
    notice: '新服开启，独立新进度',
    visible: true,
    fallback: true,
  },
]

function normalizeServerId(value) {
  const id = String(value || '').trim().toLowerCase()
  return /^s[1-9][0-9]{0,3}$/.test(id) ? id : DEFAULT_SERVER_ID
}

function normalizeServer(raw) {
  const item = raw || {}
  const serverId = normalizeServerId(item.serverId || item.id)
  const status = VALID_STATUS[item.status] ? item.status : 'open'
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
    fallback: !!item.fallback,
  }
}

function normalizeServerList(list) {
  const seen = {}
  const out = []
  ;(Array.isArray(list) ? list : []).forEach((item) => {
    const s = normalizeServer(item)
    if (!s.visible || seen[s.serverId]) return
    seen[s.serverId] = true
    out.push(s)
  })
  out.sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.serverId.localeCompare(b.serverId))
  return out.length ? out : getFallbackServers()
}

function getFallbackServers() {
  return FALLBACK_SERVERS.map(normalizeServer)
}

function canEnterServer(server) {
  return server && server.status === 'open'
}

function getStatusText(status) {
  if (status === 'maintenance') return '维护中'
  if (status === 'upcoming') return '即将开启'
  if (status === 'closed') return '已关闭'
  return '已开服'
}

function getStoredSelectedServerId() {
  try {
    const raw = P.getStorageSync(SELECTED_SERVER_KEY)
    return raw ? normalizeServerId(raw) : ''
  } catch (_) {
    return ''
  }
}

function hasLastSelectedServerId() {
  return !!getStoredSelectedServerId()
}

function getLastSelectedServerId() {
  return getStoredSelectedServerId() || DEFAULT_SERVER_ID
}

function setLastSelectedServerId(serverId) {
  const id = normalizeServerId(serverId)
  try { P.setStorageSync(SELECTED_SERVER_KEY, id) } catch (_) {}
  return id
}

function getLocalSaveKey(serverId) {
  return `${LOCAL_SAVE_PREFIX}_${normalizeServerId(serverId)}`
}

function getLegacyLocalSaveKey() {
  return LOCAL_SAVE_PREFIX
}

function scopedKey(base, serverId) {
  return `${base}_${normalizeServerId(serverId)}`
}

module.exports = {
  DEFAULT_SERVER_ID,
  SELECTED_SERVER_KEY,
  LOCAL_SAVE_PREFIX,
  getFallbackServers,
  normalizeServerId,
  normalizeServer,
  normalizeServerList,
  canEnterServer,
  getStatusText,
  getStoredSelectedServerId,
  hasLastSelectedServerId,
  getLastSelectedServerId,
  setLastSelectedServerId,
  getLocalSaveKey,
  getLegacyLocalSaveKey,
  scopedKey,
}
