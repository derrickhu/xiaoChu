/**
 * 灵宠池养成数值 — 等级上限、经验曲线、升星消耗、攻击倍率
 * 调优时只改此文件，逻辑代码通过 require 读取
 */

const POOL_MAX_LV = 40
const POOL_ADV_MAX_LV = 60

const POOL_RARITY_EXP_MUL = { R: 1.0, SR: 1.3, SSR: 1.6 }

const POOL_EXP_BASE = 20
const POOL_EXP_LINEAR = 8
const POOL_EXP_POW_EXP = 1.4
const POOL_EXP_POW_COEFF = 0.5

const POOL_STAR_FRAG_COST = { 2: 8, 3: 25, 4: 40, 5: 60 }
const POOL_STAR_LV_REQ = { 2: 10, 3: 25, 4: 38, 5: 48 }
const POOL_STAR_ATK_MUL = { 1: 1.0, 2: 1.3, 3: 1.7, 4: 2.2, 5: 2.8 }
const POOL_STAR_AWAKEN_COST = { 4: 3, 5: 8 }
const POOL_STAR_SS_COST = { 2: 0, 3: 0, 4: 0, 5: 0 }
const POOL_STAR_LV_CAP = { 1: 40, 2: 40, 3: 40, 4: 50, 5: 60 }

const POOL_FRAGMENT_TO_EXP = 40
const POOL_ENTRY_LEVEL = 1
const POOL_ENTRY_FRAGMENTS = 0
const POOL_R_LV_BONUS_RATE = 0.8

// ===== 灵宠返还培养（重置） =====
// 业界对标：原神返还药水 / 公主连结装备分解 / 命运 FGO 圣杯转移
// 核心思路：用觉醒石做"闸门"（扣稀缺资源≈自然冷却），返还比例做心理税
//   · 专属碎片永远 100% 返还（稀缺 + 返给本宠继续攒）
//   · 其他资源分"基础档 / 广告档"两档，看广告加 20pp/10pp
//   · 闸门消耗按目标星级递增，越高星越贵（和升星本身的"破星"成本呼应）
const POOL_RESET_REFUND_BASE = {
  soulStonePct:     0.70,  // 灵石（累积升级投入）返 70%
  selfFragPct:      1.00,  // 专属碎片（升星已消耗）100%，加回本宠 fragments
  universalFragPct: 0.90,  // 万能碎片（已用作顶替升星）90%
  awakenStonePct:   0.90,  // 觉醒石（升星已消耗）90%
}
const POOL_RESET_REFUND_AD = {
  soulStonePct:     0.90,  // +20pp
  selfFragPct:      1.00,
  universalFragPct: 1.00,  // +10pp
  awakenStonePct:   1.00,  // +10pp
}
// 返还闸门：按当前星级扣除觉醒石，低星几乎免费、★5 要 6 颗（≈升 ★4 成本）
const POOL_RESET_GATE_COST = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 6 }
// 重置后冷却，防误操作连按
const POOL_RESET_COOLDOWN_MS = 10 * 60 * 1000
// 功能解锁：通关第 N 章后才出现入口（和觉醒石产出时机同步，避免新手期被骚扰）
const POOL_RESET_UNLOCK_CHAPTER = 4

module.exports = {
  POOL_MAX_LV,
  POOL_ADV_MAX_LV,
  POOL_RARITY_EXP_MUL,
  POOL_EXP_BASE,
  POOL_EXP_LINEAR,
  POOL_EXP_POW_EXP,
  POOL_EXP_POW_COEFF,
  POOL_STAR_FRAG_COST,
  POOL_STAR_LV_REQ,
  POOL_STAR_ATK_MUL,
  POOL_STAR_AWAKEN_COST,
  POOL_STAR_SS_COST,
  POOL_STAR_LV_CAP,
  POOL_FRAGMENT_TO_EXP,
  POOL_ENTRY_LEVEL,
  POOL_ENTRY_FRAGMENTS,
  POOL_R_LV_BONUS_RATE,
  POOL_RESET_REFUND_BASE,
  POOL_RESET_REFUND_AD,
  POOL_RESET_GATE_COST,
  POOL_RESET_COOLDOWN_MS,
  POOL_RESET_UNLOCK_CHAPTER,
}
