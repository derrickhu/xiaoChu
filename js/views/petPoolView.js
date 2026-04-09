/**
 * 灵宠池界面 — 卡片网格 + 属性筛选（详情见 petDetail 全屏页）
 * 渲染入口：rPetPool  触摸入口：tPetPool
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById, getPetRarity, getPetAvatarPath } = require('../data/pets')
const { getPoolPetAtk, canLevelUp, canStarUp } = require('../data/petPoolConfig')
const { RARITY_VISUAL, STAR_VISUAL } = require('../data/economyConfig')
const { drawBottomBar, getLayout: getTitleLayout, drawPageTitle } = require('./bottomBar')
const MusicMgr = require('../runtime/music')
const P = require('../platform')
const { getFilteredPool: _getFilteredPoolUtil } = require('./uiUtils')

// 属性筛选标签
const ATTR_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'metal', label: '金' },
  { key: 'wood', label: '木' },
  { key: 'water', label: '水' },
  { key: 'fire', label: '火' },
  { key: 'earth', label: '土' },
]

const RARITY_FILTERS = [
  { key: 'all', label: '全部品质' },
  { key: 'R', label: 'R' },
  { key: 'SR', label: 'SR' },
  { key: 'SSR', label: 'SSR' },
]

// 模块内触摸区域（不污染 g）
const _rects = {
  filterRects: [],        // 属性筛选 [{ key, rect: [x,y,w,h] }]
  rarityFilterRects: [],  // 品质筛选 [{ key, rect: [x,y,w,h] }]
  cardRects: [],          // [{ petId, rect: [x,y,w,h] }]
  backBtnRect: null,      // [x,y,w,h]
  idleBtnRect: null,      // [x,y,w,h]
}

const _getFilteredPool = _getFilteredPoolUtil

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
  // 内容区略下移，避免属性筛选条与「灵宠池」标题装饰底边重叠
  const contentTop = topY + 42 * S
  // 底栏云纹图向上凸出（与 bottomBar.js drawBottomBar 中 overlapH 一致），否则派遣按钮会被云挡住
  const navCloudReserve = 26 * S
  const contentBottom = L.bottomBarY - 4 * S - navCloudReserve
  _rects.backBtnRect = null

  // === 顶栏 ===
  c.save()
  // 去掉顶栏深色背景遮罩

  drawPageTitle(c, R, W, S, W * 0.5, topY + 24 * S, '灵宠池')

  // 灵石图标和余额（左上角显示）
  const expPool = g.storage.soulStone || 0
  const expIcon = R.getImg('assets/ui/icon_soul_stone.png')
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
  const filterY = contentTop + 10 * S
  const filterH = 26 * S
  const filterW = (W - 24 * S) / ATTR_FILTERS.length
  _rects.filterRects = []
  _rects.rarityFilterRects = []
  c.save()
  for (let i = 0; i < ATTR_FILTERS.length; i++) {
    const f = ATTR_FILTERS[i]
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

  const rarityY = filterY + filterH + 6 * S
  const rarityGap = 6 * S
  const rarityW = (W - 24 * S - rarityGap * (RARITY_FILTERS.length - 1)) / RARITY_FILTERS.length
  for (let i = 0; i < RARITY_FILTERS.length; i++) {
    const f = RARITY_FILTERS[i]
    const fx = 12 * S + i * (rarityW + rarityGap)
    const isActive = (g._petPoolRarityFilter || 'all') === f.key
    c.fillStyle = isActive ? 'rgba(235,190,90,0.45)' : 'rgba(235,190,90,0.15)'
    R.rr(fx, rarityY, rarityW, filterH, 6 * S); c.fill()
    if (isActive) {
      c.strokeStyle = 'rgba(255,215,120,0.85)'; c.lineWidth = 2 * S
      R.rr(fx, rarityY, rarityW, filterH, 6 * S); c.stroke()
    }
    c.fillStyle = isActive ? '#fff8e0' : 'rgba(255,245,220,0.82)'
    c.font = `bold ${(f.key === 'all' ? 9.5 : 11) * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.35)'
    c.lineWidth = 2.2 * S
    c.strokeText(f.label, fx + rarityW / 2, rarityY + filterH / 2)
    c.fillText(f.label, fx + rarityW / 2, rarityY + filterH / 2)
    _rects.rarityFilterRects.push({ key: f.key, rect: [fx, rarityY, rarityW, filterH] })
  }
  c.restore()

  // 派遣按钮 rect 占位（实际绘制在卡片网格下方）
  _rects.idleBtnRect = null

  // === 卡片网格 ===
  const gridTop = filterY + filterH + 6 * S + filterH + 8 * S
  const gridBottom = contentBottom - 78 * S
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

    _drawPetCard(c, R, S, W, cx, cy, cardW, cardH, pet, g)
    const clippedH = Math.min(cardH, gridBottom - cy)
    _rects.cardRects.push({ petId: pet.id, rect: [cx, cy, cardW, clippedH] })
  }

  // 幽灵卡片：碎片银行中有碎片的未拥有宠物（半透明）
  const bank = g.storage.fragmentBank || {}
  const ownedIds = new Set(pool.map(p => p.id))
  const filter = g._petPoolFilter || 'all'
  const rarityFilter = g._petPoolRarityFilter || 'all'
  const ghostPets = Object.keys(bank)
    .filter(id => !ownedIds.has(id) && bank[id] > 0)
    .filter(id => {
      const bp = getPetById(id)
      if (!bp) return false
      if (filter !== 'all' && bp.attr !== filter) return false
      if (rarityFilter !== 'all' && getPetRarity(id) !== rarityFilter) return false
      return true
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
    const clippedGH = Math.min(cardH, gridBottom - cy)
    _rects.cardRects.push({ petId: ghostPets[gi], rect: [cx, cy, cardW, clippedGH], ghost: true })
  }
  c.restore()

  // === 派遣大按钮（卡片区下方，底栏上方） ===
  const hasIdleReward = g.storage.idleHasReward()
  const idleBtnW = W - 48 * S
  const idleBtnH = 42 * S
  const idleBtnX = (W - idleBtnW) / 2
  const idleBtnY = contentBottom - idleBtnH - 8 * S
  _rects.idleBtnRect = [idleBtnX, idleBtnY, idleBtnW, idleBtnH]
  if (!g._namedRects) g._namedRects = {}
  g._namedRects['idle_btn'] = { x: idleBtnX, y: idleBtnY, w: idleBtnW, h: idleBtnH }

  c.save()
  // 渐变背景
  const ibGrd = c.createLinearGradient(idleBtnX, idleBtnY, idleBtnX + idleBtnW, idleBtnY)
  if (hasIdleReward) {
    ibGrd.addColorStop(0, 'rgba(255,160,40,0.95)')
    ibGrd.addColorStop(0.5, 'rgba(255,200,60,1)')
    ibGrd.addColorStop(1, 'rgba(255,160,40,0.95)')
  } else {
    ibGrd.addColorStop(0, 'rgba(100,70,170,0.85)')
    ibGrd.addColorStop(0.5, 'rgba(130,90,210,0.9)')
    ibGrd.addColorStop(1, 'rgba(100,70,170,0.85)')
  }
  c.fillStyle = ibGrd
  R.rr(idleBtnX, idleBtnY, idleBtnW, idleBtnH, idleBtnH / 2); c.fill()
  // 边框
  c.strokeStyle = hasIdleReward ? 'rgba(255,220,80,0.9)' : 'rgba(180,160,240,0.6)'
  c.lineWidth = 2 * S
  R.rr(idleBtnX, idleBtnY, idleBtnW, idleBtnH, idleBtnH / 2); c.stroke()
  // 文字
  c.fillStyle = hasIdleReward ? '#5a2d0c' : '#fff'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  var idleBtnLabel = hasIdleReward ? '🎁 派遣修行（有奖励可领！）' : '✨ 派遣灵宠自动修行'
  c.fillText(idleBtnLabel, idleBtnX + idleBtnW / 2, idleBtnY + idleBtnH / 2)
  // 呼吸脉冲边框（引导阶段更醒目）
  if (hasIdleReward) {
    var ibPulse = 0.3 + 0.3 * Math.sin((g.af || 0) * 0.08)
    c.globalAlpha = ibPulse
    c.strokeStyle = '#fff'
    c.lineWidth = 3 * S
    R.rr(idleBtnX - 2 * S, idleBtnY - 2 * S, idleBtnW + 4 * S, idleBtnH + 4 * S, (idleBtnH + 4 * S) / 2); c.stroke()
  }
  c.restore()

  // 收集提示（在派遣按钮上方，带背景条保证可读性）
  const poolCount = g.storage.petPoolCount
  if (poolCount < 5) {
    c.save()
    var tipY = idleBtnY - 22 * S
    var tipH = 18 * S
    c.fillStyle = 'rgba(0,0,0,0.35)'
    R.rr(24 * S, tipY, W - 48 * S, tipH, tipH / 2); c.fill()
    c.fillStyle = '#ffe080'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`灵兽秘境解锁条件：灵宠池≥5只（当前 ${poolCount} 只）`, W / 2, tipY + tipH / 2)
    c.restore()
  }

  // 底部导航（复用首页）
  drawBottomBar(g)
}

// ===== 宠物卡片 =====
function _drawPetCard(c, R, S, W, x, y, w, h, poolPet, g) {
  const basePet = getPetById(poolPet.id)
  if (!basePet) return
  const rarity = getPetRarity(poolPet.id)
  const rv = RARITY_VISUAL[rarity] || RARITY_VISUAL.R
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

  // 品质渐变背景叠加
  const rarityGrad = c.createLinearGradient(x, y, x, y + h)
  rarityGrad.addColorStop(0, rv.bgGradient[0] + 'cc')
  rarityGrad.addColorStop(1, rv.bgGradient[1] + '88')
  c.fillStyle = rarityGrad
  R.rr(x, y, w, h, 8 * S); c.fill()

  // SSR 金色发光效果
  if (rarity === 'SSR' && rv.hasParticles) {
    c.save()
    c.shadowColor = rv.glowColor
    c.shadowBlur = 12 * S
    c.strokeStyle = rv.borderColor
    c.lineWidth = 2.5 * S
    R.rr(x, y, w, h, 8 * S); c.stroke()
    c.restore()
  }

  // 品质色边框
  c.strokeStyle = rv.borderColor
  c.lineWidth = 2 * S
  R.rr(x, y, w, h, 8 * S); c.stroke()

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
  R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 6 * S })

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

  // 星级（根据 STAR_VISUAL 着色，★4 光环，★5 彩虹）
  const starY = nameY + 14 * S
  const curStar = poolPet.star || 1
  const sv = STAR_VISUAL[curStar] || STAR_VISUAL[1]
  const displayMax = 5
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  let starStr = ''
  for (let i = 0; i < displayMax; i++) starStr += '★'
  const totalStarW = c.measureText(starStr).width
  let starX = x + w / 2 - totalStarW / 2
  c.textAlign = 'left'
  c.save()
  if (curStar >= 5) {
    // ★5 彩虹光效
    const hue = (Date.now() * 0.1) % 360
    c.shadowColor = `hsl(${hue}, 100%, 60%)`
    c.shadowBlur = 6 * S
  } else if (curStar >= 4) {
    // ★4 紫色微弱光环
    c.shadowColor = '#b44dff'
    c.shadowBlur = 4 * S
  }
  for (let i = 0; i < displayMax; i++) {
    c.fillStyle = i < curStar ? sv.color : 'rgba(120,120,120,0.6)'
    c.fillText('★', starX, starY)
    starX += c.measureText('★').width
  }
  c.restore()
  c.textAlign = 'center'

  // 等级 + ATK（加深色描边）
  const infoY = starY + 14 * S
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.7)'
  c.lineWidth = 2.5 * S
  c.strokeText(`Lv.${poolPet.level}  ATK:${atk}`, x + w / 2, infoY)
  c.fillStyle = '#fff'
  c.fillText(`Lv.${poolPet.level}  ATK:${atk}`, x + w / 2, infoY)

  // 品质徽标（左上角）
  const badgeText = rv.label
  c.save()
  c.font = `bold ${10 * S}px sans-serif`
  const tw = c.measureText(badgeText).width
  const bw = tw + 6 * S, bh = 14 * S
  c.fillStyle = rv.badgeBg
  R.rr(x + 2 * S, y + 2 * S, bw, bh, 3 * S); c.fill()
  c.fillStyle = rv.badgeColor
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(badgeText, x + 5 * S, y + 4 * S)
  c.restore()

  // 可升级/可升星红点（右上角）
  if (g) {
    const ss = g.storage.soulStone || 0
    const aw = g.storage.awakenStone || 0
    if (canLevelUp(poolPet, ss) || canStarUp(poolPet, aw)) {
      const dotR = 5 * S
      const dotX = x + w - 6 * S
      const dotY = y + 6 * S
      c.save()
      c.beginPath()
      c.arc(dotX, dotY, dotR, 0, Math.PI * 2)
      c.fillStyle = '#ff4444'; c.fill()
      c.strokeStyle = '#fff'; c.lineWidth = 1.5 * S; c.stroke()
      c.restore()
    }
  }

  c.restore()
}

// ===== 幽灵卡片（未入池但有碎片的宠物） =====
function _drawGhostCard(c, R, S, W, x, y, w, h, petId, fragCount) {
  const basePet = getPetById(petId)
  if (!basePet) return
  const rarity = getPetRarity(petId)
  const rv = RARITY_VISUAL[rarity] || RARITY_VISUAL.R
  const attrColor = ATTR_COLOR[basePet.attr]
  const { SUMMON_FRAG_COST } = require('../data/chestConfig')
  const cost = SUMMON_FRAG_COST[rarity] || 15

  c.save()
  c.globalAlpha = 0.5

  const cardBg = R.getImg('assets/ui/pet_card_bg.png')
  if (cardBg && cardBg.width > 0) {
    c.drawImage(cardBg, x, y, w, h)
  } else {
    c.fillStyle = 'rgba(30,20,10,0.75)'
    R.rr(x, y, w, h, 8 * S); c.fill()
  }

  // 品质渐变背景叠加
  const gRarityGrad = c.createLinearGradient(x, y, x, y + h)
  gRarityGrad.addColorStop(0, rv.bgGradient[0] + 'cc')
  gRarityGrad.addColorStop(1, rv.bgGradient[1] + '88')
  c.fillStyle = gRarityGrad
  R.rr(x, y, w, h, 8 * S); c.fill()

  // 品质色边框
  c.strokeStyle = rv.borderColor
  c.lineWidth = 2 * S
  R.rr(x, y, w, h, 8 * S); c.stroke()

  // 头像
  const avatarSize = w * 0.62
  const avatarX = x + (w - avatarSize) / 2
  const avatarY = y + 8 * S
  const avatarPath = getPetAvatarPath({ ...basePet, star: 1 })
  R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 6 * S })

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

  // 品质徽标（左上角，全不透明）
  c.globalAlpha = 1
  const gBadgeText = rv.label
  c.save()
  c.font = `bold ${10 * S}px sans-serif`
  const gTw = c.measureText(gBadgeText).width
  const gBw = gTw + 6 * S, gBh = 14 * S
  c.fillStyle = rv.badgeBg
  R.rr(x + 2 * S, y + 2 * S, gBw, gBh, 3 * S); c.fill()
  c.fillStyle = rv.badgeColor
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(gBadgeText, x + 5 * S, y + 4 * S)
  c.restore()

  c.restore()
}


// ===== 触摸处理 =====
// 滚动相关
let _scrollTouchY = 0
let _scrolling = false

function tPetPool(g, x, y, type) {
  const { S } = V

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

    const { BAR_ITEMS, getLayout: getBarLayout } = require('./bottomBar')
    const Lbar = getBarLayout()
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
        if (item.key === 'pets') return
        if (item.key === 'dex') { g._dexScrollY = 0; g.setScene('dex'); return }
        if (item.key === 'stage') { g.setScene('title'); return }
        if (item.key === 'weapons') {
          g._weaponPoolFilter = 'all'; g._weaponPoolScroll = 0; g._weaponPoolDetail = null
          g.setScene('weaponPool'); return
        }
        if (item.key === 'rank') { g._openRanking(); return }
        if (item.key === 'more') { g.showMorePanel = true; g.setScene('title'); return }
      }
      return
    }

    // 属性筛选
    for (const f of _rects.filterRects) {
      if (g._hitRect(x, y, ...f.rect)) {
        g._petPoolFilter = f.key
        g._petPoolScroll = 0
        return
      }
    }

    for (const f of _rects.rarityFilterRects) {
      if (g._hitRect(x, y, ...f.rect)) {
        g._petPoolRarityFilter = f.key
        g._petPoolScroll = 0
        return
      }
    }

    // 卡片点击 → 跳转宠物详情全屏页
    for (const card of _rects.cardRects) {
      if (g._hitRect(x, y, ...card.rect)) {
        g._petDetailId = card.petId
        g._petDetailUnowned = !!card.ghost
        g._petDetailReturnScene = null
        g.setScene('petDetail')
        MusicMgr.playClick && MusicMgr.playClick()
        return
      }
    }
  }
}

module.exports = { rPetPool, tPetPool }
