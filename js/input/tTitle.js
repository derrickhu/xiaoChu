/**
 * 触摸处理：首页 (title) 场景
 */
const P = require('../platform')
const MusicMgr = require('../runtime/music')
const runMgr = require('../engine/runManager')
const { getBrowsableStages } = require('../data/stages')
const { tDailyReward } = require('../views/dailyRewardView')

const SWIPE_THRESHOLD = 40

function tTitle(g, type, x, y) {
  // ⓪ 每日奖励弹窗
  if (g._showDailyReward) { tDailyReward(g, x, y, type); return }

  // ① 侧边栏复访弹窗
  if (g.showSidebarPanel) {
    if (type !== 'end') return
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
    if (g._bgmVolSlider && (type === 'start' || type === 'move' || type === 'end')) {
      const sl = g._bgmVolSlider
      if (y >= sl.y - 10 && y <= sl.y + sl.h + 10 && x >= sl.sliderX - 20 && x <= sl.sliderX + sl.sliderW + 20) {
        const pct = Math.max(0, Math.min(1, (x - sl.sliderX) / sl.sliderW))
        const vol = Math.round(pct * 100)
        g.storage.setBgmVolume(vol)
        MusicMgr.setBgmVolume(vol / 100)
        return
      }
    }
    if (type !== 'end') return
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

  // ② 秘境模式滑动手势（start/move 阶段需要处理）
  const isStageMode = (g.titleMode || 'tower') === 'stage'
  if (isStageMode && !g.showTitleStartDialog && !g.showNewRunConfirm) {
    if (type === 'start') {
      g._stageSwipeStartX = x
      g._stageSwipeStartY = y
      g._stageSwipeDeltaX = 0
      g._stageSwipeActive = true
      return
    }
    if (type === 'move' && g._stageSwipeActive) {
      g._stageSwipeDeltaX = x - g._stageSwipeStartX
      return
    }
  }

  if (type !== 'end') return

  // 秘境滑动结算
  if (isStageMode && g._stageSwipeActive) {
    g._stageSwipeActive = false
    const dx = x - g._stageSwipeStartX
    const dy = y - g._stageSwipeStartY
    g._stageSwipeDeltaX = 0

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      const list = getBrowsableStages(g.storage.stageClearRecord, g._stageDifficulty || 'normal')
      if (dx < 0 && g._selectedStageIdx < list.length - 1) {
        g._selectedStageIdx++
      } else if (dx > 0 && g._selectedStageIdx > 0) {
        g._selectedStageIdx--
      }
      return
    }
    // 不是滑动 → 继续走点击逻辑
  }

  // ③ 开始/继续确认弹窗（通天塔）
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

  // ④ 新挑战确认弹窗（通天塔）
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

  // ④a 难度 Tab 切换
  if (isStageMode) {
    if (g._diffTabNormalRect && g._hitRect(x, y, ...g._diffTabNormalRect) && g._stageDifficulty !== 'normal') {
      g._stageDifficulty = 'normal'
      g._selectedStageIdx = 0
      g._stageIdxInitialized = false
      g._dirty = true
      return
    }
    if (g._diffTabEliteRect && g._hitRect(x, y, ...g._diffTabEliteRect) && g._stageDifficulty !== 'elite') {
      g._stageDifficulty = 'elite'
      g._selectedStageIdx = 0
      g._stageIdxInitialized = false
      g._dirty = true
      return
    }
  }

  // ④b 秘境左右箭头按钮
  if (isStageMode) {
    if (g._stageArrowLeftRect && g._hitRect(x, y, ...g._stageArrowLeftRect) && g._selectedStageIdx > 0) {
      g._selectedStageIdx--; return
    }
    if (g._stageArrowRightRect && g._hitRect(x, y, ...g._stageArrowRightRect)) {
      const _list = getBrowsableStages(g.storage.stageClearRecord, g._stageDifficulty || 'normal')
      if (g._selectedStageIdx < _list.length - 1) { g._selectedStageIdx++; return }
    }
  }

  // ⑤ 开始按钮
  if (g._startBtnRect && g._hitRect(x, y, ...g._startBtnRect)) {
    if (isStageMode) {
      _handleStageStart(g)
      return
    }
    // 通天塔：灵宠池 >= 5
    if (g.storage.petPoolCount < 5) {
      P.showGameToast(`灵宠池需 ${5 - g.storage.petPoolCount} 只才能挑战通天塔`)
      return
    }
    g.showNewRunConfirm = false
    g.showTitleStartDialog = true; return
  }

  // ⑥ 左侧模式切换浮钮（通天塔 / 灵兽秘境）
  if (g._modeSwitchRect && g._hitRect(x,y,...g._modeSwitchRect)) {
    g.titleMode = g.titleMode === 'tower' ? 'stage' : 'tower'; return
  }

  // ⑥b 右下角侧边栏复访入口（抖音专属）
  if (g._sidebarBtnRect && g._hitRect(x, y, ...g._sidebarBtnRect)) {
    g.showSidebarPanel = true; return
  }

  // ⑥b 每日奖励按钮
  if (g._dailyRewardBtnRect && g._hitRect(x, y, ...g._dailyRewardBtnRect)) {
    g._showDailyReward = true
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  // ⑦ 底部 7 标签导航
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
        if (g.storage.petPoolCount >= 1) {
          g._petPoolFilter = 'all'
          g._petPoolScroll = 0
          g._petPoolDetail = null
          g.setScene('petPool')
        }
        return
      }
      case 2: {
        if (g.storage.petPoolCount >= 1) { g._dexScrollY = 0; g.setScene('dex') }
        return
      }
      case 3: g.titleMode = 'stage'; g.setScene('title'); return
      case 4:
        g._openRanking(); return
      case 5: g.setScene('stats'); return
      case 6: g.showMorePanel = true; return
    }
  }
}

/** 秘境"开始游戏"按钮处理 */
function _handleStageStart(g) {
  const list = getBrowsableStages(g.storage.stageClearRecord, g._stageDifficulty || 'normal')
  const entry = list[g._selectedStageIdx]
  if (!entry || !entry.unlocked) {
    P.showGameToast('该关卡尚未解锁')
    return
  }

  const stage = entry.stage

  // 新手（零宠物）：直接进入 1-1 战斗
  if (g.storage.petPoolCount === 0) {
    const stageMgr = require('../engine/stageManager')
    stageMgr.startStageNewbie(g, stage.id)
    return
  }

  // 新手引导中（1-2/1-3 首次）：自动全员出战，跳过编队页
  const isNewbieAuto = g.storage.petPoolCount >= 1 && g.storage.petPoolCount < 5
    && !g.storage.isStageCleared(stage.id)
    && (stage.id === 'stage_1_2' || stage.id === 'stage_1_3')
  if (isNewbieAuto) {
    const stageMgr = require('../engine/stageManager')
    const teamIds = g.storage.petPool.map(p => p.id)
    stageMgr.startStage(g, stage.id, teamIds)
    return
  }

  // 体力检查（使用 Canvas 确认框，避免 wx.showModal 触发基础库 updateTextView 错误）
  if (stage.staminaCost > 0 && g.storage.currentStamina < stage.staminaCost) {
    const AdManager = require('../adManager')
    if (!AdManager.openStaminaRecoveryConfirm(g)) {
      const { STAMINA_RECOVER_INTERVAL_MS } = require('../data/constants')
      const minutesPerPoint = Math.round(STAMINA_RECOVER_INTERVAL_MS / 60000)
      P.showGameToast(`体力不足，${minutesPerPoint}分钟恢复1点`)
    }
    return
  }

  // 老玩家 → 跳转编队页
  g._selectedStageId = stage.id
  g._stageTeamReturnScene = 'title'
  g.setScene('stageTeam')
}

module.exports = tTitle
