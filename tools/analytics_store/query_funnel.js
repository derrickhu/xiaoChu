#!/usr/bin/env node
'use strict'

const { createConnection, toMysqlDate } = require('./db')

function parseLocalTime(text) {
  if (!text) return 0
  const ms = new Date(String(text).trim().replace(' ', 'T')).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function parseArgs(argv) {
  const opts = { since: 0, until: Date.now() }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--since') opts.since = parseLocalTime(argv[++i])
    else if (arg === '--until') opts.until = parseLocalTime(argv[++i])
  }
  if (!opts.since) opts.since = Date.now() - 24 * 60 * 60 * 1000
  return opts
}

function pct(n, d) {
  if (!d) return '0.0%'
  return (n / d * 100).toFixed(1) + '%'
}

function printMetric(label, n, d) {
  console.log(`${label.padEnd(18)} ${String(n).padStart(5)} / ${String(d).padStart(5)}  ${pct(n, d)}`)
}

function printAdjacent(rows) {
  console.log('\n相邻步骤转化')
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]
    const drop = Math.max(0, prev.count - curr.count)
    console.log(`${prev.label} → ${curr.label}`.padEnd(28)
      + `${String(curr.count).padStart(5)} / ${String(prev.count).padStart(5)}  ${pct(curr.count, prev.count)}  流失 ${drop}`)
  }
}

function printTopDrops(rows) {
  const drops = []
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]
    drops.push({
      from: prev.label,
      to: curr.label,
      drop: Math.max(0, prev.count - curr.count),
      rate: prev.count ? curr.count / prev.count : 0,
      fromCount: prev.count,
      toCount: curr.count,
    })
  }
  console.log('\nTop 掉点')
  drops.filter(x => x.drop > 0).sort((a, b) => b.drop - a.drop).slice(0, 8).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.from} → ${item.to}: 流失 ${item.drop}，转化 ${pct(item.toCount, item.fromCount)}`)
  })
}

function chapter1StageIds() {
  return Array.from({ length: 8 }, (_, i) => `stage_1_${i + 1}`)
}

function cohortFilter(rangeWhere) {
  return `openid_hash IN (
    SELECT DISTINCT openid_hash
    FROM analytics_events
    WHERE ${rangeWhere} AND event_id='new_user_enter' AND openid_hash <> ''
  )`
}

async function countUsers(conn, where, params) {
  const [rows] = await conn.execute(
    `SELECT COUNT(DISTINCT openid_hash) AS n FROM analytics_events WHERE ${where}`,
    params
  )
  return rows[0] ? Number(rows[0].n || 0) : 0
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const start = toMysqlDate(opts.since)
  const end = toMysqlDate(opts.until)
  const conn = await createConnection()
  try {
    const rangeWhere = 'event_at >= ? AND event_at < ?'
    const range = [start, end]
    const total = await countUsers(conn, `${rangeWhere} AND event_id='new_user_enter'`, range)
    const cohortWhere = cohortFilter(rangeWhere)
    const cohortRange = range.concat(range)
    const rows = [
      { label: '新用户进入', count: total },
      { label: '加载完成', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='loading_ready'`, cohortRange) },
      { label: '开场剧情完成', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id IN ('intro_finish','intro_done','first_screen_show')`, cohortRange) },
      { label: '开始序章', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_start' AND stage_id='newbie_prologue'`, cohortRange) },
      { label: '战斗首帧', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='battle_first_frame' AND stage_id='newbie_prologue'`, cohortRange) },
      { label: '序章首次操作', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='newbie_prologue_first_input'`, cohortRange) },
      { label: '序章首次伤害', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='newbie_prologue_first_damage'`, cohortRange) },
      { label: '序章通关', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='newbie_prologue_clear'`, cohortRange) },
      { label: '开始 1-1', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_start' AND stage_id='stage_1_1'`, cohortRange) },
      { label: '1-1 首次操作', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id IN ('stage_1_1_first_input','stage_first_input') AND stage_id='stage_1_1'`, cohortRange) },
      { label: '1-1 首次伤害', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id IN ('stage_1_1_first_damage','stage_first_damage') AND stage_id='stage_1_1'`, cohortRange) },
      { label: '通关 1-1', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_clear' AND stage_id='stage_1_1'`, cohortRange) },
      { label: '开始 1-2', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_start' AND stage_id='stage_1_2'`, cohortRange) },
      { label: '1-2 首次操作', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id IN ('stage_1_2_first_input','stage_first_input') AND stage_id='stage_1_2'`, cohortRange) },
      { label: '1-2 首次伤害', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id IN ('stage_1_2_first_damage','stage_first_damage') AND stage_id='stage_1_2'`, cohortRange) },
      { label: '通关 1-2', count: await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_clear' AND stage_id='stage_1_2'`, cohortRange) },
    ]

    console.log(`事件流首日漏斗：${start} → ${end}`)
    rows.forEach(row => printMetric(row.label, row.count, total))
    printAdjacent(rows)
    printTopDrops(rows)

    console.log('\n第1章关卡进度')
    for (const stageId of chapter1StageIds()) {
      const label = stageId.replace('stage_', '').replace('_', '-')
      const started = await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_start' AND stage_id=?`, cohortRange.concat(stageId))
      const firstInput = await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND (event_id='stage_first_input' OR event_id=?) AND stage_id=?`, cohortRange.concat(`${stageId}_first_input`, stageId))
      const firstDamage = await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND (event_id='stage_first_damage' OR event_id=?) AND stage_id=?`, cohortRange.concat(`${stageId}_first_damage`, stageId))
      const cleared = await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_clear' AND stage_id=?`, cohortRange.concat(stageId))
      const failed = await countUsers(conn, `${rangeWhere} AND ${cohortWhere} AND event_id='stage_fail' AND stage_id=?`, cohortRange.concat(stageId))
      console.log(`${label.padEnd(8)} 开始 ${String(started).padStart(5)}  首操 ${String(firstInput).padStart(5)}  首伤 ${String(firstDamage).padStart(5)}  通关 ${String(cleared).padStart(5)}  失败 ${String(failed).padStart(5)}  通关率 ${pct(cleared, started)}`)
    }

    const [hourRows] = await conn.execute(`
      SELECT
        STR_TO_DATE(DATE_FORMAT(event_at, '%Y-%m-%d %H:00:00'), '%Y-%m-%d %H:%i:%s') AS bucket_hour,
        COUNT(DISTINCT CASE WHEN event_id = 'new_user_enter' THEN openid_hash END) AS new_users,
        COUNT(DISTINCT CASE WHEN event_id = 'newbie_prologue_first_input' THEN openid_hash END) AS prologue_first_input,
        COUNT(DISTINCT CASE WHEN event_id = 'stage_clear' AND stage_id = 'stage_1_1' THEN openid_hash END) AS stage_1_1_clear,
        COUNT(DISTINCT CASE WHEN event_id = 'stage_clear' AND stage_id = 'stage_1_2' THEN openid_hash END) AS stage_1_2_clear,
        COUNT(DISTINCT CASE WHEN event_id = 'stage_clear' AND stage_id = 'stage_1_3' THEN openid_hash END) AS stage_1_3_clear,
        COUNT(DISTINCT CASE WHEN event_id = 'stage_clear' AND stage_id = 'stage_1_8' THEN openid_hash END) AS stage_1_8_clear,
        COUNT(DISTINCT CASE WHEN event_id = 'platform_gift_claimed' THEN openid_hash END) AS platform_gift_claimed
      FROM analytics_events
      WHERE event_at >= ? AND event_at < ?
        AND ${cohortWhere}
      GROUP BY bucket_hour
      ORDER BY bucket_hour
    `, cohortRange)

    console.log('\n按小时分组')
    hourRows.forEach((r) => {
      const n = Number(r.new_users || 0)
      console.log(`${String(r.bucket_hour).slice(5, 16)}  新增 ${String(n).padStart(4)}`
        + `  序章操作 ${pct(Number(r.prologue_first_input || 0), n)}`
        + `  1-1通关 ${pct(Number(r.stage_1_1_clear || 0), n)}`
        + `  1-2通关 ${pct(Number(r.stage_1_2_clear || 0), n)}`
        + `  1-3通关 ${pct(Number(r.stage_1_3_clear || 0), n)}`
        + `  1-8通关 ${pct(Number(r.stage_1_8_clear || 0), n)}`
        + `  礼包 ${pct(Number(r.platform_gift_claimed || 0), n)}`)
    })
  } finally {
    await conn.end()
  }
}

main().catch((e) => {
  console.error('查询失败:', e.message || e)
  process.exit(1)
})
