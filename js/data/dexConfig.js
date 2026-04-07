/**
 * 灵兽图鉴配置 — 三层收集 + 里程碑永久加成 + IAA预埋
 *
 * 三层收集：发现(入池) → 收录(★3) → 精通(★5/MAX_STAR)
 * 里程碑：属性/总量/稀有度 三维度永久加成
 */

const { PETS, PET_RARITY, MAX_STAR, getPetRarity } = require('./pets')
const { DEX_ELEM_MILESTONE_BUFFS, DEX_RARITY_MILESTONE_BUFFS } = require('./balance/economy')

const DEX_COLLECT_STAR = 3
const DEX_ATTRS = ['metal', 'wood', 'water', 'fire', 'earth']
const DEX_ATTR_LABEL = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }

const TOTAL_PET_COUNT = DEX_ATTRS.reduce((s, a) => s + PETS[a].length, 0)

// ===== 属性里程碑（5属性 × 4档 = 20个）=====
function _buildElemMilestones() {
  const ms = []
  for (const attr of DEX_ATTRS) {
    const label = DEX_ATTR_LABEL[attr]
    const total = PETS[attr].length
    const b = DEX_ELEM_MILESTONE_BUFFS
    ms.push(
      { id: `elem_${attr}_5`,  attr, tier: 'discovered', need: 5,           buff: { scope: attr, ...b.discovered5 },     desc: `${label}属性5只发现 → ${label}宠ATK+${b.discovered5.atkPct}%` },
      { id: `elem_${attr}_10`, attr, tier: 'discovered', need: 10,          buff: { scope: attr, ...b.discovered10 },    desc: `${label}属性10只发现 → ${label}宠HP+${b.discovered10.hpPct}%` },
      { id: `elem_${attr}_15`, attr, tier: 'collected',  need: 15,          buff: { scope: attr, ...b.collected15 },     desc: `${label}属性15只收录 → ${label}宠ATK+${b.collected15.atkPct}%` },
      { id: `elem_${attr}_20`, attr, tier: 'mastered',   need: total,       buff: { scope: attr, ...b.masteredAll },     desc: `${label}属性${total}只精通 → ${label}宠ATK+${b.masteredAll.atkPct}% HP+${b.masteredAll.hpPct}%` },
    )
  }
  return ms
}

// ===== 总量里程碑（6档）=====
const TOTAL_MILESTONES = [
  { id: 'total_10',  tier: 'discovered', need: 10,  reward: { soulStone: 300 },                               desc: '10只发现 → 300灵石' },
  { id: 'total_25',  tier: 'discovered', need: 25,  reward: { soulStone: 500, awakenStone: 1 },               desc: '25只发现 → 500灵石+1觉醒石' },
  { id: 'total_40',  tier: 'collected',  need: 40,  reward: { soulStone: 1000, awakenStone: 3 },              desc: '40只收录 → 1000灵石+3觉醒石' },
  { id: 'total_60',  tier: 'collected',  need: 60,  reward: { soulStone: 2000, awakenStone: 5 },              desc: '60只收录 → 2000灵石+5觉醒石' },
  { id: 'total_80',  tier: 'collected',  need: 80,  reward: { soulStone: 3000, awakenStone: 8 },              desc: '80只收录 → 3000灵石+8觉醒石' },
  { id: 'total_100', tier: 'mastered',   need: 100, reward: { soulStone: 5000, awakenStone: 15 },             desc: '100只精通 → 5000灵石+15觉醒石' },
]

// ===== 稀有度里程碑（3档）=====
const RARITY_MILESTONES = [
  { id: 'rarity_R',   rarity: 'R',   tier: 'collected', need: PET_RARITY.R.length,   buff: { scope: 'all', ...DEX_RARITY_MILESTONE_BUFFS.R },   desc: `全R收录(${PET_RARITY.R.length}只★3) → 全队DEF+${DEX_RARITY_MILESTONE_BUFFS.R.defPct}%` },
  { id: 'rarity_SR',  rarity: 'SR',  tier: 'collected', need: PET_RARITY.SR.length,  buff: { scope: 'all', ...DEX_RARITY_MILESTONE_BUFFS.SR },  desc: `全SR收录(${PET_RARITY.SR.length}只★3) → 全队HP+${DEX_RARITY_MILESTONE_BUFFS.SR.hpPct}%` },
  { id: 'rarity_SSR', rarity: 'SSR', tier: 'collected', need: PET_RARITY.SSR.length, buff: { scope: 'all', ...DEX_RARITY_MILESTONE_BUFFS.SSR }, desc: `全SSR收录(${PET_RARITY.SSR.length}只★3) → 全队ATK+${DEX_RARITY_MILESTONE_BUFFS.SSR.atkPct}%` },
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
  const discovered = []
  const collected = []
  const mastered = []
  for (const p of pool) {
    discovered.push(p.id)
    if ((p.star || 1) >= DEX_COLLECT_STAR) collected.push(p.id)
    if ((p.star || 1) >= MAX_STAR) mastered.push(p.id)
  }
  return { discovered, collected, mastered }
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
 * 计算已领取里程碑带来的永久属性加成
 * @returns {{ all: {atkPct,hpPct,defPct}, metal: {...}, ... }}
 */
function getDexBuffs(claimedIds) {
  const claimed = new Set(claimedIds || [])
  const buffs = {
    all:   { atkPct: 0, hpPct: 0, defPct: 0 },
    metal: { atkPct: 0, hpPct: 0, defPct: 0 },
    wood:  { atkPct: 0, hpPct: 0, defPct: 0 },
    water: { atkPct: 0, hpPct: 0, defPct: 0 },
    fire:  { atkPct: 0, hpPct: 0, defPct: 0 },
    earth: { atkPct: 0, hpPct: 0, defPct: 0 },
  }

  for (const m of ALL_MILESTONES) {
    if (!claimed.has(m.id) || !m.buff) continue
    const scope = m.buff.scope || 'all'
    const target = buffs[scope] || buffs.all
    if (m.buff.atkPct) target.atkPct += m.buff.atkPct
    if (m.buff.hpPct)  target.hpPct  += m.buff.hpPct
    if (m.buff.defPct) target.defPct += m.buff.defPct
  }

  return buffs
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
