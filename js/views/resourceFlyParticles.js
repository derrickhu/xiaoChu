/**
 * 资源飞入粒子（与新手礼包 newGiftView 同款抛物线飞效）
 * 用于分享发奖、等需要「图标飞向顶栏资源位」的反馈。
 */
const V = require('./env')

const FLY_DURATION = 30
const FLY_STAGGER = 10

function _easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function _itemsFromReward(reward) {
  const items = []
  if (!reward) return items
  if (reward.soulStone) items.push({ icon: 'assets/ui/icon_soul_stone.png' })
  if (reward.stamina) items.push({ icon: 'assets/ui/icon_stamina.png' })
  if (reward.fragment) items.push({ icon: 'assets/ui/icon_universal_frag.png' })
  return items
}

function isActive(g) {
  return !!(g && g._resourceFlyParticles && g._resourceFlyParticles.length)
}

/**
 * @param {object} g
 * @param {{ stamina?: number, soulStone?: number, fragment?: number }} reward — recordShare 返回值
 * @param {number} sx起点 X（屏幕坐标）
 * @param {number} sy 起点 Y
 * @param {{ ignorePillRects?: boolean }} [opts] — 分享等非首页场景顶栏矩形可能过期，传 true 只用默认落点
 */
function spawnFromReward(g, reward, sx, sy, opts) {
  if (!g || !reward) return
  const items = _itemsFromReward(reward)
  if (!items.length) return
  const { S, W } = V
  const safeTop = V.safeTop || 0
  const iconToRect = {
    'assets/ui/icon_soul_stone.png': g._soulStonePillRect,
    'assets/ui/icon_stamina.png': g._staminaPillRect,
    'assets/ui/icon_universal_frag.png': g._uniFragPillRect,
  }
  const defaultTY = safeTop + 22 * S
  const ignorePillRects = !!(opts && opts.ignorePillRects)
  if (!g._resourceFlyParticles) g._resourceFlyParticles = []
  items.forEach((item, i) => {
    const rect = ignorePillRects ? null : iconToRect[item.icon]
    const tx0 = rect ? rect[0] + rect[2] / 2 : W * (0.28 + i * 0.22)
    const ty0 = rect ? rect[1] + rect[3] / 2 : defaultTY
    for (let j = 0; j < 3; j++) {
      g._resourceFlyParticles.push({
        icon: item.icon,
        sx: sx + (j - 1) * 12 * S,
        sy,
        tx: tx0 + (j - 1) * 8 * S,
        ty: ty0,
        age: -(i * FLY_STAGGER + j * 3),
      })
    }
  })
}

function draw(g) {
  if (!isActive(g)) return
  const { ctx: c, R, S } = V
  g._resourceFlyParticles.forEach((fp) => {
    fp.age++
    const p = Math.min(fp.age / FLY_DURATION, 1)
    if (p <= 0) return
    const ep = _easeOutCubic(p)
    const cx = fp.sx + (fp.tx - fp.sx) * ep
    const cy = fp.sy + (fp.ty - fp.sy) * ep - Math.sin(ep * Math.PI) * 40 * S
    const alpha = p < 0.8 ? 1 : (1 - p) / 0.2
    const sz = (20 + 10 * Math.sin(p * Math.PI)) * S

    c.save()
    c.globalAlpha = alpha
    const img = R.getImg(fp.icon)
    if (img && img.width > 0) {
      c.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz)
    }
    c.beginPath()
    c.arc(cx, cy, sz * 0.6, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,215,0,${alpha * 0.3})`
    c.fill()
    c.restore()
  })
  g._resourceFlyParticles = g._resourceFlyParticles.filter((fp) => fp.age < FLY_DURATION)
}

module.exports = {
  FLY_DURATION,
  spawnFromReward,
  draw,
  isActive,
}
