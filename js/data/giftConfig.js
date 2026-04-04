/**
 * 礼包 & 留存系统配置 — 灵宠消消塔
 * 统一管理：7日签到、每日任务、回归奖励、分享奖励、删档补偿
 */

// ===== 新手 7 日签到奖励（严格递增，体力/碎片比重增大） =====
// 7天灵石合计 ~415，日均 ~60；第二轮起衰减 0.6
const LOGIN_REWARDS = [
  { day: 1, rewards: { soulStone: 30,  stamina: 20 } },
  { day: 2, rewards: { soulStone: 40,  fragment: 3 } },
  { day: 3, rewards: { soulStone: 50,  stamina: 30 } },
  { day: 4, rewards: { soulStone: 55,  fragment: 5 } },
  { day: 5, rewards: { soulStone: 65,  stamina: 40 } },
  { day: 6, rewards: { soulStone: 75,  fragment: 8, awakenStone: 1 } },
  { day: 7, rewards: { soulStone: 100, stamina: 50, fragment: 10, awakenStone: 2, petChoice: true } },
]

const LOGIN_WEEKLY_RATIO = 0.6

// ===== 每日任务（基础值为 Ch1 奖励，高章节通过 getDailyTaskScale 缩放） =====
// Ch1 五条任务+全完成合计 ~80 灵石（dailyTarget 400 × dailyTask 0.20 = 80）
const DAILY_TASKS = [
  { id: 'battle_1',    name: '秘境战斗1场',  condition: { type: 'stageBattle', count: 1 }, reward: { soulStone: 20 } },
  { id: 'battle_3',    name: '战斗3场',      condition: { type: 'anyBattle', count: 3 },   reward: { fragment: 3, soulStone: 8 } },
  { id: 'idle_collect', name: '收取派遣',     condition: { type: 'idleCollect', count: 1 }, reward: { soulStone: 13 } },
  { id: 'pet_feed',    name: '宠物升级1次',  condition: { type: 'petFeed', count: 1 },     reward: { soulStone: 10 } },
  { id: 'share_1',     name: '分享游戏1次',  condition: { type: 'share', count: 1 },       reward: { soulStone: 15 } },
]

const DAILY_ALL_COMPLETE_BONUS = { soulStone: 14, stamina: 20 }

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

// ===== 分享奖励 =====
const SHARE_DAILY_MAX = 3
const SHARE_PER_REWARD = { stamina: 10 }
const SHARE_FIRST_EVER_BONUS = { soulStone: 100 }

const INVITE_REWARD = { soulStone: 200 }
const INVITE_MAX_COUNT = 10

// ===== 回归奖励（离线 >= 48h） =====
const COMEBACK_THRESHOLD_MS = 48 * 3600 * 1000
const COMEBACK_REWARD = { staminaFull: true, soulStone: 300 }

// ===== 一测删档补偿 =====
const BETA1_COMPENSATION = {
  soulStone: 500,
  fragment: 20,
  awakenStone: 3,
  staminaFull: true,
}

const DATA_VERSION = 2

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
  BETA1_COMPENSATION,
  DATA_VERSION,
}
