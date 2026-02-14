/**
 * 装备系统数据定义（五行攻防版·重构）
 * 
 * 五行属性：金(metal) / 木(wood) / 土(earth) / 水(water) / 火(fire)
 * 克制关系：金→木→土→水→火→金（克制×1.5，被克×0.6）
 * 
 * 装备部位：头盔 / 衣服 / 披风 / 饰品 / 武器（共5个）
 * 品质等级：白品·凡阶 / 绿品·良阶 / 蓝品·优阶 / 紫品·臻阶 / 橙品·神阶
 * 
 * 装备只保留：属性加成 + 绝技
 * - 品质决定属性加成的条数(1/2/3/4/5)
 * - 等级决定属性加成数值的上下限
 * - 绝技从绝技库中指定或随机选取
 * 
 * 获取装备流程：随机装备类型 → 随机品质和等级 → 随机属性数值和绝技
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

// 棋盘用灵珠属性（含心珠用于回血）
const BEAD_ATTRS = ['metal','wood','earth','water','fire','heart']
const BEAD_ATTR_NAME = { ...ATTR_NAME, heart:'心' }
const BEAD_ATTR_COLOR = {
  ...ATTR_COLOR,
  heart: { main:'#ff69b4', bg:'#351525', lt:'#ff99cc', dk:'#cc3080' },
}

// ===== 品质定义 =====
const QUALITY = {
  white:  { id:'white',  name:'凡阶', color:'#b0b0b0', glow:'rgba(176,176,176,0.3)', statSlots:1, triggerCount:3,  buffDur:1 },
  green:  { id:'green',  name:'良阶', color:'#4dcc4d', glow:'rgba(77,204,77,0.4)',   statSlots:2, triggerCount:4,  buffDur:1 },
  blue:   { id:'blue',   name:'优阶', color:'#4a9eff', glow:'rgba(74,158,255,0.5)',  statSlots:3, triggerCount:5,  buffDur:2 },
  purple: { id:'purple', name:'臻阶', color:'#b44aff', glow:'rgba(180,74,255,0.6)',  statSlots:4, triggerCount:7,  buffDur:2 },
  orange: { id:'orange', name:'神阶', color:'#ff8c00', glow:'rgba(255,140,0,0.7)',   statSlots:5, triggerCount:10, buffDur:3 },
}
const QUALITY_ORDER = ['white','green','blue','purple','orange']

// ===== 装备部位 =====
const EQUIP_SLOT = {
  helmet:  { id:'helmet',  name:'头盔', icon:'⛑️',  desc:'凝神固本之冠' },
  armor:   { id:'armor',   name:'衣服', icon:'🛡️',  desc:'回血、血量上限、唯一续航' },
  cloak:   { id:'cloak',   name:'披风', icon:'🧣',  desc:'转珠强化、棋盘操作' },
  trinket: { id:'trinket', name:'饰品', icon:'💎',  desc:'减防、无视防御、封印禁招' },
  weapon:  { id:'weapon',  name:'武器', icon:'⚔️',  desc:'五行伤害、转色、真实伤害' },
}

// ===== 属性定义 =====
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
const SLOT_STAT_POOL = {
  helmet:  ['stamina','atkByAttr','defByAttr'],
  armor:   ['stamina','defByAttr','recovery'],  // recovery仅衣服
  cloak:   ['stamina','atkByAttr','defByAttr'],
  trinket: ['atkByAttr','stamina'],
  weapon:  ['atkByAttr','stamina'],
}

// 等级→属性基础值表（低起点平滑成长）
const STAT_BASE_PER_LEVEL = {
  stamina:  { base:10,  growth:8 },
  atk:      { base:2,   growth:2 },
  def:      { base:1,   growth:1 },
  recovery: { base:2,   growth:1.5 },
}

const MAX_LEVEL = 30

// ========================================
// ===== 绝技库 (Ult Skill Library) =====
// ========================================
// 每个绝技有唯一id，包含名称、描述、效果类型和按品质分档的数值
// 装备模板通过 ultPool 指定可选绝技列表

const ULT_LIBRARY = {
  // ===== 伤害类绝技 =====
  golden_slash: {
    id: 'golden_slash', name: '金光斩', attr: 'metal',
    desc: '金灵之力造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [50, 80, 120, 170, 250],
  },
  wood_sword: {
    id: 'wood_sword', name: '青木剑气', attr: 'wood',
    desc: '木灵剑气造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [50, 80, 120, 170, 250],
  },
  earth_slam: {
    id: 'earth_slam', name: '裂地击', attr: 'earth',
    desc: '土灵之力造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [50, 80, 120, 170, 250],
  },
  ice_blast: {
    id: 'ice_blast', name: '寒冰诀', attr: 'water',
    desc: '水灵之力造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [50, 80, 120, 170, 250],
  },
  true_fire: {
    id: 'true_fire', name: '三昧真火', attr: 'fire',
    desc: '火灵之力造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [60, 95, 140, 200, 280],
  },
  wind_blade: {
    id: 'wind_blade', name: '疾风斩', attr: 'metal',
    desc: '高速金风造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [45, 75, 110, 160, 230],
  },
  thorns: {
    id: 'thorns', name: '荆棘缠绕', attr: 'wood',
    desc: '木灵荆棘造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [45, 70, 105, 150, 220],
  },
  lava_burst: {
    id: 'lava_burst', name: '熔岩爆发', attr: 'fire',
    desc: '烈焰喷发造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [55, 85, 130, 180, 260],
  },
  tidal_wave: {
    id: 'tidal_wave', name: '潮汐之力', attr: 'water',
    desc: '汹涌水灵造成{dmg}点伤害',
    effect: 'dmg', baseDmg: [50, 80, 120, 170, 250],
  },

  // ===== 回复类绝技 =====
  golden_armor_heal: {
    id: 'golden_armor_heal', name: '金丝回元', attr: 'metal',
    desc: '金灵护体回复{heal}点气血',
    effect: 'heal', baseHeal: [15, 25, 40, 60, 90],
  },
  life_spring: {
    id: 'life_spring', name: '生机涌泉', attr: 'wood',
    desc: '木灵生机回复{heal}点气血',
    effect: 'heal', baseHeal: [20, 35, 50, 75, 110],
  },
  earth_nurture: {
    id: 'earth_nurture', name: '厚土培元', attr: 'earth',
    desc: '土灵滋养回复{heal}点气血',
    effect: 'heal', baseHeal: [15, 25, 40, 60, 90],
  },
  water_heal: {
    id: 'water_heal', name: '碧水仙诀', attr: 'water',
    desc: '水灵治愈回复{heal}点气血',
    effect: 'heal', baseHeal: [18, 30, 45, 65, 100],
  },
  fire_rebirth: {
    id: 'fire_rebirth', name: '浴火重生', attr: 'fire',
    desc: '火灵焚烧后回复{heal}点气血',
    effect: 'heal', baseHeal: [12, 22, 35, 55, 80],
  },

  // ===== 护盾类绝技 =====
  golden_bell: {
    id: 'golden_bell', name: '金钟罩', attr: 'metal',
    desc: '金灵护体获得{def}点护盾,持续{dur}回合',
    effect: 'def', baseDef: [10, 18, 30, 45, 65],
  },
  earth_wall: {
    id: 'earth_wall', name: '厚土壁垒', attr: 'earth',
    desc: '厚土之力获得{def}点护盾,持续{dur}回合',
    effect: 'def', baseDef: [12, 22, 35, 55, 80],
  },
  ice_shield: {
    id: 'ice_shield', name: '冰晶护体', attr: 'water',
    desc: '冰灵结晶获得{def}点护盾,持续{dur}回合',
    effect: 'def', baseDef: [10, 18, 30, 45, 65],
  },
  wood_barrier: {
    id: 'wood_barrier', name: '翠灵结界', attr: 'wood',
    desc: '木灵结界获得{def}点护盾,持续{dur}回合',
    effect: 'def', baseDef: [8, 15, 25, 40, 58],
  },
  flame_shield: {
    id: 'flame_shield', name: '炎灵护壁', attr: 'fire',
    desc: '火灵结界获得{def}点护盾,持续{dur}回合',
    effect: 'def', baseDef: [8, 14, 22, 35, 52],
  },

  // ===== 减益类绝技 =====
  metal_seal: {
    id: 'metal_seal', name: '金灵封印', attr: 'metal',
    desc: '封印敌方降低攻击{debuff}点,持续{dur}回合',
    effect: 'debuff', baseDebuff: [8, 14, 22, 35, 50],
  },
  poison_mist: {
    id: 'poison_mist', name: '毒雾弥漫', attr: 'wood',
    desc: '毒灵弥漫降低敌方攻击{debuff}点,持续{dur}回合',
    effect: 'debuff', baseDebuff: [10, 16, 25, 38, 55],
  },
  quicksand: {
    id: 'quicksand', name: '流沙陷阱', attr: 'earth',
    desc: '流沙困敌降低攻击{debuff}点,持续{dur}回合',
    effect: 'debuff', baseDebuff: [8, 14, 22, 35, 50],
  },
  frost_slow: {
    id: 'frost_slow', name: '霜寒减速', attr: 'water',
    desc: '寒冰侵袭降低敌方攻击{debuff}点,持续{dur}回合',
    effect: 'debuff', baseDebuff: [8, 14, 22, 35, 50],
  },
  fire_weaken: {
    id: 'fire_weaken', name: '灼热削弱', attr: 'fire',
    desc: '灼热降低敌方攻击{debuff}点,持续{dur}回合',
    effect: 'debuff', baseDebuff: [7, 12, 20, 30, 45],
  },
}

// ========================================
// ===== 装备模板库 =====
// ========================================
// 每个装备模板定义：名称、部位、五行属性、可选绝技池(ultPool)
// 生成时从 ultPool 中随机选取一个绝技
// ultPool 可以是单个绝技id（固定绝技），也可以是数组（随机选取）

const EQUIP_TEMPLATES = {
  // ===== 武器 =====
  weapon_metal_1: { name:'金光飞剑', slot:'weapon', attr:'metal', ultPool:['golden_slash','wind_blade'] },
  weapon_wood_1:  { name:'青木法杖', slot:'weapon', attr:'wood',  ultPool:['wood_sword','thorns'] },
  weapon_earth_1: { name:'厚土重锤', slot:'weapon', attr:'earth', ultPool:['earth_slam'] },
  weapon_water_1: { name:'碧水灵剑', slot:'weapon', attr:'water', ultPool:['ice_blast','tidal_wave'] },
  weapon_fire_1:  { name:'赤焰飞剑', slot:'weapon', attr:'fire',  ultPool:['true_fire','lava_burst'] },

  // ===== 头盔 =====
  helmet_metal_1: { name:'金钟法冠', slot:'helmet', attr:'metal', ultPool:['golden_bell','metal_seal'] },
  helmet_wood_1:  { name:'翠灵宝冠', slot:'helmet', attr:'wood',  ultPool:['wood_barrier','poison_mist'] },
  helmet_earth_1: { name:'厚土灵冠', slot:'helmet', attr:'earth', ultPool:['earth_wall'] },
  helmet_water_1: { name:'碧水灵冠', slot:'helmet', attr:'water', ultPool:['ice_shield','frost_slow'] },
  helmet_fire_1:  { name:'赤焰法冠', slot:'helmet', attr:'fire',  ultPool:['flame_shield','fire_weaken'] },

  // ===== 衣服 =====
  armor_metal_1: { name:'金丝道袍', slot:'armor', attr:'metal', ultPool:['golden_armor_heal','golden_bell'] },
  armor_wood_1:  { name:'生机灵衣', slot:'armor', attr:'wood',  ultPool:['life_spring'] },
  armor_earth_1: { name:'厚土战袍', slot:'armor', attr:'earth', ultPool:['earth_nurture','earth_wall'] },
  armor_water_1: { name:'碧水仙衣', slot:'armor', attr:'water', ultPool:['water_heal','ice_shield'] },
  armor_fire_1:  { name:'赤焰道袍', slot:'armor', attr:'fire',  ultPool:['fire_rebirth','flame_shield'] },

  // ===== 披风 =====
  cloak_metal_1: { name:'金风仙披', slot:'cloak', attr:'metal', ultPool:['golden_slash','golden_bell'] },
  cloak_wood_1:  { name:'翠竹仙衣', slot:'cloak', attr:'wood',  ultPool:['wood_sword','life_spring'] },
  cloak_earth_1: { name:'厚土仙披', slot:'cloak', attr:'earth', ultPool:['earth_slam','earth_wall'] },
  cloak_water_1: { name:'碧水仙纱', slot:'cloak', attr:'water', ultPool:['ice_blast','water_heal'] },
  cloak_fire_1:  { name:'赤焰仙披', slot:'cloak', attr:'fire',  ultPool:['true_fire','fire_rebirth'] },

  // ===== 饰品 =====
  trinket_metal_1: { name:'金灵法珠', slot:'trinket', attr:'metal', ultPool:['metal_seal','wind_blade'] },
  trinket_wood_1:  { name:'青木灵佩', slot:'trinket', attr:'wood',  ultPool:['poison_mist','thorns'] },
  trinket_earth_1: { name:'厚土灵佩', slot:'trinket', attr:'earth', ultPool:['quicksand','earth_wall'] },
  trinket_water_1: { name:'碧海灵玉', slot:'trinket', attr:'water', ultPool:['frost_slow','tidal_wave'] },
  trinket_fire_1:  { name:'赤炎灵珠', slot:'trinket', attr:'fire',  ultPool:['fire_weaken','lava_burst'] },
}

// ===== 技能触发规则 =====
const TRIGGER_TYPE = {
  NONE: 0,
  ELIM_COUNT: 1,      // 同属性消除次数累计（当前默认）
}

// ========================================
// ===== 生成函数 =====
// ========================================

/**
 * 为装备生成属性条目
 * 品质决定条数(1/2/3/4/5)，从部位属性池中随机选取
 */
function _genEquipStats(slot, attr, qualityId, level) {
  const q = QUALITY[qualityId]
  const pool = SLOT_STAT_POOL[slot]
  const count = Math.min(q.statSlots, pool.length)
  const resolvedPool = pool.map(k => {
    if (k === 'atkByAttr') return ATK_KEY[attr]
    if (k === 'defByAttr') return DEF_KEY[attr]
    return k
  })
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
 * 根据绝技id和品质生成具体的绝技数据
 */
function _buildUlt(ultId, qualityId, buffDur) {
  const tpl = ULT_LIBRARY[ultId]
  if (!tpl) return { name:'奥义', desc:'强力攻击', attr:'metal', effect:'dmg', dmg:100 }
  const qi = QUALITY_ORDER.indexOf(qualityId)
  const ult = {
    name: tpl.name,
    desc: tpl.desc,
    attr: tpl.attr,
    effect: tpl.effect,
    ultId: tpl.id,
  }
  // 按品质取对应档位数值，带±10%随机浮动
  if (tpl.baseDmg)    ult.dmg    = _randRange(tpl.baseDmg[qi]*0.9, tpl.baseDmg[qi]*1.1)
  if (tpl.baseHeal)   ult.heal   = _randRange(tpl.baseHeal[qi]*0.9, tpl.baseHeal[qi]*1.1)
  if (tpl.baseDef)    ult.def    = _randRange(tpl.baseDef[qi]*0.9, tpl.baseDef[qi]*1.1)
  if (tpl.baseDebuff) ult.debuff = _randRange(tpl.baseDebuff[qi]*0.9, tpl.baseDebuff[qi]*1.1)
  ult.buffDur = buffDur
  return ult
}

/**
 * 生成一件装备
 * @param {string} slot - 部位 (weapon/helmet/armor/cloak/trinket)
 * @param {string} attr - 五行属性 (metal/wood/earth/water/fire)
 * @param {string} qualityId - 品质 (white/green/blue/purple/orange)
 * @param {number} level - 等级 (1-30)
 * @param {string} [forcedUltId] - 可选，强制指定绝技id
 */
function generateEquipment(slot, attr, qualityId, level, forcedUltId) {
  const q = QUALITY[qualityId]
  const lv = Math.max(1, Math.min(MAX_LEVEL, level || 1))

  // 查找匹配的装备模板
  const templateKey = Object.keys(EQUIP_TEMPLATES).find(k => {
    const t = EQUIP_TEMPLATES[k]
    return t.slot === slot && t.attr === attr
  })
  const template = templateKey ? EQUIP_TEMPLATES[templateKey] : null
  const name = template ? template.name : `${ATTR_NAME[attr]}${EQUIP_SLOT[slot]?.name||''}`

  // 属性加成
  const stats = _genEquipStats(slot, attr, qualityId, lv)

  // 绝技：优先强制指定 > 从模板池随机 > 按部位默认
  let ultId = forcedUltId
  if (!ultId && template && template.ultPool && template.ultPool.length > 0) {
    ultId = template.ultPool[Math.floor(Math.random() * template.ultPool.length)]
  }
  if (!ultId) {
    // 兜底：按部位和属性选一个默认绝技
    const fallbackMap = {
      weapon: { metal:'golden_slash', wood:'wood_sword', earth:'earth_slam', water:'ice_blast', fire:'true_fire' },
      helmet: { metal:'golden_bell', wood:'wood_barrier', earth:'earth_wall', water:'ice_shield', fire:'flame_shield' },
      armor:  { metal:'golden_armor_heal', wood:'life_spring', earth:'earth_nurture', water:'water_heal', fire:'fire_rebirth' },
      cloak:  { metal:'golden_slash', wood:'wood_sword', earth:'earth_slam', water:'ice_blast', fire:'true_fire' },
      trinket:{ metal:'metal_seal', wood:'poison_mist', earth:'quicksand', water:'frost_slow', fire:'fire_weaken' },
    }
    ultId = fallbackMap[slot]?.[attr] || 'golden_slash'
  }

  const ult = _buildUlt(ultId, qualityId, q.buffDur)

  return {
    uid: _uid(),
    slot,
    attr,
    quality: qualityId,
    level: lv,
    name,
    stats,
    ult,
    ultTrigger: q.triggerCount,
  }
}

/**
 * 随机品质（按权重）
 */
function randomQuality(tier) {
  const weights = {
    low:  [50, 35, 15],
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
 * @param {number} stageIndex - 关卡层数(1-10)
 */
function randomDrop(tier, stageIndex) {
  // 槽位掉落权重
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
    minLv = Math.max(1, si)
    maxLv = Math.min(MAX_LEVEL, si * 2 + 3)
  } else if (tier === 'mid') {
    minLv = Math.max(1, si - 1)
    maxLv = Math.min(MAX_LEVEL, si * 2)
  } else {
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
  ULT_LIBRARY, EQUIP_TEMPLATES,
  generateEquipment, randomQuality, randomDrop,
}
