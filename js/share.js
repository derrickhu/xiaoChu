const P = require('./platform')
/**
 * 分享功能 — 从 Main 中提取，支持微信/抖音双端
 */

/** 被动分享数据（wx.onShareAppMessage 回调） */
function getShareData(storage) {
  const st = storage.stats
  const floor = storage.bestFloor
  const isCleared = floor >= 30
  const dexCount = (storage.petDex || []).length
  const title = isCleared
    ? `${st.bestTotalTurns ? st.bestTotalTurns + '回合' : ''}通关五行通天塔！收集${dexCount}只灵兽，你敢来挑战吗？`
    : `我已攻到消消塔第${floor}层，收集了${dexCount}只灵兽，你能比我更强吗？`
  return { title, imageUrl: isCleared ? 'assets/share/share_cover.jpg' : 'assets/share/share_default.jpg' }
}

/** 主动分享战绩（统计页面触发） */
function shareStats(storage) {
  const st = storage.stats
  const floor = storage.bestFloor
  const isCleared = floor >= 30
  const dexCount = (storage.petDex || []).length
  const bestTurns = st.bestTotalTurns || 0
  const titles = isCleared
    ? [
        `五行通天塔已通关！${bestTurns ? bestTurns + '回合极速登顶，' : ''}收集${dexCount}只灵兽，你敢来挑战吗？`,
        `${bestTurns ? '仅用' + bestTurns + '回合' : '已'}通关消消塔！${dexCount}只灵兽助我登顶，不服来战！`,
        `通天塔30层全通关！最高${st.maxCombo}连击，${dexCount}只灵兽收入囊中，等你来超越！`,
      ]
    : [
        `我已攻到消消塔第${floor}层，收集了${dexCount}只灵兽，最高${st.maxCombo}连击！你能超越吗？`,
        `消消塔第${floor}层！${dexCount}只灵兽助阵，${bestTurns ? bestTurns + '回合最速记录，' : ''}来挑战我吧！`,
        `五行通天塔第${floor}层，最高${st.maxCombo}连击！收集${dexCount}只灵兽，你敢来比吗？`,
      ]
  P.shareAppMessage({
    title: titles[Math.floor(Math.random() * titles.length)],
    imageUrl: 'assets/share/share_cover.jpg',
  })
}

module.exports = { getShareData, shareStats }
