/**
 * 关卡结算页 — 全屏水墨风格
 * 胜利：金色光芒 + 评价星级 + 奖励高亮展示
 * 失败：败因分析 + 变强建议
 * 渲染入口：rStageResult  触摸入口：tStageResult
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetRarity } = require('../data/pets')
const { getWeaponById, getWeaponRarity } = require('../data/weapons')
const { rarityVisualForAttr, rgbaFromHex } = require('../data/rewardVisual')
const { MAX_LEVEL, expToNextLevel, currentRealm } = require('../data/cultivationConfig')
const { POOL_STAR_FRAG_COST } = require('../data/petPoolConfig')
const { getNextStageId, getStageById, isStageUnlocked } = require('../data/stages')
const { analyzeDefeat } = require('../engine/strategyAdvisor')
const MusicMgr = require('../runtime/music')

const _rects = {
  backBtnRect: null,
  nextBtnRect: null,
}

let _animTimer = 0
let _lastScene = null

/** 胜利结算奖励面板：总可滚高度超出屏高时，在面板可视区内滚动 */
let _victoryRewardScroll = 0
let _victoryRewardScrollMax = 0
let _victoryRewardViewport = null
let _victScrollActive = false
let _victScrollStartY = 0
let _victScrollLastY = 0
let _victScrollMoved = false

function rStageResult(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  if (_lastScene !== 'stageResult') {
    _animTimer = 0
    _lastScene = 'stageResult'
    _victoryRewardScroll = 0
    _victoryRewardScrollMax = 0
    _victoryRewardViewport = null
  }
  _animTimer++
  const at = _animTimer
  const fadeIn = Math.min(1, at / 20)

  const result = g._stageResult
  if (!result) return

  if (!result.victory) {
    _victoryRewardScrollMax = 0
    _victoryRewardViewport = null
  }

  // 首次进入结算页时，检测是否需要触发新手宠物庆祝（1-1 / 1-2 / 1-3 首通均触发）
  if (at === 1 && !result._celebrateTriggered && result.victory && result.isFirstClear
      && (result.stageId === 'stage_1_1' || result.stageId === 'stage_1_2' || result.stageId === 'stage_1_3')) {
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

/** 关卡通关页：暗角 + 强放射光 + 金粉粒子（参考高满足感获得页） */
function _drawCelebrationBackdrop(c, W, H, S, centerY, at, fadeIn) {
  c.save()
  c.globalAlpha = fadeIn
  const vig = c.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.12, W * 0.5, H * 0.45, Math.max(W, H) * 0.72)
  vig.addColorStop(0, 'rgba(55,38,22,0)')
  vig.addColorStop(1, 'rgba(18,12,8,0.62)')
  c.fillStyle = vig
  c.fillRect(0, 0, W, H)
  c.fillStyle = 'rgba(90,55,28,0.14)'
  c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn * (0.14 + 0.07 * Math.sin(at * 0.034))
  c.translate(W * 0.5, centerY)
  c.rotate(at * 0.0023)
  const nRays = 16
  for (let i = 0; i < nRays; i++) {
    c.rotate((Math.PI * 2) / nRays)
    c.beginPath(); c.moveTo(0, 0)
    c.lineTo(-24 * S, -H * 0.55); c.lineTo(24 * S, -H * 0.55)
    c.closePath()
    const rg = c.createLinearGradient(0, 0, 0, -H * 0.52)
    rg.addColorStop(0, 'rgba(255,235,160,0.95)')
    rg.addColorStop(0.35, 'rgba(255,200,80,0.35)')
    rg.addColorStop(1, 'rgba(255,180,40,0)')
    c.fillStyle = rg
    c.fill()
  }
  c.restore()

  c.save()
  c.globalAlpha = fadeIn * 0.88
  const glow = c.createRadialGradient(W * 0.5, centerY, 0, W * 0.5, centerY, W * 0.68)
  glow.addColorStop(0, 'rgba(255,220,120,0.38)')
  glow.addColorStop(0.42, 'rgba(255,170,70,0.14)')
  glow.addColorStop(1, 'rgba(255,200,80,0)')
  c.fillStyle = glow
  c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn * 0.5
  const t = at * 0.018
  for (let i = 0; i < 26; i++) {
    const sx = ((Math.sin(i * 12.9898 + t * 1.1) * 0.5 + 0.5) * 0.92 + 0.04) * W
    const sy = ((Math.cos(i * 7.1234 + t * 0.75) * 0.5 + 0.5) * 0.78 + 0.06) * H
    const r = (2.5 + (i % 6)) * S * (0.85 + 0.15 * Math.sin(at * 0.048 + i * 0.7))
    const ga = 0.12 + 0.14 * Math.sin(at * 0.07 + i)
    c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,230,180,${ga})`
    c.fill()
  }
  c.globalAlpha = fadeIn * 0.65
  for (let i = 0; i < 36; i++) {
    const sx = (i * 113 + at * 1.7 + Math.sin(i) * 40) % (W - 4 * S)
    const sy = (i * 67 + at * 1.1) % (H * 0.92)
    const tw = (1 + (i % 3)) * S
    c.fillStyle = `rgba(255,255,255,${0.18 + 0.22 * Math.sin(at * 0.11 + i)})`
    c.fillRect(sx, sy, tw, tw)
  }
  c.restore()
}

function _drawPedestalCloud(c, R, S, cx, avatarBottomY, width) {
  const cy = avatarBottomY - 4 * S
  const rx = width * 0.5
  const ry = 14 * S
  const grd = c.createRadialGradient(cx, cy - 4 * S, 0, cx, cy, rx * 1.1)
  grd.addColorStop(0, 'rgba(255,250,240,0.82)')
  grd.addColorStop(0.45, 'rgba(255,235,210,0.4)')
  grd.addColorStop(1, 'rgba(255,210,170,0)')
  c.fillStyle = grd
  c.beginPath()
  if (typeof c.ellipse === 'function') {
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  } else {
    R.rr(cx - rx, cy - ry, rx * 2, ry * 2, ry)
  }
  c.fill()
}

function _drawRarityDiamondBadge(c, S, cx, cy, rv, tag) {
  const r = 11 * S
  c.save()
  c.translate(cx, cy)
  c.rotate(-0.1)
  c.beginPath()
  c.moveTo(0, -r)
  c.lineTo(r * 0.92, 0)
  c.lineTo(0, r)
  c.lineTo(-r * 0.92, 0)
  c.closePath()
  c.shadowColor = rv.glowColor || 'rgba(180,100,255,0.55)'
  c.shadowBlur = 10 * S
  c.fillStyle = rv.badgeBg || 'rgba(80,30,120,0.9)'
  c.fill()
  c.strokeStyle = rv.borderColor
  c.lineWidth = 1.2 * S
  c.stroke()
  c.shadowBlur = 0
  c.fillStyle = rv.badgeColor
  c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(tag, 0, 0.5 * S)
  c.restore()
}

/** 顶部「恭喜获得」并排展示：首通灵宠 + 本次新入库法宝（与 _isFeaturedNewDrop 一致） */
function _heroSpotlightItems(result) {
  if (!result || !result.rewards) return []
  return result.rewards.filter(_isFeaturedNewDrop)
}

function _heroSpotlightRewardKeys(result) {
  const keys = new Set()
  for (const r of _heroSpotlightItems(result)) {
    if (r.type === 'pet' && r.petId) keys.add(`pet:${r.petId}`)
    if (r.type === 'weapon' && r.weaponId) keys.add(`weapon:${r.weaponId}`)
  }
  return keys
}

function _spotlightRarityTag(rarityKey, attrKey) {
  const rv = rarityVisualForAttr(rarityKey, attrKey || 'metal')
  return { rv, tag: rv.label }
}

/** 关卡通关后：恭喜获得区高度（多卡并排时略压缩单卡尺寸） */
function _victoryHeroBlockHeight(S, result) {
  const items = _heroSpotlightItems(result)
  const n = items.length
  if (n === 0) return 0
  const avatarSz = n <= 1 ? 86 * S : n === 2 ? 74 * S : 64 * S
  const hasPet = items.some(r => r.type === 'pet')
  const below = hasPet ? (14 * S + 20 * S + 12 * S) : (24 * S + 12 * S)
  return 34 * S + avatarSz + below
}

function _drawVictoryHeroPetTile(g, c, R, S, result, reward, cx, avatarX, avatarY, avatarSize, at, heroCount) {
  const petId = reward.petId
  const pet = getPetById(petId)
  if (!pet) return
  const rarityKey = getPetRarity(petId)
  const { rv, tag } = _spotlightRarityTag(rarityKey, pet.attr)
  const poolPet = g.storage.getPoolPet(petId)
  const starLv = (poolPet && poolPet.star) ? poolPet.star : 1

  const badgeCx = avatarX + 6 * S
  const badgeCy = avatarY + 14 * S
  _drawRarityDiamondBadge(c, S, badgeCx, badgeCy, rv, tag)

  c.save()
  c.translate(avatarX + avatarSize + 4 * S, avatarY - 2 * S)
  c.rotate(-0.22)
  c.fillStyle = 'rgba(180,120,20,0.95)'
  R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.fill()
  c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 1 * S
  R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.stroke()
  c.fillStyle = '#FFF8E0'
  c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('New', 0, 0)
  c.restore()

  const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
  const avatarPath = getPetAvatarPath({ ...pet, star: starLv })
  const img = R.getImg(avatarPath)
  if (img && img.width > 0) {
    c.save()
    c.shadowColor = ac.main; c.shadowBlur = 18 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 14 * S); c.clip()
    const aw = img.width, ah = img.height
    const sc = Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * sc, dh = ah * sc
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
    c.restore()
    c.save()
    c.shadowColor = ac.main; c.shadowBlur = 12 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 14 * S)
    c.strokeStyle = ac.main; c.lineWidth = 2.5 * S; c.stroke()
    c.restore()
  }

  const starY = avatarY + avatarSize + 14 * S
  const starN = Math.min(Math.max(starLv, 1), 5)
  const starStep = Math.min(15 * S, avatarSize / Math.max(starN, 1) + 4 * S)
  const span = (starN - 1) * starStep
  c.font = `${Math.min(15 * S, avatarSize * 0.22)}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  for (let si = 0; si < starN; si++) {
    c.fillStyle = ac.main
    c.shadowColor = rgbaFromHex(ac.main, 0.55)
    c.shadowBlur = 6 * S
    c.fillText('★', cx - span / 2 + si * starStep, starY)
    c.shadowBlur = 0
  }

  const subY = starY + 20 * S
  c.font = `bold ${(heroCount <= 1 ? 11 : 10) * S}px "PingFang SC",sans-serif`
  c.fillStyle = '#fff5e0'
  if (heroCount <= 1) {
    _strokeText(c, `获得灵宠「${pet.name}」`, cx, subY, 'rgba(0,0,0,0.45)', 2.5 * S)
  } else {
    const shortName = pet.name.length > 6 ? pet.name.slice(0, 6) + '…' : pet.name
    _strokeText(c, `灵宠「${shortName}」`, cx, subY, 'rgba(0,0,0,0.45)', 2 * S)
  }
}

function _drawVictoryHeroWeaponTile(g, c, R, S, reward, cx, avatarX, avatarY, avatarSize, nameY, heroCount) {
  const wid = reward.weaponId
  const w = getWeaponById(wid)
  if (!w) return
  const rarityKey = getWeaponRarity(wid) || 'R'
  const { rv, tag } = _spotlightRarityTag(rarityKey, w.attr || 'metal')

  const badgeCxW = avatarX + 6 * S
  const badgeCyW = avatarY + 14 * S
  _drawRarityDiamondBadge(c, S, badgeCxW, badgeCyW, rv, tag)

  if (reward.isNew) {
    c.save()
    c.translate(avatarX + avatarSize + 4 * S, avatarY - 2 * S)
    c.rotate(-0.22)
    c.fillStyle = 'rgba(180,120,20,0.95)'
    R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.fill()
    c.strokeStyle = 'rgba(255,240,200,0.7)'; c.lineWidth = 1 * S
    R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.stroke()
    c.fillStyle = '#FFF8E0'
    c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('New', 0, 0)
    c.restore()
  }

  const wAc = w.attr ? (ATTR_COLOR[w.attr] || ATTR_COLOR.metal) : null
  const strokeAttr = wAc ? wAc.main : rv.borderColor

  const iconPath = `assets/equipment/fabao_${wid}.png`
  const img = R.getImg(iconPath)
  if (img && img.width > 0) {
    c.save()
    c.shadowColor = strokeAttr; c.shadowBlur = 16 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 14 * S); c.clip()
    const aw = img.width, ah = img.height
    const sc = Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * sc, dh = ah * sc
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
    c.restore()
    c.strokeStyle = strokeAttr; c.lineWidth = 2.5 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 14 * S); c.stroke()
  }

  c.textAlign = 'center'
  c.font = `bold ${(heroCount <= 1 ? 11 : 10) * S}px "PingFang SC",sans-serif`
  c.fillStyle = '#fff5e0'
  if (heroCount <= 1) {
    _strokeText(c, `获得法宝「${w.name}」`, cx, nameY, 'rgba(0,0,0,0.45)', 2.5 * S)
  } else {
    const shortName = w.name.length > 6 ? w.name.slice(0, 6) + '…' : w.name
    _strokeText(c, `法宝「${shortName}」`, cx, nameY, 'rgba(0,0,0,0.45)', 2 * S)
  }
}

function _drawVictoryHeroSpotlight(g, c, R, W, S, result, blockTop, at, fadeIn) {
  const items = _heroSpotlightItems(result)
  if (!items.length) return
  const enter = Math.min(1, Math.max(0, (at - 6) / 16))
  const bounce = enter < 1 ? (0.88 + 0.12 * Math.sin(enter * Math.PI)) : (1 + 0.02 * Math.sin(at * 0.07))

  c.save()
  c.globalAlpha = fadeIn * enter

  const n = items.length
  const gap = 12 * S
  const avatarSize = (n <= 1 ? 86 * S : n === 2 ? 74 * S : 64 * S) * bounce
  const rowW = n * avatarSize + (n - 1) * gap
  const startX = (W - rowW) / 2

  let y = blockTop
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFF5E0'
  c.font = `bold ${17 * S}px "PingFang SC",sans-serif`
  _strokeText(c, '恭喜获得', W / 2, y + 12 * S, 'rgba(55,35,18,0.55)', 3 * S)
  y += 34 * S

  const avatarY = y
  const hasPet = items.some(r => r.type === 'pet')
  const nameY = hasPet ? avatarY + avatarSize + 14 * S + 20 * S : avatarY + avatarSize + 20 * S

  _drawPedestalCloud(c, R, S, W / 2, avatarY + avatarSize, Math.max(rowW * 0.5, avatarSize * 1.15))

  for (let i = 0; i < n; i++) {
    const reward = items[i]
    const tileCx = startX + i * (avatarSize + gap) + avatarSize / 2
    const avatarX = tileCx - avatarSize / 2
    const delay = i * 5
    const tileIn = Math.min(1, Math.max(0, (at - 8 - delay) / 12))
    c.save()
    c.globalAlpha *= tileIn
    const rowSlide = (1 - tileIn) * 16 * S
    c.translate(rowSlide, 0)
    if (reward.type === 'pet' && reward.petId) {
      _drawVictoryHeroPetTile(g, c, R, S, result, reward, tileCx, avatarX, avatarY, avatarSize, at, n)
    } else if (reward.type === 'weapon' && reward.weaponId) {
      _drawVictoryHeroWeaponTile(g, c, R, S, reward, tileCx, avatarX, avatarY, avatarSize, nameY, n)
    }
    c.restore()
  }

  c.restore()
}

// ===== 胜利全屏 =====
function _drawVictoryScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn) {
  const spotlightCenterY = safeTop + 115 * S
  _drawCelebrationBackdrop(c, W, H, S, spotlightCenterY, at, fadeIn)

  c.fillStyle = 'rgba(255,240,200,0.06)'
  c.fillRect(0, 0, W, H)

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

  // 星级结算加成已反映在下方灵石/碎片等总额中，此处只作提示，不再单独列数字，避免与面板重复
  const hasStarSettleBonus =
    (result.starBonusSoulStone > 0 || result.starBonusAwakenStone > 0 || result.starBonusFragments > 0)
  const starBandExtra = hasStarSettleBonus ? 16 * S : 0
  if (hasStarSettleBonus) {
    const hintY = starY + starSize / 2 + 52 * S
    const hintIn = Math.min(1, Math.max(0, (at - 26) / 14))
    c.save()
    c.globalAlpha *= hintIn
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `${9 * S}px "PingFang SC",sans-serif`
    c.fillStyle = 'rgba(140,100,50,0.92)'
    const mxNew = result.newStars && result.newStars.length ? Math.max(...result.newStars) : starCount
    const starTag = mxNew > 0 ? `${'★'.repeat(Math.min(mxNew, 3))} ` : ''
    c.fillText(`${starTag}本关星级奖励已计入下方总收益`, W * 0.5, hintY)
    c.restore()
  }

  // === 核心奖励高光（灵宠/法宝） + 奖励明细面板 ===
  let panelTop = starY + starSize / 2 + 56 * S + starBandExtra
  if (_heroSpotlightItems(result).length > 0) {
    _drawVictoryHeroSpotlight(g, c, R, W, S, result, panelTop, at, fadeIn)
    panelTop += _victoryHeroBlockHeight(S, result)
  }
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

  const tipsData = _generateDefeatTips(g, result)
  const tips = tipsData.items || []

  // 预算面板高度
  let contentH = pad * 0.6
  const hasEnemy = result.enemyMaxHp > 0
  if (hasEnemy) contentH += 62 * S
  if (result.waveTotal > 1) contentH += 22 * S
  contentH += 6 * S // 分隔线间距

  // 战力对比条
  if (tipsData.powerPct < 100) contentH += 40 * S

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

  // ── 战力对比条 ──
  if (tipsData.powerPct < 100) {
    const barX = px + pad, barW = innerW, barH = 10 * S
    const pct = Math.min(1, Math.max(0, tipsData.powerPct / 100))
    const animPct = Math.min(1, at / 30) * pct
    const barColor = pct < 0.5 ? '#cc3030' : pct < 0.8 ? '#D4A030' : '#40A060'

    c.textAlign = 'left'; c.fillStyle = '#8B5040'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`我方 ${tipsData.teamAtk}`, barX, cy + 4 * S)
    c.textAlign = 'right'; c.fillStyle = '#606050'
    c.fillText(`建议 ${tipsData.suggestedAtk}+`, barX + barW, cy + 4 * S)
    cy += 14 * S

    c.fillStyle = 'rgba(0,0,0,0.06)'
    R.rr(barX, cy, barW, barH, barH / 2); c.fill()
    if (animPct > 0) {
      const fillW = Math.max(barH, barW * animPct)
      const barGrad = c.createLinearGradient(barX, cy, barX + fillW, cy)
      barGrad.addColorStop(0, barColor); barGrad.addColorStop(1, barColor + '80')
      c.fillStyle = barGrad
      R.rr(barX, cy, fillW, barH, barH / 2); c.fill()
    }
    cy += barH + 8 * S
    c.textAlign = 'center'; c.fillStyle = barColor; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.fillText(`战力达标 ${tipsData.powerPct}%`, barX + barW / 2, cy)
    cy += 12 * S
  }

  // ── 区块2：变强建议 ──
  if (tips.length > 0) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#6B6040'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('如何变强', px + pad, cy + 6 * S)
    cy += 24 * S

    _rects.tipRects = []
    for (let i = 0; i < tips.length; i++) {
      const tip = tips[i]
      const tipDelay = 20 + i * 10
      const tipAlpha = Math.min(1, Math.max(0, (at - tipDelay) / 15))
      if (tipAlpha <= 0) { cy += 34 * S; continue }

      c.save()
      c.globalAlpha *= tipAlpha

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

      // 跳转箭头
      if (tip.action) {
        c.fillStyle = '#B8A080'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
        c.textAlign = 'right'
        c.fillText('›', px + pw - pad - 6 * S, iconCY)
        _rects.tipRects.push({ rect: [px + pad, cy, innerW, tipH], action: tip.action, stageId: result.stageId })
      }

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

// ===== 失败建议生成（数据驱动，由 strategyAdvisor 提供） =====
function _generateDefeatTips(g, result) {
  const analysis = analyzeDefeat(g.storage, result)
  const COLOR_MAP = {
    '📊': { bg: 'rgba(200,80,60,0.10)',  border: 'rgba(200,100,80,0.25)' },
    '⚔':  { bg: 'rgba(180,140,60,0.12)', border: 'rgba(180,160,80,0.3)' },
    '★':  { bg: 'rgba(200,180,40,0.10)', border: 'rgba(200,180,60,0.3)' },
    '⬆':  { bg: 'rgba(60,120,200,0.08)', border: 'rgba(60,120,200,0.2)' },
    '🧘': { bg: 'rgba(140,80,200,0.08)', border: 'rgba(140,80,200,0.2)' },
    '🎨': { bg: 'rgba(60,100,160,0.08)', border: 'rgba(60,100,160,0.2)' },
  }
  return {
    powerPct: analysis.powerPct,
    teamAtk: analysis.teamTotalAtk,
    suggestedAtk: analysis.suggestedAtk,
    items: analysis.tips.map(t => ({
      ...t,
      bgColor: (COLOR_MAP[t.icon] || {}).bg || 'rgba(200,180,140,0.1)',
      borderColor: (COLOR_MAP[t.icon] || {}).border || 'rgba(180,160,120,0.2)',
    })),
  }
}

/** 首通灵宠 + isNew 法宝等并排展示 */
function _isFeaturedNewDrop(r) {
  if (!r) return false
  if (r.type === 'pet' && r.petId) return true
  if (r.type === 'weapon' && r.weaponId && r.isNew) return true
  return false
}

/**
 * 掉落区：去掉灵石/经验配置项；去掉已在顶部「恭喜获得」并排展示的御灵/新法宝，避免重复。
 */
function _victoryDropRewardsForDisplay(result) {
  const rewards = result && result.rewards
  if (!rewards || !rewards.length) return []
  const skip = _heroSpotlightRewardKeys(result)
  return rewards.filter(r => {
    if (r.type === 'exp' || r.type === 'soulStone') return false
    if (r.type === 'pet' && r.petId && skip.has(`pet:${r.petId}`)) return false
    if (r.type === 'weapon' && r.weaponId && skip.has(`weapon:${r.weaponId}`)) return false
    return true
  })
}

function _partitionDropRewards(rewards) {
  if (!rewards || !rewards.length) return []
  const out = []
  let i = 0
  while (i < rewards.length) {
    if (_isFeaturedNewDrop(rewards[i])) {
      const items = []
      while (i < rewards.length && _isFeaturedNewDrop(rewards[i])) {
        items.push(rewards[i])
        i++
      }
      out.push({ kind: 'newGroup', items })
    } else {
      out.push({ kind: 'single', reward: rewards[i] })
      i++
    }
  }
  return out
}

function _newDropRowHeight(S) {
  return 92 * S
}

function _heightForDropPart(part, S) {
  if (part.kind === 'newGroup') return _newDropRowHeight(S)
  const r = part.reward
  return (r.type === 'pet' ? 46 : r.type === 'fragment' ? 40 : r.type === 'weapon' ? 56 : 30) * S
}

function _drawNewDropTile(c, R, S, left, cy, tileW, reward, g, at, subDelay) {
  const pulse = 0.85 + 0.15 * Math.sin((at + subDelay) * 0.07)
  const padTop = 5 * S
  const iconSz = Math.min(46 * S, Math.max(28 * S, tileW - 8 * S))
  const iconX = left + (tileW - iconSz) / 2
  const iconY = cy + padTop

  const drawNewRibbon = () => {
    c.save()
    c.translate(iconX + 2 * S, iconY - 1 * S)
    c.rotate(0.18)
    c.globalAlpha *= pulse
    c.fillStyle = 'rgba(180,120,20,0.95)'
    R.rr(-15 * S, -6 * S, 30 * S, 12 * S, 3 * S); c.fill()
    c.strokeStyle = 'rgba(255,240,200,0.75)'; c.lineWidth = 1 * S
    R.rr(-15 * S, -6 * S, 30 * S, 12 * S, 3 * S); c.stroke()
    c.fillStyle = '#FFF8E0'
    c.font = `bold ${7.5 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('New', 0, 0)
    c.restore()
  }

  if (reward.type === 'pet' && reward.petId) {
    const pet = getPetById(reward.petId)
    if (!pet) return
    const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
    const strokeC = ac.main
    const rarityKey = getPetRarity(reward.petId)
    const rv = rarityVisualForAttr(rarityKey, pet.attr)

    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      c.save()
      R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.clip()
      const aw = img.width, ah = img.height
      const sc = Math.max(iconSz / aw, iconSz / ah)
      const dw = aw * sc, dh = ah * sc
      c.drawImage(img, iconX + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
      c.restore()
    }
    c.strokeStyle = strokeC; c.lineWidth = 2 * S
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.stroke()

    const badgeW = Math.max(rv.label.length * 6.5 * S + 4 * S, 22 * S)
    const badgeH = 11 * S
    const badgeX = iconX + iconSz - badgeW - 1 * S
    const badgeY = iconY + 1 * S
    c.fillStyle = rv.badgeBg
    R.rr(badgeX, badgeY, badgeW, badgeH, 2 * S); c.fill()
    c.fillStyle = rv.badgeColor; c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(rv.label, badgeX + badgeW / 2, badgeY + badgeH / 2)

    drawNewRibbon()

    const nameY = iconY + iconSz + 5 * S
    const displayName = pet.name.length > 5 ? pet.name.slice(0, 5) + '…' : pet.name
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
    c.fillStyle = ac.main
    c.fillText(displayName, left + tileW / 2, nameY)
  } else if (reward.type === 'weapon' && reward.weaponId) {
    const w = getWeaponById(reward.weaponId)
    if (!w) return
    const rarityKey = getWeaponRarity(reward.weaponId) || 'R'
    const rv = rarityVisualForAttr(rarityKey, w.attr || 'metal')
    const wAc = w.attr ? (ATTR_COLOR[w.attr] || ATTR_COLOR.metal) : null
    const strokeC = wAc ? wAc.main : rv.borderColor

    const iconPath = `assets/equipment/fabao_${reward.weaponId}.png`
    const img = R.getImg(iconPath)
    if (img && img.width > 0) {
      c.save()
      R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.clip()
      const aw = img.width, ah = img.height
      const sc = Math.max(iconSz / aw, iconSz / ah)
      const dw = aw * sc, dh = ah * sc
      c.drawImage(img, iconX + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
      c.restore()
    }
    c.strokeStyle = strokeC; c.lineWidth = 2 * S
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.stroke()

    const badgeW = Math.max(rv.label.length * 6.5 * S + 4 * S, 22 * S)
    const badgeH = 11 * S
    const badgeX = iconX + iconSz - badgeW - 1 * S
    const badgeY = iconY + 1 * S
    c.fillStyle = rv.badgeBg
    R.rr(badgeX, badgeY, badgeW, badgeH, 2 * S); c.fill()
    c.fillStyle = rv.badgeColor; c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(rv.label, badgeX + badgeW / 2, badgeY + badgeH / 2)

    if (reward.isNew) drawNewRibbon()

    const nameY = iconY + iconSz + 5 * S
    const displayName = w.name.length > 5 ? w.name.slice(0, 5) + '…' : w.name
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
    c.fillStyle = wAc ? wAc.main : '#6B5038'
    c.fillText(displayName, left + tileW / 2, nameY)
  }
}

function _drawNewDropsRow(c, R, S, x, cy, innerW, items, g, at, rowDelay) {
  const n = items.length
  if (n <= 0) return
  const gap = 5 * S
  const tileW = (innerW - gap * (n - 1)) / n
  for (let i = 0; i < n; i++) {
    _drawNewDropTile(c, R, S, x + i * (tileW + gap), cy, tileW, items[i], g, at, rowDelay + i * 3)
  }
}

function _computeVictoryRewardContentHeight(result, S, pad) {
  const dropRewards = _victoryDropRewardsForDisplay(result)
  const hasRewards = dropRewards.length > 0
  const hasMilestones = result.milestoneRewards && result.milestoneRewards.length > 0
  let contentH = pad * 0.5
  if (hasRewards) {
    contentH += 24 * S
    for (const part of _partitionDropRewards(dropRewards)) {
      contentH += _heightForDropPart(part, S)
    }
    contentH += 10 * S
  }
  if (hasMilestones) contentH += 10 * S + result.milestoneRewards.length * 28 * S
  if (result.soulStone > 0) contentH += 32 * S
  if (result.cultExp > 0) {
    contentH += 28 * S
    if (result.cultLevelUps > 0) contentH += 16 * S
    contentH += 26 * S
  }
  contentH += 24 * S
  contentH += pad + 48 * S
  return contentH
}

// ===== 胜利奖励面板（增强版：大图标 + 分区高亮 + 入场动画；过长时可滑动） =====
function _drawVictoryRewardPanel(g, c, R, W, H, S, result, panelTop, at) {
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 14 * S
  const innerW = pw - pad * 2
  const panelRad = 14 * S

  const dropRewards = _victoryDropRewardsForDisplay(result)
  const hasRewards = dropRewards.length > 0
  const hasMilestones = result.milestoneRewards && result.milestoneRewards.length > 0

  const contentH = _computeVictoryRewardContentHeight(result, S, pad)
  const marginBottom = 10 * S
  const screenBottom = H - marginBottom
  let viewportH = contentH
  let scrollMax = 0
  if (panelTop + contentH > screenBottom) {
    const avail = Math.max(0, screenBottom - panelTop)
    viewportH = Math.min(contentH, Math.max(100 * S, avail))
    scrollMax = Math.max(0, contentH - viewportH)
  }
  if (_victoryRewardScroll > scrollMax) _victoryRewardScroll = scrollMax
  if (_victoryRewardScroll < 0) _victoryRewardScroll = 0
  const scroll = _victoryRewardScroll

  _victoryRewardScrollMax = scrollMax
  _victoryRewardViewport = scrollMax > 0 ? [px, panelTop, pw, viewportH] : null

  R.drawInfoPanel(px, panelTop, pw, viewportH)

  c.save()
  R.rr(px, panelTop, pw, viewportH, panelRad)
  c.clip()
  c.translate(0, -scroll)

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

    for (const part of _partitionDropRewards(dropRewards)) {
      const rowDelay = 15 + rowIdx * 6
      const rowAlpha = Math.min(1, Math.max(0, (at - rowDelay) / 12))
      const rowSlide = (1 - rowAlpha) * 20 * S
      const stepH = _heightForDropPart(part, S)

      if (rowAlpha <= 0) {
        cy += stepH
        rowIdx++
        continue
      }

      c.save()
      c.globalAlpha *= rowAlpha
      c.translate(rowSlide, 0)

      if (part.kind === 'newGroup') {
        _drawNewDropsRow(c, R, S, px + pad, cy, innerW, part.items, g, at, rowDelay)
        cy += _newDropRowHeight(S)
      } else {
        const r = part.reward
        if (r.type === 'pet' && r.petId) {
          _drawPetRowEnhanced(c, R, S, px + pad, cy, innerW, r, at, rowDelay)
          cy += 46 * S
        } else if (r.type === 'fragment' && r.petId) {
          _drawFragmentRowEnhanced(c, R, S, px + pad, cy, innerW, r, g)
          cy += 40 * S
        } else if (r.type === 'weapon' && r.weaponId) {
          _drawWeaponRowEnhanced(c, R, S, px + pad, cy, innerW, r, at)
          cy += 56 * S
        }
      }

      c.restore()
      rowIdx++
    }

    cy += 2 * S
    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 8 * S
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

  // === 本关灵石 / 修炼经验（总额） ===
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
    // 关卡结算灵石在 result.soulStone；章节里程碑另行列出但已实际入账，汇总须并入避免与「里程碑 +xxx」不一致
    let totalSS = result.soulStone || 0
    const totalExp = result.cultExp || 0
    let totalFrags = 0
    if (result.rewards) result.rewards.forEach(r => { if (r.type === 'fragment') totalFrags += r.count })
    if (result.milestoneRewards && result.milestoneRewards.length) {
      for (const ms of result.milestoneRewards) {
        totalSS += ms.soulStone || 0
        totalFrags += ms.fragment || 0
      }
    }
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
  _rects.backBtnRect = [px + pad, btnY - scroll, btnW, btnH]

  const nextId = getNextStageId(result.stageId)
  const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
  const rightLabel = hasNext ? '下一关' : '再次挑战'
  R.drawDialogBtn(px + pad + btnW + btnGap, btnY, btnW, btnH, rightLabel, 'confirm')
  _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY - scroll, btnW, btnH]

  c.restore()

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
  hlGrad.addColorStop(0, rgbaFromHex(ac.main, 0.12))
  hlGrad.addColorStop(1, rgbaFromHex(ac.main, 0.02))
  c.fillStyle = hlGrad
  R.rr(x, cy, innerW, hlH, 6 * S); c.fill()
  c.strokeStyle = rgbaFromHex(ac.main, 0.28)
  c.lineWidth = 0.8 * S
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
      c.save()
      c.shadowColor = attrColor; c.shadowBlur = 6 * S
      c.strokeStyle = attrColor; c.lineWidth = 2 * S
      R.rr(iconX, iconY, iconSz, iconSz, 7 * S); c.stroke()
      c.restore()
    }
  }

  // 品质徽标（描边/底色跟属性）
  const rv2 = rarityVisualForAttr(getPetRarity(reward.petId), attr)
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
  c.fillStyle = ac.main
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.shadowColor = rgbaFromHex(ac.main, 0.5)
  c.shadowBlur = 4 * S
  c.fillText('获得灵宠！', iconX + iconSz + 8 * S, cy + hlH / 2 + 10 * S)
  c.restore()
}

// ===== 碎片奖励行（增强版：含进度提示） =====
function _drawFragmentRowEnhanced(c, R, S, x, cy, innerW, reward, g) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const ac = pet ? (ATTR_COLOR[attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
  const attrColor = ac.main || '#888'

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

  c.fillStyle = ac.dk || ac.main
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
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
      c.fillStyle = current >= cost ? (ac.lt || ac.main) : '#A09070'
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
  const wAttr = (w && w.attr) || 'metal'
  const wAc = ATTR_COLOR[wAttr] || ATTR_COLOR.metal

  const hlH = 56 * S
  const hlGrad = c.createLinearGradient(x, cy, x + innerW, cy)
  hlGrad.addColorStop(0, rgbaFromHex(wAc.main, 0.1))
  hlGrad.addColorStop(1, rgbaFromHex(wAc.main, 0.02))
  c.fillStyle = hlGrad
  R.rr(x, cy, innerW, hlH, 6 * S); c.fill()
  c.strokeStyle = rgbaFromHex(wAc.main, 0.22)
  c.lineWidth = 0.8 * S
  R.rr(x, cy, innerW, hlH, 6 * S); c.stroke()

  const iconSz = 40 * S
  const iconX = x + 4 * S
  const iconY = cy + (hlH - iconSz) / 2
  const fabaoPath = `assets/equipment/fabao_${reward.weaponId}.png`
  const img = R.getImg(fabaoPath)

  const strokeW = wAc.main

  if (img && img.width > 0) {
    c.save()
    c.shadowColor = strokeW; c.shadowBlur = 6 * S
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.clip()
    const aw = img.width, ah = img.height
    const scale = Math.max(iconSz / aw, iconSz / ah)
    const dw = aw * scale, dh = ah * scale
    c.drawImage(img, iconX + (iconSz - dw) / 2, iconY + (iconSz - dh) / 2, dw, dh)
    c.restore()
    c.save()
    c.strokeStyle = strokeW; c.lineWidth = 2 * S
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.stroke()
    c.restore()
  } else {
    c.save()
    c.fillStyle = 'rgba(120,100,60,0.2)'
    R.rr(iconX, iconY, iconSz, iconSz, 6 * S); c.fill()
    c.strokeStyle = strokeW; c.lineWidth = 2 * S
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
  c.fillStyle = wAc.main
  c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.shadowColor = rgbaFromHex(wAc.main, 0.35)
  c.shadowBlur = 3 * S
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

  const centerY = H * 0.38
  _drawCelebrationBackdrop(c, W, H, S, centerY, cel.timer, cel.alpha)

  c.save()
  c.globalAlpha = cel.alpha

  c.fillStyle = 'rgba(255,240,200,0.06)'
  c.fillRect(0, 0, W, H)

  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFF5E0'
  c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
  _strokeText(c, '恭喜获得', W / 2, safeTop + 40 * S, 'rgba(55,35,18,0.5)', 3 * S)

  // 计数指示器（第 x/n 只）
  if (cel.petIds.length > 1) {
    c.fillStyle = 'rgba(200,170,80,0.85)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.fillText(`${idx + 1} / ${cel.petIds.length}`, W / 2, safeTop + 62 * S)
  }

  // 宠物头像（大尺寸弹入动画）
  const bounceProgress = Math.min(1, cel.timer / 25)
  const bounce = bounceProgress < 1
    ? (1 + 0.2 * Math.sin(bounceProgress * Math.PI))
    : (1 + 0.03 * Math.sin(cel.timer * 0.06))
  const avatarSize = 130 * S * bounce
  const avatarX = (W - avatarSize) / 2
  const avatarY = centerY - avatarSize / 2 - 6 * S

  _drawPedestalCloud(c, R, S, W / 2, avatarY + avatarSize, avatarSize * 1.2)

  const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal

  const rkNewbie = getPetRarity(petId)
  const spotRv = _spotlightRarityTag(rkNewbie, pet.attr)
  _drawRarityDiamondBadge(c, S, avatarX + 10 * S, avatarY + 20 * S, spotRv.rv, spotRv.tag)

  c.save()
  c.translate(avatarX + avatarSize - 8 * S, avatarY - 4 * S)
  c.rotate(-0.2)
  c.fillStyle = 'rgba(180,120,20,0.95)'
  R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.fill()
  c.strokeStyle = 'rgba(255,240,200,0.75)'; c.lineWidth = 1 * S
  R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.stroke()
  c.fillStyle = '#FFF8E0'
  c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('New', 0, 0)
  c.restore()

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
    c.save()
    c.shadowColor = rgbaFromHex(ac.main, 0.5)
    c.shadowBlur = 16 * S
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 16 * S)
    c.strokeStyle = ac.main
    c.lineWidth = 3 * S
    c.stroke()
    c.restore()
  }

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
  c.fillStyle = ac.lt || ac.main
  c.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  c.save()
  c.shadowColor = rgbaFromHex(ac.main, 0.55)
  c.shadowBlur = 6 * S
  _strokeText(c, '正式加入你的队伍！', W / 2, msgY, 'rgba(0,0,0,0.35)', 3 * S)
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
  const result = g._stageResult
  if (!result) return

  // 新手流程仅处理抬起
  if (g._newbiePetCelebrate || g._newbieTeamOverview) {
    if (type !== 'end') return
  }

  // 新手宠物庆祝阶段：逐一展示，最后一只后切到团队概览卡
  if (g._newbiePetCelebrate) {
    const cel = g._newbiePetCelebrate
    const idx = cel.currentIdx || 0
    if (idx < cel.petIds.length - 1) {
      cel.currentIdx = idx + 1
      cel.timer = 0; cel.alpha = 0
    } else {
      const petIds = cel.petIds.slice()
      g._newbiePetCelebrate = null
      g._newbieTeamOverview = { pets: petIds, alpha: 0, timer: 0 }
    }
    _animTimer = 0
    g._dirty = true
    return
  }

  // 新手队伍总览卡：首通直达灵宠页/主页，渐进式引导
  if (g._newbieTeamOverview) {
    g._newbieTeamOverview = null
    if (result && result.victory && result.isFirstClear) {
      if (result.stageId === 'stage_1_1') {
        g.storage.markGuideShown('newbie_stage_continue')
        g.setScene('petPool')
        return
      }
      if (result.stageId === 'stage_1_2') {
        g._pendingGuide = 'newbie_continue_1_3'
        g._stageIdxInitialized = false
        g.setScene('title')
        return
      }
      if (result.stageId === 'stage_1_3') {
        g._pendingGuide = 'newbie_team_ready'
        g._stageIdxInitialized = false
        g.setScene('title')
        return
      }
    }
    _animTimer = 0
    g._dirty = true
    return
  }

  const canScroll = result.victory && _victoryRewardViewport && _victoryRewardScrollMax > 0
  if (canScroll) {
    if (type === 'start') {
      if (g._hitRect(x, y, ..._victoryRewardViewport)) {
        _victScrollActive = true
        _victScrollStartY = y
        _victScrollLastY = y
        _victScrollMoved = false
      } else {
        _victScrollActive = false
      }
      return
    }
    if (type === 'move' && _victScrollActive) {
      const dy = y - _victScrollLastY
      _victScrollLastY = y
      if (Math.abs(y - _victScrollStartY) > 6 * V.S) _victScrollMoved = true
      _victoryRewardScroll -= dy
      if (_victoryRewardScroll < 0) _victoryRewardScroll = 0
      if (_victoryRewardScroll > _victoryRewardScrollMax) _victoryRewardScroll = _victoryRewardScrollMax
      return
    }
    if (type === 'end') {
      if (_victScrollActive && _victScrollMoved) {
        _victScrollActive = false
        _victScrollMoved = false
        return
      }
      _victScrollActive = false
      _victScrollMoved = false
    }
  } else if (type !== 'end') {
    return
  }

  if (type !== 'end') return

  // 失败建议条跳转
  if (_rects.tipRects && !result.victory) {
    for (const tr of _rects.tipRects) {
      if (g._hitRect(x, y, ...tr.rect)) {
        MusicMgr.playClick && MusicMgr.playClick()
        if (tr.action === 'petPool') { g.setScene('petPool'); return }
        if (tr.action === 'cultivation') { g.setScene('cultivation'); return }
        if (tr.action === 'stageTeam') {
          g._selectedStageId = tr.stageId
          g.setScene('stageTeam')
          return
        }
      }
    }
  }

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

// 1-1 / 1-2 / 1-3 首通胜利时，返回首页并触发对应后续引导
function _getFirstClearGuide(result) {
  if (!result || !result.victory || !result.isFirstClear) return null
  if (result.stageId === 'stage_1_1') return 'newbie_stage_continue'
  if (result.stageId === 'stage_1_2') return 'newbie_continue_1_2'
  if (result.stageId === 'stage_1_3') return 'newbie_team_ready'
  return null
}

module.exports = { rStageResult, tStageResult }
