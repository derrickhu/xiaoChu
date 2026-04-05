/**
 * 广告管理器 — 灵宠消消塔
 * 统一管理激励视频 / 原生模板广告的生命周期、频控、降级
 * 鸿蒙(ohos)广告填充率低 → 自动降级为分享领奖
 */
const P = require('./platform')
const { AD_REWARDS } = require('./data/economyConfig')

let _storage = null
let _gameRef = null
const _rvInstances = {}
const _customInstances = {}
let _inited = false

const _adReady = {}
let _adShowFailed = false

function _today() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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
    _adReady[adUnitId] = true
    return mock
  }
  try {
    const ad = P.createRewardedVideoAd({ adUnitId })
    if (!ad) return null
    ad.onLoad(() => {
      _adReady[adUnitId] = true
      console.log('[Ad] 激励视频加载成功:', adUnitId.slice(-6))
    })
    ad.onError((err) => {
      _adReady[adUnitId] = false
      console.warn('[Ad] 激励视频错误:', adUnitId.slice(-6), err)
    })
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

function _maybeRewardPopup(callbacks) {
  let pop = callbacks.rewardPopup
  if (typeof pop === 'function') {
    try {
      pop = pop()
    } catch (e) {
      console.warn('[Ad] rewardPopup', e)
      pop = null
    }
  }
  if (!pop || !pop.lines || !Array.isArray(pop.lines) || pop.lines.length === 0) return
  const g = _gameRef
  if (!g) return
  const { showAdRewardPopup } = require('./views/adRewardPopup')
  showAdRewardPopup(g, pop)
}

function _doShareFallback(slotId, callbacks) {
  const { doShare } = require('./share')
  console.log('[Ad] 广告不可用，降级为分享:', slotId)
  P.showGameToast('分享成功即可领取奖励')
  doShare(_gameRef, 'passive', {})
  _incLog(slotId)
  if (callbacks.onRewarded) callbacks.onRewarded()
  _maybeRewardPopup(callbacks)
}

const AdManager = {
  /**
   * 游戏启动时调用，仅保存 storage 引用。
   * 广告实例采用懒加载：首次 show 时才 createRewardedVideoAd，
   * 避免启动阶段原生视图树未就绪导致 insertTextView/updateTextView 报错。
   */
  init(storage, gameRef) {
    if (_inited) return
    _inited = true
    _storage = storage
    _gameRef = gameRef || null
    console.log('[Ad] AdManager 初始化完成（懒加载模式）')
    if (P.isOHOS) console.log('[Ad] 检测到鸿蒙平台，广告降级策略已启用')
  },

  setGameRef(g) { _gameRef = g },

  /**
   * 检查指定广告位是否可以展示（含分享降级场景）
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

  /**
   * 广告是否真正就绪（已加载且未出错）
   * UI 层可用此方法决定显示"看广告"还是"分享"按钮文案
   */
  isAdReady(slotId) {
    const cfg = AD_REWARDS[slotId]
    if (!cfg || !cfg.adUnitId) return false
    if (_isDevTools) return true
    if (_adShowFailed && P.isOHOS) return false
    return !!_adReady[cfg.adUnitId]
  },

  /** 曾有广告展示失败记录（鸿蒙降级参考） */
  hasAdShowFailed() { return _adShowFailed },

  getTodayCount(slotId) {
    return _getLog(slotId).count
  },

  getDailyLimit(slotId) {
    const cfg = AD_REWARDS[slotId]
    return (cfg && cfg.dailyLimit) || -1
  },

  /**
   * 体力不足时弹出 Canvas 内确认框（勿用 wx.showModal，部分基础库会报 updateTextView:fail）
   * @returns {boolean} 是否已弹出可看广告恢复的对话框
   */
  openStaminaRecoveryConfirm(g) {
    if (!this.canShow('staminaRecovery')) return false
    const adReady = this.isAdReady('staminaRecovery')
    g._confirmDialog = {
      title: '体力不足',
      content: adReady ? '观看广告可恢复30点体力' : '分享小游戏可恢复30点体力',
      confirmText: adReady ? '看广告' : '去分享',
      cancelText: '取消',
      confirmBtnType: 'adReward',
      timer: 0,
      onConfirm: () => {
        this.showRewardedVideo('staminaRecovery', {
          onRewarded: () => {
            g.storage.addBonusStamina(30)
            g._dirty = true
          },
          fallbackToShare: true,
          rewardPopup: {
            title: '体力已恢复',
            subtitle: '观看广告 / 分享奖励',
            lines: [{ icon: 'icon_stamina', label: '体力', amount: '+30' }],
          },
        })
      },
      onCancel: () => {},
    }
    g._dirty = true
    return true
  },

  /**
   * 展示激励视频广告
   * @param {string} slotId - AD_REWARDS 中的 key
   * @param {object} callbacks
   *   onRewarded()  — 完整观看 / 分享降级后
   *   onSkipped()   — 中途关闭
   *   onError(err)  — 加载/播放失败且无降级
   *   fallbackToShare — 失败时是否降级到分享（鸿蒙默认 true）
   *   rewardPopup — 发放后展示奖励弹窗：{ title, subtitle?, lines } 或 () => 同结构（可无 lines 则跳过）
   */
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

    const shouldFallback = callbacks.fallbackToShare !== undefined
      ? callbacks.fallbackToShare
      : P.isOHOS

    if (P.isOHOS && _adShowFailed) {
      _doShareFallback(slotId, callbacks)
      return
    }

    const ad = _createRV(cfg.adUnitId)
    if (!ad) {
      console.warn('[Ad] 激励视频实例不可用')
      if (shouldFallback) {
        _doShareFallback(slotId, callbacks)
      } else {
        if (callbacks.onError) callbacks.onError({ errMsg: 'platform_not_supported' })
      }
      return
    }

    const _onClose = (res) => {
      ad.offClose(_onClose)
      const ended = !!(res && res.isEnded)
      if (ended) {
        _incLog(slotId)
        if (callbacks.onRewarded) callbacks.onRewarded()
        _maybeRewardPopup(callbacks)
      } else {
        if (callbacks.onSkipped) callbacks.onSkipped()
      }
    }
    ad.onClose(_onClose)

    ad.show().catch(() => {
      ad.load().then(() => ad.show()).catch((err) => {
        ad.offClose(_onClose)
        _adShowFailed = true
        _adReady[cfg.adUnitId] = false
        console.warn('[Ad] 激励视频展示失败:', err)
        if (shouldFallback) {
          _doShareFallback(slotId, callbacks)
        } else {
          P.showGameToast('广告加载失败，请稍后再试')
          if (callbacks.onError) callbacks.onError(err)
        }
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
