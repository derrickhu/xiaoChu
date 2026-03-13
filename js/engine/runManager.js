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
const { generateStarterPets, generateSessionPetPool, PETS } = require('../data/pets')
const { generateStarterWeapon } = require('../data/weapons')
const MusicMgr = require('../runtime/music')
const { resetPrepBagScroll } = require('../views/prepareView')
const tutorial = require('./tutorial')

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

function startRun(g) {
  g.battleMode = 'roguelike'
  g.floor = 0
  g.cleared = false
  // 道具系统：每局最多各用一次，需先分享获取再使用
  g.itemResetObtained = false  // 乾坤重置 — 已获取（分享后）
  g.itemResetUsed = false      // 乾坤重置 — 已使用
  g.itemHealObtained = false   // 回春妙术 — 已获取（分享后）
  g.itemHealUsed = false       // 回春妙术 — 已使用
  g._showItemMenu = false      // 道具菜单显示状态
  // 生成本局宠物池（每属性5只，共25只），所有宠物获取从此池抽取
  g.sessionPetPool = generateSessionPetPool()
  g.pets = generateStarterPets(g.sessionPetPool)

  // 图鉴"带它出战"：指定宠物以★1形态替换初始队伍
  if (g._designatedPetId) {
    const dpId = g._designatedPetId
    g._designatedPetId = null
    let dpData = null, dpAttr = ''
    for (const attr of ['metal','wood','water','fire','earth']) {
      const found = PETS[attr].find(p => p.id === dpId)
      if (found) { dpData = found; dpAttr = attr; break }
    }
    if (dpData) {
      const designatedPet = { ...dpData, attr: dpAttr, star: 1, currentCd: 0 }

      // 高级灵宠：加入当局 sessionPetPool（确保肉鸽内也能抽到它升星）
      const poolEntry = g.storage.petPool.find(p => p.id === dpId)
      if (poolEntry && poolEntry.source === 'stage') {
        if (g.sessionPetPool[dpAttr] && !g.sessionPetPool[dpAttr].find(p => p.id === dpId)) {
          g.sessionPetPool[dpAttr].push(dpData)
        }
      }

      const sameAttrIdx = g.pets.findIndex(p => p.attr === dpAttr)
      if (sameAttrIdx >= 0) {
        g.pets[sameAttrIdx] = designatedPet
      } else {
        g.pets[g.pets.length - 1] = designatedPet
      }
    }
  }
  g.petBag = []
  g.weaponBag = []
  g.heroHp = 100; g.heroMaxHp = 100; g.heroShield = 0
  g.realmLevel = 1  // 修仙境界等级（对应当前层数）
  g.heroBuffs = []; g.enemyBuffs = []
  g.runBuffs = makeDefaultRunBuffs()
  g.runBuffLog = []
  g.skipNextBattle = false; g.nextStunEnemy = false; g.nextDmgDouble = false
  g.tempRevive = false; g.immuneOnce = false; g.comboNeverBreak = false
  g.weaponReviveUsed = false; g.goodBeadsNextTurn = false
  g.adReviveUsed = false
  g.turnCount = 0; g.combo = 0; g.runTotalTurns = 0
  // 修炼经验：局内累积字段初始化
  for (const k of EXP_FIELDS) g[k] = 0
  g._floorStartExp = 0; g._floorExpSummary = null; g._expFloats = []
  g.storage._d.totalRuns++; g.storage._save()
  // 首次游戏触发新手教学（教学中使用固定宠物、无法宝）
  if (tutorial.needsTutorial()) {
    tutorial.start(g)
    if (g.events) g.events.emit('run:start')
    return
  }
  // 固定关卡模式：应用修炼加成
  if (g.battleMode === 'stage') {
    const cult = g.storage.cultivation
    const { effectValue } = require('../data/cultivationConfig')
    g.heroMaxHp  += effectValue('body', cult.levels.body)
    g.heroHp      = g.heroMaxHp
    g.heroShield  = effectValue('sense', cult.levels.sense)
    g.dragTimeLimit += Math.round(effectValue('wisdom', cult.levels.wisdom) * 60)
    g._cultDmgReduce = effectValue('defense', cult.levels.defense)
    g._cultHeartBase = effectValue('spirit', cult.levels.spirit)
  } else {
    g._cultDmgReduce = 0
    g._cultHeartBase = 0
  }
  g.weapon = generateStarterWeapon()  // 开局赠送一件基础法宝并自动装备
  if (g.events) g.events.emit('run:start')
  nextFloor(g)
}

function nextFloor(g) {
  restoreBattleHpMax(g)
  g.heroBuffs = []
  g.enemyBuffs = []
  g.heroShield = 0
  g.rewards = null; g.selectedReward = -1; g._rewardDetailShow = null  // 清除奖励状态
  g._tutorialJustDone = g._tutorialJustDone && g.floor === 0  // 仅保留到第1层
  g.floor++
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
 * 经验结算（可独立于 endRun 调用，如重新开局时）
 * 修炼经验：按失败保留 60%
 * 宠物经验：独立计算，汇入共享经验池
 */
function settleExp(g) {
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor
  const layerExp = finalFloor * 3
  const clearBonus = g.cleared ? 500 : 0
  const rawTotal = (g.runExp || 0) + layerExp + clearBonus
  const finalExp = g.cleared ? rawTotal : Math.floor(rawTotal * 0.6)
  const prevLevel = g.storage.cultivation.level || 0
  const levelUps = finalExp > 0 ? g.storage.addCultExp(finalExp) : 0

  // 宠物经验：肉鸽局结算产出，汇入共享经验池
  const { calcRoguelikePetExp } = require('../data/petPoolConfig')
  const petExp = calcRoguelikePetExp(
    { elimExp: g._runElimExp || 0, comboExp: g._runComboExp || 0, killExp: g._runKillExp || 0 },
    finalFloor,
    g.cleared
  )
  if (petExp > 0) g.storage.addPetExp(petExp)

  g._lastRunExp = finalExp
  g._lastRunLevelUps = levelUps
  g._lastRunPrevLevel = prevLevel
  g._lastRunPetExp = petExp
  g._lastRunExpDetail = {
    elimExp: g._runElimExp || 0,
    comboExp: g._runComboExp || 0,
    killExp: g._runKillExp || 0,
    layerExp,
    clearBonus,
    rawTotal,
    isCleared: g.cleared,
    petExp,
  }
  return finalExp
}

function endRun(g) {
  MusicMgr.stopBossBgm()
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor
  g.storage.updateBestFloor(finalFloor, g.pets, g.weapon, g.cleared ? g.runTotalTurns : 0)
  g.storage.clearRunState()
  if (g.storage.userAuthorized) {
    g.storage.submitScore(finalFloor, g.pets, g.weapon, g.cleared ? g.runTotalTurns : 0)
    g.storage.submitDexAndCombo()
  }
  settleExp(g)
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
  restoreBattleHpMax(g)
  const runState = {
    floor: g.floor,
    pets: JSON.parse(JSON.stringify(g.pets)),
    weapon: g.weapon ? JSON.parse(JSON.stringify(g.weapon)) : null,
    petBag: JSON.parse(JSON.stringify(g.petBag)),
    weaponBag: JSON.parse(JSON.stringify(g.weaponBag)),
    sessionPetPool: JSON.parse(JSON.stringify(g.sessionPetPool || [])),
    heroHp: g.heroHp, heroMaxHp: g.heroMaxHp, heroShield: g.heroShield,
    realmLevel: g.realmLevel || g.floor,
    heroBuffs: JSON.parse(JSON.stringify(g.heroBuffs)),
    runBuffs: JSON.parse(JSON.stringify(g.runBuffs)),
    runBuffLog: JSON.parse(JSON.stringify(g.runBuffLog || [])),
    skipNextBattle: g.skipNextBattle, nextStunEnemy: g.nextStunEnemy, nextDmgDouble: g.nextDmgDouble,
    tempRevive: g.tempRevive, immuneOnce: g.immuneOnce, comboNeverBreak: g.comboNeverBreak,
    weaponReviveUsed: g.weaponReviveUsed, goodBeadsNextTurn: g.goodBeadsNextTurn,
    runTotalTurns: g.runTotalTurns || 0,
    ...Object.fromEntries(EXP_FIELDS.map(k => [k, g[k] || 0])),
    itemResetObtained: g.itemResetObtained, itemResetUsed: g.itemResetUsed,
    itemHealObtained: g.itemHealObtained, itemHealUsed: g.itemHealUsed,
    curEvent: g.curEvent ? JSON.parse(JSON.stringify(g.curEvent)) : null,
  }
  g.storage.saveRunState(runState)
  g.showExitDialog = false
  g.bState = 'none'
  g.setScene('title')
}

function resumeRun(g) {
  const s = g.storage.loadRunState()
  if (!s) return
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
  // 恢复修炼加成（固定关卡模式）
  g._cultDmgReduce = 0; g._cultHeartBase = 0
  if (g.battleMode === 'stage') {
    const cult = g.storage.cultivation
    const { effectValue } = require('../data/cultivationConfig')
    g._cultDmgReduce = effectValue('defense', cult.levels.defense)
    g._cultHeartBase = effectValue('spirit', cult.levels.spirit)
  }
  g.curEvent = s.curEvent
  // 兜底：如果存档中 curEvent 为空，重新生成当前层事件
  if (!g.curEvent) {
    g.curEvent = generateFloorEvent(g.floor)
  }
  g.storage.clearRunState()
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
  const { initBoard } = require('./battle')
  initBoard(g)
  g.skillEffects.push({ x: require('../views/env').W*0.5, y: require('../views/env').H*0.5, text:'乾坤重置！', color:'#66ccff', t:0, alpha:1 })
  MusicMgr.playReward()
  return true
}

function useItemHeal(g) {
  if (!g.itemHealObtained || g.itemHealUsed || g.bState !== 'playerTurn' || g.dragging) return false
  if (g.heroHp >= g.heroMaxHp) return false
  g.itemHealUsed = true
  g._showItemMenu = false
  g.heroHp = g.heroMaxHp
  g.skillEffects.push({ x: require('../views/env').W*0.5, y: require('../views/env').H*0.5, text:'回春妙术！', color:'#44ff88', t:0, alpha:1 })
  MusicMgr.playRevive()
  return true
}

module.exports = {
  DEFAULT_RUN_BUFFS, makeDefaultRunBuffs,
  startRun, nextFloor, restoreBattleHpMax, settleExp, endRun, saveAndExit, resumeRun,
  onDefeat, doAdRevive, adReviveCallback,
  obtainItemReset, obtainItemHeal, useItemReset, useItemHeal,
}
