/**
 * ★4 觉醒被动配置
 *
 * 设计原则：
 * - 被动数量保持少，玩家容易理解。
 * - 品质只影响数值强弱，具体被动按宠物技能定位分配。
 * - 队伍级效果必须有上限，避免多只同类宠物叠出失控数值。
 */

const PASSIVE_BY_RARITY = {
  R: {
    skillDmgPct: 8,
    attrDmgPct: 8,
    controlDmgPct: 8,
    swiftCdReduce: 1,
    swiftMinCd: 2,
    guardShieldPct: 5,
    guardShieldFlat: 10,
    dominanceShieldPct: 4,
    dominanceShieldFlat: 8,
  },
  SR: {
    skillDmgPct: 12,
    attrDmgPct: 12,
    controlDmgPct: 12,
    swiftCdReduce: 1,
    swiftMinCd: 2,
    guardShieldPct: 7,
    guardShieldFlat: 16,
    dominanceShieldPct: 5,
    dominanceShieldFlat: 12,
  },
  SSR: {
    skillDmgPct: 16,
    attrDmgPct: 16,
    controlDmgPct: 15,
    swiftCdReduce: 1,
    swiftMinCd: 2,
    guardShieldPct: 9,
    guardShieldFlat: 24,
    dominanceShieldPct: 7,
    dominanceShieldFlat: 18,
  },
}

const STAR4_LIMITS = {
  attrDmgPct: 40,
  controlDmgPct: 30,
  guardShieldPct: 25,
  guardShieldFlat: 120,
  dominanceShieldPct: 14,
  dominanceShieldFlat: 60,
}

const CONTROL_TYPES = new Set(['stun', 'stunDot', 'stunPlusDmg', 'stunBreakDef'])
const GUARD_TYPES = new Set([
  'healPct', 'healFlat', 'shield', 'shieldPlus', 'hpMaxUp',
  'reflectPct', 'allDefUp', 'revive', 'revivePlus',
])
const DOMINANCE_TYPES = new Set(['immuneCtrl', 'immuneShield', 'purify'])
const SPECIALIST_TYPES = new Set([
  'convertBead', 'convertRow', 'convertCol', 'convertCross',
  'replaceBeads', 'beadRateUp', 'extraTime', 'extraTimePlus',
  'comboPlus', 'comboPlusNeverBreak', 'comboNeverBreakPlus',
  'comboNeverBreak',
])
// 只有这些类型会进入主动技能直伤结算，才能吃到“强攻”的技能伤害乘区。
const STRONG_TYPES = new Set([
  'instantDmg', 'instantDmgDot', 'multiHit', 'teamAttack',
])
const SWIFT_TYPES = new Set([
  'dmgBoost', 'ignoreDefFull', 'allDmgUp', 'allAtkUp',
  'critBoost', 'critDmgUp', 'guaranteeCrit', 'lowHpDmgUp',
  'warGod', 'comboDmgUp', 'dot',
])

function clamp(value, max) {
  return Math.max(0, Math.min(max, value || 0))
}

function getPassiveValues(rarity) {
  return PASSIVE_BY_RARITY[rarity] || PASSIVE_BY_RARITY.R
}

function getStar4PassiveKind(pet) {
  const type = pet && pet.skill && pet.skill.type
  const skill = (pet && pet.skill) || {}
  if (DOMINANCE_TYPES.has(type)) return 'dominance'
  if (GUARD_TYPES.has(type)) return 'guard'
  if (CONTROL_TYPES.has(type)) return 'control'
  if (skill.toAttr === 'heart' || skill.defBoost || skill.regen || skill.heartBoost || skill.healPct) return 'guard'
  if (SWIFT_TYPES.has(type) || skill.dmgBoost || skill.atkBoost || skill.comboDmgPct) return 'swift'
  if (SPECIALIST_TYPES.has(type)) return 'specialist'
  if (STRONG_TYPES.has(type)) return 'strong'
  return 'specialist'
}

function getStar4PassiveForPet(pet, rarity) {
  const values = getPassiveValues(rarity)
  const kind = getStar4PassiveKind(pet)
  const attr = pet && pet.attr

  if (kind === 'strong') {
    return {
      type: 'skillDmgUp',
      kind,
      name: '强攻',
      pct: values.skillDmgPct,
      desc: `该宠主动技能伤害+${values.skillDmgPct}%`,
    }
  }
  if (kind === 'control') {
    return {
      type: 'controlDmgUp',
      kind,
      name: '镇魂',
      pct: values.controlDmgPct,
      cap: STAR4_LIMITS.controlDmgPct,
      desc: `敌人被眩晕或冰冻时，全队伤害+${values.controlDmgPct}%（上限${STAR4_LIMITS.controlDmgPct}%）`,
    }
  }
  if (kind === 'swift') {
    return {
      type: 'skillCdAfterCastDown',
      kind,
      name: '迅捷',
      cdReduce: values.swiftCdReduce,
      minCd: values.swiftMinCd,
      desc: `主动技能使用后，冷却-${values.swiftCdReduce}回合（最低${values.swiftMinCd}回合）`,
    }
  }
  if (kind === 'guard') {
    return {
      type: 'startShield',
      kind,
      name: '守护',
      shieldPct: values.guardShieldPct,
      shieldFlat: values.guardShieldFlat,
      desc: `开场获得护盾（生命${values.guardShieldPct}%+${values.guardShieldFlat}点，可累计有上限）`,
    }
  }
  if (kind === 'dominance') {
    return {
      type: 'debuffImmuneOnce',
      kind,
      name: '霸体',
      shieldPct: values.dominanceShieldPct,
      shieldFlat: values.dominanceShieldFlat,
      desc: `每场免疫首次控制或减益，并获得护盾（多只只提高护盾）`,
    }
  }
  return {
    type: 'attrDmgUp',
    kind: 'specialist',
    name: '专精',
    attr,
    pct: values.attrDmgPct,
    cap: STAR4_LIMITS.attrDmgPct,
    desc: `该宠属性消除伤害+${values.attrDmgPct}%（同属性上限${STAR4_LIMITS.attrDmgPct}%）`,
  }
}

function makeEmptyStar4PassiveState() {
  return {
    skillDmgPctByPetId: {},
    cdReduceByPetId: {},
    cdMinByPetId: {},
    attrDmgPct: { metal: 0, wood: 0, water: 0, fire: 0, earth: 0 },
    controlDmgPct: 0,
    guardShield: 0,
    dominanceCharges: 0,
    dominanceShield: 0,
    sources: [],
  }
}

function calcShieldAmount(heroMaxHp, shieldPct, shieldFlat) {
  return Math.max(0, Math.round((heroMaxHp || 0) * (shieldPct || 0) / 100) + (shieldFlat || 0))
}

function buildStar4PassiveState(pets, getRarity, heroMaxHp) {
  const state = makeEmptyStar4PassiveState()
  let guardPct = 0
  let guardFlat = 0
  let dominancePct = 0
  let dominanceFlat = 0

  ;(pets || []).forEach(pet => {
    if (!pet || (pet.star || 1) < 4) return
    const rarity = typeof getRarity === 'function' ? getRarity(pet.id) : 'R'
    const passive = getStar4PassiveForPet(pet, rarity)
    state.sources.push({ petId: pet.id, passive })

    if (passive.type === 'skillDmgUp') {
      state.skillDmgPctByPetId[pet.id] = Math.max(state.skillDmgPctByPetId[pet.id] || 0, passive.pct || 0)
    } else if (passive.type === 'skillCdAfterCastDown') {
      state.cdReduceByPetId[pet.id] = Math.max(state.cdReduceByPetId[pet.id] || 0, passive.cdReduce || 0)
      state.cdMinByPetId[pet.id] = Math.max(state.cdMinByPetId[pet.id] || 0, passive.minCd || 0)
    } else if (passive.type === 'attrDmgUp' && pet.attr) {
      state.attrDmgPct[pet.attr] = clamp((state.attrDmgPct[pet.attr] || 0) + (passive.pct || 0), STAR4_LIMITS.attrDmgPct)
    } else if (passive.type === 'controlDmgUp') {
      state.controlDmgPct = clamp(state.controlDmgPct + (passive.pct || 0), STAR4_LIMITS.controlDmgPct)
    } else if (passive.type === 'startShield') {
      guardPct = clamp(guardPct + (passive.shieldPct || 0), STAR4_LIMITS.guardShieldPct)
      guardFlat = clamp(guardFlat + (passive.shieldFlat || 0), STAR4_LIMITS.guardShieldFlat)
    } else if (passive.type === 'debuffImmuneOnce') {
      state.dominanceCharges = 1
      dominancePct = clamp(dominancePct + (passive.shieldPct || 0), STAR4_LIMITS.dominanceShieldPct)
      dominanceFlat = clamp(dominanceFlat + (passive.shieldFlat || 0), STAR4_LIMITS.dominanceShieldFlat)
    }
  })

  state.guardShield = calcShieldAmount(heroMaxHp, guardPct, guardFlat)
  state.dominanceShield = calcShieldAmount(heroMaxHp, dominancePct, dominanceFlat)
  return state
}

function consumeStar4Dominance(g) {
  const state = g && g.star4Passives
  if (!state || state.dominanceCharges <= 0) return false
  state.dominanceCharges--
  if (state.dominanceShield > 0) {
    g.heroShield = (g.heroShield || 0) + state.dominanceShield
  }
  return true
}

module.exports = {
  PASSIVE_BY_RARITY,
  STAR4_LIMITS,
  getStar4PassiveForPet,
  buildStar4PassiveState,
  consumeStar4Dominance,
}
