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

// ===== Roguelike 随机掉落权重（每章基础概率，总和不必 =100，按权重抽取） =====
const PET_DROP_WEIGHTS = {
  1:  { R: 88, SR: 12, SSR: 0 },
  2:  { R: 78, SR: 22, SSR: 0 },
  3:  { R: 65, SR: 34, SSR: 1 },
  4:  { R: 48, SR: 50, SSR: 2 },
  5:  { R: 30, SR: 66, SSR: 4 },
  6:  { R: 15, SR: 79, SSR: 6 },
  7:  { R: 0,  SR: 90, SSR: 10 },
  8:  { R: 0,  SR: 87, SSR: 13 },
  9:  { R: 0,  SR: 83, SSR: 17 },
  10: { R: 0,  SR: 78, SSR: 22 },
  11: { R: 0,  SR: 73, SSR: 27 },
  12: { R: 0,  SR: 68, SSR: 32 },
}

const WPN_DROP_WEIGHTS = {
  1:  { R: 92, SR: 8,  SSR: 0 },
  2:  { R: 82, SR: 18, SSR: 0 },
  3:  { R: 68, SR: 31, SSR: 1 },
  4:  { R: 50, SR: 48, SSR: 2 },
  5:  { R: 32, SR: 64, SSR: 4 },
  6:  { R: 15, SR: 79, SSR: 6 },
  7:  { R: 0,  SR: 90, SSR: 10 },
  8:  { R: 0,  SR: 85, SSR: 15 },
  9:  { R: 0,  SR: 80, SSR: 20 },
  10: { R: 0,  SR: 74, SSR: 26 },
  11: { R: 0,  SR: 67, SSR: 33 },
  12: { R: 0,  SR: 60, SSR: 40 },
}

// 精英关 / Boss 关额外加成（叠加到基础权重后归一化抽取）
const ELITE_RARITY_BONUS = { SR: 3, SSR: 5 }
const BOSS_RARITY_BONUS  = { SR: 3, SSR: 8 }

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
  PET_DROP_WEIGHTS,
  WPN_DROP_WEIGHTS,
  ELITE_RARITY_BONUS,
  BOSS_RARITY_BONUS,
  STAGE_REWARD_PET_OVERRIDES,
}
