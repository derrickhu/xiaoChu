/**
 * 宠物技能释放 + 奖励/商店/休息/奇遇应用
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const {
  ATTR_COLOR, REWARD_TYPES, generateRewards,
} = require('../data/tower')
const { randomPet } = require('../data/pets')
const { randomWeapon } = require('../data/weapons')

// ===== 宠物技能 =====
function triggerPetSkill(g, pet, idx) {
  const { S, W, H } = V
  const sk = pet.skill; if (!sk) return
  MusicMgr.playSkill()
  let cd = pet.cd
  if (g.runBuffs.skillCdReducePct > 0) cd = Math.max(1, Math.round(cd * (1 - g.runBuffs.skillCdReducePct / 100)))
  pet.currentCd = cd
  g.skillEffects.push({ x:W*0.5, y:H*0.5, text:sk.name, color:ATTR_COLOR[pet.attr]?.main||V.TH.accent, t:0, alpha:1 })
  switch(sk.type) {
    case 'dmgBoost':
      g.heroBuffs.push({ type:'dmgBoost', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'convertBead': {
      const { ROWS, COLS } = V
      const targetAttr = sk.attr || pet.attr
      for (let i = 0; i < sk.count; i++) {
        const r = Math.floor(Math.random()*ROWS), c = Math.floor(Math.random()*COLS)
        if (g.board[r][c]) g.board[r][c].attr = targetAttr
      }
      break
    }
    case 'shield': {
      let shieldVal = sk.val || 50
      if (sk.bonusPct) shieldVal = Math.round(shieldVal * (1 + sk.bonusPct / 100))
      g._addShield(shieldVal); break
    }
    case 'reduceDmg':
      g.heroBuffs.push({ type:'reduceDmg', pct:sk.pct, dur:2, bad:false, name:sk.name }); break
    case 'stun':
      g.enemyBuffs.push({ type:'stun', name:'眩晕', dur:sk.dur||1, bad:true }); break
    case 'comboPlus':
      g.combo += sk.count || 2; break
    case 'extraTime':
      g.dragTimeLimit += (sk.sec || 2) * 60; break
    case 'ignoreDefPct':
      g.heroBuffs.push({ type:'ignoreDefPct', attr:sk.attr, pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'revive':
      g.tempRevive = true; break
    case 'healPct':
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + Math.round(g.heroMaxHp*sk.pct/100)); break
    case 'healFlat':
      g.heroHp = Math.min(g.heroMaxHp, g.heroHp + sk.val); break
    case 'dot':
      if (sk.isHeal) {
        g.heroBuffs.push({ type:'regen', name:sk.name, heal:Math.abs(sk.dmg), dur:sk.dur, bad:false })
      } else {
        g.enemyBuffs.push({ type:'dot', name:sk.name, dmg:sk.dmg, dur:sk.dur, bad:true })
      }
      break
    case 'instantDmg':
      if (g.enemy) {
        let dmg = Math.round(pet.atk * (sk.pct||150) / 100)
        dmg = Math.round(dmg * (1 + g.runBuffs.skillDmgPct / 100))
        g.enemy.hp = Math.max(0, g.enemy.hp - dmg)
        g.dmgFloats.push({ x:W*0.5, y:g._getEnemyCenterY(), text:`-${dmg}`, color:ATTR_COLOR[sk.attr]?.main||V.TH.danger, t:0, alpha:1 })
        g._playHeroAttack(sk.name, sk.attr || pet.attr, 'burst')
        if (g.enemy.hp <= 0) { g.lastTurnCount = g.turnCount; g.lastSpeedKill = g.turnCount <= 5; MusicMgr.playVictory(); g.bState = 'victory'; return }
      }
      break
    case 'hpMaxUp': {
      const inc = Math.round(g.heroMaxHp * sk.pct / 100)
      g.heroMaxHp += inc; g.heroHp += inc; break
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
      g.heroBuffs.push({ type:'critBoost', pct:sk.pct, dur:sk.dur||3, bad:false, name:sk.name }); break
    case 'critDmgUp':
      g.heroBuffs.push({ type:'critDmgUp', pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'reflectPct':
      g.heroBuffs.push({ type:'reflectPct', pct:sk.pct, dur:sk.dur||2, bad:false, name:sk.name }); break
    case 'immuneCtrl':
      g.heroBuffs.push({ type:'immuneCtrl', dur:sk.dur||1, bad:false, name:sk.name }); break
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
    case 'fullHeal':
      g.heroHp = g.heroMaxHp; break
    case 'allHpMaxUp': {
      const inc2 = Math.round(g.heroMaxHp * sk.pct / 100)
      g.heroMaxHp += inc2; g.heroHp += inc2; break
    }
    case 'dmgImmune':
      g.heroBuffs.push({ type:'dmgImmune', dur:1, bad:false, name:sk.name }); break
    case 'guaranteeCrit':
      g.heroBuffs.push({ type:'critBoost', pct:100, dur:1, bad:false, name:sk.name }); break
    case 'comboDmgUp':
      g.heroBuffs.push({ type:'comboDmgUp', pct:sk.pct, dur:1, bad:false, name:sk.name }); break
    case 'onKillHeal':
      g.heroBuffs.push({ type:'onKillHeal', pct:sk.pct, dur:99, bad:false, name:sk.name }); break
  }
}

// ===== 奖励应用 =====
function applyReward(g, rw) {
  if (!rw) return
  switch(rw.type) {
    case REWARD_TYPES.NEW_PET: {
      const newPet = { ...rw.data, currentCd: 0 }
      if (g.petBag.length < 8) g.petBag.push(newPet)
      else g.petBag[g.petBag.length - 1] = newPet
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
      const newPet = randomPet()
      if (g.petBag.length < 8) { g.petBag.push({ ...newPet, currentCd: 0 }) }
      else { const idx = Math.floor(Math.random() * g.pets.length); g.pets[idx] = { ...newPet, currentCd: 0 } }
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
    case 'getPet':         { const p = randomPet(); if (g.petBag.length<8) g.petBag.push({...p,currentCd:0}); else { const i2=Math.floor(Math.random()*g.pets.length); g.pets[i2]={...p,currentCd:0} } break }
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
