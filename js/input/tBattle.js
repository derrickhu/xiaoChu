/**
 * 触摸处理：战斗 (battle) 场景
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const { petHasSkill } = require('../data/pets')
const tutorial = require('../engine/tutorial')
const guideMgr = require('../engine/guideManager')
const runMgr = require('../engine/runManager')
const stageMgr = require('../engine/stageManager')
const { killExpBase } = require('../data/cultivationConfig')
const { HELP_PAGE_COUNT } = require('../views/battleView')
const { SWAP_ANIM_FRAMES, SWAP_LOGIC_LOCK_FRAMES } = require('../data/battleConfig')

function _swapLogicLocked(g) {
  return g.swapAnim && g.swapAnim.t < SWAP_LOGIC_LOCK_FRAMES
}

// 棋盘拖珠处理（教学和普通模式共用）
function _handleBoardDrag(g, type, x, y) {
  const { S, COLS, ROWS } = V
  if (g.bState !== 'playerTurn') return
  if (g._petSkillWave || g._skillFlash) return
  const cs = g.cellSize, bx = g.boardX, by = g.boardY
  if (type === 'start') {
    const c = Math.floor((x - bx) / cs), r = Math.floor((y - by) / cs)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && g.board[r][c] && !g.board[r][c].sealed && tutorial.canDrag(g, r, c)) {
      g.dragging = true; g.dragR = r; g.dragC = c
      g.dragStartX = x; g.dragStartY = y; g.dragCurX = x; g.dragCurY = y
      const cell = g.board[r][c]
      g.dragAttr = typeof cell === 'string' ? cell : cell.attr
      g.dragTimer = 0
      MusicMgr.playPickUp()
    }
  } else if (type === 'move' && g.dragging) {
    g.dragCurX = Math.max(bx, Math.min(bx + COLS * cs, x))
    g.dragCurY = Math.max(by, Math.min(by + ROWS * cs, y))
    // 触点只在「当前格 + 四正交邻格」中选最近中心：避免整盘 floor 在格缝抖动导致交换误判；与钳制后绘制仍一致
    const dr = g.dragR, dc = g.dragC
    const px = g.dragCurX, py = g.dragCurY
    let r = dr, c = dc
    let bestD = (px - (bx + (dc + 0.5) * cs)) ** 2 + (py - (by + (dr + 0.5) * cs)) ** 2
    const neigh = [[dr - 1, dc], [dr + 1, dc], [dr, dc - 1], [dr, dc + 1]]
    for (let i = 0; i < neigh.length; i++) {
      const nr = neigh[i][0], nc = neigh[i][1]
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      const mx = bx + (nc + 0.5) * cs, my = by + (nr + 0.5) * cs
      const d = (px - mx) ** 2 + (py - my) ** 2
      if (d < bestD) {
        bestD = d
        r = nr
        c = nc
      }
    }
    const orthoAdjacent = Math.abs(r - dr) + Math.abs(c - dc) === 1
    const targetCell = g.board[r] && g.board[r][c]
    if (
      !_swapLogicLocked(g) &&
      orthoAdjacent &&
      targetCell &&
      !targetCell.sealed &&
      tutorial.canSwapTo(g, r, c)
    ) {
      const or = dr, oc = dc
      const tmp = g.board[or][oc]; g.board[or][oc] = g.board[r][c]; g.board[r][c] = tmp
      g.swapAnim = { r1: or, c1: oc, r2: r, c2: c, t: 0, dur: SWAP_ANIM_FRAMES }
      g.dragR = r; g.dragC = c
      MusicMgr.playSwap()
    }
    if (tutorial.isGuideActive()) {
      g.dragCurX = bx + g.dragC * cs + cs / 2
      g.dragCurY = by + g.dragR * cs + cs / 2
    }
  } else if (type === 'end' && g.dragging) {
    g.dragging = false; g.dragAttr = null; g.dragTimer = 0
    if (tutorial.onDragEnd(g)) return
    MusicMgr.playDragEnd()
    g._checkAndElim()
  }
}

function tBattle(g, type, x, y) {
  const { S, W, H, COLS, ROWS } = V
  // === 新手宠物介绍卡拦截（两页后进入棋盘教学） ===
  if (g._newbiePetIntro) {
    if (type === 'end') {
      if ((g._newbiePetIntro.page || 0) < 1) {
        g._newbiePetIntro.page = 1
        g._newbiePetIntro.timer = 0
        g._newbiePetIntro.alpha = 0
      } else {
        g._newbiePetIntro = null
        // 介绍卡结束后触发简化版转珠教学
        if (g._pendingStageTutorial) {
          g._pendingStageTutorial = false
          const tut = require('../engine/tutorial')
          if (tut.startStageTutorial) tut.startStageTutorial(g)
        }
      }
      g._dirty = true
    }
    return
  }
  // === 教学系统拦截 ===
  if (tutorial.isActive()) {
    if (tutorial.isSummary()) {
      if (type === 'end') tutorial.onSummaryTap(g)
      return
    }
    if (tutorial.getPhase() === 'preIntro') {
      if (type === 'end') tutorial.onStoryCardTap(g)
      return
    }
    if (tutorial.getPhase() === 'intro') {
      if (type === 'end') tutorial.onIntroTap(g)
      return
    }
    if (g.bState === 'victory') {
      if (type === 'end') tutorial.onVictory(g)
      return
    }
    if (g.showExitDialog || g.showEnemyDetail || g.showRunBuffDetail || g.showWeaponDetail || g.showBattlePetDetail != null) {
      if (type === 'end') {
        g.showExitDialog = false; g.showEnemyDetail = false
        g.showRunBuffDetail = false; g.showWeaponDetail = false
        g.showBattlePetDetail = null
      }
      return
    }
  }
  // === 教学引导 play 阶段：只允许路径拖珠，屏蔽所有其他交互 ===
  if (tutorial.isActive() && tutorial.isGuideActive()) {
    _handleBoardDrag(g, type, x, y)
    return
  }
  // === 珠子攻击提示拦截 ===
  if (g._showOrbAttackTip) {
    if (type === 'end') {
      g._showOrbAttackTip = false
      g._orbTipTimer = 0
      if (g.storage) g.storage.markGuideShown('orb_attack_tip')
      g._dirty = true
    }
    return
  }
  // === 帮助面板拦截 ===
  if (g._showBattleHelp) {
    if (type === 'start') {
      g._helpSwipeStartX = x
    } else if (type === 'end') {
      // 关闭按钮
      if (g._helpCloseRect && g._hitRect(x, y, ...g._helpCloseRect)) {
        g._showBattleHelp = false; g._dirty = true; return
      }
      // 左右滑动翻页
      const dx = x - (g._helpSwipeStartX || x)
      const pageCount = HELP_PAGE_COUNT
      if (Math.abs(dx) > 40 * S) {
        if (!g._battleHelpPage) g._battleHelpPage = 0
        if (dx < 0 && g._battleHelpPage < pageCount - 1) g._battleHelpPage++
        else if (dx > 0 && g._battleHelpPage > 0) g._battleHelpPage--
        g._dirty = true; return
      }
      // 点击面板左右区域翻页
      if (g._helpPanelRect) {
        const [px, py, pw, ph] = g._helpPanelRect
        if (g._hitRect(x, y, px, py, pw, ph)) {
          if (!g._battleHelpPage) g._battleHelpPage = 0
          if (x < px + pw * 0.25 && g._battleHelpPage > 0) { g._battleHelpPage--; g._dirty = true; return }
          if (x > px + pw * 0.75 && g._battleHelpPage < pageCount - 1) { g._battleHelpPage++; g._dirty = true; return }
          return
        }
      }
      // 点击面板外关闭
      g._showBattleHelp = false; g._dirty = true
    }
    return
  }
  // === 教学拦截结束，以下为原逻辑 ===
  // 退出弹窗
  if (g.showExitDialog) {
    if (type !== 'end') return
    if (g._exitSaveRect && g._hitRect(x,y,...g._exitSaveRect)) {
      if (g.battleMode === 'stage') {
        MusicMgr.resumeNormalBgm()
        g.showExitDialog = false
        g.bState = 'none'
        g.setScene('title')
      } else {
        g._saveAndExit()
      }
      return
    }
    if (g._exitRestartRect && g._hitRect(x,y,...g._exitRestartRect)) {
      g.showExitDialog = false
      if (g.battleMode === 'stage' && g._stageId && g._stageTeam) {
        MusicMgr.resumeNormalBgm()
        stageMgr.startStage(g, g._stageId, g._stageTeam)
      } else {
        MusicMgr.stopBossBgm()
        runMgr.settleExp(g)
        g.storage.clearRunState(); g._startRun()
      }
      return
    }
    if (g._exitCancelRect && g._hitRect(x,y,...g._exitCancelRect)) { g.showExitDialog = false; return }
    return
  }
  if (g.showEnemyDetail) { if (type === 'end') g.showEnemyDetail = false; return }
  if (g.showRunBuffDetail) { if (type === 'end') g.showRunBuffDetail = false; return }
  if (g.showWeaponDetail) { if (type === 'end') g.showWeaponDetail = false; return }
  if (g.showBattlePetDetail != null) { if (type === 'end') g.showBattlePetDetail = null; return }
  if (type === 'end' && g._exitBtnRect && g._hitRect(x,y,...g._exitBtnRect)) { g.showExitDialog = true; return }
  
  // GM跳过战斗
  if (type === 'end' && g._isGM && g._gmSkipRect && g._hitRect(x,y,...g._gmSkipRect)) {
    runMgr.gmSkipBattle(g); return
  }
  // 帮助按钮
  if (type === 'end' && g._helpBtnRect && g._hitRect(x, y, ...g._helpBtnRect)
      && g.bState !== 'victory' && g.bState !== 'defeat' && g.bState !== 'adReviveOffer') {
    g._showBattleHelp = true; g._battleHelpPage = 0; g._dirty = true; return
  }
  // 胜利：秘境/通天塔均由 drawVictoryOverlay 自动等死亡动画后切场景，无需触摸
  if (g.bState === 'victory') return
  // 波间过渡
  if (g.bState === 'waveTransition' && type === 'end') {
    g._waveTransTimer = 0
    return
  }
  if (g.bState === 'defeat' && type === 'end') {
    if (g.battleMode === 'stage') {
      if (g._defeatBtnRect && g._hitRect(x,y,...g._defeatBtnRect)) {
        const stageMgr = require('../engine/stageManager')
        stageMgr.settleStageDefeat(g)
      }
      return
    }
    if (g._defeatBtnRect && g._hitRect(x,y,...g._defeatBtnRect)) { if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm(); g._endRun(); return }
  }
  // 广告复活
  if (g.bState === 'adReviveOffer' && type === 'end') {
    if (g._adReviveBtnRect && g._hitRect(x,y,...g._adReviveBtnRect)) { g._doAdRevive(); return }
    if (g._adReviveSkipRect && g._hitRect(x,y,...g._adReviveSkipRect)) { g.adReviveUsed = true; g.bState = 'defeat'; return }
    return
  }
  // 道具菜单交互
  if (g._showItemMenu && type === 'end') {
    if (g._itemObtainCooldown && Date.now() - g._itemObtainCooldown < 800) {
      return
    }
    let hitItem = false
    if (g._itemMenuRects) {
      for (const item of g._itemMenuRects) {
        if (g._hitRect(x, y, ...item.rect)) {
          if (item.action === 'obtain') {
            if (item.key === 'reset') runMgr.obtainItemReset(g)
            else if (item.key === 'heal') runMgr.obtainItemHeal(g)
            g._itemObtainCooldown = Date.now()
          } else if (item.action === 'use') {
            if (item.key === 'reset') runMgr.useItemReset(g)
            else if (item.key === 'heal') runMgr.useItemHeal(g)
          }
          hitItem = true; break
        }
      }
    }
    if (!hitItem) g._showItemMenu = false
    return
  }
  // 宝箱道具按钮
  if (type === 'end' && g.bState === 'playerTurn' && !g.dragging
      && g._chestBtnRect && g._hitRect(x, y, ...g._chestBtnRect)) {
    g._showItemMenu = true; return
  }
  // 全局增益图标
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat' && g._runBuffIconRects) {
    for (const item of g._runBuffIconRects) {
      if (g._hitRect(x, y, ...item.rect)) { g.showRunBuffDetail = true; return }
    }
  }
  // 敌人详情
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat'
      && !g._petSwipeTriggered && !g._skillFlash && !g._petSkillWave
      && g.enemy && g._enemyAreaRect && g._hitRect(x,y,...g._enemyAreaRect)) {
    if (!g._exitBtnRect || !g._hitRect(x,y,...g._exitBtnRect)) { g.showEnemyDetail = true; return }
  }
  // 法宝详情
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat'
      && g.weapon && g._weaponBtnRect && g._hitRect(x,y,...g._weaponBtnRect)) {
    g.showWeaponDetail = true; return
  }
  // 宠物头像框交互
  if (g._petBtnRects && g.bState !== 'victory' && g.bState !== 'defeat') {
    if (type === 'end' && g._petSwipeTriggered) {
      if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
      g._petSwipeIndex = -1; g._petSwipeTriggered = false
      g._petLongPressIndex = -1; g._petLongPressTriggered = false
      return
    }
    for (let i = 0; i < g._petBtnRects.length; i++) {
      if (i < g.pets.length && g._hitRect(x,y,...g._petBtnRects[i])) {
        const pet = g.pets[i]
        const skillReady = g.bState === 'playerTurn' && !g.dragging && petHasSkill(pet) && pet.currentCd <= 0 && !g._petSkillWave && !g._skillFlash
        if (type === 'start') {
          g._petSwipeIndex = i
          g._petSwipeStartX = x
          g._petSwipeStartY = y
          g._petSwipeTriggered = false
          if (skillReady) {
            g._petLongPressIndex = i
            g._petLongPressTriggered = false
            if (g._petLongPressTimer) clearTimeout(g._petLongPressTimer)
            g._petLongPressTimer = setTimeout(() => {
              g._petLongPressTriggered = true
              g._showSkillPreview(pet, i)
            }, 500)
          }
          return
        } else if (type === 'move') {
          if (g._petSwipeIndex === i && skillReady) {
            const dy = g._petSwipeStartY - y
            if (dy > 30 * V.S && !g._petSwipeTriggered) {
              g._petSwipeTriggered = true
              if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
              g._triggerPetSkill(pet, i)
              return
            }
          }
          if (g._petLongPressIndex === i && g._petLongPressTimer) {
            const dx = x - g._petSwipeStartX
            const dy = y - g._petSwipeStartY
            if (dx*dx + dy*dy > 100) {
              clearTimeout(g._petLongPressTimer)
              g._petLongPressTimer = null; g._petLongPressIndex = -1
            }
          }
          return
        } else if (type === 'end') {
          if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
          if (g._petLongPressTriggered && g._petLongPressIndex === i) {
            g._petLongPressIndex = -1; g._petLongPressTriggered = false
            g._petSwipeIndex = -1
            return
          }
          g.showBattlePetDetail = i
          g._petSwipeIndex = -1
          g._petSwipeTriggered = false
          g._petLongPressIndex = -1
          return
        }
      }
    }
    if (type === 'move' && g._petSwipeIndex >= 0) {
      const pet = g.pets[g._petSwipeIndex]
      const skillReady = g.bState === 'playerTurn' && !g.dragging && pet.currentCd <= 0 && !g._petSkillWave && !g._skillFlash
      if (skillReady && !g._petSwipeTriggered) {
        const dy = g._petSwipeStartY - y
        if (dy > 30 * V.S) {
          g._petSwipeTriggered = true
          if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
          g._triggerPetSkill(pet, g._petSwipeIndex)
        }
      }
    }
    if (type === 'end' && g._petSwipeIndex >= 0) {
      if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
      g._petSwipeIndex = -1; g._petSwipeTriggered = false
      g._petLongPressIndex = -1; g._petLongPressTriggered = false
    }
  }
  // 转珠（统一调用）
  _handleBoardDrag(g, type, x, y)
}

module.exports = tBattle
