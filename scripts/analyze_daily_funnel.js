#!/usr/bin/env node
'use strict'

/**
 * 每日新增用户首日漏斗分析
 *
 * 用法：
 *   node scripts/analyze_daily_funnel.js 2026-04-30 2026-05-01
 *   node scripts/analyze_daily_funnel.js 2026-04-30 2026-05-01 --since "2026-05-01 12:30"
 *   （次日目录须已有 tools/backup/data/YYYY-MM-DD/playerData.json，否则改用已有最后一天）
 *   node scripts/analyze_daily_funnel.js   # 默认取 tools/backup/data 下最近两天
 */

const fs = require('fs')
const path = require('path')

const BACKUP_ROOT = path.join(__dirname, '..', 'tools', 'backup', 'data')

function pct(n, d) {
  if (!d) return '0.0%'
  return (n / d * 100).toFixed(1) + '%'
}

/** @returns {string[]} YYYY-MM-DD，含 playerData.json 的目录名，升序 */
function listBackupDatesWithPlayerData() {
  if (!fs.existsSync(BACKUP_ROOT)) return []
  try {
    return fs.readdirSync(BACKUP_ROOT)
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .filter(d => fs.existsSync(path.join(BACKUP_ROOT, d, 'playerData.json')))
      .sort()
  } catch {
    return []
  }
}

function formatBackupHint() {
  const dates = listBackupDatesWithPlayerData()
  if (!dates.length) {
    return `\n目录下暂无 playerData.json：${BACKUP_ROOT}\n请确认定时备份已运行并成功写入。`
  }
  const tail = dates.slice(-8)
  const sample = tail.join(', ')
  const ellip = dates.length > tail.length ? '… ' : ''
  let cmd = ''
  if (dates.length >= 2) {
    const a = dates[dates.length - 2]
    const b = dates[dates.length - 1]
    cmd = `\n可用最近两天对比：node scripts/analyze_daily_funnel.js ${a} ${b}`
  }
  return `\n已有备份日期（${dates.length} 天）：${ellip}${sample}${cmd}`
}

function loadPlayers(date) {
  const file = path.join(BACKUP_ROOT, date, 'playerData.json')
  if (!fs.existsSync(file)) {
    throw new Error(`找不到备份文件：${file}${formatBackupHint()}`)
  }
  const raw = fs.readFileSync(file, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`解析失败（非合法 JSON）：${file}\n${e && e.message}`)
  }
}

function latestTwoDates() {
  const dirs = listBackupDatesWithPlayerData()
  if (dirs.length < 2) {
    if (!dirs.length) {
      throw new Error(`未找到任何 playerData.json：${BACKUP_ROOT}${formatBackupHint()}`)
    }
    throw new Error(`仅找到 1 天备份（${dirs[0]}），至少需要两天才能对比新增。${formatBackupHint()}`)
  }
  return dirs.slice(-2)
}

function parseArgs(argv) {
  const positional = []
  const opts = { sinceMs: 0, sinceText: '' }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--since') {
      const value = argv[++i]
      if (!value) throw new Error('--since 需要时间参数，例如 "2026-05-01 12:30"')
      const ms = parseLocalTime(value)
      if (!ms) throw new Error(`无法解析 --since 时间：${value}`)
      opts.sinceMs = ms
      opts.sinceText = value
    } else {
      positional.push(arg)
    }
  }
  const dates = positional.length >= 2 ? positional.slice(0, 2) : latestTwoDates()
  return { prevDate: dates[0], currDate: dates[1], opts }
}

function parseLocalTime(text) {
  if (!text) return 0
  const normalized = String(text).trim().replace(' ', 'T')
  const ms = new Date(normalized).getTime()
  return Number.isFinite(ms) ? ms : 0
}

function playerKey(p) {
  return p && (p._openid || p.openid || p._id)
}

function firstSeenOrUpdateTime(p) {
  const s = p.analyticsSummary || {}
  return s.firstSeenAt || p._updateTime || p.updatedAt || p.createdAt || 0
}

function isCleared(p, stageId) {
  const rec = p.stageClearRecord || {}
  return !!(rec[stageId] && rec[stageId].cleared)
}

function clearedCount(p) {
  const rec = p.stageClearRecord || {}
  return Object.keys(rec).filter(k => rec[k] && rec[k].cleared).length
}

function adWatchCounts(p) {
  const out = {}
  const log = p.adWatchLog || {}
  Object.keys(log).forEach((slotId) => {
    const v = log[slotId]
    out[slotId] = v && typeof v === 'object' ? (v.count || 0) : (v || 0)
  })
  return out
}

function totalMapValue(map) {
  return Object.keys(map || {}).reduce((s, k) => s + (map[k] || 0), 0)
}

function summaryBucket(p, name) {
  const s = p.analyticsSummary || {}
  const first = s.firstSession || {}
  return first[name] || {}
}

function hasSummaryEvent(p, eventId) {
  return (summaryBucket(p, 'events')[eventId] || 0) > 0
}

function hasAnySummaryEvent(p, eventIds) {
  return eventIds.some(id => hasSummaryEvent(p, id))
}

function hasBucketKey(p, bucketName, key) {
  return (summaryBucket(p, bucketName)[key] || 0) > 0
}

function sumSlotMaps(players, getter) {
  const out = {}
  players.forEach((p) => {
    const map = getter(p)
    Object.keys(map).forEach((k) => { out[k] = (out[k] || 0) + (map[k] || 0) })
  })
  return out
}

function platformGiftSummary(p) {
  return (p && p.platformGiftSummary) || {}
}

function hasPlatformGift(p) {
  return (platformGiftSummary(p).totalClaims || 0) > 0
}

function platformGiftRewards(p) {
  return platformGiftSummary(p).rewards || {}
}

function platformGiftTypes(p) {
  return platformGiftSummary(p).giftTypes || {}
}

function sumNestedNumber(players, getter, key) {
  return players.reduce((sum, p) => sum + ((getter(p) || {})[key] || 0), 0)
}

function printMetric(label, n, d) {
  console.log(`${label.padEnd(18)} ${String(n).padStart(5)} / ${String(d).padStart(5)}  ${pct(n, d)}`)
}

function printNoDataMetric(label, note) {
  console.log(`${label.padEnd(18)} ${String('-').padStart(5)} / ${String('-').padStart(5)}  ${note || '暂无新埋点'}`)
}

function printMap(title, map) {
  console.log(`\n${title}`)
  const rows = Object.entries(map || {}).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  if (!rows.length) {
    console.log('  无')
    return
  }
  rows.forEach(([k, v]) => console.log(`  ${k}: ${v}`))
}

function countWhere(players, fn) {
  return players.filter(fn).length
}

function printBreakpoints(players, total) {
  const introFinished = p => hasAnySummaryEvent(p, ['intro_finish', 'intro_done', 'first_screen_show'])
  const prologueStarted = p => hasBucketKey(p, 'stageStart', 'newbie_prologue')
  const stage11Started = p => hasBucketKey(p, 'stageStart', 'stage_1_1')
  const stage12Started = p => hasBucketKey(p, 'stageStart', 'stage_1_2')
  const hasBattleFirstFrameData = players.some(p => hasSummaryEvent(p, 'battle_first_frame'))
  console.log('\n关键断点拆解')
  printMetric('仅进入未加载完成', countWhere(players, p => hasSummaryEvent(p, 'new_user_enter') && !hasSummaryEvent(p, 'loading_ready') && !introFinished(p)), total)
  printMetric('加载后未见剧情', countWhere(players, p => hasSummaryEvent(p, 'loading_ready') && !hasSummaryEvent(p, 'intro_show') && !introFinished(p) && !prologueStarted(p)), total)
  printMetric('剧情展示未完成', countWhere(players, p => hasSummaryEvent(p, 'intro_show') && !introFinished(p)), total)
  printMetric('剧情完成未进序章', countWhere(players, p => introFinished(p) && !prologueStarted(p)), total)
  if (hasBattleFirstFrameData) {
    printMetric('序章开始未首帧', countWhere(players, p => prologueStarted(p) && !hasSummaryEvent(p, 'battle_first_frame')), total)
  }
  printMetric('序章通关未进 1-1', countWhere(players, p => hasSummaryEvent(p, 'newbie_prologue_clear') && !stage11Started(p)), total)
  printMetric('点击 1-1 未开始', countWhere(players, p => hasSummaryEvent(p, 'newbie_stage_cta_click') && !stage11Started(p)), total)
  printMetric('1-1 通关未进 1-2', countWhere(players, p => hasBucketKey(p, 'stageClear', 'stage_1_1') && !stage12Started(p)), total)
}

function printAdjacentConversions(rows) {
  console.log('\n相邻步骤转化')
  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1]
    const curr = rows[i]
    if (prev.unavailable || curr.unavailable) continue
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
    if (prev.unavailable || curr.unavailable) continue
    drops.push({
      from: prev.label,
      to: curr.label,
      fromCount: prev.count,
      toCount: curr.count,
      drop: Math.max(0, prev.count - curr.count),
      rate: prev.count ? curr.count / prev.count : 0,
    })
  }
  console.log('\nTop 掉点')
  drops
    .filter(item => item.drop > 0)
    .sort((a, b) => b.drop - a.drop)
    .slice(0, 8)
    .forEach((item, idx) => {
      console.log(`${idx + 1}. ${item.from} → ${item.to}: 流失 ${item.drop}，转化 ${pct(item.toCount, item.fromCount)}`)
    })
}

function hourKey(ms) {
  if (!ms) return '未知'
  const d = new Date(ms)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  return `${m}-${day} ${h}:00`
}

function printHourlyCohorts(players) {
  const groups = {}
  players.forEach((p) => {
    const key = hourKey(firstSeenOrUpdateTime(p))
    if (!groups[key]) groups[key] = []
    groups[key].push(p)
  })
  console.log('\n按小时分组（用于观察上线前后）')
  Object.keys(groups).sort().forEach((key) => {
    const ps = groups[key]
    const total = ps.length
    const prologueInput = countWhere(ps, p => hasSummaryEvent(p, 'newbie_prologue_first_input'))
    const stage11Clear = countWhere(ps, p => hasBucketKey(p, 'stageClear', 'stage_1_1'))
    const stage12Clear = countWhere(ps, p => isCleared(p, 'stage_1_2'))
    console.log(`${key}  新增 ${String(total).padStart(4)}  序章操作 ${pct(prologueInput, total)}  1-1通关 ${pct(stage11Clear, total)}  1-2通关 ${pct(stage12Clear, total)}`)
  })
}

function printPlatformGiftAnalysis(players, total) {
  const claimed = players.filter(hasPlatformGift)
  const notClaimed = players.filter(p => !hasPlatformGift(p))
  console.log('\n微信平台礼包')
  printMetric('礼包领取人数', claimed.length, total)
  printMetric('礼包领取后通关1-2', claimed.filter(p => isCleared(p, 'stage_1_2')).length, claimed.length)
  printMetric('未领礼包通关1-2', notClaimed.filter(p => isCleared(p, 'stage_1_2')).length, notClaimed.length)
  printMetric('礼包领取后通关1-3', claimed.filter(p => isCleared(p, 'stage_1_3')).length, claimed.length)
  printMetric('未领礼包通关1-3', notClaimed.filter(p => isCleared(p, 'stage_1_3')).length, notClaimed.length)
  console.log(`万能碎片发放总量      ${sumNestedNumber(players, platformGiftRewards, 'universalFragment')}`)
  printMap('礼包类型分布（giftTypeId）', sumSlotMaps(players, platformGiftTypes))
  printMap('礼包奖励分布', sumSlotMaps(players, platformGiftRewards))
}

function main() {
  const { prevDate, currDate, opts } = parseArgs(process.argv.slice(2))
  const prev = new Map(loadPlayers(prevDate).map(p => [playerKey(p), p]).filter(([k]) => k))
  const curr = loadPlayers(currDate)
  const rawAdded = curr.filter(p => {
    const k = playerKey(p)
    return k && !prev.has(k)
  })
  const added = opts.sinceMs
    ? rawAdded.filter(p => firstSeenOrUpdateTime(p) >= opts.sinceMs)
    : rawAdded
  const total = added.length

  console.log(`新增用户首日漏斗：${prevDate} → ${currDate}`)
  if (opts.sinceMs) console.log(`过滤时间：>= ${opts.sinceText}`)
  console.log(`前日存档：${prev.size}`)
  console.log(`当日存档：${curr.length}`)
  console.log(`新增云存档：${rawAdded.length}`)
  if (opts.sinceMs) console.log(`过滤后新增：${total}`)
  console.log('')

  console.log('新埋点首日行为漏斗')
  const hasStage12DetailData = added.some(p => hasSummaryEvent(p, 'stage_1_2_first_input') || hasSummaryEvent(p, 'stage_1_2_first_damage'))
  const funnelRows = [
    { label: '新用户进入', count: added.filter(p => hasSummaryEvent(p, 'new_user_enter')).length },
    { label: '加载完成', count: added.filter(p => hasSummaryEvent(p, 'loading_ready')).length },
    { label: '开场剧情展示', count: added.filter(p => hasSummaryEvent(p, 'intro_show')).length },
    { label: '开场剧情完成', count: added.filter(p => hasAnySummaryEvent(p, ['intro_finish', 'intro_done', 'first_screen_show'])).length },
    { label: '开始序章', count: added.filter(p => hasBucketKey(p, 'stageStart', 'newbie_prologue')).length },
    { label: '战斗首帧', count: added.filter(p => hasSummaryEvent(p, 'battle_first_frame')).length },
    { label: '序章首次操作', count: added.filter(p => hasSummaryEvent(p, 'newbie_prologue_first_input')).length },
    { label: '序章首次伤害', count: added.filter(p => hasSummaryEvent(p, 'newbie_prologue_first_damage')).length },
    { label: '序章通关', count: added.filter(p => hasSummaryEvent(p, 'newbie_prologue_clear')).length },
    { label: '开始 1-1', count: added.filter(p => hasBucketKey(p, 'stageStart', 'stage_1_1')).length },
    { label: '1-1 首次操作', count: added.filter(p => hasSummaryEvent(p, 'stage_1_1_first_input')).length },
    { label: '1-1 首次伤害', count: added.filter(p => hasSummaryEvent(p, 'stage_1_1_first_damage')).length },
    { label: '通关 1-1', count: added.filter(p => hasBucketKey(p, 'stageClear', 'stage_1_1')).length },
    { label: '开始 1-2', count: added.filter(p => hasBucketKey(p, 'stageStart', 'stage_1_2')).length },
    { label: '1-2 首次操作', count: added.filter(p => hasSummaryEvent(p, 'stage_1_2_first_input')).length, unavailable: !hasStage12DetailData },
    { label: '1-2 首次伤害', count: added.filter(p => hasSummaryEvent(p, 'stage_1_2_first_damage')).length, unavailable: !hasStage12DetailData },
    { label: '通关 1-2', count: added.filter(p => hasBucketKey(p, 'stageClear', 'stage_1_2')).length },
  ]
  printMetric('新用户进入', funnelRows[0].count, total)
  printMetric('加载完成', funnelRows[1].count, total)
  printMetric('开场剧情展示', funnelRows[2].count, total)
  printMetric('剧情继续点击', added.filter(p => hasSummaryEvent(p, 'intro_next_click')).length, total)
  printMetric('剧情跳过点击', added.filter(p => hasSummaryEvent(p, 'intro_skip_click')).length, total)
  printMetric('开场剧情完成', funnelRows[3].count, total)
  printMetric('完成引导', added.filter(p => hasSummaryEvent(p, 'intro_done')).length, total)
  printMetric('看到序章入口', added.filter(p => hasSummaryEvent(p, 'newbie_prologue_prompt_show')).length, total)
  printMetric('开始序章', funnelRows[4].count, total)
  printMetric('战斗首帧', funnelRows[5].count, total)
  printMetric('序章首次操作', funnelRows[6].count, total)
  printMetric('序章首次伤害', funnelRows[7].count, total)
  printMetric('序章通关', funnelRows[8].count, total)
  printMetric('序章结算展示', added.filter(p => hasSummaryEvent(p, 'newbie_prologue_result_show')).length, total)
  printMetric('看到 1-1 引导', added.filter(p => hasSummaryEvent(p, 'newbie_stage_prompt_show')).length, total)
  printMetric('点击进入 1-1', added.filter(p => hasSummaryEvent(p, 'newbie_stage_cta_click')).length, total)
  printMetric('开始 1-1', funnelRows[9].count, total)
  printMetric('1-1 首次操作', funnelRows[10].count, total)
  printMetric('1-1 首次伤害', funnelRows[11].count, total)
  printMetric('新埋点通关 1-1', funnelRows[12].count, total)
  printMetric('1-1 结算展示', added.filter(p => hasSummaryEvent(p, 'stage_1_1_result_show')).length, total)
  printMetric('新手翻倍广告触达', added.filter(p => hasBucketKey(p, 'adEntryShow', 'newbieFirstClearDouble')).length, total)
  printMetric('开始 1-2', funnelRows[13].count, total)
  if (hasStage12DetailData) {
    printMetric('1-2 首次操作', funnelRows[14].count, total)
    printMetric('1-2 首次伤害', funnelRows[15].count, total)
  } else {
    printNoDataMetric('1-2 首次操作', '暂无新埋点')
    printNoDataMetric('1-2 首次伤害', '暂无新埋点')
  }
  printMetric('新埋点通关 1-2', funnelRows[16].count, total)
  printMetric('1-2 失败', added.filter(p => hasBucketKey(p, 'stageFail', 'stage_1_2')).length, total)
  console.log('')
  printAdjacentConversions(funnelRows)
  printTopDrops(funnelRows)
  printHourlyCohorts(added)
  printPlatformGiftAnalysis(added, total)
  printBreakpoints(added, total)
  console.log('')

  console.log('存档进度漏斗（兼容老版本）')
  printMetric('通关 1-1', added.filter(p => isCleared(p, 'stage_1_1')).length, total)
  printMetric('通关 1-2', added.filter(p => isCleared(p, 'stage_1_2')).length, total)
  printMetric('通关 1-3', added.filter(p => isCleared(p, 'stage_1_3')).length, total)
  printMetric('通关 1-8', added.filter(p => isCleared(p, 'stage_1_8')).length, total)
  console.log('')

  console.log('广告漏斗')
  printMetric('广告入口触达', added.filter(p => totalMapValue(summaryBucket(p, 'adEntryShow')) > 0).length, total)
  printMetric('广告点击', added.filter(p => totalMapValue(summaryBucket(p, 'adClick')) > 0).length, total)
  printMetric('广告完播', added.filter(p => totalMapValue(summaryBucket(p, 'adComplete')) > 0 || totalMapValue(adWatchCounts(p)) > 0).length, total)

  const stageBuckets = {
    '0关': added.filter(p => clearedCount(p) === 0).length,
    '1关': added.filter(p => clearedCount(p) === 1).length,
    '2关': added.filter(p => clearedCount(p) === 2).length,
    '3关': added.filter(p => clearedCount(p) === 3).length,
    '4-7关': added.filter(p => clearedCount(p) >= 4 && clearedCount(p) <= 7).length,
    '第1章通': added.filter(p => clearedCount(p) >= 8 && clearedCount(p) <= 15).length,
    '第2章+': added.filter(p => clearedCount(p) >= 16).length,
  }
  printMap('关卡进度分布', stageBuckets)
  printMap('广告入口展示（analyticsSummary）', sumSlotMaps(added, p => summaryBucket(p, 'adEntryShow')))
  printMap('广告点击（analyticsSummary）', sumSlotMaps(added, p => summaryBucket(p, 'adClick')))
  printMap('广告完播（analyticsSummary）', sumSlotMaps(added, p => summaryBucket(p, 'adComplete')))
  printMap('广告完播（adWatchLog 兼容）', sumSlotMaps(added, adWatchCounts))
}

main()
