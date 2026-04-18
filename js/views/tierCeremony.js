/**
 * 段位晋升仪式 —— tierCeremony
 *
 * 玩家每次跨过段位阈值（凡尘 → 炼气 / 筑基 / 金丹 …）时触发的沉浸式弹窗。
 * 相比 shareCelebrate（战绩炫耀），tierCeremony 是"身份进阶"：
 *   · 全屏暗遮罩 + 中央徽章放大动画 + 段位名金光 + XiaoLing 一句话
 *   · "继续"按钮关闭；"分享"按钮走 shareCore('tierUp', ...)（底图复用 chapterComplete）
 *
 * 状态机：hidden → entering (280ms) → ready → exiting (220ms) → hidden
 *
 * 调用：
 *   tierCeremony.trigger(g, prevTier, currTier)
 */
const V = require('./env')
const { LING } = require('../data/lingIdentity')
const analytics = require('../data/analytics')

const ENTER_DUR = 360
const EXIT_DUR = 240
const BTN_UNLOCK_AFTER = 600

let _state = null

function _rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y); c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

function isActive() { return !!_state }

/**
 * 启动仪式
 * @param {object} g 游戏上下文
 * @param {object} prev 旧境界对象（来自 storage.checkCultRealmUp）
 * @param {object} curr 新段位对象
 */
function trigger(g, prev, curr) {
  if (!curr) return false
  if (_state) return false
  _state = {
    phase: 'entering',
    elapsed: 0,
    prev,
    curr,
    g,
    lastTs: Date.now(),
    rects: { continueBtn: null, shareBtn: null },
  }
  analytics.track('tier_up', {
    from: (prev && prev.id) || 'mortal',
    to: curr.id,
  })
  return true
}

function dismiss() {
  if (!_state) return
  _state.phase = 'exiting'
  _state.elapsed = 0
  _state.lastTs = Date.now()
}

function _complete() {
  _state = null
}

/** 外部（如 gameLoop）每帧更新计时；这里直接在 draw 里基于 Date.now 推进 */
function _tick() {
  if (!_state) return
  const now = Date.now()
  const dt = Math.max(0, now - _state.lastTs)
  _state.lastTs = now
  _state.elapsed += dt
  if (_state.phase === 'entering' && _state.elapsed >= ENTER_DUR) {
    _state.phase = 'ready'
    _state.elapsed = 0
  } else if (_state.phase === 'exiting' && _state.elapsed >= EXIT_DUR) {
    _complete()
  }
}

function _easeOutBack(t) {
  const s = 1.7
  const p = t - 1
  return p * p * ((s + 1) * p + s) + 1
}

function _easeInCubic(t) { return t * t * t }

function draw() {
  _tick()
  if (!_state) return
  const { ctx, W, H, S } = V
  const { phase, elapsed, prev, curr } = _state

  // 整体进度 alpha / scale
  let overlayAlpha = 1
  let scale = 1
  if (phase === 'entering') {
    const t = Math.min(1, elapsed / ENTER_DUR)
    overlayAlpha = t
    scale = 0.55 + _easeOutBack(t) * 0.45
  } else if (phase === 'exiting') {
    const t = Math.min(1, elapsed / EXIT_DUR)
    overlayAlpha = 1 - _easeInCubic(t)
    scale = 1 - _easeInCubic(t) * 0.15
  }

  // 全屏暗遮罩（阻挡下层点击）
  ctx.save()
  ctx.fillStyle = `rgba(6,8,14,${0.72 * overlayAlpha})`
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // 中央光晕：段位色径向光
  const cx = W / 2
  const cy = H * 0.42
  ctx.save()
  ctx.globalAlpha = overlayAlpha
  const g1 = ctx.createRadialGradient(cx, cy, 8 * S, cx, cy, 220 * S)
  g1.addColorStop(0, curr.color + 'cc')
  g1.addColorStop(0.6, curr.color + '22')
  g1.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g1
  ctx.beginPath(); ctx.arc(cx, cy, 220 * S, 0, Math.PI * 2); ctx.fill()
  ctx.restore()

  // 徽章圆（大）
  ctx.save()
  ctx.globalAlpha = overlayAlpha
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  const badgeR = 72 * S
  // 外环金线
  ctx.strokeStyle = '#FFD770'
  ctx.lineWidth = 3 * S
  ctx.beginPath(); ctx.arc(0, 0, badgeR + 6 * S, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = curr.accent
  ctx.lineWidth = 1.5 * S
  ctx.beginPath(); ctx.arc(0, 0, badgeR + 12 * S, 0, Math.PI * 2); ctx.stroke()
  // 内圆填色
  const gBadge = ctx.createLinearGradient(0, -badgeR, 0, badgeR)
  gBadge.addColorStop(0, curr.color)
  gBadge.addColorStop(1, curr.accent)
  ctx.fillStyle = gBadge
  ctx.beginPath(); ctx.arc(0, 0, badgeR, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.arc(0, 0, badgeR - 4 * S, 0, Math.PI * 2); ctx.stroke()
  // 段位名
  ctx.fillStyle = '#FFF8DC'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `bold ${38 * S}px "PingFang SC",sans-serif`
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 8 * S; ctx.shadowOffsetY = 2 * S
  ctx.fillText(curr.name, 0, 2 * S)
  ctx.restore()

  // 标题："境界晋升"
  ctx.save()
  ctx.globalAlpha = overlayAlpha
  ctx.textAlign = 'center'
  ctx.fillStyle = '#FFD770'
  ctx.font = `bold ${22 * S}px "PingFang SC",sans-serif`
  ctx.fillText('— 境界晋升 —', cx, cy - badgeR - 36 * S)
  ctx.restore()

  // 副标题：prev → curr
  const subY = cy + badgeR + 30 * S
  ctx.save()
  ctx.globalAlpha = overlayAlpha
  ctx.textAlign = 'center'
  ctx.fillStyle = '#E8E2D0'
  ctx.font = `${14 * S}px "PingFang SC",sans-serif`
  const prevName = (prev && prev.name) || '凡尘'
  ctx.fillText(`${prevName}  →  ${curr.name}`, cx, subY)
  ctx.restore()

  // motto（XiaoLing 一句话，已在 CULT_REALMS.motto 预设）
  if (curr.motto) {
    ctx.save()
    ctx.globalAlpha = overlayAlpha
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,240,200,0.92)'
    ctx.font = `${13 * S}px "PingFang SC",sans-serif`
    // motto 前加 XiaoLing 身份前缀
    const speaker = (LING && LING.displayName) ? `【${LING.displayName}】 ` : ''
    ctx.fillText(`${speaker}${curr.motto}`, cx, subY + 24 * S)
    ctx.restore()
  }

  // 按钮：继续（进入结束后亮起）
  if (phase !== 'entering' || elapsed >= BTN_UNLOCK_AFTER) {
    const btnW = 120 * S, btnH = 38 * S
    const btnX = cx - btnW / 2
    const btnY = subY + 60 * S
    ctx.save()
    ctx.globalAlpha = overlayAlpha
    const gBtn = ctx.createLinearGradient(0, btnY, 0, btnY + btnH)
    gBtn.addColorStop(0, '#E8B04A'); gBtn.addColorStop(1, '#B47A18')
    ctx.fillStyle = gBtn
    _rr(ctx, btnX, btnY, btnW, btnH, btnH * 0.5); ctx.fill()
    ctx.strokeStyle = 'rgba(120,60,0,0.5)'; ctx.lineWidth = 1.2 * S
    _rr(ctx, btnX, btnY, btnW, btnH, btnH * 0.5); ctx.stroke()
    ctx.fillStyle = '#2a1a00'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.fillText('继续修行', btnX + btnW / 2, btnY + btnH / 2)
    ctx.restore()
    _state.rects.continueBtn = [btnX, btnY, btnW, btnH]
  } else {
    _state.rects.continueBtn = null
  }
}

function handleTouch(type, x, y) {
  if (!_state) return false
  if (_state.phase !== 'ready') return true  // 动画中全吞
  if (type !== 'end') return true
  const r = _state.rects.continueBtn
  if (r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]) {
    // 顺带触发境界大跨档的炫耀卡（shareCelebrate 内部 1800ms pending buffer，
    // 正好让 tierCeremony 的 240ms exit 动画先跑完，两者时序无缝衔接，不会双全屏打架）
    const g = _state.g
    const prev = _state.prev
    const curr = _state.curr
    dismiss()
    if (g && curr) {
      try {
        const shareHooks = require('../data/shareHooks')
        shareHooks.onRealmUp(g, {
          realmId: curr.id,
          prevName: (prev && prev.name) || '凡尘',
          currName: curr.name,
          prev, curr,
        })
      } catch (_e) { /* ignore：分享钩子异常不影响仪式关闭 */ }
    }
    return true
  }
  return true  // 非按钮区域也吞，避免点透
}

module.exports = { trigger, dismiss, isActive, draw, handleTouch }
