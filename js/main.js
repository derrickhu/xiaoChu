/**
 * 五行通天塔 - 主游戏逻辑
 * Roguelike爬塔 + 智龙迷城式拖拽转珠 + 五行克制
 * 无局外养成，死亡即重开，仅记录最高层数
 */
const { Render, TH } = require('./render')
const Storage = require('./data/storage')
const {
  ATTR_COLOR, EVENT_TYPE, ADVENTURES,
  generateFloorEvent,
} = require('./data/tower')
const { generateStarterPets } = require('./data/pets')
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
    this.storage.onCloudReady = () => R.preloadCloudAssets(
      (loaded, failed, total) => {
        this._cloudLoadProgress = { loaded, failed, total }
      },
      (loaded, failed) => {
        this._cloudAssetsReady = true
        console.log(`[Main] 云资源加载完毕, 成功:${loaded}, 失败:${failed}`)
      }
    )
    this._cloudAssetsReady = false
    this._cloudLoadProgress = { loaded: 0, failed: 0, total: 0 }
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

    // Run state (Roguelike)
    this.floor = 0
    this.pets = []          // [{...petData, attr, currentCd}] — 上场5只
    this.weapon = null      // 当前装备法宝
    this.petBag = []        // 宠物背包，最多8只
    this.weaponBag = []     // 法宝背包，最多4件
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
    this.showRunBuffDetail = false // 全局增益详情弹窗
    this.showWeaponDetail = false  // 战斗中法宝详情弹窗
    this.showBattlePetDetail = null // 战斗中宠物详情弹窗（宠物索引）
    this._runBuffIconRects = []   // 全局增益图标点击区域
    // 局内BUFF日志（用于左侧图标列显示）
    this.runBuffLog = []
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
    // 长按预览
    this._petLongPressTimer = null
    this._petLongPressIndex = -1
    this._petLongPressTriggered = false
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

    const loop = () => { this.af++; this.update(); this.render(); requestAnimationFrame(loop) }
    requestAnimationFrame(loop)
  }

  // ===== Run管理 =====
  _startRun() {
    this.floor = 0
    this.pets = generateStarterPets()
    this.weapon = null
    this.petBag = []        // 宠物背包清空
    this.weaponBag = []     // 法宝背包清空
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
    this.runBuffLog = []
    this.skipNextBattle = false; this.nextStunEnemy = false; this.nextDmgDouble = false
    this.tempRevive = false; this.immuneOnce = false; this.comboNeverBreak = false
    this.weaponReviveUsed = false; this.goodBeadsNextTurn = false
    this.adReviveUsed = false // 广告复活（每轮通关仅一次机会）
    this.turnCount = 0; this.combo = 0
    this.storage._d.totalRuns++; this.storage._save()
    this._nextFloor()
  }

  _nextFloor() {
    // 还原宠物技能/法宝在上一场战斗中临时增加的血量上限
    this._restoreBattleHpMax()
    // 清除战斗中产生的临时buff（宠物技能/法宝buff仅当前层有效）
    this.heroBuffs = []
    this.enemyBuffs = []
    // 清除上一层战斗中获得的护盾（宠物技能护盾不跨层）
    this.heroShield = 0
    this.floor++
    if (this.floor > 1) MusicMgr.playLevelUp()
    // 法宝perFloorBuff
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
    // 进入事件预览页面
    this.prepareTab = 'pets'
    this.prepareSelBagIdx = -1
    this.prepareSelSlotIdx = -1
    this._eventPetDetail = null
    this.scene = 'event'
  }

  // 还原战斗中宠物技能/法宝临时增加的血量上限
  _restoreBattleHpMax() {
    if (this._baseHeroMaxHp != null && this._baseHeroMaxHp !== this.heroMaxHp) {
      const base = this._baseHeroMaxHp
      // 按比例缩减当前血量（不超过恢复后的上限）
      this.heroHp = Math.min(this.heroHp, base)
      this.heroMaxHp = base
    }
    this._baseHeroMaxHp = null
  }

  _endRun() {
    this.storage.updateBestFloor(this.floor, this.pets, this.weapon)
    this.storage.clearRunState()
    // 提交排行榜（已授权时自动提交）
    if (this.storage.userAuthorized) {
      this.storage.submitScore(this.floor, this.pets, this.weapon)
    }
    MusicMgr.playGameOver()
    this.scene = 'gameover'
  }

  // 暂存退出：保存当前局内所有状态，回到标题页
  _saveAndExit() {
    // 还原战斗中临时增加的血量上限，确保存档的是基础值
    this._restoreBattleHpMax()
    const runState = {
      floor: this.floor,
      pets: JSON.parse(JSON.stringify(this.pets)),
      weapon: this.weapon ? JSON.parse(JSON.stringify(this.weapon)) : null,
      petBag: JSON.parse(JSON.stringify(this.petBag)),
      weaponBag: JSON.parse(JSON.stringify(this.weaponBag)),
      heroHp: this.heroHp, heroMaxHp: this.heroMaxHp, heroShield: this.heroShield,
      heroBuffs: JSON.parse(JSON.stringify(this.heroBuffs)),
      runBuffs: JSON.parse(JSON.stringify(this.runBuffs)),
      runBuffLog: JSON.parse(JSON.stringify(this.runBuffLog || [])),
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
    this.runBuffLog = s.runBuffLog || []
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
    // 进入事件预览页面
    this.prepareTab = 'pets'
    this.prepareSelBagIdx = -1
    this.prepareSelSlotIdx = -1
    this._eventPetDetail = null
    this.scene = 'event'
  }

  // ===== 更新 =====
  update() {
    if (this.shakeT > 0) this.shakeT--
    if (this._comboFlash > 0) this._comboFlash--
    // 粒子更新
    this._comboParticles = this._comboParticles.filter(p => {
      p.t++
      p.x += p.vx; p.y += p.vy
      p.vy += p.gravity
      p.vx *= 0.98
      return p.t < p.life
    })
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
    // Combo弹出动画（弹性缩放 + 上浮淡出 + 伤害二级延迟弹入 + 百分比三级飞入）
    if (this._comboAnim && this._comboAnim.timer < 60) {
      // 在攻击展示阶段冻结计时器，防止combo显示淡出消失
      const freezeTimer = (this.bState === 'preAttack' || this.bState === 'petAtkShow') && this._comboAnim.timer >= 40
      if (!freezeTimer) this._comboAnim.timer++
      const t = this._comboAnim.timer
      // 前10帧：Combo数字弹性缩放（从初始scale弹到1.0）
      if (t <= 10) {
        const p = t / 10
        const initScale = this._comboAnim._initScale || 2.5
        if (p < 0.4) this._comboAnim.scale = initScale - (initScale - 0.7) * (p / 0.4)
        else if (p < 0.7) this._comboAnim.scale = 0.88 + 0.12 * ((p - 0.4) / 0.3)
        else this._comboAnim.scale = 1.0
        this._comboAnim.alpha = 1
        this._comboAnim.offsetY = 0
      }
      // 11~40帧：稳定展示 + 呼吸脉冲
      else if (t <= 40) {
        const breathP = Math.sin((t - 10) * 0.2) * 0.04 // 微弱呼吸缩放
        this._comboAnim.scale = 1.0 + breathP
        this._comboAnim.alpha = 1
        this._comboAnim.offsetY = 0
      }
      // 41~60帧：上浮淡出（仅在消除/下落阶段淡出，攻击展示阶段保持可见）
      else {
        const inCombat = this.bState === 'preAttack' || this.bState === 'petAtkShow'
        if (inCombat) {
          // 攻击阶段保持Combo可见，不淡出
          this._comboAnim.scale = 1.0
          this._comboAnim.alpha = 1
          this._comboAnim.offsetY = 0
        } else {
          const fadeP = (t - 40) / 20
          this._comboAnim.scale = 1.0 - 0.12 * fadeP
          this._comboAnim.alpha = 1 - fadeP
          this._comboAnim.offsetY = -fadeP * 25 * S
        }
      }
      // 伤害部分延迟5帧后弹入（独立二级动画）
      const dt = t - 5
      if (dt > 0 && dt <= 8) {
        const dp = dt / 8
        if (dp < 0.5) this._comboAnim.dmgScale = 2.0 - 2.0 * (dp / 0.5)
        else if (dp < 0.8) this._comboAnim.dmgScale = 0.9 + 0.1 * ((dp - 0.5) / 0.3)
        else this._comboAnim.dmgScale = 1.0
        this._comboAnim.dmgAlpha = Math.min(1, dt / 4)
      } else if (dt > 8) {
        this._comboAnim.dmgScale = 1.0
        this._comboAnim.dmgAlpha = 1
      } else {
        this._comboAnim.dmgScale = 0
        this._comboAnim.dmgAlpha = 0
      }
      // 百分比标签延迟10帧后从右侧弹射飞入（三级动画）
      const pt = t - 10
      if (pt > 0 && pt <= 10) {
        const pp = pt / 10
        // 从右侧80px飞入，带弹性
        if (pp < 0.5) this._comboAnim.pctOffX = (1 - pp / 0.5) * 80 * S
        else if (pp < 0.8) this._comboAnim.pctOffX = -8 * S * ((pp - 0.5) / 0.3)
        else this._comboAnim.pctOffX = 0
        // 缩放弹跳
        if (pp < 0.3) this._comboAnim.pctScale = 0.5 + 1.5 * (pp / 0.3)
        else if (pp < 0.6) this._comboAnim.pctScale = 2.0 - 1.2 * ((pp - 0.3) / 0.3)
        else if (pp < 0.85) this._comboAnim.pctScale = 0.8 + 0.3 * ((pp - 0.6) / 0.25)
        else this._comboAnim.pctScale = 1.1
        this._comboAnim.pctAlpha = Math.min(1, pt / 5)
      } else if (pt > 10 && pt <= 30) {
        this._comboAnim.pctOffX = 0
        this._comboAnim.pctScale = 1.1 - 0.1 * Math.min(1, (pt - 10) / 5)
        this._comboAnim.pctAlpha = 1
      } else if (pt > 30) {
        this._comboAnim.pctOffX = 0
        this._comboAnim.pctScale = 1.0
        this._comboAnim.pctAlpha = 1
      } else {
        this._comboAnim.pctOffX = 80 * S
        this._comboAnim.pctScale = 0
        this._comboAnim.pctAlpha = 0
      }
    }
    // 宠物头像攻击数值动画
    this.petAtkNums = this.petAtkNums.filter(f => {
      f.t++
      const prefix = f.isHeal ? '+' : ''
      if (f.t <= f.rollFrames) {
        const progress = f.t / f.rollFrames
        const ease = 1 - Math.pow(1 - progress, 3)
        f.displayVal = Math.round(f.finalVal * ease)
        f.text = `${prefix}${f.displayVal}`
        f.scale = 1.0 + 0.2 * Math.sin(f.t * 0.8)
        if (f.t % 4 === 0) MusicMgr.playRolling()
      } else {
        f.text = `${prefix}${f.finalVal}`
        f.scale = 1.0
        if (f.t > f.rollFrames + 20) f.alpha -= 0.05
      }
      return f.alpha > 0
    })
    if (this.scene === 'loading') {
      const elapsed = Date.now() - this._loadStart
      const minWait = elapsed > 1500
      const maxWait = elapsed > 15000 // 超时保底15秒
      if ((minWait && this._cloudAssetsReady) || maxWait) {
        this.scene = 'title'; MusicMgr.playBgm()
      }
    }
    if (this.bState === 'elimAnim') this._processElim()
    if (this.bState === 'dropping') this._processDropAnim()
    if (this.dragging && this.bState === 'playerTurn') {
      this.dragTimer++
      if (this.dragTimer >= this.dragTimeLimit) {
        this.dragging = false; this.dragAttr = null; this.dragTimer = 0
        MusicMgr.playDragEnd()  // 时间到松手音效
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
    if (this._heroHpGain) { this._heroHpGain.timer++; if (this._heroHpGain.timer >= 40) this._heroHpGain = null }
    // 技能预览计时器
    if (this.skillPreview) {
      this.skillPreview.timer++
      if (this.skillPreview.timer >= this.skillPreview.duration) {
        this.skillPreview = null
      }
    }
    // 排行榜自动刷新（每60秒）
    if (this.scene === 'ranking' && this.af % 3600 === 0) {
      this.storage.fetchRanking(this.rankTab, true)
    }
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
      case 'ranking': this._rRanking(); break
      case 'stats': this._rStats(); break
    }
    // 飘字&特效
    this.dmgFloats.forEach(f => R.drawDmgFloat(f))
    this.skillEffects.forEach(e => R.drawSkillEffect(e))
    if (this.skillCastAnim.active) R.drawSkillCast(this.skillCastAnim)
    ctx.restore()
  }

  // ===== 场景渲染（委托到 views 模块）=====
  _rLoading() { screens.rLoading(this) }
  _rTitle() { screens.rTitle(this) }

  _rPrepare() { prepareView.rPrepare(this) }
  _drawPrepareTip() { prepareView.drawPrepareTip(this) }
  _wrapText(text, maxW, fontSize) { return prepareView.wrapText(text, maxW, fontSize) }

  _rEvent() { eventView.rEvent(this) }
  _drawEventPetDetail() { eventView.drawEventPetDetail(this) }

  _rBattle() { battleView.rBattle(this) }
  _rReward() { screens.rReward(this) }
  _rShop() { screens.rShop(this) }
  _rRest() { screens.rRest(this) }
  _rAdventure() { screens.rAdventure(this) }
  _rGameover() { screens.rGameover(this) }
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

  _rRanking() { screens.rRanking(this) }
  _tRanking(type,x,y) { touchH.tRanking(this,type,x,y) }

  // ===== 历史统计场景 =====
  _rStats() { screens.rStats(this) }
  _tStats(type,x,y) { touchH.tStats(this,type,x,y) }

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

  // 队伍栏：法宝1 + 宠物5 = 6个1:1正方形头像框
  _drawTeamBar(topY, barH, iconSize) { battleView.drawTeamBar(this, topY, barH, iconSize) }
  _drawBattlePetBar(bottomY) {
    // 保留向后兼容（不再调用）
  }

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
    this.skillCastAnim = { active:true, progress:0, duration:25, type:'heal', color:'#d4607a', skillName:'', targetX:W*0.5, targetY:L.hpBarY }
    MusicMgr.playHeal()  // 回血治愈音效
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
      case 'ranking': this._tRanking(type,x,y); break
      case 'stats': this._tStats(type,x,y); break
    }
  }

  _tTitle(type,x,y) { touchH.tTitle(this,type,x,y) }

  _tPrepare(type,x,y) { touchH.tPrepare(this,type,x,y) }
  // 从prepare返回事件预览页面
  _enterEvent() {
    this._eventPetDetail = null
    this.scene = 'event'
  }

  _tEvent(type,x,y) { touchH.tEvent(this,type,x,y) }

  _tBattle(type,x,y) { touchH.tBattle(this,type,x,y) }
  // 显示技能预览（长按触发）
  _showSkillPreview(pet, index) { skillEngine.showSkillPreview(this, pet, index) }

  _tReward(type,x,y) { touchH.tReward(this,type,x,y) }

  _tShop(type,x,y) { touchH.tShop(this,type,x,y) }

  _tRest(type,x,y) { touchH.tRest(this,type,x,y) }

  _tAdventure(type,x,y) { touchH.tAdventure(this,type,x,y) }

  _tGameover(type,x,y) { touchH.tGameover(this,type,x,y) }
  // ===== 战斗进入 =====
  _enterBattle(enemyData) { battleEngine.enterBattle(this, enemyData) }

  _initBoard() { battleEngine.initBoard(this) }


  _cellAttr(r, c) { return battleEngine.cellAttr(this, r, c) }
  // ===== 消除核心 =====
  _checkAndElim() { battleEngine.checkAndElim(this) }

  _startNextElimAnim() { battleEngine.startNextElimAnim(this) }

  _processElim() { battleEngine.processElim(this) }

  _processDropAnim() { battleEngine.processDropAnim(this) }

  _findMatchesSeparate() { return battleEngine.findMatchesSeparate(this) }

  _fillBoard() { battleEngine.fillBoard(this) }
  // ===== 宠物头像攻击数值展示阶段 =====
  _enterPetAtkShow() { battleEngine.enterPetAtkShow(this) }
  // ===== 攻击结算 =====
  _executeAttack() { battleEngine.executeAttack(this) }
  // 计算当前暴击率和暴击倍率
  _calcCrit() { return battleEngine.calcCrit(this) }

  _applyFinalDamage(dmgMap, heal) { battleEngine.applyFinalDamage(this, dmgMap, heal) }

  _settle() { battleEngine.settle(this) }

  _enemyTurn() { battleEngine.enemyTurn(this) }
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
        // 护盾吸收飘字
        this.dmgFloats.push({ x:W*0.5, y:H*0.7, text:`盾-${dmg}`, color:'#40b8e0', t:0, alpha:1 })
        return
      }
      const shieldAbs = this.heroShield
      dmg -= this.heroShield; this.heroShield = 0
      this.dmgFloats.push({ x:W*0.45, y:H*0.7, text:`盾-${shieldAbs}`, color:'#40b8e0', t:0, alpha:1 })
    }
    const oldPct = this.heroHp / this.heroMaxHp
    this.heroHp = Math.max(0, this.heroHp - dmg)
    this._heroHpLoss = { fromPct: oldPct, timer: 0 }
    this.dmgFloats.push({ x:W*0.5, y:H*0.7, text:`-${dmg}`, color:TH.danger, t:0, alpha:1 })
  }

  _applyEnemySkill(sk) { battleEngine.applyEnemySkill(this, sk) }
  // ===== 宠物技能 =====
  _triggerPetSkill(pet, idx) { skillEngine.triggerPetSkill(this, pet, idx) }
  // ===== 奖励/商店/休息/奇遇应用 =====
  _applyReward(rw) { skillEngine.applyReward(this, rw) }
  // 应用加成奖励到runBuffs
  _applyBuffReward(b) { skillEngine.applyBuffReward(this, b) }

  _applyShopItem(item) { skillEngine.applyShopItem(this, item) }

  _applyRestOption(opt) { skillEngine.applyRestOption(this, opt) }

  _applyAdventure(adv) { skillEngine.applyAdventure(this, adv) }

  _onDefeat() {
    // 复活检查
    if (this.tempRevive) {
      this.tempRevive = false; this.heroHp = Math.round(this.heroMaxHp * 0.3)
      this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'天护复活！', color:TH.accent, t:0, alpha:1 })
      MusicMgr.playRevive()  // 复活专属音效
      this.bState = 'playerTurn'; this.dragTimer = 0; return
    }
    // runBuffs额外复活次数
    if (this.runBuffs.extraRevive > 0) {
      this.runBuffs.extraRevive--; this.heroHp = Math.round(this.heroMaxHp * 0.25)
      this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'奇迹复活！', color:TH.accent, t:0, alpha:1 })
      MusicMgr.playRevive()  // 复活专属音效
      this.bState = 'playerTurn'; this.dragTimer = 0; return
    }
    if (this.weapon && this.weapon.type === 'revive' && !this.weaponReviveUsed) {
      this.weaponReviveUsed = true; this.heroHp = Math.round(this.heroMaxHp * 0.2)
      this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'不灭金身！', color:TH.accent, t:0, alpha:1 })
      MusicMgr.playRevive()  // 复活专属音效
      this.bState = 'playerTurn'; this.dragTimer = 0; return
    }
    // 广告复活机会（每轮通关首次死亡）
    if (!this.adReviveUsed) {
      this.bState = 'adReviveOffer'; return
    }
    this.bState = 'defeat'
  }

  // ===== 广告复活执行（预留广告接入位）=====
  _doAdRevive() {
    // TODO: 接入广告SDK，播放激励视频广告
    // wx.createRewardedVideoAd / 其他广告平台
    // 广告播放成功回调中执行以下逻辑：
    this._adReviveCallback()

    // 实际接入时替换为：
    // if (!this._rewardedVideoAd) {
    //   this._rewardedVideoAd = wx.createRewardedVideoAd({ adUnitId: 'YOUR_AD_UNIT_ID' })
    //   this._rewardedVideoAd.onClose(res => {
    //     if (res && res.isEnded) this._adReviveCallback()
    //     else { /* 广告未看完，不复活 */ }
    //   })
    // }
    // this._rewardedVideoAd.show().catch(() => {
    //   this._rewardedVideoAd.load().then(() => this._rewardedVideoAd.show())
    // })
  }

  _adReviveCallback() {
    this.adReviveUsed = true
    this.heroHp = this.heroMaxHp // 满血复活
    this.heroShield = 0
    // 清除不利buff
    this.heroBuffs = this.heroBuffs.filter(b => !b.bad)
    this.skillEffects.push({ x:W*0.5, y:H*0.5, text:'浴火重生！', color:'#ffd700', t:0, alpha:1 })
    MusicMgr.playRevive()  // 复活专属音效
    this.bState = 'playerTurn'; this.dragTimer = 0
  }

  _hitRect(x,y,rx,ry,rw,rh) { return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh }
}

new Main()
