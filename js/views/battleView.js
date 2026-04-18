/**
 * 战斗界面渲染 — 纯调度器
 * 所有绘制逻辑拆分至 ./battle/ 子模块
 */
const V = require('./env')
const { isCurrentUserGM } = require('../data/gmConfig')
const tutorial = require('../engine/tutorial')
const { drawLingCard, wrapText } = require('./uiComponents')
const { LING } = require('../data/lingIdentity')
const buttonFx = require('./buttonFx')

const { getBattleLayout } = require('./battle/battleLayout')
const { drawBattleEnemyArea } = require('./battle/battleEnemyView')
const { initOrbAttackTip } = require('./battle/battleOrbTipView')
const { drawPetSkillWave, drawSkillFlash, drawSkillPreviewPopup } = require('./battle/battleSkillVfxView')
const { drawCasterGlow, drawSkillEffectFx, drawPetBadges } = require('./battle/battleSkillEffectView')
const { drawBattleStatusBars } = require('./battle/battleStatusBar')
const { drawCombo } = require('./battle/battleComboView')
const { drawHelpButton, drawBattleHelpPanel } = require('./battle/battleHelpView')
const { drawBattleUIControls, drawExpFloats } = require('./battle/battleUIControlsView')
const { drawBoard, drawWaveTransition, drawDragTimer, drawEnemyTurnBanner, drawAttrCoverageBar } = require('./battle/battleBoardView')
const { drawNewbieFingerGuide, drawNewbieHint, drawNewbieComboBanner } = require('./battle/battleNewbieGuide')
const { drawTeamBar, drawPetSlotFloats, drawBuffIcons, drawBuffIconsLabeled, drawRunBuffIcons } = require('./battle/battleTeamBarView')
const { drawVictoryOverlay, drawDefeatOverlay, drawAdReviveOverlay, drawFreeReviveOverlay } = require('./battle/battleVictoryView')
const { drawRewardDetailOverlay, drawItemMenu } = require('./battle/battleRewardDetailView')
const { drawTutorialOverlay } = require('./battle/battleTutorialView')

function rBattle(g) {
  const { ctx, R, W, H, S, safeTop } = V
  R.drawBattleBg(g.af)
  const padX = 8 * S
  const { cellSize, boardPad, boardTop, iconSize, teamBarH, hpBarH, hpBarY, teamBarY, eAreaTop, eAreaBottom } = getBattleLayout()
  g.cellSize = cellSize; g.boardX = boardPad; g.boardY = boardTop
  const exitBtnSize = 32 * S

  initOrbAttackTip(g)

  if (g.enemy) drawBattleEnemyArea(g, eAreaTop, eAreaBottom)
  drawBattleUIControls(g, eAreaTop, eAreaBottom, teamBarY, exitBtnSize, drawBuffIconsLabeled)

  drawTeamBar(g, teamBarY, teamBarH, iconSize)
  R.drawHp(padX, hpBarY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', g._heroHpLoss, true, '#4dcc4d', g.heroShield, g._heroHpGain, g.af)
  drawAttrCoverageBar(g, hpBarY + hpBarH + 1 * S, boardTop, padX)
  drawPetSlotFloats(g)
  if (g._isNewbieStage) drawNewbieHint(g, eAreaBottom, W)
  drawBoard(g)
  if (g._isNewbieStage) drawNewbieFingerGuide(g, cellSize, boardPad, boardTop)
  g.elimFloats.forEach(f => R.drawElimFloat(f))
  drawExpFloats(g)
  drawCombo(g, cellSize, boardTop)
  if (g._newbieComboBanner) drawNewbieComboBanner(g, boardTop, padX)
  _drawMechanicOverlay(g, S, W, safeTop, boardTop, eAreaBottom)
  // 玩家被眩晕时的"三件套"：顶部金色横幅 + 棋盘紫灰蒙层（头像图标由 battleStatusBar 兜底）
  _drawHeroStunOverlay(g, S, W, H, safeTop, boardTop)
  // 持续状态栏：画在特效层下面，避免被 skill flash 遮挡
  drawBattleStatusBars(g)
  // 技能 vfx 渲染顺序：L1 脚下光晕 → L1 飞行光波 → L2 效果层 → L1 快闪技能名（最上）
  if (g._casterGlow) drawCasterGlow(g)
  if (g._petSkillWave) drawPetSkillWave(g)
  drawSkillEffectFx(g)
  if (g._skillFlash) drawSkillFlash(g)
  // 宠物头顶 badge 飘字：预载 "×2 火" / 生效 "xx 发动"（在快闪之上，玩家一定看得见）
  drawPetBadges(g)
  if (g.dragging && g.bState === 'playerTurn') drawDragTimer(g, cellSize, boardTop)
  if (g._pendingEnemyAtk && g.bState === 'playerTurn') drawEnemyTurnBanner(g)

  g._debugSkipRect = null
  g._gmSkipRect = null

  const _isGM = g._isGM || isCurrentUserGM()
  if (_isGM) g._isGM = true
  if (_isGM && (g.bState === 'playerTurn' || g.bState === 'enemyTurn')) {
    const gmBtnW = 60*S, gmBtnH = 28*S
    const gmBtnX = 76*S, gmBtnY = safeTop + 8*S
    ctx.save()
    ctx.fillStyle = 'rgba(200,30,60,0.85)'
    R.rr(gmBtnX, gmBtnY, gmBtnW, gmBtnH, 8*S); ctx.fill()
    ctx.strokeStyle = '#ff6688'; ctx.lineWidth = 1*S
    R.rr(gmBtnX, gmBtnY, gmBtnW, gmBtnH, 8*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('GM\u8df3\u8fc7', gmBtnX + gmBtnW/2, gmBtnY + gmBtnH/2)
    ctx.restore()
    g._gmSkipRect = [gmBtnX, gmBtnY, gmBtnW, gmBtnH]
  }

  if (g.bState === 'waveTransition') drawWaveTransition(g)
  if (g.bState === 'victory' && !tutorial.isActive()) drawVictoryOverlay(g)
  if (g.bState === 'defeat') drawDefeatOverlay(g)
  if (g.bState === 'freeReviveOffer') drawFreeReviveOverlay(g)
  if (g.bState === 'adReviveOffer') drawAdReviveOverlay(g)
  if (g.showEnemyDetail) g._drawEnemyDetailDialog()
  if (g.showExitDialog) g._drawExitDialog()
  if (g.showWeaponDetail) g._drawWeaponDetailDialog()
  if (g.showBattlePetDetail != null) g._drawBattlePetDetailDialog()
  if (g.skillPreview) drawSkillPreviewPopup(g)
  if (g.runBuffDetail) g._drawRunBuffDetailDialog()
  if (g._showItemMenu) drawItemMenu(g)
  if (g._rewardDetailShow) drawRewardDetailOverlay(g)

  if (g.bState !== 'victory' && g.bState !== 'defeat' && g.bState !== 'freeReviveOffer' && g.bState !== 'adReviveOffer') {
    drawHelpButton(g, safeTop)
  }
  if (g._showBattleHelp) drawBattleHelpPanel(g)

  // 小灵讲堂（1-2/1-3 首通前的阻塞讲解卡）最上层，遮挡所有战场 UI，等玩家点一下才消失
  if (g._stageIntroCard) _drawStageIntroCard(g)
}

// ===== 玩家眩晕三件套（顶部金色横幅 + 棋盘紫灰蒙层） =====
// 头像 icon 由 battleStatusBar.drawBattleStatusBars 画（已在 heroBuffs 里有 heroStun）
// 此处只负责：
//   1. 顶部金色半透横幅 + 警示文字 + 头顶星星粒子
//   2. 棋盘紫灰蒙层 + 淡紫"禁止"斜纹
// 确保玩家绝不会误以为游戏卡死
function _drawHeroStunOverlay(g, S, W, H, safeTop, boardTop) {
  if (!g || !g.heroBuffs) return
  const stunBuff = g.heroBuffs.find(b => b.type === 'heroStun')
  if (!stunBuff) return
  if (g.bState === 'victory' || g.bState === 'defeat') return
  const { ctx } = V
  const af = g.af || 0

  // —— 顶部金色半透横幅（60*S 高，贴 safeTop 下方） ——
  const bannerH = 42 * S
  const by = safeTop + 40 * S
  ctx.save()
  // 金色渐变底
  const grd = ctx.createLinearGradient(0, by, 0, by + bannerH)
  grd.addColorStop(0, 'rgba(80,50,15,0.72)')
  grd.addColorStop(0.5, 'rgba(140,90,25,0.82)')
  grd.addColorStop(1, 'rgba(80,50,15,0.72)')
  ctx.fillStyle = grd
  ctx.fillRect(0, by, W, bannerH)
  // 上下金线
  const lineGrd = ctx.createLinearGradient(0, 0, W, 0)
  lineGrd.addColorStop(0, 'rgba(240,200,80,0)')
  lineGrd.addColorStop(0.5, 'rgba(255,220,100,0.95)')
  lineGrd.addColorStop(1, 'rgba(240,200,80,0)')
  ctx.fillStyle = lineGrd
  ctx.fillRect(0, by, W, 1.5 * S)
  ctx.fillRect(0, by + bannerH - 1.5 * S, W, 1.5 * S)
  // 文字
  ctx.fillStyle = '#ffe082'
  ctx.strokeStyle = 'rgba(30,18,6,0.8)'
  ctx.lineWidth = 2.2 * S
  ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const msg = `眩晕中，本回合无法操作（${stunBuff.dur || 1} 回合）`
  ctx.strokeText(msg, W * 0.5, by + bannerH * 0.5)
  ctx.fillText(msg, W * 0.5, by + bannerH * 0.5)
  // 左右环绕小星粒
  for (let i = 0; i < 6; i++) {
    const ang = af * 0.05 + i * (Math.PI / 3)
    const r = 70 * S
    const sx = W * 0.5 + Math.cos(ang) * r
    const sy = by + bannerH * 0.5 + Math.sin(ang) * 6 * S
    const alpha = 0.5 + 0.4 * Math.sin(af * 0.09 + i)
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ffeecc'
    ctx.beginPath(); ctx.arc(sx, sy, 1.8 * S, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  // —— 棋盘紫灰蒙层 ——
  if (g.boardX != null && g.cellSize) {
    const boardW = g.cellSize * V.COLS
    const boardH = g.cellSize * V.ROWS
    ctx.save()
    ctx.fillStyle = 'rgba(50,30,80,0.42)'
    ctx.fillRect(g.boardX, g.boardY, boardW, boardH)
    // 淡紫色斜纹禁止符
    ctx.globalAlpha = 0.18
    ctx.strokeStyle = '#c8a4ff'
    ctx.lineWidth = 3 * S
    const step = 24 * S
    ctx.beginPath()
    for (let x = -boardH; x < boardW; x += step) {
      ctx.moveTo(g.boardX + x, g.boardY)
      ctx.lineTo(g.boardX + x + boardH, g.boardY + boardH)
    }
    ctx.stroke()
    // 中心"无法操作"圆环
    ctx.globalAlpha = 0.78
    const cx = g.boardX + boardW / 2
    const cy = g.boardY + boardH / 2
    const rOuter = 34 * S
    ctx.strokeStyle = '#c8a4ff'
    ctx.lineWidth = 4 * S
    ctx.beginPath(); ctx.arc(cx, cy, rOuter, 0, Math.PI * 2); ctx.stroke()
    // 禁止斜杠
    ctx.lineWidth = 4 * S
    ctx.beginPath()
    ctx.moveTo(cx - rOuter * 0.7, cy - rOuter * 0.7)
    ctx.lineTo(cx + rOuter * 0.7, cy + rOuter * 0.7)
    ctx.stroke()
    ctx.restore()
  }
}

// ===== 小灵讲堂 · 阻塞式新机制讲解卡（drawLingCard 模态） =====
function _drawStageIntroCard(g) {
  const { ctx, W, H, S, R } = V
  const card = g._stageIntroCard
  if (!card) return
  const teach = LING.teach && LING.teach.stageCards && LING.teach.stageCards[card.stageId]
  if (!teach) { g._stageIntroCard = null; return }

  // 入场动画 + armed 标记（确保第一帧不会被 touch start 误关）
  card.animT = Math.min(1, (card.animT || 0) + 0.08)
  if (card.animT > 0.5) card.armed = true

  ctx.save()
  ctx.globalAlpha = card.animT * 0.72
  ctx.fillStyle = '#0a0814'
  ctx.fillRect(0, 0, W, H)
  ctx.globalAlpha = card.animT

  const bodyFs = 13.5 * S
  const lineH = 25 * S
  const pw = Math.min(W - 32 * S, 360 * S)
  const textMaxW = pw - 40 * S
  ctx.font = `${bodyFs}px "PingFang SC",sans-serif`
  const wrapped = []
  ;(teach.lines || []).forEach(line => {
    wrapText(ctx, line, textMaxW).forEach(l => wrapped.push(l))
  })
  const headerH = 50 * S
  const titleH = 46 * S
  const bodyH = wrapped.length * lineH
  const noteH = teach.note ? 30 * S : 0
  const footerH = 46 * S
  const ph = headerH + titleH + bodyH + noteH + footerH
  const px = (W - pw) / 2
  const py = (H - ph) / 2 - 10 * S

  drawLingCard(ctx, S, px, py, pw, ph, {
    avatarImg: R.getImg(LING.avatar),
    speaker: LING.speaker,
    subLabel: teach.subLabel,
    title: teach.title,
    lines: wrapped,
    note: teach.note,
    fontSizeBody: bodyFs,
    lineH,
    pageIdx: 0,
    totalPages: 1,
    continueText: '点击开战 ›',
    animT: card.animT,
    pulseT: g.af * 0.1,
  })

  ctx.restore()
}

// 供 tBattle 调用：关闭讲解卡（动画到位后）
function dismissStageIntroCard(g) {
  if (!g._stageIntroCard) return false
  if (!g._stageIntroCard.armed) return true // 吃掉点击但不关，等动画
  g._stageIntroCard = null
  g._dirty = true
  return true
}

// ===== 技巧聚焦：开场提示 + 挑战目标条 + 回合/S线 =====
function _drawMechanicOverlay(g, S, W, safeTop, boardTop, eAreaBottom) {
  const { ctx, R } = V
  // 开场提示（小灵横条 · 非阻塞 · 自动淡出）—— 1-4 ~ 1-8 用
  const tip = g._mechanicOpenTip
  if (tip) {
    tip.timer++
    const dur = 180
    if (tip.timer > dur) { g._mechanicOpenTip = null }
    else {
      // 从 LING.teach.stageTips 取小灵口吻的教学语，不存在则回退 tip.text
      const teachTips = LING.teach && LING.teach.stageTips
      const text = (teachTips && teachTips[tip.stageId]) || tip.text || ''
      const alpha = tip.timer < 20 ? tip.timer / 20 : tip.timer > dur - 20 ? (dur - tip.timer) / 20 : 1
      ctx.save()
      ctx.globalAlpha = alpha

      const bh = 52 * S
      const by = boardTop - bh - 6 * S
      // 底板：上下金线 + 半透黑底（对齐 drawLingCard 的纸色金线调性，但更轻量）
      ctx.fillStyle = 'rgba(10,8,20,0.78)'
      ctx.fillRect(0, by, W, bh)
      const lineGrad = ctx.createLinearGradient(0, 0, W, 0)
      lineGrad.addColorStop(0, 'rgba(200,160,60,0)')
      lineGrad.addColorStop(0.5, 'rgba(220,180,80,0.85)')
      lineGrad.addColorStop(1, 'rgba(200,160,60,0)')
      ctx.fillStyle = lineGrad
      ctx.fillRect(0, by, W, 1 * S)
      ctx.fillRect(0, by + bh - 1 * S, W, 1 * S)

      // 小灵小头像（左侧圆形 + 金边）
      const ar = 18 * S
      const acx = 20 * S + ar
      const acy = by + bh * 0.5
      ctx.save()
      ctx.beginPath()
      ctx.arc(acx, acy, ar + 1.5 * S, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(220,180,80,0.9)'; ctx.fill()
      ctx.beginPath()
      ctx.arc(acx, acy, ar, 0, Math.PI * 2)
      ctx.clip()
      const img = R.getImg(LING.avatar)
      if (img && img.width > 0) {
        ctx.drawImage(img, acx - ar, acy - ar, ar * 2, ar * 2)
      } else {
        ctx.fillStyle = '#ffe082'
        ctx.fillRect(acx - ar, acy - ar, ar * 2, ar * 2)
      }
      ctx.restore()

      // 说话人小标签 + 正文（文字左对齐，留头像宽度）
      const textLeft = acx + ar + 10 * S
      ctx.fillStyle = 'rgba(220,180,80,0.8)'
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(LING.speaker, textLeft, by + 18 * S)

      ctx.fillStyle = '#ffe082'
      ctx.font = `bold ${12.5 * S}px "PingFang SC",sans-serif`
      ctx.textBaseline = 'middle'
      ctx.fillText(text, textLeft, by + bh * 0.66)

      // S 评级目标（仍居中，但位置略下调避免撞头像）
      if (g._stageRatingS > 0) {
        ctx.fillStyle = '#b0bec5'
        ctx.font = `${9.5 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'right'
        ctx.fillText(`S ≤${g._stageRatingS} 回合`, W - 14 * S, by + 18 * S)
      }
      ctx.restore()
    }
  }
  // 挑战目标胶囊（挂在敌人 HP 条上方 · 不遮任何血条/头像/棋盘）
  //   · 位置从"棋盘顶上方"改为"敌人 HP 条上方 2*S"（敌人立绘底部地面区）
  //     旧位置会整条压住队友 100/110 血条；新位置只叠在敌人立绘下半，不挡任何核心 UI
  //   · 右对齐金色胶囊，宽度随文字自适应；完成后向右滑出淡掉，不再占位
  //   · 用 threshold/progress 显示进度（"★ 达成 2 连击  0/1"）
  //   · 完成瞬间胶囊变绿 + 一次金星爆点，满足"显眼"
  const mf = g._mechanicFocus
  if (mf && mf.challenge && g.bState !== 'victory' && g.bState !== 'defeat') {
    _drawChallengeCapsule(g, S, W, eAreaBottom)
  }
  // 回合计数 / S 线：居中放在关卡标题条下方（与 battleEnemyView 的 floor_label 几何一致），避免右上角被微信胶囊遮挡。
  if (g.battleMode === 'stage' && g._stageRatingS > 0 && g.bState !== 'victory' && g.bState !== 'defeat') {
    ctx.save()
    const turns = (g._stageTotalTurns || 0) + (g.turnCount || 0)
    const sLine = g._stageRatingS
    const onTrack = turns <= sLine
    const { eAreaTop } = getBattleLayout()
    const labelW = W * 0.45
    const labelH = labelW / 4
    const labelY = eAreaTop + 2 * S
    const turnCy = labelY + labelH + 11 * S
    const text = `回合 ${turns}/${sLine}`
    ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const tw = ctx.measureText(text).width
    const padX = 10 * S
    const pillH = 22 * S
    const pillW = tw + padX * 2
    const pillX = W * 0.5 - pillW * 0.5
    const pillY = turnCy - pillH * 0.5
    ctx.fillStyle = onTrack ? 'rgba(40,85,50,0.88)' : 'rgba(95,55,18,0.9)'
    R.rr(pillX, pillY, pillW, pillH, pillH * 0.5)
    ctx.fill()
    ctx.strokeStyle = onTrack ? 'rgba(130,210,140,0.85)' : 'rgba(255,190,100,0.8)'
    ctx.lineWidth = 1.2 * S
    R.rr(pillX, pillY, pillW, pillH, pillH * 0.5)
    ctx.stroke()
    ctx.fillStyle = onTrack ? '#e8ffec' : '#ffe8cc'
    ctx.fillText(text, W * 0.5, turnCy)
    ctx.restore()
  }
}

// ===== 挑战目标胶囊（右对齐 · 完成淡出 · 不遮核心 UI） =====
//   为什么拆成独立函数：逻辑（完成动画/爆点/淡出）比原来复杂，塞在 _drawMechanicOverlay 里会压行；
//   且以后可能复用到关卡选择页的"目标预览"。
function _drawChallengeCapsule(g, S, W, eAreaBottom) {
  const { ctx } = V
  const ch = g._mechanicFocus.challenge
  const done = !!g._challengeDone

  // 完成后的淡出计时（首帧记录并触发一次金星）
  if (done) {
    if (g._challengeDoneAnimT == null) {
      g._challengeDoneAnimT = 0
      g._challengeDoneJustFired = false
    }
    g._challengeDoneAnimT++
  } else if (g._challengeDoneAnimT != null) {
    // 新的一关/新的 wave：状态清理在 stageManager 的 reset 里做
  }

  // 淡出控制：完成 60 帧后进入淡出期，120 帧彻底隐藏
  const doneT = g._challengeDoneAnimT || 0
  if (done && doneT > 120) return
  let fadeOutAlpha = 1
  let slideOutX = 0
  if (done && doneT > 60) {
    const p = (doneT - 60) / 60
    fadeOutAlpha = 1 - p
    slideOutX = p * 40 * S  // 向右滑出 40*S
  }

  // 进度文本
  const threshold = (ch && ch.threshold) || 0
  const progress = Math.min(g._challengeProgress || 0, threshold || 1)
  const showProgress = threshold > 1 && !done
  const baseText = done
    ? `✓ ${ch.desc}`
    : showProgress
      ? `★ ${ch.desc}  ${progress}/${threshold}`
      : `★ ${ch.desc}`

  ctx.save()
  ctx.globalAlpha = fadeOutAlpha

  const fs = 11 * S
  ctx.font = `bold ${fs}px "PingFang SC",sans-serif`
  const textW = ctx.measureText(baseText).width
  const padH = 10 * S
  const capH = 22 * S
  const capW = Math.min(W - 20 * S, textW + padH * 2)
  const capX = W - 10 * S - capW + slideOutX
  // 定位到敌人 HP 条上方：统一从 battleLayout.enemyHpTopY 读取（已整体上移）
  // 胶囊紧贴敌人 HP 条上方 2*S，挂在敌人立绘下半部（地面区域），不挡任何血条/头像/棋盘
  const enemyHpTopY = getBattleLayout().enemyHpTopY
  const capY = enemyHpTopY - capH - 2 * S

  // 底：未完成金棕底，完成绿底（都是半透，后面的头像标签仍能隐约见到）
  const bgTop = done ? 'rgba(60,140,80,0.85)' : 'rgba(72,50,18,0.85)'
  const bgBot = done ? 'rgba(40,100,55,0.85)' : 'rgba(45,30,10,0.85)'
  const grad = ctx.createLinearGradient(capX, capY, capX, capY + capH)
  grad.addColorStop(0, bgTop)
  grad.addColorStop(1, bgBot)
  ctx.fillStyle = grad
  _rrPath(ctx, capX, capY, capW, capH, capH / 2)
  ctx.fill()

  // 金边（完成时呼吸一次）
  const borderColor = done
    ? `rgba(180,255,200,${0.75 + 0.15 * Math.sin(doneT * 0.25)})`
    : 'rgba(220,180,80,0.9)'
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1.3 * S
  _rrPath(ctx, capX, capY, capW, capH, capH / 2)
  ctx.stroke()

  // 文字（描边一层深色，保证任意背景可读）
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineWidth = 2.5 * S
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'
  ctx.strokeText(baseText, capX + capW / 2, capY + capH / 2)
  ctx.fillStyle = done ? '#e8ffec' : '#ffe082'
  ctx.fillText(baseText, capX + capW / 2, capY + capH / 2)

  ctx.restore()

  // 首次完成时触发一次金星爆点，强化"达成"感
  if (done && !g._challengeDoneJustFired) {
    buttonFx.trigger([capX, capY, capW, capH], 'reward')
    g._challengeDoneJustFired = true
  }
}

// battleView 本地圆角矩形路径（uiComponents 的 _rr 不对外导出，这里保持独立）
function _rrPath(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y); c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

module.exports = {
  rBattle, drawBoard, drawTeamBar,
  drawBuffIcons, drawBuffIconsLabeled, drawRunBuffIcons,
  drawVictoryOverlay, drawDefeatOverlay, drawAdReviveOverlay,
  drawTutorialOverlay,
  dismissStageIntroCard,
  get HELP_PAGE_COUNT() { return require('./battle/battleHelpView').HELP_PAGE_COUNT },
}
