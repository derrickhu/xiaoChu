#!/usr/bin/env node
'use strict'

/**
 * 单账号微信存档迁移到 xiaochu-api
 *
 * 数据来源：本地备份目录 tools/backup/data/<日期>/<集合>.json
 * 用途：测试基础流程（不依赖在线导出微信数据），按单个 openid 把玩家存档 + 排行榜记录 + 礼包搬到 xiaochu_*。
 *
 * 必需参数：
 *   --openid=<旧微信 openid>          指定要迁移的玩家 openid（旧微信 _openid 字段值）
 *
 * 可选参数：
 *   --src-dir=tools/backup/data/2026-05-25   备份目录，默认取 tools/backup/data/ 下最新一天
 *   --dry-run                                只导出和转换，不调用 /admin/importBatch
 *   --api-base=https://xxx.tcloudbase.com    覆盖默认 API base
 *
 * 必需环境变量（非 dry-run 时）：
 *   XIAOCHU_ADMIN_KEY=<与云函数环境变量一致的迁移管理密钥>
 *
 * 示例：
 *   node scripts/migrate_single_account_to_xiaochu.js --openid=oEnZR3XFkSkBvflm37cinC3qYSCY --dry-run
 *   XIAOCHU_ADMIN_KEY=xxx node scripts/migrate_single_account_to_xiaochu.js --openid=oEnZR3XFkSkBvflm37cinC3qYSCY
 */

const fs = require('fs')
const path = require('path')
const https = require('https')
const http = require('http')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const BACKUP_ROOT = path.join(PROJECT_ROOT, 'tools', 'backup', 'data')

const ARGS = parseArgs(process.argv.slice(2))
const OPENID = ARGS.openid
const SRC_DIR = ARGS['src-dir'] ? path.resolve(ARGS['src-dir']) : pickLatestBackupDir()
const DRY_RUN = !!ARGS['dry-run']
const API_BASE = (ARGS['api-base'] || process.env.XIAOCHU_API_BASE_URL || 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com').replace(/\/$/, '')
const API_PREFIX = '/xiaochu-api'
const ADMIN_KEY = process.env.XIAOCHU_ADMIN_KEY || ''
const ADMIN_HEADER = 'x-xiaochu-admin-key'

// 旧微信集合名 → 新 xiaochu_* 集合后缀
const SOURCE_COLLECTIONS = ['playerData', 'rankAll', 'rankAllWeekly', 'rankStage', 'rankDex', 'rankCombo', 'pendingGifts']

async function main() {
  if (!OPENID) {
    console.error('缺少 --openid=<旧微信 openid>')
    process.exit(1)
  }
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`源目录不存在: ${SRC_DIR}`)
    process.exit(1)
  }

  console.log('=== 单账号迁移 ===')
  console.log('openid:', OPENID)
  console.log('源目录:', SRC_DIR)
  console.log('模式:', DRY_RUN ? 'dry-run（不写入）' : '正式导入')
  console.log('API:', API_BASE + API_PREFIX)
  console.log('')

  const converted = {}
  let totalDocs = 0
  for (const sourceName of SOURCE_COLLECTIONS) {
    const file = path.join(SRC_DIR, `${sourceName}.json`)
    if (!fs.existsSync(file)) {
      console.log(`  跳过 ${sourceName}: 文件不存在`)
      continue
    }
    const rows = JSON.parse(fs.readFileSync(file, 'utf-8'))
    const filtered = filterByOpenid(rows, sourceName, OPENID)
    converted[sourceName] = convertCollection(sourceName, filtered)
    totalDocs += converted[sourceName].length
    console.log(`  ${sourceName}: 命中 ${filtered.length} 条 → 转换 ${converted[sourceName].length} 条`)
  }

  if (totalDocs === 0) {
    console.warn(`\n⚠ 在备份目录里没有找到 openid=${OPENID} 的任何记录，请确认 openid 或选另一份 --src-dir=`)
    process.exit(2)
  }

  if (DRY_RUN) {
    console.log('\n=== dry-run 完成（未写入）===')
    if (ARGS.print) {
      for (const name of Object.keys(converted)) {
        if (!converted[name].length) continue
        console.log(`\n--- ${name} (sample) ---`)
        console.log(JSON.stringify(converted[name][0], null, 2).slice(0, 800))
      }
    }
    return
  }

  if (!ADMIN_KEY) throw new Error('缺少 XIAOCHU_ADMIN_KEY')

  console.log('\n初始化目标集合...')
  const init = await postJson('/admin/initCollections', {})
  const initData = init.data || init
  console.log(`  created=${(initData.created || []).length} existed=${(initData.existed || []).length} errors=${(initData.errors || []).length}`)

  for (const sourceName of SOURCE_COLLECTIONS) {
    const docs = converted[sourceName]
    if (!docs || !docs.length) continue
    console.log(`\n导入 ${sourceName} → xiaochu_${sourceName}: ${docs.length} 条`)
    const res = await postJson('/admin/importBatch', { collection: sourceName, docs })
    const data = res.data || res
    console.log(`  inserted=${data.inserted || 0} updated=${data.updated || 0} skipped=${data.skipped || 0}`)
  }
  console.log('\n=== 单账号迁移完成 ===')
}

function filterByOpenid(rows, name, openid) {
  if (!Array.isArray(rows)) return []
  return rows.filter((row) => extractOpenId(row, name) === openid)
}

function convertCollection(name, rows) {
  if (!Array.isArray(rows)) return []
  if (name === 'playerData') return rows.map(convertPlayer).filter(Boolean)
  if (name === 'pendingGifts') return rows.map(convertPendingGift).filter(Boolean)
  return rows.map(convertRank).filter(Boolean)
}

function convertPlayer(row) {
  const openId = extractOpenId(row, 'playerData')
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
  const openId = extractOpenId(row, 'rank')
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

function extractOpenId(row, name) {
  if (!row) return ''
  if (name === 'pendingGifts') return String(row.openId || row.openid || row._openid || row.ToUserOpenid || '').replace(/^wx:/, '')
  const raw = row._openid || row.openid || row.openId || row.uid || row.userId
  return String(raw || '').replace(/^wx:/, '')
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
  console.error('单账号迁移失败:', error && error.stack ? error.stack : error)
  process.exit(1)
})
