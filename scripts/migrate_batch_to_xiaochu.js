#!/usr/bin/env node
'use strict'

/**
 * 批量微信数据迁移到 xiaochu-api（基于本地备份目录）
 *
 * 数据来源：tools/backup/data/<日期>/ （由 tools/backup/daily.js 产出）
 * 不再实时从微信云开发 API 拉数据；如需刷新，先运行 `node tools/backup/daily.js --force`。
 *
 * 用法：
 *   node scripts/migrate_batch_to_xiaochu.js --src-dir=tools/backup/data/2026-05-25 --dry-run
 *   XIAOCHU_ADMIN_KEY=xxx node scripts/migrate_batch_to_xiaochu.js --src-dir=tools/backup/data/2026-05-25
 *
 * 可选参数：
 *   --src-dir=<path>     备份目录，默认取 tools/backup/data/ 下最新一天
 *   --dry-run            只导出和转换，不写入
 *   --api-base=<url>     覆盖默认 API base
 *   --collections=a,b    只迁移指定集合（逗号分隔），用于失败后定向补迁
 *
 * 环境变量：
 *   XIAOCHU_ADMIN_KEY            正式导入时必填
 *   MIGRATE_BATCH_SIZE=50        每批最多 N 条
 *   MIGRATE_MAX_BATCH_BYTES=204800   每批最大字节数（默认 200KB）
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const BACKUP_ROOT = path.join(PROJECT_ROOT, 'tools', 'backup', 'data')

const ARGS = parseArgs(process.argv.slice(2))
const SRC_DIR = ARGS['src-dir'] ? path.resolve(ARGS['src-dir']) : pickLatestBackupDir()
const DRY_RUN = !!ARGS['dry-run']
const API_BASE = (ARGS['api-base'] || process.env.XIAOCHU_API_BASE_URL || 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com').replace(/\/$/, '')
const API_PREFIX = '/xiaochu-api'
const ADMIN_KEY = process.env.XIAOCHU_ADMIN_KEY || ''
const ADMIN_HEADER = 'x-xiaochu-admin-key'
const BATCH_SIZE = Number(process.env.MIGRATE_BATCH_SIZE || 50)
const MAX_BATCH_BYTES = Number(process.env.MIGRATE_MAX_BATCH_BYTES || 200 * 1024)

const RUN_ID = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const OUT_DIR = path.join(PROJECT_ROOT, 'tools', 'migration', 'data', RUN_ID)

// 旧微信集合 → 新 xiaochu_* 集合后缀
const ALL_SOURCE_COLLECTIONS = ['playerData', 'rankAll', 'rankAllWeekly', 'rankStage', 'rankDex', 'rankCombo', 'weeklyReward', 'pendingGifts', 'inviteRecords']
const SOURCE_COLLECTIONS = ARGS.collections
  ? String(ARGS.collections).split(',').map(s => s.trim()).filter(Boolean)
  : ALL_SOURCE_COLLECTIONS

async function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`源目录不存在: ${SRC_DIR}`)
    console.error(`请先运行 'node tools/backup/daily.js' 生成本地备份，或用 --src-dir=<path> 指定`)
    process.exit(1)
  }
  fs.mkdirSync(OUT_DIR, { recursive: true })

  console.log('=== 批量迁移微信旧数据 → xiaochu-api ===')
  console.log('模式:', DRY_RUN ? 'dry-run（不写入）' : '正式导入')
  console.log('源目录:', SRC_DIR)
  console.log('转换输出:', OUT_DIR)
  console.log('API:', API_BASE + API_PREFIX)
  console.log('')

  const converted = {}
  const report = { runId: RUN_ID, dryRun: DRY_RUN, source: SRC_DIR, targets: {} }

  for (const sourceName of SOURCE_COLLECTIONS) {
    const file = path.join(SRC_DIR, `${sourceName}.json`)
    const rows = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf-8')) : []
    const rawConverted = convertCollection(sourceName, rows)
    const dedupe = dedupeCollection(sourceName, rawConverted)
    converted[sourceName] = dedupe.docs
    report.targets[sourceName] = { sourceCount: rows.length, convertedCount: converted[sourceName].length, duplicateCount: dedupe.duplicateCount }
    const outFile = path.join(OUT_DIR, `${sourceName}.converted.json`)
    fs.writeFileSync(outFile, JSON.stringify(converted[sourceName], null, 2), 'utf-8')
    console.log(`  转换 ${sourceName}: ${rows.length} → ${converted[sourceName].length}`)
  }

  if (!DRY_RUN) {
    if (!ADMIN_KEY) throw new Error('缺少 XIAOCHU_ADMIN_KEY')
    console.log('\n初始化目标集合...')
    const init = await postJson('/admin/initCollections', {})
    const initData = init.data || init
    console.log(`  created=${(initData.created || []).length} existed=${(initData.existed || []).length} errors=${(initData.errors || []).length}`)

    for (const sourceName of SOURCE_COLLECTIONS) {
      const docs = converted[sourceName]
      if (!docs.length) continue
      console.log(`\n导入 ${sourceName} → xiaochu_${sourceName}: ${docs.length} 条`)
      const stats = await importInChunks(sourceName, docs)
      report.targets[sourceName].inserted = stats.inserted
      report.targets[sourceName].updated = stats.updated
      report.targets[sourceName].skipped = stats.skipped
      report.targets[sourceName].failed = stats.failed
    }
  }

  const reportFile = path.join(OUT_DIR, 'migration-report.json')
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8')
  console.log('\n迁移报告:', reportFile)
  console.log('=== 完成 ===')
}

async function importInChunks(sourceName, docs) {
  let inserted = 0, updated = 0, skipped = 0, failed = 0
  let i = 0
  while (i < docs.length) {
    const batch = []
    let bytes = 200
    let lastEnd = i
    for (let j = i; j < docs.length; j++) {
      const doc = docs[j]
      const docBytes = Buffer.byteLength(JSON.stringify(doc))
      if (batch.length > 0 && (bytes + docBytes > MAX_BATCH_BYTES || batch.length >= BATCH_SIZE)) break
      batch.push(doc)
      bytes += docBytes
      lastEnd = j + 1
    }
    if (batch.length === 0) {
      batch.push(docs[i])
      lastEnd = i + 1
    }
    try {
      const res = await postJson('/admin/importBatch', { collection: sourceName, docs: batch })
      const data = res.data || res
      inserted += data.inserted || 0
      updated += data.updated || 0
      skipped += data.skipped || 0
    } catch (error) {
      failed += batch.length
      console.warn(`\n  ⚠ 批次 ${i}-${lastEnd} 失败: ${error.message}`)
    }
    i = lastEnd
    process.stdout.write(`\r  ${i}/${docs.length} inserted=${inserted} updated=${updated} skipped=${skipped} failed=${failed}`)
  }
  console.log('')
  return { inserted, updated, skipped, failed }
}

function convertCollection(name, rows) {
  if (!Array.isArray(rows)) return []
  if (name === 'playerData') return rows.map(convertPlayer).filter(Boolean)
  if (name === 'pendingGifts') return rows.map(convertPendingGift).filter(Boolean)
  if (name === 'inviteRecords') return rows.map(convertInvite).filter(Boolean)
  if (name === 'weeklyReward') return rows.map(convertWeeklyReward).filter(Boolean)
  return rows.map(convertRank).filter(Boolean)
}

function dedupeCollection(name, docs) {
  const map = new Map()
  let duplicateCount = 0
  for (const doc of docs) {
    const key = uniqueKeyFor(name, doc)
    if (!key) continue
    if (map.has(key)) {
      duplicateCount++
      const old = map.get(key)
      if (sortTimeOf(doc) >= sortTimeOf(old)) map.set(key, doc)
    } else {
      map.set(key, doc)
    }
  }
  return { docs: Array.from(map.values()), duplicateCount }
}

function uniqueKeyFor(name, doc) {
  if (!doc) return ''
  if (name === 'playerData') return doc.userId || doc.uid || ''
  if (name === 'rankAllWeekly' || name === 'weeklyReward') return `${doc.uid || doc.userId || ''}|${doc.periodKey || ''}`
  if (name === 'pendingGifts') return doc.orderId || ''
  if (name === 'inviteRecords') return doc.newUser || ''
  return doc.uid || doc.userId || ''
}

function sortTimeOf(doc) {
  return toMillis(doc.updatedAt || doc.timestamp || doc.createdAt || doc.lastWriteAt || doc.migratedAt) || 0
}

function convertPlayer(row) {
  const openId = extractOpenId(row)
  if (!openId) return null
  const payload = { ...row }
  ;['_id', '_openid', 'openid', 'openId', 'userId', 'uid', 'platform', 'payload', 'createdAt', 'updatedAt', 'lastWriteAt', 'schemaVersion'].forEach((k) => delete payload[k])
  const updatedAt = toMillis(row._updateTime || row.updatedAt || row.timestamp || row.lastWriteAt) || Date.now()
  return {
    userId: `wx:${openId}`,
    uid: `wx:${openId}`,
    openId,
    platform: 'wx',
    schemaVersion: Number(row._version || row.dataVersion || 1) || 1,
    updatedAt,
    baseRemoteUpdatedAt: updatedAt,
    payload,
    payloadKeys: Object.keys(payload),
    lastWriteAt: Date.now(),
    migratedFrom: 'wechat-cloud1',
    migratedAt: Date.now(),
  }
}

function convertRank(row) {
  const openId = extractOpenId(row)
  if (!openId) return null
  const out = { ...row }
  delete out._id
  delete out._openid
  out.uid = `wx:${openId}`
  out.userId = `wx:${openId}`
  out.openId = openId
  out.platform = 'wx'
  out.timestamp = toMillis(out.timestamp) || Date.now()
  out.migratedFrom = 'wechat-cloud1'
  out.migratedAt = Date.now()
  return out
}

function convertWeeklyReward(row) {
  const out = convertRank(row)
  if (!out || !out.periodKey) return null
  out.claimedAt = toMillis(out.claimedAt) || Date.now()
  return out
}

function convertPendingGift(row) {
  const openId = row.openId || row.openid || row._openid || row.ToUserOpenid
  if (!openId || !row.orderId) return null
  const out = { ...row }
  delete out._id
  delete out._openid
  out.openId = openId
  out.openid = openId
  out.userId = `wx:${openId}`
  out.platform = 'wx'
  out.status = out.status || 'pending'
  out.createdAt = toMillis(out.createdAt) || Date.now()
  if (out.grantedAt) out.grantedAt = toMillis(out.grantedAt)
  if (out.expireAt) out.expireAt = toMillis(out.expireAt)
  out.migratedFrom = 'wechat-cloud1'
  out.migratedAt = Date.now()
  return out
}

function convertInvite(row) {
  const inviter = normalizeWxUser(row.inviter)
  const newUser = normalizeWxUser(row.newUser)
  if (!inviter || !newUser) return null
  const out = { ...row }
  delete out._id
  delete out._openid
  out.inviter = inviter
  out.newUser = newUser
  out.inviterOpenId = stripWx(inviter)
  out.newUserOpenId = stripWx(newUser)
  out.platform = 'wx'
  out.granted = !!out.granted
  out.createdAt = toMillis(out.createdAt) || Date.now()
  if (out.grantedAt) out.grantedAt = toMillis(out.grantedAt)
  out.migratedFrom = 'wechat-cloud1'
  out.migratedAt = Date.now()
  return out
}

function extractOpenId(row) {
  const raw = row && (row._openid || row.openid || row.openId || row.uid || row.userId)
  return String(raw || '').replace(/^wx:/, '')
}

function normalizeWxUser(value) {
  if (!value) return ''
  const raw = String(value)
  return raw.includes(':') ? raw : `wx:${raw}`
}

function stripWx(value) {
  return String(value || '').replace(/^wx:/, '')
}

function toMillis(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value.$date) return toMillis(value.$date)
  if (value instanceof Date) return value.getTime()
  const t = new Date(value).getTime()
  return Number.isFinite(t) ? t : 0
}

function pickLatestBackupDir() {
  if (!fs.existsSync(BACKUP_ROOT)) return ''
  const dirs = fs.readdirSync(BACKUP_ROOT).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
  if (!dirs.length) return ''
  return path.join(BACKUP_ROOT, dirs[dirs.length - 1])
}

function parseArgs(argv) {
  const out = {}
  for (const arg of argv) {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(arg)
    if (!m) continue
    out[m[1]] = m[2] === undefined ? true : m[2]
  }
  return out
}

function postJson(pathname, body) {
  const url = API_BASE + API_PREFIX + pathname
  const payload = JSON.stringify(body || {})
  const u = new URL(url)
  const mod = u.protocol === 'https:' ? https : http
  return new Promise((resolve, reject) => {
    const req = mod.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        [ADMIN_HEADER]: ADMIN_KEY,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        let parsed
        try { parsed = JSON.parse(data) } catch (_) { parsed = { raw: data } }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed).slice(0, 500)}`))
          return
        }
        if (parsed && parsed.ok === false) {
          reject(new Error(parsed.error || parsed.code || 'api error'))
          return
        }
        resolve(parsed)
      })
    })
    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

main().catch((error) => {
  console.error('迁移失败:', error && error.stack ? error.stack : error)
  process.exit(1)
})
