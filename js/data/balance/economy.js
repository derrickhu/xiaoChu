/**
 * 经济系统数值 — 体力 / 结算 / 每日限制 / 签到 / 日任 / 碎片 / 挂机
 * 调优时只改此文件
 */

// ===== 体力系统 =====
const STAMINA_RECOVER_INTERVAL_MS = 3 * 60 * 1000
const STAMINA_INITIAL = 100
const STAMINA_SIDEBAR_REWARD = 30
const STAMINA_COST = 10
// 体力软顶折灵石：**已停用**（玩家领取的体力现已完全不限上限，直接入账）
// 保留常量仅为兼容老存档迁移与可能的回滚；当前运行时路径不再读取
//   自然恢复依旧受 maxStamina 限制（见 storage._recoverStamina）
//   奖励领取无上限（见 storage.addBonusStamina）
const STAMINA_SOFT_CAP_BUFFER = 50
const STAMINA_OVERFLOW_SOUL_RATIO = 5

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
// 注：第 1 章关卡全免体力，宝箱的体力奖励刻意克制（避免与新手礼包/首通里程碑重复堆积），
// 把正反馈权重转移到灵石/碎片这些直接推动成长的货币上
const CHAPTER_CLEAR_REWARDS = {
  1:  { soulStone: 80,  fragment: 3, stamina: 20 },
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
const LOGIN_CYCLE_DAYS = 30
const LOGIN_SPECIAL_PET_ID = 'f4'
const LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS = 25
const LOGIN_PAGE_GROUPS = [
  { index: 0, startDay: 1, endDay: 7, isFinale: false },
  { index: 1, startDay: 8, endDay: 14, isFinale: false },
  { index: 2, startDay: 15, endDay: 21, isFinale: false },
  { index: 3, startDay: 22, endDay: 28, isFinale: false },
  { index: 4, startDay: 29, endDay: 30, isFinale: true },
]
// ── 里程碑宠物奖励（进度条上方的 SSR 宠物头像，到天数后可点击领取）──
// 第4天=整宠（从第7天前移，新手更快拿到 SR 宠物降低流失），后续碎片保持
const LOGIN_MILESTONE_PETS = [
  { day: 4,  petId: LOGIN_SPECIAL_PET_ID, type: 'pet',      count: 1,  duplicateFragments: LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS },
  { day: 15, petId: LOGIN_SPECIAL_PET_ID, type: 'fragment',  count: 10 },
  { day: 22, petId: LOGIN_SPECIAL_PET_ID, type: 'fragment',  count: 15 },
  { day: 30, petId: LOGIN_SPECIAL_PET_ID, type: 'fragment',  count: 25 },
]
// 兼容旧逻辑的30天完成奖励（现在由 LOGIN_MILESTONE_PETS day:30 替代）
const LOGIN_MILESTONE_REWARD = {
  soulStone: 100,
}
// ── 每日签到奖励（前 4 天加重灵石 + 体力，配合里程碑 SR 宠物形成 4 日连续钩子）──
const LOGIN_REWARDS = [
  { day: 1,  rewards: { soulStone: 100, stamina: 30 } },
  { day: 2,  rewards: { soulStone: 120, stamina: 40 } },
  { day: 3,  rewards: { soulStone: 150, stamina: 50 } },
  { day: 4,  rewards: { soulStone: 200, stamina: 60 } },
  { day: 5,  rewards: { soulStone: 70, stamina: 30 } },
  { day: 6,  rewards: { soulStone: 80 } },
  { day: 7,  rewards: { soulStone: 90, stamina: 40 } },
  { day: 8,  rewards: { soulStone: 100 } },
  { day: 9,  rewards: { soulStone: 110, stamina: 40 } },
  { day: 10, rewards: { soulStone: 120 } },
  { day: 11, rewards: { soulStone: 130 } },
  { day: 12, rewards: { soulStone: 140, stamina: 50 } },
  { day: 13, rewards: { soulStone: 150 } },
  { day: 14, rewards: { soulStone: 160, stamina: 50 } },
  { day: 15, rewards: { soulStone: 170 } },
  { day: 16, rewards: { soulStone: 180 } },
  { day: 17, rewards: { soulStone: 190, stamina: 60 } },
  { day: 18, rewards: { soulStone: 200 } },
  { day: 19, rewards: { soulStone: 210, stamina: 60 } },
  { day: 20, rewards: { soulStone: 220 } },
  { day: 21, rewards: { soulStone: 230, stamina: 60 } },
  { day: 22, rewards: { soulStone: 240 } },
  { day: 23, rewards: { soulStone: 250 } },
  { day: 24, rewards: { soulStone: 260, stamina: 70 } },
  { day: 25, rewards: { soulStone: 275 } },
  { day: 26, rewards: { soulStone: 290, stamina: 80 } },
  { day: 27, rewards: { soulStone: 305 } },
  { day: 28, rewards: { soulStone: 320, stamina: 80 } },
  { day: 29, rewards: { soulStone: 340 } },
  { day: 30, rewards: { soulStone: 360, stamina: 120 } },
]
const LOGIN_WEEKLY_RATIO = 0.6

// ===== 7天连续登录循环奖励 =====
// 每天都会送体力；灵石按周内天数递增，第5-7天再略微抬高体力档位
// 连续签到中断则 consecutiveDay 归零，重新计算
const CONSECUTIVE_CYCLE_DAYS = 7
const CONSECUTIVE_LOGIN_REWARDS = [
  { day: 1, rewards: { soulStone: 50,  stamina: 20 } },
  { day: 2, rewards: { soulStone: 60,  stamina: 20 } },
  { day: 3, rewards: { soulStone: 75,  stamina: 20 } },
  { day: 4, rewards: { soulStone: 90,  stamina: 25 } },
  { day: 5, rewards: { soulStone: 110, stamina: 25 } },
  { day: 6, rewards: { soulStone: 130, stamina: 30 } },
  { day: 7, rewards: { soulStone: 160, stamina: 30 } },
]

// ===== 每日任务 =====
const DAILY_TASKS = [
  { id: 'battle_1',    name: '秘境战斗1场',  condition: { type: 'stageBattle', count: 1 }, reward: { soulStone: 20 } },
  { id: 'battle_3',    name: '战斗3场',      condition: { type: 'anyBattle', count: 3 },   reward: { soulStone: 8, staminaFixed: 10 } },
  { id: 'tower_1',     name: '挑战通天塔1次', condition: { type: 'towerRun', count: 1 },   reward: { soulStone: 14 } },
  { id: 'idle_collect', name: '派遣灵宠1次',  condition: { type: 'idleAssign', count: 1 },  reward: { soulStone: 13 } },
  { id: 'pet_feed',    name: '宠物升级1次',  condition: { type: 'petFeed', count: 1 },     reward: { soulStone: 10 } },
  { id: 'share_1',     name: '分享游戏1次',  condition: { type: 'share', count: 1 },       reward: { soulStone: 15 } },
]
const DAILY_ALL_COMPLETE_BONUS = { soulStone: 14, stamina: 20 }

// ===== 分享/邀请 =====
const SHARE_DAILY_MAX = 3
// 每日基础奖：原先每次分享 +10 体力，与"新手体力本身就送得多"重叠、且预览 chip 里不展示，造成"弹窗数额对不上预览"。
// 现统一为空结构，分享奖励改由 SHARE_SCENES 场景奖 + SHARE_FIRST_EVER_BONUS 首次永久奖组成，
// 预览 chip 与实际入账一一对齐。保留字段以便未来扩展其他"每日基础资源"。
const SHARE_PER_REWARD = {}
const SHARE_FIRST_EVER_BONUS = { soulStone: 100 }
// 场景分享（非 sceneOnce）冷却时长：同一场景 24h 内只奖励一次，避免刷分享奖
const SHARE_SCENE_COOLDOWN_MS = 24 * 3600 * 1000
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

// ===== 关卡奖励生成系数（从 economyConfig.js 迁入） =====
const DAILY_STAGE_EST = { 1:20, 2:18, 3:16, 4:14, 5:13, 6:12, 7:11, 8:10, 9:9, 10:8, 11:7, 12:7 }
const REWARD_DIST_W = [0.7, 0.8, 0.85, 0.95, 1.0, 1.1, 1.25, 1.4]
const REWARD_FIRST_CLEAR_MUL = 1.5
const REWARD_ELITE_MUL = { soulStone: 1.5, fragment: { first: 1.4, repeat: 1.3 }, awakenStone: 1.5 }
const REWARD_FRAG_SOURCE_RATIO = 0.5
const REWARD_AWAKEN_WEEKLY_DIVISOR = 6
const REWARD_AWAKEN_MIN_REPEAT = 0.05
const REWARD_STAR_COEFFS = { ss2Pct: 0.01, ss3Pct: 0.02, fragBasePct: 0.08, fragStar3Mul: 1.5, awakenWeeklyDivisor: 12 }
const REWARD_STAR_AWAKEN_MIN_CHAPTER = 4
const REWARD_STAR_AWAKEN_MIN_ORD = 4
const REP_FRAG_COEFFS = { baseDivisor: 10, normalMaxMul: 0.5, eliteMinOffset: 1, eliteMaxMul: 0.8 }

// ===== 广告奖励数值 =====
const AD_REWARDS_NUMS = {
  staminaRecoveryAmount: 40,
  settleMultiplier: 2,
  dexMultiplier: 2,
  signMultiplier: 2,
  dailyTaskMultiplier: 2,
}

// ===== 日任觉醒石追加系数（从 giftConfig.js 迁入） =====
const DAILY_TASK_AWAKEN = {
  threshold: 6,
  coeff: 0.5,
  minSoulStone: 15,
  allBonusOffset: 4,
}

// ===== 通天塔活动赛季 =====
// 每周轮换，共10期（10 SSR + 10 SR），周一 0:00 自动切换
const TOWER_EVENT_SEASONS = [
  { season: 1,  ssr: 'm18', sr: 'm16' }, // 金锋战神 + 金罡战魂
  { season: 2,  ssr: 's17', sr: 's19' }, // 沧澜鲲鹏 + 水纹灵獭
  { season: 3,  ssr: 'f16', sr: 'f19' }, // 焚天火蟒 + 炎狱火龙
  { season: 4,  ssr: 'e18', sr: 'e17' }, // 镇地神牛 + 后土灵蚕
  { season: 5,  ssr: 'w10', sr: 'w18' }, // 万木之主 + 青鸾翠雀
  { season: 6,  ssr: 'm19', sr: 'm17' }, // 金耀星君 + 金翎神使
  { season: 7,  ssr: 'w20', sr: 'w19' }, // 神木麒麟 + 万木神龟
  { season: 8,  ssr: 'f17', sr: 'f20' }, // 赤焰麒麟 + 火灵神猫
  { season: 9,  ssr: 'e20', sr: 'e19' }, // 玄武神君 + 厚土灵龟
  { season: 10, ssr: 'm20', sr: 's20' }, // 万钧金神 + 冰凰神鸟
]

// 活动里程碑：floor → 奖励, type: srFrag / ssrFrag / ssrPet
const TOWER_EVENT_MILESTONES = [
  { floor:  5, type: 'srFrag',  count: 3  },
  { floor: 10, type: 'srFrag',  count: 5  },
  { floor: 15, type: 'srFrag',  count: 7  },
  { floor: 20, type: 'ssrFrag', count: 4  },
  { floor: 25, type: 'ssrFrag', count: 6  },
  { floor: 30, type: 'ssrPet',  count: 1  },
]

// 活动起始基准日（第1期开始的周一 0:00 UTC+8）
const TOWER_EVENT_EPOCH = new Date('2026-04-13T00:00:00+08:00').getTime()
const TOWER_EVENT_PERIOD_MS = 7 * 24 * 3600 * 1000

// ===== 审计用默认值 =====
const AUDIT_DEFAULTS = {
  avgFloor: 15,
  combatBase: 200,
  baseTaskSS: 94,
  idleHours: 16,
  idlePetLvFactor: 5,
}

module.exports = {
  STAMINA_RECOVER_INTERVAL_MS,
  STAMINA_INITIAL,
  STAMINA_SIDEBAR_REWARD,
  STAMINA_COST,
  STAMINA_SOFT_CAP_BUFFER,
  STAMINA_OVERFLOW_SOUL_RATIO,
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
  LOGIN_CYCLE_DAYS,
  LOGIN_SPECIAL_PET_ID,
  LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS,
  LOGIN_PAGE_GROUPS,
  LOGIN_MILESTONE_REWARD,
  LOGIN_MILESTONE_PETS,
  LOGIN_REWARDS,
  LOGIN_WEEKLY_RATIO,
  CONSECUTIVE_CYCLE_DAYS,
  CONSECUTIVE_LOGIN_REWARDS,
  DAILY_TASKS,
  DAILY_ALL_COMPLETE_BONUS,
  SHARE_DAILY_MAX,
  SHARE_PER_REWARD,
  SHARE_FIRST_EVER_BONUS,
  SHARE_SCENE_COOLDOWN_MS,
  INVITE_REWARD,
  INVITE_MAX_COUNT,
  COMEBACK_THRESHOLD_MS,
  COMEBACK_REWARD,
  WIPE_COMPENSATION,
  SUMMON_FRAG_COST,
  DEFAULT_RANDOM_FRAG_WEIGHTS,
  DEX_ELEM_MILESTONE_BUFFS,
  DEX_RARITY_MILESTONE_BUFFS,
  DAILY_STAGE_EST,
  REWARD_DIST_W,
  REWARD_FIRST_CLEAR_MUL,
  REWARD_ELITE_MUL,
  REWARD_FRAG_SOURCE_RATIO,
  REWARD_AWAKEN_WEEKLY_DIVISOR,
  REWARD_AWAKEN_MIN_REPEAT,
  REWARD_STAR_COEFFS,
  REWARD_STAR_AWAKEN_MIN_CHAPTER,
  REWARD_STAR_AWAKEN_MIN_ORD,
  REP_FRAG_COEFFS,
  AD_REWARDS_NUMS,
  DAILY_TASK_AWAKEN,
  AUDIT_DEFAULTS,
  TOWER_EVENT_SEASONS,
  TOWER_EVENT_MILESTONES,
  TOWER_EVENT_EPOCH,
  TOWER_EVENT_PERIOD_MS,
}
