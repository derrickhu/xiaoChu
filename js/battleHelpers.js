/**
 * 战斗辅助函数 — 从 Main 中提取的布局计算、动画触发、伤害处理
 * 通过 ViewEnv 获取屏幕常量，避免依赖 Main 的闭包变量
 */
const MusicMgr = require('./runtime/music')
const V = require('./views/env')
const { getBattleLayout: computeBattleLayout } = require('./views/battle/battleLayout')
const {
  emitNotice,
  emitFloat,
  emitShake,
  emitFlash,
  emitCast,
} = require('./engine/battle/fxEmitter')
const { DMG_IMMUNE_MIN, WEAPON_SHIELD_BOOST_DEFAULT, HERO_DEFENSE_REDUCTION_K } = require('./data/balance/combat')

/** 与战斗界面共用布局（含 eAreaBottom）；此处保留旧字段子集以兼容既有调用 */
function getBattleLayout() {
  const L = computeBattleLayout()
  const { boardPad, cellSize, boardH, boardTop, iconSize, teamBarH, teamBarY, hpBarY, eAreaTop } = L
  return { boardPad, cellSize, boardH, boardTop, iconSize, teamBarH, teamBarY, hpBarY, eAreaTop }
}

function getEnemyCenterY() {
  const L = getBattleLayout()
  const eAreaBottom = L.teamBarY - 4*V.S
  const eAreaH = eAreaBottom - L.eAreaTop
  return L.eAreaTop + eAreaH * 0.42
}

function playHeroAttack(g, skillName, attr, type) {
  emitCast(g, { kind: 'heroAttack', skillName, attr, type, targetY: getEnemyCenterY() })
}

function playEnemyAttack(g) {
  emitCast(g, { kind: 'enemyAttack' })
}

function playHealEffect(g) {
  emitCast(g, { kind: 'heal' })
}

/** 统一添加护盾（自动应用法宝 shieldBoost 加成） */
function addShield(g, val) {
  if (g.weapon && g.weapon.type === 'shieldBoost') {
    val = Math.round(val * (1 + (g.weapon.pct || WEAPON_SHIELD_BOOST_DEFAULT) / 100))
  }
  g.heroShield += val
  MusicMgr.playShieldGain()
  emitFloat(g, 'heroShieldGain', { val })
}

function getEffectiveHeroDefense(g) {
  if (!g) return 0
  let def = Math.max(0, Math.round(g.heroDefense || g._cultDefenseValue || 0))
  let buffPct = 0
  let downRate = 0
  ;(g.heroBuffs || []).forEach(b => {
    if (!b) return
    if (b.type === 'allDefUp') buffPct += b.pct || 0
    if (b.type === 'debuff' && b.field === 'def') downRate += b.rate || 0
  })
  if (buffPct > 0) def = Math.round(def * (1 + buffPct / 100))
  if (downRate > 0) def = Math.round(def * Math.max(0, 1 - downRate))
  return Math.max(0, def)
}

function applyHeroDefenseToDamage(g, dmg) {
  const raw = Math.max(0, Math.round(dmg || 0))
  if (raw <= 0) return { damage: 0, defense: getEffectiveHeroDefense(g), reduced: 0 }
  const defense = getEffectiveHeroDefense(g)
  if (defense <= 0) return { damage: raw, defense, reduced: 0 }
  const damage = Math.max(1, Math.ceil(raw * HERO_DEFENSE_REDUCTION_K / (HERO_DEFENSE_REDUCTION_K + defense)))
  return { damage, defense, reduced: Math.max(0, raw - damage) }
}

function getIncomingReducePct(g, opts) {
  if (opts && opts.applyReduce === false) return 0
  let pct = 0
  ;(g.heroBuffs || []).forEach(b => { if (b.type === 'reduceDmg') pct += b.pct || 0 })
  if (g.weapon && g.weapon.type === 'reduceDmg') pct += g.weapon.pct || 0
  if (g.weapon && g.weapon.type === 'reduceAttrAtkDmg' && g.enemy && g.enemy.attr === g.weapon.attr) pct += g.weapon.pct || 0
  if (g.runBuffs) {
    pct += g.runBuffs.dmgReducePct || 0
    if (g.runBuffs.nextDmgReducePct > 0) pct += g.runBuffs.nextDmgReducePct
  }
  if (opts && opts.source === 'skill' && g.weapon && g.weapon.type === 'reduceSkillDmg') {
    pct += g.weapon.pct || 0
  }
  return Math.max(0, Math.min(95, pct))
}

function resolveIncomingDamage(g, dmg, opts) {
  const o = opts || {}
  const defendable = o.defendable !== false
  const raw = Math.max(0, Math.round(dmg || 0))
  const defenseResult = defendable
    ? applyHeroDefenseToDamage(g, raw)
    : { damage: raw, defense: getEffectiveHeroDefense(g), reduced: 0 }
  const reducePct = getIncomingReducePct(g, o)
  const afterPct = reducePct > 0
    ? Math.max(0, Math.round(defenseResult.damage * (1 - reducePct / 100)))
    : defenseResult.damage
  return {
    rawDamage: raw,
    defense: defenseResult.defense,
    defenseReduced: defenseResult.reduced,
    reducePct,
    damage: afterPct,
  }
}

/** 对英雄造成伤害（含护盾、绝对防御、飘字） */
function dealDmgToHero(g, dmg, opts) {
  const immune = g.heroBuffs && g.heroBuffs.find(b => b.type === 'dmgImmune')
  const resolved = resolveIncomingDamage(g, dmg, opts)
  let resolvedDmg = resolved.damage
  if (immune && resolvedDmg > DMG_IMMUNE_MIN) resolvedDmg = DMG_IMMUNE_MIN
  const result = {
    incomingDamage: resolvedDmg,
    rawDamage: resolved.rawDamage,
    heroDefense: resolved.defense,
    defenseReduced: resolved.defenseReduced,
    reducePct: resolved.reducePct,
    actualDamage: 0,
    blockedByShield: false,
    fullyBlocked: false,
    shieldAbsorbed: 0,
    heroDied: false,
  }
  if (resolvedDmg <= 0) return result

  const { W, H } = V
  if (g.heroShield > 0) {
    if (resolvedDmg <= g.heroShield) {
      g.heroShield -= resolvedDmg
      result.blockedByShield = true
      result.fullyBlocked = true
      result.shieldAbsorbed = resolvedDmg
      emitNotice(g, { x:W*0.5, y:H*0.52, text:'完美抵挡！', color:'#40e8ff', scale:2.5, _initScale:2.5, big:true })
      emitFloat(g, 'heroShieldBlock', { dmg: resolvedDmg })
      emitShake(g, { t: 4, i: 2 })
      emitFlash(g, 'block', { timer: 8 })
      MusicMgr.playBlock()
      return result
    }
    const shieldAbs = g.heroShield
    resolvedDmg -= g.heroShield
    g.heroShield = 0
    result.blockedByShield = true
    result.shieldAbsorbed = shieldAbs
    emitNotice(g, { x:W*0.5, y:H*0.52, text:'护盾击碎！', color:'#ff9040', scale:2.0, _initScale:2.0 })
    emitFloat(g, 'heroShieldBreak', { shieldAbs })
  }
  if (resolvedDmg <= 0) return result

  const oldHp = g.heroHp
  const oldPct = oldHp / g.heroMaxHp
  g.heroHp = Math.max(0, oldHp - resolvedDmg)
  result.actualDamage = oldHp - g.heroHp
  result.heroDied = g.heroHp <= 0
  if (result.actualDamage > 0) {
    g._heroHpLoss = { fromPct: oldPct, timer: 0 }
    emitFloat(g, 'heroDmg', { dmg: result.actualDamage })
    // 逆风翻盘追踪：每次扣血后记录血量最低点（用于结算时判断是否是残血翻盘）
    //   注意：只记 heroDied=false 的状态（死了也无所谓，这里取 min 即可）
    const ratio = g.heroMaxHp > 0 ? g.heroHp / g.heroMaxHp : 1
    if (typeof g._heroMinHpRatio !== 'number' || ratio < g._heroMinHpRatio) {
      g._heroMinHpRatio = ratio
    }
  }
  return result
}

module.exports = {
  getBattleLayout,
  getEnemyCenterY,
  playHeroAttack,
  playEnemyAttack,
  playHealEffect,
  addShield,
  getEffectiveHeroDefense,
  applyHeroDefenseToDamage,
  resolveIncomingDamage,
  dealDmgToHero,
}
