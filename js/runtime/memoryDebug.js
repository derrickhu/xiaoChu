/**
 * 内存调试 — 仅 MEMORY_DEBUG=true 时生效；默认关闭无性能影响，可进生产包
 */
const P = require('../platform')
const Particles = require('../engine/particles')
const {
  MEMORY_DEBUG,
  MEMORY_DEBUG_ONLY_GM,
  MEMORY_DEBUG_INTERVAL_MS,
} = require('../data/constants')
const { isCurrentUserGM } = require('../data/gmConfig')

let _started = false
let _abortedNonGm = false
let _intervalId = null

function _snapshot(g, render, tag) {
  const img = render && render.getImageCacheDebugStats ? render.getImageCacheDebugStats() : {}
  const snap = {
    tag,
    scene: g.scene,
    bState: g.bState,
    battleMode: g.battleMode,
    floor: g.floor,
    af: g.af,
    imgCount: img.imgCount,
    imgMax: img.imgMax,
    gradCount: img.gradCount,
    particles: Particles.count(),
    runBuffLogLen: (g.runBuffLog && g.runBuffLog.length) || 0,
    petPoolLen: (g.storage && g.storage.petPool && g.storage.petPool.length) || 0,
  }
  console.warn('[MemDebug]', JSON.stringify(snap))
}

/**
 * 每帧可调用；内部仅在首次满足条件时注册监听
 * @param {object} g - Main 实例
 * @param {object} render - Render 实例（R）
 */
function maybeStart(g, render) {
  if (!MEMORY_DEBUG || _started || _abortedNonGm) return

  if (MEMORY_DEBUG_ONLY_GM && !isCurrentUserGM()) {
    // openid 未就绪时多等几帧；仍非 GM 则放弃，避免每局一直判断
    if ((g.af || 0) > 3600) _abortedNonGm = true
    return
  }

  _started = true
  console.warn('[MemDebug] 已启用：onMemoryWarning' + (MEMORY_DEBUG_INTERVAL_MS > 0 ? ` + 每 ${MEMORY_DEBUG_INTERVAL_MS}ms 快照` : ''))

  P.onMemoryWarning((res) => {
    const level = res && (res.level != null ? res.level : res)
    console.warn('[MemDebug] onMemoryWarning level=', level)
    _snapshot(g, render, 'memory_warning')
  })

  if (MEMORY_DEBUG_INTERVAL_MS > 0 && typeof setInterval !== 'undefined') {
    _intervalId = setInterval(() => {
      _snapshot(g, render, 'interval')
    }, MEMORY_DEBUG_INTERVAL_MS)
  }
}

/** 测试或热重载时可调用（一般不需要） */
function stop() {
  if (_intervalId != null) {
    clearInterval(_intervalId)
    _intervalId = null
  }
}

module.exports = { maybeStart, stop }
