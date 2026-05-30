/**
 * 经分系统通用打点适配层
 *
 * xiao_chu 当前是无构建的 CommonJS 小游戏项目，不能直接 import TS 版 @gp/analytics-sdk。
 * 这里按同一份事件协议实现轻量适配：事件结构、批量上报地址、user_id/session/anonymous 语义与 SDK 保持一致。
 */
'use strict'

const P = require('../platform')
const { AD_REWARDS } = require('./economyConfig')

const ENDPOINT = 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com/analytics-ingest/track'
const GAME_KEY = 'xiaochu'
const SDK_VERSION = '0.1.0-xiaochu-adapter'
const APP_VERSION = '1.0.20260308.0109'
const ANON_KEY = '__gp_analytics_anonymous_id__'
const FLUSH_INTERVAL_MS = 15000
const FLUSH_BULK_SIZE = 20
const MAX_QUEUE_SIZE = 500

let _inited = false
let _userId = ''
let _anonymousId = ''
let _sessionId = ''
let _sessionSeq = 0
let _queue = []
let _flushTimer = null
let _flushing = false
let _sessionStarted = false

function _now() { return Date.now() }

function _randomId() {
  return `${_now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function _loadOrCreateAnonymousId() {
  try {
    const cached = P.getStorageSync(ANON_KEY)
    if (cached && String(cached).length >= 8) return String(cached)
  } catch (_e) {}
  const fresh = `anon_${_randomId()}`
  try { P.setStorageSync(ANON_KEY, fresh) } catch (_e) {}
  return fresh
}

function _deviceInfo() {
  const dev = P.getDeviceInfo ? P.getDeviceInfo() : {}
  const win = P.getWindowInfo ? P.getWindowInfo() : {}
  return {
    brand: String(dev.brand || ''),
    model: String(dev.model || ''),
    system: String(dev.system || dev.platform || ''),
    sdk_version: String(dev.SDKVersion || dev.sdkVersion || ''),
    screen_w: Number(win.windowWidth || 0),
    screen_h: Number(win.windowHeight || 0),
    network: 'unknown',
  }
}

function _sanitize(params) {
  const out = {}
  if (!params || typeof params !== 'object') return out
  Object.keys(params).forEach((key) => {
    const val = params[key]
    if (val === undefined) return
    if (val === null || typeof val === 'number' || typeof val === 'boolean') {
      out[key] = val
    } else if (typeof val === 'string') {
      out[key] = val.length > 240 ? val.slice(0, 240) : val
    } else {
      try { out[key] = JSON.stringify(val).slice(0, 240) } catch (_e) {}
    }
  })
  return out
}

function _scheduleFlush() {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    flush()
  }, FLUSH_INTERVAL_MS)
}

function init() {
  if (_inited) return
  _anonymousId = _loadOrCreateAnonymousId()
  _sessionId = _randomId()
  _sessionSeq = 0
  _inited = true
  try {
    P.onHide(() => {
      track('session_end', { reason: 'hide' })
      flush()
    })
  } catch (_e) {}
}

function setUserId(userId) {
  init()
  const next = String(userId || '')
  const becameLoggedIn = !!next && !_userId
  _userId = next
  if (becameLoggedIn) {
    track('login', { from_anonymous: true })
    flush()
  }
}

function trackSessionStart(params) {
  if (_sessionStarted) return
  _sessionStarted = true
  track('session_start', Object.assign({
    entry: 'main',
    with_user_id: !!_userId,
  }, params || {}))
}

function track(eventName, params) {
  init()
  if (!eventName) return
  if (_queue.length >= MAX_QUEUE_SIZE) _queue.shift()
  _queue.push({
    event_id: _randomId(),
    event_name: eventName,
    event_ts: _now(),
    game_key: GAME_KEY,
    app_version: APP_VERSION,
    sdk_version: SDK_VERSION,
    platform: P.isDouyin ? 'douyin' : (P.isWeChat ? 'wechat' : 'unknown'),
    user_id: _userId,
    anonymous_id: _anonymousId,
    session_id: _sessionId,
    session_seq: ++_sessionSeq,
    device: _deviceInfo(),
    params: _sanitize(params),
  })
  if (_queue.length >= FLUSH_BULK_SIZE) flush()
  else _scheduleFlush()
}

function _request(batch) {
  return new Promise((resolve) => {
    P.request({
      url: ENDPOINT,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: { batch },
      success: (res) => resolve(!!(res && res.statusCode >= 200 && res.statusCode < 300)),
      fail: () => resolve(false),
    })
  })
}

async function flush() {
  if (_flushing || _queue.length === 0) return
  _flushing = true
  const batch = _queue.splice(0, Math.min(_queue.length, 50))
  const ok = await _request(batch)
  if (!ok) {
    _queue = batch.concat(_queue).slice(0, MAX_QUEUE_SIZE)
    _scheduleFlush()
  }
  _flushing = false
}

function _adUnitId(slotId) {
  const cfg = AD_REWARDS && AD_REWARDS[slotId]
  return (cfg && cfg.adUnitId) || ''
}

function trackFunnelEvent(eventId, params) {
  const p = params || {}
  if (eventId === 'stage_start') {
    track('level_start', {
      level_id: p.stageId || 'unknown_stage',
      mode: p.scene || 'stage',
      team_size: p.teamSize || 0,
    })
    return
  }
  if (eventId === 'stage_clear') {
    track('level_clear', {
      level_id: p.stageId || 'unknown_stage',
      mode: 'stage',
      turns: p.turns || 0,
      rating: p.rating || '',
      is_first_clear: !!p.isFirstClear,
    })
    return
  }
  if (eventId === 'stage_fail') {
    track('level_fail', {
      level_id: p.stageId || 'unknown_stage',
      mode: 'stage',
      turns: p.turns || 0,
      wave_idx: p.waveIdx || 0,
      reason: p.reason || 'defeat',
    })
    return
  }
  if (eventId === 'ad_click') {
    track('ad_click', {
      ad_unit_id: _adUnitId(p.slotId),
      ad_type: 'reward',
      scene: p.scene || p.slotId || 'unknown',
      level_id: p.stageId || '',
    })
    return
  }
  if (eventId === 'ad_show_success') {
    track('ad_show', {
      ad_unit_id: _adUnitId(p.slotId),
      ad_type: 'reward',
      scene: p.scene || p.slotId || 'unknown',
      level_id: p.stageId || '',
    })
    return
  }
  if (eventId === 'ad_complete' || eventId === 'ad_skip') {
    track('ad_close', {
      ad_unit_id: _adUnitId(p.slotId),
      ad_type: 'reward',
      scene: p.scene || p.slotId || 'unknown',
      is_ended: eventId === 'ad_complete',
      fallback: !!p.fallback,
    })
    return
  }
  if (eventId === 'ad_error') {
    track('ad_error', {
      ad_unit_id: _adUnitId(p.slotId),
      ad_type: 'reward',
      scene: p.scene || p.slotId || 'unknown',
      err_code: p.errorCode || p.errCode || 'unknown',
      err_msg: p.errMsg || p.errorMsg || '',
    })
  }
}

module.exports = {
  init,
  setUserId,
  track,
  trackSessionStart,
  trackFunnelEvent,
  flush,
}
