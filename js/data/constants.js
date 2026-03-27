/**
 * 全局数值常量集中管理 — 灵宠消消塔
 * 各域名前缀: STAMINA_*, CLOUD_*, RANK_*, TOWER_*, CULT_*, POOL_*, IDLE_*
 */

// ===== 体力系统 (STAMINA) =====

const STAMINA_RECOVER_INTERVAL_MS = 5 * 60 * 1000
const STAMINA_INITIAL = 100
const STAMINA_SIDEBAR_REWARD = 30

// ===== 云同步 (CLOUD) =====

const CLOUD_SYNC_BASE_DELAY_MS = 2000
const CLOUD_SYNC_MAX_BACKOFF_MS = 120000
const CLOUD_SYNC_MAX_FAIL = 5
const CLOUD_SYNC_LOG_THRESHOLD = 3
const CLOUD_SYNC_RETRY_INTERVAL_MS = 120000

// ===== 排行榜 (RANK) =====

const RANK_CACHE_TTL_MS = 30000

// ===== 塔层 / 肉鸽 (TOWER) =====

const TOWER_MAX_FLOOR = 30
const TOWER_COUNTER_MUL = 2.5
const TOWER_COUNTERED_MUL = 0.5
const TOWER_RECENT_LIMIT = 3
const TOWER_BASE_EVENT_WEIGHTS = {
  battle:    70,
  elite:      8,
  adventure:  5,
  shop:       4,
  rest:       3,
}
const TOWER_SHOP_DISPLAY_COUNT = 4
const TOWER_SHOP_FREE_COUNT = 1
const TOWER_SHOP_HP_COST_PCT = 15

// ===== 修炼系统 (CULT) =====

const CULT_MAX_LEVEL = 60
const CULT_EXP_BASE = 400
const CULT_EXP_LINEAR = 100
const CULT_EXP_POW_EXP = 1.6
const CULT_EXP_POW_COEFF = 6
const CULT_KILL_BOSS_BASE = 30
const CULT_KILL_BOSS_FLOOR_COEFF = 4
const CULT_KILL_ELITE_BASE = 15
const CULT_KILL_ELITE_FLOOR_COEFF = 3
const CULT_KILL_NORMAL_BASE = 5
const CULT_KILL_NORMAL_FLOOR_COEFF = 2

// ===== 灵宠池 (POOL) =====

const POOL_MAX_LV = 40
const POOL_ADV_MAX_LV = 60
const POOL_TIER_EXP_MUL = { T3: 1.0, T2: 1.3, T1: 1.6 }
const POOL_EXP_BASE = 20
const POOL_EXP_LINEAR = 8
const POOL_EXP_POW_EXP = 1.4
const POOL_EXP_POW_COEFF = 0.5
const POOL_STAR_FRAG_COST = { 2: 5, 3: 15, 4: 30 }
const POOL_STAR_LV_REQ = { 2: 10, 3: 20, 4: 45 }
const POOL_STAR_ATK_MUL = { 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2 }
const POOL_FRAGMENT_TO_EXP = 40
const POOL_ENTRY_LEVEL = 5
const POOL_ENTRY_FRAGMENTS = 2
const POOL_T3_LV_BONUS_RATE = 0.8
const POOL_ROGUE_EXP_RATIO = 0.3
const POOL_ROGUE_FLOOR_BONUS = 2
const POOL_ROGUE_CLEAR_BONUS = 200

// ===== 灵宠派遣 / 挂机 (IDLE) =====

const IDLE_MAX_SLOTS = 3
const IDLE_FRAG_INTERVAL = 4 * 3600 * 1000
const IDLE_MAX_ACCUMULATE = 24 * 3600 * 1000
const IDLE_PET_EXP_PER_HOUR = 8
const IDLE_PET_LV_EXP_FACTOR = 0.02

// ===== 连击里程碑 (COMBO) =====
// 阈值: 显示特殊文字的连击数
// 文案: 对应里程碑显示的文字
// 后续调整阶梯值只需改这里
const COMBO_MILESTONES = [
  { threshold: 3,  text: '破!',    color: '#4d88ff',  tier: 1 },  // 初级
  { threshold: 6,  text: '无双!',  color: '#ff8c00',  tier: 2 },  // 中级
  { threshold: 9,  text: '神威!',  color: '#ff4d6a',  tier: 3 },  // 高级
  { threshold: 12, text: '天选!',  color: '#9d4dff',  tier: 4 },  // 顶级
  { threshold: 15, text: '传说!',  color: '#ffd700',  tier: 5 },  // 传说
  { threshold: 18, text: '神话!',  color: '#ff2a6a',  tier: 6 },  // 神话
]
const COMBO_MILESTONE_INTERVAL = 3  // 里程碑间隔（用于震动判断等）

// 获取当前连击数对应的里程碑档位 (0=未命中任何里程碑)
function getComboTier(combo) {
  if (!combo || combo < COMBO_MILESTONES[0].threshold) return 0
  for (let i = COMBO_MILESTONES.length - 1; i >= 0; i--) {
    if (combo >= COMBO_MILESTONES[i].threshold) return COMBO_MILESTONES[i].tier
  }
  return 0
}

// 判断是否是里程碑阈值（精确匹配）
function isComboMilestone(combo) {
  return COMBO_MILESTONES.some(m => m.threshold === combo)
}

module.exports = {
  // STAMINA
  STAMINA_RECOVER_INTERVAL_MS,
  STAMINA_INITIAL,
  STAMINA_SIDEBAR_REWARD,
  // CLOUD
  CLOUD_SYNC_BASE_DELAY_MS,
  CLOUD_SYNC_MAX_BACKOFF_MS,
  CLOUD_SYNC_MAX_FAIL,
  CLOUD_SYNC_LOG_THRESHOLD,
  CLOUD_SYNC_RETRY_INTERVAL_MS,
  // RANK
  RANK_CACHE_TTL_MS,
  // TOWER
  TOWER_MAX_FLOOR,
  TOWER_COUNTER_MUL,
  TOWER_COUNTERED_MUL,
  TOWER_RECENT_LIMIT,
  TOWER_BASE_EVENT_WEIGHTS,
  TOWER_SHOP_DISPLAY_COUNT,
  TOWER_SHOP_FREE_COUNT,
  TOWER_SHOP_HP_COST_PCT,
  // CULT
  CULT_MAX_LEVEL,
  CULT_EXP_BASE,
  CULT_EXP_LINEAR,
  CULT_EXP_POW_EXP,
  CULT_EXP_POW_COEFF,
  CULT_KILL_BOSS_BASE,
  CULT_KILL_BOSS_FLOOR_COEFF,
  CULT_KILL_ELITE_BASE,
  CULT_KILL_ELITE_FLOOR_COEFF,
  CULT_KILL_NORMAL_BASE,
  CULT_KILL_NORMAL_FLOOR_COEFF,
  // POOL
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
  // IDLE
  IDLE_MAX_SLOTS,
  IDLE_FRAG_INTERVAL,
  IDLE_MAX_ACCUMULATE,
  IDLE_PET_EXP_PER_HOUR,
  IDLE_PET_LV_EXP_FACTOR,
  // COMBO
  COMBO_MILESTONES,
  COMBO_MILESTONE_INTERVAL,
  getComboTier,
  isComboMilestone,
}
