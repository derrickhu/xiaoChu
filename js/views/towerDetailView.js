/**
 * 通天塔周回详情页
 * 展示本周轮换时间、宠物奖励、里程碑轨道，并从这里进入通天塔编队。
 */
const V = require('./env')
const P = require('../platform')
const { TOWER_DAILY } = require('../data/economyConfig')
const { STAGE_FORMATION_MIN_PETS } = require('../data/constants')
const { ATTR_COLOR } = require('../data/tower')
const { getPetAvatarPath } = require('../data/pets')
const {
  getSeasonSSRPet,
  getSeasonSRPet,
  getTowerEventCountdownLabel,
  getNextMilestonePreview,
  getMilestoneRewards,
  TOWER_EVENT_MILESTONES,
} = require('../data/towerEvent')

function _drawPetBadge(c, R, S, pet, x, y, size, rarityLabel) {
  if (!pet) return
  const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
  const img = R.getImg(getPetAvatarPath({ ...pet, star: 1 }))
  if (img && img.width > 0) {
    R.drawCoverImg(img, x, y, size, size, { radius: 10 * S, strokeStyle: ac.main, strokeWidth: 1.5 * S })
  } else {
    c.fillStyle = 'rgba(255,255,255,0.18)'
    R.rr(x, y, size, size, 10 * S); c.fill()
  }
  c.fillStyle = rarityLabel === 'SSR' ? 'rgba(188,118,0,0.92)' : 'rgba(90,84,190,0.9)'
  R.rr(x + 4 * S, y + 4 * S, 26 * S, 13 * S, 4 * S); c.fill()
  c.fillStyle = '#fff'
  c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(rarityLabel, x + 17 * S, y + 10.5 * S)
}

function _drawSsrRewardPet(c, R, S, pet, x, y, size) {
  if (!pet) return
  const img = R.getImg(getPetAvatarPath({ ...pet, star: 1 }))
  c.save()
  c.shadowColor = 'rgba(216,156,29,0.45)'
  c.shadowBlur = 12 * S
  const frameGrad = c.createLinearGradient(x, y, x, y + size)
  frameGrad.addColorStop(0, '#FFE58A')
  frameGrad.addColorStop(0.5, '#D89C1D')
  frameGrad.addColorStop(1, '#8F5A14')
  c.fillStyle = frameGrad
  R.rr(x - 5 * S, y - 5 * S, size + 10 * S, size + 10 * S, 16 * S); c.fill()
  c.fillStyle = '#FFF7D6'
  R.rr(x - 1 * S, y - 1 * S, size + 2 * S, size + 2 * S, 13 * S); c.fill()
  if (img && img.width > 0) {
    R.drawCoverImg(img, x, y, size, size, { radius: 12 * S })
  }
  c.fillStyle = 'rgba(142,64,28,0.92)'
  R.rr(x + 5 * S, y + 5 * S, 30 * S, 15 * S, 5 * S); c.fill()
  c.fillStyle = '#FFE68C'
  c.font = `bold ${8 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('SSR', x + 20 * S, y + 12.5 * S)
  c.restore()
}

function _fitText(c, text, maxW) {
  const raw = String(text || '')
  if (!maxW || c.measureText(raw).width <= maxW) return raw
  let s = raw
  while (s.length > 0 && c.measureText(`${s}…`).width > maxW) {
    s = s.slice(0, -1)
  }
  return s ? `${s}…` : '…'
}

function _towerRewardMeta(reward, ssrPet, srPet) {
  if (!reward) return { icon: null, label: '奖励', amount: '' }
  if (reward.type === 'soulStone') {
    return { icon: 'assets/ui/icon_soul_stone.png', label: '灵石', amount: `×${reward.count || 0}` }
  }
  if (reward.type === 'srFrag') {
    return {
      icon: srPet ? getPetAvatarPath({ ...srPet, star: 1 }) : 'assets/ui/icon_universal_frag.png',
      label: `${srPet ? srPet.name : '本周SR'}碎片`,
      amount: `×${reward.count || 0}`,
    }
  }
  if (reward.type === 'ssrFrag') {
    return { icon: 'assets/ui/frame_fragment.png', label: 'SSR随机碎片', amount: `×${reward.count || 0}` }
  }
  if (reward.type === 'ssrPet') {
    return {
      icon: ssrPet ? getPetAvatarPath({ ...ssrPet, star: 1 }) : 'assets/ui/icon_universal_frag.png',
      label: `${ssrPet ? ssrPet.name : '本周SSR'}整宠`,
      amount: '×1',
    }
  }
  return { icon: null, label: '奖励', amount: '' }
}

function _drawRewardLine(c, R, S, reward, x, y, maxW, ssrPet, srPet) {
  const meta = _towerRewardMeta(reward, ssrPet, srPet)
  const iconSize = 12 * S
  const img = meta.icon ? R.getImg(meta.icon) : null
  if (img && img.width > 0) {
    R.drawCoverImg(img, x, y - iconSize / 2, iconSize, iconSize, { radius: 3 * S })
  } else {
    c.fillStyle = 'rgba(255,255,255,0.22)'
    R.rr(x, y - iconSize / 2, iconSize, iconSize, 3 * S); c.fill()
  }
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillStyle = reward && reward.type === 'ssrPet' ? '#B86414' : (reward && reward.type !== 'soulStone' ? '#2F72A8' : '#6A4A1C')
  c.font = `bold ${7.6 * S}px "PingFang SC",sans-serif`
  const text = `${meta.label}${meta.amount}`
  c.fillText(_fitText(c, text, maxW - iconSize - 6 * S), x + iconSize + 5 * S, y)
}

function _drawRewardCard(c, R, S, tier, x, y, w, h, bestFloor, claimedSet) {
  const done = bestFloor >= tier.floor
  const got = claimedSet.has(tier.floor)
  c.save()
  c.fillStyle = done ? 'rgba(236,248,224,0.78)' : 'rgba(255,248,232,0.62)'
  R.rr(x, y, w, h, 9 * S); c.fill()
  c.strokeStyle = got ? 'rgba(82,181,106,0.68)' : (done ? '#58B96A' : 'rgba(165,128,75,0.36)')
  c.lineWidth = done && !got ? 1.6 * S : 1 * S
  R.rr(x, y, w, h, 9 * S); c.stroke()

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = done ? '#2E8B57' : '#8A5A16'
  c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  c.fillText(`${tier.floor}层`, x + 10 * S, y + 16 * S)

  const badge = got ? '已领' : (done ? '可领' : `差${Math.max(0, tier.floor - bestFloor)}层`)
  const badgeW = got || done ? 34 * S : 44 * S
  c.fillStyle = got ? 'rgba(82,181,106,0.22)' : (done ? 'rgba(255,232,150,0.58)' : 'rgba(120,90,60,0.10)')
  R.rr(x + w - badgeW - 8 * S, y + 7 * S, badgeW, 18 * S, 9 * S); c.fill()
  c.fillStyle = got ? '#2E8B57' : (done ? '#B86414' : '#8B7B70')
  c.font = `bold ${8 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText(badge, x + w - badgeW / 2 - 8 * S, y + 16 * S)

  const ssrPet = getSeasonSSRPet()
  const srPet = getSeasonSRPet()
  const rewards = getMilestoneRewards(tier).slice(0, 2)
  let ry = y + 35 * S
  for (const reward of rewards) {
    _drawRewardLine(c, R, S, reward, x + 10 * S, ry, w - 20 * S, ssrPet, srPet)
    ry += 14 * S
  }
  c.restore()
}

function _checkTowerDailyLimit(g) {
  if (g.storage.canStartTowerRunFree()) return true
  const adLeft = Math.max(0, TOWER_DAILY.adExtraRuns - g.storage.getTowerDailyAdRuns())
  if (adLeft > 0) {
    const AdManager = require('../adManager')
    AdManager.showRewardedVideo('towerExtraRun', {
      fallbackToShare: true,
      onRewarded: function () {
        g.storage.recordTowerAdRun()
        g._towerTeamMode = null
        g.setScene('towerTeam')
      },
      rewardPopup: {
        title: '挑战次数已补充',
        subtitle: '今日额外通天塔次数 +1',
        lines: [{ icon: 'nav_battle', label: '通天塔', amount: '+1 次' }],
      },
      onSkipped: function () {
        P.showGameToast('需完整观看广告', { type: 'warn' })
      },
      onError: function () {
        P.showGameToast('广告加载失败，请稍后重试', { type: 'warn' })
      },
    })
    return false
  }
  P.showGameToast('今日挑战次数已用完，明日刷新', { type: 'warn' })
  return false
}

function rTowerDetail(g) {
  const { ctx: c, R, W, H, S, safeTop } = V
  const ssrPet = getSeasonSSRPet()
  const state = g.storage.getTowerEventState ? g.storage.getTowerEventState() : { claimed: [] }
  const claimedSet = new Set(state.claimed || [])
  const bestFloor = g.storage.bestFloor || 0

  R.drawHomeBg(g.af || 0)
  c.fillStyle = 'rgba(20,12,36,0.52)'
  c.fillRect(0, 0, W, H)

  const pad = 18 * S
  const topY = safeTop + 10 * S
  c.fillStyle = 'rgba(0,0,0,0.36)'
  c.fillRect(0, topY, W, 38 * S)
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
  c.fillStyle = '#fff'
  c.fillText('‹ 返回', pad, topY + 19 * S)
  g._towerDetailBackRect = [0, topY, 90 * S, 38 * S]
  c.textAlign = 'center'
  c.fillStyle = '#FFE9A8'
  c.font = `bold ${17 * S}px "PingFang SC",sans-serif`
  c.fillText('本周通天塔', W / 2, topY + 19 * S)

  const panelX = pad
  const panelW = W - pad * 2
  let y = topY + 54 * S
  R.drawDialogPanel(panelX, y, panelW, 186 * S)

  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#D89C1D'
  c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  c.fillText('周一刷新 · ' + getTowerEventCountdownLabel(), W / 2, y + 28 * S)
  c.fillStyle = '#5D4630'
  c.font = `${10 * S}px "PingFang SC",sans-serif`
  c.fillText(`最高 ${bestFloor} 层 · 每日免费 ${TOWER_DAILY.freeRuns} 次`, W / 2, y + 48 * S)

  const avatarSize = 72 * S
  const petX = W / 2 - avatarSize / 2
  const petY = y + 76 * S
  _drawSsrRewardPet(c, R, S, ssrPet, petX, petY, avatarSize)
  g._towerDetailSsrAvatarRect = ssrPet ? [petX - 6 * S, petY - 6 * S, avatarSize + 12 * S, avatarSize + 12 * S] : null
  g._towerDetailSsrPetId = ssrPet && ssrPet.id
  c.textAlign = 'center'
  c.fillStyle = '#2E8B57'
  c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.fillText('30层登顶可得本周 SSR 整宠', W / 2, y + 66 * S)
  c.fillStyle = '#7A4A12'
  c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.fillText(ssrPet ? ssrPet.name : '本周SSR', W / 2, y + 164 * S)

  y += 200 * S
  R.drawDialogPanel(panelX, y, panelW, 260 * S)
  c.textAlign = 'left'
  c.fillStyle = '#7A4A12'
  c.font = `bold ${13 * S}px "PingFang SC",sans-serif`
  c.fillText('本周里程碑奖励', panelX + 28 * S, y + 30 * S)

  const innerX = panelX + 28 * S
  const innerW = panelW - 56 * S
  const gap = 10 * S
  const cardW = (innerW - gap) / 2
  const cardH = 56 * S
  const cardsY = y + 52 * S
  for (let i = 0; i < TOWER_EVENT_MILESTONES.length; i++) {
    const tier = TOWER_EVENT_MILESTONES[i]
    const col = i % 2
    const row = Math.floor(i / 2)
    _drawRewardCard(c, R, S, tier, innerX + col * (cardW + gap), cardsY + row * (cardH + gap), cardW, cardH, bestFloor, claimedSet)
  }

  const btnW = W * 0.62
  const btnH = 44 * S
  const btnX = (W - btnW) / 2
  const btnY = H - 72 * S
  const btnLabel = g.storage.hasSavedRun && g.storage.hasSavedRun() ? '继续登塔' : '进入编队'
  R.drawDialogBtn(btnX, btnY, btnW, btnH, btnLabel, 'confirm')
  g._towerDetailStartRect = [btnX, btnY, btnW, btnH]
}

function tTowerDetail(g, x, y, type) {
  if (type !== 'end') return
  if (g._towerDetailBackRect && g._hitRect(x, y, ...g._towerDetailBackRect)) {
    g.setScene('title')
    return
  }
  if (g._towerDetailSsrAvatarRect && g._towerDetailSsrPetId
      && g._hitRect(x, y, ...g._towerDetailSsrAvatarRect)) {
    const petId = g._towerDetailSsrPetId
    const owned = !!g.storage.getPoolPet(petId)
    g._petDetailId = petId
    g._petDetailUnowned = !owned
    g._petDetailUnownedFullRoadmap = !owned
    g._petDetailReturnScene = 'towerDetail'
    g.setScene('petDetail')
    return
  }
  if (!g._towerDetailStartRect || !g._hitRect(x, y, ...g._towerDetailStartRect)) return
  const minPool = STAGE_FORMATION_MIN_PETS
  const cur = g.storage.petPoolCount
  if (cur < minPool) {
    P.showGameToast(`挑战通天塔需灵宠池至少 ${minPool} 只（当前 ${cur} 只）`, { type: 'warn' })
    return
  }
  g._towerTeamMode = null
  if (g.storage.hasSavedRun && g.storage.hasSavedRun()) {
    g._resumeRun()
    return
  }
  if (!_checkTowerDailyLimit(g)) return
  g.setScene('towerTeam')
}

module.exports = { rTowerDetail, tTowerDetail }
