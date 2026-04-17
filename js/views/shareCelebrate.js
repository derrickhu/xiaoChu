/**
 * 炫耀卡弹窗 — shareCelebrate
 *
 * 情绪峰值（首通 1-1 得首宠 / 首次 S / 升星 3★ / 章通关 / 塔新高）触发时：
 *   1. 底部 2 秒前置延迟（让玩家先感受完 lingCheer + 爆点）
 *   2. 自动滑入一张卡片：预览图（shareCard 合成的 tempPath）+ 文案 + 两键分享 + 稍后再说
 *   3. 2 秒后按钮亮起（防误触，半强制）
 *   4. "发给好友" / "发到朋友圈" / "稍后再说" 都会关闭弹窗
 *
 * 状态机：
 *   hidden  -> pending (等生成 tempPath)
 *   pending -> entering (卡片滑入)
 *   entering -> ready (按钮亮起)
 *   ready -> exiting -> hidden
 *
 * 使用：
 *   shareCelebrate.trigger(g, 'firstPet', { petName: '...' })
 *
 * 渲染：
 *   main.js 每帧 draw()（在 lingCheer 之前、buttonFx/floatText 之后）
 * 触摸：
 *   touchHandlers 在分发前先问 shareCelebrate.handleTouch(type, x, y) → 吞掉 true
 */
const V = require('./env')
const { LING } = require('../data/lingIdentity')
const { SHARE_SCENES } = require('../data/shareConfig')
const shareCard = require('./shareCard')
const analytics = require('../data/analytics')
const P = require('../platform')

// ===== 时序常量（ms） =====
const DELAY_BEFORE_SHOW = 1800   // 情绪 buffer：爽劲散开后再弹
const ENTER_DUR = 280
const BTN_UNLOCK_AFTER = 1600    // 卡片滑入完成后多久解锁按钮（半强制）
const EXIT_DUR = 220

// ===== 状态 =====
let _state = null
// _state = { phase, elapsed, sceneKey, data, cardPath, g, rects }

// ===== 圆角矩形 =====
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

// ===== 图片缓存（tempPath → Image），避免每帧 load =====
const _previewImgCache = new Map()
function _ensurePreviewImg(tempPath) {
  if (!tempPath) return null
  if (_previewImgCache.has(tempPath)) return _previewImgCache.get(tempPath)
  const img = P.createImage()
  img.src = tempPath
  _previewImgCache.set(tempPath, img)
  return img
}

/**
 * 触发一次炫耀卡弹窗
 * 幂等：若当前已有弹窗在展示，新 trigger 会被忽略（避免冲塞）
 * @param {object} g
 * @param {string} sceneKey
 * @param {object} data
 */
function trigger(g, sceneKey, data) {
  if (_state) return false
  const cfg = SHARE_SCENES[sceneKey]
  if (!cfg) return false

  _state = {
    phase: 'pending',
    elapsed: 0,
    sceneKey,
    data: data || {},
    cardPath: null,
    g,
    rects: {},
  }

  // 异步合成炫耀卡 tempPath（失败则 cardPath = null，走静态图）
  shareCard.generateCard(g.storage, sceneKey, data).then((tempPath) => {
    if (_state && _state.sceneKey === sceneKey) {
      _state.cardPath = tempPath
    }
  }).catch(() => {})

  analytics.track('share_card_shown', { scene: sceneKey })
  return true
}

function dismiss() {
  if (!_state) return
  _state.phase = 'exiting'
  _state.elapsed = 0
}

function isActive() { return !!_state }

// ===== 每帧更新（由 main.js draw 调用前推进时间） =====
//   这里不单独拆 update 接口，复用 draw 内的 elapsed++，简化调用方
function _advance(state, dt) {
  state.elapsed += dt
  if (state.phase === 'pending') {
    if (state.elapsed >= DELAY_BEFORE_SHOW) {
      state.phase = 'entering'
      state.elapsed = 0
    }
  } else if (state.phase === 'entering') {
    if (state.elapsed >= ENTER_DUR + BTN_UNLOCK_AFTER) {
      state.phase = 'ready'
      state.elapsed = 0
    }
  } else if (state.phase === 'exiting') {
    if (state.elapsed >= EXIT_DUR) {
      _state = null
    }
  }
}

function draw() {
  if (!_state) return
  const state = _state
  _advance(state, 16)
  if (!_state) return
  if (state.phase === 'pending') return  // 等待期不画任何东西

  const { ctx, S, W, H, safeTop } = V

  // 滑入 / 滑出动画进度
  let t = 1
  if (state.phase === 'entering') {
    t = Math.min(1, state.elapsed / ENTER_DUR)
  } else if (state.phase === 'exiting') {
    t = 1 - Math.min(1, state.elapsed / EXIT_DUR)
  }
  // easeOutCubic
  const ease = 1 - Math.pow(1 - t, 3)

  // ---- 全屏暗色背景（拦截视觉）----
  ctx.save()
  ctx.fillStyle = `rgba(0,0,0,${0.65 * ease})`
  ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // ---- 卡片主面板 ----
  const panelW = Math.min(W - 40 * S, 340 * S)
  const previewW = panelW - 24 * S
  const previewH = previewW * 0.8   // 5:4 比
  const titleH = 36 * S
  const metaH = 56 * S
  const btnH = 46 * S
  const btnGap = 10 * S
  const innerPad = 12 * S
  const panelH = titleH + previewH + metaH + btnH + btnGap + 50 * S + innerPad * 2
  const panelX = (W - panelW) / 2
  // 从屏外滑入（向下滑入）
  const targetY = Math.max(safeTop + 40 * S, (H - panelH) / 2 - 20 * S)
  const startY = -panelH - 20 * S
  const panelY = startY + (targetY - startY) * ease

  ctx.save()

  // 面板底（深色 + 金边）
  _rr(ctx, panelX, panelY, panelW, panelH, 16 * S)
  const grad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  grad.addColorStop(0, '#2a1f44')
  grad.addColorStop(1, '#15102a')
  ctx.fillStyle = grad
  ctx.fill()

  // 金色外描边
  ctx.strokeStyle = 'rgba(220,180,80,0.85)'
  ctx.lineWidth = 1.5 * S
  _rr(ctx, panelX + 1 * S, panelY + 1 * S, panelW - 2 * S, panelH - 2 * S, 15 * S)
  ctx.stroke()

  // ---- 标题：小灵头像 + "想分享给好友吗？" ----
  const titleY = panelY + innerPad + titleH / 2
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const ar = 14 * S
  const acx = panelX + innerPad + ar
  ctx.save()
  ctx.beginPath(); ctx.arc(acx, titleY, ar + 1 * S, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(220,180,80,0.9)'; ctx.fill()
  ctx.beginPath(); ctx.arc(acx, titleY, ar, 0, Math.PI * 2); ctx.clip()
  // 小灵头像（由 R 级图缓存提供）
  const R = V.R
  if (R && R.getImg && LING && LING.avatar) {
    const img = R.getImg(LING.avatar)
    if (img && img.width > 0) ctx.drawImage(img, acx - ar, titleY - ar, ar * 2, ar * 2)
  }
  ctx.restore()

  ctx.fillStyle = '#ffe082'
  ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  ctx.fillText('主人，要把这份喜悦带出去吗？', acx + ar + 8 * S, titleY)

  // ---- 预览区 ----
  const previewX = panelX + (panelW - previewW) / 2
  const previewY = panelY + innerPad + titleH + 6 * S
  _rr(ctx, previewX, previewY, previewW, previewH, 10 * S)
  ctx.fillStyle = '#0a0818'
  ctx.fill()
  ctx.save()
  _rr(ctx, previewX, previewY, previewW, previewH, 10 * S)
  ctx.clip()
  const img = _ensurePreviewImg(state.cardPath)
  if (img && img.width > 0) {
    ctx.drawImage(img, previewX, previewY, previewW, previewH)
  } else {
    // 占位：说明正在合成
    ctx.fillStyle = '#1a1330'
    ctx.fillRect(previewX, previewY, previewW, previewH)
    ctx.fillStyle = '#b8a070'
    ctx.font = `${13 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('炫耀卡合成中...', previewX + previewW / 2, previewY + previewH / 2)
  }
  ctx.restore()

  // 金边
  ctx.strokeStyle = 'rgba(220,180,80,0.6)'
  ctx.lineWidth = 1 * S
  _rr(ctx, previewX, previewY, previewW, previewH, 10 * S)
  ctx.stroke()

  // ---- 奖励提示（在预览下方） ----
  const cfg = SHARE_SCENES[state.sceneKey]
  const rewardText = _formatReward(cfg && cfg.reward)
  const metaY = previewY + previewH + 14 * S
  if (rewardText) {
    ctx.fillStyle = '#ffd580'
    ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(rewardText, panelX + panelW / 2, metaY)
  }
  // 日常分享奖励说明（灰字）
  ctx.fillStyle = '#8a8098'
  ctx.font = `${10.5 * S}px "PingFang SC",sans-serif`
  ctx.fillText('每日分享另得体力奖励', panelX + panelW / 2, metaY + 18 * S)

  // ---- 按钮 ----
  const btnUnlocked = state.phase === 'ready'
  const btnY = metaY + 36 * S
  const btnGapX = 10 * S
  const hasTimeline = P.hasShareTimeline
  const btnCount = hasTimeline ? 2 : 1
  const btnW = (panelW - innerPad * 2 - btnGapX * (btnCount - 1)) / btnCount

  const btn1X = panelX + innerPad
  _drawBtn(ctx, S, btn1X, btnY, btnW, btnH, {
    text: '发给好友',
    style: 'gold',
    enabled: btnUnlocked,
  })
  state.rects.btnFriend = [btn1X, btnY, btnW, btnH]

  if (hasTimeline) {
    const btn2X = btn1X + btnW + btnGapX
    _drawBtn(ctx, S, btn2X, btnY, btnW, btnH, {
      text: '发朋友圈',
      style: 'milestone',
      enabled: btnUnlocked,
    })
    state.rects.btnTimeline = [btn2X, btnY, btnW, btnH]
  } else {
    state.rects.btnTimeline = null
  }

  // ---- "稍后再说" 小字 ----
  const dismissY = btnY + btnH + 22 * S
  ctx.fillStyle = btnUnlocked ? '#8a8098' : '#4a4358'
  ctx.font = `${12 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('稍后再说', panelX + panelW / 2, dismissY)
  state.rects.btnDismiss = [panelX + panelW / 2 - 50 * S, dismissY - 12 * S, 100 * S, 26 * S]

  ctx.restore()
}

// ===== 简化版按钮（不依赖 drawPrimaryButton，独立自绘保证可移植） =====
function _drawBtn(ctx, S, x, y, w, h, opts) {
  const enabled = opts.enabled !== false
  const r = h / 2
  _rr(ctx, x, y, w, h, r)
  let g1, g2
  if (opts.style === 'milestone') {
    g1 = enabled ? '#c7a0ff' : '#3a2c55'
    g2 = enabled ? '#7a4fbe' : '#271d40'
  } else {
    g1 = enabled ? '#ffd580' : '#4a3d28'
    g2 = enabled ? '#c79640' : '#2a2318'
  }
  const grad = ctx.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, g1)
  grad.addColorStop(1, g2)
  ctx.fillStyle = grad
  ctx.fill()
  ctx.strokeStyle = enabled ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1 * S
  _rr(ctx, x + 0.5 * S, y + 0.5 * S, w - 1 * S, h - 1 * S, r - 0.5 * S)
  ctx.stroke()
  ctx.fillStyle = enabled ? '#ffffff' : 'rgba(255,255,255,0.4)'
  ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(opts.text || '', x + w / 2, y + h / 2)
}

function _formatReward(reward) {
  if (!reward) return ''
  const parts = []
  if (reward.soulStone) parts.push(`灵石+${reward.soulStone}`)
  if (reward.fragment) parts.push(`万能碎片+${reward.fragment}`)
  if (reward.stamina) parts.push(`体力+${reward.stamina}`)
  return parts.length ? `分享奖励：${parts.join('  ')}` : ''
}

// ===== 命中检测 =====
function _hit(rect, x, y) {
  if (!rect) return false
  return x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]
}

/**
 * 触摸事件入口
 * @param {'start'|'move'|'end'} type
 * @param {number} x
 * @param {number} y
 * @returns {boolean} true = 事件被吞（上层应忽略）
 */
function handleTouch(type, x, y) {
  if (!_state) return false
  // pending / entering / exiting 都吞事件，避免穿透操作底层
  if (type !== 'end') return true
  if (_state.phase !== 'ready') return true

  const { rects, sceneKey, data, g } = _state
  if (_hit(rects.btnFriend, x, y)) {
    analytics.track('share_card_clicked', { scene: sceneKey, mode: 'friend' })
    _doShare(g, sceneKey, data, 'friend')
    dismiss()
    return true
  }
  if (_hit(rects.btnTimeline, x, y)) {
    analytics.track('share_card_clicked', { scene: sceneKey, mode: 'timeline' })
    _doShare(g, sceneKey, data, 'timeline')
    dismiss()
    return true
  }
  if (_hit(rects.btnDismiss, x, y)) {
    analytics.track('share_card_dismissed', { scene: sceneKey })
    dismiss()
    return true
  }
  return true
}

function _doShare(g, sceneKey, data, mode) {
  const { shareCore } = require('../share')
  // 带上合成图（若已合成成功）
  const mergedData = Object.assign({}, data, { cardTempPath: _state && _state.cardPath })
  shareCore(g, sceneKey, mergedData, { mode })
}

module.exports = { trigger, dismiss, isActive, draw, handleTouch }
