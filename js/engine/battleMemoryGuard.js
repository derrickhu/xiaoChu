/**
 * 战斗内存保护
 *
 * 长局登塔容易在飘字、技能特效、离屏纹理和图片缓存上形成峰值。
 * 这里统一做两件事：给战斗临时数组设硬上限，以及在过层/离场/内存告警时集中清理。
 */
const Particles = require('./particles')
const FXComposer = require('./effectComposer')

const EFFECT_LIMITS = {
  dmgFloats: 48,
  skillEffects: 24,
  elimFloats: 36,
  petSlotFloats: 40,
  comboParticles: 80,
  expFloats: 8,
}

function _trimList(list, max, deadKey) {
  if (!Array.isArray(list)) return list
  if (list.length <= max) return list
  const alive = []
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (!item || (deadKey && item[deadKey])) continue
    alive.push(item)
  }
  if (alive.length > max) alive.splice(0, alive.length - max)
  list.length = 0
  for (let i = 0; i < alive.length; i++) list.push(alive[i])
  return list
}

function enforceBattleEffectLimits(g) {
  if (!g) return
  _trimList(g.dmgFloats, EFFECT_LIMITS.dmgFloats, '_dead')
  _trimList(g.skillEffects, EFFECT_LIMITS.skillEffects, '_dead')
  _trimList(g.elimFloats, EFFECT_LIMITS.elimFloats, '_dead')
  _trimList(g._petSlotFloats, EFFECT_LIMITS.petSlotFloats, '_dead')
  _trimList(g._comboParticles, EFFECT_LIMITS.comboParticles, '_dead')
  _trimList(g._expFloats, EFFECT_LIMITS.expFloats, '_dead')
}

function clearBattleTransientState(g, opts) {
  if (!g) return
  const o = opts || {}
  g.dmgFloats = []
  g.skillEffects = []
  g.elimFloats = []
  g._petSlotFloats = []
  g._comboParticles = []
  g._expFloats = []
  g._beadConvertAnim = null
  g._enemyDeathAnim = null
  g._comboFlashMeta = null
  g._counterFlash = null
  g._enemyHpLoss = null
  g._heroHpLoss = null
  g._heroHpGain = null
  g._screenFlash = 0
  g._enemyTintFlash = 0
  g._enemyHitFlash = 0
  g._heroHurtFlash = 0
  g._blockFlash = 0
  g.shakeT = 0
  g._hitStopFrames = 0
  Particles.clear()
  if (o.clearTex) {
    Particles.clearTexCache()
    FXComposer.clearSpotTexCache()
  }
  if (o.lowMemory) {
    g._battleFxQuality = 'lite'
    g._battleFxLowMemory = true
  }
}

function getSnapshot(g, render, tag) {
  const img = render && render.getImageCacheDebugStats ? render.getImageCacheDebugStats() : {}
  return {
    tag,
    scene: g && g.scene,
    bState: g && g.bState,
    battleMode: g && g.battleMode,
    floor: g && g.floor,
    imgCount: img.imgCount || 0,
    imgMax: img.imgMax || 0,
    keepCount: img.keepCount || 0,
    gradCount: img.gradCount || 0,
    dmgFloats: (g && g.dmgFloats && g.dmgFloats.length) || 0,
    skillEffects: (g && g.skillEffects && g.skillEffects.length) || 0,
    elimFloats: (g && g.elimFloats && g.elimFloats.length) || 0,
    petSlotFloats: (g && g._petSlotFloats && g._petSlotFloats.length) || 0,
    comboParticles: (g && g._comboParticles && g._comboParticles.length) || 0,
    expFloats: (g && g._expFloats && g._expFloats.length) || 0,
    particles: Particles.count(),
    runBuffLogLen: (g && g.runBuffLog && g.runBuffLog.length) || 0,
  }
}

module.exports = {
  EFFECT_LIMITS,
  enforceBattleEffectLimits,
  clearBattleTransientState,
  getSnapshot,
}
