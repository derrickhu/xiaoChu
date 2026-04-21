/**
 * 战斗场景：敌人立绘区、血条、层数标签、Debuff 视觉
 */
const V = require('../env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY, ENEMY_SKILLS } = require('../../data/tower')
const tutorial = require('../../engine/tutorial')
const { getBattleLayout } = require('./battleLayout')

function _drawStar(ctx, x, y, r) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5)
    const outerX = x + Math.cos(angle) * r
    const outerY = y + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(outerX, outerY)
    else ctx.lineTo(outerX, outerY)
    const innerAngle = angle + Math.PI / 5
    const innerR = r * 0.4
    ctx.lineTo(x + Math.cos(innerAngle) * innerR, y + Math.sin(innerAngle) * innerR)
  }
  ctx.closePath()
  ctx.fill()
}


// ===== 敌人 Debuff 染色离屏canvas =====
let _debuffOC = null
let _debuffOCCtx = null
function _getDebuffTintCanvas(enemyImg, w, h, tintColor) {
  if (!enemyImg || !enemyImg.width) return null
  // 微信小游戏环境下创建离屏canvas
  try {
    const iw = Math.ceil(w)
    const ih = Math.ceil(h)
    if (!_debuffOC || _debuffOC.width !== iw || _debuffOC.height !== ih) {
      const P = V.P
      _debuffOC = P && P.createOffscreenCanvas ? P.createOffscreenCanvas({ type: '2d', width: iw, height: ih }) : null
      if (!_debuffOC) return null
      _debuffOCCtx = _debuffOC.getContext('2d')
    }
    const oc = _debuffOCCtx
    oc.clearRect(0, 0, iw, ih)
    oc.globalCompositeOperation = 'source-over'
    oc.globalAlpha = 1
    oc.drawImage(enemyImg, 0, 0, iw, ih)
    // source-atop：仅在已有像素（敌人轮廓）上着色
    oc.globalCompositeOperation = 'source-atop'
    oc.fillStyle = tintColor
    oc.fillRect(0, 0, iw, ih)
    oc.globalCompositeOperation = 'source-over'
    return _debuffOC
  } catch (e) {
    return null
  }
}
function _drawEnemyDebuffVFX(g, imgX, imgY, imgW, imgH, enemyImg) {
  const { ctx, R, S } = V
  const bufs = g.enemyBuffs
  const hasBuffs = bufs && bufs.length > 0
  const hasBreakDef = g.enemy && g.enemy.def === 0 && g.enemy.baseDef > 0
  if (!hasBuffs && !hasBreakDef) return
  if (g._enemyDeathAnim) return

  const af = g.af || 0
  const cx = imgX + imgW / 2
  const cy = imgY + imgH / 2

  // 分类检测（眩晕与冰冻共用"跳过普攻"控制语义，但视觉主题不同）
  const controlBuff = hasBuffs ? bufs.find(b => b.type === 'stun' || b.type === 'freeze') : null
  const hasStun = !!controlBuff
  const isFreeze = !!controlBuff && controlBuff.type === 'freeze'
  const hasDot = hasBuffs && bufs.some(b => b.type === 'dot')
  const hasAtkBuff = hasBuffs && bufs.some(b => b.type === 'buff' && b.field === 'atk')
  const hasDefBuff = hasBuffs && bufs.some(b => b.type === 'buff' && b.field === 'def')
  const hasMirror = hasBuffs && bufs.some(b => b.type === 'bossMirror')
  const hasVulnerable = hasBuffs && bufs.some(b => b.type === 'vulnerable')

  // --- 1. 中毒/灼烧 ---
  if (hasDot) {
    const dots = bufs.filter(b => b.type === 'dot')
    const isBurn = dots.some(b => b.dotType === 'burn' || b.name === '灼烧')
    const isPoison = dots.some(b => b.dotType === 'poison' || (b.dotType !== 'burn' && b.name !== '灼烧'))

    ctx.save()
    if (isPoison) {
      const tintAlpha = 0.3 + 0.1 * Math.sin(af * 0.1)
      const oc = _getDebuffTintCanvas(enemyImg, imgW, imgH, '#00ff40')
      if (oc) {
        ctx.globalAlpha = tintAlpha
        ctx.drawImage(oc, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }
      // 底部毒雾
      const fogY = imgY + imgH * 0.7
      const fogH = imgH * 0.35
      const fogGrd = ctx.createLinearGradient(cx, fogY + fogH, cx, fogY)
      fogGrd.addColorStop(0, 'rgba(30,200,60,0.35)')
      fogGrd.addColorStop(0.5, 'rgba(30,200,60,0.15)')
      fogGrd.addColorStop(1, 'rgba(30,200,60,0)')
      ctx.fillStyle = fogGrd
      const fogWobble = Math.sin(af * 0.04) * 6 * S
      ctx.fillRect(imgX - 8 * S + fogWobble, fogY, imgW + 16 * S, fogH)
      // 毒液滴落粒子（更大更多）
      for (let i = 0; i < 10; i++) {
        const px = imgX + imgW * 0.1 + (i / 10) * imgW * 0.8
        const speed = 0.05 + (i % 4) * 0.015
        const py = imgY + imgH * 0.2 + ((af * speed + i * 31) % (imgH * 0.7))
        const pAlpha = 0.7 - ((af * speed + i * 31) % (imgH * 0.7)) / (imgH * 0.7) * 0.7
        const pSize = (3 + (i % 3) * 1.5) * S
        ctx.globalAlpha = pAlpha
        ctx.fillStyle = '#40ff60'
        ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#20cc40'
        ctx.globalAlpha = pAlpha * 0.5
        ctx.beginPath(); ctx.arc(px, py - pSize * 2.5, pSize * 0.7, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (isBurn) {
      const burnAlpha = 0.3 + 0.1 * Math.sin(af * 0.12)
      const oc = _getDebuffTintCanvas(enemyImg, imgW, imgH, '#ff4400')
      if (oc) {
        ctx.globalAlpha = burnAlpha
        ctx.drawImage(oc, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }
      // 底部橙色光晕
      const glowR = imgW * 0.45
      const glowY = imgY + imgH * 0.85
      const glowAlpha = 0.25 + 0.1 * Math.sin(af * 0.1)
      const grd = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, glowR)
      grd.addColorStop(0, `rgba(255,120,20,${glowAlpha})`)
      grd.addColorStop(1, 'rgba(255,80,0,0)')
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(cx, glowY, glowR, 0, Math.PI * 2); ctx.fill()
      // 火焰粒子（更大更亮）
      for (let i = 0; i < 12; i++) {
        const baseX = imgX + imgW * 0.05 + (i / 12) * imgW * 0.9
        const speed = 0.07 + (i % 4) * 0.02
        const phase = (af * speed + i * 43) % (imgH * 0.8)
        const py = imgY + imgH - phase
        const pAlpha = 0.85 - phase / (imgH * 0.8) * 0.85
        const wobble = Math.sin(af * 0.15 + i * 2.3) * 5 * S
        const pSize = (3.5 + (i % 3) * 1.5) * S * (1 - phase / (imgH * 0.8) * 0.4)
        ctx.globalAlpha = pAlpha
        const colors = ['#ff4010', '#ff8020', '#ffbb30', '#ffdd60']
        ctx.fillStyle = colors[i % 4]
        ctx.beginPath(); ctx.arc(baseX + wobble, py, pSize, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  // --- 2. 控制效果：头顶旋转星星/雪花 + 晕圈 + 文字（眩晕金色 / 冰冻冰蓝）---
  if (hasStun) {
    ctx.save()
    const stunCx = cx
    const stunCy = imgY + imgH * 0.02
    const starCount = 5
    const orbitR = imgW * 0.28
    // 色板按控制类型切换；动画参数完全共用
    const palette = isFreeze
      ? { ringA: '#88ddff', ringB: '#55bbff', starA: '#aaeeff', starB: '#77ccff', glow: '#aaeeff', text: '#aaeeff', label: '冰冻' }
      : { ringA: '#ffee55', ringB: '#ffcc22', starA: '#ffee44', starB: '#ffbb22', glow: '#ffee44', text: '#ffee44', label: '眩晕' }

    // 双层晕圈
    for (let layer = 0; layer < 2; layer++) {
      ctx.globalAlpha = (0.4 + 0.2 * Math.sin(af * 0.08 + layer)) * (layer === 0 ? 1 : 0.5)
      ctx.strokeStyle = layer === 0 ? palette.ringA : palette.ringB
      ctx.lineWidth = (layer === 0 ? 2.5 : 1.5) * S
      ctx.beginPath()
      ctx.ellipse(stunCx, stunCy, orbitR * (1 + layer * 0.15), orbitR * 0.35 * (1 + layer * 0.15), 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 旋转星星（冰冻时视觉上也是五角星，只是改冰蓝配色；动画共用）
    for (let i = 0; i < starCount; i++) {
      const angle = (af * 0.07) + (i / starCount) * Math.PI * 2
      const sx = stunCx + Math.cos(angle) * orbitR
      const sy = stunCy + Math.sin(angle) * orbitR * 0.35
      const starSize = (5 + Math.sin(af * 0.15 + i) * 1.5) * S
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(af * 0.12 + i * 1.5)
      ctx.fillStyle = i % 2 === 0 ? palette.starA : palette.starB
      _drawStar(ctx, sx, sy, starSize)
      ctx.globalAlpha = 0.3
      ctx.fillStyle = palette.glow
      ctx.beginPath(); ctx.arc(sx, sy, starSize * 1.8, 0, Math.PI * 2); ctx.fill()
    }

    ctx.globalAlpha = 0.7 + 0.2 * Math.sin(af * 0.1)
    ctx.fillStyle = palette.text
    ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2 * S
    ctx.strokeText(palette.label, stunCx, stunCy - orbitR * 0.35 - 8 * S)
    ctx.fillText(palette.label, stunCx, stunCy - orbitR * 0.35 - 8 * S)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 3. 破甲（防御为0）---
  if (hasBreakDef) {
    ctx.save()
    const bkPulse = 0.7 + 0.3 * Math.sin(af * 0.12)
    ctx.globalAlpha = bkPulse

    const tagW = 46 * S, tagH = 18 * S
    const tagX = cx - tagW / 2
    const tagY = imgY + imgH - 6 * S

    // 标签背景
    ctx.fillStyle = 'rgba(200,30,30,0.85)'
    R.rr(tagX, tagY, tagW, tagH, 4 * S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,100,100,0.6)'; ctx.lineWidth = 1.5 * S
    R.rr(tagX, tagY, tagW, tagH, 4 * S); ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2 * S
    ctx.strokeText('破 防', cx, tagY + tagH / 2)
    ctx.fillText('破 防', cx, tagY + tagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 4. 攻击增益 buff：红色光晕 + 上升粒子 ---
  if (hasAtkBuff) {
    ctx.save()
    // 红色径向光晕（脉冲呼吸）
    const atkGlow = 0.2 + 0.12 * Math.sin(af * 0.1)
    const atkAuraR = Math.max(imgW, imgH) * 0.55
    const atkGrd = ctx.createRadialGradient(cx, cy, atkAuraR * 0.2, cx, cy, atkAuraR)
    atkGrd.addColorStop(0, `rgba(255,50,30,${atkGlow * 0.5})`)
    atkGrd.addColorStop(0.6, `rgba(255,40,40,${atkGlow})`)
    atkGrd.addColorStop(1, 'rgba(255,20,20,0)')
    ctx.fillStyle = atkGrd
    ctx.beginPath(); ctx.arc(cx, cy, atkAuraR, 0, Math.PI * 2); ctx.fill()

    // 上升红色能量粒子
    for (let i = 0; i < 6; i++) {
      const px = imgX + imgW * 0.15 + (i / 6) * imgW * 0.7
      const speed = 0.06 + (i % 3) * 0.02
      const phase = (af * speed + i * 53) % (imgH * 0.6)
      const py = imgY + imgH * 0.8 - phase
      const pAlpha = 0.6 - phase / (imgH * 0.6) * 0.6
      ctx.globalAlpha = pAlpha
      ctx.fillStyle = '#ff4040'
      const pSize = (2.5 + (i % 2)) * S
      ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill()
    }

    // "攻↑" 标签
    ctx.globalAlpha = 0.8 + 0.15 * Math.sin(af * 0.1)
    const atkTagW = 32 * S, atkTagH = 14 * S
    const atkTagX = imgX + imgW - atkTagW - 2 * S
    const atkTagY = imgY + 2 * S
    ctx.fillStyle = 'rgba(200,30,30,0.8)'
    R.rr(atkTagX, atkTagY, atkTagW, atkTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('攻↑', atkTagX + atkTagW / 2, atkTagY + atkTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 5. 防御增益 buff：蓝金盾形光环 ---
  if (hasDefBuff) {
    ctx.save()
    const defPulse = 0.3 + 0.15 * Math.sin(af * 0.08)
    // 蓝金色半透明椭圆护盾
    ctx.globalAlpha = defPulse
    const shieldRx = imgW * 0.55 + Math.sin(af * 0.06) * 3 * S
    const shieldRy = imgH * 0.5 + Math.sin(af * 0.06) * 2 * S
    ctx.strokeStyle = '#60aaff'
    ctx.lineWidth = 3 * S
    ctx.shadowColor = '#4090ff'; ctx.shadowBlur = 8 * S
    ctx.beginPath()
    ctx.ellipse(cx, cy, shieldRx, shieldRy, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    // 内层金色薄环
    ctx.globalAlpha = defPulse * 0.6
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 1.5 * S
    ctx.beginPath()
    ctx.ellipse(cx, cy, shieldRx * 0.9, shieldRy * 0.9, 0, 0, Math.PI * 2)
    ctx.stroke()

    // "防↑" 标签
    ctx.globalAlpha = 0.8 + 0.15 * Math.sin(af * 0.1 + 1)
    const defTagW = 32 * S, defTagH = 14 * S
    const defTagX = imgX + 2 * S
    const defTagY = imgY + 2 * S
    ctx.fillStyle = 'rgba(40,100,200,0.8)'
    R.rr(defTagX, defTagY, defTagW, defTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('防↑', defTagX + defTagW / 2, defTagY + defTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 6. bossMirror（妖力护体/反弹）：紫色旋转护盾 ---
  if (hasMirror) {
    ctx.save()
    const mirrorBuf = bufs.find(b => b.type === 'bossMirror')
    const reflectPct = mirrorBuf ? (mirrorBuf.reflectPct || 30) : 30
    const mPulse = 0.35 + 0.15 * Math.sin(af * 0.09)
    const mR = Math.max(imgW, imgH) * 0.55

    // 旋转六边形护盾
    const segCount = 6
    const rotAngle = af * 0.03
    ctx.globalAlpha = mPulse
    ctx.strokeStyle = '#cc66ff'
    ctx.lineWidth = 2.5 * S
    ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 10 * S
    ctx.beginPath()
    for (let i = 0; i <= segCount; i++) {
      const a = rotAngle + (i / segCount) * Math.PI * 2
      const px = cx + Math.cos(a) * mR * 0.52
      const py = cy + Math.sin(a) * mR * 0.48
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.shadowBlur = 0

    // 闪烁顶点光点
    for (let i = 0; i < segCount; i++) {
      const a = rotAngle + (i / segCount) * Math.PI * 2
      const px = cx + Math.cos(a) * mR * 0.52
      const py = cy + Math.sin(a) * mR * 0.48
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(af * 0.15 + i * 1.2)
      ctx.fillStyle = '#dd88ff'
      ctx.beginPath(); ctx.arc(px, py, 3 * S, 0, Math.PI * 2); ctx.fill()
    }

    // "反弹X%" 标签
    ctx.globalAlpha = 0.85
    const mTagW = 46 * S, mTagH = 14 * S
    const mTagX = cx - mTagW / 2
    const mTagY = imgY + imgH + 2 * S
    ctx.fillStyle = 'rgba(140,50,200,0.8)'
    R.rr(mTagX, mTagY, mTagW, mTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#eeddff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`反弹${reflectPct}%`, cx, mTagY + mTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 7. vulnerable（易伤）：黄色闪烁光晕 ---
  if (hasVulnerable) {
    ctx.save()
    const vPulse = 0.2 + 0.15 * Math.abs(Math.sin(af * 0.15))
    const vAuraR = Math.max(imgW, imgH) * 0.5
    const vGrd = ctx.createRadialGradient(cx, cy, vAuraR * 0.3, cx, cy, vAuraR)
    vGrd.addColorStop(0, `rgba(255,220,0,${vPulse * 0.4})`)
    vGrd.addColorStop(0.6, `rgba(255,200,0,${vPulse})`)
    vGrd.addColorStop(1, 'rgba(255,180,0,0)')
    ctx.fillStyle = vGrd
    ctx.beginPath(); ctx.arc(cx, cy, vAuraR, 0, Math.PI * 2); ctx.fill()

    // "易伤" 标签
    ctx.globalAlpha = 0.8
    const vTagW = 34 * S, vTagH = 14 * S
    const vTagX = cx - vTagW / 2
    const vTagY = imgY - vTagH - 2 * S
    ctx.fillStyle = 'rgba(200,160,0,0.8)'
    R.rr(vTagX, vTagY, vTagW, vTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('易伤', cx, vTagY + vTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }
}

// ===== 战斗界面：怪物区域绘制 =====
function drawBattleEnemyArea(g, eAreaTop, eAreaBottom) {
  const { ctx, R, TH, W, H, S } = V
  const eAreaH = eAreaBottom - eAreaTop
  const ac = ATTR_COLOR[g.enemy.attr]
  const themeBg = 'theme_' + (g.enemy.attr || 'metal')
  R.drawEnemyAreaBg(g.af, themeBg, eAreaTop, eAreaBottom, g.enemy.attr, g.enemy.battleBg)

  const eHpH = 14*S
  // 敌人血条顶 Y：统一从 battleLayout 读取（见 enemyHpTopY 字段注释）
  // 原值 eAreaBottom - 26*S 已上移至 eAreaBottom - 48*S，把原位置留给独立 debuff 行
  const hpY = getBattleLayout().enemyHpTopY
  const hpBarW = W * 0.72
  const hpBarX = (W - hpBarW) / 2
  if (g.enemy.isBoss || g.enemy.isElite) {
    ctx.save()
    const hpGlowColor = ac ? ac.main : '#ff4040'
    ctx.shadowColor = hpGlowColor; ctx.shadowBlur = 10*S
    ctx.strokeStyle = hpGlowColor + '88'; ctx.lineWidth = 2*S
    R.rr(hpBarX - 2*S, hpY - 2*S, hpBarW + 4*S, eHpH + 4*S, (eHpH + 4*S)/2); ctx.stroke()
    ctx.shadowBlur = 0
    ctx.restore()
  }
  R.drawHp(hpBarX, hpY, hpBarW, eHpH, g.enemy.hp, g.enemy.maxHp, ac ? ac.main : TH.danger, g._enemyHpLoss, true)

  const avatarPath = g.enemy.avatar ? g.enemy.avatar + '.png' : null
  const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
  const imgBottom = hpY - 6*S
  const eAreaH_local = eAreaBottom - eAreaTop
  let imgDrawY = imgBottom - eAreaH_local * 0.5
  const hideEnemy = g.bState === 'victory' && !g._enemyDeathAnim
  if (enemyImg && !(enemyImg.width > 0) && !hideEnemy) {
    const placeholderW = W * 0.4, placeholderH = eAreaH * 0.4
    R.drawCoverImg(enemyImg, (W - placeholderW) / 2, imgBottom - placeholderH, placeholderW, placeholderH, { radius: 12 * S })
  }
  if (enemyImg && enemyImg.width > 0 && !hideEnemy) {
    const maxImgH = eAreaH * 0.58
    const maxImgW = W * 0.5
    const imgRatio = enemyImg.width / enemyImg.height
    let imgW = maxImgH * imgRatio, imgH = maxImgH
    if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / imgRatio }
    const imgX = (W - imgW) / 2
    imgDrawY = imgBottom - imgH

    ctx.save()
    let hitOffX = 0, hitOffY = 0
    if (g._enemyHitFlash > 0) {
      const hitIntensity = g._enemyHitFlash / 12
      hitOffX = (Math.random() - 0.5) * 10 * S * hitIntensity
      hitOffY = (Math.random() - 0.5) * 6 * S * hitIntensity
      const squashP = Math.min(1, g._enemyHitFlash / 6)
      const scaleX = 1 - squashP * 0.08
      const scaleY = 1 + squashP * 0.06
      ctx.translate(imgX + imgW/2, imgDrawY + imgH)
      ctx.scale(scaleX, scaleY)
      ctx.translate(-(imgX + imgW/2), -(imgDrawY + imgH))
    }
    if (g._enemyDeathAnim) {
      const dp = g._enemyDeathAnim.timer / g._enemyDeathAnim.duration
      const deathScale = 1 - dp * 0.5
      const deathAlpha = 1 - dp
      ctx.globalAlpha = Math.max(0, deathAlpha)
      ctx.translate(imgX + imgW/2, imgDrawY + imgH/2)
      ctx.scale(deathScale, deathScale)
      ctx.translate(-(imgX + imgW/2), -(imgDrawY + imgH/2))
    }
    if (g._enemyHitFlash > 0) {
      const flashP = g._enemyHitFlash / 12
      const blinkAlpha = flashP > 0.5 ? (Math.sin(g._enemyHitFlash * 1.5) * 0.3 + 0.7) : 1
      ctx.globalAlpha = (ctx.globalAlpha || 1) * blinkAlpha
    }
    ctx.drawImage(enemyImg, imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
    if (g._enemyHitFlash > 0) {
      const glowAlpha = Math.min(0.5, g._enemyHitFlash / 12 * 0.5)
      ctx.globalAlpha = glowAlpha
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(enemyImg, imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
    if (g._enemyTintFlash > 0) {
      const tintAlpha = (g._enemyTintFlash / 8) * 0.3
      ctx.save()
      ctx.globalAlpha = tintAlpha
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = '#ff2244'
      ctx.fillRect(imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
      ctx.restore()
    }
    // 受击前 4 帧额外白色剪影叠加：让玩家一眼看出命中（plan L1e 闪白升级）
    if (g._enemyHitFlash > 0 && g._enemyHitFlash > 8) {
      const whiteAlpha = Math.min(0.65, (g._enemyHitFlash - 8) / 4 * 0.65)
      ctx.save()
      ctx.globalAlpha = whiteAlpha
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
      ctx.restore()
    }
    ctx.restore()

    _drawEnemyDebuffVFX(g, imgX, imgDrawY, imgW, imgH, enemyImg)

    if (g._enemyDeathAnim) {
      const da = g._enemyDeathAnim
      const dp = da.timer / da.duration
      ctx.save()
      const centerX = imgX + imgW/2, centerY = imgDrawY + imgH/2
      const deathColor = ac ? ac.main : '#ff6040'

      if (dp < 0.6) {
        const pillarP = dp / 0.6
        const pillarW = 20*S * (1 - pillarP * 0.5)
        const pillarH = 200*S * pillarP
        ctx.globalAlpha = (1 - pillarP) * 0.6
        const pillarGrd = ctx.createLinearGradient(centerX, centerY, centerX, centerY - pillarH)
        pillarGrd.addColorStop(0, '#fff')
        pillarGrd.addColorStop(0.3, deathColor)
        pillarGrd.addColorStop(0.7, deathColor + '44')
        pillarGrd.addColorStop(1, 'transparent')
        ctx.fillStyle = pillarGrd
        ctx.fillRect(centerX - pillarW, centerY - pillarH, pillarW*2, pillarH)
      }

      for (let ring = 0; ring < 3; ring++) {
        const ringDelay = ring * 0.1
        const ringP = Math.max(0, dp - ringDelay) / (1 - ringDelay)
        if (ringP <= 0 || ringP > 1) continue
        const ringR = ringP * (60 + ring * 30) * S
        ctx.globalAlpha = (1 - ringP) * (0.6 - ring * 0.15)
        ctx.strokeStyle = ring === 0 ? '#fff' : deathColor
        ctx.lineWidth = (3 - ringP * 2 - ring * 0.5) * S
        ctx.beginPath(); ctx.arc(centerX, centerY, ringR, 0, Math.PI*2); ctx.stroke()
      }

      const particleCount = 24
      for (let pi = 0; pi < particleCount; pi++) {
        const angle = (pi / particleCount) * Math.PI * 2 + da.timer * 0.08
        const speed = 20 + (pi % 5) * 15
        const dist = dp * speed * S
        const px = centerX + Math.cos(angle) * dist
        const py = centerY + Math.sin(angle) * dist
        const pAlpha = (1 - dp) * 0.85
        const pSize = (pi % 3 === 0 ? 3.5 : pi % 3 === 1 ? 2.5 : 1.5) * S * (1 - dp * 0.5)
        ctx.globalAlpha = pAlpha
        ctx.fillStyle = pi % 4 === 0 ? '#fff' : pi % 4 === 1 ? deathColor : pi % 4 === 2 ? '#ffd700' : deathColor + 'cc'
        ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI*2); ctx.fill()
      }

      if (dp < 0.3) {
        const flashR = 25*S * (1 + dp / 0.3)
        ctx.globalAlpha = (0.3 - dp) / 0.3 * 0.7
        ctx.globalCompositeOperation = 'lighter'
        const flashGrd = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashR)
        flashGrd.addColorStop(0, '#fff')
        flashGrd.addColorStop(0.5, deathColor)
        flashGrd.addColorStop(1, 'transparent')
        ctx.fillStyle = flashGrd
        ctx.beginPath(); ctx.arc(centerX, centerY, flashR, 0, Math.PI*2); ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
      }

      ctx.restore()
    }
  }

  const hasSkillCd = g.enemy.skills && g.enemy.skills.length > 0 && g.enemySkillCd >= 0
  const skillCdBlockH = hasSkillCd ? 28*S : 0

  const nameY = imgDrawY - 20*S - skillCdBlockH
  const nameFontSize = 14*S
  ctx.textAlign = 'center'
  ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
  ctx.fillText(g.enemy.name, W*0.5, nameY)
  ctx.restore()

  if (hasSkillCd) {
    const cdNum = g.enemySkillCd
    const isUrgent = cdNum <= 1
    const skFontSize = 10*S
    ctx.font = `bold ${skFontSize}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const nextSkKey = g._nextEnemySkill
    const nextSkData = nextSkKey ? ENEMY_SKILLS[nextSkKey] : null
    const nextSkName = nextSkData ? nextSkData.name : ''
    let cdText
    if (isUrgent && nextSkName) {
      cdText = `⚠ 即将释放【${nextSkName}】！`
    } else if (isUrgent) {
      cdText = '⚠ 下回合释放技能！'
    } else if (nextSkName) {
      cdText = `蓄力【${nextSkName}】${cdNum}回合`
    } else {
      cdText = `技能蓄力 ${cdNum} 回合`
    }
    const cdTextW = ctx.measureText(cdText).width
    const cdTagW = cdTextW + 20*S
    const cdTagH = 20*S
    const cdTagX = (W - cdTagW) / 2
    const cdTagY = nameY + 6*S
    ctx.save()
    if (isUrgent) {
      const pulse = 0.7 + 0.3 * Math.sin(g.af * 0.12)
      ctx.globalAlpha = pulse
      ctx.fillStyle = 'rgba(200,40,40,0.8)'
    } else {
      ctx.globalAlpha = 0.75
      ctx.fillStyle = 'rgba(60,50,80,0.7)'
    }
    ctx.beginPath()
    R.rr(cdTagX, cdTagY, cdTagW, cdTagH, cdTagH / 2); ctx.fill()
    ctx.strokeStyle = isUrgent ? 'rgba(255,80,80,0.9)' : 'rgba(180,170,200,0.5)'
    ctx.lineWidth = 1*S
    R.rr(cdTagX, cdTagY, cdTagW, cdTagH, cdTagH / 2); ctx.stroke()
    ctx.globalAlpha = 1
    ctx.fillStyle = isUrgent ? '#ffcccc' : '#d0c8e0'
    ctx.fillText(cdText, W * 0.5, cdTagY + cdTagH / 2)
    ctx.restore()
    ctx.textBaseline = 'alphabetic'
  }

  const weakAttr = COUNTER_BY[g.enemy.attr]
  const resistAttr = COUNTER_MAP[g.enemy.attr]
  const orbR = 7*S
  const infoFontSize = 11*S
  const infoY = nameY + (hasSkillCd ? skillCdBlockH + 8*S : 14*S)
  const tagH = 22*S, tagR = tagH/2
  ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
  const weakTagW = weakAttr ? ctx.measureText('弱点').width + orbR*2 + 16*S : 0
  const resistTagW = resistAttr ? ctx.measureText('抵抗').width + orbR*2 + 16*S : 0
  const infoGap = (weakAttr && resistAttr) ? 10*S : 0
  const totalInfoW = weakTagW + infoGap + resistTagW
  let curX = W*0.5 - totalInfoW/2
  if (weakAttr) {
    const wac = ATTR_COLOR[weakAttr]
    const weakMain = wac ? wac.main : '#fff'
    const isBoss = g.enemy.isBoss || g.enemy.isElite
    const pulseAlpha = isBoss ? (0.75 + 0.25 * Math.sin(g.af * 0.08)) : 0.85
    const pulseScale = isBoss ? (1 + 0.03 * Math.sin(g.af * 0.08)) : 1
    ctx.save()
    if (isBoss) {
      ctx.translate(curX + weakTagW/2, infoY - tagH*0.5 + tagH/2)
      ctx.scale(pulseScale, pulseScale)
      ctx.translate(-(curX + weakTagW/2), -(infoY - tagH*0.5 + tagH/2))
    }
    ctx.globalAlpha = pulseAlpha
    ctx.fillStyle = weakMain + '40'
    ctx.beginPath()
    R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.fill()
    ctx.strokeStyle = weakMain + '99'; ctx.lineWidth = 1.5*S
    R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.stroke()
    if (isBoss) {
      ctx.shadowColor = weakMain; ctx.shadowBlur = 8*S
      ctx.strokeStyle = weakMain + 'cc'; ctx.lineWidth = 1*S
      R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.stroke()
      ctx.shadowBlur = 0
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = '#fff'; ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('弱点', curX + 6*S, infoY)
    const lw = ctx.measureText('弱点').width
    R.drawBead(curX + 6*S + lw + orbR + 3*S, infoY, orbR, weakAttr, g.af)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
    curX += weakTagW + infoGap
  }
  if (resistAttr) {
    const rac = ATTR_COLOR[resistAttr]
    const resistMain = rac ? rac.main : '#888'
    ctx.save()
    ctx.globalAlpha = 0.65
    ctx.fillStyle = 'rgba(60,60,80,0.6)'
    ctx.beginPath()
    R.rr(curX, infoY - tagH*0.5, resistTagW, tagH, tagR); ctx.fill()
    ctx.strokeStyle = 'rgba(150,150,170,0.4)'; ctx.lineWidth = 1*S
    R.rr(curX, infoY - tagH*0.5, resistTagW, tagH, tagR); ctx.stroke()
    ctx.globalAlpha = 0.8
    ctx.fillStyle = '#aaa'; ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('抵抗', curX + 6*S, infoY)
    const lw2 = ctx.measureText('抵抗').width
    R.drawBead(curX + 6*S + lw2 + orbR + 3*S, infoY, orbR, resistAttr, g.af)
    ctx.textBaseline = 'alphabetic'
    ctx.restore()
  }

  ctx.textAlign = 'center'
  const evType = g.curEvent ? g.curEvent.type : 'battle'
  const floorLabelImg = R.getImg('assets/ui/floor_label_bg.png')
  const labelW = W * 0.45, labelH = labelW / 4
  const labelX = (W - labelW) / 2, labelY = eAreaTop + 2*S
  if (floorLabelImg && floorLabelImg.width > 0) {
    ctx.drawImage(floorLabelImg, labelX, labelY, labelW, labelH)
  }
  const labelCY = labelY + labelH * 0.52
  const _isTutorial = tutorial.isActive()
  if (_isTutorial) {
    const tData = tutorial.getGuideData()
    const stepTitle = tData ? tData.title : '新手教学'
    ctx.fillStyle = '#b0e0ff'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText('新手教学', W*0.5, labelCY - 2*S)
    ctx.restore()
    ctx.fillStyle = '#80d0ff'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(`第${tutorial.getStep()+1}课 · ${stepTitle}`, W*0.5, labelCY + 9*S)
  } else if (g.battleMode === 'stage') {
    const { getStageById } = require('../../data/stages')
    const stageData = getStageById(g._stageId)
    const stageName = stageData ? stageData.name : '关卡'
    const waveTotal = g._stageWaves ? g._stageWaves.length : 1
    const waveCur = (g._stageWaveIdx || 0) + 1
    const chapterOrderText = stageData && stageData.chapter != null && stageData.order != null
      ? `第${stageData.chapter}章·第${stageData.order}关${stageData.difficulty === 'elite' ? ' · 精英' : ''}`
      : ''
    const subTitle = waveTotal > 1
      ? `${chapterOrderText ? `${chapterOrderText} · ` : ''}第 ${waveCur}/${waveTotal} 波`
      : (chapterOrderText || '当前关卡')
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText(stageName, W*0.5, labelCY - 2*S)
    ctx.restore()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(subTitle, W*0.5, labelCY + 9*S)
  } else if (evType === 'boss') {
    const floorText = `第 ${g.floor} 层`
    const bossTag = '⚠ BOSS ⚠'
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText(floorText, W*0.5, labelCY - 2*S)
    ctx.restore()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(bossTag, W*0.5, labelCY + 9*S)
  } else if (evType === 'elite') {
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText(`第 ${g.floor} 层`, W*0.5, labelCY - 2*S)
    ctx.restore()
    ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.fillText('★ 精英战斗', W*0.5, labelCY + 9*S)
  } else {
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText(`第 ${g.floor} 层`, W*0.5, labelCY)
    ctx.restore()
  }

  g._enemyAreaRect = [0, eAreaTop, W, eAreaBottom - eAreaTop]
}

module.exports = { drawBattleEnemyArea }
