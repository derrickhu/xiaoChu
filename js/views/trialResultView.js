/**
 * 天机试炼结算页
 */
const V = require('./env')
const flyParticles = require('./resourceFlyParticles')
const { getCurrentTrialSeason, getTrialSeasonLabel, getDailyAttrTheme } = require('../data/trialSeason')
const { getPetById, getPetAvatarPath } = require('../data/pets')

const ATTR_NAME = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }

function _rewardIcon(reward) {
  if (!reward) return null
  if (reward.type === 'soulStone') return 'assets/ui/icon_soul_stone.png'
  if (reward.type === 'universalFragment') return 'assets/ui/icon_universal_frag.png'
  if (reward.type === 'awakenStone') return 'assets/ui/icon_awaken_stone.png'
  if (reward.type === 'randomFragment') return 'assets/ui/frame_fragment.png'
  if (reward.type === 'weapon') return reward.duplicateSoulStone ? 'assets/ui/icon_soul_stone.png' : 'assets/ui/nav_weapon.png'
  return null
}

function _rewardEmoji(reward) {
  if (!reward) return null
  return null
}

function _rewardLabel(reward, attrTheme) {
  if (!reward) return '奖励'
  if (reward.type === 'soulStone') return '灵石'
  if (reward.type === 'universalFragment') return '万能碎'
  if (reward.type === 'awakenStone') return '觉醒石'
  if (reward.type === 'randomFragment') {
    const pet = reward.petId ? getPetById(reward.petId) : null
    if (pet) return `${pet.name}碎片`
    const attrName = reward.attrs && reward.attrs.length
      ? reward.attrs.map(attr => ATTR_NAME[attr] || attr).join('/')
      : (reward.attr ? ATTR_NAME[reward.attr] : (attrTheme && attrTheme.enemyName))
    return `${attrName || '属性'}宠碎`
  }
  if (reward.type === 'weapon') return reward.duplicateSoulStone ? '重复补偿' : 'SSR法宝'
  return '奖励'
}

function _rewardAmount(reward) {
  if (!reward) return ''
  if (reward.type === 'weapon') return reward.duplicateSoulStone ? `×${reward.duplicateSoulStone}` : '×1'
  return `×${reward.count || 0}`
}

function _drawResultPanel(c, R, x, y, w, h) {
  const img = R.getImg('assets/ui/trial_panel_result.png')
  if (img && img.width > 0) c.drawImage(img, x, y, w, h)
  else R.drawDialogPanel(x, y, w, h)
}

function _drawSectionTitle(c, R, S, text, x, y, w) {
  c.save()
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillStyle = '#7A4A12'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText(text, x, y)
  c.strokeStyle = 'rgba(197,150,70,0.22)'
  c.lineWidth = 1
  c.beginPath()
  c.moveTo(x + 72 * S, y)
  c.lineTo(x + w, y)
  c.stroke()
  c.restore()
}

function _drawSummaryPill(c, R, S, x, y, w, title, value, tone) {
  const h = 30 * S
  const grad = c.createLinearGradient(x, y, x + w, y + h)
  if (tone === 'green') {
    grad.addColorStop(0, 'rgba(230,247,226,0.92)')
    grad.addColorStop(1, 'rgba(205,234,203,0.92)')
  } else {
    grad.addColorStop(0, 'rgba(255,244,209,0.95)')
    grad.addColorStop(1, 'rgba(244,221,158,0.95)')
  }
  c.save()
  c.fillStyle = grad
  R.rr(x, y, w, h, 10 * S); c.fill()
  c.strokeStyle = tone === 'green' ? 'rgba(83,142,83,0.35)' : 'rgba(184,132,35,0.36)'
  c.lineWidth = 1
  R.rr(x, y, w, h, 10 * S); c.stroke()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = tone === 'green' ? '#3A7D43' : '#9A6414'
  c.font = `bold ${8*S}px "PingFang SC",sans-serif`
  c.fillText(title, x + w / 2, y + 9 * S)
  c.fillStyle = tone === 'green' ? '#235D2C' : '#6B3E08'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(value, x + w / 2, y + 21 * S)
  c.restore()
  return h
}

function _drawScoreRow(c, R, S, x, y, w, label, value, tone) {
  const rowH = 17 * S
  c.save()
  if (tone === 'highlight') {
    c.fillStyle = 'rgba(255,236,178,0.34)'
    R.rr(x - 5 * S, y - 8 * S, w + 10 * S, rowH, 5 * S); c.fill()
  }
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillStyle = '#6A5436'
  c.font = `bold ${10.5*S}px "PingFang SC",sans-serif`
  c.fillText(label, x, y)
  c.textAlign = 'right'
  c.fillStyle = tone === 'muted' ? '#9A8A73' : '#4F3420'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(value, x + w, y)
  c.restore()
  return rowH
}

function _drawQuestRow(c, S, x, y, w, quest) {
  const done = !!(quest && quest.done)
  c.save()
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillStyle = done ? '#2E8B57' : '#8A7A62'
  c.font = `bold ${8.5*S}px "PingFang SC",sans-serif`
  c.fillText(quest.label, x, y)
  c.textAlign = 'right'
  c.fillStyle = done ? '#1F7A3E' : '#9A8A78'
  c.fillText(done ? `完成 +${quest.score || 0}` : '未完成', x + w, y)
  c.restore()
  return 12 * S
}

function _drawRewardChip(c, R, S, reward, x, y, w, h, attrTheme) {
  c.save()
  const chipGrad = c.createLinearGradient(x, y, x, y + h)
  chipGrad.addColorStop(0, 'rgba(255,249,232,0.95)')
  chipGrad.addColorStop(1, 'rgba(244,224,168,0.86)')
  c.fillStyle = chipGrad
  R.rr(x, y, w, h, 9 * S); c.fill()
  c.strokeStyle = 'rgba(197,150,70,0.48)'
  c.lineWidth = 1
  R.rr(x, y, w, h, 9 * S); c.stroke()
  c.fillStyle = 'rgba(255,255,255,0.35)'
  R.rr(x + 3 * S, y + 3 * S, w - 6 * S, h * 0.35, 7 * S); c.fill()

  const iconSize = 22 * S
  const iconX = x + 10 * S
  const iconY = y + h / 2
  const pet = reward && reward.type === 'randomFragment' && reward.petId ? getPetById(reward.petId) : null
  const emoji = _rewardEmoji(reward)
  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      R.drawCoverImg(img, iconX, iconY - iconSize / 2, iconSize, iconSize, {
        radius: 4 * S,
        strokeStyle: '#b8860b',
        strokeWidth: 1,
      })
    } else {
      _drawFallbackIcon(c, R, S, iconX, iconY, iconSize)
    }
  } else if (emoji) {
    c.font = `${iconSize}px "PingFang SC",sans-serif`
    c.fillStyle = '#7a5028'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(emoji, iconX + iconSize / 2, iconY)
  } else {
    const img = R.getImg(_rewardIcon(reward))
    if (img && img.width > 0) c.drawImage(img, iconX, iconY - iconSize / 2, iconSize, iconSize)
  }

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = reward.type === 'weapon' ? '#B86414' : '#5D4630'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText(_rewardLabel(reward, attrTheme), x + 38 * S, y + h * 0.38)
  c.fillStyle = '#2E8B57'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(_rewardAmount(reward), x + 38 * S, y + h * 0.68)
  c.restore()
}

function _drawFallbackIcon(c, R, S, x, y, size) {
  c.fillStyle = 'rgba(255,255,255,0.24)'
  R.rr(x, y - size / 2, size, size, 4 * S); c.fill()
}

function _spawnRewardFlyOnce(g, rewards, sx, sy) {
  if (!g || !g._trialResult || g._trialResult.rewardFlyDone || !rewards || rewards.length === 0) return
  g._trialResult.rewardFlyDone = true
  rewards.forEach((reward, i) => {
    flyParticles.spawnFromReward(g, reward, sx + (i - 1) * 18 * V.S, sy, { ignorePillRects: true })
  })
}

function rTrialResult(g) {
  const { ctx: c, R, W, H, S, safeTop } = V
  const d = g._trialResult || {}
  const seasonLabel = getTrialSeasonLabel()
  const season = getCurrentTrialSeason()
  const attrTheme = getDailyAttrTheme()
  R.drawHomeBg(g.af || 0)
  c.fillStyle = 'rgba(18,12,36,0.58)'
  c.fillRect(0, 0, W, H)

  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const panelY = safeTop + 28 * S
  const panelH = H - panelY - 94 * S
  _drawResultPanel(c, R, panelX, panelY, panelW, panelH)

  const innerX = panelX + panelW * 0.13
  const innerW = panelW * 0.74
  const contentTop = panelY + panelH * 0.118
  const contentBottom = panelY + panelH * 0.9
  const centerX = panelX + panelW / 2
  const maxFloor = (season && season.maxFloor) || 10
  const floor = Math.max(0, Math.min(maxFloor, d.floor || 0))
  const parts = d.scoreParts || {}
  const questResults = d.dailyQuestResults || []
  const clearBonus = (season && season.score && season.score.clearBonus) || parts.clear || 0
  const scoreAdded = d.scoreAdded || 0

  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#D99A1C'
  c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  c.fillText('试炼结算', centerX, contentTop)
  const scoreCardW = 170 * S
  const scoreCardH = 72 * S
  const scoreCardX = centerX - scoreCardW / 2
  const scoreCardY = contentTop + 22 * S
  c.fillStyle = 'rgba(111,66,12,0.18)'
  R.rr(scoreCardX, scoreCardY, scoreCardW, scoreCardH, 15 * S); c.fill()
  c.fillStyle = '#F6D27A'
  c.font = `bold ${29*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(91,45,9,0.42)'
  c.lineWidth = 2
  c.strokeText(`${d.score || 0} 分`, centerX, scoreCardY + 25 * S)
  c.fillStyle = '#5A2B0F'
  c.fillText(`${d.score || 0} 分`, centerX, scoreCardY + 25 * S)
  c.fillStyle = scoreAdded > 0 ? '#9A5D10' : '#8B7B70'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText(scoreAdded > 0 ? `赛季新增 +${scoreAdded}，累计 ${d.seasonScore || 0}` : `本次未刷新赛季积分，累计 ${d.seasonScore || 0}`, centerX, scoreCardY + 50 * S)
  c.fillStyle = '#8B6A36'
  c.font = `bold ${9*S}px "PingFang SC",sans-serif`
  c.fillText(seasonLabel, centerX, scoreCardY + 64 * S)

  let y = scoreCardY + scoreCardH + 14 * S
  const pillGap = 8 * S
  const pillW = (innerW - pillGap) / 2
  _drawSummaryPill(c, R, S, innerX, y, pillW, '抵达', `第 ${floor}/${maxFloor} 层`, 'gold')
  _drawSummaryPill(c, R, S, innerX + pillW + pillGap, y, pillW, '赛季', scoreAdded > 0 ? `+${scoreAdded}` : '未刷新', scoreAdded > 0 ? 'green' : 'gold')

  y += 43 * S
  _drawSectionTitle(c, R, S, '积分明细', innerX, y, innerW)
  y += 18 * S
  const rows = [
    ['层数积分', `+${parts.floor || 0}`, 'highlight'],
    ['通关奖励', `+${parts.clear || 0} / +${clearBonus}`, parts.clear ? 'highlight' : 'muted'],
    ['最高 Combo', `${d.maxCombo || 0}次 / +${parts.combo || 0}`, parts.combo ? 'highlight' : 'muted'],
    ['属性克制', `${d.counterHits || 0}次 / +${parts.counter || 0}`, parts.counter ? 'highlight' : 'muted'],
    ['速通奖励', `+${parts.speed || 0}`, parts.speed ? 'highlight' : 'muted'],
    ['今日课题', `+${parts.dailyQuest || 0}`, parts.dailyQuest ? 'highlight' : 'muted'],
  ]
  for (const row of rows) {
    y += _drawScoreRow(c, R, S, innerX + 5 * S, y, innerW - 10 * S, row[0], row[1], row[2])
  }

  if (questResults.length > 0) {
    y += 4 * S
    _drawSectionTitle(c, R, S, '今日课题', innerX, y, innerW)
    y += 15 * S
    for (const quest of questResults) {
      y += _drawQuestRow(c, S, innerX + 8 * S, y, innerW - 16 * S, quest)
    }
  }

  y += 6 * S
  _drawSectionTitle(c, R, S, '奖励到账', innerX, y, innerW)
  y += 15 * S
  const rewards = d.rewards || []
  if (rewards.length === 0) {
    const emptyH = Math.min(42 * S, Math.max(28 * S, contentBottom - y))
    c.fillStyle = 'rgba(255,248,232,0.58)'
    R.rr(innerX, y, innerW, emptyH, 10 * S); c.fill()
    c.fillStyle = '#7B6A55'
    c.font = `bold ${9.5*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('本次获得积分已结算，继续挑战可冲击下一档奖励', innerX + innerW / 2, y + emptyH / 2)
  } else {
    const chipGap = 8 * S
    const chipW = (innerW - chipGap) / 2
    const chipH = 44 * S
    const maxRows = Math.max(1, Math.floor((contentBottom - y) / (chipH + chipGap)))
    const visibleRewards = rewards.slice(0, maxRows * 2)
    for (let i = 0; i < visibleRewards.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      _drawRewardChip(c, R, S, visibleRewards[i], innerX + col * (chipW + chipGap), y + row * (chipH + chipGap), chipW, chipH, attrTheme)
    }
    if (visibleRewards.length < rewards.length) {
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#8B6A36'
      c.font = `bold ${9*S}px "PingFang SC",sans-serif`
      c.fillText(`还有 ${rewards.length - visibleRewards.length} 项奖励已入账`, centerX, contentBottom + 8 * S)
    }
    _spawnRewardFlyOnce(g, rewards, innerX + innerW / 2, y + 20 * S)
  }

  const hasRestartTeam = !!(g._trialRestartTeam && g._trialRestartTeam.length)
  const btnW = hasRestartTeam ? W * 0.38 : W * 0.62
  const btnH = 44 * S
  const btnY = H - 66 * S
  if (hasRestartTeam) {
    const gap = 12 * S
    const leftX = (W - btnW * 2 - gap) / 2
    const rightX = leftX + btnW + gap
    R.drawDialogBtn(leftX, btnY, btnW, btnH, '返回试炼', 'cancel')
    g._trialResultBackRect = [leftX, btnY, btnW, btnH]
    R.drawDialogBtn(rightX, btnY, btnW, btnH, '重新开始', 'confirm')
    g._trialResultRestartRect = [rightX, btnY, btnW, btnH]
  } else {
    const btnX = (W - btnW) / 2
    R.drawDialogBtn(btnX, btnY, btnW, btnH, '返回试炼', 'confirm')
    g._trialResultBackRect = [btnX, btnY, btnW, btnH]
    g._trialResultRestartRect = null
  }
}

function tTrialResult(g, x, y, type) {
  if (type !== 'end') return
  if (g._trialResultBackRect && g._hitRect(x, y, ...g._trialResultBackRect)) {
    g._trialResult = null
    g._trialRestartTeam = null
    g.setScene('trialDetail')
    return
  }
  if (g._trialResultRestartRect && g._hitRect(x, y, ...g._trialResultRestartRect)) {
    g._trialResult = null
    g._towerTeamMode = 'trial'
    g._towerTeamSelected = (g._trialRestartTeam || []).slice()
    g._trialRestartTeam = null
    g.setScene('towerTeam')
  }
}

module.exports = { rTrialResult, tTrialResult }
