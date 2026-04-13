/**
 * 每日数据库备份 — 导出全集合到按日期命名的目录
 *
 * 目录结构: tools/backup/data/2026-04-13/playerData.json ...
 * 自动清理 7 天前的备份
 *
 * 用法:
 *   node daily.js           # 手动运行
 *   配合 crontab 每天凌晨自动执行（见 install_cron.sh）
 */
'use strict'
const fs = require('fs')
const path = require('path')
const { exportAll } = require('../lib/wxCloudExport')

const BACKUP_ROOT = path.join(__dirname, 'data')
const KEEP_DAYS = 7

/** 获取今天的日期字符串 YYYY-MM-DD */
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 清理超过 KEEP_DAYS 天的备份目录 */
function cleanOldBackups() {
  if (!fs.existsSync(BACKUP_ROOT)) return
  const cutoff = Date.now() - KEEP_DAYS * 24 * 3600 * 1000
  const dirs = fs.readdirSync(BACKUP_ROOT).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()

  for (const dir of dirs) {
    const dirDate = new Date(dir + 'T00:00:00').getTime()
    if (isNaN(dirDate) || dirDate >= cutoff) continue

    const fullPath = path.join(BACKUP_ROOT, dir)
    try {
      fs.rmSync(fullPath, { recursive: true, force: true })
      console.log(`  🗑 已清理过期备份: ${dir}`)
    } catch (e) {
      console.warn(`  ⚠ 清理失败 ${dir}: ${e.message}`)
    }
  }
}

async function main() {
  const date = todayStr()
  const outDir = path.join(BACKUP_ROOT, date)

  console.log(`\n📦 灵宠消消塔 — 每日数据库备份`)
  console.log(`   日期: ${date}`)
  console.log(`   目录: ${outDir}`)
  console.log(`   保留: 最近 ${KEEP_DAYS} 天`)
  console.log('')

  // 如果今天已经备份过，跳过
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length > 0) {
    console.log(`⏭ 今日已备份，跳过 (${outDir})`)
    console.log('')
    cleanOldBackups()
    return
  }

  console.log('===== 开始导出 =====')
  const results = await exportAll(outDir)
  console.log('')

  // 同时更新 analysis/data/ 的最新副本（供分析脚本直接用）
  const analysisDir = path.join(__dirname, '..', 'analysis', 'data')
  fs.mkdirSync(analysisDir, { recursive: true })
  for (const r of results) {
    if (r.count >= 0 && r.file) {
      const dest = path.join(analysisDir, path.basename(r.file))
      fs.copyFileSync(r.file, dest)
    }
  }
  console.log(`✓ 已同步最新数据到 analysis/data/`)
  console.log('')

  // 清理旧备份
  cleanOldBackups()

  // 汇总
  const total = results.reduce((s, r) => s + (r.count > 0 ? r.count : 0), 0)
  const failed = results.filter(r => r.count < 0)
  console.log('===== 备份完成 =====')
  console.log(`  集合: ${results.length} 个, 总记录: ${total} 条`)
  if (failed.length) console.log(`  ⚠ 失败: ${failed.map(r => r.name).join(', ')}`)
  console.log(`  目录: ${outDir}`)

  // 列出所有备份
  if (fs.existsSync(BACKUP_ROOT)) {
    const allDirs = fs.readdirSync(BACKUP_ROOT).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
    console.log(`  存档: ${allDirs.join(', ')} (共 ${allDirs.length} 天)`)
  }
  console.log('')
}

main().catch(e => {
  console.error('❌ 备份失败:', e)
  process.exit(1)
})
