/**
 * 分享核心模块 — 统一入口 shareCore
 *
 * 设计目标：
 *   1. 所有业务分享点都走 shareCore，不直接调平台 API
 *   2. 默认自动带 `inviter=<openid>` query，裂变闭环不漏
 *   3. 支持好友/朋友圈双通道（mode: 'friend' | 'timeline'）
 *   4. 支持动态炫耀卡（tempFilePath）与静态图回落
 *   5. 保留老接口 shareGame / shareStats / doShare 作兼容包装
 *
 * 分享后的本地奖励：集中走 storage.recordShare(sceneKey)，按场景差异化
 */
const P = require('./platform')
const cloudSync = require('./data/cloudSync')
const analytics = require('./data/analytics')
const { SHARE_SCENES } = require('./data/shareConfig')

// ===== 内部：邀请 query 拼装 =====
//   为什么从 cloudSync 取 openid：邀请链的"源头"需要稳定 ID，
//   cloudSync 在 app 启动时会尝试 callFunction getOpenid 并缓存。
//   若未取到（抖音端/未登录），退化为不带 inviter（仅做奖励，不做裂变）。
function _buildQuery(extraQuery) {
  const parts = []
  const inviter = cloudSync.getOpenid && cloudSync.getOpenid()
  if (inviter) parts.push(`inviter=${inviter}`)
  if (extraQuery) parts.push(extraQuery)
  return parts.join('&')
}

// ===== 内部：场景图选择（优先动态卡 tempPath，回落静态图） =====
function _resolveImage(cfg, data) {
  // data.cardTempPath 由 shareCard 合成后注入；无则用配置里的 imageUrl
  if (data && data.cardTempPath) return data.cardTempPath
  // stats/passive 等多状态场景支持"已通关"变体
  if (cfg.imageUrlCleared && data && data.isCleared) return cfg.imageUrlCleared
  return cfg.imageUrl || 'assets/share/share_default.jpg'
}

// ===== 内部：文案取值 =====
function _resolveTitle(cfg, data, mode) {
  // 朋友圈文案可以和好友不同（朋友圈更强调"炫耀感"）
  if (mode === 'timeline' && cfg.timelineTitleFn) return cfg.timelineTitleFn(data || {})
  if (cfg.titleFn) return cfg.titleFn(data || {})
  if (cfg.titles && cfg.titles.length) {
    const fn = cfg.titles[Math.floor(Math.random() * cfg.titles.length)]
    return fn(data || {})
  }
  return ''
}

// ===== 内部：本地奖励入账 =====
function _recordShareReward(g, sceneKey, mode) {
  if (!g || !g.storage || !g.storage.recordShare) return
  // recordShare 接受 sceneKey 做差异化奖励；老调用点传 undefined 会按 base 奖励走
  const rewarded = g.storage.recordShare(sceneKey, { mode })
  if (rewarded && g._toast) {
    const parts = []
    if (rewarded.stamina) parts.push(`体力+${rewarded.stamina}`)
    if (rewarded.soulStone) parts.push(`灵石+${rewarded.soulStone}`)
    if (rewarded.fragment) parts.push(`万能碎片+${rewarded.fragment}`)
    if (parts.length) g._toast(`分享奖励：${parts.join(' ')}`)
  }
  g._dirty = true
}

// ===== 被动分享数据（onShareAppMessage 用） =====
function getShareData(storage) {
  const cfg = SHARE_SCENES.passive
  const st = storage.stats
  const floor = storage.bestFloor
  const isCleared = floor >= 30
  const d = { isCleared, turns: st.bestTotalTurns, dex: (storage.petPool || []).length, floor }
  return {
    title: cfg.titleFn(d),
    imageUrl: isCleared ? cfg.imageUrlCleared : cfg.imageUrl,
    query: _buildQuery(),
  }
}

// ===== 被动分享数据（onShareTimeline 用） =====
//   朋友圈没有 query 字段（微信不支持），只有 title + imageUrl + query(部分基础库)
function getShareTimelineData(storage) {
  const cfg = SHARE_SCENES.passive
  const st = storage.stats
  const floor = storage.bestFloor
  const isCleared = floor >= 30
  const d = { isCleared, turns: st.bestTotalTurns, dex: (storage.petPool || []).length, floor }
  return {
    title: (cfg.timelineTitleFn || cfg.titleFn)(d),
    imageUrl: isCleared ? cfg.imageUrlCleared : cfg.imageUrl,
    query: _buildQuery(),
  }
}

// ===== 统一主动分享入口 =====
//   g       - 游戏上下文（用于 toast / recordShare）
//   sceneKey - SHARE_SCENES 里的场景 key
//   data    - 场景模板数据（含 cardTempPath、isCleared 等）
//   opts    - { mode: 'friend'|'timeline', extraQuery }
function shareCore(g, sceneKey, data, opts) {
  const cfg = SHARE_SCENES[sceneKey]
  if (!cfg) { console.warn('[share] unknown scene:', sceneKey); return }
  const mode = (opts && opts.mode) || 'friend'
  const title = _resolveTitle(cfg, data, mode)
  const imageUrl = _resolveImage(cfg, data)
  const query = _buildQuery(opts && opts.extraQuery)

  if (mode === 'timeline') {
    // 朋友圈；不支持的平台（抖音 / 低版本微信）自动回落到好友分享
    if (P.hasShareTimeline) {
      P.shareTimeline({ title, imageUrl, query })
    } else {
      P.shareAppMessage({ title, imageUrl, query })
    }
  } else {
    P.shareAppMessage({ title, imageUrl, query })
  }
  _recordShareReward(g, sceneKey, mode)
  // 埋点：主动分享触发（唤起了分享面板，不保证用户最终完成分享）
  analytics.track('share_invoke', {
    scene: sceneKey,
    mode,
    hasCard: !!(data && data.cardTempPath),
  })
}

// ===== 兼容老接口：shareGame =====
//   首页 / 日任 share_1 继续调用；内部走 passive 场景
function shareGame(g) {
  if (!g || !g.storage) return
  const data = getShareData(g.storage)
  P.shareAppMessage({ title: data.title, imageUrl: data.imageUrl, query: data.query })
  _recordShareReward(g, 'passive', 'friend')
}

// ===== 兼容老接口：shareStats =====
//   首页"炫耀战绩"按钮用；内部走 stats 场景
function shareStats(storage) {
  const cfg = SHARE_SCENES.stats
  const st = storage.stats
  const d = { floor: storage.bestFloor, dex: (storage.petPool || []).length, combo: st.maxCombo }
  const titleFn = cfg.titles[Math.floor(Math.random() * cfg.titles.length)]
  P.shareAppMessage({ title: titleFn(d), imageUrl: cfg.imageUrl, query: _buildQuery() })
  // 注意：此接口没有 g 上下文，奖励入账依赖外部（或升级调用方传 g 换 shareCore）
}

// ===== 兼容老接口：doShare =====
//   stageFirstClear / towerDefeat / towerClear / towerItem / passive 降级
//   老调用点：stageResultView、runManager、adManager、touchHandlers
function doShare(g, sceneKey, data) {
  shareCore(g, sceneKey, data, { mode: 'friend' })
}

module.exports = {
  // 新：统一入口（新代码用这个）
  shareCore,
  // 新：朋友圈被动分享数据
  getShareTimelineData,
  // 旧：被动分享数据（main.js onShareAppMessage 用）
  getShareData,
  // 旧：兼容层（保留给 tTitle / stageResultView / runManager / adManager 等老调用）
  shareGame,
  shareStats,
  doShare,
}
