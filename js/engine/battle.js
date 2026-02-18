/**
 * 战斗引擎：消除核心、攻击结算、敌方回合、棋盘管理
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const {
  ATTR_COLOR, BEAD_ATTRS, COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL,
  ENEMY_SKILLS, EVENT_TYPE, ADVENTURES, getBeadWeights,
} = require('../data/tower')

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
    if (!g._pendingDmgMap) { g._pendingDmgMap = {}; g._pendingHeal = 0; g.combo = 0 }
    g.elimQueue = groups
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
  const hasPet = attr === 'heart' || g.pets.some(p => p.attr === attr)
  if (!hasPet && !g.comboNeverBreak) {
    g.elimAnimCells = cells.map(({r,c}) => ({r,c,attr}))
    g.elimAnimTimer = 0
    g._elimSkipCombo = true
    MusicMgr.playEliminate(count)
    g.bState = 'elimAnim'
    return
  }
  g.combo++
  // Combo弹出动画
  g._comboAnim = { num: g.combo, timer: 0, scale: 2.5, _initScale: 2.5, alpha: 1, offsetY: 0, dmgScale: 0, dmgAlpha: 0, pctScale: 0, pctAlpha: 0, pctOffX: 80*S }
  g._comboFlash = g.combo >= 5 ? 8 : 5
  const isTierBreak = g.combo === 5 || g.combo === 8 || g.combo === 12
  if (isTierBreak) {
    g._comboFlash = 12
    g._comboAnim.scale = 3.5; g._comboAnim._initScale = 3.5
  }
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
    let heal = (10 + Math.floor(g.floor * 0.3)) * elimMul
    heal *= 1 + g.runBuffs.heartBoostPct / 100
    if (g.weapon && g.weapon.type === 'heartBoost') heal *= 1 + g.weapon.pct / 100
    g._pendingHeal += heal
    elimDisplayVal = Math.round(heal)
    elimDisplayColor = '#d4607a'
  } else {
    const pet = g.pets.find(p => p.attr === attr)
    if (pet) {
      let baseDmg = pet.atk * elimMul
      baseDmg *= 1 + g.runBuffs.allAtkPct / 100
      if (!g._pendingDmgMap[attr]) g._pendingDmgMap[attr] = 0
      g._pendingDmgMap[attr] += baseDmg
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
    g.elimFloats.push({
      x: cx, y: cy,
      text: `${prefix}${elimDisplayVal}`,
      color: elimDisplayColor,
      t: 0, alpha: 1, scale: count >= 5 ? 1.3 : count === 4 ? 1.15 : 1.0
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
    if (b.type === 'shieldOnElim' && b.attr === attr) g._addShield(b.val || 30)
  })
  g.elimAnimCells = cells.map(({r,c}) => ({r,c,attr}))
  g.elimAnimTimer = 0
  g.bState = 'elimAnim'
}

function processElim(g) {
  g.elimAnimTimer++
  if (g.elimAnimTimer >= 24) {
    g.elimAnimCells.forEach(({r,c}) => { g.board[r][c] = null })
    g.elimAnimCells = null
    if (g._elimSkipCombo) { g._elimSkipCombo = false }
    startNextElimAnim(g)
  }
}

function processDropAnim(g) {
  g.dropAnimTimer++
  if (g.dropAnimTimer >= 12) {
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
  const comboMul = 1 + (g.combo - 1) * 0.25
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

  let hasAny = false
  for (let i = 0; i < g.pets.length; i++) {
    const pet = g.pets[i]
    const baseDmg = dmgMap[pet.attr] || 0
    if (baseDmg <= 0) continue
    let dmg = baseDmg * comboMul * comboBonusMul
    dmg *= 1 + g.runBuffs.allDmgPct / 100
    dmg *= 1 + (g.runBuffs.attrDmgPct[pet.attr] || 0) / 100
    if (g.weapon && g.weapon.type === 'attrDmgUp' && g.weapon.attr === pet.attr) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'allAtkUp') dmg *= 1 + g.weapon.pct / 100
    if (g.enemy) {
      const enemyAttr = g.enemy.attr
      if (COUNTER_MAP[pet.attr] === enemyAttr) { dmg *= COUNTER_MUL; dmg *= 1 + g.runBuffs.counterDmgPct / 100 }
      else if (COUNTER_BY[pet.attr] === enemyAttr) { dmg *= COUNTERED_MUL }
    }
    dmg *= critMul
    dmg = Math.round(dmg)
    if (dmg <= 0) continue
    hasAny = true
    const slotIdx = i + 1
    const ix = sidePad + iconSize + wpnGap + (slotIdx - 1) * (iconSize + petGap)
    const cx = ix + iconSize * 0.5
    const ac = ATTR_COLOR[pet.attr]
    g.petAtkNums.push({
      x: cx, y: iconY - 4*S,
      finalVal: dmg, displayVal: 0, text: '0',
      color: isCrit ? '#ffdd00' : (ac ? ac.main : '#ffd700'),
      t: 0, alpha: 1, scale: isCrit ? 1.3 : 1.0,
      rollFrames: 30, petIdx: i, isCrit: isCrit
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
        rollFrames: 30, isHeal: true
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
    if (isCrit) MusicMgr.playAttackCrit()
    else MusicMgr.playAttack()
    MusicMgr.playRolling()
  } else {
    g.bState = 'preAttack'
  }
}

// ===== 攻击结算 =====
function executeAttack(g) {
  applyFinalDamage(g, g._pendingDmgMap || {}, g._pendingHeal || 0)
  g._pendingDmgMap = null; g._pendingHeal = 0
  g.storage.recordBattle(g.combo)
}

function calcCrit(g) {
  let critRate = 0, critDmg = 50
  g.heroBuffs.forEach(b => { if (b.type === 'critBoost') critRate += b.pct })
  g.heroBuffs.forEach(b => { if (b.type === 'critDmgUp') critDmg += b.pct })
  if (g.weapon && g.weapon.type === 'critAll') { critRate += g.weapon.critRate || 0; critDmg += g.weapon.critDmg || 0 }
  if (g.weapon && g.weapon.type === 'comboToCrit') { critRate += (g.weapon.pct || 5) * g.combo }
  if (g.weapon && g.weapon.type === 'guaranteeCrit') {
    const dmgMap = g._pendingDmgMap || {}
    if (g.weapon.attr && dmgMap[g.weapon.attr] > 0) critRate = 100
  }
  critRate = Math.min(critRate, 100)
  return { critRate, critDmg }
}

function applyFinalDamage(g, dmgMap, heal) {
  const { S, W, H, TH } = V
  const comboMul = 1 + (g.combo - 1) * 0.25
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
  let totalDmg = 0
  for (const [attr, baseDmg] of Object.entries(dmgMap)) {
    let dmg = baseDmg * comboMul * comboBonusMul
    dmg *= 1 + g.runBuffs.allDmgPct / 100
    dmg *= 1 + (g.runBuffs.attrDmgPct[attr] || 0) / 100
    if (g.weapon && g.weapon.type === 'attrDmgUp' && g.weapon.attr === attr) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'allAtkUp') dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'comboDmgUp') dmg *= 1 + g.weapon.pct / 100 * (g.combo > 1 ? 1 : 0)
    if (g.weapon && g.weapon.type === 'lowHpDmgUp' && g.heroHp / g.heroMaxHp <= (g.weapon.threshold || 30) / 100) dmg *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'stunBonusDmg' && g.enemyBuffs.some(b => b.type === 'stun')) dmg *= 1 + g.weapon.pct / 100
    if (g.runBuffs.weaponBoostPct > 0) dmg *= 1 + g.runBuffs.weaponBoostPct / 100
    if (g.nextDmgDouble) dmg *= 2
    if (g.enemy) {
      const enemyAttr = g.enemy.attr
      if (COUNTER_MAP[attr] === enemyAttr) { dmg *= COUNTER_MUL; dmg *= 1 + g.runBuffs.counterDmgPct / 100 }
      else if (COUNTER_BY[attr] === enemyAttr) dmg *= COUNTERED_MUL
    }
    if (g.enemy) dmg = Math.max(0, dmg - (g.enemy.def || 0))
    if (g.weapon && g.weapon.type === 'ignoreDefPct' && g.weapon.attr === attr && g.enemy) {
      dmg += (g.enemy.def || 0) * g.weapon.pct / 100
    }
    dmg *= critMul
    dmg = Math.round(dmg)
    if (dmg > 0) {
      totalDmg += dmg
      const ac = ATTR_COLOR[attr]
      g.dmgFloats.push({ x:W*0.3+Math.random()*W*0.4, y:g._getEnemyCenterY()-20*S, text:`-${dmg}`, color: isCrit ? '#ffdd00' : (ac?ac.main:TH.danger), t:0, alpha:1, scale: isCrit ? 1.4 : 1.0 })
    }
  }
  if (g.nextDmgDouble) g.nextDmgDouble = false
  if (totalDmg > 0 && g.enemy) {
    const oldPct = g.enemy.hp / g.enemy.maxHp
    g.enemy.hp = Math.max(0, g.enemy.hp - totalDmg)
    g._enemyHpLoss = { fromPct: oldPct, timer: 0 }
    g._playHeroAttack('', Object.keys(dmgMap)[0] || 'metal')
    g.shakeT = isCrit ? 12 : 8; g.shakeI = isCrit ? 6 : 4
    if (isCrit) {
      g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY()-40*S, text:'暴击！', color:'#ffdd00', t:0, alpha:1 })
      MusicMgr.playCritHit()
    }
    if (g.weapon && g.weapon.type === 'poisonChance' && Math.random()*100 < g.weapon.chance) {
      g.enemyBuffs.push({ type:'dot', name:'中毒', dmg:g.weapon.dmg, dur:g.weapon.dur, bad:true })
    }
  }
  // 回复
  if (heal > 0 && !g._pendingHealApplied) {
    heal *= comboMul; heal = Math.round(heal)
    const oldHp = g.heroHp, oldPct = oldHp / g.heroMaxHp
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + heal)
    if (g.heroHp > oldHp) { g._heroHpGain = { fromPct: oldPct, timer: 0 }; g._playHealEffect() }
  }
  g._pendingHealApplied = false
  if (g.weapon && g.weapon.type === 'regenPct') {
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.weapon.pct / 100))
  }
  if (g.runBuffs.regenPerTurn > 0) {
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + g.runBuffs.regenPerTurn)
  }
  g.heroBuffs.forEach(b => {
    if (b.type === 'regen' && b.heal > 0) {
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + b.heal)
      g.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:H*0.65, text:`+${b.heal}`, color:'#88ff88', t:0, alpha:1 })
    }
  })
  if (g.weapon && g.weapon.type === 'comboHeal' && g.combo > 0) {
    g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.weapon.pct / 100 * g.combo))
  }
  // 胜利判定
  if (g.enemy && g.enemy.hp <= 0) {
    g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5
    g.bState = 'victory'; MusicMgr.playVictory()
    if (g.weapon && g.weapon.type === 'onKillHeal') {
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.weapon.pct / 100))
    }
    if (g.runBuffs.postBattleHealPct > 0) {
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * g.runBuffs.postBattleHealPct / 100))
    }
    g.runBuffs.nextDmgReducePct = 0
    if (g.runBuffLog) g.runBuffLog = g.runBuffLog.filter(e => e.buff !== 'nextDmgReduce')
    return
  }
  settle(g)
}

// ===== 回合结算 =====
function settle(g) {
  g.heroBuffs = g.heroBuffs.filter(b => { b.dur--; return b.dur > 0 })
  g.enemyBuffs = g.enemyBuffs.filter(b => { b.dur--; return b.dur > 0 })
  g.pets.forEach(p => { if (p.currentCd > 0) p.currentCd-- })
  g.comboNeverBreak = false
  g.bState = 'preEnemy'; g._stateTimer = 0
}

function enemyTurn(g) {
  const { S, W, H, TH } = V
  if (!g.enemy || g.enemy.hp <= 0) { g.bState = 'playerTurn'; g.dragTimer = 0; return }
  const stunBuff = g.enemyBuffs.find(b => b.type === 'stun')
  if (stunBuff) {
    g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY(), text:'眩晕跳过！', color:TH.info, t:0, alpha:1 })
    g.turnCount++
    g._enemyTurnWait = true; g.bState = 'enemyTurn'; g._stateTimer = 0
    return
  }
  let atkDmg = g.enemy.atk
  const atkBuff = g.enemyBuffs.find(b => b.type === 'buff' && b.field === 'atk')
  if (atkBuff) atkDmg = Math.round(atkDmg * (1 + atkBuff.rate))
  let reducePct = 0
  g.heroBuffs.forEach(b => { if (b.type === 'reduceDmg') reducePct += b.pct })
  if (g.weapon && g.weapon.type === 'reduceDmg') reducePct += g.weapon.pct
  reducePct += g.runBuffs.dmgReducePct
  if (g.runBuffs.nextDmgReducePct > 0) reducePct += g.runBuffs.nextDmgReducePct
  atkDmg = Math.round(atkDmg * (1 - reducePct / 100))
  atkDmg = Math.max(0, atkDmg)
  if (g.weapon && g.weapon.type === 'blockChance' && Math.random()*100 < g.weapon.chance) {
    atkDmg = 0
    g.skillEffects.push({ x:W*0.5, y:H*0.6, text:'格挡！', color:TH.info, t:0, alpha:1 })
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
    MusicMgr.playEnemyAttack(dmgRatio)
    setTimeout(() => MusicMgr.playHeroHurt(dmgRatio), 100)
    g.shakeT = 6; g.shakeI = 3
  }
  g.heroBuffs.forEach(b => {
    if (b.type === 'dot' && b.dmg > 0) {
      if (g.weapon && g.weapon.type === 'immuneDot') return
      g._dealDmgToHero(b.dmg)
    }
  })
  if (g.enemy.skills && g.turnCount > 0 && g.turnCount % 3 === 0) {
    const sk = g.enemy.skills[Math.floor(Math.random()*g.enemy.skills.length)]
    MusicMgr.playEnemySkill()
    applyEnemySkill(g, sk)
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
  if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; MusicMgr.playVictory(); g.bState = 'victory'; return }
  if (g.heroHp <= 0) { g._onDefeat(); return }
  g.turnCount++
  g._enemyTurnWait = true; g.bState = 'enemyTurn'; g._stateTimer = 0
}

function applyEnemySkill(g, skillKey) {
  const { S, W, H, TH, ROWS, COLS } = V
  const sk = ENEMY_SKILLS[skillKey]
  if (!sk) return
  g.skillEffects.push({ x:W*0.5, y:g._getEnemyCenterY()+30*S, text:sk.name, color:TH.danger, t:0, alpha:1 })
  switch(sk.type) {
    case 'buff':
      g.enemyBuffs.push({ type:'buff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:false }); break
    case 'dot':
      g.heroBuffs.push({ type:'dot', name:sk.name, dmg:Math.round(g.enemy.atk*0.3), dur:sk.dur, bad:true }); break
    case 'seal':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        if (g.board[r][c]) g.board[r][c].sealed = true
      }
      break
    case 'convert':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        if (g.board[r][c]) g.board[r][c].attr = BEAD_ATTRS[Math.floor(Math.random()*5)]
      }
      break
    case 'aoe':
      g._dealDmgToHero(Math.round(g.enemy.atk * 0.5)); break
    case 'debuff':
      g.heroBuffs.push({ type:'debuff', name:sk.name, field:sk.field, rate:sk.rate, dur:sk.dur, bad:true }); break
    case 'stun':
      if (!g.immuneOnce && !(g.weapon && (g.weapon.type === 'immuneStun' || g.weapon.type === 'immuneCtrl'))) {
        g.heroBuffs.push({ type:'heroStun', name:'眩晕', dur:sk.dur, bad:true })
      } else { g.immuneOnce = false }
      break
    case 'selfHeal':
      g.enemy.hp = Math.min(g.enemy.maxHp, g.enemy.hp + Math.round(g.enemy.maxHp * (sk.pct||15) / 100)); break
    case 'breakBead':
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        g.board[r][c] = null
      }
      fillBoard(g)
      break
  }
}

// ===== 战斗进入 =====
function enterBattle(g, enemyData) {
  const { S, COLS, ROWS } = V
  g.enemy = { ...enemyData }
  g._baseHeroMaxHp = g.heroMaxHp
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
  g.enemyBuffs = []
  g.bState = 'playerTurn'
  g.combo = 0; g.turnCount = 0
  g.lastSpeedKill = false; g.lastTurnCount = 0
  g._pendingDmgMap = null; g._pendingHeal = 0
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
  if (g.enemy && g.enemy.isBoss) MusicMgr.playBoss()
  g.pets.forEach(p => { p.currentCd = Math.ceil(p.cd * 0.6) })
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
  enterBattle,
}
