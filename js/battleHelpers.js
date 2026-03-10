/**
 * 战斗辅助函数 — 从 Main 中提取的布局计算、动画触发、伤害处理
 * 通过 ViewEnv 获取屏幕常量，避免依赖 Main 的闭包变量
 */
const { ATTR_COLOR } = require('./data/tower')
const { TH } = require('./render')
const MusicMgr = require('./runtime/music')
const V = require('./views/env')

function getBattleLayout() {
  const { W, H, S, safeTop, COLS, ROWS } = V
  const boardPad = 6*S, cellSize = (W-boardPad*2)/COLS, boardH = ROWS*cellSize
  const boardTop = H-8*S-boardH
  const sidePad = 8*S, petGap = 8*S, wpnGap = 12*S
  const totalGapW = wpnGap + petGap * 4 + sidePad * 2
  const iconSize = (W - totalGapW) / 6
  const teamBarH = iconSize + 6*S
  const hpBarH = 18*S
  const hpBarY = boardTop - hpBarH - 4*S
  const teamBarY = hpBarY - teamBarH - 2*S
  const eAreaTop = safeTop + 4*S
  return { boardPad, cellSize, boardH, boardTop, iconSize, teamBarH, teamBarY, hpBarY, eAreaTop }
}

function getEnemyCenterY() {
  const L = getBattleLayout()
  const eAreaBottom = L.teamBarY - 4*V.S
  const eAreaH = eAreaBottom - L.eAreaTop
  return L.eAreaTop + eAreaH * 0.42
}

function playHeroAttack(g, skillName, attr, type) {
  g.heroAttackAnim = { active:true, progress:0, duration:24 }
  g.enemyHurtAnim  = { active:true, progress:0, duration:18 }
  g._enemyHitFlash = 12
  g._enemyTintFlash = 8
  // 顿帧：命中时短暂冻结增强打击感
  g._hitStopFrames = 3
  // 屏幕闪白
  g._screenFlash = 4; g._screenFlashMax = 4; g._screenFlashColor = '#fff'
  const color = (ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || TH.accent
  const eCenterY = getEnemyCenterY()
  g.skillCastAnim = { active:true, progress:0, duration:30, type:type||'slash', color, skillName:skillName||'', targetX:V.W*0.5, targetY:eCenterY }
}

function playEnemyAttack(g) {
  g.enemyAttackAnim = { active:true, progress:0, duration:20 }
  g.heroHurtAnim    = { active:true, progress:0, duration:18 }
  g._hitStopFrames = 2
  // 受击闪红
  g._screenFlash = 3; g._screenFlashMax = 3; g._screenFlashColor = '#ff2244'
  g._heroHurtFlash = 10
  const L = getBattleLayout()
  g.skillCastAnim = { active:true, progress:0, duration:30, type:'enemyAtk', color:TH.danger, skillName:'', targetX:V.W*0.5, targetY:L.hpBarY }
}

function playHealEffect(g) {
  const L = getBattleLayout()
  g.skillCastAnim = { active:true, progress:0, duration:25, type:'heal', color:'#4dcc4d', skillName:'', targetX:V.W*0.5, targetY:L.hpBarY }
  MusicMgr.playHeal()
}

/** 统一添加护盾（自动应用法宝 shieldBoost 加成） */
function addShield(g, val) {
  if (g.weapon && g.weapon.type === 'shieldBoost') {
    val = Math.round(val * (1 + (g.weapon.pct || 50) / 100))
  }
  g.heroShield += val
  MusicMgr.playShieldGain()
  g.dmgFloats.push({ x:V.W*0.5, y:V.H*0.65, text:`+${val}盾`, color:'#7ddfff', t:0, alpha:1 })
}

/** 对英雄造成伤害（含护盾、绝对防御、飘字） */
function dealDmgToHero(g, dmg) {
  const immune = g.heroBuffs && g.heroBuffs.find(b => b.type === 'dmgImmune')
  if (immune && dmg > 1) dmg = 1
  const { W, H } = V
  if (g.heroShield > 0) {
    if (dmg <= g.heroShield) {
      g.heroShield -= dmg
      g.skillEffects.push({ x:W*0.5, y:H*0.52, text:'完美抵挡！', color:'#40e8ff', t:0, alpha:1, scale:2.5, _initScale:2.5, big:true })
      g.dmgFloats.push({ x:W*0.5, y:H*0.6, text:`护盾吸收 ${dmg}`, color:'#7ddfff', t:0, alpha:1, scale:1.6 })
      g.shakeT = 4; g.shakeI = 2
      g._blockFlash = 8
      MusicMgr.playBlock()
      return
    }
    const shieldAbs = g.heroShield
    dmg -= g.heroShield; g.heroShield = 0
    g.skillEffects.push({ x:W*0.5, y:H*0.52, text:'护盾击碎！', color:'#ff9040', t:0, alpha:1, scale:2.0, _initScale:2.0 })
    g.dmgFloats.push({ x:W*0.45, y:H*0.6, text:`盾挡 ${shieldAbs}`, color:'#40b8e0', t:0, alpha:1, scale:1.4 })
  }
  const oldPct = g.heroHp / g.heroMaxHp
  g.heroHp = Math.max(0, g.heroHp - dmg)
  g._heroHpLoss = { fromPct: oldPct, timer: 0 }
  g.dmgFloats.push({ x:W*0.5, y:H*0.7, text:`-${dmg}`, color:TH.danger, t:0, alpha:1 })
}

module.exports = { getBattleLayout, getEnemyCenterY, playHeroAttack, playEnemyAttack, playHealEffect, addShield, dealDmgToHero }
