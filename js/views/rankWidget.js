/**
 * 结算页/战斗结束页用的紧凑型"排行榜·我第 N 名"入口挂件
 *   · 单行胶囊，左侧榜单图标 + 名次文字，右侧箭头
 *   · 点击后切换到 ranking 场景并定位到对应 Tab
 *   · 支持"名次变动"数字滚动动画 + ↑N 徽章 + 金光呼吸，让玩家非常显性地感知排名变化
 *
 * 与 rankChangePopup 的关系：
 *   · rankChangePopup 处理"名次变动的情绪峰值"（一次性浮层、带大动画）
 *   · rankWidget 处理"我目前排第几"的常驻呈现（可反复点击，提供入口）
 *   · 两者都会在 _emitFeedback 触发：rankChangePopup 消费 pendingFeedback（高优先级场景），
 *     rankWidget 自己存一份轻量动画数据 _animState（每次出现都能表现出来，不被消费）
 */
const V = require('./env')

// ============================================================
// 动画参数（tune 时改这里就够）
// ============================================================

// 数字滚动 + 金光呼吸 + 徽章入场，整个动画主段 ≈ 900ms
const ROLL_DURATION = 900
// 徽章出现后继续浮动显示的时长（含淡出），强化"我名次刚刚变了"的持续感知
const BADGE_LINGER = 3200
// 动画完全结束后的总时长
const ANIM_TOTAL = ROLL_DURATION + BADGE_LINGER

// Tab 配置：标签文案与主色；保持与 rankChangePopup.TAB_META 语义一致
const TAB_META = {
  stage: { label: '秘境榜', color: '#D4A853' },
  tower: { label: '通天塔', color: '#6FB8E3' },
  towerWeekly: { label: '通天塔·本周', color: '#E3B66F' },
  dex: { label: '图鉴榜', color: '#A86FE3' },
  combo: { label: '连击榜', color: '#FF6F6F' },
}

// ============================================================
// 名次变动动画状态（模块级，按 tab 独立）
// ------------------------------------------------------------
// 写入入口：rankingService._emitFeedback 探测到 prev→curr 变化时调用 noteRankChange
// 消费入口：drawRankWidget 在绘制时顺带播放（不消费掉，5s 左右自然过期）
// ============================================================
const _animState = {}

/** 把 ':tier' 等后缀剥掉，让同一个榜的档位 / 全服两条数据合并到同一个动画槽 */
function _normalizeTab(tab) {
  if (!tab) return tab
  const idx = tab.indexOf(':')
  return idx === -1 ? tab : tab.substring(0, idx)
}

/**
 * 由 rankingService 调用：记录一次名次变化，后续 drawRankWidget 会把它展开成动画。
 * prev/curr 都必须是正整数才会触发（首次上榜 prev<=0 → 不动画，避免 0→N 假阳性滚动）
 */
function noteRankChange(rawTab, prev, curr) {
  if (curr == null || curr <= 0) return
  if (prev == null || prev <= 0) return
  const tab = _normalizeTab(rawTab)
  const delta = prev - curr
  if (delta === 0) return
  _animState[tab] = {
    prev,
    curr,
    delta,
    startTs: Date.now(),
  }
}

/** 清掉某个 tab 的动画状态（如手动 reset 场景），正常情况下靠时间自然过期 */
function clearAnim(tab) {
  if (!tab) return
  delete _animState[_normalizeTab(tab)]
}

// 工具：缓动 / 数值插值
function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }
function _easeOutBack(t) { const s = 1.70158; const p = t - 1; return p * p * ((s + 1) * p + s) + 1 }
function _clamp01(v) { return Math.max(0, Math.min(1, v)) }

// ============================================================
// 绘制
// ============================================================

/**
 * 绘制入口挂件。
 * @param {CanvasRenderingContext2D} c
 * @param {*} R 渲染工具（提供 rr 等）
 * @param {number} S 缩放系数
 * @param {number} x 胶囊左上角 x
 * @param {number} y 胶囊左上角 y
 * @param {number} w 胶囊可用宽度（最大值）
 * @param {string} tab 目标榜单 key（'stage' | 'tower' | 'towerWeekly' | 'dex' | 'combo'）
 * @param {number} myRank 当前名次（>0 才会绘制；-1/0 返回 null）
 * @param {object} [opts]
 * @param {string} [opts.prefix] 左侧标签（默认取 TAB_META[tab].label）
 * @returns {{rect:[number,number,number,number], height:number, tab:string} | null}
 */
function drawRankWidget(c, R, S, x, y, w, tab, myRank, opts) {
  if (!myRank || myRank <= 0) return null
  const meta = TAB_META[tab] || TAB_META.stage
  const prefix = (opts && opts.prefix) || meta.label
  const h = 30 * S
  const capW = Math.min(w, 260 * S)
  const capX = x + (w - capW) / 2
  const capY = y

  // 取动画态（可能为 null）；过期 5s 的自动丢弃，避免长时间停留还闪
  const anim = _computeAnimForTab(_normalizeTab(tab))

  c.save()
  // 背景：深底 + 榜单主色描边
  const grad = c.createLinearGradient(capX, capY, capX, capY + h)
  grad.addColorStop(0, 'rgba(40,32,22,0.88)')
  grad.addColorStop(1, 'rgba(24,20,14,0.92)')
  c.fillStyle = grad
  R.rr(capX, capY, capW, h, h / 2); c.fill()

  // 名次上升时的金光呼吸（仅在动画 roll 阶段最强，之后衰减到 0）
  const pulseIntensity = anim && anim.isUp ? anim.pulse : 0
  if (pulseIntensity > 0) {
    c.save()
    c.shadowColor = 'rgba(255,214,120,0.9)'
    c.shadowBlur = (8 + 8 * pulseIntensity) * S
    c.strokeStyle = `rgba(255,214,120,${0.6 + 0.35 * pulseIntensity})`
    c.lineWidth = (1.2 + 0.8 * pulseIntensity) * S
    R.rr(capX, capY, capW, h, h / 2); c.stroke()
    c.restore()
  } else {
    c.strokeStyle = _rgba(meta.color, 0.65)
    c.lineWidth = 1.2 * S
    R.rr(capX, capY, capW, h, h / 2); c.stroke()
  }

  // 左侧：圆点 + 榜单名
  const leftPadX = capX + 14 * S
  const midY = capY + h / 2
  c.fillStyle = meta.color
  c.beginPath(); c.arc(leftPadX, midY, 4 * S, 0, Math.PI * 2); c.fill()

  c.textBaseline = 'middle'
  c.textAlign = 'left'
  c.fillStyle = '#E8D6AE'
  c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  const prefixText = `${prefix} ·`
  c.fillText(prefixText, leftPadX + 10 * S, midY)
  const prefixW = c.measureText(prefixText).width

  // 中间：名次数字（动画期间滚动，稳定期直接画 curr）
  //   · 滚动期：anim.displayRank 从 prev 按缓动插值到 curr；配合金色/白色强调
  //   · 稳定期：直接画 myRank
  const displayRank = anim ? anim.displayRank : myRank
  const rollingNow = anim && anim.rollingNow
  const numColor = rollingNow
    ? (anim.isUp ? '#FFF4CE' : '#E8D6AE')
    : '#FFE29A'
  const numFontSize = rollingNow ? 15 * S : 14 * S  // 滚动期稍微放大，视觉更跳
  c.fillStyle = numColor
  c.font = `bold ${numFontSize}px "PingFang SC",sans-serif`
  const rankStr = displayRank > 999 ? '999+' : String(displayRank)
  const numX = leftPadX + 10 * S + prefixW + 6 * S
  // 滚动期数字加阴影，结束后还原
  if (rollingNow && anim.isUp) {
    c.save()
    c.shadowColor = 'rgba(255,214,120,0.95)'
    c.shadowBlur = 8 * S
    c.fillText(rankStr, numX, midY - 0.5 * S)
    c.restore()
  } else {
    c.fillText(rankStr, numX, midY - 0.5 * S)
  }
  const numW = c.measureText(rankStr).width

  c.fillStyle = '#E8D6AE'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.fillText('名', numX + numW + 2 * S, midY)

  // 右侧："查看 >"
  const rightX = capX + capW - 14 * S
  c.textAlign = 'right'
  c.fillStyle = _rgba(meta.color, 0.95)
  c.font = `${10 * S}px "PingFang SC",sans-serif`
  c.fillText('查看 ›', rightX, midY)

  c.restore()

  // 最后画：↑N 金色徽章（上升时）或 ↓N 灰色徽章（下降时），浮动+弹入+淡出
  //   · 放在 restore 之后独立 save/restore，方便用独立阴影/透明度
  //   · 徽章锚在数字右上角外侧
  if (anim && anim.badgeAlpha > 0) {
    _drawDeltaBadge(c, S, numX + numW / 2, capY, anim)
  }

  return {
    rect: [capX, capY, capW, h],
    height: h,
    tab,
  }
}

/**
 * 根据当前时间，把 _animState 里的原始 {prev, curr, delta, startTs} 展开成
 *   · displayRank  - 当前帧应显示的名次（整数，滚动插值后四舍五入）
 *   · rollingNow   - 是否正在数字滚动阶段
 *   · pulse        - 金光呼吸强度（0~1，在 roll 阶段走满再缓出）
 *   · badgeAlpha   - ↑N 徽章的透明度（roll 开始就有，linger 末段淡出）
 *   · badgeScale   - ↑N 徽章入场弹跳缩放
 *   · badgeOffsetY - ↑N 徽章上浮距离（跟随 linger 阶段慢慢飘高 + 微抖）
 *   · isUp         - 是否名次上升（颜色配色相关）
 * 超过 ANIM_TOTAL 自动过期并返回 null（下次 draw 不再绘制动画，仅显示静态）
 */
function _computeAnimForTab(tab) {
  const s = _animState[tab]
  if (!s) return null
  const now = Date.now()
  const elapsed = now - s.startTs
  if (elapsed >= ANIM_TOTAL) {
    delete _animState[tab]
    return null
  }

  const isUp = s.delta > 0
  const deltaAbs = Math.abs(s.delta)

  // 滚动阶段：0~ROLL_DURATION
  let rollingNow = false
  let displayRank = s.curr
  let pulse = 0
  if (elapsed < ROLL_DURATION) {
    rollingNow = true
    const p = _easeOutCubic(_clamp01(elapsed / ROLL_DURATION))
    displayRank = Math.round(s.prev + (s.curr - s.prev) * p)
    // 金光呼吸：前半段走强、后半段回落
    pulse = Math.sin(p * Math.PI)  // 0 → 1 → 0
  }

  // 徽章阶段：从 roll 开始出现，一直持续到 ANIM_TOTAL 结束
  let badgeAlpha = 1
  let badgeScale = 1
  let badgeOffsetY = 0
  if (elapsed < 200) {
    // 入场：250ms bounce 放大进来
    const p = _clamp01(elapsed / 200)
    badgeScale = _easeOutBack(p) * 1.0 + 0.4 * (1 - p)
    badgeAlpha = p
  } else if (elapsed < ANIM_TOTAL - 400) {
    // linger：慢慢上浮 + 微小呼吸，alpha = 1
    const lingerElapsed = elapsed - 200
    const lingerTotal = ANIM_TOTAL - 400 - 200
    const lp = _clamp01(lingerElapsed / lingerTotal)
    badgeOffsetY = -lp * 6  // 往上飘 6*S（乘 S 在调用处）
    badgeScale = 1 + 0.03 * Math.sin(elapsed / 200)
    badgeAlpha = 1
  } else {
    // 末段 400ms：淡出
    const p = _clamp01((elapsed - (ANIM_TOTAL - 400)) / 400)
    badgeAlpha = 1 - p
    badgeOffsetY = -6 - p * 3
    badgeScale = 1 - p * 0.1
  }

  return {
    displayRank,
    rollingNow,
    pulse,
    badgeAlpha,
    badgeScale,
    badgeOffsetY,
    isUp,
    deltaAbs,
  }
}

/** 画 ↑N / ↓N 的名次变动徽章：胶囊金边，alpha + scale + offsetY 由动画态驱动 */
function _drawDeltaBadge(c, S, anchorX, anchorY, anim) {
  const { isUp, deltaAbs, badgeAlpha, badgeScale, badgeOffsetY } = anim
  const text = (isUp ? '↑' : '↓') + deltaAbs
  const fontSize = 11 * S
  c.save()
  c.globalAlpha *= badgeAlpha
  c.font = `bold ${fontSize}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const textW = c.measureText(text).width
  const padX = 8 * S
  const badgeW = textW + padX * 2
  const badgeH = 16 * S
  // 锚点：胶囊数字上方 + 动画上浮量
  const cx = anchorX
  const cy = anchorY - badgeH / 2 - 2 * S + badgeOffsetY * S
  // scale transform：以胶囊中心为锚点
  c.translate(cx, cy)
  c.scale(badgeScale, badgeScale)
  // 背景：上升金色渐变 + 金色阴影；下降暗冷色
  if (isUp) {
    c.shadowColor = 'rgba(255,180,50,0.9)'
    c.shadowBlur = 10 * S
    const grad = c.createLinearGradient(0, -badgeH / 2, 0, badgeH / 2)
    grad.addColorStop(0, '#FFE890')
    grad.addColorStop(1, '#E89A2C')
    c.fillStyle = grad
  } else {
    c.shadowColor = 'rgba(120,140,180,0.6)'
    c.shadowBlur = 4 * S
    c.fillStyle = 'rgba(120,130,160,0.9)'
  }
  _roundRect(c, -badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2)
  c.fill()
  c.shadowBlur = 0
  // 描边
  c.strokeStyle = isUp ? 'rgba(255,255,255,0.85)' : 'rgba(220,225,240,0.5)'
  c.lineWidth = 1 * S
  _roundRect(c, -badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2)
  c.stroke()
  // 文字
  c.fillStyle = isUp ? '#5A2F00' : '#FFFFFF'
  c.fillText(text, 0, 0)
  c.restore()
}

function _roundRect(c, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  c.beginPath()
  c.moveTo(x + rr, y)
  c.lineTo(x + w - rr, y)
  c.quadraticCurveTo(x + w, y, x + w, y + rr)
  c.lineTo(x + w, y + h - rr)
  c.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  c.lineTo(x + rr, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - rr)
  c.lineTo(x, y + rr)
  c.quadraticCurveTo(x, y, x + rr, y)
  c.closePath()
}

/**
 * 命中测试 + 跳转：点到挂件则切到 ranking 场景并锁定 Tab。
 * @returns {boolean} 是否被消费
 */
function handleTap(g, widget, x, y) {
  if (!widget || !widget.rect) return false
  const [rx, ry, rw, rh] = widget.rect
  if (x < rx || x > rx + rw || y < ry || y > ry + rh) return false
  const targetTab = widget.tab === 'towerWeekly' ? 'tower' : widget.tab
  g.rankTab = targetTab || 'stage'
  g.rankSource = 'all'
  if (widget.tab === 'towerWeekly') g.rankTowerPeriod = 'weekly'
  try { require('./rankChangePopup').drainPending(g) } catch (_e) { /* 容错 */ }
  g.setScene('ranking')
  try { require('../runtime/music').playClick && require('../runtime/music').playClick() } catch (_e) { /* 容错 */ }
  return true
}

function _rgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

module.exports = { drawRankWidget, handleTap, noteRankChange, clearAnim, TAB_META }
