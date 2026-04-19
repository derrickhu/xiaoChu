/**
 * 通天塔过层胜利结算页 — 一体化全屏场景
 * 阶段1: 结算数据滚动动画
 * 阶段2: 奖励卡片淡入 + 选择 + 确认
 * 渲染入口：rTowerVictory  触摸入口：tTowerVictory
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getCurrentSeason } = require('../data/towerEvent')
const { getPetById, getPetAvatarPath } = require('../data/pets')
const { drawCelebrationBackdrop, drawRewardRow, drawBuffCard, drawShareIconBtn } = require('./uiComponents')
const shareCelebrate = require('./shareCelebrate')
const { SHARE_SCENES } = require('../data/shareConfig')
const MusicMgr = require('../runtime/music')
const guideMgr = require('../engine/guideManager')

let _animTimer = 0
// 以 g._towerFloorResult 引用变化作为"首次进入过层结算"的判据；
// 避免 _lastScene 在离开场景后不被重置，导致重复进入时 _animTimer 不归零、
// 首帧一次性逻辑（选卡重置等）失效。
let _lastResultRef = null

const STATS_ANIM_DURATION = 30
const STATS_SETTLE_FRAME = 15
const CARD_APPEAR_FRAME = STATS_SETTLE_FRAME + STATS_ANIM_DURATION + 5

function _getMilestoneHintData(d) {
  const season = getCurrentSeason()
  const current = d.floorMilestones && d.floorMilestones[0]
  if (current) {
    if (current.type === 'srFrag') {
      const pet = season ? getPetById(season.sr) : null
      return {
        badge: '本层里程碑',
        title: pet ? `SR「${pet.name}」碎片 ×${current.count}` : `SR 碎片 ×${current.count}`,
        detail: '确认奖励后立即发放',
        highlight: true,
        pet: pet,
      }
    }
    if (current.type === 'ssrFrag') {
      return {
        badge: '本层里程碑',
        title: `SSR 随机碎片 ×${current.count}`,
        detail: '确认奖励后立即发放',
        highlight: true,
        pet: null,
        genericLabel: 'SSR',
      }
    }
    const pet = season ? getPetById(season.ssr) : null
    return {
      badge: '本层里程碑',
      title: pet ? `SSR「${pet.name}」整宠` : 'SSR 整宠 ×1',
      detail: '确认奖励后立即发放',
      highlight: true,
      pet: pet,
    }
  }

  const next = d.nextMilestone
  if (!next) return null
  if (next.type === 'srFrag') {
    const pet = season ? getPetById(season.sr) : null
    return {
      badge: '下一档奖励',
      title: pet ? `第${next.floor}层 · SR「${pet.name}」碎片 ×${next.count}` : `第${next.floor}层 · SR 碎片 ×${next.count}`,
      detail: next.floorsLeft > 0 ? `再过${next.floorsLeft}层可领取` : '达成后立即领取',
      highlight: false,
      pet: pet,
    }
  }
  if (next.type === 'ssrFrag') {
    return {
      badge: '下一档奖励',
      title: `第${next.floor}层 · SSR 随机碎片 ×${next.count}`,
      detail: next.floorsLeft > 0 ? `再过${next.floorsLeft}层可领取` : '达成后立即领取',
      highlight: false,
      pet: null,
      genericLabel: 'SSR',
    }
  }
  const pet = season ? getPetById(season.ssr) : null
  return {
    badge: '下一档奖励',
    title: pet ? `第${next.floor}层 · SSR「${pet.name}」整宠` : `第${next.floor}层 · SSR 整宠 ×1`,
    detail: next.floorsLeft > 0 ? `再过${next.floorsLeft}层可领取` : '达成后立即领取',
    highlight: false,
    pet: pet,
  }
}

function _drawMilestoneHintAvatar(c, R, S, hint, x, y, size) {
  if (hint.pet) {
    const pet = hint.pet
    const attrKey = pet.attr || 'metal'
    const ac = ATTR_COLOR[attrKey] || ATTR_COLOR.metal
    const avatarImg = R.getImg(getPetAvatarPath({ ...pet, star: 1 }))

    c.save()
    c.shadowColor = ac.main
    c.shadowBlur = (hint.highlight ? 12 : 8) * S
    R.drawCoverImg(avatarImg, x, y, size, size, {
      radius: 8 * S,
      strokeStyle: ac.main,
      strokeWidth: 1.8 * S,
    })
    c.restore()

    const frameImg = R.getImg(`assets/ui/frame_pet_${attrKey}.png`)
    if (frameImg && frameImg.width > 0) {
      const frameSz = size * 1.14
      const frameOff = (frameSz - size) / 2
      c.drawImage(frameImg, x - frameOff, y - frameOff, frameSz, frameSz)
    }
    return
  }

  const cx = x + size / 2
  const cy = y + size / 2
  const grd = c.createRadialGradient(cx, cy - size * 0.16, size * 0.08, cx, cy, size * 0.7)
  grd.addColorStop(0, hint.highlight ? 'rgba(255,247,210,0.98)' : 'rgba(255,250,232,0.96)')
  grd.addColorStop(1, hint.highlight ? 'rgba(215,150,40,0.95)' : 'rgba(193,155,92,0.92)')

  c.save()
  c.fillStyle = grd
  c.strokeStyle = hint.highlight ? 'rgba(216,156,29,0.95)' : 'rgba(160,124,68,0.8)'
  c.lineWidth = 1.5 * S
  c.shadowColor = hint.highlight ? 'rgba(216,156,29,0.38)' : 'rgba(150,120,60,0.25)'
  c.shadowBlur = 8 * S
  c.beginPath()
  c.arc(cx, cy, size * 0.46, 0, Math.PI * 2)
  c.fill()
  c.stroke()

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#6B430D'
  c.font = `bold ${8.8 * S}px "PingFang SC",sans-serif`
  c.fillText(hint.genericLabel || '奖励', cx, cy + 0.5 * S)
  c.restore()
}

function _finishTowerVictory(g) {
  g._towerMilestoneRewardPopup = null
  g._towerMilestonePopupBtnRect = null
  g._towerFloorResult = null
  g._nextFloor()
}

function _drawTowerMilestonePopup(g) {
  const popup = g._towerMilestoneRewardPopup
  if (!popup || !popup.rewards || popup.rewards.length === 0) return
  const { ctx: c, R, W, H, S } = V

  c.save()
  c.fillStyle = 'rgba(0,0,0,0.48)'
  c.fillRect(0, 0, W, H)

  const panelW = W * 0.82
  const lineH = 34 * S
  const panelH = 136 * S + popup.rewards.length * lineH
  const panelX = (W - panelW) / 2
  const panelY = H * 0.20
  const pad = 14 * S
  R.drawDialogPanel(panelX, panelY, panelW, panelH)

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#E8C547'
  c.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  c.save()
  c.shadowColor = 'rgba(255,200,0,0.35)'
  c.shadowBlur = 8 * S
  c.fillText(`第 ${popup.floor} 层里程碑达成`, W * 0.5, panelY + 26 * S)
  c.restore()

  c.fillStyle = '#8B6914'
  c.font = `${10 * S}px "PingFang SC",sans-serif`
  c.fillText('奖励已立即发放', W * 0.5, panelY + 46 * S)

  let cy = panelY + 66 * S
  popup.rewards.forEach((reward) => {
    const pet = reward.petId ? getPetById(reward.petId) : null
    const ac = pet ? (ATTR_COLOR[pet.attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
    const iconSz = 24 * S
    const iconX = panelX + pad
    const iconY = cy - iconSz / 2

    if (pet) {
      const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
      const avatarImg = R.getImg(avatarPath)
      if (avatarImg && avatarImg.width > 0) {
        R.drawCoverImg(avatarImg, iconX, iconY, iconSz, iconSz, { radius: 4 * S, strokeStyle: ac.main, strokeWidth: 1.4 })
      }
    }

    c.textAlign = 'left'
    c.fillStyle = reward.type === 'ssrPet' ? '#D89C1D' : (reward.type === 'ssrFrag' ? '#D89C1D' : '#7E5BC6')
    c.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
    let text = ''
    if (reward.type === 'ssrPet') text = `SSR「${pet ? pet.name : '灵宠'}」整宠`
    else if (reward.type === 'ssrFrag') text = `SSR「${pet ? pet.name : '随机灵宠'}」碎片 ×${reward.count}`
    else text = `SR「${pet ? pet.name : '灵宠'}」碎片 ×${reward.count}`
    c.fillText(text, iconX + iconSz + 8 * S, cy)

    c.textAlign = 'right'
    c.fillStyle = '#A09070'
    c.font = `${9 * S}px "PingFang SC",sans-serif`
    c.fillText(reward.type === 'ssrPet' ? '已加入灵宠池' : '已加入灵宠碎片库', panelX + panelW - pad, cy)
    cy += lineH
  })

  const btnW = panelW * 0.55
  const btnH = 36 * S
  const btnX = (W - btnW) / 2
  const btnY = panelY + panelH - btnH - 16 * S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '继续登塔', 'confirm')
  g._towerMilestonePopupBtnRect = [btnX, btnY, btnW, btnH]
  c.restore()
}

function rTowerVictory(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  const d = g._towerFloorResult
  if (!d) return

  if (_lastResultRef !== d) {
    _animTimer = 0
    _lastResultRef = d
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
  const milestoneHint = _getMilestoneHintData(d)

  let panelContentH = pad * 0.5
  if (d.hpUp > 0) panelContentH += lineH + 22 * S
  if (d.atkBonus > 0) panelContentH += lineH
  if (d.weaponBuff) panelContentH += lineH
  if (d.floorExp > 0) panelContentH += lineH
  if (d.soulStone > 0) panelContentH += lineH
  if (milestoneHint) panelContentH += 42 * S
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

  // --- 修炼贡献 ---
  if (d.floorExp > 0) {
    var animExp = Math.round(d.floorExp * easeP)
    drawRewardRow(c, R, S, panelX + pad, cy, innerW, 'icon_cult_exp', '本层修炼贡献', '+' + animExp, '#8B7355', '#B8860B')
    cy += lineH
  }

  // --- 灵石贡献 ---
  if (d.soulStone > 0) {
    var animSS = Math.round(d.soulStone * easeP)
    drawRewardRow(c, R, S, panelX + pad, cy, innerW, 'icon_soul_stone', '本层灵石贡献', '+' + animSS, '#5577AA', '#3366AA')
    cy += lineH
  }

  if (milestoneHint) {
    const hintH = 36 * S
    const hintX = panelX + pad
    const hintY = cy
    const avatarSz = 26 * S
    const avatarX = hintX + 8 * S
    const avatarY = hintY + (hintH - avatarSz) / 2
    const textX = avatarX + avatarSz + 10 * S
    const textRight = hintX + innerW - 8 * S

    c.save()
    c.fillStyle = milestoneHint.highlight ? 'rgba(255,240,190,0.78)' : 'rgba(255,248,232,0.72)'
    c.strokeStyle = milestoneHint.highlight ? 'rgba(216,156,29,0.65)' : 'rgba(180,150,90,0.35)'
    c.lineWidth = 1 * S
    R.rr(hintX, hintY, innerW, hintH, 9 * S); c.fill()
    R.rr(hintX, hintY, innerW, hintH, 9 * S); c.stroke()

    _drawMilestoneHintAvatar(c, R, S, milestoneHint, avatarX, avatarY, avatarSz)

    c.textBaseline = 'middle'
    c.textAlign = 'left'
    c.fillStyle = milestoneHint.highlight ? '#C27712' : '#8B6914'
    c.font = 'bold ' + (9 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(milestoneHint.badge, textX, hintY + 10 * S)

    c.textAlign = 'right'
    c.fillStyle = milestoneHint.highlight ? '#C06020' : '#8B7A60'
    c.font = (8.2 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(milestoneHint.detail, textRight, hintY + 10 * S)

    c.textAlign = 'left'
    c.fillStyle = '#5A4020'
    c.font = 'bold ' + (10.2 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(milestoneHint.title, textX, hintY + 24 * S)
    c.restore()
    cy += 42 * S
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

  // === 主动分享胶囊按钮（右下角常驻，"+20灵石"摆脸上）===
  //   shareCelebrate 正在展示 / 里程碑弹窗激活时隐藏，避免入口打架
  //   破境时（realmChanged）加呼吸金光，把情绪高点引流到主动分享
  const popupActive = !!(g._towerMilestoneRewardPopup || g._petObtainedPopup
    || g._star3Celebration || g._petPoolEntryPopup || g._fragmentObtainedPopup)
  if (!popupActive && !(shareCelebrate && shareCelebrate.isActive && shareCelebrate.isActive())) {
    const h = 36 * S
    const rightX = W - 12 * S
    const sy = H - h - 16 * S
    // 按钮上的"+N"要和实际入账完全对齐（含每日基础/首次永久/场景三档合并，见 shareRewardCalc）
    const { previewShareReward } = require('../data/shareRewardCalc')
    const preview = previewShareReward(g.storage, 'activeTowerShare')
    const reward = (preview && preview.soulStone) || 0
    const rect = drawShareIconBtn(c, R, S, rightX, sy, h, { glow: !!d.realmChanged, reward })
    g._towerShareBtnRect = [rect.x, rect.y, rect.w, rect.h]
  } else {
    g._towerShareBtnRect = null
  }

  c.restore()
  _drawTowerMilestonePopup(g)
}

function tTowerVictory(g, x, y, type) {
  if (type !== 'end') return

  // 主动分享小图标（放在最前面，优先级最高，弹窗 guard 已在绘制时处理）
  if (g._towerShareBtnRect && g._hitRect(x, y, ...g._towerShareBtnRect)) {
    const { shareCore } = require('../share')
    const floor = (g._towerFloorResult && g._towerFloorResult.floor) || 1
    shareCore(g, 'activeTowerShare', { floor }, { mode: 'friend' })
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  // 弹窗优先处理（applyReward 可能触发的宠物/碎片弹窗）
  if (g._petObtainedPopup) {
    g._petObtainedPopup = null
    if (g._towerMilestoneRewardPopup) return
    _finishTowerVictory(g)
    return
  }
  if (g._star3Celebration && g._star3Celebration.phase === 'ready') {
    g._star3Celebration = null
    if (g._pendingPoolEntry) { g._petPoolEntryPopup = g._pendingPoolEntry; g._pendingPoolEntry = null; return }
    if (g._fragmentObtainedPopup) return
    if (g._towerMilestoneRewardPopup) return
    _finishTowerVictory(g)
    return
  }
  if (g._star3Celebration) return
  if (g._petPoolEntryPopup) {
    g._petPoolEntryPopup = null
    if (g._towerMilestoneRewardPopup) return
    _finishTowerVictory(g)
    return
  }
  if (g._fragmentObtainedPopup) {
    g._fragmentObtainedPopup = null
    if (g._towerMilestoneRewardPopup) return
    _finishTowerVictory(g)
    return
  }

  if (g._towerMilestoneRewardPopup) {
    if (g._towerMilestonePopupBtnRect && g._hitRect(x, y, ...g._towerMilestonePopupBtnRect)) {
      _finishTowerVictory(g)
    }
    return
  }

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
    if (g._towerFloorResult) g._claimTowerFloorMilestones(g._towerFloorResult.floor)

    if (g._star3Celebration || g._petObtainedPopup || g._petPoolEntryPopup || g._fragmentObtainedPopup || g._towerMilestoneRewardPopup) return

    _finishTowerVictory(g)
  }
}

module.exports = { rTowerVictory, tTowerVictory }
