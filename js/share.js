const P = require('./platform')
const { SHARE_SCENES } = require('./data/shareConfig')

function getShareData(storage) {
  const cfg = SHARE_SCENES.passive
  const st = storage.stats
  const floor = storage.bestFloor
  const isCleared = floor >= 30
  const d = { isCleared, turns: st.bestTotalTurns, dex: (storage.petDex || []).length, floor }
  return {
    title: cfg.titleFn(d),
    imageUrl: isCleared ? cfg.imageUrlCleared : cfg.imageUrl,
  }
}

function shareStats(storage) {
  const cfg = SHARE_SCENES.stats
  const st = storage.stats
  const d = { floor: storage.bestFloor, dex: (storage.petDex || []).length, combo: st.maxCombo }
  const titleFn = cfg.titles[Math.floor(Math.random() * cfg.titles.length)]
  P.shareAppMessage({ title: titleFn(d), imageUrl: cfg.imageUrl })
}

function doShare(g, sceneKey, data) {
  const cfg = SHARE_SCENES[sceneKey]
  if (!cfg) return
  const title = cfg.titleFn ? cfg.titleFn(data || {}) : ''
  const query = data && data.inviterId ? `inviter=${data.inviterId}` : ''
  P.shareAppMessage({ title, imageUrl: cfg.imageUrl, query })
  if (g && g.storage && g.storage.recordShare) {
    const rewarded = g.storage.recordShare()
    if (rewarded && g._toast) g._toast('分享奖励：体力+10')
  }
}

module.exports = { getShareData, shareStats, doShare }
