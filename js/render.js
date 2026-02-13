/**
 * 渲染模块 - 适配修仙消消乐法宝系统
 * 纯Canvas 2D，支持图片缓存、动画、粒子
 */
const { QUALITY, EQUIP_SLOT, ATTR_COLOR, ATTR_NAME, COUNTER_MAP } = require('./data/equipment')

// 属性配色（兼容旧格式，渲染用）
const A = {}
Object.keys(ATTR_COLOR).forEach(k => {
  const c = ATTR_COLOR[k]
  A[k] = { bg:c.bg, main:c.main, lt:c.lt, dk:c.dk, ic:ATTR_NAME[k],
    ltr:`${c.lt}88`, gw:c.main+'40', orb:c.main }
})

// 主题色
const TH = {
  bg:'#0b0b15', card:'rgba(22,22,38,0.92)', cardB:'rgba(60,60,90,0.3)',
  text:'#eee', sub:'rgba(200,200,210,0.7)', dim:'rgba(140,140,160,0.5)',
  accent:'#ffd700', danger:'#ff4d6a', success:'#4dcc4d', info:'#4dabff',
  hard:'#ff8c00', extreme:'#ff4d6a',
}

class Render {
  constructor(ctx, W, H, S, safeTop) {
    this.ctx = ctx; this.W = W; this.H = H; this.S = S; this.safeTop = safeTop
    this._imgCache = {}
    // 背景星点
    this.bgStars = Array.from({length:40}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: 0.5+Math.random()*1.5, sp: 0.3+Math.random()*0.7, ph: Math.random()*6.28
    }))
  }

  // ===== 基础绘制 =====
  rr(x,y,w,h,r) {
    const c = this.ctx
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h)
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

  getImg(path) {
    if (this._imgCache[path]) return this._imgCache[path]
    const img = wx.createImage()
    img.src = path
    this._imgCache[path] = img
    return img
  }

  // ===== 背景 =====
  drawBg(frame) {
    const {ctx:c,W,H,S} = this
    const g = c.createLinearGradient(0,0,0,H)
    g.addColorStop(0,'#0d0d1a'); g.addColorStop(0.5,'#141428'); g.addColorStop(1,'#0a0a14')
    c.fillStyle = g; c.fillRect(0,0,W,H)
    const t = frame*0.01
    this.bgStars.forEach(s => {
      c.fillStyle = `rgba(255,255,255,${0.15+0.2*Math.sin(t*s.sp*5+s.ph)})`
      c.beginPath(); c.arc(s.x,(s.y+frame*s.sp*0.3)%H,s.r*S,0,Math.PI*2); c.fill()
    })
  }

  drawHomeBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
    } else {
      const g = c.createLinearGradient(0,0,0,H)
      g.addColorStop(0,'#1a1035'); g.addColorStop(0.5,'#0d0d2a'); g.addColorStop(1,'#050510')
      c.fillStyle = g; c.fillRect(0,0,W,H)
    }
    c.save(); c.globalAlpha=0.35
    const bg = c.createLinearGradient(0,H*0.5,0,H)
    bg.addColorStop(0,'transparent'); bg.addColorStop(1,'rgba(0,0,0,0.6)')
    c.fillStyle = bg; c.fillRect(0,0,W,H); c.restore()
  }

  drawLoadingBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/loading_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      c.drawImage(img,(W-iw*scale)/2,(H-ih*scale)/2,iw*scale,ih*scale)
      c.save(); c.globalAlpha=0.3; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawBattleBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/battle_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
      c.save(); c.globalAlpha=0.2; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawLevelBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/level_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
      c.save(); c.globalAlpha=0.25; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawEquipBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/equip_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
      c.save(); c.globalAlpha=0.25; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  // ===== 顶部栏 =====
  drawTopBar(title, showBack) {
    const {ctx:c,W,S,safeTop:st} = this, barH = st+44*S
    const g = c.createLinearGradient(0,0,0,barH)
    g.addColorStop(0,'rgba(8,8,20,0.85)'); g.addColorStop(1,'rgba(8,8,20,0.6)')
    c.fillStyle = g; c.fillRect(0,0,W,barH)
    // 底线
    c.strokeStyle='rgba(255,255,255,0.06)'; c.lineWidth=1
    c.beginPath(); c.moveTo(0,barH); c.lineTo(W,barH); c.stroke()
    // 标题
    c.fillStyle=TH.text; c.font=`bold ${17*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(title,W/2,st+22*S)
    // 返回
    if (showBack) {
      c.fillStyle=TH.accent; c.font=`${20*S}px "PingFang SC",sans-serif`
      c.textAlign='left'; c.fillText('‹',14*S,st+22*S)
      c.font=`${13*S}px "PingFang SC",sans-serif`; c.fillText('返回',28*S,st+22*S)
    }
  }

  // ===== 灵珠 =====
  drawBead(x,y,r,attr,frame) {
    const {ctx:c,S} = this
    const a = A[attr]
    if (!a) return
    const sz = r * 2  // 直径即为绘制尺寸
    // 尝试用图片（方形绘制，占满格子）
    const img = this.getImg(`assets/orbs/orb_${attr}.jpg`)
    if (img && img.width > 0) {
      c.drawImage(img, x-r, y-r, sz, sz)
    } else {
      // 降级渐变球体
      const g = c.createRadialGradient(x-r*0.25,y-r*0.3,r*0.1,x,y,r)
      g.addColorStop(0,a.lt); g.addColorStop(0.7,a.main); g.addColorStop(1,a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
      // 高光
      c.fillStyle='rgba(255,255,255,0.35)'
      c.beginPath(); c.ellipse(x-r*0.15,y-r*0.25,r*0.45,r*0.3,0,0,Math.PI*2); c.fill()
    }
    // 外发光
    if (frame !== undefined) {
      c.save(); c.globalAlpha = 0.15 + 0.08*Math.sin((frame||0)*0.06)
      c.strokeStyle = a.main; c.lineWidth = 2*S
      c.beginPath(); c.arc(x,y,r+1*S,0,Math.PI*2); c.stroke()
      c.restore()
    }
  }

  // ===== 敌人 =====
  drawEnemy(x,y,r,attr,hp,maxHp,name,avatar,frame) {
    const {ctx:c,S} = this
    const a = A[attr]
    // 脉冲光环
    const pulse = 1 + 0.04*Math.sin((frame||0)*0.05)
    c.save(); c.globalAlpha=0.25
    c.strokeStyle=a.main; c.lineWidth=3*S*pulse
    c.beginPath(); c.arc(x,y,r+4*S,0,Math.PI*2); c.stroke()
    c.restore()
    // 图片或渐变
    const img = avatar ? this.getImg(avatar) : null
    if (img && img.width > 0) {
      c.save(); c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.clip()
      c.drawImage(img,x-r,y-r,r*2,r*2); c.restore()
    } else {
      const g = c.createRadialGradient(x,y-r*0.3,r*0.1,x,y,r)
      g.addColorStop(0,a.lt); g.addColorStop(1,a.dk)
      c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
    }
    // 名字
    c.fillStyle=TH.text; c.font=`bold ${12*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='top'; c.fillText(name||'敌人',x,y+r+6*S)
    // HP条
    this.drawHp(x-r,y+r+22*S,r*2,5*S,hp,maxHp,a.main)
  }

  // ===== HP条（立体槽+发光填充） =====
  drawHp(x,y,w,h,hp,maxHp,color) {
    const {ctx:c,S} = this
    const pct = Math.max(0,Math.min(1,hp/maxHp))
    // 凹槽背景
    c.save()
    c.fillStyle='rgba(0,0,0,0.5)'; this.rr(x,y,w,h,h/2); c.fill()
    // 内阴影
    c.save(); c.globalAlpha=0.3
    const ig=c.createLinearGradient(x,y,x,y+h*0.4)
    ig.addColorStop(0,'rgba(0,0,0,0.4)'); ig.addColorStop(1,'rgba(0,0,0,0)')
    c.fillStyle=ig; this.rr(x,y,w,h*0.4,h/2); c.fill()
    c.restore()
    if (pct > 0) {
      const barColor = color || (pct>0.5?TH.success:pct>0.2?TH.hard:TH.danger)
      // 填充渐变
      const fg=c.createLinearGradient(x,y,x,y+h)
      fg.addColorStop(0,this._lighten(barColor,0.15)); fg.addColorStop(0.5,barColor); fg.addColorStop(1,this._darken(barColor))
      c.fillStyle=fg; this.rr(x,y,w*pct,h,h/2); c.fill()
      // 顶部高光条
      c.save(); c.globalAlpha=0.35
      c.fillStyle='#fff'; this.rr(x+2*S,y+1,w*pct-4*S,h*0.35,h/4); c.fill()
      c.restore()
    }
    // 槽边框
    c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1; this.rr(x,y,w,h,h/2); c.stroke()
    c.restore()
  }

  // ===== 按钮（立体凸起质感） =====
  drawBtn(x,y,w,h,text,color,pressed) {
    const {ctx:c,S} = this
    const clr = color||TH.accent
    const rad = Math.min(10*S, h/2)
    c.save()
    c.translate(x, y)

    if (pressed) {
      // 按压态：下沉1px，阴影缩小
      c.translate(0, 2*S)
      // 微弱外阴影
      c.fillStyle='rgba(0,0,0,0.15)'; this.rr(1*S,1*S,w,h,rad); c.fill()
    } else {
      // 常态：底部厚阴影模拟凸起
      c.fillStyle='rgba(0,0,0,0.25)'; this.rr(0,4*S,w,h,rad); c.fill()
      c.fillStyle='rgba(0,0,0,0.12)'; this.rr(0,2*S,w,h,rad); c.fill()
    }

    // 底边深色层（凸起立体感的"厚度"）
    c.fillStyle=this._darken(clr); this.rr(0,2*S,w,h,rad); c.fill()

    // 主体渐变
    const g = c.createLinearGradient(0,0,0,h)
    const lt = this._lighten(clr, 0.25)
    g.addColorStop(0, lt)
    g.addColorStop(0.45, clr)
    g.addColorStop(1, this._darken(clr))
    c.fillStyle=g; this.rr(0,0,w,h,rad); c.fill()

    // 上半部内高光（玻璃反射）
    c.save(); c.globalAlpha=0.3
    const hg = c.createLinearGradient(0,0,0,h*0.5)
    hg.addColorStop(0,'rgba(255,255,255,0.6)'); hg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=hg; this.rr(1*S,1*S,w-2*S,h*0.5,rad); c.fill()
    c.restore()

    // 边框：外暗+内亮双线
    c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1.5*S; this.rr(0,0,w,h,rad); c.stroke()
    c.strokeStyle='rgba(255,255,255,0.15)'; c.lineWidth=1; this.rr(1*S,1*S,w-2*S,h-2*S,rad-1*S); c.stroke()

    // 底边高光线（分隔线立体感）
    c.save(); c.globalAlpha=0.1
    c.strokeStyle='#fff'; c.lineWidth=1
    c.beginPath(); c.moveTo(rad, h-1); c.lineTo(w-rad, h-1); c.stroke()
    c.restore()

    // 文字（带描边增强可读性）
    c.fillStyle='#fff'; c.font=`bold ${Math.min(14*S, h*0.45)}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.25)'; c.lineWidth=2*S; c.strokeText(text,w/2,h/2)
    c.fillText(text,w/2,h/2)

    c.restore()
  }

  // ===== 法宝卡片（立体质感） =====
  drawEquipCard(x,y,w,h,equip,selected,frame) {
    const {ctx:c,S} = this
    if (!equip) {
      // 空槽位 - 凹陷虚线框
      c.save()
      c.fillStyle='rgba(0,0,0,0.15)'; this.rr(x,y,w,h,8*S); c.fill()
      c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; c.setLineDash([4*S,4*S])
      this.rr(x,y,w,h,8*S); c.stroke()
      c.setLineDash([])
      c.fillStyle=TH.dim; c.font=`${24*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='middle'; c.fillText('+',x+w/2,y+h/2)
      c.restore()
      return
    }
    const q = QUALITY[equip.quality]
    const a = ATTR_COLOR[equip.attr]
    c.save()
    // 底部投影
    c.fillStyle='rgba(0,0,0,0.2)'; this.rr(x+1*S,y+3*S,w,h,8*S); c.fill()
    // 背景渐变
    const bg = c.createLinearGradient(x,y,x,y+h)
    bg.addColorStop(0,'rgba(30,30,48,0.94)'); bg.addColorStop(1,'rgba(18,18,32,0.96)')
    c.fillStyle=bg; this.rr(x,y,w,h,8*S); c.fill()
    // 顶部高光
    c.save(); c.globalAlpha=0.08
    const tg=c.createLinearGradient(x,y,x,y+h*0.35)
    tg.addColorStop(0,'rgba(255,255,255,0.4)'); tg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=tg; this.rr(x,y,w,h*0.35,8*S); c.fill()
    c.restore()
    // 品质边框
    if (selected) {
      c.strokeStyle=TH.accent; c.lineWidth=2.5*S
      // 选中光效
      c.save(); c.globalAlpha=0.1
      c.fillStyle=TH.accent; this.rr(x,y,w,h,8*S); c.fill()
      c.restore()
    } else {
      c.strokeStyle=q.color+'66'; c.lineWidth=1.5*S
    }
    this.rr(x,y,w,h,8*S); c.stroke()
    // 品质光效
    if (equip.quality === 'SSR' || equip.quality === 'SR') {
      c.save(); c.globalAlpha = 0.06 + 0.04*Math.sin((frame||0)*0.04)
      c.fillStyle = q.color; this.rr(x,y,w,h,8*S); c.fill()
      c.restore()
    }
    // 属性色条（圆角）
    c.fillStyle = a.main
    this.rr(x+3*S,y+4*S,3*S,h-8*S,1.5*S); c.fill()
    // 装备图标
    const eqIcon = this.getImg(`assets/equipment/icon_${equip.slot}_${equip.attr}.jpg`)
    const iconSz = h - 8*S
    if (eqIcon && eqIcon.width > 0) {
      c.drawImage(eqIcon, x+8*S, y+4*S, iconSz, iconSz)
    }
    const textOff = (eqIcon && eqIcon.width > 0) ? iconSz + 10*S : 12*S
    // 名称
    c.fillStyle=TH.text; c.font=`bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign='left'; c.textBaseline='top'
    c.fillText(equip.name, x+textOff, y+6*S)
    // 品质标签 + 等级
    c.fillStyle=q.color; c.font=`bold ${9*S}px "PingFang SC",sans-serif`
    c.fillText(q.name + (equip.level ? ` Lv.${equip.level}` : ''), x+12*S, y+20*S)
    // 槽位图标
    const slot = EQUIP_SLOT[equip.slot]
    c.fillStyle=TH.sub; c.font=`${10*S}px "PingFang SC",sans-serif`
    c.textAlign='right'; c.fillText(slot.icon+' '+slot.name, x+w-8*S, y+6*S)
    // 属性概要（优先显示stats，兼容旧数据）
    c.fillStyle=TH.sub; c.font=`${9*S}px "PingFang SC",sans-serif`
    c.textAlign='left'
    if (equip.stats && Object.keys(equip.stats).length > 0) {
      const statText = Object.entries(equip.stats).map(([k,v]) => {
        const names = {hp:'HP',pAtk:'物攻',mAtk:'魔攻',pDef:'物防',mDef:'魔防'}
        return `${names[k]||k}+${v}`
      }).join(' ')
      c.fillText(statText, x+12*S, y+34*S)
    } else {
      c.fillText(equip.skill.name, x+12*S, y+34*S)
    }
    c.restore()
  }

  // ===== 法宝详情面板 =====
  drawEquipDetail(x,y,w,equip,frame) {
    if (!equip) return
    const {ctx:c,S} = this
    const q = QUALITY[equip.quality]
    const a = ATTR_COLOR[equip.attr]
    const lineH = 18*S, padX = 12*S
    let cy = y

    // 名称行
    c.fillStyle = q.color; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText(equip.name, x+padX, cy); cy += 22*S
    // 品质+属性+等级
    c.fillStyle = TH.sub; c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText(`${q.name} · ${ATTR_NAME[equip.attr]}属性 · ${EQUIP_SLOT[equip.slot].name}${equip.level ? ' · Lv.'+equip.level : ''}`, x+padX, cy); cy += lineH

    // 五维属性
    if (equip.stats && Object.keys(equip.stats).length > 0) {
      cy += 4*S
      c.fillStyle = TH.accent; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.fillText('▸ 属性:', x+padX, cy); cy += 14*S
      const statNames = {hp:'气血',pAtk:'物理攻击',mAtk:'魔法攻击',pDef:'物理防御',mDef:'魔法防御'}
      const statColors = {hp:'#ff5555',pAtk:'#ff8c00',mAtk:'#b366ff',pDef:'#4dabff',mDef:'#4dcc4d'}
      Object.entries(equip.stats).forEach(([k,v]) => {
        c.fillStyle = statColors[k] || TH.text; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  ${statNames[k]||k} +${v}`, x+padX, cy); cy += 14*S
      })
    }

    // 普通技能
    cy += 6*S
    c.fillStyle = a.main; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.fillText('▸ 普通技能: '+equip.skill.name, x+padX, cy); cy += lineH
    c.fillStyle = TH.sub; c.font = `${10*S}px "PingFang SC",sans-serif`
    const desc1 = equip.skill.desc.replace(/{(\w+)}/g, (m,k) => equip.skill[k]||m)
    c.fillText('  '+desc1, x+padX, cy); cy += lineH

    // 仙技
    c.fillStyle = TH.accent; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.fillText('★ 仙技: '+equip.ult.name+` (需${equip.ultTrigger}次蓄力)`, x+padX, cy); cy += lineH
    c.fillStyle = TH.sub; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('  倍率 ×'+equip.ult.multi.toFixed(1), x+padX, cy); cy += lineH

    // 被动
    equip.passives.forEach(p => {
      c.fillStyle = TH.success; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.fillText('◆ '+p.name, x+padX, cy); cy += 14*S
      c.fillStyle = TH.sub; c.font = `${10*S}px "PingFang SC",sans-serif`
      c.fillText('  '+p.desc, x+padX, cy); cy += lineH
    })
    return cy - y  // 返回占用高度
  }

  // ===== 难度标签（立体胶囊按钮） =====
  drawDiffTag(x,y,w,h,text,color,active) {
    const {ctx:c,S} = this
    const rad = h/2
    c.save()
    if (active) {
      // 底层厚度
      c.fillStyle=this._darken(color); this.rr(x,y+2*S,w,h,rad); c.fill()
      // 主体渐变
      const g = c.createLinearGradient(x,y,x,y+h)
      g.addColorStop(0,this._lighten(color,0.2)); g.addColorStop(0.5,color); g.addColorStop(1,this._darken(color))
      c.fillStyle=g; this.rr(x,y,w,h,rad); c.fill()
      // 内高光
      c.save(); c.globalAlpha=0.25
      const hg=c.createLinearGradient(x,y,x,y+h*0.45)
      hg.addColorStop(0,'rgba(255,255,255,0.5)'); hg.addColorStop(1,'rgba(255,255,255,0)')
      c.fillStyle=hg; this.rr(x+1*S,y+1*S,w-2*S,h*0.5,rad); c.fill()
      c.restore()
      // 双边框
      c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1.5*S; this.rr(x,y,w,h,rad); c.stroke()
      c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; this.rr(x+1,y+1,w-2,h-2,rad-1); c.stroke()
      c.fillStyle='#fff'
    } else {
      // 非激活：凹陷内嵌感
      c.fillStyle='rgba(0,0,0,0.2)'; this.rr(x,y,w,h,rad); c.fill()
      c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=1; this.rr(x,y,w,h,rad); c.stroke()
      // 内部微弱顶部阴影（凹入感）
      c.save(); c.globalAlpha=0.15
      const ig=c.createLinearGradient(x,y,x,y+h*0.3)
      ig.addColorStop(0,'rgba(0,0,0,0.4)'); ig.addColorStop(1,'rgba(0,0,0,0)')
      c.fillStyle=ig; this.rr(x,y,w,h*0.3,rad); c.fill()
      c.restore()
      c.fillStyle=TH.dim
    }
    c.font=`bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(text,x+w/2,y+h/2)
    c.restore()
  }

  // ===== 毛玻璃卡片（立体浮起质感） =====
  drawGlassCard(x,y,w,h,r) {
    const {ctx:c,S} = this
    const rad = r||12*S
    c.save()
    // 底部投影
    c.fillStyle='rgba(0,0,0,0.15)'; this.rr(x+1*S,y+3*S,w,h,rad); c.fill()
    // 主体
    c.fillStyle='rgba(240,240,245,0.9)'; this.rr(x,y,w,h,rad); c.fill()
    // 顶部高光边
    c.save(); c.globalAlpha=0.5
    const tg=c.createLinearGradient(x,y,x,y+h*0.08)
    tg.addColorStop(0,'rgba(255,255,255,0.8)'); tg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=tg; this.rr(x+2*S,y+1,w-4*S,h*0.08,rad); c.fill()
    c.restore()
    // 双边框
    c.strokeStyle='rgba(255,255,255,0.7)'; c.lineWidth=1.5; this.rr(x,y,w,h,rad); c.stroke()
    c.strokeStyle='rgba(0,0,0,0.06)'; c.lineWidth=1; this.rr(x+1,y+1,w-2,h-2,rad-1); c.stroke()
    c.restore()
  }

  // ===== 深色面板（内凹容器质感） =====
  drawDarkPanel(x,y,w,h,r) {
    const {ctx:c,S} = this
    const rad = r||10*S
    c.save()
    // 内凹：顶部内阴影
    c.fillStyle='rgba(0,0,0,0.15)'; this.rr(x,y-1*S,w,h+1*S,rad); c.fill()
    // 主体
    const g = c.createLinearGradient(x,y,x,y+h)
    g.addColorStop(0,'rgba(22,22,35,0.94)'); g.addColorStop(1,'rgba(32,32,45,0.92)')
    c.fillStyle=g; this.rr(x,y,w,h,rad); c.fill()
    // 顶部内阴影（凹入感）
    c.save(); c.globalAlpha=0.2
    const ig=c.createLinearGradient(x,y,x,y+6*S)
    ig.addColorStop(0,'rgba(0,0,0,0.5)'); ig.addColorStop(1,'rgba(0,0,0,0)')
    c.fillStyle=ig; this.rr(x,y,w,6*S,rad); c.fill()
    c.restore()
    // 底部高光边（凹槽底亮线）
    c.save(); c.globalAlpha=0.08
    c.strokeStyle='#fff'; c.lineWidth=1
    c.beginPath(); c.moveTo(x+rad,y+h); c.lineTo(x+w-rad,y+h); c.stroke()
    c.restore()
    // 外边框
    c.strokeStyle='rgba(60,60,80,0.4)'; c.lineWidth=1; this.rr(x,y,w,h,rad); c.stroke()
    c.restore()
  }

  // ===== 底部导航按钮（立体图标+文字） =====
  drawNavBtn(x,y,w,h,icon,text,active) {
    const {ctx:c,S} = this
    c.save()
    if (active) {
      // 激活态底板
      const ag = c.createLinearGradient(x,y,x,y+h)
      ag.addColorStop(0,'rgba(255,215,0,0.18)'); ag.addColorStop(1,'rgba(255,215,0,0.05)')
      c.fillStyle=ag; this.rr(x+2*S,y+2*S,w-4*S,h-4*S,8*S); c.fill()
      // 顶部亮线
      c.save(); c.globalAlpha=0.5
      c.strokeStyle=TH.accent; c.lineWidth=2*S
      c.beginPath(); c.moveTo(x+w*0.25,y+2*S); c.lineTo(x+w*0.75,y+2*S); c.stroke()
      c.restore()
    }
    // 图标
    const img = this.getImg(icon)
    const iconS = 22*S
    if (img && img.width > 0) {
      c.globalAlpha = active ? 1 : 0.55
      // 图标阴影
      if (active) {
        c.save(); c.globalAlpha=0.3
        c.drawImage(img, x+(w-iconS)/2+1*S, y+5*S, iconS, iconS)
        c.restore(); c.globalAlpha=1
      }
      c.drawImage(img, x+(w-iconS)/2, y+4*S, iconS, iconS)
      c.globalAlpha = 1
    }
    // 文字
    c.fillStyle = active ? TH.accent : TH.dim
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='top'
    if (active) {
      c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=2*S
      c.strokeText(text, x+w/2, y+28*S)
    }
    c.fillText(text, x+w/2, y+28*S)
    c.restore()
  }

  // ===== 任务卡片（立体条目） =====
  drawTaskCard(x,y,w,h,task) {
    const {ctx:c,S} = this
    c.save()
    // 底部投影
    c.fillStyle='rgba(0,0,0,0.12)'; this.rr(x,y+2*S,w,h,8*S); c.fill()
    // 主体
    const bg = task.done ? 'rgba(77,204,77,0.12)' : 'rgba(30,30,50,0.85)'
    c.fillStyle=bg; this.rr(x,y,w,h,8*S); c.fill()
    // 顶部高光
    c.save(); c.globalAlpha=0.08
    const tg=c.createLinearGradient(x,y,x,y+h*0.4)
    tg.addColorStop(0,'rgba(255,255,255,0.3)'); tg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=tg; this.rr(x,y,w,h*0.4,8*S); c.fill()
    c.restore()
    // 边框
    c.strokeStyle = task.done ? TH.success+'55' : 'rgba(80,80,100,0.3)'
    c.lineWidth=1; this.rr(x,y,w,h,8*S); c.stroke()
    // 状态图标
    if (task.done) {
      c.fillStyle=TH.success
      c.beginPath(); c.arc(x+16*S, y+h/2, 8*S, 0, Math.PI*2); c.fill()
      c.fillStyle='#fff'; c.font=`bold ${12*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='middle'; c.fillText('✓',x+16*S,y+h/2)
    } else {
      c.strokeStyle=TH.dim; c.lineWidth=1.5*S
      c.beginPath(); c.arc(x+16*S, y+h/2, 8*S, 0, Math.PI*2); c.stroke()
    }
    // 名称
    c.fillStyle = TH.text; c.font = `${12*S}px "PingFang SC",sans-serif`
    c.textAlign='left'; c.textBaseline='middle'
    c.fillText(task.name, x+30*S, y+h/2-7*S)
    // 进度
    c.fillStyle = TH.sub; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(`${task.progress}/${task.target}`, x+30*S, y+h/2+8*S)
    c.restore()
  }

  // ===== 掉落弹窗 =====
  drawDropPopup(x,y,w,h,equip,frame) {
    const {ctx:c,S} = this
    if (!equip) return
    const q = QUALITY[equip.quality]
    c.save()
    // 遮罩
    c.fillStyle='rgba(0,0,0,0.6)'; c.fillRect(0,0,this.W,this.H)
    // 面板
    const g = c.createLinearGradient(x,y,x,y+h)
    g.addColorStop(0,'rgba(30,30,55,0.96)'); g.addColorStop(1,'rgba(18,18,35,0.98)')
    c.fillStyle=g; this.rr(x,y,w,h,14*S); c.fill()
    // 品质光框
    c.save(); c.globalAlpha = 0.3 + 0.1*Math.sin((frame||0)*0.06)
    c.strokeStyle=q.color; c.lineWidth=2*S; this.rr(x,y,w,h,14*S); c.stroke()
    c.restore()
    // 标题
    c.fillStyle=TH.accent; c.font=`bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='top'
    c.fillText('🎉 获得法宝!', x+w/2, y+12*S)
    // 法宝详情
    this.drawEquipDetail(x, y+36*S, w, equip, frame)
    c.restore()
  }

  // ===== 仙技蓄力指示器 =====
  drawUltGauge(x,y,w,h,current,max,ready,color,frame) {
    const {ctx:c,S} = this
    const pct = Math.min(1, current/max)
    // 背景
    c.fillStyle='rgba(0,0,0,0.3)'; this.rr(x,y,w,h,h/2); c.fill()
    // 填充
    if (pct > 0) {
      const fc = ready ? TH.accent : (color || TH.info)
      c.fillStyle = fc; this.rr(x,y,w*pct,h,h/2); c.fill()
      if (ready) {
        c.save(); c.globalAlpha = 0.3+0.2*Math.sin((frame||0)*0.08)
        c.fillStyle = '#fff'; this.rr(x,y,w*pct,h,h/2); c.fill()
        c.restore()
      }
    }
    // 文字
    c.fillStyle=ready?'#fff':TH.sub; c.font=`bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.fillText(ready?'仙技就绪':`${current}/${max}`, x+w/2, y+h/2)
  }

  // ===== 绝技图标（棋盘下方，含蓄力次数+就绪特效+上滑提示） =====
  drawUltSkillIcon(x, y, size, equip, current, max, ready, frame, swipeProgress) {
    if (!equip) return
    const {ctx:c, S} = this
    const a = ATTR_COLOR[equip.attr]
    const q = QUALITY[equip.quality]
    const slot = EQUIP_SLOT[equip.slot]

    c.save()

    // 上滑时的偏移
    const swipeOff = (swipeProgress || 0) * (-30*S)
    c.translate(0, swipeOff)

    // ===== 就绪时外围旋转光环特效 =====
    if (ready) {
      const pulse = 1 + 0.06*Math.sin(frame*0.08)
      const cx = x + size/2, cy = y + size/2
      // 外圈呼吸光环
      c.save()
      c.globalAlpha = 0.25 + 0.15*Math.sin(frame*0.06)
      const auraR = size*0.7*pulse
      const auraG = c.createRadialGradient(cx, cy, size*0.3, cx, cy, auraR)
      auraG.addColorStop(0, a.main+'88'); auraG.addColorStop(0.6, a.main+'44'); auraG.addColorStop(1, 'transparent')
      c.fillStyle = auraG; c.beginPath(); c.arc(cx, cy, auraR, 0, Math.PI*2); c.fill()
      c.restore()

      // 旋转光点
      c.save()
      for (let i=0; i<4; i++) {
        const angle = frame*0.04 + (Math.PI*2/4)*i
        const pr = size*0.52
        const px = cx + Math.cos(angle)*pr
        const py = cy + Math.sin(angle)*pr
        c.globalAlpha = 0.5 + 0.3*Math.sin(frame*0.1+i)
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(px, py, 2.5*S, 0, Math.PI*2); c.fill()
      }
      c.restore()

      // 底部金色上箭头提示（闪烁）
      c.save()
      c.globalAlpha = 0.4 + 0.4*Math.sin(frame*0.1)
      c.fillStyle = TH.accent
      c.font = `${10*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'top'
      c.fillText('↑', x+size/2, y-12*S)
      c.restore()
    }

    // ===== 图标底板 =====
    // 底部阴影
    c.fillStyle = 'rgba(0,0,0,0.3)'
    this.rr(x+1*S, y+2*S, size, size, 8*S); c.fill()
    // 主体背景渐变
    const bgG = c.createLinearGradient(x, y, x, y+size)
    bgG.addColorStop(0, 'rgba(30,30,50,0.95)'); bgG.addColorStop(1, 'rgba(18,18,35,0.98)')
    c.fillStyle = bgG; this.rr(x, y, size, size, 8*S); c.fill()
    // 属性色叠加
    c.save(); c.globalAlpha = 0.12
    c.fillStyle = a.main; this.rr(x, y, size, size, 8*S); c.fill()
    c.restore()

    // ===== 边框（品质色/就绪时金色） =====
    if (ready) {
      c.strokeStyle = TH.accent; c.lineWidth = 2*S
      // 金色发光
      c.save(); c.globalAlpha = 0.15 + 0.1*Math.sin(frame*0.07)
      c.fillStyle = TH.accent; this.rr(x, y, size, size, 8*S); c.fill()
      c.restore()
    } else {
      c.strokeStyle = q.color+'66'; c.lineWidth = 1.5*S
    }
    this.rr(x, y, size, size, 8*S); c.stroke()

    // ===== 槽位图标（大）- 优先使用图片 =====
    const eqIconImg = this.getImg(`assets/equipment/icon_${equip.slot}_${equip.attr}.jpg`)
    const iconPad = size * 0.15
    if (eqIconImg && eqIconImg.width > 0) {
      const iSz = size - iconPad*2
      c.drawImage(eqIconImg, x+iconPad, y+iconPad*0.6, iSz, iSz*0.7)
    } else {
      c.fillStyle = ready ? '#fff' : a.main
      c.font = `${size*0.38}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(slot.icon, x+size/2, y+size*0.38)
    }

    // ===== 属性小标（左上角） =====
    c.save()
    c.fillStyle = a.main
    c.beginPath(); c.arc(x+10*S, y+10*S, 6*S, 0, Math.PI*2); c.fill()
    c.fillStyle = '#fff'; c.font = `bold ${6*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ATTR_NAME[equip.attr], x+10*S, y+10*S)
    c.restore()

    // ===== 蓄力次数（底部） =====
    const countY = y + size*0.7
    // 进度小条
    const barW = size*0.7, barH = 3*S
    const barX = x + (size-barW)/2
    const pct = Math.min(1, current/max)
    c.fillStyle = 'rgba(0,0,0,0.4)'; this.rr(barX, countY, barW, barH, barH/2); c.fill()
    if (pct > 0) {
      c.fillStyle = ready ? TH.accent : a.main
      this.rr(barX, countY, barW*pct, barH, barH/2); c.fill()
    }
    // 次数文字
    c.fillStyle = ready ? TH.accent : TH.sub
    c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${current}/${max}`, x+size/2, countY+barH+2*S)

    // ===== 上滑进行中的透明度渐变 =====
    if (swipeProgress && swipeProgress > 0) {
      c.globalAlpha = 1 - swipeProgress*0.5
    }

    c.restore()
  }

  // ===== 战斗角色立绘（修士，带装备图标） =====
  drawBattleHero(x, y, size, equipped, hp, maxHp, frame, attackAnim) {
    const {ctx:c, S} = this
    c.save()
    // 攻击动画偏移
    let ox = 0, oy = 0
    if (attackAnim && attackAnim.active) {
      const p = attackAnim.progress
      if (p < 0.3) { ox = p/0.3 * 30*S } // 冲刺
      else if (p < 0.5) { ox = 30*S - (p-0.3)/0.2 * 35*S } // 回弹
      else { ox = -5*S * (1-(p-0.5)/0.5) } // 归位
    }
    c.translate(ox, oy)

    // 脚底光环
    const pulse = 1 + 0.03*Math.sin(frame*0.05)
    c.save(); c.globalAlpha = 0.12
    const footG = c.createRadialGradient(x, y+size*0.45, 0, x, y+size*0.45, size*0.5)
    footG.addColorStop(0, TH.accent); footG.addColorStop(1, 'transparent')
    c.fillStyle = footG; c.beginPath(); c.ellipse(x, y+size*0.45, size*0.5*pulse, size*0.15, 0, 0, Math.PI*2); c.fill()
    c.restore()

    // 角色主体图片
    const heroImg = this.getImg('assets/hero/hero_body.jpg')
    const imgSize = size * 0.85
    if (heroImg && heroImg.width > 0) {
      c.drawImage(heroImg, x-imgSize/2, y-imgSize*0.4, imgSize, imgSize)
    } else {
      // 占位角色
      c.save()
      const bg = c.createRadialGradient(x, y, 5*S, x, y, size*0.4)
      bg.addColorStop(0, '#ffd700'); bg.addColorStop(0.7, '#ff6b35'); bg.addColorStop(1, 'rgba(255,107,53,0)')
      c.fillStyle = bg; c.beginPath(); c.arc(x, y, size*0.4, 0, Math.PI*2); c.fill()
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `${size*0.5}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('🧙', x, y)
      c.restore()
    }

    // 盔甲外观叠加
    const armorEquip = equipped.armor
    if (armorEquip) {
      const armorImg = this.getImg(`assets/hero/armor/armor_${armorEquip.attr}.jpg`)
      if (armorImg && armorImg.width > 0) {
        c.drawImage(armorImg, x-imgSize/2, y-imgSize*0.4, imgSize, imgSize)
      }
    }
    // 武器外观叠加
    const weaponEquip = equipped.weapon
    if (weaponEquip) {
      const wpnImg = this.getImg(`assets/hero/weapon/weapon_${weaponEquip.attr}.jpg`)
      if (wpnImg && wpnImg.width > 0) {
        const wpnSize = imgSize * 0.6
        c.drawImage(wpnImg, x+imgSize*0.1, y-imgSize*0.35, wpnSize, wpnSize)
      }
    }

    // 已装备法宝小图标（角色脚下一排）
    const eqSlots = Object.values(equipped).filter(e => e)
    if (eqSlots.length > 0) {
      const iconS = 14*S
      const totalW = eqSlots.length * (iconS + 2*S)
      let ix = x - totalW/2
      eqSlots.forEach(eq => {
        const ac = ATTR_COLOR[eq.attr]
        const q = QUALITY[eq.quality]
        // 小方块底色
        c.fillStyle = 'rgba(0,0,0,0.4)'
        this.rr(ix, y+size*0.35, iconS, iconS, 3*S); c.fill()
        c.fillStyle = ac.main+'88'
        this.rr(ix, y+size*0.35, iconS, iconS, 3*S); c.fill()
        // 品质边框
        c.strokeStyle = q.color+'99'; c.lineWidth = 1
        this.rr(ix, y+size*0.35, iconS, iconS, 3*S); c.stroke()
        // 槽位图标（优先图片）
        const eqImg = this.getImg(`assets/equipment/icon_${eq.slot}_${eq.attr}.jpg`)
        if (eqImg && eqImg.width > 0) {
          c.drawImage(eqImg, ix+1*S, y+size*0.35+1*S, iconS-2*S, iconS-2*S)
        } else {
          const slot = EQUIP_SLOT[eq.slot]
          c.fillStyle = '#fff'; c.font = `${8*S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText(slot.icon, ix+iconS/2, y+size*0.35+iconS/2)
        }
        ix += iconS + 2*S
      })
    }

    // HP条
    const hpW = size*0.9, hpH = 6*S
    const hpX = x - hpW/2, hpY = y + size*0.5 + 4*S
    this.drawHp(hpX, hpY, hpW, hpH, hp, maxHp, TH.success)
    // HP数字
    c.fillStyle = TH.text; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${hp}/${maxHp}`, x, hpY+hpH+2*S)
    // 名字
    c.fillStyle = TH.accent; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('修仙者', x, hpY+hpH+14*S)

    c.restore()
  }

  // ===== 战斗妖兽立绘 =====
  drawBattleEnemy(x, y, size, attr, hp, maxHp, name, avatar, frame, hurtAnim) {
    const {ctx:c, S} = this
    const a = A[attr]
    if (!a) return
    c.save()
    // 受击动画
    let shake = 0
    if (hurtAnim && hurtAnim.active) {
      shake = Math.sin(hurtAnim.progress * Math.PI * 6) * 4*S * (1 - hurtAnim.progress)
    }
    c.translate(shake, 0)

    // 妖气光环
    const pulse = 1 + 0.05*Math.sin(frame*0.04)
    c.save(); c.globalAlpha = 0.15
    const auraG = c.createRadialGradient(x, y, size*0.15, x, y, size*0.55*pulse)
    auraG.addColorStop(0, a.main); auraG.addColorStop(1, 'transparent')
    c.fillStyle = auraG; c.beginPath(); c.arc(x, y, size*0.55*pulse, 0, Math.PI*2); c.fill()
    c.restore()

    // 脚底暗影
    c.save(); c.globalAlpha = 0.15
    c.fillStyle = a.dk
    c.beginPath(); c.ellipse(x, y+size*0.4, size*0.4, size*0.12, 0, 0, Math.PI*2); c.fill()
    c.restore()

    // 怪物主体
    const img = avatar ? this.getImg(avatar) : null
    const imgSize = size * 0.8
    if (img && img.width > 0) {
      c.drawImage(img, x-imgSize/2, y-imgSize*0.45, imgSize, imgSize)
    } else {
      const g = c.createRadialGradient(x, y-size*0.1, size*0.05, x, y, size*0.4)
      g.addColorStop(0, a.lt); g.addColorStop(0.6, a.main); g.addColorStop(1, a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x, y, size*0.38, 0, Math.PI*2); c.fill()
      // 高光
      c.fillStyle = 'rgba(255,255,255,0.2)'
      c.beginPath(); c.ellipse(x-size*0.08, y-size*0.12, size*0.2, size*0.14, 0, 0, Math.PI*2); c.fill()
    }

    // 属性标识
    c.save(); c.globalAlpha = 0.7
    c.fillStyle = a.main
    c.beginPath(); c.arc(x+size*0.35, y-size*0.35, 8*S, 0, Math.PI*2); c.fill()
    c.fillStyle = '#fff'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ATTR_NAME[attr], x+size*0.35, y-size*0.35)
    c.restore()

    // HP条
    const hpW = size*0.85, hpH = 6*S
    const hpX = x - hpW/2, hpY = y + size*0.45 + 2*S
    this.drawHp(hpX, hpY, hpW, hpH, hp, maxHp, a.main)
    // HP数字
    c.fillStyle = TH.text; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${hp}/${maxHp}`, x, hpY+hpH+2*S)
    // 名字
    c.fillStyle = a.main; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(name||'妖兽', x, hpY+hpH+14*S)

    c.restore()
  }

  // ===== 技能释放特效（全屏级） =====
  drawSkillCast(anim, frame) {
    if (!anim || !anim.active) return
    const {ctx:c, W, H, S} = this
    const p = anim.progress
    const clr = anim.color || TH.accent

    c.save()
    // 根据类型绘制不同特效
    switch(anim.type) {
      case 'slash': {
        // 斩击：一道剑气从左到右划过
        c.globalAlpha = Math.min(1, (1-p)*2)
        const slashX = W * 0.2 + p * W * 0.6
        const slashW = 120*S
        const g = c.createLinearGradient(slashX-slashW/2, 0, slashX+slashW/2, 0)
        g.addColorStop(0, 'transparent')
        g.addColorStop(0.3, clr+'88')
        g.addColorStop(0.5, '#fff')
        g.addColorStop(0.7, clr+'88')
        g.addColorStop(1, 'transparent')
        c.fillStyle = g
        c.save()
        c.translate(slashX, H*0.25)
        c.rotate(-0.3)
        c.fillRect(-slashW/2, -3*S, slashW, 6*S)
        // 附加粒子
        for (let i=0; i<5; i++) {
          const px = (Math.random()-0.5)*slashW*0.8
          const py = (Math.random()-0.5)*30*S
          const pr = 2*S + Math.random()*3*S
          c.globalAlpha = Math.random()*0.6*(1-p)
          c.fillStyle = clr
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        c.restore()
        break
      }
      case 'burst': {
        // 爆裂：从中心向外扩散的光圈
        const cx = anim.targetX || W*0.65, cy = anim.targetY || H*0.2
        const maxR = 80*S
        const r = p * maxR
        c.globalAlpha = (1-p)*0.8
        // 外圈
        c.strokeStyle = clr; c.lineWidth = (1-p)*8*S
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.stroke()
        // 内填充
        c.globalAlpha = (1-p)*0.3
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, r)
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, clr); rg.addColorStop(1, 'transparent')
        c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.fill()
        // 碎片粒子
        for (let i=0; i<8; i++) {
          const angle = (Math.PI*2/8)*i + frame*0.02
          const dist = r * (0.5 + Math.random()*0.5)
          const px = cx + Math.cos(angle)*dist
          const py = cy + Math.sin(angle)*dist
          c.globalAlpha = (1-p)*0.5
          c.fillStyle = i%2===0 ? '#fff' : clr
          c.beginPath(); c.arc(px, py, (1-p)*4*S, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'heal': {
        // 治疗：绿色光柱+飘升粒子
        const cx = anim.targetX || W*0.25, cy = anim.targetY || H*0.2
        c.globalAlpha = (1-p)*0.6
        // 光柱
        const pillarG = c.createLinearGradient(cx, cy+60*S, cx, cy-80*S)
        pillarG.addColorStop(0, 'transparent')
        pillarG.addColorStop(0.3, TH.success+'66')
        pillarG.addColorStop(0.5, TH.success+'cc')
        pillarG.addColorStop(0.8, TH.success+'66')
        pillarG.addColorStop(1, 'transparent')
        c.fillStyle = pillarG
        c.fillRect(cx-15*S, cy-80*S, 30*S, 140*S)
        // 上升粒子
        for (let i=0; i<6; i++) {
          const px = cx + (Math.random()-0.5)*40*S
          const py = cy + 40*S - p*120*S - i*15*S
          const pr = 2*S + Math.random()*2*S
          c.globalAlpha = Math.max(0, (1-p)*0.7 - i*0.08)
          c.fillStyle = i%2===0 ? TH.success : '#aaffaa'
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'enemyAtk': {
        // 敌方攻击：红色冲击波从右到左
        c.globalAlpha = (1-p)*0.7
        const cx = W*0.7 - p*W*0.5
        const cy = H*0.22
        const impactR = 30*S + p*20*S
        const ig = c.createRadialGradient(cx, cy, 0, cx, cy, impactR)
        ig.addColorStop(0, '#ff4d6a'); ig.addColorStop(0.5, '#ff4d6a88'); ig.addColorStop(1, 'transparent')
        c.fillStyle = ig; c.beginPath(); c.arc(cx, cy, impactR, 0, Math.PI*2); c.fill()
        // 速度线
        for (let i=0; i<4; i++) {
          const ly = cy + (i-1.5)*12*S
          c.strokeStyle = `rgba(255,77,106,${(1-p)*0.4})`
          c.lineWidth = 2*S
          c.beginPath(); c.moveTo(cx+20*S, ly); c.lineTo(cx+60*S+Math.random()*20*S, ly); c.stroke()
        }
        break
      }
    }
    // 技能名文字
    if (anim.skillName && p < 0.7) {
      c.globalAlpha = p < 0.1 ? p/0.1 : (p < 0.5 ? 1 : (0.7-p)/0.2)
      c.fillStyle = clr; c.font = `bold ${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3*S
      const textY = H*0.18 - p*10*S
      c.strokeText(anim.skillName, W/2, textY)
      c.fillText(anim.skillName, W/2, textY)
    }
    c.restore()
  }

  // ===== VS分隔标记 =====
  drawVsBadge(x, y, frame) {
    const {ctx:c, S} = this
    const pulse = 1 + 0.04*Math.sin(frame*0.06)
    c.save()
    // 背景圆
    c.globalAlpha = 0.7
    c.fillStyle = 'rgba(0,0,0,0.5)'
    c.beginPath(); c.arc(x, y, 14*S*pulse, 0, Math.PI*2); c.fill()
    // 边框
    c.strokeStyle = TH.accent+'88'; c.lineWidth = 1.5*S
    c.beginPath(); c.arc(x, y, 14*S*pulse, 0, Math.PI*2); c.stroke()
    // 文字
    c.globalAlpha = 1
    c.fillStyle = TH.accent; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('VS', x, y)
    c.restore()
  }

  // ===== 技能触发特效 =====
  drawSkillEffect(x,y,text,color,alpha) {
    const {ctx:c,S} = this
    c.save(); c.globalAlpha=alpha
    c.fillStyle=color||TH.accent; c.font=`bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    // 描边
    c.strokeStyle='rgba(0,0,0,0.5)'; c.lineWidth=3*S; c.strokeText(text,x,y)
    c.fillText(text,x,y)
    c.restore()
  }

  // ===== 伤害飘字 =====
  drawDmgFloat(x,y,text,color,alpha,scale) {
    const {ctx:c,S} = this
    c.save(); c.globalAlpha=alpha||1
    c.fillStyle=color||TH.danger; c.font=`bold ${(18*(scale||1))*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.6)'; c.lineWidth=2*S; c.strokeText(text,x,y)
    c.fillText(text,x,y)
    c.restore()
  }

  // 工具 - 颜色加深
  _darken(hex) {
    try {
      const r = parseInt(hex.slice(1,3),16)*0.7
      const g = parseInt(hex.slice(3,5),16)*0.7
      const b = parseInt(hex.slice(5,7),16)*0.7
      return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    } catch(e) { return hex }
  }

  // 工具 - 颜色提亮
  _lighten(hex, amount) {
    try {
      const amt = amount || 0.3
      const r = Math.min(255, parseInt(hex.slice(1,3),16) + 255*amt)
      const g = Math.min(255, parseInt(hex.slice(3,5),16) + 255*amt)
      const b = Math.min(255, parseInt(hex.slice(5,7),16) + 255*amt)
      return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    } catch(e) { return hex }
  }
}

module.exports = { Render, A, TH }
