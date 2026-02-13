/**
 * 龙珠战纪 - 主游戏逻辑
 * 单主角 + 装备技能体系 + 三消打怪
 */
const { Render, A, TH } = require('./render')
const Storage = require('./data/storage')
const { ATTRS, ATTR_NAME, ATTR_COLOR, COUNTER_MAP, EQUIP_SLOT, QUALITY, randomDrop, generateEquipment } = require('./data/equipment')
const { DIFFICULTY, ALL_LEVELS, getLevelData, getThemeLevels, getAllThemes } = require('./data/levels')
const MusicMgr = require('./runtime/music')

// Canvas 初始化
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height
const S = W / 375  // 设计基准375宽
const safeTop = (wx.getSystemInfoSync().safeArea?.top || 20) * (W / wx.getSystemInfoSync().windowWidth)

// 珠子属性列表（不含heart的5种用于战斗伤害，heart用于回血）
const BEAD_ATTRS = ['fire','water','wood','light','dark','heart']
const COLS = 6, ROWS = 5

const R = new Render(ctx, W, H, S, safeTop)

class Main {
  constructor() {
    this.storage = new Storage()
    this.storage.checkDailyReset()
    this.scene = 'loading'
    this.sceneStack = []
    this.af = 0  // 动画帧
    this.scrollY = 0; this.maxScrollY = 0

    // 棋盘
    this.board = []; this.cellSize = 0; this.boardX = 0; this.boardY = 0
    // 拖拽
    this.dragging = false; this.dragR = -1; this.dragC = -1; this.dragOX = 0; this.dragOY = 0
    this.dragTrail = []
    // 战斗状态
    this.bState = 'none'  // none/playerTurn/eliminating/settling/enemyTurn/victory/defeat
    this.combo = 0; this.turnCount = 0; this.elimSets = []
    this.enemyHp = 0; this.enemyMaxHp = 0; this.heroHp = 0; this.heroMaxHp = 0
    this.heroShield = 0  // 减伤
    this.heroBuffs = []; this.enemyBuffs = []
    this.skillTriggers = {}  // 各属性技能触发次数（用于绝技蓄力）
    this.ultReady = {}  // 各属性绝技是否就绪
    this.pendingUlt = null  // 待使用的绝技
    // 动画
    this.animQueue = []; this.dmgFloats = []; this.skillEffects = []
    this.shakeT = 0; this.shakeI = 0
    // 掉落
    this.dropPopup = null; this.tempEquips = []
    // Loading
    this._loadStart = Date.now()
    // 关卡选择
    this.selTheme = 'fire'; this.selDiff = 'normal'
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
  goTo(scene) { this.sceneStack.push(this.scene); this.scene = scene; this.scrollY = 0 }
  goBack() {
    if (this.sceneStack.length) { this.scene = this.sceneStack.pop(); this.scrollY = 0 }
    else this.scene = 'home'
  }

  // ===== 更新 =====
  update() {
    if (this.shakeT > 0) this.shakeT--
    // 伤害飘字衰减
    this.dmgFloats = this.dmgFloats.filter(f => { f.t++; f.y -= 1.5*S; f.alpha -= 0.025; return f.alpha > 0 })
    // 技能特效
    this.skillEffects = this.skillEffects.filter(e => { e.t++; e.y -= 1*S; e.alpha -= 0.02; return e.alpha > 0 })
    // Loading自动跳转
    if (this.scene === 'loading' && Date.now() - this._loadStart > 1500) {
      this.scene = 'home'
      MusicMgr.playBgm()
    }
    // 消除动画
    if (this.bState === 'eliminating') this._processElim()
  }

  // ===== 渲染入口 =====
  render() {
    ctx.save()
    if (this.shakeT > 0) ctx.translate((Math.random()-0.5)*this.shakeI,(Math.random()-0.5)*this.shakeI)
    switch(this.scene) {
      case 'loading':       this.rLoading(); break
      case 'home':          this.rHome(); break
      case 'themeSelect':   this.rThemeSelect(); break
      case 'levelSelect':   this.rLevelSelect(); break
      case 'equipManage':   this.rEquipManage(); break
      case 'battlePrepare': this.rBattlePrepare(); break
      case 'battle':        this.rBattle(); break
      case 'dailyTask':     this.rDailyTask(); break
      case 'achievement':   this.rAchievement(); break
    }
    ctx.restore()
  }

  // ===== Loading =====
  rLoading() {
    R.drawLoadingBg(this.af)
    const p = Math.min(1, (Date.now()-this._loadStart)/1400), cy = H*0.4
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=30*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${48*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('龙珠战纪',W/2,cy)
    ctx.shadowBlur=0; ctx.restore()
    const bw=W*0.5, bh=4*S, bx=(W-bw)/2, by=cy+60*S
    ctx.fillStyle='rgba(255,255,255,0.1)'; R.rr(bx,by,bw,bh,bh/2); ctx.fill()
    const g=ctx.createLinearGradient(bx,by,bx+bw*p,by)
    g.addColorStop(0,TH.accent); g.addColorStop(1,TH.danger)
    ctx.fillStyle=g; R.rr(bx,by,bw*p,bh,bh/2); ctx.fill()
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.fillText('加载中...',W/2,by+24*S)
  }

  // ===== 首页 =====
  rHome() {
    R.drawHomeBg(this.af)
    const oy = safeTop+80*S
    const m = 16*S
    // 战力信息
    const stats = this.storage.getHeroStats()
    const cardY = oy, cardW = W-m*2, cardH = 60*S
    R.drawDarkPanel(m,cardY,cardW,cardH,12*S)
    ctx.fillStyle=TH.accent; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='middle'
    ctx.fillText('⚔ 主角信息', m+12*S, cardY+16*S)
    ctx.fillStyle=TH.text; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`ATK:${stats.atk}  HP:${stats.hp}  DEF:${stats.def}`, m+12*S, cardY+36*S)
    ctx.textAlign='right'; ctx.fillStyle=TH.accent; ctx.font=`bold ${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`💰 ${this.storage.gold}`, W-m-12*S, cardY+16*S)
    // 装备预览
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.textAlign='right'
    const eqCount = Object.values(this.storage.equipped).filter(e=>e).length
    ctx.fillText(`装备 ${eqCount}/6`, W-m-12*S, cardY+36*S)

    // 当前关卡卡片
    const lvCardY = cardY+cardH+10*S, lvCardH = 80*S
    const lv = ALL_LEVELS.find(l=>l.levelId===this.storage.currentLevel) || ALL_LEVELS[0]
    R.drawDarkPanel(m,lvCardY,cardW,lvCardH,12*S)
    ctx.fillStyle=TH.text; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillText('📍 '+lv.name, m+12*S, lvCardY+10*S)
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`敌人: ${lv.enemy.name} (${ATTR_NAME[lv.enemy.attr]}属性)`, m+12*S, lvCardY+30*S)
    ctx.fillText(`HP:${lv.enemy.hp}  ATK:${lv.enemy.atk}`, m+12*S, lvCardY+46*S)
    // 开始战斗按钮
    R.drawBtn(W-m-90*S, lvCardY+lvCardH-34*S, 80*S, 28*S, '开始战斗', TH.danger)

    // 装备一览
    const eqY = lvCardY+lvCardH+14*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillText('🛡️ 当前装备', m, eqY)
    const eqSlots = Object.keys(EQUIP_SLOT)
    const eqW = (cardW-10*S)/2, eqH = 48*S
    eqSlots.forEach((slot,i) => {
      const col = i%2, row = Math.floor(i/2)
      const ex = m + col*(eqW+10*S), ey = eqY+20*S + row*(eqH+6*S)
      R.drawEquipCard(ex,ey,eqW,eqH,this.storage.equipped[slot],false,this.af)
    })

    // 底部导航
    this._drawNav('home')
  }

  // ===== 主题选择（关卡大区） =====
  rThemeSelect() {
    R.drawBg(this.af); R.drawTopBar('关卡选择',true)
    const themes = getAllThemes()
    const m=14*S, startY=safeTop+56*S, cardH=58*S, gap=8*S
    // 难度Tab
    const diffs = Object.values(DIFFICULTY)
    const tabW = 60*S, tabH = 26*S, tabY = startY
    diffs.forEach((d,i) => {
      const tx = m + i*(tabW+8*S)
      R.drawDiffTag(tx,tabY,tabW,tabH,d.name,d.color,this.selDiff===d.id)
    })
    const listY = tabY+tabH+12*S
    themes.forEach((t,i) => {
      const ty = listY + i*(cardH+gap)
      const a = t.id !== 'mixed' ? ATTR_COLOR[t.id] : { main:'#aaa' }
      R.drawDarkPanel(m,ty,W-m*2,cardH,10*S)
      // 属性色条
      ctx.fillStyle = a.main; ctx.fillRect(m+4*S,ty+4*S,3*S,cardH-8*S)
      ctx.fillStyle=TH.text; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
      ctx.textAlign='left'; ctx.textBaseline='middle'
      ctx.fillText(t.name, m+16*S, ty+cardH/2-8*S)
      // 进度
      const passed = getThemeLevels(t.id).filter(l => this.storage.isLevelPassed(l.levelId,this.selDiff)).length
      ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`进度: ${passed}/${t.levels}`, m+16*S, ty+cardH/2+10*S)
      // 进入箭头
      ctx.fillStyle=TH.accent; ctx.font=`${18*S}px "PingFang SC",sans-serif`
      ctx.textAlign='right'; ctx.fillText('›', W-m-12*S, ty+cardH/2)
    })
  }

  // ===== 关卡列表（某主题内） =====
  rLevelSelect() {
    R.drawBg(this.af)
    const themeName = this.selTheme==='mixed' ? '混沌试炼' : ATTR_NAME[this.selTheme]+'之域'
    R.drawTopBar(themeName,true)
    const levels = getThemeLevels(this.selTheme)
    const m=14*S, startY=safeTop+56*S, cardH=52*S, gap=6*S
    levels.forEach((lv,i) => {
      const ly = startY + i*(cardH+gap) - this.scrollY
      if (ly < safeTop-cardH || ly > H) return  // 视窗裁剪
      const passed = this.storage.isLevelPassed(lv.levelId, this.selDiff)
      R.drawDarkPanel(m,ly,W-m*2,cardH,8*S)
      ctx.fillStyle = passed ? TH.success : TH.text
      ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
      ctx.textAlign='left'; ctx.textBaseline='middle'
      ctx.fillText((passed?'✓ ':'')+lv.name, m+12*S, ly+cardH/2-6*S)
      ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${lv.enemy.name} · HP:${lv.enemy.hp} · ATK:${lv.enemy.atk}`, m+12*S, ly+cardH/2+10*S)
    })
    this.maxScrollY = Math.max(0, levels.length*(cardH+gap) - (H-startY) + 40*S)
  }

  // ===== 装备管理 =====
  rEquipManage() {
    R.drawBg(this.af); R.drawTopBar('装备管理',true)
    const m=14*S, startY=safeTop+56*S
    // 当前佩戴
    ctx.fillStyle=TH.accent; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillText('当前佩戴', m, startY)
    const eqW = (W-m*2-10*S)/2, eqH = 50*S
    const slots = Object.keys(EQUIP_SLOT)
    slots.forEach((slot,i) => {
      const col=i%2, row=Math.floor(i/2)
      const ex=m+col*(eqW+10*S), ey=startY+22*S+row*(eqH+6*S)
      R.drawEquipCard(ex,ey,eqW,eqH,this.storage.equipped[slot],false,this.af)
    })
    // 背包标题
    const bagY = startY+22*S + 3*(eqH+6*S) + 10*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(`背包 (${this.storage.inventory.length})`, m, bagY)
    // 背包列表
    const inv = this.storage.inventory
    inv.forEach((eq,i) => {
      const iy = bagY+22*S + i*(eqH+6*S) - this.scrollY
      if (iy < bagY || iy > H) return
      const isEquipped = Object.values(this.storage.equipped).some(e => e && e.uid === eq.uid)
      R.drawEquipCard(m,iy,W-m*2,eqH,eq,isEquipped,this.af)
    })
    this.maxScrollY = Math.max(0, inv.length*(eqH+6*S) - (H-bagY-22*S) + 40*S)
  }

  // ===== 战斗准备 =====
  rBattlePrepare() {
    R.drawBg(this.af); R.drawTopBar('战斗准备',true)
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
    // 装备概览
    const eqY = startY+116*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.fillText('出战装备', m, eqY)
    const eqW = (W-m*2-10*S)/2, eqH = 46*S
    Object.keys(EQUIP_SLOT).forEach((slot,i) => {
      const col=i%2, row=Math.floor(i/2)
      R.drawEquipCard(m+col*(eqW+10*S), eqY+20*S+row*(eqH+6*S), eqW, eqH, this.storage.equipped[slot], false, this.af)
    })
    // 主角信息
    const stats = this.storage.getHeroStats()
    const infoY = eqY+20*S + 3*(eqH+6*S) + 10*S
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`主角 ATK:${stats.atk} HP:${stats.hp} DEF:${stats.def}`, m, infoY)
    // 出战按钮
    R.drawBtn(W/2-55*S, infoY+30*S, 110*S, 40*S, '出 战', TH.danger)
  }

  // ===== 战斗 =====
  rBattle() {
    R.drawBg(this.af)
    // 顶部信息
    const topY = safeTop+4*S
    // 退出按钮
    ctx.fillStyle='rgba(255,255,255,0.08)'; R.rr(10*S,topY,40*S,20*S,10*S); ctx.fill()
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('退出',30*S,topY+10*S)
    // 回合数
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign='right'; ctx.fillText(`回合 ${this.turnCount}`,W-12*S,topY+10*S)
    // 难度
    if (this.curLevel) {
      const d = DIFFICULTY[this.curLevel.difficulty]
      ctx.fillStyle=d.color; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.fillText(d.name, W/2, topY+10*S)
    }

    // 敌人区
    const eiR = 28*S, eiY = topY+50*S
    if (this.curLevel) {
      R.drawEnemy(W/2, eiY, eiR, this.curLevel.enemy.attr, this.enemyHp, this.enemyMaxHp,
        this.curLevel.enemy.name, this.curLevel.enemy.avatar, this.af)
    }

    // 主角HP
    const heroHpY = eiY+eiR+36*S
    ctx.fillStyle=TH.text; ctx.font=`${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign='left'; ctx.fillText(`主角 HP`, 14*S, heroHpY-4*S)
    R.drawHp(14*S, heroHpY+6*S, W-28*S, 6*S, this.heroHp, this.heroMaxHp, TH.success)
    ctx.fillStyle=TH.sub; ctx.font=`${9*S}px "PingFang SC",sans-serif`
    ctx.textAlign='right'; ctx.fillText(`${this.heroHp}/${this.heroMaxHp}`, W-14*S, heroHpY-4*S)

    // 绝技蓄力区（佩戴的装备）
    const ultY = heroHpY+20*S
    const equipped = this.storage.equipped
    let ultIdx = 0
    Object.keys(equipped).forEach(slot => {
      const eq = equipped[slot]
      if (!eq) return
      const ux = 14*S + ultIdx*(56*S), uy = ultY
      const cur = this.skillTriggers[eq.attr] || 0
      const ready = cur >= eq.ultTrigger
      R.drawUltGauge(ux,uy,50*S,10*S, cur, eq.ultTrigger, ready, ATTR_COLOR[eq.attr].main, this.af)
      ctx.fillStyle=TH.sub; ctx.font=`${8*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.fillText(ATTR_NAME[eq.attr], ux+25*S, uy+14*S)
      ultIdx++
    })

    // Combo显示
    if (this.combo > 0) {
      ctx.fillStyle=TH.accent; ctx.font=`bold ${20*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${this.combo} Combo!`, W/2, ultY+32*S)
    }

    // 棋盘
    const midY = ultY+44*S
    this._drawBoard(midY)

    // 伤害飘字
    this.dmgFloats.forEach(f => R.drawDmgFloat(f.x,f.y,f.text,f.color,f.alpha,f.scale))
    // 技能特效
    this.skillEffects.forEach(e => R.drawSkillEffect(e.x,e.y,e.text,e.color,e.alpha))

    // 掉落弹窗
    if (this.dropPopup) {
      R.drawDropPopup(30*S,H*0.2,W-60*S,H*0.45,this.dropPopup,this.af)
      // 按钮
      const btnY = H*0.2+H*0.45-44*S
      R.drawBtn(40*S,btnY,100*S,34*S,'装备',TH.success)
      R.drawBtn(W-140*S,btnY,100*S,34*S,'暂存',TH.info)
    }

    // 胜负
    if (this.bState === 'victory') {
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H)
      ctx.fillStyle=TH.accent; ctx.font=`bold ${36*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('🎉 胜利!',W/2,H*0.35)
      ctx.fillStyle=TH.text; ctx.font=`${14*S}px "PingFang SC",sans-serif`
      ctx.fillText(`回合: ${this.turnCount}  Combo: ${this.combo}`,W/2,H*0.43)
      R.drawBtn(W/2-50*S,H*0.52,100*S,36*S,'返回',TH.accent)
    }
    if (this.bState === 'defeat') {
      ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H)
      ctx.fillStyle=TH.danger; ctx.font=`bold ${36*S}px "PingFang SC",sans-serif`
      ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('💀 失败',W/2,H*0.35)
      R.drawBtn(W/2-50*S,H*0.45,100*S,36*S,'返回',TH.danger)
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
    // 珠子
    for (let r=0; r<ROWS; r++) {
      for (let c=0; c<COLS; c++) {
        const cell = this.board[r]?.[c]
        if (!cell) continue
        let cx = bx + c*cs + cs/2
        let cy = by + r*cs + cs/2
        // 拖拽中的珠子
        if (this.dragging && r===this.dragR && c===this.dragC) {
          cx += this.dragOX; cy += this.dragOY
          // 拖尾
          this.dragTrail.forEach((t,i) => {
            ctx.save(); ctx.globalAlpha = 0.15*(1-i/this.dragTrail.length)
            R.drawBead(t.x,t.y,cs*0.38,cell,this.af)
            ctx.restore()
          })
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

  // ===== 每日任务 =====
  rDailyTask() {
    R.drawBg(this.af); R.drawTopBar('每日任务',true)
    const m=14*S, startY=safeTop+56*S
    const tasks = this.storage.dailyTask.tasks
    tasks.forEach((t,i) => {
      const ty = startY + i*56*S
      R.drawTaskCard(m,ty,W-m*2,48*S,t)
    })
    // 全完成奖励
    if (tasks.every(t=>t.done) && !this.storage.dailyTask.allClaimed) {
      const by = startY + tasks.length*56*S + 10*S
      R.drawBtn(m,by,W-m*2,36*S,'领取全部完成奖励',TH.accent)
    }
  }

  // ===== 成就 =====
  rAchievement() {
    R.drawBg(this.af); R.drawTopBar('成就',true)
    const m=14*S, startY=safeTop+56*S
    const achs = this.storage.achievements
    Object.entries(achs).forEach(([id,a],i) => {
      const ay = startY + i*56*S
      R.drawDarkPanel(m,ay,W-m*2,48*S,8*S)
      ctx.fillStyle = a.done ? TH.success : TH.text
      ctx.font=`bold ${12*S}px "PingFang SC",sans-serif`
      ctx.textAlign='left'; ctx.textBaseline='middle'
      ctx.fillText((a.done?'✓ ':'')+a.name, m+12*S, ay+16*S)
      ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(a.desc, m+12*S, ay+34*S)
      if (a.done && !a.claimed) {
        R.drawBtn(W-m-70*S, ay+10*S, 58*S, 28*S, '领取', TH.accent)
      }
    })
  }

  // ===== 底部导航 =====
  _drawNav(active) {
    const navH = 56*S, navY = H-navH-10*S
    ctx.fillStyle='rgba(12,12,28,0.88)'
    R.rr(8*S,navY,W-16*S,navH,14*S); ctx.fill()
    const items = [
      { id:'battle',icon:'assets/nav_icons/nav_battle.png',text:'战斗' },
      { id:'themeSelect',icon:'assets/nav_icons/nav_level.png',text:'关卡' },
      { id:'equipManage',icon:'assets/nav_icons/nav_team.png',text:'装备' },
      { id:'dailyTask',icon:'assets/nav_icons/nav_quest.png',text:'任务' },
      { id:'achievement',icon:'assets/nav_icons/nav_achievement.png',text:'成就' },
    ]
    const iw = (W-16*S)/items.length
    items.forEach((it,i) => {
      R.drawNavBtn(8*S+i*iw, navY, iw, navH, it.icon, it.text, active===it.id || active==='home'&&i===0)
    })
    this._navItems = items
    this._navY = navY; this._navH = navH; this._navIW = iw
  }

  // ===== 触摸处理 =====
  onTouch(type, e) {
    const t = e.touches[0] || e.changedTouches[0]
    if (!t) return
    const x = t.clientX * (W/wx.getSystemInfoSync().windowWidth)
    const y = t.clientY * (H/wx.getSystemInfoSync().windowHeight)

    switch(this.scene) {
      case 'home':          this.tHome(type,x,y); break
      case 'themeSelect':   this.tThemeSelect(type,x,y); break
      case 'levelSelect':   this.tLevelSelect(type,x,y); break
      case 'equipManage':   this.tEquipManage(type,x,y); break
      case 'battlePrepare': this.tBattlePrepare(type,x,y); break
      case 'battle':        this.tBattle(type,x,y); break
      case 'dailyTask':     this.tDailyTask(type,x,y); break
      case 'achievement':   this.tAchievement(type,x,y); break
    }
  }

  // --- 首页触摸 ---
  tHome(type,x,y) {
    if (type !== 'end') return
    const m=16*S
    const oy = safeTop+80*S
    // 开始战斗按钮
    const lvCardY = oy+60*S+10*S, lvCardH = 80*S
    if (this._hitRect(x,y,W-m-90*S,lvCardY+lvCardH-34*S,80*S,28*S)) {
      this._startBattle(this.storage.currentLevel, this.selDiff)
      return
    }
    // 底部导航
    this._handleNav(x,y)
  }

  // --- 主题选择触摸 ---
  tThemeSelect(type,x,y) {
    if (type !== 'end') return
    const m=14*S, startY=safeTop+56*S
    // 返回
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    // 难度Tab
    const tabY = startY, tabW=60*S, tabH=26*S
    Object.values(DIFFICULTY).forEach((d,i) => {
      if (this._hitRect(x,y,m+i*(tabW+8*S),tabY,tabW,tabH)) this.selDiff = d.id
    })
    // 主题列表
    const listY = tabY+tabH+12*S, cardH=58*S, gap=8*S
    getAllThemes().forEach((t,i) => {
      if (this._hitRect(x,y,m,listY+i*(cardH+gap),W-m*2,cardH)) {
        this.selTheme = t.id; this.goTo('levelSelect')
      }
    })
  }

  // --- 关卡列表触摸 ---
  tLevelSelect(type,x,y) {
    if (type === 'move' && this._lastTouchY !== undefined) {
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY - (y-this._lastTouchY)))
      this._lastTouchY = y; return
    }
    if (type === 'start') { this._lastTouchY = y; return }
    if (type !== 'end') return
    this._lastTouchY = undefined
    // 返回
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    // 关卡
    const m=14*S, startY=safeTop+56*S, cardH=52*S, gap=6*S
    const levels = getThemeLevels(this.selTheme)
    levels.forEach((lv,i) => {
      const ly = startY + i*(cardH+gap) - this.scrollY
      if (this._hitRect(x,y,m,ly,W-m*2,cardH)) {
        this._startBattle(lv.levelId, this.selDiff)
      }
    })
  }

  // --- 装备管理触摸 ---
  tEquipManage(type,x,y) {
    if (type === 'move' && this._lastTouchY !== undefined) {
      this.scrollY = Math.max(0, Math.min(this.maxScrollY, this.scrollY - (y-this._lastTouchY)))
      this._lastTouchY = y; return
    }
    if (type === 'start') { this._lastTouchY = y; return }
    if (type !== 'end') return
    this._lastTouchY = undefined
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    // 背包物品点击 → 装备/卸下
    const m=14*S, startY=safeTop+56*S
    const eqW = (W-m*2-10*S)/2, eqH = 50*S
    const bagY = startY+22*S + 3*(eqH+6*S) + 10*S
    const inv = this.storage.inventory
    inv.forEach((eq,i) => {
      const iy = bagY+22*S + i*(eqH+6*S) - this.scrollY
      if (this._hitRect(x,y,m,iy,W-m*2,eqH)) {
        const isEquipped = Object.values(this.storage.equipped).some(e => e && e.uid === eq.uid)
        if (isEquipped) {
          this.storage.unequipSlot(eq.slot)
        } else {
          this.storage.equipItem(eq.uid)
        }
      }
    })
  }

  // --- 战斗准备触摸 ---
  tBattlePrepare(type,x,y) {
    if (type !== 'end') return
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    // 出战按钮
    const stats = this.storage.getHeroStats()
    const eqH = 46*S, startY=safeTop+56*S
    const eqY = startY+116*S
    const infoY = eqY+20*S + 3*(eqH+6*S) + 10*S
    if (this._hitRect(x,y,W/2-55*S,infoY+30*S,110*S,40*S)) {
      this._enterBattle()
    }
  }

  // --- 战斗触摸 ---
  tBattle(type,x,y) {
    // 掉落弹窗
    if (this.dropPopup) {
      if (type !== 'end') return
      const btnY = H*0.2+H*0.45-44*S
      if (this._hitRect(x,y,40*S,btnY,100*S,34*S)) {
        // 装备
        const eq = this.dropPopup
        this.tempEquips.push(eq)
        // 如果对应槽位为空则直接装上（临时）
        this.dropPopup = null
      } else if (this._hitRect(x,y,W-140*S,btnY,100*S,34*S)) {
        // 暂存
        this.tempEquips.push(this.dropPopup)
        this.dropPopup = null
      }
      return
    }
    // 胜负按钮
    if (this.bState === 'victory' || this.bState === 'defeat') {
      if (type === 'end' && this._hitRect(x,y,W/2-50*S,this.bState==='victory'?H*0.52:H*0.45,100*S,36*S)) {
        this.bState = 'none'; this.goBack()
      }
      return
    }
    // 退出按钮
    if (type === 'end' && this._hitRect(x,y,10*S,safeTop+4*S,40*S,20*S)) {
      this.bState = 'none'; this.goBack(); return
    }
    // 绝技点击
    const ultY = safeTop+4*S+50*S+28*S+36*S+20*S
    const equipped = this.storage.equipped
    let ultIdx = 0
    if (type === 'end' && this.bState === 'playerTurn') {
      Object.keys(equipped).forEach(slot => {
        const eq = equipped[slot]
        if (!eq) return
        const ux = 14*S + ultIdx*(56*S), uy = ultY
        if (this._hitRect(x,y,ux,uy,50*S,18*S)) {
          const cur = this.skillTriggers[eq.attr] || 0
          if (cur >= eq.ultTrigger) {
            this._triggerUlt(eq)
          }
        }
        ultIdx++
      })
    }
    // 棋盘拖拽
    if (this.bState !== 'playerTurn') return
    const cs = this.cellSize, bx = this.boardX, by = this.boardY
    if (type === 'start') {
      const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
      if (r>=0 && r<ROWS && c>=0 && c<COLS) {
        this.dragging = true; this.dragR = r; this.dragC = c
        this.dragOX = 0; this.dragOY = 0; this.dragTrail = []
      }
    } else if (type === 'move' && this.dragging) {
      const cx = bx+this.dragC*cs+cs/2, cy = by+this.dragR*cs+cs/2
      this.dragOX = x - cx; this.dragOY = y - cy
      this.dragTrail.unshift({x,y}); if(this.dragTrail.length>8) this.dragTrail.pop()
      // 交换判定
      const dc = Math.round(this.dragOX/cs), dr = Math.round(this.dragOY/cs)
      if ((Math.abs(dc)===1&&dr===0) || (dc===0&&Math.abs(dr)===1)) {
        const nr=this.dragR+dr, nc=this.dragC+dc
        if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS) {
          this._swapBeads(this.dragR,this.dragC,nr,nc)
          this.dragR=nr; this.dragC=nc; this.dragOX=0; this.dragOY=0
        }
      }
    } else if (type === 'end') {
      if (this.dragging) {
        this.dragging = false; this.dragOX=0; this.dragOY=0; this.dragTrail=[]
        // 检查消除
        this._checkAndElim()
      }
    }
  }

  // --- 每日任务触摸 ---
  tDailyTask(type,x,y) {
    if (type !== 'end') return
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
  }

  // --- 成就触摸 ---
  tAchievement(type,x,y) {
    if (type !== 'end') return
    if (y < safeTop+44*S && x < 80*S) { this.goBack(); return }
    const m=14*S, startY=safeTop+56*S
    Object.entries(this.storage.achievements).forEach(([id,a],i) => {
      if (a.done && !a.claimed) {
        if (this._hitRect(x,y,W-m-70*S,startY+i*56*S+10*S,58*S,28*S)) {
          this.storage.claimAchievement(id)
        }
      }
    })
  }

  // --- 导航处理 ---
  _handleNav(x,y) {
    if (!this._navItems || y < this._navY || y > this._navY+this._navH) return
    const idx = Math.floor((x-8*S)/this._navIW)
    if (idx >= 0 && idx < this._navItems.length) {
      const target = this._navItems[idx].id
      if (target === 'battle') {
        this._startBattle(this.storage.currentLevel, this.selDiff)
      } else {
        this.goTo(target)
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
    this._initBoard()
    this.bState = 'playerTurn'
    this.scene = 'battle'
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
    MusicMgr.playEliminate()
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
    Object.entries(elimMap).forEach(([attr,count]) => {
      if (count < 3) return
      // 心珠回血
      if (attr === 'heart') {
        const healAmt = count * 100
        this.heroHp = Math.min(this.heroMaxHp, this.heroHp + healAmt)
        this.dmgFloats.push({ x:W/2, y:H*0.4, text:`+${healAmt}`, color:TH.success, alpha:1, scale:1, t:0 })
      }
      // 触发所有同属性装备的普通技能
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
          this.skillEffects.push({ x:W/2, y:H*0.3, text:'克制! ×1.5', color:TH.accent, alpha:1, t:0 })
        }
        // 造成伤害
        if (dmg > 0) {
          this.enemyHp = Math.max(0, this.enemyHp - dmg)
          this.dmgFloats.push({ x:W/2+Math.random()*40*S-20*S, y:H*0.25, text:`-${dmg}`, color:TH.danger, alpha:1, scale:1.2, t:0 })
          this.skillEffects.push({ x:W/2, y:H*0.35, text:sk.name, color:ATTR_COLOR[attr].main, alpha:1, t:0 })
        }
        // 回血
        if (heal > 0) {
          this.heroHp = Math.min(this.heroMaxHp, this.heroHp + heal)
          this.dmgFloats.push({ x:W/2, y:H*0.5, text:`+${heal}`, color:TH.success, alpha:1, scale:1, t:0 })
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
    if (dmg > 0) {
      this.enemyHp = Math.max(0, this.enemyHp - dmg)
      this.dmgFloats.push({ x:W/2, y:H*0.2, text:`-${dmg}`, color:TH.accent, alpha:1, scale:1.5, t:0 })
    }
    if (heal > 0) this.heroHp = Math.min(this.heroMaxHp, this.heroHp + heal)
    this.skillEffects.push({ x:W/2, y:H*0.3, text:'★ '+sk.name+'!', color:TH.accent, alpha:1, t:0 })
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
    // 基础攻击
    let atk = enemy.atk
    // buff减攻
    this.enemyBuffs.forEach(b => { if(b.type==='atkDown') atk = Math.max(0,atk-b.val) })
    // 减伤
    let dmg = Math.max(0, atk - this.heroShield)
    this.heroHp = Math.max(0, this.heroHp - dmg)
    if (dmg > 0) {
      this.dmgFloats.push({ x:W*0.3, y:H*0.45, text:`-${dmg}`, color:TH.danger, alpha:1, scale:1, t:0 })
      this.shakeT = 4; this.shakeI = 3*S
      MusicMgr.playAttack()
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
    setTimeout(() => { this.bState = 'playerTurn' }, 500)
  }

  _applyEnemySkill(sk) {
    switch(sk.type) {
      case 'buff':
        this.skillEffects.push({ x:W/2, y:H*0.2, text:sk.name, color:TH.danger, alpha:1, t:0 })
        break
      case 'dot':
        this.heroHp = Math.max(0, this.heroHp - (sk.val||50))
        this.dmgFloats.push({ x:W*0.5, y:H*0.45, text:`-${sk.val}`, color:'#b366ff', alpha:1, scale:0.9, t:0 })
        break
      case 'aoe':
        this.heroHp = Math.max(0, this.heroHp - (sk.val||100))
        this.dmgFloats.push({ x:W/2, y:H*0.4, text:`-${sk.val}`, color:TH.danger, alpha:1, scale:1.3, t:0 })
        this.shakeT = 8; this.shakeI = 6*S
        break
      case 'seal':
        // 随机封印珠子（标记为sealed，本回合不参与消除）
        this.skillEffects.push({ x:W/2, y:H*0.2, text:'封印!', color:'#b366ff', alpha:1, t:0 })
        break
      case 'convert':
        // 随机转换珠子属性
        for(let i=0;i<(sk.count||3);i++) {
          const r=Math.floor(Math.random()*ROWS), c=Math.floor(Math.random()*COLS)
          this.board[r][c] = ATTRS[Math.floor(Math.random()*ATTRS.length)]
        }
        this.skillEffects.push({ x:W/2, y:H*0.2, text:'属性干扰!', color:TH.hard, alpha:1, t:0 })
        break
      case 'debuff':
        this.heroBuffs.push({ type:sk.field, val:sk.rate, dur:sk.dur })
        this.skillEffects.push({ x:W/2, y:H*0.2, text:sk.name, color:TH.danger, alpha:1, t:0 })
        break
    }
  }

  _onVictory() {
    const lv = this.curLevel
    this.storage.passLevel(lv.levelId, lv.difficulty)
    this.storage.recordBattle(this.combo, this.storage.stats.totalSkills)
    this.storage.updateTaskProgress('dt1', 1)
    this.storage.checkAchievements({ combo: this.combo })
    // 通关奖励金币
    this.storage.gold += 200
    // 装备掉落
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
