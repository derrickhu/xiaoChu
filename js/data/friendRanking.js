/**
 * 好友榜客户端助手 — 主域侧
 * ----------------------------------------------------
 * 职责：
 *   1. 四维度分数上报（wx.setUserCloudStorage）：通天塔层数 / 秘境星数 / 图鉴精通 / 最高连击
 *   2. 与 openDataContext 子包通信（postMessage），驱动好友榜渲染
 *   3. 暴露 getSharedCanvas() 让主域 drawImage 上屏
 *   4. 全部微信专属 API 做 isSupported() 兜底，非微信 / 旧基础库自动降级
 *
 * 设计取舍：
 *   - 好友数据只存在 openDataContext 中（微信强制要求），主域只能"画"不能"读"
 *   - 所以滚动位置、子 Tab 都由主域维护，通过 postMessage 下发给子域
 *   - 上报分数做了节流（minGap=10s），避免短时间内反复提交浪费配额
 */

const P = require('../platform')

// 四维度 key：须与 openDataContext/index.js 的 TAB_META 完全一致
const SCORE_KEYS = {
  tower: 'towerFloor',
  stage: 'stageStars',
  /** 图鉴：复合分写入 dexBoard（精通/收录/池数），避免「精通为 0 就不上榜」与全服榜不一致 */
  dex:   'dexBoard',
  combo: 'comboMax',
}

/** 与全服 rankDex 排序一致：精通优先，其次收录，再次入池数；写入微信 KV 的整数（带 1e8 前缀与旧版区分） */
function encodeDexBoardScore(mastered, collected, poolSize) {
  const m = Math.max(0, Math.min(999, mastered | 0))
  const c = Math.max(0, Math.min(999, collected | 0))
  const p = Math.max(0, Math.min(999, poolSize | 0))
  if (m + c + p <= 0) return 0
  return 100000000 + m * 1000000 + c * 1000 + p
}

let _lastUploadTs = 0
let _lastUploadVals = {}
const MIN_UPLOAD_GAP_MS = 10 * 1000

function isSupported() {
  if (!P.isWeChat) return false
  if (typeof wx === 'undefined') return false
  if (typeof wx.getOpenDataContext !== 'function') return false
  return true
}

function getOpenDataContext() {
  if (!isSupported()) return null
  try {
    return wx.getOpenDataContext()
  } catch (_) {
    return null
  }
}

function getSharedCanvas() {
  const odc = getOpenDataContext()
  return odc ? odc.canvas : null
}

/**
 * 主域侧同步 sharedCanvas 物理像素尺寸
 * ----------------------------------------------------
 * sharedCanvas 在新基础库里对 openDataContext 只读，必须由主域写入 width/height。
 * 只有当目标尺寸变化时才赋值，避免每帧 reset（会清空绘制内容并产生潜在重建开销）。
 */
let _lastCanvasW = 0
let _lastCanvasH = 0
function ensureSharedCanvasSize(width, height) {
  const canvas = getSharedCanvas()
  if (!canvas) return
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  if (_lastCanvasW === w && _lastCanvasH === h && canvas.width === w && canvas.height === h) return
  try {
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    _lastCanvasW = w
    _lastCanvasH = h
  } catch (e) {
    console.warn('[FriendRank] sharedCanvas resize failed', e)
  }
}

function postMessage(msg) {
  const odc = getOpenDataContext()
  if (!odc || typeof odc.postMessage !== 'function') return
  try {
    odc.postMessage(msg)
  } catch (e) {
    console.warn('[FriendRank] postMessage failed', e)
  }
}

/**
 * 上报四维度分数到 wx.setUserCloudStorage
 * @param {object} ctx  RankingService getContext() 的返回结构（或等价结构）
 * @param {object} [opts] { force:true 跳过节流, tabs:['tower',...] 只报部分维度 }
 */
function uploadScores(ctx, opts) {
  opts = opts || {}
  if (!isSupported()) return
  if (typeof wx.setUserCloudStorage !== 'function') return
  if (!ctx) return

  // 节流：同样的值 10s 内不重复报
  const now = Date.now()
  const currVals = {
    tower: ctx.bestFloor || 0,
    stage: ctx.stageTotalStars || 0,
    dex:   encodeDexBoardScore(ctx.masteredCount || 0, ctx.collectedCount || 0, ctx.petDexCount || 0),
    combo: ctx.maxCombo || 0,
  }
  const unchanged = ['tower', 'stage', 'dex', 'combo'].every(k => _lastUploadVals[k] === currVals[k])
  if (!opts.force && unchanged && now - _lastUploadTs < MIN_UPLOAD_GAP_MS) return

  const wantTabs = opts.tabs || ['tower', 'stage', 'dex', 'combo']
  const KVDataList = []
  for (const tab of wantTabs) {
    const key = SCORE_KEYS[tab]
    let val = currVals[tab]
    if (!key) continue
    if (tab === 'dex' && val <= 0) continue
    // 微信要求 value 是 JSON 字符串，且结构 { wxgame: { score, update_time } } 才能进入排行榜
    const payload = JSON.stringify({
      wxgame: {
        score: val,
        update_time: Math.floor(now / 1000),
      },
    })
    KVDataList.push({ key, value: payload })
  }
  if (!KVDataList.length) return

  try {
    wx.setUserCloudStorage({
      KVDataList,
      success: () => {
        _lastUploadTs = now
        _lastUploadVals = currVals
        // 通知 openDataContext 清缓存（下次拉取好友榜会看到最新自分）
        postMessage({ action: 'invalidate' })
      },
      fail: (err) => {
        console.warn('[FriendRank] setUserCloudStorage fail', err)
      },
    })
  } catch (e) {
    console.warn('[FriendRank] setUserCloudStorage throw', e)
  }
}

/**
 * 请求 openDataContext 重绘好友榜
 * @param {object} params { tab, width, height, scrollY, pixelRatio, selfOpenId, force }
 */
function render(params) {
  postMessage(Object.assign({ action: 'render' }, params || {}))
}

module.exports = {
  SCORE_KEYS,
  encodeDexBoardScore,
  isSupported,
  getSharedCanvas,
  ensureSharedCanvasSize,
  uploadScores,
  render,
  postMessage,
}
