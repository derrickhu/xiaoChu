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
const {
  POOL_MAX_LV,
  POOL_ADV_MAX_LV,
  POOL_TIER_EXP_MUL,
  POOL_EXP_BASE,
  POOL_EXP_LINEAR,
  POOL_EXP_POW_EXP,
  POOL_EXP_POW_COEFF,
  POOL_STAR_FRAG_COST,
  POOL_STAR_LV_REQ,
  POOL_STAR_ATK_MUL,
  POOL_FRAGMENT_TO_EXP,
  POOL_ENTRY_LEVEL,
  POOL_ENTRY_FRAGMENTS,
  POOL_T3_LV_BONUS_RATE,
  POOL_ROGUE_EXP_RATIO,
  POOL_ROGUE_FLOOR_BONUS,
  POOL_ROGUE_CLEAR_BONUS,
  IDLE_MAX_SLOTS,
  IDLE_FRAG_INTERVAL,
  IDLE_MAX_ACCUMULATE,
  IDLE_PET_EXP_PER_HOUR,
  IDLE_PET_LV_EXP_FACTOR,
} = require('./constants')

// ===== 等级系统 =====

const TIER_EXP_MUL = POOL_TIER_EXP_MUL

/**
 * 灵宠升级所需经验（受档位影响）
 * @param {number} level - 当前等级
 * @param {string} tier - 宠物档位 'T1'|'T2'|'T3'
 */
function petExpToNextLevel(level, tier) {
  const base = Math.floor(POOL_EXP_BASE + level * POOL_EXP_LINEAR + Math.pow(level, POOL_EXP_POW_EXP) * POOL_EXP_POW_COEFF)
  const mul = TIER_EXP_MUL[tier] || 1.0
  return Math.floor(base * mul)
}

// ===== 星级系统 =====

const FRAGMENT_TO_EXP = POOL_FRAGMENT_TO_EXP

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
  const lvBonus = tier === 'T3' ? Math.floor(poolPet.level * POOL_T3_LV_BONUS_RATE) : poolPet.level
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  return Math.floor((baseAtk + lvBonus) * starMul)
}

// ===== 入池默认值 =====

const ENTRY_LEVEL = POOL_ENTRY_LEVEL
const ENTRY_FRAGMENTS = POOL_ENTRY_FRAGMENTS

// ===== 肉鸽局结算宠物经验 =====

/**
 * 肉鸽结算宠物经验公式
 * 独立于修炼经验，按消除/连击/击杀/层数计算
 * @param {object} expDetail - { elimExp, comboExp, killExp }
 * @param {number} floor - 最终到达层数
 * @param {boolean} cleared - 是否通关
 */
function calcRoguelikePetExp(expDetail, floor, cleared) {
  const rawExp = (expDetail.elimExp || 0) + (expDetail.comboExp || 0) + (expDetail.killExp || 0)
  const baseFromCombat = Math.floor(rawExp * POOL_ROGUE_EXP_RATIO)
  const floorBonus = floor * POOL_ROGUE_FLOOR_BONUS
  const clearBonus = cleared ? POOL_ROGUE_CLEAR_BONUS : 0
  return baseFromCombat + floorBonus + clearBonus
}

// ===== 灵宠派遣（挂机）系统 =====

// 派遣常量从 constants.js 导入

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
  const petExp = Math.floor(hours * IDLE_PET_EXP_PER_HOUR * (1 + petLevel * IDLE_PET_LV_EXP_FACTOR))
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
