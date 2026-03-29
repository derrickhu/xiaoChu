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
 *  - fragment: 碎片（按 rarityWeights 随机分配给某只宠物）
 *  - pet:      直送宠物入池（从指定稀有度未拥有宠物中随机选）
 *  - exp:      修炼经验
 *  - soulStone: 灵石（共享升级货币）
 *  - stamina:  体力
 *  - item:     道具（预留）
 */

const { PET_RARITY, getPetRarity } = require('./pets')

// 碎片召唤费用（按稀有度）
const SUMMON_FRAG_COST = { R: 10, SR: 15, SSR: 25 }

// ===== 里程碑定义 =====

const CHEST_MILESTONES = [
  // ── 修炼等级（Lv2起，之后每级，之后每5级）──
  { id: 'lv_2',  type: 'level', threshold: 2,  name: '修炼 Lv.2',
    desc: '漫漫修仙路，从升第一级开始，灵宠们为你欢呼！',
    rewards: [
      { type: 'fragment', count: 6,  rarityWeights: { R: 85, SR: 15, SSR: 0 } },
      { type: 'soulStone', amount: 60 },
    ]},
  { id: 'lv_3',  type: 'level', threshold: 3,  name: '修炼 Lv.3',
    desc: '感气三重，灵力渐聚，天地灵气开始向你汇聚。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 85, SR: 15, SSR: 0 } },
      { type: 'soulStone', amount: 100 },
    ]},
  { id: 'lv_4',  type: 'level', threshold: 4,  name: '修炼 Lv.4',
    desc: '感气四重，功法愈发纯熟，灵宠也感受到你的进步。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 80, SR: 20, SSR: 0 } },
      { type: 'soulStone', amount: 80 },
    ]},
  { id: 'lv_5',  type: 'level', threshold: 5,  name: '练气期突破',
    desc: '第一道天堑已破！境界提升，新修炼形象「剑灵少侠」已解锁！',
    rewards: [
      { type: 'avatar', avatarId: 'boy2' },
      { type: 'fragment', count: 10, rarityWeights: { R: 75, SR: 25, SSR: 0 } },
      { type: 'soulStone', amount: 150 },
      { type: 'stamina', amount: 30 },
    ]},
  { id: 'lv_6',  type: 'level', threshold: 6,  name: '修炼 Lv.6',
    desc: '修为日进，灵宠们纷纷仰望，你散发出不一样的气息。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 70, SR: 30, SSR: 0 } },
      { type: 'soulStone', amount: 100 },
    ]},
  { id: 'lv_7',  type: 'level', threshold: 7,  name: '修炼 Lv.7',
    desc: '越来越熟练了，同辈修士们开始侧目，你走在他们前面。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 65, SR: 30, SSR: 5 } },
      { type: 'soulStone', amount: 120 },
    ]},
  { id: 'lv_8',  type: 'level', threshold: 8,  name: '修炼 Lv.8',
    desc: '感气八重，离筑基只差一步，再努力一把！',
    rewards: [
      { type: 'fragment', count: 10, rarityWeights: { R: 60, SR: 35, SSR: 5 } },
      { type: 'soulStone', amount: 150 },
    ]},
  { id: 'lv_9',  type: 'level', threshold: 9,  name: '修炼 Lv.9',
    desc: '感气大成！境界已触碰极限，下一步将是质的飞跃。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 55, SR: 35, SSR: 10 } },
      { type: 'soulStone', amount: 120 },
    ]},
  { id: 'lv_10', type: 'level', threshold: 10, name: '修炼 Lv.10',
    desc: '感气圆满！宗门嘉奖，新修炼形象「星月仙子」已解锁！',
    rewards: [
      { type: 'avatar', avatarId: 'girl2' },
      { type: 'fragment', count: 12, rarityWeights: { R: 50, SR: 40, SSR: 10 } },
      { type: 'soulStone', amount: 200 },
      { type: 'pet', rarity: 'R' },
    ]},
  { id: 'lv_15', type: 'level', threshold: 15, name: '筑基期突破',
    desc: '凝气成丹，根基铸就，蜕变已然开始，更广阔的天地在等你。',
    rewards: [
      { type: 'fragment', count: 15, rarityWeights: { R: 40, SR: 45, SSR: 15 } },
      { type: 'soulStone', amount: 300 },
      { type: 'stamina', amount: 50 },
    ]},
  { id: 'lv_20', type: 'level', threshold: 20, name: '修炼 Lv.20',
    desc: 'Lv.20，你的名字已在修仙界小有传闻，颇有几分传奇色彩。',
    rewards: [
      { type: 'fragment', count: 18, rarityWeights: { R: 30, SR: 50, SSR: 20 } },
      { type: 'soulStone', amount: 400 },
    ]},
  { id: 'lv_25', type: 'level', threshold: 25, name: '修炼 Lv.25',
    desc: '历经风雨，依然坚持，Lv.25是你不曾放弃的最好见证。',
    rewards: [
      { type: 'fragment', count: 20, rarityWeights: { R: 20, SR: 50, SSR: 30 } },
      { type: 'soulStone', amount: 600 },
    ]},
  { id: 'lv_30', type: 'level', threshold: 30, name: '金丹期突破',
    desc: '炼就金丹！这一刻，你真正踏入了修仙之路的核心，传说从此开始。',
    rewards: [
      { type: 'fragment', count: 25, rarityWeights: { R: 10, SR: 50, SSR: 40 } },
      { type: 'soulStone', amount: 800 },
      { type: 'stamina', amount: 50 },
      { type: 'pet', rarity: 'SR' },
    ]},
  { id: 'lv_35', type: 'level', threshold: 35, name: '修炼 Lv.35',
    desc: '登高方知山高路远，Lv.35的你已是同辈中的佼佼者。',
    rewards: [
      { type: 'fragment', count: 22, rarityWeights: { R: 10, SR: 45, SSR: 45 } },
      { type: 'soulStone', amount: 800 },
    ]},
  { id: 'lv_40', type: 'level', threshold: 40, name: '修炼 Lv.40',
    desc: 'Lv.40，你已超越了大多数修士，灵宠们以跟随你为荣。',
    rewards: [
      { type: 'fragment', count: 25, rarityWeights: { R: 5, SR: 40, SSR: 55 } },
      { type: 'soulStone', amount: 1000 },
    ]},
  { id: 'lv_45', type: 'level', threshold: 45, name: '元婴期突破',
    desc: '神识独立，元婴出窍，超脱肉身束缚，你已触摸到永生的边缘！',
    rewards: [
      { type: 'fragment', count: 30, rarityWeights: { R: 0, SR: 35, SSR: 65 } },
      { type: 'soulStone', amount: 1500 },
      { type: 'stamina', amount: 50 },
    ]},
  { id: 'lv_50', type: 'level', threshold: 50, name: '修炼 Lv.50',
    desc: 'Lv.50，这方天地的强者之列已有你的一席之地，传说不虚。',
    rewards: [
      { type: 'fragment', count: 30, rarityWeights: { R: 0, SR: 30, SSR: 70 } },
      { type: 'soulStone', amount: 1500 },
    ]},
  { id: 'lv_55', type: 'level', threshold: 55, name: '修炼 Lv.55',
    desc: '化神期已近在眼前，Lv.55的你令众仙惊叹，终点即将到来。',
    rewards: [
      { type: 'fragment', count: 35, rarityWeights: { R: 0, SR: 25, SSR: 75 } },
      { type: 'soulStone', amount: 2000 },
    ]},
  { id: 'lv_58', type: 'level', threshold: 58, name: '化神期突破',
    desc: '化形为神，名列仙籍！你的名字将永远刻在修仙界的历史上。',
    rewards: [
      { type: 'fragment', count: 40, rarityWeights: { R: 0, SR: 20, SSR: 80 } },
      { type: 'soulStone', amount: 2500 },
      { type: 'pet', rarity: 'SSR' },
    ]},
  { id: 'lv_60', type: 'level', threshold: 60, name: '修炼圆满',
    desc: '大道已成，修炼圆满！天地为证，所有灵宠与你共享这份荣耀！',
    rewards: [
      { type: 'fragment', count: 50, rarityWeights: { R: 0, SR: 15, SSR: 85 } },
      { type: 'soulStone', amount: 3000 },
      { type: 'stamina', amount: 100 },
    ]},

  // ── 肉鸽塔层数 ──
  { id: 'tower_5',  type: 'bestFloor', threshold: 5,  name: '通天塔 5 层',
    desc: '打到第5层了！灵宠们兴奋地围着你蹦跳，不错的开始！',
    rewards: [
      { type: 'fragment', count: 6,  rarityWeights: { R: 90, SR: 10, SSR: 0 } },
      { type: 'soulStone', amount: 60 },
    ]},
  { id: 'tower_10', type: 'bestFloor', threshold: 10, name: '通天塔 10 层',
    desc: '第10层！越打越猛，你和灵宠之间的默契越来越深。',
    rewards: [
      { type: 'fragment', count: 10, rarityWeights: { R: 70, SR: 25, SSR: 5 } },
      { type: 'soulStone', amount: 150 },
    ]},
  { id: 'tower_15', type: 'bestFloor', threshold: 15, name: '通天塔 15 层',
    desc: '过了半塔！前方未知，但你已证明自己远超常人。',
    rewards: [
      { type: 'fragment', count: 12, rarityWeights: { R: 50, SR: 35, SSR: 15 } },
      { type: 'soulStone', amount: 200 },
    ]},
  { id: 'tower_20', type: 'bestFloor', threshold: 20, name: '通天塔 20 层',
    desc: '第20层！你的名字已被刻在塔壁上，后来者仰望的传说。',
    rewards: [
      { type: 'fragment', count: 18, rarityWeights: { R: 30, SR: 45, SSR: 25 } },
      { type: 'soulStone', amount: 400 },
    ]},
  { id: 'tower_25', type: 'bestFloor', threshold: 25, name: '通天塔 25 层',
    desc: '接近塔顶！气势如虹，连塔中的远古妖兽都开始颤抖。',
    rewards: [
      { type: 'fragment', count: 20, rarityWeights: { R: 15, SR: 45, SSR: 40 } },
      { type: 'soulStone', amount: 500 },
    ]},
  { id: 'tower_30', type: 'bestFloor', threshold: 30, name: '通天塔登顶',
    desc: '绝世强者！登顶通天塔，所有灵宠在你面前俯首称臣！',
    rewards: [
      { type: 'fragment', count: 30, rarityWeights: { R: 0, SR: 40, SSR: 60 } },
      { type: 'soulStone', amount: 800 },
      { type: 'pet', rarity: 'SR' },
    ]},

  // ── 挑战次数 ──
  { id: 'runs_1',  type: 'totalRuns', threshold: 1,  name: '首次冒险',
    desc: '第一次完成挑战！灵宠们欢呼雀跃，修仙冒险路正式开启！',
    rewards: [
      { type: 'fragment', count: 5,  rarityWeights: { R: 100, SR: 0, SSR: 0 } },
      { type: 'pet', rarity: 'R' },
    ]},
  { id: 'runs_3',  type: 'totalRuns', threshold: 3,  name: '初露锋芒',
    desc: '完成了3次挑战，棒棒的！渐入佳境，感觉越来越顺手了。',
    rewards: [
      { type: 'fragment', count: 6,  rarityWeights: { R: 90, SR: 10, SSR: 0 } },
      { type: 'soulStone', amount: 80 },
    ]},
  { id: 'runs_5',  type: 'totalRuns', threshold: 5,  name: '身经百战',
    desc: '完成了5次挑战！你已有了自己的战斗风格，灵宠们以你为荣。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 80, SR: 20, SSR: 0 } },
      { type: 'soulStone', amount: 100 },
    ]},
  { id: 'runs_10', type: 'totalRuns', threshold: 10, name: '老练冒险者',
    desc: '10次挑战，经验满满！你已是宗门里公认的老练冒险者了。',
    rewards: [
      { type: 'fragment', count: 12, rarityWeights: { R: 60, SR: 30, SSR: 10 } },
      { type: 'soulStone', amount: 200 },
    ]},
  { id: 'runs_20', type: 'totalRuns', threshold: 20, name: '百折不挠',
    desc: '完成了20次挑战！百折不挠是对你最好的注脚，堪称楷模。',
    rewards: [
      { type: 'fragment', count: 15, rarityWeights: { R: 40, SR: 40, SSR: 20 } },
      { type: 'soulStone', amount: 300 },
    ]},

  // ── 灵宠收集 ──
  { id: 'pool_3',  type: 'petPoolCount', threshold: 3,  name: '初建灵宠池',
    desc: '3只灵宠齐聚！你的队伍初具规模，合作的力量已初现端倪。',
    rewards: [
      { type: 'fragment', count: 8,  rarityWeights: { R: 80, SR: 20, SSR: 0 } },
      { type: 'soulStone', amount: 100 },
    ]},
  { id: 'pool_5',  type: 'petPoolCount', threshold: 5,  name: '灵宠成队',
    desc: '5只灵宠成队！五行属性初聚，有了这群伙伴，谁还能挡住你？',
    rewards: [
      { type: 'fragment', count: 12, rarityWeights: { R: 60, SR: 30, SSR: 10 } },
      { type: 'soulStone', amount: 200 },
      { type: 'stamina', amount: 30 },
    ]},
  { id: 'pool_10', type: 'petPoolCount', threshold: 10, name: '灵宠大师',
    desc: '10只灵宠入池！这已是一支正规军，同辈修士闻风而逃吧。',
    rewards: [
      { type: 'fragment', count: 20, rarityWeights: { R: 30, SR: 45, SSR: 25 } },
      { type: 'soulStone', amount: 400 },
    ]},
  { id: 'pool_15', type: 'petPoolCount', threshold: 15, name: '灵宠收藏家',
    desc: '15只灵宠，你的灵宠池令整个修仙界的同辈都为之羡慕。',
    rewards: [
      { type: 'fragment', count: 25, rarityWeights: { R: 15, SR: 45, SSR: 40 } },
      { type: 'soulStone', amount: 600 },
    ]},
  { id: 'pool_20', type: 'petPoolCount', threshold: 20, name: '万灵统御',
    desc: '20只灵宠！万灵归心，你已是当之无愧的传说级灵宠大师！',
    rewards: [
      { type: 'fragment', count: 35, rarityWeights: { R: 5, SR: 40, SSR: 55 } },
      { type: 'soulStone', amount: 800 },
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
 * 按 rarityWeights 随机选一只宠物，集中分配碎片
 * @param {object} rarityWeights - { R: 80, SR: 20, SSR: 0 }
 * @returns {string} petId
 */
function rollPetByRarity(rarityWeights) {
  const totalW = (rarityWeights.R || 0) + (rarityWeights.SR || 0) + (rarityWeights.SSR || 0)
  if (totalW <= 0) return PET_RARITY.R[0]
  let roll = Math.random() * totalW
  let rarity = 'R'
  if (roll < (rarityWeights.SSR || 0)) rarity = 'SSR'
  else if (roll < (rarityWeights.SSR || 0) + (rarityWeights.SR || 0)) rarity = 'SR'

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
  CHEST_MILESTONES,
  checkCondition,
  getUnclaimedChests,
  getUnclaimedCount,
  rollPetByRarity,
  rollUnownedPet,
}
