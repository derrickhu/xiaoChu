/**
 * 关卡信息页 — 进入关卡后的第一个页面（重新设计版）
 * 使用 event_bg 背景 + 半透明信息卡片，宠物编队使用头像框
 * 点击宠物头像显示详情弹窗，"调整编队"按钮跳转编队页
 * 渲染入口：rStageInfo  触摸入口：tStageInfo
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetSkillDesc, getPetStarAtk, MAX_STAR } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getStageById, getStageAttr } = require('../data/stages')

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

  // ── 顶部栏：返回 + 体力 ──
  c.save()
  c.fillStyle = 'rgba(255,255,255,0.75)'
  c.font = `${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText('‹ 返回', px, cy + 16 * S)
  _rects.backBtnRect = [0, cy, 80 * S, 32 * S]
  c.textAlign = 'right'
  c.fillStyle = '#8ac8ff'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText(`⚡${g.storage.currentStamina}/${g.storage.maxStamina}`, W - px, cy + 16 * S)
  c.restore()
  cy += 38 * S

  // ── 关卡标题区（大号，居中） ──
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFF5E0'
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3 * S
  c.strokeText(stage.name, W / 2, cy + 12 * S)
  c.fillText(stage.name, W / 2, cy + 12 * S)
  cy += 30 * S

  // 副标题：属性 + 波次 + 消耗 + 次数
  c.fillStyle = attrColor ? attrColor.main : '#ccc'
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`${attrName}属性  ·  ${stage.waves.length}波  ·  ⚡${stage.staminaCost}  ·  今日${dailyLeft}/${stage.dailyLimit}`, W / 2, cy + 6 * S)
  cy += 16 * S

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
  const enemySize = 40 * S
  const cardH = 260 * S

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

  c.fillStyle = 'rgba(230,210,170,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`◇ ${stage.rating.s}回合内通关 → S评价`, indent + 6 * S, iy); iy += 14 * S
  c.fillText(`◇ ${stage.rating.a}回合内通关 → A评价`, indent + 6 * S, iy); iy += 14 * S
  c.fillText(`◇ 通关即可 → B评价`, indent + 6 * S, iy); iy += 16 * S

  // 分隔线
  _drawCardDivider(c, indent, iy, cardX + cardW - cardPad, S)
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
  c.fillStyle = 'rgba(230,210,170,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  const rep = stage.rewards.repeatClear
  c.fillText(`碎片 ×${rep.fragments.min}~${rep.fragments.max}  |  修炼经验 +${rep.exp}  |  宠物经验 +${rep.petExp}`, indent + 6 * S, iy)
  iy += 16 * S

  // 分隔线
  _drawCardDivider(c, indent, iy, cardX + cardW - cardPad, S)
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
    // 圆形背景
    c.fillStyle = 'rgba(60,40,30,0.85)'
    c.beginPath(); c.arc(ecx, ecy, enemySize / 2, 0, Math.PI * 2); c.fill()
    c.strokeStyle = eAttrColor ? eAttrColor.main + '80' : '#88888880'; c.lineWidth = 2 * S
    c.beginPath(); c.arc(ecx, ecy, enemySize / 2, 0, Math.PI * 2); c.stroke()
    // 名称首字
    c.fillStyle = eAttrColor ? eAttrColor.main : '#ccc'
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(enemy.name.slice(0, 1), ecx, ecy)
    // HP
    c.fillStyle = 'rgba(200,180,140,0.6)'; c.font = `${8*S}px "PingFang SC",sans-serif`
    c.textBaseline = 'top'
    c.fillText(`${enemy.hp}`, ecx, iy + enemySize + 2 * S)

    _rects.enemyRects.push({ waveIdx: enemy.waveIdx, enemyIdx: enemy.enemyIdx, rect: [ex, iy, enemySize, enemySize] })
    ex += enemySize + enemyGap
  }

  // ── 卡片内容结束 ──
  const cardContentBottom = cardTop + cardH

  // ── 敌人详情弹窗 ──
  if (g._stageInfoEnemyDetail != null) {
    const eIdx = g._stageInfoEnemyDetail
    const flatEnemies = []
    stage.waves.forEach(w => w.enemies.forEach(e => flatEnemies.push(e)))
    if (eIdx < flatEnemies.length) {
      _drawEnemyDetailPopup(c, R, S, W, H, flatEnemies[eIdx])
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

  // 编队标签（放大+描边让文字醒目）+ 调整编队按钮（同一行右侧）
  const teamLabelY = cardContentBottom + 16 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3 * S
  c.strokeText('我的编队', px + 4 * S, teamLabelY + 10 * S)
  c.fillStyle = '#FFF5E0'
  c.fillText('我的编队', px + 4 * S, teamLabelY + 10 * S)

  // "调整编队" 按钮（同一行右侧）
  const editBtnW = 72 * S, editBtnH = 26 * S
  const editBtnX = W - px - editBtnW - 4 * S
  const editBtnY = teamLabelY + 10 * S - editBtnH / 2
  c.fillStyle = 'rgba(201,168,76,0.2)'
  R.rr(editBtnX, editBtnY, editBtnW, editBtnH, editBtnH / 2); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.5)'; c.lineWidth = 1 * S
  R.rr(editBtnX, editBtnY, editBtnW, editBtnH, editBtnH / 2); c.stroke()
  c.fillStyle = '#D4A843'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('调整编队 ›', editBtnX + editBtnW / 2, editBtnY + editBtnH / 2)
  _rects.editTeamBtnRect = [editBtnX, editBtnY, editBtnW, editBtnH]

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

        // 队长标记
        if (i === 0) {
          const capW = 24 * S, capH = 12 * S
          c.fillStyle = 'rgba(255,215,0,0.8)'
          R.rr(ix, iconY, capW, capH, 3 * S); c.fill()
          c.fillStyle = '#3D2B15'; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText('队长', ix + capW / 2, iconY + capH / 2)
        }

        // 名称 + 等级（头像下方）
        c.textAlign = 'center'; c.textBaseline = 'top'
        c.fillStyle = 'rgba(255,245,220,0.85)'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
        c.fillText(`${basePet.name.slice(0,3)}`, ix + iconSize / 2, iconY + iconSize + 4 * S)
        c.fillStyle = 'rgba(200,180,140,0.6)'; c.font = `${7*S}px "PingFang SC",sans-serif`
        c.fillText(`Lv.${poolPet.level}`, ix + iconSize / 2, iconY + iconSize + 14 * S)

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

  // 编队状态提示
  c.textAlign = 'center'; c.textBaseline = 'top'
  if (teamCount < minTeam) {
    c.fillStyle = '#E06060'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`需要至少${minTeam}只灵宠才能出战`, W / 2, iconY + iconSize + 26 * S)
  }

  // ── 底部按钮（使用 btn_start.png 美术资源） ──
  const goBtnW = W * 0.6
  const goBtnH = goBtnW / 4
  const goBtnX = (W - goBtnW) / 2
  const btnY = H - goBtnH - 36 * S
  if (canGo) {
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (btnImg && btnImg.width > 0) {
      c.drawImage(btnImg, goBtnX, btnY, goBtnW, goBtnH)
    } else {
      _drawGoldBtn(c, R, S, goBtnX, btnY, goBtnW, goBtnH, '开始战斗')
    }
    // 按钮文字
    c.fillStyle = '#FFF5E0'
    c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2 * S
    c.strokeText('开始战斗', goBtnX + goBtnW / 2, btnY + goBtnH / 2)
    c.fillText('开始战斗', goBtnX + goBtnW / 2, btnY + goBtnH / 2)
  } else {
    _drawGoldBtn(c, R, S, goBtnX, btnY, goBtnW, goBtnH, '编队不足', true)
  }
  _rects.startBtnRect = [goBtnX, btnY, goBtnW, goBtnH]

  // ── 宠物详情弹窗 ──
  if (g._stageInfoPetDetail != null) {
    _drawPetDetailPopup(g, c, R, S, W, H)
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
    g.scene = 'stageSelect'
    return
  }

  // 调整编队按钮
  if (_rects.editTeamBtnRect && g._hitRect(x, y, ..._rects.editTeamBtnRect)) {
    const savedTeam = g.storage.getValidSavedTeam()
    g._stageTeamSelected = savedTeam.slice()
    g._stageTeamFilter = 'all'
    g.scene = 'stageTeam'
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
      g.scene = 'stageTeam'
      return
    }
    if (g.storage.currentStamina < stage.staminaCost) {
      g._toastMsg = '体力不足'
      return
    }
    if (!g.storage.canChallengeStage(g._selectedStageId, stage.dailyLimit)) {
      g._toastMsg = '今日挑战次数已用完'
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

/** 卡片内分隔线 */
function _drawCardDivider(c, x1, y, x2, S) {
  const grad = c.createLinearGradient(x1, y, x2, y)
  grad.addColorStop(0, 'rgba(201,168,76,0)')
  grad.addColorStop(0.15, 'rgba(201,168,76,0.25)')
  grad.addColorStop(0.85, 'rgba(201,168,76,0.25)')
  grad.addColorStop(1, 'rgba(201,168,76,0)')
  c.strokeStyle = grad; c.lineWidth = 1
  c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke()
}

/** 金色主按钮 */
function _drawGoldBtn(c, R, S, x, y, w, h, text, disabled) {
  const r = h / 2
  if (disabled) {
    c.fillStyle = 'rgba(80,70,50,0.6)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = '#666'; c.lineWidth = 1.5 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#888'
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(text, x + w / 2, y + h / 2)
    return
  }
  c.save()
  c.shadowColor = 'rgba(180,120,30,0.4)'; c.shadowBlur = 10 * S; c.shadowOffsetY = 3 * S
  const bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#B8451A'); bg.addColorStop(0.5, '#9C3512'); bg.addColorStop(1, '#7A2A0E')
  c.fillStyle = bg
  R.rr(x, y, w, h, r); c.fill()
  c.restore()
  c.strokeStyle = '#D4A843'; c.lineWidth = 2 * S
  R.rr(x, y, w, h, r); c.stroke()
  c.save(); c.globalAlpha = 0.2
  const hl = c.createLinearGradient(x, y, x, y + h * 0.4)
  hl.addColorStop(0, '#fff'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hl
  R.rr(x + 2*S, y + 2*S, w - 4*S, h * 0.4, r); c.fill()
  c.restore()
  c.fillStyle = '#FFE8B8'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 4 * S
  c.fillText(text, x + w / 2, y + h / 2)
  c.shadowBlur = 0
}

/** 敌人详情弹窗 */
function _drawEnemyDetailPopup(c, R, S, W, H, enemy) {
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)
  const pw = W * 0.75, ph = 160 * S
  const px = (W - pw) / 2, py = (H - ph) / 2
  const rad = 12 * S
  const bg = c.createLinearGradient(px, py, px, py + ph)
  bg.addColorStop(0, '#3D2B15'); bg.addColorStop(1, '#1A120A')
  c.fillStyle = bg
  R.rr(px, py, pw, ph, rad); c.fill()
  c.strokeStyle = '#C9A84C'; c.lineWidth = 2 * S
  R.rr(px, py, pw, ph, rad); c.stroke()
  const indent = px + 16 * S
  let dy = py + 18 * S
  const eAttrColor = ATTR_COLOR[enemy.attr]
  c.fillStyle = '#F5E6C8'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(enemy.name, indent, dy)
  c.fillStyle = eAttrColor ? eAttrColor.main : '#888'
  c.font = `${10*S}px "PingFang SC",sans-serif`; c.textAlign = 'right'
  c.fillText(`${ATTR_NAME[enemy.attr] || '?'}属性`, px + pw - 16 * S, dy + 2 * S)
  dy += 24 * S
  c.fillStyle = '#E8D5A8'; c.font = `${11*S}px "PingFang SC",sans-serif`; c.textAlign = 'left'
  c.fillText(`生命：${enemy.hp}`, indent, dy)
  c.fillText(`攻击：${enemy.atk}`, indent + pw * 0.35, dy)
  c.fillText(`防御：${enemy.def}`, indent + pw * 0.7, dy)
  dy += 20 * S
  if (enemy.skills && enemy.skills.length > 0) {
    c.fillStyle = '#B8A0E0'; c.font = `${10*S}px "PingFang SC",sans-serif`
    const skillNames = {
      atkBuff: '攻击增强', defBuff: '防御增强', healPct: '百分比回复',
      critStrike: '暴击一击', shieldBreak: '破盾', stunStrike: '眩晕攻击',
      reflect: '伤害反射', multiStrike: '连续攻击', selfHeal: '自我治愈',
    }
    c.fillText(`技能：${enemy.skills.map(s => skillNames[s] || s).join('、')}`, indent, dy)
  } else {
    c.fillStyle = 'rgba(200,180,140,0.4)'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('无特殊技能', indent, dy)
  }
  dy += 22 * S
  c.fillStyle = 'rgba(200,180,140,0.3)'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击任意处关闭', W / 2, py + ph - 8 * S)
}

/** 宠物详情弹窗 */
function _drawPetDetailPopup(g, c, R, S, W, H) {
  const petId = g._stageInfoPetDetail
  if (!petId) return
  const basePet = getPetById(petId)
  const poolPet = g.storage.getPoolPet(petId)
  if (!basePet || !poolPet) return

  const ac = ATTR_COLOR[basePet.attr]
  const curStar = poolPet.star || 1
  const pet = { ...basePet, star: curStar, level: poolPet.level }
  const curAtk = getPoolPetAtk(poolPet)
  const skillDesc = getPetSkillDesc(pet)

  // 遮罩
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)

  // 面板
  const pw = W * 0.8, ph = 240 * S
  const px = (W - pw) / 2, py = (H - ph) / 2
  const rad = 14 * S

  const bg = c.createLinearGradient(px, py, px, py + ph)
  bg.addColorStop(0, '#3D2B15'); bg.addColorStop(1, '#1A120A')
  c.fillStyle = bg
  R.rr(px, py, pw, ph, rad); c.fill()
  c.strokeStyle = ac ? ac.main + '60' : '#C9A84C60'; c.lineWidth = 2 * S
  R.rr(px, py, pw, ph, rad); c.stroke()

  const indent = px + 18 * S
  const rightEdge = px + pw - 18 * S
  let dy = py + 18 * S

  // 头像 + 名称区
  const avatarSz = 50 * S
  const framePetMap = _getFramePetMap(R)
  const petFrame = framePetMap[basePet.attr] || framePetMap.metal
  const frameScale = 1.12
  const frameSz = avatarSz * frameScale
  const frameOf = (frameSz - avatarSz) / 2

  // 属性色背景
  c.fillStyle = ac ? ac.bg : '#1a1a2e'
  c.fillRect(indent, dy, avatarSz, avatarSz)
  // 头像
  const avatarImg = R.getImg(getPetAvatarPath(pet))
  if (avatarImg && avatarImg.width > 0) {
    const aw = avatarImg.width, ah = avatarImg.height
    const drawW = avatarSz - 2, drawH = drawW * (ah / aw)
    const avDy = dy + (avatarSz - 2) - drawH
    c.save()
    c.beginPath(); c.rect(indent + 1, dy + 1, avatarSz - 2, avatarSz - 2); c.clip()
    c.drawImage(avatarImg, indent + 1, avDy, drawW, drawH)
    c.restore()
  }
  // 头像框
  if (petFrame && petFrame.width > 0) {
    c.drawImage(petFrame, indent - frameOf, dy - frameOf, frameSz, frameSz)
  }

  // 名称 + 等级
  const infoX = indent + avatarSz + 12 * S
  c.fillStyle = '#F5E6C8'; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(basePet.name, infoX, dy + 2 * S)

  // 属性 + 等级标签
  c.fillStyle = ac ? ac.main : '#ccc'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`${ATTR_NAME[basePet.attr] || '?'}属性  Lv.${poolPet.level}`, infoX, dy + 22 * S)

  // 星级
  c.font = `${12*S}px "PingFang SC",sans-serif`
  let starX = infoX
  for (let i = 0; i < MAX_STAR; i++) {
    c.fillStyle = i < curStar ? '#FFD700' : 'rgba(120,120,120,0.6)'
    c.fillText('★', starX, dy + 36 * S)
    starX += c.measureText('★').width
  }

  dy += avatarSz + 14 * S

  // 分隔线
  _drawCardDivider(c, indent, dy, rightEdge, S)
  dy += 10 * S

  // 攻击力
  c.fillStyle = '#E8D5A8'; c.font = `${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('攻击力', indent, dy)
  c.fillStyle = '#FFD700'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${curAtk}`, rightEdge, dy - 2 * S)
  dy += 22 * S

  // CD
  c.textAlign = 'left'
  c.fillStyle = '#E8D5A8'; c.font = `${11*S}px "PingFang SC",sans-serif`
  c.fillText('技能CD', indent, dy)
  c.fillStyle = '#8ac8ff'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${basePet.cd || '?'}回合`, rightEdge, dy)
  dy += 22 * S

  // 技能描述
  if (skillDesc) {
    c.textAlign = 'left'
    c.fillStyle = '#C8B78A'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('技能', indent, dy)
    dy += 16 * S
    c.fillStyle = '#B8A0E0'; c.font = `${10*S}px "PingFang SC",sans-serif`
    // 简单换行处理
    const maxW = pw - 36 * S
    const lines = _wrapText(c, skillDesc, maxW)
    for (const line of lines) {
      c.fillText(line, indent, dy)
      dy += 14 * S
    }
  } else if (curStar < 2) {
    c.textAlign = 'left'
    c.fillStyle = 'rgba(200,180,140,0.5)'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('技能：★2解锁', indent, dy)
  }

  // 关闭提示
  c.fillStyle = 'rgba(200,180,140,0.3)'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击任意处关闭', W / 2, py + ph - 8 * S)
}

/** 简单文本换行 */
function _wrapText(c, text, maxWidth) {
  const lines = []
  let current = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (c.measureText(current + ch).width > maxWidth) {
      lines.push(current)
      current = ch
    } else {
      current += ch
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 5) // 最多5行
}

module.exports = { rStageInfo, tStageInfo }
