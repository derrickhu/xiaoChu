/**
 * 塔层系统 — 灵宠消消塔
 * 随机地图事件 + 怪物生成 + 奇遇 + 商店 + 休息 + BOSS
 * 无局外养成，每局完全重置
 */

// 宠物/法宝随机函数保留导入兼容（其他模块可能通过 tower 间接引用）
// const { randomPetByAttr, randomPet, randomPetFromPool } = require('./pets')
// const { randomWeapon } = require('./weapons')
const {
  TOWER_MAX_FLOOR,
  TOWER_COUNTER_MUL,
  TOWER_COUNTERED_MUL,
  TOWER_RECENT_LIMIT,
  TOWER_BASE_EVENT_WEIGHTS,
  TOWER_SHOP_DISPLAY_COUNT,
  TOWER_SHOP_FREE_COUNT,
  TOWER_SHOP_HP_COST_PCT,
} = require('./constants')

// ===== 五行属性基础 =====
const ATTRS = ['metal','wood','earth','water','fire']
const ATTR_NAME = { metal:'金', wood:'木', earth:'土', water:'水', fire:'火' }
const ATTR_COLOR = {
  metal: { main:'#ffd700', bg:'#353520', lt:'#ffed80', dk:'#cca800' },
  wood:  { main:'#4dcc4d', bg:'#153515', lt:'#80ff80', dk:'#20a020' },
  earth: { main:'#d4a056', bg:'#2a2015', lt:'#e8c080', dk:'#a07030' },
  water: { main:'#4dabff', bg:'#152535', lt:'#80ccff', dk:'#2080cc' },
  fire:  { main:'#ff4d4d', bg:'#3a1515', lt:'#ff8080', dk:'#cc2020' },
}
const COUNTER_MAP = { metal:'wood', wood:'earth', earth:'water', water:'fire', fire:'metal' }
const COUNTER_BY  = { wood:'metal', earth:'wood', water:'earth', fire:'water', metal:'fire' }
const COUNTER_MUL = TOWER_COUNTER_MUL
const COUNTERED_MUL = TOWER_COUNTERED_MUL

// 棋盘灵珠（含心珠）
const BEAD_ATTRS = ['metal','wood','earth','water','fire','heart']
const BEAD_ATTR_NAME = { ...ATTR_NAME, heart:'心' }
const BEAD_ATTR_COLOR = {
  ...ATTR_COLOR,
  heart: { main:'#ff69b4', bg:'#351525', lt:'#ff99cc', dk:'#cc3080' },
}

// ===== 事件类型 =====
const EVENT_TYPE = {
  BATTLE:  'battle',
  ELITE:   'elite',
  BOSS:    'boss',
  ADVENTURE: 'adventure',
  SHOP:    'shop',
  REST:    'rest',
}

const BASE_EVENT_WEIGHTS = TOWER_BASE_EVENT_WEIGHTS

const MAX_FLOOR = TOWER_MAX_FLOOR

// 境界表 / 怪物分段 / 敌技能 已迁移至 balance/enemy.js
const {
  REALM_TABLE, MONSTER_TIERS, ENEMY_DEF_RATIO, MONSTER_RANDOM_RANGE,
  TOWER_ELITE_MUL, TOWER_BOSS_SCALING, ENEMY_SKILLS,
} = require('./balance/enemy')

// 获取指定层的境界信息
function getRealmInfo(floor) {
  const idx = Math.max(0, Math.min(floor - 1, REALM_TABLE.length - 1))
  return REALM_TABLE[idx]
}

// MONSTER_TIERS 已迁移至 balance/enemy.js

// 普通怪物名池（按属性）
const MONSTER_NAMES = {
  metal: ['金灵鼠妖','铜甲兵','金锋散修','锐金妖兵','金翎蛮将','天罡妖卫','金鹏妖尊'],
  wood:  ['木灵花妖','藤蔓小精','青木散修','枯藤妖兵','苍木蛮将','灵木妖卫','万木妖尊'],
  earth: ['土灵石怪','泥人兵','黄土散修','山岩妖兵','裂地蛮将','厚土妖卫','磐岩妖尊'],
  water: ['水灵鱼妖','冰魄小精','碧水散修','寒潮妖兵','沧澜蛮将','深渊妖卫','蛟龙妖尊'],
  fire:  ['火灵狐妖','焰灵小精','赤炎散修','爆炎妖兵','焚天蛮将','烈焰妖卫','朱雀妖尊'],
}

// 精英怪物名池
const ELITE_NAMES = {
  metal: ['金甲妖将·碎天','破军金狮','金罡战魔'],
  wood:  ['枯木大妖·噬灵','缠枝毒蛇王','万木妖魔'],
  earth: ['磐岩巨魔·震地','山岳石王','镇地魔将'],
  water: ['深渊蛟魔·溺魂','冰魄仙蛇','寒潮魔将'],
  fire:  ['焚天魔凰·灭世','炎狱妖帝','赤炎魔君'],
}

// 精英怪技能
const ELITE_SKILLS = ['stun','defDown','selfHeal','breakBead','atkBuff']

// BOSS名池：按层级分为3个随机池
// 10层BOSS池（4个，对应 boss_1~4 图片）
const BOSS_POOL_10 = [
  { name:'炼狱守卫·妖兵统领', bossNum:1 },
  { name:'五行妖将·破阵',     bossNum:2 },
  { name:'天罡妖帝·噬天',     bossNum:3 },
  { name:'混沌魔神·灭世',     bossNum:4 },
]
// 20层BOSS池（4个，对应 boss_5~8 图片）
const BOSS_POOL_20 = [
  { name:'太古凶兽·吞天',     bossNum:5 },
  { name:'九天妖皇·逆仙',     bossNum:6 },
  { name:'混沌始祖·鸿蒙',     bossNum:7 },
  { name:'天道化身·审判',      bossNum:8 },
]
// 30层BOSS池（4个，对应 boss_9~10 图片 + 2个变体复用图）
const BOSS_POOL_30 = [
  { name:'万妖之主·通天',     bossNum:9 },
  { name:'无上大妖·超越',     bossNum:10 },
  { name:'太虚妖祖·混元',     bossNum:9 },   // 复用boss_9图
  { name:'末劫天魔·无极',     bossNum:10 },  // 复用boss_10图
]

// ENEMY_SKILLS 已迁移至 balance/enemy.js

// ===== BOSS专属技能组（每个BOSS有独立的2-3个技能） =====
// 技能组用 bossNum 索引；30层新增的2个变体用 'name' 作为额外key
const BOSS_SKILL_SETS = {
  // --- 10层BOSS池（2个技能） ---
  1: ['bossRage',    'bossBlitz'],     // 炼狱守卫·妖兵统领：狂暴+连击，纯攻击型
  2: ['bossConvert', 'bossWeaken'],    // 五行妖将·破阵：五行逆乱+双降，控制削弱型
  3: ['bossQuake',   'bossInferno'],   // 天罡妖帝·噬天：震地封行+业火，AOE持续伤害型
  4: ['bossDevour',  'bossDrain'],     // 混沌魔神·灭世：噬魂+吸血，续航消耗型
  // --- 20层BOSS池（2个技能） ---
  5: ['bossVoidSeal','bossBlitz'],     // 太古凶兽·吞天：封锁整行+连击，控制突击型
  6: ['bossMirror',  'bossSealAttr'],  // 九天妖皇·逆仙：反弹+属性封印，反打控制型
  7: ['bossQuake',   'bossDrain'],     // 混沌始祖·鸿蒙：震地封行+吸血，坦克型
  8: ['bossWeaken',  'bossAnnihil'],   // 天道化身·审判：双降+灭世，终极审判型
  // --- 30层BOSS池（3个技能） ---
  9:  ['bossCurse',   'bossSealAll',  'bossAnnihil'],  // 万妖之主·通天：诅咒+全场封珠+灭世
  10: ['bossUltimate','bossDrain',    'bossRage'],     // 无上大妖·超越：终焉全封+吸血+狂暴
  '太虚妖祖·混元': ['bossVoidSeal', 'bossCurse',  'bossSealAttr'],   // 封行+诅咒+属性封
  '末劫天魔·无极': ['bossUltimate', 'bossAnnihil','bossSealAll'],     // 终焉+灭世+全封
}

// 奇遇/商店/休息/Buff池 已迁移至 balance/towerEvent.js
const {
  ADVENTURES, SHOP_ITEMS, REST_OPTIONS,
  BUFF_POOL_MINOR, BUFF_POOL_MEDIUM, BUFF_POOL_MAJOR, BUFF_POOL_SPEEDKILL,
} = require('./balance/towerEvent')

const {
  TOWER_SKILL_UNLOCK, TOWER_FORCED_ELITE_FLOORS, TOWER_EVENT_SCALING,
  TOWER_BOSS_POOL_THRESHOLDS, TOWER_BOSS_LEVEL_DIVISOR, TOWER_REWARD_COUNT,
  TOWER_SPEED_KILL_TURNS, BEAD_WEIGHTS: _BEAD_WEIGHTS,
  TOWER_NAME_TIER_DIVISOR, TOWER_SHOP_DEFAULT_WEIGHT,
} = require('./balance/towerPacing')

const SHOP_DISPLAY_COUNT = TOWER_SHOP_DISPLAY_COUNT
const SHOP_FREE_COUNT = TOWER_SHOP_FREE_COUNT
const SHOP_HP_COST_PCT = TOWER_SHOP_HP_COST_PCT

const REWARD_TYPES = {
  NEW_PET:    'newPet',
  NEW_WEAPON: 'newWeapon',
  BUFF:       'buff',
}

const ALL_BUFF_REWARDS = [...BUFF_POOL_MINOR, ...BUFF_POOL_MEDIUM, ...BUFF_POOL_MAJOR]

// ===== 工具函数 =====
function _lerp(a, b, t) { return a + (b - a) * t }
function _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ===== 最近怪物记录（用于去重） =====
const _recentMonsters = []
const RECENT_LIMIT = TOWER_RECENT_LIMIT

function _pushRecent(avatar) {
  _recentMonsters.push(avatar)
  if (_recentMonsters.length > RECENT_LIMIT) _recentMonsters.shift()
}

// ===== 生成某层怪物 =====
function generateMonster(floor) {
  const attr = _pick(ATTRS)

  // 查找数值段
  let tier = MONSTER_TIERS[MONSTER_TIERS.length - 1]
  for (const t of MONSTER_TIERS) {
    if (floor >= t.minFloor && floor <= t.maxFloor) { tier = t; break }
  }

  // 层段内线性插值
  const progress = Math.min(1, (floor - tier.minFloor) / Math.max(1, tier.maxFloor - tier.minFloor))

  const rand = () => MONSTER_RANDOM_RANGE[0] + Math.random() * MONSTER_RANDOM_RANGE[1]
  let hp  = Math.round(_lerp(tier.hpMin, tier.hpMax, progress) * rand())
  let atk = Math.round(_lerp(tier.atkMin, tier.atkMax, progress) * rand())

  // 名字：基准档位 ±1 随机浮动，增加同层段怪物多样性
  const names = MONSTER_NAMES[attr]
  const baseIdx = Math.min(Math.floor(floor / TOWER_NAME_TIER_DIVISOR), names.length - 1)
  const lo = Math.max(0, baseIdx - 1)
  const hi = Math.min(names.length - 1, baseIdx + 1)
  // 在 [lo, hi] 范围内随机选取，优先避开最近出现过的
  const attrKeyMap = { metal:'m', wood:'w', earth:'e', water:'s', fire:'f' }
  const monKey = attrKeyMap[attr] || 'm'
  let nameIdx = baseIdx
  const candidates = []
  for (let i = lo; i <= hi; i++) candidates.push(i)
  // 过滤掉最近出现过的（同属性同档位 = 同张图）
  const fresh = candidates.filter(i => !_recentMonsters.includes(`enemies/tower/mon_${monKey}_${i + 1}`))
  nameIdx = fresh.length > 0 ? _pick(fresh) : _pick(candidates)
  const name = names[nameIdx]

  const skills = []
  const skillPoolLight = ['convert','aoe']
  const skillPool1 = ['poison','seal','convert']
  const skillPool2 = ['atkBuff','defDown','healBlock']
  if (floor <= TOWER_SKILL_UNLOCK.lightPhase) {
    skills.push(_pick(skillPoolLight))
  } else if (floor <= TOWER_SKILL_UNLOCK.basicPhase) {
    skills.push(_pick(skillPool1))
  } else {
    skills.push(_pick(skillPool1))
    if (floor >= TOWER_SKILL_UNLOCK.advancedPhase) skills.push(_pick(skillPool2))
  }
  if (floor >= TOWER_SKILL_UNLOCK.extraPhase && Math.random() < TOWER_SKILL_UNLOCK.extraChance) {
    const allSkills = [...skillPool1, ...skillPool2, 'breakBead']
    const extra = _pick(allSkills.filter(s => !skills.includes(s)))
    if (extra) skills.push(extra)
  }

  // 怪物图片
  const monIdx = nameIdx + 1
  const avatar = `enemies/tower/mon_${monKey}_${monIdx}`
  _pushRecent(avatar)

  return { name, attr, hp, maxHp: hp, atk, def: Math.round(atk * ENEMY_DEF_RATIO), skills, avatar }
}

// ===== 生成精英怪 =====
function generateElite(floor) {
  const base = generateMonster(floor)
  const attr = base.attr

  const hpMul = TOWER_ELITE_MUL.hp[0] + Math.random() * TOWER_ELITE_MUL.hp[1]
  const atkMul = TOWER_ELITE_MUL.atk[0] + Math.random() * TOWER_ELITE_MUL.atk[1]
  base.hp    = Math.round(base.hp * hpMul)
  base.maxHp = base.hp
  base.atk   = Math.round(base.atk * atkMul)
  base.def   = Math.round(base.def * TOWER_ELITE_MUL.def)

  // 名称
  base.name = _pick(ELITE_NAMES[attr])
  base.isElite = true

  // 精英必带2个技能
  const skillPool = ['stun','defDown','selfHeal','breakBead','atkBuff','poison','seal','eliteSealRow','eliteSealAttr','eliteSealHeavy']
  const s1 = _pick(skillPool)
  let s2 = _pick(skillPool)
  while (s2 === s1) s2 = _pick(skillPool)
  base.skills = [s1, s2]

  // 精英图片：elite_{属性缩写}_{1-3}，根据名字索引匹配
  const eliteAttrMap = { metal:'m', wood:'w', water:'s', fire:'f', earth:'e' }
  const eliteKey = eliteAttrMap[attr] || 'm'
  const eliteNames = ELITE_NAMES[attr]
  const eliteIdx = eliteNames.indexOf(base.name) + 1 || _rand(1,3)
  base.avatar = `enemies/tower/elite_${eliteKey}_${eliteIdx}`
  // 精英专属战斗背景（每属性3张随机选1张）
  base.battleBg = `enemies/tower_bg/bg_elite_${eliteKey}_${_rand(1,3)}`
  return base
}

// ===== 生成BOSS =====
function generateBoss(floor) {
  const base = generateMonster(floor)

  const bossLevel = Math.round(floor / TOWER_BOSS_LEVEL_DIVISOR)
  const bs = TOWER_BOSS_SCALING
  const hpMul  = Math.min(bs.hpBase  + (bossLevel - 1) * bs.hpStep,  bs.hpCap)
  const atkMul = Math.min(bs.atkBase + (bossLevel - 1) * bs.atkStep, bs.atkCap)
  const defMul = Math.min(bs.defBase + (bossLevel - 1) * bs.defStep, bs.defCap)

  base.hp    = Math.round(base.hp * hpMul)
  base.maxHp = base.hp
  base.atk   = Math.round(base.atk * atkMul)
  base.def   = Math.round(base.def * defMul)
  base.isBoss = true
  base.attr   = _pick(ATTRS)

  // 按层级从不同BOSS池中随机选取
  let pool
  if (floor >= TOWER_BOSS_POOL_THRESHOLDS.pool30)      pool = BOSS_POOL_30
  else if (floor >= TOWER_BOSS_POOL_THRESHOLDS.pool20) pool = BOSS_POOL_20
  else                                                  pool = BOSS_POOL_10

  const chosen = pool[Math.floor(Math.random() * pool.length)]
  base.name = chosen.name
  const bossNum = chosen.bossNum
  base.avatar = `enemies/tower/boss_${bossNum}`
  base.battleBg = `enemies/tower_bg/bg_boss_${bossNum}`

  // BOSS专属技能组：优先按名字查找（30层变体），否则按bossNum
  base.skills = BOSS_SKILL_SETS[chosen.name]
    ? [...BOSS_SKILL_SETS[chosen.name]]
    : (BOSS_SKILL_SETS[bossNum] ? [...BOSS_SKILL_SETS[bossNum]] : ['bossRage', 'bossBlitz'])

  return base
}

// ===== 生成某层事件 =====
function generateFloorEvent(floor) {
  // 每10层强制BOSS
  if (floor % 10 === 0) {
    return { type: EVENT_TYPE.BOSS, data: generateBoss(floor) }
  }
  if (TOWER_FORCED_ELITE_FLOORS.includes(floor)) {
    return { type: EVENT_TYPE.ELITE, data: generateElite(floor) }
  }

  // 权重随机事件
  const weights = { ...BASE_EVENT_WEIGHTS }

  // 第1层：只出普通战斗
  if (floor <= 1) {
    weights.elite = 0
    weights.adventure = 0
    weights.shop = 0
    weights.rest = 0
  } else if (floor <= 4) {
    weights.elite = 0
    weights.shop = 0
    weights.adventure = TOWER_EVENT_SCALING.earlyAdventure
    weights.rest = TOWER_EVENT_SCALING.earlyRest
  } else {
    const es = TOWER_EVENT_SCALING
    weights.elite += Math.floor(floor / es.eliteGrowth.divisor) * es.eliteGrowth.mult
    if (floor % 5 === 0) weights.elite += es.eliteBossFloorBonus
    weights.adventure += Math.floor(floor / es.adventureGrowth.divisor) * es.adventureGrowth.mult
    weights.shop += Math.floor(floor / es.shopGrowth.divisor) * es.shopGrowth.mult
    weights.rest += Math.floor(floor / es.restGrowth.divisor) * es.restGrowth.mult
    if (floor >= 15) weights.battle -= es.battleReduceAt15
    if (floor >= 22) weights.battle -= es.battleReduceAt22
    if (floor >= 15) weights.elite += es.eliteBonusAt15
  }

  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  let eventType = 'battle'

  for (const [type, w] of Object.entries(weights)) {
    roll -= w
    if (roll <= 0) { eventType = type; break }
  }

  switch (eventType) {
    case 'battle':
      return { type: EVENT_TYPE.BATTLE, data: generateMonster(floor) }
    case 'elite':
      return { type: EVENT_TYPE.ELITE, data: generateElite(floor) }
    case 'adventure':
      return { type: EVENT_TYPE.ADVENTURE, data: _pick(ADVENTURES) }
    case 'shop':
      // 按权重随机抽取4件商品（不重复）
      const items = []
      const pool = [...SHOP_ITEMS]
      for (let i = 0; i < SHOP_DISPLAY_COUNT && pool.length > 0; i++) {
        const totalW = pool.reduce((s, it) => s + (it.weight || TOWER_SHOP_DEFAULT_WEIGHT), 0)
        let roll = Math.random() * totalW
        let picked = 0
        for (let j = 0; j < pool.length; j++) {
          roll -= (pool[j].weight || TOWER_SHOP_DEFAULT_WEIGHT)
          if (roll <= 0) { picked = j; break }
        }
        items.push(pool.splice(picked, 1)[0])
      }
      return { type: EVENT_TYPE.SHOP, data: items }
    case 'rest':
      return { type: EVENT_TYPE.REST, data: REST_OPTIONS }
    default:
      return { type: EVENT_TYPE.BATTLE, data: generateMonster(floor) }
  }
}

// ===== 生成胜利后三选一奖励（纯 Buff 模式） =====
// eventType: 'battle' | 'elite' | 'boss'
// speedKill: 是否速通（5回合内击败）
// 其余参数保留签名兼容，但不再使用
function generateRewards(floor, eventType, speedKill, ownedWeaponIds, sessionPetPool, ownedPetIds, maxedPetIds) {
  const rewards = []
  const usedIds = new Set()

  function pickFrom(pool) {
    const avail = pool.filter(b => !usedIds.has(b.id))
    if (avail.length === 0) return null
    const b = _pick(avail)
    usedIds.add(b.id)
    return { type: REWARD_TYPES.BUFF, label: b.label, data: { ...b } }
  }

  if (eventType === 'boss') {
    for (let i = 0; i < TOWER_REWARD_COUNT; i++) rewards.push(pickFrom(BUFF_POOL_MAJOR))
  } else if (eventType === 'elite') {
    for (let i = 0; i < TOWER_REWARD_COUNT; i++) rewards.push(pickFrom(BUFF_POOL_MEDIUM))
  } else {
    for (let i = 0; i < TOWER_REWARD_COUNT; i++) rewards.push(pickFrom(BUFF_POOL_MINOR))
  }

  if (speedKill) {
    rewards.push(pickFrom(BUFF_POOL_SPEEDKILL))
  }

  return rewards.filter(r => r != null)
}

// ===== 灵珠权重（根据属性偏好生成） =====
function getBeadWeights(floorAttr, weapon) {
  const weights = {
    metal: 1, wood: 1, earth: 1, water: 1, fire: 1, heart: _BEAD_WEIGHTS.heart
  }
  if (floorAttr && weights[floorAttr] !== undefined) {
    weights[floorAttr] = _BEAD_WEIGHTS.attrBias
  }
  if (weapon && weapon.type === 'beadRateUp' && weapon.attr) {
    weights[weapon.attr] = (weights[weapon.attr] || 1) * _BEAD_WEIGHTS.weaponMul
  }
  return weights
}

module.exports = {
  // 常量
  MAX_FLOOR,
  ATTRS, ATTR_NAME, ATTR_COLOR,
  COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL,
  BEAD_ATTRS, BEAD_ATTR_NAME, BEAD_ATTR_COLOR,
  EVENT_TYPE,
  ENEMY_SKILLS,
  ADVENTURES, SHOP_ITEMS, SHOP_DISPLAY_COUNT, SHOP_FREE_COUNT, SHOP_HP_COST_PCT, REST_OPTIONS,
  REWARD_TYPES,
  ALL_BUFF_REWARDS,
  BUFF_POOL_SPEEDKILL,
  MONSTER_NAMES, ELITE_NAMES, BOSS_POOL_10, BOSS_POOL_20, BOSS_POOL_30,
  REALM_TABLE, getRealmInfo,

  // 生成器
  generateMonster,
  generateElite,
  generateBoss,
  generateFloorEvent,
  generateRewards,
  getBeadWeights,
}
