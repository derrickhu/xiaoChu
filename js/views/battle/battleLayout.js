/**
 * 战斗场景布局缓存（与 battleView、battleHelpers 共用同一套几何，避免重复与漂移）
 */
const V = require('../env')

let _layoutCache = null
let _layoutKey = ''

function getBattleLayout() {
  const { W, H, S, safeTop, COLS, ROWS } = V
  const key = `${W}|${H}|${S}|${safeTop}|${COLS}|${ROWS}`
  if (_layoutCache && _layoutKey === key) return _layoutCache
  const boardPad = 6 * S
  const cellSize = (W - boardPad * 2) / COLS
  const boardH = ROWS * cellSize
  const bottomPad = 8 * S
  const boardTop = H - bottomPad - boardH
  const sidePad = 8 * S
  const petGap = 8 * S
  const wpnGap = 12 * S
  const totalGapW = wpnGap + petGap * 4 + sidePad * 2
  const iconSize = (W - totalGapW) / 6
  const teamBarH = iconSize + 6 * S
  const hpBarH = 18 * S
  const hpBarY = boardTop - hpBarH - 4 * S
  const teamBarY = hpBarY - teamBarH - 2 * S
  const eAreaTop = safeTop + 4 * S
  const eAreaBottom = teamBarY - 4 * S
  _layoutCache = { boardPad, cellSize, boardH, boardTop, sidePad, petGap, wpnGap, totalGapW, iconSize, teamBarH, hpBarH, hpBarY, teamBarY, eAreaTop, eAreaBottom }
  _layoutKey = key
  return _layoutCache
}

module.exports = { getBattleLayout }
