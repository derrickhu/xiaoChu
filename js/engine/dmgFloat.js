/**
 * 伤害飘字工厂 — 集中管理所有飘字的位置、样式、缩放参数
 * 
 * 【修改飘字视觉效果只需调整 FLOAT_CFG 配置表】
 * 
 * 锚点说明：
 *   - 对敌类飘字：以「敌方血条上沿」为锚点，dy 负值 = 向上偏移
 *   - 对主角类飘字：以「屏幕高度百分比」yR 定位（0=顶部，1=底部）
 * 
 * 单位：dy/dx/gap 均为逻辑像素，运行时自动乘以 S（缩放因子）
 */
const V = require('../views/env')

// 属性图标（用于飘字前缀）
const ATTR_ICON = { metal:'⚔️', wood:'🌿', earth:'🪨', water:'💧', fire:'🔥', heart:'❤️' }

// ===== 飘字视觉配置表 =====
const FLOAT_CFG = {
  // --- 对敌伤害（锚点：敌方血条上沿） ---
  enemyTotal:      { dy: -10,  scale: 1.5, critScale: 1.8, tag: '回合伤害' },
  elimDmg:         { dy: 10,   attrDx: { metal:-60, wood:-30, water:0, fire:30, earth:60, heart:0 } },
  petSkill:        { dy: -15,  dx: -40, scale: 0.9, tag: '技能' },
  petMultiHit:     { dy: -20,  hGap: 45, scale: 0.85, tag: '连击' },
  petTeamAtk:      { dy: -20,  hGap: 50, scale: 0.85, tag: '群攻' },
  aoeDmg:          { dy: -35,  dx: 40, scale: 0.9, tag: '法宝' },
  dotOnEnemy:      { dy: -45,  hGap: 30, scale: 0.75 },
  reflectToEnemy:  { dy: -55,  dx: 50, scale: 0.9, tag: '反弹' },
  enemyHeal:       { dy: -10,  tag: '敌方回血' },

  // --- 对主角效果（锚点：屏幕高度百分比） ---
  heroHeal:        { yR: 0.65, xSpread: 0.2, tag: '回复' },
  heroDmg:         { yR: 0.70, tag: '受击' },
  heroShieldGain:  { yR: 0.65 },
  heroShieldBlock: { yR: 0.60, scale: 1.6 },
  heroShieldBreak: { yR: 0.60, scale: 1.4 },
  eventCost:       { yR: 0.35, scale: 1.1, tag: '代价' },
}

// 获取敌方血条上沿 Y 坐标（延迟加载 battleHelpers，避免循环依赖）
function _enemyHpY() {
  const bh = require('../battleHelpers')
  const L = bh.getBattleLayout()
  const eAreaBottom = L.teamBarY - 4 * V.S
  return eAreaBottom - 26 * V.S
}

// ==================== 对敌伤害飘字 ====================

/** 回合总伤害（居中，最醒目） */
function enemyTotalDmg(g, dmg, isCrit) {
  const { W, S } = V
  const c = FLOAT_CFG.enemyTotal
  g.dmgFloats.push({
    x: W * 0.5, y: _enemyHpY() + c.dy * S,
    text: `-${dmg}`, color: isCrit ? '#ffdd00' : '#ff2222',
    t: 0, alpha: 1, scale: isCrit ? c.critScale : c.scale,
    tag: c.tag
  })
}

/** 消除预伤害飘字（按属性水平偏移，避免重叠） */
function elimDmg(g, text, color, attr, baseScale) {
  const { W, S } = V
  const c = FLOAT_CFG.elimDmg
  const offsetX = ((c.attrDx[attr]) || 0) * S
  g.elimFloats.push({
    x: W * 0.5 + offsetX, y: _enemyHpY() + c.dy * S,
    text, color,
    t: 0, alpha: 1, scale: baseScale, _baseScale: baseScale
  })
}

/** 宠物技能单体伤害 */
function petSkillDmg(g, dmg, color) {
  const { W, S } = V
  const c = FLOAT_CFG.petSkill
  g.dmgFloats.push({
    x: W * 0.5 + (c.dx || 0) * S, y: _enemyHpY() + c.dy * S,
    text: `🐾${dmg}`, color,
    t: 0, alpha: 1, scale: c.scale, tag: c.tag
  })
}

/** 宠物连击伤害（水平排列，hitIdx 从 0 开始） */
function petMultiHitDmg(g, dmg, color, hitIdx, totalHits) {
  const { W, S } = V
  const c = FLOAT_CFG.petMultiHit
  g.dmgFloats.push({
    x: W * 0.5 + (hitIdx - (totalHits - 1) / 2) * c.hGap * S,
    y: _enemyHpY() + c.dy * S,
    text: `🐾${dmg}`, color,
    t: hitIdx * 4, alpha: 1, scale: c.scale,
    tag: hitIdx === 0 ? c.tag : undefined
  })
}

/** 宠物群攻伤害（按宠物位置水平排列） */
function petTeamAtkDmg(g, dmg, color, petIdx, totalPets) {
  const { W, S } = V
  const c = FLOAT_CFG.petTeamAtk
  g.dmgFloats.push({
    x: W * 0.5 + (petIdx - (totalPets - 1) / 2) * c.hGap * S,
    y: _enemyHpY() + c.dy * S,
    text: `🐾${dmg}`, color,
    t: 0, alpha: 1, scale: c.scale,
    tag: petIdx === 0 ? c.tag : undefined
  })
}

/** AOE 法宝伤害 */
function aoeDmg(g, dmg, color) {
  const { W, S } = V
  const c = FLOAT_CFG.aoeDmg
  g.dmgFloats.push({
    x: W * 0.5 + (c.dx || 0) * S, y: _enemyHpY() + c.dy * S,
    text: `💥${dmg}`, color,
    t: 0, alpha: 1, scale: c.scale, tag: c.tag
  })
}

/** 敌人身上 DOT 结算伤害（idx 用于水平偏移避免重叠） */
function dotOnEnemy(g, dmg, dotType, idx) {
  const { W, S } = V
  const c = FLOAT_CFG.dotOnEnemy
  const icon = dotType === 'burn' ? '🔥' : '☠️'
  const tagText = dotType === 'burn' ? '灼烧' : '中毒'
  g.dmgFloats.push({
    x: W * 0.5 + idx * (c.hGap || 30) * S, y: _enemyHpY() + c.dy * S,
    text: `${icon}${dmg}`, color: '#a040a0',
    t: 0, alpha: 1, scale: c.scale, tag: idx === 0 ? tagText : undefined
  })
}

/** 护体反弹伤害 */
function reflectToEnemy(g, dmg, color) {
  const { W, S } = V
  const c = FLOAT_CFG.reflectToEnemy
  g.dmgFloats.push({
    x: W * 0.5 + (c.dx || 0) * S, y: _enemyHpY() + c.dy * S,
    text: `🛡️${dmg}`, color: color || '#40b8e0',
    t: 0, alpha: 1, scale: c.scale, tag: c.tag
  })
}

/** 敌方回血 */
function enemyHeal(g, amt) {
  const { W, S } = V
  const c = FLOAT_CFG.enemyHeal
  g.dmgFloats.push({
    x: W * 0.5, y: _enemyHpY() + c.dy * S,
    text: `+${amt}`, color: '#80ff80',
    t: 0, alpha: 1, tag: c.tag
  })
}

// ==================== 主角相关飘字 ====================

/** 主角回复（带随机水平偏移） */
function heroHeal(g, amt, color) {
  const { W, H } = V
  const c = FLOAT_CFG.heroHeal
  const spread = c.xSpread || 0.2
  g.dmgFloats.push({
    x: W * (0.5 - spread / 2) + Math.random() * W * spread, y: H * c.yR,
    text: `❤️+${amt}`, color: color || '#4dcc4d',
    t: 0, alpha: 1, tag: c.tag
  })
}

/** 主角受伤 */
function heroDmg(g, dmg, color) {
  const { W, H, TH } = V
  const c = FLOAT_CFG.heroDmg
  g.dmgFloats.push({
    x: W * 0.5, y: H * c.yR,
    text: `-${dmg}`, color: color || (TH && TH.danger) || '#ff4444',
    t: 0, alpha: 1, tag: c.tag
  })
}

/** 获得护盾 */
function heroShieldGain(g, val) {
  const { W, H } = V
  const c = FLOAT_CFG.heroShieldGain
  g.dmgFloats.push({
    x: W * 0.5, y: H * c.yR,
    text: `+${val}盾`, color: '#7ddfff',
    t: 0, alpha: 1
  })
}

/** 护盾完美抵挡 */
function heroShieldBlock(g, dmg) {
  const { W, H } = V
  const c = FLOAT_CFG.heroShieldBlock
  g.dmgFloats.push({
    x: W * 0.5, y: H * c.yR,
    text: `护盾吸收 ${dmg}`, color: '#7ddfff',
    t: 0, alpha: 1, scale: c.scale
  })
}

/** 护盾击碎后盾挡部分 */
function heroShieldBreak(g, shieldAbs) {
  const { W, H } = V
  const c = FLOAT_CFG.heroShieldBreak
  g.dmgFloats.push({
    x: W * 0.45, y: H * c.yR,
    text: `盾挡 ${shieldAbs}`, color: '#40b8e0',
    t: 0, alpha: 1, scale: c.scale
  })
}

/** 事件扣血 */
function eventCost(g, cost) {
  const { W, H } = V
  const c = FLOAT_CFG.eventCost
  g.dmgFloats.push({
    x: W * 0.5, y: H * c.yR,
    text: `-${cost} HP`, color: '#ff4444',
    t: 0, alpha: 1, scale: c.scale, tag: c.tag
  })
}

module.exports = {
  FLOAT_CFG, ATTR_ICON,
  enemyTotalDmg, elimDmg,
  petSkillDmg, petMultiHitDmg, petTeamAtkDmg,
  aoeDmg, dotOnEnemy, reflectToEnemy, enemyHeal,
  heroHeal, heroDmg,
  heroShieldGain, heroShieldBlock, heroShieldBreak,
  eventCost,
}
