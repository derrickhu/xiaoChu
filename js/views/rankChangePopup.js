/**
 * 名次变动三档 UI 弹窗 —— 排行榜重构 Stage 2 核心模块
 *
 * 档位 1：小变动（up / firstTime） → 顶部滑入胶囊 toast · 非阻塞 · 2.5s 自动收起
 * 档位 2：进入 Top 10                → 下半屏金边卡 · 半阻塞 · 3s/点击关闭
 * 档位 3：进入 Top 3 / Top 1           → 全屏金光粒子雨 · 完全阻塞 · 按钮关闭
 *
 * 设计原则：
 *   · 下降不触发任何档位（避免"刚赢一局却看到负面信息"）
 *   · 档位 1/2 有频控，档位 3 按"一生一次"去重
 *   · 高优先级档位可抢占低优先级（tier3 > tier2 > tier1）
 *   · 纯 canvas 渲染，无外部美术资源强依赖；后续可接图片替换底图
 *
 * 主入口：
 *   const rankChangePopup = require('./rankChangePopup')
 *   rankChangePopup.trigger(g, feedback)    // feedback 由 rankingService.pendingFeedback 提供
 *   rankChangePopup.drainPending(g)         // 一次性消费 storage.pendingRankingFeedback，决定档位
 *   rankChangePopup.draw()                  // 主循环 render 最后阶段调用
 *   rankChangePopup.handleTouch(type,x,y)   // 触摸入口最前置调用；返回 true 表示吞掉触摸
 */

const V = require('./env')

// ==== 动画时长 ====
const T1_ENTER = 300
const T1_HOLD = 2500
const T1_EXIT = 260

const T2_ENTER = 460
const T2_HOLD = 3000
const T2_EXIT = 300

const T3_ENTER = 520
const T3_BTN_UNLOCK = 700
const T3_EXIT = 320

// ==== 榜单元信息 ====
//   icon/color 仅影响 UI 着色；字符用常规 unicode 避免依赖外部字体
const TAB_META = {
  stage:       { label: '秘境榜',    icon: '⛰',  color: '#D4A020', accent: '#FFD770' },
  tower:       { label: '通天塔',    icon: '塔', color: '#6B8AD6', accent: '#B4D0FF' },
  towerWeekly: { label: '通天塔周榜', icon: '塔', color: '#6B8AD6', accent: '#B4D0FF' },
  dex:         { label: '图鉴榜',    icon: '鉴', color: '#4DCC4D', accent: '#BFF0BF' },
  combo:       { label: '连击榜',    icon: '⚡', color: '#FF6B6B', accent: '#FFC8C8' },
}
function _tabMeta(tab) { return TAB_META[tab] || { label: '榜单', icon: '★', color: '#D4A020', accent: '#FFD770' } }

// ==== 模块状态 ====
let _state = null   // 当前正在播放的弹窗
let _queue = []     // 待播放队列

// ========================================================
//                       决策入口
// ========================================================

/** 档位判定：根据 events 选最高档位 */
function _pickTier(fb) {
  if (!fb || !fb.events || !fb.events.length) return 0
  if (fb.events.includes('top1') || fb.events.includes('top3')) return 3
  if (fb.events.includes('top10')) return 2
  if (fb.events.includes('up') || fb.events.includes('firstTime')) return 1
  return 0
}

/**
 * 由调用方明确传入一个 feedback 对象（rankingService 产出的 { tab, curr, prev, delta, events }）
 * 返回 true 代表成功排入播放队列或立即播放
 */
function trigger(g, fb) {
  if (!g || !fb) return false
  const storage = g.storage
  if (!storage) return false
  const tier = _pickTier(fb)
  if (!tier) return false

  if (tier === 3) {
    const level = fb.events.includes('top1') ? 'top1' : 'top3'
    if (storage.hasRankMilestone(fb.tab, level)) {
      return _fallbackToLower(g, fb, 2)
    }
    if (!storage.markRankMilestone(fb.tab, level)) {
      return _fallbackToLower(g, fb, 2)
    }
    return _activate(g, fb, 3, level)
  }

  if (tier === 2) {
    if (!storage.canShowRankTier(fb.tab, 2)) {
      return _fallbackToLower(g, fb, 1)
    }
    storage.consumeRankTier(fb.tab, 2)
    return _activate(g, fb, 2, 'top10')
  }

  // tier === 1
  if (!fb.events.includes('up') && !fb.events.includes('firstTime')) return false
  if (!storage.canShowRankTier(fb.tab, 1)) return false
  storage.consumeRankTier(fb.tab, 1)
  return _activate(g, fb, 1, null)
}

/** 高档位被频控挡掉时回退到更低档位（仅针对 tier 2 → tier 1 / tier 3 → tier 2） */
function _fallbackToLower(g, fb, targetTier) {
  const storage = g.storage
  if (targetTier === 2) {
    if (!fb.events.includes('top10')) return _fallbackToLower(g, fb, 1)
    if (!storage.canShowRankTier(fb.tab, 2)) return _fallbackToLower(g, fb, 1)
    storage.consumeRankTier(fb.tab, 2)
    return _activate(g, fb, 2, 'top10')
  }
  if (targetTier === 1) {
    if (!fb.events.includes('up') && !fb.events.includes('firstTime')) return false
    if (!storage.canShowRankTier(fb.tab, 1)) return false
    storage.consumeRankTier(fb.tab, 1)
    return _activate(g, fb, 1, null)
  }
  return false
}

/**
 * 一次性消费 storage 里的 pendingRankingFeedback（若有），决定要不要触发弹窗
 * 返回：是否触发了任一档位
 */
function drainPending(g) {
  if (!g || !g.storage) return false
  if (!g.storage.pendingRankingFeedback) return false
  const fb = g.storage.consumeRankingFeedback()
  return trigger(g, fb)
}

function _activate(g, fb, tier, level) {
  const item = {
    tier,
    level,
    fb,
    g,
    phase: 'enter',
    elapsed: 0,
    lastTs: Date.now(),
    rects: {},
    // 档位 3 专用的粒子组（一次性初始化）
    particles: tier === 3 ? _spawnConfetti() : null,
  }
  if (!_state) {
    _state = item
  } else if (tier > _state.tier) {
    // 高档位抢占：当前直接结束，重新排队
    _queue.unshift(_state)
    _state = item
  } else {
    _queue.push(item)
  }
  return true
}

function isActive() { return !!_state }

function clear() { _state = null; _queue = [] }

function _next() {
  _state = _queue.shift() || null
  if (_state) _state.lastTs = Date.now()
}

// ========================================================
//                       动画推进
// ========================================================

function _tick() {
  if (!_state) return
  const now = Date.now()
  const dt = Math.max(0, Math.min(64, now - _state.lastTs))
  _state.lastTs = now
  _state.elapsed += dt
  const s = _state
  if (s.tier === 1) {
    if (s.phase === 'enter' && s.elapsed >= T1_ENTER) { s.phase = 'hold'; s.elapsed = 0 }
    else if (s.phase === 'hold' && s.elapsed >= T1_HOLD) { s.phase = 'exit'; s.elapsed = 0 }
    else if (s.phase === 'exit' && s.elapsed >= T1_EXIT) { _next() }
  } else if (s.tier === 2) {
    if (s.phase === 'enter' && s.elapsed >= T2_ENTER) { s.phase = 'hold'; s.elapsed = 0 }
    else if (s.phase === 'hold' && s.elapsed >= T2_HOLD) { s.phase = 'exit'; s.elapsed = 0 }
    else if (s.phase === 'exit' && s.elapsed >= T2_EXIT) { _next() }
  } else if (s.tier === 3) {
    if (s.phase === 'enter' && s.elapsed >= T3_ENTER) { s.phase = 'hold'; s.elapsed = 0 }
    else if (s.phase === 'exit' && s.elapsed >= T3_EXIT) { _next() }
  }
}

// ========================================================
//                       渲染
// ========================================================

function draw() {
  _tick()
  if (!_state) return
  if (_state.tier === 1) _renderTier1(_state)
  else if (_state.tier === 2) _renderTier2(_state)
  else if (_state.tier === 3) _renderTier3(_state)
}

// ---------- 通用工具 ----------

function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function _easeInCubic(t) { return t * t * t }
function _easeOutBack(t) { const s = 1.7; const p = t - 1; return p * p * ((s + 1) * p + s) + 1 }

function _clamp01(v) { return Math.max(0, Math.min(1, v)) }

function _drawRoundRect(ctx, x, y, w, h, r) {
  const R = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + R, y)
  ctx.lineTo(x + w - R, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + R)
  ctx.lineTo(x + w, y + h - R)
  ctx.quadraticCurveTo(x + w, y + h, x + w - R, y + h)
  ctx.lineTo(x + R, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - R)
  ctx.lineTo(x, y + R)
  ctx.quadraticCurveTo(x, y, x + R, y)
  ctx.closePath()
}

function _drawCircleAvatar(ctx, R, url, cx, cy, r, fallbackText) {
  const img = url ? R.getImg(url) : null
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip()
  if (img && img.width > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  } else {
    ctx.fillStyle = 'rgba(200,158,60,0.28)'
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = '#5A3A10'
    ctx.font = `bold ${Math.floor(r * 1.1)}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(fallbackText || '我', cx, cy + 1)
  }
  ctx.restore()
}

// ========================================================
//                      档位 1 · 顶部 toast
// ========================================================

function _renderTier1(s) {
  const { ctx, R, W, S, safeTop } = V
  const { fb } = s
  const isUp = fb.events.includes('up') || fb.events.includes('firstTime')
  const meta = _tabMeta(fb.tab)

  let slide, alpha
  if (s.phase === 'enter') {
    const p = _clamp01(s.elapsed / T1_ENTER)
    slide = _easeOutBack(p); alpha = p
  } else if (s.phase === 'exit') {
    const p = _clamp01(s.elapsed / T1_EXIT)
    slide = 1 - p * 0.4; alpha = 1 - p
  } else { slide = 1; alpha = 1 }

  const boxW = Math.min(W - 18 * S, 340 * S)
  const boxH = 78 * S
  const boxX = (W - boxW) / 2
  const startY = -boxH - 6 * S
  const targetY = (safeTop || 0) + 10 * S
  const boxY = startY + (targetY - startY) * slide

  ctx.save()
  ctx.globalAlpha = alpha

  // 外阴影
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 18 * S
  ctx.shadowOffsetY = 4 * S
  const bg = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxH)
  if (isUp) {
    bg.addColorStop(0, 'rgba(62,44,16,0.96)')
    bg.addColorStop(1, 'rgba(38,26,10,0.96)')
  } else {
    bg.addColorStop(0, 'rgba(38,42,58,0.96)')
    bg.addColorStop(1, 'rgba(22,26,40,0.96)')
  }
  ctx.fillStyle = bg
  _drawRoundRect(ctx, boxX, boxY, boxW, boxH, 14 * S)
  ctx.fill()
  ctx.restore()

  // 金/冷边
  ctx.strokeStyle = isUp ? 'rgba(255,214,120,0.9)' : 'rgba(180,190,220,0.55)'
  ctx.lineWidth = 1.4 * S
  _drawRoundRect(ctx, boxX, boxY, boxW, boxH, 14 * S)
  ctx.stroke()

  // 上升背景光晕
  if (isUp) {
    ctx.save()
    const grad = ctx.createRadialGradient(boxX + boxW * 0.25, boxY + boxH * 0.5, 4 * S, boxX + boxW * 0.25, boxY + boxH * 0.5, boxW * 0.6)
    grad.addColorStop(0, 'rgba(255,214,120,0.28)')
    grad.addColorStop(1, 'rgba(255,214,120,0)')
    ctx.fillStyle = grad
    _drawRoundRect(ctx, boxX, boxY, boxW, boxH, 14 * S)
    ctx.fill()
    ctx.restore()
  }

  // 左侧头像 + 榜单 icon 徽章
  const avatarR = 20 * S
  const avatarCX = boxX + 14 * S + avatarR
  const avatarCY = boxY + boxH / 2
  const storage = s.g.storage
  const avatarUrl = (storage.userInfo && storage.userInfo.avatarUrl) || ''
  _drawCircleAvatar(ctx, R, avatarUrl, avatarCX, avatarCY, avatarR, '我')
  // 头像金/冷边
  ctx.strokeStyle = isUp ? '#FFD770' : '#B8C6DC'
  ctx.lineWidth = 1.6 * S
  ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR + 1 * S, 0, Math.PI * 2); ctx.stroke()
  // 右下角 tab icon 小徽章
  const badgeR = 9 * S
  const badgeX = avatarCX + avatarR - 2 * S
  const badgeY = avatarCY + avatarR - 2 * S
  ctx.fillStyle = meta.color
  ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = '#2A1A00'; ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.arc(badgeX, badgeY, badgeR, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = '#2A1A00'
  ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(meta.icon, badgeX, badgeY + 0.5 * S)

  // 中间文案
  const textX = avatarCX + avatarR + 12 * S
  const delta = Math.abs(fb.delta || 0) || 0
  let mainText
  if (fb.events.includes('firstTime')) {
    mainText = `${meta.label} · 首次上榜`
  } else if (isUp) {
    mainText = `${meta.label} 上升 ${delta} 位`
  } else {
    mainText = `${meta.label} 下滑 ${delta} 位`
  }
  ctx.fillStyle = isUp ? '#FFF4CE' : '#E8EAF5'
  ctx.font = `bold ${13.5 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(mainText, textX, boxY + 26 * S)

  ctx.fillStyle = isUp ? 'rgba(255,232,170,0.78)' : 'rgba(200,210,232,0.78)'
  ctx.font = `${10.5 * S}px "PingFang SC",sans-serif`
  const subText = isUp
    ? `当前第 ${fb.curr} 名，再拼一把！`
    : `有人在追你，稳住！`
  ctx.fillText(subText, textX, boxY + 48 * S)

  // 右侧名次翻牌
  const rankBoxR = 13 * S
  const rankBoxCX = boxX + boxW - 30 * S
  const rankBoxCY = avatarCY
  ctx.fillStyle = isUp ? 'rgba(255,214,120,0.22)' : 'rgba(180,190,220,0.15)'
  ctx.beginPath(); ctx.arc(rankBoxCX, rankBoxCY, rankBoxR + 4 * S, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = isUp ? '#FFD770' : '#B8C6DC'
  ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.arc(rankBoxCX, rankBoxCY, rankBoxR + 4 * S, 0, Math.PI * 2); ctx.stroke()

  // 数字翻牌：enter 动画期间从 prev 滚到 curr；之后稳定在 curr
  const rollP = s.phase === 'enter' ? _clamp01(s.elapsed / T1_ENTER) : 1
  const prev = Math.max(1, fb.prev || fb.curr)
  const curr = Math.max(1, fb.curr || prev)
  const displayRank = Math.round(prev + (curr - prev) * rollP)
  ctx.fillStyle = isUp ? '#FFD770' : '#CFD8EC'
  ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(`${displayRank}`, rankBoxCX, rankBoxCY - 1 * S)
  ctx.fillStyle = isUp ? 'rgba(255,232,170,0.7)' : 'rgba(200,210,232,0.7)'
  ctx.font = `${8 * S}px "PingFang SC",sans-serif`
  ctx.fillText('名', rankBoxCX, rankBoxCY + 10 * S)

  // 箭头（↑/↓）浮动动画
  const arrowY = boxY + 16 * S + (s.phase === 'hold' ? Math.sin(s.elapsed / 180) * 1.5 * S : 0)
  ctx.fillStyle = isUp ? '#FFD770' : '#B8C6DC'
  ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(isUp ? '↑' : '↓', rankBoxCX, arrowY)

  ctx.restore()
}

// ========================================================
//                  档位 2 · 下半屏进阶卡
// ========================================================

function _renderTier2(s) {
  const { ctx, R, W, H, S } = V
  const { fb } = s
  const meta = _tabMeta(fb.tab)

  let enterP
  if (s.phase === 'enter') enterP = _easeOutBack(_clamp01(s.elapsed / T2_ENTER))
  else if (s.phase === 'exit') enterP = 1 - _easeInCubic(_clamp01(s.elapsed / T2_EXIT))
  else enterP = 1

  const alpha = s.phase === 'exit' ? 1 - _clamp01(s.elapsed / T2_EXIT) : _clamp01(s.elapsed / T2_ENTER)

  ctx.save()

  // 半屏暗幕（轻，不遮首页信息）
  ctx.fillStyle = `rgba(6,8,14,${0.42 * alpha})`
  ctx.fillRect(0, 0, W, H)

  // 卡面尺寸：下半屏 44%
  const cardH = H * 0.44
  const cardW = W * 0.92
  const cardX = (W - cardW) / 2
  const cardTargetY = H - cardH - 30 * S
  const cardY = cardTargetY + (1 - enterP) * (cardH + 40 * S)

  // 卡面渐变底
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 24 * S
  ctx.shadowOffsetY = 6 * S
  const g1 = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH)
  g1.addColorStop(0, 'rgba(56,38,14,0.98)')
  g1.addColorStop(1, 'rgba(32,20,6,0.98)')
  ctx.fillStyle = g1
  _drawRoundRect(ctx, cardX, cardY, cardW, cardH, 22 * S)
  ctx.fill()
  ctx.restore()

  // 金边（双层）
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = 'rgba(255,214,120,0.95)'; ctx.lineWidth = 2.5 * S
  _drawRoundRect(ctx, cardX, cardY, cardW, cardH, 22 * S); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,232,170,0.35)'; ctx.lineWidth = 1 * S
  _drawRoundRect(ctx, cardX + 5 * S, cardY + 5 * S, cardW - 10 * S, cardH - 10 * S, 18 * S); ctx.stroke()
  ctx.restore()

  // 旋转放射光（位于卡面上方头像后方）
  const hubCX = W / 2
  const hubCY = cardY + cardH * 0.36
  const rotate = s.elapsed / 900
  ctx.save()
  ctx.globalAlpha = alpha * 0.55
  ctx.translate(hubCX, hubCY); ctx.rotate(rotate)
  const rayR = cardH * 0.42
  for (let i = 0; i < 12; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 6)
    const grd = ctx.createLinearGradient(0, 0, 0, -rayR)
    grd.addColorStop(0, 'rgba(255,214,120,0.45)')
    grd.addColorStop(1, 'rgba(255,214,120,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.moveTo(-6 * S, 0)
    ctx.lineTo(6 * S, 0)
    ctx.lineTo(0, -rayR)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  // 头像（圆框）
  ctx.save()
  ctx.globalAlpha = alpha
  const avR = 34 * S
  const storage = s.g.storage
  const avatarUrl = (storage.userInfo && storage.userInfo.avatarUrl) || ''
  _drawCircleAvatar(ctx, R, avatarUrl, hubCX, hubCY, avR, '我')
  // 双金环
  ctx.strokeStyle = '#FFE28A'; ctx.lineWidth = 2.5 * S
  ctx.beginPath(); ctx.arc(hubCX, hubCY, avR + 2 * S, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = 'rgba(255,214,120,0.45)'; ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.arc(hubCX, hubCY, avR + 8 * S, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()

  // 粒子环绕：12 颗金点绕圈
  ctx.save()
  ctx.globalAlpha = alpha
  for (let i = 0; i < 12; i++) {
    const ang = rotate * 2 + (i * Math.PI) / 6
    const rr = avR + 18 * S + Math.sin(s.elapsed / 260 + i) * 2 * S
    const px = hubCX + Math.cos(ang) * rr
    const py = hubCY + Math.sin(ang) * rr
    const sz = 2 + (i % 3) * 0.6
    ctx.fillStyle = `rgba(255,226,138,${0.6 + 0.4 * Math.sin(s.elapsed / 200 + i)})`
    ctx.beginPath(); ctx.arc(px, py, sz * S, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  // 标题："进入前十！"
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFE78A'
  ctx.font = `bold ${13 * S}px "PingFang SC",sans-serif`
  ctx.fillText(`— ${meta.label} · 里程碑 —`, W / 2, cardY + 30 * S)

  ctx.fillStyle = '#FFF4CE'
  ctx.font = `bold ${30 * S}px "PingFang SC",sans-serif`
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 8 * S
  ctx.fillText('进入前十！', W / 2, hubCY + avR + 50 * S)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#FFD770'
  ctx.font = `bold ${18 * S}px "PingFang SC",sans-serif`
  ctx.fillText(`当前第 ${fb.curr} 名`, W / 2, hubCY + avR + 78 * S)

  ctx.fillStyle = 'rgba(255,232,170,0.75)'
  ctx.font = `${11 * S}px "PingFang SC",sans-serif`
  ctx.fillText('继续冲，前三就在眼前', W / 2, hubCY + avR + 100 * S)

  // 底部"点击任意处关闭"提示
  if (s.phase !== 'enter') {
    ctx.fillStyle = 'rgba(255,232,170,0.5)'
    ctx.font = `${9 * S}px "PingFang SC",sans-serif`
    ctx.fillText('点击任意处关闭', W / 2, cardY + cardH - 16 * S)
  }
  ctx.restore()

  ctx.restore()
}

// ========================================================
//                档位 3 · 全屏登顶庆祝
// ========================================================

// 生成粒子雨（金币雨 + 五彩纸屑）
function _spawnConfetti() {
  const { W, H, S } = V
  const N = 60
  const arr = []
  for (let i = 0; i < N; i++) {
    const isCoin = Math.random() < 0.55
    arr.push({
      x: Math.random() * W,
      y: -Math.random() * H * 0.8,
      vy: (80 + Math.random() * 180) * S / 1000,   // px/ms
      vx: (Math.random() - 0.5) * 0.06 * S,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.006,
      size: (isCoin ? 6 + Math.random() * 4 : 5 + Math.random() * 4) * S,
      isCoin,
      color: isCoin
        ? ['#FFD770', '#FFE28A', '#FFC444'][i % 3]
        : ['#FF6B6B', '#6B8AD6', '#4DCC4D', '#FFD770', '#D8B4E8'][i % 5],
    })
  }
  return arr
}

function _renderTier3(s) {
  const { ctx, R, W, H, S } = V
  const { fb, level } = s
  const meta = _tabMeta(fb.tab)
  const isTop1 = level === 'top1'

  let enterP
  if (s.phase === 'enter') enterP = _easeOutBack(_clamp01(s.elapsed / T3_ENTER))
  else if (s.phase === 'exit') enterP = 1 - _easeInCubic(_clamp01(s.elapsed / T3_EXIT))
  else enterP = 1
  const alpha = s.phase === 'exit' ? 1 - _clamp01(s.elapsed / T3_EXIT) : _clamp01(s.elapsed / T3_ENTER)

  ctx.save()

  // 全屏暗幕
  ctx.fillStyle = `rgba(4,6,10,${0.78 * alpha})`
  ctx.fillRect(0, 0, W, H)

  // 粒子雨
  if (s.particles && s.phase !== 'exit') {
    const now = Date.now()
    if (!s._lastParticleTs) s._lastParticleTs = now
    const dt = Math.max(0, Math.min(64, now - s._lastParticleTs))
    s._lastParticleTs = now
    for (const p of s.particles) {
      p.y += p.vy * dt
      p.x += p.vx * dt
      p.rot += p.vr * dt
      if (p.y > H + 20 * S) { p.y = -20 * S; p.x = Math.random() * W }
    }
  }
  if (s.particles) {
    ctx.save()
    ctx.globalAlpha = alpha
    for (const p of s.particles) {
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      if (p.isCoin) {
        // 金币：两层圆
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        ctx.beginPath(); ctx.arc(-p.size * 0.15, -p.size * 0.15, p.size / 5, 0, Math.PI * 2); ctx.fill()
      } else {
        // 纸屑：小矩形
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      }
      ctx.restore()
    }
    ctx.restore()
  }

  // 中央放射光
  const cx = W / 2
  const cy = H * 0.45
  ctx.save()
  ctx.globalAlpha = alpha * 0.7
  const rot = s.elapsed / 1200
  ctx.translate(cx, cy); ctx.rotate(rot)
  const rayR = Math.min(W, H) * 0.55
  for (let i = 0; i < 16; i++) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 8)
    const grd = ctx.createLinearGradient(0, 0, 0, -rayR)
    grd.addColorStop(0, 'rgba(255,214,120,0.35)')
    grd.addColorStop(1, 'rgba(255,214,120,0)')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.moveTo(-8 * S, 0); ctx.lineTo(8 * S, 0); ctx.lineTo(0, -rayR); ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  // 奖杯/冠冕 pure-canvas 绘制
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(cx, cy)
  ctx.scale(enterP, enterP)
  _drawTrophy(ctx, S, isTop1)
  ctx.restore()

  // 奖杯中心内嵌头像（先画奖杯再盖头像）
  const avR = 30 * S * enterP
  ctx.save()
  ctx.globalAlpha = alpha
  const storage = s.g.storage
  const avatarUrl = (storage.userInfo && storage.userInfo.avatarUrl) || ''
  _drawCircleAvatar(ctx, R, avatarUrl, cx, cy + 2 * S, avR, '我')
  ctx.strokeStyle = isTop1 ? '#FFF4CE' : '#FFE28A'
  ctx.lineWidth = 2 * S
  ctx.beginPath(); ctx.arc(cx, cy + 2 * S, avR + 2 * S, 0, Math.PI * 2); ctx.stroke()
  // 旋转金环（1 圈外环）
  ctx.save()
  ctx.translate(cx, cy + 2 * S); ctx.rotate(rot * 1.8)
  ctx.strokeStyle = 'rgba(255,232,170,0.75)'
  ctx.setLineDash([5 * S, 4 * S])
  ctx.lineWidth = 1.5 * S
  ctx.beginPath(); ctx.arc(0, 0, avR + 10 * S, 0, Math.PI * 2); ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
  ctx.restore()

  // 标题：登顶 / 跻身前三
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.textAlign = 'center'
  ctx.fillStyle = isTop1 ? '#FFE78A' : '#FFD770'
  ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
  ctx.fillText(`— ${meta.label} · 终极荣耀 —`, cx, H * 0.15)

  ctx.fillStyle = '#FFF4CE'
  ctx.font = `bold ${38 * S}px "PingFang SC",sans-serif`
  ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10 * S; ctx.shadowOffsetY = 3 * S
  ctx.fillText(isTop1 ? '登 · 顶 · 了' : '跻身前三', cx, H * 0.74)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#FFD770'
  ctx.font = `bold ${22 * S}px "PingFang SC",sans-serif`
  ctx.fillText(`${meta.label} · 第 ${fb.curr} 名`, cx, H * 0.80)

  ctx.fillStyle = 'rgba(255,232,170,0.8)'
  ctx.font = `${11 * S}px "PingFang SC",sans-serif`
  ctx.fillText(isTop1 ? '你是第一，这份荣耀值得被记住' : '下一步，就是那把王座', cx, H * 0.845)
  ctx.restore()

  // 继续按钮（在 T3_BTN_UNLOCK 后亮起）
  const btnW = 160 * S
  const btnH = 40 * S
  const btnX = (W - btnW) / 2
  const btnY = H * 0.88
  const unlocked = s.phase !== 'enter' || s.elapsed >= T3_BTN_UNLOCK

  ctx.save()
  ctx.globalAlpha = alpha * (unlocked ? 1 : 0.35)
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
  btnGrad.addColorStop(0, '#FFD770')
  btnGrad.addColorStop(1, '#D4A020')
  ctx.fillStyle = btnGrad
  _drawRoundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5 * S
  _drawRoundRect(ctx, btnX, btnY, btnW, btnH, btnH / 2); ctx.stroke()
  ctx.fillStyle = '#2A1A00'
  ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('收下这份荣耀', btnX + btnW / 2, btnY + btnH / 2)
  ctx.restore()
  s.rects.continueBtn = unlocked ? [btnX, btnY, btnW, btnH] : null

  ctx.restore()
}

/** 纯 canvas 画一只奖杯/皇冠（Top1 金冠，Top3 银花奖杯），原点 0,0 居中偏下 */
function _drawTrophy(ctx, S, isTop1) {
  if (isTop1) {
    // === 金冠 ===
    ctx.save()
    // 冠身主体：梯形，中间 3 尖
    const cw = 92 * S, ch = 52 * S
    ctx.translate(0, -20 * S)
    // 底座
    ctx.fillStyle = '#8B5E1B'
    _drawRoundRect(ctx, -cw / 2 - 4 * S, ch / 2, cw + 8 * S, 10 * S, 3 * S)
    ctx.fill()
    // 金色梯形
    const g1 = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2)
    g1.addColorStop(0, '#FFE78A'); g1.addColorStop(0.5, '#FFD770'); g1.addColorStop(1, '#C99526')
    ctx.fillStyle = g1
    ctx.beginPath()
    ctx.moveTo(-cw / 2, ch / 2)
    ctx.lineTo(-cw / 2 - 6 * S, -ch / 2)
    ctx.lineTo(-cw * 0.25, -ch / 2 + 6 * S)
    ctx.lineTo(-cw * 0.15, -ch * 0.7)
    ctx.lineTo(0, -ch / 2 + 2 * S)
    ctx.lineTo(cw * 0.15, -ch * 0.7)
    ctx.lineTo(cw * 0.25, -ch / 2 + 6 * S)
    ctx.lineTo(cw / 2 + 6 * S, -ch / 2)
    ctx.lineTo(cw / 2, ch / 2)
    ctx.closePath(); ctx.fill()
    // 金边
    ctx.strokeStyle = '#8B5E1B'; ctx.lineWidth = 2 * S; ctx.stroke()
    // 三颗宝石
    const gems = [
      { x: -cw * 0.3, color: '#D64F5C' },
      { x: 0, color: '#4A8CD4' },
      { x: cw * 0.3, color: '#4DAA6C' },
    ]
    for (const gem of gems) {
      ctx.fillStyle = gem.color
      ctx.beginPath(); ctx.arc(gem.x, 0, 5 * S, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = '#FFE78A'; ctx.lineWidth = 1 * S; ctx.stroke()
    }
    ctx.restore()
  } else {
    // === 银花奖杯 ===
    ctx.save()
    // 底座
    ctx.fillStyle = '#5F4720'
    _drawRoundRect(ctx, -50 * S, 28 * S, 100 * S, 10 * S, 3 * S); ctx.fill()
    _drawRoundRect(ctx, -36 * S, 20 * S, 72 * S, 10 * S, 2 * S); ctx.fill()
    // 杯柱
    ctx.fillStyle = '#C0C0D0'
    ctx.fillRect(-8 * S, -4 * S, 16 * S, 26 * S)
    // 杯身
    const g1 = ctx.createLinearGradient(0, -48 * S, 0, 0)
    g1.addColorStop(0, '#F0F0FA'); g1.addColorStop(0.5, '#C0C0D0'); g1.addColorStop(1, '#8A8AA0')
    ctx.fillStyle = g1
    ctx.beginPath()
    ctx.moveTo(-40 * S, -48 * S)
    ctx.quadraticCurveTo(-40 * S, -10 * S, -10 * S, 0)
    ctx.lineTo(10 * S, 0)
    ctx.quadraticCurveTo(40 * S, -10 * S, 40 * S, -48 * S)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#5F4720'; ctx.lineWidth = 2 * S; ctx.stroke()
    // 杯口花边
    ctx.strokeStyle = '#F0F0FA'; ctx.lineWidth = 3 * S
    ctx.beginPath(); ctx.moveTo(-40 * S, -48 * S); ctx.lineTo(40 * S, -48 * S); ctx.stroke()
    // 两侧把手
    ctx.strokeStyle = '#A0A0B8'; ctx.lineWidth = 4 * S
    ctx.beginPath(); ctx.arc(-44 * S, -30 * S, 14 * S, -Math.PI * 0.2, Math.PI * 0.8, true); ctx.stroke()
    ctx.beginPath(); ctx.arc(44 * S, -30 * S, 14 * S, Math.PI * 1.2, Math.PI * 0.2); ctx.stroke()
    ctx.restore()
  }
}

// ========================================================
//                   触摸处理
// ========================================================

function handleTouch(type, x, y) {
  if (!_state) return false
  const s = _state
  // 档位 1：非阻塞，不吞触摸
  if (s.tier === 1) return false
  // 档位 2：动画中全吞；hold 期间点击任意处关闭
  if (s.tier === 2) {
    if (s.phase === 'enter') return true
    if (type === 'end' && s.phase === 'hold') {
      s.phase = 'exit'; s.elapsed = 0
    }
    return true
  }
  // 档位 3：全吞；hold 且按钮已解锁、点到按钮才关闭
  if (s.tier === 3) {
    if (s.phase !== 'hold') return true
    if (type !== 'end') return true
    const r = s.rects.continueBtn
    if (r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) {
      s.phase = 'exit'; s.elapsed = 0
    }
    return true
  }
  return false
}

module.exports = {
  trigger,
  drainPending,
  isActive,
  draw,
  handleTouch,
  clear,
}
