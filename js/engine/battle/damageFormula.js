const { getPetStarAtk } = require('../../data/pets')
const {
  COMBO_MUL_BREAKPOINTS,
  LOW_HP_BURST,
  CRIT_BASE_DMG,
  CRIT_MAX_RATE,
  ATK_REDUCE_FLOOR,
  NEXT_DMG_DOUBLE_MUL,
  LOW_HP_DMG_UP_DEFAULT_THRESHOLD,
} = require('../../data/balance/combat')
const { COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL } = require('../../data/tower')

function getComboMul(combo) {
  if (combo <= 1) return 1
  const bp = COMBO_MUL_BREAKPOINTS
  let mul = 1
  let prevMax = 1
  for (const tier of bp) {
    const max = tier.maxCombo || Infinity
    if (combo <= max) return mul + (combo - prevMax) * tier.rate
    mul += (max - prevMax) * tier.rate
    prevMax = max
  }
  return mul
}

function collectBuffMultipliers(ctx) {
  let buffAllDmgPct = 0
  let buffAllAtkPct = 0
  let buffComboDmgPct = 0
  let buffLowHpDmgPct = 0
  let debuffAtkReduce = 0
  const buffAttrDmgPct = {}

  ;(ctx.heroBuffs || []).forEach(b => {
    if (b.type === 'dmgBoost') buffAttrDmgPct[b.attr] = (buffAttrDmgPct[b.attr] || 0) + b.pct
    else if (b.type === 'allDmgUp') buffAllDmgPct += b.pct
    else if (b.type === 'allAtkUp') buffAllAtkPct += b.pct
    else if (b.type === 'comboDmgUp') buffComboDmgPct += b.pct
    else if (b.type === 'lowHpDmgUp') buffLowHpDmgPct += b.pct
    else if (b.type === 'debuff' && b.field === 'atk') debuffAtkReduce += b.rate
  })

  return {
    buffAllDmgPct,
    buffAllAtkPct,
    buffComboDmgPct,
    buffLowHpDmgPct,
    debuffAtkReduce,
    buffAttrDmgPct,
  }
}

function getEnemyDefense(ctx, options) {
  const opts = options || {}
  if (!ctx.enemy) return 0
  let eDef = ctx.enemy.def || 0
  if (opts.includeBuff === false) return eDef
  const defBuff = (ctx.enemyBuffs || []).find(b => b.type === 'buff' && b.field === 'def')
  if (defBuff) eDef = Math.round(eDef * (1 + defBuff.rate))
  return eDef
}

function calcCritFromCtx(ctx) {
  let critRate = 0
  let critDmg = CRIT_BASE_DMG
  const dmgMap = ctx.pendingDmgMap || {}

  ;(ctx.heroBuffs || []).forEach(b => {
    if (b.type === 'critBoost') critRate += b.pct
  })
  ;(ctx.heroBuffs || []).forEach(b => {
    if (b.type === 'guaranteeCrit') {
      if (!b.attr || dmgMap[b.attr] > 0) critRate = 100
    }
  })
  ;(ctx.heroBuffs || []).forEach(b => {
    if (b.type === 'critBoostPerCombo') critRate += b.pct * (ctx.combo || 0)
  })
  ;(ctx.heroBuffs || []).forEach(b => {
    if (b.type === 'critDmgUp') critDmg += b.pct
  })

  if (ctx.weapon && ctx.weapon.type === 'critAll') {
    critRate += ctx.weapon.critRate || 0
    critDmg += ctx.weapon.critDmg || 0
  }
  if (ctx.weapon && ctx.weapon.type === 'comboToCrit') {
    critRate += (ctx.weapon.pct || 5) * (ctx.combo || 0)
  }
  if (ctx.weapon && ctx.weapon.type === 'guaranteeCrit') {
    const maxCount = (ctx.pendingAttrMaxCount && ctx.pendingAttrMaxCount[ctx.weapon.attr]) || 0
    if (ctx.weapon.attr && dmgMap[ctx.weapon.attr] > 0 && (!ctx.weapon.minCount || maxCount >= ctx.weapon.minCount)) critRate = 100
  }

  critRate = Math.min(critRate, CRIT_MAX_RATE)
  return { critRate, critDmg }
}

function resolveCritFromCtx(ctx, options) {
  const opts = options || {}
  const mode = opts.mode || 'runtime'
  const usePendingCrit = opts.usePendingCrit !== false

  if (usePendingCrit && ctx.pendingCrit != null) {
    return {
      isCrit: !!ctx.pendingCrit,
      critMul: ctx.pendingCritMul || 1,
      critRate: null,
      critDmg: null,
      source: 'pending',
    }
  }

  const crit = calcCritFromCtx(ctx)
  if (mode === 'locked-only' || mode === 'none') {
    return {
      isCrit: false,
      critMul: 1,
      critRate: crit.critRate,
      critDmg: crit.critDmg,
      source: mode,
    }
  }

  if (mode === 'expected') {
    return {
      isCrit: false,
      critMul: 1 + (crit.critRate / 100) * (crit.critDmg / 100),
      critRate: crit.critRate,
      critDmg: crit.critDmg,
      source: 'expected',
    }
  }

  const isCrit = crit.critRate > 0 && (crit.critRate >= 100 || Math.random() * 100 < crit.critRate)
  return {
    isCrit,
    critMul: isCrit ? (1 + crit.critDmg / 100) : 1,
    critRate: crit.critRate,
    critDmg: crit.critDmg,
    source: 'runtime',
  }
}

function calcDamagePerAttr(ctx, attr, baseDmg, options) {
  const opts = options || {}
  const buff = opts.buffMultipliers || collectBuffMultipliers(ctx)
  const enemyDefense = opts.enemyDefense != null ? opts.enemyDefense : getEnemyDefense(ctx)
  const comboMul = opts.comboMul != null ? opts.comboMul : getComboMul(ctx.combo)
  const comboBonusMul = opts.comboBonusMul != null ? opts.comboBonusMul : (1 + ((ctx.runBuffs && ctx.runBuffs.comboDmgPct) || 0) / 100)
  const hpRatio = ctx.heroMaxHp > 0 ? ctx.heroHp / ctx.heroMaxHp : 1
  const applyDefense = opts.applyDefense !== false
  const critMul = opts.critMul != null ? opts.critMul : 1

  let dmg = baseDmg * comboMul * comboBonusMul
  if (buff.debuffAtkReduce > 0) dmg *= Math.max(ATK_REDUCE_FLOOR, 1 - buff.debuffAtkReduce)
  dmg *= 1 + ((ctx.runBuffs && ctx.runBuffs.allDmgPct) || 0) / 100
  dmg *= 1 + (((ctx.runBuffs && ctx.runBuffs.attrDmgPct) && ctx.runBuffs.attrDmgPct[attr]) || 0) / 100
  dmg *= 1 + buff.buffAllDmgPct / 100
  dmg *= 1 + buff.buffAllAtkPct / 100
  dmg *= 1 + (buff.buffAttrDmgPct[attr] || 0) / 100
  if (buff.buffComboDmgPct > 0 && ctx.combo > 1) dmg *= 1 + buff.buffComboDmgPct / 100
  if (buff.buffLowHpDmgPct > 0 && hpRatio <= 0.3) dmg *= 1 + buff.buffLowHpDmgPct / 100

  for (const b of LOW_HP_BURST) {
    if (hpRatio <= b.threshold) {
      dmg *= b.mul
      break
    }
  }

  if (ctx.weapon && ctx.weapon.type === 'attrDmgUp' && ctx.weapon.attr === attr) dmg *= 1 + ctx.weapon.pct / 100
  if (ctx.weapon && ctx.weapon.type === 'allAtkUp') dmg *= 1 + ctx.weapon.pct / 100
  if (ctx.weapon && ctx.weapon.type === 'attrPetAtkUp' && ctx.weapon.attr === attr) dmg *= 1 + ctx.weapon.pct / 100
  if (ctx.weapon && ctx.weapon.type === 'comboDmgUp') dmg *= 1 + ctx.weapon.pct / 100 * (ctx.combo > 1 ? 1 : 0)
  if (ctx.weapon && ctx.weapon.type === 'lowHpDmgUp' && hpRatio <= (ctx.weapon.threshold || LOW_HP_DMG_UP_DEFAULT_THRESHOLD) / 100) dmg *= 1 + ctx.weapon.pct / 100
  if (ctx.weapon && ctx.weapon.type === 'stunBonusDmg' && (ctx.enemyBuffs || []).some(b => b.type === 'stun')) dmg *= 1 + ctx.weapon.pct / 100
  if (((ctx.runBuffs && ctx.runBuffs.weaponBoostPct) || 0) > 0) dmg *= 1 + ctx.runBuffs.weaponBoostPct / 100
  if (ctx.nextDmgDouble) dmg *= NEXT_DMG_DOUBLE_MUL

  let isCounter = false
  let isCountered = false
  if (ctx.enemy) {
    const enemyAttr = ctx.enemy.attr
    if (COUNTER_MAP[attr] === enemyAttr) {
      dmg *= COUNTER_MUL
      dmg *= 1 + ((ctx.runBuffs && ctx.runBuffs.counterDmgPct) || 0) / 100
      isCounter = true
    } else if (COUNTER_BY[attr] === enemyAttr) {
      dmg *= COUNTERED_MUL
      isCountered = true
    }
  }

  if (applyDefense) {
    dmg = Math.max(0, dmg - enemyDefense)
    if (enemyDefense > 0 && ctx.weapon && ctx.weapon.type === 'ignoreDefPct' && ctx.weapon.attr === attr) {
      dmg += enemyDefense * ctx.weapon.pct / 100
    }
    ;(ctx.heroBuffs || []).forEach(b => {
      if (enemyDefense > 0 && b.type === 'ignoreDefPct' && b.attr === attr) dmg += enemyDefense * b.pct / 100
    })
  }

  dmg *= critMul
  dmg = Math.round(dmg)

  return {
    attr,
    dmg,
    isCounter,
    isCountered,
    enemyDefense,
  }
}

function calcHealFromCtx(ctx) {
  const pendingHeal = ctx.pendingHeal || 0
  if (pendingHeal <= 0) return 0
  return Math.round(pendingHeal * getComboMul(ctx.combo))
}

function calcTotalDamage(ctx, options) {
  const opts = options || {}
  const crit = resolveCritFromCtx(ctx, {
    mode: opts.critMode || 'runtime',
    usePendingCrit: opts.usePendingCrit !== false,
  })
  const buffMultipliers = collectBuffMultipliers(ctx)
  const comboMul = getComboMul(ctx.combo)
  const comboBonusPct = (ctx.runBuffs && ctx.runBuffs.comboDmgPct) || 0
  const comboBonusMul = 1 + comboBonusPct / 100
  const enemyDefense = getEnemyDefense(ctx)
  const attrBreakdown = []
  const counterAttrs = {}
  const counteredAttrs = {}
  let totalDmg = 0

  const pendingDmgMap = opts.pendingDmgMap || ctx.pendingDmgMap || {}
  for (const [attr, baseDmg] of Object.entries(pendingDmgMap)) {
    const detail = calcDamagePerAttr(ctx, attr, baseDmg, {
      buffMultipliers,
      enemyDefense,
      comboMul,
      comboBonusMul,
      critMul: crit.critMul,
      applyDefense: opts.applyDefense !== false,
    })
    attrBreakdown.push(detail)
    if (detail.isCounter) counterAttrs[attr] = true
    if (detail.isCountered) counteredAttrs[attr] = true
    if (detail.dmg > 0) totalDmg += detail.dmg
  }

  return {
    totalDmg,
    attrBreakdown,
    isCrit: crit.isCrit,
    critMul: crit.critMul,
    critRate: crit.critRate,
    critDmg: crit.critDmg,
    heal: calcHealFromCtx(ctx),
    comboMul,
    comboBonusPct,
    extraPct: Math.round((comboMul * comboBonusMul - 1) * 100),
    counterAttrs,
    counteredAttrs,
    enemyDefense,
    buffMultipliers,
  }
}

function calcPetDisplayBreakdown(ctx, options) {
  const opts = options || {}
  const comboMul = getComboMul(ctx.combo)
  const comboBonusMul = 1 + ((ctx.runBuffs && ctx.runBuffs.comboDmgPct) || 0) / 100
  const critMul = opts.critMul != null ? opts.critMul : 1
  const buff = opts.buffMultipliers || collectBuffMultipliers(ctx)
  const pets = ctx.pets || []
  const attrPetCount = {}

  pets.forEach(p => {
    attrPetCount[p.attr] = (attrPetCount[p.attr] || 0) + 1
  })

  return pets.map((pet, index) => {
    const totalBaseDmg = (ctx.pendingDmgMap && ctx.pendingDmgMap[pet.attr]) || 0
    if (totalBaseDmg <= 0) {
      return { index, attr: pet.attr, dmg: 0, isCounter: false, isCountered: false }
    }

    const sameAttrPets = pets.filter(p => p.attr === pet.attr)
    const totalAtk = sameAttrPets.reduce((sum, p) => sum + getPetStarAtk(p), 0)
    const ratio = totalAtk > 0 ? getPetStarAtk(pet) / totalAtk : 1 / attrPetCount[pet.attr]
    const hpRatio = ctx.heroMaxHp > 0 ? ctx.heroHp / ctx.heroMaxHp : 1
    let dmg = totalBaseDmg * ratio * comboMul * comboBonusMul

    dmg *= 1 + ((ctx.runBuffs && ctx.runBuffs.allDmgPct) || 0) / 100
    dmg *= 1 + (((ctx.runBuffs && ctx.runBuffs.attrDmgPct) && ctx.runBuffs.attrDmgPct[pet.attr]) || 0) / 100
    dmg *= 1 + buff.buffAllDmgPct / 100
    dmg *= 1 + buff.buffAllAtkPct / 100
    dmg *= 1 + (buff.buffAttrDmgPct[pet.attr] || 0) / 100
    if (buff.buffComboDmgPct > 0 && ctx.combo > 1) dmg *= 1 + buff.buffComboDmgPct / 100
    if (buff.buffLowHpDmgPct > 0 && hpRatio <= 0.3) dmg *= 1 + buff.buffLowHpDmgPct / 100

    for (const rule of LOW_HP_BURST) {
      if (hpRatio <= rule.threshold) {
        dmg *= rule.mul
        break
      }
    }

    if (ctx.weapon && ctx.weapon.type === 'attrDmgUp' && ctx.weapon.attr === pet.attr) dmg *= 1 + ctx.weapon.pct / 100
    if (ctx.weapon && ctx.weapon.type === 'allAtkUp') dmg *= 1 + ctx.weapon.pct / 100
    if (ctx.weapon && ctx.weapon.type === 'attrPetAtkUp' && ctx.weapon.attr === pet.attr) dmg *= 1 + ctx.weapon.pct / 100

    let isCounter = false
    let isCountered = false
    if (ctx.enemy) {
      const enemyAttr = ctx.enemy.attr
      if (COUNTER_MAP[pet.attr] === enemyAttr) {
        dmg *= COUNTER_MUL
        dmg *= 1 + ((ctx.runBuffs && ctx.runBuffs.counterDmgPct) || 0) / 100
        isCounter = true
      } else if (COUNTER_BY[pet.attr] === enemyAttr) {
        dmg *= COUNTERED_MUL
        isCountered = true
      }
    }

    dmg *= critMul
    dmg = Math.round(dmg)

    return {
      index,
      attr: pet.attr,
      dmg,
      isCounter,
      isCountered,
    }
  })
}

module.exports = {
  getComboMul,
  collectBuffMultipliers,
  getEnemyDefense,
  calcCritFromCtx,
  resolveCritFromCtx,
  calcDamagePerAttr,
  calcHealFromCtx,
  calcTotalDamage,
  calcPetDisplayBreakdown,
}
