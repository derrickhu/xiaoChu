#!/usr/bin/env node
'use strict'
/**
 * 开新区 / 查看区服列表
 *
 * 用法:
 *   node scripts/open_server.js 3                 # 开三区（默认名：玄霄洞天）
 *   node scripts/open_server.js 3 --name 自定义名  # 自定义显示名
 *   node scripts/open_server.js 3 --dry-run         # 仅预览，不写库
 *   node scripts/open_server.js --list              # 列出云端 xiaochu_servers
 *
 * 凭据（scripts/.cdn_secret 或环境变量）:
 *   TCB_ENV=rosa-env-d7grf78r5dbd37323
 *   TENCENTCLOUD_SECRET_ID
 *   TENCENTCLOUD_SECRET_KEY
 *
 * 首次运行前请安装云函数依赖:
 *   cd cloudfunctions/xiaochu-api && npm install
 */

const path = require('path')
const { loadEnv, PROJECT_ROOT } = require('./loadEnv')

const COLLECTION = 'xiaochu_servers'
const SDK_PATH = path.join(PROJECT_ROOT, 'cloudfunctions', 'xiaochu-api', 'node_modules', '@cloudbase', 'node-sdk')

/** 各区默认显示名（与 js/data/serverConfig.js 兜底、选服页一致） */
const ZONE_PRESETS = {
  1: { name: '紫霄仙域', notice: '老玩家默认所在服务器' },
  2: { name: '逍遥剑宗', notice: '独立新进度' },
  3: { name: '玄霄洞天', notice: '新开三区，全新旅程' },
  4: { name: '碧落仙台', notice: '新开四区，全新旅程' },
  5: { name: '绛霄仙府', notice: '新开五区，全新旅程' },
}

function loadCloudbase() {
  try {
    return require(SDK_PATH)
  } catch (_) {
    console.error('[open_server] 未找到 @cloudbase/node-sdk，请先执行:')
    console.error('  cd cloudfunctions/xiaochu-api && npm install')
    process.exit(1)
  }
}

function parseArgs(argv) {
  const args = argv.slice(2)
  const opts = { list: false, dryRun: false, name: '', notice: '', zone: 0 }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--list') opts.list = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--name') opts.name = String(args[++i] || '').trim()
    else if (a === '--notice') opts.notice = String(args[++i] || '').trim()
    else if (/^\d+$/.test(a)) opts.zone = Number(a)
    else if (a === '--help' || a === '-h') {
      console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').slice(0, 18).join('\n'))
      process.exit(0)
    } else {
      console.error(`未知参数: ${a}`)
      process.exit(1)
    }
  }
  return opts
}

function buildServerDoc(zone, overrides) {
  const z = Math.floor(Number(zone))
  if (!Number.isFinite(z) || z < 1 || z > 9999) {
    throw new Error(`非法区号: ${zone}（请传 1~9999 的整数）`)
  }
  const preset = ZONE_PRESETS[z] || {}
  const serverId = `s${z}`
  return {
    serverId,
    name: overrides.name || preset.name || `${z}服`,
    status: 'open',
    isLegacyDefault: z === 1,
    isRecommended: true,
    sort: z,
    zone: z,
    openAt: Date.now(),
    notice: overrides.notice || preset.notice || '新服开启，独立新进度',
    visible: true,
  }
}

function getDb() {
  const env = loadEnv()
  const tcbEnv = env.TCB_ENV || 'rosa-env-d7grf78r5dbd37323'
  const secretId = env.TENCENTCLOUD_SECRET_ID || ''
  const secretKey = env.TENCENTCLOUD_SECRET_KEY || ''
  if (!secretId || !secretKey) {
    console.error('[open_server] 缺少 TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY')
    console.error('  请在 scripts/.cdn_secret 或环境变量中配置')
    process.exit(1)
  }
  const tcb = loadCloudbase()
  const app = tcb.init({
    env: tcbEnv,
    secretId,
    secretKey,
  })
  return { db: app.database(), tcbEnv }
}

async function listServers(db) {
  const res = await db.collection(COLLECTION).orderBy('sort', 'asc').limit(100).get()
  const rows = (res && res.data) || []
  if (!rows.length) {
    console.log('(集合为空，客户端将使用内置 s1/s2/s3 兜底)')
    return
  }
  console.log(`\n${COLLECTION} 共 ${rows.length} 条:\n`)
  for (const row of rows) {
    const rec = `${row.serverId || row.id}`.padEnd(4)
    const name = String(row.name || '').padEnd(10)
    const status = String(row.status || 'open').padEnd(12)
    const recFlag = row.isRecommended ? '★推荐' : ''
    const legacy = row.isLegacyDefault ? ' [默认老服]' : ''
    console.log(`  ${rec} ${name} status=${status} zone=${row.zone}${recFlag}${legacy}`)
  }
  console.log('')
}

async function openZone(db, zone, overrides) {
  const doc = buildServerDoc(zone, overrides)
  const { serverId } = doc

  const existingRes = await db.collection(COLLECTION).where({ serverId }).limit(1).get()
  const existing = (existingRes.data && existingRes.data[0]) || null

  const plan = {
    action: existing ? 'update' : 'insert',
    doc,
    unsetRecommendOn: `除 ${serverId} 外全部 isRecommended=false`,
  }

  if (overrides.dryRun) {
    console.log('\n[dry-run] 将执行:')
    console.log(JSON.stringify(plan, null, 2))
    return plan
  }

  if (existing) {
    await db.collection(COLLECTION).doc(existing._id).update({
      name: doc.name,
      status: doc.status,
      isLegacyDefault: doc.isLegacyDefault,
      isRecommended: true,
      sort: doc.sort,
      zone: doc.zone,
      openAt: doc.openAt,
      notice: doc.notice,
      visible: true,
    })
    console.log(`[open_server] 已更新 ${serverId} (${doc.name})`)
  } else {
    await db.collection(COLLECTION).add(doc)
    console.log(`[open_server] 已新增 ${serverId} (${doc.name})`)
  }

  // 取消其他服的推荐标记
  const allRes = await db.collection(COLLECTION).limit(100).get()
  for (const row of (allRes.data || [])) {
    if (row.serverId === serverId) continue
    if (row.isRecommended) {
      await db.collection(COLLECTION).doc(row._id).update({ isRecommended: false })
      console.log(`[open_server] 取消推荐: ${row.serverId}`)
    }
  }

  console.log(`\n开区完成: S${zone} · ${doc.name}`)
  console.log('  请确认客户端兜底已包含该服（serverConfig.js / server.js），并已发版。')
  return plan
}

async function main() {
  const opts = parseArgs(process.argv)
  const { db, tcbEnv } = getDb()
  console.log(`[open_server] env=${tcbEnv} collection=${COLLECTION}`)

  if (opts.list) {
    await listServers(db)
    return
  }

  if (!opts.zone) {
    console.error('请传入区号，例如: node scripts/open_server.js 3')
    console.error('或: node scripts/open_server.js --list')
    process.exit(1)
  }

  await openZone(db, opts.zone, {
    name: opts.name,
    notice: opts.notice,
    dryRun: opts.dryRun,
  })
}

main().catch((err) => {
  console.error('[open_server] 失败:', err && err.message ? err.message : err)
  process.exit(1)
})
