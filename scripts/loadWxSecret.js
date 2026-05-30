'use strict'
/**
 * 凭据/配置统一加载（CDN 上传、云数据库导出等共用）
 *
 * 优先级（后者不写进 process.env，避免副作用）:
 *   1. 环境变量
 *   2. scripts/.cdn_secret
 *   3. tools/analysis/.env
 *
 * 关心的 key：
 *   WX_SECRET                  微信小程序 AppSecret（旧 wx.cloud 导出/迁移用）
 *   TENCENTCLOUD_SECRET_ID     腾讯云 API 密钥 ID（CDN 上传用）
 *   TENCENTCLOUD_SECRET_KEY    腾讯云 API 密钥 Key
 *   TENCENTCLOUD_REGION        腾讯云地域（可选，自动探测）
 *   CDN_CLOUD_BUCKET           COS 桶名（可选，默认从 cdnConfig 读）
 *   CDN_BASE_URL               CDN 访问域名（可选，默认从 cdnConfig 读）
 */
const fs = require('fs')
const path = require('path')

const PROJECT_ROOT = path.resolve(__dirname, '..')

function readEnvFile(filePath) {
  const out = {}
  if (!fs.existsSync(filePath)) return out
  for (const line of fs.readFileSync(filePath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '').trim()
  }
  return out
}

function loadEnv() {
  const secretFile = path.join(__dirname, '.cdn_secret')
  const analysisEnv = path.join(PROJECT_ROOT, 'tools', 'analysis', '.env')
  return {
    ...readEnvFile(analysisEnv),
    ...readEnvFile(secretFile),
    ...process.env,
  }
}

function loadWxSecret() {
  const env = loadEnv()
  return env.WX_SECRET || null
}

function loadUploadEnv() {
  const env = loadEnv()
  return {
    wxSecret: env.WX_SECRET || '',
    wxAppId: env.WX_APPID || '',
    tencentSecretId: env.TENCENTCLOUD_SECRET_ID || '',
    tencentSecretKey: env.TENCENTCLOUD_SECRET_KEY || '',
    tencentRegion: env.TENCENTCLOUD_REGION || '',
    cloudBucket: env.CDN_CLOUD_BUCKET || '',
    cdnBaseUrl: env.CDN_BASE_URL || '',
  }
}

module.exports = { loadWxSecret, loadUploadEnv, PROJECT_ROOT }
