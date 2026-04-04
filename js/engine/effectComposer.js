const P = require('../platform')
/**
 * 离屏 Canvas 辉光后处理
 * 通过缩小渲染 + 模糊 + lighter 叠加实现简易 bloom 效果
 */

let _glowCanvas = null
let _glowCtx = null
let _glowW = 0, _glowH = 0
const SCALE = 0.25 // 缩小到 1/4 减少像素量

/**
 * 初始化辉光缓冲（首次调用或尺寸变化时自动创建）
 */
function _ensureCanvas(W, H) {
  const tw = Math.ceil(W * SCALE)
  const th = Math.ceil(H * SCALE)
  if (_glowCanvas && _glowW === tw && _glowH === th) return
  if (P.createOffscreenCanvas) {
    _glowCanvas = P.createOffscreenCanvas({ type: '2d', width: tw, height: th })
    _glowCtx = _glowCanvas.getContext('2d')
    _glowW = tw; _glowH = th
  }
}

/**
 * 开始辉光绘制 — 返回离屏 ctx 供调用方绘制需要发光的元素
 * @param {number} W - 主画布宽
 * @param {number} H - 主画布高
 * @returns {CanvasRenderingContext2D|null}
 */
function beginGlow(W, H) {
  _ensureCanvas(W, H)
  if (!_glowCtx) return null
  _glowCtx.clearRect(0, 0, _glowW, _glowH)
  _glowCtx.save()
  _glowCtx.scale(SCALE, SCALE)
  return _glowCtx
}

/**
 * 结束辉光绘制并叠加到主画布
 * 用两次缩放+放大模拟 box blur（简易高斯模糊）
 * @param {CanvasRenderingContext2D} mainCtx - 主画布上下文
 * @param {number} W - 主画布宽
 * @param {number} H - 主画布高
 * @param {number} [intensity=0.6] - 辉光强度（0-1）
 */
function endGlow(mainCtx, W, H, intensity) {
  if (!_glowCtx || !_glowCanvas) return
  _glowCtx.restore()
  const alpha = intensity != null ? intensity : 0.6
  mainCtx.save()
  mainCtx.globalCompositeOperation = 'lighter'
  mainCtx.globalAlpha = alpha
  // 两次不同偏移的叠加模拟模糊
  mainCtx.drawImage(_glowCanvas, 0, 0, W, H)
  mainCtx.globalAlpha = alpha * 0.5
  mainCtx.drawImage(_glowCanvas, -2, -2, W + 4, H + 4)
  mainCtx.restore()
}

// ===== 光斑离屏纹理缓存 =====
const _spotTexCache = {}
const _SPOT_TEX_SIZE = 64

function _getSpotTex(color) {
  if (_spotTexCache[color]) return _spotTexCache[color]
  if (!P.createOffscreenCanvas) return null
  const sz = _SPOT_TEX_SIZE
  const canvas = P.createOffscreenCanvas({ type: '2d', width: sz, height: sz })
  const c = canvas.getContext('2d')
  const r = sz / 2
  const g = c.createRadialGradient(r, r, 0, r, r, r)
  g.addColorStop(0, '#ffffffcc')
  g.addColorStop(0.3, color + 'aa')
  g.addColorStop(0.7, color + '44')
  g.addColorStop(1, 'transparent')
  c.fillStyle = g
  c.beginPath(); c.arc(r, r, r, 0, Math.PI * 2); c.fill()
  _spotTexCache[color] = canvas
  return canvas
}

/**
 * 绘制辉光光斑（使用离屏缓存纹理，避免每帧 createRadialGradient）
 */
function drawGlowSpot(ctx, x, y, radius, color, alpha) {
  const tex = _getSpotTex(color)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = alpha != null ? alpha : 0.4
  if (tex) {
    const d = radius * 2
    ctx.drawImage(tex, x - radius, y - radius, d, d)
  } else {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius)
    g.addColorStop(0, '#ffffffcc')
    g.addColorStop(0.3, color + 'aa')
    g.addColorStop(0.7, color + '44')
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

function clearSpotTexCache() {
  for (const key in _spotTexCache) delete _spotTexCache[key]
}

module.exports = { beginGlow, endGlow, drawGlowSpot, clearSpotTexCache }
