/**
 * 连击数字、里程碑、背景特效与全屏反馈
 */
const V = require('../env')
const { COMBO_MILESTONES, getComboTier, isComboMilestone } = require('../../data/constants')
const { estimateDamage } = require('../../engine/battle/damageEstimator')
const Particles = require('../../engine/particles')
const FXComposer = require('../../engine/effectComposer')

function drawComboBgEffects(cs) {
  const { ctx, S, W, comboCx, comboCy, baseSz, comboAlpha, isSuper, isMega, glowColor, ca } = cs
  const maskH = baseSz * 2.8
  const maskCy = comboCy + baseSz * 0.35
  const maskGrd = ctx.createLinearGradient(0, maskCy - maskH*0.5, 0, maskCy + maskH*0.5)
  maskGrd.addColorStop(0, 'transparent')
  maskGrd.addColorStop(0.15, 'rgba(0,0,0,0.4)')
  maskGrd.addColorStop(0.5, 'rgba(0,0,0,0.55)')
  maskGrd.addColorStop(0.85, 'rgba(0,0,0,0.4)')
  maskGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = maskGrd
  ctx.fillRect(0, maskCy - maskH*0.5, W, maskH)

  if (cs.combo >= 3) {
    const burstR = baseSz * (isSuper ? 2.2 : 1.5) * (ca.timer < 10 ? (2.0 - ca.timer / 10) : 1.0)
    FXComposer.drawGlowSpot(ctx, comboCx, comboCy, burstR, glowColor, isSuper ? 0.4 : 0.25)
  }

  if (isSuper && ca.timer < 20) {
    ctx.save()
    ctx.translate(comboCx, comboCy)
    const rayCount = isMega ? 18 : 12
    const rayLen = baseSz * 2.0 * Math.min(1, ca.timer / 8)
    const rayAlpha = Math.max(0, 1 - ca.timer / 20) * 0.7
    ctx.globalAlpha = comboAlpha * rayAlpha
    for (let r = 0; r < rayCount; r++) {
      const angle = (r / rayCount) * Math.PI * 2 + ca.timer * 0.08
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * baseSz * 0.25, Math.sin(angle) * baseSz * 0.25)
      ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen)
      ctx.strokeStyle = glowColor
      ctx.lineWidth = (isMega ? 4 : 2.5) * S
      ctx.stroke()
    }
    ctx.restore()
  }

  if (isComboMilestone(cs.combo) && ca.timer < 18) {
    ctx.save()
    const ringP = ca.timer / 18
    const ringR = baseSz * (0.5 + ringP * 3.5)
    const ringAlpha = (1 - ringP) * 0.8
    ctx.globalAlpha = comboAlpha * ringAlpha
    ctx.beginPath()
    ctx.arc(comboCx, comboCy, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : '#ffd700'
    ctx.lineWidth = (6 - ringP * 4) * S
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 15 * S
    ctx.stroke()
    if (ca.timer > 3) {
      const ringP2 = (ca.timer - 3) / 18
      const ringR2 = baseSz * (0.3 + ringP2 * 3)
      ctx.globalAlpha = comboAlpha * (1 - ringP2) * 0.5
      ctx.beginPath()
      ctx.arc(comboCx, comboCy, ringR2, 0, Math.PI * 2)
      ctx.lineWidth = (4 - ringP2 * 3) * S
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.restore()
  }
}

// ===== Combo里程碑文字（3/6/9/12连击，配置化） =====
function drawComboMilestone(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboScale, comboAlpha, ca, combo } = cs
  
  // 判断是否命中配置的里程碑
  const milestone = COMBO_MILESTONES.find(m => combo === m.threshold)
  if (!milestone || !ca || ca.timer > 50) return
  
  const mt = milestone.text
  
  ctx.save()
  // 位置在连击数字上方更高处，避免重叠
  const mileY = comboCy - baseSz * 1.8
  ctx.translate(comboCx, mileY)
  // 缩放动画：先大后小，动画更夸张
  const animProgress = Math.max(0, 1 - ca.timer / 30)
  const ms = comboScale * (1.0 + animProgress * 0.5)
  ctx.scale(ms, ms)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 里程碑字体更大
  ctx.font = `italic 900 ${baseSz * 1.1}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

  // 使用配置的颜色作为渐变
  const mg = ctx.createLinearGradient(-80*S, 0, 80*S, 0)
  mg.addColorStop(0, milestone.color)
  mg.addColorStop(0.5, '#ffffff')
  mg.addColorStop(1, milestone.color)

  // 黑色描边
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'
  ctx.lineWidth = 6 * S
  ctx.strokeText(mt, 0, 0)

  // 填充（带外发光）
  ctx.shadowColor = milestone.color
  ctx.shadowBlur = 20 * S
  ctx.fillStyle = mg
  ctx.fillText(mt, 0, 0)
  ctx.shadowBlur = 0

  // 闪光效果（前20帧）
  if (ca.timer < 20) {
    ctx.globalAlpha = (1 - ca.timer / 20) * 0.9
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 30 * S
    ctx.fillStyle = '#fff'
    ctx.fillText(mt, 0, 0)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

// ===== Combo主文字（简化版：数字+"连击"分开绘制） =====
function drawComboMainText(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboScale, mainColor, glowColor, combo, comboFont } = cs
  ctx.save()
  ctx.translate(comboCx, comboCy)
  ctx.scale(comboScale, comboScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  
  // 分离数字和"连击"二字，整体居中布局
  const numText = String(combo)
  const suffixText = '连击'
  
  // 测量文字宽度
  ctx.font = comboFont
  const numMetrics = ctx.measureText(numText)
  const numWidth = numMetrics.width
  
  // "连击"使用缩小字体
  const suffixSz = baseSz * 0.5
  ctx.font = `italic 700 ${suffixSz}px "PingFang SC",sans-serif`
  const suffixMetrics = ctx.measureText(suffixText)
  const suffixWidth = suffixMetrics.width
  
  // 计算整体居中位置：数字偏左，连击在右侧
  const gap = 4 * S  // 数字和"连击"之间的间隙
  const totalWidth = numWidth + gap + suffixWidth
  const startX = -totalWidth / 2  // 从左侧开始
  const numX = startX + numWidth / 2  // 数字居中位置
  const suffixX = startX + numWidth + gap + suffixWidth / 2  // "连击"居中位置
  
  // 绘制数字（主视觉）
  ctx.font = comboFont
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 5*S
  ctx.strokeText(numText, numX, 0)
  ctx.fillStyle = mainColor
  ctx.fillText(numText, numX, 0)
  
  // 简单的剪切高光（仅数字）
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(numX - baseSz*0.8, -baseSz*0.5)
  ctx.lineTo(numX + baseSz*0.6, -baseSz*0.5)
  ctx.lineTo(numX + baseSz*0.4, baseSz*0.05)
  ctx.lineTo(numX - baseSz, baseSz*0.05)
  ctx.clip()
  ctx.fillStyle = glowColor
  ctx.globalAlpha = 0.55
  ctx.fillText(numText, numX, 0)
  ctx.restore()
  
  // 绘制"连击"二字（弱化显示，灰色无彩色）
  ctx.font = `italic 700 ${suffixSz}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2*S
  ctx.strokeText(suffixText, suffixX, baseSz * 0.05)  // 稍微下沉对齐
  ctx.fillStyle = '#aaaaaa'  // 统一灰色，不随 tier 变化
  ctx.globalAlpha = 0.8
  ctx.fillText(suffixText, suffixX, baseSz * 0.05)
  ctx.globalAlpha = 1
  
  ctx.restore()
}

// ===== Combo伤害数值文字 =====
function drawComboDmgText(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboAlpha, dmgAlpha, dmgScale, extraPct, estTotalDmg, comboBonusPct } = cs
  if (dmgAlpha <= 0) return

  ctx.save()
  ctx.globalAlpha = comboAlpha * dmgAlpha
  // 位置下移，避免和主文字重叠
  const dmgCy = comboCy + baseSz * 0.9
  ctx.translate(comboCx, dmgCy)
  ctx.scale(dmgScale, dmgScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const dmgSz = baseSz * 0.65
  const dmgFont = `italic 700 ${dmgSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
  // 整合百分比到主文字
  let dmgText
  if (estTotalDmg > 0 && comboBonusPct > 0) {
    dmgText = `预估伤害 ${estTotalDmg} (+${comboBonusPct}%)`
  } else if (estTotalDmg > 0) {
    dmgText = `预估伤害 ${estTotalDmg}`
  } else {
    dmgText = `预估伤害 ${extraPct}%`
  }
  ctx.font = dmgFont
  // 简化：只保留描边+填充+简单高光
  const dmgGrd = ctx.createLinearGradient(0, -dmgSz*0.45, 0, dmgSz*0.4)
  dmgGrd.addColorStop(0, '#ff8888')
  dmgGrd.addColorStop(0.5, '#ff2040')
  dmgGrd.addColorStop(1, '#cc0020')
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 4*S
  ctx.strokeText(dmgText, 0, 0)
  ctx.fillStyle = dmgGrd
  ctx.fillText(dmgText, 0, 0)
  // 简单高光
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-dmgSz*2.5, -dmgSz*0.4)
  ctx.lineTo(dmgSz*2.5, -dmgSz*0.4)
  ctx.lineTo(dmgSz*2.2, -dmgSz*0.05)
  ctx.lineTo(-dmgSz*2.8, -dmgSz*0.05)
  ctx.clip()
  ctx.fillStyle = '#fff'
  ctx.globalAlpha = 0.4
  ctx.fillText(dmgText, 0, 0)
  ctx.restore()

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
        const tex = Particles.getStarTexture(p.color, Math.ceil(sz * 1.2))
        if (tex) {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.t * 0.15)
          const tw = tex.width || sz * 2.4
          ctx.drawImage(tex, -tw / 2, -tw / 2)
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
        const tex = Particles.getGlowTexture(p.color, Math.ceil(sz))
        if (tex) {
          const tw = tex.width || sz * 2
          ctx.drawImage(tex, p.x - tw / 2, p.y - tw / 2)
        } else {
          ctx.fillStyle = p.color
          ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill()
        }
      }
    }
    ctx.restore()
  }

  if (g._comboFlash > 0 && g.combo >= 2) {
    const flashAlpha = (g._comboFlash / 8) * (g.combo >= 12 ? 0.4 : g.combo >= 8 ? 0.3 : 0.2)
    const flashCy = g.boardY + (ROWS * g.cellSize) * 0.32
    const flashR = (g.combo >= 12 ? 120 : g.combo >= 8 ? 90 : g.combo >= 5 ? 70 : 50) * S
    FXComposer.drawGlowSpot(ctx, W*0.5, flashCy, flashR, '#fffff0', flashAlpha)
  }

  if (g._blockFlash > 0) {
    const bfAlpha = (g._blockFlash / 12) * 0.35
    FXComposer.drawGlowSpot(ctx, W*0.5, H*0.5, 200*S, '#7DE8FF', bfAlpha)
    g._blockFlash--
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
    g._heroHurtFlash--
  }

  if (g._enemyWarning > 0) {
    ctx.save()
    const ewP = g._enemyWarning / 15
    const ewAlpha = ewP * 0.2 * (1 + Math.sin(g._enemyWarning * 0.8) * 0.5)
    ctx.fillStyle = `rgba(255,60,30,${ewAlpha})`
    ctx.fillRect(0, H * 0.6, W, H * 0.4)
    ctx.restore()
    g._enemyWarning--
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
  if (g.combo < 2 || !(g.bState === 'elimAnim' || g.bState === 'dropping' || g.bState === 'preAttack' || g.bState === 'petAtkShow')) return

  const ca = g._comboAnim || { num: g.combo, scale: 1, alpha: 1, offsetY: 0, dmgScale: 1, dmgAlpha: 1 }
  const comboScale = ca.scale || 1
  const comboAlpha = ca.alpha != null ? Math.max(ca.alpha, 0) : 1
  const comboOffY = ca.offsetY || 0
  const dmgScale = ca.dmgScale || 0
  const dmgAlpha = ca.dmgAlpha || 0

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

  const est = estimateDamage(g)
  const comboBonusPct = est.comboBonusPct
  const extraPct = est.extraPct
  const estTotalDmg = est.estTotalDmg

  const comboText = `${g.combo} 连击`
  const comboFont = `italic 900 ${baseSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

  const cs = {
    ctx, S, W, H, ROWS, comboCx, comboCy, baseSz, comboScale, comboAlpha, lowAlphaMul,
    mainColor, glowColor, comboText, comboFont,
    isLow, isHigh, isSuper, isMega,
    dmgAlpha, dmgScale,
    extraPct, estTotalDmg, comboBonusPct,
    ca, combo: g.combo
  }

  ctx.save()
  ctx.globalAlpha = comboAlpha * lowAlphaMul

  if (!isLow) {
    drawComboBgEffects(cs)
  }

  drawComboMainText(cs)
  drawComboMilestone(cs)

  drawComboDmgText(cs)

  ctx.restore()

  drawComboVFX(g)
}


module.exports = { drawCombo }
