/**
 * 通天塔过层胜利结算页 — 一体化全屏场景
 * 阶段1: 结算数据滚动动画
 * 阶段2: 奖励卡片淡入 + 选择 + 确认
 * 渲染入口：rTowerVictory  触摸入口：tTowerVictory
 */
const V = require('./env')
const { getRealmInfo } = require('../data/tower')
const { drawCelebrationBackdrop, drawRewardRow, drawBuffCard } = require('./uiComponents')
const MusicMgr = require('../runtime/music')
const guideMgr = require('../engine/guideManager')

let _animTimer = 0
let _lastScene = null

const STATS_ANIM_DURATION = 30
const STATS_SETTLE_FRAME = 15
const CARD_APPEAR_FRAME = STATS_SETTLE_FRAME + STATS_ANIM_DURATION + 5

function rTowerVictory(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  const d = g._towerFloorResult
  if (!d) return

  if (_lastScene !== 'towerVictory') {
    _animTimer = 0
    _lastScene = 'towerVictory'
    g.selectedReward = -1
  }
  _animTimer++
  const at = _animTimer
  const fadeIn = Math.min(1, at / 20)

  // 全屏水墨背景
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  // 庆祝射线特效
  const spotlightCenterY = safeTop + 80 * S
  drawCelebrationBackdrop(c, W, H, S, spotlightCenterY, at, fadeIn)

  c.save()
  c.globalAlpha = fadeIn

  // === 标题区 ===
  const titleY = safeTop + 38 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'

  c.save()
  const titleGlow = 0.4 + 0.2 * Math.sin(at * 0.06)
  c.shadowColor = 'rgba(255,200,0,' + titleGlow + ')'; c.shadowBlur = 16 * S
  c.fillStyle = '#FFD700'; c.font = 'bold ' + (20 * S) + 'px "PingFang SC",sans-serif'
  c.save()
  c.strokeStyle = 'rgba(100,60,0,0.5)'; c.lineWidth = 3 * S; c.lineJoin = 'round'
  c.strokeText('第 ' + d.floor + ' 层 · 通过', W * 0.5, titleY)
  c.restore()
  c.fillText('第 ' + d.floor + ' 层 · 通过', W * 0.5, titleY)
  c.restore()

  // 装饰线
  const divY = titleY + 16 * S
  const divW = W * 0.2
  c.strokeStyle = 'rgba(180,140,40,0.5)'; c.lineWidth = 1.5 * S
  c.beginPath(); c.moveTo(W * 0.5 - divW, divY); c.lineTo(W * 0.5 + divW, divY); c.stroke()

  // 境界/速通标签
  let subtitleY = divY + 14 * S
  if (d.realmChanged) {
    c.fillStyle = '#D4A030'; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.fillText('境界突破：' + d.nextRealmName, W * 0.5, subtitleY)
    subtitleY += 16 * S
  }
  if (d.hasSpeed) {
    c.fillStyle = '#a05800'; c.font = 'bold ' + (10 * S) + 'px "PingFang SC",sans-serif'
    c.fillText('⚡ 速通达成 (' + d.turnCount + '回合)', W * 0.5, subtitleY)
    subtitleY += 14 * S
  }

  // === 统计面板（紧凑） ===
  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const pad = 12 * S
  const innerW = panelW - pad * 2

  const lineH = 24 * S
  const contentStart = Math.max(0, at - STATS_SETTLE_FRAME)
  const animProgress = Math.min(1, contentStart / STATS_ANIM_DURATION)
  const easeP = 1 - Math.pow(1 - animProgress, 3)

  let panelContentH = pad * 0.5
  if (d.hpUp > 0) panelContentH += lineH + 22 * S
  if (d.atkBonus > 0) panelContentH += lineH
  if (d.weaponBuff) panelContentH += lineH
  if (d.floorExp > 0) panelContentH += lineH
  if (d.soulStone > 0) panelContentH += lineH
  panelContentH += pad * 0.5

  const panelTop = subtitleY + 6 * S
  const panelH = panelContentH

  R.drawInfoPanel(panelX, panelTop, panelW, panelH)

  let cy = panelTop + pad * 0.5

  // 数字滚动音效
  if (contentStart > 0 && contentStart <= STATS_ANIM_DURATION && contentStart % 5 === 1) {
    MusicMgr.playNumberTick()
  }

  // --- HP 变化 ---
  if (d.hpUp > 0) {
    var animMaxHp = Math.round(d.curMaxHp + d.hpUp * easeP)
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#5a4a30'; c.font = 'bold ' + (11 * S) + 'px "PingFang SC",sans-serif'
    c.fillText('血量上限', panelX + pad, cy + 10 * S)
    c.textAlign = 'right'
    c.fillStyle = '#27864A'; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    if (animProgress < 1) {
      c.save(); c.shadowColor = '#27864A'; c.shadowBlur = 6 * S
      c.fillText(d.curMaxHp + ' → ' + animMaxHp, panelX + panelW - pad, cy + 10 * S)
      c.restore()
    } else {
      c.fillText(d.curMaxHp + ' → ' + d.nextMaxHp, panelX + panelW - pad, cy + 10 * S)
    }
    cy += lineH

    // HP 条
    var hpBarW = innerW, hpBarX = panelX + pad, hpBarH = 14 * S
    var heroHp = d.heroHp, hpPct = Math.min(1, heroHp / animMaxHp)

    c.save()
    c.fillStyle = 'rgba(80,60,30,0.15)'
    R.rr(hpBarX, cy, hpBarW, hpBarH, hpBarH / 2); c.fill()
    c.strokeStyle = 'rgba(80,60,30,0.2)'; c.lineWidth = 1 * S
    R.rr(hpBarX, cy, hpBarW, hpBarH, hpBarH / 2); c.stroke()

    var fillW = hpBarW * hpPct
    if (fillW > 0) {
      var hpGrd = c.createLinearGradient(hpBarX, cy, hpBarX, cy + hpBarH)
      hpGrd.addColorStop(0, '#5ddd5d'); hpGrd.addColorStop(0.5, '#3cb83c'); hpGrd.addColorStop(1, '#2a9a2a')
      c.fillStyle = hpGrd
      R.rr(hpBarX, cy, fillW, hpBarH, hpBarH / 2); c.fill()
    }
    if (animProgress > 0 && animMaxHp > d.curMaxHp) {
      var newMaxPct = d.hpUp * easeP / animMaxHp
      var growStart = hpBarW * (1 - newMaxPct)
      var growW = hpBarW * newMaxPct
      if (growW > 0) {
        var pulseA = 0.35 + 0.25 * Math.sin(at * 0.15)
        c.globalAlpha = fadeIn * pulseA
        c.fillStyle = '#ffa500'
        R.rr(hpBarX + growStart, cy, growW, hpBarH, hpBarH / 2); c.fill()
        c.globalAlpha = fadeIn
      }
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#fff'; c.font = 'bold ' + (9 * S) + 'px "PingFang SC",sans-serif'
    c.save()
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 3 * S
    c.fillText(heroHp + ' / ' + animMaxHp, hpBarX + hpBarW / 2, cy + hpBarH * 0.52)
    c.restore()
    c.restore()
    cy += hpBarH + 4 * S
  }

  // --- ATK 加成 ---
  if (d.atkBonus > 0) {
    var animAtk = Math.round((d.curAtkPct + d.atkBonus * easeP) * 10) / 10
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#5a4a30'; c.font = 'bold ' + (11 * S) + 'px "PingFang SC",sans-serif'
    c.fillText('全队攻击', panelX + pad, cy + 10 * S)
    c.textAlign = 'right'
    c.fillStyle = '#C06020'; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(d.curAtkPct + '% → ' + animAtk + '%', panelX + panelW - pad, cy + 10 * S)
    cy += lineH
  }

  // --- 法宝加成 ---
  if (d.weaponBuff) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#5a4a30'; c.font = 'bold ' + (11 * S) + 'px "PingFang SC",sans-serif'
    c.fillText('法宝加成', panelX + pad, cy + 10 * S)
    c.textAlign = 'right'
    c.fillStyle = '#8B6914'; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(d.weaponBuff.text, panelX + panelW - pad, cy + 10 * S)
    cy += lineH
  }

  // --- 修炼经验 ---
  if (d.floorExp > 0) {
    var animExp = Math.round(d.floorExp * easeP)
    drawRewardRow(c, R, S, panelX + pad, cy, innerW, 'icon_cult_exp', '修炼经验', '+' + animExp, '#8B7355', '#B8860B')
    cy += lineH
  }

  // --- 灵石 ---
  if (d.soulStone > 0) {
    var animSS = Math.round(d.soulStone * easeP)
    drawRewardRow(c, R, S, panelX + pad, cy, innerW, 'icon_soul_stone', '灵石', '+' + animSS, '#5577AA', '#3366AA')
    cy += lineH
  }

  // === 奖励卡片区 ===
  var panelBottom = panelTop + panelH
  var cardsReady = at > CARD_APPEAR_FRAME
  g._rewardRects = []
  g._rewardConfirmRect = null

  if (cardsReady && g.rewards && g.rewards.length > 0) {
    var cardFadeFrames = at - CARD_APPEAR_FRAME

    // "选择奖励" 分隔标题
    var rewardTitleY = panelBottom + 12 * S
    var rtAlpha = Math.min(1, cardFadeFrames / 12)
    c.save()
    c.globalAlpha = fadeIn * rtAlpha
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#C8A050'; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.fillText('── 选择奖励 ──', W * 0.5, rewardTitleY)
    c.restore()

    // 卡片布局
    var rewardCount = g.rewards.length
    var cardGap = 8 * S
    var cardH = 80 * S
    var cardW = W * 0.92
    var cardX = (W - cardW) / 2
    var cardsStartY = rewardTitleY + 16 * S

    for (var i = 0; i < rewardCount; i++) {
      var rw = g.rewards[i]
      var cardDelay = i * 5
      var cardAlpha = Math.min(1, Math.max(0, (cardFadeFrames - cardDelay) / 10))
      var cardSlideY = (1 - cardAlpha) * 15 * S
      var cardY = cardsStartY + i * (cardH + cardGap) + cardSlideY

      if (cardAlpha > 0) {
        c.save()
        c.globalAlpha = fadeIn * cardAlpha
        drawBuffCard(c, R, S, cardX, cardY, cardW, cardH, rw, g.selectedReward === i)
        c.restore()
      }

      g._rewardRects.push([cardX, cardY, cardW, cardH])
    }

    // 确认按钮
    if (g.selectedReward >= 0) {
      var allCardsVisible = cardFadeFrames > (rewardCount - 1) * 5 + 10
      if (allCardsVisible) {
        var btnW = panelW * 0.55, btnH = 36 * S
        var btnX = (W - btnW) / 2
        var btnY = cardsStartY + rewardCount * (cardH + cardGap) + 6 * S
        R.drawDialogBtn(btnX, btnY, btnW, btnH, '确认', 'confirm')
        g._rewardConfirmRect = [btnX, btnY, btnW, btnH]
      }
    }
  }

  // 引导触发
  if (at === CARD_APPEAR_FRAME + 1) {
    guideMgr.trigger(g, 'reward_first')
  }

  c.restore()
}

function tTowerVictory(g, x, y, type) {
  if (type !== 'end') return

  // 弹窗优先处理（applyReward 可能触发的宠物/碎片弹窗）
  if (g._petObtainedPopup) {
    g._petObtainedPopup = null
    g._towerFloorResult = null
    g._nextFloor()
    return
  }
  if (g._star3Celebration && g._star3Celebration.phase === 'ready') {
    g._star3Celebration = null
    if (g._pendingPoolEntry) { g._petPoolEntryPopup = g._pendingPoolEntry; g._pendingPoolEntry = null; return }
    if (g._fragmentObtainedPopup) return
    g._towerFloorResult = null
    g._nextFloor()
    return
  }
  if (g._star3Celebration) return
  if (g._petPoolEntryPopup) { g._petPoolEntryPopup = null; g._towerFloorResult = null; g._nextFloor(); return }
  if (g._fragmentObtainedPopup) { g._fragmentObtainedPopup = null; g._towerFloorResult = null; g._nextFloor(); return }

  // 卡片选择
  if (g._rewardRects) {
    for (var i = 0; i < g._rewardRects.length; i++) {
      if (g._hitRect(x, y, ...g._rewardRects[i])) {
        g.selectedReward = i
        return
      }
    }
  }

  // 确认按钮
  if (g._rewardConfirmRect && g.selectedReward >= 0 && g._hitRect(x, y, ...g._rewardConfirmRect)) {
    if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm()
    g._restoreBattleHpMax()
    g.heroBuffs = []; g.enemyBuffs = []

    g._applyReward(g.rewards[g.selectedReward])

    if (g._star3Celebration || g._petObtainedPopup || g._petPoolEntryPopup || g._fragmentObtainedPopup) return

    g._towerFloorResult = null
    g._nextFloor()
  }
}

module.exports = { rTowerVictory, tTowerVictory }
