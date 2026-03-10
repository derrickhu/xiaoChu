const P = require('./platform')
/**
 * 平台原生按钮管理 — 授权按钮（排行榜入口）和意见反馈按钮
 * 支持微信/抖音双端
 */

/** 更新 title 场景的透明授权按钮（覆盖在底部栏「排行」图标上） */
function updateAuthBtn(g, dpr) {
  if (g.scene !== 'title') { g.storage.destroyUserInfoBtn(); return }
  if (g.storage.userAuthorized) { g.storage.destroyUserInfoBtn(); return }
  // 「更多」面板或弹窗打开时，隐藏授权按钮避免遮挡
  if (g.showMorePanel || g.showNewRunConfirm) { g.storage.destroyUserInfoBtn(); return }
  const btnRect = g._rankBtnRect
  if (!btnRect) return
  const cssRect = { left: btnRect[0]/dpr, top: btnRect[1]/dpr, width: btnRect[2]/dpr, height: btnRect[3]/dpr }
  if (!g.storage._userInfoBtn) {
    console.log('[AuthBtn] 创建透明授权按钮, cssRect:', JSON.stringify(cssRect))
    g.storage.showUserInfoBtn(cssRect, (ok, info) => {
      if (ok) console.log('[Ranking] 授权成功:', info.nickName, info.avatarUrl)
      else console.warn('[Ranking] 用户拒绝授权，以游客身份进入排行榜')
      g._openRanking()
    })
  }
}

/** 更新意见反馈按钮 — 仅在「更多」面板打开时显示，覆盖在「意见反馈」行上 */
function updateFeedbackBtn(g, dpr) {
  if (g.scene !== 'title' || !g.showMorePanel) { destroyFeedbackBtn(g); return }
  const rect = g._feedbackBtnRect
  if (!rect) { destroyFeedbackBtn(g); return }
  const cssRect = { left: rect[0]/dpr, top: rect[1]/dpr, width: rect[2]/dpr, height: rect[3]/dpr }
  if (!g._feedbackBtn) {
    try {
      const btn = P.createFeedbackButton({
        type: 'text', text: '',
        style: { left: cssRect.left, top: cssRect.top, width: cssRect.width, height: cssRect.height,
          backgroundColor: 'rgba(0,0,0,0)', borderColor: 'rgba(0,0,0,0)', borderWidth: 0, borderRadius: 0,
          color: 'rgba(0,0,0,0)', fontSize: 1, lineHeight: cssRect.height },
      })
      if (!btn) return
      g._feedbackBtn = btn; btn.show()
    } catch(e) { console.warn('[Feedback] createFeedbackButton 失败:', e) }
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

module.exports = { updateAuthBtn, updateFeedbackBtn, destroyFeedbackBtn }
