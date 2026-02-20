/**
 * 宠物技能释放 + 奖励/商店/休息/奇遇应用
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const {
  ATTR_COLOR, REWARD_TYPES, generateRewards,
} = require('../data/tower')
const { randomPet, getPetStarAtk, getPetStarSkillMul, tryMergePet } = require('../data/pets')
const { randomWeapon } = require('../data/weapons')

// ===== 宠物技能 =====
// 辅助：从棋盘随机挑选N颗非目标属性的珠子
function _pickRandomCells(g, count, targetAttr) {
  const { ROWS, COLS } = V
  const available = []
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (g.board[r][c] && g.board[r][c].attr !== targetAttr) available.push({ r, c })
    }
  }
  // 洗牌后取前count个
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[available[i], available[j]] = [available[j], available[i]]
  }
  return available.slice(0, Math.min(count, available.length)).map(({ r, c }) => ({
    r, c, fromAttr: g.board[r][c].attr, toAttr: targetAttr
  }))
}

function triggerPetSkill(g, pet, idx) {
  const { S, W, H } = V
  const sk = pet.skill; if (!sk) return
  let cd = pet.cd
  if (g.runBuffs.skillCdReducePct > 0) cd = Math.max(1, Math.round(cd * (1 - g.runBuffs.skillCdReducePct / 100)))
  pet.currentCd = cd
  const attrColor = ATTR_COLOR[pet.attr]?.main || V.TH.accent

  // 攻击伤害类技能：使用攻击光波特效 + pet_skill.mp3
  const isAttackSkill = (sk.type === 'instantDmg' || sk.type === 'teamAttack' || sk.type === 'multiHit' || sk.type === 'instantDmgDot')
  if (isAttackSkill) {
    MusicMgr.playSkill()
    // 攻击光波特效（从宠物头像位置向敌人发射）
    const eCenterY = g._getEnemyCenterY()
    g._petSkillWave = {
      petIdx: idx,
      attr: sk.attr || pet.attr,
      color: attrColor,
      timer: 0,
      duration: 24,
      targetX: W * 0.5,
      targetY: eCenterY
    }
    // 攻击类也显示技能名（不显示描述，效果体现在伤害飘字上）
    g._skillFlash = {
      petName: pet.name,
      skillName: sk.name,
      skillDesc: '',
      color: attrColor,
      timer: 0,
      duration: 24,
      petIdx: idx
    }
    g._comboFlash = 6
    g.shakeT = 6; g.shakeI = 4
  } else {
    // 非攻击类技能：快闪技能名 + 描述 + 宠物头像弹跳 + 属性色光环
    MusicMgr.playSkill()
    g._skillFlash = {
      petName: pet.name,
      skillName: sk.name,
      skillDesc: sk.desc || '',
      color: attrColor,
      timer: 0,
      duration: 36,  // 0.6秒，留足时间阅读描述
      petIdx: idx
    }
    g._comboFlash = 8
    g.shakeT = 5; g.shakeI = 3
  }
  switch(sk.type) {
    case 'dmgBoost':
      g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'convertBead': {
      const { ROWS, COLS } = V
      const targetAttr = sk.attr || pet.attr
      const cells = _pickRandomCells(g, sk.count, targetAttr)
      if (cells.length) {
        g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      }
      if (sk.beadBoost) g.goodBeadsNextTurn = true
      break
    }
    case 'convertRow': {
      const { ROWS, COLS } = V
      const targetAttr = sk.attr || pet.attr
      const row = Math.floor(Math.random() * ROWS)
      const cells = []
      for (let c = 0; c < COLS; c++) {
        if (g.board[row][c] && g.board[row][c].attr !== targetAttr) {
          cells.push({ r: row, c, fromAttr: g.board[row][c].attr, toAttr: targetAttr })
        }
      }
      if (cells.length) g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      if (sk.beadBoost) g.goodBeadsNextTurn = true
      break
    }
    case 'convertCol': {
      const { ROWS, COLS } = V
      const targetAttr = sk.attr || pet.attr
      const col = Math.floor(Math.random() * COLS)
      const cells = []
      for (let r = 0; r < ROWS; r++) {
        if (g.board[r][col] && g.board[r][col].attr !== targetAttr) {
          cells.push({ r, c: col, fromAttr: g.board[r][col].attr, toAttr: targetAttr })
        }
      }
      if (cells.length) g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      break
    }
    case 'convertCross': {
      const { ROWS, COLS } = V
      const targetAttr = sk.attr || pet.attr
      const cr = Math.floor(ROWS / 2), cc = Math.floor(COLS / 2)
      const cells = []
      for (let c = 0; c < COLS; c++) {
        if (g.board[cr][c] && g.board[cr][c].attr !== targetAttr) {
          cells.push({ r: cr, c, fromAttr: g.board[cr][c].attr, toAttr: targetAttr })
        }
      }
      for (let r = 0; r < ROWS; r++) {
        if (r !== cr && g.board[r][cc] && g.board[r][cc].attr !== targetAttr) {
          cells.push({ r, c: cc, fromAttr: g.board[r][cc].attr, toAttr: targetAttr })
        }
      }
      if (cells.length) g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      break
    }
    case 'shield': {
      let shieldVal = sk.val || 50
      if (sk.bonusPct) shieldVal = Math.round(shieldVal * (1 + sk.bonusPct / 100))
      g._addShield(shieldVal); break
    }
    case 'shieldPlus':
      g._addShield(sk.val || 80)
      g.heroBuffs.push({ type:'reduceDmg', pct:sk.reducePct||30, dur:1, bad:false, name:sk.name })
      break
    case 'shieldReflect':
      g._addShield(sk.val || 80)
      g.heroBuffs.push({ type:'reflectPct', pct:sk.reflectPct||20, dur:sk.dur||2, bad:false, name:sk.name })
      break
    case 'reduceDmg':
      g.heroBuffs.push({ type:'reduceDmg', pct:sk.pct, dur:2, bad:false, name:sk.name }); break
    case 'stun':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.dur||1, bad:true }); break
    case 'stunDot':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.dur||1, bad:true })
      g.enemyBuffs.push({ type:'dot', name:sk.name, dmg:sk.dotDmg||30, dur:sk.dotDur||3, bad:true, dotType: (pet.attr === 'fire') ? 'burn' : 'poison' })
      break
    case 'stunBreakDef':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.stunDur||1, bad:true })
      if (g.enemy) g.enemy.def = 0
      break
    case 'comboPlus':
      g.combo += sk.count || 2; break
    case 'comboPlusNeverBreak':
      g.combo += sk.count || 3
      g.comboNeverBreak = true
      break
    case 'comboNeverBreakPlus':
      g.comboNeverBreak = true
      g.heroBuffs.push({ type:'comboDmgUp', pct:sk.comboDmgPct||50, dur:1, bad:false, name:sk.name })
      break
    case 'extraTime':
      g.dragTimeLimit += (sk.sec || 2) * 60; break
    case 'extraTimePlus':
      g.dragTimeLimit += (sk.sec || 3) * 60
      if (sk.attr) g.goodBeadsNextTurn = true
      if (sk.comboNeverBreak) g.comboNeverBreak = true
      break
    case 'ignoreDefPct':
      g.heroBuffs.push({ type:'ignoreDefPct', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'ignoreDefFull':
      g.heroBuffs.push({ type:'ignoreDefPct', attr:sk.attr, pct:100, dur:1, bad:false, name:sk.name })
      if (sk.dmgMul) g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr, pct:sk.dmgMul, dur:1, bad:false, name:sk.name })
      break
    case 'revive':
      g.tempRevive = true; break
    case 'revivePlus':
      g.tempRevive = true
      if (sk.healPct) g._reviveHealPct = sk.healPct
      break
    case 'healPct': {
      const hpOld1 = g.heroHp, oldPct1 = hpOld1 / g.heroMaxHp
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp*sk.pct/100))
      if (g.heroHp > hpOld1) {
        g._heroHpGain = { fromPct: oldPct1, timer: 0 }
        g._playHealEffect()
        g.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${g.heroHp - hpOld1}`, color:'#4dcc4d', t:0, alpha:1 })
      }
      break
    }
    case 'healFlat': {
      const hpOld2 = g.heroHp, oldPct2 = hpOld2 / g.heroMaxHp
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + sk.val)
      if (g.heroHp > hpOld2) {
        g._heroHpGain = { fromPct: oldPct2, timer: 0 }
        g._playHealEffect()
        g.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${g.heroHp - hpOld2}`, color:'#4dcc4d', t:0, alpha:1 })
      }
      break
    }
    case 'fullHeal': {
      const hpOld3 = g.heroHp, oldPct3 = hpOld3 / g.heroMaxHp
      g.heroHp = g.heroMaxHp
      if (g.heroHp > hpOld3) {
        g._heroHpGain = { fromPct: oldPct3, timer: 0 }
        g._playHealEffect()
        g.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${g.heroHp - hpOld3}`, color:'#4dcc4d', t:0, alpha:1 })
      }
      break
    }
    case 'fullHealPlus': {
      const hpOld4 = g.heroHp, oldPct4 = hpOld4 / g.heroMaxHp
      g.heroHp = g.heroMaxHp
      if (g.heroHp > hpOld4) {
        g._heroHpGain = { fromPct: oldPct4, timer: 0 }
        g._playHealEffect()
        g.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${g.heroHp - hpOld4}`, color:'#4dcc4d', t:0, alpha:1 })
      }
      if (sk.atkPct) g.heroBuffs.push({ type:'allAtkUp', pct:sk.atkPct, dur:3, bad:false, name:sk.name })
      break
    }
    case 'dot':
      if (sk.isHeal) {
        g.heroBuffs.push({ type:'regen', name:sk.name, heal:Math.abs(sk.dmg), dur:sk.dur, bad:false })
      } else {
        // 根据宠物属性判断是灼烧还是中毒：火属性→灼烧，其余→中毒
        const dotType = (pet.attr === 'fire') ? 'burn' : 'poison'
        g.enemyBuffs.push({ type:'dot', name:sk.name, dmg:sk.dmg, dur:sk.dur, bad:true, dotType })
        // DOT施放特效（在怪物身上显示火焰/毒雾）
        const eCY = g._getEnemyCenterY()
        const dotColor = dotType === 'burn' ? '#ff6020' : '#40cc60'
        g.skillCastAnim = { active:true, progress:0, duration:20, type:'dot', color:dotColor, skillName:'', targetX:W*0.5, targetY:eCY, dotType }
      }
      break
    case 'instantDmg':
      if (g.enemy) {
        let dmg = Math.round(getPetStarAtk(pet) * (sk.pct||150) / 100)
        dmg = Math.round(dmg * (1 + g.runBuffs.skillDmgPct / 100))
        g.enemy.hp = Math.max(0, g.enemy.hp - dmg)
        g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`-${dmg}`, color:ATTR_COLOR[sk.attr]?.main||V.TH.danger, t:0, alpha:1 })
        g._playHeroAttack(sk.name, sk.attr || pet.attr, 'burst')
        if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; MusicMgr.playVictory(); g.bState = 'victory'; return }
      }
      break
    case 'instantDmgDot':
      if (g.enemy) {
        let dmg = Math.round(getPetStarAtk(pet) * (sk.pct||300) / 100)
        dmg = Math.round(dmg * (1 + g.runBuffs.skillDmgPct / 100))
        g.enemy.hp = Math.max(0, g.enemy.hp - dmg)
        g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`-${dmg}`, color:ATTR_COLOR[sk.attr]?.main||V.TH.danger, t:0, alpha:1 })
        g._playHeroAttack(sk.name, sk.attr || pet.attr, 'burst')
        g.enemyBuffs.push({ type:'dot', name:'灼烧', dmg:sk.dotDmg||40, dur:sk.dotDur||3, bad:true, dotType:'burn' })
        if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; MusicMgr.playVictory(); g.bState = 'victory'; return }
      }
      break
    case 'multiHit':
      if (g.enemy) {
        const hits = sk.hits || 3
        let totalDmg = 0
        for (let h = 0; h < hits; h++) {
          let dmg = Math.round(getPetStarAtk(pet) * (sk.pct||100) / 100)
          dmg = Math.round(dmg * (1 + g.runBuffs.skillDmgPct / 100))
          totalDmg += dmg
          const offY = (h - (hits-1)/2) * 12*S
          g.dmgFloats.push({ x:W*0.4+Math.random()*W*0.2, y:g._getEnemyCenterY()+offY, text:`-${dmg}`, color:ATTR_COLOR[sk.attr||pet.attr]?.main||V.TH.danger, t:h*4, alpha:1 })
        }
        g.enemy.hp = Math.max(0, g.enemy.hp - totalDmg)
        g._playHeroAttack(sk.name, sk.attr || pet.attr, 'burst')
        g.shakeT = 10; g.shakeI = 6
        if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; MusicMgr.playVictory(); g.bState = 'victory'; return }
      }
      break
    case 'hpMaxUp': {
      const inc = Math.round(g.heroMaxHp * sk.pct / 100)
      g.heroMaxHp += inc; g.heroHp += inc; break
    }
    case 'hpMaxShield': {
      const inc = Math.round(g.heroMaxHp * (sk.hpPct||30) / 100)
      g.heroMaxHp += inc; g.heroHp += inc
      g._addShield(sk.shieldVal || 100)
      break
    }
    case 'heartBoost':
      g.heroBuffs.push({ type:'heartBoost', mul:sk.mul||2, dur:sk.dur||1, bad:false, name:sk.name }); break
    case 'allDmgUp':
      g.heroBuffs.push({ type:'allDmgUp', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'allAtkUp':
      g.heroBuffs.push({ type:'allAtkUp', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'allDefUp':
      g.heroBuffs.push({ type:'allDefUp', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'critBoost':
      if (sk.perCombo) {
        g.heroBuffs.push({ type:'critBoostPerCombo', pct:sk.pct, dur:sk.dur||1, bad:false, name:sk.name })
      } else {
        g.heroBuffs.push({ type:'critBoost', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name })
      }
      break
    case 'critDmgUp':
      g.heroBuffs.push({ type:'critDmgUp', pct:sk.pct, dur:1, bad:false, name:sk.name })
      if (sk.guaranteeCrit) g.heroBuffs.push({ type:'guaranteeCrit', attr:null, pct:100, dur:1, bad:false, name:sk.name })
      break
    case 'reflectPct':
      g.heroBuffs.push({ type:'reflectPct', pct:sk.pct, dur:sk.dur||2, bad:false, name:sk.name }); break
    case 'immuneCtrl':
      g.heroBuffs.push({ type:'immuneCtrl', dur:sk.dur||1, bad:false, name:sk.name }); break
    case 'immuneShield':
      g.heroBuffs.push({ type:'immuneCtrl', dur:sk.immuneDur||2, bad:false, name:sk.name })
      g._addShield(sk.shieldVal || 100)
      break
    case 'beadRateUp':
      g.goodBeadsNextTurn = true; break
    case 'comboNeverBreak':
      g.comboNeverBreak = true; break
    case 'healOnElim':
      g.heroBuffs.push({ type:'healOnElim', attr:sk.attr, pct:sk.pct, dur:3, bad:false, name:sk.name }); break
    case 'shieldOnElim':
      g.heroBuffs.push({ type:'shieldOnElim', attr:sk.attr, val:sk.val, dur:3, bad:false, name:sk.name }); break
    case 'lowHpDmgUp':
      g.heroBuffs.push({ type:'lowHpDmgUp', pct:sk.pct, dur:3, bad:false, name:sk.name }); break
    case 'stunPlusDmg':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.stunDur||1, bad:true })
      g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr||pet.attr, pct:sk.pct, dur:1, bad:false, name:sk.name })
      break
    case 'allHpMaxUp': {
      const inc2 = Math.round(g.heroMaxHp * sk.pct / 100)
      g.heroMaxHp += inc2; g.heroHp += inc2; break
    }
    case 'dmgImmune':
      g.heroBuffs.push({ type:'dmgImmune', dur:1, bad:false, name:sk.name }); break
    case 'guaranteeCrit':
      g.heroBuffs.push({ type:'guaranteeCrit', attr:sk.attr||null, pct:100, dur:1, bad:false, name:sk.name })
      if (sk.critDmgBonus) g.heroBuffs.push({ type:'critDmgUp', pct:sk.critDmgBonus, dur:1, bad:false, name:sk.name })
      break
    case 'comboDmgUp':
      g.heroBuffs.push({ type:'comboDmgUp', pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'onKillHeal':
      g.heroBuffs.push({ type:'onKillHeal', pct:sk.pct, dur:99, bad:false, name:sk.name }); break
    case 'purify':
      g.heroBuffs = g.heroBuffs.filter(b => !b.bad)
      if (sk.immuneDur) g.heroBuffs.push({ type:'immuneCtrl', dur:sk.immuneDur, bad:false, name:sk.name })
      break
    case 'warGod':
      g.heroBuffs.push({ type:'allAtkUp', pct:sk.pct||40, dur:sk.dur||3, bad:false, name:sk.name })
      g.heroBuffs.push({ type:'guaranteeCrit', attr:null, pct:100, dur:1, bad:false, name:sk.name })
      break
    case 'replaceBeads': {
      const { ROWS, COLS } = V
      const from = sk.fromAttr, to = sk.toAttr || pet.attr
      const cells = []
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (g.board[r][c] && g.board[r][c].attr === from) {
            cells.push({ r, c, fromAttr: from, toAttr: to })
          }
        }
      }
      if (cells.length) {
        g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      }
      break
    }
    case 'teamAttack': {
      if (g.enemy) {
        let totalTeamDmg = 0
        g.pets.forEach(p => {
          let dmg = Math.round(getPetStarAtk(p) * (sk.pct || 100) / 100)
          dmg = Math.round(dmg * (1 + g.runBuffs.allAtkPct / 100))
          dmg = Math.round(dmg * (1 + g.runBuffs.skillDmgPct / 100))
          if (g.enemy) dmg = Math.max(0, dmg - (g.enemy.def || 0))
          totalTeamDmg += dmg
          g.dmgFloats.push({ x:W*0.3+Math.random()*W*0.4, y:g._getEnemyCenterY()-10*S+Math.random()*20*S, text:`-${dmg}`, color:ATTR_COLOR[p.attr]?.main||V.TH.danger, t:0, alpha:1 })
        })
        g.enemy.hp = Math.max(0, g.enemy.hp - totalTeamDmg)
        g._playHeroAttack(sk.name, pet.attr, 'burst')
        if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; MusicMgr.playVictory(); g.bState = 'victory'; return }
      }
      break
    }
  }
}

// ===== 奖励应用 =====
function applyReward(g, rw) {
  if (!rw) return
  switch(rw.type) {
    case REWARD_TYPES.NEW_PET: {
      const newPet = { ...rw.data, star: rw.data.star || 1, currentCd: 0 }
      const allPets = [...g.pets, ...g.petBag]
      const mergeResult = tryMergePet(allPets, newPet)
      if (!mergeResult.merged) {
        if (g.petBag.length < 8) g.petBag.push(newPet)
        else g.petBag[g.petBag.length - 1] = newPet
      }
      break
    }
    case REWARD_TYPES.NEW_WEAPON: {
      const newWpn = { ...rw.data }
      if (g.weaponBag.length < 4) g.weaponBag.push(newWpn)
      else g.weaponBag[g.weaponBag.length - 1] = newWpn
      break
    }
    case REWARD_TYPES.BUFF:
      applyBuffReward(g, rw.data); break
  }
}

function applyBuffReward(g, b) {
  if (!b || !b.buff) return
  const isInstant = (b.buff === 'healNow' || b.buff === 'spawnHeart' || b.buff === 'nextComboNeverBreak')
  if (!isInstant) {
    g.runBuffLog = g.runBuffLog || []
    g.runBuffLog.push({ id: b.id || b.buff, label: b.label || b.buff, buff: b.buff, val: b.val, floor: g.floor })
  }
  const rb = g.runBuffs
  switch(b.buff) {
    case 'allAtkPct':       rb.allAtkPct += b.val; break
    case 'hpMaxPct': {
      rb.hpMaxPct += b.val
      const oldMax = g.heroMaxHp
      g.heroMaxHp = Math.round(60 * (1 + rb.hpMaxPct / 100))
      g.heroHp = Math.min(g.heroHp + (g.heroMaxHp - oldMax), g.heroMaxHp)
      break
    }
    case 'heartBoostPct':   rb.heartBoostPct += b.val; break
    case 'comboDmgPct':     rb.comboDmgPct += b.val; break
    case 'elim3DmgPct':     rb.elim3DmgPct += b.val; break
    case 'elim4DmgPct':     rb.elim4DmgPct += b.val; break
    case 'elim5DmgPct':     rb.elim5DmgPct += b.val; break
    case 'counterDmgPct':   rb.counterDmgPct += b.val; break
    case 'skillDmgPct':     rb.skillDmgPct += b.val; break
    case 'skillCdReducePct': rb.skillCdReducePct += b.val; break
    case 'extraTimeSec':    rb.extraTimeSec += b.val; break
    case 'regenPerTurn':    rb.regenPerTurn += b.val; break
    case 'dmgReducePct':    rb.dmgReducePct += b.val; break
    case 'bonusCombo':      rb.bonusCombo += b.val; break
    case 'stunDurBonus':    rb.stunDurBonus += b.val; break
    case 'enemyAtkReducePct':  rb.enemyAtkReducePct += b.val; break
    case 'enemyHpReducePct':   rb.enemyHpReducePct += b.val; break
    case 'enemyDefReducePct':  rb.enemyDefReducePct += b.val; break
    case 'eliteAtkReducePct':  rb.eliteAtkReducePct += b.val; break
    case 'eliteHpReducePct':   rb.eliteHpReducePct += b.val; break
    case 'bossAtkReducePct':   rb.bossAtkReducePct += b.val; break
    case 'bossHpReducePct':    rb.bossHpReducePct += b.val; break
    case 'healNow': {
      const heal = Math.round(g.heroMaxHp * b.val / 100)
      g.heroHp = Math.min(g.heroHp + heal, g.heroMaxHp); break
    }
    case 'spawnHeart':
      g.heroHp = Math.min(g.heroHp + b.val * 5, g.heroMaxHp); break
    case 'nextDmgReduce':     rb.nextDmgReducePct += b.val; break
    case 'postBattleHeal':    rb.postBattleHealPct += b.val; break
    case 'extraRevive':       rb.extraRevive += b.val; break
    case 'nextComboNeverBreak': g.comboNeverBreak = true; break
    case 'nextFirstTurnDouble': g.nextDmgDouble = true; break
    case 'nextStunEnemy':       g.nextStunEnemy = true; break
    case 'grantShield':        g._addShield(b.val); break
    case 'resetAllCd':
      g.pets.forEach(p => { if (p) p.currentCd = 0 })
      g.petBag.forEach(p => { if (p) p.currentCd = 0 })
      break
    case 'skipNextBattle':      g.skipNextBattle = true; break
    case 'immuneOnce':          g.immuneOnce = true; break
  }
}

function applyShopItem(g, item) {
  if (!item) return
  switch(item.effect) {
    case 'getPet': {
      const newPet = { ...randomPet(), currentCd: 0 }
      const allPets = [...g.pets, ...g.petBag]
      const mergeResult = tryMergePet(allPets, newPet)
      if (!mergeResult.merged) {
        if (g.petBag.length < 8) g.petBag.push(newPet)
        else { const idx = Math.floor(Math.random() * g.pets.length); g.pets[idx] = newPet }
      }
      break
    }
    case 'getWeapon': {
      const newWpn = randomWeapon()
      if (g.weaponBag.length < 4) g.weaponBag.push(newWpn)
      else if (!g.weapon) g.weapon = newWpn
      else g.weaponBag[g.weaponBag.length - 1] = newWpn
      break
    }
    case 'fullHeal':
      g.heroHp = g.heroMaxHp; break
    case 'upgradePet': {
      const idx = Math.floor(Math.random() * g.pets.length)
      g.pets[idx].atk = Math.round(g.pets[idx].atk * (1 + (item.pct||20)/100)); break
    }
    case 'clearDebuff':
      g.heroBuffs = g.heroBuffs.filter(b => !b.bad); break
    case 'hpMaxUp': {
      const inc = Math.round(g.heroMaxHp * (item.pct||10) / 100)
      g.heroMaxHp += inc; g.heroHp += inc; break
    }
  }
}

function applyRestOption(g, opt) {
  if (!opt) return
  switch(opt.effect) {
    case 'healPct':
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * opt.pct / 100)); break
    case 'allAtkUp':
      g.runBuffs.allAtkPct += opt.pct; break
  }
}

function applyAdventure(g, adv) {
  if (!adv) return
  switch(adv.effect) {
    case 'allAtkUp':      g.runBuffs.allAtkPct += adv.pct; break
    case 'healPct':        g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp*adv.pct/100)); break
    case 'hpMaxUp':        { const inc = Math.round(g.heroMaxHp*adv.pct/100); g.heroMaxHp += inc; g.heroHp += inc; break }
    case 'getWeapon':      { const w = randomWeapon(); if (g.weaponBag.length<4) g.weaponBag.push(w); else if (!g.weapon) g.weapon=w; else g.weaponBag[g.weaponBag.length-1]=w; break }
    case 'skipBattle':     g.skipNextBattle = true; break
    case 'fullHeal':       g.heroHp = g.heroMaxHp; break
    case 'extraTime':      g.runBuffs.extraTimeSec += adv.sec; break
    case 'upgradePet':     { const i = Math.floor(Math.random()*g.pets.length); g.pets[i].atk = Math.round(g.pets[i].atk*1.2); break }
    case 'shield':         g._addShield(adv.val || 50); break
    case 'nextStun':       g.nextStunEnemy = true; break
    case 'attrDmgUp':      g.runBuffs.attrDmgPct[adv.attr] = (g.runBuffs.attrDmgPct[adv.attr]||0) + adv.pct; break
    case 'multiAttrUp':    adv.attrs.forEach(a => { g.runBuffs.attrDmgPct[a] = (g.runBuffs.attrDmgPct[a]||0) + adv.pct }); break
    case 'comboNeverBreak': g.comboNeverBreak = true; break
    case 'getPet':         { const p = { ...randomPet(), currentCd: 0 }; const allP = [...g.pets, ...g.petBag]; const mr = tryMergePet(allP, p); if (!mr.merged) { if (g.petBag.length<8) g.petBag.push(p); else { const i2=Math.floor(Math.random()*g.pets.length); g.pets[i2]=p } } break }
    case 'clearDebuff':    g.heroBuffs = g.heroBuffs.filter(b => !b.bad); break
    case 'heartBoost':     g.runBuffs.heartBoostPct += adv.pct; break
    case 'weaponBoost':    g.runBuffs.weaponBoostPct += adv.pct; break
    case 'allDmgUp':       g.runBuffs.allDmgPct += adv.pct; break
    case 'skipFloor':      g.floor++; break
    case 'nextDmgDouble':  g.nextDmgDouble = true; break
    case 'tempRevive':     g.tempRevive = true; break
    case 'petAtkUp':       { const i3 = Math.floor(Math.random()*g.pets.length); g.pets[i3].atk = Math.round(g.pets[i3].atk*(1+adv.pct/100)); break }
    case 'goodBeads':      g.goodBeadsNextTurn = true; break
    case 'immuneOnce':     g.immuneOnce = true; break
    case 'tripleChoice':   g.rewards = generateRewards(g.floor, 'battle'); g.selectedReward = -1; g.rewardPetSlot = -1; g.scene = 'reward'; return
  }
}

function showSkillPreview(g, pet, index) {
  const { S } = V
  const sk = pet.skill
  if (!sk) return
  const L = g._getBattleLayout()
  const iconSize = L.iconSize
  const iconY = L.teamBarY + (L.teamBarH - iconSize) / 2
  const sidePad = 8*S, wpnGap = 12*S, petGap = 8*S
  let ix
  if (index === 0) { ix = sidePad }
  else { ix = sidePad + iconSize + wpnGap + (index - 1) * (iconSize + petGap) }
  const popupX = ix + iconSize/2
  const popupY = iconY + iconSize + 10*S
  g.skillPreview = {
    pet, index, timer: 0,
    x: popupX, y: popupY,
    skillName: sk.name,
    skillDesc: sk.desc || '无描述',
    duration: 180
  }
}

module.exports = {
  triggerPetSkill, showSkillPreview,
  applyReward, applyBuffReward,
  applyShopItem, applyRestOption, applyAdventure,
}
