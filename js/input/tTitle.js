/**
 * 触摸处理：首页 (title) 场景
 */
const P = require('../platform')
const MusicMgr = require('../runtime/music')
const runMgr = require('../engine/runManager')
const { getBrowsableStages } = require('../data/stages')
const { tDailySign, tDailyTasks } = require('../views/dailyRewardView')
const { tGMPanel } = require('../views/gmPanelView')

const { TOWER_DAILY } = require('../data/economyConfig')
const { STAGE_FORMATION_MIN_PETS, TITLE_HOME, STAMINA_COST } = require('../data/constants')

const SWIPE_THRESHOLD = 40

function _checkTowerDailyLimit(g) {
  if (g.storage.canStartTowerRunFree()) return true
  const adLeft = Math.max(0, TOWER_DAILY.adExtraRuns - g.storage.getTowerDailyAdRuns())
  if (adLeft > 0) {
    const AdManager = require('../adManager')
    AdManager.showRewardedVideo('towerExtraRun', {
      fallbackToShare: true,
      onRewarded: function () {
        g.storage.recordTowerAdRun()
        g.setScene('towerTeam')
      },
      rewardPopup: {
        title: '挑战次数已补充',
        subtitle: '今日额外通天塔次数 +1',
        lines: [{ icon: 'nav_battle', label: '通天塔', amount: '+1 次' }],
      },
      onSkipped: function () {
        P.showGameToast('需完整观看广告', { type: 'warn' })
      },
      onError: function () {
        P.showGameToast('广告加载失败，请稍后重试', { type: 'warn' })
      },
    })
    return false
  }
  P.showGameToast('今日挑战次数已用完，明日刷新', { type: 'warn' })
  return false
}

function _openHomeDailyTaskPanel(g, target) {
  g._showDailySign = false
  g._showDailyTasks = true
  g._dailyTaskFocusId = target && target.taskId ? target.taskId : null
  g._dailyTaskFocusSection = target && target.section ? target.section : null
}

function _handleHomeDailyTaskClick(g) {
  const target = g._homeDailyTaskTarget || null
  const action = target && target.action ? target.action : 'tasks'
  g._showDailySign = false
  if (action === 'share') {
    const { shareGame } = require('../share')
    g._showDailyTasks = false
    g._dailyTaskFocusId = null
    g._dailyTaskFocusSection = null
    shareGame(g)
    return
  }
  if (action === 'mode' && target && target.mode) {
    g._showDailyTasks = false
    g._dailyTaskFocusId = null
    g._dailyTaskFocusSection = null
    g.titleMode = target.mode
    return
  }
  _openHomeDailyTaskPanel(g, target)
}

function tTitle(g, type, x, y) {
  // ⓪ GM 面板（覆盖在签到弹窗之上，优先处理）
  if (g._showGMPanel) { if (tGMPanel(g, x, y, type)) return }
  // ⓪ 每日任务 / 每日签到弹窗（任务叠在上层时需先处理）
  if (g._showDailyTasks) { tDailyTasks(g, x, y, type); return }
  if (g._showDailySign) { tDailySign(g, x, y, type); return }

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
    if (rects.gm && g._hitRect(x, y, ...rects.gm)) {
      g._showGMPanel = true
      MusicMgr.playClick && MusicMgr.playClick()
      return
    }
    if (rects.helpTour && g._hitRect(x, y, ...rects.helpTour)) {
      g.showMorePanel = false
      const helpTourView = require('../views/helpTourView')
      helpTourView.show(g)
      MusicMgr.playClick && MusicMgr.playClick()
      return
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
        if (!_checkTowerDailyLimit(g)) return
        const saved = g.storage.loadRunState()
        if (saved) {
          g.floor = saved.floor; g.cleared = false
          g.runExp = saved.runExp || 0
          g._runElimExp = saved._runElimExp || 0
          g._runComboExp = saved._runComboExp || 0
          g._runKillExp = saved._runKillExp || 0
          runMgr.settleExp(g)
        }
        g.storage.clearRunState(); g.setScene('towerTeam'); return
      }
    } else {
      if (g._dialogCancelRect && g._hitRect(x, y, ...g._dialogCancelRect)) {
        g.showTitleStartDialog = false; return
      }
      if (g._dialogStartRect && g._hitRect(x, y, ...g._dialogStartRect)) {
        g.showTitleStartDialog = false
        if (!_checkTowerDailyLimit(g)) return
        g.setScene('towerTeam'); return
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

  // ④a 秘境关卡副标题（章节名 · 关卡名 ›）点击 → 章节主线页
  //   · 方案 A 合并版后：原独立 chip 已去掉，副标题并入章节名；命中区由 titleView 写入 g._chapterBandRect
  if (isStageMode && g._chapterBandRect && g._hitRect(x, y, ...g._chapterBandRect)) {
    g.setScene('chapterMap')
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

  // ④b 通天塔「?」重置规则提示
  if (!isStageMode && g._towerHelpRect && g._hitRect(x, y, ...g._towerHelpRect)) {
    P.showGameToast('每日 0 点刷新免费次数与奖励')
    return
  }

  // ④c 本周挑战 SSR 头像 → 宠物详情（未获得时展示与灵宠页一致的成长路线）
  if (!isStageMode && g._towerWeeklySsrAvatarRect && g._towerWeeklySsrPetId
      && g._hitRect(x, y, ...g._towerWeeklySsrAvatarRect)) {
    const petId = g._towerWeeklySsrPetId
    const owned = !!g.storage.getPoolPet(petId)
    g._petDetailId = petId
    g._petDetailUnowned = !owned
    g._petDetailUnownedFullRoadmap = !owned
    g._petDetailReturnScene = 'title'
    g.setScene('petDetail')
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  // ⑤ 开始按钮
  if (g._startBtnRect && g._hitRect(x, y, ...g._startBtnRect)) {
    if (isStageMode) {
      _handleStageStart(g)
      return
    }
    // 通天塔：灵宠池达到编队下限即可（与秘境上阵最少只数一致；≥5 只解锁的是灵兽秘境入口，不是通天塔）
    const minPool = STAGE_FORMATION_MIN_PETS
    const cur = g.storage.petPoolCount
    if (cur < minPool) {
      P.showGameToast(`挑战通天塔需灵宠池至少 ${minPool} 只（当前 ${cur} 只）`, { type: 'warn' })
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

  // ⑥b 每日签到（新手未通 1-1 时隐藏，避免干扰引导）
  if (g._dailySignBtnRect && g.storage.isStageCleared('stage_1_1') && g._hitRect(x, y, ...g._dailySignBtnRect)) {
    g._showDailyTasks = false
    g._showDailySign = true
    g._dailyTaskFocusId = null
    g._dailyTaskFocusSection = null
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  // ⑥b1 首页任务追踪卡（新手未通 1-1 时不响应）
  if (g._homeDailyTaskRect && g.storage.isStageCleared('stage_1_1') && g._hitRect(x, y, ...g._homeDailyTaskRect)) {
    _handleHomeDailyTaskClick(g)
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  // ⑥b2 每日任务（新手未通 1-1 时不响应）
  if (g._dailyTaskBtnRect && g.storage.isStageCleared('stage_1_1') && g._hitRect(x, y, ...g._dailyTaskBtnRect)) {
    g._showDailySign = false
    g._showDailyTasks = true
    g._dailyTaskFocusId = null
    g._dailyTaskFocusSection = null
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  // ⑥c 游戏圈（配置 openlink 时用 PageManager，纯 Canvas 点击、无原生按钮按下灰底）
  if (P.isWeChat && TITLE_HOME.gameClubOpenlink && g._gameClubBtnRect
    && g._hitRect(x, y, ...g._gameClubBtnRect)) {
    P.openGameClubPage(TITLE_HOME.gameClubOpenlink).catch((e) => {
      console.warn('[GameClub] PageManager', e)
      P.showGameToast('无法打开游戏圈，请稍后重试', { type: 'warn' })
    })
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
          g._petPoolRarityFilter = 'all'
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
      case 3:
        // 第 1 章通关前锁定秘境模式，通天塔不可切换
        if (!g.storage.isStageCleared('stage_1_8')) {
          P.showGameToast('通关第 1 章解锁通天塔', { type: 'warn' })
          return
        }
        g.titleMode = (g.titleMode || 'tower') === 'tower' ? 'stage' : 'tower'
        return
      case 4: {
        if ((g.storage.weaponCollection || []).length < 1) return
        g._weaponPoolFilter = 'all'
        g._weaponPoolScroll = 0
        g._weaponPoolDetail = null
        g.setScene('weaponPool')
        return
      }
      case 5:
        g._openRanking(); return
      case 6: g.showMorePanel = true; return
    }
  }
}

/** 秘境"开始游戏"按钮处理 */
function _handleStageStart(g) {
  const list = getBrowsableStages(g.storage.stageClearRecord, g._stageDifficulty || 'normal')
  const entry = list[g._selectedStageIdx]
  if (!entry || !entry.unlocked) {
    P.showGameToast('该关卡尚未解锁', { type: 'warn' })
    return
  }

  const stage = entry.stage
  const staminaNeed = stage.staminaCost ?? STAMINA_COST

  // 新手（零宠物）：直接进入 1-1 战斗（体力与关卡配置一致）
  if (g.storage.petPoolCount === 0) {
    if (staminaNeed > 0 && g.storage.currentStamina < staminaNeed) {
      const AdManager = require('../adManager')
      if (!AdManager.openStaminaRecoveryConfirm(g)) {
        const { STAMINA_RECOVER_INTERVAL_MS } = require('../data/constants')
        const minutesPerPoint = Math.round(STAMINA_RECOVER_INTERVAL_MS / 60000)
        P.showGameToast(`体力不足，${minutesPerPoint}分钟恢复1点`, { type: 'warn' })
      }
      return
    }
    const stageMgr = require('../engine/stageManager')
    if (!stageMgr.startStageNewbie(g, stage.id)) {
      P.showGameToast('开始关卡失败', { type: 'warn' })
    }
    return
  }

  // 新手引导中（1-2/1-3 首次）：自动全员出战，跳过编队页（不依赖 pet 数量：1-1 后可能已五行齐）
  const isNewbieAuto = !g.storage.isGuideShown('newbie_team_ready')
    && !g.storage.isStageCleared(stage.id)
    && (stage.id === 'stage_1_2' || stage.id === 'stage_1_3')
  if (isNewbieAuto) {
    const stageMgr = require('../engine/stageManager')
    const teamIds = g.storage.petPool.map(p => p.id)
    stageMgr.startStage(g, stage.id, teamIds)
    // 延用 1-1 新手盘面：棋盘高亮、属性珠权重倾斜、手指引导
    g._isNewbieStage = true
    return
  }

  // 体力检查（使用 Canvas 确认框，避免 wx.showModal 触发基础库 updateTextView 错误）
  if (staminaNeed > 0 && g.storage.currentStamina < staminaNeed) {
    const AdManager = require('../adManager')
    if (!AdManager.openStaminaRecoveryConfirm(g)) {
      const { STAMINA_RECOVER_INTERVAL_MS } = require('../data/constants')
      const minutesPerPoint = Math.round(STAMINA_RECOVER_INTERVAL_MS / 60000)
      P.showGameToast(`体力不足，${minutesPerPoint}分钟恢复1点`, { type: 'warn' })
    }
    return
  }

  // 老玩家 → 跳转编队页
  g._selectedStageId = stage.id
  g._stageTeamReturnScene = 'title'
  g.setScene('stageTeam')
}

module.exports = tTitle
