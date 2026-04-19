/**
 * goalHintView — 目标牵引公共渲染模块
 *
 * 职责（plan E 节）：让"下一里程碑 + 奖励图标 + 还差几★"在每个决策节点都被看见：
 *   · 首页章节带 drawChapterBand：章名 + 主题色 + 里程碑节点进度条 + 下一档奖励 icon
 *   · stageInfo 顶部 drawGoalBar：通关收益预告（进度条 + 差 X★ + 奖励 + 按钮"查看章节主线"）
 *   · 结算页尾巴 drawGoalTail：下一里程碑 icon + 差 X★
 *   · 首页追踪器 drawGoalTracker：可收起浮标（章 + 星数 + 奖励 + 差几★）
 *
 * 所有函数返回绘制"占用高度"，调用方据此排版。
 * 触摸区由调用方注册 rect（这里只负责绘制）。
 */

const { MILESTONE_TIERS, getChapterMilestoneReward, getNextMilestone } = require('../data/chapterMilestoneConfig')
const { getChapterById } = require('../data/stages')

/**
 * 计算某章节"下一档未领取里程碑"
 * @returns {null | { tier, targetStars, currentStars, remainingStars, rewards }}
 *
 * 细节：
 *   · "未领取" = !storage.isChapterMilestoneClaimed(ch, tier)
 *   · "差 X★"  = max(0, tier - currentStars)，currentStars 已达标但尚未 mark 时显示"可领取"
 *   · 全部 3 档都已领 → 返回 null（UI 隐藏所有目标提示）
 */
function computeNextMilestone(storage, chapterId) {
  if (!storage || !chapterId) return null
  const currentStars = storage.getChapterTotalStars(chapterId, 'normal') || 0
  for (const tier of MILESTONE_TIERS) {
    if (!storage.isChapterMilestoneClaimed(chapterId, tier)) {
      const rewards = getChapterMilestoneReward(chapterId, tier)
      return {
        tier,
        targetStars: tier,
        currentStars,
        remainingStars: Math.max(0, tier - currentStars),
        rewards,
      }
    }
  }
  return null
}

/**
 * 奖励数组 → 代表图标 + 简短文案
 * 返回第一条最稀缺奖励用于"下一档预告"单图标展示
 * 优先级：ssrWeapon > weaponTicket > universalFragment > awakenStone > ssrFragment > soulStone
 *   · ssrWeapon 是新设计（24★ 直接发一件 SSR 法宝）；weaponTicket 保留给历史数据做兼容
 */
function pickMarqueeReward(rewards) {
  if (!rewards || !rewards.length) return null
  const priority = { ssrWeapon: 6, weaponTicket: 5, universalFragment: 4, awakenStone: 3, ssrFragment: 2, soulStone: 1 }
  let best = null
  let bestP = -1
  for (const r of rewards) {
    const p = priority[r.type] || 0
    if (p > bestP) { best = r; bestP = p }
  }
  return best
}

/** 奖励 → { iconPath, emojiFallback, text } */
function rewardToIconText(reward) {
  if (!reward) return null
  if (reward.type === 'soulStone')          return { iconPath: 'assets/ui/icon_soul_stone.png', text: `×${reward.amount}` }
  if (reward.type === 'awakenStone')        return { iconPath: 'assets/ui/icon_awaken_stone.png', text: `×${reward.amount}` }
  if (reward.type === 'universalFragment')  return { iconPath: 'assets/ui/icon_universal_frag.png', text: `×${reward.count}` }
  if (reward.type === 'ssrFragment')        return { iconPath: null, emoji: '💠', text: `SSR碎片×${reward.count}` }
  if (reward.type === 'ssrWeapon')          return { iconPath: 'assets/ui/nav_weapon.png', text: `SSR法宝×1` }
  if (reward.type === 'weaponTicket')       return { iconPath: null, emoji: '🎫', text: `法宝保底券×${reward.count}` }
  return null
}

/** 画一个"奖励 icon + 文案"小组件，返回占用宽度 */
function drawRewardChip(c, R, S, x, y, iconText, opts = {}) {
  const iconSz = opts.iconSz || 14 * S
  const fontPx = opts.fontPx || 9 * S
  const color = opts.color || '#7a5028'
  let cx = x
  const cy = y + iconSz / 2
  c.textBaseline = 'middle'
  c.textAlign = 'left'
  if (iconText.iconPath) {
    const img = R.getImg(iconText.iconPath)
    if (img && img.width > 0) c.drawImage(img, cx, y, iconSz, iconSz)
    cx += iconSz + 2 * S
  } else if (iconText.emoji) {
    c.font = `${iconSz}px "PingFang SC",sans-serif`
    c.fillStyle = color
    c.fillText(iconText.emoji, cx, cy)
    cx += iconSz + 2 * S
  }
  c.font = `bold ${fontPx}px "PingFang SC",sans-serif`
  c.fillStyle = color
  c.fillText(iconText.text, cx, cy)
  cx += c.measureText(iconText.text).width + 2 * S
  return cx - x
}

// ===== 首页章节带 =====
// 宽版章节带：主题色底板 + 章节名 + 进度条（标出 8/16/24 节点）+ 下一档奖励 icon
// 左右两端：章节切换浮层在外面处理，这里只画一条居中整块
//
// 触摸区：调用方用 rect [x, y, w, bandH] 注册（点击跳 chapterMap）
function drawChapterBand(c, R, S, x, y, w, opts) {
  const storage = opts.storage
  const chapterId = opts.chapterId
  const chapter = getChapterById(chapterId) || { name: '秘境', theme: '#b89068' }
  const bandH = 32 * S

  // 主题色底板（半透明，与顶栏拉出区分）
  const themeColor = chapter.theme || '#b89068'
  const grad = c.createLinearGradient(x, y, x + w, y)
  grad.addColorStop(0, _hexToRgba(themeColor, 0.82))
  grad.addColorStop(1, _hexToRgba(themeColor, 0.55))
  c.fillStyle = grad
  R.rr(x, y, w, bandH, 6 * S); c.fill()
  c.strokeStyle = _hexToRgba(themeColor, 0.85)
  c.lineWidth = 1 * S
  R.rr(x, y, w, bandH, 6 * S); c.stroke()

  // 左：章节名
  const pad = 10 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = '#fff8e0'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.shadowColor = 'rgba(0,0,0,0.35)'
  c.shadowBlur = 3 * S
  c.fillText(`第${chapterId}章 · ${chapter.name}`, x + pad, y + bandH / 2)
  c.shadowBlur = 0

  // 右：下一档奖励 icon + "差 X★" 或 "已满"
  const nextMs = computeNextMilestone(storage, chapterId)
  const currStars = storage.getChapterTotalStars(chapterId, 'normal') || 0
  const rightPad = pad

  if (nextMs) {
    const icon = rewardToIconText(pickMarqueeReward(nextMs.rewards))
    // 右侧从右往左排：[差 X★] [奖励 icon]
    c.textAlign = 'right'
    c.font = `bold ${9.5*S}px "PingFang SC",sans-serif`
    c.fillStyle = '#fff8e0'
    const remainText = nextMs.remainingStars > 0 ? `差 ${nextMs.remainingStars}★` : '可领取'
    c.fillText(remainText, x + w - rightPad, y + bandH / 2 - 6 * S)

    // 下面一行：奖励 icon
    if (icon) {
      const chipW = _measureRewardChipWidth(c, R, S, icon, { fontPx: 9 * S, iconSz: 12 * S })
      drawRewardChip(c, R, S, x + w - rightPad - chipW, y + bandH / 2 + 4 * S, icon, {
        fontPx: 9 * S, iconSz: 12 * S, color: '#fff8e0',
      })
    }
  } else {
    c.textAlign = 'right'
    c.font = `bold ${9.5*S}px "PingFang SC",sans-serif`
    c.fillStyle = '#fff8e0'
    c.fillText('本章里程碑已全部领取', x + w - rightPad, y + bandH / 2)
  }

  // 进度条：章节名下方一条细线，标出 8/16/24 节点
  // 节点位置：progressX + tier/24 * progressW
  const barX = x + pad
  const barY = y + bandH - 6 * S
  const barW = w - pad * 2 - 100 * S // 右侧留给"差 X★ + 奖励 icon"
  const barH = 3 * S
  c.fillStyle = 'rgba(255,248,224,0.2)'
  R.rr(barX, barY, barW, barH, barH / 2); c.fill()
  const progress = Math.min(1, currStars / 24)
  if (progress > 0) {
    c.fillStyle = '#fff8e0'
    R.rr(barX, barY, Math.max(barH, barW * progress), barH, barH / 2); c.fill()
  }
  // 8/16/24 节点圆点
  for (const tier of MILESTONE_TIERS) {
    const tx = barX + (tier / 24) * barW
    const claimed = storage.isChapterMilestoneClaimed(chapterId, tier)
    c.fillStyle = claimed
      ? 'rgba(255,220,140,1)'
      : (currStars >= tier ? 'rgba(255,255,255,0.95)' : 'rgba(255,248,224,0.45)')
    c.beginPath(); c.arc(tx, barY + barH / 2, 3.5 * S, 0, Math.PI * 2); c.fill()
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 0.8 * S
    c.beginPath(); c.arc(tx, barY + barH / 2, 3.5 * S, 0, Math.PI * 2); c.stroke()
  }

  return bandH
}

// ===== stageInfo 顶部"通关收益预告" bar =====
// 样式：一条充满宽的 bar，高约 44*S
//   第1行：章节进度条（含节点）
//   第2行：距下一档 X★ + 奖励 icon + [查看章节主线 >] 按钮
function drawGoalBar(c, R, S, x, y, w, opts) {
  const storage = opts.storage
  const chapterId = opts.chapterId
  if (!chapterId || !storage) return 0
  const chapter = getChapterById(chapterId)
  const nextMs = computeNextMilestone(storage, chapterId)
  const currStars = storage.getChapterTotalStars(chapterId, 'normal') || 0
  const barH = 46 * S
  const pad = 10 * S
  const round = 6 * S

  // 底板：淡色「笺纸 / 卷轴」感——纵向暖米渐变 + 左侧章节色条 + 浅金描边，
  // 与对局准备页标题 #FFF5E0、金棕描边同一套仙侠 UI 气质，又保证亮场景下可读
  const themeColor = (chapter && chapter.theme) || '#b89068'
  const paperGrad = c.createLinearGradient(x, y, x, y + barH)
  paperGrad.addColorStop(0, 'rgba(255,252,244,0.98)')
  paperGrad.addColorStop(0.42, 'rgba(252,244,228,0.97)')
  paperGrad.addColorStop(1, 'rgba(245,232,212,0.96)')
  c.fillStyle = paperGrad
  R.rr(x, y, w, barH, round); c.fill()

  const tintGrad = c.createLinearGradient(x, y, x + Math.min(w * 0.42, 130 * S), y + barH)
  tintGrad.addColorStop(0, _hexToRgba(themeColor, 0.13))
  tintGrad.addColorStop(0.55, _hexToRgba(themeColor, 0.04))
  tintGrad.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = tintGrad
  R.rr(x, y, w, barH, round); c.fill()

  c.fillStyle = themeColor
  R.rr(x, y, 3 * S, barH, 1 * S); c.fill()

  c.strokeStyle = 'rgba(188,152,88,0.72)'
  c.lineWidth = 1 * S
  R.rr(x, y, w, barH, round); c.stroke()
  c.strokeStyle = 'rgba(255,250,235,0.55)'
  c.lineWidth = 0.55 * S
  R.rr(x + 0.45 * S, y + 0.45 * S, w - 0.9 * S, barH - 0.9 * S, round - 0.45 * S); c.stroke()

  // 第1行：章节 + 星数（正文用深色，不用浅色 theme 直填字）
  const titleColor = '#1a2a3a'
  const metaColor = '#4a3410'
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillStyle = titleColor
  c.fillText(`第${chapterId}章·${chapter ? chapter.name : ''}`, x + pad, y + 5 * S)

  c.textAlign = 'right'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillStyle = metaColor
  c.fillText(`★ ${currStars}/24`, x + w - pad, y + 5 * S)

  // 进度条（节点版）在第1行下方
  const barX = x + pad
  const barY = y + 20 * S
  const barW = w - pad * 2
  const pbarH = 4 * S
  c.fillStyle = 'rgba(72,58,38,0.22)'
  R.rr(barX, barY, barW, pbarH, pbarH / 2); c.fill()
  const progress = Math.min(1, currStars / 24)
  if (progress > 0) {
    const fillGrad = c.createLinearGradient(barX, barY, barX + barW, barY)
    fillGrad.addColorStop(0, themeColor)
    fillGrad.addColorStop(1, '#d4a843')
    c.fillStyle = fillGrad
    R.rr(barX, barY, Math.max(pbarH, barW * progress), pbarH, pbarH / 2); c.fill()
  }
  for (const tier of MILESTONE_TIERS) {
    const tx = barX + (tier / 24) * barW
    const claimed = storage.isChapterMilestoneClaimed(chapterId, tier)
    c.fillStyle = claimed ? '#d4a843' : (currStars >= tier ? '#ff7a28' : 'rgba(160,130,80,0.6)')
    c.beginPath(); c.arc(tx, barY + pbarH / 2, 4 * S, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#fff8e0'; c.lineWidth = 0.9 * S
    c.beginPath(); c.arc(tx, barY + pbarH / 2, 4 * S, 0, Math.PI * 2); c.stroke()
  }

  // 第2行：左——差 X★ + 奖励 icon；右——"查看章节主线 >" 按钮
  const line2Y = y + 30 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  if (nextMs) {
    const remainText = nextMs.remainingStars > 0 ? `距 ${nextMs.tier}★ 还差 ${nextMs.remainingStars}★` : `${nextMs.tier}★ 里程碑可领取！`
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillStyle = metaColor
    c.fillText(remainText, x + pad, line2Y + 7 * S)
    const remainW = c.measureText(remainText).width
    const icon = rewardToIconText(pickMarqueeReward(nextMs.rewards))
    if (icon) {
      drawRewardChip(c, R, S, x + pad + remainW + 6 * S, line2Y + 7 * S - 6 * S, icon, {
        fontPx: 9 * S, iconSz: 12 * S, color: '#3d2910',
      })
    }
  } else {
    c.font = `${9.5*S}px "PingFang SC",sans-serif`
    c.fillStyle = metaColor
    c.fillText('本章里程碑已全部领取', x + pad, line2Y + 7 * S)
  }

  // 右侧按钮
  const btnW = 78 * S, btnH = 18 * S
  const btnX = x + w - pad - btnW, btnY = line2Y + 2 * S
  c.fillStyle = themeColor
  R.rr(btnX, btnY, btnW, btnH, btnH / 2); c.fill()
  c.fillStyle = '#fff8e0'
  c.font = `bold ${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('章节主线 ›', btnX + btnW / 2, btnY + btnH / 2)

  // 返回按钮 rect 供调用方注册点击
  if (opts.onRegisterRect) opts.onRegisterRect({ btnRect: [btnX, btnY, btnW, btnH], barRect: [x, y, w, barH] })

  return barH
}

// ===== 结算页尾部"下一里程碑"提示 =====
// 一行紧凑：🎯 下一里程碑：16★ · 🎁 万能碎片×3 · 还差 2★   [查看 >]
function drawGoalTail(c, R, S, x, y, w, opts) {
  const storage = opts.storage
  const chapterId = opts.chapterId
  if (!chapterId || !storage) return 0
  const nextMs = computeNextMilestone(storage, chapterId)
  if (!nextMs) return 0
  const chapter = getChapterById(chapterId)
  const themeColor = (chapter && chapter.theme) || '#b89068'
  const rowH = 26 * S
  const pad = 8 * S

  c.fillStyle = _hexToRgba(themeColor, 0.1)
  R.rr(x, y, w, rowH, 5 * S); c.fill()

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `bold ${9.5*S}px "PingFang SC",sans-serif`
  c.fillStyle = themeColor
  const prefix = `🎯 下一里程碑 ${nextMs.tier}★`
  c.fillText(prefix, x + pad, y + rowH / 2)
  let cx = x + pad + c.measureText(prefix).width + 8 * S

  const icon = rewardToIconText(pickMarqueeReward(nextMs.rewards))
  if (icon) {
    cx += drawRewardChip(c, R, S, cx, y + rowH / 2 - 6 * S, icon, {
      fontPx: 9 * S, iconSz: 12 * S, color: '#7a5028',
    })
    cx += 4 * S
  }
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#7a5028'
  const remainText = nextMs.remainingStars > 0 ? `· 还差 ${nextMs.remainingStars}★` : '· 可领取'
  c.fillText(remainText, cx, y + rowH / 2)

  // 右侧 "查看 >" 按钮
  const btnW = 50 * S, btnH = rowH - 8 * S
  const btnX = x + w - pad - btnW, btnY = y + 4 * S
  c.fillStyle = themeColor
  R.rr(btnX, btnY, btnW, btnH, btnH / 2); c.fill()
  c.fillStyle = '#fff8e0'
  c.font = `bold ${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('查看 ›', btnX + btnW / 2, btnY + btnH / 2)
  if (opts.onRegisterRect) opts.onRegisterRect({ btnRect: [btnX, btnY, btnW, btnH], tailRect: [x, y, w, rowH] })

  return rowH
}

// ===== 首页"目标追踪器"浮标 =====
// 右上或指定位置的悬浮小卡片；支持 collapsed 收起状态
function drawGoalTracker(c, R, S, x, y, opts) {
  const storage = opts.storage
  const chapterId = opts.chapterId
  if (!chapterId || !storage) return { w: 0, h: 0 }
  const nextMs = computeNextMilestone(storage, chapterId)
  if (!nextMs) return { w: 0, h: 0 }
  const collapsed = !!opts.collapsed
  const chapter = getChapterById(chapterId)
  const themeColor = (chapter && chapter.theme) || '#b89068'

  if (collapsed) {
    const tagW = 56 * S, tagH = 20 * S
    c.fillStyle = _hexToRgba(themeColor, 0.85)
    R.rr(x, y, tagW, tagH, tagH / 2); c.fill()
    c.strokeStyle = '#fff8e0'; c.lineWidth = 0.8 * S
    R.rr(x, y, tagW, tagH, tagH / 2); c.stroke()
    c.fillStyle = '#fff8e0'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('目标 ›', x + tagW / 2, y + tagH / 2)
    if (opts.onRegisterRect) opts.onRegisterRect({ rect: [x, y, tagW, tagH] })
    return { w: tagW, h: tagH }
  }

  const cardW = 110 * S, cardH = 66 * S
  c.fillStyle = 'rgba(255,255,255,0.92)'
  R.rr(x, y, cardW, cardH, 7 * S); c.fill()
  c.strokeStyle = _hexToRgba(themeColor, 0.7)
  c.lineWidth = 1.2 * S
  R.rr(x, y, cardW, cardH, 7 * S); c.stroke()

  // 顶栏：章节色带 + 标题
  c.fillStyle = themeColor
  R.rr(x, y, cardW, 14 * S, 7 * S); c.fill()
  c.fillStyle = '#fff8e0'
  c.font = `bold ${8.5*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText(`第${chapterId}章 · 下一目标`, x + 6 * S, y + 7 * S)
  // 右上角"收起"按钮
  const collapseBtnSz = 12 * S
  const cbX = x + cardW - collapseBtnSz - 3 * S
  const cbY = y + 1 * S
  c.fillStyle = 'rgba(255,248,224,0.85)'
  c.beginPath(); c.arc(cbX + collapseBtnSz / 2, cbY + collapseBtnSz / 2, collapseBtnSz / 2, 0, Math.PI * 2); c.fill()
  c.strokeStyle = themeColor; c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(cbX + 3 * S, cbY + collapseBtnSz / 2)
  c.lineTo(cbX + collapseBtnSz - 3 * S, cbY + collapseBtnSz / 2)
  c.stroke()

  // 主体：奖励 icon + "xx ★"
  const icon = rewardToIconText(pickMarqueeReward(nextMs.rewards))
  if (icon) {
    drawRewardChip(c, R, S, x + 8 * S, y + 22 * S, icon, {
      fontPx: 10 * S, iconSz: 16 * S, color: '#3d2f22',
    })
  }
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#8b6914'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText(`${nextMs.tier}★ 里程碑`, x + 8 * S, y + 42 * S)
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#7a5028'
  c.fillText(nextMs.remainingStars > 0 ? `还差 ${nextMs.remainingStars}★` : '可领取 →', x + 8 * S, y + 54 * S)

  if (opts.onRegisterRect) {
    opts.onRegisterRect({
      rect: [x, y, cardW, cardH],
      collapseBtnRect: [cbX, cbY, collapseBtnSz, collapseBtnSz],
    })
  }
  return { w: cardW, h: cardH }
}

// ===== 工具：hex → rgba（本模块私有，不外暴露避免与 rewardVisual.rgbaFromHex 重复） =====
function _hexToRgba(hex, alpha) {
  if (!hex) return `rgba(180,144,104,${alpha})`
  const h = hex.replace('#', '')
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function _measureRewardChipWidth(c, R, S, iconText, opts = {}) {
  const iconSz = opts.iconSz || 14 * S
  const fontPx = opts.fontPx || 9 * S
  c.font = `bold ${fontPx}px "PingFang SC",sans-serif`
  const textW = c.measureText(iconText.text).width
  return iconSz + 2 * S + textW + 2 * S
}

module.exports = {
  computeNextMilestone,
  pickMarqueeReward,
  rewardToIconText,
  drawChapterBand,
  drawGoalBar,
  drawGoalTail,
  drawGoalTracker,
}
