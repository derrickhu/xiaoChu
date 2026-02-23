/**
 * 宠物技能释放 + 奖励/商店/休息/奇遇应用
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const {
  ATTR_COLOR, REWARD_TYPES, generateRewards,
} = require('../data/tower')
const { randomPet, randomPetFromPool, getPetStarAtk, getPetStarSkillMul, tryMergePet, MAX_STAR, getStar3Override, getPetSkillDesc, getMaxedPetIds, petHasSkill } = require('../data/pets')
const { randomWeapon } = require('../data/weapons')

// 辅助：tryMergePet 后检查是否升到满星，记录图鉴
function _mergePetAndDex(g, allPets, newPet) {
  const result = tryMergePet(allPets, newPet)
  if (result.merged && result.target && (result.target.star || 1) >= MAX_STAR) {
    g.storage.addPetDex(result.target.id)
  }
  return result
}

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
  const baseSk = pet.skill; if (!baseSk) return
  // ★1无技能，需要★2+才能使用
  if (!petHasSkill(pet)) return
  // ★3强化：合并覆写数据到技能对象
  const star = pet.star || 1
  const override = (star >= 3) ? getStar3Override(pet.id) : null
  const sk = override ? { ...baseSk, ...override } : baseSk
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
      skillDesc: getPetSkillDesc(pet) || '',
      color: attrColor,
      timer: 0,
      duration: 36,  // 0.6秒，留足时间阅读描述
      petIdx: idx
    }
    g._comboFlash = 8
    g.shakeT = 5; g.shakeI = 3
  }
  // 星级技能数值倍率（★1=1.0, ★2=1.25, ★3≈1.56）
  const sMul = getPetStarSkillMul(pet)

  switch(sk.type) {
    case 'dmgBoost':
      g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr, pct:Math.round(sk.pct * sMul), dur:sk.dur||1, bad:false, name:sk.name }); break
    case 'convertBead': {
      const { ROWS, COLS } = V
      const targetAttr = sk.attr || pet.attr
      const cells = _pickRandomCells(g, sk.count, targetAttr)
      if (cells.length) {
        g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      }
      if (sk.beadBoost) g.goodBeadsNextTurn = true
      // ★3附加增伤
      if (sk.dmgBoost) g.heroBuffs.push({ type:'dmgBoost', attr:targetAttr, pct:Math.round(sk.dmgBoost * sMul), dur:1, bad:false, name:sk.name })
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
      // ★3额外随机珠子
      if (sk.extra) {
        const extraCells = _pickRandomCells(g, sk.extra, targetAttr)
          .filter(ec => !cells.some(c => c.r === ec.r && c.c === ec.c))
        cells.push(...extraCells)
      }
      if (cells.length) g._beadConvertAnim = { cells, timer: 0, phase: 'charge', duration: 24 }
      if (sk.beadBoost) g.goodBeadsNextTurn = true
      // ★3附加增伤
      if (sk.dmgBoost) g.heroBuffs.push({ type:'dmgBoost', attr:targetAttr, pct:Math.round(sk.dmgBoost * sMul), dur:1, bad:false, name:sk.name })
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
      // ★3额外随机珠子
      if (sk.extra) {
        const extraCells = _pickRandomCells(g, sk.extra, targetAttr)
          .filter(ec => !cells.some(c => c.r === ec.r && c.c === ec.c))
        cells.push(...extraCells)
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
      // ★3附加增伤
      if (sk.dmgBoost) g.heroBuffs.push({ type:'dmgBoost', attr:targetAttr, pct:Math.round(sk.dmgBoost * sMul), dur:1, bad:false, name:sk.name })
      break
    }
    case 'shield': {
      let shieldVal = sk.val || 30
      shieldVal = Math.round(shieldVal * sMul)
      if (sk.bonusPct) shieldVal = Math.round(shieldVal * (1 + sk.bonusPct / 100))
      g._addShield(shieldVal)
      // ★3附加减伤
      if (sk.reducePct) g.heroBuffs.push({ type:'reduceDmg', pct:sk.reducePct, dur:1, bad:false, name:sk.name })
      break
    }
    case 'shieldPlus':
      g._addShield(Math.round((sk.val || 40) * sMul))
      g.heroBuffs.push({ type:'reduceDmg', pct:sk.reducePct||30, dur:sk.dur||1, bad:false, name:sk.name })
      // ★3附加反弹
      if (sk.reflectPct) g.heroBuffs.push({ type:'reflectPct', pct:sk.reflectPct, dur:sk.dur||2, bad:false, name:sk.name })
      break
    case 'shieldReflect':
      g._addShield(Math.round((sk.val || 40) * sMul))
      g.heroBuffs.push({ type:'reflectPct', pct:sk.reflectPct||20, dur:sk.dur||2, bad:false, name:sk.name })
      break
    case 'reduceDmg':
      g.heroBuffs.push({ type:'reduceDmg', pct:sk.pct, dur:2, bad:false, name:sk.name }); break
    case 'stun':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.dur||1, bad:true })
      // ★3附加易伤
      if (sk.extraDmgPct) g.enemyBuffs.push({ type:'vulnerable', name:'易伤', pct:sk.extraDmgPct, dur:sk.dur||1, bad:true })
      break
    case 'stunDot':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.dur||1, bad:true })
      g.enemyBuffs.push({ type:'dot', name:sk.name, dmg:Math.round((sk.dotDmg||30) * sMul), dur:sk.dotDur||3, bad:true, dotType: (pet.attr === 'fire') ? 'burn' : 'poison' })
      break
    case 'stunBreakDef':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.stunDur||1, bad:true })
      if (g.enemy) g.enemy.def = 0
      // ★3附加易伤
      if (sk.extraDmgPct) g.enemyBuffs.push({ type:'vulnerable', name:'易伤', pct:sk.extraDmgPct, dur:sk.stunDur||1, bad:true })
      break
    case 'comboPlus':
      g.combo += sk.count || 2; break
    case 'comboPlusNeverBreak':
      g.combo += sk.count || 3
      g.comboNeverBreak = true
      // ★3附加Combo伤害加成
      if (sk.comboDmgPct) g.heroBuffs.push({ type:'comboDmgUp', pct:Math.round(sk.comboDmgPct * sMul), dur:1, bad:false, name:sk.name })
      break
    case 'comboNeverBreakPlus':
      g.comboNeverBreak = true
      g.heroBuffs.push({ type:'comboDmgUp', pct:Math.round((sk.comboDmgPct||50) * sMul), dur:1, bad:false, name:sk.name })
      break
    case 'extraTime':
      g.dragTimeLimit += (sk.sec || 2) * 60; break
    case 'extraTimePlus':
      g.dragTimeLimit += (sk.sec || 3) * 60
      if (sk.attr) g.goodBeadsNextTurn = true
      if (sk.comboNeverBreak) g.comboNeverBreak = true
      // ★3附加Combo
      if (sk.bonusCombo) g.combo += sk.bonusCombo
      break
    case 'ignoreDefPct':
      g.heroBuffs.push({ type:'ignoreDefPct', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'ignoreDefFull':
      g.heroBuffs.push({ type:'ignoreDefPct', attr:sk.attr, pct:100, dur:1, bad:false, name:sk.name })
      if (sk.dmgMul) g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr, pct:Math.round(sk.dmgMul * sMul), dur:1, bad:false, name:sk.name })
      break
    case 'revive':
      g.tempRevive = true; break
    case 'revivePlus':
      g.tempRevive = true
      if (sk.healPct) g._reviveHealPct = sk.healPct
      // ★3附加无敌
      if (sk.immuneDur) g.heroBuffs.push({ type:'dmgImmune', dur:sk.immuneDur, bad:false, name:sk.name })
      break
    case 'healPct': {
      const hpOld1 = g.heroHp, oldPct1 = hpOld1 / g.heroMaxHp
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp*sk.pct*sMul/100))
      if (g.heroHp > hpOld1) {
        g._heroHpGain = { fromPct: oldPct1, timer: 0 }
        g._playHealEffect()
        g.dmgFloats.push({ x:W*0.5, y:H*0.65, text:`+${g.heroHp - hpOld1}`, color:'#4dcc4d', t:0, alpha:1 })
      }
      // ★3附加净化
      if (sk.cleanse) {
        const badBuffs = g.heroBuffs.filter(b => b.bad)
        for (let i = 0; i < sk.cleanse && badBuffs.length > 0; i++) {
          const idx = g.heroBuffs.indexOf(badBuffs.pop())
          if (idx >= 0) g.heroBuffs.splice(idx, 1)
        }
      }
      break
    }
    case 'healFlat': {
      const hpOld2 = g.heroHp, oldPct2 = hpOld2 / g.heroMaxHp
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(sk.val * sMul))
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
      if (sk.atkPct) g.heroBuffs.push({ type:'allAtkUp', pct:Math.round(sk.atkPct * sMul), dur:3, bad:false, name:sk.name })
      break
    }
    case 'dot':
      if (sk.isHeal) {
        g.heroBuffs.push({ type:'regen', name:sk.name, heal:Math.round(Math.abs(sk.dmg) * sMul), dur:sk.dur, bad:false })
      } else {
        // 根据宠物属性判断是灼烧还是中毒：火属性→灼烧，其余→中毒
        const dotType = (pet.attr === 'fire') ? 'burn' : 'poison'
        g.enemyBuffs.push({ type:'dot', name:sk.name, dmg:Math.round(sk.dmg * sMul), dur:sk.dur, bad:true, dotType })
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
        // ★3无视防御
        if (sk.ignoreDefPct) {
          const ignoreDef = Math.round((g.enemy.def || 0) * sk.ignoreDefPct / 100)
          dmg = Math.max(0, dmg + ignoreDef)  // 相当于少减防御
        }
        g.enemy.hp = Math.max(0, g.enemy.hp - dmg)
        g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`-${dmg}`, color:ATTR_COLOR[sk.attr]?.main||V.TH.danger, t:0, alpha:1 })
        g._playHeroAttack(sk.name, sk.attr || pet.attr, 'burst')
        // ★3附加眩晕
        if (sk.stunDur) g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.stunDur, bad:true })
        // ★3附加全体回复
        if (sk.teamHealPct) {
          const heal = Math.round(g.heroMaxHp * sk.teamHealPct / 100)
          g.heroHp = Math.min(g.heroMaxHp, g.heroHp + heal)
        }
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
        g.enemyBuffs.push({ type:'dot', name:'灼烧', dmg:Math.round((sk.dotDmg||40) * sMul), dur:sk.dotDur||3, bad:true, dotType:'burn' })
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
      g._addShield(Math.round((sk.shieldVal || 50) * sMul))
      break
    }
    case 'heartBoost':
      g.heroBuffs.push({ type:'heartBoost', mul:Math.round((sk.mul||2) * sMul * 10)/10, dur:sk.dur||1, bad:false, name:sk.name }); break
    case 'allDmgUp':
      g.heroBuffs.push({ type:'allDmgUp', pct:Math.round(sk.pct * sMul), dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'allAtkUp':
      g.heroBuffs.push({ type:'allAtkUp', pct:Math.round(sk.pct * sMul), dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'allDefUp':
      g.heroBuffs.push({ type:'allDefUp', pct:Math.round(sk.pct * sMul), dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'critBoost':
      if (sk.perCombo) {
        g.heroBuffs.push({ type:'critBoostPerCombo', pct:Math.round(sk.pct * sMul), dur:sk.dur||1, bad:false, name:sk.name })
      } else {
        g.heroBuffs.push({ type:'critBoost', pct:Math.round(sk.pct * sMul), dur:sk.dur||3, bad:false, name:sk.name })
      }
      break
    case 'critDmgUp':
      g.heroBuffs.push({ type:'critDmgUp', pct:Math.round(sk.pct * sMul), dur:1, bad:false, name:sk.name })
      if (sk.guaranteeCrit) g.heroBuffs.push({ type:'guaranteeCrit', attr:null, pct:100, dur:sk.critDur||1, bad:false, name:sk.name })
      break
    case 'reflectPct':
      g.heroBuffs.push({ type:'reflectPct', pct:sk.pct, dur:sk.dur||2, bad:false, name:sk.name }); break
    case 'immuneCtrl':
      g.heroBuffs.push({ type:'immuneCtrl', dur:sk.dur||1, bad:false, name:sk.name })
      // ★3附加护盾
      if (sk.shieldVal) g._addShield(Math.round(sk.shieldVal * sMul))
      break
    case 'immuneShield':
      g.heroBuffs.push({ type:'immuneCtrl', dur:sk.immuneDur||2, bad:false, name:sk.name })
      g._addShield(Math.round((sk.shieldVal || 50) * sMul))
      break
    case 'beadRateUp':
      g.goodBeadsNextTurn = true; break
    case 'comboNeverBreak':
      g.comboNeverBreak = true; break
    case 'healOnElim':
      g.heroBuffs.push({ type:'healOnElim', attr:sk.attr, pct:Math.round(sk.pct * sMul), dur:3, bad:false, name:sk.name }); break
    case 'shieldOnElim':
      g.heroBuffs.push({ type:'shieldOnElim', attr:sk.attr, val:Math.round(sk.val * sMul), dur:sk.dur||2, bad:false, name:sk.name }); break
    case 'lowHpDmgUp':
      g.heroBuffs.push({ type:'lowHpDmgUp', pct:Math.round(sk.pct * sMul), dur:3, bad:false, name:sk.name }); break
    case 'stunPlusDmg':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.stunDur||1, bad:true })
      g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr||pet.attr, pct:Math.round(sk.pct * sMul), dur:1, bad:false, name:sk.name })
      break
    case 'allHpMaxUp': {
      const inc2 = Math.round(g.heroMaxHp * sk.pct / 100)
      g.heroMaxHp += inc2; g.heroHp += inc2; break
    }
    case 'dmgImmune':
      g.heroBuffs.push({ type:'dmgImmune', dur:1, bad:false, name:sk.name }); break
    case 'guaranteeCrit':
      g.heroBuffs.push({ type:'guaranteeCrit', attr:sk.attr||null, pct:100, dur:1, bad:false, name:sk.name })
      if (sk.critDmgBonus) g.heroBuffs.push({ type:'critDmgUp', pct:Math.round(sk.critDmgBonus * sMul), dur:1, bad:false, name:sk.name })
      break
    case 'comboDmgUp':
      g.heroBuffs.push({ type:'comboDmgUp', pct:Math.round(sk.pct * sMul), dur:1, bad:false, name:sk.name }); break
    case 'onKillHeal':
      g.heroBuffs.push({ type:'onKillHeal', pct:Math.round(sk.pct * sMul), dur:99, bad:false, name:sk.name }); break
    case 'purify':
      g.heroBuffs = g.heroBuffs.filter(b => !b.bad)
      if (sk.immuneDur) g.heroBuffs.push({ type:'immuneCtrl', dur:sk.immuneDur, bad:false, name:sk.name })
      // ★3附加治疗
      if (sk.healPct) {
        const heal = Math.round(g.heroMaxHp * sk.healPct / 100)
        g.heroHp = Math.min(g.heroMaxHp, g.heroHp + heal)
      }
      break
    case 'warGod':
      g.heroBuffs.push({ type:'allAtkUp', pct:Math.round((sk.pct||40) * sMul), dur:sk.dur||3, bad:false, name:sk.name })
      g.heroBuffs.push({ type:'guaranteeCrit', attr:null, pct:100, dur:sk.critDur||1, bad:false, name:sk.name })
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
      // 附带增伤buff
      if (sk.dmgBoost) g.heroBuffs.push({ type:'dmgBoost', attr:to, pct:Math.round(sk.dmgBoost * sMul), dur:1, bad:false, name:sk.name })
      // 附带全队攻击提升
      if (sk.atkBoost) g.heroBuffs.push({ type:'allAtkUp', pct:Math.round(sk.atkBoost * sMul), dur:2, bad:false, name:sk.name })
      // 附带全队防御提升
      if (sk.defBoost) g.heroBuffs.push({ type:'allDefUp', pct:Math.round(sk.defBoost * sMul), dur:2, bad:false, name:sk.name })
      // 附带回血
      if (sk.regen) g.heroBuffs.push({ type:'regen', name:sk.name, heal:Math.round(sk.regen * sMul), dur:sk.regenDur||2, bad:false })
      // 附带珠子概率大增
      if (sk.beadBoost) g.goodBeadsNextTurn = true
      // ★3附加心珠回复加成
      if (sk.heartBoost) g.heroBuffs.push({ type:'heartBoost', mul:1 + sk.heartBoost/100, dur:2, bad:false, name:sk.name })
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
  // 记录本次奖励结果，供事件页显示 NEW/UP 角标
  g._lastRewardInfo = null
  switch(rw.type) {
    case REWARD_TYPES.NEW_PET: {
      const newPet = { ...rw.data, star: rw.data.star || 1, currentCd: 0 }
      const allPets = [...g.pets, ...g.petBag]
      const mergeResult = _mergePetAndDex(g, allPets, newPet)
      if (!mergeResult.merged) {
        g.petBag.push(newPet)
        g._lastRewardInfo = { type: 'newPet', petId: newPet.id }
        // 获得新宠物：弹出提示 + 音效
        g._petObtainedPopup = { pet: { ...newPet }, type: 'new' }
        MusicMgr.playPetObtained()
      } else if (mergeResult.target) {
        // 已有同ID宠物→升星
        g._lastRewardInfo = { type: 'starUp', petId: mergeResult.target.id }
        const newStar = mergeResult.target.star || 1
        // 升至★3满星：触发庆祝画面
        if (newStar >= MAX_STAR) {
          g._star3Celebration = {
            pet: mergeResult.target,
            timer: 0,
            phase: 'fadeIn',  // fadeIn → show → ready
            particles: [],
          }
          MusicMgr.playStar3Unlock()
        } else {
          // 升至★2：弹出提示（★3已有图鉴解锁庆祝，不重复显示）+ 音效
          g._petObtainedPopup = { pet: { ...mergeResult.target }, type: 'starUp' }
          MusicMgr.playPetObtained()
        }
      }
      break
    }
    case REWARD_TYPES.NEW_WEAPON: {
      const newWpn = { ...rw.data }
      g.weaponBag.push(newWpn)
      g._lastRewardInfo = { type: 'newWeapon', weaponId: newWpn.id }
      break
    }
    case REWARD_TYPES.BUFF:
      applyBuffReward(g, rw.data); break
  }
}

function applyBuffReward(g, b) {
  if (!b || !b.buff) return
  const isInstant = (b.buff === 'healNow' || b.buff === 'spawnHeart' || b.buff === 'nextComboNeverBreak'
    || b.buff === 'nextFirstTurnDouble' || b.buff === 'nextStunEnemy' || b.buff === 'grantShield'
    || b.buff === 'resetAllCd' || b.buff === 'skipNextBattle' || b.buff === 'immuneOnce')
  if (!isInstant) {
    g.runBuffLog = g.runBuffLog || []
    // 统一 key 名，使 runBuffLog 中的 buff 字段与 BUFF_FULL_LABELS 一致
    const logBuff = b.buff === 'nextDmgReduce' ? 'nextDmgReducePct'
                  : b.buff === 'postBattleHeal' ? 'postBattleHealPct'
                  : b.buff
    g.runBuffLog.push({ id: b.id || b.buff, label: b.label || b.buff, buff: logBuff, val: b.val, floor: g.floor })
  }
  const rb = g.runBuffs
  switch(b.buff) {
    case 'allAtkPct':       rb.allAtkPct += b.val; break
    case 'hpMaxPct': {
      // 增量式：基于当前 heroMaxHp 的百分比增加
      const inc = Math.round(g.heroMaxHp * b.val / 100)
      g.heroMaxHp += inc
      g.heroHp = Math.min(g.heroHp + inc, g.heroMaxHp)
      rb.hpMaxPct += b.val
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
    case 'getPetByAttr': {
      // 需要选择属性后再调用 applyShopPetByAttr
      // 这里是 fallback（如果直接调用则随机属性）
      const newPet = { ...randomPetFromPool(g.sessionPetPool, null, 'shop', getMaxedPetIds(g)), currentCd: 0 }
      const allPets = [...g.pets, ...g.petBag]
      const mergeResult = _mergePetAndDex(g, allPets, newPet)
      if (!mergeResult.merged) {
        g.petBag.push(newPet)
      }
      break
    }
    case 'getWeapon': {
      const newWpn = randomWeapon()
      g.weaponBag.push(newWpn)
      break
    }
    case 'fullHeal':
      g.heroHp = g.heroMaxHp; break
    case 'upgradePet': {
      // 需要选择目标宠物后调用 applyShopUpgradePet
      // fallback: 随机选一只
      const idx = Math.floor(Math.random() * g.pets.length)
      g.pets[idx].atk = Math.round(g.pets[idx].atk * (1 + (item.pct||25)/100)); break
    }
    case 'starUp': {
      // 需要选择目标宠物后调用 applyShopStarUp
      // fallback: 随机选一只未满星的
      const candidates = g.pets.filter(p => (p.star || 1) < 3)
      if (candidates.length > 0) {
        const p = candidates[Math.floor(Math.random() * candidates.length)]
        p.star = (p.star || 1) + 1
      }
      break
    }
    case 'cdReduce': {
      // 需要选择目标宠物后调用 applyShopCdReduce
      // fallback: 随机选一只 cd > 2 的
      const candidates = g.pets.filter(p => p.cd > 2)
      if (candidates.length > 0) {
        const p = candidates[Math.floor(Math.random() * candidates.length)]
        p.cd = Math.max(2, p.cd - 1)
      }
      break
    }
    case 'hpMaxUp': {
      const inc = Math.round(g.heroMaxHp * (item.pct||15) / 100)
      g.heroMaxHp += inc; g.heroHp += inc; break
    }
    case 'dmgReduce':
      g.runBuffs.dmgReducePct += (item.pct || 8)
      g.runBuffLog = g.runBuffLog || []
      g.runBuffLog.push({ id: item.id, label: `受伤减免+${item.pct||8}%`, buff: 'dmgReducePct', val: item.pct||8, floor: g.floor })
      break
    case 'extraRevive':
      g.runBuffs.extraRevive += 1
      g.runBuffLog = g.runBuffLog || []
      g.runBuffLog.push({ id: item.id, label: '额外复活+1', buff: 'extraRevive', val: 1, floor: g.floor })
      break
    case 'skillDmgUp':
      g.runBuffs.skillDmgPct += (item.pct || 15)
      g.runBuffLog = g.runBuffLog || []
      g.runBuffLog.push({ id: item.id, label: `技能伤害+${item.pct||15}%`, buff: 'skillDmgPct', val: item.pct||15, floor: g.floor })
      break
  }
}

// 商店：选择属性后获取灵兽
function applyShopPetByAttr(g, attr) {
  if (!g.sessionPetPool) return
  const maxedIds = getMaxedPetIds(g)
  let attrPool = g.sessionPetPool.filter(p => p.attr === attr && !maxedIds.has(p.id))
  if (attrPool.length === 0) attrPool = g.sessionPetPool.filter(p => p.attr === attr) // 全满星退化
  if (attrPool.length === 0) return
  const picked = attrPool[Math.floor(Math.random() * attrPool.length)]
  const newPet = { ...picked, currentCd: 0 }
  const allPets = [...g.pets, ...g.petBag]
  const mergeResult = _mergePetAndDex(g, allPets, newPet)
  if (!mergeResult.merged) {
    g.petBag.push(newPet)
    g._shopPetObtained = { pet: { ...newPet }, type: 'new' }
    MusicMgr.playPetObtained()
  } else if (mergeResult.target) {
    g._shopPetObtained = { pet: { ...mergeResult.target }, type: mergeResult.maxed ? 'maxed' : 'starUp' }
    if ((mergeResult.target.star || 1) >= MAX_STAR) {
      g._star3Celebration = { pet: mergeResult.target, timer: 0, phase: 'fadeIn', particles: [] }
      MusicMgr.playStar3Unlock()
    } else {
      MusicMgr.playPetObtained()
    }
  }
}

// 商店：选择目标宠物升星
function applyShopStarUp(g, petIdx) {
  const p = g.pets[petIdx]
  if (!p) return false
  if ((p.star || 1) >= 3) return false
  p.star = (p.star || 1) + 1
  if (p.star >= MAX_STAR) {
    g.storage.addPetDex(p.id)
    g._star3Celebration = {
      pet: p,
      timer: 0,
      phase: 'fadeIn',
      particles: [],
    }
    MusicMgr.playStar3Unlock()
  }
  return true
}

// 商店：选择目标宠物强化攻击
function applyShopUpgradePet(g, petIdx, pct) {
  const p = g.pets[petIdx]
  if (!p) return false
  p.atk = Math.round(p.atk * (1 + (pct||25)/100))
  return true
}

// 商店：选择目标宠物减CD
function applyShopCdReduce(g, petIdx) {
  const p = g.pets[petIdx]
  if (!p) return false
  if (p.cd <= 2) return false
  p.cd = Math.max(2, p.cd - 1)
  return true
}

function applyRestOption(g, opt) {
  if (!opt) return
  switch(opt.effect) {
    case 'healPct':
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp * opt.pct / 100)); break
    case 'allAtkUp':
      g.runBuffs.allAtkPct += opt.pct
      g.runBuffLog = g.runBuffLog || []
      g.runBuffLog.push({ id: 'rest_allAtkUp', label: `全队攻击+${opt.pct}%`, buff: 'allAtkPct', val: opt.pct, floor: g.floor })
      break
  }
}

function applyAdventure(g, adv) {
  if (!adv) return
  const _pushLog = (buff, val, label) => {
    g.runBuffLog = g.runBuffLog || []
    g.runBuffLog.push({ id: adv.id || buff, label: label || buff, buff, val, floor: g.floor })
  }
  switch(adv.effect) {
    case 'allAtkUp':      g.runBuffs.allAtkPct += adv.pct; _pushLog('allAtkPct', adv.pct); break
    case 'healPct':        g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp*adv.pct/100)); break
    case 'hpMaxUp':        { const inc = Math.round(g.heroMaxHp*adv.pct/100); g.heroMaxHp += inc; g.heroHp += inc; break }
    case 'getWeapon':      { const w = randomWeapon(); g.weaponBag.push(w); break }
    case 'skipBattle':     g.skipNextBattle = true; break
    case 'fullHeal':       g.heroHp = g.heroMaxHp; break
    case 'extraTime':      g.runBuffs.extraTimeSec += adv.sec; _pushLog('extraTimeSec', adv.sec); break
    case 'upgradePet':     { const i = Math.floor(Math.random()*g.pets.length); g.pets[i].atk = Math.round(g.pets[i].atk*1.2); break }
    case 'shield':         g._addShield(adv.val || 50); break
    case 'nextStun':       g.nextStunEnemy = true; break
    case 'attrDmgUp':      g.runBuffs.attrDmgPct[adv.attr] = (g.runBuffs.attrDmgPct[adv.attr]||0) + adv.pct; break
    case 'multiAttrUp':    adv.attrs.forEach(a => { g.runBuffs.attrDmgPct[a] = (g.runBuffs.attrDmgPct[a]||0) + adv.pct }); break
    case 'comboNeverBreak': g.comboNeverBreak = true; break
    case 'getPet':         { const p = { ...randomPetFromPool(g.sessionPetPool, null, 'adventure', getMaxedPetIds(g)), currentCd: 0 }; const allP = [...g.pets, ...g.petBag]; const mr = _mergePetAndDex(g, allP, p); if (!mr.merged) { g.petBag.push(p) } break }
    case 'clearDebuff':    g.heroBuffs = g.heroBuffs.filter(b => !b.bad); break
    case 'heartBoost':     g.runBuffs.heartBoostPct += adv.pct; _pushLog('heartBoostPct', adv.pct); break
    case 'weaponBoost':    g.runBuffs.weaponBoostPct += adv.pct; _pushLog('weaponBoostPct', adv.pct); break
    case 'allDmgUp':       g.runBuffs.allDmgPct += adv.pct; _pushLog('allDmgPct', adv.pct); break

    case 'nextDmgDouble':  g.nextDmgDouble = true; break
    case 'tempRevive':     g.tempRevive = true; break
    case 'petAtkUp':       { const i3 = Math.floor(Math.random()*g.pets.length); g.pets[i3].atk = Math.round(g.pets[i3].atk*(1+adv.pct/100)); break }
    case 'goodBeads':      g.goodBeadsNextTurn = true; break
    case 'immuneOnce':     g.immuneOnce = true; break
    case 'tripleChoice':   { const _ow = new Set(); if(g.weapon) _ow.add(g.weapon.id); if(g.weaponBag) g.weaponBag.forEach(w=>_ow.add(w.id)); const _op = new Set(); if(g.pets) g.pets.forEach(p=>{if(p)_op.add(p.id)}); if(g.petBag) g.petBag.forEach(p=>{if(p)_op.add(p.id)}); g.rewards = generateRewards(g.floor, 'battle', false, _ow, g.sessionPetPool, _op, getMaxedPetIds(g)); g.selectedReward = -1; g.rewardPetSlot = -1; g.scene = 'reward'; return }
  }
}

function showSkillPreview(g, pet, index) {
  const { S } = V
  const sk = pet.skill
  if (!sk || !petHasSkill(pet)) return
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
    skillDesc: getPetSkillDesc(pet) || '无描述',
    duration: 180
  }
}

module.exports = {
  triggerPetSkill, showSkillPreview,
  applyReward, applyBuffReward,
  applyShopItem, applyShopPetByAttr, applyShopStarUp, applyShopUpgradePet, applyShopCdReduce,
  applyRestOption, applyAdventure,
}
