/**
 * 宠物星级 / 攻击力成长 / 稀有度权重
 * 调优时只改此文件
 */

// 局内（肉鸽/秘境）星级倍率
const STAR_ATK_MUL = 1.3
const STAR_SKILL_MUL = 1.25

// 不同获取渠道的品质权重
const RARITY_WEIGHTS = {
  starter:   { R:100, SR:0,  SSR:0  },
  normal:    { R:50,  SR:40, SSR:10 },
  elite:     { R:15,  SR:55, SSR:30 },
  boss:      { R:0,   SR:40, SSR:60 },
  shop:      { R:30,  SR:50, SSR:20 },
  adventure: { R:0,   SR:30, SSR:70 },
}

// 随机宠物偏向已有宠的概率（30%）
const PET_BIAS_RATE = 0.3

module.exports = {
  STAR_ATK_MUL,
  STAR_SKILL_MUL,
  RARITY_WEIGHTS,
  PET_BIAS_RATE,
}
