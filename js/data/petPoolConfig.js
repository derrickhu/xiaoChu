/**
 * 灵宠池配置 — 独立培养体系
 * 
 * 核心设计：
 * - 共享灵石池：肉鸽和固定关卡都产出灵石，玩家自主分配
 * - 按品质差异化升级成本：R 便宜易练，SSR 昂贵但强
 * - 碎片分解：不需要的碎片可转化为灵石
 * - 独立于肉鸽内★1→★3的简化升星，这里是长期局外养成
 */

const { getPetRarity, getPetById, MAX_STAR } = require('./pets')
const {
  POOL_MAX_LV,
  POOL_ADV_MAX_LV,
  POOL_RARITY_EXP_MUL,
  POOL_EXP_BASE,
  POOL_EXP_LINEAR,
  POOL_EXP_POW_EXP,
  POOL_EXP_POW_COEFF,
  POOL_STAR_FRAG_COST,
  POOL_STAR_LV_REQ,
  POOL_STAR_ATK_MUL,
  POOL_STAR_AWAKEN_COST,
  POOL_STAR_LV_CAP,
  POOL_FRAGMENT_TO_EXP,
  POOL_ENTRY_LEVEL,
  POOL_ENTRY_FRAGMENTS,
  POOL_R_LV_BONUS_RATE,
} = require('./constants')
const { ROGUE_SETTLE, IDLE_CFG } = require('./economyConfig')

// ===== 等级系统 =====

const RARITY_EXP_MUL = POOL_RARITY_EXP_MUL

/**
 * 灵宠升级所需经验（受品质影响）
 * @param {number} level - 当前等级
 * @param {string} rarity - 宠物品质 'R'|'SR'|'SSR'
 */
function petExpToNextLevel(level, rarity) {
  const base = Math.floor(POOL_EXP_BASE + level * POOL_EXP_LINEAR + Math.pow(level, POOL_EXP_POW_EXP) * POOL_EXP_POW_COEFF)
  const mul = RARITY_EXP_MUL[rarity] || 1.0
  return Math.floor(base * mul)
}

// ===== 星级系统 =====

const FRAGMENT_TO_EXP = POOL_FRAGMENT_TO_EXP

// ===== 攻击力计算 =====

/**
 * 灵宠池中宠物的攻击力（仅用于固定关卡）
 * @param {object} poolPet - 灵宠池中的宠物记录 { id, level, star, attr, ... }
 * @param {object} [dexBuffs] - 图鉴里程碑加成 { all: {atkPct}, metal: {atkPct}, ... }
 */
function getPoolPetAtk(poolPet, dexBuffs) {
  const basePet = getPetById(poolPet.id)
  if (!basePet) return 0
  const baseAtk = basePet.atk
  const rarity = getPetRarity(poolPet.id)
  const lvBonus = rarity === 'R' ? Math.floor(poolPet.level * POOL_R_LV_BONUS_RATE) : poolPet.level
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  const rawAtk = Math.floor((baseAtk + lvBonus) * starMul)
  if (!dexBuffs) return rawAtk
  const attr = poolPet.attr || (basePet && basePet.attr)
  const atkPct = (dexBuffs.all && dexBuffs.all.atkPct || 0) + (attr && dexBuffs[attr] && dexBuffs[attr].atkPct || 0)
  if (atkPct <= 0) return rawAtk
  return Math.floor(rawAtk * (1 + atkPct / 100))
}

/**
 * 获取灵宠池宠物当前等级上限（根据星级和来源）
 * ★4 → 50, ★5 → 60, 其余 → 40（stage来源可达60）
 */
function getPoolPetMaxLv(poolPet) {
  const starCap = POOL_STAR_LV_CAP[poolPet.star || 1] || POOL_MAX_LV
  const sourceCap = poolPet.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
  return Math.max(starCap, sourceCap)
}

/**
 * 灵宠池可升最高星级（须与 storage.upgradePoolPetStar 一致）
 * 仅标记为 roguelike 入池的维持 ★3；秘境/召唤/活动/教学等可走满 ★5
 */
function getPoolPetMaxStar(poolPet) {
  if (!poolPet) return MAX_STAR
  return poolPet.source === 'roguelike' ? 3 : MAX_STAR
}

// ===== 入池默认值 =====

const ENTRY_LEVEL = POOL_ENTRY_LEVEL
const ENTRY_FRAGMENTS = POOL_ENTRY_FRAGMENTS

// ===== 肉鸽局结算灵石 @deprecated 未实际调用，保留备用 =====

/** @deprecated 通天塔结算已改用 TOWER_SETTLE，此函数未被调用 */
function calcRoguelikeSoulStone(expDetail, floor, cleared) {
  const rawExp = (expDetail.elimExp || 0) + (expDetail.comboExp || 0) + (expDetail.killExp || 0)
  const baseFromCombat = Math.floor(rawExp * ROGUE_SETTLE.combatExpRatio)
  const floorBonus = floor * ROGUE_SETTLE.floorBonus
  const clearBonus = cleared ? ROGUE_SETTLE.clearBonus : 0
  return baseFromCombat + floorBonus + clearBonus
}

// ===== 灵宠派遣（挂机）系统 =====

// 派遣常量从 constants.js 导入

/**
 * 计算派遣产出
 * @param {number} elapsedMs - 经过时间（毫秒）
 * @param {number} petLevel  - 宠物等级（影响经验产出）
 * @returns {{ fragments: number, soulStone: number }}
 */
function calcIdleReward(elapsedMs, petLevel) {
  const capped = Math.min(elapsedMs, IDLE_CFG.maxAccumulateMs)
  const fragments = Math.floor(capped / IDLE_CFG.fragIntervalMs)
  const hours = capped / (3600 * 1000)
  const soulStone = Math.floor(hours * IDLE_CFG.soulStonePerHour * (1 + petLevel * IDLE_CFG.petLvExpFactor))
  return { fragments, soulStone }
}

/**
 * 判断灵宠是否可升级（灵石足够升至少 1 级）
 */
function canLevelUp(poolPet, soulStone) {
  if (!poolPet) return false
  const maxLv = getPoolPetMaxLv(poolPet)
  if (poolPet.level >= maxLv) return false
  const rarity = getPetRarity(poolPet.id)
  return soulStone >= petExpToNextLevel(poolPet.level, rarity)
}

/**
 * 判断灵宠是否可升星（碎片、等级、觉醒石全部满足）
 */
function canStarUp(poolPet, awakenStone) {
  if (!poolPet) return false
  const nextStar = (poolPet.star || 1) + 1
  const maxStar = getPoolPetMaxStar(poolPet)
  if (nextStar > maxStar) return false
  const fragCost = POOL_STAR_FRAG_COST[nextStar]
  const lvReq = POOL_STAR_LV_REQ[nextStar]
  if (!fragCost || !lvReq) return false
  if (poolPet.fragments < fragCost || poolPet.level < lvReq) return false
  const awakenCost = (nextStar >= 4 && POOL_STAR_AWAKEN_COST[nextStar]) || 0
  return awakenCost === 0 || (awakenStone || 0) >= awakenCost
}

module.exports = {
  POOL_MAX_LV,
  POOL_ADV_MAX_LV,
  RARITY_EXP_MUL,
  TIER_EXP_MUL: RARITY_EXP_MUL,
  petExpToNextLevel,
  POOL_STAR_FRAG_COST,
  POOL_STAR_LV_REQ,
  POOL_STAR_ATK_MUL,
  POOL_STAR_AWAKEN_COST,
  POOL_STAR_LV_CAP,
  FRAGMENT_TO_EXP,
  getPoolPetAtk,
  getPoolPetMaxLv,
  getPoolPetMaxStar,
  canLevelUp,
  canStarUp,
  ENTRY_LEVEL,
  ENTRY_FRAGMENTS,
  calcRoguelikeSoulStone,
  IDLE_MAX_SLOTS: IDLE_CFG.maxSlots,
  IDLE_FRAG_INTERVAL: IDLE_CFG.fragIntervalMs,
  IDLE_MAX_ACCUMULATE: IDLE_CFG.maxAccumulateMs,
  IDLE_PET_EXP_PER_HOUR: IDLE_CFG.soulStonePerHour,
  calcIdleReward,
}
