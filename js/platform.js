/**
 * 平台适配层 — 灵宠消消塔
 * 统一 wx / tt 差异，游戏代码只通过此模块访问平台能力
 */

const isDouyin = typeof tt !== 'undefined'
const isWeChat = !isDouyin && typeof wx !== 'undefined'
const base = isDouyin ? tt : wx

function _detectOHOS() {
  try {
    const dev = base && typeof base.getDeviceInfo === 'function' ? base.getDeviceInfo() : null
    if (dev && (dev.platform === 'ohos' || dev.system === 'HarmonyOS')) return true
  } catch (_e) {}
  try {
    const sys = base && base.getSystemInfoSync ? base.getSystemInfoSync() : null
    if (sys && (sys.platform === 'ohos' || sys.system === 'HarmonyOS')) return true
  } catch (_e) {}
  return false
}

const _isOHOS = _detectOHOS()

function _detectDevTools() {
  try {
    const sys = base && base.getSystemInfoSync ? base.getSystemInfoSync() : null
    if (sys && sys.platform === 'devtools') return true
  } catch (_e) {}
  return false
}

const _isDevTools = _detectDevTools()

const _noop = () => {}

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
  isDevTools: _isDevTools,
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
  downloadFile:           typeof base.downloadFile === 'function' ? (opts) => base.downloadFile(opts) : null,
  login:                  (opts) => base.login(opts),
  onShow:                 typeof base.onShow === 'function' ? (cb) => base.onShow(cb) : _noop,
  onHide:                 typeof base.onHide === 'function' ? (cb) => base.onHide(cb) : _noop,
  /** 微信基础库内存告警（抖音等平台无则空实现） */
  onMemoryWarning:        typeof base.onMemoryWarning === 'function' ? (cb) => base.onMemoryWarning(cb) : _noop,
  checkScene:             typeof base.checkScene === 'function' ? (opts) => base.checkScene(opts) : (opts) => { if (opts && opts.fail) opts.fail() },
  navigateToScene:        typeof base.navigateToScene === 'function' ? (opts) => base.navigateToScene(opts) : (opts) => { if (opts && opts.fail) opts.fail({ errMsg: 'not supported' }) },

  // ========== 第二层：轻度适配 ==========
  shareAppMessage:  (opts) => base.shareAppMessage(opts),
  showShareMenu:    (opts) => base.showShareMenu(opts),
  onShareAppMessage:(cb)   => base.onShareAppMessage(cb),
  // 朋友圈分享（微信独有，抖音无对应能力静默 noop）
  //   - shareTimeline：调起朋友圈分享面板；微信基础库 ≥ 2.11.3 支持
  //   - onShareTimeline：朋友圈被动分享回调注册
  shareTimeline: isWeChat && typeof base.shareTimeline === 'function'
    ? (opts) => base.shareTimeline(opts)
    : _noop,
  onShareTimeline: isWeChat && typeof base.onShareTimeline === 'function'
    ? (cb) => base.onShareTimeline(cb)
    : _noop,
  // 朋友圈能力探测（UI 用来决定"发朋友圈"按钮是否显示）
  hasShareTimeline: isWeChat && typeof base.shareTimeline === 'function',

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

  // ========== 广告能力 ==========

  createRewardedVideoAd: base && typeof base.createRewardedVideoAd === 'function'
    ? (opts) => base.createRewardedVideoAd(opts)
    : () => null,

  createCustomAd: base && typeof base.createCustomAd === 'function'
    ? (opts) => base.createCustomAd(opts)
    : () => null,

  // ========== 游戏圈 ==========

  // createGameClubButton 在鸿蒙微信也支持（官方文档明确标注），保留原生按钮跳转游戏圈首页能力
  createGameClubButton: base && typeof base.createGameClubButton === 'function'
    ? (opts) => base.createGameClubButton(opts)
    : () => null,

  /**
   * 鸿蒙 / 开发者工具目前不支持 wx.createPageManager（调用返回 -3），
   * 因此 openlink 形式的游戏圈/福利页跳转在这些环境不可用，需要降级到原生 GameClubButton。
   */
  canOpenGameClubByOpenlink() {
    return isWeChat && !_isOHOS && !_isDevTools && typeof base.createPageManager === 'function'
  },

  /**
   * 打开游戏圈等内置页（基础库 ≥3.6.7），无原生按钮即可跳转
   * @param {string} openlink MP 后台游戏圈提供的 openlink
   * @returns {Promise<void>}
   */
  _openPageByOpenlink(openlink, label) {
    if (!isWeChat || !openlink) {
      return Promise.reject(new Error(`${label}: 非微信或未配置 openlink`))
    }
    if (_isOHOS) {
      return Promise.reject(new Error(`${label}: 鸿蒙微信暂不支持游戏圈跳转`))
    }
    if (_isDevTools) {
      return Promise.reject(new Error(`${label}: 开发者工具不支持 PageManager，请用真机预览`))
    }
    if (typeof base.createPageManager !== 'function') {
      return Promise.reject(new Error(`${label}: 基础库不支持 createPageManager`))
    }
    const pageManager = base.createPageManager()
    const ret = pageManager.load({ openlink })
    if (!ret || typeof ret.then !== 'function') {
      return Promise.reject(new Error(`${label}: load 未返回 Promise`))
    }
    return ret.then((res) => {
      try { pageManager.show() } catch (e) { /* ignore */ }
      return res
    })
  },

  openGameClubPage(openlink) {
    return this._openPageByOpenlink(openlink, 'openGameClubPage')
  },

  openGiftPage(openlink) {
    return this._openPageByOpenlink(openlink, 'openGiftPage')
  },

  /**
   * 统一游戏内 Toast 提醒
   * - 画布就绪时：走自绘组件（游戏风格，支持 text/resource/warn/achievement）
   * - 否则：降级到原生 wx.showToast（启动早期 / 非游戏上下文使用）
   * @param {string} msg - 提示文字
   * @param {number|object} [durationOrOpts]
   *   - 传数字：兼容旧签名，仅设置 duration (ms)
   *   - 传对象：{ type, icon, duration }
   *     type: 'text'(默认) | 'resource' | 'warn' | 'achievement'
   */
  showGameToast(msg, durationOrOpts) {
    let opts = {}
    if (typeof durationOrOpts === 'number') opts = { duration: durationOrOpts }
    else if (durationOrOpts && typeof durationOrOpts === 'object') opts = durationOrOpts

    try {
      const env = require('./views/env')
      if (env && env.ctx && env.W && env.H) {
        const gameToast = require('./views/gameToast')
        gameToast.show(msg, opts)
        return
      }
    } catch (_e) { /* ignore，降级原生 */ }

    base.showToast({ title: msg, icon: 'none', duration: opts.duration || 2000 })
  },
}

module.exports = platform
