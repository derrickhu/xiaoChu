/**
 * 游戏风自绘 Toast —— 非战斗场景的统一提示组件
 *
 * 设计目标：
 *   - 替代微信原生 wx.showToast（样式与游戏主题脱节、位置不可控）
 *   - 支持多种类型：普通文字 / 资源获得 / 警告 / 成就
 *   - 支持队列：连续调用不会相互覆盖
 *
 * 使用：
 *   const toast = require('./gameToast')
 *   toast.show('体力不足', { type: 'warn' })
 *   toast.show(`+${n} 灵石`, { type: 'resource', icon: 'assets/ui/icon_soul_stone.png' })
 *
 * 绘制时机：每帧由 main.js 调用 toast.draw()（在 guideOverlay 之上、confirmDialog 之下）
 */
const V = require('./env')

const TYPES = {
  text: {
    bg: 'rgba(30, 20, 45, 0.88)',
    border: 'rgba(232, 184, 32, 0.65)',
    text: '#FFFFFF',
    iconDefault: null,
  },
  resource: {
    bg: 'rgba(28, 42, 36, 0.90)',
    border: 'rgba(126, 207, 106, 0.65)',
    text: '#FFFFFF',
    iconDefault: null,
  },
  warn: {
    bg: 'rgba(80, 24, 24, 0.90)',
    border: 'rgba(240, 140, 80, 0.70)',
    text: '#FFE6D8',
    iconDefault: null,
  },
  achievement: {
    bg: 'rgba(48, 30, 18, 0.92)',
    border: 'rgba(255, 214, 120, 0.85)',
    text: '#FFF4CE',
    iconDefault: null,
  },
}

// 队列与当前激活条目
const _queue = []
let _current = null

/**
 * 显示一条 toast
 * @param {string} msg - 文本
 * @param {object} [opts]
 * @param {'text'|'resource'|'warn'|'achievement'} [opts.type='text']
 * @param {string} [opts.icon] - 图标路径（可选）
 * @param {number} [opts.duration=1800] - 展示时长（ms），不含淡入淡出
 */
function show(msg, opts) {
  if (!msg) return
  const o = opts || {}
  const type = TYPES[o.type] ? o.type : 'text'
  const duration = Math.max(500, Number(o.duration) || 1800)
  _queue.push({
    msg: String(msg),
    type,
    icon: o.icon || null,
    duration,
    t: 0, // 毫秒计时
    state: 'pending',
  })
  if (!_current) _activateNext()
}

function _activateNext() {
  _current = _queue.shift() || null
  if (_current) _current.state = 'in'
}

/** 清空所有 toast（场景切换或紧急清屏时调用） */
function clear() {
  _queue.length = 0
  _current = null
}

function isActive() {
  return _current !== null
}

/**
 * 每帧绘制；假设 render loop 间隔约 16ms
 */
function draw() {
  if (!_current) return
  const t = _current
  // 动画时长（ms）
  const FADE_IN = 140
  const FADE_OUT = 220

  t.t += 16 // 近似 60fps，足够视觉使用

  if (t.state === 'in' && t.t >= FADE_IN) {
    t.state = 'hold'
    t.t = 0
  }
  if (t.state === 'hold' && t.t >= t.duration) {
    t.state = 'out'
    t.t = 0
  }
  if (t.state === 'out' && t.t >= FADE_OUT) {
    _activateNext()
    return
  }

  let alpha
  if (t.state === 'in') alpha = t.t / FADE_IN
  else if (t.state === 'out') alpha = Math.max(0, 1 - t.t / FADE_OUT)
  else alpha = 1

  _render(t, alpha)
}

function _render(t, alpha) {
  const { ctx, R, W, H, S } = V
  const palette = TYPES[t.type]

  ctx.save()
  ctx.globalAlpha = alpha

  const fontSize = (t.type === 'achievement' ? 14 : 13) * S
  ctx.font = `${t.type === 'achievement' ? 'bold ' : ''}${fontSize}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'

  const padX = 14 * S
  const padY = 10 * S
  const iconSize = 18 * S
  const iconGap = 8 * S
  const hasIcon = !!t.icon
  const iconImg = hasIcon ? R.getImg(t.icon) : null
  const iconReady = iconImg && iconImg.width > 0

  const textW = ctx.measureText(t.msg).width
  const contentW = (iconReady ? iconSize + iconGap : 0) + textW
  const boxW = Math.min(W - 40 * S, contentW + padX * 2)
  const boxH = fontSize + padY * 2

  // 位置：屏幕底部 28% 处（避开虚拟 home 条，同时不与对话框争位）
  const boxX = (W - boxW) / 2
  // achievement 型靠上一些
  const anchor = t.type === 'achievement' ? 0.42 : 0.72
  const boxY = H * anchor - boxH / 2

  // 阴影
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 10 * S
  ctx.shadowOffsetY = 2 * S
  ctx.fillStyle = palette.bg
  R.rr(boxX, boxY, boxW, boxH, 12 * S)
  ctx.fill()
  ctx.restore()

  // 描边
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1.2 * S
  R.rr(boxX, boxY, boxW, boxH, 12 * S)
  ctx.stroke()

  // 内容
  const centerY = boxY + boxH / 2
  const innerX = boxX + padX
  let cursor = innerX
  if (iconReady) {
    ctx.drawImage(iconImg, cursor, centerY - iconSize / 2, iconSize, iconSize)
    cursor += iconSize + iconGap
  }
  ctx.fillStyle = palette.text
  ctx.fillText(t.msg, cursor, centerY)

  // 成就型额外加一层金色光晕
  if (t.type === 'achievement') {
    ctx.save()
    const grad = ctx.createRadialGradient(
      W / 2, centerY, boxW * 0.2,
      W / 2, centerY, boxW * 0.7,
    )
    grad.addColorStop(0, 'rgba(255,220,140,0.22)')
    grad.addColorStop(1, 'rgba(255,220,140,0)')
    ctx.fillStyle = grad
    ctx.fillRect(boxX - 20 * S, boxY - 20 * S, boxW + 40 * S, boxH + 40 * S)
    ctx.restore()
  }

  ctx.restore()
}

module.exports = {
  show,
  clear,
  isActive,
  draw,
}
