/**
 * 渲染模块 - 适配修仙消消乐法宝系统
 * 纯Canvas 2D，支持图片缓存、动画、粒子
 */
const { ATTR_COLOR, ATTR_NAME, BEAD_ATTR_COLOR, BEAD_ATTR_NAME } = require('./data/tower')

// 属性配色（含心珠，渲染用）
const A = {}
Object.keys(BEAD_ATTR_COLOR).forEach(k => {
  const c = BEAD_ATTR_COLOR[k]
  A[k] = { bg:c.bg, main:c.main, lt:c.lt, dk:c.dk, ic:BEAD_ATTR_NAME[k],
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
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
    } else {
      const g = c.createLinearGradient(0,0,0,H)
      g.addColorStop(0,'#1a1035'); g.addColorStop(0.5,'#0d0d2a'); g.addColorStop(1,'#050510')
      c.fillStyle = g; c.fillRect(0,0,W,H)
    }

  }

  drawLoadingBg(frame) {
    const {ctx:c,W,H} = this
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/loading_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
    } else {
      this.drawBg(frame)
    }
  }

  drawShopBg(frame) {
    const {ctx:c,W,H} = this
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/shop_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
      c.save(); c.globalAlpha=0.35; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawAdventureBg(frame) {
    const {ctx:c,W,H} = this
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/adventure_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
      c.save(); c.globalAlpha=0.35; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawRewardBg(frame) {
    const {ctx:c,W,H} = this
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/reward_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
      c.save(); c.globalAlpha=0.25; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  // 各主题的背景色调配置
  static THEME_BG = {
    theme_metal: { top:'#1a1520', mid:'#2a2035', bot:'#0e0b12', accent:'#c0a060', particle:'#ffd700' },
    theme_wood:  { top:'#0d1a0d', mid:'#1a2e1a', bot:'#081208', accent:'#5daf5d', particle:'#90ee90' },
    theme_earth: { top:'#1a1510', mid:'#2e2518', bot:'#120e08', accent:'#c8a060', particle:'#deb887' },
    theme_water: { top:'#0a1220', mid:'#152535', bot:'#080e18', accent:'#4090d0', particle:'#87ceeb' },
    theme_fire:  { top:'#200a0a', mid:'#351515', bot:'#180808', accent:'#d05040', particle:'#ff6347' },
    theme_mixed: { top:'#150a1a', mid:'#251535', bot:'#100818', accent:'#a050c0', particle:'#da70d6' },
  }

  drawBattleBg(frame, themeBg) {
    const {ctx:c,W,H,S} = this
    // 下半部（棋盘区）纯暗色背景，不用背景图
    const bg = c.createLinearGradient(0,0,0,H)
    bg.addColorStop(0,'#0e0b15'); bg.addColorStop(0.5,'#161220'); bg.addColorStop(1,'#0a0810')
    c.fillStyle = bg; c.fillRect(0,0,W,H)
  }

  /** 绘制怪物区主题背景（仅覆盖怪物区域） */
  drawEnemyAreaBg(frame, themeBg, areaTop, areaBottom, battleTheme, customBg) {
    const {ctx:c,W,S} = this
    const theme = Render.THEME_BG[themeBg] || Render.THEME_BG.theme_metal
    const areaH = areaBottom - areaTop

    // 优先使用Boss/精英专属背景，其次按属性匹配
    let bgImg = null
    if (customBg) {
      bgImg = this.getImg(`assets/${customBg}.jpg`)
      if (!bgImg || !bgImg.width) bgImg = null
    }
    if (!bgImg && battleTheme) {
      bgImg = this.getImg(`assets/battle/battle_${battleTheme}.jpg`)
      if (!bgImg || !bgImg.width) bgImg = null
    }
    if (!bgImg) bgImg = this.getImg('assets/battle/battle_metal.jpg')
    if (bgImg && bgImg.width > 0) {
      c.save()
      c.beginPath(); c.rect(0, areaTop, W, areaH); c.clip()
      // 图片底部对齐技能栏上方，顶部向上延伸（上方可留空显示关卡信息）
      const imgScale = W / bgImg.width
      const drawH = bgImg.height * imgScale
      const drawY = areaBottom - drawH  // 底部对齐 areaBottom
      c.drawImage(bgImg, 0, drawY, W, drawH)
      // 轻微暗化遮罩，让怪物和UI更清晰
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, areaTop, W, areaH)
      // 底部渐变过渡（让图片底边自然融入技能栏）
      const fadeH = areaH * 0.2
      const fadeG = c.createLinearGradient(0, areaBottom - fadeH, 0, areaBottom)
      fadeG.addColorStop(0, 'transparent')
      fadeG.addColorStop(1, 'rgba(0,0,0,0.5)')
      c.fillStyle = fadeG
      c.fillRect(0, areaBottom - fadeH, W, fadeH)
      c.restore()
    } else {
      // 降级：渐变背景
      c.save()
      const bg = c.createLinearGradient(0, areaTop, 0, areaBottom)
      bg.addColorStop(0, theme.top)
      bg.addColorStop(0.5, theme.mid)
      bg.addColorStop(1, theme.bot)
      c.fillStyle = bg
      c.fillRect(0, areaTop, W, areaH)
      c.restore()
    }
  }

  drawLevelBg(frame) {
    const {ctx:c,W,H} = this
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
      c.save(); c.globalAlpha=0.25; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawEquipBg(frame) {
    const {ctx:c,W,H} = this
    c.fillStyle = '#050510'; c.fillRect(0,0,W,H)
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
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
    const img = this.getImg(`assets/orbs/orb_${attr}.png`)
    if (img && img.width > 0) {
      // 圆形裁剪：只显示球体，隐藏背景色
      c.save()
      c.imageSmoothingEnabled = true
      c.imageSmoothingQuality = 'high'
      c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.clip()
      // 1:1绘制，珠子图案刚好填满圆形裁剪区域
      const sz = r * 2
      c.drawImage(img, x - sz/2, y - sz/2, sz, sz)
      c.restore()
    } else {
      // 降级渐变球体
      const g = c.createRadialGradient(x-r*0.25,y-r*0.3,r*0.1,x,y,r)
      g.addColorStop(0,a.lt); g.addColorStop(0.7,a.main); g.addColorStop(1,a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
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
  drawEnemy(x,y,r,attr,hp,maxHp,name,avatar,frame,opts) {
    const {ctx:c,S} = this
    const a = A[attr]
    const hideLabel = opts && opts.hideLabel  // 隐藏名字和HP条
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
      // 保持原图比例居中绘制
      const iR = img.width / img.height
      let dw, dh
      if (iR > 1) { dw = r*2; dh = r*2 / iR }
      else { dh = r*2; dw = r*2 * iR }
      c.drawImage(img, x - dw/2, y - dh/2, dw, dh)
      c.restore()
    } else {
      const g = c.createRadialGradient(x,y-r*0.3,r*0.1,x,y,r)
      g.addColorStop(0,a.lt); g.addColorStop(1,a.dk)
      c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
    }
    if (!hideLabel) {
      // 名字
      c.fillStyle=TH.text; c.font=`bold ${12*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='top'; c.fillText(name||'敌人',x,y+r+6*S)
      // HP条
      this.drawHp(x-r,y+r+22*S,r*2,5*S,hp,maxHp,a.main)
    }
  }

  // ===== HP条（立体槽+发光填充+掉血灰色残影+数值） =====
  // showNum: 是否在条上显示 hp/maxHp 数值; shield: 护盾值; hpGain: 加血动画
  drawHp(x,y,w,h,hp,maxHp,color,hpLoss,showNum,numColor,shield,hpGain) {
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

    // 掉血灰色残影（在当前血量之前绘制）
    if (hpLoss && hpLoss.fromPct > pct) {
      const totalFrames = 45
      const t = hpLoss.timer / totalFrames
      let lossPct
      if (hpLoss.timer <= 15) {
        lossPct = hpLoss.fromPct
      } else {
        const shrinkT = (hpLoss.timer - 15) / (totalFrames - 15)
        const ease = shrinkT * shrinkT
        lossPct = hpLoss.fromPct + (pct - hpLoss.fromPct) * ease
      }
      const alpha = t < 0.7 ? 0.6 : 0.6 * (1 - (t-0.7)/0.3)
      c.save(); c.globalAlpha = alpha
      c.fillStyle = 'rgba(180,180,180,0.8)'
      this.rr(x, y, w*lossPct, h, h/2); c.fill()
      c.restore()
    }

    // 加血绿色底层（先画亮绿增量，再画血条覆盖到旧血量位置，增量部分露出亮绿）
    const gainActive = hpGain && hpGain.fromPct < pct
    if (gainActive) {
      const gt = hpGain.timer
      const greenAlpha = gt <= 25 ? 1 : Math.max(0, 1 - (gt - 25) / 30)
      // 亮绿增量条（fromPct → pct）— 使用高亮绿色确保与血条颜色有明显区分
      c.save(); c.globalAlpha = greenAlpha
      const gg = c.createLinearGradient(x, y, x, y+h)
      gg.addColorStop(0, '#80ff80'); gg.addColorStop(0.5, '#40ff60'); gg.addColorStop(1, '#20cc40')
      c.fillStyle = gg
      this.rr(x, y, w*pct, h, h/2); c.fill()
      // 绿色高光
      c.globalAlpha = greenAlpha * 0.5
      c.fillStyle = '#fff'
      this.rr(x+2*S, y+1, w*pct-4*S, h*0.35, h/4); c.fill()
      c.restore()
      // 绿色增量区域发光脉冲
      const gainStartX = x + w * hpGain.fromPct
      const gainW = w * (pct - hpGain.fromPct)
      if (gainW > 0) {
        const pulseAlpha = greenAlpha * (0.4 + 0.3 * Math.sin(gt * 0.4))
        c.save(); c.globalAlpha = pulseAlpha
        c.shadowColor = '#40ff60'; c.shadowBlur = 8*S
        c.fillStyle = '#80ff80'
        this.rr(gainStartX, y - 2*S, gainW, h + 4*S, h/2); c.fill()
        c.shadowBlur = 0
        c.restore()
      }
    }

    if (pct > 0) {
      const barColor = color || (pct>0.5?TH.success:pct>0.2?TH.hard:TH.danger)
      const fg=c.createLinearGradient(x,y,x,y+h)
      fg.addColorStop(0,this._lighten(barColor,0.15)); fg.addColorStop(0.5,barColor); fg.addColorStop(1,this._darken(barColor))
      // 加血动画中：血条只画到旧血量(fromPct)，增量部分露出下面的亮绿色
      const drawPct = gainActive ? hpGain.fromPct : pct
      if (drawPct > 0) {
        c.fillStyle=fg; this.rr(x,y,w*drawPct,h,h/2); c.fill()
      }
      // 绿色渐隐后，血条逐渐扩展覆盖增量部分
      if (gainActive && hpGain.timer > 25) {
        const expandT = (hpGain.timer - 25) / 30
        const coverPct = hpGain.fromPct + (pct - hpGain.fromPct) * expandT
        c.fillStyle=fg; this.rr(x,y,w*coverPct,h,h/2); c.fill()
      }
      // 顶部高光条
      c.save(); c.globalAlpha=0.35
      c.fillStyle='#fff'; this.rr(x+2*S,y+1,w*pct-4*S,h*0.35,h/4); c.fill()
      c.restore()
    }
    // 护盾层（在血条右侧紧接着，用青色显示）
    if (shield && shield > 0) {
      const shieldPct = Math.min(shield / maxHp, 1 - pct) // 护盾占比，不超过剩余槽
      const shieldStartX = x + w * pct
      const shieldW = w * shieldPct
      if (shieldW > 0) {
        const sg = c.createLinearGradient(shieldStartX, y, shieldStartX, y+h)
        sg.addColorStop(0, '#7ddfff'); sg.addColorStop(0.5, '#40b8e0'); sg.addColorStop(1, '#2891b5')
        c.fillStyle = sg; this.rr(shieldStartX, y, shieldW, h, h/2); c.fill()
        // 护盾高光
        c.save(); c.globalAlpha = 0.4
        c.fillStyle = '#fff'; this.rr(shieldStartX+1*S, y+1, shieldW-2*S, h*0.35, h/4); c.fill()
        c.restore()
      }
    }
    // 槽边框
    c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1; this.rr(x,y,w,h,h/2); c.stroke()
    // HP数值（条上居中）
    if (showNum) {
      const fontSize = Math.max(8*S, h * 0.7)
      c.font = `bold ${fontSize}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2*S
      const hpTxt = `${Math.round(hp)}/${Math.round(maxHp)}`
      if (shield && shield > 0) {
        // HP数值 + 护盾数值（分颜色绘制）
        const shieldTxt = `+${Math.round(shield)}`
        const fullTxt = hpTxt + ' ' + shieldTxt
        const fullW = c.measureText(fullTxt).width
        const hpW = c.measureText(hpTxt + ' ').width
        const startX = x + w/2 - fullW/2
        c.textAlign = 'left'
        // 绘制HP部分
        c.strokeText(hpTxt, startX, y + h/2)
        c.fillStyle = numColor || '#fff'
        c.fillText(hpTxt, startX, y + h/2)
        // 绘制护盾部分（青色）
        c.strokeText(shieldTxt, startX + hpW, y + h/2)
        c.fillStyle = '#7ddfff'
        c.fillText(shieldTxt, startX + hpW, y + h/2)
      } else {
        c.strokeText(hpTxt, x + w/2, y + h/2)
        c.fillStyle = numColor || '#fff'
        c.fillText(hpTxt, x + w/2, y + h/2)
      }
    }
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

  // ===== 弹窗面板（图片资源版） =====
  drawDialogPanel(x, y, w, h) {
    const {ctx:c, S} = this
    const img = this.getImg('assets/ui/dialog_bg.png')
    if (img && img.width) {
      c.drawImage(img, x, y, w, h)
    } else {
      // fallback: 深色半透明面板 + 金色边框
      const rad = 14*S
      c.fillStyle = 'rgba(20,20,40,0.95)'
      this.rr(x, y, w, h, rad); c.fill()
      c.strokeStyle = '#c9a84c66'; c.lineWidth = 2*S
      this.rr(x, y, w, h, rad); c.stroke()
    }
  }

  // ===== 说明面板（明亮水彩仙侠风，用于宠物/怪物/法宝详情） =====
  drawInfoPanel(x, y, w, h) {
    const {ctx:c, S} = this
    const img = this.getImg('assets/ui/info_panel_bg.png')
    if (img && img.width) {
      // 九宫格绘制：保持四角装饰不变形
      const iw = img.width, ih = img.height
      // 切片边距（取图片短边的30%作为角区域）
      const slice = Math.min(iw, ih) * 0.3
      const dSlice = slice * (w / iw) * 0.8  // 目标切片大小，略微缩小保持精致
      const sl = slice, sr = slice, st = slice, sb = slice
      const dl = dSlice, dr = dSlice, dt = dSlice, db = dSlice

      // 四角
      c.drawImage(img, 0, 0, sl, st, x, y, dl, dt)                                    // 左上
      c.drawImage(img, iw-sr, 0, sr, st, x+w-dr, y, dr, dt)                            // 右上
      c.drawImage(img, 0, ih-sb, sl, sb, x, y+h-db, dl, db)                            // 左下
      c.drawImage(img, iw-sr, ih-sb, sr, sb, x+w-dr, y+h-db, dr, db)                   // 右下
      // 四边
      c.drawImage(img, sl, 0, iw-sl-sr, st, x+dl, y, w-dl-dr, dt)                      // 上
      c.drawImage(img, sl, ih-sb, iw-sl-sr, sb, x+dl, y+h-db, w-dl-dr, db)             // 下
      c.drawImage(img, 0, st, sl, ih-st-sb, x, y+dt, dl, h-dt-db)                      // 左
      c.drawImage(img, iw-sr, st, sr, ih-st-sb, x+w-dr, y+dt, dr, h-dt-db)             // 右
      // 中心
      c.drawImage(img, sl, st, iw-sl-sr, ih-st-sb, x+dl, y+dt, w-dl-dr, h-dt-db)
    } else {
      // fallback: 明亮暖色水彩风面板
      const rad = 16*S
      c.save()
      // 主背景：暖色奶白到淡紫渐变
      const bgGrad = c.createLinearGradient(x, y, x, y + h)
      bgGrad.addColorStop(0, 'rgba(248,240,228,0.96)')    // 暖奶白
      bgGrad.addColorStop(0.3, 'rgba(245,235,225,0.95)')   // 淡米色
      bgGrad.addColorStop(0.7, 'rgba(238,228,240,0.94)')   // 淡薰衣草
      bgGrad.addColorStop(1, 'rgba(232,220,235,0.93)')     // 浅紫粉
      c.fillStyle = bgGrad
      this.rr(x, y, w, h, rad); c.fill()

      // 内层柔光：中心微亮
      const glowGrad = c.createRadialGradient(x+w*0.5, y+h*0.35, 0, x+w*0.5, y+h*0.35, w*0.6)
      glowGrad.addColorStop(0, 'rgba(255,248,230,0.3)')    // 淡金柔光
      glowGrad.addColorStop(1, 'rgba(255,248,230,0)')
      c.fillStyle = glowGrad
      this.rr(x, y, w, h, rad); c.fill()

      // 外边框：双线金色描边（仙侠古卷风）
      c.strokeStyle = 'rgba(201,168,76,0.6)'; c.lineWidth = 2.5*S
      this.rr(x, y, w, h, rad); c.stroke()
      // 内描边：淡金内框
      c.strokeStyle = 'rgba(218,195,130,0.35)'; c.lineWidth = 1*S
      this.rr(x+4*S, y+4*S, w-8*S, h-8*S, rad-2*S); c.stroke()

      // 顶部装饰线（仿古卷分隔线）
      const decoY = y + 28*S
      const decoMargin = 20*S
      c.strokeStyle = 'rgba(201,168,76,0.3)'; c.lineWidth = 1*S
      c.beginPath()
      c.moveTo(x + decoMargin, decoY)
      c.lineTo(x + w - decoMargin, decoY)
      c.stroke()
      // 中心小菱形装饰
      const cx = x + w*0.5, cy = decoY
      const ds = 3*S
      c.fillStyle = 'rgba(201,168,76,0.4)'
      c.beginPath()
      c.moveTo(cx, cy-ds); c.lineTo(cx+ds, cy); c.lineTo(cx, cy+ds); c.lineTo(cx-ds, cy)
      c.closePath(); c.fill()

      // 底部淡金渐变收尾
      const btmGrad = c.createLinearGradient(x, y+h-30*S, x, y+h)
      btmGrad.addColorStop(0, 'rgba(218,195,130,0)')
      btmGrad.addColorStop(1, 'rgba(218,195,130,0.08)')
      c.fillStyle = btmGrad
      this.rr(x, y, w, h, rad); c.fill()

      c.restore()
    }
  }

  // ===== 弹窗按钮（图片资源版） =====
  drawDialogBtn(x, y, w, h, text, type) {
    const {ctx:c, S} = this
    // type: 'confirm' | 'cancel'
    const imgPath = type === 'confirm' ? 'assets/ui/btn_confirm.png' : 'assets/ui/btn_cancel.png'
    const img = this.getImg(imgPath)
    if (img && img.width) {
      c.drawImage(img, x, y, w, h)
      // 叠加文字 — 右偏10%避开左侧装饰图案
      c.save()
      c.fillStyle = type === 'confirm' ? '#4A2020' : '#1E2A3A'
      c.font = `bold ${Math.min(13*S, h*0.38)}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.shadowColor = 'rgba(255,255,255,0.3)'; c.shadowBlur = 1*S
      c.fillText(text, x + w*0.55, y + h*0.48)
      c.shadowBlur = 0
      c.restore()
    } else {
      // fallback: 使用原有drawBtn
      const clr = type === 'confirm' ? '#e07a5f' : '#5b9bd5'
      this.drawBtn(x, y, w, h, text, clr)
    }
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

    // 已装备法宝小图标（角色脚下）— 当前法宝系统不使用此块

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
      const iR2 = img.width / img.height
      let dw2 = imgSize, dh2 = imgSize
      if (iR2 > 1) { dh2 = imgSize / iR2 } else { dw2 = imgSize * iR2 }
      c.drawImage(img, x-dw2/2, y-dh2*0.45, dw2, dh2)
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

  // ===== 战斗怪物全屏立绘（新布局：占满上半区域） =====
  drawBattleEnemyFull(x, y, size, attr, hp, maxHp, name, avatar, frame, hurtAnim, hpLoss) {
    const {ctx:c, S, W} = this
    const a = A[attr]
    if (!a) return
    c.save()
    // 受击动画
    let shake = 0
    if (hurtAnim && hurtAnim.active) {
      shake = Math.sin(hurtAnim.progress * Math.PI * 6) * 6*S * (1 - hurtAnim.progress)
    }
    c.translate(shake, 0)

    // 妖气光环（大范围）
    const pulse = 1 + 0.05*Math.sin(frame*0.04)
    c.save(); c.globalAlpha = 0.12
    const auraG = c.createRadialGradient(x, y, size*0.1, x, y, size*0.7*pulse)
    auraG.addColorStop(0, a.main); auraG.addColorStop(1, 'transparent')
    c.fillStyle = auraG; c.beginPath(); c.arc(x, y, size*0.7*pulse, 0, Math.PI*2); c.fill()
    c.restore()

    // 脚底暗影
    c.save(); c.globalAlpha = 0.2
    c.fillStyle = a.dk
    c.beginPath(); c.ellipse(x, y+size*0.42, size*0.5, size*0.12, 0, 0, Math.PI*2); c.fill()
    c.restore()

    // 怪物主体（大图）
    const img = avatar ? this.getImg(avatar) : null
    const imgSize = size * 0.9
    if (img && img.width > 0) {
      const iR3 = img.width / img.height
      let dw3 = imgSize, dh3 = imgSize
      if (iR3 > 1) { dh3 = imgSize / iR3 } else { dw3 = imgSize * iR3 }
      c.drawImage(img, x-dw3/2, y-dh3*0.5, dw3, dh3)
    } else {
      const g = c.createRadialGradient(x, y-size*0.1, size*0.05, x, y, size*0.45)
      g.addColorStop(0, a.lt); g.addColorStop(0.6, a.main); g.addColorStop(1, a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x, y, size*0.45, 0, Math.PI*2); c.fill()
      c.fillStyle = 'rgba(255,255,255,0.2)'
      c.beginPath(); c.ellipse(x-size*0.1, y-size*0.15, size*0.22, size*0.16, 0, 0, Math.PI*2); c.fill()
    }

    // 属性标识（右上角）
    c.save(); c.globalAlpha = 0.85
    c.fillStyle = a.main
    c.beginPath(); c.arc(x+size*0.4, y-size*0.4, 10*S, 0, Math.PI*2); c.fill()
    c.fillStyle = '#fff'; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ATTR_NAME[attr], x+size*0.4, y-size*0.4)
    c.restore()

    // 名字
    c.fillStyle = a.main; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2*S
    c.strokeText(name||'妖兽', x, y+size*0.46)
    c.fillText(name||'妖兽', x, y+size*0.46)

    // HP条（宽，在怪物下方）
    const hpW = W * 0.7, hpH = 8*S
    const hpX = x - hpW/2, hpY = y + size*0.46 + 18*S
    this.drawHp(hpX, hpY, hpW, hpH, hp, maxHp, a.main, hpLoss)
    // HP数字
    c.fillStyle = TH.text; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${hp}/${maxHp}`, x, hpY+hpH+2*S)

    c.restore()
  }

  // ===== 技能图标栏（棋盘上方，类似智龙迷城队伍栏） =====
  // 左侧大角色头像 | 分隔线 | 右侧技能图标
  drawSkillBar(x, y, w, h, equipped, skillTriggers, frame, heroAttr) {
    const {ctx:c, S} = this
    // 背景
    c.save()
    const bg = c.createLinearGradient(x, y, x, y+h)
    bg.addColorStop(0, 'rgba(10,10,25,0.95)'); bg.addColorStop(1, 'rgba(20,20,40,0.9)')
    c.fillStyle = bg; c.fillRect(x, y, w, h)
    // 顶部金色分割线
    c.strokeStyle = 'rgba(255,215,0,0.3)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x, y); c.lineTo(x+w, y); c.stroke()
    // 底部分割线
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x, y+h); c.lineTo(x+w, y+h); c.stroke()

    // 只展示有绝技的装备（无绝技的不展示）
    const ultList = Object.values(equipped).filter(e => e && e.ult)
    const iconSize = 40*S          // 绝技图标尺寸
    const gap = 5*S
    const heroSize = h - 6*S       // 角色头像撑满栏高（留3px上下边距）
    const heroPad = 6*S            // 头像左侧内边距
    const dividerGap = 8*S         // 分隔线两侧间距
    const iconY = y + (h - iconSize) / 2

    // ===== 绘制角色头像（左侧，更大） =====
    const heroX = heroPad
    const heroY = y + (h - heroSize) / 2
    this._drawHeroIcon(heroX, heroY, heroSize, frame, heroAttr)

    // ===== 竖分隔线 =====
    const divX = heroX + heroSize + dividerGap
    c.strokeStyle = 'rgba(255,215,0,0.25)'; c.lineWidth = 1*S
    c.beginPath(); c.moveTo(divX, y + 6*S); c.lineTo(divX, y + h - 6*S); c.stroke()

    // ===== 绘制绝技图标（分隔线右侧，只展示有绝技的装备） =====
    const skillStartX = divX + dividerGap
    if (ultList.length === 0) {
      c.fillStyle = TH.dim; c.font = `${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('无绝技', skillStartX + 50*S, y+h/2)
      c.restore()
      return
    }

    // 绝技区域可用宽度，图标在其中均匀排列
    const skillAreaW = w - skillStartX - 6*S
    const actualGap = ultList.length > 1
      ? Math.min(gap, (skillAreaW - ultList.length * iconSize) / (ultList.length - 1))
      : 0
    const skillsTotalW = ultList.length * iconSize + Math.max(0, ultList.length-1) * actualGap
    const skillOffsetX = skillStartX + (skillAreaW - skillsTotalW) / 2

    ultList.forEach((eq, idx) => {
      const ix = skillOffsetX + idx * (iconSize + actualGap)
      const cur = (skillTriggers || {})[eq.attr] || 0
      const ready = cur >= eq.ultTrigger
      const a = ATTR_COLOR[eq.attr]
      const q = QUALITY[eq.quality]
      const ult = eq.ult

      // 底部阴影
      c.fillStyle = 'rgba(0,0,0,0.3)'
      this.rr(ix+1*S, iconY+2*S, iconSize, iconSize, 6*S); c.fill()

      // 图标背景
      const ibg = c.createLinearGradient(ix, iconY, ix, iconY+iconSize)
      ibg.addColorStop(0, 'rgba(35,35,55,0.95)'); ibg.addColorStop(1, 'rgba(22,22,38,0.98)')
      c.fillStyle = ibg; this.rr(ix, iconY, iconSize, iconSize, 6*S); c.fill()

      // 属性色叠加
      c.save(); c.globalAlpha = 0.15
      c.fillStyle = a.main; this.rr(ix, iconY, iconSize, iconSize, 6*S); c.fill()
      c.restore()

      // 绝技图标：用绝技名首字 + 属性色渐变圆形
      const icx = ix + iconSize/2, icy = iconY + iconSize*0.38
      const icR = iconSize * 0.28
      const skG = c.createRadialGradient(icx-icR*0.2, icy-icR*0.2, icR*0.1, icx, icy, icR)
      skG.addColorStop(0, a.lt); skG.addColorStop(0.7, a.main); skG.addColorStop(1, a.dk)
      c.fillStyle = skG; c.beginPath(); c.arc(icx, icy, icR, 0, Math.PI*2); c.fill()
      // 绝技名首字
      const ultChar = (ult.name || '').charAt(0) || '技'
      c.fillStyle = '#fff'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(ultChar, icx, icy)

      // 绝技名（图标下方小字）
      c.fillStyle = TH.sub; c.font = `${6*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'top'
      c.fillText(ult.name, ix+iconSize/2, iconY+iconSize*0.7)

      // 边框（就绪时金色脉冲）
      if (ready) {
        c.strokeStyle = TH.accent; c.lineWidth = 2*S
        c.save(); c.globalAlpha = 0.2 + 0.15*Math.sin(frame*0.07)
        c.fillStyle = TH.accent; this.rr(ix, iconY, iconSize, iconSize, 6*S); c.fill()
        c.restore()
        // 闪烁"释放"提示
        c.save(); c.globalAlpha = 0.6 + 0.35*Math.sin(frame*0.1)
        c.fillStyle = TH.accent; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'bottom'
        c.fillText('点击释放', ix+iconSize/2, iconY-1*S)
        c.restore()
      } else {
        c.strokeStyle = q.color+'66'; c.lineWidth = 1.5*S
      }
      this.rr(ix, iconY, iconSize, iconSize, 6*S); c.stroke()

      // 蓄力进度条（底部）
      const barW2 = iconSize - 4*S, barH2 = 3*S
      const barX2 = ix + 2*S, barY2 = iconY + iconSize - 6*S
      const pct = Math.min(1, cur / eq.ultTrigger)
      c.fillStyle = 'rgba(0,0,0,0.4)'; this.rr(barX2, barY2, barW2, barH2, barH2/2); c.fill()
      if (pct > 0) {
        c.fillStyle = ready ? TH.accent : a.main
        this.rr(barX2, barY2, barW2*pct, barH2, barH2/2); c.fill()
      }

      // 属性小标（左上角）
      c.fillStyle = a.main
      c.beginPath(); c.arc(ix+7*S, iconY+7*S, 4.5*S, 0, Math.PI*2); c.fill()
      c.fillStyle = '#fff'; c.font = `bold ${5*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(ATTR_NAME[eq.attr], ix+7*S, iconY+7*S)
    })

    c.restore()
  }

  /** 绘制角色头像（技能栏左侧，大尺寸） */
  _drawHeroIcon(x, y, size, frame, heroAttr) {
    const {ctx:c, S} = this

    // 底部阴影
    c.fillStyle = 'rgba(0,0,0,0.5)'
    this.rr(x+2*S, y+2*S, size, size, 10*S); c.fill()

    // 背景（比技能图标亮，突出角色）
    const bg = c.createLinearGradient(x, y, x, y+size)
    bg.addColorStop(0, 'rgba(50,45,70,0.95)'); bg.addColorStop(1, 'rgba(35,32,50,0.98)')
    c.fillStyle = bg; this.rr(x, y, size, size, 10*S); c.fill()

    // 角色头像图片（圆角裁切）
    const imgPad = 2*S
    c.save()
    this.rr(x+imgPad, y+imgPad, size-imgPad*2, size-imgPad*2, 8*S); c.clip()
    const heroImg = this.getImg('assets/hero/hero_avatar.jpg')
    if (heroImg && heroImg.width > 0) {
      c.drawImage(heroImg, x+imgPad, y+imgPad, size-imgPad*2, size-imgPad*2)
    } else {
      const fg = c.createRadialGradient(x+size/2, y+size*0.4, size*0.1, x+size/2, y+size/2, size*0.4)
      fg.addColorStop(0, '#9999dd'); fg.addColorStop(1, '#555577')
      c.fillStyle = fg; c.fillRect(x+imgPad, y+imgPad, size-imgPad*2, size-imgPad*2)
      c.fillStyle = '#fff'; c.font = `bold ${Math.round(size*0.35)}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('修', x+size/2, y+size*0.42)
    }
    c.restore()

    // 金色边框（呼吸灯）
    const borderAlpha = 0.7 + 0.2 * Math.sin(frame * 0.04)
    c.save(); c.globalAlpha = borderAlpha
    c.strokeStyle = TH.accent; c.lineWidth = 2.5*S
    this.rr(x, y, size, size, 10*S); c.stroke()
    c.restore()

    // 属性小标（左上角）
    if (heroAttr) {
      const ha = ATTR_COLOR[heroAttr]
      if (ha) {
        c.fillStyle = ha.main
        c.beginPath(); c.arc(x+8*S, y+8*S, 6*S, 0, Math.PI*2); c.fill()
        c.fillStyle = '#fff'; c.font = `bold ${6*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText(ATTR_NAME[heroAttr], x+8*S, y+8*S)
      }
    }
  }

  // ===== 人物血条（宽横条，棋盘上方） =====
  drawHeroHpBar(x, y, w, h, hp, maxHp, frame, hpLoss) {
    const {ctx:c, S} = this
    c.save()
    // 背景
    const bg = c.createLinearGradient(x, y, x, y+h)
    bg.addColorStop(0, 'rgba(15,15,30,0.9)'); bg.addColorStop(1, 'rgba(10,10,22,0.85)')
    c.fillStyle = bg; c.fillRect(x, y, w, h)

    // HP条
    const padX = 12*S, padY = 6*S
    const barW = w - padX*2, barH = h - padY*2 - 10*S
    const barX = x + padX, barY = y + padY

    // 槽背景
    c.fillStyle = 'rgba(0,0,0,0.5)'; this.rr(barX, barY, barW, barH, barH/2); c.fill()

    // 掉血灰色残影
    const pct = Math.max(0, Math.min(1, hp/maxHp))
    if (hpLoss && hpLoss.fromPct > pct) {
      const totalFrames = 45
      const t = hpLoss.timer / totalFrames
      let lossPct
      if (hpLoss.timer <= 15) {
        lossPct = hpLoss.fromPct
      } else {
        const shrinkT = (hpLoss.timer - 15) / (totalFrames - 15)
        lossPct = hpLoss.fromPct + (pct - hpLoss.fromPct) * shrinkT * shrinkT
      }
      const alpha = t < 0.7 ? 0.6 : 0.6 * (1 - (t-0.7)/0.3)
      c.save(); c.globalAlpha = alpha
      c.fillStyle = 'rgba(180,180,180,0.8)'
      this.rr(barX, barY, barW*lossPct, barH, barH/2); c.fill()
      c.restore()
    }

    // 填充
    if (pct > 0) {
      const barColor = pct > 0.5 ? TH.success : pct > 0.2 ? TH.hard : TH.danger
      const fg = c.createLinearGradient(barX, barY, barX, barY+barH)
      fg.addColorStop(0, this._lighten(barColor, 0.15)); fg.addColorStop(0.5, barColor); fg.addColorStop(1, this._darken(barColor))
      c.fillStyle = fg; this.rr(barX, barY, barW*pct, barH, barH/2); c.fill()
      // 高光
      c.save(); c.globalAlpha = 0.3
      c.fillStyle = '#fff'; this.rr(barX+2*S, barY+1, barW*pct-4*S, barH*0.35, barH/4); c.fill()
      c.restore()
    }
    // 边框
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; this.rr(barX, barY, barW, barH, barH/2); c.stroke()

    // HP数字（在条上居中）
    c.fillStyle = '#fff'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2*S
    c.strokeText(`${hp} / ${maxHp}`, x+w/2, barY+barH/2)
    c.fillText(`${hp} / ${maxHp}`, x+w/2, barY+barH/2)

    // 底部分割线
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x, y+h); c.lineTo(x+w, y+h); c.stroke()
    c.restore()
  }


  drawSkillCast(anim, frame) {
    if (!anim || !anim.active) return
    const {ctx:c, W, H, S} = this
    const p = anim.progress
    const clr = anim.color || TH.accent
    const tx = anim.targetX || W*0.5
    const ty = anim.targetY || H*0.3

    c.save()
    switch(anim.type) {
      case 'slash': {
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
        c.translate(slashX, ty)
        c.rotate(-0.3)
        c.fillRect(-slashW/2, -3*S, slashW, 6*S)
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
        const cx = tx, cy = ty
        const maxR = 80*S
        const r = p * maxR
        c.globalAlpha = (1-p)*0.8
        c.strokeStyle = clr; c.lineWidth = (1-p)*8*S
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.stroke()
        c.globalAlpha = (1-p)*0.3
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, r)
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, clr); rg.addColorStop(1, 'transparent')
        c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.fill()
        for (let i=0; i<8; i++) {
          const angle = (Math.PI*2/8)*i + frame*0.02
          const dist = r * (0.5 + Math.random()*0.5)
          const px2 = cx + Math.cos(angle)*dist
          const py2 = cy + Math.sin(angle)*dist
          c.globalAlpha = (1-p)*0.5
          c.fillStyle = i%2===0 ? '#fff' : clr
          c.beginPath(); c.arc(px2, py2, (1-p)*4*S, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'heal': {
        const cx = tx, cy = ty
        c.globalAlpha = (1-p)*0.6
        const healClr = clr || TH.success
        const pillarG = c.createLinearGradient(cx, cy+60*S, cx, cy-80*S)
        pillarG.addColorStop(0, 'transparent')
        pillarG.addColorStop(0.3, healClr+'66')
        pillarG.addColorStop(0.5, healClr+'cc')
        pillarG.addColorStop(0.8, healClr+'66')
        pillarG.addColorStop(1, 'transparent')
        c.fillStyle = pillarG
        c.fillRect(cx-15*S, cy-80*S, 30*S, 140*S)
        for (let i=0; i<6; i++) {
          const px = cx + (Math.random()-0.5)*40*S
          const py = cy + 40*S - p*120*S - i*15*S
          const pr = 2*S + Math.random()*2*S
          c.globalAlpha = Math.max(0, (1-p)*0.7 - i*0.08)
          c.fillStyle = i%2===0 ? healClr : '#80ffaa'
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'enemyAtk': {
        const cx = tx, cy = ty
        // 第一阶段：冲击波扩散（更大范围）
        const impactR = 40*S + p*80*S
        c.globalAlpha = (1-p)*0.8
        const ig = c.createRadialGradient(cx, cy, 0, cx, cy, impactR)
        ig.addColorStop(0, '#ff2244')
        ig.addColorStop(0.3, '#ff4d6acc')
        ig.addColorStop(0.6, '#ff4d6a44')
        ig.addColorStop(1, 'transparent')
        c.fillStyle = ig; c.beginPath(); c.arc(cx, cy, impactR, 0, Math.PI*2); c.fill()
        // 交叉斜线冲击（更醒目）
        c.save()
        c.translate(cx, cy)
        for (let i=0; i<8; i++) {
          const ang = (Math.PI*2/8)*i + p*0.5
          const lineLen = 30*S + p*60*S
          c.strokeStyle = `rgba(255,77,106,${(1-p)*0.7})`
          c.lineWidth = (3 - p*2)*S
          c.beginPath()
          c.moveTo(Math.cos(ang)*15*S, Math.sin(ang)*15*S)
          c.lineTo(Math.cos(ang)*lineLen, Math.sin(ang)*lineLen)
          c.stroke()
        }
        c.restore()
        // 中心闪光
        if (p < 0.3) {
          c.globalAlpha = (0.3-p)/0.3 * 0.9
          c.fillStyle = '#fff'
          c.beginPath(); c.arc(cx, cy, (20-p*40)*S, 0, Math.PI*2); c.fill()
        }
        // 碎片粒子
        c.globalAlpha = (1-p)*0.6
        for (let i=0; i<10; i++) {
          const pAng = (Math.PI*2/10)*i + i*0.3
          const dist = 20*S + p*70*S + i*5*S
          const px = cx + Math.cos(pAng)*dist
          const py = cy + Math.sin(pAng)*dist + p*20*S
          const pr = (3-p*2.5)*S
          c.fillStyle = i%3===0 ? '#fff' : '#ff6677'
          c.beginPath(); c.arc(px, py, Math.max(0.5*S, pr), 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'shield': {
        // 护盾特效：六边形护盾展开 + 蓝光脉冲
        const cx2 = tx, cy2 = ty
        const shieldR = 50*S * Math.min(1, p*3) // 快速展开
        const fadeAlpha = p < 0.3 ? p/0.3 : (1-p)*1.4
        c.globalAlpha = Math.max(0, fadeAlpha) * 0.7
        // 护盾光圈
        c.strokeStyle = clr; c.lineWidth = (3 + (1-p)*3)*S
        c.beginPath()
        for (let i=0; i<=6; i++) {
          const ang = (Math.PI*2/6)*i - Math.PI/2
          const sx = cx2 + Math.cos(ang)*shieldR
          const sy = cy2 + Math.sin(ang)*shieldR*0.8
          i===0 ? c.moveTo(sx,sy) : c.lineTo(sx,sy)
        }
        c.closePath(); c.stroke()
        // 护盾内部填充
        c.globalAlpha = Math.max(0, fadeAlpha) * 0.15
        c.fillStyle = clr; c.fill()
        // 向上飘散的护盾粒子
        c.globalAlpha = Math.max(0, fadeAlpha) * 0.6
        for (let i=0; i<6; i++) {
          const seed = i*60
          const px = cx2 + Math.cos(seed)*shieldR*(0.3+Math.random()*0.5)
          const py = cy2 - p*40*S - i*8*S
          const pr = (2+Math.random()*2)*S*(1-p)
          c.fillStyle = i%2===0 ? '#fff' : clr
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'debuff': {
        // 减攻特效：向下的紫色锁链 + 暗化
        const cx3 = tx, cy3 = ty
        const expandP = Math.min(1, p*2.5)
        const fadeAlpha2 = p < 0.2 ? p/0.2 : (1-p)*1.25
        c.globalAlpha = Math.max(0, fadeAlpha2) * 0.6
        // 暗色光环笼罩敌人
        const debuffR = 60*S * expandP
        const dg = c.createRadialGradient(cx3, cy3, 0, cx3, cy3, debuffR)
        dg.addColorStop(0, clr+'66'); dg.addColorStop(0.6, clr+'33'); dg.addColorStop(1, 'transparent')
        c.fillStyle = dg; c.beginPath(); c.arc(cx3, cy3, debuffR, 0, Math.PI*2); c.fill()
        // 向下箭头链
        c.globalAlpha = Math.max(0, fadeAlpha2) * 0.8
        c.fillStyle = clr; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        for (let i=0; i<3; i++) {
          const ay = cy3 - 20*S + i*18*S + p*15*S
          const arrowAlpha = Math.max(0, fadeAlpha2 - i*0.15)
          c.globalAlpha = arrowAlpha * 0.7
          c.fillText('▼', cx3 + (i-1)*20*S, ay)
        }
        // 锁链粒子
        for (let i=0; i<5; i++) {
          const angle2 = (Math.PI*2/5)*i + p*2
          const dist2 = debuffR * 0.6
          const px2 = cx3 + Math.cos(angle2)*dist2
          const py2 = cy3 + Math.sin(angle2)*dist2
          c.globalAlpha = Math.max(0, fadeAlpha2)*0.5
          c.fillStyle = '#fff'
          c.beginPath(); c.arc(px2, py2, (1-p)*3*S, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'dot': {
        // DOT施放特效：灼烧→火焰爆发，中毒→毒雾扩散
        const cx4 = tx, cy4 = ty
        const dotFade = p < 0.15 ? p/0.15 : (1-p)*1.18
        const isBurnDot = anim.dotType === 'burn'
        if (isBurnDot) {
          // 灼烧：中心火焰爆发 + 火焰粒子向上
          c.globalAlpha = Math.max(0, dotFade) * 0.7
          const fireR = 50*S * Math.min(1, p*3)
          const fg2 = c.createRadialGradient(cx4, cy4, 0, cx4, cy4, fireR)
          fg2.addColorStop(0, '#ffdd44cc'); fg2.addColorStop(0.4, '#ff6020aa'); fg2.addColorStop(0.8, '#ff400066'); fg2.addColorStop(1, 'transparent')
          c.fillStyle = fg2; c.beginPath(); c.arc(cx4, cy4, fireR, 0, Math.PI*2); c.fill()
          // 火焰粒子
          for (let i=0; i<10; i++) {
            const fAngle = (Math.PI*2/10)*i + p*3
            const fDist = fireR * (0.3 + p*0.7) + i*3*S
            const fpx = cx4 + Math.cos(fAngle)*fDist*0.6
            const fpy = cy4 - p*40*S - Math.abs(Math.sin(fAngle))*fDist*0.8
            const fpr = (3 - p*2)*S
            c.globalAlpha = Math.max(0, dotFade) * 0.8
            c.fillStyle = i%3===0 ? '#ffdd44' : i%3===1 ? '#ff8020' : '#ff4400'
            c.beginPath(); c.arc(fpx, fpy, Math.max(0.5*S, fpr), 0, Math.PI*2); c.fill()
          }
        } else {
          // 中毒：绿色毒雾扩散
          c.globalAlpha = Math.max(0, dotFade) * 0.5
          const poisonR = 55*S * Math.min(1, p*2.5)
          const pg = c.createRadialGradient(cx4, cy4, 0, cx4, cy4, poisonR)
          pg.addColorStop(0, '#40ff6088'); pg.addColorStop(0.5, '#20cc4066'); pg.addColorStop(0.8, '#00882233'); pg.addColorStop(1, 'transparent')
          c.fillStyle = pg; c.beginPath(); c.arc(cx4, cy4, poisonR, 0, Math.PI*2); c.fill()
          // 毒液粒子（向下滴落）
          for (let i=0; i<8; i++) {
            const pAngle = (Math.PI*2/8)*i + p*2
            const pDist = poisonR * (0.4 + p*0.5)
            const ppx = cx4 + Math.cos(pAngle)*pDist*0.7
            const ppy = cy4 + p*30*S + Math.abs(Math.sin(pAngle))*pDist*0.5
            const ppr = (2.5 - p*1.5)*S
            c.globalAlpha = Math.max(0, dotFade) * 0.7
            c.fillStyle = i%2===0 ? '#40ff60' : '#20cc40'
            c.beginPath(); c.arc(ppx, ppy, Math.max(0.5*S, ppr), 0, Math.PI*2); c.fill()
          }
        }
        break
      }
    }
    if (anim.skillName && p < 0.7) {
      c.globalAlpha = p < 0.1 ? p/0.1 : (p < 0.5 ? 1 : (0.7-p)/0.2)
      c.fillStyle = clr; c.font = `bold ${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3*S
      const textY = ty - p*10*S - 30*S
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
  drawSkillEffect(f) {
    const {ctx:c,S} = this
    const {x,y,text,color,alpha,scale,big} = f
    c.save(); c.globalAlpha=alpha
    const sz = big ? 28 : 16
    const sc = scale || 1
    c.fillStyle=color||TH.accent; c.font=`bold ${sz*sc*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.6)'; c.lineWidth=(big?4:3)*S; c.strokeText(text,x,y)
    c.fillText(text,x,y)
    // 大字光晕
    if (big && alpha > 0.5) {
      c.shadowColor = color || '#40e8ff'
      c.shadowBlur = 20*S*alpha
      c.fillText(text,x,y)
      c.shadowBlur = 0
    }
    // 技能描述副文字（告诉玩家技能效果）
    if (f.desc) {
      const descSz = big ? 13 : 10
      c.font=`bold ${descSz*S}px "PingFang SC",sans-serif`
      c.shadowColor='rgba(0,0,0,0.9)'; c.shadowBlur=4*S
      c.strokeStyle='rgba(0,0,0,0.8)'; c.lineWidth=2.5*S
      const descY = y + sz*0.5*S + 12*S
      c.strokeText(f.desc, x, descY)
      c.fillStyle='#ffe0aa'
      c.fillText(f.desc, x, descY)
      c.shadowBlur=0
    }
    c.restore()
  }

  // ===== 伤害飘字（加大加粗，高对比度） =====
  drawDmgFloat(f) {
    const {ctx:c,S} = this
    const {x,y,text,color,alpha,scale} = f
    c.save(); c.globalAlpha=alpha||1
    const sz = (22*(scale||1))*S
    c.font=`bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    // 深色粗描边（提升对比度）
    c.strokeStyle='rgba(0,0,0,0.85)'; c.lineWidth=3.5*S; c.strokeText(text,x,y)
    // 发光效果
    c.shadowColor = color || TH.danger; c.shadowBlur = 6*S
    c.fillStyle=color||TH.danger
    c.fillText(text,x,y)
    c.shadowBlur = 0
    c.restore()
  }

  // ===== 消除数值飘字（棋子处，加大加粗 + 发光） =====
  drawElimFloat(f) {
    const {ctx:c,S} = this
    const {x,y,text,color,alpha,scale,subText} = f
    c.save(); c.globalAlpha = alpha || 1
    // 主数值（伤害/回复值）
    const sz = (18*(scale||1))*S
    c.font = `bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    // 深色粗描边
    c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineWidth = 3*S
    c.strokeText(text, x, y)
    // 发光效果
    c.shadowColor = color || '#fff'; c.shadowBlur = 5*S
    c.fillStyle = color || '#fff'
    c.fillText(text, x, y)
    c.shadowBlur = 0
    // 副文字（Combo N）
    if (subText) {
      const subSz = 11*S
      c.font = `bold ${subSz}px "PingFang SC",sans-serif`
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2.5*S
      c.strokeText(subText, x, y + sz*0.7)
      c.fillStyle = '#ffd700'
      c.fillText(subText, x, y + sz*0.7)
    }
    c.restore()
  }

  // ===== 宠物头像攻击数值（翻滚效果） =====
  drawPetAtkNum(f) {
    const {ctx:c,S} = this
    const {x, y, text, color, alpha, scale, isHeal} = f
    c.save(); c.globalAlpha = alpha || 1
    const sz = (16 * (scale || 1)) * S
    c.font = `bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign = isHeal ? 'right' : 'center'
    c.textBaseline = isHeal ? 'middle' : 'bottom'
    // 发光效果
    c.shadowColor = color || '#ffd700'
    c.shadowBlur = 6 * S
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3*S
    c.strokeText(text, x, y)
    c.fillStyle = color || '#ffd700'
    c.fillText(text, x, y)
    c.shadowBlur = 0
    c.restore()
  }

  // 工具 - Cover模式绘制图片（无黑边，居中裁剪）
  _drawCoverImg(img, x, y, w, h) {
    const c = this.ctx
    const iw = img.width, ih = img.height
    const scale = Math.max(w / iw, h / ih)
    const dw = iw * scale, dh = ih * scale
    const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2
    c.drawImage(img, dx, dy, dw, dh)
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
