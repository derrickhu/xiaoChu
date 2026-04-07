/**
 * 修炼系统配置 — 等级 + 加点制
 * 
 * 核心流程：打肉鸽/灵兽秘境 → 累积经验 → 升级 → 获得修炼点 → 分配到升级树
 * 所有修炼属性在灵兽秘境和通天塔中均100%生效（局外养成带入局内）
 */

const {
  CULT_MAX_LEVEL, CULT_EXP_BASE, CULT_EXP_LINEAR, CULT_EXP_POW_EXP, CULT_EXP_POW_COEFF,
  CULT_KILL_BOSS_BASE, CULT_KILL_BOSS_FLOOR_COEFF,
  CULT_KILL_ELITE_BASE, CULT_KILL_ELITE_FLOOR_COEFF,
  CULT_KILL_NORMAL_BASE, CULT_KILL_NORMAL_FLOOR_COEFF,
  CULT_NEWBIE_EXP_DISCOUNT,
  CULT_CONFIG, CULT_KEYS, CULT_REALMS,
} = require('./balance/cultivation')

const MAX_LEVEL = CULT_MAX_LEVEL

function expToNextLevel(level) {
  if (level >= MAX_LEVEL) return Infinity
  const base = Math.floor(CULT_EXP_BASE + level * CULT_EXP_LINEAR + Math.pow(level, CULT_EXP_POW_EXP) * CULT_EXP_POW_COEFF)
  if (level < CULT_NEWBIE_EXP_DISCOUNT.length) return Math.floor(base * CULT_NEWBIE_EXP_DISCOUNT[level])
  return base
}

// 修炼树总共需要的点数：20+15+5+10+8 = 58
const TOTAL_POINTS_NEEDED = CULT_KEYS.reduce((s, k) => s + CULT_CONFIG[k].maxLv, 0)

/**
 * 当前等级的累计效果值
 */
function effectValue(key, level) {
  const cfg = CULT_CONFIG[key]
  if (!cfg || level <= 0) return 0
  return +(level * cfg.perLv).toFixed(2)
}

/**
 * 已分配的总点数
 */
function usedPoints(levels) {
  let sum = 0
  for (const k of CULT_KEYS) sum += (levels[k] || 0)
  return sum
}

const REALMS = CULT_REALMS

function currentRealm(level) {
  let realm = REALMS[0]
  for (const r of REALMS) {
    if (level >= r.minLv) realm = r
    else break
  }
  return realm
}

function nextRealm(level) {
  for (const r of REALMS) {
    if (r.minLv > level) return r
  }
  return null
}

/**
 * 击杀经验公式（统一数值，battle.js / touchHandlers.js 共用）
 * @param {object} enemy - 包含 isBoss, isElite 标记
 * @param {number} floor - 当前层数
 */
function killExpBase(enemy, floor) {
  if (!enemy) return 0
  if (enemy.isBoss) return CULT_KILL_BOSS_BASE + floor * CULT_KILL_BOSS_FLOOR_COEFF
  if (enemy.isElite) return CULT_KILL_ELITE_BASE + floor * CULT_KILL_ELITE_FLOOR_COEFF
  return CULT_KILL_NORMAL_BASE + floor * CULT_KILL_NORMAL_FLOOR_COEFF
}

module.exports = {
  MAX_LEVEL, expToNextLevel,
  CULT_CONFIG, CULT_KEYS, TOTAL_POINTS_NEEDED,
  effectValue, usedPoints,
  REALMS, currentRealm, nextRealm,
  killExpBase,
}
