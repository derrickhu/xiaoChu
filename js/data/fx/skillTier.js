/**
 * 技能档位配置（tier）
 *
 * 用途：
 *   按"小招/普通/大招"区分视觉表现的强度（持续时长、震屏幅度、闪屏 alpha、顿帧帧数）。
 *   让玩家一眼看出"这是普通技能 / 这是大招"，小招不吵、大招够爽。
 *
 * 设计：
 *   - 参数值基于业界经验值（见 plan）
 *   - small ≈ 0.7s，normal ≈ 1.0s，ult ≈ 1.4s（以 60fps 换算）
 *   - flashDur 专指技能名+描述的快闪横幅停留时间；让玩家看清"放了什么、做了什么"
 *   - getSkillTier 基于宠物星级判档：★3+ 归 ult，★2 归 normal，★1 归 small
 */

const TIER = Object.freeze({
  small: 'small',
  normal: 'normal',
  ult: 'ult',
})

const TIER_FX = Object.freeze({
  small: {
    flashDur: 42,
    waveDur: 22,
    shakeT: 4,
    shakeI: 3,
    flashAlpha: 0.25,
    hitStop: 3,
    comboFlash: 4,
  },
  normal: {
    flashDur: 60,
    waveDur: 28,
    shakeT: 8,
    shakeI: 6,
    flashAlpha: 0.45,
    hitStop: 5,
    comboFlash: 6,
  },
  ult: {
    flashDur: 84,
    waveDur: 40,
    shakeT: 14,
    shakeI: 10,
    flashAlpha: 0.70,
    hitStop: 9,
    comboFlash: 10,
  },
})

// 判断宠物技能档位：★3+ 归 ult，★2 归 normal，★1 归 small
// sk 目前未用到，保留参数以便将来按 skill.tier 字段强制覆写
function getSkillTier(pet, _sk) {
  const star = (pet && pet.star) || 1
  if (star >= 3) return TIER.ult
  if (star >= 2) return TIER.normal
  return TIER.small
}

function getTierFx(tier) {
  return TIER_FX[tier] || TIER_FX.normal
}

module.exports = { TIER, TIER_FX, getSkillTier, getTierFx }
