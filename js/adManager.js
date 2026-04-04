/**
 * 广告管理器 — 灵宠消消塔
 * 统一管理激励视频 / 原生模板广告的生命周期、频控、降级
 */
const P = require('./platform')
const { AD_REWARDS } = require('./data/economyConfig')

let _storage = null
const _rvInstances = {}
const _customInstances = {}
let _inited = false

function _today() {
  return new Date().toISOString().slice(0, 10)
}

function _getLog(slotId) {
  if (!_storage) return { date: '', count: 0 }
  const d = _storage._d
  if (!d.adWatchLog) d.adWatchLog = {}
  const entry = d.adWatchLog[slotId]
  if (!entry || entry.date !== _today()) return { date: _today(), count: 0 }
  return entry
}

function _incLog(slotId) {
  if (!_storage) return
  const d = _storage._d
  if (!d.adWatchLog) d.adWatchLog = {}
  const today = _today()
  if (!d.adWatchLog[slotId] || d.adWatchLog[slotId].date !== today) {
    d.adWatchLog[slotId] = { date: today, count: 0 }
  }
  d.adWatchLog[slotId].count++
  _storage._save()
}

let _isDevTools = false
try {
  const sysInfo = (typeof wx !== 'undefined' && wx.getSystemInfoSync) ? wx.getSystemInfoSync() : null
  if (sysInfo && sysInfo.platform === 'devtools') _isDevTools = true
} catch(e) {}

function _createRV(adUnitId) {
  if (_rvInstances[adUnitId]) return _rvInstances[adUnitId]
  if (_isDevTools) {
    console.log('[Ad] 开发者工具环境，模拟激励视频实例:', adUnitId.slice(-6))
    const mock = _createDevToolsMock(adUnitId)
    _rvInstances[adUnitId] = mock
    return mock
  }
  try {
    const ad = P.createRewardedVideoAd({ adUnitId })
    if (!ad) return null
    ad.onLoad(() => { console.log('[Ad] 激励视频加载成功:', adUnitId.slice(-6)) })
    ad.onError((err) => { console.warn('[Ad] 激励视频错误:', adUnitId.slice(-6), err) })
    _rvInstances[adUnitId] = ad
    return ad
  } catch(e) {
    console.warn('[Ad] createRewardedVideoAd 异常:', e)
    return null
  }
}

function _createDevToolsMock(adUnitId) {
  let _closeCb = null
  return {
    onLoad() {},
    onError() {},
    onClose(cb) { _closeCb = cb },
    offClose() { _closeCb = null },
    show() {
      console.log('[Ad][DevTools] 模拟展示激励视频:', adUnitId.slice(-6))
      return new Promise((resolve) => {
        setTimeout(() => {
          if (_closeCb) { _closeCb({ isEnded: true }); _closeCb = null }
          resolve()
        }, 500)
      })
    },
    load() { return Promise.resolve() },
  }
}

const AdManager = {
  /**
   * 游戏启动时调用，仅保存 storage 引用。
   * 广告实例采用懒加载：首次 show 时才 createRewardedVideoAd，
   * 避免启动阶段原生视图树未就绪导致 insertTextView/updateTextView 报错。
   */
  init(storage) {
    if (_inited) return
    _inited = true
    _storage = storage
    console.log('[Ad] AdManager 初始化完成（懒加载模式）')
  },

  /**
   * 检查指定广告位是否可以展示
   */
  canShow(slotId) {
    const cfg = AD_REWARDS[slotId]
    if (!cfg || !cfg.enabled || !cfg.adUnitId) return false
    if (cfg.dailyLimit && cfg.dailyLimit > 0) {
      const log = _getLog(slotId)
      if (log.count >= cfg.dailyLimit) return false
    }
    return true
  },

  getTodayCount(slotId) {
    return _getLog(slotId).count
  },

  getDailyLimit(slotId) {
    const cfg = AD_REWARDS[slotId]
    return (cfg && cfg.dailyLimit) || -1
  },

  /**
   * 展示激励视频广告
   * @param {string} slotId - AD_REWARDS 中的 key
   * @param {object} callbacks
   *   onRewarded()  — 完整观看
   *   onSkipped()   — 中途关闭
   *   onError(err)  — 加载/播放失败
   *   fallbackToShare — 失败时是否降级到分享
   */
  /**
   * 体力不足时弹出 Canvas 内确认框（勿用 wx.showModal，部分基础库会报 updateTextView:fail）
   * @returns {boolean} 是否已弹出可看广告恢复的对话框
   */
  openStaminaRecoveryConfirm(g) {
    if (!this.canShow('staminaRecovery')) return false
    g._confirmDialog = {
      title: '体力不足',
      content: '观看广告可恢复30点体力',
      confirmText: '看广告',
      cancelText: '取消',
      timer: 0,
      onConfirm: () => {
        this.showRewardedVideo('staminaRecovery', {
          onRewarded: () => {
            g.storage._recoverStamina()
            g.storage._d.stamina.current = Math.min(g.storage.maxStamina, g.storage._d.stamina.current + 30)
            g.storage._save()
            P.showGameToast('体力恢复+30')
            g._dirty = true
          },
        })
      },
      onCancel: () => {},
    }
    g._dirty = true
    return true
  },

  showRewardedVideo(slotId, callbacks = {}) {
    const cfg = AD_REWARDS[slotId]
    if (!cfg || !cfg.enabled || !cfg.adUnitId) {
      console.warn('[Ad] 广告位未配置:', slotId)
      if (callbacks.onError) callbacks.onError({ errMsg: 'slot_not_configured' })
      return
    }
    if (!this.canShow(slotId)) {
      P.showGameToast('今日观看次数已用完，明日再来')
      if (callbacks.onSkipped) callbacks.onSkipped()
      return
    }
    const ad = _createRV(cfg.adUnitId)
    if (!ad) {
      console.warn('[Ad] 激励视频实例不可用，平台不支持')
      if (callbacks.onError) callbacks.onError({ errMsg: 'platform_not_supported' })
      return
    }

    const _onClose = (res) => {
      ad.offClose(_onClose)
      const ended = !!(res && res.isEnded)
      if (ended) {
        _incLog(slotId)
        if (callbacks.onRewarded) callbacks.onRewarded()
      } else {
        if (callbacks.onSkipped) callbacks.onSkipped()
      }
    }
    ad.onClose(_onClose)

    ad.show().catch(() => {
      ad.load().then(() => ad.show()).catch((err) => {
        ad.offClose(_onClose)
        console.warn('[Ad] 激励视频展示失败:', err)
        P.showGameToast('广告加载失败，请稍后再试')
        if (callbacks.onError) callbacks.onError(err)
      })
    })
  },

  /**
   * 展示原生模板广告
   */
  showCustomAd(slotId, style) {
    const cfg = AD_REWARDS[slotId]
    if (!cfg || !cfg.enabled || !cfg.adUnitId) return null
    const key = cfg.adUnitId
    if (_customInstances[key]) {
      _customInstances[key].show()
      return _customInstances[key]
    }
    const ad = P.createCustomAd({ adUnitId: cfg.adUnitId, style: style || {} })
    if (!ad) return null
    ad.onLoad(() => { ad.show() })
    ad.onError((err) => { console.warn('[Ad] 原生广告错误:', err) })
    _customInstances[key] = ad
    return ad
  },

  hideCustomAd(slotId) {
    const cfg = AD_REWARDS[slotId]
    if (!cfg || !cfg.adUnitId) return
    const ad = _customInstances[cfg.adUnitId]
    if (ad) ad.hide()
  },

  destroyCustomAd(slotId) {
    const cfg = AD_REWARDS[slotId]
    if (!cfg || !cfg.adUnitId) return
    const key = cfg.adUnitId
    const ad = _customInstances[key]
    if (ad) { ad.destroy(); delete _customInstances[key] }
  },
}

module.exports = AdManager
