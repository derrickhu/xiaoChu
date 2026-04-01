/**
 * 关卡结算页 — 全屏水墨风格
 * 胜利：金色光芒 + 评价星级 + 奖励高亮展示
 * 失败：败因分析 + 变强建议
 * 渲染入口：rStageResult  触摸入口：tStageResult
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetRarity } = require('../data/pets')
const { getWeaponById, getWeaponRarity } = require('../data/weapons')
const { RARITY_VISUAL } = require('../data/economyConfig')
const { MAX_LEVEL, expToNextLevel, currentRealm, usedPoints } = require('../data/cultivationConfig')
const { POOL_STAR_FRAG_COST } = require('../data/petPoolConfig')
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

  // === 标题 ===
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.save()
  c.shadowColor = 'rgba(120,80,0,0.7)'; c.shadowBlur = 10 * S
  c.fillStyle = '#FFD700'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _strokeText(c, '关卡通关', W * 0.5, safeTop + 46 * S, 'rgba(100,60,0,0.6)', 4 * S)
  c.restore()

  const divW = W * 0.22
  c.strokeStyle = 'rgba(180,140,40,0.5)'; c.lineWidth = 1.5 * S
  c.beginPath()
  c.moveTo(W * 0.5 - divW, safeTop + 62 * S)
  c.lineTo(W * 0.5 + divW, safeTop + 62 * S)
  c.stroke()

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

  c.fillStyle = 'rgba(90,70,40,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  _strokeText(c, `总回合数：${result.totalTurns}`, W * 0.5, starY + starSize / 2 + 38 * S, 'rgba(255,255,255,0.4)', 2 * S)

  // === 奖励面板 ===
  const panelTop = starY + starSize / 2 + 56 * S
  _drawVictoryRewardPanel(g, c, R, W, H, S, result, panelTop, at)

  c.restore()
}

// ===== 失败全屏 =====
function _drawDefeatScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn) {
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.fillRect(0, 0, W, H)

  c.save()
  c.globalAlpha = fadeIn
  const glow = c.createRadialGradient(W * 0.5, safeTop + 60 * S, 0, W * 0.5, safeTop + 60 * S, W * 0.4)
  glow.addColorStop(0, 'rgba(180,40,50,0.18)')
  glow.addColorStop(1, 'rgba(180,40,50,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn

  // 标题
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#E06060'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _strokeText(c, '挑战失败', W * 0.5, safeTop + 46 * S, 'rgba(60,0,0,0.5)', 4 * S)

  // 装饰线
  const divW = W * 0.18
  c.strokeStyle = 'rgba(180,60,70,0.35)'; c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(W * 0.5 - divW, safeTop + 62 * S)
  c.lineTo(W * 0.5 + divW, safeTop + 62 * S)
  c.stroke()

  // 关卡名 + 回合
  c.fillStyle = 'rgba(80,50,40,0.8)'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  _strokeText(c, result.stageName || '', W * 0.5, safeTop + 78 * S, 'rgba(255,220,200,0.5)', 3 * S)
  c.fillStyle = 'rgba(120,80,60,0.6)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  _strokeText(c, `总回合数：${result.totalTurns}`, W * 0.5, safeTop + 94 * S, 'rgba(255,255,255,0.3)', 2 * S)

  // === 败因分析面板 ===
  const panelTop = safeTop + 112 * S
  _drawDefeatAnalysisPanel(g, c, R, W, H, S, result, panelTop, at)

  c.restore()
}

// ===== 败因分析面板 =====
function _drawDefeatAnalysisPanel(g, c, R, W, H, S, result, panelTop, at) {
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 14 * S
  const innerW = pw - pad * 2

  const tips = _generateDefeatTips(g, result)

  // 预算面板高度
  let contentH = pad * 0.6
  const hasEnemy = result.enemyMaxHp > 0
  if (hasEnemy) contentH += 62 * S
  if (result.waveTotal > 1) contentH += 22 * S
  contentH += 6 * S // 分隔线间距

  // 变强建议区
  if (tips.length > 0) contentH += 24 * S + tips.length * 34 * S + 6 * S

  // 获得的经验/灵石（失败仍有保底）
  if (result.soulStone > 0) contentH += 28 * S
  if (result.cultExp > 0) {
    contentH += 28 * S
    if (result.cultLevelUps > 0) contentH += 16 * S
    contentH += 24 * S
  }

  contentH += pad + 48 * S
  const ph = contentH

  R.drawInfoPanel(px, panelTop, pw, ph)

  let cy = panelTop + pad * 0.6

  // ── 区块1：战斗分析 ──
  if (hasEnemy) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8B5040'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('战斗分析', px + pad, cy + 6 * S)
    cy += 20 * S

    // 敌人头像 + 名称 + 血量条
    const avatarSz = 34 * S
    const avatarX = px + pad
    const avatarY = cy
    const enemyAvatarPath = result.enemyAvatar
      ? `assets/${result.enemyAvatar}.png`
      : ''
    const enemyImg = enemyAvatarPath ? R.getImg(enemyAvatarPath) : null
    if (enemyImg && enemyImg.width > 0) {
      c.save()
      c.beginPath(); c.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2, 0, Math.PI * 2); c.clip()
      const aw = enemyImg.width, ah = enemyImg.height
      const sc = Math.max(avatarSz / aw, avatarSz / ah)
      const dw = aw * sc, dh = ah * sc
      c.drawImage(enemyImg, avatarX + (avatarSz - dw) / 2, avatarY + (avatarSz - dh) / 2, dw, dh)
      c.restore()
      c.strokeStyle = 'rgba(160,60,60,0.5)'; c.lineWidth = 1.5 * S
      c.beginPath(); c.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2, 0, Math.PI * 2); c.stroke()
    } else {
      c.save()
      c.fillStyle = 'rgba(160,60,60,0.15)'
      c.beginPath(); c.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#A05050'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText(result.enemyName ? result.enemyName[0] : '?', avatarX + avatarSz / 2, avatarY + avatarSz / 2)
      c.textAlign = 'left'
      c.restore()
    }

    // 名称 + 属性
    const infoX = avatarX + avatarSz + 8 * S
    const ac = ATTR_COLOR[result.enemyAttr] || ATTR_COLOR.metal
    c.fillStyle = '#5A3830'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillText(result.enemyName || '未知', infoX, avatarY + 10 * S)
    const attrLabel = ATTR_NAME[result.enemyAttr] || ''
    if (attrLabel) {
      c.fillStyle = ac.main; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(`${attrLabel}属性`, infoX + c.measureText(result.enemyName || '').width + 6 * S, avatarY + 10 * S)
    }

    // 血量条
    const barX = infoX
    const barY = avatarY + 22 * S
    const barW = innerW - avatarSz - 8 * S
    const barH = 8 * S
    const hpPct = Math.max(0, Math.min(1, result.enemyHp / result.enemyMaxHp))
    const animPct = Math.min(1, at / 30) * hpPct

    c.fillStyle = 'rgba(0,0,0,0.08)'
    R.rr(barX, barY, barW, barH, barH / 2); c.fill()
    if (animPct > 0) {
      const fillW = Math.max(barH, barW * animPct)
      const barGrad = c.createLinearGradient(barX, barY, barX + fillW, barY)
      barGrad.addColorStop(0, '#cc3030'); barGrad.addColorStop(1, '#e85050')
      c.fillStyle = barGrad
      R.rr(barX, barY, fillW, barH, barH / 2); c.fill()
    }
    c.fillStyle = '#8B5040'; c.font = `${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText(`${Math.ceil(hpPct * 100)}%`, barX + barW, barY + barH + 10 * S)
    c.textAlign = 'left'

    // 动态文案
    let hpMsg = ''
    let hpMsgColor = '#8B5040'
    if (hpPct < 0.3) { hpMsg = '差一点就赢了！再来一次！'; hpMsgColor = '#D4A030' }
    else if (hpPct > 0.7) { hpMsg = '敌强我弱，先提升再挑战'; hpMsgColor = '#A04040' }
    else { hpMsg = '稍加提升即可通关'; hpMsgColor = '#8B6540' }
    c.fillStyle = hpMsgColor; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(hpMsg, barX, barY + barH + 10 * S)

    cy = avatarY + avatarSz + 8 * S
  }

  // 波次进度
  if (result.waveTotal > 1) {
    const waveBarX = px + pad
    const waveBarW = innerW
    c.fillStyle = '#8B5040'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillText(`波次进度：第 ${(result.waveIdx || 0) + 1} / ${result.waveTotal} 波`, waveBarX, cy + 10 * S)
    cy += 22 * S
  }

  // 分隔线
  cy += 2 * S
  c.strokeStyle = 'rgba(180,120,100,0.2)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
  cy += 6 * S

  // ── 区块2：变强建议 ──
  if (tips.length > 0) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#6B6040'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('如何变强', px + pad, cy + 6 * S)
    cy += 24 * S

    for (let i = 0; i < tips.length; i++) {
      const tip = tips[i]
      const tipDelay = 20 + i * 10
      const tipAlpha = Math.min(1, Math.max(0, (at - tipDelay) / 15))
      if (tipAlpha <= 0) { cy += 34 * S; continue }

      c.save()
      c.globalAlpha *= tipAlpha

      // 建议背景条
      const tipH = 28 * S
      const tipBg = c.createLinearGradient(px + pad, cy, px + pw - pad, cy)
      tipBg.addColorStop(0, tip.bgColor || 'rgba(200,180,140,0.1)')
      tipBg.addColorStop(1, 'rgba(200,180,140,0.02)')
      c.fillStyle = tipBg
      R.rr(px + pad, cy, innerW, tipH, 6 * S); c.fill()
      c.strokeStyle = tip.borderColor || 'rgba(180,160,120,0.2)'; c.lineWidth = 0.8 * S
      R.rr(px + pad, cy, innerW, tipH, 6 * S); c.stroke()

      // 图标
      const iconSz = 18 * S
      const iconX = px + pad + 6 * S
      const iconCY = cy + tipH / 2
      c.fillStyle = tip.iconColor || '#B8860B'
      c.font = `${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText(tip.icon, iconX + iconSz / 2, iconCY)

      // 文字
      c.textAlign = 'left'
      c.fillStyle = '#5A4830'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText(tip.title, iconX + iconSz + 4 * S, iconCY - 4 * S)
      c.fillStyle = '#8B7355'; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(tip.desc, iconX + iconSz + 4 * S, iconCY + 8 * S)

      c.restore()
      cy += 34 * S
    }

    cy += 2 * S
    c.strokeStyle = 'rgba(180,120,100,0.2)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 6 * S
  }

  // ── 保底奖励（灵石/经验）──
  if (result.soulStone > 0) {
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${result.soulStone}`, '#5577AA', '#3366AA')
    cy += 28 * S
  }
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
    }
    cy += barH + 18 * S
  }

  // ── 底部按钮 ──
  const btnH = 38 * S
  const btnGap = 12 * S
  const btnW = (innerW - btnGap) / 2
  const btnY = cy + 4 * S

  R.drawDialogBtn(px + pad, btnY, btnW, btnH, '返回', 'cancel')
  _rects.backBtnRect = [px + pad, btnY, btnW, btnH]

  R.drawDialogBtn(px + pad + btnW + btnGap, btnY, btnW, btnH, '再次挑战', 'confirm')
  _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY, btnW, btnH]
}

// ===== 失败建议生成 =====
function _generateDefeatTips(g, result) {
  const tips = []
  const team = result.teamSnapshot || []
  const enemyAttr = result.enemyAttr
  const pool = g.storage.petPool || []

  // 1. 属性克制检查
  if (enemyAttr && COUNTER_MAP) {
    const counterAttr = Object.keys(COUNTER_MAP).find(k => COUNTER_MAP[k] === enemyAttr)
    if (counterAttr) {
      const hasCounter = team.some(p => p.attr === counterAttr)
      if (!hasCounter) {
        const attrName = ATTR_NAME[counterAttr] || counterAttr
        tips.push({
          icon: '⚔',
          iconColor: (ATTR_COLOR[counterAttr] && ATTR_COLOR[counterAttr].main) || '#888',
          title: `带入${attrName}属性灵宠`,
          desc: `克制敌人可造成 2.5 倍伤害`,
          bgColor: 'rgba(180,140,60,0.12)',
          borderColor: 'rgba(180,160,80,0.3)',
          priority: 10,
        })
      }
    }
  }

  // 2. 宠物可升级检查
  const upgradable = pool.filter(p => {
    const soulStone = g.storage.soulStone || 0
    return soulStone >= 10 && p.level < 50
  })
  if (upgradable.length > 0) {
    tips.push({
      icon: '⬆',
      iconColor: '#4488CC',
      title: '灵宠升级',
      desc: `${upgradable.length}只灵宠可提升等级，增强攻击力`,
      bgColor: 'rgba(60,120,200,0.08)',
      borderColor: 'rgba(60,120,200,0.2)',
      priority: 8,
    })
  }

  // 3. 碎片升星检查
  const canStarUp = pool.filter(p => {
    const nextStar = p.star + 1
    const cost = POOL_STAR_FRAG_COST[nextStar]
    return cost && (p.fragments || 0) >= cost
  })
  if (canStarUp.length > 0) {
    tips.push({
      icon: '★',
      iconColor: '#FFD700',
      title: '灵宠升星',
      desc: `${canStarUp.length}只灵宠碎片足够升星，大幅提升攻击`,
      bgColor: 'rgba(200,180,40,0.1)',
      borderColor: 'rgba(200,180,60,0.3)',
      priority: 9,
    })
  }

  // 4. 修炼点未分配
  const cult = g.storage.cultivation
  const totalPoints = cult.level || 0
  const used = usedPoints(cult.levels || {})
  if (totalPoints > used) {
    tips.push({
      icon: '🧘',
      iconColor: '#9060D0',
      title: '修炼加点',
      desc: `有 ${totalPoints - used} 点修炼点未分配，可提升属性`,
      bgColor: 'rgba(140,80,200,0.08)',
      borderColor: 'rgba(140,80,200,0.2)',
      priority: 7,
    })
  }

  // 5. 修炼等级低
  if ((cult.level || 0) < 5 && tips.length < 3) {
    tips.push({
      icon: '📖',
      iconColor: '#8B7355',
      title: '积累修炼经验',
      desc: '多打几关提升等级，解锁更多属性加成',
      bgColor: 'rgba(140,120,80,0.08)',
      borderColor: 'rgba(140,120,80,0.2)',
      priority: 3,
    })
  }

  tips.sort((a, b) => b.priority - a.priority)
  return tips.slice(0, 3)
}

// ===== 胜利奖励面板（增强版：大图标 + 分区高亮 + 入场动画） =====
function _drawVictoryRewardPanel(g, c, R, W, H, S, result, panelTop, at) {
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 14 * S
  const innerW = pw - pad * 2

  const hasRewards = result.rewards && result.rewards.length > 0
  const hasStarBonus = (result.starBonusSoulStone > 0 || result.starBonusAwakenStone > 0 || result.starBonusFragments > 0)
  const hasMilestones = result.milestoneRewards && result.milestoneRewards.length > 0

  // 预算面板内容高度
  let contentH = pad * 0.5
  if (hasRewards) {
    contentH += 24 * S
    for (const r of result.rewards) {
      contentH += (r.type === 'pet' ? 46 : r.type === 'fragment' ? 40 : r.type === 'weapon' ? 52 : 30) * S
    }
    contentH += 10 * S
  }
  if (hasStarBonus) contentH += 30 * S + 10 * S
  if (hasMilestones) contentH += 10 * S + result.milestoneRewards.length * 28 * S
  if (result.soulStone > 0) contentH += 32 * S
  if (result.cultExp > 0) {
    contentH += 28 * S
    if (result.cultLevelUps > 0) contentH += 16 * S
    contentH += 26 * S
  }
  // 汇总行
  contentH += 24 * S
  contentH += pad + 48 * S

  R.drawInfoPanel(px, panelTop, pw, contentH)

  let cy = panelTop + pad * 0.6
  let rowIdx = 0

  // === 掉落奖励 ===
  if (hasRewards) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8B7355'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('掉落奖励', px + pad, cy + 6 * S)
    if (result.isFirstClear) {
      c.save()
      c.textAlign = 'right'
      c.shadowColor = 'rgba(200,150,0,0.5)'; c.shadowBlur = 6 * S
      c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText('✦ 首通奖励', px + pw - pad, cy + 6 * S)
      c.restore()
    }
    cy += 24 * S

    for (const r of result.rewards) {
      const rowDelay = 15 + rowIdx * 6
      const rowAlpha = Math.min(1, Math.max(0, (at - rowDelay) / 12))
      const rowSlide = (1 - rowAlpha) * 20 * S

      if (rowAlpha <= 0) {
        cy += (r.type === 'pet' ? 46 : r.type === 'fragment' ? 40 : r.type === 'weapon' ? 52 : 30) * S
        rowIdx++
        continue
      }

      c.save()
      c.globalAlpha *= rowAlpha
      c.translate(rowSlide, 0)

      if (r.type === 'pet' && r.petId) {
        _drawPetRowEnhanced(c, R, S, px + pad, cy, innerW, r, at, rowDelay)
        cy += 46 * S
      } else if (r.type === 'fragment' && r.petId) {
        _drawFragmentRowEnhanced(c, R, S, px + pad, cy, innerW, r, g)
        cy += 40 * S
      } else if (r.type === 'weapon' && r.weaponId) {
        _drawWeaponRowEnhanced(c, R, S, px + pad, cy, innerW, r, at)
        cy += 52 * S
      } else if (r.type === 'exp') {
        _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${r.amount}`, '#8B7355', '#B8860B')
        cy += 30 * S
      } else if (r.type === 'soulStone') {
        _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${r.amount}`, '#6688AA', '#4488CC')
        cy += 30 * S
      }

      c.restore()
      rowIdx++
    }

    cy += 2 * S
    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 8 * S
  }

  // === 星级达成奖励（高亮条） ===
  if (hasStarBonus) {
    const starRowDelay = 15 + rowIdx * 6
    const starRowAlpha = Math.min(1, Math.max(0, (at - starRowDelay) / 12))
    c.save()
    c.globalAlpha *= starRowAlpha

    // 高亮背景
    const hlH = 24 * S
    const hlGrad = c.createLinearGradient(px + pad, cy, px + pw - pad, cy)
    hlGrad.addColorStop(0, 'rgba(255,215,0,0.12)')
    hlGrad.addColorStop(1, 'rgba(255,215,0,0.03)')
    c.fillStyle = hlGrad
    R.rr(px + pad, cy, innerW, hlH, 5 * S); c.fill()

    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#C07020'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    const maxNew = result.newStars ? Math.max(...result.newStars) : 0
    c.fillText(`${'★'.repeat(maxNew)} 达成奖励`, px + pad + 6 * S, cy + hlH / 2)
    c.textAlign = 'right'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    const parts = []
    if (result.starBonusSoulStone > 0) parts.push(`灵石+${result.starBonusSoulStone}`)
    if (result.starBonusFragments > 0) parts.push(`碎片+${result.starBonusFragments}`)
    if (result.starBonusAwakenStone > 0) parts.push(`觉醒石+${result.starBonusAwakenStone}`)
    c.fillStyle = '#D4A030'
    c.fillText(parts.join('  '), px + pw - pad - 6 * S, cy + hlH / 2)
    c.restore()
    cy += 30 * S
    rowIdx++

    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 10 * S
  }

  // === 章节里程碑 ===
  if (hasMilestones) {
    for (const ms of result.milestoneRewards) {
      const msDelay = 15 + rowIdx * 6
      const msAlpha = Math.min(1, Math.max(0, (at - msDelay) / 12))
      c.save()
      c.globalAlpha *= msAlpha

      // 紫色高亮背景
      const msH = 22 * S
      c.fillStyle = 'rgba(140,60,220,0.08)'
      R.rr(px + pad, cy, innerW, msH, 5 * S); c.fill()

      c.textAlign = 'left'; c.textBaseline = 'middle'
      c.fillStyle = '#B44DFF'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText(`🏆 里程碑 ${ms.milestoneStars}★ 达成！`, px + pad + 6 * S, cy + msH / 2)
      c.textAlign = 'right'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      const mParts = []
      if (ms.soulStone) mParts.push(`灵石+${ms.soulStone}`)
      if (ms.fragment) mParts.push(`碎片+${ms.fragment}`)
      if (ms.awakenStone) mParts.push(`觉醒石+${ms.awakenStone}`)
      c.fillStyle = '#9060D0'
      c.fillText(mParts.join(' '), px + pw - pad - 6 * S, cy + msH / 2)
      c.restore()
      cy += 28 * S
      rowIdx++
    }
    cy += 10 * S
  }

  // === 灵石 ===
  if (result.soulStone > 0) {
    const ssDelay = 15 + rowIdx * 6
    const ssAlpha = Math.min(1, Math.max(0, (at - ssDelay) / 12))
    c.save(); c.globalAlpha *= ssAlpha
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${result.soulStone}`, '#5577AA', '#3366AA')
    c.restore()
    cy += 32 * S
    rowIdx++
  }

  // === 修炼经验 ===
  if (result.cultExp > 0) {
    const expDelay = 15 + rowIdx * 6
    const expAlpha = Math.min(1, Math.max(0, (at - expDelay) / 12))
    c.save(); c.globalAlpha *= expAlpha
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${result.cultExp}`, '#8B7355', '#B8860B')
    c.restore()
    cy += 22 * S

    if (result.cultLevelUps > 0) {
      c.save()
      c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.shadowColor = 'rgba(200,150,0,0.4)'; c.shadowBlur = 6 * S
      const cult = g.storage.cultivation
      c.fillText(`升级！Lv.${result.cultPrevLevel} → Lv.${cult.level}  获得 ${result.cultLevelUps} 修炼点`, W / 2, cy + 4 * S)
      c.restore()
      cy += 16 * S
    }

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
    cy += barH + 20 * S
    rowIdx++
  }

  // === 汇总行 ===
  const summaryDelay = 15 + rowIdx * 6
  const summaryAlpha = Math.min(1, Math.max(0, (at - summaryDelay) / 12))
  if (summaryAlpha > 0) {
    c.save()
    c.globalAlpha *= summaryAlpha
    const sumParts = []
    const totalSS = result.soulStone || 0
    const totalExp = result.cultExp || 0
    let totalFrags = 0
    if (result.rewards) result.rewards.forEach(r => { if (r.type === 'fragment') totalFrags += r.count })
    if (totalSS > 0) sumParts.push(`灵石 +${totalSS}`)
    if (totalFrags > 0) sumParts.push(`碎片 +${totalFrags}`)
    if (totalExp > 0) sumParts.push(`经验 +${totalExp}`)
    if (sumParts.length > 0) {
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#A09070'; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(`本次共获得：${sumParts.join('、')}`, W / 2, cy + 6 * S)
    }
    c.restore()
  }
  cy += 24 * S

  // === 底部按钮 ===
  const btnH = 38 * S
  const btnGap = 12 * S
  const btnW = (innerW - btnGap) / 2
  const btnY = cy + 4 * S

  R.drawDialogBtn(px + pad, btnY, btnW, btnH, '返回', 'cancel')
  _rects.backBtnRect = [px + pad, btnY, btnW, btnH]

  const nextId = getNextStageId(result.stageId)
  const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
  const rightLabel = hasNext ? '下一关' : '再次挑战'
  R.drawDialogBtn(px + pad + btnW + btnGap, btnY, btnW, btnH, rightLabel, 'confirm')
  _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY, btnW, btnH]
}

// ===== 首通宠物奖励行（增强版：大图标 + 光效） =====
function _drawPetRowEnhanced(c, R, S, x, cy, innerW, reward, at, rowDelay) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const ac = pet ? (ATTR_COLOR[attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
  const attrColor = ac.main || '#888'

  // 高亮背景条
  const hlH = 40 * S
  const hlGrad = c.createLinearGradient(x, cy, x + innerW, cy)
  hlGrad.addColorStop(0, 'rgba(255,215,0,0.1)')
  hlGrad.addColorStop(1, 'rgba(255,215,0,0.02)')
  c.fillStyle = hlGrad
  R.rr(x, cy, innerW, hlH, 6 * S); c.fill()
  c.strokeStyle = 'rgba(200,170,60,0.25)'; c.lineWidth = 0.8 * S
  R.rr(x, cy, innerW, hlH, 6 * S); c.stroke()

  const iconSz = 36 * S
  const iconX = x + 4 * S
  const iconY = cy + (hlH - iconSz) / 2

  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      c.save()
      c.shadowColor = attrColor; c.shadowBlur = 8 * S
      R.rr(iconX, iconY, iconSz, iconSz, 7 * S); c.clip()
      const aw = img.width, ah = img.height
      const scale = Math.max(iconSz / aw, iconSz / ah)
      const dw = aw * scale, dh = ah * scale
      c.drawImage(img, iconX + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
      c.restore()
      const rv = RARITY_VISUAL[getPetRarity(reward.petId)] || RARITY_VISUAL.R
      c.save()
      c.shadowColor = rv.glowColor || attrColor; c.shadowBlur = 6 * S
      c.strokeStyle = rv.borderColor; c.lineWidth = 2 * S
      R.rr(iconX, iconY, iconSz, iconSz, 7 * S); c.stroke()
      c.restore()
    }
  }

  // 品质徽标
  const rv2 = RARITY_VISUAL[getPetRarity(reward.petId)] || RARITY_VISUAL.R
  const badgeW = rv2.label.length * 8 * S + 6 * S
  const badgeH = 13 * S
  const badgeX = iconX + iconSz - badgeW + 2 * S
  const badgeY = iconY - 2 * S
  c.fillStyle = rv2.badgeBg
  R.rr(badgeX, badgeY, badgeW, badgeH, 3 * S); c.fill()
  c.fillStyle = rv2.badgeColor; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(rv2.label, badgeX + badgeW / 2, badgeY + badgeH / 2)

  // 宠物名
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = attrColor; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText(name, iconX + iconSz + 8 * S, cy + hlH / 2 - 4 * S)

  // "获得灵宠！"闪烁
  const glowAlpha = 0.7 + 0.3 * Math.sin(at * 0.08)
  c.save()
  c.globalAlpha *= glowAlpha
  c.fillStyle = '#FFD700'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.shadowColor = 'rgba(200,150,0,0.5)'; c.shadowBlur = 4 * S
  c.fillText('获得灵宠！', iconX + iconSz + 8 * S, cy + hlH / 2 + 10 * S)
  c.restore()
}

// ===== 碎片奖励行（增强版：含进度提示） =====
function _drawFragmentRowEnhanced(c, R, S, x, cy, innerW, reward, g) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const attrColor = pet ? ((ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || '#888') : '#888'

  const iconSz = 32 * S
  const rowH = 34 * S
  const iconX = x + 4 * S
  const iconY = cy + (rowH - iconSz) / 2

  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      c.save()
      R.rr(iconX, iconY, iconSz, iconSz, 5 * S); c.clip()
      const aw = img.width, ah = img.height
      const scale = Math.max(iconSz / aw, iconSz / ah)
      const dw = aw * scale, dh = ah * scale
      c.drawImage(img, iconX + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
      c.restore()
      c.strokeStyle = attrColor; c.lineWidth = 1.5 * S
      R.rr(iconX, iconY, iconSz, iconSz, 5 * S); c.stroke()
    }
  }

  // 名称 + 数量
  const textX = iconX + iconSz + 8 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = attrColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(`${name}碎片`, textX, cy + rowH / 2 - 4 * S)

  c.fillStyle = '#D4A030'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`×${reward.count}`, x + innerW, cy + rowH / 2 - 4 * S)

  // 碎片进度提示
  const poolPet = g.storage.getPoolPet(reward.petId)
  if (poolPet) {
    const nextStar = poolPet.star + 1
    const cost = POOL_STAR_FRAG_COST[nextStar]
    if (cost) {
      const current = poolPet.fragments || 0
      c.textAlign = 'left'
      c.fillStyle = current >= cost ? '#D4A030' : '#A09070'
      c.font = `${8*S}px "PingFang SC",sans-serif`
      const progressText = current >= cost
        ? `碎片足够升${nextStar}★！`
        : `升${nextStar}★ 进度 ${current}/${cost}`
      c.fillText(progressText, textX, cy + rowH / 2 + 8 * S)
    }
  }
}

// ===== 法宝掉落行（胜利结算） =====
function _drawWeaponRowEnhanced(c, R, S, x, cy, innerW, reward, at) {
  const w = getWeaponById(reward.weaponId)
  const name = w ? w.name : reward.weaponId
  const desc = w ? w.desc : ''
  const rarityKey = getWeaponRarity(reward.weaponId) || 'R'
  const rv = RARITY_VISUAL[rarityKey] || RARITY_VISUAL.R

  const hlH = 52 * S
  const hlGrad = c.createLinearGradient(x, cy, x + innerW, cy)
  hlGrad.addColorStop(0, 'rgba(255,215,0,0.08)')
  hlGrad.addColorStop(1, 'rgba(255,215,0,0.02)')
  c.fillStyle = hlGrad
  R.rr(x, cy, innerW, hlH, 6 * S); c.fill()
  c.strokeStyle = 'rgba(200,170,60,0.2)'; c.lineWidth = 0.8 * S
  R.rr(x, cy, innerW, hlH, 6 * S); c.stroke()

  const iconSz = 40 * S
  const iconX = x + 4 * S
  const iconY = cy + (hlH - iconSz) / 2
  const fabaoPath = `assets/equipment/fabao_${reward.weaponId}.png`
  const img = R.getImg(fabaoPath)

  if (img && img.width > 0) {
    c.save()
    c.shadowColor = rv.glowColor || rv.borderColor; c.shadowBlur = 6 * S
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.clip()
    const aw = img.width, ah = img.height
    const scale = Math.max(iconSz / aw, iconSz / ah)
    const dw = aw * scale, dh = ah * scale
    c.drawImage(img, iconX + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
    c.restore()
    c.save()
    c.strokeStyle = rv.borderColor; c.lineWidth = 2 * S
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.stroke()
    c.restore()
  } else {
    c.save()
    c.fillStyle = 'rgba(120,100,60,0.2)'
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.fill()
    c.strokeStyle = rv.borderColor; c.lineWidth = 2 * S
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.stroke()
    c.restore()
  }

  if (reward.isNew) {
    const newPulse = 0.75 + 0.25 * Math.sin((at || 0) * 0.1)
    c.save()
    c.globalAlpha *= newPulse
    c.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'; c.textBaseline = 'bottom'
    c.fillStyle = '#FF4444'
    c.shadowColor = 'rgba(255,0,0,0.5)'; c.shadowBlur = 4 * S
    c.fillText('NEW', iconX + iconSz, iconY - 2 * S)
    c.restore()
  }

  const textX = iconX + iconSz + 8 * S
  c.textAlign = 'left'
  c.fillStyle = '#FFD700'; c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.shadowColor = 'rgba(100,70,0,0.35)'; c.shadowBlur = 3 * S
  c.textBaseline = 'top'
  c.fillText(name, textX, cy + 10 * S)
  c.shadowBlur = 0
  c.fillStyle = 'rgba(160,150,140,0.95)'; c.font = `${9 * S}px "PingFang SC",sans-serif`
  const maxDescW = innerW - (textX - x) - 4 * S
  _fillTextWrapped(c, desc, textX, cy + 24 * S, maxDescW, 10 * S, 2)
}

function _fillTextWrapped(c, text, x, startY, maxWidth, lineHeight, maxLines) {
  if (!text) return
  c.textAlign = 'left'; c.textBaseline = 'top'
  const limit = maxLines || 2
  const chars = Array.from(text)
  const lines = []
  let line = ''
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (c.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = chars[i]
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  let toDraw = lines
  if (lines.length > limit) {
    const restJoined = lines.slice(limit - 1).join('')
    let tail = restJoined
    const suffix = '…'
    while (tail.length > 0 && c.measureText(tail + suffix).width > maxWidth) tail = tail.slice(0, -1)
    toDraw = lines.slice(0, limit - 1).concat(tail + suffix)
  }

  let y = startY
  for (let i = 0; i < toDraw.length; i++) {
    c.fillText(toDraw[i], x, y)
    y += lineHeight
  }
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
      g.setScene('title')
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
