/**
 * 法宝阁界面 — 法宝收集网格 + 详情面板（含装备/卸下）
 * 渲染入口：rWeaponPool  触摸入口：tWeaponPool
 */
const V = require('./env')
const { WEAPON_ACQUIRE_HINT_UNOWNED } = require('../data/constants')
const { WEAPONS, getWeaponById, getWeaponRarity } = require('../data/weapons')
const { drawBottomBar, getLayout: getTitleLayout, drawPageTitle } = require('./bottomBar')
const { drawCornerRarityBadge, drawInlineRarityBadge } = require('./rarityBadge')
const inkUI = require('./inkUiComponents')

const OWNED_CARD_BORDER = 'rgba(212,175,55,0.65)'
const WEAPON_POOL_ART = {
  bg: 'assets/backgrounds/petpool_ink_bg.jpg',
  card: 'assets/ui/pet_card_scroll_bg.png',
  filter: 'assets/ui/pet_filter_scroll_bg.png',
}
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'R', label: 'R' },
  { key: 'SR', label: 'SR' },
  { key: 'SSR', label: 'SSR' },
]

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

  if ((g.storage.weaponCollection || []).length < 1) {
    g.setScene('title')
    return
  }

  const bg = R.getImg(WEAPON_POOL_ART.bg)
  if (bg && bg.width > 0) R._drawCoverImg(bg, 0, 0, W, H)
  else R.drawHomeBg(g.af)

  const L = getTitleLayout()
  const topY = safeTop + 4 * S
  const contentTop = topY + 42 * S
  const navCloudReserve = 26 * S
  const contentBottom = L.bottomBarY - 4 * S - navCloudReserve
  const collection = g.storage.weaponCollection || []
  const collSet = new Set(collection)

  drawPageTitle(c, R, W, S, W * 0.5, topY + 24 * S, '法宝阁')

  // 收集进度：对齐灵宠池的轻量玉牌质感
  c.save()
  const progText = `${collection.length} / ${WEAPONS.length}`
  const ptW = 86 * S
  const ptH = 24 * S
  const ptX = W - 12 * S - ptW
  const ptY = topY + 12 * S
  const ptGrad = c.createLinearGradient(ptX, ptY, ptX, ptY + ptH)
  ptGrad.addColorStop(0, 'rgba(46,82,66,0.82)')
  ptGrad.addColorStop(1, 'rgba(35,58,48,0.82)')
  c.fillStyle = ptGrad
  R.rr(ptX, ptY, ptW, ptH, 9 * S); c.fill()
  c.strokeStyle = 'rgba(231,199,116,0.68)'
  c.lineWidth = 1.2 * S
  R.rr(ptX, ptY, ptW, ptH, 9 * S); c.stroke()
  c.fillStyle = '#fff1cc'
  c.font = `bold ${11*S}px "PingFang SC",serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(18,28,22,0.78)'
  c.lineWidth = 2 * S
  c.strokeText(`收录 ${progText}`, ptX + ptW / 2, ptY + ptH / 2 + 0.5 * S)
  c.fillText(`收录 ${progText}`, ptX + ptW / 2, ptY + ptH / 2 + 0.5 * S)
  c.restore()

  _rects.filterRects = []

  const filterY = contentTop + 10 * S
  const filterH = 26 * S
  const filterBg = R.getImg(WEAPON_POOL_ART.filter)
  const filterBgX = 6 * S
  const filterBgY = filterY - 12 * S
  const filterBgW = W - 12 * S
  const filterBgH = filterH + 30 * S
  if (filterBg && filterBg.width > 0) {
    c.drawImage(filterBg, filterBgX, filterBgY, filterBgW, filterBgH)
  } else {
    c.fillStyle = 'rgba(222,205,164,0.28)'
    R.rr(filterBgX, filterBgY, filterBgW, filterBgH, 18 * S); c.fill()
  }
  _rects.filterRects = inkUI.drawInkFilterTabs(c, R, S, FILTERS, g._weaponPoolFilter || 'all',
    12 * S, filterY, W - 24 * S, filterH, {
      fontSize: 10.5,
      gap: 6 * S,
      activeBg: 'rgba(74,145,122,0.62)',
      activeBorder: 'rgba(212,190,118,0.9)',
      bg: 'rgba(236,219,178,0.34)',
      radius: 6 * S,
    }).map(r => ({ key: r.key, rect: [r.x, r.y, r.w, r.h] }))

  // 卡片网格
  const gridTop = filterY + filterH + 8 * S
  const gridBottom = contentBottom
  const rarityFilter = g._weaponPoolFilter || 'all'
  const weapons = rarityFilter === 'all'
    ? WEAPONS.slice()
    : WEAPONS.filter(w => getWeaponRarity(w.id) === rarityFilter)
  weapons.sort((a, b) => {
    const ao = collSet.has(a.id) ? 0 : 1
    const bo = collSet.has(b.id) ? 0 : 1
    if (ao !== bo) return ao - bo
    return Number(a.id.replace('w', '')) - Number(b.id.replace('w', ''))
  })
  const cols = 3
  const cardGap = 8 * S
  const padX = 12 * S
  const cardW = (W - padX * 2 - cardGap * (cols - 1)) / cols
  const cardH = cardW * 1.32
  _rects.cardRects = []
  g._weaponPoolContentH = gridBottom - gridTop

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
  const rarityKey = getWeaponRarity(wpn.id) || 'R'

  c.save()
  const cardBg = R.getImg(WEAPON_POOL_ART.card)
  if (cardBg && cardBg.width > 0) {
    c.globalAlpha = owned ? 1 : 0.42
    c.drawImage(cardBg, x, y, w, h)
    c.globalAlpha = 1
  } else {
    const grad = c.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, owned ? 'rgba(250,239,208,0.82)' : 'rgba(234,224,200,0.32)')
    grad.addColorStop(1, owned ? 'rgba(222,199,156,0.68)' : 'rgba(180,170,150,0.24)')
    c.fillStyle = grad
    R.rr(x, y, w, h, 10 * S); c.fill()
    c.strokeStyle = owned ? OWNED_CARD_BORDER : 'rgba(125,110,86,0.24)'
    c.lineWidth = owned ? 1.4 * S : 0.8 * S
    R.rr(x, y, w, h, 10 * S); c.stroke()
  }

  const iconSz = Math.min(w - 16 * S, h - 38 * S)
  const iconX = x + (w - iconSz) / 2
  const iconY = y + 7 * S

  if (owned) {
    const wpnImg = R.getImg(`assets/equipment/fabao_${wpn.id}.png`)
    if (wpnImg && wpnImg.width > 0) {
      R.drawCoverImg(wpnImg, iconX, iconY, iconSz, iconSz, { radius: 8 * S })
    }

    if (equipped) {
      c.fillStyle = 'rgba(150,65,38,0.88)'
      const badgeW = 38 * S
      const badgeH = 16 * S
      R.rr(x + w - badgeW - 5 * S, y + 5 * S, badgeW, badgeH, 5 * S); c.fill()
      c.fillStyle = '#ffe8b0'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('装备中', x + w - badgeW / 2 - 5 * S, y + 5 * S + badgeH / 2)
    }
    drawCornerRarityBadge(c, R, S, x + 6 * S, y + 6 * S, rarityKey, wpn.attr, {
      minWidth: 22 * S,
      height: 12 * S,
      fontSize: 7.2 * S,
    })
  } else {
    c.fillStyle = 'rgba(62,58,48,0.22)'
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.fill()
    c.strokeStyle = 'rgba(92,82,66,0.18)'
    c.lineWidth = 1 * S
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.stroke()
    c.fillStyle = 'rgba(80,72,58,0.34)'
    c.font = `bold ${w * 0.34}px "STKaiti","PingFang SC",serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('?', x + w / 2, iconY + iconSz / 2)
  }

  // 名称
  if (owned) {
    c.fillStyle = 'rgba(246,232,196,0.82)'
    R.rr(x + 10 * S, y + h - 27 * S, w - 20 * S, 20 * S, 6 * S); c.fill()
    c.strokeStyle = 'rgba(180,140,66,0.28)'
    c.lineWidth = 0.8 * S
    R.rr(x + 10 * S, y + h - 27 * S, w - 20 * S, 20 * S, 6 * S); c.stroke()
  }
  c.fillStyle = owned ? '#3a2f24' : 'rgba(86,76,60,0.48)'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  const name = owned ? (wpn.name.length > 5 ? wpn.name.substring(0, 5) : wpn.name) : '???'
  c.fillText(name, x + w / 2, y + h - 16 * S)

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
  const rarityKey = getWeaponRarity(wpnId) || 'R'

  c.save()
  c.fillStyle = 'rgba(0,0,0,0.65)'
  c.fillRect(0, 0, W, H)

  const pw = W * 0.82
  const innerPad = 16 * S
  const iconSz = Math.min(pw * 0.40, 90 * S)
  const descText = owned ? wpn.desc : WEAPON_ACQUIRE_HINT_UNOWNED
  c.font = `${12*S}px "PingFang SC",sans-serif`
  const maxDescW = pw - innerPad * 2
  const rawDescLines = _wrapLines(c, descText, maxDescW)
  const descLinesArr = rawDescLines.slice(0, 3)
  if (rawDescLines.length > 3 && descLinesArr.length > 0) descLinesArr[2] += '…'
  const ph = Math.min(owned ? 338 * S : 292 * S, H - (V.safeTop || 0) - 18 * S)
  const px = (W - pw) / 2
  const py = Math.max((V.safeTop || 0) + 8 * S, (H - ph) / 2)
  inkUI.drawScrollPanel(c, R, S, px, py, pw, ph, {
    radius: 16 * S,
    insetX: innerPad,
    insetY: innerPad,
    top: 'rgba(250,243,225,0.97)',
    bottom: 'rgba(229,214,185,0.96)',
    border: owned ? 'rgba(212,175,55,0.70)' : 'rgba(120,102,78,0.55)',
    lineWidth: owned ? 1.8 * S : 1.2 * S,
  })

  const innerTop = py + innerPad
  const innerBottom = py + ph - innerPad
  const innerLeft = px + innerPad
  const innerRight = px + pw - innerPad

  const closeSize = 28 * S
  const closeX = innerRight - closeSize
  const closeYClamped = py + 8 * S
  c.fillStyle = 'rgba(80,55,35,0.25)'
  c.beginPath(); c.arc(closeX + closeSize / 2, closeYClamped + closeSize / 2, closeSize / 2, 0, Math.PI * 2); c.fill()
  c.strokeStyle = 'rgba(90,60,40,0.55)'; c.lineWidth = 1.5 * S
  c.beginPath(); c.arc(closeX + closeSize / 2, closeYClamped + closeSize / 2, closeSize / 2, 0, Math.PI * 2); c.stroke()
  c.strokeStyle = '#5A4530'; c.lineWidth = 2 * S
  const cx0 = closeX + closeSize / 2, cy0 = closeYClamped + closeSize / 2, cr = 7 * S
  c.beginPath(); c.moveTo(cx0 - cr, cy0 - cr); c.lineTo(cx0 + cr, cy0 + cr); c.stroke()
  c.beginPath(); c.moveTo(cx0 + cr, cy0 - cr); c.lineTo(cx0 - cr, cy0 + cr); c.stroke()
  _rects.detailCloseBtnRect = [closeX, closeYClamped, closeSize, closeSize]

  let curY = innerTop + 10 * S
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  if (owned) {
    drawInlineRarityBadge(c, R, S, px + innerPad + 20 * S, curY, rarityKey, wpn.attr, {
      minWidth: 30 * S,
      height: 14 * S,
      fontSize: 8 * S,
    })
  }
  const iconX = px + (pw - iconSz) / 2
  const iconY = curY + 18 * S

  if (owned) {
    const wpnImg = R.getImg(`assets/equipment/fabao_${wpn.id}.png`)
    if (wpnImg && wpnImg.width > 0) {
      R.drawCoverImg(wpnImg, iconX, iconY, iconSz, iconSz, { radius: 10 * S })
    }
    R.drawWeaponFrame(iconX, iconY, iconSz)
  } else {
    c.fillStyle = 'rgba(100,90,70,0.16)'
    R.rr(iconX, iconY, iconSz, iconSz, 8 * S); c.fill()
    c.fillStyle = 'rgba(80,72,58,0.42)'
    c.font = `bold ${iconSz * 0.5}px "STKaiti","PingFang SC",serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('?', iconX + iconSz / 2, iconY + iconSz / 2)
  }

  curY = iconY + iconSz + 12 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#3D2B1F'
  c.font = `bold ${17*S}px "STKaiti","PingFang SC",serif`
  c.fillText(owned ? wpn.name : '未知法宝', px + pw / 2, curY + 9 * S)
  curY += 30 * S

  const stateText = owned ? (equipped ? '已装备 · 战斗生效' : '已收录 · 可装备') : '尚未收录 · 继续探索'
  inkUI.drawRolePill(c, R, S, px + pw / 2 - 58 * S, curY, stateText, {
    w: 116 * S,
    h: 17 * S,
    fontSize: 8,
  })
  curY += 28 * S

  c.fillStyle = owned ? '#7A5C30' : '#766958'
  c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(owned ? '法宝效果' : '获取线索', innerLeft, curY)
  curY += 17 * S
  c.fillStyle = owned ? '#5C4A3A' : '#766958'
  c.font = `${11*S}px "PingFang SC",sans-serif`
  descLinesArr.forEach((ln, i) => {
    c.fillText(ln, innerLeft + 3 * S, curY + i * 15 * S)
  })

  _rects.equipBtnRect = null
  _rects.unequipBtnRect = null

  if (owned) {
    const btnW = 120 * S
    const btnH2 = 36 * S
    const btnY = innerBottom - btnH2

    if (equipped) {
      const ubx = px + (pw - btnW) / 2
      inkUI.drawInkActionButton(c, R, S, ubx, btnY, btnW, btnH2, '卸下法宝', {
        top: '#b85a3a',
        bottom: '#7e3024',
      })
      _rects.unequipBtnRect = [ubx, btnY, btnW, btnH2]
    } else {
      const ebx = px + (pw - btnW) / 2
      inkUI.drawInkActionButton(c, R, S, ebx, btnY, btnW, btnH2, '装备法宝')
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

  if ((g.storage.weaponCollection || []).length < 1) return

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
      const contentH = g._weaponPoolContentH || (V.H * 0.55)
      const maxScroll = Math.max(0, (g._weaponPoolTotalH || 0) - contentH)
      g._weaponPoolScroll = Math.min(g._weaponPoolScroll, maxScroll)
    }
    return
  }
  if (type === 'end') {
    if (_scrolling) { _scrolling = false; return }

    for (const f of _rects.filterRects) {
      if (g._hitRect(x, y, ...f.rect)) {
        g._weaponPoolFilter = f.key
        g._weaponPoolScroll = 0
        return
      }
    }

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
            g._petPoolFilter = 'all'; g._petPoolRarityFilter = 'all'; g._petPoolScroll = 0; g._petPoolDetail = null
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
