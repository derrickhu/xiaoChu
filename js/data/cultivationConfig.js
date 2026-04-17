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

// ===== 重阶命名（一重 ~ 二十重）=====
//   ≤20 查表；超出的小概率档位兜底走"N 重"字符串（如"二十一重"）
//   为什么不再用"初期/中期/后期/圆满"：细粒度不够，玩家会觉得"怎么没进度"
const _SUBSTAGE_NAMES = [
  '一重', '二重', '三重', '四重', '五重', '六重', '七重', '八重', '九重', '十重',
  '十一重', '十二重', '十三重', '十四重', '十五重', '十六重', '十七重', '十八重', '十九重', '二十重',
]
function _subStageName(idx) {
  if (idx < 0) return ''
  if (idx < _SUBSTAGE_NAMES.length) return _SUBSTAGE_NAMES[idx]
  return `${idx + 1}重`
}

/**
 * 给定修炼等级，返回完整境界信息。
 *   · realmId / realmName  大境界（id 持久化稳定、name 显示用）
 *   · subStage             重阶索引（0 起，凡人恒为 0）
 *   · subStageName         重阶显示名（"一重".."二十重"）
 *   · isMortal             是否凡人（凡人不显示重阶）
 *   · fullName             组合名："感气·三重" / "凡人"
 * 未达到任何境界（防御性）返回凡人
 */
function getRealmByLv(level) {
  const lv = Math.max(0, Math.floor(level || 0))
  const realm = currentRealm(lv)
  const isMortal = realm.id === 'mortal'
  const subStage = isMortal ? 0 : Math.max(0, lv - realm.minLv)
  const subStageName = isMortal ? '' : _subStageName(subStage)
  const fullName = isMortal ? realm.name : `${realm.name}·${subStageName}`
  return {
    realmId: realm.id,
    realmName: realm.name,
    subStage,
    subStageName,
    isMortal,
    fullName,
    minLv: realm.minLv,
    maxLv: realm.maxLv,
    stages: realm.stages,
    motto: realm.motto || '',
    color: realm.color || '#9DA3AD',
    accent: realm.accent || '#3A3F48',
  }
}

/**
 * 判断从 prevLv → currLv 是否发生了"境界跨档"。
 *   返回：
 *     null                    没变化
 *     { kind:'minor', prev, curr }   仅小阶跨档（同一大境界内重数 +1 及以上）
 *     { kind:'major', prev, curr }   大境界跨档（realmId 变了）
 *   prev/curr 都是 getRealmByLv 结构
 */
function diffRealmUp(prevLv, currLv) {
  if (currLv <= prevLv) return null
  const prev = getRealmByLv(prevLv)
  const curr = getRealmByLv(currLv)
  if (prev.realmId !== curr.realmId) return { kind: 'major', prev, curr }
  if (curr.subStage > prev.subStage) return { kind: 'minor', prev, curr }
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
  getRealmByLv, diffRealmUp,
  killExpBase,
}
