/**
 * 装备系统数据定义（五行攻防版）
 * 
 * 五行属性：金(metal) / 木(wood) / 土(earth) / 水(water) / 火(fire)
 * 克制关系：金→木→土→水→火→金（克制×1.5，被克×0.7）
 * 
 * 装备部位：头盔 / 衣服 / 披风 / 饰品 / 武器（共5个）
 * 品质等级：白品·凡阶 / 绿品·良阶 / 蓝品·优阶 / 紫品·臻阶 / 橙品·神阶
 * 
 * 角色/怪物属性：
 *   气力值（=血量上限）、五种五行攻击值、五种五行防御值、回复值（彩珠回血加成）
 * 
 * 品质决定：属性条数(1/2/3/4/5)、技能解锁消除次数(5/8/12/18/25)、buff持续回合
 * 唯一规则：仅衣服可出现"回复"属性
 */

// ===== 五行属性 =====
const ATTRS = ['metal','wood','earth','water','fire']
const ATTR_NAME = { metal:'金', wood:'木', earth:'土', water:'水', fire:'火' }
const ATTR_COLOR = {
  metal: { main:'#ffd700', bg:'#353520', lt:'#ffed80', dk:'#cca800' },
  wood:  { main:'#4dcc4d', bg:'#153515', lt:'#80ff80', dk:'#20a020' },
  earth: { main:'#d4a056', bg:'#2a2015', lt:'#e8c080', dk:'#a07030' },
  water: { main:'#4dabff', bg:'#152535', lt:'#80ccff', dk:'#2080cc' },
  fire:  { main:'#ff4d4d', bg:'#3a1515', lt:'#ff8080', dk:'#cc2020' },
}

// 克制关系：金→木→土→水→火→金
const COUNTER_MAP = { metal:'wood', wood:'earth', earth:'water', water:'fire', fire:'metal' }
// 被克关系（反查）
const COUNTER_BY = { wood:'metal', earth:'wood', water:'earth', fire:'water', metal:'fire' }

// 棋盘用灵珠属性（含彩珠用于回血，对应衣服彩灵珠回血）
const BEAD_ATTRS = ['metal','wood','earth','water','fire','heart']
const BEAD_ATTR_NAME = { ...ATTR_NAME, heart:'心' }
const BEAD_ATTR_COLOR = {
  ...ATTR_COLOR,
  heart: { main:'#ff69b4', bg:'#351525', lt:'#ff99cc', dk:'#cc3080' },
}

// ===== 品质定义 =====
// 白品·凡阶 / 绿品·良阶 / 蓝品·优阶 / 紫品·臻阶 / 橙品·神阶
const QUALITY = {
  white:  { id:'white',  name:'凡阶', color:'#b0b0b0', glow:'rgba(176,176,176,0.3)', statSlots:1, triggerCount:3,  buffDur:1, ultMulti:2.5 },
  green:  { id:'green',  name:'良阶', color:'#4dcc4d', glow:'rgba(77,204,77,0.4)',   statSlots:2, triggerCount:4,  buffDur:1, ultMulti:3 },
  blue:   { id:'blue',   name:'优阶', color:'#4a9eff', glow:'rgba(74,158,255,0.5)',  statSlots:3, triggerCount:5,  buffDur:2, ultMulti:3.5 },
  purple: { id:'purple', name:'臻阶', color:'#b44aff', glow:'rgba(180,74,255,0.6)',  statSlots:4, triggerCount:7,  buffDur:2, ultMulti:4 },
  orange: { id:'orange', name:'神阶', color:'#ff8c00', glow:'rgba(255,140,0,0.7)',   statSlots:5, triggerCount:10, buffDur:3, ultMulti:5 },
}
const QUALITY_ORDER = ['white','green','blue','purple','orange']

// ===== 装备部位 =====
const EQUIP_SLOT = {
  helmet:  { id:'helmet',  name:'头盔', icon:'⛑️',  desc:'凝神固本之冠', role:'防御、减伤、全队防御' },
  armor:   { id:'armor',   name:'衣服', icon:'🛡️',  desc:'回血、血量上限、唯一续航', role:'回血、血量上限、唯一续航' },
  cloak:   { id:'cloak',   name:'披风', icon:'🧣',  desc:'转珠强化、棋盘操作', role:'转珠强化、棋盘操作、洗牌、生成珠子' },
  trinket: { id:'trinket', name:'饰品', icon:'💎',  desc:'减防、无视防御、封印禁招', role:'减防、无视防御、封印禁招' },
  weapon:  { id:'weapon',  name:'武器', icon:'⚔️',  desc:'五行伤害、转色、真实伤害', role:'五行伤害、转色、真实伤害' },
}

// ===== 属性定义 =====
// 气力值（血量加成）、五行攻击×5、五行防御×5、回复值（彩珠回血加成）
const STAT_DEFS = {
  stamina:  { id:'stamina',  name:'气力',   icon:'❤️', color:'#ff5555' },
  metalAtk: { id:'metalAtk', name:'金攻',   icon:'⚔️', color:'#ffd700' },
  woodAtk:  { id:'woodAtk',  name:'木攻',   icon:'⚔️', color:'#4dcc4d' },
  earthAtk: { id:'earthAtk', name:'土攻',   icon:'⚔️', color:'#d4a056' },
  waterAtk: { id:'waterAtk', name:'水攻',   icon:'⚔️', color:'#4dabff' },
  fireAtk:  { id:'fireAtk',  name:'火攻',   icon:'⚔️', color:'#ff4d4d' },
  metalDef: { id:'metalDef', name:'金防',   icon:'🛡️', color:'#ffd700' },
  woodDef:  { id:'woodDef',  name:'木防',   icon:'🛡️', color:'#4dcc4d' },
  earthDef: { id:'earthDef', name:'土防',   icon:'🛡️', color:'#d4a056' },
  waterDef: { id:'waterDef', name:'水防',   icon:'🛡️', color:'#4dabff' },
  fireDef:  { id:'fireDef',  name:'火防',   icon:'🛡️', color:'#ff4d4d' },
  recovery: { id:'recovery', name:'回复',   icon:'💚', color:'#ff69b4' },
}
const STAT_KEYS = ['stamina','metalAtk','woodAtk','earthAtk','waterAtk','fireAtk','metalDef','woodDef','earthDef','waterDef','fireDef','recovery']
// 五行攻/防键名映射
const ATK_KEY = { metal:'metalAtk', wood:'woodAtk', earth:'earthAtk', water:'waterAtk', fire:'fireAtk' }
const DEF_KEY = { metal:'metalDef', wood:'woodDef', earth:'earthDef', water:'waterDef', fire:'fireDef' }

// ===== 部位属性池（严格锁定） =====
// 每个部位可出现的属性类型：
// 头盔：气力、对应五行攻、对应五行防
// 衣服：气力、对应五行防、回复（唯一续航）
// 披风：气力、对应五行攻、对应五行防
// 饰品：对应五行攻、气力
// 武器：对应五行攻、气力
// "对应五行攻/防"在生成时根据装备五行属性动态映射
const SLOT_STAT_POOL = {
  helmet:  ['stamina','atkByAttr','defByAttr'],
  armor:   ['stamina','defByAttr','recovery'],  // recovery仅衣服
  cloak:   ['stamina','atkByAttr','defByAttr'],
  trinket: ['atkByAttr','stamina'],
  weapon:  ['atkByAttr','stamina'],
}

// 等级→属性基础值表
const STAT_BASE_PER_LEVEL = {
  stamina:  { base:60,  growth:40 },    // 气力值（血量加成）Lv1≈100, Lv30≈1260
  atk:      { base:8,   growth:6 },     // 五行攻击（通用基础） Lv1≈14, Lv30≈188
  def:      { base:5,   growth:4 },     // 五行防御（通用基础） Lv1≈9, Lv30≈125
  recovery: { base:15,  growth:8 },     // 回复值（心珠回血加成）Lv1≈23, Lv30≈255
}

const MAX_LEVEL = 30

// ===== 技能触发规则 =====
// 触发类型枚举（可扩展）
const TRIGGER_TYPE = {
  NONE: 0,            // 无（仅主动点击）
  ELIM_COUNT: 1,      // 同属性消除次数累计（当前默认）
  HP_BELOW: 2,        // 自身血量低于%
  ENEMY_HP_BELOW: 3,  // 敌方血量低于%
  TURN_REACH: 4,      // 回合数达到
  COMBO_REACH: 5,     // 连续Combo达到
  HEART_ELIM: 6,      // 消除彩珠数量
}

// ===== 技能模板池 =====
// 按部位×五行的技能效果
const SKILL_TEMPLATES = {
  // 武器：五行伤害为主
  weapon: {
    metal: { name:'金光斩', desc:'金灵之力造成{dmg}点伤害', baseDmg:[200,300,450,600,900] },
    wood:  { name:'青木剑气', desc:'木灵剑气造成{dmg}点伤害', baseDmg:[200,300,450,600,900] },
    earth: { name:'裂地击', desc:'土灵之力造成{dmg}点伤害', baseDmg:[200,300,450,600,900] },
    water: { name:'寒冰诀', desc:'水灵之力造成{dmg}点伤害', baseDmg:[200,300,450,600,900] },
    fire:  { name:'三昧真火', desc:'火灵之力造成{dmg}点伤害', baseDmg:[200,300,450,600,900] },
  },
  // 头盔：防御为主
  helmet: {
    metal: { name:'金钟罩', desc:'提升防御{def}点,持续{dur}回合', baseDef:[40,65,100,150,220] },
    wood:  { name:'翠灵宝冠', desc:'提升防御{def}点,持续{dur}回合', baseDef:[40,65,100,150,220] },
    earth: { name:'厚土护顶', desc:'提升防御{def}点,持续{dur}回合', baseDef:[40,65,100,150,220] },
    water: { name:'冰晶发冠', desc:'提升防御{def}点,持续{dur}回合', baseDef:[40,65,100,150,220] },
    fire:  { name:'炎灵聚顶', desc:'提升防御{def}点,持续{dur}回合', baseDef:[40,65,100,150,220] },
  },
  // 衣服：回血为主（唯一续航）
  armor: {
    metal: { name:'金丝甲', desc:'回复气血{heal}点', baseHeal:[60,100,150,220,320] },
    wood:  { name:'生机道袍', desc:'回复气血{heal}点', baseHeal:[60,100,150,220,320] },
    earth: { name:'厚土灵衣', desc:'回复气血{heal}点', baseHeal:[60,100,150,220,320] },
    water: { name:'碧水仙衣', desc:'回复气血{heal}点', baseHeal:[60,100,150,220,320] },
    fire:  { name:'赤焰道袍', desc:'回复气血{heal}点', baseHeal:[60,100,150,220,320] },
  },
  // 披风：棋盘操作
  cloak: {
    metal: { name:'金风披', desc:'造成{dmg}点伤害并增强转珠', baseDmg:[150,220,320,450,650] },
    wood:  { name:'翠竹仙衣', desc:'造成{dmg}点伤害并增强转珠', baseDmg:[150,220,320,450,650] },
    earth: { name:'厚土仙披', desc:'造成{dmg}点伤害并增强转珠', baseDmg:[150,220,320,450,650] },
    water: { name:'碧水仙纱', desc:'造成{dmg}点伤害并增强转珠', baseDmg:[150,220,320,450,650] },
    fire:  { name:'赤焰仙披', desc:'造成{dmg}点伤害并增强转珠', baseDmg:[150,220,320,450,650] },
  },
  // 饰品：减防/debuff
  trinket: {
    metal: { name:'金灵珠', desc:'降低敌方攻击{debuff}点,持续{dur}回合', baseDebuff:[30,50,80,120,180] },
    wood:  { name:'青木灵佩', desc:'降低敌方攻击{debuff}点,持续{dur}回合', baseDebuff:[30,50,80,120,180] },
    earth: { name:'厚土灵佩', desc:'降低敌方攻击{debuff}点,持续{dur}回合', baseDebuff:[30,50,80,120,180] },
    water: { name:'碧海灵玉', desc:'降低敌方攻击{debuff}点,持续{dur}回合', baseDebuff:[30,50,80,120,180] },
    fire:  { name:'赤炎灵珠', desc:'降低敌方攻击{debuff}点,持续{dur}回合', baseDebuff:[30,50,80,120,180] },
  },
}

// 法宝命名
const EQUIP_NAMES = {
  weapon:  { metal:'金光飞剑', wood:'青木法杖', earth:'厚土重锤', water:'碧水灵剑', fire:'赤焰飞剑' },
  helmet:  { metal:'金钟法冠', wood:'翠灵宝冠', earth:'厚土灵冠', water:'碧水灵冠', fire:'赤焰法冠' },
  armor:   { metal:'金丝道袍', wood:'生机灵衣', earth:'厚土战袍', water:'碧水仙衣', fire:'赤焰道袍' },
  cloak:   { metal:'金风仙披', wood:'翠竹仙衣', earth:'厚土仙披', water:'碧水仙纱', fire:'赤焰仙披' },
  trinket: { metal:'金灵法珠', wood:'青木灵佩', earth:'厚土灵佩', water:'碧海灵玉', fire:'赤炎灵珠' },
}

// 被动技能模板
const PASSIVE_TYPES = [
  { id:'staminaUp', name:'固本培元', desc:'提升气力 {val}点',       field:'stamina' },
  { id:'atkUp',     name:'灵力增幅', desc:'提升对应五行攻击 {val}点', field:'atk' },
  { id:'defUp',     name:'金刚不坏', desc:'提升对应五行防御 {val}点', field:'def' },
  { id:'cdDown',    name:'灵台清明', desc:'技能蓄力次数-{val}',      field:'cd' },
  { id:'recUp',     name:'生机不息', desc:'提升回复 {val}点',        field:'recovery' },
]

/**
 * 为装备生成属性条目
 * 品质决定条数(1/2/3/4/5)，从部位属性池中随机选取
 * "atkByAttr" 和 "defByAttr" 根据装备五行属性动态映射为具体的五行攻/防
 */
function _genEquipStats(slot, attr, qualityId, level) {
  const q = QUALITY[qualityId]
  const pool = SLOT_STAT_POOL[slot]
  const count = Math.min(q.statSlots, pool.length)
  // 将抽象key映射为具体key
  const resolvedPool = pool.map(k => {
    if (k === 'atkByAttr') return ATK_KEY[attr]  // e.g. metalAtk
    if (k === 'defByAttr') return DEF_KEY[attr]   // e.g. metalDef
    return k  // stamina / recovery
  })
  // 随机选取不重复
  const shuffled = resolvedPool.slice().sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, count)
  const stats = {}
  selected.forEach(key => {
    let baseDef
    if (key === 'stamina') baseDef = STAT_BASE_PER_LEVEL.stamina
    else if (key === 'recovery') baseDef = STAT_BASE_PER_LEVEL.recovery
    else if (key.endsWith('Atk')) baseDef = STAT_BASE_PER_LEVEL.atk
    else if (key.endsWith('Def')) baseDef = STAT_BASE_PER_LEVEL.def
    if (baseDef) {
      const baseVal = baseDef.base + baseDef.growth * level
      const min = Math.round(baseVal * 0.85)
      const max = Math.round(baseVal * 1.15)
      stats[key] = _randRange(min, max)
    }
  })
  return stats
}

/**
 * 生成一件装备
 */
function generateEquipment(slot, attr, qualityId, level) {
  const q = QUALITY[qualityId]
  const qi = QUALITY_ORDER.indexOf(qualityId)
  const lv = Math.max(1, Math.min(MAX_LEVEL, level || 1))
  const name = EQUIP_NAMES[slot]?.[attr] || `${ATTR_NAME[attr]}${EQUIP_SLOT[slot]?.name||''}`

  // 属性（气力+五行攻防+回复）
  const stats = _genEquipStats(slot, attr, qualityId, lv)

  // 普通技能（绑定装备自身五行）
  const skillTpl = SKILL_TEMPLATES[slot]?.[attr]
  const skill = { name: skillTpl?.name || '普通攻击', desc: skillTpl?.desc || '造成伤害', attr }
  skill.triggerType = TRIGGER_TYPE.ELIM_COUNT  // 默认：同属性消除次数
  skill.triggerCount = q.triggerCount           // 品质决定解锁次数

  if (skillTpl) {
    if (skillTpl.baseDmg)    skill.dmg    = _randRange(skillTpl.baseDmg[qi]*0.9, skillTpl.baseDmg[qi]*1.1)
    if (skillTpl.baseHeal)   skill.heal   = _randRange(skillTpl.baseHeal[qi]*0.9, skillTpl.baseHeal[qi]*1.1)
    if (skillTpl.baseDef)    skill.def    = _randRange(skillTpl.baseDef[qi]*0.9, skillTpl.baseDef[qi]*1.1)
    if (skillTpl.baseDebuff) skill.debuff = _randRange(skillTpl.baseDebuff[qi]*0.9, skillTpl.baseDebuff[qi]*1.1)
  }
  skill.buffDur = q.buffDur  // buff持续回合数由品质决定

  // 仙技（普通技能 × 倍率）
  const ultMulti = q.ultMulti + (Math.random()-0.5)*0.4
  const ult = {
    name: '天·'+(skillTpl?.name || '奥义'),
    desc: '(仙技)'+(skillTpl?.desc || '强力攻击').replace(/{(\w+)}/g,'强化'),
    attr, multi: ultMulti,
  }
  if (skill.dmg)    ult.dmg    = Math.round(skill.dmg * ultMulti)
  if (skill.heal)   ult.heal   = Math.round(skill.heal * ultMulti)
  if (skill.def)    ult.def    = Math.round(skill.def * ultMulti)
  if (skill.debuff) ult.debuff = Math.round(skill.debuff * ultMulti)

  // 被动技能（随机2个不同类型）
  const passiveRange = { white:[80,150], green:[150,280], blue:[280,450], purple:[450,650], orange:[650,1000] }
  const pRange = passiveRange[qualityId] || [100,200]
  const shuffledP = PASSIVE_TYPES.slice().sort(() => Math.random()-0.5)
  const passives = shuffledP.slice(0,2).map(pt => {
    const val = pt.field === 'cd'
      ? (qi >= 3 ? 2 : 1)
      : _randRange(pRange[0], pRange[1])
    return { id:pt.id, name:pt.name, desc:pt.desc.replace('{val}',val), val, field:pt.field }
  })

  return {
    uid: _uid(),
    slot,
    attr,
    quality: qualityId,
    level: lv,
    name,
    stats,
    skill,
    ult,
    ultTrigger: q.triggerCount,  // 技能解锁消除次数
    passives,
  }
}

/**
 * 随机品质（按权重，最高蓝装）
 */
function randomQuality(tier) {
  // 最多掉落蓝装（white/green/blue），不出紫/橙
  const weights = {
    low:  [50, 35, 15],    // white/green/blue
    mid:  [20, 40, 40],
    high: [10, 35, 55],
  }
  const maxQualities = ['white', 'green', 'blue']
  const w = weights[tier] || weights.low
  const r = Math.random()*100
  let sum = 0
  for (let i=0; i<maxQualities.length; i++) {
    sum += w[i]
    if (r < sum) return maxQualities[i]
  }
  return 'white'
}

/**
 * 随机生成掉落装备
 * @param {string} tier - 难度档位 low/mid/high
 * @param {number} stageIndex - 关卡层数(1-10)，用于限制装备等级范围
 */
function randomDrop(tier, stageIndex) {
  // 槽位掉落权重：头盔/衣服最高，披风次之，武器再次，饰品最低
  const slotWeights = { helmet:30, armor:30, cloak:18, weapon:14, trinket:8 }
  const slotEntries = Object.entries(slotWeights)
  const totalW = slotEntries.reduce((s, e) => s + e[1], 0)
  let r = Math.random() * totalW, slot = slotEntries[0][0]
  for (const [s, w] of slotEntries) { r -= w; if (r <= 0) { slot = s; break } }
  const attr = ATTRS[Math.floor(Math.random()*ATTRS.length)]
  const quality = randomQuality(tier)

  // 装备等级受关卡层数限制
  let minLv, maxLv
  const si = stageIndex || 1
  if (tier === 'high') {
    // 金丹难度：等级稍高
    minLv = Math.max(1, si)
    maxLv = Math.min(MAX_LEVEL, si * 2 + 3)
  } else if (tier === 'mid') {
    // 筑基难度
    minLv = Math.max(1, si - 1)
    maxLv = Math.min(MAX_LEVEL, si * 2)
  } else {
    // 练气难度
    minLv = Math.max(1, si - 1)
    maxLv = Math.min(MAX_LEVEL, si + 3)
  }
  const level = _randRange(minLv, maxLv)
  return generateEquipment(slot, attr, quality, level)
}

// 工具函数
function _randRange(min, max) { return Math.round(min + Math.random()*(max-min)) }
function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8) }

module.exports = {
  ATTRS, ATTR_NAME, ATTR_COLOR,
  BEAD_ATTRS, BEAD_ATTR_NAME, BEAD_ATTR_COLOR,
  COUNTER_MAP, COUNTER_BY,
  QUALITY, QUALITY_ORDER,
  EQUIP_SLOT,
  STAT_DEFS, STAT_KEYS, ATK_KEY, DEF_KEY, MAX_LEVEL,
  SLOT_STAT_POOL, STAT_BASE_PER_LEVEL,
  TRIGGER_TYPE,
  SKILL_TEMPLATES, PASSIVE_TYPES, EQUIP_NAMES,
  generateEquipment, randomQuality, randomDrop,
}
