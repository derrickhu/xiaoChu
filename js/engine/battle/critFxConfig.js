const QUALITY_PRESETS = {
  full: {
    slotPrimaryTier: 'full',
    slotSecondaryTier: 'burst',
    totalBurstTier: 'full',
    cast: { hitFlash: 15, tintFlash: 10, hitStop: 4, castDuration: 34, enemyDuration: 20 },
    shake: { t: 20, i: 12 },
    comboFlash: { timer: 16, maxTimer: 18, radiusMul: 1, rays: 10, ringCount: 2, alphaMul: 1.4 },
    screenFlash: { timer: 6, max: 6, color: '#fff3c6' },
    notice: {
      subText: 'CRITICAL',
      scale: 3.05,
      _initScale: 3.6,
      _settleScale: 1.16,
      _pulseAmp: 0.08,
      _pulseSpeed: 0.42,
      riseSpeed: 0.38,
      waveAmp: 2.8,
      waveFreq: 0.4,
      lifeFrames: 56,
      fadeStart: 34,
    },
  },
  medium: {
    slotPrimaryTier: 'burst',
    slotSecondaryTier: 'text',
    totalBurstTier: 'burst',
    cast: { hitFlash: 14, tintFlash: 9, hitStop: 4, castDuration: 32, enemyDuration: 19 },
    shake: { t: 16, i: 10 },
    comboFlash: { timer: 14, maxTimer: 16, radiusMul: 0.94, rays: 6, ringCount: 1, alphaMul: 1.1 },
    screenFlash: { timer: 5, max: 5, color: '#fff0bf' },
    notice: {
      subText: 'CRIT',
      scale: 2.72,
      _initScale: 3.1,
      _settleScale: 1.12,
      _pulseAmp: 0.06,
      _pulseSpeed: 0.4,
      riseSpeed: 0.35,
      waveAmp: 2.1,
      waveFreq: 0.36,
      lifeFrames: 48,
      fadeStart: 28,
    },
  },
  lite: {
    slotPrimaryTier: 'text',
    slotSecondaryTier: 'none',
    totalBurstTier: 'text',
    cast: { hitFlash: 12, tintFlash: 8, hitStop: 3, castDuration: 30, enemyDuration: 18 },
    shake: { t: 12, i: 8 },
    comboFlash: { timer: 12, maxTimer: 12, radiusMul: 0.88, rays: 0, ringCount: 0, alphaMul: 0.92 },
    screenFlash: { timer: 4, max: 4, color: '#ffefc2' },
    notice: {
      subText: '',
      scale: 2.34,
      _initScale: 2.66,
      _settleScale: 1.06,
      _pulseAmp: 0.04,
      _pulseSpeed: 0.34,
      riseSpeed: 0.32,
      waveAmp: 1.5,
      waveFreq: 0.3,
      lifeFrames: 38,
      fadeStart: 20,
    },
  },
}

function _countAlive(list) {
  if (!list || !list.length) return 0
  let alive = 0
  for (let i = 0; i < list.length; i++) {
    const item = list[i]
    if (item && !item._dead && !(item.delay > 0)) alive++
  }
  return alive
}

function _extraLoad(extra, key) {
  const value = extra && extra[key] != null ? Number(extra[key]) : 0
  return value > 0 ? value : 0
}

function getCritFxPressure(g, incoming) {
  if (!g) return 0
  const extra = incoming || {}
  const slotFloats = _countAlive(g._petSlotFloats) + _extraLoad(extra, 'slotFloats')
  const dmgFloats = _countAlive(g.dmgFloats) + _extraLoad(extra, 'dmgFloats')
  const notices = _countAlive(g.skillEffects) + _extraLoad(extra, 'notices')
  const comboParticles = Math.min(12, Math.round((_countAlive(g._comboParticles) || 0) * 0.22))
    + Math.min(4, _extraLoad(extra, 'comboParticles'))
  const transient = (g._comboFlash > 0 ? 2 : 0)
    + (g._screenFlash > 0 ? 2 : 0)
    + (g.skillCastAnim && g.skillCastAnim.active ? 3 : 0)
    + (g._petSkillWave ? 2 : 0)
    + (g._skillFlash ? 2 : 0)
    + (_extraLoad(extra, 'comboFlash') > 0 ? 2 : 0)
    + (_extraLoad(extra, 'screenFlash') > 0 ? 2 : 0)
    + (_extraLoad(extra, 'skillCast') > 0 ? 3 : 0)
    + (_extraLoad(extra, 'petSkillWave') > 0 ? 2 : 0)
    + (_extraLoad(extra, 'skillFlash') > 0 ? 2 : 0)
  return slotFloats + dmgFloats + notices * 2 + comboParticles + transient
}

function getCritFxQuality(g, incoming) {
  const pressure = getCritFxPressure(g, incoming)
  if (pressure >= 22) return 'lite'
  if (pressure >= 11) return 'medium'
  return 'full'
}

function getCritFxPlan(g, incoming) {
  const pressure = getCritFxPressure(g, incoming)
  const quality = getCritFxQuality(g, incoming)
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.full
  return {
    quality,
    pressure,
    slotPrimaryTier: preset.slotPrimaryTier,
    slotSecondaryTier: preset.slotSecondaryTier,
    totalBurstTier: preset.totalBurstTier,
    cast: Object.assign({}, preset.cast),
    shake: Object.assign({}, preset.shake),
    comboFlash: Object.assign({}, preset.comboFlash),
    screenFlash: Object.assign({}, preset.screenFlash),
    notice: Object.assign({}, preset.notice),
  }
}

module.exports = {
  QUALITY_PRESETS,
  getCritFxPressure,
  getCritFxQuality,
  getCritFxPlan,
}
