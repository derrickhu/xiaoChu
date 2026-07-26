/**
 * 怪物 / 精英 / Boss 数值缩放 + 敌人技能表 + 境界表
 * 调优时只改此文件
 */

// ===== 通天塔怪物面板 =====
const MONSTER_TIERS = [
  { minFloor:1,   maxFloor:5,   hpMin:400,   hpMax:700,    atkMin:14,   atkMax:26   },
  { minFloor:6,   maxFloor:10,  hpMin:1000,  hpMax:1800,   atkMin:35,   atkMax:55   },
  { minFloor:11,  maxFloor:15,  hpMin:2100,  hpMax:3500,   atkMin:55,   atkMax:85   },
  { minFloor:16,  maxFloor:20,  hpMin:3800,  hpMax:5800,   atkMin:80,   atkMax:120  },
  { minFloor:21,  maxFloor:25,  hpMin:5500,  hpMax:9000,   atkMin:110,  atkMax:160  },
  { minFloor:26,  maxFloor:30,  hpMin:8000,  hpMax:14000,  atkMin:140,  atkMax:210  },
]

const ENEMY_DEF_RATIO = 0.40
const MONSTER_RANDOM_RANGE = [0.85, 0.30]

// ===== 通天塔精英倍率 =====
const TOWER_ELITE_MUL = {
  hp:  [3.5, 1.0],
  atk: [2.2, 0.6],
  def: 1.8,
}

// ===== 通天塔 Boss 缩放 =====
const TOWER_BOSS_SCALING = {
  hpBase:  4.0, hpStep:  1.0, hpCap:  7,
  atkBase: 2.0, atkStep: 0.25, atkCap: 3,
  defBase: 1.5, defStep: 0.2, defCap: 2.2,
}

// ===== 境界加成表 =====
const REALM_TABLE = [
  /*  1 */ { name:'凡人',       hpUp:0  },
  /*  2 */ { name:'感气期',     hpUp:7  },
  /*  3 */ { name:'引气入体',   hpUp:7  },
  /*  4 */ { name:'凝气初成',   hpUp:7  },
  /*  5 */ { name:'炼气一层',   hpUp:9  },
  /*  6 */ { name:'炼气二层',   hpUp:8  },
  /*  7 */ { name:'炼气三层',   hpUp:8  },
  /*  8 */ { name:'炼气四层',   hpUp:8  },
  /*  9 */ { name:'炼气五层',   hpUp:8  },
  /* 10 */ { name:'筑基初期',   hpUp:12 },
  /* 11 */ { name:'筑基中期',   hpUp:10 },
  /* 12 */ { name:'筑基后期',   hpUp:10 },
  /* 13 */ { name:'筑基圆满',   hpUp:10 },
  /* 14 */ { name:'开光初期',   hpUp:10 },
  /* 15 */ { name:'开光圆满',   hpUp:14 },
  /* 16 */ { name:'融合初期',   hpUp:11 },
  /* 17 */ { name:'融合后期',   hpUp:11 },
  /* 18 */ { name:'融合圆满',   hpUp:11 },
  /* 19 */ { name:'心动初期',   hpUp:11 },
  /* 20 */ { name:'心动圆满',   hpUp:15 },
  /* 21 */ { name:'金丹初期',   hpUp:13 },
  /* 22 */ { name:'金丹中期',   hpUp:13 },
  /* 23 */ { name:'金丹后期',   hpUp:13 },
  /* 24 */ { name:'金丹圆满',   hpUp:13 },
  /* 25 */ { name:'元婴初期',   hpUp:17 },
  /* 26 */ { name:'元婴中期',   hpUp:15 },
  /* 27 */ { name:'元婴后期',   hpUp:15 },
  /* 28 */ { name:'元婴圆满',   hpUp:15 },
  /* 29 */ { name:'化神初期',   hpUp:15 },
  /* 30 */ { name:'化神圆满',   hpUp:18 },
]

// ===== 敌人技能参数表 =====
const ENEMY_SKILLS = {
  atkBuff:   { name:'妖气暴涨', desc:'攻击提升30%,持续2回合', type:'buff', field:'atk', rate:0.3, dur:2 },
  poison:    { name:'瘴毒',     desc:'每回合造成{val}点伤害,持续3回合', type:'dot', dur:3 },
  seal:      { name:'禁珠咒',   desc:'随机封锁4颗灵珠,持续2回合', type:'seal', count:4, dur:2 },
  convert:   { name:'灵脉紊乱', desc:'随机转换3颗灵珠属性', type:'convert', count:3 },
  aoe:       { name:'妖力横扫', desc:'对修士造成120%攻击力伤害', type:'aoe', atkPct:1.2 },
  defDown:   { name:'碎甲爪',   desc:'降低修士防御值30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵术',   desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
  stun:      { name:'妖力震慑', desc:'眩晕修士，无法操作1回合', type:'stun', dur:1 },
  // 百分比回血随飞升篇血量膨胀会失控，统一压到 8%（试炼藤甲同档）
  selfHeal:  { name:'妖力再生', desc:'回复自身8%最大血量', type:'selfHeal', pct:8 },
  defBuff:   { name:'坚甲术',   desc:'防御提升30%,持续2回合', type:'buff', field:'def', rate:0.3, dur:2 },
  healPct:   { name:'灵气回春', desc:'回复自身8%最大血量', type:'selfHeal', pct:8 },
  breakBead: { name:'碎珠术',   desc:'随机破坏3颗灵珠', type:'breakBead', count:3 },
  timeSqueeze:  { name:'时间压缩', desc:'拖拽时间减半,持续1回合', type:'debuff', field:'dragTime', rate:0.5, dur:1 },
  attrAbsorb:   { name:'属性吸收', desc:'吞噬3颗己方属性灵珠化为心珠,回复6%生命', type:'attrAbsorb', count:3, healPct:6 },
  sealColumn:   { name:'封灵柱',   desc:'封锁整列灵珠,持续2回合', type:'sealCol', dur:2 },
  counterSeal:  { name:'克制封印', desc:'封锁所有克制自身属性的灵珠,持续2回合', type:'sealCounter', dur:2 },
  eliteSealRow:   { name:'封灵锁链', desc:'封锁整行灵珠,持续2回合', type:'sealRow', dur:2 },
  eliteSealAttr:  { name:'属性封印', desc:'封锁所有指定属性灵珠,持续2回合', type:'sealAttr', dur:2 },
  eliteSealHeavy: { name:'禁珠大咒', desc:'随机封锁8颗灵珠,持续2回合', type:'seal', count:8, dur:2 },
  bossRage:      { name:'狂暴咆哮', desc:'攻击提升50%,持续3回合', type:'buff', field:'atk', rate:0.5, dur:3 },
  bossQuake:     { name:'震天裂地', desc:'造成130%攻击力伤害+封锁整行灵珠', type:'bossQuake', atkPct:1.3, sealType:'row', sealDur:2 },
  bossDevour:    { name:'噬魂夺魄', desc:'造成110%攻击力伤害+窃取治疗', type:'bossDevour', atkPct:1.1, stealPct:20 },
  bossInferno:   { name:'业火焚天', desc:'灼烧：每回合造成攻击力50%伤害,持续3回合', type:'bossDot', atkPct:0.5, dur:3 },
  bossVoidSeal:  { name:'虚空禁锢', desc:'封锁整行灵珠,持续2回合', type:'bossVoidSeal', dur:2 },
  bossConvert:   { name:'五行逆乱', desc:'随机6颗灵珠属性混乱', type:'convert', count:6 },
  bossMirror:    { name:'妖力护体', desc:'反弹30%伤害,持续2回合', type:'bossMirror', reflectPct:30, dur:2 },
  bossWeaken:    { name:'天罡镇压', desc:'修士攻击降低40%+防御值降低40%,持续2回合', type:'bossWeaken', atkRate:0.4, defRate:0.4, dur:2 },
  bossBlitz:     { name:'连环妖击', desc:'连续攻击3次，每次50%攻击力', type:'bossBlitz', hits:3, atkPct:0.5 },
  bossDrain:     { name:'吸星大法', desc:'造成100%攻击力伤害并回复等量生命', type:'bossDrain', atkPct:1.0 },
  bossAnnihil:   { name:'灭世天劫', desc:'造成150%攻击力伤害+破坏4颗灵珠', type:'bossAnnihil', atkPct:1.5, breakCount:4 },
  bossCurse:     { name:'万妖诅咒', desc:'每回合受到固定100点伤害+心珠回复减半,持续3回合', type:'bossCurse', dmg:100, dur:3 },
  bossUltimate:  { name:'超越·终焉', desc:'造成180%攻击力伤害+封锁外围灵珠+眩晕1回合', type:'bossUltimate', atkPct:1.8, sealType:'all', sealDur:2 },
  bossSealAll:   { name:'万象封灵', desc:'以井字封阵封锁灵珠,持续1回合', type:'sealAll', dur:1 },
  bossSealAttr:  { name:'五行禁锢', desc:'封锁全场指定属性灵珠,持续3回合', type:'sealAttr', dur:3 },
  bossPetSeal:   { name:'锁灵夺魄', desc:'封印1只灵宠，2回合内不能普攻和释放技能', type:'petSeal', count:1, dur:2 },
  trialDefGuard: { name:'玄甲守势', desc:'防御提升20%,持续2回合', type:'buff', field:'def', rate:0.2, dur:2 },
  trialMindGuard:{ name:'定魂无惑', desc:'免疫眩晕与冰冻', type:'passive' },
  trialMindRift: { name:'幻心裂隙', desc:'造成110%攻击力伤害+破坏3颗灵珠', type:'bossAnnihil', atkPct:1.1, breakCount:3 },
  trialPetSeal:  { name:'锁灵封印', desc:'封印1只灵宠，2回合内不能普攻和释放技能', type:'petSeal', count:1, dur:2 },
  trialArmorMirror: { name:'金甲折锋', desc:'反弹15%伤害,持续1回合', type:'bossMirror', reflectPct:15, dur:1 },
  trialArmorRegen:  { name:'藤甲回根', desc:'回复自身8%最大血量', type:'selfHeal', pct:8 },
  trialArmorFrost:  { name:'寒甲凝流', desc:'封锁整行灵珠,持续1回合', type:'sealRow', dur:1 },
  trialArmorBurn:   { name:'熔甲余焰', desc:'灼烧：每回合造成攻击力25%伤害,持续2回合', type:'bossDot', atkPct:0.25, dur:2 },
  trialArmorShatter:{ name:'厚土碎盘', desc:'随机破坏2颗灵珠', type:'breakBead', count:2 },
  trialMindPierce:  { name:'金念穿心', desc:'造成80%攻击力伤害', type:'aoe', atkPct:0.8 },
  trialMindPoison:  { name:'木魇缠息', desc:'每回合造成少量伤害,持续3回合', type:'dot', dur:3 },
  trialMindTide:    { name:'水魇迟流', desc:'拖拽时间缩短35%,持续1回合', type:'debuff', field:'dragTime', rate:0.35, dur:1 },
  trialMindFlare:   { name:'火魇连袭', desc:'连续攻击2次，每次35%攻击力', type:'bossBlitz', hits:2, atkPct:0.35 },
  trialMindQuake:   { name:'土魇裂甲', desc:'降低修士防御值20%,持续2回合', type:'debuff', field:'def', rate:0.2, dur:2 },
  trialSealMetal:   { name:'金锁断刃', desc:'造成70%攻击力伤害', type:'aoe', atkPct:0.7 },
  trialSealWood:    { name:'木锁缠魂', desc:'心珠回复量减半,持续2回合', type:'debuff', field:'healRate', rate:0.5, dur:2 },
  trialSealWater:   { name:'水锁乱流', desc:'随机转换4颗灵珠属性', type:'convert', count:4 },
  trialSealFire:    { name:'火锁焚阵', desc:'灼烧：每回合造成攻击力30%伤害,持续2回合', type:'bossDot', atkPct:0.3, dur:2 },
  trialSealEarth:   { name:'土锁压阵', desc:'随机破坏2颗灵珠', type:'breakBead', count:2 },
}

// ===== 秘境精英倍率（1-16章） =====
const STAGE_ELITE_MULTIPLIERS = {
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
  // 飞升篇精英不再叠 3x 血量，避免百分比回血/拖回合失控
  13: { hp: 2.4, atk: 1.28, def: 1.55 },
  14: { hp: 2.5, atk: 1.30, def: 1.65 },
  15: { hp: 2.6, atk: 1.32, def: 1.75 },
  16: { hp: 2.7, atk: 1.34, def: 1.85 },
}

// Boss 保底倍率
const STAGE_BOSS_STAT_FLOOR = { hp: 1.3, atk: 1.15, def: 1.1 }

// 关卡守关 Boss 专属技能组：按章节主题分型，避免所有关底只沿用普通怪技能。
// 前期保留 2 个核心技能，中后期提升到 3 个技能，让玩家逐章建立应对策略。
const STAGE_BOSS_SKILL_SETS = {
  1: ['atkBuff', 'convert'],
  2: ['bossQuake', 'defBuff'],
  3: ['bossBlitz', 'defBuff', 'breakBead'],
  4: ['bossDevour', 'healBlock', 'sealColumn'],
  5: ['counterSeal', 'bossWeaken', 'bossDrain'],
  6: ['bossQuake', 'defBuff', 'bossWeaken'],
  7: ['attrAbsorb', 'bossDrain', 'sealColumn'],
  8: ['bossRage', 'bossInferno', 'bossBlitz'],
  9: ['bossMirror', 'bossSealAttr', 'bossBlitz'],
  10: ['bossRage', 'bossInferno', 'bossAnnihil'],
  11: ['bossCurse', 'bossSealAttr', 'bossDrain'],
  12: ['bossUltimate', 'bossSealAll', 'bossAnnihil'],
  13: ['bossMirror', 'counterSeal', 'bossBlitz', 'bossAnnihil'],
  14: ['bossDrain', 'sealColumn', 'timeSqueeze', 'bossUltimate'],
  15: ['bossSealAttr', 'bossMirror', 'bossAnnihil', 'bossBlitz'],
  16: ['bossUltimate', 'bossSealAll', 'bossCurse', 'bossAnnihil'],
}

// 飞升篇（13-16章）固定面板曲线：
//   · 13 章保持高压开场；14 章起略收血量/攻击，避免百分比回血把战局拖崩。
//   · 挑战仍由机制技（封珠/削弱/多段）承担，而不是纯数值碾压。
const STAGE_ASCENSION_CURVE = {
  13: [
    { hp: 75000,  atk: 390, def: 120 },
    { hp: 88000,  atk: 455, def: 128 },
    { hp: 104000, atk: 520, def: 138 },
    { hp: 122000, atk: 590, def: 150 },
    { hp: 144000, atk: 660, def: 164 },
    { hp: 168000, atk: 740, def: 180 },
    { hp: 195000, atk: 830, def: 198 },
    { hp: 225000, atk: 930, def: 220 },
  ],
  14: [
    { hp: 235000, atk: 900,  def: 230 },
    { hp: 255000, atk: 970,  def: 242 },
    { hp: 278000, atk: 1050, def: 256 },
    { hp: 303000, atk: 1140, def: 272 },
    { hp: 330000, atk: 1240, def: 290 },
    { hp: 360000, atk: 1340, def: 310 },
    { hp: 392000, atk: 1450, def: 332 },
    { hp: 425000, atk: 1560, def: 355 },
  ],
  15: [
    { hp: 460000, atk: 1580, def: 380 },
    { hp: 495000, atk: 1660, def: 400 },
    { hp: 532000, atk: 1740, def: 422 },
    { hp: 572000, atk: 1820, def: 446 },
    { hp: 615000, atk: 1900, def: 472 },
    { hp: 660000, atk: 1980, def: 500 },
    { hp: 710000, atk: 2050, def: 530 },
    { hp: 765000, atk: 2120, def: 565 },
  ],
  16: [
    { hp: 820000,  atk: 2180, def: 600 },
    { hp: 880000,  atk: 2240, def: 640 },
    { hp: 950000,  atk: 2300, def: 680 },
    { hp: 1030000, atk: 2360, def: 725 },
    { hp: 1120000, atk: 2420, def: 775 },
    { hp: 1220000, atk: 2480, def: 830 },
    { hp: 1330000, atk: 2540, def: 890 },
    { hp: 1450000, atk: 2600, def: 960 },
  ],
}

// 前 12 章（飞升篇之前）按章递增倍率，整体抬高难度并抹平 12→13 断档。
// ch1 保持 1.0 以配合 CH1_HP_CURVE 新手曲线；ch12 约 2.8x 使章末 Boss 接近 13-1 面板。
const STAGE_PRE_ASCENSION_SCALE = {
  1:  { hp: 1.00, atk: 1.00, def: 1.00 },
  2:  { hp: 1.15, atk: 1.10, def: 1.10 },
  3:  { hp: 1.25, atk: 1.15, def: 1.12 },
  4:  { hp: 1.35, atk: 1.20, def: 1.15 },
  5:  { hp: 1.45, atk: 1.28, def: 1.18 },
  6:  { hp: 1.55, atk: 1.35, def: 1.22 },
  7:  { hp: 1.68, atk: 1.42, def: 1.28 },
  8:  { hp: 1.82, atk: 1.50, def: 1.35 },
  9:  { hp: 1.98, atk: 1.60, def: 1.42 },
  10: { hp: 2.15, atk: 1.72, def: 1.50 },
  11: { hp: 2.40, atk: 1.90, def: 1.65 },
  12: { hp: 2.80, atk: 2.50, def: 2.60 },
}

// 全局递增保底：每关 hp/atk/def 至少为前一关的此比例，消除跨章断崖
const STAGE_MIN_GROWTH_RATE = { hp: 1.03, atk: 1.02, def: 1.01 }

// 守关小怪血量折扣
const STAGE_MINION_HP_RATIO = 0.6

// 新手模式敌人覆写（HP 35 确保 1-2 回合内击杀，给新手"必赢"体验）
const NEWBIE_ENEMY_OVERRIDE = { hp: 35, atk: 4, def: 0 }

/**
 * 第 1 章 HP 手动曲线：覆盖全局递增逻辑，实现新手友好的节奏波动
 * 1-1~1-3 新手保护区：压低血量，确保 1-2 回合内结束并让首击血条变化明显
 * → 1-4 首个小挑战 → 1-5 养成检查点
 * → 1-6 节奏缓冲 → 1-7 回升 → 1-8 Boss 高峰
 */
const CH1_HP_CURVE = {
  1: 70, 2: 80, 3: 100,
  4: 230, 5: 280,
  6: 220, 7: 320, 8: 500,
}

module.exports = {
  MONSTER_TIERS,
  ENEMY_DEF_RATIO,
  MONSTER_RANDOM_RANGE,
  TOWER_ELITE_MUL,
  TOWER_BOSS_SCALING,
  REALM_TABLE,
  ENEMY_SKILLS,
  STAGE_ELITE_MULTIPLIERS,
  STAGE_BOSS_STAT_FLOOR,
  STAGE_BOSS_SKILL_SETS,
  STAGE_ASCENSION_CURVE,
  STAGE_PRE_ASCENSION_SCALE,
  STAGE_MIN_GROWTH_RATE,
  STAGE_MINION_HP_RATIO,
  NEWBIE_ENEMY_OVERRIDE,
  CH1_HP_CURVE,
}
