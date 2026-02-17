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

  // ===== 场景渲染 =====
  _rLoading() {
    R.drawLoadingBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${28*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('五行通天塔', W*0.5, H*0.4)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    const p = this._cloudLoadProgress
    if (p.total > 0) {
      const done = p.loaded + p.failed
      const pct = Math.floor(done / p.total * 100)
      ctx.fillText(`加载资源中... ${pct}%`, W*0.5, H*0.5)
      // 进度条
      const barW = W * 0.5, barH = 6 * S, barX = W * 0.25, barY = H * 0.54
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(barX, barY, barW, barH)
      ctx.fillStyle = TH.accent
      ctx.fillRect(barX, barY, barW * (done / p.total), barH)
    } else {
      ctx.fillText('正在连接...', W*0.5, H*0.5)
    }
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
      // 统计 + 排行榜并排
      const rowY = H*0.72, btnH2 = 40*S, gap = 8*S
      const halfW = (W*0.7 - gap) / 2, startX = W*0.15
      R.drawBtn(startX, rowY, halfW, btnH2, '历史统计', TH.info, 14)
      this._statBtnRect = [startX, rowY, halfW, btnH2]
      R.drawBtn(startX + halfW + gap, rowY, halfW, btnH2, '🏆 排行榜', '#e6a817', 14)
      this._rankBtnRect = [startX + halfW + gap, rowY, halfW, btnH2]
    } else {
      this._titleContinueRect = null
      // 开始按钮
      const bx = W*0.25, by = H*0.55, bw = W*0.5, bh = 50*S
      R.drawBtn(bx, by, bw, bh, '开始挑战', TH.accent, 18)
      this._titleBtnRect = [bx, by, bw, bh]
      // 统计 + 排行榜并排
      const rowY = H*0.67, btnH2 = 40*S, gap = 8*S
      const halfW = (W*0.7 - gap) / 2, startX = W*0.15
      R.drawBtn(startX, rowY, halfW, btnH2, '历史统计', TH.info, 14)
      this._statBtnRect = [startX, rowY, halfW, btnH2]
      R.drawBtn(startX + halfW + gap, rowY, halfW, btnH2, '🏆 排行榜', '#e6a817', 14)
      this._rankBtnRect = [startX + halfW + gap, rowY, halfW, btnH2]
    }

    // 开始挑战确认弹窗（覆盖在最上层）
    if (this.showNewRunConfirm) this._drawNewRunConfirm()
  }

  _rPrepare() {
    R.drawBg(this.af)
    const padX = 12*S
    // 标题：阵容编辑
    ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`── 阵容编辑 ──`, W*0.5, safeTop + 36*S)
    ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
    ctx.fillText(`第 ${this.floor} 层`, W*0.5, safeTop + 56*S)
    // Tab切换：宠物 / 法宝
    const tabY = safeTop + 72*S, tabH = 32*S, tabW = W*0.35
    const petTabX = W*0.1, wpnTabX = W*0.55
    ctx.fillStyle = this.prepareTab === 'pets' ? TH.accent : TH.card
    R.rr(petTabX, tabY, tabW, tabH, 6*S); ctx.fill()
    ctx.fillStyle = this.prepareTab === 'pets' ? '#fff' : TH.sub; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('灵兽编辑', petTabX+tabW*0.5, tabY+tabH*0.65)
    this._prepPetTabRect = [petTabX, tabY, tabW, tabH]
    ctx.fillStyle = this.prepareTab === 'weapon' ? TH.accent : TH.card
    R.rr(wpnTabX, tabY, tabW, tabH, 6*S); ctx.fill()
    ctx.fillStyle = this.prepareTab === 'weapon' ? '#fff' : TH.sub
    ctx.fillText('法宝切换', wpnTabX+tabW*0.5, tabY+tabH*0.65)
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
      const bagLabelY = slotY + slotH + 30*S
      ctx.fillText(`灵兽背包（${this.petBag.length}/8）：`, padX, bagLabelY)
      const bagY = bagLabelY + 16*S
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
      // 法宝切换Tab
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText('当前法宝：', padX, contentY + 12*S)
      const curWpnY = contentY + 20*S
      if (this.weapon) {
        ctx.fillStyle = 'rgba(30,25,18,0.85)'
        R.rr(padX, curWpnY, W-padX*2, 50*S, 8*S); ctx.fill()
        ctx.strokeStyle = TH.accent; ctx.lineWidth = 2*S; ctx.stroke()
        // 法宝图标
        const curWpnImg = R.getImg(`assets/equipment/fabao_${this.weapon.id}.png`)
        const cwImgSz = 40*S
        if (curWpnImg && curWpnImg.width > 0) {
          ctx.save(); R.rr(padX + 5*S, curWpnY + 5*S, cwImgSz, cwImgSz, 6*S); ctx.clip()
          ctx.drawImage(curWpnImg, padX + 5*S, curWpnY + 5*S, cwImgSz, cwImgSz)
          ctx.restore()
        }
        const cwTextX = curWpnImg && curWpnImg.width > 0 ? padX + 5*S + cwImgSz + 8*S : padX + 10*S
        ctx.fillStyle = TH.accent; ctx.font = `bold ${14*S}px sans-serif`; ctx.textAlign = 'left'
        ctx.fillText(this.weapon.name, cwTextX, curWpnY+22*S)
        ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
        ctx.fillText(this.weapon.desc, cwTextX, curWpnY+40*S)
        this._prepCurWpnRect = [padX, curWpnY, W-padX*2, 50*S]
      } else {
        ctx.fillStyle = TH.card; R.rr(padX, curWpnY, W-padX*2, 50*S, 8*S); ctx.fill()
        ctx.fillStyle = TH.dim; ctx.font = `${13*S}px sans-serif`; ctx.textAlign = 'center'
        ctx.fillText('无法宝', W*0.5, curWpnY+30*S)
        this._prepCurWpnRect = null
      }
      // 法宝背包
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
      const wBagLabelY = curWpnY + 60*S
      ctx.fillText(`法宝背包（${this.weaponBag.length}/4）：`, padX, wBagLabelY)
      const wBagY = wBagLabelY + 8*S
      const wCardH = 50*S, wGap = 6*S
      this._prepWpnBagRects = []
      for (let i = 0; i < this.weaponBag.length; i++) {
        const wy = wBagY + i*(wCardH+wGap)
        const wp = this.weaponBag[i]
        ctx.fillStyle = 'rgba(30,25,18,0.85)'
        R.rr(padX, wy, W-padX*2, wCardH, 8*S); ctx.fill()
        // 法宝图标
        const bagWpnImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
        const bwImgSz = 40*S
        if (bagWpnImg && bagWpnImg.width > 0) {
          ctx.save(); R.rr(padX + 5*S, wy + 5*S, bwImgSz, bwImgSz, 6*S); ctx.clip()
          ctx.drawImage(bagWpnImg, padX + 5*S, wy + 5*S, bwImgSz, bwImgSz)
          ctx.restore()
        }
        const bwTextX = bagWpnImg && bagWpnImg.width > 0 ? padX + 5*S + bwImgSz + 8*S : padX + 10*S
        ctx.fillStyle = TH.accent; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'left'
        ctx.fillText(wp.name, bwTextX, wy+20*S)
        ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
        ctx.fillText(wp.desc, bwTextX, wy+38*S)
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
    R.drawHp(padX, prepHpBarY, W - padX*2, prepHpBarH, this.heroHp, this.heroMaxHp, '#d4607a', null, true, '#4dcc4d', this.heroShield)
    // 底部：出发按钮
    const goBtnX = W*0.2, goBtnY = H - 60*S, goBtnW = W*0.6, goBtnH = 46*S
    R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '查看事件', TH.accent, 18)
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
      lines.push({ text: d.name, color: TH.accent, bold: true, size: 15 })
      lines.push({ text: '被动效果', color: TH.sub, size: 11 })
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

    // ===== 战斗层：显示我的阵容区域 =====
    this._eventPetRects = []
    this._eventEditPetRect = null
    this._eventEditWpnRect = null
    if (isBattle) {
    ctx.textAlign = 'center'
    ctx.fillStyle = TH.dim; ctx.font = `bold ${12*S}px sans-serif`
    ctx.fillText('── 我的阵容 ──', W*0.5, curY + 4*S)
    curY += 16*S

    // 血条
    const hpBarH = 16*S
    R.drawHp(padX, curY, W - padX*2, hpBarH, this.heroHp, this.heroMaxHp, '#d4607a', null, true, '#4dcc4d', this.heroShield)
    curY += hpBarH + 12*S

    // 法宝行
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText('法宝：', padX, curY)
    curY += 6*S
    const wpnH = 36*S
    const wpnCardX = padX, wpnCardW = W - padX*2
    ctx.fillStyle = 'rgba(15,15,30,0.6)'
    R.rr(wpnCardX, curY, wpnCardW, wpnH, 6*S); ctx.fill()
    if (this.weapon) {
      // 小图标
      const wIconSz = 28*S
      const wIconX = wpnCardX + 8*S
      const wIconY = curY + (wpnH - wIconSz)/2
      ctx.fillStyle = '#1a1510'
      R.rr(wIconX, wIconY, wIconSz, wIconSz, 4*S); ctx.fill()
      // 法宝图片（优先），回退到emoji
      const wImg = R.getImg(`assets/equipment/fabao_${this.weapon.id}.png`)
      if (wImg && wImg.width > 0) {
        ctx.save(); R.rr(wIconX, wIconY, wIconSz, wIconSz, 4*S); ctx.clip()
        ctx.drawImage(wImg, wIconX, wIconY, wIconSz, wIconSz)
        ctx.restore()
      } else {
        ctx.fillStyle = TH.accent; ctx.font = `bold ${16*S}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', wIconX + wIconSz/2, wIconY + wIconSz/2)
        ctx.textBaseline = 'alphabetic'
      }
      // 法宝金色边框（代码绘制）
      ctx.save()
      const fPad = 1*S
      const fX = wIconX - fPad, fY = wIconY - fPad, fSz = wIconSz + fPad*2, fRd = 5*S
      const wGrd = ctx.createLinearGradient(fX, fY, fX + fSz, fY + fSz)
      wGrd.addColorStop(0, '#ffd700'); wGrd.addColorStop(0.5, '#ffec80'); wGrd.addColorStop(1, '#c8a200')
      ctx.strokeStyle = wGrd; ctx.lineWidth = 2*S
      R.rr(fX, fY, fSz, fSz, fRd); ctx.stroke()
      ctx.restore()
      // 法宝名+描述
      ctx.textAlign = 'left'
      ctx.fillStyle = TH.accent; ctx.font = `bold ${12*S}px sans-serif`
      ctx.fillText(this.weapon.name, wIconX + wIconSz + 10*S, curY + wpnH*0.38)
      ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
      ctx.fillText(this.weapon.desc, wIconX + wIconSz + 10*S, curY + wpnH*0.72)
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`
      ctx.fillText('无法宝', W*0.5, curY + wpnH*0.58)
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
    R.drawBtn(btn2X, btnY, btnW, btnH, '法宝切换', TH.info, 12)
    this._eventEditPetRect = [btn1X, btnY, btnW, btnH]
    this._eventEditWpnRect = [btn2X, btnY, btnW, btnH]
    curY += btnH + 16*S
    } // end isBattle

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
    const wpnGap = 12*S          // 法宝与第一个宠物间距
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
      ctx.strokeText(this.enemy.name, W*0.5, eAreaBottom - 58*S)
      ctx.fillText(this.enemy.name, W*0.5, eAreaBottom - 58*S)
      // 弱点属性提示（怪物名下方）
      const weakAttr = COUNTER_BY[this.enemy.attr]
      if (weakAttr) {
        const wc = ATTR_COLOR[weakAttr]
        ctx.fillStyle = wc ? wc.main : TH.accent; ctx.font = `bold ${11*S}px sans-serif`
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2*S
        ctx.strokeText(`弱点：${ATTR_NAME[weakAttr]}`, W*0.5, eAreaBottom - 44*S)
        ctx.fillText(`弱点：${ATTR_NAME[weakAttr]}`, W*0.5, eAreaBottom - 44*S)
      }
      // 怪物HP（显示数值）
      R.drawHp(padX+40*S, eAreaBottom - 36*S, W-padX*2-80*S, 16*S, this.enemy.hp, this.enemy.maxHp, ac ? ac.main : TH.danger, this._enemyHpLoss, true)
      // 怪物buffs（HP条上方）
      this._drawBuffIconsLabeled(this.enemyBuffs, padX+8*S, eAreaBottom - 60*S, '敌方', true)
      // 记录敌人区域用于点击查看详情
      this._enemyAreaRect = [0, eAreaTop, W, eAreaBottom - eAreaTop]
    }

    // ===== 己方buffs（队伍栏上方，与敌方分开）=====
    this._drawBuffIconsLabeled(this.heroBuffs, W*0.3, teamBarY - 16*S, '己方', false)

    // ===== 左侧全局增益图标列 =====
    this._drawRunBuffIcons(eAreaTop + 42*S, eAreaBottom - 54*S)

    // ===== 左上角退出按钮（在怪物区背景之后绘制，避免被覆盖）=====
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✕', exitBtnX + exitBtnSize*0.5, exitBtnY + exitBtnSize*0.5)
    ctx.textBaseline = 'alphabetic'
    this._exitBtnRect = [exitBtnX, exitBtnY, exitBtnSize, exitBtnSize]

    // ===== 宠物+法宝栏（一排，血条上方）=====
    this._drawTeamBar(teamBarY, teamBarH, iconSize)

    // ===== 英雄血条（队伍栏下方，棋盘上方，显示数值）=====
    R.drawHp(padX, hpBarY, W - padX*2, hpBarH, this.heroHp, this.heroMaxHp, '#d4607a', this._heroHpLoss, true, '#4dcc4d', this.heroShield, this._heroHpGain)

    // ===== 棋盘（带格子背景）=====
    this._drawBoard()

    // ===== 消除棋子处数值飘字 =====
    this.elimFloats.forEach(f => R.drawElimFloat(f))

    // ===== Combo显示（2连击起展示，两行紧凑布局）=====
    if (this.combo >= 2 && (this.bState === 'elimAnim' || this.bState === 'dropping' || this.bState === 'preAttack' || this.bState === 'petAtkShow')) {
      const ca = this._comboAnim || { num: this.combo, scale: 1, alpha: 1, offsetY: 0, dmgScale: 1, dmgAlpha: 1, pctScale: 1, pctAlpha: 1, pctOffX: 0 }
      const comboScale = ca.scale || 1
      // 如果动画已播完但仍在消除/下落/攻击阶段，保持可见（防止连击中途消失）
      const stillActive = this.bState === 'elimAnim' || this.bState === 'dropping' || this.bState === 'preAttack' || this.bState === 'petAtkShow'
      const comboAlpha = (ca.timer >= 60 && stillActive) ? 1 : (ca.alpha != null ? ca.alpha : 1)
      const comboOffY = (ca.timer >= 60 && stillActive) ? 0 : (ca.offsetY || 0)
      const dmgScale = (ca.timer >= 60 && stillActive) ? 1 : (ca.dmgScale || 0)
      const dmgAlpha = (ca.timer >= 60 && stillActive) ? 1 : (ca.dmgAlpha || 0)
      const pctScale = (ca.timer >= 60 && stillActive) ? 1 : (ca.pctScale || 0)
      const pctAlpha = (ca.timer >= 60 && stillActive) ? 1 : (ca.pctAlpha || 0)
      const pctOffX = (ca.timer >= 60 && stillActive) ? 0 : (ca.pctOffX || 0)
      // 居中显示
      const comboCx = W * 0.5
      const comboCy = this.boardY + (ROWS * this.cellSize) * 0.32 + comboOffY
      // Combo分级
      const isHigh = this.combo >= 5
      const isSuper = this.combo >= 8
      const isMega = this.combo >= 12
      // 全暖色系：金→橙→红→烈焰红
      const mainColor = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : isHigh ? '#ff8c00' : '#ffd700'
      const glowColor = isMega ? '#ff4060' : isSuper ? '#ff6080' : isHigh ? '#ffaa33' : '#ffe066'
      // 超大字号
      const baseSz = isMega ? 84*S : isSuper ? 72*S : isHigh ? 62*S : 54*S

      // 预算伤害数据
      const comboMulVal = 1 + (this.combo - 1) * 0.25
      const comboBonusPct = this.runBuffs.comboDmgPct || 0
      const totalMul = comboMulVal * (1 + comboBonusPct / 100)
      const extraPct = Math.round((totalMul - 1) * 100)
      let estTotalDmg = 0
      const pdm = this._pendingDmgMap || {}
      for (const attr in pdm) {
        let d = pdm[attr] * totalMul
        d *= 1 + (this.runBuffs.allDmgPct || 0) / 100
        d *= 1 + ((this.runBuffs.attrDmgPct && this.runBuffs.attrDmgPct[attr]) || 0) / 100
        if (this.weapon && this.weapon.type === 'attrDmgUp' && this.weapon.attr === attr) d *= 1 + this.weapon.pct / 100
        if (this.weapon && this.weapon.type === 'allAtkUp') d *= 1 + this.weapon.pct / 100
        if (this.enemy) {
          if (COUNTER_MAP[attr] === this.enemy.attr) d *= COUNTER_MUL
          else if (COUNTER_BY[attr] === this.enemy.attr) d *= COUNTERED_MUL
        }
        estTotalDmg += d
      }
      estTotalDmg = Math.round(estTotalDmg)

      ctx.save()
      ctx.globalAlpha = comboAlpha

      // 半透明背景遮罩
      const maskH = baseSz * 3.2
      const maskCy = comboCy + baseSz * 0.35
      const maskGrd = ctx.createLinearGradient(0, maskCy - maskH*0.5, 0, maskCy + maskH*0.5)
      maskGrd.addColorStop(0, 'transparent')
      maskGrd.addColorStop(0.15, 'rgba(0,0,0,0.4)')
      maskGrd.addColorStop(0.5, 'rgba(0,0,0,0.55)')
      maskGrd.addColorStop(0.85, 'rgba(0,0,0,0.4)')
      maskGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = maskGrd
      ctx.fillRect(0, maskCy - maskH*0.5, W, maskH)

      // 背景光晕爆炸
      if (this.combo >= 3) {
        const burstR = baseSz * (isSuper ? 2.2 : 1.5) * (ca.timer < 10 ? (2.0 - ca.timer / 10) : 1.0)
        const burstGrd = ctx.createRadialGradient(comboCx, comboCy, 0, comboCx, comboCy, burstR)
        burstGrd.addColorStop(0, glowColor + (isSuper ? '66' : '44'))
        burstGrd.addColorStop(0.5, glowColor + '18')
        burstGrd.addColorStop(1, 'transparent')
        ctx.fillStyle = burstGrd
        ctx.fillRect(comboCx - burstR, comboCy - burstR, burstR*2, burstR*2)
      }

      // 放射线条（超高连击）
      if (isSuper && ca.timer < 20) {
        ctx.save()
        ctx.translate(comboCx, comboCy)
        const rayCount = isMega ? 18 : 12
        const rayLen = baseSz * 2.0 * Math.min(1, ca.timer / 8)
        const rayAlpha = Math.max(0, 1 - ca.timer / 20) * 0.7
        ctx.globalAlpha = comboAlpha * rayAlpha
        for (let r = 0; r < rayCount; r++) {
          const angle = (r / rayCount) * Math.PI * 2 + ca.timer * 0.08
          ctx.beginPath()
          ctx.moveTo(Math.cos(angle) * baseSz * 0.25, Math.sin(angle) * baseSz * 0.25)
          ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen)
          ctx.strokeStyle = glowColor
          ctx.lineWidth = (isMega ? 4 : 2.5) * S
          ctx.stroke()
        }
        ctx.restore()
      }

      // 层级突破扩散环（5/8/12连击首次出现时）
      if ((this.combo === 5 || this.combo === 8 || this.combo === 12) && ca.timer < 18) {
        ctx.save()
        const ringP = ca.timer / 18
        const ringR = baseSz * (0.5 + ringP * 3.5)
        const ringAlpha = (1 - ringP) * 0.8
        ctx.globalAlpha = comboAlpha * ringAlpha
        ctx.beginPath()
        ctx.arc(comboCx, comboCy, ringR, 0, Math.PI * 2)
        ctx.strokeStyle = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : '#ffd700'
        ctx.lineWidth = (6 - ringP * 4) * S
        ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 15 * S
        ctx.stroke()
        // 第二圈略延迟
        if (ca.timer > 3) {
          const ringP2 = (ca.timer - 3) / 18
          const ringR2 = baseSz * (0.3 + ringP2 * 3)
          ctx.globalAlpha = comboAlpha * (1 - ringP2) * 0.5
          ctx.beginPath()
          ctx.arc(comboCx, comboCy, ringR2, 0, Math.PI * 2)
          ctx.lineWidth = (4 - ringP2 * 3) * S
          ctx.stroke()
        }
        ctx.shadowBlur = 0
        ctx.restore()
      }

      // ===== 第一行："N 连击"（超大斜体）=====
      ctx.save()
      ctx.translate(comboCx, comboCy)
      ctx.scale(comboScale, comboScale)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

      const comboFont = `italic 900 ${baseSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
      const comboText = `${this.combo} 连击`
      ctx.font = comboFont
      // 黑色外描边
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 8*S
      ctx.strokeText(comboText, 0, 0)
      // 主色填充
      ctx.fillStyle = mainColor
      ctx.fillText(comboText, 0, 0)
      // 斜切高光
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(-baseSz*2, -baseSz*0.5)
      ctx.lineTo(baseSz*1.5, -baseSz*0.5)
      ctx.lineTo(baseSz*1.2, baseSz*0.05)
      ctx.lineTo(-baseSz*2.3, baseSz*0.05)
      ctx.clip()
      ctx.fillStyle = glowColor
      ctx.globalAlpha = 0.55
      ctx.fillText(comboText, 0, 0)
      ctx.restore()
      // 发光
      if (isHigh) {
        ctx.font = comboFont
        ctx.shadowColor = mainColor
        ctx.shadowBlur = (isMega ? 30 : isSuper ? 20 : 12) * S
        ctx.fillStyle = mainColor
        ctx.globalAlpha = 0.3
        ctx.fillText(comboText, 0, 0)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
      // 超高连击火焰摇曳描边（8连击+）
      if (isSuper) {
        ctx.save()
        const flameTime = ca.timer * 0.15
        const flameW = isMega ? 5 : 3.5
        for (let fl = 0; fl < (isMega ? 3 : 2); fl++) {
          const flOff = fl * 0.7
          ctx.font = comboFont
          ctx.strokeStyle = isMega
            ? `rgba(255,${80 + Math.sin(flameTime + flOff) * 40},${20 + Math.sin(flameTime * 1.3 + flOff) * 20},${0.25 - fl * 0.08})`
            : `rgba(255,${120 + Math.sin(flameTime + flOff) * 40},${60 + Math.sin(flameTime * 1.3 + flOff) * 30},${0.2 - fl * 0.06})`
          ctx.lineWidth = (flameW + fl * 3) * S
          ctx.strokeText(comboText, Math.sin(flameTime * 2 + fl) * 1.5*S, Math.cos(flameTime * 1.5 + fl) * 1.5*S - fl * 1.5*S)
        }
        ctx.restore()
      }
      ctx.restore()

      // ===== 第二行："额外伤害 N"（统一红色，延迟弹入）=====
      if (dmgAlpha > 0) {
        ctx.save()
        ctx.globalAlpha = comboAlpha * dmgAlpha
        const dmgCy = comboCy + baseSz * 0.72
        ctx.translate(comboCx, dmgCy)
        ctx.scale(dmgScale, dmgScale)
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

        const dmgSz = baseSz * 0.7
        const dmgFont = `italic 900 ${dmgSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
        const dmgText = estTotalDmg > 0 ? `额外伤害 ${estTotalDmg}` : `额外伤害 ${extraPct}%`
        ctx.font = dmgFont

        // 红色渐变（统一红色，倍率越高越猛）
        const dmgGrd = ctx.createLinearGradient(0, -dmgSz*0.45, 0, dmgSz*0.4)
        if (extraPct >= 300) {
          dmgGrd.addColorStop(0, '#ff6666'); dmgGrd.addColorStop(0.4, '#ff1030'); dmgGrd.addColorStop(1, '#990018')
        } else if (extraPct >= 200) {
          dmgGrd.addColorStop(0, '#ff8080'); dmgGrd.addColorStop(0.4, '#ff2040'); dmgGrd.addColorStop(1, '#aa0020')
        } else if (extraPct >= 100) {
          dmgGrd.addColorStop(0, '#ff9999'); dmgGrd.addColorStop(0.4, '#ff3350'); dmgGrd.addColorStop(1, '#bb1530')
        } else {
          dmgGrd.addColorStop(0, '#ffaaaa'); dmgGrd.addColorStop(0.4, '#ff4d60'); dmgGrd.addColorStop(1, '#cc2040')
        }

        // 黑色粗描边
        ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 7*S
        ctx.strokeText(dmgText, 0, 0)
        // 红色渐变填充
        ctx.fillStyle = dmgGrd
        ctx.fillText(dmgText, 0, 0)
        // 斜切高光
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(-dmgSz*3, -dmgSz*0.45)
        ctx.lineTo(dmgSz*3, -dmgSz*0.45)
        ctx.lineTo(dmgSz*2.7, -dmgSz*0.05)
        ctx.lineTo(-dmgSz*3.3, -dmgSz*0.05)
        ctx.clip()
        ctx.font = dmgFont
        ctx.fillStyle = '#fff'
        ctx.globalAlpha = 0.35
        ctx.fillText(dmgText, 0, 0)
        ctx.restore()
        // 红色外发光
        ctx.save()
        const glowStr = extraPct >= 200 ? 28 : extraPct >= 100 ? 20 : 12
        ctx.shadowColor = '#ff2040'
        ctx.shadowBlur = glowStr * S
        ctx.font = dmgFont
        ctx.fillStyle = '#ff2040'
        ctx.globalAlpha = 0.3
        ctx.fillText(dmgText, 0, 0)
        ctx.restore()

        // ===== 百分比标签（从右侧弹射飞入，大字红色，爽感冲击）=====
        if (pctAlpha > 0 && extraPct > 0) {
          ctx.save()
          const pctSz = baseSz * 0.72
          const pctFont = `italic 900 ${pctSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
          const pctText = `${extraPct}%`

          // 定位在伤害行下方偏右，弹射飞入
          const pctY = dmgSz * 0.6 + pctSz * 0.3
          const pctBaseX = baseSz * 0.3 + pctOffX
          ctx.translate(pctBaseX, pctY)
          ctx.scale(pctScale, pctScale)

          ctx.globalAlpha = comboAlpha * dmgAlpha * pctAlpha
          ctx.font = pctFont
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

          // 红色渐变（比主伤害更亮，冲击感）
          const pctGrd = ctx.createLinearGradient(0, -pctSz*0.4, 0, pctSz*0.35)
          if (extraPct >= 200) {
            pctGrd.addColorStop(0, '#ff8888'); pctGrd.addColorStop(0.4, '#ff2244'); pctGrd.addColorStop(1, '#bb0020')
          } else if (extraPct >= 100) {
            pctGrd.addColorStop(0, '#ffaaaa'); pctGrd.addColorStop(0.4, '#ff4466'); pctGrd.addColorStop(1, '#cc2040')
          } else {
            pctGrd.addColorStop(0, '#ffbbbb'); pctGrd.addColorStop(0.4, '#ff5577'); pctGrd.addColorStop(1, '#dd3355')
          }

          // 黑色描边
          ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 5*S
          ctx.strokeText(pctText, 0, 0)
          // 红色渐变填充
          ctx.fillStyle = pctGrd
          ctx.fillText(pctText, 0, 0)
          // 高光
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(-pctSz*1.5, -pctSz*0.4)
          ctx.lineTo(pctSz*1.5, -pctSz*0.4)
          ctx.lineTo(pctSz*1.3, -pctSz*0.05)
          ctx.lineTo(-pctSz*1.7, -pctSz*0.05)
          ctx.clip()
          ctx.font = pctFont; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4
          ctx.fillText(pctText, 0, 0)
          ctx.restore()
          // 外发光
          ctx.save()
          ctx.shadowColor = '#ff3060'; ctx.shadowBlur = (extraPct >= 200 ? 24 : 14) * S
          ctx.font = pctFont; ctx.fillStyle = '#ff3060'; ctx.globalAlpha = 0.35
          ctx.fillText(pctText, 0, 0)
          ctx.restore()

          ctx.restore()
        }

        // --- 倍率说明（小字辅助）---
        const tipSz = baseSz * 0.17
        const tipY = dmgSz * 0.5 + (pctAlpha > 0 ? baseSz * 0.52 * 0.6 + baseSz * 0.17 * 0.5 : tipSz * 1.0)
        ctx.font = `bold ${tipSz}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5*S
        const tipText = comboBonusPct > 0
          ? `x${totalMul.toFixed(2)}倍率 (含Combo加成${comboBonusPct}%)`
          : `x${totalMul.toFixed(2)}倍率`
        ctx.strokeText(tipText, 0, tipY)
        ctx.fillStyle = 'rgba(255,200,200,0.75)'
        ctx.fillText(tipText, 0, tipY)

        ctx.restore()
      }

      ctx.restore()
    }

    // ===== Combo粒子特效 =====
    if (this._comboParticles.length > 0) {
      ctx.save()
      this._comboParticles.forEach(p => {
        const lifeP = p.t / p.life
        const alpha = lifeP < 0.3 ? 1 : 1 - (lifeP - 0.3) / 0.7
        const sz = p.size * (lifeP < 0.2 ? 0.5 + lifeP / 0.2 * 0.5 : 1 - (lifeP - 0.2) * 0.4)
        ctx.globalAlpha = alpha * 0.9
        ctx.fillStyle = p.color
        if (p.type === 'star') {
          // 星形粒子
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.t * 0.15)
          ctx.beginPath()
          for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5 - Math.PI / 2
            const r = i % 2 === 0 ? sz * 1.2 : sz * 0.5
            i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r)
          }
          ctx.closePath(); ctx.fill()
          ctx.restore()
        } else {
          // 圆形粒子 + 发光拖尾
          ctx.shadowColor = p.color; ctx.shadowBlur = sz * 2
          ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill()
          ctx.shadowBlur = 0
        }
      })
      ctx.restore()
    }

    // ===== Combo白色闪光冲击 =====
    if (this._comboFlash > 0 && this.combo >= 2) {
      ctx.save()
      const flashAlpha = (this._comboFlash / 8) * (this.combo >= 12 ? 0.4 : this.combo >= 8 ? 0.3 : 0.2)
      const flashCy = this.boardY + (ROWS * this.cellSize) * 0.32
      const flashR = (this.combo >= 12 ? 180 : this.combo >= 8 ? 140 : this.combo >= 5 ? 110 : 80) * S
      const flashGrd = ctx.createRadialGradient(W*0.5, flashCy, 0, W*0.5, flashCy, flashR)
      flashGrd.addColorStop(0, `rgba(255,255,255,${flashAlpha})`)
      flashGrd.addColorStop(0.5, `rgba(255,255,240,${flashAlpha * 0.5})`)
      flashGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = flashGrd
      ctx.fillRect(W*0.5 - flashR, flashCy - flashR, flashR * 2, flashR * 2)
      ctx.restore()
    }

    // ===== 宠物头像攻击数值翻滚 =====
    this.petAtkNums.forEach(f => R.drawPetAtkNum(f))

    // 拖拽倒计时（棋盘上方醒目进度条 + 珠子进度环）
    if (this.dragging && this.bState === 'playerTurn') {
      const remain = Math.max(0, (this.dragTimeLimit - this.dragTimer) / 60)
      const pct = Math.max(0, Math.min(1, (this.dragTimeLimit - this.dragTimer) / this.dragTimeLimit))
      const barColor = pct < 0.25 ? '#ff4d6a' : pct < 0.5 ? '#ff8c00' : '#4dcc4d'
      const isUrgent = pct < 0.25
      // 低于25%时闪烁效果（每0.3秒切换）
      const urgentShow = !isUrgent || (Math.floor(this.dragTimer / 9) % 2 === 0)

      // ===== 1. 棋盘上方固定进度条 =====
      ctx.save()
      const barH = 8*S
      const barY = this.boardY - barH - 3*S
      const barX = this.boardX
      const barW = COLS * this.cellSize
      const barR = barH / 2  // 圆角半径
      // 进度条背景槽
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      R.rr(barX, barY, barW, barH, barR); ctx.fill()
      // 进度条填充（从右往左减少）
      if (pct > 0 && urgentShow) {
        const fillW = barW * pct
        ctx.fillStyle = barColor
        R.rr(barX, barY, fillW, barH, barR); ctx.fill()
        // 发光效果
        ctx.shadowColor = barColor
        ctx.shadowBlur = 6*S
        R.rr(barX, barY, fillW, barH, barR); ctx.fill()
        ctx.shadowBlur = 0
      }
      // 进度条边框
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1*S
      R.rr(barX, barY, barW, barH, barR); ctx.stroke()

      // ===== 2. 进度条上方显示秒数 =====
      const numY = barY - 2*S
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      // 大号秒数
      const fontSize = isUrgent ? 18*S : 15*S
      ctx.font = `bold ${fontSize}px sans-serif`
      const timeText = remain.toFixed(1) + 's'
      ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 3*S
      ctx.strokeText(timeText, barX + barW * 0.5, numY)
      ctx.fillStyle = urgentShow ? barColor : 'rgba(255,77,106,0.3)'
      ctx.fillText(timeText, barX + barW * 0.5, numY)
      ctx.restore()

      // ===== 3. 珠子周围进度环（辅助提示）=====
      const ringR = (this.cellSize - this.cellSize*0.08*2) * 0.5 + 6*S
      const cx = this.dragCurX, cy = this.dragCurY
      ctx.save()
      // 背景环
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth = 4*S
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, 0, Math.PI*2)
      ctx.stroke()
      // 进度环
      const startAngle = -Math.PI/2
      const endAngle = startAngle + Math.PI*2 * pct
      ctx.strokeStyle = barColor
      ctx.lineWidth = 4*S
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(cx, cy, ringR, startAngle, endAngle)
      ctx.stroke()
      ctx.restore()
    }
    // 胜利/失败覆盖
    if (this.bState === 'victory') this._drawVictoryOverlay()
    if (this.bState === 'defeat') this._drawDefeatOverlay()
    if (this.bState === 'adReviveOffer') this._drawAdReviveOverlay()
    // 敌人详情弹窗
    if (this.showEnemyDetail) this._drawEnemyDetailDialog()
    // 退出确认弹窗
    if (this.showExitDialog) this._drawExitDialog()
    // 法宝详情弹窗
    if (this.showWeaponDetail) this._drawWeaponDetailDialog()
    // 宠物详情弹窗
    if (this.showBattlePetDetail != null) this._drawBattlePetDetailDialog()
    // 技能预览弹窗（长按触发）
    if (this.skillPreview) this._drawSkillPreviewDialog()
    // 全局增益详情弹窗（最顶层）
    if (this.runBuffDetail) this._drawRunBuffDetailDialog()
  }

  _rReward() {
    R.drawBg(this.af)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
    // 根据奖励类型显示不同标题
    const evtType = this.curEvent ? this.curEvent.type : ''
    let title = '战斗胜利 - 选择奖励'
    if (evtType === 'elite') title = '精英击败 - 选择灵兽'
    else if (evtType === 'boss') title = 'BOSS击败 - 选择法宝'
    ctx.fillText(title, W*0.5, safeTop + 40*S)
    // 速通达成提示
    let headerOffset = 0
    if (this.lastSpeedKill) {
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${13*S}px sans-serif`
      ctx.fillText(`⚡ 速通达成 (${this.lastTurnCount}回合) — 额外选项已解锁！`, W*0.5, safeTop + 60*S)
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
      const isSpeedBuff = rw.isSpeed === true
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
      else if (rw.type === REWARD_TYPES.NEW_WEAPON) { typeTag = '【法宝】'; tagColor = '#ffd700' }
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
        ctx.fillText(`→ 进入法宝背包 (${this.weaponBag.length}/4)`, W*0.5, cy + cardH*0.78)
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
      ctx.fillText(`法宝：${this.weapon.name}`, W*0.5, H*0.62)
    }
    ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`灵兽背包：${this.petBag.length}只  法宝背包：${this.weaponBag.length}件`, W*0.5, H*0.68)
    const bx = W*0.25, by = H*0.75, bw = W*0.5, bh = 48*S
    R.drawBtn(bx, by, bw, bh, '重新挑战', TH.accent, 18)
    this._goBtnRect = [bx, by, bw, bh]
    // 左上角返回按钮
    this._drawBackBtn()
  }

  // ===== 排行榜场景 =====
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

  _rRanking() {
    R.drawHomeBg(this.af)
    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

    const padX = 12*S
    // 标题
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${22*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('🏆 排行榜', W*0.5, safeTop + 40*S)

    // Tab切换
    const tabY = safeTop + 56*S, tabH = 34*S, tabW = W*0.35
    const tabAllX = W*0.08, tabDailyX = W*0.57
    // 总排行 tab
    ctx.fillStyle = this.rankTab === 'all' ? '#e6a817' : 'rgba(255,255,255,0.08)'
    R.rr(tabAllX, tabY, tabW, tabH, 8*S); ctx.fill()
    ctx.fillStyle = this.rankTab === 'all' ? '#1a1a2e' : TH.sub
    ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('总排行', tabAllX + tabW*0.5, tabY + tabH*0.65)
    this._rankTabAllRect = [tabAllX, tabY, tabW, tabH]
    // 今日排行 tab
    ctx.fillStyle = this.rankTab === 'daily' ? '#e6a817' : 'rgba(255,255,255,0.08)'
    R.rr(tabDailyX, tabY, tabW, tabH, 8*S); ctx.fill()
    ctx.fillStyle = this.rankTab === 'daily' ? '#1a1a2e' : TH.sub
    ctx.fillText('今日排行', tabDailyX + tabW*0.5, tabY + tabH*0.65)
    this._rankTabDailyRect = [tabDailyX, tabY, tabW, tabH]

    // 列表区域
    const listTop = tabY + tabH + 12*S
    const listBottom = H - 70*S
    const rowH = 62*S
    const list = this.rankTab === 'all' ? this.storage.rankAllList : this.storage.rankDailyList
    const myRank = this.rankTab === 'all' ? this.storage.rankAllMyRank : this.storage.rankDailyMyRank

    // 表头
    ctx.fillStyle = 'rgba(255,255,255,0.06)'
    ctx.fillRect(padX, listTop, W - padX*2, 24*S)
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText('排名', padX + 8*S, listTop + 16*S)
    ctx.fillText('玩家', padX + 50*S, listTop + 16*S)
    ctx.textAlign = 'right'
    ctx.fillText('最高层', W - padX - 8*S, listTop + 16*S)

    // 裁剪列表区
    const contentTop = listTop + 26*S
    ctx.save()
    ctx.beginPath(); ctx.rect(0, contentTop, W, listBottom - contentTop); ctx.clip()

    if (this.storage.rankLoading && list.length === 0) {
      ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('加载中...', W*0.5, contentTop + 60*S)
    } else if (list.length === 0) {
      ctx.fillStyle = TH.dim; ctx.font = `${14*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('暂无数据', W*0.5, contentTop + 60*S)
    } else {
      for (let i = 0; i < list.length; i++) {
        const item = list[i]
        const ry = contentTop + i * rowH + this.rankScrollY
        if (ry + rowH < contentTop || ry > listBottom) continue

        // 行背景（前三名特殊）
        if (i < 3) {
          const medalColors = ['rgba(255,215,0,0.12)', 'rgba(192,192,192,0.10)', 'rgba(205,127,50,0.10)']
          ctx.fillStyle = medalColors[i]
        } else {
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)'
        }
        ctx.fillRect(padX, ry, W - padX*2, rowH - 2*S)

        // 排名
        ctx.textAlign = 'left'
        if (i < 3) {
          const medals = ['🥇', '🥈', '🥉']
          ctx.font = `${18*S}px sans-serif`
          ctx.fillText(medals[i], padX + 8*S, ry + 28*S)
        } else {
          ctx.fillStyle = TH.sub; ctx.font = `bold ${14*S}px sans-serif`
          ctx.fillText(`${i + 1}`, padX + 12*S, ry + 28*S)
        }

        // 头像
        const avatarX = padX + 44*S, avatarY = ry + 6*S, avatarSz = 32*S
        if (item.avatarUrl) {
          const avatarImg = R.getImg(item.avatarUrl)
          if (avatarImg && avatarImg.width > 0) {
            ctx.save()
            ctx.beginPath()
            ctx.arc(avatarX + avatarSz/2, avatarY + avatarSz/2, avatarSz/2, 0, Math.PI*2)
            ctx.clip()
            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSz, avatarSz)
            ctx.restore()
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.1)'
            ctx.beginPath(); ctx.arc(avatarX + avatarSz/2, avatarY + avatarSz/2, avatarSz/2, 0, Math.PI*2); ctx.fill()
          }
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.beginPath(); ctx.arc(avatarX + avatarSz/2, avatarY + avatarSz/2, avatarSz/2, 0, Math.PI*2); ctx.fill()
          ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
          ctx.fillText('?', avatarX + avatarSz/2, avatarY + avatarSz/2 + 4*S)
        }

        // 昵称
        ctx.textAlign = 'left'
        ctx.fillStyle = i < 3 ? '#ffd700' : TH.text; ctx.font = `bold ${13*S}px sans-serif`
        const nick = (item.nickName || '修士').substring(0, 8)
        ctx.fillText(nick, avatarX + avatarSz + 8*S, ry + 22*S)

        // 宠物+法宝信息（第二行小字）
        const petNames = (item.pets || []).map(p => {
          const ac = ATTR_COLOR[p.attr]
          return p.name ? p.name.substring(0, 2) : '?'
        }).join(' ')
        const wpnName = item.weapon ? `⚔${item.weapon.name.substring(0,3)}` : ''
        ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`
        ctx.fillText(`${petNames} ${wpnName}`, avatarX + avatarSz + 8*S, ry + 40*S)

        // 层数（右侧大字）
        ctx.textAlign = 'right'
        ctx.fillStyle = i < 3 ? '#ffd700' : TH.accent; ctx.font = `bold ${18*S}px sans-serif`
        ctx.fillText(`${item.floor}`, W - padX - 10*S, ry + 24*S)
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        ctx.fillText('层', W - padX - 10*S, ry + 40*S)
      }
    }
    ctx.restore()

    // 我的排名（底部固定栏）
    const myBarY = listBottom + 4*S, myBarH = 40*S
    ctx.fillStyle = 'rgba(230,168,23,0.12)'
    ctx.fillRect(padX, myBarY, W - padX*2, myBarH)
    ctx.strokeStyle = '#e6a81744'; ctx.lineWidth = 1*S
    R.rr(padX, myBarY, W - padX*2, myBarH, 6*S); ctx.stroke()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${12*S}px sans-serif`; ctx.textAlign = 'left'
    const myNick = this.storage.userInfo ? this.storage.userInfo.nickName : '我'
    ctx.fillText(`我：${myNick}`, padX + 12*S, myBarY + myBarH*0.6)
    ctx.textAlign = 'right'
    if (myRank > 0) {
      ctx.fillText(`第 ${myRank} 名`, W*0.6, myBarY + myBarH*0.6)
    } else {
      ctx.fillStyle = TH.dim
      ctx.fillText('未上榜', W*0.6, myBarY + myBarH*0.6)
    }
    ctx.fillStyle = TH.accent; ctx.font = `bold ${14*S}px sans-serif`
    ctx.fillText(`${this.storage.bestFloor} 层`, W - padX - 10*S, myBarY + myBarH*0.6)

    // 刷新提示
    if (this.storage.rankLoading) {
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('刷新中...', W*0.5, myBarY + myBarH + 14*S)
    }

    // 左上角返回按钮
    this._drawBackBtn()
    // 右上角刷新按钮
    const rfX = W - 68*S, rfY = safeTop + 6*S, rfW = 60*S, rfH = 30*S
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    R.rr(rfX, rfY, rfW, rfH, 6*S); ctx.fill()
    ctx.fillStyle = this.storage.rankLoading ? TH.dim : TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('刷新', rfX + rfW/2, rfY + rfH*0.65)
    this._rankRefreshRect = [rfX, rfY, rfW, rfH]
  }

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
  _rStats() {
    R.drawHomeBg(this.af)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

    const padX = 16*S
    // 标题
    ctx.fillStyle = '#7ec8f0'; ctx.font = `bold ${22*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('📊 历史统计', W*0.5, safeTop + 40*S)

    const st = this.storage.stats
    const startY = safeTop + 70*S
    const lineH = 38*S

    // 统计面板背景
    const panelH = lineH * 8 + 20*S
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    R.rr(padX, startY - 10*S, W - padX*2, panelH, 10*S); ctx.fill()
    ctx.strokeStyle = 'rgba(126,200,240,0.2)'; ctx.lineWidth = 1*S
    R.rr(padX, startY - 10*S, W - padX*2, panelH, 10*S); ctx.stroke()

    const items = [
      { label: '历史最高层数', value: `第 ${this.storage.bestFloor} 层`, color: '#ffd700' },
      { label: '总挑战次数', value: `${this.storage.totalRuns} 次`, color: TH.accent },
      { label: '总战斗场次', value: `${st.totalBattles} 场`, color: TH.text },
      { label: '总消除Combo', value: `${st.totalCombos} 次`, color: TH.text },
      { label: '最高单次Combo', value: `${st.maxCombo} 连`, color: '#ff6b6b' },
      { label: '平均每场Combo', value: st.totalBattles > 0 ? `${(st.totalCombos / st.totalBattles).toFixed(1)} 次` : '-', color: TH.text },
    ]

    items.forEach((item, i) => {
      const y = startY + i * lineH + 16*S
      // 偶数行微亮背景
      if (i % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.03)'
        ctx.fillRect(padX + 4*S, y - 14*S, W - padX*2 - 8*S, lineH - 2*S)
      }
      // 标签
      ctx.textAlign = 'left'
      ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
      ctx.fillText(item.label, padX + 16*S, y)
      // 值
      ctx.textAlign = 'right'
      ctx.fillStyle = item.color; ctx.font = `bold ${14*S}px sans-serif`
      ctx.fillText(item.value, W - padX - 16*S, y)
    })

    // 最高记录阵容
    const teamY = startY + 6 * lineH + 16*S
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
    ctx.fillText('最高记录阵容：', padX + 16*S, teamY)

    const bfPets = st.bestFloorPets || []
    const bfWeapon = st.bestFloorWeapon
    if (bfPets.length > 0) {
      const petStr = bfPets.map(p => p.name).join('、')
      ctx.fillStyle = TH.text; ctx.font = `${11*S}px sans-serif`
      ctx.fillText(petStr, padX + 16*S, teamY + 20*S)
      if (bfWeapon) {
        ctx.fillStyle = '#ffd700'; ctx.font = `${11*S}px sans-serif`
        ctx.fillText(`法宝：${bfWeapon.name}`, padX + 16*S, teamY + 38*S)
      }
    } else {
      ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`
      ctx.fillText('暂无记录', padX + 16*S, teamY + 20*S)
    }

    // 左上角返回按钮
    this._drawBackBtn()
  }

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
  _drawTeamBar(topY, barH, iconSize) {
    ctx.save()
    // 重置关键状态，避免被前面绘制代码影响
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    // 背景条
    ctx.fillStyle = 'rgba(8,8,20,0.88)'
    ctx.fillRect(0, topY, W, barH)

    // 加载边框图片（五行宠物；法宝使用代码绘制的金色边框）
    const framePetMap = {
      metal: R.getImg('assets/ui/frame_pet_metal.png'),
      wood:  R.getImg('assets/ui/frame_pet_wood.png'),
      water: R.getImg('assets/ui/frame_pet_water.png'),
      fire:  R.getImg('assets/ui/frame_pet_fire.png'),
      earth: R.getImg('assets/ui/frame_pet_earth.png'),
    }

    // 6个1:1方格，法宝与宠物间距稍大，宠物之间间距紧凑
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
      // 法宝在第0格，宠物在1~5格
      let ix
      if (i === 0) {
        ix = sidePad
      } else {
        ix = sidePad + iconSize + wpnGap + (i - 1) * (iconSize + petGap)
      }
      const cx = ix + iconSize * 0.5
      const cy = iconY + iconSize * 0.5

      if (i === 0) {
        // ===== 第1格：法宝（金色边框，与宠物属性边框区分）=====
        // 底色
        ctx.fillStyle = this.weapon ? '#1a1510' : 'rgba(25,22,18,0.8)'
        ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)

        if (this.weapon) {
          // 法宝图片（裁剪到格子内，无文字覆盖）
          const wpnImg = R.getImg(`assets/equipment/fabao_${this.weapon.id}.png`)
          ctx.save()
          ctx.beginPath(); ctx.rect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2); ctx.clip()
          if (wpnImg && wpnImg.width > 0) {
            ctx.drawImage(wpnImg, ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
          } else {
            // 金色光晕回退
            const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, iconSize*0.38)
            grd.addColorStop(0, '#ffd70044')
            grd.addColorStop(1, 'transparent')
            ctx.fillStyle = grd
            ctx.fillRect(ix, iconY, iconSize, iconSize)
            ctx.fillStyle = '#ffd700'
            ctx.font = `bold ${iconSize*0.38}px sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('⚔', cx, cy)
          }
          ctx.restore()
        } else {
          // 无法宝：淡色⚔
          ctx.fillStyle = 'rgba(80,70,60,0.3)'
          ctx.font = `${iconSize*0.26}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('⚔', cx, cy)
        }

        // ===== 法宝专属金色边框（代码绘制，圆角+金色渐变，区别于宠物属性边框）=====
        ctx.save()
        const bPad = 2*S  // 边框内缩
        const bx2 = ix - bPad, by2 = iconY - bPad, bsz = iconSize + bPad*2, brd = 6*S
        // 外层金色描边（粗）
        const goldGrd = ctx.createLinearGradient(bx2, by2, bx2 + bsz, by2 + bsz)
        goldGrd.addColorStop(0, '#ffd700')
        goldGrd.addColorStop(0.3, '#ffec80')
        goldGrd.addColorStop(0.5, '#ffd700')
        goldGrd.addColorStop(0.7, '#c8a200')
        goldGrd.addColorStop(1, '#ffd700')
        ctx.strokeStyle = goldGrd
        ctx.lineWidth = 3*S
        R.rr(bx2, by2, bsz, bsz, brd); ctx.stroke()
        // 内层亮线
        ctx.strokeStyle = 'rgba(255,236,128,0.5)'
        ctx.lineWidth = 1*S
        R.rr(bx2 + 2*S, by2 + 2*S, bsz - 4*S, bsz - 4*S, 4*S); ctx.stroke()
        // 四角金色小钻石装饰
        const cornerOff = 3*S, cornerR = 3.5*S
        const corners = [
          [bx2 + cornerOff, by2 + cornerOff],
          [bx2 + bsz - cornerOff, by2 + cornerOff],
          [bx2 + cornerOff, by2 + bsz - cornerOff],
          [bx2 + bsz - cornerOff, by2 + bsz - cornerOff],
        ]
        corners.forEach(([ccx, ccy]) => {
          ctx.save()
          ctx.translate(ccx, ccy)
          ctx.rotate(Math.PI/4)
          ctx.fillStyle = '#ffd700'
          ctx.fillRect(-cornerR, -cornerR, cornerR*2, cornerR*2)
          ctx.strokeStyle = '#fff8'
          ctx.lineWidth = 0.5*S
          ctx.strokeRect(-cornerR, -cornerR, cornerR*2, cornerR*2)
          ctx.restore()
        })
        // 微发光
        ctx.shadowColor = '#ffd700'
        ctx.shadowBlur = 6*S
        ctx.strokeStyle = 'rgba(255,215,0,0.3)'
        ctx.lineWidth = 1*S
        R.rr(bx2, by2, bsz, bsz, brd); ctx.stroke()
        ctx.restore()

        // 记录法宝点击区域
        this._weaponBtnRect = [ix, iconY, iconSize, iconSize]
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

  // ===== 广告复活弹窗 =====
  _drawAdReviveOverlay() {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)

    // 弹窗面板
    const panelW = W * 0.78, panelH = 240*S
    const panelX = (W - panelW) / 2, panelY = H * 0.28
    ctx.fillStyle = 'rgba(16,16,32,0.96)'
    R.rr(panelX, panelY, panelW, panelH, 14*S); ctx.fill()
    ctx.strokeStyle = '#ffd70088'; ctx.lineWidth = 2*S
    R.rr(panelX, panelY, panelW, panelH, 14*S); ctx.stroke()
    // 顶部金色装饰条
    ctx.save()
    ctx.beginPath()
    R.rr(panelX, panelY, panelW, 4*S, 14*S); ctx.clip()
    ctx.fillStyle = '#ffd700'
    ctx.fillRect(panelX, panelY, panelW, 4*S)
    ctx.restore()

    // 标题
    ctx.textAlign = 'center'
    ctx.fillStyle = TH.danger; ctx.font = `bold ${22*S}px sans-serif`
    ctx.fillText('修士陨落', W*0.5, panelY + 40*S)

    // 副标题
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px sans-serif`
    ctx.fillText('🎬 观看广告，满血复活！', W*0.5, panelY + 72*S)

    // 说明文字
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(`当前第 ${this.floor} 层，复活后从本层继续挑战`, W*0.5, panelY + 98*S)
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
    ctx.fillText('每轮通关仅有一次复活机会', W*0.5, panelY + 116*S)

    // 复活按钮（金色醒目）
    const btnW = panelW * 0.7, btnH = 44*S
    const btnX = (W - btnW) / 2, btnY = panelY + 140*S
    ctx.fillStyle = '#ffd700'
    R.rr(btnX, btnY, btnW, btnH, 10*S); ctx.fill()
    ctx.fillStyle = '#1a1a2e'; ctx.font = `bold ${16*S}px sans-serif`
    ctx.fillText('▶ 观看广告复活', W*0.5, btnY + btnH*0.5 + 6*S)
    this._adReviveBtnRect = [btnX, btnY, btnW, btnH]

    // 放弃按钮
    const skipW = panelW * 0.5, skipH = 36*S
    const skipX = (W - skipW) / 2, skipY = panelY + 196*S
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    R.rr(skipX, skipY, skipW, skipH, 8*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 1*S
    R.rr(skipX, skipY, skipW, skipH, 8*S); ctx.stroke()
    ctx.fillStyle = TH.dim; ctx.font = `${13*S}px sans-serif`
    ctx.fillText('放弃治疗', W*0.5, skipY + skipH*0.5 + 5*S)
    this._adReviveSkipRect = [skipX, skipY, skipW, skipH]
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
    if (this.scene === 'gameover' || this.scene === 'ranking' || this.scene === 'stats') {
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

  // ===== 左侧全局增益图标列 =====
  _drawRunBuffIcons(topY, bottomY) {
    this._runBuffIconRects = []
    const log = this.runBuffLog
    if (!log || log.length === 0) return

    // 合并同类buff：按buff字段聚合，显示累计值
    const merged = {}
    const BUFF_LABELS = {
      allAtkPct:'攻', allDmgPct:'伤', heartBoostPct:'回', weaponBoostPct:'武',
      extraTimeSec:'时', hpMaxPct:'血', comboDmgPct:'连', elim3DmgPct:'3消',
      elim4DmgPct:'4消', elim5DmgPct:'5消', counterDmgPct:'克', skillDmgPct:'技',
      skillCdReducePct:'CD', regenPerTurn:'生', dmgReducePct:'防', bonusCombo:'C+',
      stunDurBonus:'晕', enemyAtkReducePct:'弱攻', enemyHpReducePct:'弱血',
      enemyDefReducePct:'弱防', eliteAtkReducePct:'E攻', eliteHpReducePct:'E血',
      bossAtkReducePct:'B攻', bossHpReducePct:'B血',
      nextDmgReducePct:'减伤', postBattleHealPct:'战回', extraRevive:'复活',
    }
    // 是否是减益类（对敌人生效的减益，用不同颜色区分）
    const DEBUFF_KEYS = ['enemyAtkReducePct','enemyHpReducePct','enemyDefReducePct',
      'eliteAtkReducePct','eliteHpReducePct','bossAtkReducePct','bossHpReducePct']

    for (const entry of log) {
      const k = entry.buff
      if (!merged[k]) merged[k] = { buff: k, val: 0, label: BUFF_LABELS[k] || k, entries: [] }
      merged[k].val += entry.val
      merged[k].entries.push(entry)
    }
    const items = Object.values(merged)
    if (items.length === 0) return

    const iconSz = 24*S
    const gap = 4*S
    const maxShow = Math.floor((bottomY - topY) / (iconSz + gap))
    const showItems = items.slice(0, maxShow)
    const leftX = 4*S

    for (let i = 0; i < showItems.length; i++) {
      const it = showItems[i]
      const iy = topY + i * (iconSz + gap)
      const isDebuff = DEBUFF_KEYS.includes(it.buff)
      // 背景
      ctx.fillStyle = isDebuff ? 'rgba(180,60,60,0.7)' : 'rgba(30,100,60,0.7)'
      R.rr(leftX, iy, iconSz, iconSz, 4*S); ctx.fill()
      // 边框
      ctx.strokeStyle = isDebuff ? 'rgba(255,100,100,0.5)' : 'rgba(100,255,150,0.4)'
      ctx.lineWidth = 1*S
      R.rr(leftX, iy, iconSz, iconSz, 4*S); ctx.stroke()
      // 图标文字（缩写）
      ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(it.label, leftX + iconSz/2, iy + iconSz*0.38)
      ctx.textBaseline = 'alphabetic'
      // 数值（下方小字）
      const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}` :
                     it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                     `${it.val > 0 ? '+' : ''}${it.val}%`
      ctx.fillStyle = '#ffd700'; ctx.font = `${6*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(valTxt, leftX + iconSz/2, iy + iconSz*0.78)
      // 记录点击区域
      this._runBuffIconRects.push({ rect: [leftX, iy, iconSz, iconSz], data: it })
    }
    // 若有更多未显示，底部显示 +N
    if (items.length > maxShow) {
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(`+${items.length - maxShow}`, leftX + iconSz/2, topY + maxShow * (iconSz + gap) + 8*S)
    }
  }

  // ===== 全局增益详情弹窗 =====
  _drawRunBuffDetailDialog() {
    const log = this.runBuffLog
    if (!log || log.length === 0) { this.showRunBuffDetail = false; return }

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, W, H)

    const padX = 16*S, padY = 14*S
    const tipW = W * 0.88
    const lineH = 18*S
    const titleH = 24*S

    // 合并同类
    const merged = {}
    const BUFF_FULL_LABELS = {
      allAtkPct:'全队攻击', allDmgPct:'全属性伤害', heartBoostPct:'心珠回复', weaponBoostPct:'法宝效果',
      extraTimeSec:'转珠时间', hpMaxPct:'血量上限', comboDmgPct:'Combo伤害', elim3DmgPct:'3消伤害',
      elim4DmgPct:'4消伤害', elim5DmgPct:'5消伤害', counterDmgPct:'克制伤害', skillDmgPct:'技能伤害',
      skillCdReducePct:'技能CD缩短', regenPerTurn:'每回合回血', dmgReducePct:'受伤减少',
      bonusCombo:'额外连击', stunDurBonus:'眩晕延长', enemyAtkReducePct:'怪物攻击降低',
      enemyHpReducePct:'怪物血量降低', enemyDefReducePct:'怪物防御降低',
      eliteAtkReducePct:'精英攻击降低', eliteHpReducePct:'精英血量降低',
      bossAtkReducePct:'BOSS攻击降低', bossHpReducePct:'BOSS血量降低',
      nextDmgReducePct:'下场受伤减少', postBattleHealPct:'战后回血', extraRevive:'额外复活',
    }
    for (const entry of log) {
      const k = entry.buff
      if (!merged[k]) merged[k] = { buff: k, val: 0, count: 0 }
      merged[k].val += entry.val
      merged[k].count++
    }
    const items = Object.values(merged)
    const totalLines = items.length
    const contentH = titleH + totalLines * lineH + padY * 2 + 10*S
    const tipH = Math.min(contentH, H * 0.7)
    const tipX = (W - tipW) / 2
    const tipY = (H - tipH) / 2

    // 弹窗背景
    ctx.fillStyle = 'rgba(10,10,30,0.95)'
    R.rr(tipX, tipY, tipW, tipH, 10*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,215,0,0.4)'; ctx.lineWidth = 1*S
    R.rr(tipX, tipY, tipW, tipH, 10*S); ctx.stroke()

    // 标题
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${14*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('全局增益一览', W*0.5, tipY + padY + 12*S)

    // 列表
    let ly = tipY + padY + titleH + 4*S
    ctx.textAlign = 'left'
    for (const it of items) {
      if (ly + lineH > tipY + tipH - padY) break
      const name = BUFF_FULL_LABELS[it.buff] || it.buff
      const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}s` :
                     it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                     `${it.val > 0 ? '+' : ''}${it.val}%`
      const countTxt = it.count > 1 ? ` (x${it.count})` : ''
      ctx.fillStyle = '#ddd'; ctx.font = `${11*S}px sans-serif`
      ctx.fillText(`· ${name}`, tipX + padX, ly + 12*S)
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${11*S}px sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText(`${valTxt}${countTxt}`, tipX + tipW - padX, ly + 12*S)
      ctx.textAlign = 'left'
      ly += lineH
    }

    // 底部提示
    ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + tipH - 8*S)
  }
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

  // ===== 法宝详情弹窗 =====
  _drawWeaponDetailDialog() {
    if (!this.weapon) { this.showWeaponDetail = false; return }
    const w = this.weapon
    const padX = 16*S, padY = 14*S
    const lineH = 20*S, smallLineH = 16*S
    const tipW = W * 0.82

    let lines = []
    lines.push({ text: w.name, color: TH.accent, bold: true, size: 16, h: lineH + 4*S })
    lines.push({ text: '', size: 0, h: 6*S })
    lines.push({ text: '法宝效果：', color: '#ffd700', bold: true, size: 12, h: smallLineH })
    // 法宝描述自动换行
    const descLines = this._wrapText(w.desc || '无', tipW - padX*2 - 10*S, 11)
    descLines.forEach(dl => {
      lines.push({ text: dl, color: '#ddd', size: 11, h: smallLineH })
    })
    lines.push({ text: '', size: 0, h: 6*S })
    lines.push({ text: '提示：法宝为被动效果，全程自动生效', color: TH.dim, size: 10, h: smallLineH })

    let totalH = padY * 2
    lines.forEach(l => { totalH += l.h })
    totalH += 20*S
    // 如果有法宝图片，增加图片区域高度
    const _wdImgPre = R.getImg(`assets/equipment/fabao_${w.id}.png`)
    if (_wdImgPre && _wdImgPre.width > 0) totalH += 64*S + 8*S

    const tipX = (W - tipW) / 2
    const tipY = (H - totalH) / 2

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(16,16,32,0.96)'
    R.rr(tipX, tipY, tipW, totalH, 12*S); ctx.fill()
    ctx.strokeStyle = TH.accent + '66'; ctx.lineWidth = 2*S
    R.rr(tipX, tipY, tipW, totalH, 12*S); ctx.stroke()
    // 顶部装饰条
    ctx.save()
    ctx.beginPath()
    R.rr(tipX, tipY, tipW, 4*S, 12*S); ctx.clip()
    ctx.fillStyle = TH.accent
    ctx.fillRect(tipX, tipY, tipW, 4*S)
    ctx.restore()

    // 法宝大图
    const wdImg = R.getImg(`assets/equipment/fabao_${w.id}.png`)
    const wdImgSz = 64*S
    if (wdImg && wdImg.width > 0) {
      const wdImgX = tipX + (tipW - wdImgSz) / 2
      const wdImgY = tipY + padY
      ctx.save(); R.rr(wdImgX, wdImgY, wdImgSz, wdImgSz, 8*S); ctx.clip()
      ctx.drawImage(wdImg, wdImgX, wdImgY, wdImgSz, wdImgSz)
      ctx.restore()
      ctx.strokeStyle = TH.accent + '66'; ctx.lineWidth = 1.5*S
      R.rr(wdImgX, wdImgY, wdImgSz, wdImgSz, 8*S); ctx.stroke()
    }

    let curY = tipY + padY + (wdImg && wdImg.width > 0 ? wdImgSz + 8*S : 0)
    ctx.textAlign = 'left'
    lines.forEach(l => {
      if (l.size === 0) { curY += l.h; return }
      curY += l.h
      ctx.fillStyle = l.color || TH.text
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
    })

    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 8*S)
    ctx.restore()
  }

  // ===== 宠物详情弹窗（战斗中）=====
  _drawBattlePetDetailDialog() {
    const idx = this.showBattlePetDetail
    if (idx == null || idx >= this.pets.length) { this.showBattlePetDetail = null; return }
    const p = this.pets[idx]
    const ac = ATTR_COLOR[p.attr]
    const sk = p.skill
    const padX = 16*S, padY = 14*S
    const lineH = 20*S, smallLineH = 16*S
    const tipW = W * 0.82

    let lines = []
    lines.push({ text: p.name, color: ac ? ac.main : TH.accent, bold: true, size: 16, h: lineH + 4*S })
    lines.push({ text: `属性：${ATTR_NAME[p.attr] || '?'}　　攻击力：${p.atk}`, color: TH.sub, size: 11, h: smallLineH })
    lines.push({ text: '', size: 0, h: 6*S })

    // 技能信息
    if (sk) {
      lines.push({ text: `技能：${sk.name}`, color: '#ffd700', bold: true, size: 13, h: lineH })
      const descLines = this._wrapText(sk.desc || '无描述', tipW - padX*2 - 10*S, 11)
      descLines.forEach(dl => {
        lines.push({ text: dl, color: '#ddd', size: 11, h: smallLineH })
      })
      lines.push({ text: '', size: 0, h: 4*S })
      // CD信息
      let cdBase = p.cd
      let cdActual = cdBase
      if (this.runBuffs && this.runBuffs.skillCdReducePct > 0) {
        cdActual = Math.max(1, Math.round(cdBase * (1 - this.runBuffs.skillCdReducePct / 100)))
      }
      const cdReduced = cdActual < cdBase
      const cdText = cdReduced ? `冷却：${cdActual}回合（原${cdBase}，CD缩短${this.runBuffs.skillCdReducePct}%）` : `冷却：${cdBase}回合`
      lines.push({ text: cdText, color: TH.sub, size: 10, h: smallLineH })
      // 当前CD状态
      const ready = p.currentCd <= 0
      if (ready) {
        lines.push({ text: '✦ 技能已就绪，可点击头像释放！', color: '#4dcc4d', bold: true, size: 11, h: smallLineH })
      } else {
        lines.push({ text: `◈ 冷却中：还需 ${p.currentCd} 回合`, color: '#ff8c00', size: 11, h: smallLineH })
      }
    } else {
      lines.push({ text: '该宠物没有主动技能', color: TH.dim, size: 11, h: smallLineH })
    }

    lines.push({ text: '', size: 0, h: 6*S })
    lines.push({ text: '提示：消除对应属性珠时该宠物发动攻击', color: TH.dim, size: 10, h: smallLineH })

    let totalH = padY * 2
    lines.forEach(l => { totalH += l.h })
    totalH += 20*S

    const tipX = (W - tipW) / 2
    const tipY = (H - totalH) / 2

    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    ctx.fillStyle = 'rgba(16,16,32,0.96)'
    R.rr(tipX, tipY, tipW, totalH, 12*S); ctx.fill()
    ctx.strokeStyle = ac ? ac.main + '88' : TH.accent + '66'; ctx.lineWidth = 2*S
    R.rr(tipX, tipY, tipW, totalH, 12*S); ctx.stroke()
    // 顶部属性色装饰条
    ctx.save()
    ctx.beginPath()
    R.rr(tipX, tipY, tipW, 4*S, 12*S); ctx.clip()
    ctx.fillStyle = ac ? ac.main : TH.accent
    ctx.fillRect(tipX, tipY, tipW, 4*S)
    ctx.restore()

    let curY = tipY + padY
    ctx.textAlign = 'left'
    lines.forEach(l => {
      if (l.size === 0) { curY += l.h; return }
      curY += l.h
      if (curY > tipY + totalH - 24*S) return
      ctx.fillStyle = l.color || TH.text
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
    })

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
