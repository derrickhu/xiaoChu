/**
 * 登录接口 — 接收平台 code，换取 openId，返回 token
 */
const express = require('express')
const router = express.Router()

// POST /api/login { platform: 'wechat'|'douyin', code: '...' }
router.post('/login', async (req, res) => {
  const { platform, code } = req.body
  if (!platform || !code) {
    return res.json({ code: -1, msg: 'missing platform or code' })
  }

  let openId = ''
  try {
    if (platform === 'wechat') {
      openId = await _wxCode2OpenId(code)
    } else if (platform === 'douyin') {
      openId = await _ttCode2OpenId(code)
    } else {
      return res.json({ code: -1, msg: 'unsupported platform' })
    }
  } catch (e) {
    console.error('[Auth] code2openid failed:', e.message)
    return res.json({ code: -1, msg: 'login failed: ' + e.message })
  }

  if (!openId) {
    return res.json({ code: -1, msg: 'failed to get openid' })
  }

  // 简易 token：base64(platform:openId)
  const token = Buffer.from(`${platform}:${openId}`).toString('base64')
  res.json({ code: 0, token, openId })
})

async function _wxCode2OpenId(code) {
  const appid = process.env.WECHAT_APPID
  const secret = process.env.WECHAT_SECRET
  if (!appid || !secret) throw new Error('WECHAT_APPID/SECRET not configured')
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`
  const resp = await fetch(url)
  const data = await resp.json()
  if (data.errcode) throw new Error(data.errmsg)
  return data.openid
}

async function _ttCode2OpenId(code) {
  const appid = process.env.DOUYIN_APPID
  const secret = process.env.DOUYIN_SECRET
  if (!appid || !secret) throw new Error('DOUYIN_APPID/SECRET not configured')
  const url = `https://developer.toutiao.com/api/apps/v2/jscode2session`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appid, secret, code }),
  })
  const data = await resp.json()
  if (data.err_no !== 0) throw new Error(data.err_tips || 'tt login failed')
  return data.data.openid
}

module.exports = router
