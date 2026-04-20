const P = require('./platform')
const { TITLE_HOME } = require('./data/constants')
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

// ============================================================
// 排行榜 CTA 原生授权按钮
// ------------------------------------------------------------
// 为什么需要原生按钮：
//   现在 WeChat 小游戏里，wx.getUserInfo 对"从未授权过"的用户会直接返回
//   "微信用户" 占位，且不再弹出授权面板；wx.getUserProfile 已在 2022-10 废弃。
//   唯一仍能触发真实授权面板的 API 只剩 createUserInfoButton——必须是原生层
//   按钮，用户真实点击才算"用户主动意图"，WeChat 才会弹授权框。
//
// 为什么不直接在 touchHandlers 里 createUserInfoButton：
//   按钮创建 → 用户再点一次 → 才能触发授权。一次 tap 无法直接获得授权信息。
//   必须预先把透明按钮贴在 CTA 文本上方，用户第一次点就是在点原生按钮。
//
// 为什么只在 ranking CTA 用（不在 title 排行按钮）：
//   基础库 3.15+ 上 createUserInfoButton 会刷 insertTextView/updateTextView
//   的 SystemError（装载 TextView 时的调试日志），首页持久常驻按钮会导致
//   日志面板爆炸；CTA 只在排行页未授权时短暂出现，可接受。
// ============================================================

let _rankCtaBtnDelay = false

/** 排行榜"换真实头像昵称" CTA 的透明原生授权按钮 */
function updateRankCtaBtn(g, dpr) {
  const shouldShow = g.scene === 'ranking'
    && P.isWeChat
    && g._rankCtaRect
    && g.storage && g.storage.needsRealNameCta && g.storage.needsRealNameCta()
  if (!shouldShow) { destroyRankCtaBtn(g); return }
  const rect = g._rankCtaRect
  const cssRect = {
    left: Math.round(rect[0] / dpr),
    top: Math.round(rect[1] / dpr),
    width: Math.round(rect[2] / dpr),
    height: Math.round(rect[3] / dpr),
  }
  if (!g._rankCtaBtn) {
    if (_rankCtaBtnDelay) return
    _rankCtaBtnDelay = true
    setTimeout(() => {
      _rankCtaBtnDelay = false
      if (g.scene !== 'ranking' || g._rankCtaBtn) return
      const r = g._rankCtaRect
      if (!r) return
      try {
        const c = {
          left: Math.round(r[0] / dpr),
          top: Math.round(r[1] / dpr),
          width: Math.round(r[2] / dpr),
          height: Math.round(r[3] / dpr),
        }
        const btn = P.createUserInfoButton({
          type: 'text',
          text: '',
          style: {
            left: c.left, top: c.top, width: c.width, height: c.height,
            backgroundColor: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 0, borderRadius: 0,
            color: 'rgba(0,0,0,0)',
            fontSize: 1, lineHeight: c.height,
          },
          withCredentials: false,
        })
        if (!btn) return
        g._rankCtaBtn = btn

        // 拿到真实昵称头像后的统一落地动作：保存 + 重新提交云端 + 刷新列表 + toast
        // 抽出来是因为 onTap 可能从 res.userInfo 拿到，也可能要兜底 wx.getUserInfo 再拿
        const applyUserInfo = (nick, avatar) => {
          g.storage._saveUserInfo({ nickName: nick, avatarUrl: avatar })
          const effScope = (g.rankTab === 'stage') ? (g.rankScope || 'all') : 'all'
          const fetchTab = (g.rankTab === 'tower' && g.rankTowerPeriod === 'weekly') ? 'towerWeekly' : g.rankTab
          // submit 要 await 完再 fetch，否则 fetch 会先拿回带匿名昵称的旧记录
          ;(async () => {
            try { await g.storage.submitDexAndCombo() } catch (_) {}
            try { await g.storage.submitStageRanking() } catch (_) {}
            try { await g.storage.fetchRanking(fetchTab, true, effScope) } catch (_) {}
            try {
              const snap = g.storage._ranking && g.storage._ranking.getContextSnapshot && g.storage._ranking.getContextSnapshot()
              if (snap && snap.bestFloor > 0) {
                await g.storage._ranking.submitScore(
                  snap.bestFloor,
                  snap.bestFloorPets || [],
                  snap.bestFloorWeapon || null,
                  snap.bestTotalTurns || 0,
                )
              }
            } catch (_) {}
            g._dirty = true
          })()
          try { P.showToast && P.showToast({ title: '已更新昵称头像', icon: 'success' }) } catch (_) {}
          g._dirty = true
          destroyRankCtaBtn(g)
        }

        // onTap 里 res 拿不到真实信息时的二次兜底：
        //   getSetting 查 scope.userInfo 是否已授权 → 已授权则 getUserInfo 直接拉
        //   覆盖开发者工具 onTap 回调信息不完整 / 回调根本不带 userInfo 的场景
        const secondaryFetch = () => {
          const base = typeof wx !== 'undefined' ? wx : null
          if (!base || typeof base.getSetting !== 'function') {
            try { P.showToast && P.showToast({ title: '授权失败，请稍后重试', icon: 'none' }) } catch (_) {}
            return
          }
          base.getSetting({
            success: (sres) => {
              const granted = sres && sres.authSetting && sres.authSetting['scope.userInfo']
              console.log('[RankCtaBtn] secondary getSetting scope.userInfo=', granted)
              if (!granted) {
                // 用户可能拒绝或从未授权 → 引导设置页，给二次机会
                try {
                  g.storage._tryOpenSetting((ok) => {
                    if (ok) {
                      try { g.storage.submitDexAndCombo() } catch (_) {}
                      try { g.storage.submitStageRanking() } catch (_) {}
                      g._dirty = true
                      destroyRankCtaBtn(g)
                    } else {
                      try { P.showToast && P.showToast({ title: '未获取到授权', icon: 'none' }) } catch (_) {}
                    }
                  })
                } catch (_) {
                  try { P.showToast && P.showToast({ title: '授权失败，请稍后重试', icon: 'none' }) } catch (_) {}
                }
                return
              }
              // 已授权但 onTap 没给数据 → 手动 getUserInfo 拉一次
              base.getUserInfo({
                withCredentials: false,
                success: (ires) => {
                  const info = ires && ires.userInfo
                  const n = info && info.nickName
                  const a = info && info.avatarUrl
                  console.log('[RankCtaBtn] secondary getUserInfo:', JSON.stringify({ nick: n, hasAvatar: !!a }))
                  if (n && n !== '微信用户' && a && a.length > 10) {
                    applyUserInfo(n, a)
                  } else {
                    // 新政兜底：已授权但系统仍返回"微信用户"占位
                    try { P.showToast && P.showToast({ title: '微信限制，暂无法获取真实头像', icon: 'none', duration: 2500 }) } catch (_) {}
                  }
                },
                fail: (err) => {
                  console.warn('[RankCtaBtn] secondary getUserInfo fail:', err && err.errMsg)
                  try { P.showToast && P.showToast({ title: '授权失败，请稍后重试', icon: 'none' }) } catch (_) {}
                },
              })
            },
            fail: (err) => {
              console.warn('[RankCtaBtn] secondary getSetting fail:', err && err.errMsg)
              try { P.showToast && P.showToast({ title: '授权失败，请稍后重试', icon: 'none' }) } catch (_) {}
            },
          })
        }

        btn.onTap((res) => {
          const nick = res && res.userInfo && res.userInfo.nickName
          const avatar = res && res.userInfo && res.userInfo.avatarUrl
          const errMsg = (res && res.errMsg) || ''
          const privacyBlocked = errMsg.indexOf('no privacy api permission') !== -1 || (res && res.err_code) === -12034
          console.log('[RankCtaBtn] onTap:', JSON.stringify({
            hasUserInfo: !!(res && res.userInfo),
            nick, errMsg, err_code: res && res.err_code,
          }))
          if (privacyBlocked) {
            // 隐私协议未在后台配置好，走不下去；给用户一个可见反馈而不是静默
            try { P.showToast && P.showToast({ title: '隐私协议未配置', icon: 'none' }) } catch (_) {}
            return
          }
          const gotReal = nick && nick !== '微信用户' && avatar && avatar.length > 10
          const userDenied = errMsg && errMsg.indexOf('fail') !== -1 && errMsg.indexOf('deny') !== -1
          if (gotReal) {
            applyUserInfo(nick, avatar)
            return
          }
          if (userDenied) {
            // 用户明确拒绝 → 走设置页引导（给二次机会）
            try {
              g.storage._tryOpenSetting((ok) => {
                if (ok) {
                  try { g.storage.submitDexAndCombo() } catch (_) {}
                  try { g.storage.submitStageRanking() } catch (_) {}
                  g._dirty = true
                  destroyRankCtaBtn(g)
                } else {
                  try { P.showToast && P.showToast({ title: '未获取到授权信息', icon: 'none' }) } catch (_) {}
                }
              })
            } catch (_) {
              try { P.showToast && P.showToast({ title: '授权失败，请稍后重试', icon: 'none' }) } catch (_) {}
            }
            return
          }
          // onTap 触发但 res 里既没有 userInfo 又没有 deny —— 开发者工具/新基础库常见
          // 此时"允许"其实已经点了，走 getSetting + getUserInfo 的二次兜底再捞一次
          console.log('[RankCtaBtn] res 无 userInfo 且未显式拒绝，走 secondaryFetch 兜底')
          secondaryFetch()
        })
        btn.show && btn.show()
      } catch (e) {
        console.warn('[RankCtaBtn] createUserInfoButton 失败:', e)
      }
    }, 200)
  } else {
    // CTA 位置变化时同步按钮坐标（例如切换源导致 CTA 消失/重现）
    try { Object.assign(g._rankCtaBtn.style, cssRect) } catch (e) {}
  }
}

function destroyRankCtaBtn(g) {
  if (g._rankCtaBtn) {
    try { g._rankCtaBtn.hide && g._rankCtaBtn.hide() } catch (e) {}
    try { g._rankCtaBtn.destroy && g._rankCtaBtn.destroy() } catch (e) {}
    g._rankCtaBtn = null
  }
}

// ============================================================
// 排行榜入口原生授权按钮（挂件 / 排行按钮 覆盖层）
// ------------------------------------------------------------
// 诉求：未授权玩家从任何排行入口（结算页秘境榜挂件 / 通天塔 gameover 挂件 /
//       首页"排行"按钮等）点进来时，都应该先弹微信原生授权面板。
// 实现：各 view 在渲染"通往排行榜"的按钮/挂件时，若 storage.needsRealNameCta()，
//       就把按钮矩形 + 目标 tab 写到 g._rankEntryAuth = { rect, tab }。
//       本函数每帧同步一个透明 createUserInfoButton 盖在那个矩形上——玩家第一次点
//       到它就等同于点原生按钮 → 微信直接弹授权 → 我们拿到真名头像后导航进榜。
// 授权未通过也要能进榜（不能把玩家卡死在结算页），所以 fallback 一律走 _navToRanking。
// ============================================================

let _rankEntryAuthBtnDelay = false

/** 通用：把 wx.setUserCloudStorage / 排行写入 + 场景切换一次性收口，onTap / secondary 两条路共用 */
function _applyAuthAndNav(g, nick, avatar, tab) {
  g.storage._saveUserInfo({ nickName: nick, avatarUrl: avatar })

  // 立刻进"刷新中"态 → 避免 setScene 后先闪一下授权前的匿名列表
  //   · rankLastFetch=0：打掉 fetchRanking 内部的 30s TTL 缓存分支
  //   · rankLoading=true：让榜单页显示骨架/加载，而不是 rankStageList 里旧数据
  try {
    g.storage.rankLastFetch = 0
    g.storage.rankLoading = true
    g.storage.rankLoadingMsg = '授权成功，更新中...'
  } catch (_) {}

  _navToRanking(g, tab)
  try { P.showToast && P.showToast({ title: '已授权，带真名上榜', icon: 'success' }) } catch (_) {}

  ;(async () => {
    try { await g.storage.submitDexAndCombo() } catch (_) {}
    try { await g.storage.submitStageRanking() } catch (_) {}
    try {
      const snap = g.storage._ranking && g.storage._ranking.getContextSnapshot && g.storage._ranking.getContextSnapshot()
      if (snap && snap.bestFloor > 0) {
        await g.storage._ranking.submitScore(
          snap.bestFloor,
          snap.bestFloorPets || [],
          snap.bestFloorWeapon || null,
          snap.bestTotalTurns || 0,
        )
      }
    } catch (_) {}
    // 三份云记录都更新完 → 强拉当前 Tab；漏了这一步，榜里还是授权前的匿名名
    //   · 之前 CTA 按钮路径是提交完 await fetchRanking(force=true)，widget 覆盖这条新路径也得对齐
    try {
      const fetchTab = (g.rankTab === 'tower' && g.rankTowerPeriod === 'weekly') ? 'towerWeekly' : (g.rankTab || 'stage')
      const scope = g.rankScope || 'all'
      await g.storage.fetchRanking(fetchTab, true, scope)
    } catch (_) {}
    g._dirty = true
  })()
}

function _navToRanking(g, tab) {
  const t = tab || 'stage'
  g.rankTab = t === 'towerWeekly' ? 'tower' : t
  g.rankSource = 'all'
  if (t === 'towerWeekly') g.rankTowerPeriod = 'weekly'
  // 进榜前把 pendingFeedback 消费掉，避免重复弹窗
  try { require('./views/rankChangePopup').drainPending(g) } catch (_) {}
  g.setScene('ranking')
}

function updateRankEntryAuthBtn(g, dpr) {
  const overlay = g._rankEntryAuth
  const needCta = g.storage && g.storage.needsRealNameCta && g.storage.needsRealNameCta()
  const shouldShow = P.isWeChat && overlay && overlay.rect && needCta
  if (!shouldShow) { destroyRankEntryAuthBtn(g); return }

  const r = overlay.rect
  const cssRect = {
    left: Math.round(r[0] / dpr),
    top: Math.round(r[1] / dpr),
    width: Math.round(r[2] / dpr),
    height: Math.round(r[3] / dpr),
  }

  if (!g._rankEntryAuthBtn) {
    if (_rankEntryAuthBtnDelay) return
    _rankEntryAuthBtnDelay = true
    setTimeout(() => {
      _rankEntryAuthBtnDelay = false
      if (g._rankEntryAuthBtn || !g._rankEntryAuth) return
      const latest = g._rankEntryAuth
      if (!latest || !latest.rect) return
      const tab = latest.tab || 'stage'
      const lr = latest.rect
      const cs = {
        left: Math.round(lr[0] / dpr),
        top: Math.round(lr[1] / dpr),
        width: Math.round(lr[2] / dpr),
        height: Math.round(lr[3] / dpr),
      }
      try {
        const btn = P.createUserInfoButton({
          type: 'text',
          text: '',
          style: {
            left: cs.left, top: cs.top, width: cs.width, height: cs.height,
            backgroundColor: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)',
            borderWidth: 0, borderRadius: 0,
            color: 'rgba(0,0,0,0)',
            fontSize: 1, lineHeight: cs.height,
          },
          withCredentials: false,
        })
        if (!btn) return
        g._rankEntryAuthBtn = btn

        btn.onTap((res) => {
          const nick = res && res.userInfo && res.userInfo.nickName
          const avatar = res && res.userInfo && res.userInfo.avatarUrl
          const errMsg = (res && res.errMsg) || ''
          const privacyBlocked = errMsg.indexOf('no privacy api permission') !== -1 || (res && res.err_code) === -12034
          const gotReal = nick && nick !== '微信用户' && avatar && avatar.length > 10
          const userDenied = errMsg && errMsg.indexOf('fail') !== -1 && errMsg.indexOf('deny') !== -1
          console.log('[RankEntryAuthBtn] onTap:', JSON.stringify({
            hasUserInfo: !!(res && res.userInfo), nick, errMsg, err_code: res && res.err_code,
          }))
          // 销毁按钮：下一帧 view 会根据 needsRealNameCta 决定是否重建（授权成功后 needsRealNameCta=false → 不重建）
          destroyRankEntryAuthBtn(g)
          if (privacyBlocked) {
            try { P.showToast && P.showToast({ title: '隐私协议未配置', icon: 'none' }) } catch (_) {}
            _navToRanking(g, tab)
            return
          }
          if (gotReal) {
            _applyAuthAndNav(g, nick, avatar, tab)
            return
          }
          if (userDenied) {
            try { P.showToast && P.showToast({ title: '未获取到授权，稍后可在榜单顶部重试', icon: 'none', duration: 2200 }) } catch (_) {}
            _navToRanking(g, tab)
            return
          }
          // 回调里既没用户信息也没显式拒绝 → 先进榜，顶部 CTA 还可以再点一次
          _navToRanking(g, tab)
        })
        btn.show && btn.show()
      } catch (e) {
        console.warn('[RankEntryAuthBtn] createUserInfoButton 失败:', e)
      }
    }, 120)
  } else {
    try { Object.assign(g._rankEntryAuthBtn.style, cssRect) } catch (e) {}
  }
}

function destroyRankEntryAuthBtn(g) {
  if (g._rankEntryAuthBtn) {
    try { g._rankEntryAuthBtn.hide && g._rankEntryAuthBtn.hide() } catch (_) {}
    try { g._rankEntryAuthBtn.destroy && g._rankEntryAuthBtn.destroy() } catch (_) {}
    g._rankEntryAuthBtn = null
  }
}

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

function _gameClubNativeStyle(rect, dpr) {
  const c = {
    left: Math.round(rect[0] / dpr),
    top: Math.round(rect[1] / dpr),
    width: Math.round(rect[2] / dpr),
    height: Math.round(rect[3] / dpr),
  }
  return {
    left: c.left,
    top: c.top,
    width: c.width,
    height: c.height,
    // 必须为透明底，否则原生层默认黑底；宽高度取整避免亚像素宽高被非均匀拉伸
    backgroundColor: 'rgba(0,0,0,0)',
    borderWidth: 0,
    borderColor: 'rgba(0,0,0,0)',
    borderRadius: Math.max(4, Math.round(c.width * 0.18)),
  }
}

/** 游戏圈按钮 — 仅在 title 场景且无弹窗/引导时显示，覆盖在 Canvas 占位区上 */
function updateGameClubBtn(g, dpr) {
  if (TITLE_HOME.gameClubOpenlink) {
    destroyGameClubBtn(g)
    return
  }
  const shouldShow = g.scene === 'title'
    && !g.showMorePanel && !g.showSidebarPanel && !g._showDailySign && !g._showDailyTasks
    && !g._confirmDialog && !g._adRewardPopup
    && P.isWeChat
  if (!shouldShow) { destroyGameClubBtn(g); return }
  const rect = g._gameClubNativeRect || g._gameClubBtnRect
  if (!rect) { destroyGameClubBtn(g); return }
  const css = _gameClubNativeStyle(rect, dpr)
  if (!g._gameClubBtn) {
    if (_gameClubBtnDelay) return
    _gameClubBtnDelay = true
    setTimeout(() => {
      _gameClubBtnDelay = false
      if (g.scene !== 'title' || g._gameClubBtn) return
      const r = g._gameClubNativeRect || g._gameClubBtnRect
      if (!r) return
      try {
        const imageStyle = _gameClubNativeStyle(r, dpr)
        // 官方仅预设四套 icon；type=image 可用自定义底图（仍会叠加小号官方角标，icon 必填，选 white 弱对比）
        const img = TITLE_HOME.gameClubBtnImage
        let btn = null
        try {
          btn = P.createGameClubButton({
            type: 'image',
            image: img,
            icon: 'white',
            style: imageStyle,
          })
        } catch (e1) {
          console.warn('[GameClub] type=image 失败，回退 preset:', e1)
        }
        if (!btn) {
          btn = P.createGameClubButton({ icon: 'light', style: imageStyle })
        }
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

module.exports = {
  updateAuthBtn,
  updateFeedbackBtn, destroyFeedbackBtn,
  updateGameClubBtn, destroyGameClubBtn,
  updateRankCtaBtn, destroyRankCtaBtn,
  updateRankEntryAuthBtn, destroyRankEntryAuthBtn,
}
