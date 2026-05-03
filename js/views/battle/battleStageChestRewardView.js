/**
 * 战斗内通关六宝箱展示
 */
const V = require('../env')
const MusicMgr = require('../../runtime/music')
const chestReward = require('../../engine/stageChestReward')
const {
  STAGE_CHEST_REVEAL_CHARGE_FRAMES,
  STAGE_CHEST_REVEAL_BURST_FRAMES,
  STAGE_CHEST_REVEAL_ITEM_POP_FRAMES,
  STAGE_CHEST_REST_REVEAL_DELAY_FRAMES,
  STAGE_CHEST_REST_STAGGER_BASE,
  STAGE_CHEST_REST_STAGGER_STEP,
  STAGE_CHEST_REST_REVEAL_DONE_FRAMES,
} = require('../../data/constants')
const { ATTR_COLOR, ATTR_NAME } = require('../../data/tower')
const { getPetById } = require('../../data/pets')
const { getPetRoleTags } = require('../../data/petRoleConfig')

const CHEST_IMG = {
  normal: {
    closed: 'assets/ui/chest_lottery_normal_closed.png',
    open: 'assets/ui/chest_lottery_normal_open.png',
  },
  premium: {
    closed: 'assets/ui/chest_lottery_premium_closed.png',
    open: 'assets/ui/chest_lottery_premium_open.png',
  },
  weapon: {
    closed: 'assets/ui/chest_lottery_weapon_closed.png',
    open: 'assets/ui/chest_lottery_weapon_open.png',
  },
}

function _clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function _easeOutCubic(t) {
  const p = _clamp01(t)
  return 1 - Math.pow(1 - p, 3)
}

function _easeOutBack(t) {
  const p = _clamp01(t)
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
}

function _rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

function _drawFallbackChest(c, R, S, x, y, w, h, kind, opened) {
  const isWeapon = kind === 'weapon'
  const isPremium = kind === 'premium'
  const base = isWeapon ? '#6E4A24' : isPremium ? '#B8872B' : '#8D6B3B'
  const lid = isWeapon ? '#C9A65A' : isPremium ? '#F0C96A' : '#B9955B'
  c.save()
  c.shadowColor = isWeapon ? 'rgba(210,170,90,0.55)' : isPremium ? 'rgba(255,214,110,0.55)' : 'rgba(120,90,50,0.35)'
  c.shadowBlur = 10 * S
  c.fillStyle = base
  _rr(c, x + w * 0.12, y + h * 0.34, w * 0.76, h * 0.48, 8 * S)
  c.fill()
  c.fillStyle = lid
  const lidY = opened ? y + h * 0.12 : y + h * 0.22
  _rr(c, x + w * 0.08, lidY, w * 0.84, h * 0.25, 8 * S)
  c.fill()
  c.strokeStyle = isWeapon ? '#F8E0A0' : isPremium ? '#FFF0B8' : '#E3C58A'
  c.lineWidth = 2 * S
  c.stroke()
  c.fillStyle = isWeapon ? '#F7D06B' : isPremium ? '#FFF0A8' : '#DAB875'
  c.beginPath()
  c.arc(x + w * 0.5, y + h * 0.55, 7 * S, 0, Math.PI * 2)
  c.fill()
  c.restore()
}

/**
 * 在宽 bbox 内按原图宽高比缩放（contain），不拉伸变形，居中
 * @returns {{ dx: number, dy: number, dw: number, dh: number }}
 */
function _containImageRect(iw, ih, boxX, boxY, boxW, boxH) {
  if (!iw || !ih || !boxW || !boxH) {
    return { dx: boxX, dy: boxY, dw: boxW, dh: boxH }
  }
  const ir = iw / ih
  let dw = boxW
  let dh = dw / ir
  if (dh > boxH) {
    dh = boxH
    dw = dh * ir
  }
  return {
    dx: boxX + (boxW - dw) / 2,
    dy: boxY + (boxH - dh) / 2,
    dw,
    dh,
  }
}

function _drawChest(c, R, S, x, y, w, h, kind, opened) {
  const cfg = CHEST_IMG[kind] || CHEST_IMG.normal
  const img = R.getImg(opened ? cfg.open : cfg.closed)
  if (img && img.width > 0) {
    c.save()
    c.shadowColor = kind === 'normal' ? 'rgba(80,60,30,0.28)' : 'rgba(245,204,100,0.45)'
    c.shadowBlur = 10 * S
    const { dx, dy, dw, dh } = _containImageRect(img.width, img.height, x, y, w, h)
    c.drawImage(img, dx, dy, dw, dh)
    c.restore()
  } else {
    _drawFallbackChest(c, R, S, x, y, w, h, kind, opened)
  }
}

/** 稀有度水墨光晕配色（多层渐变 + 柔和射线，避免简陋直线放射） */
function _rarityGlowPalette(rarity) {
  if (rarity === 'SSR') {
    return {
      core: 'rgba(230,185,255,0.55)',
      mid: 'rgba(170,100,235,0.28)',
      rim: 'rgba(120,70,200,0.12)',
      ray: 'rgba(210,150,255,0.42)',
      ink: 'rgba(55,45,85,0.11)',
    }
  }
  if (rarity === 'SR') {
    return {
      core: 'rgba(255,224,150,0.52)',
      mid: 'rgba(235,175,70,0.28)',
      rim: 'rgba(190,130,50,0.11)',
      ray: 'rgba(255,205,110,0.40)',
      ink: 'rgba(85,70,50,0.09)',
    }
  }
  return {
    core: 'rgba(145,235,175,0.48)',
    mid: 'rgba(85,205,140,0.26)',
    rim: 'rgba(55,150,100,0.10)',
    ray: 'rgba(120,230,170,0.38)',
    ink: 'rgba(45,75,60,0.09)',
  }
}

/**
 * @param {number} [animFrame] 动画相位（如 g.af），用于轻微呼吸，避免光晕死板
 */
function _drawRarityGlow(c, S, cx, cy, size, rarity, strong, animFrame) {
  const pal = _rarityGlowPalette(rarity)
  const t = animFrame != null ? animFrame : 0
  const breathe = 1 + Math.sin(t * 0.085) * (strong ? 0.055 : 0.04)
  const rOut = size * (strong ? 0.98 : 0.74) * breathe
  const rMid = size * (strong ? 0.6 : 0.46)
  const rIn = size * (strong ? 0.34 : 0.26)

  c.save()
  c.globalCompositeOperation = 'source-over'

  // 水墨底色晕（最外一层，压低对比）
  const gInk = c.createRadialGradient(cx, cy, 0, cx, cy, rOut * 1.18)
  gInk.addColorStop(0, pal.ink)
  gInk.addColorStop(0.55, pal.ink.replace(/0\.\d+\)$/, '0.05)'))
  gInk.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = gInk
  c.beginPath()
  c.arc(cx, cy, rOut * 1.18, 0, Math.PI * 2)
  c.fill()

  // 品质色外圈光晕
  const g1 = c.createRadialGradient(cx, cy, rIn * 0.15, cx, cy, rOut)
  g1.addColorStop(0, pal.core)
  g1.addColorStop(0.4, pal.mid)
  g1.addColorStop(0.72, pal.rim)
  g1.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g1
  c.beginPath()
  c.arc(cx, cy, rOut, 0, Math.PI * 2)
  c.fill()

  // 内圈亮心与柔边
  const g2 = c.createRadialGradient(cx, cy, 0, cx, cy, rMid)
  g2.addColorStop(0, strong ? 'rgba(255,255,250,0.22)' : 'rgba(255,255,250,0.12)')
  g2.addColorStop(0.45, pal.core.replace(/0\.\d+\)$/, strong ? '0.35)' : '0.22)'))
  g2.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g2
  c.beginPath()
  c.arc(cx, cy, rMid, 0, Math.PI * 2)
  c.fill()

  // 细环，略像法阵/锦边
  c.strokeStyle = pal.ray.replace(/0\.\d+\)$/, strong ? '0.20)' : '0.12)')
  c.lineWidth = strong ? 1.35 * S : 0.85 * S
  c.beginPath()
  c.arc(cx, cy, rMid * 0.9, 0, Math.PI * 2)
  c.stroke()

  // 放射：条数多、长短参差、透明度低，避免“机械转盘”
  const nRays = strong ? 32 : 22
  c.lineCap = 'round'
  for (let i = 0; i < nRays; i++) {
    const ang = (Math.PI * 2 * i) / nRays + t * 0.018
    const jitter = 0.82 + 0.18 * Math.sin(i * 2.07 + t * 0.06)
    const r1 = rIn * (0.22 + 0.12 * jitter)
    const r2 = rOut * (0.5 + 0.38 * jitter) * (strong ? 1 : 0.85)
    c.globalAlpha = strong ? 0.1 + (i % 4) * 0.022 : 0.065
    c.strokeStyle = pal.ray
    c.lineWidth = (strong ? 1.05 : 0.7) * S
    c.beginPath()
    c.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1)
    c.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2)
    c.stroke()
  }
  c.globalAlpha = 1

  // 星点雾斑
  const nDots = strong ? 12 : 7
  for (let i = 0; i < nDots; i++) {
    const ang = (Math.PI * 2 * i) / nDots + 0.65
    const rr = rMid * (0.62 + 0.22 * Math.sin(i * 1.3 + t * 0.04))
    const px = cx + Math.cos(ang) * rr
    const py = cy + Math.sin(ang) * rr
    const ds = (1.1 + (i % 3) * 0.45) * S
    c.globalAlpha = strong ? 0.32 : 0.2
    c.fillStyle = pal.core
    c.beginPath()
    c.arc(px, py, ds * 0.45, 0, Math.PI * 2)
    c.fill()
  }
  c.globalAlpha = 1
  c.restore()
}

function _drawChestChargeFx(c, S, cx, cy, w, h, t, rarity) {
  const p = _clamp01(t / STAGE_CHEST_REVEAL_CHARGE_FRAMES)
  const pal = _rarityGlowPalette(rarity)
  c.save()
  c.globalAlpha = 0.35 + p * 0.45
  const grad = c.createRadialGradient(cx, cy + h * 0.1, 0, cx, cy + h * 0.1, w * 0.82)
  grad.addColorStop(0, pal.core)
  grad.addColorStop(0.55, pal.mid)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = grad
  c.beginPath()
  c.ellipse(cx, cy + h * 0.12, w * (0.48 + p * 0.1), h * 0.34, 0, 0, Math.PI * 2)
  c.fill()

  c.strokeStyle = pal.ray
  c.lineWidth = 1.2 * S
  c.lineCap = 'round'
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI * 2 * i / 10 + p * 1.5
    const r1 = w * (0.58 - p * 0.24)
    const r2 = w * (0.48 - p * 0.16)
    c.globalAlpha = (0.16 + p * 0.26) * (i % 2 ? 0.7 : 1)
    c.beginPath()
    c.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1 * 0.62)
    c.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2 * 0.62)
    c.stroke()
  }
  c.restore()
}

function _drawChestBurstFx(c, S, cx, cy, w, h, t, rarity) {
  const start = STAGE_CHEST_REVEAL_CHARGE_FRAMES
  const p = _clamp01((t - start) / STAGE_CHEST_REVEAL_BURST_FRAMES)
  if (p <= 0 || p >= 1) return
  const pal = _rarityGlowPalette(rarity)
  const flash = 1 - p
  c.save()

  const ringR = w * (0.24 + p * 0.72)
  c.globalAlpha = flash * 0.62
  c.strokeStyle = pal.ray
  c.lineWidth = (3.4 - p * 2.2) * S
  c.beginPath()
  c.ellipse(cx, cy - h * 0.08, ringR, ringR * 0.48, 0, 0, Math.PI * 2)
  c.stroke()

  const grad = c.createRadialGradient(cx, cy - h * 0.12, 0, cx, cy - h * 0.12, w * (0.42 + p * 0.6))
  grad.addColorStop(0, 'rgba(255,255,245,0.8)')
  grad.addColorStop(0.34, pal.core)
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  c.globalAlpha = flash * 0.8
  c.fillStyle = grad
  c.beginPath()
  c.arc(cx, cy - h * 0.12, w * (0.42 + p * 0.42), 0, Math.PI * 2)
  c.fill()

  c.strokeStyle = 'rgba(255,246,190,0.7)'
  c.lineWidth = 1.4 * S
  c.lineCap = 'round'
  for (let i = 0; i < 18; i++) {
    const ang = Math.PI * 2 * i / 18 + 0.12
    const r1 = w * (0.12 + p * 0.26)
    const r2 = w * (0.36 + p * (0.36 + (i % 3) * 0.06))
    c.globalAlpha = flash * (0.28 + (i % 4) * 0.04)
    c.beginPath()
    c.moveTo(cx + Math.cos(ang) * r1, cy - h * 0.12 + Math.sin(ang) * r1)
    c.lineTo(cx + Math.cos(ang) * r2, cy - h * 0.12 + Math.sin(ang) * r2)
    c.stroke()
  }

  for (let i = 0; i < 14; i++) {
    const ang = Math.PI * 2 * i / 14 + 0.37
    const dist = w * (0.16 + p * (0.45 + (i % 3) * 0.08))
    const px = cx + Math.cos(ang) * dist
    const py = cy - h * 0.1 + Math.sin(ang) * dist * 0.8
    c.globalAlpha = flash * 0.65
    c.fillStyle = i % 3 === 0 ? pal.core : 'rgba(255,236,150,0.78)'
    c.beginPath()
    c.arc(px, py, (1.4 + (i % 3) * 0.45) * S, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function _drawRewardRarityAura(c, S, cx, cy, size, rarity, animFrame) {
  const pal = _rarityGlowPalette(rarity)
  const isSSR = String(rarity || '').toUpperCase() === 'SSR'
  const isSR = String(rarity || '').toUpperCase() === 'SR'
  const t = animFrame || 0
  const pulse = 1 + Math.sin(t * 0.08) * (isSSR ? 0.07 : 0.045)
  const outer = size * (isSSR ? 0.95 : isSR ? 0.82 : 0.72) * pulse
  c.save()
  c.strokeStyle = pal.ray
  c.lineWidth = (isSSR ? 2 : 1.3) * S
  c.globalAlpha = isSSR ? 0.36 : isSR ? 0.28 : 0.18
  c.beginPath()
  c.arc(cx, cy, outer, 0, Math.PI * 2)
  c.stroke()
  c.globalAlpha *= 0.55
  c.beginPath()
  c.arc(cx, cy, outer * 0.72, 0, Math.PI * 2)
  c.stroke()
  c.restore()
}

function _drawItem(c, R, S, item, x, y, size, selected, animFrame) {
  if (!item) return
  c.save()
  c.shadowColor = selected ? 'rgba(255,220,120,0.72)' : 'rgba(255,245,210,0.34)'
  c.shadowBlur = selected ? 14 * S : 6 * S
  _drawRarityGlow(c, S, x + size / 2, y + size / 2, size, item.rarity, selected, animFrame)
  if (selected) _drawRewardRarityAura(c, S, x + size / 2, y + size / 2, size, item.rarity, animFrame)
  const img = item.icon ? R.getImg(item.icon) : null
  if (img && img.width > 0) {
    if (R.drawCoverImg) {
      R.drawCoverImg(img, x, y, size, size, { radius: selected ? 7 * S : 5 * S })
    } else {
      c.drawImage(img, x, y, size, size)
    }
  }
  c.restore()
}

/** 非选中槽位在「其余宝箱」阶段的翻开顺序（0～4），用于错开发光 */
function _nonSelectedRevealRank(state, idx) {
  const sel = state.selectedIdx
  if (idx === sel) return -1
  let rank = 0
  for (let j = 0; j < idx; j++) {
    if (j !== sel) rank++
  }
  return rank
}

function _drawSlot(g, panel, idx, x, y, w, h, revealed) {
  const { ctx: c, R, S } = V
  const state = g._stageChestRewardPanel
  const selected = idx === state.selectedIdx
  const t = state.revealTimer || 0
  const selectedOpening = selected && state.state === 'revealing'
  const chargeP = selectedOpening ? _clamp01(t / STAGE_CHEST_REVEAL_CHARGE_FRAMES) : 0
  const burstP = selectedOpening ? _clamp01((t - STAGE_CHEST_REVEAL_CHARGE_FRAMES) / STAGE_CHEST_REVEAL_BURST_FRAMES) : 0
  const pulse = revealed ? 1 : (1 + Math.sin((g.af || 0) * 0.08 + idx) * 0.03)
  const selectedPulse = selectedOpening && t < STAGE_CHEST_REVEAL_CHARGE_FRAMES
    ? 1 + chargeP * 0.12 + Math.sin((g.af || 0) * 0.65) * 0.015
    : selectedOpening
      ? 1 + Math.max(0, 1 - burstP) * 0.08
      : 1
  const chestW = w * (selected && !revealed ? 1.08 : pulse) * selectedPulse
  const chestH = h * (selected && !revealed ? 1.08 : pulse) * selectedPulse
  const cx = x + w / 2
  const cy = y + h / 2
  const shake = selectedOpening && t >= STAGE_CHEST_REVEAL_CHARGE_FRAMES && t <= STAGE_CHEST_REVEAL_CHARGE_FRAMES + 10
    ? Math.sin(t * 2.6) * (1 - (t - STAGE_CHEST_REVEAL_CHARGE_FRAMES) / 10) * 2.2 * S
    : 0
  const drawX = cx - chestW / 2 + shake
  const drawY = cy - chestH / 2 - chargeP * 3 * S

  if (!revealed) {
    _drawChest(c, R, S, drawX, drawY, chestW, chestH, panel.chestKind, false)
    return
  }

  if (selectedOpening && t < STAGE_CHEST_REVEAL_CHARGE_FRAMES) {
    _drawChestChargeFx(c, S, cx, cy, w, h, t, panel.actual && panel.actual.rarity)
  }

  const opened = !selectedOpening || t >= STAGE_CHEST_REVEAL_CHARGE_FRAMES
  _drawChest(c, R, S, drawX, drawY + 5 * S, chestW, chestH, panel.chestKind, opened)
  if (selectedOpening) {
    _drawChestBurstFx(c, S, cx, cy, w, h, t, panel.actual && panel.actual.rarity)
  }

  const glow = R.getImg('assets/ui/chest_lottery_glow.png')
  let glowP
  if (selected) {
    glowP = Math.min(1, Math.max(0, (t - STAGE_CHEST_REVEAL_CHARGE_FRAMES) / 18))
  } else {
    const rank = _nonSelectedRevealRank(state, idx)
    const tRest = state.chestRestRevealed
      ? Math.max(0, t - (state.restRevealStartFrame || 0))
      : 0
    glowP = Math.min(1, Math.max(0, (tRest - rank * STAGE_CHEST_REST_STAGGER_STEP) / 18))
  }
  c.save()
  c.globalAlpha = (selected ? 0.86 : 0.42) * glowP
  if (glow && glow.width > 0) {
    c.drawImage(glow, cx - w * 0.72, cy - h * 0.82, w * 1.44, h * 1.44)
  } else {
    const grad = c.createRadialGradient(cx, cy, 0, cx, cy, w * 0.8)
    grad.addColorStop(0, 'rgba(255,236,150,0.55)')
    grad.addColorStop(1, 'rgba(255,236,150,0)')
    c.fillStyle = grad
    c.fillRect(cx - w, cy - w, w * 2, w * 2)
  }
  c.restore()

  const item = state.slots && state.slots[idx]
  if (selectedOpening && t < STAGE_CHEST_REVEAL_CHARGE_FRAMES + 4) return
  const itemPopP = selected
    ? _easeOutBack((t - STAGE_CHEST_REVEAL_CHARGE_FRAMES - 4) / STAGE_CHEST_REVEAL_ITEM_POP_FRAMES)
    : 1
  const selectedSize = Math.min(82 * S, w * 0.9)
  const itemSize = selected ? selectedSize * (0.52 + Math.max(0, itemPopP) * 0.48) : 40 * S
  const itemY = selected
    ? y - 18 * S - (1 - _clamp01(itemPopP)) * 13 * S
    : y + 7 * S
  c.save()
  if (selected) c.globalAlpha *= _clamp01((t - STAGE_CHEST_REVEAL_CHARGE_FRAMES - 2) / 12)
  _drawItem(c, R, S, item, cx - itemSize / 2, itemY, itemSize, selected, g.af || 0)
  c.restore()
}

function _drawChestPanelBg(c, R, S, x, y, w, h) {
  R.drawInfoPanel(x, y, w, h)
}

function _drawChestGridBg(c, R, S, x, y, w, h) {
  const bg = R.getImg('assets/ui/chest_reward_panel_bg.png')
  if (bg && bg.width > 0) {
    c.save()
    c.globalAlpha *= 0.96
    c.shadowColor = 'rgba(80,55,20,0.14)'
    c.shadowBlur = 8 * S
    c.drawImage(bg, x, y, w, h)
    c.restore()
    return
  }

  c.save()
  c.fillStyle = 'rgba(255,248,228,0.56)'
  _rr(c, x, y, w, h, 14 * S)
  c.fill()
  c.strokeStyle = 'rgba(210,170,80,0.32)'
  c.lineWidth = 1 * S
  c.stroke()
  c.restore()
}

function _drawVerticalText(c, text, x, y, lineH) {
  const chars = String(text || '').split('')
  for (let i = 0; i < chars.length; i++) {
    c.fillText(chars[i], x, y + i * lineH)
  }
}

function _drawCeremonyTitle(c, S, cx, y, title, kind, animFrame) {
  const t = animFrame || 0
  const glow = 0.34 + 0.12 * Math.sin(t * 0.06)
  const grad = c.createLinearGradient(cx - 70 * S, y - 18 * S, cx + 70 * S, y + 18 * S)
  grad.addColorStop(0, kind === 'weapon' ? '#8F4E16' : '#A65E0F')
  grad.addColorStop(0.42, '#D48B18')
  grad.addColorStop(1, kind === 'weapon' ? '#6E3E9B' : '#A45A0B')

  c.save()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `bold ${24 * S}px "PingFang SC","STKaiti",serif`
  c.shadowColor = kind === 'weapon' ? `rgba(80,45,120,${glow})` : `rgba(112,58,10,${glow})`
  c.shadowBlur = 5 * S
  c.lineWidth = 3.2 * S
  c.strokeStyle = 'rgba(255,244,210,0.92)'
  c.strokeText(title, cx, y)
  c.lineWidth = 1.1 * S
  c.strokeStyle = 'rgba(92,50,12,0.56)'
  c.strokeText(title, cx, y)
  c.fillStyle = grad
  c.fillText(title, cx, y)

  c.globalAlpha = 0.72
  const lineY = y + 22 * S
  const lineGrad = c.createLinearGradient(cx - 84 * S, lineY, cx + 84 * S, lineY)
  lineGrad.addColorStop(0, 'rgba(198,145,50,0)')
  lineGrad.addColorStop(0.5, 'rgba(255,222,120,0.78)')
  lineGrad.addColorStop(1, 'rgba(198,145,50,0)')
  c.strokeStyle = lineGrad
  c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(cx - 88 * S, lineY)
  c.lineTo(cx + 88 * S, lineY)
  c.stroke()
  c.restore()
}

/** 灵宠形象左上角：新获得 / 已有 */
function _drawOwnershipTag(c, S, x, y, ownershipTag) {
  if (ownershipTag !== 'new' && ownershipTag !== 'owned') return

  const label = ownershipTag === 'owned' ? '已有' : '新获得'
  c.save()
  const tagFont = `bold ${10 * S}px "PingFang SC",sans-serif`
  c.font = tagFont
  const padX = 7 * S
  const tagH = 15 * S
  const tagW = c.measureText(label).width + padX * 2
  const tagX = x
  const tagY = y
  const rTag = 5 * S
  const isNew = ownershipTag === 'new'
  c.beginPath()
  _rr(c, tagX, tagY, tagW, tagH, rTag)
  const bgGrad = c.createLinearGradient(tagX, tagY, tagX, tagY + tagH)
  if (isNew) {
    bgGrad.addColorStop(0, 'rgba(92,150,110,0.94)')
    bgGrad.addColorStop(1, 'rgba(68,118,88,0.9)')
    c.fillStyle = bgGrad
    c.strokeStyle = 'rgba(200,235,200,0.55)'
  } else {
    bgGrad.addColorStop(0, 'rgba(130,118,108,0.92)')
    bgGrad.addColorStop(1, 'rgba(98,90,84,0.88)')
    c.fillStyle = bgGrad
    c.strokeStyle = 'rgba(210,195,175,0.45)'
  }
  c.lineWidth = 1 * S
  c.fill()
  c.stroke()

  c.fillStyle = 'rgba(255,252,245,0.95)'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = tagFont
  c.fillText(label, tagX + tagW / 2, tagY + tagH / 2)
  c.restore()
}

function _drawRewardShowcaseBg(c, S, x, y, w, h, rarity, attr, animFrame) {
  const pal = _rarityGlowPalette(rarity)
  const t = animFrame || 0
  const pulse = 0.55 + 0.18 * Math.sin(t * 0.05)

  c.save()
  c.shadowColor = pal.ray
  c.shadowBlur = 13 * S
  const bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, 'rgba(58,42,82,0.20)')
  bg.addColorStop(0.48, 'rgba(255,247,224,0.23)')
  bg.addColorStop(1, 'rgba(92,55,28,0.13)')
  c.fillStyle = bg
  _rr(c, x, y, w, h, 18 * S)
  c.fill()

  c.shadowBlur = 0
  c.strokeStyle = `rgba(220,172,76,${0.34 + pulse * 0.22})`
  c.lineWidth = 1.4 * S
  _rr(c, x + 1 * S, y + 1 * S, w - 2 * S, h - 2 * S, 17 * S)
  c.stroke()

  const cx = x + w / 2
  const auraPath = attr
    ? `assets/ui/chest_reward_aura_${attr}.png`
    : 'assets/ui/chest_reward_aura_overlay.png'
  const auraImg = V.R && V.R.getImg ? (V.R.getImg(auraPath) || V.R.getImg('assets/ui/chest_reward_aura_overlay.png')) : null
  if (auraImg && auraImg.width > 0) {
    c.save()
    c.globalAlpha = 0.46 + pulse * 0.12
    c.drawImage(auraImg, cx - w * 0.5, y - h * 0.02, w, h * 0.82)
    c.restore()
  } else {
    const glow = c.createRadialGradient(cx, y + h * 0.42, 0, cx, y + h * 0.42, w * 0.5)
    glow.addColorStop(0, pal.core)
    glow.addColorStop(0.42, pal.mid)
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    c.globalAlpha = 0.18
    c.fillStyle = glow
    c.beginPath()
    c.ellipse(cx, y + h * 0.42, w * 0.38, h * 0.34, 0, 0, Math.PI * 2)
    c.fill()
  }

  // 暗纹：浅金云纹弧线，低透明度，不抢主体。
  c.globalAlpha = 0.18
  c.strokeStyle = 'rgba(132,92,42,0.45)'
  c.lineWidth = 0.9 * S
  for (let i = 0; i < 5; i++) {
    const yy = y + h * (0.18 + i * 0.15)
    c.beginPath()
    c.moveTo(x + 18 * S, yy)
    c.bezierCurveTo(x + w * 0.28, yy - 14 * S, x + w * 0.36, yy + 16 * S, x + w * 0.52, yy)
    c.bezierCurveTo(x + w * 0.68, yy - 14 * S, x + w * 0.78, yy + 12 * S, x + w - 18 * S, yy - 2 * S)
    c.stroke()
  }

  c.globalAlpha = 0.55
  c.fillStyle = 'rgba(255,230,150,0.56)'
  for (let i = 0; i < 10; i++) {
    const px = x + w * (0.12 + ((i * 0.17 + 0.07) % 0.76))
    const py = y + h * (0.14 + ((i * 0.23 + 0.11) % 0.64))
    const r = (0.8 + (i % 3) * 0.35) * S
    c.beginPath()
    c.arc(px, py, r, 0, Math.PI * 2)
    c.fill()
  }
  c.restore()
}

function _drawAttrAuraOverlay(c, R, S, cx, cy, size, attr, alpha) {
  if (!attr || !R || !R.getImg) return
  const img = R.getImg(`assets/ui/chest_reward_aura_${attr}.png`)
  if (!img || img.width <= 0) return
  c.save()
  c.globalAlpha *= alpha
  c.drawImage(img, cx - size / 2, cy - size / 2, size, size)
  c.restore()
}

function _drawRarityBadge(c, S, x, y, rarity) {
  const r = String(rarity || 'R').toUpperCase()
  const pal = _rarityGlowPalette(r)
  const text = r
  c.save()
  c.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
  const w = Math.max(30 * S, c.measureText(text).width + 14 * S)
  const h = 17 * S
  const grad = c.createLinearGradient(x, y, x, y + h)
  if (r === 'SSR') {
    grad.addColorStop(0, 'rgba(126,67,190,0.96)')
    grad.addColorStop(1, 'rgba(76,42,130,0.94)')
  } else if (r === 'SR') {
    grad.addColorStop(0, 'rgba(225,160,54,0.96)')
    grad.addColorStop(1, 'rgba(170,103,31,0.94)')
  } else {
    grad.addColorStop(0, 'rgba(76,152,97,0.95)')
    grad.addColorStop(1, 'rgba(52,112,75,0.92)')
  }
  c.shadowColor = pal.ray
  c.shadowBlur = 7 * S
  _rr(c, x, y, w, h, h / 2)
  c.fillStyle = grad
  c.fill()
  c.shadowBlur = 0
  c.strokeStyle = 'rgba(255,240,185,0.55)'
  c.lineWidth = 1 * S
  c.stroke()
  c.fillStyle = '#FFF8E8'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, x + w / 2, y + h / 2 + 0.2 * S)
  c.restore()
  return { w, h }
}

function _drawRewardNameRow(c, S, cx, y, rarity, title) {
  c.save()
  const name = title || ''
  c.font = `bold ${13 * S}px "PingFang SC",sans-serif`
  const nameW = c.measureText(name).width
  c.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
  const badgeW = Math.max(30 * S, c.measureText(String(rarity || 'R').toUpperCase()).width + 14 * S)
  const gap = 6 * S
  const startX = cx - (badgeW + gap + nameW) / 2
  _drawRarityBadge(c, S, startX, y - 8.5 * S, rarity)
  c.font = `bold ${13 * S}px "PingFang SC",sans-serif`
  c.fillStyle = '#8A5A18'
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  c.fillText(name, startX + badgeW + gap, y)
  c.restore()
}

/** 恭喜获得区：灵宠立绘右侧 — 属性一列、定位一列，文字竖向显示 */
function _drawPetShowcaseMeta(c, R, S, x, iconY, iconSize, pet) {
  if (!pet) return
  const attr = pet.attr || 'metal'
  const ac = ATTR_COLOR[attr] || ATTR_COLOR.metal
  const orbPath = `assets/orbs/orb_${attr}.png`
  const orbImg = R.getImg(orbPath)
  const orbSz = 18 * S
  const colW = 22 * S
  const roleX = x + 30 * S
  const topY = iconY + 1 * S
  const lineH = 10.5 * S

  c.save()
  c.textBaseline = 'top'
  c.textAlign = 'center'

  // 属性列：灵珠在上，竖向文字在下
  if (orbImg && orbImg.width > 0) {
    c.drawImage(orbImg, x + (colW - orbSz) / 2, topY, orbSz, orbSz)
  } else {
    c.fillStyle = (ac && ac.main) ? ac.main : '#888'
    c.beginPath()
    c.arc(x + colW / 2, topY + orbSz / 2, orbSz * 0.38, 0, Math.PI * 2)
    c.fill()
  }
  c.fillStyle = '#5A4530'
  c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
  const attrLabel = `${ATTR_NAME[attr] || attr}属性`
  _drawVerticalText(c, attrLabel, x + colW / 2, topY + orbSz + 4 * S, lineH)

  // 定位列：最多 2 个竖向标签，放在同一列内上下排列
  const tags = getPetRoleTags(pet)
  let tagY = topY
  c.font = `bold ${9.5 * S}px "PingFang SC",sans-serif`
  for (let i = 0; i < Math.min(tags.length, 2); i++) {
    const tag = tags[i]
    const label = (tag && (tag.label || tag.short)) || '辅助'
    const pillW = 22 * S
    const pillH = Math.max(34 * S, label.length * lineH + 8 * S)
    _rr(c, roleX, tagY, pillW, pillH, pillW / 2)
    c.fillStyle = 'rgba(88,72,110,0.38)'
    c.fill()
    c.strokeStyle = 'rgba(200,185,150,0.42)'
    c.lineWidth = 1 * S
    c.stroke()
    c.fillStyle = '#F5F0E8'
    c.textAlign = 'center'
    _drawVerticalText(c, label, roleX + pillW / 2, tagY + 5 * S, lineH)
    tagY += pillH + 5 * S
  }
  c.restore()
}

function _drawRewardShowcase(c, R, S, W, panel, state, y, h, animFrame) {
  const actual = panel.actual
  if (!actual) return
  const revealP = Math.min(1, Math.max(0, ((state.revealTimer || 0) - 12) / 18))
  if (revealP <= 0) return

  c.save()
  c.globalAlpha *= revealP
  const cx = W / 2
  const cardW = Math.min(W * 0.78, 306 * S)
  const cardH = h
  const cardX = cx - cardW / 2
  const cardY = y

  _drawRewardShowcaseBg(c, S, cardX, cardY, cardW, cardH, actual.rarity, actual.attr, animFrame)

  const titleY = cardY + 22 * S
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.save()
  c.shadowColor = 'rgba(106,62,18,0.28)'
  c.shadowBlur = 4 * S
  c.strokeStyle = 'rgba(255,246,214,0.95)'
  c.lineWidth = 3 * S
  c.fillStyle = '#B96A0F'
  c.font = `bold ${19 * S}px "PingFang SC","STKaiti",serif`
  c.strokeText('恭喜获得', cx, titleY)
  c.lineWidth = 1 * S
  c.strokeStyle = 'rgba(104,56,10,0.52)'
  c.strokeText('恭喜获得', cx, titleY)
  c.fillText('恭喜获得', cx, titleY)
  c.restore()

  const iconSize = Math.min(74 * S, cardH * 0.46)
  const iconY = cardY + 42 * S
  const iconX = cx - iconSize / 2
  const petForMeta = (actual.kind === 'pet' || actual.kind === 'fragment') && actual.id
    ? getPetById(actual.id)
    : null
  const metaGap = 12 * S
  const iconImg = actual.icon ? R.getImg(actual.icon) : null
  c.save()
  c.shadowColor = panel.chestKind === 'weapon' ? 'rgba(190,145,70,0.55)' : 'rgba(235,190,80,0.55)'
  c.shadowBlur = 18 * S
  _drawRarityGlow(c, S, iconX + iconSize / 2, iconY + iconSize / 2, iconSize, actual.rarity, true, animFrame)
  _drawAttrAuraOverlay(c, R, S, iconX + iconSize / 2, iconY + iconSize / 2, iconSize * 1.95, actual.attr, 0.34)
  if (iconImg && iconImg.width > 0) {
    if (R.drawCoverImg) {
      R.drawCoverImg(iconImg, iconX, iconY, iconSize, iconSize, { radius: 6 * S })
    } else {
      c.drawImage(iconImg, iconX, iconY, iconSize, iconSize)
    }
  }
  c.restore()

  if (petForMeta) {
    _drawPetShowcaseMeta(c, R, S, iconX + iconSize + metaGap, iconY, iconSize, petForMeta)
  }
  _drawOwnershipTag(c, S, iconX - 4 * S, iconY - 2 * S, actual.ownershipTag)

  _drawRewardNameRow(c, S, cx, iconY + iconSize + 20 * S, actual.rarity, actual.title)
  c.fillStyle = '#6D5434'
  c.font = `${10.5 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(`${actual.sub || panel.resultText || '奖励已获得'}  ${actual.amount || ''}`, cx, iconY + iconSize + 38 * S)
  c.restore()
}

function drawStageChestReward(g) {
  const state = g._stageChestRewardPanel
  const panel = chestReward.currentPanel(state)
  if (!state || !panel) return
  const { ctx: c, R, W, H, S, safeTop } = V
  state.timer = (state.timer || 0) + 1
  if (state.state === 'revealing') {
    state.revealTimer = (state.revealTimer || 0) + 1
    const t = state.revealTimer || 0
    if (!state.chestRestRevealed) {
      if (t >= STAGE_CHEST_REST_REVEAL_DELAY_FRAMES) {
        state.chestRestRevealed = true
        state.restRevealStartFrame = t
      }
    } else {
      const dt = t - (state.restRevealStartFrame || 0)
      if (dt > STAGE_CHEST_REST_REVEAL_DONE_FRAMES) state.state = 'revealed'
    }
  }
  const alpha = Math.min(1, state.timer / 16)

  c.save()
  c.globalAlpha = alpha
  c.fillStyle = 'rgba(12,10,18,0.58)'
  c.fillRect(0, 0, W, H)

  if (state.state === 'revealing') {
    const t = state.revealTimer || 0
    const burstT = t - STAGE_CHEST_REVEAL_CHARGE_FRAMES
    if (burstT >= 0 && burstT <= 10) {
      const amp = (1 - burstT / 10) * 1.8 * S
      c.translate(Math.sin(t * 2.1) * amp, Math.cos(t * 2.7) * amp * 0.55)
    }
  }

  const panelW = Math.min(W * 0.92, 380 * S)
  const panelH = Math.min(H * 0.76, 530 * S)
  const panelX = (W - panelW) / 2
  const panelY = Math.max(safeTop + 36 * S, (H - panelH) / 2)
  _drawChestPanelBg(c, R, S, panelX, panelY, panelW, panelH)

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  _drawCeremonyTitle(c, S, W / 2, panelY + 35 * S, panel.title, panel.chestKind, g.af || 0)

  c.fillStyle = '#8C6A3A'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.fillText(panel.subtitle, W / 2, panelY + 58 * S)
  if (state.panels.length > 1) {
    c.fillStyle = 'rgba(130,90,40,0.68)'
    c.font = `${9 * S}px "PingFang SC",sans-serif`
    c.fillText(`${(state.panelIdx || 0) + 1}/${state.panels.length}`, panelX + panelW - 22 * S, panelY + 24 * S)
  }

  const gridW = panelW - 38 * S
  const gapX = 10 * S
  const gapY = 30 * S
  const slotW = (gridW - gapX * 2) / 3
  const slotH = 74 * S
  const gridX = panelX + 19 * S
  const gridY = panelY + 82 * S
  _drawChestGridBg(c, R, S, gridX - 8 * S, gridY - 12 * S, gridW + 16 * S, slotH * 2 + gapY + 28 * S)
  g._stageChestSlotRects = []
  for (let i = 0; i < 6; i++) {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = gridX + col * (slotW + gapX)
    const y = gridY + row * (slotH + gapY)
    const isChosen = state.selectedIdx === i
    const revealAll = state.state === 'revealed'
    let slotRevealed = false
    if (revealAll) slotRevealed = true
    else if (state.state === 'revealing') {
      if (isChosen) slotRevealed = true
      else if (state.chestRestRevealed) {
        const rank = _nonSelectedRevealRank(state, i)
        const dt = (state.revealTimer || 0) - (state.restRevealStartFrame || 0)
        slotRevealed = dt > STAGE_CHEST_REST_STAGGER_BASE + rank * STAGE_CHEST_REST_STAGGER_STEP
      }
    }
    _drawSlot(g, panel, i, x, y, slotW, slotH, slotRevealed)
    g._stageChestSlotRects.push([x, y, slotW, slotH])
  }

  const showcaseY = gridY + slotH * 2 + gapY + 24 * S
  const showcaseH = Math.max(116 * S, panelY + panelH - 58 * S - showcaseY)
  const bottomY = panelY + panelH - 92 * S
  if (state.state === 'choose') {
    c.fillStyle = '#6C4D24'
    c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    c.fillText('点击一个宝箱开启', W / 2, bottomY + 8 * S)
  } else {
    _drawRewardShowcase(c, R, S, W, panel, state, showcaseY, showcaseH, g.af || 0)
  }
  if (state.state === 'revealing' && !state.chestRestRevealed) {
    c.fillStyle = 'rgba(108,77,36,0.88)'
    c.font = `${10 * S}px "PingFang SC",sans-serif`
    c.fillText('点击屏幕或稍候揭晓其余宝箱', W / 2, bottomY + 8 * S)
  }

  g._stageChestContinueRect = null
  if (state.state === 'revealed') {
    const btnW = panelW * 0.62
    const btnH = 38 * S
    const btnX = panelX + (panelW - btnW) / 2
    const btnY = panelY + panelH - 52 * S
    const isLast = (state.panelIdx || 0) >= state.panels.length - 1
    R.drawDialogBtn(btnX, btnY, btnW, btnH, isLast ? '查看其他全部奖励' : '开启法宝匣', 'gold')
    g._stageChestContinueRect = [btnX, btnY, btnW, btnH]
  }

  c.restore()
}

function handleStageChestRewardTouch(g, type, x, y) {
  const state = g._stageChestRewardPanel
  if (!state) return false
  if (type !== 'end') return true
  const panel = chestReward.currentPanel(state)
  if (!panel) return true

  // 已揭晓选中奖励，等待用户点击或延时后再翻开其余宝箱
  if (state.state === 'revealing' && !state.chestRestRevealed) {
    state.chestRestRevealed = true
    state.restRevealStartFrame = state.revealTimer || 0
    g._dirty = true
    return true
  }

  if (state.state === 'choose') {
    const rects = g._stageChestSlotRects || []
    for (let i = 0; i < rects.length; i++) {
      if (g._hitRect(x, y, ...rects[i])) {
        const actual = panel.actual || {}
        MusicMgr.playStageChestReveal && MusicMgr.playStageChestReveal(actual.rarity, panel.chestKind)
        if (chestReward.reveal(state, i)) {
          if (g.storage && g.storage.recordFunnelEvent) {
            g.storage.recordFunnelEvent('stage_chest_pick', {
              stageId: panel.stageId,
              kind: panel.kind,
              selectedIdx: i,
            })
            g.storage.recordFunnelEvent('stage_chest_reward_reveal', {
              stageId: panel.stageId,
              kind: panel.kind,
              rewardKind: panel.actual && panel.actual.kind,
              rewardId: panel.actual && panel.actual.id,
            })
          }
        }
        g._dirty = true
        return true
      }
    }
    return true
  }
  if (state.state === 'revealed' && g._stageChestContinueRect && g._hitRect(x, y, ...g._stageChestContinueRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    if (g.storage && g.storage.recordFunnelEvent) {
      g.storage.recordFunnelEvent('stage_chest_continue', {
        stageId: panel.stageId,
        kind: panel.kind,
        panelIdx: state.panelIdx || 0,
      })
    }
    chestReward.nextPanelOrFinish(g)
    g._dirty = true
    return true
  }
  return true
}

module.exports = {
  drawStageChestReward,
  handleStageChestRewardTouch,
}
