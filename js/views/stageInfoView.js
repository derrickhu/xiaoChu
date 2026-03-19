/**
 * 关卡信息页 — 进入关卡后的第一个页面（重新设计版）
 * 使用 event_bg 背景 + 半透明信息卡片，宠物编队使用头像框
 * 点击宠物头像显示详情弹窗，"调整编队"按钮跳转编队页
 * 渲染入口：rStageInfo  触摸入口：tStageInfo
 */
const V = require('./env')
const P = require('../platform')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetAvatarPath, MAX_STAR } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getStageById, getStageAttr } = require('../data/stages')
const { drawPoolPetDetailPopup } = require('./dialogs')
const { drawSeparator, drawGoldBtn } = require('./uiUtils')

const _rects = {
  backBtnRect: null,
  startBtnRect: null,
  editTeamBtnRect: null,
  petSlotRects: [],   // [{petId, rect}]
  enemyRects: [],
}

// 头像框缓存
let _framePetMap = null
function _getFramePetMap(R) {
  if (!_framePetMap) {
    _framePetMap = {
      metal: R.getImg('assets/ui/frame_pet_metal.png'),
      wood:  R.getImg('assets/ui/frame_pet_wood.png'),
      water: R.getImg('assets/ui/frame_pet_water.png'),
      fire:  R.getImg('assets/ui/frame_pet_fire.png'),
      earth: R.getImg('assets/ui/frame_pet_earth.png'),
    }
  }
  return _framePetMap
}

// ===== 渲染 =====
function rStageInfo(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  // 背景：使用 event_bg 代替 home_bg+黑色遮罩
  R.drawEventBg(g.af || 0)

  const stage = getStageById(g._selectedStageId)
  if (!stage) return

  const stageAttr = getStageAttr(g._selectedStageId)
  const attrColor = ATTR_COLOR[stageAttr]
  const attrName = ATTR_NAME[stageAttr] || '?'
  const bestRating = g.storage.getStageBestRating(stage.id)
  const isFirstClear = !g.storage.isStageCleared(stage.id)
  const dailyUsed = g.storage.getStageDailyCount(stage.id)
  const dailyLeft = stage.dailyLimit - dailyUsed
  const savedTeam = g.storage.getValidSavedTeam()
  const maxSlots = stage.teamSize.max
  const minTeam = stage.teamSize.min
  const teamCount = savedTeam.length
  const canGo = teamCount >= minTeam

  const px = 14 * S
  const contentW = W - 28 * S
  let cy = safeTop + 4 * S

  // ── 顶部栏：返回圆形按钮 + 体力胶囊（与灵宠池页面风格一致） ──
  c.save()

  const topCenterY = cy + 17 * S

  // 返回按钮（圆形半透明背景 + 箭头）
  const btnSz = 36 * S
  const btnX = 12 * S
  const btnY = topCenterY - btnSz / 2
  c.fillStyle = 'rgba(0,0,0,0.4)'
  c.beginPath()
  c.arc(btnX + btnSz / 2, topCenterY, btnSz / 2, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#fff'
  c.lineWidth = 2.5 * S
  c.lineCap = 'round'; c.lineJoin = 'round'
  const arrowX = btnX + btnSz / 2 + 3 * S
  c.beginPath()
  c.moveTo(arrowX, topCenterY - 8 * S)
  c.lineTo(arrowX - 8 * S, topCenterY)
  c.lineTo(arrowX, topCenterY + 8 * S)
  c.stroke()
  _rects.backBtnRect = [btnX, btnY, btnSz, btnSz]

  // 体力显示（图标 + 胶囊背景 + 数值，与灵宠池经验池风格一致）
  const stIcon = R.getImg('assets/ui/icon_stamina.png')
  const stTxt = `${g.storage.currentStamina}/${g.storage.maxStamina}`
  if (stIcon && stIcon.width > 0) {
    const iconSz = 32 * S
    const iconX = btnX + btnSz + 8 * S
    const iconY = topCenterY - iconSz / 2

    const txtX = iconX + iconSz + 4 * S
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    const txtW = c.measureText(stTxt).width
    const padR = 8 * S
    const capH = 26 * S, capR = capH / 2
    const capX = iconX + iconSz * 0.38
    const capW = txtX + txtW + padR - capX
    const capY = topCenterY - capH / 2
    c.beginPath()
    c.moveTo(capX + capR, capY); c.lineTo(capX + capW - capR, capY)
    c.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
    c.lineTo(capX + capW, capY + capH - capR)
    c.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
    c.lineTo(capX + capR, capY + capH)
    c.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
    c.lineTo(capX, capY + capR)
    c.quadraticCurveTo(capX, capY, capX + capR, capY)
    c.closePath()
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill()

    c.fillStyle = '#fff'
    c.fillText(stTxt, txtX, topCenterY)

    c.drawImage(stIcon, iconX, iconY, iconSz, iconSz)
  } else {
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.fillStyle = '#fff'
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText(`⚡${stTxt}`, btnX + btnSz + 12 * S, topCenterY)
  }

  c.restore()
  cy += 40 * S

  // ── 关卡标题区（大号，居中） ──
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFF5E0'
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3 * S
  c.strokeText(stage.name, W / 2, cy + 12 * S)
  c.fillText(stage.name, W / 2, cy + 12 * S)
  cy += 30 * S

  // 副标题：属性 + 波次 + 消耗 + 次数（加胶囊衬底）
  const subText = `${attrName}属性  ·  ${stage.waves.length}波  ·  ⚡${stage.staminaCost}  ·  今日${dailyLeft}/${stage.dailyLimit}`
  c.font = `${10*S}px "PingFang SC",sans-serif`
  const subW = c.measureText(subText).width + 20 * S
  const subH = 20 * S
  const subX = (W - subW) / 2
  c.fillStyle = 'rgba(0,0,0,0.45)'
  R.rr(subX, cy, subW, subH, subH / 2); c.fill()
  c.strokeStyle = attrColor ? attrColor.main + '60' : 'rgba(200,180,120,0.4)'; c.lineWidth = 1 * S
  R.rr(subX, cy, subW, subH, subH / 2); c.stroke()
  c.fillStyle = attrColor ? attrColor.main : '#E8D5A3'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(subText, W / 2, cy + subH / 2)
  cy += subH + 6 * S

  // 历史最佳评价（醒目星级徽章）
  if (bestRating) {
    const stars = bestRating === 'S' ? '★★★' : bestRating === 'A' ? '★★☆' : '★☆☆'
    const badgeColor = bestRating === 'S' ? '#ffd700' : bestRating === 'A' ? '#C0C0C0' : '#CD853F'
    // 徽章背景
    const badgeW = 110 * S, badgeH = 22 * S
    const badgeX = (W - badgeW) / 2, badgeY = cy
    c.fillStyle = badgeColor + '25'
    R.rr(badgeX, badgeY, badgeW, badgeH, badgeH / 2); c.fill()
    c.strokeStyle = badgeColor + '60'; c.lineWidth = 1 * S
    R.rr(badgeX, badgeY, badgeW, badgeH, badgeH / 2); c.stroke()
    c.fillStyle = badgeColor
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(`${stars} ${bestRating}`, W / 2, badgeY + badgeH / 2)
    cy += badgeH + 6 * S
  } else {
    cy += 4 * S
  }

  // ── 主内容卡片（半透明面板，固定高度） ──
  const cardPad = 14 * S
  const cardX = 10 * S
  const cardW = W - 20 * S
  const cardTop = cy
  const cardRad = 12 * S
  const indent = cardX + cardPad
  const enemySize = 56 * S
  const cardH = 280 * S

  // 画卡片背景
  c.fillStyle = 'rgba(45,30,18,0.75)'
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.25)'; c.lineWidth = 1 * S
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.stroke()

  let iy = cardTop + cardPad

  // ── 挑战目标 ──
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#D4A843'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText('挑战目标', indent, iy)
  iy += 18 * S

  c.fillStyle = '#E8D5A3'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`◇ ${stage.rating.s}回合内通关 → S评价`, indent + 6 * S, iy); iy += 14 * S
  c.fillText(`◇ ${stage.rating.a}回合内通关 → A评价`, indent + 6 * S, iy); iy += 14 * S
  c.fillText(`◇ 通关即可 → B评价`, indent + 6 * S, iy); iy += 16 * S

  // 分隔线
  drawSeparator(c, indent, iy, cardX + cardW - cardPad, null, 0.25, 0.15, 0.85)
  iy += 8 * S

  // ── 通关奖励 ──
  c.fillStyle = '#D4A843'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('通关奖励', indent, iy)
  iy += 18 * S

  c.font = `${10*S}px "PingFang SC",sans-serif`
  if (isFirstClear && stage.rewards.firstClear) {
    c.fillStyle = '#ffd700'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('✦ 首通奖励', indent + 6 * S, iy); iy += 14 * S
    c.fillStyle = 'rgba(255,230,150,0.8)'; c.font = `${10*S}px "PingFang SC",sans-serif`
    for (const r of stage.rewards.firstClear) {
      if (r.type === 'fragment') c.fillText(`  灵宠碎片 ×${r.count}`, indent + 12 * S, iy)
      else if (r.type === 'exp') c.fillText(`  修炼经验 +${r.amount}`, indent + 12 * S, iy)
      else if (r.type === 'petExp') c.fillText(`  宠物经验 +${r.amount}`, indent + 12 * S, iy)
      iy += 13 * S
    }
    iy += 2 * S
  }
  c.fillStyle = '#E8D5A3'; c.font = `${10*S}px "PingFang SC",sans-serif`
  const rep = stage.rewards.repeatClear
  c.fillText(`碎片 ×${rep.fragments.min}~${rep.fragments.max}  |  修炼经验 +${rep.exp}  |  宠物经验 +${rep.petExp}`, indent + 6 * S, iy)
  iy += 16 * S

  // 分隔线
  drawSeparator(c, indent, iy, cardX + cardW - cardPad, null, 0.25, 0.15, 0.85)
  iy += 8 * S

  // ── 敌方阵容 ──
  c.fillStyle = '#D4A843'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('敌方阵容', indent, iy)
  iy += 22 * S

  _rects.enemyRects = []
  const enemyGap = 10 * S
  const allEnemies = []
  stage.waves.forEach((w, wi) => w.enemies.forEach((e, ei) => allEnemies.push({ ...e, waveIdx: wi, enemyIdx: ei })))
  const enemyRowW = allEnemies.length * (enemySize + enemyGap) - enemyGap
  let ex = (W - enemyRowW) / 2

  for (const enemy of allEnemies) {
    const eAttrColor = ATTR_COLOR[enemy.attr]
    const ecx = ex + enemySize / 2, ecy = iy + enemySize / 2
    const eR = 4 * S
    // 方形背景
    c.fillStyle = 'rgba(60,40,30,0.85)'
    R.rr(ex, iy, enemySize, enemySize, eR); c.fill()
    // 头像图片
    const avatarName = enemy.avatar ? enemy.avatar.replace('stage_enemies/', '') : null
    const avatarImg = avatarName ? R.getImg(`assets/stage_avatars/${avatarName}_avatar.png`) : null
    if (avatarImg && avatarImg.width > 0) {
      c.save()
      R.rr(ex + 1 * S, iy + 1 * S, enemySize - 2 * S, enemySize - 2 * S, eR - 1 * S); c.clip()
      c.drawImage(avatarImg, ex + 1 * S, iy + 1 * S, enemySize - 2 * S, enemySize - 2 * S)
      c.restore()
    } else {
      c.fillStyle = eAttrColor ? eAttrColor.main : '#ccc'
      c.font = `bold ${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(enemy.name.slice(0, 1), ecx, ecy)
    }
    // 属性色边框
    c.strokeStyle = eAttrColor ? eAttrColor.main : '#888'; c.lineWidth = 2 * S
    R.rr(ex, iy, enemySize, enemySize, eR); c.stroke()
    // 名称
    c.fillStyle = '#E8D5A8'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(enemy.name, ecx, iy + enemySize + 3 * S)

    _rects.enemyRects.push({ waveIdx: enemy.waveIdx, enemyIdx: enemy.enemyIdx, rect: [ex, iy, enemySize, enemySize + 16 * S] })
    ex += enemySize + enemyGap
  }

  // ── 卡片内容结束 ──
  const cardContentBottom = cardTop + cardH

  // ── 敌人详情面板（内联，不遮挡页面） ──
  let detailPanelH = 0
  if (g._stageInfoEnemyDetail != null) {
    const eIdx = g._stageInfoEnemyDetail
    const flatEnemies = []
    stage.waves.forEach(w => w.enemies.forEach(e => flatEnemies.push(e)))
    if (eIdx < flatEnemies.length) {
      detailPanelH = _drawEnemyDetailInline(c, R, S, W, cardX, cardContentBottom, cardW, flatEnemies[eIdx])
    }
  }

  // ── 编队区域 ──
  const framePetMap = _getFramePetMap(R)
  const iconSize = 56 * S
  const frameScale = 1.12
  const frameSize = iconSize * frameScale
  const frameOff = (frameSize - iconSize) / 2
  const iconGap = 10 * S
  const iconsW = maxSlots * iconSize + (maxSlots - 1) * iconGap
  const iconStartX = (W - iconsW) / 2

  // 编队标签（放大+描边让文字醒目）
  const teamLabelY = cardContentBottom + detailPanelH + 16 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3 * S
  c.strokeText('我的编队', px + 4 * S, teamLabelY + 10 * S)
  c.fillStyle = '#FFF5E0'
  c.fillText('我的编队', px + 4 * S, teamLabelY + 10 * S)

  // 宠物头像槽（标签下方留足间距）
  const iconY = teamLabelY + 32 * S
  _rects.petSlotRects = []

  for (let i = 0; i < maxSlots; i++) {
    const ix = iconStartX + i * (iconSize + iconGap)

    if (i < savedTeam.length) {
      const pid = savedTeam[i]
      const basePet = getPetById(pid)
      const poolPet = g.storage.getPoolPet(pid)
      if (basePet && poolPet) {
        const pet = { ...basePet, star: poolPet.star, level: poolPet.level }
        const ac = ATTR_COLOR[pet.attr]

        // 属性色背景
        c.fillStyle = ac ? ac.bg : '#1a1a2e'
        c.fillRect(ix, iconY, iconSize, iconSize)

        // 径向光晕
        c.save()
        const grd = c.createRadialGradient(ix + iconSize/2, iconY + iconSize/2 - iconSize*0.06, 0,
                                            ix + iconSize/2, iconY + iconSize/2 - iconSize*0.06, iconSize*0.38)
        grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
        grd.addColorStop(1, 'transparent')
        c.fillStyle = grd
        c.fillRect(ix, iconY, iconSize, iconSize)
        c.restore()

        // 头像
        const petAvatar = R.getImg(getPetAvatarPath(pet))
        if (petAvatar && petAvatar.width > 0) {
          const aw = petAvatar.width, ah = petAvatar.height
          const drawW = iconSize - 2, drawH = drawW * (ah / aw)
          const dy = iconY + (iconSize - 2) - drawH
          c.save()
          c.beginPath(); c.rect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2); c.clip()
          c.drawImage(petAvatar, ix + 1, dy, drawW, drawH)
          c.restore()
        }

        // 头像框
        const petFrame = framePetMap[pet.attr] || framePetMap.metal
        if (petFrame && petFrame.width > 0) {
          c.drawImage(petFrame, ix - frameOff, iconY - frameOff, frameSize, frameSize)
        }

        // 星级标记（左下角）
        const starText = '★'.repeat(pet.star || 1)
        c.save()
        c.font = `bold ${iconSize * 0.14}px "PingFang SC",sans-serif`
        c.textAlign = 'left'; c.textBaseline = 'bottom'
        c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 2 * S
        c.strokeText(starText, ix + 2*S, iconY + iconSize - 2*S)
        c.fillStyle = '#ffd700'
        c.fillText(starText, ix + 2*S, iconY + iconSize - 2*S)
        c.textBaseline = 'alphabetic'
        c.restore()

        // 此页不显示队长标记
        _rects.petSlotRects.push({ petId: pid, rect: [ix, iconY, iconSize, iconSize] })
      }
    } else {
      // 空槽
      c.fillStyle = 'rgba(60,50,35,0.5)'
      R.rr(ix, iconY, iconSize, iconSize, 6 * S); c.fill()
      c.strokeStyle = 'rgba(200,180,120,0.2)'; c.lineWidth = 1 * S
      R.rr(ix, iconY, iconSize, iconSize, 6 * S); c.stroke()
      c.fillStyle = 'rgba(200,180,120,0.3)'; c.font = `${22*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('+', ix + iconSize / 2, iconY + iconSize / 2)
    }
  }

  // "调整编队" 按钮（深色衬底保证在亮色背景下可读）
  const editBtnW = 110 * S, editBtnH = 28 * S
  const editBtnX = (W - editBtnW) / 2
  const editBtnY = iconY + iconSize + 10 * S
  c.fillStyle = 'rgba(45,30,18,0.75)'
  R.rr(editBtnX, editBtnY, editBtnW, editBtnH, editBtnH / 2); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.5)'; c.lineWidth = 1.5 * S
  R.rr(editBtnX, editBtnY, editBtnW, editBtnH, editBtnH / 2); c.stroke()
  c.fillStyle = '#FFF5E0'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2 * S
  c.strokeText('调整编队 ›', editBtnX + editBtnW / 2, editBtnY + editBtnH / 2)
  c.fillStyle = '#FFF5E0'
  c.fillText('调整编队 ›', editBtnX + editBtnW / 2, editBtnY + editBtnH / 2)
  _rects.editTeamBtnRect = [editBtnX, editBtnY, editBtnW, editBtnH]

  // 编队状态提示
  c.textAlign = 'center'; c.textBaseline = 'top'
  if (teamCount < minTeam) {
    c.fillStyle = '#E06060'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`需要至少${minTeam}只灵宠才能出战`, W / 2, editBtnY + editBtnH + 6 * S)
  }

  // ── 底部按钮（使用 btn_start.png 美术资源） ──
  const goBtnW = W * 0.6
  const goBtnH = goBtnW / 4
  const goBtnX = (W - goBtnW) / 2
  const goBtnY = H - goBtnH - 36 * S
  if (canGo) {
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (btnImg && btnImg.width > 0) {
      c.drawImage(btnImg, goBtnX, goBtnY, goBtnW, goBtnH)
    } else {
      drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '开始战斗')
    }
    // 按钮文字
    c.fillStyle = '#FFF5E0'
    c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2 * S
    c.strokeText('开始战斗', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
    c.fillText('开始战斗', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
  } else {
    drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '编队不足', true)
  }
  _rects.startBtnRect = [goBtnX, goBtnY, goBtnW, goBtnH]

  // ── 宠物详情弹窗 ──
  if (g._stageInfoPetDetail != null) {
    drawPoolPetDetailPopup(g, g._stageInfoPetDetail, g.storage)
  }
}

// ===== 触摸 =====
function tStageInfo(g, x, y, type) {
  if (type !== 'end') return

  // 敌人详情弹窗打开时，点击关闭
  if (g._stageInfoEnemyDetail != null) {
    g._stageInfoEnemyDetail = null
    return
  }

  // 宠物详情弹窗打开时，点击关闭
  if (g._stageInfoPetDetail != null) {
    g._stageInfoPetDetail = null
    return
  }

  // 返回
  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g.setScene('stageSelect')
    return
  }

  // 调整编队按钮
  if (_rects.editTeamBtnRect && g._hitRect(x, y, ..._rects.editTeamBtnRect)) {
    const savedTeam = g.storage.getValidSavedTeam()
    g._stageTeamSelected = savedTeam.slice()
    g._stageTeamFilter = 'all'
    g.setScene('stageTeam')
    return
  }

  // 宠物头像点击 → 显示详情弹窗
  for (let i = 0; i < _rects.petSlotRects.length; i++) {
    const item = _rects.petSlotRects[i]
    if (g._hitRect(x, y, ...item.rect)) {
      g._stageInfoPetDetail = item.petId
      return
    }
  }

  // 开始战斗
  if (_rects.startBtnRect && g._hitRect(x, y, ..._rects.startBtnRect)) {
    const stage = getStageById(g._selectedStageId)
    if (!stage) return
    const savedTeam = g.storage.getValidSavedTeam()
    if (savedTeam.length < stage.teamSize.min) {
      g._stageTeamSelected = savedTeam.slice()
      g._stageTeamFilter = 'all'
      g.setScene('stageTeam')
      return
    }
    if (g.storage.currentStamina < stage.staminaCost) {
      P.showGameToast('体力不足')
      return
    }
    if (!g.storage.canChallengeStage(g._selectedStageId, stage.dailyLimit)) {
      P.showGameToast('今日挑战次数已用完')
      return
    }
    const stageMgr = require('../engine/stageManager')
    stageMgr.startStage(g, g._selectedStageId, savedTeam)
    return
  }

  // 敌人头像点击
  for (let i = 0; i < _rects.enemyRects.length; i++) {
    const item = _rects.enemyRects[i]
    if (g._hitRect(x, y, ...item.rect)) {
      g._stageInfoEnemyDetail = i
      return
    }
  }
}

// ===== 绘制工具 =====

/** 敌人详情面板（内联在卡片下方，浅色暖白风格，返回占用高度） */
function _drawEnemyDetailInline(c, R, S, W, cardX, topY, cardW, enemy) {
  const eAttrColor = ATTR_COLOR[enemy.attr]
  const ac = eAttrColor ? eAttrColor.main : '#888'
  const pad = 14 * S
  const ph = 96 * S
  const py = topY + 6 * S
  const rad = 12 * S

  R.drawInfoPanel(cardX, py, cardW, ph)

  // 左侧头像
  const avatarSz = 52 * S
  const avatarX = cardX + pad
  const avatarY = py + (ph - avatarSz) / 2
  const avatarR = 6 * S
  c.fillStyle = 'rgba(0,0,0,0.08)'
  R.rr(avatarX, avatarY, avatarSz, avatarSz, avatarR); c.fill()
  const avatarName = enemy.avatar ? enemy.avatar.replace('stage_enemies/', '') : null
  const avatarImg = avatarName ? R.getImg(`assets/stage_avatars/${avatarName}_avatar.png`) : null
  if (avatarImg && avatarImg.width > 0) {
    c.save()
    R.rr(avatarX + 1 * S, avatarY + 1 * S, avatarSz - 2 * S, avatarSz - 2 * S, avatarR - 1 * S); c.clip()
    c.drawImage(avatarImg, avatarX + 1 * S, avatarY + 1 * S, avatarSz - 2 * S, avatarSz - 2 * S)
    c.restore()
  }
  c.strokeStyle = ac; c.lineWidth = 2 * S
  R.rr(avatarX, avatarY, avatarSz, avatarSz, avatarR); c.stroke()

  // 右侧信息
  const textX = avatarX + avatarSz + 12 * S
  const textW = cardX + cardW - pad - textX
  let dy = py + 14 * S

  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#3D2B1F'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText(enemy.name, textX, dy)
  c.fillStyle = ac; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${ATTR_NAME[enemy.attr] || '?'}属性`, cardX + cardW - pad, dy + 2 * S)
  dy += 20 * S

  c.textAlign = 'left'
  c.fillStyle = '#5A4A3A'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`生命 ${enemy.hp}`, textX, dy)
  c.fillText(`攻击 ${enemy.atk}`, textX + textW * 0.38, dy)
  c.fillText(`防御 ${enemy.def}`, textX + textW * 0.72, dy)
  dy += 18 * S

  if (enemy.skills && enemy.skills.length > 0) {
    const skillNames = {
      atkBuff: '攻击增强', defBuff: '防御增强', healPct: '百分比回复',
      critStrike: '暴击一击', shieldBreak: '破盾', stunStrike: '眩晕攻击',
      reflect: '伤害反射', multiStrike: '连续攻击', selfHeal: '自我治愈',
    }
    c.fillStyle = '#7A5C30'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(`技能：${enemy.skills.map(s => skillNames[s] || s).join('、')}`, textX, dy)
  } else {
    c.fillStyle = '#AAA090'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('无特殊技能', textX, dy)
  }

  // 底部提示
  c.fillStyle = '#B0A090'; c.font = `${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击任意处关闭', cardX + cardW / 2, py + ph - 5 * S)

  return ph + 6 * S
}

module.exports = { rStageInfo, tStageInfo }
