/**
 * 宝箱里程碑奖励配置
 *
 * 每条里程碑包含：
 *  - id: 唯一标识
 *  - type: 条件类型 (level / bestFloor / totalRuns / petPoolCount)
 *  - threshold: 达成阈值
 *  - name: 显示名称
 *  - rewards[]: 可扩展奖励数组
 *
 * 奖励 type:
 *  - fragment: 碎片（按 tierWeights 随机分配给某只宠物）
 *  - pet:      直送宠物入池（从指定档位未拥有宠物中随机选）
 *  - exp:      修炼经验
 *  - petExp:   宠物经验（共享池）
 *  - stamina:  体力
 *  - item:     道具（预留）
 */

const { PET_TIER, getPetTier } = require('./pets')

// 碎片召唤费用（按档位）
const SUMMON_FRAG_COST = { T3: 10, T2: 15, T1: 25 }

// ===== 里程碑定义 =====

const CHEST_MILESTONES = [
  // ── 修炼等级（Lv1-10 每级，之后每5级）──
  { id: 'lv_1',  type: 'level', threshold: 1,  name: '修炼 Lv.1',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 90, T2: 10, T1: 0 } },
      { type: 'petExp', amount: 80 },
    ]},
  { id: 'lv_2',  type: 'level', threshold: 2,  name: '修炼 Lv.2',
    rewards: [
      { type: 'fragment', count: 6,  tierWeights: { T3: 85, T2: 15, T1: 0 } },
      { type: 'petExp', amount: 60 },
    ]},
  { id: 'lv_3',  type: 'level', threshold: 3,  name: '修炼 Lv.3',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 85, T2: 15, T1: 0 } },
      { type: 'petExp', amount: 100 },
    ]},
  { id: 'lv_4',  type: 'level', threshold: 4,  name: '修炼 Lv.4',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 80, T2: 20, T1: 0 } },
      { type: 'petExp', amount: 80 },
    ]},
  { id: 'lv_5',  type: 'level', threshold: 5,  name: '练气期突破',
    rewards: [
      { type: 'fragment', count: 10, tierWeights: { T3: 75, T2: 25, T1: 0 } },
      { type: 'petExp', amount: 150 },
      { type: 'stamina', amount: 30 },
    ]},
  { id: 'lv_6',  type: 'level', threshold: 6,  name: '修炼 Lv.6',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 70, T2: 30, T1: 0 } },
      { type: 'petExp', amount: 100 },
    ]},
  { id: 'lv_7',  type: 'level', threshold: 7,  name: '修炼 Lv.7',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 65, T2: 30, T1: 5 } },
      { type: 'petExp', amount: 120 },
    ]},
  { id: 'lv_8',  type: 'level', threshold: 8,  name: '修炼 Lv.8',
    rewards: [
      { type: 'fragment', count: 10, tierWeights: { T3: 60, T2: 35, T1: 5 } },
      { type: 'petExp', amount: 150 },
    ]},
  { id: 'lv_9',  type: 'level', threshold: 9,  name: '修炼 Lv.9',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 55, T2: 35, T1: 10 } },
      { type: 'petExp', amount: 120 },
    ]},
  { id: 'lv_10', type: 'level', threshold: 10, name: '修炼 Lv.10',
    rewards: [
      { type: 'fragment', count: 12, tierWeights: { T3: 50, T2: 40, T1: 10 } },
      { type: 'petExp', amount: 200 },
      { type: 'pet', tier: 'T3' },
    ]},
  { id: 'lv_15', type: 'level', threshold: 15, name: '筑基期突破',
    rewards: [
      { type: 'fragment', count: 15, tierWeights: { T3: 40, T2: 45, T1: 15 } },
      { type: 'petExp', amount: 300 },
      { type: 'stamina', amount: 50 },
    ]},
  { id: 'lv_20', type: 'level', threshold: 20, name: '修炼 Lv.20',
    rewards: [
      { type: 'fragment', count: 18, tierWeights: { T3: 30, T2: 50, T1: 20 } },
      { type: 'petExp', amount: 400 },
    ]},
  { id: 'lv_25', type: 'level', threshold: 25, name: '修炼 Lv.25',
    rewards: [
      { type: 'fragment', count: 20, tierWeights: { T3: 20, T2: 50, T1: 30 } },
      { type: 'petExp', amount: 600 },
    ]},
  { id: 'lv_30', type: 'level', threshold: 30, name: '金丹期突破',
    rewards: [
      { type: 'fragment', count: 25, tierWeights: { T3: 10, T2: 50, T1: 40 } },
      { type: 'petExp', amount: 800 },
      { type: 'stamina', amount: 50 },
      { type: 'pet', tier: 'T2' },
    ]},
  { id: 'lv_35', type: 'level', threshold: 35, name: '修炼 Lv.35',
    rewards: [
      { type: 'fragment', count: 22, tierWeights: { T3: 10, T2: 45, T1: 45 } },
      { type: 'petExp', amount: 800 },
    ]},
  { id: 'lv_40', type: 'level', threshold: 40, name: '修炼 Lv.40',
    rewards: [
      { type: 'fragment', count: 25, tierWeights: { T3: 5, T2: 40, T1: 55 } },
      { type: 'petExp', amount: 1000 },
    ]},
  { id: 'lv_45', type: 'level', threshold: 45, name: '元婴期突破',
    rewards: [
      { type: 'fragment', count: 30, tierWeights: { T3: 0, T2: 35, T1: 65 } },
      { type: 'petExp', amount: 1500 },
      { type: 'stamina', amount: 50 },
    ]},
  { id: 'lv_50', type: 'level', threshold: 50, name: '修炼 Lv.50',
    rewards: [
      { type: 'fragment', count: 30, tierWeights: { T3: 0, T2: 30, T1: 70 } },
      { type: 'petExp', amount: 1500 },
    ]},
  { id: 'lv_55', type: 'level', threshold: 55, name: '修炼 Lv.55',
    rewards: [
      { type: 'fragment', count: 35, tierWeights: { T3: 0, T2: 25, T1: 75 } },
      { type: 'petExp', amount: 2000 },
    ]},
  { id: 'lv_58', type: 'level', threshold: 58, name: '化神期突破',
    rewards: [
      { type: 'fragment', count: 40, tierWeights: { T3: 0, T2: 20, T1: 80 } },
      { type: 'petExp', amount: 2500 },
      { type: 'pet', tier: 'T1' },
    ]},
  { id: 'lv_60', type: 'level', threshold: 60, name: '修炼圆满',
    rewards: [
      { type: 'fragment', count: 50, tierWeights: { T3: 0, T2: 15, T1: 85 } },
      { type: 'petExp', amount: 3000 },
      { type: 'stamina', amount: 100 },
    ]},

  // ── 肉鸽塔层数 ──
  { id: 'tower_5',  type: 'bestFloor', threshold: 5,  name: '通天塔 5 层',
    rewards: [
      { type: 'fragment', count: 6,  tierWeights: { T3: 90, T2: 10, T1: 0 } },
      { type: 'petExp', amount: 60 },
    ]},
  { id: 'tower_10', type: 'bestFloor', threshold: 10, name: '通天塔 10 层',
    rewards: [
      { type: 'fragment', count: 10, tierWeights: { T3: 70, T2: 25, T1: 5 } },
      { type: 'petExp', amount: 150 },
    ]},
  { id: 'tower_15', type: 'bestFloor', threshold: 15, name: '通天塔 15 层',
    rewards: [
      { type: 'fragment', count: 12, tierWeights: { T3: 50, T2: 35, T1: 15 } },
      { type: 'petExp', amount: 200 },
    ]},
  { id: 'tower_20', type: 'bestFloor', threshold: 20, name: '通天塔 20 层',
    rewards: [
      { type: 'fragment', count: 18, tierWeights: { T3: 30, T2: 45, T1: 25 } },
      { type: 'petExp', amount: 400 },
    ]},
  { id: 'tower_25', type: 'bestFloor', threshold: 25, name: '通天塔 25 层',
    rewards: [
      { type: 'fragment', count: 20, tierWeights: { T3: 15, T2: 45, T1: 40 } },
      { type: 'petExp', amount: 500 },
    ]},
  { id: 'tower_30', type: 'bestFloor', threshold: 30, name: '通天塔登顶',
    rewards: [
      { type: 'fragment', count: 30, tierWeights: { T3: 0, T2: 40, T1: 60 } },
      { type: 'petExp', amount: 800 },
      { type: 'pet', tier: 'T2' },
    ]},

  // ── 挑战次数 ──
  { id: 'runs_1',  type: 'totalRuns', threshold: 1,  name: '首次冒险',
    rewards: [
      { type: 'fragment', count: 5,  tierWeights: { T3: 100, T2: 0, T1: 0 } },
      { type: 'pet', tier: 'T3' },
    ]},
  { id: 'runs_3',  type: 'totalRuns', threshold: 3,  name: '初露锋芒',
    rewards: [
      { type: 'fragment', count: 6,  tierWeights: { T3: 90, T2: 10, T1: 0 } },
      { type: 'petExp', amount: 80 },
    ]},
  { id: 'runs_5',  type: 'totalRuns', threshold: 5,  name: '身经百战',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 80, T2: 20, T1: 0 } },
      { type: 'petExp', amount: 100 },
    ]},
  { id: 'runs_10', type: 'totalRuns', threshold: 10, name: '老练冒险者',
    rewards: [
      { type: 'fragment', count: 12, tierWeights: { T3: 60, T2: 30, T1: 10 } },
      { type: 'petExp', amount: 200 },
    ]},
  { id: 'runs_20', type: 'totalRuns', threshold: 20, name: '百折不挠',
    rewards: [
      { type: 'fragment', count: 15, tierWeights: { T3: 40, T2: 40, T1: 20 } },
      { type: 'petExp', amount: 300 },
    ]},

  // ── 灵宠收集 ──
  { id: 'pool_3',  type: 'petPoolCount', threshold: 3,  name: '初建灵宠池',
    rewards: [
      { type: 'fragment', count: 8,  tierWeights: { T3: 80, T2: 20, T1: 0 } },
      { type: 'petExp', amount: 100 },
    ]},
  { id: 'pool_5',  type: 'petPoolCount', threshold: 5,  name: '灵宠成队',
    rewards: [
      { type: 'fragment', count: 12, tierWeights: { T3: 60, T2: 30, T1: 10 } },
      { type: 'petExp', amount: 200 },
      { type: 'stamina', amount: 30 },
    ]},
  { id: 'pool_10', type: 'petPoolCount', threshold: 10, name: '灵宠大师',
    rewards: [
      { type: 'fragment', count: 20, tierWeights: { T3: 30, T2: 45, T1: 25 } },
      { type: 'petExp', amount: 400 },
    ]},
  { id: 'pool_15', type: 'petPoolCount', threshold: 15, name: '灵宠收藏家',
    rewards: [
      { type: 'fragment', count: 25, tierWeights: { T3: 15, T2: 45, T1: 40 } },
      { type: 'petExp', amount: 600 },
    ]},
  { id: 'pool_20', type: 'petPoolCount', threshold: 20, name: '万灵统御',
    rewards: [
      { type: 'fragment', count: 35, tierWeights: { T3: 5, T2: 40, T1: 55 } },
      { type: 'petExp', amount: 800 },
    ]},
]

// ===== 条件检查 =====

function checkCondition(milestone, storage) {
  switch (milestone.type) {
    case 'level':        return (storage.cultivation.level || 0) >= milestone.threshold
    case 'bestFloor':    return (storage.bestFloor || 0) >= milestone.threshold
    case 'totalRuns':    return (storage.totalRuns || 0) >= milestone.threshold
    case 'petPoolCount': return (storage.petPoolCount || 0) >= milestone.threshold
    default: return false
  }
}

/**
 * 返回已达成但未领取的里程碑列表
 */
function getUnclaimedChests(storage) {
  const claimed = (storage._d || storage).chestRewards
    ? ((storage._d || storage).chestRewards.claimed || {})
    : {}
  return CHEST_MILESTONES.filter(m => !claimed[m.id] && checkCondition(m, storage))
}

/**
 * 返回未领取宝箱数量
 */
function getUnclaimedCount(storage) {
  return getUnclaimedChests(storage).length
}

/**
 * 按 tierWeights 随机选一只宠物，集中分配碎片
 * @param {object} tierWeights - { T3: 80, T2: 20, T1: 0 }
 * @returns {string} petId
 */
function rollPetByTier(tierWeights) {
  const totalW = (tierWeights.T3 || 0) + (tierWeights.T2 || 0) + (tierWeights.T1 || 0)
  if (totalW <= 0) return PET_TIER.T3[0]
  let roll = Math.random() * totalW
  let tier = 'T3'
  if (roll < (tierWeights.T1 || 0)) tier = 'T1'
  else if (roll < (tierWeights.T1 || 0) + (tierWeights.T2 || 0)) tier = 'T2'

  const candidates = PET_TIER[tier]
  if (!candidates || candidates.length === 0) return PET_TIER.T3[0]
  return candidates[Math.floor(Math.random() * candidates.length)]
}

/**
 * 从指定档位中随机选一只未拥有的宠物
 * @returns {string|null} petId or null if all owned
 */
function rollUnownedPet(storage, tier) {
  const pool = (storage._d ? storage._d.petPool : storage.petPool) || []
  const ownedIds = new Set(pool.map(p => p.id))
  const candidates = (PET_TIER[tier] || []).filter(id => !ownedIds.has(id))
  if (candidates.length === 0) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

module.exports = {
  SUMMON_FRAG_COST,
  CHEST_MILESTONES,
  checkCondition,
  getUnclaimedChests,
  getUnclaimedCount,
  rollPetByTier,
  rollUnownedPet,
}
