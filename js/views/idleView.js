/**
 * 灵宠派遣界面 — 挂机产出碎片 + 灵石
 * 3个槽位，从灵宠池中选宠物派遣，离线自动累积产出
 * 渲染入口：rIdle  触摸入口：tIdle
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById, getPetAvatarPath } = require('../data/pets')
const { IDLE_MAX_SLOTS, IDLE_FRAG_INTERVAL, IDLE_MAX_ACCUMULATE, calcIdleReward } = require('../data/petPoolConfig')
const { drawBottomBar, getLayout: getTitleLayout } = require('./bottomBar')
const guideMgr = require('../engine/guideManager')

const _rects = {
  backBtnRect: null,
  slotRects: [],
  collectBtnRect: null,
  petPickerRects: [],
  closeBtnRect: null,
}

let _showPicker = -1
let _pickerScroll = 0

let _pickerTouchY = 0
let _pickerScrolling = false
let _pickerScrollStartInGrid = false

function _formatTime(ms) {
  if (ms <= 0) return '已满'
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  if (h > 0) return `${h}时${m}分`
  return `${m}分`
}

function rIdle(g) {
  const { ctx: c, R, W, H, S, safeTop } = V
  const L = getTitleLayout()

  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  const topY = safeTop + 4 * S
  const contentTop = topY + 40 * S
  const contentBottom = L.bottomBarY - 4 * S

  // 顶栏标题
  c.save()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(0,0,0,0.5)'
  c.lineWidth = 4 * S
  c.font = `bold ${17*S}px "PingFang SC",sans-serif`
  c.strokeText('灵宠派遣', W * 0.5, topY + 17 * S)
  c.fillStyle = '#fff'
  c.fillText('灵宠派遣', W * 0.5, topY + 17 * S)

  // 返回按钮（左上角）
  const backW = 52 * S, backH = 28 * S
  const backX = 12 * S, backY = topY + 17 * S - backH / 2
  c.fillStyle = 'rgba(20,15,40,0.55)'
  R.rr(backX, backY, backW, backH, backH / 2); c.fill()
  c.strokeStyle = 'rgba(200,180,120,0.5)'; c.lineWidth = 1.5 * S
  R.rr(backX, backY, backW, backH, backH / 2); c.stroke()
  c.fillStyle = 'rgba(255,235,160,0.9)'
  c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2.5 * S
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.strokeText('‹ 返回', backX + backW / 2, backY + backH / 2)
  c.fillText('‹ 返回', backX + backW / 2, backY + backH / 2)
  _rects.backBtnRect = [backX, backY, backW, backH]

  c.restore()

  const dispatch = g.storage.idleDispatch
  const slots = dispatch.slots || []
  const now = Date.now()

  // 说明文字（深色+描边确保在浅色背景下可读）
  c.save()
  c.font = `${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2.5 * S
  c.strokeText('派遣灵宠自动修行，每4小时产出1枚碎片', W / 2, contentTop + 8 * S)
  c.fillStyle = 'rgba(55,40,25,0.95)'
  c.fillText('派遣灵宠自动修行，每4小时产出1枚碎片', W / 2, contentTop + 8 * S)
  c.restore()

  // 派遣槽位
  const slotW = W * 0.26
  const slotH = slotW * 1.45
  const gap = (W - slotW * 3) / 4
  const slotY = contentTop + 28 * S
  _rects.slotRects = []

  let hasReward = false
  let firstEmptySlotIdx = -1

  for (let i = 0; i < IDLE_MAX_SLOTS; i++) {
    const sx = gap + i * (slotW + gap)
    const sy = slotY
    _rects.slotRects.push([sx, sy, slotW, slotH])

    c.save()
    c.fillStyle = 'rgba(20,15,40,0.65)'
    R.rr(sx, sy, slotW, slotH, 10 * S); c.fill()
    c.strokeStyle = 'rgba(200,180,120,0.4)'; c.lineWidth = 1.5 * S
    R.rr(sx, sy, slotW, slotH, 10 * S); c.stroke()

    const slot = slots[i]
    const cx = sx + slotW / 2

    if (slot) {
      const pet = getPetById(slot.petId)
      const poolPet = g.storage.getPoolPet(slot.petId)
      if (!pet || !poolPet) { c.restore(); continue }

      const elapsed = now - slot.startTime
      const reward = calcIdleReward(elapsed, poolPet.level)
      if (reward.fragments > 0) hasReward = true

      // 宠物头像
      const avatarSize = slotW * 0.55
      const avatarY = sy + 12 * S
      const attrColor = ATTR_COLOR[pet.attr]
      const img = R.getImg(getPetAvatarPath({ id: pet.id, star: poolPet.star || 1 }))
      if (img && img.width > 0) {
        c.save()
        c.beginPath()
        c.arc(cx, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
        c.clip()
        c.drawImage(img, cx - avatarSize / 2, avatarY, avatarSize, avatarSize)
        c.restore()
      }

      if (attrColor) {
        c.beginPath()
        c.arc(cx, avatarY + avatarSize / 2, avatarSize / 2 + 2 * S, 0, Math.PI * 2)
        c.strokeStyle = attrColor.main; c.lineWidth = 2 * S; c.stroke()
      }

      // 名字
      c.fillStyle = '#ffe8a0'
      c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(pet.name, cx, avatarY + avatarSize + 14 * S)

      // 产出预览
      c.fillStyle = '#8cf'
      c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(`碎片 +${reward.fragments}`, cx, avatarY + avatarSize + 30 * S)

      // 距下次碎片的倒计时
      const cappedElapsed = Math.min(elapsed, IDLE_MAX_ACCUMULATE)
      const nextFragMs = IDLE_FRAG_INTERVAL - (cappedElapsed % IDLE_FRAG_INTERVAL)
      const cappedRemain = IDLE_MAX_ACCUMULATE - cappedElapsed
      if (cappedRemain <= 0) {
        c.fillStyle = '#ffa'
        c.fillText('已满 (24h)', cx, avatarY + avatarSize + 44 * S)
      } else {
        c.fillStyle = 'rgba(200,200,220,0.7)'
        c.fillText(`下次: ${_formatTime(nextFragMs)}`, cx, avatarY + avatarSize + 44 * S)
      }

      // 撤回按钮（小 × 在右上角）
      const recallSize = 18 * S
      const recallX = sx + slotW - recallSize - 4 * S
      const recallY = sy + 4 * S
      c.fillStyle = 'rgba(255,80,80,0.7)'
      c.font = `bold ${12*S}px sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('✕', recallX + recallSize / 2, recallY + recallSize / 2)
    } else {
      if (firstEmptySlotIdx < 0) firstEmptySlotIdx = i
      // 空槽：显示 + 号
      c.fillStyle = 'rgba(200,180,120,0.3)'
      c.font = `${36*S}px sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('+', cx, sy + slotH * 0.38)

      c.fillStyle = 'rgba(200,200,220,0.5)'
      c.font = `${10*S}px "PingFang SC",sans-serif`
      c.fillText('点击派遣', cx, sy + slotH * 0.62)
    }
    c.restore()
  }

  if (!g._namedRects) g._namedRects = {}
  if (guideMgr.getCurrentId() === 'idle_intro' && firstEmptySlotIdx >= 0 && _rects.slotRects[firstEmptySlotIdx]) {
    const r = _rects.slotRects[firstEmptySlotIdx]
    g._namedRects.idle_dispatch_slot = { x: r[0], y: r[1], w: r[2], h: r[3] }
  } else if (g._namedRects.idle_dispatch_slot) {
    delete g._namedRects.idle_dispatch_slot
  }

  // 收取按钮
  const btnW = W * 0.55
  const btnH = 40 * S
  const btnX = (W - btnW) / 2
  const btnY = slotY + slotH + 20 * S

  c.save()
  if (hasReward) {
    const grad = c.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
    grad.addColorStop(0, '#ffe066'); grad.addColorStop(1, '#d4a84b')
    c.fillStyle = grad
    R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); c.fill()
    c.fillStyle = '#5a2d0c'
  } else {
    c.fillStyle = 'rgba(80,80,100,0.4)'
    R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); c.fill()
    c.fillStyle = 'rgba(160,160,180,0.6)'
  }
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(hasReward ? '收取产出' : '等待产出中...', btnX + btnW / 2, btnY + btnH / 2)
  _rects.collectBtnRect = hasReward ? [btnX, btnY, btnW, btnH] : null
  c.restore()

  // 收取结果提示
  if (g._idleCollectResult) {
    const res = g._idleCollectResult
    const tipY = btnY + btnH + 16 * S
    c.save()
    c.fillStyle = 'rgba(20,15,40,0.8)'
    const tipW = W * 0.7, tipH = 40 * S
    R.rr((W - tipW) / 2, tipY, tipW, tipH, 8 * S); c.fill()
    c.fillStyle = '#ffe8a0'
    c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`碎片 +${res.totalFragments}  灵石 +${res.totalSoulStone}`, W / 2, tipY + tipH / 2)
    c.restore()
  }

  // 宠物选择弹窗
  if (_showPicker >= 0) {
    _drawPetPicker(g)
  }

  drawBottomBar(g)
}

function _computePickerGeometry(g) {
  const { W, H, S } = V
  const pw = W * 0.85
  const ph = H * 0.55
  const px = (W - pw) / 2
  const py = (H - ph) / 2
  const pool = g.storage.petPool || []
  const dispatched = new Set(g.storage.idleSlotPetIds)
  const available = pool.filter(p => !dispatched.has(p.id))
  const cardW = 56 * S
  const cardH = 72 * S
  const gap = 6 * S
  const cols = Math.max(1, Math.floor((pw - 16 * S) / (cardW + gap)))
  const listX = px + (pw - cols * (cardW + gap) + gap) / 2
  const listY = py + 44 * S
  const listBottom = py + ph - 8 * S
  const viewportH = listBottom - listY
  const rows = Math.ceil(available.length / cols)
  const rowStep = cardH + 8 * S
  const totalH = rows > 0 ? (rows - 1) * rowStep + cardH : 0
  const maxScroll = Math.max(0, totalH - viewportH)
  return {
    px, py, pw, ph, listX, listY, listBottom, cols, cardW, cardH, rowStep, gap,
    available, maxScroll,
  }
}

function _drawPetPicker(g) {
  const { ctx: c, R, W, H, S } = V

  c.save()
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)

  const geo = _computePickerGeometry(g)
  const { px, py, pw, ph, listX, listY, listBottom, cols, cardW, cardH, rowStep, gap, available } = geo

  c.fillStyle = 'rgba(30,25,55,0.97)'
  R.rr(px, py, pw, ph, 14 * S); c.fill()
  c.strokeStyle = 'rgba(200,180,120,0.5)'; c.lineWidth = 1.5 * S
  R.rr(px, py, pw, ph, 14 * S); c.stroke()

  c.fillStyle = '#ffe8a0'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('选择派遣灵宠', W / 2, py + 22 * S)

  // 关闭按钮
  const closeSize = 28 * S
  const closeX = px + pw - closeSize - 4 * S
  const closeY = py + 4 * S
  c.fillStyle = 'rgba(255,255,255,0.5)'
  c.font = `${18*S}px sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('✕', closeX + closeSize / 2, closeY + closeSize / 2)
  _rects.closeBtnRect = [closeX, closeY, closeSize, closeSize]

  _rects.petPickerRects = []

  if (available.length === 0) {
    c.fillStyle = 'rgba(200,200,220,0.5)'
    c.font = `${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.fillText('没有可派遣的灵宠', W / 2, py + ph / 2)
  } else {
    c.save()
    c.beginPath()
    c.rect(px + 4 * S, listY - 2 * S, pw - 8 * S, listBottom - listY + 4 * S)
    c.clip()
    for (let i = 0; i < available.length; i++) {
      const p = available[i]
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = listX + col * (cardW + gap)
      const cy = listY + row * rowStep - _pickerScroll
      if (cy + cardH < listY - 4 * S || cy > listBottom + 4 * S) continue

      c.fillStyle = 'rgba(40,35,60,0.7)'
      R.rr(cx, cy, cardW, cardH, 6 * S); c.fill()

      const pet = getPetById(p.id)
      if (pet) {
        const avatarSize = cardW * 0.65
        const avatarY = cy + 6 * S
        const acx = cx + cardW / 2
        const img = R.getImg(getPetAvatarPath({ id: pet.id, star: p.star || 1 }))
        if (img && img.width > 0) {
          c.save()
          c.beginPath()
          c.arc(acx, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
          c.clip()
          c.drawImage(img, acx - avatarSize / 2, avatarY, avatarSize, avatarSize)
          c.restore()
        }
        c.fillStyle = '#ddd'
        c.font = `${9*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText(pet.name, acx, cy + cardH - 10 * S)
      }
      _rects.petPickerRects.push({ petId: p.id, rect: [cx, cy, cardW, cardH] })
    }
    c.restore()
  }
  c.restore()
}

function tIdle(g, type, x, y) {
  const { S } = V

  // 宠物选择弹窗：支持上下拖动列表（与 petPool 一致）
  if (_showPicker >= 0) {
    const geo = _computePickerGeometry(g)
    const pad = 8 * S
    const inModal = x >= geo.px && x <= geo.px + geo.pw && y >= geo.py && y <= geo.py + geo.ph
    const inGrid = inModal && y >= geo.listY && y <= geo.listBottom &&
      x >= geo.px + pad && x <= geo.px + geo.pw - pad

    if (type === 'start') {
      _pickerTouchY = y
      _pickerScrolling = false
      _pickerScrollStartInGrid = inGrid && geo.available.length > 0 && geo.maxScroll > 0
      return
    }
    if (type === 'move') {
      if (!_pickerScrollStartInGrid) return
      const dy = _pickerTouchY - y
      if (Math.abs(dy) > 3 * S) _pickerScrolling = true
      if (_pickerScrolling && geo.maxScroll > 0) {
        _pickerScroll = Math.max(0, Math.min(geo.maxScroll, _pickerScroll + dy))
        _pickerTouchY = y
      }
      return
    }
    if (type !== 'end') return

    if (_pickerScrolling) {
      _pickerScrolling = false
      return
    }

    if (_rects.closeBtnRect && _hitRect(x, y, ..._rects.closeBtnRect)) {
      _showPicker = -1
      return
    }
    for (const item of _rects.petPickerRects) {
      if (_hitRect(x, y, ...item.rect)) {
        g.storage.idleAssign(item.petId)
        _showPicker = -1
        return
      }
    }
    if (!inModal) _showPicker = -1
    return
  }

  if (type !== 'end') return

  // 返回按钮
  if (_rects.backBtnRect && _hitRect(x, y, ..._rects.backBtnRect)) {
    g.setScene('petPool'); return
  }

  // 底部导航
  const L = getTitleLayout()
  if (y >= L.bottomBarY) {
    _handleBottomBar(g, x, y, L); return
  }

  // 收取
  if (_rects.collectBtnRect && _hitRect(x, y, ..._rects.collectBtnRect)) {
    const result = g.storage.idleCollect()
    if (result) {
      g._idleCollectResult = result
      setTimeout(() => { g._idleCollectResult = null }, 3000)
    }
    return
  }

  // 槽位点击
  const dispatch = g.storage.idleDispatch
  const slots = dispatch.slots || []
  for (let i = 0; i < _rects.slotRects.length; i++) {
    const rect = _rects.slotRects[i]
    if (!_hitRect(x, y, ...rect)) continue

    if (slots[i]) {
      // 已有宠物：点击右上角撤回
      const slotX = rect[0], slotY = rect[1], slotW = rect[2]
      const recallSize = 18 * V.S
      const recallX = slotX + slotW - recallSize - 4 * V.S
      const recallY2 = slotY + 4 * V.S
      if (_hitRect(x, y, recallX, recallY2, recallSize, recallSize)) {
        g.storage.idleRecall(slots[i].petId)
      }
    } else {
      _showPicker = i
      _pickerScroll = 0
    }
    return
  }
}

function _handleBottomBar(g, x, y, L) {
  const { BAR_ITEMS } = require('./bottomBar')
  const slotW = V.W / BAR_ITEMS.length
  const idx = Math.floor(x / slotW)
  if (idx < 0 || idx >= BAR_ITEMS.length) return
  const key = BAR_ITEMS[idx].key
  if (key === 'battle' || key === 'stage') { g.setScene('title'); return }
  if (key === 'cultivation') {
    const cv = require('./cultivationView')
    cv.resetScroll(); g.setScene('cultivation'); cv.checkRealmBreak(g); return
  }
  if (key === 'pets' && g.storage.petPoolCount > 0) {
    g._petPoolFilter = 'all'; g._petPoolRarityFilter = 'all'; g._petPoolScroll = 0; g._petPoolDetail = null
    g.setScene('petPool'); return
  }
  if (key === 'dex') { g.setScene('dex'); return }
  if (key === 'weapons') {
    g._weaponPoolFilter = 'all'; g._weaponPoolScroll = 0; g._weaponPoolDetail = null
    g.setScene('weaponPool'); return
  }
  if (key === 'rank') { g._openRanking(); return }
  if (key === 'more') { g.showMorePanel = true; g.setScene('title'); return }
}

function _hitRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
}

function resetIdleView() {
  _showPicker = -1
  _pickerScroll = 0
  _pickerScrolling = false
  _pickerScrollStartInGrid = false
}

module.exports = { rIdle, tIdle, resetIdleView }
