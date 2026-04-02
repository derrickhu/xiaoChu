/**
 * Run管理模块 — Roguelike局内生命周期管理
 * 从 main.js 提取：_startRun, _nextFloor, _restoreBattleHpMax, _endRun, _saveAndExit, _resumeRun
 */
const P = require('../platform')
const { TH } = require('../render')

// 经验相关字段键名（统一管理，避免序列化/反序列化遗漏）
const EXP_FIELDS = ['runExp', '_runElimExp', '_runComboExp', '_runKillExp']
const {
  EVENT_TYPE, ADVENTURES, MAX_FLOOR,
  generateFloorEvent, getRealmInfo,
} = require('../data/tower')
const { generateStarterPets, generateSessionPetPool, PETS, getPetById, petHasSkill } = require('../data/pets')
const { generateStarterWeapon, getWeaponById } = require('../data/weapons')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const MusicMgr = require('../runtime/music')
const { resetPrepBagScroll } = require('../views/prepareView')
const tutorial = require('./tutorial')
const { effectValue: cultEffectValue } = require('../data/cultivationConfig')
const { calcRoguelikeSoulStone } = require('../data/petPoolConfig')
const { SETTLE_CFG } = require('../data/settleConfig')
const { initBoard } = require('./battle')
const ViewEnv = require('../views/env')
const { isCurrentUserGM } = require('../data/gmConfig')

/** 轻量深拷贝（仅用于可 JSON 序列化的游戏状态对象） */
function _deepClone(obj) {
  return obj ? JSON.parse(JSON.stringify(obj)) : null
}

/** 每层/续档共用的事件准备状态重置 */
function _resetFloorEventState(g) {
  g.prepareTab = 'pets'
  g.prepareSelBagIdx = -1
  g.prepareSelSlotIdx = -1
  resetPrepBagScroll()
  g._eventPetDetail = null
  g._adventureApplied = false
  g._adventureResult = null
  g._eventShopUsed = false
  g._eventShopUsedCount = 0
  g._eventShopUsedItems = null
  g._shopSelectAttr = false
  g._shopSelectPet = null
}

const DEFAULT_RUN_BUFFS = {
  allAtkPct:0, allDmgPct:0, attrDmgPct:{metal:0,wood:0,earth:0,water:0,fire:0},
  heartBoostPct:0, weaponBoostPct:0, extraTimeSec:0,
  hpMaxPct:0, comboDmgPct:0, elim3DmgPct:0, elim4DmgPct:0, elim5DmgPct:0,
  counterDmgPct:0, skillDmgPct:0, skillCdReducePct:0, regenPerTurn:0,
  dmgReducePct:0, bonusCombo:0, stunDurBonus:0,
  enemyAtkReducePct:0, enemyHpReducePct:0, enemyDefReducePct:0,
  eliteAtkReducePct:0, eliteHpReducePct:0, bossAtkReducePct:0, bossHpReducePct:0,
  nextDmgReducePct:0, postBattleHealPct:0, extraRevive:0,
}

function makeDefaultRunBuffs() {
  return JSON.parse(JSON.stringify(DEFAULT_RUN_BUFFS))
}

function startRun(g, petIds) {
  g.battleMode = 'roguelike'
  g.floor = 0
  g.cleared = false
  g._isGM = isCurrentUserGM()
  g.itemResetObtained = false
  g.itemResetUsed = false
  g.itemHealObtained = false
  g.itemHealUsed = false
  g._showItemMenu = false

  // 从灵宠池构建战斗宠物（带自己的宠物冲塔）
  const teamIds = petIds || g.storage.petPool.slice(0, 5).map(p => p.id)
  g.pets = teamIds.map(id => {
    const poolPet = g.storage.getPoolPet(id)
    const basePet = getPetById(id)
    if (!basePet || !poolPet) return null
    return {
      ...basePet,
      star: poolPet.star,
      atk: getPoolPetAtk(poolPet),
      currentCd: petHasSkill({ ...basePet, star: poolPet.star }) ? Math.max(0, Math.ceil(basePet.cd * 0.4) - 1) : 0,
      _poolId: id,
    }
  }).filter(Boolean)

  g.sessionPetPool = []
  g.petBag = []
  g.weaponBag = []
  g.heroHp = 100; g.heroMaxHp = 100; g.heroShield = 0
  g.realmLevel = 1
  g.heroBuffs = []; g.enemyBuffs = []
  g.runBuffs = makeDefaultRunBuffs()
  g.runBuffLog = []
  g.skipNextBattle = false; g.nextStunEnemy = false; g.nextDmgDouble = false
  g.tempRevive = false; g.immuneOnce = false; g.comboNeverBreak = false
  g.weaponReviveUsed = false; g.goodBeadsNextTurn = false
  g.adReviveUsed = false
  g.turnCount = 0; g.combo = 0; g.runTotalTurns = 0
  for (const k of EXP_FIELDS) g[k] = 0
  g._floorStartExp = 0; g._floorExpSummary = null; g._expFloats = []

  if (tutorial.needsTutorial()) {
    tutorial.start(g)
    if (g.events) g.events.emit('run:start')
    return
  }

  // 应用修炼加成
  {
    const cult = g.storage.cultivation
    const bodyBonus = Math.round(cultEffectValue('body', cult.levels.body))
    const senseBonus = Math.round(cultEffectValue('sense', cult.levels.sense))
    const wisdomBonus = cultEffectValue('wisdom', cult.levels.wisdom)
    const defBonus = Math.round(cultEffectValue('defense', cult.levels.defense))
    const spiritBonus = +cultEffectValue('spirit', cult.levels.spirit).toFixed(2)
    g.heroMaxHp  += bodyBonus
    g.heroHp      = g.heroMaxHp
    g.heroShield  = senseBonus
    g.dragTimeLimit += Math.round(wisdomBonus * 60)
    g._cultDmgReduce = defBonus
    g._cultHeartBase = spiritBonus
    if ((bodyBonus + senseBonus + defBonus) > 0) {
      g._cultBonusSummary = { bodyBonus, senseBonus, defBonus, spiritBonus, wisdomBonus, timer: 180 }
    }
  }

  // 加载玩家装备的法宝（带自己的法宝冲塔）
  const eqId = g.storage.equippedWeaponId
  g.weapon = eqId ? { ...getWeaponById(eqId) } : null

  if (g.events) g.events.emit('run:start')
  nextFloor(g)
}

function nextFloor(g) {
  restoreBattleHpMax(g)
  g.heroBuffs = []
  g.enemyBuffs = []
  g.heroShield = 0
  g.rewards = null; g.selectedReward = -1; g._rewardDetailShow = null  // 清除奖励状态
  const wasTutorialJustDone = g._tutorialJustDone && g.floor === 0
  g._tutorialJustDone = wasTutorialJustDone
  g.floor++
  // 教学结束后首次进入正式关卡，展示通天塔玩法介绍
  if (wasTutorialJustDone && g.floor === 1) {
    g._rogueIntro = { page: 0, alpha: 0 }
  }
  // 通关检测：超过最大层数即为通关
  if (g.floor > MAX_FLOOR) {
    g.cleared = true
    endRun(g)
    return
  }
  if (g.floor > 1) MusicMgr.playNextFloor()
  // ===== 修仙境界成长：每层固定增加血量上限（不回血），攻击仍保留每5层隐性加成 =====
  if (g.floor > 1) {
    g.realmLevel = g.floor
    const realm = getRealmInfo(g.floor)
    const prevRealm = getRealmInfo(g.floor - 1)
    if (realm && realm.hpUp > 0) {
      g.heroMaxHp += realm.hpUp
      // 不回血，仅增加上限
    }
    // 记录境界提升信息用于UI展示
    g._realmUpInfo = {
      name: realm.name,
      prevName: prevRealm ? prevRealm.name : '',
      hpUp: realm.hpUp,
      timer: 0
    }
  }
  // 攻击隐性加成：每过5层自动获得攻击加成（保证输出跟得上怪物膨胀）
  if (g.floor > 1 && g.floor % 5 === 1) {
    const tier = Math.floor((g.floor - 1) / 5)  // 1~5
    const atkBonus = 10 + tier * 2               // 12/14/16/18/20%
    g.runBuffs.allAtkPct += atkBonus
  }
  // 法宝perFloorBuff
  if (g.weapon && g.weapon.type === 'perFloorBuff' && g.floor > 1 && (g.floor - 1) % g.weapon.per === 0) {
    if (g.weapon.field === 'atk') g.runBuffs.allAtkPct += g.weapon.pct
    else if (g.weapon.field === 'hpMax') {
      const inc = Math.round(g.heroMaxHp * g.weapon.pct / 100)
      g.heroMaxHp += inc; g.heroHp += inc
    }
  }
  g.curEvent = generateFloorEvent(g.floor)
  if (g.skipNextBattle && (g.curEvent.type === 'battle' || g.curEvent.type === 'elite')) {
    g.skipNextBattle = false
    g.curEvent = { type: EVENT_TYPE.ADVENTURE, data: ADVENTURES[Math.floor(Math.random()*ADVENTURES.length)] }
  }
  _resetFloorEventState(g)
  // 过层经验汇总：计算本层获得经验
  const floorExp = (g.runExp || 0) - (g._floorStartExp || 0)
  if (floorExp > 0 && g.floor > 1) {
    g._floorExpSummary = { amount: floorExp, timer: 120 }
  } else {
    g._floorExpSummary = null
  }
  g._floorStartExp = g.runExp || 0
  g._expFloats = []
  g.setScene('event')
}

function restoreBattleHpMax(g) {
  if (g._baseHeroMaxHp != null && g._baseHeroMaxHp !== g.heroMaxHp) {
    const base = g._baseHeroMaxHp
    g.heroHp = Math.min(g.heroHp, base)
    g.heroMaxHp = base
  }
  g._baseHeroMaxHp = null
}

/**
 * 经验结算（可独立于 endRun 调用，如重新开局/放弃存档时）
 * 修炼经验 + 灵石，数值从 SETTLE_CFG 读取
 */
function settleExp(g) {
  const cfg = SETTLE_CFG
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor
  const layerExp = finalFloor * cfg.cultExp.perFloor
  const clearBonus = g.cleared ? cfg.cultExp.clearBonus : 0
  const rawTotal = (g.runExp || 0) + layerExp + clearBonus
  const finalExp = g.cleared ? rawTotal : Math.floor(rawTotal * cfg.cultExp.failRatio)
  const prevLevel = g.storage.cultivation.level || 0
  const levelUps = finalExp > 0 ? g.storage.addCultExp(finalExp) : 0

  const combatDetail = { elimExp: g._runElimExp || 0, comboExp: g._runComboExp || 0, killExp: g._runKillExp || 0 }
  const rawCombat = combatDetail.elimExp + combatDetail.comboExp + combatDetail.killExp
  const petBase = Math.floor(rawCombat * cfg.soulStone.combatRatio)
  const petFloor = finalFloor * cfg.soulStone.floorBonus
  const petClear = g.cleared ? cfg.soulStone.clearBonus : 0
  const soulStone = petBase + petFloor + petClear
  if (soulStone > 0) g.storage.addSoulStone(soulStone)

  g._lastRunExp = finalExp
  g._lastRunLevelUps = levelUps
  g._lastRunPrevLevel = prevLevel
  g._lastRunSoulStone = soulStone
  g._lastRunExpDetail = {
    ...combatDetail, layerExp, clearBonus, rawTotal,
    isCleared: g.cleared, soulStone,
  }
  return finalExp
}

/**
 * 完整结算（仅 endRun 使用）：修炼经验 + 灵石 + 碎片
 * 所有奖励统一写入 g._lastRunSettleRewards 供结算 UI 展示
 */
function settleAll(g) {
  settleExp(g)
  const cfg = SETTLE_CFG
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor

  // ── 碎片计算 ──
  const bossCount = Math.floor(finalFloor / 10)
  // 精英层：第 5 层固定 + 约每 7-8 层随机，简化为 floor/7 估算
  const eliteEstimate = finalFloor >= 5 ? 1 + Math.floor((finalFloor - 5) / 7) : 0
  const fragBase = finalFloor * cfg.fragment.perFloor
  const fragBoss = bossCount * cfg.fragment.bossBonus
  const fragElite = eliteEstimate * cfg.fragment.eliteBonus
  const fragClear = g.cleared ? cfg.fragment.clearBonus : 0
  const fragRaw = fragBase + fragBoss + fragElite + fragClear
  const fragTotal = g.cleared ? fragRaw : Math.floor(fragRaw * cfg.fragment.failRatio)

  // ── 碎片分配 ──
  const fragDetails = []
  if (fragTotal > 0 && g.pets && g.pets.length > 0) {
    if (cfg.distribute.mode === 'team') {
      const targets = g.pets.map(p => p.id)
      if (cfg.distribute.evenSplit) {
        const perPet = Math.floor(fragTotal / targets.length)
        const remainder = fragTotal - perPet * targets.length
        targets.forEach((id, i) => {
          const cnt = perPet + (i < remainder ? 1 : 0)
          if (cnt > 0) {
            g.storage.addFragmentSmart(id, cnt)
            fragDetails.push({ petId: id, count: cnt })
          }
        })
      } else {
        // 全部给队伍第一只（简化 V1）
        g.storage.addFragmentSmart(targets[0], fragTotal)
        fragDetails.push({ petId: targets[0], count: fragTotal })
      }
    } else {
      // bank 模式：给队伍中随机一只
      const id = g.pets[Math.floor(Math.random() * g.pets.length)].id
      g.storage.addFragmentSmart(id, fragTotal)
      fragDetails.push({ petId: id, count: fragTotal })
    }
  }

  g._lastRunSettleRewards = {
    cultExp: {
      runExp: g._lastRunExpDetail.elimExp + g._lastRunExpDetail.comboExp + g._lastRunExpDetail.killExp,
      layerExp: g._lastRunExpDetail.layerExp,
      clearBonus: g._lastRunExpDetail.clearBonus,
      failRatio: g.cleared ? 1 : cfg.cultExp.failRatio,
      final: g._lastRunExp,
      levelUps: g._lastRunLevelUps,
      prevLevel: g._lastRunPrevLevel,
    },
    soulStone: {
      final: g._lastRunSoulStone,
    },
    fragments: {
      base: fragBase,
      bossBonus: fragBoss,
      eliteBonus: fragElite,
      clearBonus: fragClear,
      failRatio: g.cleared ? 1 : cfg.fragment.failRatio,
      final: fragTotal,
      details: fragDetails,
    },
  }
}

function endRun(g) {
  MusicMgr.stopBossBgm()
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor
  g.storage.updateBestFloor(finalFloor, g.pets, g.weapon, g.cleared ? g.runTotalTurns : 0)
  // 胜/败才算完成一局
  g.storage._d.totalRuns++; g.storage._save()
  g.storage.clearRunState()
  if (g.storage.userAuthorized && !g._isGM) {
    g.storage.submitScore(finalFloor, g.pets, g.weapon, g.cleared ? g.runTotalTurns : 0)
    g.storage.submitDexAndCombo()
  }
  settleAll(g)
  if (g._lastRunExp > 0 && !g.storage.isGuideShown('cultivation_unlock')) {
    g._pendingGuide = 'cultivation_unlock'
  }
  // 灵宠池 & 图鉴解锁指引已在首只宠物入池时触发，此处不再重复
  if (g.cleared) {
    MusicMgr.playLevelUp()
  } else {
    MusicMgr.playGameOver()
  }
  g.setScene('gameover')
  if (g.events) g.events.emit('run:end', { cleared: g.cleared, floor: finalFloor })
}

function saveAndExit(g) {
  MusicMgr.stopBossBgm()
  if (g.battleMode === 'stage') {
    g.showExitDialog = false
    g.bState = 'none'
    g.setScene('title')
    return
  }
  restoreBattleHpMax(g)
  const runState = _deepClone({
    floor: g.floor,
    pets: g.pets,
    weapon: g.weapon,
    petBag: g.petBag,
    weaponBag: g.weaponBag,
    sessionPetPool: g.sessionPetPool || [],
    heroHp: g.heroHp, heroMaxHp: g.heroMaxHp, heroShield: g.heroShield,
    realmLevel: g.realmLevel || g.floor,
    heroBuffs: g.heroBuffs,
    runBuffs: g.runBuffs,
    runBuffLog: g.runBuffLog || [],
    skipNextBattle: g.skipNextBattle, nextStunEnemy: g.nextStunEnemy, nextDmgDouble: g.nextDmgDouble,
    tempRevive: g.tempRevive, immuneOnce: g.immuneOnce, comboNeverBreak: g.comboNeverBreak,
    weaponReviveUsed: g.weaponReviveUsed, goodBeadsNextTurn: g.goodBeadsNextTurn,
    runTotalTurns: g.runTotalTurns || 0,
    ...Object.fromEntries(EXP_FIELDS.map(k => [k, g[k] || 0])),
    itemResetObtained: g.itemResetObtained, itemResetUsed: g.itemResetUsed,
    itemHealObtained: g.itemHealObtained, itemHealUsed: g.itemHealUsed,
    curEvent: g.curEvent || null,
  })
  g.storage.saveRunState(runState)
  g.showExitDialog = false
  g.bState = 'none'
  g.setScene('title')
}

function resumeRun(g) {
  const s = g.storage.loadRunState()
  if (!s) return
  g.battleMode = 'roguelike'
  g.floor = s.floor
  g.pets = s.pets
  g.weapon = s.weapon
  g.petBag = s.petBag || []
  g.weaponBag = s.weaponBag || []
  g.sessionPetPool = s.sessionPetPool || []
  g.heroHp = s.heroHp; g.heroMaxHp = s.heroMaxHp; g.heroShield = 0  // 护盾仅战斗局内生效，恢复时清零
  g.realmLevel = s.realmLevel || s.floor
  g.heroBuffs = s.heroBuffs || []; g.enemyBuffs = []
  g.runBuffs = s.runBuffs || makeDefaultRunBuffs()
  // 兼容旧存档：补充缺失的新字段
  for (const k in DEFAULT_RUN_BUFFS) {
    if (g.runBuffs[k] === undefined) g.runBuffs[k] = DEFAULT_RUN_BUFFS[k]
  }
  g.runBuffLog = s.runBuffLog || []
  g.skipNextBattle = s.skipNextBattle || false
  g.nextStunEnemy = s.nextStunEnemy || false
  g.nextDmgDouble = s.nextDmgDouble || false
  g.tempRevive = s.tempRevive || false
  g.immuneOnce = s.immuneOnce || false
  g.comboNeverBreak = s.comboNeverBreak || false
  g.weaponReviveUsed = s.weaponReviveUsed || false
  g.goodBeadsNextTurn = s.goodBeadsNextTurn || false
  g.runTotalTurns = s.runTotalTurns || 0
  // 道具状态恢复
  g.itemResetObtained = s.itemResetObtained || false
  g.itemResetUsed = s.itemResetUsed || false
  g.itemHealObtained = s.itemHealObtained || false
  g.itemHealUsed = s.itemHealUsed || false
  g._showItemMenu = false
  g.turnCount = 0; g.combo = 0
  // 恢复修炼经验累积
  for (const k of EXP_FIELDS) g[k] = s[k] || 0
  // 肉鸽模式恢复修炼加成（100%）
  {
    const cult = g.storage.cultivation
    g._cultDmgReduce = Math.round(cultEffectValue('defense', cult.levels.defense))
    g._cultHeartBase = +cultEffectValue('spirit', cult.levels.spirit).toFixed(2)
  }
  g.curEvent = s.curEvent
  // 兜底：如果存档中 curEvent 为空，重新生成当前层事件
  if (!g.curEvent) {
    g.curEvent = generateFloorEvent(g.floor)
  }
  g.storage.clearRunState()
  _resetFloorEventState(g)
  g.setScene('event')
}

function onDefeat(g, W, H) {
  // 固定关卡：直接进入失败状态，不触发复活机制
  if (g.battleMode === 'stage') {
    g.bState = 'defeat'
    return
  }
  if (g.tempRevive) {
    g.tempRevive = false
    const reviveHealPct = g._reviveHealPct || 30
    g._reviveHealPct = null
    g.heroHp = Math.round(g.heroMaxHp * reviveHealPct / 100)
    g.skillEffects.push({ x:W*0.5, y:H*0.5, text:'天护复活！', color:TH.accent, t:0, alpha:1 })
    MusicMgr.playRevive()
    g.bState = 'playerTurn'; g.dragTimer = 0; return
  }
  if (g.runBuffs.extraRevive > 0) {
    g.runBuffs.extraRevive--; g.heroHp = Math.round(g.heroMaxHp * 0.25)
    g.skillEffects.push({ x:W*0.5, y:H*0.5, text:'奇迹复活！', color:TH.accent, t:0, alpha:1 })
    MusicMgr.playRevive()
    g.bState = 'playerTurn'; g.dragTimer = 0; return
  }
  if (g.weapon && g.weapon.type === 'revive' && !g.weaponReviveUsed) {
    g.weaponReviveUsed = true; g.heroHp = Math.round(g.heroMaxHp * 0.2)
    g.skillEffects.push({ x:W*0.5, y:H*0.5, text:'不灭金身！', color:TH.accent, t:0, alpha:1 })
    MusicMgr.playRevive()
    g.bState = 'playerTurn'; g.dragTimer = 0; return
  }
  if (!g.adReviveUsed) {
    g.bState = 'adReviveOffer'; return
  }
  g.bState = 'defeat'
}

function doAdRevive(g, W, H) {
  // 分享复活：转发给好友后获得满血复活
  P.shareAppMessage({
    title: `我在消消塔第${g.floor}层倒下了，快来助我一臂之力！`,
    imageUrl: 'assets/share/share_revive.jpg',
  })
  // 分享回调：分享成功后触发复活
  // 注意：微信不保证分享成功回调的可靠性，为保证用户体验，
  // 调用 shareAppMessage 后即视为分享成功，给予复活奖励
  adReviveCallback(g, W, H)
}

function adReviveCallback(g, W, H) {
  g.adReviveUsed = true
  g.heroHp = g.heroMaxHp
  g.heroShield = 0
  g.heroBuffs = g.heroBuffs.filter(b => !b.bad)
  g.skillEffects.push({ x:W*0.5, y:H*0.5, text:'浴火重生！', color:'#ffd700', t:0, alpha:1 })
  MusicMgr.playRevive()
  g.bState = 'playerTurn'; g.dragTimer = 0
}

// ===== 道具系统 =====
// 分享获取道具（标记为已获取，不立即使用）
function obtainItemReset(g) {
  if (g.itemResetObtained || g.itemResetUsed) return false
  P.shareAppMessage({
    title: `我正在挑战消消塔第${g.floor}层，一起来修仙！`,
    imageUrl: 'assets/share/share_default.jpg',
  })
  g.itemResetObtained = true
  MusicMgr.playReward()
  return true
}

function obtainItemHeal(g) {
  if (g.itemHealObtained || g.itemHealUsed) return false
  P.shareAppMessage({
    title: `我正在挑战消消塔第${g.floor}层，一起来修仙！`,
    imageUrl: 'assets/share/share_default.jpg',
  })
  g.itemHealObtained = true
  MusicMgr.playReward()
  return true
}

// 使用已获取的道具
function useItemReset(g) {
  if (!g.itemResetObtained || g.itemResetUsed || g.bState !== 'playerTurn' || g.dragging) return false
  g.itemResetUsed = true
  g._showItemMenu = false
  initBoard(g)
  g.skillEffects.push({ x: ViewEnv.W*0.5, y: ViewEnv.H*0.5, text:'乾坤重置！', color:'#66ccff', t:0, alpha:1 })
  MusicMgr.playReward()
  return true
}

function useItemHeal(g) {
  if (!g.itemHealObtained || g.itemHealUsed || g.bState !== 'playerTurn' || g.dragging) return false
  if (g.heroHp >= g.heroMaxHp) return false
  g.itemHealUsed = true
  g._showItemMenu = false
  g.heroHp = g.heroMaxHp
  g.skillEffects.push({ x: ViewEnv.W*0.5, y: ViewEnv.H*0.5, text:'回春妙术！', color:'#44ff88', t:0, alpha:1 })
  MusicMgr.playRevive()
  return true
}

/** GM跳过当前战斗：直接击杀敌人进入胜利 */
function gmSkipBattle(g) {
  if (!g._isGM || !g.enemy || g.bState !== 'playerTurn') return false
  g.enemy.hp = 0
  g.lastTurnCount = g.turnCount
  g.lastSpeedKill = false
  g.runTotalTurns = (g.runTotalTurns || 0) + g.turnCount
  MusicMgr.playVictory()
  g.bState = 'victory'
  g._enemyDeathAnim = { timer: 0, duration: 45 }
  return true
}

function _safeRun(fn) {
  return function (g) {
    try {
      return fn.apply(this, arguments)
    } catch (e) {
      console.error('[RunManager] ' + fn.name + ' error:', e)
      if (g && typeof g === 'object' && typeof g.setScene === 'function') {
        try {
          P.showGameToast('运行异常，已返回首页')
          g.setScene('title')
        } catch (_) {}
      }
    }
  }
}

module.exports = {
  DEFAULT_RUN_BUFFS, makeDefaultRunBuffs,
  startRun: _safeRun(startRun),
  nextFloor: _safeRun(nextFloor),
  restoreBattleHpMax,
  settleExp: _safeRun(settleExp),
  settleAll: _safeRun(settleAll),
  endRun: _safeRun(endRun),
  saveAndExit: _safeRun(saveAndExit),
  resumeRun: _safeRun(resumeRun),
  onDefeat: _safeRun(onDefeat),
  doAdRevive: _safeRun(doAdRevive),
  adReviveCallback: _safeRun(adReviveCallback),
  obtainItemReset, obtainItemHeal, useItemReset, useItemHeal,
  gmSkipBattle: _safeRun(gmSkipBattle),
}
