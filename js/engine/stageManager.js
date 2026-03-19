/**
 * 固定关卡管理 — 从编队到战斗到结算的完整生命周期
 *
 * startStage  — 初始化关卡战斗（扣体力、构建宠物、加载波次）
 * loadWave    — 加载指定波次敌人
 * advanceWave — 波间推进（波次+1 并重置回合）
 * settleStage — 胜利结算（碎片/经验/评价）
 * settleStageDefeat — 失败结算（部分经验）
 */

const { getStageById, RATING_ORDER } = require('../data/stages')
const { getPetById } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { effectValue } = require('../data/cultivationConfig')
const { initBoard } = require('./battle')
const MusicMgr = require('../runtime/music')
const { makeDefaultRunBuffs } = require('./runManager')

/**
 * 开始固定关卡战斗
 * @param {object} g - 游戏状态
 * @param {string} stageId - 关卡 ID
 * @param {string[]} teamPetIds - 编队灵宠 ID 列表
 * @returns {boolean} 是否成功启动
 */
function startStage(g, stageId, teamPetIds) {
  const stage = getStageById(stageId)
  if (!stage) return false
  if (teamPetIds.length < stage.teamSize.min) return false

  // 扣除体力
  g.storage.consumeStamina(stage.staminaCost)
  // 记录每日挑战次数
  g.storage.recordStageChallenge(stageId)

  g.battleMode = 'stage'
  g._stageId = stageId
  g._stageWaves = stage.waves
  g._stageWaveIdx = 0
  g._stageTotalTurns = 0
  g._stageTeam = teamPetIds.slice()

  // 从灵宠池构建战斗用宠物数组
  g.pets = teamPetIds.map(id => {
    const poolPet = g.storage.getPoolPet(id)
    const basePet = getPetById(id)
    if (!basePet || !poolPet) return null
    return {
      ...basePet,
      star: poolPet.star,
      atk: getPoolPetAtk(poolPet),
      currentCd: 0,
      _poolId: id,
    }
  }).filter(Boolean)

  // 基础属性初始化
  g.heroMaxHp = 100
  g.heroHp = 100
  g.heroShield = 0

  // 应用修炼加成
  const cult = g.storage.cultivation
  g.heroMaxHp += effectValue('body', cult.levels.body)
  g.heroHp = g.heroMaxHp
  g.heroShield = effectValue('sense', cult.levels.sense)
  g.dragTimeLimit = (8 + effectValue('wisdom', cult.levels.wisdom)) * 60
  g._cultDmgReduce = effectValue('defense', cult.levels.defense)
  g._cultHeartBase = effectValue('spirit', cult.levels.spirit)

  // 局内状态重置（清空肉鸽相关残留，确保两种模式完全隔离）
  g.weapon = null
  g.petBag = []
  g.weaponBag = []
  g.sessionPetPool = []
  g.runBuffs = makeDefaultRunBuffs()
  g.runBuffLog = []
  g.heroBuffs = []
  g.enemyBuffs = []
  g.skipNextBattle = false
  g.nextStunEnemy = false
  g.nextDmgDouble = false
  g.tempRevive = false
  g.immuneOnce = false
  g.comboNeverBreak = false
  g.weaponReviveUsed = false
  g.goodBeadsNextTurn = false
  g.adReviveUsed = false
  g.turnCount = 0
  g.combo = 0
  g.runTotalTurns = 0
  g.runExp = 0
  g._runElimExp = 0
  g._runComboExp = 0
  g._runKillExp = 0

  // 加载第一波敌人
  loadWave(g, 0)

  // 初始化棋盘
  initBoard(g)
  g.bState = 'playerTurn'
  g.setScene('battle')
  g.floor = 1
  g.cleared = false
  return true
}

/**
 * 加载指定波次的敌人
 */
function loadWave(g, waveIdx) {
  const wave = g._stageWaves[waveIdx]
  if (!wave) return
  const e = wave.enemies[0]
  // 若关卡敌人没有 avatar，按属性自动分配肉鸽怪物图
  const attrKeyMap = { metal:'m', wood:'w', earth:'e', water:'s', fire:'f' }
  const monKey = attrKeyMap[e.attr] || 'm'
  const monIdx = (waveIdx % 3) + 1
  const avatar = e.avatar || `enemies/mon_${monKey}_${monIdx}`
  g.enemy = {
    ...e,
    avatar,
    maxHp: e.hp,
    buffs: [],
  }
  g._stageWaveIdx = waveIdx
}

/**
 * 波间推进：累加回合数、加载下一波
 */
function advanceWave(g) {
  g._stageTotalTurns += g.turnCount
  const nextIdx = g._stageWaveIdx + 1
  loadWave(g, nextIdx)
  g.turnCount = 0
  g.heroBuffs = []
  g.enemyBuffs = []
  g.bState = 'playerTurn'
}

/**
 * 判断当前波是否为最后一波
 */
function isLastWave(g) {
  return g._stageWaveIdx >= g._stageWaves.length - 1
}

/**
 * 胜利结算
 */
function settleStage(g) {
  const stage = getStageById(g._stageId)
  if (!stage) return

  g._stageTotalTurns += g.turnCount
  const isFirstClear = !g.storage.isStageCleared(g._stageId)
  const rating = calculateRating(g._stageTotalTurns, stage.rating)
  const ratingMul = { S: 2.0, A: 1.5, B: 1.0 }[rating]

  // 碎片奖励
  const rewards = []
  if (isFirstClear && stage.rewards.firstClear) {
    stage.rewards.firstClear.forEach(r => {
      rewards.push(resolveReward(g, r))
    })
  }
  const fragRange = stage.rewards.repeatClear.fragments
  const fragCount = Math.ceil(_randomInt(fragRange.min, fragRange.max) * ratingMul)
  const fragTarget = pickFragmentTarget(g, fragRange.pool)
  if (fragTarget) {
    rewards.push({ type: 'fragment', petId: fragTarget, count: fragCount })
  }

  // 修炼经验
  const baseExp = stage.rewards.repeatClear.exp || 0
  let firstClearExpBonus = 0
  if (isFirstClear && stage.rewards.firstClear) {
    const fcExp = stage.rewards.firstClear.find(r => r.type === 'exp')
    firstClearExpBonus = fcExp ? fcExp.amount : 0
  }
  const clearBonus = Math.ceil(baseExp * ratingMul) + firstClearExpBonus
  const rawTotal = (g.runExp || 0) + clearBonus
  const prevLevel = g.storage.cultivation.level || 0
  const cultLevelUps = rawTotal > 0 ? g.storage.addCultExp(rawTotal) : 0

  // 宠物经验（进入共享经验池）
  const basePetExp = stage.rewards.repeatClear.petExp || 0
  let petExp = Math.ceil(basePetExp * ratingMul)
  if (isFirstClear && stage.rewards.firstClear) {
    const fcPet = stage.rewards.firstClear.find(r => r.type === 'petExp')
    if (fcPet) petExp += fcPet.amount
  }
  if (petExp > 0) g.storage.addPetExp(petExp)

  // 应用碎片奖励
  rewards.forEach(r => {
    if (r.type === 'fragment' && r.petId) {
      g.storage.addFragments(r.petId, r.count)
    }
  })

  // 记录通关
  g.storage.recordStageClear(g._stageId, rating, isFirstClear)

  g._stageResult = {
    stageId: g._stageId,
    stageName: stage.name,
    rating,
    isFirstClear,
    rewards,
    cultExp: rawTotal,
    cultLevelUps,
    cultPrevLevel: prevLevel,
    petExp,
    totalTurns: g._stageTotalTurns,
    victory: true,
  }

  g.setScene('stageResult')
}

/**
 * 失败结算 — 不给碎片，修炼经验 60%、宠物经验 50%
 */
function settleStageDefeat(g) {
  const stage = getStageById(g._stageId)
  if (!stage) return

  g._stageTotalTurns += g.turnCount

  // 修炼经验（保底 60%）
  const baseExp = stage.rewards.repeatClear.exp || 0
  const rawTotal = Math.floor(((g.runExp || 0) + baseExp) * 0.6)
  const prevLevel = g.storage.cultivation.level || 0
  const cultLevelUps = rawTotal > 0 ? g.storage.addCultExp(rawTotal) : 0

  // 宠物经验（50%）
  const basePetExp = stage.rewards.repeatClear.petExp || 0
  const petExp = Math.floor(basePetExp * 0.5)
  if (petExp > 0) g.storage.addPetExp(petExp)

  g._stageResult = {
    stageId: g._stageId,
    stageName: stage.name,
    rating: null,
    isFirstClear: false,
    rewards: [],
    cultExp: rawTotal,
    cultLevelUps,
    cultPrevLevel: prevLevel,
    petExp,
    totalTurns: g._stageTotalTurns,
    victory: false,
  }

  g.setScene('stageResult')
}

// ===== 工具函数 =====

function calculateRating(totalTurns, ratingConfig) {
  if (totalTurns <= ratingConfig.s) return 'S'
  if (totalTurns <= ratingConfig.a) return 'A'
  return 'B'
}

/**
 * 从灵宠池中选一个宠物给碎片（优先未满星）
 */
function pickFragmentTarget(g, poolScope) {
  const pool = g.storage.petPool
  if (pool.length === 0) return null
  let candidates = pool.filter(p => p.star < 3)
  if (candidates.length === 0) candidates = pool.slice()
  if (poolScope !== 'all') {
    // 按章节属性筛选候选（如果有匹配的话）
    const stage = getStageById(g._stageId)
    if (stage && stage.waves.length) {
      const stageAttr = stage.waves[0].enemies[0] && stage.waves[0].enemies[0].attr
      const attrFiltered = candidates.filter(p => p.attr === stageAttr)
      if (attrFiltered.length > 0) candidates = attrFiltered
    }
  }
  return candidates[Math.floor(Math.random() * candidates.length)].id
}

/**
 * 解析首通奖励中的随机目标
 */
function resolveReward(g, reward) {
  if (reward.type === 'fragment') {
    let petId = reward.target
    if (petId && petId.startsWith('random_')) {
      const attr = petId.replace('random_', '')
      const pool = g.storage.petPool
      let candidates = attr === 'all' ? pool.slice() : pool.filter(p => p.attr === attr)
      if (candidates.length === 0) candidates = pool.slice()
      if (candidates.length > 0) {
        petId = candidates[Math.floor(Math.random() * candidates.length)].id
      } else {
        petId = null
      }
    }
    return { type: 'fragment', petId, count: reward.count }
  }
  return { ...reward }
}

function _randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1))
}

module.exports = {
  startStage,
  loadWave,
  advanceWave,
  isLastWave,
  settleStage,
  settleStageDefeat,
  calculateRating,
}
