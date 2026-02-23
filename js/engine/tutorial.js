/**
 * 新手教学引擎 — 4步试炼关卡（支持多回合）
 * Step 0: 转珠基础（拖珠消除）
 * Step 1: 回合1 Combo连击 → 回合2 心珠回血（被打伤后）
 * Step 2: 回合1 克制属性高伤 → 回合2 被克属性伤害减半
 * Step 3: 宠物技能释放
 *
 * 每步使用固定棋盘布局 + 弱敌 + 引导箭头
 * 支持多回合：rounds[] 数组，每回合独立棋盘/引导/消息
 * 教学结束后正式进入第1层
 */
const V = require('../views/env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { PETS, petHasSkill, generateStarterPets } = require('../data/pets')
const MusicMgr = require('../runtime/music')
const { generateStarterWeapon } = require('../data/weapons')

// 教学专用固定5只宠物（每属性取第一只基础宠物，保证五行齐全）
function _makeTutorialPets() {
  const picks = ['metal','wood','water','fire','earth'].map(attr => {
    const p = PETS[attr][0]
    return { ...p, attr, star: 1, currentCd: 0 }
  })
  return picks
}

// ===== 教学步骤定义 =====
// 简写：m=金 w=木 e=土 s=水 f=火 h=心
// rounds[]: 多回合教学，每回合有独立 board/guide/msg
// 无 rounds 的步骤视为单回合（使用顶层 board/guide/msg）
const STEPS = [
  {
    id: 0,
    title: '转珠基础',
    board: [
      ['w','f','e','s','w','f'],
      ['s','e','w','f','e','s'],
      ['f','m','m','w','e','w'],
      ['e','f','s','w','s','e'],
      ['w','s','e','f','e','m'],
    ],
    // 拖[4,5]金珠沿L形长路径到[2,3]：经过5格，沿途连续交换
    // 最终Row2: f,m,m,m,e,e → 3连金消除
    guide: { fromR:4, fromC:5, toR:2, toC:3, path:[[4,5],[3,5],[2,5],[2,4],[2,3]] },
    enemy: { name:'训练木偶', attr:'wood', hp:1, maxHp:1, atk:0, def:0, skills:[], avatar:'enemies/mon_w_1', _tutorial:true },
    msg: [
      { text:'按住灵珠沿路径拖动，沿途灵珠会依次交换！', timing:'start' },
      { text:'灵珠归位，三连消除！这就是转珠！', timing:'afterElim' },
    ],
  },
  {
    id: 1,
    title: 'Combo与心珠',
    // 多回合：回合1教Combo，回合2教心珠回血
    rounds: [
      {
        // 回合1：消3金+3木 = Combo×2，不涉及心珠
        board: [
          ['f','s','w','e','f','s'],
          ['e','m','m','w','s','e'],   // [1][1][2]金 → 拖[2][3]金上来凑3连
          ['s','f','e','m','w','f'],   // [2][3]金珠
          ['w','e','w','w','w','s'],   // [3][2][3][4]木珠3连（自动触发）
          ['f','e','s','f','e','w'],
        ],
        // 拖[2][3]金上到[1][3]，w被推到[2][3]，row1变 e m m m s e → 3连金
        // row3的www保持 → Combo×2
        guide: { fromR:2, fromC:3, toR:1, toC:3, path:[[2,3],[1,3]] },
        msg: [
          { text:'一次消除多组灵珠可触发连击Combo！', timing:'start' },
          { text:'Combo越多伤害越高，试试吧！', timing:'afterElim' },
        ],
      },
      {
        // 回合2：被打伤后，消心珠回血
        board: [
          ['f','s','w','e','f','s'],
          ['e','w','f','s','w','e'],
          ['s','h','f','h','s','w'],   // [2][1]心 [2][3]心
          ['w','f','h','m','e','f'],   // [3][2]心珠 → 拖上去凑3连
          ['f','e','s','w','f','e'],
        ],
        // 拖[3][2]心上到[2][2]，f被推到[3][2]，row2变 s h h h s w → 3连心
        guide: { fromR:3, fromC:2, toR:2, toC:2, path:[[3,2],[2,2]] },
        msg: [
          { text:'受伤了！消除粉色心珠可以回血', timing:'start' },
          { text:'心珠是你的生命线，记得及时回血！', timing:'afterElim' },
        ],
      },
    ],
    enemy: { name:'训练木偶', attr:'earth', hp:200, maxHp:200, atk:30, def:0, skills:[], avatar:'enemies/mon_e_1', _tutorial:true, _tutorAtk:true },
    msg: [
      { text:'一次消除多组灵珠可触发连击Combo！', timing:'start' },
    ],
  },
  {
    id: 2,
    title: '五行克制',
    // 多回合：回合1教克制高伤，回合2教被克减伤
    rounds: [
      {
        // 回合1：消金珠打木怪 → 金克木 2.5x
        board: [
          ['m','s','e','f','w','s'],
          ['e','m','m','w','f','e'],
          ['s','f','e','m','s','w'],
          ['w','e','w','f','w','f'],
          ['f','w','s','e','e','s'],
        ],
        guide: { fromR:2, fromC:3, toR:1, toC:3, path:[[2,3],[1,3]] },
        msg: [
          { text:'对手是木属性！金克木，伤害x2.5！', timing:'start' },
          { text:'克制属性造成超高伤害！', timing:'afterElim' },
        ],
      },
      {
        // 回合2：消土珠打木怪 → 土被木克（COUNTER_BY[earth]=wood），伤害×0.5
        board: [
          ['w','s','f','m','w','s'],
          ['f','e','e','w','m','f'],   // [1][1][2]土珠
          ['s','w','f','e','s','m'],   // [2][3]土珠 → 拖上去凑3连
          ['w','f','m','s','w','e'],
          ['f','w','s','f','e','s'],
        ],
        // 拖[2][3]土上到[1][3]，w被推到[2][3]，row1变 f e e e m f → 3连土
        guide: { fromR:2, fromC:3, toR:1, toC:3, path:[[2,3],[1,3]] },
        msg: [
          { text:'这次试试用土珠攻击木属性敌人', timing:'start' },
          { text:'木克土，伤害只有一半！要避开被克属性！', timing:'afterElim' },
        ],
      },
    ],
    enemy: { name:'木灵花妖', attr:'wood', hp:200, maxHp:200, atk:0, def:0, skills:[], avatar:'enemies/mon_w_1', _tutorial:true },
    msg: [
      { text:'对手是木属性！金克木，伤害x2.5！', timing:'start' },
    ],
  },
  {
    id: 3,
    title: '宠物技能',
    board: [
      ['m','f','s','e','w','f'],
      ['e','s','w','s','e','m'],
      ['f','m','s','f','s','w'],
      ['w','e','f','s','f','e'],
      ['m','f','e','w','e','s'],
    ],
    guide: null,
    enemy: { name:'训练傀儡', attr:'earth', hp:80, maxHp:80, atk:5, def:0, skills:[], avatar:'enemies/mon_e_2', _tutorial:true },
    msg: [
      { text:'宠物技能就绪时，从头像向上滑动释放！', timing:'skillReady' },
    ],
    _tutorPetAttr: 'earth',  // 指定教学使用土宠物技能
  },
]

// ===== 教学状态 =====
let _active = false
let _step = 0
let _round = 0       // 当前步骤内的回合索引
let _phase = 'intro'  // 'intro' | 'play' | 'msg' | 'done'
let _msgIdx = 0
let _msgTimer = 0
let _introTimer = 0
let _arrowTimer = 0
let _fingerX = 0, _fingerY = 0
let _fingerAnimating = false
let _afterElimShown = false
let _guideDone = false  // 当前步引导是否已完成（允许自由操作）
let _victoryMsgTimer = 0
let _summaryShown = false  // 最终总结
let _roundTransitTimer = 0  // 回合切换等待计时器

// 获取当前回合数据（支持多回合和单回合）
function _getCurRound() {
  const step = STEPS[_step]
  if (!step) return null
  if (step.rounds && step.rounds.length > 0) {
    return step.rounds[_round] || null
  }
  // 单回合：返回step本身
  return { board: step.board, guide: step.guide, msg: step.msg }
}

function _getTotalRounds() {
  const step = STEPS[_step]
  if (!step) return 1
  return step.rounds ? step.rounds.length : 1
}

// 判断教学是否活跃
function isActive() { return _active }
function getStep() { return _step }
function getPhase() { return _phase }
function isSummary() { return _summaryShown }

// 开始教学
function start(g) {
  _active = true
  _step = 0
  _round = 0
  _phase = 'intro'
  _introTimer = 0
  _summaryShown = false
  _roundTransitTimer = 0
  // 教学使用固定5只不同属性宠物，无法宝
  g._realPets = null
  g.pets = _makeTutorialPets()
  g.weapon = null
  g.weaponBag = []
  _setupStep(g)
}

// 设置当前步骤
function _setupStep(g) {
  const step = STEPS[_step]
  if (!step) { finish(g); return }
  _round = 0
  _phase = 'intro'
  _introTimer = 0
  _msgIdx = 0
  _msgTimer = 0
  _arrowTimer = 0
  _afterElimShown = false
  _guideDone = false
  _victoryMsgTimer = 0
  _roundTransitTimer = 0
  // 设置敌人
  g.enemy = { ...step.enemy }
  g._baseHeroMaxHp = g.heroMaxHp
  g.enemyBuffs = []
  g.bState = 'playerTurn'
  g.rewards = null; g.selectedReward = -1; g._rewardDetailShow = null
  g.combo = 0; g.turnCount = 0
  g.enemySkillCd = -1; g._nextEnemySkill = null
  g.lastSpeedKill = false; g.lastTurnCount = 0
  g._pendingDmgMap = null; g._pendingHeal = 0; g._pendingAttrMaxCount = null
  g._pendingEnemyAtk = null
  g.elimQueue = []; g.elimAnimCells = null
  g.elimFloats = []; g.petAtkNums = []
  g._enemyHpLoss = null; g._heroHpLoss = null; g._heroHpGain = null
  g.showEnemyDetail = false; g.showRunBuffDetail = false
  g.showWeaponDetail = false; g.showBattlePetDetail = null
  g.heroBuffs = []; g.enemyBuffs = []
  // Step 3: 强制指定属性宠物★2且CD=0（用于教学技能释放）
  if (_step === 3) {
    const tutorAttr = step._tutorPetAttr || null
    let found = false
    if (tutorAttr) {
      for (let i = 0; i < g.pets.length; i++) {
        if (g.pets[i].attr === tutorAttr && g.pets[i].skill) {
          g.pets[i].star = 2
          g.pets[i].currentCd = 0
          found = true
          break
        }
      }
    }
    if (!found) {
      for (let i = 0; i < g.pets.length; i++) {
        if (g.pets[i].skill) {
          g.pets[i].star = 2
          g.pets[i].currentCd = 0
          break
        }
      }
    }
    if (!g.pets.some(p => petHasSkill(p))) {
      g.pets[0].star = 2
      g.pets[0].currentCd = 0
    }
  }
  // 设置当前回合棋盘
  _setupRoundBoard(g)
  // 计算转珠时间
  let extraTime = g.runBuffs.extraTimeSec || 0
  if (g.weapon && g.weapon.type === 'extraTime') extraTime += g.weapon.sec
  g.dragTimeLimit = (8 + extraTime) * 60
  g.scene = 'battle'
}

// 设置当前回合的棋盘
function _setupRoundBoard(g) {
  const rd = _getCurRound()
  if (!rd || !rd.board) return
  const { ROWS, COLS } = V
  const attrMap = { m:'metal', w:'wood', e:'earth', s:'water', f:'fire', h:'heart' }
  g.board = []
  for (let r = 0; r < ROWS; r++) {
    g.board[r] = []
    for (let c = 0; c < COLS; c++) {
      const shortAttr = rd.board[r][c]
      g.board[r][c] = { attr: attrMap[shortAttr] || shortAttr, sealed: false }
    }
  }
}

// 切换到下一回合（同一步骤内）
function _advanceRound(g) {
  _round++
  _arrowTimer = 0
  _afterElimShown = false
  _guideDone = false
  _roundTransitTimer = 0
  // 进入intro阶段显示回合开始消息
  _phase = 'intro'
  _introTimer = 0
  // 重设棋盘为新回合的布局
  _setupRoundBoard(g)
  g.bState = 'playerTurn'
  g.combo = 0
  g.elimQueue = []; g.elimAnimCells = null
  g.elimFloats = []; g.petAtkNums = []
  g._pendingDmgMap = null; g._pendingHeal = 0; g._pendingAttrMaxCount = null
  g._pendingEnemyAtk = null
  g._enemyHpLoss = null; g._heroHpLoss = null; g._heroHpGain = null
  // 重新计算转珠时间
  let extraTime = g.runBuffs.extraTimeSec || 0
  if (g.weapon && g.weapon.type === 'extraTime') extraTime += g.weapon.sec
  g.dragTimeLimit = (8 + extraTime) * 60
}

// 教学中每帧更新
function update(g) {
  if (!_active) return
  _arrowTimer++
  if (_phase === 'intro') {
    _introTimer++
    if (_introTimer > 90) {
      _phase = 'play'
    }
  }
  // 检测胜利后的步骤切换
  if (g.bState === 'victory') {
    _victoryMsgTimer++
    g.rewards = null
  }
}

// 触摸拦截：教学intro阶段点击跳过
function onIntroTap(g) {
  if (_phase === 'intro') {
    _phase = 'play'
    return true
  }
  return false
}

// 教学中胜利处理
function onVictory(g) {
  if (!_active) return false
  if (_summaryShown) return true  // 已在总结页，不再处理
  g.rewards = null  // 教学中始终阻止奖励生成
  if (_victoryMsgTimer > 60) {
    _step++
    if (_step >= STEPS.length) {
      _showSummary(g)
    } else {
      _setupStep(g)
    }
    return true
  }
  return true  // 阻止正常胜利流程
}

// 教学奖励确认（已禁用，保留接口）
function onRewardConfirm(g) {
  // 教学中不再有奖励选择
}

function _showSummary(g) {
  _summaryShown = true
  _phase = 'summary'
}

// 点击总结页完成教学
function onSummaryTap(g) {
  if (_summaryShown) {
    finish(g)
    return true
  }
  return false
}

// 结束教学
function finish(g) {
  _active = false
  _summaryShown = false
  _step = 0
  _round = 0
  _phase = 'done'
  // 标记教学已完成
  try { wx.setStorageSync('tutorialDone', true) } catch(e) {}
  // 重新正式开始（从第1层）
  const runMgr = require('./runManager')
  g.heroHp = 100; g.heroMaxHp = 100; g.heroShield = 0
  g._baseHeroMaxHp = null
  g.heroBuffs = []; g.enemyBuffs = []
  g.enemy = null
  g.bState = 'none'
  // 正式开局：随机4只宠物（从本局宠物池），赠送一件基础法宝
  g.pets = generateStarterPets(g.sessionPetPool)
  g.weapon = generateStarterWeapon()
  g.weaponBag = []
  g.petBag = []
  // 标记：第1层显示说明文字
  g._tutorialJustDone = true
  runMgr.nextFloor(g)
}

// 消除后通知
function onElim(g) {
  if (!_active) return
  _afterElimShown = true
  _guideDone = true
}

// 敌人回合结束后调用：检查是否需要切换回合
function onEnemyTurnEnd(g) {
  if (!_active) return
  const total = _getTotalRounds()
  if (total <= 1) return  // 单回合步骤不需要回合切换
  if (_round < total - 1 && g.enemy && g.enemy.hp > 0) {
    // 还有下一回合，且敌人还活着 → 直接切换到下一回合
    _advanceRound(g)
  } else if (_round >= total - 1 && g.enemy && g.enemy.hp > 0) {
    // 最后一个回合完成，敌人还活着 → 强制击杀进入胜利
    g.enemy.hp = 0
    g.lastTurnCount = g.turnCount; g.lastSpeedKill = false
    MusicMgr.playVictory()
    g.bState = 'victory'
    g._enemyDeathAnim = { timer: 0, duration: 45 }
  }
}

// 检查是否允许拖动指定珠子（教学锁定）
function canDrag(g, r, c) {
  if (!_active) return true
  if (_phase !== 'play') return false
  const rd = _getCurRound()
  if (!rd || !rd.guide) return true
  if (_guideDone) return true
  return r === rd.guide.fromR && c === rd.guide.fromC
}

// 教学中敌人攻击行为
function shouldEnemyAttack(g) {
  if (!_active) return true
  const step = STEPS[_step]
  if (!step || !step.enemy._tutorAtk) return false
  // 多回合步骤：每个回合消除后敌人都会攻击
  return true
}

// 获取当前步骤引导数据（用于渲染）
function getGuideData() {
  if (!_active) return null
  // 总结页时 _step 已越界，不依赖 STEPS[_step]
  if (_summaryShown) {
    return {
      step: _step,
      round: _round,
      totalRounds: 1,
      title: '教学完成',
      guide: null,
      msgs: [],
      phase: _phase,
      introTimer: _introTimer,
      arrowTimer: _arrowTimer,
      afterElimShown: false,
      guideDone: true,
      victoryTimer: _victoryMsgTimer,
      isSummary: true,
      roundTransitTimer: 0,
    }
  }
  const step = STEPS[_step]
  if (!step) return null
  const rd = _getCurRound()
  return {
    step: _step,
    round: _round,
    totalRounds: _getTotalRounds(),
    title: step.title,
    guide: rd ? rd.guide : null,
    msgs: rd ? rd.msg : (step.msg || []),
    phase: _phase,
    introTimer: _introTimer,
    arrowTimer: _arrowTimer,
    afterElimShown: _afterElimShown,
    guideDone: _guideDone,
    victoryTimer: _victoryMsgTimer,
    isSummary: _summaryShown,
    roundTransitTimer: _roundTransitTimer,
  }
}

// 跳过整个教学
function skip(g) {
  if (!_active) return
  _active = false
  _summaryShown = false
  finish(g)
}

// 检查是否需要教学
function needsTutorial() {
  try {
    return !wx.getStorageSync('tutorialDone')
  } catch(e) { return true }
}

module.exports = {
  STEPS,
  isActive, getStep, getPhase, isSummary, needsTutorial,
  start, finish, update, onIntroTap, onVictory, onRewardConfirm, onSummaryTap,
  onElim, onEnemyTurnEnd, canDrag, shouldEnemyAttack, getGuideData, skip,
}
