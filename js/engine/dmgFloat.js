/**
 * 伤害飘字视觉中枢 — 所有伤害数字的位置、样式、动画参数集中管理
 *
 * 第 4 期目标：
 * - 去掉 emoji 风格正文
 * - 统一数字样式与跳跃节奏
 * - 让宠物攻击数字从宠物位附近起跳
 * - 为后续数字缓存 / drawImage 渲染预留结构
 */
const V = require('../views/env')
const { ATTR_COLOR } = require('../data/tower')

const SLOT_ATTR_PALETTE = {
  metal: { fillTop: '#fff7a8', fillBottom: '#ffd63d', glowColor: '#ffe14d', tagColor: '#fff5d2' },
  wood:  { fillTop: '#d8ff8d', fillBottom: '#6ef235', glowColor: '#90ff57', tagColor: '#edffd5' },
  earth: { fillTop: '#fff7d8', fillBottom: '#ffd76a', glowColor: '#ffe89a', tagColor: '#fff7e8' },
  water: { fillTop: '#b8fdff', fillBottom: '#44d7ff', glowColor: '#61efff', tagColor: '#dcffff' },
  fire:  { fillTop: '#ffd0b8', fillBottom: '#ff7a58', glowColor: '#ff9668', tagColor: '#ffe3d8' },
  heart: { fillTop: '#ffd6ef', fillBottom: '#ff73be', glowColor: '#ff8ccc', tagColor: '#fff0f8' },
}

const RENDER_CFG = {
  dmgFloat: {
    defaultStyle: 'damageMain',
    styles: {
      damageMain: {
        fontSize: 33,
        stroke: 6.5,
        strokeColor: '#201400',
        glow: 12,
        glowColor: '#ffbf1f',
        fillTop: '#fff8c8',
        fillBottom: '#ffd53f',
        tagRatio: 0.28,
        tagColor: '#fff4cf',
        fontWeight: 900,
        fontFamily: '"Avenir Next Condensed","Arial Black","PingFang SC",sans-serif',
      },
      damageCrit: {
        fontSize: 42,
        stroke: 9,
        strokeColor: '#241400',
        glow: 22,
        glowColor: '#ffe27a',
        fillTop: '#fffef6',
        fillBottom: '#ffe86a',
        tagRatio: 0.26,
        tagColor: '#fff8dc',
        fontWeight: 900,
        fontFamily: '"Avenir Next Condensed","Arial Black","PingFang SC",sans-serif',
      },
      damageMinor: {
        fontSize: 24,
        stroke: 5,
        strokeColor: '#201400',
        glow: 8,
        glowColor: '#ffb000',
        fillTop: '#fff3a0',
        fillBottom: '#ffcf40',
        tagRatio: 0.3,
        tagColor: '#ffffff',
        fontWeight: 900,
        fontFamily: '"Avenir Next Condensed","Arial Black","PingFang SC",sans-serif',
      },
      slotDamageMain: {
        fontSize: 21,
        stroke: 5,
        strokeColor: '#101010',
        glow: 10,
        glowColor: '#ffe96a',
        fillTop: '#fff8ca',
        fillBottom: '#ffd84c',
        tagRatio: 0.24,
        tagColor: '#fff5d2',
        fontWeight: 900,
        fontFamily: '"Avenir Next Condensed","Arial Black","PingFang SC",sans-serif',
      },
      slotDamageCrit: {
        fontSize: 29,
        stroke: 6.8,
        strokeColor: '#120d08',
        glow: 24,
        glowColor: '#fff7b6',
        fillTop: '#ffffff',
        fillBottom: '#ffe56c',
        tagRatio: 0.22,
        tagColor: '#fff9dd',
        fontWeight: 900,
        fontFamily: '"Avenir Next Condensed","Arial Black","PingFang SC",sans-serif',
      },
      slotDamageMinor: {
        fontSize: 13,
        stroke: 3.2,
        strokeColor: '#101010',
        glow: 6,
        glowColor: '#ffe14d',
        fillTop: '#fff7b8',
        fillBottom: '#ffd43c',
        tagRatio: 0.22,
        tagColor: '#fff5d2',
        fontWeight: 900,
        fontFamily: '"Avenir Next Condensed","Arial Black","PingFang SC",sans-serif',
      },
      heal: {
        fontSize: 28,
        stroke: 5,
        strokeColor: '#06210f',
        glow: 10,
        glowColor: '#46d96d',
        fillTop: '#d8ffd8',
        fillBottom: '#58ea68',
        tagRatio: 0.28,
        tagColor: '#ecffec',
        fontWeight: 900,
        fontFamily: '"Avenir Next","Arial Black","PingFang SC",sans-serif',
      },
      heroDmg: {
        fontSize: 29,
        stroke: 5.5,
        strokeColor: '#2b0606',
        glow: 9,
        glowColor: '#ff5d5d',
        fillTop: '#ffd4d4',
        fillBottom: '#ff5454',
        tagRatio: 0.28,
        tagColor: '#fff0f0',
        fontWeight: 900,
        fontFamily: '"Avenir Next","Arial Black","PingFang SC",sans-serif',
      },
      shield: {
        fontSize: 26,
        stroke: 5,
        strokeColor: '#041b24',
        glow: 9,
        glowColor: '#58dcff',
        fillTop: '#d5f8ff',
        fillBottom: '#6bd6ff',
        tagRatio: 0.28,
        tagColor: '#f3feff',
        fontWeight: 900,
        fontFamily: '"Avenir Next","Arial Black","PingFang SC",sans-serif',
      },
      dot: {
        fontSize: 23,
        stroke: 4.5,
        strokeColor: '#1c0a22',
        glow: 7,
        glowColor: '#b35cff',
        fillTop: '#f0d6ff',
        fillBottom: '#b45cff',
        tagRatio: 0.3,
        tagColor: '#f9ebff',
        fontWeight: 900,
        fontFamily: '"Avenir Next","Arial Black","PingFang SC",sans-serif',
      },
    },
  },
  elimFloat: { fontSize: 24, stroke: 4, glow: 6 },
}

const MOTION_PRESETS = {
  damageMain: {
    startScale: 0.76,
    peakScale: 1.22,
    settleScale: 1,
    popFrames: 5,
    settleFrames: 10,
    riseFrames: 16,
    riseDist: 22,
    driftFrames: 12,
    driftDist: 12,
    lifeFrames: 42,
    fadeStart: 31,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  slotDamageMain: {
    startScale: 0.64,
    peakScale: 1.36,
    settleScale: 1.02,
    popFrames: 4,
    settleFrames: 15,
    startYOffset: 14,
    riseFrames: 11,
    riseDist: 54,
    returnFrames: 10,
    returnTo: -7,
    reboundFrames: 9,
    reboundTo: 4,
    holdFrames: 24,
    driftFrames: 12,
    driftDist: 5,
    lifeFrames: 80,
    fadeStart: 62,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  slotDamageCrit: {
    startScale: 0.68,
    peakScale: 1.62,
    settleScale: 1.1,
    popFrames: 4,
    settleFrames: 16,
    startYOffset: 16,
    riseFrames: 12,
    riseDist: 64,
    returnFrames: 10,
    returnTo: -9,
    reboundFrames: 10,
    reboundTo: 4.5,
    holdFrames: 30,
    driftFrames: 13,
    driftDist: 6,
    lifeFrames: 94,
    fadeStart: 72,
    shakeDur: 13,
    shakeAmp: 4.8,
    jitterFrames: 16,
    jitterAmp: 3.3,
  },
  slotDamageMinor: {
    startScale: 0.8,
    peakScale: 1.12,
    settleScale: 1,
    popFrames: 4,
    settleFrames: 8,
    riseFrames: 5,
    riseDist: 10,
    returnFrames: 7,
    returnTo: 1,
    holdFrames: 12,
    lifeFrames: 28,
    fadeStart: 21,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  enemyTotalMain: {
    startScale: 0.76,
    peakScale: 1.3,
    settleScale: 1.03,
    popFrames: 5,
    settleFrames: 12,
    riseFrames: 12,
    riseDist: 26,
    returnFrames: 7,
    returnTo: 8,
    reboundFrames: 5,
    reboundTo: 6,
    holdFrames: 18,
    driftFrames: 13,
    driftDist: 10,
    lifeFrames: 60,
    fadeStart: 46,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  enemyTotalCrit: {
    startScale: 0.8,
    peakScale: 1.5,
    settleScale: 1.1,
    popFrames: 5,
    settleFrames: 13,
    riseFrames: 13,
    riseDist: 34,
    returnFrames: 7,
    returnTo: 10,
    reboundFrames: 5,
    reboundTo: 7,
    holdFrames: 24,
    driftFrames: 14,
    driftDist: 13,
    lifeFrames: 74,
    fadeStart: 58,
    shakeDur: 12,
    shakeAmp: 4.8,
    jitterFrames: 12,
    jitterAmp: 3.5,
  },
  damageCrit: {
    startScale: 0.8,
    peakScale: 1.36,
    settleScale: 1.06,
    popFrames: 5,
    settleFrames: 11,
    riseFrames: 18,
    riseDist: 26,
    driftFrames: 14,
    driftDist: 14,
    lifeFrames: 48,
    fadeStart: 35,
    shakeDur: 8,
    shakeAmp: 3.4,
    jitterFrames: 8,
    jitterAmp: 2.5,
  },
  damageMinor: {
    startScale: 0.86,
    peakScale: 1.08,
    settleScale: 1,
    popFrames: 3,
    settleFrames: 6,
    riseFrames: 12,
    riseDist: 14,
    driftFrames: 8,
    driftDist: 6,
    lifeFrames: 22,
    fadeStart: 14,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  heal: {
    startScale: 0.84,
    peakScale: 1.12,
    settleScale: 1,
    popFrames: 4,
    settleFrames: 8,
    riseFrames: 15,
    riseDist: 16,
    driftFrames: 9,
    driftDist: 8,
    lifeFrames: 25,
    fadeStart: 17,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  heroDmg: {
    startScale: 0.88,
    peakScale: 1.12,
    settleScale: 1,
    popFrames: 4,
    settleFrames: 8,
    riseFrames: 12,
    riseDist: 14,
    driftFrames: 8,
    driftDist: 7,
    lifeFrames: 22,
    fadeStart: 14,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 5,
    jitterAmp: 1.6,
  },
  shield: {
    startScale: 0.86,
    peakScale: 1.14,
    settleScale: 1,
    popFrames: 4,
    settleFrames: 8,
    riseFrames: 14,
    riseDist: 15,
    driftFrames: 8,
    driftDist: 6,
    lifeFrames: 24,
    fadeStart: 16,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
  dot: {
    startScale: 0.88,
    peakScale: 1.08,
    settleScale: 1,
    popFrames: 3,
    settleFrames: 6,
    riseFrames: 12,
    riseDist: 12,
    driftFrames: 8,
    driftDist: 6,
    lifeFrames: 22,
    fadeStart: 14,
    shakeDur: 0,
    shakeAmp: 0,
    jitterFrames: 0,
    jitterAmp: 0,
  },
}

const ANIM_CFG = {
  dmgFloat: MOTION_PRESETS.damageMain,
  elimFloat: {
    bounceDur: 10,
    bounceAmp: 0.7,
    stayFrames: 18,
    lifeFrames: 35,
    bounceSpeed: 0.2,
    staySpeed: 0.4,
    fadeSpeed: 0.8,
    fadeAlphaDec: 0.06,
  },
}

const FLOAT_CFG = {
  enemyTotal:      { dy: -10, scale: 1.4, critScale: 1.7 },
  elimDmg:         { dy: 10, attrDx: { metal:-60, wood:-30, water:0, fire:30, earth:60, heart:0 } },
  petNormalAtk:    { slotYRatio: 0.6, scale: 1.03, delayStep: 3 },
  petSkill:        { slotYRatio: 0.6, scale: 1.04 },
  petMultiHit:     { upperYRatio: 0.5, lowerYRatio: 0.78, xStep: 8, scale: 1.03 },
  petTeamAtk:      { slotYRatio: 0.66, scale: 1.04, delayStep: 3 },
  aoeDmg:          { dy: -34, dx: 40, scale: 1.0, tag: '范围' },
  dotOnEnemy:      { dy: -46, hGap: 24, scale: 0.92 },
  reflectToEnemy:  { dy: -56, dx: 48, scale: 0.96, tag: '反弹' },
  enemyHeal:       { dy: -10, scale: 1.0 },

  heroHeal:        { yR: 0.65, xSpread: 0.2, scale: 1.05, tag: '回复' },
  heroDmg:         { yR: 0.70, scale: 1.02, tag: '受击' },
  heroShieldGain:  { yR: 0.65, scale: 0.98, tag: '护盾' },
  heroShieldBlock: { yR: 0.60, scale: 1.04, tag: '格挡' },
  heroShieldBreak: { yR: 0.60, scale: 1.0, tag: '盾挡' },
  eventCost:       { yR: 0.35, scale: 1.0, tag: '代价' },
}

function formatNumber(num) {
  return Math.max(0, Math.round(num || 0)).toLocaleString('en-US')
}

function getDmgRenderStyle(styleKey) {
  const cfg = RENDER_CFG.dmgFloat
  return (cfg.styles && cfg.styles[styleKey]) || cfg.styles[cfg.defaultStyle]
}

function getDmgMotion(styleKey) {
  return MOTION_PRESETS[styleKey] || ANIM_CFG.dmgFloat
}

function _enemyHpY() {
  const bh = require('../battleHelpers')
  const L = bh.getBattleLayout()
  const eAreaBottom = L.teamBarY - 4 * V.S
  return eAreaBottom - 26 * V.S
}

function _getPetSlotRect(g, petIdx) {
  const frameScale = 1.12
  if (g && g._petBtnRects && g._petBtnRects[petIdx]) {
    const rect = g._petBtnRects[petIdx]
    const frameW = rect[2] * frameScale
    const frameH = rect[3] * frameScale
    return {
      x: rect[0] - (frameW - rect[2]) / 2,
      y: rect[1] - (frameH - rect[3]) / 2,
      w: frameW,
      h: frameH,
    }
  }
  const bh = require('../battleHelpers')
  const L = bh.getBattleLayout()
  const { S } = V
  const sidePad = 8 * S
  const petGap = 8 * S
  const wpnGap = 12 * S
  const ix = sidePad + L.iconSize + wpnGap + (petIdx || 0) * (L.iconSize + petGap)
  const iconY = L.teamBarY + (L.teamBarH - L.iconSize) / 2
  const frameW = L.iconSize * frameScale
  const frameH = L.iconSize * frameScale
  return {
    x: ix - (frameW - L.iconSize) / 2,
    y: iconY - (frameH - L.iconSize) / 2,
    w: frameW,
    h: frameH,
  }
}

function _petSlotAnchor(g, petIdx, lane, hitIdx, totalHits) {
  const rect = _getPetSlotRect(g, petIdx)
  const multiCfg = FLOAT_CFG.petMultiHit
  const mainCfg = FLOAT_CFG.petNormalAtk || FLOAT_CFG.petSkill
  const teamCfg = FLOAT_CFG.petTeamAtk
  let x = rect.x + rect.w * 0.5
  let y = rect.y + rect.h * (mainCfg.slotYRatio || 0.38)
  if (lane === 'team') {
    y = rect.y + rect.h * (teamCfg.slotYRatio || 0.38)
  } else if (lane === 'minor') {
    const spread = ((hitIdx || 0) - ((totalHits || 1) - 1) / 2) * (multiCfg.xStep || 0) * V.S
    x += spread
    y = rect.y + rect.h * ((hitIdx || 0) === 0 ? (multiCfg.upperYRatio || 0.4) : (multiCfg.lowerYRatio || 0.74))
  }
  return { x, y, rect }
}

function resolvePetFloatAnchor(g, floatObj) {
  const info = _petSlotAnchor(g, floatObj && floatObj.petIdx, floatObj && floatObj.anchorLane, floatObj && floatObj.hitIdx, floatObj && floatObj.totalHits)
  return { x: info.x, y: info.y }
}

function _getSlotPalette(attr, fallbackColor) {
  if (attr && SLOT_ATTR_PALETTE[attr]) return SLOT_ATTR_PALETTE[attr]
  if (attr && ATTR_COLOR[attr]) {
    const ac = ATTR_COLOR[attr]
    return {
      fillTop: ac.lt || '#ffffff',
      fillBottom: ac.main || fallbackColor || '#ffd63d',
      glowColor: ac.lt || ac.main || fallbackColor || '#ffe14d',
      tagColor: '#ffffff',
    }
  }
  if (fallbackColor) {
    return {
      fillTop: '#ffffff',
      fillBottom: fallbackColor,
      glowColor: fallbackColor,
      tagColor: '#ffffff',
    }
  }
  return SLOT_ATTR_PALETTE.metal
}

function _applySlotPalette(obj, attr, fallbackColor) {
  const palette = _getSlotPalette(attr, fallbackColor)
  obj.fillTop = palette.fillTop
  obj.fillBottom = palette.fillBottom
  obj.glowColor = palette.glowColor
  obj.tagColor = palette.tagColor
  obj.color = palette.fillBottom
  return obj
}

function ensurePetSlotFloats(g) {
  if (!g._petSlotFloats) g._petSlotFloats = []
  return g._petSlotFloats
}

function _initDmgObj(obj) {
  obj.styleKey = obj.styleKey || RENDER_CFG.dmgFloat.defaultStyle
  obj.motion = obj.motion || getDmgMotion(obj.styleKey)
  obj._baseScale = obj.scale || 1
  obj._initScale = obj._baseScale
  obj._targetAlpha = obj.alpha == null ? 1 : obj.alpha
  obj.t = obj.t || 0
  obj.delay = obj.delay || 0
  const startScale = obj.motion && obj.motion.startScale != null ? obj.motion.startScale : 0.78
  obj.scale = obj._baseScale * startScale
  obj.alpha = obj.delay > 0 ? 0 : obj._targetAlpha
  return obj
}

function _pushDmg(g, obj) {
  _initDmgObj(obj)
  obj._baseX = obj.x
  obj._baseY = obj.y
  g.dmgFloats.push(obj)
}

function _pushPetSlot(g, obj) {
  _initDmgObj(obj)
  obj._anchorYOffset = obj._anchorYOffset || 0
  ensurePetSlotFloats(g).push(obj)
}

function _pushElim(g, obj) {
  const amp = ANIM_CFG.elimFloat.bounceAmp
  obj._baseScale = obj.scale || 1
  obj.scale = obj._baseScale * (1 + amp)
  g.elimFloats.push(obj)
}

function elimDmg(g, text, color, attr, baseScale) {
  const { W, S } = V
  const c = FLOAT_CFG.elimDmg
  const offsetX = ((c.attrDx[attr]) || 0) * S
  _pushElim(g, {
    x: W * 0.5 + offsetX,
    y: _enemyHpY() + c.dy * S,
    text,
    color,
    t: 0,
    alpha: 1,
    scale: baseScale,
  })
}

function _getSlotCritFx(tier) {
  switch (tier) {
    case 'full':
      return {
        _shake: true,
        _burstStyle: 'slotCrit',
        _burstFrames: 24,
        _burstColor: '#ffe780',
        _slotPulseStyle: 'crit',
        _slotPulseFrames: 34,
        _slotBadgeText: '暴击',
        _slotBadgeFrames: 28,
        _launchGlowStyle: 'crit',
      }
    case 'burst':
      return {
        _shake: true,
        _burstStyle: 'slotCrit',
        _burstFrames: 18,
        _burstColor: '#ffe780',
        _slotPulseStyle: '',
        _slotPulseFrames: 0,
        _slotBadgeText: '',
        _slotBadgeFrames: 0,
        _launchGlowStyle: 'crit',
      }
    case 'text':
      return {
        _shake: false,
        _burstStyle: '',
        _burstFrames: 0,
        _burstColor: '',
        _slotPulseStyle: '',
        _slotPulseFrames: 0,
        _slotBadgeText: '',
        _slotBadgeFrames: 0,
        _launchGlowStyle: '',
      }
    default:
      return {
        _shake: false,
        _burstStyle: '',
        _burstFrames: 0,
        _burstColor: '',
        _slotPulseStyle: '',
        _slotPulseFrames: 0,
        _slotBadgeText: '',
        _slotBadgeFrames: 0,
        _launchGlowStyle: 'normal',
      }
  }
}

function _getEnemyCritBurstFx(tier) {
  switch (tier) {
    case 'full':
      return { _burstStyle: 'totalCrit', _burstFrames: 26 }
    case 'burst':
      return { _burstStyle: 'totalCrit', _burstFrames: 18 }
    default:
      return { _burstStyle: '', _burstFrames: 0 }
  }
}

function petNormalAtkDmg(g, dmg, color, petIdx, attr, isCrit, orderIdx, critFxTier) {
  const c = FLOAT_CFG.petNormalAtk
  const step = c.delayStep || 0
  const critFx = isCrit ? _getSlotCritFx(critFxTier || 'full') : _getSlotCritFx('normal')
  const floatObj = {
    petIdx: petIdx == null ? 0 : petIdx,
    anchorLane: 'main',
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: isCrit ? 'slotDamageCrit' : 'slotDamageMain',
    delay: Math.max(0, orderIdx == null ? petIdx || 0 : orderIdx) * step,
    _shake: critFx._shake,
    _burstStyle: critFx._burstStyle,
    _burstFrames: critFx._burstFrames,
    _burstColor: critFx._burstColor,
    _slotPulseStyle: critFx._slotPulseStyle,
    _slotPulseFrames: critFx._slotPulseFrames,
    _slotBadgeText: critFx._slotBadgeText,
    _slotBadgeFrames: critFx._slotBadgeFrames,
    _launchGlowStyle: critFx._launchGlowStyle,
  }
  _pushPetSlot(g, _applySlotPalette(floatObj, attr, color))
}

function petSkillDmg(g, dmg, color, petIdx, attr) {
  const c = FLOAT_CFG.petSkill
  const floatObj = {
    petIdx: petIdx == null ? 0 : petIdx,
    anchorLane: 'main',
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'slotDamageMain',
  }
  _pushPetSlot(g, _applySlotPalette(floatObj, attr, color))
}

function petMultiHitDmg(g, dmg, color, hitIdx, totalHits, petIdx, attr) {
  const c = FLOAT_CFG.petMultiHit
  const resolvedHitIdx = hitIdx || 0
  const floatObj = {
    petIdx: petIdx == null ? 0 : petIdx,
    anchorLane: 'minor',
    hitIdx: resolvedHitIdx,
    totalHits: totalHits || 1,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: resolvedHitIdx === 0 ? 'slotDamageMain' : 'slotDamageMinor',
    delay: resolvedHitIdx * 3,
  }
  _pushPetSlot(g, _applySlotPalette(floatObj, attr, color))
}

function petTeamAtkDmg(g, dmg, color, petIdx, totalPets, attr) {
  const c = FLOAT_CFG.petTeamAtk
  const resolvedPetIdx = petIdx == null ? 0 : petIdx
  const floatObj = {
    petIdx: resolvedPetIdx,
    anchorLane: 'team',
    totalPets: totalPets || 1,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'slotDamageMain',
    delay: resolvedPetIdx * (c.delayStep || 0),
  }
  _pushPetSlot(g, _applySlotPalette(floatObj, attr, color))
}

function enemyTotal(g, dmg, color, isCrit, critFxTier) {
  const { W, S } = V
  const c = FLOAT_CFG.enemyTotal
  const critBurstFx = isCrit ? _getEnemyCritBurstFx(critFxTier || 'full') : _getEnemyCritBurstFx('none')
  const useHeavyCritFx = !!(critBurstFx && critBurstFx._burstFrames > 0)
  const critPalette = isCrit
    ? {
        color: '#ff8d4a',
        fillTop: '#fff9f0',
        fillBottom: '#ff7a3d',
        strokeColor: '#4a1600',
        glowColor: '#ffb56e',
        tagColor: '#fff0cb',
        burstColor: '#ffd27d',
      }
    : null
  _pushDmg(g, {
    x: W * 0.5,
    y: _enemyHpY() + c.dy * S,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: isCrit
      ? (useHeavyCritFx ? (c.critScale || c.scale || 1.5) : Math.max(c.scale || 1, (c.critScale || c.scale || 1.5) * 0.9))
      : c.scale,
    styleKey: isCrit ? 'damageCrit' : 'damageMain',
    motion: isCrit
      ? (useHeavyCritFx ? MOTION_PRESETS.enemyTotalCrit : MOTION_PRESETS.damageCrit)
      : MOTION_PRESETS.enemyTotalMain,
    color: critPalette ? critPalette.color : color,
    fillTop: critPalette ? critPalette.fillTop : undefined,
    fillBottom: critPalette ? critPalette.fillBottom : undefined,
    strokeColor: critPalette ? critPalette.strokeColor : undefined,
    glowColor: critPalette ? critPalette.glowColor : undefined,
    tag: isCrit ? '暴击' : '总伤',
    tagPosition: isCrit ? 'top' : 'bottom',
    tagColor: critPalette ? critPalette.tagColor : undefined,
    _shake: !!(isCrit && useHeavyCritFx),
    _burstStyle: critBurstFx._burstStyle,
    _burstFrames: critBurstFx._burstFrames,
    _burstColor: critPalette ? critPalette.burstColor : '',
  })
}

function aoeDmg(g, dmg) {
  const { W, S } = V
  const c = FLOAT_CFG.aoeDmg
  _pushDmg(g, {
    x: W * 0.5 + (c.dx || 0) * S,
    y: _enemyHpY() + c.dy * S,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'damageMinor',
    tag: c.tag,
  })
}

function dotOnEnemy(g, dmg, dotType, idx) {
  const { W, S } = V
  const c = FLOAT_CFG.dotOnEnemy
  const tagText = dotType === 'burn' ? '灼烧' : '中毒'
  _pushDmg(g, {
    x: W * 0.5 + idx * (c.hGap || 30) * S,
    y: _enemyHpY() + c.dy * S,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'dot',
    tag: idx === 0 ? tagText : undefined,
  })
}

function reflectToEnemy(g, dmg, color) {
  const { W, S } = V
  const c = FLOAT_CFG.reflectToEnemy
  _pushDmg(g, {
    x: W * 0.5 + (c.dx || 0) * S,
    y: _enemyHpY() + c.dy * S,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'shield',
    color,
    tag: c.tag,
  })
}

function enemyHeal(g, amt) {
  const { W, S } = V
  const c = FLOAT_CFG.enemyHeal
  _pushDmg(g, {
    x: W * 0.5,
    y: _enemyHpY() + c.dy * S,
    text: `+${formatNumber(amt)}`,
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'heal',
  })
}

function heroHeal(g, amt, color) {
  const { W, H } = V
  const c = FLOAT_CFG.heroHeal
  const spread = c.xSpread || 0.2
  _pushDmg(g, {
    x: W * (0.5 - spread / 2) + Math.random() * W * spread,
    y: H * c.yR,
    text: `+${formatNumber(amt)}`,
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'heal',
    color,
    tag: c.tag,
  })
}

function heroDmg(g, dmg, color) {
  const { W, H } = V
  const c = FLOAT_CFG.heroDmg
  _pushDmg(g, {
    x: W * 0.5,
    y: H * c.yR,
    text: `-${formatNumber(dmg)}`,
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'heroDmg',
    color,
    tag: c.tag,
  })
}

function heroShieldGain(g, val) {
  const { W, H } = V
  const c = FLOAT_CFG.heroShieldGain
  _pushDmg(g, {
    x: W * 0.5,
    y: H * c.yR,
    text: `+${formatNumber(val)}`,
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'shield',
    tag: c.tag,
  })
}

function heroShieldBlock(g, dmg) {
  const { W, H } = V
  const c = FLOAT_CFG.heroShieldBlock
  _pushDmg(g, {
    x: W * 0.5,
    y: H * c.yR,
    text: formatNumber(dmg),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'shield',
    tag: c.tag,
  })
}

function heroShieldBreak(g, shieldAbs) {
  const { W, H } = V
  const c = FLOAT_CFG.heroShieldBreak
  _pushDmg(g, {
    x: W * 0.45,
    y: H * c.yR,
    text: formatNumber(shieldAbs),
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'shield',
    tag: c.tag,
  })
}

function eventCost(g, cost) {
  const { W, H } = V
  const c = FLOAT_CFG.eventCost
  _pushDmg(g, {
    x: W * 0.5,
    y: H * c.yR,
    text: `-${formatNumber(cost)}`,
    t: 0,
    alpha: 1,
    scale: c.scale,
    styleKey: 'heroDmg',
    tag: c.tag,
  })
}

module.exports = {
  FLOAT_CFG,
  RENDER_CFG,
  ANIM_CFG,
  MOTION_PRESETS,
  formatNumber,
  getDmgRenderStyle,
  getDmgMotion,
  resolvePetFloatAnchor,
  elimDmg,
  enemyTotal,
  petNormalAtkDmg,
  petSkillDmg,
  petMultiHitDmg,
  petTeamAtkDmg,
  aoeDmg,
  dotOnEnemy,
  reflectToEnemy,
  enemyHeal,
  heroHeal,
  heroDmg,
  heroShieldGain,
  heroShieldBlock,
  heroShieldBreak,
  eventCost,
}
