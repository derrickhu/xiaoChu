/**
 * 通天塔节奏参数 — 技能解锁 / 强制精英层 / 事件权重缩放 / 灵珠权重 / BOSS分层
 * 调优时只改此文件，tower.js 自动读取
 */

// ===== 普通怪技能解锁阈值 =====
const TOWER_SKILL_UNLOCK = {
  lightPhase: 5,
  basicPhase: 8,
  advancedPhase: 18,
  extraPhase: 25,
  extraChance: 0.3,
}

// ===== 强制精英层 =====
const TOWER_FORCED_ELITE_FLOORS = [5, 12, 18, 24]

// ===== 事件权重缩放系数 =====
const TOWER_EVENT_SCALING = {
  eliteGrowth: { divisor: 4, mult: 3 },
  eliteBossFloorBonus: 18,
  adventureGrowth: { divisor: 6, mult: 2 },
  shopGrowth: { divisor: 8, mult: 2 },
  restGrowth: { divisor: 8, mult: 2 },
  battleReduceAt15: 15,
  battleReduceAt22: 10,
  eliteBonusAt15: 5,
  earlyAdventure: 8,
  earlyRest: 3,
}

// ===== BOSS 池分层阈值 =====
const TOWER_BOSS_POOL_THRESHOLDS = { pool20: 20, pool30: 30 }

// ===== BOSS 等级公式除数 =====
const TOWER_BOSS_LEVEL_DIVISOR = 10

// ===== 奖励 buff 数量 =====
const TOWER_REWARD_COUNT = 3

// ===== 速通判定回合数 =====
const TOWER_SPEED_KILL_TURNS = 5

// ===== 灵珠权重 =====
const BEAD_WEIGHTS = {
  heart: 0.8,
  attrBias: 1.4,
  weaponMul: 1.5,
}

// ===== 普通怪名字档位除数 =====
const TOWER_NAME_TIER_DIVISOR = 5

// ===== 商店默认权重 =====
const TOWER_SHOP_DEFAULT_WEIGHT = 10

module.exports = {
  TOWER_SKILL_UNLOCK,
  TOWER_FORCED_ELITE_FLOORS,
  TOWER_EVENT_SCALING,
  TOWER_BOSS_POOL_THRESHOLDS,
  TOWER_BOSS_LEVEL_DIVISOR,
  TOWER_REWARD_COUNT,
  TOWER_SPEED_KILL_TURNS,
  BEAD_WEIGHTS,
  TOWER_NAME_TIER_DIVISOR,
  TOWER_SHOP_DEFAULT_WEIGHT,
}
