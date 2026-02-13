/**
 * 龙珠战纪 - UI渲染模块（升级版：支持难度分层、养成、每日任务等新UI）
 */

// 属性配色
const A = {
  '火': { bg:'#c0392b',main:'#e74c3c',lt:'#ff8a80',ltr:'#ffcdd2',dk:'#8e1a0e',gw:'rgba(231,76,60,0.5)',ic:'炎',orb:'assets/orbs/orb_fire.png' },
  '水': { bg:'#1e5799',main:'#3498db',lt:'#82b1ff',ltr:'#bbdefb',dk:'#0d2f5e',gw:'rgba(52,152,219,0.5)',ic:'水',orb:'assets/orbs/orb_water.png' },
  '木': { bg:'#1b7a3d',main:'#27ae60',lt:'#69f0ae',ltr:'#c8e6c9',dk:'#0d4a22',gw:'rgba(39,174,96,0.5)',ic:'木',orb:'assets/orbs/orb_wood.png' },
  '光': { bg:'#b7860b',main:'#f1c40f',lt:'#fff176',ltr:'#fff9c4',dk:'#7a5a07',gw:'rgba(241,196,15,0.5)',ic:'光',orb:'assets/orbs/orb_light.png' },
  '暗': { bg:'#5b2c8e',main:'#8e44ad',lt:'#ce93d8',ltr:'#e1bee7',dk:'#3a1259',gw:'rgba(142,68,173,0.5)',ic:'暗',orb:'assets/orbs/orb_dark.png' },
  '心': { bg:'#ad1457',main:'#e84393',lt:'#f48fb1',ltr:'#f8bbd0',dk:'#7b0e3c',gw:'rgba(232,67,147,0.5)',ic:'心',orb:'assets/orbs/orb_heart.png' }
}

const TH = { accent:'#f5a623', danger:'#e74c3c', success:'#27ae60', info:'#3498db',
  text:'#e8e8e8', sub:'rgba(255,255,255,0.55)', dim:'rgba(255,255,255,0.3)',
  card:'rgba(255,255,255,0.06)', cardB:'rgba(255,255,255,0.08)',
  hard:'#ff9800', extreme:'#ff1744' }

// 难度颜色
const DC = { normal:TH.success, hard:TH.hard, extreme:TH.extreme }

class Render {
  constructor(ctx, W, H, S, safeTop) {
    this.ctx = ctx; this.W = W; this.H = H; this.S = S; this.safeTop = safeTop
    this.bgStars = []
    for (let i = 0; i < 40; i++) {
      this.bgStars.push({ x: Math.random()*W, y: Math.random()*H, r: Math.random()*1.5+0.5, sp: Math.random()*0.3+0.1, ph: Math.random()*Math.PI*2 })
    }
  }

  rr(x,y,w,h,r) {
    const c=this.ctx; if(w<=0||h<=0)return; r=Math.min(r,w/2,h/2)
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h)
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

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

  drawTopBar(title, showBack) {
    const {ctx:c,W,S,safeTop:st}=this, barH=st+44*S
    // 半透明磨砂底
    const g=c.createLinearGradient(0,0,0,barH)
    g.addColorStop(0,'rgba(8,8,20,0.85)'); g.addColorStop(1,'rgba(8,8,20,0.6)')
    c.fillStyle=g; c.fillRect(0,0,W,barH)
    // 底部分割线
    const lg=c.createLinearGradient(0,barH,W,barH)
    lg.addColorStop(0,'rgba(255,255,255,0)'); lg.addColorStop(0.3,'rgba(255,255,255,0.08)'); lg.addColorStop(0.7,'rgba(255,255,255,0.08)'); lg.addColorStop(1,'rgba(255,255,255,0)')
    c.strokeStyle=lg; c.lineWidth=1; c.beginPath(); c.moveTo(0,barH); c.lineTo(W,barH); c.stroke()
    // 标题
    c.fillStyle=TH.text; c.font=`bold ${17*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(title,W/2,st+22*S)
    // 返回按钮（现代箭头样式）
    if(showBack){
      const bx=14*S, by=st+22*S, bw=60*S, bh=28*S
      c.fillStyle='rgba(255,255,255,0.08)'; this.rr(bx-4*S,by-bh/2,bw,bh,bh/2); c.fill()
      c.fillStyle='rgba(255,255,255,0.7)'; c.font=`${14*S}px "PingFang SC",sans-serif`; c.textAlign='left'; c.textBaseline='middle'
      c.fillText('‹ 返回',bx+4*S,by)
    }
  }

  drawBead(cx,cy,r,attr) {
    const {ctx:c,S}=this, a=A[attr]; c.save()
    // 外发光
    c.beginPath(); c.arc(cx,cy,r+2*S,0,Math.PI*2); c.fillStyle=a.gw.replace('0.5','0.2'); c.fill()
    // 用图片绘制宝珠
    if(a.orb){
      const img=this.getImg(a.orb)
      c.drawImage(img,cx-r,cy-r,r*2,r*2)
      // 内环描边
      c.beginPath(); c.arc(cx,cy,r*0.85,0,Math.PI*2); c.strokeStyle='rgba(0,0,0,0.15)'; c.lineWidth=1*S; c.stroke()
      // 顶部高光
      c.beginPath(); c.ellipse(cx-r*0.12,cy-r*0.28,r*0.45,r*0.22,-0.2,0,Math.PI*2)
      const hg=c.createRadialGradient(cx-r*0.12,cy-r*0.28,0,cx-r*0.12,cy-r*0.28,r*0.45)
      hg.addColorStop(0,'rgba(255,255,255,0.4)'); hg.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=hg; c.fill()
      // 底部阴影
      c.beginPath(); c.ellipse(cx,cy+r*0.3,r*0.5,r*0.15,0,0,Math.PI*2); c.fillStyle='rgba(0,0,0,0.12)'; c.fill()
    } else {
      // 兜底：canvas渐变绘制
      const rg=c.createRadialGradient(cx-r*0.22,cy-r*0.22,r*0.05,cx,cy,r)
      rg.addColorStop(0,a.ltr); rg.addColorStop(0.3,a.lt); rg.addColorStop(0.65,a.main); rg.addColorStop(1,a.dk)
      c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.fillStyle=rg; c.fill()
      c.beginPath(); c.arc(cx,cy,r*0.85,0,Math.PI*2); c.strokeStyle='rgba(0,0,0,0.15)'; c.lineWidth=1*S; c.stroke()
      c.beginPath(); c.ellipse(cx-r*0.12,cy-r*0.28,r*0.45,r*0.22,-0.2,0,Math.PI*2)
      const hg=c.createRadialGradient(cx-r*0.12,cy-r*0.28,0,cx-r*0.12,cy-r*0.28,r*0.45)
      hg.addColorStop(0,'rgba(255,255,255,0.45)'); hg.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=hg; c.fill()
      c.beginPath(); c.ellipse(cx,cy+r*0.3,r*0.5,r*0.15,0,0,Math.PI*2); c.fillStyle='rgba(0,0,0,0.12)'; c.fill()
      c.fillStyle='#fff'; c.font=`bold ${r*0.75}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='middle'; c.shadowColor='rgba(0,0,0,0.5)'; c.shadowBlur=2*S
      c.fillText(a.ic,cx,cy+1*S); c.shadowBlur=0
    }
    c.restore()
  }

  drawChar(x,y,r,ch,hl,frame) {
    const {ctx:c,S}=this, a=A[ch.attr]; c.save()
    if(hl){ c.beginPath(); c.arc(x,y,r+4*S,0,Math.PI*2); c.fillStyle=`rgba(245,166,35,${0.2+0.15*Math.sin(frame*0.1)})`; c.fill() }
    
    if (ch.avatar) {
      const img = this.getImg(ch.avatar)
      c.save()
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.clip()
      c.drawImage(img, x-r, y-r, r*2, r*2)
      c.restore()
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.strokeStyle=hl?TH.accent:'rgba(255,255,255,0.2)'; c.lineWidth=hl?2.5*S:1*S; c.stroke()
    } else {
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2)
      const rg=c.createRadialGradient(x-r*0.2,y-r*0.2,0,x,y,r)
      rg.addColorStop(0,a.lt); rg.addColorStop(0.7,a.main); rg.addColorStop(1,a.dk); c.fillStyle=rg; c.fill()
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.strokeStyle=hl?TH.accent:'rgba(255,255,255,0.2)'; c.lineWidth=hl?2.5*S:1*S; c.stroke()
      c.beginPath(); c.ellipse(x-r*0.15,y-r*0.25,r*0.4,r*0.2,-0.1,0,Math.PI*2); c.fillStyle='rgba(255,255,255,0.25)'; c.fill()
      c.fillStyle='#fff'; c.font=`bold ${r*0.75}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
      c.fillText(ch.charName[0],x,y+1)
    }
    c.restore()
  }

  drawEnemy(x,y,r,attr,frame,sprite) {
    const {ctx:c,S}=this, a=A[attr]; c.save()
    const pulse=0.1+0.06*Math.sin(frame*0.06)
    // 脉冲外发光
    c.beginPath(); c.arc(x,y,r+5*S,0,Math.PI*2); c.fillStyle=a.gw.replace('0.5',String(pulse)); c.fill()
    if(sprite){
      // 图片绘制（圆形裁剪，去掉方框）
      const img=this.getImg(sprite)
      c.save()
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.clip()
      c.drawImage(img,x-r,y-r,r*2,r*2)
      c.restore()
      // 属性光环边框
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.strokeStyle=a.main; c.lineWidth=2*S; c.stroke()
      // 高光
      c.beginPath(); c.ellipse(x-r*0.15,y-r*0.22,r*0.38,r*0.18,-0.15,0,Math.PI*2); c.fillStyle='rgba(255,255,255,0.2)'; c.fill()
    } else {
      // 兜底：canvas渐变球体
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2)
      const rg=c.createRadialGradient(x-r*0.2,y-r*0.2,0,x,y,r)
      rg.addColorStop(0,a.lt); rg.addColorStop(0.6,a.main); rg.addColorStop(1,a.bg); c.fillStyle=rg; c.fill()
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.strokeStyle=a.main; c.lineWidth=2*S; c.stroke()
      c.beginPath(); c.ellipse(x-r*0.15,y-r*0.22,r*0.38,r*0.18,-0.15,0,Math.PI*2); c.fillStyle='rgba(255,255,255,0.25)'; c.fill()
      c.fillStyle='#fff'; c.font=`bold ${r*0.7}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
      c.fillText(a.ic,x,y+1)
    }
    c.restore()
  }

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

  drawBtn(x,y,w,h,text,c1,c2,fs,pressed) {
    const {ctx:c,S}=this, sc=pressed?0.95:1; c.save()
    c.translate(x+w/2,y+h/2); c.scale(sc,sc); const lx=-w/2,ly=-h/2
    // 底部阴影（多层）
    c.fillStyle='rgba(0,0,0,0.25)'; this.rr(lx+1*S,ly+3*S,w,h,10*S); c.fill()
    c.fillStyle='rgba(0,0,0,0.12)'; this.rr(lx,ly+2*S,w,h,10*S); c.fill()
    // 主体渐变
    const g=c.createLinearGradient(lx,ly,lx,ly+h)
    g.addColorStop(0,c1); g.addColorStop(0.5,c1); g.addColorStop(1,c2)
    c.fillStyle=g; this.rr(lx,ly,w,h,10*S); c.fill()
    // 顶部高光带
    const hg=c.createLinearGradient(lx,ly,lx,ly+h*0.5)
    hg.addColorStop(0,'rgba(255,255,255,0.25)'); hg.addColorStop(0.5,'rgba(255,255,255,0.08)'); hg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=hg; this.rr(lx,ly,w,h*0.5,10*S); c.fill()
    // 内描边
    c.strokeStyle='rgba(255,255,255,0.15)'; c.lineWidth=1; this.rr(lx+0.5,ly+0.5,w-1,h-1,10*S); c.stroke()
    // 底部暗边
    c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1
    c.beginPath(); c.moveTo(lx+10*S,ly+h); c.lineTo(lx+w-10*S,ly+h); c.stroke()
    // 文字（带轻微阴影）
    c.shadowColor='rgba(0,0,0,0.35)'; c.shadowBlur=3*S; c.shadowOffsetY=1*S
    c.fillStyle='#fff'; c.font=`bold ${(fs||15)*S}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
    c.fillText(text,0,0); c.shadowBlur=0; c.restore()
  }

  // 难度标签（现代游戏风格）
  drawDiffTag(x, y, w, h, text, color, active) {
    const {ctx:c,S}=this; c.save()
    if (active) {
      // 底部阴影
      c.fillStyle='rgba(0,0,0,0.2)'; this.rr(x+1*S,y+2*S,w,h,h/2); c.fill()
      // 主体
      const g=c.createLinearGradient(x,y,x,y+h)
      g.addColorStop(0,color); g.addColorStop(1,color.replace(')',',0.8)').replace('rgb','rgba'))
      c.fillStyle=g; this.rr(x,y,w,h,h/2); c.fill()
      // 高光
      c.fillStyle='rgba(255,255,255,0.2)'; this.rr(x,y,w,h*0.45,h/2); c.fill()
      c.fillStyle='#fff'
    } else {
      c.fillStyle='rgba(255,255,255,0.05)'; this.rr(x,y,w,h,h/2); c.fill()
      c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; this.rr(x,y,w,h,h/2); c.stroke()
      c.fillStyle=TH.dim
    }
    c.font=`bold ${11*S}px "PingFang SC",sans-serif`; c.textAlign='center'; c.textBaseline='middle'
    c.fillText(text,x+w/2,y+h/2); c.restore()
  }

  // 进度条（通用）
  drawProgress(x,y,w,h,ratio,color) {
    const {ctx:c,S}=this
    c.fillStyle='rgba(255,255,255,0.06)'; this.rr(x,y,w,h,h/2); c.fill()
    if (ratio > 0) {
      c.fillStyle=color; this.rr(x,y,Math.max(h,w*Math.min(1,ratio)),h,h/2); c.fill()
    }
  }

  // 任务卡片
  drawTaskCard(x,y,w,h,text,done) {
    const {ctx:c,S}=this
    c.fillStyle=done?'rgba(39,174,96,0.1)':TH.card; this.rr(x,y,w,h,8*S); c.fill()
    c.strokeStyle=done?TH.success:TH.cardB; c.lineWidth=1; this.rr(x,y,w,h,8*S); c.stroke()
    c.fillStyle=done?TH.success:TH.dim; c.font=`${14*S}px "PingFang SC",sans-serif`
    c.textAlign='left'; c.textBaseline='middle'; c.fillText(done?'✓':'○',x+10*S,y+h/2)
    c.fillStyle=done?TH.sub:TH.text; c.font=`${12*S}px "PingFang SC",sans-serif`
    c.fillText(text,x+28*S,y+h/2)
  }

  // ===== 首页专用绘制方法 =====

  // 首页暖色背景（模拟图中的黄橙渐变色调）
  drawHomeBg(frame) {
    const {ctx:c,W,H,S}=this
    const g=c.createLinearGradient(0,0,0,H)
    g.addColorStop(0,'#f5c842'); g.addColorStop(0.15,'#f0b830')
    g.addColorStop(0.4,'#e8a820'); g.addColorStop(0.7,'#d49518')
    g.addColorStop(1,'#c08510')
    c.fillStyle=g; c.fillRect(0,0,W,H)
    // 浅色光晕
    c.save(); c.globalAlpha=0.15
    const rg=c.createRadialGradient(W/2,H*0.2,0,W/2,H*0.2,W*0.8)
    rg.addColorStop(0,'#fff'); rg.addColorStop(1,'transparent'); c.fillStyle=rg; c.fillRect(0,0,W,H); c.restore()
    // 底部稍微暗
    c.save(); c.globalAlpha=0.2
    const bg=c.createLinearGradient(0,H*0.7,0,H); bg.addColorStop(0,'transparent'); bg.addColorStop(1,'rgba(0,0,0,0.3)')
    c.fillStyle=bg; c.fillRect(0,0,W,H); c.restore()
  }

  // 首页毛玻璃卡片
  drawGlassCard(x,y,w,h,r) {
    const {ctx:c,S}=this
    c.save()
    c.fillStyle='rgba(240,240,245,0.88)'; this.rr(x,y,w,h,r||12*S); c.fill()
    c.strokeStyle='rgba(255,255,255,0.6)'; c.lineWidth=1.5; this.rr(x,y,w,h,r||12*S); c.stroke()
    // 内部顶部白色高光
    c.fillStyle='rgba(255,255,255,0.3)'; this.rr(x+2*S,y+2*S,w-4*S,h*0.08,r||12*S); c.fill()
    c.restore()
  }

  // 首页深色面板
  drawDarkPanel(x,y,w,h,r) {
    const {ctx:c,S}=this
    c.save()
    c.fillStyle='rgba(28,28,38,0.92)'; this.rr(x,y,w,h,r||10*S); c.fill()
    c.strokeStyle='rgba(80,80,100,0.3)'; c.lineWidth=1; this.rr(x,y,w,h,r||10*S); c.stroke()
    c.restore()
  }

  getImg(path) {
    if (!this._imgCache) this._imgCache = {}
    if (this._imgCache[path]) return this._imgCache[path]
    const img = wx.createImage()
    img.src = path
    this._imgCache[path] = img
    return img
  }

  // 首页角色头像格子（现代风格）
  drawCharGrid(x,y,size,ch,unlocked,frame) {
    const {ctx:c,S}=this
    c.save()
    const r=8*S
    if(unlocked && ch) {
      const a=A[ch.attr]
      // 背景：带微妙渐变和内发光
      const g=c.createLinearGradient(x,y,x,y+size)
      g.addColorStop(0,'rgba(45,45,65,0.95)'); g.addColorStop(1,'rgba(25,25,40,0.95)')
      c.fillStyle=g; this.rr(x,y,size,size,r); c.fill()
      
      // 属性底色外框
      c.strokeStyle=a.main; c.lineWidth=2; this.rr(x,y,size,size,r); c.stroke()
      
      // 角色头像
      const cx=x+size/2, cy=y+size/2, ir=size*0.42
      if (ch.avatar) {
        const img = this.getImg(ch.avatar)
        c.save()
        c.beginPath(); c.arc(cx,cy,ir,0,Math.PI*2); c.clip()
        c.drawImage(img, cx-ir, cy-ir, ir*2, ir*2)
        c.restore()
      } else {
        const rg=c.createRadialGradient(cx-ir*0.2,cy-ir*0.2,0,cx,cy,ir)
        rg.addColorStop(0,a.lt); rg.addColorStop(0.7,a.main); rg.addColorStop(1,a.dk)
        c.beginPath(); c.arc(cx,cy,ir,0,Math.PI*2); c.fillStyle=rg; c.fill()
        // 角色首字（作为兜底）
        c.fillStyle='#fff'; c.font=`bold ${ir*0.9}px "PingFang SC",sans-serif`
        c.textAlign='center'; c.textBaseline='middle'; c.fillText(ch.charName[0],cx,cy+1)
      }
      
      // 等级角标
      c.fillStyle='rgba(0,0,0,0.6)'; this.rr(x+2*S,y+size-14*S,28*S,12*S,4*S); c.fill()
      c.fillStyle='#ffcc00'; c.font=`bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.fillText(`Lv.1`,x+16*S,y+size-8*S)
    } else {
      // 未解锁
      c.fillStyle='rgba(40,40,50,0.6)'; this.rr(x,y,size,size,r); c.fill()
      c.strokeStyle='rgba(255,255,255,0.05)'; c.lineWidth=1; this.rr(x,y,size,size,r); c.stroke()
      c.fillStyle='rgba(255,255,255,0.15)'; c.font=`${size*0.3}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='middle'; c.fillText('🔒',x+size/2,y+size/2)
    }
    c.restore()
  }

  // 首页属性条（用于关卡信息面板）
  drawAttrBar(x,y,w,h,ratio,color,label) {
    const {ctx:c,S}=this
    c.fillStyle='rgba(60,60,80,0.6)'; this.rr(x,y,w,h,h/2); c.fill()
    if(ratio>0){
      const pw=Math.max(h,w*Math.min(1,ratio))
      c.fillStyle=color; this.rr(x,y,pw,h,h/2); c.fill()
    }
    if(label){
      c.fillStyle='rgba(255,255,255,0.8)'; c.font=`${h*0.7}px "PingFang SC",sans-serif`
      c.textAlign='left'; c.textBaseline='middle'; c.fillText(label,x+6*S,y+h/2)
    }
  }

  // 底部导航按钮（现代游戏风格）
  drawNavBtn(x,y,w,h,text,icon,active,pressed) {
    const {ctx:c,S}=this, sc=pressed?0.92:1
    c.save(); c.translate(x+w/2,y+h/2); c.scale(sc,sc)
    const lx=-w/2, ly=-h/2
    // 阴影
    c.fillStyle='rgba(0,0,0,0.3)'; this.rr(lx+1*S,ly+2*S,w,h,8*S); c.fill()
    if(active) {
      // 激活态：金色渐变
      const ag=c.createLinearGradient(lx,ly,lx,ly+h)
      ag.addColorStop(0,'#f5c842'); ag.addColorStop(1,'#d4941e')
      c.fillStyle=ag; this.rr(lx,ly,w,h,8*S); c.fill()
      // 高光
      c.fillStyle='rgba(255,255,255,0.2)'; this.rr(lx,ly,w,h*0.45,8*S); c.fill()
      c.fillStyle='#fff'
    } else {
      // 普通态：深色玻璃
      const ng=c.createLinearGradient(lx,ly,lx,ly+h)
      ng.addColorStop(0,'rgba(55,55,75,0.95)'); ng.addColorStop(1,'rgba(35,35,50,0.95)')
      c.fillStyle=ng; this.rr(lx,ly,w,h,8*S); c.fill()
      // 顶部高光
      c.fillStyle='rgba(255,255,255,0.06)'; this.rr(lx,ly,w,h*0.4,8*S); c.fill()
      // 边框
      c.strokeStyle='rgba(120,120,150,0.25)'; c.lineWidth=0.5; this.rr(lx,ly,w,h,8*S); c.stroke()
      c.fillStyle='rgba(255,255,255,0.75)'
    }
    c.textAlign='center'; c.textBaseline='middle'
    if(icon){
      // 图片图标
      if(icon.endsWith('.png')||icon.endsWith('.jpg')){
        const img=this.getImg(icon)
        const icoS=16*S
        c.drawImage(img,-icoS/2,-6*S-icoS/2,icoS,icoS)
        c.font=`bold ${8*S}px "PingFang SC",sans-serif`; c.fillText(text,0,10*S)
      } else {
        c.font=`${13*S}px "PingFang SC",sans-serif`; c.fillText(icon,0,-5*S)
        c.font=`bold ${8*S}px "PingFang SC",sans-serif`; c.fillText(text,0,9*S)
      }
    } else {
      c.font=`bold ${10*S}px "PingFang SC",sans-serif`; c.fillText(text,0,1)
    }
    c.restore()
  }

  // 小型宝珠（首页棋盘预览）
  drawSmallBead(cx,cy,r,attr) {
    const {ctx:c,S}=this, a=A[attr]
    c.save()
    const rg=c.createRadialGradient(cx-r*0.2,cy-r*0.2,r*0.05,cx,cy,r)
    rg.addColorStop(0,a.lt); rg.addColorStop(0.6,a.main); rg.addColorStop(1,a.dk)
    c.beginPath(); c.arc(cx,cy,r,0,Math.PI*2); c.fillStyle=rg; c.fill()
    c.beginPath(); c.ellipse(cx-r*0.1,cy-r*0.25,r*0.4,r*0.18,-0.2,0,Math.PI*2)
    c.fillStyle='rgba(255,255,255,0.3)'; c.fill()
    c.fillStyle='#fff'; c.font=`bold ${r*0.8}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.shadowColor='rgba(0,0,0,0.4)'; c.shadowBlur=1*S
    c.fillText(a.ic,cx,cy+0.5*S); c.shadowBlur=0
    c.restore()
  }
}

module.exports = { Render, A, TH, DC }
