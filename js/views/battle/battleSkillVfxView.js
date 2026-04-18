/**
 * 技能光波、快闪、长按预览弹窗
 */
const V = require('../env')
const { TH } = require('../../render')
const { ATTR_COLOR } = require('../../data/tower')
const { getPetSkillDesc } = require('../../data/pets')
const P = require('../../platform')
const FXComposer = require('../../engine/effectComposer')

const _skillFlashTextCache = {}

function _getBattleFxQuality(g) {
  return (g && g._battleFxQuality) || 'full'
}

function _seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453123
  return x - Math.floor(x)
}

function _seededRange(seed, min, max) {
  return min + _seededUnit(seed) * (max - min)
}

function _getSkillFlashTextSprite(f, S) {
  if (!f || !P.createOffscreenCanvas) return null
  const hasDesc = !!f.skillDesc
  const key = [S, f.color || '', f.skillName || '', f.skillDesc || '', hasDesc ? '1' : '0'].join('|')
  if (_skillFlashTextCache[key]) return _skillFlashTextCache[key]

  const measureCanvas = P.createOffscreenCanvas({ type: '2d', width: 8, height: 8 })
  const measureCtx = measureCanvas.getContext('2d')
  // 重新调平：技能名是主标题（大+同元素色），描述是副标题（小+白），反过来强调"这是什么技能"
  const nameFont = hasDesc
    ? `italic 900 ${22 * S}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
    : `italic 900 ${24 * S}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
  const descFont = `bold ${14 * S}px "PingFang SC",sans-serif`
  measureCtx.font = nameFont
  const nameW = Math.ceil(measureCtx.measureText(f.skillName || '').width)
  measureCtx.font = descFont
  const descW = hasDesc ? Math.ceil(measureCtx.measureText(f.skillDesc || '').width) : 0

  const width = Math.max(1, Math.ceil(Math.max(nameW, descW) + 40 * S))
  const height = Math.max(1, Math.ceil((hasDesc ? 56 : 34) * S))
  const oc = P.createOffscreenCanvas({ type: '2d', width, height })
  const octx = oc.getContext('2d')
  const cx = width * 0.5
  const cy = height * 0.5

  octx.save()
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  if (hasDesc) {
    // 主标题（大 · 同色发光）
    octx.font = nameFont
    octx.strokeStyle = 'rgba(0,0,0,0.85)'
    octx.lineWidth = 4 * S
    octx.strokeText(f.skillName || '', cx, cy - 10 * S)
    octx.shadowColor = f.color || '#ffffff'
    octx.shadowBlur = 14 * S
    octx.fillStyle = '#ffffff'
    octx.fillText(f.skillName || '', cx, cy - 10 * S)
    octx.shadowBlur = 0
    // 副标题（小 · 金黄 · 胶囊底）
    const capTxtW = descW + 18 * S
    const capH = 20 * S
    const capX = cx - capTxtW / 2
    const capY = cy + 10 * S - capH / 2
    octx.fillStyle = 'rgba(14,10,4,0.78)'
    octx.beginPath()
    const rr = capH / 2
    octx.moveTo(capX + rr, capY)
    octx.arcTo(capX + capTxtW, capY, capX + capTxtW, capY + capH, rr)
    octx.arcTo(capX + capTxtW, capY + capH, capX, capY + capH, rr)
    octx.arcTo(capX, capY + capH, capX, capY, rr)
    octx.arcTo(capX, capY, capX + capTxtW, capY, rr)
    octx.fill()
    octx.strokeStyle = (f.color || '#ffd860') + 'cc'
    octx.lineWidth = 1 * S
    octx.stroke()
    octx.font = descFont
    octx.fillStyle = '#ffe08a'
    octx.fillText(f.skillDesc || '', cx, cy + 10 * S)
  } else {
    octx.font = nameFont
    octx.strokeStyle = 'rgba(0,0,0,0.8)'
    octx.lineWidth = 4 * S
    octx.strokeText(f.skillName || '', cx, cy)
    octx.shadowColor = f.color || '#ffffff'
    octx.shadowBlur = 14 * S
    octx.fillStyle = '#ffffff'
    octx.fillText(f.skillName || '', cx, cy)
    octx.shadowBlur = 0
  }
  octx.restore()

  const sprite = { canvas: oc, width, height, anchorX: cx, anchorY: cy }
  const keys = Object.keys(_skillFlashTextCache)
  if (keys.length >= 32) {
    for (let i = 0; i < 8; i++) delete _skillFlashTextCache[keys[i]]
  }
  _skillFlashTextCache[key] = sprite
  return sprite
}

function drawPetSkillWave(g) {
  const { ctx, TH, S } = V
  const wave = g._petSkillWave
  if (!wave) return
  wave.timer++
  if (wave.timer > wave.duration) { g._petSkillWave = null; return }

  const t = wave.timer
  const dur = wave.duration
  const p = t / dur
  const clr = wave.color || TH.accent
  const quality = _getBattleFxQuality(g)
  const qualityMul = quality === 'lite' ? 0.68 : (quality === 'medium' ? 0.84 : 1)

  const L = g._getBattleLayout()
  const iconSize = L.iconSize
  const iconY = L.teamBarY + (L.teamBarH - iconSize) / 2
  const sidePad = 8 * S, wpnGap = 12 * S, petGap = 8 * S
  // wave.petIdx 是 g.pets 数组索引；布局 [武器][pets[0]][pets[1]]...，跳过武器槽
  const ix = sidePad + iconSize + wpnGap + wave.petIdx * (iconSize + petGap)
  const startX = ix + iconSize * 0.5
  const startY = iconY
  const targetX = wave.targetX
  const targetY = wave.targetY

  if (!isFinite(startX) || !isFinite(startY) || !isFinite(targetX) || !isFinite(targetY) || !isFinite(iconSize)) {
    g._petSkillWave = null; return
  }
  if (wave._seed == null) {
    wave._seed = ((wave.petIdx == null ? 0 : wave.petIdx) + 1) * 131 + Math.round(targetX * 0.5) + Math.round(targetY * 0.25)
  }

  ctx.save()

  if (p < 0.15) {
    const chargeP = p / 0.15
    const chargeR = iconSize * (0.26 + chargeP * 0.18) * qualityMul
    if (chargeR > 0) {
      FXComposer.drawGlowSpot(ctx, startX, startY, chargeR, clr, (0.24 + chargeP * 0.3) * qualityMul)
      if (quality !== 'lite') {
        ctx.globalAlpha = (0.3 + chargeP * 0.36) * qualityMul
        ctx.fillStyle = '#ffffff'
        ctx.beginPath(); ctx.arc(startX, startY, Math.max(1, chargeR * 0.2), 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  if (p >= 0.1 && p < 0.6) {
    const flyP = (p - 0.1) / 0.5
    const easedP = 1 - Math.pow(1 - flyP, 2)
    const curX = startX + (targetX - startX) * easedP
    const curY = startY + (targetY - startY) * easedP
    const waveR = (18 * S + flyP * 12 * S) * qualityMul

    FXComposer.drawGlowSpot(ctx, curX, curY, waveR, clr, (0.36 - flyP * 0.1) * qualityMul)

    ctx.globalAlpha = 0.34 * (1 - flyP) * qualityMul
    const tailLen = (quality === 'lite' ? 24 : (quality === 'medium' ? 32 : 40)) * S
    const tailAngle = Math.atan2(targetY - startY, targetX - startX)
    const tailX = curX - Math.cos(tailAngle) * tailLen * flyP
    const tailY = curY - Math.sin(tailAngle) * tailLen * flyP
    const tailGrd = ctx.createLinearGradient(tailX, tailY, curX, curY)
    tailGrd.addColorStop(0, 'transparent')
    tailGrd.addColorStop(0.45, clr + '44')
    tailGrd.addColorStop(1, clr + 'aa')
    ctx.strokeStyle = tailGrd
    ctx.lineWidth = (quality === 'lite' ? 4 : 6) * S
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(curX, curY); ctx.stroke()

    const shardCount = quality === 'full' ? 4 : (quality === 'medium' ? 3 : 2)
    for (let i = 0; i < shardCount; i++) {
      const angle = Math.PI * 2 / shardCount * i + flyP * 3
      const dist = waveR * 0.58
      const px = curX + Math.cos(angle) * dist
      const py = curY + Math.sin(angle) * dist
      ctx.globalAlpha = 0.42 * (1 - flyP) * qualityMul
      ctx.fillStyle = i % 2 === 0 ? '#fff' : clr
      ctx.beginPath(); ctx.arc(px, py, (quality === 'lite' ? 2.1 : 3) * S, 0, Math.PI * 2); ctx.fill()
    }
  }

  if (p >= 0.5) {
    const hitP = (p - 0.5) / 0.5

    if (hitP < 0.3) {
      const coreR = (15 * S + hitP / 0.3 * 20 * S) * qualityMul
      FXComposer.drawGlowSpot(ctx, targetX, targetY, coreR, clr, ((0.3 - hitP) / 0.3) * 0.48 * qualityMul)
    }

    if (hitP < 0.6) {
      const lineP = hitP / 0.6
      const lineCount = quality === 'full' ? 12 : (quality === 'medium' ? 8 : 4)
      ctx.save()
      ctx.globalAlpha = (1 - lineP) * (quality === 'lite' ? 0.4 : 0.64)
      ctx.strokeStyle = clr
      ctx.lineWidth = (quality === 'lite' ? 1.4 : 2) * S
      if (quality !== 'lite') {
        ctx.shadowColor = clr
        ctx.shadowBlur = 4 * S
      }
      for (let i = 0; i < lineCount; i++) {
        const angle = (i / lineCount) * Math.PI * 2 + wave.timer * 0.05
        const innerR = 10 * S + lineP * 25 * S * qualityMul
        const outerR = innerR + _seededRange(wave._seed + i * 17 + Math.floor(hitP * 100), 6, quality === 'full' ? 20 : 14) * S * (1 - lineP)
        ctx.beginPath()
        ctx.moveTo(targetX + Math.cos(angle) * innerR, targetY + Math.sin(angle) * innerR)
        ctx.lineTo(targetX + Math.cos(angle) * outerR, targetY + Math.sin(angle) * outerR)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      ctx.restore()
    }

    const shardCount = quality === 'full' ? 16 : (quality === 'medium' ? 10 : 6)
    ctx.save()
    for (let i = 0; i < shardCount; i++) {
      const angle = (i / shardCount) * Math.PI * 2 + hitP * 2
      const speed = (quality === 'lite' ? 11 : 15) + (i % 3) * (quality === 'full' ? 8 : 5)
      const dist = hitP * speed * S
      const px = targetX + Math.cos(angle) * dist
      const py = targetY + Math.sin(angle) * dist
      const pr = (1 - hitP) * (quality === 'lite' ? 1.3 : 1.5 + (i % 4) * 0.5) * S
      ctx.globalAlpha = (1 - hitP * hitP) * (quality === 'lite' ? 0.5 : 0.7)
      ctx.fillStyle = i % 3 === 0 ? '#fff' : i % 3 === 1 ? clr : clr + 'cc'
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()

    if (hitP < 0.4 && quality !== 'lite') {
      const ringR = 12 * S + hitP / 0.4 * (quality === 'medium' ? 26 : 35) * S
      ctx.globalAlpha = (0.4 - hitP) / 0.4 * 0.42 * qualityMul
      ctx.strokeStyle = clr
      ctx.lineWidth = (quality === 'medium' ? 1.5 : 2) * S
      ctx.beginPath(); ctx.arc(targetX, targetY, ringR, 0, Math.PI * 2); ctx.stroke()
    }
  }

  ctx.restore()
}

// ===== 技能快闪（替代横幅，0.33秒即时反馈） =====
function drawSkillFlash(g) {
  const { ctx, W, H, S } = V
  const f = g._skillFlash
  if (!f) return
  f.timer++
  if (f.timer > f.duration) { g._skillFlash = null; return }

  const t = f.timer
  const dur = f.duration
  const quality = _getBattleFxQuality(g)
  const qualityMul = quality === 'lite' ? 0.68 : (quality === 'medium' ? 0.84 : 1)
  const textSprite = _getSkillFlashTextSprite(f, S)

  ctx.save()

  if (t <= 6) {
    const flashAlpha = (1 - t / 6) * (quality === 'lite' ? 0.12 : (quality === 'medium' ? 0.2 : 0.3))
    ctx.globalAlpha = flashAlpha * 0.42
    ctx.fillStyle = f.color
    ctx.fillRect(0, 0, W, H)
    FXComposer.drawGlowSpot(ctx, W * 0.5, H * 0.38, W * (quality === 'lite' ? 0.22 : 0.3), f.color, flashAlpha)
  }

  // 入场 [0..6] 2→1；稳定期 [6..dur*0.78] 保持+微弹；退场 [dur*0.78..dur] 1→0.7 & 1→0
  const stableEnd = Math.max(12, Math.round(dur * 0.78))
  const mainScale = t <= 6
    ? 2.0 - (t / 6) * 1.0
    : t <= stableEnd
      ? 1.0 + Math.sin((t - 6) / Math.max(1, stableEnd - 6) * Math.PI * 2) * 0.02
      : 1.0 - (t - stableEnd) / Math.max(1, dur - stableEnd) * 0.3
  const mainAlpha = t <= stableEnd ? 1 : 1 - (t - stableEnd) / Math.max(1, dur - stableEnd)
  const centerY = H * 0.36

  ctx.globalAlpha = mainAlpha
  ctx.translate(W * 0.5, centerY)
  ctx.scale(mainScale, mainScale)

  if (textSprite) {
    const drawW = textSprite.width
    const drawH = textSprite.height
    const drawX = -textSprite.anchorX
    const drawY = -textSprite.anchorY
    const echoAlpha = mainAlpha * (quality === 'lite' ? 0.08 : (quality === 'medium' ? 0.12 : 0.18))
    if (echoAlpha > 0.01) {
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = echoAlpha
      ctx.drawImage(textSprite.canvas, drawX, drawY - 1.2 * S, drawW, drawH)
      ctx.restore()
    }
    ctx.drawImage(textSprite.canvas, drawX, drawY, drawW, drawH)
  }

  if (t <= 10) {
    if (quality === 'lite') {
      FXComposer.drawGlowSpot(ctx, 0, 0, (30 + t * 3.2) * S, f.color, (1 - t / 10) * 0.18)
    } else {
      const ringR = 30 * S + (t / 10) * (quality === 'medium' ? 60 : 80) * S
      const ringAlpha = (1 - t / 10) * (quality === 'medium' ? 0.42 : 0.6)
      ctx.globalAlpha = ringAlpha
      ctx.beginPath()
      ctx.arc(0, 0, ringR, 0, Math.PI * 2)
      ctx.strokeStyle = f.color
      ctx.lineWidth = (quality === 'medium' ? 3 : (4 - t / 10 * 3)) * S
      ctx.stroke()
    }
  }

  ctx.restore()
}

// ===== 技能预览弹窗（长按宠物显示） =====
function drawSkillPreviewPopup(g) {
  const { ctx, R, TH, W, H, S } = V
  const sp = g.skillPreview
  if (!sp) return
  const pet = sp.pet
  const sk = pet.skill
  if (!sk) return

  const popW = W * 0.6, popH = 80*S
  const popX = Math.max(4*S, Math.min(W - popW - 4*S, sp.x - popW/2))
  const popY = sp.y

  // 入场动画
  const fadeIn = Math.min(1, sp.timer / 8)
  const scale = 0.8 + 0.2 * fadeIn

  ctx.save()
  ctx.globalAlpha = fadeIn
  ctx.translate(popX + popW/2, popY)
  ctx.scale(scale, scale)
  ctx.translate(-(popX + popW/2), -popY)

  // 背景
  ctx.fillStyle = 'rgba(16,16,32,0.95)'
  R.rr(popX, popY, popW, popH, 10*S); ctx.fill()
  // 属性色上边条
  const attrColor = (ATTR_COLOR[pet.attr] && ATTR_COLOR[pet.attr].main) || TH.accent
  ctx.fillStyle = attrColor
  ctx.save()
  ctx.beginPath(); R.rr(popX, popY, popW, 4*S, 10*S); ctx.clip()
  ctx.fillRect(popX, popY, popW, 4*S)
  ctx.restore()
  // 边框
  ctx.strokeStyle = attrColor + '88'; ctx.lineWidth = 1.5*S
  R.rr(popX, popY, popW, popH, 10*S); ctx.stroke()

  // 宠物名 + 技能名
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillStyle = attrColor; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(pet.name, popX + 10*S, popY + 20*S)
  ctx.fillStyle = '#fff'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(sk.name, popX + 10*S, popY + 40*S)
  // 技能描述
  ctx.fillStyle = '#bbb'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(getPetSkillDesc(pet) || '无描述', popX + 10*S, popY + 58*S)
  // CD
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(`CD: ${pet.cd}回合`, popX + popW - 10*S, popY + 20*S)

  // 三角箭头指向头像
  ctx.fillStyle = 'rgba(16,16,32,0.95)'
  const triX = Math.max(popX + 15*S, Math.min(popX + popW - 15*S, sp.x))
  ctx.beginPath()
  ctx.moveTo(triX - 8*S, popY)
  ctx.lineTo(triX, popY - 8*S)
  ctx.lineTo(triX + 8*S, popY)
  ctx.fill()

  ctx.restore()
}

module.exports = { drawPetSkillWave, drawSkillFlash, drawSkillPreviewPopup }
