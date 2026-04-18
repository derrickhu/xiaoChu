/**
 * 奖励条「小芯片」布局、绘制与领取飞行动效（每日任务行、全完成奖励等复用）
 */
const { CHECKIN_HUAHUA } = require('../data/constants')
const { getPetById, getPetAvatarPath } = require('../data/pets')

const FLY_DURATION_MS = 520
const FLY_STAGGER_MS = 70
const FLY_DY_MUL = 82
const FLY_TAIL_MS = 280

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

function getRewardSlots(rewards) {
  const slots = []
  if (!rewards) return slots
  if (rewards.soulStone) {
    slots.push({ tex: 'assets/ui/icon_soul_stone.png', line: `×${rewards.soulStone}`, subLine: '灵石' })
  }
  if (rewards.stamina) {
    slots.push({ tex: 'assets/ui/icon_stamina.png', line: `×${rewards.stamina}`, subLine: '体力' })
  }
  if (rewards.awakenStone) {
    slots.push({ tex: 'assets/ui/icon_awaken_stone.png', line: `×${rewards.awakenStone}`, subLine: '觉醒石' })
  }
  if (rewards.fragment) {
    slots.push({ tex: 'assets/ui/frame_fragment.png', line: `×${rewards.fragment}`, subLine: '随机碎片' })
  }
  if (rewards.petId) {
    const pet = getPetById(rewards.petId)
    slots.push({ tex: pet ? getPetAvatarPath({ ...pet, star: 1 }) : CHECKIN_HUAHUA.specialPetIcon, line: 'SSR', subLine: pet ? pet.name : '灵宠' })
  }
  const fragReward = rewards.petDuplicateFragment || rewards.petFragment
  if (fragReward && fragReward.petId) {
    const pet = getPetById(fragReward.petId)
    slots.push({
      tex: pet ? getPetAvatarPath({ ...pet, star: 1 }) : CHECKIN_HUAHUA.specialPetIcon,
      line: `×${fragReward.count || 0}`,
      subLine: `${pet ? pet.name : '灵宠'}碎片`,
    })
  }
  return slots.slice(0, 3)
}

/** 分享场景奖励展示：fragment 为万能碎片（与 getRewardSlots 的随机碎片区分） */
function getShareRewardSlots(rewards) {
  const slots = []
  if (!rewards) return slots
  if (rewards.soulStone) {
    slots.push({ tex: 'assets/ui/icon_soul_stone.png', line: `×${rewards.soulStone}`, subLine: '灵石' })
  }
  if (rewards.stamina) {
    slots.push({ tex: 'assets/ui/icon_stamina.png', line: `×${rewards.stamina}`, subLine: '体力' })
  }
  if (rewards.fragment) {
    slots.push({ tex: 'assets/ui/icon_universal_frag.png', line: `×${rewards.fragment}`, subLine: '万能碎片' })
  }
  return slots.slice(0, 3)
}

function layoutRewardSlotChips(c, rewards, anchorX, cy, maxW, u, opts) {
  const cfg = Object.assign({
    align: 'left',
    maxSlots: 3,
    iconSz: 16 * u,
    chipH: 20 * u,
    gap: 6 * u,
    fontSize: 9 * u,
    slotsOverride: null,
  }, opts || {})
  const slots = (cfg.slotsOverride || getRewardSlots(rewards || {})).slice(0, cfg.maxSlots)
  if (!slots.length) return { entries: [], totalW: 0, startX: anchorX, cfg }

  c.save()
  c.font = `bold ${cfg.fontSize}px "PingFang SC",sans-serif`
  const widths = slots.map(slot => Math.max(40 * u, cfg.iconSz + 14 * u + c.measureText(slot.line).width))
  const totalW = widths.reduce((sum, w) => sum + w, 0) + cfg.gap * (slots.length - 1)
  let startX = anchorX
  if (cfg.align === 'center') startX = anchorX - totalW / 2
  else if (cfg.align === 'right') startX = anchorX - totalW
  if (typeof maxW === 'number' && totalW > maxW && cfg.align === 'center') {
    startX = anchorX - maxW / 2
  }
  const entries = []
  let cursorX = startX
  slots.forEach((slot, idx) => {
    const chipW = widths[idx]
    const chipY = cy - cfg.chipH / 2
    const iconX = cursorX + 3 * u
    const iconY = cy - cfg.iconSz / 2
    const textX = iconX + cfg.iconSz + 4 * u
    entries.push({
      slot,
      chipX: cursorX,
      chipY,
      chipW,
      chipH: cfg.chipH,
      iconX,
      iconY,
      iconSz: cfg.iconSz,
      textX,
      cy,
      u,
      fontSize: cfg.fontSize,
    })
    cursorX += chipW + cfg.gap
  })
  c.restore()
  return { entries, totalW, startX, cfg }
}

function chipStyleForRewardState(state) {
  if (state === 'ready') {
    return {
      chipFill: 'rgba(255,246,214,0.98)',
      chipStroke: 'rgba(206,163,42,0.30)',
      textColor: '#9C6B00',
      iconAlpha: 1,
    }
  }
  if (state === 'claimed') {
    return {
      chipFill: 'rgba(243,246,240,0.98)',
      chipStroke: 'rgba(113,170,110,0.18)',
      textColor: '#8A9485',
      iconAlpha: 0.55,
    }
  }
  return {
    chipFill: 'rgba(255,250,240,0.94)',
    chipStroke: 'rgba(175,135,48,0.18)',
    textColor: '#7B5E2B',
    iconAlpha: 1,
  }
}

function drawOneRewardChip(c, R, e, style) {
  const u = e.u
  c.fillStyle = style.chipFill
  _rr(c, e.chipX, e.chipY, e.chipW, e.chipH, e.chipH / 2)
  c.fill()
  c.strokeStyle = style.chipStroke
  c.lineWidth = Math.max(0.5, 0.8 * u)
  _rr(c, e.chipX, e.chipY, e.chipW, e.chipH, e.chipH / 2)
  c.stroke()
  const img = R.getImg(e.slot.tex)
  if (img && img.width > 0) {
    c.save()
    // 乘当前透明度，避免飞效外层已淡出时这里又用1 盖住整张图（会只剩图标悬在屏顶）
    c.globalAlpha = c.globalAlpha * style.iconAlpha
    c.drawImage(img, e.iconX, e.iconY, e.iconSz, e.iconSz)
    c.restore()
  }
  c.fillStyle = style.textColor
  c.font = `bold ${e.fontSize}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillText(e.slot.line, e.textX, e.cy + 0.3 * u)
}

function drawRewardSlotChips(c, R, rewards, anchorX, cy, maxW, u, opts) {
  const cfg = Object.assign({
    align: 'left',
    state: 'pending',
    maxSlots: 3,
    iconSz: 16 * u,
    chipH: 20 * u,
    gap: 6 * u,
    fontSize: 9 * u,
    slotsOverride: null,
  }, opts || {})
  const layout = layoutRewardSlotChips(c, rewards, anchorX, cy, maxW, u, cfg)
  if (!layout.entries.length) return 0
  const style = chipStyleForRewardState(cfg.state)
  c.save()
  layout.entries.forEach(e => drawOneRewardChip(c, R, e, style))
  c.restore()
  return layout.totalW
}

/** 动画完全结束时间（含错开起播），供主循环清理状态 */
function getRewardChipFlyAnimEndMs(anim) {
  if (!anim) return 0
  const n = anim.items && anim.items.length ? anim.items.length : 1
  const stagger = (n - 1) * FLY_STAGGER_MS
  return (anim.duration || FLY_DURATION_MS) + stagger + FLY_TAIL_MS
}

function isRewardChipFlyAnimActive(g) {
  const fly = g._rewardChipFlyAnim
  if (!fly || !fly.items || !fly.items.length) return false
  return Date.now() - fly.t0 < getRewardChipFlyAnimEndMs(fly)
}

/** match: { type:'dailyTask', taskId } | { type:'dailyAllBonus' } */
function shouldSkipStaticRewardChips(g, match) {
  if (!isRewardChipFlyAnimActive(g)) return false
  const s = g._rewardChipFlyAnim.source
  if (!match || !s || match.type !== s.type) return false
  if (match.type === 'dailyTask') return match.taskId === s.taskId
  return true
}

function startRewardChipFlyAnim(g, entries, source) {
  if (!entries || !entries.length) return
  g._rewardChipFlyAnim = {
    t0: Date.now(),
    duration: FLY_DURATION_MS,
    source: source || { type: 'generic' },
    items: entries.map((e, i) => Object.assign({ delay: i * FLY_STAGGER_MS }, e)),
  }
}

function drawRewardChipFlyLayer(c, R, g, S) {
  const anim = g._rewardChipFlyAnim
  if (!anim || !anim.items || !anim.items.length) return
  const now = Date.now()
  const duration = anim.duration || FLY_DURATION_MS
  const style = chipStyleForRewardState('ready')
  c.save()
  anim.items.forEach(it => {
    const tMs = Math.max(0, now - anim.t0 - (it.delay || 0))
    if (tMs <= 0) return
    const p = Math.min(1, tMs / duration)
    const ease = 1 - (1 - p) * (1 - p)
    const dy = -FLY_DY_MUL * S * ease
    const alpha = Math.max(0, 1 - p * 1.08)
    c.globalAlpha = alpha
    const e = {
      slot: it.slot,
      chipX: it.chipX,
      chipY: it.chipY + dy,
      chipW: it.chipW,
      chipH: it.chipH,
      iconX: it.iconX,
      iconY: it.iconY + dy,
      iconSz: it.iconSz,
      textX: it.textX,
      cy: it.cy + dy,
      u: it.u,
      fontSize: it.fontSize,
    }
    drawOneRewardChip(c, R, e, style)
  })
  c.restore()
}

module.exports = {
  FLY_DURATION_MS,
  FLY_STAGGER_MS,
  FLY_DY_MUL,
  FLY_TAIL_MS,
  getRewardChipFlyAnimEndMs,
  getRewardSlots,
  getShareRewardSlots,
  layoutRewardSlotChips,
  chipStyleForRewardState,
  drawOneRewardChip,
  drawRewardSlotChips,
  isRewardChipFlyAnimActive,
  shouldSkipStaticRewardChips,
  startRewardChipFlyAnim,
  drawRewardChipFlyLayer,
}
