/**
 * 数值滚动小组件 —— 让"升级/加点/获得奖励"时左侧数字从旧值快速滚动到新值
 *
 * 为什么要有：
 *   原来升级成功后"Lv.12"只是瞬间刷新，玩家的眼睛抓不到"变化"本身。
 *   一个 120ms 的数值插值让"12 → 14"可感知，强化成长感。
 *
 * 使用：
 *   const nt = require('./numberTween')
 *   // 业务里：
 *   nt.tween('pet.level.' + petId, 11, 12, 180)
 *   // 绘制处：
 *   const display = nt.value('pet.level.' + petId, poolPet.level)
 *   ctx.fillText('Lv.' + display, x, y)
 *
 *   // 想展示整数（大多数情况），直接用：
 *   const txt = nt.intText('pet.level.' + petId, poolPet.level)
 *
 * 说明：
 *   - 如果 key 不在 tween 中，value() 返回 fallback（即当前真实值）
 *   - tween 到期后自动清理；下次 value() 直接返回 fallback
 *   - 内部用 Date.now() 推进，不依赖 render 循环
 */

const _tweens = {}

/**
 * 启动一个数值插值
 * @param {string} key
 * @param {number} from
 * @param {number} to
 * @param {number} duration  ms
 */
function tween(key, from, to, duration) {
  if (!key || from === to) { delete _tweens[key]; return }
  _tweens[key] = {
    from,
    to,
    start: Date.now(),
    dur: Math.max(30, duration || 180),
  }
}

/**
 * 读取当前插值（线性+ease-out）。未启动时返回 fallback。
 */
function value(key, fallback) {
  const t = _tweens[key]
  if (!t) return fallback != null ? fallback : 0
  const dt = Date.now() - t.start
  if (dt >= t.dur) { delete _tweens[key]; return fallback != null ? fallback : t.to }
  const p = dt / t.dur
  const eased = 1 - Math.pow(1 - p, 2)
  return t.from + (t.to - t.from) * eased
}

/** 直接拿到整数文本，便于 fillText 使用 */
function intText(key, fallback) {
  return String(Math.round(value(key, fallback)))
}

/** 清空所有正在进行的 tween（切换场景时用） */
function clear() {
  for (const k in _tweens) delete _tweens[k]
}

/** 是否有活跃 tween（用于脏检测） */
function isActive() {
  for (const k in _tweens) {
    if (Date.now() - _tweens[k].start < _tweens[k].dur) return true
  }
  return false
}

module.exports = { tween, value, intText, clear, isActive }
