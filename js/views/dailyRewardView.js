/**
 * 每日签到 / 每日任务 — 两个独立弹窗
 * g._showDailySign / g._showDailyTasks
 */
const V = require('./env')
const { drawPanel, drawDivider } = require('./uiComponents')
const { CHECKIN_HUAHUA, DAILY_TASK_PANEL_MIN_TOP_BELOW_SAFE_PT } = require('../data/constants')
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
const buttonFx = require('./buttonFx')
const {
  getRewardSlots,
  layoutRewardSlotChips,
  drawRewardSlotChips,
  shouldSkipStaticRewardChips,
  startRewardChipFlyAnim,
  drawRewardChipFlyLayer,
} = require('./rewardChipFlyAnim')
const _signRects = { closeBtnRect: null, signBtnRect: null, signAdRect: null, milestonePetRects: [] }
const _taskRects = {
  closeBtnRect: null,
  taskBtnRects: [],
  allBonusBtnRect: null,
  allBonusAdRect: null,
  tabDailyRect: null,
  tabAchievementRect: null,
}

// 任务分类竹牌文字（对应 DAILY_TASKS 六项）
const _TASK_TAG_BY_ID = {
  battle_1: '秘境',
  battle_3: '征战',
  tower_1: '通天',
  idle_collect: '派遣',
  pet_feed: '育灵',
  share_1: '传音',
}

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

function _compactExtraRewardText(rewards) {
  if (!rewards) return ''
  if (rewards.stamina) return `体力+${rewards.stamina}`
  if (rewards.awakenStone) return `觉醒石+${rewards.awakenStone}`
  if (rewards.fragment) return `碎片+${rewards.fragment}`
  const petFragment = rewards.petDuplicateFragment || rewards.petFragment
  if (petFragment && petFragment.petId && petFragment.count > 0) {
    const pet = getPetById(petFragment.petId)
    return `${pet ? pet.name : '灵宠'}碎片+${petFragment.count}`
  }
  return ''
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

function _drawTaskStatusPill(c, x, cy, text, tone, u) {
  let fill = 'rgba(233,223,201,0.78)'
  let stroke = 'rgba(176,150,122,0.20)'
  let color = '#9A7B55'
  if (tone === 'ready') {
    fill = 'rgba(247,234,185,0.90)'
    stroke = 'rgba(206,163,42,0.30)'
    color = '#8B6914'
  } else if (tone === 'claimed') {
    fill = 'rgba(222,241,225,0.92)'
    stroke = 'rgba(84,160,92,0.25)'
    color = '#39884A'
  }

  c.save()
  c.font = `bold ${7 * u}px "PingFang SC",sans-serif`
  const padX = 5.5 * u
  const h = 12 * u
  const w = Math.max(36 * u, c.measureText(text).width + padX * 2)
  const y = cy - h / 2
  c.fillStyle = fill
  _rr(c, x, y, w, h, h / 2)
  c.fill()
  c.strokeStyle = stroke
  c.lineWidth = Math.max(0.5, 0.8 * u)
  _rr(c, x, y, w, h, h / 2)
  c.stroke()
  c.fillStyle = color
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, x + w / 2, cy + 0.2 * u)
  c.restore()
  return w
}

// ===== 任务弹窗·修仙风视觉件 =====

// 修仙山水云雾背景（取代纯黑半透遮罩）：Canvas 纯手绘，CDN 背景图没加载也保证效果
function _drawTaskPanelBackdrop(c, W, H) {
  // 主体天空：顶部偏冷白、底部偏深青
  const sky = c.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, '#B7CBD1')
  sky.addColorStop(0.48, '#88A1AB')
  sky.addColorStop(1, '#4D646E')
  c.fillStyle = sky
  c.fillRect(0, 0, W, H)

  // 两团径向云雾
  c.save()
  c.globalAlpha = 0.32
  const mist1 = c.createRadialGradient(W * 0.25, H * 0.35, 0, W * 0.25, H * 0.35, W * 0.55)
  mist1.addColorStop(0, 'rgba(255,255,255,0.88)')
  mist1.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = mist1
  c.fillRect(0, 0, W, H)
  c.globalAlpha = 0.22
  const mist2 = c.createRadialGradient(W * 0.78, H * 0.7, 0, W * 0.78, H * 0.7, W * 0.62)
  mist2.addColorStop(0, 'rgba(234,245,242,0.8)')
  mist2.addColorStop(1, 'rgba(234,245,242,0)')
  c.fillStyle = mist2
  c.fillRect(0, 0, W, H)
  c.restore()

  // 远山剪影（单色水墨扁平）
  c.save()
  c.globalAlpha = 0.16
  c.fillStyle = '#2E3A42'
  c.beginPath()
  c.moveTo(0, H * 0.78)
  c.quadraticCurveTo(W * 0.18, H * 0.65, W * 0.32, H * 0.76)
  c.quadraticCurveTo(W * 0.48, H * 0.62, W * 0.64, H * 0.78)
  c.quadraticCurveTo(W * 0.82, H * 0.67, W, H * 0.8)
  c.lineTo(W, H); c.lineTo(0, H); c.closePath()
  c.fill()
  c.restore()

  // 顶部压暗让悬挂木匾更醒目
  c.save()
  const topDim = c.createLinearGradient(0, 0, 0, H * 0.25)
  topDim.addColorStop(0, 'rgba(40,55,65,0.4)')
  topDim.addColorStop(1, 'rgba(40,55,65,0)')
  c.fillStyle = topDim
  c.fillRect(0, 0, W, H * 0.25)
  c.restore()
}

// 顶部悬挂式木匾：两根挂绳 + 深木底 + 双描边 + 金色楷体标题
function _drawHangingPlaque(c, cx, cy, w, h, ropeTopY, title, S) {
  // 挂绳（无论是图还是 Canvas 都需要画；绳子长度依赖面板顶部位置，不好做成图）
  c.save()
  c.strokeStyle = 'rgba(55,38,18,0.55)'
  c.lineWidth = 1.5 * S
  const ropeGap = w * 0.3
  c.beginPath()
  c.moveTo(cx - ropeGap, ropeTopY); c.lineTo(cx - w * 0.32, cy - h / 2 + 4 * S)
  c.moveTo(cx + ropeGap, ropeTopY); c.lineTo(cx + w * 0.32, cy - h / 2 + 4 * S)
  c.stroke()
  c.restore()

  const x = cx - w / 2
  const y = cy - h / 2
  const r = 9 * S

  // 优先使用生成的木匾真图（360×201 透明底 PNG，雕花 + 铁钉质感比 Canvas 好）
  const plaqueImg = V.R && V.R.getImg && V.R.getImg('assets/ui/task_plaque_title.png')
  if (plaqueImg && plaqueImg.width > 0) {
    c.save()
    c.shadowColor = 'rgba(28,16,4,0.5)'
    c.shadowBlur = 14 * S
    c.shadowOffsetY = 4 * S
    c.drawImage(plaqueImg, x, y, w, h)
    c.restore()
  } else {
    c.save()
    c.shadowColor = 'rgba(28,16,4,0.55)'
    c.shadowBlur = 16 * S
    c.shadowOffsetY = 5 * S
    const wood = c.createLinearGradient(0, y, 0, y + h)
    wood.addColorStop(0, '#8A5628')
    wood.addColorStop(0.45, '#6D3C14')
    wood.addColorStop(1, '#4A270C')
    _rr(c, x, y, w, h, r)
    c.fillStyle = wood
    c.fill()
    c.restore()

    c.save()
    _rr(c, x, y, w, h, r)
    c.strokeStyle = 'rgba(214,172,72,0.95)'
    c.lineWidth = 2 * S
    c.stroke()
    const ins = 5 * S
    _rr(c, x + ins, y + ins, w - ins * 2, h - ins * 2, r - 3 * S)
    c.strokeStyle = 'rgba(38,22,8,0.55)'
    c.lineWidth = 1 * S
    c.stroke()
    _rr(c, x + ins, y + ins, w - ins * 2, (h - ins * 2) * 0.45, r - 3 * S)
    const hl = c.createLinearGradient(0, y + ins, 0, y + ins + (h - ins * 2) * 0.45)
    hl.addColorStop(0, 'rgba(255,220,140,0.20)')
    hl.addColorStop(1, 'rgba(255,220,140,0)')
    c.fillStyle = hl
    c.fill()
    c.fillStyle = 'rgba(232,188,86,0.92)'
    const nailR = 2.2 * S
    c.beginPath(); c.arc(x + ins + nailR + 2 * S, cy, nailR, 0, Math.PI * 2); c.fill()
    c.beginPath(); c.arc(x + w - ins - nailR - 2 * S, cy, nailR, 0, Math.PI * 2); c.fill()
    c.restore()
  }

  // 标题文字在图之上叠（深阴影 + 金色 + 描边），图刷新或换风格都不影响文字
  c.save()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const fs = Math.round(h * 0.52)
  c.font = `900 ${fs}px "STKaiti","Kaiti SC","PingFang SC",serif`
  c.fillStyle = 'rgba(0,0,0,0.55)'
  c.fillText(title, cx + 1.3 * S, cy + 1.3 * S)
  c.fillStyle = '#F4D78A'
  c.fillText(title, cx, cy)
  c.strokeStyle = 'rgba(100,60,16,0.85)'
  c.lineWidth = 0.8 * S
  c.strokeText(title, cx, cy)
  c.restore()
}

// 右上角独立圆章式关闭 ✕
function _drawRoundCloseBtn(c, cx, cy, r, S) {
  c.save()
  c.shadowColor = 'rgba(28,16,4,0.5)'
  c.shadowBlur = 8 * S
  c.shadowOffsetY = 2 * S
  const bg = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r)
  bg.addColorStop(0, '#8C5830')
  bg.addColorStop(1, '#452810')
  c.fillStyle = bg
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill()
  c.restore()

  c.save()
  c.strokeStyle = 'rgba(212,170,70,0.95)'
  c.lineWidth = 1.8 * S
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke()
  c.strokeStyle = 'rgba(60,38,18,0.55)'
  c.lineWidth = 1 * S
  c.beginPath(); c.arc(cx, cy, r - 3 * S, 0, Math.PI * 2); c.stroke()
  c.restore()

  c.save()
  c.fillStyle = '#F4D78A'
  c.font = `bold ${Math.round(r * 1.05)}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('✕', cx, cy + 0.5 * S)
  c.restore()

  return [cx - r, cy - r, r * 2, r * 2]
}

// 左侧丝绸竖挂吊牌（分类 Tab）：挂绳 + 绳结 + 渐变丝绸 + 底部三角流苏 + 竖排楷体
// 返回命中矩形（含流苏区域，方便玩家点击）
function _drawSideTab(c, cx, topY, w, h, label, selected, S) {
  c.save()
  c.strokeStyle = 'rgba(55,38,18,0.55)'
  c.lineWidth = 1.2 * S
  c.beginPath()
  c.moveTo(cx, topY - 8 * S); c.lineTo(cx, topY + 2 * S)
  c.stroke()
  c.fillStyle = 'rgba(175,78,50,0.85)'
  c.beginPath(); c.arc(cx, topY + 3 * S, 2.5 * S, 0, Math.PI * 2); c.fill()
  c.restore()

  const x = cx - w / 2
  const y = topY + 5 * S

  // 优先使用真图吊牌（红/灰两态各一张，透明底带流苏铜铃）
  const imgKey = selected ? 'assets/ui/task_sidetab_active.png' : 'assets/ui/task_sidetab_dim.png'
  const tabImg = V.R && V.R.getImg && V.R.getImg(imgKey)
  if (tabImg && tabImg.width > 0) {
    c.save()
    c.shadowColor = 'rgba(28,16,4,0.4)'
    c.shadowBlur = 6 * S
    c.shadowOffsetX = 1.5 * S
    c.shadowOffsetY = 2 * S
    // 保持原图比例，以高度 h 为主，宽度适配图片比例（图片是 201×360，比例 0.558）
    const ratio = tabImg.width / tabImg.height
    const drawH = h + 14 * S  // 多给些高度容纳图里的流苏
    const drawW = drawH * ratio
    const drawX = cx - drawW / 2
    c.drawImage(tabImg, drawX, y - 2 * S, drawW, drawH)
    c.restore()
  } else {
    c.save()
    c.shadowColor = 'rgba(28,16,4,0.42)'
    c.shadowBlur = 8 * S
    c.shadowOffsetX = 2 * S
    c.shadowOffsetY = 3 * S
    const grad = c.createLinearGradient(0, y, 0, y + h)
    if (selected) {
      grad.addColorStop(0, '#C59B4B')
      grad.addColorStop(0.5, '#A67B2F')
      grad.addColorStop(1, '#6F4E1A')
    } else {
      grad.addColorStop(0, '#6F8F7A')
      grad.addColorStop(0.5, '#4E6B58')
      grad.addColorStop(1, '#33493D')
    }
    const r = 5 * S
    _rr(c, x, y, w, h, r)
    c.fillStyle = grad
    c.fill()
    c.restore()

    c.save()
    _rr(c, x, y, w, h, r)
    c.strokeStyle = selected ? 'rgba(255,220,140,0.95)' : 'rgba(230,215,180,0.35)'
    c.lineWidth = selected ? 1.6 * S : 1 * S
    c.stroke()
    const ins = 2.5 * S
    _rr(c, x + ins, y + ins, w - ins * 2, h - ins * 2, Math.max(1, r - 1.5 * S))
    c.strokeStyle = selected ? 'rgba(255,245,200,0.4)' : 'rgba(200,215,195,0.22)'
    c.lineWidth = 0.8 * S
    c.stroke()
    c.restore()

    c.save()
    c.fillStyle = selected ? 'rgba(175,60,40,0.85)' : 'rgba(160,100,50,0.55)'
    c.beginPath()
    c.moveTo(cx - 3.5 * S, y + h)
    c.lineTo(cx + 3.5 * S, y + h)
    c.lineTo(cx, y + h + 5 * S)
    c.closePath()
    c.fill()
    c.strokeStyle = selected ? 'rgba(140,40,20,0.85)' : 'rgba(120,70,30,0.55)'
    c.lineWidth = 0.8 * S
    c.beginPath(); c.moveTo(cx, y + h + 5 * S); c.lineTo(cx, y + h + 11 * S); c.stroke()
    c.restore()
  }

  // 竖排标题（文字叠在图上，保持清晰）
  c.save()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const fs = Math.min(15 * S, w * 0.55)
  c.font = `bold ${fs}px "STKaiti","Kaiti SC","PingFang SC",serif`
  // 图背景本身偏饱和，文字需要深色描边衬托出来
  const textColor = selected ? '#FFF5D6' : 'rgba(240,235,220,0.82)'
  const strokeColor = selected ? 'rgba(90,30,10,0.85)' : 'rgba(60,60,60,0.55)'
  const chars = String(label).split('')
  const step = (h - 14 * S) / Math.max(1, chars.length)
  let charY = y + 10 * S + step / 2
  chars.forEach(ch => {
    c.fillStyle = strokeColor
    c.fillText(ch, cx + 0.8 * S, charY + 0.8 * S)
    c.fillStyle = textColor
    c.fillText(ch, cx, charY)
    charY += step
  })
  c.restore()

  return [x, y, w, h + 12 * S]
}

// 任务行左侧竖向竹牌（分类标签）：对齐 UI 图中"龙虎斗"那种小竖签
// 改成深棕木牌 + 金色描边，和顶部木匾同色系，替代之前违和的绿色竹片
function _drawTaskTypeTag(c, x, cy, w, h, text, done, S) {
  const y = cy - h / 2

  // 深棕木质底：顶亮底暗渐变，未领取稍偏暖金；已领取偏冷褐（降低注意力）
  c.save()
  c.shadowColor = 'rgba(30,18,6,0.35)'
  c.shadowBlur = 4 * S
  c.shadowOffsetY = 1.5 * S
  const grad = c.createLinearGradient(0, y, 0, y + h)
  if (done) {
    grad.addColorStop(0, '#7A5226')
    grad.addColorStop(0.5, '#573410')
    grad.addColorStop(1, '#3A1F08')
  } else {
    grad.addColorStop(0, '#8B5A2A')
    grad.addColorStop(0.5, '#5E380F')
    grad.addColorStop(1, '#361B06')
  }
  _rr(c, x, y, w, h, 3 * S)
  c.fillStyle = grad
  c.fill()
  c.restore()

  // 外层金色描边 + 内层深色细边（木匾同款双层）
  c.save()
  _rr(c, x, y, w, h, 3 * S)
  c.strokeStyle = done ? 'rgba(200,160,70,0.75)' : 'rgba(218,175,78,0.95)'
  c.lineWidth = 1 * S
  c.stroke()
  _rr(c, x + 1.4 * S, y + 1.4 * S, w - 2.8 * S, h - 2.8 * S, 2 * S)
  c.strokeStyle = 'rgba(28,14,4,0.45)'
  c.lineWidth = 0.6 * S
  c.stroke()
  c.restore()

  // 顶部极淡的金色高光（模拟木匾的打光）
  c.save()
  _rr(c, x + 2 * S, y + 2 * S, w - 4 * S, Math.min(h * 0.4, 10 * S), 2 * S)
  const hl = c.createLinearGradient(0, y + 2 * S, 0, y + 2 * S + Math.min(h * 0.4, 10 * S))
  hl.addColorStop(0, 'rgba(255,220,140,0.22)')
  hl.addColorStop(1, 'rgba(255,220,140,0)')
  c.fillStyle = hl
  c.fill()
  c.restore()

  // 竖排楷体字：金米色 + 深阴影，保持清晰
  c.save()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const fs = Math.min(10.5 * S, h * 0.3)
  c.font = `bold ${fs}px "STKaiti","Kaiti SC","PingFang SC",serif`
  const chars = String(text || '').split('').slice(0, 3)
  const charH = h / (chars.length + 1)
  chars.forEach((ch, i) => {
    const ty = y + charH * (i + 1)
    c.fillStyle = 'rgba(0,0,0,0.55)'
    c.fillText(ch, x + w / 2 + 0.7 * S, ty + 0.7 * S)
    c.fillStyle = done ? '#E8CF8A' : '#F6DC95'
    c.fillText(ch, x + w / 2, ty)
  })
  c.restore()
}

// 已领取·朱红方印章："已" 字白篆 + 朱砂底
// 取代原先的金色圆 ✓（那种圆贴纸风与卷轴/宣纸整体不搭）
// 参考传统书画印鉴：方形朱红 + 阴刻白字 + 轻微边缘做旧
function _drawGoldCheckStamp(c, cx, cy, r, S) {
  // r 原先是圆章半径，方章半径取稍小一点让它显得更紧凑
  const side = r * 1.82
  const x = cx - side / 2
  const y = cy - side / 2

  c.save()
  c.shadowColor = 'rgba(110,15,10,0.28)'
  c.shadowBlur = 3 * S
  c.shadowOffsetY = 1 * S
  // 方章底色：朱砂红渐变（中心稍亮边缘稍暗模拟手按压印的轻微不均匀）
  const grad = c.createRadialGradient(cx - side * 0.12, cy - side * 0.12, 0, cx, cy, side * 0.7)
  grad.addColorStop(0, '#D5301E')
  grad.addColorStop(0.7, '#B81A0F')
  grad.addColorStop(1, '#8B1208')
  _rr(c, x, y, side, side, 2 * S)
  c.fillStyle = grad
  c.fill()
  c.restore()

  // 外层深朱边（仿印章金属边/阳刻外框）
  c.save()
  _rr(c, x + 0.8 * S, y + 0.8 * S, side - 1.6 * S, side - 1.6 * S, 1.6 * S)
  c.strokeStyle = 'rgba(65,10,5,0.75)'
  c.lineWidth = 0.9 * S
  c.stroke()
  c.restore()

  // "已" 字：粗楷体白色，压印略外凸的感觉
  c.save()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const fs = Math.round(side * 0.68)
  c.font = `900 ${fs}px "STKaiti","Kaiti SC","KaiTi","PingFang SC",serif`
  // 先画一个半透明深色衬底，再画白字，模拟雕刻阴影
  c.fillStyle = 'rgba(70,10,5,0.55)'
  c.fillText('已', cx + 0.6 * S, cy + 1 * S)
  c.fillStyle = '#FFF5E6'
  c.fillText('已', cx, cy)
  c.restore()

  // 印章边缘做旧：在 4 角各添一个微小的朱红小块，模拟手按印章边缘"糊边"的油墨溢出
  c.save()
  c.fillStyle = 'rgba(180,25,15,0.5)'
  const dotR = 0.9 * S
  c.beginPath(); c.arc(x + 1.2 * S, y + 1.2 * S, dotR, 0, Math.PI * 2); c.fill()
  c.beginPath(); c.arc(x + side - 1.2 * S, y + 1.2 * S, dotR, 0, Math.PI * 2); c.fill()
  c.beginPath(); c.arc(x + 1.2 * S, y + side - 1.2 * S, dotR, 0, Math.PI * 2); c.fill()
  c.beginPath(); c.arc(x + side - 1.2 * S, y + side - 1.2 * S, dotR, 0, Math.PI * 2); c.fill()
  c.restore()
}

/** 花华 CheckInPanel 风格：标题横幅（设计像素 × u，u=W/750） */
// 底部横幅用的金色装饰标题：左右两条渐隐金线 + 两端金色菱形 + 楷体主标题
// 用途：让"全部任务完成奖励"这行有"悬挂装饰"的仪式感，对齐原型图层次
function _drawBonusHeader(c, cx, cy, maxW, title, S) {
  c.save()
  c.font = `900 ${11 * S}px "STKaiti","Kaiti SC","PingFang SC",serif`
  const tW = c.measureText(title).width
  const diamondR = 2.5 * S
  const gapTD = 5 * S
  const gapLD = 3.5 * S
  const leftDiamondX = cx - tW / 2 - gapTD - diamondR
  const rightDiamondX = cx + tW / 2 + gapTD + diamondR

  const maxLineLen = 80 * S
  const lineXEnd = leftDiamondX - gapLD
  const lineXStart = Math.max(cx - maxW / 2, lineXEnd - maxLineLen)
  if (lineXEnd > lineXStart + 4 * S) {
    const lg = c.createLinearGradient(lineXStart, 0, lineXEnd, 0)
    lg.addColorStop(0, 'rgba(196,146,48,0)')
    lg.addColorStop(1, 'rgba(196,146,48,0.85)')
    c.strokeStyle = lg
    c.lineWidth = 0.9 * S
    c.beginPath(); c.moveTo(lineXStart, cy); c.lineTo(lineXEnd, cy); c.stroke()
  }
  const rLineStart = rightDiamondX + gapLD
  const rLineEnd = Math.min(cx + maxW / 2, rLineStart + maxLineLen)
  if (rLineEnd > rLineStart + 4 * S) {
    const rg = c.createLinearGradient(rLineStart, 0, rLineEnd, 0)
    rg.addColorStop(0, 'rgba(196,146,48,0.85)')
    rg.addColorStop(1, 'rgba(196,146,48,0)')
    c.strokeStyle = rg
    c.lineWidth = 0.9 * S
    c.beginPath(); c.moveTo(rLineStart, cy); c.lineTo(rLineEnd, cy); c.stroke()
  }

  _drawDiamondMark(c, leftDiamondX, cy, diamondR, S)
  _drawDiamondMark(c, rightDiamondX, cy, diamondR, S)

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = 'rgba(80,45,10,0.28)'
  c.fillText(title, cx + 0.6 * S, cy + 0.9 * S)
  const tg = c.createLinearGradient(0, cy - 9 * S, 0, cy + 9 * S)
  tg.addColorStop(0, '#7A3E10')
  tg.addColorStop(1, '#4A1E04')
  c.fillStyle = tg
  c.fillText(title, cx, cy)
  c.restore()
}

function _drawDiamondMark(c, cx, cy, r, S) {
  c.save()
  const grad = c.createLinearGradient(cx, cy - r, cx, cy + r)
  grad.addColorStop(0, '#F3D27A')
  grad.addColorStop(1, '#A67310')
  c.fillStyle = grad
  c.beginPath()
  c.moveTo(cx, cy - r)
  c.lineTo(cx + r, cy)
  c.lineTo(cx, cy + r)
  c.lineTo(cx - r, cy)
  c.closePath()
  c.fill()
  c.strokeStyle = 'rgba(90,55,15,0.5)'
  c.lineWidth = 0.7 * S
  c.stroke()
  c.restore()
}

// 厚棕色双边框 + 金米色填充的"原木按钮"，对齐原型右下角"领取奖励"样式
// variant: 'reward'（金米色，主 CTA） / 'ad'（琥珀黄，看广告翻倍）
// 优先使用真图 task_btn_wood.png（金米色渐变 + 棕色厚边框 + 金丝花纹），文字 Canvas 叠加
function _drawWoodenActionBtn(c, x, y, w, h, text, variant, S) {
  const btnImg = V.R && V.R.getImg && V.R.getImg('assets/ui/task_btn_wood.png')
  if (btnImg && btnImg.width > 0) {
    c.save()
    c.shadowColor = 'rgba(40,20,4,0.35)'
    c.shadowBlur = 6 * S
    c.shadowOffsetY = 2 * S
    c.drawImage(btnImg, x, y, w, h)
    // ad 变体轻微染黄：在图上叠一层琥珀暖色滤镜
    if (variant === 'ad') {
      c.globalCompositeOperation = 'source-atop'
      c.fillStyle = 'rgba(240,185,60,0.25)'
      _rr(c, x + 3 * S, y + 3 * S, w - 6 * S, h - 6 * S, 5 * S)
      c.fill()
    }
    c.restore()
  } else {
    c.save()
    _rr(c, x, y, w, h, 6 * S)
    const outer = c.createLinearGradient(0, y, 0, y + h)
    outer.addColorStop(0, '#5E3A16')
    outer.addColorStop(0.5, '#3E220B')
    outer.addColorStop(1, '#1F1205')
    c.fillStyle = outer
    c.fill()

    const midIns = 1.6 * S
    _rr(c, x + midIns, y + midIns, w - midIns * 2, h - midIns * 2, 5 * S)
    c.fillStyle = '#7A4A1C'
    c.fill()

    const innerIns = 4 * S
    _rr(c, x + innerIns, y + innerIns, w - innerIns * 2, h - innerIns * 2, 3 * S)
    let inner
    if (variant === 'ad') {
      inner = c.createLinearGradient(0, y + innerIns, 0, y + h - innerIns)
      inner.addColorStop(0, '#F6D36A')
      inner.addColorStop(1, '#BF8A26')
    } else {
      inner = c.createLinearGradient(0, y + innerIns, 0, y + h - innerIns)
      inner.addColorStop(0, '#F7E1A6')
      inner.addColorStop(0.55, '#E2B864')
      inner.addColorStop(1, '#B98828')
    }
    c.fillStyle = inner
    c.fill()

    _rr(c, x + innerIns + 1 * S, y + innerIns + 1 * S, w - innerIns * 2 - 2 * S, (h - innerIns * 2) * 0.42, 2.5 * S)
    c.fillStyle = 'rgba(255,255,255,0.28)'
    c.fill()
    c.restore()
  }

  // 文字在图上叠（保持两变体一致可读，避免图里本身有文字）
  c.save()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const fs = Math.min(10 * S, (h - 6 * S) * 0.88)
  c.font = `bold ${fs}px "STKaiti","Kaiti SC","PingFang SC",serif`
  const availTextW = w - 10 * S
  if (c.measureText(text).width > availTextW) {
    c.font = `bold ${fs - 1 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
  }
  c.fillStyle = 'rgba(60,30,5,0.55)'
  c.fillText(text, x + w / 2 + 0.5 * S, y + h / 2 + 1 * S)
  c.fillStyle = variant === 'ad' ? '#2E1A05' : '#4A1F05'
  c.fillText(text, x + w / 2, y + h / 2)
  c.restore()
}

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
  const slots = getRewardSlots(rewards)
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

function _drawHuahuaCompactDualRewardIcons(c, R, rewards, x, y, w, h, dayDone, u) {
  const slots = getRewardSlots(rewards).slice(0, 2)
  if (slots.length < 2) return false
  const a = dayDone ? 0.38 : 1
  const iconSz = 28 * u
  const spacing = 44 * u
  const startCX = x + w / 2 - ((slots.length - 1) * spacing) / 2
  const iconCY = y + h * 0.56

  slots.forEach((slot, idx) => {
    const cx = startCX + idx * spacing
    const img = R.getImg(slot.tex)
    if (img && img.width > 0) {
      c.save()
      c.globalAlpha = a
      c.drawImage(img, cx - iconSz / 2, iconCY - iconSz / 2, iconSz, iconSz)
      c.restore()
    }
    c.font = `bold ${9 * u}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.fillStyle = dayDone ? '#BDBDBD' : '#3E2723'
    c.fillText(slot.line, cx, iconCY + iconSz / 2 + 3 * u)
  })

  return true
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

  const showWideRewards = !!(highlight && rewards && getRewardSlots(rewards).length)
  const showCompactDualIcons = !!(!highlight && rewards && rewards.soulStone && rewards.stamina)
  const contentCY = y + h / 2 + 10 * u
  const icx = x + w / 2
  let iconSzForSub = 52 * u

  const compactExtraText = !highlight && !showCompactDualIcons ? _compactExtraRewardText(rewards) : ''

  if (showWideRewards) {
    _drawHuahuaWideSlots(c, R, rewards, x, y, w, h, dayDone, u)
  } else if (showCompactDualIcons) {
    _drawHuahuaCompactDualRewardIcons(c, R, rewards, x, y, w, h, dayDone, u)
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
    if (compactExtraText) {
      const tagW = Math.min(w - 14 * u, Math.max(54 * u, compactExtraText.length * 11 * u))
      const tagH = 18 * u
      const tagX = x + (w - tagW) / 2
      const tagY = y + h - tagH - 8 * u
      c.save()
      c.fillStyle = dayDone ? 'rgba(230,230,230,0.78)' : 'rgba(197, 232, 172, 0.96)'
      _rr(c, tagX, tagY, tagW, tagH, tagH / 2)
      c.fill()
      c.restore()
      c.font = `bold ${9 * u}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = dayDone ? '#8D8D8D' : '#33691E'
      c.fillText(compactExtraText, x + w / 2, tagY + tagH / 2 + 0.5 * u)
    }
  }

  if (vis.subLine && !showWideRewards && !showCompactDualIcons && !compactExtraText) {
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
  const cappedTotalDays = Math.min(LOGIN_CYCLE_DAYS, totalDays)
  const cycleProgressDays = canSign ? (totalDays % LOGIN_CYCLE_DAYS) : (sign.day || 0)
  const previewDay = canSign ? Math.min(LOGIN_CYCLE_DAYS, cycleProgressDays + 1) : Math.max(1, sign.day || 1)
  const displayIsNewbie = canSign ? totalDays < LOGIN_CYCLE_DAYS : totalDays <= LOGIN_CYCLE_DAYS
  const pageIndex = getLoginPageIndex(previewDay)
  const pageData = getLoginPageData(pageIndex, displayIsNewbie)
  return {
    totalDays,
    cappedTotalDays,
    progressDays: cappedTotalDays,
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
  const subtitle = [
    `累计签到 ${renderState.cappedTotalDays} 天`,
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

  // ── 7天连续登录区（替代原30天分页卡片） ──
  const consecState = g.storage.consecutiveLoginState
  const consecCurrent = canSign ? consecState.previewDay : (consecState.currentDay || 0)
  const consecCycleDays = consecState.cycleDays || CONSECUTIVE_CYCLE_DAYS

  _drawStageTag(c, W / 2 - 80 * u, y + 2 * u, 160 * u, 24 * u, `连续登录 (${consecCurrent}/${consecCycleDays})`, u)
  y += 34 * u

  // 上面2行×3列（第1-6天）+ 下面1行满宽（第7天，高亮大卡）
  const consecGridTop = y
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const dayNum = row * 3 + col + 1
      const consecReward = getConsecutiveLoginReward(dayNum)
      const rx = cardAreaX + col * (cellW + gap)
      const ry = consecGridTop + row * (cellH + gap)

      const isDone = !canSign && dayNum <= (consecState.currentDay || 0)
      const isToday = canSign && dayNum === consecState.previewDay

      _drawHuahuaDayCard(c, R, {
        x: rx,
        y: ry,
        w: cellW,
        h: cellH,
        titleText: isToday ? '今天' : `第${dayNum}天`,
        vis: _primaryRewardVisual(consecReward ? consecReward.rewards : {}),
        dayDone: isDone,
        isToday,
        highlight: false,
        rewards: consecReward ? consecReward.rewards : {},
      }, u)
    }
  }
  // 第7天 — 满宽高亮卡片
  const day7Y = consecGridTop + 2 * (cellH + gap)
  const day7Reward = getConsecutiveLoginReward(7)
  const day7Done = !canSign && 7 <= (consecState.currentDay || 0)
  const day7Today = canSign && 7 === consecState.previewDay
  _drawHuahuaDayCard(c, R, {
    x: cardAreaX,
    y: day7Y,
    w: cardAreaW,
    h: featureH,
    titleText: day7Today ? '今天' : '第7天',
    vis: _primaryRewardVisual(day7Reward ? day7Reward.rewards : {}),
    dayDone: day7Done,
    isToday: day7Today,
    highlight: true,
    rewards: day7Reward ? day7Reward.rewards : {},
  }, u)
  y = day7Y + featureH + 18 * u

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
  g.storage.syncDailyAllBonusAdFlagFromAdLog()
  const { ctx: c, R, W, H, S } = V

  c.save()
  // 任务面板是弹窗性质：底下应该是主页画面 + 半透明遮罩，而不是另外绘制的山水云雾
  // 只铺一层暗色遮罩，让主页背景隐约透出，聚焦感由卷轴面板自身承担
  c.fillStyle = 'rgba(0,0,0,0.48)'
  c.fillRect(0, 0, W, H)

  // 面板拉宽+基本居中：左侧吊牌 tab 直接覆盖在木框左半上，不另外占画面空间
  const pw = W * 0.88
  const sideTabSpace = 16 * S  // 只给吊牌流苏超出面板左外侧一点点的空间
  const px = (W - pw) / 2 + sideTabSpace / 2
  const safe = V.safeTop || 0
  // 悬挂木匾需要在面板顶上方留出木匾半高 + 绳子高 ≈ 36*S
  const plaqueExtraTop = 36 * S
  const minPy = safe + DAILY_TASK_PANEL_MIN_TOP_BELOW_SAFE_PT * S + plaqueExtraTop
  const bottomMargin = 12 * S
  // 卷轴面板生图有较粗的木框（左右 ~10% 宽 / 上下 ~8% 高）
  // 内容必须缩进到宣纸画布区（inset），否则小竹签、✓印章会叠在木框上
  const pad = 16 * S
  // 面板图 task_panel_frame.png 实测（像素级扫描）：纸张区 x∈[16.4%, 83.3%]、y∈[13.0%, 87.2%]
  // 面板 drawImage 是按 pw/ph 同比拉伸，inset 必须用**百分比**而非固定 *S，
  // 否则不同屏幕下纸张边界位置会漂移，内容出画布。
  // 横向 inset = pw × 17%（带 0.6% 安全余量）避开左右木框 + 金属角片
  const frameInsetX = pw * 0.17
  // 纵向 inset 需要基于"实际 ph"计算；先算内容所需高度 contentCore，
  // 再反推 ph = contentCore / (1 - 2 × 13.5%)，保证任务/横幅都落在纸张区内
  const _rowCount = DAILY_TASKS.length
  const _rowH = 36 * S            // 行高再收：标题 10 + pill 12 + 上下各 6pt 呼吸空间
  const _rowGap = 3 * S
  const _bonusBeforeGap = 4 * S
  const _bonusBlockH = 72 * S     // 横幅高：pad(7*2) + header(13) + gap(2) + subtitle(10) + gap(6) + chipRow(22) = 67*S，留 5*S 余量
  const _contentCore =
    _rowCount * (_rowH + _rowGap) - _rowGap + _bonusBeforeGap + _bonusBlockH
  // 反推 ph：纸张区 y 占 74.2%，顶/底各 13.0% + 0.5% 安全余量
  const _paperYRatio = 1 - 2 * 0.135  // = 0.73，留了 1% 安全边
  const _phWant = _contentCore / _paperYRatio
  const frameInsetYTop = _phWant * 0.135
  const frameInsetYBot = _phWant * 0.135
  const contentH = frameInsetYTop + _contentCore + frameInsetYBot
  let ph = Math.min(H * 0.82, contentH)
  let py = (H - ph) / 2 - 6 * S
  if (py < minPy) py = minPy
  if (py + ph > H - bottomMargin) ph = H - bottomMargin - py
  // ribbonH = 0：新面板不再用金色 ribbon 标题条，改用悬挂木匾代替；也不要四角菱形装饰
  // 优先使用真图卷轴面板（木框 + 铆钉 + 米黄宣纸），显著高于 Canvas 质感
  const frameImg = R.getImg && R.getImg('assets/ui/task_panel_frame.png')
  if (frameImg && frameImg.width > 0) {
    c.save()
    c.shadowColor = 'rgba(35,20,6,0.45)'
    c.shadowBlur = 16 * S
    c.shadowOffsetY = 4 * S
    // 卷轴图本身左右偏窄（478×640 比例 0.747），直接拉伸到 pw×ph 即可，边框会轻微拉伸不影响观感
    c.drawImage(frameImg, px, py, pw, ph)
    c.restore()
  } else {
    drawPanel(c, S, px, py, pw, ph, { ribbonH: 0, corners: false })
  }

  // 顶部悬挂木匾 "任务"（中心上移到面板外，仅底沿极少叠入面板，避免压到第一行任务）
  const plaqueW = Math.min(pw * 0.42, 220 * S)
  const plaqueH = 46 * S
  const plaqueCX = px + pw / 2
  const plaqueCY = py - 10 * S
  const ropeTopY = Math.max(safe + 6 * S, plaqueCY - plaqueH / 2 - 18 * S)
  _drawHangingPlaque(c, plaqueCX, plaqueCY, plaqueW, plaqueH, ropeTopY, '任务', S)

  // 右上角独立圆章 ✕（不再贴在面板内）
  const closeR = 15 * S
  const closeX = px + pw - closeR - 2 * S
  const closeY = py - closeR - 4 * S
  _taskRects.closeBtnRect = _drawRoundCloseBtn(c, closeX, closeY, closeR, S)

  // 左侧丝绸吊牌 tab：日常（选中）+ 成就（敬请期待）
  const tabW = 26 * S
  const tabH = 70 * S
  // 吊牌主体紧贴面板左木框：中心右移到 px + 2*S，使吊牌主体压在木框左半上
  // 视觉上吊牌像"从面板挂下来"，消除吊牌与纸张区之间的空白
  const tabCX = px + 2 * S
  const tabTopY1 = py + 14 * S
  const tabGap = 16 * S
  _taskRects.tabDailyRect = _drawSideTab(c, tabCX, tabTopY1, tabW, tabH, '日常', true, S)
  _taskRects.tabAchievementRect = _drawSideTab(c, tabCX, tabTopY1 + tabH + tabGap, tabW, tabH, '成就', false, S)

  // 第一行任务起点：从顶部 frameInset 开始，让内容整体收进卷轴的宣纸画布区
  let cy = py + frameInsetYTop
  const innerL = px + frameInsetX
  const innerW = pw - frameInsetX * 2

  const prog = g.storage.dailyTaskProgress
  const _ch = g.storage.currentChapter
  _taskRects.taskBtnRects = []
  g._dailyTaskChipLayouts = {}

  // 行内左侧竹牌尺寸：竖向小签（对齐参考图中"龙虎斗"样式）
  const typeTagW = 17 * S
  const typeTagH = 28 * S
  const typeTagGap = 5 * S

  // 任务区裁切 + 预留滚动位移：
  //   - 裁切框 = 画布纸张区（innerL, cy, innerW, clipH），即便未来任务数超过面板高度也不会越界到木框外
  //   - scrollY：当前保持 0；后续加任务需要滚动时，只需在 touchmove 里累加 g._taskListScrollY（向上滑为正）
  //   - 触达矩形(_taskRects)在 task 循环里本就用 cy 即时写入，会自动带 scrollY 偏移，保持点击正确
  const taskListTop = cy
  const taskListH = _rowCount * (_rowH + _rowGap) - _rowGap
  const scrollY = Math.max(0, g._taskListScrollY || 0)
  c.save()
  c.beginPath()
  // 裁切区略放大 4*S 容纳焦点辉光描边
  c.rect(innerL - 4 * S, taskListTop - 3 * S, innerW + 8 * S, taskListH + 6 * S)
  c.clip()
  cy -= scrollY

  for (const task of DAILY_TASKS) {
    const cur = prog.tasks[task.id] || 0
    const need = task.condition.count
    const done = cur >= need
    const claimed = !!prog.claimed[task.id]
    const reward = getScaledDailyTaskReward(task, _ch)
    const rowH = 36 * S
    const rowState = claimed ? 'claimed' : (done ? 'ready' : 'pending')
    const isFocusedTask = g._dailyTaskFocusId === task.id
    // 已领取时右侧只留"金章对勾"的空间，未领取且可领时留"领取"按钮空间（tbW=46S + 外边距10S = 56S）
    const actionW = done && !claimed ? 56 * S : (claimed ? 20 * S : 8 * S)
    const rewardW = 90 * S
    const titleX = innerL + typeTagW + typeTagGap + 3 * S
    // 奖励 chip 固定比例定位：innerW × 0.56，吃掉"状态 pill 与 chip 之间"的中段空白
    // 这样"已"章就能跟在 chip 右边，而不是顶到画布右缘压到木框上
    // done 态仍需要为"领取"按钮(tbW=50S)让位，所以 done 态保留"右端对齐"
    const rewardCenterX = claimed
      ? innerL + innerW * 0.56
      : innerL + innerW - actionW - rewardW / 2 - 4 * S

    // 行底「直接画在宣纸上」：不要阴影、不要粗边框，也不要金色内描边——那些会让行看起来"浮"在面板上
    // 只保留一个极淡的色块（区分可点击状态）和一条极淡的底部分隔线（像宣纸上的墨线）
    // 原型图里的任务行就是"直接写在宣纸上"的，没有独立卡片
    if (done && !claimed) {
      // done 未领取：一抹极浅的金黄提示"可领"，引导点击
      c.fillStyle = 'rgba(255,230,150,0.28)'
      _rr(c, innerL, cy, innerW, rowH, 6 * S); c.fill()
    } else if (!claimed && !done) {
      // 未完成进行中：几乎透明的米白，仅给触达区一个微弱标识
      c.fillStyle = 'rgba(255,248,225,0.14)'
      _rr(c, innerL, cy, innerW, rowH, 6 * S); c.fill()
    }
    // claimed 状态不画行底，让已领取的任务彻底"退"到纸面中
    // 行底部极淡水平分隔线（仿宣纸上的淡墨横线），最后一行不画
    const isLastRow = (DAILY_TASKS[DAILY_TASKS.length - 1] === task)
    if (!isLastRow) {
      c.save()
      c.strokeStyle = 'rgba(120,85,35,0.22)'
      c.lineWidth = 0.6 * S
      c.beginPath()
      c.moveTo(innerL + 10 * S, cy + rowH + 4 * S)
      c.lineTo(innerL + innerW - 10 * S, cy + rowH + 4 * S)
      c.stroke()
      c.restore()
    }

    if (isFocusedTask) {
      const pulse = 0.4 + 0.22 * Math.sin((g.af || 0) * 0.08)
      c.save()
      c.globalAlpha = pulse
      c.strokeStyle = done && !claimed ? 'rgba(232,181,71,0.96)' : 'rgba(255,223,147,0.9)'
      c.lineWidth = 2 * S
      _rr(c, innerL - 1.5 * S, cy - 1.5 * S, innerW + 3 * S, rowH + 3 * S, 11 * S)
      c.stroke()
      c.restore()
    }

    // 左侧竖竹牌分类（秘境 / 征战 / 通天 / 派遣 / 育灵 / 传音）
    const tagX = innerL + 6 * S
    _drawTaskTypeTag(c, tagX, cy + rowH / 2, typeTagW, typeTagH, _TASK_TAG_BY_ID[task.id] || '', claimed, S)

    c.textAlign = 'left'
    c.textBaseline = 'middle'
    // 新的暖金纸底下，claimed 用"墨色变浅的暖褐"而非冷灰，保持水墨感
    c.fillStyle = claimed ? '#8A6D3C' : '#3A2A12'
    c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
    c.fillText(task.name, titleX, cy + rowH * 0.28)

    const statusText = claimed ? '已领取' : (done ? '已完成，可领取' : `进度 ${Math.min(cur, need)}/${need}`)
    _drawTaskStatusPill(c, titleX, cy + rowH * 0.78, statusText, rowState, S)

    const taskChipOpts = {
      align: 'center',
      maxSlots: 2,
      iconSz: 11 * S,
      chipH: 15 * S,
      gap: 6 * S,
      fontSize: 8.8 * S,
    }
    const rowChipCy = cy + rowH / 2
    if (done && !claimed) {
      g._dailyTaskChipLayouts[task.id] = layoutRewardSlotChips(c, reward, rewardCenterX, rowChipCy, rewardW, S, taskChipOpts)
    }
    const skipRowChips = claimed && shouldSkipStaticRewardChips(g, { type: 'dailyTask', taskId: task.id })
    if (!skipRowChips) {
      drawRewardSlotChips(c, R, reward, rewardCenterX, rowChipCy, rewardW, S, { ...taskChipOpts, state: rowState })
    }

    if (done && !claimed) {
      const tbW = 46 * S, tbH = 22 * S
      const tbX = innerL + innerW - tbW - 6 * S
      const tbY = cy + (rowH - tbH) / 2
      R.drawDialogBtn(tbX, tbY, tbW, tbH, '领取', 'confirm')
      _taskRects.taskBtnRects.push({ id: task.id, rect: [tbX, tbY, tbW, tbH] })
    } else if (claimed) {
      // "已"章紧跟 chip 右侧：chip 左移到 innerW×0.56 后，"已"章中心落在 chip 右缘 + 12S gap + stampR
      // 这样 stamp 右缘离 innerR 仍有 ~30S 呼吸，完全在画布内
      const stampR = 7 * S
      const stampCX = rewardCenterX + rewardW / 2 + 12 * S + stampR
      _drawGoldCheckStamp(c, stampCX, cy + rowH / 2, stampR, S)
    }

    cy += rowH + 3 * S
  }

  c.restore()
  // 裁切结束后，把 cy 还原到"任务区底部"（不带 scrollY 偏移），让底部横幅正常居中
  cy = taskListTop + taskListH

  // 底部横幅前间距（与上面 contentH 公式里的 _bonusBeforeGap 对齐）
  cy += _bonusBeforeGap
  const allDone = DAILY_TASKS.every(t => prog.claimed[t.id])
  const allClaimed = prog.allClaimed
  const allBonusAdDone = !!prog.allBonusAdClaimed
  const allBonus = getScaledDailyAllBonus(_ch)
  const focusAllBonus = g._dailyTaskFocusSection === 'allBonus'
  const canDoubleBonus = allClaimed && !allBonusAdDone && AdManager.canShow('dailyTaskBonus')

  // 状态副标题：对齐原型的"看广告或分享成功可再领一整份奖励"写法
  let bonusSubtitle = '完成全部任务后即可领取下列奖励'
  if (allDone && !allClaimed) {
    bonusSubtitle = '奖励已解锁，点击右侧「领取奖励」一次收下'
  } else if (canDoubleBonus) {
    bonusSubtitle = '看广告或分享成功可再领一整份奖励'
  } else if (allClaimed && !allBonusAdDone) {
    const lim = AdManager.getDailyLimit('dailyTaskBonus')
    const used = AdManager.getTodayCount('dailyTaskBonus')
    bonusSubtitle = (lim > 0 && used >= lim)
      ? '今日翻倍次数已用完，请明日再来'
      : '激励视频未就绪，请稍后再试'
  } else if (allClaimed) {
    bonusSubtitle = '今日奖励已全部领完'
  }

  // === 横幅布局：3 层（主标题 → 副标题 → chip + 按钮）===
  // 每一层独立绘制，制造"装饰条+纸张+奖励方块+厚棕按钮"的层次感
  // 尺寸和上方 contentH 公式里的 _bonusBlockH(120*S) 必须一致
  const bonusPadTop = 7 * S
  const bonusPadBot = 7 * S
  const bonusPadX = 7 * S
  const headerRowH = 13 * S
  const subtitleGap = 2 * S
  const subtitleRowH = 10 * S
  const chipRowGap = 6 * S
  const chipRowH = 22 * S
  const bonusH = bonusPadTop + headerRowH + subtitleGap + subtitleRowH + chipRowGap + chipRowH + bonusPadBot
  // bonusH = 7+13+2+10+6+22+7 = 67*S（与上面 _bonusBlockH=72*S 留 5*S 容错）

  const bonusY = cy
  const bonusX = innerL
  const bonusW = innerW
  const bonusState = canDoubleBonus ? 'ready' : (allClaimed ? 'claimed' : (allDone ? 'ready' : 'pending'))

  _taskRects.allBonusBtnRect = null
  _taskRects.allBonusAdRect = null

  // 不再画「独立米黄纸卡片+双描边+投影」的横幅底——那样会让底部奖励区看起来像另一张飘在面板外的纸
  // 改为：仅在顶部画一条装饰性分隔（金色渐隐线 + 两侧小菱形），让"全部任务完成奖励"区与任务行自然断开
  // 内容（标题/副标题/chip/按钮）全部直接画在卷轴的宣纸底色上
  c.save()
  const sepY = bonusY + 2 * S
  const sepLen = Math.min(bonusW * 0.8, 240 * S)
  const sepL = bonusX + bonusW / 2 - sepLen / 2
  const sepR = bonusX + bonusW / 2 + sepLen / 2
  const sepGrad = c.createLinearGradient(sepL, 0, sepR, 0)
  sepGrad.addColorStop(0, 'rgba(176,125,38,0)')
  sepGrad.addColorStop(0.5, 'rgba(176,125,38,0.55)')
  sepGrad.addColorStop(1, 'rgba(176,125,38,0)')
  c.strokeStyle = sepGrad
  c.lineWidth = 0.8 * S
  c.beginPath(); c.moveTo(sepL, sepY); c.lineTo(sepR, sepY); c.stroke()
  c.restore()

  // 聚焦高亮：只在"可领取"或"可看广告翻倍"态下画一圈微光描边，作为按钮区的呼吸提示
  // 但要无填充、无阴影，避免又回到"卡片浮空"感
  if (focusAllBonus) {
    const pulse = 0.36 + 0.22 * Math.sin((g.af || 0) * 0.08)
    c.save()
    c.globalAlpha = pulse
    c.strokeStyle = canDoubleBonus || (allDone && !allClaimed) ? 'rgba(232,181,71,0.95)' : 'rgba(255,228,161,0.85)'
    c.lineWidth = 1.6 * S
    _rr(c, bonusX + 1 * S, bonusY + 4 * S, bonusW - 2 * S, bonusH - 5 * S, 9 * S)
    c.stroke()
    c.restore()
  }

  // 第 2 层：顶部装饰主标题（金线 + 菱形 + 楷体大字，居中）
  const headerCY = bonusY + bonusPadTop + headerRowH / 2
  _drawBonusHeader(c, bonusX + bonusW / 2, headerCY, bonusW - bonusPadX * 2, '全部任务完成奖励', S)

  // 第 3 层：居中副标题
  const subtitleCY = headerCY + headerRowH / 2 + subtitleGap + subtitleRowH / 2
  c.save()
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `${8 * S}px "PingFang SC",sans-serif`
  c.fillStyle = allClaimed && !canDoubleBonus ? '#6E9A72' : '#8A6A3A'
  c.fillText(bonusSubtitle, bonusX + bonusW / 2, subtitleCY)
  c.restore()

  // 第 4 层：奖励 chip + 按钮同一行（左 chip / 右厚棕色按钮）
  const rowY = subtitleCY + subtitleRowH / 2 + chipRowGap
  const rowCY = rowY + chipRowH / 2

  const showRewardBtn = allDone && !allClaimed
  const showAdBtn = canDoubleBonus
  const hasBtn = showRewardBtn || showAdBtn
  // 按钮宽度：两种文案分别测出最小需要宽度，保证不会被切
  // 按钮再收：字号 10*S bold 时 5 字 ~50*S，4 字 ~40*S，左右内边距 10*S
  // → "看广告翻倍" 取 78*S，"领取奖励" 取 66*S
  const btnW = showAdBtn ? 78 * S : 66 * S
  const btnH = chipRowH
  const btnX = bonusX + bonusW - bonusPadX - btnW
  const btnY = rowY

  const chipStartX = bonusX + bonusPadX
  // chip 区与按钮之间保留 10*S 的"呼吸槽"，避免"x62/x1/翻倍"等挤到按钮边
  const chipAvailRight = hasBtn ? (btnX - 10 * S) : (bonusX + bonusW - bonusPadX)
  const chipAvailW = Math.max(40 * S, chipAvailRight - chipStartX)

  const chipDrawOpts = {
    align: 'left',
    maxSlots: 3,
    iconSz: 11 * S,        // 从 14 缩到 11：底部"全部奖励"chip 图标不再过大
    chipH: chipRowH,
    gap: 3 * S,
    fontSize: 7.5 * S,
  }
  if (allDone && !allClaimed) {
    g._dailyAllBonusChipLayout = layoutRewardSlotChips(c, allBonus, chipStartX, rowCY, chipAvailW, S, chipDrawOpts)
  }
  const skipBonusChips = allClaimed && shouldSkipStaticRewardChips(g, { type: 'dailyAllBonus' })
  if (!skipBonusChips) {
    drawRewardSlotChips(c, R, allBonus, chipStartX, rowCY, chipAvailW, S, { ...chipDrawOpts, state: bonusState })
  }

  if (showRewardBtn) {
    _drawWoodenActionBtn(c, btnX, btnY, btnW, btnH, '领取奖励', 'reward', S)
    _taskRects.allBonusBtnRect = [btnX, btnY, btnW, btnH]
  } else if (showAdBtn) {
    _drawWoodenActionBtn(c, btnX, btnY, btnW, btnH, '看广告翻倍', 'ad', S)
    _taskRects.allBonusAdRect = [btnX, btnY, btnW, btnH]
  }

  drawRewardChipFlyLayer(c, R, g, S)

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
          P.showGameToast('该里程碑奖励已领取', { type: 'warn' })
        } else {
          P.showGameToast(`累计签到${mp.day}天后可领取`, { type: 'warn' })
        }
      }
      return true
    }
  }  if (_signRects.signBtnRect && g._hitRect(x, y, ..._signRects.signBtnRect)) {
    const signRect = _signRects.signBtnRect.slice()
    const result = g.storage.claimLoginReward()
    if (result) {
      MusicMgr.playReward && MusicMgr.playReward()
      buttonFx.trigger(signRect, 'upgrade')
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

  // 左侧 Tab：日常（当前面板即日常，点击仅给点击反馈）
  if (_taskRects.tabDailyRect && g._hitRect(x, y, ..._taskRects.tabDailyRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    return true
  }

  // 左侧 Tab：成就系统暂未上线，给出明确预告
  if (_taskRects.tabAchievementRect && g._hitRect(x, y, ..._taskRects.tabAchievementRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    const P = require('../platform')
    P.showGameToast('成就系统即将开放，敬请期待', { type: 'warn' })
    return true
  }

  const _tch = g.storage.currentChapter
  for (const tb of _taskRects.taskBtnRects) {
    if (g._hitRect(x, y, ...tb.rect)) {
      const layout = g._dailyTaskChipLayouts && g._dailyTaskChipLayouts[tb.id]
      const taskRect = tb.rect.slice()
      const ok = g.storage.claimDailyTask(tb.id)
      if (ok) {
        MusicMgr.playReward && MusicMgr.playReward()
        buttonFx.trigger(taskRect, 'reward')
        const task = DAILY_TASKS.find(t => t.id === tb.id)
        if (task) g._toast && g._toast(`${task.name}：${_rewardText(getScaledDailyTaskReward(task, _tch))}`)
        if (layout && layout.entries && layout.entries.length) {
          startRewardChipFlyAnim(g, layout.entries, { type: 'dailyTask', taskId: tb.id })
        }
      }
      return true
    }
  }

  if (_taskRects.allBonusBtnRect && g._hitRect(x, y, ..._taskRects.allBonusBtnRect)) {
    const layout = g._dailyAllBonusChipLayout
    const allBonusRect = _taskRects.allBonusBtnRect.slice()
    const ok = g.storage.claimDailyAllBonus()
    if (ok) {
      MusicMgr.playReward && MusicMgr.playReward()
      buttonFx.trigger(allBonusRect, 'upgrade')
      g._toast && g._toast(`全部任务完成奖励：${_rewardText(getScaledDailyAllBonus(_tch))}`)
      if (layout && layout.entries && layout.entries.length) {
        startRewardChipFlyAnim(g, layout.entries, { type: 'dailyAllBonus' })
      }
    }
    return true
  }

  if (_taskRects.allBonusAdRect && g._hitRect(x, y, ..._taskRects.allBonusAdRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('dailyTaskBonus', {
      fallbackToShare: true,
      onRewarded: () => {
        const bonus = getScaledDailyAllBonus(_tch)
        const granted = g.storage.grantRewardBundle(bonus)
        g.storage.markDailyAllBonusAdClaimed()
        MusicMgr.playReward && MusicMgr.playReward()
        g._toast && g._toast(`翻倍奖励到账：${_rewardText(granted)}`)
        g._dirty = true
      },
      rewardPopup: () => {
        const bonus = getScaledDailyAllBonus(_tch)
        const lines = linesFromRewards(bonus)
        if (!lines.length) return null
        return { title: '全部任务奖励翻倍', subtitle: '观看广告后再领一整份完整奖励', lines }
      },
    })
    return true
  }

  return true
}

module.exports = { rDailySign, tDailySign, rDailyTasks, tDailyTasks }
