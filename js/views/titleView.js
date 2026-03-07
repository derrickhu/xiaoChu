/**
 * 首页渲染 — 场景式大厅（方案A）
 * 五个分区：顶栏 / 场景区 / 灵宠展示 / 双模式卡片 / 底部常驻栏
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { PETS, getPetAvatarPath } = require('../data/pets')
const { drawNewRunConfirm } = require('./screens')

// 底部栏按钮定义（从左到右）
const BAR_ITEMS = [
  { key: 'pets',  label: '灵宠', icon: '🐾', locked: true },
  { key: 'dex',   label: '图鉴', icon: '📖' },
  { key: 'stats', label: '统计', icon: '📊' },
  { key: 'rank',  label: '排行', icon: '🏆' },
  { key: 'more',  label: '更多', icon: '⚙' },
]

// 根据宠物 name 反查 id（兼容旧存档没有 id 的情况）
function _findPetId(name) {
  for (const attr of Object.keys(PETS)) {
    const found = PETS[attr].find(p => p.name === name)
    if (found) return found.id
  }
  return null
}

// ===== 布局计算 =====
function getLayout() {
  const { W, H, S, safeTop } = V
  const safeBottom = 10 * S

  const topBarH   = 36 * S
  const bottomBarH = 52 * S
  const cardH     = 100 * S
  const petRowH   = 48 * S
  const pad       = 16 * S
  const cardGap   = 10 * S

  const topBarY      = safeTop
  const topBarBottom = topBarY + topBarH

  const bottomBarY = H - bottomBarH - safeBottom
  const cardsY     = bottomBarY - cardH - 10 * S
  const petRowY    = cardsY - petRowH - 6 * S
  const cardW      = (W - pad * 2 - cardGap) / 2

  return {
    topBarY, topBarH, topBarBottom,
    bottomBarY, bottomBarH, safeBottom,
    cardsY, cardH, cardW, cardGap, pad,
    petRowY, petRowH,
  }
}

// ===== ZONE 1: 顶栏 =====
function drawTopBar(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()

  ctx.save()
  const barPad = 12 * S
  const barW = W - barPad * 2
  const barH = L.topBarH - 4 * S
  const barX = barPad
  const barY = L.topBarY + 2 * S

  // 半透明底条
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  R.rr(barX, barY, barW, barH, 8 * S); ctx.fill()

  // 左：历史最佳层数
  const best = g.storage.bestFloor
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(best > 0 ? `☆ 最佳第 ${best} 层` : '☆ 新修士', barX + 10 * S, barY + barH / 2)

  // 右：挑战次数
  const runs = g.storage.totalRuns || 0
  if (runs > 0) {
    ctx.fillStyle = 'rgba(200,200,210,0.7)'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(`挑战 ${runs} 次`, barX + barW - 10 * S, barY + barH / 2)
  }
  ctx.restore()
}

// ===== ZONE 2: 场景区（背景 + Logo） =====
function drawSceneArea(g) {
  const { ctx, R, W, S } = V
  R.drawHomeBg(g.af)

  const titleLogo = R.getImg('assets/ui/title_logo.png')
  if (titleLogo && titleLogo.width > 0) {
    const L = getLayout()
    const logoW = W * 0.55
    const logoH = logoW * (titleLogo.height / titleLogo.width)
    const logoX = (W - logoW) / 2
    const sceneH = L.petRowY - L.topBarBottom
    const logoY = L.topBarBottom + sceneH * 0.15
    ctx.drawImage(titleLogo, logoX, logoY, logoW, logoH)
  }
}

// ===== ZONE 3: 灵宠展示 =====
function drawPetDisplay(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()

  const pets = g.storage.stats.bestFloorPets || []
  const slotSize = 36 * S
  const gap = 8 * S
  const count = 5
  const totalW = count * slotSize + (count - 1) * gap
  const startX = (W - totalW) / 2
  const centerY = L.petRowY + L.petRowH / 2

  ctx.save()
  if (pets.length === 0) {
    // 空位虚线圆圈
    for (let i = 0; i < count; i++) {
      const cx = startX + i * (slotSize + gap) + slotSize / 2
      ctx.beginPath()
      ctx.arc(cx, centerY, slotSize / 2 - 2 * S, 0, Math.PI * 2)
      ctx.setLineDash([4 * S, 3 * S])
      ctx.strokeStyle = 'rgba(200,180,120,0.3)'
      ctx.lineWidth = 1.5 * S
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.fillStyle = 'rgba(200,180,120,0.5)'
    ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText('开始冒险，组建你的灵宠队伍', W / 2, centerY + slotSize / 2 + 4 * S)
    ctx.restore()
    return
  }

  for (let i = 0; i < Math.min(pets.length, count); i++) {
    const pet = pets[i]
    const cx = startX + i * (slotSize + gap) + slotSize / 2
    const r = slotSize / 2 - 2 * S
    const attrColor = ATTR_COLOR[pet.attr]

    // 属性色边框
    if (attrColor) {
      ctx.beginPath()
      ctx.arc(cx, centerY, r + 2 * S, 0, Math.PI * 2)
      ctx.strokeStyle = attrColor.main
      ctx.lineWidth = 2 * S
      ctx.stroke()
    }

    // 头像（圆形裁剪）
    const petId = pet.id || _findPetId(pet.name)
    if (petId) {
      const img = R.getImg(getPetAvatarPath({ id: petId, star: pet.star || 1 }))
      if (img && img.width > 0) {
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, centerY, r, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, cx - r, centerY - r, r * 2, r * 2)
        ctx.restore()
        continue
      }
    }
    // fallback: 属性色圆 + 名字首字
    ctx.beginPath()
    ctx.arc(cx, centerY, r, 0, Math.PI * 2)
    ctx.fillStyle = attrColor ? attrColor.bg : 'rgba(30,30,50,0.8)'
    ctx.fill()
    ctx.fillStyle = attrColor ? attrColor.lt : '#ccc'
    ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(pet.name ? pet.name.charAt(0) : '?', cx, centerY)
  }
  ctx.restore()
}

// ===== 卡片内按钮 =====
function _drawCardBtn(ctx, R, S, x, y, w, h, text, active) {
  const rad = h * 0.4
  if (active) {
    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, '#f5d98a'); grad.addColorStop(0.5, '#d4a84b'); grad.addColorStop(1, '#b8862d')
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = 'rgba(100,100,120,0.4)'
  }
  R.rr(x, y, w, h, rad); ctx.fill()
  ctx.fillStyle = active ? '#5a2d0c' : '#888'
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, x + w / 2, y + h / 2)
}

// ===== ZONE 4: 双模式卡片 =====
function drawModeCards(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()
  const leftX = L.pad
  const leftW = L.cardW
  const cardY = L.cardsY
  const cardH = L.cardH
  const rad = 12 * S

  ctx.save()

  // ── 左卡：通天塔（肉鸽爬塔） ──
  ctx.fillStyle = 'rgba(20,15,40,0.85)'
  R.rr(leftX, cardY, leftW, cardH, rad); ctx.fill()
  ctx.strokeStyle = 'rgba(200,180,120,0.25)'; ctx.lineWidth = 1 * S
  R.rr(leftX, cardY, leftW, cardH, rad); ctx.stroke()

  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('⚔ 通天塔', leftX + leftW / 2, cardY + 10 * S)

  const hasSave = g.storage.hasSavedRun()
  if (hasSave) {
    const saved = g.storage.loadRunState()
    ctx.fillStyle = '#f0e0c0'
    ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`继续第 ${saved.floor} 层`, leftX + leftW / 2, cardY + 30 * S)

    const btnW = leftW - 20 * S, btnH = 28 * S
    const btnX = leftX + 10 * S, btnY = cardY + 48 * S
    _drawCardBtn(ctx, R, S, btnX, btnY, btnW, btnH, '继续挑战', true)
    g._titleContinueRect = [btnX, btnY, btnW, btnH]

    // 「重新开始」小文字链
    ctx.fillStyle = 'rgba(200,180,120,0.6)'
    ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.fillText('重新开始', leftX + leftW / 2, cardY + 85 * S)
    const rstTw = 36 * S
    g._titleBtnRect = [leftX + leftW / 2 - rstTw, cardY + 78 * S, rstTw * 2, 16 * S]
  } else {
    const best = g.storage.bestFloor
    ctx.fillStyle = 'rgba(200,200,210,0.7)'
    ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(best > 0 ? `历史最高第 ${best} 层` : '等待挑战', leftX + leftW / 2, cardY + 30 * S)

    const btnW = leftW - 20 * S, btnH = 28 * S
    const btnX = leftX + 10 * S, btnY = cardY + 55 * S
    _drawCardBtn(ctx, R, S, btnX, btnY, btnW, btnH, '开始挑战', true)
    g._titleBtnRect = [btnX, btnY, btnW, btnH]
    g._titleContinueRect = null
  }

  // ── 右卡：固定关卡（锁定） ──
  const rightX = leftX + leftW + L.cardGap
  ctx.fillStyle = 'rgba(20,15,40,0.5)'
  R.rr(rightX, cardY, L.cardW, cardH, rad); ctx.fill()
  ctx.strokeStyle = 'rgba(100,100,120,0.2)'; ctx.lineWidth = 1 * S
  R.rr(rightX, cardY, L.cardW, cardH, rad); ctx.stroke()

  ctx.fillStyle = 'rgba(140,140,160,0.5)'
  ctx.font = `${24*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('🔒', rightX + L.cardW / 2, cardY + cardH * 0.35)

  ctx.fillStyle = 'rgba(140,140,160,0.6)'
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.textBaseline = 'top'
  ctx.fillText('固定关卡', rightX + L.cardW / 2, cardY + cardH * 0.55)

  ctx.fillStyle = 'rgba(140,140,160,0.4)'
  ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('即将开放', rightX + L.cardW / 2, cardY + cardH * 0.72)

  g._fixedStageRect = [rightX, cardY, L.cardW, cardH]
  ctx.restore()
}

// ===== ZONE 5: 底部常驻栏 =====
function drawBottomBar(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()

  ctx.save()
  // 栏背景（延伸到安全区底部）
  ctx.fillStyle = 'rgba(10,8,20,0.88)'
  ctx.fillRect(0, L.bottomBarY, W, L.bottomBarH + L.safeBottom)
  // 顶部分隔线
  ctx.strokeStyle = 'rgba(200,180,120,0.2)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(0, L.bottomBarY); ctx.lineTo(W, L.bottomBarY); ctx.stroke()

  const iconW = W / BAR_ITEMS.length
  g._bottomBarRects = []

  for (let i = 0; i < BAR_ITEMS.length; i++) {
    const item = BAR_ITEMS[i]
    const cx = i * iconW + iconW / 2
    const iconY = L.bottomBarY + 6 * S
    const labelY = L.bottomBarY + 32 * S
    const isLocked = !!item.locked

    // 图标
    ctx.globalAlpha = isLocked ? 0.4 : 1
    ctx.font = `${20*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.fillText(item.icon, cx, iconY + 12 * S)

    // 标签
    ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillStyle = isLocked ? 'rgba(140,140,160,0.5)' : '#d4a856'
    ctx.fillText(item.label, cx, labelY)
    ctx.globalAlpha = 1

    g._bottomBarRects.push([i * iconW, L.bottomBarY, iconW, L.bottomBarH])

    // 图鉴红点
    if (item.key === 'dex') {
      const dex = g.storage.petDex || []
      const seen = g.storage.petDexSeen || []
      if (dex.length > seen.length) {
        const dotR = 4 * S
        ctx.beginPath()
        ctx.arc(cx + 12 * S, iconY + 4 * S, dotR, 0, Math.PI * 2)
        ctx.fillStyle = '#ff4444'; ctx.fill()
      }
    }
  }

  // 排行按钮 rect 同步给 wxButtons（透明授权按钮用）
  const rankIdx = BAR_ITEMS.findIndex(b => b.key === 'rank')
  if (rankIdx >= 0) g._rankBtnRect = g._bottomBarRects[rankIdx]

  ctx.restore()
}

// ===== 「更多」弹出面板 =====
function drawMorePanel(g) {
  if (!g.showMorePanel) return

  const { ctx, R, W, H, S } = V
  const L = getLayout()

  // 遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, W, H)

  // 面板（底部弹起，覆盖 Zone4+5）
  const panelH = L.cardH + L.bottomBarH + L.safeBottom + 40 * S
  const panelY = H - panelH
  const rad = 16 * S

  ctx.fillStyle = 'rgba(20,18,38,0.95)'
  ctx.beginPath()
  ctx.moveTo(0, panelY + rad)
  ctx.arcTo(0, panelY, rad, panelY, rad)
  ctx.lineTo(W - rad, panelY)
  ctx.arcTo(W, panelY, W, panelY + rad, rad)
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()

  // 标题
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('更多', W / 2, panelY + 16 * S)

  // 选项列表
  const items = [
    { key: 'sfx',      label: '音效',     toggle: g.storage.settings.sfxOn },
    { key: 'bgm',      label: '背景音乐', toggle: g.storage.settings.bgmOn },
    { key: 'feedback', label: '意见反馈', toggle: null },
  ]

  const itemH = 44 * S
  const listX = 24 * S
  const listW = W - 48 * S
  let itemY = panelY + 44 * S

  g._morePanelRects = {}
  g._morePanelY = panelY

  for (const item of items) {
    // 行背景
    ctx.fillStyle = 'rgba(40,35,60,0.6)'
    R.rr(listX, itemY, listW, itemH - 4 * S, 8 * S); ctx.fill()

    // 标签
    ctx.fillStyle = '#e0d8c0'
    ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(item.label, listX + 12 * S, itemY + (itemH - 4 * S) / 2)

    if (item.toggle !== null && item.toggle !== undefined) {
      // 开关按钮
      const swW = 40 * S, swH = 22 * S
      const swX = listX + listW - swW - 8 * S
      const swY = itemY + (itemH - 4 * S) / 2 - swH / 2
      const swR = swH / 2

      ctx.fillStyle = item.toggle ? 'rgba(77,204,77,0.8)' : 'rgba(100,100,120,0.5)'
      R.rr(swX, swY, swW, swH, swR); ctx.fill()
      // 滑块
      const knobR = swH / 2 - 2 * S
      const knobX = item.toggle ? swX + swW - swH / 2 : swX + swH / 2
      ctx.beginPath()
      ctx.arc(knobX, swY + swH / 2, knobR, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()

      // 整行可点击
      g._morePanelRects[item.key] = [listX, itemY, listW, itemH - 4 * S]
    } else {
      // 箭头（意见反馈）
      ctx.fillStyle = 'rgba(200,180,120,0.5)'
      ctx.font = `${14*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText('›', listX + listW - 12 * S, itemY + (itemH - 4 * S) / 2)
      g._morePanelRects[item.key] = [listX, itemY, listW, itemH - 4 * S]
    }
    itemY += itemH
  }

  // 反馈区域同步给 wxButtons（面板打开时定位透明反馈按钮）
  if (g._morePanelRects.feedback) {
    g._feedbackBtnRect = g._morePanelRects.feedback
  }

  ctx.restore()
}

// ===== 主入口 =====
function rTitle(g) {
  drawSceneArea(g)
  drawTopBar(g)
  drawPetDisplay(g)
  drawModeCards(g)
  drawBottomBar(g)
  drawMorePanel(g)
  if (g.showNewRunConfirm) drawNewRunConfirm(g)
}

module.exports = { rTitle, getLayout, BAR_ITEMS }
