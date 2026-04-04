/**
 * 渲染模块 - 适配修仙消消乐法宝系统
 * 纯Canvas 2D，支持图片缓存、动画、粒子
 */
const P = require('./platform')
const { ATTR_COLOR, ATTR_NAME, BEAD_ATTR_COLOR, BEAD_ATTR_NAME } = require('./data/tower')
const Particles = require('./engine/particles')
const FXComposer = require('./engine/effectComposer')

// 属性配色（含心珠，渲染用）
const A = {}
Object.keys(BEAD_ATTR_COLOR).forEach(k => {
  const c = BEAD_ATTR_COLOR[k]
  A[k] = { bg:c.bg, main:c.main, lt:c.lt, dk:c.dk, ic:BEAD_ATTR_NAME[k],
    ltr:`${c.lt}88`, gw:c.main+'40', orb:c.main }
})

// 主题色
const TH = {
  bg:'#0b0b15', card:'rgba(255,248,230,0.88)', cardB:'rgba(180,160,120,0.35)',
  text:'#3D2B1F', sub:'rgba(100,85,65,0.85)', dim:'rgba(130,115,95,0.7)',
  accent:'#8B6914', danger:'#C0392B', success:'#27864A', info:'#2E6DA4',
  hard:'#ff8c00', extreme:'#ff4d6a',
}


class Render {
  constructor(ctx, W, H, S, safeTop) {
    this.ctx = ctx; this.W = W; this.H = H; this.S = S; this.safeTop = safeTop
    this._P = P
    this._imgCache = {}
    this._imgAccess = {}   // path → 最后访问帧号，用于 LRU 淘汰
    this._imgFrame = 0     // 全局帧计数器（每次 getImg 时递增）
    this._IMG_CACHE_MAX = 120 // 缓存上限，超出后淘汰最久未用的
    this._gradCache = {}
    this._gradCacheSize = 0
    // 背景星点
    this.bgStars = Array.from({length:40}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: 0.5+Math.random()*1.5, sp: 0.3+Math.random()*0.7, ph: Math.random()*6.28
    }))
  }

  /**
   * 获取缓存的线性渐变（参数固定的静态 UI 用）
   * @param {string} key - 缓存键（如 'topBar', 'hpBg' 等）
   * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
   * @param {Array<[number,string]>} stops - [[offset, color], ...]
   */
  cachedLinearGrad(key, x1, y1, x2, y2, stops) {
    if (this._gradCache[key]) return this._gradCache[key]
    const g = this.ctx.createLinearGradient(x1, y1, x2, y2)
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1])
    if (this._gradCacheSize < 200) { this._gradCache[key] = g; this._gradCacheSize++ }
    return g
  }

  cachedRadialGrad(key, x1, y1, r1, x2, y2, r2, stops) {
    if (this._gradCache[key]) return this._gradCache[key]
    const g = this.ctx.createRadialGradient(x1, y1, r1, x2, y2, r2)
    for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1])
    if (this._gradCacheSize < 200) { this._gradCache[key] = g; this._gradCacheSize++ }
    return g
  }

  // ===== 基础绘制 =====
  rr(x,y,w,h,r) {
    const c = this.ctx
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h)
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

  getImg(path) {
    this._imgFrame++
    if (this._imgCache[path]) {
      this._imgAccess[path] = this._imgFrame
      return this._imgCache[path]
    }
    const img = P.createImage()
    img.onload = () => { if (this._onImageLoad) this._onImageLoad() }
    img.src = path
    this._imgCache[path] = img
    this._imgAccess[path] = this._imgFrame
    // 超阈值时执行 LRU 淘汰
    if (Object.keys(this._imgCache).length > this._IMG_CACHE_MAX) {
      this._evictLRU()
    }
    return img
  }

  /** LRU 淘汰：删除最久未访问的 25% 缓存条目（跳过 _keepPaths 白名单） */
  _evictLRU() {
    const entries = Object.keys(this._imgAccess).map(k => [k, this._imgAccess[k]])
    entries.sort((a, b) => a[1] - b[1])
    const evictCount = Math.ceil(entries.length * 0.25)
    const keepSet = this._keepPaths || new Set()
    let removed = 0
    for (let i = 0; i < entries.length && removed < evictCount; i++) {
      const path = entries[i][0]
      if (keepSet.has(path)) continue
      delete this._imgCache[path]
      delete this._imgAccess[path]
      removed++
    }
  }

  /**
   * 设置常驻白名单（LRU 不淘汰、clearDynamicCache 不删）
   * @param {string[]} paths
   */
  setKeepPaths(paths) {
    this._keepPaths = new Set(paths)
  }

  /**
   * 清理非关键图片缓存（场景切换时调用，避免内存无限增长）
   * @param {string[]} [keepPaths] - 额外保留的路径，与 _keepPaths 合并
   */
  clearDynamicCache(keepPaths) {
    const keepSet = new Set(this._keepPaths || [])
    if (keepPaths) keepPaths.forEach(p => keepSet.add(p))
    for (const path in this._imgCache) {
      if (!keepSet.has(path)) {
        delete this._imgCache[path]
        delete this._imgAccess[path]
      }
    }
    this._beadTexCache = null
    this._beadTexSrcVer = null
  }

  /**
   * 预加载关键图片，返回 Promise
   * @param {string[]} paths - 图片路径数组
   * @param {function} [onProgress] - 进度回调 (loaded, total)
   * @returns {Promise<void>}
   */
  preloadImages(paths, onProgress) {
    let loaded = 0
    const total = paths.length
    if (total === 0) return Promise.resolve()
    return new Promise((resolve) => {
      let settled = false
      // 超时保底：最多等待 5 秒
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; console.log(`[Preload] timeout, ${loaded}/${total} loaded`); resolve() }
      }, 5000)
      paths.forEach(p => {
        const img = this.getImg(p)
        if (img.width > 0) {
          loaded++
          if (onProgress) onProgress(loaded, total)
          if (loaded >= total && !settled) { settled = true; clearTimeout(timeout); resolve() }
          return
        }
        const onDone = () => {
          loaded++
          if (onProgress) onProgress(loaded, total)
          if (loaded >= total && !settled) { settled = true; clearTimeout(timeout); resolve() }
        }
        img.onload = onDone
        img.onerror = onDone  // 加载失败也继续
      })
    })
  }

  // ===== 背景 =====
  drawBg(frame) {
    const {ctx:c,W,H,S} = this
    c.fillStyle = this.cachedLinearGrad('bg',0,0,0,H,[[0,'#0d0d1a'],[0.5,'#141428'],[1,'#0a0a14']]); c.fillRect(0,0,W,H)
    const t = frame*0.01
    this.bgStars.forEach(s => {
      c.fillStyle = `rgba(255,255,255,${0.15+0.2*Math.sin(t*s.sp*5+s.ph)})`
      c.beginPath(); c.arc(s.x,(s.y+frame*s.sp*0.3)%H,s.r*S,0,Math.PI*2); c.fill()
    })
  }

  static SCENE_BG_CFG = {
    home:      { fill: '#050510', img: 'assets/backgrounds/home_bg.jpg', gradKey: 'homeBg', grad: [[0,'#1a1035'],[0.5,'#0d0d2a'],[1,'#050510']] },
    loading:   { fill: '#050510', img: 'assets/backgrounds/loading_bg.jpg' },
    shop:      { fill: '#f5ead0', img: 'assets/backgrounds/shop_bg.jpg' },
    rest:      { fill: '#e8f0e8', img: 'assets/backgrounds/rest_bg.jpg' },
    adventure: { fill: '#f0ead8', img: 'assets/backgrounds/adventure_bg.jpg' },
    reward:    { fill: '#f5ead0', img: 'assets/backgrounds/reward_bg.jpg' },
  }

  _drawSceneBg(scene, frame) {
    const cfg = Render.SCENE_BG_CFG[scene]
    if (!cfg) { this.drawBg(frame); return }
    const {ctx:c,W,H} = this
    c.fillStyle = cfg.fill; c.fillRect(0,0,W,H)
    const img = this.getImg(cfg.img)
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
    } else if (cfg.grad) {
      c.fillStyle = this.cachedLinearGrad(cfg.gradKey,0,0,0,H,cfg.grad); c.fillRect(0,0,W,H)
    } else {
      this.drawBg(frame)
    }
  }

  drawHomeBg(frame)      { this._drawSceneBg('home', frame) }
  drawLoadingBg(frame)   { this._drawSceneBg('loading', frame) }
  drawShopBg(frame)      { this._drawSceneBg('shop', frame) }
  drawRestBg(frame)      { this._drawSceneBg('rest', frame) }
  drawAdventureBg(frame) { this._drawSceneBg('adventure', frame) }
  drawRewardBg(frame)    { this._drawSceneBg('reward', frame) }

  drawEventBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/event_bg.jpg') || this.getImg('assets/backgrounds/event_bg.png')
    if (img && img.width > 0) {
      this._drawCoverImg(img, 0, 0, W, H)
      return
    }
    // 代码绘制：深红暗金战斗氛围
    c.fillStyle = this.cachedRadialGrad('eventBgCenter',W*0.5,H*0.42,H*0.05,W*0.5,H*0.42,H*0.72,[[0,'#3A1A18'],[0.6,'#2A100E'],[1,'#1A0C0A']]); c.fillRect(0,0,W,H)

    // 顶部烈焰裂隙光
    c.fillStyle = this.cachedLinearGrad('eventBgTop',0,0,0,H*0.25,[[0,'rgba(212,160,64,0.28)'],[0.5,'rgba(139,32,32,0.18)'],[1,'rgba(139,32,32,0)']]); c.fillRect(0,0,W,H*0.25)

    // 底部余烬
    c.fillStyle = this.cachedLinearGrad('eventBgBot',0,H*0.78,0,H,[[0,'rgba(139,32,32,0)'],[0.6,'rgba(139,32,32,0.12)'],[1,'rgba(212,160,64,0.2)']]); c.fillRect(0,H*0.78,W,H*0.22)

    // 四角暗红光晕（缓存渐变避免每帧重建）
    const corners = [[0,0,'TL'],[W,0,'TR'],[0,H,'BL'],[W,H,'BR']]
    corners.forEach(([cx,cy,tag]) => {
      c.fillStyle = this.cachedRadialGrad(`evtCorner${tag}`, cx, cy, 0, cx, cy, W*0.5,
        [[0, 'rgba(139,32,32,0.15)'], [1, 'rgba(139,32,32,0)']])
      c.fillRect(0,0,W,H)
    })

    // 上升余烬粒子
    c.save()
    for (let i = 0; i < 30; i++) {
      const px = ((i * 137.5 + 23) % W)
      const baseY = ((i * 97.3 + 41) % H)
      const drift = (frame * 0.3 + i * 50) % H
      const py = (H - drift + baseY) % H
      const alpha = 0.15 + 0.1 * Math.sin(frame * 0.05 + i)
      c.fillStyle = i % 3 === 0
        ? `rgba(212,160,64,${alpha})`
        : `rgba(200,80,40,${alpha * 0.7})`
      c.beginPath(); c.arc(px, py, 1 + (i % 2) * 0.5, 0, Math.PI*2); c.fill()
    }
    c.restore()
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
    c.fillStyle = this.cachedLinearGrad('battleBg',0,0,0,H,[[0,'#0e0b15'],[0.5,'#161220'],[1,'#0a0810']]); c.fillRect(0,0,W,H)
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
      c.fillStyle = this.cachedLinearGrad('enemyFade', 0, areaBottom - fadeH, 0, areaBottom,
        [[0, 'transparent'], [1, 'rgba(0,0,0,0.5)']])
      c.fillRect(0, areaBottom - fadeH, W, fadeH)
      c.restore()
    } else {
      // 降级：渐变背景
      c.save()
      const bgKey = `enemyBg_${themeBg || 'def'}`
      c.fillStyle = this.cachedLinearGrad(bgKey, 0, areaTop, 0, areaBottom,
        [[0, theme.top], [0.5, theme.mid], [1, theme.bot]])
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
    c.fillStyle = this.cachedLinearGrad('topBar',0,0,0,barH,[[0,'rgba(8,8,20,0.85)'],[1,'rgba(8,8,20,0.6)']]); c.fillRect(0,0,W,barH)
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

  // ===== 灵珠（离屏缓存圆形纹理，避免每帧 clip） =====
  drawBead(x,y,r,attr,frame) {
    const {ctx:c,S} = this
    const a = A[attr]
    if (!a) return
    const img = this.getImg(`assets/orbs/orb_${attr}.png`)
    if (img && img.width > 0) {
      const sz = r * 2
      const texKey = `bead_${attr}_${Math.round(sz)}`
      let tex = this._beadTexCache && this._beadTexCache[texKey]
      if (!tex && this._P && this._P.createOffscreenCanvas) {
        if (!this._beadTexCache) this._beadTexCache = {}
        if (!this._beadTexSrcVer) this._beadTexSrcVer = {}
        const texSz = Math.round(sz)
        const oc = this._P.createOffscreenCanvas({ type: '2d', width: texSz, height: texSz })
        const octx = oc.getContext('2d')
        octx.imageSmoothingEnabled = true
        octx.imageSmoothingQuality = 'medium'
        const hr = texSz / 2
        octx.beginPath(); octx.arc(hr, hr, hr, 0, Math.PI*2); octx.clip()
        octx.drawImage(img, 0, 0, texSz, texSz)
        this._beadTexCache[texKey] = oc
        this._beadTexSrcVer[texKey] = img.width
        tex = oc
      }
      if (tex) {
        c.drawImage(tex, x - r, y - r, sz, sz)
      } else {
        c.save()
        c.imageSmoothingEnabled = true
        c.imageSmoothingQuality = 'medium'
        c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.clip()
        c.drawImage(img, x - sz/2, y - sz/2, sz, sz)
        c.restore()
      }
    } else {
      c.fillStyle = this.cachedRadialGrad(`bead_${attr}`, x-r*0.25, y-r*0.3, r*0.1, x, y, r,
        [[0,a.lt], [0.7,a.main], [1,a.dk]])
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
      c.fillStyle='rgba(255,255,255,0.35)'
      c.beginPath(); c.ellipse(x-r*0.15,y-r*0.25,r*0.45,r*0.3,0,0,Math.PI*2); c.fill()
    }
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
      c.fillStyle = this.cachedRadialGrad(`enemy_${attr}`, x, y-r*0.3, r*0.1, x, y, r,
        [[0,a.lt], [0.7,a.main], [1,a.dk]])
      c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
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
  // lowHpFlash: 传入动画帧号(af)时，血量<=20%会触发深红色闪动警告
  drawHp(x,y,w,h,hp,maxHp,color,hpLoss,showNum,numColor,shield,hpGain,lowHpFlash) {
    const {ctx:c,S} = this
    const pct = Math.max(0,Math.min(1,hp/maxHp))
    const isLowHp = pct > 0 && pct <= 0.2 && lowHpFlash !== undefined
    // 凹槽背景
    c.save()
    c.fillStyle='rgba(0,0,0,0.5)'; this.rr(x,y,w,h,h/2); c.fill()
    // 内阴影（使用缓存渐变）
    c.save(); c.globalAlpha=0.3
    c.fillStyle = this.cachedLinearGrad('hpInnerShadow', x, y, x, y+h*0.4,
      [[0,'rgba(0,0,0,0.4)'], [1,'rgba(0,0,0,0)']])
    this.rr(x,y,w,h*0.4,h/2); c.fill()
    c.restore()

    // 掉血灰色残影（在当前血量之前绘制）+ 伤害数字
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
      
      // 注意：总伤害现在统一在 battle.js 中通过 dmgFloats 显示，避免重复
    }

    // 加血绿色底层（先画亮绿增量，再画血条覆盖到旧血量位置，增量部分露出亮绿）
    const gainActive = hpGain && hpGain.fromPct < pct
    if (gainActive) {
      const gt = hpGain.timer
      const greenAlpha = gt <= 25 ? 1 : Math.max(0, 1 - (gt - 25) / 30)
      // 亮绿增量条（fromPct → pct）— 使用高亮绿色确保与血条颜色有明显区分
      c.save(); c.globalAlpha = greenAlpha
      c.fillStyle = this.cachedLinearGrad('hpGainGreen', x, y, x, y+h,
        [[0, '#80ff80'], [0.5, '#40ff60'], [1, '#20cc40']])
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
      // 低血量(<=20%)时强制使用深红色
      const barColor = isLowHp ? '#8b0000' : (color || (pct>0.5?TH.success:pct>0.2?TH.hard:TH.danger))
      const fg = this.cachedLinearGrad(`hpBar_${barColor}`, x, y, x, y+h,
        [[0,this._lighten(barColor,0.15)], [0.5,barColor], [1,this._darken(barColor)]])
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
      // 低血量闪动特效：快速明暗交替脉冲 + 红色发光
      if (isLowHp) {
        const af = lowHpFlash || 0
        // 快速闪烁（频率较高，引起注意）
        const flashAlpha = 0.25 + 0.35 * Math.abs(Math.sin(af * 0.18))
        c.save(); c.globalAlpha = flashAlpha
        c.fillStyle = '#ff1a1a'
        this.rr(x, y, w*pct, h, h/2); c.fill()
        c.restore()
        // 外发光脉冲
        c.save()
        const glowAlpha = 0.3 + 0.35 * Math.sin(af * 0.18)
        c.shadowColor = '#ff0000'; c.shadowBlur = 6*S
        c.globalAlpha = glowAlpha
        c.strokeStyle = '#ff2020'; c.lineWidth = 1.5*S
        this.rr(x - 1*S, y - 1*S, w*pct + 2*S, h + 2*S, (h+2*S)/2); c.stroke()
        c.shadowBlur = 0
        c.restore()
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
        c.fillStyle = this.cachedLinearGrad('hpShield', shieldStartX, y, shieldStartX, y+h,
          [[0, '#7ddfff'], [0.5, '#40b8e0'], [1, '#2891b5']])
        this.rr(shieldStartX, y, shieldW, h, h/2); c.fill()
        // 护盾高光
        c.save(); c.globalAlpha = 0.4
        c.fillStyle = '#fff'; this.rr(shieldStartX+1*S, y+1, shieldW-2*S, h*0.35, h/4); c.fill()
        c.restore()
      }
    }
    // 槽边框（低血量时用暗红描边加强警示）
    if (isLowHp) {
      const borderAlpha = 0.4 + 0.3 * Math.abs(Math.sin((lowHpFlash || 0) * 0.18))
      c.strokeStyle = `rgba(180,0,0,${borderAlpha})`; c.lineWidth = 1.5*S
    } else {
      c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1
    }
    this.rr(x,y,w,h,h/2); c.stroke()
    // HP数值（条上居中）
    if (showNum) {
      const fontSize = Math.max(8*S, h * 0.7)
      c.font = `bold ${fontSize}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2*S
      const hpTxt = `${Math.round(hp)}/${Math.round(maxHp)}`
      // 低血量时HP数值也闪红
      const hpNumColor = isLowHp ? '#ff4444' : (numColor || '#fff')
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
        c.fillStyle = hpNumColor
        c.fillText(hpTxt, startX, y + h/2)
        // 绘制护盾部分（青色）
        c.strokeText(shieldTxt, startX + hpW, y + h/2)
        c.fillStyle = '#7ddfff'
        c.fillText(shieldTxt, startX + hpW, y + h/2)
      } else {
        c.strokeText(hpTxt, x + w/2, y + h/2)
        c.fillStyle = hpNumColor
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

  // ===== 弹窗面板（统一暖色风格，优先 info_panel_bg 图片） =====
  drawDialogPanel(x, y, w, h) {
    const {ctx:c, S} = this
    const img = this.getImg('assets/ui/info_panel_bg.png')
    if (img && img.width) {
      c.drawImage(img, x, y, w, h)
    } else {
      this.drawInfoPanel(x, y, w, h)
    }
  }

  // ===== 说明面板（程序绘制浅色面板，统一风格） =====
  drawInfoPanel(x, y, w, h) {
    const {ctx:c, S} = this
    const rad = 14*S
    // 浅色暖白渐变背景（与图鉴信息框一致）
    const bgGrad = c.createLinearGradient(x, y, x, y + h)
    bgGrad.addColorStop(0, 'rgba(248,242,230,0.97)')
    bgGrad.addColorStop(0.5, 'rgba(244,237,224,0.97)')
    bgGrad.addColorStop(1, 'rgba(238,230,218,0.97)')
    c.fillStyle = bgGrad
    this.rr(x, y, w, h, rad); c.fill()
    // 柔和金色边框
    c.strokeStyle = 'rgba(201,168,76,0.4)'; c.lineWidth = 1.5*S
    this.rr(x, y, w, h, rad); c.stroke()
  }

  // ===== 弹窗按钮（图片资源版） =====
  drawDialogBtn(x, y, w, h, text, type) {
    const {ctx:c, S} = this
    // type: 'confirm' | 'cancel' | 'adReward'（看广告等激励） | 'gold'（分享等）
    let imgPath = 'assets/ui/btn_confirm.png'
    let textFill = '#4A2020'
    if (type === 'cancel') {
      imgPath = 'assets/ui/btn_cancel.png'
      textFill = '#1E2A3A'
    } else if (type === 'adReward') {
      imgPath = 'assets/ui/btn_reward_confirm.png'
      textFill = '#4A2020'
    } else if (type === 'gold') {
      imgPath = 'assets/ui/btn_confirm.png'
      textFill = '#4A2020'
    }
    const img = this.getImg(imgPath)
    if (img && img.width) {
      c.drawImage(img, x, y, w, h)
      // 叠加文字 — 右偏10%避开左侧装饰图案
      c.save()
      c.fillStyle = textFill
      c.font = `bold ${Math.min(13*S, h*0.38)}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.shadowColor = 'rgba(255,255,255,0.3)'; c.shadowBlur = 1*S
      c.fillText(text, x + w*0.55, y + h*0.48)
      c.shadowBlur = 0
      c.restore()
    } else {
      // fallback: 使用原有drawBtn
      const clr = type === 'cancel' ? '#5b9bd5' : '#e07a5f'
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
        const slashW = 140*S
        // 辉光拖尾
        FXComposer.drawGlowSpot(c, slashX, ty, slashW*0.3, clr, (1-p)*0.4)
        const slG = c.createLinearGradient(slashX-slashW/2, 0, slashX+slashW/2, 0)
        slG.addColorStop(0, 'transparent')
        slG.addColorStop(0.2, clr+'66')
        slG.addColorStop(0.4, clr+'cc')
        slG.addColorStop(0.5, '#fff')
        slG.addColorStop(0.6, clr+'cc')
        slG.addColorStop(0.8, clr+'66')
        slG.addColorStop(1, 'transparent')
        c.fillStyle = slG
        c.save()
        c.translate(slashX, ty)
        c.rotate(-0.3)
        c.fillRect(-slashW/2, -4*S, slashW, 8*S)
        // 斩击细线（双层）
        c.globalAlpha = (1-p) * 0.6
        c.fillStyle = '#fff'
        c.fillRect(-slashW*0.4, -1*S, slashW*0.8, 2*S)
        c.restore()
        // 命中时发射粒子
        if (p > 0.3 && p < 0.35 && !anim._slashParticlesFired) {
          anim._slashParticlesFired = true
          Particles.burst({
            x: tx, y: ty, count: 12, speed: 4*S, size: 3*S,
            life: 15, gravity: 0.08*S, colors: ['#fff', clr], shape: 'glow',
          })
        }
        break
      }
      case 'burst': {
        const cx = tx, cy = ty
        const maxR = 90*S
        const r = p * maxR
        // 中心辉光
        FXComposer.drawGlowSpot(c, cx, cy, r * 0.8, clr, (1-p)*0.5)
        c.globalAlpha = (1-p)*0.85
        c.strokeStyle = clr; c.lineWidth = (1-p)*10*S
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.stroke()
        // 内层光环
        c.globalAlpha = (1-p)*0.4
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, r)
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.3, clr+'cc'); rg.addColorStop(0.7, clr+'44'); rg.addColorStop(1, 'transparent')
        c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.fill()
        // 径向光线
        c.save()
        c.translate(cx, cy)
        for (let i=0; i<12; i++) {
          const angle = (Math.PI*2/12)*i + p*0.8
          const lineLen = r * (0.4 + Math.random()*0.5)
          c.globalAlpha = (1-p)*0.4
          c.strokeStyle = i%3===0 ? '#fff' : clr
          c.lineWidth = (2 - p*1.5)*S
          c.beginPath()
          c.moveTo(Math.cos(angle)*r*0.2, Math.sin(angle)*r*0.2)
          c.lineTo(Math.cos(angle)*lineLen, Math.sin(angle)*lineLen)
          c.stroke()
        }
        c.restore()
        // 粒子爆发
        if (p > 0.15 && p < 0.2 && !anim._burstParticlesFired) {
          anim._burstParticlesFired = true
          Particles.burst({
            x: cx, y: cy, count: 18, speed: 5*S, size: 3.5*S,
            life: 20, gravity: 0.06*S, colors: ['#fff', clr, clr], shape: 'star',
          })
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
        // 冲击波扩散
        const impactR = 45*S + p*90*S
        c.globalAlpha = (1-p)*0.85
        const ig = c.createRadialGradient(cx, cy, 0, cx, cy, impactR)
        ig.addColorStop(0, '#ff2244')
        ig.addColorStop(0.25, '#ff4d6acc')
        ig.addColorStop(0.5, '#ff4d6a66')
        ig.addColorStop(1, 'transparent')
        c.fillStyle = ig; c.beginPath(); c.arc(cx, cy, impactR, 0, Math.PI*2); c.fill()
        // 辉光光斑
        FXComposer.drawGlowSpot(c, cx, cy, impactR * 0.6, '#ff2244', (1-p)*0.35)
        // 交叉冲击线（更多更醒目）
        c.save()
        c.translate(cx, cy)
        for (let i=0; i<10; i++) {
          const ang = (Math.PI*2/10)*i + p*0.6
          const lineLen = 35*S + p*70*S
          c.strokeStyle = `rgba(255,77,106,${(1-p)*0.75})`
          c.lineWidth = (3.5 - p*2.5)*S
          c.beginPath()
          c.moveTo(Math.cos(ang)*12*S, Math.sin(ang)*12*S)
          c.lineTo(Math.cos(ang)*lineLen, Math.sin(ang)*lineLen)
          c.stroke()
        }
        c.restore()
        // 中心闪光（更亮更大）
        if (p < 0.25) {
          const flashP = p / 0.25
          c.globalAlpha = (1 - flashP) * 0.95
          c.fillStyle = '#fff'
          const flashR = Math.max(1*S, (25 - flashP*25)*S)
          c.beginPath(); c.arc(cx, cy, flashR, 0, Math.PI*2); c.fill()
        }
        // 粒子爆发
        if (p > 0.1 && p < 0.15 && !anim._enemyAtkParticlesFired) {
          anim._enemyAtkParticlesFired = true
          Particles.burst({
            x: cx, y: cy, count: 15, speed: 5*S, size: 3*S,
            life: 18, gravity: 0.12*S, colors: ['#fff', '#ff4d6a', '#ff6677'], shape: 'glow',
          })
        }
        // 碎片粒子（手绘补充）
        c.globalAlpha = (1-p)*0.65
        for (let i=0; i<10; i++) {
          const pAng = (Math.PI*2/10)*i + i*0.3
          const dist = 20*S + p*75*S + i*5*S
          const px = cx + Math.cos(pAng)*dist
          const py = cy + Math.sin(pAng)*dist + p*20*S
          const pr = Math.max(0.5*S, (3.5-p*2.8)*S)
          c.fillStyle = i%3===0 ? '#fff' : '#ff6677'
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
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
          const pr = Math.max(0, (2+Math.random()*2)*S*(1-p))
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
          c.beginPath(); c.arc(px2, py2, Math.max(0, (1-p)*3*S), 0, Math.PI*2); c.fill()
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

  // ===== 伤害飘字（读取 RENDER_CFG 配置） =====
  drawDmgFloat(f) {
    const {ctx:c,S} = this
    const RC = require('./engine/dmgFloat').RENDER_CFG.dmgFloat
    const {x,y,text,color,alpha,scale,tag} = f
    const drawX = x + (f._shakeOffset || 0)
    c.save(); c.globalAlpha=alpha||1
    const sz = (RC.fontSize*(scale||1))*S
    c.font=`bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.85)'; c.lineWidth=RC.stroke*S; c.strokeText(text,drawX,y)
    c.shadowColor = color || TH.danger; c.shadowBlur = RC.glow*S
    c.fillStyle=color||TH.danger
    c.fillText(text,drawX,y)
    c.shadowBlur = 0
    if (tag) {
      const tagSz = sz * RC.tagRatio
      c.font = `bold ${tagSz}px "PingFang SC",sans-serif`
      c.globalAlpha = (alpha || 1) * 0.75
      c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2.5*S
      const tagY = y + sz * 0.55
      c.strokeText(tag, drawX, tagY)
      c.fillStyle = '#ffffff'
      c.fillText(tag, drawX, tagY)
    }
    c.restore()
  }

  // ===== 消除数值飘字（读取 RENDER_CFG 配置） =====
  drawElimFloat(f) {
    const {ctx:c,S} = this
    const RC = require('./engine/dmgFloat').RENDER_CFG.elimFloat
    const {x,y,text,color,alpha,scale} = f
    c.save(); c.globalAlpha = alpha || 1
    const sz = (RC.fontSize*(scale||1))*S
    c.font = `bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.85)'; c.lineWidth = RC.stroke*S
    c.strokeText(text, x, y)
    c.shadowColor = color || '#fff'; c.shadowBlur = RC.glow*S
    c.fillStyle = color || '#fff'
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

  // 工具 - 解析颜色为 [r,g,b]
  _parseColor(c) {
    if (c.startsWith('#')) {
      const hex = c.slice(1)
      if (hex.length <= 4) {
        // 3/4位短hex：每位扩展为两位（如 #abc → #aabbcc）
        return [parseInt(hex[0]+hex[0],16), parseInt(hex[1]+hex[1],16), parseInt(hex[2]+hex[2],16)]
      }
      return [parseInt(hex.slice(0,2),16), parseInt(hex.slice(2,4),16), parseInt(hex.slice(4,6),16)]
    }
    const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (m) return [+m[1], +m[2], +m[3]]
    return [128,128,128]
  }

  // 工具 - 颜色加深
  _darken(color) {
    try {
      const [r,g,b] = this._parseColor(color)
      return `rgb(${Math.round(r*0.7)},${Math.round(g*0.7)},${Math.round(b*0.7)})`
    } catch(e) { return color }
  }

  // 工具 - 颜色提亮
  _lighten(color, amount) {
    try {
      const amt = amount || 0.3
      const [r,g,b] = this._parseColor(color)
      return `rgb(${Math.min(255,Math.round(r+255*amt))},${Math.min(255,Math.round(g+255*amt))},${Math.min(255,Math.round(b+255*amt))})`
    } catch(e) { return color }
  }

  // 法宝金色边框（与战斗界面一致）
  drawWeaponFrame(x, y, size, alpha) {
    const ctx = this.ctx, S = this.S
    const a = alpha != null ? alpha : 1
    ctx.save()
    if (a < 1) ctx.globalAlpha = a
    const bPad = 2*S
    const bx = x - bPad, by = y - bPad, bsz = size + bPad*2, brd = 6*S
    const goldGrd = ctx.createLinearGradient(bx, by, bx + bsz, by + bsz)
    goldGrd.addColorStop(0, '#ffd700')
    goldGrd.addColorStop(0.3, '#ffec80')
    goldGrd.addColorStop(0.5, '#ffd700')
    goldGrd.addColorStop(0.7, '#c8a200')
    goldGrd.addColorStop(1, '#ffd700')
    ctx.strokeStyle = goldGrd
    ctx.lineWidth = 3*S
    this.rr(bx, by, bsz, bsz, brd); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,236,128,0.5)'
    ctx.lineWidth = 1*S
    this.rr(bx + 2*S, by + 2*S, bsz - 4*S, bsz - 4*S, 4*S); ctx.stroke()
    const cornerOff = 3*S, cornerR = 3.5*S
    const corners = [
      [bx + cornerOff, by + cornerOff],
      [bx + bsz - cornerOff, by + cornerOff],
      [bx + cornerOff, by + bsz - cornerOff],
      [bx + bsz - cornerOff, by + bsz - cornerOff],
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
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 6*S
    ctx.strokeStyle = 'rgba(255,215,0,0.3)'
    ctx.lineWidth = 1*S
    this.rr(bx, by, bsz, bsz, brd); ctx.stroke()
    ctx.restore()
  }
}

module.exports = { Render, A, TH }
