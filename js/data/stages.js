/**
 * 固定关卡配置 — 12章×8关 = 96 普通 + 96 精英 = 192 关
 * 普通关: 线性解锁 stage_1_1 → stage_1_2 → … → stage_12_8
 * 精英关: 对应普通关 bestRating === 'S' 解锁
 */

const { STAGE_REWARDS, CHAPTER_REP_FRAG } = require('./economyConfig')
const { STAMINA_COST } = require('./balance/economy')
const { STAGE_FORMATION_MIN_PETS } = require('./constants')
const { CHAPTER_ENEMY_IDS, getEnemyById } = require('./enemyRegistry')
const { STAGE_ELITE_MULTIPLIERS, STAGE_BOSS_STAT_FLOOR, STAGE_MIN_GROWTH_RATE, STAGE_MINION_HP_RATIO, CH1_HP_CURVE } = require('./balance/enemy')
const {
  STAGE_EXP, STAGE_SOUL_STONE, STAGE_RATING, STAGE_ELITE_COEFFS,
  STAGE_ELITE_SKILL_COUNT, STAGE_TEAM_SIZE, FIRST_CLEAR_FRAG_COUNT,
  ELITE_MINION_HP_SCALE, CHAPTER_RECOMMENDED,
  STAGE_REWARD_PET_OVERRIDES, STAGE_REWARD_WEAPON_OVERRIDES,
} = require('./balance/stage')
const { getPetRarity } = require('./pets')

const BOSS_STAT_FLOOR = STAGE_BOSS_STAT_FLOOR

const ELITE_MULTIPLIERS = STAGE_ELITE_MULTIPLIERS

/**
 * 章节元信息（含主题色、副标题、徽章 key）
 *
 * 字段说明：
 *   - theme:   主题色 hex（用于首页章节带背景、章节主线页卡片基色、里程碑高亮）
 *   - subtitle: 章节副标题（章节主线页用，做"氛围感"标题第二行）
 *   - bannerKey: 章节 banner 资源 key（暂用 null，后续美术接 assets/ui/chapter_banners/）
 *   - badgeKey: 章节徽章 icon key（对应 assets/ui/badges/badge_ch{N}.png）
 *
 * 主题色选取原则：按"章节属性意境 + 主线色相渐变"（1→12 冷 → 暖 → 紫）调色，
 * 避免相邻章节色相过近造成首页章节带切换不明显。
 */
// 说明：badgeKey 暂置 null —— 12 个章节徽章 icon 尚未交付美术，
//   视图侧（chapterMapView._drawCardBadge）已内置 🏅 金色圆形占位 fallback，
//   美术资源到位后，将对应行的 badgeKey 改回 'badge_ch<N>' 并把图片放到 assets/ui/badges/ 即可。
//   （assets/ui/* 属 bundled 目录，路径不存在时 R.getImg → ENOENT，所以字段必须先留空）
const CHAPTERS = [
  { id: 1,  name: '灵山试炼',   desc: '灵山脚下，试炼开始', subtitle: '初心踏入灵山',   theme: '#7ec4a8', bannerKey: null, badgeKey: null },
  { id: 2,  name: '幽冥秘境',   desc: '幽暗深处，危机四伏', subtitle: '幽影藏刀的低谷', theme: '#5b7aa8', bannerKey: null, badgeKey: null },
  { id: 3,  name: '天劫雷域',   desc: '九天雷劫，唯强者渡', subtitle: '雷光为冠的境域', theme: '#9e8fd8', bannerKey: null, badgeKey: null },
  { id: 4,  name: '仙灵古域',   desc: '上古遗境，灵气纵横', subtitle: '古道氤氲的仙途', theme: '#6ca6c4', bannerKey: null, badgeKey: null },
  { id: 5,  name: '万妖禁地',   desc: '妖族圣域，群妖争锋', subtitle: '妖潮翻涌的禁地', theme: '#c4864f', bannerKey: null, badgeKey: null },
  { id: 6,  name: '苍穹裂谷',   desc: '天裂之地，元气激荡', subtitle: '天裂之上的余辉', theme: '#d0a868', bannerKey: null, badgeKey: null },
  { id: 7,  name: '精英试炼',   desc: '百炼成钢，精英崛起', subtitle: '剑锋指向的试炼', theme: '#c26b6b', bannerKey: null, badgeKey: null },
  { id: 8,  name: '九幽深渊',   desc: '深渊尽头，暗流涌动', subtitle: '九幽深处的低语', theme: '#6a4d7a', bannerKey: null, badgeKey: null },
  { id: 9,  name: '太古战场',   desc: '上古遗迹，神魔余威', subtitle: '太古余威未散',   theme: '#8a4d4a', bannerKey: null, badgeKey: null },
  { id: 10, name: '天罡圣域',   desc: '天罡之境，气贯九霄', subtitle: '天罡气贯九霄',   theme: '#c8a94a', bannerKey: null, badgeKey: null },
  { id: 11, name: '混沌秘界',   desc: '混沌初开，法则崩坏', subtitle: '混沌初开之境',   theme: '#8a5ec0', bannerKey: null, badgeKey: null },
  { id: 12, name: '终焉之地',   desc: '万妖之巅，终极对决', subtitle: '万妖之巅终对决', theme: '#b84f7a', bannerKey: null, badgeKey: null },
]

/**
 * 法宝投放策略：只在**章末 Boss（ord===8）**的普通/精英关发放法宝，
 * 其余 14 关（含精英）把原本"每关一件法宝"的名额折算为灵石 +20 + 随机碎片 ×3。
 *
 * 背景：在"每关一件法宝"时代，主线 192 关会产出 192 次法宝投放，
 *       玩家只能装备 1 件，SSR 很快满仓变白菜，稀缺性崩坏。
 *       改为只在章末给 → 主线 24 件 + 里程碑保底券，每件都在"大关"场景拿到，
 *       稀缺感回归，章末仪式感增强（见 plan A 节）。
 *
 * v2 "Day1 经济温和收紧"：soulStone 50 → 20。
 *   · 玩家 Day1 推到 4-4 时要走过 25 个非 Boss 关，50×25=1250 灵石纯靠这条常量堆出
 *   · 它原本是"每关掉一件法宝"的数值占位，单次体验很微弱，削减到 20 不会让玩家感知到
 *   · 真正的爆点还在 Boss 关直接发法宝 + 章节 24★ 发 SSR 法宝两条主链
 */
const NON_BOSS_WEAPON_SUBSTITUTE = {
  soulStone: 20,
  fragmentCount: 3,
}

function mkRewards(ch, ord, diff, petId, weaponId, exp, repExp) {
  const idx = ord - 1
  const firstClear = []
  if (petId) {
    const rarity = getPetRarity(petId)
    const fragCount = FIRST_CLEAR_FRAG_COUNT[rarity] || FIRST_CLEAR_FRAG_COUNT.R
    firstClear.push({ type: 'pet', petId, fragCount })
  } else {
    firstClear.push({ type: 'randomPet', chapter: ch, order: ord, difficulty: diff })
  }
  const isBossStage = ord === 8
  let soulStoneFirstBonus = 0
  if (isBossStage) {
    if (weaponId) {
      firstClear.push({ type: 'weapon', weaponId })
    } else {
      firstClear.push({ type: 'randomWeapon', chapter: ch, order: ord, difficulty: diff })
    }
  } else {
    // 折算：额外碎片 ×3（随机宠物）+ 灵石 +50（合并到最终 soulStone 条目里，避免两条 soulStone）
    soulStoneFirstBonus = NON_BOSS_WEAPON_SUBSTITUTE.soulStone
    firstClear.push({
      type: 'fragment',
      target: 'random_all',
      count: NON_BOSS_WEAPON_SUBSTITUTE.fragmentCount,
      weaponSubstitute: true, // 结算展示时可区分"代替法宝的碎片"（暂未单独 UI，保留字段）
    })
  }
  firstClear.push(
    { type: 'exp', amount: exp },
    { type: 'soulStone', amount: STAGE_REWARDS[ch][diff].soulStone.first[idx] + soulStoneFirstBonus },
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

  const specs = {}

  for (let ch = 1; ch <= 12; ch++) {
    const ids = CHAPTER_ENEMY_IDS[ch]
    const chSpecs = []
    const names = _STAGE_NAMES[ch]

    for (let i = 0; i < 8; i++) {
      const enemyId = ids[i]
      const enemy = getEnemyById(enemyId)
      const ord = i + 1
      const globalOrd = (ch - 1) * 8 + ord

      const expBase = Math.round(STAGE_EXP.base + globalOrd * STAGE_EXP.perOrd)
      const repExpBase = Math.round(expBase * STAGE_EXP.repeatRatio)
      const bsBase = Math.round(STAGE_SOUL_STONE.base + globalOrd * STAGE_SOUL_STONE.perOrd)

      let ratingBonus = 0
      for (const eb of STAGE_RATING.earlyBonus) {
        if (ch <= eb.maxChapter) { ratingBonus = eb.bonus; break }
      }
      const sRating = Math.max(STAGE_RATING.minS, Math.round(STAGE_RATING.base + ch * STAGE_RATING.chCoeff + i * STAGE_RATING.ordCoeff)) + ratingBonus
      const aRating = sRating + STAGE_RATING.aOffset

      const eSkillPool = ['atkBuff','defBuff','healPct','bossBlitz','bossWeaken','bossRage','breakBead','stun','bossDrain','bossAnnihil','timeSqueeze','sealColumn']
      const numESkills = ch <= STAGE_ELITE_SKILL_COUNT.early.maxChapter ? STAGE_ELITE_SKILL_COUNT.early.count
        : ch <= STAGE_ELITE_SKILL_COUNT.mid.maxChapter ? STAGE_ELITE_SKILL_COUNT.mid.count
        : STAGE_ELITE_SKILL_COUNT.late.count
      const eSkills = []
      for (let s = 0; s < numESkills; s++) {
        const sk = eSkillPool[(ch * 3 + i * 2 + s) % eSkillPool.length]
        if (!eSkills.includes(sk)) eSkills.push(sk)
      }

      const stageName = (names[i] || '试炼') + '·' + (enemy ? enemy.name : enemyId)

      const overrideKey = `${ch}_${ord}`
      const eliteOverrideKey = `${ch}_${ord}e`

      const spec = {
        name: stageName,
        enemyId: enemyId,
        pet: STAGE_REWARD_PET_OVERRIDES[overrideKey] || null,
        weapon: STAGE_REWARD_WEAPON_OVERRIDES[overrideKey] || null,
        exp: expBase, repExp: repExpBase, bs: bsBase,
        rating: { s: sRating, a: aRating },
        ePet: STAGE_REWARD_PET_OVERRIDES[eliteOverrideKey] || null,
        eWeapon: STAGE_REWARD_WEAPON_OVERRIDES[eliteOverrideKey] || null,
        eExp: Math.round(expBase * STAGE_ELITE_COEFFS.expMul),
        eRepExp: Math.round(repExpBase * STAGE_ELITE_COEFFS.expMul),
        eBs: Math.round(bsBase * STAGE_ELITE_COEFFS.soulStoneMul),
        eRating: { s: sRating + STAGE_ELITE_COEFFS.ratingBonus, a: aRating + STAGE_ELITE_COEFFS.ratingBonus },
        eSkills,
      }

      if (ch === 1 && i === 0) {
        spec.teamSize = { ...STAGE_TEAM_SIZE.initial }
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
  const grow = STAGE_MIN_GROWTH_RATE
  let runMax = { hp: 0, atk: 0, def: 0 }

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

      // 全局递增保底：HP/ATK 严格递增(+1)，DEF 不回退即可
      if (runMax.hp > 0) {
        bossHp  = Math.max(bossHp,  Math.max(runMax.hp  + 1, Math.round(runMax.hp  * grow.hp)))
        bossAtk = Math.max(bossAtk, Math.max(runMax.atk + 1, Math.round(runMax.atk * grow.atk)))
        bossDef = Math.max(bossDef, Math.round(runMax.def * grow.def))
      }
      runMax = { hp: bossHp, atk: bossAtk, def: bossDef }

      // 第 1 章手动曲线：覆盖 HP 实现新手友好的难度波动（不影响 runMax 以免扰动后续章节）
      let stageHp = bossHp
      if (ch === 1 && CH1_HP_CURVE[ord]) {
        stageHp = CH1_HP_CURVE[ord]
      }

      const normalEnemy = {
        name: enemyData.name,
        attr: enemyData.attr,
        hp: stageHp,
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
            hp: Math.round(minionData.hp * STAGE_MINION_HP_RATIO),
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
        teamSize: s.teamSize || { ...STAGE_TEAM_SIZE.default },
        rating: s.rating,
        staminaCost: s.staminaCost !== undefined ? s.staminaCost : STAMINA_COST,
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
            hp: Math.round(eMinionData.hp * mult.hp * ELITE_MINION_HP_SCALE),
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
        teamSize: { ...STAGE_TEAM_SIZE.default },
        rating: s.eRating,
        staminaCost: STAMINA_COST,
        rewards: mkRewards(ch, ord, 'elite', s.ePet, s.eWeapon, s.eExp, s.eRepExp),
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
  const fmt = (ch, ord) => {
    if (ch > 0 && ord > 0) return `第${ch}章 第${ord}关`
    if (ch > 0) return `第${ch}章`
    return '--'
  }
  const nCh = item.farthestNormalChapter
  const nOrd = item.farthestNormalOrder
  const eCh = item.farthestEliteChapter
  const eOrd = item.farthestEliteOrder
  let normal = fmt(nCh, nOrd)
  let elite = fmt(eCh, eOrd)
  if (normal === '--' && (item.clearCount || 0) > 0 && item.farthestChapter) {
    normal = `第${item.farthestChapter}章`
  }
  return `普通 ${normal} · 精英 ${elite}`
}

/**
 * 实际开战所需上阵人数：关卡下限、全局编队下限、灵宠池数量三者取合理交集。
 * 池子不足 3 只时，降为「至多能选几只就选几只」即可开战。
 */
/**
 * 根据章节 id 查章节元信息（含 theme/subtitle/bannerKey/badgeKey）
 * 找不到返回 null；上层取完可放心做 name/theme 读取
 */
function getChapterById(chapterId) {
  return CHAPTERS.find(c => c.id === chapterId) || null
}

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
  CHAPTER_RECOMMENDED,
  RATING_ORDER,
  getStageById,
  getChapterById,
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
