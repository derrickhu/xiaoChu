/**
 * 平台适配层 — 灵宠消消塔
 * 统一 wx / tt 差异，游戏代码只通过此模块访问平台能力
 */

const isDouyin = typeof tt !== 'undefined'
const isWeChat = !isDouyin && typeof wx !== 'undefined'
const base = isDouyin ? tt : wx

let _isOHOS = false
try {
  const _sys = base && base.getSystemInfoSync ? base.getSystemInfoSync() : null
  if (_sys && _sys.platform === 'ohos') _isOHOS = true
} catch(_e) {}

const _noop = () => {}
const _noopAsync = async () => ({ result: { code: -1, msg: 'not available' } })

// 云数据库 mock（抖音端第一阶段无云开发，静默返回空数据）
const _mockCol = () => ({
  where: () => ({ get: async () => ({ data: [] }) }),
  add: async () => ({}),
  doc: () => ({ update: async () => ({}), remove: async () => ({}) }),
})
const _mockDb = () => ({ collection: _mockCol })
const _mockCloud = {
  init: _noop,
  database: _mockDb,
  callFunction: _noopAsync,
}

// 抖音没有 getWindowInfo / getDeviceInfo，用 getSystemInfoSync 兼容
function _getWindowInfo() {
  if (typeof base.getWindowInfo === 'function') return base.getWindowInfo()
  const sys = base.getSystemInfoSync()
  return {
    windowWidth: sys.windowWidth || sys.screenWidth,
    windowHeight: sys.windowHeight || sys.screenHeight,
    pixelRatio: sys.pixelRatio || 2,
    safeArea: sys.safeArea || { top: 0 },
  }
}
function _getDeviceInfo() {
  if (typeof base.getDeviceInfo === 'function') return base.getDeviceInfo()
  const sys = base.getSystemInfoSync()
  return {
    platform: sys.platform || 'unknown',
    brand: sys.brand || '',
    model: sys.model || '',
  }
}

const platform = {
  name: isDouyin ? 'douyin' : 'wechat',
  isDouyin,
  isWeChat,
  isOHOS: _isOHOS,

  // ========== 第一层：直接透传（wx/tt 完全一致） ==========
  createCanvas:           (...a) => base.createCanvas(...a),
  createImage:            (...a) => base.createImage(...a),
  createOffscreenCanvas:  typeof base.createOffscreenCanvas === 'function'
    ? (...a) => base.createOffscreenCanvas(...a)
    : null,
  getWindowInfo:          ()     => _getWindowInfo(),
  getDeviceInfo:          ()     => _getDeviceInfo(),
  loadSubpackage:         (opts) => base.loadSubpackage(opts),
  showModal:              (opts) => base.showModal(opts),
  getStorageSync:         (k)    => base.getStorageSync(k),
  setStorageSync:         (k, v) => base.setStorageSync(k, v),
  removeStorageSync:      (k)    => base.removeStorageSync(k),
  clearStorageSync:       ()     => base.clearStorageSync(),
  showToast:              (opts) => base.showToast(opts),
  reLaunch:               (opts) => base.reLaunch(opts),
  restartMiniProgram:     typeof base.restartMiniProgram === 'function'
    ? (opts) => base.restartMiniProgram(opts)
    : (opts) => base.reLaunch({ url: '/', ...opts }),
  createInnerAudioContext:()     => base.createInnerAudioContext(),
  onTouchStart:           (cb)   => base.onTouchStart(cb),
  onTouchMove:            (cb)   => base.onTouchMove(cb),
  onTouchEnd:             (cb)   => base.onTouchEnd(cb),
  request:                (opts) => base.request(opts),
  login:                  (opts) => base.login(opts),
  onShow:                 typeof base.onShow === 'function' ? (cb) => base.onShow(cb) : _noop,
  checkScene:             typeof base.checkScene === 'function' ? (opts) => base.checkScene(opts) : (opts) => { if (opts && opts.fail) opts.fail() },
  navigateToScene:        typeof base.navigateToScene === 'function' ? (opts) => base.navigateToScene(opts) : (opts) => { if (opts && opts.fail) opts.fail({ errMsg: 'not supported' }) },

  // ========== 第二层：轻度适配 ==========
  shareAppMessage:  (opts) => base.shareAppMessage(opts),
  showShareMenu:    (opts) => base.showShareMenu(opts),
  onShareAppMessage:(cb)   => base.onShareAppMessage(cb),

  // ========== 第三层：平台独占，降级处理 ==========

  // 反馈按钮（仅微信有）
  createFeedbackButton: isWeChat
    ? (opts) => base.createFeedbackButton(opts)
    : () => null,

  // 用户信息授权按钮（仅微信有，抖音授权流程不同）
  createUserInfoButton: isWeChat
    ? (opts) => base.createUserInfoButton(opts)
    : () => null,

  // 设置与授权
  getSetting: isWeChat
    ? (opts) => base.getSetting(opts)
    : (opts) => { if (opts && opts.success) opts.success({ authSetting: {} }) },
  openSetting: isWeChat
    ? (opts) => base.openSetting(opts)
    : (opts) => { if (opts && opts.fail) opts.fail() },
  getUserInfo: (opts) => base.getUserInfo(opts),

  // ========== 云能力（第一阶段：微信用 wx.cloud，抖音用 mock） ==========
  cloud: isWeChat ? base.cloud : _mockCloud,

  // ========== 广告能力 ==========

  createRewardedVideoAd: base && typeof base.createRewardedVideoAd === 'function'
    ? (opts) => base.createRewardedVideoAd(opts)
    : () => null,

  createCustomAd: base && typeof base.createCustomAd === 'function'
    ? (opts) => base.createCustomAd(opts)
    : () => null,

  // ========== 游戏圈 ==========

  createGameClubButton: base && typeof base.createGameClubButton === 'function'
    ? (opts) => base.createGameClubButton(opts)
    : () => null,

  /**
   * 打开游戏圈等内置页（基础库 ≥3.6.7），无原生按钮即可跳转
   * @param {string} openlink MP 后台游戏圈提供的 openlink
   * @returns {Promise<void>}
   */
  openGameClubPage(openlink) {
    if (!isWeChat || !openlink) {
      return Promise.reject(new Error('openGameClubPage: 非微信或未配置 openlink'))
    }
    if (typeof base.createPageManager !== 'function') {
      return Promise.reject(new Error('openGameClubPage: 基础库不支持 createPageManager'))
    }
    const pageManager = base.createPageManager()
    const ret = pageManager.load({ openlink })
    if (!ret || typeof ret.then !== 'function') {
      return Promise.reject(new Error('openGameClubPage: load 未返回 Promise'))
    }
    return ret.then((res) => {
      try { pageManager.show() } catch (e) { /* ignore */ }
      return res
    })
  },

  /**
   * 统一游戏内 Toast 提醒（简洁半透明遮罩 + 白字）
   * 所有场景的短提示统一使用此方法，保持风格一致
   * @param {string} msg - 提示文字
   * @param {number} [duration=2000] - 显示时长(ms)
   */
  showGameToast(msg, duration) {
    base.showToast({ title: msg, icon: 'none', duration: duration || 2000 })
  },
}

module.exports = platform
