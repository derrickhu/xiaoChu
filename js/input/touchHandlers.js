/**
 * 触摸/输入处理：各场景的触摸事件分发
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const { generateRewards } = require('../data/tower')

function tTitle(g, type, x, y) {
  if (type !== 'end') return
  const { S } = V
  // 新挑战确认弹窗（优先级最高）
  if (g.showNewRunConfirm) {
    if (g._newRunConfirmRect && g._hitRect(x,y,...g._newRunConfirmRect)) {
      g.showNewRunConfirm = false
      g.storage.clearRunState()
      g._startRun(); return
    }
    if (g._newRunCancelRect && g._hitRect(x,y,...g._newRunCancelRect)) {
      g.showNewRunConfirm = false; return
    }
    return
  }
  if (g._titleContinueRect && g._hitRect(x,y,...g._titleContinueRect)) { g._resumeRun(); return }
  if (g._titleBtnRect && g._hitRect(x,y,...g._titleBtnRect)) {
    if (g.storage.hasSavedRun()) { g.showNewRunConfirm = true; return }
    g._startRun(); return
  }
  if (g._statBtnRect && g._hitRect(x,y,...g._statBtnRect)) { g.scene = 'stats'; return }
  if (g._rankBtnRect && g._hitRect(x,y,...g._rankBtnRect)) { g._openRanking(); return }
}

function tPrepare(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g.scene = 'event'; return }
  if (g.prepareTip) { g.prepareTip = null; return }
  if (g._prepPetTabRect && g._hitRect(x,y,...g._prepPetTabRect)) { g.prepareTab = 'pets'; g.prepareSelBagIdx = -1; g.prepareSelSlotIdx = -1; g.prepareTip = null; return }
  if (g._prepWpnTabRect && g._hitRect(x,y,...g._prepWpnTabRect)) { g.prepareTab = 'weapon'; g.prepareTip = null; return }

  if (g.prepareTab === 'pets') {
    if (g._prepSlotRects) {
      for (let i = 0; i < g._prepSlotRects.length; i++) {
        if (g._hitRect(x,y,...g._prepSlotRects[i])) {
          if (g.prepareSelSlotIdx === i && g.pets[i]) {
            g.prepareTip = { type:'pet', data: g.pets[i], x, y }; return
          }
          g.prepareSelSlotIdx = i; return
        }
      }
    }
    if (g._prepBagRects) {
      for (let i = 0; i < g._prepBagRects.length; i++) {
        if (g._hitRect(x,y,...g._prepBagRects[i]) && g.petBag[i]) {
          if (g.prepareSelBagIdx === i) {
            g.prepareTip = { type:'pet', data: g.petBag[i], x, y }; return
          }
          g.prepareSelBagIdx = i; return
        }
      }
    }
    if (g._prepSwapBtnRect && g._hitRect(x,y,...g._prepSwapBtnRect)) {
      const si = g.prepareSelSlotIdx, bi = g.prepareSelBagIdx
      if (si >= 0 && bi >= 0 && g.petBag[bi]) {
        const tmp = g.pets[si]
        g.pets[si] = g.petBag[bi]
        g.pets[si].currentCd = 0
        if (tmp) { g.petBag[bi] = tmp }
        else { g.petBag.splice(bi, 1) }
        g.prepareSelSlotIdx = -1; g.prepareSelBagIdx = -1
      }
      return
    }
  } else {
    if (g.weapon && g._prepCurWpnRect && g._hitRect(x,y,...g._prepCurWpnRect)) {
      g.prepareTip = { type:'weapon', data: g.weapon, x, y }; return
    }
    if (g._prepWpnBagRects) {
      for (let i = 0; i < g._prepWpnBagRects.length; i++) {
        const [cx,cy,cw,ch,ebx,eby,ebw,ebh] = g._prepWpnBagRects[i]
        if (g._hitRect(x,y,ebx,eby,ebw,ebh)) {
          const old = g.weapon
          g.weapon = g.weaponBag[i]
          if (old) { g.weaponBag[i] = old }
          else { g.weaponBag.splice(i, 1) }
          return
        }
        if (g._hitRect(x,y,cx,cy,cw,ch) && g.weaponBag[i]) {
          g.prepareTip = { type:'weapon', data: g.weaponBag[i], x, y }; return
        }
      }
    }
  }
  if (g._prepGoBtnRect && g._hitRect(x,y,...g._prepGoBtnRect)) {
    g._enterEvent(); return
  }
}

function tEvent(g, type, x, y) {
  if (type !== 'end') return
  if (g._eventPetDetail != null) {
    g._eventPetDetail = null; return
  }
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._eventEditPetRect && g._hitRect(x,y,...g._eventEditPetRect)) {
    g.prepareTab = 'pets'; g.scene = 'prepare'; return
  }
  if (g._eventEditWpnRect && g._hitRect(x,y,...g._eventEditWpnRect)) {
    g.prepareTab = 'weapon'; g.scene = 'prepare'; return
  }
  if (g._eventPetRects) {
    for (let i = 0; i < g._eventPetRects.length; i++) {
      if (i < g.pets.length && g._hitRect(x,y,...g._eventPetRects[i])) {
        g._eventPetDetail = i; return
      }
    }
  }
  if (g._eventBtnRect && g._hitRect(x,y,...g._eventBtnRect)) {
    const ev = g.curEvent; if (!ev) return
    switch(ev.type) {
      case 'battle': case 'elite': case 'boss':
        g._enterBattle(ev.data); break
      case 'adventure':
        g.adventureData = ev.data; g._applyAdventure(ev.data); g.scene = 'adventure'; MusicMgr.playReward(); break
      case 'shop':
        g.shopItems = ev.data; g.shopUsed = false; g.scene = 'shop'; MusicMgr.playReward(); break
      case 'rest':
        g.restOpts = ev.data; g.scene = 'rest'; break
    }
  }
}

function tBattle(g, type, x, y) {
  const { S, W, H, COLS, ROWS } = V
  // 退出弹窗
  if (g.showExitDialog) {
    if (type !== 'end') return
    if (g._exitSaveRect && g._hitRect(x,y,...g._exitSaveRect)) { g._saveAndExit(); return }
    if (g._exitRestartRect && g._hitRect(x,y,...g._exitRestartRect)) {
      g.showExitDialog = false; g.storage.clearRunState(); g._startRun(); return
    }
    if (g._exitCancelRect && g._hitRect(x,y,...g._exitCancelRect)) { g.showExitDialog = false; return }
    return
  }
  if (g.showEnemyDetail) { if (type === 'end') g.showEnemyDetail = false; return }
  if (g.showRunBuffDetail) { if (type === 'end') g.showRunBuffDetail = false; return }
  if (g.showWeaponDetail) { if (type === 'end') g.showWeaponDetail = false; return }
  if (g.showBattlePetDetail != null) { if (type === 'end') g.showBattlePetDetail = null; return }
  if (type === 'end' && g._exitBtnRect && g._hitRect(x,y,...g._exitBtnRect)) { g.showExitDialog = true; return }
  // 胜利/失败
  if (g.bState === 'victory' && type === 'end') {
    if (g._victoryBtnRect && g._hitRect(x,y,...g._victoryBtnRect)) {
      g._restoreBattleHpMax()
      g.heroBuffs = []; g.enemyBuffs = []
      g.rewards = generateRewards(g.floor, g.curEvent ? g.curEvent.type : 'battle', g.lastSpeedKill); g.selectedReward = -1; g.rewardPetSlot = -1
      g.scene = 'reward'; g.bState = 'none'; return
    }
  }
  if (g.bState === 'defeat' && type === 'end') {
    if (g._defeatBtnRect && g._hitRect(x,y,...g._defeatBtnRect)) { g._endRun(); return }
  }
  // 广告复活
  if (g.bState === 'adReviveOffer' && type === 'end') {
    if (g._adReviveBtnRect && g._hitRect(x,y,...g._adReviveBtnRect)) { g._doAdRevive(); return }
    if (g._adReviveSkipRect && g._hitRect(x,y,...g._adReviveSkipRect)) { g.adReviveUsed = true; g.bState = 'defeat'; return }
    return
  }
  // 全局增益图标
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat' && g._runBuffIconRects) {
    for (const item of g._runBuffIconRects) {
      if (g._hitRect(x, y, ...item.rect)) { g.showRunBuffDetail = true; return }
    }
  }
  // 敌人详情
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat'
      && g.enemy && g._enemyAreaRect && g._hitRect(x,y,...g._enemyAreaRect)) {
    if (!g._exitBtnRect || !g._hitRect(x,y,...g._exitBtnRect)) { g.showEnemyDetail = true; return }
  }
  // 法宝详情
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat'
      && g.weapon && g._weaponBtnRect && g._hitRect(x,y,...g._weaponBtnRect)) {
    g.showWeaponDetail = true; return
  }
  // 宠物点击
  if (g._petBtnRects && g.bState !== 'victory' && g.bState !== 'defeat') {
    for (let i = 0; i < g._petBtnRects.length; i++) {
      if (i < g.pets.length && g._hitRect(x,y,...g._petBtnRects[i])) {
        const pet = g.pets[i]
        const skillReady = g.bState === 'playerTurn' && !g.dragging && pet.currentCd <= 0
        if (type === 'start') {
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
          if (g._petLongPressIndex === i && g._petLongPressTimer) {
            clearTimeout(g._petLongPressTimer)
            g._petLongPressTimer = null; g._petLongPressIndex = -1
          }
          return
        } else if (type === 'end') {
          if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
          if (g._petLongPressTriggered && g._petLongPressIndex === i) {
            g._petLongPressIndex = -1; g._petLongPressTriggered = false; return
          }
          g._petLongPressIndex = -1
          if (skillReady) { g._triggerPetSkill(pet, i) }
          else { g.showBattlePetDetail = i }
          return
        }
      }
    }
  }
  // 转珠
  if (g.bState !== 'playerTurn') return
  const cs = g.cellSize, bx = g.boardX, by = g.boardY
  if (type === 'start') {
    const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && g.board[r][c]) {
      g.dragging = true; g.dragR = r; g.dragC = c
      g.dragStartX = x; g.dragStartY = y; g.dragCurX = x; g.dragCurY = y
      const cell = g.board[r][c]
      g.dragAttr = typeof cell === 'string' ? cell : cell.attr
      g.dragTimer = 0
      MusicMgr.playPickUp()
    }
  } else if (type === 'move' && g.dragging) {
    g.dragCurX = x; g.dragCurY = y
    const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && (r !== g.dragR || c !== g.dragC)) {
      const or = g.dragR, oc = g.dragC
      const tmp = g.board[or][oc]; g.board[or][oc] = g.board[r][c]; g.board[r][c] = tmp
      g.swapAnim = { r1:or, c1:oc, r2:r, c2:c, t:0, dur:6 }
      g.dragR = r; g.dragC = c
      MusicMgr.playSwap()
    }
  } else if (type === 'end' && g.dragging) {
    g.dragging = false; g.dragAttr = null; g.dragTimer = 0
    MusicMgr.playDragEnd()
    g._checkAndElim()
  }
}

function tReward(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._rewardRects) {
    for (let i = 0; i < g._rewardRects.length; i++) {
      if (g._hitRect(x,y,...g._rewardRects[i])) { g.selectedReward = i; return }
    }
  }
  if (g._rewardConfirmRect && g.selectedReward >= 0 && g._hitRect(x,y,...g._rewardConfirmRect)) {
    g._applyReward(g.rewards[g.selectedReward])
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
  if (g._goBtnRect && g._hitRect(x,y,...g._goBtnRect)) { g.scene = 'title' }
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
    const list = g.rankTab === 'all' ? g.storage.rankAllList : g.storage.rankDailyList
    const rowH = 62*S
    const maxScroll = 0
    const minScroll = -Math.max(0, list.length * rowH - (H - 70*S - safeTop - 130*S))
    g.rankScrollY = Math.max(minScroll, Math.min(maxScroll, g._rankScrollStart + dy))
    return
  }
  if (type !== 'end') return
  const dy = Math.abs(y - (g._rankTouchStartY || y))
  if (dy > 10*S) return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.scene = 'title'; return }
  if (g._rankRefreshRect && g._hitRect(x, y, ...g._rankRefreshRect)) { g.storage.fetchRanking(g.rankTab, true); return }
  if (g._rankTabAllRect && g._hitRect(x, y, ...g._rankTabAllRect)) { g.rankTab = 'all'; g.rankScrollY = 0; g.storage.fetchRanking('all'); return }
  if (g._rankTabDailyRect && g._hitRect(x, y, ...g._rankTabDailyRect)) { g.rankTab = 'daily'; g.rankScrollY = 0; g.storage.fetchRanking('daily'); return }
}

function tStats(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.scene = 'title'; return }
}

module.exports = {
  tTitle, tPrepare, tEvent, tBattle,
  tReward, tShop, tRest, tAdventure, tGameover,
  tRanking, tStats,
}
