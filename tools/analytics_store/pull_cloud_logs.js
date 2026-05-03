#!/usr/bin/env node
'use strict'

/**
 * 从微信云开发日志拉取旁路埋点，写入本地 MySQL。
 *
 * 依赖本机已安装并登录 tcb CLI：
 *   tcb logs search --json -e <envId> -q 'function_name:"analyticsLog" AND src:app' -t '2026-05-03 18:00:00,2026-05-03 19:00:00'
 */

const crypto = require('crypto')
const { execFileSync } = require('child_process')
const { loadConfig } = require('./config')
const { createConnection, toMysqlDate } = require('./db')

function parseLocalTime(text) {
  if (!text) return 0
  const ms = new Date(String(text).trim().replace(' ', 'T')).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function parseArgs(argv) {
  const opts = { since: 0, until: 0, maxPages: 20, recentMinutes: 0, lagMinutes: null, fullHour: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--since') opts.since = parseLocalTime(argv[++i])
    else if (arg === '--until') opts.until = parseLocalTime(argv[++i])
    else if (arg === '--max-pages') opts.maxPages = Number(argv[++i]) || opts.maxPages
    else if (arg === '--recent-minutes') opts.recentMinutes = Number(argv[++i]) || opts.recentMinutes
    else if (arg === '--lag-minutes') opts.lagMinutes = Math.max(0, Number(argv[++i]) || 0)
    else if (arg === '--full-hour') opts.fullHour = true
  }
  return opts
}

function getLogLagMinutes(cfg, opts) {
  if (opts && opts.lagMinutes !== null) return opts.lagMinutes
  return Math.max(0, Number(cfg.cloudLogs && cfg.cloudLogs.timeLagMinutes) || 5)
}

function defaultWindow(cfg, opts) {
  const lag = getLogLagMinutes(cfg, opts)
  const end = new Date(Date.now() - lag * 60 * 1000)
  if (opts && opts.fullHour) {
    end.setMinutes(0, 0, 0)
  }
  const minutes = Math.max(1, Number(opts && opts.recentMinutes) || Number(cfg.cloudLogs && cfg.cloudLogs.recentMinutes) || 60)
  const start = new Date(end.getTime() - minutes * 60 * 1000)
  return { start: start.getTime(), end: end.getTime() }
}

function floorHour(ms) {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

function ceilHour(ms) {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  if (d.getTime() < ms) d.setHours(d.getHours() + 1)
  return d.getTime()
}

function runTcbSearch(cfg, startMs, endMs, context) {
  const args = [
    'logs', 'search',
    '--json',
    '-e', cfg.cloudLogs.envId,
    '-q', cfg.cloudLogs.query || 'type:analytics_event',
    '-t', `${toMysqlDate(startMs)},${toMysqlDate(endMs)}`,
    '--limit', '100',
    '--sort', 'asc',
  ]
  if (context) args.push('--context', context)
  try {
    const stdout = execFileSync('tcb', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    return JSON.parse(stdout)
  } catch (e) {
    const msg = e.stderr ? String(e.stderr) : (e.message || String(e))
    throw new Error(`tcb logs search 失败：${msg.trim()}`)
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function collectLogItems(res) {
  if (!res) return { rows: [], context: '', done: true }
  if (Array.isArray(res)) return { rows: res, context: '', done: true }
  const data = res.data || res.result || res
  let payload = data
  if (typeof data.LogResults === 'string') {
    try { payload = JSON.parse(data.LogResults) } catch (_e) {}
  }
  const rows = asArray(payload.Results)
    .concat(asArray(payload.results))
    .concat(asArray(payload.logs))
    .concat(asArray(payload.list))
    .concat(asArray(data.Results))
  const context = payload.Context || payload.context || data.Context || data.context || ''
  const done = payload.ListOver === true || payload.listOver === true || !context
  return { rows, context, done }
}

function parseContent(item) {
  if (!item) return null
  if (item.type === 'analytics_event' || item.event_id) return item
  const content = item.Content || item.content || item.log || item.__CONTENT__ || ''
  if (typeof content === 'object' && content) {
    if (content.type === 'analytics_event' || content.event_id) return content
    if (typeof content.log === 'string') {
      const logText = content.log.trim()
      try { return JSON.parse(logText) } catch (_e) {}
      const match = logText.match(/\{.*\}/)
      if (match) {
        try { return JSON.parse(match[0]) } catch (_e) {}
      }
    }
    return content
  }
  if (typeof content !== 'string') return null
  const trimmed = content.trim()
  if (!trimmed) return null
  try { return JSON.parse(trimmed) } catch (_e) {}
  const match = trimmed.match(/\{.*\}/)
  if (match) {
    try { return JSON.parse(match[0]) } catch (_e) {}
  }
  return null
}

function stableUuid(row) {
  if (row.event_uuid) return String(row.event_uuid)
  const base = [
    row.openid_hash || '',
    row.session_id || '',
    row.event_id || '',
    row.event_at || '',
    row.params_json || '',
  ].join('|')
  return crypto.createHash('sha1').update(base).digest('hex')
}

function normalizeLog(item) {
  const row = parseContent(item)
  if (!row || row.type !== 'analytics_event' || !row.event_id) return null
  let params = {}
  if (row.params_json) {
    try { params = typeof row.params_json === 'string' ? JSON.parse(row.params_json) : row.params_json } catch (_e) {}
  }
  const eventAt = Number(row.event_at) || Date.parse(row.event_at) || Date.now()
  const serverAt = Number(row.server_at) || Date.parse(row.server_at) || eventAt
  return {
    event_uuid: stableUuid(row),
    event_at: toMysqlDate(eventAt),
    server_at: toMysqlDate(serverAt),
    openid_hash: String(row.openid_hash || ''),
    session_id: String(row.session_id || ''),
    event_id: String(row.event_id || ''),
    scene: String(row.scene || ''),
    stage_id: String(row.stage_id || ''),
    client_version: String(row.client_version || ''),
    platform: String(row.platform || ''),
    params_json: JSON.stringify(params),
    raw_log: JSON.stringify(row),
  }
}

async function insertEvents(conn, rows, pullRunId) {
  let inserted = 0
  const sql = `INSERT IGNORE INTO analytics_events
    (event_uuid, event_at, server_at, openid_hash, session_id, event_id, scene, stage_id, client_version, platform, params_json, raw_log, pull_run_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), CAST(? AS JSON), ?)`
  for (const r of rows) {
    const [res] = await conn.execute(sql, [
      r.event_uuid, r.event_at, r.server_at, r.openid_hash, r.session_id, r.event_id,
      r.scene, r.stage_id, r.client_version, r.platform, r.params_json, r.raw_log, pullRunId,
    ])
    inserted += res.affectedRows || 0
  }
  return inserted
}

async function rebuildHourlyMetrics(conn, startMs, endMs) {
  const start = toMysqlDate(floorHour(startMs))
  const end = toMysqlDate(ceilHour(endMs))
  await conn.execute('DELETE FROM funnel_hourly_metrics WHERE bucket_hour >= ? AND bucket_hour < ?', [start, end])
  await conn.execute(`
    INSERT INTO funnel_hourly_metrics (
      bucket_hour, client_version, new_users, loading_ready, intro_finish,
      prologue_first_input, prologue_first_damage, prologue_clear,
      stage_1_1_start, stage_1_1_first_input, stage_1_1_clear,
      stage_1_2_start, stage_1_2_first_input, stage_1_2_clear,
      platform_gift_claimed, ad_entry_show, ad_click, ad_complete
    )
    SELECT
      STR_TO_DATE(DATE_FORMAT(event_at, '%Y-%m-%d %H:00:00'), '%Y-%m-%d %H:%i:%s') AS bucket_hour,
      client_version,
      COUNT(DISTINCT CASE WHEN event_id = 'new_user_enter' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'loading_ready' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id IN ('intro_finish','intro_done','first_screen_show') THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'newbie_prologue_first_input' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'newbie_prologue_first_damage' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'newbie_prologue_clear' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'stage_start' AND stage_id = 'stage_1_1' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'stage_1_1_first_input' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'stage_clear' AND stage_id = 'stage_1_1' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'stage_start' AND stage_id = 'stage_1_2' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'stage_1_2_first_input' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'stage_clear' AND stage_id = 'stage_1_2' THEN openid_hash END),
      COUNT(DISTINCT CASE WHEN event_id = 'platform_gift_claimed' THEN openid_hash END),
      COUNT(CASE WHEN event_id = 'ad_entry_show' THEN 1 END),
      COUNT(CASE WHEN event_id = 'ad_click' THEN 1 END),
      COUNT(CASE WHEN event_id = 'ad_complete' THEN 1 END)
    FROM analytics_events
    WHERE event_at >= ? AND event_at < ?
    GROUP BY bucket_hour, client_version
  `, [start, end])
}

async function main() {
  const cfg = loadConfig()
  const opts = parseArgs(process.argv.slice(2))
  const win = defaultWindow(cfg, opts)
  const startMs = opts.since || win.start
  const endMs = opts.until || win.end
  if (!startMs || !endMs || startMs >= endMs) throw new Error('时间窗口无效')

  const conn = await createConnection()
  let pullRunId = 0
  let pulled = 0
  let inserted = 0
  try {
    const [res] = await conn.execute(
      'INSERT INTO log_pull_runs (window_start, window_end, status) VALUES (?, ?, ?)',
      [toMysqlDate(startMs), toMysqlDate(endMs), 'running']
    )
    pullRunId = res.insertId

    let context = ''
    for (let page = 0; page < opts.maxPages; page++) {
      const raw = runTcbSearch(cfg, startMs, endMs, context)
      const batch = collectLogItems(raw)
      const rows = batch.rows.map(normalizeLog).filter(Boolean)
      pulled += rows.length
      inserted += await insertEvents(conn, rows, pullRunId)
      if (batch.done) break
      context = batch.context
    }

    await rebuildHourlyMetrics(conn, startMs, endMs)
    await conn.execute(
      'UPDATE log_pull_runs SET pulled_count=?, inserted_count=?, status=? WHERE id=?',
      [pulled, inserted, 'success', pullRunId]
    )
    console.log(`✓ 日志拉取完成 ${toMysqlDate(startMs)} ~ ${toMysqlDate(endMs)}，拉取 ${pulled}，新增 ${inserted}`)
  } catch (e) {
    if (pullRunId) {
      await conn.execute(
        'UPDATE log_pull_runs SET pulled_count=?, inserted_count=?, status=?, error_message=? WHERE id=?',
        [pulled, inserted, 'failed', String(e.message || e).slice(0, 2000), pullRunId]
      )
    }
    throw e
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('日志拉取失败:', e.message || e)
  process.exit(1)
})
