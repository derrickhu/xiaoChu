/**
 * 关卡奖励预览 — stageInfoView 和 stageResultView 共用
 * 解决战前展示与实际结算不一致的问题
 */
const { STAR_REWARDS, STAGE_SETTLE } = require('../data/economyConfig')

const RATING_MUL = STAGE_SETTLE.ratingMul

/**
 * 预览首通奖励（解析宠物是否已拥有 → 碎片）
 * 与 stageManager.resolveReward 保持同一逻辑，但无副作用
 */
function previewFirstClear(g, stage) {
  if (!stage.rewards || !stage.rewards.firstClear) return []
  return stage.rewards.firstClear.map(r => {
    if (r.type === 'pet') {
      const inPool = g.storage.petPool.find(p => p.id === r.petId)
      if (inPool) return { type: 'fragment', petId: r.petId, count: r.fragCount || 5, wasPet: true }
      return { type: 'pet', petId: r.petId }
    }
    if (r.type === 'randomPet') {
      return { type: 'randomPet', chapter: r.chapter, order: r.order, difficulty: r.difficulty }
    }
    if (r.type === 'randomWeapon') {
      return { type: 'randomWeapon', chapter: r.chapter, order: r.order, difficulty: r.difficulty }
    }
    return { ...r }
  })
}

/**
 * 预览周回奖励（含评价倍率范围）
 * 返回 B(1x) 和 S(2x) 的范围，让 UI 展示 "基础~最大"
 */
function previewRepeat(stage) {
  const rep = stage.rewards.repeatClear
  const frag = rep.fragments
  return {
    fragments: {
      min: frag.min,
      max: Math.ceil(frag.max * RATING_MUL.S),
    },
    exp: {
      base: rep.exp,
      max: Math.ceil(rep.exp * RATING_MUL.S),
    },
    soulStone: {
      base: rep.soulStone,
      max: Math.ceil(rep.soulStone * RATING_MUL.S),
    },
  }
}

/**
 * 预览星级首次达成奖励总额
 * 返回 { soulStone, fragment, awakenStone } — 未领取星级的累计
 */
function previewStarBonus(g, stage) {
  const chIdx = stage.order - 1
  const starCfg = STAR_REWARDS[stage.chapter] && STAR_REWARDS[stage.chapter][chIdx]
  if (!starCfg) return { soulStone: 0, fragment: 0, awakenStone: 0 }

  const claimed = g.storage.getStageStarsClaimed(stage.id)
  let soulStone = 0, fragment = 0, awakenStone = 0

  if (!claimed[1]) {
    soulStone += starCfg.star2.soulStone || 0
    fragment += starCfg.star2.fragment || 0
    awakenStone += starCfg.star2.awakenStone || 0
  }
  if (!claimed[2]) {
    soulStone += starCfg.star3.soulStone || 0
    fragment += starCfg.star3.fragment || 0
    awakenStone += starCfg.star3.awakenStone || 0
  }
  return { soulStone, fragment, awakenStone }
}

/**
 * 完整的奖励预览汇总（用于 stageInfoView 展示）
 */
function getRewardPreview(g, stage) {
  const isFirstClear = !g.storage.isStageCleared(stage.id)
  const firstClear = isFirstClear ? previewFirstClear(g, stage) : []
  const repeat = previewRepeat(stage)
  const starBonus = previewStarBonus(g, stage)

  return { isFirstClear, firstClear, repeat, starBonus }
}

module.exports = {
  previewFirstClear,
  previewRepeat,
  previewStarBonus,
  getRewardPreview,
  RATING_MUL,
}
