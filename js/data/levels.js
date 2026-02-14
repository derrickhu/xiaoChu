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

// 妖兽技能池
const ENEMY_SKILLS = {
  atkBuff:   { name:'妖气暴涨', desc:'攻击提升30%,持续2回合', type:'buff', field:'atk', rate:0.3, dur:2 },
  poison:    { name:'毒瘴', desc:'每回合造成{val}点伤害,持续3回合', type:'dot', dur:3 },
  seal:      { name:'封灵', desc:'随机封锁2颗灵珠,持续2回合', type:'seal', count:2, dur:2 },
  convert:   { name:'灵气紊乱', desc:'随机转换3颗灵珠属性', type:'convert', count:3 },
  aoe:       { name:'妖力横扫', desc:'对修士造成{val}点伤害', type:'aoe' },
  defDown:   { name:'破甲爪', desc:'降低修士防御30%,持续2回合', type:'debuff', field:'def', rate:0.3, dur:2 },
  healBlock: { name:'噬灵', desc:'心珠回复量减半,持续3回合', type:'debuff', field:'healRate', rate:0.5, dur:3 },
}

/**
 * 生成五行秘境关卡
 */
function _genThemeLevels(attr, startId) {
  const an = ATTR_NAME[attr]
  const levels = []
  for (let i = 1; i <= 10; i++) {
    const baseHp = 500 + i * 250
    // 怪物的五行攻防：自身属性最高，其他较低
    const baseAtk = 25 + i * 12
    const baseDef = 5 + i * 4
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
    if (i >= 8) skills.push({ ...ENEMY_SKILLS.poison, val: 50 + i*10, triggerTurn: 2 })
    if (i === 10) skills.push({ ...ENEMY_SKILLS.aoe, val: 200 + i*30, triggerTurn: 5 })

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
    const baseHp = 1200 + i * 400
    const baseAtk = 45 + i * 18
    const baseDef = 12 + i * 6
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
    if (i >= 7) skills.push({ ...ENEMY_SKILLS.aoe, val: 300 + i*40, triggerTurn: 3 })

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
        avatar: `assets/enemies/enemy_mixed_${i<=5?1:2}.jpg`,
      },
      beadWeights: { metal:16, wood:16, earth:16, water:16, fire:16, heart:20 },
      dropRate: 0.25 + i * 0.03,
      specialCond: i >= 8 ? { type:'comboReq', count:5, reward:'extraEquip' } : null,
    })
  }
  return levels
}

// 生成全部关卡：5个五行秘境 + 混沌秘境
const ALL_LEVELS = [
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
  DIFFICULTY, ENEMY_SKILLS, ALL_LEVELS,
  getLevelData, getThemeLevels, getAllThemes,
}
