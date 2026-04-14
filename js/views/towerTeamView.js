/**
 * 通天塔编队页 — 上方编队槽位 + 下方灵宠池列表 + 底部出发
 * 参考 stageTeamView.js 的交互模式
 */
const V = require('./env')
const P = require('../platform')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById, getPetAvatarPath } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getWeaponById, getWeaponRarity, getDefaultWeaponPickerPreviewId } = require('../data/weapons')
const { drawGoldBtn } = require('./uiUtils')
const { drawCornerRarityBadge } = require('./rarityBadge')
const { TOWER_DAILY } = require('../data/economyConfig')

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'metal', label: '金' },
  { key: 'wood', label: '木' },
  { key: 'water', label: '水' },
  { key: 'fire', label: '火' },
  { key: 'earth', label: '土' },
]

const MAX_TEAM = 5
const MIN_TEAM = 1

/** 与秘境编队 stageTeamView 一致的引导描边闪烁周期 */
const TEAM_GUIDE_PULSE_PERIOD = 420

/** 灵宠池里是否还有未编入当前队伍的灵宠（与秘境编队同源逻辑） */
function _hasUnpickedPetsInPool(g, selectedIds) {
  const pool = g.storage.petPool || []
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]
    if (p && p.id && selectedIds.indexOf(p.id) < 0) return true
  }
  return false
}

/** 编队区深色底：槽位行 + 可选提示行 + 筛选行 + 底边留白（×S） */
const UPPER_PANEL = {
  slotBlockStepPt: 64,
  hintRowPt: 16,
  gapBeforeFiltersPt: 12,
  filterRowPt: 22,
  bottomPadPt: 8,
}

const _rects = {
  slotRects: [],
  weaponSlotRect: null,
  weaponCardRects: [],
  weaponPreviewEquipRect: null,
  weaponPreviewBackRect: null,
  weaponPickerRect: null,
  weaponPickerGridRect: null,
  filterRects: [],
  petCardRects: [],
  startBtnRect: null,
  backBtnRect: null,
}

let _scrollY = 0
let _touchStartY = 0
let _touchLastY = 0
let _touchStartX = 0
let _scrolling = false
let _holdStartTime = 0
let _holdTarget = null
let _weaponPickerTouchInGrid = false
let _framePetMap = null
function _getFramePetMap(R) {
  if (!_framePetMap) {
    _framePetMap = {
      metal: R.getImg('assets/ui/frame_pet_metal.png'),
      wood:  R.getImg('assets/ui/frame_pet_wood.png'),
      water: R.getImg('assets/ui/frame_pet_water.png'),
      fire:  R.getImg('assets/ui/frame_pet_fire.png'),
      earth: R.getImg('assets/ui/frame_pet_earth.png'),
    }
  }
  return _framePetMap
}

function _ensureSelected(g) {
  if (!g._towerTeamSelected) {
    const pool = g.storage.petPool || []
    g._towerTeamSelected = pool.slice(0, MAX_TEAM).map(p => p.id)
  }
  return g._towerTeamSelected
}

// ===== 渲染 =====
function rTowerTeam(g) {
  const { ctx: c, R, W, H, S, safeTop } = V

  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }
  c.fillStyle = 'rgba(0,0,0,0.25)'
  c.fillRect(0, 0, W, H)

  const selected = _ensureSelected(g)
  const framePetMap = _getFramePetMap(R)

  const topY = safeTop + 4 * S
  const px = 14 * S
  let cy = topY

  const weaponCollCount = (g.storage.weaponCollection || []).length
  const eqId = g.storage.equippedWeaponId
  const eqWeapon = eqId ? getWeaponById(eqId) : null
  const needPickWeapon = weaponCollCount > 0 && !eqId
  const teamNeedMore = selected.length < MIN_TEAM

  // ── 返回 + 标题（与秘境编队同结构：主标题「编队」）──
  c.save()
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.fillRect(0, cy, W, 36 * S)
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3 * S
  c.strokeText('‹ 返回', px, cy + 18 * S)
  c.fillStyle = '#FFFFFF'
  c.fillText('‹ 返回', px, cy + 18 * S)
  _rects.backBtnRect = [0, cy, 80 * S, 36 * S]

  c.fillStyle = '#F5E6C8'; c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3 * S
  c.strokeText('编队', W / 2, cy + 18 * S)
  c.fillText('编队', W / 2, cy + 18 * S)

  const usedRuns = g.storage.getTowerDailyRuns()
  const freeLeft = Math.max(0, TOWER_DAILY.freeRuns - usedRuns)
  c.fillStyle = freeLeft > 0 ? 'rgba(255,240,200,0.7)' : 'rgba(255,120,80,0.8)'
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`今日 ${usedRuns}/${TOWER_DAILY.freeRuns}`, W - px, cy + 18 * S)
  c.restore()
  cy += 40 * S

  // ── 编队槽位面板（高度含提示行 + 筛选 Tab，与秘境视觉一致）──
  const panelTop = cy
  const hintExtraPt = needPickWeapon || teamNeedMore ? UPPER_PANEL.hintRowPt : 0
  const panelH =
    UPPER_PANEL.slotBlockStepPt * S +
    hintExtraPt * S +
    UPPER_PANEL.gapBeforeFiltersPt * S +
    UPPER_PANEL.filterRowPt * S +
    UPPER_PANEL.bottomPadPt * S
  c.fillStyle = 'rgba(40,30,20,0.7)'
  R.rr(8 * S, panelTop, W - 16 * S, panelH, 10 * S); c.fill()
  c.strokeStyle = 'rgba(200,180,120,0.2)'; c.lineWidth = 1 * S
  R.rr(8 * S, panelTop, W - 16 * S, panelH, 10 * S); c.stroke()

  const slotSize = 52 * S
  const slotGap = 8 * S
  const wpnGap = 12 * S
  const slotsW = slotSize + wpnGap + MAX_TEAM * slotSize + (MAX_TEAM - 1) * slotGap
  const slotStartX = (W - slotsW) / 2
  const slotY = cy + 8 * S
  const slotFrameScale = 1.12
  const slotFrameSz = slotSize * slotFrameScale
  const slotFrameOf = (slotFrameSz - slotSize) / 2
  _rects.slotRects = []

  // 法宝槽
  {
    const sx = slotStartX
    c.fillStyle = eqWeapon ? '#1a1510' : 'rgba(25,22,18,0.8)'
    c.fillRect(sx + 1, slotY + 1, slotSize - 2, slotSize - 2)
    if (eqWeapon) {
      R.drawCoverImg(R.getImg(`assets/equipment/fabao_${eqWeapon.id}.png`), sx + 1, slotY + 1, slotSize - 2, slotSize - 2, { radius: 4 * S })
    } else {
      c.fillStyle = 'rgba(80,70,50,0.5)'
      R.rr(sx, slotY, slotSize, slotSize, 8*S); c.fill()
      c.fillStyle = '#888'; c.font = `${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('⚔', sx + slotSize / 2, slotY + slotSize / 2 - 4*S)
      c.fillStyle = '#666'; c.font = `${7*S}px "PingFang SC",sans-serif`
      c.fillText('法宝', sx + slotSize / 2, slotY + slotSize / 2 + 10*S)
    }
    R.drawWeaponFrame(sx, slotY, slotSize)
    if (needPickWeapon) {
      const pulse = 0.45 + 0.35 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
      c.strokeStyle = `rgba(232,197,71,${pulse})`
      c.lineWidth = 2.5 * S
      c.strokeRect(sx - 2 * S, slotY - 2 * S, slotSize + 4 * S, slotSize + 4 * S)
      c.fillStyle = '#ff4444'
      c.beginPath()
      c.arc(sx + slotSize - 5 * S, slotY + 5 * S, 5 * S, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = '#fff'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('!', sx + slotSize - 5 * S, slotY + 5 * S)
    }
    _rects.weaponSlotRect = [sx, slotY, slotSize, slotSize]
  }

  // 宠物槽
  const petSlotStartX = slotStartX + slotSize + wpnGap
  for (let i = 0; i < MAX_TEAM; i++) {
    const sx = petSlotStartX + i * (slotSize + slotGap)
    _rects.slotRects.push([sx, slotY, slotSize, slotSize])

    if (i < selected.length) {
      const pid = selected[i]
      const pet = getPetById(pid)
      const poolPet = g.storage.getPoolPet(pid)
      if (pet && poolPet) {
        const pAttrColor = ATTR_COLOR[pet.attr]
        c.fillStyle = pAttrColor ? pAttrColor.bg || pAttrColor.main + '30' : '#1a1a2e'
        c.fillRect(sx, slotY, slotSize, slotSize)
        c.fillStyle = pAttrColor ? pAttrColor.main : '#888'
        R.rr(sx, slotY, slotSize, 4*S, 4*S); c.fill()

        const avatarPath = getPetAvatarPath({ ...pet, star: poolPet.star })
        R.drawCoverImg(R.getImg(avatarPath), sx + 1, slotY + 1, slotSize - 2, slotSize - 2, { radius: 4 * S })

        const petFrame = framePetMap[pet.attr] || framePetMap.metal
        if (petFrame && petFrame.width > 0) {
          c.drawImage(petFrame, sx - slotFrameOf, slotY - slotFrameOf, slotFrameSz, slotFrameSz)
        }

        const starStr = '★'.repeat(poolPet.star)
        c.fillStyle = '#ffd700'; c.font = `${7*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'top'
        c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 1.5*S
        c.strokeText(starStr, sx + slotSize / 2, slotY + slotSize - 10*S)
        c.fillText(starStr, sx + slotSize / 2, slotY + slotSize - 10*S)
      }
    } else {
      c.fillStyle = 'rgba(80,70,50,0.5)'
      R.rr(sx, slotY, slotSize, slotSize, 8*S); c.fill()
      c.strokeStyle = 'rgba(200,180,120,0.25)'; c.lineWidth = 1*S
      R.rr(sx, slotY, slotSize, slotSize, 8*S); c.stroke()
      c.fillStyle = '#666'; c.font = `${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('+', sx + slotSize / 2, slotY + slotSize / 2)
      const pulseEmpty =
        !needPickWeapon &&
        i === selected.length &&
        selected.length < MAX_TEAM &&
        (teamNeedMore || (selected.length >= MIN_TEAM && _hasUnpickedPetsInPool(g, selected)))
      if (pulseEmpty) {
        const pulse = 0.45 + 0.35 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
        c.strokeStyle = `rgba(232,197,71,${pulse})`
        c.lineWidth = 2.5 * S
        c.strokeRect(sx - 2 * S, slotY - 2 * S, slotSize + 4 * S, slotSize + 4 * S)
      }
    }
  }
  cy += 64 * S

  if (needPickWeapon) {
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 2.5 * S
    const hint = `您拥有${weaponCollCount}件法宝，请先点击左侧槽位选择上阵`
    c.strokeText(hint, W / 2, cy)
    c.fillStyle = '#E8C547'
    c.fillText(hint, W / 2, cy)
    cy += UPPER_PANEL.hintRowPt * S
  } else if (teamNeedMore) {
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 2.5 * S
    const needN = MIN_TEAM - selected.length
    const hint =
      needN <= 1
        ? '请先编入灵宠：点上方「+」空槽，或点击下方灵宠卡片'
        : `还需编入 ${needN} 只灵宠｜点上方「+」或点击下方卡片加入编队`
    c.strokeText(hint, W / 2, cy)
    c.fillStyle = '#E8C547'
    c.fillText(hint, W / 2, cy)
    cy += UPPER_PANEL.hintRowPt * S
  }
  cy += 12 * S

  // ── 属性筛选标签 ──
  _rects.filterRects = []
  const tabW = (W - 20 * S) / FILTERS.length
  for (let i = 0; i < FILTERS.length; i++) {
    const f = FILTERS[i]
    const fx = 10*S + i * tabW
    const active = (g._towerTeamFilter || 'all') === f.key
    c.fillStyle = active ? 'rgba(200,180,120,0.25)' : 'rgba(60,50,40,0.3)'
    R.rr(fx, cy, tabW - 2*S, 22*S, 6*S); c.fill()
    if (active) {
      c.strokeStyle = '#C9A84C'; c.lineWidth = 1*S
      R.rr(fx, cy, tabW - 2*S, 22*S, 6*S); c.stroke()
    }
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = active ? '#ffd700' : '#999'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(f.label, fx + (tabW - 2*S) / 2, cy + 11*S)
    _rects.filterRects.push({ key: f.key, rect: [fx, cy, tabW - 2*S, 22*S] })
  }
  cy += 28 * S

  const canGo = selected.length >= MIN_TEAM
  const suggestCompleteTeam =
    canGo && selected.length < MAX_TEAM && _hasUnpickedPetsInPool(g, selected)
  const BTN_BAR_H_NORMAL = 72
  const BTN_BAR_H_WITH_FOOT_HINT = 82
  const btnBarH = (!canGo || suggestCompleteTeam ? BTN_BAR_H_WITH_FOOT_HINT : BTN_BAR_H_NORMAL) * S
  const btnBarY = H - btnBarH

  // ── 底部按钮栏（与秘境编队同结构）──
  const btnBarGrad = c.createLinearGradient(0, btnBarY, 0, H)
  btnBarGrad.addColorStop(0, 'rgba(20,14,8,0.6)')
  btnBarGrad.addColorStop(0.4, 'rgba(20,14,8,0.75)')
  btnBarGrad.addColorStop(1, 'rgba(20,14,8,0.85)')
  c.fillStyle = btnBarGrad
  c.fillRect(0, btnBarY, W, btnBarH)
  c.strokeStyle = 'rgba(200,168,80,0.3)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(0, btnBarY); c.lineTo(W, btnBarY); c.stroke()

  const goBtnW = W * 0.6, goBtnH = 44 * S
  const goBtnX = (W - goBtnW) / 2, goBtnY = btnBarY + 20 * S

  if (canGo) {
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (btnImg && btnImg.width > 0) {
      c.drawImage(btnImg, goBtnX, goBtnY, goBtnW, goBtnH)
    } else {
      drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '出发', false, 13)
    }
    c.fillStyle = '#FFF5E0'; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2 * S
    c.strokeText('出发', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
    c.fillText('出发', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
    if (suggestCompleteTeam) {
      c.save()
      const subPulse = 0.72 + 0.28 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
      c.globalAlpha = subPulse
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      const footY = Math.min(goBtnY + goBtnH + 8 * S, btnBarY + btnBarH - 4 * S)
      const nEmpty = MAX_TEAM - selected.length
      const tip = `还可编入 ${nEmpty} 只灵宠；点「出发」时若仍未满会再确认`
      c.strokeStyle = 'rgba(0,0,0,0.72)'; c.lineWidth = 2 * S
      c.strokeText(tip, W / 2, footY)
      c.fillStyle = '#B8E8C8'
      c.fillText(tip, W / 2, footY)
      c.restore()
    }
  } else {
    drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '编队不足', true, 13)
    c.save()
    const footPulse = 0.65 + 0.35 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
    c.globalAlpha = footPulse
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `bold ${8.5*S}px "PingFang SC",sans-serif`
    const footY = Math.min(goBtnY + goBtnH + 9 * S, btnBarY + btnBarH - 4 * S)
    let footHint = ''
    if (needPickWeapon) {
      footHint = '↑ 请先点击左侧法宝槽'
    } else {
      footHint = '↑ 人数未满：点上方「+」或下方卡片编入'
    }
    c.strokeStyle = 'rgba(0,0,0,0.75)'; c.lineWidth = 2.2 * S
    c.strokeText(footHint, W / 2, footY)
    c.fillStyle = '#F5E0A8'
    c.fillText(footHint, W / 2, footY)
    c.restore()
  }
  _rects.startBtnRect = canGo ? [goBtnX, goBtnY, goBtnW, goBtnH] : null

  // ── 灵宠列表（可滚动） ──
  const listTop = cy
  const listBottom = btnBarY - 4 * S
  c.save()
  c.beginPath(); c.rect(0, listTop, W, listBottom - listTop); c.clip()

  const pool = g.storage.petPool || []
  const filter = g._towerTeamFilter || 'all'
  const filtered = filter === 'all' ? pool : pool.filter(p => p.attr === filter)
  const sorted = filtered.slice().sort((a, b) => getPoolPetAtk(b) - getPoolPetAtk(a))

  _rects.petCardRects = []
  const cols = 5
  const gap = 5 * S
  const cw = (W - 20 * S - gap * (cols - 1)) / cols
  const ch = cw * 1.45
  let curY = listTop + gap + _scrollY
  const pulseBenchHint =
    !needPickWeapon &&
    (teamNeedMore ||
      (selected.length >= MIN_TEAM && selected.length < MAX_TEAM && _hasUnpickedPetsInPool(g, selected)))
  let pulseFirstPickCard = pulseBenchHint

  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cardX = 10 * S + col * (cw + gap)
    const cardY = curY + row * (ch + gap)

    _rects.petCardRects.push({ petId: sorted[i].id, rect: [cardX, cardY, cw, ch] })
    if (cardY + ch < listTop || cardY > listBottom) continue

    const pp = sorted[i]
    const pet = getPetById(pp.id)
    if (!pet) continue
    const isSelected = selected.includes(pp.id)
    const pAttrColor = ATTR_COLOR[pp.attr]
    const atk = getPoolPetAtk(pp)

    const cardBg = R.getImg('assets/ui/pet_card_bg.png')
    if (cardBg && cardBg.width > 0) {
      c.drawImage(cardBg, cardX, cardY, cw, ch)
    } else {
      c.fillStyle = 'rgba(30,20,10,0.75)'
      R.rr(cardX, cardY, cw, ch, 8*S); c.fill()
    }

    if (isSelected) {
      c.save()
      c.shadowColor = 'rgba(255,255,255,0.6)'; c.shadowBlur = 6 * S
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2 * S
      R.rr(cardX, cardY, cw, ch, 8*S); c.stroke()
      c.restore()
    }

    // 属性珠
    const orbPath = `assets/orbs/orb_${pp.attr || 'metal'}.png`
    const orbImg = R.getImg(orbPath)
    if (orbImg && orbImg.width > 0) {
      c.drawImage(orbImg, cardX + 4*S, cardY + 4*S, 12 * S, 12 * S)
    }

    // 头像
    const avatarSize = cw * 0.62
    const avatarX = cardX + (cw - avatarSize) / 2
    const avatarY = cardY + 8 * S
    const avatarPath = getPetAvatarPath({ ...pet, star: pp.star })
    R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 6 * S })

    if (isSelected) {
      c.fillStyle = 'rgba(0,0,0,0.55)'
      R.rr(cardX + cw/2 - 18*S, cardY + 3*S, 36*S, 13*S, 4*S); c.fill()
      c.fillStyle = '#7ECF6A'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('已上阵', cardX + cw / 2, cardY + 9.5*S)
    }

    // 名称
    const nameY = avatarY + avatarSize + 5 * S
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    const displayName = pet.name.length > 4 ? pet.name.slice(0, 4) + '…' : pet.name
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3 * S
    c.strokeText(displayName, cardX + cw / 2, nameY)
    c.fillStyle = isSelected ? '#ffd700' : '#fff'
    c.fillText(displayName, cardX + cw / 2, nameY)

    // 星级
    const starY = nameY + 14 * S
    c.font = `${10*S}px "PingFang SC",sans-serif`
    let starStr = ''
    for (let si = 0; si < 3; si++) starStr += '★'
    const totalStarW = c.measureText(starStr).width
    let starX = cardX + cw / 2 - totalStarW / 2
    c.textAlign = 'left'
    for (let si = 0; si < 3; si++) {
      c.fillStyle = si < pp.star ? '#ffd700' : 'rgba(120,120,120,0.5)'
      c.fillText('★', starX, starY)
      starX += c.measureText('★').width
    }
    c.textAlign = 'center'

    // ATK
    const atkY = starY + 14 * S
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2.5 * S
    c.strokeText(`ATK:${atk}`, cardX + cw / 2, atkY)
    c.fillStyle = '#FF6B6B'
    c.fillText(`ATK:${atk}`, cardX + cw / 2, atkY)

    if (pulseFirstPickCard && !isSelected) {
      const pulse = 0.45 + 0.35 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
      c.strokeStyle = `rgba(232,197,71,${pulse})`
      c.lineWidth = 2.5 * S
      R.rr(cardX - 2 * S, cardY - 2 * S, cw + 4 * S, ch + 4 * S, 10 * S)
      c.stroke()
      pulseFirstPickCard = false
    }
  }

  // 滚动限制
  const totalRows = Math.ceil(sorted.length / cols)
  const totalH = totalRows * (ch + gap) + gap
  const viewH = listBottom - listTop
  const maxScroll = Math.max(0, totalH - viewH)
  if (_scrollY < -maxScroll) _scrollY = -maxScroll
  if (_scrollY > 0) _scrollY = 0

  c.restore()

  // ── 法宝选择浮层 ──
  if (g._showWeaponPicker) {
    _drawWeaponPicker(g, c, R, S, W, H)
  }
}

// ===== 法宝说明折行 =====
function _wrapWeaponDescLines(c, text, maxW, fontPx) {
  c.font = `${fontPx}px "PingFang SC",sans-serif`
  const lines = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const test = line + ch
    if (c.measureText(test).width > maxW && line.length > 0) {
      lines.push(line)
      line = ch
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

// ===== 法宝选择浮层（四列网格 + 底部说明，与原先一致）=====
function _drawWeaponPicker(g, c, R, S, W, H) {
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)

  const collection = g.storage.weaponCollection || []
  let previewId = g._weaponPickerPreviewId
  if (collection.length > 0 && (!previewId || collection.indexOf(previewId) < 0)) {
    previewId = getDefaultWeaponPickerPreviewId(g.storage)
    g._weaponPickerPreviewId = previewId
  } else if (collection.length === 0) {
    previewId = null
    g._weaponPickerPreviewId = null
  }

  const detailH = previewId ? 118 * S : 0
  const pw = W * 0.88
  const ph = H * 0.5 + detailH
  const px = (W - pw) / 2
  const py = (H - ph) / 2
  const pad = 14 * S

  _rects.weaponCardRects = []
  _rects.weaponPreviewEquipRect = null
  _rects.weaponPreviewBackRect = null
  _rects.weaponPickerGridRect = null

  c.fillStyle = 'rgba(30,22,14,0.95)'
  R.rr(px, py, pw, ph, 12 * S); c.fill()
  c.strokeStyle = 'rgba(200,168,80,0.4)'; c.lineWidth = 1.5 * S
  R.rr(px, py, pw, ph, 12 * S); c.stroke()

  c.fillStyle = '#F5E6C8'; c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('选择法宝', W / 2, py + 20 * S)

  c.fillStyle = '#a89868'; c.font = `${9 * S}px "PingFang SC",sans-serif`
  c.fillText('点击法宝查看完整效果，下方确认后再装备', W / 2, py + 34 * S)

  const eqId = g.storage.equippedWeaponId
  const cols = 4
  const iconGap = 8 * S
  const innerW = pw - pad * 2
  const iconSz = Math.floor((innerW - iconGap * (cols - 1)) / cols)
  const textH = 28 * S
  let wy = py + 46 * S
  const gridBottom = py + ph - pad - detailH - 6 * S

  if (collection.length === 0) {
    c.fillStyle = '#888'; c.font = `${12 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('暂无法宝，通关关卡可获得', W / 2, wy + 40 * S)
  } else {
    const rowStride = iconSz + textH + iconGap
    const numRows = Math.ceil(collection.length / cols)
    const totalGridH = (numRows - 1) * rowStride + iconSz + textH
    const gridViewportH = gridBottom - wy
    const maxScrollPick = Math.max(0, totalGridH - gridViewportH)
    let scrollPick = g._weaponPickerScroll || 0
    if (scrollPick > 0) scrollPick = 0
    if (scrollPick < -maxScrollPick) scrollPick = -maxScrollPick
    g._weaponPickerScroll = scrollPick

    _rects.weaponPickerGridRect = [px + pad - 2 * S, wy, innerW + 4 * S, Math.max(0, gridViewportH)]

    c.save()
    c.beginPath()
    c.rect(px + pad - 2 * S, wy, innerW + 4 * S, gridViewportH)
    c.clip()

    for (let i = 0; i < collection.length; i++) {
      const col = i % cols
      const row = Math.floor(i / cols)
      const wx = px + pad + col * (iconSz + iconGap)
      const cardY = wy + row * rowStride + scrollPick

      const wpn = getWeaponById(collection[i])
      if (!wpn) continue

      const isEquipped = wpn.id === eqId
      const isPreview = wpn.id === previewId
      c.fillStyle = isPreview ? 'rgba(200,180,100,0.25)' : isEquipped ? 'rgba(255,215,0,0.15)' : 'rgba(30,25,18,0.85)'
      c.fillRect(wx + 1, cardY + 1, iconSz - 2, iconSz - 2)

      R.drawCoverImg(R.getImg(`assets/equipment/fabao_${wpn.id}.png`), wx + 1, cardY + 1, iconSz - 2, iconSz - 2, { radius: 4 * S })

      R.drawWeaponFrame(wx, cardY, iconSz)

      if (isEquipped) {
        c.save()
        c.shadowColor = 'rgba(255,215,0,0.6)'; c.shadowBlur = 6 * S
        c.strokeStyle = '#ffd700'; c.lineWidth = 2 * S
        c.strokeRect(wx, cardY, iconSz, iconSz)
        c.restore()
        const eqBarH = 12 * S
        c.fillStyle = 'rgba(0,0,0,0.6)'
        R.rr(wx + 1, cardY + iconSz - eqBarH - 1, iconSz - 2, eqBarH, 3 * S); c.fill()
        c.fillStyle = '#ffd700'; c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText('装备中', wx + iconSz / 2, cardY + iconSz - eqBarH / 2 - 1)
      }

      const rarityKey = getWeaponRarity(wpn.id) || 'R'
      drawCornerRarityBadge(c, R, S, wx + 3 * S, cardY + (isEquipped ? 14 * S : 3 * S), rarityKey, wpn.attr, {
        minWidth: 18 * S,
        height: 10 * S,
        fontSize: 6.4 * S,
        radius: 2.6 * S,
      })

      c.fillStyle = '#ddd'; c.font = `bold ${8 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'top'
      const wName = wpn.name.length > 4 ? wpn.name.slice(0, 4) + '…' : wpn.name
      c.fillText(wName, wx + iconSz / 2, cardY + iconSz + 3 * S)
      c.fillStyle = '#8a7a58'; c.font = `${7 * S}px "PingFang SC",sans-serif`
      c.fillText('点选看说明', wx + iconSz / 2, cardY + iconSz + 14 * S)

      _rects.weaponCardRects.push({ weaponId: wpn.id, rect: [wx, cardY, iconSz, iconSz + textH] })
    }
    c.restore()
  }

  if (previewId) {
    const pwpn = getWeaponById(previewId)
    const dTop = py + ph - detailH - pad + 4 * S
    c.strokeStyle = 'rgba(200,168,80,0.35)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, dTop); c.lineTo(px + pw - pad, dTop); c.stroke()

    if (pwpn) {
      c.fillStyle = '#F5E6C8'; c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'; c.textBaseline = 'top'
      c.fillText(`法宝·${pwpn.name}`, px + pad, dTop + 6 * S)

      const descFont = 10 * S
      const descMaxW = pw - pad * 2
      const descLines = _wrapWeaponDescLines(c, pwpn.desc || '', descMaxW, descFont)
      c.fillStyle = '#c9c2b0'; c.font = `${descFont}px "PingFang SC",sans-serif`
      let ly = dTop + 24 * S
      const maxLines = 3
      for (let li = 0; li < Math.min(descLines.length, maxLines); li++) {
        c.fillText(descLines[li], px + pad, ly)
        ly += descFont + 3 * S
      }
      if (descLines.length > maxLines) {
        c.fillStyle = '#888'; c.font = `${9 * S}px "PingFang SC",sans-serif`
        c.fillText('…', px + pad, ly)
      }

      const btnH = 30 * S
      const btnY = py + ph - pad - btnH - 4 * S
      const btnGap = 10 * S
      const btnW = (pw - pad * 2 - btnGap) / 2
      const bx1 = px + pad
      const bx2 = bx1 + btnW + btnGap

      c.fillStyle = 'rgba(60,55,48,0.9)'
      R.rr(bx1, btnY, btnW, btnH, 6 * S); c.fill()
      c.strokeStyle = 'rgba(180,160,120,0.5)'; c.lineWidth = 1 * S
      R.rr(bx1, btnY, btnW, btnH, 6 * S); c.stroke()
      c.fillStyle = '#ccc'; c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('返回', bx1 + btnW / 2, btnY + btnH / 2)
      _rects.weaponPreviewBackRect = [bx1, btnY, btnW, btnH]

      const already = pwpn.id === eqId
      if (already) {
        c.fillStyle = 'rgba(80,75,70,0.85)'
        R.rr(bx2, btnY, btnW, btnH, 6 * S); c.fill()
        c.fillStyle = '#888'; c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
        c.fillText('已装备', bx2 + btnW / 2, btnY + btnH / 2)
      } else {
        c.fillStyle = 'rgba(100,140,80,0.45)'
        R.rr(bx2, btnY, btnW, btnH, 6 * S); c.fill()
        c.strokeStyle = 'rgba(160,220,120,0.5)'; c.lineWidth = 1 * S
        R.rr(bx2, btnY, btnW, btnH, 6 * S); c.stroke()
        c.fillStyle = '#d4ffc4'; c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
        c.fillText('装备此法宝', bx2 + btnW / 2, btnY + btnH / 2)
      }
      _rects.weaponPreviewEquipRect = [bx2, btnY, btnW, btnH]
    }
  }

  _rects.weaponPickerRect = [px, py, pw, ph]
}

// ===== 触摸 =====
function tTowerTeam(g, x, y, type) {
  if (type === 'start') {
    _touchStartY = y; _touchLastY = y; _touchStartX = x; _scrolling = false
    _holdStartTime = Date.now()
    _holdTarget = null
    _weaponPickerTouchInGrid = !!(g._showWeaponPicker && _rects.weaponPickerGridRect && g._hitRect(x, y, ..._rects.weaponPickerGridRect))
    for (const item of _rects.petCardRects) {
      if (g._hitRect(x, y, ...item.rect)) {
        _holdTarget = { petId: item.petId }
        break
      }
    }
    return
  }
  if (type === 'move') {
    const dy = y - _touchLastY; _touchLastY = y
    if (Math.abs(y - _touchStartY) > 5 * V.S || Math.abs(x - _touchStartX) > 5 * V.S) {
      _scrolling = true
      _holdTarget = null
    }
    if (g._showWeaponPicker) {
      if (_weaponPickerTouchInGrid && _scrolling) {
        g._weaponPickerScroll = (g._weaponPickerScroll || 0) + dy
      }
      return
    }
    if (_scrolling) _scrollY += dy
    return
  }
  if (type !== 'end') return

  // 法宝选择浮层
  if (g._showWeaponPicker) {
    if (_scrolling) return
    const prevId = g._weaponPickerPreviewId
    if (prevId) {
      if (_rects.weaponPreviewBackRect && g._hitRect(x, y, ..._rects.weaponPreviewBackRect)) {
        g._weaponPickerPreviewId = null
        g._showWeaponPicker = false
        return
      }
      if (_rects.weaponPreviewEquipRect && g._hitRect(x, y, ..._rects.weaponPreviewEquipRect)) {
        if (g.storage.equippedWeaponId === prevId) {
          g._weaponPickerPreviewId = null
          g._showWeaponPicker = false
          return
        }
        g.storage.equipWeapon(prevId)
        g._weaponPickerPreviewId = null
        g._showWeaponPicker = false
        return
      }
    }
    for (const item of _rects.weaponCardRects) {
      if (g._hitRect(x, y, ...item.rect)) {
        g._weaponPickerPreviewId = item.weaponId
        return
      }
    }
    if (_rects.weaponPickerRect && !g._hitRect(x, y, ..._rects.weaponPickerRect)) {
      g._showWeaponPicker = false
      g._weaponPickerPreviewId = null
    }
    return
  }

  // 长按宠物详情
  const elapsed = Date.now() - _holdStartTime
  if (elapsed >= 500 && !_scrolling && _holdTarget) {
    g._petDetailId = _holdTarget.petId
    g._petDetailReturnScene = 'towerTeam'
    _holdTarget = null
    g.setScene('petDetail')
    return
  }
  _holdTarget = null

  if (_scrolling) return

  const selected = _ensureSelected(g)

  // 出发按钮（与秘境：先校验法宝，未满编时二次确认）
  if (_rects.startBtnRect && g._hitRect(x, y, ..._rects.startBtnRect)) {
    const wCol = g.storage.weaponCollection || []
    if (wCol.length > 0 && !g.storage.equippedWeaponId) {
      P.showGameToast('请先点击左侧法宝槽，查看说明并装备一件法宝后再出发')
      return
    }
    const sel = _ensureSelected(g)
    const needConfirmIncomplete =
      sel.length < MAX_TEAM && _hasUnpickedPetsInPool(g, sel)
    if (needConfirmIncomplete) {
      const empty = MAX_TEAM - sel.length
      g._confirmDialog = {
        title: '编队未满',
        content:
          `上方还有 ${empty} 个空位，下方仍有可上阵的灵宠。\n` +
          '建议补满编队，战力更完整！',
        confirmText: '继续出发',
        cancelText: '去补充',
        timer: 0,
        onConfirm() { g._startRun(sel) },
      }
      return
    }
    g._startRun(sel)
    return
  }

  // 返回
  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g._towerTeamSelected = null
    g._towerTeamFilter = 'all'
    g.setScene('title')
    return
  }

  // 法宝槽
  if (_rects.weaponSlotRect && g._hitRect(x, y, ..._rects.weaponSlotRect)) {
    g._weaponPickerPreviewId = getDefaultWeaponPickerPreviewId(g.storage)
    g._weaponPickerScroll = 0
    g._showWeaponPicker = true
    return
  }

  // 宠物槽点击取消
  for (let i = 0; i < _rects.slotRects.length; i++) {
    if (i < selected.length && g._hitRect(x, y, ..._rects.slotRects[i])) {
      selected.splice(i, 1)
      return
    }
  }

  // 筛选标签
  for (const f of _rects.filterRects) {
    if (g._hitRect(x, y, ...f.rect)) {
      g._towerTeamFilter = f.key; _scrollY = 0
      return
    }
  }

  // 宠物卡片
  for (const item of _rects.petCardRects) {
    if (g._hitRect(x, y, ...item.rect)) {
      const idx = selected.indexOf(item.petId)
      if (idx >= 0) {
        selected.splice(idx, 1)
        return
      }
      if (selected.length < MAX_TEAM) {
        selected.push(item.petId)
      } else {
        P.showGameToast('编队已满（最多5只）')
      }
      return
    }
  }
}

function resetScroll() { _scrollY = 0 }

module.exports = { rTowerTeam, tTowerTeam, resetScroll }
