/**
 * 预设编队评分 — 基于五行克制给每套 teamPreset 对某关的"适配度"打分。
 *
 * 设计要点：
 *   · 纯数据计算，不依赖 UI，可被 stageInfoView / stageTeamView 复用。
 *   · 分数区间约 [-100, 100]；>= 阈值才给"推荐"角标，以免常态性泛红。
 *   · 每关结果缓存到 stageId 级别，玩家不换池/不换预设期间视图层逐帧调用也零开销。
 *
 * 克制矩阵沿用 tower.js 的 COUNTER_MAP / COUNTER_BY（与战斗实际一致）。
 *   · 我方克敌：score += SCORE_COUNTER
 *   · 我方被克：score += SCORE_COUNTERED（负分）
 *   · 同属性中性：0（不加不扣）
 */

const { COUNTER_MAP, COUNTER_BY } = require('../data/tower')
const { getPetById } = require('../data/pets')

// 推荐阈值：总得分 >= 此值才显示"推荐用这套"提示
const RECOMMEND_MIN_SCORE = 10
// 单属性命中奖励 / 扣分
const SCORE_COUNTER = 10
const SCORE_COUNTERED = -6
// 不满员惩罚（每少 1 只）
const PENALTY_PER_MISSING = 6
// Boss / 精英属性权重（关卡的第一波视为主属性，其它波视为小敌）
const WEIGHT_PRIMARY = 2
const WEIGHT_OTHER = 1

/**
 * 抽取关卡里所有敌人的属性及权重。
 * 返回: [{ attr, weight }]
 */
function _enemyAttrsWithWeight(stage) {
  if (!stage || !stage.waves || !stage.waves.length) return []
  const out = []
  // 第一波（通常是主敌/精英/Boss）权重更高
  for (let wi = 0; wi < stage.waves.length; wi++) {
    const wave = stage.waves[wi]
    const enemies = (wave && wave.enemies) || []
    const weight = wi === 0 ? WEIGHT_PRIMARY : WEIGHT_OTHER
    for (const e of enemies) {
      if (e && e.attr) out.push({ attr: e.attr, weight })
    }
  }
  return out
}

/**
 * 抽取编队里所有宠物属性集合（去重，仅用于"覆盖"判断）。
 */
function _presetAttrSet(preset) {
  const set = new Set()
  for (const pid of (preset && preset.petIds) || []) {
    const base = getPetById(pid)
    if (base && base.attr) set.add(base.attr)
  }
  return set
}

/**
 * 核心打分：输入 preset（含 petIds）+ stage，返回数值得分。
 *   · petIds 为空时返回一个明显的负分（远低于 RECOMMEND_MIN_SCORE），
 *     避免空预设也被当作"推荐"。
 */
function scorePresetForStage(preset, stage) {
  if (!preset || !Array.isArray(preset.petIds) || preset.petIds.length === 0) return -100
  const attrSet = _presetAttrSet(preset)
  const enemies = _enemyAttrsWithWeight(stage)
  let score = 0
  for (const { attr: ea, weight } of enemies) {
    // 只要队里有任意一只"克制该敌属性"的宠物，就算命中
    let hit = 0
    if (attrSet.has(COUNTER_BY[ea])) hit = SCORE_COUNTER
    else {
      // 没命中克制时，若队伍里有"被克制"的属性（= 打它反被反伤），记负分
      const counteredAttr = COUNTER_MAP[ea]
      if (counteredAttr && attrSet.has(counteredAttr)) hit = SCORE_COUNTERED
    }
    score += hit * weight
  }
  const targetSize = (stage && stage.teamSize && stage.teamSize.max) || preset.petIds.length
  const missing = Math.max(0, targetSize - preset.petIds.length)
  score -= missing * PENALTY_PER_MISSING
  return score
}

/**
 * 从多套预设中选出"对这关最合适"的一套。
 *   · 只考虑已解锁的预设（由调用方保证）
 *   · 只考虑非空预设；全空时返回 null
 *   · 分数相同时，优先返回"当前激活"的那套（减少抖动）
 *   · 分数都 < RECOMMEND_MIN_SCORE 时依然返回最高分的那套，
 *     但返回里带 recommended=false，UI 可据此决定要不要高亮。
 */
function pickBestPreset(presets, stage, activeId) {
  if (!Array.isArray(presets) || presets.length === 0 || !stage) return null
  let best = null
  let bestScore = -Infinity
  for (const p of presets) {
    if (p.locked) continue
    if (!Array.isArray(p.petIds) || p.petIds.length === 0) continue
    const s = scorePresetForStage(p, stage)
    const isActive = activeId && p.id === activeId
    if (
      s > bestScore ||
      (s === bestScore && isActive) // 同分优先当前激活，减少 UI 抖动
    ) {
      best = p
      bestScore = s
    }
  }
  if (!best) return null
  return { preset: best, score: bestScore, recommended: bestScore >= RECOMMEND_MIN_SCORE }
}

// ===== stageId 级缓存 =====
// 缓存 key = stageId + '|' + 预设摘要 + '|' + activeId，
// 只要玩家不动预设 / 不换关，视图层每帧调也无额外开销。
const _cache = new Map()

function _presetsDigest(presets, activeId) {
  // petIds + weaponId + locked 拼成短字符串即可识别变化
  return presets
    .map(p => `${p.id}:${p.locked ? 'L' : 'U'}:${(p.petIds || []).join(',')}:${p.weaponId || ''}`)
    .join('|') + '#' + (activeId || '')
}

/**
 * 带缓存的版本：UI 层优先用这个。
 */
function pickBestPresetCached(presets, stage, activeId) {
  if (!stage) return null
  const key = stage.id + '#' + _presetsDigest(presets || [], activeId)
  const cached = _cache.get(key)
  if (cached !== undefined) return cached
  const res = pickBestPreset(presets, stage, activeId)
  _cache.set(key, res)
  // 防止长期运行后缓存爆炸：超过 64 条做 LRU 清理
  if (_cache.size > 64) {
    const firstKey = _cache.keys().next().value
    _cache.delete(firstKey)
  }
  return res
}

/**
 * UI 需要时主动清空缓存（例如玩家回灵宠池做了升星，属性权重不变但池内可用 ID 变化后）。
 */
function clearPresetScoreCache() {
  _cache.clear()
}

module.exports = {
  scorePresetForStage,
  pickBestPreset,
  pickBestPresetCached,
  clearPresetScoreCache,
  RECOMMEND_MIN_SCORE,
}
