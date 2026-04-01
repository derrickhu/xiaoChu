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
  g._pendingGuide = null
  g._rogueIntro = null
  g._newbiePetIntro = null     // 新手宠物战前介绍卡 { petId, alpha, page, timer }
  g._newbiePetCelebrate = null // 新手首通宠物庆祝阶段 { petId, alpha, timer }
  g._newbieTeamOverview = null // 新手队伍总览卡 { pets, alpha, timer }
  g._pendingStageTutorial = false // 介绍卡结束后触发简化教学
  g._isNewbieStage = false        // 新手首关模式（偏向棋盘 + 浮动提示）
  g._showBattleHelp = false       // 局内玩法帮助面板
  g._helpBtnRect = null           // 帮助按钮点击区域
  g._namedRects = {}              // 命名矩形注册表（供引导系统按 highlightId 查找）
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
  g.showSidebarPanel = false      // 侧边栏复访弹窗（抖音）
  g.titleMode = 'stage'           // 首页当前展示的模式：'tower' | 'stage'
  g.titleTowerIndex = 0      // 当前模式内塔的索引（预留左滑多塔扩展）
  g.shopUsed = false

  // ===== 排行榜 =====
  g.rankTab = 'all'
  g.rankScrollY = 0

  // ===== Phase 2：灵宠池 =====
  g._petPoolEntryPopup = null   // 入池庆祝弹窗 { petId }
  g._fragmentObtainedPopup = null // 碎片获得弹窗 { petId, count }
  g._petPoolFilter = 'all'      // 灵宠池属性筛选 'all'|'metal'|'wood'|'water'|'fire'|'earth'
  g._petPoolScroll = 0          // 灵宠池列表滚动
  g._petPoolDetail = null       // 当前打开的宠物详情 petId（旧弹窗，保留兼容）
  g._petDetailId = null         // 宠物详情全屏页当前宠物 petId
  g._petDetailReturnScene = null // 宠物详情页返回目标场景（null则默认回 petPool）
  g._petPoolLevelUpAnim = null  // 升级动画 { petId, fromLv, toLv }
  g._lastRunSoulStone = 0       // 上一局获得的灵石
  g._petPoolBtnRect = null      // gameover 页面"前往灵宠"按钮区域

  // ===== Phase 3：固定关卡 =====
  g.battleMode = 'roguelike'    // 'roguelike' | 'stage'
  g._stageId = null             // 当前关卡 ID
  g._stageWaves = []            // 当前关卡波次配置
  g._stageWaveIdx = 0           // 当前波次索引
  g._stageTeam = []             // 编队灵宠 ID 列表
  g._stageTeamSelected = []     // 编队页已选宠物
  g._stageTeamFilter = 'all'    // 编队属性筛选
  g._showWeaponPicker = false   // 编队页法宝选择浮层
  g._stageTeamScroll = 0        // 编队列表滚动
  g._stageTotalTurns = 0        // 关卡总回合数（跨波次累计）
  g._stageSettlePending = false  // 防止重复结算
  g._stageResult = null         // 结算数据
  g._waveTransTimer = 0         // 波间过渡倒计时
  g._stageSelectScroll = 0      // 关卡选择页滚动
  g._selectedStageId = null     // 选中准备编队的关卡
  g._selectedStageIdx = 0       // 首页秘境内嵌选关：当前展示关卡在可浏览列表中的索引
  g._stageIdxInitialized = false // 是否已自动定位过初始关卡
  g._stageSwipeStartX = 0      // 滑动手势起始 X
  g._stageSwipeStartY = 0      // 滑动手势起始 Y
  g._stageSwipeDeltaX = 0      // 实时滑动偏移（用于渲染动画）
  g._stageSwipeActive = false   // 是否正在滑动中
  g._stageInfoEnemyDetail = null // 关卡信息页 - 点击敌人查看详情
  g._stageInfoPetDetail = null  // 关卡信息页 - 长按/点击宠物查看详情
  g._stageTeamPetDetail = null  // 编队页 - 长按宠物查看详情
  g._stageTeamReturnScene = null // 编队页返回目标场景（null 默认回 stageInfo）

  // ===== 域分组子对象（向后兼容：g.xxx 和 g.domain.xxx 双向可用）=====
  _createDomainProxies(g)
}

/**
 * 为指定域创建 getter/setter 代理子对象
 * 新代码推荐使用 g.battle.xxx，旧代码 g.xxx 仍可正常工作
 */
function _createDomainProxy(g, domain, fields) {
  const sub = {}
  for (const f of fields) {
    Object.defineProperty(sub, f, {
      get() { return g[f] },
      set(v) { g[f] = v },
      enumerable: true,
    })
  }
  g[domain] = sub
}

function _createDomainProxies(g) {
  _createDomainProxy(g, 'battle', [
    'bState', '_stateTimer', '_enemyTurnWait', '_pendingEnemyAtk',
    '_pendingDmgMap', '_pendingHeal', 'combo', 'turnCount',
    'elimQueue', 'elimAnimCells', 'elimAnimTimer',
    'dropAnimTimer', 'dropAnimCols',
  ])

  _createDomainProxy(g, 'anim', [
    'dmgFloats', 'skillEffects', 'elimFloats',
    '_comboAnim', '_comboParticles', '_comboFlash',
    '_petFinalDmg', '_petAtkRollTimer',
    'shakeT', 'shakeI', 'shakeDecay', '_hitStopFrames',
    '_screenFlash', '_screenFlashMax', '_screenFlashColor', '_enemyTintFlash',
    'heroAttackAnim', 'enemyHurtAnim', 'heroHurtAnim', 'enemyAttackAnim', 'skillCastAnim',
    '_enemyHpLoss', '_heroHpLoss', '_heroHpGain', '_enemyHitFlash',
    '_enemyDeathAnim', '_blockFlash', '_heroHurtFlash', '_enemyWarning',
    '_counterFlash', '_bossEntrance',
  ])

  _createDomainProxy(g, 'drag', [
    'dragging', 'dragR', 'dragC', 'dragStartX', 'dragStartY',
    'dragCurX', 'dragCurY', 'dragAttr', 'dragTimer', 'dragTimeLimit', 'swapAnim',
  ])

  _createDomainProxy(g, 'run', [
    'floor', 'pets', 'weapon', 'petBag', 'weaponBag',
    'heroHp', 'heroMaxHp', 'heroShield', 'heroBuffs', 'enemyBuffs',
    'enemy', 'curEvent', 'rewards', 'shopItems', 'restOpts',
    'adventureData', 'selectedReward', 'rewardPetSlot',
  ])

  _createDomainProxy(g, 'ui', [
    '_loadStart', '_loadReady', '_loadPct', '_pendingGuide', '_pressedBtn',
    '_petLongPressTimer', '_petLongPressIndex', '_petLongPressTriggered',
    '_petSwipeIndex', '_petSwipeStartX', '_petSwipeStartY', '_petSwipeTriggered',
    'skillPreview', 'showExitDialog', 'showNewRunConfirm',
    'showMorePanel', 'showTitleStartDialog', 'showSidebarPanel',
    'titleMode', 'titleTowerIndex', 'shopUsed',
  ])

  _createDomainProxy(g, 'stage', [
    'battleMode', '_stageId', '_stageWaves', '_stageWaveIdx',
    '_stageTeam', '_stageTeamSelected', '_stageTeamFilter', '_stageTeamScroll', '_showWeaponPicker',
    '_stageTotalTurns', '_stageResult', '_waveTransTimer',
    '_stageSelectScroll', '_selectedStageId',
    '_stageInfoEnemyDetail', '_stageInfoPetDetail', '_stageTeamPetDetail',
  ])

  _createDomainProxy(g, 'petPool', [
    '_petPoolEntryPopup', '_fragmentObtainedPopup',
    '_petPoolFilter', '_petPoolScroll', '_petPoolDetail',
    '_petDetailId', '_petDetailReturnScene', '_petPoolLevelUpAnim',
    '_lastRunSoulStone', '_petPoolBtnRect',
  ])

  _createDomainProxy(g, 'buffs', [
    'runBuffLog', 'runBuffs', 'skipNextBattle', 'nextStunEnemy',
    'nextDmgDouble', 'tempRevive', 'immuneOnce',
    'comboNeverBreak', 'weaponReviveUsed', 'goodBeadsNextTurn',
  ])
}

module.exports = { initState }
