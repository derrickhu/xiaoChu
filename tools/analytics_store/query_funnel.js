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
  ) AND openid_hash NOT IN (
    SELECT DISTINCT openid_hash
    FROM analytics_events
    WHERE ${rangeWhere} AND event_id='cloud_veteran_restored' AND openid_hash <> ''
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
    const cohortWhere = cohortFilter(rangeWhere)
    const cohortParams = range.concat(range)
    const cohortRange = range.concat(cohortParams)
    const total = await countUsers(conn, `${rangeWhere} AND event_id='new_user_enter' AND ${cohortWhere}`, cohortRange)
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

    const [loadingRows] = await conn.execute(`
      SELECT
        COUNT(DISTINCT CASE WHEN event_id='loading_ready' THEN openid_hash END) AS ready_users,
        COUNT(DISTINCT CASE WHEN event_id='loading_cloud_wait_timeout' THEN openid_hash END) AS cloud_wait_users,
        ROUND(AVG(CASE WHEN event_id='loading_ready' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(params_json, '$.elapsedMs')) AS UNSIGNED) END)) AS avg_elapsed_ms,
        MAX(CASE WHEN event_id='loading_ready' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(params_json, '$.elapsedMs')) AS UNSIGNED) END) AS max_elapsed_ms,
        MAX(CASE WHEN event_id='loading_ready' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(params_json, '$.criticalPreloadMs')) AS UNSIGNED) END) AS max_preload_ms,
        SUM(CASE WHEN event_id='loading_ready' THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(params_json, '$.cdnDownloadFail')) AS UNSIGNED) ELSE 0 END) AS cdn_download_fail
      FROM analytics_events
      WHERE ${rangeWhere} AND ${cohortWhere}
    `, cohortRange)
    const load = loadingRows[0] || {}
    console.log('\n加载诊断')
    console.log(`加载完成人数 ${Number(load.ready_users || 0)} / ${total}`
      + `  平均耗时 ${Number(load.avg_elapsed_ms || 0)}ms`
      + `  最大耗时 ${Number(load.max_elapsed_ms || 0)}ms`
      + `  关键资源最大 ${Number(load.max_preload_ms || 0)}ms`
      + `  云同步等待超时 ${Number(load.cloud_wait_users || 0)}`
      + `  CDN失败累计 ${Number(load.cdn_download_fail || 0)}`)

    const [deviceRows] = await conn.execute(`
      SELECT
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(params_json, '$.devicePlatform')), '') AS device_platform,
        COALESCE(JSON_UNQUOTE(JSON_EXTRACT(params_json, '$.deviceBrand')), '') AS device_brand,
        COUNT(DISTINCT openid_hash) AS users
      FROM analytics_events
      WHERE ${rangeWhere} AND ${cohortWhere} AND event_id='loading_ready'
      GROUP BY device_platform, device_brand
      ORDER BY users DESC
      LIMIT 8
    `, cohortRange)
    if (deviceRows.length) {
      console.log('设备分布')
      deviceRows.forEach(r => {
        console.log(`  ${(r.device_platform || 'unknown')}/${(r.device_brand || 'unknown')}: ${Number(r.users || 0)}`)
      })
    }

    const [prologueRows] = await conn.execute(`
      SELECT
        COUNT(DISTINCT CASE WHEN event_id='battle_first_frame' AND stage_id='newbie_prologue' THEN openid_hash END) AS first_frame_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_strong_hint_show' THEN openid_hash END) AS strong_hint_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_drag_start' THEN openid_hash END) AS drag_start_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_hold_start' THEN openid_hash END) AS hold_start_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_hold_wrong_start' THEN openid_hash END) AS hold_wrong_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_first_input' THEN openid_hash END) AS first_input_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_invalid_drag' THEN openid_hash END) AS invalid_drag_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_idle_5s' THEN openid_hash END) AS idle_5s_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_idle_10s' THEN openid_hash END) AS idle_10s_users
      FROM analytics_events
      WHERE ${rangeWhere} AND ${cohortWhere}
    `, cohortRange)
    const prologue = prologueRows[0] || {}
    const firstFrameUsers = Number(prologue.first_frame_users || 0)
    console.log('\n序章交互诊断')
    printMetric('强引导曝光', Number(prologue.strong_hint_users || 0), firstFrameUsers)
    printMetric('有效按住灵珠', Number(prologue.drag_start_users || 0), firstFrameUsers)
    printMetric('按住指定起点', Number(prologue.hold_start_users || 0), firstFrameUsers)
    printMetric('按住其它灵珠', Number(prologue.hold_wrong_users || 0), firstFrameUsers)
    printMetric('完成首次拖动', Number(prologue.first_input_users || 0), firstFrameUsers)
    printMetric('无效首次拖动', Number(prologue.invalid_drag_users || 0), Number(prologue.first_input_users || 0))
    printMetric('5秒未操作', Number(prologue.idle_5s_users || 0), firstFrameUsers)
    printMetric('10秒未操作', Number(prologue.idle_10s_users || 0), firstFrameUsers)

    const [ctaRows] = await conn.execute(`
      SELECT
        COUNT(DISTINCT CASE WHEN event_id='newbie_prologue_clear' THEN openid_hash END) AS prologue_clear_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_stage_cta_click' THEN openid_hash END) AS prologue_cta_users,
        COUNT(DISTINCT CASE WHEN event_id='newbie_stage_auto_start' THEN openid_hash END) AS prologue_auto_users,
        COUNT(DISTINCT CASE WHEN event_id='stage_clear' AND stage_id='stage_1_1' THEN openid_hash END) AS stage_1_1_clear_users,
        COUNT(DISTINCT CASE WHEN event_id='stage_1_1_next_click' THEN openid_hash END) AS stage_1_1_next_users
      FROM analytics_events
      WHERE ${rangeWhere} AND ${cohortWhere}
    `, cohortRange)
    const cta = ctaRows[0] || {}
    console.log('\n后续 CTA 诊断')
    printMetric('序章点击继续', Number(cta.prologue_cta_users || 0), Number(cta.prologue_clear_users || 0))
    printMetric('序章自动进入', Number(cta.prologue_auto_users || 0), Number(cta.prologue_clear_users || 0))
    printMetric('1-1点击下一关', Number(cta.stage_1_1_next_users || 0), Number(cta.stage_1_1_clear_users || 0))

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
