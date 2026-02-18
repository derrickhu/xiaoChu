/**
 * 事件预览界面渲染：战斗/奇遇/商店/休息 事件详情 + 灵兽详情弹窗
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_BY } = require('../data/tower')
const { drawBackBtn } = require('./screens')
const { wrapText } = require('./prepareView')

function rEvent(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawBg(g.af)
  const ev = g.curEvent
  if (!ev) return
  const padX = 12*S
  const isBattle = ev.type === 'battle' || ev.type === 'elite' || ev.type === 'boss'
  const typeName = { battle:'普通战斗', elite:'精英战斗', boss:'BOSS挑战', adventure:'奇遇', shop:'神秘商店', rest:'休息之地' }

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

  if (isBattle) {
    const e = ev.data
    const ac = ATTR_COLOR[e.attr]
    const cardX = padX, cardW = W - padX*2, cardTop = curY, cardH = 130*S
    ctx.fillStyle = 'rgba(15,15,30,0.75)'
    R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.fill()
    ctx.strokeStyle = ac ? ac.main + '66' : 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1
    R.rr(cardX, cardTop, cardW, cardH, 10*S); ctx.stroke()

    const avatarSize = 80*S
    const avatarX = cardX + 16*S
    const avatarY = cardTop + (cardH - avatarSize) / 2
    ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 8*S); ctx.fill()
    const avatarPath = e.avatar ? e.avatar + '.png' : null
    const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
    if (enemyImg && enemyImg.width > 0) {
      ctx.save()
      ctx.beginPath(); R.rr(avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2, 7*S); ctx.clip()
      ctx.drawImage(enemyImg, avatarX + 1, avatarY + 1, avatarSize - 2, avatarSize - 2)
      ctx.restore()
    } else {
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${28*S}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(ATTR_NAME[e.attr] || '?', avatarX + avatarSize/2, avatarY + avatarSize/2)
      ctx.textBaseline = 'alphabetic'
    }
    ctx.strokeStyle = ac ? ac.main : '#666'; ctx.lineWidth = 2*S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 8*S); ctx.stroke()

    const infoX = avatarX + avatarSize + 16*S
    let infoY = cardTop + 28*S
    ctx.textAlign = 'left'
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${16*S}px sans-serif`
    ctx.fillText(e.name, infoX, infoY)
    infoY += 24*S
    ctx.fillStyle = ac ? ac.bg : '#333'
    const tagW2 = 70*S, tagH2 = 22*S
    R.rr(infoX, infoY - 15*S, tagW2, tagH2, 4*S); ctx.fill()
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${12*S}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${ATTR_NAME[e.attr]}属性`, infoX + tagW2/2, infoY)
    ctx.textAlign = 'left'
    infoY += 26*S
    const weakAttr = COUNTER_BY[e.attr]
    if (weakAttr) {
      const wc = ATTR_COLOR[weakAttr]
      ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
      ctx.fillText('弱点：', infoX, infoY)
      const weakLabelX = infoX + 40*S
      ctx.fillStyle = wc ? wc.bg : '#333'
      const wTagW = 60*S
      R.rr(weakLabelX, infoY - 13*S, wTagW, 20*S, 4*S); ctx.fill()
      ctx.fillStyle = wc ? wc.main : TH.accent; ctx.font = `bold ${12*S}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(`${ATTR_NAME[weakAttr]}属性`, weakLabelX + wTagW/2, infoY)
      ctx.textAlign = 'left'
    }
    curY = cardTop + cardH + 12*S
  } else if (ev.type === 'adventure') {
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

  // 战斗层：我的阵容
  g._eventPetRects = []
  g._eventEditPetRect = null
  g._eventEditWpnRect = null
  if (isBattle) {
    ctx.textAlign = 'center'
    ctx.fillStyle = TH.dim; ctx.font = `bold ${12*S}px sans-serif`
    ctx.fillText('── 我的阵容 ──', W*0.5, curY + 4*S)
    curY += 16*S

    const hpBarH = 16*S
    R.drawHp(padX, curY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', null, true, '#4dcc4d', g.heroShield)
    curY += hpBarH + 12*S

    // 法宝行
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText('法宝：', padX, curY)
    curY += 6*S
    const wpnH = 36*S
    const wpnCardX = padX, wpnCardW = W - padX*2
    ctx.fillStyle = 'rgba(15,15,30,0.6)'
    R.rr(wpnCardX, curY, wpnCardW, wpnH, 6*S); ctx.fill()
    if (g.weapon) {
      const wIconSz = 28*S
      const wIconX = wpnCardX + 8*S
      const wIconY = curY + (wpnH - wIconSz)/2
      ctx.fillStyle = '#1a1510'
      R.rr(wIconX, wIconY, wIconSz, wIconSz, 4*S); ctx.fill()
      const wImg = R.getImg(`assets/equipment/fabao_${g.weapon.id}.png`)
      if (wImg && wImg.width > 0) {
        ctx.save(); R.rr(wIconX, wIconY, wIconSz, wIconSz, 4*S); ctx.clip()
        ctx.drawImage(wImg, wIconX, wIconY, wIconSz, wIconSz)
        ctx.restore()
      } else {
        ctx.fillStyle = TH.accent; ctx.font = `bold ${16*S}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', wIconX + wIconSz/2, wIconY + wIconSz/2)
        ctx.textBaseline = 'alphabetic'
      }
      // 金色边框
      ctx.save()
      const fPad = 1*S
      const fX = wIconX - fPad, fY = wIconY - fPad, fSz = wIconSz + fPad*2, fRd = 5*S
      const wGrd = ctx.createLinearGradient(fX, fY, fX + fSz, fY + fSz)
      wGrd.addColorStop(0, '#ffd700'); wGrd.addColorStop(0.5, '#ffec80'); wGrd.addColorStop(1, '#c8a200')
      ctx.strokeStyle = wGrd; ctx.lineWidth = 2*S
      R.rr(fX, fY, fSz, fSz, fRd); ctx.stroke()
      ctx.restore()
      ctx.textAlign = 'left'
      ctx.fillStyle = TH.accent; ctx.font = `bold ${12*S}px sans-serif`
      ctx.fillText(g.weapon.name, wIconX + wIconSz + 10*S, curY + wpnH*0.38)
      ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
      ctx.fillText(g.weapon.desc, wIconX + wIconSz + 10*S, curY + wpnH*0.72)
    } else {
      ctx.textAlign = 'center'; ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`
      ctx.fillText('无法宝', W*0.5, curY + wpnH*0.58)
    }
    curY += wpnH + 12*S

    // 灵兽行
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(`灵兽（${g.pets.length}/5）：`, padX, curY)
    curY += 8*S
    const petSlots = 5
    const petGap = 8*S
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

    for (let i = 0; i < petSlots; i++) {
      const px = petSidePad + i * (petIconSize + petGap)
      const py = petIconY
      const cxP = px + petIconSize / 2
      const cyP = py + petIconSize / 2
      g._eventPetRects.push([px, py, petIconSize, petIconSize])

      if (i < g.pets.length) {
        const p = g.pets[i]
        const ac = ATTR_COLOR[p.attr]
        ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
        ctx.fillRect(px, py, petIconSize, petIconSize)
        ctx.save()
        const grd = ctx.createRadialGradient(cxP, cyP - petIconSize*0.06, 0, cxP, cyP - petIconSize*0.06, petIconSize*0.38)
        grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.fillRect(px, py, petIconSize, petIconSize)
        ctx.restore()
        const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
        if (petAvatar && petAvatar.width > 0) {
          const aw = petAvatar.width, ah = petAvatar.height
          const drawW = petIconSize - 2, drawH = drawW * (ah / aw)
          const dy = py + (petIconSize - 2) - drawH
          ctx.save()
          ctx.beginPath(); ctx.rect(px + 1, py + 1, petIconSize - 2, petIconSize - 2); ctx.clip()
          ctx.drawImage(petAvatar, px + 1, dy, drawW, drawH)
          ctx.restore()
        } else {
          ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${petIconSize*0.35}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(ATTR_NAME[p.attr] || '', cxP, cyP)
          ctx.textBaseline = 'alphabetic'
        }
        const petFrame = framePetMap[p.attr] || framePetMap.metal
        if (petFrame && petFrame.width > 0) {
          ctx.drawImage(petFrame, px - frameOff, py - frameOff, frameSize, frameSize)
        }
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${9*S}px sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(p.name.substring(0,4), cxP, py + petIconSize + 12*S)
        ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`
        ctx.fillText(`ATK:${p.atk}`, cxP, py + petIconSize + 22*S)
      } else {
        ctx.fillStyle = 'rgba(25,22,18,0.5)'
        ctx.fillRect(px, py, petIconSize, petIconSize)
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1
        ctx.strokeRect(px, py, petIconSize, petIconSize)
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('空', cxP, cyP)
        ctx.textBaseline = 'alphabetic'
      }
    }
    curY = petIconY + petIconSize + 30*S

    if (g.pets.length > 0) {
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('※ 点击灵兽头像查看技能详情', W*0.5, curY)
      curY += 16*S
    }

    const btnW2 = W*0.36, btnH2 = 34*S, btnGap2 = 12*S
    const btn1X = W*0.5 - btnW2 - btnGap2/2
    const btn2X = W*0.5 + btnGap2/2
    const btnY2 = curY
    R.drawBtn(btn1X, btnY2, btnW2, btnH2, '灵兽编辑', TH.info, 12)
    R.drawBtn(btn2X, btnY2, btnW2, btnH2, '法宝切换', TH.info, 12)
    g._eventEditPetRect = [btn1X, btnY2, btnW2, btnH2]
    g._eventEditWpnRect = [btn2X, btnY2, btnW2, btnH2]
    curY += btnH2 + 16*S
  }

  // 出发按钮
  const goBtnW = W*0.55, goBtnH = 44*S
  const goBtnX = (W - goBtnW)/2, goBtnY = curY
  const label = isBattle ? '进入战斗' : '进入'
  R.drawBtn(goBtnX, goBtnY, goBtnW, goBtnH, label, TH.accent, 16)
  g._eventBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]

  drawBackBtn(g)

  if (g._eventPetDetail != null) {
    drawEventPetDetail(g)
  }
}

function drawEventPetDetail(g) {
  const { ctx, R, TH, W, H, S } = V
  const idx = g._eventPetDetail
  if (idx == null || idx < 0 || idx >= g.pets.length) return
  const p = g.pets[idx]
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

module.exports = { rEvent, drawEventPetDetail }
