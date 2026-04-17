/**
 * 战斗界面渲染 — 纯调度器
 * 所有绘制逻辑拆分至 ./battle/ 子模块
 */
const V = require('./env')
const { isCurrentUserGM } = require('../data/gmConfig')
const tutorial = require('../engine/tutorial')

const { getBattleLayout } = require('./battle/battleLayout')
const { drawBattleEnemyArea } = require('./battle/battleEnemyView')
const { initOrbAttackTip } = require('./battle/battleOrbTipView')
const { drawPetSkillWave, drawSkillFlash, drawSkillPreviewPopup } = require('./battle/battleSkillVfxView')
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
  if (g._isNewbieStage) drawNewbieHint(g, boardTop, padX)
  drawBoard(g)
  if (g._isNewbieStage) drawNewbieFingerGuide(g, cellSize, boardPad, boardTop)
  g.elimFloats.forEach(f => R.drawElimFloat(f))
  drawExpFloats(g)
  drawCombo(g, cellSize, boardTop)
  if (g._newbieComboBanner) drawNewbieComboBanner(g, boardTop, padX)
  _drawMechanicOverlay(g, S, W, safeTop, boardTop)
  if (g._skillFlash) drawSkillFlash(g)
  if (g._petSkillWave) drawPetSkillWave(g)
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
}

// ===== 技巧聚焦：开场提示 + 挑战目标条 + 回合/S线 =====
function _drawMechanicOverlay(g, S, W, safeTop, boardTop) {
  const { ctx } = V
  // 开场提示（半透明遮罩 + 居中文字，自动消失）
  const tip = g._mechanicOpenTip
  if (tip) {
    tip.timer++
    const dur = 150
    if (tip.timer > dur) { g._mechanicOpenTip = null }
    else {
      const alpha = tip.timer < 20 ? tip.timer / 20 : tip.timer > dur - 20 ? (dur - tip.timer) / 20 : 1
      ctx.save()
      ctx.globalAlpha = alpha * 0.85
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      const bh = 48 * S
      const by = boardTop - bh - 6 * S
      ctx.fillRect(0, by, W, bh)
      ctx.globalAlpha = alpha
      ctx.fillStyle = '#ffe082'
      ctx.font = `bold ${13 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(tip.text, W * 0.5, by + bh * 0.38)
      // S 评级目标
      if (g._stageRatingS > 0) {
        ctx.fillStyle = '#b0bec5'
        ctx.font = `${10 * S}px "PingFang SC",sans-serif`
        ctx.fillText(`S 评级：≤${g._stageRatingS} 回合`, W * 0.5, by + bh * 0.72)
      }
      ctx.restore()
    }
  }
  // 挑战目标条（棋盘上方小条）
  const mf = g._mechanicFocus
  if (mf && mf.challenge && g.bState !== 'victory' && g.bState !== 'defeat') {
    ctx.save()
    const ch = mf.challenge
    const done = g._challengeDone
    const barH = 18 * S
    const barY = boardTop - barH - 2 * S
    ctx.fillStyle = done ? 'rgba(76,175,80,0.55)' : 'rgba(0,0,0,0.45)'
    ctx.fillRect(0, barY, W, barH)
    ctx.fillStyle = done ? '#c8e6c9' : '#ffe0b2'
    ctx.font = `${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const icon = done ? '✓ ' : '★ '
    ctx.fillText(`${icon}${ch.desc}${done ? '  完成！' : ''}`, W * 0.5, barY + barH * 0.5)
    ctx.restore()
  }
  // 回合计数 / S 线（右上角）
  if (g.battleMode === 'stage' && g._stageRatingS > 0 && g.bState !== 'victory' && g.bState !== 'defeat') {
    ctx.save()
    const turns = (g._stageTotalTurns || 0) + (g.turnCount || 0)
    const sLine = g._stageRatingS
    const onTrack = turns <= sLine
    ctx.fillStyle = onTrack ? 'rgba(76,175,80,0.7)' : 'rgba(255,152,0,0.7)'
    ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(`回合 ${turns}/${sLine}`, W - 10 * S, safeTop + 10 * S)
    ctx.restore()
  }
}

module.exports = {
  rBattle, drawBoard, drawTeamBar,
  drawBuffIcons, drawBuffIconsLabeled, drawRunBuffIcons,
  drawVictoryOverlay, drawDefeatOverlay, drawAdReviveOverlay,
  drawTutorialOverlay,
  get HELP_PAGE_COUNT() { return require('./battle/battleHelpView').HELP_PAGE_COUNT },
}
