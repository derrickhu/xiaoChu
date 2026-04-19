/**
 * 新号 Day1 经济审计脚本 —— 建立/追踪"新手首日总产出"的 baseline
 *
 * 场景模拟（与玩家实际反馈 9000+ 灵石 / 40 万能碎片对齐）：
 *   · 新号安装 → 领新手礼包
 *   · 完成首日签到（主奖 + 连续登录第 1 天 + 广告翻倍）
 *   · 完成全部每日任务（含全清奖 + 全清广告翻倍）
 *   · 主线推到 stage_4_4（前 27 关全 S + 第 28 关胜利），含首通加成 + 章节通关宝箱
 *   · 拿满第 1/2/3 章 8/16/24★ 里程碑（打通 3 章 = 24★ × 3 = 72★）
 *   · 分享首次永久奖 + firstPet 场景奖 + activeStageShare 场景奖
 *
 * 目的：
 *   1. 打印每个来源的灵石 / 万能碎片贡献，方便识别"谁在溢出"
 *   2. 以 Day1 合理区间做阈值（灵石 ≤ 6500、万能 ≤ 25），超阈值 exit 1
 *   3. 每次改 balance/economy.js 或 chapterMilestoneConfig.js 后跑一次，前后对比
 *
 * 运行：
 *   node scripts/audit_day1_income.js
 */

/* eslint-disable no-console */

const path = require('path')
const ROOT = path.resolve(__dirname, '..')

function req(p) { return require(path.join(ROOT, p)) }

const { CHAPTER_MILESTONES, MILESTONE_TIERS } = req('js/data/chapterMilestoneConfig')
const {
  ECONOMY_FRAMEWORK,
  CHAPTER_CLEAR_REWARDS,
  LOGIN_REWARDS,
  CONSECUTIVE_LOGIN_REWARDS,
  DAILY_TASKS,
  DAILY_ALL_COMPLETE_BONUS,
  SHARE_FIRST_EVER_BONUS,
  DAILY_TASK_AWAKEN,
  AD_REWARDS_NUMS,
} = req('js/data/balance/economy')
const {
  NEWBIE_GIFT_REWARDS,
  FIRST_CLEAR_SOULSTONE_BONUS,
  STAGE_MECHANIC_FOCUS,
} = req('js/data/constants')
const {
  STAR_REWARDS,
  getDailyTaskScale,
} = req('js/data/economyConfig')
const { getStageById } = req('js/data/stages')
const SHARE_CONFIG = req('js/data/shareConfig')

// ===== 工具：累加器 =====
function makeAcc() {
  return { soulStone: 0, universalFragment: 0, breakdown: [] }
}
function add(acc, label, soulStone, frag) {
  soulStone = soulStone || 0
  frag = frag || 0
  acc.soulStone += soulStone
  acc.universalFragment += frag
  acc.breakdown.push({ label, soulStone, frag })
}

// ===== 1. 新手礼包 =====
function calcNewbieGift(acc) {
  add(acc, '新手礼包', NEWBIE_GIFT_REWARDS.soulStone || 0, NEWBIE_GIFT_REWARDS.universalFragment || 0)
}

// ===== 2. 签到（Day1 主奖 + 连续第 1 天 + 广告翻倍 signMultiplier=2）=====
function calcSignIn(acc) {
  const day1Main = (LOGIN_REWARDS[0] && LOGIN_REWARDS[0].rewards) || { soulStone: 0 }
  const consec1 = (CONSECUTIVE_LOGIN_REWARDS[0] && CONSECUTIVE_LOGIN_REWARDS[0].rewards) || { soulStone: 0 }
  const base = (day1Main.soulStone || 0) + (consec1.soulStone || 0)
  add(acc, '签到 Day1 主奖 + 连登 Day1', base, 0)
  // 广告翻倍：实际代码里 signMultiplier=2 对主奖字段再发一份灵石；按保守估计只翻主奖
  const adDouble = (day1Main.soulStone || 0) * Math.max(0, (AD_REWARDS_NUMS.signMultiplier || 2) - 1)
  add(acc, '签到广告翻倍', adDouble, 0)
}

// ===== 3. 每日任务（按当前推进到的章节 4 做缩放 + 全清奖 + 全清广告翻倍）=====
function calcDailyTasks(acc) {
  const scale = getDailyTaskScale(4)
  let taskSum = 0
  for (const t of DAILY_TASKS) {
    const ss = (t.reward && t.reward.soulStone) || 0
    taskSum += Math.round(ss * scale)
  }
  add(acc, `日任 6 项×章4缩放 ${scale}`, taskSum, 0)
  // 全清奖 + 全清广告翻倍
  const allBonus = Math.round((DAILY_ALL_COMPLETE_BONUS.soulStone || 0) * scale)
  add(acc, '日任全清奖', allBonus, 0)
  // 广告翻倍（dailyTaskMultiplier=2 → 再发一份全清奖）
  const adDouble = allBonus * Math.max(0, (AD_REWARDS_NUMS.dailyTaskMultiplier || 2) - 1)
  add(acc, '日任全清广告翻倍', adDouble, 0)
}

// ===== 4. 关卡首通结算（1-1~4-4 全部首通 + 前 27 关 S 评级加成）=====
//   直接从 stages.js 真实生成的关卡数据读取 firstClear 中的 soulStone 条目，
//   避免自己写死 NON_BOSS_WEAPON_SUBSTITUTE 导致数值不同步（改了 stages.js 这里要随之更新）
function _firstClearSoul(stageId) {
  const stage = getStageById(stageId)
  if (!stage || !stage.rewards || !stage.rewards.firstClear) return 0
  let sum = 0
  for (const r of stage.rewards.firstClear) {
    if (r.type === 'soulStone') sum += r.amount || 0
  }
  return sum
}
function calcStageClears(acc) {
  let firstClearSum = 0
  let star3Sum = 0
  let star2Sum = 0
  for (let ch = 1; ch <= 4; ch++) {
    const maxOrd = ch < 4 ? 8 : 4
    for (let ord = 1; ord <= maxOrd; ord++) {
      firstClearSum += _firstClearSoul(`stage_${ch}_${ord}`)
      const sr = (STAR_REWARDS[ch] && STAR_REWARDS[ch][ord - 1]) || null
      if (sr) {
        star2Sum += (sr.star2 && sr.star2.soulStone) || 0
        star3Sum += (sr.star3 && sr.star3.soulStone) || 0
      }
    }
  }
  add(acc, '关卡首通结算（1-1~4-4 合计 28 关）', firstClearSum, 0)
  add(acc, '关卡评级星 ★2 累计灵石', star2Sum, 0)
  add(acc, '关卡评级星 ★3 累计灵石', star3Sum, 0)
}

// ===== 5. 首通固定加成（FIRST_CLEAR_SOULSTONE_BONUS）=====
function calcFirstClearBonus(acc) {
  // 只在 1-1 / 1-3 / 1-5 / 1-8 等配置的关卡触发
  let sum = 0
  for (const key of Object.keys(FIRST_CLEAR_SOULSTONE_BONUS)) {
    // 关卡 ID 形如 stage_X_Y；只要 Day1 走过该关就发
    // Day1 已经打到 4-4 → 1-1/1-3/1-5/1-8 全都通过
    sum += FIRST_CLEAR_SOULSTONE_BONUS[key] || 0
  }
  add(acc, '首通固定加成 FIRST_CLEAR_SOULSTONE_BONUS', sum, 0)
}

// ===== 6. 第 1 章技巧挑战奖（STAGE_MECHANIC_FOCUS.challenge.rewardSoulStone）=====
function calcMechanicChallenges(acc) {
  let sum = 0
  for (const key of Object.keys(STAGE_MECHANIC_FOCUS)) {
    const ch = STAGE_MECHANIC_FOCUS[key]
    if (ch.challenge && ch.challenge.rewardSoulStone) {
      sum += ch.challenge.rewardSoulStone
    }
  }
  add(acc, '第 1 章技巧挑战奖', sum, 0)
}

// ===== 7. 章节通关宝箱（CHAPTER_CLEAR_REWARDS）— 前 3 章通关 =====
function calcChapterClearBox(acc) {
  let sum = 0
  for (let ch = 1; ch <= 3; ch++) {
    sum += (CHAPTER_CLEAR_REWARDS[ch] && CHAPTER_CLEAR_REWARDS[ch].soulStone) || 0
  }
  add(acc, '章节通关宝箱（第 1/2/3 章）', sum, 0)
}

// ===== 8. 章节星级里程碑 8/16/24★ — 第 1/2/3 章全 24★ =====
function calcChapterMilestones(acc) {
  let ssSum = 0
  let ufSum = 0
  for (let ch = 1; ch <= 3; ch++) {
    const tiers = CHAPTER_MILESTONES[ch] || {}
    for (const t of MILESTONE_TIERS) {
      const rewards = tiers[t] || []
      for (const r of rewards) {
        if (r.type === 'soulStone') ssSum += r.amount || 0
        else if (r.type === 'universalFragment') ufSum += r.count || 0
      }
    }
  }
  add(acc, '章节里程碑 8/16/24★（第 1/2/3 章）', ssSum, ufSum)
}

// ===== 9. 分享首次永久奖 + firstPet 场景奖 + activeStageShare =====
function calcShareRewards(acc) {
  // 首次永久奖：玩家任何一次分享触发一次
  const firstEver = SHARE_FIRST_EVER_BONUS.soulStone || 0
  add(acc, '分享首次永久奖', firstEver, 0)
  // firstPet 场景：首次获得宠物时分享一次
  const firstPet = (SHARE_CONFIG.SHARE_SCENES && SHARE_CONFIG.SHARE_SCENES.firstPet) || null
  if (firstPet && firstPet.reward) {
    add(acc, '分享 firstPet 场景奖', firstPet.reward.soulStone || 0, firstPet.reward.fragment || 0)
  }
  // activeStageShare：胜利后主动分享一次
  const active = (SHARE_CONFIG.SHARE_SCENES && SHARE_CONFIG.SHARE_SCENES.activeStageShare) || null
  if (active && active.reward) {
    add(acc, '分享 activeStageShare 场景奖', active.reward.soulStone || 0, active.reward.fragment || 0)
  }
}

// ===== 主流程 =====
function main() {
  const acc = makeAcc()
  calcNewbieGift(acc)
  calcSignIn(acc)
  calcDailyTasks(acc)
  calcStageClears(acc)
  calcFirstClearBonus(acc)
  calcMechanicChallenges(acc)
  calcChapterClearBox(acc)
  calcChapterMilestones(acc)
  calcShareRewards(acc)

  // 打印明细
  console.log('===== Day1 新号产出审计（推到 stage_4_4 + 前 3 章满星） =====\n')
  console.log('来源'.padEnd(36), '灵石'.padStart(8), '万能'.padStart(6))
  console.log('-'.repeat(56))
  const sorted = [...acc.breakdown].sort((a, b) => b.soulStone - a.soulStone)
  for (const row of sorted) {
    console.log(row.label.padEnd(32), String(row.soulStone).padStart(10), String(row.frag).padStart(8))
  }
  console.log('-'.repeat(56))
  console.log('合计'.padEnd(32), String(acc.soulStone).padStart(10), String(acc.universalFragment).padStart(8))

  // 阈值判定
  const SOUL_LIMIT = 6500
  const FRAG_LIMIT = 25
  console.log('\n===== 阈值 =====')
  console.log(`灵石：${acc.soulStone} / ${SOUL_LIMIT}  (${acc.soulStone <= SOUL_LIMIT ? 'PASS' : 'FAIL'})`)
  console.log(`万能：${acc.universalFragment} / ${FRAG_LIMIT}  (${acc.universalFragment <= FRAG_LIMIT ? 'PASS' : 'FAIL'})`)

  if (acc.soulStone > SOUL_LIMIT || acc.universalFragment > FRAG_LIMIT) {
    console.error('\n[FAIL] Day1 产出超出阈值，请检查近期改的 balance/economy / chapterMilestoneConfig / constants')
    process.exit(1)
  } else {
    console.log('\n[PASS] Day1 产出在目标区间内')
  }
}

main()
