/**
 * 战斗引擎：消除核心、攻击结算、敌方回合、棋盘管理
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const {
  ATTR_COLOR, ATTR_NAME, BEAD_ATTRS, COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL,
  ENEMY_SKILLS, EVENT_TYPE, ADVENTURES, getBeadWeights,
} = require('../data/tower')
const { getPetStarAtk, petHasSkill } = require('../data/pets')
const tutorial = require('./tutorial')
const { tween, Ease } = require('./tween')
const Particles = require('./particles')
const { killExpBase } = require('../data/cultivationConfig')
const { COMBO_MILESTONES, COMBO_MILESTONE_INTERVAL, getComboTier, isComboMilestone } = require('../data/constants')
const DF = require('./dmgFloat')
const { buildDamageContext } = require('./battle/damageContext')
const {
  emitNotice,
  emitFloat,
  emitShake,
  emitFlash,
  emitCast,
} = require('./battle/fxEmitter')
const {
  getComboMul: getSharedComboMul,
  calcCritFromCtx,
  resolveCritFromCtx,
  calcHealFromCtx,
  calcTotalDamage,
  calcPetDisplayBreakdown,
} = require('./battle/damageFormula')
const { getCritFxPlan } = require('./battle/critFxConfig')
const {
  COMBO_MUL_BREAKPOINTS, ELIM_MUL_4, ELIM_MUL_5,
  HEAL_BASE, HEAL_FLOOR_COEFF,
  LOW_HP_BURST, CRIT_BASE_DMG, CRIT_MAX_RATE,
  ATK_REDUCE_FLOOR, NEXT_DMG_DOUBLE_MUL, HEART_BOOST_DEFAULT_MUL,
  SPEED_KILL_TURNS, DRAG_BASE_SEC, STUN_BASE_DUR,
  SHIELD_ON_ELIM_DEFAULT, EXECUTE_DEFAULT_THRESHOLD,
  LOW_HP_DMG_UP_DEFAULT_THRESHOLD, AOE_ON_ELIM_HP_RATIO, AOE_ON_ELIM_MIN_COUNT,
  ENEMY_SKILL_CD_RESET, ENEMY_FIRST_SKILL_DELAY,
  NEWBIE_PET_ATTR_WEIGHT, GOOD_BEADS_WEIGHT,
  ENEMY_AOE_DEFAULT_ATK_PCT, ENEMY_SELF_HEAL_DEFAULT_PCT,
  ENEMY_SEAL_DEFAULT_DUR, ENEMY_DOT_ATK_RATIO,
  BOSS_QUAKE_DEFAULT_ATK_PCT, BOSS_QUAKE_SEAL_DUR_DEFAULT,
  BOSS_DEVOUR_DEFAULTS, BOSS_DOT_DEFAULTS, BOSS_MIRROR_DEFAULTS,
  BOSS_WEAKEN_DEFAULTS, BOSS_BLITZ_DEFAULTS, BOSS_DRAIN_DEFAULT_ATK_PCT,
  BOSS_ANNIHIL_DEFAULTS, BOSS_CURSE_DEFAULTS, BOSS_ULTIMATE_DEFAULTS,
  PET_CD_INIT_RATIO, PET_CD_INIT_OFFSET,
} = require('../data/balance/combat')

// 击杀经验（统一调用避免遗漏）
function _addKillExp(g) {
  if (!g.enemy) return
  const { S, W } = V
  const base = killExpBase(g.enemy, g.floor)
  g.runExp = (g.runExp || 0) + base
  g._runKillExp = (g._runKillExp || 0) + base
  // 击杀经验飘字：从敌人区域中心飞出
  if (g._expFloats) {
    const ex = W * 0.5
    const ey = (V.safeTop || 0) + 80 * S
    g._expFloats.push({
      startX: ex, startY: ey,
      targetX: g._expIndicatorX || 30 * S, targetY: g._expIndicatorY || 60 * S,
      text: `+${base}`, t: 0, duration: 36,
      alpha: 1, color: '#FF8C00',
    })
    // 击杀粒子爆发
    Particles.burst({
      x: ex, y: ey, count: 8, speed: 3 * S,
      size: 4 * S, life: 20, gravity: 0.1 * S,
      colors: ['#FFD700', '#FFA500', '#fff'], shape: 'star',
    })
  }
}

// ===== 棋盘 =====
// 新手 1-1 棋盘偏向：提升宠物属性珠权重，减少无用色
function _applyNewbieBias(g, weights) {
  if (!g._isNewbieStage) return
  g.pets.forEach(p => { if (weights[p.attr] !== undefined) weights[p.attr] = NEWBIE_PET_ATTR_WEIGHT })
}

function initBoard(g) {
  const { ROWS, COLS } = V
  const weights = getBeadWeights(g.enemy ? g.enemy.attr : null, g.weapon)
  if (g.goodBeadsNextTurn) {
    g.goodBeadsNextTurn = false
    g.pets.forEach(p => { if (weights[p.attr] !== undefined) weights[p.attr] *= GOOD_BEADS_WEIGHT })
  }
  _applyNewbieBias(g, weights)
  const pool = []; for (const [attr, w] of Object.entries(weights)) { for (let i = 0; i < Math.round(w*10); i++) pool.push(attr) }
  g.board = []
  for (let r = 0; r < ROWS; r++) {
    g.board[r] = []
    for (let c = 0; c < COLS; c++) {
      let attr
      let tries = 0
      do { attr = pool[Math.floor(Math.random()*pool.length)]; tries++ } while (tries < 30 && wouldMatch(g, r, c, attr))
      g.board[r][c] = { attr, sealed: false }
    }
  }
}

function wouldMatch(g, r, c, attr) {
  if (c >= 2 && cellAttr(g,r,c-1) === attr && cellAttr(g,r,c-2) === attr) return true
  if (r >= 2 && cellAttr(g,r-1,c) === attr && cellAttr(g,r-2,c) === attr) return true
  return false
}

function cellAttr(g, r, c) {
  const cell = g.board[r] && g.board[r][c]
  if (!cell) return null
  return typeof cell === 'string' ? cell : cell.attr
}

function fillBoard(g) {
  const { ROWS, COLS } = V
  const weights = getBeadWeights(g.enemy ? g.enemy.attr : null, g.weapon)
  if (g.goodBeadsNextTurn) {
    g.goodBeadsNextTurn = false
    g.pets.forEach(p => { if (weights[p.attr] !== undefined) weights[p.attr] *= GOOD_BEADS_WEIGHT })
  }
  _applyNewbieBias(g, weights)
  const pool = []; for (const [attr, w] of Object.entries(weights)) { for (let i = 0; i < Math.round(w*10); i++) pool.push(attr) }
  // 记录每列最大掉落距离（用于瀑布错开延迟）
  let maxDrop = 0
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1
    for (let r = ROWS-1; r >= 0; r--) {
      if (g.board[r][c]) {
        const dropDist = writeRow - r
        if (writeRow !== r) {
          g.board[writeRow][c] = g.board[r][c]; g.board[r][c] = null
          // 已有珠子下落补间
          if (dropDist > 0) _startDropTween(g, g.board[writeRow][c], dropDist, c)
        }
        if (dropDist > maxDrop) maxDrop = dropDist
        writeRow--
      }
    }
    // 新生成的珠子从顶部外掉入
    for (let r = writeRow; r >= 0; r--) {
      const cell = { attr: pool[Math.floor(Math.random()*pool.length)], sealed: false }
      g.board[r][c] = cell
      const dropDist = writeRow + 1 - r + 1 // 从屏幕外掉入
      _startDropTween(g, cell, dropDist, c)
      if (dropDist > maxDrop) maxDrop = dropDist
    }
  }
  g._dropMaxDist = maxDrop
}

/** 为珠子启动掉落补间动画 */
function _startDropTween(g, cell, dropDist, col) {
  const cs = g.cellSize || 1
  const offsetY = -dropDist * cs
  cell._dropOffY = offsetY
  // 瀑布错开：每列 20ms 延迟
  const delay = col * 0.02
  const duration = 0.2 + dropDist * 0.04
  tween(cell, { _dropOffY: 0 }, duration, Ease.outBounce, { delay })
}

// ===== 消除核心 =====
function checkAndElim(g) {
  const groups = findMatchesSeparate(g)
  if (groups.length > 0) {
    if (!g._pendingDmgMap) { g._pendingDmgMap = {}; g._pendingHeal = 0; if (!g.comboNeverBreak) g.combo = 0; g._pendingAttrMaxCount = {} }
    g.elimQueue = groups
    if (tutorial.isActive()) tutorial.onElim(g)
    startNextElimAnim(g)
  } else if (g.combo > 0) {
    enterPetAtkShow(g)
  } else {
    g.bState = 'preEnemy'; g._stateTimer = 0
  }
}

function startNextElimAnim(g) {
  const { S, W, ROWS, COLS } = V
  if (g.elimQueue.length === 0) {
    g.bState = 'dropping'; g.dropAnimTimer = 0
    fillBoard(g)
    return
  }
  const group = g.elimQueue.shift()
  const { attr, count, cells } = group
  // 修炼经验：每组消除累加
  const elimExp = count >= 5 ? 3 : count >= 4 ? 2 : 1
  g.runExp = (g.runExp || 0) + elimExp
  g._runElimExp = (g._runElimExp || 0) + elimExp
  // 移除combo断链：所有消除都计入combo（大幅提升爽感）
  g.combo++
  // 新手首关：每次达成 combo 里程碑时弹庆祝横幅（逐级升级）
  if (g._isNewbieStage && g.combo >= 2) {
    var _cb = g.combo
    if (_cb === 2 || _cb === 3 || _cb === 5 || (_cb >= 7 && _cb % 2 === 1)) {
      g._newbieComboBanner = { timer: 0, combo: _cb }
    }
  }
  // 修炼经验：每段 combo
  g.runExp += 2
  g._runComboExp = (g._runComboExp || 0) + 2
  // 经验飘字：从消除中心飞向左上角指示器
  if (g._expFloats && cells.length > 0) {
    let sumX = 0, sumY = 0
    for (const cell of cells) {
      sumX += g.boardX + cell.c * g.cellSize + g.cellSize * 0.5
      sumY += g.boardY + cell.r * g.cellSize + g.cellSize * 0.5
    }
    const cx = sumX / cells.length, cy = sumY / cells.length
    const totalExp = elimExp + 2
    // 限制同屏飘字数量
    if (g._expFloats.length < 6) {
      g._expFloats.push({
        startX: cx, startY: cy,
        targetX: g._expIndicatorX || 30 * S, targetY: g._expIndicatorY || 60 * S,
        text: `+${totalExp}`, t: 0, duration: 28,
        alpha: 1, color: '#FFD700',
      })
    }
  }
  // Combo弹出动画（使用配置的分档）
  const tier = getComboTier(g.combo)
  const isTierBreak = isComboMilestone(g.combo)
  g._comboAnim = { num: g.combo, timer: 0, scale: 2.9, _initScale: 2.9, alpha: 1, offsetY: 0 }
  g._comboFlash = tier >= 3 ? 18 : tier >= 1 ? 14 : 10
  if (isTierBreak) {
    g._comboFlash = tier >= 4 ? 24 : 20
    g._comboAnim.scale = 4.0; g._comboAnim._initScale = 4.0
  }
  // ★ Combo里程碑：仅保留视觉特效提示，不再给予隐藏的buff/护盾/回血
  // 粒子数量根据 tier 递增，并整体加重爆发感
  const pCount = (tier >= 4 ? 30 : tier >= 3 ? 24 : tier >= 2 ? 18 : tier >= 1 ? 13 : 8) + (isTierBreak ? 12 : 0)
  const pCx = W * 0.5, pCy = g.boardY + (ROWS * g.cellSize) * 0.32
  const pColors = tier >= 4 ? ['#ff2050','#ff6040','#ffaa00','#fff','#ff80aa']
    : tier >= 3 ? ['#ff4d6a','#ff8060','#ffd700','#fff']
    : tier >= 2 ? ['#ff8c00','#ffd700','#fff','#ffcc66']
    : tier >= 1 ? ['#4d88ff','#ffd700','#fff','#8ec5ff']
    : ['#ffd700','#ffe066','#fff']
  const speedMul = tier >= 4 ? 1.8 : tier >= 3 ? 1.65 : tier >= 2 ? 1.5 : tier >= 1 ? 1.25 : 1.05
  const sizeMul = tier >= 4 ? 1.55 : tier >= 3 ? 1.42 : tier >= 2 ? 1.28 : tier >= 1 ? 1.12 : 1
  const starChance = tier >= 2 ? 0.42 : 0.3
  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = (2.4 + Math.random() * 4.6) * S * speedMul
    g._comboParticles.push({
      x: pCx, y: pCy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (1.2 + Math.random() * 2.3) * S,
      size: (2.4 + Math.random() * 3.2) * S * sizeMul,
      color: pColors[Math.floor(Math.random() * pColors.length)],
      life: 24 + Math.floor(Math.random() * 22),
      t: 0, gravity: 0.14 * S,
      type: Math.random() < starChance ? 'star' : 'circle'
    })
  }
  if (isTierBreak) {
    const ringCount = tier >= 4 ? 28 : tier >= 3 ? 24 : tier >= 2 ? 20 : 14
    const ringColors = tier >= 4 ? ['#fff','#ff80aa','#ffcc00','#ff4060'] : tier >= 3 ? ['#fff','#9d4dff','#ffd700'] : tier >= 2 ? ['#fff','#ffd700','#ff6080'] : ['#fff','#4d88ff','#ffd700']
    Particles.ring({
      x: pCx, y: pCy,
      count: ringCount, speed: (6 + g.combo * 0.34) * S,
      size: (5 + g.combo * 0.22) * S, life: 34, gravity: 0.03 * S,
      colors: ringColors, shape: 'star', drag: 0.97,
    })
  }
  MusicMgr.playComboHit(g.combo)
  if (isTierBreak) MusicMgr.playComboMilestone(g.combo)
  
  // 屏幕震动：里程碑震动更强（使用配置的最大阈值作为档位边界）
  const maxThreshold = COMBO_MILESTONES[COMBO_MILESTONES.length - 1]?.threshold || 12
  const isMilestone = g.combo % COMBO_MILESTONE_INTERVAL === 0
  if (g.combo >= maxThreshold) { 
    g.shakeT = isMilestone ? 18 : 12; 
    g.shakeI = (isMilestone ? 10 : 7) * S 
  }
  else if (g.combo >= maxThreshold * 0.75) { 
    g.shakeT = isMilestone ? 16 : 10; 
    g.shakeI = (isMilestone ? 8 : 6) * S 
  }
  else if (g.combo >= maxThreshold * 0.5) { 
    g.shakeT = isMilestone ? 14 : 8; 
    g.shakeI = (isMilestone ? 7 : 5) * S 
  }
  else if (g.combo >= maxThreshold * 0.25) { 
    g.shakeT = isMilestone ? 12 : 6; 
    g.shakeI = (isMilestone ? 5 : 3) * S 
  }
  if (g.runBuffs.bonusCombo > 0 && g.combo === 1) { g.combo += g.runBuffs.bonusCombo }
  // 消除倍率
  let elimMul = 1.0
  if (count === 4) elimMul = ELIM_MUL_4
  else if (count >= 5) elimMul = ELIM_MUL_5
  if (count === 3) elimMul *= 1 + g.runBuffs.elim3DmgPct / 100
  if (count === 4) elimMul *= 1 + g.runBuffs.elim4DmgPct / 100
  if (count >= 5) elimMul *= 1 + g.runBuffs.elim5DmgPct / 100
  if (count >= 5 && g.enemy) {
    const stunDur = STUN_BASE_DUR + g.runBuffs.stunDurBonus
    const hasStun = g.enemyBuffs.some(b => b.type === 'stun')
    if (!hasStun) g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:stunDur, bad:true })
  }
  // 消除数值飘字
  let elimDisplayVal = 0, elimDisplayColor = '#fff'
  if (attr === 'heart') {
    let healBase = HEAL_BASE + Math.floor(g.floor * HEAL_FLOOR_COEFF) + (g._cultHeartBase || 0)
    let heal = healBase * elimMul
    heal *= 1 + g.runBuffs.heartBoostPct / 100
    if (g.weapon && g.weapon.type === 'heartBoost') heal *= 1 + g.weapon.pct / 100
    // 宠物技能heartBoost buff：心珠效果翻倍
    g.heroBuffs.forEach(b => { if (b.type === 'heartBoost') heal *= b.mul || HEART_BOOST_DEFAULT_MUL })
    // 怪物debuff healBlock：心珠回复量减半
    g.heroBuffs.forEach(b => {
      if (b.type === 'debuff' && b.field === 'healRate') heal *= b.rate
    })
    g._pendingHeal += heal
    elimDisplayVal = Math.round(heal)
    elimDisplayColor = '#d4607a'
  } else {
    // 同属性所有宠物的攻击力都参与计算
    const matchPets = g.pets.filter(p => p.attr === attr)
    if (matchPets.length > 0) {
      let totalAtk = 0
      matchPets.forEach(p => { totalAtk += getPetStarAtk(p) })
      let baseDmg = totalAtk * elimMul
      baseDmg *= 1 + g.runBuffs.allAtkPct / 100
      if (!g._pendingDmgMap[attr]) g._pendingDmgMap[attr] = 0
      g._pendingDmgMap[attr] += baseDmg
      // 记录该属性单次最大消除数（用于guaranteeCrit minCount判定）
      if (!g._pendingAttrMaxCount) g._pendingAttrMaxCount = {}
      g._pendingAttrMaxCount[attr] = Math.max(g._pendingAttrMaxCount[attr] || 0, count)
      elimDisplayVal = Math.round(baseDmg)
      const ac = ATTR_COLOR[attr]
      elimDisplayColor = ac ? ac.main : '#fff'
    }
  }
  if (elimDisplayVal > 0 && cells.length > 0) {
    if (attr === 'heart') {
      const baseScale = count >= 5 ? 1.4 : count === 4 ? 1.2 : 1.0
      DF.elimDmg(g, `+${Math.round(elimDisplayVal)}`, elimDisplayColor, attr, baseScale)
    }
    MusicMgr.playEliminate(count)
  }
  // 法宝/buff 消除效果
  if (g.weapon && g.weapon.type === 'healOnElim' && g.weapon.attr === attr) {
    g._pendingHeal += g.heroMaxHp * g.weapon.pct / 100
  }
  g.heroBuffs.forEach(b => {
    if (b.type === 'healOnElim' && b.attr === attr) g._pendingHeal += g.heroMaxHp * b.pct / 100
  })
  if (g.weapon && g.weapon.type === 'shieldOnElim' && g.weapon.attr === attr) {
    g._addShield(g.weapon.val || SHIELD_ON_ELIM_DEFAULT)
  }
  g.heroBuffs.forEach(b => {
    if (b.type === 'shieldOnElim' && b.attr === attr) g._addShield(b.val || SHIELD_ON_ELIM_DEFAULT)
  })
  // 法宝aoeOnElim：消除指定属性珠达到minCount时触发对敌人额外伤害
  if (g.weapon && g.weapon.type === 'aoeOnElim' && g.weapon.attr === attr && count >= (g.weapon.minCount || AOE_ON_ELIM_MIN_COUNT) && g.enemy) {
    const aoeDmg = Math.round(g.enemy.maxHp * AOE_ON_ELIM_HP_RATIO)
    g.enemy.hp = Math.max(0, g.enemy.hp - aoeDmg)
    DF.aoeDmg(g, aoeDmg, (ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || '#ff6347')
    g.shakeT = 6; g.shakeI = 4
    if (g.enemy.hp <= 0) { _addKillExp(g); g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= SPEED_KILL_TURNS; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount; MusicMgr.playVictory(); g.bState = 'victory'; return }
  }
  g.elimAnimCells = cells.map(({r,c}) => ({r,c,attr}))
  g.elimAnimTimer = 0
  g.bState = 'elimAnim'
}

function processElim(g) {
  g.elimAnimTimer++
  if (g.elimAnimTimer >= 16) {
    g.elimAnimCells.forEach(({r,c}) => { g.board[r][c] = null })
    g.elimAnimCells = null
    if (g._elimSkipCombo) { g._elimSkipCombo = false }
    startNextElimAnim(g)
  }
}

function processDropAnim(g) {
  g.dropAnimTimer++
  // 等待补间动画完成（基于最大掉落距离估算帧数），最少12帧保底
  const minFrames = Math.max(12, Math.ceil(((g._dropMaxDist || 1) * 0.04 + 0.2 + 0.12) * 60))
  if (g.dropAnimTimer >= minFrames) {
    // 清除所有残留的掉落偏移
    const { ROWS, COLS } = V
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (g.board[r] && g.board[r][c]) g.board[r][c]._dropOffY = 0
      }
    }
    const groups = findMatchesSeparate(g)
    if (groups.length > 0) {
      g.elimQueue = groups
      startNextElimAnim(g)
    } else if (g.combo > 0) {
      enterPetAtkShow(g)
    } else {
      g.bState = 'preEnemy'; g._stateTimer = 0
    }
  }
}

// 预分配 marked/visited 数组，避免连锁阶段反复 GC
let _fmsMarked = null, _fmsVisited = null, _fmsRows = 0, _fmsCols = 0
function _ensureFmsArrays(rows, cols) {
  if (_fmsRows === rows && _fmsCols === cols && _fmsMarked) return
  _fmsRows = rows; _fmsCols = cols
  _fmsMarked = Array.from({length: rows}, () => new Array(cols))
  _fmsVisited = Array.from({length: rows}, () => new Array(cols))
}
function _clearFmsArray(arr, rows, cols) {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) arr[r][c] = false
  }
}

function findMatchesSeparate(g) {
  const { ROWS, COLS } = V
  _ensureFmsArrays(ROWS, COLS)
  const marked = _fmsMarked
  _clearFmsArray(marked, ROWS, COLS)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS-3; c++) {
      const a = cellAttr(g,r,c)
      if (a && a === cellAttr(g,r,c+1) && a === cellAttr(g,r,c+2)) {
        let end = c+2
        while (end+1 < COLS && cellAttr(g,r,end+1) === a) end++
        for (let cc = c; cc <= end; cc++) marked[r][cc] = true
        c = end
      }
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS-3; r++) {
      const a = cellAttr(g,r,c)
      if (a && a === cellAttr(g,r+1,c) && a === cellAttr(g,r+2,c)) {
        let end = r+2
        while (end+1 < ROWS && cellAttr(g,end+1,c) === a) end++
        for (let rr = r; rr <= end; rr++) marked[rr][c] = true
        r = end
      }
    }
  }
  const visited = _fmsVisited
  _clearFmsArray(visited, ROWS, COLS)
  const groups = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!marked[r][c] || visited[r][c]) continue
      const attr = cellAttr(g,r,c)
      const cells = []; const q = [{r,c}]; visited[r][c] = true
      while (q.length) {
        const {r:cr,c:cc} = q.shift(); cells.push({r:cr,c:cc})
        for (const [dr,dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nr=cr+dr, nc=cc+dc
          if (nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&!visited[nr][nc]&&marked[nr][nc]&&cellAttr(g,nr,nc)===attr) {
            visited[nr][nc]=true; q.push({r:nr,c:nc})
          }
        }
      }
      groups.push({ attr, count:cells.length, cells })
    }
  }
  return groups
}

/** Combo 伤害倍率（递减分段），战斗结算与 UI 预估共用 */
function getComboMul(combo) {
  return getSharedComboMul(combo)
}

// ===== 宠物头像攻击数值展示 =====
function enterPetAtkShow(g) {
  const { S, W } = V
  g._stateTimer = 0
  const ctx = buildDamageContext(g)
  const critState = resolveCritFromCtx(ctx, { mode: 'runtime', usePendingCrit: false })
  g._pendingCrit = critState.isCrit
  g._pendingCritMul = critState.critMul

  const petBreakdown = calcPetDisplayBreakdown(ctx, { critMul: critState.critMul })
  const critFxPlan = critState.isCrit ? getCritFxPlan(g) : null
  const pendingDmgMap = (ctx && ctx.pendingDmgMap) || {}
  let hasAny = false
  let activeOrder = 0
  g._petFinalDmg = {}

  for (let i = 0; i < petBreakdown.length; i++) {
    const item = petBreakdown[i]
    const participated = (pendingDmgMap[item.attr] || 0) > 0
    g._petFinalDmg[item.index] = item.dmg
    if (!participated) continue
    hasAny = true
    const isCritHit = !!(critState.isCrit && item.dmg > 0)
    emitFloat(g, 'petNormalAtkDmg', {
      dmg: Math.max(0, item.dmg || 0),
      color: item.dmg > 0
        ? ((ATTR_COLOR[item.attr] && ATTR_COLOR[item.attr].main) || V.TH.accent)
        : '#d8d8d8',
      petIdx: item.index,
      attr: item.dmg > 0 ? item.attr : null,
      isCrit: isCritHit,
      critFxTier: isCritHit
        ? (activeOrder === 0
          ? (critFxPlan && critFxPlan.slotPrimaryTier)
          : (critFxPlan && critFxPlan.slotSecondaryTier))
        : 'none',
      orderIdx: activeOrder,
    })
    activeOrder++
    if (item.isCounter) {
      const cac = ATTR_COLOR[item.attr]
      emitNotice(g, { x:W*0.5, y:g._getEnemyCenterY()-30*S, text:'克制！', color: cac ? cac.main : '#ffd700', scale:2.2, _initScale:2.2, big:true })
      emitFlash(g, 'counter', { color: cac ? cac.main : '#ffd700', timer: 10 })
      emitShake(g, { t: 8, i: 5, mode: 'max' })
      MusicMgr.playComboMilestone(5)
    } else if (item.isCountered) {
      emitNotice(g, { x:W*0.5, y:g._getEnemyCenterY()-30*S, text:'抵抗...', color:'#888888', scale:1.4, _initScale:1.4 })
    } else if (item.dmg <= 0) {
      emitNotice(g, { x:W*0.5, y:g._getEnemyCenterY()-30*S, text:'未破防', color:'#a8a8a8', scale:1.4, _initScale:1.4 })
    }
  }


  const heal = calcHealFromCtx(ctx)
  if (heal > 0) {
    hasAny = true
    const oldHp = g.heroHp
    const oldPct = oldHp / g.heroMaxHp
    g.heroHp = Math.min(g.heroMaxHp, oldHp + heal)
    if (g.heroHp > oldHp) {
      g._heroHpGain = { fromPct: oldPct, timer: 0 }
      emitCast(g, { kind: 'heal' })
    }
    g._pendingHealApplied = true
  }

  if (hasAny) {
    g.bState = 'petAtkShow'
  } else {
    g.bState = 'preAttack'
  }
}

// ===== 攻击结算 =====
function executeAttack(g) {
  applyFinalDamage(g, g._pendingDmgMap || {}, g._pendingHeal || 0)
  g._pendingDmgMap = null; g._pendingHeal = 0; g._pendingAttrMaxCount = null
  g.storage.recordBattle(g.combo)
}

function calcCrit(g) {
  return calcCritFromCtx(buildDamageContext(g))
}

function applyFinalDamage(g, dmgMap, heal) {
  const { S, W, H } = V
  const ctx = buildDamageContext(g, { pendingDmgMap: dmgMap, pendingHeal: heal })
  const result = calcTotalDamage(ctx, { critMode: 'runtime' })
  const totalDmg = result.totalDmg
  const isCrit = result.isCrit
  const critFxPlan = isCrit
    ? getCritFxPlan(g, {
      dmgFloats: 1,
      notices: 1,
      comboFlash: 1,
      screenFlash: 1,
      skillCast: 1,
    })
    : null
  const resolvedHeal = result.heal

  if (g._pendingCrit != null) {
    g._pendingCrit = null
    g._pendingCritMul = null
  }
  g._lastCrit = isCrit

  const counterAttr = result.attrBreakdown.find(item => item.isCounter)
  if (counterAttr && (!g._counterFlash || g._counterFlash.timer <= 0)) {
    const cac = ATTR_COLOR[counterAttr.attr]
    emitFlash(g, 'counter', { color: cac ? cac.main : '#ffd700', timer: 10 })
  }

  if (g.nextDmgDouble) g.nextDmgDouble = false

  if (totalDmg > 0 && g.enemy) {
    const oldPct = g.enemy.hp / g.enemy.maxHp
    const leadAttr = Object.keys(dmgMap || {})[0] || 'metal'
    g.enemy.hp = Math.max(0, g.enemy.hp - totalDmg)
    g._enemyHpLoss = { fromPct: oldPct, timer: 0, dmg: totalDmg, isCrit: isCrit }
    emitFloat(g, 'enemyTotal', {
      dmg: totalDmg,
      color: (ATTR_COLOR[leadAttr] && ATTR_COLOR[leadAttr].main) || V.TH.accent,
      isCrit: isCrit,
      critFxTier: critFxPlan ? critFxPlan.totalBurstTier : 'none',
    })
    emitCast(g, Object.assign({
      kind: 'heroAttack',
      attr: leadAttr,
      hitFlash: 12,
      tintFlash: 8,
      hitStop: 3,
      castDuration: 30,
      enemyDuration: 18,
    }, isCrit && critFxPlan ? critFxPlan.cast : null))
    emitShake(g, isCrit && critFxPlan ? critFxPlan.shake : { t: 8, i: 4 })
    if (isCrit) emitFlash(g, 'combo', Object.assign({
      focus: 'enemy',
      y: g._getEnemyCenterY(),
      radius: 116 * S,
      color: '#fff1b8',
      ringColor: '#ffe37a',
      rayColor: '#fff8d8',
      style: 'critBurst',
      rays: 10,
      ringCount: 2,
      alphaMul: 1.4,
      allowLowCombo: true,
    }, critFxPlan ? {
      timer: critFxPlan.comboFlash.timer,
      maxTimer: critFxPlan.comboFlash.maxTimer,
      radius: 116 * S * (critFxPlan.comboFlash.radiusMul || 1),
      rays: critFxPlan.comboFlash.rays,
      ringCount: critFxPlan.comboFlash.ringCount,
      alphaMul: critFxPlan.comboFlash.alphaMul,
    } : {
      timer: 16,
      maxTimer: 18,
    }))
    if (isCrit) {
      emitFlash(g, 'screen', critFxPlan ? critFxPlan.screenFlash : { timer: 6, max: 6, color: '#fff3c6' })
      MusicMgr.playAttackCrit()
      emitNotice(g, Object.assign({
        x:W*0.5,
        y:g._getEnemyCenterY()-34*S,
        text:'暴击！',
        color:'#ffdd58',
        glowColor:'#ffe994',
        big:true,
        fxQuality: critFxPlan ? critFxPlan.quality : 'full',
        variant:'crit'
      }, critFxPlan ? critFxPlan.notice : {
        subText:'CRITICAL',
        scale:3.05,
        _initScale:3.6,
        _settleScale:1.16,
        _pulseAmp:0.08,
        _pulseSpeed:0.42,
        riseSpeed:0.38,
        waveAmp:2.8,
        waveFreq:0.4,
        lifeFrames:56,
        fadeStart:34,
      }))
    } else {
      MusicMgr.playAttack()
    }

    if (g.weapon && g.weapon.type === 'poisonChance' && Math.random()*100 < g.weapon.chance) {
      g.enemyBuffs.push({ type:'dot', name:'中毒', dmg:g.weapon.dmg, dur:g.weapon.dur, bad:true, dotType:'poison' })
    }
    const mirrorBuff = g.enemyBuffs.find(b => b.type === 'bossMirror')
    if (mirrorBuff && totalDmg > 0) {
      const reflectDmg = Math.round(totalDmg * (mirrorBuff.reflectPct || 30) / 100)
      if (reflectDmg > 0) {
        g._dealDmgToHero(reflectDmg)
        emitNotice(g, { x:W*0.5, y:H*0.6, text:`反弹${reflectDmg}`, color:'#ff60ff', scale:1.3, _initScale:1.3 })
      }
    }
  }
  if (g.weapon && g.weapon.type === 'execute' && g.enemy && g.enemy.hp > 0 && g.enemy.hp / g.enemy.maxHp <= (g.weapon.threshold || EXECUTE_DEFAULT_THRESHOLD) / 100) {
    g.enemy.hp = 0
    emitNotice(g, { x:W*0.5, y:g._getEnemyCenterY(), text:'斩 杀 ！', color:'#ff2020', scale:2.5, _initScale:2.5, big:true })
    emitShake(g, { t: 10, i: 6 })
  }
  if (resolvedHeal > 0 && !g._pendingHealApplied) {
    const oldHp = g.heroHp
    const oldPct = oldHp / g.heroMaxHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + resolvedHeal)
    if (g.heroHp > oldHp) {
      g._heroHpGain = { fromPct: oldPct, timer: 0 }
      emitCast(g, { kind: 'heal' })
    }
  }
  g._pendingHealApplied = false
  if (g.weapon && g.weapon.type === 'comboHeal' && g.combo > 0) {
    const chAmt = Math.round(g.heroMaxHp * g.weapon.pct / 100 * g.combo)
    const chOld = g.heroHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + chAmt)
    if (g.heroHp > chOld) {
      g._heroHpGain = { fromPct: chOld / g.heroMaxHp, timer: 0 }
      emitFloat(g, 'heroHeal', { amt: g.heroHp - chOld, color: '#88ff88' })
    }
  }
  if (g.enemy && g.enemy.hp <= 0) {
    _addKillExp(g)
    g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= SPEED_KILL_TURNS; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount
    g.bState = 'victory'; MusicMgr.playVictory()
    g._enemyDeathAnim = { timer: 0, duration: 45 }
    g._enemyHitFlash = 14
    emitShake(g, { t: 12, i: 8 })
    if (g.weapon && g.weapon.type === 'onKillHeal') {
      const okOld = g.heroHp
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.weapon.pct / 100))
      if (g.heroHp > okOld) {
        g._heroHpGain = { fromPct: okOld / g.heroMaxHp, timer: 0 }
        emitFloat(g, 'heroHeal', { amt: g.heroHp - okOld })
      }
    }
    g.heroBuffs.forEach(b => {
      if (b.type === 'onKillHeal') {
        const bkOld = g.heroHp
        g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * b.pct / 100))
        if (g.heroHp > bkOld) {
          g._heroHpGain = { fromPct: bkOld / g.heroMaxHp, timer: 0 }
          emitFloat(g, 'heroHeal', { amt: g.heroHp - bkOld })
        }
      }
    })
    if (g.runBuffs.postBattleHealPct > 0) {
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.runBuffs.postBattleHealPct / 100))
    }
    g.runBuffs.nextDmgReducePct = 0
    if (g.runBuffLog) g.runBuffLog = g.runBuffLog.filter(e => e.buff !== 'nextDmgReducePct')
    return
  }
  settle(g)
}

// ===== 我方回合开始：每回合触发的回血/回复效果 =====
function onPlayerTurnStart(g) {
  const { S, W, H } = V
  let totalHeal = 0
  // 法宝：万寿青莲 regenPct 每回合回血
  if (g.weapon && g.weapon.type === 'regenPct') {
    totalHeal += Math.round(g.heroMaxHp * g.weapon.pct / 100)
  }
  // 奖励buff：每回合回血
  if (g.runBuffs.regenPerTurn > 0) {
    totalHeal += g.runBuffs.regenPerTurn
  }
  // 宠物技能buff：regen类每回合回血
  g.heroBuffs.forEach(b => {
    if (b.type === 'regen' && b.heal > 0) {
      totalHeal += b.heal
    }
  })
  if (totalHeal > 0 && g.heroHp < g.heroMaxHp) {
    const oldHp = g.heroHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + totalHeal)
    const actual = g.heroHp - oldHp
    if (actual > 0) {
      g._heroHpGain = { fromPct: oldHp / g.heroMaxHp, timer: 0 }
      emitCast(g, { kind: 'heal' })
      emitFloat(g, 'heroHeal', { amt: actual })
    }
  }
}

// ===== 回合结算 =====
function settle(g) {
  g.heroBuffs = g.heroBuffs.filter(b => { b.dur--; return b.dur > 0 })
  g.enemyBuffs = g.enemyBuffs.filter(b => { b.dur--; return b.dur > 0 })
  g.pets.forEach((p, idx) => {
    if (!petHasSkill(p)) return  // ★1无技能，不处理CD
    if (p.currentCd > 0) {
      p.currentCd--
      if (p.currentCd <= 0) {
        // 首次就绪：标记闪光
        if (!g._petReadyFlash) g._petReadyFlash = {}
        g._petReadyFlash[idx] = 15  // 15帧闪光
      }
    }
  })
  // seal持续时间递减：sealed为数字时每回合-1，归0则解封
  const { ROWS, COLS } = V
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.board[r][c] && g.board[r][c].sealed) {
        if (typeof g.board[r][c].sealed === 'number') {
          g.board[r][c].sealed--
          if (g.board[r][c].sealed <= 0) g.board[r][c].sealed = false
        }
      }
    }
  }
  g.comboNeverBreak = false
  // 每回合回血（万寿青莲/regen buff等）
  onPlayerTurnStart(g)
  // 立即进入玩家回合，敌人攻击延迟在背景执行
  g._pendingEnemyAtk = { timer: 0, delay: 24 }
  g._enemyWarning = 15  // 敌人回合预警红闪
  g.bState = 'playerTurn'; g.dragTimer = 0
  // 时间压缩 debuff：临时缩短拖拽时间
  const dtDebuff = g.heroBuffs.find(b => b.type === 'debuff' && b.field === 'dragTime')
  if (dtDebuff) {
    g._baseDragTimeLimit = g._baseDragTimeLimit || g.dragTimeLimit
    g.dragTimeLimit = Math.round(g._baseDragTimeLimit * (1 - dtDebuff.rate))
  } else if (g._baseDragTimeLimit) {
    g.dragTimeLimit = g._baseDragTimeLimit
    g._baseDragTimeLimit = 0
  }
}

function enemyTurn(g) {
  const { S, W, H, TH } = V
  if (!g.enemy || g.enemy.hp <= 0) { g.bState = 'playerTurn'; g.dragTimer = 0; return }
  // 教学中大部分步骤敌人不攻击
  if (tutorial.isActive() && !tutorial.shouldEnemyAttack(g)) {
    g.turnCount++
    g._enemyTurnWait = true; g.bState = 'enemyTurn'; g._stateTimer = 0
    return
  }
  const stunBuff = g.enemyBuffs.find(b => b.type === 'stun')
  if (stunBuff) {
    emitNotice(g, { x:W*0.5, y:g._getEnemyCenterY(), text:'眩晕跳过！', color:TH.info })
    // 眩晕跳过攻击，但仍需结算敌人身上的dot伤害
    let dotIdx = 0
    g.enemyBuffs.forEach(b => {
      if (b.type === 'dot' && b.dmg > 0) {
        g.enemy.hp = Math.max(0, g.enemy.hp - b.dmg)
        emitFloat(g, 'dotOnEnemy', { dmg: b.dmg, dotType: b.dotType, idx: dotIdx })
        dotIdx++
      }
    })
    if (g.enemy.hp <= 0) { _addKillExp(g); g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= SPEED_KILL_TURNS; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount; MusicMgr.playVictory(); g.bState = 'victory'; return }
    // 眩晕时技能倒计时不递减（怪物被眩晕无法蓄力）
    g.turnCount++
    g._enemyTurnWait = true; g.bState = 'enemyTurn'; g._stateTimer = 0
    return
  }
  let atkDmg = g.enemy.atk
  const atkBuff = g.enemyBuffs.find(b => b.type === 'buff' && b.field === 'atk')
  if (atkBuff) atkDmg = Math.round(atkDmg * (1 + atkBuff.rate))
  let reducePct = 0
  g.heroBuffs.forEach(b => { if (b.type === 'reduceDmg') reducePct += b.pct })
  // 宠物技能allDefUp buff：全队防御加成转化为减伤
  g.heroBuffs.forEach(b => { if (b.type === 'allDefUp') reducePct += b.pct })
  // 怪物debuff defDown：降低防御 → 增加受到的伤害
  g.heroBuffs.forEach(b => {
    if (b.type === 'debuff' && b.field === 'def') reducePct -= b.rate * 100
  })
  if (g.weapon && g.weapon.type === 'reduceDmg') reducePct += g.weapon.pct
  if (g.weapon && g.weapon.type === 'reduceAttrAtkDmg' && g.enemy && g.enemy.attr === g.weapon.attr) reducePct += g.weapon.pct
  reducePct += g.runBuffs.dmgReducePct
  if (g.runBuffs.nextDmgReducePct > 0) reducePct += g.runBuffs.nextDmgReducePct
  atkDmg = Math.round(atkDmg * (1 - reducePct / 100))
  // 修炼根骨：固定值减伤（仅固定关卡模式）
  if (g._cultDmgReduce > 0) atkDmg -= g._cultDmgReduce
  atkDmg = Math.max(0, atkDmg)
  if (g.weapon && g.weapon.type === 'blockChance' && Math.random()*100 < g.weapon.chance) {
    const blocked = atkDmg
    atkDmg = 0
    // 大字格挡特效：缩放弹跳 + 显示抵挡伤害数值
    emitNotice(g, { x:W*0.5, y:H*0.5, text:'格 挡 ！', color:'#40e8ff', scale:3.0, _initScale:3.0, big:true })
    emitNotice(g, { x:W*0.5, y:H*0.57, text:`抵挡 ${blocked} 伤害`, color:'#7ddfff', scale:1.8, _initScale:1.8 })
    emitShake(g, { t: 8, i: 5 })
    emitFlash(g, 'block', { timer: 12 })
    MusicMgr.playBlock()
  }
  const immune = g.heroBuffs.find(b => b.type === 'dmgImmune')
  if (immune) atkDmg = 1
  let reflectPct = 0
  g.heroBuffs.forEach(b => { if (b.type === 'reflectPct') reflectPct += b.pct })
  if (g.weapon && g.weapon.type === 'reflectPct') reflectPct += g.weapon.pct
  if (reflectPct > 0 && atkDmg > 0) {
    const refDmg = Math.round(atkDmg * reflectPct / 100)
    g.enemy.hp = Math.max(0, g.enemy.hp - refDmg)
    emitFloat(g, 'reflectToEnemy', { dmg: refDmg, color: TH.info })
  }
  if (g.weapon && g.weapon.type === 'counterStun' && Math.random()*100 < g.weapon.chance) {
    g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
  }
  if (atkDmg > 0) {
    const hitResult = g._dealDmgToHero(atkDmg) || {}
    const actualDamage = hitResult.actualDamage || 0
    emitCast(g, { kind: 'enemyAttack', heroReact: actualDamage > 0 })
    if (actualDamage > 0) {
      const dmgRatio = actualDamage / g.heroMaxHp
      MusicMgr.playEnemyAttack(dmgRatio)
      setTimeout(() => {
        if (g.scene !== 'battle' || g.bState === 'victory' || g.bState === 'defeat') return
        MusicMgr.playHeroHurt(dmgRatio)
      }, 100)
      emitShake(g, { t: 10, i: 6 })
    }
  }
  g.heroBuffs.forEach(b => {
    if (b.type === 'dot' && b.dmg > 0) {
      if (g.weapon && g.weapon.type === 'immuneDot') return
      // 宠物技能immuneCtrl也能免疫持续伤害
      if (g.heroBuffs.some(hb => hb.type === 'immuneCtrl')) return
      g._dealDmgToHero(b.dmg)
      MusicMgr.playDotDmg()  // DOT音效
    }
  })
  // ===== 怪物技能释放：由倒计时驱动 =====
  if (g.enemy.skills && g.enemy.skills.length > 0 && g.enemySkillCd >= 0) {
    g.enemySkillCd--
    if (g.enemySkillCd <= 0) {
      // 释放预选的技能（或随机选一个）
      const sk = g._nextEnemySkill || g.enemy.skills[Math.floor(Math.random()*g.enemy.skills.length)]
      MusicMgr.playEnemySkill()
      applyEnemySkill(g, sk)
      g.enemySkillCd = ENEMY_SKILL_CD_RESET  // 重置倒计时
      // 预选下一个技能（用于UI预警）
      g._nextEnemySkill = g.enemy.skills[Math.floor(Math.random()*g.enemy.skills.length)]
    }
  }
  let dotIdx2 = 0
  g.enemyBuffs.forEach(b => {
    if (b.type === 'dot' && b.dmg > 0) {
      g.enemy.hp = Math.max(0, g.enemy.hp - b.dmg)
      emitFloat(g, 'dotOnEnemy', { dmg: b.dmg, dotType: b.dotType, idx: dotIdx2 })
      dotIdx2++
    }
  })
  g.enemyBuffs.forEach(b => {
    if (b.type === 'selfHeal') {
      const heal = Math.round(g.enemy.maxHp * (b.pct || ENEMY_SELF_HEAL_DEFAULT_PCT) / 100)
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + heal)
    }
  })
  if (g.enemy.hp <= 0) { _addKillExp(g); g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= SPEED_KILL_TURNS; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount; MusicMgr.playVictory(); g.bState = 'victory'; return }
  if (g.heroHp <= 0) { g._onDefeat(); return }
  g.turnCount++
  g._enemyTurnWait = true; g.bState = 'enemyTurn'; g._stateTimer = 0
}

function applyEnemySkill(g, skillKey) {
  const { S, W, H, TH, ROWS, COLS } = V
  const L = g._getBattleLayout()
  const sk = ENEMY_SKILLS[skillKey]
  if (!sk) return
  // 法宝immuneDebuff：免疫所有负面效果（dot/debuff/stun/seal等，不拦截buff/selfHeal/convert/breakBead/aoe）
  const negTypes = ['dot','debuff','stun','seal','sealRow','sealAttr','sealAll']
  if (g.weapon && g.weapon.type === 'immuneDebuff' && negTypes.includes(sk.type)) {
    emitNotice(g, { x:W*0.5, y:H*0.5, text:'免疫！', color:'#40e8ff' })
    return
  }
  emitNotice(g, { x:W*0.5, y:g._getEnemyCenterY()+30*S, text:sk.name, desc:sk.desc||'', color:TH.danger, scale:1.8, _initScale:1.8, big:true })
  switch(sk.type) {
    case 'buff':
      g.enemyBuffs.push({ type:'buff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:false }); break
    case 'dot':
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:Math.round(g.enemy.atk * ENEMY_DOT_ATK_RATIO), dur:sk.dur, bad:true }); break
    case 'seal':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        if (g.board[r][c]) g.board[r][c].sealed = sk.dur || ENEMY_SEAL_DEFAULT_DUR
      }
      break
    case 'convert': {
      const cells = []
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        if (g.board[r][c]) {
          const toAttr = BEAD_ATTRS[Math.floor(Math.random()*5)]
          if (g.board[r][c].attr !== toAttr) {
            cells.push({ r, c, fromAttr: g.board[r][c].attr, toAttr })
          }
        }
      }
      if (cells.length) {
        g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      }
      break
    }
    case 'aoe': {
      let aoeDmg = Math.round(g.enemy.atk * (sk.atkPct || ENEMY_AOE_DEFAULT_ATK_PCT))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') aoeDmg = Math.round(aoeDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(aoeDmg); break
    }
    case 'debuff':
      g.heroBuffs.push({ type:'debuff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:true }); break
    case 'stun': {
      const hasImmuneCtrl = g.heroBuffs.some(b => b.type === 'immuneCtrl')
      if (!g.immuneOnce && !hasImmuneCtrl && !(g.weapon && g.weapon.type === 'immuneStun')) {
        g.heroBuffs.push({ type:'heroStun', name:'眩晕', dur:sk.dur, bad:true })
      } else { g.immuneOnce = false }
      break
    }
    case 'selfHeal':
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + Math.round(g.enemy.maxHp * (sk.pct || ENEMY_SELF_HEAL_DEFAULT_PCT) / 100)); break
    case 'breakBead':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        g.board[r][c] = null
      }
      fillBoard(g)
      break
    // ===== 固定关卡新增技能 =====
    case 'sealCol': {
      const sc = Math.floor(Math.random() * COLS)
      for (let r = 0; r < ROWS; r++) {
        if (g.board[r][sc]) g.board[r][sc].sealed = sk.dur || ENEMY_SEAL_DEFAULT_DUR
      }
      break
    }
    case 'sealCounter': {
      const counterAttr = COUNTER_BY[g.enemy.attr]
      if (counterAttr) {
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (g.board[r][c] && g.board[r][c].attr === counterAttr) {
              g.board[r][c].sealed = sk.dur || ENEMY_SEAL_DEFAULT_DUR
            }
          }
        }
        emitNotice(g, { x:W*0.5, y:g.boardY+60*S, text:`${ATTR_NAME[counterAttr]||counterAttr}珠封印！`, color:'#ff4040', scale:1.5, _initScale:1.5 })
      }
      break
    }
    case 'attrAbsorb': {
      const myAttr = g.enemy.attr
      let converted = 0
      const candidates = []
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (g.board[r][c] && g.board[r][c].attr === myAttr) candidates.push({ r, c })
        }
      }
      for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
      }
      const absorbCells = []
      for (let i = 0; i < Math.min(sk.count || 3, candidates.length); i++) {
        const { r, c } = candidates[i]
        absorbCells.push({ r, c, fromAttr: g.board[r][c].attr, toAttr: 'heart' })
        converted++
      }
      if (absorbCells.length) {
        g._beadConvertAnim = { cells: absorbCells, timer: 0, phase: 'charge', duration: 24 }
      }
      const healAmt = Math.round(g.enemy.maxHp * (sk.healPct || 10) / 100)
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + healAmt)
      emitFloat(g, 'enemyHeal', { amt: healAmt })
      break
    }
    // ===== 封珠变体 =====
    case 'sealRow': {
      // 封锁整行灵珠
      const sr = Math.floor(Math.random() * ROWS)
      for (let c = 0; c < COLS; c++) {
        if (g.board[sr][c]) g.board[sr][c].sealed = sk.dur || ENEMY_SEAL_DEFAULT_DUR
      }
      break
    }
    case 'sealAttr': {
      // 封锁指定属性（随机选一个非心珠属性）的所有灵珠
      const attrPool = ['metal','wood','water','fire','earth']
      const targetAttr = attrPool[Math.floor(Math.random()*attrPool.length)]
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (g.board[r][c] && g.board[r][c].attr === targetAttr) {
            g.board[r][c].sealed = sk.dur || ENEMY_SEAL_DEFAULT_DUR
          }
        }
      }
      emitNotice(g, { x:W*0.5, y:g.boardY+60*S, text:`${ATTR_NAME[targetAttr]||targetAttr}珠封印！`, color:'#ff4040', scale:1.5, _initScale:1.5 })
      break
    }
    case 'sealAll': {
      // 封锁井字形灵珠（行1/3 + 列2/4 交叉线，保留其余区域可操作）
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (r === 1 || r === 3 || c === 2 || c === 4) {
            if (g.board[r][c]) g.board[r][c].sealed = sk.dur || 1
          }
        }
      }
      break
    }
    // ===== BOSS专属技能 =====
    case 'bossQuake': {
      // 震天裂地：AOE伤害 + 封锁整行灵珠
      let qDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_QUAKE_DEFAULT_ATK_PCT))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') qDmg = Math.round(qDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(qDmg)
      if (sk.sealType === 'row') {
        const sr = Math.floor(Math.random() * ROWS)
        for (let c = 0; c < COLS; c++) {
          if (g.board[sr][c]) g.board[sr][c].sealed = sk.sealDur || BOSS_QUAKE_SEAL_DUR_DEFAULT
        }
      } else {
        for (let i = 0; i < (sk.sealCount || 3); i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (g.board[r][c]) g.board[r][c].sealed = sk.sealDur || BOSS_QUAKE_SEAL_DUR_DEFAULT
        }
      }
      break
    }
    case 'bossDevour': {
      // 噬魂夺魄：造成伤害 + 窃取治疗（加healBlock debuff）
      let dDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_DEVOUR_DEFAULTS.atkPct))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') dDmg = Math.round(dDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(dDmg)
      g.heroBuffs.push({ type:'debuff', name:sk.name, field:'healRate', rate:BOSS_DEVOUR_DEFAULTS.healRate, dur:BOSS_DEVOUR_DEFAULTS.dur, bad:true })
      break
    }
    case 'bossDot': {
      // 业火焚天：按攻击力百分比的持续伤害
      const dotDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_DOT_DEFAULTS.atkPct))
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:dotDmg, dur:sk.dur || BOSS_DOT_DEFAULTS.dur, bad:true })
      break
    }
    case 'bossVoidSeal': {
      // 虚空禁锢：封锁整行灵珠
      const sealRow = Math.floor(Math.random() * ROWS)
      for (let c = 0; c < COLS; c++) {
        if (g.board[sealRow][c]) g.board[sealRow][c].sealed = sk.dur || ENEMY_SEAL_DEFAULT_DUR
      }
      break
    }
    case 'bossMirror':
      // 妖力护体：给BOSS自身反弹buff
      g.enemyBuffs.push({ type:'bossMirror', name:sk.name, reflectPct:sk.reflectPct || BOSS_MIRROR_DEFAULTS.reflectPct, dur:sk.dur || BOSS_MIRROR_DEFAULTS.dur, bad:false })
      break
    case 'bossWeaken':
      // 天罡镇压：同时降低攻击和防御
      g.heroBuffs.push({ type:'debuff', name:sk.name+'(攻)', field:'atk', rate:sk.atkRate || BOSS_WEAKEN_DEFAULTS.atkRate, dur:sk.dur || BOSS_WEAKEN_DEFAULTS.dur, bad:true })
      g.heroBuffs.push({ type:'debuff', name:sk.name+'(防)', field:'def', rate:sk.defRate || BOSS_WEAKEN_DEFAULTS.defRate, dur:sk.dur || BOSS_WEAKEN_DEFAULTS.dur, bad:true })
      break
    case 'bossBlitz': {
      // 连环妖击：多段攻击
      const hits = sk.hits || BOSS_BLITZ_DEFAULTS.hits
      for (let i = 0; i < hits; i++) {
        let bDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_BLITZ_DEFAULTS.atkPct))
        if (g.weapon && g.weapon.type === 'reduceSkillDmg') bDmg = Math.round(bDmg * (1 - g.weapon.pct / 100))
        g._dealDmgToHero(bDmg)
      }
      break
    }
    case 'bossDrain': {
      // 吸星大法：造成伤害并回复等量生命
      let drDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_DRAIN_DEFAULT_ATK_PCT))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') drDmg = Math.round(drDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(drDmg)
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + drDmg)
      emitFloat(g, 'enemyHeal', { amt: drDmg })
      break
    }
    case 'bossAnnihil': {
      // 灭世天劫：大伤害 + 碎珠
      let aDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_ANNIHIL_DEFAULTS.atkPct))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') aDmg = Math.round(aDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(aDmg)
      for (let i = 0; i < (sk.breakCount || BOSS_ANNIHIL_DEFAULTS.breakCount); i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        g.board[r][c] = null
      }
      fillBoard(g)
      break
    }
    case 'bossCurse':
      // 万妖诅咒：固定DOT + 心珠回复减半
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:sk.dmg || BOSS_CURSE_DEFAULTS.dmg, dur:sk.dur || BOSS_CURSE_DEFAULTS.dur, bad:true })
      g.heroBuffs.push({ type:'debuff', name:sk.name, field:'healRate', rate:BOSS_CURSE_DEFAULTS.healRate, dur:sk.dur || BOSS_CURSE_DEFAULTS.dur, bad:true })
      break
    case 'bossUltimate': {
      // 超越·终焉：大伤害 + 封锁（全场或随机） + 眩晕
      let uDmg = Math.round(g.enemy.atk * (sk.atkPct || BOSS_ULTIMATE_DEFAULTS.atkPct))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') uDmg = Math.round(uDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(uDmg)
      if (sk.sealType === 'all') {
        // 封锁外围灵珠（保留中心区域可操作，避免卡死）
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
              if (g.board[r][c]) g.board[r][c].sealed = sk.sealDur || BOSS_ULTIMATE_DEFAULTS.sealDur
            }
          }
        }
      } else {
        for (let i = 0; i < (sk.sealCount || BOSS_ULTIMATE_DEFAULTS.sealCount); i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (g.board[r][c]) g.board[r][c].sealed = sk.sealDur || BOSS_ULTIMATE_DEFAULTS.sealDur
        }
      }
      const hasImmuneCtrl2 = g.heroBuffs.some(b => b.type === 'immuneCtrl')
      if (!g.immuneOnce && !hasImmuneCtrl2 && !(g.weapon && g.weapon.type === 'immuneStun')) {
        g.heroBuffs.push({ type:'heroStun', name:'眩晕', dur:1, bad:true })
      } else { g.immuneOnce = false }
      break
    }
  }
}

// ===== 战斗进入 =====
function enterBattle(g, enemyData) {
  const { S, COLS, ROWS } = V
  g.enemy = { ...enemyData }
  g._baseHeroMaxHp = g.heroMaxHp
  g._lastRewardInfo = null  // 进入战斗后清除奖励角标
  if (g.weapon && g.weapon.type === 'hpMaxUp') {
    const inc = Math.round(g.heroMaxHp * g.weapon.pct / 100)
    g.heroMaxHp += inc; g.heroHp += inc
  }
  const rb = g.runBuffs
  let hpReduce = rb.enemyHpReducePct, atkReduce = rb.enemyAtkReducePct, defReduce = rb.enemyDefReducePct
  if (g.enemy.isElite) { hpReduce += rb.eliteHpReducePct; atkReduce += rb.eliteAtkReducePct }
  if (g.enemy.isBoss) { hpReduce += rb.bossHpReducePct; atkReduce += rb.bossAtkReducePct }
  if (hpReduce > 0) { g.enemy.hp = Math.round(g.enemy.hp * (1 - hpReduce / 100)); g.enemy.maxHp = g.enemy.hp }
  if (atkReduce > 0) g.enemy.atk = Math.round(g.enemy.atk * (1 - atkReduce / 100))
  if (defReduce > 0) g.enemy.def = Math.round((g.enemy.def || 0) * (1 - defReduce / 100))
  g.enemy.baseDef = g.enemy.def || 0  // 记录初始防御，用于破甲特效判断
  if (g.weapon && g.weapon.type === 'breakDef') g.enemy.def = 0
  if (g.weapon && g.weapon.type === 'weakenEnemy') g.enemy.atk = Math.round(g.enemy.atk * (1 - g.weapon.pct / 100))
  g.enemyBuffs = []
  g.bState = 'playerTurn'
  g.rewards = null; g.selectedReward = -1; g._rewardDetailShow = null  // 清除上次奖励
  g.combo = 0; g.turnCount = 0; g._lowHpBurstShown = false
  // ===== 怪物技能倒计时：计算距下次释放还需几回合 =====
  g.enemySkillCd = (g.enemy.skills && g.enemy.skills.length > 0)
    ? (g.enemy.isBoss ? ENEMY_FIRST_SKILL_DELAY.boss : ENEMY_FIRST_SKILL_DELAY.normal)  // Boss 第1回合末即释放技能；普通怪第3回合
    : -1
  // 预选首次释放的技能（用于UI预警）
  g._nextEnemySkill = (g.enemy.skills && g.enemy.skills.length > 0)
    ? g.enemy.skills[Math.floor(Math.random()*g.enemy.skills.length)]
    : null
  g.lastSpeedKill = false; g.lastTurnCount = 0
  g._pendingDmgMap = null; g._pendingHeal = 0; g._pendingAttrMaxCount = null
  g._pendingEnemyAtk = null
  g.elimQueue = []; g.elimAnimCells = null
  g.elimFloats = []
  g._elimSkipCombo = false
  g._enemyHpLoss = null; g._heroHpLoss = null; g._heroHpGain = null
  g.showEnemyDetail = false; g.showRunBuffDetail = false
  g.showWeaponDetail = false; g.showBattlePetDetail = null
  if (g.nextStunEnemy) {
    g.nextStunEnemy = false
    g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
  }
  g.setScene('battle')
  if (g.enemy && g.enemy.isBoss) {
    MusicMgr.playBoss(); MusicMgr.playBossBgm()
    emitShake(g, { t: 20, i: 6 })  // Boss入场强震
    g._bossEntrance = 30
    emitFlash(g, 'combo', { timer: 15, focus: 'enemy', y: V.H * 0.35, radius: 150 * S, color: '#fff0f0', alphaMul: 1.2, allowLowCombo: true })  // Boss入场白闪
    emitNotice(g, { x:V.W*0.5, y:V.H*0.35, text:'⚠ BOSS ⚠', color:'#ff4040', scale:3.0, _initScale:3.0, big:true })
  }
  g.pets.forEach(p => { p.currentCd = petHasSkill(p) ? Math.max(0, Math.ceil(p.cd * PET_CD_INIT_RATIO) - PET_CD_INIT_OFFSET) : 0 })
  initBoard(g)
  let extraTime = g.runBuffs.extraTimeSec
  if (g.weapon && g.weapon.type === 'extraTime') extraTime += g.weapon.sec
  g.dragTimeLimit = (DRAG_BASE_SEC + extraTime) * 60
}

function _safeBattle(fn) {
  return function (g) {
    try {
      return fn.apply(this, arguments)
    } catch (e) {
      console.error('[Battle] ' + fn.name + ' error:', e)
      if (g && typeof g === 'object') {
        if (g.bState && g.bState !== 'playerTurn' && g.bState !== 'victory' && g.bState !== 'defeat') {
          g.bState = 'playerTurn'
          g.dragTimer = 0
        }
        g.elimQueue = g.elimQueue || []
        g.elimAnimCells = null
        try {
          var P = require('../platform')
          P.showGameToast('战斗异常已恢复，请继续')
        } catch (_) {}
      }
    }
  }
}

module.exports = {
  getComboMul,
  addKillExp: _addKillExp,
  initBoard, fillBoard, cellAttr,
  checkAndElim: _safeBattle(checkAndElim),
  startNextElimAnim: _safeBattle(startNextElimAnim),
  processElim: _safeBattle(processElim),
  processDropAnim: _safeBattle(processDropAnim),
  findMatchesSeparate,
  enterPetAtkShow: _safeBattle(enterPetAtkShow),
  executeAttack: _safeBattle(executeAttack),
  calcCrit,
  applyFinalDamage: _safeBattle(applyFinalDamage),
  settle: _safeBattle(settle),
  enemyTurn: _safeBattle(enemyTurn),
  applyEnemySkill: _safeBattle(applyEnemySkill),
  enterBattle: _safeBattle(enterBattle),
  onPlayerTurnStart: _safeBattle(onPlayerTurnStart),
}
