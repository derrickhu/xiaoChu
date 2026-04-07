/**
 * 怪物 / 精英 / Boss 数值缩放 + 敌人技能表 + 境界表
 * 调优时只改此文件
 */

// ===== 通天塔怪物面板 =====
const MONSTER_TIERS = [
  { minFloor:1,   maxFloor:5,   hpMin:280,  hpMax:480,   atkMin:10,  atkMax:18  },
  { minFloor:6,   maxFloor:10,  hpMin:520,  hpMax:880,   atkMin:18,  atkMax:30  },
  { minFloor:11,  maxFloor:15,  hpMin:920,  hpMax:1500,  atkMin:28,  atkMax:44  },
  { minFloor:16,  maxFloor:20,  hpMin:1500, hpMax:2300,  atkMin:42,  atkMax:62  },
  { minFloor:21,  maxFloor:25,  hpMin:2200, hpMax:3300,  atkMin:55,  atkMax:78  },
  { minFloor:26,  maxFloor:30,  hpMin:3000, hpMax:4200,  atkMin:68,  atkMax:92  },
]

const ENEMY_DEF_RATIO = 0.35
const MONSTER_RANDOM_RANGE = [0.85, 0.30]

// ===== 通天塔精英倍率 =====
const TOWER_ELITE_MUL = {
  hp:  [2.8, 0.7],
  atk: [1.8, 0.5],
  def: 1.5,
}

// ===== 通天塔 Boss 缩放 =====
const TOWER_BOSS_SCALING = {
  hpBase:  3.0, hpStep:  0.6, hpCap:  5,
  atkBase: 1.5, atkStep: 0.15, atkCap: 2,
  defBase: 1.2, defStep: 0.15, defCap: 1.6,
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
  defDown:   { name:'碎甲爪',   desc:'降低修士防御30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵术',   desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
  stun:      { name:'妖力震慑', desc:'眩晕修士，无法操作1回合', type:'stun', dur:1 },
  selfHeal:  { name:'妖力再生', desc:'回复自身15%最大血量', type:'selfHeal', pct:15 },
  defBuff:   { name:'坚甲术',   desc:'防御提升30%,持续2回合', type:'buff', field:'def', rate:0.3, dur:2 },
  healPct:   { name:'灵气回春', desc:'回复自身15%最大血量', type:'selfHeal', pct:15 },
  breakBead: { name:'碎珠术',   desc:'随机破坏3颗灵珠', type:'breakBead', count:3 },
  timeSqueeze:  { name:'时间压缩', desc:'拖拽时间减半,持续1回合', type:'debuff', field:'dragTime', rate:0.5, dur:1 },
  attrAbsorb:   { name:'属性吸收', desc:'吞噬3颗己方属性灵珠化为心珠,回复10%生命', type:'attrAbsorb', count:3, healPct:10 },
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
  bossWeaken:    { name:'天罡镇压', desc:'修士攻击降低40%+防御降低40%,持续2回合', type:'bossWeaken', atkRate:0.4, defRate:0.4, dur:2 },
  bossBlitz:     { name:'连环妖击', desc:'连续攻击3次，每次50%攻击力', type:'bossBlitz', hits:3, atkPct:0.5 },
  bossDrain:     { name:'吸星大法', desc:'造成100%攻击力伤害并回复等量生命', type:'bossDrain', atkPct:1.0 },
  bossAnnihil:   { name:'灭世天劫', desc:'造成150%攻击力伤害+破坏4颗灵珠', type:'bossAnnihil', atkPct:1.5, breakCount:4 },
  bossCurse:     { name:'万妖诅咒', desc:'每回合受到固定100点伤害+心珠回复减半,持续3回合', type:'bossCurse', dmg:100, dur:3 },
  bossUltimate:  { name:'超越·终焉', desc:'造成180%攻击力伤害+封锁外围灵珠+眩晕1回合', type:'bossUltimate', atkPct:1.8, sealType:'all', sealDur:2 },
  bossSealAll:   { name:'万象封灵', desc:'以井字封阵封锁灵珠,持续1回合', type:'sealAll', dur:1 },
  bossSealAttr:  { name:'五行禁锢', desc:'封锁全场指定属性灵珠,持续3回合', type:'sealAttr', dur:3 },
}

// ===== 秘境精英倍率（1-12章） =====
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
}

// Boss 保底倍率
const STAGE_BOSS_STAT_FLOOR = { hp: 1.3, atk: 1.15, def: 1.1 }

// 守关小怪血量折扣
const STAGE_MINION_HP_RATIO = 0.6

// 新手模式敌人覆写
const NEWBIE_ENEMY_OVERRIDE = { hp: 80, atk: 4, def: 0 }

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
  STAGE_MINION_HP_RATIO,
  NEWBIE_ENEMY_OVERRIDE,
}
