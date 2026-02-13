/**
 * 关卡系统 - 6灵根秘境×10关 + 混沌秘境
 * 适配修仙消消乐玩法
 * 怪物五维属性：hp/pAtk/mAtk/pDef/mDef
 */
const { ATTRS, ATTR_NAME } = require('./equipment')

// 难度倍率
const DIFFICULTY = {
  normal:  { id:'normal',  name:'练气', hpMul:1,   atkMul:1,   defMul:1,   color:'#4dcc4d', tier:'low' },
  hard:    { id:'hard',    name:'筑基', hpMul:1.8, atkMul:1.8, defMul:1.5, color:'#ff8c00', tier:'mid' },
  extreme: { id:'extreme', name:'金丹', hpMul:3,   atkMul:3,   defMul:2.5, color:'#ff4d6a', tier:'high' },
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
 * 生成灵根秘境关卡
 * 每个灵根10关，妖兽以该灵根为主
 * 妖兽属性：hp/pAtk/mAtk/pDef/mDef
 */
function _genThemeLevels(attr, startId) {
  const an = ATTR_NAME[attr]
  // 不同灵根的属性倾向
  const attrBias = {
    fire:  { pAtkBias:1.3, mAtkBias:0.8, pDefBias:0.8, mDefBias:0.9 },
    water: { pAtkBias:0.8, mAtkBias:1.3, pDefBias:0.9, mDefBias:1.2 },
    wood:  { pAtkBias:0.9, mAtkBias:1.0, pDefBias:1.2, mDefBias:1.0 },
    light: { pAtkBias:1.0, mAtkBias:1.2, pDefBias:1.0, mDefBias:0.8 },
    dark:  { pAtkBias:1.2, mAtkBias:1.1, pDefBias:0.7, mDefBias:1.0 },
    heart: { pAtkBias:0.7, mAtkBias:0.7, pDefBias:1.3, mDefBias:1.3 },
  }
  const bias = attrBias[attr] || { pAtkBias:1, mAtkBias:1, pDefBias:1, mDefBias:1 }
  const levels = []
  for (let i = 1; i <= 10; i++) {
    const baseHp = 800 + i * 400
    const basePAtk = Math.round((30 + i * 15) * bias.pAtkBias)
    const baseMAtk = Math.round((25 + i * 12) * bias.mAtkBias)
    const basePDef = Math.round((10 + i * 8) * bias.pDefBias)
    const baseMDef = Math.round((8 + i * 7) * bias.mDefBias)
    const skills = []
    if (i >= 4) skills.push({ ...ENEMY_SKILLS.atkBuff, triggerTurn: 3 })
    if (i >= 6) skills.push({ ...ENEMY_SKILLS.seal, triggerTurn: 4 })
    if (i >= 8) skills.push({ ...ENEMY_SKILLS.poison, val: 50 + i*10, triggerTurn: 2 })
    if (i === 10) skills.push({ ...ENEMY_SKILLS.aoe, val: 200 + i*30, triggerTurn: 5 })

    levels.push({
      levelId: startId + i,
      theme: attr,
      name: `${an}灵秘境·第${i}层`,
      enemy: {
        name: `${an}灵${i<=3?'妖兵':i<=6?'妖将':i<=9?'妖王':'妖帝'}`,
        attr,
        hp: baseHp,
        pAtk: basePAtk,
        mAtk: baseMAtk,
        pDef: basePDef,
        mDef: baseMDef,
        atk: basePAtk + baseMAtk,  // 兼容旧字段
        skills,
        avatar: `assets/enemies/enemy_${attr}_${i<=3?1:i<=6?2:3}.png`,
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
  ATTRS.forEach(a => w[a] = a === attr ? 50 : 10)
  return w
}

// 混沌秘境关卡（高阶挑战，均匀分布）
function _genMixedLevels() {
  const levels = []
  for (let i = 1; i <= 10; i++) {
    const baseHp = 2000 + i * 600
    const basePAtk = 60 + i * 20
    const baseMAtk = 50 + i * 18
    const basePDef = 25 + i * 12
    const baseMDef = 20 + i * 10
    const enemyAttr = ATTRS[(i - 1) % 6]
    const skills = [
      { ...ENEMY_SKILLS.convert, triggerTurn: 2 },
      { ...ENEMY_SKILLS.defDown, triggerTurn: 3 },
    ]
    if (i >= 4) skills.push({ ...ENEMY_SKILLS.healBlock, triggerTurn: 4 })
    if (i >= 7) skills.push({ ...ENEMY_SKILLS.aoe, val: 300 + i*40, triggerTurn: 3 })

    levels.push({
      levelId: 700 + i,
      theme: 'mixed',
      name: `混沌秘境·第${i}层`,
      enemy: {
        name: `混沌${i<=5?'妖兽':'魔尊'}`,
        attr: enemyAttr,
        hp: baseHp,
        pAtk: basePAtk,
        mAtk: baseMAtk,
        pDef: basePDef,
        mDef: baseMDef,
        atk: basePAtk + baseMAtk,  // 兼容旧字段
        skills,
        avatar: `assets/enemies/enemy_mixed_${i<=5?1:2}.png`,
      },
      beadWeights: { fire:17, water:17, wood:17, light:17, dark:16, heart:16 },
      dropRate: 0.25 + i * 0.03,
      specialCond: i >= 8 ? { type:'comboReq', count:5, reward:'extraEquip' } : null,
    })
  }
  return levels
}

// 生成全部关卡
const ALL_LEVELS = [
  ..._genThemeLevels('fire', 100),
  ..._genThemeLevels('water', 200),
  ..._genThemeLevels('wood', 300),
  ..._genThemeLevels('light', 400),
  ..._genThemeLevels('dark', 500),
  ..._genThemeLevels('heart', 600),
  ..._genMixedLevels(),
]

/**
 * 获取关卡数据（含难度加成）
 */
function getLevelData(levelId, difficulty) {
  const base = ALL_LEVELS.find(l => l.levelId === levelId)
  if (!base) return null
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal
  const e = base.enemy
  return {
    ...base,
    difficulty: diff.id,
    tier: diff.tier,
    enemy: {
      ...e,
      hp: Math.round(e.hp * diff.hpMul),
      pAtk: Math.round((e.pAtk || 0) * diff.atkMul),
      mAtk: Math.round((e.mAtk || 0) * diff.atkMul),
      pDef: Math.round((e.pDef || 0) * diff.defMul),
      mDef: Math.round((e.mDef || 0) * diff.defMul),
      atk: Math.round((e.atk || 0) * diff.atkMul),
      skills: diff.id === 'normal' ? e.skills.filter(s => s.triggerTurn >= 4) :
              diff.id === 'hard' ? e.skills :
              [...e.skills, { ...ENEMY_SKILLS.aoe, val: Math.round((e.pAtk||e.atk)*0.8), triggerTurn: 2 }],
    },
  }
}

/**
 * 获取主题关卡列表
 */
function getThemeLevels(theme) {
  return ALL_LEVELS.filter(l => l.theme === theme)
}

/**
 * 获取所有主题
 */
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
