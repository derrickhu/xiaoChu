const { buildDamageContext } = require('./damageContext')
const {
  getComboMul,
  collectBuffMultipliers,
  getEnemyDefense,
  calcCritFromCtx,
  resolveCritFromCtx,
  calcDamagePerAttr,
  calcHealFromCtx,
  calcTotalDamage,
  calcPetDisplayBreakdown,
} = require('./damageFormula')
const { estimateDamage } = require('./damageEstimator')
const { resolveSkillDamage, commitSkillDamage } = require('./skillDamageResolver')
const {
  getAttrColor,
  getEnemyCenterY,
  emitNotice,
  emitFloat,
  emitShake,
  emitFlash,
  emitCast,
  emitPetSkillIntro,
} = require('./fxEmitter')

module.exports = {
  buildDamageContext,
  getComboMul,
  collectBuffMultipliers,
  getEnemyDefense,
  calcCritFromCtx,
  resolveCritFromCtx,
  calcDamagePerAttr,
  calcHealFromCtx,
  calcTotalDamage,
  calcPetDisplayBreakdown,
  estimateDamage,
  resolveSkillDamage,
  commitSkillDamage,
  getAttrColor,
  getEnemyCenterY,
  emitNotice,
  emitFloat,
  emitShake,
  emitFlash,
  emitCast,
  emitPetSkillIntro,
}
