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

// ===== 棋盘 =====
function initBoard(g) {
  const { ROWS, COLS } = V
  const weights = getBeadWeights(g.enemy ? g.enemy.attr : null, g.weapon)
  if (g.goodBeadsNextTurn) {
    g.goodBeadsNextTurn = false
    g.pets.forEach(p => { if (weights[p.attr] !== undefined) weights[p.attr] *= 1.5 })
  }
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
  // beadRateUp效果也在fillBoard中生效
  if (g.goodBeadsNextTurn) {
    g.goodBeadsNextTurn = false
    g.pets.forEach(p => { if (weights[p.attr] !== undefined) weights[p.attr] *= 1.5 })
  }
  const pool = []; for (const [attr, w] of Object.entries(weights)) { for (let i = 0; i < Math.round(w*10); i++) pool.push(attr) }
  for (let c = 0; c < COLS; c++) {
    let writeRow = ROWS - 1
    for (let r = ROWS-1; r >= 0; r--) {
      if (g.board[r][c]) {
        if (writeRow !== r) { g.board[writeRow][c] = g.board[r][c]; g.board[r][c] = null }
        writeRow--
      }
    }
    for (let r = writeRow; r >= 0; r--) {
      g.board[r][c] = { attr: pool[Math.floor(Math.random()*pool.length)], sealed: false }
    }
  }
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
  // 移除combo断链：所有消除都计入combo（大幅提升爽感）
  g.combo++
  // Combo弹出动画
  g._comboAnim = { num: g.combo, timer: 0, scale: 2.5, _initScale: 2.5, alpha: 1, offsetY: 0, dmgScale: 0, dmgAlpha: 0, pctScale: 0, pctAlpha: 0, pctOffX: 80*S }
  g._comboFlash = g.combo >= 5 ? 12 : 8
  const isTierBreak = g.combo === 5 || g.combo === 8 || g.combo === 12 || g.combo === 16
  if (isTierBreak) {
    g._comboFlash = 16
    g._comboAnim.scale = 3.5; g._comboAnim._initScale = 3.5
  }
  // ★ Combo里程碑：仅保留视觉特效提示，不再给予隐藏的buff/护盾/回血
  // （原设计：5连护盾、8连攻击+40%、12连伤害+80%+暴击、16连伤害+120%+暴击+回血+盾）
  // 去掉原因：玩家无法感知来源，combo不断技能配合下数值爆炸
  // 粒子
  const pCount = (g.combo >= 12 ? 40 : g.combo >= 8 ? 28 : g.combo >= 5 ? 18 : 10) + (isTierBreak ? 20 : 0)
  const pCx = W * 0.5, pCy = g.boardY + (ROWS * g.cellSize) * 0.32
  const pColors = g.combo >= 12 ? ['#ff2050','#ff6040','#ffaa00','#fff','#ff80aa']
    : g.combo >= 8 ? ['#ff4d6a','#ff8060','#ffd700','#fff']
    : g.combo >= 5 ? ['#ff8c00','#ffd700','#fff','#ffcc66']
    : ['#ffd700','#ffe066','#fff']
  for (let i = 0; i < pCount; i++) {
    const angle = Math.random() * Math.PI * 2
    const speed = (2 + Math.random() * 4) * S * (g.combo >= 8 ? 1.5 : 1)
    g._comboParticles.push({
      x: pCx, y: pCy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (1 + Math.random() * 2) * S,
      size: (2 + Math.random() * 3) * S * (g.combo >= 8 ? 1.3 : 1),
      color: pColors[Math.floor(Math.random() * pColors.length)],
      life: 20 + Math.floor(Math.random() * 20),
      t: 0, gravity: 0.15 * S,
      type: Math.random() < 0.3 ? 'star' : 'circle'
    })
  }
  if (isTierBreak) {
    const ringCount = g.combo >= 12 ? 24 : g.combo >= 8 ? 18 : 12
    const ringColors = g.combo >= 12 ? ['#fff','#ff80aa','#ffcc00','#ff4060'] : g.combo >= 8 ? ['#fff','#ffd700','#ff6080'] : ['#fff','#ffd700','#ffcc66']
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2
      const spd = (4 + Math.random() * 2) * S
      g._comboParticles.push({
        x: pCx, y: pCy,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        size: (3 + Math.random() * 2) * S,
        color: ringColors[Math.floor(Math.random() * ringColors.length)],
        life: 25 + Math.floor(Math.random() * 10),
        t: 0, gravity: 0.05 * S, type: 'circle'
      })
    }
  }
  MusicMgr.playComboHit(g.combo)
  if (isTierBreak) MusicMgr.playComboMilestone(g.combo)
  if (g.combo >= 12) { g.shakeT = isTierBreak ? 14 : 10; g.shakeI = (isTierBreak ? 8 : 6)*S }
  else if (g.combo >= 8) { g.shakeT = isTierBreak ? 10 : 7; g.shakeI = (isTierBreak ? 5.5 : 4)*S }
  else if (g.combo >= 5) { g.shakeT = isTierBreak ? 7 : 5; g.shakeI = (isTierBreak ? 3.5 : 2.5)*S }
  if (g.runBuffs.bonusCombo > 0 && g.combo === 1) { g.combo += g.runBuffs.bonusCombo }
  // 消除倍率
  let elimMul = 1.0
  if (count === 4) elimMul = 1.5
  else if (count >= 5) elimMul = 2.0
  if (count === 3) elimMul *= 1 + g.runBuffs.elim3DmgPct / 100
  if (count === 4) elimMul *= 1 + g.runBuffs.elim4DmgPct / 100
  if (count >= 5) elimMul *= 1 + g.runBuffs.elim5DmgPct / 100
  if (count >= 5 && g.enemy) {
    const stunDur = 1 + g.runBuffs.stunDurBonus
    const hasStun = g.enemyBuffs.some(b => b.type === 'stun')
    if (!hasStun) g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:stunDur, bad:true })
  }
  // 消除数值飘字
  let elimDisplayVal = 0, elimDisplayColor = '#fff'
  if (attr === 'heart') {
    let heal = (12 + Math.floor(g.floor * 0.8)) * elimMul
    heal *= 1 + g.runBuffs.heartBoostPct / 100
    if (g.weapon && g.weapon.type === 'heartBoost') heal *= 1 + g.weapon.pct / 100
    // 宠物技能heartBoost buff：心珠效果翻倍
    g.heroBuffs.forEach(b => { if (b.type === 'heartBoost') heal *= b.mul || 2 })
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
    const cs = g.cellSize, bx = g.boardX, by = g.boardY
    let cx = 0, cy = 0
    cells.forEach(({r,c}) => { cx += bx + c*cs + cs*0.5; cy += by + r*cs + cs*0.5 })
    cx /= cells.length; cy /= cells.length
    const prefix = attr === 'heart' ? '+' : ''
    const baseScale = count >= 5 ? 1.4 : count === 4 ? 1.2 : 1.0
    g.elimFloats.push({
      x: cx, y: cy,
      text: `${prefix}${elimDisplayVal}`,
      color: elimDisplayColor,
      t: 0, alpha: 1, scale: baseScale, _baseScale: baseScale
    })
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
    g._addShield(g.weapon.val || 15)
  }
  g.heroBuffs.forEach(b => {
    if (b.type === 'shieldOnElim' && b.attr === attr) g._addShield(b.val || 15)
  })
  // 法宝aoeOnElim：消除指定属性珠达到minCount时触发对敌人额外伤害
  if (g.weapon && g.weapon.type === 'aoeOnElim' && g.weapon.attr === attr && count >= (g.weapon.minCount || 5) && g.enemy) {
    const aoeDmg = Math.round(g.enemy.maxHp * 0.1)
    g.enemy.hp = Math.max(0, g.enemy.hp - aoeDmg)
    const { W, S } = V
    g.dmgFloats.push({ x:W*0.3+Math.random()*W*0.4, y:g._getEnemyCenterY()-10*S, text:`全体-${aoeDmg}`, color:ATTR_COLOR[attr]?.main||'#ff6347', t:0, alpha:1 })
    g.shakeT = 6; g.shakeI = 4
    if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount; MusicMgr.playVictory(); g.bState = 'victory'; return }
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
  if (g.dropAnimTimer >= 10) {
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

function findMatchesSeparate(g) {
  const { ROWS, COLS } = V
  const marked = Array.from({length:ROWS}, () => Array(COLS).fill(false))
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
  const visited = Array.from({length:ROWS}, () => Array(COLS).fill(false))
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

// ===== 宠物头像攻击数值展示 =====
function enterPetAtkShow(g) {
  const { S, W, H } = V
  const { TH } = V
  g._stateTimer = 0
  g.petAtkNums = []
  const dmgMap = g._pendingDmgMap || {}
  // combo伤害倍率递减
  let comboMul
  if (g.combo <= 8) comboMul = 1 + (g.combo - 1) * 0.35
  else if (g.combo <= 12) comboMul = 1 + 7 * 0.35 + (g.combo - 8) * 0.20
  else comboMul = 1 + 7 * 0.35 + 4 * 0.20 + (g.combo - 12) * 0.10
  const comboBonusMul = 1 + g.runBuffs.comboDmgPct / 100
  const { critRate, critDmg } = calcCrit(g)
  const isCrit = critRate > 0 && (critRate >= 100 || Math.random() * 100 < critRate)
  const critMul = isCrit ? (1 + critDmg / 100) : 1
  g._pendingCrit = isCrit
  g._pendingCritMul = critMul
  const L = g._getBattleLayout()
  const sidePad = 8*S, petGap = 8*S, wpnGap = 12*S
  const totalGapW = wpnGap + petGap * 4 + sidePad * 2
  const iconSize = (W - totalGapW) / 6
  const teamBarH = iconSize + 6*S
  const iconY = L.teamBarY + (teamBarH - iconSize) / 2

  // 汇总 heroBuffs 中的临时攻击加成（用于展示数值）
  let buffAllDmgPct = 0, buffAllAtkPct = 0, buffComboDmgPct = 0, buffLowHpDmgPct = 0
  const buffAttrDmgPct = {}
  g.heroBuffs.forEach(b => {
    if (b.type === 'dmgBoost') buffAttrDmgPct[b.attr] = (buffAttrDmgPct[b.attr] || 0) + b.pct
    else if (b.type === 'allDmgUp') buffAllDmgPct += b.pct
    else if (b.type === 'allAtkUp') buffAllAtkPct += b.pct
    else if (b.type === 'comboDmgUp') buffComboDmgPct += b.pct
    else if (b.type === 'lowHpDmgUp') buffLowHpDmgPct += b.pct
  })

  // 统计每个属性有多少个宠物，用于按比例分配展示数值
  const attrPetCount = {}
  g.pets.forEach(p => { attrPetCount[p.attr] = (attrPetCount[p.attr] || 0) + 1 })

  let hasAny = false
  for (let i = 0; i < g.pets.length; i++) {
    const pet = g.pets[i]
    const totalBaseDmg = dmgMap[pet.attr] || 0
    if (totalBaseDmg <= 0) continue
    // 按该宠物攻击力占同属性宠物总攻击力的比例分配
    const sameAttrPets = g.pets.filter(p => p.attr === pet.attr)
    const totalAtk = sameAttrPets.reduce((sum, p) => sum + getPetStarAtk(p), 0)
    const ratio = totalAtk > 0 ? getPetStarAtk(pet) / totalAtk : 1 / attrPetCount[pet.attr]
    const baseDmg = totalBaseDmg * ratio
    let dmg = baseDmg * comboMul * comboBonusMul
    dmg *= 1 + g.runBuffs.allDmgPct / 100
    dmg *= 1 + (g.runBuffs.attrDmgPct[pet.attr] || 0) / 100
    // 宠物技能临时buff加成
    dmg *= 1 + buffAllDmgPct / 100
    dmg *= 1 + buffAllAtkPct / 100
    dmg *= 1 + (buffAttrDmgPct[pet.attr] || 0) / 100
    if (buffComboDmgPct > 0 && g.combo > 1) dmg *= 1 + buffComboDmgPct / 100
    if (buffLowHpDmgPct > 0 && g.heroHp / g.heroMaxHp <= 0.3) dmg *= 1 + buffLowHpDmgPct / 100
    // ===== 固有残血爆发：HP越低伤害越高，给玩家翻盘手段 =====
    const hpRatioShow = g.heroHp / g.heroMaxHp
    if (hpRatioShow <= 0.15) dmg *= 2.0
    else if (hpRatioShow <= 0.30) dmg *= 1.5
    // 法宝加成
    if (g.weapon && g.weapon.type === 'attrDmgUp' && g.weapon.attr === pet.attr) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'allAtkUp') dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'attrPetAtkUp' && g.weapon.attr === pet.attr) dmg *= 1 + g.weapon.pct / 100
    let isCounter = false, isCountered = false
    if (g.enemy) {
      const enemyAttr = g.enemy.attr
      if (COUNTER_MAP[pet.attr] === enemyAttr) { dmg *= COUNTER_MUL; dmg *= 1 + g.runBuffs.counterDmgPct / 100; isCounter = true }
      else if (COUNTER_BY[pet.attr] === enemyAttr) { dmg *= COUNTERED_MUL; isCountered = true }
    }
    dmg *= critMul
    dmg = Math.round(dmg)
    if (dmg <= 0) continue
    hasAny = true
    // 克制/被克制反馈
    if (isCounter) {
      const cac = ATTR_COLOR[pet.attr]
      g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY()-30*S, text:'克制！', color: cac ? cac.main : '#ffd700', t:0, alpha:1, scale:2.2, _initScale:2.2, big:true })
      g._counterFlash = { color: cac ? cac.main : '#ffd700', timer: 10 }
      g.shakeT = Math.max(g.shakeT || 0, 8); g.shakeI = Math.max(g.shakeI || 0, 5)
      MusicMgr.playComboMilestone(5)  // 借用里程碑和弦增强打击感
    } else if (isCountered) {
      g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY()-30*S, text:'抵抗...', color:'#888888', t:0, alpha:1, scale:1.4, _initScale:1.4 })
    }
    const slotIdx = i + 1
    const ix = sidePad + iconSize + wpnGap + (slotIdx - 1) * (iconSize + petGap)
    const cx = ix + iconSize * 0.5
    const ac = ATTR_COLOR[pet.attr]
    g.petAtkNums.push({
      x: cx, y: iconY - 4*S,
      finalVal: dmg, displayVal: 0, text: '0',
      color: isCrit ? '#ffdd00' : (ac ? ac.main : '#ffd700'),
      t: 0, alpha: 1, scale: isCrit ? 1.3 : 1.0,
      rollFrames: 34, petIdx: i, isCrit: isCrit
    })
  }
  // 心珠回复
  const pendingHeal = g._pendingHeal || 0
  if (pendingHeal > 0) {
    const heal = Math.round(pendingHeal * comboMul)
    if (heal > 0) {
      hasAny = true
      const padX = 12*S
      g.petAtkNums.push({
        x: W - padX, y: L.hpBarY + 9*S,
        finalVal: heal, displayVal: 0, text: '0',
        color: '#4dcc4d', t: 0, alpha: 1, scale: 1.0,
        rollFrames: 34, isHeal: true
      })
      const oldHp = g.heroHp
      const oldPct = oldHp / g.heroMaxHp
      g.heroHp = Math.min(g.heroMaxHp, oldHp + heal)
      if (g.heroHp > oldHp) {
        g._heroHpGain = { fromPct: oldPct, timer: 0 }
        g._playHealEffect()
      }
      g._pendingHealApplied = true
    }
  }
  if (hasAny) {
    g.bState = 'petAtkShow'
    MusicMgr.playRolling()
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
  let critRate = 0, critDmg = 50
  g.heroBuffs.forEach(b => { if (b.type === 'critBoost') critRate += b.pct })
  // guaranteeCrit：指定属性必暴击（检查该属性是否有伤害）
  const dmgMap = g._pendingDmgMap || {}
  g.heroBuffs.forEach(b => {
    if (b.type === 'guaranteeCrit') {
      if (!b.attr || dmgMap[b.attr] > 0) critRate = 100
    }
  })
  // critBoostPerCombo：每段Combo暴击率递增
  g.heroBuffs.forEach(b => {
    if (b.type === 'critBoostPerCombo') critRate += b.pct * (g.combo || 0)
  })
  g.heroBuffs.forEach(b => { if (b.type === 'critDmgUp') critDmg += b.pct })
  if (g.weapon && g.weapon.type === 'critAll') { critRate += g.weapon.critRate || 0; critDmg += g.weapon.critDmg || 0 }
  if (g.weapon && g.weapon.type === 'comboToCrit') { critRate += (g.weapon.pct || 5) * g.combo }
  if (g.weapon && g.weapon.type === 'guaranteeCrit') {
    const maxCount = (g._pendingAttrMaxCount && g._pendingAttrMaxCount[g.weapon.attr]) || 0
    if (g.weapon.attr && dmgMap[g.weapon.attr] > 0 && (!g.weapon.minCount || maxCount >= g.weapon.minCount)) critRate = 100
  }
  critRate = Math.min(critRate, 100)
  return { critRate, critDmg }
}

function applyFinalDamage(g, dmgMap, heal) {
  const { S, W, H, TH } = V
  // combo伤害倍率递减
  let comboMul
  if (g.combo <= 8) comboMul = 1 + (g.combo - 1) * 0.35
  else if (g.combo <= 12) comboMul = 1 + 7 * 0.35 + (g.combo - 8) * 0.20
  else comboMul = 1 + 7 * 0.35 + 4 * 0.20 + (g.combo - 12) * 0.10
  const comboBonusMul = 1 + g.runBuffs.comboDmgPct / 100
  let isCrit, critMul
  if (g._pendingCrit != null) {
    isCrit = g._pendingCrit; critMul = g._pendingCritMul || 1
    g._pendingCrit = null; g._pendingCritMul = null
  } else {
    const cc = calcCrit(g)
    isCrit = cc.critRate > 0 && (cc.critRate >= 100 || Math.random() * 100 < cc.critRate)
    critMul = isCrit ? (1 + cc.critDmg / 100) : 1
  }
  g._lastCrit = isCrit

  // 汇总 heroBuffs 中的临时攻击加成
  let buffAllDmgPct = 0, buffAllAtkPct = 0, buffComboDmgPct = 0, buffLowHpDmgPct = 0
  let debuffAtkReduce = 0  // BOSS天罡镇压等debuff降低攻击
  const buffAttrDmgPct = {}
  g.heroBuffs.forEach(b => {
    if (b.type === 'dmgBoost') buffAttrDmgPct[b.attr] = (buffAttrDmgPct[b.attr] || 0) + b.pct
    else if (b.type === 'allDmgUp') buffAllDmgPct += b.pct
    else if (b.type === 'allAtkUp') buffAllAtkPct += b.pct
    else if (b.type === 'comboDmgUp') buffComboDmgPct += b.pct
    else if (b.type === 'lowHpDmgUp') buffLowHpDmgPct += b.pct
    else if (b.type === 'debuff' && b.field === 'atk') debuffAtkReduce += b.rate
  })

  let totalDmg = 0
  for (const [attr, baseDmg] of Object.entries(dmgMap)) {
    let dmg = baseDmg * comboMul * comboBonusMul
    // 应用BOSS debuff攻击降低
    if (debuffAtkReduce > 0) dmg *= Math.max(0.1, 1 - debuffAtkReduce)
    dmg *= 1 + g.runBuffs.allDmgPct / 100
    dmg *= 1 + (g.runBuffs.attrDmgPct[attr] || 0) / 100
    // 宠物技能临时buff加成
    dmg *= 1 + buffAllDmgPct / 100
    dmg *= 1 + buffAllAtkPct / 100
    dmg *= 1 + (buffAttrDmgPct[attr] || 0) / 100
    if (buffComboDmgPct > 0 && g.combo > 1) dmg *= 1 + buffComboDmgPct / 100
    if (buffLowHpDmgPct > 0 && g.heroHp / g.heroMaxHp <= 0.3) dmg *= 1 + buffLowHpDmgPct / 100
    // ===== 固有残血爆发：HP越低伤害越高 =====
    const hpRatioFinal = g.heroHp / g.heroMaxHp
    if (hpRatioFinal <= 0.15) dmg *= 2.0
    else if (hpRatioFinal <= 0.30) dmg *= 1.5
    // 法宝加成
    if (g.weapon && g.weapon.type === 'attrDmgUp' && g.weapon.attr === attr) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'allAtkUp') dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'attrPetAtkUp' && g.weapon.attr === attr) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'comboDmgUp') dmg *= 1 + g.weapon.pct / 100 * (g.combo > 1 ? 1 : 0)
    if (g.weapon && g.weapon.type === 'lowHpDmgUp' && g.heroHp / g.heroMaxHp <= (g.weapon.threshold || 30) / 100) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'stunBonusDmg' && g.enemyBuffs.some(b => b.type === 'stun')) dmg *= 1 + g.weapon.pct / 100
    if (g.runBuffs.weaponBoostPct > 0) dmg *= 1 + g.runBuffs.weaponBoostPct / 100
    if (g.nextDmgDouble) dmg *= 2
    if (g.enemy) {
      const enemyAttr = g.enemy.attr
      if (COUNTER_MAP[attr] === enemyAttr) {
        dmg *= COUNTER_MUL; dmg *= 1 + g.runBuffs.counterDmgPct / 100
        // 克制闪光（applyFinalDamage阶段，仅在enterPetAtkShow未触发时生效）
        if (!g._counterFlash || g._counterFlash.timer <= 0) {
          const cac = ATTR_COLOR[attr]
          g._counterFlash = { color: cac ? cac.main : '#ffd700', timer: 10 }
        }
      }
      else if (COUNTER_BY[attr] === enemyAttr) dmg *= COUNTERED_MUL
    }
    if (g.enemy) dmg = Math.max(0, dmg - (g.enemy.def || 0))
    if (g.weapon && g.weapon.type === 'ignoreDefPct' && g.weapon.attr === attr && g.enemy) {
      dmg += (g.enemy.def || 0) * g.weapon.pct / 100
    }
    // 宠物技能ignoreDefPct buff：无视部分防御
    g.heroBuffs.forEach(b => {
      if (b.type === 'ignoreDefPct' && b.attr === attr && g.enemy) {
        dmg += (g.enemy.def || 0) * b.pct / 100
      }
    })
    dmg *= critMul
    dmg = Math.round(dmg)
    if (dmg > 0) {
      totalDmg += dmg
      const ac = ATTR_COLOR[attr]
      // 飘字错位排列：每个属性的伤害飘字在y轴上递增偏移，避免重叠
      const floatIdx = Object.keys(dmgMap).indexOf(attr)
      const yOffset = floatIdx * 28 * S
      g.dmgFloats.push({ x:W*0.3+Math.random()*W*0.4, y:g._getEnemyCenterY()-30*S - yOffset, text:`-${dmg}`, color: isCrit ? '#ffdd00' : (ac?ac.main:TH.danger), t:0, alpha:1, scale: isCrit ? 1.5 : 1.1 })
    }
  }
  if (g.nextDmgDouble) g.nextDmgDouble = false

  if (totalDmg > 0 && g.enemy) {
    const oldPct = g.enemy.hp / g.enemy.maxHp
    g.enemy.hp = Math.max(0, g.enemy.hp - totalDmg)
    g._enemyHpLoss = { fromPct: oldPct, timer: 0 }
    g._playHeroAttack('', Object.keys(dmgMap)[0] || 'metal')
    g.shakeT = isCrit ? 14 : 8; g.shakeI = isCrit ? 8 : 4
    if (isCrit) g._comboFlash = 10  // 暴击白闪冲击
    // 攻击音效与伤害飘字同步播放
    if (isCrit) {
      MusicMgr.playAttackCrit()
      g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY()-40*S, text:'暴击！', color:'#ffdd00', t:0, alpha:1, scale:2.5, _initScale:2.5, big:true })
    } else {
      MusicMgr.playAttack()
    }
    if (g.weapon && g.weapon.type === 'poisonChance' && Math.random()*100 < g.weapon.chance) {
      g.enemyBuffs.push({ type:'dot', name:'中毒', dmg:g.weapon.dmg, dur:g.weapon.dur, bad:true, dotType:'poison' })
    }
    // BOSS妖力护体（bossMirror）：反弹伤害
    const mirrorBuff = g.enemyBuffs.find(b => b.type === 'bossMirror')
    if (mirrorBuff && totalDmg > 0) {
      const reflectDmg = Math.round(totalDmg * (mirrorBuff.reflectPct || 30) / 100)
      if (reflectDmg > 0) {
        g._dealDmgToHero(reflectDmg)
        g.skillEffects.push({ x:W*0.5, y:H*0.6, text:`反弹${reflectDmg}`, color:'#ff60ff', t:0, alpha:1, scale:1.3, _initScale:1.3 })
      }
    }
  }
  // 法宝execute：敌人残血低于阈值时直接斩杀
  if (g.weapon && g.weapon.type === 'execute' && g.enemy && g.enemy.hp > 0 && g.enemy.hp / g.enemy.maxHp <= (g.weapon.threshold || 10) / 100) {
    g.enemy.hp = 0
    g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY(), text:'斩 杀 ！', color:'#ff2020', t:0, alpha:1, scale:2.5, _initScale:2.5, big:true })
    g.shakeT = 10; g.shakeI = 6
  }
  // 回复
  if (heal > 0 && !g._pendingHealApplied) {
    heal *= comboMul; heal = Math.round(heal)
    const oldHp = g.heroHp, oldPct = oldHp / g.heroMaxHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + heal)
    if (g.heroHp > oldHp) { g._heroHpGain = { fromPct: oldPct, timer: 0 }; g._playHealEffect() }
  }
  g._pendingHealApplied = false
  if (g.weapon && g.weapon.type === 'comboHeal' && g.combo > 0) {
    const chAmt = Math.round(g.heroMaxHp * g.weapon.pct / 100 * g.combo)
    const chOld = g.heroHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + chAmt)
    if (g.heroHp > chOld) {
      g._heroHpGain = { fromPct: chOld / g.heroMaxHp, timer: 0 }
      g.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:H*0.65, text:`+${g.heroHp - chOld}`, color:'#88ff88', t:0, alpha:1 })
    }
  }
  // 胜利判定
  if (g.enemy && g.enemy.hp <= 0) {
    g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount
    g.bState = 'victory'; MusicMgr.playVictory()
    // 触发敌人死亡爆裂特效
    g._enemyDeathAnim = { timer: 0, duration: 45 }
    g._enemyHitFlash = 14
    g.shakeT = 12; g.shakeI = 8
    if (g.weapon && g.weapon.type === 'onKillHeal') {
      const okOld = g.heroHp
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.weapon.pct / 100))
      if (g.heroHp > okOld) {
        g._heroHpGain = { fromPct: okOld / g.heroMaxHp, timer: 0 }
        g.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:H*0.65, text:`+${g.heroHp - okOld}`, color:'#4dcc4d', t:0, alpha:1 })
      }
    }
    // 宠物技能onKillHeal buff：击杀回血
    g.heroBuffs.forEach(b => {
      if (b.type === 'onKillHeal') {
        const bkOld = g.heroHp
        g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * b.pct / 100))
        if (g.heroHp > bkOld) {
          g._heroHpGain = { fromPct: bkOld / g.heroMaxHp, timer: 0 }
          g.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:H*0.65, text:`+${g.heroHp - bkOld}`, color:'#4dcc4d', t:0, alpha:1 })
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
      g._playHealEffect()
      g.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:H*0.65, text:`+${actual}`, color:'#4dcc4d', t:0, alpha:1 })
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
    g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY(), text:'眩晕跳过！', color:TH.info, t:0, alpha:1 })
    // 眩晕跳过攻击，但仍需结算敌人身上的dot伤害
    g.enemyBuffs.forEach(b => {
      if (b.type === 'dot' && b.dmg > 0) {
        g.enemy.hp = Math.max(0, g.enemy.hp - b.dmg)
        g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`-${b.dmg}`, color:'#a040a0', t:0, alpha:1 })
      }
    })
    if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount; MusicMgr.playVictory(); g.bState = 'victory'; return }
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
  atkDmg = Math.max(0, atkDmg)
  if (g.weapon && g.weapon.type === 'blockChance' && Math.random()*100 < g.weapon.chance) {
    const blocked = atkDmg
    atkDmg = 0
    // 大字格挡特效：缩放弹跳 + 显示抵挡伤害数值
    g.skillEffects.push({ x:W*0.5, y:H*0.5, text:'格 挡 ！', color:'#40e8ff', t:0, alpha:1, scale:3.0, _initScale:3.0, big:true })
    g.skillEffects.push({ x:W*0.5, y:H*0.57, text:`抵挡 ${blocked} 伤害`, color:'#7ddfff', t:0, alpha:1, scale:1.8, _initScale:1.8 })
    g.shakeT = 8; g.shakeI = 5  // 格挡震屏
    g._blockFlash = 12  // 格挡闪白
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
    g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`反弹-${refDmg}`, color:TH.info, t:0, alpha:1 })
  }
  if (g.weapon && g.weapon.type === 'counterStun' && Math.random()*100 < g.weapon.chance) {
    g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
  }
  if (atkDmg > 0) {
    const dmgRatio = atkDmg / g.heroMaxHp
    g._dealDmgToHero(atkDmg)
    g._playEnemyAttack()
    g._heroHurtFlash = 18  // 英雄受击红闪（加长）
    MusicMgr.playEnemyAttack(dmgRatio)
    setTimeout(() => MusicMgr.playHeroHurt(dmgRatio), 100)
    g.shakeT = 10; g.shakeI = 6  // 更强震屏
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
      g.enemySkillCd = 3  // 重置倒计时
      // 预选下一个技能（用于UI预警）
      g._nextEnemySkill = g.enemy.skills[Math.floor(Math.random()*g.enemy.skills.length)]
    }
  }
  g.enemyBuffs.forEach(b => {
    if (b.type === 'dot' && b.dmg > 0) {
      g.enemy.hp = Math.max(0, g.enemy.hp - b.dmg)
      g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`-${b.dmg}`, color:'#a040a0', t:0, alpha:1 })
    }
  })
  g.enemyBuffs.forEach(b => {
    if (b.type === 'selfHeal') {
      const heal = Math.round(g.enemy.maxHp * (b.pct || 15) / 100)
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + heal)
    }
  })
  if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; g.runTotalTurns = (g.runTotalTurns||0) + g.turnCount; MusicMgr.playVictory(); g.bState = 'victory'; return }
  if (g.heroHp <= 0) { g._onDefeat(); return }
  g.turnCount++
  g._enemyTurnWait = true; g.bState = 'enemyTurn'; g._stateTimer = 0
}

function applyEnemySkill(g, skillKey) {
  const { S, W, H, TH, ROWS, COLS } = V
  const sk = ENEMY_SKILLS[skillKey]
  if (!sk) return
  // 法宝immuneDebuff：免疫所有负面效果（dot/debuff/stun/seal等，不拦截buff/selfHeal/convert/breakBead/aoe）
  const negTypes = ['dot','debuff','stun','seal','sealRow','sealAttr','sealAll']
  if (g.weapon && g.weapon.type === 'immuneDebuff' && negTypes.includes(sk.type)) {
    g.skillEffects.push({ x:W*0.5, y:H*0.5, text:'免疫！', color:'#40e8ff', t:0, alpha:1 })
    return
  }
  g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY()+30*S, text:sk.name, desc:sk.desc||'', color:TH.danger, t:0, alpha:1, scale:1.8, _initScale:1.8, big:true })
  switch(sk.type) {
    case 'buff':
      g.enemyBuffs.push({ type:'buff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:false }); break
    case 'dot':
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:Math.round(g.enemy.atk*0.3), dur:sk.dur, bad:true }); break
    case 'seal':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        if (g.board[r][c]) g.board[r][c].sealed = sk.dur || 2
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
      let aoeDmg = Math.round(g.enemy.atk * (sk.atkPct || 1.2))
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
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + Math.round(g.enemy.maxHp * (sk.pct||15) / 100)); break
    case 'breakBead':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        g.board[r][c] = null
      }
      fillBoard(g)
      break
    // ===== 封珠变体 =====
    case 'sealRow': {
      // 封锁整行灵珠
      const sr = Math.floor(Math.random() * ROWS)
      for (let c = 0; c < COLS; c++) {
        if (g.board[sr][c]) g.board[sr][c].sealed = sk.dur || 2
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
            g.board[r][c].sealed = sk.dur || 2
          }
        }
      }
      g.skillEffects.push({ x:W*0.5, y:g.boardY+60*S, text:`${ATTR_NAME[targetAttr]||targetAttr}珠封印！`, color:'#ff4040', t:0, alpha:1, scale:1.5, _initScale:1.5 })
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
      let qDmg = Math.round(g.enemy.atk * (sk.atkPct || 1.3))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') qDmg = Math.round(qDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(qDmg)
      if (sk.sealType === 'row') {
        const sr = Math.floor(Math.random() * ROWS)
        for (let c = 0; c < COLS; c++) {
          if (g.board[sr][c]) g.board[sr][c].sealed = sk.sealDur || 2
        }
      } else {
        for (let i = 0; i < (sk.sealCount || 3); i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (g.board[r][c]) g.board[r][c].sealed = sk.sealDur || 2
        }
      }
      break
    }
    case 'bossDevour': {
      // 噬魂夺魄：造成伤害 + 窃取治疗（加healBlock debuff）
      let dDmg = Math.round(g.enemy.atk * (sk.atkPct || 0.6))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') dDmg = Math.round(dDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(dDmg)
      g.heroBuffs.push({ type:'debuff', name:sk.name, field:'healRate', rate:0.5, dur:2, bad:true })
      break
    }
    case 'bossDot': {
      // 业火焚天：按攻击力百分比的持续伤害
      const dotDmg = Math.round(g.enemy.atk * (sk.atkPct || 0.4))
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:dotDmg, dur:sk.dur || 3, bad:true })
      break
    }
    case 'bossVoidSeal': {
      // 虚空禁锢：封锁整行灵珠
      const sealRow = Math.floor(Math.random() * ROWS)
      for (let c = 0; c < COLS; c++) {
        if (g.board[sealRow][c]) g.board[sealRow][c].sealed = sk.dur || 2
      }
      break
    }
    case 'bossMirror':
      // 妖力护体：给BOSS自身反弹buff
      g.enemyBuffs.push({ type:'bossMirror', name:sk.name, reflectPct:sk.reflectPct || 30, dur:sk.dur || 2, bad:false })
      break
    case 'bossWeaken':
      // 天罡镇压：同时降低攻击和防御
      g.heroBuffs.push({ type:'debuff', name:sk.name+'(攻)', field:'atk', rate:sk.atkRate || 0.4, dur:sk.dur || 2, bad:true })
      g.heroBuffs.push({ type:'debuff', name:sk.name+'(防)', field:'def', rate:sk.defRate || 0.4, dur:sk.dur || 2, bad:true })
      break
    case 'bossBlitz': {
      // 连环妖击：多段攻击
      const hits = sk.hits || 3
      for (let i = 0; i < hits; i++) {
        let bDmg = Math.round(g.enemy.atk * (sk.atkPct || 0.4))
        if (g.weapon && g.weapon.type === 'reduceSkillDmg') bDmg = Math.round(bDmg * (1 - g.weapon.pct / 100))
        g._dealDmgToHero(bDmg)
      }
      break
    }
    case 'bossDrain': {
      // 吸星大法：造成伤害并回复等量生命
      let drDmg = Math.round(g.enemy.atk * (sk.atkPct || 0.5))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') drDmg = Math.round(drDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(drDmg)
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + drDmg)
      g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`+${drDmg}`, color:'#80ff80', t:0, alpha:1 })
      break
    }
    case 'bossAnnihil': {
      // 灭世天劫：大伤害 + 碎珠
      let aDmg = Math.round(g.enemy.atk * (sk.atkPct || 1.0))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') aDmg = Math.round(aDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(aDmg)
      for (let i = 0; i < (sk.breakCount || 4); i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        g.board[r][c] = null
      }
      fillBoard(g)
      break
    }
    case 'bossCurse':
      // 万妖诅咒：固定DOT + 心珠回复减半
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:sk.dmg || 100, dur:sk.dur || 3, bad:true })
      g.heroBuffs.push({ type:'debuff', name:sk.name, field:'healRate', rate:0.5, dur:sk.dur || 3, bad:true })
      break
    case 'bossUltimate': {
      // 超越·终焉：大伤害 + 封锁（全场或随机） + 眩晕
      let uDmg = Math.round(g.enemy.atk * (sk.atkPct || 1.8))
      if (g.weapon && g.weapon.type === 'reduceSkillDmg') uDmg = Math.round(uDmg * (1 - g.weapon.pct / 100))
      g._dealDmgToHero(uDmg)
      if (sk.sealType === 'all') {
        // 封锁外围灵珠（保留中心区域可操作，避免卡死）
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
              if (g.board[r][c]) g.board[r][c].sealed = sk.sealDur || 2
            }
          }
        }
      } else {
        for (let i = 0; i < (sk.sealCount || 4); i++) {
          const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
          if (g.board[r][c]) g.board[r][c].sealed = sk.sealDur || 2
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
  g.enemySkillCd = (g.enemy.skills && g.enemy.skills.length > 0) ? 3 : -1  // 首次在第3回合触发，初始倒计时3
  // 预选首次释放的技能（用于UI预警）
  g._nextEnemySkill = (g.enemy.skills && g.enemy.skills.length > 0)
    ? g.enemy.skills[Math.floor(Math.random()*g.enemy.skills.length)]
    : null
  g.lastSpeedKill = false; g.lastTurnCount = 0
  g._pendingDmgMap = null; g._pendingHeal = 0; g._pendingAttrMaxCount = null
  g._pendingEnemyAtk = null
  g.elimQueue = []; g.elimAnimCells = null
  g.elimFloats = []; g.petAtkNums = []
  g._elimSkipCombo = false
  g._enemyHpLoss = null; g._heroHpLoss = null; g._heroHpGain = null
  g.showEnemyDetail = false; g.showRunBuffDetail = false
  g.showWeaponDetail = false; g.showBattlePetDetail = null
  if (g.nextStunEnemy) {
    g.nextStunEnemy = false
    g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:1, bad:true })
  }
  g.scene = 'battle'
  if (g.enemy && g.enemy.isBoss) {
    MusicMgr.playBoss(); MusicMgr.playBossBgm()
    g.shakeT = 20; g.shakeI = 6  // Boss入场强震
    g._bossEntrance = 30
    g._comboFlash = 15  // Boss入场白闪
    g.skillEffects.push({ x:V.W*0.5, y:V.H*0.35, text:'⚠ BOSS ⚠', color:'#ff4040', t:0, alpha:1, scale:3.0, _initScale:3.0, big:true })
  }
  g.pets.forEach(p => { p.currentCd = petHasSkill(p) ? Math.max(0, Math.ceil(p.cd * 0.4) - 1) : 0 })
  initBoard(g)
  let extraTime = g.runBuffs.extraTimeSec
  if (g.weapon && g.weapon.type === 'extraTime') extraTime += g.weapon.sec
  g.dragTimeLimit = (8 + extraTime) * 60
}

module.exports = {
  initBoard, fillBoard, cellAttr,
  checkAndElim, startNextElimAnim, processElim, processDropAnim,
  findMatchesSeparate, enterPetAtkShow,
  executeAttack, calcCrit, applyFinalDamage,
  settle, enemyTurn, applyEnemySkill,
  enterBattle, onPlayerTurnStart,
}
