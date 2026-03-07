/**
 * 首页渲染 — 场景式大厅 v3
 * 布局：顶栏 / 场景区（背景+插画+Logo）/ 灵宠展示 / 开始按钮区 / 模式切换浮钮 / 7标签底部导航
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')
const { PETS, getPetAvatarPath } = require('../data/pets')

// 底部 7 标签定义（index=3 为中心凸起按钮）
const BAR_ITEMS = [
  { key: 'hero',   label: '主角',  icon: '👤', locked: true, img: 'assets/ui/nav_hero.png' },
  { key: 'pets',   label: '灵宠',  icon: '🐾', locked: true, img: 'assets/ui/nav_icons.png' },
  { key: 'dex',    label: '图鉴',  icon: '📖', img: 'assets/ui/nav_dex.png' },
  { key: 'battle', label: '战斗',  icon: '⚔',  center: true },
  { key: 'rank',   label: '排行',  icon: '🏆', img: 'assets/ui/nav_rank.png' },
  { key: 'stats',  label: '统计',  icon: '📊', img: 'assets/ui/nav_stats.png' },
  { key: 'more',   label: '更多',  icon: '⚙',  img: 'assets/ui/nav_more.png' },
]

// 模式配置
const MODE_CFG = {
  tower: { name: '通天塔',  img: 'assets/ui/tower_rogue.png', icon: '⚔',  switchKey: 'stage' },
  stage: { name: '固定关卡', img: 'assets/ui/gate_stage.png', icon: '🏯', switchKey: 'tower' },
}

// 根据宠物 name 反查 id（兼容旧存档没有 id 的情况）
function _findPetId(name) {
  for (const attr of Object.keys(PETS)) {
    const found = PETS[attr].find(p => p.name === name)
    if (found) return found.id
  }
  return null
}

// ===== 布局计算（从底部反推）=====
function getLayout() {
  const { W, H, S, safeTop } = V
  const safeBottom = 10 * S

  const topBarH     = 36 * S
  const bottomBarH  = 62 * S
  const modeSwitchH = 52 * S   // 正方形图标边长（图案区）
  const startBtnH   = 44 * S   // 开始按钮高度
  const progressH   = 18 * S   // 进度文字高度
  const petRowH     = 48 * S   // 仅固定关卡模式使用
  const pad         = 16 * S

  const topBarY      = safeTop
  const topBarBottom = topBarY + topBarH

  const bottomBarY  = H - bottomBarH - safeBottom
  // 向上留出足够空间：图标高度 + 标签文字 + 与底栏间距
  const modeSwitchY = bottomBarY - modeSwitchH - 15 * S - 24 * S   // 15S=标签区, 24S=间距
  const progressY   = modeSwitchY - progressH - 6 * S
  // 按钮在进度文字上方，塔图叠在按钮上方（petRowY 为塔底边参考线，略低于按钮顶使图片与按钮叠压）
  const startBtnY   = progressY - startBtnH - 8 * S
  const petRowY     = startBtnY + 16 * S   // 塔插图的下边缘基准（按钮往下16S）

  return {
    topBarY, topBarH, topBarBottom,
    bottomBarY, bottomBarH, safeBottom,
    modeSwitchY, modeSwitchH,
    startBtnY, startBtnH,
    progressY, progressH,
    petRowY, petRowH,
    pad, W, H, S,
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

  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  R.rr(barX, barY, barW, barH, 8 * S); ctx.fill()

  const best = g.storage.bestFloor
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(best > 0 ? `☆ 最佳第 ${best} 层` : '☆ 新修士', barX + 10 * S, barY + barH / 2)

  const runs = g.storage.totalRuns || 0
  if (runs > 0) {
    ctx.fillStyle = 'rgba(200,200,210,0.7)'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(`挑战 ${runs} 次`, barX + barW - 10 * S, barY + barH / 2)
  }
  ctx.restore()
}

// ===== ZONE 2: 场景区（背景 + 插画 + Logo）=====
function drawSceneArea(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()

  R.drawHomeBg(g.af)

  const mode = g.titleMode || 'tower'
  const imgPath = MODE_CFG[mode].img
  const towerImg = R.getImg(imgPath)
  const sceneH = L.petRowY - L.topBarBottom

  if (towerImg && towerImg.width > 0) {
    // 以场景高度为基准，使塔图填满纵向空间（最宽不超过 92%W）
    const targetH = sceneH * 0.88
    const ratioW = towerImg.width / towerImg.height
    const imgW = Math.min(targetH * ratioW, W * 0.92)
    const imgH = imgW / ratioW
    const imgX = (W - imgW) / 2
    // 底部对齐到 petRowY + 14S（与按钮略微叠压）
    const imgY = L.petRowY - imgH + 14 * S
    ctx.drawImage(towerImg, imgX, imgY, imgW, imgH)
  } else {
    // 无素材 fallback
    const emoji = mode === 'tower' ? '🏯' : '🏰'
    ctx.save()
    ctx.font = `${80*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.globalAlpha = mode === 'stage' ? 0.35 : 0.6
    ctx.fillText(emoji, W / 2, L.topBarBottom + sceneH * 0.45)
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // Logo 居中贴近顶栏
  const titleLogo = R.getImg('assets/ui/title_logo.png')
  if (titleLogo && titleLogo.width > 0) {
    const logoW = W * 0.48
    const logoH = logoW * (titleLogo.height / titleLogo.width)
    const logoX = (W - logoW) / 2
    const logoY = L.topBarBottom + 6 * S
    ctx.drawImage(titleLogo, logoX, logoY, logoW, logoH)
  }
}

// ===== ZONE 3: 灵宠展示（仅固定关卡模式显示）=====
function drawPetDisplay(g) {
  if ((g.titleMode || 'tower') === 'tower') return

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
    ctx.restore()
    return
  }

  for (let i = 0; i < Math.min(pets.length, count); i++) {
    const pet = pets[i]
    const cx = startX + i * (slotSize + gap) + slotSize / 2
    const r = slotSize / 2 - 2 * S
    const attrColor = ATTR_COLOR[pet.attr]

    if (attrColor) {
      ctx.beginPath()
      ctx.arc(cx, centerY, r + 2 * S, 0, Math.PI * 2)
      ctx.strokeStyle = attrColor.main
      ctx.lineWidth = 2 * S
      ctx.stroke()
    }

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

// ===== ZONE 4: 开始按钮区 =====
function drawStartBtn(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()
  const mode = g.titleMode || 'tower'

  ctx.save()

  if (mode === 'tower') {
    const btnW = W * 0.60
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = L.startBtnY

    // 使用 btn_start.png 资源，fallback 到渐变色
    const btnImg = R.getImg('assets/ui/btn_start.png')
    if (btnImg && btnImg.width > 0) {
      ctx.drawImage(btnImg, btnX, btnY, btnW, btnH)
    } else {
      const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
      grad.addColorStop(0, '#f5d98a')
      grad.addColorStop(0.5, '#d4a84b')
      grad.addColorStop(1, '#b8862d')
      ctx.fillStyle = grad
      R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); ctx.fill()
    }

    // 按钮文字叠在图片上
    const hasSave = g.storage.hasSavedRun()
    ctx.fillStyle = '#5a2d0c'
    ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(hasSave ? '继续挑战' : '开始挑战', btnX + btnW / 2, btnY + btnH / 2)

    g._startBtnRect = [btnX, btnY, btnW, btnH]

    // 进度文字
    let progressText = ''
    if (hasSave) {
      const saved = g.storage.loadRunState()
      progressText = `继续第 ${saved.floor} 层  ·  历史最高 ${g.storage.bestFloor} 层`
    } else {
      const best = g.storage.bestFloor
      progressText = best > 0 ? `历史最高第 ${best} 层` : '开始你的第一次冒险'
    }
    ctx.fillStyle = 'rgba(80,50,20,0.7)'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.textBaseline = 'middle'
    ctx.fillText(progressText, W / 2, L.progressY + L.progressH / 2)
  } else {
    // 固定关卡：灰色锁定按钮
    const btnW = W * 0.55
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = L.startBtnY

    ctx.fillStyle = 'rgba(100,100,120,0.35)'
    R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); ctx.fill()
    ctx.fillStyle = 'rgba(140,140,160,0.6)'
    ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🔒 即将开放', btnX + btnW / 2, btnY + btnH / 2)

    g._startBtnRect = null
  }

  ctx.restore()
}

// ===== ZONE 4b: 开始/继续确认弹窗 =====
function drawTitleStartDialog(g) {
  if (!g.showTitleStartDialog) return

  const { ctx, R, W, H, S } = V
  const hasSave = g.storage.hasSavedRun()

  // 遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, W, H)

  // 面板
  const pw = W * 0.82
  const ph = hasSave ? 190 * S : 150 * S
  const px = (W - pw) / 2
  const py = (H - ph) / 2

  const panelImg = R.getImg('assets/ui/info_panel_bg.png')
  if (panelImg && panelImg.width > 0) {
    ctx.drawImage(panelImg, px, py, pw, ph)
  } else {
    const rad = 14 * S
    ctx.fillStyle = 'rgba(248,242,230,0.97)'
    R.rr(px, py, pw, ph, rad); ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5 * S
    R.rr(px, py, pw, ph, rad); ctx.stroke()
  }

  ctx.textAlign = 'center'

  if (hasSave) {
    const saved = g.storage.loadRunState()

    // 标题
    ctx.fillStyle = '#6B5014'
    ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('通天塔', px + pw * 0.5, py + 30 * S)

    // 进度信息
    ctx.fillStyle = '#8a6a20'
    ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`进度：第 ${saved.floor} 层`, px + pw * 0.5, py + 58 * S)
    ctx.fillStyle = '#7B7060'
    ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(`历史最高第 ${g.storage.bestFloor} 层`, px + pw * 0.5, py + 78 * S)

    // 红字提醒（将原二次确认提示并入本弹窗）
    ctx.fillStyle = '#C0392B'
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('重新挑战将清空当前进度记录', px + pw * 0.5, py + 98 * S)

    // 按钮：左重新挑战，右继续挑战
    const btnW = pw * 0.36, btnH = 34 * S, gap = 12 * S
    const btn1X = px + pw * 0.5 - btnW - gap * 0.5
    const btn2X = px + pw * 0.5 + gap * 0.5
    const btnY = py + 122 * S

    R.drawDialogBtn(btn1X, btnY, btnW, btnH, '重新挑战', 'cancel')
    g._dialogStartRect = [btn1X, btnY, btnW, btnH]

    R.drawDialogBtn(btn2X, btnY, btnW, btnH, '继续挑战', 'confirm')
    g._dialogContinueRect = [btn2X, btnY, btnW, btnH]
    g._dialogCancelRect = null
  } else {
    // 无存档
    ctx.fillStyle = '#6B5014'
    ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('通天塔', px + pw * 0.5, py + 30 * S)

    ctx.fillStyle = '#7B7060'
    ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('踏入通天塔，开始你的修炼之旅', px + pw * 0.5, py + 64 * S)

    const btnW = pw * 0.36, btnH = 34 * S, gap = 12 * S
    const btn1X = px + pw * 0.5 - btnW - gap * 0.5
    const btn2X = px + pw * 0.5 + gap * 0.5
    const btnY = py + 90 * S

    R.drawDialogBtn(btn1X, btnY, btnW, btnH, '取消', 'cancel')
    g._dialogCancelRect = [btn1X, btnY, btnW, btnH]

    R.drawDialogBtn(btn2X, btnY, btnW, btnH, '开始挑战', 'confirm')
    g._dialogStartRect = [btn2X, btnY, btnW, btnH]
    g._dialogContinueRect = null
  }

  ctx.restore()
}

// ===== 左下角模式切换浮钮 =====
function drawModeSwitchBtn(g) {
  const { ctx, R, W, S } = V
  const L = getLayout()
  const mode = g.titleMode || 'tower'
  const targetMode = MODE_CFG[mode].switchKey
  const targetCfg = MODE_CFG[targetMode]

  // 正方形图标：图案区 + 文字标签（参考参考图精英模式图标样式）
  const iconSize  = L.modeSwitchH          // 图案区边长（正方形）
  const labelSize = 11 * S                 // 标签文字高度
  const gap       = 4 * S
  const btnW      = iconSize               // 整体宽度 = 图标边长
  const btnH      = iconSize + gap + labelSize
  const btnX      = L.pad
  const btnY      = L.modeSwitchY

  ctx.save()

  // 半透明深色圆角背景框
  ctx.fillStyle = 'rgba(20,18,38,0.75)'
  R.rr(btnX, btnY, iconSize, iconSize, 10 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(200,180,120,0.45)'; ctx.lineWidth = 1.5 * S
  R.rr(btnX, btnY, iconSize, iconSize, 10 * S); ctx.stroke()

  // 优先使用素材图片，否则绘制 emoji 占位
  const btnImg = R.getImg('assets/ui/btn_mode_switch.png')
  const cx = btnX + iconSize / 2
  const cy = btnY + iconSize / 2
  if (btnImg && btnImg.width > 0) {
    const pad = 6 * S
    ctx.drawImage(btnImg, btnX + pad, btnY + pad, iconSize - pad * 2, iconSize - pad * 2)
  } else {
    ctx.fillStyle = 'rgba(255,210,80,0.92)'
    ctx.font = `${iconSize * 0.52}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('⇆', cx, cy)
  }

  // 文字标签（显示目标模式名称，叠在图标下方）
  const labelY = btnY + iconSize + gap + labelSize * 0.5
  ctx.fillStyle = 'rgba(255,235,160,0.95)'
  ctx.strokeStyle = 'rgba(20,10,40,0.7)'
  ctx.lineWidth = 2.5 * S
  ctx.font = `bold ${labelSize}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeText(targetCfg.name, cx, labelY)
  ctx.fillText(targetCfg.name, cx, labelY)

  g._modeSwitchRect = [btnX, btnY, btnW, btnH]
  ctx.restore()
}

// ===== ZONE 5: 底部 7 标签导航 =====
function drawBottomBar(g) {
  const { ctx, R, W, H, S } = V
  const L = getLayout()

  ctx.save()

  // 安全区补底色（图片底部颜色，防止露出其他颜色）
  ctx.fillStyle = 'rgb(48, 32, 82)'
  ctx.fillRect(0, L.bottomBarY, W, H - L.bottomBarY)

  // 导航栏背景图：向上偏移并加高，使云纹顶边凸出覆盖 bottomBarY 分界线
  const barBgImg = R.getImg('assets/ui/nav_bar_bg.png')
  if (barBgImg && barBgImg.width > 0) {
    const overlapH = 22 * S   // 向上溢出量，确保云纹峰顶完全覆盖分界线
    ctx.drawImage(barBgImg, 0, L.bottomBarY - overlapH, W, L.bottomBarH + overlapH)
  } else {
    const barGrad = ctx.createLinearGradient(0, L.bottomBarY, 0, L.bottomBarY + L.bottomBarH)
    barGrad.addColorStop(0, 'rgba(85, 65, 120, 0.92)')
    barGrad.addColorStop(1, 'rgba(48, 32, 82, 0.97)')
    ctx.fillStyle = barGrad
    ctx.fillRect(0, L.bottomBarY, W, L.bottomBarH)
  }

  // 顶部金色细线
  ctx.strokeStyle = 'rgba(220, 185, 110, 0.55)'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(0, L.bottomBarY); ctx.lineTo(W, L.bottomBarY); ctx.stroke()

  const slotW = W / BAR_ITEMS.length
  g._bottomBarRects = []

  // 判断当前选中的标签 key
  const activeKey = (() => {
    if (g.scene === 'title') return (g.titleMode === 'tower' || !g.titleMode) ? 'battle' : 'stage'
    if (g.scene === 'dex') return 'dex'
    if (g.scene === 'ranking') return 'rank'
    if (g.scene === 'stats') return 'stats'
    return ''
  })()

  for (let i = 0; i < BAR_ITEMS.length; i++) {
    const item = BAR_ITEMS[i]
    const cx = i * slotW + slotW / 2
    const isLocked = !!item.locked
    const isCenter = !!item.center
    const isActive = item.key === activeKey

    if (isCenter) {
      // 中心圆形按钮：缩小到与其他图标视觉间距一致
      const circleR = L.bottomBarH * 0.36
      const circleCY = L.bottomBarY + L.bottomBarH * 0.40

      // 选中时：外层光晕环
      if (isActive) {
        ctx.beginPath(); ctx.arc(cx, circleCY, circleR + 4 * S, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,240,120,0.9)'; ctx.lineWidth = 2.5 * S; ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, circleCY, circleR + 7 * S, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,230,80,0.3)'; ctx.lineWidth = 3 * S; ctx.stroke()
      }

      const grad = ctx.createRadialGradient(cx, circleCY, 0, cx, circleCY, circleR)
      grad.addColorStop(0, '#ffe066')
      grad.addColorStop(0.6, '#d4a84b')
      grad.addColorStop(1, '#8b6010')
      ctx.beginPath(); ctx.arc(cx, circleCY, circleR, 0, Math.PI * 2)
      ctx.fillStyle = grad; ctx.fill()
      ctx.strokeStyle = 'rgba(255,230,100,0.6)'; ctx.lineWidth = 2 * S; ctx.stroke()

      const battleImg = R.getImg('assets/ui/nav_battle.png')
      if (battleImg && battleImg.width > 0) {
        const s = circleR * 1.0
        ctx.drawImage(battleImg, cx - s, circleCY - s, s * 2, s * 2)
      } else {
        ctx.font = `${circleR * 0.9}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        ctx.fillText(item.icon, cx, circleCY)
      }

      const cLabelSize = 11 * S
      const cLabelY = L.bottomBarY + L.bottomBarH - 4 * S
      ctx.font = `bold ${cLabelSize}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.strokeStyle = 'rgba(80,40,0,0.7)'; ctx.lineWidth = 2.5 * S
      ctx.strokeText(item.label, cx, cLabelY)
      ctx.fillStyle = isActive ? '#fff799' : '#ffe566'
      ctx.fillText(item.label, cx, cLabelY)

      g._bottomBarRects.push([i * slotW, L.bottomBarY, slotW, L.bottomBarH])
    } else {
      ctx.globalAlpha = isLocked ? 0.38 : 1

      const iconSize = L.bottomBarH * 0.72
      const iconCX = cx
      const iconTop = L.bottomBarY + L.bottomBarH * 0.04
      const iconCY = iconTop + iconSize / 2

      // 选中状态：图标放大 10% + 圆形高亮背景
      const scale = isActive ? 1.10 : 1.0
      const drawSize = iconSize * scale
      const drawTop = iconCY - drawSize / 2

      if (isActive && !isLocked) {
        ctx.beginPath(); ctx.arc(iconCX, iconCY, drawSize * 0.54, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,240,160,0.18)'; ctx.fill()
        ctx.strokeStyle = 'rgba(255,230,100,0.75)'; ctx.lineWidth = 2 * S; ctx.stroke()
      }

      const navImg = item.img ? R.getImg(item.img) : null
      if (navImg && navImg.width > 0) {
        ctx.drawImage(navImg, iconCX - drawSize / 2, drawTop, drawSize, drawSize)
      } else {
        ctx.font = `${drawSize * 0.7}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        ctx.fillText(item.icon, iconCX, iconCY)
      }

      const labelSize = 11 * S
      const labelBaseline = iconTop + iconSize + labelSize * 0.35
      ctx.font = `bold ${labelSize}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.strokeStyle = 'rgba(30,15,55,0.75)'; ctx.lineWidth = 3 * S
      ctx.strokeText(item.label, cx, labelBaseline)
      ctx.fillStyle = isLocked
        ? 'rgba(210,195,240,0.5)'
        : isActive ? '#fff' : 'rgba(255,242,180,1)'
      ctx.fillText(item.label, cx, labelBaseline)
      ctx.globalAlpha = 1

      g._bottomBarRects.push([i * slotW, L.bottomBarY, slotW, L.bottomBarH])

      // 图鉴红点：图标右上角
      if (item.key === 'dex') {
        const dex = g.storage.petDex || []
        const seen = g.storage.petDexSeen || []
        if (dex.length > seen.length) {
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.arc(iconCX + iconSize * 0.42, iconCY - iconSize * 0.38, 4 * S, 0, Math.PI * 2)
          ctx.fillStyle = '#ff4444'; ctx.fill()
        }
      }
    }
  }

  // 排行按钮 rect 同步给 wxButtons
  const rankIdx = BAR_ITEMS.findIndex(b => b.key === 'rank')
  if (rankIdx >= 0) g._rankBtnRect = g._bottomBarRects[rankIdx]

  ctx.restore()
}

// ===== 「更多」弹出面板 =====
function drawMorePanel(g) {
  if (!g.showMorePanel) return

  const { ctx, R, W, H, S } = V
  const L = getLayout()

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.fillRect(0, 0, W, H)

  const panelH = 200 * S + L.safeBottom
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

  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillText('更多', W / 2, panelY + 16 * S)

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
    ctx.fillStyle = 'rgba(40,35,60,0.6)'
    R.rr(listX, itemY, listW, itemH - 4 * S, 8 * S); ctx.fill()

    ctx.fillStyle = '#e0d8c0'
    ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(item.label, listX + 12 * S, itemY + (itemH - 4 * S) / 2)

    if (item.toggle !== null && item.toggle !== undefined) {
      const swW = 40 * S, swH = 22 * S
      const swX = listX + listW - swW - 8 * S
      const swY = itemY + (itemH - 4 * S) / 2 - swH / 2

      ctx.fillStyle = item.toggle ? 'rgba(77,204,77,0.8)' : 'rgba(100,100,120,0.5)'
      R.rr(swX, swY, swW, swH, swH / 2); ctx.fill()
      const knobR = swH / 2 - 2 * S
      const knobX = item.toggle ? swX + swW - swH / 2 : swX + swH / 2
      ctx.beginPath()
      ctx.arc(knobX, swY + swH / 2, knobR, 0, Math.PI * 2)
      ctx.fillStyle = '#fff'; ctx.fill()
      g._morePanelRects[item.key] = [listX, itemY, listW, itemH - 4 * S]
    } else {
      ctx.fillStyle = 'rgba(200,180,120,0.5)'
      ctx.font = `${14*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText('›', listX + listW - 12 * S, itemY + (itemH - 4 * S) / 2)
      g._morePanelRects[item.key] = [listX, itemY, listW, itemH - 4 * S]
    }
    itemY += itemH
  }

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
  drawStartBtn(g)
  drawModeSwitchBtn(g)
  drawBottomBar(g)
  drawMorePanel(g)
  drawTitleStartDialog(g)
}

module.exports = { rTitle, getLayout, BAR_ITEMS }
