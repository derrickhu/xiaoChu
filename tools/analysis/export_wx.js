/**
 * 通过微信 HTTP API 直接导出云数据库
 * 不依赖 tcb CLI、开发者工具或任何 SDK
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

// 自动加载 .env 文件
const envFile = path.join(__dirname, '.env')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
    const m = line.match(/^(\w+)=(.+)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}

const APPID = 'wx53b03390106eff65'
const SECRET = process.env.WX_SECRET || ''
const ENV_ID = 'cloud1-6g8y0x2i39e768eb'
const DATA_DIR = path.join(__dirname, 'data')
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

async function getAccessToken(appid, secret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`
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

async function exportCollection(token, name) {
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

  const outFile = path.join(DATA_DIR, `${name}.json`)
  fs.writeFileSync(outFile, JSON.stringify(all, null, 2), 'utf-8')
  console.log(`  ✓ ${name}: ${all.length} 条 → ${path.basename(outFile)}`)
  return all.length
}

async function main() {
  const secret = SECRET
  if (!secret) {
    console.error('错误: 未设置 WX_SECRET')
    console.error('用法: WX_SECRET=你的appsecret node export_wx.js')
    process.exit(1)
  }

  fs.mkdirSync(DATA_DIR, { recursive: true })

  console.log('获取 access_token...')
  const token = await getAccessToken(APPID, secret)
  console.log('  ✓ access_token 获取成功')
  console.log('')
  console.log('===== 开始导出 =====')

  for (const col of COLLECTIONS) {
    try {
      await exportCollection(token, col)
    } catch (e) {
      console.error(`  ✗ ${col}: ${e.message}`)
    }
  }

  console.log('')
  console.log('===== 导出完成 =====')
  console.log('接下来运行: python analyze.py')
}

main().catch(e => { console.error('失败:', e); process.exit(1) })
