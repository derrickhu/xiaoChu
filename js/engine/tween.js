/**
 * 轻量补间动画系统 — 缓动函数 + 补间管理器
 * 支持对象属性补间、缓动曲线、完成回调、链式动画
 */

// ===== 缓动函数库 =====
const Ease = {
  linear: t => t,
  // 掉落弹跳
  outBounce(t) {
    if (t < 1/2.75) return 7.5625*t*t
    if (t < 2/2.75) { t -= 1.5/2.75; return 7.5625*t*t + 0.75 }
    if (t < 2.5/2.75) { t -= 2.25/2.75; return 7.5625*t*t + 0.9375 }
    t -= 2.625/2.75; return 7.5625*t*t + 0.984375
  },
  // 回弹过冲
  outBack(t) { const s = 1.70158; return (t-=1)*t*((s+1)*t+s)+1 },
  // 减速停止
  outCubic: t => 1 - Math.pow(1-t, 3),
  // 加速消失
  inExpo: t => t === 0 ? 0 : Math.pow(2, 10*(t-1)),
  // 弹性
  outElastic(t) {
    if (t === 0 || t === 1) return t
    return Math.pow(2, -10*t) * Math.sin((t-0.1)*5*Math.PI) + 1
  },
  // 平滑加减速
  inOutQuad: t => t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2, 2)/2,
  // 快速开始慢速结束
  outQuint: t => 1 - Math.pow(1-t, 5),
}

// ===== 补间对象池 =====
const _pool = []
const POOL_MAX = 120

function _getTween() {
  if (_pool.length > 0) return _pool.pop()
  return { target: null, props: null, elapsed: 0, duration: 0, ease: null, onUpdate: null, onComplete: null, delay: 0, active: false }
}

function _releaseTween(tw) {
  tw.target = null; tw.props = null; tw.onUpdate = null; tw.onComplete = null; tw.active = false
  if (_pool.length < POOL_MAX) _pool.push(tw)
}

// ===== 活跃补间列表 =====
const _tweens = []

/**
 * 创建补间动画
 * @param {object} target - 动画目标对象
 * @param {object} to - 目标属性值 { x: 100, alpha: 0 }
 * @param {number} duration - 持续时间（秒）
 * @param {function} [ease] - 缓动函数，默认 outCubic
 * @param {object} [opts] - 额外选项 { delay, onUpdate, onComplete }
 * @returns {object} 补间对象（可用于 cancel）
 */
function tween(target, to, duration, ease, opts) {
  const tw = _getTween()
  tw.target = target
  tw.duration = duration || 0.3
  tw.ease = ease || Ease.outCubic
  tw.elapsed = 0
  tw.delay = (opts && opts.delay) || 0
  tw.onUpdate = (opts && opts.onUpdate) || null
  tw.onComplete = (opts && opts.onComplete) || null
  tw.active = true
  // 记录起始值和目标值
  tw.props = {}
  for (const key in to) {
    tw.props[key] = { from: target[key] || 0, to: to[key] }
  }
  _tweens.push(tw)
  return tw
}

/**
 * 每帧更新所有活跃补间（由主循环调用）
 * @param {number} dt - 帧间隔（秒）
 */
function updateTweens(dt) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    const tw = _tweens[i]
    if (!tw.active) { _tweens.splice(i, 1); _releaseTween(tw); continue }
    if (tw.delay > 0) { tw.delay -= dt; continue }
    tw.elapsed += dt
    const rawP = Math.min(1, tw.elapsed / tw.duration)
    const p = tw.ease(rawP)
    for (const key in tw.props) {
      const { from, to } = tw.props[key]
      tw.target[key] = from + (to - from) * p
    }
    if (tw.onUpdate) tw.onUpdate(tw.target, p)
    if (rawP >= 1) {
      tw.active = false
      if (tw.onComplete) tw.onComplete(tw.target)
      _tweens.splice(i, 1)
      _releaseTween(tw)
    }
  }
}

/** 取消指定目标的所有补间 */
function cancelTweens(target) {
  for (let i = _tweens.length - 1; i >= 0; i--) {
    if (_tweens[i].target === target) {
      _tweens[i].active = false
    }
  }
}

/** 取消单个补间 */
function cancelTween(tw) {
  if (tw) tw.active = false
}

/** 当前活跃补间数量（调试用） */
function activeTweenCount() { return _tweens.length }

module.exports = { Ease, tween, updateTweens, cancelTweens, cancelTween, activeTweenCount }
