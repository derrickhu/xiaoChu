const V = require('../../views/env')
const MusicMgr = require('../../runtime/music')
const { ATTR_COLOR } = require('../../data/tower')
const { getPetStarAtk } = require('../../data/pets')
const {
  SKILL_INSTANT_DMG_DEFAULT_PCT,
  SKILL_INSTANT_DMG_DOT_DEFAULT_PCT,
  SKILL_MULTI_HIT_DEFAULT_HITS,
  SKILL_MULTI_HIT_DEFAULT_PCT,
  SKILL_TEAM_ATTACK_DEFAULT_PCT,
  SKILL_INSTANT_DOT_TICK_DEFAULT,
  SPEED_KILL_TURNS,
} = require('../../data/balance/combat')
const { buildDamageContext } = require('./damageContext')
const { getEnemyDefense } = require('./damageFormula')
const { emitCast, emitFloat, emitShake } = require('./fxEmitter')
const { addKillExp } = require('../battle.js')

function getSkillColor(attr) {
  return (ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || V.TH.danger
}

function createBaseResult(ctx, payload, type) {
  const pet = payload.pet || {}
  const sk = payload.sk || {}
  return {
    handled: true,
    hasTarget: !!ctx.enemy,
    type,
    totalDmg: 0,
    entries: [],
    attackAttr: sk.type === 'teamAttack' ? pet.attr : (sk.attr || pet.attr),
    skillName: sk.name || '',
    attackType: 'burst',
    shake: null,
    heroHeal: 0,
    enemyBuffsToAdd: [],
    enemyKilled: false,
  }
}

function finishPetSkillKill(g) {
  addKillExp(g)
  g.lastTurnCount = g.turnCount
  g.lastSpeedKill = g.turnCount <= SPEED_KILL_TURNS
  g.runTotalTurns = (g.runTotalTurns || 0) + g.turnCount
  MusicMgr.playVictory()
  g.bState = 'victory'
  g._enemyDeathAnim = { timer: 0, duration: 45 }
}

function resolveInstantDmg(g, payload) {
  const ctx = buildDamageContext(g)
  const pet = payload.pet || {}
  const sk = payload.sk || {}
  const result = createBaseResult(ctx, payload, 'single')
  if (!ctx.enemy) return result

  let dmg = Math.round(getPetStarAtk(pet) * (sk.pct || SKILL_INSTANT_DMG_DEFAULT_PCT) / 100)
  dmg = Math.round(dmg * (1 + ((ctx.runBuffs && ctx.runBuffs.skillDmgPct) || 0) / 100))
  if (sk.ignoreDefPct) {
    const ignoreDef = Math.round(((ctx.enemy && ctx.enemy.def) || 0) * sk.ignoreDefPct / 100)
    dmg = Math.max(0, dmg + ignoreDef)
  }

  result.totalDmg = dmg
  result.entries.push({ dmg, color: getSkillColor(sk.attr) })
  if (sk.stunDur) result.enemyBuffsToAdd.push({ type:'stun', name:'眩晕', dur:sk.stunDur, bad:true })
  if (sk.teamHealPct) result.heroHeal = Math.round(ctx.heroMaxHp * sk.teamHealPct / 100)
  return result
}

function resolveInstantDmgDot(g, payload) {
  const ctx = buildDamageContext(g)
  const sk = payload.sk || {}
  const sMul = payload.sMul || 0
  const pet = payload.pet || {}
  const result = createBaseResult(ctx, payload, 'single')
  if (!ctx.enemy) return result

  let dmg = Math.round(getPetStarAtk(pet) * (sk.pct || SKILL_INSTANT_DMG_DOT_DEFAULT_PCT) / 100)
  dmg = Math.round(dmg * (1 + ((ctx.runBuffs && ctx.runBuffs.skillDmgPct) || 0) / 100))

  result.totalDmg = dmg
  result.entries.push({ dmg, color: getSkillColor(sk.attr) })
  result.enemyBuffsToAdd.push({
    type:'dot',
    name:'灼烧',
    dmg:Math.round((sk.dotDmg || SKILL_INSTANT_DOT_TICK_DEFAULT) * sMul),
    dur:sk.dotDur || 3,
    bad:true,
    dotType:'burn',
  })
  return result
}

function resolveMultiHit(g, payload) {
  const ctx = buildDamageContext(g)
  const pet = payload.pet || {}
  const sk = payload.sk || {}
  const result = createBaseResult(ctx, payload, 'multi')
  if (!ctx.enemy) return result

  const hits = sk.hits || SKILL_MULTI_HIT_DEFAULT_HITS
  const color = getSkillColor(sk.attr || pet.attr)
  let totalDmg = 0

  for (let hitIdx = 0; hitIdx < hits; hitIdx++) {
    let dmg = Math.round(getPetStarAtk(pet) * (sk.pct || SKILL_MULTI_HIT_DEFAULT_PCT) / 100)
    dmg = Math.round(dmg * (1 + ((ctx.runBuffs && ctx.runBuffs.skillDmgPct) || 0) / 100))
    totalDmg += dmg
    result.entries.push({ dmg, color, hitIdx, totalHits: hits })
  }

  result.totalDmg = totalDmg
  result.shake = { t: 10, i: 6 }
  return result
}

function resolveTeamAttack(g, payload) {
  const ctx = buildDamageContext(g)
  const sk = payload.sk || {}
  const result = createBaseResult(ctx, payload, 'team')
  if (!ctx.enemy) return result

  const pets = ctx.pets || []
  const totalPets = pets.length
  const enemyDefense = getEnemyDefense(ctx, { includeBuff: false })
  let totalDmg = 0

  pets.forEach((p, petIdx) => {
    let dmg = Math.round(getPetStarAtk(p) * (sk.pct || SKILL_TEAM_ATTACK_DEFAULT_PCT) / 100)
    dmg = Math.round(dmg * (1 + ((ctx.runBuffs && ctx.runBuffs.allAtkPct) || 0) / 100))
    dmg = Math.round(dmg * (1 + ((ctx.runBuffs && ctx.runBuffs.skillDmgPct) || 0) / 100))
    dmg = Math.max(0, dmg - enemyDefense)
    totalDmg += dmg
    result.entries.push({ dmg, color: getSkillColor(p.attr), petIdx, totalPets })
  })

  result.totalDmg = totalDmg
  return result
}

function resolveSkillDamage(g, payload) {
  const sk = (payload && payload.sk) || {}
  switch (sk.type) {
    case 'instantDmg':
      return resolveInstantDmg(g, payload)
    case 'instantDmgDot':
      return resolveInstantDmgDot(g, payload)
    case 'multiHit':
      return resolveMultiHit(g, payload)
    case 'teamAttack':
      return resolveTeamAttack(g, payload)
    default:
      return { handled: false, entries: [], totalDmg: 0, enemyKilled: false }
  }
}

function commitSkillDamage(g, result) {
  if (!result || !result.handled || !result.hasTarget || !g.enemy) {
    return { enemyKilled: false, result }
  }

  const oldEnemyHp = g.enemy.hp
  g.enemy.hp = Math.max(0, oldEnemyHp - result.totalDmg)
  const actualEnemyDamage = oldEnemyHp - g.enemy.hp
  if (actualEnemyDamage > 0) {
    g._enemyHpLoss = { fromPct: oldEnemyHp / g.enemy.maxHp, timer: 0, dmg: actualEnemyDamage }
  }
  emitCast(g, {
    kind: 'heroAttack',
    skillName: result.skillName,
    attr: result.attackAttr,
    type: result.attackType || 'burst',
  })

  if (result.shake) {
    emitShake(g, { t: result.shake.t, i: result.shake.i })
  }

  if (result.enemyBuffsToAdd && result.enemyBuffsToAdd.length > 0) {
    Array.prototype.push.apply(g.enemyBuffs, result.enemyBuffsToAdd)
  }

  if (result.heroHeal > 0) {
    const oldHeroHp = g.heroHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + result.heroHeal)
    const actualHeal = g.heroHp - oldHeroHp
    if (actualHeal > 0) {
      g._heroHpGain = { fromPct: oldHeroHp / g.heroMaxHp, timer: 0 }
      emitCast(g, { kind: 'heal' })
      emitFloat(g, 'heroHeal', { amt: actualHeal })
    }
  }

  result.enemyKilled = g.enemy.hp <= 0
  if (result.enemyKilled) finishPetSkillKill(g)
  return { enemyKilled: result.enemyKilled, result }
}

module.exports = {
  resolveSkillDamage,
  commitSkillDamage,
}
