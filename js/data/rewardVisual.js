/**
 * 结算/奖励展示用视觉：R/SR/SSR 文案仍取品质配置，颜色统一走五行属性，避免固定紫/金与灵宠属性割裂
 */
const { ATTR_COLOR } = require('./tower')
const { RARITY_VISUAL } = require('./economyConfig')

function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 136, g: 136, b: 136 }
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('')
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return { r: 136, g: 136, b: 136 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/** @param {string} hex @param {number} a 0~1 */
function rgbaFromHex(hex, a) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

/**
 * @param {'R'|'SR'|'SSR'} rarityKey
 * @param {keyof typeof ATTR_COLOR} attrKey
 */
function rarityVisualForAttr(rarityKey, attrKey) {
  const base = RARITY_VISUAL[rarityKey] || RARITY_VISUAL.R
  const ac = ATTR_COLOR[attrKey] || ATTR_COLOR.metal
  const { r, g, b } = hexToRgb(ac.main)
  return {
    label: base.label,
    name: base.name,
    borderColor: ac.main,
    bgGradient: [ac.bg, ac.dk || ac.bg],
    glowColor: `rgba(${r},${g},${b},0.45)`,
    badgeColor: ac.lt || ac.main,
    badgeBg: ac.bg,
    hasParticles: !!base.hasParticles,
  }
}

module.exports = {
  rarityVisualForAttr,
  rgbaFromHex,
  hexToRgb,
}
