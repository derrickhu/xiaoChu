/**
 * 通用飘字组件 —— 给"非战斗场景"的数值反馈用
 *
 * 设计目标：
 *   - 战斗里已有 dmgFloats（伤害/治疗飘字），界面层（宠物详情/修炼/派遣）反馈暂时只有 toast，
 *     toast 会和引导抢位置且一次一条，做不到"点一次加点、+3 攻"的连续硬反馈。
 *   - 本组件只做"在某坐标上冒一条字、浮起 + 淡出"，不承担任何业务状态，
 *     由调用方（petDetailView 等）在业务事件发生时 spawn 一条出来。
 *
 * 使用：
 *   const floatText = require('./floatText')
 *   // 在你的点击事件里：
 *   floatText.spawn(cx, cy, '+3 攻击', { color: '#FFE080' })
 *
 * 绘制：
 *   main.js 每帧 render() 里调 floatText.draw()（在 toast 之后）。
 *
 * 坐标系：
 *   spawn 接收的 x/y 为画布像素坐标（已乘 S）；组件内部不再放大。
 */

const V = require('./env')

/** 最多同屏显示条数，多了会挤成一坨；超出丢最早的 */
const MAX_ITEMS = 10
/** 生命周期（ms）= 淡入 + 停留 + 淡出 */
const LIFETIME = 900
/** 上浮距离（以逻辑像素，内部乘 S） */
const RISE = 34

const _items = []

/**
 * 生成一条飘字
 * @param {number} x - 画布像素坐标
 * @param {number} y - 画布像素坐标
 * @param {string} text
 * @param {object} [opts]
 * @param {string} [opts.color='#FFE080']
 * @param {number} [opts.size=15] - 字号（逻辑像素，内部乘 S）
 * @param {boolean} [opts.bold=true]
 * @param {number} [opts.dx=0] - 起飞横向偏移（逻辑像素，内部乘 S）
 * @param {number} [opts.dy=0] - 起飞垂直偏移（逻辑像素，内部乘 S，正值下移）
 * @param {number} [opts.delay=0] - 延后出现毫秒数（用于同位置多条串行冒出，避免重叠）
 */
function spawn(x, y, text, opts) {
  if (!text) return
  const o = opts || {}
  if (_items.length >= MAX_ITEMS) _items.shift()
  _items.push({
    x, y,
    text: String(text),
    color: o.color || '#FFE080',
    size: Math.max(10, Number(o.size) || 15),
    bold: o.bold !== false,
    dx: Number(o.dx) || 0,
    dy: Number(o.dy) || 0,
    delay: Math.max(0, Number(o.delay) || 0),
    t: 0,
  })
}

/** 清空（场景切换时调用，避免残留飘字飘到下个场景） */
function clear() {
  _items.length = 0
}

function isActive() {
  return _items.length > 0
}

/** 每帧绘制；假设 ~16ms/帧 */
function draw() {
  if (!_items.length) return
  const { ctx, S } = V
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = _items.length - 1; i >= 0; i--) {
    const it = _items[i]
    it.t += 16
    // 延时还未到：原地等（既不推进也不绘制）
    if (it.delay > 0) {
      it.delay -= 16
      if (it.delay > 0) { it.t = 0; continue }
      it.t = 0
    }
    if (it.t >= LIFETIME) { _items.splice(i, 1); continue }
    const p = it.t / LIFETIME
    // 先快后慢上浮，最后 30% 淡出
    const eased = 1 - Math.pow(1 - p, 2)
    const offsetY = -RISE * S * eased
    const alpha = p < 0.7 ? 1 : Math.max(0, 1 - (p - 0.7) / 0.3)
    ctx.globalAlpha = alpha
    ctx.font = `${it.bold ? 'bold ' : ''}${it.size * S}px "PingFang SC",sans-serif`
    // 描边一层深色保证在任何底图上都看得清
    ctx.lineWidth = 3 * S
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'
    const drawX = it.x + it.dx * S
    const drawY = it.y + it.dy * S + offsetY
    ctx.strokeText(it.text, drawX, drawY)
    ctx.fillStyle = it.color
    ctx.fillText(it.text, drawX, drawY)
  }
  ctx.restore()
}

module.exports = {
  spawn,
  clear,
  isActive,
  draw,
}
