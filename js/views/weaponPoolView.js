/**
 * 法宝阁界面 — 法宝收集网格 + 详情面板（含装备/卸下）
 * 渲染入口：rWeaponPool  触摸入口：tWeaponPool
 */
const V = require('./env')
const { WEAPON_ACQUIRE_HINT_UNOWNED } = require('../data/constants')
const { WEAPONS, getWeaponById } = require('../data/weapons')
const { drawBottomBar, getLayout: getTitleLayout, drawPageTitle } = require('./bottomBar')

const OWNED_CARD_BORDER = 'rgba(212,175,55,0.65)'

const _rects = {
  filterRects: [],
  cardRects: [],
  detailCloseBtnRect: null,
  equipBtnRect: null,
  unequipBtnRect: null,
}

let _scrollTouchY = 0
let _scrolling = false

function rWeaponPool(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  R.drawHomeBg(g.af)

  const L = getTitleLayout()
  const topY = safeTop + 4 * S
  const contentTop = topY + 42 * S
  const navCloudReserve = 26 * S
  const contentBottom = L.bottomBarY - 4 * S - navCloudReserve
  const collection = g.storage.weaponCollection || []
  const collSet = new Set(collection)

  drawPageTitle(c, R, W, S, W * 0.5, topY + 24 * S, '法宝阁')

  // 收集进度（右上）
  c.save()
  c.fillStyle = 'rgba(0,0,0,0.35)'
  const progText = `${collection.length} / ${WEAPONS.length}`
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'; c.textBaseline = 'middle'
  const ptW = c.measureText(progText).width + 16 * S
  const ptH = 22 * S
  const ptX = W - 10 * S - ptW
  const ptY = topY + 14 * S
  R.rr(ptX, ptY, ptW, ptH, ptH / 2); c.fill()
  c.fillStyle = '#ffe080'
  c.fillText(progText, W - 18 * S, ptY + ptH / 2)
  c.restore()

  _rects.filterRects = []

  // 卡片网格
  const gridTop = contentTop + 8 * S
  const gridBottom = contentBottom
  const weapons = WEAPONS.slice()
  const cols = 4
  const cardGap = 6 * S
  const padX = 12 * S
  const cardW = (W - padX * 2 - cardGap * (cols - 1)) / cols
  const cardH = cardW + 22 * S
  _rects.cardRects = []

  c.save()
  c.beginPath()
  c.rect(0, gridTop, W, gridBottom - gridTop)
  c.clip()

  const scrollY = g._weaponPoolScroll || 0
  const totalRows = Math.ceil(weapons.length / cols)
  const totalH = totalRows * (cardH + cardGap) + cardGap
  g._weaponPoolTotalH = totalH

  const eqId = g.storage.equippedWeaponId

  for (let idx = 0; idx < weapons.length; idx++) {
    const wpn = weapons[idx]
    const row = Math.floor(idx / cols)
    const col = idx % cols
    const cx = padX + col * (cardW + cardGap)
    const cy = gridTop + row * (cardH + cardGap) + cardGap - scrollY

    if (cy + cardH < gridTop || cy > gridBottom) continue

    const owned = collSet.has(wpn.id)
    const equipped = eqId === wpn.id

    _drawWeaponCard(c, R, S, cx, cy, cardW, cardH, wpn, owned, equipped)
    _rects.cardRects.push({ weaponId: wpn.id, owned, rect: [cx, cy, cardW, cardH] })
  }
  c.restore()

  drawBottomBar(g)

  if (g._weaponPoolDetail) {
    _drawDetailPanel(g, c, R, S, W, H, collSet, eqId)
  }
}

function _drawWeaponCard(c, R, S, x, y, w, h, wpn, owned, equipped) {
  const iconH = w
  const textH = h - iconH

  c.save()
  if (owned) {
    c.fillStyle = 'rgba(40,35,25,0.85)'
  } else {
    c.fillStyle = 'rgba(30,28,22,0.6)'
  }
  R.rr(x, y, w, h, 6 * S); c.fill()

  c.strokeStyle = owned ? OWNED_CARD_BORDER : 'rgba(100,90,70,0.3)'
  c.lineWidth = owned ? 1.5 * S : 0.5 * S
  R.rr(x, y, w, h, 6 * S); c.stroke()

  if (owned) {
    const wpnImg = R.getImg(`assets/equipment/fabao_${wpn.id}.png`)
    if (wpnImg && wpnImg.width > 0) {
      c.save()
      c.beginPath(); c.rect(x + 2, y + 2, w - 4, iconH - 4); c.clip()
      const iw = wpnImg.width, ih = wpnImg.height
      const scale = Math.min((w - 4) / iw, (iconH - 4) / ih)
      const dw = iw * scale, dh = ih * scale
      c.drawImage(wpnImg, x + (w - dw) / 2, y + (iconH - dh) / 2, dw, dh)
      c.restore()
    }

    if (equipped) {
      c.fillStyle = 'rgba(212,175,55,0.85)'
      const badgeH = 12 * S
      R.rr(x, y, w, badgeH, 0); c.fill()
      c.fillStyle = '#fff'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('装备中', x + w / 2, y + badgeH / 2)
    }
  } else {
    c.globalAlpha = 0.3
    c.fillStyle = '#666'
    c.font = `${w * 0.35}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('?', x + w / 2, y + iconH / 2)
    c.globalAlpha = 1
  }

  // 名称
  c.fillStyle = owned ? '#e8d5a8' : 'rgba(200,190,170,0.4)'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const name = owned ? wpn.name : '???'
  c.fillText(name, x + w / 2, y + iconH + textH / 2)

  c.restore()
}

/** 说明折行（与画布 font 一致时再调用） @returns {string[]} */
function _wrapLines(c, text, maxW) {
  const lines = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (c.measureText(line + ch).width > maxW && line) {
      lines.push(line)
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

function _drawDetailPanel(g, c, R, S, W, H, collSet, eqId) {
  const wpnId = g._weaponPoolDetail
  const wpn = getWeaponById(wpnId)
  if (!wpn) return
  const owned = collSet.has(wpnId)
  const equipped = eqId === wpnId

  c.save()
  c.fillStyle = 'rgba(0,0,0,0.65)'
  c.fillRect(0, 0, W, H)

  const pw = W * 0.85
  // pet_card_bg 四角多为透明，需与 petDetailView 类似留出「装饰安全区」，否则按钮会落在纹理外侧
  const insetX = Math.max(14 * S, Math.round(pw * 0.065))
  const insetT = Math.max(36 * S, Math.round(pw * 0.09))
  const insetB = Math.max(44 * S, Math.round(pw * 0.11))
  const innerPad = 12 * S
  const iconSz = 72 * S
  const descText = owned ? wpn.desc : WEAPON_ACQUIRE_HINT_UNOWNED
  c.font = `${12*S}px "PingFang SC",sans-serif`
  const maxDescW = pw - insetX * 2 - innerPad * 2
  const descLinesArr = _wrapLines(c, descText, maxDescW)
  const lineHDesc = 17 * S
  const gapAfterIcon = 16 * S
  const gapAfterSep = 20 * S
  const descBlockH = descLinesArr.length * lineHDesc + 10 * S
  const btnH2 = owned ? 36 * S : 0
  const btnGap = owned ? 12 * S : 0
  const topToIcon = 32 * S + 18 * S + (equipped ? 22 * S : 0) + 20 * S
  const contentStack = innerPad + topToIcon + iconSz + gapAfterIcon + gapAfterSep + descBlockH + btnGap + btnH2 + innerPad
  const ph = insetT + insetB + contentStack
  const px = (W - pw) / 2
  const py = (H - ph) / 2
  const innerTop = py + insetT
  const innerBottom = py + ph - insetB
  const innerLeft = px + insetX
  const innerRight = px + pw - insetX

  const panelRad = 14 * S
  const cardBg = R.getImg('assets/ui/pet_card_bg.png')
  const PARCHMENT_UNDERLAY = '#EDE5D5'
  if (cardBg && cardBg.width > 0) {
    c.save()
    R.rr(px, py, pw, ph, panelRad); c.clip()
    c.fillStyle = PARCHMENT_UNDERLAY
    R.rr(px, py, pw, ph, panelRad); c.fill()
    c.drawImage(cardBg, px, py, pw, ph)
    c.restore()
  } else {
    const grad = c.createLinearGradient(px, py, px, py + ph)
    grad.addColorStop(0, 'rgba(60,50,35,0.97)')
    grad.addColorStop(1, 'rgba(40,34,24,0.97)')
    c.fillStyle = grad
    R.rr(px, py, pw, ph, panelRad); c.fill()
    c.strokeStyle = 'rgba(180,140,80,0.5)'; c.lineWidth = 1.5 * S
    R.rr(px, py, pw, ph, panelRad); c.stroke()
  }

  const closeSize = 28 * S
  const closeX = innerRight - closeSize
  const closeY = innerTop - closeSize * 0.45
  const closeYClamped = Math.max(py + 6 * S, Math.min(closeY, innerTop + 6 * S))
  c.fillStyle = 'rgba(80,55,35,0.25)'
  c.beginPath(); c.arc(closeX + closeSize / 2, closeYClamped + closeSize / 2, closeSize / 2, 0, Math.PI * 2); c.fill()
  c.strokeStyle = 'rgba(90,60,40,0.55)'; c.lineWidth = 1.5 * S
  c.beginPath(); c.arc(closeX + closeSize / 2, closeYClamped + closeSize / 2, closeSize / 2, 0, Math.PI * 2); c.stroke()
  c.strokeStyle = '#5A4530'; c.lineWidth = 2 * S
  const cx0 = closeX + closeSize / 2, cy0 = closeYClamped + closeSize / 2, cr = 7 * S
  c.beginPath(); c.moveTo(cx0 - cr, cy0 - cr); c.lineTo(cx0 + cr, cy0 + cr); c.stroke()
  c.beginPath(); c.moveTo(cx0 + cr, cy0 - cr); c.lineTo(cx0 - cr, cy0 + cr); c.stroke()
  _rects.detailCloseBtnRect = [closeX, closeYClamped, closeSize, closeSize]

  let curY = innerTop + innerPad + 32 * S
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.fillStyle = '#5A4530'
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.fillText(owned ? wpn.name : '???', px + pw / 2, curY)

  if (equipped) {
    curY += 22 * S
    c.fillStyle = '#8B6914'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('✦ 装备中', px + pw / 2, curY)
  }

  curY += 20 * S
  const iconX = px + (pw - iconSz) / 2
  const iconY = curY

  if (owned) {
    const wpnImg = R.getImg(`assets/equipment/fabao_${wpn.id}.png`)
    if (wpnImg && wpnImg.width > 0) {
      c.drawImage(wpnImg, iconX, iconY, iconSz, iconSz)
    }
  } else {
    c.fillStyle = 'rgba(100,90,70,0.4)'
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.fill()
    c.fillStyle = '#555'
    c.font = `${iconSz * 0.5}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('?', iconX + iconSz / 2, iconY + iconSz / 2)
  }
  R.drawWeaponFrame(iconX, iconY, iconSz)

  const sepY = iconY + iconSz + gapAfterIcon
  const descTop = sepY + gapAfterSep
  c.strokeStyle = 'rgba(120,95,60,0.28)'
  c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(innerLeft + 6 * S, sepY)
  c.lineTo(innerRight - 6 * S, sepY)
  c.stroke()

  c.textAlign = 'center'
  c.textBaseline = 'alphabetic'
  c.fillStyle = owned ? 'rgba(70,50,30,0.92)' : 'rgba(120,105,90,0.75)'
  c.font = `${12*S}px "PingFang SC",sans-serif`
  const centerX = px + pw / 2
  descLinesArr.forEach((ln, i) => {
    c.fillText(ln, centerX, descTop + i * lineHDesc)
  })

  _rects.equipBtnRect = null
  _rects.unequipBtnRect = null

  if (owned) {
    const btnW = 120 * S
    const btnH2 = 36 * S
    const btnY = innerBottom - innerPad - btnH2

    if (equipped) {
      const ubx = px + (pw - btnW) / 2
      c.fillStyle = 'rgba(180,60,60,0.7)'
      R.rr(ubx, btnY, btnW, btnH2, btnH2 / 2); c.fill()
      c.strokeStyle = 'rgba(255,100,100,0.5)'; c.lineWidth = 1.5 * S
      R.rr(ubx, btnY, btnW, btnH2, btnH2 / 2); c.stroke()
      c.fillStyle = '#fff'
      c.font = `bold ${13*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('卸下法宝', ubx + btnW / 2, btnY + btnH2 / 2)
      _rects.unequipBtnRect = [ubx, btnY, btnW, btnH2]
    } else {
      const ebx = px + (pw - btnW) / 2
      c.fillStyle = 'rgba(212,175,55,0.8)'
      R.rr(ebx, btnY, btnW, btnH2, btnH2 / 2); c.fill()
      c.strokeStyle = 'rgba(255,220,80,0.6)'; c.lineWidth = 1.5 * S
      R.rr(ebx, btnY, btnW, btnH2, btnH2 / 2); c.stroke()
      c.fillStyle = '#3a1a00'
      c.font = `bold ${13*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('装备法宝', ebx + btnW / 2, btnY + btnH2 / 2)
      _rects.equipBtnRect = [ebx, btnY, btnW, btnH2]
    }
  }

  c.restore()
}

function resetScroll() {
  _scrollTouchY = 0
  _scrolling = false
}

function tWeaponPool(g, x, y, type) {
  const { S, W, H } = V

  if (g._weaponPoolDetail) {
    if (type !== 'end') return
    if (_rects.detailCloseBtnRect && g._hitRect(x, y, ..._rects.detailCloseBtnRect)) {
      g._weaponPoolDetail = null; return
    }
    if (_rects.equipBtnRect && g._hitRect(x, y, ..._rects.equipBtnRect)) {
      g.storage.equipWeapon(g._weaponPoolDetail)
      g._weaponPoolDetail = null; return
    }
    if (_rects.unequipBtnRect && g._hitRect(x, y, ..._rects.unequipBtnRect)) {
      g.storage.unequipWeapon()
      g._weaponPoolDetail = null; return
    }
    g._weaponPoolDetail = null
    return
  }

  if (type === 'start') {
    _scrollTouchY = y
    _scrolling = false
  }
  if (type === 'move') {
    const dy = _scrollTouchY - y
    if (Math.abs(dy) > 3 * S) _scrolling = true
    if (_scrolling) {
      g._weaponPoolScroll = Math.max(0, (g._weaponPoolScroll || 0) + dy)
      _scrollTouchY = y
      const contentH = (V.H * 0.55)
      const maxScroll = Math.max(0, (g._weaponPoolTotalH || 0) - contentH)
      g._weaponPoolScroll = Math.min(g._weaponPoolScroll, maxScroll)
    }
    return
  }
  if (type === 'end') {
    if (_scrolling) { _scrolling = false; return }

    const { BAR_ITEMS, getLayout: getBarLayout } = require('./bottomBar')
    const Lbar = getBarLayout()
    // 底栏必须优先于网格：最后一行卡片命中框可能纵向延伸到导航条区域，否则易误点法宝详情
    if (y >= Lbar.bottomBarY) {
      const barRects = g._bottomBarRects || []
      for (let i = 0; i < barRects.length; i++) {
        if (!g._hitRect(x, y, ...barRects[i])) continue
        const item = BAR_ITEMS[i]
        if (!item) continue
        if (item.key === 'cultivation') {
          const cv = require('./cultivationView')
          cv.resetScroll(); g.setScene('cultivation'); cv.checkRealmBreak(g); return
        }
        if (item.key === 'pets') {
          if (g.storage.petPoolCount >= 1) {
            g._petPoolFilter = 'all'; g._petPoolScroll = 0; g._petPoolDetail = null
            g.setScene('petPool')
          }
          return
        }
        if (item.key === 'dex') {
          if (g.storage.petPoolCount >= 1) { g._dexScrollY = 0; g.setScene('dex') }
          return
        }
        if (item.key === 'stage') { g.setScene('title'); return }
        if (item.key === 'weapons') return
        if (item.key === 'rank') { g._openRanking(); return }
        if (item.key === 'more') { g.showMorePanel = true; g.setScene('title'); return }
      }
      return
    }

    for (const card of _rects.cardRects) {
      if (g._hitRect(x, y, ...card.rect)) {
        g._weaponPoolDetail = card.weaponId
        return
      }
    }
  }
}

module.exports = { rWeaponPool, tWeaponPool, resetScroll }
