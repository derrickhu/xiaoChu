/**
 * 每日奖励弹窗 — 签到 + 每日任务
 * g._showDailyReward = true 时显示
 */
const V = require('./env')
const { drawPanel, drawDivider } = require('./uiComponents')
const { LOGIN_REWARDS, DAILY_TASKS, getScaledDailyTaskReward, getScaledDailyAllBonus } = require('../data/giftConfig')
const MusicMgr = require('../runtime/music')
const AdManager = require('../adManager')

const _rects = { closeBtnRect: null, signBtnRect: null, signAdRect: null, taskBtnRects: [], allBonusBtnRect: null, allBonusAdRect: null }

function _rewardText(r) {
  const parts = []
  if (r.soulStone) parts.push(`灵石+${r.soulStone}`)
  if (r.fragment) parts.push(`碎片+${r.fragment}`)
  if (r.awakenStone) parts.push(`觉醒石+${r.awakenStone}`)
  if (r.stamina) parts.push(`体力+${r.stamina}`)
  if (r.petChoice) parts.push('SR宠自选')
  return parts.join(' ')
}

function _rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y); c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

function rDailyReward(g) {
  if (!g._showDailyReward) return
  const { ctx: c, R, W, H, S } = V

  c.save()

  // 全屏遮罩
  c.fillStyle = 'rgba(0,0,0,0.55)'
  c.fillRect(0, 0, W, H)

  // 面板
  const pw = W * 0.9, ph = H * 0.76
  const px = (W - pw) / 2, py = (H - ph) / 2 - 6 * S
  const pad = 16 * S
  const ribbonH = 44 * S
  const panelResult = drawPanel(c, S, px, py, pw, ph, { ribbonH })
  const ribbonCY = panelResult.ribbonCY

  // 标题
  c.fillStyle = '#5a3000'
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('每日奖励', W / 2, ribbonCY)

  // 关闭按钮
  const closeR = 14 * S
  const closeX = px + pw - 20 * S, closeY = py + ribbonH / 2
  c.fillStyle = 'rgba(120,80,20,0.15)'
  c.beginPath(); c.arc(closeX, closeY, closeR, 0, Math.PI * 2); c.fill()
  c.strokeStyle = 'rgba(175,135,48,0.4)'; c.lineWidth = 1 * S
  c.beginPath(); c.arc(closeX, closeY, closeR, 0, Math.PI * 2); c.stroke()
  c.fillStyle = '#8B6914'; c.font = `bold ${13*S}px sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('✕', closeX, closeY)
  _rects.closeBtnRect = [closeX - closeR, closeY - closeR, closeR * 2, closeR * 2]

  let cy = py + ribbonH + 14 * S
  const innerL = px + pad, innerR = px + pw - pad, innerW = pw - pad * 2

  // ============ 签到区 ============
  c.fillStyle = '#5a3000'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const sign = g.storage.loginSign
  c.fillText(`签到 · 第 ${sign.day || 0}/7 天${sign.isNewbie ? '' : '（周常）'}`, innerL, cy + 6 * S)
  cy += 20 * S

  const cellGap = 5 * S
  const cellW = (innerW - cellGap * 6) / 7
  const cellH = 56 * S
  const canSign = g.storage.canSignToday

  for (let i = 0; i < 7; i++) {
    const cx = innerL + i * (cellW + cellGap)
    const dayDone = i < sign.day
    const isToday = i === sign.day && canSign

    if (dayDone) {
      c.fillStyle = 'rgba(76,175,80,0.15)'
    } else if (isToday) {
      c.fillStyle = 'rgba(198,162,58,0.18)'
    } else {
      c.fillStyle = 'rgba(140,120,80,0.08)'
    }
    _rr(c, cx, cy, cellW, cellH, 6 * S); c.fill()

    if (isToday) {
      c.strokeStyle = '#C8A23A'; c.lineWidth = 2 * S
      _rr(c, cx, cy, cellW, cellH, 6 * S); c.stroke()
    } else {
      c.strokeStyle = 'rgba(175,135,48,0.2)'; c.lineWidth = 0.5 * S
      _rr(c, cx, cy, cellW, cellH, 6 * S); c.stroke()
    }

    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = dayDone ? '#4CAF50' : '#8B7355'
    c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.fillText(`D${i + 1}`, cx + cellW / 2, cy + 11 * S)

    const rd = LOGIN_REWARDS[i]
    if (rd) {
      c.font = `${7*S}px "PingFang SC",sans-serif`
      if (rd.rewards.petChoice) {
        c.fillStyle = dayDone ? '#aaa' : '#9B59B6'
        c.fillText('SR宠', cx + cellW / 2, cy + 26 * S)
      } else if (rd.rewards.soulStone) {
        c.fillStyle = dayDone ? '#aaa' : '#B8860B'
        c.fillText(`${rd.rewards.soulStone}灵`, cx + cellW / 2, cy + 26 * S)
      } else if (rd.rewards.fragment) {
        c.fillStyle = dayDone ? '#aaa' : '#7B5EA7'
        c.fillText(`${rd.rewards.fragment}碎`, cx + cellW / 2, cy + 26 * S)
      }
      if (rd.rewards.awakenStone) {
        c.fillStyle = dayDone ? '#aaa' : '#9B59B6'
        c.fillText(`${rd.rewards.awakenStone}觉`, cx + cellW / 2, cy + 38 * S)
      }
      if (rd.rewards.stamina) {
        c.fillStyle = dayDone ? '#aaa' : '#3498DB'
        c.fillText(`${rd.rewards.stamina}体`, cx + cellW / 2, cy + 38 * S)
      }
    }

    if (dayDone) {
      c.fillStyle = 'rgba(76,175,80,0.2)'
      _rr(c, cx, cy, cellW, cellH, 6 * S); c.fill()
      c.fillStyle = '#4CAF50'; c.font = `bold ${16*S}px sans-serif`
      c.fillText('✓', cx + cellW / 2, cy + cellH / 2)
    }
  }
  cy += cellH + 10 * S

  if (canSign) {
    const btnW = 120 * S, btnH = 32 * S, btnX = (W - btnW) / 2
    R.drawDialogBtn(btnX, cy, btnW, btnH, '签到领取', 'confirm')
    _rects.signBtnRect = [btnX, cy, btnW, btnH]
    _rects.signAdRect = null
    cy += btnH + 10 * S
  } else {
    c.fillStyle = '#4CAF50'; c.font = `${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('✓ 今日已签到', W / 2, cy + 10 * S)
    _rects.signBtnRect = null
    if (!g._dailySignDoubled && AdManager.canShow('signDouble')) {
      const adW = 72 * S, adH = 22 * S
      const adX = W / 2 + 60 * S, adY = cy + 10 * S - adH / 2
      c.fillStyle = 'rgba(80,160,80,0.15)'
      _rr(c, adX, adY, adW, adH, adH / 2); c.fill()
      c.strokeStyle = 'rgba(80,160,80,0.4)'; c.lineWidth = 1 * S
      _rr(c, adX, adY, adW, adH, adH / 2); c.stroke()
      c.fillStyle = '#408040'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText('▶ 翻倍', adX + adW / 2, adY + adH / 2)
      _rects.signAdRect = [adX, adY, adW, adH]
    } else {
      _rects.signAdRect = null
    }
    cy += 26 * S
  }

  drawDivider(c, S, innerL, innerR, cy)
  cy += 12 * S

  // ============ 每日任务 ============
  c.fillStyle = '#5a3000'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText('每日任务', innerL, cy + 6 * S)
  cy += 22 * S

  const prog = g.storage.dailyTaskProgress
  const _ch = g.storage.currentChapter
  _rects.taskBtnRects = []

  for (const task of DAILY_TASKS) {
    const cur = prog.tasks[task.id] || 0
    const need = task.condition.count
    const done = cur >= need
    const claimed = !!prog.claimed[task.id]
    const rowH = 34 * S

    if (claimed) {
      c.fillStyle = 'rgba(76,175,80,0.08)'
    } else if (done) {
      c.fillStyle = 'rgba(198,162,58,0.1)'
    } else {
      c.fillStyle = 'rgba(140,120,80,0.06)'
    }
    _rr(c, innerL, cy, innerW, rowH, 6 * S); c.fill()
    c.strokeStyle = 'rgba(175,135,48,0.15)'; c.lineWidth = 0.5 * S
    _rr(c, innerL, cy, innerW, rowH, 6 * S); c.stroke()

    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = claimed ? '#aaa' : '#4a3820'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(task.name, innerL + 10 * S, cy + rowH / 2)

    const progText = `${Math.min(cur, need)}/${need}`
    c.textAlign = 'center'
    c.fillStyle = done ? '#4CAF50' : '#B0967A'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.fillText(progText, innerL + innerW * 0.52, cy + rowH / 2)

    c.textAlign = 'left'
    c.fillStyle = '#B8860B'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(_rewardText(getScaledDailyTaskReward(task, _ch)), innerL + innerW * 0.6, cy + rowH / 2)

    if (done && !claimed) {
      const tbW = 48 * S, tbH = 24 * S
      const tbX = innerL + innerW - tbW - 4 * S, tbY = cy + (rowH - tbH) / 2
      R.drawDialogBtn(tbX, tbY, tbW, tbH, '领取', 'confirm')
      _rects.taskBtnRects.push({ id: task.id, rect: [tbX, tbY, tbW, tbH] })
    } else if (claimed) {
      c.fillStyle = '#4CAF50'; c.font = `bold ${10*S}px sans-serif`
      c.textAlign = 'right'
      c.fillText('✓', innerL + innerW - 10 * S, cy + rowH / 2)
    }

    cy += rowH + 4 * S
  }

  cy += 4 * S
  const allDone = DAILY_TASKS.every(t => prog.claimed[t.id])
  const allClaimed = prog.allClaimed

  _rects.allBonusAdRect = null
  if (allDone && !allClaimed) {
    const abW = pw * 0.7, abH = 30 * S, abX = (W - abW) / 2
    R.drawDialogBtn(abX, cy, abW, abH, `全部完成：${_rewardText(getScaledDailyAllBonus(_ch))}`, 'confirm')
    _rects.allBonusBtnRect = [abX, cy, abW, abH]
  } else if (allClaimed) {
    c.fillStyle = '#4CAF50'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('✓ 今日任务全部完成', W / 2, cy + 12 * S)
    _rects.allBonusBtnRect = null
    if (!g._dailyTaskDoubled && AdManager.canShow('dailyTaskBonus')) {
      const adW = 72 * S, adH = 22 * S
      const adX = W / 2 + 80 * S, adY = cy + 12 * S - adH / 2
      c.fillStyle = 'rgba(80,160,80,0.15)'
      _rr(c, adX, adY, adW, adH, adH / 2); c.fill()
      c.strokeStyle = 'rgba(80,160,80,0.4)'; c.lineWidth = 1 * S
      _rr(c, adX, adY, adW, adH, adH / 2); c.stroke()
      c.fillStyle = '#408040'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText('▶ 翻倍', adX + adW / 2, adY + adH / 2)
      _rects.allBonusAdRect = [adX, adY, adW, adH]
    }
  } else {
    c.fillStyle = 'rgba(140,120,80,0.06)'
    const hintW = pw * 0.7, hintH = 28 * S, hintX = (W - hintW) / 2
    _rr(c, hintX, cy, hintW, hintH, hintH / 2); c.fill()
    c.strokeStyle = 'rgba(175,135,48,0.15)'; c.lineWidth = 0.5 * S
    _rr(c, hintX, cy, hintW, hintH, hintH / 2); c.stroke()
    c.fillStyle = '#B0967A'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`全部完成额外奖励：${_rewardText(getScaledDailyAllBonus(_ch))}`, W / 2, cy + hintH / 2)
    _rects.allBonusBtnRect = null
  }

  c.restore()
}

function tDailyReward(g, x, y, type) {
  if (!g._showDailyReward || type !== 'end') return false

  if (_rects.closeBtnRect && g._hitRect(x, y, ..._rects.closeBtnRect)) {
    g._showDailyReward = false
    MusicMgr.playClick && MusicMgr.playClick()
    return true
  }

  if (_rects.signBtnRect && g._hitRect(x, y, ..._rects.signBtnRect)) {
    const result = g.storage.claimLoginReward()
    if (result) {
      MusicMgr.playReward && MusicMgr.playReward()
      g._toast && g._toast(`签到第${result.day}天：${_rewardText(result.rewards)}`)
    }
    return true
  }

  if (_rects.signAdRect && g._hitRect(x, y, ..._rects.signAdRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('signDouble', {
      onRewarded: () => {
        const sign = g.storage.loginSign
        const rd = LOGIN_REWARDS[(sign.day || 1) - 1]
        if (rd && rd.rewards) {
          const r = rd.rewards
          if (r.soulStone) g.storage.addSoulStone(r.soulStone)
          if (r.awakenStone) g.storage.addAwakenStone(r.awakenStone)
          if (r.stamina) {
            g.storage._recoverStamina()
            g.storage._d.stamina.current = Math.min(g.storage.maxStamina, g.storage._d.stamina.current + r.stamina)
            g.storage._save()
          }
          if (r.fragment) g.storage.addRandomFragments(r.fragment)
        }
        g._dailySignDoubled = true
        g._toast && g._toast('签到奖励已翻倍！')
        g._dirty = true
      },
    })
    return true
  }

  const _tch = g.storage.currentChapter
  for (const tb of _rects.taskBtnRects) {
    if (g._hitRect(x, y, ...tb.rect)) {
      const ok = g.storage.claimDailyTask(tb.id)
      if (ok) {
        MusicMgr.playReward && MusicMgr.playReward()
        const task = DAILY_TASKS.find(t => t.id === tb.id)
        if (task) g._toast && g._toast(`${task.name}：${_rewardText(getScaledDailyTaskReward(task, _tch))}`)
      }
      return true
    }
  }

  if (_rects.allBonusBtnRect && g._hitRect(x, y, ..._rects.allBonusBtnRect)) {
    const ok = g.storage.claimDailyAllBonus()
    if (ok) {
      MusicMgr.playReward && MusicMgr.playReward()
      g._toast && g._toast(`全部完成额外奖励：${_rewardText(getScaledDailyAllBonus(_tch))}`)
    }
    return true
  }

  if (_rects.allBonusAdRect && g._hitRect(x, y, ..._rects.allBonusAdRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('dailyTaskBonus', {
      onRewarded: () => {
        const bonus = getScaledDailyAllBonus(_tch)
        if (bonus.soulStone) g.storage.addSoulStone(bonus.soulStone)
        if (bonus.fragment) g.storage.addRandomFragments(bonus.fragment)
        g._dailyTaskDoubled = true
        g._toast && g._toast('全勤奖励已翻倍！')
        g._dirty = true
      },
    })
    return true
  }

  return true
}

module.exports = { rDailyReward, tDailyReward }
