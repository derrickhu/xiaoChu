/**
 * 关卡结算页 — 全屏水墨风格
 * 胜利：金色光芒 + 评价星级 + 庆祝特效
 * 失败：暗红色调 + 鼓励文案
 * 渲染入口：rStageResult  触摸入口：tStageResult
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetRarity } = require('../data/pets')
const { RARITY_VISUAL } = require('../data/economyConfig')
const { MAX_LEVEL, expToNextLevel, currentRealm } = require('../data/cultivationConfig')
const { getNextStageId, getStageById, isStageUnlocked } = require('../data/stages')
const MusicMgr = require('../runtime/music')

const _rects = {
  backBtnRect: null,
  nextBtnRect: null,
}

let _animTimer = 0
let _lastScene = null

function rStageResult(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  if (_lastScene !== 'stageResult') { _animTimer = 0; _lastScene = 'stageResult' }
  _animTimer++
  const at = _animTimer
  const fadeIn = Math.min(1, at / 20)

  const result = g._stageResult
  if (!result) return

  // 首次进入结算页时，检测是否需要触发新手宠物庆祝（1-1 和 1-2 首通均触发）
  if (at === 1 && !result._celebrateTriggered && result.victory && result.isFirstClear
      && (result.stageId === 'stage_1_1' || result.stageId === 'stage_1_2')) {
    result._celebrateTriggered = true
    const petRewards = result.rewards ? result.rewards.filter(r => r.type === 'pet') : []
    if (petRewards.length > 0) {
      g._newbiePetCelebrate = {
        petIds: petRewards.map(r => r.petId),
        currentIdx: 0,
        alpha: 0, timer: 0,
      }
    }
  }

  // 新手宠物庆祝阶段（全屏覆盖，点击后切到队伍总览卡）
  if (g._newbiePetCelebrate) {
    _drawNewbiePetCelebration(g, c, R, W, H, S, safeTop)
    return
  }

  // 新手队伍总览卡（3 宠 + 对应属性珠，点击后切正常结算）
  if (g._newbieTeamOverview) {
    _drawNewbieTeamOverview(g, c, R, W, H, S, safeTop)
    return
  }

  // === 全屏背景 ===
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  if (result.victory) {
    _drawVictoryScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn)
  } else {
    _drawDefeatScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn)
  }
}

// ===== 描边文字工具 =====
function _strokeText(c, text, x, y, strokeColor, strokeWidth) {
  c.save()
  c.strokeStyle = strokeColor
  c.lineWidth = strokeWidth
  c.lineJoin = 'round'
  c.strokeText(text, x, y)
  c.restore()
  c.fillText(text, x, y)
}

// ===== 胜利全屏 =====
function _drawVictoryScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn) {
  // 暖金色叠加
  c.fillStyle = 'rgba(255,240,200,0.1)'
  c.fillRect(0, 0, W, H)

  // 旋转光芒
  c.save()
  c.globalAlpha = fadeIn * (0.06 + 0.03 * Math.sin(at * 0.04))
  c.translate(W * 0.5, safeTop + 80 * S)
  c.rotate(at * 0.003)
  for (let i = 0; i < 12; i++) {
    c.rotate(Math.PI / 6)
    c.beginPath(); c.moveTo(0, 0)
    c.lineTo(-16 * S, -H * 0.35); c.lineTo(16 * S, -H * 0.35)
    c.closePath()
    c.fillStyle = '#ffd700'; c.fill()
  }
  c.restore()

  // 金色径向光晕
  c.save()
  c.globalAlpha = fadeIn * 0.7
  const glow = c.createRadialGradient(W * 0.5, safeTop + 80 * S, 0, W * 0.5, safeTop + 80 * S, W * 0.5)
  glow.addColorStop(0, 'rgba(255,215,0,0.25)')
  glow.addColorStop(0.5, 'rgba(255,200,0,0.08)')
  glow.addColorStop(1, 'rgba(255,215,0,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn

  // === 标题（描边保证清晰） ===
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.save()
  c.shadowColor = 'rgba(120,80,0,0.7)'; c.shadowBlur = 10 * S
  c.fillStyle = '#FFD700'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _strokeText(c, '关卡通关', W * 0.5, safeTop + 46 * S, 'rgba(100,60,0,0.6)', 4 * S)
  c.restore()

  // 装饰线
  const divW = W * 0.22
  c.strokeStyle = 'rgba(180,140,40,0.5)'; c.lineWidth = 1.5 * S
  c.beginPath()
  c.moveTo(W * 0.5 - divW, safeTop + 62 * S)
  c.lineTo(W * 0.5 + divW, safeTop + 62 * S)
  c.stroke()

  // 关卡名（描边）
  c.fillStyle = '#5A4020'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  _strokeText(c, result.stageName || '', W * 0.5, safeTop + 80 * S, 'rgba(255,240,200,0.6)', 3 * S)

  // === 评价星级（大尺寸，动画入场） ===
  const starY = safeTop + 108 * S
  const starSize = 30 * S
  const starGap = 6 * S
  const starCount = result.starCount || (result.rating === 'S' ? 3 : result.rating === 'A' ? 2 : 1)
  const newStars = result.newStars || []
  const totalStarsW = 3 * starSize + 2 * starGap
  const starStartX = (W - totalStarsW) / 2

  for (let i = 0; i < 3; i++) {
    const sx = starStartX + i * (starSize + starGap) + starSize / 2
    const delay = i * 8
    const starProgress = Math.min(1, Math.max(0, (at - 10 - delay) / 12))
    if (starProgress <= 0) continue

    const isNew = newStars.includes(i + 1)
    const bounce = i < starCount ? (1 + 0.15 * Math.sin((at - delay) * 0.08)) : 1
    const scale = (0.3 + 0.7 * starProgress) * bounce

    c.save()
    c.translate(sx, starY)
    c.scale(scale, scale)
    c.globalAlpha = starProgress
    c.font = `${starSize}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    if (i < starCount) {
      c.shadowColor = 'rgba(255,200,0,0.8)'; c.shadowBlur = 14 * S
      c.fillStyle = '#FFD700'
      _strokeText(c, '★', 0, 0, 'rgba(160,100,0,0.5)', 2 * S)
    } else {
      c.fillStyle = 'rgba(160,140,100,0.35)'
      c.fillText('★', 0, 0)
    }
    c.restore()

    // NEW! 角标（新获得的星级）
    if (isNew && starProgress > 0.8) {
      c.save()
      const newAlpha = Math.min(1, (starProgress - 0.8) / 0.2)
      c.globalAlpha = newAlpha * (0.8 + 0.2 * Math.sin(at * 0.1))
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#FF4444'
      c.shadowColor = 'rgba(255,0,0,0.6)'; c.shadowBlur = 4 * S
      c.fillText('NEW', sx, starY - starSize * 0.55)
      c.restore()
    }
  }

  // 评价等级
  const ratingColor = result.rating === 'S' ? '#FFD700' : result.rating === 'A' ? '#C0C0C0' : '#A87040'
  c.fillStyle = ratingColor; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  _strokeText(c, `评价  ${result.rating}`, W * 0.5, starY + starSize / 2 + 20 * S, 'rgba(0,0,0,0.3)', 3 * S)

  // 回合数
  c.fillStyle = 'rgba(90,70,40,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  _strokeText(c, `总回合数：${result.totalTurns}`, W * 0.5, starY + starSize / 2 + 38 * S, 'rgba(255,255,255,0.4)', 2 * S)

  // === 浅色卷轴面板（drawInfoPanel 风格） ===
  const panelTop = starY + starSize / 2 + 56 * S
  _drawRewardPanel(g, c, R, W, H, S, result, panelTop)

  c.restore()
}

// ===== 失败全屏 =====
function _drawDefeatScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn) {
  // 暗色叠加
  c.fillStyle = 'rgba(0,0,0,0.3)'
  c.fillRect(0, 0, W, H)

  // 暗红光晕
  c.save()
  c.globalAlpha = fadeIn
  const glow = c.createRadialGradient(W * 0.5, safeTop + 60 * S, 0, W * 0.5, safeTop + 60 * S, W * 0.4)
  glow.addColorStop(0, 'rgba(180,40,50,0.15)')
  glow.addColorStop(1, 'rgba(180,40,50,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn

  // 标题（描边）
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#E06060'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _strokeText(c, '挑战失败', W * 0.5, safeTop + 50 * S, 'rgba(60,0,0,0.5)', 4 * S)

  // 装饰线
  const divW = W * 0.18
  c.strokeStyle = 'rgba(180,60,70,0.35)'; c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(W * 0.5 - divW, safeTop + 66 * S)
  c.lineTo(W * 0.5 + divW, safeTop + 66 * S)
  c.stroke()

  // 关卡名
  c.fillStyle = 'rgba(80,50,40,0.8)'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  _strokeText(c, result.stageName || '', W * 0.5, safeTop + 84 * S, 'rgba(255,220,200,0.5)', 3 * S)

  // 回合数
  c.fillStyle = 'rgba(120,80,60,0.6)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  _strokeText(c, `总回合数：${result.totalTurns}`, W * 0.5, safeTop + 102 * S, 'rgba(255,255,255,0.3)', 2 * S)

  // 鼓励
  c.fillStyle = 'rgba(100,70,50,0.7)'; c.font = `${12*S}px "PingFang SC",sans-serif`
  _strokeText(c, '修炼不止，再战可期', W * 0.5, safeTop + 126 * S, 'rgba(255,240,220,0.4)', 2.5 * S)

  // === 浅色面板 ===
  const panelTop = safeTop + 148 * S
  _drawRewardPanel(g, c, R, W, H, S, result, panelTop)

  c.restore()
}

// ===== 浅色奖励面板 =====
function _drawRewardPanel(g, c, R, W, H, S, result, panelTop) {
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 16 * S
  const innerW = pw - pad * 2

  // 计算面板内容高度
  let contentH = pad * 0.5
  const hasRewards = result.rewards && result.rewards.length > 0
  if (hasRewards) {
    contentH += 22 * S
    for (const r of result.rewards) {
      contentH += (r.type === 'fragment' || r.type === 'pet' ? 34 : 28) * S
    }
    contentH += 10 * S
  }
  // 星级奖励区
  const hasStarBonus = (result.starBonusSoulStone > 0 || result.starBonusAwakenStone > 0 || result.starBonusFragments > 0)
  if (hasStarBonus) contentH += 28 * S + 10 * S
  // 里程碑区
  const hasMilestones = result.milestoneRewards && result.milestoneRewards.length > 0
  if (hasMilestones) contentH += 10 * S + result.milestoneRewards.length * 26 * S

  if (result.soulStone > 0) contentH += 32 * S
  if (result.cultExp > 0) {
    contentH += 30 * S
    if (result.cultLevelUps > 0) contentH += 16 * S
    contentH += 28 * S
  }
  contentH += pad + 48 * S
  const ph = contentH
  const rad = 14 * S

  // 使用 drawInfoPanel 风格（浅色暖白，金边）
  R.drawInfoPanel(px, panelTop, pw, ph)

  let cy = panelTop + pad * 0.8

  // === 掉落奖励 ===
  if (hasRewards) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8B7355'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('掉落奖励', px + pad, cy + 6 * S)
    if (result.isFirstClear) {
      c.textAlign = 'right'
      c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText('✦ 首通奖励', px + pw - pad, cy + 6 * S)
    }
    cy += 22 * S

    for (const r of result.rewards) {
      if (r.type === 'pet' && r.petId) {
        _drawPetRow(c, R, S, px + pad, cy, innerW, r)
        cy += 34 * S
      } else if (r.type === 'fragment' && r.petId) {
        _drawFragmentRow(c, R, S, px + pad, cy, innerW, r)
        cy += 34 * S
      } else if (r.type === 'exp') {
        _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${r.amount}`, '#8B7355', '#B8860B')
        cy += 28 * S
      } else if (r.type === 'soulStone') {
        _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${r.amount}`, '#6688AA', '#4488CC')
        cy += 28 * S
      }
    }

    // 分隔线
    cy += 2 * S
    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 8 * S
  }

  // === 星级达成奖励 ===
  if (hasStarBonus) {
    c.save()
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#C07020'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    const maxNew = result.newStars ? Math.max(...result.newStars) : 0
    c.fillText(`${'★'.repeat(maxNew)} 达成奖励`, px + pad, cy + 6 * S)
    c.textAlign = 'right'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    const parts = []
    if (result.starBonusSoulStone > 0) parts.push(`灵石+${result.starBonusSoulStone}`)
    if (result.starBonusFragments > 0) parts.push(`碎片+${result.starBonusFragments}`)
    if (result.starBonusAwakenStone > 0) parts.push(`觉醒石+${result.starBonusAwakenStone}`)
    c.fillStyle = '#D4A030'
    c.fillText(parts.join('  '), px + pw - pad, cy + 6 * S)
    c.restore()
    cy += 28 * S

    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 10 * S
  }

  // === 章节里程碑达成 ===
  if (hasMilestones) {
    for (const ms of result.milestoneRewards) {
      c.save()
      c.textAlign = 'left'; c.textBaseline = 'middle'
      c.fillStyle = '#B44DFF'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText(`🏆 章节里程碑 ${ms.milestoneStars}★ 达成！`, px + pad, cy + 6 * S)
      c.textAlign = 'right'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      const mParts = []
      if (ms.soulStone) mParts.push(`灵石+${ms.soulStone}`)
      if (ms.fragment) mParts.push(`碎片+${ms.fragment}`)
      if (ms.awakenStone) mParts.push(`觉醒石+${ms.awakenStone}`)
      c.fillStyle = '#9060D0'
      c.fillText(mParts.join(' '), px + pw - pad, cy + 6 * S)
      c.restore()
      cy += 26 * S
    }
    cy += 10 * S
  }

  // === 灵石 ===
  if (result.soulStone > 0) {
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${result.soulStone}`, '#5577AA', '#3366AA')
    cy += 32 * S
  }

  // === 修炼经验 ===
  if (result.cultExp > 0) {
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${result.cultExp}`, '#8B7355', '#B8860B')
    cy += 22 * S

    if (result.cultLevelUps > 0) {
      c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      const cult = g.storage.cultivation
      c.fillText(`升级！Lv.${result.cultPrevLevel} → Lv.${cult.level}  获得 ${result.cultLevelUps} 修炼点`, W / 2, cy + 4 * S)
      cy += 16 * S
    }

    // 经验条
    const cult = g.storage.cultivation
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
      c.fillText(`Lv.${cult.level}  ${cult.exp}/${needed}  ${currentRealm(cult.level).name}`, px + pw - pad, cy + barH + 9 * S)
    } else {
      const barGrad = c.createLinearGradient(barX, cy, barX + barW, cy)
      barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
      c.fillStyle = barGrad
      R.rr(barX, cy, barW, barH, barH / 2); c.fill()
      c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level} 已满级  ${currentRealm(cult.level).name}`, px + pw - pad, cy + barH + 9 * S)
    }
    cy += barH + 22 * S
  }

  // === 底部按钮 ===
  const btnH = 38 * S
  const btnGap = 12 * S
  const btnW = (innerW - btnGap) / 2
  const btnY = cy + 4 * S

  R.drawDialogBtn(px + pad, btnY, btnW, btnH, '返回', 'cancel')
  _rects.backBtnRect = [px + pad, btnY, btnW, btnH]

  const nextId = result.victory ? getNextStageId(result.stageId) : null
  const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
  const rightLabel = result.victory ? (hasNext ? '下一关' : '再次挑战') : '再次挑战'
  R.drawDialogBtn(px + pad + btnW + btnGap, btnY, btnW, btnH, rightLabel, 'confirm')
  _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY, btnW, btnH]
}

// ===== 首通宠物奖励行 =====
function _drawPetRow(c, R, S, x, cy, innerW, reward) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const attrColor = pet ? ((ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || '#888') : '#888'

  const iconSz = 26 * S
  const iconY = cy + 2 * S

  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      c.save()
      R.rr(x, iconY, iconSz, iconSz, 5 * S); c.clip()
      const aw = img.width, ah = img.height
      const scale = Math.max(iconSz / aw, iconSz / ah)
      const dw = aw * scale, dh = ah * scale
      c.drawImage(img, x + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
      c.restore()
      // 品质色边框
      const rv = RARITY_VISUAL[getPetRarity(reward.petId)] || RARITY_VISUAL.R
      c.strokeStyle = rv.borderColor; c.lineWidth = 2 * S
      R.rr(x, iconY, iconSz, iconSz, 5 * S); c.stroke()
    }
  }

  // 品质徽标（头像右上角）
  const rv2 = RARITY_VISUAL[getPetRarity(reward.petId)] || RARITY_VISUAL.R
  const badgeW = rv2.label.length * 7 * S + 6 * S
  const badgeH = 12 * S
  const badgeX = x + iconSz - badgeW + 2 * S
  const badgeY = iconY - 2 * S
  c.fillStyle = rv2.badgeBg
  R.rr(badgeX, badgeY, badgeW, badgeH, 3 * S); c.fill()
  c.fillStyle = rv2.badgeColor; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(rv2.label, badgeX + badgeW / 2, badgeY + badgeH / 2)
  c.textBaseline = 'alphabetic'

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = attrColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(name, x + iconSz + 8 * S, iconY + iconSz / 2)

  c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText('获得灵宠！', x + innerW, iconY + iconSz / 2)
}

// ===== 碎片奖励行（含宠物头像） =====
function _drawFragmentRow(c, R, S, x, cy, innerW, reward) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const attrColor = pet ? ((ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || '#888') : '#888'

  const iconSz = 26 * S
  const iconY = cy + 2 * S

  // 宠物头像（小圆角）
  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      c.save()
      R.rr(x, iconY, iconSz, iconSz, 5 * S); c.clip()
      const aw = img.width, ah = img.height
      const scale = Math.max(iconSz / aw, iconSz / ah)
      const dw = aw * scale, dh = ah * scale
      c.drawImage(img, x + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
      c.restore()
      // 属性色细边框
      c.strokeStyle = attrColor; c.lineWidth = 1.5 * S
      R.rr(x, iconY, iconSz, iconSz, 5 * S); c.stroke()
    }
  }

  // 名称
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = attrColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(`${name}碎片`, x + iconSz + 8 * S, iconY + iconSz / 2)

  // 数量
  c.fillStyle = '#D4A030'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`×${reward.count}`, x + innerW, iconY + iconSz / 2)
}

// ===== 经验行（图标+文字+数值） =====
function _drawExpRow(c, R, S, x, cy, innerW, iconName, label, value, labelColor, valueColor) {
  const iconSz = 22 * S
  const iconImg = R.getImg(`assets/ui/${iconName}.png`)
  if (iconImg && iconImg.width > 0) {
    c.drawImage(iconImg, x, cy, iconSz, iconSz)
  }
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = labelColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(label, x + iconSz + 6 * S, cy + iconSz / 2)
  c.fillStyle = valueColor; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(value, x + innerW, cy + iconSz / 2)
}

// ===== 新手宠物庆祝全屏（逐一展示每只奖励宠物） =====
function _drawNewbiePetCelebration(g, c, R, W, H, S, safeTop) {
  const cel = g._newbiePetCelebrate
  if (!cel || !cel.petIds || cel.petIds.length === 0) { g._newbiePetCelebrate = null; return }
  cel.timer++
  cel.alpha = Math.min(1, cel.timer / 20)
  g._dirty = true

  const idx = cel.currentIdx || 0
  const petId = cel.petIds[idx]
  const pet = getPetById(petId)
  if (!pet) { g._newbiePetCelebrate = null; return }

  // 背景
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  c.save()
  c.globalAlpha = cel.alpha

  c.fillStyle = 'rgba(255,240,200,0.12)'
  c.fillRect(0, 0, W, H)

  // 旋转金色光芒
  c.save()
  c.globalAlpha = cel.alpha * (0.08 + 0.04 * Math.sin(cel.timer * 0.04))
  const centerY = H * 0.38
  c.translate(W * 0.5, centerY)
  c.rotate(cel.timer * 0.003)
  for (let i = 0; i < 12; i++) {
    c.rotate(Math.PI / 6)
    c.beginPath(); c.moveTo(0, 0)
    c.lineTo(-20 * S, -H * 0.4); c.lineTo(20 * S, -H * 0.4)
    c.closePath()
    c.fillStyle = '#ffd700'; c.fill()
  }
  c.restore()

  // 径向光晕
  c.save()
  c.globalAlpha = cel.alpha * 0.6
  const glow = c.createRadialGradient(W * 0.5, centerY, 0, W * 0.5, centerY, W * 0.55)
  glow.addColorStop(0, 'rgba(255,215,0,0.3)')
  glow.addColorStop(0.5, 'rgba(255,200,0,0.1)')
  glow.addColorStop(1, 'rgba(255,215,0,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.restore()

  // 计数指示器（第 x/n 只）
  if (cel.petIds.length > 1) {
    c.fillStyle = 'rgba(200,170,80,0.7)'
    c.font = `${12 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`${idx + 1} / ${cel.petIds.length}`, W / 2, safeTop + 30 * S)
  }

  // 宠物头像（大尺寸弹入动画）
  const bounceProgress = Math.min(1, cel.timer / 25)
  const bounce = bounceProgress < 1
    ? (1 + 0.2 * Math.sin(bounceProgress * Math.PI))
    : (1 + 0.03 * Math.sin(cel.timer * 0.06))
  const avatarSize = 130 * S * bounce
  const avatarX = (W - avatarSize) / 2
  const avatarY = centerY - avatarSize / 2 - 10 * S

  const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
  const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
  const img = R.getImg(avatarPath)
  if (img && img.width > 0) {
    c.save()
    c.shadowColor = ac.main; c.shadowBlur = 20 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 16 * S); c.clip()
    const aw = img.width, ah = img.height
    const sc = Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * sc, dh = ah * sc
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
    c.restore()
    // 品质色边框
    const rvCel = RARITY_VISUAL[getPetRarity(petId)] || RARITY_VISUAL.R
    c.save()
    c.shadowColor = rvCel.glowColor; c.shadowBlur = 16 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 16 * S)
    c.strokeStyle = rvCel.borderColor; c.lineWidth = 3 * S; c.stroke()
    c.restore()
  }

  // 品质徽标（头像右上角）
  const rvBadge = RARITY_VISUAL[getPetRarity(petId)] || RARITY_VISUAL.R
  const celBadgeW = rvBadge.label.length * 10 * S + 8 * S
  const celBadgeH = 18 * S
  const celBadgeX = avatarX + avatarSize - celBadgeW + 4 * S
  const celBadgeY = avatarY - 4 * S
  c.fillStyle = rvBadge.badgeBg
  R.rr(celBadgeX, celBadgeY, celBadgeW, celBadgeH, 4 * S); c.fill()
  c.fillStyle = rvBadge.badgeColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(rvBadge.label, celBadgeX + celBadgeW / 2, celBadgeY + celBadgeH / 2)
  c.textBaseline = 'alphabetic'

  // 宠物名称
  const nameY = avatarY + avatarSize + 30 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.save()
  c.shadowColor = 'rgba(120,80,0,0.7)'; c.shadowBlur = 8 * S
  c.fillStyle = ac.main
  c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
  _strokeText(c, pet.name, W / 2, nameY, 'rgba(0,0,0,0.3)', 3 * S)
  c.restore()

  // 核心文案
  const msgY = nameY + 32 * S
  c.fillStyle = '#FFD700'
  c.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  c.save()
  c.shadowColor = 'rgba(100,60,0,0.6)'; c.shadowBlur = 6 * S
  _strokeText(c, '正式加入你的队伍！', W / 2, msgY, 'rgba(80,50,0,0.4)', 3 * S)
  c.restore()

  // 副文案
  const _ATTR_DESC = { metal: '消除金色灵珠时发动攻击', wood: '消除绿色灵珠时发动攻击', water: '消除蓝色灵珠时发动攻击', fire: '消除红色灵珠时发动攻击', earth: '消除棕色灵珠时发动攻击' }
  c.fillStyle = 'rgba(90,70,40,0.8)'
  c.font = `${12 * S}px "PingFang SC",sans-serif`
  c.fillText(_ATTR_DESC[pet.attr] || '战斗中为你冲锋陷阵', W / 2, msgY + 28 * S)

  // 底部点击提示
  const blinkAlpha = 0.35 + 0.3 * Math.sin(Date.now() * 0.004)
  c.globalAlpha = cel.alpha * blinkAlpha
  c.fillStyle = '#8B7355'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  const tipText = idx < cel.petIds.length - 1 ? '点击查看下一只灵宠' : '点击屏幕继续'
  c.fillText(tipText, W / 2, H - safeTop - 40 * S)

  c.restore()
}

// ===== 新手队伍总览卡（3 宠物 + 对应属性珠色标） =====
function _drawNewbieTeamOverview(g, c, R, W, H, S, safeTop) {
  const overview = g._newbieTeamOverview
  if (!overview) return
  overview.timer++
  overview.alpha = Math.min(1, overview.timer / 20)
  g._dirty = true

  // 背景
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  c.save()
  c.globalAlpha = overview.alpha

  // 暖色叠加
  c.fillStyle = 'rgba(255,240,200,0.12)'
  c.fillRect(0, 0, W, H)

  // 标题
  const titleY = safeTop + 60 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFD700'
  c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
  c.save()
  c.shadowColor = 'rgba(120,80,0,0.7)'; c.shadowBlur = 8 * S
  _strokeText(c, '你的初始队伍', W / 2, titleY, 'rgba(0,0,0,0.3)', 3 * S)
  c.restore()

  // 副标题
  c.fillStyle = 'rgba(90,70,40,0.8)'
  c.font = `${13 * S}px "PingFang SC",sans-serif`
  c.fillText('消除对应颜色灵珠，灵宠就会攻击', W / 2, titleY + 30 * S)

  // 三只宠物横向排列
  const pets = (overview.pets || []).map(id => getPetById(id)).filter(Boolean)
  const cardW = 80 * S
  const gap = 16 * S
  const totalCardsW = pets.length * cardW + (pets.length - 1) * gap
  const startX = (W - totalCardsW) / 2
  const cardTopY = titleY + 64 * S

  const _ATTR_LABEL = { metal: '金', wood: '木', earth: '土', water: '水', fire: '火' }

  pets.forEach((pet, i) => {
    const delay = 10 + i * 12
    const petAlpha = Math.min(1, Math.max(0, (overview.timer - delay) / 15))
    c.save()
    c.globalAlpha = overview.alpha * petAlpha

    const cx = startX + i * (cardW + gap) + cardW / 2
    const cy = cardTopY

    // 头像
    const avatarSize = 68 * S
    const ax = cx - avatarSize / 2
    const ay = cy
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
    if (img && img.width > 0) {
      c.save()
      R.rr(ax, ay, avatarSize, avatarSize, 10 * S); c.clip()
      const aw = img.width, ah = img.height
      const sc = Math.max(avatarSize / aw, avatarSize / ah)
      const dw = aw * sc, dh = ah * sc
      c.drawImage(img, ax + (avatarSize - dw) / 2, ay + (avatarSize - dh) / 2, dw, dh)
      c.restore()
      c.save()
      c.shadowColor = ac.main; c.shadowBlur = 8 * S
      R.rr(ax, ay, avatarSize, avatarSize, 10 * S)
      c.strokeStyle = ac.main; c.lineWidth = 2 * S; c.stroke()
      c.restore()
    }

    // 宠物名称
    c.fillStyle = ac.main
    c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(pet.name, cx, ay + avatarSize + 16 * S)

    // 对应属性灵珠示意（小圆球）
    const orbY = ay + avatarSize + 36 * S
    const orbR = 10 * S
    c.beginPath(); c.arc(cx, orbY, orbR, 0, Math.PI * 2)
    const orbGrad = c.createRadialGradient(cx - orbR * 0.3, orbY - orbR * 0.3, 0, cx, orbY, orbR)
    orbGrad.addColorStop(0, ac.lt || ac.main)
    orbGrad.addColorStop(1, ac.dk || ac.main)
    c.fillStyle = orbGrad; c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.2 * S; c.stroke()

    // 属性标签
    c.fillStyle = '#5a4020'
    c.font = `${10 * S}px "PingFang SC",sans-serif`
    c.fillText(`消${_ATTR_LABEL[pet.attr] || '金'}珠攻击`, cx, orbY + orbR + 14 * S)

    c.restore()
  })

  // 底部提示
  const blinkAlpha = 0.35 + 0.3 * Math.sin(Date.now() * 0.004)
  c.globalAlpha = overview.alpha * blinkAlpha
  c.fillStyle = '#8B7355'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText('点击屏幕继续', W / 2, H - safeTop - 40 * S)

  c.restore()
}

// ===== 触摸 =====
function tStageResult(g, x, y, type) {
  if (type !== 'end') return
  const result = g._stageResult
  if (!result) return

  // 新手宠物庆祝阶段：逐一展示，最后一只后切到团队概览卡
  if (g._newbiePetCelebrate) {
    const cel = g._newbiePetCelebrate
    const idx = cel.currentIdx || 0
    if (idx < cel.petIds.length - 1) {
      // 还有下一只，推进索引并重置动画
      cel.currentIdx = idx + 1
      cel.timer = 0; cel.alpha = 0
    } else {
      // 全部展示完毕 → 团队概览卡
      const petIds = cel.petIds.slice()
      g._newbiePetCelebrate = null
      g._newbieTeamOverview = { pets: petIds, alpha: 0, timer: 0 }
    }
    _animTimer = 0
    g._dirty = true
    return
  }

  // 新手队伍总览卡：首通直达灵宠页/修炼页，不回主页
  if (g._newbieTeamOverview) {
    g._newbieTeamOverview = null
    if (result && result.victory && result.isFirstClear) {
      if (result.stageId === 'stage_1_1') {
        g.storage.markGuideShown('newbie_stage_continue')
        g.setScene('petPool')
        return
      }
      if (result.stageId === 'stage_1_2') {
        g._pendingGuide = 'newbie_team_ready'
        g.setScene('title')
        return
      }
    }
    _animTimer = 0
    g._dirty = true
    return
  }

  // 1-1/1-2 首通胜利：返回首页并触发后续引导
  const _firstClearGuide = _getFirstClearGuide(result)

  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    if (_firstClearGuide) {
      g._pendingGuide = _firstClearGuide
      g.setScene('title')
    } else {
      g.setScene('stageSelect')
    }
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  if (_rects.nextBtnRect && g._hitRect(x, y, ..._rects.nextBtnRect)) {
    if (_firstClearGuide) {
      g._pendingGuide = _firstClearGuide
      g.setScene('title')
    } else {
      const nextId = result.victory ? getNextStageId(result.stageId) : null
      const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
      if (hasNext) {
        g._selectedStageId = nextId
        g._stageInfoEnemyDetail = null
        g.setScene('stageInfo')
      } else {
        g._selectedStageId = result.stageId
        g._stageInfoEnemyDetail = null
        g.setScene('stageInfo')
      }
    }
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }
}

// 1-1 / 1-2 首通胜利时，返回首页并触发对应后续引导
function _getFirstClearGuide(result) {
  if (!result || !result.victory || !result.isFirstClear) return null
  if (result.stageId === 'stage_1_1') return 'newbie_stage_continue'
  if (result.stageId === 'stage_1_2') return 'newbie_team_ready'
  return null
}

module.exports = { rStageResult, tStageResult }
