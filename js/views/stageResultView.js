/**
 * 关卡结算页 — 全屏水墨风格
 * 胜利：金色光芒 + 评价星级 + 庆祝特效
 * 失败：暗红色调 + 鼓励文案
 * 渲染入口：rStageResult  触摸入口：tStageResult
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById, getPetAvatarPath } = require('../data/pets')
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
  const starCount = result.rating === 'S' ? 3 : result.rating === 'A' ? 2 : 1
  const totalStarsW = 3 * starSize + 2 * starGap
  const starStartX = (W - totalStarsW) / 2

  for (let i = 0; i < 3; i++) {
    const sx = starStartX + i * (starSize + starGap) + starSize / 2
    const delay = i * 8
    const starProgress = Math.min(1, Math.max(0, (at - 10 - delay) / 12))
    if (starProgress <= 0) continue

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
  if (result.petExp > 0) contentH += 32 * S
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
      } else if (r.type === 'petExp') {
        _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_pet_exp', '宠物经验', `+${r.amount}`, '#6688AA', '#4488CC')
        cy += 28 * S
      }
    }

    // 分隔线
    cy += 2 * S
    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 8 * S
  }

  // === 宠物经验池 ===
  if (result.petExp > 0) {
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_pet_exp', '宠物经验池', `+${result.petExp}`, '#5577AA', '#3366AA')
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
      // 金色高亮边框
      c.strokeStyle = '#FFD700'; c.lineWidth = 2 * S
      R.rr(x, iconY, iconSz, iconSz, 5 * S); c.stroke()
    }
  }

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

// ===== 触摸 =====
function tStageResult(g, x, y, type) {
  if (type !== 'end') return
  const result = g._stageResult
  if (!result) return

  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g.setScene('stageSelect')
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  if (_rects.nextBtnRect && g._hitRect(x, y, ..._rects.nextBtnRect)) {
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
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }
}

module.exports = { rStageResult, tStageResult }
