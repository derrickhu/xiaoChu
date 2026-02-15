/**
 * 装备系统数据定义（五行攻防版·重构）
 * 
 * 五行属性：金(metal) / 木(wood) / 土(earth) / 水(water) / 火(fire)
 * 克制关系：金→木→土→水→火→金（克制×1.5，被克×0.6）
 * 
 * 装备部位：法冠 / 道袍 / 灵披 / 法珠 / 法剑（共5个）
 * 品质等级：白品·凡器 / 绿品·灵器 / 蓝品·宝器 / 紫品·仙器 / 橙品·神器
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
  white:  { id:'white',  name:'凡器', color:'#b0b0b0', glow:'rgba(176,176,176,0.3)', statSlots:1, triggerCount:3,  buffDur:1 },
  green:  { id:'green',  name:'灵器', color:'#4dcc4d', glow:'rgba(77,204,77,0.4)',   statSlots:2, triggerCount:4,  buffDur:1 },
  blue:   { id:'blue',   name:'宝器', color:'#4a9eff', glow:'rgba(74,158,255,0.5)',  statSlots:3, triggerCount:5,  buffDur:2 },
  purple: { id:'purple', name:'仙器', color:'#b44aff', glow:'rgba(180,74,255,0.6)',  statSlots:4, triggerCount:7,  buffDur:2 },
  orange: { id:'orange', name:'神器', color:'#ff8c00', glow:'rgba(255,140,0,0.7)',   statSlots:5, triggerCount:10, buffDur:3 },
}
const QUALITY_ORDER = ['white','green','blue','purple','orange']

// ===== 装备部位 =====
const EQUIP_SLOT = {
  helmet:  { id:'helmet',  name:'法冠', icon:'⛑️',  desc:'凝神固本之冠' },
  armor:   { id:'armor',   name:'道袍', icon:'🛡️',  desc:'护体续命之衣' },
  cloak:   { id:'cloak',   name:'灵披', icon:'🧣',  desc:'御风增法之披' },
  trinket: { id:'trinket', name:'法珠', icon:'💎',  desc:'破障封魔之宝' },
  weapon:  { id:'weapon',  name:'法剑', icon:'⚔️',  desc:'斩妖除魔之刃' },
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
  armor:   ['stamina','defByAttr','recovery'],  // recovery仅道袍
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

// 绝技数值说明（属性百分比系统）：
// - dmgPct: 伤害 = 人物对应五行攻击力 × dmgPct%  (如250 = 2.5倍攻击力)
// - healPct: 回复 = 人物回复值 × healPct%  (如300 = 3倍回复值)
// - defPct: 护盾 = 人物气力(血量) × defPct%  (如25 = 25%血量)
// - debuffPct: 减益 = 人物对应五行攻击力 × debuffPct%  (如60 = 0.6倍攻击力降攻)

const ULT_LIBRARY = {
  // ===== 伤害类绝技 =====
  golden_slash: {
    id: 'golden_slash', name: '金光斩', attr: 'metal',
    desc: '金灵之力造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [200, 280, 380, 500, 700],
  },
  wood_sword: {
    id: 'wood_sword', name: '青木剑气', attr: 'wood',
    desc: '木灵剑气造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [200, 280, 380, 500, 700],
  },
  earth_slam: {
    id: 'earth_slam', name: '裂地击', attr: 'earth',
    desc: '土灵之力造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [200, 280, 380, 500, 700],
  },
  ice_blast: {
    id: 'ice_blast', name: '寒冰诀', attr: 'water',
    desc: '水灵之力造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [200, 280, 380, 500, 700],
  },
  true_fire: {
    id: 'true_fire', name: '三昧真火', attr: 'fire',
    desc: '火灵之力造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [240, 320, 440, 580, 800],
  },
  wind_blade: {
    id: 'wind_blade', name: '疾风斩', attr: 'metal',
    desc: '高速金风造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [180, 250, 340, 460, 650],
  },
  thorns: {
    id: 'thorns', name: '荆棘缠绕', attr: 'wood',
    desc: '木灵荆棘造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [180, 250, 340, 460, 650],
  },
  lava_burst: {
    id: 'lava_burst', name: '熔岩爆发', attr: 'fire',
    desc: '烈焰喷发造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [220, 300, 400, 540, 750],
  },
  tidal_wave: {
    id: 'tidal_wave', name: '潮汐之力', attr: 'water',
    desc: '汹涌水灵造成{dmg}点伤害（{pct}%攻击力）',
    effect: 'dmg', baseDmgPct: [200, 280, 380, 500, 700],
  },

  // ===== 回复类绝技 =====
  golden_armor_heal: {
    id: 'golden_armor_heal', name: '金丝回元', attr: 'metal',
    desc: '金灵护体回复{heal}点气血（{pct}%回复力）',
    effect: 'heal', baseHealPct: [250, 350, 500, 700, 1000],
  },
  life_spring: {
    id: 'life_spring', name: '生机涌泉', attr: 'wood',
    desc: '木灵生机回复{heal}点气血（{pct}%回复力）',
    effect: 'heal', baseHealPct: [300, 420, 600, 850, 1200],
  },
  earth_nurture: {
    id: 'earth_nurture', name: '厚土培元', attr: 'earth',
    desc: '土灵滋养回复{heal}点气血（{pct}%回复力）',
    effect: 'heal', baseHealPct: [250, 350, 500, 700, 1000],
  },
  water_heal: {
    id: 'water_heal', name: '碧水仙诀', attr: 'water',
    desc: '水灵治愈回复{heal}点气血（{pct}%回复力）',
    effect: 'heal', baseHealPct: [280, 400, 560, 780, 1100],
  },
  fire_rebirth: {
    id: 'fire_rebirth', name: '浴火重生', attr: 'fire',
    desc: '火灵焚烧后回复{heal}点气血（{pct}%回复力）',
    effect: 'heal', baseHealPct: [200, 300, 420, 600, 880],
  },

  // ===== 护盾类绝技 =====
  golden_bell: {
    id: 'golden_bell', name: '金钟罩', attr: 'metal',
    desc: '金灵护体获得{def}点护盾,持续{dur}回合（{pct}%气力）',
    effect: 'def', baseDefPct: [15, 25, 38, 55, 80],
  },
  earth_wall: {
    id: 'earth_wall', name: '厚土壁垒', attr: 'earth',
    desc: '厚土之力获得{def}点护盾,持续{dur}回合（{pct}%气力）',
    effect: 'def', baseDefPct: [18, 30, 45, 65, 95],
  },
  ice_shield: {
    id: 'ice_shield', name: '冰晶护体', attr: 'water',
    desc: '冰灵结晶获得{def}点护盾,持续{dur}回合（{pct}%气力）',
    effect: 'def', baseDefPct: [15, 25, 38, 55, 80],
  },
  wood_barrier: {
    id: 'wood_barrier', name: '翠灵结界', attr: 'wood',
    desc: '木灵结界获得{def}点护盾,持续{dur}回合（{pct}%气力）',
    effect: 'def', baseDefPct: [12, 20, 32, 48, 70],
  },
  flame_shield: {
    id: 'flame_shield', name: '炎灵护壁', attr: 'fire',
    desc: '火灵结界获得{def}点护盾,持续{dur}回合（{pct}%气力）',
    effect: 'def', baseDefPct: [12, 20, 30, 45, 65],
  },

  // ===== 减益类绝技 =====
  metal_seal: {
    id: 'metal_seal', name: '金灵封印', attr: 'metal',
    desc: '封印敌方降低攻击{debuff}点,持续{dur}回合（{pct}%攻击力）',
    effect: 'debuff', baseDebuffPct: [40, 60, 85, 120, 170],
  },
  poison_mist: {
    id: 'poison_mist', name: '毒雾弥漫', attr: 'wood',
    desc: '毒灵弥漫降低敌方攻击{debuff}点,持续{dur}回合（{pct}%攻击力）',
    effect: 'debuff', baseDebuffPct: [50, 70, 100, 140, 200],
  },
  quicksand: {
    id: 'quicksand', name: '流沙陷阱', attr: 'earth',
    desc: '流沙困敌降低攻击{debuff}点,持续{dur}回合（{pct}%攻击力）',
    effect: 'debuff', baseDebuffPct: [40, 60, 85, 120, 170],
  },
  frost_slow: {
    id: 'frost_slow', name: '霜寒减速', attr: 'water',
    desc: '寒冰侵袭降低敌方攻击{debuff}点,持续{dur}回合（{pct}%攻击力）',
    effect: 'debuff', baseDebuffPct: [40, 60, 85, 120, 170],
  },
  fire_weaken: {
    id: 'fire_weaken', name: '灼热削弱', attr: 'fire',
    desc: '灼热降低敌方攻击{debuff}点,持续{dur}回合（{pct}%攻击力）',
    effect: 'debuff', baseDebuffPct: [35, 55, 78, 110, 155],
  },
}

// ========================================
// ===== 装备模板库 =====
// ========================================
// 每个装备模板定义：名称、部位、五行属性、可选绝技池(ultPool)
// 生成时从 ultPool 中随机选取一个绝技
// ultPool 可以是单个绝技id（固定绝技），也可以是数组（随机选取）

const EQUIP_TEMPLATES = {
  // ===== 武器（凡器级：朴素命名） =====
  weapon_metal_1: { name:'铁剑', slot:'weapon', attr:'metal', ultPool:['golden_slash','wind_blade'] },
  weapon_wood_1:  { name:'青竹杖', slot:'weapon', attr:'wood',  ultPool:['wood_sword','thorns'] },
  weapon_earth_1: { name:'石锤', slot:'weapon', attr:'earth', ultPool:['earth_slam'] },
  weapon_water_1: { name:'流水剑', slot:'weapon', attr:'water', ultPool:['ice_blast','tidal_wave'] },
  weapon_fire_1:  { name:'赤铜刀', slot:'weapon', attr:'fire',  ultPool:['true_fire','lava_burst'] },

  // ===== 法冠（凡器级） =====
  helmet_metal_1: { name:'铜箍冠', slot:'helmet', attr:'metal', ultPool:['golden_bell','metal_seal'] },
  helmet_wood_1:  { name:'藤编帽', slot:'helmet', attr:'wood',  ultPool:['wood_barrier','poison_mist'] },
  helmet_earth_1: { name:'黄泥冠', slot:'helmet', attr:'earth', ultPool:['earth_wall'] },
  helmet_water_1: { name:'蓝绸巾', slot:'helmet', attr:'water', ultPool:['ice_shield','frost_slow'] },
  helmet_fire_1:  { name:'火纹冠', slot:'helmet', attr:'fire',  ultPool:['flame_shield','fire_weaken'] },

  // ===== 道袍（凡器级） =====
  armor_metal_1: { name:'粗布道衣', slot:'armor', attr:'metal', ultPool:['golden_armor_heal','golden_bell'] },
  armor_wood_1:  { name:'草编衣', slot:'armor', attr:'wood',  ultPool:['life_spring'] },
  armor_earth_1: { name:'土黄短褂', slot:'armor', attr:'earth', ultPool:['earth_nurture','earth_wall'] },
  armor_water_1: { name:'青衫', slot:'armor', attr:'water', ultPool:['water_heal','ice_shield'] },
  armor_fire_1:  { name:'赤练衣', slot:'armor', attr:'fire',  ultPool:['fire_rebirth','flame_shield'] },

  // ===== 灵披（凡器级） =====
  cloak_metal_1: { name:'旧棉披', slot:'cloak', attr:'metal', ultPool:['golden_slash','golden_bell'] },
  cloak_wood_1:  { name:'竹叶披', slot:'cloak', attr:'wood',  ultPool:['wood_sword','life_spring'] },
  cloak_earth_1: { name:'泥纹斗篷', slot:'cloak', attr:'earth', ultPool:['earth_slam','earth_wall'] },
  cloak_water_1: { name:'水纹纱', slot:'cloak', attr:'water', ultPool:['ice_blast','water_heal'] },
  cloak_fire_1:  { name:'火尾披', slot:'cloak', attr:'fire',  ultPool:['true_fire','fire_rebirth'] },

  // ===== 法珠（凡器级） =====
  trinket_metal_1: { name:'铜珠', slot:'trinket', attr:'metal', ultPool:['metal_seal','wind_blade'] },
  trinket_wood_1:  { name:'木灵珠', slot:'trinket', attr:'wood',  ultPool:['poison_mist','thorns'] },
  trinket_earth_1: { name:'泥丸', slot:'trinket', attr:'earth', ultPool:['quicksand','earth_wall'] },
  trinket_water_1: { name:'水滴石', slot:'trinket', attr:'water', ultPool:['frost_slow','tidal_wave'] },
  trinket_fire_1:  { name:'火晶珠', slot:'trinket', attr:'fire',  ultPool:['fire_weaken','lava_burst'] },
}

// ========================================
// ===== 精英专属绝技库 =====
// ========================================
// 精英专属绝技比普通绝技数值更高，且拥有独特效果

const ELITE_ULT_LIBRARY = {
  // --- 小精英专属绝技（单件装备附带，百分比更高） ---
  elite_metal_blade: {
    id:'elite_metal_blade', name:'破军金刃', attr:'metal',
    desc:'精英之力造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[280,400,550,750,1050],
    exclusive:true,
  },
  elite_wood_life: {
    id:'elite_wood_life', name:'万木回春', attr:'wood',
    desc:'精英灵力回复{heal}点气血（{pct}%回复力）',
    effect:'heal', baseHealPct:[400,560,800,1100,1600],
    exclusive:true,
  },
  elite_earth_fortress: {
    id:'elite_earth_fortress', name:'磐石金身', attr:'earth',
    desc:'厚土精英之力获得{def}点护盾,持续{dur}回合（{pct}%气力）',
    effect:'def', baseDefPct:[25,40,60,90,130],
    exclusive:true,
  },
  elite_water_torrent: {
    id:'elite_water_torrent', name:'怒涛灭世', attr:'water',
    desc:'精英水灵造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[270,380,530,720,1000],
    exclusive:true,
  },
  elite_fire_annihilation: {
    id:'elite_fire_annihilation', name:'天火焚城', attr:'fire',
    desc:'精英火灵造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[300,420,580,800,1100],
    exclusive:true,
  },
  // --- 大精英套装绝技（套装装备可能附带，百分比最高） ---
  boss_metal_storm: {
    id:'boss_metal_storm', name:'太白剑雨', attr:'metal',
    desc:'剑气风暴造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[360,500,700,950,1350],
    exclusive:true,
  },
  boss_wood_domain: {
    id:'boss_wood_domain', name:'万木归元', attr:'wood',
    desc:'仙庭灵力回复{heal}点气血（{pct}%回复力）',
    effect:'heal', baseHealPct:[500,700,1000,1400,2000],
    exclusive:true,
  },
  boss_earth_titan: {
    id:'boss_earth_titan', name:'昆仑压顶', attr:'earth',
    desc:'昆仑之力造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[340,480,670,920,1300],
    exclusive:true,
  },
  boss_water_abyss: {
    id:'boss_water_abyss', name:'龙宫漩涡', attr:'water',
    desc:'深渊之力造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[330,460,650,900,1280],
    exclusive:true,
  },
  boss_fire_phoenix: {
    id:'boss_fire_phoenix', name:'九天凤焰', attr:'fire',
    desc:'凤凰之火造成{dmg}点伤害（{pct}%攻击力）',
    effect:'dmg', baseDmgPct:[350,490,680,940,1320],
    exclusive:true,
  },
}

// ========================================
// ===== 精英装备模板库 =====
// ========================================
// 精英装备：属性上限更高（×1.35倍）、必定有绝技、可能附带专属绝技

// 小精英专属装备（每个属性1件标志性装备，宝器级命名）
const ELITE_EQUIP_TEMPLATES = {
  elite_weapon_metal: { name:'破军·金鸾剑', slot:'weapon', attr:'metal', ultPool:['elite_metal_blade','golden_slash','wind_blade'], statMul:1.35 },
  elite_weapon_wood:  { name:'回春·青藤杖', slot:'weapon', attr:'wood',  ultPool:['elite_wood_life','wood_sword','thorns'], statMul:1.35 },
  elite_weapon_earth: { name:'磐岩·碎山锤', slot:'weapon', attr:'earth', ultPool:['elite_earth_fortress','earth_slam'], statMul:1.35 },
  elite_weapon_water: { name:'怒涛·碧波剑', slot:'weapon', attr:'water', ultPool:['elite_water_torrent','ice_blast','tidal_wave'], statMul:1.35 },
  elite_weapon_fire:  { name:'天火·赤炎刀', slot:'weapon', attr:'fire',  ultPool:['elite_fire_annihilation','true_fire','lava_burst'], statMul:1.35 },
  elite_helmet_metal: { name:'破军·金鸾冠', slot:'helmet', attr:'metal', ultPool:['elite_metal_blade','golden_bell'], statMul:1.35 },
  elite_helmet_wood:  { name:'回春·翠灵冠', slot:'helmet', attr:'wood',  ultPool:['elite_wood_life','wood_barrier'], statMul:1.35 },
  elite_helmet_earth: { name:'磐岩·厚土冠', slot:'helmet', attr:'earth', ultPool:['elite_earth_fortress','earth_wall'], statMul:1.35 },
  elite_helmet_water: { name:'怒涛·碧水冠', slot:'helmet', attr:'water', ultPool:['elite_water_torrent','ice_shield'], statMul:1.35 },
  elite_helmet_fire:  { name:'天火·赤焰冠', slot:'helmet', attr:'fire',  ultPool:['elite_fire_annihilation','flame_shield'], statMul:1.35 },
  elite_armor_metal:  { name:'破军·金鸾袍', slot:'armor', attr:'metal', ultPool:['golden_armor_heal','golden_bell'], statMul:1.35 },
  elite_armor_wood:   { name:'回春·灵木衣', slot:'armor', attr:'wood',  ultPool:['elite_wood_life','life_spring'], statMul:1.35 },
  elite_armor_earth:  { name:'磐岩·厚土袍', slot:'armor', attr:'earth', ultPool:['elite_earth_fortress','earth_nurture'], statMul:1.35 },
  elite_armor_water:  { name:'怒涛·碧水衣', slot:'armor', attr:'water', ultPool:['elite_water_torrent','water_heal'], statMul:1.35 },
  elite_armor_fire:   { name:'天火·赤焰袍', slot:'armor', attr:'fire',  ultPool:['elite_fire_annihilation','fire_rebirth'], statMul:1.35 },
  elite_trinket_metal:{ name:'破军·金灵珠', slot:'trinket', attr:'metal', ultPool:['elite_metal_blade','metal_seal'], statMul:1.35 },
  elite_trinket_wood: { name:'回春·青木佩', slot:'trinket', attr:'wood',  ultPool:['elite_wood_life','poison_mist'], statMul:1.35 },
  elite_trinket_earth:{ name:'磐岩·厚土佩', slot:'trinket', attr:'earth', ultPool:['elite_earth_fortress','quicksand'], statMul:1.35 },
  elite_trinket_water:{ name:'怒涛·碧海玉', slot:'trinket', attr:'water', ultPool:['elite_water_torrent','frost_slow'], statMul:1.35 },
  elite_trinket_fire: { name:'天火·赤炎珠', slot:'trinket', attr:'fire',  ultPool:['elite_fire_annihilation','fire_weaken'], statMul:1.35 },
  elite_cloak_metal:  { name:'破军·金风披', slot:'cloak', attr:'metal', ultPool:['elite_metal_blade','golden_slash'], statMul:1.35 },
  elite_cloak_wood:   { name:'回春·翠竹披', slot:'cloak', attr:'wood',  ultPool:['elite_wood_life','wood_sword'], statMul:1.35 },
  elite_cloak_earth:  { name:'磐岩·山岩披', slot:'cloak', attr:'earth', ultPool:['elite_earth_fortress','earth_slam'], statMul:1.35 },
  elite_cloak_water:  { name:'怒涛·碧水纱', slot:'cloak', attr:'water', ultPool:['elite_water_torrent','ice_blast'], statMul:1.35 },
  elite_cloak_fire:   { name:'天火·赤焰披', slot:'cloak', attr:'fire',  ultPool:['elite_fire_annihilation','true_fire'], statMul:1.35 },
}

// 大精英套装名（每属性一套，5件套，神器级命名）
const BOSS_SET_NAMES = {
  metal: '太白剑宗',
  wood:  '万木仙庭',
  earth: '昆仑地府',
  water: '龙宫深渊',
  fire:  '九天凤台',
}
// 大精英套装模板（5件套，stat倍率更高×1.5）
const BOSS_SET_TEMPLATES = {
  metal: [
    { name:'太白剑宗·诛仙剑', slot:'weapon', ultPool:['boss_metal_storm','elite_metal_blade'], statMul:1.5 },
    { name:'太白剑宗·紫金冠', slot:'helmet', ultPool:['golden_bell','elite_metal_blade'], statMul:1.5 },
    { name:'太白剑宗·护心铠', slot:'armor',  ultPool:['golden_armor_heal','golden_bell'], statMul:1.5 },
    { name:'太白剑宗·御风披', slot:'cloak',  ultPool:['boss_metal_storm','wind_blade'], statMul:1.5 },
    { name:'太白剑宗·剑心珠', slot:'trinket',ultPool:['boss_metal_storm','metal_seal'], statMul:1.5 },
  ],
  wood: [
    { name:'万木仙庭·通天杖', slot:'weapon', ultPool:['boss_wood_domain','elite_wood_life'], statMul:1.5 },
    { name:'万木仙庭·翠灵冠', slot:'helmet', ultPool:['wood_barrier','elite_wood_life'], statMul:1.5 },
    { name:'万木仙庭·长生袍', slot:'armor',  ultPool:['boss_wood_domain','life_spring'], statMul:1.5 },
    { name:'万木仙庭·藤蔓披', slot:'cloak',  ultPool:['boss_wood_domain','thorns'], statMul:1.5 },
    { name:'万木仙庭·灵木佩', slot:'trinket',ultPool:['boss_wood_domain','poison_mist'], statMul:1.5 },
  ],
  earth: [
    { name:'昆仑地府·开山斧', slot:'weapon', ultPool:['boss_earth_titan','elite_earth_fortress'], statMul:1.5 },
    { name:'昆仑地府·磐石冠', slot:'helmet', ultPool:['earth_wall','elite_earth_fortress'], statMul:1.5 },
    { name:'昆仑地府·玄武袍', slot:'armor',  ultPool:['boss_earth_titan','earth_nurture'], statMul:1.5 },
    { name:'昆仑地府·山岳披', slot:'cloak',  ultPool:['boss_earth_titan','earth_slam'], statMul:1.5 },
    { name:'昆仑地府·地灵佩', slot:'trinket',ultPool:['boss_earth_titan','quicksand'], statMul:1.5 },
  ],
  water: [
    { name:'龙宫深渊·定海针', slot:'weapon', ultPool:['boss_water_abyss','elite_water_torrent'], statMul:1.5 },
    { name:'龙宫深渊·蛟龙冠', slot:'helmet', ultPool:['ice_shield','elite_water_torrent'], statMul:1.5 },
    { name:'龙宫深渊·潮汐衣', slot:'armor',  ultPool:['boss_water_abyss','water_heal'], statMul:1.5 },
    { name:'龙宫深渊·寒冰纱', slot:'cloak',  ultPool:['boss_water_abyss','tidal_wave'], statMul:1.5 },
    { name:'龙宫深渊·渊灵玉', slot:'trinket',ultPool:['boss_water_abyss','frost_slow'], statMul:1.5 },
  ],
  fire: [
    { name:'九天凤台·涅槃刀', slot:'weapon', ultPool:['boss_fire_phoenix','elite_fire_annihilation'], statMul:1.5 },
    { name:'九天凤台·朱雀冠', slot:'helmet', ultPool:['flame_shield','elite_fire_annihilation'], statMul:1.5 },
    { name:'九天凤台·浴火袍', slot:'armor',  ultPool:['boss_fire_phoenix','fire_rebirth'], statMul:1.5 },
    { name:'九天凤台·凤羽披', slot:'cloak',  ultPool:['boss_fire_phoenix','lava_burst'], statMul:1.5 },
    { name:'九天凤台·凤灵珠', slot:'trinket',ultPool:['boss_fire_phoenix','fire_weaken'], statMul:1.5 },
  ],
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
 * 同时支持普通绝技库和精英绝技库
 * 
 * 新版百分比系统：存储的是百分比系数(pct)，实际数值在战斗中根据人物属性动态计算
 * - dmgPct: 伤害 = 人物对应五行攻击力 × dmgPct / 100
 * - healPct: 回复 = 人物回复值 × healPct / 100
 * - defPct: 护盾 = 人物气力(血量) × defPct / 100
 * - debuffPct: 减益 = 人物对应五行攻击力 × debuffPct / 100
 */
function _buildUlt(ultId, qualityId, buffDur) {
  const tpl = ULT_LIBRARY[ultId] || ELITE_ULT_LIBRARY[ultId]
  if (!tpl) return { name:'奥义', desc:'强力攻击', attr:'metal', effect:'dmg', dmgPct:200 }
  const qi = QUALITY_ORDER.indexOf(qualityId)
  const ult = {
    name: tpl.name,
    desc: tpl.desc,
    attr: tpl.attr,
    effect: tpl.effect,
    ultId: tpl.id,
  }
  if (tpl.exclusive) ult.exclusive = true
  // 按品质取对应档位百分比，带±10%随机浮动
  if (tpl.baseDmgPct)    ult.dmgPct    = _randRange(tpl.baseDmgPct[qi]*0.9, tpl.baseDmgPct[qi]*1.1)
  if (tpl.baseHealPct)   ult.healPct   = _randRange(tpl.baseHealPct[qi]*0.9, tpl.baseHealPct[qi]*1.1)
  if (tpl.baseDefPct)    ult.defPct    = _randRange(tpl.baseDefPct[qi]*0.9, tpl.baseDefPct[qi]*1.1)
  if (tpl.baseDebuffPct) ult.debuffPct = _randRange(tpl.baseDebuffPct[qi]*0.9, tpl.baseDebuffPct[qi]*1.1)
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
 * 按自定义权重随机品质
 * @param {Object} qualityWeights - 品质权重对象，如 { white:60, green:35, blue:5 }
 */
function randomQuality(qualityWeights) {
  if (!qualityWeights || typeof qualityWeights !== 'object') {
    qualityWeights = { white:50, green:35, blue:15 }
  }
  const entries = Object.entries(qualityWeights)
  const totalW = entries.reduce((s, e) => s + e[1], 0)
  const r = Math.random() * totalW
  let sum = 0
  for (const [q, w] of entries) {
    sum += w
    if (r < sum) return q
  }
  return entries[0][0]
}

/**
 * 生成精英装备属性（属性上限更高）
 * statMul: 属性倍率，精英×1.35，大精英×1.5
 */
function _genEliteEquipStats(slot, attr, qualityId, level, statMul) {
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
      // 精英装备：更高的浮动上限
      const min = Math.round(baseVal * 0.95 * statMul)
      const max = Math.round(baseVal * 1.25 * statMul)
      stats[key] = _randRange(min, max)
    }
  })
  return stats
}

/**
 * 生成小精英专属装备
 * @param {string} slot - 部位
 * @param {string} attr - 五行属性
 * @param {string} qualityId - 品质
 * @param {number} level - 等级
 * @returns {Object} 精英装备对象
 */
function generateEliteEquipment(slot, attr, qualityId, level) {
  const q = QUALITY[qualityId]
  const lv = Math.max(1, Math.min(MAX_LEVEL, level || 1))

  // 查找精英模板
  const templateKey = Object.keys(ELITE_EQUIP_TEMPLATES).find(k => {
    const t = ELITE_EQUIP_TEMPLATES[k]
    return t.slot === slot && t.attr === attr
  })
  const template = templateKey ? ELITE_EQUIP_TEMPLATES[templateKey] : null
  const statMul = template ? template.statMul : 1.35
  const name = template ? template.name : `精英·${ATTR_NAME[attr]}${EQUIP_SLOT[slot]?.name||''}`

  const stats = _genEliteEquipStats(slot, attr, qualityId, lv, statMul)

  // 绝技：从精英模板池中选取（高概率选到专属绝技）
  let ultId = null
  if (template && template.ultPool && template.ultPool.length > 0) {
    ultId = template.ultPool[Math.floor(Math.random() * template.ultPool.length)]
  }
  if (!ultId) ultId = `elite_${attr}_blade`
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
    ultTrigger: Math.max(2, q.triggerCount - 1),  // 精英装备绝技更易触发
    elite: true,   // 标记为精英装备
  }
}

/**
 * 生成大精英套装掉落（从5件套中随机掉落1-N件）
 * @param {string} attr - 五行属性
 * @param {string} qualityId - 品质
 * @param {number} level - 等级
 * @param {number} count - 掉落件数（默认1-2件）
 * @returns {Array} 套装装备数组
 */
function generateBossSetDrop(attr, qualityId, level, count) {
  const q = QUALITY[qualityId]
  const lv = Math.max(1, Math.min(MAX_LEVEL, level || 1))
  const setTemplates = BOSS_SET_TEMPLATES[attr]
  if (!setTemplates) return []

  const dropCount = count || (Math.random() < 0.3 ? 2 : 1)
  // 随机不重复地从5件套中选取
  const shuffled = setTemplates.slice().sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(dropCount, setTemplates.length))

  return selected.map(tpl => {
    const statMul = tpl.statMul || 1.5
    const stats = _genEliteEquipStats(tpl.slot, attr, qualityId, lv, statMul)

    let ultId = null
    if (tpl.ultPool && tpl.ultPool.length > 0) {
      ultId = tpl.ultPool[Math.floor(Math.random() * tpl.ultPool.length)]
    }
    const ult = _buildUlt(ultId || `boss_${attr}_storm`, qualityId, q.buffDur)

    return {
      uid: _uid(),
      slot: tpl.slot,
      attr,
      quality: qualityId,
      level: lv,
      name: tpl.name,
      stats,
      ult,
      ultTrigger: Math.max(2, q.triggerCount - 1),
      elite: true,
      setName: BOSS_SET_NAMES[attr],  // 套装标识
    }
  })
}

/**
 * 结算掉落：根据关卡 dropConfig 生成装备
 * @param {Object} dropConfig - 关卡掉落配置
 *   dropConfig.qualityWeights  {Object}  品质概率 如 { white:60, green:35, blue:5 }
 *   dropConfig.levelRange      {Array}   [minLv, maxLv] 装备等级范围
 *   dropConfig.slots           {Array?}  可选，限定可掉落的槽位，默认全部
 *   dropConfig.slotWeights     {Object?} 可选，槽位权重，默认 helmet:30,armor:30,cloak:18,weapon:14,trinket:8
 *   dropConfig.count           {number?} 掉落数量，默认1
 *   dropConfig.attr            {string?} 可选，限定属性（如关卡主题属性）
 * @returns {Array} 掉落的装备数组
 */
function settlementDrop(dropConfig) {
  if (!dropConfig) return []
  const count = dropConfig.count || 1
  const results = []

  const defaultSlotWeights = { helmet:30, armor:30, cloak:18, weapon:14, trinket:8 }
  const slotWeights = dropConfig.slotWeights || defaultSlotWeights

  // 如果指定了可掉落槽位，过滤权重
  let validSlots = slotWeights
  if (dropConfig.slots && dropConfig.slots.length > 0) {
    validSlots = {}
    dropConfig.slots.forEach(s => { validSlots[s] = slotWeights[s] || 10 })
  }

  for (let n = 0; n < count; n++) {
    // 随机槽位
    const slotEntries = Object.entries(validSlots)
    const totalSW = slotEntries.reduce((s, e) => s + e[1], 0)
    let r = Math.random() * totalSW, slot = slotEntries[0][0]
    for (const [s, w] of slotEntries) { r -= w; if (r <= 0) { slot = s; break } }

    // 随机属性
    const attr = dropConfig.attr || ATTRS[Math.floor(Math.random() * ATTRS.length)]

    // 随机品质
    const quality = randomQuality(dropConfig.qualityWeights)

    // 随机等级
    const [minLv, maxLv] = dropConfig.levelRange || [1, 5]
    const level = _randRange(Math.max(1, minLv), Math.min(MAX_LEVEL, maxLv))

    results.push(generateEquipment(slot, attr, quality, level))
  }
  return results
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
  ULT_LIBRARY, ELITE_ULT_LIBRARY, EQUIP_TEMPLATES,
  ELITE_EQUIP_TEMPLATES, BOSS_SET_TEMPLATES, BOSS_SET_NAMES,
  generateEquipment, generateEliteEquipment, generateBossSetDrop,
  randomQuality, settlementDrop,
}
