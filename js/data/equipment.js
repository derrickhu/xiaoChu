/**
 * 法宝系统数据定义
 * 6类法宝 × 6灵根 = 36种基础法宝
 * 4个品质等级：凡品(N)/灵品(R)/仙品(SR)/神品(SSR)
 */

// 品质定义
const QUALITY = {
  N:   { id:'N',   name:'凡品', color:'#b0b0b0', glow:'rgba(176,176,176,0.3)', triggerCount:3, ultMulti:3, passiveRange:[100,200] },
  R:   { id:'R',   name:'灵品', color:'#4a9eff', glow:'rgba(74,158,255,0.4)',  triggerCount:3, ultMulti:3.5, passiveRange:[200,350] },
  SR:  { id:'SR',  name:'仙品', color:'#b44aff', glow:'rgba(180,74,255,0.5)',  triggerCount:4, ultMulti:4, passiveRange:[350,550] },
  SSR: { id:'SSR', name:'神品', color:'#ff8c00', glow:'rgba(255,140,0,0.6)',   triggerCount:5, ultMulti:5, passiveRange:[500,800] },
}

// 法宝类别（仙侠法宝）
const EQUIP_SLOT = {
  weapon:  { id:'weapon',  name:'法剑', icon:'⚔️',  desc:'斩妖除魔之器' },
  armor:   { id:'armor',   name:'道袍', icon:'🛡️',  desc:'护体灵衣' },
  boots:   { id:'boots',   name:'步云靴', icon:'👢',  desc:'御风踏云之履' },
  cloak:   { id:'cloak',   name:'仙披', icon:'🧣',  desc:'聚灵护体之纱' },
  helmet:  { id:'helmet',  name:'发冠', icon:'⛑️',  desc:'凝神固本之冠' },
  trinket: { id:'trinket', name:'灵佩', icon:'💎',  desc:'蕴灵增益之饰' },
}

// 灵根属性定义
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

// ===== 普通技能模板池（仙侠风格） =====
const SKILL_TEMPLATES = {
  weapon: {
    fire:  [{name:'三昧真火剑', desc:'以真火之力斩出{dmg}点火灵伤害', baseDmg:[100,150,200,280]}],
    water: [{name:'寒冰诀', desc:'凝聚寒冰之力造成{dmg}点水灵伤害', baseDmg:[100,150,200,280]}],
    wood:  [{name:'青木剑气', desc:'木灵剑气横扫造成{dmg}点伤害', baseDmg:[100,150,200,280]}],
    light: [{name:'天罡剑意', desc:'天罡正气造成{dmg}点光灵伤害', baseDmg:[100,150,200,280]}],
    dark:  [{name:'幽冥一击', desc:'幽冥之力侵蚀造成{dmg}点暗灵伤害', baseDmg:[100,150,200,280]}],
    heart: [{name:'回春诀', desc:'运转心法恢复{heal}点气血', baseHeal:[80,120,160,220]}],
  },
  armor: {
    fire:  [{name:'火灵护体', desc:'凝聚火灵护罩减少{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    water: [{name:'水遁护身', desc:'水灵结界减少{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    wood:  [{name:'藤甲术', desc:'木灵藤甲减少{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    light: [{name:'金光护体', desc:'金光大阵减少{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    dark:  [{name:'玄阴护体', desc:'玄阴之气减少{def}点伤害,持续2回合', baseDef:[50,80,120,180]}],
    heart: [{name:'天蚕宝衣', desc:'灵力回转恢复{heal}点气血', baseHeal:[60,100,140,200]}],
  },
  boots: {
    fire:  [{name:'踏火步', desc:'踏火而行造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    water: [{name:'凌波微步', desc:'踏水而行造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    wood:  [{name:'御风步', desc:'御风而行造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    light: [{name:'金光纵', desc:'金光遁术造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    dark:  [{name:'暗影遁', desc:'暗影遁术造成{dmg}伤害并提升闪避10%', baseDmg:[60,100,140,200]}],
    heart: [{name:'逍遥步', desc:'逍遥身法恢复{heal}点气血', baseHeal:[50,80,110,160]}],
  },
  cloak: {
    fire:  [{name:'赤焰仙披', desc:'赤焰灵力造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    water: [{name:'碧水仙纱', desc:'碧水灵力造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    wood:  [{name:'翠竹仙衣', desc:'翠竹灵力造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    light: [{name:'天光仙披', desc:'天光灵力造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    dark:  [{name:'幽冥斗篷', desc:'幽冥灵力造成{dmg}伤害并提升暴击5%', baseDmg:[70,110,150,210]}],
    heart: [{name:'慈悲仙纱', desc:'慈悲心法恢复{heal}点气血', baseHeal:[60,90,130,180]}],
  },
  helmet: {
    fire:  [{name:'炎灵聚顶', desc:'炎灵聚顶提升{hp}点气血上限,持续3回合', baseHp:[100,160,240,350]}],
    water: [{name:'冰晶发冠', desc:'冰晶凝神提升{hp}点气血上限,持续3回合', baseHp:[100,160,240,350]}],
    wood:  [{name:'翠灵宝冠', desc:'翠灵固本提升{hp}点气血上限,持续3回合', baseHp:[100,160,240,350]}],
    light: [{name:'天辉法冠', desc:'天辉照顶提升{hp}点气血上限,持续3回合', baseHp:[100,160,240,350]}],
    dark:  [{name:'幽冥宝冠', desc:'幽冥凝神提升{hp}点气血上限,持续3回合', baseHp:[100,160,240,350]}],
    heart: [{name:'紫金法冠', desc:'法冠灵力恢复{heal}点气血', baseHeal:[70,110,150,220]}],
  },
  trinket: {
    fire:  [{name:'赤炎灵珠', desc:'火灵侵蚀降低妖物攻击{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    water: [{name:'碧海灵玉', desc:'水灵封印降低妖物攻击{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    wood:  [{name:'青木灵佩', desc:'木灵缠缚降低妖物攻击{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    light: [{name:'天罡令牌', desc:'天罡之力降低妖物攻击{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    dark:  [{name:'幽冥玉坠', desc:'幽冥之力降低妖物攻击{debuff}点,持续2回合', baseDebuff:[30,50,80,120]}],
    heart: [{name:'养心玉佩', desc:'灵玉之力恢复{heal}点气血并清除1个负面状态', baseHeal:[50,80,120,170]}],
  },
}

// ===== 被动技能模板池 =====
const PASSIVE_TYPES = [
  { id:'hpUp',       name:'固本培元', desc:'提升修士气血 {val}点',       field:'hp' },
  { id:'atkUp',      name:'灵力增幅', desc:'提升修士攻击 {val}点',      field:'atk' },
  { id:'defUp',      name:'金刚不坏', desc:'提升修士防御 {val}点',     field:'def' },
  { id:'cdDown',     name:'灵台清明', desc:'对应灵根技能蓄力次数-{val}', field:'cd' },
]

// ===== 法宝模板（每个类别×灵根 = 1种基础法宝名） =====
const EQUIP_NAMES = {
  weapon:  { fire:'赤焰飞剑', water:'碧水灵剑', wood:'青木法杖', light:'天罡宝剑', dark:'幽冥魔剑', heart:'慈航仙剑' },
  armor:   { fire:'赤焰道袍', water:'碧水仙衣', wood:'青木灵衣', light:'天罡战袍', dark:'幽冥玄袍', heart:'慈航道袍' },
  boots:   { fire:'踏火云靴', water:'凌波仙靴', wood:'御风灵靴', light:'天罡步云', dark:'幽冥暗靴', heart:'逍遥仙靴' },
  cloak:   { fire:'赤焰仙披', water:'碧水仙纱', wood:'翠竹仙衣', light:'天光仙披', dark:'幽冥斗篷', heart:'慈悲仙纱' },
  helmet:  { fire:'赤焰法冠', water:'碧水灵冠', wood:'翠灵宝冠', light:'天辉法冠', dark:'幽冥宝冠', heart:'紫金法冠' },
  trinket: { fire:'赤炎灵珠', water:'碧海灵玉', wood:'青木灵佩', light:'天罡令牌', dark:'幽冥玉坠', heart:'养心玉佩' },
}

/**
 * 随机生成一件法宝
 * @param {string} slot - 法宝类别 weapon/armor/...
 * @param {string} attr - 灵根 fire/water/...
 * @param {string} qualityId - 品质 N/R/SR/SSR
 * @returns {object} 完整法宝对象
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

  // 仙技（普通技能 × 倍率）
  const ultMulti = q.ultMulti + (Math.random()-0.5)*0.4
  const ult = { name: '天·'+skillTpl.name, desc: '(仙技)'+skillTpl.desc.replace(/{(\w+)}/g,'强化'), attr, multi: ultMulti }
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
 * 随机生成掉落法宝
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
