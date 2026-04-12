/**
 * 礼包 & 留存系统配置 — 灵宠消消塔
 * 数值定义已迁移至 balance/economy.js，本文件保留逻辑函数与对外导出
 */

const {
  LOGIN_CYCLE_DAYS,
  LOGIN_SPECIAL_PET_ID,
  LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS,
  LOGIN_PAGE_GROUPS,
  LOGIN_MILESTONE_REWARD,
  LOGIN_MILESTONE_PETS,
  LOGIN_REWARDS,
  LOGIN_WEEKLY_RATIO,
  DAILY_TASKS, DAILY_ALL_COMPLETE_BONUS,
  SHARE_DAILY_MAX, SHARE_PER_REWARD, SHARE_FIRST_EVER_BONUS,
  INVITE_REWARD, INVITE_MAX_COUNT,
  COMEBACK_THRESHOLD_MS, COMEBACK_REWARD, WIPE_COMPENSATION,
  DAILY_TASK_AWAKEN,
} = require('./balance/economy')

const LOGIN_SCALABLE_FIELDS = ['soulStone', 'awakenStone', 'stamina', 'fragment']

function cloneLoginRewardRewards(rewards) {
  const cloned = {}
  if (!rewards) return cloned
  Object.keys(rewards).forEach((key) => {
    const value = rewards[key]
    cloned[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? Object.assign({}, value)
      : value
  })
  return cloned
}

function getLoginRewardRatio(isNewbie) {
  return isNewbie === false ? LOGIN_WEEKLY_RATIO : 1
}

function scaleLoginRewardRewards(rewards, ratio) {
  const cloned = cloneLoginRewardRewards(rewards)
  const safeRatio = typeof ratio === 'number' && ratio > 0 ? ratio : 1
  LOGIN_SCALABLE_FIELDS.forEach((field) => {
    if (typeof cloned[field] === 'number' && cloned[field] > 0) {
      cloned[field] = Math.max(1, Math.floor(cloned[field] * safeRatio))
    }
  })
  return cloned
}

function getDoubleableLoginRewards(rewards) {
  const picked = {}
  if (!rewards) return picked
  LOGIN_SCALABLE_FIELDS.forEach((field) => {
    if (typeof rewards[field] === 'number' && rewards[field] > 0) picked[field] = rewards[field]
  })
  return picked
}

function normalizeLoginCycleDay(day) {
  if (!day || day < 1) return 1
  return ((day - 1) % LOGIN_CYCLE_DAYS) + 1
}

function getLoginRewardByDay(day) {
  const cycleDay = normalizeLoginCycleDay(day)
  return LOGIN_REWARDS[cycleDay - 1] || null
}

function getScaledLoginRewardByDay(day, isNewbie) {
  const entry = getLoginRewardByDay(day)
  if (!entry || !entry.rewards) return null
  const ratio = getLoginRewardRatio(isNewbie)
  return {
    day: entry.day,
    rewards: scaleLoginRewardRewards(entry.rewards, ratio),
    ratio,
  }
}

function getLoginMilestoneReward(isNewbie) {
  return scaleLoginRewardRewards(LOGIN_MILESTONE_REWARD, getLoginRewardRatio(isNewbie))
}

function getLoginPageIndex(day) {
  const cycleDay = normalizeLoginCycleDay(day)
  const page = LOGIN_PAGE_GROUPS.find((group) => cycleDay >= group.startDay && cycleDay <= group.endDay)
  return page ? page.index : 0
}

function getLoginPageGroupByIndex(pageIndex) {
  return LOGIN_PAGE_GROUPS.find((group) => group.index === pageIndex) || LOGIN_PAGE_GROUPS[0]
}

function getLoginPageGroupByDay(day) {
  return getLoginPageGroupByIndex(getLoginPageIndex(day))
}

function getLoginPageRewards(pageIndex, isNewbie) {
  const ratio = getLoginRewardRatio(isNewbie)
  const page = getLoginPageGroupByIndex(pageIndex)
  const items = []
  for (let day = page.startDay; day <= page.endDay; day++) {
    const entry = getLoginRewardByDay(day)
    if (!entry || !entry.rewards) continue
    items.push({
      day: entry.day,
      rewards: scaleLoginRewardRewards(entry.rewards, ratio),
    })
  }
  return items
}

function getLoginPageData(pageIndex, isNewbie) {
  const page = getLoginPageGroupByIndex(pageIndex)
  return Object.assign({}, page, {
    rewards: getLoginPageRewards(page.index, isNewbie),
  })
}

/**
 * 获取按章节缩放后的每日任务奖励
 * @param {object} task  DAILY_TASKS 中的一条
 * @param {number} chapter 玩家当前章节 1-12
 */
function getScaledDailyTaskReward(task, chapter) {
  const { getDailyTaskScale } = require('./economyConfig')
  const scale = getDailyTaskScale(chapter)
  const r = {}
  if (task.reward.soulStone) r.soulStone = Math.round(task.reward.soulStone * scale)
  if (task.reward.fragment) r.fragment = Math.max(1, Math.round(task.reward.fragment * scale))
  if (task.reward.awakenStone) r.awakenStone = Math.max(1, Math.round(task.reward.awakenStone * scale))
  if (task.reward.stamina) r.stamina = Math.round(task.reward.stamina * scale)
  if (chapter >= DAILY_TASK_AWAKEN.threshold && task.reward.soulStone >= DAILY_TASK_AWAKEN.minSoulStone) {
    r.awakenStone = (r.awakenStone || 0) + Math.max(1, Math.floor((chapter - DAILY_TASK_AWAKEN.threshold + 1) * DAILY_TASK_AWAKEN.coeff))
  }
  return r
}

/**
 * 获取按章节缩放后的全完成奖励
 * @param {number} chapter 玩家当前章节 1-12
 */
function getScaledDailyAllBonus(chapter) {
  const { getDailyTaskScale } = require('./economyConfig')
  const scale = getDailyTaskScale(chapter)
  const r = {}
  if (DAILY_ALL_COMPLETE_BONUS.soulStone) r.soulStone = Math.round(DAILY_ALL_COMPLETE_BONUS.soulStone * scale)
  if (DAILY_ALL_COMPLETE_BONUS.stamina) r.stamina = Math.round(DAILY_ALL_COMPLETE_BONUS.stamina * scale)
  if (DAILY_ALL_COMPLETE_BONUS.fragment) r.fragment = Math.max(1, Math.round(DAILY_ALL_COMPLETE_BONUS.fragment * scale))
  if (chapter >= DAILY_TASK_AWAKEN.threshold) {
    r.awakenStone = Math.max(1, Math.floor((chapter - DAILY_TASK_AWAKEN.allBonusOffset) * DAILY_TASK_AWAKEN.coeff))
  }
  return r
}

// 分享/邀请/回归/补偿数值已迁移至 balance/economy.js

const DATA_VERSION = 3

module.exports = {
  LOGIN_CYCLE_DAYS,
  LOGIN_SPECIAL_PET_ID,
  LOGIN_SPECIAL_PET_DUPLICATE_FRAGMENTS,
  LOGIN_PAGE_GROUPS,
  LOGIN_MILESTONE_REWARD,
  LOGIN_MILESTONE_PETS,
  LOGIN_REWARDS,
  LOGIN_WEEKLY_RATIO,
  LOGIN_SCALABLE_FIELDS,
  cloneLoginRewardRewards,
  getLoginRewardRatio,
  scaleLoginRewardRewards,
  getDoubleableLoginRewards,
  normalizeLoginCycleDay,
  getLoginRewardByDay,
  getScaledLoginRewardByDay,
  getLoginMilestoneReward,
  getLoginPageIndex,
  getLoginPageGroupByIndex,
  getLoginPageGroupByDay,
  getLoginPageRewards,
  getLoginPageData,
  DAILY_TASKS,
  DAILY_ALL_COMPLETE_BONUS,
  getScaledDailyTaskReward,
  getScaledDailyAllBonus,
  SHARE_DAILY_MAX,
  SHARE_PER_REWARD,
  SHARE_FIRST_EVER_BONUS,
  INVITE_REWARD,
  INVITE_MAX_COUNT,
  COMEBACK_THRESHOLD_MS,
  COMEBACK_REWARD,
  WIPE_COMPENSATION,
  DATA_VERSION,
}
