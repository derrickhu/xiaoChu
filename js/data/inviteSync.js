/**
 * 邀请裂变云端同步
 *
 * 职责：
 *   1. 新玩家首登：若有 pendingInviteReport → 调 share.recordInvite 上报
 *   2. 老玩家回归：调 share.claimInvites 拉取未领取奖励 → storage.grantInviterReward 入账
 *
 * 单独成模块是为了：
 *   - 不让 storage.js 耦合 xiaochu-api 邀请细节
 *   - 不让 cloudSync.js 塞业务逻辑
 *   - main.js 在云端 ready 后调一次 syncOnce(storage, onReward)
 */
const P = require('../platform')
const api = require('../api')
const cloudSync = require('./cloudSync')
const gpAnalytics = require('./gpAnalytics')

let _synced = false

// share 路由尚未部署时可能回 FUNCTION_NOT_FOUND(-501000)，这是"功能未上线"的预期错误，
// 不必污染控制台；其它真实错误（网络/权限/业务）仍正常 warn 出来便于排查
function _isFunctionNotFound(e) {
  if (!e) return false
  if (e.errCode === -501000) return true
  const msg = (e.errMsg || e.message || String(e))
  return /FUNCTION_NOT_FOUND|-501000|FunctionName parameter could not be found/i.test(msg)
}

/**
 * 执行一次邀请同步（启动后 cloudSyncReady 时调用；幂等）
 * @param {object} storage
 * @param {function(object):void} [onInviterReward] 老玩家成功收到反奖时回调 { count, soulStone }
 */
async function syncOnce(storage, onInviterReward) {
  if (_synced) return
  if (!P.isWeChat) return  // 抖音暂无对应邀请活动
  if (!cloudSync.isReady()) return
  const openid = cloudSync.getOpenid && cloudSync.getOpenid()
  if (!openid) return
  _synced = true

  // 1. 新玩家首登上报
  const pending = storage.getPendingInviteReport && storage.getPendingInviteReport()
  if (pending) {
    try {
      const r = await api.recordInvite(pending)
      const result = (r && r.data) || r || {}
      if (result.recorded) {
        console.log('[invite] recordInvite ok for inviter:', pending)
        // 埋点：新玩家被邀请注册成功（仅记录 inviter 是否存在，不暴露明文 openid）
        gpAnalytics.track('invite_success', { role: 'newbie' })
      } else {
        const reason = result.reason || 'unknown'
        console.log('[invite] recordInvite skipped:', result)
        gpAnalytics.track('invite_skip', { role: 'newbie', reason })
      }
    } catch (e) {
      if (!_isFunctionNotFound(e)) console.warn('[invite] recordInvite failed:', e.message || e)
    } finally {
      storage.clearPendingInviteReport && storage.clearPendingInviteReport()
    }
  }

  // 2. 老玩家拉未领奖励
  try {
    const r = await api.claimInvites()
    const result = (r && r.data) || r || {}
    const count = result.count || 0
    if (count > 0 && storage.grantInviterReward) {
      const granted = storage.grantInviterReward(count)
      if (granted && onInviterReward) onInviterReward(granted)
      // 埋点：老玩家成功收到反奖（count = 本次新到账人数）
      gpAnalytics.track('invite_success', { role: 'inviter', count })
    }
  } catch (e) {
    if (!_isFunctionNotFound(e)) console.warn('[invite] claimInvites failed:', e.message || e)
  }
}

// 手动重置（通常用于测试）
function _reset() { _synced = false }

module.exports = { syncOnce, _reset }
