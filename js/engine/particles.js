const P = require('../platform')
/**
 * 轻量粒子引擎 — 对象池 + 纹理预渲染 + 发射器模式
 * 替代分散在各处的手动粒子逻辑，提供统一的高性能粒子管理
 */

const POOL_SIZE = 300
const MAX_ACTIVE = 180
const _pool = []
const _active = []

// ===== 粒子对象池 =====
function _makeParticle() {
  return {
    x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0,
    life: 0, maxLife: 0, size: 0, sizeEnd: 0,
    alpha: 1, alphaEnd: 0, rotation: 0, rotSpeed: 0,
    color: '#fff', texture: null, // texture: 预渲染的离屏 canvas
    active: false,
  }
}

for (let i = 0; i < POOL_SIZE; i++) _pool.push(_makeParticle())

function _getParticle() {
  if (_pool.length > 0) return _pool.pop()
  return _makeParticle()
}

function _release(p) {
  p.active = false; p.texture = null
  if (_pool.length < POOL_SIZE * 1.5) _pool.push(p)
}

function _capActive() {
  while (_active.length > MAX_ACTIVE) {
    const p = _active.shift()
    if (p) _release(p)
  }
}

// ===== 纹理缓存（离屏 Canvas 预渲染） =====
const _texCache = {}

/**
 * 生成圆形光点纹理
 * @param {string} color - 主色
 * @param {number} radius - 半径（像素）
 * @returns {object} 离屏 canvas
 */
function getGlowTexture(color, radius) {
  const key = `glow_${color}_${radius}`
  if (_texCache[key]) return _texCache[key]
  const sz = radius * 2
  let canvas
  if (P.createOffscreenCanvas) {
    canvas = P.createOffscreenCanvas({ type: '2d', width: sz, height: sz })
  } else {
    return null
  }
  const c = canvas.getContext('2d')
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius)
  g.addColorStop(0, '#ffffffcc')
  g.addColorStop(0.3, color + 'aa')
  g.addColorStop(0.7, color + '44')
  g.addColorStop(1, 'transparent')
  c.fillStyle = g
  c.beginPath(); c.arc(radius, radius, radius, 0, Math.PI * 2); c.fill()
  _texCache[key] = canvas
  return canvas
}

/**
 * 生成星形纹理
 * @param {string} color - 主色
 * @param {number} radius - 外半径
 */
function getStarTexture(color, radius) {
  const key = `star_${color}_${radius}`
  if (_texCache[key]) return _texCache[key]
  const sz = radius * 2 + 4
  let canvas
  if (P.createOffscreenCanvas) {
    canvas = P.createOffscreenCanvas({ type: '2d', width: sz, height: sz })
  } else {
    return null
  }
  const c = canvas.getContext('2d')
  const cx = sz / 2, cy = sz / 2
  c.fillStyle = color
  c.beginPath()
  for (let i = 0; i < 5; i++) {
    const outerAngle = (i * 72 - 90) * Math.PI / 180
    const innerAngle = ((i * 72) + 36 - 90) * Math.PI / 180
    const ox = cx + Math.cos(outerAngle) * radius
    const oy = cy + Math.sin(outerAngle) * radius
    const ix = cx + Math.cos(innerAngle) * radius * 0.4
    const iy = cy + Math.sin(innerAngle) * radius * 0.4
    if (i === 0) c.moveTo(ox, oy)
    else c.lineTo(ox, oy)
    c.lineTo(ix, iy)
  }
  c.closePath(); c.fill()
  // 中心高光
  c.fillStyle = '#ffffff88'
  c.beginPath(); c.arc(cx, cy, radius * 0.25, 0, Math.PI * 2); c.fill()
  _texCache[key] = canvas
  return canvas
}

// ===== 发射器 =====

/**
 * 发射一组粒子（burst 模式）
 * @param {object} opts
 * @param {number} opts.x - 发射中心 X
 * @param {number} opts.y - 发射中心 Y
 * @param {number} opts.count - 粒子数量
 * @param {number} opts.speed - 初始速度范围 [speed*0.5, speed*1.5]
 * @param {number} opts.size - 初始尺寸
 * @param {number} [opts.sizeEnd] - 结束尺寸，默认 0
 * @param {number} opts.life - 生命帧数
 * @param {number} [opts.gravity] - 重力加速度（像素/帧²）
 * @param {string|string[]} opts.colors - 颜色或颜色数组
 * @param {string} [opts.shape] - 'glow' | 'star'，默认 'glow'
 * @param {number} [opts.spread] - 发射角度范围（弧度），默认 2π
 * @param {number} [opts.baseAngle] - 基础发射角度
 * @param {number} [opts.drag] - 空气阻力系数（0-1），默认 0.98
 */
function burst(opts) {
  const colors = Array.isArray(opts.colors) ? opts.colors : [opts.colors || '#fff']
  const spread = opts.spread != null ? opts.spread : Math.PI * 2
  const baseAngle = opts.baseAngle || 0
  const drag = opts.drag != null ? opts.drag : 0.98
  const shape = opts.shape || 'glow'
  for (let i = 0; i < opts.count; i++) {
    const p = _getParticle()
    const angle = baseAngle + (Math.random() - 0.5) * spread
    const spd = opts.speed * (0.5 + Math.random())
    p.x = opts.x + (Math.random() - 0.5) * (opts.size || 2)
    p.y = opts.y + (Math.random() - 0.5) * (opts.size || 2)
    p.vx = Math.cos(angle) * spd
    p.vy = Math.sin(angle) * spd
    p.ax = 0
    p.ay = opts.gravity || 0
    p.drag = drag
    p.life = 0
    p.maxLife = opts.life + Math.floor(Math.random() * (opts.life * 0.3))
    p.size = opts.size * (0.7 + Math.random() * 0.6)
    p.sizeEnd = opts.sizeEnd != null ? opts.sizeEnd : 0
    p.alpha = 1
    p.alphaEnd = 0
    p.rotation = Math.random() * Math.PI * 2
    p.rotSpeed = (Math.random() - 0.5) * 0.2
    p.color = colors[Math.floor(Math.random() * colors.length)]
    p.shape = shape
    // 缓存纹理引用
    const texR = Math.ceil(p.size)
    p.texture = shape === 'star' ? getStarTexture(p.color, texR) : getGlowTexture(p.color, texR)
    p.active = true
    _active.push(p)
  }
  _capActive()
}

/**
 * 环形粒子发射（用于 combo 里程碑等）
 */
function ring(opts) {
  const colors = Array.isArray(opts.colors) ? opts.colors : [opts.colors || '#fff']
  for (let i = 0; i < opts.count; i++) {
    const p = _getParticle()
    const angle = (i / opts.count) * Math.PI * 2
    const spd = opts.speed * (0.8 + Math.random() * 0.4)
    p.x = opts.x; p.y = opts.y
    p.vx = Math.cos(angle) * spd
    p.vy = Math.sin(angle) * spd
    p.ax = 0; p.ay = opts.gravity || 0
    p.drag = opts.drag || 0.97
    p.life = 0
    p.maxLife = opts.life + Math.floor(Math.random() * 6)
    p.size = opts.size * (0.8 + Math.random() * 0.4)
    p.sizeEnd = 0; p.alpha = 1; p.alphaEnd = 0
    p.rotation = 0; p.rotSpeed = 0
    p.color = colors[Math.floor(Math.random() * colors.length)]
    p.shape = opts.shape || 'glow'
    const texR = Math.ceil(p.size)
    p.texture = p.shape === 'star' ? getStarTexture(p.color, texR) : getGlowTexture(p.color, texR)
    p.active = true
    _active.push(p)
  }
  _capActive()
}

// ===== 每帧更新 =====
function update() {
  for (let i = _active.length - 1; i >= 0; i--) {
    const p = _active[i]
    p.life++
    if (p.life >= p.maxLife) {
      _active.splice(i, 1); _release(p); continue
    }
    p.vx += p.ax; p.vy += p.ay
    p.vx *= (p.drag || 0.98); p.vy *= (p.drag || 0.98)
    p.x += p.vx; p.y += p.vy
    p.rotation += p.rotSpeed
  }
}

// ===== 绘制 =====
function draw(ctx) {
  if (_active.length === 0) return
  ctx.save()
  for (let i = 0; i < _active.length; i++) {
    const p = _active[i]
    const t = p.life / p.maxLife
    const alpha = p.alpha + (p.alphaEnd - p.alpha) * t
    const size = p.size + (p.sizeEnd - p.size) * t
    if (alpha <= 0.01 || size <= 0.1) continue
    ctx.globalAlpha = alpha
    if (p.texture) {
      const tw = p.texture.width || size * 2
      const th = p.texture.height || size * 2
      ctx.save()
      ctx.translate(p.x, p.y)
      if (p.rotSpeed !== 0) ctx.rotate(p.rotation)
      ctx.drawImage(p.texture, -tw / 2 * (size / (p.size || 1)), -th / 2 * (size / (p.size || 1)), tw * (size / (p.size || 1)), th * (size / (p.size || 1)))
      ctx.restore()
    } else {
      ctx.fillStyle = p.color
      ctx.beginPath(); ctx.arc(p.x, p.y, size, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

/** 清空所有活跃粒子 */
function clear() {
  while (_active.length > 0) _release(_active.pop())
}

/** 清理纹理缓存（场景切换时调用，释放离屏 Canvas 内存） */
function clearTexCache() {
  for (const key in _texCache) delete _texCache[key]
}

/** 当前活跃粒子数 */
function count() { return _active.length }

module.exports = { burst, ring, update, draw, clear, clearTexCache, count, getGlowTexture, getStarTexture }
