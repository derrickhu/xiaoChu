/**
 * 统一后端 API 客户端
 * 小游戏端通过 P.request (wx.request / tt.request) 与后端通信
 */
const P = require('./platform')

// 后端地址：上线后替换为正式域名
const BASE_URL = P.isDouyin
  ? 'https://your-douyin-cloud-service.com'
  : 'https://your-wechat-backend.com'

let _token = ''

function _request(method, path, data) {
  return new Promise((resolve, reject) => {
    P.request({
      url: BASE_URL + path,
      method,
      header: {
        'Content-Type': 'application/json',
        ..._token ? { Authorization: 'Bearer ' + _token } : {},
      },
      data,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data)
        } else {
          reject(new Error(res.data?.msg || 'request failed'))
        }
      },
      fail: (err) => reject(new Error(err.errMsg || 'network error')),
    })
  })
}

const api = {
  /**
   * 登录 — 获取 token 供后续请求使用
   * 抖音云部署时请求头自动带 x-tt-openid，可跳过此步
   */
  login() {
    return new Promise((resolve, reject) => {
      if (P.isDouyin) {
        // 抖音云自动注入 openid，无需登录
        _token = ''
        return resolve({ code: 0, msg: 'douyin auto-auth' })
      }

      P.login({
        success: async (loginRes) => {
          try {
            const result = await _request('POST', '/api/login', {
              platform: P.name,
              code: loginRes.code,
            })
            _token = result.token
            resolve(result)
          } catch (e) {
            reject(e)
          }
        },
        fail: (err) => reject(new Error(err.errMsg || 'login failed')),
      })
    })
  },

  getPlayerData() {
    return _request('GET', '/api/player/data')
  },

  syncPlayerData(data) {
    return _request('POST', '/api/player/sync', { data })
  },

  submitRanking(data) {
    return _request('POST', '/api/ranking/submit', data)
  },

  getRankingList(tab, limit) {
    tab = tab || 'all'
    limit = limit || 50
    return _request('GET', `/api/ranking/list?tab=${tab}&limit=${limit}`)
  },

  get hasToken() { return !!_token },
}

module.exports = api
