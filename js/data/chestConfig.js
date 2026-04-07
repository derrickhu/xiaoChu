/**
 * 召唤与碎片随机分配工具
 * 数值定义已迁移至 balance/economy.js
 */

const { PET_RARITY, getPetRarity } = require('./pets')
const { SUMMON_FRAG_COST, DEFAULT_RANDOM_FRAG_WEIGHTS } = require('./balance/economy')

/**
 * 按 rarityWeights 随机选一只宠物，集中分配碎片
 * @param {object} [rarityWeights] - { R: 80, SR: 20, SSR: 0 }；缺省则用 {@link DEFAULT_RANDOM_FRAG_WEIGHTS}
 * @returns {string} petId
 */
function rollPetByRarity(rarityWeights) {
  const w = rarityWeights && typeof rarityWeights === 'object'
    ? rarityWeights
    : DEFAULT_RANDOM_FRAG_WEIGHTS
  const totalW = (w.R || 0) + (w.SR || 0) + (w.SSR || 0)
  if (totalW <= 0) return PET_RARITY.R[0]
  let roll = Math.random() * totalW
  let rarity = 'R'
  if (roll < (w.SSR || 0)) rarity = 'SSR'
  else if (roll < (w.SSR || 0) + (w.SR || 0)) rarity = 'SR'

  const candidates = PET_RARITY[rarity]
  if (!candidates || candidates.length === 0) return PET_RARITY.R[0]
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * 从指定稀有度中随机选一只未拥有的宠物
 * @returns {string|null} petId or null if all owned
 */
function rollUnownedPet(storage, rarity) {
  const pool = (storage._d ? storage._d.petPool : storage.petPool) || []
  const ownedIds = new Set(pool.map(p => p.id))
  const candidates = (PET_RARITY[rarity] || []).filter(id => !ownedIds.has(id))
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

module.exports = {
  SUMMON_FRAG_COST,
  DEFAULT_RANDOM_FRAG_WEIGHTS,
  rollPetByRarity,
  rollUnownedPet,
}
