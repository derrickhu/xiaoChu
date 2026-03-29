/**
 * 统一指引 UI 覆盖层
 * 半透明遮罩 + 高亮镂空 + 气泡文字 + 点击继续
 */
const V = require('./env')
const guide = require('../engine/guideManager')
const { drawPanel, wrapText } = require('./uiComponents')

function update() {
  guide.updateFade()
}

// 解析高亮区域：优先使用 trigger 传入的 highlight，其次按 highlightId 查全局命名矩形
function _resolveHighlight(g, info) {
  if (info.highlight) return info.highlight
  if (info.highlightId && g._namedRects && g._namedRects[info.highlightId]) {
    return g._namedRects[info.highlightId]
  }
  return null
}

function draw(g) {
  if (!guide.isActive()) return
  const info = guide.getCurrent()
  if (!info) return

  const c = V.ctx, W = V.W, H = V.H, S = V.S
  const alpha = guide.getFadeAlpha()
  const hl = _resolveHighlight(g, info)

  c.save()
  c.globalAlpha = alpha

  // 半透明黑色遮罩（加深保证文字可见）
  c.fillStyle = 'rgba(0,0,0,0.82)'

  if (hl) {
    // 镂空高亮区域
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
  c.fillStyle = 'rgba(255,230,180,0.9)'
  c.font = `${13 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText(btnText, W / 2, H - 80 * S)

  c.restore()
}

function _drawBubble(c, W, H, S, info) {
  const text = info.text
  const fontSize = 15 * S
  c.font = `bold ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`

  const maxWidth = W - 80 * S
  const lines = wrapText(c, text, maxWidth)
  const lineH = fontSize * 1.5
  const padX = 24 * S, padY = 18 * S
  const bubbleW = Math.min(maxWidth + padX * 2, W - 30 * S)
  const bubbleH = padY + lines.length * lineH + padY

  let bubbleY
  if (info.position === 'top') {
    bubbleY = V.safeTop + 60 * S
  } else if (info.position === 'bottom') {
    bubbleY = H - bubbleH - 100 * S
  } else {
    bubbleY = (H - bubbleH) / 2
  }
  const bubbleX = (W - bubbleW) / 2

  drawPanel(c, S, bubbleX, bubbleY, bubbleW, bubbleH, { radius: 14 * S })

  // 文字
  c.fillStyle = '#3a1a00'
  c.textAlign = 'center'
  const textStartY = bubbleY + padY + fontSize * 0.85
  for (let i = 0; i < lines.length; i++) {
    c.fillText(lines[i], W / 2, textStartY + i * lineH)
  }
}

function onTouch(g, type, x, y) {
  if (type !== 'start') return false
  if (!guide.isActive()) return false

  const info = guide.getCurrent()
  const hl = info ? _resolveHighlight(g, info) : null

  // 操作限制模式：只有点击高亮区域才推进，同时放行底层按钮
  if (info && info.restrictToHighlight && hl) {
    const S = V.S
    const pad = 6 * S
    if (x >= hl.x - pad && x <= hl.x + hl.w + pad &&
        y >= hl.y - pad && y <= hl.y + hl.h + pad) {
      guide.advance(g)
      g._dirty = true
      return false  // 放行底层按钮处理
    }
    return true  // 屏蔽非高亮区域的点击
  }

  guide.advance(g)
  g._dirty = true
  return true
}

module.exports = { update, draw, onTouch }
