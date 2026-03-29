/**
 * 经济系统配置 — 灵宠消消塔
 * 集中管理所有经济数值：货币定义、品质视觉、章节奖励、通天塔奖励、派遣奖励
 * 调整数值只需改此文件，逻辑代码只读取配置
 */

// ===== 货币定义 =====
const CURRENCY = {
  soulStone:   { name: '灵石',   icon: 'icon_soul_stone',   desc: '宠物升级的通用货币' },
  awakenStone: { name: '觉醒石', icon: 'icon_awaken_stone', desc: '★4/★5突破的稀缺材料' },
  fragment:    { name: '碎片',   icon: 'icon_fragment',     desc: '宠物升星的专属材料' },
}

// ===== 品质视觉配置（R/SR/SSR，预留 UR 扩展） =====
const RARITY_VISUAL = {
  R: {
    label: 'R', name: '稀有',
    borderColor: '#4dcc4d',
    bgGradient: ['#1a3a1a', '#2a5a2a'],
    glowColor: 'rgba(77,204,77,0.3)',
    badgeColor: '#4dcc4d',
    badgeBg: 'rgba(30,80,30,0.85)',
  },
  SR: {
    label: 'SR', name: '超稀有',
    borderColor: '#b44dff',
    bgGradient: ['#2a1a3a', '#4a2a6a'],
    glowColor: 'rgba(180,77,255,0.4)',
    badgeColor: '#b44dff',
    badgeBg: 'rgba(60,20,100,0.85)',
  },
  SSR: {
    label: 'SSR', name: '传说',
    borderColor: '#ffd700',
    bgGradient: ['#3a3010', '#5a4a20'],
    glowColor: 'rgba(255,215,0,0.5)',
    badgeColor: '#ffd700',
    badgeBg: 'rgba(100,80,10,0.85)',
    hasParticles: true,
  },
  // 预留扩展
  // UR: { label: 'UR', name: '超越传说', borderColor: '#ff4d9a', ... },
}

// ===== 星级视觉配置 =====
const STAR_VISUAL = {
  1: { color: '#888888', name: '初始',  effect: 'none' },
  2: { color: '#ffd700', name: '觉知',  effect: 'none' },
  3: { color: '#ffd700', name: '通灵',  effect: 'glow' },
  4: { color: '#b44dff', name: '觉醒',  effect: 'aura' },
  5: { color: '#ff4d9a', name: '超越',  effect: 'rainbow' },
}

// ===== 各章节秘境奖励配置（按关卡顺序 1-5） =====
const STAGE_REWARDS = {
  1: {
    soulStone:   { first: [50, 80, 120, 150, 200],  repeat: [30, 35, 40, 45, 50] },
    fragment:    { first: [5, 8, 8, 10, 12],         repeat: [3, 3, 4, 4, 5] },
    awakenStone: { first: [0, 0, 0, 0, 0],           repeat: 0 },
  },
  2: {
    soulStone:   { first: [120, 150, 180, 200, 250], repeat: [60, 70, 80, 90, 100] },
    fragment:    { first: [8, 10, 10, 12, 15],        repeat: [4, 4, 5, 5, 6] },
    awakenStone: { first: [0, 0, 0, 0, 0],           repeat: 0 },
  },
  3: {
    soulStone:   { first: [200, 220, 250, 280, 350], repeat: [100, 110, 120, 130, 150] },
    fragment:    { first: [10, 12, 12, 14, 16],       repeat: [5, 5, 6, 6, 7] },
    awakenStone: { first: [1, 1, 1, 2, 2],           repeat: 0.15 },
  },
  4: {
    soulStone:   { first: [300, 330, 360, 400, 500], repeat: [130, 140, 150, 170, 200] },
    fragment:    { first: [12, 14, 14, 16, 18],       repeat: [6, 6, 7, 7, 8] },
    awakenStone: { first: [2, 2, 2, 3, 3],           repeat: 0.15 },
  },
  5: {
    soulStone:   { first: [400, 440, 480, 520, 650], repeat: [180, 200, 220, 250, 300] },
    fragment:    { first: [14, 16, 16, 18, 20],       repeat: [7, 8, 8, 9, 10] },
    awakenStone: { first: [3, 3, 4, 4, 5],           repeat: 0.20 },
  },
}

// ===== 关卡星级奖励（2★/3★首次达成增量奖励，1★=现有firstClear） =====
// 索引 0–4 对应本章第 1–5 关
const STAR_REWARDS = {
  1: [
    { star2: { soulStone: 20, fragment: 2 },  star3: { soulStone: 30, fragment: 3 } },
    { star2: { soulStone: 30, fragment: 2 },  star3: { soulStone: 40, fragment: 3 } },
    { star2: { soulStone: 40, fragment: 3 },  star3: { soulStone: 50, fragment: 4 } },
    { star2: { soulStone: 50, fragment: 3 },  star3: { soulStone: 60, fragment: 4 } },
    { star2: { soulStone: 60, fragment: 4 },  star3: { soulStone: 80, fragment: 5 } },
  ],
  2: [
    { star2: { soulStone: 50, fragment: 3 },  star3: { soulStone: 80, fragment: 4 } },
    { star2: { soulStone: 60, fragment: 3 },  star3: { soulStone: 90, fragment: 4 } },
    { star2: { soulStone: 70, fragment: 4 },  star3: { soulStone: 100, fragment: 5 } },
    { star2: { soulStone: 80, fragment: 4 },  star3: { soulStone: 120, fragment: 5 } },
    { star2: { soulStone: 100, fragment: 5 }, star3: { soulStone: 150, fragment: 6 } },
  ],
  3: [
    { star2: { soulStone: 80, fragment: 4 },  star3: { soulStone: 120, fragment: 5, awakenStone: 1 } },
    { star2: { soulStone: 90, fragment: 4 },  star3: { soulStone: 130, fragment: 5, awakenStone: 1 } },
    { star2: { soulStone: 100, fragment: 5 }, star3: { soulStone: 150, fragment: 6, awakenStone: 1 } },
    { star2: { soulStone: 110, fragment: 5 }, star3: { soulStone: 170, fragment: 6, awakenStone: 2 } },
    { star2: { soulStone: 130, fragment: 6 }, star3: { soulStone: 200, fragment: 7, awakenStone: 2 } },
  ],
  4: [
    { star2: { soulStone: 100, fragment: 5 }, star3: { soulStone: 150, fragment: 6, awakenStone: 2 } },
    { star2: { soulStone: 110, fragment: 5 }, star3: { soulStone: 170, fragment: 6, awakenStone: 2 } },
    { star2: { soulStone: 120, fragment: 6 }, star3: { soulStone: 180, fragment: 7, awakenStone: 2 } },
    { star2: { soulStone: 140, fragment: 6 }, star3: { soulStone: 200, fragment: 7, awakenStone: 3 } },
    { star2: { soulStone: 160, fragment: 7 }, star3: { soulStone: 250, fragment: 8, awakenStone: 3 } },
  ],
  5: [
    { star2: { soulStone: 150, fragment: 6 }, star3: { soulStone: 200, fragment: 8, awakenStone: 3 } },
    { star2: { soulStone: 160, fragment: 6 }, star3: { soulStone: 220, fragment: 8, awakenStone: 3 } },
    { star2: { soulStone: 180, fragment: 7 }, star3: { soulStone: 250, fragment: 9, awakenStone: 4 } },
    { star2: { soulStone: 200, fragment: 7 }, star3: { soulStone: 280, fragment: 9, awakenStone: 4 } },
    { star2: { soulStone: 250, fragment: 8 }, star3: { soulStone: 350, fragment: 10, awakenStone: 5 } },
  ],
}

// ===== 章节星级里程碑（5★ / 10★ / 15★） =====
const CHAPTER_MILESTONES = {
  1: [
    { stars: 5,  rewards: { soulStone: 200 } },
    { stars: 10, rewards: { soulStone: 400, fragment: 10 } },
    { stars: 15, rewards: { soulStone: 600, fragment: 15 } },
  ],
  2: [
    { stars: 5,  rewards: { soulStone: 400 } },
    { stars: 10, rewards: { soulStone: 600, fragment: 15 } },
    { stars: 15, rewards: { soulStone: 800, fragment: 20, awakenStone: 1 } },
  ],
  3: [
    { stars: 5,  rewards: { soulStone: 600, awakenStone: 1 } },
    { stars: 10, rewards: { soulStone: 800, fragment: 15, awakenStone: 2 } },
    { stars: 15, rewards: { soulStone: 1200, fragment: 20, awakenStone: 3 } },
  ],
  4: [
    { stars: 5,  rewards: { soulStone: 800, awakenStone: 2 } },
    { stars: 10, rewards: { soulStone: 1000, fragment: 20, awakenStone: 3 } },
    { stars: 15, rewards: { soulStone: 1500, fragment: 25, awakenStone: 5 } },
  ],
  5: [
    { stars: 5,  rewards: { soulStone: 1000, awakenStone: 3 } },
    { stars: 10, rewards: { soulStone: 1200, fragment: 20, awakenStone: 4 } },
    { stars: 15, rewards: { soulStone: 2000, fragment: 30, awakenStone: 8 } },
  ],
}

// ===== 通天塔奖励配置 =====
const TOWER_REWARDS = {
  soulStonePerFloor: 5,
  soulStoneClearBonus: 200,
  fragmentPerFloor: 1,
  fragmentClearBonus: 20,
  awakenStonePerBoss: 1,
}

// ===== 派遣奖励配置 =====
const IDLE_REWARDS = {
  soulStonePerHour: 8,
  awakenStonePerDay: 1,
}

module.exports = {
  CURRENCY,
  RARITY_VISUAL,
  STAR_VISUAL,
  STAGE_REWARDS,
  STAR_REWARDS,
  CHAPTER_MILESTONES,
  TOWER_REWARDS,
  IDLE_REWARDS,
}
