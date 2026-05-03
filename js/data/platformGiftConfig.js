/**
 * 微信平台礼包道具映射
 *
 * 第一阶段只接入 4 类明确资源，暂不接普通 fragment，避免和万能碎片混淆。
 */

const PLATFORM_GIFT_REWARD_LABELS = {
  soulStone: '灵石',
  awakenStone: '觉醒石',
  stamina: '体力',
  universalFragment: '万能碎片',
}

const PLATFORM_GIFT_GOODS_MAP = {
  soulStone: 'soulStone',
  awakenStone: 'awakenStone',
  stamina: 'stamina',
  universalFragment: 'universalFragment',
}

const PLATFORM_GIFT_SUPPORTED_REWARDS = Object.keys(PLATFORM_GIFT_REWARD_LABELS)

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
  PLATFORM_GIFT_REWARD_LABELS,
  PLATFORM_GIFT_GOODS_MAP,
  PLATFORM_GIFT_SUPPORTED_REWARDS,
  normalizePlatformGiftGoods,
}
