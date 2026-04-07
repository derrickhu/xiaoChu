/**
 * 经济系统数值 — 体力 / 结算 / 每日限制 / 签到 / 日任 / 碎片 / 挂机
 * 调优时只改此文件
 */

// ===== 体力系统 =====
const STAMINA_RECOVER_INTERVAL_MS = 3 * 60 * 1000
const STAMINA_INITIAL = 100
const STAMINA_SIDEBAR_REWARD = 30
const STAMINA_COST = 10

// ===== 通天塔：事件权重 / 商店参数 =====
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

// ===== 通天塔每日挑战限制（adUnitId 留在 economyConfig） =====
const TOWER_DAILY_FREE_RUNS = 3
const TOWER_DAILY_AD_EXTRA_RUNS = 2

// ===== 经济框架：日收入目标与来源占比 =====
const ECONOMY_FRAMEWORK = {
  dailyTarget: {
    1:  { soulStone: 300,  fragment: 6,  awakenStonePerWeek: 0 },
    2:  { soulStone: 350,  fragment: 8,  awakenStonePerWeek: 0 },
    3:  { soulStone: 420,  fragment: 10, awakenStonePerWeek: 0 },
    4:  { soulStone: 520,  fragment: 12, awakenStonePerWeek: 2 },
    5:  { soulStone: 620,  fragment: 15, awakenStonePerWeek: 3 },
    6:  { soulStone: 740,  fragment: 18, awakenStonePerWeek: 4 },
    7:  { soulStone: 880,  fragment: 22, awakenStonePerWeek: 6 },
    8:  { soulStone: 1050, fragment: 26, awakenStonePerWeek: 8 },
    9:  { soulStone: 1250, fragment: 30, awakenStonePerWeek: 10 },
    10: { soulStone: 1480, fragment: 34, awakenStonePerWeek: 12 },
    11: { soulStone: 1750, fragment: 40, awakenStonePerWeek: 15 },
    12: { soulStone: 2080, fragment: 46, awakenStonePerWeek: 18 },
  },
  sourceRatio: {
    stageRepeat: 0.35,
    tower:       0.30,
    dailyTask:   0.15,
    idle:        0.10,
    signIn:      0.10,
  },
  dailyTaskScale: {
    1: 1.0, 2: 1.2, 3: 1.4, 4: 1.7, 5: 2.0, 6: 2.4,
    7: 2.8, 8: 3.3, 9: 3.9, 10: 4.6, 11: 5.4, 12: 6.4,
  },
}

// ===== 派遣/挂机产出 =====
const IDLE_CFG = {
  maxSlots:        3,
  fragIntervalMs:  3 * 3600 * 1000,
  maxAccumulateMs: 24 * 3600 * 1000,
  soulStonePerHour: 0.6,
  petLvExpFactor:  0.02,
}

// ===== 章节通关宝箱 =====
const CHAPTER_CLEAR_REWARDS = {
  1:  { soulStone: 50,  fragment: 3 },
  2:  { soulStone: 60,  fragment: 4 },
  3:  { soulStone: 80,  fragment: 5 },
  4:  { soulStone: 100, fragment: 6,  awakenStone: 1 },
  5:  { soulStone: 120, fragment: 8,  awakenStone: 1 },
  6:  { soulStone: 150, fragment: 10, awakenStone: 2 },
  7:  { soulStone: 180, fragment: 12, awakenStone: 3 },
  8:  { soulStone: 220, fragment: 14, awakenStone: 4 },
  9:  { soulStone: 260, fragment: 16, awakenStone: 5 },
  10: { soulStone: 300, fragment: 18, awakenStone: 6 },
  11: { soulStone: 350, fragment: 22, awakenStone: 8 },
  12: { soulStone: 400, fragment: 26, awakenStone: 10 },
}

// ===== 通天塔结算 =====
const TOWER_SETTLE = {
  fragment: {
    perFloor:    0.3,
    bossBonus:   1,
    eliteBonus:  0.5,
    clearBonus:  8,
    failRatio:   0.6,
  },
  cultExp: {
    perFloor:    3,
    clearBonus:  500,
    failRatio:   0.6,
  },
  soulStone: {
    combatRatio: 0.04,
    floorBase:   0.2,
    floorGrowth: 0.06,
    clearBonus:  30,
  },
  distribute: {
    mode: 'team',
    evenSplit: true,
  },
}

// ===== 秘境结算 =====
const STAGE_SETTLE = {
  ratingMul: { S: 1.5, A: 1.2, B: 1.0 },
  defeatExpRatio: 0.6,
  defeatSSRatio: 0.5,
}

// ===== 评级 → 星数映射 =====
const RATING_TO_STARS = { S: 3, A: 2, B: 1 }

// ===== 肉鸽灵石结算系数 @deprecated =====
const ROGUE_SETTLE = {
  combatExpRatio: 0.3,
  floorBonus:     2,
  clearBonus:     200,
}

// ===== 签到奖励 =====
const LOGIN_REWARDS = [
  { day: 1, rewards: { soulStone: 50,  stamina: 20 } },
  { day: 2, rewards: { soulStone: 60,  fragment: 3 } },
  { day: 3, rewards: { soulStone: 70,  stamina: 30 } },
  { day: 4, rewards: { soulStone: 75,  fragment: 5 } },
  { day: 5, rewards: { soulStone: 85,  stamina: 40 } },
  { day: 6, rewards: { soulStone: 100, fragment: 8, awakenStone: 1 } },
  { day: 7, rewards: { soulStone: 130, stamina: 50, fragment: 10, awakenStone: 2, petChoice: true } },
]
const LOGIN_WEEKLY_RATIO = 0.6

// ===== 每日任务 =====
const DAILY_TASKS = [
  { id: 'battle_1',    name: '秘境战斗1场',  condition: { type: 'stageBattle', count: 1 }, reward: { soulStone: 20 } },
  { id: 'battle_3',    name: '战斗3场',      condition: { type: 'anyBattle', count: 3 },   reward: { fragment: 3, soulStone: 8 } },
  { id: 'tower_1',     name: '挑战通天塔1次', condition: { type: 'towerRun', count: 1 },   reward: { soulStone: 14 } },
  { id: 'idle_collect', name: '收取派遣',     condition: { type: 'idleCollect', count: 1 }, reward: { soulStone: 13 } },
  { id: 'pet_feed',    name: '宠物升级1次',  condition: { type: 'petFeed', count: 1 },     reward: { soulStone: 10 } },
  { id: 'share_1',     name: '分享游戏1次',  condition: { type: 'share', count: 1 },       reward: { soulStone: 15 } },
]
const DAILY_ALL_COMPLETE_BONUS = { soulStone: 14, stamina: 20 }

// ===== 分享/邀请 =====
const SHARE_DAILY_MAX = 3
const SHARE_PER_REWARD = { stamina: 10 }
const SHARE_FIRST_EVER_BONUS = { soulStone: 100 }
const INVITE_REWARD = { soulStone: 200 }
const INVITE_MAX_COUNT = 10

// ===== 回归/补偿 =====
const COMEBACK_THRESHOLD_MS = 48 * 3600 * 1000
const COMEBACK_REWARD = { staminaFull: true, soulStone: 300 }
const WIPE_COMPENSATION = { soulStone: 2000, fragment: 40, awakenStone: 5, staminaFull: true }

// ===== 碎片召唤消耗 =====
const SUMMON_FRAG_COST = { R: 10, SR: 15, SSR: 25 }
const DEFAULT_RANDOM_FRAG_WEIGHTS = { R: 80, SR: 20, SSR: 0 }

// ===== 图鉴里程碑 buff 数值 =====
const DEX_ELEM_MILESTONE_BUFFS = {
  discovered5:  { atkPct: 2 },
  discovered10: { hpPct: 3 },
  collected15:  { atkPct: 5 },
  masteredAll:  { atkPct: 8, hpPct: 5 },
}
const DEX_RARITY_MILESTONE_BUFFS = {
  R:   { defPct: 5 },
  SR:  { hpPct: 8 },
  SSR: { atkPct: 10 },
}

module.exports = {
  STAMINA_RECOVER_INTERVAL_MS,
  STAMINA_INITIAL,
  STAMINA_SIDEBAR_REWARD,
  STAMINA_COST,
  TOWER_BASE_EVENT_WEIGHTS,
  TOWER_SHOP_DISPLAY_COUNT,
  TOWER_SHOP_FREE_COUNT,
  TOWER_SHOP_HP_COST_PCT,
  TOWER_DAILY_FREE_RUNS,
  TOWER_DAILY_AD_EXTRA_RUNS,
  ECONOMY_FRAMEWORK,
  IDLE_CFG,
  CHAPTER_CLEAR_REWARDS,
  TOWER_SETTLE,
  STAGE_SETTLE,
  RATING_TO_STARS,
  ROGUE_SETTLE,
  LOGIN_REWARDS,
  LOGIN_WEEKLY_RATIO,
  DAILY_TASKS,
  DAILY_ALL_COMPLETE_BONUS,
  SHARE_DAILY_MAX,
  SHARE_PER_REWARD,
  SHARE_FIRST_EVER_BONUS,
  INVITE_REWARD,
  INVITE_MAX_COUNT,
  COMEBACK_THRESHOLD_MS,
  COMEBACK_REWARD,
  WIPE_COMPENSATION,
  SUMMON_FRAG_COST,
  DEFAULT_RANDOM_FRAG_WEIGHTS,
  DEX_ELEM_MILESTONE_BUFFS,
  DEX_RARITY_MILESTONE_BUFFS,
}
