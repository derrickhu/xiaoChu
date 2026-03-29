/**
 * 固定关卡配置 — 3章×5关 = 15关
 *
 * 全局线性解锁：stage_1_1 → stage_1_2 → ... → stage_2_1 → ... → stage_3_5
 * 体力按章节分档：第一章5, 第二章8, 第三章12（1-1免费）
 * dailyLimit: 0 表示无限制（纯体力驱动）
 * 1-1/1-2 首通奖励赠送初始宠物，让新手通过秘境获取队伍
 */

// ===== 章节体力配置（同章统一，跨章递增） =====
const CHAPTER_STAMINA = { 1: 5, 2: 8, 3: 12 }

// ===== 章节 =====
const CHAPTERS = [
  { id: 1, name: '灵山试炼', desc: '灵山脚下，试炼开始', unlockPool: 0 },
  { id: 2, name: '幽冥秘境', desc: '幽暗深处，危机四伏', unlockPool: 0 },
  { id: 3, name: '天劫雷域', desc: '九天雷劫，唯强者渡', unlockPool: 0 },
]

// ===== 关卡 =====
const STAGES = [
  // ── 第一章：灵山试炼 ──
  {
    id: 'stage_1_1', name: '初试·岩獾', chapter: 1, order: 1,
    waves: [
      { enemies: [{ name: '岩獾', attr: 'earth', hp: 300, atk: 12, def: 5, skills: ['convert'], avatar: 'stage_enemies/rock_badger' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 4, a: 7 },
    staminaCost: 0,
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm1', fragCount: 10 },  // 教学宠物 → 正式入队（庆祝重点突出）
        { type: 'pet', petId: 'w1', fragCount: 10 },  // 额外赠送：凑齐初始三人队
        { type: 'pet', petId: 's1', fragCount: 10 },
        { type: 'exp', amount: 100 },
        { type: 'petExp', amount: 50 },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 80, petExp: 50 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: null },
    battlePetExp: 30,
  },
  {
    id: 'stage_1_2', name: '烈焰·焰狮', chapter: 1, order: 2,
    waves: [
      { enemies: [{ name: '炎狐', attr: 'fire', hp: 600, atk: 20, def: 8, skills: ['poison'], avatar: 'stage_enemies/flame_fox' }] },
      { enemies: [{ name: '焰狮', attr: 'fire', hp: 900, atk: 28, def: 10, skills: ['atkBuff', 'aoe'], avatar: 'stage_enemies/blaze_lion' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'f1', fragCount: 10 },
        { type: 'pet', petId: 'e1', fragCount: 10 },
        { type: 'fragment', target: 'random_fire', count: 5 },
        { type: 'exp', amount: 200 },
        { type: 'petExp', amount: 80 },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 100, petExp: 60 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_1' },
    battlePetExp: 40,
  },
  {
    id: 'stage_1_3', name: '寒潮·碧鲸', chapter: 1, order: 3,
    waves: [
      { enemies: [{ name: '泡泡鱼', attr: 'water', hp: 960, atk: 27, def: 10, skills: ['defBuff', 'sealColumn'], avatar: 'stage_enemies/bubble_fish' }] },
      { enemies: [{ name: '碧潮鲸', attr: 'water', hp: 1280, atk: 35, def: 13, skills: ['healPct', 'convert'], avatar: 'stage_enemies/tide_whale' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 's4', fragCount: 10 },
        { type: 'fragment', target: 'random_water', count: 8 },
        { type: 'exp', amount: 300 },
        { type: 'petExp', amount: 120 },
      ],
      repeatClear: { fragments: { min: 3, max: 5, pool: 'chapter' }, exp: 100, petExp: 60 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_2' },
    battlePetExp: 40,
  },
  {
    id: 'stage_1_4', name: '金锋·雷貂', chapter: 1, order: 4,
    waves: [
      { enemies: [{ name: '铁甲犰狳', attr: 'metal', hp: 1120, atk: 29, def: 14, skills: ['defBuff', 'defDown'], avatar: 'stage_enemies/iron_armadillo' }] },
      { enemies: [{ name: '雷貂', attr: 'metal', hp: 1440, atk: 37, def: 13, skills: ['atkBuff', 'stun'], avatar: 'stage_enemies/thunder_marten' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 12 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm4', fragCount: 10 },
        { type: 'fragment', target: 'random_metal', count: 10 },
        { type: 'exp', amount: 400 },
        { type: 'petExp', amount: 150 },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 120, petExp: 70 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_3' },
    battlePetExp: 50,
  },
  {
    id: 'stage_1_5', name: '灵山守关·灵木麒麟', chapter: 1, order: 5,
    waves: [
      { enemies: [{ name: '花灵兔', attr: 'wood', hp: 800, atk: 26, def: 10, skills: ['seal'], avatar: 'stage_enemies/blossom_bunny' }] },
      { enemies: [{ name: '翠玉灵猫', attr: 'wood', hp: 1120, atk: 30, def: 13, skills: ['healPct', 'healBlock'], avatar: 'stage_enemies/jade_cat' }] },
      { enemies: [{ name: '灵木麒麟', attr: 'wood', hp: 1680, atk: 40, def: 14, skills: ['atkBuff', 'healPct', 'bossQuake'], avatar: 'stage_enemies/wood_qilin_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 11, a: 16 },
    staminaCost: CHAPTER_STAMINA[1],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'w5', fragCount: 10 },
        { type: 'fragment', target: 'random_wood', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'petExp', amount: 200 },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 150, petExp: 80 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_4' },
    battlePetExp: 60,
  },

  // ── 第二章：幽冥秘境（需通关 stage_1_5 解锁） ──
  {
    id: 'stage_2_1', name: '幽影·月光水母', chapter: 2, order: 1,
    waves: [
      { enemies: [{ name: '暮蝠', attr: 'water', hp: 1700, atk: 42, def: 14, skills: ['poison', 'stun'], avatar: 'stage_enemies/dusk_bat' }] },
      { enemies: [{ name: '月光水母', attr: 'water', hp: 2400, atk: 50, def: 17, skills: ['atkBuff', 'timeSqueeze'], avatar: 'stage_enemies/moon_jellyfish' }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 7, a: 11 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 's10', fragCount: 10 },
        { type: 'fragment', target: 'random_water', count: 10 },
        { type: 'exp', amount: 400 },
        { type: 'petExp', amount: 150 },
      ],
      repeatClear: { fragments: { min: 4, max: 6, pool: 'chapter' }, exp: 150, petExp: 100 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_1_5' },
    battlePetExp: 50,
  },
  {
    id: 'stage_2_2', name: '烈焰·炽焰古龙', chapter: 2, order: 2,
    waves: [
      { enemies: [{ name: '火灵', attr: 'fire', hp: 2000, atk: 46, def: 16, skills: ['atkBuff', 'bossInferno'], avatar: 'stage_enemies/fire_wisp' }] },
      { enemies: [{ name: '炽焰古龙', attr: 'fire', hp: 2800, atk: 56, def: 20, skills: ['atkBuff', 'defBuff', 'bossInferno', 'bossBlitz'], avatar: 'stage_enemies/inferno_dragon_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 8, a: 12 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'f10', fragCount: 10 },
        { type: 'fragment', target: 'random_fire', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'petExp', amount: 180 },
      ],
      repeatClear: { fragments: { min: 5, max: 7, pool: 'chapter' }, exp: 170, petExp: 110 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_1' },
    battlePetExp: 60,
  },
  {
    id: 'stage_2_3', name: '冥土·玄岩貔貅', chapter: 2, order: 3,
    waves: [
      { enemies: [{ name: '岩龟', attr: 'earth', hp: 1700, atk: 40, def: 22, skills: ['defBuff', 'attrAbsorb'], avatar: 'stage_enemies/stone_turtle' }] },
      { enemies: [{ name: '玄岩貔貅', attr: 'earth', hp: 3000, atk: 54, def: 25, skills: ['defBuff', 'healPct', 'bossMirror', 'bossQuake'], avatar: 'stage_enemies/rock_pixiu_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 9, a: 13 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'e10', fragCount: 10 },
        { type: 'fragment', target: 'random_earth', count: 12 },
        { type: 'exp', amount: 500 },
        { type: 'petExp', amount: 180 },
      ],
      repeatClear: { fragments: { min: 5, max: 7, pool: 'chapter' }, exp: 170, petExp: 110 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_2' },
    battlePetExp: 60,
  },
  {
    id: 'stage_2_4', name: '金风·雷虎', chapter: 2, order: 4,
    waves: [
      { enemies: [{ name: '雷鹰', attr: 'metal', hp: 2200, atk: 42, def: 25, skills: ['defBuff', 'breakBead'], avatar: 'stage_enemies/bolt_eagle' }] },
      { enemies: [{ name: '雷虎', attr: 'metal', hp: 3200, atk: 55, def: 22, skills: ['atkBuff', 'defBuff', 'bossWeaken', 'bossBlitz'], avatar: 'stage_enemies/storm_tiger_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 10, a: 15 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm10', fragCount: 10 },
        { type: 'fragment', target: 'random_metal', count: 14 },
        { type: 'exp', amount: 600 },
        { type: 'petExp', amount: 200 },
      ],
      repeatClear: { fragments: { min: 6, max: 8, pool: 'chapter' }, exp: 190, petExp: 120 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_3' },
    battlePetExp: 70,
  },
  {
    id: 'stage_2_5', name: '幽冥深渊·百花蟒仙', chapter: 2, order: 5,
    waves: [
      { enemies: [{ name: '叶鹿', attr: 'wood', hp: 1500, atk: 40, def: 14, skills: ['convert', 'counterSeal'], avatar: 'stage_enemies/leaf_deer' }] },
      { enemies: [{ name: '刺猬', attr: 'wood', hp: 2200, atk: 48, def: 20, skills: ['healPct', 'bossMirror'], avatar: 'stage_enemies/thorn_hedgehog' }] },
      { enemies: [{ name: '百花蟒仙', attr: 'wood', hp: 3600, atk: 60, def: 22, skills: ['atkBuff', 'healPct', 'bossDevour', 'bossInferno'], avatar: 'stage_enemies/flora_serpent_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 14, a: 19 },
    staminaCost: CHAPTER_STAMINA[2],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'w10', fragCount: 10 },
        { type: 'fragment', target: 'random_wood', count: 15 },
        { type: 'exp', amount: 700 },
        { type: 'petExp', amount: 250 },
      ],
      repeatClear: { fragments: { min: 6, max: 8, pool: 'chapter' }, exp: 220, petExp: 130 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_4' },
    battlePetExp: 80,
  },

  // ── 第三章：天劫雷域（需通关 stage_2_5 解锁） ──
  {
    id: 'stage_3_1', name: '天劫·焰天狮王', chapter: 3, order: 1,
    waves: [
      { enemies: [{ name: '朱雀雏', attr: 'fire', hp: 3000, atk: 54, def: 21, skills: ['atkBuff', 'bossInferno'], avatar: 'stage_enemies/vermilion_chick' }] },
      { enemies: [{ name: '焰天狮王', attr: 'fire', hp: 4000, atk: 65, def: 23, skills: ['atkBuff', 'defBuff', 'bossRage', 'bossAnnihil'], avatar: 'stage_enemies/inferno_lion_king_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 9, a: 13 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'f16', fragCount: 10 },
        { type: 'fragment', target: 'random_fire', count: 14 },
        { type: 'exp', amount: 600 },
        { type: 'petExp', amount: 220 },
      ],
      repeatClear: { fragments: { min: 5, max: 8, pool: 'chapter' }, exp: 250, petExp: 150 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_2_5' },
    battlePetExp: 70,
  },
  {
    id: 'stage_3_2', name: '寒劫·碧海玄武', chapter: 3, order: 2,
    waves: [
      { enemies: [{ name: '冰灵獭', attr: 'water', hp: 3400, atk: 58, def: 24, skills: ['defBuff', 'timeSqueeze'], avatar: 'stage_enemies/frost_otter' }] },
      { enemies: [{ name: '碧海玄武', attr: 'water', hp: 4800, atk: 68, def: 26, skills: ['defBuff', 'healPct', 'bossMirror', 'bossDrain'], avatar: 'stage_enemies/ocean_xuanwu_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 10, a: 14 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 's17', fragCount: 10 },
        { type: 'fragment', target: 'random_water', count: 14 },
        { type: 'exp', amount: 700 },
        { type: 'petExp', amount: 240 },
      ],
      repeatClear: { fragments: { min: 6, max: 9, pool: 'chapter' }, exp: 280, petExp: 160 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_1' },
    battlePetExp: 80,
  },
  {
    id: 'stage_3_3', name: '岩劫·磐牛', chapter: 3, order: 3,
    waves: [
      { enemies: [{ name: '金鳞穿山甲', attr: 'earth', hp: 3700, atk: 60, def: 30, skills: ['defBuff', 'breakBead', 'attrAbsorb'], avatar: 'stage_enemies/golden_pangolin' }] },
      { enemies: [{ name: '磐牛', attr: 'earth', hp: 5200, atk: 72, def: 28, skills: ['atkBuff', 'defBuff', 'bossQuake', 'bossWeaken'], avatar: 'stage_enemies/boulder_ox_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 11, a: 16 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'e18', fragCount: 10 },
        { type: 'fragment', target: 'random_earth', count: 16 },
        { type: 'exp', amount: 800 },
        { type: 'petExp', amount: 260 },
      ],
      repeatClear: { fragments: { min: 7, max: 10, pool: 'chapter' }, exp: 300, petExp: 170 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_2' },
    battlePetExp: 90,
  },
  {
    id: 'stage_3_4', name: '刃劫·天罡白虎', chapter: 3, order: 4,
    waves: [
      { enemies: [{ name: '风隼', attr: 'metal', hp: 4000, atk: 65, def: 27, skills: ['atkBuff', 'bossBlitz'], avatar: 'stage_enemies/wind_falcon' }] },
      { enemies: [{ name: '云豹', attr: 'metal', hp: 3400, atk: 76, def: 22, skills: ['atkBuff', 'stun', 'aoe'], avatar: 'stage_enemies/cloud_leopard' }] },
      { enemies: [{ name: '天罡白虎', attr: 'metal', hp: 5500, atk: 75, def: 28, skills: ['atkBuff', 'defBuff', 'bossWeaken', 'bossAnnihil'], avatar: 'stage_enemies/celestial_white_tiger_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 14, a: 19 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'm18', fragCount: 10 },
        { type: 'fragment', target: 'random_metal', count: 16 },
        { type: 'exp', amount: 800 },
        { type: 'petExp', amount: 280 },
      ],
      repeatClear: { fragments: { min: 7, max: 10, pool: 'chapter' }, exp: 320, petExp: 180 },
    },
    dailyLimit: 0,
    unlockCondition: { prevStage: 'stage_3_3' },
    battlePetExp: 100,
  },
  {
    id: 'stage_3_5', name: '天劫·万象龙神', chapter: 3, order: 5,
    waves: [
      { enemies: [{ name: '竹灵熊猫', attr: 'wood', hp: 3400, atk: 60, def: 22, skills: ['healPct', 'counterSeal', 'selfHeal'], avatar: 'stage_enemies/bamboo_panda' }] },
      { enemies: [{ name: '焰蝶', attr: 'fire', hp: 3700, atk: 68, def: 22, skills: ['atkBuff', 'bossInferno', 'convert'], avatar: 'stage_enemies/flame_butterfly' }] },
      { enemies: [{ name: '万象龙神', attr: 'earth', hp: 6500, atk: 82, def: 30, skills: ['atkBuff', 'defBuff', 'healPct', 'bossUltimate', 'bossCurse'], avatar: 'stage_enemies/cosmos_dragon_awakened', isBoss: true }] },
    ],
    teamSize: { min: 3, max: 5 },
    rating: { s: 16, a: 22 },
    staminaCost: CHAPTER_STAMINA[3],
    rewards: {
      firstClear: [
        { type: 'pet', petId: 'w20', fragCount: 10 },
        { type: 'fragment', target: 'random_all', count: 20 },
        { type: 'exp', amount: 1000 },
        { type: 'petExp', amount: 350 },
      ],
      repeatClear: { fragments: { min: 8, max: 10, pool: 'all' }, exp: 350, petExp: 200 },
    },
    dailyLimit: 0,
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
