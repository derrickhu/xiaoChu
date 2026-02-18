/**
 * 准备界面渲染：阵容编辑（宠物/法宝切换）+ 详情Tips浮层
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { drawBackBtn } = require('./screens')

function rPrepare(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawBg(g.af)
  const padX = 12*S
  ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`── 阵容编辑 ──`, W*0.5, safeTop + 36*S)
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
  ctx.fillText(`第 ${g.floor} 层`, W*0.5, safeTop + 56*S)
  // Tab切换
  const tabY = safeTop + 72*S, tabH = 32*S, tabW = W*0.35
  const petTabX = W*0.1, wpnTabX = W*0.55
  ctx.fillStyle = g.prepareTab === 'pets' ? TH.accent : TH.card
  R.rr(petTabX, tabY, tabW, tabH, 6*S); ctx.fill()
  ctx.fillStyle = g.prepareTab === 'pets' ? '#fff' : TH.sub; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('灵兽编辑', petTabX+tabW*0.5, tabY+tabH*0.65)
  g._prepPetTabRect = [petTabX, tabY, tabW, tabH]
  ctx.fillStyle = g.prepareTab === 'weapon' ? TH.accent : TH.card
  R.rr(wpnTabX, tabY, tabW, tabH, 6*S); ctx.fill()
  ctx.fillStyle = g.prepareTab === 'weapon' ? '#fff' : TH.sub
  ctx.fillText('法宝切换', wpnTabX+tabW*0.5, tabY+tabH*0.65)
  g._prepWpnTabRect = [wpnTabX, tabY, tabW, tabH]

  const contentY = tabY + tabH + 12*S
  if (g.prepareTab === 'pets') {
    _drawPetTab(g, padX, contentY)
  } else {
    _drawWeaponTab(g, padX, contentY)
  }
  // 底部：英雄HP条
  const prepHpBarH = 18*S
  const prepHpBarY = H - 60*S - prepHpBarH - 12*S
  R.drawHp(padX, prepHpBarY, W - padX*2, prepHpBarH, g.heroHp, g.heroMaxHp, '#d4607a', null, true, '#4dcc4d', g.heroShield)
  // 底部：出发按钮
  const goBtnX = W*0.2, goBtnY = H - 60*S, goBtnW = W*0.6, goBtnH = 46*S
  R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '查看事件', TH.accent, 18)
  g._prepGoBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]

  drawPrepareTip(g)
  drawBackBtn(g)
}

function _drawPetTab(g, padX, contentY) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText('上场灵兽（5只）：', padX, contentY + 12*S)
  const slotGap = 4*S
  const iconSz = Math.floor((W - padX*2 - slotGap*4) / 5)
  const textH = 28*S
  const slotW = iconSz, slotH = iconSz + textH
  const slotY = contentY + 20*S
  const frameScale = 1.12
  const frameSz = iconSz * frameScale
  const fOff = (frameSz - iconSz) / 2
  const fMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }
  g._prepSlotRects = []
  for (let i = 0; i < 5; i++) {
    const sx = padX + i*(iconSz+slotGap)
    const isSel = g.prepareSelSlotIdx === i
    const p = g.pets[i]
    const ac = p ? ATTR_COLOR[p.attr] : null
    const cx = sx + iconSz*0.5, cy = slotY + iconSz*0.5
    ctx.fillStyle = p ? (ac ? ac.bg : '#1a1a2e') : 'rgba(18,18,30,0.6)'
    ctx.fillRect(sx+1, slotY+1, iconSz-2, iconSz-2)
    if (p) {
      ctx.save()
      const grd = ctx.createRadialGradient(cx, cy-iconSz*0.06, 0, cx, cy-iconSz*0.06, iconSz*0.38)
      grd.addColorStop(0, (ac ? ac.main : '#888')+'40')
      grd.addColorStop(1, 'transparent')
      ctx.fillStyle = grd
      ctx.fillRect(sx, slotY, iconSz, iconSz)
      ctx.restore()
      const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
      if (petAvatar && petAvatar.width > 0) {
        const aw = petAvatar.width, ah = petAvatar.height
        const drawW = iconSz - 2, drawH = drawW * (ah / aw)
        const dy = slotY + 1 + (iconSz - 2) - drawH
        ctx.save(); ctx.beginPath(); ctx.rect(sx+1, slotY+1, iconSz-2, iconSz-2); ctx.clip()
        ctx.drawImage(petAvatar, sx+1, dy, drawW, drawH)
        ctx.restore()
      } else {
        ctx.fillStyle = ac ? ac.main : TH.text
        ctx.font = `bold ${iconSz*0.35}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(ATTR_NAME[p.attr]||'', cx, cy)
      }
      const pf = fMap[p.attr] || fMap.metal
      if (pf && pf.width > 0) {
        ctx.drawImage(pf, sx-fOff, slotY-fOff, frameSz, frameSz)
      }
      if (isSel) {
        ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
        ctx.strokeRect(sx-1, slotY-1, iconSz+2, iconSz+2)
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
      ctx.fillText(p.name.substring(0,5), cx, slotY+iconSz+3*S)
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
      ctx.fillText(`ATK:${p.atk}`, cx, slotY+iconSz+14*S)
    } else {
      const pf = fMap.metal
      if (pf && pf.width > 0) {
        ctx.save(); ctx.globalAlpha = 0.35
        ctx.drawImage(pf, sx-fOff, slotY-fOff, frameSz, frameSz)
        ctx.restore()
      }
    }
    g._prepSlotRects.push([sx, slotY, slotW, slotH])
  }
  // 背包宠物
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
  const bagLabelY = slotY + slotH + 30*S
  ctx.fillText(`灵兽背包（${g.petBag.length}/8）：`, padX, bagLabelY)
  const bagY = bagLabelY + 16*S
  const bagGap = 4*S
  const bagIcon = Math.floor((W - padX*2 - bagGap*3) / 4)
  const bagTextH = 28*S
  const bagW = bagIcon, bagH = bagIcon + bagTextH
  const bFrameSz = bagIcon * frameScale
  const bfOff = (bFrameSz - bagIcon) / 2
  g._prepBagRects = []
  for (let i = 0; i < Math.max(g.petBag.length, 1); i++) {
    const bx = padX + (i%4)*(bagIcon+bagGap), by = bagY + Math.floor(i/4)*(bagH+bagGap)
    const bp = g.petBag[i]
    const isSel = g.prepareSelBagIdx === i
    const ac = bp ? ATTR_COLOR[bp.attr] : null
    const bcx = bx + bagIcon*0.5, bcy = by + bagIcon*0.5
    ctx.fillStyle = bp ? (ac ? ac.bg : '#1a1a2e') : 'rgba(18,18,30,0.6)'
    ctx.fillRect(bx+1, by+1, bagIcon-2, bagIcon-2)
    if (bp) {
      ctx.save()
      const bgrd = ctx.createRadialGradient(bcx, bcy-bagIcon*0.06, 0, bcx, bcy-bagIcon*0.06, bagIcon*0.38)
      bgrd.addColorStop(0, (ac ? ac.main : '#888')+'40')
      bgrd.addColorStop(1, 'transparent')
      ctx.fillStyle = bgrd
      ctx.fillRect(bx, by, bagIcon, bagIcon)
      ctx.restore()
      const bpAvatar = R.getImg(`assets/pets/pet_${bp.id}.png`)
      if (bpAvatar && bpAvatar.width > 0) {
        const baw = bpAvatar.width, bah = bpAvatar.height
        const bdW = bagIcon - 2, bdH = bdW * (bah / baw)
        const bdy = by + 1 + (bagIcon - 2) - bdH
        ctx.save(); ctx.beginPath(); ctx.rect(bx+1, by+1, bagIcon-2, bagIcon-2); ctx.clip()
        ctx.drawImage(bpAvatar, bx+1, bdy, bdW, bdH)
        ctx.restore()
      } else {
        ctx.fillStyle = ac ? ac.main : TH.text
        ctx.font = `bold ${bagIcon*0.35}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(ATTR_NAME[bp.attr]||'', bcx, bcy)
      }
      const bf = fMap[bp.attr] || fMap.metal
      if (bf && bf.width > 0) {
        ctx.drawImage(bf, bx-bfOff, by-bfOff, bFrameSz, bFrameSz)
      }
      if (isSel) {
        ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
        ctx.strokeRect(bx-1, by-1, bagIcon+2, bagIcon+2)
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
      ctx.fillText(bp.name.substring(0,5), bcx, by+bagIcon+3*S)
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
      ctx.fillText(`ATK:${bp.atk}`, bcx, by+bagIcon+14*S)
    } else {
      const bf = fMap.metal
      if (bf && bf.width > 0) {
        ctx.save(); ctx.globalAlpha = 0.35
        ctx.drawImage(bf, bx-bfOff, by-bfOff, bFrameSz, bFrameSz)
        ctx.restore()
      }
      ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('空', bcx, bcy)
    }
    g._prepBagRects.push([bx, by, bagW, bagH])
  }
  // 交换按钮
  if (g.prepareSelSlotIdx >= 0 && g.prepareSelBagIdx >= 0 && g.petBag[g.prepareSelBagIdx]) {
    const swapBtnY = bagY + (Math.ceil(Math.max(g.petBag.length,1)/4))*(bagH+bagGap) + 8*S
    const swapBtnX = W*0.25, swapBtnW = W*0.5, swapBtnH = 38*S
    R.drawBtn(swapBtnX, swapBtnY, swapBtnW, swapBtnH, '交换上场', TH.accent, 14)
    g._prepSwapBtnRect = [swapBtnX, swapBtnY, swapBtnW, swapBtnH]
  } else {
    g._prepSwapBtnRect = null
  }
}

function _drawWeaponTab(g, padX, contentY) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText('当前法宝：', padX, contentY + 12*S)
  const curWpnY = contentY + 20*S
  if (g.weapon) {
    ctx.fillStyle = 'rgba(30,25,18,0.85)'
    R.rr(padX, curWpnY, W-padX*2, 50*S, 8*S); ctx.fill()
    ctx.strokeStyle = TH.accent; ctx.lineWidth = 2*S; ctx.stroke()
    const curWpnImg = R.getImg(`assets/equipment/fabao_${g.weapon.id}.png`)
    const cwImgSz = 40*S
    if (curWpnImg && curWpnImg.width > 0) {
      ctx.save(); R.rr(padX + 5*S, curWpnY + 5*S, cwImgSz, cwImgSz, 6*S); ctx.clip()
      ctx.drawImage(curWpnImg, padX + 5*S, curWpnY + 5*S, cwImgSz, cwImgSz)
      ctx.restore()
    }
    const cwTextX = curWpnImg && curWpnImg.width > 0 ? padX + 5*S + cwImgSz + 8*S : padX + 10*S
    ctx.fillStyle = TH.accent; ctx.font = `bold ${14*S}px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(g.weapon.name, cwTextX, curWpnY+22*S)
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(g.weapon.desc, cwTextX, curWpnY+40*S)
    g._prepCurWpnRect = [padX, curWpnY, W-padX*2, 50*S]
  } else {
    ctx.fillStyle = TH.card; R.rr(padX, curWpnY, W-padX*2, 50*S, 8*S); ctx.fill()
    ctx.fillStyle = TH.dim; ctx.font = `${13*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('无法宝', W*0.5, curWpnY+30*S)
    g._prepCurWpnRect = null
  }
  // 法宝背包
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
  const wBagLabelY = curWpnY + 60*S
  ctx.fillText(`法宝背包（${g.weaponBag.length}/4）：`, padX, wBagLabelY)
  const wBagY = wBagLabelY + 8*S
  const wCardH = 50*S, wGap = 6*S
  g._prepWpnBagRects = []
  for (let i = 0; i < g.weaponBag.length; i++) {
    const wy = wBagY + i*(wCardH+wGap)
    const wp = g.weaponBag[i]
    ctx.fillStyle = 'rgba(30,25,18,0.85)'
    R.rr(padX, wy, W-padX*2, wCardH, 8*S); ctx.fill()
    const bagWpnImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
    const bwImgSz = 40*S
    if (bagWpnImg && bagWpnImg.width > 0) {
      ctx.save(); R.rr(padX + 5*S, wy + 5*S, bwImgSz, bwImgSz, 6*S); ctx.clip()
      ctx.drawImage(bagWpnImg, padX + 5*S, wy + 5*S, bwImgSz, bwImgSz)
      ctx.restore()
    }
    const bwTextX = bagWpnImg && bagWpnImg.width > 0 ? padX + 5*S + bwImgSz + 8*S : padX + 10*S
    ctx.fillStyle = TH.accent; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(wp.name, bwTextX, wy+20*S)
    ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
    ctx.fillText(wp.desc, bwTextX, wy+38*S)
    const eqBtnW = 60*S, eqBtnH = 26*S, eqBtnX = W - padX - eqBtnW - 4*S, eqBtnY = wy + 10*S
    R.drawBtn(eqBtnX, eqBtnY, eqBtnW, eqBtnH, '装备', TH.info, 11)
    g._prepWpnBagRects.push([padX, wy, W-padX*2, wCardH, eqBtnX, eqBtnY, eqBtnW, eqBtnH])
  }
  if (g.weaponBag.length === 0) {
    ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('背包空空如也', W*0.5, wBagY + 20*S)
  }
}

function drawPrepareTip(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const tip = g.prepareTip
  if (!tip || !tip.data) return

  const d = tip.data
  const padX = 14*S, padY = 10*S
  const tipW = W * 0.78
  const lineH = 18*S

  let lines = []
  if (tip.type === 'pet') {
    const ac = ATTR_COLOR[d.attr]
    lines.push({ text: d.name, color: ac ? ac.main : TH.text, bold: true, size: 15 })
    lines.push({ text: `属性：${ATTR_NAME[d.attr] || '?'}　　ATK：${d.atk}`, color: TH.sub, size: 11 })
    lines.push({ text: `冷却：${d.cd} 回合`, color: TH.dim, size: 11 })
    if (d.skill) {
      lines.push({ text: '', size: 6 })
      lines.push({ text: `技能：${d.skill.name}`, color: TH.accent, bold: true, size: 12 })
      const descLines = wrapText(d.skill.desc || '', tipW - padX*2, 11)
      for (const dl of descLines) {
        lines.push({ text: dl, color: TH.text, size: 11 })
      }
    }
  } else if (tip.type === 'weapon') {
    lines.push({ text: d.name, color: TH.accent, bold: true, size: 15 })
    lines.push({ text: '被动效果', color: TH.sub, size: 11 })
    if (d.desc) {
      lines.push({ text: '', size: 6 })
      const descLines = wrapText(d.desc, tipW - padX*2, 11)
      for (const dl of descLines) {
        lines.push({ text: dl, color: TH.text, size: 11 })
      }
    }
  }

  let totalH = padY * 2
  for (const l of lines) totalH += l.size === 6 ? 6*S : lineH

  const tipX = (W - tipW) / 2
  const tipY = Math.min(Math.max(tip.y - totalH - 10*S, safeTop + 10*S), H - totalH - 80*S)

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)

  R.drawDialogPanel(tipX, tipY, tipW, totalH)

  let curY = tipY + padY
  ctx.textAlign = 'left'
  for (const l of lines) {
    if (l.size === 6) { curY += 6*S; continue }
    curY += lineH
    ctx.fillStyle = l.color || TH.text
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px sans-serif`
    ctx.fillText(l.text, tipX + padX, curY - 4*S)
  }

  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH + 16*S)

  ctx.restore()
  g._prepTipOverlay = true
}

// 文本换行辅助（从main.js提取的公共工具函数）
function wrapText(text, maxW, fontSize) {
  const S = V.S
  const charW = fontSize * S * 0.55
  const maxChars = Math.floor(maxW / charW)
  if (maxChars <= 0) return [text]
  const result = []
  let rest = text
  while (rest.length > 0) {
    result.push(rest.substring(0, maxChars))
    rest = rest.substring(maxChars)
  }
  return result.length > 0 ? result : [text]
}

module.exports = { rPrepare, drawPrepareTip, wrapText }
