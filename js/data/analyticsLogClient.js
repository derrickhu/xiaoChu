/**
 * 客户端旁路埋点队列
 *
 * 失败不影响游戏流程；不做大量离线持久化，避免日志系统反过来拖累主体验。
 */
'use strict'

const {
  MAX_BATCH_SIZE,
  MAX_EVENTS_PER_LIFECYCLE,
  MIN_FLUSH_INTERVAL_MS,
  isAllowedEvent,
  sanitizeParams,
  inferStageId,
} = require('./analyticsEventSchema')

// 历史埋点曾直连微信云函数 analyticsLog。
// 现在基础链路已迁到 xiaochu-api HTTP 后端，客户端不再调用微信云 API。
// 后续如需恢复埋点，应新增 xiaochu-api /analytics/log 路由后再打开。
const ENABLE_REMOTE_ANALYTICS = false
const FLUSH_RETRY_MS = 30000

let _sessionId = ''
let _queue = []
let _sentOrQueuedCount = 0
let _flushing = false
let _flushTimer = null
let _lastFlushAt = 0
let _eventSeq = 0

function _now() { return Date.now() }

function _session() {
  if (!_sessionId) {
    _sessionId = `s${_now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  }
  return _sessionId
}

function _eventUuid(eventId) {
  _eventSeq++
  return `${_session()}_${_eventSeq}_${eventId}`
}

function _scheduleFlush(delay) {
  if (_flushTimer) return
  _flushTimer = setTimeout(() => {
    _flushTimer = null
    flush()
  }, delay)
}

function enqueue(eventId, params) {
  if (!ENABLE_REMOTE_ANALYTICS || !eventId || !isAllowedEvent(eventId)) return
  if (_sentOrQueuedCount >= MAX_EVENTS_PER_LIFECYCLE) return
  const eventAt = _now()
  const safeParams = sanitizeParams(params)
  _queue.push({
    eventId,
    eventAt,
    eventUuid: _eventUuid(eventId),
    sessionId: _session(),
    scene: safeParams.scene || '',
    stageId: inferStageId(eventId, safeParams),
    clientVersion: safeParams.clientVersion || safeParams.dataVersion || '',
    platform: 'wechat',
    params: safeParams,
  })
  _sentOrQueuedCount++
  if (_queue.length >= MAX_BATCH_SIZE) {
    flush()
  } else {
    const gap = Math.max(0, MIN_FLUSH_INTERVAL_MS - (eventAt - _lastFlushAt))
    _scheduleFlush(gap || MIN_FLUSH_INTERVAL_MS)
  }
}

function flush() {
  // 远程埋点已关闭：清空旁路队列，绝不调用 wx.cloud。
  _queue = []
  _flushing = false
}

module.exports = {
  enqueue,
  flush,
  getSessionId: _session,
}
