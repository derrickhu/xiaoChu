/**
 * 灵宠池配置 — 独立培养体系
 * 
 * 核心设计：
 * - 共享经验池：肉鸽和固定关卡都产出宠物经验，玩家自主分配
 * - 按档位差异化升级成本：T3便宜易练，T1昂贵但强
 * - 碎片分解：不需要的碎片可转化为宠物经验
 * - 独立于肉鸽内★1→★3的简化升星，这里是长期局外养成
 */

const { getPetTier, getPetById } = require('./pets')

// ===== 等级系统 =====

// 普通灵宠满级 / 高级灵宠满级（Phase 4）
const POOL_MAX_LV = 40
const POOL_ADV_MAX_LV = 60

// 不同档位的升级经验倍率
const TIER_EXP_MUL = {
  T3: 1.0,   // 便宜易练，前期快速出战力
  T2: 1.3,   // 中等成本
  T1: 1.6,   // 高成本，长期投资
}

/**
 * 灵宠升级所需经验（受档位影响）
 * @param {number} level - 当前等级
 * @param {string} tier - 宠物档位 'T1'|'T2'|'T3'
 */
function petExpToNextLevel(level, tier) {
  const base = Math.floor(20 + level * 8 + Math.pow(level, 1.4) * 0.5)
  const mul = TIER_EXP_MUL[tier] || 1.0
  return Math.floor(base * mul)
}

// ===== 星级系统 =====

// 升星碎片消耗
const POOL_STAR_FRAG_COST = { 2: 5, 3: 15, 4: 30 }

// 升星等级门槛
const POOL_STAR_LV_REQ = { 2: 10, 3: 20, 4: 45 }

// 星级攻击倍率
const POOL_STAR_ATK_MUL = {
  1: 1.0,
  2: 1.3,
  3: 1.7,
  4: 2.2,  // Phase 4
}

// ===== 碎片分解 =====

// 1碎片 = N宠物经验（确保分解是次优选择）
const FRAGMENT_TO_EXP = 40

// ===== 攻击力计算 =====

/**
 * 灵宠池中宠物的攻击力（仅用于固定关卡）
 * @param {object} poolPet - 灵宠池中的宠物记录 { id, level, star, ... }
 */
function getPoolPetAtk(poolPet) {
  const basePet = getPetById(poolPet.id)
  if (!basePet) return 0
  const baseAtk = basePet.atk
  const tier = getPetTier(poolPet.id)
  // 等级加成：T1/T2 每级+1，T3 每级+0.8
  const lvBonus = tier === 'T3' ? Math.floor(poolPet.level * 0.8) : poolPet.level
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  return Math.floor((baseAtk + lvBonus) * starMul)
}

// ===== 入池默认值 =====

const ENTRY_LEVEL = 5       // 入池初始等级
const ENTRY_FRAGMENTS = 2   // 入池赠送碎片

// ===== 肉鸽局结算宠物经验 =====

/**
 * 肉鸽结算宠物经验公式
 * 独立于修炼经验，按消除/连击/击杀/层数计算
 * @param {object} expDetail - { elimExp, comboExp, killExp }
 * @param {number} floor - 最终到达层数
 * @param {boolean} cleared - 是否通关
 */
function calcRoguelikePetExp(expDetail, floor, cleared) {
  // 基础：修炼经验的 30% 折算为宠物经验
  const rawExp = (expDetail.elimExp || 0) + (expDetail.comboExp || 0) + (expDetail.killExp || 0)
  const baseFromCombat = Math.floor(rawExp * 0.3)
  // 层数奖励
  const floorBonus = floor * 2
  // 通关奖励
  const clearBonus = cleared ? 200 : 0
  return baseFromCombat + floorBonus + clearBonus
}

// ===== 灵宠派遣（挂机）系统 =====

const IDLE_MAX_SLOTS = 3            // 最大派遣槽位
const IDLE_FRAG_INTERVAL = 4 * 3600 * 1000  // 每产出1碎片的间隔（4小时，ms）
const IDLE_MAX_ACCUMULATE = 24 * 3600 * 1000 // 最大离线累积时长（24小时，ms）
const IDLE_PET_EXP_PER_HOUR = 8     // 每只宠物每小时产出的共享经验

/**
 * 计算派遣产出
 * @param {number} elapsedMs - 经过时间（毫秒）
 * @param {number} petLevel  - 宠物等级（影响经验产出）
 * @returns {{ fragments: number, petExp: number }}
 */
function calcIdleReward(elapsedMs, petLevel) {
  const capped = Math.min(elapsedMs, IDLE_MAX_ACCUMULATE)
  const fragments = Math.floor(capped / IDLE_FRAG_INTERVAL)
  const hours = capped / (3600 * 1000)
  const petExp = Math.floor(hours * IDLE_PET_EXP_PER_HOUR * (1 + petLevel * 0.02))
  return { fragments, petExp }
}

module.exports = {
  POOL_MAX_LV,
  POOL_ADV_MAX_LV,
  TIER_EXP_MUL,
  petExpToNextLevel,
  POOL_STAR_FRAG_COST,
  POOL_STAR_LV_REQ,
  POOL_STAR_ATK_MUL,
  FRAGMENT_TO_EXP,
  getPoolPetAtk,
  ENTRY_LEVEL,
  ENTRY_FRAGMENTS,
  calcRoguelikePetExp,
  IDLE_MAX_SLOTS,
  IDLE_FRAG_INTERVAL,
  IDLE_MAX_ACCUMULATE,
  IDLE_PET_EXP_PER_HOUR,
  calcIdleReward,
}
