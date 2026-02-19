/**
 * Run管理模块 — Roguelike局内生命周期管理
 * 从 main.js 提取：_startRun, _nextFloor, _restoreBattleHpMax, _endRun, _saveAndExit, _resumeRun
 */
const { TH } = require('../render')
const {
  EVENT_TYPE, ADVENTURES, MAX_FLOOR,
  generateFloorEvent,
} = require('../data/tower')
const { generateStarterPets } = require('../data/pets')
const MusicMgr = require('../runtime/music')

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
  g.floor = 0
  g.cleared = false
  g.pets = generateStarterPets()
  g.weapon = null
  g.petBag = []
  g.weaponBag = []
  g.heroHp = 60; g.heroMaxHp = 60; g.heroShield = 0
  g.heroBuffs = []; g.enemyBuffs = []
  g.runBuffs = makeDefaultRunBuffs()
  g.runBuffLog = []
  g.skipNextBattle = false; g.nextStunEnemy = false; g.nextDmgDouble = false
  g.tempRevive = false; g.immuneOnce = false; g.comboNeverBreak = false
  g.weaponReviveUsed = false; g.goodBeadsNextTurn = false
  g.adReviveUsed = false
  g.turnCount = 0; g.combo = 0
  g.storage._d.totalRuns++; g.storage._save()
  nextFloor(g)
}

function nextFloor(g) {
  restoreBattleHpMax(g)
  g.heroBuffs = []
  g.enemyBuffs = []
  g.heroShield = 0
  g.floor++
  // 通关检测：超过最大层数即为通关
  if (g.floor > MAX_FLOOR) {
    g.cleared = true
    endRun(g)
    return
  }
  if (g.floor > 1) MusicMgr.playLevelUp()
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
  g._eventPetDetail = null
  g._adventureApplied = false
  g._eventShopUsed = false
  g.scene = 'event'
}

function restoreBattleHpMax(g) {
  if (g._baseHeroMaxHp != null && g._baseHeroMaxHp !== g.heroMaxHp) {
    const base = g._baseHeroMaxHp
    g.heroHp = Math.min(g.heroHp, base)
    g.heroMaxHp = base
  }
  g._baseHeroMaxHp = null
}

function endRun(g) {
  MusicMgr.stopBossBgm()
  const finalFloor = g.cleared ? MAX_FLOOR : g.floor
  g.storage.updateBestFloor(finalFloor, g.pets, g.weapon)
  g.storage.clearRunState()
  if (g.storage.userAuthorized) {
    g.storage.submitScore(finalFloor, g.pets, g.weapon)
  }
  if (g.cleared) {
    MusicMgr.playLevelUp()
  } else {
    MusicMgr.playGameOver()
  }
  g.scene = 'gameover'
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
    heroHp: g.heroHp, heroMaxHp: g.heroMaxHp, heroShield: g.heroShield,
    heroBuffs: JSON.parse(JSON.stringify(g.heroBuffs)),
    runBuffs: JSON.parse(JSON.stringify(g.runBuffs)),
    runBuffLog: JSON.parse(JSON.stringify(g.runBuffLog || [])),
    skipNextBattle: g.skipNextBattle, nextStunEnemy: g.nextStunEnemy, nextDmgDouble: g.nextDmgDouble,
    tempRevive: g.tempRevive, immuneOnce: g.immuneOnce, comboNeverBreak: g.comboNeverBreak,
    weaponReviveUsed: g.weaponReviveUsed, goodBeadsNextTurn: g.goodBeadsNextTurn,
    curEvent: g.curEvent ? JSON.parse(JSON.stringify(g.curEvent)) : null,
  }
  g.storage.saveRunState(runState)
  g.showExitDialog = false
  g.bState = 'none'
  g.scene = 'title'
}

function resumeRun(g) {
  const s = g.storage.loadRunState()
  if (!s) return
  g.floor = s.floor
  g.pets = s.pets
  g.weapon = s.weapon
  g.petBag = s.petBag || []
  g.weaponBag = s.weaponBag || []
  g.heroHp = s.heroHp; g.heroMaxHp = s.heroMaxHp; g.heroShield = s.heroShield || 0
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
  g.turnCount = 0; g.combo = 0
  g.curEvent = s.curEvent
  g.storage.clearRunState()
  g.prepareTab = 'pets'
  g.prepareSelBagIdx = -1
  g.prepareSelSlotIdx = -1
  g._eventPetDetail = null
  g._adventureApplied = false
  g._eventShopUsed = false
  g.scene = 'event'
}

function onDefeat(g, W, H) {
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

module.exports = {
  DEFAULT_RUN_BUFFS, makeDefaultRunBuffs,
  startRun, nextFloor, restoreBattleHpMax, endRun, saveAndExit, resumeRun,
  onDefeat, doAdRevive, adReviveCallback,
}
