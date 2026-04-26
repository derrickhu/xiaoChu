/**
 * 天机试炼结算页
 */
const V = require('./env')
const flyParticles = require('./resourceFlyParticles')
const { getTrialSeasonLabel, getDailyAttrTheme } = require('../data/trialSeason')

const ATTR_NAME = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }

function _rewardIcon(reward) {
  if (!reward) return null
  if (reward.type === 'soulStone') return 'assets/ui/icon_soul_stone.png'
  if (reward.type === 'universalFragment') return 'assets/ui/icon_universal_frag.png'
  if (reward.type === 'awakenStone') return 'assets/ui/icon_awaken_stone.png'
  if (reward.type === 'weapon') return reward.duplicateSoulStone ? 'assets/ui/icon_soul_stone.png' : 'assets/ui/nav_weapon.png'
  return null
}

function _rewardEmoji(reward) {
  if (!reward) return null
  if (reward.type === 'randomFragment') return '💠'
  return null
}

function _rewardLabel(reward, attrTheme) {
  if (!reward) return '奖励'
  if (reward.type === 'soulStone') return '灵石'
  if (reward.type === 'universalFragment') return '万能碎'
  if (reward.type === 'awakenStone') return '觉醒石'
  if (reward.type === 'randomFragment') {
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

function _drawRewardChip(c, R, S, reward, x, y, w, h, attrTheme) {
  c.save()
  c.fillStyle = 'rgba(255,248,232,0.62)'
  R.rr(x, y, w, h, 9 * S); c.fill()
  c.strokeStyle = 'rgba(197,150,70,0.36)'
  c.lineWidth = 1
  R.rr(x, y, w, h, 9 * S); c.stroke()

  const iconSize = 22 * S
  const iconX = x + 10 * S
  const iconY = y + h / 2
  const emoji = _rewardEmoji(reward)
  if (emoji) {
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
  const attrTheme = getDailyAttrTheme()
  R.drawHomeBg(g.af || 0)
  c.fillStyle = 'rgba(18,12,36,0.58)'
  c.fillRect(0, 0, W, H)

  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const panelY = safeTop + 42 * S
  const panelH = H - panelY - 94 * S
  _drawResultPanel(c, R, panelX, panelY, panelW, panelH)

  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#D89C1D'
  c.font = `bold ${22*S}px "PingFang SC",sans-serif`
  c.fillText('试炼结算', W / 2, panelY + 38 * S)
  c.fillStyle = '#5A2B0F'
  c.font = `bold ${28*S}px "PingFang SC",sans-serif`
  c.fillText(`${d.score || 0} 分`, W / 2, panelY + 84 * S)
  c.fillStyle = '#7A4A12'
  c.font = `${11*S}px "PingFang SC",sans-serif`
  c.fillText(`赛季累计 +${d.scoreAdded || 0} / ${d.seasonScore || 0}`, W / 2, panelY + 108 * S)
  c.fillStyle = '#8B6A36'
  c.font = `bold ${9*S}px "PingFang SC",sans-serif`
  c.fillText(seasonLabel, W / 2, panelY + 126 * S)

  const innerX = panelX + 30 * S
  const innerW = panelW - 60 * S
  c.textAlign = 'left'
  c.font = `${11*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#5D4630'
  let y = panelY + 154 * S
  const parts = d.scoreParts || {}
  const questResults = d.dailyQuestResults || []
  const rows = [
    ['到达层数', parts.floor || 0],
    ['通关奖励', parts.clear || 0],
    ['最高 Combo', `${d.maxCombo || 0} / +${parts.combo || 0}`],
    ['属性克制', `${d.counterHits || 0} 次 / +${parts.counter || 0}`],
    ['速通奖励', parts.speed || 0],
    ['今日课题', `+${parts.dailyQuest || 0}`],
  ]
  for (const row of rows) {
    c.fillText(row[0], innerX, y)
    c.textAlign = 'right'
    c.fillText(String(row[1]), innerX + innerW, y)
    c.textAlign = 'left'
    y += 22 * S
  }
  c.strokeStyle = 'rgba(190,150,80,0.28)'
  c.lineWidth = 1
  c.beginPath(); c.moveTo(innerX, y - 8 * S); c.lineTo(innerX + innerW, y - 8 * S); c.stroke()
  for (const quest of questResults) {
    c.fillStyle = quest.done ? '#2E8B57' : '#8B7B70'
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(quest.label, innerX + 10 * S, y)
    c.textAlign = 'right'
    c.fillText(quest.done ? `完成 +${quest.score || 0}` : '未完成', innerX + innerW, y)
    c.textAlign = 'left'
    y += 17 * S
  }

  y += 12 * S
  c.fillStyle = '#7A4A12'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText('本次已领取', innerX, y)
  y += 22 * S
  const rewards = d.rewards || []
  if (rewards.length === 0) {
    c.fillStyle = '#8B7B70'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('暂无新档位奖励，继续冲击更高赛季积分', innerX, y)
  } else {
    const chipGap = 8 * S
    const chipW = (innerW - chipGap) / 2
    const chipH = 44 * S
    for (let i = 0; i < rewards.length; i++) {
      const col = i % 2
      const row = Math.floor(i / 2)
      _drawRewardChip(c, R, S, rewards[i], innerX + col * (chipW + chipGap), y + row * (chipH + chipGap), chipW, chipH, attrTheme)
    }
    _spawnRewardFlyOnce(g, rewards, innerX + innerW / 2, y + 20 * S)
  }

  const btnW = W * 0.62
  const btnH = 44 * S
  const btnX = (W - btnW) / 2
  const btnY = H - 66 * S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '返回试炼', 'confirm')
  g._trialResultBackRect = [btnX, btnY, btnW, btnH]
}

function tTrialResult(g, x, y, type) {
  if (type !== 'end') return
  if (g._trialResultBackRect && g._hitRect(x, y, ...g._trialResultBackRect)) {
    g._trialResult = null
    g.setScene('trialDetail')
  }
}

module.exports = { rTrialResult, tTrialResult }
