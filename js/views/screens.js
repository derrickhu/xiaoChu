/**
 * 简单场景渲染：Loading / Title / Gameover / Ranking / Stats
 * 以及通用 UI 组件：返回按钮、弹窗
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetAvatarPath, MAX_STAR, PETS, getPetSkillDesc, getPetLore, getStar3Override, petHasSkill, getPetRarity } = require('../data/pets')
const { RARITY_VISUAL } = require('../data/economyConfig')
const { wrapText: _uiWrapText } = require('./uiUtils')
const { drawBottomBar, getLayout: _getDexLayout, drawPageTitle } = require('./bottomBar')
const { drawPanel, drawRibbonIcon, drawCelebrationBackdrop, drawRewardRow, drawBuffCard, drawLingCard, wrapText } = require('./uiComponents')
const { LING } = require('../data/lingIdentity')
const { getDexProgress, getDexProgressByAttr, getPetDexTier, DEX_ATTRS, DEX_ATTR_LABEL, TOTAL_PET_COUNT,
  ELEM_MILESTONES, TOTAL_MILESTONES, RARITY_MILESTONES,
  hasUnclaimedMilestones } = require('../data/dexConfig')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { formatRankStageProgressSubtitle } = require('../data/stages')
const { DEX_LAYOUT, getDexContentTop, WEAPON_ACQUIRE_HINT_UNOWNED } = require('../data/constants')

// ===== Loading =====
function rLoading(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawLoadingBg(g.af)

  // 使用实际资源加载进度（由 preloadImages 回调更新）
  const pct = g._loadPct || 0

  // 进度条参数 — 位于画面底部
  const barW = W * 0.6
  const barH = 10 * S
  const barX = (W - barW) / 2
  const barY = H - 60 * S
  const radius = barH / 2

  // 进度条底槽（半透明白色，圆角）
  ctx.save()
  ctx.beginPath()
  R.rr(barX, barY, barW, barH, radius)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.fill()

  // 进度条填充（金色渐变，圆角，带发光）
  const fillW = Math.max(barH, barW * pct)
  if (pct > 0) {
    ctx.beginPath()
    R.rr(barX, barY, fillW, barH, radius)
    const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY)
    grad.addColorStop(0, '#f0a030')
    grad.addColorStop(0.5, '#ffd700')
    grad.addColorStop(1, '#ffe066')
    ctx.fillStyle = grad
    ctx.fill()

    // 高光条纹
    ctx.beginPath()
    R.rr(barX, barY, fillW, barH * 0.45, radius)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fill()

    // 外发光
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 8 * S
    ctx.beginPath()
    R.rr(barX, barY, fillW, barH, radius)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // 百分比数字（进度条右侧，带描边）
  const pctText = `${Math.round(pct * 100)}%`
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3*S; ctx.lineJoin = 'round'
  ctx.strokeText(pctText, barX + barW, barY - 10*S)
  ctx.fillStyle = '#ffd700'
  ctx.fillText(pctText, barX + barW, barY - 10*S)
  ctx.textBaseline = 'alphabetic'

  ctx.restore()
}

// 图鉴按钮上的角标
function _drawDexBtnBadge(ctx, S, bx, by, bw, bh) {
  const tag = '收集奖励'
  const fs = 7 * S
  const padH = 2 * S, padW = 4 * S
  const tw = fs * tag.length + padW * 2
  const th = fs + padH * 2
  const tx = bx + bw - tw + 2 * S  // 右上偏移
  const ty = by - th + 3 * S
  // 红色圆角底
  const grad = ctx.createLinearGradient(tx, ty, tx, ty + th)
  grad.addColorStop(0, '#ff5252'); grad.addColorStop(1, '#d32f2f')
  ctx.fillStyle = grad
  ctx.beginPath()
  const r = th * 0.4
  ctx.moveTo(tx + r, ty); ctx.lineTo(tx + tw - r, ty)
  ctx.arcTo(tx + tw, ty, tx + tw, ty + r, r)
  ctx.lineTo(tx + tw, ty + th - r)
  ctx.arcTo(tx + tw, ty + th, tx + tw - r, ty + th, r)
  ctx.lineTo(tx + r, ty + th)
  ctx.arcTo(tx, ty + th, tx, ty + th - r, r)
  ctx.lineTo(tx, ty + r)
  ctx.arcTo(tx, ty, tx + r, ty, r)
  ctx.closePath(); ctx.fill()
  // 文字
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${fs}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(tag, tx + tw / 2, ty + th / 2)
}

// ===== Title =====
function _drawImgBtn(ctx, R, img, x, y, w, h, text, fontSize, S) {
  if (img && img.width > 0) {
    ctx.drawImage(img, x, y, w, h)
  } else {
    // fallback: 金色渐变圆角按钮
    const r = h * 0.4
    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, '#f5d98a'); grad.addColorStop(0.5, '#d4a84b'); grad.addColorStop(1, '#b8862d')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath(); ctx.fill()
  }
  // 按钮上叠加文字
  if (text) {
    ctx.save()
    ctx.fillStyle = '#5a2d0c'
    ctx.font = `bold ${fontSize * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(255,230,180,0.6)'; ctx.shadowBlur = 2 * S
    ctx.fillText(text, x + w / 2, y + h / 2)
    ctx.shadowBlur = 0
    ctx.restore()
  }
}

// 意见反馈文字按钮（低调风格）
function _drawFeedbackBtn(ctx, S, W, y) {
  const text = '意见反馈'
  const fs = 10*S
  ctx.save()
  ctx.font = `${fs}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(210,190,160,0.7)'
  ctx.fillText('📝 ' + text, W*0.5, y + 3*S)
  // 下划线
  const tw = ctx.measureText('📝 ' + text).width
  ctx.strokeStyle = 'rgba(210,190,160,0.35)'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W*0.5 - tw*0.5, y + fs + 5*S)
  ctx.lineTo(W*0.5 + tw*0.5, y + fs + 5*S)
  ctx.stroke()
  ctx.restore()
}

function rTitle(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawHomeBg(g.af)

  // 游戏标题Logo
  const titleLogo = R.getImg('assets/ui/title_logo.png')
  if (titleLogo && titleLogo.width > 0) {
    const logoW = W * 0.7
    const logoH = logoW * (titleLogo.height / titleLogo.width)
    const logoX = (W - logoW) / 2
    const logoY = H * 0.08
    ctx.drawImage(titleLogo, logoX, logoY, logoW, logoH)
  }

  const imgContinue = R.getImg('assets/ui/btn_continue.png')
  const imgStart = R.getImg('assets/ui/btn_start.png')
  const imgRank = R.getImg('assets/ui/btn_rank.png')

  // 按钮宽度占屏幕60%，高度按 4:1 宽高比
  const btnW = W * 0.6, btnH = btnW / 4
  const btnX = (W - btnW) / 2

  // 图鉴按钮（独立一行，较大醒目）
  const dexW = W * 0.5, dexH = dexW / 4
  const dexX = (W - dexW) / 2
  // 底部小按钮（统计+排行并排）
  const smGap = 8 * S
  const smW = (W * 0.5 - smGap) / 2, smH = smW / 3.2
  const smStartX = (W - smW * 2 - smGap) / 2

  const hasSave = g.storage.hasSavedRun()
  if (hasSave) {
    const saved = g.storage.loadRunState()
    // 继续挑战
    const cby = H * 0.46
    _drawImgBtn(ctx, R, imgContinue, btnX, cby, btnW, btnH, `继续挑战 (第${saved.floor}层)`, 16, S)
    g._titleContinueRect = [btnX, cby, btnW, btnH]
    // 开始挑战
    const sby = H * 0.57
    _drawImgBtn(ctx, R, imgStart, btnX, sby, btnW, btnH, '开始挑战', 15, S)
    g._titleBtnRect = [btnX, sby, btnW, btnH]
    // 图鉴（独立一行，醒目）
    const dexY = H * 0.68
    _drawImgBtn(ctx, R, imgRank, dexX, dexY, dexW, dexH, '图鉴', 15, S)
    _drawDexBtnBadge(ctx, S, dexX, dexY, dexW, dexH)
    g._dexBtnRect = [dexX, dexY, dexW, dexH]
    // 统计+排行（并排小按钮）
    const smY = H * 0.78
    _drawImgBtn(ctx, R, imgRank, smStartX, smY, smW, smH, '统计', 12, S)
    g._statBtnRect = [smStartX, smY, smW, smH]
    _drawImgBtn(ctx, R, imgRank, smStartX + smW + smGap, smY, smW, smH, '排行', 12, S)
    g._rankBtnRect = [smStartX + smW + smGap, smY, smW, smH]
    // 意见反馈（底部小文字按钮）
    const fbY = smY + smH + 12*S
    _drawFeedbackBtn(ctx, S, W, fbY)
    g._feedbackBtnRect = [W*0.5 - 40*S, fbY, 80*S, 22*S]
  } else {
    g._titleContinueRect = null
    // 开始挑战
    const sby = H * 0.50
    _drawImgBtn(ctx, R, imgStart, btnX, sby, btnW, btnH, '开始挑战', 18, S)
    g._titleBtnRect = [btnX, sby, btnW, btnH]
    // 图鉴（独立一行，醒目）
    const dexY = H * 0.62
    _drawImgBtn(ctx, R, imgRank, dexX, dexY, dexW, dexH, '图鉴', 15, S)
    _drawDexBtnBadge(ctx, S, dexX, dexY, dexW, dexH)
    g._dexBtnRect = [dexX, dexY, dexW, dexH]
    // 统计+排行（并排小按钮）
    const smY = H * 0.72
    _drawImgBtn(ctx, R, imgRank, smStartX, smY, smW, smH, '统计', 12, S)
    g._statBtnRect = [smStartX, smY, smW, smH]
    _drawImgBtn(ctx, R, imgRank, smStartX + smW + smGap, smY, smW, smH, '排行', 12, S)
    g._rankBtnRect = [smStartX + smW + smGap, smY, smW, smH]
    // 意见反馈（底部小文字按钮）
    const fbY = smY + smH + 12*S
    _drawFeedbackBtn(ctx, S, W, fbY)
    g._feedbackBtnRect = [W*0.5 - 40*S, fbY, 80*S, 22*S]
  }

  if (g.showNewRunConfirm) drawNewRunConfirm(g)
}

// ===== Gameover =====
let _goScrollY = 0
let _goScrollMax = 0
let _goScrollViewport = null
let _goScrollActive = false
let _goScrollStartY = 0
let _goScrollLastY = 0
let _goScrollMoved = false

function rGameover(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V

  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  if (g._goAnimTimer == null) {
    g._goAnimTimer = 0
    _goScrollY = 0; _goScrollMax = 0; _goScrollViewport = null
  }
  g._goAnimTimer++
  const at = g._goAnimTimer
  const fadeIn = Math.min(1, at / 20)

  if (g.cleared) {
    _drawTowerVictory(g, ctx, R, W, H, S, safeTop, at, fadeIn)
  } else {
    _drawTowerDefeat(g, ctx, R, W, H, S, safeTop, at, fadeIn)
  }

  const panelTop = g.cleared ? safeTop + 168 * S : safeTop + 148 * S
  _drawTowerRewardPanel(g, ctx, R, W, H, S, panelTop, at, fadeIn)
}

function _goStrokeText(c, text, x, y, strokeColor, strokeWidth) {
  c.save()
  c.strokeStyle = strokeColor; c.lineWidth = strokeWidth; c.lineJoin = 'round'
  c.strokeText(text, x, y)
  c.restore()
  c.fillText(text, x, y)
}

function _drawTowerVictory(g, c, R, W, H, S, safeTop, at, fadeIn) {
  drawCelebrationBackdrop(c, W, H, S, safeTop + 80 * S, at, fadeIn)

  c.save()
  c.globalAlpha = fadeIn
  c.textAlign = 'center'; c.textBaseline = 'middle'

  c.save()
  const titleGlow = 0.4 + 0.2 * Math.sin(at * 0.06)
  c.shadowColor = `rgba(255,200,0,${titleGlow})`; c.shadowBlur = 20 * S
  c.fillStyle = '#FFD700'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _goStrokeText(c, '✦ 登顶通天塔 ✦', W * 0.5, safeTop + 46 * S, 'rgba(100,60,0,0.6)', 4 * S)
  c.restore()

  const divW = W * 0.26
  c.strokeStyle = 'rgba(180,140,40,0.5)'; c.lineWidth = 1.5 * S
  c.beginPath(); c.moveTo(W * 0.5 - divW, safeTop + 62 * S); c.lineTo(W * 0.5 + divW, safeTop + 62 * S); c.stroke()

  c.fillStyle = '#5A4020'; c.font = `${13*S}px "PingFang SC",sans-serif`
  _goStrokeText(c, '修士已突破重重试炼，功德圆满！', W * 0.5, safeTop + 80 * S, 'rgba(255,240,200,0.6)', 3 * S)

  const statW = W * 0.72, statH = 44 * S
  const statX = (W - statW) / 2, statY = safeTop + 100 * S
  const statBg = c.createLinearGradient(statX, statY, statX, statY + statH)
  statBg.addColorStop(0, 'rgba(40,32,15,0.85)'); statBg.addColorStop(1, 'rgba(25,20,10,0.9)')
  c.fillStyle = statBg; R.rr(statX, statY, statW, statH, 10 * S); c.fill()
  c.strokeStyle = 'rgba(212,175,55,0.3)'; c.lineWidth = 1 * S
  R.rr(statX, statY, statW, statH, 10 * S); c.stroke()

  const bestTurns = g.storage.stats.bestTotalTurns || 0
  const totalTurns = g.runTotalTurns || bestTurns || 0
  const isNewRecord = bestTurns > 0 && totalTurns <= bestTurns

  c.textBaseline = 'middle'
  c.fillStyle = '#FFD700'; c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  c.fillText(`第 ${g.floor > 60 ? 60 : g.floor} 层`, statX + statW * 0.3, statY + statH * 0.38)
  c.fillStyle = '#A89860'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText('通关层数', statX + statW * 0.3, statY + statH * 0.72)

  c.strokeStyle = 'rgba(212,175,55,0.2)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(statX + statW * 0.5, statY + 8 * S); c.lineTo(statX + statW * 0.5, statY + statH - 8 * S); c.stroke()

  c.fillStyle = isNewRecord ? '#FF6B35' : '#E8C870'
  c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  c.fillText(String(totalTurns), statX + statW * 0.7, statY + statH * 0.38)
  c.fillStyle = '#A89860'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText(isNewRecord ? '总回合 新纪录!' : '总回合', statX + statW * 0.7, statY + statH * 0.72)

  c.textBaseline = 'alphabetic'
  c.restore()
}

function _drawTowerDefeat(g, c, R, W, H, S, safeTop, at, fadeIn) {
  c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(0, 0, W, H)

  c.save()
  c.globalAlpha = fadeIn
  const glow = c.createRadialGradient(W * 0.5, safeTop + 60 * S, 0, W * 0.5, safeTop + 60 * S, W * 0.4)
  glow.addColorStop(0, 'rgba(180,40,50,0.15)')
  glow.addColorStop(1, 'rgba(180,40,50,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn
  c.textAlign = 'center'; c.textBaseline = 'middle'

  c.fillStyle = '#E06060'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _goStrokeText(c, '挑战结束', W * 0.5, safeTop + 46 * S, 'rgba(60,0,0,0.5)', 4 * S)

  const divW = W * 0.18
  c.strokeStyle = 'rgba(180,60,70,0.35)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(W * 0.5 - divW, safeTop + 62 * S); c.lineTo(W * 0.5 + divW, safeTop + 62 * S); c.stroke()

  c.fillStyle = '#5A4020'; c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  _goStrokeText(c, `本次到达：第 ${g.floor} 层`, W * 0.5, safeTop + 86 * S, 'rgba(255,240,200,0.5)', 3 * S)

  c.fillStyle = 'rgba(100,70,50,0.7)'; c.font = `${12*S}px "PingFang SC",sans-serif`
  _goStrokeText(c, `历史最高：第 ${g.storage.bestFloor} 层`, W * 0.5, safeTop + 108 * S, 'rgba(255,240,220,0.4)', 2.5 * S)

  c.fillStyle = 'rgba(100,70,50,0.7)'; c.font = `${12*S}px "PingFang SC",sans-serif`
  _goStrokeText(c, '修炼不止，再战可期', W * 0.5, safeTop + 132 * S, 'rgba(255,240,220,0.4)', 2.5 * S)

  c.textBaseline = 'alphabetic'
  c.restore()
}

function _goComputeContentH(g, S) {
  const AdManager = require('../adManager')
  const sr = g._lastRunSettleRewards
  const cultFinal = sr ? sr.cultExp.final : (g._lastRunExp || 0)
  const soulStoneFinal = sr ? sr.soulStone.final : (g._lastRunSoulStone || 0)
  const fragFinal = sr ? sr.fragments.final : 0
  const fragDetails = sr ? sr.fragments.details : []
  const pad = 14 * S

  let h = pad * 0.5
  h += 20 * S + 24 * S
  if (g.weapon) h += 22 * S
  h += 20 * S + 8 * S + 12 * S

  if (cultFinal > 0) {
    h += 28 * S
    const d = g._lastRunExpDetail
    if (d) { h += 18 * S; if (!d.isCleared) h += 16 * S }
    const levelUps = sr ? sr.cultExp.levelUps : (g._lastRunLevelUps || 0)
    if (levelUps > 0) h += 20 * S
    h += 24 * S
  }
  if (soulStoneFinal > 0) h += 32 * S
  if (fragFinal > 0) {
    h += 28 * S
    if (fragDetails.length > 0) h += fragDetails.length * 24 * S + 4 * S
  }
  const _srNewWpns = sr && sr.newWeapons && sr.newWeapons.length > 0
  if (_srNewWpns) h += 48 * S

  const eventRewards = g._lastRunEventRewards || []
  if (eventRewards.length > 0) {
    h += 4 * S + 8 * S + 24 * S + eventRewards.length * 30 * S + 4 * S
  }

  h += 24 * S
  // 排行榜挂件占位（30*S + 10*S 间距），仅在已有 myRank 时计入
  if (g.storage && g.storage.rankAllMyRank > 0) h += 30 * S + 10 * S
  if (!g._goAdDoubled && AdManager.canShow('settleDouble')) h += 44 * S
  h += pad + 48 * S

  let hasQuickBtns = false
  if (cultFinal > 0) {
    const { hasCultUpgradeAvailable } = require('../logic/cultivationLogic')
    if (hasCultUpgradeAvailable(g.storage)) hasQuickBtns = true
  }
  if (soulStoneFinal > 0 && g.storage.petPoolCount > 0) hasQuickBtns = true
  if (hasQuickBtns) h += 42 * S
  h += 44 * S
  return h
}

function _drawTowerRewardPanel(g, c, R, W, H, S, panelTop, at, fadeIn) {
  const { MAX_LEVEL, expToNextLevel, getRealmByLv } = require('../data/cultivationConfig')
  const { getPetById } = require('../data/pets')
  const { POOL_STAR_FRAG_COST } = require('../data/petPoolConfig')
  const AdManager = require('../adManager')
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 14 * S
  const innerW = pw - pad * 2
  const panelRad = 14 * S

  const sr = g._lastRunSettleRewards
  const cultFinal = sr ? sr.cultExp.final : (g._lastRunExp || 0)
  const soulStoneFinal = sr ? sr.soulStone.final : (g._lastRunSoulStone || 0)
  const fragFinal = sr ? sr.fragments.final : 0
  const fragDetails = sr ? sr.fragments.details : []

  const contentH = _goComputeContentH(g, S)
  const marginBottom = 10 * S
  const screenBottom = H - marginBottom
  let viewportH = contentH
  let scrollMax = 0
  if (panelTop + contentH > screenBottom) {
    const avail = Math.max(0, screenBottom - panelTop)
    viewportH = Math.min(contentH, Math.max(100 * S, avail))
    scrollMax = Math.max(0, contentH - viewportH)
  }
  if (_goScrollY > scrollMax) _goScrollY = scrollMax
  if (_goScrollY < 0) _goScrollY = 0
  const scroll = _goScrollY
  _goScrollMax = scrollMax
  _goScrollViewport = scrollMax > 0 ? [px, panelTop, pw, viewportH] : null

  c.save()
  c.globalAlpha = fadeIn
  R.drawInfoPanel(px, panelTop, pw, viewportH)

  c.save()
  R.rr(px, panelTop, pw, viewportH, panelRad)
  c.clip()
  c.translate(0, -scroll)

  let cy = panelTop + pad * 0.6
  let rowIdx = 0

  function _rowAlpha(idx) {
    const delay = 12 + idx * 5
    return Math.min(1, Math.max(0, (at - delay) / 12))
  }

  // === 上场灵兽 ===
  const teamAlpha = _rowAlpha(rowIdx++)
  c.save(); c.globalAlpha *= teamAlpha
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#8B7355'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText('上场灵兽', W * 0.5, cy + 6 * S)
  cy += 20 * S

  g.pets.forEach((p, i) => {
    const ac = ATTR_COLOR[p.attr]
    const rv = RARITY_VISUAL[getPetRarity(p.id)] || RARITY_VISUAL.R
    const petNameX = px + pad + (i + 0.5) * (innerW / g.pets.length)
    const petNameY = cy + 6 * S
    c.fillStyle = ac ? ac.main : '#666'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(p.name, petNameX, petNameY)
    const nameW2 = c.measureText(p.name).width
    c.strokeStyle = rv.borderColor; c.lineWidth = 1.5 * S
    c.beginPath()
    c.moveTo(petNameX - nameW2 / 2, petNameY + 7 * S)
    c.lineTo(petNameX + nameW2 / 2, petNameY + 7 * S)
    c.stroke()
  })
  cy += 24 * S

  if (g.weapon) {
    c.font = `${11*S}px "PingFang SC",sans-serif`; c.textAlign = 'center'
    c.fillStyle = '#B8860B'
    c.fillText(`法宝·${g.weapon.name}`, W * 0.5, cy + 6 * S)
    cy += 22 * S
  }

  c.fillStyle = '#A09070'; c.font = `${10*S}px "PingFang SC",sans-serif`; c.textAlign = 'center'
  c.fillText(`灵兽背包：${g.petBag.length}只  法宝背包：${g.weaponBag.length}件`, W * 0.5, cy + 6 * S)
  cy += 20 * S
  c.restore()

  cy += 4 * S
  c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
  cy += 8 * S

  // === 修炼经验 ===
  if (cultFinal > 0) {
    const expAlpha = _rowAlpha(rowIdx++)
    c.save(); c.globalAlpha *= expAlpha
    drawRewardRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${cultFinal}`, '#8B7355', '#B8860B')
    c.restore()
    cy += 28 * S

    const d = g._lastRunExpDetail
    if (d) {
      c.fillStyle = '#A09070'; c.font = `${9*S}px "PingFang SC",sans-serif`; c.textAlign = 'center'
      const details = []
      if (d.elimExp > 0) details.push(`消除+${d.elimExp}`)
      if (d.comboExp > 0) details.push(`连击+${d.comboExp}`)
      if (d.killExp > 0) details.push(`击杀+${d.killExp}`)
      if (d.layerExp > 0) details.push(`层数+${d.layerExp}`)
      if (d.clearBonus > 0) details.push(`通关+${d.clearBonus}`)
      c.fillText(details.join('  '), W * 0.5, cy + 6 * S)
      cy += 18 * S
      if (!d.isCleared) {
        c.fillStyle = '#B0967A'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText('(未通关保底 60%)', W * 0.5, cy + 4 * S)
        cy += 16 * S
      }
    }

    const cult = g.storage.cultivation
    const levelUps = sr ? sr.cultExp.levelUps : (g._lastRunLevelUps || 0)
    if (levelUps > 0) {
      const prev = sr ? sr.cultExp.prevLevel : (g._lastRunPrevLevel || 0)
      const { drawCultLvUpRow, drawCultSubRealmUpRow } = require('./cultFeedbackUi')
      drawCultLvUpRow(c, R, S, W * 0.5, cy + 2 * S, prev, cult.level, levelUps)
      cy += 20 * S
      // 通天塔结算：小阶跨档金光行（大境界已走全屏仪式）
      const realmUp = g._lastRunRealmUp
      if (realmUp && realmUp.kind === 'minor') {
        drawCultSubRealmUpRow(c, R, S, W * 0.5, cy, realmUp.curr.fullName)
        cy += 20 * S
      }
    }

    const barX = px + pad, barW = innerW, barH = 7 * S
    c.fillStyle = 'rgba(0,0,0,0.06)'
    R.rr(barX, cy, barW, barH, barH / 2); c.fill()
    if (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      const pct = Math.min(cult.exp / needed, 1)
      if (pct > 0) {
        const fillW = Math.max(barH, barW * pct)
        const barGrad = c.createLinearGradient(barX, cy, barX + fillW, cy)
        barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
        c.fillStyle = barGrad
        R.rr(barX, cy, fillW, barH, barH / 2); c.fill()
      }
      c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level}  ${cult.exp}/${needed}  ${getRealmByLv(cult.level).fullName}`, px + pw - pad, cy + barH + 9 * S)
    } else {
      const barGrad = c.createLinearGradient(barX, cy, barX + barW, cy)
      barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
      c.fillStyle = barGrad
      R.rr(barX, cy, barW, barH, barH / 2); c.fill()
      c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level} 已满级  ${getRealmByLv(cult.level).fullName}`, px + pw - pad, cy + barH + 9 * S)
    }
    cy += 24 * S
  }

  // === 灵石 ===
  if (soulStoneFinal > 0) {
    const ssAlpha = _rowAlpha(rowIdx++)
    c.save(); c.globalAlpha *= ssAlpha
    drawRewardRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${soulStoneFinal}`, '#5577AA', '#3366AA')
    c.restore()
    cy += 32 * S
  }

  // === 碎片奖励（带宠物头像和进度） ===
  if (fragFinal > 0) {
    const fragAlpha = _rowAlpha(rowIdx++)
    c.save(); c.globalAlpha *= fragAlpha
    drawRewardRow(c, R, S, px + pad, cy, innerW, 'frame_fragment', '灵宠碎片', `+${fragFinal}`, '#7B5EA7', '#9B59B6')
    c.restore()
    cy += 28 * S

    if (fragDetails.length > 0) {
      for (const fd of fragDetails) {
        const fdAlpha = _rowAlpha(rowIdx++)
        c.save(); c.globalAlpha *= fdAlpha
        const pet = getPetById(fd.petId)
        const rv = RARITY_VISUAL[getPetRarity(fd.petId)] || RARITY_VISUAL.R
        const ac = pet ? (ATTR_COLOR[pet.attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
        const iconSz = 20 * S
        const iconX = px + pad + 4 * S
        const iconCY = cy + 2 * S

        const avatarPath = pet ? require('../data/pets').getPetAvatarPath({ ...pet, star: 1 }) : null
        if (avatarPath) {
          R.drawCoverImg(R.getImg(avatarPath), iconX, iconCY, iconSz, iconSz, { radius: 4 * S, strokeStyle: ac.main, strokeWidth: 1.2 })
        }

        c.textAlign = 'left'; c.textBaseline = 'middle'
        c.fillStyle = rv.borderColor; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
        c.fillText(`${pet ? pet.name : fd.petId}碎片`, iconX + iconSz + 6 * S, iconCY + iconSz / 2 - 2 * S)

        c.fillStyle = ac.main; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
        c.textAlign = 'right'
        c.fillText(`×${fd.count}`, px + pw - pad, iconCY + iconSz / 2 - 2 * S)

        const poolPet = g.storage.getPoolPet(fd.petId)
        if (poolPet && POOL_STAR_FRAG_COST) {
          const nextStar = poolPet.star + 1
          const cost = POOL_STAR_FRAG_COST[nextStar]
          if (cost) {
            const current = poolPet.fragments || 0
            c.textAlign = 'left'
            c.fillStyle = current >= cost ? ac.main : '#A09070'
            c.font = `${8*S}px "PingFang SC",sans-serif`
            const progressText = current >= cost ? `碎片足够升${nextStar}★！` : `升${nextStar}★ 进度 ${current}/${cost}`
            c.fillText(progressText, iconX + iconSz + 6 * S, iconCY + iconSz / 2 + 9 * S)
          }
        }

        c.restore()
        cy += 24 * S
      }
      cy += 4 * S
    }
  }

  // === 本局新获法宝 ===
  const newWpns = sr && sr.newWeapons && sr.newWeapons.length > 0 ? sr.newWeapons : null
  if (newWpns) {
    const wpnAlpha = _rowAlpha(rowIdx++)
    c.save(); c.globalAlpha *= wpnAlpha
    drawRewardRow(c, R, S, px + pad, cy, innerW, 'icon_weapon', '本局新获法宝', `${newWpns.length}件`, '#B8860B', '#B8860B')
    cy += 28 * S
    c.textAlign = 'center'; c.fillStyle = '#B8860B'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(newWpns.map(w => w.name).join('、'), W * 0.5, cy + 4 * S)
    c.restore()
    cy += 20 * S
  }

  // === 通天塔活动里程碑奖励 ===
  const eventRewards = g._lastRunEventRewards || []
  if (eventRewards.length > 0) {
    cy += 4 * S
    c.strokeStyle = 'rgba(200,160,80,0.4)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 8 * S

    const evtTitleAlpha = _rowAlpha(rowIdx++)
    c.save(); c.globalAlpha *= evtTitleAlpha
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#E8C547'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.save(); c.shadowColor = 'rgba(255,200,0,0.3)'; c.shadowBlur = 6 * S
    c.fillText('🎉 本局里程碑奖励回顾', W * 0.5, cy + 6 * S)
    c.restore()
    c.restore()
    cy += 24 * S

    for (const er of eventRewards) {
      const erAlpha = _rowAlpha(rowIdx++)
      c.save(); c.globalAlpha *= erAlpha
      const pet = getPetById(er.petId)
      const petName = pet ? pet.name : er.petId
      const ac = pet ? (ATTR_COLOR[pet.attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
      const iconSz = 24 * S
      const iconX = px + pad + 4 * S
      const iconCY = cy

      const avatarPath = pet ? require('../data/pets').getPetAvatarPath({ ...pet, star: 1 }) : null
      if (avatarPath) {
        R.drawCoverImg(R.getImg(avatarPath), iconX, iconCY, iconSz, iconSz, { radius: 4 * S, strokeStyle: ac.main, strokeWidth: 1.5 })
      }

      c.textAlign = 'left'; c.textBaseline = 'middle'
      if (er.type === 'ssrPet') {
        c.fillStyle = '#FFD700'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
        c.fillText(`SSR 整宠「${petName}」`, iconX + iconSz + 8 * S, iconCY + iconSz / 2)
        c.textAlign = 'right'; c.fillStyle = '#E8C547'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
        c.fillText(`${er.floor}层 通关奖励`, px + pw - pad, iconCY + iconSz / 2)
      } else {
        const label = er.type === 'srFrag' ? 'SR' : 'SSR'
        c.fillStyle = er.type === 'ssrFrag' ? '#E8C547' : '#B0A0FF'
        c.font = `bold ${10*S}px "PingFang SC",sans-serif`
        c.fillText(`${label}「${petName}」碎片 ×${er.count}`, iconX + iconSz + 8 * S, iconCY + iconSz / 2)
        c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText(`${er.floor}层 里程碑`, px + pw - pad, iconCY + iconSz / 2)
      }
      c.restore()
      cy += 30 * S
    }
    cy += 4 * S
  }

  // === 汇总行 ===
  const sumAlpha = _rowAlpha(rowIdx++)
  if (sumAlpha > 0) {
    c.save(); c.globalAlpha *= sumAlpha
    const sumParts = []
    if (soulStoneFinal > 0) sumParts.push(`灵石 +${soulStoneFinal}`)
    if (fragFinal > 0) sumParts.push(`碎片 +${fragFinal}`)
    if (cultFinal > 0) sumParts.push(`经验 +${cultFinal}`)
    if (sumParts.length > 0) {
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#A09070'; c.font = `${8.5*S}px "PingFang SC",sans-serif`
      c.fillText(`本次共获得：${sumParts.join('、')}`, W / 2, cy + 6 * S)
    }
    c.restore()
  }
  cy += 24 * S

  // === 看广告奖励翻倍 ===
  g._goAdDoubleBtnRect = null
  if (!g._goAdDoubled && AdManager.canShow('settleDouble')) {
    const adBtnW = innerW * 0.7, adBtnH = 36 * S
    const adBtnX = (W - adBtnW) / 2, adBtnY = cy
    R.drawDialogBtn(adBtnX, adBtnY, adBtnW, adBtnH, '▶ 看广告 灵石/碎片翻倍', 'adReward')
    g._goAdDoubleBtnRect = [adBtnX, adBtnY - scroll, adBtnW, adBtnH]
    cy += 44 * S
  } else if (g._goAdDoubled) {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#60A060'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('✓ 奖励已翻倍', W / 2, cy + 10 * S)
    cy += 28 * S
  }

  // === 排行榜·我第 N 名 · 挂件（通天塔榜入口）===
  g._goRankWidget = null
  const towerMyRank = g.storage.rankAllMyRank
  if (towerMyRank && towerMyRank > 0) {
    const rwt = require('./rankWidget').drawRankWidget(c, R, S, px + pad, cy + 2 * S, innerW, 'tower', towerMyRank)
    if (rwt) {
      // 存储去 scroll 后的实际屏幕坐标，便于命中测试
      const screenRect = [rwt.rect[0], rwt.rect[1] - scroll, rwt.rect[2], rwt.rect[3]]
      g._goRankWidget = {
        rect: screenRect,
        tab: rwt.tab,
      }
      // 未授权时盖原生授权按钮（和结算页同口径），点挂件 = 微信原生授权弹窗
      if (g.storage.needsRealNameCta && g.storage.needsRealNameCta()) {
        g._rankEntryAuth = { rect: screenRect, tab: rwt.tab }
      }
      cy += rwt.height + 10 * S
    }
  }

  // === 底部按钮 ===
  cy += 6 * S
  const btnH = 38 * S
  const btnGap = 12 * S
  const btnW2 = (innerW - btnGap) / 2
  const btnLeftX = px + pad, btnRightX = btnLeftX + btnW2 + btnGap

  R.drawDialogBtn(btnLeftX, cy, btnW2, btnH, '返回', 'cancel')
  g._goHomeBtnRect = [btnLeftX, cy - scroll, btnW2, btnH]

  R.drawDialogBtn(btnRightX, cy, btnW2, btnH, g.cleared ? '再次挑战' : '重新挑战', 'confirm')
  g._goBtnRect = [btnRightX, cy - scroll, btnW2, btnH]
  cy += btnH + 8 * S

  // 快捷按钮行
  const quickBtns = []
  if (cultFinal > 0) {
    const { hasCultUpgradeAvailable } = require('../logic/cultivationLogic')
    if (hasCultUpgradeAvailable(g.storage)) quickBtns.push({ label: '前往修炼', key: 'cult' })
  }
  if (soulStoneFinal > 0 && g.storage.petPoolCount > 0) quickBtns.push({ label: '前往灵宠', key: 'pet' })

  g._cultBtnRect = null
  g._petPoolBtnRect = null

  if (quickBtns.length > 0) {
    const qGap = 10 * S
    const qBtnW = quickBtns.length > 1 ? (innerW - qGap) / 2 : innerW * 0.5
    const qBtnH = 32 * S
    let qx = quickBtns.length > 1 ? px + pad : (W - qBtnW) / 2
    for (const qb of quickBtns) {
      R.drawDialogBtn(qx, cy, qBtnW, qBtnH, qb.label, 'cancel')
      if (qb.key === 'cult') g._cultBtnRect = [qx, cy - scroll, qBtnW, qBtnH]
      if (qb.key === 'pet') g._petPoolBtnRect = [qx, cy - scroll, qBtnW, qBtnH]
      qx += qBtnW + qGap
    }
    cy += qBtnH + 8 * S
  }

  // 分享炫耀
  g._goShareBtnRect = null
  if (g.cleared) {
    const shareBtnW = innerW * 0.5, shareBtnH = 28 * S
    const shareBtnX = (W - shareBtnW) / 2, shareBtnY = cy
    R.drawDialogBtn(shareBtnX, shareBtnY, shareBtnW, shareBtnH, '📤 分享炫耀', 'gold')
    g._goShareBtnRect = [shareBtnX, shareBtnY - scroll, shareBtnW, shareBtnH]
  }

  c.restore()

  // 滚动条
  if (scrollMax > 0) {
    const trackX = px + pw - 5 * S
    const trackY = panelTop + 8 * S
    const trackH = viewportH - 16 * S
    const thumbH = Math.max(22 * S, (viewportH / contentH) * trackH)
    const thumbTravel = Math.max(0, trackH - thumbH)
    const thumbY = trackY + (scrollMax > 0 ? (scroll / scrollMax) * thumbTravel : 0)
    c.fillStyle = 'rgba(90,70,50,0.2)'
    R.rr(trackX - 2 * S, trackY, 4 * S, trackH, 2 * S); c.fill()
    c.fillStyle = 'rgba(170,130,70,0.55)'
    R.rr(trackX - 2 * S, thumbY, 4 * S, thumbH, 2 * S); c.fill()
  }

  c.restore()
}

// drawRewardRow 已抽取到 uiComponents.js

// ===== Ranking =====
/**
 * 信息架构（2026-04 重构）：
 *   顶层：全服 / 好友（rankSource）—— 数据来源
 *   次级：秘境 / 通天塔 / 图鉴 / 连击（rankTab）—— 维度
 *   三级：本周/总榜（period，仅 source=all+tab=tower）
 *        同境界/全服（scope，仅 source=all+tab∈{stage,tower}）
 *   好友榜下不显示 period 和 scope 子 Tab，微信关系链无"本周""同境界"概念
 */
const _RANK_TABS = [
  { key: 'stage',  label: '秘境榜' },
  { key: 'tower',  label: '通天塔' },
  { key: 'dex',    label: '图鉴榜' },
  { key: 'combo',  label: '连击榜' },
]
const _RANK_LIST_MAP = { stage: 'rankStageList', tower: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
const _RANK_MY_MAP   = { stage: 'rankStageMyRank', tower: 'rankAllMyRank', dex: 'rankDexMyRank', combo: 'rankComboMyRank' }

/** 顶层数据源 */
const _RANK_SOURCES = [
  { key: 'all',    label: '全服' },
  { key: 'friend', label: '好友' },
]

// 通天塔周期子 Tab（仅 rankTab==='tower' 时显示）
const _RANK_TOWER_PERIODS = [
  { key: 'weekly', label: '本周' },
  { key: 'all', label: '总榜' },
]

/**
 * 计算当前 tab 的 list/myRank 实际读取的 storage 字段
 *   · 通天塔周榜：读 rankAllWeeklyList / rankAllWeeklyMyRank
 *   · 同境界档位榜（scope='tier'）：读对应 Tier 专用字段
 * 注意：只有秘境榜（stage）支持 tier 档位榜，通天塔后续走"仅限二星宠"平衡模式自身就均衡
 */
function _resolveRankKeys(g, tab) {
  const scope = g.rankScope || 'all'
  const useTier = scope === 'tier' && tab === 'stage'
  if (tab === 'tower' && g.rankTowerPeriod === 'weekly') {
    return { listKey: 'rankAllWeeklyList', myKey: 'rankAllWeeklyMyRank' }
  }
  if (useTier && tab === 'stage') {
    return { listKey: 'rankStageTierList', myKey: 'rankStageTierMyRank' }
  }
  return { listKey: _RANK_LIST_MAP[tab], myKey: _RANK_MY_MAP[tab] }
}

/** 对应 fetchRanking(tab) 的 tab 名：通天塔周榜走 'towerWeekly' */
function _resolveFetchTab(g, tab) {
  if (tab === 'tower' && g.rankTowerPeriod === 'weekly') return 'towerWeekly'
  return tab
}

/** 档位榜子 Tab 暂时整体隐藏：
 *   · DAU 不足时分档 = 让每个档位看起来更冷清，反而伤留存
 *   · 云端 realmTier 字段仍继续写入（_updateStageRanking / submit 都保留），后面人气起来随时能再开
 *   · 返回 false 时，所有相关调用会自动级联退化为 scope='all'（_effectiveScope / useTier / fetch 参数均已就位）
 */
function _supportsTierScope(/* tab */) {
  return false
}

/** 榜单 tab 的人读标签（UI 展示 & 语音文案） */
const _RANK_TAB_LABEL = {
  stage: '秘境榜',
  tower: '通天塔总榜',
  towerWeekly: '通天塔周榜',
  dex: '图鉴榜',
  combo: '连击榜',
}

/**
 * D3：把 RankingService 算出的 feedback 落到 UI（lingCheer 头条 / gameToast 短提示）
 * 优先级：里程碑（首次 top1/3/10）→ 飞升（≥5 位）→ 普通上升 → 首次上榜。下降不打扰。
 */
function _applyRankingFeedback(g, fb) {
  if (!fb || !fb.events || !fb.events.length) return
  const storage = g.storage
  const lingCheer = require('./lingCheer')
  const gameToast = require('./gameToast')
  const { LING } = require('../data/lingIdentity')
  const tabLabel = _RANK_TAB_LABEL[fb.tab] || '榜单'
  const avatar = (LING && LING.avatar) || null

  // 1. 里程碑（一生首次达成 top1/3/10）走 lingCheer + 持久去重
  const milestones = [
    { level: 'top1', hit: fb.events.includes('top1'), text: `登顶${tabLabel}！第 1 名！` },
    { level: 'top3', hit: fb.events.includes('top3'), text: `${tabLabel} · 冲进前三！第 ${fb.curr} 名` },
    { level: 'top10', hit: fb.events.includes('top10'), text: `${tabLabel} · 跻身前十！第 ${fb.curr} 名` },
  ]
  for (const m of milestones) {
    if (!m.hit) continue
    if (storage.hasRankMilestone(fb.tab, m.level)) continue
    if (storage.markRankMilestone(fb.tab, m.level)) {
      lingCheer.show(m.text, { tone: 'epic', avatar, duration: 2600 })
      return
    }
  }

  // 2. 大幅上升（≥5）也给一次 lingCheer，玩家会有冲榜爽感
  if (fb.delta >= 5) {
    lingCheer.show(`${tabLabel} · 飞升 ${fb.delta} 位 → 第 ${fb.curr} 名`, { tone: 'info', avatar, duration: 2200 })
    return
  }

  // 3. 普通上升 → 小 toast
  if (fb.delta > 0) {
    gameToast.show(`${tabLabel} · ↑ ${fb.delta} 位 · 第 ${fb.curr} 名`, { type: 'achievement', duration: 1800 })
    return
  }

  // 4. 首次上榜 → 小 toast（温和）
  if (fb.events.includes('firstTime')) {
    gameToast.show(`${tabLabel} · 首次上榜 · 第 ${fb.curr} 名`, { type: 'achievement', duration: 1800 })
  }
  // 下降不提示
}

function rRanking(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = 'rgba(240,228,200,0.18)'; ctx.fillRect(0, 0, W, H)

  const padX = 12*S
  let tab = g.rankTab || 'stage'
  // tab 校验：不在维度映射里的统一归位到 tower
  if (tab === 'all' || tab === 'friend' || !_RANK_LIST_MAP[tab]) {
    tab = 'tower'; g.rankTab = 'tower'
  }
  // 数据源校验
  const source = g.rankSource === 'friend' ? 'friend' : 'all'
  g.rankSource = source
  const isFriendSrc = source === 'friend'

  // D3：名次对比反馈消费一次（进入/刷新/切 tab 后 fetchRanking 会写入 pendingFeedback）
  if (g.storage.pendingRankingFeedback) {
    const fb = g.storage.consumeRankingFeedback()
    _applyRankingFeedback(g, fb)
  }

  drawPageTitle(ctx, R, W, S, W * 0.5, safeTop + 40 * S, '排行榜')

  // 刷新按钮
  const rfW = 40*S, rfH = 22*S
  const rfX = W - rfW - 14*S, rfY = safeTop + 29 * S
  ctx.save()
  ctx.fillStyle = g.storage.rankLoading ? 'rgba(200,158,60,0.3)' : 'rgba(200,158,60,0.85)'
  R.rr(rfX, rfY, rfW, rfH, rfH*0.5); ctx.fill()
  ctx.strokeStyle = 'rgba(160,120,30,0.4)'; ctx.lineWidth = 1*S
  R.rr(rfX, rfY, rfW, rfH, rfH*0.5); ctx.stroke()
  ctx.fillStyle = g.storage.rankLoading ? 'rgba(60,35,0,0.4)' : '#3a1a00'
  ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(g.storage.rankLoading ? '刷新中…' : '刷新', rfX + rfW/2, rfY + rfH/2)
  ctx.restore()
  g._rankRefreshRect = [rfX, rfY, rfW, rfH]

  // ── 顶层数据源：全服 / 好友（分段胶囊，置于所有 Tab 之上）──
  const sourceTabY = safeTop + 66 * S
  const sourceTabH = 22 * S
  const sourceTotalW = W - padX * 2
  const sourceGap = 4 * S
  const sourceSingleW = (sourceTotalW - sourceGap) / 2
  g._rankSourceTabRects = {}
  _RANK_SOURCES.forEach((so, i) => {
    const sx = padX + i * (sourceSingleW + sourceGap)
    const isActive = source === so.key
    ctx.save()
    if (isActive) {
      // 好友 / 全服 用同一套暖金配色，与下方维度主 Tab 保持和谐
      const sg = ctx.createLinearGradient(sx, sourceTabY, sx, sourceTabY + sourceTabH)
      sg.addColorStop(0, 'rgba(240,196,80,0.95)')
      sg.addColorStop(1, 'rgba(200,140,50,0.9)')
      ctx.fillStyle = sg
    } else {
      ctx.fillStyle = 'rgba(200,158,60,0.10)'
    }
    R.rr(sx, sourceTabY, sourceSingleW, sourceTabH, sourceTabH * 0.5); ctx.fill()
    ctx.strokeStyle = isActive ? 'rgba(160,100,20,0.55)' : 'rgba(200,158,60,0.3)'
    ctx.lineWidth = 1 * S
    R.rr(sx, sourceTabY, sourceSingleW, sourceTabH, sourceTabH * 0.5); ctx.stroke()
    ctx.fillStyle = isActive ? '#2a1a00' : '#6B5B40'
    ctx.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(so.label, sx + sourceSingleW * 0.5, sourceTabY + sourceTabH * 0.5)
    ctx.restore()
    g._rankSourceTabRects[so.key] = [sx, sourceTabY, sourceSingleW, sourceTabH]
  })

  // ── 维度 Tab 切换栏（4个：秘境/通天塔/图鉴/连击）──
  const tabY = sourceTabY + sourceTabH + 8 * S, tabH = 30*S
  const tabGap = 5*S
  const totalTabW = W - padX*2 - tabGap*(_RANK_TABS.length-1)
  const singleTabW = totalTabW / _RANK_TABS.length
  g._rankTabRects = {}
  _RANK_TABS.forEach((t, i) => {
    const tx = padX + i * (singleTabW + tabGap)
    const isActive = tab === t.key
    if (isActive) {
      const tg = ctx.createLinearGradient(tx, tabY, tx, tabY + tabH)
      tg.addColorStop(0, '#f0c040'); tg.addColorStop(1, '#d4a020')
      ctx.fillStyle = tg
    } else {
      ctx.fillStyle = 'rgba(200,158,60,0.14)'
    }
    R.rr(tx, tabY, singleTabW, tabH, tabH*0.5); ctx.fill()
    ctx.strokeStyle = isActive ? 'rgba(200,140,30,0.5)' : 'rgba(200,158,60,0.3)'
    ctx.lineWidth = 1*S; R.rr(tx, tabY, singleTabW, tabH, tabH*0.5); ctx.stroke()
    ctx.fillStyle = isActive ? '#2a1a00' : '#6B5B40'
    ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(t.label, tx + singleTabW*0.5, tabY + tabH*0.66)
    g._rankTabRects[t.key] = [tx, tabY, singleTabW, tabH]
  })

  // ── 通天塔子 Tab：本周 / 总榜（仅 全服-通天塔 显示；好友榜走微信关系链，无周期概念）──
  const showPeriodTabs = !isFriendSrc && tab === 'tower'
  const subTabH = 22 * S
  const subTabY = tabY + tabH + 6 * S
  g._rankPeriodTabRects = {}
  if (showPeriodTabs) {
    const period = g.rankTowerPeriod || 'weekly'
    const subTotalW = W - padX * 2
    const subGap = 4 * S
    const subSingleW = (subTotalW - subGap) / _RANK_TOWER_PERIODS.length * 0.48  // 两个胶囊靠左，留空给期号
    _RANK_TOWER_PERIODS.forEach((pt, i) => {
      const stx = padX + i * (subSingleW + subGap)
      const isActive = period === pt.key
      ctx.save()
      ctx.fillStyle = isActive ? 'rgba(200,158,60,0.9)' : 'rgba(200,158,60,0.12)'
      R.rr(stx, subTabY, subSingleW, subTabH, subTabH * 0.5); ctx.fill()
      ctx.strokeStyle = isActive ? 'rgba(160,110,20,0.55)' : 'rgba(200,158,60,0.3)'
      ctx.lineWidth = 1 * S
      R.rr(stx, subTabY, subSingleW, subTabH, subTabH * 0.5); ctx.stroke()
      ctx.fillStyle = isActive ? '#fff7d6' : '#6B5B40'
      ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(pt.label, stx + subSingleW * 0.5, subTabY + subTabH * 0.5)
      ctx.restore()
      g._rankPeriodTabRects[pt.key] = [stx, subTabY, subSingleW, subTabH]
    })
    // 右侧期号提示（周榜显示 "2026-W16 周榜进行中"）
    if (period === 'weekly') {
      const pk = g.storage.rankAllWeeklyPeriodKey || ''
      const label = pk ? `${pk} 周榜进行中` : '本周榜进行中'
      ctx.save()
      ctx.fillStyle = '#8B7060'
      ctx.font = `${9 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillText(label, W - padX, subTabY + subTabH * 0.5)
      ctx.restore()
    }
  }

  // ── 档位子 Tab：全服 / 同境界（仅 全服数据源 + stage/tower 显示）──
  const showScopeTabs = !isFriendSrc && _supportsTierScope(tab)
  const scopeTabY = (showPeriodTabs ? subTabY + subTabH : tabY + tabH) + 6 * S
  const scopeTabH = 22 * S
  g._rankScopeTabRects = {}
  if (showScopeTabs) {
    const scope = g.rankScope || 'all'
    const realmTier = g.storage.rankCurrentTier || require('../data/realmTier').getRealmTier(g.storage.cultLv || 0)
    const tierName = require('../data/realmTier').getTierName(realmTier)
    const scopeOptions = [
      { key: 'all', label: '全档位' },
      { key: 'tier', label: `同境界 · ${tierName}` },
    ]
    const stotalW = W - padX * 2
    const sgap = 4 * S
    const ssingleW = (stotalW - sgap) / 2
    scopeOptions.forEach((so, i) => {
      const sx = padX + i * (ssingleW + sgap)
      const isActive = scope === so.key
      ctx.save()
      ctx.fillStyle = isActive ? 'rgba(170,120,200,0.85)' : 'rgba(170,120,200,0.12)'
      R.rr(sx, scopeTabY, ssingleW, scopeTabH, scopeTabH * 0.5); ctx.fill()
      ctx.strokeStyle = isActive ? 'rgba(120,70,160,0.6)' : 'rgba(170,120,200,0.3)'
      ctx.lineWidth = 1 * S
      R.rr(sx, scopeTabY, ssingleW, scopeTabH, scopeTabH * 0.5); ctx.stroke()
      ctx.fillStyle = isActive ? '#fff5ff' : '#6B4E85'
      ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(so.label, sx + ssingleW * 0.5, scopeTabY + scopeTabH * 0.5)
      ctx.restore()
      g._rankScopeTabRects[so.key] = [sx, scopeTabY, ssingleW, scopeTabH]
    })
  }

  // 好友榜不再有独立子 Tab（顶层已切换到"好友"数据源，维度 Tab 与全服共用）
  g._rankFriendSubTabRects = {}

  // ── CTA：未授权/匿名玩家引导换头像昵称 ──
  const baseAfterTabs = showScopeTabs
    ? scopeTabY + scopeTabH
    : (showPeriodTabs ? subTabY + subTabH : tabY + tabH)
  const needsCta = !!(g.storage.needsRealNameCta && g.storage.needsRealNameCta())
  const ctaH = needsCta ? 28 * S : 0
  if (needsCta) {
    const ctaY = baseAfterTabs + 6 * S
    const ctaW = W - padX * 2
    const ctaR = ctaH * 0.4
    const ctaBg = ctx.createLinearGradient(padX, ctaY, padX, ctaY + ctaH)
    ctaBg.addColorStop(0, 'rgba(240,196,80,0.28)')
    ctaBg.addColorStop(1, 'rgba(200,140,50,0.18)')
    ctx.fillStyle = ctaBg
    R.rr(padX, ctaY, ctaW, ctaH, ctaR); ctx.fill()
    ctx.strokeStyle = 'rgba(200,140,30,0.5)'; ctx.lineWidth = 1 * S
    R.rr(padX, ctaY, ctaW, ctaH, ctaR); ctx.stroke()
    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#6b4500'
    ctx.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText('设置真实头像昵称，让朋友认出你', padX + 12 * S, ctaY + ctaH / 2)
    ctx.fillStyle = '#8B5E1B'
    ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('去设置 >', W - padX - 12 * S, ctaY + ctaH / 2)
    ctx.restore()
    g._rankCtaRect = [padX, ctaY, ctaW, ctaH]
  } else {
    g._rankCtaRect = null
  }

  // ── 列表区域 ──
  const listTop = baseAfterTabs + 8 * S + ctaH
  const myBarH = 52*S
  const isFriend = isFriendSrc
  // 好友榜没有 myRank 栏（数据在 openDataContext 沙箱里不可直接读取），列表占满下半屏
  const listBottom = isFriend ? H - 16*S : H - myBarH - 16*S
  const rowH = 64*S

  const { listKey, myKey } = isFriend
    ? { listKey: null, myKey: null }
    : _resolveRankKeys(g, tab)
  const list = isFriend ? [] : (g.storage[listKey] || [])
  const myRank = isFriend ? -1 : (g.storage[myKey] || -1)

  // 列表面板背景
  const lpbg = ctx.createLinearGradient(padX, listTop, padX, listBottom)
  lpbg.addColorStop(0, 'rgba(252,246,228,0.96)'); lpbg.addColorStop(1, 'rgba(244,234,208,0.96)')
  ctx.fillStyle = lpbg; R.rr(padX, listTop, W - padX*2, listBottom - listTop, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(200,160,60,0.4)'; ctx.lineWidth = 1*S
  R.rr(padX, listTop, W - padX*2, listBottom - listTop, 10*S); ctx.stroke()

  // 表头
  const headerH = 26*S
  const headerGrd = ctx.createLinearGradient(padX, listTop, padX + (W-padX*2), listTop)
  headerGrd.addColorStop(0, 'rgba(200,158,60,0.18)'); headerGrd.addColorStop(1, 'rgba(228,185,80,0.12)')
  ctx.fillStyle = headerGrd
  R.rr(padX + 1, listTop + 1, W - padX*2 - 2, headerH, 8*S); ctx.fill()
  ctx.fillStyle = '#8B7060'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'; ctx.fillText('排名', padX + 10*S, listTop + 17*S)
  ctx.fillText('玩家', padX + 52*S, listTop + 17*S)
  ctx.textAlign = 'right'
  const headerLabels = { stage: '总星数', tower: '成绩', dex: '精通数', combo: '最高连击' }
  const friendHeaderLabel = { tower: '层数', stage: '★', dex: '精通', combo: '连击' }[tab]
  ctx.fillText(isFriend ? (friendHeaderLabel || '成绩') : (headerLabels[tab] || '成绩'), W - padX - 10*S, listTop + 17*S)

  const contentTop = listTop + headerH + 2*S

  // 暴露列表真实布局给 touch 层（tRanking 用它算 minScroll，避免硬编码导致"拖不满"）
  // 必须晚于 headerH / contentTop 声明，否则 TDZ 会让 visibleH=NaN 把 scrollY 污染成 NaN → 滚动失效
  g._rankListContentTop = contentTop
  g._rankListVisibleH = Math.max(0, listBottom - contentTop - 4*S)
  g._rankRowH = rowH

  // 好友榜：内容来自 openDataContext（独立沙箱），这里只负责 drawImage sharedCanvas
  if (isFriend) {
    _drawFriendTabContent(g, ctx, tab, padX, contentTop, W - padX*2, listBottom - contentTop - 4*S)
    drawBackBtn(g)
    return
  }

  ctx.save()
  ctx.beginPath(); ctx.rect(padX, contentTop, W - padX*2, listBottom - contentTop - 4*S); ctx.clip()

  if (g.storage.rankLoading && list.length === 0) {
    ctx.fillStyle = '#8B7060'; ctx.font = `${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(g.storage.rankLoadingMsg || '加载中...', W*0.5, contentTop + 60*S)
    const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4)
    ctx.fillStyle = '#b0a090'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(dots, W*0.5, contentTop + 85*S)
  } else if (list.length === 0) {
    ctx.fillStyle = '#8B7060'; ctx.font = `${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('暂无数据', W*0.5, contentTop + 60*S)
  } else {
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const ry = contentTop + i * rowH + (g.rankScrollY || 0)
      if (ry + rowH < contentTop || ry > listBottom) continue

      if (i < 3) {
        const rowGradColors = [
          ['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.06)'],
          ['rgba(190,190,200,0.14)', 'rgba(190,190,200,0.04)'],
          ['rgba(180,110,40,0.14)', 'rgba(180,110,40,0.04)'],
        ]
        const rg = ctx.createLinearGradient(padX, ry, W - padX, ry)
        rg.addColorStop(0, rowGradColors[i][0]); rg.addColorStop(1, rowGradColors[i][1])
        ctx.fillStyle = rg
      } else {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(200,158,60,0.04)' : 'rgba(0,0,0,0.02)'
      }
      ctx.fillRect(padX + 2*S, ry + 1*S, W - padX*2 - 4*S, rowH - 3*S)

      _drawRankMedal(ctx, R, TH, S, padX, ry, rowH, i)

      const avatarX = padX + 40*S, avatarY = ry + (rowH - 34*S)/2, avatarSz = 34*S
      _drawAvatar(ctx, R, TH, S, item.avatarUrl, avatarX, avatarY, avatarSz, i)

      const textX = avatarX + avatarSz + 8*S
      ctx.textAlign = 'left'
      ctx.fillStyle = i < 3 ? '#7A4800' : '#3a1a00'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.fillText((item.nickName || '修士').substring(0, 8), textX, ry + 26*S)

      ctx.fillStyle = '#8B7060'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      const valRight = W - padX - 12*S

      if (tab === 'stage') {
        ctx.fillText(formatRankStageProgressSubtitle(item), textX, ry + 44*S)
        ctx.textAlign = 'right'
        ctx.fillStyle = i < 3 ? '#ffd700' : '#e88520'; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        ctx.save(); if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${item.totalStars || 0}`, valRight - 10*S, ry + 28*S)
        ctx.restore()
        ctx.fillStyle = '#8B7060'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('★', valRight, ry + 28*S)
      } else if (tab === 'tower') {
        const petNames = (item.pets || []).map(p => p.name || '?').join(' ')
        const wpnName = item.weapon ? `⚔${item.weapon.name}` : ''
        const subText = `${petNames} ${wpnName}`
        const maxSubW = valRight - 30*S - textX
        // 须用同一布尔控制 save/restore：缩小字体后再 measureText 会变短，若第二次才判断会漏 restore，破坏外层列表 clip，导致返回键被裁掉
        const shrinkSub = maxSubW > 0 && ctx.measureText(subText).width > maxSubW
        if (shrinkSub) {
          ctx.save()
          ctx.font = `${Math.max(7, Math.floor(9 * maxSubW / ctx.measureText(subText).width))*S}px "PingFang SC",sans-serif`
        }
        ctx.fillText(subText, textX, ry + 44*S)
        if (shrinkSub) ctx.restore()
        ctx.textAlign = 'right'
        const turns = item.totalTurns || 0
        const floorY = turns > 0 ? ry + 22*S : ry + 28*S
        ctx.save(); ctx.textBaseline = 'middle'
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        const layerW = ctx.measureText('层').width
        ctx.fillText('层', valRight, floorY)
        ctx.fillStyle = i < 3 ? '#ffd700' : TH.accent; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${item.floor}`, valRight - layerW - 1*S, floorY)
        ctx.restore()
        if (turns > 0) {
          ctx.fillStyle = i < 3 ? '#C8A84E' : '#8B7060'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.fillText(`${turns}回合`, valRight, ry + 42*S)
        }
      } else if (tab === 'dex') {
        const mc = item.masteredCount || 0, cc = item.collectedCount || 0, dc = item.petDexCount || 0
        ctx.fillText(`收录 ${cc} · 发现 ${dc}`, textX, ry + 44*S)
        ctx.textAlign = 'right'
        ctx.fillStyle = '#8B7060'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        const unitW = ctx.measureText('精通').width + 2*S
        ctx.fillText('精通', valRight, ry + 30*S)
        ctx.fillStyle = i < 3 ? '#ffd700' : '#4dcc4d'; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        ctx.save(); if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${mc}`, valRight - unitW, ry + 30*S)
        ctx.restore()
      } else if (tab === 'combo') {
        const combo = item.maxCombo || 0
        ctx.fillText('最高连击记录', textX, ry + 44*S)
        ctx.textAlign = 'right'
        ctx.fillStyle = i < 3 ? '#ffd700' : '#ff6b6b'; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        ctx.save(); if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${combo}`, valRight - 18*S, ry + 30*S)
        ctx.restore()
        ctx.fillStyle = '#8B7060'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('连击', valRight, ry + 30*S)
      }
    }
  }
  ctx.restore()

  const myBarY = listBottom + 6*S
  _drawMyRankBar(g, ctx, R, TH, W, S, padX, myBarY, myBarH, myRank, tab)

  drawBackBtn(g)
}

/**
 * 好友榜内容渲染：把 openDataContext 子包的 sharedCanvas 作为纹理画上来
 * - 非微信环境：直接提示"仅支持微信"
 * - 每帧发送渲染参数（tab / scrollY / 像素比）给子包；子包按需拉取 wx.getFriendCloudStorage 并回绘
 * - 子包 sharedCanvas 可能是 null（基础库过低），此时退回占位提示
 */
function _drawFriendTabContent(g, ctx, dim, x, y, w, h) {
  const { S } = V
  const friendRanking = require('../data/friendRanking')

  // 1) 非微信环境：绘制降级提示
  if (!friendRanking.isSupported()) {
    ctx.save()
    ctx.fillStyle = '#8B7060'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.fillText('好友榜仅在微信小游戏中可用', x + w / 2, y + h / 2 - 10 * S)
    ctx.fillStyle = '#b0a090'
    ctx.font = `${11 * S}px "PingFang SC",sans-serif`
    ctx.fillText('请在微信客户端打开体验', x + w / 2, y + h / 2 + 14 * S)
    ctx.restore()
    return
  }

  // 2) 通知 openDataContext 重绘（它会按需拉 getFriendCloudStorage，有缓存）
  const sharedCanvas = friendRanking.getSharedCanvas()
  if (!sharedCanvas) {
    ctx.save()
    ctx.fillStyle = '#8B7060'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.fillText('好友榜初始化失败', x + w / 2, y + h / 2)
    ctx.restore()
    return
  }
  // sharedCanvas 像素尺寸 = 显示尺寸 * DPR（S），保证高清
  const targetW = Math.max(1, Math.round(w))
  const targetH = Math.max(1, Math.round(h))
  // 主域负责 sharedCanvas 尺寸（openDataContext 里 width/height 只读），内部做了变化检测，不会每帧 reset
  friendRanking.ensureSharedCanvasSize(targetW, targetH)
  try {
    const cloudSync = require('../data/cloudSync')
    friendRanking.render({
      tab: dim || 'tower',
      pixelRatio: Math.max(1, Math.round(S)),
      width: targetW,
      height: targetH,
      scrollY: g.rankFriendScrollY || 0,
      selfOpenId: (cloudSync && cloudSync.getOpenid) ? cloudSync.getOpenid() : '',
      force: !!g._rankFriendForceRefresh,
    })
    g._rankFriendForceRefresh = false
  } catch (e) {
    console.warn('[FriendRank] render error', e)
  }

  // 3) 把 sharedCanvas 画到主场景
  try {
    ctx.drawImage(sharedCanvas, 0, 0, sharedCanvas.width || targetW, sharedCanvas.height || targetH, x, y, w, h)
  } catch (e) {
    ctx.save()
    ctx.fillStyle = '#8B7060'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = `${12 * S}px "PingFang SC",sans-serif`
    ctx.fillText('好友榜暂时无法显示', x + w / 2, y + h / 2)
    ctx.restore()
  }

  // 4) 登记内容区域触点，供滚动 / 未来扩展使用
  g._rankFriendContentRect = [x, y, w, h]
}

// 绘制排名奖牌/序号
function _drawRankMedal(ctx, R, TH, S, padX, ry, rowH, i) {
  ctx.textAlign = 'left'
  if (i < 3) {
    const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32']
    const medalBg = ['rgba(255,215,0,0.2)', 'rgba(192,192,192,0.15)', 'rgba(205,127,50,0.15)']
    const mx = padX + 18*S, my = ry + rowH*0.5
    const mr = 13*S
    ctx.fillStyle = medalBg[i]
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = medalColors[i] + '66'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.stroke()
    ctx.fillStyle = medalColors[i]; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${i + 1}`, mx, my)
    ctx.textBaseline = 'alphabetic'
  } else {
    ctx.fillStyle = '#8B7060'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, padX + 18*S, ry + rowH*0.5 + 4*S)
  }
}

// 绘制头像
function _drawAvatar(ctx, R, TH, S, avatarUrl, avatarX, avatarY, avatarSz, rankIdx) {
  const avCx = avatarX + avatarSz/2, avCy = avatarY + avatarSz/2
  if (avatarUrl) {
    const avatarImg = R.getImg(avatarUrl)
    if (avatarImg && avatarImg.width > 0) {
      ctx.save()
      ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2, 0, Math.PI*2); ctx.clip()
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSz, avatarSz)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(200,158,60,0.18)'
      ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2, 0, Math.PI*2); ctx.fill()
    }
  } else {
    ctx.fillStyle = 'rgba(200,158,60,0.18)'
    ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#8B7060'; ctx.font = `${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('?', avCx, avCy + 5*S)
  }
  if (rankIdx < 3) {
    const bc = ['#ffd700', '#c0c0c0', '#cd7f32']
    ctx.strokeStyle = bc[rankIdx] + '88'; ctx.lineWidth = 1.5*S
    ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2 + 1*S, 0, Math.PI*2); ctx.stroke()
  }
}

// 底部我的排名栏
function _drawMyRankBar(g, ctx, R, TH, W, S, padX, myBarY, myBarH, myRank, tab) {
  // 暖米黄底色
  const mbg = ctx.createLinearGradient(padX, myBarY, padX, myBarY + myBarH)
  mbg.addColorStop(0, 'rgba(252,246,228,0.97)'); mbg.addColorStop(1, 'rgba(244,234,208,0.97)')
  ctx.fillStyle = mbg; R.rr(padX, myBarY, W - padX*2, myBarH, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(200,160,60,0.5)'; ctx.lineWidth = 1.5*S
  R.rr(padX, myBarY, W - padX*2, myBarH, 10*S); ctx.stroke()

  // 头像
  const myAvatarSz = 36*S
  const myAvX = padX + 10*S, myAvY = myBarY + (myBarH - myAvatarSz) / 2
  const myAvCx = myAvX + myAvatarSz/2, myAvCy = myAvY + myAvatarSz/2
  const myAvatarUrl = g.storage.userInfo ? g.storage.userInfo.avatarUrl : ''
  if (myAvatarUrl) {
    const myAvImg = R.getImg(myAvatarUrl)
    if (myAvImg && myAvImg.width > 0) {
      ctx.save()
      ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2, 0, Math.PI*2); ctx.clip()
      ctx.drawImage(myAvImg, myAvX, myAvY, myAvatarSz, myAvatarSz)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(200,158,60,0.2)'
      ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#5a3000'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('我', myAvCx, myAvCy + 5*S)
    }
  } else {
    ctx.fillStyle = 'rgba(200,158,60,0.2)'
    ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#5a3000'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('我', myAvCx, myAvCy + 5*S)
  }
  ctx.strokeStyle = 'rgba(200,158,60,0.6)'; ctx.lineWidth = 1.5*S
  ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2 + 1*S, 0, Math.PI*2); ctx.stroke()

  // 昵称 + 排名
  const myTextX = myAvX + myAvatarSz + 8*S
  const myNick = g.storage.userInfo ? g.storage.userInfo.nickName : '我'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#3a1a00'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(`${myNick}`, myTextX, myBarY + 22*S)
  if (myRank > 0) {
    ctx.fillStyle = '#7A5020'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`第 ${myRank} 名`, myTextX, myBarY + 40*S)
  } else {
    ctx.fillStyle = '#8B7060'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('未上榜', myTextX, myBarY + 40*S)
  }

  // 右侧我的数值
  ctx.textAlign = 'right'
  if (tab === 'stage') {
    const stars = g.storage.getStageTotalStars()
    ctx.fillStyle = '#b86800'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${stars}`, W - padX - 24*S, myBarY + 24*S)
    ctx.fillStyle = '#8B7060'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('★', W - padX - 12*S, myBarY + 24*S)
    ctx.fillStyle = '#7A5020'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    const myN = g.storage.getFarthestClearedStageCoords(false)
    const myE = g.storage.getFarthestClearedStageCoords(true)
    ctx.fillText(formatRankStageProgressSubtitle({
      farthestNormalChapter: myN ? myN.chapter : 0,
      farthestNormalOrder: myN ? myN.order : 0,
      farthestEliteChapter: myE ? myE.chapter : 0,
      farthestEliteOrder: myE ? myE.order : 0,
      clearCount: g.storage.getClearedNormalStageDistinctCount(),
      farthestChapter: g.storage.getFarthestChapter(),
    }), W - padX - 12*S, myBarY + 42*S)
  } else if (tab === 'tower') {
    const bestTurns = g.storage.stats.bestTotalTurns || 0
    ctx.fillStyle = '#8B6914'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${g.storage.bestFloor}`, W - padX - 30*S, myBarY + 24*S)
    ctx.fillStyle = '#8B7060'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('层', W - padX - 14*S, myBarY + 24*S)
    if (bestTurns > 0) {
      ctx.fillStyle = '#7A5020'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${bestTurns}回合`, W - padX - 14*S, myBarY + 42*S)
    }
  } else if (tab === 'dex') {
    const { getDexProgress } = require('../data/dexConfig')
    const prog = getDexProgress(g.storage.petPool)
    ctx.fillStyle = '#2d8c2d'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${prog.mastered.length}`, W - padX - 32*S, myBarY + 24*S)
    ctx.fillStyle = '#8B7060'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('精通', W - padX - 12*S, myBarY + 24*S)
    ctx.fillStyle = '#7A5020'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(`收录${prog.collected.length} 发现${prog.discovered.length}`, W - padX - 12*S, myBarY + 42*S)
  } else if (tab === 'combo') {
    const mc = g.storage.stats.maxCombo || 0
    ctx.fillStyle = '#c0392b'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${mc}`, W - padX - 46*S, myBarY + 34*S)
    ctx.fillStyle = '#8B7060'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('连击', W - padX - 14*S, myBarY + 34*S)
  }
}


// ===== Reward =====
const _wrapText = _uiWrapText

function rReward(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const { REWARD_TYPES } = require('../data/tower')
  R.drawRewardBg(g.af)
  ctx.textAlign = 'center'
  const evtType = g.curEvent ? g.curEvent.type : ''
  let title = '战斗胜利 - 选择奖励'
  if (evtType === 'elite') title = '精英击败 - 选择灵兽'
  else if (evtType === 'boss') title = 'BOSS击败 - 选择奖励'
  // 标题
  const titleBaseY = safeTop + 58*S
  ctx.fillStyle = '#5C3A1E'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  ctx.fillText(title, W*0.5, titleBaseY)
  // 标题下方装饰分割线
  const divW = W*0.36, divY = titleBaseY + 6*S
  ctx.strokeStyle = 'rgba(139,105,20,0.4)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  let headerOffset = 0
  if (g.lastSpeedKill) {
    ctx.fillStyle = '#8B6914'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`⚡ 速通达成 (${g.lastTurnCount}回合) — 额外选项已解锁`, W*0.5, titleBaseY + 22*S)
    headerOffset = 22*S
  }
  if (!g.rewards) return
  const rewardCount = g.rewards.length
  const isPetOrWeapon = g.rewards.some(rw => rw.type === REWARD_TYPES.NEW_PET || rw.type === REWARD_TYPES.NEW_WEAPON)
  const maxCardArea = H * 0.65
  const gap = 10*S
  const defaultCardH = isPetOrWeapon ? 170*S : 105*S
  const cardH = Math.min(defaultCardH, (maxCardArea - (rewardCount-1)*gap) / rewardCount)
  const cardW = W*0.96
  const cardX = (W - cardW) / 2
  const startY = H*0.17 + headerOffset
  g._rewardRects = []

  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }

  g.rewards.forEach((rw, i) => {
    const cy = startY + i*(cardH+gap)
    const selected = g.selectedReward === i
    const isSpeedBuff = rw.isSpeed === true
    const _isPetOrWpn = rw.type === REWARD_TYPES.NEW_PET || rw.type === REWARD_TYPES.NEW_WEAPON

    // Buff 卡片由 drawBuffCard 自行绘制背景，仅对灵兽/法宝卡绘制通用背景
    let _useScrollBg = false
    if (_isPetOrWpn) {
      let bgColor = selected ? 'rgba(75,50,20,0.93)' : 'rgba(65,45,18,0.88)'
      let borderColor = selected ? '#E8C060' : 'rgba(180,150,90,0.4)'
      if (rw.type === REWARD_TYPES.NEW_PET) {
        const ac = ATTR_COLOR[rw.data.attr]
        if (selected && ac) borderColor = ac.main
      }

      const rewardCardBg = R.getImg('assets/ui/reward_card_bg.png')
      _useScrollBg = rewardCardBg && rewardCardBg.width > 0

      const scrollPadX = 6 * S
      const scrollPadY = 4 * S
      const scrollX = cardX - scrollPadX
      const scrollY = cy - scrollPadY
      const scrollW = cardW + scrollPadX * 2
      const scrollH = cardH + scrollPadY * 2

      if (_useScrollBg) {
        ctx.save()
        ctx.shadowColor = 'rgba(40,25,10,0.45)'
        ctx.shadowBlur = 12 * S
        ctx.shadowOffsetY = 4 * S
        ctx.drawImage(rewardCardBg, scrollX, scrollY, scrollW, scrollH)
        ctx.restore()
        if (selected) {
          ctx.save()
          ctx.shadowColor = borderColor
          ctx.shadowBlur = 16 * S
          ctx.globalAlpha = 0.6
          ctx.drawImage(rewardCardBg, scrollX, scrollY, scrollW, scrollH)
          ctx.restore()
        }
      } else {
        ctx.save()
        ctx.shadowColor = 'rgba(40,25,10,0.5)'
        ctx.shadowBlur = 14 * S
        ctx.shadowOffsetY = 5 * S
        ctx.fillStyle = bgColor
        R.rr(cardX, cy, cardW, cardH, 10*S); ctx.fill()
        ctx.restore()
        ctx.save()
        ctx.shadowColor = selected ? 'rgba(230,200,100,0.6)' : 'rgba(180,150,80,0.2)'
        ctx.shadowBlur = selected ? 18 * S : 8 * S
        ctx.strokeStyle = selected ? 'rgba(230,200,100,0.7)' : 'rgba(180,150,90,0.35)'
        ctx.lineWidth = selected ? 2.5 * S : 1.5 * S
        R.rr(cardX, cy, cardW, cardH, 10*S); ctx.stroke()
        ctx.restore()
        if (selected) {
          ctx.strokeStyle = borderColor; ctx.lineWidth = 2.5*S
          R.rr(cardX, cy, cardW, cardH, 10*S); ctx.stroke()
        }
      }
    }

    // 卷轴亮底 vs 降级深底的文字配色切换（灵兽/法宝卡片内容使用）
    const _darkText = _useScrollBg
    const _txtMain   = _darkText ? '#2A1A10' : '#FFF2D0'
    const _txtSub    = _darkText ? '#3F3025' : 'rgba(235,225,200,0.9)'
    const _txtDim    = _darkText ? '#4A3A2E' : 'rgba(220,205,170,0.75)'
    const _txtGold   = _darkText ? '#7A590A' : '#FFD870'
    const _txtGreen  = _darkText ? '#1E7A42' : '#6EEE9A'
    const _txtOrange = _darkText ? '#A85C00' : '#F0C050'
    const _txtStroke = _darkText ? 'rgba(255,248,232,0.7)' : 'rgba(30,20,5,0.6)'

    const _contentPadL = _useScrollBg ? 38*S : 12*S

    if (rw.type === REWARD_TYPES.NEW_PET && rw.data) {
      // ====== 灵兽卡片：头像框 + 详细信息 ======
      const p = rw.data
      const ac = ATTR_COLOR[p.attr]
      const avSz = Math.min(56*S, cardH - 16*S)
      const avX = cardX + _contentPadL
      const avY = cy + (cardH - avSz) / 2

      // 头像背景
      ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
      R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()

      R.drawCoverImg(R.getImg(getPetAvatarPath(p)), avX, avY, avSz, avSz, { radius: 6 * S })

      // 头像框
      const petFrame = framePetMap[p.attr] || framePetMap.metal
      if (petFrame && petFrame.width > 0) {
        const fScale = 1.12, fSz = avSz * fScale, fOff = (fSz - avSz)/2
        ctx.drawImage(petFrame, avX - fOff, avY - fOff, fSz, fSz)
      }

      // 已拥有判断（用于头像下方星级 & 名称后升星标注）
      const allOwned = [...(g.pets || []), ...(g.petBag || [])]
      const ownedPet = allOwned.find(op => op.id === p.id)

      // 头像下方标签：已拥有显示星级，未拥有显示"新"
      ctx.textAlign = 'center'
      if (ownedPet) {
        const ownedStar = ownedPet.star || 1
        const starFontSz = 12*S
        const starGap = 14*S
        const totalStarW = ownedStar * starGap
        const starStartX = avX + avSz/2 - totalStarW/2 + starGap/2
        const starY = avY + avSz + 15*S
        ctx.save()
        ctx.font = `bold ${starFontSz}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        for (let si = 0; si < ownedStar; si++) {
          const sx = starStartX + si * starGap
          ctx.strokeStyle = '#3A2A10'; ctx.lineWidth = 3*S
          ctx.strokeText('★', sx, starY)
          ctx.fillStyle = '#FFD700'
          ctx.fillText('★', sx, starY)
        }
        ctx.restore()
      } else {
        ctx.save()
        const newX = avX + avSz/2, newY = avY + avSz + 15*S
        ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#E04040'
        ctx.fillText('新', newX, newY)
        ctx.restore()
      }

      // 右侧文字信息
      const _contentPadR = _useScrollBg ? 32*S : 10*S
      const infoX = avX + avSz + 14*S
      const textMaxW = cardX + cardW - infoX - _contentPadR
      let iy = cy + 36*S

      // 名称 + 属性球 + 升星标注
      ctx.textAlign = 'left'
      ctx.fillStyle = _txtMain; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 2 * S; ctx.strokeText(p.name, infoX, iy) }
      ctx.fillText(p.name, infoX, iy)
      let nameEndX = infoX + ctx.measureText(p.name).width
      const orbR = 7*S
      R.drawBead(nameEndX + 7*S + orbR, iy - orbR*0.4, orbR, p.attr, 0)
      nameEndX += 7*S + orbR*2 + 4*S

      if (ownedPet) {
        const ownedStar = ownedPet.star || 1
        if (ownedStar >= MAX_STAR) {
          ctx.fillStyle = _txtOrange; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
          ctx.fillText('已满星', nameEndX, iy)
        } else {
          ctx.fillStyle = _txtGreen; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
          ctx.fillText(`可升至${ownedStar+1}星`, nameEndX, iy)
        }
      }

      // ATK + CD
      iy += 22*S
      ctx.fillStyle = _txtSub; ctx.font = `${13*S}px "PingFang SC",sans-serif`
      ctx.fillText(`ATK: ${p.atk}    CD: ${p.cd}回合`, infoX, iy)

      // 技能
      if (p.skill) {
        iy += 20*S
        if (petHasSkill(p)) {
          ctx.fillStyle = _txtGold; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
          if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.5 * S; ctx.strokeText(`技能：${p.skill.name}`, infoX, iy) }
          ctx.fillText(`技能：${p.skill.name}`, infoX, iy)
          iy += 18*S
          ctx.fillStyle = _txtDim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
          const descLines = _wrapText(getPetSkillDesc(p), textMaxW, 12)
          descLines.forEach(line => {
            if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(line, infoX, iy) }
            ctx.fillText(line, infoX, iy)
            iy += 16*S
          })
        } else {
          ctx.fillStyle = _txtDim; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
          if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.5 * S; ctx.strokeText('技能：升至★2解锁', infoX, iy) }
          ctx.fillText('技能：升至★2解锁', infoX, iy)
          iy += 18*S
          ctx.fillStyle = _txtDim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
          const lockedSkillLines = _wrapText(`（${p.skill.name}：${p.skill.desc}）`, textMaxW, 12)
          lockedSkillLines.forEach(line => {
            if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(line, infoX, iy) }
            ctx.fillText(line, infoX, iy)
            iy += 16*S
          })
          iy -= 16*S
        }
      }

    } else if (rw.type === REWARD_TYPES.NEW_WEAPON && rw.data) {
      // ====== 法宝卡片：图标 + 详细信息 ======
      const w = rw.data
      const avSz = Math.min(56*S, cardH - 16*S)
      const avX = cardX + _contentPadL
      const avY = cy + (cardH - avSz) / 2

      // 法宝图标背景
      ctx.fillStyle = '#f0e8d8'
      R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()

      R.drawCoverImg(R.getImg(`assets/equipment/fabao_${w.id}.png`), avX, avY, avSz, avSz, { radius: 6 * S })

      // 法宝框
      R.drawWeaponFrame(avX, avY, avSz)

      // 右侧文字信息
      const _contentPadR = _useScrollBg ? 32*S : 10*S
      const infoX = avX + avSz + 14*S
      const textMaxW = cardX + cardW - infoX - _contentPadR
      let iy = cy + 36*S

      // 法宝名称
      ctx.textAlign = 'left'
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 2 * S }
      const _rwLabel = '法宝·'
      ctx.fillStyle = _txtGold; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      if (_txtStroke) ctx.strokeText(_rwLabel, infoX, iy)
      ctx.fillText(_rwLabel, infoX, iy)
      const _rwLabelW = ctx.measureText(_rwLabel).width
      ctx.fillStyle = _txtMain
      if (_txtStroke) ctx.strokeText(w.name, infoX + _rwLabelW, iy)
      ctx.fillText(w.name, infoX + _rwLabelW, iy)

      const nameW = ctx.measureText(w.name).width

      // 法宝效果描述
      iy += 24*S
      ctx.fillStyle = _txtSub; ctx.font = `${13*S}px "PingFang SC",sans-serif`
      if (w.desc) {
        const descLines = _wrapText(w.desc, textMaxW, 13)
        descLines.forEach(line => {
          if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(line, infoX, iy) }
          ctx.fillText(line, infoX, iy)
          iy += 18*S
        })
      }

      // 属性相关提示（属性球代替文字）
      if (w.attr) {
        ctx.fillStyle = _txtDim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
        if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText('对应属性：', infoX, iy) }
        ctx.fillText('对应属性：', infoX, iy)
        const labelW = ctx.measureText('对应属性：').width
        const orbR = 7*S
        R.drawBead(infoX + labelW + orbR, iy - orbR*0.4, orbR, w.attr, 0)
      }

    } else {
      drawBuffCard(ctx, R, S, cardX, cy, cardW, cardH, rw, selected)
    }
    g._rewardRects.push([cardX, cy, cardW, cardH])
  })

  // 确认按钮
  if (g.selectedReward >= 0) {
    const bx = W*0.25, by = H*0.86, bw = W*0.5, bh = 44*S
    const confirmBtnImg = R.getImg('assets/ui/btn_reward_confirm.png')
    if (confirmBtnImg && confirmBtnImg.width) {
      ctx.drawImage(confirmBtnImg, bx, by, bw, bh)
      ctx.fillStyle = '#4A2020'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('确认', bx + bw*0.5, by + bh*0.48)
      ctx.textBaseline = 'alphabetic'
    } else {
      R.drawBtn(bx, by, bw, bh, '确认', TH.accent, 16)
    }
    g._rewardConfirmRect = [bx, by, bw, bh]
  }
  // 从战斗胜利进入奖励页时不显示返回按钮
  if (g.bState !== 'victory') {
    drawBackBtn(g)
  } else {
    g._backBtnRect = null
  }
}

// ===== Shop =====
function rShop(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawShopBg(g.af)
  // 标题区域：仙侠书法风
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('神秘商店', W*0.5, safeTop + 40*S)
  ctx.restore()
  // 装饰分割线
  const divW = W*0.25, divY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  ctx.fillStyle = g.shopUsed ? TH.dim : '#e8a840'; ctx.font = `${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(g.shopUsed ? '已选择物品' : '免费选择一件', W*0.5, safeTop + 68*S)
  if (!g.shopItems) return
  const cardW = W*0.84, cardH = 62*S, gap = 10*S, startY = safeTop + 90*S
  g._shopRects = []
  g.shopItems.forEach((item, i) => {
    const cx = (W - cardW) / 2, cy = startY + i*(cardH+gap)
    // 卡片背景：暗色渐变+金边
    const cbg = ctx.createLinearGradient(cx, cy, cx, cy + cardH)
    cbg.addColorStop(0, 'rgba(30,25,18,0.88)'); cbg.addColorStop(1, 'rgba(20,18,12,0.92)')
    ctx.fillStyle = cbg; R.rr(cx, cy, cardW, cardH, 10*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1*S
    R.rr(cx, cy, cardW, cardH, 10*S); ctx.stroke()
    // 左侧装饰竖条
    ctx.fillStyle = 'rgba(212,175,55,0.4)'
    R.rr(cx + 4*S, cy + 6*S, 3*S, cardH - 12*S, 1.5*S); ctx.fill()
    // 名称（左对齐，带描述）
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(item.name, cx + 16*S, cy + 26*S)
    if (item.desc) {
      ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(item.desc, cx + 16*S, cy + 46*S)
    }
    ctx.textAlign = 'center'
    g._shopRects.push([cx, cy, cardW, cardH])
  })
  const bx = W*0.3, by = H*0.82, bw = W*0.4, bh = 40*S
  R.drawBtn(bx, by, bw, bh, '离开', TH.info, 14)
  g._shopLeaveRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== Rest =====
function rRest(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawRestBg(g.af)
  // 标题
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('休息之地', W*0.5, safeTop + 40*S)
  ctx.restore()
  const divW = W*0.25, divY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('选择一项恢复方式', W*0.5, safeTop + 66*S)
  if (!g.restOpts) return
  const cardW = W*0.78, cardH = 72*S, gap = 14*S, startY = safeTop + 90*S
  g._restRects = []
  const restIcons = ['🧘', '💊', '🛡']
  g.restOpts.forEach((opt, i) => {
    const cx = (W - cardW) / 2, cy = startY + i*(cardH+gap)
    // 卡片背景
    const cbg = ctx.createLinearGradient(cx, cy, cx, cy + cardH)
    cbg.addColorStop(0, 'rgba(30,25,18,0.85)'); cbg.addColorStop(1, 'rgba(20,18,12,0.9)')
    ctx.fillStyle = cbg; R.rr(cx, cy, cardW, cardH, 10*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.25)'; ctx.lineWidth = 1*S
    R.rr(cx, cy, cardW, cardH, 10*S); ctx.stroke()
    // 左侧图标区
    const iconSz = 36*S, iconX = cx + 14*S, iconY = cy + (cardH - iconSz)/2
    ctx.fillStyle = 'rgba(212,175,55,0.1)'
    R.rr(iconX, iconY, iconSz, iconSz, 8*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 0.5*S
    R.rr(iconX, iconY, iconSz, iconSz, 8*S); ctx.stroke()
    ctx.font = `${20*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(restIcons[i] || '✨', iconX + iconSz/2, iconY + iconSz/2)
    ctx.textBaseline = 'alphabetic'
    // 右侧文字
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
    ctx.fillText(opt.name, iconX + iconSz + 12*S, cy + 30*S)
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(opt.desc, iconX + iconSz + 12*S, cy + 50*S)
    ctx.textAlign = 'center'
    g._restRects.push([(W - cardW)/2, cy, cardW, cardH])
  })
  drawBackBtn(g)
}

// ===== Adventure =====
function rAdventure(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawAdventureBg(g.af)
  // 标题
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('奇遇', W*0.5, safeTop + 40*S)
  ctx.restore()
  const divW = W*0.18, divY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  if (!g.adventureData) return
  // 内容面板
  const panelW = W*0.82, panelH = 160*S
  const panelX = (W - panelW)/2, panelY = H*0.26
  const pbg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  pbg.addColorStop(0, 'rgba(30,25,18,0.88)'); pbg.addColorStop(1, 'rgba(20,18,12,0.92)')
  ctx.fillStyle = pbg; R.rr(panelX, panelY, panelW, panelH, 12*S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1*S
  R.rr(panelX, panelY, panelW, panelH, 12*S); ctx.stroke()
  // 奇遇名
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  ctx.fillText(g.adventureData.name, W*0.5, panelY + 42*S)
  // 描述
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3*S
  ctx.fillStyle = '#fff'; ctx.font = `${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(g.adventureData.desc, W*0.5, panelY + 72*S)
  // 显示具体获得结果
  if (g._adventureResult) {
    ctx.fillStyle = '#ffd54f'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.fillText(g._adventureResult, W*0.5, panelY + 94*S)
  }
  ctx.restore()
  // 效果标记
  ctx.save()
  ctx.shadowColor = 'rgba(212,175,55,0.4)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#ffe066'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText('✦ 效果已生效 ✦', W*0.5, panelY + (g._adventureResult ? 120 : 116)*S)
  ctx.restore()
  const bx = W*0.3, by = H*0.68, bw = W*0.4, bh = 44*S
  R.drawBtn(bx, by, bw, bh, '继续', TH.accent, 16)
  g._advBtnRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== 通用左上角返回首页按钮 =====
// 排行、统计页：圆形半透明+白箭头（与灵宠详情页一致）；其他页：btn_back.png
function drawBackBtn(g) {
  const { ctx, R, S, safeTop } = V
  const useCircularStyle = g.scene === 'ranking'

  if (useCircularStyle) {
    // 圆形按钮（与灵宠详情页一致）
    const btnSz = 36 * S
    const bx = 12 * S, by = safeTop + 8 * S
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.beginPath()
    ctx.arc(bx + btnSz / 2, by + btnSz / 2, btnSz / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5 * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const ax = bx + btnSz / 2 + 3 * S, ay = by + btnSz / 2
    ctx.beginPath()
    ctx.moveTo(ax, ay - 8 * S); ctx.lineTo(ax - 8 * S, ay); ctx.lineTo(ax, ay + 8 * S)
    ctx.stroke()
    ctx.restore()
    g._backBtnRect = [bx, by, btnSz, btnSz]
    return
  }

  const btnImg = R.getImg('assets/ui/btn_back.png')
  const btnH = 40 * S
  const btnW = btnImg && btnImg.width > 0 ? btnH * (btnImg.width / btnImg.height) : 88 * S
  const bx = 4 * S, by = safeTop + 2 * S
  ctx.save()
  if (btnImg && btnImg.width > 0) {
    ctx.drawImage(btnImg, bx, by, btnW, btnH)
  } else {
    const fb = ctx.createLinearGradient(bx, by, bx, by + btnH)
    fb.addColorStop(0, 'rgba(200,158,60,0.9)'); fb.addColorStop(1, 'rgba(160,120,30,0.9)')
    ctx.fillStyle = fb; R.rr(bx, by, btnW, btnH, btnH * 0.5); ctx.fill()
    ctx.fillStyle = '#fff8ee'
    ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(80,20,0,0.55)'; ctx.shadowBlur = 3 * S
    ctx.fillText('◁ 首页', bx + btnW * 0.5, by + btnH * 0.5)
  }
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
  g._backBtnRect = [bx, by, btnW, btnH]
}

// ===== 首页"开始挑战"确认弹窗（info_panel_bg图片版） =====
function drawNewRunConfirm(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H)
  const pw = W * 0.82, ph = 175*S
  const px = (W - pw) / 2, py = (H - ph) / 2

  // 面板背景图
  const panelImg = R.getImg('assets/ui/info_panel_bg.png')
  if (panelImg && panelImg.width > 0) {
    ctx.drawImage(panelImg, px, py, pw, ph)
  } else {
    const rad = 14*S
    ctx.fillStyle = 'rgba(248,242,230,0.97)'
    R.rr(px, py, pw, ph, rad); ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5*S
    R.rr(px, py, pw, ph, rad); ctx.stroke()
  }

  // 标题
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6B5014'
  ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
  ctx.fillText('开始新挑战', px + pw*0.5, py + 32*S)

  // 说明文字
  ctx.fillStyle = '#7B7060'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('当前有未完成的挑战进度', px + pw*0.5, py + 68*S)
  ctx.fillStyle = '#C0392B'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('开始新挑战将清空之前的记录！', px + pw*0.5, py + 88*S)

  // 按钮（使用图片资源）
  const btnW = pw * 0.34, btnH = 34*S, gap = 14*S
  const btn1X = px + pw*0.5 - btnW - gap*0.5
  const btn2X = px + pw*0.5 + gap*0.5
  const btnY = py + 110*S
  R.drawDialogBtn(btn1X, btnY, btnW, btnH, '取消', 'cancel')
  g._newRunCancelRect = [btn1X, btnY, btnW, btnH]
  R.drawDialogBtn(btn2X, btnY, btnW, btnH, '确认开始', 'confirm')
  g._newRunConfirmRect = [btn2X, btnY, btnW, btnH]
}

// ===== Dex（灵兽图鉴 — 三层收集 + 里程碑 / 法宝图鉴） =====

const { WEAPONS, getWeaponById, getWeaponRarity } = require('../data/weapons')
const { drawCornerRarityBadge, drawInlineRarityBadge } = require('./rarityBadge')

const _DEX_TAB_KEYS = ['all', ...DEX_ATTRS, 'milestone']
const _DEX_TAB_LABELS = { all:'全部', metal:'金', wood:'木', water:'水', fire:'火', earth:'土', milestone:'里程碑' }

/** 灵兽图鉴子 Tab 红点：未查看详情（与格子红点一致）或可领里程碑 */
function _dexPetTabShowDot(tabKey, pool, seenIds, claimedMilestoneIds) {
  if (tabKey === 'milestone') {
    return hasUnclaimedMilestones(pool, claimedMilestoneIds)
  }
  if (tabKey === 'all') {
    if (hasUnclaimedMilestones(pool, claimedMilestoneIds)) return true
    return DEX_ATTRS.some(a => _dexPetTabShowDot(a, pool, seenIds, claimedMilestoneIds))
  }
  if (DEX_ATTRS.includes(tabKey)) {
    const list = PETS[tabKey] || []
    return list.some(pet => pool.some(p => p.id === pet.id) && !seenIds.includes(pet.id))
  }
  return false
}
const _TIER_COLORS = {
  mastered:   { bg: 'rgba(212,175,55,0.26)', border: '#C8A832', nameColor: '#4a3206' },
  collected:  { bg: 'rgba(255,252,248,0.9)', border: 'rgba(120,95,60,0.45)', nameColor: '#3a2f24' },
  discovered: { bg: 'rgba(255,248,235,0.88)', border: 'rgba(110,85,55,0.38)', nameColor: '#5c4330' },
  unknown:    { bg: 'rgba(32,28,22,0.42)', border: 'rgba(90,75,55,0.45)', nameColor: 'rgba(255,255,255,0.55)' },
}

function rDex(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)

  if (!g._dexTab) g._dexTab = 'all'
  if (!g._dexMode) g._dexMode = 'pet'
  const isWeaponMode = g._dexMode === 'weapon'

  // 首次进入：介绍卡（仅灵宠模式）
  if (!isWeaponMode && !g.storage.isGuideShown('dex_intro') && g._dexIntroPage == null) {
    g._dexIntroPage = 0
    g._dexIntroAlpha = 0
  }

  // 标题
  drawPageTitle(ctx, R, W, S, W * 0.5, safeTop + DEX_LAYOUT.titleCenterBelowSafePt * S,
    isWeaponMode ? '法宝图鉴' : '灵兽图鉴')
  const titleBottom = safeTop + (DEX_LAYOUT.titleCenterBelowSafePt + DEX_LAYOUT.nameBgHalfHPt) * S

  // 一级模式切换：灵宠图鉴 / 法宝图鉴
  const modeY = titleBottom + 4 * S
  const modeH = 22 * S
  const modeBtnW = 72 * S
  const modeGap = 6 * S
  const modeTotalW = modeBtnW * 2 + modeGap
  const modeStartX = (W - modeTotalW) / 2
  g._dexModeRects = []
  const modes = [{ key: 'pet', label: '灵宠' }, { key: 'weapon', label: '法宝' }]
  for (let mi = 0; mi < modes.length; mi++) {
    const mx = modeStartX + mi * (modeBtnW + modeGap)
    const mActive = g._dexMode === modes[mi].key
    ctx.fillStyle = mActive ? 'rgba(212,175,55,0.35)' : 'rgba(120,100,60,0.12)'
    R.rr(mx, modeY, modeBtnW, modeH, modeH / 2); ctx.fill()
    if (mActive) {
      ctx.strokeStyle = 'rgba(212,175,55,0.7)'; ctx.lineWidth = 1.5 * S
      R.rr(mx, modeY, modeBtnW, modeH, modeH / 2); ctx.stroke()
    }
    ctx.fillStyle = mActive ? '#7a5200' : '#8a7a60'
    ctx.font = `${mActive ? 'bold ' : ''}${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(modes[mi].label, mx + modeBtnW / 2, modeY + modeH / 2)
    g._dexModeRects.push({ key: modes[mi].key, x: mx, y: modeY, w: modeBtnW, h: modeH })
  }
  ctx.textBaseline = 'alphabetic'

  const sdivY = modeY + modeH + 4 * S
  const sdivW = W * 0.22
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.moveTo(W * 0.5 - sdivW, sdivY); ctx.lineTo(W * 0.5 + sdivW, sdivY); ctx.stroke()

  if (isWeaponMode) {
    _drawDexWeaponMode(g, ctx, R, W, S, sdivY)
  } else {
    _drawDexPetMode(g, ctx, R, TH, W, S, sdivY)
  }

  drawBottomBar(g)

  if (!isWeaponMode && g._dexDetailPetId) _drawDexPetDetail(g)
  if (!isWeaponMode && g._dexIntroPage != null) _drawDexIntro(g)
  if (isWeaponMode && g._dexDetailWpnId) _drawDexWeaponDetail(g)
}

function _drawDexPetMode(g, ctx, R, TH, W, S, sdivY) {
  const safeTop = V.safeTop
  // 三层进度摘要
  const progress = getDexProgress(g.storage.petPool)
  const summaryY = sdivY + DEX_LAYOUT.gapDividerToSummaryPt * S
  ctx.font = `${10 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  const labels = [
    { text: `发现 ${progress.discovered.length}`, color: '#4d4236' },
    { text: `收录 ${progress.collected.length}`, color: '#7a5200' },
    { text: `精通 ${progress.mastered.length}`, color: '#6a4200' },
  ]
  const segW = W * 0.25
  const segStart = W * 0.5 - segW * 1.5
  labels.forEach((l, i) => {
    ctx.fillStyle = l.color
    ctx.fillText(l.text, segStart + segW * i + segW * 0.5, summaryY)
  })
  ctx.fillStyle = '#6d6054'
  ctx.fillText(`/ ${TOTAL_PET_COUNT}`, segStart + segW * 3 - 4 * S, summaryY)

  // Tab 栏
  const tabY = summaryY + DEX_LAYOUT.gapSummaryToTabPt * S
  const tabH = DEX_LAYOUT.tabHPt * S
  const tabCount = _DEX_TAB_KEYS.length
  const tabPad = 6 * S
  const tabTotalW = W - tabPad * 2
  const tabItemW = tabTotalW / tabCount
  g._dexTabRects = []
  const pool = g.storage.petPool || []
  const seen = g.storage.petDexSeen || []
  const claimed = g.storage.dexMilestonesClaimed
  for (let i = 0; i < tabCount; i++) {
    const key = _DEX_TAB_KEYS[i]
    const tx = tabPad + i * tabItemW
    const active = g._dexTab === key
    if (active) {
      ctx.fillStyle = 'rgba(212,175,55,0.2)'
      ctx.beginPath(); R.rr(tx + 1, tabY, tabItemW - 2, tabH, 4 * S); ctx.fill()
      ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 1 * S
      ctx.beginPath(); R.rr(tx + 1, tabY, tabItemW - 2, tabH, 4 * S); ctx.stroke()
    }
    ctx.fillStyle = active ? '#7a5200' : '#4a3d32'
    ctx.font = `${active ? 'bold ' : ''}${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(_DEX_TAB_LABELS[key], tx + tabItemW / 2, tabY + tabH * 0.65)
    g._dexTabRects.push({ key, x: tx, y: tabY, w: tabItemW, h: tabH })
    if (_dexPetTabShowDot(key, pool, seen, claimed)) {
      const dr = 3.5 * S
      ctx.fillStyle = '#e04040'
      ctx.beginPath(); ctx.arc(tx + tabItemW - 6 * S, tabY + 6 * S, dr, 0, Math.PI * 2); ctx.fill()
    }
  }

  const contentTop = tabY + tabH + DEX_LAYOUT.contentGapBelowTabPt * S
  const contentBottom = _getDexLayout().bottomBarY - 4 * S

  if (g._dexTab === 'milestone') {
    _drawDexMilestones(g, contentTop, contentBottom)
  } else {
    _drawDexPetGrid(g, contentTop, contentBottom)
  }
}

function _drawDexWeaponMode(g, ctx, R, W, S, sdivY) {
  const collection = g.storage.weaponCollection || []
  const collSet = new Set(collection)

  const summaryY = sdivY + DEX_LAYOUT.gapDividerToSummaryPt * S
  ctx.font = `${11 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillStyle = '#5c4330'
  ctx.fillText(`已收集 ${collection.length} / ${WEAPONS.length}`, W * 0.5, summaryY)

  g._dexWpnTabRects = []

  const contentTop = summaryY + DEX_LAYOUT.gapSummaryToTabPt * S
  const contentBottom = _getDexLayout().bottomBarY - 4 * S
  _drawDexWeaponGrid(g, contentTop, contentBottom, collSet)
}

function _drawDexWeaponGrid(g, contentTop, contentBottom, collSet) {
  const { ctx, R, W, S } = V
  const scrollY = g._dexScrollY || 0

  ctx.save()
  ctx.beginPath(); ctx.rect(0, contentTop, W, contentBottom - contentTop); ctx.clip()

  const padX = 12 * S
  const cols = 5
  const cellGap = 4 * S
  const cellW = (W - padX * 2 - (cols - 1) * cellGap) / cols
  const cellH = cellW + 18 * S

  const wpnList = WEAPONS.slice()

  g._dexWpnCellRects = []
  g._dexTotalH = 0

  let y = contentTop + scrollY
  for (let idx = 0; idx < wpnList.length; idx++) {
    const wpn = wpnList[idx]
    const row = Math.floor(idx / cols)
    const col = idx % cols
    const cx = padX + col * (cellW + cellGap)
    const cy = contentTop + row * (cellH + cellGap) + cellGap + scrollY

    if (cy + cellH < contentTop || cy > contentBottom) {
      g._dexWpnCellRects.push({ id: wpn.id, x: cx, y: cy, w: cellW, h: cellH })
      continue
    }

    const owned = collSet.has(wpn.id)
    const rarityKey = getWeaponRarity(wpn.id) || 'R'

    ctx.fillStyle = owned ? 'rgba(255,252,248,0.9)' : 'rgba(32,28,22,0.42)'
    R.rr(cx, cy, cellW, cellH, 4 * S); ctx.fill()
    ctx.strokeStyle = owned ? 'rgba(212,175,55,0.55)' : 'rgba(90,75,55,0.45)'
    ctx.lineWidth = owned ? 1.5 * S : 0.5 * S
    R.rr(cx, cy, cellW, cellH, 4 * S); ctx.stroke()
    const iconH = cellW
    if (owned) {
      R.drawCoverImg(R.getImg(`assets/equipment/fabao_${wpn.id}.png`), cx + 2, cy + 2, cellW - 4, iconH - 4, { radius: 4 * S })
      drawCornerRarityBadge(ctx, R, S, cx + 3 * S, cy + 3 * S, rarityKey, wpn.attr, {
        minWidth: 18 * S,
        height: 10 * S,
        fontSize: 6.4 * S,
        radius: 2.6 * S,
      })
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.font = `${cellW * 0.4}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('?', cx + cellW / 2, cy + iconH / 2)
    }

    // 名称
    ctx.fillStyle = owned ? '#3a2f24' : 'rgba(255,255,255,0.55)'
    ctx.font = `${8*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(owned ? wpn.name : '???', cx + cellW / 2, cy + iconH + 9 * S)

    g._dexWpnCellRects.push({ id: wpn.id, x: cx, y: cy, w: cellW, h: cellH })
  }

  const totalRows = Math.ceil(wpnList.length / cols)
  g._dexTotalH = totalRows * (cellH + cellGap) + cellGap

  ctx.restore()
}

function _drawDexWeaponDetail(g) {
  const { ctx, R, W, H, S } = V
  const wpnId = g._dexDetailWpnId
  const wpn = getWeaponById(wpnId)
  if (!wpn) return
  const owned = (g.storage.weaponCollection || []).includes(wpnId)
  const rarityKey = getWeaponRarity(wpnId) || 'R'

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)

  const pw = W * 0.78
  const innerPad = 14 * S
  const iconSz = 64 * S
  const descText = owned ? wpn.desc : WEAPON_ACQUIRE_HINT_UNOWNED
  ctx.font = `${11*S}px "PingFang SC",sans-serif`
  const maxW = pw - innerPad * 2
  let descLines = 1
  let line = ''
  for (let ci = 0; ci < descText.length; ci++) {
    if (ctx.measureText(line + descText[ci]).width > maxW) {
      descLines++
      line = descText[ci]
    } else {
      line += descText[ci]
    }
  }
  const ph = innerPad * 2 + 70 * S + iconSz + 14 * S + descLines * 15 * S + 24 * S
  const px = (W - pw) / 2
  const py = (H - ph) / 2

  const grad = ctx.createLinearGradient(px, py, px, py + ph)
  grad.addColorStop(0, 'rgba(252,247,238,0.97)')
  grad.addColorStop(1, 'rgba(244,237,222,0.97)')
  ctx.fillStyle = grad
  R.rr(px, py, pw, ph, 12 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.55)'; ctx.lineWidth = 2 * S
  R.rr(px, py, pw, ph, 12 * S); ctx.stroke()

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#3a1a00'
  ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(owned ? wpn.name : '???', px + pw / 2, py + innerPad + 22 * S)
  if (owned) {
    drawInlineRarityBadge(ctx, R, S, px + pw / 2, py + innerPad + 28 * S, rarityKey, wpn.attr, {
      minWidth: 30 * S,
      height: 14 * S,
      fontSize: 8 * S,
    })
  }

  const iconX = px + (pw - iconSz) / 2
  const iconY = py + innerPad + 48 * S

  if (owned) {
    R.drawCoverImg(R.getImg(`assets/equipment/fabao_${wpn.id}.png`), iconX, iconY, iconSz, iconSz, { radius: 8 * S })
  } else {
    ctx.fillStyle = 'rgba(100,90,70,0.2)'
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); ctx.fill()
    ctx.fillStyle = '#bbb'; ctx.font = `${iconSz * 0.5}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('?', iconX + iconSz / 2, iconY + iconSz / 2)
  }
  R.drawWeaponFrame(iconX, iconY, iconSz)

  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = owned ? '#5c4330' : '#999'
  ctx.font = `${11*S}px "PingFang SC",sans-serif`
  let descY = iconY + iconSz + 14 * S
  line = ''
  for (let ci = 0; ci < descText.length; ci++) {
    if (ctx.measureText(line + descText[ci]).width > maxW) {
      ctx.fillText(line, px + innerPad, descY)
      line = descText[ci]; descY += 15 * S
    } else {
      line += descText[ci]
    }
  }
  if (line) ctx.fillText(line, px + innerPad, descY)

  ctx.fillStyle = '#999'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W / 2, py + ph - 10 * S)

  g._dexWpnDetailRect = [px, py, pw, ph]
  ctx.restore()
}

// ===== 宠物网格（全部 / 单属性） =====
function _drawDexPetGrid(g, contentTop, contentBottom) {
  const { ctx, R, TH, W, S } = V
  const scrollY = g._dexScrollY || 0

  ctx.save()
  ctx.beginPath(); ctx.rect(0, contentTop, W, contentBottom - contentTop); ctx.clip()

  const padX = 12 * S
  const cols = 5
  const cellGap = 4 * S
  const cellW = (W - padX * 2 - (cols - 1) * cellGap) / cols
  const cellH = cellW + 18 * S

  let y = contentTop + scrollY
  g._dexTotalH = 0
  g._dexCellRects = []

  const filterAttrs = g._dexTab === 'all' ? DEX_ATTRS : [g._dexTab]
  const attrProgress = getDexProgressByAttr(g.storage.petPool)

  for (const attr of filterAttrs) {
    const pets = PETS[attr]
    const ac = ATTR_COLOR[attr]
    const ap = attrProgress[attr]

    ctx.fillStyle = ac.main; ctx.font = `bold ${13 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(`${DEX_ATTR_LABEL[attr]}属性 (${ap.discovered}/${ap.total})`, padX, y + 13 * S)
    y += 20 * S

    const rows = Math.ceil(pets.length / cols)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        if (idx >= pets.length) break
        const pet = pets[idx]
        const cx = padX + c * (cellW + cellGap)
        const cy = y + r * (cellH + cellGap)
        // 屏外格子不绘制、不触发 getImg，避免「全部」Tab 单帧登记过多纹理导致 LRU 与真机解码跟不上
        if (cy + cellH < contentTop || cy > contentBottom) continue
        const tier = getPetDexTier(pet.id, g.storage.petPool)
        const tc = _TIER_COLORS[tier]
        const imgPad = 3 * S
        const imgSz = cellW - imgPad * 2

        // 卡片背景
        ctx.fillStyle = tc.bg
        ctx.beginPath(); R.rr(cx, cy, cellW, cellH, 4 * S); ctx.fill()

        if (tier === 'unknown') {
          // 问号剪影
          ctx.fillStyle = 'rgba(255,255,255,0.06)'
          ctx.beginPath(); ctx.arc(cx + cellW / 2, cy + cellW * 0.4, cellW * 0.25, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = TH.dim; ctx.font = `bold ${18 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          ctx.fillText('?', cx + cellW / 2, cy + cellW * 0.4 + 6 * S)
          ctx.fillStyle = tc.nameColor; ctx.font = `${8 * S}px "PingFang SC",sans-serif`
          ctx.fillText('???', cx + cellW / 2, cy + cellW + 10 * S)
        } else {
          // 头像
          const poolPet = g.storage.petPool.find(p => p.id === pet.id)
          const displayStar = poolPet ? poolPet.star : 1
          const fakePet = { id: pet.id, star: displayStar }
          const avatarPath = getPetAvatarPath(fakePet)
          R.drawCoverImg(R.getImg(avatarPath), cx + imgPad, cy + imgPad, imgSz, imgSz, { radius: 3 * S })

          if (tier === 'discovered') {
            // 半透明遮罩表示未完全收录
            ctx.fillStyle = 'rgba(0,0,0,0.35)'
            ctx.beginPath(); R.rr(cx + imgPad, cy + imgPad, imgSz, imgSz, 3 * S); ctx.fill()
            // 星级标记
            ctx.fillStyle = '#4a3828'; ctx.font = `bold ${7 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
            ctx.fillText(`★${displayStar}`, cx + cellW / 2, cy + imgSz - 1 * S)
          }

          if (tier === 'mastered') {
            // 金色边框
            ctx.strokeStyle = '#C8A832'; ctx.lineWidth = 1.5 * S
            ctx.beginPath(); R.rr(cx, cy, cellW, cellH, 4 * S); ctx.stroke()
          } else {
            ctx.strokeStyle = tc.border; ctx.lineWidth = 1 * S
            ctx.beginPath(); R.rr(cx, cy, cellW, cellH, 4 * S); ctx.stroke()
          }

          // 名字
          ctx.fillStyle = tc.nameColor; ctx.font = `${8 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          const shortName = pet.name.length > 4 ? pet.name.substring(0, 4) : pet.name
          ctx.fillText(shortName, cx + cellW / 2, cy + cellW - imgPad + 14 * S)

          // 可点击区域
          if (cy + cellH > contentTop && cy < contentBottom) {
            g._dexCellRects.push({ id: pet.id, attr, x: cx, y: cy, w: cellW, h: cellH })
          }

          // 新入池未查看的红点（仅发现及以上层级）
          const seen = g.storage.petDexSeen
          if (!seen.includes(pet.id)) {
            const dotR = 4 * S
            const dotX = cx + cellW - imgPad - dotR + 2 * S
            const dotY2 = cy + imgPad + dotR - 2 * S
            ctx.fillStyle = '#e04040'
            ctx.beginPath(); ctx.arc(dotX, dotY2, dotR, 0, Math.PI * 2); ctx.fill()
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 * S
            ctx.beginPath(); ctx.arc(dotX, dotY2, dotR, 0, Math.PI * 2); ctx.stroke()
          }
        }
      }
    }
    y += rows * (cellH + cellGap) + 8 * S
  }

  g._dexTotalH = y - scrollY - contentTop
  ctx.restore()
}

// ===== 里程碑面板 =====
function _drawDexMilestones(g, contentTop, contentBottom) {
  const { ctx, R, TH, W, S } = V
  const scrollY = g._dexMilestoneScrollY || 0
  const claimed = new Set(g.storage.dexMilestonesClaimed || [])
  const adRewardClaimed = new Set(g.storage.dexMilestonesAdRewardClaimed || [])
  const pool = g.storage.petPool

  ctx.save()
  ctx.beginPath(); ctx.rect(0, contentTop, W, contentBottom - contentTop); ctx.clip()

  const padX = 14 * S
  const cardW = W - padX * 2
  const cardH = 52 * S
  const cardGap = 6 * S
  let y = contentTop + scrollY + 4 * S
  g._dexMilestoneRects = []
  g._dexMilestoneTotalH = 0

  const sections = [
    { title: '属性收集', milestones: ELEM_MILESTONES },
    { title: '总量收集', milestones: TOTAL_MILESTONES },
    { title: '稀有度收集', milestones: RARITY_MILESTONES },
  ]

  for (const sec of sections) {
    ctx.fillStyle = '#5a3a08'; ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(sec.title, padX, y + 12 * S)
    y += 18 * S

    for (const m of sec.milestones) {
      const isClaimed = claimed.has(m.id)
      const { isMilestoneReached } = require('../data/dexConfig')
      const reached = isMilestoneReached(m, pool)
      const mx = padX, my = y

      // 卡片背景（浅色实底 + 描边，避免装饰底图冲淡文字）
      if (isClaimed) {
        ctx.fillStyle = 'rgba(246,242,234,0.96)'
      } else if (reached) {
        ctx.fillStyle = 'rgba(255,250,232,0.98)'
      } else {
        ctx.fillStyle = 'rgba(252,249,242,0.96)'
      }
      ctx.beginPath(); R.rr(mx, my, cardW, cardH, 6 * S); ctx.fill()

      if (reached && !isClaimed) {
        ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 1.5 * S
        ctx.beginPath(); R.rr(mx, my, cardW, cardH, 6 * S); ctx.stroke()
      } else {
        ctx.strokeStyle = isClaimed ? 'rgba(100,85,70,0.28)' : 'rgba(90,72,52,0.35)'
        ctx.lineWidth = 1 * S
        ctx.beginPath(); R.rr(mx, my, cardW, cardH, 6 * S); ctx.stroke()
      }

      // 描述
      ctx.fillStyle = isClaimed ? '#6b5e52' : '#2a221c'
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
      ctx.fillText(m.desc, mx + 8 * S, my + 16 * S)

      // 奖励/加成描述
      let rewardText = ''
      if (m.buff) {
        const parts = []
        if (m.buff.atkPct) parts.push(`ATK+${m.buff.atkPct}%`)
        if (m.buff.hpPct) parts.push(`HP+${m.buff.hpPct}%`)
        if (m.buff.defPct) parts.push(`DEF+${m.buff.defPct}%`)
        rewardText = parts.join(' ')
      }
      if (m.reward) {
        const parts = []
        if (m.reward.soulStone) parts.push(`${m.reward.soulStone}灵石`)
        if (m.reward.awakenStone) parts.push(`${m.reward.awakenStone}觉醒石`)
        rewardText = parts.join(' + ')
      }
      ctx.fillStyle = isClaimed ? '#8a7464' : '#a0280a'
      ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
      ctx.fillText(rewardText, mx + 8 * S, my + 32 * S)

      // 右侧：状态
      const btnW = 52 * S, btnH2 = 24 * S
      const btnX = mx + cardW - btnW - 8 * S
      const btnY = my + (cardH - btnH2) / 2
      const adW = 40 * S, adH = 20 * S
      const adX = btnX - adW - 4 * S
      const adY = my + (cardH - adH) / 2
      const showAdDouble = reached && m.reward && !adRewardClaimed.has(m.id)
      if (isClaimed) {
        ctx.fillStyle = '#5c5046'; ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('已领取', btnX + btnW / 2, btnY + btnH2 * 0.65)
      } else if (reached) {
        const bg = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH2)
        bg.addColorStop(0, '#d4a840'); bg.addColorStop(1, '#b8922e')
        ctx.fillStyle = bg
        ctx.beginPath(); R.rr(btnX, btnY, btnW, btnH2, 4 * S); ctx.fill()
        ctx.fillStyle = '#fff'; ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
        ctx.fillText('领取', btnX + btnW / 2, btnY + btnH2 * 0.68)
        if (my + cardH > contentTop && my < contentBottom) {
          g._dexMilestoneRects.push({ id: m.id, x: btnX, y: btnY, w: btnW, h: btnH2 })
        }
      } else {
        ctx.fillStyle = '#5a4530'; ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText('未达成', btnX + btnW / 2, btnY + btnH2 * 0.65)
      }

      // IAA 翻倍：已达成、有货币奖励、且本档广告额外奖励未领过（先领基础或先看广告均可，各档仅一次额外）
      if (showAdDouble) {
        R.drawDialogBtn(adX, adY, adW, adH, '翻倍', 'adReward')
        if (my + cardH > contentTop && my < contentBottom) {
          g._dexMilestoneRects.push({ id: `ad_${m.id}`, type: 'ad_double', milestoneId: m.id, x: adX, y: adY, w: adW, h: adH })
        }
      }

      y += cardH + cardGap
    }
    y += 6 * S
  }

  g._dexMilestoneTotalH = y - scrollY - contentTop
  ctx.restore()
}

// ===== 图鉴宠物详情弹窗（重设计版） =====
function _drawDexPetDetail(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const petId = g._dexDetailPetId
  let pet = null, petAttr = ''
  for (const attr of DEX_ATTRS) {
    const found = PETS[attr].find(p => p.id === petId)
    if (found) { pet = found; petAttr = attr; break }
  }
  if (!pet) { g._dexDetailPetId = null; return }

  const tier = getPetDexTier(petId, g.storage.petPool)
  const poolPet = g.storage.petPool.find(p => p.id === petId)
  const ac = ATTR_COLOR[petAttr]
  const rarity = getPetRarity(petId)
  const rv = RARITY_VISUAL[rarity] || RARITY_VISUAL.R

  // 根据层级决定展示内容
  const displayStar = poolPet ? poolPet.star : 1
  const fakePet = { id: petId, star: displayStar, attr: petAttr, skill: pet.skill, atk: pet.atk, cd: pet.cd }
  const showSkill = tier === 'collected' || tier === 'mastered'
  // 轶事与旧版图鉴一致：只要已发现（入池）即可阅读，不限制「精通」层
  const showLore = tier !== 'unknown'
  const showAtk = tier !== 'unknown'

  const lore = showLore ? getPetLore(petId) : ''
  const skillDesc = showSkill ? (getPetSkillDesc(fakePet) || pet.skill.desc) : ''

  // 遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)

  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const pad = 14 * S
  const maxTextW = panelW - pad * 2
  const imgSize = Math.min(panelW * 0.45, H * 0.26)
  const gapH = 6 * S

  const loreLines = showLore ? _wrapTextDex(lore, maxTextW, 11) : []
  const skillLines = showSkill ? _wrapTextDex(skillDesc, maxTextW - 8 * S, 10) : []

  // 计算面板高度
  let panelH = pad + imgSize + gapH + 18 * S + 14 * S + gapH
  if (showSkill) panelH += 16 * S + skillLines.length * 12 * S + gapH
  if (showLore && loreLines.length > 0) panelH += gapH + 16 * S + loreLines.length * 13 * S + gapH
  panelH += 36 * S + 18 * S + pad

  const maxPanelH = H - safeTop - 10 * S
  const finalH = Math.min(panelH, maxPanelH)
  const panelY = Math.max(safeTop + 5 * S, (H - finalH) / 2)
  const rad = 14 * S

  const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + finalH)
  bgGrad.addColorStop(0, 'rgba(248,242,230,0.97)')
  bgGrad.addColorStop(0.5, 'rgba(244,237,224,0.97)')
  bgGrad.addColorStop(1, 'rgba(238,230,218,0.97)')
  ctx.fillStyle = bgGrad
  ctx.beginPath(); R.rr(panelX, panelY, panelW, finalH, rad); ctx.fill()
  ctx.strokeStyle = tier === 'mastered' ? 'rgba(200,168,50,0.6)' : 'rgba(201,168,76,0.4)'
  ctx.lineWidth = tier === 'mastered' ? 2 * S : 1.5 * S
  ctx.beginPath(); R.rr(panelX, panelY, panelW, finalH, rad); ctx.stroke()

  g._dexDetailRect = [panelX, panelY, panelW, finalH]

  ctx.save()
  ctx.beginPath(); R.rr(panelX, panelY, panelW, finalH, rad); ctx.clip()

  let curY = panelY + pad

  // 层级标签
  const tierLabels = { mastered: '精通', collected: '收录', discovered: '发现' }
  const tierLabel = tierLabels[tier] || '未知'
  const tierBadgeW = 40 * S, tierBadgeH = 18 * S
  const tierBadgeX = panelX + panelW - pad - tierBadgeW
  ctx.fillStyle = tier === 'mastered' ? 'rgba(200,160,40,0.2)' : tier === 'collected' ? 'rgba(160,140,100,0.15)' : 'rgba(120,100,80,0.1)'
  ctx.beginPath(); R.rr(tierBadgeX, curY, tierBadgeW, tierBadgeH, 3 * S); ctx.fill()
  ctx.fillStyle = tier === 'mastered' ? '#C89510' : tier === 'collected' ? '#a08060' : '#807060'
  ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(tierLabel, tierBadgeX + tierBadgeW / 2, curY + tierBadgeH * 0.68)

  // 品质标签
  const rarBadgeX = panelX + pad
  ctx.fillStyle = rv.tagBg || 'rgba(100,80,60,0.15)'
  ctx.beginPath(); R.rr(rarBadgeX, curY, 30 * S, tierBadgeH, 3 * S); ctx.fill()
  ctx.fillStyle = rv.color || '#a08060'; ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(rv.label || rarity, rarBadgeX + 15 * S, curY + tierBadgeH * 0.68)

  const avatarPath = getPetAvatarPath(fakePet)
  const imgX = (W - imgSize) / 2
  const imgY = curY + tierBadgeH + 4 * S
  R.drawCoverImg(R.getImg(avatarPath), imgX, imgY, imgSize, imgSize, { radius: 8 * S })
  if (tier === 'discovered') {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath(); R.rr(imgX, imgY, imgSize, imgSize, 8 * S); ctx.fill()
  }
  curY = imgY + imgSize + gapH

  // 名称 + 星级
  const nameFs = 14 * S
  const starStr = '★'.repeat(displayStar)
  ctx.font = `bold ${nameFs}px "PingFang SC",sans-serif`
  const nameW = ctx.measureText(pet.name).width
  ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  const starW = ctx.measureText(starStr).width
  const totalNameW = nameW + 4 * S + starW
  const nameStartX = W * 0.5 - totalNameW / 2
  ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${nameFs}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
  ctx.fillText(pet.name, nameStartX, curY + 13 * S)
  ctx.fillStyle = '#C89510'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  ctx.fillText(starStr, nameStartX + nameW + 4 * S, curY + 13 * S)
  curY += 18 * S

  // 属性 + ATK
  if (showAtk) {
    const orbR = 6 * S
    const atkStr = poolPet ? String(getPoolPetAtk(poolPet)) : String(pet.atk)
    ctx.font = `${10 * S}px "PingFang SC",sans-serif`
    const atkLabelW = ctx.measureText('ATK：').width
    ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
    const atkValW = ctx.measureText(atkStr).width
    const blockW = orbR * 2 + 6 * S + atkLabelW + atkValW
    const startX = W * 0.5 - blockW / 2
    R.drawBead(startX + orbR, curY + 8 * S, orbR, petAttr, 0)
    ctx.fillStyle = '#6B5B50'; ctx.font = `${11 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText('ATK：', startX + orbR * 2 + 6 * S, curY + 11 * S)
    ctx.fillStyle = '#c06020'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    ctx.fillText(atkStr, startX + orbR * 2 + 6 * S + atkLabelW, curY + 11 * S)
  }
  curY += 14 * S + gapH

  // 技能（收录及以上）
  if (showSkill) {
    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(`技能：${pet.skill.name}  CD ${pet.cd}`, panelX + pad, curY + 11 * S)
    curY += 16 * S
    _drawHighlightedLines(ctx, skillLines, panelX + pad + 4 * S, curY, 12 * S, 10 * S, S)
    curY += skillLines.length * 12 * S + gapH
    ctx.strokeStyle = 'rgba(160,140,100,0.25)'; ctx.lineWidth = 1 * S
    ctx.beginPath(); ctx.moveTo(panelX + pad, curY); ctx.lineTo(panelX + panelW - pad, curY); ctx.stroke()
    curY += gapH
  }

  // 轶事 / 小故事（已发现即可）
  if (showLore && loreLines.length > 0) {
    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText('轶事', panelX + pad, curY + 11 * S)
    curY += 16 * S
    ctx.fillStyle = '#5C4A3A'; ctx.font = `${11 * S}px "PingFang SC",sans-serif`
    loreLines.forEach(line => {
      ctx.fillText(line, panelX + pad, curY + 10 * S)
      curY += 13 * S
    })
    curY += gapH
  }

  // 底部按钮：查看详情（跳转灵宠池）
  const btnH = 34 * S, btnW = panelW * 0.6, btnBtnX = (W - btnW) / 2
  if (tier !== 'unknown') {
    const bg = ctx.createLinearGradient(btnBtnX, curY, btnBtnX, curY + btnH)
    bg.addColorStop(0, '#d4a840'); bg.addColorStop(1, '#b8922e')
    ctx.fillStyle = bg
    ctx.beginPath(); R.rr(btnBtnX, curY, btnW, btnH, 8 * S); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('查看详情', W * 0.5, curY + btnH * 0.5)
    ctx.textBaseline = 'alphabetic'
    g._dexDetailBtnRect = [btnBtnX, curY, btnW, btnH]
  } else {
    // 未发现：激励/模板广告入口
    g._dexDetailBtnRect = null
    R.drawDialogBtn(btnBtnX, curY, btnW, btnH, '查看获取途径', 'adReward')
    ctx.textBaseline = 'alphabetic'
    g._dexAdHintBtnRect = [btnBtnX, curY, btnW, btnH]
  }

  ctx.restore()

  ctx.fillStyle = '#9B8B80'; ctx.font = `${9 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击其他区域关闭', W * 0.5, panelY + finalH - 6 * S)

  ctx.restore()

  g.storage.markDexSeen(petId)
}

// 带数值高亮的文本行
function _drawHighlightedLines(ctx, lines, x, startY, lineH, fontSize, S) {
  let y = startY
  const normalColor = '#5C4A3A', highlightColor = '#c06020'
  const font = `${fontSize}px "PingFang SC",sans-serif`
  const boldFont = `bold ${fontSize}px "PingFang SC",sans-serif`
  const numRe = /(\d+[\d.]*%?倍?)/g

  lines.forEach(line => {
    ctx.textAlign = 'left'
    let cx = x, lastIdx = 0, match
    numRe.lastIndex = 0
    while ((match = numRe.exec(line)) !== null) {
      if (match.index > lastIdx) {
        const before = line.substring(lastIdx, match.index)
        ctx.fillStyle = normalColor; ctx.font = font
        ctx.fillText(before, cx, y + fontSize * 0.9)
        cx += ctx.measureText(before).width
      }
      ctx.fillStyle = highlightColor; ctx.font = boldFont
      ctx.fillText(match[0], cx, y + fontSize * 0.9)
      cx += ctx.measureText(match[0]).width
      lastIdx = match.index + match[0].length
    }
    if (lastIdx < line.length) {
      ctx.fillStyle = normalColor; ctx.font = font
      ctx.fillText(line.substring(lastIdx), cx, y + fontSize * 0.9)
    }
    if (lastIdx === 0) {
      ctx.fillStyle = normalColor; ctx.font = font
      ctx.fillText(line, x, y + fontSize * 0.9)
    }
    y += lineH
  })
}

// ===== 图鉴首次介绍卡（小灵讲解口吻） =====
const _DEX_INTRO_CARDS = [
  {
    subLabel: '第 1/2 课 · 灵兽图鉴',
    title: '灵兽图鉴是什么',
    lines: [
      '主人～ 灵兽入池就算「发现」，',
      '把它升到★3 就算「收录」，',
      '★5 满星即「精通」，还能解锁背景故事！',
    ],
    note: '☆ 主人收的灵兽越多，永久属性加成越丰厚',
  },
  {
    subLabel: '第 2/2 课 · 里程碑',
    title: '里程碑奖励',
    lines: [
      '小灵按属性、总量、稀有度三条路帮主人记账；',
      '达成里程碑就能领到全队永久加成~',
      '到「里程碑」标签里瞧瞧目标吧！',
    ],
    note: '✦ ATK / HP / DEF 永久提升，越收集越强',
  },
]

function _drawDexIntro(g) {
  const { ctx, R, W, H, S } = V
  const page = g._dexIntroPage
  const card = _DEX_INTRO_CARDS[page]
  if (!card) return

  g._dexIntroAlpha = Math.min(1, (g._dexIntroAlpha || 0) + 0.08)
  g._dirty = true
  const alpha = g._dexIntroAlpha
  const af = g.af || 0

  ctx.save()
  ctx.globalAlpha = alpha * 0.72; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = alpha

  const pw = Math.min(W - 32 * S, 360 * S)
  const bodyFs = 14 * S
  const lineH = 26 * S
  const textMaxW = pw - 40 * S
  ctx.font = `${bodyFs}px "PingFang SC",sans-serif`
  const lines = []
  ;(card.lines || []).forEach(line => {
    wrapText(ctx, line, textMaxW).forEach(l => lines.push(l))
  })
  const headerH = 50 * S
  const titleH = 46 * S
  const bodyH = lines.length * lineH
  const noteH = card.note ? 30 * S : 0
  const footerH = 46 * S
  const ph = headerH + titleH + bodyH + noteH + footerH
  const px = (W - pw) / 2
  const py = (H - ph) / 2 - 10 * S

  drawLingCard(ctx, S, px, py, pw, ph, {
    avatarImg: R.getImg(LING.avatar),
    speaker: LING.speaker,
    subLabel: card.subLabel,
    title: card.title,
    lines,
    note: card.note,
    fontSizeBody: bodyFs,
    lineH,
    pageIdx: page,
    totalPages: _DEX_INTRO_CARDS.length,
    continueText: page >= _DEX_INTRO_CARDS.length - 1 ? '点击进入图鉴 ›' : '点击继续 ›',
    animT: alpha,
    pulseT: af * 0.1,
  })

  ctx.restore()
}

// 图鉴文本换行辅助
function _wrapTextDex(text, maxW, fontSize) {
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
      result.push(line); line = ch; lineW = cw
    } else {
      line += ch; lineW += cw
    }
  }
  if (line) result.push(line)
  return result.length > 0 ? result : ['']
}

const { hitTestRankingTab } = require('./rankingTabHit')

const _goScroll = {
  get viewport() { return _goScrollViewport },
  get max() { return _goScrollMax },
  get() { return _goScrollY },
  set(v) {
    _goScrollY = Math.max(0, Math.min(_goScrollMax, v))
  },
  active: false, startY: 0, lastY: 0, moved: false,
}

module.exports = {
  rLoading, rTitle, rGameover, rRanking,
  rReward, rShop, rRest, rAdventure,
  drawBackBtn, drawNewRunConfirm, rDex,
  hitTestRankingTab,
  _goScroll,
  _resolveFetchTab,
}
