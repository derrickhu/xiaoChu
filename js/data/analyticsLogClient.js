/**
 * 客户端旁路埋点队列
 *
 * 失败不影响游戏流程；不做大量离线持久化，避免日志系统反过来拖累主体验。
 */
'use strict'

const P = require('../platform')
const {
  MAX_BATCH_SIZE,
  MAX_EVENTS_PER_LIFECYCLE,
  MIN_FLUSH_INTERVAL_MS,
  isAllowedEvent,
  sanitizeParams,
  inferStageId,
} = require('./analyticsEventSchema')

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
  if (!P.isWeChat || !eventId || !isAllowedEvent(eventId)) return
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
  if (!P.isWeChat || _flushing || !_queue.length) return
  const now = _now()
  if (now - _lastFlushAt < 500 && _queue.length < MAX_BATCH_SIZE) return
  const batch = _queue.splice(0, MAX_BATCH_SIZE)
  _flushing = true
  _lastFlushAt = now
  P.cloud.callFunction({
    name: 'analyticsLog',
    data: { events: batch },
  }).then(() => {
    _flushing = false
    if (_queue.length) _scheduleFlush(MIN_FLUSH_INTERVAL_MS)
  }).catch((e) => {
    _flushing = false
    // 短重试一次，队列超长时丢弃旧事件，避免弱网下无限堆积。
    _queue = batch.concat(_queue).slice(-MAX_EVENTS_PER_LIFECYCLE)
    _scheduleFlush(FLUSH_RETRY_MS)
    try { console.warn('[AnalyticsLog] flush failed', e && (e.errMsg || e.message || e)) } catch (_e) {}
  })
}

module.exports = {
  enqueue,
  flush,
  getSessionId: _session,
}
