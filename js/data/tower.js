/**
 * 塔层系统 — 灵宠消消塔
 * 随机地图事件 + 怪物生成 + 奇遇 + 商店 + 休息 + BOSS
 * 无局外养成，每局完全重置
 */

const { randomPetByAttr, randomPet, randomPetFromPool } = require('./pets')
const { randomWeapon } = require('./weapons')

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
// 克制倍率（提升至2.5倍，让策略消除更有意义）
const COUNTER_MUL = 2.5      // 克制对方伤害倍率
const COUNTERED_MUL = 0.5    // 被克制伤害倍率

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

// ===== 事件概率（基础） =====
const BASE_EVENT_WEIGHTS = {
  battle:    70,
  elite:      8,
  adventure:  5,
  shop:       4,
  rest:       3,
}

// ===== 总层数 =====
const MAX_FLOOR = 30

// ===== 修仙境界系统（每层通关固定加血量上限，不回血） =====
// 每项: { name, hpUp } — hpUp 为该层通关后增加的血量上限
const REALM_TABLE = [
  /*  1 */ { name:'凡人',       hpUp:0  },
  /*  2 */ { name:'感气期',     hpUp:8  },
  /*  3 */ { name:'引气入体',   hpUp:8  },
  /*  4 */ { name:'凝气初成',   hpUp:8  },
  /*  5 */ { name:'炼气一层',   hpUp:11 },
  /*  6 */ { name:'炼气二层',   hpUp:10 },
  /*  7 */ { name:'炼气三层',   hpUp:10 },
  /*  8 */ { name:'炼气四层',   hpUp:10 },
  /*  9 */ { name:'炼气五层',   hpUp:10 },
  /* 10 */ { name:'筑基初期',   hpUp:15 },
  /* 11 */ { name:'筑基中期',   hpUp:13 },
  /* 12 */ { name:'筑基后期',   hpUp:13 },
  /* 13 */ { name:'筑基圆满',   hpUp:13 },
  /* 14 */ { name:'开光初期',   hpUp:13 },
  /* 15 */ { name:'开光圆满',   hpUp:18 },
  /* 16 */ { name:'融合初期',   hpUp:15 },
  /* 17 */ { name:'融合后期',   hpUp:15 },
  /* 18 */ { name:'融合圆满',   hpUp:15 },
  /* 19 */ { name:'心动初期',   hpUp:15 },
  /* 20 */ { name:'心动圆满',   hpUp:20 },
  /* 21 */ { name:'金丹初期',   hpUp:18 },
  /* 22 */ { name:'金丹中期',   hpUp:18 },
  /* 23 */ { name:'金丹后期',   hpUp:18 },
  /* 24 */ { name:'金丹圆满',   hpUp:18 },
  /* 25 */ { name:'元婴初期',   hpUp:23 },
  /* 26 */ { name:'元婴中期',   hpUp:20 },
  /* 27 */ { name:'元婴后期',   hpUp:20 },
  /* 28 */ { name:'元婴圆满',   hpUp:20 },
  /* 29 */ { name:'化神初期',   hpUp:20 },
  /* 30 */ { name:'化神圆满',   hpUp:25 },
]

// 获取指定层的境界信息
function getRealmInfo(floor) {
  const idx = Math.max(0, Math.min(floor - 1, REALM_TABLE.length - 1))
  return REALM_TABLE[idx]
}

// ===== 怪物数据（按层段，30层制，数值曲线压平，保证后期不会断崖式碾压玩家） =====
// 调优：ATK全面上调，确保每回合对英雄造成可感知的威胁（8%~15%血量）
const MONSTER_TIERS = [
  { minFloor:1,   maxFloor:5,   hpMin:200,  hpMax:360,   atkMin:8,   atkMax:14  },
  { minFloor:6,   maxFloor:10,  hpMin:380,  hpMax:650,   atkMin:14,  atkMax:22  },
  { minFloor:11,  maxFloor:15,  hpMin:680,  hpMax:1100,  atkMin:20,  atkMax:32  },
  { minFloor:16,  maxFloor:20,  hpMin:1100, hpMax:1700,  atkMin:30,  atkMax:46  },
  { minFloor:21,  maxFloor:25,  hpMin:1600, hpMax:2400,  atkMin:40,  atkMax:58  },
  { minFloor:26,  maxFloor:30,  hpMin:2200, hpMax:3000,  atkMin:50,  atkMax:68  },
]

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

// 妖兽技能池（普通怪/精英使用）
const ENEMY_SKILLS = {
  atkBuff:   { name:'妖气暴涨', desc:'攻击提升30%,持续2回合', type:'buff', field:'atk', rate:0.3, dur:2 },
  poison:    { name:'瘴毒',     desc:'每回合造成{val}点伤害,持续3回合', type:'dot', dur:3 },
  seal:      { name:'禁珠咒',   desc:'随机封锁4颗灵珠,持续2回合', type:'seal', count:4, dur:2 },
  convert:   { name:'灵脉紊乱', desc:'随机转换3颗灵珠属性', type:'convert', count:3 },
  aoe:       { name:'妖力横扫', desc:'对修士造成120%攻击力伤害', type:'aoe', atkPct:1.2 },
  defDown:   { name:'碎甲爪',   desc:'降低修士防御30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵术',   desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
  stun:      { name:'妖力震慑', desc:'眩晕修士，无法操作1回合', type:'stun', dur:1 },
  selfHeal:  { name:'妖力再生', desc:'回复自身15%最大血量', type:'selfHeal', pct:15 },
  breakBead: { name:'碎珠术',   desc:'随机破坏3颗灵珠', type:'breakBead', count:3 },
  // ===== 精英封珠技能 =====
  eliteSealRow:   { name:'封灵锁链', desc:'封锁整行灵珠,持续2回合', type:'sealRow', dur:2 },
  eliteSealAttr:  { name:'属性封印', desc:'封锁所有指定属性灵珠,持续2回合', type:'sealAttr', dur:2 },
  eliteSealHeavy: { name:'禁珠大咒', desc:'随机封锁8颗灵珠,持续2回合', type:'seal', count:8, dur:2 },
  // ===== BOSS专属技能 =====
  bossRage:      { name:'狂暴咆哮', desc:'攻击提升50%,持续3回合', type:'buff', field:'atk', rate:0.5, dur:3 },
  bossQuake:     { name:'震天裂地', desc:'造成130%攻击力伤害+封锁整行灵珠', type:'bossQuake', atkPct:1.3, sealType:'row', sealDur:2 },
  bossDevour:    { name:'噬魂夺魄', desc:'造成110%攻击力伤害+窃取治疗', type:'bossDevour', atkPct:1.1, stealPct:20 },
  bossInferno:   { name:'业火焚天', desc:'灼烧：每回合造成攻击力50%伤害,持续3回合', type:'bossDot', atkPct:0.5, dur:3 },
  bossVoidSeal:  { name:'虚空禁锢', desc:'封锁整行灵珠,持续2回合', type:'bossVoidSeal', dur:2 },
  bossConvert:   { name:'五行逆乱', desc:'随机6颗灵珠属性混乱', type:'convert', count:6 },
  bossMirror:    { name:'妖力护体', desc:'反弹30%伤害,持续2回合', type:'bossMirror', reflectPct:30, dur:2 },
  bossWeaken:    { name:'天罡镇压', desc:'修士攻击降低40%+防御降低40%,持续2回合', type:'bossWeaken', atkRate:0.4, defRate:0.4, dur:2 },
  bossBlitz:     { name:'连环妖击', desc:'连续攻击3次，每次50%攻击力', type:'bossBlitz', hits:3, atkPct:0.5 },
  bossDrain:     { name:'吸星大法', desc:'造成100%攻击力伤害并回复等量生命', type:'bossDrain', atkPct:1.0 },
  bossAnnihil:   { name:'灭世天劫', desc:'造成150%攻击力伤害+破坏4颗灵珠', type:'bossAnnihil', atkPct:1.5, breakCount:4 },
  bossCurse:     { name:'万妖诅咒', desc:'每回合受到固定100点伤害+心珠回复减半,持续3回合', type:'bossCurse', dmg:100, dur:3 },
  bossUltimate:  { name:'超越·终焉', desc:'造成180%攻击力伤害+封锁外围灵珠+眩晕1回合', type:'bossUltimate', atkPct:1.8, sealType:'all', sealDur:2 },
  bossSealAll:   { name:'万象封灵', desc:'以井字封阵封锁灵珠,持续1回合', type:'sealAll', dur:1 },
  bossSealAttr:  { name:'五行禁锢', desc:'封锁全场指定属性灵珠,持续3回合', type:'sealAttr', dur:3 },
}

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

// ===== 奇遇事件（30个） =====
const ADVENTURES = [
  { id:'adv1',  name:'灵兽来投',   desc:'随机获得一只新灵兽',        effect:'getPet' },
  { id:'adv2',  name:'捡到仙丹',   desc:'立即回血50%',              effect:'healPct',     pct:50 },
  { id:'adv3',  name:'上古洞府',   desc:'血量上限+10%',             effect:'hpMaxUp',     pct:10 },
  { id:'adv4',  name:'天降灵物',   desc:'随机获得一件法宝',          effect:'getWeapon' },
  { id:'adv5',  name:'仙兽引路',   desc:'下一层必定不遇怪',          effect:'skipBattle' },
  { id:'adv6',  name:'秘境泉水',   desc:'满血回复',                  effect:'fullHeal' },
  { id:'adv7',  name:'道骨仙风',   desc:'转珠时间+0.5秒',           effect:'extraTime',   sec:0.5 },
  { id:'adv8',  name:'灵石遍地',   desc:'随机强化一只灵兽',          effect:'upgradePet' },
  { id:'adv9',  name:'仙光护体',   desc:'获得一层临时护盾',          effect:'shield',      val:50 },
  { id:'adv10', name:'古符现世',   desc:'下次战斗怪物眩晕一回合',    effect:'nextStun' },
  { id:'adv11', name:'草木滋养',   desc:'木属性伤害+5%',            effect:'attrDmgUp',   attr:'wood', pct:5 },
  { id:'adv12', name:'金水相合',   desc:'金属性+水属性伤害+5%',     effect:'multiAttrUp', attrs:['metal','water'], pct:5 },
  { id:'adv13', name:'火焰赐福',   desc:'火属性伤害+8%',            effect:'attrDmgUp',   attr:'fire', pct:8 },
  { id:'adv14', name:'大地加持',   desc:'土属性伤害+5%',            effect:'attrDmgUp',   attr:'earth', pct:5 },
  { id:'adv15', name:'道心稳固',   desc:'下次战斗Combo不会断',      effect:'comboNeverBreak' },
  { id:'adv16', name:'仙人点化',   desc:'随机获得一只新灵兽',        effect:'getPet' },
  { id:'adv17', name:'无尘之地',   desc:'清除所有负面状态',          effect:'clearDebuff' },
  { id:'adv18', name:'灵泉洗礼',   desc:'心珠效果+20%',             effect:'heartBoost',  pct:20 },
  { id:'adv19', name:'神兵残影',   desc:'法宝效果临时提升20%',       effect:'weaponBoost', pct:20 },
  { id:'adv20', name:'遗落法宝',   desc:'随机获得一件法宝',          effect:'getWeapon' },
  { id:'adv21', name:'灵兽投缘',   desc:'随机获得一只新灵兽',        effect:'getPet' },
  { id:'adv22', name:'妖巢宝箱',   desc:'全队攻击+8%持续本局',       effect:'allDmgUp',    pct:8 },
  { id:'adv23', name:'上古战魂',   desc:'下一层伤害翻倍',            effect:'nextDmgDouble' },
  { id:'adv24', name:'静心咒',     desc:'转珠时间+1秒',             effect:'extraTime',   sec:1 },
  { id:'adv25', name:'天护',       desc:'抵挡一次致命攻击',          effect:'tempRevive' },
  { id:'adv26', name:'灵兽觉醒',   desc:'随机一只灵兽攻击+10%',     effect:'petAtkUp',    pct:10 },
  { id:'adv27', name:'仙酿',       desc:'回血70%',                  effect:'healPct',     pct:70 },
  { id:'adv28', name:'地脉之力',   desc:'下回合必定高珠掉落',        effect:'goodBeads' },
  { id:'adv29', name:'破邪',       desc:'免疫下一次控制',            effect:'immuneOnce' },
  { id:'adv30', name:'机缘',       desc:'直接获得三选一奖励',        effect:'tripleChoice' },
]

// ===== 商店物品池（新版：10件，按权重抽4件，免费选1件，第2件消耗15%血） =====
const SHOP_ITEMS = [
  { id:'shop1',  name:'灵兽招募',   desc:'选择属性，获得该属性灵兽', effect:'getPetByAttr', weight:10, rarity:'normal' },
  { id:'shop2',  name:'法宝寻宝',   desc:'随机获得一件法宝',         effect:'getWeapon',    weight:10, rarity:'normal' },
  { id:'shop3',  name:'升星灵石',   desc:'选择一只灵兽直接升1星',    effect:'starUp',       weight:8,  rarity:'rare' },
  { id:'shop4',  name:'攻击秘药',   desc:'选择一只灵兽，攻击+25%',   effect:'upgradePet',   pct:25, weight:6, rarity:'rare' },
  { id:'shop5',  name:'悟道丹',     desc:'选择一只灵兽，技能CD-1',   effect:'cdReduce',     weight:3,  rarity:'epic' },
  { id:'shop6',  name:'满血回复',   desc:'血量恢复至上限',           effect:'fullHeal',     weight:10, rarity:'normal' },
  { id:'shop7',  name:'血脉丹',     desc:'血量上限+15%',             effect:'hpMaxUp',      pct:15, weight:10, rarity:'normal' },
  { id:'shop8',  name:'护身符',     desc:'永久受伤减免+8%',          effect:'dmgReduce',    pct:8, weight:6, rarity:'rare' },
  { id:'shop9',  name:'还魂玉',     desc:'获得1次额外复活机会',      effect:'extraRevive',  weight:6,  rarity:'rare' },
  { id:'shop10', name:'灵力结晶',   desc:'全队技能伤害+15%',         effect:'skillDmgUp',   pct:15, weight:10, rarity:'normal' },
]
const SHOP_DISPLAY_COUNT = 4   // 每次展示4件
const SHOP_FREE_COUNT = 1      // 免费选1件
const SHOP_HP_COST_PCT = 15    // 第2件消耗当前血量的百分比

// ===== 休息之地选项 =====
const REST_OPTIONS = [
  { id:'rest1', name:'休息回血', desc:'回复50%最大血量', effect:'healPct', pct:50 },
  { id:'rest2', name:'修炼增强', desc:'获得临时小BUFF（攻击+5%）', effect:'allAtkUp', pct:5 },
]

// ===== 胜利后三选一奖励类型 =====
const REWARD_TYPES = {
  NEW_PET:    'newPet',
  NEW_WEAPON: 'newWeapon',
  BUFF:       'buff',       // 全队加成奖励
}

// ===== 加成奖励池（重做：去掉蚊子叮，改为体感明显的变革性效果）=====
// 小档（普通战斗掉落）——每次拿到都能明显感到变强
const BUFF_POOL_MINOR = [
  { id:'m1',  label:'全队攻击 +12%',          buff:'allAtkPct',       val:12 },
  { id:'m2',  label:'全队攻击 +15%',          buff:'allAtkPct',       val:15 },
  // 血量上限已由境界系统固定提供，从奖励池移除
  { id:'m5',  label:'心珠回复 +20%',          buff:'heartBoostPct',   val:20 },
  { id:'m6',  label:'Combo伤害 +12%',         buff:'comboDmgPct',     val:12 },
  { id:'m7',  label:'3消伤害 +15%',           buff:'elim3DmgPct',     val:15 },
  { id:'m8',  label:'转珠时间 +0.5秒',        buff:'extraTimeSec',    val:0.5 },
  { id:'m9',  label:'每回合回血 +5',           buff:'regenPerTurn',    val:5 },
  { id:'m10', label:'受伤减免 -8%',           buff:'dmgReducePct',    val:8 },
  { id:'m11', label:'怪物攻击 -8%',           buff:'enemyAtkReducePct', val:8 },
  { id:'m12', label:'怪物血量 -8%',           buff:'enemyHpReducePct',  val:8 },
  { id:'m13', label:'立即恢复40%血量',        buff:'healNow',         val:40 },
  { id:'m14', label:'战后额外回血15%',        buff:'postBattleHeal',  val:15 },
]
// 中档（精英战斗掉落）——质变级
const BUFF_POOL_MEDIUM = [
  { id:'e1',  label:'全队攻击 +15%',          buff:'allAtkPct',       val:15 },
  // 血量上限已由境界系统固定提供，从奖励池移除
  { id:'e3',  label:'心珠回复 +25%',          buff:'heartBoostPct',   val:25 },
  { id:'e4',  label:'Combo伤害 +15%',         buff:'comboDmgPct',     val:15 },
  { id:'e5',  label:'4消伤害 +20%',           buff:'elim4DmgPct',     val:20 },
  { id:'e6',  label:'克制伤害 +15%',          buff:'counterDmgPct',   val:15 },
  { id:'e7',  label:'技能伤害 +15%',          buff:'skillDmgPct',     val:15 },
  { id:'e8',  label:'技能CD -15%',            buff:'skillCdReducePct',val:15 },
  { id:'e9',  label:'转珠时间 +1秒',          buff:'extraTimeSec',    val:1 },
  { id:'e10', label:'每回合回血 +5',           buff:'regenPerTurn',    val:5 },
  { id:'e11', label:'受伤减免 -10%',          buff:'dmgReducePct',    val:10 },
  { id:'e12', label:'精英攻击 -10%',          buff:'eliteAtkReducePct', val:10 },
  { id:'e13', label:'精英血量 -10%',          buff:'eliteHpReducePct',  val:10 },
  { id:'e14', label:'立即恢复50%血量',        buff:'healNow',         val:50 },
  { id:'e15', label:'下场减伤30%',            buff:'nextDmgReduce',   val:30 },
  { id:'e16', label:'战后额外回血20%',        buff:'postBattleHeal',  val:20 },
]
// 大档（BOSS战掉落）——超级强化，拿到就起飞
const BUFF_POOL_MAJOR = [
  { id:'M1',  label:'全队攻击 +25%',          buff:'allAtkPct',       val:25 },
  // 血量上限已由境界系统固定提供，从奖励池移除
  { id:'M3',  label:'心珠回复 +40%',          buff:'heartBoostPct',   val:40 },
  { id:'M4',  label:'Combo伤害 +25%',         buff:'comboDmgPct',     val:25 },
  { id:'M5',  label:'5消伤害 +30%',           buff:'elim5DmgPct',     val:30 },
  { id:'M6',  label:'克制伤害 +25%',          buff:'counterDmgPct',   val:25 },
  { id:'M7',  label:'技能伤害 +25%',          buff:'skillDmgPct',     val:25 },
  { id:'M8',  label:'技能CD -25%',            buff:'skillCdReducePct',val:25 },
  { id:'M9',  label:'转珠时间 +1.5秒',        buff:'extraTimeSec',    val:1.5 },
  { id:'M10', label:'每回合回血 +8',           buff:'regenPerTurn',    val:8 },
  { id:'M11', label:'受伤减免 -15%',          buff:'dmgReducePct',    val:15 },
  { id:'M12', label:'额外 +2连击',            buff:'bonusCombo',      val:2 },
  { id:'M13', label:'5消眩晕 +2回合',         buff:'stunDurBonus',    val:2 },
  { id:'M14', label:'BOSS攻击 -15%',          buff:'bossAtkReducePct', val:15 },
  { id:'M15', label:'BOSS血量 -15%',          buff:'bossHpReducePct',  val:15 },
  { id:'M16', label:'立即恢复100%血量',       buff:'healNow',         val:100 },
  { id:'M17', label:'下场减伤50%',            buff:'nextDmgReduce',   val:50 },
  { id:'M18', label:'额外1次复活机会',        buff:'extraRevive',     val:1 },
]
// 速通奖励池（5回合内击败的额外奖励，独特效果）
const BUFF_POOL_SPEEDKILL = [
  { id:'s1',  label:'[速通] 回复40%血量',       buff:'healNow',           val:40 },
  { id:'s2',  label:'[速通] 全队攻击 +12%',     buff:'allAtkPct',         val:12 },
  // 血量上限已由境界系统固定提供，从速通池移除
  { id:'s4',  label:'[速通] 心珠效果 +20%',     buff:'heartBoostPct',     val:20 },
  { id:'s5',  label:'[速通] 怪物血量 -8%',      buff:'enemyHpReducePct',  val:8 },
  { id:'s6',  label:'[速通] 转珠时间 +0.8秒',   buff:'extraTimeSec',      val:0.8 },
  { id:'s7',  label:'[速通] 回血 +5/回合',      buff:'regenPerTurn',      val:5 },
  { id:'s8',  label:'[速通] 受伤 -8%',          buff:'dmgReducePct',      val:8 },
  { id:'s9',  label:'[速通] Combo伤害 +12%',    buff:'comboDmgPct',       val:12 },
  { id:'s10', label:'[速通] 技能伤害 +12%',     buff:'skillDmgPct',       val:12 },
  { id:'s11', label:'[速通] 下场首回合伤害翻倍', buff:'nextFirstTurnDouble', val:1 },
  { id:'s12', label:'[速通] 下场敌人眩晕1回合', buff:'nextStunEnemy',      val:1 },
  { id:'s13', label:'[速通] 获得60点护盾',      buff:'grantShield',        val:60 },
  { id:'s14', label:'[速通] 技能CD全部重置',    buff:'resetAllCd',         val:1 },
  { id:'s15', label:'[速通] 跳过下一场战斗',    buff:'skipNextBattle',     val:1 },
  { id:'s16', label:'[速通] 下场免疫一次伤害',  buff:'immuneOnce',         val:1 },
]
// 合并所有（兼容旧引用）
const ALL_BUFF_REWARDS = [...BUFF_POOL_MINOR, ...BUFF_POOL_MEDIUM, ...BUFF_POOL_MAJOR]

// ===== 工具函数 =====
function _lerp(a, b, t) { return a + (b - a) * t }
function _rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ===== 最近怪物记录（用于去重） =====
const _recentMonsters = []     // 存储最近遇到的怪物 avatar 标识
const RECENT_LIMIT = 3         // 连续3场内不出同一张图

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

  // 增加随机性：基础值±15%波动
  const rand = () => 0.85 + Math.random() * 0.30
  let hp  = Math.round(_lerp(tier.hpMin, tier.hpMax, progress) * rand())
  let atk = Math.round(_lerp(tier.atkMin, tier.atkMax, progress) * rand())

  // 名字：基准档位 ±1 随机浮动，增加同层段怪物多样性
  const names = MONSTER_NAMES[attr]
  const baseIdx = Math.min(Math.floor(floor / 5), names.length - 1)
  const lo = Math.max(0, baseIdx - 1)
  const hi = Math.min(names.length - 1, baseIdx + 1)
  // 在 [lo, hi] 范围内随机选取，优先避开最近出现过的
  const attrKeyMap = { metal:'m', wood:'w', earth:'e', water:'s', fire:'f' }
  const monKey = attrKeyMap[attr] || 'm'
  let nameIdx = baseIdx
  const candidates = []
  for (let i = lo; i <= hi; i++) candidates.push(i)
  // 过滤掉最近出现过的（同属性同档位 = 同张图）
  const fresh = candidates.filter(i => !_recentMonsters.includes(`enemies/mon_${monKey}_${i + 1}`))
  nameIdx = fresh.length > 0 ? _pick(fresh) : _pick(candidates)
  const name = names[nameIdx]

  // 技能：前5层1个轻量技能，6-8层1个基础技能，9层起逐步加技能（30层制）
  const skills = []
  const skillPoolLight = ['convert','aoe']              // 前期轻量技能（转珠/小范围伤害）
  const skillPool1 = ['poison','seal','convert']        // 控制/干扰类
  const skillPool2 = ['atkBuff','defDown','healBlock']  // 增强/削弱类
  if (floor <= 5) {
    skills.push(_pick(skillPoolLight))                  // 1-5层: 1个轻量技能
  } else if (floor <= 8) {
    skills.push(_pick(skillPool1))                      // 6-8层: 1个Pool1技能
  } else {
    skills.push(_pick(skillPool1))                      // 9层起: 1个Pool1技能
    if (floor >= 18) skills.push(_pick(skillPool2))     // 18层起: 再加1个Pool2技能
  }
  // 25层以上有小概率带第3个技能
  if (floor >= 25 && Math.random() < 0.3) {
    const allSkills = [...skillPool1, ...skillPool2, 'breakBead']
    const extra = _pick(allSkills.filter(s => !skills.includes(s)))
    if (extra) skills.push(extra)
  }

  // 怪物图片
  const monIdx = nameIdx + 1
  const avatar = `enemies/mon_${monKey}_${monIdx}`
  _pushRecent(avatar)

  return { name, attr, hp, maxHp: hp, atk, def: Math.round(atk * 0.35), skills, avatar }
}

// ===== 生成精英怪 =====
function generateElite(floor) {
  const base = generateMonster(floor)
  const attr = base.attr

  // 精英 = 普通×(2.2~2.8)血 ×(1.6~2.0)攻
  const hpMul = 2.2 + Math.random() * 0.6
  const atkMul = 1.6 + Math.random() * 0.4
  base.hp    = Math.round(base.hp * hpMul)
  base.maxHp = base.hp
  base.atk   = Math.round(base.atk * atkMul)
  base.def   = Math.round(base.def * 1.5)

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
  base.avatar = `enemies/elite_${eliteKey}_${eliteIdx}`
  // 精英专属战斗背景（每属性3张随机选1张）
  base.battleBg = `enemies/bg_elite_${eliteKey}_${_rand(1,3)}`
  return base
}

// ===== 生成BOSS =====
function generateBoss(floor) {
  const base = generateMonster(floor)

  // BOSS倍率随层数递增（30层制：10层=1档，20层=2档，30层=3档）
  const bossLevel = Math.round(floor / 10)  // 1~3
  const hpMul  = Math.min(2.5 + (bossLevel - 1) * 0.8, 5)
  const atkMul = Math.min(1.5 + (bossLevel - 1) * 0.3, 2.5)
  const defMul = Math.min(1.2 + (bossLevel - 1) * 0.2, 2)

  base.hp    = Math.round(base.hp * hpMul)
  base.maxHp = base.hp
  base.atk   = Math.round(base.atk * atkMul)
  base.def   = Math.round(base.def * defMul)
  base.isBoss = true
  base.attr   = _pick(ATTRS)

  // 按层级从不同BOSS池中随机选取
  let pool
  if (floor >= 30)      pool = BOSS_POOL_30
  else if (floor >= 20) pool = BOSS_POOL_20
  else                  pool = BOSS_POOL_10

  const chosen = pool[Math.floor(Math.random() * pool.length)]
  base.name = chosen.name
  const bossNum = chosen.bossNum
  base.avatar = `enemies/boss_${bossNum}`
  base.battleBg = `enemies/bg_boss_${bossNum}`

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
  // 第5层强制精英（保证前期获得法宝的机会）
  if (floor === 5) {
    return { type: EVENT_TYPE.ELITE, data: generateElite(floor) }
  }

  // 权重随机事件
  const weights = { ...BASE_EVENT_WEIGHTS }

  // 前2层：只出普通战斗（30层制更快进入完整体验）
  if (floor <= 2) {
    weights.elite = 0
    weights.adventure = 0
    weights.shop = 0
    weights.rest = 0
  } else if (floor <= 4) {
    // 3-4层：开放奇遇和休息
    weights.elite = 0
    weights.shop = 0
    weights.adventure = 8
    weights.rest = 3
  } else {
    // 5层起：全面开放
    weights.elite += Math.floor(floor / 4) * 3
    if (floor % 5 === 0) weights.elite += 18
    weights.adventure += Math.floor(floor / 6) * 2
    weights.shop += Math.floor(floor / 8) * 2
    weights.rest += Math.floor(floor / 8) * 2
    if (floor >= 15) weights.battle -= 10
    if (floor >= 22) weights.battle -= 10
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
        const totalW = pool.reduce((s, it) => s + (it.weight || 10), 0)
        let roll = Math.random() * totalW
        let picked = 0
        for (let j = 0; j < pool.length; j++) {
          roll -= (pool[j].weight || 10)
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

// ===== 生成胜利后三选一奖励 =====
// eventType: 'battle' | 'elite' | 'boss'
// speedKill: 是否速通（5回合内击败）
// sessionPetPool: 本局宠物池（15只）
// ownedPetIds: 已拥有宠物ID集合（用于偏向抽取促进升星）
function generateRewards(floor, eventType, speedKill, ownedWeaponIds, sessionPetPool, ownedPetIds, maxedPetIds) {
  const rewards = []
  const usedIds = new Set()
  // 根据事件类型确定宠物获取渠道
  const petSource = eventType === 'boss' ? 'boss' : eventType === 'elite' ? 'elite' : 'normal'
  const _rPet = () => randomPetFromPool(sessionPetPool, ownedPetIds, petSource, maxedPetIds)

  // 从指定池中随机选一个不重复的
  function pickFrom(pool) {
    const avail = pool.filter(b => !usedIds.has(b.id))
    if (avail.length === 0) return null
    const b = _pick(avail)
    usedIds.add(b.id)
    return { type: REWARD_TYPES.BUFF, label: b.label, data: { ...b } }
  }

  // 法宝排除已拥有 + 本次已选的
  const wpnExclude = new Set(ownedWeaponIds || [])

  if (eventType === 'boss') {
    // BOSS战斗：1只灵宠 + 1件法宝 + 1个大档buff 三选一（速通4选1）
    const newPet = _rPet()
    rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${newPet.name}`, data: newPet })
    let w = randomWeapon(wpnExclude)
    wpnExclude.add(w.id)
    rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
    rewards.push(pickFrom(BUFF_POOL_MAJOR))
  } else if (eventType === 'elite') {
    // 精英战斗：1只灵宠 + 1件法宝 + 1个中档buff 三选一（速通4选1）
    const newPet = _rPet()
    rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${newPet.name}`, data: newPet })
    let w = randomWeapon(wpnExclude)
    wpnExclude.add(w.id)
    rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
    rewards.push(pickFrom(BUFF_POOL_MEDIUM))
  } else {
    // 普通战斗：2只灵宠 + 1件法宝 三选一（全实物，无buff）
    const petIds = new Set()
    for (let i = 0; i < 2; i++) {
      let p = _rPet()
      let tries = 0
      while (petIds.has(p.id) && tries < 20) { p = _rPet(); tries++ }
      petIds.add(p.id)
      rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${p.name}`, data: p })
    }
    let w = randomWeapon(wpnExclude)
    wpnExclude.add(w.id)
    rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
  }

  // 速通额外奖励：精英/boss追加同类型第4个选项，普通战追加速通buff
  if (speedKill) {
    if (eventType === 'boss') {
      const existIds = new Set(rewards.map(r => r.data && r.data.id))
      existIds.forEach(id => wpnExclude.add(id))
      let w = randomWeapon(wpnExclude)
      rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
    } else if (eventType === 'elite') {
      const existIds = new Set(rewards.map(r => r.data && r.data.id))
      existIds.forEach(id => wpnExclude.add(id))
      let w = randomWeapon(wpnExclude)
      rewards.push({ type: REWARD_TYPES.NEW_WEAPON, label: `新法宝：${w.name}`, data: w })
    } else {
      // 普通战斗速通：额外奖励1只灵宠（促进升星）
      let speedPet = _rPet()
      const existPetIds = new Set(rewards.filter(r => r.type === REWARD_TYPES.NEW_PET).map(r => r.data.id))
      let tries = 0
      while (existPetIds.has(speedPet.id) && tries < 20) { speedPet = _rPet(); tries++ }
      rewards.push({ type: REWARD_TYPES.NEW_PET, label: `新灵兽：${speedPet.name}`, data: speedPet, isSpeed: true })
    }
  }

  // 安全过滤null（池子耗尽情况）
  return rewards.filter(r => r != null)
}

// ===== 灵珠权重（根据属性偏好生成） =====
function getBeadWeights(floorAttr, weapon) {
  const weights = {
    metal: 1, wood: 1, earth: 1, water: 1, fire: 1, heart: 0.8
  }
  // 如果本层有属性偏向，增加该属性珠出现率
  if (floorAttr && weights[floorAttr] !== undefined) {
    weights[floorAttr] = 1.4
  }
  // 法宝beadRateUp效果
  if (weapon && weapon.type === 'beadRateUp' && weapon.attr) {
    weights[weapon.attr] = (weights[weapon.attr] || 1) * 1.5
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
