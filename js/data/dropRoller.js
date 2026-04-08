/**
 * Roguelike 随机掉落 — 灵宠 & 法宝
 * 根据章节/难度/Boss 状态实时 roll 品质，再从对应品质池随机取一只/件
 */

const {
  PET_DROP_WEIGHTS, WPN_DROP_WEIGHTS,
  ELITE_RARITY_BONUS, BOSS_RARITY_BONUS,
  FIRST_CLEAR_FRAG_COUNT,
} = require('./balance/stage')
const { getPetRarity, isReservedPet, getAllPets } = require('./pets')
const { getWeaponsByRarity, TOWER_ONLY_WEAPONS } = require('./weapons')

// ===== 内部工具 =====

function _applyBonus(base, difficulty, isBoss) {
  const w = { R: base.R || 0, SR: base.SR || 0, SSR: base.SSR || 0 }
  if (difficulty === 'elite') {
    w.SR  += ELITE_RARITY_BONUS.SR
    w.SSR += ELITE_RARITY_BONUS.SSR
  }
  if (isBoss) {
    w.SR  += BOSS_RARITY_BONUS.SR
    w.SSR += BOSS_RARITY_BONUS.SSR
  }
  return w
}

function _rollRarity(weights) {
  const total = weights.R + weights.SR + weights.SSR
  if (total <= 0) return 'R'
  const r = Math.random() * total
  if (r < weights.SSR) return 'SSR'
  if (r < weights.SSR + weights.SR) return 'SR'
  return 'R'
}

// 缓存宠物按品质分池（排除通天塔预留）
let _petPoolCache = null
function _getPetPools() {
  if (_petPoolCache) return _petPoolCache
  const all = getAllPets().filter(p => !isReservedPet(p.id))
  _petPoolCache = { R: [], SR: [], SSR: [] }
  for (const p of all) {
    const r = getPetRarity(p.id)
    if (_petPoolCache[r]) _petPoolCache[r].push(p.id)
  }
  return _petPoolCache
}

// 缓存法宝按品质分池（排除通天塔专属）
let _wpnPoolCache = null
function _getWpnPools() {
  if (_wpnPoolCache) return _wpnPoolCache
  _wpnPoolCache = { R: [], SR: [], SSR: [] }
  for (const r of ['R', 'SR', 'SSR']) {
    _wpnPoolCache[r] = getWeaponsByRarity(r)
      .filter(w => !TOWER_ONLY_WEAPONS.includes(w.id))
      .map(w => w.id)
  }
  return _wpnPoolCache
}

// ===== 对外接口 =====

/**
 * 随机 roll 一只灵宠（返回 { petId, rarity }）
 */
function rollRandomPet(chapter, order, difficulty) {
  const isBoss = order === 8
  const base = PET_DROP_WEIGHTS[chapter] || PET_DROP_WEIGHTS[1]
  const weights = _applyBonus(base, difficulty, isBoss)
  const rarity = _rollRarity(weights)

  const pools = _getPetPools()
  let pool = pools[rarity]
  if (!pool || pool.length === 0) pool = pools.R
  const petId = pool[Math.floor(Math.random() * pool.length)]
  return { petId, rarity }
}

/**
 * 随机 roll 一件法宝（返回 { weaponId, rarity }）
 */
function rollRandomWeapon(chapter, order, difficulty) {
  const isBoss = order === 8
  const base = WPN_DROP_WEIGHTS[chapter] || WPN_DROP_WEIGHTS[1]
  const weights = _applyBonus(base, difficulty, isBoss)
  const rarity = _rollRarity(weights)

  const pools = _getWpnPools()
  let pool = pools[rarity]
  if (!pool || pool.length === 0) pool = pools.R
  const weaponId = pool[Math.floor(Math.random() * pool.length)]
  return { weaponId, rarity }
}

/**
 * 获取指定章节/难度下可能出现的最高品质（用于 UI 定性展示）
 * @param {'pet'|'weapon'} type
 */
function getMaxDropRarity(chapter, difficulty, type) {
  const table = type === 'weapon' ? WPN_DROP_WEIGHTS : PET_DROP_WEIGHTS
  const base = table[chapter] || table[1]
  const weights = _applyBonus(base, difficulty, false)
  if (weights.SSR > 0) return 'SSR'
  if (weights.SR > 0) return 'SR'
  return 'R'
}

module.exports = {
  rollRandomPet,
  rollRandomWeapon,
  getMaxDropRarity,
  FIRST_CLEAR_FRAG_COUNT,
}
