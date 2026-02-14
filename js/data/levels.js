/**
 * 关卡系统 - 五行秘境
 * 5灵根秘境×10关 + 混沌秘境
 * 五行：金(metal)/木(wood)/土(earth)/水(water)/火(fire)
 */
const { ATTRS, ATTR_NAME, BEAD_ATTRS, ATK_KEY, DEF_KEY } = require('./equipment')

// 难度倍率
const DIFFICULTY = {
  normal:  { id:'normal',  name:'练气', hpMul:1,   atkMul:1,   defMul:1,   color:'#4dcc4d', tier:'low' },
  hard:    { id:'hard',    name:'筑基', hpMul:1.6, atkMul:1.5, defMul:1.3, color:'#ff8c00', tier:'mid' },
  extreme: { id:'extreme', name:'金丹', hpMul:2.5, atkMul:2.2, defMul:1.8, color:'#ff4d6a', tier:'high' },
}

// 妖兽技能池（被动/周期技能）
const ENEMY_SKILLS = {
  atkBuff:   { name:'妖气暴涨', desc:'攻击提升30%,持续2回合', type:'buff', field:'atk', rate:0.3, dur:2 },
  poison:    { name:'毒瘴', desc:'每回合造成{val}点伤害,持续3回合', type:'dot', dur:3 },
  seal:      { name:'封灵', desc:'随机封锁2颗灵珠,持续2回合', type:'seal', count:2, dur:2 },
  convert:   { name:'灵气紊乱', desc:'随机转换3颗灵珠属性', type:'convert', count:3 },
  aoe:       { name:'妖力横扫', desc:'对修士造成{val}点伤害', type:'aoe' },
  defDown:   { name:'破甲爪', desc:'降低修士防御30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵', desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
}

// ===== 怪物绝技库（主动大招，固定回合释放） =====
const ENEMY_ULTS = {
  // --- 伤害类绝技 ---
  metal_fury: {
    id:'metal_fury', name:'金刃风暴', attr:'metal',
    desc:'释放金属风暴，造成自身攻击{pct}%的伤害',
    effect:'dmg', pct:180, triggerType:'turn',
  },
  wood_drain: {
    id:'wood_drain', name:'噬木吸灵', attr:'wood',
    desc:'吸取生机，造成{pct}%伤害并回复等量血量',
    effect:'drain', pct:120, triggerType:'turn',
  },
  earth_quake: {
    id:'earth_quake', name:'地裂山崩', attr:'earth',
    desc:'大地震动，造成{pct}%伤害并随机转换4颗灵珠',
    effect:'dmg_convert', pct:150, convertCount:4, triggerType:'turn',
  },
  water_prison: {
    id:'water_prison', name:'寒冰牢笼', attr:'water',
    desc:'冰灵禁锢，造成{pct}%伤害并封锁3颗灵珠2回合',
    effect:'dmg_seal', pct:130, sealCount:3, sealDur:2, triggerType:'turn',
  },
  fire_inferno: {
    id:'fire_inferno', name:'焚天烈焰', attr:'fire',
    desc:'烈焰焚天，造成{pct}%伤害并附加灼烧(每回合{dotPct}%,3回合)',
    effect:'dmg_dot', pct:140, dotPct:30, dotDur:3, triggerType:'turn',
  },
  // --- 增强类绝技 ---
  berserk: {
    id:'berserk', name:'妖狂化', attr:'neutral',
    desc:'狂化状态，攻击提升50%持续3回合',
    effect:'selfBuff', field:'atk', rate:0.5, dur:3, triggerType:'turn',
  },
  regen: {
    id:'regen', name:'妖力再生', attr:'neutral',
    desc:'回复自身{pct}%最大血量',
    effect:'selfHeal', pct:15, triggerType:'turn',
  },
  // --- 控制类绝技 ---
  chaos_field: {
    id:'chaos_field', name:'混沌领域', attr:'neutral',
    desc:'全场灵珠随机打乱，并降低回复50%持续2回合',
    effect:'chaos', healRate:0.5, healDur:2, triggerType:'turn',
  },
}

// ===== 新手引导关卡（levelId 1-5） =====
const TUTORIAL_TIPS = {
  1: {
    title: '转珠入门',
    tips: [
      '拖拽灵珠可与相邻灵珠交换位置',
      '将3颗以上同色灵珠连成一排即可消除',
      '五行克制：金→木→土→水→火→金',
      '克制属性伤害×1.5，被克制×0.6',
    ],
  },
  2: {
    title: '连击(Combo)',
    tips: [
      '一次拖拽中制造多组消除=连击Combo',
      'Combo越高，所有伤害倍率越大',
      '巧妙规划路径，争取多组同时消除',
    ],
  },
  3: {
    title: '回复珠',
    tips: [
      '粉色心珠消除可回复气血',
      '心珠也受Combo倍率加成',
      '合理消除心珠是持久战的关键',
    ],
  },
  4: {
    title: '装备强化',
    tips: [
      '击败妖兽可获得法宝装备',
      '装备会增加属性（攻/防/气力/回复）',
      '更好的装备让你的修士更强大',
      '尝试佩戴新法宝替换旧装备',
    ],
  },
  5: {
    title: '绝技释放',
    tips: [
      '部分装备附带绝技（仙术）',
      '消除对应属性灵珠为绝技蓄力',
      '蓄力满后点击绝技图标即可释放',
      '善用绝技可大幅提升战斗效率',
    ],
  },
}

function _genTutorialLevels() {
  const levels = []

  // 第1关：转珠基础+五行克制，无心珠，极弱怪
  levels.push({
    levelId: 1,
    theme: 'tutorial',
    bg: 'theme_metal',
    name: '新手引导·转珠入门',
    tutorial: 1,
    enemy: {
      name: '木灵小妖',
      attr: 'wood',
      hp: 60,
      stamina: 60,
      metalAtk:3, woodAtk:6, earthAtk:3, waterAtk:3, fireAtk:3,
      metalDef:1, woodDef:2, earthDef:1, waterDef:1, fireDef:1,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_wood_1.jpg',
    },
    // 无心珠，只有五行珠
    beadWeights: { metal:20, wood:20, earth:20, water:20, fire:20, heart:0 },
    dropRate: 0,
    specialCond: null,
  })

  // 第2关：combo教学，无心珠，稍强一点
  levels.push({
    levelId: 2,
    theme: 'tutorial',
    bg: 'theme_fire',
    name: '新手引导·连击Combo',
    tutorial: 2,
    enemy: {
      name: '火灵小妖',
      attr: 'fire',
      hp: 80,
      stamina: 80,
      metalAtk:3, woodAtk:3, earthAtk:3, waterAtk:3, fireAtk:8,
      metalDef:1, woodDef:1, earthDef:1, waterDef:1, fireDef:2,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_fire_1.jpg',
    },
    beadWeights: { metal:20, wood:20, earth:20, water:20, fire:20, heart:0 },
    dropRate: 0,
    specialCond: null,
  })

  // 第3关：心珠回复教学
  levels.push({
    levelId: 3,
    theme: 'tutorial',
    bg: 'theme_water',
    name: '新手引导·气血回复',
    tutorial: 3,
    enemy: {
      name: '水灵小妖',
      attr: 'water',
      hp: 100,
      stamina: 100,
      metalAtk:3, woodAtk:3, earthAtk:3, waterAtk:10, fireAtk:3,
      metalDef:1, woodDef:1, earthDef:1, waterDef:2, fireDef:1,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_water_1.jpg',
    },
    // 加入心珠
    beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
    dropRate: 0,
    specialCond: null,
  })

  // 第4关：装备教学，怪稍强（前两回合打血慢），必掉绿装头盔（无绝技）
  levels.push({
    levelId: 4,
    theme: 'tutorial',
    bg: 'theme_earth',
    name: '新手引导·装备强化',
    tutorial: 4,
    enemy: {
      name: '土灵妖兵',
      attr: 'earth',
      hp: 150,
      stamina: 150,
      metalAtk:4, woodAtk:4, earthAtk:14, waterAtk:4, fireAtk:4,
      metalDef:2, woodDef:2, earthDef:4, waterDef:2, fireDef:2,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_earth_1.jpg',
    },
    beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
    dropRate: 1.0,  // 100%掉落
    tutorialDrop: 'helmet_green_no_ult',  // 标记：固定掉落绿装头盔无绝技
    specialCond: null,
  })

  // 第5关：绝技教学，掉落绿装项链带绝技
  levels.push({
    levelId: 5,
    theme: 'tutorial',
    bg: 'theme_metal',
    name: '新手引导·仙术释放',
    tutorial: 5,
    enemy: {
      name: '金灵妖兵',
      attr: 'metal',
      hp: 180,
      stamina: 180,
      metalAtk:5, woodAtk:4, earthAtk:4, waterAtk:4, fireAtk:16,
      metalDef:3, woodDef:2, earthDef:2, waterDef:2, fireDef:2,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_metal_1.jpg',
    },
    beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
    dropRate: 1.0,  // 100%掉落
    tutorialDrop: 'trinket_green_with_ult',  // 标记：固定掉落绿装项链带绝技
    specialCond: null,
  })

  return levels
}

/**
 * 生成五行秘境关卡
 */
// 五行属性→绝技映射
const ATTR_ULT_MAP = {
  metal: 'metal_fury', wood: 'wood_drain', earth: 'earth_quake',
  water: 'water_prison', fire: 'fire_inferno',
}

function _genThemeLevels(attr, startId) {
  const an = ATTR_NAME[attr]
  const levels = []
  for (let i = 1; i <= 10; i++) {
    const baseHp = 120 + i * 65
    // 怪物攻击力提升：让战斗更有压力
    const baseAtk = 12 + i * 5
    const baseDef = 2 + i * 1
    const atkStats = {}; const defStats = {}
    ATTRS.forEach(a => {
      const atkKey = ATK_KEY[a], defKey = DEF_KEY[a]
      if (a === attr) {
        atkStats[atkKey] = Math.round(baseAtk * 1.3)
        defStats[defKey] = Math.round(baseDef * 1.2)
      } else {
        atkStats[atkKey] = Math.round(baseAtk * 0.4)
        defStats[defKey] = Math.round(baseDef * 0.3)
      }
    })
    const skills = []
    if (i >= 4) skills.push({ ...ENEMY_SKILLS.atkBuff, triggerTurn: 3 })
    if (i >= 6) skills.push({ ...ENEMY_SKILLS.seal, triggerTurn: 4 })
    if (i >= 8) skills.push({ ...ENEMY_SKILLS.poison, val: 15 + i*4, triggerTurn: 2 })
    if (i === 10) skills.push({ ...ENEMY_SKILLS.aoe, val: 50 + i*10, triggerTurn: 5 })

    // 怪物绝技：第3层开始拥有绝技，回合越高触发越快
    const ults = []
    if (i >= 3) {
      ults.push({ ...ENEMY_ULTS[ATTR_ULT_MAP[attr]], triggerTurn: i <= 5 ? 5 : i <= 8 ? 4 : 3 })
    }
    if (i >= 7) {
      ults.push({ ...ENEMY_ULTS.berserk, triggerTurn: 6 })
    }
    if (i === 10) {
      ults.push({ ...ENEMY_ULTS.regen, triggerTurn: 5 })
    }

    levels.push({
      levelId: startId + i,
      theme: attr,
      bg: `theme_${attr}`,   // 战斗背景主题标识
      name: `${an}灵秘境·第${i}层`,
      enemy: {
        name: `${an}灵${i<=3?'妖兵':i<=6?'妖将':i<=9?'妖王':'妖帝'}`,
        attr,
        hp: baseHp,
        stamina: baseHp,  // 怪物气力=血量
        ...atkStats,
        ...defStats,
        recovery: 0,
        skills,
        ults,  // 怪物绝技
        avatar: `assets/enemies/enemy_${attr}_${i<=3?1:i<=6?2:3}.jpg`,
      },
      beadWeights: _themeWeights(attr),
      dropRate: 0.15 + i * 0.03,
      specialCond: i === 10 ? { type:'turnLimit', turns:15, reward:'extraEquip' } : null,
    })
  }
  return levels
}

function _themeWeights(attr) {
  const w = {}
  BEAD_ATTRS.forEach(a => {
    if (a === 'heart') w[a] = 12
    else if (a === attr) w[a] = 45
    else w[a] = 10
  })
  return w
}

// 混沌秘境关卡
function _genMixedLevels() {
  const levels = []
  for (let i = 1; i <= 10; i++) {
    const baseHp = 280 + i * 110
    const baseAtk = 18 + i * 7
    const baseDef = 3 + i * 2
    const enemyAttr = ATTRS[(i - 1) % 5]
    // 混沌怪物：所有五行攻防均衡偏高
    const atkStats = {}; const defStats = {}
    ATTRS.forEach(a => {
      atkStats[ATK_KEY[a]] = Math.round(baseAtk * 0.8)
      defStats[DEF_KEY[a]] = Math.round(baseDef * 0.6)
    })
    // 自身属性稍高
    atkStats[ATK_KEY[enemyAttr]] = Math.round(baseAtk * 1.2)
    defStats[DEF_KEY[enemyAttr]] = Math.round(baseDef * 0.9)

    const skills = [
      { ...ENEMY_SKILLS.convert, triggerTurn: 2 },
      { ...ENEMY_SKILLS.defDown, triggerTurn: 3 },
    ]
    if (i >= 4) skills.push({ ...ENEMY_SKILLS.healBlock, triggerTurn: 4 })
    if (i >= 7) skills.push({ ...ENEMY_SKILLS.aoe, val: 70 + i*12, triggerTurn: 3 })

    // 混沌秘境绝技：更早出现，更多绝技
    const ults = []
    if (i >= 2) {
      ults.push({ ...ENEMY_ULTS[ATTR_ULT_MAP[enemyAttr]], triggerTurn: i <= 4 ? 5 : 4 })
    }
    if (i >= 5) {
      ults.push({ ...ENEMY_ULTS.berserk, triggerTurn: 5 })
    }
    if (i >= 7) {
      ults.push({ ...ENEMY_ULTS.chaos_field, triggerTurn: 6 })
    }
    if (i >= 9) {
      ults.push({ ...ENEMY_ULTS.regen, triggerTurn: 4 })
    }

    levels.push({
      levelId: 600 + i,
      theme: 'mixed',
      bg: 'theme_mixed',    // 混沌秘境背景
      name: `混沌秘境·第${i}层`,
      enemy: {
        name: `混沌${i<=5?'妖兽':'魔尊'}`,
        attr: enemyAttr,
        hp: baseHp,
        stamina: baseHp,
        ...atkStats,
        ...defStats,
        recovery: 0,
        skills,
        ults,  // 怪物绝技
        avatar: `assets/enemies/enemy_mixed_${i<=5?1:2}.jpg`,
      },
      beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
      dropRate: 0.25 + i * 0.03,
      specialCond: i >= 8 ? { type:'comboReq', count:5, reward:'extraEquip' } : null,
    })
  }
  return levels
}

// 生成全部关卡：新手引导5关 + 5个五行秘境 + 混沌秘境
const ALL_LEVELS = [
  ..._genTutorialLevels(),
  ..._genThemeLevels('metal', 100),
  ..._genThemeLevels('wood',  200),
  ..._genThemeLevels('earth', 300),
  ..._genThemeLevels('water', 400),
  ..._genThemeLevels('fire',  500),
  ..._genMixedLevels(),
]

function getLevelData(levelId, difficulty) {
  const base = ALL_LEVELS.find(l => l.levelId === levelId)
  if (!base) return null
  // 新手引导关不做难度缩放
  if (base.tutorial) {
    return { ...base, difficulty: 'normal', tier: 'low' }
  }
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal
  const e = base.enemy
  // 复制并按难度缩放五行攻防
  const scaled = { ...e, hp: Math.round(e.hp * diff.hpMul), stamina: Math.round((e.stamina||e.hp) * diff.hpMul) }
  ATTRS.forEach(a => {
    const ak = ATK_KEY[a], dk = DEF_KEY[a]
    scaled[ak] = Math.round((e[ak] || 0) * diff.atkMul)
    scaled[dk] = Math.round((e[dk] || 0) * diff.defMul)
  })
  scaled.skills = diff.id === 'normal' ? e.skills.filter(s => s.triggerTurn >= 4) :
                  diff.id === 'hard' ? e.skills :
                  [...e.skills, { ...ENEMY_SKILLS.aoe, val: Math.round((e[ATK_KEY[e.attr]]||50)*0.8), triggerTurn: 2 }]
  // 绝技：练气只保留第一个，筑基全部，金丹绝技冷却-1
  const rawUlts = e.ults || []
  scaled.ults = diff.id === 'normal' ? rawUlts.slice(0, 1) :
                diff.id === 'hard' ? rawUlts :
                rawUlts.map(u => ({ ...u, triggerTurn: Math.max(2, u.triggerTurn - 1) }))
  return { ...base, difficulty: diff.id, tier: diff.tier, enemy: scaled }
}

function getThemeLevels(theme) {
  return ALL_LEVELS.filter(l => l.theme === theme)
}

function getAllThemes() {
  return [
    ...ATTRS.map(a => ({ id: a, name: ATTR_NAME[a]+'灵秘境', levels: 10 })),
    { id: 'mixed', name: '混沌秘境', levels: 10 },
  ]
}

module.exports = {
  DIFFICULTY, ENEMY_SKILLS, ENEMY_ULTS, TUTORIAL_TIPS, ALL_LEVELS,
  getLevelData, getThemeLevels, getAllThemes,
}
