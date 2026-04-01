/**
 * 技能光波、快闪、长按预览弹窗
 */
const V = require('../env')
const { TH } = require('../../render')
const { ATTR_COLOR } = require('../../data/tower')
const { getPetSkillDesc } = require('../../data/pets')

function drawPetSkillWave(g) {
  const { ctx, R, TH, W, H, S } = V
  const wave = g._petSkillWave
  if (!wave) return
  wave.timer++
  if (wave.timer > wave.duration) { g._petSkillWave = null; return }

  const t = wave.timer
  const dur = wave.duration
  const p = t / dur  // 0→1 进度
  const clr = wave.color || TH.accent

  // 计算宠物头像位置（光波起点）
  const L = g._getBattleLayout()
  const iconSize = L.iconSize
  const iconY = L.teamBarY + (L.teamBarH - iconSize) / 2
  const sidePad = 8*S, wpnGap = 12*S, petGap = 8*S
  let ix
  if (wave.petIdx === 0) { ix = sidePad }
  else { ix = sidePad + iconSize + wpnGap + (wave.petIdx - 1) * (iconSize + petGap) }
  const startX = ix + iconSize * 0.5
  const startY = iconY
  const targetX = wave.targetX
  const targetY = wave.targetY

  // 安全检查：坐标值必须是有限数值，否则 createRadialGradient 会抛异常导致渲染循环中断
  if (!isFinite(startX) || !isFinite(startY) || !isFinite(targetX) || !isFinite(targetY) || !isFinite(iconSize)) {
    g._petSkillWave = null; return
  }

  ctx.save()

  // 阶段1（0-0.15）：宠物头像蓄力光环
  if (p < 0.15) {
    const chargeP = p / 0.15
    const chargeR = iconSize * 0.4 * chargeP
    if (chargeR > 0) {
      ctx.globalAlpha = 0.6 + chargeP * 0.4
      const chargeGrd = ctx.createRadialGradient(startX, startY, 0, startX, startY, chargeR)
      chargeGrd.addColorStop(0, '#fff')
      chargeGrd.addColorStop(0.5, clr)
      chargeGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = chargeGrd
      ctx.beginPath(); ctx.arc(startX, startY, chargeR, 0, Math.PI*2); ctx.fill()
    }
  }

  // 阶段2（0.1-0.6）：光波从宠物飞向敌人
  if (p >= 0.1 && p < 0.6) {
    const flyP = (p - 0.1) / 0.5  // 0→1
    const easedP = 1 - Math.pow(1 - flyP, 2)  // ease-out
    const curX = startX + (targetX - startX) * easedP
    const curY = startY + (targetY - startY) * easedP
    const waveR = 18*S + flyP * 12*S

    // 光波主体
    ctx.globalAlpha = 0.9 - flyP * 0.3
    const waveGrd = ctx.createRadialGradient(curX, curY, 0, curX, curY, waveR)
    waveGrd.addColorStop(0, '#fff')
    waveGrd.addColorStop(0.3, clr)
    waveGrd.addColorStop(0.7, clr + '88')
    waveGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = waveGrd
    ctx.beginPath(); ctx.arc(curX, curY, waveR, 0, Math.PI*2); ctx.fill()

    // 光波拖尾
    ctx.globalAlpha = 0.4 * (1 - flyP)
    const tailLen = 40*S
    const tailAngle = Math.atan2(targetY - startY, targetX - startX)
    const tailX = curX - Math.cos(tailAngle) * tailLen * flyP
    const tailY = curY - Math.sin(tailAngle) * tailLen * flyP
    const tailGrd = ctx.createLinearGradient(tailX, tailY, curX, curY)
    tailGrd.addColorStop(0, 'transparent')
    tailGrd.addColorStop(0.5, clr + '44')
    tailGrd.addColorStop(1, clr + 'aa')
    ctx.strokeStyle = tailGrd
    ctx.lineWidth = 6*S
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(curX, curY); ctx.stroke()

    // 光波碎片
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI*2 / 4 * i + flyP * 3
      const dist = waveR * 0.6
      const px = curX + Math.cos(angle) * dist
      const py = curY + Math.sin(angle) * dist
      ctx.globalAlpha = 0.5 * (1 - flyP)
      ctx.fillStyle = i % 2 === 0 ? '#fff' : clr
      ctx.beginPath(); ctx.arc(px, py, 3*S, 0, Math.PI*2); ctx.fill()
    }
  }

  // 阶段3（0.5-1.0）：命中 — 密集碎片+速度线+闪光（非大爆炸）
  if (p >= 0.5) {
    const hitP = (p - 0.5) / 0.5  // 0→1

    // 紧凑闪光核心（半径小，衰减快）
    if (hitP < 0.3) {
      const coreR = 15*S + hitP / 0.3 * 20*S
      ctx.globalAlpha = (0.3 - hitP) / 0.3 * 0.8
      const coreGrd = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, coreR)
      coreGrd.addColorStop(0, '#fff')
      coreGrd.addColorStop(0.5, clr)
      coreGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGrd
      ctx.beginPath(); ctx.arc(targetX, targetY, coreR, 0, Math.PI*2); ctx.fill()
    }

    // 速度线（从命中点向外放射的短线）
    if (hitP < 0.6) {
      const lineP = hitP / 0.6
      ctx.save()
      ctx.globalAlpha = (1 - lineP) * 0.7
      ctx.strokeStyle = clr; ctx.lineWidth = 2*S
      ctx.shadowColor = clr; ctx.shadowBlur = 6*S
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + wave.timer * 0.05
        const innerR = 10*S + lineP * 25*S
        const outerR = innerR + (8 + Math.random() * 12) * S * (1 - lineP)
        ctx.beginPath()
        ctx.moveTo(targetX + Math.cos(angle) * innerR, targetY + Math.sin(angle) * innerR)
        ctx.lineTo(targetX + Math.cos(angle) * outerR, targetY + Math.sin(angle) * outerR)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // 密集碎片粒子（小而多，快速扩散）
    ctx.save()
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + hitP * 2
      const speed = 15 + (i % 3) * 8
      const dist = hitP * speed * S
      const px = targetX + Math.cos(angle) * dist
      const py = targetY + Math.sin(angle) * dist
      const pr = (1 - hitP) * (1.5 + (i % 4) * 0.5) * S
      ctx.globalAlpha = (1 - hitP * hitP) * 0.7
      ctx.fillStyle = i % 3 === 0 ? '#fff' : i % 3 === 1 ? clr : clr + 'cc'
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill()
    }
    ctx.restore()

    // 薄冲击环（比原来小很多，仅一个快速扩散环）
    if (hitP < 0.4) {
      const ringR = 12*S + hitP / 0.4 * 35*S
      ctx.globalAlpha = (0.4 - hitP) / 0.4 * 0.5
      ctx.strokeStyle = clr; ctx.lineWidth = (2 - hitP * 4) * S
      ctx.beginPath(); ctx.arc(targetX, targetY, ringR, 0, Math.PI*2); ctx.stroke()
    }
  }

  ctx.restore()
}

// ===== 技能快闪（替代横幅，0.33秒即时反馈） =====
function drawSkillFlash(g) {
  const { ctx, R, TH, W, H, S } = V
  const f = g._skillFlash
  if (!f) return
  f.timer++
  if (f.timer > f.duration) { g._skillFlash = null; return }

  const t = f.timer
  const dur = f.duration
  const p = t / dur  // 0→1 进度

  ctx.save()

  // 全屏属性色闪光（快速衰减）
  if (t <= 6) {
    const flashAlpha = (1 - t / 6) * 0.3
    const flashGrd = ctx.createRadialGradient(W*0.5, H*0.38, 0, W*0.5, H*0.38, W*0.6)
    flashGrd.addColorStop(0, f.color)
    flashGrd.addColorStop(0.5, f.color + '44')
    flashGrd.addColorStop(1, 'transparent')
    ctx.globalAlpha = flashAlpha
    ctx.fillStyle = flashGrd
    ctx.fillRect(0, 0, W, H)
  }

  // 整体弹入缩放
  const mainScale = t <= 6
    ? 2.0 - (t / 6) * 1.0  // 2.0→1.0 放大弹入
    : t <= 12
      ? 1.0 + Math.sin((t - 6) / 6 * Math.PI) * 0.05  // 微微呼吸
      : 1.0 - (t - 12) / (dur - 12) * 0.3  // 缩小消失
  const mainAlpha = t <= 12 ? 1 : 1 - (t - 12) / (dur - 12)

  const hasDesc = !!f.skillDesc
  // 有描述时：技能名在上方做小标签，描述居中做主体；无描述时技能名做主体
  const centerY = hasDesc ? H * 0.36 : H * 0.36

  ctx.globalAlpha = mainAlpha
  ctx.translate(W*0.5, centerY)
  ctx.scale(mainScale, mainScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

  if (hasDesc) {
    // --- 技能名（弱化：小字号、半透明、属性色，在描述上方） ---
    ctx.save()
    ctx.globalAlpha = mainAlpha * 0.6
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2*S
    ctx.strokeText(f.skillName, 0, -20*S)
    ctx.fillStyle = f.color
    ctx.fillText(f.skillName, 0, -20*S)
    ctx.shadowBlur = 0
    ctx.restore()

    // --- 技能描述（主体：大字号、高亮、发光） ---
    ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
    ctx.shadowColor = f.color; ctx.shadowBlur = 16*S
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4*S
    ctx.strokeText(f.skillDesc, 0, 6*S)
    ctx.fillStyle = '#fff'
    ctx.fillText(f.skillDesc, 0, 6*S)
    ctx.shadowBlur = 0
  } else {
    // --- 无描述：技能名做主体（攻击技能等） ---
    ctx.font = `italic 900 ${24*S}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
    ctx.shadowColor = f.color; ctx.shadowBlur = 20*S
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4*S
    ctx.strokeText(f.skillName, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillText(f.skillName, 0, 0)
    ctx.shadowBlur = 0
  }

  // 属性色光环扩散
  if (t <= 10) {
    const ringR = 30*S + (t / 10) * 80*S
    const ringAlpha = (1 - t / 10) * 0.6
    ctx.globalAlpha = ringAlpha
    ctx.beginPath()
    ctx.arc(0, 0, ringR, 0, Math.PI*2)
    ctx.strokeStyle = f.color
    ctx.lineWidth = (4 - t / 10 * 3) * S
    ctx.stroke()
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
