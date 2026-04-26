/**
 * 天机试炼详情页
 * 展示首期规则、每日课题、奖励轨道，并进入复用的通天塔编队页。
 */
const V = require('./env')
const P = require('../platform')
const { getCurrentTrialSeason, getTrialStaminaCost, getTrialSeasonProgress, getTrialSeasonLabel, getDailyQuestsForDate, getDailyAttrTheme } = require('../data/trialSeason')

function _rewardIcon(reward) {
  if (!reward) return null
  if (reward.type === 'soulStone') return 'assets/ui/icon_soul_stone.png'
  if (reward.type === 'universalFragment') return 'assets/ui/icon_universal_frag.png'
  if (reward.type === 'awakenStone') return 'assets/ui/icon_awaken_stone.png'
  if (reward.type === 'weapon') return 'assets/ui/nav_weapon.png'
  return null
}

function _rewardEmoji(reward) {
  if (!reward) return null
  if (reward.type === 'randomFragment') return '💠'
  return null
}

function _rewardAmount(reward) {
  if (!reward) return ''
  if (reward.type === 'weapon') return '×1'
  return `×${reward.count || 0}`
}

function _rewardLabel(reward, attrTheme) {
  if (!reward) return '奖励'
  if (reward.type === 'soulStone') return '灵石'
  if (reward.type === 'universalFragment') return '万能碎'
  if (reward.type === 'awakenStone') return '觉醒石'
  if (reward.type === 'randomFragment') return `${(attrTheme && attrTheme.enemyName) || '属性'}宠碎`
  if (reward.type === 'weapon') return 'SSR法宝'
  return '奖励'
}

function _questPoolLabel(quest) {
  if (!quest) return ''
  if (quest.id === 'counter12') return `造成属性克制伤害 ${quest.target || 12} 次`
  return quest.label
}

function _drawIcon(c, R, path, x, y, size, fallback) {
  const img = path ? R.getImg(path) : null
  if (img && img.width > 0) {
    R.drawCoverImg(img, x, y, size, size, { radius: 4 })
    return
  }
  c.save()
  c.fillStyle = 'rgba(255,255,255,0.25)'
  R.rr(x, y, size, size, 5); c.fill()
  c.fillStyle = '#fff'
  c.font = `bold ${size * 0.42}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(fallback || '?', x + size / 2, y + size / 2)
  c.restore()
}

function _drawTrialPanel(c, R, path, x, y, w, h) {
  const img = R.getImg(path)
  if (img && img.width > 0) {
    c.drawImage(img, x, y, w, h)
  } else {
    R.drawDialogPanel(x, y, w, h)
  }
}

function _drawPill(c, R, x, y, w, h, text, color, opts) {
  opts = opts || {}
  c.save()
  c.fillStyle = opts.bg || 'rgba(255,248,230,0.72)'
  R.rr(x, y, w, h, h / 2); c.fill()
  c.strokeStyle = color || 'rgba(160,110,45,0.38)'
  c.lineWidth = 1
  R.rr(x, y, w, h, h / 2); c.stroke()
  c.fillStyle = opts.textColor || '#6A4A1C'
  c.font = `bold ${opts.fontSize || 9}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(text, x + w / 2, y + h / 2)
  c.restore()
}

function _trialName(attrTheme) {
  return `${(attrTheme.enemyName || '').replace(/\//g, '')}试炼`
}

function _drawRewardCard(c, R, S, tier, x, y, w, h, seasonScore, got, attrTheme) {
  const done = seasonScore >= tier.score
  const canClaim = done && !got
  const diff = Math.max(0, tier.score - seasonScore)
  c.save()
  const bg = done ? 'rgba(235,248,222,0.72)' : 'rgba(255,248,232,0.52)'
  c.fillStyle = bg
  R.rr(x, y, w, h, 8 * S); c.fill()
  c.strokeStyle = canClaim ? '#58B96A' : (done ? 'rgba(82,181,106,0.75)' : 'rgba(165,128,75,0.34)')
  c.lineWidth = canClaim ? 1.6 * S : 1 * S
  R.rr(x, y, w, h, 8 * S); c.stroke()

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = done ? '#2E8B57' : '#8A5A16'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText(`${tier.score}分`, x + 10 * S, y + 15 * S)

  const badge = got ? '已领' : (canClaim ? '可领' : `差${diff}`)
  const badgeW = got || canClaim ? 34 * S : 48 * S
  c.fillStyle = got ? 'rgba(82,181,106,0.22)' : (canClaim ? 'rgba(255,232,150,0.58)' : 'rgba(120,90,60,0.10)')
  R.rr(x + w - badgeW - 8 * S, y + 6 * S, badgeW, 18 * S, 9 * S); c.fill()
  c.fillStyle = got ? '#2E8B57' : (canClaim ? '#B86414' : '#8B7B70')
  c.font = `bold ${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText(badge, x + w - badgeW / 2 - 8 * S, y + 15 * S)

  let ry = y + 31 * S
  for (const reward of (tier.rewards || []).slice(0, 3)) {
    const iconSize = 12 * S
    const emoji = _rewardEmoji(reward)
    if (emoji) {
      c.font = `${iconSize}px "PingFang SC",sans-serif`
      c.fillStyle = '#7a5028'
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(emoji, x + 10 * S + iconSize / 2, ry)
    } else {
      _drawIcon(c, R, _rewardIcon(reward), x + 10 * S, ry - iconSize / 2, iconSize, '奖')
    }
    c.textAlign = 'left'
    c.fillStyle = reward.type === 'weapon' ? '#B86414' : (reward.type === 'randomFragment' || reward.type === 'universalFragment' ? '#2F72A8' : '#6A4A1C')
    c.font = `bold ${7.6*S}px "PingFang SC",sans-serif`
    c.fillText(`${_rewardLabel(reward, attrTheme)}${_rewardAmount(reward)}`, x + 27 * S, ry)
    ry += 12 * S
  }
  c.restore()
}

function _todayCreditedScore(state, dailyQuests) {
  const daily = (state && state.daily) || {}
  const questDone = daily.questDone || {}
  const questScore = (dailyQuests || []).reduce((sum, q) => sum + (questDone[q.id] ? (q.score || 0) : 0), 0)
  return (daily.bestScore || 0) + questScore
}

function rTrialDetail(g) {
  const { ctx: c, R, W, H, S, safeTop } = V
  const season = getCurrentTrialSeason()
  const state = g.storage.getTrialState(season.id)
  const dailyQuests = getDailyQuestsForDate()
  const attrTheme = getDailyAttrTheme()
  const seasonProgress = getTrialSeasonProgress()
  const seasonLabel = getTrialSeasonLabel()
  const todayCredited = _todayCreditedScore(state, dailyQuests)
  const cost = getTrialStaminaCost(g.storage)
  const unlocked = g.storage.isTrialUnlocked()

  R.drawHomeBg(g.af || 0)
  c.fillStyle = 'rgba(20,12,36,0.52)'
  c.fillRect(0, 0, W, H)

  const pad = 18 * S
  const topY = safeTop + 10 * S
  c.fillStyle = 'rgba(0,0,0,0.36)'
  c.fillRect(0, topY, W, 38 * S)
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#fff'
  c.fillText('‹ 返回', pad, topY + 19 * S)
  g._trialBackRect = [0, topY, 90 * S, 38 * S]
  c.textAlign = 'center'
  c.fillStyle = '#FFE9A8'
  c.font = `bold ${17*S}px "PingFang SC",sans-serif`
  c.fillText(season.name, W / 2, topY + 19 * S)

  const panelX = pad
  let y = topY + 54 * S
  const panelW = W - pad * 2
  const panelH = 232 * S
  _drawTrialPanel(c, R, 'assets/ui/trial_panel_rule.png', panelX, y, panelW, panelH)

  const innerX = panelX + 28 * S
  const innerW = panelW - 56 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#7A4A12'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.fillText(`今日-${_trialName(attrTheme)}`, panelX + panelW / 2, y + 24 * S)
  c.fillStyle = '#6A4A1C'
  c.font = `bold ${9*S}px "PingFang SC",sans-serif`
  c.fillText(`${seasonLabel} · ${seasonProgress.endLabel}结束`, panelX + panelW / 2, y + 43 * S)

  // 推荐编队只展示玩家应该带的属性，避免把敌方属性也混在一起。
  const orbSize = 22 * S
  const attrY = y + 68 * S
  c.fillStyle = '#6A4A1C'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('推荐编队属性', innerX, attrY)
  let ox = innerX + 78 * S
  for (let i = 0; i < attrTheme.recommendedAttrs.length; i++) {
    const attr = attrTheme.recommendedAttrs[i]
    _drawIcon(c, R, `assets/orbs/orb_${attr}.png`, ox, attrY - orbSize / 2, orbSize, attrTheme.recommendedName)
    ox += 24 * S
  }
  const ruleW = 132 * S
  const ruleX = panelX + panelW - ruleW - 34 * S
  const ruleY = y + 58 * S
  const ruleH = 38 * S
  c.fillStyle = 'rgba(255,248,226,0.82)'
  R.rr(ruleX, ruleY, ruleW, ruleH, 10 * S); c.fill()
  c.strokeStyle = 'rgba(214,154,46,0.5)'; c.lineWidth = 1
  R.rr(ruleX, ruleY, ruleW, ruleH, 10 * S); c.stroke()
  c.fillStyle = '#8A5A16'
  c.font = `bold ${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText('试炼特殊加成', ruleX + ruleW / 2, ruleY + 13 * S)
  c.fillStyle = '#4C3A28'
  c.font = `bold ${7.6*S}px "PingFang SC",sans-serif`
  c.fillText('克制攻击 +15%', ruleX + ruleW / 2, ruleY + 28 * S)
  c.textAlign = 'left'

  const questY = y + 102 * S
  const questH = 82 * S
  const qGrad = c.createLinearGradient(innerX, questY, innerX, questY + questH)
  qGrad.addColorStop(0, 'rgba(255,246,220,0.96)')
  qGrad.addColorStop(1, 'rgba(255,235,196,0.88)')
  c.fillStyle = qGrad
  R.rr(innerX, questY, innerW, questH, 12 * S); c.fill()
  c.strokeStyle = 'rgba(214,154,46,0.5)'; c.lineWidth = 1.2 * S
  R.rr(innerX, questY, innerW, questH, 12 * S); c.stroke()
  c.textAlign = 'left'
  c.fillStyle = '#8A5A16'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText('今日课题（每日首次计分）', innerX + 12 * S, questY + 18 * S)
  let qy = questY + 36 * S
  for (const quest of dailyQuests.slice(0, 3)) {
    c.fillStyle = '#3F3022'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText(_questPoolLabel(quest), innerX + 12 * S, qy)
    _drawPill(c, R, innerX + innerW - 64 * S, qy - 11 * S, 54 * S, 20 * S, `+${quest.score || 0}分`, '#4EA96B', {
      bg: 'rgba(225,255,232,0.88)', textColor: '#267B40', fontSize: 8 * S,
    })
    qy += 18 * S
  }

  c.fillStyle = 'rgba(255,245,205,0.82)'
  R.rr(innerX, y + 188 * S, 126 * S, 24 * S, 12 * S); c.fill()
  c.strokeStyle = 'rgba(208,150,54,0.46)'; c.lineWidth = 1
  R.rr(innerX, y + 188 * S, 126 * S, 24 * S, 12 * S); c.stroke()
  c.fillStyle = '#8A4E12'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText('每层+80  通关+300', innerX + 10 * S, y + 200 * S)
  c.fillStyle = '#5D4630'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText(todayCredited > 0 ? `今日已计入 ${todayCredited} 分` : '今日最高可推进约 1600 分', innerX, y + 216 * S)
  c.textAlign = 'right'
  const stIcon = R.getImg('assets/ui/icon_stamina.png')
  const stText = `${cost}${cost < season.staminaCost ? ' 首战半价' : ''}`
  const stY = y + 200 * S
  const stIconSize = 14 * S
  c.font = `bold ${9*S}px "PingFang SC",sans-serif`
  const stTextW = c.measureText(stText).width
  const stRight = panelX + panelW - 34 * S
  const stIconX = stRight - stTextW - stIconSize - 4 * S
  if (stIcon && stIcon.width > 0) c.drawImage(stIcon, stIconX, stY - stIconSize / 2, stIconSize, stIconSize)
  c.fillStyle = '#6A4A1C'
  c.fillText(stText, stRight, stY)
  c.textAlign = 'left'

  y += panelH + 12 * S
  const rewardH = panelW * (730 / 720)
  _drawTrialPanel(c, R, 'assets/ui/trial_panel_reward.png', panelX, y, panelW, rewardH)
  const seasonScore = state.seasonScore || 0
  const maxRewardScore = season.rewardTrack[season.rewardTrack.length - 1].score
  c.fillStyle = '#7A4A12'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText('积分奖励轨道', innerX, y + 52 * S)
  c.textAlign = 'right'
  c.fillStyle = '#5D4630'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText(`赛季累计 ${seasonScore}/${maxRewardScore}`, panelX + panelW - 34 * S, y + 52 * S)

  const barX = innerX
  const barY = y + 68 * S
  const barW = innerW
  const barH = 10 * S
  c.fillStyle = 'rgba(103,76,43,0.16)'
  R.rr(barX, barY, barW, barH, barH / 2); c.fill()
  const fillW = Math.max(0, Math.min(barW, barW * seasonScore / maxRewardScore))
  const grad = c.createLinearGradient(barX, barY, barX + barW, barY)
  grad.addColorStop(0, '#7BD77A')
  grad.addColorStop(1, '#F1C45D')
  c.fillStyle = grad
  R.rr(barX, barY, fillW, barH, barH / 2); c.fill()

  const cardGap = 8 * S
  const cardW = (innerW - cardGap) / 2
  const cardH = 62 * S
  const cardsY = y + 88 * S
  const claimed = new Set(state.claimed || [])
  for (let i = 0; i < season.rewardTrack.length; i++) {
    const tier = season.rewardTrack[i]
    const got = claimed.has(tier.score)
    const col = i % 2
    const row = Math.floor(i / 2)
    const cx = innerX + col * (cardW + cardGap)
    const cy = cardsY + row * (cardH + cardGap)
    _drawRewardCard(c, R, S, tier, cx, cy, cardW, cardH, seasonScore, got, attrTheme)
  }

  const btnW = W * 0.62
  const btnH = 44 * S
  const btnX = (W - btnW) / 2
  const btnY = H - 72 * S
  const btnLabel = unlocked ? '进入编队' : '通关 2-8 后开放'
  R.drawDialogBtn(btnX, btnY, btnW, btnH, btnLabel, unlocked ? 'confirm' : 'disabled')
  g._trialStartRect = unlocked ? [btnX, btnY, btnW, btnH] : null
}

function tTrialDetail(g, x, y, type) {
  if (type !== 'end') return
  if (g._trialBackRect && g._hitRect(x, y, ...g._trialBackRect)) {
    g.setScene('title')
    return
  }
  if (g._trialStartRect && g._hitRect(x, y, ...g._trialStartRect)) {
    const cost = getTrialStaminaCost(g.storage)
    if (g.storage.currentStamina < cost) {
      P.showGameToast(`体力不足，需要 ${cost} 点`, { type: 'warn' })
      return
    }
    g._towerTeamMode = 'trial'
    g._towerTeamSelected = null
    g._towerTeamFilter = 'all'
    g.setScene('towerTeam')
  }
}

module.exports = { rTrialDetail, tTrialDetail }
