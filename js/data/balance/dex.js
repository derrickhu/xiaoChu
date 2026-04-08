/**
 * 图鉴里程碑数值 — 收录阈值 / 奖励数值
 * 调优时只改此文件，dexConfig.js 自动读取
 */

// ===== 收录层级所需星级 =====
const DEX_COLLECT_STAR = 3

// ===== 属性里程碑阶梯需求 =====
const DEX_ELEM_MILESTONE_NEEDS = [5, 10, 15]

// ===== 总量里程碑 =====
const DEX_TOTAL_MILESTONES = [
  { need: 10,  tier: 'discovered', reward: { soulStone: 300 } },
  { need: 25,  tier: 'discovered', reward: { soulStone: 500, awakenStone: 1 } },
  { need: 40,  tier: 'collected',  reward: { soulStone: 1000, awakenStone: 3 } },
  { need: 60,  tier: 'collected',  reward: { soulStone: 2000, awakenStone: 5 } },
  { need: 80,  tier: 'collected',  reward: { soulStone: 3000, awakenStone: 8 } },
  { need: 100, tier: 'mastered',   reward: { soulStone: 5000, awakenStone: 15 } },
]

module.exports = {
  DEX_COLLECT_STAR,
  DEX_ELEM_MILESTONE_NEEDS,
  DEX_TOTAL_MILESTONES,
}
