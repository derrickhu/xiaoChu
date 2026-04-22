/**
 * UI 公共工具函数 — 从各 View 中提取的重复代码
 */
const V = require('./env')
const { getPoolPetAtk } = require('../data/petPoolConfig')

// ===== 渐变分隔线 =====
// color: RGB 字符串如 '201,168,76'; alpha: 中间段不透明度; fadeStart/fadeEnd: 渐变起止比例
function drawSeparator(c, x1, y, x2, color, alpha, fadeStart, fadeEnd, lineWidth) {
  color = color || '201,168,76'
  alpha = alpha != null ? alpha : 0.35
  fadeStart = fadeStart || 0.2
  fadeEnd = fadeEnd != null ? fadeEnd : (1 - fadeStart)
  const grad = c.createLinearGradient(x1, y, x2, y)
  grad.addColorStop(0, `rgba(${color},0)`)
  grad.addColorStop(fadeStart, `rgba(${color},${alpha})`)
  grad.addColorStop(fadeEnd, `rgba(${color},${alpha})`)
  grad.addColorStop(1, `rgba(${color},0)`)
  c.strokeStyle = grad; c.lineWidth = lineWidth || 1
  c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke()
}

// ===== 文本换行（返回行数组，按全角/半角字符宽度估算） =====
function wrapText(text, maxW, fontSize) {
  if (!text) return ['']
  const S = V.S
  const fullW = fontSize * S
  const halfW = fontSize * S * 0.55
  const result = []
  let line = '', lineW = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const cw = ch.charCodeAt(0) > 127 ? fullW : halfW
    if (lineW + cw > maxW && line.length > 0) {
      result.push(line)
      line = ch; lineW = cw
    } else {
      line += ch; lineW += cw
    }
  }
  if (line) result.push(line)
  return result.length > 0 ? result : ['']
}

// ===== 文本换行并直接绘制（返回实际行数） =====
function wrapTextDraw(c, text, x, y, maxW, lineH) {
  let line = ''
  let lines = 1
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (c.measureText(line + ch).width > maxW) {
      c.fillText(line, x, y)
      y += lineH
      line = ch
      lines++
    } else {
      line += ch
    }
  }
  if (line) c.fillText(line, x, y)
  return lines
}

// ===== 金色圆角按钮 =====
function drawGoldBtn(c, R, S, x, y, w, h, text, disabled, fontSize) {
  const r = h / 2
  const fs = fontSize || 14
  if (disabled) {
    c.fillStyle = 'rgba(80,70,50,0.6)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = '#666'; c.lineWidth = 1.5 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#888'
    c.font = `bold ${fs*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(text, x + w / 2, y + h / 2)
    return
  }
  c.save()
  c.shadowColor = 'rgba(180,120,30,0.4)'; c.shadowBlur = 10 * S; c.shadowOffsetY = 3 * S
  const bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#B8451A'); bg.addColorStop(0.5, '#9C3512'); bg.addColorStop(1, '#7A2A0E')
  c.fillStyle = bg
  R.rr(x, y, w, h, r); c.fill()
  c.restore()
  c.strokeStyle = '#D4A843'; c.lineWidth = 2 * S
  R.rr(x, y, w, h, r); c.stroke()
  c.save(); c.globalAlpha = 0.2
  const hl = c.createLinearGradient(x, y, x, y + h * 0.4)
  hl.addColorStop(0, '#fff'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hl
  R.rr(x + 2*S, y + 2*S, w - 4*S, h * 0.4, r); c.fill()
  c.restore()
  c.fillStyle = '#FFE8B8'
  c.font = `bold ${fs*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 4 * S
  c.fillText(text, x + w / 2, y + h / 2)
  c.shadowBlur = 0
}

// ===== 心形图标（中心点 cx,cy；size = 外接圆直径，心形对称、纵向比例接近圆内接） =====
function drawHeartIcon(c, cx, cy, size, opts) {
  opts = opts || {}
  const filled = opts.filled !== false
  const fill = opts.fill != null ? opts.fill : '#ff4d6d'
  const stroke = opts.stroke != null ? opts.stroke : 'rgba(255,255,255,0.92)'
  const lineWidth = opts.lineWidth != null ? opts.lineWidth : 1.5
  const shadow = opts.shadow
  // 对称贝塞尔心形；局部 bbox 约 y∈[-0.50,1.12]，几何中心约 (0, 0.31)
  const HEART_LOCAL_CY = 0.31
  const HEART_LOCAL_R = 1.06
  const scale = (size * 0.5) / HEART_LOCAL_R
  c.save()
  c.translate(cx, cy)
  c.scale(scale, scale)
  c.translate(0, -HEART_LOCAL_CY)
  c.beginPath()
  c.moveTo(0, 0.40)
  c.bezierCurveTo(0, 0.08, -0.40, -0.50, -0.75, -0.28)
  c.bezierCurveTo(-1.02, -0.10, -0.70, 0.55, 0, 1.12)
  c.bezierCurveTo(0.70, 0.55, 1.02, -0.10, 0.75, -0.28)
  c.bezierCurveTo(0.40, -0.50, 0, 0.08, 0, 0.40)
  c.closePath()
  if (shadow && shadow.blur > 0) {
    c.shadowColor = shadow.color || 'rgba(0,0,0,0.35)'
    c.shadowBlur = shadow.blur / scale
    c.shadowOffsetX = (shadow.offsetX || 0) / scale
    c.shadowOffsetY = (shadow.offsetY || 0) / scale
  }
  if (filled) {
    c.fillStyle = fill
    c.fill()
  }
  if (stroke && lineWidth > 0) {
    c.shadowColor = 'transparent'
    c.shadowBlur = 0
    c.shadowOffsetX = 0
    c.shadowOffsetY = 0
    c.strokeStyle = stroke
    c.lineWidth = lineWidth / scale
    c.stroke()
  }
  c.restore()
}

/** 系统彩色心形 emoji「❤️」（与文字 ❤️ 同源：U+2764 + FE0F） */
const HEART_EMOJI_CHAR = '\u2764\uFE0F'

/**
 * 绘制红心 emoji（依赖系统/Canvas 对彩色字形的支持，外观接近输入法的 ❤️）
 * @param {number} fontSize - 字号（画布像素，与调用处 S 一致）
 */
function drawHeartEmoji(c, cx, cy, fontSize, opts) {
  opts = opts || {}
  const alpha = opts.alpha != null ? opts.alpha : 1
  const shadow = opts.shadow
  c.save()
  if (alpha < 1) c.globalAlpha = alpha
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji","Twemoji Mozilla",sans-serif`
  if (shadow && shadow.blur > 0) {
    c.shadowColor = shadow.color || 'rgba(0,0,0,0.35)'
    c.shadowBlur = shadow.blur
    c.shadowOffsetX = shadow.offsetX || 0
    c.shadowOffsetY = shadow.offsetY || 0
  }
  c.fillStyle = opts.color || '#e11d48'
  c.fillText(HEART_EMOJI_CHAR, cx, cy)
  c.restore()
}

// ===== 筛选后的宠物池（收藏的灵宠在同筛选条件下排在前面） =====
function getFilteredPool(g) {
  const pool = g.storage.petPool || []
  const attrFilter = g._petPoolFilter || 'all'
  const rarityFilter = g._petPoolRarityFilter || 'all'
  const origIndex = new Map()
  for (let i = 0; i < pool.length; i++) origIndex.set(pool[i].id, i)
  const poolIds = new Set(pool.map(p => p.id))
  const favList = (g.storage.petPoolFavoriteIds || []).filter(id => poolIds.has(id))
  const favSet = new Set(favList)

  const filtered = pool.filter(p => {
    if (attrFilter !== 'all' && p.attr !== attrFilter) return false
    if (rarityFilter !== 'all') {
      const { getPetRarity } = require('../data/pets')
      if (getPetRarity(p.id) !== rarityFilter) return false
    }
    return true
  })
  // 收藏优先 → 攻击力降序 → 星级降序 → 入池顺序（稳定）
  filtered.sort((a, b) => {
    const af = favSet.has(a.id)
    const bf = favSet.has(b.id)
    if (af !== bf) return af ? -1 : 1

    const atkA = getPoolPetAtk(a)
    const atkB = getPoolPetAtk(b)
    if (atkB !== atkA) return atkB - atkA

    const starA = a.star || 1
    const starB = b.star || 1
    if (starB !== starA) return starB - starA

    return origIndex.get(a.id) - origIndex.get(b.id)
  })
  return filtered
}

// ===== 矩形命中检测 =====
function hitRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
}

module.exports = { drawSeparator, wrapText, wrapTextDraw, drawGoldBtn, drawHeartIcon, drawHeartEmoji, getFilteredPool, hitRect }
