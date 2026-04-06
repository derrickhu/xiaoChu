#!/usr/bin/env node
/**
 * CDN 资源增量上传脚本 — 灵宠消消塔
 *
 * 使用微信 HTTP API 直接上传到云存储，零 SDK 依赖
 * 复用 WX_SECRET，和 export_wx.js 同一套鉴权
 *
 * 用法:
 *   ./scripts/upload.sh          增量上传
 *   ./scripts/upload.sh --force  强制全量重传
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const PROJECT_ROOT = path.resolve(__dirname, '..')
const cdnCfg = require(path.join(PROJECT_ROOT, 'js', 'data', 'cdnConfig.js'))

const APPID = 'wx53b03390106eff65'
const ENV_ID = cdnCfg.cloudEnv
const CDN_FILE_PREFIX = cdnCfg.filePrefix
const CDN_LOCAL_DIRS = cdnCfg.cdnDirs.map(d => ({ local: d, remote: d }))
const IGNORE_FILES = new Set(cdnCfg.ignoreFiles || ['game.js', '.DS_Store', 'Thumbs.db'])
const FORCE = process.argv.includes('--force')
const MANIFEST_LOCAL = path.join(PROJECT_ROOT, 'scripts', '.cdn_manifest.json')

// 并发上传数
const CONCURRENCY = 5

// ===== 加载密钥 =====
function loadWxSecret() {
  // 1. 环境变量
  if (process.env.WX_SECRET) return process.env.WX_SECRET
  // 2. scripts/.cdn_secret
  const secretFile = path.join(__dirname, '.cdn_secret')
  if (fs.existsSync(secretFile)) {
    for (const line of fs.readFileSync(secretFile, 'utf-8').split('\n')) {
      const m = line.match(/^WX_SECRET=(.+)$/)
      if (m) return m[1].trim()
    }
  }
  // 3. tools/analysis/.env
  const envFile = path.join(PROJECT_ROOT, 'tools', 'analysis', '.env')
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^WX_SECRET=(.+)$/)
      if (m) return m[1].trim()
    }
  }
  return null
}

// ===== HTTP 工具 =====
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

function multipartUpload(uploadUrl, fields, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----CDNUpload' + Date.now()
    let body = ''
    for (const [key, val] of Object.entries(fields)) {
      body += `--${boundary}\r\n`
      body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`
      body += `${val}\r\n`
    }
    body += `--${boundary}\r\n`
    body += `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`
    body += `Content-Type: application/octet-stream\r\n\r\n`
    const bodyEnd = `\r\n--${boundary}--\r\n`

    const bodyBuf = Buffer.concat([
      Buffer.from(body, 'utf-8'),
      fileBuffer,
      Buffer.from(bodyEnd, 'utf-8'),
    ])

    const urlObj = new URL(uploadUrl)
    const httpModule = urlObj.protocol === 'https:' ? https : http
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length,
      },
    }

    const req = httpModule.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }))
    })
    req.on('error', reject)
    req.write(bodyBuf)
    req.end()
  })
}

async function getAccessToken(secret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${secret}`
  const res = await httpsRequest(url)
  if (res.errcode) throw new Error(`获取 access_token 失败: ${res.errcode} ${res.errmsg}`)
  return res.access_token
}

// 第一步：获取上传凭证
async function getUploadInfo(token, cloudPath) {
  const url = `https://api.weixin.qq.com/tcb/uploadfile?access_token=${token}`
  const res = await httpsRequest(url, { env: ENV_ID, path: cloudPath })
  if (res.errcode && res.errcode !== 0) {
    throw new Error(`获取上传凭证失败: ${res.errcode} ${res.errmsg}`)
  }
  return res
}

// 第二步：上传文件到 COS（key 必须是原始 path，不是 cos_file_id）
async function uploadFileToCos(uploadInfo, cloudPath, fileBuffer, fileName) {
  const fields = {
    key: cloudPath,
    Signature: uploadInfo.authorization,
    'x-cos-security-token': uploadInfo.token,
    'x-cos-meta-fileid': uploadInfo.cos_file_id,
  }
  // 从返回的 url 提取上传地址
  const result = await multipartUpload(uploadInfo.url, fields, fileBuffer, fileName)
  if (result.statusCode >= 200 && result.statusCode < 300) return true
  if (result.statusCode === 204) return true
  throw new Error(`COS 上传返回 ${result.statusCode}: ${result.body.substring(0, 200)}`)
}

// 完整上传一个文件
async function uploadOneFile(token, localPath, cloudPath) {
  const fileBuffer = fs.readFileSync(localPath)
  const fileName = path.basename(localPath)
  const uploadInfo = await getUploadInfo(token, cloudPath)
  await uploadFileToCos(uploadInfo, cloudPath, fileBuffer, fileName)
}

// ===== 文件扫描 =====
function md5File(filePath) {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('md5').update(data).digest('hex').substring(0, 8)
}

function walkDir(dir, prefix) {
  const results = []
  if (!fs.existsSync(dir)) return results
  for (const item of fs.readdirSync(dir)) {
    if (IGNORE_FILES.has(item)) continue
    const fullPath = path.join(dir, item)
    const remotePath = prefix ? prefix + '/' + item : item
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, remotePath))
    } else {
      results.push({ local: fullPath, remote: remotePath, size: stat.size })
    }
  }
  return results
}

function saveManifest(m) {
  fs.writeFileSync(MANIFEST_LOCAL, JSON.stringify(m, null, 2), 'utf-8')
}

async function fetchRemoteManifest(token) {
  const manifestCloudPath = CDN_FILE_PREFIX + '/manifest.json'
  // 先获取下载链接
  const url = `https://api.weixin.qq.com/tcb/batchdownloadfile?access_token=${token}`
  const res = await httpsRequest(url, {
    env: ENV_ID,
    file_list: [{ fileid: `cloud://${ENV_ID}.${cdnCfg.cloudBucket}/${manifestCloudPath}`, max_age: 60 }],
  })
  if (res.errcode && res.errcode !== 0) return null
  const fileInfo = (res.file_list || [])[0]
  if (!fileInfo || fileInfo.status !== 0 || !fileInfo.download_url) return null
  // 下载 manifest 内容
  try {
    const data = await httpsRequest(fileInfo.download_url)
    if (data && data.files) return data
  } catch (_) {}
  return null
}

// ===== 并发控制 =====
async function runWithConcurrency(tasks, concurrency, onProgress) {
  let done = 0, failed = 0
  const results = []
  const executing = new Set()
  for (const task of tasks) {
    const p = task().then(
      () => { done++; onProgress(done, failed) },
      (e) => { failed++; onProgress(done, failed, e) }
    )
    results.push(p)
    executing.add(p)
    p.finally(() => executing.delete(p))
    if (executing.size >= concurrency) {
      await Promise.race(executing)
    }
  }
  await Promise.allSettled(results)
  return { done, failed }
}

// ===== 主流程 =====
async function main() {
  console.log('=== CDN 资源上传（微信云存储）===')
  console.log('云环境:', ENV_ID)
  console.log('模式:', FORCE ? '强制全量' : '增量')
  console.log('')

  // 0. 检查密钥
  const wxSecret = loadWxSecret()
  if (!wxSecret) {
    console.log('⚠ 未找到 WX_SECRET')
    console.log('')
    console.log('请在以下任一位置配置:')
    console.log('  1. scripts/.cdn_secret 文件加一行: WX_SECRET=你的appsecret')
    console.log('  2. tools/analysis/.env 文件 (如已有则自动复用)')
    console.log('  3. 环境变量: WX_SECRET=xxx ./scripts/upload.sh')
    process.exit(1)
  }

  // 1. 获取 access_token
  console.log('获取 access_token...')
  const token = await getAccessToken(wxSecret)
  console.log('  ✓ 成功')
  console.log('')

  // 2. 扫描本地文件
  const allFiles = []
  for (const dir of CDN_LOCAL_DIRS) {
    const localDir = path.join(PROJECT_ROOT, dir.local)
    allFiles.push(...walkDir(localDir, dir.remote))
  }
  console.log(`扫描完成: ${allFiles.length} 个文件`)

  // 3. 计算 hash
  const localManifest = {}
  for (const f of allFiles) {
    localManifest[f.remote] = { hash: md5File(f.local), size: f.size }
  }

  // 4. 从云端拉取 manifest 做对比（以云端实际状态为准）
  console.log('拉取云端 manifest...')
  const remoteManifest = FORCE ? null : await fetchRemoteManifest(token)
  if (remoteManifest) {
    console.log(`  ✓ 云端版本 v${remoteManifest.version}，${Object.keys(remoteManifest.files).length} 个文件`)
  } else {
    console.log('  ✓ 云端无 manifest，将全量上传')
  }

  const oldFiles = (remoteManifest && remoteManifest.files) || {}
  const oldVersion = (remoteManifest && remoteManifest.version) || 0
  const toUpload = [], toDelete = []
  let skipped = 0

  for (const [rp, info] of Object.entries(localManifest)) {
    if (!FORCE && oldFiles[rp] && oldFiles[rp].hash === info.hash) skipped++
    else toUpload.push(rp)
  }
  for (const rp of Object.keys(oldFiles)) {
    if (!localManifest[rp]) toDelete.push(rp)
  }

  console.log(`  新增/更新: ${toUpload.length}`)
  console.log(`  删除: ${toDelete.length}`)
  console.log(`  跳过: ${skipped}`)
  console.log('')

  if (toUpload.length === 0 && toDelete.length === 0) {
    console.log('无变更，已是最新。')
    return
  }

  // 5. 上传文件
  const totalSize = toUpload.reduce((s, rp) => s + (localManifest[rp]?.size || 0), 0)
  console.log(`开始上传 ${toUpload.length} 个文件 (${(totalSize / 1024 / 1024).toFixed(1)} MB)，并发 ${CONCURRENCY}...`)

  const tasks = toUpload.map(rp => {
    const fileInfo = allFiles.find(f => f.remote === rp)
    const cloudPath = CDN_FILE_PREFIX + '/' + rp
    return () => uploadOneFile(token, fileInfo.local, cloudPath)
  })

  const { done: uploaded, failed } = await runWithConcurrency(tasks, CONCURRENCY, (done, fail, err) => {
    if (err) {
      const idx = done + fail
      console.error(`  ✗ [${idx}/${toUpload.length}] ${toUpload[idx - 1]} - ${err.message?.split('\n')[0]}`)
    }
    if ((done + fail) % 20 === 0 || done + fail === toUpload.length) {
      const pct = (((done + fail) / toUpload.length) * 100).toFixed(0)
      process.stdout.write(`\r  [${pct}%] ${done} 成功 / ${fail} 失败 / ${toUpload.length} 总计`)
    }
  })
  console.log('')

  // 6. 删除已移除的文件
  if (toDelete.length > 0) {
    console.log(`\n清理已删除文件 (${toDelete.length} 个)...`)
    const fileIdList = toDelete.map(rp => CDN_FILE_PREFIX + '/' + rp)
    try {
      const url = `https://api.weixin.qq.com/tcb/batchdeletefile?access_token=${token}`
      await httpsRequest(url, { env: ENV_ID, fileid_list: fileIdList })
      console.log('  清理完成')
    } catch (e) {
      console.error('  清理失败:', e.message)
    }
  }

  // 7. 生成并上传 manifest
  const newManifest = {
    version: oldVersion + 1,
    updated: new Date().toISOString().split('T')[0],
    files: localManifest,
  }

  if (uploaded > 0) {
    const tmpManifest = path.join(__dirname, '_tmp_manifest.json')
    fs.writeFileSync(tmpManifest, JSON.stringify(newManifest, null, 2), 'utf-8')
    try {
      await uploadOneFile(token, tmpManifest, CDN_FILE_PREFIX + '/manifest.json')
      console.log('manifest.json 已上传')
    } catch (e) {
      console.error('manifest.json 上传失败:', e.message)
    }
    try { fs.unlinkSync(tmpManifest) } catch (_) {}
  }

  saveManifest(newManifest)

  console.log('')
  console.log('=== 完成 ===')
  console.log(`  上传成功: ${uploaded}`)
  if (failed > 0) console.log(`  上传失败: ${failed}`)
  if (toDelete.length > 0) console.log(`  已删除: ${toDelete.length}`)
  console.log(`  manifest 版本: v${newManifest.version}`)
}

main().catch(e => {
  console.error('上传脚本异常:', e)
  process.exit(1)
})
