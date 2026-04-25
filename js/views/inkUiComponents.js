/**
 * 水墨修仙 UI 公共组件
 *
 * 统一图鉴、灵宠池、详情页中可复用的宣纸、玉牌、筛选、红点等绘制语言。
 */
const { INK } = require('../data/ui/inkUiConfig')

function _rr(R, c, x, y, w, h, r) {
  if (R && R.rr) return R.rr(x, y, w, h, r)
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

function drawInkPageBg(c, R, W, H, opts) {
  const o = opts || {}
  const img = o.bgPath && R.getImg(o.bgPath)
  if (img && img.width > 0 && R._drawCoverImg) R._drawCoverImg(img, 0, 0, W, H)
  else if (R.drawHomeBg) R.drawHomeBg(o.af || 0)
  c.save()
  c.fillStyle = o.wash || 'rgba(255,248,232,0.06)'
  c.fillRect(0, 0, W, H)
  c.restore()
}

function drawRedDot(c, S, x, y, opts) {
  const o = opts || {}
  const r = o.r || 4 * S
  c.save()
  c.fillStyle = o.fill || '#e04040'
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = o.stroke || 'rgba(255,244,226,0.95)'
  c.lineWidth = o.lineWidth || 1 * S
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.stroke()
  c.restore()
}

function drawJadeResourcePlaque(c, R, S, x, cy, iconPath, text, dim) {
  const icon = R.getImg(iconPath)
  const iconSz = 28 * S
  c.save()
  if (dim) c.globalAlpha = 0.55
  c.font = `bold ${13 * S}px "PingFang SC",serif`
  const txtW = c.measureText(`${text}`).width
  const w = iconSz + txtW + 18 * S
  const h = 27 * S
  const y = cy - h / 2
  const grad = c.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, 'rgba(34,75,64,0.82)')
  grad.addColorStop(0.55, 'rgba(71,118,92,0.76)')
  grad.addColorStop(1, 'rgba(37,70,58,0.82)')
  c.fillStyle = grad
  _rr(R, c, x, y, w, h, 10 * S); c.fill()
  c.strokeStyle = 'rgba(231,199,116,0.68)'
  c.lineWidth = 1.2 * S
  _rr(R, c, x, y, w, h, 10 * S); c.stroke()
  if (icon && icon.width > 0) c.drawImage(icon, x - 3 * S, cy - iconSz / 2, iconSz, iconSz)
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${13 * S}px "PingFang SC",serif`
  c.strokeStyle = 'rgba(18,28,22,0.78)'
  c.lineWidth = 2 * S
  c.strokeText(`${text}`, x + iconSz + txtW / 2 + 6 * S, cy + 0.5 * S)
  c.fillStyle = '#fff1cc'
  c.fillText(`${text}`, x + iconSz + txtW / 2 + 6 * S, cy + 0.5 * S)
  c.restore()
  return w
}

function drawScrollPanel(c, R, S, x, y, w, h, opts) {
  const o = opts || {}
  const rad = o.radius || 14 * S
  c.save()
  const grad = c.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, o.top || INK.colors.paper)
  grad.addColorStop(1, o.bottom || INK.colors.paperDeep)
  c.fillStyle = grad
  _rr(R, c, x, y, w, h, rad); c.fill()
  c.strokeStyle = o.border || 'rgba(176,132,54,0.62)'
  c.lineWidth = o.lineWidth || 1.5 * S
  _rr(R, c, x, y, w, h, rad); c.stroke()
  c.strokeStyle = 'rgba(255,245,210,0.42)'
  c.lineWidth = 1 * S
  _rr(R, c, x + 3 * S, y + 3 * S, w - 6 * S, h - 6 * S, Math.max(2 * S, rad - 3 * S)); c.stroke()
  c.restore()
  const insetX = o.insetX || 14 * S
  const insetY = o.insetY || 12 * S
  return {
    panelDrawRect: [x, y, w, h],
    panelClipRect: [x + 4 * S, y + 4 * S, w - 8 * S, h - 8 * S],
    contentRect: [x + insetX, y + insetY, w - insetX * 2, h - insetY * 2],
  }
}

function drawInkFilterTabs(c, R, S, items, activeKey, x, y, w, h, opts) {
  const o = opts || {}
  const gap = o.gap == null ? 4 * S : o.gap
  const itemW = (w - gap * (items.length - 1)) / items.length
  const rects = []
  c.save()
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const tx = x + i * (itemW + gap)
    const active = activeKey === item.key
    c.fillStyle = active ? (o.activeBg || 'rgba(71,128,100,0.68)') : (o.bg || 'rgba(236,219,178,0.26)')
    _rr(R, c, tx, y, itemW, h, o.radius || 6 * S); c.fill()
    if (active) {
      c.strokeStyle = o.activeBorder || 'rgba(231,205,128,0.9)'
      c.lineWidth = 1.4 * S
      _rr(R, c, tx, y, itemW, h, o.radius || 6 * S); c.stroke()
    }
    c.fillStyle = active ? '#fff5d0' : 'rgba(70,42,22,0.88)'
    c.font = `bold ${(o.fontSize || 9.5) * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(item.label, tx + itemW / 2, y + h / 2 + 0.5 * S)
    if (item.dot) drawRedDot(c, S, tx + itemW - 5 * S, y + 5 * S, { r: 3.2 * S })
    rects.push({ key: item.key, x: tx, y, w: itemW, h })
  }
  c.restore()
  return rects
}

function drawRolePill(c, R, S, x, y, text, opts) {
  const o = opts || {}
  c.save()
  c.font = `bold ${(o.fontSize || 8.5) * S}px "PingFang SC",sans-serif`
  const padX = 6 * S
  const tw = c.measureText(text).width
  const w = o.w || (tw + padX * 2)
  const h = o.h || 15 * S
  const grad = c.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, 'rgba(40,88,70,0.78)')
  grad.addColorStop(0.62, 'rgba(86,134,98,0.72)')
  grad.addColorStop(1, 'rgba(112,48,34,0.72)')
  c.fillStyle = grad
  _rr(R, c, x, y, w, h, h / 2); c.fill()
  c.strokeStyle = 'rgba(246,218,142,0.72)'
  c.lineWidth = 0.9 * S
  _rr(R, c, x, y, w, h, h / 2); c.stroke()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#fff2cf'
  c.fillText(text, x + w / 2, y + h / 2 + 0.5 * S)
  c.restore()
  return [x, y, w, h]
}

function drawDexCardFrame(c, R, S, x, y, w, h, tier) {
  const t = INK.tier[tier] || INK.tier.unknown
  c.save()
  const frame = R && R.getImg && R.getImg('assets/ui/dex_card_frame.png')
  if (frame && frame.width > 0) {
    if (tier === 'unknown') c.globalAlpha = 0.72
    c.drawImage(frame, x, y, w, h)
    c.globalAlpha = 1
    if (tier === 'mastered') {
      c.strokeStyle = 'rgba(219,176,48,0.78)'
      c.lineWidth = 2 * S
      _rr(R, c, x + 2 * S, y + 2 * S, w - 4 * S, h - 4 * S, 7 * S); c.stroke()
    }
  } else {
    c.fillStyle = t.bg
    _rr(R, c, x, y, w, h, 8 * S); c.fill()
    c.strokeStyle = t.border
    c.lineWidth = tier === 'mastered' ? 2 * S : 1.2 * S
    _rr(R, c, x, y, w, h, 8 * S); c.stroke()
    c.strokeStyle = 'rgba(255,245,210,0.38)'
    c.lineWidth = 0.8 * S
    _rr(R, c, x + 3 * S, y + 3 * S, w - 6 * S, h - 6 * S, 6 * S); c.stroke()
  }
  c.restore()
}

function drawUnknownInkSlot(c, R, S, x, y, w, h) {
  const unknown = R && R.getImg && R.getImg('assets/ui/dex_unknown_slot.png')
  if (unknown && unknown.width > 0) {
    c.save()
    c.drawImage(unknown, x, y, w, h)
    c.restore()
    return
  }
  drawDexCardFrame(c, R, S, x, y, w, h, 'unknown')
  c.save()
  const cx = x + w / 2
  const cy = y + h * 0.38
  const r = w * 0.24
  c.fillStyle = 'rgba(40,34,26,0.20)'
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill()
  c.strokeStyle = 'rgba(80,68,48,0.32)'
  c.lineWidth = 2 * S
  c.beginPath(); c.arc(cx, cy, r * 0.82, 0, Math.PI * 2); c.stroke()
  c.fillStyle = 'rgba(255,250,232,0.55)'
  c.font = `bold ${26 * S}px "PingFang SC",serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('?', cx, cy + 1 * S)
  c.fillStyle = INK.tier.unknown.name
  c.font = `bold ${10 * S}px "PingFang SC",serif`
  c.fillText('???', cx, y + h - 14 * S)
  c.restore()
}

function drawInkActionButton(c, R, S, x, y, w, h, text, opts) {
  const o = opts || {}
  c.save()
  const enabled = o.enabled !== false
  const grad = c.createLinearGradient(x, y, x, y + h)
  if (enabled) {
    grad.addColorStop(0, o.top || '#dfbd68')
    grad.addColorStop(1, o.bottom || '#a86a28')
  } else {
    grad.addColorStop(0, 'rgba(190,184,168,0.75)')
    grad.addColorStop(1, 'rgba(122,114,102,0.72)')
  }
  c.fillStyle = grad
  _rr(R, c, x, y, w, h, o.radius || 8 * S); c.fill()
  c.strokeStyle = enabled ? 'rgba(255,238,168,0.82)' : 'rgba(255,255,255,0.32)'
  c.lineWidth = 1.3 * S
  _rr(R, c, x, y, w, h, o.radius || 8 * S); c.stroke()
  c.fillStyle = enabled ? '#fff5d2' : 'rgba(255,255,255,0.68)'
  c.font = `bold ${(o.fontSize || 11) * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(75,38,10,0.65)'
  c.lineWidth = 2 * S
  c.strokeText(text, x + w / 2, y + h / 2)
  c.fillText(text, x + w / 2, y + h / 2)
  c.restore()
}

module.exports = {
  drawInkPageBg,
  drawJadeResourcePlaque,
  drawScrollPanel,
  drawInkFilterTabs,
  drawDexCardFrame,
  drawUnknownInkSlot,
  drawRolePill,
  drawRedDot,
  drawInkActionButton,
}
