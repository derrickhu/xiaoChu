'use strict'
/**
 * 微信 AppSecret 统一加载（CDN 上传、云数据库导出等共用）
 *
 * 优先级（后者不写进 process.env，避免副作用）:
 *   1. 环境变量 WX_SECRET
 *   2. scripts/.cdn_secret 单行 WX_SECRET=...
 *   3. tools/analysis/.env 单行 WX_SECRET=...
 */
const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')

function loadWxSecret() {
  if (process.env.WX_SECRET) return String(process.env.WX_SECRET).trim()
  const secretFile = path.join(__dirname, '.cdn_secret')
  if (fs.existsSync(secretFile)) {
    for (const line of fs.readFileSync(secretFile, 'utf-8').split('\n')) {
      const m = line.match(/^WX_SECRET=(.+)$/)
      if (m) return m[1].trim()
    }
  }
  const envFile = path.join(PROJECT_ROOT, 'tools', 'analysis', '.env')
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf-8').split('\n')) {
      const m = line.match(/^WX_SECRET=(.+)$/)
      if (m) return m[1].trim()
    }
  }
  return null
}

module.exports = { loadWxSecret, PROJECT_ROOT }
