/**
 * 微信平台福利半屏 — PageManager + 固定 openlink + 领取后自动 sync 发奖
 */
const P = require('../platform')
const api = require('../api')
const cloudSync = require('../data/cloudSync')
const { TITLE_HOME } = require('../data/constants')

const SYNC_RETRY_DELAYS_MS = [800, 2000]

let _sessionWelfareShown = false
let _pageManager = null
let _nativeGiftStatus = { hasGift: false, hasFriendGift: false }
let _syncRetryTimers = []

function canUseNativeWelfare() {
  return P.isWeChat && P.canOpenGameClubByOpenlink() && !!TITLE_HOME.giftOpenlink
}

function hasNativeGiftPending() {
  return !!(_nativeGiftStatus.hasGift || _nativeGiftStatus.hasFriendGift)
}

function didAutoShowThisSession() {
  return _sessionWelfareShown
}

function _clearSyncRetryTimers() {
  for (const t of _syncRetryTimers) clearTimeout(t)
  _syncRetryTimers = []
}

function _scheduleSyncRetry(storage) {
  _clearSyncRetryTimers()
  SYNC_RETRY_DELAYS_MS.forEach((delay) => {
    const timer = setTimeout(() => {
      syncAndGrantPendingGifts(storage).catch((e) => {
        console.warn('[PlatformWelfare] sync retry failed', e)
      })
    }, delay)
    _syncRetryTimers.push(timer)
  })
}

function _buildGrantToast(granted) {
  if (!granted || typeof granted !== 'object') return ''
  const parts = []
  if (granted.soulStone) parts.push(`灵石 ×${granted.soulStone}`)
  if (granted.universalFragment) parts.push(`万能碎片 ×${granted.universalFragment}`)
  if (granted.stamina) parts.push(`体力 ×${granted.stamina}`)
  if (granted.awakenStone) parts.push(`觉醒石 ×${granted.awakenStone}`)
  if (!parts.length) return '微信礼包已领取'
  return `微信礼包：${parts.join('、')}`
}

function _showGrantFeedback(g, granted) {
  const msg = _buildGrantToast(granted)
  if (!msg) return
  if (P.showGameToast) {
    P.showGameToast(msg, { type: 'resource' })
  }
  if (g && granted && granted.universalFragment) g._uniFragPulse = { timer: 0 }
}

async function syncAndGrantPendingGifts(storage, opts) {
  const options = opts || {}
  if (!P.isWeChat || !storage) return { granted: false, count: 0 }
  if (!cloudSync.isReady()) return { granted: false, count: 0 }

  try {
    const queryRes = await api.queryPendingGifts()
    const gifts = (queryRes.data && queryRes.data.gifts) || queryRes.gifts || []

    const pendingList = []
    const alreadyGrantedIds = []
    for (const gift of gifts) {
      if (!gift._id) continue
      if (!gift.rewards || typeof gift.rewards !== 'object') continue
      if (storage.isPlatformGiftLocallyGranted && storage.isPlatformGiftLocallyGranted(gift._id)) {
        alreadyGrantedIds.push(gift._id)
        continue
      }
      if (gift.unknownGoods && gift.unknownGoods.length && storage.recordFunnelEvent) {
        storage.recordFunnelEvent('platform_gift_unknown_goods', {
          giftTypeId: gift.giftTypeId || 0,
          giftId: gift.giftId || '',
          count: gift.unknownGoods.length,
        })
      }
      if (Object.keys(gift.rewards).length === 0) {
        if (storage.recordFunnelEvent) {
          storage.recordFunnelEvent('platform_gift_empty', {
            giftTypeId: gift.giftTypeId || 0,
            giftId: gift.giftId || '',
          })
        }
        continue
      }
      pendingList.push({
        id: gift._id,
        giftTypeId: gift.giftTypeId || 0,
        giftId: gift.giftId || '',
        rewards: gift.rewards,
      })
    }

    if (storage.appendPendingPlatformGifts && pendingList.length > 0) {
      storage.appendPendingPlatformGifts(pendingList)
    }

    if (alreadyGrantedIds.length > 0) {
      try {
        await cloudSync.markPlatformGiftsGranted(alreadyGrantedIds)
      } catch (e) {
        console.warn('[PlatformWelfare] 旧礼包云端补标记失败，下次启动再试', e)
      }
    }

    let grantResult = null
    if (storage.hasPendingPlatformGiftClaims && storage.hasPendingPlatformGiftClaims()) {
      grantResult = storage.claimPendingPlatformGifts()
      if (grantResult && grantResult.ids && grantResult.ids.length) {
        try {
          await cloudSync.markPlatformGiftsGranted(grantResult.ids)
        } catch (e) {
          console.warn('[PlatformWelfare] 云端标记已领取失败，下次启动会补偿重试', e)
        }
      }
    }

    const granted = !!(grantResult && grantResult.ids && grantResult.ids.length)
    if (granted) {
      _clearSyncRetryTimers()
      console.log('[PlatformWelfare] 平台礼包已自动入账', grantResult.ids.length, '笔')
    } else if (options.retry && pendingList.length > 0) {
      _scheduleSyncRetry(storage)
    }

    return {
      granted,
      count: granted ? grantResult.ids.length : 0,
      grantedRewards: granted ? grantResult.granted : null,
      pendingQueued: pendingList.length,
    }
  } catch (e) {
    console.warn('[PlatformWelfare] sync grant failed', e)
    if (options.retry) _scheduleSyncRetry(storage)
    return { granted: false, count: 0, error: e }
  }
}

function showNativeWelfarePage(storage, g) {
  if (!canUseNativeWelfare()) {
    return Promise.reject(new Error('native welfare unavailable'))
  }
  if (_pageManager) {
    try { _pageManager.destroy && _pageManager.destroy() } catch (_) {}
    _pageManager = null
  }

  const base = typeof wx !== 'undefined' ? wx : null
  if (!base || typeof base.createPageManager !== 'function') {
    return Promise.reject(new Error('createPageManager unavailable'))
  }

  const pageManager = base.createPageManager()
  _pageManager = pageManager

  pageManager.on('getGiftStatus', (res) => {
    _nativeGiftStatus = {
      hasGift: !!(res && res.hasGift),
      hasFriendGift: !!(res && res.hasFriendGift),
    }
    if (_nativeGiftStatus.hasGift || _nativeGiftStatus.hasFriendGift) {
      console.log('[PlatformWelfare] getGiftStatus', _nativeGiftStatus)
    }
  })

  pageManager.on('destroy', () => {
    _pageManager = null
    _nativeGiftStatus = { hasGift: false, hasFriendGift: false }
    syncAndGrantPendingGifts(storage, { retry: true }).then((result) => {
      if (result.granted && g) _showGrantFeedback(g, result.grantedRewards)
    }).catch((e) => {
      console.warn('[PlatformWelfare] destroy sync failed', e)
    })
  })

  const ret = pageManager.load({ openlink: TITLE_HOME.giftOpenlink })
  if (!ret || typeof ret.then !== 'function') {
    _pageManager = null
    return Promise.reject(new Error('PageManager.load did not return Promise'))
  }

  return ret.then(() => {
    try { pageManager.show() } catch (e) { /* ignore */ }
    if (storage && storage.recordFunnelEvent) {
      storage.recordFunnelEvent('platform_gift_entry_open', { scene: 'native_welfare' })
    }
  }).catch((e) => {
    _pageManager = null
    throw e
  })
}

/** 冷启动进游戏后 auto-show 福利半屏（本次进程只弹一次，不限场景/关卡） */
function tryAutoShowOnLaunch(g, storage) {
  if (_sessionWelfareShown || _pageManager) return false
  if (!canUseNativeWelfare()) return false
  if (!g || !storage) return false

  _sessionWelfareShown = true
  showNativeWelfarePage(storage, g).catch((e) => {
    console.warn('[PlatformWelfare] auto-show failed', e)
    if (P.isDevTools) {
      console.log('[PlatformWelfare] 开发者工具不支持 PageManager，请用真机预览验证福利半屏')
      return
    }
    if (P.showGameToast) {
      P.showGameToast('无法打开福利页，请从右上角 ··· → 福利 领取', { type: 'warn' })
    }
  })
  return true
}

/** 游戏圈入口：打开 MP 配置的游戏圈帖子（不是 MP 礼包半屏） */
function openGameClubEntry() {
  if (!P.isWeChat || !TITLE_HOME.gameClubOpenlink) {
    return Promise.reject(new Error('game club openlink unavailable'))
  }
  if (P.canOpenGameClubByOpenlink()) {
    return P.openGameClubPage(TITLE_HOME.gameClubOpenlink)
  }
  // 开发者工具 / 鸿蒙：由原生 GameClubButton 承接，Canvas 不应重复跳转
  return Promise.resolve()
}

function syncAndGrantWithFeedback(g, storage, opts) {
  return syncAndGrantPendingGifts(storage, opts).then((result) => {
    if (result.granted && g) _showGrantFeedback(g, result.grantedRewards)
    return result
  })
}

module.exports = {
  canUseNativeWelfare,
  hasNativeGiftPending,
  didAutoShowThisSession,
  showNativeWelfarePage,
  openGameClubEntry,
  tryAutoShowOnLaunch,
  syncAndGrantPendingGifts,
  syncAndGrantWithFeedback,
}
