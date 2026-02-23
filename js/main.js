/**
 * 灵宠消消塔 - 主游戏逻辑
 * Roguelike爬塔 + 智龙迷城式拖拽转珠 + 五行克制
 * 无局外养成，死亡即重开，仅记录最高层数
 */
const { Render, TH } = require('./render')
const Storage = require('./data/storage')
const { ATTR_COLOR, generateRewards, MAX_FLOOR } = require('./data/tower')
const { getMaxedPetIds } = require('./data/pets')
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
const tutorial = require('./engine/tutorial')

// 复用 game.js 创建的主Canvas（第一个createCanvas是屏幕Canvas，再创建就是离屏的了）
const canvas = GameGlobal.__mainCanvas || wx.createCanvas()
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
    this._loadReady = false  // 关键资源是否加载完毕
    this._loadPct = 0        // 实际加载进度
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

    // 注册微信分享能力
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
    wx.onShareAppMessage(() => this._getShareData())

    // 预加载关键图片（Loading背景、首页背景、标题Logo、按钮）
    const criticalImages = [
      'assets/backgrounds/loading_bg.jpg',
      'assets/backgrounds/home_bg.jpg',
      'assets/ui/title_logo.png',
      'assets/ui/btn_start.png',
      'assets/ui/btn_continue.png',
      'assets/ui/btn_rank.png',
    ]
    R.preloadImages(criticalImages, (loaded, total) => {
      this._loadPct = loaded / total
    }).then(() => {
      console.log('[Preload] critical images ready')
      this._loadReady = true
    })
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
    // 教学系统更新
    if (tutorial.isActive()) {
      tutorial.update(this)
      // 教学中胜利处理（step 0-2自动切换，step 3允许正常奖励）
      if (this.bState === 'victory') {
        if (tutorial.onVictory(this)) return  // 被教学系统接管
      }
    }
    // victory 状态下懒生成奖励（仅生成一次，教学中不生成，最终层不生成）
    if (this.bState === 'victory' && !this.rewards && !tutorial.isActive() && this.floor < MAX_FLOOR) {
      const ownedWpnIds = new Set()
      if (this.weapon) ownedWpnIds.add(this.weapon.id)
      if (this.weaponBag) this.weaponBag.forEach(w => ownedWpnIds.add(w.id))
      const ownedPetIds = new Set()
      if (this.pets) this.pets.forEach(p => { if (p) ownedPetIds.add(p.id) })
      if (this.petBag) this.petBag.forEach(p => { if (p) ownedPetIds.add(p.id) })
      const maxedPetIds = getMaxedPetIds(this)
      this.rewards = generateRewards(this.floor, this.curEvent ? this.curEvent.type : 'battle', this.lastSpeedKill, ownedWpnIds, this.sessionPetPool, ownedPetIds, maxedPetIds)
      this.selectedReward = -1
      this._rewardDetailShow = null
    }
    if (this.scene === 'loading') {
      const elapsed = Date.now() - this._loadStart
      if (this._loadReady && elapsed > 500) {
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
          // 教学多回合切换检查
          if (tutorial.isActive()) tutorial.onEnemyTurnEnd(this)
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
          battleEngine.onPlayerTurnStart(this)
          this.bState = 'playerTurn'; this.dragTimer = 0
          // 教学多回合切换检查
          if (tutorial.isActive()) tutorial.onEnemyTurnEnd(this)
        }
      }
    }
    anim.updateSwapAnim(this)
    anim.updateBattleAnims(this)
    anim.updateHpAnims(this)
    anim.updateSkillPreview(this)
    if (this.scene === 'ranking' && this.af % 7200 === 0) {
      this.storage.fetchRanking(this.rankTab, true)
    }
    // title场景：预置授权按钮；非title场景：销毁
    this._updateTitleAuthBtn()
    // title场景：预置反馈按钮；非title场景：销毁
    this._updateFeedbackBtn()
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
      case 'dex': screens.rDex(this); break
    }
    this.dmgFloats.forEach(f => R.drawDmgFloat(f))
    this.skillEffects.forEach(e => R.drawSkillEffect(e))
    if (this.skillCastAnim.active) R.drawSkillCast(this.skillCastAnim)
    // 教学引导层
    if (tutorial.isActive() && this.scene === 'battle') {
      battleView.drawTutorialOverlay(this)
    }
    // 宠物获得/升星提示弹窗（奖励等途径）
    if (this._petObtainedPopup) {
      eventView.drawPetObtainedPopup(this, this._petObtainedPopup)
    }
    // ★3满星庆祝画面（覆盖在奖励界面之上）
    if (this._star3Celebration) {
      dialogs.drawStar3Celebration(this)
    }
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
  async _openRanking() {
    console.log('[Ranking] Opening ranking page')
    this.storage.destroyUserInfoBtn()
    this.rankTab = 'all'
    this.rankScrollY = 0
    this.scene = 'ranking'
    if (this.storage._cloudReady) {
      // 先提交最新数据（包括速通、图鉴、连击），再拉取排行
      if (this.storage.userAuthorized && this.storage.bestFloor > 0) {
        await this.storage.submitScore(
          this.storage.bestFloor,
          this.storage.stats.bestFloorPets,
          this.storage.stats.bestFloorWeapon,
          this.storage.stats.bestTotalTurns || 0
        )
        await this.storage.submitDexAndCombo()
      }
      this.storage.fetchRanking('all', true)
    } else {
      console.warn('[Ranking] Cloud not ready, skipping fetch')
    }
  }

  // 在title场景中，如果用户未授权，预创建透明按钮覆盖排行按钮
  _updateTitleAuthBtn() {
    if (this.scene !== 'title') {
      this.storage.destroyUserInfoBtn()
      return
    }
    if (this.storage.userAuthorized) {
      this.storage.destroyUserInfoBtn()
      return
    }
    const btnRect = this._rankBtnRect
    if (!btnRect) return
    const cssRect = {
      left: btnRect[0] / dpr,
      top: btnRect[1] / dpr,
      width: btnRect[2] / dpr,
      height: btnRect[3] / dpr,
    }
    if (!this.storage._userInfoBtn) {
      // 首次创建透明授权按钮覆盖排行按钮
      console.log('[AuthBtn] 创建透明授权按钮, cssRect:', JSON.stringify(cssRect), 'canvasRect:', JSON.stringify(btnRect))
      this.storage.showUserInfoBtn(cssRect, (ok, info) => {
        console.log('[AuthBtn] 授权回调, ok:', ok, 'info:', info)
        if (ok) {
          console.log('[Ranking] 授权成功:', info.nickName, info.avatarUrl)
        } else {
          console.warn('[Ranking] 用户拒绝授权，以游客身份进入排行榜')
        }
        this._openRanking()
      })
    }
  }

  // 在title场景中，创建透明反馈按钮覆盖在Canvas"意见反馈"上
  _updateFeedbackBtn() {
    if (this.scene !== 'title' || this.showNewRunConfirm) {
      this._destroyFeedbackBtn(); return
    }
    const rect = this._feedbackBtnRect
    if (!rect) { this._destroyFeedbackBtn(); return }
    const cssRect = {
      left: rect[0] / dpr, top: rect[1] / dpr,
      width: rect[2] / dpr, height: rect[3] / dpr,
    }
    if (!this._feedbackBtn) {
      try {
        const btn = wx.createFeedbackButton({
          type: 'text', text: '',
          style: {
            left: cssRect.left, top: cssRect.top,
            width: cssRect.width, height: cssRect.height,
            backgroundColor: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)', borderWidth: 0, borderRadius: 0,
            color: 'rgba(0,0,0,0)', fontSize: 1, lineHeight: cssRect.height,
          },
        })
        this._feedbackBtn = btn
        btn.show()
      } catch(e) {
        console.warn('[Feedback] createFeedbackButton 失败:', e)
      }
    } else {
      try {
        this._feedbackBtn.style.left = cssRect.left
        this._feedbackBtn.style.top = cssRect.top
        this._feedbackBtn.style.width = cssRect.width
        this._feedbackBtn.style.height = cssRect.height
      } catch(e) {}
    }
  }

  _destroyFeedbackBtn() {
    if (this._feedbackBtn) {
      try { this._feedbackBtn.hide(); this._feedbackBtn.destroy() } catch(e) {}
      this._feedbackBtn = null
    }
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
      case 'dex': touchH.tDex(this,type,x,y); break
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
  _enterEvent() { this._eventPetDetail = null; this._eventPetDetailData = null; this._eventWpnDetail = null; this._eventWpnDetailData = null; this._eventDragPet = null; this._eventShopUsedCount = 0; this._eventShopUsedItems = null; this._shopSelectAttr = false; this._shopSelectPet = null; this.scene = 'event' }
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
        // 教学多回合切换检查
        if (tutorial.isActive()) tutorial.onEnemyTurnEnd(this)
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
  _applyShopPetByAttr(attr) { skillEngine.applyShopPetByAttr(this, attr) }
  _applyShopStarUp(petIdx) { return skillEngine.applyShopStarUp(this, petIdx) }
  _applyShopUpgradePet(petIdx, pct) { return skillEngine.applyShopUpgradePet(this, petIdx, pct) }
  _applyShopCdReduce(petIdx) { return skillEngine.applyShopCdReduce(this, petIdx) }
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
    // 绝对防御（dmgImmune）：所有伤害变为1点
    const immune = this.heroBuffs && this.heroBuffs.find(b => b.type === 'dmgImmune')
    if (immune && dmg > 1) dmg = 1
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

  }

  _onDefeat() { runMgr.onDefeat(this, W, H) }
  _doAdRevive() { runMgr.doAdRevive(this, W, H) }
  _adReviveCallback() { runMgr.adReviveCallback(this, W, H) }

  // ===== 分享 =====
  _getShareData() {
    const st = this.storage.stats
    const floor = this.storage.bestFloor
    const isCleared = floor >= 30
    const title = isCleared
      ? `我已通关灵宠消消塔！最速${st.bestTotalTurns || '??'}回合，你能超越吗？`
      : `我已攻到消消塔第${floor}层，你能比我更强吗？`
    return { title, imageUrl: isCleared ? 'assets/share/share_cleared.jpg' : 'assets/share/share_default.jpg' }
  }

  _shareStats() {
    const st = this.storage.stats
    const floor = this.storage.bestFloor
    const isCleared = floor >= 30
    const dexCount = (this.storage.petDex || []).length
    const bestTurns = st.bestTotalTurns || 0

    // 加载预设背景图，在上面叠加动态数据文字
    try {
      const bgImg = wx.createImage()
      bgImg.onload = () => {
        const shareCanvas = wx.createCanvas()
        const sw = bgImg.width || 500, sh = bgImg.height || 400
        shareCanvas.width = sw; shareCanvas.height = sh
        const sctx = shareCanvas.getContext('2d')

        // 绘制预设背景图
        sctx.drawImage(bgImg, 0, 0, sw, sh)

        // 内容区域边距（避开边框装饰）
        const padL = sw * 0.15, padR = sw * 0.85

        // ── 标题（顶部皇冠下方）──
        sctx.textAlign = 'center'
        sctx.fillStyle = '#f5e6c8'; sctx.font = `bold ${Math.round(sw*0.050)}px "PingFang SC",sans-serif`
        sctx.fillText('灵宠消消塔 · 战绩', sw/2, sh*0.15)

        // ── 核心成就（居中大字，在标题和数据之间）──
        sctx.fillStyle = '#ffd700'; sctx.font = `bold ${Math.round(sw*0.080)}px "PingFang SC",sans-serif`
        sctx.textAlign = 'center'
        sctx.save()
        sctx.shadowColor = 'rgba(255,215,0,0.4)'; sctx.shadowBlur = sw * 0.015
        sctx.fillText(isCleared ? '✦ 已通关 ✦' : `✦ 第 ${floor} 层 ✦`, sw/2, sh*0.30)
        sctx.restore()

        // ── 4行数据（对齐背景线条，标签左对齐，数值右对齐）──
        const dataStartY = sh * 0.40, lineH = sh * 0.105
        const labels = [
          { l: '最速通关', v: bestTurns > 0 ? `${bestTurns} 回合` : '未通关', c: bestTurns > 0 ? '#ff6b6b' : '#999' },
          { l: '图鉴收集', v: `${dexCount} / 100`, c: '#4dcc4d' },
          { l: '最高连击', v: `${st.maxCombo} Combo`, c: '#ff6b6b' },
          { l: '总挑战数', v: `${this.storage.totalRuns} 次`, c: '#4dabff' },
        ]
        const labelFont = `${Math.round(sw*0.034)}px "PingFang SC",sans-serif`
        const valueFont = `bold ${Math.round(sw*0.040)}px "PingFang SC",sans-serif`
        labels.forEach((d, i) => {
          const y = dataStartY + i * lineH
          sctx.textAlign = 'left'
          sctx.fillStyle = 'rgba(240,220,160,0.65)'; sctx.font = labelFont
          sctx.fillText(d.l, padL, y)
          sctx.textAlign = 'right'
          sctx.fillStyle = d.c; sctx.font = valueFont
          sctx.fillText(d.v, padR, y)
        })

        // ── 阵容（数据行下方）──
        const bfPets = st.bestFloorPets || []
        if (bfPets.length > 0) {
          const ty = dataStartY + labels.length * lineH + sh * 0.02
          sctx.textAlign = 'center'
          sctx.fillStyle = 'rgba(240,220,160,0.45)'; sctx.font = `${Math.round(sw*0.024)}px "PingFang SC",sans-serif`
          sctx.fillText('— 最高记录阵容 —', sw/2, ty)
          const petNames = bfPets.map(p => p.name).join(' · ')
          sctx.fillStyle = '#f0dca0'; sctx.font = `bold ${Math.round(sw*0.028)}px "PingFang SC",sans-serif`
          sctx.fillText(petNames, sw/2, ty + sh*0.045)
        }

        // ── 底部金色横幅文字 ──
        sctx.textAlign = 'center'
        sctx.fillStyle = '#3a2a10'; sctx.font = `bold ${Math.round(sw*0.030)}px "PingFang SC",sans-serif`
        sctx.fillText('快来挑战消消塔吧！', sw/2, sh*0.925)

        // 转为临时文件路径并分享
        const tempPath = `${wx.env.USER_DATA_PATH}/share_stats.png`
        const imgData = shareCanvas.toDataURL('image/png')
        const base64 = imgData.replace(/^data:image\/png;base64,/, '')
        const fs = wx.getFileSystemManager()
        fs.writeFileSync(tempPath, base64, 'base64')

        wx.shareAppMessage({
          title: isCleared
            ? `我已通关灵宠消消塔！最速${bestTurns || '??'}回合，来挑战！`
            : `我已攻到消消塔第${floor}层，你能超越吗？`,
          imageUrl: tempPath,
        })
      }
      bgImg.onerror = () => {
        console.warn('[Share] 加载分享背景图失败，使用默认分享')
        wx.shareAppMessage(this._getShareData())
      }
      bgImg.src = 'assets/share/share_stats.jpg'
    } catch(e) {
      console.warn('[Share] 生成分享图失败，使用默认分享:', e)
      wx.shareAppMessage(this._getShareData())
    }
  }

  _hitRect(x,y,rx,ry,rw,rh) { return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh }
}

new Main()
