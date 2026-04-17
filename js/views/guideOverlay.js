/**
 * 统一指引 UI 覆盖层
 * "仙宠 · 小灵"卷轴气泡 + 可选高亮描边 + 指向按钮的尾巴 + 点击继续
 * (气泡组件见 uiComponents.drawGuideBubble)
 */
const V = require('./env')
const guide = require('../engine/guideManager')
const { wrapText, drawGuideBubble } = require('./uiComponents')
const { LING } = require('../data/lingIdentity')

// 默认说话人 + 头像（step 里可通过 speaker / avatar 覆盖）
const DEFAULT_SPEAKER = LING.speaker
const DEFAULT_AVATAR = LING.avatar

// 入场展开进度（从当前 step 开始计）
let _lastStepKey = null
let _enterT = 0

function update() {
  guide.updateFade()
  // 入场展开推进（6 帧展开完，后续稳定在 1）
  const info = guide.getCurrent()
  if (info) {
    const key = `${info.flag || ''}#${info.stepIdx}`
    if (key !== _lastStepKey) {
      _lastStepKey = key
      _enterT = 0
    } else if (_enterT < 1) {
      _enterT = Math.min(1, _enterT + 1 / 6)
    }
  } else {
    _lastStepKey = null
    _enterT = 0
  }
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

  if (hl) {
    const pad = 6 * S
    const hx = hl.x - pad, hy = hl.y - pad
    const hw = hl.w + pad * 2, hh = hl.h + pad * 2
    const hr = 8 * S
    c.strokeStyle = 'rgba(255,215,0,0.85)'
    c.lineWidth = 2 * S
    V.R.rr(hx, hy, hw, hh, hr)
    c.stroke()
  }

  const bubbleGeom = { bottom: null }
  _drawBubble(c, W, H, S, info, hl, bubbleGeom)

  // 手指指向高亮区（派遣空位等）
  if (hl && info.showFinger) {
    const bounce = Math.sin(g.af * 0.1) * 6 * S
    c.save()
    c.globalAlpha = alpha * 0.92
    c.font = `${32 * S}px "PingFang SC", "Apple Color Emoji", sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    const fx = hl.x + hl.w * 0.5
    const fy = hl.y + hl.h + 22 * S + bounce
    c.shadowColor = 'rgba(0,0,0,0.5)'
    c.shadowBlur = 4 * S
    c.fillText('\uD83D\uDC46', fx, fy)
    c.restore()
  }

  // "点击继续" / "知道了"：有底部高亮时夹在气泡与高亮之间，避免与底栏/大按钮叠字
  const isLast = info.stepIdx === info.totalSteps - 1
  const btnText = isLast ? '知道了' : '点击继续'
  const breathAlpha = 0.5 + 0.5 * Math.sin(g.af * 0.08)
  c.globalAlpha = alpha * breathAlpha
  c.fillStyle = 'rgba(255,230,180,0.9)'
  c.font = `${13 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  let tapY = H - 80 * S
  if (hl && info.position === 'bottom' && bubbleGeom.bottom != null && hl.y > bubbleGeom.bottom + 20 * S) {
    tapY = (bubbleGeom.bottom + hl.y) * 0.5
    tapY = Math.max(bubbleGeom.bottom + 14 * S, Math.min(tapY, hl.y - 10 * S))
  }
  c.fillText(btnText, W / 2, tapY)

  c.restore()
}

/** @param {object|null} hl 高亮矩形 { x,y,w,h } @param {{ bottom: number|null }} geom 输出气泡底边 Y */
function _drawBubble(c, W, H, S, info, hl, geom) {
  const text = info.text
  const fontSize = 14.5 * S
  const lineH = fontSize * 1.55
  c.font = `bold ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`

  // 头像占左侧，正文可用宽度相应减少
  const speaker = info.speaker || DEFAULT_SPEAKER
  const avatarPath = info.avatar || DEFAULT_AVATAR
  const avatarImg = V.R.getImg(avatarPath)
  const hasAvatar = avatarImg && avatarImg.width > 0

  const bubbleW = Math.min(W - 30 * S, W - 30 * S) // 左右各留 15*S
  const avatarBoxW = hasAvatar ? (14 * S + 72 * S + 12 * S) : 20 * S
  const textMaxW = bubbleW - avatarBoxW - 20 * S
  const lines = wrapText(c, text, textMaxW)
  const speakerH = speaker ? 22 * S : 0
  const textBlockH = lines.length * lineH
  const padTopBottom = speaker ? 12 * S : 14 * S
  const bubbleH = Math.max(80 * S, padTopBottom * 2 + speakerH + textBlockH)

  // 气泡 Y 位置（带"位于高亮上方但避免顶到导航/返回"的现有逻辑）
  let bubbleY
  if (info.position === 'top') {
    bubbleY = V.safeTop + 60 * S
  } else if (info.position === 'bottom') {
    if (hl && typeof hl.y === 'number' && typeof hl.h === 'number') {
      const gap = 22 * S  // 给尾巴留空间
      const minY = V.safeTop + 52 * S
      const yAboveBtn = hl.y - bubbleH - gap
      if (yAboveBtn >= minY) {
        bubbleY = yAboveBtn
      } else if (minY + bubbleH <= hl.y - gap) {
        bubbleY = minY
      } else {
        bubbleY = yAboveBtn
      }
    } else {
      bubbleY = H - bubbleH - 110 * S
    }
  } else {
    bubbleY = (H - bubbleH) / 2
  }
  const bubbleX = (W - bubbleW) / 2

  if (geom) geom.bottom = bubbleY + bubbleH

  // 尾巴目标：position=bottom 且有 highlight 时，指向按钮中心上沿
  const tailTo = (info.position === 'bottom' && hl && info.pointToHighlight !== false)
    ? { x: hl.x + hl.w / 2, y: hl.y }
    : null

  drawGuideBubble(c, S, bubbleX, bubbleY, bubbleW, bubbleH, {
    avatarImg: hasAvatar ? avatarImg : null,
    speaker,
    lines,
    fontSize,
    lineH,
    tailTo,
    animT: _enterT,
  })
}

function onTouch(g, type) {
  if (!guide.isActive()) return false
  if (type !== 'start' && type !== 'end') return false

  if (type === 'start') { guide.advance(g); g._dirty = true }
  return true
}

module.exports = { update, draw, onTouch }
