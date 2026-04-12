/**
 * 胜利/失败/复活覆盖层
 * 秘境：等死亡动画后结算并切 stageResult 场景
 * 通天塔非最终层：等死亡动画后切 towerVictory 场景
 * 通天塔最终层：等死亡动画后 endRun 切 gameover 场景
 */
const V = require('../env')
const { getRealmInfo, MAX_FLOOR, generateRewards } = require('../../data/tower')
const { getMaxedPetIds } = require('../../data/pets')
const { TOWER_SETTLE } = require('../../data/economyConfig')
const { getMilestonesAtFloor, getNextMilestonePreview } = require('../../data/towerEvent')
const { calcFloorAtkBonus } = require('../../engine/runManager')
const MusicMgr = require('../../runtime/music')

/** 通天塔至少胜一层则计「挑战通天塔1次」日任（每日进度封顶 1，避免多层刷显示） */
function _bumpTowerDailyTaskOnce(g) {
  if (!g.storage || !g.storage.addDailyTaskProgress) return
  const prog = g.storage.dailyTaskProgress
  if ((prog.tasks.tower_1 || 0) >= 1) return
  g.storage.addDailyTaskProgress('tower_1', 1)
}

/** 广告/分享复活弹窗内按钮布局（相对 panelTop，单位 ×S；缩小并上移避免超出面板底图） */
const AD_REVIVE_BTN_LAYOUT = {
  widthFrac: 0.58,
  primaryHeightPt: 34,
  skipHeightPt: 28,
  groupTopPt: 122,
  gapPt: 8,
}

// ===== 秘境胜利：等待死亡动画后 —— 末波结算，非末波切 waveTransition =====
function _handleStageVictory(g) {
  if (g._stageSettlePending) return
  if (g._enemyDeathAnim) return
  g._stageSettlePending = true
  const stageMgr = require('../../engine/stageManager')
  if (!stageMgr.isLastWave(g)) {
    g.bState = 'waveTransition'
    g._waveTransTimer = 60
    g._stageSettlePending = false
    return
  }
  stageMgr.settleStage(g)
  if (g.storage && g.storage.addDailyTaskProgress) {
    g.storage.addDailyTaskProgress('battle_1', 1)
    g.storage.addDailyTaskProgress('battle_3', 1)
  }
}

// ===== 通天塔非最终层胜利：等死亡动画后准备数据并切场景 =====
function _handleTowerFloorVictory(g) {
  if (g._towerFloorSettlePending) return
  if (g._enemyDeathAnim) return
  g._towerFloorSettlePending = true
  _bumpTowerDailyTaskOnce(g)

  const floor = g.floor
  const nextFL = floor + 1
  const curRealm = getRealmInfo(floor)
  const nextRealm = getRealmInfo(nextFL)
  const curRealmName = curRealm ? curRealm.name : '凡人'
  const nextRealmName = nextRealm ? nextRealm.name : curRealmName
  const hpUp = nextRealm ? nextRealm.hpUp : 0
  const curAtkPct = g.runBuffs ? g.runBuffs.allAtkPct : 0
  const atkBonus = calcFloorAtkBonus(nextFL)

  let weaponBuff = null
  if (g.weapon && g.weapon.type === 'perFloorBuff' && nextFL > 1 && (nextFL - 1) % g.weapon.per === 0) {
    if (g.weapon.field === 'atk') {
      weaponBuff = { text: '攻击 ' + (curAtkPct + atkBonus) + '% → ' + (curAtkPct + atkBonus + g.weapon.pct) + '%' }
    } else if (g.weapon.field === 'hpMax') {
      const nextMaxHp = g.heroMaxHp + hpUp
      const inc = Math.round(nextMaxHp * g.weapon.pct / 100)
      weaponBuff = { text: '血量 ' + nextMaxHp + ' → ' + (nextMaxHp + inc) }
    }
  }

  const floorExp = (g.runExp || 0) - (g._floorStartExp || 0)
  const floorCombat = ((g._runElimExp || 0) + (g._runComboExp || 0) + (g._runKillExp || 0)) - (g._floorStartCombatExp || 0)
  const ssCfg = TOWER_SETTLE.soulStone
  const soulStone = Math.floor(floorCombat * ssCfg.combatRatio) + Math.ceil(ssCfg.floorBase + floor * ssCfg.floorGrowth)
  const claimedMilestones = (g.storage.getTowerEventState() || {}).claimed || []
  const floorMilestones = getMilestonesAtFloor(floor, claimedMilestones)
  const nextMilestone = getNextMilestonePreview(floor, claimedMilestones)

  g._towerFloorResult = {
    floor: floor,
    hasSpeed: g.lastSpeedKill,
    turnCount: g.lastTurnCount,
    curMaxHp: g.heroMaxHp,
    hpUp: hpUp,
    nextMaxHp: g.heroMaxHp + hpUp,
    heroHp: g.heroHp,
    curAtkPct: curAtkPct,
    atkBonus: atkBonus,
    weaponBuff: weaponBuff,
    realmChanged: nextRealmName !== curRealmName,
    curRealmName: curRealmName,
    nextRealmName: nextRealmName,
    floorExp: floorExp,
    soulStone: soulStone,
    floorMilestones: floorMilestones,
    nextMilestone: nextMilestone,
  }

  // 提前生成奖励（原本在 main.js update 中懒生成）
  if (!g.rewards) {
    const ownedWpnIds = new Set()
    if (g.weapon) ownedWpnIds.add(g.weapon.id)
    if (g.weaponBag) g.weaponBag.forEach(function (w) { ownedWpnIds.add(w.id) })
    const ownedPetIds = new Set()
    if (g.pets) g.pets.forEach(function (p) { if (p) ownedPetIds.add(p.id) })
    if (g.petBag) g.petBag.forEach(function (p) { if (p) ownedPetIds.add(p.id) })
    const maxedPetIds = getMaxedPetIds(g)
    g.rewards = generateRewards(g.floor, g.curEvent ? g.curEvent.type : 'battle', g.lastSpeedKill, ownedWpnIds, g.sessionPetPool, ownedPetIds, maxedPetIds)
    g.selectedReward = -1
    g._rewardDetailShow = null
  }

  g._victoryAnimTimer = null
  g.setScene('towerVictory')
}

// ===== 通天塔最终层胜利：等死亡动画后直接结算 =====
function _handleTowerClearVictory(g) {
  if (g._towerClearSettlePending) return
  if (g._enemyDeathAnim) return
  g._towerClearSettlePending = true
  _bumpTowerDailyTaskOnce(g)

  if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm()
  g.cleared = true
  g._clearPanelTimer = null
  g._clearParticles = null
  g._goAnimTimer = null
  g._endRun()
}

// ===== 胜利分发 =====
function drawVictoryOverlay(g) {
  if (g.battleMode === 'stage') {
    _handleStageVictory(g)
    return
  }

  if (g.floor >= MAX_FLOOR) {
    _handleTowerClearVictory(g)
    return
  }

  _handleTowerFloorVictory(g)
}

function drawDefeatOverlay(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H)

  const panelW = W * 0.72, panelH = 120*S
  const panelX = (W - panelW) / 2, panelY = (H - panelH) / 2
  R.drawDialogPanel(panelX, panelY, panelW, panelH)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#C0392B'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText('修士陨落...', W*0.5, panelY + 42*S)

  ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`止步第 ${g.floor} 层`, W*0.5, panelY + 62*S)

  const btnW = panelW * 0.7, btnH = 40*S
  const btnX = (W - btnW) / 2, btnY = panelY + panelH - btnH - 14*S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '结算', 'cancel')
  g._defeatBtnRect = [btnX, btnY, btnW, btnH]
}

function drawAdReviveOverlay(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)
  const panelW = W * 0.78, panelH = 240*S
  const panelX = (W - panelW) / 2, panelY = H * 0.28
  R.drawDialogPanel(panelX, panelY, panelW, panelH)
  ctx.save()
  ctx.beginPath()
  R.rr(panelX, panelY, panelW, 4*S, 14*S); ctx.clip()
  ctx.fillStyle = TH.danger
  ctx.fillRect(panelX, panelY, panelW, 4*S)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = TH.danger; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('修士陨落', W*0.5, panelY + 40*S)
  const AdManager = require('../../adManager')
  const adAvail = AdManager.canShow('revive')
  ctx.fillStyle = '#6B5014'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
  ctx.fillText(adAvail ? '观看广告，获得满血复活！' : '分享给好友，获得满血复活！', W*0.5, panelY + 72*S)
  ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`当前第 ${g.floor} 层，复活后从本层继续挑战`, W*0.5, panelY + 98*S)
  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('每轮仅有一次复活机会', W*0.5, panelY + 116*S)
  const L = AD_REVIVE_BTN_LAYOUT
  const btnW = panelW * L.widthFrac
  const btnH = L.primaryHeightPt * S
  const btnX = (W - btnW) / 2
  const btnY = panelY + L.groupTopPt * S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, adAvail ? '▶ 观看广告复活' : '📤 分享复活', adAvail ? 'adReward' : 'confirm')
  g._adReviveBtnRect = [btnX, btnY, btnW, btnH]
  const skipW = btnW
  const skipH = L.skipHeightPt * S
  const skipX = (W - skipW) / 2
  const skipY = btnY + btnH + L.gapPt * S
  R.drawDialogBtn(skipX, skipY, skipW, skipH, '放弃治疗', 'cancel')
  g._adReviveSkipRect = [skipX, skipY, skipW, skipH]
}

module.exports = {
  drawVictoryOverlay,
  drawDefeatOverlay,
  drawAdReviveOverlay,
}
