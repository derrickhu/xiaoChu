/**
 * 首页渲染 — 场景式大厅 v3
 * 布局：顶栏 / 场景区（背景+插画+Logo）/ 灵宠展示 / 开始按钮区 / 模式切换浮钮 / 7标签底部导航
 */
const V = require('./env')
const P = require('../platform')

const { BAR_ITEMS, getLayout, drawBottomBar } = require('./bottomBar')
const { drawPanel } = require('./uiComponents')
const { getBrowsableStages, getStageBossAvatar, getStageBossName, RATING_ORDER } = require('../data/stages')
const { STAGE_CARD: SC } = require('../data/constants')
const guideMgr = require('../engine/guideManager')

// 模式配置（秘境首页已改为卡片选关，不再使用 gate_stage 图）
const MODE_CFG = {
  tower: { name: '通天塔', img: 'assets/ui/tower_rogue.png', icon: '⚔', switchKey: 'stage' },
  stage: { name: '灵兽秘境', img: 'assets/ui/tower_rogue.png', icon: '🏯', switchKey: 'tower' },
}

// ===== ZONE 1: 顶栏（游戏标题Logo，位于状态栏下方）=====
function drawTopBar(g) {
  const { ctx, R, W, S, safeTop } = V
  const logoImg = R.getImg('assets/ui/title_logo.png')
  if (logoImg && logoImg.width > 0) {
    // 状态栏行底部 = safeTop + 48S + 42S，Logo 紧贴其下
    const statusBarBottom = safeTop + 48 * S + 42 * S
    const logoH = 42 * S
    const logoW = logoH * (logoImg.width / logoImg.height)
    const logoX = (W - logoW) / 2
    const logoY = statusBarBottom + 4 * S
    ctx.save()
    ctx.globalAlpha = 1
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH)
    ctx.restore()
  }
}

// ===== 秘境内嵌选关：获取当前展示的关卡数据 =====
function _ensureBrowsableList(g) {
  // 每帧重建（15关遍历，开销可忽略），确保通关后列表立即更新
  g._browsableStages = getBrowsableStages(g.storage.stageClearRecord)
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

  const imgPath = MODE_CFG[mode].img
  const towerImg = R.getImg(imgPath)
  const sceneH = L.petRowY - L.topBarBottom

  if (towerImg && towerImg.width > 0) {
    const targetH = sceneH * 0.88
    const ratioW = towerImg.width / towerImg.height
    const imgW = Math.min(targetH * ratioW, W * 0.92)
    const imgH = imgW / ratioW
    const imgX = (W - imgW) / 2
    const imgY = L.petRowY - imgH + 14 * S
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
  const entry = _getDisplayStage(g)
  if (!entry) return

  const { stage, unlocked } = entry
  const sceneTop = L.topBarBottom
  const sceneBot = L.petRowY
  const sceneH = sceneBot - sceneTop
  const swipeDx = g._stageSwipeDeltaX || 0
  const cx = W / 2

  // ── 布局：标题横幅 + 怪物卡片（两段式）──
  const marginV = SC.marginV * S
  const marginH = SC.marginH * S
  const cardR = SC.cardRadius * S
  const innerPad = SC.innerPad * S
  const bannerH = SC.headerH * S
  const footerH = SC.footerH * S
  const gap = SC.gap * S
  const imgInset = SC.imgInset * S
  const bannerGap = 8 * S
  const cardPadTop = 6 * S

  const cardX = marginH
  const cardW = W - marginH * 2

  const maxByWidth = cardW - innerPad * 2
  const maxByConfig = SC.maxImgPt ? SC.maxImgPt * S : Infinity
  const imgSide = Math.min(maxByWidth, maxByConfig)

  // 怪物卡片按内容紧凑高度（不再拉满到场景底，避免圆与星级之间大块空白）
  const cardH = cardPadTop + imgSide + gap + footerH
  const totalBlockH = bannerH + bannerGap + cardH
  const minTop = sceneTop + marginV
  // 底边贴在星级说明条上方（与 drawStartBtn 中 condY 同一套尺寸）
  const condPanelH = (SC.condPanelPt != null ? SC.condPanelPt : 38) * S
  const condAboveBtn = (SC.condAboveStartBtnPt != null ? SC.condAboveStartBtnPt : 10) * S
  const blockAboveCond = (SC.blockAboveCondGapPt != null ? SC.blockAboveCondGapPt : 6) * S
  const condTop = L.startBtnY - condPanelH - condAboveBtn
  const blockBottomTarget = condTop - blockAboveCond
  let bannerY = blockBottomTarget - totalBlockH
  if (bannerY < minTop) bannerY = minTop

  const cardY = bannerY + bannerH + bannerGap

  const imgX = cx - imgSide / 2
  const imgY = cardY + cardPadTop

  ctx.save()

  // ══════ 标题横幅（暖色渐变底 + 特效文字）══════
  ctx.save()
  const bx = cardX + 4 * S
  const bw = cardW - 8 * S
  const bR = 12 * S
  ctx.shadowColor = 'rgba(140, 90, 30, 0.15)'
  ctx.shadowBlur = 10 * S
  ctx.shadowOffsetY = 2 * S
  const bannerBg = ctx.createLinearGradient(bx, bannerY, bx, bannerY + bannerH)
  bannerBg.addColorStop(0, 'rgba(245, 228, 195, 0.92)')
  bannerBg.addColorStop(0.5, 'rgba(235, 215, 175, 0.94)')
  bannerBg.addColorStop(1, 'rgba(225, 205, 162, 0.90)')
  ctx.fillStyle = bannerBg
  R.rr(bx, bannerY, bw, bannerH, bR)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(195, 160, 60, 0.4)'
  ctx.lineWidth = 1.2 * S
  R.rr(bx, bannerY, bw, bannerH, bR)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255, 245, 210, 0.45)'
  ctx.lineWidth = 0.5 * S
  R.rr(bx + 2 * S, bannerY + 2 * S, bw - 4 * S, bannerH - 4 * S, Math.max(1, bR - 2 * S))
  ctx.stroke()
  ctx.restore()

  // "关卡 X-X" 主标题（清晰无描边）
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const stageLabel = `关卡 ${stage.chapter}-${stage.order}`
  const labelFontSz = 17 * S
  ctx.font = `bold ${labelFontSz}px "PingFang SC",sans-serif`
  const labelCY = bannerY + bannerH * 0.30

  ctx.save()
  ctx.strokeStyle = 'rgba(255, 242, 205, 0.6)'
  ctx.lineWidth = 3.5 * S
  ctx.lineJoin = 'round'
  ctx.strokeText(stageLabel, cx, labelCY)
  ctx.shadowColor = 'rgba(100, 60, 10, 0.2)'
  ctx.shadowBlur = 2 * S
  ctx.shadowOffsetY = 1 * S
  ctx.fillStyle = '#5a2d05'
  ctx.fillText(stageLabel, cx, labelCY)
  ctx.restore()

  // 装饰分隔线
  const divY = bannerY + bannerH * 0.52
  ctx.save()
  ctx.strokeStyle = 'rgba(185, 150, 70, 0.3)'
  ctx.lineWidth = 0.8 * S
  const divHalfW = 28 * S
  ctx.beginPath()
  ctx.moveTo(cx - divHalfW, divY)
  ctx.lineTo(cx + divHalfW, divY)
  ctx.stroke()
  ctx.fillStyle = 'rgba(195, 160, 65, 0.45)'
  ctx.beginPath()
  ctx.arc(cx, divY, 1.5 * S, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 关卡名称（分隔线下方）
  let nameFontPx = 12 * S
  ctx.font = `${nameFontPx}px "PingFang SC",sans-serif`
  const maxNameW = bw - innerPad * 2
  while (ctx.measureText(stage.name).width > maxNameW && nameFontPx > 9 * S) {
    nameFontPx -= S
    ctx.font = `${nameFontPx}px "PingFang SC",sans-serif`
  }
  const nameCY = bannerY + bannerH * 0.76
  ctx.save()
  ctx.fillStyle = 'rgba(100, 65, 20, 0.7)'
  ctx.fillText(stage.name, cx, nameCY)
  ctx.restore()

  // ══════ 怪物卡片（暖色渐变 + 金框）══════
  ctx.save()
  ctx.shadowColor = 'rgba(120, 80, 20, 0.14)'
  ctx.shadowBlur = 12 * S
  ctx.shadowOffsetY = 2 * S
  const mcBg = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  mcBg.addColorStop(0, 'rgba(255, 250, 240, 0.90)')
  mcBg.addColorStop(0.5, 'rgba(248, 238, 215, 0.86)')
  mcBg.addColorStop(1, 'rgba(240, 225, 195, 0.88)')
  ctx.fillStyle = mcBg
  R.rr(cardX, cardY, cardW, cardH, cardR)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.strokeStyle = 'rgba(195, 158, 60, 0.36)'
  ctx.lineWidth = 1.2 * S
  R.rr(cardX, cardY, cardW, cardH, cardR)
  ctx.stroke()
  const fInset = 4 * S
  ctx.strokeStyle = 'rgba(200, 170, 80, 0.18)'
  ctx.lineWidth = 0.6 * S
  R.rr(cardX + fInset, cardY + fInset, cardW - fInset * 2, cardH - fInset * 2, Math.max(1, cardR - 3 * S))
  ctx.stroke()
  ctx.restore()

  // ── 灵力光晕（怪物背后的柔光场）──
  const portalCx = cx
  const portalCy = imgY + imgSide / 2
  const portalR = imgSide * 0.58
  ctx.save()
  const outerAura = ctx.createRadialGradient(portalCx, portalCy, portalR * 0.1, portalCx, portalCy, portalR)
  outerAura.addColorStop(0, 'rgba(255, 250, 230, 0.36)')
  outerAura.addColorStop(0.5, 'rgba(242, 228, 185, 0.12)')
  outerAura.addColorStop(1, 'rgba(228, 210, 160, 0)')
  ctx.fillStyle = outerAura
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, portalR, 0, Math.PI * 2)
  ctx.fill()
  const innerAura = ctx.createRadialGradient(portalCx, portalCy - 2 * S, 0, portalCx, portalCy, portalR * 0.4)
  innerAura.addColorStop(0, 'rgba(255, 255, 250, 0.3)')
  innerAura.addColorStop(0.6, 'rgba(255, 248, 228, 0.08)')
  innerAura.addColorStop(1, 'rgba(250, 240, 210, 0)')
  ctx.fillStyle = innerAura
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, portalR * 0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, portalR * 0.7, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(210, 180, 100, 0.13)'
  ctx.lineWidth = S
  ctx.stroke()
  ctx.restore()

  // ── 立绘区域（圆形裁切）──
  const clipR = imgSide / 2
  ctx.save()
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, clipR, 0, Math.PI * 2)
  ctx.clip()

  const glow = ctx.createRadialGradient(portalCx, portalCy - imgSide * 0.08, imgSide * 0.06, portalCx, portalCy, clipR)
  glow.addColorStop(0, 'rgba(255,252,240,0.4)')
  glow.addColorStop(0.5, 'rgba(245,235,210,0.1)')
  glow.addColorStop(1, 'rgba(235,218,185,0)')
  ctx.fillStyle = glow
  ctx.fillRect(imgX, imgY, imgSide, imgSide)

  const bossAvatarPath = getStageBossAvatar(stage)
  const bossImg = bossAvatarPath ? R.getImg(bossAvatarPath) : null
  if (bossImg && bossImg.width > 0) {
    const sw = bossImg.width, sh = bossImg.height
    if (!unlocked) ctx.globalAlpha = 0.4
    // 整图「包含」进圆内：按比例缩放，四角落在圆内（不切头尾）
    const Rin = Math.max(2 * S, clipR - imgInset)
    const diag = Math.sqrt(sw * sw + sh * sh)
    const scale = diag > 0 ? (2 * Rin) / diag : 0
    const drawW = Math.max(1, sw * scale)
    const drawH = Math.max(1, sh * scale)
    const drawX = portalCx - drawW / 2 + swipeDx
    const drawY = portalCy - drawH / 2
    ctx.drawImage(bossImg, drawX, drawY, drawW, drawH)
    ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = unlocked ? 'rgba(110,75,40,0.55)' : 'rgba(80,80,80,0.4)'
    ctx.font = `bold ${16 * S}px "PingFang SC",sans-serif`
    ctx.fillText(getStageBossName(stage) || stage.name, cx + swipeDx, imgY + imgSide / 2)
  }
  if (!unlocked) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(imgX, imgY, imgSide, imgSide)
    ctx.font = `${28 * S}px sans-serif`
    ctx.fillText('🔒', cx, imgY + imgSide / 2)
  }
  ctx.restore()

  // 金色圆环边框
  ctx.save()
  ctx.beginPath()
  ctx.arc(portalCx, portalCy, clipR + 1.5 * S, 0, Math.PI * 2)
  const ringGrad = ctx.createLinearGradient(portalCx - clipR, portalCy - clipR, portalCx + clipR, portalCy + clipR)
  ringGrad.addColorStop(0, 'rgba(215, 185, 75, 0.48)')
  ringGrad.addColorStop(0.5, 'rgba(250, 230, 150, 0.52)')
  ringGrad.addColorStop(1, 'rgba(195, 160, 50, 0.48)')
  ctx.strokeStyle = ringGrad
  ctx.lineWidth = 2 * S
  ctx.stroke()
  ctx.restore()


  // ── 已获星级展示 ──
  if (unlocked && stage.rating) {
    const bestRt = g.storage.getStageBestRating(stage.id)
    const bestSt = bestRt ? (RATING_ORDER[bestRt] || 0) : 0
    const starY = portalCy + clipR + 10 * S
    const starFontSz = 16 * S
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${starFontSz}px sans-serif`
    let starStr = ''
    for (let si = 1; si <= 3; si++) {
      starStr += si <= bestSt ? '★' : '☆'
    }
    ctx.shadowColor = bestSt > 0 ? 'rgba(220, 170, 30, 0.45)' : 'transparent'
    ctx.shadowBlur = 6 * S
    ctx.fillStyle = bestSt > 0 ? '#c89520' : 'rgba(160, 140, 100, 0.4)'
    ctx.fillText(starStr, cx, starY)
    ctx.restore()
  }

  const list = _ensureBrowsableList(g)

  // ── 左右切换箭头 ──
  const arrowCY = imgY + imgSide / 2
  const arrowR = 16 * S
  function _drawArrowBtn(acx, acy, symbol) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(acx, acy, arrowR, 0, Math.PI * 2)
    const aGrad = ctx.createRadialGradient(acx, acy - 2 * S, 0, acx, acy, arrowR)
    aGrad.addColorStop(0, 'rgba(220, 185, 80, 0.92)')
    aGrad.addColorStop(1, 'rgba(160, 115, 35, 0.82)')
    ctx.fillStyle = aGrad
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 235, 160, 0.6)'
    ctx.lineWidth = 1.2 * S
    ctx.stroke()
    ctx.font = `bold ${15 * S}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff8e0'
    ctx.fillText(symbol, acx, acy)
    ctx.restore()
  }
  if (g._selectedStageIdx > 0) {
    const lx = arrowR + 6 * S
    _drawArrowBtn(lx, arrowCY, '◀')
    g._stageArrowLeftRect = [lx - arrowR, arrowCY - arrowR, arrowR * 2, arrowR * 2]
  } else {
    g._stageArrowLeftRect = null
  }
  if (g._selectedStageIdx < list.length - 1) {
    const rx = W - arrowR - 6 * S
    _drawArrowBtn(rx, arrowCY, '▶')
    g._stageArrowRightRect = [rx - arrowR, arrowCY - arrowR, arrowR * 2, arrowR * 2]
  } else {
    g._stageArrowRightRect = null
  }

  const totalH = bannerH + bannerGap + cardH
  g._stageGateRect = [cardX, bannerY, cardW, totalH]
  ctx.restore()
}

// ===== ZONE 3: 状态栏（头像 + 灵石 + 体力，同一排）=====
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

  // 整排位置：微信胶囊按钮下方（safeTop + 约50S）
  const rowY = safeTop + 48 * S
  const iconSz = 42 * S
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

  // 等级角标
  const lvText = `Lv.${level}`
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lvTxtW = ctx.measureText(lvText).width
  const lvPadX = 5 * S
  const lvCapW = lvTxtW + lvPadX * 2
  const lvCapH = 16 * S
  const lvCapR = lvCapH / 2
  const lvCapCX = iconCX + iconSz * 0.22
  const lvCapCY = iconCY + iconSz * 0.40
  const lvCapX = lvCapCX - lvCapW / 2
  const lvCapY = lvCapCY - lvCapH / 2

  ctx.beginPath()
  R.rr(lvCapX, lvCapY, lvCapW, lvCapH, lvCapR)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fill()
  ctx.strokeStyle = 'rgba(220,185,60,0.5)'; ctx.lineWidth = 0.8 * S; ctx.stroke()
  ctx.fillStyle = '#fff8cc'
  ctx.fillText(lvText, lvCapCX, lvCapCY)

  // ── 灵石 + 体力胶囊（头像右侧，同一排）──
  const pillH = 24 * S
  const pillR = pillH / 2
  const pillIconSz = 20 * S
  const pillGap = 6 * S
  const pillStartX = iconX + iconSz + 8 * S
  const pillCY = iconCY

  // 通用胶囊绘制
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

  // 灵石
  const soulStone = g.storage.soulStone || 0
  const ssPillW = _drawPill(pillStartX, String(soulStone), 'assets/ui/icon_soul_stone.png')

  // 体力
  const stamina = g.storage.currentStamina
  const maxSt = g.storage.maxStamina
  const stText = `${stamina}/${maxSt}`
  _drawPill(pillStartX + ssPillW + pillGap, stText, 'assets/ui/icon_stamina.png')

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
    const btnW = W * 0.60
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = L.startBtnY

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
    ctx.fillText(progressText, W / 2, L.progressY + L.progressH / 2)
  } else {
    // 灵兽秘境模式 — 内嵌选关
    const entry = _getDisplayStage(g)
    const stage = entry ? entry.stage : null
    const stageUnlocked = entry ? entry.unlocked : false

    const btnW = W * 0.60
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = L.startBtnY

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
    if (guideMgr.getCurrentId() === 'newbie_stage_start') {
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
      ctx.fillText(progressText, W / 2, L.progressY + L.progressH / 2)
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

// ===== 右上角模式切换浮钮 =====
function drawModeSwitchBtn(g) {
  const { ctx, R, W, S, safeTop } = V
  const mode = g.titleMode || 'tower'
  const targetMode = MODE_CFG[mode].switchKey
  const targetCfg = MODE_CFG[targetMode]

  const iconSize = 38 * S
  const labelSize = 10 * S
  const vGap = 3 * S
  const btnW = iconSize + 8 * S
  const btnH = iconSize + vGap + labelSize + 6 * S

  // 右上角，宝箱按钮下方
  const btnX = W - btnW
  const btnY = safeTop + 106 * S
  const icx = btnX + btnW / 2
  const icy = btnY + 4 * S + iconSize / 2

  ctx.save()

  // 半透明胶囊背景（左侧半圆，右侧贴屏幕边缘）
  const bgR = btnW / 2
  ctx.beginPath()
  ctx.moveTo(btnX + btnW, btnY)
  ctx.lineTo(btnX + bgR, btnY)
  ctx.quadraticCurveTo(btnX, btnY, btnX, btnY + bgR)
  ctx.lineTo(btnX, btnY + btnH - bgR)
  ctx.quadraticCurveTo(btnX, btnY + btnH, btnX + bgR, btnY + btnH)
  ctx.lineTo(btnX + btnW, btnY + btnH)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,245,220,0.82)'; ctx.fill()
  ctx.strokeStyle = 'rgba(200,165,60,0.7)'; ctx.lineWidth = 1.5 * S; ctx.stroke()

  // 切换图标
  const btnImg = R.getImg('assets/ui/btn_mode_switch.png')
  if (btnImg && btnImg.width > 0) {
    const drawSz = iconSize * 0.7
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

// ===== 宝箱浮钮（右下角，与模式切换左右对称） =====
// ===== 宝箱浮钮（右上角，顶栏旁边）=====
function drawChestBtn(g) {
  const { ctx, R, W, S, safeTop } = V
  const { getUnclaimedCount } = require('../data/chestConfig')

  // 图标尺寸：避开右上角系统按钮（...），下移至其下方
  const btnSz = 48 * S
  const btnX = W - btnSz - 10 * S
  const btnY = safeTop + 52 * S

  ctx.save()

  // 点击缩放动画：按下 → 弹起回弹
  const pressAge = g._chestPressTime ? (Date.now() - g._chestPressTime) : 9999
  let pressScale = 1.0
  if (pressAge < 120) {
    // 0~120ms：压下，scale 1→0.82
    pressScale = 1.0 - 0.18 * (pressAge / 120)
  } else if (pressAge < 300) {
    // 120~300ms：弹起回弹，用 sin 模拟弹性
    pressScale = 0.82 + 0.25 * Math.sin(Math.PI * (pressAge - 120) / 180)
  }

  const cx = btnX + btnSz / 2
  const cy = btnY + btnSz / 2
  ctx.translate(cx, cy)
  ctx.scale(pressScale, pressScale)
  ctx.translate(-cx, -cy)

  const chestImg = R.getImg('assets/ui/icon_chest.png')
  if (chestImg && chestImg.width > 0) {
    ctx.drawImage(chestImg, btnX, btnY, btnSz, btnSz)
  } else {
    // fallback：绘制圆形背景 + emoji
    ctx.fillStyle = 'rgba(20,18,38,0.75)'
    R.rr(btnX, btnY, btnSz, btnSz, 8 * S); ctx.fill()
    ctx.font = `${btnSz * 0.55}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🎁', btnX + btnSz / 2, btnY + btnSz / 2)
  }

  // 红点 + 数字（右上角）
  const count = getUnclaimedCount(g.storage)
  if (count > 0) {
    const dotR = 8 * S
    const dotX = btnX + btnSz - dotR * 0.5
    const dotY = btnY + dotR * 0.5
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#ff3333'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(count), dotX, dotY)
  }

  g._chestBtnRect = [btnX, btnY, btnSz, btnSz]
  ctx.restore()
}


// ===== 主入口 =====
function rTitle(g) {
  drawSceneArea(g)
  drawTopBar(g)
  drawStartBtn(g)
  drawModeSwitchBtn(g)
  drawChestBtn(g)
  drawSidebarBtn(g)
  drawBottomBar(g)
  drawAvatarWidget(g)
  drawStaminaBar(g)
  drawMorePanel(g)
  drawTitleStartDialog(g)
  drawSidebarPanel(g)
}

module.exports = { rTitle, getLayout, BAR_ITEMS, drawBottomBar }
