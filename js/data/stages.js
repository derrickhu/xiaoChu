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
    id: 'stage_1_1', name: '初试·土灵', chapter: 1, order: 1,
    waves: [
      { enemies: [{ name: '山灵', attr: 'earth', hp: 500, atk: 18, def: 6, skills: [] }] },
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
    id: 'stage_1_2', name: '烈焰·双波', chapter: 1, order: 2,
    waves: [
      { enemies: [{ name: '火灵兽', attr: 'fire', hp: 600, atk: 20, def: 7, skills: [] }] },
      { enemies: [{ name: '炎魔', attr: 'fire', hp: 800, atk: 26, def: 9, skills: ['atkBuff'] }] },
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
    id: 'stage_1_3', name: '寒冰·水阵', chapter: 1, order: 3,
    waves: [
      { enemies: [{ name: '冰魄', attr: 'water', hp: 700, atk: 22, def: 8, skills: ['defBuff'] }] },
      { enemies: [{ name: '寒潮灵', attr: 'water', hp: 900, atk: 28, def: 10, skills: ['healPct'] }] },
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
    id: 'stage_1_4', name: '金锋·试剑', chapter: 1, order: 4,
    waves: [
      { enemies: [{ name: '金甲卫', attr: 'metal', hp: 800, atk: 24, def: 12, skills: ['defBuff'] }] },
      { enemies: [{ name: '利刃灵', attr: 'metal', hp: 1000, atk: 30, def: 10, skills: ['atkBuff'] }] },
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
    id: 'stage_1_5', name: '灵山守关·木灵王', chapter: 1, order: 5,
    waves: [
      { enemies: [{ name: '藤蔓精', attr: 'wood', hp: 600, atk: 20, def: 8, skills: [] }] },
      { enemies: [{ name: '古树灵', attr: 'wood', hp: 800, atk: 24, def: 10, skills: ['healPct'] }] },
      { enemies: [{ name: '木灵王', attr: 'wood', hp: 1200, atk: 32, def: 12, skills: ['atkBuff', 'healPct'] }] },
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
    id: 'stage_2_1', name: '幽影·暗蝠', chapter: 2, order: 1,
    waves: [
      { enemies: [{ name: '暗蝠', attr: 'water', hp: 1000, atk: 30, def: 10, skills: [] }] },
      { enemies: [{ name: '影蝠王', attr: 'water', hp: 1400, atk: 36, def: 12, skills: ['atkBuff'] }] },
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
    id: 'stage_2_2', name: '烈焰·炎狱', chapter: 2, order: 2,
    waves: [
      { enemies: [{ name: '火魂', attr: 'fire', hp: 1200, atk: 34, def: 11, skills: ['atkBuff'] }] },
      { enemies: [{ name: '炎狱兽', attr: 'fire', hp: 1600, atk: 40, def: 14, skills: ['atkBuff', 'defBuff'] }] },
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
    id: 'stage_2_3', name: '冥土·土偶', chapter: 2, order: 3,
    waves: [
      { enemies: [{ name: '泥偶', attr: 'earth', hp: 1000, atk: 28, def: 16, skills: ['defBuff'] }] },
      { enemies: [{ name: '石巨人', attr: 'earth', hp: 1800, atk: 38, def: 18, skills: ['defBuff', 'healPct'] }] },
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
    id: 'stage_2_4', name: '金风·铁壁', chapter: 2, order: 4,
    waves: [
      { enemies: [{ name: '铁甲兵', attr: 'metal', hp: 1400, atk: 32, def: 20, skills: ['defBuff'] }] },
      { enemies: [{ name: '金刚灵', attr: 'metal', hp: 2000, atk: 42, def: 16, skills: ['atkBuff', 'defBuff'] }] },
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
    id: 'stage_2_5', name: '幽冥深渊·魂噬', chapter: 2, order: 5,
    waves: [
      { enemies: [{ name: '幽魂', attr: 'wood', hp: 1000, atk: 30, def: 10, skills: [] }] },
      { enemies: [{ name: '冥蔓', attr: 'wood', hp: 1400, atk: 36, def: 14, skills: ['healPct'] }] },
      { enemies: [{ name: '魂噬兽', attr: 'wood', hp: 2200, atk: 46, def: 16, skills: ['atkBuff', 'healPct'] }] },
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
    id: 'stage_3_1', name: '雷火·初劫', chapter: 3, order: 1,
    waves: [
      { enemies: [{ name: '雷灵', attr: 'fire', hp: 1800, atk: 40, def: 14, skills: ['atkBuff'] }] },
      { enemies: [{ name: '雷火兽', attr: 'fire', hp: 2400, atk: 48, def: 16, skills: ['atkBuff', 'defBuff'] }] },
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
    id: 'stage_3_2', name: '冰霜·寒劫', chapter: 3, order: 2,
    waves: [
      { enemies: [{ name: '霜灵', attr: 'water', hp: 2000, atk: 42, def: 16, skills: ['defBuff'] }] },
      { enemies: [{ name: '冰魄龙', attr: 'water', hp: 2800, atk: 50, def: 18, skills: ['defBuff', 'healPct'] }] },
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
    id: 'stage_3_3', name: '地裂·岩劫', chapter: 3, order: 3,
    waves: [
      { enemies: [{ name: '岩甲', attr: 'earth', hp: 2200, atk: 44, def: 22, skills: ['defBuff'] }] },
      { enemies: [{ name: '山崩灵', attr: 'earth', hp: 3000, atk: 52, def: 20, skills: ['atkBuff', 'defBuff'] }] },
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
    id: 'stage_3_4', name: '金风·刃劫', chapter: 3, order: 4,
    waves: [
      { enemies: [{ name: '金翅', attr: 'metal', hp: 2400, atk: 48, def: 18, skills: ['atkBuff'] }] },
      { enemies: [{ name: '剑灵', attr: 'metal', hp: 2000, atk: 56, def: 14, skills: ['atkBuff'] }] },
      { enemies: [{ name: '破军', attr: 'metal', hp: 3200, atk: 54, def: 20, skills: ['atkBuff', 'defBuff'] }] },
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
    id: 'stage_3_5', name: '天劫·五行终焉', chapter: 3, order: 5,
    waves: [
      { enemies: [{ name: '木劫灵', attr: 'wood', hp: 2000, atk: 44, def: 14, skills: ['healPct'] }] },
      { enemies: [{ name: '火劫灵', attr: 'fire', hp: 2200, atk: 50, def: 14, skills: ['atkBuff'] }] },
      { enemies: [{ name: '天劫兽', attr: 'earth', hp: 3800, atk: 58, def: 22, skills: ['atkBuff', 'defBuff', 'healPct'] }] },
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
  return stage.waves[0].enemies[0]?.attr || null
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
