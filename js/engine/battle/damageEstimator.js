const { buildDamageContext } = require('./damageContext')
const { calcTotalDamage } = require('./damageFormula')

function estimateDamage(g, overrides) {
  const ctx = buildDamageContext(g, overrides)
  const result = calcTotalDamage(ctx, { critMode: 'locked-only' })
  return {
    estTotalDmg: result.totalDmg,
    extraPct: result.extraPct,
    comboBonusPct: result.comboBonusPct,
    detail: result,
  }
}

module.exports = {
  estimateDamage,
}
