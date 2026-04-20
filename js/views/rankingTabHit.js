/**
 * 排行榜 Tab 条命中检测（独立文件，避免 touchHandlers ↔ screens 循环依赖导致 exports 未就绪）
 * 几何须与 screens.js 中 rRanking 的 Tab 栏一致
 *
 * 布局（从上到下）：
 *   safeTop + 40   标题
 *   safeTop + 66   顶层数据源选择（全服 / 好友），高 22
 *   safeTop + 96   主 Tab 行（秘境/通天塔/图鉴/连击），高 30
 */
const V = require('./env')

/** Tab key 顺序须与 screens._RANK_TABS 一致（四个维度 Tab） */
const RANK_TAB_KEYS = ['stage', 'tower', 'dex', 'combo']

/** 顶层数据源选择的几何（供 touchHandlers 也能算） */
function getSourceTabGeom() {
  const { W, S, safeTop } = V
  const padX = 12 * S
  const y = safeTop + 66 * S
  const h = 22 * S
  const totalW = W - padX * 2
  const gap = 4 * S
  const singleW = (totalW - gap) / 2
  return { padX, y, h, singleW, gap }
}

/** 主 Tab 行的 Y / 高 */
function getMainTabY() {
  const { safeTop, S } = V
  return safeTop + 96 * S
}

function getMainTabH() {
  const { S } = V
  return 30 * S
}

function hitTestRankingTab(x, y) {
  const { W, S } = V
  const padX = 12 * S
  const tabY = getMainTabY()
  const tabH = getMainTabH()
  const tabGap = 5 * S
  const vPad = 12 * S
  const hPad = 6 * S
  if (y < tabY - vPad || y > tabY + tabH + vPad) return null
  if (x < padX - hPad || x > W - padX + hPad) return null
  const n = RANK_TAB_KEYS.length
  const totalTabW = W - padX * 2 - tabGap * (n - 1)
  const singleTabW = totalTabW / n
  let bestIdx = 0
  let bestDist = Infinity
  for (let i = 0; i < n; i++) {
    const cx = padX + i * (singleTabW + tabGap) + singleTabW / 2
    const d = Math.abs(x - cx)
    if (d < bestDist) {
      bestDist = d
      bestIdx = i
    }
  }
  return RANK_TAB_KEYS[bestIdx]
}

module.exports = {
  hitTestRankingTab,
  RANK_TAB_KEYS,
  getSourceTabGeom,
  getMainTabY,
  getMainTabH,
}
