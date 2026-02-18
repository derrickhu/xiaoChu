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
const ViewEnv = require('./views/env')
const screens = require('./views/screens')
const prepareView = require('./views/prepareView')
const eventView = require('./views/eventView')
const battleView = require('./views/battleView')
const dialogs = require('./views/dialogs')

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
  _tRanking(type, x, y) {
    // 滚动支持
    if (type === 'start') {
      this._rankTouchStartY = y
      this._rankScrollStart = this.rankScrollY || 0
      return
    }
    if (type === 'move') {
      const dy = y - (this._rankTouchStartY || y)
      const list = this.rankTab === 'all' ? this.storage.rankAllList : this.storage.rankDailyList
      const rowH = 62*S
      const maxScroll = 0
      const minScroll = -Math.max(0, list.length * rowH - (H - 70*S - safeTop - 130*S))
      this.rankScrollY = Math.max(minScroll, Math.min(maxScroll, this._rankScrollStart + dy))
      return
    }
    if (type !== 'end') return

    // 如果滑动距离大于阈值，不触发点击
    const dy = Math.abs(y - (this._rankTouchStartY || y))
    if (dy > 10*S) return

    // 返回按钮
    if (this._backBtnRect && this._hitRect(x, y, ...this._backBtnRect)) {
      this.scene = 'title'; return
    }
    // 刷新按钮
    if (this._rankRefreshRect && this._hitRect(x, y, ...this._rankRefreshRect)) {
      this.storage.fetchRanking(this.rankTab, true)
      return
    }
    // Tab切换
    if (this._rankTabAllRect && this._hitRect(x, y, ...this._rankTabAllRect)) {
      this.rankTab = 'all'; this.rankScrollY = 0
      this.storage.fetchRanking('all')
      return
    }
    if (this._rankTabDailyRect && this._hitRect(x, y, ...this._rankTabDailyRect)) {
      this.rankTab = 'daily'; this.rankScrollY = 0
      this.storage.fetchRanking('daily')
      return
    }
  }

  // ===== 历史统计场景 =====
  _rStats() { screens.rStats(this) }
  _tStats(type, x, y) {
    if (type !== 'end') return
    if (this._backBtnRect && this._hitRect(x, y, ...this._backBtnRect)) {
      this.scene = 'title'; return
    }
  }

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
    // 历史统计
    if (this._statBtnRect && this._hitRect(x,y,...this._statBtnRect)) {
      this.scene = 'stats'; return
    }
    // 排行榜
    if (this._rankBtnRect && this._hitRect(x,y,...this._rankBtnRect)) {
      this._openRanking(); return
    }
  }

  _tPrepare(type,x,y) {
    if (type !== 'end') return

    // 返回事件页
    if (this._backBtnRect && this._hitRect(x,y,...this._backBtnRect)) { this.scene = 'event'; return }

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
          if (tmp) {
            this.petBag[bi] = tmp  // 上场有宠物 → 换到背包原位
          } else {
            this.petBag.splice(bi, 1)  // 上场是空槽 → 从背包移除（不留null）
          }
          this.prepareSelSlotIdx = -1; this.prepareSelBagIdx = -1
        }
        return
      }
    } else {
      // 法宝Tab：点击当前法宝卡片 → 显示详情
      if (this.weapon && this._prepCurWpnRect && this._hitRect(x,y,...this._prepCurWpnRect)) {
        this.prepareTip = { type:'weapon', data: this.weapon, x, y }
        return
      }
      // 法宝背包：点击卡片区域 → 显示详情；点击装备按钮 → 装备
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

  // 从prepare返回事件预览页面
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
    // 法宝切换按钮
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
          this.adventureData = ev.data; this._applyAdventure(ev.data); this.scene = 'adventure'; MusicMgr.playReward(); break
        case 'shop':
          this.shopItems = ev.data; this.shopUsed = false; this.scene = 'shop'; MusicMgr.playReward(); break
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
    // ===== 全局增益详情弹窗处理 =====
    if (this.showRunBuffDetail) {
      if (type === 'end') this.showRunBuffDetail = false
      return
    }
    // ===== 法宝详情弹窗处理 =====
    if (this.showWeaponDetail) {
      if (type === 'end') this.showWeaponDetail = false
      return
    }
    // ===== 宠物详情弹窗处理 =====
    if (this.showBattlePetDetail != null) {
      if (type === 'end') this.showBattlePetDetail = null
      return
    }
    // ===== 退出按钮 =====
    if (type === 'end' && this._exitBtnRect && this._hitRect(x,y,...this._exitBtnRect)) {
      this.showExitDialog = true; return
    }
    // 胜利/失败按钮
    if (this.bState === 'victory' && type === 'end') {
      if (this._victoryBtnRect && this._hitRect(x,y,...this._victoryBtnRect)) {
        // 离开战斗：还原宠物技能/法宝临时血量上限加成
        this._restoreBattleHpMax()
        this.heroBuffs = []; this.enemyBuffs = []
        this.rewards = generateRewards(this.floor, this.curEvent ? this.curEvent.type : 'battle', this.lastSpeedKill); this.selectedReward = -1; this.rewardPetSlot = -1
        this.scene = 'reward'; this.bState = 'none'; return
      }
    }
    if (this.bState === 'defeat' && type === 'end') {
      if (this._defeatBtnRect && this._hitRect(x,y,...this._defeatBtnRect)) { this._endRun(); return }
    }
    // ===== 广告复活弹窗 =====
    if (this.bState === 'adReviveOffer' && type === 'end') {
      // 观看广告复活
      if (this._adReviveBtnRect && this._hitRect(x,y,...this._adReviveBtnRect)) {
        this._doAdRevive(); return
      }
      // 放弃
      if (this._adReviveSkipRect && this._hitRect(x,y,...this._adReviveSkipRect)) {
        this.adReviveUsed = true; this.bState = 'defeat'; return
      }
      return // 弹窗打开时拦截其他触摸
    }
    // ===== 点击左侧全局增益图标 =====
    if (type === 'end' && this.bState !== 'victory' && this.bState !== 'defeat' && this._runBuffIconRects) {
      for (const item of this._runBuffIconRects) {
        if (this._hitRect(x, y, ...item.rect)) {
          this.showRunBuffDetail = true; return
        }
      }
    }
    // ===== 点击敌人区域查看详情（胜利/失败状态下不允许）=====
    if (type === 'end' && this.bState !== 'victory' && this.bState !== 'defeat'
        && this.enemy && this._enemyAreaRect && this._hitRect(x,y,...this._enemyAreaRect)) {
      // 排除退出按钮区域
      if (!this._exitBtnRect || !this._hitRect(x,y,...this._exitBtnRect)) {
        this.showEnemyDetail = true; return
      }
    }
    // 法宝点击查看详情
    if (type === 'end' && this.bState !== 'victory' && this.bState !== 'defeat'
        && this.weapon && this._weaponBtnRect && this._hitRect(x,y,...this._weaponBtnRect)) {
      this.showWeaponDetail = true; return
    }
    // 宠物点击：CD就绪+playerTurn→长按预览/点击释放；否则→查看详情
    if (this._petBtnRects && this.bState !== 'victory' && this.bState !== 'defeat') {
      for (let i = 0; i < this._petBtnRects.length; i++) {
        if (i < this.pets.length && this._hitRect(x,y,...this._petBtnRects[i])) {
          const pet = this.pets[i]
          const skillReady = this.bState === 'playerTurn' && !this.dragging && pet.currentCd <= 0
          
          if (type === 'start') {
            // 触摸开始：技能就绪时启动长按计时器
            if (skillReady) {
              this._petLongPressIndex = i
              this._petLongPressTriggered = false
              // 清除之前的计时器
              if (this._petLongPressTimer) {
                clearTimeout(this._petLongPressTimer)
              }
              // 设置长按计时器（500ms）
              this._petLongPressTimer = setTimeout(() => {
                this._petLongPressTriggered = true
                // 显示技能预览
                this._showSkillPreview(pet, i)
              }, 500)
            }
            return
          }
          else if (type === 'move') {
            // 手指移动：取消长按计时器
            if (this._petLongPressIndex === i && this._petLongPressTimer) {
              clearTimeout(this._petLongPressTimer)
              this._petLongPressTimer = null
              this._petLongPressIndex = -1
            }
            return
          }
          else if (type === 'end') {
            // 触摸结束：清除长按计时器
            if (this._petLongPressTimer) {
              clearTimeout(this._petLongPressTimer)
              this._petLongPressTimer = null
            }
            // 如果长按已触发，显示预览后不执行其他操作
            if (this._petLongPressTriggered && this._petLongPressIndex === i) {
              this._petLongPressIndex = -1
              this._petLongPressTriggered = false
              return
            }
            this._petLongPressIndex = -1
            
            // 正常点击逻辑
            if (skillReady) {
              this._triggerPetSkill(pet, i)
            } else {
              this.showBattlePetDetail = i
            }
            return
          }
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
        MusicMgr.playPickUp()  // 珠子拾起音效
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
        MusicMgr.playSwap()  // 珠子交换音效
      }
    } else if (type === 'end' && this.dragging) {
      this.dragging = false; this.dragAttr = null; this.dragTimer = 0
      MusicMgr.playDragEnd()  // 松手确认音效
      this._checkAndElim()
    }
  }

  // 显示技能预览（长按触发）
  _showSkillPreview(pet, index) {
    const sk = pet.skill
    if (!sk) return
    
    // 计算弹窗位置（在宠物头像附近）
    const L = this._getBattleLayout()
    const iconSize = L.iconSize
    const iconY = L.teamBarY + (L.teamBarH - iconSize) / 2
    const sidePad = 8*S
    const wpnGap = 12*S
    const petGap = 8*S
    
    // 计算宠物头像位置（与_drawTeamBar中一致）
    let ix
    if (index === 0) {  // 法宝
      ix = sidePad
    } else {
      ix = sidePad + iconSize + wpnGap + (index - 1) * (iconSize + petGap)
    }
    
    // 弹窗居中在头像下方
    const popupX = ix + iconSize/2
    const popupY = iconY + iconSize + 10*S
    
    this.skillPreview = {
      pet: pet,
      index: index,
      timer: 0,
      x: popupX,
      y: popupY,
      skillName: sk.name,
      skillDesc: sk.desc || '无描述',
      // 自动关闭计时（3秒）
      duration: 180 // 180帧 @60fps = 3秒
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
    // 记录进入本层时的基础血量上限（用于战斗结束后还原）
    this._baseHeroMaxHp = this.heroMaxHp
    // 法宝 hpMaxUp 临时加成（仅当前战斗有效）
    if (this.weapon && this.weapon.type === 'hpMaxUp') {
      const inc = Math.round(this.heroMaxHp * this.weapon.pct / 100)
      this.heroMaxHp += inc; this.heroHp += inc
    }
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
    this._enemyHpLoss = null; this._heroHpLoss = null; this._heroHpGain = null
    this.showEnemyDetail = false
    this.showRunBuffDetail = false
    this.showWeaponDetail = false
    this.showBattlePetDetail = null
    if (this.nextStunEnemy) {
      this.nextStunEnemy = false
      this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
    }
    this.scene = 'battle'
    // BOSS出场音效
    if (this.enemy && this.enemy.isBoss) MusicMgr.playBoss()
    // 每场战斗开始时设置灵兽技能CD（降低为基础CD的60%，更容易释放）
    this.pets.forEach(p => { p.currentCd = Math.ceil(p.cd * 0.6) })
    this._initBoard()
    // 法宝额外转珠时间
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
      MusicMgr.playEliminate(count)  // 根据消除数量调整音效
      this.bState = 'elimAnim'
      return
    }
    this.combo++
    // Combo弹出动画
    this._comboAnim = { num: this.combo, timer: 0, scale: 2.5, _initScale: 2.5, alpha: 1, offsetY: 0, dmgScale: 0, dmgAlpha: 0, pctScale: 0, pctAlpha: 0, pctOffX: 80*S }
    this._comboFlash = this.combo >= 5 ? 8 : 5 // 白色闪光帧数
    // 层级突破特效：恰好到达5/8/12连击时，更强的闪光和粒子环
    const isTierBreak = this.combo === 5 || this.combo === 8 || this.combo === 12
    if (isTierBreak) {
      this._comboFlash = 12 // 更持久的闪光
      this._comboAnim.scale = 3.5  // 更夸张的初始缩放
      this._comboAnim._initScale = 3.5
    }
    // 粒子爆炸：连击越高粒子越多越猛
    const pCount = (this.combo >= 12 ? 40 : this.combo >= 8 ? 28 : this.combo >= 5 ? 18 : 10) + (isTierBreak ? 20 : 0)
    const pCx = W * 0.5, pCy = this.boardY + (ROWS * this.cellSize) * 0.32
    const pColors = this.combo >= 12 ? ['#ff2050','#ff6040','#ffaa00','#fff','#ff80aa']
      : this.combo >= 8 ? ['#ff4d6a','#ff8060','#ffd700','#fff']
      : this.combo >= 5 ? ['#ff8c00','#ffd700','#fff','#ffcc66']
      : ['#ffd700','#ffe066','#fff']
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = (2 + Math.random() * 4) * S * (this.combo >= 8 ? 1.5 : 1)
      this._comboParticles.push({
        x: pCx, y: pCy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (1 + Math.random() * 2) * S,
        size: (2 + Math.random() * 3) * S * (this.combo >= 8 ? 1.3 : 1),
        color: pColors[Math.floor(Math.random() * pColors.length)],
        life: 20 + Math.floor(Math.random() * 20),
        t: 0,
        gravity: 0.15 * S,
        type: Math.random() < 0.3 ? 'star' : 'circle'
      })
    }
    // 层级突破：额外环形粒子爆射（从圆心均匀扩散）
    if (isTierBreak) {
      const ringCount = this.combo >= 12 ? 24 : this.combo >= 8 ? 18 : 12
      const ringColors = this.combo >= 12 ? ['#fff','#ff80aa','#ffcc00','#ff4060'] : this.combo >= 8 ? ['#fff','#ffd700','#ff6080'] : ['#fff','#ffd700','#ffcc66']
      for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2
        const spd = (4 + Math.random() * 2) * S
        this._comboParticles.push({
          x: pCx, y: pCy,
          vx: Math.cos(angle) * spd,
          vy: Math.sin(angle) * spd,
          size: (3 + Math.random() * 2) * S,
          color: ringColors[Math.floor(Math.random() * ringColors.length)],
          life: 25 + Math.floor(Math.random() * 10),
          t: 0, gravity: 0.05 * S,
          type: 'circle'
        })
      }
    }
    MusicMgr.playComboHit(this.combo)  // 递进式连击音效（音高+音量递增）
    // 里程碑突破音效：5/8/12连击播放特殊升阶音效
    if (isTierBreak) MusicMgr.playComboMilestone(this.combo)
    // 高连击震屏：5连+轻震，8连+中震，12连+强震；层级突破额外加强
    if (this.combo >= 12) { this.shakeT = isTierBreak ? 14 : 10; this.shakeI = (isTierBreak ? 8 : 6)*S }
    else if (this.combo >= 8) { this.shakeT = isTierBreak ? 10 : 7; this.shakeI = (isTierBreak ? 5.5 : 4)*S }
    else if (this.combo >= 5) { this.shakeT = isTierBreak ? 7 : 5; this.shakeI = (isTierBreak ? 3.5 : 2.5)*S }
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
      elimDisplayColor = '#d4607a'  // 粉色与心珠对应
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
      // 播放消除音效（根据消除数量层次化）
      MusicMgr.playEliminate(count)
    }
    // 法宝healOnElim效果
    if (this.weapon && this.weapon.type === 'healOnElim' && this.weapon.attr === attr) {
      this._pendingHeal += this.heroMaxHp * this.weapon.pct / 100
    }
    // 宠物buff healOnElim效果
    this.heroBuffs.forEach(b => {
      if (b.type === 'healOnElim' && b.attr === attr) {
        this._pendingHeal += this.heroMaxHp * b.pct / 100
      }
    })
    // 法宝shieldOnElim效果
    if (this.weapon && this.weapon.type === 'shieldOnElim' && this.weapon.attr === attr) {
      this._addShield(this.weapon.val || 15)
    }
    // 宠物buff shieldOnElim效果
    this.heroBuffs.forEach(b => {
      if (b.type === 'shieldOnElim' && b.attr === attr) {
        this._addShield(b.val || 30)
      }
    })
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
    // 提前判定暴击（结果缓存供 _applyFinalDamage 使用）
    const { critRate, critDmg } = this._calcCrit()
    const isCrit = critRate > 0 && (critRate >= 100 || Math.random() * 100 < critRate)
    const critMul = isCrit ? (1 + critDmg / 100) : 1
    this._pendingCrit = isCrit
    this._pendingCritMul = critMul
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
      dmg *= critMul
      dmg = Math.round(dmg)
      if (dmg <= 0) continue
      hasAny = true
      const slotIdx = i + 1  // 宠物在1~5格
      const ix = sidePad + iconSize + wpnGap + (slotIdx - 1) * (iconSize + petGap)
      const cx = ix + iconSize * 0.5
      const ac = ATTR_COLOR[pet.attr]
      const critColor = '#ffdd00'
      this.petAtkNums.push({
        x: cx, y: iconY - 4*S,
        finalVal: dmg, displayVal: 0,
        text: '0',
        color: isCrit ? critColor : (ac ? ac.main : '#ffd700'),
        t: 0, alpha: 1, scale: isCrit ? 1.3 : 1.0,
        rollFrames: 30,
        petIdx: i,
        isCrit: isCrit
      })
    }
    // 心珠回复显示在血条最右侧（提前应用血量，动画与飘字同步）
    const pendingHeal = this._pendingHeal || 0
    if (pendingHeal > 0) {
      const heal = Math.round(pendingHeal * comboMul)
      if (heal > 0) {
        hasAny = true
        const padX = 12*S
        this.petAtkNums.push({
          x: W - padX, y: L.hpBarY + 9*S,
          finalVal: heal, displayVal: 0,
          text: '0',
          color: '#4dcc4d',
          t: 0, alpha: 1, scale: 1.0,
          rollFrames: 30,
          isHeal: true
        })
        // 提前应用回血 + 启动血条动画（与飘字同步）
        const oldHp = this.heroHp
        const oldPct = oldHp / this.heroMaxHp
        this.heroHp = Math.min(this.heroMaxHp, oldHp + heal)
        if (this.heroHp > oldHp) {
          this._heroHpGain = { fromPct: oldPct, timer: 0 }
          this._playHealEffect()
        }
        this._pendingHealApplied = true  // 标记已提前结算
      }
    }
    if (hasAny) {
      this.bState = 'petAtkShow'
      if (isCrit) {
        MusicMgr.playAttackCrit()  // 暴击版攻击音效
      } else {
        MusicMgr.playAttack()
      }
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

  // 计算当前暴击率和暴击倍率
  _calcCrit() {
    let critRate = 0    // 暴击率 %
    let critDmg = 50    // 暴击额外伤害 %（基础1.5倍 = 50%额外）
    // 宠物buff: critBoost（暴击率提升）
    this.heroBuffs.forEach(b => {
      if (b.type === 'critBoost') critRate += b.pct
    })
    // 宠物buff: critDmgUp（暴击伤害提升）
    this.heroBuffs.forEach(b => {
      if (b.type === 'critDmgUp') critDmg += b.pct
    })
    // 法宝: critAll（暴击率+暴击伤害）
    if (this.weapon && this.weapon.type === 'critAll') {
      critRate += this.weapon.critRate || 0
      critDmg += this.weapon.critDmg || 0
    }
    // 法宝: comboToCrit（每段Combo暴击率+X%）
    if (this.weapon && this.weapon.type === 'comboToCrit') {
      critRate += (this.weapon.pct || 5) * this.combo
    }
    // 法宝: guaranteeCrit（满足条件时必定暴击）
    if (this.weapon && this.weapon.type === 'guaranteeCrit') {
      const wAttr = this.weapon.attr
      const minC = this.weapon.minCount || 5
      // 检查本回合是否消除了足够数量的指定属性珠
      const dmgMap = this._pendingDmgMap || {}
      if (wAttr && dmgMap[wAttr] > 0) critRate = 100
    }
    critRate = Math.min(critRate, 100)
    return { critRate, critDmg }
  }

  _applyFinalDamage(dmgMap, heal) {
    const comboMul = 1 + (this.combo - 1) * 0.25
    // runBuffs: Combo伤害加成
    const comboBonusMul = 1 + this.runBuffs.comboDmgPct / 100
    // 使用 _enterPetAtkShow 中预判定的暴击结果（如有），否则现场判定
    let isCrit, critMul
    if (this._pendingCrit != null) {
      isCrit = this._pendingCrit
      critMul = this._pendingCritMul || 1
      this._pendingCrit = null; this._pendingCritMul = null
    } else {
      const cc = this._calcCrit()
      isCrit = cc.critRate > 0 && (cc.critRate >= 100 || Math.random() * 100 < cc.critRate)
      critMul = isCrit ? (1 + cc.critDmg / 100) : 1
    }
    this._lastCrit = isCrit  // 记录用于UI展示
    let totalDmg = 0
    // 属性伤害结算
    for (const [attr, baseDmg] of Object.entries(dmgMap)) {
      let dmg = baseDmg * comboMul * comboBonusMul
      // 全属性增伤
      dmg *= 1 + this.runBuffs.allDmgPct / 100
      // 属性专属增伤
      dmg *= 1 + (this.runBuffs.attrDmgPct[attr] || 0) / 100
      // 法宝属性增伤
      if (this.weapon && this.weapon.type === 'attrDmgUp' && this.weapon.attr === attr) dmg *= 1 + this.weapon.pct / 100
      // 法宝全队攻击增伤
      if (this.weapon && this.weapon.type === 'allAtkUp') dmg *= 1 + this.weapon.pct / 100
      // 法宝Combo增伤
      if (this.weapon && this.weapon.type === 'comboDmgUp') dmg *= 1 + this.weapon.pct / 100 * (this.combo > 1 ? 1 : 0)
      // 法宝残血增伤
      if (this.weapon && this.weapon.type === 'lowHpDmgUp' && this.heroHp / this.heroMaxHp <= (this.weapon.threshold || 30) / 100) dmg *= 1 + this.weapon.pct / 100
      // 法宝stunBonusDmg
      if (this.weapon && this.weapon.type === 'stunBonusDmg' && this.enemyBuffs.some(b => b.type === 'stun')) dmg *= 1 + this.weapon.pct / 100
      // 法宝增效
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
      // 法宝ignoreDefPct
      if (this.weapon && this.weapon.type === 'ignoreDefPct' && this.weapon.attr === attr && this.enemy) {
        dmg += (this.enemy.def || 0) * this.weapon.pct / 100
      }
      // 暴击倍率
      dmg *= critMul
      dmg = Math.round(dmg)
      if (dmg > 0) {
        totalDmg += dmg
        const ac = ATTR_COLOR[attr]
        const critColor = '#ffdd00' // 暴击用金色
        this.dmgFloats.push({ x:W*0.3+Math.random()*W*0.4, y:this._getEnemyCenterY()-20*S, text:`-${dmg}`, color: isCrit ? critColor : (ac?ac.main:TH.danger), t:0, alpha:1, scale: isCrit ? 1.4 : 1.0 })
      }
    }
    if (this.nextDmgDouble) this.nextDmgDouble = false
    // 造成伤害
    if (totalDmg > 0 && this.enemy) {
      const oldPct = this.enemy.hp / this.enemy.maxHp
      this.enemy.hp = Math.max(0, this.enemy.hp - totalDmg)
      this._enemyHpLoss = { fromPct: oldPct, timer: 0 }
      this._playHeroAttack('', Object.keys(dmgMap)[0] || 'metal')
      this.shakeT = isCrit ? 12 : 8; this.shakeI = isCrit ? 6 : 4
      // 暴击特效飘字 + 暴击专属音效
      if (isCrit) {
        this.skillEffects.push({ x:W*0.5, y:this._getEnemyCenterY()-40*S, text:'暴击！', color:'#ffdd00', t:0, alpha:1 })
        MusicMgr.playCritHit()  // 暴击命中音效
      }
      // 法宝poisonChance
      if (this.weapon && this.weapon.type === 'poisonChance' && Math.random()*100 < this.weapon.chance) {
        this.enemyBuffs.push({ type:'dot', name:'中毒', dmg:this.weapon.dmg, dur:this.weapon.dur, bad:true })
      }
    }
    // 回复结算（如果在petAtkShow阶段已提前结算则跳过）
    if (heal > 0 && !this._pendingHealApplied) {
      heal *= comboMul
      heal = Math.round(heal)
      const oldHp = this.heroHp
      const oldPct = oldHp / this.heroMaxHp
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + heal)
      if (this.heroHp > oldHp) {
        this._heroHpGain = { fromPct: oldPct, timer: 0 }
        this._playHealEffect()
      }
    }
    this._pendingHealApplied = false
    // 法宝regenPct (每回合回血)
    if (this.weapon && this.weapon.type === 'regenPct') {
      const regen = Math.round(this.heroMaxHp * this.weapon.pct / 100)
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + regen)
    }
    // runBuffs: 每回合自动回血
    if (this.runBuffs.regenPerTurn > 0) {
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + this.runBuffs.regenPerTurn)
    }
    // 宠物buff regen（持续回血，如"回春"）
    this.heroBuffs.forEach(b => {
      if (b.type === 'regen' && b.heal > 0) {
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + b.heal)
        this.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:H*0.65, text:`+${b.heal}`, color:'#88ff88', t:0, alpha:1 })
      }
    })
    // 法宝comboHeal
    if (this.weapon && this.weapon.type === 'comboHeal' && this.combo > 0) {
      const ch = Math.round(this.heroMaxHp * this.weapon.pct / 100 * this.combo)
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + ch)
    }
    // 检查胜利
    if (this.enemy && this.enemy.hp <= 0) {
      this.lastTurnCount = this.turnCount
      this.lastSpeedKill = this.turnCount <= 5
      this.bState = 'victory'
      MusicMgr.playVictory()
      // 法宝onKillHeal
      if (this.weapon && this.weapon.type === 'onKillHeal') {
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp * this.weapon.pct / 100))
      }
      // runBuffs: 战后额外回血
      if (this.runBuffs.postBattleHealPct > 0) {
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + Math.round(this.heroMaxHp * this.runBuffs.postBattleHealPct / 100))
      }
      // 清除下一场临时减伤buff
      this.runBuffs.nextDmgReducePct = 0
      // 从日志中移除已失效的临时buff
      if (this.runBuffLog) this.runBuffLog = this.runBuffLog.filter(e => e.buff !== 'nextDmgReduce')
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
    // 法宝blockChance
    if (this.weapon && this.weapon.type === 'blockChance' && Math.random()*100 < this.weapon.chance) {
      atkDmg = 0
      this.skillEffects.push({ x:W*0.5, y:H*0.6, text:'格挡！', color:TH.info, t:0, alpha:1 })
      MusicMgr.playBlock()
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
    // 法宝counterStun
    if (this.weapon && this.weapon.type === 'counterStun' && Math.random()*100 < this.weapon.chance) {
      this.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
    }
    // 扣血（护盾优先）
    if (atkDmg > 0) {
      const dmgRatio = atkDmg / this.heroMaxHp  // 伤害占比，用于音效强度
      this._dealDmgToHero(atkDmg)
      this._playEnemyAttack()
      MusicMgr.playEnemyAttack(dmgRatio)  // 根据伤害占比调整音量
      setTimeout(() => MusicMgr.playHeroHurt(dmgRatio), 100)  // 延迟100ms播放受击音（时序更清晰）
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
      MusicMgr.playEnemySkill()
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
    if (this.enemy.hp <= 0) { this.lastTurnCount = this.turnCount; this.lastSpeedKill = this.turnCount <= 5; MusicMgr.playVictory(); this.bState = 'victory'; return }
    // 检查己方死亡
    if (this.heroHp <= 0) { this._onDefeat(); return }
    this.turnCount++
    this._enemyTurnWait = true; this.bState = 'enemyTurn'; this._stateTimer = 0
  }

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
    MusicMgr.playSkill()
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
      case 'shield': {
        let shieldVal = sk.val || 50
        if (sk.bonusPct) shieldVal = Math.round(shieldVal * (1 + sk.bonusPct / 100))
        this._addShield(shieldVal); break
      }
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
          if (this.enemy.hp <= 0) { this.lastTurnCount = this.turnCount; this.lastSpeedKill = this.turnCount <= 5; MusicMgr.playVictory(); this.bState = 'victory'; return }
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
    // 记录到日志（用于战斗界面左侧图标显示）
    const isInstant = (b.buff === 'healNow' || b.buff === 'spawnHeart' || b.buff === 'nextComboNeverBreak')
    if (!isInstant) {
      this.runBuffLog = this.runBuffLog || []
      this.runBuffLog.push({ id: b.id || b.buff, label: b.label || b.buff, buff: b.buff, val: b.val, floor: this.floor })
    }
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
      // 速通独特效果
      case 'nextFirstTurnDouble': this.nextDmgDouble = true; break
      case 'nextStunEnemy':       this.nextStunEnemy = true; break
      case 'grantShield':        this._addShield(b.val); break
      case 'resetAllCd':
        this.pets.forEach(p => { if (p) p.currentCd = 0 })
        this.petBag.forEach(p => { if (p) p.currentCd = 0 })
        break
      case 'skipNextBattle':      this.skipNextBattle = true; break
      case 'immuneOnce':          this.immuneOnce = true; break
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
      case 'shield':         this._addShield(adv.val || 50); break
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
