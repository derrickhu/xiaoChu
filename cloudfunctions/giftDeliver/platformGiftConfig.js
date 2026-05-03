/**
 * 微信平台礼包道具映射
 *
 * 云函数独立部署，保留一份同名映射，需和客户端 js/data/platformGiftConfig.js 同步。
 */

const PLATFORM_GIFT_GOODS_MAP = {
  soulStone: 'soulStone',
  awakenStone: 'awakenStone',
  stamina: 'stamina',
  universalFragment: 'universalFragment',
}

function normalizePlatformGiftGoods(goodsList) {
  const rewards = {}
  const unknownGoods = []
  const rawGoodsList = Array.isArray(goodsList) ? goodsList : []
  rawGoodsList.forEach((item) => {
    const id = item && item.Id != null ? String(item.Id) : ''
    const num = Number(item && item.Num)
    if (!id || !Number.isFinite(num) || num <= 0) return
    const key = PLATFORM_GIFT_GOODS_MAP[id]
    if (!key) {
      unknownGoods.push({ id, num })
      return
    }
    rewards[key] = (rewards[key] || 0) + num
  })
  return { rewards, unknownGoods, rawGoodsList }
}

module.exports = {
  PLATFORM_GIFT_GOODS_MAP,
  normalizePlatformGiftGoods,
}
