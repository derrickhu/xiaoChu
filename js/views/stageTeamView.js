/**
 * 编队页 — 上方编队槽位+队长技能 + 下方灵宠池列表 + 底部开始战斗
 * 参考：图2 — 编队调整界面
 * 编队修改后自动保存；可在此页面直接开始战斗
 * 长按宠物卡片显示详情弹窗（图2样式）
 * 渲染入口：rStageTeam  触摸入口：tStageTeam
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetSkillDesc, petHasSkill } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getStageById, getStageAttr } = require('../data/stages')

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'metal', label: '金' },
  { key: 'wood', label: '木' },
  { key: 'water', label: '水' },
  { key: 'fire', label: '火' },
  { key: 'earth', label: '土' },
]

const _rects = {
  slotRects: [],
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
// 长按检测
let _holdStartTime = 0
let _holdTarget = null  // { petId } 待长按触发

// 头像框缓存
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

// ===== 渲染 =====
function rStageTeam(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  // 背景：复用灵宠池背景，遮罩更浅
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }
  c.fillStyle = 'rgba(0,0,0,0.25)'
  c.fillRect(0, 0, W, H)

  const stage = getStageById(g._selectedStageId)
  if (!stage) return
  const selected = g._stageTeamSelected || []
  const stageAttr = getStageAttr(g._selectedStageId)
  const counterAttr = { metal: 'fire', wood: 'metal', water: 'fire', fire: 'water', earth: 'wood' }
  const recAttr = counterAttr[stageAttr]
  const framePetMap = _getFramePetMap(R)

  const topY = safeTop + 4 * S
  const px = 14 * S
  let cy = topY

  // ── 返回按钮 + 标题（深色衬底） ──
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
  c.restore()
  cy += 40 * S

  // ── 编队槽位（上方面板） ──
  c.fillStyle = 'rgba(40,30,20,0.7)'
  R.rr(8*S, cy, W - 16*S, 90*S, 10*S); c.fill()
  c.strokeStyle = 'rgba(200,180,120,0.2)'; c.lineWidth = 1*S
  R.rr(8*S, cy, W - 16*S, 90*S, 10*S); c.stroke()

  const slotSize = 52 * S
  const slotGap = 8 * S
  const maxSlots = stage.teamSize.max
  const slotsW = maxSlots * slotSize + (maxSlots - 1) * slotGap
  const slotStartX = (W - slotsW) / 2
  const slotY = cy + 8 * S
  const slotFrameScale = 1.12
  const slotFrameSz = slotSize * slotFrameScale
  const slotFrameOf = (slotFrameSz - slotSize) / 2
  _rects.slotRects = []

  for (let i = 0; i < maxSlots; i++) {
    const sx = slotStartX + i * (slotSize + slotGap)
    _rects.slotRects.push([sx, slotY, slotSize, slotSize])

    if (i < selected.length) {
      const pid = selected[i]
      const pet = getPetById(pid)
      const poolPet = g.storage.getPoolPet(pid)
      if (pet && poolPet) {
        const pAttrColor = ATTR_COLOR[pet.attr]

        // 属性色背景
        c.fillStyle = pAttrColor ? pAttrColor.bg || pAttrColor.main + '30' : '#1a1a2e'
        c.fillRect(sx, slotY, slotSize, slotSize)

        // 属性色顶条
        c.fillStyle = pAttrColor ? pAttrColor.main : '#888'
        R.rr(sx, slotY, slotSize, 4*S, 4*S); c.fill()

        // 头像
        const avatarPath = getPetAvatarPath({ ...pet, star: poolPet.star })
        const img = R.getImg(avatarPath)
        if (img && img.width > 0) {
          const aw = img.width, ah = img.height
          const drawW = slotSize - 2
          const drawH = drawW * (ah / aw)
          const avDy = slotY + (slotSize - 2) - drawH
          c.save()
          c.beginPath(); c.rect(sx + 1, slotY + 1, slotSize - 2, slotSize - 2); c.clip()
          c.drawImage(img, sx + 1, avDy, drawW, drawH)
          c.restore()
        } else {
          c.fillStyle = pAttrColor ? pAttrColor.main : '#555'
          c.globalAlpha = 0.3
          R.rr(sx + 3*S, slotY + 6*S, slotSize - 6*S, slotSize - 20*S, 4*S); c.fill()
          c.globalAlpha = 1
          c.fillStyle = '#fff'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText(pet.name.slice(0, 1), sx + slotSize / 2, slotY + slotSize / 2 - 4*S)
        }

        // 头像框
        const petFrame = framePetMap[pet.attr] || framePetMap.metal
        if (petFrame && petFrame.width > 0) {
          c.drawImage(petFrame, sx - slotFrameOf, slotY - slotFrameOf, slotFrameSz, slotFrameSz)
        }


        // 队长标记
        if (i === 0) {
          const capW = 24 * S, capH = 12 * S
          c.fillStyle = 'rgba(255,215,0,0.9)'
          R.rr(sx, slotY, capW, capH, 3 * S); c.fill()
          c.fillStyle = '#3D2B15'; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText('队长', sx + capW / 2, slotY + capH / 2)
        }

        // 星级
        const starStr = '★'.repeat(poolPet.star)
        c.fillStyle = '#ffd700'; c.font = `${7*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'top'
        c.strokeStyle = 'rgba(0,0,0,0.8)'; c.lineWidth = 1.5*S
        c.strokeText(starStr, sx + slotSize / 2, slotY + slotSize - 10*S)
        c.fillText(starStr, sx + slotSize / 2, slotY + slotSize - 10*S)
      }
    } else {
      // 空槽
      c.fillStyle = 'rgba(80,70,50,0.5)'
      R.rr(sx, slotY, slotSize, slotSize, 8*S); c.fill()
      c.strokeStyle = 'rgba(200,180,120,0.25)'; c.lineWidth = 1*S
      R.rr(sx, slotY, slotSize, slotSize, 8*S); c.stroke()
      c.fillStyle = '#666'; c.font = `${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('+', sx + slotSize / 2, slotY + slotSize / 2)
    }
  }
  cy += 64 * S

  // ── 队长技能 ──
  const leaderSkillY = cy
  const lsGrad = c.createLinearGradient(8*S, leaderSkillY, 8*S, leaderSkillY + 52*S)
  lsGrad.addColorStop(0, 'rgba(252,245,220,0.88)')
  lsGrad.addColorStop(1, 'rgba(244,234,200,0.90)')
  c.fillStyle = lsGrad
  R.rr(8*S, leaderSkillY, W - 16*S, 52*S, 6*S); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.35)'; c.lineWidth = 1*S
  R.rr(8*S, leaderSkillY, W - 16*S, 52*S, 6*S); c.stroke()

  if (selected.length > 0) {
    const leaderId = selected[0]
    const leaderPet = getPetById(leaderId)
    const leaderPool = g.storage.getPoolPet(leaderId)
    if (leaderPet && leaderPool) {
      const fakePet = { ...leaderPet, star: leaderPool.star }
      const hasSkill = petHasSkill(fakePet)
      c.textAlign = 'left'; c.textBaseline = 'middle'
      c.fillStyle = '#6B4A10'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText('队长技能', px + 4*S, leaderSkillY + 14*S)
      if (hasSkill) {
        c.fillStyle = '#3a7a2a'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText(leaderPet.skill.name, px + 60*S, leaderSkillY + 14*S)
        const desc = getPetSkillDesc(fakePet) || ''
        c.fillStyle = '#8B6B30'; c.font = `${8*S}px "PingFang SC",sans-serif`
        const maxW = W - 36 * S
        const displayDesc = c.measureText(desc).width > maxW ? desc.slice(0, 20) + '…' : desc
        c.fillText(displayDesc, px + 4*S, leaderSkillY + 34*S)
      } else {
        c.fillStyle = '#9B8B60'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText('★2解锁', px + 60*S, leaderSkillY + 14*S)
      }
    }
  } else {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#9B8B60'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('选择灵宠后显示队长技能', W / 2, leaderSkillY + 26*S)
  }
  cy = leaderSkillY + 56 * S

  // ── 备选角色标题 + 克制提示 + 长按提示 ──
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#C8B78A'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText('◆ 备选角色', px, cy)
  if (recAttr) {
    c.textAlign = 'right'
    c.fillStyle = ATTR_COLOR[recAttr] ? ATTR_COLOR[recAttr].main : '#ccc'
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(`推荐${ATTR_NAME[recAttr]}属性克制`, W - px, cy)
  }
  cy += 16 * S
  // 长按提示（小字，居右，灰色）
  c.textAlign = 'right'; c.textBaseline = 'top'
  c.fillStyle = 'rgba(200,190,160,0.7)'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText('长按灵宠可查看详情', W - px, cy)
  cy += 14 * S

  // ── 属性筛选标签 ──
  _rects.filterRects = []
  const tabW = (W - 20 * S) / FILTERS.length
  for (let i = 0; i < FILTERS.length; i++) {
    const f = FILTERS[i]
    const fx = 10*S + i * tabW
    const active = (g._stageTeamFilter || 'all') === f.key
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

  // ── 底部按钮栏（先画，再裁切列表区域） ──
  const btnBarH = 72 * S
  const btnBarY = H - btnBarH
  c.fillStyle = 'rgba(20,14,8,0.92)'
  c.fillRect(0, btnBarY, W, btnBarH)
  // 上边线
  c.strokeStyle = 'rgba(200,168,80,0.3)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(0, btnBarY); c.lineTo(W, btnBarY); c.stroke()

  const canGo = selected.length >= stage.teamSize.min
  const goBtnW = W * 0.6, goBtnH = 44 * S
  const goBtnX = (W - goBtnW) / 2, goBtnY = btnBarY + 20 * S
  // 消耗提示（按钮上方，图标+数值，带描边增强可读性）
  {
    const costText = `消耗：`
    const costNum = `${stage.staminaCost}`
    c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    const costLabelW = c.measureText(costText).width
    const costNumW = c.measureText(costNum).width
    const iconSz = 14 * S
    const gap = 3 * S
    const totalW = costLabelW + iconSz + gap + costNumW
    const costX = W / 2 - totalW / 2
    const costY = goBtnY - 10 * S
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 3 * S
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.strokeText(costText, costX, costY)
    c.fillStyle = '#FFF5E0'
    c.fillText(costText, costX, costY)
    const stIcon = R.getImg('assets/ui/icon_stamina.png')
    const iconX = costX + costLabelW
    if (stIcon && stIcon.width > 0) {
      c.drawImage(stIcon, iconX, costY - iconSz / 2, iconSz, iconSz)
    } else {
      c.fillStyle = '#3aaeff'; c.fillText('⚡', iconX, costY)
    }
    // 体力数字：无描边，仅 fillText 色 #3aaeff
    c.fillStyle = '#3aaeff'
    c.fillText(costNum, iconX + iconSz + gap, costY)
  }

  // 开始战斗按钮（与stageInfoView一致）
  if (canGo) {
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (btnImg && btnImg.width > 0) {
      c.drawImage(btnImg, goBtnX, goBtnY, goBtnW, goBtnH)
    } else {
      _drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '开始战斗', false)
    }
    c.fillStyle = '#FFF5E0'; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2 * S
    c.strokeText('开始战斗', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
    c.fillText('开始战斗', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
  } else {
    _drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '编队不足', true)
  }
  _rects.startBtnRect = canGo ? [goBtnX, goBtnY, goBtnW, goBtnH] : null

  // ── 灵宠列表（可滚动，裁切到按钮栏上方） ──
  const listTop = cy
  const listBottom = btnBarY - 4 * S
  c.save()
  c.beginPath(); c.rect(0, listTop, W, listBottom - listTop); c.clip()

  const pool = g.storage.petPool || []
  const filter = g._stageTeamFilter || 'all'
  const filtered = filter === 'all' ? pool : pool.filter(p => p.attr === filter)
  // 按攻击力降序排列
  const sorted = filtered.slice().sort((a, b) => getPoolPetAtk(b) - getPoolPetAtk(a))

  _rects.petCardRects = []
  const cols = 5
  const gap = 5 * S
  const cw = (W - 20 * S - gap * (cols - 1)) / cols
  const ch = cw * 1.45
  let curY = listTop + gap + _scrollY

  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = 10 * S + col * (cw + gap)
    const cardY = curY + row * (ch + gap)

    _rects.petCardRects.push({ petId: sorted[i].id, rect: [cx, cardY, cw, ch] })

    if (cardY + ch < listTop || cardY > listBottom) continue

    const pp = sorted[i]
    const pet = getPetById(pp.id)
    if (!pet) continue
    const isSelected = selected.includes(pp.id)
    const pAttrColor = ATTR_COLOR[pp.attr]
    const atk = getPoolPetAtk(pp)
    // ── 卡片底图（与灵宠池一致） ──
    const cardBg = R.getImg('assets/ui/pet_card_bg.png')
    if (cardBg && cardBg.width > 0) {
      c.drawImage(cardBg, cx, cardY, cw, ch)
    } else {
      c.fillStyle = 'rgba(30,20,10,0.75)'
      R.rr(cx, cardY, cw, ch, 8*S); c.fill()
    }

    // 已选中：白色外边框高亮
    if (isSelected) {
      c.save()
      c.shadowColor = 'rgba(255,255,255,0.6)'; c.shadowBlur = 6 * S
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 2 * S
      R.rr(cx, cardY, cw, ch, 8*S); c.stroke()
      c.restore()
    }

    // 属性珠子（左上角，小尺寸）
    const orbPath = `assets/orbs/orb_${pp.attr || 'metal'}.png`
    const orbImg = R.getImg(orbPath)
    if (orbImg && orbImg.width > 0) {
      const orbSz = 12 * S
      c.drawImage(orbImg, cx + 4*S, cardY + 4*S, orbSz, orbSz)
    }

    // 头像（正常裁剪，不溢出）
    const avatarSize = cw * 0.62
    const avatarX = cx + (cw - avatarSize) / 2
    const avatarY = cardY + 8 * S
    const avatarPath = getPetAvatarPath({ ...pet, star: pp.star })
    const img = R.getImg(avatarPath)
    if (img && img.width > 0) {
      c.save()
      R.rr(avatarX, avatarY, avatarSize, avatarSize, 6*S); c.clip()
      const aw = img.width, ah = img.height
      const scale = Math.max(avatarSize / aw, avatarSize / ah)
      const dw = aw * scale, dh = ah * scale
      c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
      c.restore()
    } else {
      c.fillStyle = pAttrColor ? pAttrColor.main : '#555'
      c.globalAlpha = 0.3
      R.rr(avatarX, avatarY, avatarSize, avatarSize, 6*S); c.fill()
      c.globalAlpha = 1
      c.fillStyle = '#fff'; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(pet.name.slice(0, 1), cx + cw / 2, avatarY + avatarSize / 2)
    }

    // 已上阵：卡片顶部小标签（不遮挡内容）
    if (isSelected) {
      c.fillStyle = 'rgba(0,0,0,0.55)'
      R.rr(cx + cw/2 - 18*S, cardY + 3*S, 36*S, 13*S, 4*S); c.fill()
      c.fillStyle = '#7ECF6A'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('已上阵', cx + cw / 2, cardY + 9.5*S)
    }

    // 克制标签
    if (recAttr && pp.attr === recAttr && !isSelected) {
      c.fillStyle = 'rgba(0,0,0,0.55)'
      R.rr(cx + cw - 24*S, cardY + 18*S, 22*S, 13*S, 4*S); c.fill()
      c.fillStyle = ATTR_COLOR[recAttr] ? ATTR_COLOR[recAttr].main : '#8f8'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('克制', cx + cw - 13*S, cardY + 24.5*S)
    }

    // 名称
    const nameY = avatarY + avatarSize + 5 * S
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    const displayName = pet.name.length > 4 ? pet.name.slice(0, 4) + '…' : pet.name
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3 * S
    c.strokeText(displayName, cx + cw / 2, nameY)
    c.fillStyle = isSelected ? '#ffd700' : '#fff'
    c.fillText(displayName, cx + cw / 2, nameY)

    // 星级
    const starY = nameY + 14 * S
    c.font = `${10*S}px "PingFang SC",sans-serif`
    let starStr = ''
    for (let si = 0; si < 3; si++) starStr += '★'
    const totalStarW = c.measureText(starStr).width
    let starX = cx + cw / 2 - totalStarW / 2
    c.textAlign = 'left'
    for (let si = 0; si < 3; si++) {
      c.fillStyle = si < pp.star ? '#ffd700' : 'rgba(120,120,120,0.5)'
      c.fillText('★', starX, starY)
      starX += c.measureText('★').width
    }
    c.textAlign = 'center'

    // ATK（红色）
    const atkY = starY + 14 * S
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2.5 * S
    c.strokeText(`ATK:${atk}`, cx + cw / 2, atkY)
    c.fillStyle = '#FF6B6B'
    c.fillText(`ATK:${atk}`, cx + cw / 2, atkY)
  }

  // 滚动限制
  const totalRows = Math.ceil(sorted.length / cols)
  const totalH = totalRows * (ch + gap) + gap
  const viewH = listBottom - listTop
  const maxScroll = Math.max(0, totalH - viewH)
  if (_scrollY < -maxScroll) _scrollY = -maxScroll
  if (_scrollY > 0) _scrollY = 0

  c.restore()

}

// ===== 触摸 =====
function tStageTeam(g, x, y, type) {
  if (type === 'start') {
    _touchStartY = y; _touchLastY = y; _touchStartX = x; _scrolling = false
    _holdStartTime = Date.now()
    _holdTarget = null
    // 记录按下的宠物卡片
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
      _holdTarget = null // 移动则取消长按
    }
    if (_scrolling) _scrollY += dy
    return
  }
  if (type !== 'end') return

  // 长按检测（≥500ms 且未滚动 → 跳转宠物详情全屏页）
  const elapsed = Date.now() - _holdStartTime
  if (elapsed >= 500 && !_scrolling && _holdTarget) {
    g._petDetailId = _holdTarget.petId
    g._petDetailReturnScene = 'stageTeam'
    _holdTarget = null
    g.scene = 'petDetail'
    return
  }
  _holdTarget = null

  if (_scrolling) return

  const stage = getStageById(g._selectedStageId)
  if (!stage) return
  const selected = g._stageTeamSelected || (g._stageTeamSelected = [])

  // 开始战斗
  if (_rects.startBtnRect && g._hitRect(x, y, ..._rects.startBtnRect)) {
    // 保存编队
    g.storage.saveStageteam(selected)
    // 检查体力
    if (g.storage.currentStamina < stage.staminaCost) {
      g._toastMsg = '体力不足'; return
    }
    if (!g.storage.canChallengeStage(g._selectedStageId, stage.dailyLimit)) {
      g._toastMsg = '今日挑战次数已用完'; return
    }
    const stageMgr = require('../engine/stageManager')
    stageMgr.startStage(g, g._selectedStageId, selected)
    return
  }

  // 返回（回到关卡信息页，同时保存编队）
  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g.storage.saveStageteam(selected)
    g.scene = 'stageInfo'
    return
  }

  // 槽位点击（取消选择该宠物）
  for (let i = 0; i < _rects.slotRects.length; i++) {
    if (i < selected.length && g._hitRect(x, y, ..._rects.slotRects[i])) {
      selected.splice(i, 1)
      return
    }
  }

  // 筛选标签
  for (const f of _rects.filterRects) {
    if (g._hitRect(x, y, ...f.rect)) {
      g._stageTeamFilter = f.key; _scrollY = 0
      return
    }
  }

  // 宠物卡片（选入/取消）
  for (const item of _rects.petCardRects) {
    if (g._hitRect(x, y, ...item.rect)) {
      const idx = selected.indexOf(item.petId)
      if (idx >= 0) {
        selected.splice(idx, 1)
      } else if (selected.length < stage.teamSize.max) {
        selected.push(item.petId)
      }
      return
    }
  }
}

// ===== 工具 =====

/** 金色按钮 */
function _drawGoldBtn(c, R, S, x, y, w, h, text, disabled) {
  const r = h / 2
  if (disabled) {
    c.fillStyle = 'rgba(80,70,50,0.6)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = '#666'; c.lineWidth = 1.5*S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#888'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(text, x + w / 2, y + h / 2)
    return
  }
  c.save()
  c.shadowColor = 'rgba(180,120,30,0.4)'; c.shadowBlur = 10*S; c.shadowOffsetY = 3*S
  const bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#B8451A'); bg.addColorStop(0.5, '#9C3512'); bg.addColorStop(1, '#7A2A0E')
  c.fillStyle = bg; R.rr(x, y, w, h, r); c.fill()
  c.restore()
  c.strokeStyle = '#D4A843'; c.lineWidth = 2*S
  R.rr(x, y, w, h, r); c.stroke()
  c.save(); c.globalAlpha = 0.2
  const hl = c.createLinearGradient(x, y, x, y + h * 0.4)
  hl.addColorStop(0, '#fff'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hl; R.rr(x + 2*S, y + 2*S, w - 4*S, h * 0.4, r); c.fill()
  c.restore()
  c.fillStyle = '#FFE8B8'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 4*S
  c.fillText(text, x + w / 2, y + h / 2)
  c.shadowBlur = 0
}

function resetScroll() { _scrollY = 0 }

module.exports = { rStageTeam, tStageTeam, resetScroll }
