#!/usr/bin/env node
'use strict'
/**
 * 调用微信「获取 URL Link」接口，生成可用于短信/网页/微信外打开的短链（https://wxaurl.cn/...）。
 * 文档: https://developers.weixin.qq.com/minigame/dev/api-backend/open-api/url-link/urllink.generate.html
 *
 * 依赖与 upload_cdn 相同：WX_SECRET 或 scripts/.cdn_secret
 *
 * 用法:
 *   node scripts/generateWxUrlLink.js
 *   node scripts/generateWxUrlLink.js --path= --query=channel=1 --days=7
 *   WX_APPID=wx... node scripts/generateWxUrlLink.js
 */

const https = require('https')
const path = require('path')
const { loadWxSecret, PROJECT_ROOT } = require('./loadWxSecret')

const wechatCfg = require(path.join(PROJECT_ROOT, 'platform', 'wechat.project.config.json'))
const APPID = process.env.WX_APPID || wechatCfg.appid

function parseArgs(argv) {
  const out = { path: '', query: '', days: 7, envVersion: 'release' }
  for (const a of argv) {
    if (a.startsWith('--path=')) out.path = a.slice('--path='.length)
    else if (a.startsWith('--query=')) out.query = a.slice('--query='.length)
    else if (a.startsWith('--days=')) out.days = Math.min(30, Math.max(1, parseInt(a.slice('--days='.length), 10) || 7))
    else if (a.startsWith('--env-version=')) out.envVersion = a.slice('--env-version='.length)
  }
  return out
}

function httpsRequest(url, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj != null ? JSON.stringify(bodyObj) : null
    const urlObj = new URL(url)
    const req = https.request(
      {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method: body ? 'POST' : 'GET',
        headers: body
          ? {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body),
            }
          : {},
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            resolve(data)
          }
        })
      }
    )
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function getAccessToken(secret) {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${secret}`
  const res = await httpsRequest(url)
  if (!res || res.errcode) {
    const msg = res ? `${res.errcode} ${res.errmsg}` : 'empty response'
    throw new Error(`获取 access_token 失败: ${msg}`)
  }
  return res.access_token
}

async function main() {
  const secret = loadWxSecret()
  if (!secret) {
    console.error('未找到 WX_SECRET，请设置环境变量或配置 scripts/.cdn_secret')
    process.exit(1)
  }

  const { path: pagePath, query, days, envVersion } = parseArgs(process.argv.slice(2))

  const token = await getAccessToken(secret)
  const api = `https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(token)}`
  const payload = {
    path: pagePath,
    query,
    expire_type: 1,
    expire_interval: days,
    env_version: envVersion,
  }

  const result = await httpsRequest(api, payload)
  if (result.errcode && result.errcode !== 0) {
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }
  console.log(result.url_link || JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
