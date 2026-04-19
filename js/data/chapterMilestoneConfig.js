/**
 * 章节星级里程碑配置 — 12 章 × 3 档（8★ / 16★ / 24★）
 *
 * 设计原则（见 "章节大奖与牵引升级" plan B/E 节）：
 *   1. **三档阶梯**：8★（半章） / 16★（多半章） / 24★（满章），把"打完一章"拆成三个小目标，
 *      让玩家每拿到一个里程碑都能拿到阶段性大奖。
 *   2. **资源 + 稀缺物结合**：灵石（通用货币）+ 觉醒石（升星稀缺物）+ SSR 碎片 +
 *      万能碎片（抗卡碎片）+ SSR 法宝保底券（24★ 独占，选一件 SSR）。
 *   3. **稀缺资源集中在高档位**：万能碎片只出现在 16/24，保底券只出现在 24；
 *      新手前 3 章给更多"直接可用"的灵石/碎片，高章节加重长期养成资源。
 *   4. **总万能碎片 60 片**（12×(0+2+3) = 60，v2 Day1 经济收紧后从 108 → 60，避免新手首日连薅前 3 章 24★ 就占 37% 总池）。
 *
 * 奖励条目 type：
 *   - 'soulStone'         灵石
 *   - 'awakenStone'       觉醒石
 *   - 'universalFragment' 万能碎片
 *   - 'ssrFragment'       SSR 宠物碎片（按章节推荐 SSR petId 发放，池里没有则写 fragmentBank）
 *   - 'ssrWeapon'         SSR 法宝（直接随机发放一件未拥有的 SSR 法宝；全拥有 → 万能碎片兜底）
 *                         · v1 曾做 weaponTicket + 兑换页，玩家反馈"券没用/找不到兑换页"，直接改为现货发放
 *                         · 保留 weaponTicket 在旧存档，只做历史兼容，不再生成新券
 *
 * ssrPet 字段：章节"代表 SSR 宠物 id"，决定 ssrFragment 发到哪只身上。
 */

// 章节对应的"代表 SSR 宠物"（非 RESERVED SSR，玩家能真正通过主线获得并使用）
// 非 RESERVED SSR 只有 5 只：m10 金凰 / s10 水龙 / f4 火麟 / f10 朱雀 / e10 后土神兽
// 12 章轮换分配，大致按章节主属性：
//   ch1/6/11: 火系（f4/f10 交替）
//   ch2/7/12: 土系（e10）
//   ch3/8:    金系（m10）
//   ch4/9:    水系（s10）
//   ch5/10:   火系（f10）
const CHAPTER_SSR_PETS = {
  1:  'f4',   // 灵山试炼 · 炎狱火麟（新手 SSR）
  2:  'e10',  // 幽冥秘境 · 后土神兽
  3:  'm10',  // 天劫雷域 · 九天金凰
  4:  's10',  // 仙灵古域 · 沧海龙神
  5:  'f10',  // 万妖禁地 · 朱雀神火
  6:  'f4',   // 苍穹裂谷
  7:  'e10',  // 精英试炼
  8:  'm10',  // 九幽深渊
  9:  's10',  // 太古战场
  10: 'f10',  // 天罡圣域
  11: 'f4',   // 混沌秘界
  12: 'e10',  // 终焉之地
}

/**
 * 12 章 × 3 档奖励池
 *
 * 数值曲线思路（与 CHAPTER_CLEAR_REWARDS 互补）：
 *   - 8★：新手阶段，偏向即时战力（灵石/觉醒石/SSR 碎片），拉动"进入灵宠养成"
 *   - 16★：中段，引入"万能碎片 ×2"稀缺感（v2 由 3 → 2）
 *   - 24★（全 3★）：章节终极大奖，引入"SSR 法宝直接发放"+ 万能碎片 ×3（v2 由 5 → 3）
 *
 * 数值自检（对齐 plan "Day1 经济温和收紧" 节）：
 *   - 万能碎片总池：(0+2+3) × 12 = 60 片 + 新手礼包 5 ≈ 65，对齐 auditChapterMilestones LIMITS = 60
 *   - SSR 法宝发放：24★ × 12 = 12 件（SSR 法宝总 11 件，第 12 章后走兜底 60 万能碎片）
 *     · 保证玩家沿主线通关就能集齐全部 SSR 法宝，不再依赖运气
 *   - 灵石曲线（8/16/24）：
 *       · 前 3 章：v2.2 "曲线平滑方案 A"，再降 -50/-100/-100（150/300/500 → 100/200/400 for ch1），每章 -250 灵石
 *         · 目标：Day1 里程碑总额 3450 → 2700（-750），削 Day1 爆点
 *         · 后 9 章维持 v2.1 曲线：(8/16/24 各 +50/+50/+100/章 阶梯)，中后段玩家节奏不受影响
 *       · 新手"一章大奖"仍在心理阈值之上（前 3 章 24★ 累计 400+500+600 = 1500 灵石），不丢失仪式感
 */
const CHAPTER_MILESTONES = {
  1: {
    8:  [{ type: 'soulStone', amount: 100 }, { type: 'awakenStone', amount: 3 }, { type: 'ssrFragment', count: 3 }],
    16: [{ type: 'soulStone', amount: 200 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 5 }, { type: 'awakenStone', amount: 5 }],
    24: [{ type: 'soulStone', amount: 400 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  2: {
    8:  [{ type: 'soulStone', amount: 150 }, { type: 'awakenStone', amount: 3 }, { type: 'ssrFragment', count: 3 }],
    16: [{ type: 'soulStone', amount: 250 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 5 }, { type: 'awakenStone', amount: 5 }],
    24: [{ type: 'soulStone', amount: 500 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  3: {
    8:  [{ type: 'soulStone', amount: 200 }, { type: 'awakenStone', amount: 4 }, { type: 'ssrFragment', count: 3 }],
    16: [{ type: 'soulStone', amount: 300 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 5 }, { type: 'awakenStone', amount: 6 }],
    24: [{ type: 'soulStone', amount: 600 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  4: {
    // v2.2 "曲线平滑方案 A"：Day2 常卡在第 4 章末，里程碑爆发再削 -250（300/500/800 → 200/350/600）
    8:  [{ type: 'soulStone', amount: 200 }, { type: 'awakenStone', amount: 4 }, { type: 'ssrFragment', count: 4 }],
    16: [{ type: 'soulStone', amount: 350 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 6 }, { type: 'awakenStone', amount: 7 }],
    24: [{ type: 'soulStone', amount: 600 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  5: {
    8:  [{ type: 'soulStone', amount: 350 }, { type: 'awakenStone', amount: 5 }, { type: 'ssrFragment', count: 4 }],
    16: [{ type: 'soulStone', amount: 600 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 6 }, { type: 'awakenStone', amount: 8 }],
    24: [{ type: 'soulStone', amount: 900 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  6: {
    8:  [{ type: 'soulStone', amount: 400 }, { type: 'awakenStone', amount: 5 }, { type: 'ssrFragment', count: 5 }],
    16: [{ type: 'soulStone', amount: 700 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 7 }, { type: 'awakenStone', amount: 9 }],
    24: [{ type: 'soulStone', amount: 1000 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  7: {
    8:  [{ type: 'soulStone', amount: 450 }, { type: 'awakenStone', amount: 6 }, { type: 'ssrFragment', count: 5 }],
    16: [{ type: 'soulStone', amount: 800 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 7 }, { type: 'awakenStone', amount: 10 }],
    24: [{ type: 'soulStone', amount: 1100 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  8: {
    8:  [{ type: 'soulStone', amount: 500 }, { type: 'awakenStone', amount: 6 }, { type: 'ssrFragment', count: 6 }],
    16: [{ type: 'soulStone', amount: 900 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 8 }, { type: 'awakenStone', amount: 11 }],
    24: [{ type: 'soulStone', amount: 1200 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  9: {
    8:  [{ type: 'soulStone', amount: 550 }, { type: 'awakenStone', amount: 7 }, { type: 'ssrFragment', count: 6 }],
    16: [{ type: 'soulStone', amount: 1000 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 8 }, { type: 'awakenStone', amount: 12 }],
    24: [{ type: 'soulStone', amount: 1300 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  10: {
    8:  [{ type: 'soulStone', amount: 600 }, { type: 'awakenStone', amount: 8 }, { type: 'ssrFragment', count: 7 }],
    16: [{ type: 'soulStone', amount: 1100 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 9 }, { type: 'awakenStone', amount: 13 }],
    24: [{ type: 'soulStone', amount: 1400 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  11: {
    8:  [{ type: 'soulStone', amount: 650 }, { type: 'awakenStone', amount: 9 }, { type: 'ssrFragment', count: 7 }],
    16: [{ type: 'soulStone', amount: 1200 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 9 }, { type: 'awakenStone', amount: 14 }],
    24: [{ type: 'soulStone', amount: 1500 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
  12: {
    8:  [{ type: 'soulStone', amount: 750 }, { type: 'awakenStone', amount: 10 }, { type: 'ssrFragment', count: 8 }],
    16: [{ type: 'soulStone', amount: 1300 }, { type: 'universalFragment', count: 2 }, { type: 'ssrFragment', count: 10 }, { type: 'awakenStone', amount: 15 }],
    24: [{ type: 'soulStone', amount: 1700 }, { type: 'universalFragment', count: 3 }, { type: 'ssrWeapon' }],
  },
}

/** 三档星数阈值（章节总 24★ = 8 关 × 3★） */
const MILESTONE_TIERS = [8, 16, 24]

/**
 * 获取指定章节某档的奖励条目数组（浅拷贝，外部可以再做富化如 petId）
 * 找不到时返回 []
 */
function getChapterMilestoneReward(chapterId, tier) {
  const cfg = CHAPTER_MILESTONES[chapterId]
  if (!cfg || !cfg[tier]) return []
  return cfg[tier].map(r => ({ ...r }))
}

/** 章节代表 SSR 宠物 id（用于 ssrFragment 发放） */
function getChapterSsrPetId(chapterId) {
  return CHAPTER_SSR_PETS[chapterId] || 'f4'
}

/**
 * 输入当前章节星数，返回"下一档里程碑"信息
 * 已全部领完返回 null
 */
function getNextMilestone(currentStars) {
  for (const tier of MILESTONE_TIERS) {
    if (currentStars < tier) return { tier, remainingStars: tier - currentStars }
  }
  return null
}

module.exports = {
  CHAPTER_MILESTONES,
  CHAPTER_SSR_PETS,
  MILESTONE_TIERS,
  getChapterMilestoneReward,
  getChapterSsrPetId,
  getNextMilestone,
}
