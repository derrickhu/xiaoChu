/**
 * 固定关卡配置 — 12章×8关 = 96 普通 + 96 精英 = 192 关
 * 普通关: 线性解锁 stage_1_1 → stage_1_2 → … → stage_12_8
 * 精英关: 对应普通关 bestRating === 'S' 解锁
 */

const { STAGE_REWARDS, CHAPTER_REP_FRAG } = require('./economyConfig')
const { STAGE_FORMATION_MIN_PETS } = require('./constants')
const { CHAPTER_ENEMY_IDS, getEnemyById } = require('./enemyRegistry')

const BOSS_STAT_FLOOR = { hp: 1.3, atk: 1.15, def: 1.1 }

const CHAPTER_STAMINA = {
  1:  { normal: 10, elite: 15 },
  2:  { normal: 12, elite: 18 },
  3:  { normal: 16, elite: 24 },
  4:  { normal: 18, elite: 27 },
  5:  { normal: 20, elite: 30 },
  6:  { normal: 22, elite: 33 },
  7:  { normal: 24, elite: 36 },
  8:  { normal: 27, elite: 40 },
  9:  { normal: 30, elite: 44 },
  10: { normal: 32, elite: 48 },
  11: { normal: 35, elite: 52 },
  12: { normal: 38, elite: 56 },
}

const ELITE_MULTIPLIERS = {
  1:  { hp: 1.8, atk: 1.3, def: 1.5 },
  2:  { hp: 1.9, atk: 1.35, def: 1.5 },
  3:  { hp: 2.0, atk: 1.4, def: 1.5 },
  4:  { hp: 2.1, atk: 1.45, def: 1.6 },
  5:  { hp: 2.2, atk: 1.5, def: 1.6 },
  6:  { hp: 2.4, atk: 1.55, def: 1.7 },
  7:  { hp: 2.6, atk: 1.6, def: 1.7 },
  8:  { hp: 2.8, atk: 1.65, def: 1.8 },
  9:  { hp: 3.0, atk: 1.7, def: 1.8 },
  10: { hp: 3.2, atk: 1.75, def: 1.9 },
  11: { hp: 3.4, atk: 1.8, def: 1.9 },
  12: { hp: 3.5, atk: 1.8, def: 2.0 },
}

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

const CHAPTERS = [
  { id: 1,  name: '灵山试炼', desc: '灵山脚下，试炼开始' },
  { id: 2,  name: '幽冥秘境', desc: '幽暗深处，危机四伏' },
  { id: 3,  name: '天劫雷域', desc: '九天雷劫，唯强者渡' },
  { id: 4,  name: '仙灵古域', desc: '上古遗境，灵气纵横' },
  { id: 5,  name: '万妖禁地', desc: '妖族圣域，群妖争锋' },
  { id: 6,  name: '苍穹裂谷', desc: '天裂之地，元气激荡' },
  { id: 7,  name: '精英试炼', desc: '百炼成钢，精英崛起' },
  { id: 8,  name: '九幽深渊', desc: '深渊尽头，暗流涌动' },
  { id: 9,  name: '太古战场', desc: '上古遗迹，神魔余威' },
  { id: 10, name: '天罡圣域', desc: '天罡之境，气贯九霄' },
  { id: 11, name: '混沌秘界', desc: '混沌初开，法则崩坏' },
  { id: 12, name: '终焉之地', desc: '万妖之巅，终极对决' },
]

function mkRewards(ch, ord, diff, petId, weaponId, exp, repExp) {
  const idx = ord - 1
  const firstClear = [
    { type: 'pet', petId, fragCount: 5 },
  ]
  if (weaponId) firstClear.push({ type: 'weapon', weaponId })
  firstClear.push(
    { type: 'exp', amount: exp },
    { type: 'soulStone', amount: STAGE_REWARDS[ch][diff].soulStone.first[idx] },
  )
  return {
    firstClear,
    repeatClear: {
      fragments: CHAPTER_REP_FRAG[ch][diff],
      exp: repExp,
      soulStone: STAGE_REWARDS[ch][diff].soulStone.repeat[idx],
    },
  }
}

function _genStageSpecs() {
  const _STAGE_NAMES = {
    1: ['初试','烈焰','寒潮','金锋','翠影','冰潭','灼光','灵山守关'],
    2: ['幽影','妖火','磐岩','铁壁','竹影','狐火','暗夜','幽冥守关'],
    3: ['深海','烈翼','雷影','岩甲','幽潮','烈风','坚石','铁壁守关'],
    4: ['竹林','金芒','翠波','厚土','寒潮','妖焰','暮影','仙域守关'],
    5: ['灵木','炼狱','五行','天罡','混沌','雷域','金甲','万妖守关'],
    6: ['烈土','寒渊','焰天','赤焰','翠影','金锋','碧波','苍穹守关'],
    7: ['暗金','翠林','金甲','枯木','磐岩','深渊','焚天','精英守关'],
    8: ['厚土','金灵','翠影','岩甲','寒潮','烈焰','锋刃','深渊守关'],
    9: ['玄岩','碧海','太古','九天','混沌','天道','炽焰','太古守关'],
    10: ['金甲','枯木','磐岩','深渊','焚天','厚土','百花','天罡守关'],
    11: ['金甲','枯木','磐岩','深渊','焚天','天罡','烈焰','混沌守关'],
    12: ['磐岩','深渊','万妖','金锋','花灵','焚天','九天','终焉守关'],
  }

  const _PET_POOL = [
    'm1','f1','e1','w1','s1','m2','f2','e2','w2','s2',
    'm3','f3','e3','w3','s3','m4','f4','e4','w4','s4',
    'm5','f5','e5','w5','s5','m6','f6','e6','w6','s6',
    'm7','f7','e7','w7','s7','m8','f8','e8','w8','s8',
    'm9','f9','e9','w9','s9','m10','f10','e10','w10','s10',
    'm11','f11','e11','w11','s11','m12','f12','e12','w12','s12',
    'm13','f13','e13','w13','s13','m14','f14','e14','w14','s14',
    'm15','f15','e15','w15','s15','m16','f16','e16','w16','s16',
    'm17','f17','e17','w17','s17','m18','f18','e18','w18','s18',
  ]
  const _WPN_POOL = [
    'w1','w2','w3','w4','w5','w6','w7','w8','w9','w10',
    'w11','w12','w13','w14','w15','w16','w17','w18','w19','w20',
    'w21','w22','w23','w24','w25','w26','w27','w28','w29','w30',
    'w31','w32','w33','w34','w35','w36','w37','w38','w39','w40',
    'w41','w42','w43','w44','w45','w46','w47','w48','w49','w50',
  ]

  const specs = {}
  let petIdx = 0
  let wpnIdx = 0

  for (let ch = 1; ch <= 12; ch++) {
    const ids = CHAPTER_ENEMY_IDS[ch]
    const chSpecs = []
    const names = _STAGE_NAMES[ch]

    for (let i = 0; i < 8; i++) {
      const enemyId = ids[i]
      const enemy = getEnemyById(enemyId)
      const ord = i + 1
      const globalOrd = (ch - 1) * 8 + ord

      const expBase = Math.round(60 + globalOrd * 10)
      const repExpBase = Math.round(expBase * 0.68)
      const bsBase = Math.round(15 + globalOrd * 2.2)

      const ratingBonus = ch <= 2 ? 2 : ch <= 3 ? 1 : 0
      const sRating = Math.max(5, Math.round(4 + ch * 0.6 + i * 0.2)) + ratingBonus
      const aRating = sRating + 3

      const pet = _PET_POOL[petIdx % _PET_POOL.length]
      petIdx++
      const weapon = (i % 2 === 0) ? _WPN_POOL[wpnIdx++ % _WPN_POOL.length] : null

      const ePet = _PET_POOL[petIdx % _PET_POOL.length]
      petIdx++
      const eWpn = (i % 2 === 1) ? _WPN_POOL[wpnIdx++ % _WPN_POOL.length] : null

      const eSkillPool = ['atkBuff','defBuff','healPct','bossBlitz','bossWeaken','bossRage','breakBead','stun','bossDrain','bossAnnihil','timeSqueeze','sealColumn']
      const numESkills = ch <= 3 ? 1 : ch <= 7 ? 2 : 3
      const eSkills = []
      for (let s = 0; s < numESkills; s++) {
        const sk = eSkillPool[(ch * 3 + i * 2 + s) % eSkillPool.length]
        if (!eSkills.includes(sk)) eSkills.push(sk)
      }

      const stageName = (names[i] || '试炼') + '·' + (enemy ? enemy.name : enemyId)

      const spec = {
        name: stageName,
        enemyId: enemyId,
        pet, weapon, exp: expBase, repExp: repExpBase, bs: bsBase,
        rating: { s: sRating, a: aRating },
        ePet, eWpn, eExp: Math.round(expBase * 1.3), eRepExp: Math.round(repExpBase * 1.3),
        eBs: Math.round(bsBase * 1.2), eRating: { s: sRating + 2, a: aRating + 2 },
        eSkills,
      }

      if (ch === 1 && i === 0) {
        spec.teamSize = { min: 1, max: 5 }
        // 1-1：首通奖 f1（火）；与新手并入池的金木水土四只凑齐五行，不在此关再奖 m1
        spec.pet = 'f1'
      }
      if (ch === 1 && i === 1) {
        // 1-2：原 e1 与新手 e1 重复会变碎片，改为 m2
        spec.pet = 'm2'
      }
      if (ch === 1 && i === 2) {
        // 1-3：原 s1 与新手 s1 重复会变碎片，改为 w2
        spec.pet = 'w2'
      }

      chSpecs.push(spec)
    }
    specs[ch] = chSpecs
  }
  return specs
}

const STAGE_SPECS = _genStageSpecs()

function buildAllStages() {
  const stages = []
  for (let ch = 1; ch <= 12; ch++) {
    const specs = STAGE_SPECS[ch]
    const mult = ELITE_MULTIPLIERS[ch]
    for (let i = 0; i < specs.length; i++) {
      const s = specs[i]
      const ord = i + 1
      const enemyData = getEnemyById(s.enemyId)
      if (!enemyData) continue

      let prevStage = null
      if (ch === 1 && ord === 1) prevStage = null
      else if (ord === 1) prevStage = `stage_${ch - 1}_8`
      else prevStage = `stage_${ch}_${ord - 1}`

      // Boss 保底：扫描同章前 7 关最强敌人，确保 Boss 数值有足够优势
      let bossHp = enemyData.hp, bossAtk = enemyData.atk, bossDef = enemyData.def
      if (ord === 8 && enemyData.isBoss) {
        const ids = CHAPTER_ENEMY_IDS[ch]
        let maxPrevHp = 0, maxPrevAtk = 0, maxPrevDef = 0
        for (let j = 0; j < 7; j++) {
          const prev = getEnemyById(ids[j])
          if (prev) {
            if (prev.hp > maxPrevHp) maxPrevHp = prev.hp
            if (prev.atk > maxPrevAtk) maxPrevAtk = prev.atk
            if (prev.def > maxPrevDef) maxPrevDef = prev.def
          }
        }
        bossHp = Math.max(enemyData.hp, Math.round(maxPrevHp * BOSS_STAT_FLOOR.hp))
        bossAtk = Math.max(enemyData.atk, Math.round(maxPrevAtk * BOSS_STAT_FLOOR.atk))
        bossDef = Math.max(enemyData.def, Math.round(maxPrevDef * BOSS_STAT_FLOOR.def))
      }

      const normalEnemy = {
        name: enemyData.name,
        attr: enemyData.attr,
        hp: bossHp,
        atk: bossAtk,
        def: bossDef,
        skills: [...enemyData.skills],
        avatar: enemyData.avatar,
      }
      if (enemyData.newbieOverride) normalEnemy.newbieOverride = { ...enemyData.newbieOverride }
      if (enemyData.isBoss) normalEnemy.isBoss = true

      let normalWaves = [{ enemies: [normalEnemy] }]
      if (ord === 8 && i >= 2) {
        const minionId = CHAPTER_ENEMY_IDS[ch][Math.max(0, i - 3)]
        const minionData = getEnemyById(minionId)
        if (minionData) {
          const minion = {
            name: minionData.name,
            attr: minionData.attr,
            hp: Math.round(minionData.hp * 0.6),
            atk: minionData.atk,
            def: minionData.def,
            skills: [...minionData.skills],
            avatar: minionData.avatar,
          }
          normalWaves = [{ enemies: [minion] }, { enemies: [normalEnemy] }]
        }
      }

      stages.push({
        id: `stage_${ch}_${ord}`,
        name: s.name,
        chapter: ch,
        order: ord,
        difficulty: 'normal',
        waves: normalWaves,
        teamSize: s.teamSize || { min: 3, max: 5 },
        rating: s.rating,
        staminaCost: s.staminaCost !== undefined ? s.staminaCost : CHAPTER_STAMINA[ch].normal,
        rewards: mkRewards(ch, ord, 'normal', s.pet, s.weapon, s.exp, s.repExp),
        dailyLimit: 0,
        unlockCondition: { prevStage },
        battleSoulStone: s.bs,
      })

      const eliteEnemy = {
        name: '狂暴·' + enemyData.name,
        attr: enemyData.attr,
        hp: Math.round(bossHp * mult.hp),
        atk: Math.round(bossAtk * mult.atk),
        def: Math.round(bossDef * mult.def),
        skills: [...enemyData.skills, ...(s.eSkills || [])],
        avatar: enemyData.avatar,
      }
      if (enemyData.isBoss) eliteEnemy.isBoss = true

      let eliteWaves = [{ enemies: [eliteEnemy] }]
      if (ord === 8 && i >= 2) {
        const eMinionId = CHAPTER_ENEMY_IDS[ch][Math.max(0, i - 3)]
        const eMinionData = getEnemyById(eMinionId)
        if (eMinionData) {
          const eMinion = {
            name: '狂暴·' + eMinionData.name,
            attr: eMinionData.attr,
            hp: Math.round(eMinionData.hp * mult.hp * 0.6),
            atk: Math.round(eMinionData.atk * mult.atk),
            def: Math.round(eMinionData.def * mult.def),
            skills: [...eMinionData.skills],
            avatar: eMinionData.avatar,
          }
          eliteWaves = [{ enemies: [eMinion] }, { enemies: [eliteEnemy] }]
        }
      }

      stages.push({
        id: `stage_${ch}_${ord}_elite`,
        name: '精英·' + s.name,
        chapter: ch,
        order: ord,
        difficulty: 'elite',
        waves: eliteWaves,
        teamSize: { min: 3, max: 5 },
        rating: s.eRating,
        staminaCost: CHAPTER_STAMINA[ch].elite,
        rewards: mkRewards(ch, ord, 'elite', s.ePet, s.eWpn, s.eExp, s.eRepExp),
        dailyLimit: 0,
        unlockCondition: { normalStageS: `stage_${ch}_${ord}` },
        battleSoulStone: s.eBs,
      })
    }
  }
  return stages
}

const STAGES = buildAllStages()

const RATING_ORDER = { B: 1, A: 2, S: 3 }

function getStageById(id) {
  return STAGES.find(s => s.id === id)
}

function getChapterStages(chapterId, difficulty) {
  return STAGES
    .filter(s => s.chapter === chapterId && (!difficulty || s.difficulty === difficulty))
    .sort((a, b) => a.order - b.order)
}

function isEliteStage(stageId) {
  return stageId.endsWith('_elite')
}

function getNormalStageId(eliteStageId) {
  return eliteStageId.replace(/_elite$/, '')
}

function getEliteStageId(normalStageId) {
  return normalStageId + '_elite'
}

function isChapterUnlocked(chapterId, poolCount, clearRecord) {
  const stages = getChapterStages(chapterId, 'normal')
  return stages.some(s => isStageUnlocked(s.id, clearRecord, poolCount))
}

/**
 * 判断关卡是否解锁
 * 普通关: 线性解锁（前置关卡通关）
 * 精英关: 顺序解锁 — 前置精英已通关 + 对应普通关 3 星(S)
 */
function isStageUnlocked(stageId, clearRecord, poolCount) {
  const stage = getStageById(stageId)
  if (!stage) return false

  if (isEliteStage(stageId)) {
    const normalId = getNormalStageId(stageId)
    const normalRec = clearRecord && clearRecord[normalId]
    if (!(normalRec && normalRec.bestRating === 'S')) return false
    const prevEliteId = _getPrevEliteId(stageId)
    if (!prevEliteId) return true
    const prevRec = clearRecord && clearRecord[prevEliteId]
    return !!(prevRec && prevRec.cleared)
  }

  if (!stage.unlockCondition || !stage.unlockCondition.prevStage) return true
  const prev = clearRecord && clearRecord[stage.unlockCondition.prevStage]
  return !!(prev && prev.cleared)
}

/**
 * 获取精英关锁定原因（用于 UI 提示）
 * @returns {string|null} null 表示已解锁
 */
function getEliteLockReason(stageId, clearRecord) {
  if (!isEliteStage(stageId)) return null
  const stage = getStageById(stageId)
  if (!stage) return null

  const prevEliteId = _getPrevEliteId(stageId)
  if (prevEliteId) {
    const prevRec = clearRecord && clearRecord[prevEliteId]
    if (!(prevRec && prevRec.cleared)) {
      const prev = getStageById(prevEliteId)
      return `需先通关精英 ${prev ? prev.chapter + '-' + prev.order : '前一关'}`
    }
  }

  const normalId = getNormalStageId(stageId)
  const normalRec = clearRecord && clearRecord[normalId]
  if (!(normalRec && normalRec.bestRating === 'S')) {
    const ns = getStageById(normalId)
    return `需普通 ${ns ? ns.chapter + '-' + ns.order : normalId} 达到3星`
  }

  return null
}

function _getPrevEliteId(eliteStageId) {
  const stage = getStageById(eliteStageId)
  if (!stage) return null
  const elites = STAGES
    .filter(s => s.difficulty === 'elite')
    .sort((a, b) => a.chapter !== b.chapter ? a.chapter - b.chapter : a.order - b.order)
  const idx = elites.findIndex(s => s.id === eliteStageId)
  return idx > 0 ? elites[idx - 1].id : null
}

function getStageAttr(stageId) {
  const stage = getStageById(stageId)
  if (!stage || !stage.waves.length) return null
  return (stage.waves[0].enemies[0] && stage.waves[0].enemies[0].attr) || null
}

/**
 * 获取下一关 ID（同章同难度 order+1，或下一章同难度第一关）
 */
function getNextStageId(stageId) {
  const cur = getStageById(stageId)
  if (!cur) return null
  const diff = cur.difficulty
  const sameCh = STAGES
    .filter(s => s.chapter === cur.chapter && s.difficulty === diff)
    .sort((a, b) => a.order - b.order)
  const idx = sameCh.findIndex(s => s.id === stageId)
  if (idx >= 0 && idx + 1 < sameCh.length) return sameCh[idx + 1].id
  const nextCh = CHAPTERS.find(ch => ch.id === cur.chapter + 1)
  if (!nextCh) return null
  const nextChStages = STAGES
    .filter(s => s.chapter === nextCh.id && s.difficulty === diff)
    .sort((a, b) => a.order - b.order)
  return nextChStages.length > 0 ? nextChStages[0].id : null
}

/**
 * 获取可浏览关卡列表（顺序展示，普通和精英统一逻辑）
 * 包含所有已解锁关卡 + 第一个未解锁关卡（用于显示锁定提示）
 * @param {object} clearRecord
 * @param {string} [difficulty='normal'] - 'normal' 或 'elite'
 */
function getBrowsableStages(clearRecord, difficulty) {
  const diff = difficulty || 'normal'
  const filtered = STAGES
    .filter(s => s.difficulty === diff)
    .sort((a, b) => a.chapter !== b.chapter ? a.chapter - b.chapter : a.order - b.order)

  const result = []
  for (const stage of filtered) {
    const unlocked = isStageUnlocked(stage.id, clearRecord, 0)
    result.push({ stage, unlocked })
    if (!unlocked) break
  }
  return result
}

/**
 * 统一怪物头像路径解析（目录重整后 enemies/ 下统一管理）
 * enemies/tower/mon_m_1  → assets/enemies/tower/mon_m_1.png (全身像直接用)
 * enemies/stage/blaze_lion → assets/enemies/avatar/blaze_lion_avatar.png (秘境怪用头像裁切版)
 */
function getEnemyPortraitPath(avatar) {
  if (!avatar || typeof avatar !== 'string') return null
  if (avatar.startsWith('enemies/stage/')) {
    const slug = avatar.replace('enemies/stage/', '')
    return 'assets/enemies/avatar/' + slug + '_avatar.png'
  }
  if (avatar.startsWith('enemies/')) {
    return 'assets/' + avatar + '.png'
  }
  return null
}

function getStageBossAvatar(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return null
  const lastWave = stage.waves[stage.waves.length - 1]
  const lastEnemy = lastWave.enemies[lastWave.enemies.length - 1]
  return lastEnemy ? `assets/${lastEnemy.avatar}.png` : null
}

function getStageBossName(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return ''
  const lastWave = stage.waves[stage.waves.length - 1]
  const lastEnemy = lastWave.enemies[lastWave.enemies.length - 1]
  return lastEnemy ? lastEnemy.name : ''
}

function getStageRewardDifficulty(stageId) {
  return isEliteStage(stageId) ? 'elite' : 'normal'
}

/**
 * 关卡短标签：章-序号（如 1-5），精英关为「3-2 · 精英」
 * @param {object|null} stage getStageById 返回值
 * @returns {string}
 */
function getStageChapterOrderLabel(stage) {
  if (!stage || stage.chapter == null || stage.order == null) return ''
  const base = `${stage.chapter}-${stage.order}`
  if (stage.difficulty === 'elite') return `${base} · 精英`
  return base
}

/**
 * 秘境榜副文案：普通/精英最远至第几章第几关（不展示总关卡数）。
 * @param {object} item rankStage 记录；新字段 farthestNormal* / farthestElite*；旧数据仅有 farthestChapter、clearCount
 */
function formatRankStageProgressSubtitle(item) {
  const fmt = (ch, ord) => (ch > 0 && ord > 0 ? `第${ch}章 第${ord}关` : '—')
  const nCh = item.farthestNormalChapter
  const nOrd = item.farthestNormalOrder
  const eCh = item.farthestEliteChapter
  const eOrd = item.farthestEliteOrder
  let normal = fmt(nCh, nOrd)
  let elite = fmt(eCh, eOrd)
  if (normal === '—' && (item.clearCount || 0) > 0 && item.farthestChapter) {
    normal = `第${item.farthestChapter}章`
  }
  return `普通 ${normal} · 精英 ${elite}`
}

/**
 * 实际开战所需上阵人数：关卡下限、全局编队下限、灵宠池数量三者取合理交集。
 * 池子不足 3 只时，降为「至多能选几只就选几只」即可开战。
 */
function getEffectiveStageTeamMin(storage, stage) {
  if (!stage || !stage.teamSize) return 1
  const smin = stage.teamSize.min
  const poolCount = storage.petPoolCount
  if (poolCount === 0) return smin
  const need = Math.max(smin, Math.min(STAGE_FORMATION_MIN_PETS, poolCount))
  return Math.min(poolCount, need)
}

module.exports = {
  CHAPTERS,
  STAGES,
  CHAPTER_STAMINA,
  CHAPTER_RECOMMENDED,
  RATING_ORDER,
  getStageById,
  getChapterStages,
  isChapterUnlocked,
  isStageUnlocked,
  isEliteStage,
  getNormalStageId,
  getEliteStageId,
  getEliteLockReason,
  getStageAttr,
  getNextStageId,
  getBrowsableStages,
  getStageBossAvatar,
  getEnemyPortraitPath,
  getStageBossName,
  getStageRewardDifficulty,
  getStageChapterOrderLabel,
  formatRankStageProgressSubtitle,
  getEffectiveStageTeamMin,
}
