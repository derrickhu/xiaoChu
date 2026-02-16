/**
 * 五行通天塔 - 主游戏逻辑
 * Roguelike爬塔 + 智龙迷城式拖拽转珠 + 五行克制
 * 无局外养成，死亡即重开，仅记录最高层数
 */
const { Render, A, TH } = require('./render')
const Storage = require('./data/storage')
const {
  ATTRS, ATTR_NAME, ATTR_COLOR, BEAD_ATTRS, BEAD_ATTR_NAME, BEAD_ATTR_COLOR,
  COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL, EVENT_TYPE, ENEMY_SKILLS,
  ADVENTURES, SHOP_ITEMS, REST_OPTIONS, REWARD_TYPES,
  generateMonster, generateElite, generateBoss,
  generateFloorEvent, generateRewards, getBeadWeights,
} = require('./data/tower')
const { generateStarterPets, randomPet, randomPetByAttr } = require('./data/pets')
const { generateStarterWeapon, randomWeapon } = require('./data/weapons')
const MusicMgr = require('./runtime/music')

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

class Main {
  constructor() {
    this.storage = new Storage()
    this.storage.onCloudReady = () => R.preloadCloudAssets()
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
    this._petFinalDmg = {} // preAttack阶段各宠物最终伤害（含combo等加成）
    this._petAtkRollTimer = 0 // 头像数值翻滚计时
    this.shakeT = 0; this.shakeI = 0
    this.heroAttackAnim = { active:false, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:false, progress:0, duration:18 }
    this.heroHurtAnim   = { active:false, progress:0, duration:18 }
    this.enemyAttackAnim= { active:false, progress:0, duration:20 }
    this.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
    this._enemyHpLoss = null; this._heroHpLoss = null

    // Run state (Roguelike)
    this.floor = 0
    this.pets = []          // [{...petData, attr, currentCd}] — 上场5只
    this.weapon = null      // 当前装备武器
    this.petBag = []        // 宠物背包，最多8只
    this.weaponBag = []     // 武器背包，最多4把
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
    this.prepareTip = null     // 详情Tips: {type:'pet'|'weapon', data, x, y}
    this._eventPetDetail = null // 事件页灵兽详情弹窗索引
    // 局内BUFF累积（全队全局生效，更换宠物不影响）
    this.runBuffs = {
      allAtkPct: 0, allDmgPct: 0,
      attrDmgPct: { metal:0, wood:0, earth:0, water:0, fire:0 },
      heartBoostPct: 0, weaponBoostPct: 0,
      extraTimeSec: 0,
      // 新增加成（参考策划案）
      hpMaxPct: 0,           // 血量上限加成%
      comboDmgPct: 0,        // Combo伤害加成%
      elim3DmgPct: 0,        // 3消伤害加成%
      elim4DmgPct: 0,        // 4消伤害加成%
      elim5DmgPct: 0,        // 5消伤害加成%
      counterDmgPct: 0,      // 克制伤害加成%
      skillDmgPct: 0,        // 宠物技能伤害加成%
      skillCdReducePct: 0,   // 宠物技能CD缩短%
      regenPerTurn: 0,       // 每回合自动回血
      dmgReducePct: 0,       // 受到伤害减少%
      bonusCombo: 0,         // 额外连击数
      stunDurBonus: 0,       // 5消眩晕+回合
      // 敌方减益
      enemyAtkReducePct: 0,  // 怪物攻击减少%
      enemyHpReducePct: 0,   // 怪物血量减少%
      enemyDefReducePct: 0,  // 怪物防御减少%
      eliteAtkReducePct: 0,  // 精英攻击减少%
      eliteHpReducePct: 0,   // 精英血量减少%
      bossAtkReducePct: 0,   // BOSS攻击减少%
      bossHpReducePct: 0,    // BOSS血量减少%
      // 临时/下一场
      nextDmgReducePct: 0,   // 下一场受伤减少%
      postBattleHealPct: 0,  // 战后额外回血%
      extraRevive: 0,        // 额外复活次数
    }
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
    this.showExitDialog = false
    this.showNewRunConfirm = false  // 首页"开始挑战"确认弹窗

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

    const loop = () => { this.af++; this.update(); this.render(); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  }

  // ===== Run管理 =====
  _startRun() {
    this.floor = 0
    this.pets = generateStarterPets()
    this.weapon = null
    this.petBag = []        // 宠物背包清空
    this.weaponBag = []     // 武器背包清空
    this.heroHp = 60; this.heroMaxHp = 60; this.heroShield = 0
    this.heroBuffs = []; this.enemyBuffs = []
    this.runBuffs = {
      allAtkPct:0, allDmgPct:0, attrDmgPct:{metal:0,wood:0,earth:0,water:0,fire:0},
      heartBoostPct:0, weaponBoostPct:0, extraTimeSec:0,
      hpMaxPct:0, comboDmgPct:0, elim3DmgPct:0, elim4DmgPct:0, elim5DmgPct:0,
      counterDmgPct:0, skillDmgPct:0, skillCdReducePct:0, regenPerTurn:0,
      dmgReducePct:0, bonusCombo:0, stunDurBonus:0,
      enemyAtkReducePct:0, enemyHpReducePct:0, enemyDefReducePct:0,
      eliteAtkReducePct:0, eliteHpReducePct:0, bossAtkReducePct:0, bossHpReducePct:0,
      nextDmgReducePct:0, postBattleHealPct:0, extraRevive:0,
    }
    this.skipNextBattle = false; this.nextStunEnemy = false; this.nextDmgDouble = false
    this.tempRevive = false; this.immuneOnce = false; this.comboNeverBreak = false
    this.weaponReviveUsed = false; this.goodBeadsNextTurn = false
    this.turnCount = 0; this.combo = 0
    this.storage._d.totalRuns++; this.storage._save()
    this._nextFloor()
  }

  _nextFloor() {
    this.floor++
    // 武器perFloorBuff
    if (this.weapon && this.weapon.type === 'perFloorBuff' && this.floor > 1 && (this.floor - 1) % this.weapon.per === 0) {
      if (this.weapon.field === 'atk') this.runBuffs.allAtkPct += this.weapon.pct
      else if (this.weapon.field === 'hpMax') {
        const inc = Math.round(this.heroMaxHp * this.weapon.pct / 100)
        this.heroMaxHp += inc; this.heroHp += inc
      }
    }
    this.curEvent = generateFloorEvent(this.floor)
    // 跳过战斗？
    if (this.skipNextBattle && (this.curEvent.type === 'battle' || this.curEvent.type === 'elite')) {
      this.skipNextBattle = false
      this.curEvent = { type: EVENT_TYPE.ADVENTURE, data: ADVENTURES[Math.floor(Math.random()*ADVENTURES.length)] }
    }
    // 进入战前编辑/预览场景
    this.prepareTab = 'pets'
    this.prepareSelBagIdx = -1
    this.prepareSelSlotIdx = -1
    this.scene = 'prepare'
  }

  _endRun() {
    this.storage.updateBestFloor(this.floor, this.pets, this.weapon)
    this.storage.clearRunState()
    this.scene = 'gameover'
  }

  // 暂存退出：保存当前局内所有状态，回到标题页
  _saveAndExit() {
    const runState = {
      floor: this.floor,
      pets: JSON.parse(JSON.stringify(this.pets)),
      weapon: this.weapon ? JSON.parse(JSON.stringify(this.weapon)) : null,
      petBag: JSON.parse(JSON.stringify(this.petBag)),
      weaponBag: JSON.parse(JSON.stringify(this.weaponBag)),
      heroHp: this.heroHp, heroMaxHp: this.heroMaxHp, heroShield: this.heroShield,
      heroBuffs: JSON.parse(JSON.stringify(this.heroBuffs)),
      runBuffs: JSON.parse(JSON.stringify(this.runBuffs)),
      skipNextBattle: this.skipNextBattle, nextStunEnemy: this.nextStunEnemy, nextDmgDouble: this.nextDmgDouble,
      tempRevive: this.tempRevive, immuneOnce: this.immuneOnce, comboNeverBreak: this.comboNeverBreak,
      weaponReviveUsed: this.weaponReviveUsed, goodBeadsNextTurn: this.goodBeadsNextTurn,
      curEvent: this.curEvent ? JSON.parse(JSON.stringify(this.curEvent)) : null,
    }
    this.storage.saveRunState(runState)
    this.showExitDialog = false
    this.bState = 'none'
    this.scene = 'title'
  }

  // 恢复暂存进度：从存档恢复到 prepare 页
  _resumeRun() {
    const s = this.storage.loadRunState()
    if (!s) return
    this.floor = s.floor
    this.pets = s.pets
    this.weapon = s.weapon
    this.petBag = s.petBag || []
    this.weaponBag = s.weaponBag || []
    this.heroHp = s.heroHp; this.heroMaxHp = s.heroMaxHp; this.heroShield = s.heroShield || 0
    this.heroBuffs = s.heroBuffs || []; this.enemyBuffs = []
    this.runBuffs = s.runBuffs || {
      allAtkPct:0, allDmgPct:0, attrDmgPct:{metal:0,wood:0,earth:0,water:0,fire:0},
      heartBoostPct:0, weaponBoostPct:0, extraTimeSec:0,
      hpMaxPct:0, comboDmgPct:0, elim3DmgPct:0, elim4DmgPct:0, elim5DmgPct:0,
      counterDmgPct:0, skillDmgPct:0, skillCdReducePct:0, regenPerTurn:0,
      dmgReducePct:0, bonusCombo:0, stunDurBonus:0,
      enemyAtkReducePct:0, enemyHpReducePct:0, enemyDefReducePct:0,
      eliteAtkReducePct:0, eliteHpReducePct:0, bossAtkReducePct:0, bossHpReducePct:0,
      nextDmgReducePct:0, postBattleHealPct:0, extraRevive:0,
    }
    // 兼容旧存档：补充缺失的新字段
    const rbDefaults = { hpMaxPct:0, comboDmgPct:0, elim3DmgPct:0, elim4DmgPct:0, elim5DmgPct:0,
      counterDmgPct:0, skillDmgPct:0, skillCdReducePct:0, regenPerTurn:0,
      dmgReducePct:0, bonusCombo:0, stunDurBonus:0,
      enemyAtkReducePct:0, enemyHpReducePct:0, enemyDefReducePct:0,
      eliteAtkReducePct:0, eliteHpReducePct:0, bossAtkReducePct:0, bossHpReducePct:0,
      nextDmgReducePct:0, postBattleHealPct:0, extraRevive:0 }
    for (const k in rbDefaults) { if (this.runBuffs[k] === undefined) this.runBuffs[k] = rbDefaults[k] }
    this.skipNextBattle = s.skipNextBattle || false
    this.nextStunEnemy = s.nextStunEnemy || false
    this.nextDmgDouble = s.nextDmgDouble || false
    this.tempRevive = s.tempRevive || false
    this.immuneOnce = s.immuneOnce || false
    this.comboNeverBreak = s.comboNeverBreak || false
    this.weaponReviveUsed = s.weaponReviveUsed || false
    this.goodBeadsNextTurn = s.goodBeadsNextTurn || false
    this.turnCount = 0; this.combo = 0
    this.curEvent = s.curEvent
    this.storage.clearRunState()
    // 进入 prepare 页面
    this.prepareTab = 'pets'
    this.prepareSelBagIdx = -1
    this.prepareSelSlotIdx = -1
    this.scene = 'prepare'
  }

  // ===== 更新 =====
  update() {
    if (this.shakeT > 0) this.shakeT--
    this.dmgFloats = this.dmgFloats.filter(f => {
      f.t++
      if (f.t <= 20) f.y -= 0.3*S
      else if (f.t <= 50) { f.y -= 0.8*S; f.alpha -= 0.01 }
      else { f.y -= 1.2*S; f.alpha -= 0.04 }
      return f.alpha > 0
    })
    this.skillEffects = this.skillEffects.filter(e => { e.t++; e.y -= 0.6*S; e.alpha -= 0.012; return e.alpha > 0 })
    // 消除棋子处飘字动画
    this.elimFloats = this.elimFloats.filter(f => {
      f.t++
      f.y -= 0.6*S
      f.scale = (f.scale || 1) * (f.t < 6 ? 1.03 : 1.0)
      if (f.t > 30) f.alpha -= 0.04
      return f.alpha > 0 && f.t < 60
    })
    // 宠物头像攻击数值动画
    this.petAtkNums = this.petAtkNums.filter(f => {
      f.t++
      if (f.t <= f.rollFrames) {
        // 翻滚阶段：数值快速递增到最终值
        const progress = f.t / f.rollFrames
        const ease = 1 - Math.pow(1 - progress, 3)
        f.displayVal = Math.round(f.finalVal * ease)
        f.text = `${f.displayVal}`
        f.scale = 1.0 + 0.2 * Math.sin(f.t * 0.8)
        if (f.t % 4 === 0) MusicMgr.playRolling()
      } else {
        // 翻滚结束：保持显示
        f.text = `${f.finalVal}`
        f.scale = 1.0
        if (f.t > f.rollFrames + 20) f.alpha -= 0.05
      }
      return f.alpha > 0
    })
    if (this.scene === 'loading' && Date.now() - this._loadStart > 1500) {
      this.scene = 'title'; MusicMgr.playBgm()
    }
    if (this.bState === 'elimAnim') this._processElim()
    if (this.bState === 'dropping') this._processDropAnim()
    if (this.dragging && this.bState === 'playerTurn') {
      this.dragTimer++
      if (this.dragTimer >= this.dragTimeLimit) {
        this.dragging = false; this.dragAttr = null; this.dragTimer = 0
        this._checkAndElim()
      }
    }
    if (this.bState === 'petAtkShow') {
      // 宠物头像攻击数值翻滚展示阶段
      this._stateTimer++
      if (this._stateTimer >= 50) {
        this._stateTimer = 0
        this.bState = 'preAttack'
      }
    }
    if (this.bState === 'preAttack') {
      this._stateTimer++; if (this._stateTimer >= 15) { this._stateTimer = 0; this._executeAttack() }
    }
    if (this.bState === 'preEnemy') {
      this._stateTimer++; if (this._stateTimer >= 30) { this._stateTimer = 0; this._enemyTurn() }
    }
    if (this.bState === 'enemyTurn' && this._enemyTurnWait) {
      this._stateTimer++
      if (this._stateTimer >= 36) { this._stateTimer = 0; this._enemyTurnWait = false; this.bState = 'playerTurn'; this.dragTimer = 0 }
    }
    this._updateSwapAnim()
    this._updateBattleAnims()
    if (this._enemyHpLoss) { this._enemyHpLoss.timer++; if (this._enemyHpLoss.timer >= 45) this._enemyHpLoss = null }
    if (this._heroHpLoss) { this._heroHpLoss.timer++; if (this._heroHpLoss.timer >= 45) this._heroHpLoss = null }
  }

  _updateBattleAnims() {
    [this.heroAttackAnim, this.enemyHurtAnim, this.heroHurtAnim, this.enemyAttackAnim, this.skillCastAnim].forEach(a => {
      if (a.active) { a.progress += 1/a.duration; if (a.progress >= 1) { a.active = false; a.progress = 0 } }
    })
  }

  _updateSwapAnim() {
    if (!this.swapAnim) return
    this.swapAnim.t++
    if (this.swapAnim.t >= this.swapAnim.dur) this.swapAnim = null
  }

  // ===== 渲染入口 =====
  render() {
    ctx.clearRect(0, 0, W, H)
    const sx = this.shakeT > 0 ? (Math.random()-0.5)*this.shakeI*S : 0
    const sy = this.shakeT > 0 ? (Math.random()-0.5)*this.shakeI*S : 0
    ctx.save(); ctx.translate(sx, sy)
    switch(this.scene) {
      case 'loading': this._rLoading(); break
      case 'title': this._rTitle(); break
      case 'prepare': this._rPrepare(); break
      case 'event': this._rEvent(); break
      case 'battle': this._rBattle(); break
      case 'reward': this._rReward(); break
      case 'shop': this._rShop(); break
      case 'rest': this._rRest(); break
      case 'adventure': this._rAdventure(); break
      case 'gameover': this._rGameover(); break
    }
    // 飘字&特效
    this.dmgFloats.forEach(f => R.drawDmgFloat(f))
    this.skillEffects.forEach(e => R.drawSkillEffect(e))
    if (this.skillCastAnim.active) R.drawSkillCast(this.skillCastAnim)
    ctx.restore()
  }

  // ===== 场景渲染 =====
  _rLoading() {
    R.drawLoadingBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${28*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('五行通天塔', W*0.5, H*0.4)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    ctx.fillText('正在加载...', W*0.5, H*0.5)
  }

  _rTitle() {
    R.drawHomeBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${32*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('五行通天塔', W*0.5, H*0.22)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    ctx.fillText(`最高记录：第 ${this.storage.bestFloor} 层`, W*0.5, H*0.30)
    ctx.fillText(`挑战次数：${this.storage.totalRuns}`, W*0.5, H*0.35)

    const hasSave = this.storage.hasSavedRun()
    if (hasSave) {
      const saved = this.storage.loadRunState()
      // 继续挑战按钮（高亮）
      const cbx = W*0.25, cby = H*0.48, cbw = W*0.5, cbh = 50*S
      R.drawBtn(cbx, cby, cbw, cbh, `继续挑战 (第${saved.floor}层)`, TH.accent, 16)
      this._titleContinueRect = [cbx, cby, cbw, cbh]
      // 开始挑战按钮（次级）
      const bx = W*0.25, by = H*0.60, bw = W*0.5, bh = 44*S
      R.drawBtn(bx, by, bw, bh, '开始挑战', TH.info, 15)
      this._titleBtnRect = [bx, by, bw, bh]
      // 统计按钮
      const sx = W*0.3, sy = H*0.72, sw = W*0.4, sh = 40*S
      R.drawBtn(sx, sy, sw, sh, '历史统计', TH.info, 14)
      this._statBtnRect = [sx, sy, sw, sh]
    } else {
      this._titleContinueRect = null
      // 开始按钮
      const bx = W*0.25, by = H*0.55, bw = W*0.5, bh = 50*S
      R.drawBtn(bx, by, bw, bh, '开始挑战', TH.accent, 18)
      this._titleBtnRect = [bx, by, bw, bh]
      // 统计按钮
      const sx = W*0.3, sy = H*0.67, sw = W*0.4, sh = 40*S
      R.drawBtn(sx, sy, sw, sh, '历史统计', TH.info, 14)
      this._statBtnRect = [sx, sy, sw, sh]
    }

    // 开始挑战确认弹窗（覆盖在最上层）
    if (this.showNewRunConfirm) this._drawNewRunConfirm()
  }

  _rPrepare() {
    R.drawBg(this.af)
    const padX = 12*S
    // 标题：下一层信息
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`第 ${this.floor} 层`, W*0.5, safeTop + 36*S)
    // 事件类型
    const ev = this.curEvent
    if (ev) {
      const typeName = { battle:'普通战斗', elite:'精英战斗', boss:'BOSS挑战', adventure:'奇遇', shop:'神秘商店', rest:'休息之地' }
      ctx.fillStyle = TH.text; ctx.font = `bold ${16*S}px sans-serif`
      ctx.fillText(typeName[ev.type] || '未知事件', W*0.5, safeTop + 60*S)
      // 战斗类事件显示怪物属性
      if (ev.type === 'battle' || ev.type === 'elite' || ev.type === 'boss') {
        const e = ev.data
        const ac = ATTR_COLOR[e.attr]
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${14*S}px sans-serif`
        ctx.fillText(`${e.name}  [${ATTR_NAME[e.attr]}属性]  HP:${e.hp}  ATK:${e.atk}`, W*0.5, safeTop + 82*S)
      }
    }
    // Tab切换：宠物 / 武器
    const tabY = safeTop + 98*S, tabH = 32*S, tabW = W*0.35
    const petTabX = W*0.1, wpnTabX = W*0.55
    ctx.fillStyle = this.prepareTab === 'pets' ? TH.accent : TH.card
    R.rr(petTabX, tabY, tabW, tabH, 6*S); ctx.fill()
    ctx.fillStyle = this.prepareTab === 'pets' ? '#fff' : TH.sub; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('灵兽编辑', petTabX+tabW*0.5, tabY+tabH*0.65)
    this._prepPetTabRect = [petTabX, tabY, tabW, tabH]
    ctx.fillStyle = this.prepareTab === 'weapon' ? TH.accent : TH.card
    R.rr(wpnTabX, tabY, tabW, tabH, 6*S); ctx.fill()
    ctx.fillStyle = this.prepareTab === 'weapon' ? '#fff' : TH.sub
    ctx.fillText('武器切换', wpnTabX+tabW*0.5, tabY+tabH*0.65)
    this._prepWpnTabRect = [wpnTabX, tabY, tabW, tabH]

    const contentY = tabY + tabH + 12*S
    if (this.prepareTab === 'pets') {
      // 上场宠物（5格）
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText('上场灵兽（5只）：', padX, contentY + 12*S)
      const slotGap = 4*S
      const iconSz = Math.floor((W - padX*2 - slotGap*4) / 5)
      const textH = 28*S  // 头像框下方文字区高度
      const slotW = iconSz, slotH = iconSz + textH
      const slotY = contentY + 20*S
      const frameScale = 1.12
      const frameSz = iconSz * frameScale
      const fOff = (frameSz - iconSz) / 2
      // 加载五行边框
      const fMap = {
        metal: R.getImg('assets/ui/frame_pet_metal.png'),
        wood:  R.getImg('assets/ui/frame_pet_wood.png'),
        water: R.getImg('assets/ui/frame_pet_water.png'),
        fire:  R.getImg('assets/ui/frame_pet_fire.png'),
        earth: R.getImg('assets/ui/frame_pet_earth.png'),
      }
      this._prepSlotRects = []
      for (let i = 0; i < 5; i++) {
        const sx = padX + i*(iconSz+slotGap)
        const isSel = this.prepareSelSlotIdx === i
        const p = this.pets[i]
        const ac = p ? ATTR_COLOR[p.attr] : null
        const cx = sx + iconSz*0.5, cy = slotY + iconSz*0.5

        // 头像底色
        ctx.fillStyle = p ? (ac ? ac.bg : '#1a1a2e') : 'rgba(18,18,30,0.6)'
        ctx.fillRect(sx+1, slotY+1, iconSz-2, iconSz-2)

        if (p) {
          // 属性光晕
          ctx.save()
          const grd = ctx.createRadialGradient(cx, cy-iconSz*0.06, 0, cx, cy-iconSz*0.06, iconSz*0.38)
          grd.addColorStop(0, (ac ? ac.main : '#888')+'40')
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd
          ctx.fillRect(sx, slotY, iconSz, iconSz)
          ctx.restore()

          // 头像图片（保持比例、底部对齐）
          const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
          if (petAvatar && petAvatar.width > 0) {
            const aw = petAvatar.width, ah = petAvatar.height
            const drawW = iconSz - 2, drawH = drawW * (ah / aw)
            const dy = slotY + 1 + (iconSz - 2) - drawH  // 底部对齐
            ctx.save(); ctx.beginPath(); ctx.rect(sx+1, slotY+1, iconSz-2, iconSz-2); ctx.clip()
            ctx.drawImage(petAvatar, sx+1, dy, drawW, drawH)
            ctx.restore()
          } else {
            // 无图时显示属性字
            ctx.fillStyle = ac ? ac.main : TH.text
            ctx.font = `bold ${iconSz*0.35}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(ATTR_NAME[p.attr]||'', cx, cy)
          }

          // 属性边框图片
          const pf = fMap[p.attr] || fMap.metal
          if (pf && pf.width > 0) {
            ctx.drawImage(pf, sx-fOff, slotY-fOff, frameSz, frameSz)
          }

          // 选中高亮
          if (isSel) {
            ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
            ctx.strokeRect(sx-1, slotY-1, iconSz+2, iconSz+2)
          }

          // 头像框下方：名称 + ATK
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'
          ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
          ctx.fillText(p.name.substring(0,5), cx, slotY+iconSz+3*S)
          ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
          ctx.fillText(`ATK:${p.atk}`, cx, slotY+iconSz+14*S)
        } else {
          // 空槽 + 半透明边框
          const pf = fMap.metal
          if (pf && pf.width > 0) {
            ctx.save(); ctx.globalAlpha = 0.35
            ctx.drawImage(pf, sx-fOff, slotY-fOff, frameSz, frameSz)
            ctx.restore()
          }
        }
        this._prepSlotRects.push([sx, slotY, slotW, slotH])
      }
      // 背包宠物
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      const bagLabelY = slotY + slotH + 16*S
      ctx.fillText(`灵兽背包（${this.petBag.length}/8）：`, padX, bagLabelY)
      const bagY = bagLabelY + 8*S
      const bagGap = 4*S
      const bagIcon = Math.floor((W - padX*2 - bagGap*3) / 4)
      const bagTextH = 28*S
      const bagW = bagIcon, bagH = bagIcon + bagTextH
      const bFrameSz = bagIcon * frameScale
      const bfOff = (bFrameSz - bagIcon) / 2
      this._prepBagRects = []
      for (let i = 0; i < Math.max(this.petBag.length, 1); i++) {
        const bx = padX + (i%4)*(bagIcon+bagGap), by = bagY + Math.floor(i/4)*(bagH+bagGap)
        const bp = this.petBag[i]
        const isSel = this.prepareSelBagIdx === i
        const ac = bp ? ATTR_COLOR[bp.attr] : null
        const bcx = bx + bagIcon*0.5, bcy = by + bagIcon*0.5

        // 头像底色
        ctx.fillStyle = bp ? (ac ? ac.bg : '#1a1a2e') : 'rgba(18,18,30,0.6)'
        ctx.fillRect(bx+1, by+1, bagIcon-2, bagIcon-2)

        if (bp) {
          // 属性光晕
          ctx.save()
          const bgrd = ctx.createRadialGradient(bcx, bcy-bagIcon*0.06, 0, bcx, bcy-bagIcon*0.06, bagIcon*0.38)
          bgrd.addColorStop(0, (ac ? ac.main : '#888')+'40')
          bgrd.addColorStop(1, 'transparent')
          ctx.fillStyle = bgrd
          ctx.fillRect(bx, by, bagIcon, bagIcon)
          ctx.restore()

          // 头像图片（保持比例、底部对齐）
          const bpAvatar = R.getImg(`assets/pets/pet_${bp.id}.png`)
          if (bpAvatar && bpAvatar.width > 0) {
            const baw = bpAvatar.width, bah = bpAvatar.height
            const bdW = bagIcon - 2, bdH = bdW * (bah / baw)
            const bdy = by + 1 + (bagIcon - 2) - bdH  // 底部对齐
            ctx.save(); ctx.beginPath(); ctx.rect(bx+1, by+1, bagIcon-2, bagIcon-2); ctx.clip()
            ctx.drawImage(bpAvatar, bx+1, bdy, bdW, bdH)
            ctx.restore()
          } else {
            ctx.fillStyle = ac ? ac.main : TH.text
            ctx.font = `bold ${bagIcon*0.35}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(ATTR_NAME[bp.attr]||'', bcx, bcy)
          }

          // 属性边框
          const bf = fMap[bp.attr] || fMap.metal
          if (bf && bf.width > 0) {
            ctx.drawImage(bf, bx-bfOff, by-bfOff, bFrameSz, bFrameSz)
          }

          // 选中高亮
          if (isSel) {
            ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
            ctx.strokeRect(bx-1, by-1, bagIcon+2, bagIcon+2)
          }

          // 下方：名称 + ATK
          ctx.textAlign = 'center'; ctx.textBaseline = 'top'
          ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
          ctx.fillText(bp.name.substring(0,5), bcx, by+bagIcon+3*S)
          ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
          ctx.fillText(`ATK:${bp.atk}`, bcx, by+bagIcon+14*S)
        } else {
          // 空槽
          const bf = fMap.metal
          if (bf && bf.width > 0) {
            ctx.save(); ctx.globalAlpha = 0.35
            ctx.drawImage(bf, bx-bfOff, by-bfOff, bFrameSz, bFrameSz)
            ctx.restore()
          }
          ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('空', bcx, bcy)
        }
        this._prepBagRects.push([bx, by, bagW, bagH])
      }
      // 交换按钮
      if (this.prepareSelSlotIdx >= 0 && this.prepareSelBagIdx >= 0 && this.petBag[this.prepareSelBagIdx]) {
        const swapBtnY = bagY + (Math.ceil(Math.max(this.petBag.length,1)/4))*(bagH+bagGap) + 8*S
        const swapBtnX = W*0.25, swapBtnW = W*0.5, swapBtnH = 38*S
        R.drawBtn(swapBtnX, swapBtnY, swapBtnW, swapBtnH, '交换上场', TH.accent, 14)
        this._prepSwapBtnRect = [swapBtnX, swapBtnY, swapBtnW, swapBtnH]
      } else {
        this._prepSwapBtnRect = null
      }
    } else {
      // 武器切换Tab
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText('当前武器：', padX, contentY + 12*S)
      const curWpnY = contentY + 20*S
      if (this.weapon) {
        const ac = ATTR_COLOR[this.weapon.attr]
        ctx.fillStyle = ac ? ac.bg : TH.card
        R.rr(padX, curWpnY, W-padX*2, 50*S, 8*S); ctx.fill()
        ctx.strokeStyle = TH.accent; ctx.lineWidth = 2*S; ctx.stroke()
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${14*S}px sans-serif`; ctx.textAlign = 'center'
        ctx.fillText(`⚔ ${this.weapon.name} [${ATTR_NAME[this.weapon.attr]}]`, W*0.5, curWpnY+22*S)
        ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
        ctx.fillText(this.weapon.desc, W*0.5, curWpnY+40*S)
        this._prepCurWpnRect = [padX, curWpnY, W-padX*2, 50*S]
      } else {
        ctx.fillStyle = TH.card; R.rr(padX, curWpnY, W-padX*2, 50*S, 8*S); ctx.fill()
        ctx.fillStyle = TH.dim; ctx.font = `${13*S}px sans-serif`; ctx.textAlign = 'center'
        ctx.fillText('无武器', W*0.5, curWpnY+30*S)
        this._prepCurWpnRect = null
      }
      // 武器背包
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      const wBagLabelY = curWpnY + 60*S
      ctx.fillText(`武器背包（${this.weaponBag.length}/4）：`, padX, wBagLabelY)
      const wBagY = wBagLabelY + 8*S
      const wCardH = 50*S, wGap = 6*S
      this._prepWpnBagRects = []
      for (let i = 0; i < this.weaponBag.length; i++) {
        const wy = wBagY + i*(wCardH+wGap)
        const wp = this.weaponBag[i]
        const ac = ATTR_COLOR[wp.attr]
        ctx.fillStyle = ac ? ac.bg : TH.card
        R.rr(padX, wy, W-padX*2, wCardH, 8*S); ctx.fill()
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
        ctx.fillText(`⚔ ${wp.name} [${ATTR_NAME[wp.attr]}]`, W*0.5, wy+20*S)
        ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
        ctx.fillText(wp.desc, W*0.5, wy+38*S)
        // 装备按钮
        const eqBtnW = 60*S, eqBtnH = 26*S, eqBtnX = W - padX - eqBtnW - 4*S, eqBtnY = wy + 10*S
        R.drawBtn(eqBtnX, eqBtnY, eqBtnW, eqBtnH, '装备', TH.info, 11)
        this._prepWpnBagRects.push([padX, wy, W-padX*2, wCardH, eqBtnX, eqBtnY, eqBtnW, eqBtnH])
      }
      if (this.weaponBag.length === 0) {
        ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
        ctx.fillText('背包空空如也', W*0.5, wBagY + 20*S)
      }
    }
    // 底部：英雄HP条（出发按钮上方）
    const prepHpBarH = 18*S
    const prepHpBarY = H - 60*S - prepHpBarH - 12*S
    R.drawHp(padX, prepHpBarY, W - padX*2, prepHpBarH, this.heroHp, this.heroMaxHp, TH.success, null, true)
    // 底部：出发按钮
    const goBtnX = W*0.2, goBtnY = H - 60*S, goBtnW = W*0.6, goBtnH = 46*S
    R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '出发', TH.accent, 18)
    this._prepGoBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]

    // ===== 详情Tips浮层 =====
    this._drawPrepareTip()
    // 左上角返回按钮
    this._drawBackBtn()
  }

  // 绘制详情Tips浮层
  _drawPrepareTip() {
    const tip = this.prepareTip
    if (!tip || !tip.data) return

    const d = tip.data
    const padX = 14*S, padY = 10*S
    const tipW = W * 0.78
    const lineH = 18*S

    // 计算内容行数和高度
    let lines = []
    if (tip.type === 'pet') {
      const ac = ATTR_COLOR[d.attr]
      lines.push({ text: d.name, color: ac ? ac.main : TH.text, bold: true, size: 15 })
      lines.push({ text: `属性：${ATTR_NAME[d.attr] || '?'}　　ATK：${d.atk}`, color: TH.sub, size: 11 })
      lines.push({ text: `冷却：${d.cd} 回合`, color: TH.dim, size: 11 })
      if (d.skill) {
        lines.push({ text: '', size: 6 }) // 分隔
        lines.push({ text: `技能：${d.skill.name}`, color: TH.accent, bold: true, size: 12 })
        // 技能描述可能较长，手动换行
        const descLines = this._wrapText(d.skill.desc || '', tipW - padX*2, 11)
        for (const dl of descLines) {
          lines.push({ text: dl, color: TH.text, size: 11 })
        }
      }
    } else if (tip.type === 'weapon') {
      const ac = ATTR_COLOR[d.attr]
      lines.push({ text: `⚔ ${d.name}`, color: ac ? ac.main : TH.text, bold: true, size: 15 })
      lines.push({ text: `属性：${ATTR_NAME[d.attr] || '?'}`, color: TH.sub, size: 11 })
      if (d.desc) {
        lines.push({ text: '', size: 6 }) // 分隔
        const descLines = this._wrapText(d.desc, tipW - padX*2, 11)
        for (const dl of descLines) {
          lines.push({ text: dl, color: TH.text, size: 11 })
        }
      }
    }

    // 计算总高度
    let totalH = padY * 2
    for (const l of lines) totalH += l.size === 6 ? 6*S : lineH

    // 定位：居中显示，纵向在屏幕中间偏上
    const tipX = (W - tipW) / 2
    const tipY = Math.min(Math.max(tip.y - totalH - 10*S, safeTop + 10*S), H - totalH - 80*S)

    // 半透明遮罩（全屏）
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, 0, W, H)

    // 卡片背景
    ctx.fillStyle = 'rgba(20,20,36,0.96)'
    R.rr(tipX, tipY, tipW, totalH, 10*S); ctx.fill()
    ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.5*S
    R.rr(tipX, tipY, tipW, totalH, 10*S); ctx.stroke()

    // 绘制文字
    let curY = tipY + padY
    ctx.textAlign = 'left'
    for (const l of lines) {
      if (l.size === 6) { curY += 6*S; continue }
      curY += lineH
      ctx.fillStyle = l.color || TH.text
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px sans-serif`
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
    }

    // 关闭提示
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH + 16*S)

    ctx.restore()

    // 记录遮罩区域用于关闭
    this._prepTipOverlay = true
  }

  // 文本换行辅助
  _wrapText(text, maxW, fontSize) {
    const charW = fontSize * S * 0.55 // 粗略估算每字符宽度
    const maxChars = Math.floor(maxW / charW)
    if (maxChars <= 0) return [text]
    const result = []
    let rest = text
    while (rest.length > 0) {
      result.push(rest.substring(0, maxChars))
      rest = rest.substring(maxChars)
    }
    return result.length > 0 ? result : [text]
  }

  _rEvent() {
    R.drawBg(this.af)
    const ev = this.curEvent
    if (!ev) return
    const padX = 12*S
    const isBattle = ev.type === 'battle' || ev.type === 'elite' || ev.type === 'boss'
    const typeName = { battle:'普通战斗', elite:'精英战斗', boss:'BOSS挑战', adventure:'奇遇', shop:'神秘商店', rest:'休息之地' }

    // ===== 顶部：层数 + 事件类型 =====
    let curY = safeTop + 32*S
    ctx.textAlign = 'center'
    ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`
    ctx.fillText(`── 第 ${this.floor} 层 ──`, W*0.5, curY)
    curY += 22*S
    // 精英/Boss醒目标记
    const evLabel = typeName[ev.type] || '未知事件'
    if (ev.type === 'boss') {
      // Boss：红底金字大标签
      const tagW = 140*S, tagH = 28*S, tagX = (W - tagW)/2, tagY = curY - 17*S
      ctx.fillStyle = 'rgba(180,30,30,0.85)'; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.fill()
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5*S; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.stroke()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px sans-serif`
      ctx.fillText('⚠ ' + evLabel + ' ⚠', W*0.5, curY)
    } else if (ev.type === 'elite') {
      // 精英：紫底白字标签
      const tagW = 120*S, tagH = 26*S, tagX = (W - tagW)/2, tagY = curY - 16*S
      ctx.fillStyle = 'rgba(120,50,180,0.8)'; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.fill()
      ctx.strokeStyle = 'rgba(200,150,255,0.6)'; ctx.lineWidth = 1; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.stroke()
      ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${14*S}px sans-serif`
      ctx.fillText('★ ' + evLabel, W*0.5, curY)
    } else {
      ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px sans-serif`
      ctx.fillText(evLabel, W*0.5, curY)
    }
    curY += 18*S

    // ===== 怪物信息卡片（战斗类事件） =====
    if (isBattle) {
      const e = ev.data
      const ac = ATTR_COLOR[e.attr]
      // 卡片背景
      const cardX = padX, cardW = W - padX*2, cardTop = curY, cardH = 130*S
      ctx.fillStyle = 'rgba(15,15,30,0.75)'
      R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.fill()
      ctx.strokeStyle = ac ? ac.main + '66' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
      R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.stroke()

      // 怪物头像（左侧）
      const avatarSize = 80*S
      const avatarX = cardX + 16*S
      const avatarY = cardTop + (cardH - avatarSize) / 2
      // 头像底色
      ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
      R.rr(avatarX, avatarY, avatarSize, avatarSize, 8*S); ctx.fill()
      // 加载头像图片
      const avatarPath = e.avatar ? e.avatar + '.jpg' : null
      const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
      if (enemyImg && enemyImg.width > 0) {
        ctx.save()
        ctx.beginPath(); R.rr(avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2, 7*S); ctx.clip()
        ctx.drawImage(enemyImg, avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2)
        ctx.restore()
      } else {
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${28*S}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(ATTR_NAME[e.attr] || '?', avatarX + avatarSize/2, avatarY + avatarSize/2)
        ctx.textBaseline = 'alphabetic'
      }
      // 头像边框
      ctx.strokeStyle = ac ? ac.main : '#666'; ctx.lineWidth = 2*S
      R.rr(avatarX, avatarY, avatarSize, avatarSize, 8*S); ctx.stroke()

      // 右侧：怪物信息
      const infoX = avatarX + avatarSize + 16*S
      let infoY = cardTop + 28*S
      ctx.textAlign = 'left'
      // 怪物名
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${16*S}px sans-serif`
      ctx.fillText(e.name, infoX, infoY)
      infoY += 24*S
      // 属性标签
      ctx.fillStyle = ac ? ac.bg : '#333'
      const tagW = 70*S, tagH = 22*S
      R.rr(infoX, infoY - 15*S, tagW, tagH, 4*S); ctx.fill()
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${12*S}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(`${ATTR_NAME[e.attr]}属性`, infoX + tagW/2, infoY)
      ctx.textAlign = 'left'
      infoY += 26*S
      // 弱点
      const weakAttr = COUNTER_BY[e.attr]
      if (weakAttr) {
        const wc = ATTR_COLOR[weakAttr]
        ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
        ctx.fillText('弱点：', infoX, infoY)
        const weakLabelX = infoX + 40*S
        ctx.fillStyle = wc ? wc.bg : '#333'
        const wTagW = 60*S
        R.rr(weakLabelX, infoY - 13*S, wTagW, 20*S, 4*S); ctx.fill()
        ctx.fillStyle = wc ? wc.main : TH.accent; ctx.font = `bold ${12*S}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(`${ATTR_NAME[weakAttr]}属性`, weakLabelX + wTagW/2, infoY)
        ctx.textAlign = 'left'
      }
      curY = cardTop + cardH + 12*S
    } else if (ev.type === 'adventure') {
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.text; ctx.font = `bold ${16*S}px sans-serif`
      ctx.fillText(ev.data.name, W*0.5, curY + 20*S)
      ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
      ctx.fillText(ev.data.desc, W*0.5, curY + 44*S)
      curY += 70*S
    } else if (ev.type === 'shop') {
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
      ctx.fillText('可免费选择一件物品', W*0.5, curY + 20*S)
      curY += 50*S
    } else if (ev.type === 'rest') {
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
      ctx.fillText('选择一项休息效果', W*0.5, curY + 20*S)
      curY += 50*S
    }

    // ===== 我的阵容区域 =====
    ctx.textAlign = 'center'
    ctx.fillStyle = TH.dim; ctx.font = `bold ${12*S}px sans-serif`
    ctx.fillText('── 我的阵容 ──', W*0.5, curY + 4*S)
    curY += 16*S

    // 血条
    const hpBarH = 16*S
    R.drawHp(padX, curY, W - padX*2, hpBarH, this.heroHp, this.heroMaxHp, TH.success, null, true)
    curY += hpBarH + 12*S

    // 武器行
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText('武器：', padX, curY)
    curY += 6*S
    const wpnH = 36*S
    const wpnCardX = padX, wpnCardW = W - padX*2
    ctx.fillStyle = 'rgba(15,15,30,0.6)'
    R.rr(wpnCardX, curY, wpnCardW, wpnH, 6*S); ctx.fill()
    if (this.weapon) {
      const wac = ATTR_COLOR[this.weapon.attr]
      // 小图标
      const wIconSz = 28*S
      const wIconX = wpnCardX + 8*S
      const wIconY = curY + (wpnH - wIconSz)/2
      ctx.fillStyle = wac ? wac.bg : '#1a1510'
      R.rr(wIconX, wIconY, wIconSz, wIconSz, 4*S); ctx.fill()
      ctx.fillStyle = wac ? wac.main : '#ddd'; ctx.font = `bold ${16*S}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('⚔', wIconX + wIconSz/2, wIconY + wIconSz/2)
      ctx.textBaseline = 'alphabetic'
      // 武器边框
      const frameWeapon = R.getImg('assets/ui/frame_weapon.png')
      if (frameWeapon && frameWeapon.width > 0) {
        const fScale = 1.12, fSz = wIconSz * fScale, fOff = (fSz - wIconSz)/2
        ctx.drawImage(frameWeapon, wIconX - fOff, wIconY - fOff, fSz, fSz)
      }
      // 武器名+描述
      ctx.textAlign = 'left'
      ctx.fillStyle = wac ? wac.main : TH.text; ctx.font = `bold ${12*S}px sans-serif`
      ctx.fillText(this.weapon.name, wIconX + wIconSz + 10*S, curY + wpnH*0.38)
      ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
      ctx.fillText(this.weapon.desc, wIconX + wIconSz + 10*S, curY + wpnH*0.72)
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`
      ctx.fillText('无武器', W*0.5, curY + wpnH*0.58)
    }
    curY += wpnH + 12*S

    // 灵兽行
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(`灵兽（${this.pets.length}/5）：`, padX, curY)
    curY += 8*S
    const petSlots = 5
    const petGap = 8*S
    const petSidePad = padX
    const petIconSize = (W - petSidePad*2 - petGap*(petSlots-1)) / petSlots
    const petIconY = curY
    this._eventPetRects = []
    const framePetMap = {
      metal: R.getImg('assets/ui/frame_pet_metal.png'),
      wood:  R.getImg('assets/ui/frame_pet_wood.png'),
      water: R.getImg('assets/ui/frame_pet_water.png'),
      fire:  R.getImg('assets/ui/frame_pet_fire.png'),
      earth: R.getImg('assets/ui/frame_pet_earth.png'),
    }
    const frameScale = 1.12
    const frameSize = petIconSize * frameScale
    const frameOff = (frameSize - petIconSize) / 2

    for (let i = 0; i < petSlots; i++) {
      const px = petSidePad + i * (petIconSize + petGap)
      const py = petIconY
      const cxP = px + petIconSize / 2
      const cyP = py + petIconSize / 2
      this._eventPetRects.push([px, py, petIconSize, petIconSize])

      if (i < this.pets.length) {
        const p = this.pets[i]
        const ac = ATTR_COLOR[p.attr]
        // 底色
        ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
        ctx.fillRect(px, py, petIconSize, petIconSize)
        // 光晕
        ctx.save()
        const grd = ctx.createRadialGradient(cxP, cyP - petIconSize*0.06, 0, cxP, cyP - petIconSize*0.06, petIconSize*0.38)
        grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.fillRect(px, py, petIconSize, petIconSize)
        ctx.restore()
        // 头像
        const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
        if (petAvatar && petAvatar.width > 0) {
          const aw = petAvatar.width, ah = petAvatar.height
          const drawW = petIconSize - 2, drawH = drawW * (ah / aw)
          const dy = py + (petIconSize - 2) - drawH
          ctx.save()
          ctx.beginPath(); ctx.rect(px + 1, py + 1, petIconSize - 2, petIconSize - 2); ctx.clip()
          ctx.drawImage(petAvatar, px + 1, dy, drawW, drawH)
          ctx.restore()
        } else {
          ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${petIconSize*0.35}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(ATTR_NAME[p.attr] || '', cxP, cyP)
          ctx.textBaseline = 'alphabetic'
        }
        // 边框
        const petFrame = framePetMap[p.attr] || framePetMap.metal
        if (petFrame && petFrame.width > 0) {
          ctx.drawImage(petFrame, px - frameOff, py - frameOff, frameSize, frameSize)
        }
        // 名字（头像下方）
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(p.name.substring(0,4), cxP, py + petIconSize + 12*S)
        // ATK
        ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
        ctx.fillText(`ATK:${p.atk}`, cxP, py + petIconSize + 22*S)
      } else {
        // 空槽
        ctx.fillStyle = 'rgba(25,22,18,0.5)'
        ctx.fillRect(px, py, petIconSize, petIconSize)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
        ctx.strokeRect(px, py, petIconSize, petIconSize)
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('空', cxP, cyP)
        ctx.textBaseline = 'alphabetic'
      }
    }
    curY = petIconY + petIconSize + 30*S

    // 提示文字
    if (this.pets.length > 0) {
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('※ 点击灵兽头像查看技能详情', W*0.5, curY)
      curY += 16*S
    }

    // 操作按钮行
    const btnW = W*0.36, btnH = 34*S, btnGap = 12*S
    const btn1X = W*0.5 - btnW - btnGap/2
    const btn2X = W*0.5 + btnGap/2
    const btnY = curY
    R.drawBtn(btn1X, btnY, btnW, btnH, '灵兽编辑', TH.info, 12)
    R.drawBtn(btn2X, btnY, btnW, btnH, '武器切换', TH.info, 12)
    this._eventEditPetRect = [btn1X, btnY, btnW, btnH]
    this._eventEditWpnRect = [btn2X, btnY, btnW, btnH]
    curY += btnH + 16*S

    // 出发按钮
    const goBtnW = W*0.55, goBtnH = 44*S
    const goBtnX = (W - goBtnW)/2, goBtnY = curY
    const label = isBattle ? '进入战斗' : '进入'
    R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, label, TH.accent, 16)
    this._eventBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]

    // 左上角返回按钮
    this._drawBackBtn()

    // 灵兽详情弹窗（最上层）
    if (this._eventPetDetail != null) {
      this._drawEventPetDetail()
    }
  }

  // 事件页灵兽详情弹窗
  _drawEventPetDetail() {
    const idx = this._eventPetDetail
    if (idx == null || idx < 0 || idx >= this.pets.length) return
    const p = this.pets[idx]
    const ac = ATTR_COLOR[p.attr]

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)

    // 弹窗卡片
    const cardW = W * 0.75, cardH = 200*S
    const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
    ctx.fillStyle = 'rgba(20,20,40,0.95)'
    R.rr(cardX, cardY, cardW, cardH, 12*S); ctx.fill()
    ctx.strokeStyle = ac ? ac.main + '88' : 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1.5*S
    R.rr(cardX, cardY, cardW, cardH, 12*S); ctx.stroke()

    // 头像
    const avSz = 64*S
    const avX = cardX + 16*S, avY = cardY + 18*S
    ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
    R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()
    const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
    if (petAvatar && petAvatar.width > 0) {
      ctx.save()
      ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
      const aw = petAvatar.width, ah = petAvatar.height
      const dw = avSz - 2, dh = dw * (ah/aw)
      ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
      ctx.restore()
    }
    const petFrame = R.getImg(`assets/ui/frame_pet_${p.attr}.png`)
    if (petFrame && petFrame.width > 0) {
      const fScale = 1.12, fSz = avSz * fScale, fOff = (fSz - avSz)/2
      ctx.drawImage(petFrame, avX - fOff, avY - fOff, fSz, fSz)
    }

    // 名字和属性
    const infoX = avX + avSz + 14*S
    let iy = cardY + 36*S
    ctx.textAlign = 'left'
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${15*S}px sans-serif`
    ctx.fillText(p.name, infoX, iy)
    iy += 22*S
    ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
    ctx.fillText(`${ATTR_NAME[p.attr]}属性   ATK: ${p.atk}`, infoX, iy)

    // 技能区
    iy = avY + avSz + 18*S
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.text; ctx.font = `bold ${13*S}px sans-serif`
    ctx.fillText(`技能：${p.skill.name}`, cardX + 20*S, iy)
    iy += 20*S
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    // 技能描述自动换行
    const descLines = this._wrapText(p.skill.desc, cardW - 40*S, 11)
    descLines.forEach(line => {
      ctx.fillText(line, cardX + 20*S, iy)
      iy += 16*S
    })
    iy += 4*S
    ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(`CD：${p.cd} 回合`, cardX + 20*S, iy)

    // 关闭按钮
    const closeBtnW = 80*S, closeBtnH = 32*S
    const closeBtnX = cardX + (cardW - closeBtnW)/2
    const closeBtnY = cardY + cardH - closeBtnH - 12*S
    R.drawBtn(closeBtnX, closeBtnY, closeBtnW, closeBtnH, '关闭', TH.info, 12)
    this._eventPetDetailCloseRect = [closeBtnX, closeBtnY, closeBtnW, closeBtnH]
  }

  _rBattle() {
    R.drawBattleBg(this.af)
    const padX = 8*S

    // ===== 布局计算（参考智龙迷城：怪物区→队伍栏→血条→棋盘）=====
    const boardPad = 6*S  // 棋盘左右留小边距
    const cellSize = (W - boardPad*2) / COLS
    this.cellSize = cellSize; this.boardX = boardPad
    const boardH = ROWS * cellSize  // 5行
    // 底部留白
    const bottomPad = 8*S
    // 棋盘顶部 = 屏幕底部 - 底部留白 - 棋盘高度
    const boardTop = H - bottomPad - boardH
    this.boardY = boardTop
    // 队伍栏图标：占满整行，间距足够避免边框遮挡
    const sidePad = 8*S          // 两侧留白
    const petGap = 8*S           // 宠物之间间距（边框溢出约6%，需留足空间）
    const wpnGap = 12*S          // 武器与第一个宠物间距
    const totalGapW = wpnGap + petGap * 4 + sidePad * 2
    const iconSize = (W - totalGapW) / 6
    const teamBarH = iconSize + 6*S
    // 血条在队伍栏下方、棋盘上方（加高以显示数值）
    const hpBarH = 18*S
    const hpBarY = boardTop - hpBarH - 4*S
    // 队伍栏在血条上方
    const teamBarY = hpBarY - teamBarH - 2*S
    // 怪物区：从safeTop到队伍栏上方
    const eAreaTop = safeTop + 4*S
    const eAreaBottom = teamBarY - 4*S

    // 退出按钮尺寸（先计算位置，绘制在怪物区背景之后）
    const exitBtnSize = 32*S
    const exitBtnX = 8*S
    const exitBtnY = eAreaTop

    // ===== 怪物区（含立绘）=====
    if (this.enemy) {
      const eAreaH = eAreaBottom - eAreaTop
      const ac = ATTR_COLOR[this.enemy.attr]

      // 怪物区属性背景图（使用battle目录对应属性背景）
      const themeBg = 'theme_' + (this.enemy.attr || 'metal')
      R.drawEnemyAreaBg(this.af, themeBg, eAreaTop, eAreaBottom, this.enemy.attr)

      // 怪物立绘（居中显示，椭圆裁切去掉方形边角的棋盘格背景）
      const avatarPath = this.enemy.avatar ? this.enemy.avatar + '.jpg' : null
      const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
      if (enemyImg && enemyImg.width > 0) {
        // 按区域高度等比缩放，最大不超过宽度70%
        const maxImgH = eAreaH * 0.65
        const maxImgW = W * 0.7
        const imgRatio = enemyImg.width / enemyImg.height
        let imgW = maxImgH * imgRatio, imgH = maxImgH
        if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / imgRatio }
        const imgX = (W - imgW) / 2
        const imgY = eAreaTop + eAreaH * 0.08
        ctx.save()
        // 椭圆裁切，隐藏图片四角的棋盘格背景
        ctx.beginPath()
        ctx.ellipse(imgX + imgW/2, imgY + imgH/2, imgW*0.48, imgH*0.48, 0, 0, Math.PI*2)
        ctx.clip()
        ctx.drawImage(enemyImg, imgX, imgY, imgW, imgH)
        ctx.restore()
      }

      // 层数 + 精英/Boss标记（左上）
      ctx.textAlign = 'center'
      const evType = this.curEvent ? this.curEvent.type : 'battle'
      if (evType === 'boss') {
        // Boss标记：红底金字
        const floorText = `第 ${this.floor} 层`
        const bossTag = '⚠ BOSS ⚠'
        ctx.fillStyle = TH.accent; ctx.font = `bold ${13*S}px sans-serif`
        ctx.fillText(floorText, W*0.5, eAreaTop + 14*S)
        const tagW = 100*S, tagH = 20*S, tagX = (W - tagW)/2, tagY = eAreaTop + 20*S
        ctx.fillStyle = 'rgba(180,30,30,0.85)'; R.rr(tagX, tagY, tagW, tagH, 4*S); ctx.fill()
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1*S; R.rr(tagX, tagY, tagW, tagH, 4*S); ctx.stroke()
        ctx.fillStyle = '#ffd700'; ctx.font = `bold ${11*S}px sans-serif`
        ctx.fillText(bossTag, W*0.5, eAreaTop + 33*S)
      } else if (evType === 'elite') {
        // 精英标记：紫底白字
        const floorText = `第 ${this.floor} 层`
        ctx.fillStyle = TH.accent; ctx.font = `bold ${13*S}px sans-serif`
        ctx.fillText(floorText, W*0.5, eAreaTop + 14*S)
        const tagW = 80*S, tagH = 18*S, tagX = (W - tagW)/2, tagY = eAreaTop + 20*S
        ctx.fillStyle = 'rgba(120,50,180,0.8)'; R.rr(tagX, tagY, tagW, tagH, 4*S); ctx.fill()
        ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${10*S}px sans-serif`
        ctx.fillText('★ 精英战斗', W*0.5, eAreaTop + 32*S)
      } else {
        ctx.fillStyle = TH.accent; ctx.font = `bold ${13*S}px sans-serif`
        ctx.fillText(`第 ${this.floor} 层`, W*0.5, eAreaTop + 14*S)
      }
      // 怪物名（底部描边增强可读性）
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${16*S}px sans-serif`
      ctx.textAlign = 'center'
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2*S
      ctx.strokeText(this.enemy.name, W*0.5, eAreaBottom - 48*S)
      ctx.fillText(this.enemy.name, W*0.5, eAreaBottom - 48*S)
      // 弱点属性提示（怪物名下方）
      const weakAttr = COUNTER_BY[this.enemy.attr]
      if (weakAttr) {
        const wc = ATTR_COLOR[weakAttr]
        ctx.fillStyle = wc ? wc.main : TH.accent; ctx.font = `bold ${11*S}px sans-serif`
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2*S
        ctx.strokeText(`弱点：${ATTR_NAME[weakAttr]}`, W*0.5, eAreaBottom - 34*S)
        ctx.fillText(`弱点：${ATTR_NAME[weakAttr]}`, W*0.5, eAreaBottom - 34*S)
      }
      // 怪物HP（显示数值）
      R.drawHp(padX+40*S, eAreaBottom - 28*S, W-padX*2-80*S, 16*S, this.enemy.hp, this.enemy.maxHp, ac ? ac.main : TH.danger, this._enemyHpLoss, true)
      // 怪物buffs（HP条下方）
      this._drawBuffIconsLabeled(this.enemyBuffs, padX+40*S, eAreaBottom - 6*S, '敌方', true)
      // 英雄buffs（队伍栏上方）
      this._drawBuffIconsLabeled(this.heroBuffs, padX, teamBarY - 18*S, '己方', false)
      // 记录敌人区域用于点击查看详情
      this._enemyAreaRect = [0, eAreaTop, W, eAreaBottom - eAreaTop]
    }

    // ===== 左上角退出按钮（在怪物区背景之后绘制，避免被覆盖）=====
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✕', exitBtnX + exitBtnSize*0.5, exitBtnY + exitBtnSize*0.5)
    ctx.textBaseline = 'alphabetic'
    this._exitBtnRect = [exitBtnX, exitBtnY, exitBtnSize, exitBtnSize]

    // ===== 宠物+武器栏（一排，血条上方）=====
    this._drawTeamBar(teamBarY, teamBarH, iconSize)

    // ===== 英雄血条（队伍栏下方，棋盘上方，显示数值）=====
    R.drawHp(padX, hpBarY, W - padX*2, hpBarH, this.heroHp, this.heroMaxHp, TH.success, this._heroHpLoss, true)

    // ===== 棋盘（带格子背景）=====
    this._drawBoard()

    // ===== 消除棋子处数值飘字 =====
    this.elimFloats.forEach(f => R.drawElimFloat(f))

    // ===== Combo显示 =====
    if (this.combo > 0 && (this.bState === 'elimAnim' || this.bState === 'dropping' || this.bState === 'preAttack' || this.bState === 'petAtkShow')) {
      ctx.fillStyle = TH.accent; ctx.font = `bold ${22*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(`${this.combo} Combo!`, W*0.5, teamBarY - 12*S)
    }

    // ===== 宠物头像攻击数值翻滚 =====
    this.petAtkNums.forEach(f => R.drawPetAtkNum(f))

    // 拖拽计时
    if (this.dragging && this.bState === 'playerTurn') {
      const remain = Math.max(0, (this.dragTimeLimit - this.dragTimer) / 60)
      ctx.fillStyle = remain < 2 ? TH.danger : TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText(`⏱${remain.toFixed(1)}s`, padX, teamBarY - 14*S)
    }
    // 胜利/失败覆盖
    if (this.bState === 'victory') this._drawVictoryOverlay()
    if (this.bState === 'defeat') this._drawDefeatOverlay()
    // 敌人详情弹窗
    if (this.showEnemyDetail) this._drawEnemyDetailDialog()
    // 退出确认弹窗
    if (this.showExitDialog) this._drawExitDialog()
  }

  _rReward() {
    R.drawBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('战斗胜利 - 选择奖励', W*0.5, safeTop + 40*S)
    // 速通达成提示
    let headerOffset = 0
    if (this.lastSpeedKill) {
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${13*S}px sans-serif`
      ctx.fillText(`⚡ 速通达成 (${this.lastTurnCount}回合) — 额外奖励已追加！`, W*0.5, safeTop + 60*S)
      headerOffset = 22*S
    }
    if (!this.rewards) return
    // 卡片高度根据奖励数量自适应
    const rewardCount = this.rewards.length
    const maxCardArea = H * 0.58
    const gap = 10*S
    const cardH = Math.min(78*S, (maxCardArea - (rewardCount-1)*gap) / rewardCount)
    const cardW = W*0.8
    const startY = H*0.16 + headerOffset
    this._rewardRects = []
    this.rewards.forEach((rw, i) => {
      const cy = startY + i*(cardH+gap)
      const selected = this.selectedReward === i
      // 速通奖励用金色底
      const isSpeedBuff = rw.data && rw.data.id && rw.data.id.startsWith('s')
      let bgColor = TH.card
      if (isSpeedBuff) bgColor = selected ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)'
      else if (rw.type === REWARD_TYPES.NEW_PET) bgColor = selected ? 'rgba(77,204,77,0.2)' : 'rgba(77,204,77,0.08)'
      else if (rw.type === REWARD_TYPES.NEW_WEAPON) bgColor = selected ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)'
      else if (rw.type === REWARD_TYPES.BUFF) bgColor = selected ? 'rgba(77,171,255,0.2)' : 'rgba(77,171,255,0.06)'
      ctx.fillStyle = bgColor
      R.rr(W*0.1, cy, cardW, cardH, 10*S); ctx.fill()
      ctx.strokeStyle = selected ? TH.accent : TH.cardB; ctx.lineWidth = 2*S; ctx.stroke()
      // 奖励类型标签
      let typeTag = ''
      let tagColor = TH.dim
      if (isSpeedBuff) { typeTag = '【速通】'; tagColor = '#ffd700' }
      else if (rw.type === REWARD_TYPES.NEW_PET) { typeTag = '【灵兽】'; tagColor = '#4dcc4d' }
      else if (rw.type === REWARD_TYPES.NEW_WEAPON) { typeTag = '【武器】'; tagColor = '#ffd700' }
      else if (rw.type === REWARD_TYPES.BUFF) { typeTag = '【加成】'; tagColor = '#4dabff' }
      ctx.fillStyle = tagColor; ctx.font = `bold ${11*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(typeTag, W*0.5, cy + 16*S)
      // 奖励名
      ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px sans-serif`
      ctx.fillText(rw.label, W*0.5, cy + cardH*0.5)
      // 提示
      if (rw.type === REWARD_TYPES.NEW_PET) {
        ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
        ctx.fillText(`→ 进入灵兽背包 (${this.petBag.length}/8)`, W*0.5, cy + cardH*0.78)
      } else if (rw.type === REWARD_TYPES.NEW_WEAPON) {
        ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
        ctx.fillText(`→ 进入武器背包 (${this.weaponBag.length}/4)`, W*0.5, cy + cardH*0.78)
      } else if (isSpeedBuff) {
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        ctx.fillText('速通额外奖励·自动生效', W*0.5, cy + cardH*0.78)
      } else if (rw.type === REWARD_TYPES.BUFF) {
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        ctx.fillText('全队永久生效', W*0.5, cy + cardH*0.78)
      }
      this._rewardRects.push([W*0.1, cy, cardW, cardH])
    })
    // 确认按钮
    if (this.selectedReward >= 0) {
      const bx = W*0.25, by = H*0.82, bw = W*0.5, bh = 44*S
      R.drawBtn(bx, by, bw, bh, '确认', TH.accent, 16)
      this._rewardConfirmRect = [bx, by, bw, bh]
    }
    // 左上角返回按钮
    this._drawBackBtn()
  }

  _rShop() {
    R.drawBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('神秘商店', W*0.5, safeTop + 40*S)
    ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
    ctx.fillText(this.shopUsed ? '已选择物品' : '免费选择一件', W*0.5, safeTop + 62*S)
    if (!this.shopItems) return
    const cardW = W*0.8, cardH = 55*S, gap = 10*S, startY = H*0.22
    this._shopRects = []
    this.shopItems.forEach((item, i) => {
      const cy = startY + i*(cardH+gap)
      ctx.fillStyle = TH.card; R.rr(W*0.1, cy, cardW, cardH, 8*S); ctx.fill()
      ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(item.name, W*0.5, cy + cardH*0.5 + 5*S)
      this._shopRects.push([W*0.1, cy, cardW, cardH])
    })
    // 离开按钮
    const bx = W*0.3, by = H*0.82, bw = W*0.4, bh = 40*S
    R.drawBtn(bx, by, bw, bh, '离开', TH.info, 14)
    this._shopLeaveRect = [bx, by, bw, bh]
    // 左上角返回按钮
    this._drawBackBtn()
  }

  _rRest() {
    R.drawBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('休息之地', W*0.5, safeTop + 40*S)
    if (!this.restOpts) return
    const cardW = W*0.7, cardH = 65*S, gap = 16*S, startY = H*0.3
    this._restRects = []
    this.restOpts.forEach((opt, i) => {
      const cy = startY + i*(cardH+gap)
      ctx.fillStyle = TH.card; R.rr(W*0.15, cy, cardW, cardH, 8*S); ctx.fill()
      ctx.fillStyle = TH.text; ctx.font = `bold ${15*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(opt.name, W*0.5, cy + 28*S)
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
      ctx.fillText(opt.desc, W*0.5, cy + 48*S)
      this._restRects.push([W*0.15, cy, cardW, cardH])
    })
    // 左上角返回按钮
    this._drawBackBtn()
  }

  _rAdventure() {
    R.drawBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('奇遇', W*0.5, safeTop + 40*S)
    if (!this.adventureData) return
    ctx.fillStyle = TH.text; ctx.font = `bold ${18*S}px sans-serif`
    ctx.fillText(this.adventureData.name, W*0.5, H*0.35)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    ctx.fillText(this.adventureData.desc, W*0.5, H*0.43)
    ctx.fillStyle = TH.success; ctx.font = `bold ${14*S}px sans-serif`
    ctx.fillText('效果已生效！', W*0.5, H*0.52)
    const bx = W*0.3, by = H*0.65, bw = W*0.4, bh = 44*S
    R.drawBtn(bx, by, bw, bh, '继续', TH.accent, 16)
    this._advBtnRect = [bx, by, bw, bh]
    // 左上角返回按钮
    this._drawBackBtn()
  }

  _rGameover() {
    R.drawBg(this.af)
    ctx.fillStyle = TH.danger; ctx.font = `bold ${26*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('挑战结束', W*0.5, H*0.2)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`
    ctx.fillText(`本次到达：第 ${this.floor} 层`, W*0.5, H*0.32)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    ctx.fillText(`历史最高：第 ${this.storage.bestFloor} 层`, W*0.5, H*0.40)
    // 宠物阵容
    ctx.fillText('上场灵兽：', W*0.5, H*0.50)
    this.pets.forEach((p, i) => {
      const ac = ATTR_COLOR[p.attr]
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `${12*S}px sans-serif`
      ctx.fillText(p.name, W*0.1 + i*W*0.18, H*0.55)
    })
    if (this.weapon) {
      ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(`武器：${this.weapon.name}`, W*0.5, H*0.62)
    }
    ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`灵兽背包：${this.petBag.length}只  武器背包：${this.weaponBag.length}把`, W*0.5, H*0.68)
    const bx = W*0.25, by = H*0.75, bw = W*0.5, bh = 48*S
    R.drawBtn(bx, by, bw, bh, '重新挑战', TH.accent, 18)
    this._goBtnRect = [bx, by, bw, bh]
    // 左上角返回按钮
    this._drawBackBtn()
  }

  // ===== 辅助渲染 =====
  _drawPetBar(topY) {
    const pw = W*0.17, ph = 44*S, gap = (W - 5*pw) / 6
    this.pets.forEach((p, i) => {
      const px = gap + i*(pw+gap), py = topY
      const ac = ATTR_COLOR[p.attr]
      ctx.fillStyle = ac ? ac.bg : '#222'; R.rr(px, py, pw, ph, 6*S); ctx.fill()
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${11*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(p.name.substring(0,4), px+pw*0.5, py+16*S)
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`
      ctx.fillText(`ATK:${p.atk} CD:${p.currentCd}`, px+pw*0.5, py+32*S)
    })
  }

  // 队伍栏：武器1 + 宠物5 = 6个1:1正方形头像框
  _drawTeamBar(topY, barH, iconSize) {
    ctx.save()
    // 重置关键状态，避免被前面绘制代码影响
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    // 背景条
    ctx.fillStyle = 'rgba(8,8,20,0.88)'
    ctx.fillRect(0, topY, W, barH)

    // 加载边框图片（武器 + 五行宠物）
    const frameWeapon = R.getImg('assets/ui/frame_weapon.png')
    const framePetMap = {
      metal: R.getImg('assets/ui/frame_pet_metal.png'),
      wood:  R.getImg('assets/ui/frame_pet_wood.png'),
      water: R.getImg('assets/ui/frame_pet_water.png'),
      fire:  R.getImg('assets/ui/frame_pet_fire.png'),
      earth: R.getImg('assets/ui/frame_pet_earth.png'),
    }

    // 6个1:1方格，武器与宠物间距稍大，宠物之间间距紧凑
    const totalSlots = 6
    const sidePad = 8*S
    const petGap = 8*S
    const wpnGap = 12*S
    const iconY = topY + (barH - iconSize) / 2
    // 边框图片覆盖区域（PNG边框自带透明边缘，比内容大一圈）
    const frameScale = 1.12
    const frameSize = iconSize * frameScale
    const frameOff = (frameSize - iconSize) / 2

    this._petBtnRects = []

    for (let i = 0; i < totalSlots; i++) {
      // 武器在第0格，宠物在1~5格
      let ix
      if (i === 0) {
        ix = sidePad
      } else {
        ix = sidePad + iconSize + wpnGap + (i - 1) * (iconSize + petGap)
      }
      const cx = ix + iconSize * 0.5
      const cy = iconY + iconSize * 0.5

      if (i === 0) {
        // ===== 第1格：武器 =====
        const ac = this.weapon ? ATTR_COLOR[this.weapon.attr] : null
        ctx.fillStyle = this.weapon ? (ac ? ac.bg : '#1a1510') : 'rgba(25,22,18,0.8)'
        ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        if (this.weapon) {
          // 武器属性色光晕
          ctx.save()
          const grd = ctx.createRadialGradient(cx, cy - iconSize*0.08, 0, cx, cy - iconSize*0.08, iconSize*0.35)
          grd.addColorStop(0, (ac ? ac.main : '#ccc') + '44')
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd
          ctx.fillRect(ix, iconY, iconSize, iconSize)
          ctx.restore()
          // 武器emoji
          ctx.fillStyle = ac ? ac.main : '#ddd'
          ctx.font = `bold ${iconSize*0.32}px sans-serif`
          ctx.fillText('⚔', cx, cy - iconSize*0.08)
          // 武器名（描边）
          ctx.font = `bold ${iconSize*0.14}px sans-serif`
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2*S
          ctx.strokeText(this.weapon.name.substring(0,3), cx, cy + iconSize*0.28)
          ctx.fillStyle = '#fff'
          ctx.fillText(this.weapon.name.substring(0,3), cx, cy + iconSize*0.28)
        } else {
          ctx.fillStyle = 'rgba(80,70,60,0.3)'
          ctx.font = `${iconSize*0.22}px sans-serif`
          ctx.fillText('⚔', cx, cy)
        }
        // 武器边框图片（上层，中间透明露出内容）
        if (frameWeapon && frameWeapon.width > 0) {
          ctx.drawImage(frameWeapon, ix - frameOff, iconY - frameOff, frameSize, frameSize)
        }
      } else {
        // ===== 第2~6格：宠物 =====
        const petIdx = i - 1
        const petFrame = petIdx < this.pets.length
          ? (framePetMap[this.pets[petIdx].attr] || framePetMap.metal)
          : framePetMap.metal

        if (petIdx < this.pets.length) {
          const p = this.pets[petIdx]
          const ac = ATTR_COLOR[p.attr]
          const ready = p.currentCd <= 0

          // 攻击跳动：检测该宠物是否正在展示攻击数值
          let bounceY = 0
          const atkAnim = this.petAtkNums && this.petAtkNums.find(f => f.petIdx === petIdx && f.t <= f.rollFrames)
          if (atkAnim) {
            const progress = atkAnim.t / atkAnim.rollFrames
            // 弹跳曲线：快速上升后回弹
            bounceY = -Math.sin(progress * Math.PI) * 6 * S
          }
          ctx.save()
          ctx.translate(0, bounceY)

          // 底色
          ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
          ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)

          // 属性光晕
          ctx.save()
          const grd = ctx.createRadialGradient(cx, cy - iconSize*0.06, 0, cx, cy - iconSize*0.06, iconSize*0.38)
          grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd
          ctx.fillRect(ix, iconY, iconSize, iconSize)
          ctx.restore()

          // 灵兽头像：保持比例、底部对齐
          const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
          const hasPetImg = petAvatar && petAvatar.width > 0
          if (hasPetImg) {
            const aw = petAvatar.width, ah = petAvatar.height
            const drawW = iconSize - 2, drawH = drawW * (ah / aw)
            const dy = iconY + 1 + (iconSize - 2) - drawH  // 底部对齐
            ctx.save()
            ctx.beginPath(); ctx.rect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2); ctx.clip()
            ctx.drawImage(petAvatar, ix + 1, dy, drawW, drawH)
            ctx.restore()
          } else {
            // 无图片时：大号属性字居中 + 名字
            ctx.fillStyle = ac ? ac.main : TH.text
            ctx.font = `bold ${iconSize*0.35}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(ATTR_NAME[p.attr] || '', cx, cy - iconSize*0.08)
            // 仅无头像图片时显示名字
            ctx.font = `bold ${iconSize*0.14}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
            ctx.strokeText(p.name.substring(0,3), cx, cy + iconSize*0.25)
            ctx.fillStyle = '#fff'
            ctx.fillText(p.name.substring(0,3), cx, cy + iconSize*0.25)
          }

          // 五行属性边框图片（上层，中间透明露出头像）
          if (petFrame && petFrame.width > 0) {
            ctx.drawImage(petFrame, ix - frameOff, iconY - frameOff, frameSize, frameSize)
          }

          // CD未就绪时：右下角显示CD数字（不加灰色遮罩）
          if (!ready) {
            ctx.save()
            // 右下角小圆底显示CD数字
            const cdR = iconSize * 0.18
            const cdX = ix + iconSize - cdR - 2*S
            const cdY = iconY + iconSize - cdR - 2*S
            ctx.fillStyle = 'rgba(0,0,0,0.65)'
            ctx.beginPath(); ctx.arc(cdX + cdR, cdY + cdR, cdR, 0, Math.PI*2); ctx.fill()
            ctx.fillStyle = '#ddd'; ctx.font = `bold ${iconSize*0.2}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText(`${p.currentCd}`, cdX + cdR, cdY + cdR)
            ctx.restore()
          }

          // 就绪时：醒目脉冲光环特效
          if (ready) {
            ctx.save()
            const glowColor = ac ? ac.main : TH.accent
            const glowAlpha = 0.5 + 0.4 * Math.sin(this.af * 0.1)
            // 外圈旋转光弧
            ctx.save()
            ctx.translate(cx, cy)
            ctx.rotate(this.af * 0.04)
            const arcR = iconSize * 0.58
            for (let a = 0; a < 4; a++) {
              ctx.beginPath()
              ctx.arc(0, 0, arcR, a * Math.PI/2, a * Math.PI/2 + Math.PI/3)
              ctx.strokeStyle = glowColor
              ctx.lineWidth = 2.5*S
              ctx.globalAlpha = glowAlpha * 0.8
              ctx.shadowColor = glowColor
              ctx.shadowBlur = 10*S
              ctx.stroke()
            }
            ctx.restore()
            // 外发光边框
            ctx.shadowColor = glowColor
            ctx.shadowBlur = 12*S
            ctx.strokeStyle = glowColor
            ctx.lineWidth = 2.5*S
            ctx.globalAlpha = glowAlpha
            ctx.strokeRect(ix - 2, iconY - 2, iconSize + 4, iconSize + 4)
            // 内部柔和光晕叠加
            const glowGrd = ctx.createRadialGradient(cx, cy, iconSize*0.15, cx, cy, iconSize*0.55)
            glowGrd.addColorStop(0, glowColor + '30')
            glowGrd.addColorStop(1, 'transparent')
            ctx.fillStyle = glowGrd
            ctx.shadowBlur = 0
            ctx.globalAlpha = glowAlpha * 0.6
            ctx.fillRect(ix, iconY, iconSize, iconSize)
            ctx.restore()
          }

          this._petBtnRects.push([ix, iconY, iconSize, iconSize])
          ctx.restore() // 恢复攻击跳动 translate
        } else {
          // 空宠物槽
          ctx.fillStyle = 'rgba(18,18,30,0.6)'
          ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
          if (petFrame && petFrame.width > 0) {
            ctx.save(); ctx.globalAlpha = 0.35
            ctx.drawImage(petFrame, ix - frameOff, iconY - frameOff, frameSize, frameSize)
            ctx.restore()
          }
          this._petBtnRects.push([ix, iconY, iconSize, iconSize])
        }
      }
    }
    ctx.restore()
  }

  _drawBattlePetBar(bottomY) {
    // 保留向后兼容（不再调用）
  }

  _drawBoard() {
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    const boardW = COLS * cs, boardH = ROWS * cs

    // 棋盘整体背景（深色底板+圆角）
    ctx.fillStyle = 'rgba(8,8,18,0.85)'
    R.rr(bx-3*S, by-3*S, boardW+6*S, boardH+6*S, 6*S); ctx.fill()
    // 棋盘边框
    ctx.strokeStyle = 'rgba(80,80,120,0.5)'; ctx.lineWidth = 1.5*S
    R.rr(bx-3*S, by-3*S, boardW+6*S, boardH+6*S, 6*S); ctx.stroke()

    // 加载棋盘格贴图（深色/浅色交替）
    const tileDark = R.getImg('assets/backgrounds/board_bg_dark.jpg')
    const tileLight = R.getImg('assets/backgrounds/board_bg_light.jpg')

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = bx + c*cs, y = by + r*cs
        // 棋盘格背景：用图片交替拼接
        const isDark = (r+c)%2===0
        const tileImg = isDark ? tileDark : tileLight
        if (tileImg && tileImg.width > 0) {
          ctx.drawImage(tileImg, x, y, cs, cs)
        } else {
          ctx.fillStyle = isDark ? 'rgba(28,28,48,0.9)' : 'rgba(18,18,35,0.9)'
          ctx.fillRect(x, y, cs, cs)
        }

        const cell = this.board[r] && this.board[r][c]
        if (!cell) continue
        // 消除动画闪烁
        if (this.elimAnimCells && this.elimAnimCells.some(ec => ec.r === r && ec.c === c)) {
          const flash = Math.sin(this.elimAnimTimer * 0.5) * 0.5 + 0.5
          ctx.globalAlpha = flash
        }
        // 拖拽中的珠子位置偏移
        if (this.dragging && this.dragR === r && this.dragC === c) {
          ctx.globalAlpha = 0.3
        }
        // 交换动画
        let drawX = x, drawY = y
        if (this.swapAnim) {
          const sa = this.swapAnim, t = sa.t/sa.dur
          if (sa.r1===r && sa.c1===c) { drawX = x+(sa.c2-sa.c1)*cs*t; drawY = y+(sa.r2-sa.r1)*cs*t }
          else if (sa.r2===r && sa.c2===c) { drawX = x+(sa.c1-sa.c2)*cs*t; drawY = y+(sa.r1-sa.r2)*cs*t }
        }
        const attr = typeof cell === 'string' ? cell : cell.attr
        // 珠子绘制（drawBead参数：圆心x, 圆心y, 半径）
        const beadPad = cs * 0.08
        const beadR = (cs - beadPad*2) * 0.5
        R.drawBead(drawX+cs*0.5, drawY+cs*0.5, beadR, attr, this.af)
        ctx.globalAlpha = 1
        // 封印标记
        if (cell.sealed) {
          ctx.strokeStyle = 'rgba(180,0,0,0.7)'; ctx.lineWidth = 2*S
          ctx.strokeRect(x+3*S, y+3*S, cs-6*S, cs-6*S)
        }
      }
    }
    // 拖拽中珠子跟随手指
    if (this.dragging && this.dragAttr) {
      const beadR = (cs - cs*0.08*2) * 0.5
      R.drawBead(this.dragCurX, this.dragCurY, beadR, this.dragAttr, this.af)
    }
  }

  _drawVictoryOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H)
    ctx.fillStyle = TH.success; ctx.font = `bold ${28*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('战斗胜利！', W*0.5, H*0.32)
    // 速通提示
    if (this.lastSpeedKill) {
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${16*S}px sans-serif`
      ctx.fillText(`⚡ 速通达成！(${this.lastTurnCount}回合击败)`, W*0.5, H*0.40)
      ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`
      ctx.fillText('额外获得速通奖励', W*0.5, H*0.44)
    }
    const bx = W*0.25, by = H*0.52, bw = W*0.5, bh = 46*S
    R.drawBtn(bx, by, bw, bh, '选择奖励', TH.accent, 16)
    this._victoryBtnRect = [bx, by, bw, bh]
  }

  _drawDefeatOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H)
    ctx.fillStyle = TH.danger; ctx.font = `bold ${28*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('修士陨落...', W*0.5, H*0.35)
    const bx = W*0.25, by = H*0.5, bw = W*0.5, bh = 46*S
    R.drawBtn(bx, by, bw, bh, '结算', TH.info, 16)
    this._defeatBtnRect = [bx, by, bw, bh]
  }

  // 通用左上角返回首页按钮
  _drawBackBtn() {
    const btnW = 60*S, btnH = 30*S
    const bx = 8*S, by = safeTop + 6*S
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    R.rr(bx, by, btnW, btnH, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1
    R.rr(bx, by, btnW, btnH, 6*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${13*S}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('< 首页', bx + btnW*0.5, by + btnH*0.5)
    ctx.textBaseline = 'alphabetic'
    this._backBtnRect = [bx, by, btnW, btnH]
  }

  // 处理返回首页按钮点击（暂存进度后回首页）
  _handleBackToTitle() {
    if (this.scene === 'gameover') {
      this.scene = 'title'
    } else {
      this._saveAndExit()
    }
  }
  _drawExitDialog() {
    // 全屏半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)
    // 弹窗面板
    const pw = W * 0.78, ph = 200*S
    const px = (W - pw) / 2, py = (H - ph) / 2
    ctx.fillStyle = 'rgba(20,20,40,0.95)'
    R.rr(px, py, pw, ph, 12*S); ctx.fill()
    ctx.strokeStyle = TH.accent + '66'; ctx.lineWidth = 2*S
    R.rr(px, py, pw, ph, 12*S); ctx.stroke()
    // 标题
    ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('退出战斗', px + pw*0.5, py + 36*S)
    // 提示文字
    ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
    ctx.fillText('请选择退出方式', px + pw*0.5, py + 62*S)
    // 按钮：暂存退出
    const btnW = pw * 0.38, btnH = 42*S, gap = 12*S
    const btn1X = px + pw*0.5 - btnW - gap*0.5
    const btn2X = px + pw*0.5 + gap*0.5
    const btnY = py + 90*S
    R.drawBtn(btn1X, btnY, btnW, btnH, '暂存退出', TH.info, 14)
    this._exitSaveRect = [btn1X, btnY, btnW, btnH]
    R.drawBtn(btn2X, btnY, btnW, btnH, '重新开局', TH.danger, 14)
    this._exitRestartRect = [btn2X, btnY, btnW, btnH]
    // 取消按钮
    const cancelW = pw * 0.4, cancelH = 36*S
    const cancelX = px + (pw - cancelW) / 2, cancelY = btnY + btnH + 16*S
    ctx.fillStyle = 'rgba(60,60,80,0.8)'
    R.rr(cancelX, cancelY, cancelW, cancelH, 8*S); ctx.fill()
    ctx.fillStyle = TH.dim; ctx.font = `${13*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('取消', cancelX + cancelW*0.5, cancelY + cancelH*0.65)
    this._exitCancelRect = [cancelX, cancelY, cancelW, cancelH]
  }

  // 首页"开始挑战"确认弹窗（有暂存进度时）
  _drawNewRunConfirm() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)
    const pw = W * 0.78, ph = 180*S
    const px = (W - pw) / 2, py = (H - ph) / 2
    ctx.fillStyle = 'rgba(20,20,40,0.95)'
    R.rr(px, py, pw, ph, 12*S); ctx.fill()
    ctx.strokeStyle = TH.accent + '66'; ctx.lineWidth = 2*S
    R.rr(px, py, pw, ph, 12*S); ctx.stroke()
    // 标题
    ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('开始新挑战', px + pw*0.5, py + 36*S)
    // 提示文字
    ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
    ctx.fillText('当前有未完成的挑战进度', px + pw*0.5, py + 62*S)
    ctx.fillStyle = '#ffaa44'; ctx.font = `bold ${13*S}px sans-serif`
    ctx.fillText('开始新挑战将清空之前的记录！', px + pw*0.5, py + 82*S)
    // 按钮
    const btnW = pw * 0.38, btnH = 42*S, gap = 12*S
    const btn1X = px + pw*0.5 - btnW - gap*0.5
    const btn2X = px + pw*0.5 + gap*0.5
    const btnY = py + 105*S
    R.drawBtn(btn1X, btnY, btnW, btnH, '取消', TH.info, 14)
    this._newRunCancelRect = [btn1X, btnY, btnW, btnH]
    R.drawBtn(btn2X, btnY, btnW, btnH, '确认开始', TH.danger, 14)
    this._newRunConfirmRect = [btn2X, btnY, btnW, btnH]
  }

  _drawBuffIcons(buffs, x, y) {
    if (!buffs || buffs.length === 0) return
    buffs.forEach((b, i) => {
      const bx = x + i*24*S
      ctx.fillStyle = b.bad ? 'rgba(200,40,40,0.7)' : 'rgba(40,160,40,0.7)'
      R.rr(bx, y, 22*S, 16*S, 3*S); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = `${8*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(b.name || b.type, bx+11*S, y+12*S)
    })
  }

  // 带标签和持续回合数的buff图标显示
  _drawBuffIconsLabeled(buffs, x, y, label, isEnemy) {
    if (!buffs || buffs.length === 0) return
    // 标签
    ctx.fillStyle = isEnemy ? 'rgba(200,80,80,0.8)' : 'rgba(60,160,200,0.8)'
    ctx.font = `bold ${7*S}px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(label, x, y - 1*S)
    const startX = x
    buffs.forEach((b, i) => {
      const bx = startX + i * 28*S
      // 背景色：负面红色、正面绿色
      ctx.fillStyle = b.bad ? 'rgba(180,30,30,0.75)' : 'rgba(30,140,50,0.75)'
      R.rr(bx, y + 2*S, 26*S, 16*S, 3*S); ctx.fill()
      // buff名
      ctx.fillStyle = '#fff'; ctx.font = `${7*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(b.name || b.type, bx + 13*S, y + 12*S)
      // 持续回合数（右上角小圆）
      if (b.dur !== undefined && b.dur < 99) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.beginPath(); ctx.arc(bx + 24*S, y + 4*S, 5*S, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = '#ffd700'; ctx.font = `bold ${6*S}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(`${b.dur}`, bx + 24*S, y + 4*S)
        ctx.textBaseline = 'alphabetic'
      }
    })
  }

  // ===== 敌人详情弹窗 =====
  _drawEnemyDetailDialog() {
    if (!this.enemy) return
    const e = this.enemy
    const ac = ATTR_COLOR[e.attr]
    const padX = 16*S, padY = 14*S
    const tipW = W * 0.84
    const lineH = 20*S
    const smallLineH = 16*S

    // 构建内容行
    let lines = []
    // 标题：怪物名
    const typeTag = e.isBoss ? '【BOSS】' : (e.isElite ? '【精英】' : '')
    lines.push({ text: `${typeTag}${e.name}`, color: ac ? ac.main : TH.text, bold: true, size: 16, h: lineH + 4*S })
    // 属性 & 等级
    lines.push({ text: `属性：${ATTR_NAME[e.attr] || '?'}　　第 ${this.floor} 层`, color: TH.sub, size: 11, h: smallLineH })
    // 数值
    lines.push({ text: `HP：${Math.round(e.hp)} / ${Math.round(e.maxHp)}　ATK：${e.atk}　DEF：${e.def || 0}`, color: TH.text, size: 11, h: smallLineH })

    // 敌方技能列表
    if (e.skills && e.skills.length > 0) {
      lines.push({ text: '', size: 0, h: 6*S }) // 分隔
      lines.push({ text: '技能列表：', color: TH.accent, bold: true, size: 12, h: smallLineH })
      e.skills.forEach(sk => {
        const skData = ENEMY_SKILLS[sk]
        if (skData) {
          lines.push({ text: `· ${skData.name}`, color: '#ffcc66', bold: true, size: 11, h: smallLineH })
          // 技能描述（替换{val}占位符）
          let desc = skData.desc || ''
          if (desc.includes('{val}')) {
            const val = skData.type === 'dot' ? Math.round(e.atk * 0.3) : Math.round(e.atk * 0.8)
            desc = desc.replace('{val}', val)
          }
          const descLines = this._wrapText(desc, tipW - padX*2 - 10*S, 10)
          descLines.forEach(dl => {
            lines.push({ text: `  ${dl}`, color: TH.dim, size: 10, h: smallLineH - 2*S })
          })
        }
      })
    }

    // 敌方buff
    if (this.enemyBuffs && this.enemyBuffs.length > 0) {
      lines.push({ text: '', size: 0, h: 6*S })
      lines.push({ text: '敌方状态：', color: '#ff6666', bold: true, size: 12, h: smallLineH })
      this.enemyBuffs.forEach(b => {
        const durTxt = b.dur < 99 ? ` (${b.dur}回合)` : ''
        const color = b.bad ? '#ff8888' : '#88ff88'
        lines.push({ text: `· ${b.name || b.type}${durTxt}`, color, size: 10, h: smallLineH - 2*S })
      })
    }

    // 己方buff
    if (this.heroBuffs && this.heroBuffs.length > 0) {
      lines.push({ text: '', size: 0, h: 6*S })
      lines.push({ text: '己方状态：', color: '#66aaff', bold: true, size: 12, h: smallLineH })
      this.heroBuffs.forEach(b => {
        const durTxt = b.dur < 99 ? ` (${b.dur}回合)` : ''
        const color = b.bad ? '#ff8888' : '#88ff88'
        lines.push({ text: `· ${b.name || b.type}${durTxt}`, color, size: 10, h: smallLineH - 2*S })
      })
    }

    // 计算总高度
    let totalH = padY * 2
    lines.forEach(l => { totalH += l.h })
    totalH += 20*S // 底部关闭提示

    // 限制最大高度
    const maxH = H * 0.75
    if (totalH > maxH) totalH = maxH

    // 居中定位
    const tipX = (W - tipW) / 2
    const tipY = (H - totalH) / 2

    // 半透明遮罩
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    // 面板背景
    ctx.fillStyle = 'rgba(16,16,32,0.96)'
    R.rr(tipX, tipY, tipW, totalH, 12*S); ctx.fill()
    // 属性色边框
    ctx.strokeStyle = ac ? ac.main + '88' : TH.accent + '66'; ctx.lineWidth = 2*S
    R.rr(tipX, tipY, tipW, totalH, 12*S); ctx.stroke()
    // 顶部属性色装饰条
    ctx.save()
    ctx.beginPath()
    R.rr(tipX, tipY, tipW, 4*S, 12*S); ctx.clip()
    ctx.fillStyle = ac ? ac.main : TH.accent
    ctx.fillRect(tipX, tipY, tipW, 4*S)
    ctx.restore()

    // 绘制内容
    let curY = tipY + padY
    ctx.textAlign = 'left'
    lines.forEach(l => {
      if (l.size === 0) { curY += l.h; return }
      curY += l.h
      if (curY > tipY + totalH - 24*S) return // 超出范围不绘制
      ctx.fillStyle = l.color || TH.text
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
    })

    // 关闭提示
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 8*S)

    ctx.restore()
  }

  // 布局辅助：计算队伍栏和HP条位置
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
    return { boardPad, cellSize, boardH, boardTop, teamBarH, teamBarY, hpBarY, eAreaTop }
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
    this.skillCastAnim = { active:true, progress:0, duration:25, type:'heal', color:TH.success, skillName:'', targetX:W*0.5, targetY:L.hpBarY }
  }

  // ===== 触摸入口 =====
  onTouch(type, e) {
    const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0])
    if (!t) return
    const x = t.clientX * dpr, y = t.clientY * dpr
    switch(this.scene) {
      case 'title': this._tTitle(type,x,y); break
      case 'prepare': this._tPrepare(type,x,y); break
      case 'event': this._tEvent(type,x,y); break
      case 'battle': this._tBattle(type,x,y); break
      case 'reward': this._tReward(type,x,y); break
      case 'shop': this._tShop(type,x,y); break
      case 'rest': this._tRest(type,x,y); break
      case 'adventure': this._tAdventure(type,x,y); break
      case 'gameover': this._tGameover(type,x,y); break
    }
  }

  _tTitle(type,x,y) {
    if (type !== 'end') return
    // ===== 开始新挑战确认弹窗处理（优先级最高）=====
    if (this.showNewRunConfirm) {
      if (this._newRunConfirmRect && this._hitRect(x,y,...this._newRunConfirmRect)) {
        this.showNewRunConfirm = false
        this.storage.clearRunState()
        this._startRun(); return
      }
      if (this._newRunCancelRect && this._hitRect(x,y,...this._newRunCancelRect)) {
        this.showNewRunConfirm = false; return
      }
      return  // 弹窗打开时吞掉所有其他触摸
    }
    // 继续挑战（有暂存时）
    if (this._titleContinueRect && this._hitRect(x,y,...this._titleContinueRect)) { this._resumeRun(); return }
    // 开始挑战
    if (this._titleBtnRect && this._hitRect(x,y,...this._titleBtnRect)) {
      if (this.storage.hasSavedRun()) {
        this.showNewRunConfirm = true; return  // 有存档时弹出确认
      }
      this._startRun(); return  // 无存档直接开始
    }
  }

  _tPrepare(type,x,y) {
    if (type !== 'end') return

    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }

    // 如果Tips正在显示，点击任意位置关闭
    if (this.prepareTip) { this.prepareTip = null; return }

    // Tab切换
    if (this._prepPetTabRect && this._hitRect(x,y,...this._prepPetTabRect)) { this.prepareTab = 'pets'; this.prepareSelBagIdx = -1; this.prepareSelSlotIdx = -1; this.prepareTip = null; return }
    if (this._prepWpnTabRect && this._hitRect(x,y,...this._prepWpnTabRect)) { this.prepareTab = 'weapon'; this.prepareTip = null; return }

    if (this.prepareTab === 'pets') {
      // 点击上场槽位
      if (this._prepSlotRects) {
        for (let i = 0; i < this._prepSlotRects.length; i++) {
          if (this._hitRect(x,y,...this._prepSlotRects[i])) {
            // 双击同一个槽位 → 显示详情Tips
            if (this.prepareSelSlotIdx === i && this.pets[i]) {
              this.prepareTip = { type:'pet', data: this.pets[i], x, y }
              return
            }
            this.prepareSelSlotIdx = i; return
          }
        }
      }
      // 点击背包宠物
      if (this._prepBagRects) {
        for (let i = 0; i < this._prepBagRects.length; i++) {
          if (this._hitRect(x,y,...this._prepBagRects[i]) && this.petBag[i]) {
            // 双击同一个 → 显示详情Tips
            if (this.prepareSelBagIdx === i) {
              this.prepareTip = { type:'pet', data: this.petBag[i], x, y }
              return
            }
            this.prepareSelBagIdx = i; return
          }
        }
      }
      // 交换按钮
      if (this._prepSwapBtnRect && this._hitRect(x,y,...this._prepSwapBtnRect)) {
        const si = this.prepareSelSlotIdx, bi = this.prepareSelBagIdx
        if (si >= 0 && bi >= 0 && this.petBag[bi]) {
          const tmp = this.pets[si]
          this.pets[si] = this.petBag[bi]
          this.pets[si].currentCd = 0
          this.petBag[bi] = tmp
          this.prepareSelSlotIdx = -1; this.prepareSelBagIdx = -1
        }
        return
      }
    } else {
      // 武器Tab：点击当前武器卡片 → 显示详情
      if (this.weapon && this._prepCurWpnRect && this._hitRect(x,y,...this._prepCurWpnRect)) {
        this.prepareTip = { type:'weapon', data: this.weapon, x, y }
        return
      }
      // 武器背包：点击卡片区域 → 显示详情；点击装备按钮 → 装备
      if (this._prepWpnBagRects) {
        for (let i = 0; i < this._prepWpnBagRects.length; i++) {
          const [cx,cy,cw,ch,ebx,eby,ebw,ebh] = this._prepWpnBagRects[i]
          // 先检查装备按钮
          if (this._hitRect(x,y,ebx,eby,ebw,ebh)) {
            const old = this.weapon
            this.weapon = this.weaponBag[i]
            if (old) { this.weaponBag[i] = old }
            else { this.weaponBag.splice(i, 1) }
            return
          }
          // 再检查整个卡片区域 → 显示Tips
          if (this._hitRect(x,y,cx,cy,cw,ch) && this.weaponBag[i]) {
            this.prepareTip = { type:'weapon', data: this.weaponBag[i], x, y }
            return
          }
        }
      }
    }
    // 出发按钮
    if (this._prepGoBtnRect && this._hitRect(x,y,...this._prepGoBtnRect)) {
      this._enterEvent()
      return
    }
  }

  // 从prepare进入事件预览页面
  _enterEvent() {
    this._eventPetDetail = null
    this.scene = 'event'
  }

  _tEvent(type,x,y) {
    if (type !== 'end') return
    // 灵兽详情弹窗打开时，优先处理
    if (this._eventPetDetail != null) {
      if (this._eventPetDetailCloseRect && this._hitRect(x,y,...this._eventPetDetailCloseRect)) {
        this._eventPetDetail = null
      } else {
        // 点击弹窗外也关闭
        this._eventPetDetail = null
      }
      return
    }
    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }
    // 灵兽编辑按钮
    if (this._eventEditPetRect && this._hitRect(x,y,...this._eventEditPetRect)) {
      this.prepareTab = 'pets'; this.scene = 'prepare'; return
    }
    // 武器切换按钮
    if (this._eventEditWpnRect && this._hitRect(x,y,...this._eventEditWpnRect)) {
      this.prepareTab = 'weapon'; this.scene = 'prepare'; return
    }
    // 点击灵兽头像查看详情
    if (this._eventPetRects) {
      for (let i = 0; i < this._eventPetRects.length; i++) {
        if (i < this.pets.length && this._hitRect(x,y,...this._eventPetRects[i])) {
          this._eventPetDetail = i; return
        }
      }
    }
    // 出发/进入按钮
    if (this._eventBtnRect && this._hitRect(x,y,...this._eventBtnRect)) {
      const ev = this.curEvent; if (!ev) return
      switch(ev.type) {
        case 'battle': case 'elite': case 'boss':
          this._enterBattle(ev.data); break
        case 'adventure':
          this.adventureData = ev.data; this._applyAdventure(ev.data); this.scene = 'adventure'; break
        case 'shop':
          this.shopItems = ev.data; this.shopUsed = false; this.scene = 'shop'; break
        case 'rest':
          this.restOpts = ev.data; this.scene = 'rest'; break
      }
    }
  }

  _tBattle(type,x,y) {
    // ===== 退出弹窗处理（优先级最高，拦截所有其他操作）=====
    if (this.showExitDialog) {
      if (type !== 'end') return
      // 暂存退出
      if (this._exitSaveRect && this._hitRect(x,y,...this._exitSaveRect)) {
        this._saveAndExit(); return
      }
      // 重新开局
      if (this._exitRestartRect && this._hitRect(x,y,...this._exitRestartRect)) {
        this.showExitDialog = false
        this.storage.clearRunState()
        this._startRun(); return
      }
      // 取消
      if (this._exitCancelRect && this._hitRect(x,y,...this._exitCancelRect)) {
        this.showExitDialog = false; return
      }
      return  // 弹窗打开时吞掉所有其他触摸
    }
    // ===== 敌人详情弹窗处理 =====
    if (this.showEnemyDetail) {
      if (type === 'end') this.showEnemyDetail = false
      return
    }
    // ===== 退出按钮 =====
    if (type === 'end' && this._exitBtnRect && this._hitRect(x,y,...this._exitBtnRect)) {
      this.showExitDialog = true; return
    }
    // 胜利/失败按钮
    if (this.bState === 'victory' && type === 'end') {
      if (this._victoryBtnRect && this._hitRect(x,y,...this._victoryBtnRect)) {
        this.rewards = generateRewards(this.floor, this.curEvent ? this.curEvent.type : 'battle', this.lastSpeedKill); this.selectedReward = -1; this.rewardPetSlot = -1
        this.scene = 'reward'; this.bState = 'none'; return
      }
    }
    if (this.bState === 'defeat' && type === 'end') {
      if (this._defeatBtnRect && this._hitRect(x,y,...this._defeatBtnRect)) { this._endRun(); return }
    }
    // ===== 点击敌人区域查看详情（胜利/失败状态下不允许）=====
    if (type === 'end' && this.bState !== 'victory' && this.bState !== 'defeat'
        && this.enemy && this._enemyAreaRect && this._hitRect(x,y,...this._enemyAreaRect)) {
      // 排除退出按钮区域
      if (!this._exitBtnRect || !this._hitRect(x,y,...this._exitBtnRect)) {
        this.showEnemyDetail = true; return
      }
    }
    // 宠物技能释放（仅playerTurn且非拖拽中）
    if (this.bState === 'playerTurn' && !this.dragging && type === 'end' && this._petBtnRects) {
      for (let i = 0; i < this._petBtnRects.length; i++) {
        if (this._hitRect(x,y,...this._petBtnRects[i]) && this.pets[i].currentCd <= 0) {
          this._triggerPetSkill(this.pets[i], i); return
        }
      }
    }
    // 转珠操作
    if (this.bState !== 'playerTurn') return
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    if (type === 'start') {
      const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && this.board[r][c]) {
        this.dragging = true; this.dragR = r; this.dragC = c
        this.dragStartX = x; this.dragStartY = y; this.dragCurX = x; this.dragCurY = y
        const cell = this.board[r][c]
        this.dragAttr = typeof cell === 'string' ? cell : cell.attr
        this.dragTimer = 0
      }
    } else if (type === 'move' && this.dragging) {
      this.dragCurX = x; this.dragCurY = y
      const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS && (r !== this.dragR || c !== this.dragC)) {
        // 交换珠子
        const or = this.dragR, oc = this.dragC
        const tmp = this.board[or][oc]; this.board[or][oc] = this.board[r][c]; this.board[r][c] = tmp
        this.swapAnim = { r1:or, c1:oc, r2:r, c2:c, t:0, dur:6 }
        this.dragR = r; this.dragC = c
      }
    } else if (type === 'end' && this.dragging) {
      this.dragging = false; this.dragAttr = null; this.dragTimer = 0
      this._checkAndElim()
    }
  }

  _tReward(type,x,y) {
    if (type !== 'end') return
    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }
    if (this._rewardRects) {
      for (let i = 0; i < this._rewardRects.length; i++) {
        if (this._hitRect(x,y,...this._rewardRects[i])) { this.selectedReward = i; return }
      }
    }
    if (this._rewardConfirmRect && this.selectedReward >= 0 && this._hitRect(x,y,...this._rewardConfirmRect)) {
      this._applyReward(this.rewards[this.selectedReward])
      // 速通奖励自动生效（不需要选择）
      if (this.rewards) {
        this.rewards.forEach((rw, i) => {
          if (i !== this.selectedReward && rw.data && rw.data.id && rw.data.id.startsWith('s')) {
            this._applyBuffReward(rw.data)
          }
        })
      }
      this._nextFloor()
    }
  }

  _tShop(type,x,y) {
    if (type !== 'end') return
    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }
    if (!this.shopUsed && this._shopRects) {
      for (let i = 0; i < this._shopRects.length; i++) {
        if (this._hitRect(x,y,...this._shopRects[i])) {
          this._applyShopItem(this.shopItems[i]); this.shopUsed = true; return
        }
      }
    }
    if (this._shopLeaveRect && this._hitRect(x,y,...this._shopLeaveRect)) { this._nextFloor() }
  }

  _tRest(type,x,y) {
    if (type !== 'end') return
    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }
    if (this._restRects) {
      for (let i = 0; i < this._restRects.length; i++) {
        if (this._hitRect(x,y,...this._restRects[i])) {
          this._applyRestOption(this.restOpts[i]); this._nextFloor(); return
        }
      }
    }
  }

  _tAdventure(type,x,y) {
    if (type !== 'end') return
    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }
    if (this._advBtnRect && this._hitRect(x,y,...this._advBtnRect)) { this._nextFloor() }
  }

  _tGameover(type,x,y) {
    if (type !== 'end') return
    // 返回首页按钮
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this._handleBackToTitle(); return }
    if (this._goBtnRect && this._hitRect(x,y,...this._goBtnRect)) { this.scene = 'title' }
  }

  // ===== 战斗进入 =====
  _enterBattle(enemyData) {
    this.enemy = { ...enemyData }
    // 应用runBuffs中的敌方减益
    const rb = this.runBuffs
    let hpReduce = rb.enemyHpReducePct
    let atkReduce = rb.enemyAtkReducePct
    let defReduce = rb.enemyDefReducePct
    if (this.enemy.isElite) { hpReduce += rb.eliteHpReducePct; atkReduce += rb.eliteAtkReducePct }
    if (this.enemy.isBoss) { hpReduce += rb.bossHpReducePct; atkReduce += rb.bossAtkReducePct }
    if (hpReduce > 0) {
      this.enemy.hp = Math.round(this.enemy.hp * (1 - hpReduce / 100))
      this.enemy.maxHp = this.enemy.hp
    }
    if (atkReduce > 0) this.enemy.atk = Math.round(this.enemy.atk * (1 - atkReduce / 100))
    if (defReduce > 0) this.enemy.def = Math.round((this.enemy.def || 0) * (1 - defReduce / 100))

    this.enemyBuffs = []
    this.bState = 'playerTurn'
    this.combo = 0; this.turnCount = 0
    this.lastSpeedKill = false; this.lastTurnCount = 0
    this._pendingDmgMap = null; this._pendingHeal = 0
    this.elimQueue = []; this.elimAnimCells = null
    this.elimFloats = []; this.petAtkNums = []
    this._elimSkipCombo = false
    this._enemyHpLoss = null; this._heroHpLoss = null
    this.showEnemyDetail = false
    // 奇遇BUFF：下次战斗敌人眩晕
    if (this.nextStunEnemy) {
      this.nextStunEnemy = false
      this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
    }
    this.scene = 'battle'
    // 每场战斗开始时设置灵兽技能CD（降低为基础CD的60%，更容易释放）
    this.pets.forEach(p => { p.currentCd = Math.ceil(p.cd * 0.6) })
    this._initBoard()
    // 武器额外转珠时间
    let extraTime = this.runBuffs.extraTimeSec
    if (this.weapon && this.weapon.type === 'extraTime') extraTime += this.weapon.sec
    this.dragTimeLimit = (8 + extraTime) * 60
  }

  _initBoard() {
    const weights = getBeadWeights(this.enemy ? this.enemy.attr : null, this.weapon)
    // goodBeads: 增加有利珠概率
    if (this.goodBeadsNextTurn) {
      this.goodBeadsNextTurn = false
      this.pets.forEach(p => { if (weights[p.attr] !== undefined) weights[p.attr] *= 1.5 })
    }
    const pool = []; for (const [attr, w] of Object.entries(weights)) { for (let i = 0; i < Math.round(w*10); i++) pool.push(attr) }
    this.board = []
    for (let r = 0; r < ROWS; r++) {
      this.board[r] = []
      for (let c = 0; c < COLS; c++) {
        let attr
        let tries = 0
        do { attr = pool[Math.floor(Math.random()*pool.length)]; tries++ } while (tries < 30 && this._wouldMatch(r, c, attr))
        this.board[r][c] = { attr, sealed: false }
      }
    }
  }

  _wouldMatch(r, c, attr) {
    if (c >= 2 && this._cellAttr(r,c-1) === attr && this._cellAttr(r,c-2) === attr) return true
    if (r >= 2 && this._cellAttr(r-1,c) === attr && this._cellAttr(r-2,c) === attr) return true
    return false
  }

  _cellAttr(r, c) {
    const cell = this.board[r] && this.board[r][c]
    if (!cell) return null
    return typeof cell === 'string' ? cell : cell.attr
  }

  // ===== 消除核心 =====
  _checkAndElim() {
    const groups = this._findMatchesSeparate()
    if (groups.length > 0) {
      if (!this._pendingDmgMap) { this._pendingDmgMap = {}; this._pendingHeal = 0; this.combo = 0 }
      this.elimQueue = groups
      this._startNextElimAnim()
    } else if (this.combo > 0) {
      this._enterPetAtkShow()
    } else {
      this.bState = 'preEnemy'; this._stateTimer = 0
    }
  }

  _startNextElimAnim() {
    if (this.elimQueue.length === 0) {
      this.bState = 'dropping'; this.dropAnimTimer = 0
      this._fillBoard()
      return
    }
    const group = this.elimQueue.shift()
    const { attr, count, cells } = group
    // 无对应宠物→不计combo（心珠除外）
    const hasPet = attr === 'heart' || this.pets.some(p => p.attr === attr)
    if (!hasPet && !this.comboNeverBreak) {
      // 无对应宠物：播放消除动画特效，但不加combo、不产生伤害数字
      this.elimAnimCells = cells.map(({r,c}) => ({r,c,attr}))
      this.elimAnimTimer = 0
      this._elimSkipCombo = true  // 标记此次消除不加combo
      MusicMgr.playEliminate()
      this.bState = 'elimAnim'
      return
    }
    this.combo++
    // runBuffs额外连击
    if (this.runBuffs.bonusCombo > 0 && this.combo === 1) {
      this.combo += this.runBuffs.bonusCombo
    }
    // 消除倍率
    let elimMul = 1.0
    if (count === 4) elimMul = 1.5
    else if (count >= 5) elimMul = 2.0
    // runBuffs: 3/4/5消伤害加成
    if (count === 3) elimMul *= 1 + this.runBuffs.elim3DmgPct / 100
    if (count === 4) elimMul *= 1 + this.runBuffs.elim4DmgPct / 100
    if (count >= 5) elimMul *= 1 + this.runBuffs.elim5DmgPct / 100
    // 5消以上眩晕敌人（+runBuffs眩晕时长加成）
    if (count >= 5 && this.enemy) {
      const stunDur = 1 + this.runBuffs.stunDurBonus
      const hasStun = this.enemyBuffs.some(b => b.type === 'stun')
      if (!hasStun) this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:stunDur, bad:true })
    }

    // ===== 消除时棋子处显示数值和Combo =====
    let elimDisplayVal = 0
    let elimDisplayColor = '#fff'
    if (attr === 'heart') {
      // 心珠回复
      let heal = (10 + Math.floor(this.floor * 0.3)) * elimMul
      heal *= 1 + this.runBuffs.heartBoostPct / 100
      if (this.weapon && this.weapon.type === 'heartBoost') heal *= 1 + this.weapon.pct / 100
      this._pendingHeal += heal
      elimDisplayVal = Math.round(heal)
      elimDisplayColor = TH.success
    } else {
      // 属性伤害
      const pet = this.pets.find(p => p.attr === attr)
      if (pet) {
        let baseDmg = pet.atk * elimMul
        // runBuffs累积
        baseDmg *= 1 + this.runBuffs.allAtkPct / 100
        if (!this._pendingDmgMap[attr]) this._pendingDmgMap[attr] = 0
        this._pendingDmgMap[attr] += baseDmg
        elimDisplayVal = Math.round(baseDmg)
        const ac = ATTR_COLOR[attr]
        elimDisplayColor = ac ? ac.main : '#fff'
      }
    }
    // 在消除棋子的中心位置生成数值飘字
    if (elimDisplayVal > 0 && cells.length > 0) {
      const cs = this.cellSize, bx = this.boardX, by = this.boardY
      // 取消除组的中心位置
      let cx = 0, cy = 0
      cells.forEach(({r,c}) => { cx += bx + c*cs + cs*0.5; cy += by + r*cs + cs*0.5 })
      cx /= cells.length; cy /= cells.length
      const prefix = attr === 'heart' ? '+' : ''
      this.elimFloats.push({
        x: cx, y: cy,
        text: `${prefix}${elimDisplayVal}`,
        color: elimDisplayColor,
        t: 0, alpha: 1, scale: count >= 5 ? 1.3 : count === 4 ? 1.15 : 1.0
      })
      // 播放消除音效
      MusicMgr.playEliminate()
    }
    // 武器healOnElim效果
    if (this.weapon && this.weapon.type === 'healOnElim' && this.weapon.attr === attr) {
      this._pendingHeal += this.heroMaxHp * this.weapon.pct / 100
    }
    // 武器shieldOnElim效果
    if (this.weapon && this.weapon.type === 'shieldOnElim' && this.weapon.attr === attr) {
      this.heroShield += this.weapon.val || 15
    }
    this.elimAnimCells = cells.map(({r,c}) => ({r,c,attr}))
    this.elimAnimTimer = 0
    this.bState = 'elimAnim'
  }

  _processElim() {
    this.elimAnimTimer++
    if (this.elimAnimTimer >= 24) {
      this.elimAnimCells.forEach(({r,c}) => { this.board[r][c] = null })
      this.elimAnimCells = null
      if (this._elimSkipCombo) {
        this._elimSkipCombo = false
        this._startNextElimAnim()
      } else {
        this._startNextElimAnim()
      }
    }
  }

  _processDropAnim() {
    this.dropAnimTimer++
    if (this.dropAnimTimer >= 12) {
      const groups = this._findMatchesSeparate()
      if (groups.length > 0) {
        this.elimQueue = groups
        this._startNextElimAnim()
      } else if (this.combo > 0) {
        this._enterPetAtkShow()
      } else {
        this.bState = 'preEnemy'; this._stateTimer = 0
      }
    }
  }

  _findMatchesSeparate() {
    const marked = Array.from({length:ROWS}, () => Array(COLS).fill(false))
    // 横向
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS-3; c++) {
        const a = this._cellAttr(r,c)
        if (a && a === this._cellAttr(r,c+1) && a === this._cellAttr(r,c+2)) {
          let end = c+2
          while (end+1 < COLS && this._cellAttr(r,end+1) === a) end++
          for (let cc = c; cc <= end; cc++) marked[r][cc] = true
          c = end
        }
      }
    }
    // 纵向
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS-3; r++) {
        const a = this._cellAttr(r,c)
        if (a && a === this._cellAttr(r+1,c) && a === this._cellAttr(r+2,c)) {
          let end = r+2
          while (end+1 < ROWS && this._cellAttr(end+1,c) === a) end++
          for (let rr = r; rr <= end; rr++) marked[rr][c] = true
          r = end
        }
      }
    }
    // BFS分组
    const visited = Array.from({length:ROWS}, () => Array(COLS).fill(false))
    const groups = []
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!marked[r][c] || visited[r][c]) continue
        const attr = this._cellAttr(r,c)
        const cells = []; const q = [{r,c}]; visited[r][c] = true
        while (q.length) {
          const {r:cr,c:cc} = q.shift(); cells.push({r:cr,c:cc})
          const dirs = [[0,1],[0,-1],[1,0],[-1,0]]
          for (const [dr,dc] of dirs) {
            const nr=cr+dr, nc=cc+dc
            if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited[nr][nc]&&marked[nr][nc]&&this._cellAttr(nr,nc)===attr) {
              visited[nr][nc]=true; q.push({r:nr,c:nc})
            }
          }
        }
        groups.push({ attr, count:cells.length, cells })
      }
    }
    return groups
  }

  _fillBoard() {
    const weights = getBeadWeights(this.enemy ? this.enemy.attr : null, this.weapon)
    const pool = []; for (const [attr, w] of Object.entries(weights)) { for (let i = 0; i < Math.round(w*10); i++) pool.push(attr) }
    for (let c = 0; c < COLS; c++) {
      let writeRow = ROWS - 1
      for (let r = ROWS-1; r >= 0; r--) {
        if (this.board[r][c]) {
          if (writeRow !== r) { this.board[writeRow][c] = this.board[r][c]; this.board[r][c] = null }
          writeRow--
        }
      }
      for (let r = writeRow; r >= 0; r--) {
        this.board[r][c] = { attr: pool[Math.floor(Math.random()*pool.length)], sealed: false }
      }
    }
  }

  // ===== 宠物头像攻击数值展示阶段 =====
  _enterPetAtkShow() {
    this._stateTimer = 0
    this.petAtkNums = []
    // 预计算每个宠物的最终伤害（含combo加成等），在头像上方显示
    const dmgMap = this._pendingDmgMap || {}
    const comboMul = 1 + (this.combo - 1) * 0.25
    const comboBonusMul = 1 + this.runBuffs.comboDmgPct / 100
    const L = this._getBattleLayout()
    const sidePad = 8*S, petGap = 8*S, wpnGap = 12*S
    const totalGapW = wpnGap + petGap * 4 + sidePad * 2
    const iconSize = (W - totalGapW) / 6
    const teamBarH = iconSize + 6*S
    const iconY = L.teamBarY + (teamBarH - iconSize) / 2

    let hasAny = false
    for (let i = 0; i < this.pets.length; i++) {
      const pet = this.pets[i]
      const baseDmg = dmgMap[pet.attr] || 0
      if (baseDmg <= 0) continue
      let dmg = baseDmg * comboMul * comboBonusMul
      dmg *= 1 + this.runBuffs.allDmgPct / 100
      dmg *= 1 + (this.runBuffs.attrDmgPct[pet.attr] || 0) / 100
      if (this.weapon && this.weapon.type === 'attrDmgUp' && this.weapon.attr === pet.attr) dmg *= 1 + this.weapon.pct / 100
      if (this.weapon && this.weapon.type === 'allAtkUp') dmg *= 1 + this.weapon.pct / 100
      if (this.enemy) {
        const enemyAttr = this.enemy.attr
        if (COUNTER_MAP[pet.attr] === enemyAttr) {
          dmg *= COUNTER_MUL
          dmg *= 1 + this.runBuffs.counterDmgPct / 100
        } else if (COUNTER_BY[pet.attr] === enemyAttr) {
          dmg *= COUNTERED_MUL
        }
      }
      dmg = Math.round(dmg)
      if (dmg <= 0) continue
      hasAny = true
      const slotIdx = i + 1  // 宠物在1~5格
      const ix = sidePad + iconSize + wpnGap + (slotIdx - 1) * (iconSize + petGap)
      const cx = ix + iconSize * 0.5
      const ac = ATTR_COLOR[pet.attr]
      this.petAtkNums.push({
        x: cx, y: iconY - 4*S,
        finalVal: dmg, displayVal: 0,
        text: '0',
        color: ac ? ac.main : '#ffd700',
        t: 0, alpha: 1, scale: 1.0,
        rollFrames: 30,
        petIdx: i
      })
    }
    // 心珠回复显示在血条上方
    const pendingHeal = this._pendingHeal || 0
    if (pendingHeal > 0) {
      const heal = Math.round(pendingHeal * comboMul)
      if (heal > 0) {
        hasAny = true
        this.petAtkNums.push({
          x: W * 0.5, y: L.hpBarY - 2*S,
          finalVal: heal, displayVal: 0,
          text: '0',
          color: TH.success,
          t: 0, alpha: 1, scale: 1.0,
          rollFrames: 30,
          isHeal: true
        })
      }
    }
    if (hasAny) {
      this.bState = 'petAtkShow'
      MusicMgr.playRolling()
    } else {
      this.bState = 'preAttack'
    }
  }

  // ===== 攻击结算 =====
  _executeAttack() {
    this._applyFinalDamage(this._pendingDmgMap || {}, this._pendingHeal || 0)
    this._pendingDmgMap = null; this._pendingHeal = 0
    this.storage.recordBattle(this.combo)
  }

  _applyFinalDamage(dmgMap, heal) {
    const comboMul = 1 + (this.combo - 1) * 0.25
    // runBuffs: Combo伤害加成
    const comboBonusMul = 1 + this.runBuffs.comboDmgPct / 100
    let totalDmg = 0
    // 属性伤害结算
    for (const [attr, baseDmg] of Object.entries(dmgMap)) {
      let dmg = baseDmg * comboMul * comboBonusMul
      // 全属性增伤
      dmg *= 1 + this.runBuffs.allDmgPct / 100
      // 属性专属增伤
      dmg *= 1 + (this.runBuffs.attrDmgPct[attr] || 0) / 100
      // 武器属性增伤
      if (this.weapon && this.weapon.type === 'attrDmgUp' && this.weapon.attr === attr) dmg *= 1 + this.weapon.pct / 100
      // 武器全队攻击增伤
      if (this.weapon && this.weapon.type === 'allAtkUp') dmg *= 1 + this.weapon.pct / 100
      // 武器Combo增伤
      if (this.weapon && this.weapon.type === 'comboDmgUp') dmg *= 1 + this.weapon.pct / 100 * (this.combo > 1 ? 1 : 0)
      // 武器残血增伤
      if (this.weapon && this.weapon.type === 'lowHpDmgUp' && this.heroHp / this.heroMaxHp <= (this.weapon.threshold || 30) / 100) dmg *= 1 + this.weapon.pct / 100
      // 武器stunBonusDmg
      if (this.weapon && this.weapon.type === 'stunBonusDmg' && this.enemyBuffs.some(b => b.type === 'stun')) dmg *= 1 + this.weapon.pct / 100
      // 武器增效
      if (this.runBuffs.weaponBoostPct > 0) dmg *= 1 + this.runBuffs.weaponBoostPct / 100
      // 下层伤害翻倍
      if (this.nextDmgDouble) dmg *= 2
      // 五行克制
      if (this.enemy) {
        const enemyAttr = this.enemy.attr
        if (COUNTER_MAP[attr] === enemyAttr) {
          dmg *= COUNTER_MUL
          // runBuffs: 克制伤害加成
          dmg *= 1 + this.runBuffs.counterDmgPct / 100
        }
        else if (COUNTER_BY[attr] === enemyAttr) dmg *= COUNTERED_MUL
      }
      // 减去敌方防御
      if (this.enemy) dmg = Math.max(0, dmg - (this.enemy.def || 0))
      // 武器ignoreDefPct
      if (this.weapon && this.weapon.type === 'ignoreDefPct' && this.weapon.attr === attr && this.enemy) {
        dmg += (this.enemy.def || 0) * this.weapon.pct / 100
      }
      dmg = Math.round(dmg)
      if (dmg > 0) {
        totalDmg += dmg
        const ac = ATTR_COLOR[attr]
        this.dmgFloats.push({ x:W*0.3+Math.random()*W*0.4, y:this._getEnemyCenterY()-20*S, text:`-${dmg}`, color:ac?ac.main:TH.danger, t:0, alpha:1 })
      }
    }
    if (this.nextDmgDouble) this.nextDmgDouble = false
    // 造成伤害
    if (totalDmg > 0 && this.enemy) {
      const oldPct = this.enemy.hp / this.enemy.maxHp
      this.enemy.hp = Math.max(0, this.enemy.hp - totalDmg)
      this._enemyHpLoss = { fromPct: oldPct, timer: 0 }
      this._playHeroAttack('', Object.keys(dmgMap)[0] || 'metal')
      this.shakeT = 8; this.shakeI = 4
      // 武器poisonChance
      if (this.weapon && this.weapon.type === 'poisonChance' && Math.random()*100 < this.weapon.chance) {
        this.enemyBuffs.push({ type:'dot', name:'中毒', dmg:this.weapon.dmg, dur:this.weapon.dur, bad:true })
      }
    }
    // 回复结算
    if (heal > 0) {
      heal *= comboMul
      heal = Math.round(heal)
      const oldHp = this.heroHp
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + heal)
      if (this.heroHp > oldHp) {
        this.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${Math.round(this.heroHp-oldHp)}`, color:TH.success, t:0, alpha:1 })
        this._playHealEffect()
      }
    }
    // 武器regenPct (每回合回血)
    if (this.weapon && this.weapon.type === 'regenPct') {
      const regen = Math.round(this.heroMaxHp * this.weapon.pct / 100)
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + regen)
    }
    // runBuffs: 每回合自动回血
    if (this.runBuffs.regenPerTurn > 0) {
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + this.runBuffs.regenPerTurn)
    }
    // 武器comboHeal
    if (this.weapon && this.weapon.type === 'comboHeal' && this.combo > 0) {
      const ch = Math.round(this.heroMaxHp * this.weapon.pct / 100 * this.combo)
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + ch)
    }
    // 检查胜利
    if (this.enemy && this.enemy.hp <= 0) {
      this.lastTurnCount = this.turnCount
      this.lastSpeedKill = this.turnCount <= 5
      this.bState = 'victory'
      // 武器onKillHeal
      if (this.weapon && this.weapon.type === 'onKillHeal') {
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp * this.weapon.pct / 100))
      }
      // runBuffs: 战后额外回血
      if (this.runBuffs.postBattleHealPct > 0) {
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp * this.runBuffs.postBattleHealPct / 100))
      }
      // 清除下一场临时减伤buff
      this.runBuffs.nextDmgReducePct = 0
      return
    }
    // 进入结算→敌方回合
    this._settle()
  }

  _settle() {
    // buff持续减少
    this.heroBuffs = this.heroBuffs.filter(b => { b.dur--; return b.dur > 0 })
    this.enemyBuffs = this.enemyBuffs.filter(b => { b.dur--; return b.dur > 0 })
    // 宠物CD-1
    this.pets.forEach(p => { if (p.currentCd > 0) p.currentCd-- })
    // comboNeverBreak本次用完
    this.comboNeverBreak = false
    // 进入敌方回合
    this.bState = 'preEnemy'; this._stateTimer = 0
  }

  _enemyTurn() {
    if (!this.enemy || this.enemy.hp <= 0) { this.bState = 'playerTurn'; this.dragTimer = 0; return }
    // 检查眩晕
    const stunBuff = this.enemyBuffs.find(b => b.type === 'stun')
    if (stunBuff) {
      this.skillEffects.push({ x:W*0.5, y:this._getEnemyCenterY(), text:'眩晕跳过！', color:TH.info, t:0, alpha:1 })
      this.turnCount++
      this._enemyTurnWait = true; this.bState = 'enemyTurn'; this._stateTimer = 0
      return
    }
    // 普通攻击
    let atkDmg = this.enemy.atk
    // 敌方atkBuff
    const atkBuff = this.enemyBuffs.find(b => b.type === 'buff' && b.field === 'atk')
    if (atkBuff) atkDmg = Math.round(atkDmg * (1 + atkBuff.rate))
    // 减伤
    let reducePct = 0
    this.heroBuffs.forEach(b => { if (b.type === 'reduceDmg') reducePct += b.pct })
    if (this.weapon && this.weapon.type === 'reduceDmg') reducePct += this.weapon.pct
    // runBuffs: 永久受伤减少
    reducePct += this.runBuffs.dmgReducePct
    // runBuffs: 下一场受伤减少（临时）
    if (this.runBuffs.nextDmgReducePct > 0) reducePct += this.runBuffs.nextDmgReducePct
    atkDmg = Math.round(atkDmg * (1 - reducePct / 100))
    atkDmg = Math.max(0, atkDmg)
    // 武器blockChance
    if (this.weapon && this.weapon.type === 'blockChance' && Math.random()*100 < this.weapon.chance) {
      atkDmg = 0
      this.skillEffects.push({ x:W*0.5, y:H*0.6, text:'格挡！', color:TH.info, t:0, alpha:1 })
    }
    // dmgImmune
    const immune = this.heroBuffs.find(b => b.type === 'dmgImmune')
    if (immune) atkDmg = 1
    // 反弹
    let reflectPct = 0
    this.heroBuffs.forEach(b => { if (b.type === 'reflectPct') reflectPct += b.pct })
    if (this.weapon && this.weapon.type === 'reflectPct') reflectPct += this.weapon.pct
    if (reflectPct > 0 && atkDmg > 0) {
      const refDmg = Math.round(atkDmg * reflectPct / 100)
      this.enemy.hp = Math.max(0, this.enemy.hp - refDmg)
      this.dmgFloats.push({ x:W*0.5, y:this._getEnemyCenterY(), text:`反弹-${refDmg}`, color:TH.info, t:0, alpha:1 })
    }
    // 武器counterStun
    if (this.weapon && this.weapon.type === 'counterStun' && Math.random()*100 < this.weapon.chance) {
      this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
    }
    // 扣血（护盾优先）
    if (atkDmg > 0) {
      this._dealDmgToHero(atkDmg)
      this._playEnemyAttack()
      this.shakeT = 6; this.shakeI = 3
    }
    // DOT伤害
    this.heroBuffs.forEach(b => {
      if (b.type === 'dot' && b.dmg > 0) {
        if (this.weapon && this.weapon.type === 'immuneDot') return
        this._dealDmgToHero(b.dmg)
      }
    })
    // 敌方技能
    if (this.enemy.skills && this.turnCount > 0 && this.turnCount % 3 === 0) {
      const sk = this.enemy.skills[Math.floor(Math.random()*this.enemy.skills.length)]
      this._applyEnemySkill(sk)
    }
    // 敌方DOT
    this.enemyBuffs.forEach(b => {
      if (b.type === 'dot' && b.dmg > 0) {
        this.enemy.hp = Math.max(0, this.enemy.hp - b.dmg)
        this.dmgFloats.push({ x:W*0.5, y:this._getEnemyCenterY(), text:`-${b.dmg}`, color:'#a040a0', t:0, alpha:1 })
      }
    })
    // 敌方selfHeal
    this.enemyBuffs.forEach(b => {
      if (b.type === 'selfHeal') {
        const heal = Math.round(this.enemy.maxHp * (b.pct || 15) / 100)
        this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + heal)
      }
    })
    // 检查敌方死亡（反弹/DOT）
    if (this.enemy.hp <= 0) { this.lastTurnCount = this.turnCount; this.lastSpeedKill = this.turnCount <= 5; this.bState = 'victory'; return }
    // 检查己方死亡
    if (this.heroHp <= 0) { this._onDefeat(); return }
    this.turnCount++
    this._enemyTurnWait = true; this.bState = 'enemyTurn'; this._stateTimer = 0
  }

  _dealDmgToHero(dmg) {
    if (this.heroShield > 0) {
      if (dmg <= this.heroShield) { this.heroShield -= dmg; return }
      dmg -= this.heroShield; this.heroShield = 0
    }
    const oldPct = this.heroHp / this.heroMaxHp
    this.heroHp = Math.max(0, this.heroHp - dmg)
    this._heroHpLoss = { fromPct: oldPct, timer: 0 }
    this.dmgFloats.push({ x:W*0.5, y:H*0.7, text:`-${dmg}`, color:TH.danger, t:0, alpha:1 })
  }

  _applyEnemySkill(skillKey) {
    const sk = ENEMY_SKILLS[skillKey]
    if (!sk) return
    this.skillEffects.push({ x:W*0.5, y:this._getEnemyCenterY()+30*S, text:sk.name, color:TH.danger, t:0, alpha:1 })
    switch(sk.type) {
      case 'buff':
        this.enemyBuffs.push({ type:'buff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:false }); break
      case 'dot':
        this.heroBuffs.push({ type:'dot', name:sk.name, dmg:Math.round(this.enemy.atk*0.3), dur:sk.dur, bad:true }); break
      case 'seal':
        for (let i = 0; i < sk.count; i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (this.board[r][c]) this.board[r][c].sealed = true
        }
        break
      case 'convert':
        for (let i = 0; i < sk.count; i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (this.board[r][c]) this.board[r][c].attr = BEAD_ATTRS[Math.floor(Math.random()*5)]
        }
        break
      case 'aoe':
        this._dealDmgToHero(Math.round(this.enemy.atk * 0.5)); break
      case 'debuff':
        this.heroBuffs.push({ type:'debuff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:true }); break
      case 'stun':
        if (!this.immuneOnce && !(this.weapon && (this.weapon.type === 'immuneStun' || this.weapon.type === 'immuneCtrl'))) {
          // 英雄眩晕: 跳过下个playerTurn
          this.heroBuffs.push({ type:'heroStun', name:'眩晕', dur:sk.dur, bad:true })
        } else { this.immuneOnce = false }
        break
      case 'selfHeal':
        this.enemy.hp = Math.min(this.enemy.maxHp, this.enemy.hp + Math.round(this.enemy.maxHp * (sk.pct||15) / 100)); break
      case 'breakBead':
        for (let i = 0; i < sk.count; i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          this.board[r][c] = null
        }
        this._fillBoard()
        break
    }
  }

  // ===== 宠物技能 =====
  _triggerPetSkill(pet, idx) {
    const sk = pet.skill; if (!sk) return
    // 应用技能CD（含runBuffs CD缩短）
    let cd = pet.cd
    if (this.runBuffs.skillCdReducePct > 0) cd = Math.max(1, Math.round(cd * (1 - this.runBuffs.skillCdReducePct / 100)))
    pet.currentCd = cd
    this.skillEffects.push({ x:W*0.5, y:H*0.5, text:sk.name, color:ATTR_COLOR[pet.attr]?.main||TH.accent, t:0, alpha:1 })
    switch(sk.type) {
      case 'dmgBoost':
        this.heroBuffs.push({ type:'dmgBoost', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
      case 'convertBead': {
        const targetAttr = sk.attr || pet.attr
        for (let i = 0; i < sk.count; i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (this.board[r][c]) this.board[r][c].attr = targetAttr
        }
        break
      }
      case 'shield':
        this.heroShield += sk.val || 50; break
      case 'reduceDmg':
        this.heroBuffs.push({ type:'reduceDmg', pct:sk.pct, dur:2, bad:false, name:sk.name }); break
      case 'stun':
        this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.dur||1, bad:true }); break
      case 'comboPlus':
        this.combo += sk.count || 2; break
      case 'extraTime':
        this.dragTimeLimit += (sk.sec || 2) * 60; break
      case 'ignoreDefPct':
        this.heroBuffs.push({ type:'ignoreDefPct', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
      case 'revive':
        this.tempRevive = true; break
      case 'healPct':
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp*sk.pct/100)); break
      case 'healFlat':
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + sk.val); break
      case 'dot':
        if (sk.isHeal) {
          this.heroBuffs.push({ type:'regen', name:sk.name, heal:Math.abs(sk.dmg), dur:sk.dur, bad:false })
        } else {
          this.enemyBuffs.push({ type:'dot', name:sk.name, dmg:sk.dmg, dur:sk.dur, bad:true })
        }
        break
      case 'instantDmg':
        if (this.enemy) {
          let dmg = Math.round(pet.atk * (sk.pct||150) / 100)
          // runBuffs: 宠物技能伤害加成
          dmg = Math.round(dmg * (1 + this.runBuffs.skillDmgPct / 100))
          this.enemy.hp = Math.max(0, this.enemy.hp - dmg)
          this.dmgFloats.push({ x:W*0.5, y:this._getEnemyCenterY(), text:`-${dmg}`, color:ATTR_COLOR[sk.attr]?.main||TH.danger, t:0, alpha:1 })
          this._playHeroAttack(sk.name, sk.attr || pet.attr, 'burst')
          if (this.enemy.hp <= 0) { this.lastTurnCount = this.turnCount; this.lastSpeedKill = this.turnCount <= 5; this.bState = 'victory'; return }
        }
        break
      case 'hpMaxUp': {
        const inc = Math.round(this.heroMaxHp * sk.pct / 100)
        this.heroMaxHp += inc; this.heroHp += inc; break
      }
      case 'heartBoost':
        this.heroBuffs.push({ type:'heartBoost', mul:sk.mul||2, dur:sk.dur||1, bad:false, name:sk.name }); break
      case 'allDmgUp':
        this.heroBuffs.push({ type:'allDmgUp', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
      case 'allAtkUp':
        this.heroBuffs.push({ type:'allAtkUp', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
      case 'allDefUp':
        this.heroBuffs.push({ type:'allDefUp', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
      case 'critBoost':
        this.heroBuffs.push({ type:'critBoost', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
      case 'critDmgUp':
        this.heroBuffs.push({ type:'critDmgUp', pct:sk.pct, dur:1, bad:false, name:sk.name }); break
      case 'reflectPct':
        this.heroBuffs.push({ type:'reflectPct', pct:sk.pct, dur:sk.dur||2, bad:false, name:sk.name }); break
      case 'immuneCtrl':
        this.heroBuffs.push({ type:'immuneCtrl', dur:sk.dur||1, bad:false, name:sk.name }); break
      case 'beadRateUp':
        // 临时增加该属性珠出现率（下次fillBoard时生效）
        this.goodBeadsNextTurn = true; break
      case 'comboNeverBreak':
        this.comboNeverBreak = true; break
      case 'healOnElim':
        this.heroBuffs.push({ type:'healOnElim', attr:sk.attr, pct:sk.pct, dur:3, bad:false, name:sk.name }); break
      case 'shieldOnElim':
        this.heroBuffs.push({ type:'shieldOnElim', attr:sk.attr, val:sk.val, dur:3, bad:false, name:sk.name }); break
      case 'lowHpDmgUp':
        this.heroBuffs.push({ type:'lowHpDmgUp', pct:sk.pct, dur:3, bad:false, name:sk.name }); break
      case 'stunPlusDmg':
        this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.stunDur||1, bad:true })
        this.heroBuffs.push({ type:'dmgBoost', attr:sk.attr||pet.attr, pct:sk.pct, dur:1, bad:false, name:sk.name })
        break
      case 'fullHeal':
        this.heroHp = this.heroMaxHp; break
      case 'allHpMaxUp': {
        const inc2 = Math.round(this.heroMaxHp * sk.pct / 100)
        this.heroMaxHp += inc2; this.heroHp += inc2; break
      }
      case 'dmgImmune':
        this.heroBuffs.push({ type:'dmgImmune', dur:1, bad:false, name:sk.name }); break
      case 'guaranteeCrit':
        this.heroBuffs.push({ type:'critBoost', pct:100, dur:1, bad:false, name:sk.name }); break
      case 'comboDmgUp':
        this.heroBuffs.push({ type:'comboDmgUp', pct:sk.pct, dur:1, bad:false, name:sk.name }); break
      case 'onKillHeal':
        this.heroBuffs.push({ type:'onKillHeal', pct:sk.pct, dur:99, bad:false, name:sk.name }); break
    }
  }

  // ===== 奖励/商店/休息/奇遇应用 =====
  _applyReward(rw) {
    if (!rw) return
    switch(rw.type) {
      case REWARD_TYPES.NEW_PET: {
        const newPet = { ...rw.data, currentCd: 0 }
        if (this.petBag.length < 8) {
          this.petBag.push(newPet)
        } else {
          this.petBag[this.petBag.length - 1] = newPet
        }
        break
      }
      case REWARD_TYPES.NEW_WEAPON: {
        const newWpn = { ...rw.data }
        if (this.weaponBag.length < 4) {
          this.weaponBag.push(newWpn)
        } else {
          this.weaponBag[this.weaponBag.length - 1] = newWpn
        }
        break
      }
      case REWARD_TYPES.BUFF: {
        this._applyBuffReward(rw.data)
        break
      }
    }
  }

  // 应用加成奖励到runBuffs
  _applyBuffReward(b) {
    if (!b || !b.buff) return
    const rb = this.runBuffs
    switch(b.buff) {
      // 全队永久增益
      case 'allAtkPct':       rb.allAtkPct += b.val; break
      case 'hpMaxPct': {
        rb.hpMaxPct += b.val
        // 立即更新血量上限
        const oldMax = this.heroMaxHp
        this.heroMaxHp = Math.round(60 * (1 + rb.hpMaxPct / 100))
        this.heroHp = Math.min(this.heroHp + (this.heroMaxHp - oldMax), this.heroMaxHp)
        break
      }
      case 'heartBoostPct':   rb.heartBoostPct += b.val; break
      case 'comboDmgPct':     rb.comboDmgPct += b.val; break
      case 'elim3DmgPct':     rb.elim3DmgPct += b.val; break
      case 'elim4DmgPct':     rb.elim4DmgPct += b.val; break
      case 'elim5DmgPct':     rb.elim5DmgPct += b.val; break
      case 'counterDmgPct':   rb.counterDmgPct += b.val; break
      case 'skillDmgPct':     rb.skillDmgPct += b.val; break
      case 'skillCdReducePct': rb.skillCdReducePct += b.val; break
      case 'extraTimeSec':    rb.extraTimeSec += b.val; break
      case 'regenPerTurn':    rb.regenPerTurn += b.val; break
      case 'dmgReducePct':    rb.dmgReducePct += b.val; break
      case 'bonusCombo':      rb.bonusCombo += b.val; break
      case 'stunDurBonus':    rb.stunDurBonus += b.val; break
      // 敌方减益
      case 'enemyAtkReducePct':  rb.enemyAtkReducePct += b.val; break
      case 'enemyHpReducePct':   rb.enemyHpReducePct += b.val; break
      case 'enemyDefReducePct':  rb.enemyDefReducePct += b.val; break
      case 'eliteAtkReducePct':  rb.eliteAtkReducePct += b.val; break
      case 'eliteHpReducePct':   rb.eliteHpReducePct += b.val; break
      case 'bossAtkReducePct':   rb.bossAtkReducePct += b.val; break
      case 'bossHpReducePct':    rb.bossHpReducePct += b.val; break
      // 临时/即时效果
      case 'healNow': {
        const heal = Math.round(this.heroMaxHp * b.val / 100)
        this.heroHp = Math.min(this.heroHp + heal, this.heroMaxHp)
        break
      }
      case 'spawnHeart':
        // 标记下一场开局生成心珠（简化：直接回血等量）
        this.heroHp = Math.min(this.heroHp + b.val * 5, this.heroMaxHp)
        break
      case 'nextDmgReduce':     rb.nextDmgReducePct += b.val; break
      case 'postBattleHeal':    rb.postBattleHealPct += b.val; break
      case 'extraRevive':       rb.extraRevive += b.val; break
      case 'nextComboNeverBreak': this.comboNeverBreak = true; break
    }
  }

  _applyShopItem(item) {
    if (!item) return
    switch(item.effect) {
      case 'getPet': {
        const newPet = randomPet()
        if (this.petBag.length < 8) {
          this.petBag.push({ ...newPet, currentCd: 0 })
        } else {
          // 背包满，替换上场随机一只
          const idx = Math.floor(Math.random() * this.pets.length)
          this.pets[idx] = { ...newPet, currentCd: 0 }
        }
        break
      }
      case 'getWeapon': {
        const newWpn = randomWeapon()
        if (this.weaponBag.length < 4) {
          this.weaponBag.push(newWpn)
        } else if (!this.weapon) {
          this.weapon = newWpn
        } else {
          this.weaponBag[this.weaponBag.length - 1] = newWpn
        }
        break
      }
      case 'fullHeal':
        this.heroHp = this.heroMaxHp; break
      case 'upgradePet': {
        const idx = Math.floor(Math.random() * this.pets.length)
        this.pets[idx].atk = Math.round(this.pets[idx].atk * (1 + (item.pct||20)/100))
        break
      }
      case 'clearDebuff':
        this.heroBuffs = this.heroBuffs.filter(b => !b.bad); break
      case 'hpMaxUp': {
        const inc = Math.round(this.heroMaxHp * (item.pct||10) / 100)
        this.heroMaxHp += inc; this.heroHp += inc; break
      }
    }
  }

  _applyRestOption(opt) {
    if (!opt) return
    switch(opt.effect) {
      case 'healPct':
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp * opt.pct / 100)); break
      case 'allAtkUp':
        this.runBuffs.allAtkPct += opt.pct; break
    }
  }

  _applyAdventure(adv) {
    if (!adv) return
    switch(adv.effect) {
      case 'allAtkUp':      this.runBuffs.allAtkPct += adv.pct; break
      case 'healPct':        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp*adv.pct/100)); break
      case 'hpMaxUp':        { const inc = Math.round(this.heroMaxHp*adv.pct/100); this.heroMaxHp += inc; this.heroHp += inc; break }
      case 'getWeapon':      { const w = randomWeapon(); if (this.weaponBag.length<4) this.weaponBag.push(w); else if (!this.weapon) this.weapon=w; else this.weaponBag[this.weaponBag.length-1]=w; break }
      case 'skipBattle':     this.skipNextBattle = true; break
      case 'fullHeal':       this.heroHp = this.heroMaxHp; break
      case 'extraTime':      this.runBuffs.extraTimeSec += adv.sec; break
      case 'upgradePet':     { const i = Math.floor(Math.random()*this.pets.length); this.pets[i].atk = Math.round(this.pets[i].atk*1.2); break }
      case 'shield':         this.heroShield += adv.val || 50; break
      case 'nextStun':       this.nextStunEnemy = true; break
      case 'attrDmgUp':      this.runBuffs.attrDmgPct[adv.attr] = (this.runBuffs.attrDmgPct[adv.attr]||0) + adv.pct; break
      case 'multiAttrUp':    adv.attrs.forEach(a => { this.runBuffs.attrDmgPct[a] = (this.runBuffs.attrDmgPct[a]||0) + adv.pct }); break
      case 'comboNeverBreak': this.comboNeverBreak = true; break
      case 'getPet':         { const p = randomPet(); if (this.petBag.length<8) this.petBag.push({...p,currentCd:0}); else { const i2=Math.floor(Math.random()*this.pets.length); this.pets[i2]={...p,currentCd:0} } break }
      case 'clearDebuff':    this.heroBuffs = this.heroBuffs.filter(b => !b.bad); break
      case 'heartBoost':     this.runBuffs.heartBoostPct += adv.pct; break
      case 'weaponBoost':    this.runBuffs.weaponBoostPct += adv.pct; break
      case 'allDmgUp':       this.runBuffs.allDmgPct += adv.pct; break
      case 'skipFloor':      this.floor++; break
      case 'nextDmgDouble':  this.nextDmgDouble = true; break
      case 'tempRevive':     this.tempRevive = true; break
      case 'petAtkUp':       { const i3 = Math.floor(Math.random()*this.pets.length); this.pets[i3].atk = Math.round(this.pets[i3].atk*(1+adv.pct/100)); break }
      case 'goodBeads':      this.goodBeadsNextTurn = true; break
      case 'immuneOnce':     this.immuneOnce = true; break
      case 'tripleChoice':   this.rewards = generateRewards(this.floor, 'battle'); this.selectedReward = -1; this.rewardPetSlot = -1; this.scene = 'reward'; return
    }
  }

  _onDefeat() {
    // 复活检查
    if (this.tempRevive) {
      this.tempRevive = false; this.heroHp = Math.round(this.heroMaxHp * 0.3)
      this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'天护复活！', color:TH.accent, t:0, alpha:1 })
      this.bState = 'playerTurn'; this.dragTimer = 0; return
    }
    // runBuffs额外复活次数
    if (this.runBuffs.extraRevive > 0) {
      this.runBuffs.extraRevive--; this.heroHp = Math.round(this.heroMaxHp * 0.25)
      this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'奇迹复活！', color:TH.accent, t:0, alpha:1 })
      this.bState = 'playerTurn'; this.dragTimer = 0; return
    }
    if (this.weapon && this.weapon.type === 'revive' && !this.weaponReviveUsed) {
      this.weaponReviveUsed = true; this.heroHp = Math.round(this.heroMaxHp * 0.2)
      this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'不灭金身！', color:TH.accent, t:0, alpha:1 })
      this.bState = 'playerTurn'; this.dragTimer = 0; return
    }
    this.bState = 'defeat'
  }

  _hitRect(x,y,rx,ry,rw,rh) { return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh }
}

new Main()
