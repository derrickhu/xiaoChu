/**
 * 每日签到 / 每日任务 — 两个独立弹窗
 * g._showDailySign / g._showDailyTasks
 */
const V = require('./env')
const { drawPanel, drawDivider } = require('./uiComponents')
const { CHECKIN_HUAHUA } = require('../data/constants')
const {
  LOGIN_CYCLE_DAYS,
  LOGIN_MILESTONE_PETS,
  CONSECUTIVE_CYCLE_DAYS,
  getConsecutiveLoginReward,
  DAILY_TASKS,
  getLoginMilestoneReward,
  getLoginPageData,
  getLoginPageIndex,
  getScaledDailyTaskReward,
  getScaledDailyAllBonus,
} = require('../data/giftConfig')
const { getPetById, getPetAvatarPath, getPetRarity } = require('../data/pets')
const MusicMgr = require('../runtime/music')
const AdManager = require('../adManager')
const { linesFromRewards } = require('./adRewardPopup')
const Particles = require('../engine/particles')
const _signRects = { closeBtnRect: null, signBtnRect: null, signAdRect: null, milestonePetRects: [] }
const _taskRects = { closeBtnRect: null, taskBtnRects: [], allBonusBtnRect: null, allBonusAdRect: null }

// ===== 里程碑奖励动画弹窗 =====
let _milestoneRewardPopup = null  // { timer, petId, petName, rewardType, rewardText, subText, btnRect }

/**
 * 触发里程碑奖励弹窗动画
 * @param {object} opts - { petId, petName, rewardType: 'pet'|'fragment'|'duplicate', rewardText, subText, sourceX, sourceY }
 */
function _showMilestoneRewardPopup(opts) {
  _milestoneRewardPopup = {
    timer: 0,
    petId: opts.petId,
    petName: opts.petName || '灵宠',
    rewardType: opts.rewardType || 'fragment',
    rewardText: opts.rewardText || '',
    subText: opts.subText || '',
    btnRect: null,
    sourceX: opts.sourceX || 0,
    sourceY: opts.sourceY || 0,
    sparkDone: false,
  }
}

/**
 * 绘制里程碑奖励弹窗（在签到弹窗之上叠加）
 */
function _drawMilestoneRewardPopup(g) {
  const p = _milestoneRewardPopup
  if (!p) return
  const { ctx: c, R, W, H } = V
  const S = W / 750

  p.timer++
  const timer = p.timer

  // 第1帧：从头像位置爆射金色粒子
  if (!p.sparkDone && timer === 1 && p.sourceX && p.sourceY) {
    Particles.burst({
      x: p.sourceX, y: p.sourceY,
      count: 18, speed: 5 * S, size: 6 * S, sizeEnd: 0,
      life: 28, gravity: 0.15 * S, drag: 0.96,
      colors: ['#FFD700', '#FFA000', '#FFEE58', '#FF6F00'],
      shape: 'star', spread: Math.PI * 2,
    })
    Particles.ring({
      x: p.sourceX, y: p.sourceY,
      count: 10, speed: 3.5 * S, size: 5 * S,
      life: 22, gravity: 0, drag: 0.95,
      colors: ['#FFD700', '#FFFFFF', '#FFC107'],
      shape: 'glow',
    })
    p.sparkDone = true
  }

  // 渐入效果
  const alpha = Math.min(1, timer / 14)

  c.save()

  // 暗色遮罩
  c.globalAlpha = alpha * 0.72
  c.fillStyle = 'rgba(10, 8, 2, 0.88)'
  c.fillRect(0, 0, W, H)
  c.globalAlpha = alpha

  // 面板尺寸
  const panelW = W * 0.82
  const avatarSz = 100 * S
  const panelH = 280 * S
  const px = (W - panelW) / 2
  const targetY = (H - panelH) / 2 - 20 * S
  // 弹入动画：从下方滑入 + 缩放
  const slideIn = timer < 16 ? targetY + 50 * S * (1 - timer / 16) : targetY
  const scale = timer < 13 ? 0.82 + 0.18 * Math.min(1, timer / 13) : 1
  // outBack 过冲回弹
  const bounceScale = timer < 20
    ? scale * (1 + 0.06 * Math.sin(timer * 0.5) * Math.max(0, 1 - timer / 20))
    : 1

  c.save()
  c.translate(W / 2, slideIn + panelH / 2)
  c.scale(bounceScale, bounceScale)
  c.translate(-W / 2, -(slideIn + panelH / 2))

  // 面板底板（复用 infoPanel 或手绘）
  const py = slideIn
  if (R.drawInfoPanel) {
    R.drawInfoPanel(px, py, panelW, panelH)
  } else {
    c.fillStyle = 'rgba(255, 248, 238, 0.96)'
    _rr(c, px, py, panelW, panelH, 18 * S)
    c.fill()
    c.strokeStyle = 'rgba(196, 165, 116, 0.9)'
    c.lineWidth = 2.5 * S
    _rr(c, px, py, panelW, panelH, 18 * S)
    c.stroke()
  }

  // ===== 旋转光环 =====
  const glowCY = py + 22 * S + avatarSz / 2
  c.save()
  c.translate(W / 2, glowCY)
  const rotAngle = (timer * 0.025) % (Math.PI * 2)
  c.rotate(rotAngle)
  const glowR = avatarSz * 0.72
  const glowGrad = c.createRadialGradient(0, 0, glowR * 0.3, 0, 0, glowR)
  glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.35)')
  glowGrad.addColorStop(0.6, 'rgba(255, 183, 0, 0.18)')
  glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)')
  c.fillStyle = glowGrad
  // 绘制光芒射线
  for (let i = 0; i < 12; i++) {
    c.save()
    c.rotate((i / 12) * Math.PI * 2)
    c.beginPath()
    c.moveTo(-4 * S, 0)
    c.lineTo(0, -glowR)
    c.lineTo(4 * S, 0)
    c.closePath()
    c.fillStyle = `rgba(255, 215, 0, ${0.12 + 0.06 * Math.sin(timer * 0.15 + i)})`
    c.fill()
    c.restore()
  }
  c.beginPath()
  c.arc(0, 0, glowR * 0.65, 0, Math.PI * 2)
  c.fillStyle = glowGrad
  c.fill()
  c.restore()

  // ===== 宠物头像（大图） =====
  const pet = getPetById(p.petId)
  const avatarPath = pet ? getPetAvatarPath({ ...pet, star: 1 }) : 'assets/pets/pet_f4.png'
  const avatarImg = R.getImg(avatarPath)
  const avX = W / 2 - avatarSz / 2
  const avY = py + 22 * S

  // 圆形裁剪
  c.save()
  c.beginPath()
  c.arc(W / 2, glowCY, avatarSz / 2, 0, Math.PI * 2)
  c.clip()
  if (avatarImg && avatarImg.width > 0) {
    c.drawImage(avatarImg, avX, avY, avatarSz, avatarSz)
  } else {
    c.fillStyle = '#FFD54F'
    c.fillRect(avX, avY, avatarSz, avatarSz)
  }
  c.restore()

  // 头像边框
  c.beginPath()
  c.arc(W / 2, glowCY, avatarSz / 2, 0, Math.PI * 2)
  c.strokeStyle = '#FFD700'
  c.lineWidth = 3 * S
  c.stroke()
  // 外层光晕边
  c.beginPath()
  c.arc(W / 2, glowCY, avatarSz / 2 + 3 * S, 0, Math.PI * 2)
  c.strokeStyle = 'rgba(255, 215, 0, 0.3)'
  c.lineWidth = 2 * S
  c.stroke()

  // ===== 品质徽标 =====
  const badgeText = p.rewardType === 'pet' ? 'SSR' : '碎片'
  const badgeBg = p.rewardType === 'pet' ? '#D32F2F' : '#6A1B9A'
  const badgeW = 46 * S
  const badgeH = 22 * S
  const badgeX = W / 2 - badgeW / 2
  const badgeY = avY + avatarSz - badgeH + 4 * S
  c.fillStyle = badgeBg
  _rr(c, badgeX, badgeY, badgeW, badgeH, 6 * S)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.6)'
  c.lineWidth = 1.5 * S
  _rr(c, badgeX, badgeY, badgeW, badgeH, 6 * S)
  c.stroke()
  c.fillStyle = '#FFFFFF'
  c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(badgeText, W / 2, badgeY + badgeH / 2)

  // ===== 奖励标题 =====
  const titleY = avY + avatarSz + 18 * S
  c.fillStyle = '#5A3000'
  c.font = `bold ${17 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(p.rewardText, W / 2, titleY)

  // ===== 副文案 =====
  if (p.subText) {
    c.fillStyle = '#8D7A5E'
    c.font = `${12 * S}px "PingFang SC",sans-serif`
    c.fillText(p.subText, W / 2, titleY + 24 * S)
  }

  // ===== 确认按钮 =====
  const btnW = panelW * 0.6
  const btnH = 38 * S
  const btnX = (W - btnW) / 2
  const btnY = py + panelH - 54 * S
  if (R.drawDialogBtn) {
    R.drawDialogBtn(btnX, btnY, btnW, btnH, '太好了！', 'adReward')
  } else {
    const btnGrd = c.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
    btnGrd.addColorStop(0, '#F6C56D')
    btnGrd.addColorStop(1, '#E08B4E')
    c.fillStyle = btnGrd
    _rr(c, btnX, btnY, btnW, btnH, btnH / 2)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
    c.fillText('太好了！', W / 2, btnY + btnH / 2)
  }
  p.btnRect = [btnX, btnY, btnW, btnH]

  c.restore() // bounceScale transform
  c.restore() // global alpha

  // 弹窗存在期间保持脏渲染（驱动粒子 + 旋转光环动画）
  if (typeof g.markDirty === 'function') g.markDirty()
  else g._dirty = true
}

/**
 * 处理里程碑奖励弹窗触摸
 * @returns {boolean} 是否吞掉触摸
 */
function _handleMilestoneRewardTouch(g, x, y, type) {
  if (!_milestoneRewardPopup) return false
  if (type !== 'end') return true // 吞掉非 end 触摸
  // 点击按钮或任意区域关闭
  _milestoneRewardPopup = null
  if (typeof g.markDirty === 'function') g.markDirty()
  else g._dirty = true
  return true
}

function _checkinTitleBannerMetrics(R, cardAreaW, u) {
  const img = R.getImg(CHECKIN_HUAHUA.titleBanner)
  const W = V.W
  if (img && img.width > 0) {
    const tw = Math.min(560 * u, W - 40 * u)
    const th = (img.height / img.width) * tw
    return { tw, th, hasImg: true }
  }
  return { tw: 0, th: 36 * u, hasImg: false }
}

function _rewardText(r) {
  const parts = []
  if (!r) return ''
  if (r.soulStone) parts.push(`灵石+${r.soulStone}`)
  if (r.fragment) parts.push(`碎片+${r.fragment}`)
  if (r.awakenStone) parts.push(`觉醒石+${r.awakenStone}`)
  if (r.stamina) parts.push(`体力+${r.stamina}`)
  if (r.petId) {
    const pet = getPetById(r.petId)
    parts.push(`${pet ? pet.name : '灵宠'}×1`)
  }
  const petFragment = r.petDuplicateFragment || r.petFragment
  if (petFragment && petFragment.petId && petFragment.count > 0) {
    const pet = getPetById(petFragment.petId)
    parts.push(`${pet ? pet.name : '灵宠'}碎片+${petFragment.count}`)
  }
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

function _primaryRewardVisual(rewards) {
  if (!rewards || Object.keys(rewards).length === 0) {
    return { kind: 'empty', mainText: '', subLine: '' }
  }
  if (rewards.petId) {
    const pet = getPetById(rewards.petId)
    return {
      kind: 'pet',
      petId: rewards.petId,
      mainText: 'SSR',
      subLine: pet ? pet.name : '灵宠',
    }
  }
  const fragReward = rewards.petDuplicateFragment || rewards.petFragment
  if (fragReward && fragReward.petId) {
    const pet = getPetById(fragReward.petId)
    return {
      kind: 'petFrag',
      petId: fragReward.petId,
      mainText: String(fragReward.count || 0),
      subLine: `${pet ? pet.name : '灵宠'}碎片`,
    }
  }
  if (rewards.soulStone) {
    const rest = []
    if (rewards.stamina) rest.push(`体力${rewards.stamina}`)
    if (rewards.fragment) rest.push(`碎×${rewards.fragment}`)
    if (rewards.awakenStone) rest.push(`觉×${rewards.awakenStone}`)
    if (fragReward && fragReward.petId) {
      const pet = getPetById(fragReward.petId)
      rest.push(`${pet ? pet.name : '灵宠'}碎片×${fragReward.count || 0}`)
    }
    return { kind: 'soul', mainText: String(rewards.soulStone), subLine: rest.join(' ') }
  }
  if (rewards.awakenStone) return { kind: 'awaken', mainText: String(rewards.awakenStone), subLine: '' }
  if (rewards.stamina) return { kind: 'stamina', mainText: String(rewards.stamina), subLine: '' }
  if (rewards.fragment) return { kind: 'frag', mainText: String(rewards.fragment), subLine: '' }
  return { kind: 'empty', mainText: '', subLine: '' }
}

function _getRewardSlots(rewards) {
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

/** 花华 CheckInPanel 风格：标题横幅（设计像素 × u，u=W/750） */
function _drawHuahuaCheckinTitle(c, R, cx, y0, cardAreaW, u) {
  const Hcfg = CHECKIN_HUAHUA
  const img = R.getImg(Hcfg.titleBanner)
  let y = y0
  if (img && img.width > 0) {
    y += (Hcfg.titleBannerOffsetYPt || 0) * u
    const { tw, th } = _checkinTitleBannerMetrics(R, cardAreaW, u)
    c.drawImage(img, cx - tw / 2, y, tw, th)
    const fs = Math.min(30 * u, Math.max(18 * u, tw * 0.055))
    c.font = `bold ${fs}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.lineWidth = Math.max(2, 4 * u)
    c.strokeStyle = 'rgba(109, 76, 65, 0.95)'
    const frac = Hcfg.titleTextYFrac != null ? Hcfg.titleTextYFrac : 0.72
    const ty = y + th * frac
    c.strokeText('每日奖励', cx, ty)
    c.fillStyle = '#FFFFFF'
    c.fillText('每日奖励', cx, ty)
    const advanceFrac = Hcfg.titleBannerAdvanceFrac != null ? Hcfg.titleBannerAdvanceFrac : 1
    y += th * advanceFrac + 2 * u
  } else {
    c.font = `bold ${28 * u}px "PingFang SC",sans-serif`
    c.fillStyle = '#fff'
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.fillText('每日奖励', cx, y)
    y += 36 * u
  }
  return y
}

/** 与 CheckInPanel._buildMilestoneBar 设计像素一致（× u）——SSR宠物头像版 */
function _drawHuahuaMilestoneBar(c, R, x, y, blockW, progressDays, u, milestoneClaimedSet) {
  const H = CHECKIN_HUAHUA
  const MAX_D = H.milestoneMaxDays
  const SIDE_PAD = 20 * u
  const INNER_TOP = 12 * u
  const GAP_GIFT_TO_TRACK = 12 * u
  const GAP_TRACK_TO_LABEL = 10 * u
  const INNER_BOTTOM = 14 * u
  const AVATAR_SZ = 52 * u
  const TRACK_H = 22 * u
  const MILESTONE_X_INSET = Math.max(30 * u, Math.ceil(AVATAR_SZ * 0.62))
  const trackW = blockW - SIDE_PAD * 2
  const trackLeft = x + SIDE_PAD
  const trackR = TRACK_H / 2
  const innerY = y + INNER_TOP
  const AVATAR_Y = innerY + AVATAR_SZ * 0.5 + 4 * u
  const trackTop = innerY + AVATAR_SZ + GAP_GIFT_TO_TRACK
  const labelTop = trackTop + TRACK_H + GAP_TRACK_TO_LABEL
  const blockH = (labelTop + 22 * u + INNER_BOTTOM) - y

  const panelImg = R.getImg(H.milestonePanel)
  if (panelImg && panelImg.width > 0) {
    c.drawImage(panelImg, x, y, blockW, blockH)
  } else {
    c.fillStyle = 'rgba(255, 248, 238, 0.92)'
    _rr(c, x, y, blockW, blockH, 18 * u)
    c.fill()
    c.strokeStyle = 'rgba(196, 165, 116, 0.9)'
    c.lineWidth = 2 * u
    _rr(c, x, y, blockW, blockH, 18 * u)
    c.stroke()
  }

  c.fillStyle = '#EEF6E8'
  _rr(c, trackLeft, trackTop, trackW, TRACK_H, trackR)
  c.fill()
  c.strokeStyle = 'rgba(206, 184, 168, 1)'
  c.lineWidth = 2 * u
  _rr(c, trackLeft, trackTop, trackW, TRACK_H, trackR)
  c.stroke()

  const fillRatio = Math.min(1, (progressDays || 0) / MAX_D)
  const fillW = Math.max(0, fillRatio * trackW)
  if (fillW > 1.5 * u) {
    const inset = 3 * u
    const fw = Math.max(0, fillW - inset * 2)
    c.fillStyle = '#8BC34A'
    _rr(c, trackLeft + inset, trackTop + inset, fw, TRACK_H - inset * 2, Math.max(4 * u, trackR - inset))
    c.fill()
    c.fillStyle = 'rgba(255, 255, 255, 0.22)'
    _rr(c, trackLeft + inset + 2 * u, trackTop + inset + u, Math.max(0, fw - 4 * u), (TRACK_H - inset * 2) * 0.35, 6 * u)
    c.fill()
  }

  // 清空里程碑宠物点击区域
  _signRects.milestonePetRects = []

  const mileSpan = Math.max(40 * u, trackW - MILESTONE_X_INSET * 2)
  const claimedSet = milestoneClaimedSet || new Set()

  H.milestoneThresholds.forEach((threshold, mi) => {
    const nodeX = trackLeft + MILESTONE_X_INSET + (threshold / MAX_D) * mileSpan
    const milestone = LOGIN_MILESTONE_PETS[mi]
    if (!milestone) return

    const pet = getPetById(milestone.petId)
    const avatarPath = pet ? getPetAvatarPath({ ...pet, star: 1 }) : H.specialPetIcon
    const avatarImg = R.getImg(avatarPath)

    const reached = progressDays >= threshold
    const claimed = claimedSet.has(threshold)
    const canClaim = reached && !claimed

    // 绘制宠物头像（圆形裁剪）
    c.save()
    const ax = nodeX - AVATAR_SZ / 2
    const ay = AVATAR_Y - AVATAR_SZ / 2
    const avatarR = AVATAR_SZ / 2

    // 高亮圈（可领取时发光）
    if (canClaim) {
      c.shadowColor = '#FFD700'
      c.shadowBlur = 12 * u
      c.beginPath()
      c.arc(nodeX, AVATAR_Y, avatarR + 3 * u, 0, Math.PI * 2)
      c.fillStyle = 'rgba(255, 215, 0, 0.4)'
      c.fill()
      c.shadowBlur = 0
    }

    // 圆形裁剪 + 绘制头像
    c.beginPath()
    c.arc(nodeX, AVATAR_Y, avatarR, 0, Math.PI * 2)
    c.clip()
    if (avatarImg && avatarImg.width > 0) {
      c.globalAlpha = reached ? 1 : 0.45
      c.drawImage(avatarImg, ax, ay, AVATAR_SZ, AVATAR_SZ)
      c.globalAlpha = 1
    } else {
      c.fillStyle = reached ? '#FFD54F' : '#BDBDBD'
      c.fillRect(ax, ay, AVATAR_SZ, AVATAR_SZ)
    }
    c.restore()

    // 圆形边框
    c.beginPath()
    c.arc(nodeX, AVATAR_Y, avatarR, 0, Math.PI * 2)
    c.strokeStyle = canClaim ? '#FFD700' : (reached ? '#E8A735' : 'rgba(180, 160, 130, 0.6)')
    c.lineWidth = canClaim ? 3 * u : 2 * u
    c.stroke()

    // 已领取标记 ✓
    if (claimed) {
      c.beginPath()
      c.arc(nodeX, AVATAR_Y, avatarR, 0, Math.PI * 2)
      c.fillStyle = 'rgba(27, 94, 32, 0.35)'
      c.fill()
      c.fillStyle = '#66BB6A'
      c.font = `bold ${22 * u}px sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('✓', nodeX, AVATAR_Y)
    }

    // 奖励标签（整宠/碎片数）
    const badgeText = milestone.type === 'pet' ? 'SSR' : `×${milestone.count}`
    const badgeW = c.measureText ? 0 : 0
    c.font = `bold ${10 * u}px "PingFang SC",sans-serif`
    const tw = 30 * u
    const th = 14 * u
    const bx = nodeX - tw / 2
    const by = AVATAR_Y + avatarR - th + 2 * u
    c.fillStyle = milestone.type === 'pet' ? '#D32F2F' : '#6A1B9A'
    _rr(c, bx, by, tw, th, 4 * u)
    c.fill()
    c.fillStyle = '#FFFFFF'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(badgeText, nodeX, by + th / 2)

    // 天数标签
    c.fillStyle = progressDays >= threshold ? '#4E342E' : '#8F7A63'
    c.font = `bold ${16 * u}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.lineWidth = 3 * u
    c.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    c.strokeText(`${threshold}天`, nodeX, labelTop)
    c.fillText(`${threshold}天`, nodeX, labelTop)

    // 记录点击区域
    _signRects.milestonePetRects.push({
      day: threshold,
      milestone,
      canClaim,
      rect: [ax - 4 * u, ay - 4 * u, AVATAR_SZ + 8 * u, AVATAR_SZ + 8 * u],
    })
  })

  return blockH + 10 * u
}

function _drawHuahuaRewardIconInCard(c, R, icx, icy, iconSz, vis, dayDone) {
  const a = dayDone ? 0.38 : 1
  let path = null
  if (vis.kind === 'soul') path = 'assets/ui/icon_soul_stone.png'
  else if (vis.kind === 'awaken') path = 'assets/ui/icon_awaken_stone.png'
  else if (vis.kind === 'stamina') path = 'assets/ui/icon_stamina.png'
  else if (vis.kind === 'frag') path = 'assets/ui/frame_fragment.png'
  else if ((vis.kind === 'pet' || vis.kind === 'petFrag') && vis.petId) {
    const pet = getPetById(vis.petId)
    path = pet ? getPetAvatarPath({ ...pet, star: 1 }) : CHECKIN_HUAHUA.specialPetIcon
  }
  if (!path) return
  const img = R.getImg(path)
  if (!img || img.width <= 0) return
  c.save()
  c.globalAlpha = a
  c.drawImage(img, icx - iconSz / 2, icy - iconSz / 2, iconSz, iconSz)
  c.restore()
}

function _drawHuahuaWideSlots(c, R, rewards, x, y, w, h, dayDone, u) {
  const slots = _getRewardSlots(rewards)
  if (!slots.length) return
  const a = dayDone ? 0.38 : 1
  const n = slots.length
  const spacing = n === 1 ? 0 : (n === 2 ? 122 * u : 88 * u)
  const iconSz = n >= 3 ? 40 * u : 46 * u
  const startCX = x + w / 2 - ((n - 1) * spacing) / 2
  const iconCY = y + h * 0.52

  slots.forEach((slot, idx) => {
    const cx = startCX + idx * spacing
    const img = R.getImg(slot.tex)
    if (img && img.width > 0) {
      c.save()
      c.globalAlpha = a
      c.drawImage(img, cx - iconSz / 2, iconCY - iconSz / 2, iconSz, iconSz)
      c.restore()
    }
    const lineY = iconCY + iconSz / 2 + 4 * u
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.font = `bold ${slot.line.length > 3 ? 11 * u : 14 * u}px "PingFang SC",sans-serif`
    c.fillStyle = dayDone ? '#BDBDBD' : '#3E2723'
    c.fillText(slot.line, cx, lineY)
    if (slot.subLine) {
      c.font = `${9 * u}px "PingFang SC",sans-serif`
      c.fillStyle = dayDone ? 'rgba(235,235,235,0.85)' : 'rgba(255,255,255,0.92)'
      c.fillText(slot.subLine, cx, lineY + 16 * u)
    }
  })
}

function _drawHuahuaDayCard(c, R, opts, u) {
  const H = CHECKIN_HUAHUA
  const {
    x, y, w, h,
    titleText,
    vis,
    dayDone,
    isToday,
    highlight,
    rewards,
  } = opts

  const texKey = highlight
    ? H.cardHighlight
    : dayDone
      ? H.cardSigned
      : isToday
        ? H.cardToday
        : H.cardFuture
  const cardImg = R.getImg(texKey)
  const rr = 14 * u
  if (cardImg && cardImg.width > 0) {
    c.drawImage(cardImg, x, y, w, h)
  } else {
    c.fillStyle = dayDone ? 'rgba(46, 125, 50, 0.45)' : isToday ? 'rgba(93, 64, 55, 0.4)' : 'rgba(55, 71, 79, 0.38)'
    _rr(c, x, y, w, h, rr)
    c.fill()
  }

  c.font = `bold ${(highlight ? 20 : 18) * u}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'top'
  c.lineWidth = 4 * u
  c.strokeStyle = 'rgba(62, 39, 35, 0.95)'
  const titleY = y + 7 * u
  c.strokeText(titleText, x + w / 2, titleY)
  c.fillStyle = '#FFFFFF'
  c.fillText(titleText, x + w / 2, titleY)

  const showWideRewards = !!(highlight && rewards && _getRewardSlots(rewards).length)
  const contentCY = y + h / 2 + 10 * u
  const icx = x + w / 2
  let iconSzForSub = 52 * u

  if (showWideRewards) {
    _drawHuahuaWideSlots(c, R, rewards, x, y, w, h, dayDone, u)
  } else {
    const ICON_SZ = (highlight ? 48 : 52) * u
    iconSzForSub = ICON_SZ
    const icy = contentCY - 8 * u
    _drawHuahuaRewardIconInCard(c, R, icx, icy, ICON_SZ, vis, dayDone)
    if (vis.mainText) {
      const amtStr = (vis.kind === 'pet' ? vis.mainText : `×${vis.mainText}`)
      const amtFs = vis.kind === 'pet' ? 13 * u : 16 * u
      c.font = `bold ${amtFs}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.lineWidth = 3 * u
      c.strokeStyle = dayDone ? 'transparent' : 'rgba(255, 255, 255, 0.95)'
      const amtY = contentCY + ICON_SZ / 2 - 4 * u
      if (!dayDone) c.strokeText(amtStr, icx, amtY)
      c.fillStyle = dayDone ? '#AAAAAA' : '#3E2723'
      c.fillText(amtStr, icx, amtY)
    }
  }

  if (vis.subLine && !showWideRewards) {
    c.fillStyle = dayDone ? 'rgba(220, 220, 220, 0.9)' : 'rgba(255, 255, 255, 0.92)'
    c.font = `${10 * u}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'top'
    const subY = highlight ? y + h * 0.78 : contentCY + iconSzForSub * 0.5
    c.fillText(vis.subLine, icx, Math.min(subY, y + h - 12 * u))
  }

  if (dayDone) {
    c.fillStyle = 'rgba(27, 94, 32, 0.18)'
    _rr(c, x, y, w, h, rr)
    c.fill()
    c.fillStyle = '#66BB6A'
    c.font = `bold ${(highlight ? 30 : 24) * u}px sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('√', x + w / 2, y + h / 2 - 6 * u)
  }
}

function _drawHuahuaPillButton(c, R, opts, u) {
  const {
    cx, y, w, h,
    label,
    enabled,
    tone,
    outRect,
    showBadges,
  } = opts
  const bx = cx - w / 2
  const by = y
  if (enabled && tone === 'orange') {
    const btnImg = R.getImg(CHECKIN_HUAHUA.btnOrange)
    if (btnImg && btnImg.width > 0) {
      c.drawImage(btnImg, bx, by, w, h)
    } else {
      const grd = c.createLinearGradient(bx, by, bx, by + h)
      grd.addColorStop(0, '#F6C56D')
      grd.addColorStop(1, '#E08B4E')
      c.fillStyle = grd
      _rr(c, bx, by, w, h, h / 2)
      c.fill()
    }
  } else {
    const colorMap = tone === 'green'
      ? ['#A8D56A', '#6FB44A']
      : tone === 'done'
        ? ['#B6B0A5', '#8D867C']
        : ['#A68D74', '#8A725B']
    const grd = c.createLinearGradient(bx, by, bx, by + h)
    grd.addColorStop(0, colorMap[0])
    grd.addColorStop(1, colorMap[1])
    c.fillStyle = grd
    _rr(c, bx, by, w, h, h / 2)
    c.fill()
    c.strokeStyle = enabled ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.24)'
    c.lineWidth = 2 * u
    _rr(c, bx, by, w, h, h / 2)
    c.stroke()
  }

  c.font = `bold ${18 * u}px "PingFang SC",sans-serif`
  c.fillStyle = enabled || tone === 'orange' ? '#FFFFFF' : '#F2ECE3'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, cx, by + h / 2)

  if (outRect) {
    outRect[0] = bx
    outRect[1] = by
    outRect[2] = w
    outRect[3] = h
  }
}

function _drawStageTag(c, x, y, w, h, label, u) {
  const grd = c.createLinearGradient(x, y, x, y + h)
  grd.addColorStop(0, 'rgba(246, 197, 109, 0.92)')
  grd.addColorStop(1, 'rgba(224, 162, 76, 0.92)')
  c.fillStyle = grd
  _rr(c, x, y, w, h, h / 2)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.4)'
  c.lineWidth = 1.5 * u
  _rr(c, x, y, w, h, h / 2)
  c.stroke()
  c.fillStyle = '#5A3000'
  c.font = `bold ${12 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, x + w / 2, y + h / 2)
}

function _buildLoginRenderState(sign, canSign) {
  const totalDays = sign.totalSignDays || 0
  const progressDays = canSign ? (totalDays % LOGIN_CYCLE_DAYS) : (sign.day || 0)
  const previewDay = canSign ? Math.min(LOGIN_CYCLE_DAYS, progressDays + 1) : Math.max(1, sign.day || 1)
  const displayIsNewbie = canSign ? totalDays < LOGIN_CYCLE_DAYS : totalDays <= LOGIN_CYCLE_DAYS
  const pageIndex = getLoginPageIndex(previewDay)
  const pageData = getLoginPageData(pageIndex, displayIsNewbie)
  return {
    totalDays,
    progressDays,
    previewDay,
    displayIsNewbie,
    pageIndex,
    pageData,
    milestoneReward: getLoginMilestoneReward(displayIsNewbie),
  }
}

function rDailySign(g) {
  if (!g._showDailySign) return
  const { ctx: c, R, W, H } = V
  const Hcfg = CHECKIN_HUAHUA

  _signRects.signBtnRect = null
  _signRects.signAdRect = null

  c.save()
  c.fillStyle = `rgba(0,0,0,${Hcfg.maskAlpha})`
  c.fillRect(0, 0, W, H)

  const u = W / Hcfg.designWidth
  const cardAreaW = Math.min(Hcfg.cardAreaWDesign * u, Math.max(160, W - 16))
  const cardAreaX = (W - cardAreaW) / 2
  const gap = Hcfg.cardGapDesign * u
  const cellW = Math.floor((cardAreaW - gap * 2) / 3)
  const cellH = Hcfg.cardHDesign * u
  const featureH = Hcfg.highlightCardHDesign * u
  const finaleBonusH = Hcfg.finaleBonusHDesign * u

  const EST_H = Hcfg.estimatedContentHDesign * u
  let startY = Math.max(36 * u, (H - EST_H) / 2)
  const safeTop = (V.safeTop || 0) + 12 * u
  const safeBot = H - 24 * u
  const maxStart = Math.max(safeTop, safeBot - EST_H)
  startY = Math.max(safeTop, Math.min(maxStart, startY))
  let y = startY

  const closeR = 16 * u
  const closeX = W - 22 * u
  const closeY = startY + 8 * u
  c.fillStyle = 'rgba(255,255,255,0.2)'
  c.beginPath()
  c.arc(closeX, closeY, closeR, 0, Math.PI * 2)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.45)'
  c.lineWidth = 1.5 * u
  c.beginPath()
  c.arc(closeX, closeY, closeR, 0, Math.PI * 2)
  c.stroke()
  c.fillStyle = '#FFFFFF'
  c.font = `bold ${15 * u}px sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('✕', closeX, closeY)
  _signRects.closeBtnRect = [closeX - closeR, closeY - closeR, closeR * 2, closeR * 2]


  y = _drawHuahuaCheckinTitle(c, R, W / 2, y, cardAreaW, u)

  const sign = g.storage.loginSign
  const canSign = g.storage.canSignToday
  const renderState = _buildLoginRenderState(sign, canSign)
  const pageData = renderState.pageData
  const subtitle = [
    `累计签到 ${renderState.totalDays} 天`,
    `当前轮第 ${renderState.previewDay}/${LOGIN_CYCLE_DAYS} 天`,
  ]
  y += 2 * u
  c.fillStyle = '#E0E0E0'
  c.font = `bold ${16 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'top'
  c.fillText(subtitle.join('  ·  '), W / 2, y)
  y += 24 * u

  // 里程碑已领取状态
  const milestoneClaimed = new Set(
    (g.storage._d.loginSign && g.storage._d.loginSign.milestonePetClaimed) || []
  )
  y += _drawHuahuaMilestoneBar(c, R, cardAreaX, y, cardAreaW, renderState.progressDays, u, milestoneClaimed)

  const stageLabel = pageData.isFinale ? '终章奖励' : `第${pageData.startDay}-${pageData.endDay}天`
  _drawStageTag(c, W / 2 - 58 * u, y + 2 * u, 116 * u, 24 * u, stageLabel, u)
  y += 34 * u

  if (!pageData.isFinale) {
    const normalRewards = pageData.rewards.slice(0, 6)
    const featureReward = pageData.rewards[6]
    const gridTop = y
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const item = normalRewards[row * 3 + col]
        if (!item) continue
        const rx = cardAreaX + col * (cellW + gap)
        const ry = gridTop + row * (cellH + gap)
        const dayDone = item.day <= renderState.progressDays
        const isToday = canSign && item.day === renderState.previewDay
        _drawHuahuaDayCard(c, R, {
          x: rx,
          y: ry,
          w: cellW,
          h: cellH,
          titleText: isToday ? '今天' : `第${item.day}天`,
          vis: _primaryRewardVisual(item.rewards),
          dayDone,
          isToday,
          highlight: false,
          rewards: item.rewards,
        }, u)
      }
    }
    const featureY = gridTop + 2 * (cellH + gap)
    if (featureReward) {
      const featureDone = featureReward.day <= renderState.progressDays
      const featureToday = canSign && featureReward.day === renderState.previewDay
      _drawHuahuaDayCard(c, R, {
        x: cardAreaX,
        y: featureY,
        w: cardAreaW,
        h: featureH,
        titleText: featureToday ? '今天' : `第${featureReward.day}天`,
        vis: _primaryRewardVisual(featureReward.rewards),
        dayDone: featureDone,
        isToday: featureToday,
        highlight: true,
        rewards: featureReward.rewards,
      }, u)
    }
    y = featureY + featureH + 18 * u
  } else {
    const topW = Math.floor((cardAreaW - gap) / 2)
    const topH = cellH
    const item29 = pageData.rewards[0]
    const item30 = pageData.rewards[1]
    const topY = y
    if (item29) {
      _drawHuahuaDayCard(c, R, {
        x: cardAreaX,
        y: topY,
        w: topW,
        h: topH,
        titleText: canSign && item29.day === renderState.previewDay ? '今天' : `第${item29.day}天`,
        vis: _primaryRewardVisual(item29.rewards),
        dayDone: item29.day <= renderState.progressDays,
        isToday: canSign && item29.day === renderState.previewDay,
        highlight: false,
        rewards: item29.rewards,
      }, u)
    }
    if (item30) {
      _drawHuahuaDayCard(c, R, {
        x: cardAreaX + topW + gap,
        y: topY,
        w: topW,
        h: topH,
        titleText: canSign && item30.day === renderState.previewDay ? '今天' : `第${item30.day}天`,
        vis: _primaryRewardVisual(item30.rewards),
        dayDone: item30.day <= renderState.progressDays,
        isToday: canSign && item30.day === renderState.previewDay,
        highlight: false,
        rewards: item30.rewards,
      }, u)
    }
    const milestoneY = topY + topH + gap
    _drawHuahuaDayCard(c, R, {
      x: cardAreaX,
      y: milestoneY,
      w: cardAreaW,
      h: finaleBonusH,
      titleText: '30天达成',
      vis: _primaryRewardVisual(renderState.milestoneReward),
      dayDone: renderState.progressDays >= LOGIN_CYCLE_DAYS,
      isToday: canSign && renderState.previewDay === LOGIN_CYCLE_DAYS,
      highlight: true,
      rewards: renderState.milestoneReward,
    }, u)
    y = milestoneY + finaleBonusH + 18 * u
  }

  // ── 7天连续登录循环区 ──
  const consecState = g.storage.consecutiveLoginState
  const consecCurrent = canSign ? consecState.previewDay : (consecState.currentDay || 0)
  const consecCycleDays = consecState.cycleDays || CONSECUTIVE_CYCLE_DAYS

  _drawStageTag(c, W / 2 - 72 * u, y + 2 * u, 144 * u, 24 * u, `连续登录 (${consecCurrent}/${consecCycleDays})`, u)
  y += 34 * u

  // 绘制7个小卡片（一行7列，紧凑布局）
  const consecGap = 6 * u
  const consecCellW = Math.floor((cardAreaW - consecGap * 6) / 7)
  const consecCellH = 78 * u
  const consecGridTop = y

  for (let di = 0; di < consecCycleDays; di++) {
    const dayNum = di + 1
    const consecReward = getConsecutiveLoginReward(dayNum)
    const cx = cardAreaX + di * (consecCellW + consecGap)
    const cy = consecGridTop

    // 判断状态
    const isDone = !canSign && dayNum <= (consecState.currentDay || 0)
    const isPreview = canSign && dayNum === consecState.previewDay
    const isFuture = canSign ? dayNum > consecState.previewDay : dayNum > (consecState.currentDay || 0)

    // 背景
    const texKey = isDone ? Hcfg.cardSigned : isPreview ? Hcfg.cardToday : Hcfg.cardFuture
    const cardImg = R.getImg(texKey)
    const crr = 8 * u
    if (cardImg && cardImg.width > 0) {
      c.drawImage(cardImg, cx, cy, consecCellW, consecCellH)
    } else {
      c.fillStyle = isDone ? 'rgba(46,125,50,0.4)' : isPreview ? 'rgba(93,64,55,0.4)' : 'rgba(55,71,79,0.35)'
      _rr(c, cx, cy, consecCellW, consecCellH, crr)
      c.fill()
    }

    // 标题「第N天」
    c.font = `bold ${10 * u}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.lineWidth = 2 * u
    c.strokeStyle = 'rgba(62,39,35,0.9)'
    c.strokeText(`第${dayNum}天`, cx + consecCellW / 2, cy + 4 * u)
    c.fillStyle = '#FFFFFF'
    c.fillText(`第${dayNum}天`, cx + consecCellW / 2, cy + 4 * u)

    // 奖励图标（灵石+体力双行显示）
    const rewards = consecReward ? consecReward.rewards : {}
    const iconSz = 18 * u
    const centerX = cx + consecCellW / 2
    let iy = cy + 20 * u

    if (rewards.soulStone) {
      const ssImg = R.getImg('assets/ui/icon_soul_stone.png')
      if (ssImg && ssImg.width > 0) {
        c.save()
        c.globalAlpha = isDone ? 0.4 : 1
        c.drawImage(ssImg, centerX - iconSz / 2, iy, iconSz, iconSz)
        c.restore()
      }
      c.font = `bold ${8 * u}px "PingFang SC",sans-serif`
      c.fillStyle = isDone ? '#AAAAAA' : '#3E2723'
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.fillText(`${rewards.soulStone}`, centerX, iy + iconSz + 1 * u)
      iy += iconSz + 10 * u
    }
    if (rewards.stamina) {
      const stImg = R.getImg('assets/ui/icon_stamina.png')
      if (stImg && stImg.width > 0) {
        c.save()
        c.globalAlpha = isDone ? 0.4 : 1
        c.drawImage(stImg, centerX - iconSz * 0.4, iy, iconSz * 0.8, iconSz * 0.8)
        c.restore()
      }
      c.font = `bold ${7 * u}px "PingFang SC",sans-serif`
      c.fillStyle = isDone ? '#AAAAAA' : '#3E2723'
      c.textAlign = 'center'
      c.textBaseline = 'top'
      c.fillText(`+${rewards.stamina}`, centerX, iy + iconSz * 0.8 + 1 * u)
    }

    // 已领取对勾
    if (isDone) {
      c.fillStyle = 'rgba(27,94,32,0.18)'
      _rr(c, cx, cy, consecCellW, consecCellH, crr)
      c.fill()
      c.fillStyle = '#66BB6A'
      c.font = `bold ${18 * u}px sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('√', cx + consecCellW / 2, cy + consecCellH / 2)
    }
  }
  y = consecGridTop + consecCellH + 14 * u

  // ── 单按钮：签到 → 看广告翻倍 → 全部领完 ──
  const doubleState = g.storage.loginRewardDoubleState
  const adAvailable = AdManager.canShow('signDouble')
  const canDouble = !canSign && doubleState.eligible && adAvailable
  const adLimitReached = !canSign && doubleState.eligible && !adAvailable
  const btnRect = [0, 0, 0, 0]

  let btnLabel, btnTone, btnEnabled, btnShowBadges, hintText
  if (canSign) {
    // 状态1：今天还没签到
    btnLabel = '签到领取'
    btnTone = 'orange'
    btnEnabled = true
    btnShowBadges = false
    hintText = '签到后可观看视频再领一份'
  } else if (canDouble) {
    // 状态2：已签到，可看广告翻倍
    btnLabel = '看视频再领一份'
    btnTone = 'green'
    btnEnabled = true
    btnShowBadges = true
    hintText = '观看视频后额外领取一份当日资源奖励'
  } else if (adLimitReached) {
    // 状态3：已签到，广告次数用完
    btnLabel = '今日次数已满'
    btnTone = 'locked'
    btnEnabled = false
    btnShowBadges = false
    hintText = '今日翻倍视频次数已用完，请明日再来'
  } else if (doubleState.claimed) {
    // 状态4：已签到 + 已翻倍
    btnLabel = '奖励已领满'
    btnTone = 'done'
    btnEnabled = false
    btnShowBadges = false
    hintText = '今日签到及翻倍奖励已全部领取'
  } else {
    // 状态5：已签到，没有可翻倍资源（如30天达成奖励等不参与翻倍的情况）
    btnLabel = '今日已签到'
    btnTone = 'done'
    btnEnabled = false
    btnShowBadges = false
    hintText = '整宠与30天达成奖励不参与翻倍'
  }

  _drawHuahuaPillButton(c, R, {
    cx: W / 2,
    y,
    w: 280 * u,
    h: 52 * u,
    label: btnLabel,
    enabled: btnEnabled,
    tone: btnTone,
    outRect: btnRect,
    showBadges: btnShowBadges,
  }, u)
  // 签到和翻倍共用同一个按钮区域
  _signRects.signBtnRect = canSign ? btnRect.slice() : null
  _signRects.signAdRect = canDouble ? btnRect.slice() : null
  y += 64 * u

  c.fillStyle = 'rgba(255,255,255,0.88)'
  c.font = `${10 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'top'
  c.fillText(hintText, W / 2, y)

  c.restore()

  // 里程碑奖励动画弹窗（在签到遮罩之上叠加）
  if (_milestoneRewardPopup) {
    _drawMilestoneRewardPopup(g)
    // 粒子在弹窗之上再绘制一层（主循环的 Particles.draw 在 rDailySign 外，被弹窗遮挡）
    Particles.draw(V.ctx)
  }
}

function rDailyTasks(g) {
  if (!g._showDailyTasks) return
  const { ctx: c, R, W, H, S } = V

  c.save()
  c.fillStyle = 'rgba(0,0,0,0.55)'
  c.fillRect(0, 0, W, H)

  const pw = W * 0.9, ph = H * 0.84
  const px = (W - pw) / 2, py = (H - ph) / 2 - 6 * S
  const pad = 16 * S
  const ribbonH = 44 * S
  const panelResult = drawPanel(c, S, px, py, pw, ph, { ribbonH })
  const ribbonCY = panelResult.ribbonCY

  c.fillStyle = '#5a3000'
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('任务', W / 2, ribbonCY)

  const closeR = 14 * S
  const closeX = px + pw - 20 * S, closeY = py + ribbonH / 2
  c.fillStyle = 'rgba(120,80,20,0.15)'
  c.beginPath(); c.arc(closeX, closeY, closeR, 0, Math.PI * 2); c.fill()
  c.strokeStyle = 'rgba(175,135,48,0.4)'; c.lineWidth = 1 * S
  c.beginPath(); c.arc(closeX, closeY, closeR, 0, Math.PI * 2); c.stroke()
  c.fillStyle = '#8B6914'; c.font = `bold ${13*S}px sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('✕', closeX, closeY)
  _taskRects.closeBtnRect = [closeX - closeR, closeY - closeR, closeR * 2, closeR * 2]

  let cy = py + ribbonH + 14 * S
  const innerL = px + pad, innerR = px + pw - pad, innerW = pw - pad * 2

  const prog = g.storage.dailyTaskProgress
  const _ch = g.storage.currentChapter
  _taskRects.taskBtnRects = []

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
      _taskRects.taskBtnRects.push({ id: task.id, rect: [tbX, tbY, tbW, tbH] })
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

  _taskRects.allBonusAdRect = null
  if (allDone && !allClaimed) {
    const abW = pw * 0.7, abH = 30 * S, abX = (W - abW) / 2
    R.drawDialogBtn(abX, cy, abW, abH, `全部完成：${_rewardText(getScaledDailyAllBonus(_ch))}`, 'confirm')
    _taskRects.allBonusBtnRect = [abX, cy, abW, abH]
  } else if (allClaimed) {
    c.fillStyle = '#4CAF50'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('✓ 今日任务全部完成', W / 2, cy + 12 * S)
    _taskRects.allBonusBtnRect = null
    if (!g._dailyTaskDoubled && AdManager.canShow('dailyTaskBonus')) {
      const adW = 72 * S, adH = 24 * S
      const adX = W / 2 + 80 * S, adY = cy + 12 * S - adH / 2
      R.drawDialogBtn(adX, adY, adW, adH, '▶ 翻倍', 'adReward')
      _taskRects.allBonusAdRect = [adX, adY, adW, adH]
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
    _taskRects.allBonusBtnRect = null
  }

  c.restore()
}

function tDailySign(g, x, y, type) {
  if (!g._showDailySign || type !== 'end') return false

  // 里程碑奖励弹窗（最高优先级，覆盖所有其他触摸）
  if (_milestoneRewardPopup) {
    return _handleMilestoneRewardTouch(g, x, y, type)
  }

  if (_signRects.closeBtnRect && g._hitRect(x, y, ..._signRects.closeBtnRect)) {
    g._showDailySign = false
    MusicMgr.playClick && MusicMgr.playClick()
    return true
  }

  // 里程碑宠物头像点击领取
  for (const mp of _signRects.milestonePetRects) {
    if (g._hitRect(x, y, ...mp.rect)) {
      if (mp.canClaim) {
        const result = g.storage.claimMilestonePet(mp.day)
        if (result && result.success) {
          MusicMgr.playReward && MusicMgr.playReward()
          const pet = getPetById(mp.milestone.petId)
          const petName = pet ? pet.name : '灵宠'
          // 计算头像中心坐标（从 milestonePetRects 的 rect 推算）
          const srcX = mp.rect[0] + mp.rect[2] / 2
          const srcY = mp.rect[1] + mp.rect[3] / 2
          let rewardType = 'fragment'
          let rewardText = ''
          let subText = ''
          if (result.reward.petId) {
            rewardType = 'pet'
            rewardText = `恭喜获得SSR灵宠【${petName}】！`
            subText = '签到里程碑奖励'
          } else if (result.reward.petDuplicateFragment) {
            rewardType = 'duplicate'
            rewardText = `获得【${petName}】碎片 ×${result.reward.petDuplicateFragment.count}`
            subText = `已拥有该灵宠，转化为碎片`
          } else if (result.reward.petFragment) {
            rewardType = 'fragment'
            rewardText = `获得【${petName}】碎片 ×${result.reward.petFragment.count}`
            subText = '签到里程碑奖励'
          }
          _showMilestoneRewardPopup({
            petId: mp.milestone.petId,
            petName,
            rewardType,
            rewardText,
            subText,
            sourceX: srcX,
            sourceY: srcY,
          })
          if (typeof g.markDirty === 'function') g.markDirty()
          else g._dirty = true
        } else if (result) {
          const P = require('../platform')
          P.showGameToast(result.message)
        }
      } else {
        // 点击了不可领取的里程碑（未达到或已领取）
        const P = require('../platform')
        const claimed = g.storage._d.loginSign && g.storage._d.loginSign.milestonePetClaimed
          && g.storage._d.loginSign.milestonePetClaimed.includes(mp.day)
        if (claimed) {
          P.showGameToast('该里程碑奖励已领取')
        } else {
          P.showGameToast(`累计签到${mp.day}天后可领取`)
        }
      }
      return true
    }
  }  if (_signRects.signBtnRect && g._hitRect(x, y, ..._signRects.signBtnRect)) {
    const result = g.storage.claimLoginReward()
    if (result) {
      MusicMgr.playReward && MusicMgr.playReward()
      const rewardText = _rewardText(result.rewards)
      const milestoneText = result.milestoneRewards ? _rewardText(result.milestoneRewards) : ''
      const consecText = result.consecutiveRewards ? _rewardText(result.consecutiveRewards) : ''
      let msg = `签到第${result.day}天：${rewardText}`
      if (consecText) msg += ` · 连续第${result.consecutiveDay}天：${consecText}`
      if (milestoneText) msg += ` · 30天达成：${milestoneText}`
      g._toast && g._toast(msg)
      if (typeof g.markDirty === 'function') g.markDirty()
      else g._dirty = true
    }
    return true
  }

  if (_signRects.signAdRect && g._hitRect(x, y, ..._signRects.signAdRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('signDouble', {
      fallbackToShare: true,
      onRewarded: () => {
        const result = g.storage.claimLoginAdDouble()
        if (result) {
          MusicMgr.playReward && MusicMgr.playReward()
          g._toast && g._toast(`翻倍到账：${_rewardText(result.rewards)}`)
        }
        g._dirty = true
      },
      rewardPopup: () => {
        const state = g.storage.loginRewardDoubleState
        const lines = linesFromRewards(state.pendingRewards)
        if (!lines.length) return null
        return { title: '签到奖励翻倍', subtitle: '以下为额外领取的一份', lines }
      },
    })
    return true
  }

  return true
}

function tDailyTasks(g, x, y, type) {
  if (!g._showDailyTasks || type !== 'end') return false

  if (_taskRects.closeBtnRect && g._hitRect(x, y, ..._taskRects.closeBtnRect)) {
    g._showDailyTasks = false
    MusicMgr.playClick && MusicMgr.playClick()
    return true
  }

  const _tch = g.storage.currentChapter
  for (const tb of _taskRects.taskBtnRects) {
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

  if (_taskRects.allBonusBtnRect && g._hitRect(x, y, ..._taskRects.allBonusBtnRect)) {
    const ok = g.storage.claimDailyAllBonus()
    if (ok) {
      MusicMgr.playReward && MusicMgr.playReward()
      g._toast && g._toast(`全部完成额外奖励：${_rewardText(getScaledDailyAllBonus(_tch))}`)
    }
    return true
  }

  if (_taskRects.allBonusAdRect && g._hitRect(x, y, ..._taskRects.allBonusAdRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('dailyTaskBonus', {
      fallbackToShare: true,
      onRewarded: () => {
        const bonus = getScaledDailyAllBonus(_tch)
        if (bonus.soulStone) g.storage.addSoulStone(bonus.soulStone)
        if (bonus.fragment) g.storage.addRandomFragments(bonus.fragment)
        g._dailyTaskDoubled = true
        g._dirty = true
      },
      rewardPopup: () => {
        const bonus = getScaledDailyAllBonus(_tch)
        const lines = linesFromRewards(bonus)
        if (!lines.length) return null
        return { title: '全勤奖励翻倍', subtitle: '以下为额外领取的一份', lines }
      },
    })
    return true
  }

  return true
}

module.exports = { rDailySign, tDailySign, rDailyTasks, tDailyTasks }
