/**
 * 连击数字、里程碑、背景特效与全屏反馈
 */
const V = require('../env')
const { COMBO_MILESTONES, getComboTier, isComboMilestone } = require('../../data/constants')
const P = require('../../platform')
const Particles = require('../../engine/particles')
const FXComposer = require('../../engine/effectComposer')

const _comboTextMeasureCache = {}
const _comboCritBurstCache = {}

function _measureTextCached(ctx, font, text) {
  const key = `${font}|${text}`
  if (_comboTextMeasureCache[key] != null) return _comboTextMeasureCache[key]
  const width = ctx.measureText(text).width
  const keys = Object.keys(_comboTextMeasureCache)
  if (keys.length >= 96) {
    for (let i = 0; i < 24; i++) delete _comboTextMeasureCache[keys[i]]
  }
  _comboTextMeasureCache[key] = width
  return width
}

function _getComboCritBurstSprite(meta, S) {
  if (!P.createOffscreenCanvas) return null
  const ringColor = meta.ringColor || '#ffe37a'
  const rayColor = meta.rayColor || '#fff8d8'
  const rayCount = meta.rays || 10
  const ringCount = meta.ringCount || 2
  const key = [S, ringColor, rayColor, rayCount, ringCount].join('|')
  if (_comboCritBurstCache[key]) return _comboCritBurstCache[key]

  const size = Math.max(96, Math.ceil(280 * S))
  const oc = P.createOffscreenCanvas({ type: '2d', width: size, height: size })
  const octx = oc.getContext('2d')
  const cx = size * 0.5
  const cy = size * 0.5
  const baseRadius = size * 0.32

  octx.save()
  octx.translate(cx, cy)
  octx.globalCompositeOperation = 'lighter'
  for (let ringIdx = 0; ringIdx < ringCount; ringIdx++) {
    octx.globalAlpha = 0.8 - ringIdx * 0.16
    octx.strokeStyle = ringIdx === 0 ? ringColor : '#fff7d3'
    octx.lineWidth = (5 - ringIdx * 0.7) * S
    octx.beginPath()
    octx.arc(0, 0, baseRadius * (0.72 + ringIdx * 0.16), 0, Math.PI * 2)
    octx.stroke()
  }

  octx.globalAlpha = 0.92
  octx.strokeStyle = rayColor
  octx.lineWidth = 1.9 * S
  for (let i = 0; i < rayCount; i++) {
    const ang = -Math.PI / 2 + i * Math.PI * 2 / rayCount
    const innerR = baseRadius * 0.26
    const outerR = baseRadius * (i % 2 === 0 ? 1.42 : 1.26)
    octx.beginPath()
    octx.moveTo(Math.cos(ang) * innerR, Math.sin(ang) * innerR)
    octx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR)
    octx.stroke()
  }

  octx.globalAlpha = 0.82
  octx.strokeStyle = '#ffffff'
  octx.lineWidth = 2.3 * S
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + i * Math.PI / 2
    octx.beginPath()
    octx.moveTo(Math.cos(ang) * baseRadius * 0.2, Math.sin(ang) * baseRadius * 0.2)
    octx.lineTo(Math.cos(ang) * baseRadius * 1.5, Math.sin(ang) * baseRadius * 1.5)
    octx.stroke()
  }
  octx.restore()

  const sprite = { canvas: oc, width: size, height: size, anchorX: cx, anchorY: cy, baseRadius }
  const keys = Object.keys(_comboCritBurstCache)
  if (keys.length >= 24) {
    for (let i = 0; i < 6; i++) delete _comboCritBurstCache[keys[i]]
  }
  _comboCritBurstCache[key] = sprite
  return sprite
}

function drawComboBgEffects(cs) {
  const { ctx, S, W, comboCx, comboCy, baseSz, comboAlpha, isSuper, isMega, glowColor, ca, quality } = cs
  const isLite = quality === 'lite'
  const isMedium = quality === 'medium'
  const maskH = baseSz * 3.3
  const maskCy = comboCy + baseSz * 0.28
  const maskGrd = ctx.createLinearGradient(0, maskCy - maskH * 0.5, 0, maskCy + maskH * 0.5)
  maskGrd.addColorStop(0, 'transparent')
  maskGrd.addColorStop(0.14, 'rgba(0,0,0,0.44)')
  maskGrd.addColorStop(0.5, 'rgba(0,0,0,0.62)')
  maskGrd.addColorStop(0.86, 'rgba(0,0,0,0.44)')
  maskGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = maskGrd
  ctx.fillRect(0, maskCy - maskH * 0.5, W, maskH)

  if (cs.combo >= 3) {
    const burstR = baseSz * (isMega ? 3.05 : isSuper ? 2.5 : 1.85) * (ca.timer < 12 ? (2.15 - ca.timer / 12) : 1.15)
    const burstAlpha = isMega ? 0.5 : isSuper ? 0.4 : 0.28
    FXComposer.drawGlowSpot(ctx, comboCx, comboCy, burstR, glowColor, burstAlpha)
  }

  if (isSuper && ca.timer < 24) {
    ctx.save()
    ctx.translate(comboCx, comboCy)
    const rayCount = isLite ? (isMega ? 12 : 8) : isMedium ? (isMega ? 16 : 12) : (isMega ? 24 : 16)
    const rayLen = baseSz * 2.35 * Math.min(1, ca.timer / 8)
    const rayAlpha = Math.max(0, 1 - ca.timer / 24) * (isLite ? 0.55 : 0.8)
    ctx.globalAlpha = comboAlpha * rayAlpha
    for (let r = 0; r < rayCount; r++) {
      const angle = (r / rayCount) * Math.PI * 2 + ca.timer * 0.09
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * baseSz * 0.22, Math.sin(angle) * baseSz * 0.22)
      ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen)
      ctx.strokeStyle = glowColor
      ctx.lineWidth = (isMega ? 5 : 3) * S
      ctx.stroke()
    }
    ctx.restore()
  }

  if (isComboMilestone(cs.combo) && ca.timer < 22) {
    ctx.save()
    const ringP = ca.timer / 22
    const ringR = baseSz * (0.58 + ringP * 3.9)
    const ringAlpha = (1 - ringP) * 0.88
    ctx.globalAlpha = comboAlpha * ringAlpha
    ctx.beginPath()
    ctx.arc(comboCx, comboCy, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : '#ffd700'
    ctx.lineWidth = (7 - ringP * 4.8) * S
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 18 * S
    ctx.stroke()
    if (ca.timer > 3) {
      const ringP2 = (ca.timer - 3) / 22
      const ringR2 = baseSz * (0.34 + ringP2 * 3.25)
      ctx.globalAlpha = comboAlpha * Math.max(0, 1 - ringP2) * 0.58
      ctx.beginPath()
      ctx.arc(comboCx, comboCy, ringR2, 0, Math.PI * 2)
      ctx.lineWidth = (4.5 - ringP2 * 3.2) * S
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.restore()
  }
}

// ===== Combo里程碑文字（3/6/9/12连击，配置化） =====
function drawComboMilestone(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboScale, comboAlpha, ca, combo } = cs

  const milestone = COMBO_MILESTONES.find(m => combo === m.threshold)
  if (!milestone || !ca || ca.timer > 58) return

  const mt = milestone.text

  ctx.save()
  const mileY = comboCy - baseSz * 1.95
  ctx.translate(comboCx, mileY)
  const animProgress = Math.max(0, 1 - ca.timer / 34)
  const ms = comboScale * (1.0 + animProgress * 0.6)
  ctx.scale(ms, ms)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `italic 900 ${baseSz * 1.18}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

  const mg = ctx.createLinearGradient(-96 * S, 0, 96 * S, 0)
  mg.addColorStop(0, milestone.color)
  mg.addColorStop(0.45, '#ffffff')
  mg.addColorStop(1, milestone.color)

  ctx.strokeStyle = 'rgba(0,0,0,0.92)'
  ctx.lineWidth = 7 * S
  ctx.strokeText(mt, 0, 0)

  ctx.shadowColor = milestone.color
  ctx.shadowBlur = 24 * S
  ctx.fillStyle = mg
  ctx.fillText(mt, 0, 0)
  ctx.shadowBlur = 0

  if (ca.timer < 24) {
    ctx.globalAlpha = (1 - ca.timer / 24) * 0.95
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 34 * S
    ctx.fillStyle = '#fff'
    ctx.fillText(mt, 0, 0)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

// ===== Combo主文字（数字 + “连击”同级强化，保持横排） =====
function drawComboMainText(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboScale, mainColor, glowColor, combo, isSuper, isMega } = cs
  ctx.save()
  ctx.translate(comboCx, comboCy)
  ctx.scale(comboScale, comboScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

  const numText = String(combo)
  const suffixText = '连击'
  const numFontSz = baseSz * (isMega ? 1.1 : isSuper ? 1.05 : 1.0)
  const suffixSz = baseSz * (isMega ? 0.82 : isSuper ? 0.78 : 0.72)
  const suffixY = baseSz * 0.04
  const gap = Math.max(8 * S, baseSz * 0.16)

  const numFont = `italic 900 ${numFontSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
  const suffixFont = `italic 900 ${suffixSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

  ctx.font = numFont
  const numWidth = _measureTextCached(ctx, numFont, numText)
  ctx.font = suffixFont
  const suffixWidth = _measureTextCached(ctx, suffixFont, suffixText)

  const totalWidth = numWidth + gap + suffixWidth
  const startX = -totalWidth / 2
  const numX = startX + numWidth / 2
  const suffixX = startX + numWidth + gap + suffixWidth / 2

  const numGrd = ctx.createLinearGradient(0, -numFontSz * 0.75, 0, numFontSz * 0.35)
  numGrd.addColorStop(0, '#ffffff')
  numGrd.addColorStop(0.26, glowColor)
  numGrd.addColorStop(0.7, mainColor)
  numGrd.addColorStop(1, mainColor)

  ctx.font = numFont
  ctx.strokeStyle = 'rgba(0,0,0,0.92)'
  ctx.lineWidth = (isMega ? 7 : isSuper ? 6 : 5) * S
  ctx.strokeText(numText, numX, 0)
  ctx.shadowColor = glowColor
  ctx.shadowBlur = (isMega ? 34 : isSuper ? 28 : 22) * S
  ctx.fillStyle = numGrd
  ctx.fillText(numText, numX, 0)
  ctx.shadowBlur = 0

  ctx.save()
  ctx.beginPath()
  ctx.moveTo(numX - numFontSz * 0.9, -numFontSz * 0.58)
  ctx.lineTo(numX + numFontSz * 0.65, -numFontSz * 0.58)
  ctx.lineTo(numX + numFontSz * 0.42, numFontSz * 0.02)
  ctx.lineTo(numX - numFontSz * 1.05, numFontSz * 0.02)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = isMega ? 0.58 : 0.5
  ctx.fillText(numText, numX, 0)
  ctx.restore()

  const suffixGrd = ctx.createLinearGradient(0, -suffixSz * 0.6, 0, suffixSz * 0.5)
  suffixGrd.addColorStop(0, '#ffffff')
  suffixGrd.addColorStop(0.35, '#ffe7a8')
  suffixGrd.addColorStop(1, glowColor)

  ctx.font = suffixFont
  ctx.strokeStyle = 'rgba(0,0,0,0.92)'
  ctx.lineWidth = (isMega ? 4.5 : 4) * S
  ctx.strokeText(suffixText, suffixX, suffixY)
  ctx.shadowColor = glowColor
  ctx.shadowBlur = (isMega ? 22 : 18) * S
  ctx.fillStyle = suffixGrd
  ctx.fillText(suffixText, suffixX, suffixY)
  ctx.shadowBlur = 0

  ctx.restore()
}

// ===== Combo粒子与全屏闪光特效 =====
function drawComboVFX(g) {
  const { ctx, R, W, H, S, ROWS } = V

  if (g._comboParticles.length > 0) {
    ctx.save()
    for (let pi = 0; pi < g._comboParticles.length; pi++) {
      const p = g._comboParticles[pi]
      if (p._dead) continue
      const lifeP = p.t / p.life
      const alpha = lifeP < 0.3 ? 1 : 1 - (lifeP - 0.3) / 0.7
      const sz = p.size * (lifeP < 0.2 ? 0.5 + lifeP / 0.2 * 0.5 : 1 - (lifeP - 0.2) * 0.4)
      if (alpha <= 0.01 || sz <= 0.1) continue
      ctx.globalAlpha = alpha * 0.9
      if (p.type === 'star') {
        ctx.fillStyle = p.color
        if (!p._tex) {
          p._tex = Particles.getStarTexture(p.color, Math.ceil((p.size || sz) * 1.2))
        }
        const tex = p._tex
        if (tex) {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.t * 0.15)
          const tw = sz * 2.4
          ctx.drawImage(tex, -tw / 2, -tw / 2, tw, tw)
          ctx.restore()
        } else {
          ctx.save()
          ctx.translate(p.x, p.y); ctx.rotate(p.t * 0.15)
          ctx.beginPath()
          for (let i = 0; i < 10; i++) {
            const a = (i * Math.PI) / 5 - Math.PI / 2
            const r = i % 2 === 0 ? sz * 1.2 : sz * 0.5
            i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r)
          }
          ctx.closePath(); ctx.fill()
          ctx.restore()
        }
      } else {
        if (!p._tex) {
          p._tex = Particles.getGlowTexture(p.color, Math.ceil(p.size || sz))
        }
        const tex = p._tex
        if (tex) {
          const tw = sz * 2
          ctx.drawImage(tex, p.x - tw / 2, p.y - tw / 2, tw, tw)
        } else {
          ctx.fillStyle = p.color
          ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  if (g._comboFlash > 0) {
    const meta = g._comboFlashMeta || {}
    const focus = meta.focus || 'board'
    const flashCombo = Math.max(0, g.combo || 0)
    const flashCy = meta.y != null
      ? meta.y
      : focus === 'enemy'
        ? g._getEnemyCenterY()
        : g.boardY + (ROWS * g.cellSize) * 0.32
    const flashCx = meta.x != null ? meta.x : W * 0.5
    const flashR = meta.radius || (
      focus === 'enemy'
        ? ((flashCombo >= 1 ? 96 : 104) * S)
        : ((flashCombo >= 12 ? 138 : flashCombo >= 8 ? 110 : flashCombo >= 5 ? 86 : 64) * S)
    )
    const alphaMul = meta.alphaMul == null ? 1 : meta.alphaMul
    const flashBaseAlpha = focus === 'enemy'
      ? 0.32
      : (flashCombo >= 12 ? 0.46 : flashCombo >= 8 ? 0.36 : flashCombo >= 5 ? 0.28 : 0.24)
    const flashAlpha = (g._comboFlash / Math.max(1, meta.maxTimer || 8)) * flashBaseAlpha * alphaMul
    const flashColor = meta.color || '#fffff0'
    if (flashAlpha > 0.01) {
      FXComposer.drawGlowSpot(ctx, flashCx, flashCy, flashR, flashColor, Math.min(0.5, flashAlpha))
      if (meta.style === 'critBurst' && focus === 'enemy') {
        const flashMax = Math.max(1, meta.maxTimer || 8)
        const burstP = 1 - g._comboFlash / flashMax
        const burstSprite = _getComboCritBurstSprite(meta, S)
        if (burstSprite) {
          const burstScale = (flashR / Math.max(1, burstSprite.baseRadius)) * (0.88 + burstP * 0.24)
          const burstW = burstSprite.width * burstScale
          const burstH = burstSprite.height * burstScale
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = flashAlpha * (0.92 - burstP * 0.28)
          ctx.drawImage(burstSprite.canvas, flashCx - burstSprite.anchorX * burstScale, flashCy - burstSprite.anchorY * burstScale, burstW, burstH)
          ctx.restore()
        } else {
          const ringColor = meta.ringColor || '#ffe37a'
          const rayColor = meta.rayColor || '#fff8d8'
          const rayCount = meta.rays || 10
          const ringCount = meta.ringCount || 2
          ctx.save()
          ctx.translate(flashCx, flashCy)
          ctx.globalCompositeOperation = 'lighter'
          for (let ringIdx = 0; ringIdx < ringCount; ringIdx++) {
            const ringDelay = ringIdx * 0.14
            const ringProg = Math.max(0, Math.min(1, (burstP - ringDelay) / Math.max(0.18, 1 - ringDelay)))
            if (ringProg <= 0) continue
            ctx.globalAlpha = Math.max(0, flashAlpha * (0.82 - ringIdx * 0.18) * (1 - ringProg))
            ctx.strokeStyle = ringIdx === 0 ? ringColor : '#fff7d3'
            ctx.lineWidth = (4.4 - ringProg * 2.6 - ringIdx * 0.6) * S
            ctx.beginPath()
            ctx.arc(0, 0, flashR * (0.42 + ringProg * (0.62 + ringIdx * 0.12)), 0, Math.PI * 2)
            ctx.stroke()
          }

          ctx.globalAlpha = flashAlpha * 1.1
          ctx.strokeStyle = rayColor
          ctx.lineWidth = 1.9 * S
          for (let i = 0; i < rayCount; i++) {
            const ang = -Math.PI / 2 + i * Math.PI * 2 / rayCount
            const innerR = flashR * 0.16
            const outerR = flashR * (0.62 + burstP * 0.24 + (i % 2 === 0 ? 0.1 : 0))
            ctx.beginPath()
            ctx.moveTo(Math.cos(ang) * innerR, Math.sin(ang) * innerR)
            ctx.lineTo(Math.cos(ang) * outerR, Math.sin(ang) * outerR)
            ctx.stroke()
          }

          ctx.globalAlpha = flashAlpha * 0.86
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2.4 * S
          for (let i = 0; i < 4; i++) {
            const ang = Math.PI / 4 + i * Math.PI / 2
            ctx.beginPath()
            ctx.moveTo(Math.cos(ang) * flashR * 0.12, Math.sin(ang) * flashR * 0.12)
            ctx.lineTo(Math.cos(ang) * flashR * 0.78, Math.sin(ang) * flashR * 0.78)
            ctx.stroke()
          }
          ctx.restore()
        }
      }
    }
  }

  if (g._blockFlash > 0) {
    const bfAlpha = (g._blockFlash / 12) * 0.35
    FXComposer.drawGlowSpot(ctx, W*0.5, H*0.5, 200*S, '#7DE8FF', bfAlpha)
  }

  if (g._heroHurtFlash > 0) {
    ctx.save()
    const hfP = g._heroHurtFlash / 18
    const hfAlpha = g._heroHurtFlash > 12 ? 0.4 : hfP * 0.35
    ctx.fillStyle = `rgba(255,30,30,${hfAlpha})`
    ctx.fillRect(0, 0, W, H)
    if (g._heroHurtFlash > 6) {
      const vigR = Math.min(W, H) * 0.7
      ctx.fillStyle = `rgba(180,0,0,${hfP * 0.15})`
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
  }

  if (g._enemyWarning > 0) {
    ctx.save()
    const ewP = g._enemyWarning / 15
    const ewAlpha = ewP * 0.2 * (1 + Math.sin(g._enemyWarning * 0.8) * 0.5)
    ctx.fillStyle = `rgba(255,60,30,${ewAlpha})`
    ctx.fillRect(0, H * 0.6, W, H * 0.4)
    ctx.restore()
  }

  if (g._counterFlash && g._counterFlash.timer > 0) {
    const cfAlpha = (g._counterFlash.timer / 10) * 0.35
    const cfColor = g._counterFlash.color || '#ffd700'
    FXComposer.drawGlowSpot(ctx, W*0.5, g._getEnemyCenterY(), W*0.5, cfColor, cfAlpha)
  }
}

// ===== Combo显示（分发函数） =====
function drawCombo(g, cellSize, boardTop) {
  const { ctx, R, TH, W, H, S, COLS, ROWS } = V
  const { getComboMul } = require('../../engine/battle/damageFormula')
  const allowComboText = g.combo >= 2
    && (g.bState === 'elimAnim' || g.bState === 'dropping' || g.bState === 'preAttack' || g.bState === 'petAtkShow')

  if (allowComboText) {
    const ca = g._comboAnim || { num: g.combo, scale: 1, alpha: 1, offsetY: 0 }
    const comboScale = ca.scale || 1
    const comboAlpha = ca.alpha != null ? Math.max(ca.alpha, 0) : 1
    const comboOffY = ca.offsetY || 0

    const comboCx = W * 0.5
    const tier = getComboTier(g.combo)
    const isLow = tier === 0
    const comboCy = isLow
      ? g.boardY + (ROWS * g.cellSize) * 0.12 + comboOffY
      : g.boardY + (ROWS * g.cellSize) * 0.32 + comboOffY
    const isHigh = tier >= 1
    const isSuper = tier >= 2
    const isMega = tier >= 4
    // 颜色从配置中读取
    const milestone = COMBO_MILESTONES.find(m => m.tier === tier)
    const mainColor = milestone ? milestone.color : '#ffd700'
    const glowColor = isMega ? '#ff4060' : isSuper ? '#ff6080' : isHigh ? '#ffaa33' : '#ffe066'
    // 字体大小根据 tier 递增
    const baseSz = tier >= 4 ? 52*S : tier >= 3 ? 46*S : tier >= 2 ? 40*S : tier >= 1 ? 34*S : isLow ? 22*S : 32*S
    const lowAlphaMul = isLow ? 0.5 : 1.0
    const comboFont = `italic 900 ${baseSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

    const cs = {
      ctx, S, W, H, ROWS, comboCx, comboCy, baseSz, comboScale, comboAlpha, lowAlphaMul,
      mainColor, glowColor, comboFont,
      isLow, isHigh, isSuper, isMega,
      ca, combo: g.combo, quality: g._battleFxQuality || 'full'
    }

    ctx.save()
    ctx.globalAlpha = comboAlpha * lowAlphaMul

    if (!isLow) {
      drawComboBgEffects(cs)
    }

    drawComboMainText(cs)
    drawComboMilestone(cs)
    // 倍率标签
    if (g.combo >= 2) {
      const mul = getComboMul(g.combo)
      const mulText = `x${mul.toFixed(1)}`
      ctx.font = `bold ${baseSz * 0.42}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      const mulY = comboCy + baseSz * 0.62
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3 * S
      ctx.strokeText(mulText, comboCx, mulY)
      ctx.fillStyle = '#ffe082'
      ctx.fillText(mulText, comboCx, mulY)
    }

    ctx.restore()
  }

  drawComboVFX(g)
}


module.exports = { drawCombo }
