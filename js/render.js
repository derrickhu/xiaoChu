/**
 * 龙珠战纪 - UI渲染模块（参考智龙迷城/原神UI风格）
 */
const CHARACTERS = require('./data/characters')
const LEVELS = require('./data/levels')

// 属性配色（多层渐变，增强质感）
const A = {
  '火': { bg:'#c0392b',main:'#e74c3c',lt:'#ff8a80',ltr:'#ffcdd2',dk:'#8e1a0e',gw:'rgba(231,76,60,0.5)',ic:'炎' },
  '水': { bg:'#1e5799',main:'#3498db',lt:'#82b1ff',ltr:'#bbdefb',dk:'#0d2f5e',gw:'rgba(52,152,219,0.5)',ic:'水' },
  '木': { bg:'#1b7a3d',main:'#27ae60',lt:'#69f0ae',ltr:'#c8e6c9',dk:'#0d4a22',gw:'rgba(39,174,96,0.5)',ic:'木' },
  '光': { bg:'#b7860b',main:'#f1c40f',lt:'#fff176',ltr:'#fff9c4',dk:'#7a5a07',gw:'rgba(241,196,15,0.5)',ic:'光' },
  '暗': { bg:'#5b2c8e',main:'#8e44ad',lt:'#ce93d8',ltr:'#e1bee7',dk:'#3a1259',gw:'rgba(142,68,173,0.5)',ic:'暗' },
  '心': { bg:'#ad1457',main:'#e84393',lt:'#f48fb1',ltr:'#f8bbd0',dk:'#7b0e3c',gw:'rgba(232,67,147,0.5)',ic:'心' }
}

const TH = { accent:'#f5a623', danger:'#e74c3c', success:'#27ae60', info:'#3498db',
  text:'#e8e8e8', sub:'rgba(255,255,255,0.55)', dim:'rgba(255,255,255,0.3)',
  card:'rgba(255,255,255,0.06)', cardB:'rgba(255,255,255,0.08)' }

class Render {
  constructor(ctx, W, H, S, safeTop) {
    this.ctx = ctx; this.W = W; this.H = H; this.S = S; this.safeTop = safeTop
    this.bgStars = []
    for (let i = 0; i < 40; i++) {
      this.bgStars.push({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.5+0.5, sp: Math.random()*0.3+0.1, ph: Math.random()*Math.PI*2 })
    }
  }

  // 圆角矩形
  rr(x,y,w,h,r) {
    const c=this.ctx; if(w<=0||h<=0)return; r=Math.min(r,w/2,h/2)
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h)
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

  // 深色背景+星空
  drawBg(frame) {
    const {ctx:c,W,H,S}=this
    const g=c.createLinearGradient(0,0,0,H)
    g.addColorStop(0,'#0d0d1a'); g.addColorStop(0.5,'#141428'); g.addColorStop(1,'#0a0a14')
    c.fillStyle=g; c.fillRect(0,0,W,H)
    const t=frame*0.01
    this.bgStars.forEach(s=>{
      c.fillStyle=`rgba(255,255,255,${0.15+0.2*Math.sin(t*s.sp*5+s.ph)})`
      c.beginPath(); c.arc(s.x,(s.y+frame*s.sp*0.3)%H,s.r*S,0,Math.PI*2); c.fill()
    })
  }

  // 顶部导航栏
  drawTopBar(title, showBack) {
    const {ctx:c,W,S,safeTop:st}=this, barH=st+44*S
    c.fillStyle='rgba(0,0,0,0.4)'; c.fillRect(0,0,W,barH)
    c.strokeStyle='rgba(255,255,255,0.06)'; c.lineWidth=0.5
    c.beginPath(); c.moveTo(0,barH); c.lineTo(W,barH); c.stroke()
    c.fillStyle=TH.text; c.font=`bold ${17*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(title,W/2,st+22*S)
    if(showBack){ c.fillStyle=TH.sub; c.font=`${13*S}px "PingFang SC",sans-serif`; c.textAlign='left'; c.fillText('‹ 返回',14*S,st+22*S) }
  }

  // 宝珠（多层渐变+玻璃高光+阴影）
  drawBead(cx,cy,r,attr) {
    const {ctx:c,S}=this, a=A[attr]; c.save()
    // 外光晕
    c.beginPath(); c.arc(cx,cy,r+2*S,0,Math.PI*2); c.fillStyle=a.gw.replace('0.5','0.2'); c.fill()
    // 主体
    const rg=c.createRadialGradient(cx-r*0.22,cy-r*0.22,r*0.05,cx,cy,r)
    rg.addColorStop(0,a.ltr); rg.addColorStop(0.3,a.lt); rg.addColorStop(0.65,a.main); rg.addColorStop(1,a.dk)
    c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.fillStyle=rg; c.fill()
    // 内环
    c.beginPath(); c.arc(cx,cy,r*0.85,0,Math.PI*2); c.strokeStyle='rgba(0,0,0,0.15)'; c.lineWidth=1*S; c.stroke()
    // 高光椭圆
    c.beginPath(); c.ellipse(cx-r*0.12,cy-r*0.28,r*0.45,r*0.22,-0.2,0,Math.PI*2)
    const hg=c.createRadialGradient(cx-r*0.12,cy-r*0.28,0,cx-r*0.12,cy-r*0.28,r*0.45)
    hg.addColorStop(0,'rgba(255,255,255,0.45)'); hg.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=hg; c.fill()
    // 底部暗影
    c.beginPath(); c.ellipse(cx,cy+r*0.3,r*0.5,r*0.15,0,0,Math.PI*2); c.fillStyle='rgba(0,0,0,0.12)'; c.fill()
    // 图标
    c.fillStyle='#fff'; c.font=`bold ${r*0.75}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.shadowColor='rgba(0,0,0,0.5)'; c.shadowBlur=2*S
    c.fillText(a.ic,cx,cy+1*S); c.shadowBlur=0; c.restore()
  }

  // 角色头像
  drawChar(x,y,r,ch,hl,frame) {
    const {ctx:c,S}=this, a=A[ch.attr]; c.save()
    if(hl){ c.beginPath(); c.arc(x,y,r+4*S,0,Math.PI*2); c.fillStyle=`rgba(245,166,35,${0.2+0.15*Math.sin(frame*0.1)})`; c.fill() }
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2)
    const rg=c.createRadialGradient(x-r*0.2,y-r*0.2,0,x,y,r)
    rg.addColorStop(0,a.lt); rg.addColorStop(0.7,a.main); rg.addColorStop(1,a.dk); c.fillStyle=rg; c.fill()
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.strokeStyle=hl?TH.accent:'rgba(255,255,255,0.2)'; c.lineWidth=hl?2.5*S:1*S; c.stroke()
    c.beginPath(); c.ellipse(x-r*0.15,y-r*0.25,r*0.4,r*0.2,-0.1,0,Math.PI*2); c.fillStyle='rgba(255,255,255,0.25)'; c.fill()
    c.fillStyle='#fff'; c.font=`bold ${r*0.75}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
    c.fillText(ch.charName[0],x,y+1); c.restore()
  }

  // 敌方头像
  drawEnemy(x,y,r,attr,frame) {
    const {ctx:c,S}=this, a=A[attr]; c.save()
    const pulse=0.1+0.06*Math.sin(frame*0.06)
    c.beginPath(); c.arc(x,y,r+5*S,0,Math.PI*2); c.fillStyle=a.gw.replace('0.5',String(pulse)); c.fill()
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2)
    const rg=c.createRadialGradient(x-r*0.2,y-r*0.2,0,x,y,r)
    rg.addColorStop(0,a.lt); rg.addColorStop(0.6,a.main); rg.addColorStop(1,a.bg); c.fillStyle=rg; c.fill()
    c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.strokeStyle=a.main; c.lineWidth=2*S; c.stroke()
    c.beginPath(); c.ellipse(x-r*0.15,y-r*0.22,r*0.38,r*0.18,-0.15,0,Math.PI*2); c.fillStyle='rgba(255,255,255,0.25)'; c.fill()
    c.fillStyle='#fff'; c.font=`bold ${r*0.7}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
    c.fillText(a.ic,x,y+1); c.restore()
  }

  // HP条
  drawHp(x,y,w,h,cur,max,c1,c2) {
    const {ctx:c,S}=this
    c.fillStyle='rgba(255,255,255,0.06)'; this.rr(x,y,w,h,h/2); c.fill()
    const ratio=Math.max(0,Math.min(1,cur/max))
    if(ratio>0){
      const pw=Math.max(h,w*ratio)
      const g=c.createLinearGradient(x,y,x+pw,y); g.addColorStop(0,c1); g.addColorStop(1,c2)
      c.fillStyle=g; this.rr(x,y,pw,h,h/2); c.fill()
      c.fillStyle='rgba(255,255,255,0.2)'; this.rr(x+2*S,y+1*S,pw-4*S,h*0.35,h/2); c.fill()
    }
  }

  // 按钮
  drawBtn(x,y,w,h,text,c1,c2,fs,pressed) {
    const {ctx:c,S}=this, sc=pressed?0.96:1; c.save()
    c.translate(x+w/2,y+h/2); c.scale(sc,sc); const lx=-w/2,ly=-h/2
    c.fillStyle='rgba(0,0,0,0.3)'; this.rr(lx+2*S,ly+3*S,w,h,h/2); c.fill()
    const g=c.createLinearGradient(lx,ly,lx,ly+h); g.addColorStop(0,c1); g.addColorStop(1,c2)
    c.fillStyle=g; this.rr(lx,ly,w,h,h/2); c.fill()
    c.fillStyle='rgba(255,255,255,0.12)'; this.rr(lx,ly,w,h*0.45,h/2); c.fill()
    c.fillStyle='#fff'; c.font=`bold ${(fs||15)*S}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
    c.fillText(text,0,1*S); c.restore()
  }
}

module.exports = { Render, A, TH, CHARACTERS, LEVELS }
