/**
 * 微信云数据库导出 — 通用模块
 * 供 backup/daily.js 和 analysis/export_wx.js 共用
 *
 * 用法:
 *   const { exportAll } = require('../lib/wxCloudExport')
 *   await exportAll('/path/to/output/dir')
 */
'use strict'
const https = require('https')
const fs = require('fs')
const path = require('path')
const { loadWxSecret } = require(path.resolve(__dirname, '..', '..', 'scripts', 'loadWxSecret'))

const APPID = 'wx53b03390106eff65'
const ENV_ID = 'cloud1-6g8y0x2i39e768eb'
const COLLECTIONS = ['playerData', 'rankAll', 'rankDex', 'rankCombo']
const PAGE_SIZE = 1000

function httpsRequest(url, postData) {
  return new Promise((resolve, reject) => {
    const body = typeof postData === 'string' ? postData : JSON.stringify(postData)
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: postData ? 'POST' : 'GET',
      headers: postData ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {},
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(data) }
      })
    })
    req.on('error', reject)
    if (postData) req.write(body)
    req.end()
  })
}

async function getAccessToken() {
  const secret = loadWxSecret()
  if (!secret) throw new Error('未配置 WX_SECRET（环境变量或 scripts/.cdn_secret）')
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${secret}`
  const res = await httpsRequest(url)
  if (res.errcode) throw new Error(`获取 access_token 失败: ${res.errcode} ${res.errmsg}`)
  return res.access_token
}

async function queryCollection(token, collection, offset, limit) {
  const url = `https://api.weixin.qq.com/tcb/databasequery?access_token=${token}`
  const query = `db.collection("${collection}").skip(${offset}).limit(${limit}).get()`
  const res = await httpsRequest(url, { env: ENV_ID, query })
  if (res.errcode && res.errcode !== 0) {
    throw new Error(`查询 ${collection} 失败: ${res.errcode} ${res.errmsg}`)
  }
  return (res.data || []).map(item => JSON.parse(item))
}

async function countCollection(token, collection) {
  const url = `https://api.weixin.qq.com/tcb/databasecount?access_token=${token}`
  const query = `db.collection("${collection}").count()`
  const res = await httpsRequest(url, { env: ENV_ID, query })
  if (res.errcode && res.errcode !== 0) return -1
  return res.count || 0
}

/**
 * 导出单个集合到指定目录
 * @param {string} token
 * @param {string} name 集合名
 * @param {string} outDir 输出目录
 * @returns {{ name, count, file }}
 */
async function exportCollection(token, name, outDir) {
  const total = await countCollection(token, name)
  console.log(`  ${name}: 共 ${total} 条`)

  let all = []
  let offset = 0
  while (true) {
    const data = await queryCollection(token, name, offset, PAGE_SIZE)
    if (!data || data.length === 0) break
    all = all.concat(data)
    process.stdout.write(`\r  ${name}: 已拉取 ${all.length}/${total} 条...`)
    if (data.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  console.log('')

  const outFile = path.join(outDir, `${name}.json`)
  fs.writeFileSync(outFile, JSON.stringify(all, null, 2), 'utf-8')
  console.log(`  ✓ ${name}: ${all.length} 条 → ${outFile}`)
  return { name, count: all.length, file: outFile }
}

/**
 * 导出所有集合到指定目录
 * @param {string} outDir 输出目录（自动创建）
 * @param {string[]} [collections] 可选，指定集合列表，默认全部
 * @returns {Array<{ name, count, file }>}
 */
async function exportAll(outDir, collections) {
  const cols = collections || COLLECTIONS
  fs.mkdirSync(outDir, { recursive: true })

  console.log('获取 access_token...')
  const token = await getAccessToken()
  console.log('  ✓ access_token 获取成功')
  console.log('')

  const results = []
  for (const col of cols) {
    try {
      const r = await exportCollection(token, col, outDir)
      results.push(r)
    } catch (e) {
      console.error(`  ✗ ${col}: ${e.message}`)
      results.push({ name: col, count: -1, error: e.message })
    }
  }
  return results
}

module.exports = { exportAll, exportCollection, getAccessToken, COLLECTIONS }
