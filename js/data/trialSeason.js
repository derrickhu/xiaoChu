/**
 * 天机试炼赛季配置
 *
 * 第一版只开放单赛季、单难度；后续运营只需要替换 CURRENT_SEASON
 * 或追加赛季列表，就能调整主题、奖励投放和积分口径。
 */
const { EVENT_TYPE, generateMonster, generateElite, generateBoss } = require('./tower')

const ATTR_NAME = { metal: '金', wood: '木', earth: '土', water: '水', fire: '火' }
const ATTR_KEY = { metal: 'm', wood: 'w', earth: 'e', water: 's', fire: 'f' }

const TRIAL_MONSTER_NAMES = {
  metal: ['金灵鼠妖','铜甲兵','金锋散修','锐金妖兵','金翎蛮将','天罡妖卫','金鹏妖尊'],
  wood:  ['木灵花妖','藤蔓小精','青木散修','枯藤妖兵','苍木蛮将','灵木妖卫','万木妖尊'],
  earth: ['土灵石怪','泥人兵','黄土散修','山岩妖兵','裂地蛮将','厚土妖卫','磐岩妖尊'],
  water: ['水灵鱼妖','冰魄小精','碧水散修','寒潮妖兵','沧澜蛮将','深渊妖卫','蛟龙妖尊'],
  fire:  ['火灵狐妖','焰灵小精','赤炎散修','爆炎妖兵','焚天蛮将','烈焰妖卫','朱雀妖尊'],
}

const TRIAL_ELITE_NAMES = {
  metal: ['金甲妖将·碎天','破军金狮','金罡战魔'],
  wood:  ['枯木大妖·噬灵','缠枝毒蛇王','万木妖魔'],
  earth: ['磐岩巨魔·震地','山岳石王','镇地魔将'],
  water: ['深渊蛟魔·溺魂','冰魄仙蛇','寒潮魔将'],
  fire:  ['焚天魔凰·灭世','炎狱妖帝','赤炎魔君'],
}

const TRIAL_SPECIAL_FLOOR = {
  5: {
    name: '玄甲灵龟·破壁',
    avatar: 'enemies/trial/trial_guard_defense_earth',
    title: '高防低血',
    desc: '防御极高但血量偏低，破防灵宠能快速突破。',
    hpMul: 0.28,
    atkMul: 0.82,
    defMul: 7.2,
    skills: ['trialDefGuard', 'breakBead'],
    variants: {
      metal: { name: '镜甲金龟·折锋', avatar: 'enemies/trial/trial_guard_defense_metal', title: '金甲反制', desc: '防御极高但血量偏低，会短暂反弹伤害，适合破防后集中爆发。', hpMul: 0.26, atkMul: 0.78, defMul: 7.4, skills: ['trialDefGuard', 'trialArmorMirror'] },
      wood:  { name: '藤甲灵龟·回根', avatar: 'enemies/trial/trial_guard_defense_wood', title: '木甲回复', desc: '防御高且会小幅回血，不能慢慢磨，优先带破防和高爆发。', hpMul: 0.32, atkMul: 0.72, defMul: 6.2, skills: ['trialDefGuard', 'trialArmorRegen'] },
      water: { name: '寒甲灵龟·凝流', avatar: 'enemies/trial/trial_guard_defense_water', title: '水甲封行', desc: '防御高并会封锁一行灵珠，需要预留转珠空间后再爆发。', hpMul: 0.30, atkMul: 0.74, defMul: 6.6, skills: ['trialDefGuard', 'trialArmorFrost'] },
      fire:  { name: '熔甲灵龟·灼壳', avatar: 'enemies/trial/trial_guard_defense_fire', title: '火甲灼烧', desc: '血量最低但会灼烧压血，适合快速破防击杀。', hpMul: 0.24, atkMul: 0.88, defMul: 6.8, skills: ['trialDefGuard', 'trialArmorBurn'] },
      earth: { name: '玄甲灵龟·破壁', avatar: 'enemies/trial/trial_guard_defense_earth', title: '土甲碎盘', desc: '防御最高并会破坏灵珠，破防灵宠是最稳定的解法。', hpMul: 0.28, atkMul: 0.82, defMul: 7.8, skills: ['trialDefGuard', 'trialArmorShatter'] },
    },
  },
  9: {
    name: '定魂幻狐·无惑',
    avatar: 'enemies/trial/trial_guard_mind_water',
    title: '免疫眩晕',
    desc: '免疫眩晕与冰冻，但攻击和血量不高，鼓励直接用克制输出压制。',
    hpMul: 0.58,
    atkMul: 0.76,
    defMul: 1.05,
    skills: ['trialMindGuard', 'seal'],
    immuneControl: true,
    variants: {
      metal: { name: '金魇幻狐·穿心', avatar: 'enemies/trial/trial_guard_mind_metal', title: '金魇穿心', desc: '免疫控制，并用低倍率直接攻击打断续航节奏。', hpMul: 0.56, atkMul: 0.82, defMul: 1.0, skills: ['trialMindGuard', 'trialMindPierce'] },
      wood:  { name: '木魇幻狐·缠息', avatar: 'enemies/trial/trial_guard_mind_wood', title: '木魇毒息', desc: '免疫控制并施加持续伤害，适合用护盾或快速克制输出压制。', hpMul: 0.60, atkMul: 0.70, defMul: 1.0, skills: ['trialMindGuard', 'trialMindPoison'] },
      water: { name: '水魇幻狐·迟流', avatar: 'enemies/trial/trial_guard_mind_water', title: '水魇限时', desc: '免疫控制并缩短拖拽时间，要求更稳定的转珠路线。', hpMul: 0.58, atkMul: 0.72, defMul: 1.05, skills: ['trialMindGuard', 'trialMindTide'] },
      fire:  { name: '火魇幻狐·连焰', avatar: 'enemies/trial/trial_guard_mind_fire', title: '火魇连击', desc: '免疫控制并进行低倍率连击，不能只依赖眩晕拖回合。', hpMul: 0.54, atkMul: 0.84, defMul: 0.95, skills: ['trialMindGuard', 'trialMindFlare'] },
      earth: { name: '土魇幻狐·裂甲', avatar: 'enemies/trial/trial_guard_mind_earth', title: '土魇破防', desc: '免疫控制并降低修士防御，适合带减伤或尽快击杀。', hpMul: 0.62, atkMul: 0.68, defMul: 1.15, skills: ['trialMindGuard', 'trialMindQuake'] },
    },
  },
  10: {
    name: '锁灵天将·封阵',
    avatar: 'enemies/trial/trial_guard_seal_metal',
    title: '封印灵宠',
    desc: '会短暂封印1只灵宠，队伍属性越分散越不容易被单点卡死。',
    hpMul: 0.62,
    atkMul: 0.72,
    defMul: 0.95,
    skills: ['trialPetSeal', 'bossConvert'],
    isBoss: true,
    variants: {
      metal: { name: '金锁妖将·断刃', avatar: 'enemies/trial/trial_guard_seal_metal', title: '金锁点杀', desc: '封印1只灵宠后补一次低倍率攻击，考验队伍续航和替补输出。', hpMul: 0.58, atkMul: 0.76, defMul: 1.0, skills: ['trialPetSeal', 'trialSealMetal'] },
      wood:  { name: '木锁妖将·缠魂', avatar: 'enemies/trial/trial_guard_seal_wood', title: '木锁禁疗', desc: '封印1只灵宠并压低心珠回复，不能只靠治疗拖过封印期。', hpMul: 0.64, atkMul: 0.66, defMul: 0.95, skills: ['trialPetSeal', 'trialSealWood'] },
      water: { name: '水锁妖将·乱流', avatar: 'enemies/trial/trial_guard_seal_water', title: '水锁乱珠', desc: '封印1只灵宠并扰乱灵珠，需要更稳的盘面整理能力。', hpMul: 0.62, atkMul: 0.68, defMul: 0.92, skills: ['trialPetSeal', 'trialSealWater'] },
      fire:  { name: '火锁妖将·焚阵', avatar: 'enemies/trial/trial_guard_seal_fire', title: '火锁灼烧', desc: '封印1只灵宠并施加灼烧，适合用爆发缩短战斗。', hpMul: 0.56, atkMul: 0.78, defMul: 0.9, skills: ['trialPetSeal', 'trialSealFire'] },
      earth: { name: '土锁妖将·压阵', avatar: 'enemies/trial/trial_guard_seal_earth', title: '土锁破珠', desc: '封印1只灵宠并破坏少量灵珠，队伍属性分散更容易渡过封印。', hpMul: 0.66, atkMul: 0.64, defMul: 1.05, skills: ['trialPetSeal', 'trialSealEarth'] },
    },
  },
}
const DAILY_ATTR_THEMES = [
  { weekDay: 0, enemyAttrs: ['fire', 'metal'] }, // 周日：水/火双克制
  { weekDay: 1, recommendedAttr: 'wood' },  // 周一：木克土
  { weekDay: 2, recommendedAttr: 'earth' }, // 周二：土克水
  { weekDay: 3, recommendedAttr: 'water' }, // 周三：水克火
  { weekDay: 4, recommendedAttr: 'fire' },  // 周四：火克金
  { weekDay: 5, recommendedAttr: 'metal' }, // 周五：金克木
  { weekDay: 6, enemyAttrs: ['water', 'wood'] }, // 周六：土/金双克制
]

const TRIAL_MODE = {
  id: 'trial_counter_break_004',
  name: '五行克制·破阵试炼',
  shortName: '破阵试炼',
  unlockStageId: 'stage_2_8',
  maxFloor: 10,
  staminaCost: 10,
  firstDailyStaminaCost: 5,
  startDate: '2026-04-26',
  seasonDays: 14,
  exclusiveWeapons: ['w51'],
  rules: {
    counterDmgPct: 15,
    comboScoreMin: 5,
  },
  score: {
    floor: 80,
    clearBonus: 300,
    combo: 10,
    counterHit: 15,
    speedTurn: 5,
    dailyQuest: 0,
  },
  rewardTrack: [
    { score: 1200, rewards: [{ type: 'soulStone', count: 300 }, { type: 'randomFragment', count: 5 }] },
    { score: 3200, rewards: [{ type: 'soulStone', count: 500 }, { type: 'universalFragment', count: 5 }] },
    { score: 5600, rewards: [{ type: 'soulStone', count: 800 }, { type: 'awakenStone', count: 2 }] },
    { score: 8400, rewards: [{ type: 'soulStone', count: 1100 }, { type: 'randomFragment', count: 16 }] },
    { score: 11200, rewards: [{ type: 'weapon', id: 'w51' }, { type: 'soulStone', count: 1200 }, { type: 'universalFragment', count: 8 }] },
    { score: 15000, rewards: [{ type: 'soulStone', count: 1600 }, { type: 'universalFragment', count: 12 }, { type: 'awakenStone', count: 3 }] },
  ],
  dailyQuests: [
    { id: 'combo5', label: '单场达成 5 Combo', desc: '试炼中任意战斗达成 5 Combo', score: 30 },
    { id: 'counter12', label: '造成属性克制伤害 12 次', desc: '用优势属性攻击敌人', target: 12, score: 80 },
    { id: 'floor8', label: '抵达第 8 层', desc: '冲进高压区即可完成', score: 60 },
  ],
}

function getCurrentTrialSeason() {
  return TRIAL_MODE
}

function _addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  d.setDate(d.getDate() + days)
  return d
}

function _dateKeyFromDate(date) {
  const d = date instanceof Date ? date : new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function _monthDayLabel(date) {
  return `${date.getMonth() + 1}.${date.getDate()}`
}

function getTrialSeasonProgress(date) {
  const season = getCurrentTrialSeason()
  const now = date instanceof Date ? date : new Date()
  const start = _dateFromKey(season.startDate)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const elapsedDays = Math.floor((today - start) / 86400000)
  const safeElapsed = Math.max(0, elapsedDays)
  const dayIndex = Math.min(season.seasonDays, safeElapsed + 1)
  const daysLeft = Math.max(0, season.seasonDays - dayIndex)
  const endDate = _addDays(start, season.seasonDays - 1)
  return {
    dayIndex,
    daysLeft,
    endDate,
    endDateKey: _dateKeyFromDate(endDate),
    endLabel: _monthDayLabel(endDate),
    isStarted: elapsedDays >= 0,
    isEnded: elapsedDays >= season.seasonDays,
  }
}

function getTrialSeasonLabel(date) {
  const season = getCurrentTrialSeason()
  const p = getTrialSeasonProgress(date)
  if (p.isEnded) return `赛季已结束 · ${p.endLabel}结束`
  return `第${p.dayIndex}/${season.seasonDays}天 · 剩${p.daysLeft}天`
}

function _getEnemyAttrForFloor(floor, dateKey) {
  const key = dateKey || _localDateKey()
  const enemyAttrs = getDailyAttrTheme(_dateFromKey(key)).enemyAttrs || ['earth']
  return enemyAttrs[(Math.max(1, floor) - 1) % enemyAttrs.length]
}

function _getSpecialCfgForFloor(floor, enemyAttr) {
  const baseCfg = TRIAL_SPECIAL_FLOOR[floor]
  if (!baseCfg) return null
  const variant = (baseCfg.variants && baseCfg.variants[enemyAttr]) || {}
  return { ...baseCfg, ...variant, enemyAttr }
}

function _getTrialMonsterIndex(floor, max) {
  return Math.max(0, Math.min(max - 1, Math.floor((floor + 5) / 5)))
}

function _bindEnemyAttrVisual(enemy, floor, enemyAttr, eventType) {
  if (!enemy) return enemy
  enemy.attr = enemyAttr
  enemy.battleBg = `battle/trial_${enemyAttr}`
  const attrKey = ATTR_KEY[enemyAttr] || 'm'
  if (eventType === EVENT_TYPE.ELITE) {
    const names = TRIAL_ELITE_NAMES[enemyAttr] || TRIAL_ELITE_NAMES.metal
    const idx = Math.max(0, Math.min(names.length - 1, (floor + enemyAttr.length) % names.length))
    enemy.name = names[idx]
    enemy.avatar = `enemies/tower/elite_${attrKey}_${idx + 1}`
    return enemy
  }
  const names = TRIAL_MONSTER_NAMES[enemyAttr] || TRIAL_MONSTER_NAMES.metal
  const idx = _getTrialMonsterIndex(floor, names.length)
  enemy.name = names[idx]
  enemy.avatar = `enemies/tower/mon_${attrKey}_${idx + 1}`
  return enemy
}

function _getTrialDifficultyMul(floor) {
  if (floor >= 10) return { hp: 1.45, atk: 1.24, def: 1.12 }
  if (floor >= 9) return { hp: 1.35, atk: 1.18, def: 1.08 }
  if (floor >= 8) return { hp: 1.28, atk: 1.15, def: 1.05 }
  if (floor >= 6) return { hp: 1.14, atk: 1.08, def: 1.0 }
  return { hp: 1, atk: 1, def: 1 }
}

function _applyTrialDifficulty(event, floor) {
  if (!event || !event.data) return event
  const mul = _getTrialDifficultyMul(floor)
  const enemy = event.data
  enemy.hp = Math.max(1, Math.round((enemy.hp || 1) * mul.hp))
  enemy.maxHp = enemy.hp
  enemy.atk = Math.max(1, Math.round((enemy.atk || 1) * mul.atk))
  enemy.def = Math.max(0, Math.round((enemy.def || 0) * mul.def))
  return event
}

function getTrialSpecialFloors(dateKey) {
  return Object.keys(TRIAL_SPECIAL_FLOOR)
    .map(floor => {
      const n = Number(floor)
      return { floor: n, ..._getSpecialCfgForFloor(n, _getEnemyAttrForFloor(n, dateKey)) }
    })
    .sort((a, b) => a.floor - b.floor)
}

function getTrialStaminaCost(storage) {
  const season = getCurrentTrialSeason()
  if (!storage || !storage.isTrialFirstRunToday || !storage.isTrialFirstRunToday(season.id)) {
    return season.staminaCost
  }
  return season.firstDailyStaminaCost
}

function _localDateKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function _seedFromString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function _withDeterministicRandom(seed, fn) {
  const oldRandom = Math.random
  let s = seed || 1
  Math.random = function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
  try {
    return fn()
  } finally {
    Math.random = oldRandom
  }
}

function _dateFromKey(dateKey) {
  if (!dateKey) return new Date()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey)
  if (!m) return new Date()
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function getDailyQuestForDate(dateKey) {
  return getDailyQuestsForDate(dateKey)[0]
}

function getDailyQuestsForDate(dateKey) {
  const season = getCurrentTrialSeason()
  const key = dateKey || _localDateKey()
  const attrTheme = getDailyAttrTheme(_dateFromKey(key))
  return season.dailyQuests.map(q => {
    const quest = { ...q }
    if (quest.id === 'counter12') {
      const target = quest.target || 12
      quest.label = `造成属性克制伤害 ${target} 次`
      quest.desc = `推荐用${attrTheme.recommendedName}属性出战`
    }
    return quest
  })
}

function getDailyAttrTheme(date) {
  const d = date instanceof Date ? date : new Date()
  const entry = DAILY_ATTR_THEMES.find(item => item.weekDay === d.getDay()) || DAILY_ATTR_THEMES[0]
  const counterMap = { metal: 'wood', wood: 'earth', earth: 'water', water: 'fire', fire: 'metal' }
  const counterBy = { wood: 'metal', earth: 'wood', water: 'earth', fire: 'water', metal: 'fire' }
  const enemyAttrs = entry.enemyAttrs
    ? entry.enemyAttrs.slice()
    : [counterMap[entry.recommendedAttr] || 'earth']
  const recommendedAttrs = entry.recommendedAttr
    ? [entry.recommendedAttr]
    : enemyAttrs.map(attr => counterBy[attr]).filter(Boolean)
  const enemyNames = enemyAttrs.map(attr => ATTR_NAME[attr] || attr)
  const recommendedNames = recommendedAttrs.map(attr => ATTR_NAME[attr] || attr)
  return {
    recommendedAttr: recommendedAttrs[0],
    recommendedAttrs,
    enemyAttr: enemyAttrs[0],
    enemyAttrs,
    recommendedName: recommendedNames.join('/'),
    enemyName: enemyNames.join('/'),
    label: `${recommendedNames.join('/')}克${enemyNames.join('/')}`,
  }
}

function generateTrialFloorEvent(floor, dateKey) {
  const key = dateKey || _localDateKey()
  const enemyAttr = _getEnemyAttrForFloor(floor, key)
  const seed = _seedFromString(`${key}_${TRIAL_MODE.id}_${floor}`)
  function withAttr(event) {
    if (event && event.data) {
      _bindEnemyAttrVisual(event.data, floor, enemyAttr, event.type)
    }
    return event
  }
  function applySpecial(event) {
    const cfg = _getSpecialCfgForFloor(floor, enemyAttr)
    if (!cfg || !event || !event.data) return event
    const enemy = event.data
    const hp = Math.max(1, Math.round((enemy.hp || 1) * cfg.hpMul))
    enemy.name = cfg.name
    enemy.avatar = cfg.avatar
    enemy.trialTitle = cfg.title
    enemy.desc = cfg.desc
    enemy.hp = hp
    enemy.maxHp = hp
    enemy.atk = Math.max(1, Math.round((enemy.atk || 1) * cfg.atkMul))
    enemy.def = Math.max(0, Math.round((enemy.def || 0) * cfg.defMul))
    enemy.skills = cfg.skills.slice()
    if (cfg.immuneControl) enemy.immuneControl = true
    if (cfg.isBoss) enemy.isBoss = true
    return event
  }
  return _withDeterministicRandom(seed, () => {
    if (floor >= TRIAL_MODE.maxFloor) return _applyTrialDifficulty(applySpecial(withAttr({ type: EVENT_TYPE.BOSS, data: generateBoss(floor + 10) })), floor)
    if (floor === 5 || floor === 8 || floor === 9) return _applyTrialDifficulty(applySpecial(withAttr({ type: EVENT_TYPE.ELITE, data: generateElite(floor + 8) })), floor)
    return _applyTrialDifficulty(applySpecial(withAttr({ type: EVENT_TYPE.BATTLE, data: generateMonster(floor + 6) })), floor)
  })
}

function isDailyQuestDone(runStats, questId) {
  const s = runStats || {}
  if (questId === 'combo5') return (s.maxCombo || 0) >= 5
  if (questId === 'counter12') {
    const quest = getCurrentTrialSeason().dailyQuests.find(q => q.id === 'counter12')
    return (s.counterHits || 0) >= ((quest && quest.target) || 12)
  }
  if (questId === 'floor8') return (s.floor || 0) >= 8
  return false
}

function getDailyQuestResults(runStats) {
  const s = runStats || {}
  const quests = getDailyQuestsForDate(s.dateKey)
  return quests.map(quest => ({
    id: quest.id,
    label: quest.label,
    score: quest.score || 0,
    done: isDailyQuestDone(s, quest.id),
  }))
}

function calcTrialScore(runStats) {
  const season = getCurrentTrialSeason()
  const s = runStats || {}
  const floor = Math.max(0, Math.min(season.maxFloor, s.floor || 0))
  const maxCombo = Math.max(0, s.maxCombo || 0)
  const counterHits = Math.max(0, s.counterHits || 0)
  const totalTurns = Math.max(0, s.totalTurns || 0)
  const speedScore = s.cleared ? Math.max(0, (season.maxFloor * 6 - totalTurns) * season.score.speedTurn) : 0
  const dailyQuestResults = getDailyQuestResults(s)
  const dailyQuestScore = dailyQuestResults.reduce((sum, item) => sum + (item.done ? item.score : 0), 0)
  return {
    total:
      floor * season.score.floor +
      (s.cleared ? season.score.clearBonus : 0) +
      maxCombo * season.score.combo +
      counterHits * season.score.counterHit +
      speedScore +
      dailyQuestScore,
    parts: {
      floor: floor * season.score.floor,
      clear: s.cleared ? season.score.clearBonus : 0,
      combo: maxCombo * season.score.combo,
      counter: counterHits * season.score.counterHit,
      speed: speedScore,
      dailyQuest: dailyQuestScore,
    },
    dailyQuestDone: dailyQuestResults.every(item => item.done),
    dailyQuestResults,
  }
}

function getClaimableTrialRewards(score, claimed) {
  const claimedSet = new Set(claimed || [])
  return getCurrentTrialSeason().rewardTrack.filter(tier => score >= tier.score && !claimedSet.has(tier.score))
}

module.exports = {
  getCurrentTrialSeason,
  getTrialSpecialFloors,
  getTrialStaminaCost,
  getTrialSeasonProgress,
  getTrialSeasonLabel,
  getDailyQuestForDate,
  getDailyQuestsForDate,
  getDailyAttrTheme,
  generateTrialFloorEvent,
  calcTrialScore,
  getClaimableTrialRewards,
}
