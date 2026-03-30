/**
 * 底部 7 标签导航栏 + 布局计算
 * 从 titleView.js 抽出，避免 titleView ↔ cultivationView 循环依赖
 */
const V = require('./env')

// 底部 7 标签定义（index=3 为中心凸起按钮）
const BAR_ITEMS = [
  { key: 'cultivation', label: '修炼', icon: '☯', img: 'assets/ui/nav_hero.png' },
  { key: 'pets',   label: '灵宠',  icon: '🐾', img: 'assets/ui/nav_icons.png' },
  { key: 'dex',    label: '图鉴',  icon: '📖', img: 'assets/ui/nav_dex.png' },
  { key: 'stage', label: '秘境',  icon: '🏯',  center: true },
  { key: 'rank',   label: '排行',  icon: '🏆', img: 'assets/ui/nav_rank.png' },
  { key: 'stats',  label: '统计',  icon: '📊', img: 'assets/ui/nav_stats.png' },
  { key: 'more',   label: '更多',  icon: '⚙',  img: 'assets/ui/nav_more.png' },
]

// ===== 布局计算（从底部反推）=====
function getLayout() {
  const { W, H, S, safeTop } = V
  const safeBottom = 10 * S

  const topBarH     = 48 * S + 42 * S + 42 * S + 8 * S   // 状态栏行(48+42) + Logo(42) + 间距(8)
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
  if (!g._namedRects) g._namedRects = {}

  // key → highlightId 映射（供引导系统使用）
  const _KEY_TO_NAV = { cultivation: 'nav_cult', pets: 'nav_pet', dex: 'nav_dex', stage: 'nav_stage', rank: 'nav_rank' }

  // 判断当前选中的标签 key
  const activeKey = (() => {
    if (g.scene === 'title') return (g.titleMode === 'tower' || !g.titleMode) ? 'battle' : 'stage'
    if (g.scene === 'cultivation') return 'cultivation'
    if (g.scene === 'petPool') return 'pets'
    if (g.scene === 'dex') return 'dex'
    if (g.scene === 'ranking') return 'rank'
    if (g.scene === 'stats') return 'stats'
    return ''
  })()

  for (let i = 0; i < BAR_ITEMS.length; i++) {
    const item = BAR_ITEMS[i]
    const cx = i * slotW + slotW / 2
    // 灵宠 & 图鉴：战斗中获得首只三星永久宠物后同时解锁
    const hasPet = g.storage.petPoolCount >= 1
    const isLocked = item.key === 'pets'
      ? !hasPet
      : item.key === 'dex'
        ? !hasPet
        : !!item.locked
    const isCenter = !!item.center
    const isActive = item.key === activeKey

    if (isCenter) {
      // 中心圆形按钮：缩小到与其他图标视觉间距一致
      const circleR = L.bottomBarH * 0.36
      const circleCY = L.bottomBarY + L.bottomBarH * 0.40

      const grad = ctx.createRadialGradient(cx, circleCY, 0, cx, circleCY, circleR)
      grad.addColorStop(0, '#ffe066')
      grad.addColorStop(0.6, '#d4a84b')
      grad.addColorStop(1, '#8b6010')

      // 选中时：整个按钮带发光绘制
      if (isActive) {
        ctx.save()
        ctx.shadowColor = '#FFE080'
        ctx.shadowBlur = 22 * S
        ctx.beginPath(); ctx.arc(cx, circleCY, circleR, 0, Math.PI * 2)
        ctx.fillStyle = grad; ctx.fill()
        ctx.restore()
      } else {
        ctx.beginPath(); ctx.arc(cx, circleCY, circleR, 0, Math.PI * 2)
        ctx.fillStyle = grad; ctx.fill()
      }
      ctx.beginPath(); ctx.arc(cx, circleCY, circleR, 0, Math.PI * 2)
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

      const _cRect = [i * slotW, L.bottomBarY, slotW, L.bottomBarH]
      g._bottomBarRects.push(_cRect)
      if (_KEY_TO_NAV[item.key]) g._namedRects[_KEY_TO_NAV[item.key]] = { x: _cRect[0], y: _cRect[1], w: _cRect[2], h: _cRect[3] }
    } else {
      ctx.globalAlpha = isLocked ? 0.38 : 1

      const iconSize = L.bottomBarH * 0.72
      const iconCX = cx
      const iconTop = L.bottomBarY + L.bottomBarH * 0.04
      const iconCY = iconTop + iconSize / 2

      // 选中状态：图标放大 + 外轮廓发光
      const scale = isActive ? 1.12 : 1.0
      const drawSize = iconSize * scale
      const drawTop = iconCY - drawSize / 2

      const navImg = item.img ? R.getImg(item.img) : null
      if (navImg && navImg.width > 0) {
        if (isActive && !isLocked) {
          ctx.save()
          ctx.shadowColor = '#FFE080'
          ctx.shadowBlur = 18 * S
          ctx.drawImage(navImg, iconCX - drawSize / 2, drawTop, drawSize, drawSize)
          ctx.restore()
        }
        ctx.drawImage(navImg, iconCX - drawSize / 2, drawTop, drawSize, drawSize)
      } else {
        ctx.font = `${drawSize * 0.7}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillStyle = '#fff'
        ctx.fillText(item.icon, iconCX, iconCY)
      }

      // locked 项右下角叠加锁图标
      if (isLocked) {
        const lockImg = R.getImg('assets/ui/lock.png')
        const lockSz = drawSize * 0.36
        if (lockImg && lockImg.width > 0) {
          ctx.globalAlpha = 0.85
          ctx.drawImage(lockImg, iconCX + drawSize * 0.12, drawTop + drawSize * 0.58, lockSz, lockSz)
          ctx.globalAlpha = isLocked ? 0.38 : 1
        }
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

      const _nRect = [i * slotW, L.bottomBarY, slotW, L.bottomBarH]
      g._bottomBarRects.push(_nRect)
      if (_KEY_TO_NAV[item.key]) g._namedRects[_KEY_TO_NAV[item.key]] = { x: _nRect[0], y: _nRect[1], w: _nRect[2], h: _nRect[3] }

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
      // 灵宠池红点：有宠物可升星或有派遣可收取时显示
      if (item.key === 'pets' && !isLocked) {
        const { POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ } = require('../data/petPoolConfig')
        const pool = g.storage.petPool || []
        const hasUpgradeable = pool.some(p => {
          const nextStar = (p.star || 1) + 1
          const fragCost = POOL_STAR_FRAG_COST[nextStar]
          const lvReq = POOL_STAR_LV_REQ[nextStar]
          return fragCost && lvReq && p.fragments >= fragCost && p.level >= lvReq
        })
        const hasIdleReward = g.storage.idleHasReward()
        if (hasUpgradeable || hasIdleReward) {
          ctx.globalAlpha = 1
          ctx.beginPath()
          ctx.arc(iconCX + iconSize * 0.42, iconCY - iconSize * 0.38, 4 * S, 0, Math.PI * 2)
          ctx.fillStyle = '#ff4444'; ctx.fill()
        }
      }
      // 修炼红点：有可升级项时显示
      if (item.key === 'cultivation') {
        const { hasCultUpgradeAvailable } = require('../logic/cultivationLogic')
        if (hasCultUpgradeAvailable(g.storage)) {
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

/**
 * 统一页面标题绘制：name_bg 背景图 + 深棕文字
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} R  资源管理器
 * @param {number} W  屏幕宽度
 * @param {number} S  缩放系数
 * @param {number} centerX  标题中心 X（通常 W/2）
 * @param {number} centerY  标题中心 Y
 * @param {string} text     标题文字
 */
function drawPageTitle(ctx, R, W, S, centerX, centerY, text) {
  const nameBg = R.getImg('assets/ui/name_bg.png')
  const bgH = 48 * S
  const bgW = nameBg && nameBg.width > 0
    ? bgH * (nameBg.width / nameBg.height)
    : 180 * S
  ctx.save()
  if (nameBg && nameBg.width > 0) {
    ctx.drawImage(nameBg, centerX - bgW / 2, centerY - bgH / 2, bgW, bgH)
  }
  ctx.fillStyle = '#3a1a00'
  ctx.font = `bold ${18 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, centerX, centerY)
  ctx.restore()
}

module.exports = { BAR_ITEMS, getLayout, drawBottomBar, drawPageTitle }
