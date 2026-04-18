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

// ===== Pending 主动分享（解决"onShareAppMessage 覆盖 shareAppMessage 参数"的平台坑） =====
//
// 微信小游戏分享在 iOS + 部分 Android 版本上存在一个坑：
//   即使 wx.shareAppMessage({ imageUrl, title, query }) 主动传了图，
//   微信转发面板最终使用的仍是 wx.onShareAppMessage(cb) 回调里返回的数据，
//   导致"点击我们的'发给好友'按钮分享动态炫耀卡 → 实际发出去的却是 passive 静态图"。
//
// 解决方案：shareCore 在主动分享的同时，写入一个 pending 槽位；
// onShareAppMessage / onShareTimeline 回调优先读 pending，没有才回落到 passive 默认数据。
//
// 超时清理（PENDING_TTL_MS）：防止玩家取消分享后 pending 残留，污染后续被动分享。
// 15s 足以覆盖绝大多数转发面板交互，超时就让被动分享回落到通用文案。
const PENDING_TTL_MS = 15000
let _pendingShare = null  // { scene, data, mode, title, imageUrl, query, expireAt }

function _setPendingShare(scene, data, mode, title, imageUrl, query) {
  _pendingShare = {
    scene, data, mode, title, imageUrl, query,
    expireAt: Date.now() + PENDING_TTL_MS,
  }
}

function _getPendingShare() {
  if (!_pendingShare) return null
  if (Date.now() > _pendingShare.expireAt) { _pendingShare = null; return null }
  return _pendingShare
}

// 供测试/热更用
function clearPendingShare() { _pendingShare = null }

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

// ===== 内部：场景图选择 =====
//
// 【关键约束 · 必读】
// 微信小游戏 wx.shareAppMessage 的 imageUrl 在**体验版 / 正式版**上不支持 wxfile:// 临时路径
// （开发者工具和真机开发版支持，但线上一律静默失败、回落到默认分享图 / 游戏截屏）。
// 因此 shareCard 合成出来的 tempFilePath **不能用于最终分享**，否则线上玩家看到的永远是错图。
//
// 当前策略（"方案 B · 静态底图 + 动态文案"）：
//   · imageUrl：固定用包内静态底图（各场景 cardTemplate 对应 assets/share/card_base/*.jpg）
//   · title  ：动态文案，带玩家昵称/战绩/境界 → 炫耀感由标题承担（行业主流做法）
//   · 弹窗预览：仍用动态合成图（让玩家看到"这是我的"），但不参与最终分享
//
// 日后若要走真动态图分享，必须经云存储上传换取 https CDN URL，才能绕开这个限制。
function _resolveImage(cfg, data) {
  // 优先使用场景配置的炫耀卡静态底图（审核可过、线上稳定）
  if (cfg.cardTemplate) return `assets/share/card_base/${cfg.cardTemplate}.jpg`
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
//   · 优先读 pending（主动分享刚发起的场景数据 / 动态卡 tempPath）
//   · 无 pending 时回落 passive 默认静态图
function getShareData(storage) {
  const pending = _getPendingShare()
  if (pending && pending.mode !== 'timeline') {
    return { title: pending.title, imageUrl: pending.imageUrl, query: pending.query }
  }
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
//   同样先读 pending（mode === 'timeline'）
function getShareTimelineData(storage) {
  const pending = _getPendingShare()
  if (pending && pending.mode === 'timeline') {
    return { title: pending.title, imageUrl: pending.imageUrl, query: pending.query }
  }
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

  // 写 pending 槽位：微信若在转发面板期间回调 onShareAppMessage/onShareTimeline，
  // 回调会返回这同一份数据（含动态炫耀卡 tempPath），避免被 passive 默认图覆盖
  const fallbackMode = (mode === 'timeline' && !P.hasShareTimeline) ? 'friend' : mode
  _setPendingShare(sceneKey, data, fallbackMode, title, imageUrl, query)

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
  _setPendingShare('passive', null, 'friend', data.title, data.imageUrl, data.query)
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
  const title = titleFn(d)
  const imageUrl = cfg.imageUrl
  const query = _buildQuery()
  _setPendingShare('stats', null, 'friend', title, imageUrl, query)
  P.shareAppMessage({ title, imageUrl, query })
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
  // 测试/热更钩子
  clearPendingShare,
}
