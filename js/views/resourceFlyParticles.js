/**
 * 资源飞入粒子（与新手礼包 newGiftView 同款抛物线飞效）
 * 用于分享发奖、等需要「图标飞向顶栏资源位」的反馈。
 */
const V = require('./env')
const { getPetById, getPetAvatarPath } = require('../data/pets')
const { CHECKIN_HUAHUA } = require('../data/constants')

const FLY_DURATION = 30
const FLY_STAGGER = 10
/** 与 newbieGiftView 一致，与每日任务 chip 飞效错开，便于同屏感知 */
const FLY_STAGGER_GIFT = 12

function _easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

/**
 * 把任意 reward 归一化成"要飞的 icon 项"
 *
 * 支持两种格式，避免散点各自写 if-else：
 *   A) 老格式（recordShare 返回）：{ soulStone, stamina, fragment }
 *   B) 新格式（章节里程碑、关卡结算）：{ type, amount/count }
 *      · 新增 awakenStone / weaponTicket / ssrFragment 映射
 *      · weaponTicket 无独立 icon，复用 icon_universal_frag 作"领到新东西"的代表飞效
 *        （搭配后续 toast 给文字说明，玩家能意识到"有奖励到手"）
 */
function _itemsFromReward(reward) {
  const items = []
  if (!reward) return items
  // 老格式
  if (reward.soulStone) items.push({ icon: 'assets/ui/icon_soul_stone.png' })
  if (reward.stamina) items.push({ icon: 'assets/ui/icon_stamina.png' })
  if (reward.fragment && !reward.type) items.push({ icon: 'assets/ui/icon_universal_frag.png' })
  // 新格式（type 驱动）
  if (reward.type === 'soulStone')         items.push({ icon: 'assets/ui/icon_soul_stone.png' })
  if (reward.type === 'stamina')           items.push({ icon: 'assets/ui/icon_stamina.png' })
  if (reward.type === 'awakenStone')       items.push({ icon: 'assets/ui/icon_awaken_stone.png' })
  if (reward.type === 'universalFragment') items.push({ icon: 'assets/ui/icon_universal_frag.png' })
  if (reward.type === 'ssrFragment' || reward.type === 'fragment' || reward.type === 'randomFragment') items.push({ icon: 'assets/ui/frame_fragment.png' })
  if (reward.type === 'weaponTicket')      items.push({ icon: 'assets/ui/icon_universal_frag.png' })
  // SSR 法宝（章节 24★ 里程碑直接发放）：与首页底栏「法宝」Tab 同款 nav_weapon
  if (reward.type === 'ssrWeapon')         items.push({ icon: 'assets/ui/nav_weapon.png' })
  // 试炼专属法宝：新获得飞法宝图标，重复转灵石则飞灵石图标
  if (reward.type === 'weapon') {
    items.push({ icon: reward.duplicateSoulStone ? 'assets/ui/icon_soul_stone.png' : 'assets/ui/nav_weapon.png' })
  }
  return items
}

function isActive(g) {
  return !!(g && g._resourceFlyParticles && g._resourceFlyParticles.length)
}

/**
 * 与 giftConfig 发奖、签到领取 bundle 一致：按类型列出要飞的图标（每种一行飞效）
 */
function itemsFromGiftBundle(rewards) {
  const items = []
  if (!rewards) return items
  if (rewards.soulStone) items.push({ icon: 'assets/ui/icon_soul_stone.png' })
  if (rewards.stamina) items.push({ icon: 'assets/ui/icon_stamina.png' })
  if (rewards.awakenStone) items.push({ icon: 'assets/ui/icon_awaken_stone.png' })
  if (rewards.fragment) items.push({ icon: 'assets/ui/frame_fragment.png' })
  if (rewards.petId) {
    const pet = getPetById(rewards.petId)
    items.push({ icon: pet ? getPetAvatarPath({ ...pet, star: 1 }) : (CHECKIN_HUAHUA && CHECKIN_HUAHUA.specialPetIcon) || 'assets/pets/pet_f4.png' })
  }
  const fr = rewards.petDuplicateFragment || rewards.petFragment
  if (fr && fr.petId) {
    const pet = getPetById(fr.petId)
    items.push({ icon: pet ? getPetAvatarPath({ ...pet, star: 1 }) : (CHECKIN_HUAHUA && CHECKIN_HUAHUA.specialPetIcon) || 'assets/pets/pet_f4.png' })
  }
  return items
}

/**
 * @param {{ stagger?: 'default' | 'gift' }} [opts] — gift 与新手礼包/签到一致用 12 帧错开
 */
function spawnFromItemList(g, items, sx, sy, opts) {
  if (!g || !items || !items.length) return
  const { S, W } = V
  const safeTop = V.safeTop || 0
  const iconToRect = {
    'assets/ui/icon_soul_stone.png': g._soulStonePillRect,
    'assets/ui/icon_stamina.png': g._staminaPillRect,
    'assets/ui/icon_universal_frag.png': g._uniFragPillRect,
    'assets/ui/frame_fragment.png': g._uniFragPillRect,
  }
  const defaultTY = safeTop + 22 * S
  const ignorePillRects = !!(opts && opts.ignorePillRects)
  const stagger = (opts && opts.stagger === 'gift') ? FLY_STAGGER_GIFT : FLY_STAGGER
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
        age: -(i * stagger + j * 3),
      })
    }
  })
}

/**
 * 每日签到 / 通用礼包式 bundle（soulStone、stamina、宠物等）
 */
function spawnFromGiftBundle(g, rewards, sx, sy, opts) {
  const items = itemsFromGiftBundle(rewards)
  spawnFromItemList(g, items, sx, sy, Object.assign({ stagger: 'gift' }, opts))
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
  spawnFromItemList(g, items, sx, sy, opts)
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
  itemsFromGiftBundle,
  spawnFromGiftBundle,
  spawnFromItemList,
  spawnFromReward,
  draw,
  isActive,
}
