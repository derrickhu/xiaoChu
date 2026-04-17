/**
 * 小灵庆贺横条 —— 玩家达成节点（升星/突破/首通/派遣归来/图鉴里程碑）时顶部弹出
 *
 * 设计目标：
 *   - gameToast 是"系统级"反馈，冷静、信息密度高；很难承担"情感反馈"。
 *   - lingCheer 是"角色级"反馈，永远由守护灵小灵在屏幕顶部露脸说一句话，
 *     和 drawLingCard / drawGuideBubble 构成一组"小灵陪伴"的视觉统一体验。
 *   - 非阻塞：不拦截点击、不拦截翻页；只是顶部滑入一条，1.8s 后自动滑出。
 *
 * 使用：
 *   const lingCheer = require('./lingCheer')
 *   lingCheer.show('主人，{pet}解锁技能啦！')
 *   lingCheer.show(text, { duration: 2400 }) // 需要更久的看清
 *
 * 绘制：
 *   main.js 每帧 render() 里调 lingCheer.draw()（在 toast 之后）。
 */

const V = require('./env')
const { LING } = require('../data/lingIdentity')

const MAX_QUEUE = 6
const DEFAULT_DURATION = 1800
const FADE_IN = 220
const FADE_OUT = 260
const H_LOGICAL = 52 // 横条高度（逻辑像素，内部 * S）
const AVATAR_SZ = 40

const _queue = []
let _current = null

/**
 * @param {string} msg
 * @param {object} [opts]
 * @param {number} [opts.duration]
 * @param {'info'|'warn'|'epic'} [opts.tone='info']  // epic=升星/突破走金色描边
 */
function show(msg, opts) {
  if (!msg) return
  const o = opts || {}
  if (_queue.length >= MAX_QUEUE) _queue.shift()
  _queue.push({
    msg: String(msg),
    tone: o.tone || 'info',
    duration: Math.max(700, Number(o.duration) || DEFAULT_DURATION),
    t: 0,
    state: 'pending',
  })
  if (!_current) _activateNext()
}

function _activateNext() {
  _current = _queue.shift() || null
  if (_current) _current.state = 'in'
}

function clear() {
  _queue.length = 0
  _current = null
}

function isActive() {
  return _current !== null
}

function draw() {
  if (!_current) return
  const c = _current
  c.t += 16
  if (c.state === 'in' && c.t >= FADE_IN) { c.state = 'hold'; c.t = 0 }
  if (c.state === 'hold' && c.t >= c.duration) { c.state = 'out'; c.t = 0 }
  if (c.state === 'out' && c.t >= FADE_OUT) { _activateNext(); return }

  let slide, alpha
  if (c.state === 'in') {
    const p = c.t / FADE_IN
    const eased = 1 - Math.pow(1 - p, 3)
    slide = eased
    alpha = p
  } else if (c.state === 'out') {
    const p = c.t / FADE_OUT
    slide = 1 - p * 0.6
    alpha = 1 - p
  } else {
    slide = 1
    alpha = 1
  }
  _render(c, slide, alpha)
}

function _render(c, slide, alpha) {
  const { ctx, R, W, S, safeTop } = V
  const palette = _palette(c.tone)

  const padX = 14 * S
  const padY = 8 * S
  const boxH = H_LOGICAL * S
  const boxW = Math.min(W - 24 * S, 360 * S)
  const boxX = (W - boxW) / 2
  // 顶部 slide 动画：从屏幕外 12px 滑到 safeTop + 8px
  const targetY = (safeTop || 0) + 8 * S
  const startY = -boxH - 4 * S
  const boxY = startY + (targetY - startY) * slide

  ctx.save()
  ctx.globalAlpha = alpha

  // 阴影
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 14 * S
  ctx.shadowOffsetY = 3 * S
  ctx.fillStyle = palette.bg
  R.rr(boxX, boxY, boxW, boxH, boxH / 2)
  ctx.fill()
  ctx.restore()

  // 描边
  ctx.strokeStyle = palette.border
  ctx.lineWidth = 1.4 * S
  R.rr(boxX, boxY, boxW, boxH, boxH / 2)
  ctx.stroke()

  // epic 型加一圈外发光
  if (c.tone === 'epic') {
    ctx.save()
    const grad = ctx.createRadialGradient(
      W / 2, boxY + boxH / 2, boxW * 0.15,
      W / 2, boxY + boxH / 2, boxW * 0.8,
    )
    grad.addColorStop(0, 'rgba(255,220,130,0.22)')
    grad.addColorStop(1, 'rgba(255,220,130,0)')
    ctx.fillStyle = grad
    ctx.fillRect(boxX - 30 * S, boxY - 30 * S, boxW + 60 * S, boxH + 60 * S)
    ctx.restore()
  }

  // 小灵头像（圆形裁切）
  const avatarSz = AVATAR_SZ * S
  const avatarCX = boxX + padX + avatarSz / 2
  const avatarCY = boxY + boxH / 2
  const img = R.getImg(LING.avatar)
  if (img && img.width > 0) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(avatarCX, avatarCY, avatarSz / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(img, avatarCX - avatarSz / 2, avatarCY - avatarSz / 2, avatarSz, avatarSz)
    ctx.restore()
    // 头像金边
    ctx.strokeStyle = palette.avatarRing
    ctx.lineWidth = 1.4 * S
    ctx.beginPath()
    ctx.arc(avatarCX, avatarCY, avatarSz / 2, 0, Math.PI * 2)
    ctx.stroke()
  } else {
    // 兜底：没有头像图时画一个小灵字圆牌
    ctx.fillStyle = palette.avatarRing
    ctx.beginPath()
    ctx.arc(avatarCX, avatarCY, avatarSz / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#2A1D12'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('灵', avatarCX, avatarCY + 1 * S)
  }

  // 文案（截断过长的消息）
  const textX = avatarCX + avatarSz / 2 + 10 * S
  const textMaxW = boxW - (textX - boxX) - padX
  ctx.font = `bold ${13 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = palette.text
  const line = _fitOneLine(ctx, c.msg, textMaxW)
  ctx.fillText(line, textX, boxY + boxH / 2)

  // 说话人小标签（右上角）
  ctx.font = `${9 * S}px "PingFang SC",sans-serif`
  ctx.fillStyle = palette.speaker
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(LING.speaker, boxX + boxW - padX, boxY + padY - 4 * S)

  ctx.restore()
}

function _palette(tone) {
  if (tone === 'epic') {
    return {
      bg: 'rgba(48, 30, 18, 0.94)',
      border: 'rgba(255, 214, 120, 0.9)',
      avatarRing: 'rgba(255, 214, 120, 0.95)',
      text: '#FFF4CE',
      speaker: 'rgba(255, 214, 120, 0.7)',
    }
  }
  if (tone === 'warn') {
    return {
      bg: 'rgba(64, 28, 24, 0.92)',
      border: 'rgba(240, 150, 90, 0.75)',
      avatarRing: 'rgba(240, 150, 90, 0.85)',
      text: '#FFE6D8',
      speaker: 'rgba(240, 150, 90, 0.7)',
    }
  }
  return {
    bg: 'rgba(30, 22, 46, 0.92)',
    border: 'rgba(180, 170, 220, 0.6)',
    avatarRing: 'rgba(200, 190, 240, 0.75)',
    text: '#FFFFFF',
    speaker: 'rgba(210, 200, 240, 0.65)',
  }
}

function _fitOneLine(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text
  let s = text
  while (s.length > 2 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1)
  return s + '…'
}

module.exports = {
  show,
  clear,
  isActive,
  draw,
}
