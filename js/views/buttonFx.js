/**
 * 按钮爆点组件 —— 点击成功瞬间的"爽感反馈层"
 *
 * 为什么要有：
 *   原来的反馈只有一条 floatText 飘字 + 可选 lingCheer 横条，缺少"点击那一下的打击感"。
 *   本组件提供三种爆点：
 *     upgrade  · 金光闪 + 6 颗金星扩散                     → 升级 / 领取 / 次级 CTA
 *     starUp   · 金光闪 + 8 颗金紫星扩散 + 金环扩散 (P2)   → 升星 / 突破 / 里程碑 CTA
 *     reward   · 银光闪 + 4 颗银星扩散                     → 分解 / 确认 / 普通领取
 *
 * 使用：
 *   const buttonFx = require('./buttonFx')
 *   // 在业务"升级成功"的分支里：
 *   buttonFx.trigger(rect, 'upgrade')
 *   // primaryButton 想读 flashT：
 *   const flashT = buttonFx.getFlashT(rect)
 *
 * 绘制：
 *   main.js render() 里调 buttonFx.draw()（flashT 由按钮自己读；本模块负责画粒子/金环）。
 *
 * 坐标系：
 *   rect 为画布像素坐标 [x, y, w, h]（已乘 S）。
 *   若 rect 在滚动面板里，调用方先换算成屏幕坐标再传。
 */

const V = require('./env')

/** 同屏最多爆点数，多余替换最老的 */
const MAX_FX = 6
/** 每种爆点的总帧数（~16ms/帧） */
const FX_FRAMES = { upgrade: 28, starUp: 40, reward: 22 }

const _fx = []
// rect 的 key（用 x,y,w,h 组合），便于 primaryButton 查 flashT
function _key(rect) {
  return rect[0] + '_' + rect[1] + '_' + rect[2] + '_' + rect[3]
}

/**
 * 触发一次爆点
 * @param {[number,number,number,number]} rect  [x, y, w, h] 画布像素坐标
 * @param {'upgrade'|'starUp'|'reward'} type
 */
function trigger(rect, type) {
  if (!rect || !Array.isArray(rect) || rect.length < 4) return
  type = type || 'upgrade'
  const maxT = FX_FRAMES[type] || FX_FRAMES.upgrade

  // 生成粒子（从按钮上边扩散）
  const count = type === 'starUp' ? 8 : (type === 'reward' ? 4 : 6)
  const particles = []
  const cx = rect[0] + rect[2] / 2
  const cy = rect[1] + rect[3] / 2
  for (let i = 0; i < count; i++) {
    const baseAng = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8
    const ang = baseAng + (i / count) * Math.PI * 1.2 - Math.PI * 0.6
    const speed = 1.2 + Math.random() * 0.9
    particles.push({
      x: cx + (Math.random() - 0.5) * rect[2] * 0.3,
      y: cy - rect[3] * 0.2,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed - 0.6,
      size: (type === 'starUp' ? 5 : 4) * (0.8 + Math.random() * 0.5),
      hue: type === 'starUp' ? (Math.random() < 0.4 ? 'purple' : 'gold')
          : type === 'reward' ? 'silver' : 'gold',
    })
  }

  if (_fx.length >= MAX_FX) _fx.shift()
  _fx.push({
    key: _key(rect),
    rect: rect.slice(),
    type,
    t: 0,
    maxT,
    particles,
  })
}

/** 供 primaryButton 读取：给定 rect 返回 flashT (0~1)，无爆点时返回 0 */
function getFlashT(rect) {
  if (!rect) return 0
  const k = _key(rect)
  for (let i = _fx.length - 1; i >= 0; i--) {
    if (_fx[i].key !== k) continue
    const p = _fx[i].t / _fx[i].maxT
    // 头 20% 快速冲到 1.0，尾 60% 缓慢衰减到 0
    if (p < 0.2) return p / 0.2
    return Math.max(0, 1 - (p - 0.2) / 0.8)
  }
  return 0
}

function clear() { _fx.length = 0 }
function isActive() { return _fx.length > 0 }

/** 每帧绘制：粒子 + 金环（flashT 在按钮自绘时读取） */
function draw() {
  if (!_fx.length) return
  const { ctx, S } = V
  ctx.save()
  for (let i = _fx.length - 1; i >= 0; i--) {
    const f = _fx[i]
    f.t++
    if (f.t >= f.maxT) { _fx.splice(i, 1); continue }
    const p = f.t / f.maxT

    // 金环扩散（starUp 专属 P2）
    if (f.type === 'starUp') {
      const cx = f.rect[0] + f.rect[2] / 2
      const cy = f.rect[1] + f.rect[3] / 2
      const maxR = Math.max(f.rect[2], f.rect[3]) * 1.4
      const r = maxR * p
      const ringAlpha = Math.max(0, 1 - p) * 0.8
      ctx.save()
      ctx.globalAlpha = ringAlpha
      ctx.strokeStyle = '#ffe080'
      ctx.lineWidth = 3 * S * (1 - p * 0.5)
      ctx.shadowColor = '#ffd060'
      ctx.shadowBlur = 8 * S
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }

    // 粒子
    for (let j = 0; j < f.particles.length; j++) {
      const pt = f.particles[j]
      pt.x += pt.vx * S * 1.2
      pt.y += pt.vy * S * 1.2
      pt.vy += 0.06 * S  // 轻微重力，让粒子有"甩开"的弧
      const alpha = Math.max(0, 1 - p)
      ctx.globalAlpha = alpha
      const color = pt.hue === 'purple' ? '#e0a0ff'
        : pt.hue === 'silver' ? '#f0ead4'
        : '#ffe080'
      ctx.fillStyle = color
      ctx.shadowColor = color
      ctx.shadowBlur = 6 * S
      // 四瓣星形（简化：两条十字）
      const sz = pt.size * S * (0.6 + 0.4 * alpha)
      ctx.beginPath()
      ctx.moveTo(pt.x, pt.y - sz)
      ctx.lineTo(pt.x + sz * 0.35, pt.y - sz * 0.35)
      ctx.lineTo(pt.x + sz, pt.y)
      ctx.lineTo(pt.x + sz * 0.35, pt.y + sz * 0.35)
      ctx.lineTo(pt.x, pt.y + sz)
      ctx.lineTo(pt.x - sz * 0.35, pt.y + sz * 0.35)
      ctx.lineTo(pt.x - sz, pt.y)
      ctx.lineTo(pt.x - sz * 0.35, pt.y - sz * 0.35)
      ctx.closePath()
      ctx.fill()
    }
    ctx.shadowBlur = 0
  }
  ctx.restore()
}

module.exports = { trigger, getFlashT, clear, isActive, draw }
