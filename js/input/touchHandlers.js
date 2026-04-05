/**
 * 触摸/输入处理：各场景的触摸事件分发
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const { getDexContentTop } = require('../data/constants')
const { hitTestRankingTab } = require('../views/rankingTabHit')
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
  const screens = require('../views/screens')
  const goScroll = screens._goScroll

  const canScroll = goScroll && goScroll.viewport && goScroll.max > 0
  if (canScroll) {
    if (type === 'start') {
      if (g._hitRect(x, y, ...goScroll.viewport)) {
        goScroll.active = true; goScroll.startY = y; goScroll.lastY = y; goScroll.moved = false
      } else {
        goScroll.active = false
      }
      return
    }
    if (type === 'move' && goScroll.active) {
      const dy = y - goScroll.lastY
      goScroll.lastY = y
      if (Math.abs(y - goScroll.startY) > 6 * V.S) goScroll.moved = true
      goScroll.set(goScroll.get() - dy)
      return
    }
    if (type === 'end') {
      if (goScroll.active && goScroll.moved) {
        goScroll.active = false; goScroll.moved = false; return
      }
      goScroll.active = false; goScroll.moved = false
    }
  } else if (type !== 'end') {
    return
  }

  if (type !== 'end') return

  if (g._goAdDoubleBtnRect && g._hitRect(x,y,...g._goAdDoubleBtnRect)) {
    const AdManager = require('../adManager')
    AdManager.showRewardedVideo('settleDouble', {
      fallbackToShare: true,
      onRewarded: function () {
        g._goSettleAdJustGranted = false
        if (g._goAdDoubled) return
        g._goAdDoubled = true
        const sr = g._lastRunSettleRewards
        const bonusSS = sr ? sr.soulStone.final : (g._lastRunSoulStone || 0)
        const bonusFrag = sr ? sr.fragments.final : 0
        if (bonusSS > 0) g.storage.addSoulStone(bonusSS)
        if (bonusFrag > 0 && sr && sr.fragments.details) {
          sr.fragments.details.forEach(function (fd) { g.storage.addFragmentSmart(fd.petId, fd.count) })
        }
        g._goSettleAdJustGranted = bonusSS > 0 || (bonusFrag > 0 && sr && sr.fragments.details && sr.fragments.details.length)
        g._dirty = true
      },
      rewardPopup: function () {
        if (!g._goSettleAdJustGranted) return null
        g._goSettleAdJustGranted = false
        const sr = g._lastRunSettleRewards
        const bonusSS = sr ? sr.soulStone.final : (g._lastRunSoulStone || 0)
        const lines = []
        if (bonusSS > 0) lines.push({ icon: 'icon_soul_stone', label: '灵石', amount: '+' + bonusSS })
        if (sr && sr.fragments && sr.fragments.details && sr.fragments.details.length) {
          const { linesFromFragmentDetails } = require('../views/adRewardPopup')
          lines.push.apply(lines, linesFromFragmentDetails(sr.fragments.details))
        }
        if (!lines.length) return null
        return { title: '通关奖励翻倍', subtitle: '观看广告额外获得', lines }
      },
    })
    return
  }

  if (g._goShareBtnRect && g._hitRect(x,y,...g._goShareBtnRect)) {
    const { doShare } = require('../share')
    doShare(g, 'towerClear', { floor: g.floor })
    return
  }

  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._goHomeBtnRect && g._hitRect(x,y,...g._goHomeBtnRect)) { g._handleBackToTitle(); return }
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
  if (g.rankTab === 'all' || !['stage', 'tower', 'dex', 'combo'].includes(g.rankTab)) {
    g.rankTab = 'tower'
  }
  if (type === 'start') {
    g._rankTouchStartY = y
    g._rankScrollStart = g.rankScrollY || 0
    return
  }
  if (type === 'move') {
    const dy = y - (g._rankTouchStartY || y)
    let tab = g.rankTab || 'stage'
    if (tab === 'all') tab = 'tower'
    const listMap = { stage: 'rankStageList', tower: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const list = g.storage[listMap[tab]] || []
    const rowH = 64*S
    const maxScroll = 0
    const minScroll = -Math.max(0, list.length * rowH - (H - 70*S - safeTop - 130*S))
    g.rankScrollY = Math.max(minScroll, Math.min(maxScroll, g._rankScrollStart + dy))
    return
  }
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.setScene('title'); return }
  if (g._rankRefreshRect && g._hitRect(x, y, ...g._rankRefreshRect)) { g.storage.fetchRanking(g.rankTab, true); return }
  const tabHit = hitTestRankingTab(x, y)
  if (tabHit) {
    if (g.rankTab !== tabHit) {
      g.rankTab = tabHit
      g.rankScrollY = 0
      g._dirty = true
      g.storage.fetchRanking(tabHit)
    }
    return
  }
  const dy = Math.abs(y - (g._rankTouchStartY || y))
  if (dy > 10*S) return
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

  // 详情弹窗拦截
  if (g._dexDetailPetId) {
    if (type === 'end') {
      // 「查看详情」→ 跳转灵宠池详情页
      if (g._dexDetailBtnRect) {
        const [bx, by, bw, bh] = g._dexDetailBtnRect
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          const petId = g._dexDetailPetId
          g._dexDetailPetId = null
          g._dexDetailBtnRect = null
          g._petPoolDetail = petId
          g._petPoolFilter = 'all'; g._petPoolScroll = 0
          g.setScene('petPool')
          return
        }
      }
      if (g._dexAdHintBtnRect) {
        const [bx, by, bw, bh] = g._dexAdHintBtnRect
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          const AdManager = require('../adManager')
          const P = require('../platform')
          if (AdManager.canShow('dexAcquireHint')) {
            const winInfo = P.getWindowInfo()
            AdManager.showCustomAd('dexAcquireHint', {
              left: 10,
              top: winInfo.windowHeight - 120,
              width: winInfo.windowWidth - 20,
            })
          } else {
            P.showGameToast('暂无获取途径信息')
          }
          return
        }
      }
      g._dexDetailPetId = null
      g._dexDetailBtnRect = null
      g._dexAdHintBtnRect = null
    }
    return
  }

  if (type === 'start') {
    g._dexTouchStartY = y
    if (g._dexTab === 'milestone') {
      g._dexMilestoneScrollStart = g._dexMilestoneScrollY || 0
    } else {
      g._dexScrollStart = g._dexScrollY || 0
    }
    return
  }

  if (type === 'move') {
    const delta = y - (g._dexTouchStartY || y)
    const { getLayout: getDexLayout } = require('../views/bottomBar')
    const L = getDexLayout()
    const { safeTop } = V
    const tabBottom = getDexContentTop(safeTop, V.S)
    const contentH = L.bottomBarY - tabBottom

    if (g._dexTab === 'milestone') {
      const maxS = 0
      const minS = -Math.max(0, (g._dexMilestoneTotalH || 0) - contentH)
      g._dexMilestoneScrollY = Math.max(minS, Math.min(maxS, (g._dexMilestoneScrollStart || 0) + delta))
    } else {
      const maxS = 0
      const minS = -Math.max(0, (g._dexTotalH || 0) - contentH)
      g._dexScrollY = Math.max(minS, Math.min(maxS, (g._dexScrollStart || 0) + delta))
    }
    return
  }

  if (type !== 'end') return

  // 底部导航栏
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
      if (item.key === 'dex') return
      if (item.key === 'cultivation') { g.setScene('cultivation'); return }
      if (item.key === 'rank') { g._openRanking(); return }
      if (item.key === 'stats') { g.setScene('stats'); return }
      if (item.key === 'idle') { g.setScene('idle'); return }
    }
    return
  }

  // Tab 栏点击
  if (g._dexTabRects) {
    for (const tab of g._dexTabRects) {
      if (x >= tab.x && x <= tab.x + tab.w && y >= tab.y && y <= tab.y + tab.h) {
        if (g._dexTab !== tab.key) {
          g._dexTab = tab.key
          g._dexScrollY = 0
          g._dexMilestoneScrollY = 0
          g._dirty = true
        }
        return
      }
    }
  }

  // 里程碑领取
  if (g._dexTab === 'milestone' && g._dexMilestoneRects) {
    const dragDy = Math.abs(y - (g._dexTouchStartY || y))
    if (dragDy <= 10 * V.S) {
      for (const mr of g._dexMilestoneRects) {
        if (x >= mr.x && x <= mr.x + mr.w && y >= mr.y && y <= mr.y + mr.h) {
          if (mr.type === 'ad_double') {
            const AdManager = require('../adManager')
            if (AdManager.canShow('dexMilestone')) {
              AdManager.showRewardedVideo('dexMilestone', {
                fallbackToShare: true,
                onRewarded: () => {
                  const { ALL_MILESTONES } = require('../data/dexConfig')
                  const m = ALL_MILESTONES.find(ms => ms.id === mr.milestoneId)
                  if (m && m.reward) {
                    if (m.reward.soulStone) g.storage.addSoulStone(m.reward.soulStone)
                    if (m.reward.awakenStone) g.storage.addAwakenStone(m.reward.awakenStone)
                  }
                  g._dexMilestoneClaimPopup = { milestone: mr.milestoneId, reward: m && m.reward, doubled: true, timer: 0 }
                  g._dirty = true
                },
                rewardPopup: () => {
                  const { ALL_MILESTONES } = require('../data/dexConfig')
                  const { linesFromRewards } = require('../views/adRewardPopup')
                  const m = ALL_MILESTONES.find(ms => ms.id === mr.milestoneId)
                  const lines = linesFromRewards(m && m.reward)
                  if (!lines.length) return null
                  return { title: '图鉴里程碑双倍', subtitle: '广告额外领取一份', lines }
                },
              })
            }
            return
          }
          const result = g.storage.claimDexMilestone(mr.id)
          if (result.success) {
            g._dexMilestoneClaimPopup = { milestone: mr.id, reward: result.reward, buff: result.buff, timer: 0 }
            g._dirty = true
          }
          return
        }
      }
    }
    return
  }

  // 宠物卡片点击
  const dragDy = Math.abs(y - (g._dexTouchStartY || y))
  if (dragDy > 10 * V.S) return
  if (g._dexCellRects) {
    for (const cell of g._dexCellRects) {
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        g._dexDetailPetId = cell.id
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
