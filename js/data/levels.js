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
  extreme: { id:'extreme', name:'元婴', hpMul:2.5, atkMul:2.2, defMul:1.8, color:'#ff4d6a', tier:'high' },
}

// 妖兽技能池（被动/周期技能）
const ENEMY_SKILLS = {
  atkBuff:   { name:'妖气暴涨', desc:'攻击提升30%,持续2回合', type:'buff', field:'atk', rate:0.3, dur:2 },
  poison:    { name:'瘴毒', desc:'每回合造成{val}点伤害,持续3回合', type:'dot', dur:3 },
  seal:      { name:'禁珠咒', desc:'随机封锁2颗灵珠,持续2回合', type:'seal', count:2, dur:2 },
  convert:   { name:'灵脉紊乱', desc:'随机转换3颗灵珠属性', type:'convert', count:3 },
  aoe:       { name:'妖力横扫', desc:'对修士造成{val}点伤害', type:'aoe' },
  defDown:   { name:'碎甲爪', desc:'降低修士防御30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵术', desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
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
    id:'water_prison', name:'玄冰牢笼', attr:'water',
    desc:'玄冰禁锢，造成{pct}%伤害并封锁3颗灵珠2回合',
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
    id:'chaos_field', name:'混沌法域', attr:'neutral',
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
      '上一关获得了新法冠，已在结算时佩戴',
      '装备会增加属性（攻/防/气力/回复）',
      '注意观察佩戴新装备后属性变化',
      '更好的装备让你的修士更强大',
    ],
  },
  5: {
    title: '绝技释放',
    tips: [
      '上一关获得的法珠附带绝技（仙术）',
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
      name: '木灵野鬼',
      attr: 'wood',
      hp: 60,
      stamina: 60,
      metalAtk:2, woodAtk:5, earthAtk:2, waterAtk:2, fireAtk:2,
      metalDef:1, woodDef:2, earthDef:1, waterDef:1, fireDef:1,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_wood_1.jpg',
    },
    // 无心珠，只有五行珠
    beadWeights: { metal:20, wood:20, earth:20, water:20, fire:20, heart:0 },
    dropConfig: null,
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
      name: '火灵野鬼',
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
    dropConfig: null,
    specialCond: null,
  })

  // 第3关：心珠回复教学 — 怪攻击很高，让玩家感受到回血的必要性
  // 胜利后掉落灵器法冠（无绝技），供第4关换装教学使用
  levels.push({
    levelId: 3,
    theme: 'tutorial',
    bg: 'theme_water',
    name: '新手引导·气血回复',
    tutorial: 3,
    enemy: {
      name: '水灵野鬼',
      attr: 'water',
      hp: 100,
      stamina: 100,
      metalAtk:8, woodAtk:8, earthAtk:8, waterAtk:25, fireAtk:8,
      metalDef:1, woodDef:1, earthDef:1, waterDef:2, fireDef:1,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_water_1.jpg',
    },
    // 加入心珠
    beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
    dropConfig: null,
    tutorialDrop: 'helmet_green_no_ult',  // 第3关胜利掉灵器法冠（无绝技）→第4关换装
    specialCond: null,
  })

  // 第4关：装备教学 — 玩家已从第3关获得灵器法冠，本关教换装
  // 胜利后掉落灵器法珠（带绝技），供第5关绝技教学使用
  levels.push({
    levelId: 4,
    theme: 'tutorial',
    bg: 'theme_earth',
    name: '新手引导·装备强化',
    tutorial: 4,
    enemy: {
      name: '土灵游魂',
      attr: 'earth',
      hp: 140,
      stamina: 140,
      metalAtk:6, woodAtk:6, earthAtk:18, waterAtk:6, fireAtk:6,
      metalDef:2, woodDef:2, earthDef:4, waterDef:2, fireDef:2,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_earth_1.jpg',
    },
    beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
    dropConfig: null,
    tutorialDrop: 'trinket_green_with_ult',  // 第4关胜利掉绿装项链（带绝技）→第5关用
    specialCond: null,
  })

  // 第5关：绝技教学 — 玩家已从第4关获得带绝技的项链，本关教释放绝技
  levels.push({
    levelId: 5,
    theme: 'tutorial',
    bg: 'theme_metal',
    name: '新手引导·仙术释放',
    tutorial: 5,
    enemy: {
      name: '金灵游魂',
      attr: 'metal',
      hp: 180,
      stamina: 180,
      metalAtk:8, woodAtk:6, earthAtk:6, waterAtk:6, fireAtk:20,
      metalDef:3, woodDef:2, earthDef:2, waterDef:2, fireDef:2,
      recovery: 0,
      skills: [],
      ults: [],
      avatar: 'assets/enemies/enemy_metal_1.jpg',
    },
    beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
    dropConfig: null,
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
  const themeNames = { metal:'白虎矿脉', wood:'青龙古林', earth:'玄武山岳', water:'蛟龙深渊', fire:'朱雀火域' }
  const tn = themeNames[attr]
  const levels = []
  for (let i = 1; i <= 10; i++) {
    const isMiniBoss = (i === 5)   // 小精英：第5层
    const isBigBoss  = (i === 10)  // 大精英：第10层

    // 精英怪血量倍率：小精英×1.6，大精英×2.2
    const hpMul = isBigBoss ? 2.2 : isMiniBoss ? 1.6 : 1.0
    const baseHp = Math.round((200 + i * 90) * hpMul)
    // 精英怪攻防倍率：小精英×1.3，大精英×1.6
    const statMul = isBigBoss ? 1.6 : isMiniBoss ? 1.3 : 1.0
    const baseAtk = Math.round((12 + i * 5) * statMul)
    const baseDef = Math.round((2 + i * 1) * statMul)
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
    if (isBigBoss) skills.push({ ...ENEMY_SKILLS.aoe, val: 50 + i*10, triggerTurn: 5 })
    // 精英怪额外技能
    if (isMiniBoss) {
      skills.push({ ...ENEMY_SKILLS.defDown, triggerTurn: 3 })
      skills.push({ ...ENEMY_SKILLS.convert, triggerTurn: 4 })
    }
    if (isBigBoss) {
      skills.push({ ...ENEMY_SKILLS.healBlock, triggerTurn: 3 })
      skills.push({ ...ENEMY_SKILLS.seal, triggerTurn: 3 })
    }

    // 怪物绝技：精英怪更早拥有绝技且更频繁
    const ults = []
    if (isMiniBoss || isBigBoss) {
      // 精英必定拥有属性绝技，触发更快
      ults.push({ ...ENEMY_ULTS[ATTR_ULT_MAP[attr]], triggerTurn: isBigBoss ? 3 : 4 })
      ults.push({ ...ENEMY_ULTS.berserk, triggerTurn: isBigBoss ? 4 : 5 })
      if (isBigBoss) {
        ults.push({ ...ENEMY_ULTS.regen, triggerTurn: 5 })
      }
    } else {
      if (i >= 3) {
        ults.push({ ...ENEMY_ULTS[ATTR_ULT_MAP[attr]], triggerTurn: i <= 5 ? 5 : i <= 8 ? 4 : 3 })
      }
      if (i >= 7) {
        ults.push({ ...ENEMY_ULTS.berserk, triggerTurn: 6 })
      }
    }

    // 怪物名称：低层朴素→高层威严，精英怪用专属称号
    let enemyName
    if (isBigBoss)  enemyName = `${an}灵·妖帝`
    else if (isMiniBoss) enemyName = `${an}灵·守山大妖`
    else if (i <= 3) enemyName = `${an}灵散妖`
    else if (i <= 6) enemyName = `${an}灵妖将`
    else enemyName = `${an}灵妖王`

    // 掉落配置：精英关使用特殊掉落
    let dropConfig, eliteDrop = null
    if (isMiniBoss) {
      // 小精英：普通掉落 + 专属精英装备掉落（概率60%）
      dropConfig = {
        qualityWeights: { white:30, green:40, blue:25, purple:5 },
        levelRange: [Math.max(1, i - 1), Math.min(30, i + 3)],
        attr: attr,
        count: 1,
      }
      eliteDrop = {
        type: 'mini_elite',
        dropRate: 0.6,           // 60%概率掉专属装备
        attr: attr,
        qualityWeights: { green:40, blue:40, purple:18, orange:2 },  // 品质更好
        levelRange: [Math.max(1, i), Math.min(30, i + 4)],
      }
    } else if (isBigBoss) {
      // 大精英：普通掉落 + 专属套装掉落（概率50%）
      dropConfig = {
        qualityWeights: { white:10, green:30, blue:35, purple:20, orange:5 },
        levelRange: [Math.max(1, i - 1), Math.min(30, i + 3)],
        attr: attr,
        count: 1,
      }
      eliteDrop = {
        type: 'big_boss',
        dropRate: 0.5,           // 50%概率掉套装件
        attr: attr,
        qualityWeights: { blue:35, purple:40, orange:25 },  // 高品质
        levelRange: [Math.max(1, i), Math.min(30, i + 5)],
        setCount: 1,             // 每次掉落1件套装（30%概率2件）
      }
    } else {
      dropConfig = {
        qualityWeights: i <= 3
          ? { white:60, green:35, blue:5 }
          : i <= 6
            ? { white:40, green:40, blue:18, purple:2 }
            : i <= 9
              ? { white:20, green:40, blue:30, purple:10 }
              : { white:10, green:30, blue:35, purple:20, orange:5 },
        levelRange: [Math.max(1, i - 1), Math.min(30, i + 3)],
        attr: attr,
        count: 1,
      }
    }

    levels.push({
      levelId: startId + i,
      theme: attr,
      bg: `theme_${attr}`,
      name: isMiniBoss ? `${tn}·守山大妖`
           : isBigBoss ? `${tn}·妖帝降临`
           : `${tn}·第${i}层`,
      elite: isMiniBoss ? 'mini' : isBigBoss ? 'boss' : null,  // 精英标记
      enemy: {
        name: enemyName,
        attr,
        hp: baseHp,
        stamina: baseHp,
        ...atkStats,
        ...defStats,
        recovery: isBigBoss ? Math.round(baseHp * 0.02) : 0,  // 大精英有少量回复
        skills,
        ults,
        avatar: `assets/enemies/enemy_${attr}_${isMiniBoss?2:isBigBoss?3:i<=3?1:i<=6?2:3}.jpg`,
      },
      beadWeights: _themeWeights(attr),
      dropConfig,
      eliteDrop,    // 精英专属掉落配置
      specialCond: isBigBoss ? { type:'turnLimit', turns:15, reward:'extraEquip' } : null,
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
    const isMiniBoss = (i === 5)
    const isBigBoss  = (i === 10)

    const hpMul = isBigBoss ? 2.2 : isMiniBoss ? 1.6 : 1.0
    const baseHp = Math.round((400 + i * 160) * hpMul)
    const statMul = isBigBoss ? 1.6 : isMiniBoss ? 1.3 : 1.0
    const baseAtk = Math.round((18 + i * 7) * statMul)
    const baseDef = Math.round((3 + i * 2) * statMul)
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
    // 精英额外技能
    if (isMiniBoss) {
      skills.push({ ...ENEMY_SKILLS.seal, triggerTurn: 3 })
    }
    if (isBigBoss) {
      skills.push({ ...ENEMY_SKILLS.poison, val: 30 + i*5, triggerTurn: 2 })
    }

    // 混沌秘境绝技
    const ults = []
    if (isMiniBoss || isBigBoss) {
      ults.push({ ...ENEMY_ULTS[ATTR_ULT_MAP[enemyAttr]], triggerTurn: isBigBoss ? 3 : 4 })
      ults.push({ ...ENEMY_ULTS.berserk, triggerTurn: isBigBoss ? 4 : 5 })
      if (isBigBoss) {
        ults.push({ ...ENEMY_ULTS.chaos_field, triggerTurn: 5 })
        ults.push({ ...ENEMY_ULTS.regen, triggerTurn: 4 })
      }
    } else {
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
    }

    // 怪物命名：低层→高层递进，精英用专属称号
    let enemyName
    if (isBigBoss) enemyName = '混沌·太古魔神'
    else if (isMiniBoss) enemyName = '混沌·噬灵魔将'
    else if (i <= 3) enemyName = '混沌妖兽'
    else if (i <= 6) enemyName = '混沌魔兵'
    else enemyName = '混沌魔尊'

    // 掉落配置
    let dropConfig, eliteDrop = null
    if (isMiniBoss) {
      dropConfig = {
        qualityWeights: { white:10, green:35, blue:35, purple:18, orange:2 },
        levelRange: [Math.max(1, i + 2), Math.min(30, i * 2 + 5)],
        count: 1,
      }
      eliteDrop = {
        type: 'mini_elite',
        dropRate: 0.65,
        attr: enemyAttr,
        qualityWeights: { green:25, blue:40, purple:28, orange:7 },
        levelRange: [Math.max(1, i + 2), Math.min(30, i * 2 + 5)],
      }
    } else if (isBigBoss) {
      dropConfig = {
        qualityWeights: { white:0, green:15, blue:35, purple:35, orange:15 },
        levelRange: [Math.max(1, i + 2), Math.min(30, i * 2 + 5)],
        count: 1,
      }
      eliteDrop = {
        type: 'big_boss',
        dropRate: 0.55,
        attr: enemyAttr,
        qualityWeights: { blue:25, purple:45, orange:30 },
        levelRange: [Math.max(1, i + 3), Math.min(30, i * 2 + 8)],
        setCount: 1,
      }
    } else {
      dropConfig = {
        qualityWeights: i <= 3
          ? { white:30, green:40, blue:25, purple:5 }
          : i <= 6
            ? { white:15, green:35, blue:35, purple:13, orange:2 }
            : i <= 9
              ? { white:5, green:25, blue:40, purple:25, orange:5 }
              : { white:0, green:15, blue:35, purple:35, orange:15 },
        levelRange: [Math.max(1, i + 2), Math.min(30, i * 2 + 5)],
        count: 1,
      }
    }

    levels.push({
      levelId: 600 + i,
      theme: 'mixed',
      bg: 'theme_mixed',
      name: isMiniBoss ? '混沌秘境·噬灵魔将'
           : isBigBoss ? '混沌秘境·太古魔神'
           : `混沌秘境·第${i}层`,
      elite: isMiniBoss ? 'mini' : isBigBoss ? 'boss' : null,
      enemy: {
        name: enemyName,
        attr: enemyAttr,
        hp: baseHp,
        stamina: baseHp,
        ...atkStats,
        ...defStats,
        recovery: isBigBoss ? Math.round(baseHp * 0.02) : 0,
        skills,
        ults,
        avatar: `assets/enemies/enemy_mixed_${isMiniBoss?2:isBigBoss?2:i<=5?1:2}.jpg`,
      },
      beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
      dropConfig,
      eliteDrop,
      specialCond: isBigBoss ? { type:'comboReq', count:5, reward:'extraEquip' } :
                   (i >= 8 ? { type:'comboReq', count:5, reward:'extraEquip' } : null),
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
  // 绝技：练气只保留第一个，筑基全部，元婴绝技冷却-1
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
  const themeNames = { metal:'白虎矿脉', wood:'青龙古林', earth:'玄武山岳', water:'蛟龙深渊', fire:'朱雀火域' }
  return [
    ...ATTRS.map(a => ({ id: a, name: themeNames[a], levels: 10 })),
    { id: 'mixed', name: '混沌秘境', levels: 10 },
  ]
}

module.exports = {
  DIFFICULTY, ENEMY_SKILLS, ENEMY_ULTS, TUTORIAL_TIPS, ALL_LEVELS,
  getLevelData, getThemeLevels, getAllThemes,
}
