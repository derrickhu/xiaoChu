/**
 * 战斗 UI 控件：退出按钮、Buff 标签、灵宝匣按钮、经验指示器/飘字
 */
const V = require('../env')
const tutorial = require('../../engine/tutorial')

function drawBattleUIControls(g, eAreaTop, eAreaBottom, teamBarY, exitBtnSize, drawBuffIconsLabeled) {
  const { ctx, R, W, S } = V
  const exitBtnX = 8*S
  const exitBtnY = eAreaTop

  // 旧的己方 Buff 小标签已由 battleStatusBar 取代，保留参数签名兼容
  void drawBuffIconsLabeled

  if (!tutorial.isActive()) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('\u2715', exitBtnX + exitBtnSize*0.5, exitBtnY + exitBtnSize*0.5)
    ctx.textBaseline = 'alphabetic'
    g._exitBtnRect = [exitBtnX, exitBtnY, exitBtnSize, exitBtnSize]
  } else {
    g._exitBtnRect = null
  }

  if (!tutorial.isActive() && g.bState !== 'none') {
    drawExpIndicator(g, exitBtnX, exitBtnY + exitBtnSize + 6*S, exitBtnSize, S)
  }

  if (!tutorial.isActive() && g.bState !== 'victory' && g.bState !== 'defeat') {
    const chestSz = 36*S
    const chestX = W - chestSz - 8*S
    const chestY = eAreaTop + (eAreaBottom - eAreaTop) * 0.32
    const allUsed = g.itemResetUsed && g.itemHealUsed
    const pendingCount = (!g.itemResetUsed ? 1 : 0) + (!g.itemHealUsed ? 1 : 0)
    ctx.save()
    ctx.globalAlpha = allUsed ? 0.4 : 0.85
    const chestImg = R.getImg('assets/ui/icon_chest.png')
    if (chestImg && chestImg.width > 0) {
      ctx.drawImage(chestImg, chestX, chestY, chestSz, chestSz)
    } else {
      ctx.fillStyle = 'rgba(80,50,20,0.8)'
      R.rr(chestX, chestY, chestSz, chestSz, 6*S); ctx.fill()
      ctx.strokeStyle = '#d4a844'; ctx.lineWidth = 1.5*S
      R.rr(chestX, chestY, chestSz, chestSz, 6*S); ctx.stroke()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('\uD83D\uDCE6', chestX + chestSz*0.5, chestY + chestSz*0.5)
      ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()
    if (!allUsed) {
      const badgeSz = 12*S
      const bx = chestX + chestSz - badgeSz*0.3, by = chestY - badgeSz*0.3
      ctx.fillStyle = '#e04040'
      ctx.beginPath(); ctx.arc(bx, by, badgeSz*0.5, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${pendingCount}`, bx, by)
      ctx.textBaseline = 'alphabetic'
    }
    g._chestBtnRect = [chestX, chestY, chestSz, chestSz]
  } else {
    g._chestBtnRect = null
  }
}

function drawExpIndicator(g, x, y, w, S) {
  const { ctx: c, R } = V
  const exp = g.runExp || 0
  const pulse = g._expIndicatorPulse || 0

  const iconSz = 28 * S
  const iconX = x + (w - iconSz) / 2
  const iconY = y
  const centerY = iconY + iconSz / 2

  g._expIndicatorX = iconX + iconSz / 2
  g._expIndicatorY = centerY

  c.save()

  const expText = `${exp}`
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const txtW = c.measureText(expText).width
  const padX = 5 * S
  const capH = 20 * S, capR = capH / 2
  const txtX = iconX + iconSz + 2 * S
  const capX = iconX + iconSz * 0.38
  const capW = txtX + txtW + padX - capX
  const capY = centerY - capH / 2

  c.beginPath()
  c.moveTo(capX + capR, capY)
  c.lineTo(capX + capW - capR, capY)
  c.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
  c.lineTo(capX + capW, capY + capH - capR)
  c.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
  c.lineTo(capX + capR, capY + capH)
  c.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
  c.lineTo(capX, capY + capR)
  c.quadraticCurveTo(capX, capY, capX + capR, capY)
  c.closePath()
  c.fillStyle = pulse > 0 ? 'rgba(180,130,10,0.75)' : 'rgba(0,0,0,0.52)'
  c.fill()

  c.fillStyle = pulse > 0 ? '#FFD700' : '#fff8cc'
  c.fillText(expText, txtX, centerY)

  const expIcon = R.getImg('assets/ui/icon_cult_exp.png')
  if (expIcon && expIcon.width > 0) {
    c.drawImage(expIcon, iconX, iconY, iconSz, iconSz)
  } else {
    c.fillStyle = '#E8D5A3'
    c.font = `${iconSz * 0.7}px sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('\u2728', iconX + iconSz / 2, centerY)
  }

  c.restore()
}

function drawExpFloats(g) {
  const { ctx, S } = V
  const floats = g._expFloats
  if (!floats || floats.length === 0) return

  for (const f of floats) {
    if (f.alpha <= 0) continue
    const p = Math.min(f.t / f.duration, 1)
    const ep = p * p
    const cpX = f.startX + (f.targetX - f.startX) * 0.3
    const cpY = f.startY - 40 * S
    const t = ep
    const oneMinusT = 1 - t
    const curX = oneMinusT * oneMinusT * f.startX + 2 * oneMinusT * t * cpX + t * t * f.targetX
    const curY = oneMinusT * oneMinusT * f.startY + 2 * oneMinusT * t * cpY + t * t * f.targetY

    ctx.save()
    const scale = 1 - ep * 0.5
    ctx.globalAlpha = f.alpha * (1 - ep * 0.3)
    ctx.fillStyle = f.color || '#FFD700'
    ctx.font = `bold ${Math.round(12 * scale)*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2*S
    ctx.strokeText(f.text, curX, curY)
    ctx.fillText(f.text, curX, curY)
    ctx.restore()
  }
}

module.exports = { drawBattleUIControls, drawExpIndicator, drawExpFloats }
