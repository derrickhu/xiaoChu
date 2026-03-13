/**
 * 统一指引 UI 覆盖层
 * 半透明遮罩 + 高亮镂空 + 气泡文字 + 点击继续
 */
const V = require('./env')
const guide = require('../engine/guideManager')

function update() {
  guide.updateFade()
}

function draw(g) {
  if (!guide.isActive()) return
  const info = guide.getCurrent()
  if (!info) return

  const c = V.ctx, W = V.W, H = V.H, S = V.S
  const alpha = guide.getFadeAlpha()

  c.save()
  c.globalAlpha = alpha

  // 半透明黑色遮罩
  c.fillStyle = 'rgba(0,0,0,0.72)'

  if (info.highlight) {
    // 镂空高亮区域
    const hl = info.highlight // { x, y, w, h }
    const pad = 6 * S
    const hx = hl.x - pad, hy = hl.y - pad
    const hw = hl.w + pad * 2, hh = hl.h + pad * 2

    c.beginPath()
    c.rect(0, 0, W, H)
    // 内部镂空（反向路径）
    const hr = 8 * S
    c.moveTo(hx + hr, hy)
    c.lineTo(hx + hw - hr, hy)
    c.quadraticCurveTo(hx + hw, hy, hx + hw, hy + hr)
    c.lineTo(hx + hw, hy + hh - hr)
    c.quadraticCurveTo(hx + hw, hy + hh, hx + hw - hr, hy + hh)
    c.lineTo(hx + hr, hy + hh)
    c.quadraticCurveTo(hx, hy + hh, hx, hy + hh - hr)
    c.lineTo(hx, hy + hr)
    c.quadraticCurveTo(hx, hy, hx + hr, hy)
    c.closePath()
    c.fill('evenodd')

    // 高亮边框
    c.strokeStyle = 'rgba(255,215,0,0.8)'
    c.lineWidth = 2 * S
    V.R.rr(hx, hy, hw, hh, hr)
    c.stroke()
  } else {
    c.fillRect(0, 0, W, H)
  }

  // 气泡文字
  _drawBubble(c, W, H, S, info)

  // "点击继续" / "知道了"
  const isLast = info.stepIdx === info.totalSteps - 1
  const btnText = isLast ? '知道了' : '点击继续'
  const breathAlpha = 0.5 + 0.5 * Math.sin(g.af * 0.08)
  c.globalAlpha = alpha * breathAlpha
  c.fillStyle = '#fff'
  c.font = `${13 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText(btnText, W / 2, H - 60 * S)

  c.restore()
}

function _drawBubble(c, W, H, S, info) {
  const text = info.text
  const fontSize = 16 * S
  c.font = `bold ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`

  const maxWidth = W - 60 * S
  const lines = _wrapText(c, text, maxWidth)
  const lineH = fontSize * 1.5
  const padX = 20 * S, padY = 14 * S
  const bubbleW = Math.min(maxWidth + padX * 2, W - 30 * S)
  const bubbleH = lines.length * lineH + padY * 2

  let bubbleY
  if (info.position === 'top') {
    bubbleY = V.safeTop + 60 * S
  } else if (info.position === 'bottom') {
    bubbleY = H - bubbleH - 100 * S
  } else {
    bubbleY = (H - bubbleH) / 2
  }
  const bubbleX = (W - bubbleW) / 2

  // 气泡背景
  c.fillStyle = 'rgba(30,25,50,0.92)'
  const br = 12 * S
  V.R.rr(bubbleX, bubbleY, bubbleW, bubbleH, br)
  c.fill()

  // 金色边框
  c.strokeStyle = 'rgba(212,160,23,0.6)'
  c.lineWidth = 1.5 * S
  V.R.rr(bubbleX, bubbleY, bubbleW, bubbleH, br)
  c.stroke()

  // 文字
  c.fillStyle = '#fff'
  c.textAlign = 'center'
  for (let i = 0; i < lines.length; i++) {
    c.fillText(lines[i], W / 2, bubbleY + padY + fontSize + i * lineH)
  }
}

function _wrapText(c, text, maxWidth) {
  const words = text.split('')
  const lines = []
  let line = ''
  for (const ch of words) {
    const test = line + ch
    if (c.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function onTouch(g, type, x, y) {
  if (type !== 'start') return false
  if (!guide.isActive()) return false
  guide.advance(g)
  g._dirty = true
  return true
}

module.exports = { update, draw, onTouch }
