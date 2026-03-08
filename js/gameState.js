/**
 * 游戏状态初始化 — 从 Main 中提取的纯状态字段
 * 所有字段直接挂到 g（Main 实例）上，保持 g.xxx 的访问方式不变
 */
const { TH } = require('./render')
const runMgr = require('./engine/runManager')

/**
 * 初始化所有游戏状态字段
 * @param {object} g - Main 实例
 */
function initState(g) {
  // ===== 棋盘 =====
  g.board = []; g.cellSize = 0; g.boardX = 0; g.boardY = 0

  // ===== 转珠 =====
  g.dragging = false
  g.dragR = -1; g.dragC = -1
  g.dragStartX = 0; g.dragStartY = 0
  g.dragCurX = 0; g.dragCurY = 0
  g.dragAttr = null
  g.dragTimer = 0
  g.dragTimeLimit = 8 * 60  // 8秒@60fps
  g.swapAnim = null

  // ===== 战斗状态 =====
  g.bState = 'none'
  g._stateTimer = 0
  g._enemyTurnWait = false
  g._pendingEnemyAtk = null
  g._pendingDmgMap = null
  g._pendingHeal = 0
  g.combo = 0; g.turnCount = 0
  g.elimQueue = []
  g.elimAnimCells = null; g.elimAnimTimer = 0
  g.dropAnimTimer = 0; g.dropAnimCols = null

  // ===== 动画 =====
  g.dmgFloats = []; g.skillEffects = []
  g.elimFloats = []
  g.petAtkNums = []
  g._comboAnim = { num: 0, timer: 0, scale: 1 }
  g._comboParticles = []
  g._comboFlash = 0
  g._petFinalDmg = {}
  g._petAtkRollTimer = 0
  g.shakeT = 0; g.shakeI = 0; g.shakeDecay = 0.85
  g._hitStopFrames = 0
  g._screenFlash = 0; g._screenFlashMax = 1; g._screenFlashColor = '#fff'
  g._enemyTintFlash = 0
  g.heroAttackAnim = { active:false, progress:0, duration:24 }
  g.enemyHurtAnim  = { active:false, progress:0, duration:18 }
  g.heroHurtAnim   = { active:false, progress:0, duration:18 }
  g.enemyAttackAnim= { active:false, progress:0, duration:20 }
  g.skillCastAnim  = { active:false, progress:0, duration:30, type:'slash', color:TH.accent, skillName:'', targetX:0, targetY:0 }
  g._enemyHpLoss = null; g._heroHpLoss = null; g._heroHpGain = null
  g._enemyHitFlash = 0
  g._enemyDeathAnim = null
  g._blockFlash = 0
  g._heroHurtFlash = 0
  g._enemyWarning = 0
  g._counterFlash = null
  g._bossEntrance = 0

  // ===== 经验反馈特效 =====
  g._expFloats = []           // 飞行中的经验飘字 { x, y, startX, startY, targetX, targetY, text, t, duration, alpha, color }
  g._expIndicatorPulse = 0    // 经验图标脉冲倒计时帧
  g._expIndicatorX = 0        // 经验图标中心坐标（由 battleView 写入）
  g._expIndicatorY = 0
  g._floorStartExp = 0        // 本层开始时的 runExp 快照
  g._floorExpSummary = null    // 过层经验汇总 { amount, timer }

  // ===== Roguelike Run 状态 =====
  g.floor = 0
  g.pets = []
  g.weapon = null
  g.petBag = []
  g.weaponBag = []
  g.heroHp = 0; g.heroMaxHp = 60
  g.heroShield = 0
  g.heroBuffs = []; g.enemyBuffs = []
  g.enemy = null
  g.curEvent = null
  g.rewards = null
  g.shopItems = null
  g.restOpts = null
  g.adventureData = null
  g.selectedReward = -1
  g.rewardPetSlot = -1

  // ===== 战前编辑 =====
  g.prepareTab = 'pets'
  g.prepareSelBagIdx = -1
  g.prepareSelSlotIdx = -1
  g.prepareTip = null
  g._eventPetDetail = null
  g._eventPetDetailData = null
  g._eventWpnDetail = null
  g._eventWpnDetailData = null
  g._eventDragPet = null
  g.showRunBuffDetail = false
  g.showWeaponDetail = false
  g.showBattlePetDetail = null
  g._runBuffIconRects = []

  // ===== 局内 BUFF =====
  g.runBuffLog = []
  g.runBuffs = runMgr.makeDefaultRunBuffs()
  g.skipNextBattle = false
  g.nextStunEnemy = false
  g.nextDmgDouble = false
  g.tempRevive = false
  g.immuneOnce = false
  g.comboNeverBreak = false
  g.weaponReviveUsed = false
  g.goodBeadsNextTurn = false

  // ===== UI / 加载 =====
  g._loadStart = Date.now()
  g._loadReady = false
  g._loadPct = 0
  g._pressedBtn = null
  g._petLongPressTimer = null
  g._petLongPressIndex = -1
  g._petLongPressTriggered = false
  g._petSwipeIndex = -1
  g._petSwipeStartX = 0
  g._petSwipeStartY = 0
  g._petSwipeTriggered = false
  g.skillPreview = null
  g.showExitDialog = false
  g.showNewRunConfirm = false
  g.showMorePanel = false         // 首页「更多」面板
  g.showTitleStartDialog = false  // 首页开始/继续确认弹窗
  g.titleMode = 'tower'           // 首页当前展示的模式：'tower' | 'stage'
  g.titleTowerIndex = 0      // 当前模式内塔的索引（预留左滑多塔扩展）
  g.shopUsed = false

  // ===== 排行榜 =====
  g.rankTab = 'all'
  g.rankScrollY = 0
}

module.exports = { initState }
