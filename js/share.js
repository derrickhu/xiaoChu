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
const gameToast = require('./views/gameToast')
const shareRewardPopup = require('./views/shareRewardPopup')

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
const PENDING_TTL_MS = 8000
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
//
// 【飞效时机 · 2026-04】
//   旧实现：shareAppMessage 调起转发面板后立刻 spawnFromReward
//     → 问题：粒子在 0.5s 内飞完，但玩家此时还在选联系人，根本看不到反馈
//   新实现：奖励数据入账后**排队**到 g._pendingShareFly，等以下任一时机再真正播放飞效：
//     · onShow（分享面板/联系人选择关掉、应用 resume）→ main.js 调 flushShareFly
//     · 1.5s fallback（分享面板被玩家秒关或根本没弹出）→ main.js 每帧调 tickShareFly
//   这样玩家回到游戏界面时才弹出分享奖励窗（图标汇总 + 领取后飞效）；无入账时 toast「感谢分享」
function _recordShareReward(g, sceneKey, mode) {
  if (!g || !g.storage || !g.storage.recordShare) return
  // recordShare 接受 sceneKey 做差异化奖励；老调用点传 undefined 会按 base 奖励走
  const rewarded = g.storage.recordShare(sceneKey, { mode })
  // 无道具也排队：与有奖励同源在 onShow / 1.5s 后提示，避免「刚点分享就弹窗」的错位感
  _queueShareFly(g, rewarded)
  g._dirty = true
}

function _queueShareFly(g, rewarded) {
  if (!g._pendingShareFly) g._pendingShareFly = []
  g._pendingShareFly.push({ rewarded, createdAt: Date.now() })
}

function _mergeQueuedRewards(list) {
  let stamina = 0
  let soulStone = 0
  let fragment = 0
  let anyThanks = false
  for (const it of list) {
    if (!it || !it.rewarded) {
      anyThanks = true
      continue
    }
    stamina += it.rewarded.stamina || 0
    soulStone += it.rewarded.soulStone || 0
    fragment += it.rewarded.fragment || 0
  }
  if (stamina || soulStone || fragment) return { stamina, soulStone, fragment }
  if (anyThanks) return 'thanks'
  return null
}

function _presentShareQueue(g, list) {
  if (!g || !list || !list.length) return
  const merged = _mergeQueuedRewards(list)
  if (merged === 'thanks') {
    gameToast.show('感谢分享！', { type: 'text', duration: 2000 })
    g._dirty = true
    return
  }
  if (!merged) return
  shareRewardPopup.open(g, merged)
  g._dirty = true
}

/**
 * onShow 时调用：立即触发所有排队中的分享奖励飞效
 *   玩家从分享面板 / 联系人选择器回来时看到飞效，"获得感"落地
 */
function flushShareFly(g) {
  if (!g || !g._pendingShareFly || !g._pendingShareFly.length) return
  const list = g._pendingShareFly
  g._pendingShareFly = []
  _presentShareQueue(g, list)
}

// 1.5s fallback：玩家秒关面板 / 面板没弹起 / 平台不触发 onShow
const _FLY_FALLBACK_MS = 1500

/**
 * 主循环里调用：超过 fallback 时间的排队奖励也触发飞效
 *   兜底保护"分享 → 玩家取消 → 回到游戏但 onShow 没触发"的场景
 */
function tickShareFly(g) {
  if (!g || !g._pendingShareFly || !g._pendingShareFly.length) return
  const now = Date.now()
  const due = []
  const pending = []
  g._pendingShareFly.forEach((it) => {
    if (now - it.createdAt >= _FLY_FALLBACK_MS) due.push(it)
    else pending.push(it)
  })
  if (!due.length) return
  g._pendingShareFly = pending
  _presentShareQueue(g, due)
}

// ===== 小程序菜单「转发 / 朋友圈」（被动入口）· 日任 share_1 记账 =====
//
// 问题：仅 return getShareData() 时，从未调用 storage.recordShare → 每日「分享游戏1次」进度不涨。
// 主动分享（shareCore / shareGame）会先 setPending 再调 shareAppMessage，随后 _recordShareReward。
// 若此时同步触发 onShareAppMessage，pending 已存在 → 此处不再记账，避免 double count。
// 玩家纯点右上角转发、无 pending → 此处补一次 recordShare（与 shareGame 同 passive 场景）。
function onMenuShareAppMessageForGame(game) {
  if (!game || !game.storage) {
    return { title: '', imageUrl: 'assets/share/share_default.jpg', query: '' }
  }
  if (!_getPendingShare()) {
    _recordShareReward(game, 'passive', 'friend')
  }
  return getShareData(game.storage)
}

function onMenuShareTimelineForGame(game) {
  if (!game || !game.storage) {
    return { title: '', imageUrl: 'assets/share/share_default.jpg', query: '' }
  }
  if (!_getPendingShare()) {
    _recordShareReward(game, 'passive', 'timeline')
  }
  return getShareTimelineData(game.storage)
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
//   首页"炫耀战绩"按钮用；内部走 stats 场景（传入 Main 实例以便分享奖励飞效）
function shareStats(g) {
  const storage = g && g.storage ? g.storage : g
  if (!storage) return
  const cfg = SHARE_SCENES.stats
  const st = storage.stats
  const d = { floor: storage.bestFloor, dex: (storage.petPool || []).length, combo: st.maxCombo }
  const titleFn = cfg.titles[Math.floor(Math.random() * cfg.titles.length)]
  const title = titleFn(d)
  const imageUrl = cfg.imageUrl
  const query = _buildQuery()
  _setPendingShare('stats', null, 'friend', title, imageUrl, query)
  P.shareAppMessage({ title, imageUrl, query })
  if (g && g.storage) _recordShareReward(g, 'stats', 'friend')
}

// ===== 兼容老接口：doShare =====
//   stageFirstClear / towerDefeat / towerClear / towerItem / passive 降级
//   老调用点：stageResultView、runManager、adManager、touchHandlers
function doShare(g, sceneKey, data) {
  shareCore(g, sceneKey, data, { mode: 'friend' })
}

/**
 * 微信小游戏：右上角「转发 / 分享到朋友圈」依赖 onShareAppMessage / onShareTimeline。
 * 须在引擎启动后尽早注册（勿等到 Main 构造末尾），否则真机菜单转发可能不进监听 → 无 recordShare、无奖励弹窗。
 */
function registerMenuShareListeners() {
  try {
    P.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
  } catch (_) { /* 低版本或模拟器 */ }
  const gMain = () => (typeof GameGlobal !== 'undefined' ? GameGlobal.__gameMain : null)
  if (typeof P.onShareAppMessage === 'function') {
    P.onShareAppMessage(() => onMenuShareAppMessageForGame(gMain()))
  }
  if (typeof P.onShareTimeline === 'function') {
    P.onShareTimeline(() => onMenuShareTimelineForGame(gMain()))
  }
}

module.exports = {
  // 新：统一入口（新代码用这个）
  shareCore,
  // 新：朋友圈被动分享数据
  getShareTimelineData,
  // 旧：被动分享数据（main.js onShareAppMessage 用）
  getShareData,
  // 小程序菜单转发 / 朋友圈：补 recordShare + 日任 share_1（见文件内注释）
  onMenuShareAppMessageForGame,
  onMenuShareTimelineForGame,
  registerMenuShareListeners,
  // 旧：兼容层（保留给 tTitle / stageResultView / runManager / adManager 等老调用）
  shareGame,
  shareStats,
  doShare,
  // 分享奖励飞效：onShow 时清空队列 + 主循环 tick 兜底
  flushShareFly,
  tickShareFly,
  // 测试/热更钩子
  clearPendingShare,
}
