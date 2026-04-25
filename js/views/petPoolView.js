/**
 * 灵宠池界面 — 卡片网格 + 属性筛选（详情见 petDetail 全屏页）
 * 渲染入口：rPetPool  触摸入口：tPetPool
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { getPetById, getPetRarity, getPetAvatarPath } = require('../data/pets')
const { getPoolPetAtk, computePetPoolBadge } = require('../data/petPoolConfig')
const { RARITY_VISUAL, STAR_VISUAL } = require('../data/economyConfig')
const { rarityVisualForAttr } = require('../data/rewardVisual')
const { ROLE, getPetRole } = require('../data/petRoleConfig')
const { drawBottomBar, getLayout: getTitleLayout, drawPageTitle } = require('./bottomBar')
const MusicMgr = require('../runtime/music')
const P = require('../platform')
const { getFilteredPool: _getFilteredPoolUtil, drawFavStar } = require('./uiUtils')
const guideMgr = require('../engine/guideManager')

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

const ROLE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: ROLE.ATTACK, label: '攻击' },
  { key: ROLE.BURST, label: '爆发' },
  { key: ROLE.HEAL, label: '恢复' },
  { key: ROLE.SHIELD, label: '护盾' },
  { key: ROLE.CONVERT, label: '转珠' },
  { key: ROLE.CONTROL, label: '控制' },
  { key: ROLE.SUPPORT, label: '辅助' },
]

const PET_POOL_SCROLL_ART = {
  bg: 'assets/backgrounds/petpool_ink_bg.jpg',
  card: 'assets/ui/pet_card_scroll_bg.png',
  filter: 'assets/ui/pet_filter_scroll_bg.png',
  idleBtn: 'assets/ui/btn_pet_idle_scroll.png',
}

// 模块内触摸区域（不污染 g）
const _rects = {
  filterRects: [],        // 属性筛选 [{ key, rect: [x,y,w,h] }]
  rarityFilterRects: [],  // 品质筛选 [{ key, rect: [x,y,w,h] }]
  roleFilterRects: [],    // 定位筛选 [{ key, rect: [x,y,w,h] }]
  favToggleRect: null,    // 「仅看收藏」toggle [x,y,w,h]
  chipRects: [],          // 摘要 chip [{ key:'star'|'new'|'level', rect }]
  cardRects: [],          // [{ petId, rect: [x,y,w,h] }]
  backBtnRect: null,      // [x,y,w,h]
  idleBtnRect: null,      // [x,y,w,h]
}

// ===== 摘要 chip 的视觉规格（分层优先级一一对应卡片角标）=====
// 业界主流：卡面角标只分两档，卡面负责吸引注意、详情页负责解释。
// 其余「为什么可推进」的细节全部留到详情页用资源条/按钮态表达，避免语义教学成本。
// · chipLabel：chip 条上（底部聚合条 + 卡片角标用不同长度，角标要短到能放进卡右上）
// · cardLabel：卡片右上角的文字；业界主流「AFK / 原神 / 明日方舟」都用 2-3 字中文提示可操作
// 可升星文字颜色与星星一致（STAR_VISUAL[2/3].color = '#ffd700'），视觉风格统一
const CHIP_STYLES = {
  star: { chipLabel: '可升星', cardLabel: '可升星', bg: 'rgba(176,58,32,0.92)', border: 'rgba(255,218,132,0.92)', fg: '#fff3cf', textColor: '#ffd86a', desc: '升星可推进' },
  new:  { chipLabel: 'NEW',     cardLabel: 'NEW',    bg: 'rgba(230,48,48,0.94)', border: 'rgba(255,205,205,0.95)', fg: '#ffffff', textColor: '#ffffff', desc: '新入池未查看' },
}

const _getFilteredPool = _getFilteredPoolUtil

function _drawInkText(c, text, x, y, opt) {
  const o = opt || {}
  c.save()
  c.textAlign = o.align || 'center'
  c.textBaseline = o.baseline || 'middle'
  c.font = o.font || 'bold 14px "PingFang SC",serif'
  if (o.stroke) {
    c.strokeStyle = o.stroke
    c.lineWidth = o.lineWidth || 2
    c.strokeText(text, x, y)
  }
  c.fillStyle = o.fill || '#3b2617'
  c.fillText(text, x, y)
  c.restore()
}

function _drawResourcePlaque(c, R, S, x, cy, iconPath, text, dim) {
  const icon = R.getImg(iconPath)
  const iconSz = 28 * S
  c.save()
  if (dim) c.globalAlpha = 0.55
  c.font = `bold ${13 * S}px "PingFang SC",serif`
  const txtW = c.measureText(`${text}`).width
  const w = iconSz + txtW + 18 * S
  const h = 27 * S
  const y = cy - h / 2
  const grad = c.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, 'rgba(34,75,64,0.82)')
  grad.addColorStop(0.55, 'rgba(71,118,92,0.76)')
  grad.addColorStop(1, 'rgba(37,70,58,0.82)')
  c.fillStyle = grad
  R.rr(x, y, w, h, 10 * S); c.fill()
  c.strokeStyle = 'rgba(231,199,116,0.68)'
  c.lineWidth = 1.2 * S
  R.rr(x, y, w, h, 10 * S); c.stroke()
  if (icon && icon.width > 0) c.drawImage(icon, x - 3 * S, cy - iconSz / 2, iconSz, iconSz)
  _drawInkText(c, `${text}`, x + iconSz + txtW / 2 + 6 * S, cy + 0.5 * S, {
    font: `bold ${13 * S}px "PingFang SC",serif`,
    fill: '#fff1cc',
    stroke: 'rgba(18,28,22,0.78)',
    lineWidth: 2 * S,
  })
  c.restore()
  return w
}

// ===== 统计池内两档角标数量（基于"过滤后"的池，避免跨 Tab 时数量对不上）=====
function _countBadges(g, pool) {
  const ss = g.storage.soulStone || 0
  const aw = g.storage.awakenStone || 0
  const uf = g.storage.universalFragment || 0
  let star = 0, fresh = 0
  for (const p of pool) {
    const isNew = g.storage.isPetNewInPool ? g.storage.isPetNewInPool(p.id) : false
    const b = computePetPoolBadge(p, ss, aw, isNew, uf)
    if (b === 'star') star++
    else if (b === 'new') fresh++
  }
  return { star, new: fresh }
}

// ===== 摘要 chip 条：聚合可升星 / 新入池 / 卡等级 三档 =====
function _drawSummaryChips(c, R, S, W, chipY, chipH, g) {
  _rects.chipRects = []
  const pool = _getFilteredPool(g)
  const counts = _countBadges(g, pool)

  // 组装待显示 chip；全 0 时显示"状态整齐"提示条，给玩家正反馈
  const chips = []
  if (counts.star > 0) chips.push({ key: 'star', count: counts.star })
  if (counts.new > 0) chips.push({ key: 'new', count: counts.new })

  c.save()
  if (chips.length === 0) {
    c.fillStyle = 'rgba(222,205,164,0.22)'
    R.rr(12 * S, chipY, W - 24 * S, chipH, chipH / 2); c.fill()
    _drawInkText(c, '灵宠状态整齐，暂无紧急操作', W / 2, chipY + chipH / 2, {
      font: `${10.5 * S}px "PingFang SC",serif`,
      fill: 'rgba(255,245,210,0.78)',
      stroke: 'rgba(32,22,12,0.52)',
      lineWidth: 1.8 * S,
    })
    c.restore()
    return
  }

  // 先量所有 chip 宽度并居中
  c.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
  const padX = 10 * S
  const gap = 8 * S
  const widths = chips.map(ch => {
    const st = CHIP_STYLES[ch.key]
    const text = `${st.chipLabel} ${ch.count}`
    return c.measureText(text).width + padX * 2
  })
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1)
  let cx = (W - totalW) / 2

  c.textAlign = 'center'; c.textBaseline = 'middle'
  for (let i = 0; i < chips.length; i++) {
    const ch = chips[i]
    const st = CHIP_STYLES[ch.key]
    const bw = widths[i]
    const bx = cx
    const by = chipY
    // 最高优先级（star）呼吸发光，引导视线
    if (ch.key === 'star') {
      const pulse = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin((g.af || 0) * 0.1))
      c.save()
      c.globalAlpha = pulse
      c.fillStyle = st.bg
      R.rr(bx - 3 * S, by - 3 * S, bw + 6 * S, chipH + 6 * S, (chipH + 6 * S) / 2); c.fill()
      c.restore()
    }
    c.fillStyle = st.bg
    R.rr(bx, by, bw, chipH, chipH / 2); c.fill()
    c.strokeStyle = st.border; c.lineWidth = 1.2 * S
    R.rr(bx, by, bw, chipH, chipH / 2); c.stroke()
    c.fillStyle = st.fg
    c.fillText(`${st.chipLabel} ${ch.count}`, bx + bw / 2, by + chipH / 2 + 0.5 * S)
    _rects.chipRects.push({ key: ch.key, rect: [bx, by, bw, chipH] })
    cx += bw + gap
  }
  c.restore()
}

// ===== 卡片右上角语义角标（star / new，只画最高优先级一个） =====
//   · star：金色"可升星"纯文字 + 透明描边底 + 文字本体 alpha 呼吸闪烁（与星星同金）
//   · new ：红色胶囊（醒目提示"新"）
//   · 业界参考：AFK 的"可突破"提示就是卡角金字闪烁，不再在卡面加描边/扫光，避免视觉噪声
function _drawCardBadge(c, R, S, x, y, w, badgeKey) {
  if (!badgeKey) return
  const st = CHIP_STYLES[badgeKey]
  if (!st) return
  c.save()
  c.font = `bold ${10 * S}px "PingFang SC",sans-serif`
  const text = st.cardLabel
  const tw = c.measureText(text).width
  const padX = 5 * S
  const bw = tw + padX * 2
  const bh = 14 * S
  const bx = x + w - bw - 3 * S
  const by = y + 3 * S

  if (badgeKey === 'star') {
    // 半透明深色底衬托，保证在任意宠物插画上金字都能看清
    c.fillStyle = 'rgba(0,0,0,0.42)'
    R.rr(bx, by, bw, bh, bh / 2); c.fill()
    // 文字层：金色 + alpha 呼吸（0.55 ↔ 1.0）
    const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(Date.now() * 0.006))
    c.globalAlpha = pulse
    c.fillStyle = st.textColor
    c.strokeStyle = 'rgba(0,0,0,0.85)'
    c.lineWidth = 2.2 * S
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeText(text, bx + bw / 2, by + bh / 2 + 0.5 * S)
    c.fillText(text, bx + bw / 2, by + bh / 2 + 0.5 * S)
  } else {
    // new：保持红色胶囊强提示
    c.fillStyle = st.bg
    R.rr(bx, by, bw, bh, bh / 2); c.fill()
    c.strokeStyle = st.border; c.lineWidth = 1 * S
    R.rr(bx, by, bw, bh, bh / 2); c.stroke()
    c.fillStyle = st.fg
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(text, bx + bw / 2, by + bh / 2 + 0.5 * S)
  }
  c.restore()
}

function _drawRolePill(c, R, S, x, y, w, h, roleMeta) {
  if (!roleMeta) return
  const text = roleMeta.short || roleMeta.label || '定位'
  c.save()
  c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
  const padX = 5 * S
  const tw = c.measureText(text).width
  const pillW = Math.min(w - 10 * S, tw + padX * 2)
  const pillH = 14 * S
  const pillX = x + (w - pillW) / 2
  const pillY = y + h - 21 * S
  const grad = c.createLinearGradient(pillX, pillY, pillX + pillW, pillY + pillH)
  grad.addColorStop(0, 'rgba(40,88,70,0.78)')
  grad.addColorStop(0.5, 'rgba(86,134,98,0.72)')
  grad.addColorStop(1, 'rgba(112,48,34,0.72)')
  c.fillStyle = grad
  R.rr(pillX, pillY, pillW, pillH, pillH / 2); c.fill()
  c.strokeStyle = 'rgba(246,218,142,0.72)'
  c.lineWidth = 0.9 * S
  R.rr(pillX, pillY, pillW, pillH, pillH / 2); c.stroke()
  c.fillStyle = '#fff2cf'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.strokeStyle = 'rgba(45,24,12,0.65)'
  c.lineWidth = 1.5 * S
  c.strokeText(text, pillX + pillW / 2, pillY + pillH / 2 + 0.4 * S)
  c.fillText(text, pillX + pillW / 2, pillY + pillH / 2 + 0.4 * S)
  c.restore()
}

// ===== 点击 chip 后，循环定位到"下一只该状态的宠物"并短暂高亮 =====
function _focusNextBadgePet(g, badgeKey) {
  const pool = _getFilteredPool(g)
  const ss = g.storage.soulStone || 0
  const aw = g.storage.awakenStone || 0
  const uf = g.storage.universalFragment || 0
  const indices = []
  for (let i = 0; i < pool.length; i++) {
    const isNew = g.storage.isPetNewInPool ? g.storage.isPetNewInPool(pool[i].id) : false
    if (computePetPoolBadge(pool[i], ss, aw, isNew, uf) === badgeKey) indices.push(i)
  }
  if (indices.length === 0) return
  if (!g._petPoolChipCursor) g._petPoolChipCursor = {}
  const cur = g._petPoolChipCursor[badgeKey] || 0
  const targetPoolIdx = indices[cur % indices.length]
  g._petPoolChipCursor[badgeKey] = (cur + 1) % indices.length

  const cols = 3
  const cardGap = 8 * V.S
  const cardW = (V.W - 24 * V.S - cardGap * (cols - 1)) / cols
  const cardH = cardW * 1.35
  const row = Math.floor(targetPoolIdx / cols)
  g._petPoolScroll = Math.max(0, row * (cardH + cardGap))
  g._petPoolHighlight = { petId: pool[targetPoolIdx].id, until: Date.now() + 1600 }
}

// 小灵「角标系统」首次引导：首次进池、没在指引中、池里有 ⭐ 或 NEW 时触发一次。
// 条件里要求"看得到"角标（任一档 count>0），否则玩家还感知不到这套视觉，小灵讲了也白讲。
function _tryTriggerBadgeIntro(g) {
  if (guideMgr.isActive()) return
  if (!guideMgr.shouldShow(g, 'pet_pool_badge_intro')) return
  const pool = g.storage.petPool || []
  if (pool.length === 0) return
  const counts = _countBadges(g, pool)
  if (counts.star <= 0 && counts.new <= 0) return
  guideMgr.trigger(g, 'pet_pool_badge_intro')
}

// ===== 主渲染 =====
function rPetPool(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  _tryTriggerBadgeIntro(g)

  // 背景：灵宠池使用水墨卷轴专属背景，保持其它共用页面不受影响
  const poolBg = R.getImg(PET_POOL_SCROLL_ART.bg)
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

  // 顶部资源改成玉牌式，弱化现代黑胶囊感
  const expPool = g.storage.soulStone || 0
  const uniCount = g.storage.universalFragment || 0
  const resY = topY + 17 * S
  const firstW = _drawResourcePlaque(c, R, S, 9 * S, resY, 'assets/ui/icon_soul_stone.png', expPool, false)
  _drawResourcePlaque(c, R, S, 9 * S + firstW + 8 * S, resY, 'assets/ui/icon_universal_frag.png', uniCount, uniCount === 0)

  c.restore()

  // === 属性筛选 ===
  const filterY = contentTop + 10 * S
  const filterH = 26 * S
  const filterW = (W - 24 * S) / ATTR_FILTERS.length
  _rects.filterRects = []
  _rects.rarityFilterRects = []
  _rects.roleFilterRects = []
  c.save()
  const filterBg = R.getImg(PET_POOL_SCROLL_ART.filter)
  const filterBgX = 6 * S
  const filterBgY = filterY - 12 * S
  const filterBgW = W - 12 * S
  const roleH = 22 * S
  const filterBgH = filterH * 2 + roleH + 42 * S
  if (filterBg && filterBg.width > 0) {
    c.drawImage(filterBg, filterBgX, filterBgY, filterBgW, filterBgH)
  } else {
    c.fillStyle = 'rgba(222,205,164,0.28)'
    R.rr(filterBgX, filterBgY, filterBgW, filterBgH, 18 * S); c.fill()
  }
  for (let i = 0; i < ATTR_FILTERS.length; i++) {
    const f = ATTR_FILTERS[i]
    const fx = 12 * S + i * filterW
    const isActive = (g._petPoolFilter || 'all') === f.key
    // 属性签采用宣纸 + 青绿灵气选中态
    c.fillStyle = isActive ? 'rgba(74,145,122,0.62)' : 'rgba(236,219,178,0.34)'
    R.rr(fx, filterY, filterW - 4 * S, filterH, 6 * S); c.fill()
    if (isActive) {
      c.strokeStyle = 'rgba(212,190,118,0.9)'; c.lineWidth = 1.6 * S
      R.rr(fx, filterY, filterW - 4 * S, filterH, 6 * S); c.stroke()
    }
    c.fillStyle = isActive ? '#fff6d6' : 'rgba(70,42,22,0.92)'
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = isActive ? 'rgba(22,35,29,0.58)' : 'rgba(255,245,210,0.42)'
    c.lineWidth = isActive ? 2.2 * S : 1.2 * S
    c.strokeText(f.label, fx + (filterW - 4 * S) / 2, filterY + filterH / 2)
    c.fillText(f.label, fx + (filterW - 4 * S) / 2, filterY + filterH / 2)
    _rects.filterRects.push({ key: f.key, rect: [fx, filterY, filterW - 4 * S, filterH] })
  }

  const rarityY = filterY + filterH + 6 * S
  const rarityGap = 6 * S
  // 行右侧预留圆形「仅看收藏」toggle，并向内收一点避开卷轴木轴
  const favToggleSize = filterH * 0.92
  const favToggleGap = 8 * S
  const favToggleX = W - 32 * S - favToggleSize
  const rarityRowWidth = favToggleX - 12 * S - favToggleGap
  const rarityW = (rarityRowWidth - rarityGap * (RARITY_FILTERS.length - 1)) / RARITY_FILTERS.length
  for (let i = 0; i < RARITY_FILTERS.length; i++) {
    const f = RARITY_FILTERS[i]
    const fx = 12 * S + i * (rarityW + rarityGap)
    const isActive = (g._petPoolRarityFilter || 'all') === f.key
    c.fillStyle = isActive ? 'rgba(162,64,38,0.64)' : 'rgba(236,219,178,0.30)'
    R.rr(fx, rarityY, rarityW, filterH, 6 * S); c.fill()
    if (isActive) {
      c.strokeStyle = 'rgba(247,207,112,0.88)'; c.lineWidth = 1.6 * S
      R.rr(fx, rarityY, rarityW, filterH, 6 * S); c.stroke()
    }
    c.fillStyle = isActive ? '#fff4d2' : 'rgba(70,42,22,0.88)'
    c.font = `bold ${(f.key === 'all' ? 9.5 : 11) * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = isActive ? 'rgba(56,20,12,0.56)' : 'rgba(255,245,210,0.35)'
    c.lineWidth = isActive ? 2 * S : 1.1 * S
    c.strokeText(f.label, fx + rarityW / 2, rarityY + filterH / 2)
    c.fillText(f.label, fx + rarityW / 2, rarityY + filterH / 2)
    _rects.rarityFilterRects.push({ key: f.key, rect: [fx, rarityY, rarityW, filterH] })
  }

  // 「⭐ 仅看收藏」toggle：圆形按钮，激活态金色描边 + 内金星，未激活态灰色底 + 描边星
  const favToggleY = rarityY + (filterH - favToggleSize) / 2
  const favOnly = !!g._petPoolFavOnly
  c.fillStyle = favOnly ? 'rgba(162,64,38,0.64)' : 'rgba(236,219,178,0.28)'
  R.rr(favToggleX, favToggleY, favToggleSize, favToggleSize, favToggleSize / 2); c.fill()
  c.strokeStyle = favOnly ? 'rgba(247,207,112,0.95)' : 'rgba(130,92,45,0.38)'
  c.lineWidth = favOnly ? 2 * S : 1 * S
  R.rr(favToggleX, favToggleY, favToggleSize, favToggleSize, favToggleSize / 2); c.stroke()
  drawFavStar(c, favToggleX + favToggleSize / 2, favToggleY + favToggleSize / 2 + 0.3 * S, favToggleSize * 0.55, {
    alpha: favOnly ? 1 : 0.55,
    shadow: favOnly ? { blur: 3 * S, offsetY: 0.5 * S, color: 'rgba(120,80,0,0.45)' } : null,
  })
  _rects.favToggleRect = [favToggleX, favToggleY, favToggleSize, favToggleSize]

  const roleY = rarityY + filterH + 6 * S
  const roleGap = 4 * S
  const roleX0 = 12 * S
  const roleW = (W - 24 * S - roleGap * (ROLE_FILTERS.length - 1)) / ROLE_FILTERS.length
  for (let i = 0; i < ROLE_FILTERS.length; i++) {
    const f = ROLE_FILTERS[i]
    const fx = roleX0 + i * (roleW + roleGap)
    const isActive = (g._petPoolRoleFilter || 'all') === f.key
    c.fillStyle = isActive ? 'rgba(52,112,88,0.70)' : 'rgba(236,219,178,0.25)'
    R.rr(fx, roleY, roleW, roleH, 5 * S); c.fill()
    if (isActive) {
      c.strokeStyle = 'rgba(231,205,128,0.9)'
      c.lineWidth = 1.4 * S
      R.rr(fx, roleY, roleW, roleH, 5 * S); c.stroke()
    }
    c.fillStyle = isActive ? '#fff5d0' : 'rgba(70,42,22,0.86)'
    c.font = `bold ${(f.key === 'all' ? 8.2 : 8.8) * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = isActive ? 'rgba(22,35,29,0.55)' : 'rgba(255,245,210,0.30)'
    c.lineWidth = isActive ? 1.6 * S : 0.9 * S
    c.strokeText(f.label, fx + roleW / 2, roleY + roleH / 2)
    c.fillText(f.label, fx + roleW / 2, roleY + roleH / 2)
    _rects.roleFilterRects.push({ key: f.key, rect: [fx, roleY, roleW, roleH] })
  }

  c.restore()

  // === 摘要 Chip 条（聚合红点数量，点击循环定位）===
  const chipH = 22 * S
  const chipY = roleY + roleH + 6 * S
  _drawSummaryChips(c, R, S, W, chipY, chipH, g)

  // 派遣按钮 rect 占位（实际绘制在卡片网格下方）
  _rects.idleBtnRect = null

  // === 卡片网格 ===
  const gridTop = chipY + chipH + 8 * S
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
    const emptyText = g._petPoolFavOnly
      ? '暂无收藏的灵宠，长按或在详情页点 ♥ 收藏'
      : '暂无灵宠，在肉鸽中收集★3图鉴即可入池'
    c.fillText(emptyText, W / 2, (gridTop + gridBottom) / 2)
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
  // 开启「仅看收藏」时隐藏 ghost（未入池无法收藏，展示会产生语义冲突）
  const bank = g.storage.fragmentBank || {}
  const ownedIds = new Set((g.storage.petPool || []).map(p => p.id))
  const filter = g._petPoolFilter || 'all'
  const rarityFilter = g._petPoolRarityFilter || 'all'
  const roleFilter = g._petPoolRoleFilter || 'all'
  const ghostPets = g._petPoolFavOnly ? [] : Object.keys(bank)
    .filter(id => !ownedIds.has(id) && bank[id] > 0)
    .filter(id => {
      const bp = getPetById(id)
      if (!bp) return false
      if (filter !== 'all' && bp.attr !== filter) return false
      if (rarityFilter !== 'all' && getPetRarity(id) !== rarityFilter) return false
      if (roleFilter !== 'all') {
        const role = getPetRole(bp)
        if (!role || role.key !== roleFilter) return false
      }
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

  // 导出精确滚动上限给 tPetPool 使用（替代旧 V.H*0.5 粗估）
  //   · 内容高 = (普通 + 幽灵) 全部行 × (cardH + gap) + 顶部 gap
  //   · 可视高 = gridBottom - gridTop（已避开 chip 条 / idle 按钮 / 底栏）
  const totalGridRows = Math.ceil((pool.length + ghostPets.length) / cols)
  const contentHForScroll = totalGridRows * (cardH + cardGap) + cardGap
  const viewHForScroll = gridBottom - gridTop
  g._petPoolScrollMax = Math.max(0, contentHForScroll - viewHForScroll)
  if ((g._petPoolScroll || 0) > g._petPoolScrollMax) g._petPoolScroll = g._petPoolScrollMax

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
  const idleBtnImg = R.getImg(PET_POOL_SCROLL_ART.idleBtn)
  // 主按钮加一层底部投影和外描边，避免符箓横幅被误认为装饰条
  c.fillStyle = 'rgba(35,14,6,0.34)'
  R.rr(idleBtnX + 5 * S, idleBtnY + 8 * S, idleBtnW - 10 * S, idleBtnH, idleBtnH / 2); c.fill()
  if (idleBtnImg && idleBtnImg.width > 0) {
    c.drawImage(idleBtnImg, idleBtnX - 4 * S, idleBtnY - 10 * S, idleBtnW + 8 * S, idleBtnH + 20 * S)
  } else {
    c.fillStyle = hasIdleReward ? 'rgba(176,58,32,0.94)' : 'rgba(126,34,25,0.88)'
    R.rr(idleBtnX, idleBtnY, idleBtnW, idleBtnH, idleBtnH / 2); c.fill()
    c.strokeStyle = 'rgba(247,207,112,0.88)'
    c.lineWidth = 2 * S
    R.rr(idleBtnX, idleBtnY, idleBtnW, idleBtnH, idleBtnH / 2); c.stroke()
  }
  var idleBtnLabel = hasIdleReward ? '派遣修行  有奖励可领' : '派遣灵宠自动修行'
  _drawInkText(c, idleBtnLabel, idleBtnX + idleBtnW / 2, idleBtnY + idleBtnH / 2 + 0.5 * S, {
    font: `bold ${15*S}px "PingFang SC",serif`,
    fill: '#fff3cf',
    stroke: 'rgba(70,18,10,0.78)',
    lineWidth: 3 * S,
  })
  c.strokeStyle = 'rgba(255,232,150,0.72)'
  c.lineWidth = 1.4 * S
  R.rr(idleBtnX + 7 * S, idleBtnY + 5 * S, idleBtnW - 14 * S, idleBtnH - 10 * S, (idleBtnH - 10 * S) / 2); c.stroke()
  // 呼吸脉冲边框（引导阶段更醒目）
  if (hasIdleReward) {
    var ibPulse = 0.3 + 0.3 * Math.sin((g.af || 0) * 0.08)
    c.globalAlpha = ibPulse
    c.strokeStyle = 'rgba(255,236,166,0.9)'
    c.lineWidth = 2.5 * S
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

  // 卡片底图：水墨纸札，文字仍由 Canvas 绘制保证清晰
  const cardBg = R.getImg(PET_POOL_SCROLL_ART.card)
  if (cardBg && cardBg.width > 0) {
    c.drawImage(cardBg, x, y, w, h)
  } else {
    c.fillStyle = 'rgba(222,205,164,0.86)'
    R.rr(x, y, w, h, 8 * S); c.fill()
  }

  // 品质色只做淡淡灵气，避免压过纸札质感
  const rarityGrad = c.createRadialGradient(x + w / 2, y + h * 0.35, w * 0.1, x + w / 2, y + h * 0.35, w * 0.68)
  rarityGrad.addColorStop(0, rv.bgGradient[0] + '44')
  rarityGrad.addColorStop(1, rv.bgGradient[1] + '00')
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

  // 品质色边框收敛为纸札内描边
  c.strokeStyle = rv.borderColor + 'cc'
  c.lineWidth = 1.4 * S
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

  // ★4 灵相觉醒印章：★4+ 金色「觉」印章（拥有感），★3 半透明带锁（制造冲刺欲）
  //   只在 ★3+ 才画（低星卡片不堆叠角标，避免视觉噪音）
  if ((poolPet.star || 1) >= 3) {
    const isAwakened = (poolPet.star || 1) >= 4
    const sealR = 8 * S
    const sealCx = avatarX + avatarSize - sealR - 2 * S
    const sealCy = avatarY + sealR + 2 * S
    c.save()
    if (isAwakened) {
      const grad = c.createRadialGradient(sealCx - 2 * S, sealCy - 2 * S, sealR * 0.2, sealCx, sealCy, sealR)
      grad.addColorStop(0, '#FFE58A')
      grad.addColorStop(0.55, '#E8B820')
      grad.addColorStop(1, '#A77A20')
      c.fillStyle = grad
      c.beginPath(); c.arc(sealCx, sealCy, sealR, 0, Math.PI * 2); c.fill()
      c.strokeStyle = 'rgba(255,240,180,0.85)'; c.lineWidth = 0.9 * S
      c.beginPath(); c.arc(sealCx, sealCy, sealR - 0.8 * S, 0, Math.PI * 2); c.stroke()
      c.fillStyle = '#fff'
    } else {
      c.fillStyle = 'rgba(60,40,10,0.55)'
      c.beginPath(); c.arc(sealCx, sealCy, sealR, 0, Math.PI * 2); c.fill()
      c.strokeStyle = 'rgba(232,184,32,0.55)'; c.lineWidth = 0.8 * S
      c.beginPath(); c.arc(sealCx, sealCy, sealR - 0.6 * S, 0, Math.PI * 2); c.stroke()
      c.fillStyle = 'rgba(255,220,140,0.85)'
    }
    c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('觉', sealCx, sealCy + 0.3 * S)
    c.restore()
  }

  // 去掉宠物头像框，让宠物图片直接显示

  // 名称：纸札上用深墨色，弱描边防止压在头像边缘时发糊
  const nameY = avatarY + avatarSize + 6 * S
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  const displayName = basePet.name.length > 4 ? basePet.name.slice(0, 4) + '…' : basePet.name
  c.strokeStyle = 'rgba(255,240,205,0.68)'
  c.lineWidth = 2 * S
  c.strokeText(displayName, x + w / 2, nameY)
  c.fillStyle = '#3b2414'
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

  // 等级 + ATK
  const infoY = starY + 14 * S
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(255,240,205,0.65)'
  c.lineWidth = 1.8 * S
  c.strokeText(`Lv.${poolPet.level}  ATK:${atk}`, x + w / 2, infoY)
  c.fillStyle = '#4a2f1a'
  c.fillText(`Lv.${poolPet.level}  ATK:${atk}`, x + w / 2, infoY)

  _drawRolePill(c, R, S, x, y, w, h, getPetRole(basePet))

  // 品质徽标：小印章风格
  const rvBadge = rarityVisualForAttr(rarity, poolPet.attr || 'metal')
  const badgeText = rvBadge.label
  c.save()
  c.font = `bold ${10 * S}px sans-serif`
  const tw = c.measureText(badgeText).width
  const bw = tw + 6 * S, bh = 14 * S
  const bx = x + 2 * S, by = y + 2 * S
  c.fillStyle = rarity === 'SSR' ? 'rgba(142,64,28,0.88)' : 'rgba(112,44,32,0.82)'
  R.rr(bx, by, bw, bh, 3 * S); c.fill()
  c.strokeStyle = 'rgba(255,228,148,0.58)'; c.lineWidth = 0.9 * S
  R.rr(bx, by, bw, bh, 3 * S); c.stroke()
  c.fillStyle = rarity === 'SSR' ? '#ffe68c' : rvBadge.badgeColor
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(badgeText, bx + 3 * S, by + 2 * S)
  c.restore()

  // 收藏徽章：品质印章右下角挂小金星（业界常见"心头好"标记，和觉印/语义角标位置错开）
  //   - 描边 + 金色渐变，清晰度高、风格克制，不挤压 Lv/ATK 底部信息
  //   - 排序已在 getFilteredPool 置顶，这里仅是视觉识别
  if (g && g.storage.isPetPoolFavorite && g.storage.isPetPoolFavorite(poolPet.id)) {
    const starSize = 11 * S
    const starCx = bx + bw - 1 * S
    const starCy = by + bh - 1 * S
    drawFavStar(c, starCx, starCy, starSize, {
      shadow: { blur: 3 * S, offsetY: 0.6 * S, color: 'rgba(0,0,0,0.45)' },
    })
  }

  // 语义角标（star=立即可升星 / new=刚入池未查看 / level=仅差等级即可升星）
  // 同一卡片只显示最高优先级一个，避免角标堆叠。
  if (g) {
    const ss = g.storage.soulStone || 0
    const aw = g.storage.awakenStone || 0
    const uf = g.storage.universalFragment || 0
    const isNew = g.storage.isPetNewInPool ? g.storage.isPetNewInPool(poolPet.id) : false
    const badge = computePetPoolBadge(poolPet, ss, aw, isNew, uf)
    _drawCardBadge(c, R, S, x, y, w, badge)

    // 摘要 chip 点击后，对目标卡片进行短暂黄色描边高亮
    const hl = g._petPoolHighlight
    if (hl && hl.petId === poolPet.id) {
      const remain = hl.until - Date.now()
      if (remain > 0) {
        c.save()
        const a = 0.45 + 0.35 * Math.sin(Date.now() * 0.012)
        c.strokeStyle = `rgba(255,235,120,${a})`
        c.lineWidth = 2.5 * S
        R.rr(x - 1 * S, y - 1 * S, w + 2 * S, h + 2 * S, 9 * S); c.stroke()
        c.restore()
      } else {
        g._petPoolHighlight = null
      }
    }

    // 收藏状态下，整卡外缘再叠一层淡金色描边（第二道视觉钩子）
    //   - 放在最上层避免被品质边框盖住；lineWidth 1.3*S，在品质边框 2*S 内侧隐约透出金辉
    //   - 和"可升星"黄色高亮（_petPoolHighlight）时机互斥（玩家注意力优先给闪烁黄边）
    if (g.storage.isPetPoolFavorite && g.storage.isPetPoolFavorite(poolPet.id)) {
      const hl = g._petPoolHighlight
      const hlActive = hl && hl.petId === poolPet.id && hl.until - Date.now() > 0
      if (!hlActive) {
        c.save()
        c.shadowColor = 'rgba(240,200,80,0.45)'
        c.shadowBlur = 5 * S
        c.strokeStyle = 'rgba(255,220,120,0.85)'
        c.lineWidth = 1.3 * S
        R.rr(x + 0.5 * S, y + 0.5 * S, w - 1 * S, h - 1 * S, 7.5 * S); c.stroke()
        c.restore()
      }
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

  const cardBg = R.getImg(PET_POOL_SCROLL_ART.card)
  if (cardBg && cardBg.width > 0) {
    c.drawImage(cardBg, x, y, w, h)
  } else {
    c.fillStyle = 'rgba(222,205,164,0.86)'
    R.rr(x, y, w, h, 8 * S); c.fill()
  }

  // 未入池纸札保留淡淡品质灵气
  const gRarityGrad = c.createRadialGradient(x + w / 2, y + h * 0.35, w * 0.1, x + w / 2, y + h * 0.35, w * 0.68)
  gRarityGrad.addColorStop(0, rv.bgGradient[0] + '34')
  gRarityGrad.addColorStop(1, rv.bgGradient[1] + '00')
  c.fillStyle = gRarityGrad
  R.rr(x, y, w, h, 8 * S); c.fill()

  // 品质色边框
  c.strokeStyle = rv.borderColor + 'aa'
  c.lineWidth = 1.4 * S
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
  c.strokeStyle = 'rgba(255,240,205,0.68)'; c.lineWidth = 2 * S
  c.strokeText(displayName, x + w / 2, nameY)
  c.fillStyle = 'rgba(58,36,20,0.78)'
  c.fillText(displayName, x + w / 2, nameY)

  // 右上角「收集中」角标
  const tagText = '收集中'
  c.save()
  c.font = `bold ${8.5*S}px "PingFang SC",sans-serif`
  const tagTW = c.measureText(tagText).width
  const tagPadX = 5 * S
  const tagW = tagTW + tagPadX * 2
  const tagH = 13 * S
  const tagX = x + w - tagW - 4 * S
  const tagY = y + 4 * S
  c.fillStyle = 'rgba(74,145,122,0.74)'
  R.rr(tagX, tagY, tagW, tagH, tagH / 2); c.fill()
  c.strokeStyle = 'rgba(213,193,116,0.78)'
  c.lineWidth = 1 * S
  R.rr(tagX, tagY, tagW, tagH, tagH / 2); c.stroke()
  c.fillStyle = '#fff'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(tagText, tagX + tagW / 2, tagY + tagH / 2 + 0.5 * S)
  c.restore()

  // 进度条副文字
  const barW = w * 0.7
  const barH2 = 8 * S
  const barX = x + (w - barW) / 2
  const subTipY = nameY + 16 * S
  c.fillStyle = 'rgba(58,36,20,0.66)'
  c.font = `${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.fillText('集齐可召唤入队', x + w / 2, subTipY)

  // 碎片进度条
  const barY2 = subTipY + 10 * S
  const progress = Math.min(1, fragCount / cost)
  c.fillStyle = 'rgba(0,0,0,0.3)'
  R.rr(barX, barY2, barW, barH2, barH2 / 2); c.fill()
  if (progress > 0) {
    const fillGrad = c.createLinearGradient(barX, barY2, barX + barW * progress, barY2)
    fillGrad.addColorStop(0, '#4a917a')
    fillGrad.addColorStop(1, '#b03a20')
    c.fillStyle = fillGrad
    R.rr(barX, barY2, barW * progress, barH2, barH2 / 2); c.fill()
  }

  // 碎片数字
  c.fillStyle = fragCount >= cost ? '#2f8f60' : 'rgba(58,36,20,0.66)'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.fillText(`${fragCount}/${cost}`, x + w / 2, barY2 + barH2 + 3 * S)

  _drawRolePill(c, R, S, x, y, w, h, getPetRole(basePet))

  c.globalAlpha = 1
  const rvGBadge = rarityVisualForAttr(rarity, basePet.attr || 'metal')
  const gBadgeText = rvGBadge.label
  c.save()
  c.font = `bold ${10 * S}px sans-serif`
  const gTw = c.measureText(gBadgeText).width
  const gBw = gTw + 6 * S, gBh = 14 * S
  c.fillStyle = rarity === 'SSR' ? 'rgba(142,64,28,0.88)' : 'rgba(112,44,32,0.82)'
  R.rr(x + 2 * S, y + 2 * S, gBw, gBh, 3 * S); c.fill()
  c.strokeStyle = 'rgba(255,228,148,0.58)'; c.lineWidth = 0.9 * S
  R.rr(x + 2 * S, y + 2 * S, gBw, gBh, 3 * S); c.stroke()
  c.fillStyle = rarity === 'SSR' ? '#ffe68c' : rvGBadge.badgeColor
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(gBadgeText, x + 5 * S, y + 4 * S)
  c.restore()

  c.restore()
}


// ===== 触摸处理 =====
// 滚动相关
let _scrollTouchY = 0
let _scrollTouchX = 0
let _scrolling = false

// 长按快捷收藏：按下卡片 ~450ms 不移动不抬起 → 切换收藏态
const LONG_PRESS_MS = 450
let _longPressTimer = null
let _longPressTriggered = false

function _cancelLongPress() {
  if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null }
}

function _tryStartLongPress(g, x, y) {
  _cancelLongPress()
  _longPressTriggered = false
  // 命中已拥有卡片才启动（ghost 卡不支持收藏）
  for (const card of _rects.cardRects) {
    if (card.ghost) continue
    if (g._hitRect(x, y, ...card.rect)) {
      const petId = card.petId
      _longPressTimer = setTimeout(() => {
        _longPressTimer = null
        _longPressTriggered = true
        if (g.storage.togglePetPoolFavorite) {
          const favNow = g.storage.togglePetPoolFavorite(petId)
          if (favNow != null) {
            MusicMgr.playClick && MusicMgr.playClick()
            if (P && P.showGameToast) {
              P.showGameToast(favNow ? '♥ 已收藏' : '已取消收藏', { type: favNow ? 'success' : 'info' })
            }
            // 触发一次黄色高亮闪烁，帮玩家定位排序位置变化
            g._petPoolHighlight = { petId, until: Date.now() + 800 }
            g._dirty = true
          }
        }
      }, LONG_PRESS_MS)
      return
    }
  }
}

function tPetPool(g, x, y, type) {
  const { S } = V

  // 滚动处理
  if (type === 'start') {
    _scrollTouchY = y
    _scrollTouchX = x
    _scrolling = false
    _tryStartLongPress(g, x, y)
  }
  if (type === 'move') {
    const dy = _scrollTouchY - y
    const dx = _scrollTouchX - x
    if (Math.abs(dy) > 3 * S || Math.abs(dx) > 3 * S) {
      _scrolling = true
      _cancelLongPress()
    }
    if (_scrolling) {
      g._petPoolScroll = Math.max(0, (g._petPoolScroll || 0) + dy)
      _scrollTouchY = y
      // 滚动上限：由渲染端 rPetPool 根据"网格实际内容高 - 可视区高"精确算出写入 g._petPoolScrollMax
      //   · 老版本用 V.H*0.5 粗估 → 底部最后一行 + SSR 收集条滚不到（玩家反馈）
      const maxScroll = g._petPoolScrollMax || 0
      g._petPoolScroll = Math.min(g._petPoolScroll, maxScroll)
    }
    return
  }
  if (type === 'end') {
    _cancelLongPress()
    // 长按已触发 → 吞掉本次 tap，避免继续进入详情页
    if (_longPressTriggered) {
      _longPressTriggered = false
      return
    }
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
          if ((g.storage.weaponCollection || []).length < 1) return
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

    for (const f of _rects.roleFilterRects) {
      if (g._hitRect(x, y, ...f.rect)) {
        g._petPoolRoleFilter = f.key
        g._petPoolScroll = 0
        return
      }
    }

    // 「⭐ 仅看收藏」toggle：和品质筛选同行
    if (_rects.favToggleRect && g._hitRect(x, y, ..._rects.favToggleRect)) {
      g._petPoolFavOnly = !g._petPoolFavOnly
      g._petPoolScroll = 0
      MusicMgr.playClick && MusicMgr.playClick()
      return
    }

    // 摘要 chip 点击：循环定位到下一只该状态的宠物
    for (const chip of _rects.chipRects) {
      if (g._hitRect(x, y, ...chip.rect)) {
        _focusNextBadgePet(g, chip.key)
        MusicMgr.playClick && MusicMgr.playClick()
        return
      }
    }

    // 卡片点击 → 跳转宠物详情全屏页
    for (const card of _rects.cardRects) {
      if (g._hitRect(x, y, ...card.rect)) {
        g._petDetailId = card.petId
        g._petDetailUnowned = !!card.ghost
        g._petDetailUnownedFullRoadmap = false
        g._petDetailReturnScene = null
        g.setScene('petDetail')
        MusicMgr.playClick && MusicMgr.playClick()
        return
      }
    }
  }
}

module.exports = { rPetPool, tPetPool }
