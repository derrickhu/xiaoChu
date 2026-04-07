/**
 * 经济系统配置 — 灵宠消消塔
 * 数值定义已迁移至 balance/economy.js，本文件保留生成逻辑与对外导出
 */

const {
  ECONOMY_FRAMEWORK, IDLE_CFG, CHAPTER_CLEAR_REWARDS,
  TOWER_SETTLE, STAGE_SETTLE, ROGUE_SETTLE,
  TOWER_DAILY_FREE_RUNS, TOWER_DAILY_AD_EXTRA_RUNS,
} = require('./balance/economy')

const CURRENCY = {
  soulStone:   { name: '灵石',   icon: 'icon_soul_stone',   desc: '宠物升级的通用货币' },
  awakenStone: { name: '觉醒石', icon: 'icon_awaken_stone', desc: '★4/★5突破的稀缺材料' },
  fragment:    { name: '碎片',   icon: 'icon_fragment',     desc: '宠物升星的专属材料' },
}

const RARITY_VISUAL = {
  R: {
    label: 'R', name: '稀有',
    borderColor: '#4dcc4d',
    bgGradient: ['#1a3a1a', '#2a5a2a'],
    glowColor: 'rgba(77,204,77,0.3)',
    badgeColor: '#4dcc4d',
    badgeBg: 'rgba(30,80,30,0.85)',
  },
  SR: {
    label: 'SR', name: '超稀有',
    borderColor: '#b44dff',
    bgGradient: ['#2a1a3a', '#4a2a6a'],
    glowColor: 'rgba(180,77,255,0.4)',
    badgeColor: '#b44dff',
    badgeBg: 'rgba(60,20,100,0.85)',
  },
  SSR: {
    label: 'SSR', name: '传说',
    borderColor: '#ffd700',
    bgGradient: ['#3a3010', '#5a4a20'],
    glowColor: 'rgba(255,215,0,0.5)',
    badgeColor: '#ffd700',
    badgeBg: 'rgba(100,80,10,0.85)',
    hasParticles: true,
  },
}

const STAR_VISUAL = {
  1: { color: '#888888', name: '初始',  effect: 'none' },
  2: { color: '#ffd700', name: '觉知',  effect: 'none' },
  3: { color: '#ffd700', name: '通灵',  effect: 'glow' },
  4: { color: '#b44dff', name: '觉醒',  effect: 'aura' },
  5: { color: '#ff4d9a', name: '超越',  effect: 'rainbow' },
}

const STAGES_PER_CHAPTER = 8

// ECONOMY_FRAMEWORK, IDLE_CFG 已迁移至 balance/economy.js

// ===== 关卡奖励：基于 dailyTarget 公式生成 12 章 =====
const _DAILY_STAGE_EST = { 1:20, 2:18, 3:16, 4:14, 5:13, 6:12, 7:11, 8:10, 9:9, 10:8, 11:7, 12:7 }
const _DIST_W = [0.7, 0.8, 0.85, 0.95, 1.0, 1.1, 1.25, 1.4]

function _genStageRewards() {
  const R = {}
  for (let ch = 1; ch <= 12; ch++) {
    const dt = ECONOMY_FRAMEWORK.dailyTarget[ch]
    const est = _DAILY_STAGE_EST[ch]
    const avgR = dt.soulStone * ECONOMY_FRAMEWORK.sourceRatio.stageRepeat / est
    const repeatSS = _DIST_W.map(w => Math.round(avgR * w))
    const firstSS = repeatSS.map(r => Math.round(r * 1.5))

    const avgFrag = Math.max(1, dt.fragment * 0.5 / est)
    const repeatFrag = _DIST_W.map(w => Math.max(1, Math.round(avgFrag * w)))
    const firstFrag = repeatFrag.map(r => Math.round(r * 1.5))

    let awRepeat = 0
    let awFirst = Array(8).fill(0)
    if (dt.awakenStonePerWeek > 0) {
      awRepeat = Math.round((dt.awakenStonePerWeek / (est * 7)) * 100) / 100
      awRepeat = Math.max(0.05, awRepeat)
      awFirst = _DIST_W.map((w, i) => i < 3 && ch < 8 ? 0 : Math.max(1, Math.round(dt.awakenStonePerWeek / 6 * w)))
    }

    R[ch] = {
      normal: {
        soulStone: { first: firstSS, repeat: repeatSS },
        fragment: { first: firstFrag, repeat: repeatFrag },
        awakenStone: { first: awFirst, repeat: awRepeat },
      },
      elite: {
        soulStone: { first: firstSS.map(v => Math.round(v * 1.5)), repeat: repeatSS.map(v => Math.round(v * 1.5)) },
        fragment: { first: firstFrag.map(v => Math.round(v * 1.4)), repeat: repeatFrag.map(v => Math.round(v * 1.3)) },
        awakenStone: { first: awFirst.map(v => Math.round(v * 1.5)), repeat: Math.round(awRepeat * 1.5 * 100) / 100 },
      },
    }
  }
  return R
}
const STAGE_REWARDS = _genStageRewards()

// ===== 关卡星级奖励：基于 dailyTarget 公式生成 12 章 =====
function _genStarRewards() {
  const R = {}
  for (let ch = 1; ch <= 12; ch++) {
    const dt = ECONOMY_FRAMEWORK.dailyTarget[ch]
    const base2 = Math.round(dt.soulStone * 0.01)
    const base3 = Math.round(dt.soulStone * 0.02)
    const fBase = Math.max(0, Math.round(dt.fragment * 0.08))
    R[ch] = _DIST_W.map((w, i) => {
      const s2 = { soulStone: Math.round(base2 * w), fragment: Math.max(0, Math.round(fBase * w)) }
      const s3 = { soulStone: Math.round(base3 * w), fragment: Math.max(1, Math.round(fBase * 1.5 * w)) }
      if (ch >= 4 && i >= 4) {
        s3.awakenStone = Math.max(1, Math.round(dt.awakenStonePerWeek / 12 * w))
      }
      return { star2: s2, star3: s3 }
    })
  }
  return R
}
const STAR_REWARDS = _genStarRewards()

// CHAPTER_CLEAR_REWARDS 已迁移至 balance/economy.js

const _AD_UNIT_A = 'adunit-00751e252c34ac8f'
const _AD_UNIT_B = 'adunit-6e618cadef132ef4'
const _AD_UNIT_C = 'adunit-cb64624cd4adedae'

const TOWER_DAILY = {
  freeRuns: TOWER_DAILY_FREE_RUNS,
  adExtraRuns: TOWER_DAILY_AD_EXTRA_RUNS,
  adUnitId: _AD_UNIT_A,
}

// TOWER_SETTLE 已迁移至 balance/economy.js

// ===== 周回碎片档位：基于 dailyTarget 公式生成 12 章 =====
function _genRepFrag() {
  const R = {}
  for (let ch = 1; ch <= 12; ch++) {
    const dt = ECONOMY_FRAMEWORK.dailyTarget[ch]
    const base = Math.max(1, Math.round(dt.fragment / 10))
    R[ch] = {
      normal: { min: base, max: base + Math.max(1, Math.round(base * 0.5)), pool: 'chapter' },
      elite:  { min: base + 1, max: base + Math.max(2, Math.round(base * 0.8)), pool: 'chapter' },
    }
  }
  return R
}
const CHAPTER_REP_FRAG = _genRepFrag()

// STAGE_SETTLE, ROGUE_SETTLE 已迁移至 balance/economy.js

/**
 * 获取玩家当前章节对应的每日任务奖励缩放系数
 * @param {number} chapter 1-12
 */
function getDailyTaskScale(chapter) {
  return ECONOMY_FRAMEWORK.dailyTaskScale[chapter] || 1.0
}

/**
 * 获取指定章节/关序/难度的奖励配置
 * @param {number} chapter 章节号 1-12
 * @param {number} order 关卡序号 1-8 (0-indexed internally)
 * @param {string} difficulty 'normal' | 'elite'
 */
function getStageRewardConfig(chapter, order, difficulty) {
  const chRewards = STAGE_REWARDS[chapter]
  if (!chRewards) return null
  const diffRewards = chRewards[difficulty || 'normal']
  if (!diffRewards) return null
  const idx = order - 1
  return {
    soulStone: {
      first: diffRewards.soulStone.first[idx] || 0,
      repeat: diffRewards.soulStone.repeat[idx] || 0,
    },
    fragment: {
      first: diffRewards.fragment.first[idx] || 0,
      repeat: diffRewards.fragment.repeat[idx] || 0,
    },
    awakenStone: {
      first: (diffRewards.awakenStone.first && diffRewards.awakenStone.first[idx]) || 0,
      repeat: diffRewards.awakenStone.repeat || 0,
    },
  }
}

/**
 * 获取指定章节/关序的星级奖励配置
 * @param {number} chapter 章节号 1-12
 * @param {number} order 关卡序号 1-8 (0-indexed internally)
 */
function getStarRewardConfig(chapter, order) {
  const chStars = STAR_REWARDS[chapter]
  if (!chStars) return null
  return chStars[order - 1] || null
}

// ===== IAA 广告位配置 =====
const AD_REWARDS = {
  revive:          { enabled: true, adUnitId: _AD_UNIT_A, dailyLimit: 1  },
  staminaRecovery: { enabled: true, adUnitId: _AD_UNIT_A, dailyLimit: 3, reward: { stamina: 40 } },
  signDouble:      { enabled: true, adUnitId: _AD_UNIT_A, dailyLimit: 1, multiplier: 2 },
  dailyTaskBonus:  { enabled: true, adUnitId: _AD_UNIT_A, dailyLimit: 1, multiplier: 2 },
  settleDouble:    { enabled: true, adUnitId: _AD_UNIT_B, dailyLimit: -1, multiplier: 2 },
  dexMilestone:    { enabled: true, adUnitId: _AD_UNIT_B, dailyLimit: -1, multiplier: 2 },
  dexAcquireHint:  { enabled: true, adUnitId: _AD_UNIT_C },
  towerExtraRun:   { enabled: true, adUnitId: _AD_UNIT_A, dailyLimit: 2 },
}

/**
 * 开发/GM 调试用：输出指定章节的预期日收入，对比 dailyTarget 检查偏差
 * @param {number} chapter 1-12
 */
function auditDailyIncome(chapter) {
  const dt = ECONOMY_FRAMEWORK.dailyTarget[chapter]
  const sr = ECONOMY_FRAMEWORK.sourceRatio
  if (!dt) return null
  const est = _DAILY_STAGE_EST[chapter] || 15
  const chRewards = STAGE_REWARDS[chapter]
  const repeatSS = chRewards ? chRewards.normal.soulStone.repeat : []
  const avgRepeatSS = repeatSS.length > 0 ? repeatSS.reduce((a, b) => a + b, 0) / repeatSS.length : 0

  const stageIncome = Math.round(avgRepeatSS * est)
  const towerSS = TOWER_SETTLE.soulStone
  const avgFloor = 15
  const towerPerRun = Math.floor(avgFloor * towerSS.floorBase + towerSS.floorGrowth * avgFloor * (avgFloor + 1) / 2) + Math.floor(200 * towerSS.combatRatio)
  const towerRuns = TOWER_DAILY.freeRuns + TOWER_DAILY.adExtraRuns
  const towerIncome = towerPerRun * towerRuns

  const scale = ECONOMY_FRAMEWORK.dailyTaskScale[chapter] || 1
  const taskIncome = Math.round(94 * scale)

  const idleHours = 16
  const idleIncome = Math.floor(idleHours * IDLE_CFG.soulStonePerHour * (1 + 5 * IDLE_CFG.petLvExpFactor))

  const signIncome = Math.round(dt.soulStone * sr.signIn)

  const totalIncome = stageIncome + towerIncome + taskIncome + idleIncome + signIncome
  const report = {
    chapter,
    dailyTarget: dt.soulStone,
    sources: {
      stage: { ss: stageIncome, ratio: sr.stageRepeat, target: Math.round(dt.soulStone * sr.stageRepeat) },
      tower: { ss: towerIncome, ratio: sr.tower, target: Math.round(dt.soulStone * sr.tower) },
      task:  { ss: taskIncome,  ratio: sr.dailyTask, target: Math.round(dt.soulStone * sr.dailyTask) },
      idle:  { ss: idleIncome,  ratio: sr.idle, target: Math.round(dt.soulStone * sr.idle) },
      sign:  { ss: signIncome,  ratio: sr.signIn, target: Math.round(dt.soulStone * sr.signIn) },
    },
    totalIncome,
    deviation: ((totalIncome / dt.soulStone - 1) * 100).toFixed(1) + '%',
  }
  console.log('[EconomyAudit] Ch' + chapter + ':', JSON.stringify(report, null, 2))
  return report
}

module.exports = {
  CURRENCY,
  RARITY_VISUAL,
  STAR_VISUAL,
  STAGES_PER_CHAPTER,
  STAGE_REWARDS,
  STAR_REWARDS,
  CHAPTER_CLEAR_REWARDS,
  TOWER_DAILY,
  TOWER_SETTLE,
  STAGE_SETTLE,
  CHAPTER_REP_FRAG,
  ROGUE_SETTLE,
  IDLE_CFG,
  AD_REWARDS,
  ECONOMY_FRAMEWORK,
  getDailyTaskScale,
  getStageRewardConfig,
  getStarRewardConfig,
  auditDailyIncome,
}
