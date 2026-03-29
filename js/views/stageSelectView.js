/**
 * 关卡选择界面 — 章节列表 + 关卡卡片（可滚动）
 * 渲染入口：rStageSelect  触摸入口：tStageSelect
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { CHAPTERS, getChapterStages, isChapterUnlocked, isStageUnlocked, getStageAttr, getStageById } = require('../data/stages')
const { drawSeparator } = require('./uiUtils')
const MusicMgr = require('../runtime/music')
const P = require('../platform')

const _rects = {
  backBtnRect: null,
  stageRects: [],
  lockedRects: [],
}

let _scrollY = 0
let _touchStartY = 0
let _touchLastY = 0
let _scrolling = false

function rStageSelect(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  R.drawEventBg(g.af || 0)

  const topY = safeTop + 4 * S
  const topCenterY = topY + 17 * S
  const contentTop = topY + 44 * S
  const contentBottom = H - 8 * S

  // ── 顶栏：返回圆形按钮 + 体力胶囊 ──
  c.save()

  const btnSz = 36 * S
  const btnX = 12 * S
  const backBtnY = topCenterY - btnSz / 2
  c.fillStyle = 'rgba(0,0,0,0.4)'
  c.beginPath()
  c.arc(btnX + btnSz / 2, topCenterY, btnSz / 2, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = '#fff'
  c.lineWidth = 2.5 * S
  c.lineCap = 'round'; c.lineJoin = 'round'
  const arrowX = btnX + btnSz / 2 + 3 * S
  c.beginPath()
  c.moveTo(arrowX, topCenterY - 8 * S)
  c.lineTo(arrowX - 8 * S, topCenterY)
  c.lineTo(arrowX, topCenterY + 8 * S)
  c.stroke()
  _rects.backBtnRect = [btnX, backBtnY, btnSz, btnSz]

  const stIcon = R.getImg('assets/ui/icon_stamina.png')
  const stTxt = `${g.storage.currentStamina}/${g.storage.maxStamina}`
  if (stIcon && stIcon.width > 0) {
    const iconSz = 32 * S
    const iconX = btnX + btnSz + 8 * S
    const iconY = topCenterY - iconSz / 2
    const txtX = iconX + iconSz + 4 * S
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    const txtW = c.measureText(stTxt).width
    const padR = 8 * S
    const capH = 26 * S, capR = capH / 2
    const capX = iconX + iconSz * 0.38
    const capW = txtX + txtW + padR - capX
    const capY = topCenterY - capH / 2
    c.beginPath()
    c.moveTo(capX + capR, capY); c.lineTo(capX + capW - capR, capY)
    c.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
    c.lineTo(capX + capW, capY + capH - capR)
    c.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
    c.lineTo(capX + capR, capY + capH)
    c.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
    c.lineTo(capX, capY + capR)
    c.quadraticCurveTo(capX, capY, capX + capR, capY)
    c.closePath()
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill()
    c.fillStyle = '#fff'
    c.fillText(stTxt, txtX, topCenterY)
    c.drawImage(stIcon, iconX, iconY, iconSz, iconSz)
    // 恢复说明（胶囊右侧）
    const recSec = g.storage.staminaRecoverSec
    const capRightX = capX + capW + 8 * S
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    if (recSec > 0) {
      const mm = String(Math.floor(recSec / 60)).padStart(2, '0')
      const ss = String(recSec % 60).padStart(2, '0')
      c.fillStyle = '#B0D8FF'
      c.fillText(`${mm}:${ss}后+1`, capRightX, topCenterY)
    } else {
      c.fillStyle = 'rgba(200,200,180,0.6)'
      c.fillText('3分钟+1', capRightX, topCenterY)
    }
  } else {
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.fillStyle = '#fff'
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText(`⚡${stTxt}`, btnX + btnSz + 12 * S, topCenterY)
  }
  c.restore()

  // 滚动内容区
  c.save()
  c.beginPath()
  c.rect(0, contentTop, W, contentBottom - contentTop)
  c.clip()

  _rects.stageRects = []
  _rects.lockedRects = []
  const poolCount = g.storage.petPoolCount
  const clearRecord = g.storage.stageClearRecord
  const cardW = W - 24 * S
  const cardX = 12 * S
  const cardGap = 10 * S
  const chapterGap = 22 * S
  let curY = contentTop + 8 * S + _scrollY

  for (const chapter of CHAPTERS) {
    const unlocked = isChapterUnlocked(chapter.id, poolCount, g.storage.stageClearRecord)
    const stages = getChapterStages(chapter.id)
    const clearedCount = unlocked ? stages.filter(s => g.storage.getStageBestRating(s.id)).length : 0

    // ── 章节标题 ──
    c.save()
    c.textAlign = 'left'; c.textBaseline = 'middle'
    const chTitleY = curY + 12 * S
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3 * S
    c.strokeText(chapter.name, 16 * S, chTitleY)
    c.fillStyle = unlocked ? '#FFF5E0' : '#887766'
    c.fillText(chapter.name, 16 * S, chTitleY)

    if (unlocked) {
      c.font = `${10*S}px "PingFang SC",sans-serif`
      c.textAlign = 'right'
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2 * S
      const progressTxt = `${clearedCount}/${stages.length}`
      c.strokeText(progressTxt, W - 16 * S, chTitleY)
      c.fillStyle = clearedCount === stages.length ? '#90EE90' : '#C8B890'
      c.fillText(progressTxt, W - 16 * S, chTitleY)
    }
    c.restore()
    curY += 28 * S

    if (!unlocked) {
      // 未解锁章节提示
      c.save()
      c.fillStyle = 'rgba(30,20,10,0.5)'
      R.rr(cardX, curY, cardW, 36 * S, 8 * S); c.fill()
      const lockImg = R.getImg('assets/ui/lock.png')
      const lockSz = 16 * S
      c.font = `${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#776655'
      const lockTxt = `灵宠池需达 ${chapter.unlockPool} 只解锁`
      if (lockImg && lockImg.width > 0) {
        const totalW = lockSz + 6 * S + c.measureText(lockTxt).width
        const startX = (W - totalW) / 2
        c.drawImage(lockImg, startX, curY + 18 * S - lockSz / 2, lockSz, lockSz)
        c.fillText(lockTxt, startX + lockSz + 6 * S + c.measureText(lockTxt).width / 2, curY + 18 * S)
      } else {
        c.fillText(`🔒 ${lockTxt}`, W / 2, curY + 18 * S)
      }
      c.restore()
      curY += 36 * S + chapterGap
      continue
    }

    // ── 关卡卡片 ──
    for (const stage of stages) {
      const stageUnlocked = isStageUnlocked(stage.id, clearRecord, poolCount)
      const attr = getStageAttr(stage.id)
      const attrColor = ATTR_COLOR[attr]
      const bestRating = g.storage.getStageBestRating(stage.id)
      const lastWave = stage.waves[stage.waves.length - 1]
      const bossEnemy = lastWave.enemies[lastWave.enemies.length - 1]

      if (!stageUnlocked) {
        _drawLockedCard(c, R, S, W, cardX, curY, cardW, stage, stages)
        curY += 52 * S + cardGap
        continue
      }

      const cardH = 72 * S
      const hasDailyLimit = stage.dailyLimit > 0
      const dailyUsed = hasDailyLimit ? g.storage.getStageDailyCount(stage.id) : 0
      const dailyLeft = hasDailyLimit ? stage.dailyLimit - dailyUsed : Infinity
      const exhausted = hasDailyLimit && dailyLeft <= 0
      const ac = attrColor ? attrColor.main : '#887766'
      const avatarSz = cardH
      const textLeft = cardX + avatarSz + 10 * S

      // 卡片背景（头像区域留出来）
      c.save()
      R.rr(cardX, curY, cardW, cardH, 10 * S); c.clip()

      // 右侧信息区渐变背景
      const cardGrad = c.createLinearGradient(cardX + avatarSz * 0.6, curY, cardX + cardW, curY)
      cardGrad.addColorStop(0, 'rgba(30,22,14,0.92)')
      cardGrad.addColorStop(1, 'rgba(40,30,18,0.88)')
      c.fillStyle = cardGrad
      c.fillRect(cardX, curY, cardW, cardH)

      // Boss 头像（填满左侧，无边框，与卡片融为一体）
      const bossAvatarName = bossEnemy.avatar ? bossEnemy.avatar.replace('stage_enemies/', '') : null
      const bossAvatar = bossAvatarName ? R.getImg(`assets/stage_avatars/${bossAvatarName}_avatar.png`) : null
      if (bossAvatar && bossAvatar.width > 0) {
        c.drawImage(bossAvatar, cardX, curY, avatarSz, avatarSz)
      } else {
        c.fillStyle = 'rgba(0,0,0,0.3)'
        c.fillRect(cardX, curY, avatarSz, avatarSz)
      }

      // 头像右侧渐变过渡（让头像和信息区自然融合）
      const fadeGrad = c.createLinearGradient(cardX + avatarSz * 0.55, curY, cardX + avatarSz, curY)
      fadeGrad.addColorStop(0, 'rgba(30,22,14,0)')
      fadeGrad.addColorStop(1, 'rgba(30,22,14,0.92)')
      c.fillStyle = fadeGrad
      c.fillRect(cardX + avatarSz * 0.55, curY, avatarSz * 0.45, cardH)

      c.restore()

      // 卡片边框
      c.strokeStyle = ac + '40'
      c.lineWidth = 1.2 * S
      R.rr(cardX, curY, cardW, cardH, 10 * S); c.stroke()

      // 关卡名称
      c.save()
      c.textAlign = 'left'; c.textBaseline = 'middle'
      c.font = `bold ${13*S}px "PingFang SC",sans-serif`
      c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2 * S
      c.strokeText(stage.name, textLeft, curY + 16 * S)
      c.fillStyle = '#FFF5E0'
      c.fillText(stage.name, textLeft, curY + 16 * S)

      // 属性 | 波次 | 每日剩余（无限制时不显示次数）
      const attrName = ATTR_NAME[attr] || '?'
      c.font = `${10*S}px "PingFang SC",sans-serif`
      c.fillStyle = ac
      c.fillText(`${attrName}属性`, textLeft, curY + 34 * S)
      c.fillStyle = '#C8B890'
      const attrNameW = c.measureText(`${attrName}属性`).width
      const dailyStr = hasDailyLimit ? ` | 今日${dailyLeft}/${stage.dailyLimit}` : ''
      c.fillText(` | ${stage.waves.length}波${dailyStr}`, textLeft + attrNameW, curY + 34 * S)

      // 体力消耗
      c.font = `${10*S}px "PingFang SC",sans-serif`
      const staminaIcon = R.getImg('assets/ui/icon_stamina.png')
      const costTxt = `${stage.staminaCost}`
      const stRightEdge = cardX + cardW - 14 * S
      if (staminaIcon && staminaIcon.width > 0) {
        const stSz = 14 * S
        c.fillStyle = '#8ac8ff'
        c.textAlign = 'right'
        c.fillText(costTxt, stRightEdge, curY + cardH - 14 * S)
        const costW = c.measureText(costTxt).width
        c.drawImage(staminaIcon, stRightEdge - costW - stSz - 2 * S, curY + cardH - 14 * S - stSz / 2, stSz, stSz)
        c.textAlign = 'left'
      } else {
        c.fillStyle = '#8ac8ff'
        c.fillText(`⚡${costTxt}`, textLeft, curY + cardH - 14 * S)
      }
      c.restore()

      // 通关评价
      if (bestRating) {
        c.save()
        c.textAlign = 'right'; c.textBaseline = 'middle'
        const ratingX = cardX + cardW - 14 * S
        const stars = bestRating === 'S' ? '★★★' : bestRating === 'A' ? '★★☆' : '★☆☆'
        const ratingColor = bestRating === 'S' ? '#FFD700' : bestRating === 'A' ? '#C0C0C0' : '#A87040'
        c.font = `bold ${13*S}px "PingFang SC",sans-serif`
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2 * S
        c.strokeText(stars, ratingX, curY + 18 * S)
        c.fillStyle = ratingColor
        c.fillText(stars, ratingX, curY + 18 * S)
        c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillStyle = '#90EE90'
        c.fillText('已通关', ratingX, curY + 36 * S)
        c.restore()
      } else {
        c.save()
        c.textAlign = 'right'; c.textBaseline = 'middle'
        c.font = `${16*S}px "PingFang SC",sans-serif`
        c.fillStyle = 'rgba(255,245,224,0.3)'
        c.fillText('›', cardX + cardW - 14 * S, curY + cardH / 2)
        c.restore()
      }

      // 次数已满提醒
      if (exhausted) {
        c.save()
        c.font = `bold ${10*S}px "PingFang SC",sans-serif`
        c.textAlign = 'left'; c.textBaseline = 'middle'
        c.fillStyle = '#E06060'
        c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2 * S
        c.strokeText('今日次数已满', textLeft, curY + 52 * S)
        c.fillText('今日次数已满', textLeft, curY + 52 * S)
        c.restore()
      }

      _rects.stageRects.push({ stageId: stage.id, rect: [cardX, curY, cardW, cardH] })
      curY += cardH + cardGap
    }

    curY += chapterGap
  }

  // 底部留白
  curY += 20 * S

  // 限制滚动
  const totalContentH = curY - _scrollY - contentTop
  const maxScroll = Math.max(0, totalContentH - (contentBottom - contentTop))
  if (_scrollY < -maxScroll) _scrollY = -maxScroll
  if (_scrollY > 0) _scrollY = 0

  c.restore()

  // 顶部渐隐遮罩（让滚动内容不会突兀出现在标题下方）
  c.save()
  const fadeH = 16 * S
  const fadeGrad = c.createLinearGradient(0, contentTop, 0, contentTop + fadeH)
  fadeGrad.addColorStop(0, 'rgba(0,0,0,0.3)')
  fadeGrad.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = fadeGrad
  c.fillRect(0, contentTop, W, fadeH)
  c.restore()
}

function _drawLockedCard(c, R, S, W, cardX, curY, cardW, stage, stages) {
  const cardH = 52 * S
  c.save()
  c.fillStyle = 'rgba(25,20,15,0.55)'
  R.rr(cardX, curY, cardW, cardH, 10 * S); c.fill()
  c.strokeStyle = 'rgba(100,80,60,0.2)'; c.lineWidth = 1 * S
  R.rr(cardX, curY, cardW, cardH, 10 * S); c.stroke()

  const lockImg = R.getImg('assets/ui/lock.png')
  const lockSz = 18 * S
  const lockX = cardX + 14 * S
  const midY = curY + cardH / 2

  if (lockImg && lockImg.width > 0) {
    c.globalAlpha = 0.5
    c.drawImage(lockImg, lockX, midY - lockSz / 2, lockSz, lockSz)
    c.globalAlpha = 1.0
  }

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `${12*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#776655'
  const nameX = lockX + lockSz + 8 * S
  c.fillText(stage.name, nameX, midY - 7 * S)

  let hint = ''
  if (stage.unlockCondition && stage.unlockCondition.prevStage) {
    const _prev = stages.find(s => s.id === stage.unlockCondition.prevStage)
    const prevName = (_prev && _prev.name) || '前置关卡'
    hint = `需通关：${prevName}`
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillStyle = '#665544'
    c.fillText(hint, nameX, midY + 9 * S)
  } else if (stage.unlockCondition && stage.unlockCondition.petPoolCount) {
    hint = `需拥有${stage.unlockCondition.petPoolCount}只灵宠`
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillStyle = '#665544'
    c.fillText(hint, nameX, midY + 9 * S)
  }
  c.restore()

  _rects.lockedRects.push({ rect: [cardX, curY, cardW, cardH], hint: hint || `${stage.name} 尚未解锁` })
}

// ===== 触摸 =====
function tStageSelect(g, x, y, type) {
  if (type === 'start') {
    _touchStartY = y
    _touchLastY = y
    _scrolling = false
    return
  }

  if (type === 'move') {
    const dy = y - _touchLastY
    _touchLastY = y
    if (Math.abs(y - _touchStartY) > 5 * V.S) _scrolling = true
    if (_scrolling) _scrollY += dy
    return
  }

  if (type === 'end') {
    if (_scrolling) return

    if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
      g.setScene('title')
      return
    }

    for (const item of _rects.stageRects) {
      if (g._hitRect(x, y, ...item.rect)) {
        const stage = getStageById(item.stageId)
        if (stage) {
          if (stage.dailyLimit > 0 && !g.storage.canChallengeStage(item.stageId, stage.dailyLimit)) {
            P.showGameToast(`今日挑战次数已用完（${stage.dailyLimit}/${stage.dailyLimit}）`)
            return
          }
          if (g.storage.currentStamina < stage.staminaCost) {
            P.showGameToast(`体力不足（需要${stage.staminaCost}，当前${g.storage.currentStamina}）`)
            return
          }
        }
        g._selectedStageId = item.stageId
        g._stageInfoEnemyDetail = null
        g.setScene('stageInfo')
        return
      }
    }

    for (const item of _rects.lockedRects) {
      if (g._hitRect(x, y, ...item.rect)) {
        P.showGameToast(item.hint)
        return
      }
    }
  }
}

function resetScroll() {
  _scrollY = 0
}

module.exports = { rStageSelect, tStageSelect, resetScroll }
