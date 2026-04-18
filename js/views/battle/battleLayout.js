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
  // 敌人血条顶部 Y —— 整体上移 22*S，原位置（eAreaBottom - 26*S）留给独立 debuff 行
  // 所有引用敌人血条位置的 UI（血条本身、克制胶囊、新手引导气泡、debuff 图标）统一读取此字段
  const enemyHpTopY = eAreaBottom - 48 * S
  // 敌人 debuff 图标行：位于血条下方，与 eAreaBottom 保持对称间距
  //   blood 底 = enemyHpTopY + 14*S = eAreaBottom - 34*S
  //   debuff cy = eAreaBottom - 18*S（距血条底 16*S、距 eAreaBottom 18*S）
  const enemyBuffRowY = eAreaBottom - 18 * S
  _layoutCache = { boardPad, cellSize, boardH, boardTop, sidePad, petGap, wpnGap, totalGapW, iconSize, teamBarH, hpBarH, hpBarY, teamBarY, eAreaTop, eAreaBottom, enemyHpTopY, enemyBuffRowY }
  _layoutKey = key
  return _layoutCache
}

module.exports = { getBattleLayout }
