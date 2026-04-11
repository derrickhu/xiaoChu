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
const { DMG_IMMUNE_MIN, WEAPON_SHIELD_BOOST_DEFAULT } = require('./data/balance/combat')

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

/** 对英雄造成伤害（含护盾、绝对防御、飘字） */
function dealDmgToHero(g, dmg) {
  const immune = g.heroBuffs && g.heroBuffs.find(b => b.type === 'dmgImmune')
  let resolvedDmg = Math.max(0, dmg || 0)
  if (immune && resolvedDmg > DMG_IMMUNE_MIN) resolvedDmg = DMG_IMMUNE_MIN
  const result = {
    incomingDamage: resolvedDmg,
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
  }
  return result
}

module.exports = { getBattleLayout, getEnemyCenterY, playHeroAttack, playEnemyAttack, playHealEffect, addShield, dealDmgToHero }
