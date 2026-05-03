/**
 * 云函数侧旁路埋点白名单与字段裁剪
 */
'use strict'

const crypto = require('crypto')

const MAX_BATCH_SIZE = 20
const MAX_EVENT_PARAMS_BYTES = 1024

const ALLOWED_EVENT_IDS = new Set([
  'new_user_enter',
  'loading_ready',
  'loading_cloud_wait_timeout',
  'cloud_veteran_restored',
  'intro_show',
  'intro_finish',
  'intro_done',
  'first_screen_show',
  'newbie_prologue_prompt_show',
  'newbie_prologue_start_fail',
  'newbie_prologue_first_input',
  'newbie_prologue_invalid_drag',
  'newbie_prologue_first_damage',
  'newbie_prologue_clear',
  'newbie_prologue_result_show',
  'newbie_prologue_hint_show',
  'newbie_prologue_idle_5s',
  'newbie_prologue_idle_10s',
  'newbie_stage_prompt_show',
  'newbie_stage_cta_click',
  'newbie_stage_start_fail',
  'stage_start',
  'battle_first_frame',
  'stage_first_input',
  'stage_first_damage',
  'stage_1_1_first_input',
  'stage_1_1_first_damage',
  'stage_1_1_result_show',
  'stage_1_2_first_input',
  'stage_1_2_first_damage',
  'stage_1_2_result_show',
  'stage_clear',
  'stage_fail',
  'stage_exit',
  'ad_entry_show',
  'ad_click',
  'ad_show_success',
  'ad_complete',
  'ad_skip',
  'ad_error',
  'platform_gift_entry_click',
  'platform_gift_claimed',
  'platform_gift_empty',
  'platform_gift_unknown_goods',
  'analytics_client_error',
])

function hashOpenid(openid) {
  if (!openid) return ''
  return crypto.createHash('sha256').update(String(openid)).digest('hex').slice(0, 24)
}

function byteLen(text) {
  return Buffer.byteLength(String(text || ''), 'utf8')
}

function trimString(str, maxLen) {
  const s = String(str)
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

function sanitizeParams(params) {
  const raw = params && typeof params === 'object' ? params : {}
  const out = {}
  Object.keys(raw).forEach((key) => {
    if (!/^[a-zA-Z0-9_]+$/.test(key)) return
    const val = raw[key]
    if (val == null) return
    if (typeof val === 'number') {
      if (Number.isFinite(val)) out[key] = val
    } else if (typeof val === 'boolean') {
      out[key] = val
    } else if (typeof val === 'string') {
      out[key] = trimString(val, 96)
    } else if (Array.isArray(val)) {
      out[key] = trimString(JSON.stringify(val.slice(0, 8)), 160)
    } else if (typeof val === 'object') {
      out[key] = trimString(JSON.stringify(val), 160)
    }
  })

  let json = JSON.stringify(out)
  if (byteLen(json) <= MAX_EVENT_PARAMS_BYTES) return out

  const trimmed = {}
  for (const key of Object.keys(out)) {
    trimmed[key] = out[key]
    json = JSON.stringify(trimmed)
    if (byteLen(json) > MAX_EVENT_PARAMS_BYTES) {
      delete trimmed[key]
      break
    }
  }
  return trimmed
}

function inferStageId(eventId, params) {
  if (params && params.stageId) return String(params.stageId)
  if (eventId.indexOf('stage_1_1') >= 0) return 'stage_1_1'
  if (eventId.indexOf('stage_1_2') >= 0) return 'stage_1_2'
  if (eventId.indexOf('newbie_prologue') >= 0) return 'newbie_prologue'
  return ''
}

module.exports = {
  ALLOWED_EVENT_IDS,
  MAX_BATCH_SIZE,
  hashOpenid,
  sanitizeParams,
  inferStageId,
}
