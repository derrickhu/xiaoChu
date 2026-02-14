/**
 * 修仙五行转珠 - 主游戏逻辑
 * 智龙迷城式拖拽转珠 + 五行克制 + 装备品质等级
 * 
 * 属性系统：气力(血量)、五行攻击×5、五行防御×5、回复值(彩珠回血)
 * 伤害公式：Max((自身该五行攻×消除倍率 - 敌方该五行防) × 克制倍率 × Combo倍率, 0)
 * 五行克制：金→木→土→水→火→金（克制×1.5，被克×0.6）
 * 策略优先级：属性克制 > Combo > 消除个数
 */
const { Render, A, TH } = require('./render')
const Storage = require('./data/storage')
const {
  ATTRS, ATTR_NAME, ATTR_COLOR, BEAD_ATTRS, BEAD_ATTR_NAME, BEAD_ATTR_COLOR,
  COUNTER_MAP, COUNTER_BY, ATK_KEY, DEF_KEY,
  EQUIP_SLOT, QUALITY, QUALITY_ORDER,
  STAT_DEFS, STAT_KEYS,
  randomDrop, generateEquipment,
} = require('./data/equipment')
const { DIFFICULTY, ALL_LEVELS, getLevelData, TUTORIAL_TIPS } = require('./data/levels')
const MusicMgr = require('./runtime/music')

// Canvas 初始化
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
const S = W / 375
const safeTop = (wx.getSystemInfoSync().safeArea?.top || 20) * (W / wx.getSystemInfoSync().windowWidth)

const COLS = 6, ROWS = 5

const R = new Render(ctx, W, H, S, safeTop)

class Main {
  constructor() {
    this.storage = new Storage()
    this.storage.checkDailyReset()
    this.scene = 'loading'
    this.af = 0
    this.scrollY = 0; this.maxScrollY = 0

    // 棋盘
    this.board = []; this.cellSize = 0; this.boardX = 0; this.boardY = 0
    // ===== 智龙迷城式转珠状态 =====
    this.dragging = false
    this.dragR = -1; this.dragC = -1      // 当前拖拽的珠子位置
    this.dragStartX = 0; this.dragStartY = 0
    this.dragCurX = 0; this.dragCurY = 0  // 当前手指位置（用于渲染拖拽中的珠子）
    this.dragAttr = null                   // 被拖拽珠子的属性
    this.dragTimer = 0                     // 拖拽已用帧数
    this.dragTimeLimit = 4 * 60            // 拖拽时间限制（4秒 @60fps）
    // 交换动画
    this.swapAnim = null
    // 绝技上滑
    this.ultSwipe = null
    this._ultIconArea = null
    // 战斗状态
    this.bState = 'none'  // none/playerTurn/elimAnim/dropping/preAttack/settling/preEnemy/enemyTurn/victory/defeat
    this._stateTimer = 0
    this._enemyTurnWait = false
    this._pendingDmgMap = null
    this._pendingHeal = 0
    this.combo = 0; this.turnCount = 0; this.elimSets = []
    this.elimQueue = []          // 待消除的组队列（逐组消除用）
    this.elimAnimCells = null    // 当前正在播放消除动画的格子和属性
    this.elimAnimTimer = 0       // 消除动画计时器
    this.dropAnimTimer = 0       // 掉落动画计时器
    this.dropAnimCols = null     // 掉落动画列信息
    this.enemyHp = 0; this.enemyMaxHp = 0; this.heroHp = 0; this.heroMaxHp = 0
    this.heroShield = 0
    this.heroBuffs = []; this.enemyBuffs = []
    this.skillTriggers = {}
    this.ultReady = {}
    this.pendingUlt = null
    // 动画
    this.dmgFloats = []; this.skillEffects = []
    this.shakeT = 0; this.shakeI = 0
    this.heroAttackAnim = { active:false, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:false, progress:0, duration:18 }
    this.heroHurtAnim   = { active:false, progress:0, duration:18 }
    this.enemyAttackAnim= { active:false, progress:0, duration:20 }
    this.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
    // 血条掉血动画（灰色残影）
    this._enemyHpLoss = null  // { fromPct, timer }
    this._heroHpLoss = null   // { fromPct, timer }
    // 掉落
    this.dropPopup = null; this.tempEquips = []
    // 属性查看面板
    this.statPanel = null
    // Loading
    this._loadStart = Date.now()
    // 当前关卡
    this.curLevel = null
    this._pressedBtn = null

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

    // 主循环
    const loop = () => {
      this.af++
      this.update()
      this.render()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  }

  // ===== 场景管理 =====
  goTo(scene) { this.scene = scene; this.scrollY = 0 }
  goBack() {
    if (this.scene === 'battle' || this.scene === 'battlePrepare') {
      this._cleanupBattle()
    }
    this.scene = 'home'; this.scrollY = 0
  }

  // ===== 更新 =====
  update() {
    if (this.shakeT > 0) this.shakeT--
    // 伤害飘字：先停顿再缓慢上移消失
    this.dmgFloats = this.dmgFloats.filter(f => {
      f.t++
      if (f.t <= 20) {
        // 前20帧：停留+轻微放大弹跳
        f.y -= 0.3*S
      } else if (f.t <= 50) {
        // 20-50帧：缓慢上移
        f.y -= 0.8*S
        f.alpha -= 0.01
      } else {
        // 50帧后：加速消失
        f.y -= 1.2*S
        f.alpha -= 0.04
      }
      return f.alpha > 0
    })
    this.skillEffects = this.skillEffects.filter(e => { e.t++; e.y -= 0.6*S; e.alpha -= 0.012; return e.alpha > 0 })
    if (this.scene === 'loading' && Date.now() - this._loadStart > 1500) {
      this.scene = 'intro'
      MusicMgr.playBgm()
    }
    if (this.bState === 'elimAnim') this._processElim()
    if (this.bState === 'dropping') this._processDropAnim()
    // 拖拽计时器
    if (this.dragging && this.bState === 'playerTurn') {
      this.dragTimer++
      if (this.dragTimer >= this.dragTimeLimit) {
        // 时间到，强制松手
        this.dragging = false
        this.dragAttr = null
        this.dragTimer = 0
        this._checkAndElim()
      }
    }
    if (this.bState === 'preAttack') {
      this._stateTimer++
      if (this._stateTimer >= 20) {
        this._stateTimer = 0
        this._executeAttack()
      }
    }
    if (this.bState === 'preEnemy') {
      this._stateTimer++
      if (this._stateTimer >= 30) {
        this._stateTimer = 0
        this._enemyTurn()
      }
    }
    if (this.bState === 'enemyTurn' && this._enemyTurnWait) {
      this._stateTimer++
      if (this._stateTimer >= 36) {
        this._stateTimer = 0
        this._enemyTurnWait = false
        this.bState = 'playerTurn'
        this.dragTimer = 0  // 重置拖拽计时器
      }
    }
    this._updateSwapAnim()
    this._updateBattleAnims()
    // 血条掉血灰色残影动画
    if (this._enemyHpLoss) {
      this._enemyHpLoss.timer++
      const totalFrames = 45  // 灰色残影持续45帧
      if (this._enemyHpLoss.timer >= totalFrames) this._enemyHpLoss = null
    }
    if (this._heroHpLoss) {
      this._heroHpLoss.timer++
      const totalFrames = 45
      if (this._heroHpLoss.timer >= totalFrames) this._heroHpLoss = null
    }
  }

  _updateBattleAnims() {
    const anims = [this.heroAttackAnim, this.enemyHurtAnim, this.heroHurtAnim, this.enemyAttackAnim, this.skillCastAnim]
    anims.forEach(a => {
      if (a.active) {
        a.progress += 1/a.duration
        if (a.progress >= 1) { a.active = false; a.progress = 0 }
      }
    })
  }

  // 计算怪物区中心Y（新布局）
  _getEnemyCenterY() {
    const padX = 8*S
    const cellSize = (W - padX*2) / COLS
    const boardH = ROWS * cellSize
    const boardTop = H - 10*S - boardH
    const skillBarTop = boardTop - 28*S - 54*S
    const eAreaH = skillBarTop - safeTop - 28*S
    return safeTop + 28*S + eAreaH * 0.45
  }

  _playHeroAttack(skillName, attr, type) {
    this.heroAttackAnim = { active:true, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:true, progress:0, duration:18 }
    const color = ATTR_COLOR[attr]?.main || TH.accent
    const eCenterY = this._getEnemyCenterY()
    this.skillCastAnim = {
      active:true, progress:0, duration:30,
      type: type||'slash', color,
      skillName: skillName||'',
      targetX: W*0.5, targetY: eCenterY
    }
  }

  _playEnemyAttack(skillName) {
    this.enemyAttackAnim = { active:true, progress:0, duration:20 }
    this.heroHurtAnim    = { active:true, progress:0, duration:18 }
    const padX = 8*S
    const cellSize = (W - padX*2) / COLS
    const boardH = ROWS * cellSize
    const boardTop = H - 10*S - boardH
    const hpBarTop = boardTop - 28*S
    this.skillCastAnim = {
      active:true, progress:0, duration:25,
      type:'enemyAtk', color:TH.danger,
      skillName: skillName||'',
      targetX: W*0.5, targetY: hpBarTop
    }
  }

  _playHealEffect(skillName) {
    const padX = 8*S
    const cellSize = (W - padX*2) / COLS
    const boardH = ROWS * cellSize
    const boardTop = H - 10*S - boardH
    const hpBarTop = boardTop - 28*S
    this.skillCastAnim = {
      active:true, progress:0, duration:28,
      type:'heal', color:TH.success,
      skillName: skillName||'',
      targetX: W*0.5, targetY: hpBarTop
    }
  }

  _playShieldEffect(skillName, attr) {
    const padX = 8*S
    const cellSize = (W - padX*2) / COLS
    const boardH = ROWS * cellSize
    const boardTop = H - 10*S - boardH
    const hpBarTop = boardTop - 28*S
    const color = ATTR_COLOR[attr]?.main || '#74c0fc'
    this.skillCastAnim = {
      active:true, progress:0, duration:30,
      type:'shield', color,
      skillName: skillName||'',
      targetX: W*0.5, targetY: hpBarTop
    }
  }

  _playDebuffEffect(skillName, attr) {
    const eCenterY = this._getEnemyCenterY()
    const color = ATTR_COLOR[attr]?.main || '#da77f2'
    this.skillCastAnim = {
      active:true, progress:0, duration:28,
      type:'debuff', color,
      skillName: skillName||'',
      targetX: W*0.5, targetY: eCenterY
    }
  }

  // ===== 渲染入口 =====
  render() {
    ctx.save()
    if (this.shakeT > 0) ctx.translate((Math.random()-0.5)*this.shakeI,(Math.random()-0.5)*this.shakeI)
    switch(this.scene) {
      case 'loading':       this.rLoading(); break
      case 'intro':         this.rIntro(); break
      case 'home':          this.rHome(); break
      case 'battlePrepare': this.rBattlePrepare(); break
      case 'battle':        this.rBattle(); break
    }
    ctx.restore()
  }

  // ===== Loading =====
  rLoading() {
    R.drawLoadingBg(this.af)
    const p = Math.min(1, (Date.now()-this._loadStart)/1400), cy = H*0.4
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=30*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${48*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('修仙消消乐',W/2,cy)
    ctx.shadowBlur=0; ctx.restore()
    const bw=W*0.5, bh=4*S, bx=(W-bw)/2, by=cy+60*S
    ctx.fillStyle='rgba(255,255,255,0.1)'; R.rr(bx,by,bw,bh,bh/2); ctx.fill()
    const g=ctx.createLinearGradient(bx,by,bx+bw*p,by)
    g.addColorStop(0,TH.accent); g.addColorStop(1,TH.danger)
    ctx.fillStyle=g; R.rr(bx,by,bw*p,bh,bh/2); ctx.fill()
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.fillText('加载中...',W/2,by+24*S)
  }

  // ===== 角色展示 =====
  rIntro() {
    R.drawHomeBg(this.af)
    const m = 16*S
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=20*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${32*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('修仙消消乐', W/2, safeTop+50*S)
    ctx.shadowBlur=0; ctx.restore()

    const charY = safeTop+100*S, charH = H*0.4
    const pulse = 1 + 0.03*Math.sin(this.af*0.04)
    ctx.save(); ctx.globalAlpha=0.15
    ctx.fillStyle=TH.accent
    ctx.beginPath(); ctx.arc(W/2, charY+charH/2, 80*S*pulse, 0, Math.PI*2); ctx.fill()
    ctx.restore()
    const heroImg = R.getImg('assets/hero/hero_body.jpg')
    const heroSize = 120*S
    if (heroImg && heroImg.width > 0) {
      ctx.drawImage(heroImg, W/2-heroSize/2, charY+charH/2-heroSize/2, heroSize, heroSize)
    } else {
      ctx.save()
      const g = ctx.createRadialGradient(W/2, charY+charH/2, 10*S, W/2, charY+charH/2, 55*S)
      g.addColorStop(0, '#ffd700'); g.addColorStop(0.6, '#ff6b35'); g.addColorStop(1, 'rgba(255,107,53,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W/2, charY+charH/2, 55*S, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font=`${60*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText('🧙', W/2, charY+charH/2)
      ctx.restore()
    }

    const stats = this.storage.getHeroStats()
    const infoY = charY+charH+20*S
    R.drawDarkPanel(m, infoY, W-m*2, 60*S, 12*S)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('初始修为', W/2, infoY+16*S)
    ctx.font=`${12*S}px "PingFang SC",sans-serif`
    const statsText = `气力:${stats.stamina} 金攻:${stats.metalAtk} 回复:${stats.recovery}`
    const totalW2 = ctx.measureText(statsText).width
    let sx = W/2 - totalW2/2
    ctx.textAlign='left'
    ctx.fillStyle='#ff6b6b'; ctx.fillText(`气力:${stats.stamina}`, sx, infoY+40*S)
    sx += ctx.measureText(`气力:${stats.stamina} `).width
    ctx.fillStyle='#ffd43b'; ctx.fillText(`金攻:${stats.metalAtk}`, sx, infoY+40*S)
    sx += ctx.measureText(`金攻:${stats.metalAtk} `).width
    ctx.fillStyle='#69db7c'; ctx.fillText(`回复:${stats.recovery}`, sx, infoY+40*S)

    const eqCount = Object.values(this.storage.equipped).filter(e=>e).length
    if (eqCount > 0) {
      ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(`已佩戴 ${eqCount}/5`, W/2, infoY+60*S+10*S)
    }

    const btnW = 180*S, btnH = 48*S
    const btnX = (W-btnW)/2, btnY = H-120*S
    R.drawBtn(btnX, btnY, btnW, btnH, '踏入仙途', TH.danger)

    ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.fillText('点击开始你的修仙之旅', W/2, btnY+btnH+16*S)
  }

  // ===== 首页 =====
  rHome() {
    R.drawHomeBg(this.af)
    const m = 16*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${20*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('修仙消消乐', W/2, safeTop+30*S)

    const stats = this.storage.getHeroStats()
    const cardY = safeTop+60*S, cardW = W-m*2, cardH = 80*S
    R.drawDarkPanel(m, cardY, cardW, cardH, 12*S)
    const avatarSize = 50*S, avatarX = m+14*S, avatarY = cardY+15*S
    ctx.save()
    ctx.beginPath(); ctx.arc(avatarX+avatarSize/2, avatarY+avatarSize/2, avatarSize/2, 0, Math.PI*2); ctx.clip()
    const heroImg = R.getImg('assets/hero/hero_avatar.jpg')
    if (heroImg && heroImg.width > 0) {
      ctx.drawImage(heroImg, avatarX, avatarY, avatarSize, avatarSize)
    } else {
      const g = ctx.createRadialGradient(avatarX+avatarSize/2, avatarY+avatarSize/2, 5*S, avatarX+avatarSize/2, avatarY+avatarSize/2, avatarSize/2)
      g.addColorStop(0, TH.accent); g.addColorStop(1, '#ff6b35')
      ctx.fillStyle=g; ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
    }
    ctx.restore()
    const textX = avatarX+avatarSize+12*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText('修仙者', textX, cardY+22*S)
    ctx.font=`${11*S}px "PingFang SC",sans-serif`
    let attrX = textX
    ctx.fillStyle='#ff6b6b'; ctx.fillText(`气力:${stats.stamina}`, attrX, cardY+42*S)
    attrX += ctx.measureText(`气力:${stats.stamina} `).width
    ctx.fillStyle='#ffd43b'; ctx.fillText(`金攻:${stats.metalAtk}`, attrX, cardY+42*S)
    attrX += ctx.measureText(`金攻:${stats.metalAtk} `).width
    ctx.fillStyle='#69db7c'; ctx.fillText(`回复:${stats.recovery}`, attrX, cardY+42*S)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign='right'; ctx.fillText(`💎 ${this.storage.gold}`, W-m-12*S, cardY+22*S)
    const eqCount = Object.values(this.storage.equipped).filter(e=>e).length
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(`法宝 ${eqCount}/5`, W-m-12*S, cardY+42*S)

    const lv = ALL_LEVELS.find(l=>l.levelId===this.storage.currentLevel) || ALL_LEVELS[0]
    const lvY = cardY+cardH+20*S, lvH = 170*S
    R.drawDarkPanel(m, lvY, cardW, lvH, 14*S)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${15*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='top'
    ctx.fillText('📍 当前秘境', W/2, lvY+12*S)
    const enemyR = 28*S
    R.drawEnemy(W/2, lvY+60*S, enemyR, lv.enemy.attr, lv.enemy.hp, lv.enemy.hp, lv.enemy.name, lv.enemy.avatar, this.af)
    // 关卡名（显示在怪物名下方）
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='top'
    ctx.fillText(lv.name, W/2, lvY+108*S)
    // 怪物属性信息
    ctx.font=`${11*S}px "PingFang SC",sans-serif`
    const enemyMainAtk = lv.enemy[ATK_KEY[lv.enemy.attr]] || 0
    const enemyMainDef = lv.enemy[DEF_KEY[lv.enemy.attr]] || 0
    const attrColor = ATTR_COLOR[lv.enemy.attr]?.main || TH.sub
    let infoX = W/2 - 90*S
    ctx.textAlign='left'
    ctx.fillStyle='#ff6b6b'; ctx.fillText(`HP:${lv.enemy.hp}`, infoX, lvY+128*S)
    infoX += ctx.measureText(`HP:${lv.enemy.hp}  `).width
    ctx.fillStyle=attrColor; ctx.fillText(`${ATTR_NAME[lv.enemy.attr]}攻:${enemyMainAtk}`, infoX, lvY+128*S)
    infoX += ctx.measureText(`${ATTR_NAME[lv.enemy.attr]}攻:${enemyMainAtk}  `).width
    ctx.fillStyle=TH.sub; ctx.fillText(`${ATTR_NAME[lv.enemy.attr]}防:${enemyMainDef}`, infoX, lvY+128*S)

    const btnW = 160*S, btnH = 44*S
    const btnX = (W-btnW)/2, btnY = lvY+lvH+20*S
    R.drawBtn(btnX, btnY, btnW, btnH, '进入秘境', TH.danger)

    const statY = btnY+btnH+24*S
    ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    const passedTotal = Object.keys(this.storage.levelProgress).length
    ctx.fillText(`已闯 ${passedTotal} 层 · 最高连击 ${this.storage.stats.maxCombo}`, W/2, statY)

    // 重置数据按钮（右下角小按钮）
    const resetW = 80*S, resetH = 30*S
    const resetX = W-m-resetW, resetY = statY+20*S
    ctx.fillStyle='rgba(255,60,60,0.2)'; R.rr(resetX,resetY,resetW,resetH,8*S); ctx.fill()
    ctx.strokeStyle='rgba(255,60,60,0.4)'; ctx.lineWidth=1; R.rr(resetX,resetY,resetW,resetH,8*S); ctx.stroke()
    ctx.fillStyle='rgba(255,100,100,0.8)'; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('重置数据', resetX+resetW/2, resetY+resetH/2)
  }

  // ===== 战斗准备 =====
  rBattlePrepare() {
    R.drawLevelBg(this.af); R.drawTopBar(this.curLevel ? this.curLevel.name : '备战', true)
    if (!this.curLevel) return
    const m=14*S, startY=safeTop+56*S
    const lv = this.curLevel
    R.drawDarkPanel(m,startY,W-m*2,100*S,12*S)
    R.drawEnemy(m+50*S, startY+50*S, 30*S, lv.enemy.attr, lv.enemy.hp, lv.enemy.hp, lv.enemy.name, lv.enemy.avatar, this.af)
    ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillStyle='#ff6b6b'; ctx.fillText(`HP: ${lv.enemy.hp}`, m+90*S, startY+20*S)
    const eMainAtk = lv.enemy[ATK_KEY[lv.enemy.attr]] || 0
    const bpAttrColor = ATTR_COLOR[lv.enemy.attr]?.main || TH.accent
    ctx.fillStyle=bpAttrColor; ctx.fillText(`${ATTR_NAME[lv.enemy.attr]}攻:${eMainAtk}`, m+90*S, startY+38*S)
    const eMainDef = lv.enemy[DEF_KEY[lv.enemy.attr]] || 0
    ctx.fillStyle='#74c0fc'; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${ATTR_NAME[lv.enemy.attr]}防:${eMainDef}`, m+90*S, startY+56*S)
    if (lv.specialCond) {
      ctx.fillStyle=TH.accent; ctx.fillText('特殊: '+lv.specialCond.type, m+90*S, startY+72*S)
    }
    // 法宝概览（5槽位，3+2布局）
    const eqY = startY+116*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.fillText('出战法宝', m, eqY)
    const eqW = (W-m*2-10*S)/2, eqH = 46*S
    Object.keys(EQUIP_SLOT).forEach((slot,i) => {
      const col=i%2, row=Math.floor(i/2)
      R.drawEquipCard(m+col*(eqW+10*S), eqY+20*S+row*(eqH+6*S), eqW, eqH, this.storage.equipped[slot], false, this.af)
    })
    const stats = this.storage.getHeroStats()
    const totalRows = Math.ceil(Object.keys(EQUIP_SLOT).length / 2)
    const infoY = eqY+20*S + totalRows*(eqH+6*S) + 10*S
    ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'
    ctx.fillStyle=TH.text; ctx.fillText('修士', m, infoY)
    let bpX = m + ctx.measureText('修士 ').width
    ctx.fillStyle='#ff6b6b'; ctx.fillText(`气力:${stats.stamina}`, bpX, infoY)
    bpX += ctx.measureText(`气力:${stats.stamina} `).width
    ctx.fillStyle='#69db7c'; ctx.fillText(`回复:${stats.recovery}`, bpX, infoY)
    R.drawBtn(W/2-55*S, infoY+30*S, 110*S, 40*S, '出 战', TH.danger)
  }

  // ===== 战斗（智龙迷城布局：上怪物 → 技能栏 → 血条 → 棋盘） =====
  rBattle() {
    // ===== 布局计算 =====
    const padX = 8*S
    const cellSize = (W - padX*2) / COLS
    const boardH = ROWS * cellSize
    // 从底部向上排：底部留10*S → 棋盘 → 血条区 → 技能栏 → 怪物区（填满上方空间）
    const bottomPad = 10*S
    const boardTop = H - bottomPad - boardH
    const hpBarH = 28*S       // 血条区高度
    const skillBarH = 54*S    // 技能图标栏高度
    const hpBarTop = boardTop - hpBarH
    const skillBarTop = hpBarTop - skillBarH
    const enemyAreaBottom = skillBarTop  // 怪物区底部
    const enemyAreaTop = safeTop        // 怪物区顶部

    // ===== 1. 背景 =====
    const themeBg = this.curLevel ? this.curLevel.bg : 'theme_metal'
    R.drawBattleBg(this.af, themeBg)

    // ===== 2. 怪物区（上半部分，占满到技能栏上方） =====
    // 用主题背景覆盖怪物区（不同关卡不同色调）
    R.drawEnemyAreaBg(this.af, themeBg, 0, enemyAreaBottom)

    // 顶部按钮（退出/回合/难度）
    ctx.fillStyle='rgba(0,0,0,0.35)'; R.rr(8*S, enemyAreaTop+4*S, 42*S, 22*S, 11*S); ctx.fill()
    ctx.fillStyle=TH.text; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('退出', 29*S, enemyAreaTop+15*S)
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign='right'; ctx.fillText(`回合 ${this.turnCount}`, W-12*S, enemyAreaTop+15*S)
    if (this.curLevel) {
      if (this.curLevel.tutorial) {
        // 新手引导：显示关卡标题
        ctx.fillStyle='#ffd700'; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign='center'; ctx.fillText(`引导 ${this.curLevel.tutorial}/5`, W/2, enemyAreaTop+15*S)
      } else {
        const d = DIFFICULTY[this.curLevel.difficulty]
        ctx.fillStyle=d.color; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign='center'; ctx.fillText(d.name, W/2, enemyAreaTop+15*S)
      }
    }

    // 怪物立绘（居中，占满怪物区）
    if (this.curLevel) {
      const eAreaH = enemyAreaBottom - enemyAreaTop - 28*S  // 留出顶部按钮空间
      const eCenterY = enemyAreaTop + 28*S + eAreaH * 0.45
      const eSize = Math.min(eAreaH * 0.8, 200*S)
      R.drawBattleEnemyFull(W/2, eCenterY, eSize, this.curLevel.enemy.attr, this.enemyHp, this.enemyMaxHp, this.curLevel.enemy.name, this.curLevel.enemy.avatar, this.af, this.enemyHurtAnim, this._enemyHpLoss)
      // combo显示在怪物区
      if (this.combo > 0 && (this.bState === 'elimAnim' || this.bState === 'dropping' || this.bState === 'preAttack')) {
        const comboScale = 1 + 0.08 * Math.sin(this.af * 0.1)
        const fontSize = Math.min(24, 16 + this.combo) * S * comboScale
        ctx.fillStyle = TH.accent; ctx.font = `bold ${fontSize}px "PingFang SC",sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
        ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3*S
        ctx.strokeText(`${this.combo} Combo!`, 12*S, enemyAreaBottom - 14*S)
        ctx.fillText(`${this.combo} Combo!`, 12*S, enemyAreaBottom - 14*S)
      }
    }

    // ===== 3. 技能图标栏（左侧角色头像 + 右侧装备技能图标） =====
    R.drawSkillBar(0, skillBarTop, W, skillBarH, this.storage.equipped, this.skillTriggers, this.af, this.curLevel ? this.curLevel.theme : null)
    // 保存技能栏区域用于触摸检测
    this._skillBarArea = { y: skillBarTop, h: skillBarH }

    // ===== 4. 人物血条 =====
    R.drawHeroHpBar(0, hpBarTop, W, hpBarH, this.heroHp, this.heroMaxHp, this.af, this._heroHpLoss)

    // ===== 5. 棋盘 =====
    this._drawBoard(boardTop)

    // ===== 6. 绝技蓄力（集成在技能图标栏，点击触发） =====
    const equipped = this.storage.equipped
    const eqList = Object.keys(equipped).map(slot => equipped[slot]).filter(e => e)
    if (eqList.length > 0) {
      this._ultIconArea = { y: skillBarTop, h: skillBarH, count: eqList.length, list: eqList }
    } else {
      this._ultIconArea = null
    }

    // ===== 7. 技能释放特效 =====
    R.drawSkillCast(this.skillCastAnim, this.af)

    // 飘字/特效
    this.dmgFloats.forEach(f => R.drawDmgFloat(f.x,f.y,f.text,f.color,f.alpha,f.scale))
    this.skillEffects.forEach(e => R.drawSkillEffect(e.x,e.y,e.text,e.color,e.alpha))

    // ===== 阶段过渡提示 =====
    if (this.bState === 'preAttack' || this.bState === 'preEnemy' || (this.bState === 'enemyTurn' && this._enemyTurnWait)) {
      const t = this._stateTimer || 0
      let label = '', color = TH.accent
      if (this.bState === 'preAttack') {
        label = '⚔️ 攻击!'
        color = '#ffd700'
      } else if (this.bState === 'preEnemy') {
        label = '🛡️ 敌方回合'
        color = '#ff6b6b'
      } else {
        label = '⏳ 你的回合'
        color = '#4dcc4d'
      }
      // 弹入动画：从大到正常，带透明度
      const maxT = this.bState === 'preAttack' ? 20 : this.bState === 'preEnemy' ? 30 : 36
      const progress = Math.min(1, t / (maxT * 0.4))   // 前40%的时间做弹入
      const scale = 1 + (1 - progress) * 0.5
      const alpha = Math.min(1, t / 8) * (t > maxT * 0.7 ? Math.max(0, 1 - (t - maxT*0.7)/(maxT*0.3)) : 1)
      ctx.save(); ctx.globalAlpha = alpha
      ctx.fillStyle = color; ctx.font = `bold ${Math.round(20*S*scale)}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3*S
      const tipY = enemyAreaBottom - 40*S
      ctx.strokeText(label, W/2, tipY)
      ctx.fillText(label, W/2, tipY)
      ctx.restore()
    }

    // 属性面板
    if (this.statPanel && this.statPanel.visible) this._drawStatPanel()

    // 掉落弹窗
    if (this.dropPopup) {
      R.drawDropPopup(30*S,H*0.2,W-60*S,H*0.45,this.dropPopup,this.af)
      const btnY = H*0.2+H*0.45-44*S
      R.drawBtn(40*S,btnY,100*S,34*S,'佩戴',TH.success)
      R.drawBtn(W-140*S,btnY,100*S,34*S,'暂存',TH.info)
    }

    // 新手引导面板
    if (this._tutorialTip && this._tutorialTip.visible) {
      this._drawTutorialPanel()
    }

    // 胜负
    if (this.bState === 'victory') this._drawVictory()
    if (this.bState === 'defeat') this._drawDefeat()
  }

  _drawVictory() {
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${36*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎉 胜利!',W/2,H*0.22)
    ctx.fillStyle=TH.text; ctx.font=`${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(`回合: ${this.turnCount}  Combo: ${this.combo}`,W/2,H*0.29)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
    ctx.fillText('── 战利品 ──',W/2,H*0.35)
    ctx.fillStyle='#ffd700'; ctx.font=`bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText(`💰 +${this.battleGold||200} 灵石`,W/2,H*0.41)
    const drops = this.tempEquips || []
    if (drops.length > 0) {
      ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`获得法宝 ×${drops.length}`,W/2,H*0.47)
      const iconSz = 42*S, gap = 8*S
      const totalW = drops.length * iconSz + (drops.length-1) * gap
      let startX = (W - totalW) / 2
      const iconY = H*0.50
      drops.forEach(eq => {
        const q = QUALITY[eq.quality]
        const a = ATTR_COLOR[eq.attr] || BEAD_ATTR_COLOR[eq.attr]
        ctx.fillStyle = 'rgba(20,20,40,0.9)'
        R.rr(startX, iconY, iconSz, iconSz, 6*S); ctx.fill()
        ctx.strokeStyle = q.color; ctx.lineWidth = 2*S
        R.rr(startX, iconY, iconSz, iconSz, 6*S); ctx.stroke()
        if (a) { ctx.fillStyle = a.main; R.rr(startX+2*S, iconY+2*S, 3*S, iconSz-4*S, 1.5*S); ctx.fill() }
        const eqIcon = R.getImg(`assets/equipment/icon_${eq.slot}_${eq.attr}.jpg`)
        if (eqIcon && eqIcon.width > 0) {
          ctx.drawImage(eqIcon, startX+4*S, iconY+4*S, iconSz-8*S, iconSz-8*S)
        } else {
          const slot = EQUIP_SLOT[eq.slot]
          ctx.fillStyle = '#fff'; ctx.font = `${20*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(slot.icon, startX+iconSz/2, iconY+iconSz/2)
        }
        ctx.fillStyle = q.color; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillText(q.name, startX+iconSz/2, iconY+iconSz+2*S)
        startX += iconSz + gap
      })
    } else {
      ctx.fillStyle=TH.dim; ctx.font=`${12*S}px "PingFang SC",sans-serif`
      ctx.fillText('本局未获得法宝',W/2,H*0.50)
    }
    const btnW = 130*S, gap2 = 16*S, btnY2 = H*0.68
    R.drawBtn(W/2-btnW-gap2/2, btnY2, btnW, 40*S, '继续闯关', TH.success)
    R.drawBtn(W/2+gap2/2, btnY2, btnW, 40*S, '回到首页', TH.info)
  }

  _drawDefeat() {
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H)
    ctx.fillStyle=TH.danger; ctx.font=`bold ${36*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('💀 失败',W/2,H*0.22)
    ctx.fillStyle=TH.sub; ctx.font=`${13*S}px "PingFang SC",sans-serif`
    ctx.fillText('道心不灭，再战！', W/2, H*0.29)
    const lost = this.lostEquips || []
    if (lost.length > 0) {
      ctx.fillStyle=TH.danger; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
      ctx.fillText('── 战败失去法宝 ──',W/2,H*0.36)
      const iconSz = 42*S, gap3 = 8*S
      const totalW2 = lost.length * iconSz + (lost.length-1) * gap3
      let sx = (W - totalW2) / 2
      const iy = H*0.40
      lost.forEach(eq => {
        const q = QUALITY[eq.quality]
        ctx.fillStyle = 'rgba(40,10,10,0.9)'
        R.rr(sx, iy, iconSz, iconSz, 6*S); ctx.fill()
        ctx.strokeStyle = TH.danger+'88'; ctx.lineWidth = 2*S
        R.rr(sx, iy, iconSz, iconSz, 6*S); ctx.stroke()
        ctx.save(); ctx.globalAlpha = 0.4
        const eqIcon = R.getImg(`assets/equipment/icon_${eq.slot}_${eq.attr}.jpg`)
        if (eqIcon && eqIcon.width > 0) {
          ctx.drawImage(eqIcon, sx+4*S, iy+4*S, iconSz-8*S, iconSz-8*S)
        } else {
          const slot = EQUIP_SLOT[eq.slot]
          ctx.fillStyle = '#fff'; ctx.font = `${20*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(slot.icon, sx+iconSz/2, iy+iconSz/2)
        }
        ctx.restore()
        ctx.fillStyle = TH.danger; ctx.font = `bold ${24*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('✕', sx+iconSz/2, iy+iconSz/2)
        ctx.fillStyle = TH.dim; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillText(q.name, sx+iconSz/2, iy+iconSz+2*S)
        sx += iconSz + gap3
      })
      ctx.fillStyle=TH.danger; ctx.font=`${11*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'
      ctx.fillText(`战败惩罚：失去本局获得的 ${lost.length} 件法宝`, W/2, H*0.40+iconSz+16*S)
    }
    const btnW2 = 130*S, gap4 = 16*S, btnY3 = H*0.65
    R.drawBtn(W/2-btnW2-gap4/2, btnY3, btnW2, 40*S, '重新挑战', TH.danger)
    R.drawBtn(W/2+gap4/2, btnY3, btnW2, 40*S, '回到首页', TH.info)
  }

  // ===== 棋盘绘制（智龙迷城转珠版） =====
  _drawBoard(topY) {
    const padX = 8*S
    this.cellSize = (W-padX*2)/COLS
    this.boardX = padX; this.boardY = topY
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    ctx.fillStyle='rgba(10,10,25,0.7)'
    R.rr(bx-4*S,by-4*S,cs*COLS+8*S,cs*ROWS+8*S,10*S); ctx.fill()

    // 计算交换动画偏移
    const swapOffsets = {}
    if (this.swapAnim) {
      const sa = this.swapAnim
      const p = sa.progress
      const ease = sa.revert ? (1 - p) : p
      const dx = (sa.c2 - sa.c1) * cs * ease
      const dy = (sa.r2 - sa.r1) * cs * ease
      swapOffsets[`${sa.r1}_${sa.c1}`] = { dx, dy }
      swapOffsets[`${sa.r2}_${sa.c2}`] = { dx: -dx, dy: -dy }
    }

    // 绘制珠子
    for (let r=0; r<ROWS; r++) {
      for (let c=0; c<COLS; c++) {
        const cell = this.board[r]?.[c]
        if (!cell) continue
        // 正在被拖拽的珠子不在原位绘制
        if (this.dragging && r === this.dragR && c === this.dragC) continue
        let cx = bx + c*cs + cs/2
        let cy = by + r*cs + cs/2
        const offset = swapOffsets[`${r}_${c}`]
        if (offset) { cx += offset.dx; cy += offset.dy }
        // 消除闪烁动画
        if (cell._elim) {
          const flashP = this.elimAnimTimer / 24  // 0→1
          const flash = Math.sin(flashP * Math.PI * 4)  // 快速闪烁
          const scale = 1 + 0.15 * flash
          const alpha = 1 - flashP * 0.6
          ctx.save()
          ctx.globalAlpha = Math.max(0.2, alpha)
          R.drawBead(cx, cy, cs * 0.48 * scale, cell._attr, this.af)
          // 白色闪光叠加
          if (flash > 0) {
            ctx.globalAlpha = flash * 0.5 * alpha
            ctx.fillStyle = '#fff'
            ctx.beginPath(); ctx.arc(cx, cy, cs * 0.48 * scale, 0, Math.PI * 2); ctx.fill()
          }
          ctx.restore()
        } else {
          const attr = typeof cell === 'string' ? cell : cell
          R.drawBead(cx,cy,cs*0.48,attr,this.af)
          // 封灵标记：被封锁的灵珠叠加锁链效果
          if (this._sealedBeads && this._sealedBeads.some(s => s.r === r && s.c === c)) {
            ctx.save()
            ctx.globalAlpha = 0.6 + 0.2 * Math.sin(this.af * 0.1)
            ctx.fillStyle = 'rgba(80,0,120,0.4)'
            ctx.beginPath(); ctx.arc(cx, cy, cs*0.48, 0, Math.PI*2); ctx.fill()
            ctx.strokeStyle = '#b366ff'; ctx.lineWidth = 2*S
            ctx.beginPath(); ctx.arc(cx, cy, cs*0.48, 0, Math.PI*2); ctx.stroke()
            ctx.fillStyle = '#fff'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('封', cx, cy)
            ctx.restore()
          }
        }
      }
    }

    // ===== 绘制拖拽中的珠子（跟随手指，放大显示） =====
    if (this.dragging && this.dragAttr) {
      ctx.save()
      ctx.globalAlpha = 0.85
      R.drawBead(this.dragCurX, this.dragCurY, cs*0.55, this.dragAttr, this.af)
      ctx.restore()

      // ===== 拖拽倒计时进度条（棋盘上方） =====
      const timeLeft = Math.max(0, 1 - this.dragTimer / this.dragTimeLimit)
      const barW = cs*COLS, barH = 4*S
      const barX = bx, barY2 = by - 8*S
      // 背景
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      R.rr(barX, barY2, barW, barH, barH/2); ctx.fill()
      // 填充（绿→黄→红）
      const barColor = timeLeft > 0.5 ? TH.success : timeLeft > 0.2 ? TH.hard : TH.danger
      ctx.fillStyle = barColor
      R.rr(barX, barY2, barW * timeLeft, barH, barH/2); ctx.fill()
      // 时间不足时闪烁警告
      if (timeLeft < 0.3) {
        ctx.save()
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(this.af * 0.15)
        ctx.strokeStyle = TH.danger; ctx.lineWidth = 2*S
        R.rr(bx-4*S, by-4*S, cs*COLS+8*S, cs*ROWS+8*S, 10*S); ctx.stroke()
        ctx.restore()
      }
    }
  }

  // ===== 触摸处理 =====
  onTouch(type, e) {
    const t = e.touches[0] || e.changedTouches[0]
    if (!t) return
    const x = t.clientX * (W/wx.getSystemInfoSync().windowWidth)
    const y = t.clientY * (H/wx.getSystemInfoSync().windowHeight)

    switch(this.scene) {
      case 'intro':         this.tIntro(type,x,y); break
      case 'home':          this.tHome(type,x,y); break
      case 'battlePrepare': this.tBattlePrepare(type,x,y); break
      case 'battle':        this.tBattle(type,x,y); break
    }
  }

  tIntro(type,x,y) {
    if (type !== 'end') return
    const btnW = 180*S, btnH = 48*S
    const btnX = (W-btnW)/2, btnY = H-120*S
    if (this._hitRect(x,y,btnX,btnY,btnW,btnH)) {
      this._startBattle(this.storage.currentLevel, 'normal')
    }
  }

  tHome(type,x,y) {
    if (type !== 'end') return
    const m = 16*S
    const cardY = safeTop+60*S, cardH = 80*S
    const lvY = cardY+cardH+20*S, lvH = 170*S
    const btnW = 160*S, btnH = 44*S
    const btnX = (W-btnW)/2, btnY = lvY+lvH+20*S
    // 重置数据按钮（与渲染坐标一致）
    const statY = btnY+btnH+24*S
    const resetW = 80*S, resetH = 30*S
    const resetX = W-m-resetW, resetY = statY+20*S
    if (this._hitRect(x,y,resetX,resetY,resetW,resetH)) {
      console.log('[tHome] 重置按钮被点击')
      this.storage.resetAll()
      this.scene = 'intro'
      return
    }
    if (this._hitRect(x,y,btnX,btnY,btnW,btnH)) {
      this._startBattle(this.storage.currentLevel, 'normal')
      return
    }
  }

  tBattlePrepare(type,x,y) {
    if (type !== 'end') return
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    const eqH = 46*S, startY=safeTop+56*S
    const eqY = startY+116*S
    const totalRows = Math.ceil(Object.keys(EQUIP_SLOT).length / 2)
    const infoY = eqY+20*S + totalRows*(eqH+6*S) + 10*S
    if (this._hitRect(x,y,W/2-55*S,infoY+30*S,110*S,40*S)) {
      this._enterBattle()
    }
  }

  // ===== 战斗触摸（新布局版） =====
  tBattle(type,x,y) {
    // 新手引导面板：点击关闭
    if (this._tutorialTip && this._tutorialTip.visible) {
      if (type === 'end') { this._tutorialTip.visible = false }
      return
    }
    // 属性面板
    if (this.statPanel && this.statPanel.visible) {
      if (type === 'end') { this.statPanel = null }
      return
    }
    // 掉落弹窗
    if (this.dropPopup) {
      if (type !== 'end') return
      const btnY = H*0.2+H*0.45-44*S
      if (this._hitRect(x,y,40*S,btnY,100*S,34*S)) {
        const eq = this.dropPopup
        if (!this.storage.inventory.find(e => e.uid === eq.uid)) {
          this.storage.addToInventory(eq)
        }
        this.storage.equipItem(eq.uid)
        this.tempEquips.push(eq)
        this.dropPopup = null
      } else if (this._hitRect(x,y,W-140*S,btnY,100*S,34*S)) {
        const eq = this.dropPopup
        if (!this.storage.inventory.find(e => e.uid === eq.uid)) {
          this.storage.addToInventory(eq)
        }
        this.tempEquips.push(eq)
        this.dropPopup = null
      }
      return
    }
    // 胜利按钮
    if (this.bState === 'victory') {
      if (type !== 'end') return
      const btnW = 130*S, gap = 16*S, btnY = H*0.68
      if (this._hitRect(x,y, W/2-btnW-gap/2, btnY, btnW, 40*S)) {
        this.bState = 'none'
        this._startBattle(this.storage.currentLevel, 'normal')
      } else if (this._hitRect(x,y, W/2+gap/2, btnY, btnW, 40*S)) {
        this._cleanupBattle(); this.scene = 'home'
      }
      return
    }
    // 失败按钮
    if (this.bState === 'defeat') {
      if (type !== 'end') return
      const btnW = 130*S, gap = 16*S, btnY = H*0.65
      const savedLevelId = this.curLevel ? this.curLevel.levelId : this.storage.currentLevel
      const savedDiff = this.curLevel ? (this.curLevel.difficulty || 'normal') : 'normal'
      if (this._hitRect(x,y, W/2-btnW-gap/2, btnY, btnW, 40*S)) {
        this.bState = 'none'
        this._startBattle(savedLevelId, savedDiff)
      } else if (this._hitRect(x,y, W/2+gap/2, btnY, btnW, 40*S)) {
        this._cleanupBattle(); this.scene = 'home'
      }
      return
    }
    // 退出按钮
    if (type === 'end' && this._hitRect(x,y,8*S,safeTop+4*S,42*S,22*S)) {
      this._cleanupBattle(); this.scene = 'home'; return
    }
    // 技能栏区域的绝技点击释放（蓄力满后点击即释放）
    if (this._ultIconArea && this.bState === 'playerTurn') {
      const ua = this._ultIconArea
      const eqList = ua.list
      const iconSize = 40*S
      const gap2 = 5*S
      const heroSize = ua.h - 6*S
      const heroPad = 6*S
      const dividerGap = 8*S
      const divX = heroPad + heroSize + dividerGap
      const skillStartBase = divX + dividerGap
      const skillAreaW = W - skillStartBase - 6*S
      const actualGap = eqList.length > 1
        ? Math.min(gap2, (skillAreaW - eqList.length * iconSize) / (eqList.length - 1))
        : 0
      const skillsTotalW = eqList.length * iconSize + Math.max(0, eqList.length-1) * actualGap
      const skillStartX2 = skillStartBase + (skillAreaW - skillsTotalW) / 2
      const iconY2 = ua.y + (ua.h - iconSize) / 2

      if (type === 'end') {
        for (let i=0; i<eqList.length; i++) {
          const ix = skillStartX2 + i*(iconSize + actualGap)
          if (this._hitRect(x, y, ix, iconY2, iconSize, iconSize)) {
            const eq = eqList[i]
            const cur = this.skillTriggers[eq.attr] || 0
            if (cur >= eq.ultTrigger) {
              this._triggerUlt(eq)
            }
            return
          }
        }
      }
    }

    // 点击怪物区查看属性
    if (type === 'end' && this.bState !== 'none' && this.bState !== 'victory' && this.bState !== 'defeat') {
      const padX2 = 8*S
      const cs2 = (W - padX2*2) / COLS
      const brdH2 = ROWS * cs2
      const brdTop2 = H - 10*S - brdH2
      const skillBarTop2 = brdTop2 - 28*S - 54*S
      if (y < skillBarTop2 && y > safeTop + 30*S) {
        this.statPanel = { type:'enemy', visible:true }; return
      }
    }
    // 技能栏点击查看人物属性（点击血条区域）
    if (type === 'end' && this.bState !== 'none' && this.bState !== 'victory' && this.bState !== 'defeat') {
      const padX2 = 8*S
      const cs2 = (W - padX2*2) / COLS
      const brdH2 = ROWS * cs2
      const brdTop2 = H - 10*S - brdH2
      const hpTop = brdTop2 - 28*S
      if (y >= hpTop && y < brdTop2) {
        this.statPanel = { type:'hero', visible:true }; return
      }
    }

    // ===== 智龙迷城式转珠交互 =====
    if (this.bState !== 'playerTurn' || this.swapAnim) return
    const cs = this.cellSize, bx = this.boardX, by = this.boardY

    if (type === 'start') {
      const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
      if (r>=0 && r<ROWS && c>=0 && c<COLS && this.board[r]?.[c]) {
        // 封灵检查：被封锁的灵珠不能拖动
        if (this._sealedBeads && this._sealedBeads.some(s => s.r === r && s.c === c)) return
        this.dragging = true
        this.dragR = r; this.dragC = c
        this.dragStartX = x; this.dragStartY = y
        this.dragCurX = x; this.dragCurY = y
        this.dragAttr = typeof this.board[r][c] === 'string' ? this.board[r][c] : this.board[r][c]
        this.dragTimer = 0  // 重置拖拽计时器
      }
    } else if (type === 'move' && this.dragging) {
      this.dragCurX = x; this.dragCurY = y
      const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
      if (r>=0 && r<ROWS && c>=0 && c<COLS) {
        if (r !== this.dragR || c !== this.dragC) {
          const t = this.board[this.dragR][this.dragC]
          this.board[this.dragR][this.dragC] = this.board[r][c]
          this.board[r][c] = t
          this.dragR = r; this.dragC = c
        }
      }
    } else if (type === 'end' && this.dragging) {
      this.dragging = false
      this.dragAttr = null
      this.dragTimer = 0
      this._checkAndElim()
    }
  }

  // ===== 战斗逻辑 =====
  _cleanupBattle() {
    this.bState = 'none'
    this.curLevel = null
    this.dragging = false; this.dragAttr = null; this.dragTimer = 0
    this.elimQueue = []; this.elimAnimCells = null; this.elimAnimTimer = 0
    this.dropAnimTimer = 0; this.dropAnimCols = null
    this.swapAnim = null; this.ultSwipe = null; this._ultIconArea = null
    this._stateTimer = 0; this._enemyTurnWait = false
    this._pendingDmgMap = null; this._pendingHeal = 0
    this.pendingUlt = null; this.dropPopup = null; this.statPanel = null
    this.dmgFloats = []; this.skillEffects = []
    this.skillTriggers = {}; this.ultReady = {}
    this.heroBuffs = []; this.enemyBuffs = []
    this._sealedBeads = null
    this._tutorialTip = null
    this.heroAttackAnim.active = false; this.heroAttackAnim.progress = 0
    this.enemyHurtAnim.active = false; this.enemyHurtAnim.progress = 0
    this.heroHurtAnim.active = false; this.heroHurtAnim.progress = 0
    this.enemyAttackAnim.active = false; this.enemyAttackAnim.progress = 0
    this.skillCastAnim.active = false; this.skillCastAnim.progress = 0
    this._enemyHpLoss = null; this._heroHpLoss = null
    this.shakeT = 0; this.shakeI = 0
    this.combo = 0; this.turnCount = 0; this.elimSets = []
    this.board = []; this.tempEquips = []; this.lostEquips = []; this.battleGold = 0
    this._victoryHandled = false
  }

  _startBattle(levelId, difficulty) {
    this._cleanupBattle()
    this.curLevel = getLevelData(levelId, difficulty)
    if (!this.curLevel) { this.curLevel = getLevelData(ALL_LEVELS[0].levelId, 'normal') }
    this.goTo('battlePrepare')
  }

  _enterBattle() {
    this._victoryHandled = false   // 重置胜利标志
    const lv = this.curLevel
    const stats = this.storage.getHeroStats()
    this.enemyHp = lv.enemy.hp; this.enemyMaxHp = lv.enemy.hp
    this.heroHp = stats.hp; this.heroMaxHp = stats.hp; this.heroShield = 0
    this.heroStats = { ...stats }
    // 怪物属性：拷贝五行攻防
    const es = { hp: lv.enemy.hp, stamina: lv.enemy.stamina || lv.enemy.hp, recovery: lv.enemy.recovery || 0 }
    ATTRS.forEach(a => {
      es[ATK_KEY[a]] = lv.enemy[ATK_KEY[a]] || 0
      es[DEF_KEY[a]] = lv.enemy[DEF_KEY[a]] || 0
    })
    this.enemyStats = es
    this.heroBuffs = []; this.enemyBuffs = []
    this.combo = 0; this.turnCount = 1
    this.skillTriggers = {}; this.ultReady = {}
    this.pendingUlt = null; this.tempEquips = []; this.lostEquips = []; this.dropPopup = null; this.battleGold = 0
    this.dmgFloats = []; this.skillEffects = []
    this.statPanel = null
    this.heroAttackAnim = { active:false, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:false, progress:0, duration:18 }
    this.heroHurtAnim   = { active:false, progress:0, duration:18 }
    this.enemyAttackAnim= { active:false, progress:0, duration:20 }
    this.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
    this._enemyHpLoss = null; this._heroHpLoss = null
    this._initBoard()
    this.bState = 'playerTurn'
    this.scene = 'battle'
    // 新手引导：进入战斗时弹出教学面板
    this._tutorialTip = null
    if (lv.tutorial && TUTORIAL_TIPS[lv.tutorial]) {
      this._tutorialTip = { ...TUTORIAL_TIPS[lv.tutorial], step: lv.tutorial, visible: true }
    }
    this.dragging = false; this.dragAttr = null
    this.dragTimer = 0; this.dragTimeLimit = 4 * 60  // 4秒（60fps），拖拽时间限制
    this.elimQueue = []; this.elimAnimCells = null; this.elimAnimTimer = 0
    this.dropAnimTimer = 0; this.dropAnimCols = null
    this.swapAnim = null; this.ultSwipe = null
    this._stateTimer = 0; this._enemyTurnWait = false; this._pendingDmgMap = null; this._pendingHeal = 0
  }

  _initBoard() {
    const weights = this.curLevel?.beadWeights || { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 }
    const pool = []
    BEAD_ATTRS.forEach(a => { const w = (weights[a] != null) ? weights[a] : 10; for(let i=0;i<w;i++) pool.push(a) })
    this.board = []
    for (let r=0; r<ROWS; r++) {
      this.board[r] = []
      for (let c=0; c<COLS; c++) {
        let attr
        do {
          attr = pool[Math.floor(Math.random()*pool.length)]
        } while (this._wouldMatch(r,c,attr))
        this.board[r][c] = attr
      }
    }
  }

  _wouldMatch(r,c,attr) {
    if (c>=2 && this.board[r][c-1]===attr && this.board[r][c-2]===attr) return true
    if (r>=2 && this.board[r-1]?.[c]===attr && this.board[r-2]?.[c]===attr) return true
    return false
  }

  _swapBeads(r1,c1,r2,c2) {
    const t = this.board[r1][c1]
    this.board[r1][c1] = this.board[r2][c2]
    this.board[r2][c2] = t
  }

  // 在update中更新交换动画（仅用于连锁消除后的下落动画等）
  _updateSwapAnim() {
    if (!this.swapAnim) return
    const sa = this.swapAnim
    sa.progress += 1/sa.duration
    if (sa.progress >= 1) {
      if (sa.revert) {
        this.swapAnim = null
        this.bState = 'preEnemy'
        this._stateTimer = 0
      } else {
        this._swapBeads(sa.r1, sa.c1, sa.r2, sa.c2)
        this.swapAnim = null
        this._checkAndElim()
      }
    }
  }

  // 智龙迷城版：松手后检查消除（逐组消除版）
  _checkAndElim() {
    const sets = this._findMatchesSeparate()
    if (sets.length > 0) {
      // 首次松手时初始化
      if (this.bState === 'playerTurn') {
        this.combo = 0
        this._pendingDmgMap = {}   // { attr: baseDmgTotal } 累计每属性基础伤害
        this._pendingHeal = 0     // 累计回复量
      }
      this.elimQueue = sets
      this.bState = 'elimAnim'
      this._startNextElimAnim()
    } else if (this.combo > 0) {
      // 连锁结束（掉落后没有新消除了），进入攻击阶段
      this.bState = 'preAttack'
      this._stateTimer = 0
    } else {
      // 无消除 = 回合结束（没有任何combo）
      this.bState = 'preEnemy'
      this._stateTimer = 0
    }
  }

  // 开始下一组消除动画
  _startNextElimAnim() {
    if (this.elimQueue.length === 0) {
      // 所有组消完，进入掉落阶段
      this.bState = 'dropping'
      this.dropAnimTimer = 0
      this._fillBoard()
      this.dropAnimCols = this._getDropInfo()
      return
    }
    const group = this.elimQueue.shift()
    this.combo++
    // 开始闪烁动画
    this.elimAnimCells = group
    this.elimAnimTimer = 0
    // 标记珠子为消除状态
    group.cells.forEach(({r, c}) => {
      if (this.board[r] && this.board[r][c]) {
        this.board[r][c] = { _elim: true, _attr: group.attr }
      }
    })
    MusicMgr.playEliminate()
    this.shakeT = 4; this.shakeI = 3*S

    // ===== 立即计算本组消除的基础伤害，并在棋盘上飘出 =====
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    let sumX = 0, sumY = 0
    group.cells.forEach(({r, c}) => {
      sumX += bx + c * cs + cs / 2
      sumY += by + r * cs + cs / 2
    })
    const cx = sumX / group.cells.length
    const cy = sumY / group.cells.length
    const attrColor = BEAD_ATTR_COLOR[group.attr]?.main || TH.accent
    const heroS = this.heroStats || {}

    const attrLabel = BEAD_ATTR_NAME[group.attr] || ''

    if (group.attr === 'heart') {
      // 心珠回复 = 回复加成 × 消除倍率（与攻击公式一致）
      const elimMul = 1.0 + (group.count - 3) * 0.05
      const recovery = heroS.recovery || 10
      const baseHeal = Math.round(recovery * elimMul)
      if (!this._pendingHeal) this._pendingHeal = 0
      this._pendingHeal += baseHeal
      this.dmgFloats.push({ x: cx, y: cy, text: `回复 +${baseHeal}`, color: attrColor, alpha: 1, scale: 1.1, t: 0 })
    } else {
      // 攻击属性：基础伤害 = 攻击力 × 消除倍率
      // 消除倍率：3个=1.0，每多1个+0.05（弱化消除个数加成）
      const elimMul = 1.0 + (group.count - 3) * 0.05
      const atkKey = ATK_KEY[group.attr]
      const selfAtk = heroS[atkKey] || 10
      const baseDmg = Math.round(selfAtk * elimMul)

      if (!this._pendingDmgMap) this._pendingDmgMap = {}
      if (!this._pendingDmgMap[group.attr]) this._pendingDmgMap[group.attr] = 0
      this._pendingDmgMap[group.attr] += baseDmg

      // 在棋盘上飘出：属性名+数值，让新手看懂
      this.dmgFloats.push({ x: cx, y: cy, text: `${attrLabel}攻 ${baseDmg}`, color: attrColor, alpha: 1, scale: 1.1, t: 0 })
    }
  }

  // 在update中处理消除动画
  _processElim() {
    // 逐组消除动画阶段
    const ELIM_FLASH_FRAMES = 24  // 闪烁持续帧数
    this.elimAnimTimer++
    if (this.elimAnimTimer >= ELIM_FLASH_FRAMES) {
      // 闪烁结束，真正移除珠子
      if (this.elimAnimCells) {
        this.elimAnimCells.cells.forEach(({r, c}) => {
          this.board[r][c] = null
        })
        this.elimAnimCells = null
      }
      // 继续下一组
      this._startNextElimAnim()
    }
  }

  // 在update中处理掉落动画
  _processDropAnim() {
    const DROP_FRAMES = 12  // 掉落动画帧数
    this.dropAnimTimer++
    if (this.dropAnimTimer >= DROP_FRAMES) {
      this.dropAnimCols = null
      // 掉落完成，检测是否有连锁消除
      const newSets = this._findMatchesSeparate()
      if (newSets.length > 0) {
        this.elimQueue = newSets
        this.bState = 'elimAnim'
        this._startNextElimAnim()
      } else {
        // 没有新消除 → 进入攻击阶段
        this.bState = 'preAttack'
        this._stateTimer = 0
      }
    }
  }

  /**
   * 查找所有可消除的匹配组（每个连续3+相连的同色区域为一个独立组）
   * 返回数组：[{ attr, count, cells:[{r,c}] }, ...]
   * 同色不同位置的连通区域算不同combo
   */
  _findMatchesSeparate() {
    // 先标记所有参与3连的格子
    const marks = Array.from({length:ROWS}, () => Array(COLS).fill(false))
    // 横向检测
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS-3; c++) {
        const a = this._cellAttr(r, c)
        if (a && this._cellAttr(r, c+1) === a && this._cellAttr(r, c+2) === a) {
          let end = c+2
          while (end+1 < COLS && this._cellAttr(r, end+1) === a) end++
          for (let i = c; i <= end; i++) marks[r][i] = true
        }
      }
    }
    // 纵向检测
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS-3; r++) {
        const a = this._cellAttr(r, c)
        if (a && this._cellAttr(r+1, c) === a && this._cellAttr(r+2, c) === a) {
          let end = r+2
          while (end+1 < ROWS && this._cellAttr(end+1, c) === a) end++
          for (let i = r; i <= end; i++) marks[i][c] = true
        }
      }
    }
    // BFS找连通分量（每个同色连通区域是一个combo组）
    const visited = Array.from({length:ROWS}, () => Array(COLS).fill(false))
    const groups = []
    const dirs = [[0,1],[0,-1],[1,0],[-1,0]]
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!marks[r][c] || visited[r][c]) continue
        const attr = this._cellAttr(r, c)
        const cells = []
        const queue = [{r, c}]
        visited[r][c] = true
        while (queue.length > 0) {
          const cur = queue.shift()
          cells.push(cur)
          for (const [dr, dc] of dirs) {
            const nr = cur.r + dr, nc = cur.c + dc
            if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !visited[nr][nc] && marks[nr][nc] && this._cellAttr(nr, nc) === attr) {
              visited[nr][nc] = true
              queue.push({r: nr, c: nc})
            }
          }
        }
        groups.push({ attr, count: cells.length, cells })
      }
    }
    return groups
  }

  // 获取格子属性（兼容 _elim 标记对象和字符串）
  _cellAttr(r, c) {
    const cell = this.board[r]?.[c]
    if (!cell) return null
    if (typeof cell === 'object' && cell._elim) return cell._attr
    return cell
  }

  // 获取掉落信息（用于掉落动画）
  _getDropInfo() {
    // 这个在 _fillBoard 已经执行后调用
    // 返回 null 简化处理，掉落直接在 _fillBoard 中完成
    return true
  }

  /**
   * 消除等待结束后执行攻击
   * 伤害公式（策略优先级：属性克制 > Combo > 消除个数）：
   * 1. 消除时：基础伤害 = 攻击力 × 消除倍率（3个=1.0，每多1个+0.05）
   * 2. 全部消除完成后：combo倍率 = 1 + (combo-1) × 0.08
   * 3. 克制倍率：克制×1.5，被克×0.6，无关×1.0
   * 4. 每属性最终伤害 = (基础伤害总和 × combo倍率 - 敌方防御) × 克制倍率
   */
  _executeAttack() {
    const dmgMap = this._pendingDmgMap || {}
    const heal = this._pendingHeal || 0
    this._pendingDmgMap = null
    this._pendingHeal = 0
    this._applyFinalDamage(dmgMap, heal)
    if (this.bState === 'victory') return
    this._settle()
  }

  _fillBoard() {
    const weights = this.curLevel?.beadWeights || { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 }
    const pool = []
    BEAD_ATTRS.forEach(a => { const w = (weights[a] != null) ? weights[a] : 10; for(let i=0;i<w;i++) pool.push(a) })
    for(let c=0;c<COLS;c++) {
      let empty=0
      for(let r=ROWS-1;r>=0;r--) {
        if(!this.board[r][c]) empty++
        else if(empty>0) {
          this.board[r+empty][c]=this.board[r][c]; this.board[r][c]=null
        }
      }
      for(let r=0;r<empty;r++) {
        this.board[r][c] = pool[Math.floor(Math.random()*pool.length)]
      }
    }
  }

  /**
   * 最终伤害结算（新公式·属性克制优先）
   * dmgMap: { attr: baseDmgTotal } 消除阶段累计的每属性基础伤害
   * heal: 消除阶段累计的回复量
   *
   * 最终伤害 = Max((baseDmgTotal × comboMul - 敌方防御) × counterMul, 0)
   * comboMul = 1 + (combo-1) × 0.08
   * counterMul: 克制=1.5, 被克=0.6, 无关=1.0
   */
  _applyFinalDamage(dmgMap, heal) {
    const eCenterY = this._getEnemyCenterY()
    const charY = eCenterY
    const enemyS = this.enemyStats || {}
    const equipped = this.storage.equipped

    // combo倍率（减弱：0.15 → 0.08）
    const comboMul = 1 + Math.max(0, this.combo - 1) * 0.08

    // 计算每属性最终伤害
    const finalDmgByAttr = {}
    let hasCounter = null
    let hasCounterBy = null

    Object.entries(dmgMap).forEach(([attr, baseDmg]) => {
      // 基础伤害 × combo倍率
      let dmg = baseDmg * comboMul

      // 先减去敌方该属性防御
      const defKey = DEF_KEY[attr]
      const enemyDef = enemyS[defKey] || 0
      dmg -= enemyDef

      // 防御后再算五行克制（克制×1.5，被克×0.6，大幅强化属性策略）
      let counterMul = 1.0
      if (COUNTER_MAP[attr] === this.curLevel?.enemy?.attr) {
        counterMul = 1.5
        hasCounter = attr
      } else if (COUNTER_BY[attr] === this.curLevel?.enemy?.attr) {
        counterMul = 0.6
        hasCounterBy = attr
      }
      dmg *= counterMul

      const finalDmg = Math.max(0, Math.round(dmg))

      if (finalDmg > 0) {
        finalDmgByAttr[attr] = finalDmg
      }

      // 装备绝技充能（每有同属性消除就+1）
      Object.values(equipped).forEach(eq => {
        if (!eq || eq.attr !== attr) return
        if (!this.skillTriggers[attr]) this.skillTriggers[attr] = 0
        this.skillTriggers[attr]++
      })
    })

    // ===== 在怪物头上飘最终伤害数字 =====
    const attrKeys = Object.keys(finalDmgByAttr)
    if (attrKeys.length > 0) {
      // 记录掉血动画
      if (!this._enemyHpLoss) this._enemyHpLoss = { fromPct: this.enemyHp / this.enemyMaxHp, timer: 0 }

      // 扣血
      let totalDmg = 0
      attrKeys.forEach(attr => { totalDmg += finalDmgByAttr[attr] })
      this.enemyHp = Math.max(0, this.enemyHp - totalDmg)

      // 按属性分别飘伤害，带属性名说明
      const startY = charY - 30*S
      const yStep = 28*S
      attrKeys.forEach((attr, i) => {
        const attrColor = ATTR_COLOR[attr]?.main || TH.danger
        const attrLabel = ATTR_NAME[attr] || ''
        const dmg = finalDmgByAttr[attr]
        const offsetX = (Math.random() - 0.5) * 30*S
        this.dmgFloats.push({
          x: W*0.5 + offsetX,
          y: startY - i * yStep,
          text: `${attrLabel}攻 -${dmg}`,
          color: attrColor,
          alpha: 1,
          scale: 1.4,
          t: 0
        })
      })

      this.enemyHurtAnim = { active:true, progress:0, duration:18 }
      this.shakeT = 3; this.shakeI = 2*S
    } else if (Object.keys(dmgMap).length > 0) {
      // 有攻击属性但全部不破防
      this.dmgFloats.push({ x:W*0.5, y:charY-20*S, text:'被防御抵挡!', color:TH.dim, alpha:1, scale:0.8, t:0 })
    }

    // ===== 回复结算：基础回复 × combo倍率，受噬灵debuff影响 =====
    if (heal > 0) {
      let healMul = 1.0
      this.heroBuffs.forEach(b => {
        if (b.type === 'healRate') healMul *= b.val
      })
      const finalHeal = Math.round(heal * comboMul * healMul)
      const oldHeroHp = this.heroHp
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + finalHeal)
      const actualHeal = this.heroHp - oldHeroHp
      if (actualHeal > 0) {
        this.dmgFloats.push({ x:W*0.5, y:charY+40*S, text:`回复 +${actualHeal}`, color:TH.success, alpha:1, scale:1.1, t:0 })
      }
    }

    if (this.enemyHp <= 0) {
      this.bState = 'victory'
      this._onVictory()
    }
  }

  _triggerUlt(equip) {
    const sk = equip.ult
    const heroS = this.heroStats || {}
    const enemyS = this.enemyStats || {}
    const attr = equip.attr
    const charY = this._getEnemyCenterY()
    let hasEffect = false

    if (sk.dmg) {
      const atkKey = ATK_KEY[attr]
      const selfAtk = heroS[atkKey] || 10
      const skillCoeff = sk.dmg / 100
      let dmg = selfAtk * skillCoeff
      const defKey = DEF_KEY[attr]
      const enemyDef = enemyS[defKey] || 0
      dmg -= enemyDef
      // 绝技也享受属性克制加成（×1.5/×0.6）
      let counterMul = 1.0
      if (COUNTER_MAP[attr] === this.curLevel?.enemy?.attr) counterMul = 1.5
      else if (COUNTER_BY[attr] === this.curLevel?.enemy?.attr) counterMul = 0.6
      dmg *= counterMul
      const comboMul = 1 + Math.max(0, this.combo - 1) * 0.08
      dmg *= comboMul
      const finalDmg = Math.max(0, Math.round(dmg))
      if (finalDmg > 0) {
        const oldEPct = this.enemyHp / this.enemyMaxHp
        this.enemyHp = Math.max(0, this.enemyHp - finalDmg)
        this._enemyHpLoss = { fromPct: oldEPct, timer: 0 }
        this.dmgFloats.push({ x:W*0.5, y:charY-30*S, text:`-${finalDmg}`, color:TH.accent, alpha:1, scale:1.5, t:0 })
        this._playHeroAttack(sk.name, attr, 'burst')
        hasEffect = true
      }
    }
    if (sk.heal) {
      const healAmt = sk.heal + (heroS.recovery || 0)
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + healAmt)
      this.dmgFloats.push({ x:W*0.3, y:H*0.65, text:`+${healAmt} HP`, color:TH.success, alpha:1, scale:1.2, t:0 })
      this._playHealEffect(sk.name)
      hasEffect = true
    }
    if (sk.def) {
      const shieldAmt = sk.def
      this.heroShield = (this.heroShield || 0) + shieldAmt
      this.heroBuffs.push({ type:'shield', val:shieldAmt, dur: 3 })
      this.dmgFloats.push({ x:W*0.3, y:H*0.6, text:`+${shieldAmt} 护盾`, color:'#74c0fc', alpha:1, scale:1.3, t:0 })
      this._playShieldEffect(sk.name, attr)
      hasEffect = true
    }
    if (sk.debuff) {
      const debuffAmt = sk.debuff
      this.enemyBuffs.push({ type:'atkDown', val:debuffAmt, dur: 3 })
      this.dmgFloats.push({ x:W*0.5, y:charY+20*S, text:`-${debuffAmt} 攻击`, color:'#da77f2', alpha:1, scale:1.2, t:0 })
      this._playDebuffEffect(sk.name, attr)
      hasEffect = true
    }
    // 通用反馈：屏幕震动 + 音效
    this.shakeT = 12; this.shakeI = 8*S
    MusicMgr.playAttack()
    this.skillTriggers[equip.attr] = 0

    // 如果没有任何可见效果（理论上不该发生），至少播个通用特效
    if (!hasEffect) {
      this._playHeroAttack(sk.name, attr, 'slash')
    }

    if (this.enemyHp <= 0) { this.bState = 'victory'; this._onVictory() }
  }

  _settle() {
    if (this.enemyHp <= 0) { this.bState = 'victory'; this._onVictory(); return }
    // buff持续时间衰减
    this.heroBuffs = this.heroBuffs.filter(b => { b.dur--; return b.dur > 0 })
    this.enemyBuffs = this.enemyBuffs.filter(b => { b.dur--; return b.dur > 0 })
    // 封灵持续时间衰减
    if (this._sealedBeads) {
      this._sealedBeads = this._sealedBeads.filter(s => { s.dur--; return s.dur > 0 })
      if (this._sealedBeads.length === 0) this._sealedBeads = null
    }
    // 重新计算护盾（从剩余buff累计）
    this.heroShield = this.heroBuffs.filter(b => b.type === 'shield').reduce((s,b) => s + b.val, 0)
    this.bState = 'preEnemy'
    this._stateTimer = 0
  }

  _enemyTurn() {
    this.bState = 'enemyTurn'
    if (!this.curLevel) { this.bState = 'playerTurn'; this.turnCount++; return }
    const enemy = this.curLevel.enemy
    const charY = this._getEnemyCenterY()
    const heroS = this.heroStats || {}
    const enemyS = this.enemyStats || {}

    // ==== 普通攻击 ====
    const enemyAttr = enemy.attr
    const enemyAtkKey = ATK_KEY[enemyAttr]
    const heroDefKey = DEF_KEY[enemyAttr]
    let baseAtk = enemyS[enemyAtkKey] || 0
    // 应用敌方攻击buff（妖气暴涨等）
    this.enemyBuffs.forEach(b => {
      if (b.type === 'atkUp') baseAtk = Math.round(baseAtk * (1 + b.val))
    })
    let heroDef = heroS[heroDefKey] || 0
    // 应用英雄防御debuff（破甲爪等）
    this.heroBuffs.forEach(b => {
      if (b.type === 'def') heroDef = Math.round(heroDef * (1 - b.val))
    })
    let dmg = Math.max(0, baseAtk - heroDef)
    // 敌人身上的 atkDown debuff 减伤
    this.enemyBuffs.forEach(b => {
      if (b.type === 'atkDown') {
        dmg = Math.max(0, dmg - Math.round(b.val * 0.5))
      }
    })
    let totalDmg = Math.max(0, dmg - this.heroShield)
    if (totalDmg > 0) {
      const oldPct = this.heroHp / this.heroMaxHp
      this.heroHp = Math.max(0, this.heroHp - totalDmg)
      this._heroHpLoss = { fromPct: oldPct, timer: 0 }
      this.dmgFloats.push({ x:W*0.5, y:charY+40*S, text:`-${totalDmg}`, color:TH.danger, alpha:1, scale:1, t:0 })
      this.shakeT = 4; this.shakeI = 3*S
      MusicMgr.playAttack()
      this._playEnemyAttack(enemy.name+'攻击')
    }

    // ==== DOT持续伤害（毒瘴等） ====
    this.heroBuffs.forEach(b => {
      if (b.type === 'dot' && b.val > 0) {
        const oldPct = this.heroHp / this.heroMaxHp
        this.heroHp = Math.max(0, this.heroHp - b.val)
        this._heroHpLoss = { fromPct: oldPct, timer: 0 }
        this.dmgFloats.push({ x:W*0.5, y:charY+50*S, text:`-${b.val}`, color:'#b366ff', alpha:1, scale:0.9, t:0 })
        this.skillEffects.push({ x:W/2, y:charY-20*S, text:'毒伤', color:'#b366ff', alpha:1, t:0 })
      }
    })

    // ==== 敌方被动技能 ====
    if (enemy.skills) {
      enemy.skills.forEach(sk => {
        if (this.turnCount > 0 && this.turnCount % sk.triggerTurn === 0) {
          this._applyEnemySkill(sk)
        }
      })
    }

    // ==== 敌方绝技（固定回合触发） ====
    if (enemy.ults) {
      enemy.ults.forEach(ult => {
        if (this.turnCount > 0 && this.turnCount % ult.triggerTurn === 0) {
          this._applyEnemyUlt(ult)
        }
      })
    }

    if (this.heroHp <= 0) { this._onDefeat(); return }
    // 掉落（装备品质和等级受关卡层数限制）— 新手引导关不在回合中掉落
    if (!this.curLevel.tutorial && this.curLevel.dropRate && Math.random() < this.curLevel.dropRate * 0.3) {
      const stageIndex = this.curLevel.levelId % 100 || 1  // 层数1-10
      const drop = randomDrop(this.curLevel.tier, stageIndex)
      this.storage.addToInventory(drop)
      this.dropPopup = drop
      this.storage.updateTaskProgress('dt3', 1)
    }
    this.turnCount++
    this._stateTimer = 0
    this._enemyTurnWait = true
  }

  _applyEnemySkill(sk) {
    const charY = this._getEnemyCenterY()
    switch(sk.type) {
      case 'buff':
        // 妖气暴涨：实际增加敌方攻击力buff
        this.enemyBuffs.push({ type:'atkUp', val:sk.rate, dur:sk.dur })
        this.skillEffects.push({ x:W*0.5, y:charY-40*S, text:sk.name, color:TH.danger, alpha:1, t:0 })
        this._playEnemyAttack(sk.name)
        break
      case 'dot':
        // 毒瘴：给英雄添加持续伤害debuff（每回合结算）
        this.heroBuffs.push({ type:'dot', val:sk.val||20, dur:sk.dur||3 })
        this.skillEffects.push({ x:W*0.5, y:charY-40*S, text:sk.name+'!', color:'#b366ff', alpha:1, t:0 })
        this._playEnemyAttack(sk.name)
        break
      case 'aoe': {
        const oldPct2 = this.heroHp / this.heroMaxHp
        this.heroHp = Math.max(0, this.heroHp - (sk.val||100))
        this._heroHpLoss = { fromPct: oldPct2, timer: 0 }
        this.dmgFloats.push({ x:W*0.5, y:charY+40*S, text:`-${sk.val}`, color:TH.danger, alpha:1, scale:1.3, t:0 })
        this.shakeT = 8; this.shakeI = 6*S
        this._playEnemyAttack(sk.name)
        break
      }
      case 'seal': {
        // 封灵：随机封锁灵珠（标记为sealed，玩家无法拖动）
        const sealCount = sk.count || 2
        if (!this._sealedBeads) this._sealedBeads = []
        for (let i = 0; i < sealCount; i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          this._sealedBeads.push({ r, c, dur: sk.dur||2 })
        }
        this.skillEffects.push({ x:W/2, y:charY-30*S, text:'封灵!', color:'#b366ff', alpha:1, t:0 })
        this._playEnemyAttack(sk.name)
        break
      }
      case 'convert':
        for(let i=0;i<(sk.count||3);i++) {
          const r=Math.floor(Math.random()*ROWS), c=Math.floor(Math.random()*COLS)
          this.board[r][c] = BEAD_ATTRS[Math.floor(Math.random()*BEAD_ATTRS.length)]
        }
        this.skillEffects.push({ x:W/2, y:charY-30*S, text:'灵气紊乱!', color:TH.hard, alpha:1, t:0 })
        break
      case 'debuff':
        this.heroBuffs.push({ type:sk.field, val:sk.rate, dur:sk.dur })
        this.skillEffects.push({ x:W*0.5, y:charY-30*S, text:sk.name, color:TH.danger, alpha:1, t:0 })
        this._playEnemyAttack(sk.name)
        break
    }
  }

  /** 怪物绝技执行 */
  _applyEnemyUlt(ult) {
    const charY = this._getEnemyCenterY()
    const enemyS = this.enemyStats || {}
    const enemyAttr = this.curLevel?.enemy?.attr || 'metal'
    const selfAtk = enemyS[ATK_KEY[ult.attr === 'neutral' ? enemyAttr : ult.attr]] || enemyS[ATK_KEY[enemyAttr]] || 20

    // 显示绝技名称（大字特效）
    this.skillEffects.push({ x:W*0.5, y:charY-50*S, text:'【'+ult.name+'】', color:'#ff4466', alpha:1, t:0, scale:1.3 })
    this._playEnemyAttack(ult.name)
    this.shakeT = 10; this.shakeI = 8*S

    switch(ult.effect) {
      case 'dmg': {
        // 纯伤害绝技
        const dmg = Math.round(selfAtk * ult.pct / 100)
        this._dealUltDmgToHero(dmg, charY)
        break
      }
      case 'drain': {
        // 吸血绝技：造成伤害并回复自身
        const dmg = Math.round(selfAtk * ult.pct / 100)
        this._dealUltDmgToHero(dmg, charY)
        const heal = Math.round(dmg * 0.5)
        const enemyMaxHp = this.curLevel.enemy.hp
        this.enemyHp = Math.min(enemyMaxHp, this.enemyHp + heal)
        this.skillEffects.push({ x:W*0.5, y:charY-20*S, text:`回复+${heal}`, color:'#66ff66', alpha:1, t:0 })
        break
      }
      case 'dmg_convert': {
        // 伤害 + 转换灵珠
        const dmg = Math.round(selfAtk * ult.pct / 100)
        this._dealUltDmgToHero(dmg, charY)
        for (let i = 0; i < (ult.convertCount||4); i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          this.board[r][c] = BEAD_ATTRS[Math.floor(Math.random()*BEAD_ATTRS.length)]
        }
        this.skillEffects.push({ x:W/2, y:charY, text:'灵珠紊乱!', color:TH.hard, alpha:1, t:0 })
        break
      }
      case 'dmg_seal': {
        // 伤害 + 封锁灵珠
        const dmg = Math.round(selfAtk * ult.pct / 100)
        this._dealUltDmgToHero(dmg, charY)
        if (!this._sealedBeads) this._sealedBeads = []
        for (let i = 0; i < (ult.sealCount||3); i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          this._sealedBeads.push({ r, c, dur: ult.sealDur||2 })
        }
        this.skillEffects.push({ x:W/2, y:charY, text:'封印!', color:'#b366ff', alpha:1, t:0 })
        break
      }
      case 'dmg_dot': {
        // 伤害 + 附加持续灼烧
        const dmg = Math.round(selfAtk * ult.pct / 100)
        this._dealUltDmgToHero(dmg, charY)
        const dotVal = Math.round(selfAtk * ult.dotPct / 100)
        this.heroBuffs.push({ type:'dot', val:dotVal, dur:ult.dotDur||3 })
        this.skillEffects.push({ x:W/2, y:charY, text:'灼烧!', color:'#ff6622', alpha:1, t:0 })
        break
      }
      case 'selfBuff':
        // 自我增强
        this.enemyBuffs.push({ type:'atkUp', val:ult.rate, dur:ult.dur })
        this.skillEffects.push({ x:W*0.5, y:charY-20*S, text:'攻击强化!', color:'#ff4444', alpha:1, t:0 })
        break
      case 'selfHeal': {
        // 自我回复
        const enemyMaxHp = this.curLevel.enemy.hp
        const heal = Math.round(enemyMaxHp * ult.pct / 100)
        this.enemyHp = Math.min(enemyMaxHp, this.enemyHp + heal)
        this.skillEffects.push({ x:W*0.5, y:charY-20*S, text:`回复+${heal}`, color:'#66ff66', alpha:1, t:0 })
        break
      }
      case 'chaos': {
        // 混沌领域：全场灵珠打乱 + 减少回复
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            this.board[r][c] = BEAD_ATTRS[Math.floor(Math.random()*BEAD_ATTRS.length)]
          }
        }
        this.heroBuffs.push({ type:'healRate', val:ult.healRate||0.5, dur:ult.healDur||2 })
        this.skillEffects.push({ x:W/2, y:charY, text:'混沌领域!', color:'#ff22ff', alpha:1, t:0 })
        break
      }
    }
  }

  /** 绝技对英雄造成伤害（内部辅助） */
  _dealUltDmgToHero(dmg, charY) {
    let totalDmg = Math.max(0, dmg - this.heroShield)
    if (totalDmg > 0) {
      const oldPct = this.heroHp / this.heroMaxHp
      this.heroHp = Math.max(0, this.heroHp - totalDmg)
      this._heroHpLoss = { fromPct: oldPct, timer: 0 }
      this.dmgFloats.push({ x:W*0.5, y:charY+40*S, text:`-${totalDmg}`, color:'#ff2244', alpha:1, scale:1.4, t:0 })
    }
  }

  _onVictory() {
    if (this._victoryHandled) return   // 防止重复调用
    this._victoryHandled = true
    const lv = this.curLevel
    console.log('[Victory] levelId:', lv.levelId, 'difficulty:', lv.difficulty, 'currentLevel before:', this.storage.currentLevel)
    this.storage.passLevel(lv.levelId, lv.difficulty)
    console.log('[Victory] currentLevel after:', this.storage.currentLevel)
    this.storage.recordBattle(this.combo, this.storage.stats.totalSkills)
    this.storage.updateTaskProgress('dt1', 1)
    this.storage.checkAchievements({ combo: this.combo })
    this.battleGold = 200
    this.storage.gold += this.battleGold

    // 新手引导关固定掉落
    if (lv.tutorialDrop === 'helmet_green_no_ult') {
      // 第4关：绿装头盔，无绝技
      const enemyAttr = lv.enemy?.attr || 'earth'
      const helmet = generateEquipment('helmet', enemyAttr, 'green', 2)
      delete helmet.ult
      helmet.ultTrigger = 999
      this.storage.addToInventory(helmet)
      this.dropPopup = helmet
      this.tempEquips.push(helmet)
      this.storage.updateTaskProgress('dt3', 1)
    } else if (lv.tutorialDrop === 'trinket_green_with_ult') {
      // 第5关：绿装项链，带绝技
      const enemyAttr = lv.enemy?.attr || 'metal'
      const trinket = generateEquipment('trinket', enemyAttr, 'green', 2)
      this.storage.addToInventory(trinket)
      this.dropPopup = trinket
      this.tempEquips.push(trinket)
      this.storage.updateTaskProgress('dt3', 1)
    }
  }

  _onDefeat() {
    this.bState = 'defeat'
    this.lostEquips = [...(this.tempEquips || [])]
    this.lostEquips.forEach(eq => {
      this.storage.removeFromInventory(eq.uid)
    })
    this.tempEquips = []
  }

  // ===== 属性查看面板 =====
  _drawTutorialPanel() {
    const tip = this._tutorialTip
    if (!tip) return
    const m = 24*S, panelW = W - m*2
    const lineH = 20*S
    const panelH = 36*S + tip.tips.length * lineH + 40*S  // 标题+tips+底部提示
    const panelX = m, panelY = H*0.25

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)

    // 面板背景
    R.drawDarkPanel(panelX, panelY, panelW, panelH, 14*S)

    // 步骤标签
    ctx.fillStyle = TH.accent; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText(`第 ${tip.step} / 5 关`, panelX + panelW/2, panelY + 10*S)

    // 标题
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText(tip.title, panelX + panelW/2, panelY + 24*S)

    // tips 内容
    let cy = panelY + 50*S
    ctx.textAlign = 'left'
    tip.tips.forEach((t, i) => {
      ctx.fillStyle = TH.text; ctx.font = `${12*S}px "PingFang SC",sans-serif`
      ctx.fillText(`• ${t}`, panelX + 16*S, cy)
      cy += lineH
    })

    // 底部提示
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    const pulse = 0.5 + 0.5 * Math.abs(Math.sin(this.af * 0.05))
    ctx.globalAlpha = pulse
    ctx.fillText('点击任意位置开始战斗', panelX + panelW/2, cy + 10*S)
    ctx.globalAlpha = 1
  }

  _drawStatPanel() {
    const panel = this.statPanel
    if (!panel || !panel.visible) return
    const m = 20*S, panelW = W - m*2, panelH = 320*S
    const panelX = m, panelY = H*0.15
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H)
    R.drawDarkPanel(panelX, panelY, panelW, panelH, 14*S)
    const padX = 14*S
    let cy = panelY + 14*S

    if (panel.type === 'hero') {
      const s = this.heroStats || this.storage.getHeroStats()
      ctx.fillStyle = TH.accent; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText('修仙者 · 属性', panelX + panelW/2, cy); cy += 24*S
      ctx.fillStyle = TH.text; ctx.font = `${12*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(`当前气血: ${this.heroHp} / ${this.heroMaxHp}`, panelX + padX, cy); cy += 18*S
      // 气力
      ctx.fillStyle = STAT_DEFS.stamina.color; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${STAT_DEFS.stamina.icon} 气力: ${s.stamina}`, panelX + padX, cy); cy += 16*S
      // 五行攻击
      ctx.fillStyle = TH.accent; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText('▸ 五行攻击', panelX + padX, cy); cy += 14*S
      const colW = (panelW - padX*2) / 3
      ATTRS.forEach((a, i) => {
        const atkKey = ATK_KEY[a]
        const col = i % 3, row = Math.floor(i / 3)
        const sx = panelX + padX + col * colW
        const sy = cy + row * 16*S
        ctx.fillStyle = ATTR_COLOR[a].main; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`${ATTR_NAME[a]}攻:${s[atkKey]||0}`, sx, sy)
      })
      cy += Math.ceil(ATTRS.length/3) * 16*S + 6*S
      // 五行防御
      ctx.fillStyle = TH.accent; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText('▸ 五行防御', panelX + padX, cy); cy += 14*S
      ATTRS.forEach((a, i) => {
        const defKey = DEF_KEY[a]
        const col = i % 3, row = Math.floor(i / 3)
        const sx = panelX + padX + col * colW
        const sy = cy + row * 16*S
        ctx.fillStyle = ATTR_COLOR[a].main; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`${ATTR_NAME[a]}防:${s[defKey]||0}`, sx, sy)
      })
      cy += Math.ceil(ATTRS.length/3) * 16*S + 6*S
      // 回复+护盾
      ctx.fillStyle = STAT_DEFS.recovery.color; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${STAT_DEFS.recovery.icon} 回复: ${s.recovery||0}`, panelX + padX, cy)
      ctx.fillStyle = TH.sub; ctx.fillText(`  护盾: ${this.heroShield}`, panelX + padX + 100*S, cy)
    } else {
      const enemy = this.curLevel?.enemy
      if (!enemy) return
      const es = this.enemyStats || {}
      ctx.fillStyle = ATTR_COLOR[enemy.attr]?.main || TH.danger
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(`${enemy.name} · 属性`, panelX + panelW/2, cy); cy += 24*S
      ctx.fillStyle = TH.text; ctx.font = `${12*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(`当前气血: ${this.enemyHp} / ${this.enemyMaxHp}`, panelX + padX, cy); cy += 18*S
      // 气力
      ctx.fillStyle = STAT_DEFS.stamina.color; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${STAT_DEFS.stamina.icon} 气力: ${es.stamina||enemy.hp}`, panelX + padX, cy); cy += 16*S
      // 五行攻击
      ctx.fillStyle = TH.accent; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText('▸ 五行攻击', panelX + padX, cy); cy += 14*S
      const colW = (panelW - padX*2) / 3
      ATTRS.forEach((a, i) => {
        const atkKey = ATK_KEY[a]
        const col = i % 3, row = Math.floor(i / 3)
        const sx = panelX + padX + col * colW
        const sy = cy + row * 16*S
        ctx.fillStyle = ATTR_COLOR[a].main; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`${ATTR_NAME[a]}攻:${es[atkKey]||0}`, sx, sy)
      })
      cy += Math.ceil(ATTRS.length/3) * 16*S + 6*S
      // 五行防御
      ctx.fillStyle = TH.accent; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText('▸ 五行防御', panelX + padX, cy); cy += 14*S
      ATTRS.forEach((a, i) => {
        const defKey = DEF_KEY[a]
        const col = i % 3, row = Math.floor(i / 3)
        const sx = panelX + padX + col * colW
        const sy = cy + row * 16*S
        ctx.fillStyle = ATTR_COLOR[a].main; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`${ATTR_NAME[a]}防:${es[defKey]||0}`, sx, sy)
      })
      cy += Math.ceil(ATTRS.length/3) * 16*S + 6*S
      ctx.fillStyle = ATTR_COLOR[enemy.attr]?.main || TH.sub
      ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${ATTR_NAME[enemy.attr]}属性`, panelX + padX, cy)
    }

    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText('点击任意位置关闭', panelX + panelW/2, panelY + panelH + 10*S)
  }

  _hitRect(x,y,rx,ry,rw,rh) {
    return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh
  }
}

new Main()
