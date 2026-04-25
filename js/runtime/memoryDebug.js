/**
 * 内存调试 — 仅 MEMORY_DEBUG=true 时生效；默认关闭无性能影响，可进生产包
 */
const P = require('../platform')
const memoryGuard = require('../engine/battleMemoryGuard')
const {
  MEMORY_DEBUG,
  MEMORY_DEBUG_ONLY_GM,
  MEMORY_DEBUG_INTERVAL_MS,
} = require('../data/constants')
const { isCurrentUserGM } = require('../data/gmConfig')

let _started = false
let _warningStarted = false
let _abortedNonGm = false
let _intervalId = null

function _snapshot(g, render, tag) {
  const snap = memoryGuard.getSnapshot(g, render, tag)
  snap.af = g.af
  snap.petPoolLen = (g.storage && g.storage.petPool && g.storage.petPool.length) || 0
  console.warn('[MemDebug]', JSON.stringify(snap))
}

function _sceneKeepPaths(g) {
  const paths = []
  if (!g) return paths
  if (g.enemy && g.enemy.avatar) paths.push(`assets/${g.enemy.avatar}.png`)
  if (g.enemy && g.enemy.customBg) paths.push(`assets/${g.enemy.customBg}.jpg`)
  if (g.pets) {
    for (const p of g.pets) {
      if (p && p.id) paths.push(`assets/pets/pet_${p.id}.png`)
    }
  }
  return paths
}

function _registerWarningCleanup(g, render) {
  if (_warningStarted) return
  _warningStarted = true
  P.onMemoryWarning((res) => {
    const level = res && (res.level != null ? res.level : res)
    console.warn('[MemGuard] onMemoryWarning level=', level)
    try { memoryGuard.clearBattleTransientState(g, { clearTex: true, lowMemory: true, reason: 'memory_warning' }) } catch (_) {}
    try {
      if (render && render.clearDynamicCache) render.clearDynamicCache(_sceneKeepPaths(g))
    } catch (_) {}
    if (MEMORY_DEBUG) _snapshot(g, render, 'memory_warning')
  })
}

/**
 * 每帧可调用；内部仅在首次满足条件时注册监听
 * @param {object} g - Main 实例
 * @param {object} render - Render 实例（R）
 */
function maybeStart(g, render) {
  _registerWarningCleanup(g, render)
  if (!MEMORY_DEBUG || _started || _abortedNonGm) return

  if (MEMORY_DEBUG_ONLY_GM && !isCurrentUserGM()) {
    // openid 未就绪时多等几帧；仍非 GM 则放弃，避免每局一直判断
    if ((g.af || 0) > 3600) _abortedNonGm = true
    return
  }

  _started = true
  console.warn('[MemDebug] 已启用：onMemoryWarning' + (MEMORY_DEBUG_INTERVAL_MS > 0 ? ` + 每 ${MEMORY_DEBUG_INTERVAL_MS}ms 快照` : ''))

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
