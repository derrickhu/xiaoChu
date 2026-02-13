/**
 * 装备系统数据定义
 * 6类装备 × 6属性 = 36种基础装备
 * 4个品质等级：普通(N)/稀有(R)/史诗(SR)/传说(SSR)
 */

// 品质定义
const QUALITY = {
  N:   { id:'N',   name:'普通', color:'#b0b0b0', glow:'rgba(176,176,176,0.3)', triggerCount:3, ultMulti:3, passiveRange:[100,200] },
  R:   { id:'R',   name:'稀有', color:'#4a9eff', glow:'rgba(74,158,255,0.4)',  triggerCount:3, ultMulti:3.5, passiveRange:[200,350] },
  SR:  { id:'SR',  name:'史诗', color:'#b44aff', glow:'rgba(180,74,255,0.5)',  triggerCount:4, ultMulti:4, passiveRange:[350,550] },
  SSR: { id:'SSR', name:'传说', color:'#ff8c00', glow:'rgba(255,140,0,0.6)',   triggerCount:5, ultMulti:5, passiveRange:[500,800] },
}

// 装备类别
const EQUIP_SLOT = {
  weapon:  { id:'weapon',  name:'武器', icon:'⚔️',  desc:'核心输出载体' },
  armor:   { id:'armor',   name:'铠甲', icon:'🛡️',  desc:'核心防御载体' },
  boots:   { id:'boots',   name:'战靴', icon:'👢',  desc:'提升闪避/速度' },
  cloak:   { id:'cloak',   name:'披风', icon:'🧣',  desc:'伤害减免/暴击' },
  helmet:  { id:'helmet',  name:'头盔', icon:'⛑️',  desc:'提升HP/防御' },
  trinket: { id:'trinket', name:'饰品', icon:'💎',  desc:'增益/减益辅助' },
}

// 属性定义（复用原有）
const ATTRS = ['fire','water','wood','light','dark','heart']
const ATTR_NAME = { fire:'火', water:'水', wood:'木', light:'光', dark:'暗', heart:'心' }
const ATTR_COLOR = {
  fire:  { main:'#ff4d4d', bg:'#3a1515', lt:'#ff8080', dk:'#cc2020' },
  water: { main:'#4dabff', bg:'#152535', lt:'#80ccff', dk:'#2080cc' },
  wood:  { main:'#4dcc4d', bg:'#153515', lt:'#80ff80', dk:'#20a020' },
  light: { main:'#ffd700', bg:'#353520', lt:'#ffed80', dk:'#cca800' },
  dark:  { main:'#b366ff', bg:'#251535', lt:'#cc99ff', dk:'#8030cc' },
  heart: { main:'#ff69b4', bg:'#351525', lt:'#ff99cc', dk:'#cc3080' },
}

// 克制关系
const COUNTER_MAP = { fire:'wood', wood:'water', water:'fire', light:'dark', dark:'light' }

// ===== 普通技能模板池 =====
const SKILL_TEMPLATES = {
  weapon: {
    fire:  [{name:'烈焰斩', desc:'对敌方造成{dmg}点火属性伤害', baseDmg:[100,150,200,280]}],
    water: [{name:'寒冰刺', desc:'对敌方造成{dmg}点水属性伤害', baseDmg:[100,150,200,280]}],
    wood:  [{name:'荆棘击', desc:'对敌方造成{dmg}点木属性伤害', baseDmg:[100,150,200,280]}],
    light: [{name:'圣光斩', desc:'对敌方造成{dmg}点光属性伤害', baseDmg:[100,150,200,280]}],
    dark:  [{name:'暗影劈', desc:'对敌方造成{dmg}点暗属性伤害', baseDmg:[100,150,200,280]}],
    heart: [{name:'治愈之刃', desc:'恢复主角{heal}点HP', baseHeal:[80,120,160,220]}],
  },
  armor: {
    fire:  [{name:'火焰护盾', desc:'减少受到{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    water: [{name:'水流屏障', desc:'减少受到{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    wood:  [{name:'藤蔓壁垒', desc:'减少受到{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    light: [{name:'光之庇护', desc:'减少受到{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    dark:  [{name:'暗夜斗篷', desc:'减少受到{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    heart: [{name:'生命之甲', desc:'恢复主角{heal}点HP', baseHeal:[60,100,140,200]}],
  },
  boots: {
    fire:  [{name:'火焰冲刺', desc:'造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    water: [{name:'水流步', desc:'造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    wood:  [{name:'疾风步', desc:'造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    light: [{name:'闪光步', desc:'造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    dark:  [{name:'暗步', desc:'造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    heart: [{name:'轻盈步', desc:'恢复主角{heal}点HP', baseHeal:[50,80,110,160]}],
  },
  cloak: {
    fire:  [{name:'烈焰斗篷', desc:'造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    water: [{name:'海潮披风', desc:'造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    wood:  [{name:'林风披肩', desc:'造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    light: [{name:'圣光披风', desc:'造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    dark:  [{name:'暗影斗篷', desc:'造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    heart: [{name:'慈悲披风', desc:'恢复主角{heal}点HP', baseHeal:[60,90,130,180]}],
  },
  helmet: {
    fire:  [{name:'炎盔聚气', desc:'提升{hp}点最大HP,持续3回合', baseHp:[100,160,240,350]}],
    water: [{name:'水晶头盔', desc:'提升{hp}点最大HP,持续3回合', baseHp:[100,160,240,350]}],
    wood:  [{name:'翠叶战盔', desc:'提升{hp}点最大HP,持续3回合', baseHp:[100,160,240,350]}],
    light: [{name:'光辉战盔', desc:'提升{hp}点最大HP,持续3回合', baseHp:[100,160,240,350]}],
    dark:  [{name:'暗夜头盔', desc:'提升{hp}点最大HP,持续3回合', baseHp:[100,160,240,350]}],
    heart: [{name:'守护之盔', desc:'恢复主角{heal}点HP', baseHeal:[70,110,150,220]}],
  },
  trinket: {
    fire:  [{name:'火焰宝石', desc:'降低敌方ATK{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    water: [{name:'海蓝水晶', desc:'降低敌方ATK{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    wood:  [{name:'翠绿头饰', desc:'降低敌方ATK{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    light: [{name:'光辉戒指', desc:'降低敌方ATK{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    dark:  [{name:'暗影吊坠', desc:'降低敌方ATK{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    heart: [{name:'心之徽章', desc:'恢复主角{heal}点HP并清除1个debuff', baseHeal:[50,80,120,170]}],
  },
}

// ===== 被动技能模板池 =====
const PASSIVE_TYPES = [
  { id:'hpUp',       name:'生命强化', desc:'提升主角HP {val}点',       field:'hp' },
  { id:'atkUp',      name:'攻击强化', desc:'提升主角ATK {val}点',      field:'atk' },
  { id:'defUp',      name:'防御强化', desc:'提升主角防御 {val}点',     field:'def' },
  { id:'cdDown',     name:'加速蓄力', desc:'对应属性技能累计次数-{val}', field:'cd' },
]

// ===== 装备模板（每个类别×属性 = 1种基础装备名） =====
const EQUIP_NAMES = {
  weapon:  { fire:'火焰长剑', water:'流水匕首', wood:'青木法杖', light:'光辉权杖', dark:'暗影短刃', heart:'心之长剑' },
  armor:   { fire:'火焰重甲', water:'流水轻甲', wood:'青木铠甲', light:'光辉战甲', dark:'暗影重甲', heart:'心之护甲' },
  boots:   { fire:'火焰战靴', water:'流水长靴', wood:'青木短靴', light:'光辉战靴', dark:'暗影靴',   heart:'心之靴' },
  cloak:   { fire:'火焰披风', water:'流水斗篷', wood:'青木披肩', light:'光辉披风', dark:'暗影斗篷', heart:'心之披风' },
  helmet:  { fire:'火焰头盔', water:'流水战盔', wood:'青木头盔', light:'光辉战盔', dark:'暗影头盔', heart:'心之头盔' },
  trinket: { fire:'火焰项链', water:'海蓝手环', wood:'翠绿头饰', light:'光辉戒指', dark:'暗影吊坠', heart:'心之徽章' },
}

/**
 * 随机生成一件装备
 * @param {string} slot - 装备类别 weapon/armor/...
 * @param {string} attr - 属性 fire/water/...
 * @param {string} qualityId - 品质 N/R/SR/SSR
 * @returns {object} 完整装备对象
 */
function generateEquipment(slot, attr, qualityId) {
  const q = QUALITY[qualityId]
  const qi = ['N','R','SR','SSR'].indexOf(qualityId)
  const name = EQUIP_NAMES[slot][attr]

  // 普通技能
  const skillTpl = SKILL_TEMPLATES[slot][attr][0]
  const skill = { name: skillTpl.name, desc: skillTpl.desc, attr }
  if (skillTpl.baseDmg)    skill.dmg  = _randRange(skillTpl.baseDmg[qi]*0.9, skillTpl.baseDmg[qi]*1.1)
  if (skillTpl.baseHeal)   skill.heal = _randRange(skillTpl.baseHeal[qi]*0.9, skillTpl.baseHeal[qi]*1.1)
  if (skillTpl.baseDef)    skill.def  = _randRange(skillTpl.baseDef[qi]*0.9, skillTpl.baseDef[qi]*1.1)
  if (skillTpl.baseHp)     skill.hp   = _randRange(skillTpl.baseHp[qi]*0.9, skillTpl.baseHp[qi]*1.1)
  if (skillTpl.baseDebuff) skill.debuff = _randRange(skillTpl.baseDebuff[qi]*0.9, skillTpl.baseDebuff[qi]*1.1)

  // 绝技（普通技能 × 倍率）
  const ultMulti = q.ultMulti + (Math.random()-0.5)*0.4
  const ult = { name: '极·'+skillTpl.name, desc: '(绝技)'+skillTpl.desc.replace(/{(\w+)}/g,'强化'), attr, multi: ultMulti }
  if (skill.dmg)    ult.dmg  = Math.round(skill.dmg * ultMulti)
  if (skill.heal)   ult.heal = Math.round(skill.heal * ultMulti)
  if (skill.def)    ult.def  = Math.round(skill.def * ultMulti)
  if (skill.hp)     ult.hp   = Math.round(skill.hp * ultMulti)
  if (skill.debuff) ult.debuff = Math.round(skill.debuff * ultMulti)

  // 被动技能（随机2个不同类型）
  const shuffled = PASSIVE_TYPES.slice().sort(()=>Math.random()-0.5)
  const passives = shuffled.slice(0,2).map(pt => {
    const val = pt.field==='cd' 
      ? (qi>=2 ? 2 : 1)
      : _randRange(q.passiveRange[0], q.passiveRange[1])
    return { id:pt.id, name:pt.name, desc:pt.desc.replace('{val}',val), val, field:pt.field }
  })

  return {
    uid: _uid(),
    slot,
    attr,
    quality: qualityId,
    name,
    skill,
    ult,
    ultTrigger: q.triggerCount,
    passives,
  }
}

/**
 * 随机品质（按权重）
 * @param {string} tier - 'low'|'mid'|'high' 掉落档次
 */
function randomQuality(tier) {
  const weights = {
    low:  [60, 30, 8, 2],   // 普通关
    mid:  [30, 40, 22, 8],  // 困难关
    high: [10, 25, 40, 25], // 极难关
  }
  const w = weights[tier] || weights.low
  const r = Math.random()*100
  let sum = 0
  const qs = ['N','R','SR','SSR']
  for (let i=0; i<4; i++) { sum += w[i]; if (r < sum) return qs[i] }
  return 'N'
}

/**
 * 随机生成掉落装备
 */
function randomDrop(tier) {
  const slots = Object.keys(EQUIP_SLOT)
  const slot = slots[Math.floor(Math.random()*slots.length)]
  const attr = ATTRS[Math.floor(Math.random()*ATTRS.length)]
  const quality = randomQuality(tier)
  return generateEquipment(slot, attr, quality)
}

// 工具函数
function _randRange(min, max) { return Math.round(min + Math.random()*(max-min)) }
function _uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,8) }

module.exports = {
  QUALITY, EQUIP_SLOT, ATTRS, ATTR_NAME, ATTR_COLOR, COUNTER_MAP,
  SKILL_TEMPLATES, PASSIVE_TYPES, EQUIP_NAMES,
  generateEquipment, randomQuality, randomDrop,
}
