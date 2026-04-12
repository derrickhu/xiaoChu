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

function getIgnoreDefensePct(ctx, attr) {
  let ignorePct = 0
  if (ctx.weapon && ctx.weapon.type === 'ignoreDefPct' && ctx.weapon.attr === attr) {
    ignorePct += ctx.weapon.pct || 0
  }
  ;(ctx.heroBuffs || []).forEach(b => {
    if (b.type === 'ignoreDefPct' && b.attr === attr) ignorePct += b.pct || 0
  })
  return Math.max(0, Math.min(100, ignorePct))
}

function calcAttrPreDefense(ctx, attr, baseDmg, options) {
  const opts = options || {}
  const buff = opts.buffMultipliers || collectBuffMultipliers(ctx)
  const comboMul = opts.comboMul != null ? opts.comboMul : getComboMul(ctx.combo)
  const comboBonusMul = opts.comboBonusMul != null ? opts.comboBonusMul : (1 + ((ctx.runBuffs && ctx.runBuffs.comboDmgPct) || 0) / 100)
  const hpRatio = ctx.heroMaxHp > 0 ? ctx.heroHp / ctx.heroMaxHp : 1

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

  return {
    attr,
    baseDmg,
    preDefenseDmg: Math.max(0, dmg),
    ignoreDefensePct: getIgnoreDefensePct(ctx, attr),
    isCounter,
    isCountered,
  }
}

function allocateDefenseShares(details, enemyDefense) {
  const shares = new Array(details.length)
  for (let i = 0; i < shares.length; i++) shares[i] = 0
  if (!(enemyDefense > 0) || !details || details.length === 0) return shares

  let remainingDefense = enemyDefense
  let active = details.map((detail, index) => ({
    index,
    preDefenseDmg: Math.max(0, detail.preDefenseDmg || 0),
    defenseFactor: Math.max(0, 1 - (detail.ignoreDefensePct || 0) / 100),
  })).filter(item => item.preDefenseDmg > 0 && item.defenseFactor > 0)

  while (remainingDefense > 0.0001 && active.length > 0) {
    const totalWeight = active.reduce((sum, item) => sum + item.preDefenseDmg * item.defenseFactor, 0)
    if (totalWeight <= 0) break

    let consumed = 0
    const nextActive = []
    for (let i = 0; i < active.length; i++) {
      const item = active[i]
      const maxAbsorb = Math.max(0, item.preDefenseDmg - shares[item.index])
      if (maxAbsorb <= 0.0001) continue
      const candidate = remainingDefense * (item.preDefenseDmg * item.defenseFactor) / totalWeight
      const applied = Math.min(maxAbsorb, candidate)
      shares[item.index] += applied
      consumed += applied
      if (maxAbsorb - applied > 0.0001) nextActive.push(item)
    }

    if (consumed <= 0.0001) break
    remainingDefense -= consumed
    active = nextActive
  }

  return shares
}

function finalizeAttrDamage(detail, enemyDefense, defenseShare, critMul) {
  let dmg = Math.max(0, (detail.preDefenseDmg || 0) - Math.max(0, defenseShare || 0))
  dmg *= critMul
  dmg = Math.round(dmg)
  return {
    attr: detail.attr,
    dmg,
    isCounter: !!detail.isCounter,
    isCountered: !!detail.isCountered,
    enemyDefense,
    defenseShare: defenseShare || 0,
    ignoreDefensePct: detail.ignoreDefensePct || 0,
    preDefenseDmg: detail.preDefenseDmg || 0,
  }
}

function resolveAttrDamageBreakdown(ctx, options) {
  const opts = options || {}
  const buffMultipliers = opts.buffMultipliers || collectBuffMultipliers(ctx)
  const comboMul = opts.comboMul != null ? opts.comboMul : getComboMul(ctx.combo)
  const comboBonusMul = opts.comboBonusMul != null ? opts.comboBonusMul : (1 + ((ctx.runBuffs && ctx.runBuffs.comboDmgPct) || 0) / 100)
  const enemyDefense = opts.enemyDefense != null ? opts.enemyDefense : getEnemyDefense(ctx)
  const critMul = opts.critMul != null ? opts.critMul : 1
  const pendingDmgMap = opts.pendingDmgMap || ctx.pendingDmgMap || {}
  const applyDefense = opts.applyDefense !== false

  const preDetails = []
  for (const [attr, baseDmg] of Object.entries(pendingDmgMap)) {
    preDetails.push(calcAttrPreDefense(ctx, attr, baseDmg, {
      buffMultipliers,
      comboMul,
      comboBonusMul,
    }))
  }

  const defenseShares = applyDefense ? allocateDefenseShares(preDetails, enemyDefense) : new Array(preDetails.length).fill(0)
  const attrBreakdown = preDetails.map((detail, index) => finalizeAttrDamage(detail, enemyDefense, defenseShares[index], critMul))

  const counterAttrs = {}
  const counteredAttrs = {}
  let totalDmg = 0
  for (let i = 0; i < attrBreakdown.length; i++) {
    const detail = attrBreakdown[i]
    if (detail.isCounter) counterAttrs[detail.attr] = true
    if (detail.isCountered) counteredAttrs[detail.attr] = true
    if (detail.dmg > 0) totalDmg += detail.dmg
  }

  return {
    totalDmg,
    attrBreakdown,
    counterAttrs,
    counteredAttrs,
    enemyDefense,
    buffMultipliers,
    comboMul,
    comboBonusMul,
  }
}

function calcDamagePerAttr(ctx, attr, baseDmg, options) {
  const opts = options || {}
  const enemyDefense = opts.enemyDefense != null ? opts.enemyDefense : getEnemyDefense(ctx)
  const critMul = opts.critMul != null ? opts.critMul : 1
  const detail = calcAttrPreDefense(ctx, attr, baseDmg, opts)
  const defenseShare = opts.applyDefense === false
    ? 0
    : enemyDefense * Math.max(0, 1 - (detail.ignoreDefensePct || 0) / 100)
  return finalizeAttrDamage(detail, enemyDefense, defenseShare, critMul)
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
  const pendingDmgMap = opts.pendingDmgMap || ctx.pendingDmgMap || {}
  const resolved = resolveAttrDamageBreakdown(ctx, {
    pendingDmgMap,
    enemyDefense: opts.enemyDefense,
    buffMultipliers: opts.buffMultipliers,
    comboMul: opts.comboMul,
    comboBonusMul: opts.comboBonusMul,
    critMul: crit.critMul,
    applyDefense: opts.applyDefense !== false,
  })

  return {
    totalDmg: resolved.totalDmg,
    attrBreakdown: resolved.attrBreakdown,
    isCrit: crit.isCrit,
    critMul: crit.critMul,
    critRate: crit.critRate,
    critDmg: crit.critDmg,
    heal: calcHealFromCtx(ctx),
    comboMul: resolved.comboMul,
    comboBonusPct: Math.round((resolved.comboBonusMul - 1) * 100),
    extraPct: Math.round((resolved.comboMul * resolved.comboBonusMul - 1) * 100),
    counterAttrs: resolved.counterAttrs,
    counteredAttrs: resolved.counteredAttrs,
    enemyDefense: resolved.enemyDefense,
    buffMultipliers: resolved.buffMultipliers,
  }
}

function calcPetDisplayBreakdown(ctx, options) {
  const opts = options || {}
  const pets = ctx.pets || []
  const pendingDmgMap = (ctx && ctx.pendingDmgMap) || {}
  const critMul = opts.critMul != null ? opts.critMul : 1
  const breakdown = pets.map((pet, index) => ({ index, attr: pet.attr, dmg: 0, isCounter: false, isCountered: false }))

  const petsByAttr = {}
  pets.forEach((pet, index) => {
    if (!petsByAttr[pet.attr]) petsByAttr[pet.attr] = []
    petsByAttr[pet.attr].push({ pet, index })
  })

  const resolved = resolveAttrDamageBreakdown(ctx, {
    pendingDmgMap,
    enemyDefense: opts.enemyDefense,
    buffMultipliers: opts.buffMultipliers,
    comboMul: opts.comboMul,
    comboBonusMul: opts.comboBonusMul,
    critMul,
    applyDefense: opts.applyDefense !== false,
  })
  const detailsByAttr = {}
  resolved.attrBreakdown.forEach(detail => {
    detailsByAttr[detail.attr] = detail
  })

  Object.entries(pendingDmgMap).forEach(([attr, baseDmg]) => {
    const attrPets = petsByAttr[attr] || []
    if (baseDmg <= 0 || attrPets.length === 0) return

    const detail = detailsByAttr[attr] || { dmg: 0, isCounter: false, isCountered: false }
    const totalAttrDmg = Math.max(0, Math.round(detail.dmg || 0))
    const totalAtk = attrPets.reduce((sum, item) => sum + getPetStarAtk(item.pet), 0)
    const unitRatio = totalAtk > 0 ? null : 1 / attrPets.length
    const shares = attrPets.map(item => {
      const ratio = unitRatio == null ? (getPetStarAtk(item.pet) / totalAtk) : unitRatio
      const raw = totalAttrDmg * ratio
      const dmg = Math.floor(raw)
      return {
        index: item.index,
        raw,
        dmg,
        frac: raw - dmg,
      }
    })

    let remainder = totalAttrDmg - shares.reduce((sum, item) => sum + item.dmg, 0)
    shares.sort((a, b) => {
      if (b.frac !== a.frac) return b.frac - a.frac
      return a.index - b.index
    })
    for (let i = 0; i < shares.length && remainder > 0; i++, remainder--) {
      shares[i].dmg += 1
    }

    shares.forEach(item => {
      breakdown[item.index] = {
        index: item.index,
        attr,
        dmg: item.dmg,
        isCounter: detail.isCounter,
        isCountered: detail.isCountered,
      }
    })
  })

  return breakdown
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
