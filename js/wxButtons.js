const P = require('./platform')
/**
 * 平台原生按钮管理 — 意见反馈按钮
 * 支持微信/抖音双端
 *
 * 授权按钮（createUserInfoButton）已移除：
 * 基础库 3.15+ 中 createUserInfoButton 会导致
 * insertTextView/updateTextView 等 SystemError 刷屏，
 * 改为在 touchHandler 中通过 wx.getUserInfo / getUserProfile 获取用户信息。
 */

/** 授权按钮已废弃，保留空函数保持调用兼容 */
function updateAuthBtn() {}

let _feedbackBtnDelay = false
/** 更新意见反馈按钮 — 仅在「更多」面板打开时显示，覆盖在「意见反馈」行上 */
function updateFeedbackBtn(g, dpr) {
  if (g.scene !== 'title' || !g.showMorePanel) { destroyFeedbackBtn(g); return }
  const rect = g._feedbackBtnRect
  if (!rect) { destroyFeedbackBtn(g); return }
  const cssRect = { left: rect[0]/dpr, top: rect[1]/dpr, width: rect[2]/dpr, height: rect[3]/dpr }
  if (!g._feedbackBtn) {
    if (_feedbackBtnDelay) return
    _feedbackBtnDelay = true
    setTimeout(() => {
      _feedbackBtnDelay = false
      if (g.scene !== 'title' || !g.showMorePanel || g._feedbackBtn) return
      const r = g._feedbackBtnRect
      if (!r) return
      try {
        const css2 = { left: r[0]/dpr, top: r[1]/dpr, width: r[2]/dpr, height: r[3]/dpr }
        const btn = P.createFeedbackButton({
          type: 'text', text: '',
          style: { left: css2.left, top: css2.top, width: css2.width, height: css2.height,
            backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, borderRadius: 0,
            color: 'rgba(0,0,0,0)', fontSize: 1, lineHeight: css2.height },
        })
        if (!btn) return
        g._feedbackBtn = btn; btn.show()
      } catch(e) { console.warn('[Feedback] createFeedbackButton 失败:', e) }
    }, 500)
  } else {
    try { Object.assign(g._feedbackBtn.style, { left: cssRect.left, top: cssRect.top, width: cssRect.width, height: cssRect.height }) } catch(e) {}
  }
}

function destroyFeedbackBtn(g) {
  if (g._feedbackBtn) {
    try { g._feedbackBtn.hide(); g._feedbackBtn.destroy() } catch(e) {}
    g._feedbackBtn = null
  }
}

let _gameClubBtnDelay = false
/** 游戏圈按钮 — 仅在 title 场景且无弹窗/引导时显示，覆盖在 Canvas 占位区上 */
function updateGameClubBtn(g, dpr) {
  const shouldShow = g.scene === 'title'
    && !g.showMorePanel && !g.showSidebarPanel && !g._showDailyReward
    && !g._confirmDialog && !g._adRewardPopup
    && P.isWeChat
  if (!shouldShow) { destroyGameClubBtn(g); return }
  const rect = g._gameClubBtnRect
  if (!rect) { destroyGameClubBtn(g); return }
  const css = { left: rect[0] / dpr, top: rect[1] / dpr, width: rect[2] / dpr, height: rect[3] / dpr }
  if (!g._gameClubBtn) {
    if (_gameClubBtnDelay) return
    _gameClubBtnDelay = true
    setTimeout(() => {
      _gameClubBtnDelay = false
      if (g.scene !== 'title' || g._gameClubBtn) return
      const r = g._gameClubBtnRect
      if (!r) return
      try {
        const c = { left: r[0] / dpr, top: r[1] / dpr, width: r[2] / dpr, height: r[3] / dpr }
        const btn = P.createGameClubButton({
          icon: 'light',
          style: { left: c.left, top: c.top, width: c.width, height: c.height },
        })
        if (!btn) return
        g._gameClubBtn = btn
        btn.show()
      } catch (e) { console.warn('[GameClub] createGameClubButton 失败:', e) }
    }, 300)
  } else {
    try { Object.assign(g._gameClubBtn.style, css) } catch (e) {}
  }
}

function destroyGameClubBtn(g) {
  if (g._gameClubBtn) {
    try { g._gameClubBtn.hide(); g._gameClubBtn.destroy() } catch (e) {}
    g._gameClubBtn = null
  }
}

module.exports = { updateAuthBtn, updateFeedbackBtn, destroyFeedbackBtn, updateGameClubBtn, destroyGameClubBtn }
