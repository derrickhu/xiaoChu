/**
 * 冒烟测试：章节里程碑 + 徽章 + SSR 法宝现货端到端
 *
 * 不依赖真机环境：
 *   · mock 掉 wx/tt 全局 API（setStorageSync/getStorageSync）
 *   · 直接调用 storage 层 API 模拟"打完 8 / 16 / 24 ★"
 *   · 断言奖励发放、徽章解锁、SSR 法宝直接到账
 *   · 校验全拥有时走兜底万能碎片
 *
 * 运行：
 *   node scripts/smoke_chapter_milestones.js
 */

/* eslint-disable no-console */
const memStore = {}
global.wx = {
  getStorageSync: (k) => memStore[k] || '',
  setStorageSync: (k, v) => { memStore[k] = v },
  removeStorageSync: (k) => { delete memStore[k] },
  getSystemInfoSync: () => ({ pixelRatio: 2, platform: 'devtools', windowWidth: 375, windowHeight: 812, safeArea: { top: 0, bottom: 812 } }),
  getMenuButtonBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  onShareAppMessage: () => {},
  showShareMenu: () => {},
  login: () => {},
  getSetting: () => {},
  getUserInfo: () => {},
  createRewardedVideoAd: () => ({ onLoad: () => {}, onError: () => {}, onClose: () => {}, load: () => Promise.resolve(), show: () => Promise.resolve() }),
  offShareAppMessage: () => {},
  onShareTimeline: () => {},
  offShareTimeline: () => {},
}
global.tt = global.wx
global.GameGlobal = {}

const Storage = require('../js/data/storage')
const { CHAPTERS } = require('../js/data/stages')
const { MILESTONE_TIERS, getChapterMilestoneReward } = require('../js/data/chapterMilestoneConfig')

const store = new Storage()
// 重置：确保从 0 起步
store._d.chapterStarMilestones = {}
store._d.chapterBadges = {}
store._d.weaponWildcardTickets = 0

function assert(cond, msg) {
  if (!cond) {
    console.error('[FAIL]', msg)
    process.exitCode = 1
  } else {
    console.log('[PASS]', msg)
  }
}

// 走 stageManager._grantChapterMilestoneRewards 真实路径（而不是 reimplement 逻辑）
//   · 保证测试覆盖到 ssrWeapon 的随机抽取 + 兜底分支
const { grantChapterMilestoneManually } = require('../js/engine/stageManager')

function simulateChapter1Full3Stars() {
  // 1-1 ~ 1-8 各 3★ 通关：直接写 stageClearRecord，让 getChapterTotalStars 回算
  for (let ord = 1; ord <= 8; ord++) {
    const stageId = `stage_1_${ord}`
    if (!store._d.stageClearRecord[stageId]) store._d.stageClearRecord[stageId] = {}
    store._d.stageClearRecord[stageId].cleared = true
    store._d.stageClearRecord[stageId].bestRating = 'S'
  }
  // 24★ 达成后，走 grantChapterMilestoneManually 分别领三档
  const fakeG = { storage: store }
  for (const tier of MILESTONE_TIERS) {
    grantChapterMilestoneManually(fakeG, 1, tier)
  }
}

const initialSS = store.soulStone
const initialAS = store.awakenStone
const initialUF = store.universalFragment
const { WEAPON_RARITY, getWeaponById } = require('../js/data/weapons')
const initialSsrWeapons = (WEAPON_RARITY.SSR || []).filter(id => store.hasWeapon(id)).length

simulateChapter1Full3Stars()

const totalStars = store.getChapterTotalStars(1, 'normal') || 0
assert(totalStars === 24, `第1章总星数 = ${totalStars}，期望 24`)

assert(store.isChapterMilestoneClaimed(1, 8), 'tier 8 已标记为已领取')
assert(store.isChapterMilestoneClaimed(1, 16), 'tier 16 已标记为已领取')
assert(store.isChapterMilestoneClaimed(1, 24), 'tier 24 已标记为已领取')
assert(store.isChapterBadgeUnlocked(1), '第1章徽章已解锁')

const ch1SsrWeapons = (WEAPON_RARITY.SSR || []).filter(id => store.hasWeapon(id)).length
assert(ch1SsrWeapons === initialSsrWeapons + 1, `24★ 直接发放 SSR 法宝 +1 (${initialSsrWeapons} → ${ch1SsrWeapons})`)
assert(store.soulStone - initialSS > 0, '灵石增量 > 0')
assert(store.awakenStone - initialAS > 0, '觉醒石增量 > 0')
assert(store.universalFragment - initialUF > 0, '万能碎片增量 > 0')

// ===== 未达成 tier 的章节不会被错误领取 =====
assert(!store.isChapterMilestoneClaimed(2, 8), '第2章 tier 8 未达成不会被标记')

// ===== 未达成 tier 的章节不会被错误领取 =====
assert(!store.isChapterMilestoneClaimed(2, 8), '第2章 tier 8 未达成不会被标记')

// ===== 老玩家手动补发：章节主线页"领取"按钮路径 =====
//   · 模拟老玩家第 2 章早已通关但 chapterStarMilestones 字段为空
//   · 调用 stageManager.grantChapterMilestoneManually 补发 8★ / 24★ 档
//   · 断言 24★ 直接拿到一件 SSR 法宝（resolved.rewards 含 ssrWeapon）
{
  for (let ord = 1; ord <= 8; ord++) {
    const sid = `stage_2_${ord}`
    if (!store._d.stageClearRecord[sid]) store._d.stageClearRecord[sid] = {}
    store._d.stageClearRecord[sid].cleared = true
    store._d.stageClearRecord[sid].bestRating = 'S'
  }
  const ch2Stars = store.getChapterTotalStars(2, 'normal') || 0
  assert(ch2Stars === 24, `第2章（老玩家）星数应为 24，实际 ${ch2Stars}`)

  const fakeG = { storage: store }
  const ssBefore = store.soulStone
  const ssrOwnedBefore = (WEAPON_RARITY.SSR || []).filter(id => store.hasWeapon(id)).length

  const r1 = grantChapterMilestoneManually(fakeG, 2, 8)
  assert(r1 && r1.tier === 8, '第2章 tier 8 补发成功')
  assert(store.isChapterMilestoneClaimed(2, 8), 'tier 8 已标记')
  assert(store.soulStone > ssBefore, '补发后灵石增加')

  const r24 = grantChapterMilestoneManually(fakeG, 2, 24)
  assert(r24 && r24.tier === 24, '第2章 tier 24 补发成功')
  assert(store.isChapterBadgeUnlocked(2), '第2章徽章解锁')
  const ssrOwnedAfter = (WEAPON_RARITY.SSR || []).filter(id => store.hasWeapon(id)).length
  assert(ssrOwnedAfter === ssrOwnedBefore + 1, `24★ 直接发放 SSR 法宝 (${ssrOwnedBefore} → ${ssrOwnedAfter})`)
  const hasSsrWeaponInResolved = r24.rewards.some(r => r.type === 'ssrWeapon' && r.weaponId && r.weaponName)
  assert(hasSsrWeaponInResolved, 'resolved.rewards 含 ssrWeapon 条目（带 weaponId / weaponName）')

  // 幂等性：重复补发同一档 → 返回 null
  const dup = grantChapterMilestoneManually(fakeG, 2, 8)
  assert(dup === null, '同一档重复补发返回 null（幂等）')

  // 未达成章节 → 不能补发
  const tooEarly = grantChapterMilestoneManually(fakeG, 5, 8)
  assert(tooEarly === null, '未达成章节不可补发')
}

// ===== 兜底分支：SSR 法宝全拥有时，给 60 万能碎片 =====
//   · 先把 11 件 SSR 法宝全加到背包
//   · 模拟第 3 章通关 24★，调用 grantChapterMilestoneManually(3, 24)
//   · 断言 resolved 含 fromSsrWeaponFallback，万能碎片 +60
{
  for (const id of WEAPON_RARITY.SSR || []) {
    if (!store.hasWeapon(id)) store.addWeapon(id)
  }
  for (let ord = 1; ord <= 8; ord++) {
    const sid = `stage_3_${ord}`
    if (!store._d.stageClearRecord[sid]) store._d.stageClearRecord[sid] = {}
    store._d.stageClearRecord[sid].cleared = true
    store._d.stageClearRecord[sid].bestRating = 'S'
  }
  const fakeG = { storage: store }
  const ufBefore = store.universalFragment
  const r24 = grantChapterMilestoneManually(fakeG, 3, 24)
  assert(r24 && r24.tier === 24, '第3章 tier 24 补发成功（兜底场景）')
  const fallback = r24.rewards.find(r => r.fromSsrWeaponFallback)
  assert(!!fallback, 'SSR 全拥有时返回 fromSsrWeaponFallback 奖励条目')
  assert(store.universalFragment - ufBefore >= 60, `兜底万能碎片 ≥ 60 (+${store.universalFragment - ufBefore})`)
}

console.log('\n全部断言执行完毕，exit code =', process.exitCode || 0)
