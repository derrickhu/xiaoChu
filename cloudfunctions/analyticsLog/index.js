/**
 * 旁路埋点日志云函数
 *
 * 只输出结构化日志，不写云数据库集合。日志由本地定时任务拉取后入 MySQL。
 */
'use strict'

const cloud = require('wx-server-sdk')
const {
  ALLOWED_EVENT_IDS,
  MAX_BATCH_SIZE,
  hashOpenid,
  sanitizeParams,
  inferStageId,
} = require('./eventSchema')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

function safeText(value, maxLen) {
  if (value == null) return ''
  const s = String(value)
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

function normalizeEvent(item, wxContext, serverAt) {
  if (!item || typeof item !== 'object') return null
  const eventId = safeText(item.eventId || item.event_id, 64)
  if (!ALLOWED_EVENT_IDS.has(eventId)) return null
  const params = sanitizeParams(item.params)
  const eventAt = Number(item.eventAt || item.event_at) || serverAt
  const sessionId = safeText(item.sessionId || item.session_id, 64)
  const scene = safeText(item.scene || params.scene || '', 48)
  const stageId = safeText(item.stageId || item.stage_id || inferStageId(eventId, params), 48)
  const clientVersion = safeText(item.clientVersion || item.client_version || params.clientVersion || '', 32)
  const platform = safeText(item.platform || params.platform || 'wechat', 24)
  const eventUuid = safeText(item.eventUuid || item.event_uuid || '', 96)

  return {
    type: 'analytics_event',
    event_id: eventId,
    event_at: eventAt,
    server_at: serverAt,
    openid_hash: hashOpenid(wxContext.OPENID || ''),
    session_id: sessionId,
    scene,
    stage_id: stageId,
    client_version: clientVersion,
    platform,
    event_uuid: eventUuid,
    params_json: JSON.stringify(params),
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const serverAt = Date.now()
  const input = Array.isArray(event && event.events) ? event.events : []
  const batch = input.slice(0, MAX_BATCH_SIZE)
  let accepted = 0

  for (const item of batch) {
    const row = normalizeEvent(item, wxContext, serverAt)
    if (!row) continue
    accepted++
    console.log(JSON.stringify(row))
  }

  return {
    ok: true,
    accepted,
    dropped: Math.max(0, input.length - accepted),
  }
}
