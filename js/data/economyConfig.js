/**
 * 经济系统配置 — 灵宠消消塔
 * 集中管理所有经济数值：货币定义、品质视觉、章节奖励、通天塔奖励、派遣奖励
 * 适配 5章 × 8关 普通/精英双难度 = 80关
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
}

// ===== 星级视觉配置 =====
const STAR_VISUAL = {
  1: { color: '#888888', name: '初始',  effect: 'none' },
  2: { color: '#ffd700', name: '觉知',  effect: 'none' },
  3: { color: '#ffd700', name: '通灵',  effect: 'glow' },
  4: { color: '#b44dff', name: '觉醒',  effect: 'aura' },
  5: { color: '#ff4d9a', name: '超越',  effect: 'rainbow' },
}

// ===== 每章关卡数 =====
const STAGES_PER_CHAPTER = 8

// ===== 各章节秘境奖励配置（索引 0-7 对应本章第 1-8 关） =====
// 普通难度和精英难度分别配置
const STAGE_REWARDS = {
  1: {
    normal: {
      soulStone: { first: [40,50,60,80,100,120,150,200],   repeat: [20,25,25,30,30,35,40,50] },
      fragment:  { first: [0,0,2,2,2,3,3,4],                repeat: [1,1,1,1,2,2,2,3] },
      awakenStone: { first: [0,0,0,0,0,0,0,0],             repeat: 0 },
    },
    elite: {
      soulStone: { first: [60,80,100,120,150,180,200,300],  repeat: [30,35,40,45,50,55,60,80] },
      fragment:  { first: [3,3,3,4,4,4,5,5],                repeat: [2,2,2,2,3,3,3,4] },
      awakenStone: { first: [0,0,0,0,0,0,0,0],             repeat: 0 },
    },
  },
  2: {
    normal: {
      soulStone: { first: [80,100,120,150,150,180,200,250],  repeat: [40,45,50,55,60,70,80,100] },
      fragment:  { first: [2,2,3,3,3,4,4,5],                 repeat: [2,2,2,3,3,3,3,4] },
      awakenStone: { first: [0,0,0,0,0,0,0,0],              repeat: 0 },
    },
    elite: {
      soulStone: { first: [120,150,180,220,220,270,300,380], repeat: [60,70,80,85,90,100,120,150] },
      fragment:  { first: [4,4,5,5,5,6,6,8],                 repeat: [3,3,3,4,4,4,5,6] },
      awakenStone: { first: [0,0,0,0,0,0,0,0],              repeat: 0 },
    },
  },
  3: {
    normal: {
      soulStone: { first: [150,180,200,220,250,280,300,350],  repeat: [80,90,100,110,120,130,140,150] },
      fragment:  { first: [3,3,4,4,5,5,6,8],                  repeat: [3,3,3,4,4,4,5,5] },
      awakenStone: { first: [0,0,1,1,1,1,1,2],               repeat: 0.10 },
    },
    elite: {
      soulStone: { first: [220,270,300,330,380,420,450,530],  repeat: [120,130,150,160,180,200,210,230] },
      fragment:  { first: [5,6,6,7,7,8,8,10],                 repeat: [4,5,5,5,6,6,6,8] },
      awakenStone: { first: [1,1,1,1,2,2,2,3],               repeat: 0.15 },
    },
  },
  4: {
    normal: {
      soulStone: { first: [250,280,300,330,350,380,400,500],  repeat: [120,130,140,150,160,170,190,200] },
      fragment:  { first: [5,5,6,6,8,8,8,10],                 repeat: [4,4,4,5,5,5,6,6] },
      awakenStone: { first: [1,1,1,2,2,2,2,3],               repeat: 0.12 },
    },
    elite: {
      soulStone: { first: [380,420,450,500,530,570,600,750],  repeat: [180,200,210,230,240,260,280,300] },
      fragment:  { first: [8,8,9,9,10,10,12,15],              repeat: [6,6,7,7,8,8,9,10] },
      awakenStone: { first: [2,2,2,3,3,3,4,5],               repeat: 0.20 },
    },
  },
  5: {
    normal: {
      soulStone: { first: [350,380,400,440,460,500,550,700],   repeat: [160,180,200,220,240,260,280,300] },
      fragment:  { first: [6,6,8,8,8,10,10,12],                repeat: [5,5,6,6,6,7,7,8] },
      awakenStone: { first: [2,2,2,3,3,3,4,5],                repeat: 0.15 },
    },
    elite: {
      soulStone: { first: [530,570,600,660,690,750,830,1050],  repeat: [240,270,300,330,360,400,420,450] },
      fragment:  { first: [10,10,12,12,14,14,15,18],            repeat: [8,8,9,9,10,10,12,14] },
      awakenStone: { first: [3,3,4,4,5,5,6,8],                repeat: 0.25 },
    },
  },
}

// ===== 关卡星级奖励（2★/3★首次达成增量奖励，普通和精英共用同一套配置） =====
// 索引 0-7 对应本章第 1-8 关
const STAR_REWARDS = {
  1: [
    { star2: { soulStone: 15, fragment: 0 },  star3: { soulStone: 25, fragment: 1 } },
    { star2: { soulStone: 15, fragment: 0 },  star3: { soulStone: 25, fragment: 1 } },
    { star2: { soulStone: 20, fragment: 1 },  star3: { soulStone: 30, fragment: 2 } },
    { star2: { soulStone: 20, fragment: 1 },  star3: { soulStone: 30, fragment: 2 } },
    { star2: { soulStone: 25, fragment: 1 },  star3: { soulStone: 40, fragment: 2 } },
    { star2: { soulStone: 25, fragment: 1 },  star3: { soulStone: 40, fragment: 2 } },
    { star2: { soulStone: 30, fragment: 2 },  star3: { soulStone: 50, fragment: 3 } },
    { star2: { soulStone: 40, fragment: 2 },  star3: { soulStone: 60, fragment: 3 } },
  ],
  2: [
    { star2: { soulStone: 40, fragment: 2 },  star3: { soulStone: 60, fragment: 3 } },
    { star2: { soulStone: 40, fragment: 2 },  star3: { soulStone: 60, fragment: 3 } },
    { star2: { soulStone: 50, fragment: 2 },  star3: { soulStone: 70, fragment: 3 } },
    { star2: { soulStone: 50, fragment: 2 },  star3: { soulStone: 70, fragment: 4 } },
    { star2: { soulStone: 60, fragment: 3 },  star3: { soulStone: 80, fragment: 4 } },
    { star2: { soulStone: 60, fragment: 3 },  star3: { soulStone: 80, fragment: 4 } },
    { star2: { soulStone: 70, fragment: 3 },  star3: { soulStone: 100, fragment: 4 } },
    { star2: { soulStone: 80, fragment: 3 },  star3: { soulStone: 120, fragment: 5 } },
  ],
  3: [
    { star2: { soulStone: 60, fragment: 3 },  star3: { soulStone: 100, fragment: 4, awakenStone: 1 } },
    { star2: { soulStone: 60, fragment: 3 },  star3: { soulStone: 100, fragment: 4, awakenStone: 1 } },
    { star2: { soulStone: 70, fragment: 3 },  star3: { soulStone: 120, fragment: 5, awakenStone: 1 } },
    { star2: { soulStone: 70, fragment: 4 },  star3: { soulStone: 120, fragment: 5, awakenStone: 1 } },
    { star2: { soulStone: 80, fragment: 4 },  star3: { soulStone: 140, fragment: 5, awakenStone: 1 } },
    { star2: { soulStone: 80, fragment: 4 },  star3: { soulStone: 140, fragment: 5, awakenStone: 2 } },
    { star2: { soulStone: 100, fragment: 4 }, star3: { soulStone: 160, fragment: 6, awakenStone: 2 } },
    { star2: { soulStone: 110, fragment: 5 }, star3: { soulStone: 180, fragment: 6, awakenStone: 2 } },
  ],
  4: [
    { star2: { soulStone: 80, fragment: 4 },  star3: { soulStone: 130, fragment: 5, awakenStone: 2 } },
    { star2: { soulStone: 80, fragment: 4 },  star3: { soulStone: 130, fragment: 5, awakenStone: 2 } },
    { star2: { soulStone: 90, fragment: 4 },  star3: { soulStone: 150, fragment: 6, awakenStone: 2 } },
    { star2: { soulStone: 90, fragment: 5 },  star3: { soulStone: 150, fragment: 6, awakenStone: 2 } },
    { star2: { soulStone: 100, fragment: 5 }, star3: { soulStone: 170, fragment: 6, awakenStone: 3 } },
    { star2: { soulStone: 100, fragment: 5 }, star3: { soulStone: 170, fragment: 7, awakenStone: 3 } },
    { star2: { soulStone: 120, fragment: 5 }, star3: { soulStone: 200, fragment: 7, awakenStone: 3 } },
    { star2: { soulStone: 140, fragment: 6 }, star3: { soulStone: 220, fragment: 8, awakenStone: 3 } },
  ],
  5: [
    { star2: { soulStone: 120, fragment: 5 }, star3: { soulStone: 180, fragment: 7, awakenStone: 3 } },
    { star2: { soulStone: 120, fragment: 5 }, star3: { soulStone: 180, fragment: 7, awakenStone: 3 } },
    { star2: { soulStone: 140, fragment: 6 }, star3: { soulStone: 200, fragment: 8, awakenStone: 3 } },
    { star2: { soulStone: 140, fragment: 6 }, star3: { soulStone: 200, fragment: 8, awakenStone: 4 } },
    { star2: { soulStone: 160, fragment: 6 }, star3: { soulStone: 230, fragment: 8, awakenStone: 4 } },
    { star2: { soulStone: 160, fragment: 7 }, star3: { soulStone: 230, fragment: 9, awakenStone: 4 } },
    { star2: { soulStone: 200, fragment: 7 }, star3: { soulStone: 280, fragment: 9, awakenStone: 5 } },
    { star2: { soulStone: 220, fragment: 8 }, star3: { soulStone: 320, fragment: 10, awakenStone: 5 } },
  ],
}

// ===== 章节星级里程碑（8★ / 16★ / 24★，对应 8 关 × 3 星 = 24 满星） =====
// 普通和精英各自独立的里程碑
const CHAPTER_MILESTONES = {
  1: [
    { stars: 8,  rewards: { soulStone: 200 } },
    { stars: 16, rewards: { soulStone: 400, fragment: 3 } },
    { stars: 24, rewards: { soulStone: 600, fragment: 5 } },
  ],
  2: [
    { stars: 8,  rewards: { soulStone: 400 } },
    { stars: 16, rewards: { soulStone: 600, fragment: 5 } },
    { stars: 24, rewards: { soulStone: 800, fragment: 8 } },
  ],
  3: [
    { stars: 8,  rewards: { soulStone: 600, awakenStone: 1 } },
    { stars: 16, rewards: { soulStone: 800, fragment: 5, awakenStone: 2 } },
    { stars: 24, rewards: { soulStone: 1200, fragment: 10, awakenStone: 3 } },
  ],
  4: [
    { stars: 8,  rewards: { soulStone: 800, awakenStone: 2 } },
    { stars: 16, rewards: { soulStone: 1000, fragment: 8, awakenStone: 3 } },
    { stars: 24, rewards: { soulStone: 1500, fragment: 12, awakenStone: 5 } },
  ],
  5: [
    { stars: 8,  rewards: { soulStone: 1000, awakenStone: 3 } },
    { stars: 16, rewards: { soulStone: 1200, fragment: 10, awakenStone: 4 } },
    { stars: 24, rewards: { soulStone: 2000, fragment: 15, awakenStone: 8 } },
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

// ===== 工具函数：获取关卡奖励配置 =====

/**
 * 获取指定章节/关序/难度的奖励配置
 * @param {number} chapter 章节号 1-5
 * @param {number} order 关卡序号 1-8 (0-indexed internally)
 * @param {string} difficulty 'normal' | 'elite'
 */
function getStageRewardConfig(chapter, order, difficulty) {
  const chRewards = STAGE_REWARDS[chapter]
  if (!chRewards) return null
  const diffRewards = chRewards[difficulty || 'normal']
  if (!diffRewards) return null
  const idx = order - 1
  return {
    soulStone: {
      first: diffRewards.soulStone.first[idx] || 0,
      repeat: diffRewards.soulStone.repeat[idx] || 0,
    },
    fragment: {
      first: diffRewards.fragment.first[idx] || 0,
      repeat: diffRewards.fragment.repeat[idx] || 0,
    },
    awakenStone: {
      first: (diffRewards.awakenStone.first && diffRewards.awakenStone.first[idx]) || 0,
      repeat: diffRewards.awakenStone.repeat || 0,
    },
  }
}

/**
 * 获取指定章节/关序的星级奖励配置
 * @param {number} chapter 章节号 1-5
 * @param {number} order 关卡序号 1-8 (0-indexed internally)
 */
function getStarRewardConfig(chapter, order) {
  const chStars = STAR_REWARDS[chapter]
  if (!chStars) return null
  return chStars[order - 1] || null
}

module.exports = {
  CURRENCY,
  RARITY_VISUAL,
  STAR_VISUAL,
  STAGES_PER_CHAPTER,
  STAGE_REWARDS,
  STAR_REWARDS,
  CHAPTER_MILESTONES,
  TOWER_REWARDS,
  IDLE_REWARDS,
  getStageRewardConfig,
  getStarRewardConfig,
}
