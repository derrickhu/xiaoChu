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

const CLOUD_ENV = 'cloud1-6g8y0x2i39e768eb'

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

// init 时传入的引用和配置
let _dataRef = null
let _localKey = ''
let _currentVersion = 0
let _runMigrations = null

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
    if (P.isWeChat) {
      if (!_openid) return
      const db = P.cloud.database()
      const res = await db.collection('playerData').where({ _openid: _openid }).get()
      if (res.data && res.data.length > 0) {
        cloudData = res.data[0]
        delete cloudData._id
        delete cloudData._openid
      }
    } else {
      const res = await api.getPlayerData()
      if (res && res.data) cloudData = res.data
    }
    if (cloudData) {
      const cloudTime = cloudData._updateTime || cloudData.updatedAt || 0
      const localTime = _dataRef._updateTime || 0
      if (cloudTime > localTime) {
        _deepMerge(_dataRef, cloudData)
        if ((_dataRef._version || 0) < _currentVersion) {
          _runMigrations(_dataRef)
        }
        P.setStorageSync(_localKey, JSON.stringify(_dataRef))
        console.log('[Storage] 云端数据已合并到本地')
      }
    }
  } catch(e) { console.warn('Sync from cloud error:', e) }
}

// ===== 推送到云端 =====
async function _syncToCloud() {
  if (!_cloudReady || _syncDisabled) return
  if (_syncing) {
    _syncPending = true
    return
  }
  _syncing = true
  try {
    if (P.isDouyin) {
      await api.syncPlayerData({ ..._dataRef, _updateTime: Date.now() })
    } else {
      if (!_openid) return
      const db = P.cloud.database()
      const col = db.collection('playerData')
      const res = await col.where({ _openid: _openid }).get()
      const saveData = { ..._dataRef, _updateTime: Date.now() }
      delete saveData._id
      delete saveData._openid
      const _ = db.command
      const setData = {}
      for (const k of Object.keys(saveData)) { setData[k] = _.set(saveData[k]) }
      if (res.data && res.data.length > 1) {
        await col.doc(res.data[0]._id).update({ data: setData })
        for (let i = 1; i < res.data.length; i++) {
          try { await col.doc(res.data[i]._id).remove() } catch(e) {}
        }
        console.log('[Storage] 云同步完成，清理了', res.data.length - 1, '条重复记录')
      } else if (res.data && res.data.length === 1) {
        await col.doc(res.data[0]._id).update({ data: setData })
      } else {
        await col.add({ data: saveData })
      }
    }
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

// ===== 微信端辅助 =====
async function _ensureCollections() {
  const r = await P.cloud.callFunction({ name: 'initCollections' })
  if (r.result && r.result.errors && r.result.errors.length) {
    console.warn('创建集合异常:', r.result.errors)
  }
}

async function _getOpenid() {
  const r = await P.cloud.callFunction({ name: 'getOpenid' })
  _openid = (r.result && r.result.openid) || ''
}

// ===== 初始化入口 =====
async function init(persistData, opts) {
  _dataRef = persistData
  _localKey = opts.localKey
  _currentVersion = opts.currentVersion
  _runMigrations = opts.runMigrations

  if (P.isDouyin) {
    try {
      await api.login()
      _cloudReady = true
      console.log('[Storage] 抖音端 API 登录成功')
    } catch(e) {
      console.warn('[Storage] 抖音端 API 登录失败:', e.message || e)
      _cloudReady = true
      try {
        await api.getPlayerData()
        console.log('[Storage] 抖音端 API 直连测试通过')
      } catch(e2) {
        console.warn('[Storage] 抖音端后端不可达，本次会话云同步停用（本地存档正常）:', e2.message || e2)
        _cloudReady = false
      }
    }
  } else {
    try {
      P.cloud.init({ env: CLOUD_ENV, traceUser: true })
      _cloudReady = true
    } catch(e) {
      console.warn('Cloud init failed:', e)
      return
    }
    try { await _ensureCollections() } catch(e) {}
    try { await _getOpenid() } catch(e) { console.warn('Get openid failed:', e) }
  }

  if (_cloudReady && P.isWeChat && _openid) await _syncFromCloud()
  if (_cloudReady && P.isDouyin) await _syncFromCloud()

  _cloudInitDone = true
  if (_pendingSync && _cloudReady) {
    _pendingSync = false
    _syncToCloud()
  }
}

function isReady() { return _cloudReady }
function getOpenid() { return _openid }

module.exports = {
  init,
  syncToCloud: _syncToCloud,
  syncFromCloud: _syncFromCloud,
  debounceSyncToCloud,
  isReady,
  getOpenid,
}
