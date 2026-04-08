/**
 * 通天塔活动赛季 — 周轮换 + 里程碑奖励
 * 纯数据/逻辑层，不依赖 UI
 */
const {
  TOWER_EVENT_SEASONS,
  TOWER_EVENT_MILESTONES,
  TOWER_EVENT_EPOCH,
  TOWER_EVENT_PERIOD_MS,
} = require('./balance/economy')
const { RESERVED_PETS, getPetById, getPetRarity } = require('./pets')

function getCurrentSeasonIndex() {
  const now = Date.now()
  if (now < TOWER_EVENT_EPOCH) return 0
  const weeksSinceEpoch = Math.floor((now - TOWER_EVENT_EPOCH) / TOWER_EVENT_PERIOD_MS)
  return weeksSinceEpoch % TOWER_EVENT_SEASONS.length
}

function getCurrentSeason() {
  return TOWER_EVENT_SEASONS[getCurrentSeasonIndex()]
}

/** 本周周期结束时刻 = 下一个「周一 0:00 UTC+8」边界（与 TOWER_EVENT_EPOCH 对齐的 7 日刻度） */
function getSeasonEndTime() {
  const now = Date.now()
  // 未到首个基准周一时：倒计时应对准 EPOCH 本身；若错误地 +7 天，会多出整整一周（例如出现「剩 10 天」）
  if (now < TOWER_EVENT_EPOCH) return TOWER_EVENT_EPOCH
  const weeksSinceEpoch = Math.floor((now - TOWER_EVENT_EPOCH) / TOWER_EVENT_PERIOD_MS)
  return TOWER_EVENT_EPOCH + (weeksSinceEpoch + 1) * TOWER_EVENT_PERIOD_MS
}

/** 距当前周期结束（默认每周一 0:00 UTC+8 切换）的剩余毫秒数 */
function getTowerEventCountdownMs() {
  return Math.max(0, getSeasonEndTime() - Date.now())
}

/**
 * 倒计时展示：下周一刷新后自动进入下一档 SSR/SR（与 getCurrentSeasonIndex 同步）
 */
function formatTowerEventCountdown(ms) {
  let totalSec = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(totalSec / 86400)
  totalSec %= 86400
  const h = Math.floor(totalSec / 3600)
  totalSec %= 3600
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  const hms = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  if (days > 0) return `剩${days}天 ${hms}`
  return `剩 ${hms}`
}

function getTowerEventCountdownLabel() {
  return formatTowerEventCountdown(getTowerEventCountdownMs())
}

function getSeasonSSRPet() {
  const s = getCurrentSeason()
  return getPetById(s.ssr)
}

function getSeasonSRPet() {
  const s = getCurrentSeason()
  return getPetById(s.sr)
}

/**
 * 给定 bestFloor 和已领取列表，返回可领取的新里程碑数组
 */
function getClaimableMilestones(bestFloor, claimedFloors) {
  const claimed = new Set(claimedFloors || [])
  return TOWER_EVENT_MILESTONES.filter(m => bestFloor >= m.floor && !claimed.has(m.floor))
}

/**
 * 随机选一只预留SSR（用于 ssrFrag 奖励）
 */
function pickRandomReservedSSR() {
  const ssrIds = RESERVED_PETS.filter(id => getPetRarity(id) === 'SSR')
  return ssrIds[Math.floor(Math.random() * ssrIds.length)]
}

module.exports = {
  getCurrentSeasonIndex,
  getCurrentSeason,
  getSeasonEndTime,
  getTowerEventCountdownMs,
  formatTowerEventCountdown,
  getTowerEventCountdownLabel,
  getSeasonSSRPet,
  getSeasonSRPet,
  getClaimableMilestones,
  pickRandomReservedSSR,
  TOWER_EVENT_MILESTONES,
}
