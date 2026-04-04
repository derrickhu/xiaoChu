/**
 * 排行榜 Tab 条命中检测（独立文件，避免 touchHandlers ↔ screens 循环依赖导致 exports 未就绪）
 * 几何须与 screens.js 中 rRanking 的 Tab 栏一致
 */
const V = require('./env')

/** Tab key 顺序须与 screens._RANK_TABS 一致 */
const RANK_TAB_KEYS = ['stage', 'tower', 'dex', 'combo']

function hitTestRankingTab(x, y) {
  const { W, S, safeTop } = V
  const padX = 12 * S
  const tabY = safeTop + 70 * S
  const tabH = 30 * S
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

module.exports = { hitTestRankingTab, RANK_TAB_KEYS }
