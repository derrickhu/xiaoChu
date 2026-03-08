/**
 * 修炼界面绘制子模块 — 从 cultivationView.js 拆分的纯绘制函数
 * 所有函数仅负责 Canvas 绘制，不持有状态
 */
const V = require('./env')
const {
  CULT_CONFIG, CULT_KEYS, effectValue,
} = require('../data/cultivationConfig')

// 节点主题色和图标（与 cultivationView.js 共用）
const NODE_STYLES = {
  body:    { color: '#E85050', glow: 'rgba(232,80,80,0.5)',   icon: '体' },
  spirit:  { color: '#50C878', glow: 'rgba(80,200,120,0.5)',  icon: '灵' },
  wisdom:  { color: '#5098E8', glow: 'rgba(80,152,232,0.5)',  icon: '悟' },
  defense: { color: '#C89648', glow: 'rgba(200,150,72,0.5)',  icon: '根' },
  sense:   { color: '#A070D0', glow: 'rgba(160,112,208,0.5)', icon: '识' },
}

// 境界特效层级配置
const REALM_FX = [
  { minLv: 0,  auraColor: null,                     particles: 0, auraR: 0 },
  { minLv: 3,  auraColor: 'rgba(212,168,67,0.15)',  particles: 3, auraR: 8 },
  { minLv: 5,  auraColor: 'rgba(160,200,255,0.2)',  particles: 5, auraR: 12 },
  { minLv: 10, auraColor: 'rgba(180,120,255,0.25)', particles: 7, auraR: 16 },
  { minLv: 20, auraColor: 'rgba(255,200,80,0.3)',   particles: 10, auraR: 22 },
  { minLv: 30, auraColor: 'rgba(255,80,80,0.2)',    particles: 12, auraR: 26 },
]

function _getRealmFx(level) {
  let fx = REALM_FX[0]
  for (const f of REALM_FX) {
    if (level >= f.minLv) fx = f
  }
  return fx
}

// ===== 工具：圆角矩形 =====
function roundRect(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

// ===== 工具：矩形碰撞检测 =====
function hitRect(x, y, rect) {
  return x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]
}

// ===== 背景 =====
function drawBackground(c, R, W, H, S, animFrame) {
  c.fillStyle = '#f5ead0'
  c.fillRect(0, 0, W, H)
  const bgImg = R.getImg('assets/backgrounds/cultivation_bg.jpg')
  if (bgImg && bgImg.width > 0) {
    R._drawCoverImg(bgImg, 0, 0, W, H)
  } else {
    const bg = c.createLinearGradient(0, 0, 0, H)
    bg.addColorStop(0, '#f5ead0')
    bg.addColorStop(0.5, '#efe0c8')
    bg.addColorStop(1, '#e8d5b8')
    c.fillStyle = bg
    c.fillRect(0, 0, W, H)
  }
  c.save()
  for (let i = 0; i < 8; i++) {
    const t = animFrame * 0.01 + i * 2.1
    const px = W * (0.1 + 0.8 * ((Math.sin(t * 0.7 + i) + 1) / 2))
    const py = H * (0.2 + 0.6 * ((Math.cos(t * 0.5 + i * 2.3) + 1) / 2))
    const alpha = 0.25 + 0.2 * Math.sin(t * 2)
    c.globalAlpha = alpha
    c.fillStyle = i % 3 === 0 ? '#d4a843' : i % 3 === 1 ? '#c8a0d0' : '#80c8b8'
    c.beginPath()
    c.arc(px, py, (1.2 + Math.sin(t) * 0.6) * S, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

// ===== 灵气连线 =====
function drawEnergyLines(c, cx, cy, avatarR, nodePositions, orbitR, nodeR, S, cult, animFrame) {
  c.save()
  for (const key of CULT_KEYS) {
    const pos = nodePositions[key]
    const lv = cult.levels[key]
    const maxLv = CULT_CONFIG[key].maxLv
    const style = NODE_STYLES[key]
    const pct = lv / maxLv

    const grad = c.createLinearGradient(cx, cy, pos.x, pos.y)
    grad.addColorStop(0, 'rgba(212,168,67,0.3)')
    grad.addColorStop(0.5, lv > 0 ? style.glow.replace('0.5', '0.5') : 'rgba(200,180,140,0.25)')
    grad.addColorStop(1, lv > 0 ? style.glow.replace('0.5', '0.4') : 'rgba(200,180,140,0.2)')

    c.strokeStyle = grad
    c.lineWidth = (1.5 + pct * 2) * S

    const dx = pos.x - cx, dy = pos.y - cy
    const dist = Math.sqrt(dx*dx + dy*dy)
    const nx = dx / dist, ny = dy / dist
    const startX = cx + nx * (avatarR + 4*S)
    const startY = cy + ny * (avatarR + 4*S)
    const endX = pos.x - nx * (nodeR + 2*S)
    const endY = pos.y - ny * (nodeR + 2*S)

    c.save()
    c.shadowColor = lv > 0 ? style.color : 'rgba(212,168,67,0.5)'
    c.shadowBlur = 6*S
    c.beginPath()
    c.moveTo(startX, startY)
    c.lineTo(endX, endY)
    c.stroke()
    c.restore()

    c.beginPath()
    c.moveTo(startX, startY)
    c.lineTo(endX, endY)
    c.stroke()

    const keyIdx = CULT_KEYS.indexOf(key)
    const flowT = (animFrame * 0.02 + keyIdx * 0.5) % 1
    const fx = startX + (endX - startX) * flowT
    const fy = startY + (endY - startY) * flowT
    const pAlpha = lv > 0 ? 0.8 : 0.35
    c.globalAlpha = pAlpha * (1 - Math.abs(flowT - 0.5) * 2)
    c.fillStyle = lv > 0 ? style.color : '#D4A843'
    c.beginPath()
    c.arc(fx, fy, (lv > 0 ? 3 : 2) * S, 0, Math.PI * 2)
    c.fill()
    const flowT2 = (animFrame * 0.02 + keyIdx * 0.5 + 0.5) % 1
    const fx2 = startX + (endX - startX) * flowT2
    const fy2 = startY + (endY - startY) * flowT2
    c.globalAlpha = pAlpha * 0.6 * (1 - Math.abs(flowT2 - 0.5) * 2)
    c.beginPath()
    c.arc(fx2, fy2, (lv > 0 ? 2 : 1.5) * S, 0, Math.PI * 2)
    c.fill()
    c.globalAlpha = 1
  }
  c.restore()
}

// ===== 法阵特效 =====
function drawFormation(c, cx, cy, radius, S, cult, animFrame) {
  const totalLv = Object.values(cult.levels).reduce((a, b) => a + b, 0)
  const baseAlpha = Math.min(0.35 + totalLv * 0.012, 0.75)
  const r = radius * 0.75
  const t = animFrame

  c.save()
  c.translate(cx, cy)

  // 外圈：缓慢顺时针旋转
  c.save()
  c.rotate(t * 0.003)
  c.globalAlpha = baseAlpha * 0.7
  c.strokeStyle = '#FFD060'
  c.shadowColor = '#FFD060'
  c.shadowBlur = 8*S
  c.lineWidth = 1.5*S
  c.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3
    const x = Math.cos(a) * r, y = Math.sin(a) * r
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
  }
  c.closePath()
  c.stroke()
  c.lineWidth = 1*S
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6
    c.beginPath()
    c.arc(0, 0, r * 0.92, a - 0.2, a + 0.2)
    c.stroke()
  }
  c.lineWidth = 0.8*S
  c.globalAlpha = baseAlpha * 0.4
  c.beginPath()
  c.arc(0, 0, r, 0, Math.PI * 2)
  c.stroke()
  c.restore()

  // 中圈：逆时针旋转
  c.save()
  c.rotate(-t * 0.005)
  c.globalAlpha = baseAlpha * 0.8
  c.strokeStyle = '#FFAA30'
  c.shadowColor = '#FFAA30'
  c.shadowBlur = 10*S
  c.lineWidth = 1.2*S
  c.beginPath()
  const r2 = r * 0.62
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5) * 2
    const x = Math.cos(a) * r2, y = Math.sin(a) * r2
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
  }
  c.closePath()
  c.stroke()
  c.lineWidth = 0.8*S
  c.globalAlpha = baseAlpha * 0.6
  c.beginPath()
  const r3 = r * 0.38
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5)
    const x = Math.cos(a) * r3, y = Math.sin(a) * r3
    i === 0 ? c.moveTo(x, y) : c.lineTo(x, y)
  }
  c.closePath()
  c.stroke()
  c.restore()

  // 内圈：缓慢顺时针
  c.save()
  c.rotate(t * 0.008)
  c.globalAlpha = baseAlpha * 0.9
  c.strokeStyle = '#FFD060'
  c.shadowColor = '#FFD060'
  c.shadowBlur = 6*S
  c.lineWidth = 0.8*S
  const r4 = r * 0.25
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4
    c.beginPath()
    c.arc(0, 0, r4, a, a + 0.35)
    c.stroke()
    const dotR = r4 * 1.15
    c.fillStyle = '#FFD060'
    c.beginPath()
    c.arc(Math.cos(a + 0.17) * dotR, Math.sin(a + 0.17) * dotR, 2*S, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()

  // 祥云纹角装饰
  c.save()
  c.globalAlpha = baseAlpha * 0.5
  c.strokeStyle = '#FFD060'
  c.shadowColor = '#FFD060'
  c.shadowBlur = 5*S
  c.lineWidth = 0.8*S
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2 + t * 0.002
    const dx = Math.cos(a) * r * 0.78
    const dy = Math.sin(a) * r * 0.78
    c.beginPath()
    for (let j = 0; j < 14; j++) {
      const jt = j / 14
      const sr = 3*S + jt * 7*S
      const sa = jt * Math.PI * 2.5
      const sx = dx + Math.cos(sa) * sr
      const sy = dy + Math.sin(sa) * sr
      j === 0 ? c.moveTo(sx, sy) : c.lineTo(sx, sy)
    }
    c.stroke()
  }
  c.restore()

  // 脉冲光环
  const pulse = 0.3 + 0.7 * Math.abs(Math.sin(t * 0.015))
  c.save()
  c.globalAlpha = baseAlpha * 0.5 * pulse
  c.strokeStyle = '#FFE080'
  c.shadowColor = '#FFD060'
  c.shadowBlur = 12*S
  c.lineWidth = 2.5*S
  c.beginPath()
  c.arc(0, 0, r * (0.48 + pulse * 0.12), 0, Math.PI * 2)
  c.stroke()
  c.restore()

  // 属性色光点
  const attrColors = ['#E85050', '#50C878', '#5098E8', '#C89648', '#A070D0']
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5) + t * 0.004
    const glowR = r * 0.55
    c.save()
    c.globalAlpha = baseAlpha * 0.6
    c.fillStyle = attrColors[i]
    c.shadowColor = attrColors[i]
    c.shadowBlur = 8*S
    c.beginPath()
    c.arc(Math.cos(a) * glowR, Math.sin(a) * glowR, 3*S, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  c.restore()
}

// ===== 属性节点 =====
function drawNode(c, x, y, r, key, lv, cfg, isMax, canUpgrade, isSelected, S, animFrame) {
  const style = NODE_STYLES[key]
  const pct = lv / cfg.maxLv

  c.save()

  c.fillStyle = 'rgba(255,255,255,0.7)'
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()

  // 环形进度条
  const progressR = r - 3*S
  const lineW = 3.5*S
  c.strokeStyle = 'rgba(0,0,0,0.08)'
  c.lineWidth = lineW
  c.beginPath()
  c.arc(x, y, progressR, 0, Math.PI * 2)
  c.stroke()
  if (pct > 0) {
    const startAngle = -Math.PI / 2
    const endAngle = startAngle + Math.PI * 2 * pct
    c.strokeStyle = style.color
    c.lineWidth = lineW
    c.lineCap = 'round'
    c.beginPath()
    c.arc(x, y, progressR, startAngle, endAngle)
    c.stroke()
    c.lineCap = 'butt'
  }

  // 边框
  if (isMax) {
    c.save()
    c.shadowColor = '#FFD700'
    c.shadowBlur = 8*S
    c.strokeStyle = '#FFD700'
    c.lineWidth = 2*S
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.stroke()
    c.shadowBlur = 0
    c.restore()
  } else if (canUpgrade) {
    const pulse = 0.5 + 0.5 * Math.sin(animFrame * 0.08)
    c.strokeStyle = `rgba(212,168,67,${0.4 + pulse * 0.5})`
    c.lineWidth = (1.5 + pulse) * S
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.stroke()
  } else {
    c.strokeStyle = 'rgba(120,100,70,0.3)'
    c.lineWidth = 1*S
    c.beginPath()
    c.arc(x, y, r, 0, Math.PI * 2)
    c.stroke()
  }

  // 选中高亮
  if (isSelected) {
    c.save()
    c.strokeStyle = style.color
    c.lineWidth = 2.5*S
    c.shadowColor = style.color
    c.shadowBlur = 10*S
    c.beginPath()
    c.arc(x, y, r + 3*S, 0, Math.PI * 2)
    c.stroke()
    c.shadowBlur = 0
    c.restore()
  }

  // 图标
  c.fillStyle = style.color
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(style.icon, x, y - 4*S)

  // 等级
  c.fillStyle = '#7A5C30'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText(`${lv}/${cfg.maxLv}`, x, y + 12*S)

  c.restore()
}

// ===== 中央打坐角色 =====
function drawAvatar(g, c, R, cx, cy, r, S, level, H, character, animFrame) {
  const fx = _getRealmFx(level)
  const sitH = r * 5.0
  const sitW = sitH
  const platformTopY = H * 0.76

  c.save()

  const charCenterY = platformTopY - sitH * 0.42

  // 境界光环
  if (fx.auraColor) {
    const auraR = r + fx.auraR * S
    const pulse = 0.7 + 0.3 * Math.sin(animFrame * 0.025)
    c.save()
    c.globalAlpha = pulse
    const auraGrad = c.createRadialGradient(cx, charCenterY, r * 0.3, cx, charCenterY, auraR)
    auraGrad.addColorStop(0, fx.auraColor)
    auraGrad.addColorStop(0.6, fx.auraColor.replace(/[\d.]+\)$/, '0.08)'))
    auraGrad.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = auraGrad
    c.beginPath()
    c.arc(cx, charCenterY, auraR, 0, Math.PI * 2)
    c.fill()
    c.restore()
  }

  // 灵气环绕粒子
  if (fx.particles > 0) {
    c.save()
    for (let i = 0; i < fx.particles; i++) {
      const angle = animFrame * 0.015 + i * (Math.PI * 2 / fx.particles)
      const orbitR = r * 1.2 + Math.sin(animFrame * 0.03 + i * 2) * 6*S
      const px = cx + Math.cos(angle) * orbitR
      const py = charCenterY + Math.sin(angle) * orbitR * 0.6
      const alpha = 0.3 + 0.3 * Math.sin(animFrame * 0.05 + i)
      c.globalAlpha = alpha
      const colors = ['#d4a843', '#80c8b8', '#c8a0d0', '#f0c860']
      c.fillStyle = colors[i % colors.length]
      c.beginPath()
      c.arc(px, py, (1.5 + Math.sin(animFrame * 0.04 + i) * 0.5) * S, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }

  // 打坐小人图片
  const sitImg = R.getImg(character.sit)
  if (sitImg && sitImg.width > 0) {
    const iw = sitImg.width, ih = sitImg.height
    const scale = Math.min(sitW / iw, sitH / ih)
    const dw = iw * scale, dh = ih * scale
    const floatY = Math.sin(animFrame * 0.02) * 2 * S
    const drawY = platformTopY - dh + floatY
    c.drawImage(sitImg, cx - dw/2, drawY, dw, dh)
  } else {
    // fallback：用头像圆形显示
    const avatarImg = R.getImg(character.avatar)
    c.save()
    c.beginPath()
    c.arc(cx, charCenterY, r * 0.7, 0, Math.PI * 2)
    c.clip()
    if (avatarImg && avatarImg.width > 0) {
      const size = r * 1.4
      const iw = avatarImg.width, ih = avatarImg.height
      const sc = Math.max(size / iw, size / ih)
      c.drawImage(avatarImg, cx - iw*sc/2, charCenterY - ih*sc/2, iw*sc, ih*sc)
    } else {
      c.fillStyle = '#f0e0c0'
      c.beginPath()
      c.arc(cx, charCenterY, r * 0.7, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#8B6914'
      c.font = `bold ${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('修', cx, charCenterY)
    }
    c.restore()
    c.strokeStyle = '#D4A843'
    c.lineWidth = 2*S
    c.beginPath()
    c.arc(cx, charCenterY, r * 0.7, 0, Math.PI * 2)
    c.stroke()
  }

  // "更换形象"提示
  c.fillStyle = 'rgba(0,0,0,0.35)'
  const tagW = 42*S, tagH = 14*S
  const tagY = platformTopY + 2*S
  roundRect(c, cx - tagW/2, tagY, tagW, tagH, tagH/2)
  c.fill()
  c.fillStyle = '#fff'
  c.font = `${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('更换形象', cx, tagY + tagH/2)

  c.restore()
}

// ===== 形象选择面板 =====
function drawAvatarPanel(g, c, R, W, H, S, characters, rects) {
  c.save()
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.fillRect(0, 0, W, H)
  c.restore()

  const panelW = W * 0.88
  const cols = 3
  const cellH = 100*S
  const cellPad = 8*S
  const rows = Math.ceil(characters.length / cols)
  const panelH = 52*S + rows * (cellH + cellPad) + 16*S
  const panelX = (W - panelW) / 2
  const panelY = (H - panelH) / 2
  const panelRad = 14*S
  const pad = 12*S

  c.save()
  const bgGrad = c.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  bgGrad.addColorStop(0, 'rgba(248,242,230,0.97)')
  bgGrad.addColorStop(1, 'rgba(238,230,218,0.97)')
  c.fillStyle = bgGrad
  roundRect(c, panelX, panelY, panelW, panelH, panelRad)
  c.fill()
  c.strokeStyle = 'rgba(212,168,67,0.5)'
  c.lineWidth = 1.5*S
  roundRect(c, panelX, panelY, panelW, panelH, panelRad)
  c.stroke()
  c.restore()

  c.save()
  c.fillStyle = '#7A5C30'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('选择形象', W * 0.5, panelY + 28*S)
  c.restore()

  const gridTop = panelY + 52*S
  const cellW = (panelW - pad * 2 - cellPad * (cols - 1)) / cols
  const selectedId = g.storage.selectedAvatar
  rects.avatarRects = []

  for (let i = 0; i < characters.length; i++) {
    const ch = characters[i]
    const col = i % cols
    const row = Math.floor(i / cols)
    const cardX = panelX + pad + col * (cellW + cellPad)
    const cardY = gridTop + row * (cellH + cellPad)
    const cardCx = cardX + cellW / 2
    const isSelected = ch.id === selectedId

    c.save()
    if (isSelected) {
      c.fillStyle = 'rgba(212,168,67,0.15)'
      c.strokeStyle = '#D4A843'
      c.lineWidth = 2*S
    } else {
      c.fillStyle = 'rgba(0,0,0,0.03)'
      c.strokeStyle = 'rgba(160,140,100,0.2)'
      c.lineWidth = 1*S
    }
    roundRect(c, cardX, cardY, cellW, cellH, 8*S)
    c.fill()
    roundRect(c, cardX, cardY, cellW, cellH, 8*S)
    c.stroke()
    c.restore()

    const previewH = cellH - 26*S
    const previewW = cellW - 8*S
    const sitImg = R.getImg(ch.sit)
    if (sitImg && sitImg.width > 0) {
      const iw = sitImg.width, ih = sitImg.height
      const sc = Math.min(previewW / iw, previewH / ih) * 0.9
      const dw = iw * sc, dh = ih * sc
      c.save()
      if (!ch.unlocked) c.globalAlpha = 0.35
      c.drawImage(sitImg, cardCx - dw/2, cardY + 4*S + (previewH - dh)/2, dw, dh)
      c.restore()
    } else {
      const thumbR = 18*S
      const thumbCy = cardY + 4*S + previewH/2
      c.save()
      c.beginPath()
      c.arc(cardCx, thumbCy, thumbR, 0, Math.PI * 2)
      c.clip()
      const avImg = R.getImg(ch.avatar)
      if (avImg && avImg.width > 0) {
        const size = thumbR * 2
        const sc = Math.max(size / avImg.width, size / avImg.height)
        c.drawImage(avImg, cardCx - avImg.width*sc/2, thumbCy - avImg.height*sc/2, avImg.width*sc, avImg.height*sc)
      } else {
        c.fillStyle = '#f0e0c0'
        c.fill()
      }
      if (!ch.unlocked) {
        c.fillStyle = 'rgba(0,0,0,0.5)'
        c.fill()
      }
      c.restore()
      c.strokeStyle = 'rgba(160,140,100,0.3)'
      c.lineWidth = 1*S
      c.beginPath()
      c.arc(cardCx, thumbCy, thumbR, 0, Math.PI * 2)
      c.stroke()
    }

    if (!ch.unlocked) {
      c.save()
      c.fillStyle = '#aaa'
      c.font = `${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('🔒', cardCx, cardY + previewH * 0.5)
      c.restore()
    }

    if (isSelected) {
      c.save()
      c.fillStyle = '#D4A843'
      c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('✓ 使用中', cardCx, cardY + cellH - 14*S)
      c.restore()
    } else {
      c.save()
      c.fillStyle = ch.unlocked ? '#7A5C30' : '#aaa'
      c.font = `${9*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(ch.label, cardCx, cardY + cellH - 14*S)
      c.restore()
    }

    rects.avatarRects.push({ id: ch.id, rect: [cardX, cardY, cellW, cellH], unlocked: ch.unlocked })
  }

  rects.avatarPanelRect = [panelX, panelY, panelW, panelH]
}

// ===== 详情面板（暖色风格） =====
function drawDetailPanel(c, W, H, S, key, cult, pts, rects, animFrame) {
  const cfg = CULT_CONFIG[key]
  const lv = cult.levels[key]
  const style = NODE_STYLES[key]
  const isMax = lv >= cfg.maxLv
  const canUpgrade = !isMax && pts > 0

  c.save()
  c.fillStyle = 'rgba(0,0,0,0.4)'
  c.fillRect(0, 0, W, H)
  c.restore()

  const panelW = W * 0.82
  const panelH = 190*S
  const panelX = (W - panelW) / 2
  const panelY = H * 0.5 - panelH * 0.4
  const panelR = 14*S
  const pad = 16*S

  // 暖色面板背景
  c.save()
  const bgGrad = c.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  bgGrad.addColorStop(0, 'rgba(248,240,225,0.97)')
  bgGrad.addColorStop(1, 'rgba(238,228,210,0.97)')
  c.fillStyle = bgGrad
  roundRect(c, panelX, panelY, panelW, panelH, panelR)
  c.fill()

  c.strokeStyle = style.color
  c.lineWidth = 1.5*S
  c.globalAlpha = 0.6
  roundRect(c, panelX, panelY, panelW, panelH, panelR)
  c.stroke()
  c.globalAlpha = 1

  const lineGrad = c.createLinearGradient(panelX + pad, panelY, panelX + panelW - pad, panelY)
  lineGrad.addColorStop(0, 'transparent')
  lineGrad.addColorStop(0.5, style.color)
  lineGrad.addColorStop(1, 'transparent')
  c.strokeStyle = lineGrad
  c.lineWidth = 1*S
  c.beginPath()
  c.moveTo(panelX + pad, panelY + 1)
  c.lineTo(panelX + panelW - pad, panelY + 1)
  c.stroke()
  c.restore()

  let curY = panelY + pad

  // 标题行
  c.save()
  c.fillStyle = style.color
  c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText(`${style.icon} ${cfg.name}·${cfg.theme}`, panelX + pad, curY + 10*S)
  c.fillStyle = '#7A5C30'
  c.font = `${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`Lv.${lv} / ${cfg.maxLv}`, panelX + panelW - pad, curY + 10*S)
  c.restore()
  curY += 28*S

  // 分隔线
  c.save()
  c.strokeStyle = 'rgba(180,160,120,0.25)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(panelX + pad, curY)
  c.lineTo(panelX + panelW - pad, curY)
  c.stroke()
  c.restore()
  curY += 10*S

  // 当前效果
  c.save()
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = '#8a7a58'
  c.font = `${12*S}px "PingFang SC",sans-serif`
  c.fillText('当前效果', panelX + pad, curY + 6*S)
  const curEffect = effectValue(key, lv)
  const effectStr = lv > 0
    ? `${cfg.desc} +${key === 'wisdom' ? curEffect.toFixed(2) + 's' : curEffect}`
    : `${cfg.desc}（未激活）`
  c.fillStyle = '#5C3A1E'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText(effectStr, panelX + pad, curY + 24*S)
  c.restore()
  curY += 40*S

  // 下一级预览
  if (!isMax) {
    const nextLv = lv + 1
    const nextEffect = effectValue(key, nextLv)
    const nextStr = key === 'wisdom' ? `+${nextEffect.toFixed(2)}s` : `+${nextEffect}`
    c.save()
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8a7a58'
    c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText(`下一级: ${cfg.desc} ${nextStr}`, panelX + pad, curY + 6*S)
    c.restore()
    curY += 22*S
  } else {
    c.save()
    c.fillStyle = '#aaa'
    c.font = `${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText('已达最高等级', panelX + pad, curY + 6*S)
    c.restore()
    curY += 22*S
  }

  // 升级按钮
  const btnW = panelW - pad * 2
  const btnH = 36*S
  const btnX = panelX + pad
  const btnY = panelY + panelH - pad - btnH

  c.save()
  if (canUpgrade) {
    const btnG = c.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
    btnG.addColorStop(0, '#D4A843')
    btnG.addColorStop(1, '#A07830')
    c.fillStyle = btnG
    c.shadowColor = 'rgba(212,168,67,0.4)'
    c.shadowBlur = 6*S
  } else if (isMax) {
    c.fillStyle = 'rgba(180,170,150,0.4)'
  } else {
    c.fillStyle = 'rgba(180,170,150,0.3)'
  }
  roundRect(c, btnX, btnY, btnW, btnH, 8*S)
  c.fill()
  c.shadowBlur = 0

  c.fillStyle = canUpgrade ? '#fff' : '#999'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  if (isMax) {
    c.fillText('已满级', btnX + btnW/2, btnY + btnH/2)
  } else if (canUpgrade) {
    c.fillText(`修炼（消耗 1 修炼点）`, btnX + btnW/2, btnY + btnH/2)
  } else {
    c.fillText('修炼点不足', btnX + btnW/2, btnY + btnH/2)
  }
  c.restore()

  rects.detailBtnRect = canUpgrade ? [btnX, btnY, btnW, btnH] : null
  rects.detailPanelRect = [panelX, panelY, panelW, panelH]
}

// ===== 境界突破动画 =====
function drawRealmBreak(c, W, H, S, realmBreakAnim) {
  const anim = realmBreakAnim
  const p = anim.timer / anim.duration
  const alpha = p < 0.3 ? p / 0.3 * 0.6 : (1 - p) * 0.6
  c.save()
  c.fillStyle = `rgba(212,168,67,${Math.max(0, alpha).toFixed(2)})`
  c.fillRect(0, 0, W, H)
  if (p > 0.15 && p < 0.85) {
    const textAlpha = p < 0.3 ? (p - 0.15) / 0.15 : p > 0.7 ? (0.85 - p) / 0.15 : 1
    c.globalAlpha = Math.max(0, textAlpha)
    c.fillStyle = '#FFD700'
    c.font = `bold ${36*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.shadowColor = 'rgba(255,215,0,0.8)'; c.shadowBlur = 20*S
    c.fillText(`「${anim.name}」`, W * 0.5, H * 0.4)
    c.shadowBlur = 0
    c.fillStyle = '#E8D5A3'
    c.font = `${16*S}px "PingFang SC",sans-serif`
    c.fillText('境界突破！', W * 0.5, H * 0.4 + 40*S)
  }
  c.restore()
}

module.exports = {
  NODE_STYLES, REALM_FX,
  roundRect, hitRect,
  drawBackground, drawEnergyLines, drawFormation,
  drawNode, drawAvatar, drawAvatarPanel, drawDetailPanel,
  drawRealmBreak,
}
