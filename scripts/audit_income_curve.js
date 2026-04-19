/**
 * 灵石供给曲线推演 —— Day1 / Day3 / Day7 / Day14 / Day30 对比
 *
 * 回答两个问题：
 *   1. Day1 是"爆点"还是"悬崖"？（Day1 / 日均 的倍率应在 3~4x 内才合理）
 *   2. Day2~Day7 是否骤降到玩家"突然没钱可花"？
 *
 * 模型假设（保守口径，贴近"正常玩家"而非"肝王"）：
 *   · Day1：新手礼包 + 前 3 章所有一次性（推到 4-4）+ 前 3 章里程碑全档
 *   · Day2~7：每天推进 ~4 关（新章节里程碑 8★，偶尔 16★），日常全量（签到/日任/塔/repeat/挂机）
 *   · Day8~14：推进放缓（每 2~3 天推 1 章），日常全量稳态
 *   · Day15~30：章节已通 8~10 章，几乎无推进收入，纯日常
 *
 * 运行：
 *   node scripts/audit_income_curve.js
 */
/* eslint-disable no-console */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')
function req(p) { return require(path.join(ROOT, p)) }

// wx mock，stages.js 依赖
const memStore = {}
global.wx = {
  getStorageSync: (k) => memStore[k] || '',
  setStorageSync: (k, v) => { memStore[k] = v },
  removeStorageSync: (k) => { delete memStore[k] },
  getSystemInfoSync: () => ({ pixelRatio: 2, platform: 'devtools', windowWidth: 375, windowHeight: 812, safeArea: { top: 0, bottom: 812 } }),
  getMenuButtonBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
}
global.tt = global.wx
global.GameGlobal = {}

const { CHAPTER_MILESTONES, MILESTONE_TIERS } = req('js/data/chapterMilestoneConfig')
const {
  CHAPTER_CLEAR_REWARDS,
  LOGIN_REWARDS,
  CONSECUTIVE_LOGIN_REWARDS,
  DAILY_TASKS,
  DAILY_ALL_COMPLETE_BONUS,
  SHARE_FIRST_EVER_BONUS,
  IDLE_CFG,
  ECONOMY_FRAMEWORK,
  TOWER_SETTLE,
  AD_REWARDS_NUMS,
} = req('js/data/balance/economy')
const {
  NEWBIE_GIFT_REWARDS,
  FIRST_CLEAR_SOULSTONE_BONUS,
  STAGE_MECHANIC_FOCUS,
} = req('js/data/constants')
const {
  STAGE_REWARDS,
  STAR_REWARDS,
  getDailyTaskScale,
} = req('js/data/economyConfig')
const { getStageById } = req('js/data/stages')
const SHARE_CONFIG = req('js/data/shareConfig')

// ===== 工具：从 stages.js 真实数据读首通灵石 =====
function _firstClearSoul(ch, ord) {
  const stage = getStageById(`stage_${ch}_${ord}`)
  if (!stage || !stage.rewards || !stage.rewards.firstClear) return 0
  let sum = 0
  for (const r of stage.rewards.firstClear) if (r.type === 'soulStone') sum += r.amount || 0
  return sum
}
function _repeatSoul(ch, ord) {
  const idx = ord - 1
  const cfg = STAGE_REWARDS[ch] && STAGE_REWARDS[ch].normal
  return (cfg && cfg.soulStone.repeat[idx]) || 0
}
function _starSoul(ch, ord) {
  const sr = (STAR_REWARDS[ch] && STAR_REWARDS[ch][ord - 1]) || null
  if (!sr) return 0
  return ((sr.star2 && sr.star2.soulStone) || 0) + ((sr.star3 && sr.star3.soulStone) || 0)
}
function _chapterMilestoneSoul(chapterId) {
  const tiers = CHAPTER_MILESTONES[chapterId] || {}
  let sum = 0
  for (const t of MILESTONE_TIERS) {
    for (const r of (tiers[t] || [])) if (r.type === 'soulStone') sum += r.amount || 0
  }
  return sum
}

// ===== 各来源每日产出（按章节） =====

// 签到：7 天循环。day 从 1 开始
function signInAt(day) {
  const idx = ((day - 1) % LOGIN_REWARDS.length)
  const main = (LOGIN_REWARDS[idx] && LOGIN_REWARDS[idx].rewards) || {}
  const cIdx = ((day - 1) % CONSECUTIVE_LOGIN_REWARDS.length)
  const consec = (CONSECUTIVE_LOGIN_REWARDS[cIdx] && CONSECUTIVE_LOGIN_REWARDS[cIdx].rewards) || {}
  const base = (main.soulStone || 0) + (consec.soulStone || 0)
  const adDouble = (main.soulStone || 0) * Math.max(0, (AD_REWARDS_NUMS.signMultiplier || 2) - 1)
  return base + adDouble
}

// 日任：按章节缩放 + 全清奖 + 全清广告翻倍
function dailyTaskAt(chapter) {
  const scale = getDailyTaskScale(chapter)
  let taskSum = 0
  for (const t of DAILY_TASKS) taskSum += Math.round(((t.reward && t.reward.soulStone) || 0) * scale)
  const allBonus = Math.round((DAILY_ALL_COMPLETE_BONUS.soulStone || 0) * scale)
  const adDouble = allBonus * Math.max(0, (AD_REWARDS_NUMS.dailyTaskMultiplier || 2) - 1)
  return taskSum + allBonus + adDouble
}

// 挂机（idle）：按宠等级近似 25 + 16h 两次收
//   简化：单日 24h / 挂机 16h / 3 只宠，每只独立
function idleAt(petLv) {
  const hours = 16
  const perPet = Math.floor(hours * IDLE_CFG.soulStonePerHour * (1 + petLv * IDLE_CFG.petLvExpFactor))
  return perPet * IDLE_CFG.maxSlots
}

// 塔：按 TOWER_SETTLE.soulStone 公式（floorBase + floorGrowth 累加 + combatRatio × combatBase + clearBonus）
//   平均 15 层（AUDIT_DEFAULTS.avgFloor），每日 freeRuns(3) + adExtraRuns(2) = 5 次
function towerAt(chapter) {
  const avgFloor = 15
  const ts = TOWER_SETTLE.soulStone
  const per = Math.floor(avgFloor * ts.floorBase + ts.floorGrowth * avgFloor * (avgFloor + 1) / 2)
            + Math.floor(200 * ts.combatRatio)
            + (ts.clearBonus || 0)
  return per * 5
}

// 关卡 repeat：每天 100 体力 = 10 次刷关。按玩家当前章节中段的平均 repeat 灵石
function stageRepeatAt(chapter) {
  const cfg = STAGE_REWARDS[chapter] && STAGE_REWARDS[chapter].normal
  if (!cfg) return 0
  const arr = cfg.soulStone.repeat
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.round(avg * 10)
}

// ===== 一次性：Day1 特有 =====
function oneShotDay1() {
  // 新手礼包
  const gift = NEWBIE_GIFT_REWARDS.soulStone || 0
  // 首通固定加成：前 3 章能触发的四档
  const firstClearBonus = Object.values(FIRST_CLEAR_SOULSTONE_BONUS).reduce((a, b) => a + b, 0)
  // 分享首次永久 + firstPet + activeStageShare
  const firstEver = SHARE_FIRST_EVER_BONUS.soulStone || 0
  const firstPet = ((SHARE_CONFIG.SHARE_SCENES.firstPet || {}).reward || {}).soulStone || 0
  const active = ((SHARE_CONFIG.SHARE_SCENES.activeStageShare || {}).reward || {}).soulStone || 0
  // 技巧挑战奖（第 1 章）
  let challenge = 0
  for (const key of Object.keys(STAGE_MECHANIC_FOCUS)) {
    const c = STAGE_MECHANIC_FOCUS[key]
    if (c.challenge && c.challenge.rewardSoulStone) challenge += c.challenge.rewardSoulStone
  }
  return gift + firstClearBonus + firstEver + firstPet + active + challenge
}

// ===== 推进期：某一天推进 X 关（按章节累加首通 + star）=====
//   progressPath[day] = [ {ch, ords:[...]}, ... ]
function progressIncome(stages) {
  let sum = 0
  for (const { ch, ords } of stages) {
    for (const ord of ords) {
      sum += _firstClearSoul(ch, ord)
      sum += _starSoul(ch, ord)  // 假设首通即 S（全星）
    }
  }
  return sum
}

// ===== 推进到章末触发的章节 clear 宝箱 + 里程碑 =====
function chapterClearBonus(chapter) {
  const box = (CHAPTER_CLEAR_REWARDS[chapter] && CHAPTER_CLEAR_REWARDS[chapter].soulStone) || 0
  const ms = _chapterMilestoneSoul(chapter)
  return box + ms
}

// ===== 单日总产出 =====
//   推进路径（简化）：
//     Day1：推到 4-4（前 3 章满通 + 4-1~4-4，章节 clear 宝箱+里程碑 ch1/2/3）
//     Day2：推 4-5~4-8 + 章节 clear 宝箱+里程碑 ch4
//     Day3：推 5-1~5-4
//     Day4：推 5-5~5-8 + clear ch5
//     Day5：推 6-1~6-4
//     Day6：推 6-5~6-8 + clear ch6
//     Day7：推 7-1~7-4
//     Day8~14：每 2 天推 1 章（7~10 章）
//     Day15+：主线基本通关，纯日常
function simulateDay(day) {
  const result = { day, sources: {} }
  // 确定当前推进的章节（影响日常缩放）
  let currentCh = 1
  let progress = []
  let chaptersCleared = []
  let oneShot = 0
  let firstClearFixedBonus = 0

  if (day === 1) {
    // 前 3 章全通 + 4-1~4-4
    for (let ch = 1; ch <= 3; ch++) {
      const ords = [1,2,3,4,5,6,7,8]
      progress.push({ ch, ords })
      chaptersCleared.push(ch)
    }
    progress.push({ ch: 4, ords: [1,2,3,4] })
    oneShot = oneShotDay1()
    firstClearFixedBonus = Object.values(FIRST_CLEAR_SOULSTONE_BONUS).reduce((a, b) => a + b, 0)
    // oneShot 已含 firstClearFixedBonus，避免重复
    currentCh = 4
  } else if (day === 2) {
    progress.push({ ch: 4, ords: [5,6,7,8] })
    chaptersCleared.push(4)
    currentCh = 4
  } else if (day === 3) {
    progress.push({ ch: 5, ords: [1,2,3,4] })
    currentCh = 5
  } else if (day === 4) {
    progress.push({ ch: 5, ords: [5,6,7,8] })
    chaptersCleared.push(5)
    currentCh = 5
  } else if (day === 5) {
    progress.push({ ch: 6, ords: [1,2,3,4] })
    currentCh = 6
  } else if (day === 6) {
    progress.push({ ch: 6, ords: [5,6,7,8] })
    chaptersCleared.push(6)
    currentCh = 6
  } else if (day === 7) {
    progress.push({ ch: 7, ords: [1,2,3,4] })
    currentCh = 7
  } else if (day >= 8 && day <= 14) {
    // 每 2 天推 1 章
    const chToClear = 7 + Math.floor((day - 7) / 2)
    const ordsOffset = ((day - 7) % 2 === 1) ? [1,2,3,4] : [5,6,7,8]
    if (chToClear <= 12) {
      progress.push({ ch: chToClear, ords: ordsOffset })
      if (ordsOffset[0] === 5) chaptersCleared.push(chToClear)
      currentCh = chToClear
    } else {
      currentCh = 12
    }
  } else {
    // Day15+：主线已通关，当前章节按 12 章计
    currentCh = 12
  }

  result.sources.progress = progressIncome(progress)
  result.sources.chapterBox = chaptersCleared.reduce((a, ch) => a + ((CHAPTER_CLEAR_REWARDS[ch] && CHAPTER_CLEAR_REWARDS[ch].soulStone) || 0), 0)
  result.sources.milestone = chaptersCleared.reduce((a, ch) => a + _chapterMilestoneSoul(ch), 0)
  result.sources.oneShot = oneShot
  result.sources.signIn = signInAt(day)
  result.sources.dailyTask = dailyTaskAt(currentCh)
  result.sources.repeat = stageRepeatAt(currentCh)
  result.sources.idle = idleAt(Math.min(25 + day, 40))
  result.sources.tower = towerAt(currentCh)
  result.total = Object.values(result.sources).reduce((a, b) => a + b, 0)
  result.currentCh = currentCh
  return result
}

function main() {
  const days = [1, 2, 3, 5, 7, 10, 14, 21, 30]
  console.log('===== 灵石供给 30 天曲线推演 =====\n')
  console.log('day  ch  推进  里程碑  宝箱  一次性  签到  日任  repeat  挂机  塔   合计')
  console.log('-'.repeat(85))
  const daily = []
  for (const d of days) {
    const r = simulateDay(d)
    const s = r.sources
    console.log(
      String(d).padEnd(4),
      String(r.currentCh).padEnd(3),
      String(s.progress).padStart(5),
      String(s.milestone).padStart(6),
      String(s.chapterBox).padStart(5),
      String(s.oneShot).padStart(6),
      String(s.signIn).padStart(5),
      String(s.dailyTask).padStart(5),
      String(s.repeat).padStart(6),
      String(s.idle).padStart(5),
      String(s.tower).padStart(4),
      String(r.total).padStart(6),
    )
    daily.push({ day: d, total: r.total })
  }

  // 累计对比
  const day1 = daily[0].total
  const day7AvgIncome = (daily.filter(d => d.day >= 2 && d.day <= 7).reduce((a, d) => a + d.total, 0)) / 6
  const day8_30AvgIncome = (daily.filter(d => d.day >= 10).reduce((a, d) => a + d.total, 0)) / daily.filter(d => d.day >= 10).length
  const steadyStateIncome = daily[daily.length - 1].total
  console.log('\n===== 关键指标 =====')
  console.log(`Day1 总产出            : ${day1}`)
  console.log(`Day2~7 日均（推进期）   : ${Math.round(day7AvgIncome)}`)
  console.log(`Day10~30 日均（稳态期） : ${Math.round(day8_30AvgIncome)}`)
  console.log(`Day30 稳态产出         : ${steadyStateIncome}`)
  console.log()
  console.log(`Day1 / Day2-7 日均 倍率 : ${(day1 / day7AvgIncome).toFixed(2)}x  ${day1 / day7AvgIncome > 5 ? '⚠️ 过陡' : day1 / day7AvgIncome > 4 ? '⚠️ 偏陡' : '✓ 合理'}`)
  console.log(`Day1 / 稳态 倍率       : ${(day1 / steadyStateIncome).toFixed(2)}x`)
  console.log(`Day2 / Day3 倍率       : ${(daily[1].total / daily[2].total).toFixed(2)}x  ${Math.abs(daily[1].total - daily[2].total) / Math.max(daily[1].total, daily[2].total) > 0.4 ? '⚠️ 相邻日差距大' : '✓'}`)
  console.log(`Day7 / Day14 倍率      : ${(daily.find(d => d.day === 7).total / daily.find(d => d.day === 14).total).toFixed(2)}x`)

  // 健康区间建议
  console.log('\n===== 健康区间 =====')
  console.log('  · Day1 / Day2~7 日均倍率：理想 2.5~4x（Day1 爆点但不悬崖）')
  console.log('  · Day2 / Day3 倍率：理想 ≤ 1.5x（相邻日差距小）')
  console.log('  · 稳态产出：理想 ≥ 500 灵石/天（玩家有 "每天花钱" 的空间）')
}

main()
