/**
 * 触摸处理：首页 (title) 场景
 */
const P = require('../platform')
const MusicMgr = require('../runtime/music')
const runMgr = require('../engine/runManager')

// ===== 开发者调试：左上角快速点击 5 次触发重置 =====
let _devTapCount = 0
let _devTapLastTime = 0

function _checkDevReset(g, x, y) {
  const V = require('../views/env')
  const hitSize = 55 * V.S
  if (x > hitSize || y > hitSize) return
  const now = Date.now()
  if (now - _devTapLastTime > 1500) _devTapCount = 0
  _devTapLastTime = now
  _devTapCount++
  if (_devTapCount >= 5) {
    _devTapCount = 0
    g._showDevResetDialog = true
    g._dirty = true
  }
}

function tTitle(g, type, x, y) {
  if (type !== 'end') return

  // ⓪ 开发者重置弹窗（最高优先级）
  if (g._showDevResetDialog) {
    if (g._devResetConfirmRect && g._hitRect(x, y, ...g._devResetConfirmRect)) {
      P.clearStorageSync()
      P.showToast({ title: '数据已重置，即将重启', icon: 'success', duration: 1500 })
      setTimeout(() => { P.restartMiniProgram({}) }, 1600)
      g._showDevResetDialog = false
      return
    }
    if (g._devResetCancelRect && g._hitRect(x, y, ...g._devResetCancelRect)) {
      g._showDevResetDialog = false; g._dirty = true; return
    }
    g._showDevResetDialog = false; g._dirty = true
    return
  }

  // ① 侧边栏复访弹窗
  if (g.showSidebarPanel) {
    if (g._sidebarClaimRect && g._hitRect(x, y, ...g._sidebarClaimRect)) {
      const ok = g.storage.claimSidebarReward()
      if (ok) console.log('[Sidebar] 领取侧边栏复访奖励：体力+30')
      g.showSidebarPanel = false
      return
    }
    if (g._sidebarGoRect && g._hitRect(x, y, ...g._sidebarGoRect)) {
      P.navigateToScene({
        scene: 'sidebar',
        success: () => console.log('[Sidebar] navigateToScene success'),
        fail: (e) => console.log('[Sidebar] navigateToScene fail:', JSON.stringify(e))
      })
      g.showSidebarPanel = false
      return
    }
    if (g._sidebarCloseRect && g._hitRect(x, y, ...g._sidebarCloseRect)) {
      g.showSidebarPanel = false
      return
    }
    g.showSidebarPanel = false
    return
  }

  // ① 「更多」面板（最高优先级）
  if (g.showMorePanel) {
    const panelY = g._morePanelY
    if (panelY && y < panelY) { g.showMorePanel = false; return }
    const rects = g._morePanelRects || {}
    if (rects.sfx && g._hitRect(x, y, ...rects.sfx)) {
      g.storage.toggleSfx(); MusicMgr.toggleSfx(); return
    }
    if (rects.bgm && g._hitRect(x, y, ...rects.bgm)) {
      g.storage.toggleBgm(); MusicMgr.toggleBgm(); return
    }
    return
  }

  // ② 开始/继续确认弹窗
  if (g.showTitleStartDialog) {
    const hasSave = g.storage.hasSavedRun()
    if (hasSave) {
      if (g._dialogContinueRect && g._hitRect(x, y, ...g._dialogContinueRect)) {
        g.showTitleStartDialog = false; g._resumeRun(); return
      }
      if (g._dialogStartRect && g._hitRect(x, y, ...g._dialogStartRect)) {
        g.showTitleStartDialog = false
        const saved = g.storage.loadRunState()
        if (saved) {
          g.floor = saved.floor; g.cleared = false
          g.runExp = saved.runExp || 0
          g._runElimExp = saved._runElimExp || 0
          g._runComboExp = saved._runComboExp || 0
          g._runKillExp = saved._runKillExp || 0
          runMgr.settleExp(g)
        }
        g.storage.clearRunState(); g._startRun(); return
      }
    } else {
      if (g._dialogCancelRect && g._hitRect(x, y, ...g._dialogCancelRect)) {
        g.showTitleStartDialog = false; return
      }
      if (g._dialogStartRect && g._hitRect(x, y, ...g._dialogStartRect)) {
        g.showTitleStartDialog = false; g._startRun(); return
      }
    }
    g.showTitleStartDialog = false; return
  }

  // ③ 新挑战确认弹窗
  if (g.showNewRunConfirm) {
    if (g._newRunConfirmRect && g._hitRect(x,y,...g._newRunConfirmRect)) {
      g.showNewRunConfirm = false
      const _saved = g.storage.loadRunState()
      if (_saved) {
        g.floor = _saved.floor; g.cleared = false
        g.runExp = _saved.runExp || 0
        g._runElimExp = _saved._runElimExp || 0
        g._runComboExp = _saved._runComboExp || 0
        g._runKillExp = _saved._runKillExp || 0
        runMgr.settleExp(g)
      }
      g.storage.clearRunState(); g._startRun(); return
    }
    if (g._newRunCancelRect && g._hitRect(x,y,...g._newRunCancelRect)) {
      g.showNewRunConfirm = false; return
    }
    return
  }

  // ④ 开始按钮
  if (g._startBtnRect && g._hitRect(x, y, ...g._startBtnRect)) {
    if ((g.titleMode || 'tower') === 'stage') {
      const { resetScroll } = require('../views/stageSelectView')
      resetScroll()
      g.setScene('stageSelect')
      return
    }
    g.showNewRunConfirm = false
    g.showTitleStartDialog = true; return
  }

  // ⑤ 左下角模式切换浮钮
  if (g._modeSwitchRect && g._hitRect(x,y,...g._modeSwitchRect)) {
    g.titleMode = g.titleMode === 'tower' ? 'stage' : 'tower'; return
  }

  // ⑤b 宝箱浮钮
  if (g._chestBtnRect && g._hitRect(x, y, ...g._chestBtnRect)) {
    g._chestPressTime = Date.now()  // 动画始终触发
    const chestView = require('../views/chestView')
    chestView.initChestQueue(g)
    if (chestView.hasMore()) {
      MusicMgr.playChestOpen()      // 只有有奖励时才播音效
      g.showChestPanel = true
    }
    return
  }

  // ⑤c 右下角侧边栏复访入口（抖音专属）
  if (g._sidebarBtnRect && g._hitRect(x, y, ...g._sidebarBtnRect)) {
    g.showSidebarPanel = true; return
  }

  // ⑥ 底部 7 标签导航
  const barRects = g._bottomBarRects || []
  for (let i = 0; i < barRects.length; i++) {
    if (!g._hitRect(x, y, ...barRects[i])) continue
    switch (i) {
      case 0: {
        const cv = require('../views/cultivationView')
        cv.resetScroll()
        g.setScene('cultivation')
        cv.checkRealmBreak(g)
        return
      }
      case 1: {
        const firstRunDone1 = g.storage.totalRuns >= 1
        if (firstRunDone1 && g.storage.petPoolCount > 0) {
          g._petPoolFilter = 'all'
          g._petPoolScroll = 0
          g._petPoolDetail = null
          g.setScene('petPool')
        }
        return
      }
      case 2: {
        const firstRunDone2 = g.storage.totalRuns >= 1
        if (firstRunDone2) { g._dexScrollY = 0; g.setScene('dex') }
        return
      }
      case 3: g.titleMode = 'tower'; return
      case 4:
        if (!g.storage.userAuthorized && g.storage._userInfoBtn) return
        g._openRanking(); return
      case 5: g.setScene('stats'); return
      case 6: g.showMorePanel = true; return
    }
  }

  // 左上角隐藏区域：5 次快速点击触发开发者重置
  _checkDevReset(g, x, y)
}

module.exports = tTitle
