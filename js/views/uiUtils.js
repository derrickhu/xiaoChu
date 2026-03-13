/**
 * UI 公共工具函数 — 从各 View 中提取的重复代码
 */
const V = require('./env')

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

// ===== 筛选后的宠物池 =====
function getFilteredPool(g) {
  const pool = g.storage.petPool || []
  const filter = g._petPoolFilter || 'all'
  if (filter === 'all') return pool
  return pool.filter(p => p.attr === filter)
}

// ===== 矩形命中检测 =====
function hitRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
}

module.exports = { drawSeparator, wrapText, wrapTextDraw, drawGoldBtn, getFilteredPool, hitRect }
