/**
 * GM 功能模块 — 灵宠消消塔
 * 白名单配置文件：config/gmList.json（发版更新即可新增/移除 GM 账号）
 * GM 玩家拥有：战斗中可「GM 跳过」；固定关卡体力不消耗（读取体力视为充足）；成绩不提交排行榜（rankingService 内统一拦截）
 */
const cloudSync = require('./cloudSync')

let _gmSet = null

function _loadGmList() {
  if (_gmSet) return _gmSet
  try {
    const cfg = require('./gmList.js')
    _gmSet = new Set(cfg.gmOpenIds || [])
    console.log('[GM] 白名单加载成功, 共', _gmSet.size, '人')
  } catch (e) {
    console.warn('[GM] 加载 gmList.js 失败:', e.message)
    _gmSet = new Set()
  }
  return _gmSet
}

// 模块加载时立即尝试加载（捕获可能的路径问题）
_loadGmList()

let _gmLogged = false

/** 判断当前用户是否为 GM（实时检查，兼容 openid 延迟获取） */
function isCurrentUserGM() {
  const openid = cloudSync.getOpenid()
  if (!openid) return false
  const result = _loadGmList().has(openid)
  if (!_gmLogged) {
    _gmLogged = true
    console.log('[GM] 检查 openid:', openid, '→ isGM:', result)
  }
  return result
}

/** 判断指定 openid 是否为 GM */
function isGM(openid) {
  if (!openid) return false
  return _loadGmList().has(openid)
}

module.exports = { isGM, isCurrentUserGM }
