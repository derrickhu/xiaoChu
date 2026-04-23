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

// 修炼树总共需要的点数（v2 后：28+19+5+14+12 = 78）
//   与 CULT_MAX_LEVEL=80 对应，Lv.1 起步 + 79 次升级共 80 修炼点，差 2 点正好覆盖老 Lv.60 的 2 闲置点。
const TOTAL_POINTS_NEEDED = CULT_KEYS.reduce((s, k) => s + CULT_CONFIG[k].maxLv, 0)

/**
 * 当前等级的"基础"累计效果值（不含境界祝福乘数）。
 *   · type=percent 的属性返回的是百分比数值（如 6.0 表示 +6%）
 *   · type=flat    的属性返回绝对值（心珠/秒等）
 *   · 战斗等真正消费时应改用 effectValueWithBlessing 拿"有效值"
 */
function effectValue(key, level) {
  const cfg = CULT_CONFIG[key]
  if (!cfg || level <= 0) return 0
  return +(level * cfg.perLv).toFixed(2)
}

/**
 * 取指定修炼等级所在境界的祝福乘数（仅作用于 type=percent 的属性）。
 *   未达到任何境界 / 凡人 / 感气：返回 1.00
 */
function getBlessingMultiplier(cultLv) {
  const realm = currentRealm(Math.max(0, Math.floor(cultLv || 0)))
  return (realm && realm.blessing) || 1
}

/**
 * 战斗 / 数值消费的统一出口：返回乘上境界祝福后的"有效"加成。
 *   · type=percent → 基础百分比 × blessing
 *   · type=flat    → 不乘 blessing（spirit/wisdom 是离散值，乘小数会变成奇怪的 0.x 心珠）
 *   · 上层调用约定：拿到的数值就是"实际生效"的最终值，不要再额外乘任何系数
 */
function effectValueWithBlessing(key, level, cultLv) {
  const base = effectValue(key, level)
  if (base === 0) return 0
  const cfg = CULT_CONFIG[key]
  if (!cfg || cfg.type !== 'percent') return base
  const mul = getBlessingMultiplier(cultLv)
  return +(base * mul).toFixed(2)
}

/**
 * 根据 cultivation 持久化数据，统一算出战斗端要消费的修炼加成。
 *   返回 { bodyPct, defPct, sensePct, spiritFlat, wisdomFlat, blessing, cultLv }
 *   · bodyPct/defPct/sensePct 是"已经乘过境界祝福"的最终百分比
 *   · spiritFlat/wisdomFlat 是绝对值（保持旧口径）
 *   · 战斗端在 stageManager / runManager 入口调用一次，写入 g._cultBonus*
 */
function calcCultBonuses(cult) {
  if (!cult || !cult.levels) {
    return { bodyPct: 0, defPct: 0, sensePct: 0, spiritFlat: 0, wisdomFlat: 0, blessing: 1, cultLv: 0 }
  }
  const cultLv = cult.level || 0
  return {
    cultLv,
    blessing: getBlessingMultiplier(cultLv),
    bodyPct:    effectValueWithBlessing('body',    cult.levels.body    || 0, cultLv),
    defPct:     effectValueWithBlessing('defense', cult.levels.defense || 0, cultLv),
    sensePct:   effectValueWithBlessing('sense',   cult.levels.sense   || 0, cultLv),
    spiritFlat: effectValueWithBlessing('spirit',  cult.levels.spirit  || 0, cultLv),
    wisdomFlat: effectValueWithBlessing('wisdom',  cult.levels.wisdom  || 0, cultLv),
  }
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
    // 与 realmName 同义；tierCeremony 等只读 name 的 UI 依赖此字段（diffRealmUp 路径不会经 storage 里 curr.name 别名）
    name: realm.name,
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

// ===== 修炼等级解锁的额外形象 =====
//   单一真源：cultivationView 展示 unlockHint 文案，storage._tryCultLevelUp 据此发解锁
//   老玩家（已达阈值但历史上 storage 从没补上）进游戏时一次性兜底补发（见 storage 构造里的补链）
const AVATAR_UNLOCK_LV = {
  boy2:  5,
  girl2: 10,
}

module.exports = {
  MAX_LEVEL, expToNextLevel,
  CULT_CONFIG, CULT_KEYS, TOTAL_POINTS_NEEDED,
  effectValue, effectValueWithBlessing, getBlessingMultiplier, calcCultBonuses, usedPoints,
  REALMS, currentRealm, nextRealm,
  getRealmByLv, diffRealmUp,
  killExpBase,
  AVATAR_UNLOCK_LV,
}
