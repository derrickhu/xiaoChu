/**
 * 固定关卡配置 — 5章×5关 = 25关
 * 全局线性解锁：stage_1_1 → stage_1_2 → ... → stage_5_5
 * 体力按章节分档，1-1免费
 */

const { STAGE_REWARDS } = require('./economyConfig')

// ===== 章节体力配置（同章统一，跨章递增） =====
const CHAPTER_STAMINA = { 1: 5, 2: 8, 3: 12, 4: 15, 5: 18 }

// ===== 章节 =====
const CHAPTERS = [
  { id: 1, name: '灵山试炼', desc: '灵山脚下，试炼开始', unlockPool: 0 },
  { id: 2, name: '幽冥秘境', desc: '幽暗深处，危机四伏', unlockPool: 0 },
  { id: 3, name: '天劫雷域', desc: '九天雷劫，唯强者渡', unlockPool: 0 },
  { id: 4, name: '仙灵古域', desc: '上古遗境，灵气纵横', unlockPool: 0 },
  { id: 5, name: '万妖禁地', desc: '妖族圣域，终极之战', unlockPool: 0 },
]

// ===== 关卡 =====
const STAGES = [

  // ── 第一章：灵山试炼（新手教学章） ──
  // 设计原则：单怪单波，HP/ATK/DEF 逐关递增，新手友好

  {
    id: 'stage_1_1', name: '初试·岩獾', chapter: 1, order: 1,
    waves: [
      { enemies: [{ name: '岩獾', attr: 'earth', hp: 300, atk: 12, def: 5, skills: ['convert'], avatar: 'stage_enemies/rock_badger', newbieOverride: { hp: 80, atk: 4, def: 0 } }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 3, a: 5 },
    staminaCost: 0,
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm1', fragCount: 10 },
        { type: 'pet', petId: 'w1', fragCount: 10 },
        { type: 'pet', petId: 's1', fragCount: 10 },
        { type: 'exp', amount: 100 },
        { type: 'soulStone', amount: STAGE_REWARDS[1].soulStone.first[0] },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 80, soulStone: STAGE_REWARDS[1].soulStone.repeat[0] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: null },
    battleSoulStone: 30,
  },
  {
    id: 'stage_1_2', name: '烈焰·焰狮', chapter: 1, order: 2,
    waves: [
      { enemies: [{ name: '焰狮', attr: 'fire', hp: 500, atk: 18, def: 6, skills: ['atkBuff', 'poison'], avatar: 'stage_enemies/blaze_lion' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 4, a: 6 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'f1', fragCount: 10 },
        { type: 'pet', petId: 'e1', fragCount: 10 },
        { type: 'fragment', target: 'random_fire', count: 5 },
        { type: 'exp', amount: 200 },
        { type: 'soulStone', amount: STAGE_REWARDS[1].soulStone.first[1] },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 100, soulStone: STAGE_REWARDS[1].soulStone.repeat[1] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_1' },
    battleSoulStone: 40,
  },
  {
    id: 'stage_1_3', name: '寒潮·碧潮鲸', chapter: 1, order: 3,
    waves: [
      { enemies: [{ name: '碧潮鲸', attr: 'water', hp: 650, atk: 22, def: 8, skills: ['healPct', 'convert', 'defBuff'], avatar: 'stage_enemies/tide_whale' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 4, a: 7 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 's4', fragCount: 10 },
        { type: 'fragment', target: 'random_water', count: 8 },
        { type: 'exp', amount: 300 },
        { type: 'soulStone', amount: STAGE_REWARDS[1].soulStone.first[2] },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 100, soulStone: STAGE_REWARDS[1].soulStone.repeat[2] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_2' },
    battleSoulStone: 40,
  },
  {
    id: 'stage_1_4', name: '金锋·雷貂', chapter: 1, order: 4,
    waves: [
      { enemies: [{ name: '雷貂', attr: 'metal', hp: 800, atk: 25, def: 10, skills: ['atkBuff', 'stun', 'defDown'], avatar: 'stage_enemies/thunder_marten' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 8 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm4', fragCount: 10 },
        { type: 'fragment', target: 'random_metal', count: 10 },
        { type: 'exp', amount: 400 },
        { type: 'soulStone', amount: STAGE_REWARDS[1].soulStone.first[3] },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 120, soulStone: STAGE_REWARDS[1].soulStone.repeat[3] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_3' },
    battleSoulStone: 50,
  },
  {
    id: 'stage_1_5', name: '灵山守关·灵木麒麟', chapter: 1, order: 5,
    waves: [
      { enemies: [{ name: '灵木麒麟', attr: 'wood', hp: 1200, atk: 30, def: 12, skills: ['atkBuff', 'healPct', 'seal', 'bossQuake'], avatar: 'stage_enemies/wood_qilin_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 9 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'w5', fragCount: 10 },
        { type: 'fragment', target: 'random_wood', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'soulStone', amount: STAGE_REWARDS[1].soulStone.first[4] },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 150, soulStone: STAGE_REWARDS[1].soulStone.repeat[4] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_4' },
    battleSoulStone: 60,
  },

  // ── 第二章：幽冥秘境 ──

  {
    id: 'stage_2_1', name: '幽影·月光水母', chapter: 2, order: 1,
    waves: [
      { enemies: [{ name: '月光水母', attr: 'water', hp: 1400, atk: 32, def: 12, skills: ['atkBuff', 'timeSqueeze', 'poison'], avatar: 'stage_enemies/moon_jellyfish' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 8 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 's10', fragCount: 10 },
        { type: 'fragment', target: 'random_water', count: 10 },
        { type: 'exp', amount: 400 },
        { type: 'soulStone', amount: STAGE_REWARDS[2].soulStone.first[0] },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 150, soulStone: STAGE_REWARDS[2].soulStone.repeat[0] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_5' },
    battleSoulStone: 50,
  },
  {
    id: 'stage_2_2', name: '烈焰·炽焰古龙', chapter: 2, order: 2,
    waves: [
      { enemies: [{ name: '炽焰古龙', attr: 'fire', hp: 1800, atk: 38, def: 14, skills: ['atkBuff', 'defBuff', 'bossInferno', 'bossBlitz'], avatar: 'stage_enemies/inferno_dragon_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 9 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'f10', fragCount: 10 },
        { type: 'fragment', target: 'random_fire', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'soulStone', amount: STAGE_REWARDS[2].soulStone.first[1] },
      ],
      repeatClear: { fragments: { min: 5, max: 7, pool: 'chapter' }, exp: 170, soulStone: STAGE_REWARDS[2].soulStone.repeat[1] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_1' },
    battleSoulStone: 60,
  },
  {
    id: 'stage_2_3', name: '冥土·玄岩貔貅', chapter: 2, order: 3,
    waves: [
      { enemies: [{ name: '玄岩貔貅', attr: 'earth', hp: 2000, atk: 36, def: 18, skills: ['defBuff', 'healPct', 'bossMirror', 'bossQuake'], avatar: 'stage_enemies/rock_pixiu_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 9 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'e10', fragCount: 10 },
        { type: 'fragment', target: 'random_earth', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'soulStone', amount: STAGE_REWARDS[2].soulStone.first[2] },
      ],
      repeatClear: { fragments: { min: 5, max: 7, pool: 'chapter' }, exp: 170, soulStone: STAGE_REWARDS[2].soulStone.repeat[2] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_2' },
    battleSoulStone: 60,
  },
  {
    id: 'stage_2_4', name: '金风·雷虎', chapter: 2, order: 4,
    waves: [
      { enemies: [{ name: '雷虎', attr: 'metal', hp: 2200, atk: 40, def: 16, skills: ['atkBuff', 'defBuff', 'bossWeaken', 'bossBlitz', 'breakBead'], avatar: 'stage_enemies/storm_tiger_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 10 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm10', fragCount: 10 },
        { type: 'fragment', target: 'random_metal', count: 14 },
        { type: 'exp', amount: 600 },
        { type: 'soulStone', amount: STAGE_REWARDS[2].soulStone.first[3] },
      ],
      repeatClear: { fragments: { min: 6, max: 8, pool: 'chapter' }, exp: 190, soulStone: STAGE_REWARDS[2].soulStone.repeat[3] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_3' },
    battleSoulStone: 70,
  },
  {
    id: 'stage_2_5', name: '幽冥深渊·百花蟒仙', chapter: 2, order: 5,
    waves: [
      { enemies: [{ name: '百花蟒仙', attr: 'wood', hp: 3000, atk: 44, def: 18, skills: ['atkBuff', 'healPct', 'bossDevour', 'bossInferno', 'counterSeal'], avatar: 'stage_enemies/flora_serpent_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'w10', fragCount: 10 },
        { type: 'fragment', target: 'random_wood', count: 15 },
        { type: 'exp', amount: 700 },
        { type: 'soulStone', amount: STAGE_REWARDS[2].soulStone.first[4] },
      ],
      repeatClear: { fragments: { min: 6, max: 8, pool: 'chapter' }, exp: 220, soulStone: STAGE_REWARDS[2].soulStone.repeat[4] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_4' },
    battleSoulStone: 80,
  },

  // ── 第三章：天劫雷域（开始掉落觉醒石） ──

  {
    id: 'stage_3_1', name: '天劫·焰天狮王', chapter: 3, order: 1,
    waves: [
      { enemies: [{ name: '焰天狮王', attr: 'fire', hp: 2800, atk: 44, def: 16, skills: ['atkBuff', 'defBuff', 'bossRage', 'bossAnnihil', 'bossInferno'], avatar: 'stage_enemies/inferno_lion_king_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 9 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'f16', fragCount: 10 },
        { type: 'fragment', target: 'random_fire', count: 14 },
        { type: 'exp', amount: 600 },
        { type: 'soulStone', amount: STAGE_REWARDS[3].soulStone.first[0] },
        { type: 'awakenStone', amount: STAGE_REWARDS[3].awakenStone.first[0] },
      ],
      repeatClear: { fragments: { min: 5, max: 8, pool: 'chapter' }, exp: 250, soulStone: STAGE_REWARDS[3].soulStone.repeat[0] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_5' },
    battleSoulStone: 70,
  },
  {
    id: 'stage_3_2', name: '寒劫·碧海玄武', chapter: 3, order: 2,
    waves: [
      { enemies: [{ name: '碧海玄武', attr: 'water', hp: 3200, atk: 48, def: 20, skills: ['defBuff', 'healPct', 'bossMirror', 'bossDrain', 'timeSqueeze'], avatar: 'stage_enemies/ocean_xuanwu_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 10 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 's17', fragCount: 10 },
        { type: 'fragment', target: 'random_water', count: 14 },
        { type: 'exp', amount: 700 },
        { type: 'soulStone', amount: STAGE_REWARDS[3].soulStone.first[1] },
        { type: 'awakenStone', amount: STAGE_REWARDS[3].awakenStone.first[1] },
      ],
      repeatClear: { fragments: { min: 6, max: 9, pool: 'chapter' }, exp: 280, soulStone: STAGE_REWARDS[3].soulStone.repeat[1] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_1' },
    battleSoulStone: 80,
  },
  {
    id: 'stage_3_3', name: '岩劫·磐牛', chapter: 3, order: 3,
    waves: [
      { enemies: [{ name: '磐牛', attr: 'earth', hp: 3800, atk: 52, def: 22, skills: ['atkBuff', 'defBuff', 'bossQuake', 'bossWeaken', 'breakBead'], avatar: 'stage_enemies/boulder_ox_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'e18', fragCount: 10 },
        { type: 'fragment', target: 'random_earth', count: 16 },
        { type: 'exp', amount: 800 },
        { type: 'soulStone', amount: STAGE_REWARDS[3].soulStone.first[2] },
        { type: 'awakenStone', amount: STAGE_REWARDS[3].awakenStone.first[2] },
      ],
      repeatClear: { fragments: { min: 7, max: 10, pool: 'chapter' }, exp: 300, soulStone: STAGE_REWARDS[3].soulStone.repeat[2] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_2' },
    battleSoulStone: 90,
  },
  {
    id: 'stage_3_4', name: '刃劫·天罡白虎', chapter: 3, order: 4,
    waves: [
      { enemies: [{ name: '天罡白虎', attr: 'metal', hp: 4500, atk: 56, def: 24, skills: ['atkBuff', 'defBuff', 'bossWeaken', 'bossAnnihil', 'stun'], avatar: 'stage_enemies/celestial_white_tiger_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 12 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm18', fragCount: 10 },
        { type: 'fragment', target: 'random_metal', count: 16 },
        { type: 'exp', amount: 800 },
        { type: 'soulStone', amount: STAGE_REWARDS[3].soulStone.first[3] },
        { type: 'awakenStone', amount: STAGE_REWARDS[3].awakenStone.first[3] },
      ],
      repeatClear: { fragments: { min: 7, max: 10, pool: 'chapter' }, exp: 320, soulStone: STAGE_REWARDS[3].soulStone.repeat[3] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_3' },
    battleSoulStone: 100,
  },
  {
    id: 'stage_3_5', name: '天劫·万象龙神', chapter: 3, order: 5,
    waves: [
      { enemies: [{ name: '万象龙神', attr: 'earth', hp: 5200, atk: 60, def: 26, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse'], avatar: 'stage_enemies/cosmos_dragon_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 13 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'w20', fragCount: 10 },
        { type: 'fragment', target: 'random_all', count: 20 },
        { type: 'exp', amount: 1000 },
        { type: 'soulStone', amount: STAGE_REWARDS[3].soulStone.first[4] },
        { type: 'awakenStone', amount: STAGE_REWARDS[3].awakenStone.first[4] },
      ],
      repeatClear: { fragments: { min: 8, max: 10, pool: 'all' }, exp: 350, soulStone: STAGE_REWARDS[3].soulStone.repeat[4] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_4' },
    battleSoulStone: 120,
  },

  // ── 第四章：仙灵古域 ──

  {
    id: 'stage_4_1', name: '仙域·金甲妖将', chapter: 4, order: 1,
    waves: [
      { enemies: [{ name: '金甲妖将·碎天', attr: 'metal', hp: 4500, atk: 54, def: 26, skills: ['atkBuff', 'defDown', 'stun', 'bossBlitz', 'breakBead'], avatar: 'stage_enemies/metal_elite_general', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: CHAPTER_STAMINA[4],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_metal', count: 12 },
        { type: 'fragment', target: 'random_all', count: 12 },
        { type: 'exp', amount: 700 },
        { type: 'soulStone', amount: STAGE_REWARDS[4].soulStone.first[0] },
        { type: 'awakenStone', amount: STAGE_REWARDS[4].awakenStone.first[0] },
      ],
      repeatClear: { fragments: { min: 6, max: 9, pool: 'chapter' }, exp: 280, soulStone: STAGE_REWARDS[4].soulStone.repeat[0] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_5' },
    battleSoulStone: 100,
  },
  {
    id: 'stage_4_2', name: '仙域·深渊蛟魔', chapter: 4, order: 2,
    waves: [
      { enemies: [{ name: '深渊蛟魔·溺魂', attr: 'water', hp: 5200, atk: 58, def: 28, skills: ['atkBuff', 'defBuff', 'bossDrain', 'bossQuake', 'timeSqueeze'], avatar: 'stage_enemies/water_abyss_dragon', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 12 },
    staminaCost: CHAPTER_STAMINA[4],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_water', count: 14 },
        { type: 'fragment', target: 'random_all', count: 12 },
        { type: 'exp', amount: 800 },
        { type: 'soulStone', amount: STAGE_REWARDS[4].soulStone.first[1] },
        { type: 'awakenStone', amount: STAGE_REWARDS[4].awakenStone.first[1] },
      ],
      repeatClear: { fragments: { min: 7, max: 10, pool: 'chapter' }, exp: 300, soulStone: STAGE_REWARDS[4].soulStone.repeat[1] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_4_1' },
    battleSoulStone: 110,
  },
  {
    id: 'stage_4_3', name: '仙域·焚天魔凰', chapter: 4, order: 3,
    waves: [
      { enemies: [{ name: '焚天魔凰·灭世', attr: 'fire', hp: 6000, atk: 62, def: 28, skills: ['atkBuff', 'defBuff', 'bossInferno', 'bossAnnihil'], avatar: 'stage_enemies/fire_demon_phoenix', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 12 },
    staminaCost: CHAPTER_STAMINA[4],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_fire', count: 14 },
        { type: 'fragment', target: 'random_all', count: 14 },
        { type: 'exp', amount: 900 },
        { type: 'soulStone', amount: STAGE_REWARDS[4].soulStone.first[2] },
        { type: 'awakenStone', amount: STAGE_REWARDS[4].awakenStone.first[2] },
      ],
      repeatClear: { fragments: { min: 7, max: 10, pool: 'chapter' }, exp: 320, soulStone: STAGE_REWARDS[4].soulStone.repeat[2] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_4_2' },
    battleSoulStone: 120,
  },
  {
    id: 'stage_4_4', name: '仙域·镇地魔将', chapter: 4, order: 4,
    waves: [
      { enemies: [{ name: '镇地魔将', attr: 'earth', hp: 7000, atk: 66, def: 30, skills: ['atkBuff', 'defBuff', 'bossQuake', 'bossWeaken', 'bossRage', 'breakBead'], avatar: 'stage_enemies/earth_general', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 13 },
    staminaCost: CHAPTER_STAMINA[4],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_earth', count: 16 },
        { type: 'fragment', target: 'random_all', count: 14 },
        { type: 'exp', amount: 1000 },
        { type: 'soulStone', amount: STAGE_REWARDS[4].soulStone.first[3] },
        { type: 'awakenStone', amount: STAGE_REWARDS[4].awakenStone.first[3] },
      ],
      repeatClear: { fragments: { min: 8, max: 11, pool: 'chapter' }, exp: 350, soulStone: STAGE_REWARDS[4].soulStone.repeat[3] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_4_3' },
    battleSoulStone: 130,
  },
  {
    id: 'stage_4_5', name: '仙灵守关·上古仙灵', chapter: 4, order: 5,
    waves: [
      { enemies: [{ name: '上古仙灵·护界', attr: 'wood', hp: 8000, atk: 70, def: 30, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse', 'counterSeal'], avatar: 'stage_enemies/ancient_fairy_guardian', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 9, a: 14 },
    staminaCost: CHAPTER_STAMINA[4],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_wood', count: 18 },
        { type: 'fragment', target: 'random_all', count: 16 },
        { type: 'exp', amount: 1200 },
        { type: 'soulStone', amount: STAGE_REWARDS[4].soulStone.first[4] },
        { type: 'awakenStone', amount: STAGE_REWARDS[4].awakenStone.first[4] },
      ],
      repeatClear: { fragments: { min: 9, max: 12, pool: 'all' }, exp: 400, soulStone: STAGE_REWARDS[4].soulStone.repeat[4] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_4_4' },
    battleSoulStone: 150,
  },

  // ── 第五章：万妖禁地（终章） ──

  {
    id: 'stage_5_1', name: '禁地·炼狱守卫', chapter: 5, order: 1,
    waves: [
      { enemies: [{ name: '炼狱守卫·妖兵统领', attr: 'fire', hp: 7000, atk: 64, def: 28, skills: ['atkBuff', 'defBuff', 'bossRage', 'bossBlitz', 'bossAnnihil'], avatar: 'stage_enemies/purgatory_commander', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 12 },
    staminaCost: CHAPTER_STAMINA[5],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_fire', count: 14 },
        { type: 'fragment', target: 'random_all', count: 14 },
        { type: 'exp', amount: 900 },
        { type: 'soulStone', amount: STAGE_REWARDS[5].soulStone.first[0] },
        { type: 'awakenStone', amount: STAGE_REWARDS[5].awakenStone.first[0] },
      ],
      repeatClear: { fragments: { min: 8, max: 11, pool: 'chapter' }, exp: 350, soulStone: STAGE_REWARDS[5].soulStone.repeat[0] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_4_5' },
    battleSoulStone: 130,
  },
  {
    id: 'stage_5_2', name: '禁地·九天妖皇', chapter: 5, order: 2,
    waves: [
      { enemies: [{ name: '九天妖皇·逆仙', attr: 'water', hp: 8000, atk: 70, def: 32, skills: ['atkBuff', 'defBuff', 'healPct', 'bossDrain', 'bossUltimate', 'sealColumn'], avatar: 'stage_enemies/nine_heavens_emperor', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 13 },
    staminaCost: CHAPTER_STAMINA[5],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_water', count: 16 },
        { type: 'fragment', target: 'random_all', count: 14 },
        { type: 'exp', amount: 1000 },
        { type: 'soulStone', amount: STAGE_REWARDS[5].soulStone.first[1] },
        { type: 'awakenStone', amount: STAGE_REWARDS[5].awakenStone.first[1] },
      ],
      repeatClear: { fragments: { min: 9, max: 12, pool: 'chapter' }, exp: 380, soulStone: STAGE_REWARDS[5].soulStone.repeat[1] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_5_1' },
    battleSoulStone: 150,
  },
  {
    id: 'stage_5_3', name: '禁地·混沌魔神', chapter: 5, order: 3,
    waves: [
      { enemies: [{ name: '混沌魔神·灭世', attr: 'metal', hp: 9000, atk: 74, def: 34, skills: ['atkBuff', 'defBuff', 'bossWeaken', 'bossAnnihil', 'bossRage', 'stun'], avatar: 'stage_enemies/chaos_demon_god', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 9, a: 14 },
    staminaCost: CHAPTER_STAMINA[5],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_metal', count: 16 },
        { type: 'fragment', target: 'random_all', count: 16 },
        { type: 'exp', amount: 1100 },
        { type: 'soulStone', amount: STAGE_REWARDS[5].soulStone.first[2] },
        { type: 'awakenStone', amount: STAGE_REWARDS[5].awakenStone.first[2] },
      ],
      repeatClear: { fragments: { min: 9, max: 12, pool: 'chapter' }, exp: 400, soulStone: STAGE_REWARDS[5].soulStone.repeat[2] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_5_2' },
    battleSoulStone: 170,
  },
  {
    id: 'stage_5_4', name: '禁地·混沌始祖', chapter: 5, order: 4,
    waves: [
      { enemies: [{ name: '混沌始祖·鸿蒙', attr: 'earth', hp: 11000, atk: 78, def: 34, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse', 'bossAnnihil', 'bossMirror'], avatar: 'stage_enemies/primordial_ancestor', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 10, a: 15 },
    staminaCost: CHAPTER_STAMINA[5],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_earth', count: 18 },
        { type: 'fragment', target: 'random_all', count: 16 },
        { type: 'exp', amount: 1200 },
        { type: 'soulStone', amount: STAGE_REWARDS[5].soulStone.first[3] },
        { type: 'awakenStone', amount: STAGE_REWARDS[5].awakenStone.first[3] },
      ],
      repeatClear: { fragments: { min: 10, max: 13, pool: 'chapter' }, exp: 430, soulStone: STAGE_REWARDS[5].soulStone.repeat[3] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_5_3' },
    battleSoulStone: 190,
  },
  {
    id: 'stage_5_5', name: '终焉·万妖之主', chapter: 5, order: 5,
    waves: [
      { enemies: [{ name: '万妖之主·通天', attr: 'earth', hp: 13000, atk: 85, def: 36, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse', 'bossAnnihil', 'bossDevour'], avatar: 'stage_enemies/myriad_demon_lord', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 10, a: 16 },
    staminaCost: CHAPTER_STAMINA[5],
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_all', count: 20 },
        { type: 'fragment', target: 'random_all', count: 20 },
        { type: 'exp', amount: 1500 },
        { type: 'soulStone', amount: STAGE_REWARDS[5].soulStone.first[4] },
        { type: 'awakenStone', amount: STAGE_REWARDS[5].awakenStone.first[4] },
      ],
      repeatClear: { fragments: { min: 11, max: 14, pool: 'all' }, exp: 500, soulStone: STAGE_REWARDS[5].soulStone.repeat[4] },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_5_4' },
    battleSoulStone: 220,
  },
]

// ===== 评价优先级 =====
const RATING_ORDER = { B: 1, A: 2, S: 3 }

// ===== 查询接口 =====

function getStageById(id) {
  return STAGES.find(s => s.id === id)
}

function getChapterStages(chapterId) {
  return STAGES.filter(s => s.chapter === chapterId).sort((a, b) => a.order - b.order)
}

/**
 * 判断章节是否解锁 — 当该章节有任意一关已解锁时返回 true
 */
function isChapterUnlocked(chapterId, poolCount, clearRecord) {
  const stages = getChapterStages(chapterId)
  return stages.some(s => isStageUnlocked(s.id, clearRecord, poolCount))
}

/**
 * 判断关卡是否解锁 — 纯线性：首关直接开放，其余需前置关卡通关
 */
function isStageUnlocked(stageId, clearRecord, poolCount) {
  const stage = getStageById(stageId)
  if (!stage) return false
  if (!stage.unlockCondition || !stage.unlockCondition.prevStage) return true
  const prev = clearRecord && clearRecord[stage.unlockCondition.prevStage]
  return !!(prev && prev.cleared)
}

/**
 * 获取关卡的主要属性（按首波首敌判断，用于 UI 显示）
 */
function getStageAttr(stageId) {
  const stage = getStageById(stageId)
  if (!stage || !stage.waves.length) return null
  return (stage.waves[0].enemies[0] && stage.waves[0].enemies[0].attr) || null
}

/** 获取下一关 ID（同章节 order+1，或下一章节第一关） */
function getNextStageId(stageId) {
  const cur = getStageById(stageId)
  if (!cur) return null
  const sameCh = STAGES.filter(s => s.chapter === cur.chapter).sort((a, b) => a.order - b.order)
  const idx = sameCh.findIndex(s => s.id === stageId)
  if (idx >= 0 && idx + 1 < sameCh.length) return sameCh[idx + 1].id
  const nextCh = CHAPTERS.find(ch => ch.id === cur.chapter + 1)
  if (!nextCh) return null
  const nextChStages = STAGES.filter(s => s.chapter === nextCh.id).sort((a, b) => a.order - b.order)
  return nextChStages.length > 0 ? nextChStages[0].id : null
}

/** 获取可浏览关卡列表：所有已解锁 + 紧邻的下一个未解锁关卡（作为预告） */
function getBrowsableStages(clearRecord) {
  const result = []
  for (const stage of STAGES) {
    const unlocked = isStageUnlocked(stage.id, clearRecord, 0)
    result.push({ stage, unlocked })
    if (!unlocked) break
  }
  return result
}

/** 获取 Boss 头像路径（最后一波最后一个敌人） */
function getStageBossAvatar(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return null
  const lastWave = stage.waves[stage.waves.length - 1]
  const lastEnemy = lastWave.enemies[lastWave.enemies.length - 1]
  return lastEnemy ? `assets/${lastEnemy.avatar}.png` : null
}

/** 获取 Boss 名称（最后一波最后一个敌人） */
function getStageBossName(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return ''
  const lastWave = stage.waves[stage.waves.length - 1]
  const lastEnemy = lastWave.enemies[lastWave.enemies.length - 1]
  return lastEnemy ? lastEnemy.name : ''
}

module.exports = {
  CHAPTERS,
  STAGES,
  CHAPTER_STAMINA,
  RATING_ORDER,
  getStageById,
  getChapterStages,
  isChapterUnlocked,
  isStageUnlocked,
  getStageAttr,
  getNextStageId,
  getBrowsableStages,
  getStageBossAvatar,
  getStageBossName,
}
