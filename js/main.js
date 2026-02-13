/**
 * 龙珠战纪 - 转珠消除RPG微信小游戏
 * 全面升级UI（参考智龙迷城/原神风格）
 */
const CHARACTERS = require('./data/characters')
const LEVELS = require('./data/levels')
const Storage = require('./data/storage')
const music = require('./runtime/music')
const { Render, A, TH } = require('./render')

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
    this.scene = 'loading'
    this.af = 0 // animFrame
    this.ta = 1 // transitionAlpha

    // 棋盘
    this.cols=6; this.rows=5; this.bs=W/7; this.beads=[]; this.isDrag=false
    this.selBead=null; this.lastSwap=null
    this.bx=(W-this.cols*this.bs)/2; this.by=H*0.52

    // 战斗
    this.bState='idle'; this.lvData=null
    this.eHp=0; this.eMax=0; this.eDisp=0
    this.tHp=0; this.tMax=0; this.tDisp=0
    this.turn=0; this.combo=0; this.comboDisp=0; this.comboT=0
    this.dmgFloats=[]; this.elimAnim=0; this.elimGroups=[]; this.allElimGroups=[]
    this.elimProg=0; this.teamChars=[]

    // 动画
    this.particles=[]; this.shakeT=0; this.shakeI=0; this.btnP={}

    // 引导
    this.guideStep=0; this.showGuide=false

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
    if(this.scene==='battle'){ this.eDisp+=(this.eHp-this.eDisp)*0.1; this.tDisp+=(this.tHp-this.tDisp)*0.1 }
    if(this.bState==='eliminating'&&this.elimAnim>0){ this.elimAnim--; this.elimProg=1-this.elimAnim/30; if(this.elimAnim<=0) this.afterElim() }
  }

  render() {
    ctx.save()
    if(this.shakeT>0){ ctx.translate((Math.random()-0.5)*this.shakeI,(Math.random()-0.5)*this.shakeI) }
    switch(this.scene){
      case 'loading': this.rLoading(); break
      case 'home': this.rHome(); break
      case 'levelSelect': this.rLevels(); break
      case 'teamEdit': this.rTeam(); break
      case 'battlePrepare': this.rPrep(); break
      case 'battle': this.rBattle(); break
    }
    if(this.ta>0){ ctx.fillStyle=`rgba(10,10,20,${this.ta})`; ctx.fillRect(0,0,W,H) }
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
    // 光圈
    ctx.save(); ctx.globalAlpha=0.06
    const gr=ctx.createRadialGradient(W/2,H*0.3,0,W/2,H*0.3,W*0.6)
    gr.addColorStop(0,TH.accent); gr.addColorStop(1,'transparent'); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H); ctx.restore()

    const ty=H*0.2
    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=25*S
    ctx.fillStyle=TH.accent; ctx.font=`bold ${44*S}px "PingFang SC",sans-serif`
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('龙珠战纪',W/2,ty)
    ctx.shadowBlur=0; ctx.restore()

    ctx.fillStyle=TH.sub; ctx.font=`${13*S}px "PingFang SC",sans-serif`
    ctx.fillText('— 转珠消除 × 回合RPG —',W/2,ty+34*S)

    const oy=ty+72*S
    BEAD_ATTRS.forEach((a,i)=>{
      const x=W/2+(i-2.5)*38*S
      ctx.globalAlpha=0.85+0.15*Math.sin(this.af*0.04+i*1.2)
      R.drawBead(x,oy,13*S,a); ctx.globalAlpha=1
    })

    const bw=W*0.62,bh=50*S,bx2=(W-bw)/2,sy=H*0.48
    R.drawBtn(bx2,sy,bw,bh,'开始战斗',TH.danger,'#c0392b',16,this.btnP.hs)
    R.drawBtn(bx2,sy+66*S,bw,bh,'关卡选择',TH.info,'#2471a3',16,this.btnP.hl)
    R.drawBtn(bx2,sy+132*S,bw,bh,'编辑队伍',TH.success,'#1e8449',16,this.btnP.ht)

    ctx.fillStyle=TH.dim; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`金币: ${this.storage.gold}  ·  已解锁: ${this.storage.unlockedChars.length}/${CHARACTERS.length}`,W/2,H-30*S)
  }

  // ===== 关卡选择 =====
  rLevels() {
    R.drawBg(this.af); R.drawTopBar('关卡选择',true)
    const barH=safeTop+44*S, sty=barH+24*S, isz=W/4.5, cols=3
    const gx=(W-cols*isz)/(cols+1), gy=24*S

    LEVELS.forEach((lv,i)=>{
      const col=i%cols, row=Math.floor(i/cols)
      const x=gx+col*(isz+gx), y=sty+row*(isz+gy+24*S)
      const cx=x+isz/2, cy=y+isz/2
      const ul=this.storage.isLevelUnlocked(lv.levelId), pa=this.storage.isLevelPassed(lv.levelId)
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
      if(pa){ ctx.fillStyle=TH.accent; ctx.font=`bold ${10*S}px "PingFang SC",sans-serif`; ctx.fillText('★ 已通关',cx,cy+14*S) }
      ctx.restore()
    })
  }

  // ===== 战斗准备 =====
  rPrep() {
    R.drawBg(this.af); R.drawTopBar('战斗准备',true)
    const barH=safeTop+44*S, lv=this.lvData; if(!lv) return
    const a=A[lv.enemy.attr]

    ctx.fillStyle=TH.text; ctx.font=`bold ${20*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`第${lv.levelId}关 · ${lv.levelName}`,W/2,barH+30*S)

    // 敌方卡片
    const cy2=barH+55*S, cw=W*0.7, ch2=160*S, cx2=(W-cw)/2
    ctx.fillStyle=TH.card; R.rr(cx2,cy2,cw,ch2,12*S); ctx.fill()
    ctx.strokeStyle=TH.cardB; ctx.lineWidth=1; R.rr(cx2,cy2,cw,ch2,12*S); ctx.stroke()

    const ey=cy2+55*S
    R.drawEnemy(W/2,ey,36*S,lv.enemy.attr,this.af)
    ctx.fillStyle='#fff'; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`; ctx.fillText(lv.enemy.enemyName,W/2,ey+50*S)
    ctx.fillStyle=a.lt; ctx.font=`${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${lv.enemy.attr}属性  ·  HP ${lv.enemy.hp}  ·  ATK ${lv.enemy.atk}`,W/2,ey+68*S)

    ctx.fillStyle=TH.sub; ctx.font=`${12*S}px "PingFang SC",sans-serif`; ctx.fillText('— 我方队伍 —',W/2,cy2+ch2+30*S)
    const ty=cy2+ch2+60*S, ir=22*S, team=this.getTeam()
    team.forEach((c2,i)=>{ if(!c2) return; const x=W/2+(i-(team.length-1)/2)*(ir*2+12*S); R.drawChar(x,ty,ir,c2,false,this.af) })

    const bw=W*0.38,bh=46*S,by=H*0.82
    R.drawBtn(W/2-bw-8*S,by,bw,bh,'编辑队伍',TH.info,'#2471a3',14,this.btnP.pt)
    R.drawBtn(W/2+8*S,by,bw,bh,'开始战斗',TH.danger,'#a93226',14,this.btnP.ps)
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
      ctx.fillStyle=inT?'rgba(255,255,255,0.02)':TH.card; R.rr(cdX,y,cdW,cdH,10*S); ctx.fill()
      ctx.strokeStyle=inT?'rgba(255,255,255,0.04)':TH.cardB; ctx.lineWidth=0.5; R.rr(cdX,y,cdW,cdH,10*S); ctx.stroke()
      ctx.fillStyle=a.main; R.rr(cdX,y,3.5*S,cdH,2*S); ctx.fill()
      R.drawChar(cdX+36*S,y+cdH/2,18*S,ch,false,this.af)
      ctx.globalAlpha=inT?0.35:1; ctx.fillStyle=TH.text; ctx.textAlign='left'; ctx.font=`bold ${14*S}px "PingFang SC",sans-serif`; ctx.textBaseline='middle'
      ctx.fillText(ch.charName,cdX+62*S,y+16*S)
      ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.fillStyle=a.lt; ctx.fillText(`${ch.attr}属性`,cdX+62*S,y+32*S)
      ctx.fillStyle=TH.sub; ctx.fillText(`ATK ${ch.baseAtk}  ·  HP ${ch.baseHp}`,cdX+62*S,y+47*S)
      if(ch.activeSkill){ ctx.textAlign='right'; ctx.fillStyle=TH.dim; ctx.font=`${9*S}px "PingFang SC",sans-serif`; ctx.fillText(`${ch.activeSkill.skillName} (CD${ch.activeSkill.cd})`,cdX+cdW-10*S,y+24*S) }
      if(inT){ ctx.textAlign='right'; ctx.fillStyle=TH.dim; ctx.font=`${10*S}px "PingFang SC",sans-serif`; ctx.fillText('已编入',cdX+cdW-10*S,y+44*S) }
      ctx.globalAlpha=1; ctx.textAlign='center'; ctx.textBaseline='middle'
    })

    R.drawBtn((W-W*0.5)/2,H-70*S,W*0.5,46*S,'确认',TH.success,'#1e8449',15,this.btnP.tc)
  }

  // ===== 战斗界面 =====
  rBattle() {
    const g=ctx.createLinearGradient(0,0,0,H)
    g.addColorStop(0,'#080814'); g.addColorStop(0.35,'#10102a'); g.addColorStop(1,'#060610')
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H)
    // 绘制星空粒子
    const t=this.af*0.01
    R.bgStars.forEach(s=>{
      ctx.fillStyle=`rgba(255,255,255,${0.15+0.2*Math.sin(t*s.sp*5+s.ph)})`
      ctx.beginPath(); ctx.arc(s.x,(s.y+this.af*s.sp*0.3)%H,s.r*S,0,Math.PI*2); ctx.fill()
    })

    const lv=this.lvData; if(!lv) return; const a=A[lv.enemy.attr]
    const topY=safeTop+6*S

    // 回合
    ctx.fillStyle=TH.dim; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.textAlign='right'; ctx.textBaseline='top'
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

    // 我方
    const midY=safeTop+78*S
    R.drawHp(14*S,midY,W-28*S,10*S,this.tDisp,this.tMax,TH.success,'#1e8449')
    ctx.fillStyle=TH.dim; ctx.font=`${9*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'
    ctx.fillText(`HP ${Math.ceil(this.tDisp)} / ${this.tMax}`,W/2,midY+20*S)

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

    // 棋盘
    this.rBoard()

    // Combo
    if(this.comboT>0&&this.comboDisp>0){
      const ca=Math.min(1,this.comboT/20), cs=1+0.2*(1-ca)
      ctx.save(); ctx.globalAlpha=ca; ctx.translate(W/2,this.by-20*S); ctx.scale(cs,cs)
      ctx.shadowColor=TH.accent; ctx.shadowBlur=15*S; ctx.fillStyle=TH.accent
      ctx.font=`bold ${34*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(`${this.comboDisp} Combo!`,0,0); ctx.shadowBlur=0; ctx.restore()
    }

    // 飘字
    this.dmgFloats.forEach(d=>{
      const al=Math.min(1,d.life*2.5)
      ctx.save(); ctx.globalAlpha=al; ctx.translate(d.x,d.y); ctx.scale(d.sa,d.sa)
      ctx.shadowColor=d.color; ctx.shadowBlur=8*S; ctx.fillStyle=d.color
      ctx.font=`bold ${d.size}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.textBaseline='middle'
      ctx.fillText(d.text,0,0); ctx.shadowBlur=0; ctx.restore()
    })

    // 粒子
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
      ctx.globalAlpha=b.alpha||1; R.drawBead(cx+(b.offsetX||0),cy+(b.offsetY||0),r,b.attr)
      if(this.selBead&&this.selBead.row===i&&this.selBead.col===j){
        ctx.strokeStyle='rgba(255,255,255,0.9)'; ctx.lineWidth=2.5*S; ctx.beginPath(); ctx.arc(cx,cy,r+3*S,0,Math.PI*2); ctx.stroke()
        ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.lineWidth=1.5*S; ctx.beginPath(); ctx.arc(cx,cy,r+6*S,0,Math.PI*2); ctx.stroke()
      }
      ctx.globalAlpha=1
    }
  }

  rVicModal() {
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H)
    const mw=W*0.82,mh=290*S,mx=(W-mw)/2,my=(H-mh)/2
    ctx.fillStyle='#161630'; R.rr(mx,my,mw,mh,16*S); ctx.fill()
    const tg=ctx.createLinearGradient(mx,my,mx+mw,my); tg.addColorStop(0,TH.accent); tg.addColorStop(0.5,TH.danger); tg.addColorStop(1,TH.accent)
    ctx.fillStyle=tg; R.rr(mx,my,mw,4*S,16*S); ctx.fill()
    ctx.strokeStyle='rgba(245,166,35,0.2)'; ctx.lineWidth=1; R.rr(mx,my,mw,mh,16*S); ctx.stroke()

    ctx.save(); ctx.shadowColor=TH.accent; ctx.shadowBlur=15*S; ctx.fillStyle=TH.accent
    ctx.font=`bold ${30*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('战斗胜利！',W/2,my+50*S); ctx.shadowBlur=0; ctx.restore()

    const lv=this.lvData
    ctx.fillStyle=TH.text; ctx.font=`${14*S}px "PingFang SC",sans-serif`; ctx.fillText(`💰 金币 +${lv.reward.gold}`,W/2,my+95*S)
    if(lv.reward.charId){ const nc=CHARACTERS.find(c=>c.charId===lv.reward.charId); if(nc){ ctx.fillStyle=A[nc.attr].lt; ctx.fillText(`🎁 解锁: ${nc.charName}`,W/2,my+120*S) } }
    ctx.fillStyle=TH.dim; ctx.font=`${11*S}px "PingFang SC",sans-serif`; ctx.fillText(`用时 ${this.turn} 回合`,W/2,my+150*S)

    const bw2=mw*0.38,bh2=40*S,by=my+mh-62*S
    R.drawBtn(mx+12*S,by,bw2,bh2,'返回关卡',TH.info,'#2471a3',13)
    if(LEVELS.find(l=>l.levelId===lv.levelId+1)) R.drawBtn(mx+mw-bw2-12*S,by,bw2,bh2,'下一关',TH.danger,'#a93226',13)
  }

  rDefModal() {
    ctx.fillStyle='rgba(0,0,0,0.65)'; ctx.fillRect(0,0,W,H)
    const mw=W*0.82,mh=230*S,mx=(W-mw)/2,my=(H-mh)/2
    ctx.fillStyle='#161630'; R.rr(mx,my,mw,mh,16*S); ctx.fill()
    ctx.fillStyle=TH.danger; R.rr(mx,my,mw,4*S,16*S); ctx.fill()
    ctx.strokeStyle='rgba(231,76,60,0.2)'; ctx.lineWidth=1; R.rr(mx,my,mw,mh,16*S); ctx.stroke()

    ctx.fillStyle=TH.danger; ctx.font=`bold ${28*S}px "PingFang SC",sans-serif`; ctx.textAlign='center'; ctx.fillText('战斗失败',W/2,my+50*S)
    ctx.fillStyle=TH.sub; ctx.font=`${13*S}px "PingFang SC",sans-serif`; ctx.fillText('调整队伍再来一次！',W/2,my+90*S)

    const bw2=mw*0.38,bh2=40*S,by=my+mh-60*S
    R.drawBtn(mx+12*S,by,bw2,bh2,'返回关卡',TH.info,'#2471a3',13)
    R.drawBtn(mx+mw-bw2-12*S,by,bw2,bh2,'重新挑战',TH.danger,'#a93226',13)
  }

  rGuide() {
    ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,0,W,H)
    const ts=['滑动宝珠，连成3个及以上\n即可消除！','消除宝珠可触发攻击\n对敌方造成伤害！','点击角色头像\n可释放主动技能！','通关可获得奖励\n解锁新角色！']
    const t=ts[this.guideStep]||'', ls=t.split('\n')
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
    this.teamChars.forEach(ch=>{ if(!ch||!acs[ch.attr]) return; let d=ch.baseAtk*cr*lr; if(COUNTER_MAP[ch.attr]===this.lvData.enemy.attr) d*=1.5; td+=Math.floor(d) })
    const th=hc*1000; this.eHp=Math.max(0,this.eHp-td); this.tHp=Math.min(this.tMax,this.tHp+th)
    if(td>0){ this.dmgFloats.push({x:W/2,y:safeTop+55*S,text:`-${td}`,color:TH.danger,size:26*S,life:1.5,sa:0}); this.shakeT=12; this.shakeI=6*S; music.playAttack() }
    if(th>0) this.dmgFloats.push({x:W/2,y:H*0.32,text:`+${th}`,color:TH.success,size:20*S,life:1.5,sa:0})
    setTimeout(()=>{ if(this.eHp<=0) this.victory(); else this.enemyTurn() },1000)
  }

  getLeaderRate() { const l=this.teamChars[0]; return l&&l.leaderSkill?l.leaderSkill.effectRate:1 }

  enemyTurn() {
    this.bState='enemyTurn'; this.turn++
    this.teamChars.forEach(ch=>{ if(ch&&ch.activeSkill&&ch._cd>0) ch._cd-- })
    const en=this.lvData.enemy, atk=en.skill&&(this.turn%en.skill.triggerTurn===0)
    setTimeout(()=>{
      if(atk){ this.tHp=Math.max(0,this.tHp-en.atk); this.dmgFloats.push({x:W/2,y:H*0.28,text:`-${en.atk}`,color:'#ff6b6b',size:24*S,life:1.5,sa:0}); this.shakeT=15; this.shakeI=8*S; music.playAttack()
        setTimeout(()=>{ if(this.tHp<=0) this.bState='defeat'; else this.startPT() },1000) }
      else this.startPT()
    },800)
  }

  startPT() { this.bState='playerTurn'; this.combo=0; this._phc=0; this.elimGroups=[]; this.allElimGroups=[] }
  victory() { this.bState='victory'; this.storage.passLevel(this.lvData.levelId,this.lvData.reward) }

  startBattle(lv) {
    this.lvData=lv; this.scene='battle'; this.ta=1
    this.teamChars=this.getTeam(); this.eMax=lv.enemy.hp; this.eHp=lv.enemy.hp; this.eDisp=lv.enemy.hp
    this.tMax=this.teamChars.reduce((s,c)=>s+(c?c.baseHp:0),0); this.tHp=this.tMax; this.tDisp=this.tMax
    this.teamChars.forEach(c=>{ if(c&&c.activeSkill) c._cd=c.activeSkill.currentCd })
    this.turn=1; this.combo=0; this.dmgFloats=[]; this.particles=[]; this._phc=0; this.allElimGroups=[]
    this.initBoard(); this.bState='playerTurn'
    if(!this.storage.firstEnter){ this.showGuide=true; this.guideStep=0 }
  }

  getTeam() { return this.storage.teamData.map(id=>{ if(!id) return null; const c=CHARACTERS.find(c2=>c2.charId===id); return c?JSON.parse(JSON.stringify(c)):null }) }

  useSkill(i) {
    const ch=this.teamChars[i]; if(!ch||!ch.activeSkill||ch._cd>0||this.bState!=='playerTurn') return
    const sk=ch.activeSkill
    if(sk.effectType==='beadConvert') for(let r=0;r<this.rows;r++) for(let c=0;c<this.cols;c++) if(this.beads[r][c].attr===sk.param.fromBead) this.beads[r][c].attr=sk.param.toBead
    ch._cd=sk.cd; music.playEliminate()
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
      case 'home': this.tHome(x,y); break; case 'levelSelect': this.tLevels(x,y); break
      case 'teamEdit': this.tTeam(x,y); break; case 'battlePrepare': this.tPrep(x,y); break
      case 'battle': this.tBattle(x,y); break }
  }

  ir(px,py,rx,ry,rw,rh){ return px>=rx&&px<=rx+rw&&py>=ry&&py<=ry+rh }

  tHome(x,y) {
    const bw=W*0.62,bh=50*S,bx2=(W-bw)/2,sy=H*0.48
    if(this.ir(x,y,bx2,sy,bw,bh)){ this.btnP.hs=true; this.lvData=LEVELS.find(l=>l.levelId===this.storage.currentLevel)||LEVELS[0]; this.scene='battlePrepare'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+66*S,bw,bh)){ this.btnP.hl=true; this.scene='levelSelect'; this.ta=1; return }
    if(this.ir(x,y,bx2,sy+132*S,bw,bh)){ this.btnP.ht=true; this.scene='teamEdit'; this.ta=1; return }
  }

  tLevels(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='home'; this.ta=1; return }
    const barH=safeTop+44*S,sty=barH+24*S,isz=W/4.5,cols=3,gx=(W-cols*isz)/(cols+1),gy=24*S
    LEVELS.forEach((lv,i)=>{ const col=i%cols,row=Math.floor(i/cols)
      const cx=gx+col*(isz+gx)+isz/2, cy=sty+row*(isz+gy+24*S)+isz/2
      if(Math.sqrt((x-cx)**2+(y-cy)**2)<=isz/2&&this.storage.isLevelUnlocked(lv.levelId)){ this.lvData=lv; this.scene='battlePrepare'; this.ta=1 } })
  }

  tPrep(x,y) {
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene='levelSelect'; this.ta=1; return }
    const bw=W*0.38,bh=46*S,by=H*0.82
    if(this.ir(x,y,W/2-bw-8*S,by,bw,bh)){ this.btnP.pt=true; this.scene='teamEdit'; this.ta=1; return }
    if(this.ir(x,y,W/2+8*S,by,bw,bh)){ this.btnP.ps=true; this.startBattle(this.lvData); return }
  }

  tTeam(x,y) {
    const barH=safeTop+44*S
    if(this.ir(x,y,0,safeTop,100*S,44*S)){ this.scene=this.lvData?'battlePrepare':'home'; this.ta=1; return }
    const tcY=barH+8*S,sy=tcY+45*S,sr=22*S
    for(let i=0;i<6;i++){ const sx=W/2+(i-2.5)*(sr*2+12*S); if(Math.sqrt((x-sx)**2+(y-sy)**2)<=sr){ if(this.storage.teamData[i]){this.storage.teamData[i]=null;this.storage.save()}; return } }
    const lY=tcY+110*S+12*S, cdH=62*S, cdW=W-28*S, cdX=14*S
    this.storage.unlockedChars.forEach((cid,i)=>{ const cy=lY+20*S+i*(cdH+8*S)
      if(this.ir(x,y,cdX,cy,cdW,cdH)){ if(this.storage.teamData.includes(cid)) return; const es=this.storage.teamData.indexOf(null); if(es!==-1){this.storage.teamData[es]=cid;this.storage.save()} } })
    if(this.ir(x,y,(W-W*0.5)/2,H-70*S,W*0.5,46*S)){ this.btnP.tc=true; this.scene=this.lvData?'battlePrepare':'home'; this.ta=1 }
  }

  tBattle(x,y) {
    if(this.bState==='victory'){
      const mw=W*0.82,mh=290*S,mx=(W-mw)/2,my=(H-mh)/2,bw2=mw*0.38,bh2=40*S,by=my+mh-62*S
      if(this.ir(x,y,mx+12*S,by,bw2,bh2)){ this.scene='levelSelect'; this.ta=1; return }
      const nl=LEVELS.find(l=>l.levelId===this.lvData.levelId+1)
      if(nl&&this.ir(x,y,mx+mw-bw2-12*S,by,bw2,bh2)){ this.lvData=nl; this.startBattle(nl); return }; return }
    if(this.bState==='defeat'){
      const mw=W*0.82,mh=230*S,mx=(W-mw)/2,my=(H-mh)/2,bw2=mw*0.38,bh2=40*S,by=my+mh-60*S
      if(this.ir(x,y,mx+12*S,by,bw2,bh2)){ this.scene='levelSelect'; this.ta=1; return }
      if(this.ir(x,y,mx+mw-bw2-12*S,by,bw2,bh2)){ this.startBattle(this.lvData); return }; return }
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
    // 转珠游戏规则：松手后保留所有移动，无消除也不撤销
    this.selBead=null; this.lastSwap=null
  }
}

module.exports = Main
