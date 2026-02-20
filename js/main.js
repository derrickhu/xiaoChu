/**
 * 五行通天塔 - 主游戏逻辑
 * Roguelike爬塔 + 智龙迷城式拖拽转珠 + 五行克制
 * 无局外养成，死亡即重开，仅记录最高层数
 */
const { Render, TH } = require('./render')
const Storage = require('./data/storage')
const { ATTR_COLOR, generateRewards } = require('./data/tower')
const MusicMgr = require('./runtime/music')
const ViewEnv = require('./views/env')
const screens = require('./views/screens')
const prepareView = require('./views/prepareView')
const eventView = require('./views/eventView')
const battleView = require('./views/battleView')
const dialogs = require('./views/dialogs')
const touchH = require('./input/touchHandlers')
const battleEngine = require('./engine/battle')
const skillEngine = require('./engine/skills')
const anim = require('./engine/animations')
const runMgr = require('./engine/runManager')

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const _winInfo = wx.getWindowInfo()
const _devInfo = wx.getDeviceInfo()
const dpr = _winInfo.pixelRatio || 2
canvas.width = _winInfo.windowWidth * dpr
canvas.height = _winInfo.windowHeight * dpr
const W = canvas.width, H = canvas.height
const S = W / 375
console.log(`[Canvas] ${W}x${H}, dpr=${dpr}, S=${S.toFixed(2)}, platform=${_devInfo.platform}`)
const safeTop = (_winInfo.safeArea?.top || 20) * dpr

const COLS = 6, ROWS = 5
const R = new Render(ctx, W, H, S, safeTop)
ViewEnv.init(ctx, R, TH, W, H, S, safeTop, COLS, ROWS)

class Main {
  constructor() {
    this.storage = new Storage()
    this.scene = 'loading'
    this.af = 0

    // 棋盘
    this.board = []; this.cellSize = 0; this.boardX = 0; this.boardY = 0
    // 转珠
    this.dragging = false
    this.dragR = -1; this.dragC = -1
    this.dragStartX = 0; this.dragStartY = 0
    this.dragCurX = 0; this.dragCurY = 0
    this.dragAttr = null
    this.dragTimer = 0
    this.dragTimeLimit = 8 * 60  // 8秒@60fps
    // 交换动画
    this.swapAnim = null
    // 战斗状态
    this.bState = 'none'
    this._stateTimer = 0
    this._enemyTurnWait = false
    this._pendingEnemyAtk = null
    this._pendingDmgMap = null
    this._pendingHeal = 0
    this.combo = 0; this.turnCount = 0
    this.elimQueue = []
    this.elimAnimCells = null; this.elimAnimTimer = 0
    this.dropAnimTimer = 0; this.dropAnimCols = null
    // 动画
    this.dmgFloats = []; this.skillEffects = []
    this.elimFloats = []   // 消除时棋子处的数值飘字
    this.petAtkNums = []   // 宠物头像处攻击数值翻滚
    this._comboAnim = { num: 0, timer: 0, scale: 1 } // Combo弹出动画
    this._comboParticles = [] // Combo粒子特效
    this._comboFlash = 0     // 连击触发白色闪光
    this._petFinalDmg = {} // preAttack阶段各宠物最终伤害（含combo等加成）
    this._petAtkRollTimer = 0 // 头像数值翻滚计时
    this.shakeT = 0; this.shakeI = 0
    this.heroAttackAnim = { active:false, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:false, progress:0, duration:18 }
    this.heroHurtAnim   = { active:false, progress:0, duration:18 }
    this.enemyAttackAnim= { active:false, progress:0, duration:20 }
    this.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
    this._enemyHpLoss = null; this._heroHpLoss = null; this._heroHpGain = null
    this._enemyHitFlash = 0   // 敌人受击闪白帧数
    this._enemyDeathAnim = null // 敌人死亡爆裂特效
    this._blockFlash = 0
    this._heroHurtFlash = 0    // 英雄受击红闪帧数
    this._enemyWarning = 0     // 敌人回合预警帧数
    this._counterFlash = null  // 克制属性色闪光 {color, timer}
    this._bossEntrance = 0     // Boss入场特效帧数

    // Run state (Roguelike)
    this.floor = 0
    this.pets = []          // [{...petData, attr, currentCd}] — 上场5只
    this.weapon = null      // 当前装备法宝
    this.petBag = []        // 宠物背包（无上限）
    this.weaponBag = []     // 法宝背包（无上限）
    this.heroHp = 0; this.heroMaxHp = 60
    this.heroShield = 0
    this.heroBuffs = []; this.enemyBuffs = []
    this.enemy = null
    this.curEvent = null
    this.rewards = null
    this.shopItems = null
    this.restOpts = null
    this.adventureData = null
    this.selectedReward = -1
    this.rewardPetSlot = -1   // 替换宠物时选择的槽位
    this.shopUsed = false
    // 战前编辑
    this.prepareTab = 'pets'   // 'pets' | 'weapon'
    this.prepareSelBagIdx = -1 // 背包选中的下标
    this.prepareSelSlotIdx = -1 // 上场槽位选中的下标
    this.prepareTip = null     // 详情Tips: {type:'pet'|'weapon', data, x, y}  (weapon=法宝)
    this._eventPetDetail = null // 事件页灵兽详情弹窗索引
    this._eventPetDetailData = null // 事件页灵兽详情弹窗数据
    this._eventWpnDetail = null // 事件页法宝详情弹窗
    this._eventWpnDetailData = null // 事件页法宝详情数据
    this._eventDragPet = null    // 事件页灵宠拖拽状态 {source:'team'|'bag', index, pet, x, y}
    this.showRunBuffDetail = false // 全局增益详情弹窗
    this.showWeaponDetail = false  // 战斗中法宝详情弹窗
    this.showBattlePetDetail = null // 战斗中宠物详情弹窗（宠物索引）
    this._runBuffIconRects = []   // 全局增益图标点击区域
    // 局内BUFF日志（用于左侧图标列显示）
    this.runBuffLog = []
    // 局内BUFF累积（全队全局生效，更换宠物不影响）
    this.runBuffs = runMgr.makeDefaultRunBuffs()
    this.skipNextBattle = false
    this.nextStunEnemy = false
    this.nextDmgDouble = false
    this.tempRevive = false
    this.immuneOnce = false
    this.comboNeverBreak = false
    this.weaponReviveUsed = false
    this.goodBeadsNextTurn = false

    this._loadStart = Date.now()
    this._pressedBtn = null
    // 长按预览
    this._petLongPressTimer = null
    this._petLongPressIndex = -1
    this._petLongPressTriggered = false
    // 上划释放技能
    this._petSwipeIndex = -1
    this._petSwipeStartX = 0
    this._petSwipeStartY = 0
    this._petSwipeTriggered = false
    this.skillPreview = null  // {pet, index, timer, x, y}
    this.showExitDialog = false
    this.showNewRunConfirm = false  // 首页"开始挑战"确认弹窗
    // 排行榜
    this.rankTab = 'all'
    this.rankScrollY = 0

    // 触摸
    if (typeof canvas.addEventListener === 'function') {
      canvas.addEventListener('touchstart', e => this.onTouch('start', e))
      canvas.addEventListener('touchmove', e => this.onTouch('move', e))
      canvas.addEventListener('touchend', e => this.onTouch('end', e))
    } else {
      wx.onTouchStart(e => this.onTouch('start', e))
      wx.onTouchMove(e => this.onTouch('move', e))
      wx.onTouchEnd(e => this.onTouch('end', e))
    }

    const loop = () => { this.af++; try { this.update(); this.render() } catch(e) { console.error('loop error:', e) }; requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  }

  // ===== Run管理（委托到 runManager）=====
  _startRun() { runMgr.startRun(this) }
  _nextFloor() { runMgr.nextFloor(this) }
  _restoreBattleHpMax() { runMgr.restoreBattleHpMax(this) }
  _endRun() { runMgr.endRun(this) }
  _saveAndExit() { runMgr.saveAndExit(this) }
  _resumeRun() { runMgr.resumeRun(this) }

  // ===== 更新 =====
  update() {
    anim.updateAnimations(this)
    // victory 状态下懒生成奖励（仅生成一次）
    if (this.bState === 'victory' && !this.rewards) {
      const ownedWpnIds = new Set()
      if (this.weapon) ownedWpnIds.add(this.weapon.id)
      if (this.weaponBag) this.weaponBag.forEach(w => ownedWpnIds.add(w.id))
      this.rewards = generateRewards(this.floor, this.curEvent ? this.curEvent.type : 'battle', this.lastSpeedKill, ownedWpnIds)
      this.selectedReward = -1
      this._rewardDetailShow = null
    }
    if (this.scene === 'loading') {
      const elapsed = Date.now() - this._loadStart
      if (elapsed > 1000) {
        this.scene = 'title'; MusicMgr.playBgm()
      }
    }
    if (this.bState === 'elimAnim') this._processElim()
    if (this.bState === 'dropping') this._processDropAnim()
    if (this.dragging && this.bState === 'playerTurn') {
      this.dragTimer++
      if (this.dragTimer >= this.dragTimeLimit) {
        this.dragging = false; this.dragAttr = null; this.dragTimer = 0
        MusicMgr.playDragEnd()
        this._checkAndElim()
      }
    }
    // 延迟敌人攻击：在玩家回合背景中执行，不阻塞操作
    if (this._pendingEnemyAtk && this.bState === 'playerTurn') {
      this._pendingEnemyAtk.timer++
      if (this._pendingEnemyAtk.timer >= this._pendingEnemyAtk.delay) {
        this._pendingEnemyAtk = null
        this._enemyTurn()
        // enemyTurn 可能将 bState 改为 defeat 等，如果仍在 playerTurn 或 enemyTurn 就恢复
        if (this.bState === 'enemyTurn') {
          // 被眩晕检查
          const stunIdx = this.heroBuffs.findIndex(b => b.type === 'heroStun')
          if (stunIdx >= 0) {
            this.heroBuffs.splice(stunIdx, 1)
            this.skillEffects.push({ x:ViewEnv.W*0.5, y:ViewEnv.H*0.5, text:'被眩晕！跳过操作', color:'#ff4444', t:0, alpha:1 })
            // 眩晕：需要再做一轮敌人攻击
            this._pendingEnemyAtk = { timer: 0, delay: 24 }
          }
          this.bState = 'playerTurn'
        }
      }
    }
    if (this.bState === 'petAtkShow') {
      this._stateTimer++
      if (this._stateTimer >= 38) { this._stateTimer = 0; this.bState = 'preAttack' }
    }
    if (this.bState === 'preAttack') {
      this._stateTimer++; if (this._stateTimer >= 12) { this._stateTimer = 0; this._executeAttack() }
    }
    if (this.bState === 'preEnemy') {
      this._stateTimer++; if (this._stateTimer >= 30) { this._stateTimer = 0; this._enemyTurn() }
    }
    if (this.bState === 'enemyTurn' && this._enemyTurnWait) {
      this._stateTimer++
      if (this._stateTimer >= 30) {
        this._stateTimer = 0; this._enemyTurnWait = false
        // 检查heroStun：玩家被眩晕则跳过操作回合
        const stunIdx = this.heroBuffs.findIndex(b => b.type === 'heroStun')
        if (stunIdx >= 0) {
          this.heroBuffs.splice(stunIdx, 1)
          this.skillEffects.push({ x:ViewEnv.W*0.5, y:ViewEnv.H*0.5, text:'被眩晕！跳过操作', color:'#ff4444', t:0, alpha:1 })
          this.bState = 'preEnemy'; this._stateTimer = 0
        } else {
          this.bState = 'playerTurn'; this.dragTimer = 0
        }
      }
    }
    anim.updateSwapAnim(this)
    anim.updateBattleAnims(this)
    anim.updateHpAnims(this)
    anim.updateSkillPreview(this)
    if (this.scene === 'ranking' && this.af % 3600 === 0) {
      this.storage.fetchRanking(this.rankTab, true)
    }
  }

  // ===== 渲染入口 =====
  render() {
    ctx.clearRect(0, 0, W, H)
    const sx = this.shakeT > 0 ? (Math.random()-0.5)*this.shakeI*S : 0
    const sy = this.shakeT > 0 ? (Math.random()-0.5)*this.shakeI*S : 0
    ctx.save(); ctx.translate(sx, sy)
    switch(this.scene) {
      case 'loading': screens.rLoading(this); break
      case 'title': screens.rTitle(this); break
      case 'prepare': prepareView.rPrepare(this); break
      case 'event': eventView.rEvent(this); break
      case 'battle': battleView.rBattle(this); break
      case 'reward': screens.rReward(this); break
      case 'shop': screens.rShop(this); break
      case 'rest': screens.rRest(this); break
      case 'adventure': screens.rAdventure(this); break
      case 'gameover': screens.rGameover(this); break
      case 'ranking': screens.rRanking(this); break
      case 'stats': screens.rStats(this); break
    }
    this.dmgFloats.forEach(f => R.drawDmgFloat(f))
    this.skillEffects.forEach(e => R.drawSkillEffect(e))
    if (this.skillCastAnim.active) R.drawSkillCast(this.skillCastAnim)
    ctx.restore()
  }

  // ===== 场景渲染（仅保留被子模块内部通过 g._xxx() 调用的委托）=====
  _rLoading() { screens.rLoading(this) }
  _rTitle() { screens.rTitle(this) }
  _rPrepare() { prepareView.rPrepare(this) }
  _rEvent() { eventView.rEvent(this) }
  _rBattle() { battleView.rBattle(this) }
  _rReward() { screens.rReward(this) }
  _rShop() { screens.rShop(this) }
  _rRest() { screens.rRest(this) }
  _rAdventure() { screens.rAdventure(this) }
  _rGameover() { screens.rGameover(this) }
  _rRanking() { screens.rRanking(this) }
  _rStats() { screens.rStats(this) }
  _drawPrepareTip() { prepareView.drawPrepareTip(this) }
  _wrapText(text, maxW, fontSize) { return prepareView.wrapText(text, maxW, fontSize) }
  _drawEventPetDetail() { eventView.drawEventPetDetail(this) }
  _openRanking() {
    if (!this.storage.userAuthorized) {
      // 首次点击需要授权
      this.storage.requestUserInfo((ok, info) => {
        if (ok) {
          // 授权成功，提交当前最高分后进入排行榜
          if (this.storage.bestFloor > 0) {
            this.storage.submitScore(
              this.storage.bestFloor,
              this.storage.stats.bestFloorPets,
              this.storage.stats.bestFloorWeapon
            )
          }
          this.rankTab = 'all'
          this.rankScrollY = 0
          this.storage.fetchRanking('all', true)
          this.storage.fetchRanking('daily', true)
          this.scene = 'ranking'
        }
      })
      return
    }
    this.rankTab = 'all'
    this.rankScrollY = 0
    this.storage.fetchRanking('all')
    this.storage.fetchRanking('daily')
    this.scene = 'ranking'
  }

  // ===== 视图委托桩 =====
  _drawTeamBar(topY, barH, iconSize) { battleView.drawTeamBar(this, topY, barH, iconSize) }
  _drawBoard() { battleView.drawBoard(this) }
  _drawVictoryOverlay() { battleView.drawVictoryOverlay(this) }
  _drawDefeatOverlay() { battleView.drawDefeatOverlay(this) }
  _drawAdReviveOverlay() { battleView.drawAdReviveOverlay(this) }
  _drawBackBtn() { screens.drawBackBtn(this) }
  _handleBackToTitle() {
    if (this.scene === 'gameover' || this.scene === 'ranking' || this.scene === 'stats') {
      this.scene = 'title'
    } else {
      this._saveAndExit()
    }
  }
  _drawExitDialog() { dialogs.drawExitDialog(this) }
  _drawNewRunConfirm() { screens.drawNewRunConfirm(this) }
  _drawBuffIcons(buffs, x, y) { battleView.drawBuffIcons(buffs, x, y) }
  _drawBuffIconsLabeled(buffs, x, y, label, isEnemy) { battleView.drawBuffIconsLabeled(buffs, x, y, label, isEnemy) }
  _drawRunBuffIcons(topY, bottomY) { battleView.drawRunBuffIcons(this, topY, bottomY) }
  _drawRunBuffDetailDialog() { dialogs.drawRunBuffDetailDialog(this) }
  _drawEnemyDetailDialog() { dialogs.drawEnemyDetailDialog(this) }
  _drawWeaponDetailDialog() { dialogs.drawWeaponDetailDialog(this) }
  _drawBattlePetDetailDialog() { dialogs.drawBattlePetDetailDialog(this) }
  _getBattleLayout() {
    const boardPad = 6*S, cellSize = (W-boardPad*2)/COLS, boardH = ROWS*cellSize
    const boardTop = H-8*S-boardH
    const sidePad = 8*S, petGap = 8*S, wpnGap = 12*S
    const totalGapW = wpnGap + petGap * 4 + sidePad * 2
    const iconSize = (W - totalGapW) / 6
    const teamBarH = iconSize + 6*S
    const hpBarH = 18*S
    const hpBarY = boardTop - hpBarH - 4*S
    const teamBarY = hpBarY - teamBarH - 2*S
    const eAreaTop = safeTop + 4*S
    return { boardPad, cellSize, boardH, boardTop, iconSize, teamBarH, teamBarY, hpBarY, eAreaTop }
  }

  _getEnemyCenterY() {
    const L = this._getBattleLayout()
    const eAreaBottom = L.teamBarY - 4*S
    const eAreaH = eAreaBottom - L.eAreaTop
    return L.eAreaTop + eAreaH * 0.42
  }

  _playHeroAttack(skillName, attr, type) {
    this.heroAttackAnim = { active:true, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:true, progress:0, duration:18 }
    this._enemyHitFlash = 12  // 敌人闪白12帧
    const color = ATTR_COLOR[attr]?.main || TH.accent
    const eCenterY = this._getEnemyCenterY()
    this.skillCastAnim = { active:true, progress:0, duration:30, type:type||'slash', color, skillName:skillName||'', targetX:W*0.5, targetY:eCenterY }
  }

  _playEnemyAttack() {
    this.enemyAttackAnim = { active:true, progress:0, duration:20 }
    this.heroHurtAnim    = { active:true, progress:0, duration:18 }
    const L = this._getBattleLayout()
    this.skillCastAnim = { active:true, progress:0, duration:30, type:'enemyAtk', color:TH.danger, skillName:'', targetX:W*0.5, targetY:L.hpBarY }
  }

  _playHealEffect() {
    const L = this._getBattleLayout()
    this.skillCastAnim = { active:true, progress:0, duration:25, type:'heal', color:'#4dcc4d', skillName:'', targetX:W*0.5, targetY:L.hpBarY }
    MusicMgr.playHeal()
  }

  // ===== 触摸入口 =====
  onTouch(type, e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const x = t.clientX * dpr, y = t.clientY * dpr
    switch(this.scene) {
      case 'title': touchH.tTitle(this,type,x,y); break
      case 'prepare': touchH.tPrepare(this,type,x,y); break
      case 'event': touchH.tEvent(this,type,x,y); break
      case 'battle': touchH.tBattle(this,type,x,y); break
      case 'reward': touchH.tReward(this,type,x,y); break
      case 'shop': touchH.tShop(this,type,x,y); break
      case 'rest': touchH.tRest(this,type,x,y); break
      case 'adventure': touchH.tAdventure(this,type,x,y); break
      case 'gameover': touchH.tGameover(this,type,x,y); break
      case 'ranking': touchH.tRanking(this,type,x,y); break
      case 'stats': touchH.tStats(this,type,x,y); break
    }
  }

  // ===== 触摸委托桩（保留供子模块 g._tXxx() 调用）=====
  _tTitle(type,x,y) { touchH.tTitle(this,type,x,y) }
  _tPrepare(type,x,y) { touchH.tPrepare(this,type,x,y) }
  _tEvent(type,x,y) { touchH.tEvent(this,type,x,y) }
  _tBattle(type,x,y) { touchH.tBattle(this,type,x,y) }
  _tReward(type,x,y) { touchH.tReward(this,type,x,y) }
  _tShop(type,x,y) { touchH.tShop(this,type,x,y) }
  _tRest(type,x,y) { touchH.tRest(this,type,x,y) }
  _tAdventure(type,x,y) { touchH.tAdventure(this,type,x,y) }
  _tGameover(type,x,y) { touchH.tGameover(this,type,x,y) }
  _tRanking(type,x,y) { touchH.tRanking(this,type,x,y) }
  _tStats(type,x,y) { touchH.tStats(this,type,x,y) }
  _enterEvent() { this._eventPetDetail = null; this._eventPetDetailData = null; this._eventWpnDetail = null; this._eventWpnDetailData = null; this._eventDragPet = null; this.scene = 'event' }
  _showSkillPreview(pet, index) { skillEngine.showSkillPreview(this, pet, index) }
  // ===== 战斗进入 =====
  _enterBattle(enemyData) { battleEngine.enterBattle(this, enemyData) }
  _initBoard() { battleEngine.initBoard(this) }
  _cellAttr(r, c) { return battleEngine.cellAttr(this, r, c) }
  // ===== 消除核心 =====
  _checkAndElim() {
    // 消除前如果敌人攻击还在等待，立即执行（确保回合数正确）
    if (this._pendingEnemyAtk) {
      this._pendingEnemyAtk = null
      this._enemyTurn()
      // 敌人攻击后可能导致 defeat/victory，此时不再消除
      if (this.bState !== 'playerTurn' && this.bState !== 'enemyTurn') return
      // 敌人回合结束后检查玩家眩晕
      if (this.bState === 'enemyTurn') {
        const stunIdx = this.heroBuffs.findIndex(b => b.type === 'heroStun')
        if (stunIdx >= 0) {
          this.heroBuffs.splice(stunIdx, 1)
          this.skillEffects.push({ x:ViewEnv.W*0.5, y:ViewEnv.H*0.5, text:'被眩晕！跳过操作', color:'#ff4444', t:0, alpha:1 })
          this._pendingEnemyAtk = { timer: 0, delay: 24 }
        }
        this.bState = 'playerTurn'
      }
    }
    battleEngine.checkAndElim(this)
  }
  _startNextElimAnim() { battleEngine.startNextElimAnim(this) }
  _processElim() { battleEngine.processElim(this) }
  _processDropAnim() { battleEngine.processDropAnim(this) }
  _findMatchesSeparate() { return battleEngine.findMatchesSeparate(this) }
  _fillBoard() { battleEngine.fillBoard(this) }
  _enterPetAtkShow() { battleEngine.enterPetAtkShow(this) }
  // ===== 攻击结算 =====
  _executeAttack() { battleEngine.executeAttack(this) }
  _calcCrit() { return battleEngine.calcCrit(this) }
  _applyFinalDamage(dmgMap, heal) { battleEngine.applyFinalDamage(this, dmgMap, heal) }
  _settle() { battleEngine.settle(this) }
  _enemyTurn() { battleEngine.enemyTurn(this) }
  _applyEnemySkill(sk) { battleEngine.applyEnemySkill(this, sk) }
  // ===== 宠物技能与奖励 =====
  _triggerPetSkill(pet, idx) { skillEngine.triggerPetSkill(this, pet, idx) }
  _applyReward(rw) { skillEngine.applyReward(this, rw) }
  _applyBuffReward(b) { skillEngine.applyBuffReward(this, b) }
  _applyShopItem(item) { skillEngine.applyShopItem(this, item) }
  _applyRestOption(opt) { skillEngine.applyRestOption(this, opt) }
  _applyAdventure(adv) { skillEngine.applyAdventure(this, adv) }
  // 统一添加护盾（自动应用法宝shieldBoost加成）
  _addShield(val) {
    if (this.weapon && this.weapon.type === 'shieldBoost') {
      val = Math.round(val * (1 + (this.weapon.pct || 50) / 100))
    }
    this.heroShield += val
    MusicMgr.playShieldGain()  // 护盾获得音效
    // 护盾飘字
    this.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${val}盾`, color:'#7ddfff', t:0, alpha:1 })
  }

  _dealDmgToHero(dmg) {
    if (this.heroShield > 0) {
      if (dmg <= this.heroShield) {
        this.heroShield -= dmg
        // 护盾完全吸收 — 大字特效
        this.skillEffects.push({ x:W*0.5, y:H*0.52, text:'完美抵挡！', color:'#40e8ff', t:0, alpha:1, scale:2.5, _initScale:2.5, big:true })
        this.dmgFloats.push({ x:W*0.5, y:H*0.6, text:`护盾吸收 ${dmg}`, color:'#7ddfff', t:0, alpha:1, scale:1.6 })
        this.shakeT = 4; this.shakeI = 2
        this._blockFlash = 8
        MusicMgr.playBlock()
        return
      }
      const shieldAbs = this.heroShield
      dmg -= this.heroShield; this.heroShield = 0
      // 护盾击碎 — 显示吸收了多少
      this.skillEffects.push({ x:W*0.5, y:H*0.52, text:'护盾击碎！', color:'#ff9040', t:0, alpha:1, scale:2.0, _initScale:2.0 })
      this.dmgFloats.push({ x:W*0.45, y:H*0.6, text:`盾挡 ${shieldAbs}`, color:'#40b8e0', t:0, alpha:1, scale:1.4 })
    }
    const oldPct = this.heroHp / this.heroMaxHp
    this.heroHp = Math.max(0, this.heroHp - dmg)
    this._heroHpLoss = { fromPct: oldPct, timer: 0 }
    this.dmgFloats.push({ x:W*0.5, y:H*0.7, text:`-${dmg}`, color:TH.danger, t:0, alpha:1 })
    // ===== 怒气系统：受到实际伤害积累怒气 =====
    if (this.rage != null && dmg > 0) {
      const ragePct = Math.min(50, Math.round(dmg / this.heroMaxHp * 100))  // 受伤占血量比的怒气
      this.rage = Math.min(100, this.rage + ragePct + 8)  // 每次受击固定+8基础怒气
      if (this.rage >= 100 && !this._rageReady) {
        this._rageReady = true
        this.skillEffects.push({ x:W*0.5, y:H*0.45, text:'怒气满！下次攻击爆发！', color:'#ff4040', t:0, alpha:1, scale:2.2, _initScale:2.2, big:true })
      }
    }
  }

  _onDefeat() { runMgr.onDefeat(this, W, H) }
  _doAdRevive() { runMgr.doAdRevive(this, W, H) }
  _adReviveCallback() { runMgr.adReviveCallback(this, W, H) }

  _hitRect(x,y,rx,ry,rw,rh) { return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh }
}

new Main()
