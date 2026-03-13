/**
 * 修炼系统配置 — 等级 + 加点制
 * 
 * 核心流程：打肉鸽/固定关卡 → 累积经验 → 升级 → 获得修炼点 → 分配到升级树
 * 所有修炼属性仅在固定关卡模式（battleMode === 'stage'）中生效
 */

const {
  CULT_MAX_LEVEL,
  CULT_EXP_BASE,
  CULT_EXP_LINEAR,
  CULT_EXP_POW_EXP,
  CULT_EXP_POW_COEFF,
  CULT_KILL_BOSS_BASE,
  CULT_KILL_BOSS_FLOOR_COEFF,
  CULT_KILL_ELITE_BASE,
  CULT_KILL_ELITE_FLOOR_COEFF,
  CULT_KILL_NORMAL_BASE,
  CULT_KILL_NORMAL_FLOOR_COEFF,
} = require('./constants')

// ===== 等级经验表 =====
// 总计 60 级，每级给 1 修炼点，58 点可把修炼树全部点满，多出 2 点作为容错
const MAX_LEVEL = CULT_MAX_LEVEL

function expToNextLevel(level) {
  if (level >= MAX_LEVEL) return Infinity
  return Math.floor(CULT_EXP_BASE + level * CULT_EXP_LINEAR + Math.pow(level, CULT_EXP_POW_EXP) * CULT_EXP_POW_COEFF)
}

// 预计经验节奏（参考）：
// Lv1→2: 53   Lv5→6: 118   Lv10→11: 202   Lv20→21: 416
// Lv30→31: 682   Lv40→41: 996   Lv50→51: 1352   Lv59→60: 1705

// ===== 修炼树配置（加点制）=====
// 每项每级消耗 1 修炼点
const CULT_CONFIG = {
  body:    { name:'体魄', theme:'淬体', maxLv:20, perLv:5,    unit:'HP上限',   desc:'固定关卡中英雄HP上限' },
  spirit:  { name:'灵力', theme:'通脉', maxLv:15, perLv:1,    unit:'心珠回复', desc:'固定关卡中心珠回复基数' },
  wisdom:  { name:'悟性', theme:'感悟', maxLv:5,  perLv:0.15, unit:'s转珠时间', desc:'固定关卡中转珠操作时间' },
  defense: { name:'根骨', theme:'筑基', maxLv:10, perLv:2,    unit:'减伤',     desc:'固定关卡中每次受伤减免固定值' },
  sense:   { name:'神识', theme:'开窍', maxLv:8,  perLv:8,    unit:'护盾',     desc:'固定关卡中开局获得护盾' },
}

const CULT_KEYS = ['body', 'spirit', 'wisdom', 'defense', 'sense']

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

// ===== 修炼境界（由等级决定）=====
const REALMS = [
  { minLv: 0,  name: '凡人' },
  { minLv: 1,  name: '感气期' },
  { minLv: 5,  name: '练气期' },
  { minLv: 15, name: '筑基期' },
  { minLv: 30, name: '金丹期' },
  { minLv: 45, name: '元婴期' },
  { minLv: 58, name: '化神期' },
]

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
