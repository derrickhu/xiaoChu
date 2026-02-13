/**
 * 修仙消消乐 - 主游戏逻辑
 * 单修士 + 法宝技能体系 + 三消斩妖
 */
const { Render, A, TH } = require('./render')
const Storage = require('./data/storage')
const { ATTRS, ATTR_NAME, ATTR_COLOR, COUNTER_MAP, EQUIP_SLOT, QUALITY, randomDrop, generateEquipment } = require('./data/equipment')
const { DIFFICULTY, ALL_LEVELS, getLevelData } = require('./data/levels')
const MusicMgr = require('./runtime/music')

// Canvas 初始化
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
const S = W / 375  // 设计基准375宽
const safeTop = (wx.getSystemInfoSync().safeArea?.top || 20) * (W / wx.getSystemInfoSync().windowWidth)

// 灵珠属性列表（不含heart的5种用于战斗伤害，heart用于回血）
const BEAD_ATTRS = ['fire','water','wood','light','dark','heart']
const COLS = 6, ROWS = 5

const R = new Render(ctx, W, H, S, safeTop)

class Main {
  constructor() {
    this.storage = new Storage()
    this.storage.checkDailyReset()
    this.scene = 'loading'
    this.af = 0  // 动画帧
    this.scrollY = 0; this.maxScrollY = 0

    // 棋盘
    this.board = []; this.cellSize = 0; this.boardX = 0; this.boardY = 0
    // 交换操作
    this.selectedR = -1; this.selectedC = -1  // 当前选中的棋子
    this.swapAnim = null  // 交换动画 { r1,c1,r2,c2, progress, revert, duration }
    this.dragging = false; this.dragStartX = 0; this.dragStartY = 0
    this.dragR = -1; this.dragC = -1
    // 绝技上滑
    this.ultSwipe = null  // { idx, startX, startY, progress, eq }
    this._ultIconArea = null  // 绝技图标区域信息
    // 战斗状态
    this.bState = 'none'  // none/playerTurn/eliminating/settling/enemyTurn/victory/defeat
    this.combo = 0; this.turnCount = 0; this.elimSets = []
    this.enemyHp = 0; this.enemyMaxHp = 0; this.heroHp = 0; this.heroMaxHp = 0
    this.heroShield = 0  // 减伤
    this.heroBuffs = []; this.enemyBuffs = []
    this.skillTriggers = {}  // 各灵根技能触发次数（用于仙技蓄力）
    this.ultReady = {}  // 各灵根仙技是否就绪
    this.pendingUlt = null  // 待使用的仙技
    // 动画
    this.animQueue = []; this.dmgFloats = []; this.skillEffects = []
    this.shakeT = 0; this.shakeI = 0
    // 战斗角色动画
    this.heroAttackAnim = { active:false, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:false, progress:0, duration:18 }
    this.heroHurtAnim   = { active:false, progress:0, duration:18 }
    this.enemyAttackAnim= { active:false, progress:0, duration:20 }
    // 技能释放全屏特效
    this.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
    // 掉落
    this.dropPopup = null; this.tempEquips = []
    // Loading
    this._loadStart = Date.now()
    // 当前关卡数据
    this.curLevel = null
    // 按下态
    this._pressedBtn = null

    // 触摸（兼容 canvas.bindEvent 和 wx 全局事件两种方式）
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
  goBack() { this.scene = 'home'; this.scrollY = 0 }

  // ===== 更新 =====
  update() {
    if (this.shakeT > 0) this.shakeT--
    // 伤害飘字衰减
    this.dmgFloats = this.dmgFloats.filter(f => { f.t++; f.y -= 1.5*S; f.alpha -= 0.025; return f.alpha > 0 })
    // 技能特效
    this.skillEffects = this.skillEffects.filter(e => { e.t++; e.y -= 1*S; e.alpha -= 0.02; return e.alpha > 0 })
    // Loading自动跳转 → 进入角色展示（intro）
    if (this.scene === 'loading' && Date.now() - this._loadStart > 1500) {
      this.scene = 'intro'
      MusicMgr.playBgm()
    }
    // 消除动画
    if (this.bState === 'eliminating') this._processElim()
    // 交换动画更新
    this._updateSwapAnim()
    // 战斗角色动画更新
    this._updateBattleAnims()
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

  // 启动角色攻击动画
  _playHeroAttack(skillName, attr, type) {
    this.heroAttackAnim = { active:true, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:true, progress:0, duration:18 }
    const color = ATTR_COLOR[attr]?.main || TH.accent
    // 计算妖兽位置用于特效定位
    const topArea = safeTop + 4*S
    const arenaH = H * 0.42 - topArea
    const charY = topArea + arenaH * 0.45
    this.skillCastAnim = {
      active:true, progress:0, duration:30,
      type: type||'slash', color,
      skillName: skillName||'',
      targetX: W*0.72, targetY: charY
    }
  }

  // 启动敌方攻击动画
  _playEnemyAttack(skillName) {
    this.enemyAttackAnim = { active:true, progress:0, duration:20 }
    this.heroHurtAnim    = { active:true, progress:0, duration:18 }
    const topArea = safeTop + 4*S
    const arenaH = H * 0.42 - topArea
    const charY = topArea + arenaH * 0.45
    this.skillCastAnim = {
      active:true, progress:0, duration:25,
      type:'enemyAtk', color:TH.danger,
      skillName: skillName||'',
      targetX: W*0.28, targetY: charY
    }
  }

  // 启动治疗动画
  _playHealEffect(skillName) {
    const topArea = safeTop + 4*S
    const arenaH = H * 0.42 - topArea
    const charY = topArea + arenaH * 0.45
    this.skillCastAnim = {
      active:true, progress:0, duration:28,
      type:'heal', color:TH.success,
      skillName: skillName||'',
      targetX: W*0.28, targetY: charY
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

  // ===== 角色展示（首次进入） =====
  rIntro() {
    R.drawHomeBg(this.af)
    const m = 16*S
    // 标题
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=20*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${32*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('修仙消消乐', W/2, safeTop+50*S)
    ctx.shadowBlur=0; ctx.restore()

    // 角色立绘区域
    const charY = safeTop+100*S, charH = H*0.4
    // 角色光环
    const pulse = 1 + 0.03*Math.sin(this.af*0.04)
    ctx.save(); ctx.globalAlpha=0.15
    ctx.fillStyle=TH.accent
    ctx.beginPath(); ctx.arc(W/2, charY+charH/2, 80*S*pulse, 0, Math.PI*2); ctx.fill()
    ctx.restore()
    // 角色图片
    const heroImg = R.getImg('assets/hero/hero_default.png')
    const heroSize = 120*S
    if (heroImg && heroImg.width > 0) {
      ctx.drawImage(heroImg, W/2-heroSize/2, charY+charH/2-heroSize/2, heroSize, heroSize)
    } else {
      // 无图片时画一个占位角色
      ctx.save()
      const g = ctx.createRadialGradient(W/2, charY+charH/2, 10*S, W/2, charY+charH/2, 55*S)
      g.addColorStop(0, '#ffd700'); g.addColorStop(0.6, '#ff6b35'); g.addColorStop(1, 'rgba(255,107,53,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W/2, charY+charH/2, 55*S, 0, Math.PI*2); ctx.fill()
      // 角色剪影
      ctx.fillStyle='rgba(255,255,255,0.9)'; ctx.font=`${60*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText('🧙', W/2, charY+charH/2)
      ctx.restore()
    }

    // 角色基础信息
    const stats = this.storage.getHeroStats()
    const infoY = charY+charH+20*S
    R.drawDarkPanel(m, infoY, W-m*2, 60*S, 12*S)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('初始修为', W/2, infoY+16*S)
    ctx.fillStyle=TH.text; ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`ATK:${stats.atk}   HP:${stats.hp}   DEF:${stats.def}`, W/2, infoY+40*S)

    // 法宝提示
    const eqCount = Object.values(this.storage.equipped).filter(e=>e).length
    if (eqCount > 0) {
      ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(`已佩戴 ${eqCount}/6`, W/2, infoY+60*S+10*S)
    }

    // 开始游戏按钮（大按钮居中）
    const btnW = 180*S, btnH = 48*S
    const btnX = (W-btnW)/2, btnY = H-120*S
    R.drawBtn(btnX, btnY, btnW, btnH, '踏入仙途', TH.danger)

    // 底部提示
    ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.fillText('点击开始你的修仙之旅', W/2, btnY+btnH+16*S)
  }

  // ===== 首页（简洁版：角色信息+关卡入口） =====
  rHome() {
    R.drawHomeBg(this.af)
    const m = 16*S

    // 顶部标题栏
    ctx.fillStyle=TH.accent; ctx.font=`bold ${20*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText('修仙消消乐', W/2, safeTop+30*S)

    // 角色信息卡片
    const stats = this.storage.getHeroStats()
    const cardY = safeTop+60*S, cardW = W-m*2, cardH = 80*S
    R.drawDarkPanel(m, cardY, cardW, cardH, 12*S)

    // 角色小头像
    const avatarSize = 50*S, avatarX = m+14*S, avatarY = cardY+15*S
    ctx.save()
    ctx.beginPath(); ctx.arc(avatarX+avatarSize/2, avatarY+avatarSize/2, avatarSize/2, 0, Math.PI*2); ctx.clip()
    const heroImg = R.getImg('assets/hero/hero_default.png')
    if (heroImg && heroImg.width > 0) {
      ctx.drawImage(heroImg, avatarX, avatarY, avatarSize, avatarSize)
    } else {
      const g = ctx.createRadialGradient(avatarX+avatarSize/2, avatarY+avatarSize/2, 5*S, avatarX+avatarSize/2, avatarY+avatarSize/2, avatarSize/2)
      g.addColorStop(0, TH.accent); g.addColorStop(1, '#ff6b35')
      ctx.fillStyle=g; ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize)
    }
    ctx.restore()
    // 角色名+信息
    const textX = avatarX+avatarSize+12*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText('修仙者', textX, cardY+22*S)
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`ATK:${stats.atk}  HP:${stats.hp}  DEF:${stats.def}`, textX, cardY+42*S)
    // 灵石
    ctx.fillStyle=TH.accent; ctx.font=`bold ${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign='right'; ctx.fillText(`💎 ${this.storage.gold}`, W-m-12*S, cardY+22*S)
    // 法宝概览
    const eqCount = Object.values(this.storage.equipped).filter(e=>e).length
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(`法宝 ${eqCount}/6`, W-m-12*S, cardY+42*S)

    // 当前关卡入口（大卡片）
    const lv = ALL_LEVELS.find(l=>l.levelId===this.storage.currentLevel) || ALL_LEVELS[0]
    const lvY = cardY+cardH+20*S, lvH = 140*S
    R.drawDarkPanel(m, lvY, cardW, lvH, 14*S)

    // 关卡标题
    ctx.fillStyle=TH.accent; ctx.font=`bold ${15*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='top'
    ctx.fillText('📍 当前秘境', W/2, lvY+12*S)

    // 敌人展示
    const enemyR = 28*S
    R.drawEnemy(W/2, lvY+60*S, enemyR, lv.enemy.attr, lv.enemy.hp, lv.enemy.hp, lv.enemy.name, lv.enemy.avatar, this.af)

    // 敌人信息
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='top'
    ctx.fillText(`HP:${lv.enemy.hp}  ATK:${lv.enemy.atk}  ${ATTR_NAME[lv.enemy.attr]}属性`, W/2, lvY+100*S)

    // 关卡名
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.fillText(lv.name, W/2, lvY+118*S)

    // 挑战按钮
    const btnW = 160*S, btnH = 44*S
    const btnX = (W-btnW)/2, btnY = lvY+lvH+20*S
    R.drawBtn(btnX, btnY, btnW, btnH, '进入秘境', TH.danger)

    // 统计区
    const statY = btnY+btnH+24*S
    ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'
    const passedTotal = Object.keys(this.storage.levelProgress).length
    ctx.fillText(`已闯 ${passedTotal} 层 · 最高连击 ${this.storage.stats.maxCombo}`, W/2, statY)
  }

  // ===== 战斗准备 =====
  rBattlePrepare() {
    R.drawBg(this.af); R.drawTopBar('备战',true)
    if (!this.curLevel) return
    const m=14*S, startY=safeTop+56*S
    const lv = this.curLevel
    const a = ATTR_COLOR[lv.enemy.attr]
    // 敌人信息
    R.drawDarkPanel(m,startY,W-m*2,100*S,12*S)
    R.drawEnemy(m+50*S, startY+50*S, 30*S, lv.enemy.attr, lv.enemy.hp, lv.enemy.hp, lv.enemy.name, lv.enemy.avatar, this.af)
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillText(`HP: ${lv.enemy.hp}`, m+90*S, startY+20*S)
    ctx.fillText(`ATK: ${lv.enemy.atk}`, m+90*S, startY+38*S)
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`难度: ${DIFFICULTY[lv.difficulty].name}`, m+90*S, startY+56*S)
    if (lv.specialCond) {
      ctx.fillStyle=TH.accent; ctx.fillText('特殊: '+lv.specialCond.type, m+90*S, startY+72*S)
    }
    // 法宝概览
    const eqY = startY+116*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.fillText('出战法宝', m, eqY)
    const eqW = (W-m*2-10*S)/2, eqH = 46*S
    Object.keys(EQUIP_SLOT).forEach((slot,i) => {
      const col=i%2, row=Math.floor(i/2)
      R.drawEquipCard(m+col*(eqW+10*S), eqY+20*S+row*(eqH+6*S), eqW, eqH, this.storage.equipped[slot], false, this.af)
    })
    // 修士信息
    const stats = this.storage.getHeroStats()
    const infoY = eqY+20*S + 3*(eqH+6*S) + 10*S
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`修士 ATK:${stats.atk} HP:${stats.hp} DEF:${stats.def}`, m, infoY)
    // 出战按钮
    R.drawBtn(W/2-55*S, infoY+30*S, 110*S, 40*S, '出 战', TH.danger)
  }

  // ===== 战斗 =====
  rBattle() {
    R.drawBg(this.af)
    const topArea = safeTop+4*S
    const arenaBottom = H * 0.42  // 上半区域底部（42%屏高）
    const arenaH = arenaBottom - topArea

    // ===== 顶部信息栏 =====
    // 退出按钮
    ctx.fillStyle='rgba(255,255,255,0.08)'; R.rr(10*S,topArea,40*S,20*S,10*S); ctx.fill()
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('退出',30*S,topArea+10*S)
    // 回合数
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign='right'; ctx.fillText(`回合 ${this.turnCount}`,W-12*S,topArea+10*S)
    // 难度
    if (this.curLevel) {
      const d = DIFFICULTY[this.curLevel.difficulty]
      ctx.fillStyle=d.color; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.fillText(d.name, W/2, topArea+10*S)
    }

    // ===== 上半部分：对战区 =====
    // 分隔线（对战区底部）
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1
    ctx.beginPath(); ctx.moveTo(0, arenaBottom); ctx.lineTo(W, arenaBottom); ctx.stroke()

    // 角色位置
    const charY = topArea + 24*S + arenaH * 0.4
    const charSize = Math.min(arenaH * 0.65, 120*S)
    const heroX = W * 0.28
    const enemyX = W * 0.72

    // 绘制修士立绘
    R.drawBattleHero(heroX, charY, charSize, this.storage.equipped,
      this.heroHp, this.heroMaxHp, this.af, this.heroAttackAnim)

    // 绘制妖兽立绘
    if (this.curLevel) {
      R.drawBattleEnemy(enemyX, charY, charSize,
        this.curLevel.enemy.attr, this.enemyHp, this.enemyMaxHp,
        this.curLevel.enemy.name, this.curLevel.enemy.avatar, this.af, this.enemyHurtAnim)
    }

    // VS标记
    R.drawVsBadge(W/2, charY - charSize*0.1, this.af)

    // 技能释放全屏特效
    R.drawSkillCast(this.skillCastAnim, this.af)

    // ===== 下半部分：消消乐+绝技图标 =====
    const bottomTop = arenaBottom + 4*S

    // Combo显示
    if (this.combo > 0) {
      ctx.fillStyle=TH.accent; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${this.combo} Combo!`, W/2, bottomTop+6*S)
    }

    // 棋盘
    const boardTop = bottomTop + 16*S
    this._drawBoard(boardTop)

    // ===== 棋盘下方：绝技图标区 =====
    const boardBottom = boardTop + ROWS * this.cellSize + 8*S
    const ultIconSize = 50*S
    const equipped = this.storage.equipped
    const eqList = Object.keys(equipped).map(slot => equipped[slot]).filter(e => e)
    if (eqList.length > 0) {
      const gap = 8*S
      const totalW = eqList.length * ultIconSize + (eqList.length-1) * gap
      let ix = (W - totalW) / 2
      const iy = boardBottom + 6*S
      eqList.forEach((eq, idx) => {
        const cur = this.skillTriggers[eq.attr] || 0
        const ready = cur >= eq.ultTrigger
        // 检查此图标是否正在被上滑
        const swipeP = (this.ultSwipe && this.ultSwipe.idx === idx) ? this.ultSwipe.progress : 0
        R.drawUltSkillIcon(ix, iy, ultIconSize, eq, cur, eq.ultTrigger, ready, this.af, swipeP)
        ix += ultIconSize + gap
      })
      // 保存绝技区域信息供触摸使用
      this._ultIconArea = { x: (W-totalW)/2, y: iy, iconSize: ultIconSize, gap, count: eqList.length, list: eqList }
    } else {
      this._ultIconArea = null
    }

    // 伤害飘字
    this.dmgFloats.forEach(f => R.drawDmgFloat(f.x,f.y,f.text,f.color,f.alpha,f.scale))
    // 技能特效文字
    this.skillEffects.forEach(e => R.drawSkillEffect(e.x,e.y,e.text,e.color,e.alpha))

    // 掉落弹窗
    if (this.dropPopup) {
      R.drawDropPopup(30*S,H*0.2,W-60*S,H*0.45,this.dropPopup,this.af)
      const btnY = H*0.2+H*0.45-44*S
      R.drawBtn(40*S,btnY,100*S,34*S,'佩戴',TH.success)
      R.drawBtn(W-140*S,btnY,100*S,34*S,'暂存',TH.info)
    }

    // 胜负
    if (this.bState === 'victory') {
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H)
      ctx.fillStyle=TH.accent; ctx.font=`bold ${36*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎉 胜利!',W/2,H*0.3)
      ctx.fillStyle=TH.text; ctx.font=`${14*S}px "PingFang SC",sans-serif`
      ctx.fillText(`回合: ${this.turnCount}  Combo: ${this.combo}`,W/2,H*0.38)
      ctx.fillStyle=TH.accent; ctx.font=`${12*S}px "PingFang SC",sans-serif`
      ctx.fillText(`+200 灵石`,W/2,H*0.43)
      const btnW = 130*S, gap = 16*S
      R.drawBtn(W/2-btnW-gap/2, H*0.5, btnW, 40*S, '继续闯关', TH.success)
      R.drawBtn(W/2+gap/2, H*0.5, btnW, 40*S, '回到首页', TH.info)
    }
    if (this.bState === 'defeat') {
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H)
      ctx.fillStyle=TH.danger; ctx.font=`bold ${36*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('💀 失败',W/2,H*0.3)
      ctx.fillStyle=TH.sub; ctx.font=`${13*S}px "PingFang SC",sans-serif`
      ctx.fillText('道心不灭，再战！', W/2, H*0.38)
      const btnW = 130*S, gap = 16*S
      R.drawBtn(W/2-btnW-gap/2, H*0.48, btnW, 40*S, '重新挑战', TH.danger)
      R.drawBtn(W/2+gap/2, H*0.48, btnW, 40*S, '回到首页', TH.info)
    }
  }

  _drawBoard(topY) {
    const padX = 8*S
    this.cellSize = (W-padX*2)/COLS
    this.boardX = padX; this.boardY = topY
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    // 棋盘背景
    ctx.fillStyle='rgba(10,10,25,0.7)'
    R.rr(bx-4*S,by-4*S,cs*COLS+8*S,cs*ROWS+8*S,10*S); ctx.fill()

    // 计算交换动画偏移
    const swapOffsets = {}
    if (this.swapAnim) {
      const sa = this.swapAnim
      const p = sa.progress
      const ease = sa.revert ? (1 - p) : p  // 归位动画反向
      const dx = (sa.c2 - sa.c1) * cs * ease
      const dy = (sa.r2 - sa.r1) * cs * ease
      swapOffsets[`${sa.r1}_${sa.c1}`] = { dx, dy }
      swapOffsets[`${sa.r2}_${sa.c2}`] = { dx: -dx, dy: -dy }
    }

    // 珠子
    for (let r=0; r<ROWS; r++) {
      for (let c=0; c<COLS; c++) {
        const cell = this.board[r]?.[c]
        if (!cell) continue
        let cx = bx + c*cs + cs/2
        let cy = by + r*cs + cs/2
        // 交换动画偏移
        const offset = swapOffsets[`${r}_${c}`]
        if (offset) { cx += offset.dx; cy += offset.dy }
        // 选中高亮
        if (r === this.selectedR && c === this.selectedC && !this.swapAnim) {
          ctx.save()
          ctx.strokeStyle = TH.accent; ctx.lineWidth = 2*S
          ctx.globalAlpha = 0.6 + 0.3*Math.sin(this.af*0.1)
          ctx.beginPath(); ctx.arc(cx, cy, cs*0.46, 0, Math.PI*2); ctx.stroke()
          ctx.restore()
        }
        // 消除标记
        if (cell._elim) {
          ctx.save(); ctx.globalAlpha = 0.4 + 0.3*Math.sin(this.af*0.15)
          R.drawBead(cx,cy,cs*0.42,cell._attr||cell,this.af)
          ctx.restore()
        } else {
          const attr = typeof cell === 'string' ? cell : cell
          R.drawBead(cx,cy,cs*0.42,attr,this.af)
        }
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

  // --- 角色展示触摸 ---
  tIntro(type,x,y) {
    if (type !== 'end') return
    const btnW = 180*S, btnH = 48*S
    const btnX = (W-btnW)/2, btnY = H-120*S
    if (this._hitRect(x,y,btnX,btnY,btnW,btnH)) {
      // 点击开始游戏 → 直接进入第一关战斗准备
      this._startBattle(this.storage.currentLevel, 'normal')
    }
  }

  // --- 首页触摸 ---
  tHome(type,x,y) {
    if (type !== 'end') return
    const m = 16*S
    // 挑战按钮
    const cardY = safeTop+60*S, cardH = 80*S
    const lvY = cardY+cardH+20*S, lvH = 140*S
    const btnW = 160*S, btnH = 44*S
    const btnX = (W-btnW)/2, btnY = lvY+lvH+20*S
    if (this._hitRect(x,y,btnX,btnY,btnW,btnH)) {
      this._startBattle(this.storage.currentLevel, 'normal')
    }
  }

  // ===== 战斗准备触摸 =====
  tBattlePrepare(type,x,y) {
    if (type !== 'end') return
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    const stats = this.storage.getHeroStats()
    const eqH = 46*S, startY=safeTop+56*S
    const eqY = startY+116*S
    const infoY = eqY+20*S + 3*(eqH+6*S) + 10*S
    if (this._hitRect(x,y,W/2-55*S,infoY+30*S,110*S,40*S)) {
      this._enterBattle()
    }
  }

  // ===== 战斗触摸 =====
  tBattle(type,x,y) {
    // 掉落弹窗
    if (this.dropPopup) {
      if (type !== 'end') return
      const btnY = H*0.2+H*0.45-44*S
      if (this._hitRect(x,y,40*S,btnY,100*S,34*S)) {
        const eq = this.dropPopup
        this.tempEquips.push(eq)
        this.dropPopup = null
      } else if (this._hitRect(x,y,W-140*S,btnY,100*S,34*S)) {
        this.tempEquips.push(this.dropPopup)
        this.dropPopup = null
      }
      return
    }
    // 胜利按钮：继续闯关 / 回到首页
    if (this.bState === 'victory') {
      if (type !== 'end') return
      const btnW = 130*S, gap = 16*S, btnY = H*0.5
      if (this._hitRect(x,y, W/2-btnW-gap/2, btnY, btnW, 40*S)) {
        // 继续闯关 → 进入下一关
        this.bState = 'none'
        this._startBattle(this.storage.currentLevel, 'normal')
      } else if (this._hitRect(x,y, W/2+gap/2, btnY, btnW, 40*S)) {
        // 回到首页
        this.bState = 'none'; this.scene = 'home'
      }
      return
    }
    // 失败按钮：重新挑战 / 回到首页
    if (this.bState === 'defeat') {
      if (type !== 'end') return
      const btnW = 130*S, gap = 16*S, btnY = H*0.48
      if (this._hitRect(x,y, W/2-btnW-gap/2, btnY, btnW, 40*S)) {
        // 重新挑战
        this.bState = 'none'
        this._startBattle(this.curLevel.levelId, this.curLevel.difficulty || 'normal')
      } else if (this._hitRect(x,y, W/2+gap/2, btnY, btnW, 40*S)) {
        // 回到首页
        this.bState = 'none'; this.scene = 'home'
      }
      return
    }
    // 退出按钮
    if (type === 'end' && this._hitRect(x,y,10*S,safeTop+4*S,40*S,20*S)) {
      this.bState = 'none'; this.scene = 'home'; return
    }
    // 绝技图标上滑释放
    if (this._ultIconArea && this.bState === 'playerTurn') {
      const ua = this._ultIconArea
      if (type === 'start') {
        // 检查是否点击了某个绝技图标
        for (let i=0; i<ua.count; i++) {
          const ix = ua.x + i*(ua.iconSize + ua.gap)
          const iy = ua.y
          if (this._hitRect(x, y, ix, iy, ua.iconSize, ua.iconSize)) {
            const eq = ua.list[i]
            const cur = this.skillTriggers[eq.attr] || 0
            if (cur >= eq.ultTrigger) {
              // 仅就绪状态可以上滑
              this.ultSwipe = { idx:i, startX:x, startY:y, progress:0, eq }
            }
            return  // 拦截触摸，不传递给棋盘
          }
        }
      } else if (type === 'move' && this.ultSwipe) {
        const dy = this.ultSwipe.startY - y  // 上滑为正
        this.ultSwipe.progress = Math.max(0, Math.min(1, dy / (40*S)))
        return
      } else if (type === 'end' && this.ultSwipe) {
        if (this.ultSwipe.progress > 0.6) {
          // 上滑成功 → 释放绝技
          this._triggerUlt(this.ultSwipe.eq)
        }
        this.ultSwipe = null
        return
      }
    }
    // 棋盘交互（相邻交换模式）
    if (this.bState !== 'playerTurn' || this.swapAnim) return
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    if (type === 'start') {
      const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
      if (r>=0 && r<ROWS && c>=0 && c<COLS) {
        this.dragging = true
        this.dragStartX = x; this.dragStartY = y
        this.dragR = r; this.dragC = c
      }
    } else if (type === 'move' && this.dragging) {
      // 检测拖拽方向，达到阈值时触发交换
      const dx = x - this.dragStartX, dy = y - this.dragStartY
      const threshold = cs * 0.35
      let dr = 0, dc = 0
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
        dc = dx > 0 ? 1 : -1
      } else if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > threshold) {
        dr = dy > 0 ? 1 : -1
      }
      if (dr !== 0 || dc !== 0) {
        const nr = this.dragR + dr, nc = this.dragC + dc
        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS) {
          this.dragging = false
          this._trySwap(this.dragR, this.dragC, nr, nc)
        }
      }
    } else if (type === 'end') {
      if (this.dragging) {
        // 点击选中（未拖拽到足够距离）
        const c = Math.floor((this.dragStartX-bx)/cs), r = Math.floor((this.dragStartY-by)/cs)
        if (r>=0 && r<ROWS && c>=0 && c<COLS) {
          if (this.selectedR >= 0 && this.selectedC >= 0) {
            // 已有选中棋子，判断是否相邻
            const diffR = Math.abs(r - this.selectedR), diffC = Math.abs(c - this.selectedC)
            if ((diffR === 1 && diffC === 0) || (diffR === 0 && diffC === 1)) {
              // 相邻：尝试交换
              this._trySwap(this.selectedR, this.selectedC, r, c)
              this.selectedR = -1; this.selectedC = -1
            } else if (r === this.selectedR && c === this.selectedC) {
              // 点击同一个：取消选中
              this.selectedR = -1; this.selectedC = -1
            } else {
              // 不相邻：更换选中
              this.selectedR = r; this.selectedC = c
            }
          } else {
            // 无选中：选中此棋子
            this.selectedR = r; this.selectedC = c
          }
        }
        this.dragging = false
      }
    }
  }

  // ===== 战斗逻辑 =====
  _startBattle(levelId, difficulty) {
    this.curLevel = getLevelData(levelId, difficulty)
    if (!this.curLevel) { this.curLevel = getLevelData(ALL_LEVELS[0].levelId, 'normal') }
    this.goTo('battlePrepare')
  }

  _enterBattle() {
    const lv = this.curLevel
    const stats = this.storage.getHeroStats()
    this.enemyHp = lv.enemy.hp; this.enemyMaxHp = lv.enemy.hp
    this.heroHp = stats.hp; this.heroMaxHp = stats.hp; this.heroShield = stats.def
    this.heroBuffs = []; this.enemyBuffs = []
    this.combo = 0; this.turnCount = 1
    this.skillTriggers = {}; this.ultReady = {}
    this.pendingUlt = null; this.tempEquips = []; this.dropPopup = null
    this.dmgFloats = []; this.skillEffects = []
    // 重置动画
    this.heroAttackAnim = { active:false, progress:0, duration:24 }
    this.enemyHurtAnim  = { active:false, progress:0, duration:18 }
    this.heroHurtAnim   = { active:false, progress:0, duration:18 }
    this.enemyAttackAnim= { active:false, progress:0, duration:20 }
    this.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
    this._initBoard()
    this.bState = 'playerTurn'
    this.scene = 'battle'
    this.selectedR = -1; this.selectedC = -1; this.swapAnim = null; this.ultSwipe = null
    // 检查死局
    this._checkDeadlock()
  }

  _initBoard() {
    const weights = this.curLevel?.beadWeights || { fire:17,water:17,wood:17,light:17,dark:16,heart:16 }
    const pool = []
    ATTRS.forEach(a => { for(let i=0;i<(weights[a]||10);i++) pool.push(a) })
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
    // 横向
    if (c>=2 && this.board[r][c-1]===attr && this.board[r][c-2]===attr) return true
    // 纵向
    if (r>=2 && this.board[r-1]?.[c]===attr && this.board[r-2]?.[c]===attr) return true
    return false
  }

  _swapBeads(r1,c1,r2,c2) {
    const t = this.board[r1][c1]
    this.board[r1][c1] = this.board[r2][c2]
    this.board[r2][c2] = t
  }

  // 尝试交换两个相邻棋子
  _trySwap(r1, c1, r2, c2) {
    // 先交换
    this._swapBeads(r1, c1, r2, c2)
    // 检查是否产生消除
    const matches = this._findMatches()
    if (matches.length > 0) {
      // 交换成功：播放动画然后消除
      MusicMgr.playEliminate()
      this._swapBeads(r1, c1, r2, c2)  // 先换回，动画结束再真正交换
      this.swapAnim = { r1, c1, r2, c2, progress:0, revert:false, duration:10 }
    } else {
      // 交换失败：归位动画，然后进入敌方回合
      this._swapBeads(r1, c1, r2, c2)  // 换回
      this.swapAnim = { r1, c1, r2, c2, progress:0, revert:true, duration:14 }
    }
  }

  // 在update中更新交换动画
  _updateSwapAnim() {
    if (!this.swapAnim) return
    const sa = this.swapAnim
    sa.progress += 1/sa.duration
    if (sa.progress >= 1) {
      if (sa.revert) {
        // 归位完成 → 敌方回合
        this.swapAnim = null
        this._enemyTurn()
      } else {
        // 交换完成 → 真正执行交换并消除
        this._swapBeads(sa.r1, sa.c1, sa.r2, sa.c2)
        this.swapAnim = null
        this._checkAndElim()
      }
    }
  }

  _checkAndElim() {
    const sets = this._findMatches()
    if (sets.length > 0) {
      this.combo = 0
      this.elimSets = sets
      this.bState = 'eliminating'
    }
    // 无消除 = 回合结束
    else if (this.turnCount > 0) {
      this._enemyTurn()
    }
  }

  // 检查棋盘是否存在任何可以成功交换消除的操作
  _hasValidSwap() {
    for (let r=0; r<ROWS; r++) {
      for (let c=0; c<COLS; c++) {
        // 检查右邻
        if (c+1 < COLS) {
          this._swapBeads(r, c, r, c+1)
          const m = this._findMatches()
          this._swapBeads(r, c, r, c+1)
          if (m.length > 0) return true
        }
        // 检查下邻
        if (r+1 < ROWS) {
          this._swapBeads(r, c, r+1, c)
          const m = this._findMatches()
          this._swapBeads(r, c, r+1, c)
          if (m.length > 0) return true
        }
      }
    }
    return false
  }

  // 检查死局，如果无解则重新生成棋盘
  _checkDeadlock() {
    if (!this._hasValidSwap()) {
      // 死局：显示提示并重新生成
      this.skillEffects.push({ x:W/2, y:H*0.5, text:'灵珠重排!', color:TH.accent, alpha:1, t:0 })
      this._initBoard()
      // 递归检查新棋盘是否也死局
      if (!this._hasValidSwap()) {
        this._initBoard()
      }
    }
  }

  _findMatches() {
    const marks = Array.from({length:ROWS},()=>Array(COLS).fill(false))
    // 横向
    for (let r=0;r<ROWS;r++) {
      for (let c=0;c<=COLS-3;c++) {
        const a=this.board[r][c]
        if (a && this.board[r][c+1]===a && this.board[r][c+2]===a) {
          let end=c+2; while(end+1<COLS && this.board[r][end+1]===a) end++
          for(let i=c;i<=end;i++) marks[r][i]=true
        }
      }
    }
    // 纵向
    for (let c=0;c<COLS;c++) {
      for (let r=0;r<=ROWS-3;r++) {
        const a=this.board[r][c]
        if (a && this.board[r+1]?.[c]===a && this.board[r+2]?.[c]===a) {
          let end=r+2; while(end+1<ROWS && this.board[end+1]?.[c]===a) end++
          for(let i=r;i<=end;i++) marks[i][c]=true
        }
      }
    }
    // 收集消除组（按属性分组）
    const groups = {}
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) {
      if(marks[r][c]) {
        const a=this.board[r][c]
        if(!groups[a]) groups[a]={attr:a,count:0,cells:[]}
        groups[a].count++; groups[a].cells.push({r,c})
      }
    }
    return Object.values(groups)
  }

  _processElim() {
    if (!this.elimSets || this.elimSets.length === 0) {
      // 填充 → 再检测
      this._fillBoard()
      const newSets = this._findMatches()
      if (newSets.length > 0) {
        this.elimSets = newSets
      } else {
        // 消除结束 → 结算
        this._settle()
        // 结算后检查死局（会在playerTurn开始时再次检查）
      }
      return
    }
    // 清除标记的珠子
    this.combo++
    const allElim = {}
    this.elimSets.forEach(g => {
      if(!allElim[g.attr]) allElim[g.attr]=0
      allElim[g.attr] += g.count
      g.cells.forEach(({r,c}) => this.board[r][c] = null)
    })
    // 触发技能
    this._triggerSkills(allElim)
    MusicMgr.playEliminate()
    this.shakeT = 6; this.shakeI = 4*S
    this.elimSets = []
  }

  _fillBoard() {
    const weights = this.curLevel?.beadWeights || { fire:17,water:17,wood:17,light:17,dark:16,heart:16 }
    const pool = []
    ATTRS.forEach(a => { for(let i=0;i<(weights[a]||10);i++) pool.push(a) })
    // 下落
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

  _triggerSkills(elimMap) {
    // elimMap: { attr: count }
    const equipped = this.storage.equipped
    const arenaBottom = H * 0.42
    const topArea = safeTop + 4*S
    const charY = topArea + 24*S + (arenaBottom-topArea) * 0.4
    Object.entries(elimMap).forEach(([attr,count]) => {
      if (count < 3) return
      // 心珠回血
      if (attr === 'heart') {
        const healAmt = count * 100
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + healAmt)
        this.dmgFloats.push({ x:W*0.28, y:charY-20*S, text:`+${healAmt}`, color:TH.success, alpha:1, scale:1, t:0 })
        this._playHealEffect('回春')
      }
      // 触发所有同灵根法宝的普通技能
      Object.values(equipped).forEach(eq => {
        if (!eq || eq.attr !== attr) return
        const sk = eq.skill
        let dmg = sk.dmg || 0
        let heal = sk.heal || 0
        // Combo加成
        const comboMul = 1 + (this.combo-1)*0.1
        dmg = Math.round(dmg * comboMul)
        // 属性克制
        if (this.curLevel && COUNTER_MAP[attr] === this.curLevel.enemy.attr) {
          dmg = Math.round(dmg * 1.5)
          this.skillEffects.push({ x:W/2, y:charY-30*S, text:'克制! ×1.5', color:TH.accent, alpha:1, t:0 })
        }
        // 造成伤害
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg)
          this.dmgFloats.push({ x:W*0.72+Math.random()*20*S-10*S, y:charY-20*S, text:`-${dmg}`, color:TH.danger, alpha:1, scale:1.2, t:0 })
          this._playHeroAttack(sk.name, attr, 'slash')
        }
        // 回血
        if (heal > 0) {
          this.heroHp = Math.min(this.heroMaxHp, this.heroHp + heal)
          this.dmgFloats.push({ x:W*0.28, y:charY-20*S, text:`+${heal}`, color:TH.success, alpha:1, scale:1, t:0 })
          this._playHealEffect(sk.name)
        }
        // 减伤
        if (sk.def) this.heroShield += sk.def
        // debuff
        if (sk.debuff && this.curLevel) {
          this.enemyBuffs.push({ type:'atkDown', val:sk.debuff, dur:2 })
        }
        // 蓄力
        if (!this.skillTriggers[attr]) this.skillTriggers[attr] = 0
        this.skillTriggers[attr]++
        // 任务计数
        this.storage.updateTaskProgress('dt2', 1)
      })
    })
    // 检查胜利
    if (this.enemyHp <= 0) {
      this.bState = 'victory'
      this._onVictory()
    }
  }

  _triggerUlt(equip) {
    const sk = equip.ult
    let dmg = sk.dmg || 0, heal = sk.heal || 0
    if (COUNTER_MAP[equip.attr] === this.curLevel?.enemy?.attr) dmg = Math.round(dmg*1.5)
    const arenaBottom = H * 0.42
    const topArea = safeTop + 4*S
    const charY = topArea + 24*S + (arenaBottom-topArea) * 0.4
    if (dmg > 0) {
      this.enemyHp = Math.max(0, this.enemyHp - dmg)
      this.dmgFloats.push({ x:W*0.72, y:charY-30*S, text:`-${dmg}`, color:TH.accent, alpha:1, scale:1.5, t:0 })
      this._playHeroAttack(sk.name, equip.attr, 'burst')
    }
    if (heal > 0) {
      this.heroHp = Math.min(this.heroMaxHp, this.heroHp + heal)
      this._playHealEffect(sk.name)
    }
    this.shakeT = 12; this.shakeI = 8*S
    MusicMgr.playAttack()
    // 重置蓄力
    this.skillTriggers[equip.attr] = 0
    if (this.enemyHp <= 0) { this.bState = 'victory'; this._onVictory() }
  }

  _settle() {
    this.bState = 'settling'
    // 检查胜利
    if (this.enemyHp <= 0) { this.bState = 'victory'; this._onVictory(); return }
    // buff持续时间衰减
    this.heroBuffs = this.heroBuffs.filter(b => { b.dur--; return b.dur > 0 })
    this.enemyBuffs = this.enemyBuffs.filter(b => { b.dur--; return b.dur > 0 })
    // 进入敌方回合
    setTimeout(() => this._enemyTurn(), 400)
  }

  _enemyTurn() {
    this.bState = 'enemyTurn'
    if (!this.curLevel) { this.bState = 'playerTurn'; this.turnCount++; return }
    const enemy = this.curLevel.enemy
    const arenaBottom = H * 0.42
    const topArea = safeTop + 4*S
    const charY = topArea + 24*S + (arenaBottom-topArea) * 0.4
    // 基础攻击
    let atk = enemy.atk
    // buff减攻
    this.enemyBuffs.forEach(b => { if(b.type==='atkDown') atk = Math.max(0,atk-b.val) })
    // 减伤
    let dmg = Math.max(0, atk - this.heroShield)
    this.heroHp = Math.max(0, this.heroHp - dmg)
    if (dmg > 0) {
      this.dmgFloats.push({ x:W*0.28, y:charY-20*S, text:`-${dmg}`, color:TH.danger, alpha:1, scale:1, t:0 })
      this.shakeT = 4; this.shakeI = 3*S
      MusicMgr.playAttack()
      this._playEnemyAttack(enemy.name+'攻击')
    }
    // 敌方技能
    if (enemy.skills) {
      enemy.skills.forEach(sk => {
        if (this.turnCount % sk.triggerTurn === 0) {
          this._applyEnemySkill(sk)
        }
      })
    }
    // 检查失败
    if (this.heroHp <= 0) { this.bState = 'defeat'; return }
    // 掉落检查
    if (this.curLevel.dropRate && Math.random() < this.curLevel.dropRate * 0.3) {
      const drop = randomDrop(this.curLevel.tier)
      this.dropPopup = drop
      this.storage.updateTaskProgress('dt3', 1)
    }
    this.turnCount++
    setTimeout(() => { this.bState = 'playerTurn'; this.selectedR = -1; this.selectedC = -1; this._checkDeadlock() }, 500)
  }

  _applyEnemySkill(sk) {
    const arenaBottom = H * 0.42
    const topArea = safeTop + 4*S
    const charY = topArea + 24*S + (arenaBottom-topArea) * 0.4
    switch(sk.type) {
      case 'buff':
        this.skillEffects.push({ x:W*0.72, y:charY-40*S, text:sk.name, color:TH.danger, alpha:1, t:0 })
        break
      case 'dot':
        this.heroHp = Math.max(0, this.heroHp - (sk.val||50))
        this.dmgFloats.push({ x:W*0.28, y:charY-20*S, text:`-${sk.val}`, color:'#b366ff', alpha:1, scale:0.9, t:0 })
        break
      case 'aoe':
        this.heroHp = Math.max(0, this.heroHp - (sk.val||100))
        this.dmgFloats.push({ x:W*0.28, y:charY-20*S, text:`-${sk.val}`, color:TH.danger, alpha:1, scale:1.3, t:0 })
        this.shakeT = 8; this.shakeI = 6*S
        this._playEnemyAttack(sk.name)
        break
      case 'seal':
        this.skillEffects.push({ x:W/2, y:charY-30*S, text:'封灵!', color:'#b366ff', alpha:1, t:0 })
        break
      case 'convert':
        for(let i=0;i<(sk.count||3);i++) {
          const r=Math.floor(Math.random()*ROWS), c=Math.floor(Math.random()*COLS)
          this.board[r][c] = ATTRS[Math.floor(Math.random()*ATTRS.length)]
        }
        this.skillEffects.push({ x:W/2, y:charY-30*S, text:'灵气紊乱!', color:TH.hard, alpha:1, t:0 })
        break
      case 'debuff':
        this.heroBuffs.push({ type:sk.field, val:sk.rate, dur:sk.dur })
        this.skillEffects.push({ x:W*0.28, y:charY-30*S, text:sk.name, color:TH.danger, alpha:1, t:0 })
        break
    }
  }

  _onVictory() {
    const lv = this.curLevel
    this.storage.passLevel(lv.levelId, lv.difficulty)
    this.storage.recordBattle(this.combo, this.storage.stats.totalSkills)
    this.storage.updateTaskProgress('dt1', 1)
    this.storage.checkAchievements({ combo: this.combo })
    // 通关奖励灵石
    this.storage.gold += 200
    // 法宝掉落
    if (Math.random() < (lv.dropRate||0.2)) {
      const reward = randomDrop(lv.tier)
      this.storage.addToInventory(reward)
      this.dropPopup = reward
    }
  }

  // ===== 工具方法 =====
  _hitRect(x,y,rx,ry,rw,rh) {
    return x>=rx && x<=rx+rw && y>=ry && y<=ry+rh
  }
}

new Main()
