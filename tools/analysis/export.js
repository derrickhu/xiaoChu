/**
 * 从微信云数据库导出集合数据
 *
 * 用法:
 *   1. 先去腾讯云控制台获取 API 密钥: https://console.cloud.tencent.com/cam/capi
 *   2. 设置环境变量后运行:
 *      export TC_SECRET_ID=xxx
 *      export TC_SECRET_KEY=xxx
 *      node export.js
 *
 *   或直接修改下方 SECRET_ID / SECRET_KEY 常量（注意别提交到 git）
 */

const cloudbase = require('@cloudbase/node-sdk')
const fs = require('fs')
const path = require('path')

const ENV_ID = 'cloud1-6g8y0x2i39e768eb'
const SECRET_ID = process.env.TC_SECRET_ID || ''
const SECRET_KEY = process.env.TC_SECRET_KEY || ''
const DATA_DIR = path.join(__dirname, 'data')

const COLLECTIONS = ['playerData', 'rankAll', 'rankDex', 'rankCombo']
// 单次拉取上限（云数据库单次最多 1000 条）
const PAGE_SIZE = 1000

async function exportCollection(db, name) {
  const col = db.collection(name)
  let all = []
  let offset = 0

  while (true) {
    const { data } = await col.skip(offset).limit(PAGE_SIZE).get()
    if (!data || data.length === 0) break
    all = all.concat(data)
    console.log(`  ${name}: 已拉取 ${all.length} 条...`)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  const outFile = path.join(DATA_DIR, `${name}.json`)
  fs.writeFileSync(outFile, JSON.stringify(all, null, 2), 'utf-8')
  console.log(`  ✓ ${name}: 共 ${all.length} 条 → ${outFile}`)
  return all.length
}

async function main() {
  if (!SECRET_ID || !SECRET_KEY) {
    console.error('错误: 未设置 TC_SECRET_ID / TC_SECRET_KEY')
    console.error('')
    console.error('请先去腾讯云控制台获取 API 密钥:')
    console.error('  https://console.cloud.tencent.com/cam/capi')
    console.error('')
    console.error('然后运行:')
    console.error('  export TC_SECRET_ID=你的SecretId')
    console.error('  export TC_SECRET_KEY=你的SecretKey')
    console.error('  node export.js')
    process.exit(1)
  }

  const app = cloudbase.init({
    env: ENV_ID,
    secretId: SECRET_ID,
    secretKey: SECRET_KEY,
  })
  const db = app.database()

  fs.mkdirSync(DATA_DIR, { recursive: true })

  console.log(`===== 开始导出 =====`)
  console.log(`云环境: ${ENV_ID}`)
  console.log('')

  for (const col of COLLECTIONS) {
    try {
      await exportCollection(db, col)
    } catch (e) {
      console.error(`  ✗ ${col} 导出失败:`, e.message || e)
    }
  }

  console.log('')
  console.log('===== 导出完成 =====')
  console.log('接下来运行: python analyze.py')
}

main().catch(e => {
  console.error('导出失败:', e)
  process.exit(1)
})
