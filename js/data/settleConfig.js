/**
 * 爬塔结算奖励配置（所有数值集中在此，方便调整）
 * 逻辑代码只读此配置，不硬编码任何结算数值
 */

const SETTLE_CFG = {
  // ── 碎片奖励 ──
  fragment: {
    perFloor:    1,     // 每层基础碎片
    bossBonus:   3,     // 每过 Boss 层额外碎片（每 10 层）
    eliteBonus:  1,     // 每过精英层额外碎片（第 5 层固定 + 随机）
    clearBonus:  20,    // 通关额外碎片
    failRatio:   0.6,   // 失败时碎片打折比例
  },

  // ── 修炼经验 ──
  cultExp: {
    perFloor:    3,     // 每层基础经验
    clearBonus:  500,   // 通关额外经验
    failRatio:   0.6,   // 失败折扣
  },

  // ── 宠物经验池 ──
  petExp: {
    combatRatio: 0.3,   // 战斗经验折算比例（消除+连击+击杀）
    floorBonus:  2,     // 每层额外宠物经验
    clearBonus:  200,   // 通关额外宠物经验
  },

  // ── 碎片分配策略 ──
  distribute: {
    mode: 'team',       // 'team' = 分配给本局队伍宠物 | 'bank' = 统一进碎片银行
    evenSplit: true,     // true = 均分 | false = 随机权重分配
  },
}

module.exports = { SETTLE_CFG }
