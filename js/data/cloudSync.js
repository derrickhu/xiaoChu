/**
 * 云同步模块 — 灵宠消消塔
 * 从 Storage 中拆分出的云端数据同步逻辑
 * 管理：微信云数据库 / 抖音 HTTP API 的双端同步
 */

const P = require('../platform')
const api = require('../api')
const {
  CLOUD_SYNC_BASE_DELAY_MS,
  CLOUD_SYNC_MAX_BACKOFF_MS,
  CLOUD_SYNC_MAX_FAIL,
  CLOUD_SYNC_LOG_THRESHOLD,
  CLOUD_SYNC_RETRY_INTERVAL_MS,
} = require('./constants')

// ===== 内部状态 =====
let _cloudReady = false
let _openid = ''
let _cloudSyncTimer = null
let _cloudInitDone = false
let _pendingSync = false
let _syncFailCount = 0
let _syncDisabled = false
let _syncDirty = false
let _syncRetryTimer = null
let _syncing = false
let _syncPending = false
let _onSyncDone = null
let _onPlatformGifts = null
let _serverId = 's1'

// init 时传入的引用和配置
let _dataRef = null
let _localKey = ''
let _currentVersion = 0
let _runMigrations = null

function _normalizeServerId(value) {
  const id = String(value || '').trim().toLowerCase()
  return /^s[1-9][0-9]{0,3}$/.test(id) ? id : 's1'
}

function _hasAnyKey(obj) {
  return !!(obj && typeof obj === 'object' && Object.keys(obj).length > 0)
}

function _hasNonZeroMapValue(obj) {
  if (!obj || typeof obj !== 'object') return false
  return Object.keys(obj).some((key) => {
    const val = obj[key]
    if (typeof val === 'number') return val > 0
    if (Array.isArray(val)) return val.length > 0
    return !!val
  })
}

function _hasGameplayProgress(data) {
  if (!data || typeof data !== 'object') return false
  const cult = data.cultivation || {}
  const levels = cult.levels || {}
  const hasCultivationProgress = (cult.totalExpEarned || 0) > 0
    || (cult.skillPoints || 0) > 0
    || Object.keys(levels).some((key) => (levels[key] || 0) > 0)

  return (data.bestFloor || 0) > 0
    || (data.totalRuns || 0) > 0
    || ((data.petPool && data.petPool.length) || 0) > 0
    || ((data.petDex && data.petDex.length) || 0) > 0
    || ((data.weaponCollection && data.weaponCollection.length) || 0) > 0
    || (data.soulStone || 0) > 0
    || (data.awakenStone || 0) > 0
    || _hasAnyKey(data.stageClearRecord)
    || _hasNonZeroMapValue(data.fragmentBank)
    || hasCultivationProgress
}

// ===== 深度合并 =====
// cloud 的值覆盖 target，但对嵌套对象递归合并
// 保留 target 中有但 cloud 中没有的字段（如后来新增的 bestTotalTurns）
function _deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const sv = source[key]
    const tv = target[key]
    if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
      _deepMerge(tv, sv)
    } else {
      if (key === 'bestFloor') {
        target[key] = Math.max(tv || 0, sv || 0)
      } else if (key === 'bestTotalTurns') {
        if ((tv || 0) > 0 && (sv || 0) > 0) target[key] = Math.min(tv, sv)
        else target[key] = (tv || 0) > 0 ? tv : (sv || 0)
      } else if (key === 'maxCombo') {
        target[key] = Math.max(tv || 0, sv || 0)
      } else if (key === 'totalBattles' || key === 'totalCombos' || key === 'totalRuns') {
        target[key] = Math.max(tv || 0, sv || 0)
      } else if (key === '_pendingWipeNotice' && tv === false && sv === true) {
        // 本机已点「我知道了」后本地为 false；云端若仍残留 true（上次未上传成功或时序问题），不要再次弹出
      } else {
        target[key] = sv
      }
    }
  }
}

// ===== 从云端拉取并合并 =====
async function _syncFromCloud() {
  if (!_cloudReady) return
  try {
    let cloudData = null
    const res = await api.getPlayerData()
    if (res && res.data) cloudData = res.data
    if (cloudData) {
      if ((cloudData.dataVersion || 0) < (_dataRef.dataVersion || 0)) {
        console.log('[CloudSync] 云端 dataVersion 较低，跳过合并，推送本地数据')
        _syncToCloud()
        return
      }
      const cloudHasProgress = _hasGameplayProgress(cloudData)
      const localHasProgress = _hasGameplayProgress(_dataRef)
      const cloudTime = cloudData._updateTime || cloudData.updatedAt || 0
      const localTime = _dataRef._updateTime || 0
      const shouldMergeFromCloud = (cloudHasProgress && !localHasProgress)
        || (cloudHasProgress && localTime === 0)
        || cloudTime > localTime

      if (shouldMergeFromCloud) {
        _deepMerge(_dataRef, cloudData)
        if ((_dataRef._version || 0) < _currentVersion) {
          _runMigrations(_dataRef)
        }
        _dataRef._updateTime = cloudTime || Date.now()
        P.setStorageSync(_localKey, JSON.stringify(_dataRef))
        console.log('[Storage] 云端数据已合并到本地')
      }
    }
  } catch(e) { console.warn('Sync from cloud error:', e) }
}

// ===== 拉取微信平台礼包并自动入账 =====
// 玩家在原生福利页领取后，微信异步回调写 pending；此处 sync 后直接 grant，不再等卷轴二次领取。
async function _claimPendingGifts(storage) {
  if (!P.isWeChat || !_cloudReady || !_openid) return
  try {
    const platformWelfare = require('../engine/platformWelfare')
    const result = await platformWelfare.syncAndGrantPendingGifts(storage)
    if (_onPlatformGifts) _onPlatformGifts(result)
  } catch (e) {
    console.warn('[CloudSync] 拉取平台礼包失败', e)
  }
}

async function markPlatformGiftsGranted(ids) {
  if (!P.isWeChat || !_cloudReady || !_openid) return { updated: 0 }
  if (!ids || !Array.isArray(ids) || ids.length === 0) return { updated: 0 }
  const res = await api.markGiftsGranted(ids)
  return (res && res.data) || res || { updated: 0 }
}

// ===== 推送到云端 =====
function _clonePersistData(data) {
  try { return JSON.parse(JSON.stringify(data || {})) } catch (_) { return { ...(data || {}) } }
}

async function _syncToCloud() {
  if (!_cloudReady || _syncDisabled) return
  if (_syncing) {
    _syncPending = true
    return
  }
  _syncing = true
  try {
    const syncTime = Date.now()
    _dataRef._updateTime = syncTime
    const safeData = _clonePersistData(_dataRef)
    try { P.setStorageSync(_localKey, JSON.stringify(safeData)) } catch (e) {}

    await api.syncPlayerData(safeData)
    if (_syncFailCount > 0) {
      console.log('[Storage] 云同步恢复成功，已上传最新数据')
    }
    _syncFailCount = 0
    _syncDirty = false
    _syncDisabled = false
    if (_syncRetryTimer) {
      clearInterval(_syncRetryTimer)
      _syncRetryTimer = null
    }
  } catch(e) {
    _syncFailCount = (_syncFailCount || 0) + 1
    _syncDirty = true
    if (_syncFailCount <= CLOUD_SYNC_LOG_THRESHOLD) {
      console.warn(`[Storage] 云同步失败(${_syncFailCount}/${CLOUD_SYNC_MAX_FAIL}):`, e.message || e)
    }
    if (_syncFailCount >= CLOUD_SYNC_MAX_FAIL) {
      if (!_syncRetryTimer) {
        console.warn('[Storage] 云同步连续失败，进入低频重试模式（本地存档正常，不丢数据）')
        _syncRetryTimer = setInterval(() => {
          if (_syncDirty && !_syncing) {
            console.log('[Storage] 低频重试云同步...')
            _syncToCloud()
          }
        }, CLOUD_SYNC_RETRY_INTERVAL_MS)
      }
      _syncDisabled = true
    }
  } finally {
    _syncing = false
    if (_syncPending && !_syncDisabled) {
      _syncPending = false
      debounceSyncToCloud(_dataRef)
    }
  }
}

// ===== 防抖同步（每次 _save 后调用） =====
function debounceSyncToCloud(data) {
  _dataRef = data
  if (!_cloudInitDone) {
    _pendingSync = true
    return
  }
  if (_syncDisabled) return
  if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer)
  const delay = _syncFailCount > 0
    ? Math.min(CLOUD_SYNC_BASE_DELAY_MS * Math.pow(2, _syncFailCount), CLOUD_SYNC_MAX_BACKOFF_MS)
    : CLOUD_SYNC_BASE_DELAY_MS
  _cloudSyncTimer = setTimeout(() => {
    _cloudSyncTimer = null
    _syncToCloud()
  }, delay)
}

function reset() {
  if (_cloudSyncTimer) clearTimeout(_cloudSyncTimer)
  if (_syncRetryTimer) clearInterval(_syncRetryTimer)
  _cloudReady = false
  _openid = ''
  _cloudSyncTimer = null
  _cloudInitDone = false
  _pendingSync = false
  _syncFailCount = 0
  _syncDisabled = false
  _syncDirty = false
  _syncRetryTimer = null
  _syncing = false
  _syncPending = false
  _onSyncDone = null
  _onPlatformGifts = null
  _serverId = 's1'
  _dataRef = null
  _localKey = ''
  _currentVersion = 0
  _runMigrations = null
  if (api.resetRemoteState) api.resetRemoteState()
}

// ===== 初始化入口 =====
async function init(persistData, opts) {
  reset()
  const options = opts || {}
  _serverId = _normalizeServerId(options.serverId)
  if (api.setServer) api.setServer(_serverId)
  _dataRef = persistData
  _localKey = options.localKey
  _currentVersion = options.currentVersion
  _runMigrations = options.runMigrations
  _onSyncDone = options.onSyncDone || null
  _onPlatformGifts = options.onPlatformGifts || null

  try {
    const loginRes = await api.login()
    _openid = (loginRes && (loginRes.openId || loginRes.userId)) || api.openId || api.userId || ''
    _cloudReady = true
    console.log('[Storage] xiaochu-api 登录成功:', _openid)
  } catch(e) {
    console.warn('[Storage] xiaochu-api 登录失败，本次会话云同步停用（本地存档正常）:', e.message || e)
    _openid = ''
    _cloudReady = false
  }

  if (_cloudReady) await _syncFromCloud()

  // 微信端：拉取平台礼包（需要 opts.storage 传入 Storage 实例）
  if (_cloudReady && P.isWeChat && _openid && opts.storage) {
    await _claimPendingGifts(opts.storage)
  }

  // 通知外部：云同步初始化（含首次拉取合并）完成
  if (_onSyncDone) _onSyncDone()

  _cloudInitDone = true
  if (_pendingSync && _cloudReady) {
    _pendingSync = false
    _syncToCloud()
  }
}

function isReady() { return _cloudReady }
function getOpenid() { return _openid }
function getServerId() { return _serverId }

module.exports = {
  init,
  reset,
  syncToCloud: _syncToCloud,
  syncFromCloud: _syncFromCloud,
  markPlatformGiftsGranted,
  debounceSyncToCloud,
  isReady,
  getOpenid,
  getServerId,
}
