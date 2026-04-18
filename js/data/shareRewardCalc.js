/**
 * 分享奖励计算 — 预览与实际入账的唯一事实源
 *
 * 设计背景：
 *   原先 shareCelebrate 预览只渲染"场景奖" chip，storage.recordShare 却会叠加"每日基础+首次永久+场景"
 *   三档，导致"弹窗显示 x50、实际发 x150"的认知偏差。此模块把合并逻辑统一起来：
 *     · 预览 chip 基于本函数返回的 merged 直接渲染
 *     · storage.recordShare 也调同一个函数决定每项"允许发多少"，逐项入账
 *   两端共用，结果必然一致。
 *
 * 判定口径（与 storage.recordShare 原逻辑等价，仅抽出为纯函数）：
 *   · dailyBase   ：每日基础奖。当前已废弃 stamina（见 SHARE_PER_REWARD = {}），仅在 rewardCount < SHARE_DAILY_MAX 时算
 *   · firstEver   ：首次永久奖。仅当 !shareTracking.firstEverDone 时算
 *   · scene       ：场景奖。sceneOnce=true → 仅在 !shareSceneFlags[sceneKey]；否则 24h 冷却
 *
 * 纯函数：只读 storage 字段，不写入；调用方决定是否落地。
 */

const { SHARE_DAILY_MAX, SHARE_PER_REWARD, SHARE_FIRST_EVER_BONUS, SHARE_SCENE_COOLDOWN_MS } = require('./giftConfig')
const { SHARE_SCENES } = require('./shareConfig')

function _zero() { return { stamina: 0, soulStone: 0, fragment: 0 } }

function _add(dst, src) {
  if (!src) return dst
  if (src.stamina)   dst.stamina   += src.stamina
  if (src.soulStone) dst.soulStone += src.soulStone
  if (src.fragment)  dst.fragment  += src.fragment
  return dst
}

/**
 * 判定场景奖是否允许发放（与 storage.recordShare 内同逻辑保持一致）
 */
function _isSceneAllowed(storage, sceneKey, cfg) {
  if (!cfg || !cfg.reward) return false
  const flags = (storage && storage._d && storage._d.shareSceneFlags) || {}
  const prev = flags[sceneKey]
  if (!prev) return true
  if (cfg.sceneOnce) return false
  const now = Date.now()
  const prevTs = (typeof prev === 'number') ? prev : now
  return (now - prevTs) >= SHARE_SCENE_COOLDOWN_MS
}

/**
 * 计算一次分享将会入账的奖励（合并 + 明细）
 *
 * @param {object} storage - storage 实例（只读 shareTracking / shareSceneFlags）
 * @param {string} [sceneKey] - SHARE_SCENES 里的场景 key；未传则只算 daily/firstEver
 * @returns {{
 *   merged: { stamina, soulStone, fragment },
 *   parts:  { daily, firstEver, scene },   // 每部分也是 { stamina, soulStone, fragment }
 *   meta:   { dailyAllowed, firstEverAllowed, sceneAllowed, sceneCfg }
 * }}
 */
function computeShareReward(storage, sceneKey) {
  const parts = { daily: _zero(), firstEver: _zero(), scene: _zero() }
  const meta = { dailyAllowed: false, firstEverAllowed: false, sceneAllowed: false, sceneCfg: null }

  if (!storage) return { merged: _zero(), parts, meta }

  // 每日基础奖
  const st = storage.shareTracking || { rewardCount: 0, firstEverDone: false }
  if ((st.rewardCount || 0) < SHARE_DAILY_MAX) {
    meta.dailyAllowed = true
    _add(parts.daily, SHARE_PER_REWARD)
  }

  // 首次永久奖
  if (!st.firstEverDone) {
    meta.firstEverAllowed = true
    _add(parts.firstEver, SHARE_FIRST_EVER_BONUS)
  }

  // 场景奖
  if (sceneKey) {
    const cfg = SHARE_SCENES[sceneKey] || null
    meta.sceneCfg = cfg
    if (_isSceneAllowed(storage, sceneKey, cfg)) {
      meta.sceneAllowed = true
      _add(parts.scene, cfg.reward)
    }
  }

  const merged = _zero()
  _add(merged, parts.daily)
  _add(merged, parts.firstEver)
  _add(merged, parts.scene)

  return { merged, parts, meta }
}

/**
 * 供预览 chip 使用：直接返回合并后的奖励结构（与入账 1:1 一致）
 * sceneKey 可选——老调用点（无 sceneKey）也可用于渲染。
 */
function previewShareReward(storage, sceneKey) {
  return computeShareReward(storage, sceneKey).merged
}

module.exports = {
  computeShareReward,
  previewShareReward,
}
