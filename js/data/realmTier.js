/**
 * 排行榜档位（Realm Tier）
 *
 * 将 17 档 cultivation realms 归并成 5 个竞技档位，用于排行榜分档展示：
 *   · 新手（qi_refine）  : 凡人 + 感气 + 炼气          (Lv  0 – 14)
 *   · 入门（core）       : 筑基 + 金丹                  (Lv 15 – 44)
 *   · 中期（spirit）     : 元婴 + 化神                  (Lv 45 – 79)
 *   · 高阶（mahayana）   : 炼虚 + 合体 + 大乘           (Lv 80 – 139)
 *   · 巅峰（ascend）     : 渡劫以上                     (Lv 140+)
 *
 * 设计原则：
 *   1. tier 只与 cultivation level 相关，便于云端一致计算；
 *   2. 数量控制在 5 档以内——太多档会把玩家切碎到无对手，太少档又失去"同境界对比"的意义；
 *   3. 返回字符串 id（与 CULT_REALMS 中某一档对齐），避免数字误用。
 *
 * 新增/调整档位时请同步 `cloudfunctions/ranking/index.js` 里同名 `_getRealmTier`，保持一致！
 */

const TIER_BOUNDS = [
  { tier: 'qi_refine', minLv:   0, maxLv:  14, name: '炼气' },
  { tier: 'core',      minLv:  15, maxLv:  44, name: '金丹' },
  { tier: 'spirit',    minLv:  45, maxLv:  79, name: '化神' },
  { tier: 'mahayana',  minLv:  80, maxLv: 139, name: '大乘' },
  { tier: 'ascend',    minLv: 140, maxLv: Infinity, name: '飞升' },
]

function getRealmTier(level) {
  const lv = level || 0
  for (const t of TIER_BOUNDS) {
    if (lv >= t.minLv && lv <= t.maxLv) return t.tier
  }
  return 'qi_refine'
}

function getTierName(tier) {
  const t = TIER_BOUNDS.find(x => x.tier === tier)
  return t ? t.name : '炼气'
}

function getTierByLevel(level) {
  const lv = level || 0
  for (const t of TIER_BOUNDS) {
    if (lv >= t.minLv && lv <= t.maxLv) return t
  }
  return TIER_BOUNDS[0]
}

module.exports = { getRealmTier, getTierName, getTierByLevel, TIER_BOUNDS }
