/**
 * 固定关卡管理 — 从编队到战斗到结算的完整生命周期
 *
 * startStage  — 初始化关卡战斗（预检查体力但不扣，构建宠物、加载波次）
 * loadWave    — 加载指定波次敌人
 * advanceWave — 波间推进（波次+1 并重置回合）
 * settleStage — 胜利结算（扣体力、碎片/经验/评价）
 * settleStageDefeat — 失败结算（扣体力、部分经验；UI 可看广告退还）
 */

const { getStageById, RATING_ORDER, getEffectiveStageTeamMin } = require('../data/stages')
const { getPetById, petHasSkill } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { effectValue, diffRealmUp } = require('../data/cultivationConfig')
const { STAR_REWARDS, CHAPTER_CLEAR_REWARDS, STAGE_SETTLE, STAGES_PER_CHAPTER } = require('../data/economyConfig')
const { getWeaponById, getWeaponRarity } = require('../data/weapons')
const { initBoard } = require('./battle')
const MusicMgr = require('../runtime/music')
const { makeDefaultRunBuffs } = require('./runManager')
const { NEWBIE_PET_IDS, NEWBIE_2STAR_IDS, NEWBIE_FREE_STAMINA_STAGES, NEWBIE_BEAD_ATTR_LIMIT, FIRST_CLEAR_STAMINA_BONUS, FIRST_CLEAR_SOULSTONE_BONUS, STAGE_MECHANIC_FOCUS } = require('../data/constants')
const V = require('../views/env')
const { RATING_TO_STARS, STAMINA_COST } = require('../data/balance/economy')
const { DUPLICATE_WEAPON_SOULSTONE } = require('../data/balance/stage')
const { NEWBIE_ENEMY_OVERRIDE } = require('../data/balance/enemy')
const { HERO_BASE_HP, DRAG_BASE_SEC, PET_CD_INIT_RATIO, PET_CD_INIT_OFFSET } = require('../data/balance/combat')

/** 秘境本关是否存在 Boss 波（如守关关第一波小怪、第二波才是真 Boss） */
function _stageHasBossWave(g) {
  if (g.battleMode !== 'stage' || !g._stageWaves || !g._stageWaves.length) return false
  return g._stageWaves.some(w => w.enemies && w.enemies[0] && w.enemies[0].isBoss)
}

/** 秘境本关是否正在/应使用 Boss BGM（含小怪先锋波） */
function _stageShouldUseBossBgm(g) {
  return !!(g.enemy && g.enemy.isBoss) || _stageHasBossWave(g)
}

/** 秘境 loadWave 不走 battle.enterBattle，需单独触发 Boss BGM 与入场演出 */
function _applyStageBossEncounter(g) {
  if (!g.enemy) return
  const realBoss = !!g.enemy.isBoss
  const bossBgm = _stageShouldUseBossBgm(g)
  if (!bossBgm) return
  // 守关第一波为小怪时也切换 Boss BGM；震屏与 ⚠ 提示仅在实际 Boss 上场时播放
  if (realBoss) {
    MusicMgr.playBoss()
    g.shakeT = 20
    g.shakeI = 6
    g._bossEntrance = 30
    g._comboFlash = 15
    if (!g.skillEffects) g.skillEffects = []
    g.skillEffects.push({
      x: V.W * 0.5, y: V.H * 0.35,
      text: '⚠ BOSS ⚠', color: '#ff4040', t: 0, alpha: 1, scale: 3.0, _initScale: 3.0, big: true,
    })
  }
  MusicMgr.playBossBgm()
}

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
  if (teamPetIds.length < getEffectiveStageTeamMin(g.storage, stage)) return false

  // 体力在结算时扣除（胜利 / 失败均扣，退出不扣）
  g._stageStaminaCost = stage.staminaCost ?? STAMINA_COST
  // 记录每日挑战次数
  g.storage.recordStageChallenge(stageId)

  g.battleMode = 'stage'
  g._stageId = stageId
  g._stageWaves = stage.waves
  g._stageWaveIdx = 0
  g._stageTotalTurns = 0
  g._stageSettlePending = false
  g._stageTeam = teamPetIds.slice()

  // 从灵宠池构建战斗用宠物数组
  const dexBuffs = g.storage.getDexBuffs()
  g.pets = teamPetIds.map(id => {
    const poolPet = g.storage.getPoolPet(id)
    const basePet = getPetById(id)
    if (!basePet || !poolPet) return null
    return {
      ...basePet,
      star: poolPet.star,
      atk: getPoolPetAtk(poolPet, dexBuffs),
      currentCd: petHasSkill({ ...basePet, star: poolPet.star }) ? Math.max(0, Math.ceil(basePet.cd * PET_CD_INIT_RATIO) - PET_CD_INIT_OFFSET) : 0,
      _poolId: id,
    }
  }).filter(Boolean)

  // 基础属性初始化
  g.heroMaxHp = HERO_BASE_HP
  g.heroHp = HERO_BASE_HP
  g.heroShield = 0

  // 应用修炼加成
  const cult = g.storage.cultivation
  g.heroMaxHp += effectValue('body', cult.levels.body)
  g.heroHp = g.heroMaxHp
  // 逆风翻盘追踪：记录本关战斗中血量曾跌到的最低比值（1 = 未扣过血）
  // 在 battleHelpers.dealDmgToHero 里每次扣血后更新，结算时写入 result.heroMinHpRatio
  g._heroMinHpRatio = 1
  g.heroShield = effectValue('sense', cult.levels.sense)
  g.dragTimeLimit = (DRAG_BASE_SEC + effectValue('wisdom', cult.levels.wisdom)) * 60
  g._cultDmgReduce = effectValue('defense', cult.levels.defense)
  g._cultHeartBase = effectValue('spirit', cult.levels.spirit)

  // 加载玩家装备的法宝（固定关卡持久化装备）
  const eqId = g.storage.equippedWeaponId
  g.weapon = eqId ? { ...getWeaponById(eqId) } : null
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
  g.itemResetObtained = false
  g.itemResetUsed = false
  g.itemHealObtained = false
  g.itemHealUsed = false
  g._showItemMenu = false
  g._itemMenuRects = null
  g._itemObtainCooldown = 0
  g.turnCount = 0
  g.combo = 0
  g.runTotalTurns = 0
  g.runExp = 0
  g._runElimExp = 0
  g._runComboExp = 0
  g._runKillExp = 0

  g._isNewbieStage = false
  g._stageBeadAttrLimit = NEWBIE_BEAD_ATTR_LIMIT[stageId] || 0

  // 技巧聚焦 & 挑战目标（第 1 章）
  const mf = STAGE_MECHANIC_FOCUS[stageId]
  g._mechanicFocus = mf || null
  g._mechanicTriggered = false
  g._challengeDone = false
  g._challengeProgress = 0
  g._challengeDoneAnimT = null
  g._challengeDoneJustFired = false
  g._maxCombo = 0
  g._stageRatingS = stage.rating ? stage.rating.s : 0

  // 加载第一波敌人
  loadWave(g, 0)

  // 初始化棋盘
  initBoard(g)

  // 技巧聚焦开场提示：分两级
  //   L1 · 阻塞讲解卡（小灵讲堂）：1-2 / 1-3 首通前的新机制，等玩家主动点击确认
  //   L2 · 非阻塞横条（_mechanicOpenTip）：1-4 ~ 1-8，自动淡出，不打断节奏
  // 首通后两者都不再弹，避免老玩家被反复提示。
  const teachCards = require('../data/lingIdentity').LING.teach.stageCards
  const cardCfg = teachCards[stageId]
  const isFirstClear = !g.storage.isStageCleared(stageId)
  if (cardCfg && isFirstClear) {
    g._stageIntroCard = { stageId, animT: 0, armed: false }
  } else if (mf && mf.openTip && isFirstClear) {
    g._mechanicOpenTip = { stageId, timer: 0 }
  }

  g.bState = 'playerTurn'
  g.setScene('battle')
  g.floor = 1
  g.cleared = false
  return true
}

/**
 * 新手零宠物时专用：跳过编队，自动分配临时宠物，直接进入战斗
 * 体力在结算时扣除
 */
function startStageNewbie(g, stageId) {
  const stage = getStageById(stageId)
  if (!stage) return false

  g._stageStaminaCost = stage.staminaCost ?? STAMINA_COST
  g.storage.recordStageChallenge(stageId)

  g.battleMode = 'stage'
  g._stageId = stageId
  g._stageWaves = stage.waves
  g._stageWaveIdx = 0
  g._stageTotalTurns = 0
  g._stageSettlePending = false
  g._stageTeam = NEWBIE_PET_IDS.slice()

  // 构建临时宠物（不来自灵宠池，仅本局使用）
  g.pets = NEWBIE_PET_IDS.map(id => {
    const basePet = getPetById(id)
    if (!basePet) return null
    return { ...basePet, star: 1, atk: basePet.atk || 10, currentCd: 0, _temp: true }
  }).filter(Boolean)

  g.heroMaxHp = HERO_BASE_HP
  g.heroHp = HERO_BASE_HP
  g.heroShield = 0

  const cult = g.storage.cultivation
  g.heroMaxHp += effectValue('body', cult.levels.body)
  g.heroHp = g.heroMaxHp
  // 逆风翻盘追踪：记录本关战斗中血量曾跌到的最低比值（1 = 未扣过血）
  // 在 battleHelpers.dealDmgToHero 里每次扣血后更新，结算时写入 result.heroMinHpRatio
  g._heroMinHpRatio = 1
  g.heroShield = effectValue('sense', cult.levels.sense)
  g.dragTimeLimit = (DRAG_BASE_SEC + effectValue('wisdom', cult.levels.wisdom)) * 60
  g._cultDmgReduce = effectValue('defense', cult.levels.defense)
  g._cultHeartBase = effectValue('spirit', cult.levels.spirit)

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
  g.itemResetObtained = false
  g.itemResetUsed = false
  g.itemHealObtained = false
  g.itemHealUsed = false
  g._showItemMenu = false
  g._itemMenuRects = null
  g._itemObtainCooldown = 0
  g.turnCount = 0
  g.combo = 0
  g.runTotalTurns = 0
  g.runExp = 0
  g._runElimExp = 0
  g._runComboExp = 0
  g._runKillExp = 0

  loadWave(g, 0)

  // 新手模式弱化敌人：确保临时队伍可在数回合内通关
  if (g.enemy) {
    g.enemy.hp = NEWBIE_ENEMY_OVERRIDE.hp; g.enemy.maxHp = NEWBIE_ENEMY_OVERRIDE.hp
    g.enemy.atk = NEWBIE_ENEMY_OVERRIDE.atk; g.enemy.def = NEWBIE_ENEMY_OVERRIDE.def
  }

  g._isNewbieStage = true
  g._stageBeadAttrLimit = NEWBIE_BEAD_ATTR_LIMIT[stageId] || 0
  g._mechanicFocus = null
  g._mechanicTriggered = false
  g._challengeDone = false
  g._challengeProgress = 0
  g._challengeDoneAnimT = null
  g._challengeDoneJustFired = false
  g._maxCombo = 0
  g._stageRatingS = 0
  initBoard(g)
  g.bState = 'playerTurn'

  // 跳过宠物介绍卡，直接进入简化教学
  g._pendingStageTutorial = false
  const tut = require('./tutorial')
  if (tut.startStageTutorial) tut.startStageTutorial(g)

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
  _applyStageBossEncounter(g)
}

/**
 * 波间推进：累加回合数、加载下一波
 */
function advanceWave(g) {
  g._stageSettlePending = false
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

  // 新手前 3 关免体力
  if (!NEWBIE_FREE_STAMINA_STAGES.includes(g._stageId)) {
    g.storage.consumeStamina(g._stageStaminaCost ?? stage.staminaCost ?? STAMINA_COST)
  }

  if (_stageShouldUseBossBgm(g)) MusicMgr.resumeNormalBgm()

  // 将本局实际出战阵容写入持久化，进入下一关时 stageInfo / 编队页可延续
  if (!g._isNewbieStage && g._stageTeam && g._stageTeam.length > 0) {
    g.storage.saveStageteam(g._stageTeam)
  }

  g._stageTotalTurns += g.turnCount
  const isFirstClear = !g.storage.isStageCleared(g._stageId)
  const rating = calculateRating(g._stageTotalTurns, stage.rating)
  const ratingMul = STAGE_SETTLE.ratingMul[rating] || 1.0
  const starCount = RATING_TO_STARS[rating] || 1

  // ---- 基础奖励（首通 + 周回） ----
  const rewards = []
  // 新手 1-1：入池教学宠物；仅 NEWBIE_2STAR_IDS 为 ★2（有技能），其余 ★1（需升星解锁技能）
  if (g._isNewbieStage && isFirstClear) {
    NEWBIE_PET_IDS.forEach(petId => {
      const added = g.storage.addToPetPool(petId, 'stage')
      if (added) {
        if (NEWBIE_2STAR_IDS.includes(petId)) g.storage.setPoolPetStar(petId, 2)
        rewards.push({ type: 'pet', petId })
        // 合并 toast 队列：回首页时统一提示
        if (!g._newbiePetsObtained) g._newbiePetsObtained = []
        const petBase = getPetById(petId)
        if (petBase) g._newbiePetsObtained.push(petBase.name)
      }
    })
  }
  if (isFirstClear && stage.rewards.firstClear) {
    stage.rewards.firstClear.forEach(r => {
      rewards.push(resolveReward(g, r))
    })
  }

  // 第一章前 3 关首通掉法宝时自动装备：1-1 后天机镜要出现在 1-2 战场左侧栏（跳过编队的新手流程）
  if (isFirstClear && g.battleMode === 'stage' && stage.chapter === 1 && stage.order <= 3) {
    const wNew = rewards.find(r => r.type === 'weapon' && r.weaponId && r.isNew)
    if (wNew) {
      g.storage.equipWeapon(wNew.weaponId)
      // 首次获得法宝：toast 提示 + 触发 weapon_equip 引导
      if (!g.storage.isGuideShown('weapon_equip')) {
        const P = require('../platform')
        const wInfo = getWeaponById(wNew.weaponId)
        const wName = (wInfo && wInfo.name) || '法宝'
        if (P.showGameToast) P.showGameToast(`获得法宝「${wName}」，已自动装备`, { type: 'achievement' })
        // 引导等结算关闭后再触发，挂到 pendingGuide
        g._pendingGuide = 'weapon_equip'
      }
    }
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
  // 境界跨档判定（改用 diffRealmUp 直接比较本关 prev/curr level 差）：
  //   · 关键：不再依赖 storage.checkCultRealmUp() 的返回值，避免 lastCultRealmId
  //     flag 领先于当前 cultLv 时（GM 调试 / 经验回退 / 数据迁移对齐等）
  //     本关真实跨档却被判为 null，导致 tierCeremony / realmUp 炫耀卡全哑火。
  //   · storage.checkCultRealmUp() 仍然调用一次，纯粹为了 mark lastCultRealmId，
  //     防止同一次跨档被其它入口（cultivationView.checkRealmBreak）重复通知。
  const newLevel = g.storage.cultivation.level || 0
  const cultRealmUp = cultLevelUps > 0 ? diffRealmUp(prevLevel, newLevel) : null
  if (cultLevelUps > 0) g.storage.checkCultRealmUp()
  // 小阶跨档：回主菜单时由小灵横条再提一次（大境界走全屏 tierCeremony 不重复）
  if (cultRealmUp && cultRealmUp.kind === 'minor') {
    g._pendingRealmLingCheer = cultRealmUp.curr.fullName
  }

  // 灵石（周回 + 首通基础）
  const baseSoulStone = stage.rewards.repeatClear.soulStone || 0
  let soulStone = Math.ceil(baseSoulStone * ratingMul)
  if (isFirstClear && stage.rewards.firstClear) {
    const fcSS = stage.rewards.firstClear.find(r => r.type === 'soulStone')
    if (fcSS) soulStone += fcSS.amount
  }
  const duplicateWeaponSoulStone = rewards
    .filter(r => r.type === 'weapon' && r.weaponId && r.dupeSoulStone)
    .reduce((sum, r) => sum + (r.dupeSoulStone || 0), 0)
  soulStone += duplicateWeaponSoulStone

  // ---- 星级首次达成奖励 ----
  const prevClaimed = g.storage.getStageStarsClaimed(g._stageId)
  const newStars = []
  let starSoulStone = 0
  let starAwakenStone = 0
  const starFragments = []
  const chIdx = stage.order - 1
  const starCfg = STAR_REWARDS[stage.chapter] && STAR_REWARDS[stage.chapter][chIdx]

  if (starCfg) {
    // 1★ 标记（跟随 firstClear 自动领取）
    if (!prevClaimed[0] && starCount >= 1) {
      g.storage.claimStageStar(g._stageId, 0)
      newStars.push(1)
    }
    // 2★ 增量奖励
    if (!prevClaimed[1] && starCount >= 2) {
      const r2 = starCfg.star2
      starSoulStone += r2.soulStone || 0
      if (r2.fragment) starFragments.push({ count: r2.fragment })
      if (r2.awakenStone) starAwakenStone += r2.awakenStone
      g.storage.claimStageStar(g._stageId, 1)
      newStars.push(2)
    }
    // 3★ 增量奖励
    if (!prevClaimed[2] && starCount >= 3) {
      const r3 = starCfg.star3
      starSoulStone += r3.soulStone || 0
      if (r3.fragment) starFragments.push({ count: r3.fragment })
      if (r3.awakenStone) starAwakenStone += r3.awakenStone
      g.storage.claimStageStar(g._stageId, 2)
      newStars.push(3)
    }
  }

  // 发放星级奖励
  soulStone += starSoulStone
  if (soulStone > 0) g.storage.addSoulStone(soulStone)
  if (starAwakenStone > 0) g.storage.addAwakenStone(starAwakenStone)
  starFragments.forEach(sf => {
    const target = pickFragmentTarget(g, 'all')
    if (target) {
      g.storage.addFragments(target, sf.count)
      rewards.push({ type: 'fragment', petId: target, count: sf.count, fromStar: true })
    }
  })

  // 应用基础碎片奖励
  rewards.forEach(r => {
    if (r.type === 'fragment' && r.petId && !r.wasPet && !r.fromStar) {
      g.storage.addFragments(r.petId, r.count)
    }
  })

  // 记录通关（更新 bestRating 等）
  g.storage.recordStageClear(g._stageId, rating, isFirstClear)

  // ---- 首通里程碑体力赠送 ----
  const firstClearStamina = isFirstClear ? (FIRST_CLEAR_STAMINA_BONUS[g._stageId] || 0) : 0
  if (firstClearStamina > 0) g.storage.noticeStaminaOverflow(g.storage.addBonusStamina(firstClearStamina))

  // ---- 首通里程碑灵石赠送 ----
  const firstClearSS = isFirstClear ? (FIRST_CLEAR_SOULSTONE_BONUS[g._stageId] || 0) : 0
  if (firstClearSS > 0) g.storage.addSoulStone(firstClearSS)

  // ---- 章节通关宝箱检查 ----
  let chapterClearReward = null
  if (isFirstClear) {
    const { getChapterStages } = require('../data/stages')
    const chStages = getChapterStages(stage.chapter, 'normal')
    const allCleared = chStages.length >= STAGES_PER_CHAPTER &&
      chStages.every(s => g.storage.isStageCleared(s.id))
    if (allCleared && !g.storage.isChapterClearClaimed(stage.chapter)) {
      const cr = CHAPTER_CLEAR_REWARDS[stage.chapter]
      if (cr) {
        if (cr.soulStone) g.storage.addSoulStone(cr.soulStone)
        if (cr.awakenStone) g.storage.addAwakenStone(cr.awakenStone)
        if (cr.stamina) g.storage.noticeStaminaOverflow(g.storage.addBonusStamina(cr.stamina))
        if (cr.fragment) {
          const target = pickFragmentTarget(g, 'all')
          if (target) g.storage.addFragments(target, cr.fragment)
        }
        g.storage.claimChapterClear(stage.chapter)
        chapterClearReward = { ...cr }
      }
    }
  }

  // ---- 章节星级里程碑检查（8★/16★/24★）+ 章节徽章 ----
  // 设计见 plan B/C 节：
  //   · 本关实际获得的新增星数 = newStars.length（来自上文 "星级首次达成" 统计）
  //   · 跨过 8/16/24 阈值时，按 chapterMilestoneConfig 发奖，并 mark claimed
  //   · 24★ 章节全 3★ 时，额外解锁章节徽章（仅一次）
  //   · 老玩家"不补发"：只有本关新获得的星数才计入"跨阈值"判定（currStars - prevStars）
  //   · 保底券用 addWeaponWildcardTickets 入库，UI 在结算页/首页提示去保底券兑换页使用
  const chapterMilestones = _settleChapterMilestones(g, stage.chapter, newStars.length)
  let chapterBadgeUnlocked = false
  if (chapterMilestones && chapterMilestones.some(m => m.tier === 24)) {
    if (g.storage.unlockChapterBadge(stage.chapter)) {
      chapterBadgeUnlocked = true
    }
  }

  // 碎片奖励总计（供广告翻倍使用）
  const totalFragCount = rewards.filter(r => r.type === 'fragment' && !r.fromStar).reduce((s, r) => s + (r.count || 0), 0)

  // S 评级挑战（结算时判定）
  if (g._mechanicFocus && g._mechanicFocus.challenge && g._mechanicFocus.challenge.type === 'sRating' && rating === 'S') {
    g._challengeDone = true
  }
  // 挑战奖励发放
  let challengeRewardSS = 0
  if (g._challengeDone && g._mechanicFocus && g._mechanicFocus.challenge && g._mechanicFocus.challenge.rewardSoulStone) {
    challengeRewardSS = g._mechanicFocus.challenge.rewardSoulStone
    g.storage.addSoulStone(challengeRewardSS)
  }

  g._stageResult = {
    stageId: g._stageId,
    stageName: stage.name,
    rating,
    starCount,
    isFirstClear,
    rewards,
    cultExp: rawTotal,
    cultLevelUps,
    cultPrevLevel: prevLevel,
    cultRealmUp,
    soulStone: soulStone + challengeRewardSS,
    totalTurns: g._stageTotalTurns,
    victory: true,
    newStars,
    starBonusSoulStone: starSoulStone,
    starBonusAwakenStone: starAwakenStone,
    starBonusFragments: starFragments.reduce((s, f) => s + f.count, 0),
    chapterClearReward,
    chapterMilestones: chapterMilestones || [],
    chapterBadgeUnlocked,
    firstClearStamina,
    firstClearSoulStone: firstClearSS,
    isBossStage: stage.order === 8,
    totalFragCount,
    duplicateWeaponSoulStone,
    maxCombo: g._maxCombo || 0,
    challengeDone: !!(g._challengeDone),
    challengeDesc: (g._mechanicFocus && g._mechanicFocus.challenge) ? g._mechanicFocus.challenge.desc : null,
    challengeRewardSS,
    // 逆风翻盘判定：本关战斗中血量曾跌到的最低比值（1 = 全程未扣血）
    // stageResultView 据此判 hpPct <= 10% 触发 shareHooks.onComebackWin
    heroMinHpRatio: typeof g._heroMinHpRatio === 'number' ? g._heroMinHpRatio : 1,
  }

  if (g.storage.userAuthorized) {
    g.storage.submitStageRanking()
    g.storage.submitDexAndCombo()
  }

  g.setScene('stageResult')
}

/**
 * 失败结算 — 不给碎片，修炼经验 60%、灵石 50%
 * 扣体力，但 UI 可通过看广告退还
 */
function settleStageDefeat(g) {
  const stage = getStageById(g._stageId)
  if (!stage) return

  // 失败扣体力（新手前 3 关免扣；其余可看广告退还）
  const staminaCost = g._stageStaminaCost ?? stage.staminaCost ?? STAMINA_COST
  if (!NEWBIE_FREE_STAMINA_STAGES.includes(g._stageId)) {
    g.storage.consumeStamina(staminaCost)
  }

  if (_stageShouldUseBossBgm(g)) MusicMgr.resumeNormalBgm()

  g._stageTotalTurns += g.turnCount

  const baseExp = stage.rewards.repeatClear.exp || 0
  const rawTotal = Math.floor(((g.runExp || 0) + baseExp) * STAGE_SETTLE.defeatExpRatio)
  const prevLevel = g.storage.cultivation.level || 0
  const cultLevelUps = rawTotal > 0 ? g.storage.addCultExp(rawTotal) : 0
  // 境界跨档判定（同 settleStage 胜利分支：用本关 prev/curr level 差，避免 flag 领先哑火）
  const newLevel = g.storage.cultivation.level || 0
  const cultRealmUp = cultLevelUps > 0 ? diffRealmUp(prevLevel, newLevel) : null
  if (cultLevelUps > 0) g.storage.checkCultRealmUp()
  if (cultRealmUp && cultRealmUp.kind === 'minor') {
    g._pendingRealmLingCheer = cultRealmUp.curr.fullName
  }

  const baseSoulStone = stage.rewards.repeatClear.soulStone || 0
  const soulStone = Math.floor(baseSoulStone * STAGE_SETTLE.defeatSSRatio)
  if (soulStone > 0) g.storage.addSoulStone(soulStone)

  g._stageResult = {
    stageId: g._stageId,
    stageName: stage.name,
    rating: null,
    isFirstClear: false,
    rewards: [],
    cultExp: rawTotal,
    cultLevelUps,
    cultPrevLevel: prevLevel,
    cultRealmUp,
    soulStone,
    totalTurns: g._stageTotalTurns,
    victory: false,
    staminaCost,
    enemyHp: g.enemy ? g.enemy.hp : 0,
    enemyMaxHp: g.enemy ? g.enemy.maxHp : 0,
    enemyName: g.enemy ? g.enemy.name : '',
    enemyAttr: g.enemy ? g.enemy.attr : '',
    enemyAvatar: g.enemy ? g.enemy.avatar : '',
    waveIdx: g._stageWaveIdx || 0,
    waveTotal: g._stageWaves ? g._stageWaves.length : 1,
    teamSnapshot: (g.pets || []).map(p => ({
      id: p.id, name: p.name, attr: p.attr,
      atk: p.atk, star: p.star,
    })),
    cultLevel: g.storage.cultivation.level || 0,
  }

  g.setScene('stageResult')
}

// ===== 工具函数 =====

/**
 * 章节星级里程碑结算 — 在本关结算末尾调用
 *
 * @param g                - 游戏状态
 * @param chapterId        - 章节 id
 * @param newStarsThisCell - 本关本次结算"新拿的星数"（0~3，来自 newStars.length）
 * @returns {Array}        - 跨过的里程碑数组 [{ tier, rewards: [...resolved] }]，未跨档返回 []
 *
 * 设计要点（见 plan 四节 / 3.3 节）：
 *   1. 只看"跨阈值"而不是"等于阈值"，避免老玩家存档中已有 10★ 但未领"8★"档的盲区
 *      （对新玩家：严格按累计；对老玩家：v23→v24 迁移后 claim 字典清空，任何新获星都触发阈值检查）
 *   2. 每档奖励**一次性发放**，并立即 mark claimed，避免同场景重复触发
 *   3. SSR 碎片：章节代表 SSR 宠物；池里无该宠时走 addFragmentSmart（写入 fragmentBank 或入池）
 *   4. 返回"已领取档位数组"供结算页做大奖卡片展示
 */
function _settleChapterMilestones(g, chapterId, newStarsThisCell) {
  if (!newStarsThisCell || newStarsThisCell <= 0) return []

  const { MILESTONE_TIERS, getChapterMilestoneReward, getChapterSsrPetId } = require('../data/chapterMilestoneConfig')
  const currStars = g.storage.getChapterTotalStars(chapterId, 'normal')
  const prevStars = Math.max(0, currStars - newStarsThisCell)

  const crossed = []
  for (const tier of MILESTONE_TIERS) {
    // 跨过阈值：prev < tier <= curr
    if (prevStars < tier && currStars >= tier && !g.storage.isChapterMilestoneClaimed(chapterId, tier)) {
      const baseRewards = getChapterMilestoneReward(chapterId, tier)
      const resolved = _grantChapterMilestoneRewards(g, chapterId, baseRewards)
      g.storage.markChapterMilestoneClaimed(chapterId, tier)
      crossed.push({ tier, rewards: resolved })
    }
  }
  return crossed
}

/**
 * 随机发放一件未拥有的 SSR 法宝
 *
 * 返回发放成功的 weapon 对象 { id, name, ... }，失败（已拥有全部）返回 null。
 * 幂等要求：调用方需判断 null 走兜底分支。
 */
function _grantRandomSsrWeapon(g) {
  const { WEAPON_RARITY, getWeaponById } = require('../data/weapons')
  const ssrIds = WEAPON_RARITY.SSR || []
  const pool = ssrIds.filter(id => !g.storage.hasWeapon(id))
  if (pool.length === 0) return null
  const pickedId = pool[Math.floor(Math.random() * pool.length)]
  const added = g.storage.addWeapon(pickedId)
  if (!added) return null
  return getWeaponById(pickedId)
}

/**
 * 发放单个里程碑档位的奖励条目
 * 返回 UI 可直接渲染的 rewards 数组（含解析后的 petId 等）
 */
function _grantChapterMilestoneRewards(g, chapterId, rewards) {
  const { getChapterSsrPetId } = require('../data/chapterMilestoneConfig')
  const resolved = []
  for (const r of rewards) {
    if (r.type === 'soulStone') {
      g.storage.addSoulStone(r.amount)
      resolved.push({ type: 'soulStone', amount: r.amount })
    } else if (r.type === 'awakenStone') {
      g.storage.addAwakenStone(r.amount)
      resolved.push({ type: 'awakenStone', amount: r.amount })
    } else if (r.type === 'universalFragment') {
      // 万能碎片：不走 target，直接增量
      if (typeof g.storage.addUniversalFragment === 'function') {
        g.storage.addUniversalFragment(r.count)
      } else {
        // 兼容：直接写 _d（极少数老分支没有 addUniversalFragment 时）
        g.storage._d.universalFragment = (g.storage._d.universalFragment || 0) + r.count
        g.storage._save && g.storage._save()
      }
      resolved.push({ type: 'universalFragment', count: r.count })
    } else if (r.type === 'ssrFragment') {
      const petId = getChapterSsrPetId(chapterId)
      // addFragmentSmart：池里有则 addFragments，没有则写 fragmentBank，避免新手章节里程碑白给
      g.storage.addFragmentSmart(petId, r.count)
      resolved.push({ type: 'fragment', petId, count: r.count, fromChapterMilestone: true })
    } else if (r.type === 'ssrWeapon') {
      // 直接发放一件未拥有的 SSR 法宝（替代旧 weaponTicket）
      //   · 玩家反馈"券要去兑换页选，关了就找不到"，UX 太绕
      //   · 改为当场随机发放；全 11 件已拥有时走兜底：60 万能碎片（≈ 1 件 SSR 价值）
      const granted = _grantRandomSsrWeapon(g)
      if (granted) {
        resolved.push({ type: 'ssrWeapon', weaponId: granted.id, weaponName: granted.name })
      } else {
        // 兜底：60 万能碎片（约等价于 1 件 SSR 法宝的抽卡成本）
        const fallback = 60
        if (typeof g.storage.addUniversalFragment === 'function') {
          g.storage.addUniversalFragment(fallback)
        } else {
          g.storage._d.universalFragment = (g.storage._d.universalFragment || 0) + fallback
          g.storage._save && g.storage._save()
        }
        resolved.push({ type: 'universalFragment', count: fallback, fromSsrWeaponFallback: true })
      }
    } else if (r.type === 'weaponTicket') {
      // 历史兼容：老存档曾通过 v1 配置生成过 weaponTicket 奖励，这里只保留发放链路
      //   · 新配置已不再使用此 type（见 chapterMilestoneConfig.js），可在下个大版本彻底删除
      g.storage.addWeaponWildcardTickets(r.count)
      resolved.push({ type: 'weaponTicket', count: r.count })
    } else {
      // 未知类型：透传，方便以后加新奖励种类不破坏老版本
      resolved.push({ ...r })
    }
  }
  return resolved
}

/**
 * 手动领取某章某档里程碑奖励（章节主线页"领取"按钮使用）
 *
 * 设计要点：
 *   · 原有链路只有"通关战斗结算时自动发奖"一条（_settleChapterMilestones）
 *   · 老玩家在上线前已通关全章，但新存档字段 chapterStarMilestones 里没有记录 → 无法直接领取
 *   · 本函数把"发奖 + mark claimed"打包成可单独触发的接口，给 chapterMapView 调用
 *
 * 幂等保证：
 *   · currStars < tier → 返回 null（未达成不领）
 *   · 已领取 → 返回 null（不重复发）
 *
 * @returns { tier, rewards: [...] } | null
 */
function grantChapterMilestoneManually(g, chapterId, tier) {
  const { getChapterMilestoneReward } = require('../data/chapterMilestoneConfig')
  const currStars = g.storage.getChapterTotalStars(chapterId, 'normal')
  if (currStars < tier) return null
  if (g.storage.isChapterMilestoneClaimed(chapterId, tier)) return null
  const baseRewards = getChapterMilestoneReward(chapterId, tier)
  if (!baseRewards || !baseRewards.length) return null
  const resolved = _grantChapterMilestoneRewards(g, chapterId, baseRewards)
  g.storage.markChapterMilestoneClaimed(chapterId, tier)
  // 若三档全部领完 → 同步解锁章节徽章（和自动通关路径保持一致）
  if (tier === 24 && !g.storage.isChapterBadgeUnlocked(chapterId)) {
    g.storage.unlockChapterBadge(chapterId)
  }
  return { tier, rewards: resolved }
}

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
  const _maybeTrackNewbiePet = (petId) => {
    // 仅在新手流程（第 1 章前 3 关）记录入池宠物名，供首页合并 toast
    if (!g.storage.isStageCleared('stage_1_3')) {
      if (!g._newbiePetsObtained) g._newbiePetsObtained = []
      const petBase = getPetById(petId)
      if (petBase && !g._newbiePetsObtained.includes(petBase.name)) {
        g._newbiePetsObtained.push(petBase.name)
      }
    }
  }
  if (reward.type === 'pet') {
    const petId = reward.petId
    const inPool = g.storage.petPool.find(p => p.id === petId)
    if (inPool) {
      const fragCount = reward.fragCount || 5
      g.storage.addFragmentSmart(petId, fragCount)
      return { type: 'fragment', petId, count: fragCount, wasPet: true }
    }
    g.storage.addToPetPool(petId, 'stage')
    _maybeTrackNewbiePet(petId)
    return { type: 'pet', petId }
  }
  if (reward.type === 'randomPet') {
    const { rollRandomPet, FIRST_CLEAR_FRAG_COUNT } = require('../data/dropRoller')
    const { petId, rarity } = rollRandomPet(reward.chapter, reward.order, reward.difficulty)
    const inPool = g.storage.petPool.find(p => p.id === petId)
    if (inPool) {
      const fragCount = FIRST_CLEAR_FRAG_COUNT[rarity] || FIRST_CLEAR_FRAG_COUNT.R
      g.storage.addFragmentSmart(petId, fragCount)
      return { type: 'fragment', petId, count: fragCount, wasPet: true }
    }
    g.storage.addToPetPool(petId, 'stage')
    _maybeTrackNewbiePet(petId)
    return { type: 'pet', petId }
  }
  if (reward.type === 'weapon') {
    const weaponId = reward.weaponId
    const isNew = g.storage.addWeapon(weaponId)
    if (!isNew) {
      const rarity = getWeaponRarity(weaponId) || 'R'
      const dupeSoulStone = DUPLICATE_WEAPON_SOULSTONE[rarity] || DUPLICATE_WEAPON_SOULSTONE.R || 0
      return { type: 'weapon', weaponId, isNew, wasDuplicate: dupeSoulStone > 0, dupeSoulStone }
    }
    return { type: 'weapon', weaponId, isNew }
  }
  if (reward.type === 'randomWeapon') {
    const { rollRandomWeapon } = require('../data/dropRoller')
    const { weaponId } = rollRandomWeapon(reward.chapter, reward.order, reward.difficulty)
    const isNew = g.storage.addWeapon(weaponId)
    if (!isNew) {
      const rarity = getWeaponRarity(weaponId) || 'R'
      const dupeSoulStone = DUPLICATE_WEAPON_SOULSTONE[rarity] || DUPLICATE_WEAPON_SOULSTONE.R || 0
      return { type: 'weapon', weaponId, isNew, wasDuplicate: dupeSoulStone > 0, dupeSoulStone }
    }
    return { type: 'weapon', weaponId, isNew }
  }
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
  startStageNewbie,
  loadWave,
  advanceWave,
  isLastWave,
  settleStage,
  settleStageDefeat,
  calculateRating,
  grantChapterMilestoneManually,
}
