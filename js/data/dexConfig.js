/**
 * 灵兽图鉴配置 — 三层收集 + 里程碑资源奖励 + IAA预埋
 *
 * 三层收集：发现(入池) → 收录(★3) → 精通(★5/MAX_STAR)
 * 里程碑：属性/总量/稀有度 三维度资源奖励
 */

const { PETS, PET_RARITY, MAX_STAR, getPetRarity } = require('./pets')
const {
  DEX_COLLECT_STAR,
  DEX_ELEM_MILESTONE_NEEDS,
  DEX_ELEM_MILESTONE_REWARDS,
  DEX_TOTAL_MILESTONES: _DEX_TOTAL_MS,
  DEX_RARITY_MILESTONE_REWARDS,
} = require('./balance/dex')
const DEX_ATTRS = ['metal', 'wood', 'water', 'fire', 'earth']
const DEX_ATTR_LABEL = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }

const TOTAL_PET_COUNT = DEX_ATTRS.reduce((s, a) => s + PETS[a].length, 0)

// ===== 属性里程碑（5属性 × 4档 = 20个）=====
function _buildElemMilestones() {
  const ms = []
  for (const attr of DEX_ATTRS) {
    const label = DEX_ATTR_LABEL[attr]
    const total = PETS[attr].length
    const r = DEX_ELEM_MILESTONE_REWARDS
    const needs = DEX_ELEM_MILESTONE_NEEDS
    ms.push(
      { id: `elem_${attr}_5`,  attr, tier: 'discovered', need: needs[0], reward: { ...r.discovered5 },  desc: `${label}属性${needs[0]}只发现 → 灵石×${r.discovered5.soulStone}` },
      { id: `elem_${attr}_10`, attr, tier: 'discovered', need: needs[1], reward: { ...r.discovered10 }, desc: `${label}属性${needs[1]}只发现 → 灵石×${r.discovered10.soulStone}` },
      { id: `elem_${attr}_15`, attr, tier: 'collected',  need: needs[2], reward: { ...r.collected15 },  desc: `${label}属性${needs[2]}只收录 → 灵石×${r.collected15.soulStone}` },
      { id: `elem_${attr}_20`, attr, tier: 'mastered',   need: total,    reward: { ...r.masteredAll },  desc: `${label}属性${total}只精通 → 灵石×${r.masteredAll.soulStone}` },
    )
  }
  return ms
}

// ===== 总量里程碑（从 balance/dex.js 读取数值）=====
const TOTAL_MILESTONES = _DEX_TOTAL_MS.map(m => {
  const rDesc = Object.entries(m.reward).map(([k, v]) => {
    const label = { soulStone: '灵石', awakenStone: '觉醒石' }[k] || k
    return `${v}${label}`
  }).join('+')
  const tierLabel = { discovered: '发现', collected: '收录', mastered: '精通' }[m.tier] || m.tier
  return {
    id: `total_${m.need}`,
    tier: m.tier,
    need: m.need,
    reward: { ...m.reward },
    desc: `${m.need}只${tierLabel} → ${rDesc}`,
  }
})

// ===== 稀有度里程碑（3档）=====
const RARITY_MILESTONES = [
  { id: 'rarity_R',   rarity: 'R',   tier: 'collected', need: PET_RARITY.R.length,   reward: { ...DEX_RARITY_MILESTONE_REWARDS.R },   adDouble: false, desc: `全R收录(${PET_RARITY.R.length}只★3) → 万能碎片×${DEX_RARITY_MILESTONE_REWARDS.R.universalFragment}` },
  { id: 'rarity_SR',  rarity: 'SR',  tier: 'collected', need: PET_RARITY.SR.length,  reward: { ...DEX_RARITY_MILESTONE_REWARDS.SR },  adDouble: false, desc: `全SR收录(${PET_RARITY.SR.length}只★3) → 万能碎片×${DEX_RARITY_MILESTONE_REWARDS.SR.universalFragment}+觉醒石×${DEX_RARITY_MILESTONE_REWARDS.SR.awakenStone}` },
  { id: 'rarity_SSR', rarity: 'SSR', tier: 'collected', need: PET_RARITY.SSR.length, reward: { ...DEX_RARITY_MILESTONE_REWARDS.SSR }, adDouble: false, desc: `全SSR收录(${PET_RARITY.SSR.length}只★3) → 万能碎片×${DEX_RARITY_MILESTONE_REWARDS.SSR.universalFragment}+觉醒石×${DEX_RARITY_MILESTONE_REWARDS.SSR.awakenStone}` },
]

const ELEM_MILESTONES = _buildElemMilestones()
const ALL_MILESTONES = [...ELEM_MILESTONES, ...TOTAL_MILESTONES, ...RARITY_MILESTONES]

// ===== IAA 广告位枚举 =====
const DEX_AD_SLOTS = {
  MILESTONE_DOUBLE: 'dex_milestone_double',
  ACQUIRE_HINT:     'dex_acquire_hint',
  FRAG_BOOST:       'dex_frag_boost',
}

// ===== 收集进度计算 =====

/**
 * 从 petPool 派生三层收集状态
 * @param {Array} petPool - storage.petPool
 * @returns {{ discovered: string[], collected: string[], mastered: string[] }}
 */
function getDexProgress(petPool) {
  const pool = petPool || []
  const discovered = new Set()
  const collected = new Set()
  const mastered = new Set()
  for (const p of pool) {
    const id = p.id
    if (!id) continue
    discovered.add(id)
    if ((p.star || 1) >= DEX_COLLECT_STAR) collected.add(id)
    if ((p.star || 1) >= MAX_STAR) mastered.add(id)
  }
  return {
    discovered: [...discovered],
    collected: [...collected],
    mastered: [...mastered],
  }
}

/**
 * 按属性统计三层数量
 */
function getDexProgressByAttr(petPool) {
  const progress = getDexProgress(petPool)
  const result = {}
  for (const attr of DEX_ATTRS) {
    const attrIds = new Set(PETS[attr].map(p => p.id))
    result[attr] = {
      discovered: progress.discovered.filter(id => attrIds.has(id)).length,
      collected:  progress.collected.filter(id => attrIds.has(id)).length,
      mastered:   progress.mastered.filter(id => attrIds.has(id)).length,
      total:      PETS[attr].length,
    }
  }
  return result
}

/**
 * 按稀有度统计收录数量
 */
function getDexProgressByRarity(petPool) {
  const progress = getDexProgress(petPool)
  const collectedSet = new Set(progress.collected)
  return {
    R:   PET_RARITY.R.filter(id => collectedSet.has(id)).length,
    SR:  PET_RARITY.SR.filter(id => collectedSet.has(id)).length,
    SSR: PET_RARITY.SSR.filter(id => collectedSet.has(id)).length,
  }
}

/**
 * 检查里程碑是否已达成
 */
function isMilestoneReached(milestone, petPool) {
  const progress = getDexProgress(petPool)

  if (milestone.attr) {
    const attrIds = new Set(PETS[milestone.attr].map(p => p.id))
    const tierList = progress[milestone.tier] || []
    return tierList.filter(id => attrIds.has(id)).length >= milestone.need
  }

  if (milestone.rarity) {
    const rarityIds = new Set(PET_RARITY[milestone.rarity])
    const tierList = progress[milestone.tier] || []
    return tierList.filter(id => rarityIds.has(id)).length >= milestone.need
  }

  const tierList = progress[milestone.tier] || []
  return tierList.length >= milestone.need
}

/**
 * 获取所有可领取但未领取的里程碑
 */
function getClaimableMilestones(petPool, claimedIds) {
  const claimed = new Set(claimedIds || [])
  return ALL_MILESTONES.filter(m => !claimed.has(m.id) && isMilestoneReached(m, petPool))
}

/**
 * 图鉴里程碑已不再提供隐藏永久属性加成。
 * 保留空结构用于兼容既有 getPoolPetAtk 调用链。
 * @returns {{ all: {atkPct,hpPct,defPct}, metal: {...}, ... }}
 */
function getDexBuffs(claimedIds) {
  void claimedIds
  return {
    all:   { atkPct: 0, hpPct: 0, defPct: 0 },
    metal: { atkPct: 0, hpPct: 0, defPct: 0 },
    wood:  { atkPct: 0, hpPct: 0, defPct: 0 },
    water: { atkPct: 0, hpPct: 0, defPct: 0 },
    fire:  { atkPct: 0, hpPct: 0, defPct: 0 },
    earth: { atkPct: 0, hpPct: 0, defPct: 0 },
  }
}

/**
 * 判定宠物的图鉴层级
 * @returns {'mastered'|'collected'|'discovered'|'unknown'}
 */
function getPetDexTier(petId, petPool) {
  const pp = (petPool || []).find(p => p.id === petId)
  if (!pp) return 'unknown'
  if ((pp.star || 1) >= MAX_STAR) return 'mastered'
  if ((pp.star || 1) >= DEX_COLLECT_STAR) return 'collected'
  return 'discovered'
}

/**
 * 是否有未领取的里程碑（用于红点提示）
 */
function hasUnclaimedMilestones(petPool, claimedIds) {
  return getClaimableMilestones(petPool, claimedIds).length > 0
}

module.exports = {
  DEX_COLLECT_STAR,
  DEX_ATTRS,
  DEX_ATTR_LABEL,
  TOTAL_PET_COUNT,
  ELEM_MILESTONES,
  TOTAL_MILESTONES,
  RARITY_MILESTONES,
  ALL_MILESTONES,
  DEX_AD_SLOTS,
  getDexProgress,
  getDexProgressByAttr,
  getDexProgressByRarity,
  isMilestoneReached,
  getClaimableMilestones,
  getDexBuffs,
  getPetDexTier,
  hasUnclaimedMilestones,
}
