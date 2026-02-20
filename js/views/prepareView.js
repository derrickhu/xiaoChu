/**
 * 准备界面渲染：阵容编辑（宠物/法宝切换）+ 详情Tips浮层
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { drawBackBtn } = require('./screens')
const { getPetStarAtk, MAX_STAR, getPetAvatarPath } = require('../data/pets')

// 背包滚动状态
let _petBagScrollY = 0
let _wpnBagScrollY = 0
let _petBagContentH = 0
let _petBagViewH = 0
let _wpnBagContentH = 0
let _wpnBagViewH = 0
let _scrollTouchStartY = 0
let _scrollStartVal = 0
let _scrollingTab = '' // 'pets' | 'weapon'

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
      const petAvatar = R.getImg(getPetAvatarPath(p))
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
      // 星级标记（左下角）
      if ((p.star || 1) > 1) {
        const starText = '★'.repeat(p.star || 1)
        ctx.save()
        ctx.font = `bold ${iconSz * 0.14}px sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
        ctx.strokeText(starText, sx + 2*S, slotY + iconSz - 2*S)
        ctx.fillStyle = '#ffd700'
        ctx.fillText(starText, sx + 2*S, slotY + iconSz - 2*S)
        ctx.textBaseline = 'alphabetic'
        ctx.restore()
      }
      if (isSel) {
        ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
        ctx.strokeRect(sx-1, slotY-1, iconSz+2, iconSz+2)
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
      ctx.fillText(p.name.substring(0,5), cx, slotY+iconSz+3*S)
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
      const pStarAtk = getPetStarAtk(p)
      const pAtkDisp = (p.star || 1) > 1 ? `ATK:${p.atk}→${pStarAtk}` : `ATK:${p.atk}`
      ctx.fillText(pAtkDisp, cx, slotY+iconSz+14*S)
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
  ctx.fillText(`灵兽背包（${g.petBag.length}只）：`, padX, bagLabelY)
  const bagY = bagLabelY + 16*S
  const bagGap = 4*S
  const bagIcon = Math.floor((W - padX*2 - bagGap*3) / 4)
  const bagTextH = 28*S
  const bagW = bagIcon, bagH = bagIcon + bagTextH
  const bFrameSz = bagIcon * frameScale
  const bfOff = (bFrameSz - bagIcon) / 2

  // 计算背包区域可视高度和内容高度
  const bagBottomLimit = H - 60*S - 18*S - 12*S - 58*S // HP条+出发按钮上方
  const bagViewH = bagBottomLimit - bagY
  const bagRows = Math.ceil(Math.max(g.petBag.length, 1) / 4)
  const bagContentH = bagRows * (bagH + bagGap)
  _petBagContentH = bagContentH
  _petBagViewH = bagViewH
  // 存储背包区域信息供触摸处理使用
  g._prepBagScrollArea = [0, bagY, W, bagViewH]

  // 约束滚动范围
  const maxScroll = Math.max(0, bagContentH - bagViewH)
  if (_petBagScrollY < 0) _petBagScrollY = 0
  if (_petBagScrollY > maxScroll) _petBagScrollY = maxScroll

  // 裁剪+滚动
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, bagY, W, bagViewH)
  ctx.clip()
  ctx.translate(0, -_petBagScrollY)

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
      const bpAvatar = R.getImg(getPetAvatarPath(bp))
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
      // 星级标记（左下角）
      if ((bp.star || 1) > 1) {
        const bStarText = '★'.repeat(bp.star || 1)
        ctx.save()
        ctx.font = `bold ${bagIcon * 0.14}px sans-serif`
        ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
        ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
        ctx.strokeText(bStarText, bx + 2*S, by + bagIcon - 2*S)
        ctx.fillStyle = '#ffd700'
        ctx.fillText(bStarText, bx + 2*S, by + bagIcon - 2*S)
        ctx.textBaseline = 'alphabetic'
        ctx.restore()
      }
      if (isSel) {
        ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
        ctx.strokeRect(bx-1, by-1, bagIcon+2, bagIcon+2)
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
      ctx.fillText(bp.name.substring(0,5), bcx, by+bagIcon+3*S)
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
      const bpStarAtk = getPetStarAtk(bp)
      const bpAtkDisp = (bp.star || 1) > 1 ? `ATK:${bp.atk}→${bpStarAtk}` : `ATK:${bp.atk}`
      ctx.fillText(bpAtkDisp, bcx, by+bagIcon+14*S)
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
    // 存储实际屏幕坐标（减去滚动偏移后的位置用于点击检测）
    g._prepBagRects.push([bx, by - _petBagScrollY, bagW, bagH])
  }
  // 交换按钮（在滚动区域内）
  if (g.prepareSelSlotIdx >= 0 && g.prepareSelBagIdx >= 0 && g.petBag[g.prepareSelBagIdx]) {
    const swapBtnY = bagY + bagRows*(bagH+bagGap) + 8*S
    const swapBtnX = W*0.25, swapBtnW = W*0.5, swapBtnH = 38*S
    R.drawBtn(swapBtnX, swapBtnY, swapBtnW, swapBtnH, '交换上场', TH.accent, 14)
    g._prepSwapBtnRect = [swapBtnX, swapBtnY - _petBagScrollY, swapBtnW, swapBtnH]
  } else {
    g._prepSwapBtnRect = null
  }

  ctx.restore() // 恢复裁剪

  // 绘制滚动条
  if (bagContentH > bagViewH) {
    const scrollRatio = _petBagScrollY / maxScroll
    const barH = Math.max(20*S, bagViewH * (bagViewH / bagContentH))
    const barY = bagY + scrollRatio * (bagViewH - barH)
    const barX = W - 6*S
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    R.rr(barX, barY, 4*S, barH, 2*S); ctx.fill()
  }
}

function _drawWeaponTab(g, padX, contentY) {
  const { ctx, R, TH, W, H, S } = V
  const frameWeapon = R.getImg('assets/ui/frame_weapon.png')
  const frameScale = 1.12

  // 当前装备法宝（单个大图标）
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText('当前法宝：', padX, contentY + 12*S)
  const curWpnY = contentY + 20*S
  const curIconSz = Math.floor((W - padX*2 - 4*S*4) / 5)
  const curTextH = 28*S
  if (g.weapon) {
    const sx = padX, sy = curWpnY
    const cx = sx + curIconSz*0.5, cy = sy + curIconSz*0.5
    ctx.fillStyle = 'rgba(30,25,18,0.85)'
    ctx.fillRect(sx+1, sy+1, curIconSz-2, curIconSz-2)
    const curWpnImg = R.getImg(`assets/equipment/fabao_${g.weapon.id}.png`)
    if (curWpnImg && curWpnImg.width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(sx+1, sy+1, curIconSz-2, curIconSz-2); ctx.clip()
      const aw = curWpnImg.width, ah = curWpnImg.height
      const dw = curIconSz - 2, dh = dw * (ah / aw)
      ctx.drawImage(curWpnImg, sx+1, sy+1+(curIconSz-2-dh), dw, dh)
      ctx.restore()
    }
    if (frameWeapon && frameWeapon.width > 0) {
      const fSz = curIconSz * frameScale, fOff = (fSz - curIconSz)/2
      ctx.drawImage(frameWeapon, sx - fOff, sy - fOff, fSz, fSz)
    }
    ctx.strokeStyle = TH.accent; ctx.lineWidth = 2*S
    ctx.strokeRect(sx-1, sy-1, curIconSz+2, curIconSz+2)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillStyle = TH.accent; ctx.font = `bold ${9*S}px sans-serif`
    ctx.fillText(g.weapon.name.substring(0,5), cx, sy+curIconSz+3*S)
    ctx.textBaseline = 'alphabetic'
    g._prepCurWpnRect = [sx, sy, curIconSz, curIconSz + curTextH]
  } else {
    ctx.fillStyle = TH.card
    R.rr(padX, curWpnY, curIconSz, curIconSz, 6*S); ctx.fill()
    if (frameWeapon && frameWeapon.width > 0) {
      ctx.save(); ctx.globalAlpha = 0.35
      const fSz = curIconSz * frameScale, fOff = (fSz - curIconSz)/2
      ctx.drawImage(frameWeapon, padX - fOff, curWpnY - fOff, fSz, fSz)
      ctx.restore()
    }
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('无', padX + curIconSz*0.5, curWpnY + curIconSz*0.5)
    ctx.textBaseline = 'alphabetic'
    g._prepCurWpnRect = null
  }

  // 法宝背包（网格布局，参照灵宠背包）
  const wBagLabelY = curWpnY + curIconSz + curTextH + 14*S
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText(`背包法宝（${g.weaponBag.length}件）：`, padX, wBagLabelY)
  const wBagY = wBagLabelY + 16*S
  const bagGap = 4*S
  const bagIcon = Math.floor((W - padX*2 - bagGap*3) / 4)
  const bagTextH = 28*S
  const bFrameSz = bagIcon * frameScale
  const bfOff = (bFrameSz - bagIcon) / 2

  // 计算法宝背包滚动
  const wBagBottomLimit = H - 60*S - 18*S - 12*S - 58*S
  const wBagViewH = wBagBottomLimit - wBagY
  const wBagRows = Math.max(Math.ceil(g.weaponBag.length / 4), 1)
  const wBagContentH = wBagRows * (bagIcon + bagTextH + bagGap)
  _wpnBagContentH = wBagContentH
  _wpnBagViewH = wBagViewH
  g._prepWpnBagScrollArea = [0, wBagY, W, wBagViewH]

  const wMaxScroll = Math.max(0, wBagContentH - wBagViewH)
  if (_wpnBagScrollY < 0) _wpnBagScrollY = 0
  if (_wpnBagScrollY > wMaxScroll) _wpnBagScrollY = wMaxScroll

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, wBagY, W, wBagViewH)
  ctx.clip()
  ctx.translate(0, -_wpnBagScrollY)

  g._prepWpnBagRects = []
  for (let i = 0; i < g.weaponBag.length; i++) {
    const bx = padX + (i%4)*(bagIcon+bagGap), by = wBagY + Math.floor(i/4)*(bagIcon+bagTextH+bagGap)
    const wp = g.weaponBag[i]
    const bcx = bx + bagIcon*0.5, bcy = by + bagIcon*0.5
    ctx.fillStyle = 'rgba(30,25,18,0.85)'
    ctx.fillRect(bx+1, by+1, bagIcon-2, bagIcon-2)
    const bagWpnImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
    if (bagWpnImg && bagWpnImg.width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(bx+1, by+1, bagIcon-2, bagIcon-2); ctx.clip()
      const baw = bagWpnImg.width, bah = bagWpnImg.height
      const bdW = bagIcon - 2, bdH = bdW * (bah / baw)
      ctx.drawImage(bagWpnImg, bx+1, by+1+(bagIcon-2-bdH), bdW, bdH)
      ctx.restore()
    }
    if (frameWeapon && frameWeapon.width > 0) {
      ctx.drawImage(frameWeapon, bx - bfOff, by - bfOff, bFrameSz, bFrameSz)
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillStyle = TH.accent; ctx.font = `bold ${9*S}px sans-serif`
    ctx.fillText(wp.name.substring(0,5), bcx, by+bagIcon+3*S)
    ctx.textBaseline = 'alphabetic'
    g._prepWpnBagRects.push([bx, by - _wpnBagScrollY, bagIcon, bagIcon + bagTextH])
  }
  if (g.weaponBag.length === 0) {
    ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('背包空空如也', W*0.5, wBagY + 20*S)
  }

  ctx.restore()

  // 绘制法宝背包滚动条
  if (wBagContentH > wBagViewH) {
    const scrollRatio = _wpnBagScrollY / wMaxScroll
    const barH = Math.max(20*S, wBagViewH * (wBagViewH / wBagContentH))
    const barY = wBagY + scrollRatio * (wBagViewH - barH)
    const barX = W - 6*S
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    R.rr(barX, barY, 4*S, barH, 2*S); ctx.fill()
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
    const starText = '★'.repeat(d.star || 1) + ((d.star || 1) < MAX_STAR ? '☆'.repeat(MAX_STAR - (d.star || 1)) : '')
    lines.push({ text: d.name, color: ac ? ac.dk || ac.main : '#3D2B1F', bold: true, size: 15, starSuffix: starText })
    const tipStarAtk = getPetStarAtk(d)
    const tipAtkDisp = (d.star || 1) > 1 ? `ATK：${d.atk}→${tipStarAtk}` : `ATK：${d.atk}`
    lines.push({ text: `__ATTR_ORB__${d.attr}　　${tipAtkDisp}`, color: '#6B5B50', size: 11, attrOrb: d.attr })
    lines.push({ text: `冷却：${d.cd} 回合`, color: '#8B7B70', size: 11 })
    if (d.skill) {
      lines.push({ text: '', size: 6 })
      lines.push({ text: `技能：${d.skill.name}`, color: '#8B6914', bold: true, size: 12 })
      const descLines = wrapText(d.skill.desc || '', tipW - padX*2, 11)
      for (const dl of descLines) {
        lines.push({ text: dl, color: '#3D2B1F', size: 11 })
      }
    }
  } else if (tip.type === 'weapon') {
    lines.push({ text: d.name, color: '#8B6914', bold: true, size: 15 })
    lines.push({ text: '被动效果', color: '#6B5B50', size: 11 })
    if (d.desc) {
      lines.push({ text: '', size: 6 })
      const descLines = wrapText(d.desc, tipW - padX*2, 11)
      for (const dl of descLines) {
        lines.push({ text: dl, color: '#3D2B1F', size: 11 })
      }
    }
  }

  let totalH = padY * 2
  for (const l of lines) totalH += l.size === 6 ? 6*S : lineH

  const tipX = (W - tipW) / 2
  const tipY = Math.min(Math.max(tip.y - totalH - 10*S, safeTop + 10*S), H - totalH - 80*S)

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(0, 0, W, H)

  R.drawInfoPanel(tipX, tipY, tipW, totalH)

  let curY = tipY + padY
  ctx.textAlign = 'left'
  for (const l of lines) {
    if (l.size === 6) { curY += 6*S; continue }
    curY += lineH
    ctx.fillStyle = l.color || '#3D2B1F'
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px sans-serif`
    if (l.attrOrb) {
      const orbR = 6*S
      const orbX = tipX + padX + orbR
      const orbY = curY - 4*S - orbR*0.4
      R.drawBead(orbX, orbY, orbR, l.attrOrb, 0)
      const restText = l.text.replace(`__ATTR_ORB__${l.attrOrb}`, '')
      ctx.fillText(restText, orbX + orbR + 4*S, curY - 4*S)
    } else {
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
      if (l.starSuffix) {
        const nameW = ctx.measureText(l.text).width
        ctx.font = `bold ${11*S}px sans-serif`
        ctx.fillStyle = '#ffd700'
        ctx.fillText(l.starSuffix, tipX + padX + nameW + 6*S, curY - 4*S)
      }
    }
  }

  ctx.fillStyle = '#9B8B80'; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'center'
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

// 背包滚动触摸处理
function prepBagScrollStart(g, y) {
  const tab = g.prepareTab
  if (tab === 'pets' && g._prepBagScrollArea) {
    const [, sy, , sh] = g._prepBagScrollArea
    if (y >= sy && y <= sy + sh) {
      _scrollingTab = 'pets'
      _scrollTouchStartY = y
      _scrollStartVal = _petBagScrollY
      return true
    }
  } else if (tab === 'weapon' && g._prepWpnBagScrollArea) {
    const [, sy, , sh] = g._prepWpnBagScrollArea
    if (y >= sy && y <= sy + sh) {
      _scrollingTab = 'weapon'
      _scrollTouchStartY = y
      _scrollStartVal = _wpnBagScrollY
      return true
    }
  }
  return false
}

function prepBagScrollMove(y) {
  const dy = _scrollTouchStartY - y
  if (_scrollingTab === 'pets') {
    const maxScroll = Math.max(0, _petBagContentH - _petBagViewH)
    _petBagScrollY = Math.max(0, Math.min(maxScroll, _scrollStartVal + dy))
  } else if (_scrollingTab === 'weapon') {
    const maxScroll = Math.max(0, _wpnBagContentH - _wpnBagViewH)
    _wpnBagScrollY = Math.max(0, Math.min(maxScroll, _scrollStartVal + dy))
  }
}

function prepBagScrollEnd() {
  _scrollingTab = ''
}

function resetPrepBagScroll() {
  _petBagScrollY = 0
  _wpnBagScrollY = 0
}

module.exports = { rPrepare, drawPrepareTip, wrapText, prepBagScrollStart, prepBagScrollMove, prepBagScrollEnd, resetPrepBagScroll }
