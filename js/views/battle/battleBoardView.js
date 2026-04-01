/**
 * 战斗棋盘渲染：格子、珠子、消除动画、拖拽效果、属性覆盖条、波次过渡
 */
const V = require('../env')
const { ATTRS, ATTR_COLOR, BEAD_ATTR_COLOR } = require('../../data/tower')
const Particles = require('../../engine/particles')
const FXComposer = require('../../engine/effectComposer')
const { getNewbieHighlightCells } = require('./battleNewbieGuide')

// ===== 拖拽转珠倒计时环 =====
function _drawDragTimer(g, cellSize, boardTop) {
  const { ctx, S } = V
  const pct = Math.max(0, Math.min(1, (g.dragTimeLimit - g.dragTimer) / g.dragTimeLimit))
  const barColor = pct < 0.25 ? '#ff4d6a' : pct < 0.5 ? '#ff8c00' : '#4dcc4d'

  // 珠子周围进度环
  const ringR = (g.cellSize - g.cellSize*0.08*2) * 0.5 + 6*S
  const cx = g.dragCurX, cy = g.dragCurY
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 4*S
  ctx.beginPath()
  ctx.arc(cx, cy, ringR, 0, Math.PI*2)
  ctx.stroke()
  const startAngle = -Math.PI/2
  const endAngle = startAngle + Math.PI*2 * pct
  ctx.strokeStyle = barColor
  ctx.lineWidth = 4*S
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, ringR, startAngle, endAngle)
  ctx.stroke()
  ctx.restore()
}

// ===== 敌方回合过渡横条（画面顶部，不遮挡血条） =====
function _drawEnemyTurnBanner(g) {
  const { ctx, R, W, H, S, safeTop } = V
  const pea = g._pendingEnemyAtk
  if (!pea) return
  const p = Math.min(1, pea.timer / 16)
  const bannerH = 38*S
  // 定位在画面顶部安全区下方
  const bannerY = safeTop + 8*S
  ctx.save()
  // 从右侧滑入
  const slideX = (1 - p) * W * 0.4
  ctx.translate(slideX, 0)
  ctx.globalAlpha = Math.min(1, p * 1.5)
  // 半透明暗条
  const bgGrd = ctx.createLinearGradient(0, bannerY - 6*S, 0, bannerY + bannerH + 6*S)
  bgGrd.addColorStop(0, 'transparent')
  bgGrd.addColorStop(0.12, 'rgba(120,20,15,0.8)')
  bgGrd.addColorStop(0.5, 'rgba(90,10,10,0.9)')
  bgGrd.addColorStop(0.88, 'rgba(120,20,15,0.8)')
  bgGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = bgGrd
  ctx.fillRect(0, bannerY - 6*S, W, bannerH + 12*S)
  // 左右红色光条
  ctx.fillStyle = 'rgba(255,50,30,0.85)'
  ctx.fillRect(0, bannerY, 4*S, bannerH)
  ctx.fillStyle = 'rgba(255,50,30,0.65)'
  ctx.fillRect(W - 4*S, bannerY, 4*S, bannerH)
  // 两侧速度线
  ctx.save()
  ctx.globalAlpha = Math.min(1, p * 2) * 0.4
  ctx.strokeStyle = '#ff6644'; ctx.lineWidth = 1.5*S
  for (let i = 0; i < 6; i++) {
    const ly = bannerY + 4*S + i * (bannerH - 8*S) / 5
    const lOffset = Math.sin(pea.timer * 0.3 + i * 0.8) * 15*S
    ctx.beginPath(); ctx.moveTo(8*S + lOffset, ly); ctx.lineTo(40*S + lOffset, ly); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W - 8*S - lOffset, ly); ctx.lineTo(W - 40*S - lOffset, ly); ctx.stroke()
  }
  ctx.restore()
  // 文字（加大字号 + 粗描边 + 脉动）
  const textPulse = 1 + Math.sin(pea.timer * 0.25) * 0.06
  ctx.save()
  ctx.translate(W*0.5, bannerY + bannerH/2)
  ctx.scale(textPulse, textPulse)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  // 深色描边确保可读性
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3.5*S
  ctx.strokeText('敌 方 回 合', 0, 0)
  ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 12*S
  ctx.fillStyle = '#ffccaa'
  ctx.fillText('敌 方 回 合', 0, 0)
  ctx.shadowBlur = 0
  ctx.restore()
  ctx.restore()
}

// ===== 属性覆盖指示条（宠物栏下方，HP条与棋盘之间） =====
function _drawAttrCoverageBar(g, topY, boardTop, padX) {
  const { ctx, R, W, S } = V
  const barH = boardTop - topY
  if (barH < 6 * S) return
  const teamAttrs = _getTeamAttrSet(g)
  const orbR = Math.min(barH * 0.36, 7 * S)
  const gap = 10 * S
  const totalW = ATTRS.length * orbR * 2 + (ATTRS.length - 1) * gap
  let x = (W - totalW) / 2 + orbR

  ctx.save()
  for (let i = 0; i < ATTRS.length; i++) {
    const a = ATTRS[i]
    const covered = teamAttrs.has(a)
    const ac = ATTR_COLOR[a]
    const cy = topY + barH / 2

    if (covered) {
      // 有效属性：属性色珠子 + 迷你⚔
      ctx.globalAlpha = 0.9
      R.drawBead(x, cy, orbR, a, g.af)
      // 右上角迷你⚔标记
      const mkSz = orbR * 0.5, mkX = x + orbR * 0.55, mkY = cy - orbR * 0.55
      ctx.fillStyle = ac.main
      ctx.globalAlpha = 0.85
      ctx.font = `bold ${mkSz * 1.6}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowColor = ac.main; ctx.shadowBlur = 2 * S
      ctx.fillText('⚔', mkX, mkY)
      ctx.shadowBlur = 0
    } else {
      // 未覆盖：灰色半透明珠子 + ✕
      ctx.globalAlpha = 0.3
      R.drawBead(x, cy, orbR, a, 0)
      ctx.globalAlpha = 0.7
      const mkSz = orbR * 0.8
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5 * S
      ctx.beginPath()
      ctx.moveTo(x - mkSz * 0.4, cy - mkSz * 0.4)
      ctx.lineTo(x + mkSz * 0.4, cy + mkSz * 0.4)
      ctx.moveTo(x + mkSz * 0.4, cy - mkSz * 0.4)
      ctx.lineTo(x - mkSz * 0.4, cy + mkSz * 0.4)
      ctx.stroke()
    }
    x += orbR * 2 + gap
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ===== 珠子有效性标记（剑=攻击 / +=回复） =====
function _drawOrbIndicator(ctx, cellX, cellY, cs, beadR, attr, frame, S) {
  const iconSz = cs * 0.32
  const icx = cellX + cs - iconSz * 0.5 - cs * 0.04
  const icy = cellY + cs - iconSz * 0.5 - cs * 0.04
  const pulse = 0.75 + 0.2 * Math.sin(frame * 0.06)

  ctx.save()
  ctx.globalAlpha = pulse

  // 半透明深色圆底
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath(); ctx.arc(icx, icy, iconSz * 0.5, 0, Math.PI * 2); ctx.fill()

  if (attr === 'heart') {
    ctx.fillStyle = '#ff99cc'
    ctx.shadowColor = '#ff69b4'; ctx.shadowBlur = 3 * S
    ctx.font = `bold ${iconSz * 0.8}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('+', icx, icy + 0.5 * S)
  } else {
    // 攻击属性：简洁的剑（45°斜置，粗线条，属性色）
    const ac = ATTR_COLOR[attr] || BEAD_ATTR_COLOR[attr]
    const color = (ac && ac.lt) || (ac && ac.main) || '#fff'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.shadowColor = color; ctx.shadowBlur = 2 * S
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const sz = iconSz * 0.35
    // 45°旋转绘制
    ctx.save()
    ctx.translate(icx, icy)
    ctx.rotate(-Math.PI / 4)
    // 剑刃（粗竖线，从上到中）
    ctx.lineWidth = 2.2 * S
    ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(0, sz * 0.3); ctx.stroke()
    // 剑尖（三角形顶端）
    ctx.beginPath()
    ctx.moveTo(0, -sz - 1.5 * S)
    ctx.lineTo(-2 * S, -sz + 2.5 * S)
    ctx.lineTo(2 * S, -sz + 2.5 * S)
    ctx.closePath()
    ctx.fill()
    // 护手（短横线）
    ctx.lineWidth = 2 * S
    ctx.beginPath(); ctx.moveTo(-sz * 0.5, sz * 0.15); ctx.lineTo(sz * 0.5, sz * 0.15); ctx.stroke()
    // 剑柄（短粗线）
    ctx.lineWidth = 2.5 * S
    ctx.beginPath(); ctx.moveTo(0, sz * 0.25); ctx.lineTo(0, sz * 0.75); ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}
// ===== 队伍属性覆盖集（每帧缓存） =====
let _teamAttrSetCache = null
let _teamAttrSetFrame = -1

function _getTeamAttrSet(g) {
  if (_teamAttrSetFrame === g.af && _teamAttrSetCache) return _teamAttrSetCache
  const s = new Set()
  if (g.pets) g.pets.forEach(p => { if (p && p.attr) s.add(p.attr) })
  _teamAttrSetCache = s
  _teamAttrSetFrame = g.af
  return s
}
// ===== 棋盘 =====
function drawBoard(g) {
  const { ctx, R, TH, W, H, S, COLS, ROWS } = V
  const cs = g.cellSize, bx = g.boardX, by = g.boardY
  const boardW = COLS * cs, boardH = ROWS * cs
  const _nbHighlight = getNewbieHighlightCells(g)
  const teamAttrs = _getTeamAttrSet(g)

  ctx.fillStyle = 'rgba(8,8,18,0.85)'
  R.rr(bx-3*S, by-3*S, boardW+6*S, boardH+6*S, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(80,80,120,0.5)'; ctx.lineWidth = 1.5*S
  R.rr(bx-3*S, by-3*S, boardW+6*S, boardH+6*S, 6*S); ctx.stroke()

  const tileDark = R.getImg('assets/backgrounds/board_bg_dark1.jpg')
  const tileLight = R.getImg('assets/backgrounds/board_bg_light1.jpg')

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = bx + c*cs, y = by + r*cs
      const isDark = (r+c)%2===0
      const tileImg = isDark ? tileDark : tileLight
      if (tileImg && tileImg.width > 0) {
        ctx.drawImage(tileImg, x, y, cs, cs)
      } else {
        ctx.fillStyle = isDark ? 'rgba(28,28,48,0.9)' : 'rgba(18,18,35,0.9)'
        ctx.fillRect(x, y, cs, cs)
      }
      const cell = g.board[r] && g.board[r][c]
      if (!cell) continue
      if (g.elimAnimCells && g.elimAnimCells.some(ec => ec.r === r && ec.c === c)) {
        const ep = g.elimAnimTimer / 16  // 0→1 消除进度（16帧）
        const elimColor = (ATTR_COLOR[g.elimAnimCells[0].attr] && ATTR_COLOR[g.elimAnimCells[0].attr].main) || '#ffffff'
        // 阶段1（0-0.3）：高亮放大脉冲
        // 阶段2（0.3-0.7）：缩小 + 属性色发光
        // 阶段3（0.7-1.0）：快速缩到0 + 爆散粒子光效
        let beadAlpha = 1, beadScale = 1
        if (ep < 0.3) {
          const p1 = ep / 0.3
          beadAlpha = 1
          beadScale = 1 + 0.15 * Math.sin(p1 * Math.PI)
        } else if (ep < 0.7) {
          const p2 = (ep - 0.3) / 0.4
          beadAlpha = 1 - p2 * 0.3
          beadScale = 1 - p2 * 0.4
        } else {
          const p3 = (ep - 0.7) / 0.3
          beadAlpha = 0.7 * (1 - p3)
          beadScale = 0.6 * (1 - p3)
        }
        ctx.globalAlpha = beadAlpha
        // 属性色光晕（全程）
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const glowIntensity = ep < 0.3 ? ep / 0.3 * 0.7 : (1 - ep) * 0.8
        ctx.globalAlpha = glowIntensity
        const glowR2 = cs * (0.5 + ep * 0.3)
        const grd = ctx.createRadialGradient(x+cs*0.5, y+cs*0.5, 0, x+cs*0.5, y+cs*0.5, glowR2)
        grd.addColorStop(0, '#fff')
        grd.addColorStop(0.4, elimColor + 'aa')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(x+cs*0.5, y+cs*0.5, glowR2, 0, Math.PI*2); ctx.fill()
        ctx.restore()
        // 4+消除额外强光
        if (g.elimAnimCells.length >= 4) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = glowIntensity * (g.elimAnimCells.length >= 5 ? 0.6 : 0.35)
          const bigGlowR = cs * (0.7 + ep * 0.4)
          const grd2 = ctx.createRadialGradient(x+cs*0.5, y+cs*0.5, 0, x+cs*0.5, y+cs*0.5, bigGlowR)
          grd2.addColorStop(0, '#fff')
          grd2.addColorStop(0.3, elimColor)
          grd2.addColorStop(1, 'transparent')
          ctx.fillStyle = grd2
          ctx.beginPath(); ctx.arc(x+cs*0.5, y+cs*0.5, bigGlowR, 0, Math.PI*2); ctx.fill()
          ctx.restore()
        }
        // 缩放珠子（消除进行中始终开启save，确保配对）
        ctx.save()
        if (beadScale !== 1) {
          ctx.translate(x+cs*0.5, y+cs*0.5)
          ctx.scale(beadScale, beadScale)
          ctx.translate(-(x+cs*0.5), -(y+cs*0.5))
        }
      }
      if (g.dragging && g.dragR === r && g.dragC === c) {
        ctx.globalAlpha = 0.3
      }
      let drawX = x, drawY = y
      // 掉落补间偏移
      if (cell._dropOffY) drawY += cell._dropOffY
      if (g.swapAnim) {
        const sa = g.swapAnim, t = sa.t/sa.dur
        if (sa.r1===r && sa.c1===c) { drawX = x+(sa.c2-sa.c1)*cs*t; drawY = y+(sa.r2-sa.r1)*cs*t }
        else if (sa.r2===r && sa.c2===c) { drawX = x+(sa.c1-sa.c2)*cs*t; drawY = y+(sa.r1-sa.r2)*cs*t }
      }
      const attr = typeof cell === 'string' ? cell : cell.attr
      const beadPad = cs * 0.08
      const beadR = (cs - beadPad*2) * 0.5
      R.drawBead(drawX+cs*0.5, drawY+cs*0.5, beadR, attr, g.af)
      // 有效珠子：攻击属性剑标记 / 心珠+标记（仅标记有效珠，不暗化无效珠）
      const _isEffective = attr === 'heart' || teamAttrs.has(attr)
      if (_isEffective && !(g.elimAnimCells && g.elimAnimCells.some(ec => ec.r === r && ec.c === c))) {
        _drawOrbIndicator(ctx, drawX, drawY, cs, beadR, attr, g.af, S)
      }
      // 新手引导：高亮可消除的宠物属性珠组
      if (_nbHighlight && _nbHighlight.has(r * COLS + c)) {
        const _nbc = ATTR_COLOR[attr]
        const _nbPulse = 0.25 + 0.2 * Math.sin(g.af * 0.1 + r * 0.5 + c * 0.7)
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = _nbPulse
        const _nbGrd = ctx.createRadialGradient(drawX+cs*0.5, drawY+cs*0.5, 0, drawX+cs*0.5, drawY+cs*0.5, beadR * 1.2)
        _nbGrd.addColorStop(0, '#fff')
        _nbGrd.addColorStop(0.5, (_nbc && _nbc.main) || '#ffd700')
        _nbGrd.addColorStop(1, 'transparent')
        ctx.fillStyle = _nbGrd
        ctx.beginPath(); ctx.arc(drawX+cs*0.5, drawY+cs*0.5, beadR * 1.2, 0, Math.PI*2); ctx.fill()
        ctx.restore()
      }
      // 关闭消除缩放
      if (g.elimAnimCells && g.elimAnimCells.some(ec => ec.r === r && ec.c === c)) {
        ctx.restore()
      }
      // 变珠升级特效（三阶段：聚能→爆变→余韵）
      if (g._beadConvertAnim) {
        const bca = g._beadConvertAnim
        const convertCell = bca.cells.find(cc => cc.r === r && cc.c === c)
        if (convertCell) {
          const cx = drawX + cs*0.5, cy = drawY + cs*0.5
          const toColor = (ATTR_COLOR[convertCell.toAttr] && ATTR_COLOR[convertCell.toAttr].main) || '#ffffff'
          ctx.save()
          if (bca.phase === 'charge') {
            // 阶段1：聚能 — 属性色光柱从天而降 + 珠子缩小
            const chargeP = bca.timer / 6
            // 光柱
            const pillarAlpha = 0.3 + chargeP * 0.5
            const pillarW = beadR * (0.3 + chargeP * 0.7)
            const pillarGrd = ctx.createLinearGradient(cx, cy - cs*2, cx, cy)
            pillarGrd.addColorStop(0, 'transparent')
            pillarGrd.addColorStop(0.3, toColor + '44')
            pillarGrd.addColorStop(0.7, toColor + 'aa')
            pillarGrd.addColorStop(1, '#fff')
            ctx.globalAlpha = pillarAlpha
            ctx.fillStyle = pillarGrd
            ctx.fillRect(cx - pillarW, cy - cs*2 * chargeP, pillarW*2, cs*2 * chargeP)
            // 珠子脉冲
            const pulseR = beadR * (1.1 + Math.sin(bca.timer * 1.5) * 0.15)
            const pulseGrd = ctx.createRadialGradient(cx, cy, beadR*0.2, cx, cy, pulseR)
            pulseGrd.addColorStop(0, '#ffffff88')
            pulseGrd.addColorStop(0.6, toColor + '66')
            pulseGrd.addColorStop(1, 'transparent')
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = 0.5 + chargeP * 0.4
            ctx.fillStyle = pulseGrd
            ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI*2); ctx.fill()
          } else if (bca.phase === 'burst') {
            // 阶段2：爆变 — 白光爆发 + 属性色碎片粒子
            const burstP = (bca.timer - 7) / 3
            // 白光爆发
            const burstR = beadR * (1.5 + burstP * 1.5)
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = (1 - burstP) * 0.9
            const burstGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, burstR)
            burstGrd.addColorStop(0, '#ffffff')
            burstGrd.addColorStop(0.3, '#ffffffcc')
            burstGrd.addColorStop(0.6, toColor + '88')
            burstGrd.addColorStop(1, 'transparent')
            ctx.fillStyle = burstGrd
            ctx.beginPath(); ctx.arc(cx, cy, burstR, 0, Math.PI*2); ctx.fill()
            // 碎片粒子
            for (let pi = 0; pi < 6; pi++) {
              const angle = (pi / 6) * Math.PI * 2 + bca.timer * 0.5
              const dist = beadR * (0.5 + burstP * 2.5)
              const px = cx + Math.cos(angle) * dist
              const py = cy + Math.sin(angle) * dist
              ctx.globalAlpha = (1 - burstP) * 0.8
              ctx.fillStyle = pi % 2 === 0 ? '#fff' : toColor
              ctx.beginPath(); ctx.arc(px, py, (2.5 - burstP * 1.5) * S, 0, Math.PI*2); ctx.fill()
            }
          } else {
            // 阶段3：余韵 — 新珠发光脉冲渐弱
            const glowP = (bca.timer - 10) / 14
            const intensity = (1 - glowP) * 0.6
            if (intensity > 0.05) {
              const glowR = beadR * (1.3 - glowP * 0.3)
              const glowGrd = ctx.createRadialGradient(cx, cy, beadR*0.2, cx, cy, glowR)
              glowGrd.addColorStop(0, `rgba(255,255,255,${intensity})`)
              glowGrd.addColorStop(0.5, toColor + Math.round(intensity * 128).toString(16).padStart(2, '0'))
              glowGrd.addColorStop(1, 'transparent')
              ctx.globalCompositeOperation = 'lighter'
              ctx.fillStyle = glowGrd
              ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI*2); ctx.fill()
            }
          }
          ctx.restore()
        }
      }
      ctx.globalAlpha = 1
      if (cell.sealed) {
        const cx = x + cs*0.5, cy = y + cs*0.5, hr = cs*0.42
        const sealPulse = 0.7 + 0.3 * Math.sin(g.af * 0.1 + r * 1.3 + c * 0.7)
        ctx.save()
        // 暗色遮罩（灵珠变暗表示被封）
        ctx.fillStyle = 'rgba(20,0,0,0.45)'
        ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI*2); ctx.fill()
        // 锁链纹理：画十字交叉锁链
        ctx.strokeStyle = `rgba(160,80,40,${sealPulse * 0.85})`; ctx.lineWidth = 2.5*S; ctx.lineCap = 'round'
        // 横链
        ctx.beginPath(); ctx.moveTo(x+5*S, cy-2*S); ctx.lineTo(x+cs-5*S, cy-2*S); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x+5*S, cy+2*S); ctx.lineTo(x+cs-5*S, cy+2*S); ctx.stroke()
        // 竖链
        ctx.beginPath(); ctx.moveTo(cx-2*S, y+5*S); ctx.lineTo(cx-2*S, y+cs-5*S); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx+2*S, y+5*S); ctx.lineTo(cx+2*S, y+cs-5*S); ctx.stroke()
        // 中心锁扣（小圆环）
        ctx.strokeStyle = `rgba(200,120,40,${sealPulse * 0.9})`; ctx.lineWidth = 2*S
        ctx.beginPath(); ctx.arc(cx, cy, 5*S, 0, Math.PI*2); ctx.stroke()
        ctx.fillStyle = `rgba(80,30,10,${sealPulse * 0.8})`
        ctx.beginPath(); ctx.arc(cx, cy, 3.5*S, 0, Math.PI*2); ctx.fill()
        // 外圈暗红光环脉冲
        ctx.strokeStyle = `rgba(180,40,20,${sealPulse * 0.35})`; ctx.lineWidth = 1.5*S
        ctx.beginPath(); ctx.arc(cx, cy, hr + 1*S, 0, Math.PI*2); ctx.stroke()
        ctx.restore()
      }
    }
  }
  if (g.dragging && g.dragAttr) {
    const beadR = (cs - cs*0.08*2) * 0.5
    const dragColor = (ATTR_COLOR[g.dragAttr] && ATTR_COLOR[g.dragAttr].main) || '#ffffff'

    // 拖尾粒子（每3帧生成，最多保留12个）
    if (!g._dragTrailParticles) g._dragTrailParticles = []
    if (g.dragTimer % 3 === 0) {
      g._dragTrailParticles.push({
        x: g.dragCurX + (Math.random()-0.5)*beadR*0.6,
        y: g.dragCurY + (Math.random()-0.5)*beadR*0.6,
        r: (2 + Math.random()*2) * S,
        alpha: 0.7,
        color: Math.random() < 0.3 ? '#fff' : dragColor
      })
      if (g._dragTrailParticles.length > 12) g._dragTrailParticles.shift()
    }
    // 绘制拖尾
    g._dragTrailParticles = g._dragTrailParticles.filter(tp => {
      tp.alpha -= 0.06; tp.r *= 0.93
      if (tp.alpha <= 0) return false
      ctx.save()
      ctx.globalAlpha = tp.alpha
      ctx.fillStyle = tp.color
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.r, 0, Math.PI*2); ctx.fill()
      ctx.restore()
      return true
    })

    // 拖拽珠子脉冲+发光效果
    ctx.save()
    const dragScale = 1.1 + Math.sin(g.dragTimer * 0.15) * 0.05
    ctx.translate(g.dragCurX, g.dragCurY)
    ctx.scale(dragScale, dragScale)
    ctx.translate(-g.dragCurX, -g.dragCurY)
    // 拖拽发光光晕
    const dragGlow = ctx.createRadialGradient(g.dragCurX, g.dragCurY, beadR*0.5, g.dragCurX, g.dragCurY, beadR*1.6)
    dragGlow.addColorStop(0, dragColor + '44')
    dragGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = dragGlow
    ctx.beginPath(); ctx.arc(g.dragCurX, g.dragCurY, beadR*1.6, 0, Math.PI*2); ctx.fill()
    R.drawBead(g.dragCurX, g.dragCurY, beadR, g.dragAttr, g.af)
    ctx.restore()
  } else {
    // 不拖拽时清空拖尾粒子
    g._dragTrailParticles = null
  }

  // 消除冲击波纹（增强版：多层扩散 + 辉光 + 粒子引擎爆发）
  if (g.elimAnimCells && g.elimAnimTimer <= 16) {
    const eP = g.elimAnimTimer / 16
    const elimAttrColor = (g.elimAnimCells[0] && ATTR_COLOR[g.elimAnimCells[0].attr] && ATTR_COLOR[g.elimAnimCells[0].attr].main) || '#ffffff'
    let eCx = 0, eCy = 0
    g.elimAnimCells.forEach(ec => { eCx += bx + ec.c*cs + cs*0.5; eCy += by + ec.r*cs + cs*0.5 })
    eCx /= g.elimAnimCells.length; eCy /= g.elimAnimCells.length
    ctx.save()
    // 中心辉光光斑
    const glowRadius = cs * (0.8 + eP * 1.5)
    FXComposer.drawGlowSpot(ctx, eCx, eCy, glowRadius, elimAttrColor, (1 - eP) * 0.5)
    // 主波纹（较快扩散，加粗）
    const waveR = cs * (0.5 + eP * 2.8)
    ctx.globalAlpha = (1 - eP) * 0.65
    ctx.strokeStyle = elimAttrColor
    ctx.lineWidth = (4 - eP * 3) * S
    ctx.beginPath(); ctx.arc(eCx, eCy, waveR, 0, Math.PI*2); ctx.stroke()
    // 内层波纹（稍慢，跟随）
    if (eP > 0.08) {
      const innerP = (eP - 0.08) / 0.92
      const waveR2 = cs * (0.3 + innerP * 2.2)
      ctx.globalAlpha = (1 - innerP) * 0.4
      ctx.lineWidth = (2.5 - innerP * 1.5) * S
      ctx.beginPath(); ctx.arc(eCx, eCy, waveR2, 0, Math.PI*2); ctx.stroke()
    }
    // 4+消额外强波纹 + 辉光
    if (g.elimAnimCells.length >= 4 && eP > 0.12) {
      const outerP = (eP - 0.12) / 0.88
      const waveR3 = cs * (0.6 + outerP * 3.5)
      ctx.globalAlpha = (1 - outerP) * 0.3
      ctx.lineWidth = (3 - outerP * 2.5) * S
      ctx.strokeStyle = '#fff'
      ctx.beginPath(); ctx.arc(eCx, eCy, waveR3, 0, Math.PI*2); ctx.stroke()
      FXComposer.drawGlowSpot(ctx, eCx, eCy, waveR3 * 0.6, elimAttrColor, (1 - outerP) * 0.3)
    }
    // 在消除第3帧用粒子引擎发射一次纹理粒子（仅触发一次）
    if (g.elimAnimTimer === 3 && !g._elimParticlesFired) {
      g._elimParticlesFired = true
      const elimCount = g.elimAnimCells.length
      const pCount = elimCount >= 5 ? 24 : elimCount >= 4 ? 16 : 10
      const comboMul = Math.min(2, 1 + (g.combo || 0) * 0.05)
      Particles.burst({
        x: eCx, y: eCy, count: Math.round(pCount * comboMul),
        speed: (3 + elimCount * 0.5) * S, size: (3 + elimCount * 0.3) * S,
        life: 18 + elimCount * 3, gravity: 0.1 * S, drag: 0.96,
        colors: ['#fff', elimAttrColor, elimAttrColor, '#ffe8b0'],
        shape: elimCount >= 5 ? 'star' : 'glow',
      })
    }
    // 传统爆散粒子保留作为补充
    if (eP > 0.25 && eP < 0.85) {
      const sparkP = (eP - 0.25) / 0.6
      const sparkCount = g.elimAnimCells.length >= 5 ? 10 : g.elimAnimCells.length >= 4 ? 7 : 5
      for (let si = 0; si < sparkCount; si++) {
        const angle = (si / sparkCount) * Math.PI * 2 + g.elimAnimTimer * 0.2
        const dist = cs * (0.3 + sparkP * 2)
        const sx = eCx + Math.cos(angle) * dist
        const sy = eCy + Math.sin(angle) * dist
        const sparkR = (2 + (si % 3) * 0.6) * S * (1 - sparkP * 0.5)
        ctx.globalAlpha = (1 - sparkP) * 0.8
        ctx.fillStyle = si % 3 === 0 ? '#fff' : elimAttrColor
        ctx.beginPath(); ctx.arc(sx, sy, sparkR, 0, Math.PI*2); ctx.fill()
      }
    }
    ctx.restore()
  } else if (!g.elimAnimCells) {
    g._elimParticlesFired = false
  }
}
// ===== 波间过渡（固定关卡） =====
function _drawWaveTransition(g) {
  const { ctx, W, H, S } = V
  ctx.save()
  // 半透明遮罩
  const alpha = Math.min(1, (60 - (g._waveTransTimer || 0)) / 15) * 0.6
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(0, 0, W, H)
  // "第 X 波"文字
  const nextWave = (g._stageWaveIdx || 0) + 2
  const totalWaves = g._stageWaves ? g._stageWaves.length : 0
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.shadowColor = 'rgba(255,215,0,0.5)'; ctx.shadowBlur = 10*S
  ctx.fillText(`第 ${nextWave} 波`, W * 0.5, H * 0.42)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ccc'
  ctx.font = `${12*S}px "PingFang SC",sans-serif`
  ctx.fillText(`共 ${totalWaves} 波`, W * 0.5, H * 0.42 + 28*S)
  // 闪烁提示
  const blink = 0.4 + 0.4 * Math.sin(g.af * 0.1)
  ctx.globalAlpha = blink
  ctx.fillStyle = '#aaa'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('点击跳过', W * 0.5, H * 0.58)
  ctx.globalAlpha = 1
  ctx.restore()
}

module.exports = {
  drawBoard,
  drawWaveTransition: _drawWaveTransition,
  drawDragTimer: _drawDragTimer,
  drawEnemyTurnBanner: _drawEnemyTurnBanner,
  drawAttrCoverageBar: _drawAttrCoverageBar,
}
