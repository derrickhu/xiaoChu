/**
 * 关卡信息页 — 进入关卡后的第一个页面（重新设计版）
 * 使用 event_bg 背景 + 半透明信息卡片，宠物编队使用头像框
 * 点击宠物头像显示详情弹窗，"调整编队"按钮跳转编队页
 * 渲染入口：rStageInfo  触摸入口：tStageInfo
 */
const V = require('./env')
const P = require('../platform')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY, ENEMY_SKILLS } = require('../data/tower')
const { getPetById, getPetAvatarPath, MAX_STAR } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getStageById, getStageAttr, getEnemyPortraitPath, getEffectiveStageTeamMin, getStageChapterOrderLabel, CHAPTER_RECOMMENDED } = require('../data/stages')
const { STAMINA_COST } = require('../data/constants')
const { STAR_REWARDS } = require('../data/economyConfig')
const { getRewardPreview } = require('../engine/rewardPreview')
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

function _calcAvgPetStar(g) {
  const pool = g.storage && g.storage._d && g.storage._d.petPool
  if (!pool || !pool.length) return 1
  const total = pool.reduce((sum, p) => sum + (p.star || 1), 0)
  return total / pool.length
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
  const hasDailyLimit = stage.dailyLimit > 0
  const dailyUsed = hasDailyLimit ? g.storage.getStageDailyCount(stage.id) : 0
  const dailyLeft = hasDailyLimit ? stage.dailyLimit - dailyUsed : Infinity
  const savedTeam = g.storage.getValidSavedTeam()
  const maxSlots = stage.teamSize.max
  const minTeam = getEffectiveStageTeamMin(g.storage, stage)
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

  // 体力显示（图标 + 胶囊背景 + 数值，与灵宠池灵石栏风格一致）
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

  // ── 关卡编号 + 标题（先显示 章-关，再显示关卡名） ──
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const stageOrderLabel = getStageChapterOrderLabel(stage)
  if (stageOrderLabel) {
    c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.fillStyle = 'rgba(255,236,200,0.95)'
    c.strokeStyle = 'rgba(0,0,0,0.45)'; c.lineWidth = 2 * S
    const orderLine = `秘境 ${stageOrderLabel}`
    c.strokeText(orderLine, W / 2, cy + 7 * S)
    c.fillText(orderLine, W / 2, cy + 7 * S)
  }
  c.fillStyle = '#FFF5E0'
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 3 * S
  const nameY = stageOrderLabel ? cy + 26 * S : cy + 12 * S
  c.strokeText(stage.name, W / 2, nameY)
  c.fillText(stage.name, W / 2, nameY)
  cy += stageOrderLabel ? 38 * S : 30 * S

  // 副标题：属性 + 波次 + 消耗（无限制时不显示次数）
  const dailyStr = hasDailyLimit ? `  ·  今日${dailyLeft}/${stage.dailyLimit}` : ''
  const subText = `${attrName}属性  ·  ${stage.waves.length}波  ·  ⚡${stage.staminaCost ?? STAMINA_COST}${dailyStr}`
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

  // 建议战力提示
  const rec = CHAPTER_RECOMMENDED[stage.chapter]
  if (rec) {
    const cult = g.storage.cultivation
    const cultLv = cult ? cult.level : 1
    const avgStar = _calcAvgPetStar(g)
    const underpowered = cultLv < rec.cultLevel || avgStar < rec.petStar
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    const recText = `建议：修炼 Lv.${rec.cultLevel}  宠物 ${rec.petStar}★`
    c.fillStyle = underpowered ? '#FF8C00' : 'rgba(200,180,120,0.6)'
    c.fillText(recText, W / 2, cy + 5 * S)
    cy += 16 * S
  }

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

  // 先预估卡片高度：星级目标区 + 奖励区 + 敌方阵容区（使用 preview 保持一致）
  const estPreview = getRewardPreview(g, stage)
  let estH = cardPad + 18 * S + 14 * 3 * S + 4 * S + 8 * S + 18 * S
  if (estPreview.isFirstClear && estPreview.firstClear.length > 0) {
    estH += 16 * S
    for (const r of estPreview.firstClear) {
      if (r.type === 'pet') estH += 22 * S + 4 * S
      else if (r.type === 'fragment' && r.wasPet) estH += 18 * S + 4 * S
      else estH += 13 * S
    }
    estH += 2 * S
  }
  estH += 16 * S + 8 * S + 22 * S + enemySize + cardPad
  const cardH = Math.max(280 * S, estH)

  // 画卡片背景
  c.fillStyle = 'rgba(45,30,18,0.75)'
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.25)'; c.lineWidth = 1 * S
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.stroke()

  let iy = cardTop + cardPad

  // ── 星级目标与奖励预览 ──
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#D4A843'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText('星级目标', indent, iy)
  iy += 18 * S

  const starsClaimed = g.storage.getStageStarsClaimed(stage.id)
  const chIdx = stage.order - 1
  const starCfg = STAR_REWARDS[stage.chapter] && STAR_REWARDS[stage.chapter][chIdx]

  const starDefs = [
    { star: 1, label: '★', cond: '通关即可', mul: '×1', claimed: starsClaimed[0], extra: null },
    { star: 2, label: '★★', cond: `≤${stage.rating.a}回合`, mul: '×1.5', claimed: starsClaimed[1], extra: starCfg ? starCfg.star2 : null },
    { star: 3, label: '★★★', cond: `≤${stage.rating.s}回合`, mul: '×2', claimed: starsClaimed[2], extra: starCfg ? starCfg.star3 : null },
  ]

  for (const sd of starDefs) {
    const rowY = iy
    // 星标
    c.fillStyle = sd.claimed ? '#90EE90' : '#FFD700'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.textBaseline = 'top'
    const prefix = sd.claimed ? '✓ ' : '  '
    c.fillText(`${prefix}${sd.label}`, indent + 2 * S, rowY)
    // 条件
    c.fillStyle = '#E8D5A3'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(sd.cond, indent + 48 * S, rowY)
    // 额外奖励（2★/3★）
    if (sd.extra) {
      const parts = []
      if (sd.extra.soulStone) parts.push(`灵石+${sd.extra.soulStone}`)
      if (sd.extra.fragment) parts.push(`碎片+${sd.extra.fragment}`)
      if (sd.extra.awakenStone) parts.push(`觉醒石+${sd.extra.awakenStone}`)
      c.textAlign = 'right'
      c.fillStyle = sd.claimed ? '#90EE90' : '#D4A030'
      c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(parts.join(' '), cardX + cardW - cardPad, rowY + 1 * S)
      c.textAlign = 'left'
    }
    iy += 14 * S
  }
  iy += 4 * S

  // 分隔线
  drawSeparator(c, indent, iy, cardX + cardW - cardPad, null, 0.25, 0.15, 0.85)
  iy += 8 * S

  // ── 通关奖励（使用 rewardPreview 保持与结算一致） ──
  const preview = getRewardPreview(g, stage)

  c.fillStyle = '#D4A843'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('通关奖励', indent, iy)
  iy += 18 * S

  if (preview.isFirstClear && preview.firstClear.length > 0) {
    c.fillStyle = '#ffd700'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('✦ 首通奖励', indent + 6 * S, iy); iy += 16 * S

    for (const r of preview.firstClear) {
      if (r.type === 'pet') {
        const rewardPet = getPetById(r.petId)
        if (rewardPet) {
          const petIconSz = 22 * S
          const avatarPath = getPetAvatarPath({ ...rewardPet, star: 1 })
          const petImg = R.getImg(avatarPath)
          if (petImg && petImg.width > 0) {
            c.save()
            R.rr(indent + 12 * S, iy, petIconSz, petIconSz, 4 * S); c.clip()
            const pw2 = petImg.width, ph2 = petImg.height
            const pScale = Math.max(petIconSz / pw2, petIconSz / ph2)
            const dw2 = pw2 * pScale, dh2 = ph2 * pScale
            c.drawImage(petImg, indent + 12 * S + (petIconSz - dw2) / 2, iy + (petIconSz - dh2) / 2, dw2, dh2)
            c.restore()
            const petAttrColor = ATTR_COLOR[rewardPet.attr]
            c.strokeStyle = petAttrColor ? petAttrColor.main : '#ffd700'; c.lineWidth = 1.5 * S
            R.rr(indent + 12 * S, iy, petIconSz, petIconSz, 4 * S); c.stroke()
          }
          c.fillStyle = '#ffd700'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
          c.textBaseline = 'middle'
          c.fillText(rewardPet.name, indent + 12 * S + petIconSz + 6 * S, iy + petIconSz / 2)
          c.textBaseline = 'top'
          iy += petIconSz + 4 * S
        }
      } else if (r.type === 'fragment') {
        const fragPet = getPetById(r.petId)
        const fragName = fragPet ? fragPet.name + '碎片' : '碎片'
        c.fillStyle = 'rgba(255,230,150,0.8)'; c.font = `${10*S}px "PingFang SC",sans-serif`
        // 如果是宠物已拥有转化为碎片，显示带图标的碎片名
        if (r.wasPet && fragPet) {
          const fragIconSz = 18 * S
          const avatarPath = getPetAvatarPath({ ...fragPet, star: 1 })
          const fragImg = R.getImg(avatarPath)
          if (fragImg && fragImg.width > 0) {
            c.save()
            R.rr(indent + 12 * S, iy, fragIconSz, fragIconSz, 3 * S); c.clip()
            const fw = fragImg.width, fh = fragImg.height
            const fScale = Math.max(fragIconSz / fw, fragIconSz / fh)
            c.drawImage(fragImg, indent + 12 * S + (fragIconSz - fw * fScale) / 2, iy + (fragIconSz - fh * fScale) / 2, fw * fScale, fh * fScale)
            c.restore()
            c.strokeStyle = 'rgba(200,170,80,0.5)'; c.lineWidth = 1 * S
            R.rr(indent + 12 * S, iy, fragIconSz, fragIconSz, 3 * S); c.stroke()
          }
          c.fillStyle = '#ffd700'; c.font = `${10*S}px "PingFang SC",sans-serif`
          c.textBaseline = 'middle'
          c.fillText(`${fragName} ×${r.count}`, indent + 12 * S + fragIconSz + 6 * S, iy + fragIconSz / 2)
          c.textBaseline = 'top'
          iy += fragIconSz + 4 * S
        } else {
          c.fillText(`  ${fragName} ×${r.count}`, indent + 12 * S, iy)
          iy += 13 * S
        }
      } else if (r.type === 'weapon') {
        c.fillStyle = 'rgba(255,230,150,0.8)'; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  法宝奖励`, indent + 12 * S, iy)
        iy += 13 * S
      } else if (r.type === 'exp') {
        c.fillStyle = 'rgba(255,230,150,0.8)'; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  修炼经验 +${r.amount}`, indent + 12 * S, iy)
        iy += 13 * S
      } else if (r.type === 'soulStone') {
        c.fillStyle = 'rgba(255,230,150,0.8)'; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  灵石 +${r.amount}`, indent + 12 * S, iy)
        iy += 13 * S
      }
    }
    iy += 2 * S
  }

  // 周回奖励（显示评价倍率范围）
  const rp = preview.repeat
  c.fillStyle = '#E8D5A3'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`碎片 ×${rp.fragments.min}~${rp.fragments.max}  |  经验 +${rp.exp.base}~${rp.exp.max}  |  灵石 +${rp.soulStone.base}~${rp.soulStone.max}`, indent + 6 * S, iy)
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
    const portraitPath = getEnemyPortraitPath(enemy.avatar)
    const avatarImg = portraitPath ? R.getImg(portraitPath) : null
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

    _rects.enemyRects.push({ waveIdx: enemy.waveIdx, enemyIdx: enemy.enemyIdx, rect: [ex, iy, enemySize, enemySize] })
    ex += enemySize + enemyGap
  }

  // ── 卡片内容结束 ──
  const cardContentBottom = cardTop + cardH

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
  const teamLabelY = cardContentBottom + 16 * S
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

  // ── 敌人详情悬浮弹窗 ──
  if (g._stageInfoEnemyDetail != null) {
    const eIdx = g._stageInfoEnemyDetail
    const flatEnemies = []
    stage.waves.forEach(w => w.enemies.forEach(e => flatEnemies.push(e)))
    if (eIdx < flatEnemies.length) {
      _drawEnemyDetailPopup(c, R, S, W, H, flatEnemies[eIdx])
    }
  }

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
    g.setScene('title')
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
    if (savedTeam.length < getEffectiveStageTeamMin(g.storage, stage)) {
      g._stageTeamSelected = savedTeam.slice()
      g._stageTeamFilter = 'all'
      g.setScene('stageTeam')
      return
    }
    const wCol = g.storage.weaponCollection || []
    if (wCol.length > 0 && !g.storage.equippedWeaponId) {
      g._stageTeamSelected = savedTeam.slice()
      g._stageTeamFilter = 'all'
      P.showGameToast('请先装备一件法宝后再开始战斗')
      g.setScene('stageTeam')
      return
    }
    if (g.storage.currentStamina < (stage.staminaCost ?? STAMINA_COST)) {
      const AdManager = require('../adManager')
      if (!AdManager.openStaminaRecoveryConfirm(g)) P.showGameToast('体力不足')
      return
    }
    if (stage.dailyLimit > 0 && !g.storage.canChallengeStage(g._selectedStageId, stage.dailyLimit)) {
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

/** 敌人详情悬浮弹窗（全屏半透明遮罩 + 居中面板） */
function _drawEnemyDetailPopup(c, R, S, W, H, enemy) {
  const eAttrColor = ATTR_COLOR[enemy.attr]
  const ac = eAttrColor ? eAttrColor.main : '#888'
  const pad = 16 * S

  // 技能列表
  const skillList = (enemy.skills || []).map(sk => ENEMY_SKILLS[sk]).filter(Boolean)
  const skillLineH = 16 * S

  // 动态计算面板高度
  const headerH = 14 * S + 54 * S + 4 * S
  const statsH = 18 * S
  const skillSectionH = skillList.length > 0 ? (18 * S + skillList.length * skillLineH + 6 * S) : 18 * S
  const weakH = 26 * S
  const footerH = 20 * S
  const ph = headerH + statsH + skillSectionH + weakH + footerH + pad
  const pw = W * 0.88
  const px = (W - pw) / 2
  const py = (H - ph) / 2

  // 半透明遮罩
  c.save()
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fillRect(0, 0, W, H)

  // 面板背景
  R.drawInfoPanel(px, py, pw, ph)

  // 头像
  const avatarSz = 50 * S
  const avatarX = px + pad
  const avatarY = py + 14 * S
  const avatarR = 6 * S
  c.fillStyle = 'rgba(0,0,0,0.08)'
  R.rr(avatarX, avatarY, avatarSz, avatarSz, avatarR); c.fill()
  const portraitPath = getEnemyPortraitPath(enemy.avatar)
  const avatarImg = portraitPath ? R.getImg(portraitPath) : null
  if (avatarImg && avatarImg.width > 0) {
    c.save()
    R.rr(avatarX + 1 * S, avatarY + 1 * S, avatarSz - 2 * S, avatarSz - 2 * S, avatarR - 1 * S); c.clip()
    c.drawImage(avatarImg, avatarX + 1 * S, avatarY + 1 * S, avatarSz - 2 * S, avatarSz - 2 * S)
    c.restore()
  }
  c.strokeStyle = ac; c.lineWidth = 2 * S
  R.rr(avatarX, avatarY, avatarSz, avatarSz, avatarR); c.stroke()

  // 名称 + 属性
  const textX = avatarX + avatarSz + 12 * S
  const textW = px + pw - pad - textX
  let dy = avatarY + 4 * S

  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#3D2B1F'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.fillText(enemy.name, textX, dy)
  c.fillStyle = ac; c.font = `${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${ATTR_NAME[enemy.attr] || '?'}属性`, px + pw - pad, dy + 2 * S)
  dy += 22 * S

  // 三维数值
  c.textAlign = 'left'
  c.fillStyle = '#5A4A3A'; c.font = `${11*S}px "PingFang SC",sans-serif`
  c.fillText(`生命 ${enemy.hp}`, textX, dy)
  c.fillText(`攻击 ${enemy.atk}`, textX + textW * 0.38, dy)
  c.fillText(`防御 ${enemy.def}`, textX + textW * 0.72, dy)
  dy = avatarY + avatarSz + 10 * S

  // 分隔线
  c.strokeStyle = 'rgba(160,120,40,0.2)'; c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(px + pad, dy); c.lineTo(px + pw - pad, dy)
  c.stroke()
  dy += 8 * S

  // 技能列表
  const fullTextX = px + pad
  if (skillList.length > 0) {
    c.fillStyle = '#7A5C30'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText('技能列表', fullTextX, dy)
    dy += 18 * S
    for (const sk of skillList) {
      c.fillStyle = '#B8860B'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      const dotText = `· ${sk.name}`
      c.fillText(dotText, fullTextX + 4 * S, dy)
      const nameW = c.measureText(dotText).width
      c.fillStyle = '#6A5A4A'; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(`  ${sk.desc}`, fullTextX + 4 * S + nameW, dy + 1 * S)
      dy += skillLineH
    }
    dy += 6 * S
  } else {
    c.fillStyle = '#AAA090'; c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText('无特殊技能', fullTextX, dy)
    dy += 18 * S
  }

  // 弱点与克制
  const weakAttr = COUNTER_BY[enemy.attr]
  const resistAttr = COUNTER_MAP[enemy.attr]
  const orbR = 7 * S
  const tagH = 22 * S
  const tagFont = `bold ${10*S}px "PingFang SC",sans-serif`

  if (weakAttr) {
    const wColor = ATTR_COLOR[weakAttr] ? ATTR_COLOR[weakAttr].main : '#fff'
    c.fillStyle = wColor + '30'
    R.rr(fullTextX, dy - 2 * S, 84 * S, tagH, tagH / 2); c.fill()
    c.strokeStyle = wColor + '80'; c.lineWidth = 1 * S
    R.rr(fullTextX, dy - 2 * S, 84 * S, tagH, tagH / 2); c.stroke()
    c.fillStyle = '#5A4A3A'; c.font = tagFont
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText('弱点', fullTextX + 6 * S, dy + tagH / 2 - 2 * S)
    R.drawBead(fullTextX + 6 * S + c.measureText('弱点').width + orbR + 4 * S, dy + tagH / 2 - 2 * S, orbR, weakAttr, 0)
    c.fillStyle = wColor; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('×2.5', fullTextX + 6 * S + c.measureText('弱点').width + orbR * 2 + 8 * S, dy + tagH / 2 - 2 * S)
  }

  if (resistAttr) {
    const rColor = ATTR_COLOR[resistAttr] ? ATTR_COLOR[resistAttr].main : '#888'
    const rx = fullTextX + 96 * S
    c.fillStyle = rColor + '20'
    R.rr(rx, dy - 2 * S, 84 * S, tagH, tagH / 2); c.fill()
    c.strokeStyle = rColor + '50'; c.lineWidth = 1 * S
    R.rr(rx, dy - 2 * S, 84 * S, tagH, tagH / 2); c.stroke()
    c.fillStyle = '#AAA090'; c.font = tagFont
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText('抵抗', rx + 6 * S, dy + tagH / 2 - 2 * S)
    R.drawBead(rx + 6 * S + c.measureText('抵抗').width + orbR + 4 * S, dy + tagH / 2 - 2 * S, orbR, resistAttr, 0)
    c.fillStyle = '#AAA090'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('×0.5', rx + 6 * S + c.measureText('抵抗').width + orbR * 2 + 8 * S, dy + tagH / 2 - 2 * S)
  }

  // 底部提示
  c.fillStyle = '#B0A090'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击任意处关闭', px + pw / 2, py + ph - 6 * S)

  c.restore()
}

module.exports = { rStageInfo, tStageInfo }
