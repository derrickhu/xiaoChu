/**
 * 平台适配层 — 灵宠消消塔
 * 统一 wx / tt 差异，游戏代码只通过此模块访问平台能力
 */

const isDouyin = typeof tt !== 'undefined'
const isWeChat = !isDouyin && typeof wx !== 'undefined'
const base = isDouyin ? tt : wx

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
  createInnerAudioContext:()     => base.createInnerAudioContext(),
  onTouchStart:           (cb)   => base.onTouchStart(cb),
  onTouchMove:            (cb)   => base.onTouchMove(cb),
  onTouchEnd:             (cb)   => base.onTouchEnd(cb),
  request:                (opts) => base.request(opts),
  login:                  (opts) => base.login(opts),

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
  getUserInfo: isWeChat
    ? (opts) => base.getUserInfo(opts)
    : (opts) => { if (opts && opts.fail) opts.fail() },

  // 抖音专属：获取用户信息（必须在 tap 事件中调用）
  getUserProfile: isDouyin && typeof base.getUserProfile === 'function'
    ? (opts) => base.getUserProfile(opts)
    : null,

  // ========== 云能力（第一阶段：微信用 wx.cloud，抖音用 mock） ==========
  cloud: isWeChat ? base.cloud : _mockCloud,
}

module.exports = platform
