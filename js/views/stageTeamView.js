/**
 * 编队页 — 上方编队槽位+队长技能 + 下方灵宠池列表 + 底部开始战斗
 * 参考：图2 — 编队调整界面
 * 编队修改后自动保存；可在此页面直接开始战斗
 * 长按宠物卡片显示详情弹窗（图2样式）
 * 渲染入口：rStageTeam  触摸入口：tStageTeam
 */
const V = require('./env')
const P = require('../platform')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetSkillDesc, petHasSkill } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getStageById, getEffectiveStageTeamMin, getEnemyPortraitPath } = require('../data/stages')
const { getWeaponById } = require('../data/weapons')
const { drawGoldBtn } = require('./uiUtils')

const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'metal', label: '金' },
  { key: 'wood', label: '木' },
  { key: 'water', label: '水' },
  { key: 'fire', label: '火' },
  { key: 'earth', label: '土' },
]

/** 编队不足时槽位/卡片引导描边的闪烁周期（与 needPickWeapon 一致） */
const TEAM_GUIDE_PULSE_PERIOD = 420

/** 灵宠池里是否还有未编入当前队伍的灵宠 */
function _hasUnpickedPetsInPool(g, selectedIds) {
  const pool = g.storage.petPool || []
  for (let i = 0; i < pool.length; i++) {
    const p = pool[i]
    if (p && p.id && selectedIds.indexOf(p.id) < 0) return true
  }
  return false
}

/** 保存编队并开始秘境战斗（体力、次数校验在内） */
function _startStageBattle(g, selected, stage) {
  g.storage.saveStageteam(selected)
  if (g.storage.currentStamina < stage.staminaCost) {
    const AdManager = require('../adManager')
    if (!AdManager.openStaminaRecoveryConfirm(g)) P.showGameToast('体力不足')
    return
  }
  if (stage.dailyLimit > 0 && !g.storage.canChallengeStage(g._selectedStageId, stage.dailyLimit)) {
    P.showGameToast('今日挑战次数已用完')
    return
  }
  const stageMgr = require('../engine/stageManager')
  stageMgr.startStage(g, g._selectedStageId, selected)
}

const _rects = {
  slotRects: [],
  weaponSlotRect: null,
  weaponCardRects: [],
  weaponPreviewEquipRect: null,
  weaponPreviewBackRect: null,
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
  const minTeam = getEffectiveStageTeamMin(g.storage, stage)
  const teamNeedMore = selected.length < minTeam
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

  // ── 怪物信息面板（参考通天塔战前页：头像+名称+属性+弱点/抵抗） ──
  {
    const allEnemies = []
    for (const w of (stage.waves || [])) {
      for (const e of (w.enemies || [])) if (e) allEnemies.push(e)
    }
    if (allEnemies.length > 0) {
      const cardPad = 10 * S
      const cardH = allEnemies.length > 1 ? 72 * S : 64 * S
      const cardX = 8 * S, cardW = W - 16 * S
      c.fillStyle = 'rgba(30,22,14,0.75)'
      R.rr(cardX, cy, cardW, cardH, 10 * S); c.fill()
      c.strokeStyle = 'rgba(200,168,80,0.25)'; c.lineWidth = 1 * S
      R.rr(cardX, cy, cardW, cardH, 10 * S); c.stroke()

      if (stage.difficulty === 'elite') {
        c.fillStyle = 'rgba(180,50,50,0.2)'; R.rr(cardX, cy, cardW, cardH, 10 * S); c.fill()
      }

      const perEnemyH = (cardH - cardPad) / allEnemies.length
      for (let ei = 0; ei < allEnemies.length; ei++) {
        const e = allEnemies[ei]
        const ey = cy + cardPad / 2 + ei * perEnemyH
        const ac = ATTR_COLOR[e.attr]

        const avatarSz = Math.min(perEnemyH - 4 * S, 46 * S)
        const avatarX = cardX + cardPad
        const avatarY = ey + (perEnemyH - avatarSz) / 2
        c.fillStyle = ac ? ac.bg : '#1a1a2e'
        R.rr(avatarX, avatarY, avatarSz, avatarSz, 6 * S); c.fill()
        const ePath = e.avatar ? `assets/${e.avatar}.png` : null
        const eImg = ePath ? R.getImg(ePath) : null
        if (eImg && eImg.width > 0) {
          c.save()
          R.rr(avatarX, avatarY, avatarSz, avatarSz, 6 * S); c.clip()
          const aw = eImg.width, ah = eImg.height
          const sc = Math.max(avatarSz / aw, avatarSz / ah)
          c.drawImage(eImg, avatarX + (avatarSz - aw * sc) / 2, avatarY + (avatarSz - ah * sc) / 2, aw * sc, ah * sc)
          c.restore()
        }
        c.strokeStyle = ac ? ac.main : '#666'; c.lineWidth = 1.5 * S
        R.rr(avatarX, avatarY, avatarSz, avatarSz, 6 * S); c.stroke()

        const infoX = avatarX + avatarSz + 10 * S
        let infoY = avatarY + avatarSz * 0.32
        c.textAlign = 'left'; c.textBaseline = 'middle'
        c.fillStyle = '#FFF2D0'; c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
        const eName = e.isBoss ? (e.name) : e.name
        c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2 * S
        c.strokeText(eName, infoX, infoY)
        c.fillText(eName, infoX, infoY)

        c.fillStyle = ac ? ac.main : '#ccc'; c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
        const attrLabel = (ATTR_NAME[e.attr] || '') + '属性'
        c.strokeText(attrLabel, infoX + c.measureText(eName).width + 8 * S, infoY)
        c.fillText(attrLabel, infoX + c.measureText(eName).width + 8 * S, infoY)

        infoY = avatarY + avatarSz * 0.72
        const orbR = 7 * S
        let bx = infoX
        const weakAttr = COUNTER_BY[e.attr]
        if (weakAttr) {
          c.fillStyle = 'rgba(220,200,160,0.85)'; c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
          c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2 * S
          c.strokeText('弱点:', bx, infoY)
          c.fillText('弱点:', bx, infoY)
          bx += c.measureText('弱点:').width + 4 * S
          R.drawBead(bx + orbR, infoY, orbR, weakAttr, 0)
          bx += orbR * 2 + 12 * S
        }
        const resistAttr = COUNTER_MAP[e.attr]
        if (resistAttr) {
          c.fillStyle = 'rgba(190,175,145,0.7)'; c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
          c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2 * S
          c.strokeText('抵抗:', bx, infoY)
          c.fillText('抵抗:', bx, infoY)
          bx += c.measureText('抵抗:').width + 4 * S
          R.drawBead(bx + orbR, infoY, orbR, resistAttr, 0)
        }

        if (e.isBoss) {
          const bossTagW = 36 * S, bossTagH = 14 * S
          const btx = cardX + cardW - cardPad - bossTagW
          const bty = avatarY + (avatarSz - bossTagH) / 2
          c.fillStyle = 'rgba(180,50,50,0.7)'
          R.rr(btx, bty, bossTagW, bossTagH, 4 * S); c.fill()
          c.fillStyle = '#FFD700'; c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText('BOSS', btx + bossTagW / 2, bty + bossTagH / 2)
          c.textAlign = 'left'
        }
      }
      cy += cardH + 6 * S
    }
  }

  // ── 编队槽位（上方面板） ──
  const panelTop = cy
  const slotSize = 52 * S
  const slotGap = 8 * S
  const wpnGap = 12 * S
  const maxSlots = stage.teamSize.max
  const slotsW = slotSize + wpnGap + maxSlots * slotSize + (maxSlots - 1) * slotGap
  const slotStartX = (W - slotsW) / 2
  const slotY = cy + 8 * S
  // 面板高度 = 槽位行 + 间距 + 筛选标签行 + 底边距
  const panelH = 8 * S + slotSize + 14 * S + 22 * S + 8 * S
  c.fillStyle = 'rgba(40,30,20,0.7)'
  R.rr(8*S, panelTop, W - 16*S, panelH, 10*S); c.fill()
  c.strokeStyle = 'rgba(200,180,120,0.2)'; c.lineWidth = 1*S
  R.rr(8*S, panelTop, W - 16*S, panelH, 10*S); c.stroke()
  const slotFrameScale = 1.12
  const slotFrameSz = slotSize * slotFrameScale
  const slotFrameOf = (slotFrameSz - slotSize) / 2
  _rects.slotRects = []

  // 法宝槽（最左侧）
  const wpnSlotX = slotStartX
  const eqId = g.storage.equippedWeaponId
  const eqWeapon = eqId ? getWeaponById(eqId) : null
  const weaponCollCount = (g.storage.weaponCollection || []).length
  const needPickWeapon = weaponCollCount > 0 && !eqId
  {
    const sx = wpnSlotX
    c.fillStyle = eqWeapon ? '#1a1510' : 'rgba(25,22,18,0.8)'
    c.fillRect(sx + 1, slotY + 1, slotSize - 2, slotSize - 2)
    if (eqWeapon) {
      const wpnImg = R.getImg(`assets/equipment/fabao_${eqWeapon.id}.png`)
      c.save()
      c.beginPath(); c.rect(sx + 1, slotY + 1, slotSize - 2, slotSize - 2); c.clip()
      if (wpnImg && wpnImg.width > 0) {
        c.drawImage(wpnImg, sx + 1, slotY + 1, slotSize - 2, slotSize - 2)
      } else {
        c.fillStyle = '#ffd700'; c.font = `bold ${slotSize*0.38}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText('⚔', sx + slotSize / 2, slotY + slotSize / 2)
      }
      c.restore()
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
  for (let i = 0; i < maxSlots; i++) {
    const sx = petSlotStartX + i * (slotSize + slotGap)
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
      // 未達最低人數，或已可開戰但仍有空位且池中有可補位靈寵：引導點空槽
      const pulseEmpty =
        !needPickWeapon &&
        i === selected.length &&
        selected.length < maxSlots &&
        (teamNeedMore || (selected.length >= minTeam && _hasUnpickedPetsInPool(g, selected)))
      if (pulseEmpty) {
        const pulse = 0.45 + 0.35 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
        c.strokeStyle = `rgba(232,197,71,${pulse})`
        c.lineWidth = 2.5 * S
        c.strokeRect(sx - 2 * S, slotY - 2 * S, slotSize + 4 * S, slotSize + 4 * S)
      }
    }
  }
  // 槽位行底边 → 筛选标签之间的间距
  cy = slotY + slotSize + 6 * S

  // 提示文案（法宝 / 编队不足）画在面板外下方，不挤占面板空间
  let _teamHint = null
  if (needPickWeapon) {
    _teamHint = `您拥有${weaponCollCount}件法宝，请先点击左侧槽位选择上阵`
  } else if (teamNeedMore) {
    const needN = minTeam - selected.length
    _teamHint = needN <= 1
      ? '请先编入灵宠：点上方「+」空槽，或点击下方灵宠卡片'
      : `还需编入 ${needN} 只灵宠｜点上方「+」或点击下方卡片加入编队`
  }

  // ── 属性筛选标签（面板内底部） ──
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

  // 提示文案（面板外，筛选标签与列表之间）
  if (_teamHint) {
    c.textAlign = 'center'
    c.textBaseline = 'top'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.strokeStyle = 'rgba(0,0,0,0.65)'; c.lineWidth = 2.5 * S
    c.strokeText(_teamHint, W / 2, cy)
    c.fillStyle = '#E8C547'
    c.fillText(_teamHint, W / 2, cy)
    cy += 16 * S
  }

  const canGo = selected.length >= minTeam
  const maxSlotsBtn = stage.teamSize.max
  const suggestCompleteTeam =
    canGo && selected.length < maxSlotsBtn && _hasUnpickedPetsInPool(g, selected)
  // 灰按钮或「可开战但未满编」时在底部多留一行提示
  const BTN_BAR_H_NORMAL = 72
  const BTN_BAR_H_WITH_FOOT_HINT = 82
  const btnBarH = (!canGo || suggestCompleteTeam ? BTN_BAR_H_WITH_FOOT_HINT : BTN_BAR_H_NORMAL) * S
  const btnBarY = H - btnBarH

  // ── 底部按钮栏（先画，再裁切列表区域） ──
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
      drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '开始战斗', false, 13)
    }
    c.fillStyle = '#FFF5E0'; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2 * S
    c.strokeText('开始战斗', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
    c.fillText('开始战斗', goBtnX + goBtnW / 2, goBtnY + goBtnH / 2)
    if (suggestCompleteTeam) {
      c.save()
      const subPulse = 0.72 + 0.28 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
      c.globalAlpha = subPulse
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      const footY = Math.min(goBtnY + goBtnH + 8 * S, btnBarY + btnBarH - 4 * S)
      const nEmpty = maxSlotsBtn - selected.length
      const tip = `还可编入 ${nEmpty} 只灵宠；点「开始战斗」时若仍未满会再确认`
      c.strokeStyle = 'rgba(0,0,0,0.72)'; c.lineWidth = 2 * S
      c.strokeText(tip, W / 2, footY)
      c.fillStyle = '#B8E8C8'
      c.fillText(tip, W / 2, footY)
      c.restore()
    }
  } else {
    drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH, '编队不足', true, 13)
    // 底部栏：说明「此按钮暂不可点」，引导去上方/列表点击（缓解只看灰按钮的困惑）
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
  const pulseBenchHint =
    !needPickWeapon &&
    (teamNeedMore ||
      (selected.length >= minTeam && selected.length < maxSlots && _hasUnpickedPetsInPool(g, selected)))
  let pulseFirstPickCard = pulseBenchHint

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

    if (pulseFirstPickCard && !isSelected) {
      const pulse = 0.45 + 0.35 * Math.sin(Date.now() / TEAM_GUIDE_PULSE_PERIOD)
      c.strokeStyle = `rgba(232,197,71,${pulse})`
      c.lineWidth = 2.5 * S
      R.rr(cx - 2 * S, cardY - 2 * S, cw + 4 * S, ch + 4 * S, 10 * S)
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

// ===== 法宝说明：按宽度折行（中文） =====
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

// ===== 法宝选择浮层 =====
function _drawWeaponPicker(g, c, R, S, W, H) {
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)

  const previewId = g._weaponPickerPreviewId
  const detailH = previewId ? 118 * S : 0
  const pw = W * 0.88
  const ph = H * 0.5 + detailH
  const px = (W - pw) / 2
  const py = (H - ph) / 2
  const pad = 14 * S

  _rects.weaponCardRects = []
  _rects.weaponPreviewEquipRect = null
  _rects.weaponPreviewBackRect = null

  c.fillStyle = 'rgba(30,22,14,0.95)'
  R.rr(px, py, pw, ph, 12*S); c.fill()
  c.strokeStyle = 'rgba(200,168,80,0.4)'; c.lineWidth = 1.5*S
  R.rr(px, py, pw, ph, 12*S); c.stroke()

  c.fillStyle = '#F5E6C8'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('选择法宝', W / 2, py + 20*S)

  c.fillStyle = '#a89868'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText('点击法宝查看完整效果，下方确认后再装备', W / 2, py + 34*S)

  const collection = g.storage.weaponCollection || []
  const eqId = g.storage.equippedWeaponId
  const cols = 4
  const iconGap = 8 * S
  const innerW = pw - pad * 2
  const iconSz = Math.floor((innerW - iconGap * (cols - 1)) / cols)
  const textH = 28 * S
  let wy = py + 46 * S

  const gridBottom = py + ph - pad - detailH - 6 * S

  // "卸下" 按钮
  if (eqId) {
    const ubtnW = 80*S, ubtnH = 28*S
    const ubtnX = px + (pw - ubtnW) / 2
    c.fillStyle = 'rgba(180,80,80,0.3)'
    R.rr(ubtnX, wy, ubtnW, ubtnH, 6*S); c.fill()
    c.strokeStyle = 'rgba(255,120,120,0.5)'; c.lineWidth = 1*S
    R.rr(ubtnX, wy, ubtnW, ubtnH, 6*S); c.stroke()
    c.fillStyle = '#ff9999'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('卸下法宝', ubtnX + ubtnW / 2, wy + ubtnH / 2)
    _rects.unequipBtnRect = [ubtnX, wy, ubtnW, ubtnH]
    wy += ubtnH + 10 * S
  } else {
    _rects.unequipBtnRect = null
  }

  if (collection.length === 0) {
    c.fillStyle = '#888'; c.font = `${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('暂无法宝，通关关卡可获得', W / 2, wy + 40*S)
  }

  for (let i = 0; i < collection.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const wx = px + pad + col * (iconSz + iconGap)
    const cardY = wy + row * (iconSz + textH + iconGap)
    const cardBottom = cardY + iconSz + textH
    if (cardY > gridBottom) break
    if (cardBottom > gridBottom) continue

    const wpn = getWeaponById(collection[i])
    if (!wpn) continue

    const isEquipped = wpn.id === eqId
    const isPreview = wpn.id === previewId
    c.fillStyle = isPreview ? 'rgba(200,180,100,0.25)' : isEquipped ? 'rgba(255,215,0,0.15)' : 'rgba(30,25,18,0.85)'
    c.fillRect(wx + 1, cardY + 1, iconSz - 2, iconSz - 2)

    const wpnImg = R.getImg(`assets/equipment/fabao_${wpn.id}.png`)
    if (wpnImg && wpnImg.width > 0) {
      c.save()
      c.beginPath(); c.rect(wx + 1, cardY + 1, iconSz - 2, iconSz - 2); c.clip()
      c.drawImage(wpnImg, wx + 1, cardY + 1, iconSz - 2, iconSz - 2)
      c.restore()
    } else {
      c.fillStyle = '#ffd700'; c.font = `bold ${iconSz*0.35}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('⚔', wx + iconSz / 2, cardY + iconSz / 2)
    }

    R.drawWeaponFrame(wx, cardY, iconSz)

    if (isEquipped) {
      c.save()
      c.shadowColor = 'rgba(255,215,0,0.6)'; c.shadowBlur = 6*S
      c.strokeStyle = '#ffd700'; c.lineWidth = 2*S
      c.strokeRect(wx, cardY, iconSz, iconSz)
      c.restore()
      c.fillStyle = 'rgba(0,0,0,0.6)'
      R.rr(wx + iconSz/2 - 14*S, cardY + 2*S, 28*S, 12*S, 3*S); c.fill()
      c.fillStyle = '#ffd700'; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('装备中', wx + iconSz / 2, cardY + 8*S)
    }

    c.fillStyle = '#ddd'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    const wName = wpn.name.length > 4 ? wpn.name.slice(0, 4) + '…' : wpn.name
    c.fillText(wName, wx + iconSz / 2, cardY + iconSz + 3*S)

    c.fillStyle = '#8a7a58'; c.font = `${7*S}px "PingFang SC",sans-serif`
    c.fillText('点选看说明', wx + iconSz / 2, cardY + iconSz + 14*S)

    _rects.weaponCardRects.push({ weaponId: wpn.id, rect: [wx, cardY, iconSz, iconSz + textH] })
  }

  // ── 底部：当前选中法宝的完整说明 + 装备 / 返回 ──
  if (previewId) {
    const pwpn = getWeaponById(previewId)
    const dTop = py + ph - detailH - pad + 4 * S
    c.strokeStyle = 'rgba(200,168,80,0.35)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, dTop); c.lineTo(px + pw - pad, dTop); c.stroke()

    if (pwpn) {
      c.fillStyle = '#F5E6C8'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
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
        c.fillStyle = '#888'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText('…', px + pad, ly)
      }

      const btnH = 30 * S
      const btnY = py + ph - pad - btnH - 4 * S
      const btnGap = 10 * S
      const btnW = (pw - pad * 2 - btnGap) / 2
      const bx1 = px + pad
      const bx2 = bx1 + btnW + btnGap

      c.fillStyle = 'rgba(60,55,48,0.9)'
      R.rr(bx1, btnY, btnW, btnH, 6*S); c.fill()
      c.strokeStyle = 'rgba(180,160,120,0.5)'; c.lineWidth = 1*S
      R.rr(bx1, btnY, btnW, btnH, 6*S); c.stroke()
      c.fillStyle = '#ccc'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('返回', bx1 + btnW / 2, btnY + btnH / 2)
      _rects.weaponPreviewBackRect = [bx1, btnY, btnW, btnH]

      const already = pwpn.id === eqId
      if (already) {
        c.fillStyle = 'rgba(80,75,70,0.85)'
        R.rr(bx2, btnY, btnW, btnH, 6*S); c.fill()
        c.fillStyle = '#888'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
        c.fillText('已装备', bx2 + btnW / 2, btnY + btnH / 2)
        _rects.weaponPreviewEquipRect = [bx2, btnY, btnW, btnH]
      } else {
        c.fillStyle = 'rgba(100,140,80,0.45)'
        R.rr(bx2, btnY, btnW, btnH, 6*S); c.fill()
        c.strokeStyle = 'rgba(160,220,120,0.5)'; c.lineWidth = 1*S
        R.rr(bx2, btnY, btnW, btnH, 6*S); c.stroke()
        c.fillStyle = '#d4ffc4'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
        c.fillText('装备此法宝', bx2 + btnW / 2, btnY + btnH / 2)
        _rects.weaponPreviewEquipRect = [bx2, btnY, btnW, btnH]
      }
    }
  }

  _rects.weaponPickerRect = [px, py, pw, ph]
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

  // 法宝选择浮层交互
  if (g._showWeaponPicker) {
    if (_scrolling) return
    const prevId = g._weaponPickerPreviewId
    if (prevId) {
      if (_rects.weaponPreviewBackRect && g._hitRect(x, y, ..._rects.weaponPreviewBackRect)) {
        g._weaponPickerPreviewId = null
        return
      }
      if (_rects.weaponPreviewEquipRect && g._hitRect(x, y, ..._rects.weaponPreviewEquipRect)) {
        if (g.storage.equippedWeaponId === prevId) {
          g._weaponPickerPreviewId = null
          return
        }
        g.storage.equipWeapon(prevId)
        g._weaponPickerPreviewId = null
        g._showWeaponPicker = false
        return
      }
    }
    if (_rects.unequipBtnRect && g._hitRect(x, y, ..._rects.unequipBtnRect)) {
      g.storage.unequipWeapon()
      g._weaponPickerPreviewId = null
      g._showWeaponPicker = false
      return
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

  // 长按检测（≥500ms 且未滚动 → 跳转宠物详情全屏页）
  const elapsed = Date.now() - _holdStartTime
  if (elapsed >= 500 && !_scrolling && _holdTarget) {
    g._petDetailId = _holdTarget.petId
    g._petDetailReturnScene = 'stageTeam'
    _holdTarget = null
    g.setScene('petDetail')
    return
  }
  _holdTarget = null

  if (_scrolling) return

  const stage = getStageById(g._selectedStageId)
  if (!stage) return
  const selected = g._stageTeamSelected || (g._stageTeamSelected = [])

  // 开始战斗
  if (_rects.startBtnRect && g._hitRect(x, y, ..._rects.startBtnRect)) {
    const wCol = g.storage.weaponCollection || []
    if (wCol.length > 0 && !g.storage.equippedWeaponId) {
      P.showGameToast('请先点击左侧法宝槽，查看说明并装备一件法宝后再开始战斗')
      return
    }
    const maxSlots = stage.teamSize.max
    const needConfirmIncomplete =
      selected.length < maxSlots && _hasUnpickedPetsInPool(g, selected)
    if (needConfirmIncomplete) {
      const empty = maxSlots - selected.length
      g._confirmDialog = {
        title: '编队未满',
        content:
          `上方还有 ${empty} 个空位，下方仍有可上阵的灵宠。\n` +
          '建议补满编队，战力更完整！',
        confirmText: '继续开战',
        cancelText: '去补充',
        timer: 0,
        onConfirm() { _startStageBattle(g, selected, stage) },
      }
      return
    }
    _startStageBattle(g, selected, stage)
    return
  }

  // 返回（回到上级页面，同时保存编队）
  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g.storage.saveStageteam(selected)
    const returnScene = g._stageTeamReturnScene || 'stageInfo'
    g._stageTeamReturnScene = null
    g.setScene(returnScene)
    return
  }

  // 法宝槽点击（打开法宝选择浮层）
  if (_rects.weaponSlotRect && g._hitRect(x, y, ..._rects.weaponSlotRect)) {
    g._weaponPickerPreviewId = null
    g._showWeaponPicker = true
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

  // 宠物卡片（选入/取消；允许多只同属性同时上阵，仅同一只灵宠不能重复）
  for (const item of _rects.petCardRects) {
    if (g._hitRect(x, y, ...item.rect)) {
      const idx = selected.indexOf(item.petId)
      if (idx >= 0) {
        selected.splice(idx, 1)
        return
      }
      if (selected.length < stage.teamSize.max) {
        selected.push(item.petId)
      } else {
        P.showGameToast('编队已满')
      }
      return
    }
  }
}

// ===== 工具 =====

function resetScroll() { _scrollY = 0 }

module.exports = { rStageTeam, tStageTeam, resetScroll }
