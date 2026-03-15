/**
 * 固定关卡配置 — 3章×5关 = 15关
 *
 * 解锁条件：灵宠池 >= 5 只
 * 每章有独立解锁门槛（按灵宠池数量）
 * 关卡按顺序解锁，需通关前置关卡
 */

// ===== 章节 =====
const CHAPTERS = [
  { id: 1, name: '灵山试炼', desc: '灵山脚下，试炼开始', unlockPool: 5 },
  { id: 2, name: '幽冥秘境', desc: '幽暗深处，危机四伏', unlockPool: 10 },
  { id: 3, name: '天劫雷域', desc: '九天雷劫，唯强者渡', unlockPool: 15 },
]

// ===== 关卡 =====
const STAGES = [
  // ── 第一章：灵山试炼 ──
  {
    id: 'stage_1_1', name: '初试·岩獾', chapter: 1, order: 1,
    waves: [
      { enemies: [{ name: '岩獾', attr: 'earth', hp: 580, atk: 21, def: 7, skills: [], avatar: 'enemies/stage/rock_badger' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 3, a: 5 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_earth', count: 5 },
        { type: 'exp', amount: 200 },
        { type: 'petExp', amount: 80 },
      ],
      repeatClear: { fragments: { min: 1, max: 3, pool: 'chapter' }, exp: 50, petExp: 40 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: null },
    battlePetExp: 30,
  },
  {
    id: 'stage_1_2', name: '烈焰·焰狮', chapter: 1, order: 2,
    waves: [
      { enemies: [{ name: '炎狐', attr: 'fire', hp: 700, atk: 23, def: 8, skills: [], avatar: 'enemies/stage/flame_fox' }] },
      { enemies: [{ name: '焰狮', attr: 'fire', hp: 940, atk: 30, def: 10, skills: ['atkBuff'], avatar: 'enemies/stage/blaze_lion' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 8 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_fire', count: 8 },
        { type: 'exp', amount: 300 },
        { type: 'petExp', amount: 120 },
      ],
      repeatClear: { fragments: { min: 2, max: 4, pool: 'chapter' }, exp: 80, petExp: 60 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_1_1' },
    battlePetExp: 40,
  },
  {
    id: 'stage_1_3', name: '寒潮·碧鲸', chapter: 1, order: 3,
    waves: [
      { enemies: [{ name: '泡泡鱼', attr: 'water', hp: 820, atk: 26, def: 9, skills: ['defBuff'], avatar: 'enemies/stage/bubble_fish' }] },
      { enemies: [{ name: '碧潮鲸', attr: 'water', hp: 1050, atk: 33, def: 12, skills: ['healPct'], avatar: 'enemies/stage/tide_whale' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 8 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_water', count: 8 },
        { type: 'exp', amount: 300 },
        { type: 'petExp', amount: 120 },
      ],
      repeatClear: { fragments: { min: 2, max: 4, pool: 'chapter' }, exp: 80, petExp: 60 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_1_2' },
    battlePetExp: 40,
  },
  {
    id: 'stage_1_4', name: '金锋·雷貂', chapter: 1, order: 4,
    waves: [
      { enemies: [{ name: '铁甲犰狳', attr: 'metal', hp: 940, atk: 28, def: 14, skills: ['defBuff'], avatar: 'enemies/stage/iron_armadillo' }] },
      { enemies: [{ name: '雷貂', attr: 'metal', hp: 1180, atk: 35, def: 12, skills: ['atkBuff'], avatar: 'enemies/stage/thunder_marten' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 9 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_metal', count: 10 },
        { type: 'exp', amount: 400 },
        { type: 'petExp', amount: 150 },
      ],
      repeatClear: { fragments: { min: 2, max: 5, pool: 'chapter' }, exp: 100, petExp: 70 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_1_3' },
    battlePetExp: 50,
  },
  {
    id: 'stage_1_5', name: '灵山守关·灵木麒麟', chapter: 1, order: 5,
    waves: [
      { enemies: [{ name: '花灵兔', attr: 'wood', hp: 700, atk: 24, def: 9, skills: [], avatar: 'enemies/stage/blossom_bunny' }] },
      { enemies: [{ name: '翠玉灵猫', attr: 'wood', hp: 950, atk: 28, def: 12, skills: ['healPct'], avatar: 'enemies/stage/jade_cat' }] },
      { enemies: [{ name: '灵木麒麟', attr: 'wood', hp: 1400, atk: 38, def: 14, skills: ['atkBuff', 'healPct'], avatar: 'enemies/stage/wood_qilin_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 12 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_wood', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'petExp', amount: 200 },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 120, petExp: 80 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_1_4' },
    battlePetExp: 60,
  },

  // ── 第二章：幽冥秘境 ──
  {
    id: 'stage_2_1', name: '幽影·月光水母', chapter: 2, order: 1,
    waves: [
      { enemies: [{ name: '暮蝠', attr: 'water', hp: 1000, atk: 30, def: 10, skills: [], avatar: 'enemies/stage/dusk_bat' }] },
      { enemies: [{ name: '月光水母', attr: 'water', hp: 1400, atk: 36, def: 12, skills: ['atkBuff'], avatar: 'enemies/stage/moon_jellyfish' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 5, a: 8 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_water', count: 10 },
        { type: 'exp', amount: 400 },
        { type: 'petExp', amount: 150 },
      ],
      repeatClear: { fragments: { min: 2, max: 5, pool: 'chapter' }, exp: 120, petExp: 80 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: null },
    battlePetExp: 50,
  },
  {
    id: 'stage_2_2', name: '烈焰·炽焰古龙', chapter: 2, order: 2,
    waves: [
      { enemies: [{ name: '火灵', attr: 'fire', hp: 1200, atk: 34, def: 11, skills: ['atkBuff'], avatar: 'enemies/stage/fire_wisp' }] },
      { enemies: [{ name: '炽焰古龙', attr: 'fire', hp: 1600, atk: 40, def: 14, skills: ['atkBuff', 'defBuff'], avatar: 'enemies/stage/inferno_dragon_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 9 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_fire', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'petExp', amount: 180 },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 140, petExp: 90 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_2_1' },
    battlePetExp: 60,
  },
  {
    id: 'stage_2_3', name: '冥土·玄岩貔貅', chapter: 2, order: 3,
    waves: [
      { enemies: [{ name: '岩龟', attr: 'earth', hp: 1000, atk: 28, def: 16, skills: ['defBuff'], avatar: 'enemies/stage/stone_turtle' }] },
      { enemies: [{ name: '玄岩貔貅', attr: 'earth', hp: 1800, atk: 38, def: 18, skills: ['defBuff', 'healPct'], avatar: 'enemies/stage/rock_pixiu_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 10 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_earth', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'petExp', amount: 180 },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 140, petExp: 90 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_2_2' },
    battlePetExp: 60,
  },
  {
    id: 'stage_2_4', name: '金风·雷虎', chapter: 2, order: 4,
    waves: [
      { enemies: [{ name: '雷鹰', attr: 'metal', hp: 1300, atk: 30, def: 18, skills: ['defBuff'], avatar: 'enemies/stage/bolt_eagle' }] },
      { enemies: [{ name: '雷虎', attr: 'metal', hp: 1850, atk: 39, def: 15, skills: ['atkBuff', 'defBuff'], avatar: 'enemies/stage/storm_tiger_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_metal', count: 14 },
        { type: 'exp', amount: 600 },
        { type: 'petExp', amount: 200 },
      ],
      repeatClear: { fragments: { min: 3, max: 6, pool: 'chapter' }, exp: 160, petExp: 100 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_2_3' },
    battlePetExp: 70,
  },
  {
    id: 'stage_2_5', name: '幽冥深渊·百花蟒仙', chapter: 2, order: 5,
    waves: [
      { enemies: [{ name: '叶鹿', attr: 'wood', hp: 920, atk: 28, def: 10, skills: [], avatar: 'enemies/stage/leaf_deer' }] },
      { enemies: [{ name: '刺猬', attr: 'wood', hp: 1280, atk: 34, def: 14, skills: ['healPct'], avatar: 'enemies/stage/thorn_hedgehog' }] },
      { enemies: [{ name: '百花蟒仙', attr: 'wood', hp: 2000, atk: 42, def: 15, skills: ['atkBuff', 'healPct'], avatar: 'enemies/stage/flora_serpent_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 10, a: 14 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_wood', count: 15 },
        { type: 'exp', amount: 700 },
        { type: 'petExp', amount: 250 },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 180, petExp: 110 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_2_4' },
    battlePetExp: 80,
  },

  // ── 第三章：天劫雷域 ──
  {
    id: 'stage_3_1', name: '天劫·焰天狮王', chapter: 3, order: 1,
    waves: [
      { enemies: [{ name: '朱雀雏', attr: 'fire', hp: 1620, atk: 37, def: 14, skills: ['atkBuff'], avatar: 'enemies/stage/vermilion_chick' }] },
      { enemies: [{ name: '焰天狮王', attr: 'fire', hp: 2150, atk: 44, def: 15, skills: ['atkBuff', 'defBuff'], avatar: 'enemies/stage/inferno_lion_king_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 6, a: 9 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_fire', count: 14 },
        { type: 'exp', amount: 600 },
        { type: 'petExp', amount: 220 },
      ],
      repeatClear: { fragments: { min: 3, max: 6, pool: 'chapter' }, exp: 200, petExp: 120 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: null },
    battlePetExp: 70,
  },
  {
    id: 'stage_3_2', name: '寒劫·碧海玄武', chapter: 3, order: 2,
    waves: [
      { enemies: [{ name: '冰灵獭', attr: 'water', hp: 1800, atk: 39, def: 16, skills: ['defBuff'], avatar: 'enemies/stage/frost_otter' }] },
      { enemies: [{ name: '碧海玄武', attr: 'water', hp: 2500, atk: 46, def: 17, skills: ['defBuff', 'healPct'], avatar: 'enemies/stage/ocean_xuanwu_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 10 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_water', count: 14 },
        { type: 'exp', amount: 700 },
        { type: 'petExp', amount: 240 },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 220, petExp: 130 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_3_1' },
    battlePetExp: 80,
  },
  {
    id: 'stage_3_3', name: '岩劫·磐牛', chapter: 3, order: 3,
    waves: [
      { enemies: [{ name: '金鳞穿山甲', attr: 'earth', hp: 1950, atk: 40, def: 20, skills: ['defBuff'], avatar: 'enemies/stage/golden_pangolin' }] },
      { enemies: [{ name: '磐牛', attr: 'earth', hp: 2650, atk: 48, def: 18, skills: ['atkBuff', 'defBuff'], avatar: 'enemies/stage/boulder_ox_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 12 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_earth', count: 16 },
        { type: 'exp', amount: 800 },
        { type: 'petExp', amount: 260 },
      ],
      repeatClear: { fragments: { min: 4, max: 7, pool: 'chapter' }, exp: 240, petExp: 140 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_3_2' },
    battlePetExp: 90,
  },
  {
    id: 'stage_3_4', name: '刃劫·天罡白虎', chapter: 3, order: 4,
    waves: [
      { enemies: [{ name: '风隼', attr: 'metal', hp: 2150, atk: 44, def: 18, skills: ['atkBuff'], avatar: 'enemies/stage/wind_falcon' }] },
      { enemies: [{ name: '云豹', attr: 'metal', hp: 1800, atk: 52, def: 14, skills: ['atkBuff'], avatar: 'enemies/stage/cloud_leopard' }] },
      { enemies: [{ name: '天罡白虎', attr: 'metal', hp: 2850, atk: 50, def: 18, skills: ['atkBuff', 'defBuff'], avatar: 'enemies/stage/celestial_white_tiger_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 10, a: 14 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_metal', count: 16 },
        { type: 'exp', amount: 800 },
        { type: 'petExp', amount: 280 },
      ],
      repeatClear: { fragments: { min: 4, max: 7, pool: 'chapter' }, exp: 260, petExp: 150 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_3_3' },
    battlePetExp: 100,
  },
  {
    id: 'stage_3_5', name: '天劫·万象龙神', chapter: 3, order: 5,
    waves: [
      { enemies: [{ name: '竹灵熊猫', attr: 'wood', hp: 1800, atk: 40, def: 14, skills: ['healPct'], avatar: 'enemies/stage/bamboo_panda' }] },
      { enemies: [{ name: '焰蝶', attr: 'fire', hp: 1950, atk: 46, def: 14, skills: ['atkBuff'], avatar: 'enemies/stage/flame_butterfly' }] },
      { enemies: [{ name: '万象龙神', attr: 'earth', hp: 3400, atk: 53, def: 20, skills: ['atkBuff', 'defBuff', 'healPct'], avatar: 'enemies/stage/cosmos_dragon_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 12, a: 16 },
    staminaCost: 10,
    rewards: {
      firstClear: [
        { type: 'fragment', target: 'random_all', count: 20 },
        { type: 'exp', amount: 1000 },
        { type: 'petExp', amount: 350 },
      ],
      repeatClear: { fragments: { min: 5, max: 8, pool: 'all' }, exp: 300, petExp: 180 },
    },
    dailyLimit: 3,
    unlockCondition: { prevStage: 'stage_3_4' },
    battlePetExp: 120,
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
 * 判断章节是否解锁（灵宠池数量达标）
 */
function isChapterUnlocked(chapterId, poolCount) {
  const ch = CHAPTERS.find(c => c.id === chapterId)
  return ch ? poolCount >= ch.unlockPool : false
}

/**
 * 判断关卡是否解锁
 * @param {string} stageId
 * @param {object} clearRecord - storage.stageClearRecord
 * @param {number} poolCount - 灵宠池数量
 */
function isStageUnlocked(stageId, clearRecord, poolCount) {
  const stage = getStageById(stageId)
  if (!stage) return false
  if (!isChapterUnlocked(stage.chapter, poolCount)) return false
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

module.exports = {
  CHAPTERS,
  STAGES,
  RATING_ORDER,
  getStageById,
  getChapterStages,
  isChapterUnlocked,
  isStageUnlocked,
  getStageAttr,
  getNextStageId,
}
