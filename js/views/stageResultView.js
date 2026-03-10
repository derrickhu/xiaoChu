/**
 * 关卡结算弹框 — 覆盖在战斗背景上的弹窗
 * 展示：评价、掉落奖励、经验收益
 * 按钮：返回（关卡列表）| 下一关（直接进入下一关信息页）
 * 渲染入口：rStageResult  触摸入口：tStageResult
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById } = require('../data/pets')
const { MAX_LEVEL, expToNextLevel, currentRealm } = require('../data/cultivationConfig')
const { getNextStageId, getStageById, isStageUnlocked } = require('../data/stages')

const _rects = {
  backBtnRect: null,
  nextBtnRect: null,
}

// ===== 渲染 =====
function rStageResult(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  // 保留战斗背景，不重绘
  R.drawHomeBg(0)

  // 遮罩
  c.fillStyle = 'rgba(0,0,0,0.65)'
  c.fillRect(0, 0, W, H)

  const result = g._stageResult
  if (!result) return

  // ── 弹框面板 ──
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 16 * S
  const innerW = pw - pad * 2

  // 先计算内容高度，再画面板
  let contentH = 0
  contentH += 36 * S  // 标题
  contentH += 20 * S  // 关卡名+评价
  contentH += 16 * S  // 回合数
  contentH += 10 * S  // 分隔线
  if (result.rewards && result.rewards.length > 0) {
    contentH += 18 * S + result.rewards.length * 14 * S + 10 * S
  }
  contentH += 10 * S  // 分隔线
  if (result.petExp > 0) contentH += 34 * S
  if (result.cultExp > 0) contentH += 60 * S
  contentH += 52 * S  // 按钮区

  const ph = contentH + pad * 2
  const py = Math.max(safeTop + 10 * S, (H - ph) / 2)
  const rad = 14 * S

  // 面板阴影 + 背景
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 20 * S; c.shadowOffsetY = 4 * S
  const bgGrad = c.createLinearGradient(px, py, px, py + ph)
  bgGrad.addColorStop(0, '#3D2B15')
  bgGrad.addColorStop(0.4, '#2A1E10')
  bgGrad.addColorStop(1, '#1A120A')
  c.fillStyle = bgGrad
  R.rr(px, py, pw, ph, rad); c.fill()
  c.restore()

  // 金色边框
  c.strokeStyle = '#C9A84C'; c.lineWidth = 2 * S
  R.rr(px, py, pw, ph, rad); c.stroke()
  c.strokeStyle = 'rgba(201,168,76,0.25)'; c.lineWidth = 1 * S
  R.rr(px + 4*S, py + 4*S, pw - 8*S, ph - 8*S, rad - 2*S); c.stroke()

  let cy = py + pad

  // ── 标题 ──
  c.textAlign = 'center'; c.textBaseline = 'middle'
  if (result.victory) {
    c.save()
    c.shadowColor = 'rgba(255,215,0,0.5)'; c.shadowBlur = 12 * S
    c.fillStyle = '#FFD700'; c.font = `bold ${18*S}px "PingFang SC",sans-serif`
    c.fillText('✦ 关卡通关！ ✦', W / 2, cy + 14 * S)
    c.restore()
  } else {
    c.fillStyle = '#FF6666'; c.font = `bold ${18*S}px "PingFang SC",sans-serif`
    c.fillText('挑战失败', W / 2, cy + 14 * S)
  }
  cy += 36 * S

  // ── 关卡名 + 评价 ──
  c.fillStyle = '#E8D5A3'; c.font = `${12*S}px "PingFang SC",sans-serif`
  let subText = result.stageName || ''
  if (result.rating) {
    const stars = result.rating === 'S' ? '★★★' : result.rating === 'A' ? '★★☆' : '★☆☆'
    const ratingColor = result.rating === 'S' ? '#FFD700' : result.rating === 'A' ? '#C0C0C0' : '#A87040'
    c.fillText(subText, W / 2, cy + 6 * S)
    cy += 16 * S
    c.fillStyle = ratingColor; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.fillText(`评价：${stars} ${result.rating}`, W / 2, cy + 6 * S)
  } else {
    c.fillText(subText, W / 2, cy + 6 * S)
  }
  cy += 16 * S

  // 回合数
  c.fillStyle = 'rgba(200,180,140,0.5)'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText(`总回合数：${result.totalTurns}`, W / 2, cy + 4 * S)
  cy += 16 * S

  // ── 分隔线 ──
  _drawDivider(c, px + pad, cy, px + pw - pad, S)
  cy += 10 * S

  // ── 掉落奖励 ──
  if (result.rewards && result.rewards.length > 0) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#C8B78A'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('▸ 掉落奖励', px + pad, cy + 4 * S)
    if (result.isFirstClear) {
      c.textAlign = 'right'; c.fillStyle = '#FFD700'; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText('首通奖励！', px + pw - pad, cy + 4 * S)
    }
    cy += 18 * S

    for (const r of result.rewards) {
      c.textAlign = 'left'
      if (r.type === 'fragment' && r.petId) {
        const pet = getPetById(r.petId)
        const name = pet ? pet.name : r.petId
        const attrColor = pet ? ((ATTR_COLOR[pet.attr] && ATTR_COLOR[pet.attr].main) || '#ccc') : '#ccc'
        c.fillStyle = attrColor; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  ${name}碎片  ×${r.count}`, px + pad + 8 * S, cy + 4 * S)
      } else if (r.type === 'exp') {
        c.fillStyle = '#C8B78A'; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  修炼经验  +${r.amount}`, px + pad + 8 * S, cy + 4 * S)
      } else if (r.type === 'petExp') {
        c.fillStyle = '#8AC8FF'; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  宠物经验  +${r.amount}`, px + pad + 8 * S, cy + 4 * S)
      }
      cy += 14 * S
    }
    cy += 10 * S
  }

  // ── 分隔线 ──
  _drawDivider(c, px + pad, cy, px + pw - pad, S)
  cy += 10 * S

  // ── 宠物经验 ──
  if (result.petExp > 0) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8AC8FF'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('▸ 宠物经验池', px + pad, cy + 4 * S)
    cy += 16 * S
    c.fillStyle = '#8AC8FF'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(`  经验池 +${result.petExp}`, px + pad + 8 * S, cy + 4 * S)
    cy += 18 * S
  }

  // ── 修炼经验 ──
  if (result.cultExp > 0) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#C8B78A'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('▸ 修炼', px + pad, cy + 4 * S)
    cy += 16 * S

    c.fillStyle = '#E8D5A3'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(`  修炼经验 +${result.cultExp}`, px + pad + 8 * S, cy + 4 * S)
    cy += 14 * S

    if (result.cultLevelUps > 0) {
      c.fillStyle = '#FFD700'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      const cult = g.storage.cultivation
      c.fillText(`  升级！Lv.${result.cultPrevLevel} → Lv.${cult.level}  获得 ${result.cultLevelUps} 修炼点`, px + pad + 8 * S, cy + 4 * S)
      cy += 14 * S
    }

    // 经验条
    const cult = g.storage.cultivation
    const barX = px + pad + 8 * S, barW = innerW - 16 * S, barH = 7 * S
    const barY = cy + 2 * S
    c.fillStyle = 'rgba(255,255,255,0.08)'
    R.rr(barX, barY, barW, barH, barH / 2); c.fill()

    if (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      const pct = Math.min(cult.exp / needed, 1)
      if (pct > 0) {
        const fillW = Math.max(barH, barW * pct)
        const barGrad = c.createLinearGradient(barX, barY, barX + fillW, barY)
        barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
        c.fillStyle = barGrad
        R.rr(barX, barY, fillW, barH, barH / 2); c.fill()
      }
      c.textAlign = 'right'; c.fillStyle = '#C8B78A'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level}  ${cult.exp}/${needed}  ${currentRealm(cult.level).name}`, px + pw - pad, barY + barH + 9 * S)
    } else {
      const barGrad = c.createLinearGradient(barX, barY, barX + barW, barY)
      barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
      c.fillStyle = barGrad
      R.rr(barX, barY, barW, barH, barH / 2); c.fill()
      c.textAlign = 'right'; c.fillStyle = '#C8B78A'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level} 已满级  ${currentRealm(cult.level).name}`, px + pw - pad, barY + barH + 9 * S)
    }
    cy = barY + barH + 22 * S
  }

  // ── 底部按钮 ──
  const btnH = 36 * S
  const btnGap = 10 * S
  const btnW = (innerW - btnGap) / 2
  const btnY2 = cy + 6 * S

  // 返回按钮（左）
  _drawPopupBtn(c, R, S, px + pad, btnY2, btnW, btnH, '返回', false)
  _rects.backBtnRect = [px + pad, btnY2, btnW, btnH]

  // 下一关 / 再次挑战按钮（右）
  const nextId = result.victory ? getNextStageId(result.stageId) : null
  const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
  if (hasNext) {
    _drawPopupBtn(c, R, S, px + pad + btnW + btnGap, btnY2, btnW, btnH, '下一关 ›', true)
    _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY2, btnW, btnH]
  } else {
    _drawPopupBtn(c, R, S, px + pad + btnW + btnGap, btnY2, btnW, btnH, '再次挑战', true)
    _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY2, btnW, btnH]
  }
}

// ===== 触摸 =====
function tStageResult(g, x, y, type) {
  if (type !== 'end') return
  const result = g._stageResult
  if (!result) return

  // 返回 → 关卡列表
  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g.scene = 'stageSelect'
    return
  }

  // 右按钮
  if (_rects.nextBtnRect && g._hitRect(x, y, ..._rects.nextBtnRect)) {
    const nextId = result.victory ? getNextStageId(result.stageId) : null
    const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
    if (hasNext) {
      // 下一关 → 进入下一关信息页
      g._selectedStageId = nextId
      g._stageInfoEnemyDetail = null
      g.scene = 'stageInfo'
    } else {
      // 再次挑战 → 回到当前关卡信息页
      g._selectedStageId = result.stageId
      g._stageInfoEnemyDetail = null
      g.scene = 'stageInfo'
    }
    return
  }
}

// ===== 绘制工具 =====

function _drawDivider(c, x1, y, x2, S) {
  const grad = c.createLinearGradient(x1, y, x2, y)
  grad.addColorStop(0, 'rgba(201,168,76,0)')
  grad.addColorStop(0.2, 'rgba(201,168,76,0.35)')
  grad.addColorStop(0.8, 'rgba(201,168,76,0.35)')
  grad.addColorStop(1, 'rgba(201,168,76,0)')
  c.strokeStyle = grad; c.lineWidth = 1
  c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke()
}

function _drawPopupBtn(c, R, S, x, y, w, h, text, primary) {
  const r = 8 * S
  if (primary) {
    // 金红色主按钮
    c.save()
    c.shadowColor = 'rgba(180,120,30,0.3)'; c.shadowBlur = 8*S
    const bg = c.createLinearGradient(x, y, x, y + h)
    bg.addColorStop(0, '#B8451A'); bg.addColorStop(0.5, '#9C3512'); bg.addColorStop(1, '#7A2A0E')
    c.fillStyle = bg; R.rr(x, y, w, h, r); c.fill()
    c.restore()
    c.strokeStyle = '#D4A843'; c.lineWidth = 1.5*S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#FFE8B8'
  } else {
    // 暗色次按钮
    c.fillStyle = 'rgba(80,70,50,0.6)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = 'rgba(200,180,120,0.3)'; c.lineWidth = 1*S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#C8B78A'
  }
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(text, x + w / 2, y + h / 2)
}

module.exports = { rStageResult, tStageResult }
