/**
 * 情绪峰值 · 炫耀触发总线 — shareHooks
 *
 * 职责：把"玩家情绪峰值"统一收口到一组语义化 API，决定：
 *   1) 是否达到"炫耀门槛"（一生一次 / 每关一次 / 每宠一档一次 等）
 *   2) 先弹 lingCheer 感叹（情绪带入）
 *   3) 再调 shareCelebrate.trigger 弹炫耀卡
 *
 * 所有业务入口（stageResultView / petDetailView / runManager / main.js）只调这里，
 * 不直接碰 shareCelebrate / lingCheer / shareConfig —— 单一触发入口便于做埋点、冷却、A/B。
 *
 * 幂等：同一关的"首通"只会弹一次；同一宠 3★/5★ 各一次；塔新高每次都弹。
 *
 * 不做什么：
 *   - 不管具体奖励（交给 share.js → storage.recordShare）
 *   - 不管分享行为本身（交给 shareCelebrate 里用户点按钮）
 */

const lingCheer = require('../views/lingCheer')
const shareCelebrate = require('../views/shareCelebrate')
const { LING } = require('./lingIdentity')

// ===== 持久化 flags =====
//   记录"某个炫耀 key 是否已弹过"；避免同里程碑反复弹窗
//   stampKey 规则：
//     firstPet                               // 一生一次
//     firstSRating                           // 一生一次
//     stageFirstClear_<stageId>              // 每关一次
//     petStarUp_<petId>_<star>               // 每宠每档（3/5）一次
//     chapterComplete_<chapterId>            // 每章一次
//     towerNewBest_<floor>                   // 每高度一次（防连弹）
function _flags(storage) {
  if (!storage || !storage._d) return null
  if (!storage._d.celebrateFlags) storage._d.celebrateFlags = {}
  return storage._d.celebrateFlags
}

function _shown(storage, stampKey) {
  const f = _flags(storage); if (!f) return false
  return !!f[stampKey]
}

function _mark(storage, stampKey) {
  const f = _flags(storage); if (!f) return
  f[stampKey] = true
  if (typeof storage._save === 'function') storage._save()
}

// ===== 公共：先感叹、再弹炫耀卡 =====
//   cheerText   小灵顶部横条（情绪带入 0.5s）
//   sceneKey    SHARE_SCENES 里的 key
//   data        传给 shareCard / share 标题模板
function _celebrate(g, stampKey, cheerText, sceneKey, data) {
  if (!g || !g.storage) return
  if (_shown(g.storage, stampKey)) return
  _mark(g.storage, stampKey)

  const avatar = (LING && LING.avatar) || null
  if (cheerText) lingCheer.show(cheerText, { tone: 'epic', avatar })
  shareCelebrate.trigger(g, sceneKey, data)
}

// =========================================================================
// 1. 首次获得灵宠（通常是 1-1 首通后的首宠）
// =========================================================================
function onFirstPet(g, opts) {
  const petName = (opts && opts.petName) || '灵宠'
  const cheer = (LING.cheer.firstPet && LING.cheer.firstPet(petName)) || `主人，${petName} 愿与你同行啦～`
  _celebrate(g, 'firstPet', cheer, 'firstPet', { petName })
}

// =========================================================================
// 2. 关卡首通（任一关，不限于 1-1）
// =========================================================================
function onStageFirstClear(g, opts) {
  const o = opts || {}
  const stageId = o.stageId || ''
  if (!stageId) return
  const data = {
    stageName: o.stageName || '秘境',
    rating: o.rating || 'A',
    isFinalBoss: !!o.isFinalBoss,
    isElite: !!o.isElite,
    turns: o.turns || 0,
  }
  const cheer = data.isFinalBoss
    ? (LING.cheer.stageFirstClearBoss && LING.cheer.stageFirstClearBoss()) || '终章守关已破～'
    : (LING.cheer.stageFirstClear && LING.cheer.stageFirstClear(data.stageName)) || `主人闯过「${data.stageName}」啦～`
  _celebrate(g, `stageFirstClear_${stageId}`, cheer, 'stageFirstClear', data)
}

// =========================================================================
// 3. 首次拿到 S 评价（一生一次）
// =========================================================================
function onFirstSRating(g, opts) {
  const o = opts || {}
  const data = {
    stageName: o.stageName || '秘境',
    turns: o.turns || 0,
    stageId: o.stageId || '',
  }
  const cheer = (LING.cheer.firstS && LING.cheer.firstS(data.stageName)) || `S 评价首度达成！主人好厉害～`
  _celebrate(g, 'firstSRating', cheer, 'firstSRating', data)
}

// =========================================================================
// 4. 灵宠升星：仅 3★ / 5★ 触发炫耀（1/2/4 只给 toast/flotText，不弹炫耀卡）
// =========================================================================
function onPetStarUp(g, opts) {
  const o = opts || {}
  const pet = o.pet || {}
  const star = o.star || 0
  if (star !== 3 && star !== 5) return  // 非里程碑不弹
  const petId = pet.petId || pet.id || ''
  const data = {
    petName: pet.name || '灵宠',
    star,
  }
  const cheer = star === 5
    ? (LING.cheer.petStarMax && LING.cheer.petStarMax(data.petName)) || `「${data.petName}」· 5★ 精通！`
    : (LING.cheer.petStarUp && LING.cheer.petStarUp(data.petName, star)) || `「${data.petName}」· ${star}★ 觉醒！`
  _celebrate(g, `petStarUp_${petId}_${star}`, cheer, 'petStarUp', data)
}

// =========================================================================
// 5. 章节通关
// =========================================================================
function onChapterComplete(g, opts) {
  const o = opts || {}
  const chapterId = o.chapterId || ''
  if (!chapterId) return
  const data = {
    chapterId,
    chapterName: o.chapterName || '此章',
  }
  const cheer = (LING.cheer.chapterComplete && LING.cheer.chapterComplete(data.chapterName)) || `「${data.chapterName}」圆满～下一卷等主人！`
  _celebrate(g, `chapterComplete_${chapterId}`, cheer, 'chapterComplete', data)
}

// =========================================================================
// 6. 通天塔新高
// =========================================================================
function onTowerNewBest(g, opts) {
  const o = opts || {}
  const floor = o.floor || 0
  if (floor <= 0) return
  const data = { floor, turns: o.turns || 0 }
  const cheer = (LING.cheer.towerNewBest && LING.cheer.towerNewBest(floor)) || `通天塔 · 第 ${floor} 层新纪录！`
  _celebrate(g, `towerNewBest_${floor}`, cheer, 'towerNewBest', data)
}

module.exports = {
  onFirstPet,
  onStageFirstClear,
  onFirstSRating,
  onPetStarUp,
  onChapterComplete,
  onTowerNewBest,
}
