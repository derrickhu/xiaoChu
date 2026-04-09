const { rarityVisualForAttr } = require('../data/rewardVisual')

function _badgeWidth(label, S, minW) {
  return Math.max(minW || 22 * S, label.length * 6.8 * S + 6 * S)
}

function drawCornerRarityBadge(c, R, S, x, y, rarityKey, attrKey, options) {
  if (!rarityKey) return
  const rv = rarityVisualForAttr(rarityKey, attrKey || 'metal')
  const label = rv.label || rarityKey
  const opt = options || {}
  const w = _badgeWidth(label, S, opt.minWidth || 20 * S)
  const h = opt.height || 12 * S
  const r = opt.radius || 3 * S
  c.save()
  c.fillStyle = rv.badgeBg
  R.rr(x, y, w, h, r)
  c.fill()
  c.strokeStyle = opt.strokeStyle || 'rgba(255,248,225,0.35)'
  c.lineWidth = opt.lineWidth || 0.8 * S
  R.rr(x, y, w, h, r)
  c.stroke()
  c.fillStyle = rv.badgeColor
  c.font = `bold ${(opt.fontSize || 7.2 * S)}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, x + w / 2, y + h / 2)
  c.restore()
}

function drawInlineRarityBadge(c, R, S, cx, y, rarityKey, attrKey, options) {
  if (!rarityKey) return
  const rv = rarityVisualForAttr(rarityKey, attrKey || 'metal')
  const label = rv.label || rarityKey
  const opt = options || {}
  const w = _badgeWidth(label, S, opt.minWidth || 28 * S)
  const h = opt.height || 14 * S
  const r = opt.radius || 4 * S
  const x = cx - w / 2
  c.save()
  c.fillStyle = rv.badgeBg
  R.rr(x, y, w, h, r)
  c.fill()
  c.strokeStyle = opt.strokeStyle || 'rgba(255,248,225,0.45)'
  c.lineWidth = opt.lineWidth || 0.9 * S
  R.rr(x, y, w, h, r)
  c.stroke()
  c.fillStyle = rv.badgeColor
  c.font = `bold ${(opt.fontSize || 8 * S)}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, cx, y + h / 2)
  c.restore()
}

module.exports = {
  drawCornerRarityBadge,
  drawInlineRarityBadge,
}
