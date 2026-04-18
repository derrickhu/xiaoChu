/**
 * 情绪峰值 · 炫耀触发总线 — shareHooks
 *
 * 职责：把"玩家情绪峰值"统一收口到一组语义化 API，决定：
 *   1) 是否达到"炫耀门槛"（一生一次 / 每关一次 / 每宠一档一次 等）
 *   2) 是否被"新手静默期"吞掉（早期关卡情绪阈值不足，不骚扰玩家）
 *   3) 先弹 lingCheer 感叹（情绪带入）
 *   4) 再调 shareCelebrate.trigger 弹炫耀卡
 *
 * 所有业务入口（stageResultView / petDetailView / runManager / main.js）只调这里，
 * 不直接碰 shareCelebrate / lingCheer / shareConfig —— 单一触发入口便于做埋点、冷却、A/B。
 *
 * 【新手静默期设计（方向 A）】
 *   · 1-1 / 1-2 首通：整个分享体系都静默（玩家刚接触游戏，情绪峰值不足，分享易被拒）
 *   · 1-3 首通：仅保留 firstPet（首队成型仪式，情绪最强）
 *   · 1-4 起：正常按里程碑触发
 *   · 这是"把最低含金量的事件踢出去"的过滤器，保证玩家分享的都是真情绪点
 *
 * 【幂等】
 *   · 一生一次：firstPet / firstSRating
 *   · 每关一次：stageFirstClear_<stageId> / comebackWin_<stageId>
 *   · 每宠每档一次：petStarUp_<petId>_<star>
 *   · 每境界一次：realmUp_<realmId>
 *   · 每高度一次：towerNewBest_<floor>
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

// ===== 新手静默期：1-1 / 1-2 所有分享类事件一律吞掉 =====
//   · 不点燃任何"一生一次" flag（避免低含金量事件消费唯一额度）
//   · 不弹 lingCheer（结算页另有独立 cheer 走 LING.cheer.stageFirstClear，不重复）
const _SILENT_STAGES = new Set(['stage_1_1', 'stage_1_2'])
function _isSilent(stageId) { return !!stageId && _SILENT_STAGES.has(stageId) }

// ===== 公共：先感叹、再弹炫耀卡 =====
//   cheerText   小灵顶部横条（情绪带入 0.5s）
//   sceneKey    SHARE_SCENES 里的 key
//   data        传给 shareCard / share 标题模板
// 关键：trigger 返回 false（被幂等吞掉）时不 mark flag，下次还能再次尝试触发
function _celebrate(g, stampKey, cheerText, sceneKey, data) {
  if (!g || !g.storage) return false
  if (_shown(g.storage, stampKey)) return false
  // 当前已有其他炫耀卡在展示 → 让位（不 mark，不 cheer，不抢占）
  if (shareCelebrate.isActive && shareCelebrate.isActive()) return false

  const avatar = (LING && LING.avatar) || null
  if (cheerText) lingCheer.show(cheerText, { tone: 'epic', avatar })
  const ok = shareCelebrate.trigger(g, sceneKey, data)
  if (ok) _mark(g.storage, stampKey)
  return ok
}

// =========================================================================
// 1. 首次队伍成型（1-3 首通，玩家刚看完 _newbieTeamOverview 总览）
//    历史上曾绑在 1-1 首通，但 1-1 情绪峰值不够（教学关），A1 重构后迁移到 1-3
//    stampKey 特意带 "_1_3" 场景后缀：老存档里历史的 'firstPet' flag 已被 1-1 消费，
//    若沿用同 key 会让 1-3 静默；带后缀可与旧 flag 隔离，老玩家打 1-3 时仍可弹一次
// =========================================================================
function onFirstPet(g, opts) {
  const petName = (opts && opts.petName) || '灵宠'
  const cheer = (LING.cheer.firstPet && LING.cheer.firstPet(petName)) || `主人，${petName} 愿与你同行啦～`
  _celebrate(g, 'firstPet_1_3', cheer, 'firstPet', { petName })
}

// =========================================================================
// 2. 关卡首通（1-1/1-2/1-3 静默；1-3 由 firstPet 承接）
// =========================================================================
function onStageFirstClear(g, opts) {
  const o = opts || {}
  const stageId = o.stageId || ''
  if (!stageId) return
  if (_isSilent(stageId)) return  // 新手静默期
  if (stageId === 'stage_1_3') return  // 1-3 交给 firstPet，避免重复
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
// 3. 首次拿到 S 评价（一生一次；1-1/1-2 的 S 不点燃，避免消费低含金量额度）
// =========================================================================
function onFirstSRating(g, opts) {
  const o = opts || {}
  const stageId = o.stageId || ''
  if (_isSilent(stageId)) return  // 新手期 S 不作数
  const data = {
    stageName: o.stageName || '秘境',
    turns: o.turns || 0,
    stageId,
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

// =========================================================================
// 7. 逆风翻盘：胜利时战斗中血量曾被压到 10% 以下（每关一次）
//    自然稀有（由战斗难度曲线筛选），无须额外门槛
// =========================================================================
function onComebackWin(g, opts) {
  const o = opts || {}
  const stageId = o.stageId || ''
  if (!stageId) return
  if (_isSilent(stageId)) return  // 新手期：敌人伤害高容易达成，但情绪不够
  const data = {
    stageId,
    stageName: o.stageName || '秘境',
    hpPct: Math.max(1, Math.min(10, o.hpPct || 10)),
  }
  const cheer = (LING.cheer.comebackWin && LING.cheer.comebackWin(data.stageName))
    || `险之又险！「${data.stageName}」残血翻盘～`
  _celebrate(g, `comebackWin_${stageId}`, cheer, 'comebackWin', data)
}

// =========================================================================
// 8. 境界大跨档（感气 → 炼气 等，仅 major；minor 小阶跨档不弹炫耀卡）
//    由 tierCeremony 在玩家点"继续修行"关闭仪式后联动触发
//    时序：tierCeremony exit 220ms → shareCelebrate pending 1800ms buffer
// =========================================================================
function onRealmUp(g, opts) {
  const o = opts || {}
  const realmId = o.realmId || (o.curr && o.curr.id) || ''
  if (!realmId) return
  const prevName = (o.prevName || (o.prev && o.prev.name)) || '凡尘'
  const currName = (o.currName || (o.curr && o.curr.name)) || '新境'
  const data = { realmId, prevName, currName }
  const cheer = (LING.cheer.realmUp && LING.cheer.realmUp(currName))
    || `主人晋入「${currName}」～修为精进！`
  _celebrate(g, `realmUp_${realmId}`, cheer, 'realmUp', data)
}

module.exports = {
  onFirstPet,
  onStageFirstClear,
  onFirstSRating,
  onPetStarUp,
  onChapterComplete,
  onTowerNewBest,
  onComebackWin,
  onRealmUp,
}
