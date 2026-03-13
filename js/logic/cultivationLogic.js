/**
 * 修炼系统纯逻辑（不依赖任何 view）
 * 红点判断等放在这里，避免 view 之间循环依赖
 */
const {
  CULT_CONFIG, CULT_KEYS,
} = require('../data/cultivationConfig')

function hasCultUpgradeAvailable(storage) {
  const cult = storage._d.cultivation
  if (!cult || !cult.skillPoints || cult.skillPoints <= 0) return false
  for (const key of CULT_KEYS) {
    if (cult.levels[key] < CULT_CONFIG[key].maxLv) return true
  }
  return false
}

module.exports = { hasCultUpgradeAvailable }
