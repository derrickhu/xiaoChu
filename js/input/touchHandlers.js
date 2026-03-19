/**
 * 触摸/输入处理：各场景的触摸事件分发
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')

const tTitle = require('./tTitle')
const tPrepare = require('./tPrepare')
const tEvent = require('./tEvent')
const tBattle = require('./tBattle')

function tReward(g, type, x, y) {
  if (type !== 'end') return
  // 宠物获得/升星弹窗：点击关闭后进入下一层
  if (g._petObtainedPopup) {
    g._petObtainedPopup = null
    g._nextFloor()
    return
  }
  // ★3满星庆祝画面：点击关闭后检查待显示弹窗（入池 / 碎片）
  if (g._star3Celebration && g._star3Celebration.phase === 'ready') {
    g._star3Celebration = null
    if (g._pendingPoolEntry) { g._petPoolEntryPopup = g._pendingPoolEntry; g._pendingPoolEntry = null; return }
    if (g._fragmentObtainedPopup) return
    g._nextFloor()
    return
  }
  if (g._star3Celebration) return
  // 灵宠入池 / 碎片获得弹窗
  if (g._petPoolEntryPopup) { g._petPoolEntryPopup = null; g._nextFloor(); return }
  if (g._fragmentObtainedPopup) { g._fragmentObtainedPopup = null; g._nextFloor(); return }
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._rewardRects) {
    for (let i = 0; i < g._rewardRects.length; i++) {
      if (g._hitRect(x,y,...g._rewardRects[i])) { g.selectedReward = i; return }
    }
  }
  if (g._rewardConfirmRect && g.selectedReward >= 0 && g._hitRect(x,y,...g._rewardConfirmRect)) {
    if (g.bState === 'victory') {
      if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm()
      g._restoreBattleHpMax()
      g.heroBuffs = []; g.enemyBuffs = []
    }
    g._applyReward(g.rewards[g.selectedReward])
    if (g._star3Celebration || g._petObtainedPopup || g._petPoolEntryPopup || g._fragmentObtainedPopup) return
    g._nextFloor()
  }
}

function tShop(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (!g.shopUsed && g._shopRects) {
    for (let i = 0; i < g._shopRects.length; i++) {
      if (g._hitRect(x,y,...g._shopRects[i])) {
        g._applyShopItem(g.shopItems[i]); g.shopUsed = true; return
      }
    }
  }
  if (g._shopLeaveRect && g._hitRect(x,y,...g._shopLeaveRect)) { g._nextFloor() }
}

function tRest(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._restRects) {
    for (let i = 0; i < g._restRects.length; i++) {
      if (g._hitRect(x,y,...g._restRects[i])) {
        g._applyRestOption(g.restOpts[i]); g._nextFloor(); return
      }
    }
  }
}

function tAdventure(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._advBtnRect && g._hitRect(x,y,...g._advBtnRect)) { g._nextFloor() }
}

function tGameover(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._goBtnRect && g._hitRect(x,y,...g._goBtnRect)) { g.setScene('title'); return }
  if (g._cultBtnRect && g._hitRect(x,y,...g._cultBtnRect)) {
    const cultView = require('../views/cultivationView')
    cultView.resetScroll()
    g.setScene('cultivation')
    cultView.checkRealmBreak(g)
    return
  }
  if (g._petPoolBtnRect && g._hitRect(x,y,...g._petPoolBtnRect)) {
    g._petPoolFilter = 'all'; g._petPoolScroll = 0; g._petPoolDetail = null
    g.setScene('petPool')
    return
  }
}

function tRanking(g, type, x, y) {
  const { S, H } = V
  const safeTop = V.safeTop
  if (type === 'start') {
    g._rankTouchStartY = y
    g._rankScrollStart = g.rankScrollY || 0
    return
  }
  if (type === 'move') {
    const dy = y - (g._rankTouchStartY || y)
    const tab = g.rankTab || 'all'
    const listMap = { all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const list = g.storage[listMap[tab]] || []
    const rowH = 64*S
    const maxScroll = 0
    const minScroll = -Math.max(0, list.length * rowH - (H - 70*S - safeTop - 130*S))
    g.rankScrollY = Math.max(minScroll, Math.min(maxScroll, g._rankScrollStart + dy))
    return
  }
  if (type !== 'end') return
  const dy = Math.abs(y - (g._rankTouchStartY || y))
  if (dy > 10*S) return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.setScene('title'); return }
  if (g._rankRefreshRect && g._hitRect(x, y, ...g._rankRefreshRect)) { g.storage.fetchRanking(g.rankTab, true); return }
  if (g._rankTabRects) {
    for (const key of ['all', 'dex', 'combo']) {
      const rect = g._rankTabRects[key]
      if (rect && g._hitRect(x, y, ...rect)) {
        g.rankTab = key; g.rankScrollY = 0; g.storage.fetchRanking(key); return
      }
    }
  }
}

function tStats(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.setScene('title'); return }
  if (g._statsShareBtnRect && g._hitRect(x, y, ...g._statsShareBtnRect)) { g._shareStats(); return }
}

function tDex(g, type, x, y) {
  // 图鉴首次介绍卡拦截
  if (g._dexIntroPage != null) {
    if (type === 'end') {
      g._dexIntroPage++
      g._dexIntroAlpha = 0
      if (g._dexIntroPage >= 2) {
        g._dexIntroPage = null
        g.storage.markGuideShown('dex_intro')
      }
      g._dirty = true
    }
    return
  }

  if (g._dexDetailPetId) {
    if (type === 'end') {
      if (g._dexBattleBtnRect) {
        const [bx, by, bw, bh] = g._dexBattleBtnRect
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          const petId = g._dexDetailPetId
          g._dexDetailPetId = null
          g._dexBattleBtnRect = null
          g._designatedPetId = petId
          g._startRun()
          return
        }
      }
      g._dexDetailPetId = null
      g._dexBattleBtnRect = null
    }
    return
  }
  if (type === 'start') {
    g._dexTouchStartY = y
    g._dexScrollStart = g._dexScrollY || 0
    return
  }
  if (type === 'move') {
    const dy = y - (g._dexTouchStartY || y)
    const { drawBottomBar: _, getLayout: getDexLayout } = require('../views/bottomBar')
    const L = getDexLayout()
    const { safeTop } = V
    const contentTop = safeTop + 74 * V.S + 36 * V.S + 6 * V.S
    const contentH = L.bottomBarY - contentTop
    const maxScroll = 0
    const minScroll = -Math.max(0, (g._dexTotalH || 0) - contentH)
    g._dexScrollY = Math.max(minScroll, Math.min(maxScroll, g._dexScrollStart + dy))
    return
  }
  if (type !== 'end') return
  // 底部导航栏处理
  const { getLayout: getDexLayout2, BAR_ITEMS } = require('../views/bottomBar')
  const L2 = getDexLayout2()
  if (y >= L2.bottomBarY) {
    const slotW = V.W / BAR_ITEMS.length
    const idx = Math.floor(x / slotW)
    const item = BAR_ITEMS[idx]
    if (item) {
      if (item.key === 'home') { g.setScene('title'); return }
      if (item.key === 'battle' || item.key === 'stage') { g.setScene('title'); return }
      if (item.key === 'pets') {
        if (g.storage.petPoolCount >= 1) {
          g._petPoolFilter = 'all'; g._petPoolScroll = 0; g._petPoolDetail = null
          g.setScene('petPool')
        }
        return
      }
      if (item.key === 'dex') return  // 已在图鉴
      if (item.key === 'cultivation') { g.setScene('cultivation'); return }
      if (item.key === 'rank') { g.setScene('ranking'); return }
      if (item.key === 'stats') { g.setScene('stats'); return }
      if (item.key === 'idle') { g.setScene('idle'); return }
    }
    return
  }
  const dy = Math.abs(y - (g._dexTouchStartY || y))
  if (dy > 10 * V.S) return
  if (g._dexCellRects) {
    for (const cell of g._dexCellRects) {
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        g._dexDetailPetId = cell.id
        g.storage.markDexSeen(cell.id)
        return
      }
    }
  }
}

module.exports = {
  tTitle, tPrepare, tEvent, tBattle,
  tReward, tShop, tRest, tAdventure, tGameover,
  tRanking, tStats, tDex,
}
