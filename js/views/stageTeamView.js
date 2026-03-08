/**
 * 编队页 — 上方编队槽位+队长技能 + 下方灵宠池列表 + 底部开始战斗
 * 参考：图2 — 编队调整界面
 * 编队修改后自动保存；可在此页面直接开始战斗
 * 渲染入口：rStageTeam  触摸入口：tStageTeam
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetTier, getPetAvatarPath, getPetSkillDesc, petHasSkill } = require('../data/pets')
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
let _scrolling = false

// ===== 渲染 =====
function rStageTeam(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(0)
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fillRect(0, 0, W, H)

  const stage = getStageById(g._selectedStageId)
  if (!stage) return
  const selected = g._stageTeamSelected || []
  const stageAttr = getStageAttr(g._selectedStageId)
  const counterAttr = { metal: 'fire', wood: 'metal', water: 'fire', fire: 'water', earth: 'wood' }
  const recAttr = counterAttr[stageAttr]

  const topY = safeTop + 4 * S
  const px = 14 * S
  let cy = topY

  // ── 返回按钮 + 标题 ──
  c.save()
  c.fillStyle = 'rgba(255,255,255,0.6)'
  c.font = `${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText('‹ 返回', px, cy + 16 * S)
  _rects.backBtnRect = [0, cy, 80 * S, 32 * S]

  c.fillStyle = '#F5E6C8'; c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText('编队', W / 2, cy + 16 * S)
  c.restore()
  cy += 36 * S

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
  _rects.slotRects = []

  for (let i = 0; i < maxSlots; i++) {
    const sx = slotStartX + i * (slotSize + slotGap)
    _rects.slotRects.push([sx, slotY, slotSize, slotSize])

    c.fillStyle = 'rgba(80,70,50,0.5)'
    R.rr(sx, slotY, slotSize, slotSize, 8*S); c.fill()
    c.strokeStyle = 'rgba(200,180,120,0.25)'; c.lineWidth = 1*S
    R.rr(sx, slotY, slotSize, slotSize, 8*S); c.stroke()

    if (i < selected.length) {
      const pid = selected[i]
      const pet = getPetById(pid)
      const poolPet = g.storage.getPoolPet(pid)
      if (pet && poolPet) {
        const pAttrColor = ATTR_COLOR[pet.attr]
        // 属性色顶条
        c.fillStyle = pAttrColor ? pAttrColor.main : '#888'
        R.rr(sx, slotY, slotSize, 4*S, 4*S); c.fill()
        // 头像
        const avatarPath = getPetAvatarPath({ ...pet, star: poolPet.star })
        const img = R.getImg(avatarPath)
        if (img && img.width > 0) {
          c.save()
          R.rr(sx + 3*S, slotY + 6*S, slotSize - 6*S, slotSize - 20*S, 4*S); c.clip()
          c.drawImage(img, sx + 3*S, slotY + 6*S, slotSize - 6*S, slotSize - 20*S)
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
        // 名称+等级
        c.textAlign = 'center'; c.textBaseline = 'bottom'
        c.fillStyle = '#E8D5A3'; c.font = `${8*S}px "PingFang SC",sans-serif`
        c.fillText(`${pet.name.slice(0,3)} Lv.${poolPet.level}`, sx + slotSize / 2, slotY + slotSize - 1*S)
        // 队长标记
        if (i === 0) {
          c.fillStyle = '#ffd700'; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
          c.textAlign = 'left'; c.textBaseline = 'top'
          c.fillText('队长', sx + 2*S, slotY + 1*S)
        }
        // 星级小点
        const starStr = '★'.repeat(poolPet.star)
        c.fillStyle = '#ffd700'; c.font = `${7*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'top'
        c.fillText(starStr, sx + slotSize / 2, slotY + slotSize - 10*S)
      }
    } else {
      c.fillStyle = '#666'; c.font = `${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('+', sx + slotSize / 2, slotY + slotSize / 2)
    }
  }
  cy += 64 * S

  // ── 队长技能 ──
  const leaderSkillY = cy
  c.fillStyle = 'rgba(40,30,20,0.5)'
  R.rr(8*S, leaderSkillY, W - 16*S, 40*S, 6*S); c.fill()

  if (selected.length > 0) {
    const leaderId = selected[0]
    const leaderPet = getPetById(leaderId)
    const leaderPool = g.storage.getPoolPet(leaderId)
    if (leaderPet && leaderPool) {
      const fakePet = { ...leaderPet, star: leaderPool.star }
      const hasSkill = petHasSkill(fakePet)
      c.textAlign = 'left'; c.textBaseline = 'middle'
      c.fillStyle = '#C8B78A'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText('队长技能', px + 4*S, leaderSkillY + 12*S)
      if (hasSkill) {
        c.fillStyle = '#7ECF6A'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText(leaderPet.skill.name, px + 60*S, leaderSkillY + 12*S)
        const desc = getPetSkillDesc(fakePet) || ''
        c.fillStyle = 'rgba(200,180,140,0.6)'; c.font = `${8*S}px "PingFang SC",sans-serif`
        // 简单截断
        const maxW = W - 36 * S
        const displayDesc = c.measureText(desc).width > maxW ? desc.slice(0, 20) + '…' : desc
        c.fillText(displayDesc, px + 4*S, leaderSkillY + 28*S)
      } else {
        c.fillStyle = 'rgba(200,180,140,0.4)'; c.font = `${9*S}px "PingFang SC",sans-serif`
        c.fillText('★2解锁', px + 60*S, leaderSkillY + 12*S)
      }
    }
  } else {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = 'rgba(200,180,140,0.3)'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('选择灵宠后显示队长技能', W / 2, leaderSkillY + 20*S)
  }
  cy = leaderSkillY + 44 * S

  // ── 备选角色标题 + 克制提示 ──
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#C8B78A'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText('◆ 备选角色', px, cy)
  if (recAttr) {
    c.textAlign = 'right'
    c.fillStyle = ATTR_COLOR[recAttr] ? ATTR_COLOR[recAttr].main : '#ccc'
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`推荐${ATTR_NAME[recAttr]}属性克制`, W - px, cy + 2*S)
  }
  cy += 18 * S

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

  // ── 灵宠列表（可滚动） ──
  const listTop = cy
  const listBottom = H - 56 * S
  c.save()
  c.beginPath(); c.rect(0, listTop, W, listBottom - listTop); c.clip()

  const pool = g.storage.petPool || []
  const filter = g._stageTeamFilter || 'all'
  const filtered = filter === 'all' ? pool : pool.filter(p => p.attr === filter)
  // 按攻击力降序排列
  const sorted = filtered.slice().sort((a, b) => getPoolPetAtk(b) - getPoolPetAtk(a))

  _rects.petCardRects = []
  const cols = 5
  const gap = 6 * S
  const cw = (W - 20*S - (cols - 1) * gap) / cols
  const ch = cw * 1.35
  let curY = listTop + 4*S + _scrollY

  for (let i = 0; i < sorted.length; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const cx = 10*S + col * (cw + gap)
    const cardY = curY + row * (ch + gap)

    _rects.petCardRects.push({ petId: sorted[i].id, rect: [cx, cardY, cw, ch] })

    if (cardY + ch < listTop || cardY > listBottom) continue

    const pp = sorted[i]
    const pet = getPetById(pp.id)
    if (!pet) continue
    const isSelected = selected.includes(pp.id)
    const pAttrColor = ATTR_COLOR[pp.attr]
    const atk = getPoolPetAtk(pp)

    // 卡片背景
    c.fillStyle = isSelected ? 'rgba(100,90,60,0.6)' : 'rgba(50,42,30,0.8)'
    R.rr(cx, cardY, cw, ch, 6*S); c.fill()
    if (isSelected) {
      c.strokeStyle = '#ffd700'; c.lineWidth = 1.5*S
      R.rr(cx, cardY, cw, ch, 6*S); c.stroke()
    } else {
      c.strokeStyle = 'rgba(200,180,120,0.15)'; c.lineWidth = 1*S
      R.rr(cx, cardY, cw, ch, 6*S); c.stroke()
    }

    // 属性色顶条
    c.fillStyle = pAttrColor ? pAttrColor.main : '#888'
    R.rr(cx, cardY, cw, 3*S, 3*S); c.fill()

    // 头像
    const avatarPath = getPetAvatarPath({ ...pet, star: pp.star })
    const img = R.getImg(avatarPath)
    const imgTop = cardY + 5*S
    const imgSize = cw - 6*S
    if (img && img.width > 0) {
      c.save()
      R.rr(cx + 3*S, imgTop, imgSize, imgSize * 0.8, 4*S); c.clip()
      c.drawImage(img, cx + 3*S, imgTop, imgSize, imgSize * 0.8)
      c.restore()
    } else {
      c.fillStyle = pAttrColor ? pAttrColor.main : '#555'
      c.globalAlpha = 0.2
      R.rr(cx + 3*S, imgTop, imgSize, imgSize * 0.8, 4*S); c.fill()
      c.globalAlpha = 1
      c.fillStyle = '#ccc'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(pet.name.slice(0, 1), cx + cw / 2, imgTop + imgSize * 0.4)
    }

    // 等级（左上角）
    c.fillStyle = 'rgba(0,0,0,0.5)'
    R.rr(cx + 2*S, cardY + 4*S, 22*S, 12*S, 3*S); c.fill()
    c.fillStyle = '#fff'; c.font = `${7*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`${pp.level}`, cx + 13*S, cardY + 10*S)

    // 已选标记（已上阵）
    if (isSelected) {
      c.fillStyle = 'rgba(255,215,0,0.12)'
      R.rr(cx, cardY, cw, ch, 6*S); c.fill()
      c.fillStyle = 'rgba(0,0,0,0.5)'
      R.rr(cx + cw - 28*S, cardY + 4*S, 26*S, 12*S, 3*S); c.fill()
      c.fillStyle = '#7ECF6A'; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText('已上阵', cx + cw - 15*S, cardY + 10*S)
    }

    // 克制指示（推荐属性）
    if (recAttr && pp.attr === recAttr && !isSelected) {
      c.fillStyle = 'rgba(0,0,0,0.5)'
      R.rr(cx + cw - 22*S, cardY + 4*S, 20*S, 12*S, 3*S); c.fill()
      c.fillStyle = ATTR_COLOR[recAttr] ? ATTR_COLOR[recAttr].main : '#8f8'
      c.font = `bold ${7*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText('克制', cx + cw - 12*S, cardY + 10*S)
    }

    // 名称 + ATK
    const infoY = imgTop + imgSize * 0.8 + 2*S
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillStyle = isSelected ? '#ffd700' : '#E8D5A3'
    c.font = `${8*S}px "PingFang SC",sans-serif`
    c.fillText(pet.name.slice(0, 4), cx + cw / 2, infoY)
    c.fillStyle = 'rgba(200,180,140,0.6)'; c.font = `${7*S}px "PingFang SC",sans-serif`
    c.fillText(`+${atk}`, cx + cw / 2, infoY + 11*S)
  }

  // 滚动限制
  const totalRows = Math.ceil(sorted.length / cols)
  const totalH = totalRows * (ch + gap) + 8*S
  const viewH = listBottom - listTop
  const maxScroll = Math.max(0, totalH - viewH)
  if (_scrollY < -maxScroll) _scrollY = -maxScroll
  if (_scrollY > 0) _scrollY = 0

  c.restore()

  // ── 底部按钮栏 ──
  const btnBarY = H - 52 * S
  c.fillStyle = 'rgba(30,22,14,0.9)'
  c.fillRect(0, btnBarY, W, 52*S)

  const canGo = selected.length >= stage.teamSize.min
  // 消耗提示
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#8ac8ff'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`消耗：⚡${stage.staminaCost}`, W / 2, btnBarY + 8*S)

  // 开始战斗按钮
  const goBtnW = W * 0.55, goBtnH = 36 * S
  const goBtnX = (W - goBtnW) / 2, goBtnY = btnBarY + 16*S
  _drawGoldBtn(c, R, S, goBtnX, goBtnY, goBtnW, goBtnH,
    `开始战斗`, !canGo)
  _rects.startBtnRect = canGo ? [goBtnX, goBtnY, goBtnW, goBtnH] : null
}

// ===== 触摸 =====
function tStageTeam(g, x, y, type) {
  if (type === 'start') {
    _touchStartY = y; _touchLastY = y; _scrolling = false
    return
  }
  if (type === 'move') {
    const dy = y - _touchLastY; _touchLastY = y
    if (Math.abs(y - _touchStartY) > 5 * V.S) _scrolling = true
    if (_scrolling) _scrollY += dy
    return
  }
  if (type !== 'end') return
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
