/**
 * 技能色板（palette）
 *
 * 用途：
 *   给每种技能一组视觉色：core 核心亮色、glow 发光色、burst 爆发色、ring 光环色、flash 闪屏色。
 *   让"金系攻击 vs 水系攻击"有明显区别，治疗/护盾/增益有独立色系不混淆。
 *
 * 设计：
 *   - 五行元素：走 tower.ATTR_COLOR 的 main/lt/dk 衍生
 *   - heal / shield / buff / cc_neg（负面控制）独立色板，不跟元素走
 *     原因：一只火系宠物放治疗，颜色必须是金绿而不是橙红，否则玩家误以为是攻击
 */

const { ATTR_COLOR } = require('../tower')

// 非元素色板：所有治疗/护盾/增益/控制统一走这几套
const HEAL_PALETTE = Object.freeze({
  core: '#b6ffbd',
  glow: '#4dff90',
  burst: '#9dffc0',
  ring: '#56d98a',
  flash: '#8effbd',
  text: '#3aff7a',
})

const SHIELD_PALETTE = Object.freeze({
  core: '#ffeab0',
  glow: '#ffd042',
  burst: '#fff4c0',
  ring: '#ffcc40',
  flash: '#ffe888',
  text: '#ffce4a',
})

const BUFF_PALETTE = Object.freeze({
  core: '#ffe08a',
  glow: '#ffcc30',
  burst: '#fff0a0',
  ring: '#ffb820',
  flash: '#fff0a8',
  text: '#ffd04a',
})

const CC_NEG_PALETTE = Object.freeze({
  core: '#c8a4ff',
  glow: '#8450dd',
  burst: '#b088ff',
  ring: '#703dc0',
  flash: '#a474ff',
  text: '#b088ff',
})

// 元素色板：基于 ATTR_COLOR 衍生
function buildElementPalette(attr) {
  const c = ATTR_COLOR[attr]
  if (!c) {
    return {
      core: '#ffffff', glow: '#cccccc', burst: '#ffffff', ring: '#cccccc', flash: '#ffffff', text: '#ffffff',
    }
  }
  return {
    core: c.lt,
    glow: c.main,
    burst: c.lt,
    ring: c.main,
    flash: c.main,
    text: c.main,
  }
}

const ELEMENT_PALETTES = {
  metal: buildElementPalette('metal'),
  wood: buildElementPalette('wood'),
  water: buildElementPalette('water'),
  fire: buildElementPalette('fire'),
  earth: buildElementPalette('earth'),
}

/**
 * 获取技能配色
 * @param {string} kind skillFxKind 输出的 kind
 * @param {string} attr 技能或宠物的属性（metal/wood/...）
 */
function getSkillPalette(kind, attr) {
  switch (kind) {
    case 'heal':
      return HEAL_PALETTE
    case 'shield':
      return SHIELD_PALETTE
    case 'buff':
      return BUFF_PALETTE
    case 'cc':
      // 玩家对敌人 cc 走元素色（紫/蓝看元素），仅在敌人打玩家时走 CC_NEG_PALETTE（由 enemyFx 侧传 force）
      return ELEMENT_PALETTES[attr] || CC_NEG_PALETTE
    case 'convert':
      return ELEMENT_PALETTES[attr] || BUFF_PALETTE
    case 'attack':
    default:
      return ELEMENT_PALETTES[attr] || BUFF_PALETTE
  }
}

module.exports = {
  getSkillPalette,
  HEAL_PALETTE,
  SHIELD_PALETTE,
  BUFF_PALETTE,
  CC_NEG_PALETTE,
  ELEMENT_PALETTES,
}
