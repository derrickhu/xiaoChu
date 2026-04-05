/**
 * 首页渲染 — 场景式大厅 v3
 * 布局：顶栏 / 场景区（背景+插画+Logo）/ 灵宠展示 / 开始按钮区 / 模式切换浮钮 / 7标签底部导航
 */
const V = require('./env')
const P = require('../platform')

const { BAR_ITEMS, getLayout, drawBottomBar } = require('./bottomBar')
const { drawPanel } = require('./uiComponents')
const { getBrowsableStages, getStageBossAvatar, getStageBossName, RATING_ORDER, getEliteLockReason } = require('../data/stages')
const { STAGE_CARD: SC, TITLE_LOGO, TITLE_HOME } = require('../data/constants')
const { MAX_LEVEL, expToNextLevel, currentRealm } = require('../data/cultivationConfig')
const guideMgr = require('../engine/guideManager')

const MODE_CFG = {
  tower: { name: '通天塔', img: 'assets/ui/tower_rogue.png', icon: '⚔', switchKey: 'stage' },
  stage: { name: '灵兽秘境', img: 'assets/ui/gate_stage.png', icon: '🏯', switchKey: 'tower' },
}

// ===== ZONE 1: 顶栏（游戏标题Logo，位于状态栏下方）=====
function drawTopBar(g) {
  const { ctx, R, W, S, safeTop } = V
  const logoImg = R.getImg('assets/ui/title_logo.png')
  if (logoImg && logoImg.width > 0) {
    const statusBarBottom = safeTop + 48 * S + 48 * S
    const logoH = TITLE_LOGO.heightPt * S
    const logoW = logoH * (logoImg.width / logoImg.height)
    const logoX = (W - logoW) / 2
    const logoY = statusBarBottom + TITLE_LOGO.gapBelowStatusPt * S
    ctx.save()
    ctx.globalAlpha = 1
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH)
    ctx.restore()
  }
}

// ===== 秘境内嵌选关：获取当前展示的关卡数据 =====
function _ensureBrowsableList(g) {
  // 每帧重建（15关遍历，开销可忽略），确保通关后列表立即更新
  const diff = g._stageDifficulty || 'normal'
  g._browsableStages = getBrowsableStages(g.storage.stageClearRecord, diff)
  if (g._selectedStageIdx >= g._browsableStages.length) {
    g._selectedStageIdx = Math.max(0, g._browsableStages.length - 1)
  }
  return g._browsableStages
}

function _getDisplayStage(g) {
  const list = _ensureBrowsableList(g)

  // 首次进入：自动定位到当前进度（最新解锁且未通关的关卡）
  if (!g._stageIdxInitialized) {
    g._stageIdxInitialized = true
    let bestIdx = 0
    for (let i = 0; i < list.length; i++) {
      if (list[i].unlocked && !g.storage.isStageCleared(list[i].stage.id)) {
        bestIdx = i; break
      }
      if (list[i].unlocked) bestIdx = i
    }
    g._selectedStageIdx = bestIdx
  }

  const entry = list[g._selectedStageIdx]
  return entry || null
}

// ===== ZONE 2: 场景区（背景 + 插画 + Logo）=====
function drawSceneArea(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()

  R.drawHomeBg(g.af)

  const mode = g.titleMode || 'tower'

  if (mode === 'stage') {
    _drawStageSceneArea(g, ctx, R, W, S, L)
    return
  }

  g._stageOverrideBtnY = null

  const imgPath = MODE_CFG[mode].img
  const towerImg = R.getImg(imgPath)
  const sceneH = L.petRowY - L.topBarBottom

  if (towerImg && towerImg.width > 0) {
    const targetH = sceneH * TITLE_HOME.towerImgHeightSceneFrac
    const ratioW = towerImg.width / towerImg.height
    const imgW = Math.min(targetH * ratioW, W * TITLE_HOME.towerImgMaxScreenWidthFrac)
    const imgH = imgW / ratioW
    const imgX = (W - imgW) / 2
    const imgY = L.petRowY - imgH + 14 * S - TITLE_HOME.towerImgLiftPt * S
    ctx.drawImage(towerImg, imgX, imgY, imgW, imgH)
  } else {
    ctx.save()
    ctx.font = `${80*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.globalAlpha = 0.6
    ctx.fillText('🏯', W / 2, L.topBarBottom + sceneH * 0.45)
    ctx.globalAlpha = 1
    ctx.restore()
  }
}

// ===== 秘境场景区：精致卡片选关 =====
function _drawStageSceneArea(g, ctx, R, W, S, L) {
  if (!g._stageDifficulty) g._stageDifficulty = 'normal'
  const isElite = g._stageDifficulty === 'elite'
  const entry = _getDisplayStage(g)
  const sceneTop = L.topBarBottom
  const cx = W / 2

  // ── 仙门图尺寸（门优先，按钮跟着门走）──
  const gateImg = R.getImg('assets/ui/gate_stage.png')
  const gateNatW = (gateImg && gateImg.width > 0) ? gateImg.width : 512
  const gateNatH = (gateImg && gateImg.height > 0) ? gateImg.height : 685
  const gateAspect = gateNatH / gateNatW

  const portalRelCx = 0.50
  const portalRelCy = 0.52
  const portalRelR = 0.245

  const tabH = 24 * S
  const tabGap = 4 * S
  const titleBlockH = 30 * S
  const titleGateGap = 2 * S
  const gateStarGap = 6 * S
  const starH = 18 * S
  const marginV = SC.marginV * S
  const minTop = sceneTop + marginV

  const condAboveBtn = (SC.condAboveStartBtnPt != null ? SC.condAboveStartBtnPt : 10) * S
  const condPanelH = (SC.condPanelPt != null ? SC.condPanelPt : 38) * S
  const startBtnH = L.startBtnH
  const progressUnderBtnGap = 10 * S
  const progressTextAllowance = 16 * S
  const aboveBottomBarPad = 10 * S

  // 可用高度：底栏顶线以下要留给「星级条件条 + 开始按钮 + 已通关文案 + 间距」，避免最底行被裁切
  const bottomLimit = L.bottomBarY || (V.H - 72 * S)
  const belowGateFixed =
    gateStarGap + starH + 4 * S + condPanelH + condAboveBtn + startBtnH +
    progressUnderBtnGap + progressTextAllowance + aboveBottomBarPad
  const aboveGateFixed = tabH + tabGap + titleBlockH + titleGateGap
  const maxGateH = Math.max(96 * S, bottomLimit - minTop - aboveGateFixed - belowGateFixed)

  const gateWDesired = W * 0.72
  const gateHDesired = gateWDesired * gateAspect

  let gateW, gateH
  if (gateHDesired > maxGateH) {
    gateH = maxGateH
    gateW = gateH / gateAspect
  } else {
    gateW = gateWDesired
    gateH = gateHDesired
  }

  // 从顶部向下排列：Tab → 标题区 → 门 → 星级
  const tabY = minTop
  const titleTopY = tabY + tabH + tabGap
  const gateX = cx - gateW / 2
  const gateY = titleTopY + titleBlockH + titleGateGap
  const starBaseY = gateY + gateH + gateStarGap

  const stageCondY = starBaseY + starH + 4 * S
  const stageBtnY = stageCondY + condPanelH + condAboveBtn
  g._stageOverrideBtnY = stageBtnY

  const portalCx = gateX + gateW * portalRelCx
  const portalCy = gateY + gateH * portalRelCy
  const portalR = gateW * portalRelR

  ctx.save()

  // ══════ 难度 Tab ══════
  {
    const tabW = W * 0.36
    const tabBtnW = tabW / 2
    const tabX = cx - tabW / 2
    const tabR = tabH / 2

    const nSel = !isElite
    ctx.save()
    ctx.fillStyle = nSel ? 'rgba(160, 120, 50, 0.85)' : 'rgba(200, 185, 150, 0.25)'
    R.rr(tabX, tabY, tabBtnW - 2 * S, tabH, tabR); ctx.fill()
    if (nSel) { ctx.strokeStyle = 'rgba(195, 160, 60, 0.5)'; ctx.lineWidth = 1 * S; R.rr(tabX, tabY, tabBtnW - 2 * S, tabH, tabR); ctx.stroke() }
    ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = nSel ? '#fff' : 'rgba(120, 100, 70, 0.6)'
    ctx.fillText('普通', tabX + (tabBtnW - 2 * S) / 2, tabY + tabH / 2)
    ctx.restore()
    g._diffTabNormalRect = [tabX, tabY, tabBtnW - 2 * S, tabH]

    const eX = tabX + tabBtnW + 2 * S
    ctx.save()
    ctx.fillStyle = isElite ? 'rgba(180, 120, 20, 0.9)' : 'rgba(200, 185, 150, 0.25)'
    R.rr(eX, tabY, tabBtnW - 2 * S, tabH, tabR); ctx.fill()
    if (isElite) { ctx.strokeStyle = 'rgba(218, 165, 32, 0.6)'; ctx.lineWidth = 1 * S; R.rr(eX, tabY, tabBtnW - 2 * S, tabH, tabR); ctx.stroke() }
    ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = isElite ? '#fff8e0' : 'rgba(120, 100, 70, 0.6)'
    ctx.fillText('精英', eX + (tabBtnW - 2 * S) / 2, tabY + tabH / 2)
    ctx.restore()
    g._diffTabEliteRect = [eX, tabY, tabBtnW - 2 * S, tabH]
  }

  if (!entry) {
    ctx.font = `${14 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(120, 100, 70, 0.7)'
    ctx.fillText('🔒 需普通3星通关解锁', cx, gateY + gateH / 2)
    ctx.restore()
    g._stageGateRect = null; g._stageArrowLeftRect = null; g._stageArrowRightRect = null
    return
  }

  const { stage, unlocked } = entry
  const swipeDx = g._stageSwipeDeltaX || 0

  // ══════ 仙门主体 ══════
  if (gateImg && gateImg.width > 0) {
    ctx.drawImage(gateImg, gateX, gateY, gateW, gateH)
  }

  // ══════ 关卡标题（Tab 和门之间的独立区域）══════
  {
    const stageLabel = `${stage.chapter}-${stage.order}`
    const mainY = titleTopY + 10 * S
    const subY = titleTopY + 24 * S

    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `bold ${13 * S}px "PingFang SC",sans-serif`
    ctx.strokeStyle = 'rgba(255, 245, 215, 0.7)'; ctx.lineWidth = 3 * S; ctx.lineJoin = 'round'
    ctx.strokeText(stageLabel, cx, mainY)
    ctx.fillStyle = '#4a2205'
    ctx.fillText(stageLabel, cx, mainY)
    ctx.restore()

    let nameFontPx = 10 * S
    ctx.font = `${nameFontPx}px "PingFang SC",sans-serif`
    const maxNameW = gateW * 0.6
    while (ctx.measureText(stage.name).width > maxNameW && nameFontPx > 8 * S) {
      nameFontPx -= S; ctx.font = `${nameFontPx}px "PingFang SC",sans-serif`
    }
    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(80, 50, 15, 0.6)'
    ctx.fillText(stage.name, cx, subY)
    ctx.restore()
  }

  // ── 门内灵力光效（脉冲动画）──
  const af = g.af || 0
  const pulse = 0.6 + 0.4 * Math.sin(af * 0.04)
  ctx.save()
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, portalR * 1.15, 0, Math.PI * 2)
  ctx.clip()

  const outerGlow = ctx.createRadialGradient(portalCx, portalCy, portalR * 0.1, portalCx, portalCy, portalR * 1.15)
  outerGlow.addColorStop(0, `rgba(200, 220, 255, ${0.12 * pulse})`)
  outerGlow.addColorStop(0.5, `rgba(180, 200, 240, ${0.06 * pulse})`)
  outerGlow.addColorStop(1, 'rgba(160, 180, 220, 0)')
  ctx.fillStyle = outerGlow
  ctx.fillRect(portalCx - portalR * 1.2, portalCy - portalR * 1.2, portalR * 2.4, portalR * 2.4)
  ctx.restore()

  // ── 怪物头像（圆形嵌入门中央）──
  const bossAvatarPath = getStageBossAvatar(stage)
  const bossImg = bossAvatarPath ? R.getImg(bossAvatarPath) : null
  const avatarClipR = portalR

  ctx.save()
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, avatarClipR, 0, Math.PI * 2)
  ctx.clip()

  if (bossImg && bossImg.width > 0) {
    if (!unlocked) ctx.globalAlpha = 0.4
    const sw = bossImg.width, sh = bossImg.height
    // 对角线法：整个矩形图片内接于圆，四角不被裁切
    const diag = Math.sqrt(sw * sw + sh * sh)
    const sc = diag > 0 ? (2 * avatarClipR) / diag : 0
    const dw = sw * sc, dh = sh * sc
    ctx.drawImage(bossImg, portalCx - dw / 2 + swipeDx, portalCy - dh / 2, dw, dh)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = unlocked ? 'rgba(110,75,40,0.55)' : 'rgba(80,80,80,0.4)'
    ctx.font = `bold ${16 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(getStageBossName(stage) || stage.name, portalCx + swipeDx, portalCy)
  }

  if (!unlocked) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.fillRect(portalCx - avatarClipR, portalCy - avatarClipR, avatarClipR * 2, avatarClipR * 2)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `${28 * S}px sans-serif`
    ctx.fillText('🔒', portalCx, portalCy - 6 * S)
    const reason = isElite ? getEliteLockReason(stage.id, g.storage.stageClearRecord) : null
    if (reason) {
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`; ctx.fillStyle = 'rgba(255,220,120,0.9)'
      ctx.fillText(reason, portalCx, portalCy + 14 * S)
    }
  }
  ctx.restore()

  // 不再画金色圆环，直接使用门图自带的灵阵边框

  // ── 已获星级展示（门下方）──
  if (unlocked && stage.rating) {
    const bestRt = g.storage.getStageBestRating(stage.id)
    const bestSt = bestRt ? (RATING_ORDER[bestRt] || 0) : 0
    const starFontSz = 16 * S
    ctx.save()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `${starFontSz}px sans-serif`
    let starStr = ''
    for (let si = 1; si <= 3; si++) starStr += si <= bestSt ? '★' : '☆'
    ctx.shadowColor = bestSt > 0 ? 'rgba(220, 170, 30, 0.45)' : 'transparent'
    ctx.shadowBlur = 6 * S
    ctx.fillStyle = bestSt > 0 ? '#c89520' : 'rgba(160, 140, 100, 0.4)'
    ctx.fillText(starStr, cx, starBaseY)
    ctx.restore()
  }

  // ── 左右切换（门两侧：暖金渐变胶囊 + 矢量尖角，不用 ◀▶ 字符避免移动端叠层感）──
  const list = _ensureBrowsableList(g)
  const arrowCY = portalCy
  const navW = TITLE_HOME.stageNavBtnWidthPt * S
  const navH = TITLE_HOME.stageNavBtnHeightPt * S
  const navR = TITLE_HOME.stageNavBtnRadiusPt * S
  const chevTip = TITLE_HOME.stageNavChevronPt * S

  /** @param {number} dir -1 左  1 右 */
  function _drawStageNavBtn(ax, ay, dir) {
    ctx.save()
    const cx = ax + navW / 2
    const cy = ay + navH / 2
    const bg = ctx.createLinearGradient(ax, ay, ax, ay + navH)
    bg.addColorStop(0, 'rgba(158, 120, 72, 0.58)')
    bg.addColorStop(0.5, 'rgba(92, 68, 40, 0.52)')
    bg.addColorStop(1, 'rgba(72, 50, 28, 0.56)')
    ctx.fillStyle = bg
    R.rr(ax, ay, navW, navH, navR)
    ctx.fill()
    ctx.strokeStyle = 'rgba(240, 210, 140, 0.42)'
    ctx.lineWidth = 1 * S
    R.rr(ax, ay, navW, navH, navR)
    ctx.stroke()

    ctx.beginPath()
    if (dir < 0) {
      ctx.moveTo(cx + chevTip * 0.15, cy - chevTip * 0.92)
      ctx.lineTo(cx - chevTip * 0.82, cy)
      ctx.lineTo(cx + chevTip * 0.15, cy + chevTip * 0.92)
    } else {
      ctx.moveTo(cx - chevTip * 0.15, cy - chevTip * 0.92)
      ctx.lineTo(cx + chevTip * 0.82, cy)
      ctx.lineTo(cx - chevTip * 0.15, cy + chevTip * 0.92)
    }
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 248, 235, 0.96)'
    ctx.fill()
    ctx.restore()
  }

  if (g._selectedStageIdx > 0) {
    const lx = Math.max(2 * S, gateX - navW - 4 * S)
    const ly = arrowCY - navH / 2
    _drawStageNavBtn(lx, ly, -1)
    g._stageArrowLeftRect = [lx, ly, navW, navH]
  } else { g._stageArrowLeftRect = null }

  if (g._selectedStageIdx < list.length - 1) {
    const rx = Math.min(W - navW - 2 * S, gateX + gateW + 4 * S)
    const ry = arrowCY - navH / 2
    _drawStageNavBtn(rx, ry, 1)
    g._stageArrowRightRect = [rx, ry, navW, navH]
  } else { g._stageArrowRightRect = null }

  g._stageGateRect = [gateX, gateY, gateW, gateH + gateStarGap + starH]
  ctx.restore()
}

// ===== ZONE 3: 状态栏（头像 + 灵石 + 体力，同一排 + 经验条）=====
function drawAvatarWidget(g) {
  const { ctx, R, W, S, safeTop } = V
  const cult = g.storage.cultivation
  const level = (cult && cult.level) || 0

  const selectedId = g.storage.selectedAvatar || 'boy1'
  const CHAR_MAP = {
    boy1:  'assets/hero/char_boy1.png',
    girl1: 'assets/hero/char_girl1.png',
    boy2:  'assets/hero/char_boy2.png',
    girl2: 'assets/hero/char_girl2.png',
    boy3:  'assets/hero/char_boy3.png',
    girl3: 'assets/hero/char_girl3.png',
  }
  const sitPath = CHAR_MAP[selectedId] || CHAR_MAP.boy1

  const rowY = safeTop + 48 * S
  const iconSz = 48 * S
  const iconX = 10 * S
  const iconCX = iconX + iconSz / 2
  const iconCY = rowY + iconSz / 2

  ctx.save()

  // ── 头像圆形裁剪 ──
  const img = R.getImg(sitPath)
  if (img && img.width > 0) {
    ctx.save()
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconSz / 2, 0, Math.PI * 2); ctx.clip()
    const cropSz = Math.min(img.width, img.height * 0.60)
    const srcX = (img.width - cropSz) / 2
    ctx.drawImage(img, srcX, 0, cropSz, cropSz, iconX, rowY, iconSz, iconSz)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(180,150,80,0.5)'
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconSz / 2, 0, Math.PI * 2); ctx.fill()
  }

  // 头像框
  const frameImg = R.getImg('assets/ui/frame_avatar.png')
  if (frameImg && frameImg.width > 0) {
    const frameSz = iconSz * 1.22
    ctx.drawImage(frameImg, iconCX - frameSz / 2, iconCY - frameSz / 2, frameSz, frameSz)
  } else {
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconSz / 2, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220,180,60,0.9)'; ctx.lineWidth = 2 * S; ctx.stroke()
  }

  // 等级角标（头像左上方）
  const lvText = `Lv.${level}`
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lvTxtW = ctx.measureText(lvText).width
  const lvPadX = 5 * S
  const lvCapW = lvTxtW + lvPadX * 2
  const lvCapH = 16 * S
  const lvCapR = lvCapH / 2
  const lvCapCX = iconCX + iconSz * 0.22
  const lvCapCY = iconCY + iconSz * 0.42
  const lvCapX = lvCapCX - lvCapW / 2
  const lvCapY = lvCapCY - lvCapH / 2

  ctx.beginPath()
  R.rr(lvCapX, lvCapY, lvCapW, lvCapH, lvCapR)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill()
  ctx.strokeStyle = 'rgba(220,185,60,0.5)'; ctx.lineWidth = 0.8 * S; ctx.stroke()
  ctx.fillStyle = '#fff8cc'
  ctx.fillText(lvText, lvCapCX, lvCapCY)

  // ── 右侧区域起点 ──
  const rightX = iconX + iconSz + 8 * S

  // ── 灵石 + 体力胶囊（上排）──
  const pillH = 22 * S
  const pillR = pillH / 2
  const pillIconSz = 18 * S
  const pillGap = 6 * S
  const pillCY = rowY + iconSz * 0.32

  function _drawPill(px, text, iconPath) {
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    const tw = ctx.measureText(text).width
    const innerPad = 4 * S
    const pillW = pillIconSz + innerPad + tw + 8 * S
    const py = pillCY - pillH / 2

    ctx.save()
    ctx.beginPath()
    R.rr(px, py, pillW, pillH, pillR)
    ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.fill()
    ctx.strokeStyle = 'rgba(200,180,120,0.25)'; ctx.lineWidth = 0.6 * S; ctx.stroke()

    const ic = R.getImg(iconPath)
    if (ic && ic.width > 0) {
      ctx.drawImage(ic, px + 2 * S, pillCY - pillIconSz / 2, pillIconSz, pillIconSz)
    }
    ctx.fillStyle = '#fff'
    ctx.fillText(text, px + pillIconSz + innerPad, pillCY)
    ctx.restore()

    return pillW
  }

  const soulStone = g.storage.soulStone || 0
  const ssPillW = _drawPill(rightX, String(soulStone), 'assets/ui/icon_soul_stone.png')

  const stamina = g.storage.currentStamina
  const maxSt = g.storage.maxStamina
  const stText = `${stamina}/${maxSt}`
  const stPillW = _drawPill(rightX + ssPillW + pillGap, stText, 'assets/ui/icon_stamina.png')

  const awakenStone = g.storage.awakenStone || 0
  const asPillW = _drawPill(rightX + ssPillW + pillGap + stPillW + pillGap, String(awakenStone), 'assets/ui/icon_awaken_stone.png')

  // ── 经验条（灵石/体力/觉醒石下方）──
  const expBarY = pillCY + pillH / 2 + 4 * S
  const expBarH = 7 * S
  const expBarX = rightX
  const expBarW = ssPillW + pillGap + stPillW + pillGap + asPillW

  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  R.rr(expBarX, expBarY, expBarW, expBarH, expBarH / 2); ctx.fill()

  if (level < MAX_LEVEL) {
    const needed = expToNextLevel(level)
    const curExp = (cult && cult.exp) || 0
    const pct = Math.min(curExp / needed, 1)
    if (pct > 0) {
      const fillW = Math.max(expBarH, expBarW * pct)
      const barGrad = ctx.createLinearGradient(expBarX, expBarY, expBarX + fillW, expBarY)
      barGrad.addColorStop(0, '#D4A843')
      barGrad.addColorStop(1, '#F0C860')
      ctx.fillStyle = barGrad
      R.rr(expBarX, expBarY, fillW, expBarH, expBarH / 2); ctx.fill()
    }
    ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${8*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${curExp}/${needed}`, expBarX + expBarW - 2 * S, expBarY + expBarH / 2)
  } else {
    const barGrad = ctx.createLinearGradient(expBarX, expBarY, expBarX + expBarW, expBarY)
    barGrad.addColorStop(0, '#D4A843')
    barGrad.addColorStop(1, '#F0C860')
    ctx.fillStyle = barGrad
    R.rr(expBarX, expBarY, expBarW, expBarH, expBarH / 2); ctx.fill()
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `${8*S}px "PingFang SC",sans-serif`
    ctx.fillText('MAX', expBarX + expBarW / 2, expBarY + expBarH / 2)
  }

  ctx.restore()
}

// drawStaminaBar 已合并进 drawAvatarWidget
function drawStaminaBar(_g) { }

// ===== ZONE 4: 开始按钮区 =====
function drawStartBtn(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()
  const mode = g.titleMode || 'tower'

  ctx.save()

  if (mode === 'tower') {
    const clusterDy = TITLE_HOME.towerStartClusterDownPt * S
    const btnW = W * 0.60
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = L.startBtnY + clusterDy

    // 使用 btn_start.png 资源，fallback 到渐变色
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (btnImg && btnImg.width > 0) {
      ctx.drawImage(btnImg, btnX, btnY, btnW, btnH)
    } else {
      const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
      grad.addColorStop(0, '#f5d98a')
      grad.addColorStop(0.5, '#d4a84b')
      grad.addColorStop(1, '#b8862d')
      ctx.fillStyle = grad
      R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); ctx.fill()
    }

    // 按钮文字叠在图片上
    const hasSave = g.storage.hasSavedRun()
    ctx.fillStyle = '#5a2d0c'
    ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(hasSave ? '继续挑战' : '开始挑战', btnX + btnW / 2, btnY + btnH / 2)

    g._startBtnRect = [btnX, btnY, btnW, btnH]

    // 每日剩余次数
    const { TOWER_DAILY } = require('../data/economyConfig')
    const usedRuns = g.storage.getTowerDailyRuns()
    const usedAdRuns = g.storage.getTowerDailyAdRuns()
    const freeLeft = Math.max(0, TOWER_DAILY.freeRuns - usedRuns)
    const adLeft = Math.max(0, TOWER_DAILY.adExtraRuns - usedAdRuns)
    const canRun = g.storage.canStartTowerRun()

    const dailyText = freeLeft > 0
      ? `今日 ${usedRuns}/${TOWER_DAILY.freeRuns}`
      : adLeft > 0
        ? `免费次数已用完 · 看广告+1次(${adLeft})`
        : '今日次数已用完 · 明日刷新'
    ctx.fillStyle = canRun ? 'rgba(80,50,20,0.7)' : 'rgba(180,60,40,0.8)'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(dailyText, W / 2, btnY - 10 * S)

    // 进度文字
    let progressText = ''
    if (hasSave) {
      const saved = g.storage.loadRunState()
      progressText = `继续第 ${saved.floor} 层  ·  历史最高 ${g.storage.bestFloor} 层`
    } else {
      const best = g.storage.bestFloor
      progressText = best > 0 ? `历史最高第 ${best} 层` : '开始你的第一次冒险'
    }
    ctx.fillStyle = 'rgba(80,50,20,0.7)'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(progressText, W / 2, L.progressY + L.progressH / 2 + clusterDy)
  } else {
    // 灵兽秘境模式 — 内嵌选关
    const entry = _getDisplayStage(g)
    const stage = entry ? entry.stage : null
    const stageUnlocked = entry ? entry.unlocked : false

    const btnW = W * 0.60
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = g._stageOverrideBtnY || L.startBtnY

    // 按钮底图
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (!stageUnlocked) ctx.globalAlpha = 0.5
    if (btnImg && btnImg.width > 0) {
      ctx.drawImage(btnImg, btnX, btnY, btnW, btnH)
    } else {
      const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
      grad.addColorStop(0, '#f5d98a'); grad.addColorStop(0.5, '#d4a84b'); grad.addColorStop(1, '#b8862d')
      ctx.fillStyle = grad
      R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); ctx.fill()
    }
    ctx.globalAlpha = 1

    // 按钮文字
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    if (!stageUnlocked) {
      ctx.fillStyle = '#666'
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.fillText('未解锁', btnX + btnW / 2, btnY + btnH / 2)
    } else {
      ctx.fillStyle = '#5a2d0c'
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      const cost = stage ? stage.staminaCost : 0
      if (cost > 0) {
        // "开始游戏" + 体力图标 + 数字
        const text = '开始游戏'
        const textW = ctx.measureText(text).width
        const iconSz = 16 * S
        const gap = 6 * S
        const totalW = textW + gap + iconSz + ctx.measureText(String(cost)).width * 0.9
        const startX = btnX + btnW / 2 - totalW / 2
        ctx.textAlign = 'left'
        ctx.fillText(text, startX, btnY + btnH / 2)

        // 体力图标
        const stIcon = R.getImg('assets/ui/icon_stamina.png')
        const iconX = startX + textW + gap
        const iconY = btnY + btnH / 2 - iconSz / 2
        if (stIcon && stIcon.width > 0) {
          ctx.drawImage(stIcon, iconX, iconY, iconSz, iconSz)
        } else {
          ctx.fillStyle = '#3aaeff'
          ctx.font = `${12*S}px sans-serif`
          ctx.fillText('⚡', iconX, btnY + btnH / 2)
        }

        // 体力数字
        const hasEnough = g.storage.currentStamina >= cost
        ctx.fillStyle = hasEnough ? '#5a2d0c' : '#c0392b'
        ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
        ctx.fillText(String(cost), iconX + iconSz + 2 * S, btnY + btnH / 2)
      } else {
        ctx.textAlign = 'center'
        ctx.fillText('开始游戏', btnX + btnW / 2, btnY + btnH / 2)
      }
    }

    g._startBtnRect = [btnX, btnY, btnW, btnH]

    // 新手引导激活时：金色脉冲呼吸光晕
    const curGuide = guideMgr.getCurrentId()
    if (curGuide === 'newbie_stage_start' || curGuide === 'newbie_continue_1_2' || curGuide === 'newbie_continue_1_3') {
      const pulse = 0.3 + 0.25 * Math.sin(g.af * 0.08)
      ctx.save()
      ctx.globalAlpha = pulse
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 20 * S
      R.rr(btnX - 4 * S, btnY - 4 * S, btnW + 8 * S, btnH + 8 * S, btnH * 0.4 + 4 * S)
      ctx.strokeStyle = '#ffd700'
      ctx.lineWidth = 3 * S
      ctx.stroke()
      ctx.restore()
    }

    // 按钮上方：通关条件星级说明
    if (stage && stage.rating && stageUnlocked) {
      const condW = W * 0.78
      const condH = (SC.condPanelPt != null ? SC.condPanelPt : 38) * S
      const condX = (W - condW) / 2
      const condY = btnY - condH - (SC.condAboveStartBtnPt != null ? SC.condAboveStartBtnPt : 10) * S

      ctx.save()
      ctx.fillStyle = 'rgba(50, 35, 10, 0.1)'
      R.rr(condX, condY, condW, condH, 8 * S)
      ctx.fill()
      ctx.strokeStyle = 'rgba(180, 150, 70, 0.15)'
      ctx.lineWidth = 0.8 * S
      R.rr(condX, condY, condW, condH, 8 * S)
      ctx.stroke()
      ctx.restore()

      const conds = [
        { stars: 1, label: '成功通关' },
        { stars: 2, label: `≤${stage.rating.a}回合` },
        { stars: 3, label: `≤${stage.rating.s}回合` },
      ]
      const bestRt = g.storage.getStageBestRating(stage.id)
      const bestSt = bestRt ? (RATING_ORDER[bestRt] || 0) : 0
      const colW2 = condW / 3

      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      for (let ci = 0; ci < 3; ci++) {
        const ccx = condX + colW2 * ci + colW2 / 2
        const done = bestSt >= conds[ci].stars

        ctx.font = `bold ${12 * S}px sans-serif`
        ctx.fillStyle = done ? '#b87a10' : 'rgba(100,80,45,0.5)'
        ctx.fillText('★'.repeat(conds[ci].stars) + '☆'.repeat(3 - conds[ci].stars), ccx, condY + 13 * S)

        ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
        ctx.fillStyle = done ? '#5a3a08' : 'rgba(70,50,20,0.55)'
        ctx.fillText(conds[ci].label, ccx, condY + 28 * S)
      }
    }

    // 进度文字（按钮下方）
    if (stage && stageUnlocked) {
      const clearCount = g.storage.getStageClearCount(stage.id)
      const progressText = clearCount > 0 ? `已通关 ${clearCount} 次` : '尚未通关'
      ctx.fillStyle = 'rgba(80,50,20,0.6)'
      ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(progressText, W / 2, btnY + btnH + 10 * S)
    }
  }

  ctx.restore()
}

// ===== ZONE 4b: 开始/继续确认弹窗 =====
function drawTitleStartDialog(g) {
  if (!g.showTitleStartDialog) return

  const { ctx, R, W, H, S } = V
  const hasSave = g.storage.hasSavedRun()

  // 遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, W, H)

  // 面板
  const pw = W * 0.82
  const ph = hasSave ? 190 * S : 150 * S
  const px = (W - pw) / 2
  const py = (H - ph) / 2

  const panelImg = R.getImg('assets/ui/info_panel_bg.png')
  if (panelImg && panelImg.width > 0) {
    ctx.drawImage(panelImg, px, py, pw, ph)
  } else {
    const rad = 14 * S
    ctx.fillStyle = 'rgba(248,242,230,0.97)'
    R.rr(px, py, pw, ph, rad); ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5 * S
    R.rr(px, py, pw, ph, rad); ctx.stroke()
  }

  ctx.textAlign = 'center'

  if (hasSave) {
    const saved = g.storage.loadRunState()

    // 标题
    ctx.fillStyle = '#6B5014'
    ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('通天塔', px + pw * 0.5, py + 30 * S)

    // 进度信息
    ctx.fillStyle = '#8a6a20'
    ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`进度：第 ${saved.floor} 层`, px + pw * 0.5, py + 58 * S)
    ctx.fillStyle = '#7B7060'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(`历史最高第 ${g.storage.bestFloor} 层`, px + pw * 0.5, py + 78 * S)

    // 红字提醒（将原二次确认提示并入本弹窗）
    ctx.fillStyle = '#C0392B'
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('重新挑战将清空当前进度记录', px + pw * 0.5, py + 98 * S)

    // 按钮：左重新挑战，右继续挑战
    const btnW = pw * 0.36, btnH = 34 * S, gap = 12 * S
    const btn1X = px + pw * 0.5 - btnW - gap * 0.5
    const btn2X = px + pw * 0.5 + gap * 0.5
    const btnY = py + 122 * S

    R.drawDialogBtn(btn1X, btnY, btnW, btnH, '重新挑战', 'cancel')
    g._dialogStartRect = [btn1X, btnY, btnW, btnH]

    R.drawDialogBtn(btn2X, btnY, btnW, btnH, '继续挑战', 'confirm')
    g._dialogContinueRect = [btn2X, btnY, btnW, btnH]
    g._dialogCancelRect = null
  } else {
    // 无存档
    ctx.fillStyle = '#6B5014'
    ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('通天塔', px + pw * 0.5, py + 30 * S)

    ctx.fillStyle = '#7B7060'
    ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('踏入通天塔，开始你的修炼之旅', px + pw * 0.5, py + 64 * S)

    const btnW = pw * 0.36, btnH = 34 * S, gap = 12 * S
    const btn1X = px + pw * 0.5 - btnW - gap * 0.5
    const btn2X = px + pw * 0.5 + gap * 0.5
    const btnY = py + 90 * S

    R.drawDialogBtn(btn1X, btnY, btnW, btnH, '取消', 'cancel')
    g._dialogCancelRect = [btn1X, btnY, btnW, btnH]

    R.drawDialogBtn(btn2X, btnY, btnW, btnH, '开始挑战', 'confirm')
    g._dialogStartRect = [btn2X, btnY, btnW, btnH]
    g._dialogContinueRect = null
  }

  ctx.restore()
}

/** 模式切换垂直位置：与秘境「普通/精英」Tab 行居中对齐（两处模式共用同一高度带） */
function _modeSwitchBtnY(L, S, btnH) {
  const tabY = L.topBarBottom + SC.marginV * S
  const tabH = 24 * S
  return tabY + tabH / 2 - btnH / 2
}

/** 签到入口几何（drawDailyRewardBtn 使用） */
function _dailySignBtnGeometry(safeTop, S) {
  const padTop = 2 * S
  const iconSz = TITLE_HOME.dailySignIconPt * S
  const labelGap = 4 * S
  const labelH = TITLE_HOME.dailySignLabelPt * S
  const btnH = padTop + iconSz + labelGap + labelH + 4 * S
  const top = safeTop + TITLE_HOME.dailySignTopBelowSafePt * S
  return { top, btnH, bottom: top + btnH, padTop, iconSz, labelGap, labelH }
}

// ===== 左侧模式切换浮钮（与中央难度 Tab 同行对齐，贴左屏） =====
function drawModeSwitchBtn(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()
  const mode = g.titleMode || 'tower'
  const targetMode = MODE_CFG[mode].switchKey
  const targetCfg = MODE_CFG[targetMode]

  const iconSize = TITLE_HOME.modeSwitchIconPt * S
  const labelSize = TITLE_HOME.modeSwitchLabelPt * S
  const vGap = 2 * S
  const btnW = iconSize + TITLE_HOME.modeSwitchBtnExtraWPt * S
  const btnH = iconSize + vGap + labelSize + 5 * S

  const btnX = TITLE_HOME.modeSwitchLeftMarginPt * S
  const btnY = _modeSwitchBtnY(L, S, btnH)
  const icx = btnX + btnW / 2
  const icy = btnY + 3 * S + iconSize / 2

  ctx.save()

  // 半透明胶囊背景（左侧贴屏，右侧圆角）
  const bgR = btnW / 2
  ctx.beginPath()
  ctx.moveTo(btnX, btnY)
  ctx.lineTo(btnX + btnW - bgR, btnY)
  ctx.quadraticCurveTo(btnX + btnW, btnY, btnX + btnW, btnY + bgR)
  ctx.lineTo(btnX + btnW, btnY + btnH - bgR)
  ctx.quadraticCurveTo(btnX + btnW, btnY + btnH, btnX + btnW - bgR, btnY + btnH)
  ctx.lineTo(btnX, btnY + btnH)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,245,220,0.82)'; ctx.fill()
  ctx.strokeStyle = 'rgba(200,165,60,0.7)'; ctx.lineWidth = 1.5 * S; ctx.stroke()

  // 切换图标
  const btnImg = R.getImg('assets/ui/btn_mode_switch.png')
  if (btnImg && btnImg.width > 0) {
    const drawSz = iconSize * 0.62
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 3 * S; ctx.shadowOffsetY = 1.5 * S
    ctx.drawImage(btnImg, icx - drawSz / 2, icy - drawSz / 2, drawSz, drawSz)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(160,110,30,0.9)'
    ctx.font = `${iconSize * 0.5}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('⇆', icx, icy)
  }

  // 文字标签
  const labelY2 = icy + iconSize / 2 + vGap + labelSize * 0.5
  ctx.fillStyle = '#7a5520'
  ctx.strokeStyle = 'rgba(255,245,220,0.8)'
  ctx.lineWidth = 2 * S
  ctx.font = `bold ${labelSize}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeText(targetCfg.name, icx, labelY2)
  ctx.fillText(targetCfg.name, icx, labelY2)

  g._modeSwitchRect = [btnX, btnY, btnW, btnH]
  ctx.restore()
}

// ===== 右下角侧边栏复访入口（抖音专属） =====
function _isFromSidebar() {
  const info = GameGlobal.__launchInfo || {}
  return info.scene === '021036' && info.launch_from === 'homepage' && info.location === 'sidebar_card'
}

function drawSidebarBtn(g) {
  if (!P.isDouyin || !GameGlobal.__sidebarSupported) { g._sidebarBtnRect = null; return }

  const { ctx, R, W, S } = V
  const L = getLayout()

  const iconSize = L.modeSwitchH * 0.72
  const labelSize = 11 * S
  const vGap = 3 * S
  const btnH = iconSize + vGap + labelSize
  const btnW = iconSize
  const btnX = W - L.pad - btnW + 4 * S
  const btnY = L.modeSwitchY - 6 * S

  ctx.save()

  ctx.fillStyle = 'rgba(20,18,38,0.75)'
  R.rr(btnX, btnY, btnW, iconSize, 8 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(200,180,120,0.45)'; ctx.lineWidth = 1.5 * S
  R.rr(btnX, btnY, btnW, iconSize, 8 * S); ctx.stroke()

  const claimed = g.storage.sidebarRewardClaimedToday
  const fromSB = _isFromSidebar()
  const hasReward = fromSB && !claimed

  const icx = btnX + btnW / 2
  const icy = btnY + iconSize / 2
  ctx.font = `${iconSize * 0.44}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = hasReward ? 'rgba(255,80,80,0.95)' : 'rgba(255,210,80,0.92)'
  ctx.fillText(hasReward ? '🎁' : '📌', icx, icy)

  if (hasReward) {
    const dotR = 5 * S
    ctx.beginPath()
    ctx.arc(btnX + btnW - 2 * S, btnY + 2 * S, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#ff3333'
    ctx.fill()
  }

  const labelY = btnY + iconSize + vGap + labelSize * 0.5
  ctx.fillStyle = 'rgba(255,235,160,0.95)'
  ctx.strokeStyle = 'rgba(20,10,40,0.7)'
  ctx.lineWidth = 2.5 * S
  ctx.font = `bold ${labelSize}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeText('侧边栏', icx, labelY)
  ctx.fillText('侧边栏', icx, labelY)

  g._sidebarBtnRect = [btnX, btnY, btnW, btnH]
  ctx.restore()
}

// ===== 侧边栏复访引导弹窗 =====
function drawSidebarPanel(g) {
  if (!g.showSidebarPanel) return

  const { ctx, R, W, H, S } = V
  const fromSB = _isFromSidebar()
  const claimed = g.storage.sidebarRewardClaimedToday
  const canClaim = fromSB && !claimed

  ctx.save()

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)

  const pw = W * 0.78, ph = 200 * S
  const px = (W - pw) / 2, py = (H - ph) / 2 - 20 * S

  const bgGrad = ctx.createLinearGradient(px, py, px, py + ph)
  bgGrad.addColorStop(0, 'rgba(45,30,80,0.97)')
  bgGrad.addColorStop(1, 'rgba(25,15,50,0.97)')
  ctx.fillStyle = bgGrad
  R.rr(px, py, pw, ph, 14 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(220,185,110,0.6)'; ctx.lineWidth = 2 * S
  R.rr(px, py, pw, ph, 14 * S); ctx.stroke()

  ctx.fillStyle = '#ffe8a0'
  ctx.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('侧边栏复访奖励', W / 2, py + 28 * S)

  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `${12 * S}px "PingFang SC",sans-serif`

  if (canClaim) {
    ctx.fillText('你从侧边栏进入了游戏！', W / 2, py + 56 * S)
    ctx.fillStyle = '#ffcc44'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.fillText('🎁 奖励：体力 +30', W / 2, py + 84 * S)

    const btnW2 = pw * 0.55, btnH2 = 38 * S
    const btnX2 = (W - btnW2) / 2, btnY2 = py + ph - 56 * S
    R.drawDialogBtn(btnX2, btnY2, btnW2, btnH2, '领取奖励', 'confirm')
    g._sidebarClaimRect = [btnX2, btnY2, btnW2, btnH2]
    g._sidebarGoRect = null
  } else if (claimed) {
    ctx.fillText('今日奖励已领取，明天再来吧~', W / 2, py + 64 * S)
    ctx.fillStyle = '#aaa'
    ctx.font = `${11 * S}px "PingFang SC",sans-serif`
    ctx.fillText('每天从抖音首页侧边栏进入游戏', W / 2, py + 90 * S)
    ctx.fillText('即可领取体力奖励', W / 2, py + 108 * S)
    g._sidebarClaimRect = null
    g._sidebarGoRect = null
  } else {
    ctx.fillText('① 点击下方按钮前往侧边栏', W / 2, py + 54 * S)
    ctx.fillText('② 在侧边栏找到本游戏并点击进入', W / 2, py + 74 * S)
    ctx.fillText('③ 返回后即可领取体力奖励', W / 2, py + 94 * S)

    const btnW2 = pw * 0.55, btnH2 = 38 * S
    const btnX2 = (W - btnW2) / 2, btnY2 = py + ph - 56 * S
    R.drawDialogBtn(btnX2, btnY2, btnW2, btnH2, '去首页侧边栏', 'confirm')
    g._sidebarGoRect = [btnX2, btnY2, btnW2, btnH2]
    g._sidebarClaimRect = null
  }

  const closeSize = 28 * S
  const closeX = px + pw - closeSize - 4 * S, closeY = py + 4 * S
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `${18 * S}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✕', closeX + closeSize / 2, closeY + closeSize / 2)
  g._sidebarCloseRect = [closeX, closeY, closeSize, closeSize]

  ctx.restore()
}

// ===== 「更多」弹出面板 =====
function drawMorePanel(g) {
  if (!g.showMorePanel) return

  const { ctx, R, W, H, S } = V
  const L = getLayout()

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, W, H)

  const panelH = 244 * S + L.safeBottom
  const panelY = H - panelH
  const rad = 16 * S

  ctx.fillStyle = 'rgba(255,248,230,0.98)'
  ctx.beginPath()
  ctx.moveTo(0, panelY + rad)
  ctx.arcTo(0, panelY, rad, panelY, rad)
  ctx.lineTo(W - rad, panelY)
  ctx.arcTo(W, panelY, W, panelY + rad, rad)
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 1.5 * S
  ctx.stroke()

  ctx.fillStyle = '#8B6914'
  ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('更多', W / 2, panelY + 16 * S)

  const items = [
    { key: 'sfx',      label: '音效',     toggle: g.storage.settings.sfxOn },
    { key: 'bgm',      label: '背景音乐', toggle: g.storage.settings.bgmOn },
    { key: 'bgmVol',   label: '音乐音量', slider: true, value: g.storage.settings.bgmVolume != null ? g.storage.settings.bgmVolume : 50 },
    { key: 'feedback', label: '意见反馈', toggle: null },
  ]

  const itemH = 44 * S
  const listX = 24 * S
  const listW = W - 48 * S
  let itemY = panelY + 44 * S

  g._morePanelRects = {}
  g._morePanelY = panelY
  g._bgmVolSlider = null

  for (const item of items) {
    ctx.fillStyle = 'rgba(40,35,60,0.6)'
    R.rr(listX, itemY, listW, itemH - 4 * S, 8 * S); ctx.fill()

    ctx.fillStyle = '#e0d8c0'
    ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(item.label, listX + 12 * S, itemY + (itemH - 4 * S) / 2)

    if (item.slider) {
      // 音量滑条
      const sliderW = listW * 0.45
      const sliderX = listX + listW - sliderW - 12 * S
      const sliderY = itemY + (itemH - 4 * S) / 2
      const trackH = 4 * S
      const pct = item.value / 100

      // 轨道背景
      ctx.fillStyle = 'rgba(100,100,120,0.5)'
      R.rr(sliderX, sliderY - trackH / 2, sliderW, trackH, trackH / 2); ctx.fill()
      // 已填充部分
      const fillW = sliderW * pct
      if (fillW > 0) {
        ctx.fillStyle = 'rgba(77,204,77,0.8)'
        R.rr(sliderX, sliderY - trackH / 2, fillW, trackH, trackH / 2); ctx.fill()
      }
      // 滑块圆点
      const knobR = 8 * S
      const knobX = sliderX + fillW
      ctx.beginPath()
      ctx.arc(knobX, sliderY, knobR, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
      ctx.strokeStyle = 'rgba(77,204,77,0.8)'; ctx.lineWidth = 1.5 * S; ctx.stroke()

      // 百分比文字
      ctx.fillStyle = '#ccc'
      ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText(`${item.value}%`, listX + listW - 4 * S, sliderY)

      g._bgmVolSlider = { x: sliderX, y: sliderY - knobR, w: sliderW, h: knobR * 2, sliderX, sliderW }
      g._morePanelRects[item.key] = [sliderX - knobR, sliderY - knobR, sliderW + knobR * 2, knobR * 2]
    } else if (item.toggle !== null && item.toggle !== undefined) {
      const swW = 40 * S, swH = 22 * S
      const swX = listX + listW - swW - 8 * S
      const swY = itemY + (itemH - 4 * S) / 2 - swH / 2

      ctx.fillStyle = item.toggle ? 'rgba(77,204,77,0.8)' : 'rgba(100,100,120,0.5)'
      R.rr(swX, swY, swW, swH, swH / 2); ctx.fill()
      const knobR = swH / 2 - 2 * S
      const knobX = item.toggle ? swX + swW - swH / 2 : swX + swH / 2
      ctx.beginPath()
      ctx.arc(knobX, swY + swH / 2, knobR, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
      g._morePanelRects[item.key] = [listX, itemY, listW, itemH - 4 * S]
    } else {
      ctx.fillStyle = 'rgba(200,180,120,0.5)'
      ctx.font = `${14*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText('›', listX + listW - 12 * S, itemY + (itemH - 4 * S) / 2)
      g._morePanelRects[item.key] = [listX, itemY, listW, itemH - 4 * S]
    }
    itemY += itemH
  }

  if (g._morePanelRects.feedback) {
    g._feedbackBtnRect = g._morePanelRects.feedback
  }

  ctx.restore()
}

// ===== 每日奖励入口按钮 =====
function drawDailyRewardBtn(g) {
  const { ctx: c, R, W, S, safeTop } = V
  const hasBadge = g.storage.hasDailyRewardEntryBadge
  const btnW = TITLE_HOME.dailySignBtnWidthPt * S
  const geo = _dailySignBtnGeometry(safeTop, S)
  const padTop = geo.padTop
  const iconSz = geo.iconSz
  const labelGap = geo.labelGap
  const btnH = geo.btnH
  const labelHPx = geo.labelH != null ? geo.labelH : TITLE_HOME.dailySignLabelPt * S
  const bx = W - btnW - 8 * S
  const by = geo.top

  c.save()
  const iconImg = R.getImg('assets/ui/daily_sign_icon.png')
  const iconX = bx + (btnW - iconSz) / 2
  const iconY = by + padTop
  if (iconImg && iconImg.width > 0) {
    c.drawImage(iconImg, iconX, iconY, iconSz, iconSz)
  } else {
    c.fillStyle = hasBadge ? 'rgba(255,215,0,0.25)' : 'rgba(255,255,255,0.1)'
    R.rr(bx, by, btnW, iconSz + padTop * 2, 8 * S); c.fill()
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.font = `${22*S}px sans-serif`
    c.fillStyle = '#FFD700'
    c.fillText('📅', bx + btnW / 2, iconY + iconSz / 2)
  }
  const labelY = iconY + iconSz + labelGap + labelHPx * 0.5
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${labelHPx}px "PingFang SC",sans-serif`
  c.lineWidth = 2.5 * S
  c.strokeStyle = 'rgba(45,25,10,0.82)'
  c.fillStyle = hasBadge ? '#FFECB0' : 'rgba(210,200,190,0.95)'
  c.strokeText('每日签到', bx + btnW / 2, labelY)
  c.fillText('每日签到', bx + btnW / 2, labelY)

  if (hasBadge) {
    c.fillStyle = '#FF4444'; c.beginPath(); c.arc(bx + btnW - 1 * S, by + 5 * S, 5 * S, 0, Math.PI * 2); c.fill()
  }
  c.restore()
  g._dailyRewardBtnRect = [bx, by, btnW, btnH]
}

// ===== 主入口 =====
function rTitle(g) {
  drawSceneArea(g)
  drawTopBar(g)
  drawStartBtn(g)
  drawModeSwitchBtn(g)
  drawSidebarBtn(g)
  drawBottomBar(g)
  drawAvatarWidget(g)
  drawStaminaBar(g)
  drawDailyRewardBtn(g)
  drawMorePanel(g)
  drawTitleStartDialog(g)
  drawSidebarPanel(g)
  if (g._showDailyReward) {
    const { rDailyReward } = require('./dailyRewardView')
    rDailyReward(g)
  }
}

module.exports = { rTitle, getLayout, BAR_ITEMS, drawBottomBar }
