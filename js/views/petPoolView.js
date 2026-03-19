/**
 * 灵宠池界面 — 卡片网格 + 属性筛选 + 详情面板（含升级/升星/分解）
 * 渲染入口：rPetPool  触摸入口：tPetPool
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetTier, getPetSkillDesc, getPetAvatarPath, petHasSkill } = require('../data/pets')
const { getPoolPetAtk, petExpToNextLevel, POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_MAX_LV, POOL_ADV_MAX_LV, POOL_STAR_ATK_MUL, FRAGMENT_TO_EXP } = require('../data/petPoolConfig')
const { drawBottomBar, getLayout: getTitleLayout, drawPageTitle } = require('./bottomBar')
const MusicMgr = require('../runtime/music')
const P = require('../platform')
const { drawSeparator, wrapTextDraw, getFilteredPool: _getFilteredPoolUtil } = require('./uiUtils')

// 属性筛选标签
const FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'metal', label: '金' },
  { key: 'wood', label: '木' },
  { key: 'water', label: '水' },
  { key: 'fire', label: '火' },
  { key: 'earth', label: '土' },
]

// 模块内触摸区域（不污染 g）
const _rects = {
  filterRects: [],        // [{ key, rect: [x,y,w,h] }]
  cardRects: [],          // [{ petId, rect: [x,y,w,h] }]
  backBtnRect: null,      // [x,y,w,h]
  detailCloseRect: null,  // [x,y,w,h]
  levelUpBtnRect: null,   // [x,y,w,h]
  starUpBtnRect: null,    // [x,y,w,h]
  decomposeBtnRect: null, // [x,y,w,h]
  idleBtnRect: null,      // [x,y,w,h]
}

// 长按升级相关状态
let _longPressTimer = null
let _longPressActive = false
let _longPressPetId = null

const _getFilteredPool = _getFilteredPoolUtil

// 离屏 canvas 缓存，用于派遣按钮像素对齐绘制（修复有红点时的模糊）
let _idleBtnOC = null

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ===== 主渲染 =====
function rPetPool(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  // 背景：优先使用专属背景图，fallback 到首页背景
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }
  // 去掉背景遮罩，保持背景清晰可见

  const L = getTitleLayout()
  const topY = safeTop + 4 * S
  const contentTop = topY + 36 * S
  const contentBottom = L.bottomBarY - 4 * S
  _rects.backBtnRect = null

  // === 顶栏 ===
  c.save()
  // 去掉顶栏深色背景遮罩

  drawPageTitle(c, R, W, S, W * 0.5, topY + 24 * S, '灵宠池')

  // 经验池图标和余额（左上角显示）
  const expPool = g.storage.petExpPool || 0
  const expIcon = R.getImg('assets/ui/icon_pet_exp.png')
  if (expIcon && expIcon.width > 0) {
    const iconSz = 32 * S
    const centerY = topY + 17 * S
    const iconX = 10 * S
    const iconY = centerY - iconSz / 2

    // 先量文字宽度，画胶囊（从图标中心延伸到数字右侧），再画图标压上去
    const txtX = iconX + iconSz + 4 * S
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    const txtW = c.measureText(`${expPool}`).width
    const padX = 8 * S
    const capH = 26 * S, capR = capH / 2
    const capX = iconX + iconSz * 0.38   // 从图标中心偏左处开始
    const capW = txtX + txtW + padX - capX
    const capY = centerY - capH / 2
    c.save()
    c.beginPath()
    c.moveTo(capX + capR, capY); c.lineTo(capX + capW - capR, capY)
    c.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
    c.lineTo(capX + capW, capY + capH - capR)
    c.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
    c.lineTo(capX + capR, capY + capH)
    c.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
    c.lineTo(capX, capY + capR)
    c.quadraticCurveTo(capX, capY, capX + capR, capY)
    c.closePath()
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill()
    c.restore()

    // 数字
    c.fillStyle = '#fff'
    c.fillText(`${expPool}`, txtX, centerY)

    // 图标压在胶囊上方
    c.drawImage(expIcon, iconX, iconY, iconSz, iconSz)
  }

  c.restore()

  // === 属性筛选 ===
  const filterY = contentTop + 4 * S
  const filterH = 26 * S
  const idleBtnReserve = 60 * S   // 右侧为派遣按钮预留空间
  const filterW = (W - 24 * S - idleBtnReserve) / FILTERS.length
  _rects.filterRects = []
  c.save()
  for (let i = 0; i < FILTERS.length; i++) {
    const f = FILTERS[i]
    const fx = 12 * S + i * filterW
    const isActive = (g._petPoolFilter || 'all') === f.key
    // 标签背景色改为与背景色一致的碧翠色系
    c.fillStyle = isActive ? 'rgba(70,180,160,0.5)' : 'rgba(70,180,160,0.2)'
    R.rr(fx, filterY, filterW - 4 * S, filterH, 6 * S); c.fill()
    if (isActive) {
      c.strokeStyle = 'rgba(70,180,160,0.9)'; c.lineWidth = 2 * S
      R.rr(fx, filterY, filterW - 4 * S, filterH, 6 * S); c.stroke()
    }
    // 文字改为白色，更清晰
    c.fillStyle = isActive ? '#fff' : 'rgba(255,255,255,0.8)'
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    // 加黑色描边
    c.strokeStyle = 'rgba(0,0,0,0.4)'
    c.lineWidth = 2.5 * S
    c.strokeText(f.label, fx + (filterW - 4 * S) / 2, filterY + filterH / 2)
    c.fillText(f.label, fx + (filterW - 4 * S) / 2, filterY + filterH / 2)
    _rects.filterRects.push({ key: f.key, rect: [fx, filterY, filterW - 4 * S, filterH] })
  }
  c.restore()

  // === 派遣入口按钮（筛选行右侧留白区，避开系统按钮）===
  // 有红点时用离屏 canvas 单独绘制，避免 strokeText+fillText+arc 混绘导致的模糊
  const hasIdleReward = g.storage.idleHasReward()
  const idleBtnH = filterH
  const idleBtnW = 52 * S
  const idleBtnX = W - idleBtnW - 12 * S
  const idleBtnY = filterY
  const iw = Math.max(1, Math.round(idleBtnW)), ih = Math.max(1, Math.round(idleBtnH))
  const ix = Math.round(idleBtnX), iy = Math.round(idleBtnY)
  const useOffscreen = hasIdleReward
  let oc = useOffscreen ? _idleBtnOC : null
  if (useOffscreen && (!oc || oc.width !== iw || oc.height !== ih)) {
    oc = (P.createOffscreenCanvas && P.createOffscreenCanvas({ type: '2d', width: iw, height: ih })) ||
      (typeof document !== 'undefined' && (() => { const dc = document.createElement('canvas'); dc.width = iw; dc.height = ih; return dc })())
    _idleBtnOC = oc
  }
  if (useOffscreen && oc) {
    const occ = oc.getContext('2d')
    occ.clearRect(0, 0, iw, ih)
    occ.fillStyle = hasIdleReward ? 'rgba(255,180,50,0.9)' : 'rgba(80,60,120,0.7)'
    _roundRect(occ, 0, 0, iw, ih, ih / 2)
    occ.fill()
    occ.strokeStyle = hasIdleReward ? 'rgba(255,220,80,0.8)' : 'rgba(200,180,240,0.4)'
    occ.lineWidth = Math.max(1, Math.round(1.5 * S))
    _roundRect(occ, 0, 0, iw, ih, ih / 2)
    occ.stroke()
    occ.fillStyle = hasIdleReward ? '#5a2d0c' : '#ffe8a0'
    const fontPx = Math.max(10, Math.round(11 * S))
    occ.font = `bold ${fontPx}px "PingFang SC",sans-serif`
    occ.textAlign = 'center'
    occ.textBaseline = 'middle'
    if (hasIdleReward) {
      occ.fillText('派遣', iw / 2, ih / 2)
    } else {
      occ.strokeStyle = 'rgba(0,0,0,0.4)'
      occ.lineWidth = Math.max(1, Math.round(2.5 * S))
      occ.strokeText('派遣', iw / 2, ih / 2)
      occ.fillText('派遣', iw / 2, ih / 2)
    }
    if (hasIdleReward) {
      const dotR = Math.max(1, Math.round(5 * S))
      const dotX = iw - dotR - 2
      const dotY = dotR + 2
      occ.fillStyle = '#ff3333'
      occ.beginPath()
      occ.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      occ.fill()
    }
    c.drawImage(oc, ix, iy, iw, ih)
  } else {
    c.save()
    c.fillStyle = hasIdleReward ? 'rgba(255,180,50,0.9)' : 'rgba(80,60,120,0.7)'
    R.rr(ix, iy, iw, ih, ih / 2); c.fill()
    c.strokeStyle = hasIdleReward ? 'rgba(255,220,80,0.8)' : 'rgba(200,180,240,0.4)'
    c.lineWidth = 1.5 * S
    R.rr(ix, iy, iw, ih, ih / 2); c.stroke()
    c.fillStyle = hasIdleReward ? '#5a2d0c' : '#ffe8a0'
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    const tx = Math.round(ix + iw / 2), ty = Math.round(iy + ih / 2)
    if (hasIdleReward) { c.fillText('派遣', tx, ty) }
    else { c.strokeStyle = 'rgba(0,0,0,0.4)'; c.lineWidth = 2.5 * S; c.strokeText('派遣', tx, ty); c.fillText('派遣', tx, ty) }
    if (hasIdleReward) {
      const dotR = Math.max(1, Math.round(5 * S)), dotX = Math.round(ix + iw - 3 * S), dotY = Math.round(iy + 3 * S)
      c.fillStyle = '#ff3333'; c.beginPath(); c.arc(dotX, dotY, dotR, 0, Math.PI * 2); c.fill()
    }
    c.restore()
  }
  _rects.idleBtnRect = [idleBtnX, idleBtnY, idleBtnW, idleBtnH]

  // === 卡片网格 ===
  const gridTop = filterY + filterH + 8 * S
  const gridBottom = contentBottom
  const pool = _getFilteredPool(g)
  const cols = 3
  const cardGap = 8 * S
  const cardW = (W - 24 * S - cardGap * (cols - 1)) / cols
  const cardH = cardW * 1.35
  _rects.cardRects = []

  c.save()
  // 可滚动区域裁切
  c.beginPath()
  c.rect(0, gridTop, W, gridBottom - gridTop)
  c.clip()

  const scrollY = g._petPoolScroll || 0
  const totalRows = Math.ceil(pool.length / cols)
  const totalH = totalRows * (cardH + cardGap) + cardGap

  if (pool.length === 0) {
    c.fillStyle = 'rgba(255,255,255,0.5)'
    c.font = `${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('暂无灵宠，在肉鸽中收集★3图鉴即可入池', W / 2, (gridTop + gridBottom) / 2)
  }

  for (let idx = 0; idx < pool.length; idx++) {
    const pet = pool[idx]
    const row = Math.floor(idx / cols)
    const col = idx % cols
    const cx = 12 * S + col * (cardW + cardGap)
    const cy = gridTop + row * (cardH + cardGap) + cardGap - scrollY

    if (cy + cardH < gridTop || cy > gridBottom) continue

    _drawPetCard(c, R, S, W, cx, cy, cardW, cardH, pet)
    _rects.cardRects.push({ petId: pet.id, rect: [cx, cy, cardW, cardH] })
  }

  // 幽灵卡片：碎片银行中有碎片的未拥有宠物（半透明）
  const bank = g.storage.fragmentBank || {}
  const ownedIds = new Set(pool.map(p => p.id))
  const filter = g._petPoolFilter || 'all'
  const ghostPets = Object.keys(bank)
    .filter(id => !ownedIds.has(id) && bank[id] > 0)
    .filter(id => {
      if (filter === 'all') return true
      const bp = getPetById(id)
      return bp && bp.attr === filter
    })
  const ghostStart = pool.length
  for (let gi = 0; gi < ghostPets.length; gi++) {
    const gIdx = ghostStart + gi
    const row = Math.floor(gIdx / cols)
    const col = gIdx % cols
    const cx = 12 * S + col * (cardW + cardGap)
    const cy = gridTop + row * (cardH + cardGap) + cardGap - scrollY
    if (cy + cardH < gridTop || cy > gridBottom) continue
    _drawGhostCard(c, R, S, W, cx, cy, cardW, cardH, ghostPets[gi], bank[ghostPets[gi]])
    _rects.cardRects.push({ petId: ghostPets[gi], rect: [cx, cy, cardW, cardH], ghost: true })
  }
  c.restore()

  // 收集提示
  const poolCount = g.storage.petPoolCount
  if (poolCount < 5) {
    c.save()
    c.fillStyle = 'rgba(255,200,50,0.7)'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'bottom'
    c.fillText(`灵兽秘境解锁条件：灵宠池≥5只（当前 ${poolCount} 只）`, W / 2, contentBottom - 2 * S)
    c.restore()
  }

  // 底部导航（复用首页）
  drawBottomBar(g)

  // === 详情面板 ===
  if (g._petPoolDetail) {
    _drawDetailPanel(g)
  }
}

// ===== 宠物卡片 =====
function _drawPetCard(c, R, S, W, x, y, w, h, poolPet) {
  const basePet = getPetById(poolPet.id)
  if (!basePet) return
  const tier = getPetTier(poolPet.id)
  const atk = getPoolPetAtk(poolPet)
  const attrColor = ATTR_COLOR[poolPet.attr]

  c.save()

  // 卡片底图（优先使用资源图，fallback 到绘制）
  const cardBg = R.getImg('assets/ui/pet_card_bg.png')
  if (cardBg && cardBg.width > 0) {
    c.drawImage(cardBg, x, y, w, h)
  } else {
    c.fillStyle = 'rgba(30,20,10,0.75)'
    R.rr(x, y, w, h, 8 * S); c.fill()
  }

  // 去掉属性色外边框

  // 左上角五行珠子图标（调整位置，贴合卡片内侧）
  const orbPath = `assets/orbs/orb_${poolPet.attr || 'metal'}.png`
  const orbImg = R.getImg(orbPath)
  if (orbImg && orbImg.width > 0) {
    const orbSz = 18 * S  // 缩小珠子尺寸
    const orbX = x + 10 * S
    const orbY = y + 10 * S
    // 珠子背景光晕
    c.save()
    const orbCx = orbX + orbSz / 2
    const orbCy = orbY + orbSz / 2
    const orbGrad = c.createRadialGradient(orbCx, orbCy, orbSz * 0.2, orbCx, orbCy, orbSz * 0.6)
    orbGrad.addColorStop(0, (attrColor ? attrColor.main : '#888') + '80')
    orbGrad.addColorStop(1, (attrColor ? attrColor.main : '#888') + '00')
    c.fillStyle = orbGrad
    c.beginPath()
    c.arc(orbCx, orbCy, orbSz * 0.6, 0, Math.PI * 2)
    c.fill()
    c.restore()
    // 绘制珠子
    c.drawImage(orbImg, orbX, orbY, orbSz, orbSz)
  }

  // 头像区域
  const avatarSize = w * 0.62
  const avatarX = x + (w - avatarSize) / 2
  const avatarY = y + 8 * S
  const avatarPath = getPetAvatarPath({ ...basePet, star: poolPet.star })
  const img = R.getImg(avatarPath)

  if (img && img.width > 0) {
    c.save()
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 6 * S); c.clip()
    const aw = img.width, ah = img.height
    const isStar3 = (poolPet.star || 1) >= 3
    const scale = isStar3 ? Math.min(avatarSize / aw, avatarSize / ah) * 0.82 : Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * scale, dh = ah * scale
    const offsetY = isStar3 ? 6 * S : 0
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2 + offsetY, dw, dh)
    c.restore()
  } else {
    c.fillStyle = attrColor ? attrColor.main : '#555'
    c.globalAlpha = 0.3
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 6 * S); c.fill()
    c.globalAlpha = 1
    c.fillStyle = '#fff'
    c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(basePet.name.slice(0, 2), avatarX + avatarSize / 2, avatarY + avatarSize / 2)
  }

  // 去掉宠物头像框，让宠物图片直接显示

  // 名称（加深色描边，增强可读性）
  const nameY = avatarY + avatarSize + 6 * S
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  const displayName = basePet.name.length > 4 ? basePet.name.slice(0, 4) + '…' : basePet.name
  c.strokeStyle = 'rgba(0,0,0,0.7)'
  c.lineWidth = 3 * S
  c.strokeText(displayName, x + w / 2, nameY)
  c.fillStyle = '#fff'
  c.fillText(displayName, x + w / 2, nameY)

  // 星级（逐个绘制：满星黄色，空星深灰色，统一用★）
  const starY = nameY + 14 * S
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  // 先计算总宽度用于居中
  let starStr = ''
  for (let i = 0; i < 3; i++) starStr += '★'
  const totalStarW = c.measureText(starStr).width
  let starX = x + w / 2 - totalStarW / 2
  c.textAlign = 'left'
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i < poolPet.star ? '#ffd700' : 'rgba(120,120,120,0.6)'
    c.fillText('★', starX, starY)
    starX += c.measureText('★').width
  }
  c.textAlign = 'center'

  // 等级 + ATK（加深色描边）
  const infoY = starY + 14 * S
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.7)'
  c.lineWidth = 2.5 * S
  c.strokeText(`Lv.${poolPet.level}  ATK:${atk}`, x + w / 2, infoY)
  c.fillStyle = '#fff'
  c.fillText(`Lv.${poolPet.level}  ATK:${atk}`, x + w / 2, infoY)

  c.restore()
}

// ===== 幽灵卡片（未入池但有碎片的宠物） =====
function _drawGhostCard(c, R, S, W, x, y, w, h, petId, fragCount) {
  const basePet = getPetById(petId)
  if (!basePet) return
  const tier = getPetTier(petId)
  const attrColor = ATTR_COLOR[basePet.attr]
  const { SUMMON_FRAG_COST } = require('../data/chestConfig')
  const cost = SUMMON_FRAG_COST[tier] || 15

  c.save()
  c.globalAlpha = 0.5

  const cardBg = R.getImg('assets/ui/pet_card_bg.png')
  if (cardBg && cardBg.width > 0) {
    c.drawImage(cardBg, x, y, w, h)
  } else {
    c.fillStyle = 'rgba(30,20,10,0.75)'
    R.rr(x, y, w, h, 8 * S); c.fill()
  }

  // 头像
  const avatarSize = w * 0.62
  const avatarX = x + (w - avatarSize) / 2
  const avatarY = y + 8 * S
  const avatarPath = getPetAvatarPath({ ...basePet, star: 1 })
  const img = R.getImg(avatarPath)
  if (img && img.width > 0) {
    c.save()
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 6 * S); c.clip()
    const aw = img.width, ah = img.height
    const scale = Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * scale, dh = ah * scale
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
    c.restore()
  }

  c.globalAlpha = 1

  // 名称
  const nameY = avatarY + avatarSize + 6 * S
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  const displayName = basePet.name.length > 4 ? basePet.name.slice(0, 4) + '…' : basePet.name
  c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3 * S
  c.strokeText(displayName, x + w / 2, nameY)
  c.fillStyle = 'rgba(200,200,220,0.8)'
  c.fillText(displayName, x + w / 2, nameY)

  // 碎片进度条
  const barW = w * 0.7
  const barH2 = 8 * S
  const barX = x + (w - barW) / 2
  const barY2 = nameY + 16 * S
  const progress = Math.min(1, fragCount / cost)
  c.fillStyle = 'rgba(0,0,0,0.3)'
  R.rr(barX, barY2, barW, barH2, barH2 / 2); c.fill()
  if (progress > 0) {
    const fillGrad = c.createLinearGradient(barX, barY2, barX + barW * progress, barY2)
    fillGrad.addColorStop(0, '#9b7aff')
    fillGrad.addColorStop(1, '#6b4adf')
    c.fillStyle = fillGrad
    R.rr(barX, barY2, barW * progress, barH2, barH2 / 2); c.fill()
  }

  // 碎片数字
  c.fillStyle = fragCount >= cost ? '#7ecf6a' : 'rgba(200,200,220,0.7)'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.fillText(`${fragCount}/${cost}`, x + w / 2, barY2 + barH2 + 3 * S)

  c.restore()
}

// ===== 详情面板（全自绘） =====
function _drawDetailPanel(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  const petId = g._petPoolDetail
  const poolPet = g.storage.getPoolPet(petId)
  if (!poolPet) { g._petPoolDetail = null; return }
  const basePet = getPetById(petId)
  if (!basePet) { g._petPoolDetail = null; return }

  const tier = getPetTier(petId)
  const atk = getPoolPetAtk(poolPet)
  const attrColor = ATTR_COLOR[poolPet.attr]
  const attrName = ATTR_NAME[poolPet.attr] || poolPet.attr
  const expPool = g.storage.petExpPool || 0
  const nextLvExp = petExpToNextLevel(poolPet.level, tier)
  const maxLv = poolPet.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
  const isMaxLv = poolPet.level >= maxLv

  // 遮罩
  c.fillStyle = 'rgba(0,0,0,0.7)'
  c.fillRect(0, 0, W, H)

  // 面板尺寸
  const pw = W * 0.88, ph = H * 0.75
  const px = (W - pw) / 2, py = (H - ph) / 2
  const rad = 16 * S

  // 面板阴影
  c.save()
  c.shadowColor = 'rgba(0,0,0,0.5)'
  c.shadowBlur = 24 * S
  c.shadowOffsetY = 4 * S

  // 面板背景：暖色渐变
  const bgGrad = c.createLinearGradient(px, py, px, py + ph)
  bgGrad.addColorStop(0, '#3D2B15')
  bgGrad.addColorStop(0.3, '#2A1E10')
  bgGrad.addColorStop(1, '#1A120A')
  c.fillStyle = bgGrad
  R.rr(px, py, pw, ph, rad); c.fill()
  c.restore()

  // 外边框：金色
  c.strokeStyle = '#C9A84C'
  c.lineWidth = 2 * S
  R.rr(px, py, pw, ph, rad); c.stroke()
  // 内边框
  c.strokeStyle = 'rgba(201,168,76,0.3)'
  c.lineWidth = 1 * S
  R.rr(px + 4*S, py + 4*S, pw - 8*S, ph - 8*S, rad - 2*S); c.stroke()

  _rects.detailCloseRect = [0, 0, W, H]

  const indent = px + 20 * S
  const rightEdge = px + pw - 20 * S
  const contentW = rightEdge - indent

  // ── 顶部：头像 + 名称区域 ──
  let cy = py + 18 * S
  const avatarSize = 64 * S
  const avatarX = indent
  const avatarY = cy

  // 头像背景
  const ac = attrColor ? attrColor.main : '#666'
  c.fillStyle = 'rgba(0,0,0,0.3)'
  R.rr(avatarX - 2*S, avatarY - 2*S, avatarSize + 4*S, avatarSize + 4*S, 10*S); c.fill()
  c.strokeStyle = ac; c.lineWidth = 2 * S
  R.rr(avatarX - 2*S, avatarY - 2*S, avatarSize + 4*S, avatarSize + 4*S, 10*S); c.stroke()

  // 头像
  const avatarPath = getPetAvatarPath({ ...basePet, star: poolPet.star })
  const img = R.getImg(avatarPath)
  if (img && img.width > 0) {
    c.save()
    const isStar3Detail = (poolPet.star || 1) >= 3
    const clipPad = isStar3Detail ? 6 * S : 0
    R.rr(avatarX - clipPad, avatarY - clipPad, avatarSize + clipPad * 2, avatarSize + clipPad * 2, 8*S); c.clip()
    const drawSz = avatarSize + clipPad * 2
    c.drawImage(img, avatarX - clipPad, avatarY - clipPad, drawSz, drawSz)
    c.restore()
  } else {
    c.fillStyle = ac
    c.globalAlpha = 0.3
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 8*S); c.fill()
    c.globalAlpha = 1
    c.fillStyle = '#fff'
    c.font = `bold ${22*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(basePet.name.slice(0, 2), avatarX + avatarSize/2, avatarY + avatarSize/2)
  }

  // 名称（头像右侧）
  const infoX = avatarX + avatarSize + 14 * S
  c.fillStyle = '#F5E6C8'
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(basePet.name, infoX, cy)

  // 属性标签
  const tagY = cy + 20 * S
  c.fillStyle = ac
  c.globalAlpha = 0.25
  R.rr(infoX, tagY, 52*S, 18*S, 4*S); c.fill()
  c.globalAlpha = 1
  c.strokeStyle = ac; c.lineWidth = 1*S
  R.rr(infoX, tagY, 52*S, 18*S, 4*S); c.stroke()
  c.fillStyle = ac
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(`${attrName}属性`, infoX + 26*S, tagY + 9*S)

  // 星级（头像下方）
  const starY = tagY + 24 * S
  let starStr = ''
  for (let i = 0; i < 3; i++) starStr += i < poolPet.star ? '★' : '☆'
  c.fillStyle = '#FFD700'
  c.font = `${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(starStr, infoX, starY)

  cy = avatarY + avatarSize + 14 * S

  // ── 分隔线 ──
  drawSeparator(c, indent, cy, rightEdge, null, 0.4)
  cy += 10 * S

  // ── 攻击力 ──
  c.fillStyle = '#E8D5A8'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(`攻击力`, indent, cy)
  c.fillStyle = '#FF9944'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${atk}`, rightEdge, cy)
  cy += 20 * S

  const baseAtk = basePet.atk
  const lvBonus = tier === 'T3' ? Math.floor(poolPet.level * 0.8) : poolPet.level
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  c.fillStyle = 'rgba(200,180,140,0.5)'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText(`基础${baseAtk} + 等级+${lvBonus} × 星级×${starMul}`, indent, cy)
  cy += 16 * S

  // ── 分隔线 ──
  drawSeparator(c, indent, cy, rightEdge, null, 0.4)
  cy += 10 * S

  // ── 等级 + 经验 + 升级按钮 ──
  c.fillStyle = '#E8D5A8'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  if (isMaxLv) {
    c.fillText(`Lv.${poolPet.level}`, indent, cy)
    c.fillStyle = '#FFD700'
    c.font = `${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText('满级', rightEdge, cy + 1*S)
    _rects.levelUpBtnRect = null
  } else {
    c.fillText(`Lv.${poolPet.level}`, indent, cy)
    // 经验条
    const barX = indent + 60 * S, barW = contentW - 60*S - 80*S
    const barY = cy + 2 * S, barH = 12 * S
    const lvProgress = Math.min(1, expPool / Math.max(1, nextLvExp))
    c.fillStyle = 'rgba(0,0,0,0.3)'
    R.rr(barX, barY, barW, barH, barH/2); c.fill()
    if (lvProgress > 0) {
      const fillGrad = c.createLinearGradient(barX, barY, barX + barW * lvProgress, barY)
      fillGrad.addColorStop(0, '#5CB8FF')
      fillGrad.addColorStop(1, '#3A8ADF')
      c.fillStyle = fillGrad
      R.rr(barX, barY, barW * lvProgress, barH, barH/2); c.fill()
    }
    c.strokeStyle = 'rgba(100,180,255,0.4)'; c.lineWidth = 1*S
    R.rr(barX, barY, barW, barH, barH/2); c.stroke()
    // 升级按钮
    const btnW = 72 * S, btnH = 24 * S
    const btnX = rightEdge - btnW, btnY = cy - 2 * S
    const canLvUp = expPool >= nextLvExp
    _drawActionBtn(c, R, S, btnX, btnY, btnW, btnH, '升级', canLvUp, '#5CB8FF')
    _rects.levelUpBtnRect = [btnX, btnY, btnW, btnH]
  }
  cy += 22 * S
  c.fillStyle = 'rgba(200,180,140,0.5)'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(`经验池：${expPool}` + (isMaxLv ? '' : ` / 本次需${nextLvExp}`), indent, cy)
  cy += 16 * S

  // ── 分隔线 ──
  drawSeparator(c, indent, cy, rightEdge, null, 0.4)
  cy += 10 * S

  // ── 技能 ──
  const fakePet = { ...basePet, star: poolPet.star }
  const hasSkill = petHasSkill(fakePet)
  c.fillStyle = '#E8D5A8'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('技能', indent, cy)
  cy += 18 * S

  if (hasSkill) {
    const skillDesc = getPetSkillDesc(fakePet)
    c.fillStyle = '#7ECF6A'
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(basePet.skill.name, indent, cy)
    cy += 16 * S
    c.fillStyle = 'rgba(200,180,140,0.6)'
    c.font = `${9*S}px "PingFang SC",sans-serif`
    const maxW = contentW
    const words = skillDesc || ''
    wrapTextDraw(c, words, indent, cy, maxW, 13*S)
    const lines = Math.ceil(c.measureText(words).width / maxW)
    cy += Math.max(1, lines) * 13 * S + 4 * S
  } else {
    c.fillStyle = 'rgba(200,180,140,0.4)'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('★2解锁技能', indent, cy)
    cy += 16 * S
  }

  // ── 分隔线 ──
  drawSeparator(c, indent, cy, rightEdge, null, 0.4)
  cy += 10 * S

  // ── 升星信息 ──
  const nextStar = poolPet.star + 1
  const maxStar = poolPet.source === 'stage' ? 4 : 3
  _rects.starUpBtnRect = null
  _rects.decomposeBtnRect = null

  if (nextStar <= maxStar) {
    const lvReq = POOL_STAR_LV_REQ[nextStar]
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    const lvOk = poolPet.level >= lvReq
    const fragOk = poolPet.fragments >= fragCost

    c.fillStyle = '#E8D5A8'
    c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    let nextStarStr = ''
    for (let i = 0; i < maxStar; i++) nextStarStr += i < nextStar ? '★' : '☆'
    c.fillText(`升至 ${nextStarStr}`, indent, cy)
    cy += 20 * S

    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillStyle = lvOk ? '#7ECF6A' : '#E06060'
    c.fillText(lvOk ? `等级已达到 Lv.${lvReq}` : `需要等级达到 Lv.${lvReq}（当前Lv.${poolPet.level}）`, indent, cy)
    cy += 16 * S

    c.fillStyle = fragOk ? '#7ECF6A' : '#E06060'
    c.fillText(fragOk ? `碎片已足够 ${fragCost}片` : `需要碎片达到 ${fragCost}片（当前${poolPet.fragments}片）`, indent, cy)
    cy += 20 * S

    // 升星按钮
    const canStarUp = lvOk && fragOk
    const sBtnW = 90 * S, sBtnH = 30 * S
    const sBtnX = indent
    _drawActionBtn(c, R, S, sBtnX, cy, sBtnW, sBtnH, '升星', canStarUp, '#FFD700')
    _rects.starUpBtnRect = [sBtnX, cy, sBtnW, sBtnH]
    cy += sBtnH + 10 * S

    if (poolPet.fragments > 0) {
      const dBtnW = 130 * S
      _drawActionBtn(c, R, S, indent, cy, dBtnW, sBtnH, `分解1碎→${FRAGMENT_TO_EXP}经验`, true, '#B8A0E0')
      _rects.decomposeBtnRect = [indent, cy, dBtnW, sBtnH]
      cy += sBtnH + 6 * S
      c.fillStyle = 'rgba(200,180,140,0.45)'
      c.font = `${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'; c.textBaseline = 'top'
      c.fillText('碎片用于升星，多余碎片可分解为宠物经验', indent, cy)
      cy += 12 * S
      c.fillStyle = 'rgba(220,100,80,0.6)'
      c.fillText('分解不可逆，请谨慎操作', indent, cy)
    }
  } else {
    c.fillStyle = '#FFD700'
    c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    let fullStarStr = ''
    for (let i = 0; i < maxStar; i++) fullStarStr += '★'
    c.fillText(`满星 ${fullStarStr}`, indent, cy)
    cy += 20 * S
    c.fillStyle = 'rgba(200,180,140,0.6)'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(`剩余碎片：${poolPet.fragments}`, indent, cy)
    cy += 20 * S
    if (poolPet.fragments > 0) {
      const dBtnW = 130 * S, dBtnH = 30 * S
      _drawActionBtn(c, R, S, indent, cy, dBtnW, dBtnH, `分解1碎→${FRAGMENT_TO_EXP}经验`, true, '#B8A0E0')
      _rects.decomposeBtnRect = [indent, cy, dBtnW, dBtnH]
      cy += dBtnH + 6 * S
      c.fillStyle = 'rgba(200,180,140,0.45)'
      c.font = `${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'; c.textBaseline = 'top'
      c.fillText('已满星，碎片可分解为宠物经验', indent, cy)
      cy += 12 * S
      c.fillStyle = 'rgba(220,100,80,0.6)'
      c.fillText('分解不可逆，请谨慎操作', indent, cy)
    }
  }

  // 关闭按钮（右上角 X）
  const closeSize = 28 * S
  const closeX = px + pw - closeSize - 8*S
  const closeY = py + 8*S
  c.fillStyle = 'rgba(0,0,0,0.3)'
  c.beginPath(); c.arc(closeX + closeSize/2, closeY + closeSize/2, closeSize/2, 0, Math.PI*2); c.fill()
  c.strokeStyle = 'rgba(200,180,140,0.6)'; c.lineWidth = 1.5*S
  c.beginPath(); c.arc(closeX + closeSize/2, closeY + closeSize/2, closeSize/2, 0, Math.PI*2); c.stroke()
  c.strokeStyle = '#E8D5A8'; c.lineWidth = 2*S
  const cx0 = closeX + closeSize/2, cy0 = closeY + closeSize/2, cr = 7*S
  c.beginPath(); c.moveTo(cx0 - cr, cy0 - cr); c.lineTo(cx0 + cr, cy0 + cr); c.stroke()
  c.beginPath(); c.moveTo(cx0 + cr, cy0 - cr); c.lineTo(cx0 - cr, cy0 + cr); c.stroke()

  // 底部关闭提示
  c.fillStyle = 'rgba(200,180,140,0.3)'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击空白处关闭', W / 2, py + ph - 10 * S)
}

// 绘制操作按钮
function _drawActionBtn(c, R, S, x, y, w, h, text, enabled, color) {
  const r = 6 * S
  if (enabled) {
    const grad = c.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, color + '30')
    grad.addColorStop(1, color + '18')
    c.fillStyle = grad
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = color; c.lineWidth = 1.5*S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = color
  } else {
    c.fillStyle = 'rgba(80,80,80,0.12)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = 'rgba(120,120,120,0.4)'; c.lineWidth = 1*S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#999'
  }
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(text, x + w/2, y + h/2)
}

// ===== 触摸处理 =====
// 滚动相关
let _scrollTouchY = 0
let _scrolling = false

function tPetPool(g, x, y, type) {
  const { S } = V

  // 详情面板打开时优先处理
  if (g._petPoolDetail) {
    if (type === 'end') {
      // 升级
      if (_rects.levelUpBtnRect && g._hitRect(x, y, ..._rects.levelUpBtnRect)) {
        _doLevelUp(g)
        _longPressActive = false
        return
      }
      // 升星
      if (_rects.starUpBtnRect && g._hitRect(x, y, ..._rects.starUpBtnRect)) {
        _doStarUp(g)
        return
      }
      // 分解
      if (_rects.decomposeBtnRect && g._hitRect(x, y, ..._rects.decomposeBtnRect)) {
        _doDecompose(g)
        return
      }
      // 长按结束
      _cancelLongPress()
      // 点击面板外关闭
      g._petPoolDetail = null
      return
    }
    if (type === 'start') {
      // 长按升级检测
      if (_rects.levelUpBtnRect && g._hitRect(x, y, ..._rects.levelUpBtnRect)) {
        _longPressPetId = g._petPoolDetail
        _longPressTimer = setTimeout(() => {
          _longPressActive = true
          _longPressLoop(g)
        }, 400)
      }
    }
    if (type === 'move') {
      _cancelLongPress()
    }
    return
  }

  // 滚动处理
  if (type === 'start') {
    _scrollTouchY = y
    _scrolling = false
  }
  if (type === 'move') {
    const dy = _scrollTouchY - y
    if (Math.abs(dy) > 3 * S) _scrolling = true
    if (_scrolling) {
      g._petPoolScroll = Math.max(0, (g._petPoolScroll || 0) + dy)
      _scrollTouchY = y
      // 限制最大滚动（粗略估算）
      const pool = _getFilteredPool(g)
      const cols = 3
      const cardW = (V.W - 24 * S - 8 * S * 2) / cols
      const cardH = cardW * 1.35
      const totalRows = Math.ceil(pool.length / cols)
      const maxScroll = Math.max(0, totalRows * (cardH + 8 * S) - (V.H * 0.5))
      g._petPoolScroll = Math.min(g._petPoolScroll, maxScroll)
    }
    return
  }
  if (type === 'end') {
    if (_scrolling) { _scrolling = false; return }

    // 派遣入口
    if (_rects.idleBtnRect && g._hitRect(x, y, ..._rects.idleBtnRect)) {
      const { resetIdleView } = require('./idleView')
      resetIdleView()
      g._idleCollectResult = null
      g.setScene('idle')
      return
    }

    // 返回按钮
    if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
      g.setScene('title'); return
    }

    // 属性筛选
    for (const f of _rects.filterRects) {
      if (g._hitRect(x, y, ...f.rect)) {
        g._petPoolFilter = f.key
        g._petPoolScroll = 0
        return
      }
    }

    // 卡片点击 → 跳转宠物详情全屏页
    for (const card of _rects.cardRects) {
      if (g._hitRect(x, y, ...card.rect)) {
        g._petDetailId = card.petId
        g._petDetailUnowned = !!card.ghost
        g.setScene('petDetail')
        MusicMgr.playClick && MusicMgr.playClick()
        return
      }
    }

    // 底部导航
    const barRects = g._bottomBarRects || []
    for (let i = 0; i < barRects.length; i++) {
      if (!g._hitRect(x, y, ...barRects[i])) continue
      switch (i) {
        case 0: {
          const cv = require('./cultivationView')
          cv.resetScroll()
          g.setScene('cultivation')
          cv.checkRealmBreak(g)
          return
        }
        case 1: return // 已在灵宠池
        case 2: g._dexScrollY = 0; g.setScene('dex'); return
        case 3: g.setScene('title'); return
        case 4:
          if (!g.storage.userAuthorized && g.storage._userInfoBtn) return
          g._openRanking(); return
        case 5: g.setScene('stats'); return
        case 6: g.showMorePanel = true; g.setScene('title'); return
      }
    }
  }
}

function _doLevelUp(g) {
  const petId = g._petPoolDetail
  if (!petId) return
  const poolPet = g.storage.getPoolPet(petId)
  if (!poolPet) return
  const tier = getPetTier(petId)
  const needed = petExpToNextLevel(poolPet.level, tier)
  if ((g.storage.petExpPool || 0) < needed) return
  const ups = g.storage.investPetExp(petId, needed)
  if (ups > 0) {
    MusicMgr.playLevelUp && MusicMgr.playLevelUp()
  }
}

function _doStarUp(g) {
  const petId = g._petPoolDetail
  if (!petId) return
  const result = g.storage.upgradePoolPetStar(petId)
  if (result.ok) {
    MusicMgr.playStar3Unlock && MusicMgr.playStar3Unlock()
  }
}

function _doDecompose(g) {
  const petId = g._petPoolDetail
  if (!petId) return
  const gained = g.storage.decomposeFragments(petId, 1)
  if (gained > 0) {
    MusicMgr.playReward && MusicMgr.playReward()
  }
}

function _longPressLoop(g) {
  if (!_longPressActive || !_longPressPetId) return
  _doLevelUp(g)
  // 如果还能继续升，继续循环
  const poolPet = g.storage.getPoolPet(_longPressPetId)
  const maxLv = poolPet && poolPet.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
  if (poolPet && poolPet.level < maxLv) {
    const tier = getPetTier(_longPressPetId)
    const needed = petExpToNextLevel(poolPet.level, tier)
    if ((g.storage.petExpPool || 0) >= needed) {
      _longPressTimer = setTimeout(() => _longPressLoop(g), 120)
      return
    }
  }
  _longPressActive = false
}

function _cancelLongPress() {
  if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null }
  _longPressActive = false
  _longPressPetId = null
}

module.exports = { rPetPool, tPetPool }
