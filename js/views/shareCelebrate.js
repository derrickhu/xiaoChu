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
const { drawRewardSlotChips, getShareRewardSlots } = require('./rewardChipFlyAnim')
const { previewShareReward } = require('../data/shareRewardCalc')

// ===== 时序常量（ms） =====
const DELAY_BEFORE_SHOW = 1800   // 情绪 buffer：爽劲散开后再弹
const ENTER_DUR = 280
const BTN_UNLOCK_AFTER = 1600    // 卡片滑入完成后多久解锁按钮（半强制）
const EXIT_DUR = 220

// ===== 状态 =====
let _state = null
// _state = { phase, elapsed, sceneKey, data, cardPath, cardStatus, fallbackPath, g, rects }
// cardStatus: 'loading' | 'ready' | 'failed'
//   · loading → 画"炫耀卡合成中..."
//   · ready   → 画 cardPath 合成图
//   · failed  → 画 fallbackPath（静态底图 cardTemplate.jpg），右下角"默认样式"小角标
// 兜底时序：
//   · shareCard.generateCard 内置 4s 硬超时，超时算失败
//   · 本弹窗再加一层 4.5s 安全兜底：万一上游 promise 意外丢失回调，
//     兜底定时器也能把 cardStatus 从 loading 推到 failed

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
/**
 * 弹出炫耀卡
 * @param {object} g
 * @param {string} sceneKey
 * @param {object} data
 * @param {object} [opts]
 * @param {Function} [opts.onConfirm] 玩家真正点"分享给好友/朋友圈"时触发（用于"稍后再说不 mark flag"策略）
 */
function trigger(g, sceneKey, data, opts) {
  if (_state) return false
  const cfg = SHARE_SCENES[sceneKey]
  if (!cfg) return false

  const fallbackPath = shareCard.getCardTemplatePath(sceneKey) || cfg.imageUrl || null
  const onConfirm = opts && typeof opts.onConfirm === 'function' ? opts.onConfirm : null

  _state = {
    phase: 'pending',
    elapsed: 0,
    sceneKey,
    data: data || {},
    cardPath: null,
    cardStatus: 'loading',
    fallbackPath,
    onConfirm,
    g,
    rects: {},
  }

  // 异步合成动态炫耀卡
  //   · 成功 → cardStatus = 'ready'，预览区画合成图
  //   · 失败（含返回 null / 超时 / 抛错）→ cardStatus = 'failed'，预览区降级为 fallbackPath 静态底图
  //   关键：任何分支都要显式写入 cardStatus，否则会永远卡在"loading"
  shareCard.generateCard(g.storage, sceneKey, data).then((tempPath) => {
    if (!_state || _state.sceneKey !== sceneKey) return
    if (tempPath) {
      _state.cardPath = tempPath
      _state.cardStatus = 'ready'
    } else {
      _state.cardStatus = 'failed'
    }
  }).catch(() => {
    if (_state && _state.sceneKey === sceneKey) _state.cardStatus = 'failed'
  })

  // 保险兜底：若上游 promise 因基础库异常完全没回调，4.5s 后强制 failed
  //   比 shareCard 内部 4s 超时再多 500ms，避免两个定时器抢跑
  setTimeout(() => {
    if (_state && _state.sceneKey === sceneKey && _state.cardStatus === 'loading') {
      _state.cardStatus = 'failed'
    }
  }, 4500)

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
  // 预览奖励 chip 与实际入账对齐：直接用 previewShareReward 的合并值来判是否有 chip 行
  // 这样首次永久 100 灵石 / 场景奖 都会被显示；没有奖励时面板自动收缩。
  const previewRewardsForH = state.g && state.g.storage
    ? previewShareReward(state.g.storage, state.sceneKey)
    : null
  const hasRewardChipRow = !!(previewRewardsForH && getShareRewardSlots(previewRewardsForH).length)
  const metaH = 38 * S + (hasRewardChipRow ? 34 * S : 0)
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
  // 三态分支：ready → 合成图；failed → 底图降级；loading → 占位文字
  if (state.cardStatus === 'ready') {
    const img = _ensurePreviewImg(state.cardPath)
    if (img && img.width > 0) {
      ctx.drawImage(img, previewX, previewY, previewW, previewH)
    } else {
      // 合成图句柄还在解码，短暂显示占位（通常 1-2 帧后就会补上）
      _drawLoadingPlaceholder(ctx, S, previewX, previewY, previewW, previewH)
    }
  } else if (state.cardStatus === 'failed') {
    // 降级：直接画静态底图（底图本身就是一张完整的分享封面）
    const img = _ensurePreviewImg(state.fallbackPath)
    if (img && img.width > 0) {
      ctx.drawImage(img, previewX, previewY, previewW, previewH)
    } else {
      _drawLoadingPlaceholder(ctx, S, previewX, previewY, previewW, previewH, '使用默认卡面分享')
    }
  } else {
    _drawLoadingPlaceholder(ctx, S, previewX, previewY, previewW, previewH)
  }
  ctx.restore()

  // 金边
  ctx.strokeStyle = 'rgba(220,180,80,0.6)'
  ctx.lineWidth = 1 * S
  _rr(ctx, previewX, previewY, previewW, previewH, 10 * S)
  ctx.stroke()

  // ---- 奖励提示（在预览下方）：预览 chip = 实际入账的合并结果，保证"所见即所得" ----
  const rewardsForPreview = state.g && state.g.storage
    ? previewShareReward(state.g.storage, state.sceneKey)
    : null
  const shareSlots = rewardsForPreview ? getShareRewardSlots(rewardsForPreview) : []
  const metaY = previewY + previewH + 14 * S
  if (shareSlots.length) {
    const R = V.R
    drawRewardSlotChips(ctx, R, null, panelX + panelW / 2, metaY + 6 * S, panelW - 28 * S, S, {
      align: 'center',
      state: 'ready',
      slotsOverride: shareSlots,
      iconSz: 21 * S,
      chipH: 26 * S,
      gap: 8 * S,
      fontSize: 10.5 * S,
    })
  }

  // ---- 按钮 ----
  const btnUnlocked = state.phase === 'ready'
  const btnY = metaY + (shareSlots.length ? 42 : 18) * S
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

// ===== 预览占位 =====
function _drawLoadingPlaceholder(ctx, S, x, y, w, h, text) {
  ctx.fillStyle = '#1a1330'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = '#b8a070'
  ctx.font = `${13 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text || '炫耀卡合成中...', x + w / 2, y + h / 2)
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
  // 玩家在卡片上真正点"发给好友/朋友圈" → 执行 onConfirm，消费里程碑 flag
  // （"稍后再说" / 外部 dismiss 路径不会走到这里）
  if (_state && typeof _state.onConfirm === 'function') {
    try { _state.onConfirm() } catch (e) { console.warn('[shareCelebrate] onConfirm error', e) }
  }
  shareCore(g, sceneKey, mergedData, { mode })
}

module.exports = { trigger, dismiss, isActive, draw, handleTouch }
