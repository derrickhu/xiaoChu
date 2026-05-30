/**
 * 统一后端 API 客户端
 * 微信/抖音统一通过 CloudBase HTTP 访问服务接入唯一云函数 xiaochu-api
 * 后端集合统一前缀 xiaochu_*，环境变量统一前缀 XIAOCHU_*
 */
const P = require('./platform')

const GAME_KEY = 'xiaochu'
const API_PREFIX = '/' + GAME_KEY + '-api'

// CloudBase HTTP 访问服务根域名；微信/抖音统一接入 xiaochu-api。
const BASE_URL = 'https://rosa-env-d7grf78r5dbd37323.service.tcloudbase.com'

let _token = ''
let _userId = ''
let _openId = ''
let _remoteUpdatedAt = 0

function _request(method, path, data) {
  return new Promise((resolve, reject) => {
    P.request({
      url: BASE_URL + API_PREFIX + path,
      method,
      header: {
        'Content-Type': 'application/json',
        ...(_token ? { Authorization: 'Bearer ' + _token } : {}),
      },
      data,
      success: (res) => {
        try {
          resolve(_normalizeResponse(res))
        } catch (e) {
          reject(e)
        }
      },
      fail: (err) => reject(new Error(err.errMsg || 'network error')),
    })
  })
}

function _normalizeResponse(res) {
  const statusCode = res && res.statusCode
  const body = res && res.data
  if (statusCode < 200 || statusCode >= 300) {
    const error = new Error((body && (body.error || body.msg)) || 'request failed')
    if (body && body.data) error.data = body.data
    throw error
  }
  if (body && body.ok === true) {
    const data = body.data || {}
    if (data && typeof data === 'object' && data.code === 0) return data
    return { code: 0, data, gameKey: body.gameKey }
  }
  if (body && body.code === 0) return body
  throw new Error((body && (body.error || body.msg)) || 'request failed')
}

const api = {
  login() {
    return new Promise((resolve, reject) => {
      P.login({
        success: async (loginRes) => {
          try {
            const result = await _request('POST', '/login', {
              platform: P.isWeChat ? 'wx' : 'dy',
              code: loginRes.code,
            })
            const data = result.data || result
            _token = data.token || ''
            _userId = data.userId || ''
            _openId = data.openId || _userId
            if (!_token || !_userId) throw new Error('login response missing token/userId')
            console.log('[API] xiaochu-api 登录成功, userId=', _userId)
            resolve({ code: 0, ...data })
          } catch (e) {
            _token = ''
            _userId = ''
            _openId = ''
            reject(e)
          }
        },
        fail: (err) => {
          _token = ''
          _userId = ''
          _openId = ''
          reject(new Error((err && err.errMsg) || 'P.login failed'))
        },
      })
    })
  },

  async getPlayerData() {
    const result = await _request('POST', '/save/pull', {})
    const data = result.data || {}
    _remoteUpdatedAt = Number(data.updatedAt || 0)
    return {
      code: 0,
      data: data.exists ? (data.payload || {}) : null,
      exists: !!data.exists,
      schemaVersion: data.schemaVersion || 0,
      updatedAt: _remoteUpdatedAt,
    }
  },

  async syncPlayerData(data) {
    const updatedAt = data && data._updateTime ? data._updateTime : Date.now()
    const result = await _request('POST', '/save/push', {
      schemaVersion: (data && (data._version || data.dataVersion)) || 1,
      updatedAt,
      baseRemoteUpdatedAt: _remoteUpdatedAt,
      payload: data || {},
    })
    const saved = result.data || result
    _remoteUpdatedAt = Number(saved.updatedAt || updatedAt)
    return { code: 0, ...saved }
  },

  submitRanking(data) {
    return _request('POST', '/ranking/submit', data || {})
  },

  getRankingList(tab, limit, params) {
    const body = { ...(params || {}) }
    body.tab = tab || body.tab || 'all'
    body.limit = limit || body.limit || 100
    return _request('POST', '/ranking/list', body)
  },

  ranking(data) {
    return _request('POST', '/ranking/action', data || {})
  },

  queryPendingGifts() {
    return _request('POST', '/gift/queryPending', {})
  },

  markGiftsGranted(ids) {
    return _request('POST', '/gift/markGranted', { ids: ids || [] })
  },

  recordInvite(inviter) {
    return _request('POST', '/share/recordInvite', { inviter })
  },

  claimInvites() {
    return _request('POST', '/share/claimInvites', {})
  },

  get hasToken() { return !!_token },
  get userId() { return _userId },
  get openId() { return _openId },
}

module.exports = api
