/**
 * 事件预览界面渲染：战斗/奇遇/商店/休息 事件详情
 * 战斗层：整合法宝切换 + 灵宠替换，支持点击快速交换，无需跳转prepare页面
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_BY } = require('../data/tower')
const { drawBackBtn } = require('./screens')
const { wrapText } = require('./prepareView')

// ===== 滚动状态（挂在模块级，避免每帧重置） =====
let _scrollY = 0          // 当前滚动偏移
let _scrollTouchStartY = 0
let _scrollStart = 0
let _contentH = 0         // 内容总高度
let _viewH = 0            // 可视区高度
let _lastFloor = -1       // 用于检测楼层变化时重置滚动

function rEvent(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawBg(g.af)
  const ev = g.curEvent
  if (!ev) return
  const padX = 12*S
  const isBattle = ev.type === 'battle' || ev.type === 'elite' || ev.type === 'boss'
  const typeName = { battle:'普通战斗', elite:'精英战斗', boss:'BOSS挑战', adventure:'奇遇', shop:'神秘商店', rest:'休息之地' }

  // 楼层切换时重置滚动
  if (g.floor !== _lastFloor) { _scrollY = 0; _lastFloor = g.floor }

  // ===== 固定顶部区域 =====
  let curY = safeTop + 32*S
  ctx.textAlign = 'center'
  ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`
  ctx.fillText(`── 第 ${g.floor} 层 ──`, W*0.5, curY)
  curY += 22*S
  const evLabel = typeName[ev.type] || '未知事件'
  if (ev.type === 'boss') {
    const tagW = 140*S, tagH = 28*S, tagX = (W - tagW)/2, tagY = curY - 17*S
    ctx.fillStyle = 'rgba(180,30,30,0.85)'; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.fill()
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 1.5*S; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.stroke()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px sans-serif`
    ctx.fillText('⚠ ' + evLabel + ' ⚠', W*0.5, curY)
  } else if (ev.type === 'elite') {
    const tagW = 120*S, tagH = 26*S, tagX = (W - tagW)/2, tagY = curY - 16*S
    ctx.fillStyle = 'rgba(120,50,180,0.8)'; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(200,150,255,0.6)'; ctx.lineWidth = 1; R.rr(tagX, tagY, tagW, tagH, 6*S); ctx.stroke()
    ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${14*S}px sans-serif`
    ctx.fillText('★ ' + evLabel, W*0.5, curY)
  } else {
    ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px sans-serif`
    ctx.fillText(evLabel, W*0.5, curY)
  }
  curY += 18*S

  // ===== 非战斗层保持原逻辑 =====
  g._eventPetRects = []
  g._eventEditPetRect = null
  g._eventEditWpnRect = null
  g._eventWpnSlots = []        // 法宝点击区域 [{rect, type:'equipped'|'bag', index}]
  g._eventPetSlots = []        // 灵宠点击区域 [{rect, type:'team'|'bag', index}]
  g._eventBagPetRects = []     // 背包灵宠区域

  if (!isBattle) {
    // 非战斗事件的原有渲染逻辑
    if (ev.type === 'adventure') {
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.text; ctx.font = `bold ${16*S}px sans-serif`
      ctx.fillText(ev.data.name, W*0.5, curY + 20*S)
      ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
      ctx.fillText(ev.data.desc, W*0.5, curY + 44*S)
      curY += 70*S
    } else if (ev.type === 'shop') {
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
      ctx.fillText('可免费选择一件物品', W*0.5, curY + 20*S)
      curY += 50*S
    } else if (ev.type === 'rest') {
      ctx.textAlign = 'center'
      ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
      ctx.fillText('选择一项休息效果', W*0.5, curY + 20*S)
      curY += 50*S
    }
    const goBtnW = W*0.55, goBtnH = 44*S
    const goBtnX = (W - goBtnW)/2, goBtnY = curY
    R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '进入', TH.accent, 16)
    g._eventBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]
    drawBackBtn(g)
    return
  }

  // ===== 战斗层：新的一体化界面 =====
  const e = ev.data
  const ac = ATTR_COLOR[e.attr]

  // --- 敌人信息卡（紧凑版） ---
  const cardX = padX, cardW = W - padX*2, cardTop = curY, cardH = 90*S
  ctx.fillStyle = 'rgba(15,15,30,0.75)'
  R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.fill()
  ctx.strokeStyle = ac ? ac.main + '66' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
  R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.stroke()

  const avatarSize = 60*S
  const avatarX = cardX + 12*S
  const avatarY = cardTop + (cardH - avatarSize) / 2
  ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
  R.rr(avatarX, avatarY, avatarSize, avatarSize, 6*S); ctx.fill()
  const avatarPath = e.avatar ? e.avatar + '.png' : null
  const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
  if (enemyImg && enemyImg.width > 0) {
    ctx.save()
    ctx.beginPath(); R.rr(avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2, 5*S); ctx.clip()
    ctx.drawImage(enemyImg, avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2)
    ctx.restore()
  }
  ctx.strokeStyle = ac ? ac.main : '#666'; ctx.lineWidth = 1.5*S
  R.rr(avatarX, avatarY, avatarSize, avatarSize, 6*S); ctx.stroke()

  const infoX = avatarX + avatarSize + 12*S
  let infoY = cardTop + 24*S
  ctx.textAlign = 'left'
  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${14*S}px sans-serif`
  ctx.fillText(e.name, infoX, infoY)
  infoY += 20*S
  // 属性标签
  ctx.fillStyle = ac ? ac.bg : '#333'
  const tagW2 = 60*S, tagH2 = 18*S
  R.rr(infoX, infoY - 12*S, tagW2, tagH2, 3*S); ctx.fill()
  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${10*S}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(`${ATTR_NAME[e.attr]}属性`, infoX + tagW2/2, infoY)
  ctx.textAlign = 'left'
  // 弱点
  const weakAttr = COUNTER_BY[e.attr]
  if (weakAttr) {
    const wc = ATTR_COLOR[weakAttr]
    const weakX = infoX + tagW2 + 8*S
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
    ctx.fillText('弱点:', weakX, infoY)
    const wLabelX = weakX + 32*S
    ctx.fillStyle = wc ? wc.bg : '#333'
    const wTagW = 52*S
    R.rr(wLabelX, infoY - 11*S, wTagW, 16*S, 3*S); ctx.fill()
    ctx.fillStyle = wc ? wc.main : TH.accent; ctx.font = `bold ${10*S}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${ATTR_NAME[weakAttr]}属性`, wLabelX + wTagW/2, infoY)
    ctx.textAlign = 'left'
  }
  curY = cardTop + cardH + 8*S

  // --- HP条 ---
  const hpBarH = 14*S
  R.drawHp(padX, curY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', null, true, '#4dcc4d', g.heroShield)
  curY += hpBarH + 10*S

  // ===== 法宝区 =====
  ctx.textAlign = 'left'
  ctx.fillStyle = TH.sub; ctx.font = `bold ${11*S}px sans-serif`
  ctx.fillText('── 法宝 ──', padX, curY)
  curY += 8*S

  const wpnRowH = 42*S
  const wpnCardW = W - padX*2

  // 当前法宝
  _drawWeaponCard(ctx, R, TH, S, padX, curY, wpnCardW, wpnRowH, g.weapon, true, g._eventWpnSlots, 'equipped', 0)
  curY += wpnRowH + 4*S

  // 背包法宝
  if (g.weaponBag.length > 0) {
    ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'left'
    ctx.fillText('背包法宝（点击替换）：', padX + 4*S, curY + 2*S)
    curY += 12*S
    for (let i = 0; i < g.weaponBag.length; i++) {
      _drawWeaponCard(ctx, R, TH, S, padX, curY, wpnCardW, wpnRowH, g.weaponBag[i], false, g._eventWpnSlots, 'bag', i)
      curY += wpnRowH + 3*S
    }
  }
  curY += 6*S

  // ===== 灵宠区 =====
  ctx.textAlign = 'left'
  ctx.fillStyle = TH.sub; ctx.font = `bold ${11*S}px sans-serif`
  ctx.fillText('── 灵宠 ──', padX, curY)
  curY += 8*S

  // 当前队伍灵宠（5格）
  const petSlots = 5
  const petGap = 6*S
  const petSidePad = padX
  const petIconSize = (W - petSidePad*2 - petGap*(petSlots-1)) / petSlots
  const petIconY = curY
  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }
  const frameScale = 1.12
  const frameSize = petIconSize * frameScale
  const frameOff = (frameSize - petIconSize) / 2

  const drag = g._eventDragPet

  for (let i = 0; i < petSlots; i++) {
    const px = petSidePad + i * (petIconSize + petGap)
    const py = petIconY
    g._eventPetSlots.push({ rect: [px, py, petIconSize, petIconSize], type: 'team', index: i })
    g._eventPetRects.push([px, py, petIconSize, petIconSize])

    // 拖拽中的源位置半透明显示
    const isDragSource = drag && drag.source === 'team' && drag.index === i

    if (i < g.pets.length) {
      const p = g.pets[i]
      if (isDragSource) {
        ctx.globalAlpha = 0.3
      }
      _drawPetIcon(ctx, R, TH, S, px, py, petIconSize, p, framePetMap, frameSize, frameOff, false)
      if (isDragSource) {
        ctx.globalAlpha = 1
      }
    } else {
      ctx.fillStyle = 'rgba(25,22,18,0.5)'
      ctx.fillRect(px, py, petIconSize, petIconSize)
      ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
      ctx.strokeRect(px, py, petIconSize, petIconSize)
      ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('空', px + petIconSize/2, py + petIconSize/2)
      ctx.textBaseline = 'alphabetic'
    }

    // 拖拽悬停高亮：当从背包拖到队伍上时
    if (drag && drag.source === 'bag') {
      if (g._hitRect && g._hitRect(drag.x, drag.y, px, py, petIconSize, petIconSize)) {
        ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
        ctx.strokeRect(px - 1, py - 1, petIconSize + 2, petIconSize + 2)
      }
    }
  }
  curY = petIconY + petIconSize + 26*S

  // 背包灵宠
  ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText('背包灵宠（拖动到上方可交换）：', padX + 4*S, curY + 2*S)
  curY += 14*S
  if (g.petBag.length > 0) {
    const bagGap = 6*S
    const bagCols = 5
    const bagIconSize = (W - petSidePad*2 - bagGap*(bagCols-1)) / bagCols

    const bagFrameSize = bagIconSize * frameScale
    const bagFrameOff = (bagFrameSize - bagIconSize) / 2

    for (let i = 0; i < g.petBag.length; i++) {
      const col = i % bagCols
      const row = Math.floor(i / bagCols)
      const bx = petSidePad + col * (bagIconSize + bagGap)
      const by = curY + row * (bagIconSize + 26*S + bagGap)
      g._eventPetSlots.push({ rect: [bx, by, bagIconSize, bagIconSize], type: 'bag', index: i })
      g._eventBagPetRects.push([bx, by, bagIconSize, bagIconSize])

      const isDragSource = drag && drag.source === 'bag' && drag.index === i
      if (isDragSource) {
        ctx.globalAlpha = 0.3
      }
      _drawPetIcon(ctx, R, TH, S, bx, by, bagIconSize, g.petBag[i], framePetMap, bagFrameSize, bagFrameOff, false)
      if (isDragSource) {
        ctx.globalAlpha = 1
      }

      // 拖拽悬停高亮：当从队伍拖到背包上时
      if (drag && drag.source === 'team') {
        if (g._hitRect && g._hitRect(drag.x, drag.y, bx, by, bagIconSize, bagIconSize)) {
          ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2.5*S
          ctx.strokeRect(bx - 1, by - 1, bagIconSize + 2, bagIconSize + 2)
        }
      }
    }
    const bagRows = Math.ceil(g.petBag.length / bagCols)
    curY += bagRows * (bagIconSize + 26*S + bagGap)
  }
  curY += 6*S

  // ===== 进入战斗按钮（最下方） =====
  curY += 4*S
  const goBtnW = W*0.6, goBtnH = 46*S
  const goBtnX = (W - goBtnW)/2, goBtnY = curY
  R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, '进入战斗', TH.accent, 16)
  g._eventBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]
  curY += goBtnH + 20*S

  drawBackBtn(g)

  // 拖拽中的灵宠跟随手指绘制
  if (drag && drag.pet) {
    const dragSz = petIconSize * 0.9
    const dragFSz = dragSz * frameScale
    const dragFOff = (dragFSz - dragSz) / 2
    ctx.globalAlpha = 0.85
    _drawPetIcon(ctx, R, TH, S, drag.x - dragSz/2, drag.y - dragSz/2, dragSz, drag.pet, framePetMap, dragFSz, dragFOff, false)
    ctx.globalAlpha = 1
  }

  // 灵宠详情弹窗
  if (g._eventPetDetail != null) {
    drawEventPetDetail(g)
  }
  // 法宝详情弹窗
  if (g._eventWpnDetail != null) {
    _drawWeaponDetailPopup(g)
  }
}

// ===== 法宝卡片绘制 =====
function _drawWeaponCard(ctx, R, TH, S, x, y, w, h, weapon, isEquipped, slotsArr, slotType, index) {
  ctx.fillStyle = isEquipped ? 'rgba(30,25,18,0.85)' : 'rgba(15,15,30,0.6)'
  R.rr(x, y, w, h, 6*S); ctx.fill()
  if (isEquipped) {
    ctx.strokeStyle = '#ffd70066'; ctx.lineWidth = 1*S
    R.rr(x, y, w, h, 6*S); ctx.stroke()
  }

  if (weapon) {
    const iconSz = 30*S
    const iconX = x + 8*S
    const iconY = y + (h - iconSz)/2
    ctx.fillStyle = '#1a1510'
    R.rr(iconX, iconY, iconSz, iconSz, 4*S); ctx.fill()
    const wImg = R.getImg(`assets/equipment/fabao_${weapon.id}.png`)
    if (wImg && wImg.width > 0) {
      ctx.save(); R.rr(iconX, iconY, iconSz, iconSz, 4*S); ctx.clip()
      ctx.drawImage(wImg, iconX, iconY, iconSz, iconSz)
      ctx.restore()
    }
    if (isEquipped) {
      ctx.save()
      const fPad = 1*S
      const fX = iconX - fPad, fY = iconY - fPad, fSz = iconSz + fPad*2, fRd = 5*S
      const wGrd = ctx.createLinearGradient(fX, fY, fX + fSz, fY + fSz)
      wGrd.addColorStop(0, '#ffd700'); wGrd.addColorStop(0.5, '#ffec80'); wGrd.addColorStop(1, '#c8a200')
      ctx.strokeStyle = wGrd; ctx.lineWidth = 2*S
      R.rr(fX, fY, fSz, fSz, fRd); ctx.stroke()
      ctx.restore()
    }
    ctx.textAlign = 'left'
    const textX = iconX + iconSz + 8*S
    ctx.fillStyle = isEquipped ? TH.accent : '#ddd'; ctx.font = `bold ${11*S}px sans-serif`
    ctx.fillText(weapon.name, textX, y + h*0.38)
    ctx.fillStyle = TH.sub; ctx.font = `${9*S}px sans-serif`
    ctx.fillText(weapon.desc, textX, y + h*0.7)

    if (!isEquipped) {
      const eqBtnW = 44*S, eqBtnH = 22*S
      const eqBtnX = x + w - eqBtnW - 6*S, eqBtnY = y + (h - eqBtnH)/2
      R.drawBtn(eqBtnX, eqBtnY, eqBtnW, eqBtnH, '装备', TH.info, 10)
      slotsArr.push({ rect: [eqBtnX, eqBtnY, eqBtnW, eqBtnH], type: slotType, index: index, action: 'equip' })
    }
    // 整个卡片也可点击查看详情
    slotsArr.push({ rect: [x, y, w, h], type: slotType, index: index, action: 'detail' })
  } else {
    ctx.textAlign = 'center'; ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(isEquipped ? '未装备法宝' : '空', x + w/2, y + h*0.58)
    slotsArr.push({ rect: [x, y, w, h], type: slotType, index: index, action: 'detail' })
  }
}

// ===== 灵宠图标绘制 =====
function _drawPetIcon(ctx, R, TH, S, px, py, size, pet, framePetMap, frameSize, frameOff, isSelected) {
  const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
  const ac = ATTR_COLOR[pet.attr]
  const cxP = px + size/2
  const cyP = py + size/2

  ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
  ctx.fillRect(px, py, size, size)
  ctx.save()
  const grd = ctx.createRadialGradient(cxP, cyP - size*0.06, 0, cxP, cyP - size*0.06, size*0.38)
  grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
  grd.addColorStop(1, 'transparent')
  ctx.fillStyle = grd
  ctx.fillRect(px, py, size, size)
  ctx.restore()

  const petAvatar = R.getImg(`assets/pets/pet_${pet.id}.png`)
  if (petAvatar && petAvatar.width > 0) {
    const aw = petAvatar.width, ah = petAvatar.height
    const drawW = size - 2, drawH = drawW * (ah / aw)
    const dy = py + (size - 2) - drawH
    ctx.save()
    ctx.beginPath(); ctx.rect(px + 1, py + 1, size - 2, size - 2); ctx.clip()
    ctx.drawImage(petAvatar, px + 1, dy, drawW, drawH)
    ctx.restore()
  } else {
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${size*0.35}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(ATTR_NAME[pet.attr] || '', cxP, cyP)
    ctx.textBaseline = 'alphabetic'
  }

  const petFrame = framePetMap[pet.attr] || framePetMap.metal
  if (petFrame && petFrame.width > 0) {
    ctx.drawImage(petFrame, px - frameOff, py - frameOff, frameSize, frameSize)
  }

  // 选中高亮
  if (isSelected) {
    ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5*S
    ctx.strokeRect(px - 1, py - 1, size + 2, size + 2)
  }

  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${8*S}px sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText(pet.name.substring(0,4), cxP, py + size + 10*S)
  ctx.fillStyle = TH.dim; ctx.font = `${7*S}px sans-serif`
  ctx.fillText(`ATK:${pet.atk}`, cxP, py + size + 19*S)
}

// ===== 灵宠详情弹窗 =====
function drawEventPetDetail(g) {
  const { ctx, R, TH, W, H, S } = V
  const idx = g._eventPetDetail
  if (idx == null) return
  // 可能是队伍或背包中的宠物
  const p = g._eventPetDetailData || (idx >= 0 && idx < g.pets.length ? g.pets[idx] : null)
  if (!p) return
  const ac = ATTR_COLOR[p.attr]

  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)

  const cardW = W * 0.75, cardH = 200*S
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
  R.drawDialogPanel(cardX, cardY, cardW, cardH)

  const avSz = 64*S
  const avX = cardX + 16*S, avY = cardY + 18*S
  ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
  R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()
  const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
  if (petAvatar && petAvatar.width > 0) {
    ctx.save()
    ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
    const aw = petAvatar.width, ah = petAvatar.height
    const dw = avSz - 2, dh = dw * (ah/aw)
    ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
    ctx.restore()
  }
  const petFrame = R.getImg(`assets/ui/frame_pet_${p.attr}.png`)
  if (petFrame && petFrame.width > 0) {
    const fScale = 1.12, fSz = avSz * fScale, fOff = (fSz - avSz)/2
    ctx.drawImage(petFrame, avX - fOff, avY - fOff, fSz, fSz)
  }

  const infoX = avX + avSz + 14*S
  let iy = cardY + 36*S
  ctx.textAlign = 'left'
  ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${15*S}px sans-serif`
  ctx.fillText(p.name, infoX, iy)
  iy += 22*S
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
  ctx.fillText(`${ATTR_NAME[p.attr]}属性   ATK: ${p.atk}`, infoX, iy)

  iy = avY + avSz + 18*S
  ctx.textAlign = 'left'
  ctx.fillStyle = TH.text; ctx.font = `bold ${13*S}px sans-serif`
  ctx.fillText(`技能：${p.skill.name}`, cardX + 20*S, iy)
  iy += 20*S
  ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
  const descLines = wrapText(p.skill.desc, cardW - 40*S, 11)
  descLines.forEach(line => {
    ctx.fillText(line, cardX + 20*S, iy)
    iy += 16*S
  })
  iy += 4*S
  ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`
  ctx.fillText(`CD：${p.cd} 回合`, cardX + 20*S, iy)

  const closeBtnW = 80*S, closeBtnH = 32*S
  const closeBtnX = cardX + (cardW - closeBtnW)/2
  const closeBtnY = cardY + cardH - closeBtnH - 12*S
  R.drawDialogBtn(closeBtnX, closeBtnY, closeBtnW, closeBtnH, '关闭', 'cancel')
  g._eventPetDetailCloseRect = [closeBtnX, closeBtnY, closeBtnW, closeBtnH]
}

// ===== 法宝详情弹窗 =====
function _drawWeaponDetailPopup(g) {
  const { ctx, R, TH, W, H, S } = V
  const wp = g._eventWpnDetailData
  if (!wp) return

  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)

  const cardW = W * 0.72, cardH = 140*S
  const cardX = (W - cardW) / 2, cardY = (H - cardH) / 2
  R.drawDialogPanel(cardX, cardY, cardW, cardH)

  const iconSz = 48*S
  const iconX = cardX + 16*S, iconY = cardY + 16*S
  ctx.fillStyle = '#1a1510'
  R.rr(iconX, iconY, iconSz, iconSz, 6*S); ctx.fill()
  const wImg = R.getImg(`assets/equipment/fabao_${wp.id}.png`)
  if (wImg && wImg.width > 0) {
    ctx.save(); R.rr(iconX, iconY, iconSz, iconSz, 6*S); ctx.clip()
    ctx.drawImage(wImg, iconX, iconY, iconSz, iconSz)
    ctx.restore()
  }

  const textX = iconX + iconSz + 14*S
  ctx.textAlign = 'left'
  ctx.fillStyle = TH.accent; ctx.font = `bold ${14*S}px sans-serif`
  ctx.fillText(wp.name, textX, cardY + 36*S)
  ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
  const descLines = wrapText(wp.desc, cardW - iconSz - 50*S, 11)
  let dy = cardY + 56*S
  descLines.forEach(line => {
    ctx.fillText(line, textX, dy)
    dy += 16*S
  })

  const closeBtnW = 80*S, closeBtnH = 30*S
  const closeBtnX = cardX + (cardW - closeBtnW)/2
  const closeBtnY = cardY + cardH - closeBtnH - 10*S
  R.drawDialogBtn(closeBtnX, closeBtnY, closeBtnW, closeBtnH, '关闭', 'cancel')
  g._eventWpnDetailCloseRect = [closeBtnX, closeBtnY, closeBtnW, closeBtnH]
}

module.exports = { rEvent, drawEventPetDetail }
