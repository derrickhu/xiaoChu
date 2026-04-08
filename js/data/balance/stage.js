/**
 * 秘境关卡曲线系数 — 经验 / 灵石 / 评级 / 精英 / 队伍
 * 调优时只改此文件，stages.js 自动读取
 */

// ===== 经验公式：expBase = EXP_BASE + globalOrd * EXP_PER_ORD =====
const STAGE_EXP = { base: 60, perOrd: 10, repeatRatio: 0.68 }

// ===== 灵石公式：bsBase = BS_BASE + globalOrd * BS_PER_ORD =====
const STAGE_SOUL_STONE = { base: 15, perOrd: 2.2 }

// ===== 评级公式 =====
const STAGE_RATING = {
  base: 4,
  chCoeff: 0.6,
  ordCoeff: 0.2,
  minS: 5,
  aOffset: 3,
  earlyBonus: [
    { maxChapter: 2, bonus: 2 },
    { maxChapter: 3, bonus: 1 },
  ],
}

// ===== 精英关倍率（经验/灵石/评级加成） =====
const STAGE_ELITE_COEFFS = {
  expMul: 1.3,
  soulStoneMul: 1.2,
  ratingBonus: 2,
}

// ===== 精英技能数量阈值 =====
const STAGE_ELITE_SKILL_COUNT = {
  early: { maxChapter: 3, count: 1 },
  mid:   { maxChapter: 7, count: 2 },
  late:  { count: 3 },
}

// ===== 队伍人数 =====
const STAGE_TEAM_SIZE = {
  initial: { min: 1, max: 5 },
  default: { min: 3, max: 5 },
}

// ===== 首通碎片数（按品质区分，高品质多给碎片帮助玩家攒星） =====
const FIRST_CLEAR_FRAG_COUNT = { R: 3, SR: 5, SSR: 10 }

// ===== 精英小怪相对倍率（精英关 boss 前小怪的 HP 缩放） =====
const ELITE_MINION_HP_SCALE = 0.6

// ===== 章节推荐（修炼等级 / 宠物星级） =====
const CHAPTER_RECOMMENDED = {
  1:  { cultLevel: 1,  petStar: 1 },
  2:  { cultLevel: 3,  petStar: 1 },
  3:  { cultLevel: 6,  petStar: 1 },
  4:  { cultLevel: 10, petStar: 2 },
  5:  { cultLevel: 15, petStar: 2 },
  6:  { cultLevel: 20, petStar: 2 },
  7:  { cultLevel: 25, petStar: 3 },
  8:  { cultLevel: 30, petStar: 3 },
  9:  { cultLevel: 35, petStar: 3 },
  10: { cultLevel: 40, petStar: 4 },
  11: { cultLevel: 48, petStar: 4 },
  12: { cultLevel: 55, petStar: 5 },
}

// ===== 普通关每章 8 只宠物的品质配额 =====
// 可用关卡宠物：R=29 SR=47 SSR=4（排除通天塔预留）
const NORMAL_PET_QUOTA = {
  1:  { R:7, SR:1, SSR:0 },
  2:  { R:7, SR:1, SSR:0 },
  3:  { R:6, SR:2, SSR:0 },
  4:  { R:4, SR:4, SSR:0 },
  5:  { R:3, SR:5, SSR:0 },
  6:  { R:2, SR:6, SSR:0 },
  7:  { R:1, SR:7, SSR:0 },
  8:  { R:0, SR:7, SSR:1 },
  9:  { R:0, SR:8, SSR:0 },
  10: { R:0, SR:7, SSR:1 },
  11: { R:0, SR:7, SSR:1 },
  12: { R:0, SR:7, SSR:1 },
}

// ===== 精英关每章 8 只宠物的品质配额（始终 >= 同章普通） =====
const ELITE_PET_QUOTA = {
  1:  { R:7, SR:1, SSR:0 },
  2:  { R:5, SR:3, SSR:0 },
  3:  { R:3, SR:5, SSR:0 },
  4:  { R:2, SR:6, SSR:0 },
  5:  { R:0, SR:8, SSR:0 },
  6:  { R:0, SR:8, SSR:0 },
  7:  { R:0, SR:7, SSR:1 },
  8:  { R:0, SR:8, SSR:0 },
  9:  { R:0, SR:7, SSR:1 },
  10: { R:0, SR:7, SSR:1 },
  11: { R:0, SR:6, SSR:2 },
  12: { R:0, SR:6, SSR:2 },
}

// ===== 普通关法宝配额（每章 4 把，偶数关出法宝） =====
const NORMAL_WPN_QUOTA = {
  1:  { R:4, SR:0, SSR:0 },
  2:  { R:3, SR:1, SSR:0 },
  3:  { R:2, SR:2, SSR:0 },
  4:  { R:1, SR:3, SSR:0 },
  5:  { R:0, SR:4, SSR:0 },
  6:  { R:0, SR:4, SSR:0 },
  7:  { R:0, SR:3, SSR:1 },
  8:  { R:0, SR:3, SSR:1 },
  9:  { R:0, SR:2, SSR:2 },
  10: { R:0, SR:2, SSR:2 },
  11: { R:0, SR:1, SSR:3 },
  12: { R:0, SR:0, SSR:4 },
}

// ===== 精英关法宝配额（每章 4 把，奇数关出法宝） =====
const ELITE_WPN_QUOTA = {
  1:  { R:4, SR:0, SSR:0 },
  2:  { R:2, SR:2, SSR:0 },
  3:  { R:1, SR:3, SSR:0 },
  4:  { R:0, SR:4, SSR:0 },
  5:  { R:0, SR:3, SSR:1 },
  6:  { R:0, SR:2, SSR:2 },
  7:  { R:0, SR:1, SSR:3 },
  8:  { R:0, SR:1, SSR:3 },
  9:  { R:0, SR:0, SSR:4 },
  10: { R:0, SR:0, SSR:4 },
  11: { R:0, SR:0, SSR:4 },
  12: { R:0, SR:0, SSR:4 },
}

// ===== Boss 关(x-8)保底品质 =====
const BOSS_REWARD_MIN_RARITY = {
  normalPet:  { 1:'SR', 2:'SR', 3:'SR', 4:'SR', 5:'SR', 6:'SR',
                7:'SR', 8:'SSR', 9:'SR', 10:'SSR', 11:'SSR', 12:'SSR' },
  elitePet:   { 1:'SR', 2:'SR', 3:'SR', 4:'SR', 5:'SR', 6:'SR',
                7:'SSR', 8:'SR', 9:'SSR', 10:'SSR', 11:'SSR', 12:'SSR' },
  normalWpn:  { 1:'R', 2:'R',  3:'R',  4:'SR', 5:'SR', 6:'SR',
                7:'SR', 8:'SR', 9:'SSR', 10:'SSR', 11:'SSR', 12:'SSR' },
  eliteWpn:   { 1:'R', 2:'R',  3:'SR', 4:'SR', 5:'SR', 6:'SSR',
                7:'SSR', 8:'SSR', 9:'SSR', 10:'SSR', 11:'SSR', 12:'SSR' },
}

// ===== 宠物奖励特殊覆盖（前几关避免与新手赠送重复） =====
// 普通关: 'ch_ord'，精英关: 'ch_orde'
const STAGE_REWARD_PET_OVERRIDES = {
  '1_1': 'f1',
  '1_2': 'm2',
  '1_3': 'w2',
}

module.exports = {
  STAGE_EXP,
  STAGE_SOUL_STONE,
  STAGE_RATING,
  STAGE_ELITE_COEFFS,
  STAGE_ELITE_SKILL_COUNT,
  STAGE_TEAM_SIZE,
  FIRST_CLEAR_FRAG_COUNT,
  ELITE_MINION_HP_SCALE,
  CHAPTER_RECOMMENDED,
  NORMAL_PET_QUOTA,
  ELITE_PET_QUOTA,
  NORMAL_WPN_QUOTA,
  ELITE_WPN_QUOTA,
  BOSS_REWARD_MIN_RARITY,
  STAGE_REWARD_PET_OVERRIDES,
}
