/**
 * 首页渲染 — 场景式大厅 v3
 * 布局：顶栏 / 场景区（背景+插画+Logo）/ 灵宠展示 / 开始按钮区 / 模式切换浮钮 / 7标签底部导航
 */
const V = require('./env')
const P = require('../platform')

const { BAR_ITEMS, getLayout, drawBottomBar } = require('./bottomBar')

// 模式配置
const MODE_CFG = {
  tower: { name: '通天塔',  img: 'assets/ui/tower_rogue.png', icon: '⚔',  switchKey: 'stage' },
  stage: { name: '灵兽秘境', img: 'assets/ui/gate_stage.png', icon: '🏯', switchKey: 'tower' },
}

// ===== ZONE 1: 顶栏（游戏标题Logo）=====
function drawTopBar(g) {
  const { ctx, R, W, S, safeTop } = V
  const logoImg = R.getImg('assets/ui/title_logo.png')
  if (logoImg && logoImg.width > 0) {
    const logoH = 56 * S
    const logoW = logoH * (logoImg.width / logoImg.height)
    const logoX = (W - logoW) / 2
    const logoY = safeTop + 10 * S
    ctx.save()
    ctx.globalAlpha = 1
    ctx.drawImage(logoImg, logoX, logoY, logoW, logoH)
    ctx.restore()
  }
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

}

// ===== ZONE 3: 人物头像+等级（左上角常驻）=====
function drawAvatarWidget(g) {
  const { ctx, R, W, S, safeTop } = V
  const cult = g.storage.cultivation
  const level = (cult && cult.level) || 0

  const selectedId = g.storage.selectedAvatar || 'boy1'
  const CHAR_MAP = {
    boy1:  'assets/hero/char_boy1.png',
    girl1: 'assets/hero/char_girl1.png',
    boy2:  'assets/hero/char_boy2.png',
    girl2: 'assets/hero/char_girl2.png',
    boy3:  'assets/hero/char_boy3.png',
    girl3: 'assets/hero/char_girl3.png',
  }
  const sitPath = CHAR_MAP[selectedId] || CHAR_MAP.boy1

  const iconSz = 44 * S
  const iconX = 10 * S
  const iconY = safeTop + 6 * S
  const iconCX = iconX + iconSz / 2
  const iconCY = iconY + iconSz / 2

  ctx.save()

  // 1. 头像圆形裁剪
  const img = R.getImg(sitPath)
  if (img && img.width > 0) {
    ctx.save()
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconSz / 2, 0, Math.PI * 2); ctx.clip()
    const cropSz = Math.min(img.width, img.height * 0.60)
    const srcX = (img.width - cropSz) / 2
    ctx.drawImage(img, srcX, 0, cropSz, cropSz, iconX, iconY, iconSz, iconSz)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(180,150,80,0.5)'
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconSz / 2, 0, Math.PI * 2); ctx.fill()
  }

  // 2. 圆形头像框
  const frameImg = R.getImg('assets/ui/frame_avatar.png')
  if (frameImg && frameImg.width > 0) {
    const frameSz = iconSz * 1.22
    ctx.drawImage(frameImg, iconCX - frameSz / 2, iconCY - frameSz / 2, frameSz, frameSz)
  } else {
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconSz / 2, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(220,180,60,0.9)'; ctx.lineWidth = 2 * S; ctx.stroke()
  }

  // 3. 等级标签（右下角偏右，不遮头像）
  const lvText = `Lv.${level}`
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const lvTxtW = ctx.measureText(lvText).width
  const padX = 7 * S
  const capW = lvTxtW + padX * 2
  const capH = 20 * S
  const capR = capH / 2
  // 胶囊左端从头像右边缘开始，整体在头像外侧偏下
  const capCX = iconX + iconSz + capW / 2 - 4 * S
  const capCY = iconCY + iconSz * 0.28
  const capX = capCX - capW / 2
  const capY = capCY - capH / 2

  ctx.beginPath()
  ctx.moveTo(capX + capR, capY); ctx.lineTo(capX + capW - capR, capY)
  ctx.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
  ctx.lineTo(capX + capW, capY + capH - capR)
  ctx.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
  ctx.lineTo(capX + capR, capY + capH)
  ctx.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
  ctx.lineTo(capX, capY + capR)
  ctx.quadraticCurveTo(capX, capY, capX + capR, capY)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,0.52)'; ctx.fill()
  ctx.strokeStyle = 'rgba(220,185,60,0.6)'; ctx.lineWidth = 1 * S; ctx.stroke()

  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2 * S; ctx.shadowOffsetY = 1 * S
  ctx.strokeStyle = 'rgba(30,15,0,0.7)'; ctx.lineWidth = 2.5 * S
  ctx.strokeText(lvText, capCX, capCY)
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#fff8cc'
  ctx.fillText(lvText, capCX, capCY)

  ctx.restore()
}

// ===== ZONE 3b: 体力显示（左上角，仅灵兽秘境模式）=====
function drawStaminaBar(g) {
  if ((g.titleMode || 'tower') !== 'stage') return

  const { ctx, R, S, safeTop } = V
  const stamina = g.storage.currentStamina
  const maxSt = g.storage.maxStamina

  const iconSz = 32 * S
  const iconX = 10 * S
  // 头像高度 44S + 间距6S 之后
  const centerY = safeTop + 6 * S + 44 * S + 10 * S + iconSz / 2

  const stIcon = R.getImg('assets/ui/icon_stamina.png')

  // 量文字
  const txt = `${stamina}/${maxSt}`
  ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  const txtW = ctx.measureText(txt).width
  const padX = 8 * S
  const capH = 26 * S, capR = capH / 2
  const txtX = iconX + iconSz + 4 * S
  const capX = iconX + iconSz * 0.38
  const capW = txtX + txtW + padX - capX
  const capY = centerY - capH / 2

  ctx.save()
  // 画胶囊
  ctx.beginPath()
  ctx.moveTo(capX + capR, capY); ctx.lineTo(capX + capW - capR, capY)
  ctx.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
  ctx.lineTo(capX + capW, capY + capH - capR)
  ctx.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
  ctx.lineTo(capX + capR, capY + capH)
  ctx.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
  ctx.lineTo(capX, capY + capR)
  ctx.quadraticCurveTo(capX, capY, capX + capR, capY)
  ctx.closePath()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill()

  // 数字
  ctx.fillStyle = '#fff'
  ctx.fillText(txt, txtX, centerY)

  // 图标压上去
  if (stIcon && stIcon.width > 0) {
    ctx.drawImage(stIcon, iconX, centerY - iconSz / 2, iconSz, iconSz)
  } else {
    ctx.fillStyle = '#3aaeff'; ctx.font = `${14*S}px sans-serif`
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
    ctx.fillText('⚡', iconX, centerY)
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
    // 灵兽秘境模式
    const btnW = W * 0.55
    const btnH = L.startBtnH
    const btnX = (W - btnW) / 2
    const btnY = L.startBtnY
    const poolCount = g.storage.petPoolCount
    const canPlay = poolCount >= 5

    if (canPlay) {
      // 可游玩：使用 btn_start.png，fallback 蓝色渐变
      const btnImg = R.getImg('assets/ui/btn_start.png')
      if (btnImg && btnImg.width > 0) {
        ctx.drawImage(btnImg, btnX, btnY, btnW, btnH)
      } else {
        const grad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
        grad.addColorStop(0, '#8ac8ff'); grad.addColorStop(1, '#4a8acc')
        ctx.fillStyle = grad
        R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); ctx.fill()
      }
      ctx.fillStyle = '#1a2a3c'
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('选择关卡', btnX + btnW / 2, btnY + btnH / 2)
      g._startBtnRect = [btnX, btnY, btnW, btnH]
    } else {
      // 未解锁
      ctx.fillStyle = 'rgba(100,100,120,0.35)'
      R.rr(btnX, btnY, btnW, btnH, btnH * 0.4); ctx.fill()
      ctx.fillStyle = 'rgba(140,140,160,0.6)'
      ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`🔒 灵宠池需 ${5 - poolCount} 只解锁`, btnX + btnW / 2, btnY + btnH / 2)
      g._startBtnRect = null
    }
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

// ===== 左侧居中模式切换浮钮 =====
function drawModeSwitchBtn(g) {
  const { ctx, R, W, H, S, safeTop } = V
  const L = getLayout()
  const mode = g.titleMode || 'tower'
  const targetMode = MODE_CFG[mode].switchKey
  const targetCfg = MODE_CFG[targetMode]

  // 竖排布局：图标 + 文字，贴屏幕左边缘垂直居中（场景区中央）
  const iconSize  = 44 * S
  const labelSize = 11 * S
  const vGap      = 4 * S
  const btnW      = iconSize + 8 * S
  const btnH      = iconSize + vGap + labelSize + 8 * S

  // 垂直居中于场景区（顶栏底到开始按钮之间）
  const sceneTop    = safeTop + 36 * S
  const sceneBottom = L.startBtnY
  const btnCY       = (sceneTop + sceneBottom) / 2
  const btnX        = 0
  const btnY        = btnCY - btnH / 2
  const icx         = btnX + btnW / 2
  const icy         = btnY + 8 * S + iconSize / 2

  ctx.save()

  // 半透明胶囊背景（右侧半圆，左侧贴边）
  const bgR = btnW / 2
  ctx.beginPath()
  ctx.moveTo(btnX, btnY)
  ctx.lineTo(btnX + btnW - bgR, btnY)
  ctx.quadraticCurveTo(btnX + btnW, btnY, btnX + btnW, btnY + bgR)
  ctx.lineTo(btnX + btnW, btnY + btnH - bgR)
  ctx.quadraticCurveTo(btnX + btnW, btnY + btnH, btnX + btnW - bgR, btnY + btnH)
  ctx.lineTo(btnX, btnY + btnH)
  ctx.closePath()
  ctx.fillStyle = 'rgba(255,245,220,0.82)'; ctx.fill()
  ctx.strokeStyle = 'rgba(200,165,60,0.7)'; ctx.lineWidth = 1.5 * S; ctx.stroke()

  // 切换图标
  const btnImg = R.getImg('assets/ui/btn_mode_switch.png')
  if (btnImg && btnImg.width > 0) {
    const drawSz = iconSize * 0.75
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.3)'
    ctx.shadowBlur = 3 * S; ctx.shadowOffsetY = 1.5 * S
    ctx.drawImage(btnImg, icx - drawSz / 2, icy - drawSz / 2, drawSz, drawSz)
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(160,110,30,0.9)'
    ctx.font = `${iconSize * 0.5}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('⇆', icx, icy)
  }

  // 文字标签
  const labelY = icy + iconSize / 2 + vGap + labelSize * 0.5
  ctx.fillStyle = '#7a5520'
  ctx.strokeStyle = 'rgba(255,245,220,0.8)'
  ctx.lineWidth = 2 * S
  ctx.font = `bold ${labelSize}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeText(targetCfg.name, icx, labelY)
  ctx.fillText(targetCfg.name, icx, labelY)

  g._modeSwitchRect = [btnX, btnY, btnW, btnH]
  ctx.restore()
}

// ===== 右下角侧边栏复访入口（抖音专属） =====
function _isFromSidebar() {
  const info = GameGlobal.__launchInfo || {}
  return info.scene === '021036' && info.launch_from === 'homepage' && info.location === 'sidebar_card'
}

function drawSidebarBtn(g) {
  if (!P.isDouyin || !GameGlobal.__sidebarSupported) { g._sidebarBtnRect = null; return }

  const { ctx, R, W, S } = V
  const L = getLayout()

  const iconSize = L.modeSwitchH * 0.72
  const labelSize = 11 * S
  const vGap = 3 * S
  const btnH = iconSize + vGap + labelSize
  const btnW = iconSize
  const btnX = W - L.pad - btnW + 4 * S
  const btnY = L.modeSwitchY - 6 * S

  ctx.save()

  ctx.fillStyle = 'rgba(20,18,38,0.75)'
  R.rr(btnX, btnY, btnW, iconSize, 8 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(200,180,120,0.45)'; ctx.lineWidth = 1.5 * S
  R.rr(btnX, btnY, btnW, iconSize, 8 * S); ctx.stroke()

  const claimed = g.storage.sidebarRewardClaimedToday
  const fromSB = _isFromSidebar()
  const hasReward = fromSB && !claimed

  const icx = btnX + btnW / 2
  const icy = btnY + iconSize / 2
  ctx.font = `${iconSize * 0.44}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = hasReward ? 'rgba(255,80,80,0.95)' : 'rgba(255,210,80,0.92)'
  ctx.fillText(hasReward ? '🎁' : '📌', icx, icy)

  if (hasReward) {
    const dotR = 5 * S
    ctx.beginPath()
    ctx.arc(btnX + btnW - 2 * S, btnY + 2 * S, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#ff3333'
    ctx.fill()
  }

  const labelY = btnY + iconSize + vGap + labelSize * 0.5
  ctx.fillStyle = 'rgba(255,235,160,0.95)'
  ctx.strokeStyle = 'rgba(20,10,40,0.7)'
  ctx.lineWidth = 2.5 * S
  ctx.font = `bold ${labelSize}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.strokeText('侧边栏', icx, labelY)
  ctx.fillText('侧边栏', icx, labelY)

  g._sidebarBtnRect = [btnX, btnY, btnW, btnH]
  ctx.restore()
}

// ===== 侧边栏复访引导弹窗 =====
function drawSidebarPanel(g) {
  if (!g.showSidebarPanel) return

  const { ctx, R, W, H, S } = V
  const fromSB = _isFromSidebar()
  const claimed = g.storage.sidebarRewardClaimedToday
  const canClaim = fromSB && !claimed

  ctx.save()

  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)

  const pw = W * 0.78, ph = 200 * S
  const px = (W - pw) / 2, py = (H - ph) / 2 - 20 * S

  const bgGrad = ctx.createLinearGradient(px, py, px, py + ph)
  bgGrad.addColorStop(0, 'rgba(45,30,80,0.97)')
  bgGrad.addColorStop(1, 'rgba(25,15,50,0.97)')
  ctx.fillStyle = bgGrad
  R.rr(px, py, pw, ph, 14 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(220,185,110,0.6)'; ctx.lineWidth = 2 * S
  R.rr(px, py, pw, ph, 14 * S); ctx.stroke()

  ctx.fillStyle = '#ffe8a0'
  ctx.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('侧边栏复访奖励', W / 2, py + 28 * S)

  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = `${12 * S}px "PingFang SC",sans-serif`

  if (canClaim) {
    ctx.fillText('你从侧边栏进入了游戏！', W / 2, py + 56 * S)
    ctx.fillStyle = '#ffcc44'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.fillText('🎁 奖励：体力 +30', W / 2, py + 84 * S)

    const btnW2 = pw * 0.55, btnH2 = 38 * S
    const btnX2 = (W - btnW2) / 2, btnY2 = py + ph - 56 * S
    R.drawDialogBtn(btnX2, btnY2, btnW2, btnH2, '领取奖励', 'confirm')
    g._sidebarClaimRect = [btnX2, btnY2, btnW2, btnH2]
    g._sidebarGoRect = null
  } else if (claimed) {
    ctx.fillText('今日奖励已领取，明天再来吧~', W / 2, py + 64 * S)
    ctx.fillStyle = '#aaa'
    ctx.font = `${11 * S}px "PingFang SC",sans-serif`
    ctx.fillText('每天从抖音首页侧边栏进入游戏', W / 2, py + 90 * S)
    ctx.fillText('即可领取体力奖励', W / 2, py + 108 * S)
    g._sidebarClaimRect = null
    g._sidebarGoRect = null
  } else {
    ctx.fillText('① 点击下方按钮前往侧边栏', W / 2, py + 54 * S)
    ctx.fillText('② 在侧边栏找到本游戏并点击进入', W / 2, py + 74 * S)
    ctx.fillText('③ 返回后即可领取体力奖励', W / 2, py + 94 * S)

    const btnW2 = pw * 0.55, btnH2 = 38 * S
    const btnX2 = (W - btnW2) / 2, btnY2 = py + ph - 56 * S
    R.drawDialogBtn(btnX2, btnY2, btnW2, btnH2, '去首页侧边栏', 'confirm')
    g._sidebarGoRect = [btnX2, btnY2, btnW2, btnH2]
    g._sidebarClaimRect = null
  }

  const closeSize = 28 * S
  const closeX = px + pw - closeSize - 4 * S, closeY = py + 4 * S
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.font = `${18 * S}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✕', closeX + closeSize / 2, closeY + closeSize / 2)
  g._sidebarCloseRect = [closeX, closeY, closeSize, closeSize]

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

  ctx.fillStyle = 'rgba(255,248,230,0.98)'
  ctx.beginPath()
  ctx.moveTo(0, panelY + rad)
  ctx.arcTo(0, panelY, rad, panelY, rad)
  ctx.lineTo(W - rad, panelY)
  ctx.arcTo(W, panelY, W, panelY + rad, rad)
  ctx.lineTo(W, H); ctx.lineTo(0, H)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.5)'; ctx.lineWidth = 1.5 * S
  ctx.stroke()

  ctx.fillStyle = '#8B6914'
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

// ===== 宝箱浮钮（右下角，与模式切换左右对称） =====
// ===== 宝箱浮钮（右上角，顶栏旁边）=====
function drawChestBtn(g) {
  const { ctx, R, W, S, safeTop } = V
  const { getUnclaimedCount } = require('../data/chestConfig')

  // 图标尺寸：避开右上角系统按钮（...），下移至其下方
  const btnSz = 48 * S
  const btnX = W - btnSz - 10 * S
  const btnY = safeTop + 52 * S

  ctx.save()

  // 点击缩放动画：按下 → 弹起回弹
  const pressAge = g._chestPressTime ? (Date.now() - g._chestPressTime) : 9999
  let pressScale = 1.0
  if (pressAge < 120) {
    // 0~120ms：压下，scale 1→0.82
    pressScale = 1.0 - 0.18 * (pressAge / 120)
  } else if (pressAge < 300) {
    // 120~300ms：弹起回弹，用 sin 模拟弹性
    pressScale = 0.82 + 0.25 * Math.sin(Math.PI * (pressAge - 120) / 180)
  }

  const cx = btnX + btnSz / 2
  const cy = btnY + btnSz / 2
  ctx.translate(cx, cy)
  ctx.scale(pressScale, pressScale)
  ctx.translate(-cx, -cy)

  const chestImg = R.getImg('assets/ui/icon_chest.png')
  if (chestImg && chestImg.width > 0) {
    ctx.drawImage(chestImg, btnX, btnY, btnSz, btnSz)
  } else {
    // fallback：绘制圆形背景 + emoji
    ctx.fillStyle = 'rgba(20,18,38,0.75)'
    R.rr(btnX, btnY, btnSz, btnSz, 8 * S); ctx.fill()
    ctx.font = `${btnSz * 0.55}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🎁', btnX + btnSz / 2, btnY + btnSz / 2)
  }

  // 红点 + 数字（右上角）
  const count = getUnclaimedCount(g.storage)
  if (count > 0) {
    const dotR = 8 * S
    const dotX = btnX + btnSz - dotR * 0.5
    const dotY = btnY + dotR * 0.5
    ctx.beginPath()
    ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2)
    ctx.fillStyle = '#ff3333'
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(String(count), dotX, dotY)
  }

  g._chestBtnRect = [btnX, btnY, btnSz, btnSz]
  ctx.restore()
}


// ===== 主入口 =====
function rTitle(g) {
  drawSceneArea(g)
  drawTopBar(g)
  drawStartBtn(g)
  drawModeSwitchBtn(g)
  drawChestBtn(g)
  drawSidebarBtn(g)
  drawBottomBar(g)
  drawAvatarWidget(g)
  drawStaminaBar(g)
  drawMorePanel(g)
  drawTitleStartDialog(g)
  drawSidebarPanel(g)
}

module.exports = { rTitle, getLayout, BAR_ITEMS, drawBottomBar }
