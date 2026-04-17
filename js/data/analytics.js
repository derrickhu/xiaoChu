/**
 * 轻量埋点 — 灵宠消消塔
 *
 * 设计目标：
 *   - 业务代码只关心「什么事情发生了」，不关心上报渠道
 *   - 统一做参数预处理（裁剪 undefined、限制字符串长度等）
 *   - 本地 debug 日志（默认关闭，DEBUG 时开启 console.log 便于本地验证）
 *   - 渠道上报走 platform.reportEvent（内部兼容 wx.reportEvent / reportAnalytics）
 *
 * 事件命名规范：
 *   下划线分隔，<module>_<action>，例如：
 *     - share_card_shown / share_card_clicked / share_card_dismissed
 *     - invite_success
 *     - tier_up / rank_milestone
 *   参数值尽量是 number / bool / 短字符串
 */

const platform = require('../platform')

const DEBUG = false
const MAX_STR_LEN = 64

function _sanitize(params) {
  if (!params || typeof params !== 'object') return {}
  const out = {}
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null) return
    if (typeof v === 'string') {
      out[k] = v.length > MAX_STR_LEN ? v.slice(0, MAX_STR_LEN) : v
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v
    } else if (typeof v === 'object') {
      // 对象 / 数组统一 JSON 化（避免上报渠道拒绝）
      try { out[k] = JSON.stringify(v).slice(0, MAX_STR_LEN) } catch (_e) { /* ignore */ }
    }
  })
  return out
}

/**
 * 上报一条事件
 * @param {string} eventId 事件 ID（上线前需在 MP 后台预注册）
 * @param {object} [params] 附加参数
 */
function track(eventId, params) {
  if (!eventId) return
  const safe = _sanitize(params)
  if (DEBUG) {
    try { console.log('[analytics]', eventId, safe) } catch (_e) { /* ignore */ }
  }
  if (platform && typeof platform.reportEvent === 'function') {
    platform.reportEvent(eventId, safe)
  }
}

module.exports = {
  track,
}
