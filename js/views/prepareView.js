/**
 * 准备界面渲染：阵容编辑（宠物/法宝切换）+ 详情Tips浮层
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { drawBackBtn } = require('./screens')
const { getPetStarAtk, MAX_STAR, getPetAvatarPath, getPetSkillDesc, petHasSkill } = require('../data/pets')

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
  ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`── 阵容编辑 ──`, W*0.5, safeTop + 36*S)
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`
  ctx.fillText(`第 ${g.floor} 层`, W*0.5, safeTop + 56*S)
  // Tab切换
  const tabY = safeTop + 72*S, tabH = 32*S, tabW = W*0.35
  const petTabX = W*0.1, wpnTabX = W*0.55
  ctx.fillStyle = g.prepareTab === 'pets' ? TH.accent : TH.card
  R.rr(petTabX, tabY, tabW, tabH, 6*S); ctx.fill()
  ctx.fillStyle = g.prepareTab === 'pets' ? '#fff' : TH.sub; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
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
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
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
        ctx.font = `bold ${iconSz*0.35}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(ATTR_NAME[p.attr]||'', cx, cy)
      }
      const pf = fMap[p.attr] || fMap.metal
      if (pf && pf.width > 0) {
        ctx.drawImage(pf, sx-fOff, slotY-fOff, frameSz, frameSz)
      }
      // 星级标记（左下角）
      if ((p.star || 1) >= 1) {
        const starText = '★'.repeat(p.star || 1)
        ctx.save()
        ctx.font = `bold ${iconSz * 0.14}px "PingFang SC",sans-serif`
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
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      ctx.fillText(p.name.substring(0,5), cx, slotY+iconSz+3*S)
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px "PingFang SC",sans-serif`
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
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
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
        ctx.font = `bold ${bagIcon*0.35}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(ATTR_NAME[bp.attr]||'', bcx, bcy)
      }
      const bf = fMap[bp.attr] || fMap.metal
      if (bf && bf.width > 0) {
        ctx.drawImage(bf, bx-bfOff, by-bfOff, bFrameSz, bFrameSz)
      }
      // 星级标记（左下角）
      if ((bp.star || 1) >= 1) {
        const bStarText = '★'.repeat(bp.star || 1)
        ctx.save()
        ctx.font = `bold ${bagIcon * 0.14}px "PingFang SC",sans-serif`
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
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      ctx.fillText(bp.name.substring(0,5), bcx, by+bagIcon+3*S)
      ctx.fillStyle = TH.dim; ctx.font = `${8*S}px "PingFang SC",sans-serif`
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
      ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
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
  const drag = g._prepDragWpn

  // 当前装备法宝（单个大图标）
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
  ctx.fillText('当前法宝：', padX, contentY + 12*S)
  const curWpnY = contentY + 20*S
  const curIconSz = Math.floor((W - padX*2 - 4*S*4) / 5)
  const curTextH = 28*S
  if (g.weapon) {
    const sx = padX, sy = curWpnY
    const cx = sx + curIconSz*0.5
    const isDragSource = drag && drag.source === 'equipped'
    if (isDragSource) ctx.globalAlpha = 0.3
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
    R.drawWeaponFrame(sx, sy, curIconSz)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    const _cpLabel = '法宝·'
    const _cpFull = _cpLabel + g.weapon.name.substring(0,4)
    const _cpFullW = ctx.measureText(_cpFull).width
    const _cpLabelW = ctx.measureText(_cpLabel).width
    const _cpStartX = cx - _cpFullW/2
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e0a020'
    ctx.fillText(_cpLabel, _cpStartX, sy+curIconSz+3*S)
    ctx.fillStyle = TH.accent
    ctx.fillText(g.weapon.name.substring(0,4), _cpStartX + _cpLabelW, sy+curIconSz+3*S)
    ctx.textBaseline = 'alphabetic'
    if (isDragSource) ctx.globalAlpha = 1
    g._prepCurWpnRect = [sx, sy, curIconSz, curIconSz + curTextH]
    // 从背包拖到装备位时的高亮
    if (drag && drag.source === 'bag' && g._hitRect(drag.x, drag.y, sx, sy, curIconSz, curIconSz)) {
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
      ctx.strokeRect(sx - 1, sy - 1, curIconSz + 2, curIconSz + 2)
    }
  } else {
    ctx.fillStyle = TH.card
    R.rr(padX, curWpnY, curIconSz, curIconSz, 6*S); ctx.fill()
    R.drawWeaponFrame(padX, curWpnY, curIconSz, 0.35)
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('无', padX + curIconSz*0.5, curWpnY + curIconSz*0.5)
    ctx.textBaseline = 'alphabetic'
    g._prepCurWpnRect = [padX, curWpnY, curIconSz, curIconSz + curTextH]
    // 从背包拖到空装备位时的高亮
    if (drag && drag.source === 'bag' && g._hitRect(drag.x, drag.y, padX, curWpnY, curIconSz, curIconSz)) {
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
      ctx.strokeRect(padX - 1, curWpnY - 1, curIconSz + 2, curIconSz + 2)
    }
  }

  // 法宝背包（网格布局，参照灵宠背包）
  const wBagLabelY = curWpnY + curIconSz + curTextH + 14*S
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
  ctx.fillText(`背包法宝（${g.weaponBag.length}件）：`, padX, wBagLabelY)
  // 操作提示
  ctx.fillStyle = 'rgba(200,180,140,0.5)'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('拖动到上方可替换装备', W*0.5, wBagLabelY + 13*S)
  const wBagY = wBagLabelY + 28*S
  const bagGap = 4*S
  const bagIcon = Math.floor((W - padX*2 - bagGap*3) / 4)
  const bagTextH = 28*S

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
    const bcx = bx + bagIcon*0.5
    const isDragSrc = drag && drag.source === 'bag' && drag.index === i
    if (isDragSrc) ctx.globalAlpha = 0.3
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
    R.drawWeaponFrame(bx, by, bagIcon)
    ctx.textBaseline = 'top'
    ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    const _bpLabel = '法宝·'
    const _bpFull = _bpLabel + wp.name.substring(0,4)
    const _bpFullW = ctx.measureText(_bpFull).width
    const _bpLabelW = ctx.measureText(_bpLabel).width
    const _bpStartX = bcx - _bpFullW/2
    ctx.textAlign = 'left'
    ctx.fillStyle = '#e0a020'
    ctx.fillText(_bpLabel, _bpStartX, by+bagIcon+3*S)
    ctx.fillStyle = TH.accent
    ctx.fillText(wp.name.substring(0,4), _bpStartX + _bpLabelW, by+bagIcon+3*S)
    ctx.textBaseline = 'alphabetic'
    if (isDragSrc) ctx.globalAlpha = 1
    g._prepWpnBagRects.push([bx, by - _wpnBagScrollY, bagIcon, bagIcon + bagTextH])
    // 从装备位拖到背包item上的高亮
    if (drag && drag.source === 'equipped' && g._hitRect(drag.x, drag.y, bx, by - _wpnBagScrollY, bagIcon, bagIcon)) {
      ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
      ctx.strokeRect(bx - 1, by - 1, bagIcon + 2, bagIcon + 2)
    }
  }
  if (g.weaponBag.length === 0) {
    ctx.fillStyle = TH.dim; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
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

  // 拖拽中的法宝跟随手指绘制
  if (drag && drag.weapon && drag.moved) {
    const dragSz = curIconSz * 0.9
    const dx = drag.x - dragSz/2, dy = drag.y - dragSz/2
    ctx.globalAlpha = 0.85
    ctx.fillStyle = 'rgba(30,25,18,0.85)'
    ctx.fillRect(dx+1, dy+1, dragSz-2, dragSz-2)
    const dragImg = R.getImg(`assets/equipment/fabao_${drag.weapon.id}.png`)
    if (dragImg && dragImg.width > 0) {
      ctx.save(); ctx.beginPath(); ctx.rect(dx+1, dy+1, dragSz-2, dragSz-2); ctx.clip()
      const daw = dragImg.width, dah = dragImg.height
      const ddw = dragSz - 2, ddh = ddw * (dah / daw)
      ctx.drawImage(dragImg, dx+1, dy+1+(dragSz-2-ddh), ddw, ddh)
      ctx.restore()
    }
    R.drawWeaponFrame(dx, dy, dragSz)
    ctx.globalAlpha = 1
  }
}

function drawPrepareTip(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const tip = g.prepareTip
  if (!tip || !tip.data) return

  const d = tip.data
  const padX = 14*S, padY = 10*S
  const tipW = W * 0.8
  const lineH = 16*S
  const maxTextW = tipW - padX * 2

  if (tip.type === 'pet') {
    _drawPetTip(ctx, R, S, W, H, safeTop, tip, d, padX, padY, tipW, lineH, maxTextW, g)
  } else if (tip.type === 'weapon') {
    _drawWeaponTip(ctx, R, S, W, H, safeTop, tip, d, padX, padY, tipW, lineH, maxTextW, g)
  }
}

// 宠物信息弹窗（含头像）
function _drawPetTip(ctx, R, S, W, H, safeTop, tip, d, padX, padY, tipW, lineH, maxTextW, g) {
  const curStar = d.star || 1
  const isMaxStar = curStar >= MAX_STAR
  const curAtk = getPetStarAtk(d)
  const skillDesc = petHasSkill(d) ? (getPetSkillDesc(d) || '') : ''
  const ac = ATTR_COLOR[d.attr]

  // 头像区域尺寸
  const avSz = 42*S
  const avPad = 8*S
  const infoX = tipX => tipX + padX + avSz + avPad  // 头像右侧的文字起点
  const textMaxW = maxTextW - avSz - avPad  // 头像右侧的可用文字宽度

  const skillDescLines = skillDesc ? wrapText(skillDesc, textMaxW - 4*S, 10) : []

  // 下一级数据
  let nextAtk = 0, nextSkillDesc = '', nextSkillDescLines = []
  if (!isMaxStar) {
    const nextPet = { ...d, star: curStar + 1 }
    nextAtk = getPetStarAtk(nextPet)
    nextSkillDesc = petHasSkill(nextPet) ? (getPetSkillDesc(nextPet) || (d.skill ? d.skill.desc : '')) : ''
    nextSkillDescLines = nextSkillDesc ? wrapText(nextSkillDesc, maxTextW - 4*S, 10) : []
  }

  // 预计算总高度
  // 头像区域：头像高度与名称+ATK行的较大值
  const headerTextH = lineH * 2  // 名称行 + ATK行
  const headerH = Math.max(avSz, headerTextH) + 4*S
  let totalH = padY * 2
  totalH += headerH             // 头像+名称+ATK区域
  totalH += 6*S                 // 间距
  totalH += lineH               // 技能标题
  totalH += skillDescLines.length * lineH  // 技能描述

  if (!isMaxStar) {
    totalH += 8*S              // 分割线上间距
    totalH += 2*S              // 分割线
    totalH += 8*S              // 分割线下间距
    totalH += lineH            // "下一级 ★X" 标题
    totalH += lineH            // 下一级ATK
    totalH += lineH            // 下一级技能标题
    totalH += nextSkillDescLines.length * lineH  // 下一级技能描述
  }

  const tipX = (W - tipW) / 2
  const tipY = Math.min(Math.max(tip.y - totalH - 10*S, safeTop + 10*S), H - totalH - 80*S)
  const rad = 14*S

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, W, H)
  R.drawInfoPanel(tipX, tipY, tipW, totalH)

  ctx.save()
  ctx.beginPath(); R.rr(tipX, tipY, tipW, totalH, rad); ctx.clip()

  let curY = tipY + padY
  const lx = tipX + padX  // 左边起点

  // === 头像 ===
  const avX = lx
  const avY = curY
  // 头像背景渐变
  ctx.save()
  const grd = ctx.createLinearGradient(avX, avY, avX, avY + avSz)
  grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.beginPath(); R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()
  ctx.restore()
  // 头像图片
  const petImg = R.getImg(getPetAvatarPath(d))
  if (petImg && petImg.width > 0) {
    const iw = petImg.width, ih = petImg.height
    const dw = avSz - 2, dh = dw * (ih / iw)
    const dy = avY + 1 + (avSz - 2) - dh
    ctx.save(); ctx.beginPath(); R.rr(avX + 1, avY + 1, avSz - 2, avSz - 2, 5*S); ctx.clip()
    ctx.drawImage(petImg, avX + 1, dy, dw, dh)
    ctx.restore()
  }

  // === 名称 + 星星（头像右侧，同一行） ===
  const txL = lx + avSz + avPad  // 文字左边起点
  curY += lineH
  const nameFs = 14*S
  const starStr = '★'.repeat(curStar) + (curStar < MAX_STAR ? '☆'.repeat(MAX_STAR - curStar) : '')
  ctx.font = `bold ${nameFs}px "PingFang SC",sans-serif`
  const nameW = ctx.measureText(d.name).width
  ctx.fillStyle = '#3D2B1F'; ctx.textAlign = 'left'
  ctx.fillText(d.name, txL, curY - 4*S)
  ctx.fillStyle = '#C89510'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(starStr, txL + nameW + 6*S, curY - 4*S)

  // === 属性珠 + ATK（头像右侧，仅当前值） ===
  curY += lineH
  const orbR = 5*S
  const orbX = txL + orbR
  const orbY = curY - 4*S - orbR*0.4
  R.drawBead(orbX, orbY, orbR, d.attr, 0)
  const atkLabel = ' ATK：'
  ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(atkLabel, orbX + orbR + 2*S, curY - 4*S)
  const atkLabelW = ctx.measureText(atkLabel).width
  ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(String(curAtk), orbX + orbR + 2*S + atkLabelW, curY - 4*S)

  // 确保 curY 跳过头像区域
  curY = Math.max(curY, avY + avSz)

  // === 间距 ===
  curY += 6*S

  // === 技能标题（技能名 + CD高亮）===
  curY += lineH
  if (petHasSkill(d)) {
    const skillTitle = `技能：${d.skill.name}`
    ctx.fillStyle = '#8B6914'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(skillTitle, lx, curY - 4*S)
    const skillTitleW = ctx.measureText(skillTitle).width
    const cdText = `CD ${d.cd}`
    ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(cdText, lx + skillTitleW + 6*S, curY - 4*S)
    // === 技能描述（数值高亮）===
    for (const line of skillDescLines) {
      curY += lineH
      _drawHighlightLine(ctx, line, lx + 4*S, curY - 4*S, 11*S, S)
    }
  } else {
    ctx.fillStyle = '#8B7B70'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('技能：升至★2解锁', lx, curY - 4*S)
  }

  // === 下一级数据（非满星时，仅变化内容用醒目颜色）===
  if (!isMaxStar) {
    curY += 8*S
    // 分割线
    ctx.strokeStyle = 'rgba(160,140,100,0.3)'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.moveTo(lx, curY); ctx.lineTo(tipX + tipW - padX, curY); ctx.stroke()
    curY += 2*S + 8*S

    // "下一级 ★X" 标题（星星单独用深琥珀金色）
    curY += lineH
    const nextStarPrefix = '下一级 '
    const nextStarIcons = '★'.repeat(curStar + 1)
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillStyle = '#8B6E4E'
    ctx.fillText(nextStarPrefix, lx, curY - 4*S)
    const nextPrefixW = ctx.measureText(nextStarPrefix).width
    ctx.fillStyle = '#C89510'
    ctx.fillText(nextStarIcons, lx + nextPrefixW, curY - 4*S)

    // 下一级ATK（ATK总是变化，用醒目色）
    curY += lineH
    const nAtkLabel = 'ATK：'
    const atkChanged = nextAtk !== curAtk
    ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(nAtkLabel, lx, curY - 4*S)
    const nAtkLabelW = ctx.measureText(nAtkLabel).width
    ctx.fillStyle = atkChanged ? '#c06020' : '#4A3B30'
    ctx.font = atkChanged ? `bold ${11*S}px "PingFang SC",sans-serif` : `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(String(nextAtk), lx + nAtkLabelW, curY - 4*S)

    // 下一级技能
    const nextPetFake = { ...d, star: curStar + 1 }
    const nextHasSkill = petHasSkill(nextPetFake)
    const curHasSkill = petHasSkill(d)
    if (nextHasSkill && !curHasSkill) {
      // ★1→★2：新解锁技能，用高亮醒目色
      curY += lineH
      const nextSkillTitle = `解锁技能：${d.skill.name}`
      ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(nextSkillTitle, lx, curY - 4*S)
      const nextSkillTitleW = ctx.measureText(nextSkillTitle).width
      const nextCdText = `CD ${d.cd}`
      ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(nextCdText, lx + nextSkillTitleW + 6*S, curY - 4*S)
      for (const line of nextSkillDescLines) {
        curY += lineH
        _drawHighlightLine(ctx, line, lx + 4*S, curY - 4*S, 10*S, S)
      }
    } else if (nextHasSkill) {
      // ★2→★3：技能名不变，用普通色
      curY += lineH
      const nextSkillTitle = `技能：${d.skill ? d.skill.name : '无'}`
      ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(nextSkillTitle, lx, curY - 4*S)
      // 下一级技能描述（仅描述变化时用高亮，否则普通色）
      const descChanged = nextSkillDesc !== skillDesc
      for (const line of nextSkillDescLines) {
        curY += lineH
        if (descChanged) {
          _drawHighlightLine(ctx, line, lx + 4*S, curY - 4*S, 10*S, S)
        } else {
          ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'
          ctx.fillText(line, lx + 4*S, curY - 4*S)
        }
      }
    }
  }

  ctx.restore() // 结束裁剪

  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH + 14*S)

  ctx.restore()
  g._prepTipOverlay = true
}

// 法宝信息弹窗（保持原逻辑）
function _drawWeaponTip(ctx, R, S, W, H, safeTop, tip, d, padX, padY, tipW, lineH, maxTextW, g) {
  let lines = []
  lines.push({ text: d.name, color: '#8B6914', bold: true, size: 14, wpnPrefix: true })
  lines.push({ text: '被动效果', color: '#6B5B50', size: 10 })
  if (d.desc) {
    lines.push({ text: '', size: 6 })
    const descLines = wrapText(d.desc, maxTextW, 10)
    for (const dl of descLines) {
      lines.push({ text: dl, color: '#3D2B1F', size: 10 })
    }
  }

  let totalH = padY * 2
  for (const l of lines) totalH += l.size === 6 ? 6*S : lineH

  const tipX = (W - tipW) / 2
  const tipY = Math.min(Math.max(tip.y - totalH - 10*S, safeTop + 10*S), H - totalH - 80*S)
  const rad = 14*S

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.fillRect(0, 0, W, H)
  R.drawInfoPanel(tipX, tipY, tipW, totalH)

  ctx.save()
  ctx.beginPath(); R.rr(tipX, tipY, tipW, totalH, rad); ctx.clip()

  let curY = tipY + padY
  ctx.textAlign = 'left'
  for (const l of lines) {
    if (l.size === 6) { curY += 6*S; continue }
    curY += lineH
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
    let tx = tipX + padX
    if (l.wpnPrefix) {
      const pfx = '法宝·'
      ctx.fillStyle = '#e0a020'
      ctx.fillText(pfx, tx, curY - 4*S)
      tx += ctx.measureText(pfx).width
    }
    ctx.fillStyle = l.color || '#3D2B1F'
    ctx.fillText(l.text, tx, curY - 4*S)
  }

  ctx.restore()

  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH + 14*S)

  ctx.restore()
  g._prepTipOverlay = true
}

// 绘制带数值高亮的单行文本（数字用橙色粗体）
function _drawHighlightLine(ctx, text, x, y, fontSize, S) {
  const normalColor = '#3D2B1F'
  const highlightColor = '#c06020'
  const font = `${fontSize}px "PingFang SC",sans-serif`
  const boldFont = `bold ${fontSize}px "PingFang SC",sans-serif`
  const numRe = /(\d+[\d.]*%?倍?)/g

  ctx.textAlign = 'left'
  let cx = x, lastIdx = 0, match
  numRe.lastIndex = 0
  while ((match = numRe.exec(text)) !== null) {
    if (match.index > lastIdx) {
      const before = text.substring(lastIdx, match.index)
      ctx.fillStyle = normalColor; ctx.font = font
      ctx.fillText(before, cx, y)
      cx += ctx.measureText(before).width
    }
    ctx.fillStyle = highlightColor; ctx.font = boldFont
    ctx.fillText(match[0], cx, y)
    cx += ctx.measureText(match[0]).width
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < text.length) {
    ctx.fillStyle = normalColor; ctx.font = font
    ctx.fillText(text.substring(lastIdx), cx, y)
  }
  if (lastIdx === 0) {
    ctx.fillStyle = normalColor; ctx.font = font
    ctx.fillText(text, x, y)
  }
}

// 文本换行辅助（按实际像素宽度换行）
function wrapText(text, maxW, fontSize) {
  if (!text) return ['']
  const S = V.S
  const fullW = fontSize * S
  const halfW = fontSize * S * 0.55
  const result = []
  let line = '', lineW = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const cw = ch.charCodeAt(0) > 127 ? fullW : halfW
    if (lineW + cw > maxW && line.length > 0) {
      result.push(line)
      line = ch; lineW = cw
    } else {
      line += ch; lineW += cw
    }
  }
  if (line) result.push(line)
  return result.length > 0 ? result : ['']
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
