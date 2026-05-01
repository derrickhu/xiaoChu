#!/usr/bin/env node
'use strict'

/**
 * 每日新增用户首日漏斗分析
 *
 * 用法：
 *   node scripts/analyze_daily_funnel.js 2026-04-30 2026-05-01
 *   node scripts/analyze_daily_funnel.js 2026-05-01 2026-05-02 --since "2026-05-01 12:30"
 *   node scripts/analyze_daily_funnel.js   # 默认取 tools/backup/data 下最近两天
 */

const fs = require('fs')
const path = require('path')

const BACKUP_ROOT = path.join(__dirname, '..', 'tools', 'backup', 'data')

function pct(n, d) {
  if (!d) return '0.0%'
  return (n / d * 100).toFixed(1) + '%'
}

function loadPlayers(date) {
  const file = path.join(BACKUP_ROOT, date, 'playerData.json')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function latestTwoDates() {
  const dirs = fs.readdirSync(BACKUP_ROOT)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .filter(d => fs.existsSync(path.join(BACKUP_ROOT, d, 'playerData.json')))
    .sort()
  if (dirs.length < 2) throw new Error('至少需要两天 playerData.json 备份')
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

function sumSlotMaps(players, getter) {
  const out = {}
  players.forEach((p) => {
    const map = getter(p)
    Object.keys(map).forEach((k) => { out[k] = (out[k] || 0) + (map[k] || 0) })
  })
  return out
}

function printMetric(label, n, d) {
  console.log(`${label.padEnd(18)} ${String(n).padStart(5)} / ${String(d).padStart(5)}  ${pct(n, d)}`)
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

  printMetric('通关 1-1', added.filter(p => isCleared(p, 'stage_1_1')).length, total)
  printMetric('通关 1-2', added.filter(p => isCleared(p, 'stage_1_2')).length, total)
  printMetric('通关 1-3', added.filter(p => isCleared(p, 'stage_1_3')).length, total)
  printMetric('通关 1-8', added.filter(p => isCleared(p, 'stage_1_8')).length, total)
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
