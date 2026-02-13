/**
 * 龙珠战纪 - 转珠消除RPG微信小游戏
 * 含：难度分层、云开发、角色养成、每日任务、周回挑战、成就系统
 */
const CHARACTERS = require('./data/characters')
const { BASE_LEVELS, DIFFICULTY, getLevelData } = require('./data/levels')
const Storage = require('./data/storage')
const music = require('./runtime/music')
const { Render, A, TH, DC } = require('./render')

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const W = canvas.width, H = canvas.height, S = W / 375
const sysInfo = wx.getSystemInfoSync()
const DPR = W / sysInfo.windowWidth
const DPRH = H / sysInfo.windowHeight
const BEAD_ATTRS = ['火','水','木','光','暗','心']
const COUNTER_MAP = { '火':'木','木':'水','水':'火','光':'暗','暗':'光' }

let safeTop = 44 * S
try { const m = wx.getMenuButtonBoundingClientRect(); if(m&&m.bottom) safeTop=(m.bottom+8)*DPR } catch(e){}

const R = new Render(ctx, W, H, S, safeTop)

class Main {
  constructor() {
    this.storage = new Storage()
    this.storage.checkDailyReset()
    this.storage.checkWeeklyReset()
    this.scene = 'loading'
    this.af = 0; this.ta = 1
    this.scrollY = 0; this.maxScrollY = 0 // 滚动支持

    // 棋盘
    this.cols=6; this.rows=5; this.bs=W/7; this.beads=[]; this.isDrag=false
    this.selBead=null; this.lastSwap=null
    this.bx=(W-this.cols*this.bs)/2; this.by=H*0.52

    // 战斗
    this.bState='idle'; this.lvData=null; this.curDiff='normal'
    this.eHp=0; this.eMax=0; this.eDisp=0
    this.tHp=0; this.tMax=0; this.tDisp=0
    this.turn=0; this.combo=0; this.comboDisp=0; this.comboT=0
    this.dmgFloats=[]; this.elimAnim=0; this.elimGroups=[]; this.allElimGroups=[]
    this.elimProg=0; this.teamChars=[]; this.lockedBead=null; this.healRate=1

    // 动画
    this.particles=[]; this.shakeT=0; this.shakeI=0; this.btnP={}

    // 引导
    this.guideStep=0; this.showGuide=false

    // 弹窗
    this.toast=null; this.toastT=0

    this._loadStart = Date.now()
    this.bindTouch()
    this.loop()
    setTimeout(() => { this.scene='home'; this.ta=1; music.playBgm() }, 1500)
  }

  loop() { this.af++; this.update(); this.render(); requestAnimationFrame(()=>this.loop()) }

  update() {
    if(this.ta>0) this.ta=Math.max(0,this.ta-0.05)
    for(let i=this.particles.length-1;i>=0;i--){ const p=this.particles[i]; p.x+=p.vx; p.y+=p.vy; p.vy+=0.05; p.life-=0.02; if(p.life<=0) this.particles.splice(i,1) }
    for(let i=this.dmgFloats.length-1;i>=0;i--){ const d=this.dmgFloats[i]; d.y-=1.2*S; d.life-=0.018; d.sa=Math.min(1,d.sa+0.08); if(d.life<=0) this.dmgFloats.splice(i,1) }
    if(this.comboT>0) this.comboT--
    if(this.shakeT>0) this.shakeT--
    if(this.toastT>0) this.toastT--
    if(this.scene==='battle'){ this.eDisp+=(this.eHp-this.eDisp)*0.1; this.tDisp+=(this.tHp-this.tDisp)*0.1 }
    if(this.bState==='eliminating'&&this.elimAnim>0){ this.elimAnim--; this.elimProg=1-this.elimAnim/30; if(this.elimAnim<=0) this.afterElim() }
  }

  showToast(msg) { this.toast=msg; this.toastT=80 }

  render() {
    ctx.save()
    if(this.shakeT>0) ctx.translate((Math.random()-0.5)*this.shakeI,(Math.random()-0.5)*this.shakeI)
    switch(this.scene){
      case 'loading': this.rLoading(); break
      case 'home': this.rHome(); break
      case 'levelSelect': this.rLevels(); break
      case 'teamEdit': this.rTeam(); break
      case 'battlePrepare': this.rPrep(); break
      case 'battle': this.rBattle(); break
      case 'charDetail': this.rCharDetail(); break
      case 'dailyTask': this.rDailyTask(); break
      case 'achievement': this.rAchievement(); break
    }
    if(this.ta>0){ ctx.fillStyle=`rgba(10,10,20,${this.ta})`; ctx.fillRect(0,0,W,H) }
    // Toast
    if(this.toastT>0&&this.toast){
      const al=Math.min(1,this.toastT/15)
      ctx.globalAlpha=al; ctx.fillStyle='rgba(0,0,0,0.8)'
      const tw=ctx.measureText(this.toast).width+40*S
      R.rr((W-tw)/2,H*0.42,tw,36*S,18*S); ctx.fill()
      ctx.fillStyle='#fff'; ctx.font=`${13*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(this.toast,W/2,H*0.42+18*S); ctx.globalAlpha=1
    }
    ctx.restore()
  }

  // ===== 加载 =====
  rLoading() {
    R.drawBg(this.af)
    const p=Math.min(1,(Date.now()-this._loadStart)/1400), cy=H*0.4
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=30*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${48*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('龙珠战纪',W/2,cy)
    ctx.shadowBlur=0; ctx.restore()
    const bw=W*0.5,bh=4*S,bx2=(W-bw)/2,by2=cy+60*S
    ctx.fillStyle='rgba(255,255,255,0.1)'; R.rr(bx2,by2,bw,bh,bh/2); ctx.fill()
    const g=ctx.createLinearGradient(bx2,by2,bx2+bw*p,by2); g.addColorStop(0,TH.accent); g.addColorStop(1,TH.danger)
    ctx.fillStyle=g; R.rr(bx2,by2,bw*p,bh,bh/2); ctx.fill()
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`; ctx.fillText('加载中...',W/2,by2+24*S)
  }

  // ===== 首页 =====
  rHome() {
    R.drawBg(this.af)
    ctx.save(); ctx.globalAlpha=0.06
    const gr=ctx.createRadialGradient(W/2,H*0.3,0,W/2,H*0.3,W*0.6)
    gr.addColorStop(0,TH.accent); gr.addColorStop(1,'transparent'); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H); ctx.restore()

    const ty=H*0.13
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=25*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${44*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('龙珠战纪',W/2,ty)
    ctx.shadowBlur=0; ctx.restore()
    ctx.fillStyle=TH.sub; ctx.font=`${13*S}px "PingFang SC",sans-serif`
    ctx.fillText('— 转珠消除 × 回合RPG —',W/2,ty+34*S)

    const oy=ty+62*S
    BEAD_ATTRS.forEach((a,i)=>{
      const x=W/2+(i-2.5)*38*S
      ctx.globalAlpha=0.85+0.15*Math.sin(this.af*0.04+i*1.2)
      R.drawBead(x,oy,13*S,a); ctx.globalAlpha=1
    })

    const bw=W*0.62,bh=46*S,bx2=(W-bw)/2
    let sy=H*0.38
    R.drawBtn(bx2,sy,bw,bh,'开始战斗',TH.danger,'#c0392b',15,this.btnP.hs)
    R.drawBtn(bx2,sy+=56*S,bw,bh,'关卡选择',TH.info,'#2471a3',15,this.btnP.hl)
    R.drawBtn(bx2,sy+=56*S,bw,bh,'编辑队伍',TH.success,'#1e8449',15,this.btnP.ht)
    R.drawBtn(bx2,sy+=56*S,bw,bh,'角色养成','#8e44ad','#5b2c8e',15,this.btnP.hg)
    R.drawBtn(bx2,sy+=56*S,bw,bh,'每日任务',TH.hard,'#e67e22',15,this.btnP.hd)
    R.drawBtn(bx2,sy+=56*S,bw,bh,'成就',TH.accent,'#d4941e',15,this.btnP.ha)

    ctx.fillStyle=TH.dim; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`金币: ${this.storage.gold}  ·  角色: ${this.storage.unlockedChars.length}/${CHARACTERS.length}`,W/2,H-30*S)
  }

  // ===== 关卡选择（含难度tab） =====
  rLevels() {
    R.drawBg(this.af); R.drawTopBar('关卡选择',true)
    const barH=safeTop+44*S

    // 难度切换tab
    const diffs=['normal','hard','extreme'], dNames=['普通','困难','极难']
    const tw=W*0.28, th=30*S, tsy=barH+10*S, tgap=6*S
    const tsx=(W-tw*3-tgap*2)/2
    diffs.forEach((d,i)=>{
      const x=tsx+i*(tw+tgap), ul=this.storage.isDifficultyUnlocked(d)
      const active=this.curDiff===d
      if(ul) R.drawDiffTag(x,tsy,tw,th,dNames[i],DC[d],active)
      else { ctx.globalAlpha=0.3; R.drawDiffTag(x,tsy,tw,th,'🔒'+dNames[i],DC[d],false); ctx.globalAlpha=1 }
    })

    // 进度
    const prog=this.storage.levelProgress[this.curDiff]
    const passed=prog.filter(v=>v).length
    ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`进度: ${passed}/8`,W/2,tsy+th+16*S)

    const sty=tsy+th+28*S, isz=W/4.5, cols=3
    const gx=(W-cols*isz)/(cols+1), gy=24*S

    BASE_LEVELS.forEach((lv,i)=>{
      const col=i%cols, row=Math.floor(i/cols)
      const x=gx+col*(isz+gx), y=sty+row*(isz+gy+24*S)
      const cx=x+isz/2, cy=y+isz/2
      const ul=this.storage.isLevelUnlocked(lv.levelId)
      const pa=this.storage.getLevelPassedInDifficulty(lv.levelId,this.curDiff)
      const a=A[lv.enemy.attr]

      ctx.save()
      if(ul){
        ctx.beginPath(); ctx.arc(cx,cy,isz/2+4*S,0,Math.PI*2)
        ctx.fillStyle=pa?'rgba(245,166,35,0.15)':a.gw.replace('0.5','0.1'); ctx.fill()
        ctx.beginPath(); ctx.arc(cx,cy,isz/2,0,Math.PI*2)
        const rg=ctx.createRadialGradient(cx-isz*0.15,cy-isz*0.15,0,cx,cy,isz/2)
        rg.addColorStop(0,a.lt); rg.addColorStop(0.7,a.main); rg.addColorStop(1,a.dk); ctx.fillStyle=rg; ctx.fill()
        ctx.beginPath(); ctx.ellipse(cx,cy-isz*0.18,isz*0.32,isz*0.2,0,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fill()
      } else {
        ctx.beginPath(); ctx.arc(cx,cy,isz/2,0,Math.PI*2); ctx.fillStyle='rgba(255,255,255,0.05)'; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(cx,cy,isz/2,0,Math.PI*2)
      ctx.strokeStyle=pa?TH.accent:ul?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.06)'; ctx.lineWidth=pa?2.5*S:1*S; ctx.stroke()

      ctx.globalAlpha=ul?1:0.35; ctx.fillStyle='#fff'
      ctx.font=`bold ${24*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(ul?lv.levelId:'🔒',cx,cy-2*S)
      ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.fillText(lv.levelName,cx,cy+isz/2+16*S)
      if(pa){ ctx.fillStyle=DC[this.curDiff]; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`; ctx.fillText('★ 已通关',cx,cy+14*S) }
      ctx.restore()
    })
  }

  // ===== 战斗准备 =====
  rPrep() {
    R.drawBg(this.af); R.drawTopBar('战斗准备',true)
    const barH=safeTop+44*S, lv=this.lvData; if(!lv) return
    const a=A[lv.enemy.attr]

    // 难度标识
    ctx.fillStyle=DC[this.curDiff]; ctx.font=`bold ${12*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`【${DIFFICULTY[this.curDiff].name}】`,W/2,barH+18*S)

    ctx.fillStyle=TH.text; ctx.font=`bold ${18*S}px "PingFang SC",sans-serif`
    ctx.fillText(`第${lv.levelId}关 · ${lv.levelName}`,W/2,barH+40*S)

    const cy2=barH+55*S, cw=W*0.7, ch2=150*S, cx2=(W-cw)/2
    ctx.fillStyle=TH.card; R.rr(cx2,cy2,cw,ch2,12*S); ctx.fill()
    ctx.strokeStyle=TH.cardB; ctx.lineWidth=1; R.rr(cx2,cy2,cw,ch2,12*S); ctx.stroke()

    const ey=cy2+50*S
    R.drawEnemy(W/2,ey,32*S,lv.enemy.attr,this.af)
    ctx.fillStyle='#fff'; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText(lv.enemy.enemyName,W/2,ey+44*S)
    ctx.fillStyle=a.lt; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${lv.enemy.attr}属性  ·  HP ${lv.enemy.hp}  ·  ATK ${lv.enemy.atk}`,W/2,ey+60*S)

    // 敌方AI提示
    if(lv.enemyAI){
      ctx.fillStyle=TH.danger; ctx.font=`${10*S}px "PingFang SC",sans-serif`
      if(this.curDiff==='hard') ctx.fillText('⚠ 敌方每2回合释放技能',W/2,ey+76*S)
      else if(this.curDiff==='extreme') ctx.fillText('⚠ 敌方每回合50%概率释放强力技能',W/2,ey+76*S)
    }

    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('— 我方队伍 —',W/2,cy2+ch2+24*S)
    const tcy=cy2+ch2+50*S, ir=22*S, team=this.getTeam()
    team.forEach((c2,i)=>{ if(!c2) return; const x=W/2+(i-(team.length-1)/2)*(ir*2+12*S); R.drawChar(x,tcy,ir,c2,false,this.af) })

    const bw=W*0.38,bh=44*S,byy=H*0.84
    R.drawBtn(W/2-bw-8*S,byy,bw,bh,'编辑队伍',TH.info,'#2471a3',13,this.btnP.pt)
    R.drawBtn(W/2+8*S,byy,bw,bh,'开始战斗',TH.danger,'#a93226',13,this.btnP.ps)
  }

  // ===== 队伍编辑 =====
  rTeam() {
    R.drawBg(this.af); R.drawTopBar('编辑队伍',true)
    const barH=safeTop+44*S, tcY=barH+8*S, tcH=110*S

    ctx.fillStyle=TH.card; ctx.fillRect(0,tcY,W,tcH)
    ctx.strokeStyle=TH.cardB; ctx.lineWidth=0.5; ctx.beginPath(); ctx.moveTo(0,tcY+tcH); ctx.lineTo(W,tcY+tcH); ctx.stroke()
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('当前队伍（点击头像移除）',W/2,tcY+14*S)

    const sy=tcY+45*S, sr=22*S
    for(let i=0;i<6;i++){
      const x=W/2+(i-2.5)*(sr*2+12*S), cid=this.storage.teamData[i]
      const ch=cid?CHARACTERS.find(c=>c.charId===cid):null
      if(ch){ R.drawChar(x,sy,sr,ch,false,this.af) }
      else { ctx.beginPath(); ctx.arc(x,sy,sr,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.15)'; ctx.lineWidth=1.5*S; ctx.setLineDash([4*S,4*S]); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle=TH.dim; ctx.font=`${22*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('+',x,sy) }
      if(i===0||i===5){ ctx.fillStyle=i===0?TH.accent:A['暗'].lt; ctx.font=`bold ${8*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText(i===0?'队长':'友队长',x,sy+sr+12*S) }
    }

    const lY=tcY+tcH+12*S
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('可用角色（点击添加到队伍）',W/2,lY+4*S)

    const cdH=62*S, cdW=W-28*S, cdX=14*S
    this.storage.unlockedChars.forEach((cid,i)=>{
      const ch=CHARACTERS.find(c=>c.charId===cid); if(!ch) return
      const y=lY+20*S+i*(cdH+8*S), inT=this.storage.teamData.includes(cid), a=A[ch.attr]
      const gro=this.storage.getCharGrowth(cid)
      ctx.fillStyle=inT?'rgba(255,255,255,0.02)':TH.card; R.rr(cdX,y,cdW,cdH,10*S); ctx.fill()
      ctx.strokeStyle=inT?'rgba(255,255,255,0.04)':TH.cardB; ctx.lineWidth=0.5; R.rr(cdX,y,cdW,cdH,10*S); ctx.stroke()
      ctx.fillStyle=a.main; R.rr(cdX,y,3.5*S,cdH,2*S); ctx.fill()
      R.drawChar(cdX+36*S,y+cdH/2,18*S,ch,false,this.af)
      ctx.globalAlpha=inT?0.35:1; ctx.fillStyle=TH.text; ctx.textAlign='left'; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`; ctx.textBaseline='middle'
      ctx.fillText(ch.charName,cdX+62*S,y+16*S)
      ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.fillStyle=a.lt
      ctx.fillText(`${ch.attr}属性  Lv.${gro.level}`,cdX+62*S,y+32*S)
      const st=this.storage.getCharStats(ch)
      ctx.fillStyle=TH.sub; ctx.fillText(`ATK ${st.atk}  ·  HP ${st.hp}`,cdX+62*S,y+47*S)
      if(ch.activeSkill){ ctx.textAlign='right'; ctx.fillStyle=TH.dim; ctx.font=`${9*S}px "PingFang SC",sans-serif`; ctx.fillText(`${ch.activeSkill.skillName} (CD${Math.floor(st.cd)})`,cdX+cdW-10*S,y+24*S) }
      if(inT){ ctx.textAlign='right'; ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.fillText('已编入',cdX+cdW-10*S,y+44*S) }
      ctx.globalAlpha=1; ctx.textAlign='center'; ctx.textBaseline='middle'
    })

    R.drawBtn((W-W*0.5)/2,H-70*S,W*0.5,44*S,'确认',TH.success,'#1e8449',15,this.btnP.tc)
  }

  // ===== 角色养成详情 =====
  rCharDetail() {
    R.drawBg(this.af); R.drawTopBar('角色养成',true)
    const barH=safeTop+44*S
    const chars=this.storage.unlockedChars
    if(chars.length===0){ ctx.fillStyle=TH.sub; ctx.font=`${14*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('暂无角色',W/2,H*0.4); return }

    const cdH=130*S, cdW=W-28*S, cdX=14*S
    chars.forEach((cid,i)=>{
      const ch=CHARACTERS.find(c=>c.charId===cid); if(!ch) return
      const gro=this.storage.getCharGrowth(cid), a=A[ch.attr], st=this.storage.getCharStats(ch)
      const y=barH+16*S+i*(cdH+10*S)

      ctx.fillStyle=TH.card; R.rr(cdX,y,cdW,cdH,12*S); ctx.fill()
      ctx.strokeStyle=TH.cardB; ctx.lineWidth=1; R.rr(cdX,y,cdW,cdH,12*S); ctx.stroke()
      ctx.fillStyle=a.main; R.rr(cdX,y,4*S,cdH,2*S); ctx.fill()

      R.drawChar(cdX+40*S,y+36*S,24*S,ch,false,this.af)
      ctx.fillStyle=TH.text; ctx.textAlign='left'; ctx.font=`bold ${15*S}px "PingFang SC",sans-serif`; ctx.textBaseline='middle'
      ctx.fillText(ch.charName,cdX+72*S,y+18*S)
      ctx.fillStyle=a.lt; ctx.font=`${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${ch.attr}属性  Lv.${gro.level}/${20+gro.breakCount*5}  突破${gro.breakCount}/3`,cdX+72*S,y+36*S)
      ctx.fillStyle=TH.sub; ctx.fillText(`ATK ${st.atk}  HP ${st.hp}`,cdX+72*S,y+52*S)
      if(ch.activeSkill) ctx.fillText(`技能: ${ch.activeSkill.skillName} Lv.${gro.skillLevel} CD${Math.floor(st.cd)}`,cdX+72*S,y+67*S)

      // 3个操作按钮
      const bw2=cdW/3-8*S, bh2=28*S, by2=y+cdH-38*S
      R.drawBtn(cdX+8*S,by2,bw2,bh2,'升级',TH.info,'#2471a3',10)
      R.drawBtn(cdX+8*S+bw2+6*S,by2,bw2,bh2,'强化技能',TH.hard,'#e67e22',10)
      R.drawBtn(cdX+8*S+(bw2+6*S)*2,by2,bw2,bh2,'突破',TH.danger,'#a93226',10)
    })

    // 材料信息
    const m=this.storage.materials
    const my=barH+16*S+chars.length*(cdH+10*S)+6*S
    ctx.fillStyle=TH.card; R.rr(cdX,my,cdW,50*S,10*S); ctx.fill()
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
    ctx.fillText(`经验道具: ${m.expItem}  技能材料: ${m.skillMat}  突破材料: ${m.rareMat}`,W/2,my+16*S)
    const stones=Object.entries(m.attrStone).map(([k,v])=>`${k}${v}`).join(' ')
    ctx.fillText(`属性石: ${stones}`,W/2,my+36*S)
  }

  // ===== 每日任务 =====
  rDailyTask() {
    R.drawBg(this.af); R.drawTopBar('每日任务',true)
    const barH=safeTop+44*S, dt=this.storage.dailyTask
    const taskTexts=['完成1次任意关卡挑战','达成1次Combo≥5','挑战1次周回/困难关卡']
    const mx=20*S, tw=W-40*S, sy=barH+20*S

    taskTexts.forEach((t,i)=>{
      R.drawTaskCard(mx,sy+i*50*S,tw,40*S,t,dt.tasks[i])
    })

    const ay=sy+160*S
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText('全部完成可领取稀有材料×1',W/2,ay)
    const allDone=dt.tasks.every(v=>v)
    const bw=W*0.5,bh=42*S
    if(allDone&&!dt.rewardGot) R.drawBtn((W-bw)/2,ay+16*S,bw,bh,'领取奖励',TH.accent,'#d4941e',14,this.btnP.dr)
    else if(dt.rewardGot){ ctx.fillStyle=TH.success; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`; ctx.fillText('✓ 已领取',W/2,ay+38*S) }

    // 周回挑战区域
    const wy=ay+80*S
    ctx.fillStyle=TH.text; ctx.font=`bold ${16*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText('周回挑战',W/2,wy)
    const wc=this.storage.weeklyChallenge
    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`本周关卡: 第${wc.weeklyLevelId}关  ·  剩余次数: ${wc.count}/3`,W/2,wy+24*S)
    ctx.fillText(`最佳Combo: ${wc.bestCombo}`,W/2,wy+42*S)
    if(wc.count>0) R.drawBtn((W-bw)/2,wy+56*S,bw,bh,'挑战周回',TH.info,'#2471a3',14,this.btnP.wc)
  }

  // ===== 成就 =====
  rAchievement() {
    R.drawBg(this.af); R.drawTopBar('成就',true)
    const barH=safeTop+44*S
    const list=this.storage.getAchievementList()
    const mx=20*S, tw=W-40*S

    list.forEach((ach,i)=>{
      const y=barH+16*S+i*60*S
      const data=this.storage.achievements[ach.id]
      const done=data&&data.completed
      ctx.fillStyle=done?'rgba(39,174,96,0.08)':TH.card; R.rr(mx,y,tw,50*S,10*S); ctx.fill()
      ctx.strokeStyle=done?TH.success:TH.cardB; ctx.lineWidth=1; R.rr(mx,y,tw,50*S,10*S); ctx.stroke()
      ctx.fillStyle=done?TH.success:TH.text; ctx.font=`bold ${13*S}px "PingFang SC",sans-serif`; ctx.textAlign='left'; ctx.textBaseline='middle'
      ctx.fillText((done?'✓ ':'')+ach.name,mx+12*S,y+16*S)
      ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(ach.desc,mx+12*S,y+36*S)
      if(done&&data&&!data.claimedReward){
        R.drawBtn(mx+tw-70*S,y+10*S,60*S,30*S,'领取',TH.accent,'#d4941e',10)
      }
    })
  }

  // ===== 战斗界面 =====
  rBattle() {
    const g=ctx.createLinearGradient(0,0,0,H)
    g.addColorStop(0,'#080814'); g.addColorStop(0.35,'#10102a'); g.addColorStop(1,'#060610')
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
    const t=this.af*0.01
    R.bgStars.forEach(s=>{
      ctx.fillStyle=`rgba(255,255,255,${0.15+0.2*Math.sin(t*s.sp*5+s.ph)})`
      ctx.beginPath(); ctx.arc(s.x,(s.y+this.af*s.sp*0.3)%H,s.r*S,0,Math.PI*2); ctx.fill()
    })

    const lv=this.lvData; if(!lv) return; const a=A[lv.enemy.attr]
    const topY=safeTop+6*S

    // 难度+回合
    ctx.fillStyle=DC[this.curDiff]; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`; ctx.textAlign='left'; ctx.textBaseline='top'
    ctx.fillText(DIFFICULTY[this.curDiff].name,14*S,topY)
    ctx.fillStyle=TH.dim; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.textAlign='right'
    ctx.fillText(`回合 ${this.turn}`,W-14*S,topY)

    // 敌方
    const eiX=44*S, eiY=topY+30*S
    R.drawEnemy(eiX,eiY,24*S,lv.enemy.attr,this.af)
    ctx.fillStyle=TH.sub; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(lv.enemy.enemyName,eiX,eiY+34*S)

    const ehX=80*S, ehY=eiY-4*S, ehW=W-ehX-20*S
    R.drawHp(ehX,ehY,ehW,14*S,this.eDisp,this.eMax,TH.danger,'#c0392b')
    ctx.fillStyle=TH.dim; ctx.font=`${9*S}px "PingFang SC",sans-serif`; ctx.textAlign='left'
    ctx.fillText(`${Math.ceil(this.eDisp)} / ${this.eMax}`,ehX,ehY+26*S)

    if(lv.enemy.skill){
      const tl=lv.enemy.skill.triggerTurn-((this.turn-1)%lv.enemy.skill.triggerTurn+1)
      ctx.textAlign='right'; ctx.fillStyle=tl<=0?TH.danger:TH.dim; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(`⚡ ${tl+1}`,W-14*S,ehY+26*S)
    }

    // 我方HP
    const midY=safeTop+78*S
    R.drawHp(14*S,midY,W-28*S,10*S,this.tDisp,this.tMax,TH.success,'#1e8449')
    ctx.fillStyle=TH.dim; ctx.font=`${9*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`HP ${Math.ceil(this.tDisp)} / ${this.tMax}`,W/2,midY+20*S)

    // 队伍
    const cY=midY+44*S, cR=W/16, cSp=W/(this.teamChars.length+1)
    this.teamChars.forEach((ch,i)=>{
      if(!ch) return; const x=cSp*(i+1), cd0=ch._cd===0&&ch.activeSkill
      R.drawChar(x,cY,cR,ch,cd0,this.af)
      if(ch.activeSkill){
        const bx=x+cR*0.65, by2=cY-cR*0.65, br=8*S
        ctx.beginPath(); ctx.arc(bx,by2,br,0,Math.PI*2)
        if(ch._cd>0){ ctx.fillStyle='rgba(0,0,0,0.75)'; ctx.fill(); ctx.fillStyle='#fff'; ctx.font=`bold ${8*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(ch._cd,bx,by2) }
        else { ctx.fillStyle=`rgba(245,166,35,${0.6+0.4*Math.sin(this.af*0.12)})`; ctx.fill(); ctx.fillStyle='#fff'; ctx.font=`bold ${9*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('!',bx,by2) }
      }
      ctx.fillStyle=TH.dim; ctx.font=`${8*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText(ch.charName,x,cY+cR+11*S)
    })

    // 状态
    const stY=cY+cR+26*S
    ctx.textAlign='center'; ctx.font=`bold ${12*S}px "PingFang SC",sans-serif`
    const sm={playerTurn:{t:'▶ 滑动转珠',c:TH.accent},eliminating:{t:'⚡ 消除中...',c:TH.danger},settling:{t:'⚡ 结算中...',c:TH.danger},enemyTurn:{t:'⚠ 敌方回合',c:'#ff6b6b'},victory:{t:'🎉 胜利！',c:TH.success},defeat:{t:'💀 失败',c:TH.danger}}
    const s=sm[this.bState]; if(s){ ctx.fillStyle=s.c; ctx.fillText(s.t,W/2,stY) }

    // 宝珠封锁提示
    if(this.lockedBead){ ctx.fillStyle=TH.danger; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.fillText(`⚠ ${this.lockedBead}珠已被封锁`,W/2,stY+16*S) }

    this.rBoard()

    // Combo
    if(this.comboT>0&&this.comboDisp>0){
      const ca=Math.min(1,this.comboT/20), cs=1+0.2*(1-ca)
      ctx.save(); ctx.globalAlpha=ca; ctx.translate(W/2,this.by-20*S); ctx.scale(cs,cs)
      ctx.shadowColor=TH.accent; ctx.shadowBlur=15*S; ctx.fillStyle=TH.accent
      ctx.font=`bold ${34*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${this.comboDisp} Combo!`,0,0); ctx.shadowBlur=0; ctx.restore()
    }

    this.dmgFloats.forEach(d=>{
      const al=Math.min(1,d.life*2.5)
      ctx.save(); ctx.globalAlpha=al; ctx.translate(d.x,d.y); ctx.scale(d.sa,d.sa)
      ctx.shadowColor=d.color; ctx.shadowBlur=8*S; ctx.fillStyle=d.color
      ctx.font=`bold ${d.size}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(d.text,0,0); ctx.shadowBlur=0; ctx.restore()
    })

    this.particles.forEach(p=>{ ctx.globalAlpha=p.life*0.8; ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2); ctx.fill() })
    ctx.globalAlpha=1

    if(this.bState==='victory') this.rVicModal()
    if(this.bState==='defeat') this.rDefModal()
    if(this.showGuide) this.rGuide()
  }

  rBoard() {
    const ox=this.bx,oy=this.by,bs=this.bs,p=8*S
    ctx.fillStyle='rgba(0,0,0,0.35)'; R.rr(ox-p,oy-p,this.cols*bs+p*2,this.rows*bs+p*2,12*S); ctx.fill()
    ctx.strokeStyle='rgba(255,255,255,0.06)'; ctx.lineWidth=1; R.rr(ox-p,oy-p,this.cols*bs+p*2,this.rows*bs+p*2,12*S); ctx.stroke()
    ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.lineWidth=0.5
    for(let i=1;i<this.rows;i++){ ctx.beginPath(); ctx.moveTo(ox,oy+i*bs); ctx.lineTo(ox+this.cols*bs,oy+i*bs); ctx.stroke() }
    for(let j=1;j<this.cols;j++){ ctx.beginPath(); ctx.moveTo(ox+j*bs,oy); ctx.lineTo(ox+j*bs,oy+this.rows*bs); ctx.stroke() }

    for(let i=0;i<this.rows;i++) for(let j=0;j<this.cols;j++){
      const b=this.beads[i]&&this.beads[i][j]; if(!b) continue
      const cx=ox+j*bs+bs/2, cy=oy+i*bs+bs/2
      if(b._elim){ const al=1-this.elimProg, sc=1-this.elimProg*0.3; if(al<=0) continue; ctx.globalAlpha=al; R.drawBead(cx,cy,(bs/2-3*S)*sc,b.attr); ctx.globalAlpha=1; continue }
      if(b.alpha<=0) continue
      const r=(bs/2-3*S)*(b.scale||1)
      // 被封锁的宝珠暗化
      const locked=this.lockedBead&&b.attr===this.lockedBead
      ctx.globalAlpha=(b.alpha||1)*(locked?0.35:1)
      R.drawBead(cx+(b.offsetX||0),cy+(b.offsetY||0),r,b.attr)
      if(this.selBead&&this.selBead.row===i&&this.selBead.col===j){
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2.5*S; ctx.beginPath(); ctx.arc(cx,cy,r+3*S,0,Math.PI*2); ctx.stroke()
        ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.5*S; ctx.beginPath(); ctx.arc(cx,cy,r+6*S,0,Math.PI*2); ctx.stroke()
      }
      ctx.globalAlpha=1
    }
  }

  rVicModal() {
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H)
    const mw=W*0.82,mh=310*S,mx=(W-mw)/2,my=(H-mh)/2
    ctx.fillStyle='#161630'; R.rr(mx,my,mw,mh,16*S); ctx.fill()
    const tg=ctx.createLinearGradient(mx,my,mx+mw,my); tg.addColorStop(0,TH.accent); tg.addColorStop(0.5,TH.danger); tg.addColorStop(1,TH.accent)
    ctx.fillStyle=tg; R.rr(mx,my,mw,4*S,16*S); ctx.fill()
    ctx.strokeStyle='rgba(245,166,35,0.2)'; ctx.lineWidth=1; R.rr(mx,my,mw,mh,16*S); ctx.stroke()

    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=15*S; ctx.fillStyle=TH.accent
    ctx.font=`bold ${28*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('战斗胜利！',W/2,my+45*S); ctx.shadowBlur=0; ctx.restore()

    const lv=this.lvData
    ctx.fillStyle=DC[this.curDiff]; ctx.font=`bold ${11*S}px "PingFang SC",sans-serif`; ctx.fillText(`【${DIFFICULTY[this.curDiff].name}】`,W/2,my+70*S)
    ctx.fillStyle=TH.text; ctx.font=`${14*S}px "PingFang SC",sans-serif`; ctx.fillText(`💰 金币 +${lv.reward.gold}`,W/2,my+95*S)
    if(lv.reward.charId){ const nc=CHARACTERS.find(c=>c.charId===lv.reward.charId); if(nc){ ctx.fillStyle=A[nc.attr].lt; ctx.fillText(`🎁 解锁: ${nc.charName}`,W/2,my+117*S) } }

    // 材料奖励提示
    const matTxt=this.curDiff==='normal'?'经验×2 材料×1':this.curDiff==='hard'?'经验×4 材料×2 技能材料×1':'经验×6 材料×3 技能材料×2 突破材料×1'
    ctx.fillStyle=TH.sub; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.fillText(`📦 ${matTxt}`,W/2,my+140*S)
    ctx.fillStyle=TH.dim; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.fillText(`用时 ${this.turn} 回合  最高Combo ${this.combo}`,W/2,my+162*S)

    const bw2=mw*0.38,bh2=40*S,byy=my+mh-62*S
    R.drawBtn(mx+12*S,byy,bw2,bh2,'返回关卡',TH.info,'#2471a3',13)
    if(BASE_LEVELS.find(l=>l.levelId===lv.levelId+1)) R.drawBtn(mx+mw-bw2-12*S,byy,bw2,bh2,'下一关',TH.danger,'#a93226',13)
  }

  rDefModal() {
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H)
    const mw=W*0.82,mh=230*S,mx=(W-mw)/2,my=(H-mh)/2
    ctx.fillStyle='#161630'; R.rr(mx,my,mw,mh,16*S); ctx.fill()
    ctx.fillStyle=TH.danger; R.rr(mx,my,mw,4*S,16*S); ctx.fill()
    ctx.strokeStyle='rgba(231,76,60,0.2)'; ctx.lineWidth=1; R.rr(mx,my,mw,mh,16*S); ctx.stroke()

    ctx.fillStyle=TH.danger; ctx.font=`bold ${28*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('战斗失败',W/2,my+50*S)
    ctx.fillStyle=TH.sub; ctx.font=`${13*S}px "PingFang SC",sans-serif`; ctx.fillText('调整队伍再来一次！',W/2,my+90*S)

    const bw2=mw*0.38,bh2=40*S,byy=my+mh-60*S
    R.drawBtn(mx+12*S,byy,bw2,bh2,'返回关卡',TH.info,'#2471a3',13)
    R.drawBtn(mx+mw-bw2-12*S,byy,bw2,bh2,'重新挑战',TH.danger,'#a93226',13)
  }

  rGuide() {
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H)
    const ts=['滑动宝珠，连成3个及以上\n即可消除！','消除宝珠可触发攻击\n对敌方造成伤害！','点击角色头像\n可释放主动技能！','通关可获得奖励\n解锁新角色！']
    const txt=ts[this.guideStep]||'', ls=txt.split('\n')
    const bw=W*0.72,bh=110*S,bx2=(W-bw)/2,by2=H*0.35
    ctx.fillStyle='rgba(22,22,48,0.95)'; R.rr(bx2,by2,bw,bh,14*S); ctx.fill()
    ctx.strokeStyle=TH.accent; ctx.lineWidth=1.5*S; R.rr(bx2,by2,bw,bh,14*S); ctx.stroke()
    ctx.fillStyle=TH.text; ctx.font=`${14*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ls.forEach((l,i)=>ctx.fillText(l,W/2,by2+32*S+i*24*S))
    ctx.fillStyle=TH.accent; ctx.font=`${12*S}px "PingFang SC",sans-serif`; ctx.fillText(`点击继续 (${this.guideStep+1}/4)`,W/2,by2+bh-14*S)
  }

  // ===== 游戏逻辑 =====
  initBoard() {
    let att=0
    do {
      this.beads=[]
      for(let i=0;i<this.rows;i++){ const row=[]
        for(let j=0;j<this.cols;j++){ let at
          do { at=BEAD_ATTRS[Math.floor(Math.random()*6)] }
          while((j>=2&&row[j-1].attr===at&&row[j-2].attr===at)||(i>=2&&this.beads[i-1][j].attr===at&&this.beads[i-2][j].attr===at))
          row.push({attr:at,scale:1,alpha:1,offsetX:0,offsetY:0}) }
        this.beads.push(row) }
      att++
    } while(this.checkElim().length>0&&att<100)
  }

  checkElim() {
    const gs=[], mk=Array.from({length:this.rows},()=>Array(this.cols).fill(false))
    for(let i=0;i<this.rows;i++) for(let j=0;j<this.cols-2;j++){
      const at=this.beads[i][j].attr
      if(at===this.beads[i][j+1].attr&&at===this.beads[i][j+2].attr){
        let e=j+2; while(e+1<this.cols&&this.beads[i][e+1].attr===at) e++
        const g2={attr:at,cells:[]}; for(let k=j;k<=e;k++) if(!mk[i][k]){g2.cells.push({row:i,col:k});mk[i][k]=true}
        if(g2.cells.length>0) gs.push(g2); j=e } }
    for(let j=0;j<this.cols;j++) for(let i=0;i<this.rows-2;i++){
      const at=this.beads[i][j].attr
      if(at===this.beads[i+1][j].attr&&at===this.beads[i+2][j].attr){
        let e=i+2; while(e+1<this.rows&&this.beads[e+1][j].attr===at) e++
        const g2={attr:at,cells:[]}; for(let k=i;k<=e;k++) if(!mk[k][j]){g2.cells.push({row:k,col:j});mk[k][j]=true}
        if(g2.cells.length>0) gs.push(g2); i=e } }
    return gs
  }

  execElim(groups) {
    this.bState='eliminating'; this.elimGroups=groups
    this.allElimGroups=[...(this.allElimGroups||[]),...groups]; this.elimAnim=30; this.elimProg=0
    let hc=0
    groups.forEach(g=>g.cells.forEach(({row,col})=>{
      const b=this.beads[row][col]; b._elim=true; if(b.attr==='心') hc++
      const cx=this.bx+col*this.bs+this.bs/2, cy=this.by+row*this.bs+this.bs/2, cl=A[b.attr].lt
      for(let p=0;p<8;p++){ const ang=Math.PI*2*p/8; this.particles.push({x:cx,y:cy,vx:Math.cos(ang)*(2+Math.random()*2),vy:Math.sin(ang)*(2+Math.random()*2)-1,r:(2+Math.random()*2)*S,color:cl,life:1}) }
    }))
    this.combo+=groups.length; this.comboDisp=this.combo; this.comboT=60
    music.playEliminate(); this._phc=(this._phc||0)+hc
  }

  afterElim() {
    for(let j=0;j<this.cols;j++){
      const nc=[]; for(let i=this.rows-1;i>=0;i--) if(!this.beads[i][j]._elim) nc.unshift(this.beads[i][j])
      while(nc.length<this.rows){ let at; do{at=BEAD_ATTRS[Math.floor(Math.random()*6)]}while(nc.length>=2&&nc[0].attr===at&&nc[1].attr===at); nc.unshift({attr:at,scale:1,alpha:1,offsetX:0,offsetY:0}) }
      for(let i=0;i<this.rows;i++) this.beads[i][j]=nc[i]
    }
    const ng=this.checkElim()
    if(ng.length>0) setTimeout(()=>this.execElim(ng),300)
    else this.settle()
  }

  settle() {
    this.bState='settling'; const hc=this._phc||0; this._phc=0
    const lr=this.getLeaderRate(), acs={}, gs=this.allElimGroups||this.elimGroups
    gs.forEach(g=>{ acs[g.attr]=(acs[g.attr]||0)+g.cells.length })
    let td=0; const cr=Math.pow(1.2,this.combo-1)
    this.teamChars.forEach(ch=>{
      if(!ch||!acs[ch.attr]) return
      const st=this.storage.getCharStats(ch)
      let d=st.atk*cr*lr
      if(COUNTER_MAP[ch.attr]===this.lvData.enemy.attr) d*=1.5
      td+=Math.floor(d)
    })
    let th=hc*1000*this.healRate
    // 记录combo
    if(this.combo>0) this.storage.recordCombo(this.combo)
    this.eHp=Math.max(0,this.eHp-td); this.tHp=Math.min(this.tMax,this.tHp+th)
    if(td>0){ this.dmgFloats.push({x:W/2,y:safeTop+55*S,text:`-${td}`,color:TH.danger,size:26*S,life:1.5,sa:0}); this.shakeT=12; this.shakeI=6*S; music.playAttack() }
    if(th>0) this.dmgFloats.push({x:W/2,y:H*0.32,text:`+${Math.floor(th)}`,color:TH.success,size:20*S,life:1.5,sa:0})
    setTimeout(()=>{ if(this.eHp<=0) this.victory(); else this.enemyTurn() },1000)
  }

  getLeaderRate() { const l=this.teamChars[0]; return l&&l.leaderSkill?l.leaderSkill.effectRate:1 }

  enemyTurn() {
    this.bState='enemyTurn'; this.turn++
    this.teamChars.forEach(ch=>{ if(ch&&ch.activeSkill&&ch._cd>0) ch._cd-- })
    this.lockedBead=null; this.healRate=1 // 重置封锁和减回血

    const en=this.lvData.enemy
    const baseAtk=en.skill&&(this.turn%en.skill.triggerTurn===0)
    const ai=this.lvData.enemyAI

    setTimeout(()=>{
      let dmg=0, aiMsg=''

      // 基础攻击
      if(baseAtk){
        dmg=en.atk
      }

      // 困难AI：每2回合释放小技能
      if(ai&&this.curDiff==='hard'&&this.turn%2===0){
        const sk=ai.skills[Math.floor(Math.random()*ai.skills.length)]
        if(sk.type==='reduceHeal'){ this.healRate=0.5; aiMsg='敌方减少我方50%回血！' }
        else if(sk.type==='lockBead'){ this.lockedBead=BEAD_ATTRS[Math.floor(Math.random()*5)]; aiMsg=`敌方封锁${this.lockedBead}珠1回合！` }
      }

      // 极难AI：每回合50%释放强力技能
      if(ai&&this.curDiff==='extreme'&&Math.random()<0.5){
        const sk=ai.skills[Math.floor(Math.random()*ai.skills.length)]
        if(sk.type==='aoeAttack'){ dmg=Math.floor(en.atk*1.5); aiMsg='敌方释放全屏伤害！' }
        else if(sk.type==='convertBead'){
          for(let r=0;r<this.rows;r++) for(let c=0;c<this.cols;c++) if(this.beads[r][c].attr===sk.from) this.beads[r][c].attr=sk.to
          aiMsg='敌方将所有心珠转为暗珠！'
        }
      }

      if(dmg>0){
        this.tHp=Math.max(0,this.tHp-dmg)
        this.dmgFloats.push({x:W/2,y:H*0.28,text:`-${dmg}`,color:'#ff6b6b',size:24*S,life:1.5,sa:0})
        this.shakeT=15; this.shakeI=8*S; music.playAttack()
      }
      if(aiMsg) this.showToast(aiMsg)

      setTimeout(()=>{
        if(this.tHp<=0) this.bState='defeat'
        else this.startPT()
      }, dmg>0||aiMsg?1000:200)
    },800)
  }

  startPT() { this.bState='playerTurn'; this.combo=0; this._phc=0; this.elimGroups=[]; this.allElimGroups=[] }

  victory() {
    this.bState='victory'
    this.storage.passLevel(this.lvData.levelId, this.lvData.reward, this.curDiff)
    this.storage.addMaterials(this.curDiff)
    this.storage.updateBestRecord(this.lvData.levelId, this.curDiff, this.turn, this.combo)
    // 检查成就
    const newAch=this.storage.checkAchievements()
    if(newAch.length>0) setTimeout(()=>this.showToast(`🏆 达成成就: ${newAch[0].name}`),1500)
  }

  startBattle(lv) {
    this.lvData=lv; this.scene='battle'; this.ta=1
    this.teamChars=this.getTeam()

    // 应用养成属性
    this.teamChars.forEach(ch=>{
      if(!ch) return
      const st=this.storage.getCharStats(ch)
      ch._realAtk=st.atk; ch._realHp=st.hp
      if(ch.activeSkill) ch._cd=Math.floor(st.cd)
    })

    this.eMax=lv.enemy.hp; this.eHp=lv.enemy.hp; this.eDisp=lv.enemy.hp
    this.tMax=this.teamChars.reduce((s,c)=>s+(c?this.storage.getCharStats(c).hp:0),0)
    this.tHp=this.tMax; this.tDisp=this.tMax
    this.turn=1; this.combo=0; this.dmgFloats=[]; this.particles=[]
    this._phc=0; this.allElimGroups=[]; this.lockedBead=null; this.healRate=1
    this.initBoard(); this.bState='playerTurn'
    if(!this.storage.firstEnter){ this.showGuide=true; this.guideStep=0 }
  }

  getTeam() { return this.storage.teamData.map(id=>{ if(!id) return null; const c=CHARACTERS.find(c2=>c2.charId===id); return c?JSON.parse(JSON.stringify(c)):null }) }

  useSkill(i) {
    const ch=this.teamChars[i]; if(!ch||!ch.activeSkill||ch._cd>0||this.bState!=='playerTurn') return
    const sk=ch.activeSkill
    if(sk.effectType==='beadConvert') for(let r=0;r<this.rows;r++) for(let c=0;c<this.cols;c++) if(this.beads[r][c].attr===sk.param.fromBead) this.beads[r][c].attr=sk.param.toBead
    const st=this.storage.getCharStats(ch)
    ch._cd=Math.floor(st.cd); music.playEliminate()
    const gs=this.checkElim(); if(gs.length>0) this.execElim(gs)
  }

  // ===== 触摸 =====
  bindTouch() {
    wx.onTouchStart(e=>{ const t=e.touches[0]; this.handleTouch(t.clientX*DPR,t.clientY*DPRH) })
    wx.onTouchMove(e=>{ if(!this.isDrag||this.scene!=='battle') return; const t=e.touches[0]; this.handleMove(t.clientX*DPR,t.clientY*DPRH) })
    wx.onTouchEnd(()=>{ this.btnP={}; if(this.isDrag&&this.scene==='battle') this.handleEnd(); this.isDrag=false })
  }

  handleTouch(x,y) {
    if(this.showGuide){ this.guideStep++; if(this.guideStep>=4){this.showGuide=false;this.storage.setFirstEnter()}; return }
    switch(this.scene){
      case 'home': this.tHome(x,y); break
      case 'levelSelect': this.tLevels(x,y); break
      case 'teamEdit': this.tTeam(x,y); break
      case 'battlePrepare': this.tPrep(x,y); break
      case 'battle': this.tBattle(x,y); break
      case 'charDetail': this.tCharDetail(x,y); break
      case 'dailyTask': this.tDailyTask(x,y); break
      case 'achievement': this.tAchievement(x,y); break
    }
  }

  ir(px,py,rx,ry,rw,rh){ return px>=rx&&px<=rx+rw&&py>=ry&&py<=ry+rh }

  tHome(x,y) {
    const bw=W*0.62,bh=46*S,bx2=(W-bw)/2
    let sy=H*0.38
    if(this.ir(x,y,bx2,sy,bw,bh)){ this.btnP.hs=true; this.lvData=getLevelData(this.storage.currentLevel,this.curDiff)||getLevelData(1,this.curDiff); this.scene='battlePrepare'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+56*S,bw,bh)){ this.btnP.hl=true; this.scene='levelSelect'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+112*S,bw,bh)){ this.btnP.ht=true; this.scene='teamEdit'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+168*S,bw,bh)){ this.btnP.hg=true; this.scene='charDetail'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+224*S,bw,bh)){ this.btnP.hd=true; this.storage.checkDailyReset(); this.storage.checkWeeklyReset(); this.scene='dailyTask'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+280*S,bw,bh)){ this.btnP.ha=true; this.scene='achievement'; this.ta=1; return }
  }

  tLevels(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='home'; this.ta=1; return }

    // 难度tab点击
    const barH=safeTop+44*S
    const diffs=['normal','hard','extreme']
    const tw=W*0.28, th=30*S, tsy=barH+10*S, tgap=6*S
    const tsx=(W-tw*3-tgap*2)/2
    for(let i=0;i<3;i++){
      const tx=tsx+i*(tw+tgap)
      if(this.ir(x,y,tx,tsy,tw,th)&&this.storage.isDifficultyUnlocked(diffs[i])){
        this.curDiff=diffs[i]; this.storage.currentDifficulty=diffs[i]; this.storage.save(); return
      }
    }

    const sty=tsy+th+28*S, isz=W/4.5, cols=3, gx=(W-cols*isz)/(cols+1), gy=24*S
    BASE_LEVELS.forEach((lv,i)=>{
      const col=i%cols, row=Math.floor(i/cols)
      const cx=gx+col*(isz+gx)+isz/2, cy=sty+row*(isz+gy+24*S)+isz/2
      if(Math.sqrt((x-cx)**2+(y-cy)**2)<=isz/2&&this.storage.isLevelUnlocked(lv.levelId)){
        this.lvData=getLevelData(lv.levelId,this.curDiff)
        this.scene='battlePrepare'; this.ta=1
      }
    })
  }

  tPrep(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='levelSelect'; this.ta=1; return }
    const bw=W*0.38,bh=44*S,byy=H*0.84
    if(this.ir(x,y,W/2-bw-8*S,byy,bw,bh)){ this.btnP.pt=true; this.scene='teamEdit'; this.ta=1; return }
    if(this.ir(x,y,W/2+8*S,byy,bw,bh)){ this.btnP.ps=true; this.startBattle(this.lvData); return }
  }

  tTeam(x,y) {
    const barH=safeTop+44*S
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene=this.lvData?'battlePrepare':'home'; this.ta=1; return }
    const tcY=barH+8*S,sy=tcY+45*S,sr=22*S
    for(let i=0;i<6;i++){ const sx=W/2+(i-2.5)*(sr*2+12*S); if(Math.sqrt((x-sx)**2+(y-sy)**2)<=sr){ if(this.storage.teamData[i]){this.storage.teamData[i]=null;this.storage.save()}; return } }
    const lY=tcY+110*S+12*S, cdH=62*S, cdW=W-28*S, cdX=14*S
    this.storage.unlockedChars.forEach((cid,i)=>{ const cy=lY+20*S+i*(cdH+8*S)
      if(this.ir(x,y,cdX,cy,cdW,cdH)){ if(this.storage.teamData.includes(cid)) return; const es=this.storage.teamData.indexOf(null); if(es!==-1){this.storage.teamData[es]=cid;this.storage.save()} } })
    if(this.ir(x,y,(W-W*0.5)/2,H-70*S,W*0.5,44*S)){ this.btnP.tc=true; this.scene=this.lvData?'battlePrepare':'home'; this.ta=1 }
  }

  tCharDetail(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='home'; this.ta=1; return }
    const barH=safeTop+44*S, cdH=130*S, cdW=W-28*S, cdX=14*S
    const chars=this.storage.unlockedChars
    chars.forEach((cid,i)=>{
      const ch=CHARACTERS.find(c=>c.charId===cid); if(!ch) return
      const y2=barH+16*S+i*(cdH+10*S)
      const bw2=cdW/3-8*S, bh2=28*S, by2=y2+cdH-38*S
      // 升级
      if(this.ir(x,y,cdX+8*S,by2,bw2,bh2)){ const r=this.storage.levelUp(cid); this.showToast(r.msg); return }
      // 强化技能
      if(this.ir(x,y,cdX+8*S+bw2+6*S,by2,bw2,bh2)){ if(!ch.activeSkill){this.showToast('无主动技能');return}; const r=this.storage.skillUpgrade(cid); this.showToast(r.msg); return }
      // 突破
      if(this.ir(x,y,cdX+8*S+(bw2+6*S)*2,by2,bw2,bh2)){ const r=this.storage.charBreak(cid,ch.attr); this.showToast(r.msg); return }
    })
  }

  tDailyTask(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='home'; this.ta=1; return }
    // 领取每日奖励
    const barH=safeTop+44*S, ay=barH+20*S+160*S, bw=W*0.5, bh=42*S
    if(this.ir(x,y,(W-bw)/2,ay+16*S,bw,bh)){
      const r=this.storage.claimDailyReward(); if(r.success) this.showToast(r.msg); else this.showToast(r.msg)
    }
    // 周回挑战
    const wy=ay+80*S
    if(this.ir(x,y,(W-bw)/2,wy+56*S,bw,bh)){
      const wc=this.storage.weeklyChallenge
      if(wc.count<=0){ this.showToast('今日次数已用完'); return }
      const lv=getLevelData(wc.weeklyLevelId,this.curDiff)
      if(lv){ this._isWeekly=true; this.startBattle(lv) }
    }
  }

  tAchievement(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='home'; this.ta=1; return }
    const barH=safeTop+44*S, list=this.storage.getAchievementList(), mx=20*S, tw=W-40*S
    list.forEach((ach,i)=>{
      const y2=barH+16*S+i*60*S
      const data=this.storage.achievements[ach.id]
      if(data&&data.completed&&!data.claimedReward){
        if(this.ir(x,y,mx+tw-70*S,y2+10*S,60*S,30*S)){
          this.storage.claimAchievementReward(ach.id); this.showToast('奖励已领取')
        }
      }
    })
  }

  tBattle(x,y) {
    if(this.bState==='victory'){
      const mw=W*0.82,mh=310*S,mx=(W-mw)/2,my=(H-mh)/2,bw2=mw*0.38,bh2=40*S,byy=my+mh-62*S
      if(this.ir(x,y,mx+12*S,byy,bw2,bh2)){
        if(this._isWeekly){ this._isWeekly=false; this.storage.useWeeklyChallenge(this.combo) }
        this.scene='levelSelect'; this.ta=1; return
      }
      const nl=BASE_LEVELS.find(l=>l.levelId===this.lvData.levelId+1)
      if(nl&&this.ir(x,y,mx+mw-bw2-12*S,byy,bw2,bh2)){
        this.lvData=getLevelData(nl.levelId,this.curDiff); this.startBattle(this.lvData); return
      }; return
    }
    if(this.bState==='defeat'){
      const mw=W*0.82,mh=230*S,mx=(W-mw)/2,my=(H-mh)/2,bw2=mw*0.38,bh2=40*S,byy=my+mh-60*S
      if(this.ir(x,y,mx+12*S,byy,bw2,bh2)){ this.scene='levelSelect'; this.ta=1; return }
      if(this.ir(x,y,mx+mw-bw2-12*S,byy,bw2,bh2)){ this.startBattle(this.lvData); return }; return
    }
    if(this.bState!=='playerTurn') return

    const midY=safeTop+78*S, cY=midY+44*S, cR=W/16, cSp=W/(this.teamChars.length+1)
    for(let i=0;i<this.teamChars.length;i++){ const ch=this.teamChars[i]; if(!ch) continue; if(Math.sqrt((x-cSp*(i+1))**2+(y-cY)**2)<=cR){ this.useSkill(i); return } }

    const col=Math.floor((x-this.bx)/this.bs), row=Math.floor((y-this.by)/this.bs)
    if(row>=0&&row<this.rows&&col>=0&&col<this.cols){ this.isDrag=true; this.selBead={row,col}; this.lastSwap=null; this.beads[row][col].scale=1.1 }
  }

  handleMove(x,y) {
    if(!this.selBead||this.bState!=='playerTurn') return
    const col=Math.floor((x-this.bx)/this.bs), row=Math.floor((y-this.by)/this.bs)
    if(row<0||row>=this.rows||col<0||col>=this.cols) return
    if(row===this.selBead.row&&col===this.selBead.col) return
    if(Math.abs(row-this.selBead.row)+Math.abs(col-this.selBead.col)!==1) return
    const sr=this.selBead.row,sc=this.selBead.col
    const tmp=this.beads[sr][sc]; this.beads[sr][sc]=this.beads[row][col]; this.beads[row][col]=tmp
    this.lastSwap={row,col}; this.selBead={row,col}
  }

  handleEnd() {
    if(!this.selBead||this.bState!=='playerTurn') return
    this.beads[this.selBead.row][this.selBead.col].scale=1
    const gs=this.checkElim()
    if(gs.length>0) this.execElim(gs)
    this.selBead=null; this.lastSwap=null
  }
}

module.exports = Main
