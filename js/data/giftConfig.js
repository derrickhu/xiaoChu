/**
 * 礼包 & 留存系统配置 — 灵宠消消塔
 * 数值定义已迁移至 balance/economy.js，本文件保留逻辑函数与对外导出
 */

const {
  LOGIN_REWARDS, LOGIN_WEEKLY_RATIO,
  DAILY_TASKS, DAILY_ALL_COMPLETE_BONUS,
  SHARE_DAILY_MAX, SHARE_PER_REWARD, SHARE_FIRST_EVER_BONUS,
  INVITE_REWARD, INVITE_MAX_COUNT,
  COMEBACK_THRESHOLD_MS, COMEBACK_REWARD, WIPE_COMPENSATION,
} = require('./balance/economy')

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
  if (chapter >= 6 && task.reward.soulStone >= 15) {
    r.awakenStone = (r.awakenStone || 0) + Math.max(1, Math.floor((chapter - 5) * 0.5))
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
  if (chapter >= 6) {
    r.awakenStone = Math.max(1, Math.floor((chapter - 4) * 0.5))
  }
  return r
}

// 分享/邀请/回归/补偿数值已迁移至 balance/economy.js

const DATA_VERSION = 3

module.exports = {
  LOGIN_REWARDS,
  LOGIN_WEEKLY_RATIO,
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
