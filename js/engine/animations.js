/**
 * 动画更新模块 — 所有每帧tick的动画逻辑
 * 从 main.js update() 中提取
 */
const MusicMgr = require('../runtime/music')
const ViewEnv = require('../views/env')

function updateAnimations(g) {
  const { S } = ViewEnv
  if (g.shakeT > 0) g.shakeT--
  if (g._comboFlash > 0) g._comboFlash--
  // 粒子更新
  g._comboParticles = g._comboParticles.filter(p => {
    p.t++
    p.x += p.vx; p.y += p.vy
    p.vy += p.gravity
    p.vx *= 0.98
    return p.t < p.life
  })
  g.dmgFloats = g.dmgFloats.filter(f => {
    f.t++
    if (f.t <= 20) f.y -= 0.3*S
    else if (f.t <= 50) { f.y -= 0.8*S; f.alpha -= 0.01 }
    else { f.y -= 1.2*S; f.alpha -= 0.04 }
    return f.alpha > 0
  })
  g.skillEffects = g.skillEffects.filter(e => {
    e.t++; e.y -= 0.6*S; e.alpha -= 0.012
    // 缩放弹跳动画：从大到1.0快速收缩
    if (e._initScale && e.t < 15) {
      e.scale = 1.0 + (e._initScale - 1.0) * Math.max(0, 1 - e.t / 12) * (1 + 0.2 * Math.sin(e.t * 0.8))
    } else if (e._initScale) {
      e.scale = 1.0
    }
    return e.alpha > 0
  })
  // 消除棋子处飘字动画
  g.elimFloats = g.elimFloats.filter(f => {
    f.t++
    f.y -= 0.6*S
    f.scale = (f.scale || 1) * (f.t < 6 ? 1.03 : 1.0)
    if (f.t > 30) f.alpha -= 0.04
    return f.alpha > 0 && f.t < 60
  })
  // Combo弹出动画
  _updateComboAnim(g, S)
  // 宠物头像攻击数值动画
  g.petAtkNums = g.petAtkNums.filter(f => {
    f.t++
    const prefix = f.isHeal ? '+' : ''
    if (f.t <= f.rollFrames) {
      const progress = f.t / f.rollFrames
      const ease = 1 - Math.pow(1 - progress, 3)
      f.displayVal = Math.round(f.finalVal * ease)
      f.text = `${prefix}${f.displayVal}`
      f.scale = 1.0 + 0.2 * Math.sin(f.t * 0.8)
      if (f.t % 4 === 0) MusicMgr.playRolling()
    } else {
      f.text = `${prefix}${f.finalVal}`
      f.scale = 1.0
      if (f.t > f.rollFrames + 20) f.alpha -= 0.05
    }
    return f.alpha > 0
  })
}

function _updateComboAnim(g, S) {
  if (!(g._comboAnim && g._comboAnim.timer < 60)) return
  // 消除/掉落/攻击展示阶段都冻结timer，避免combo文字在连锁过程中提前淡出
  const inBattle = g.bState === 'elimAnim' || g.bState === 'dropping' || g.bState === 'preAttack' || g.bState === 'petAtkShow'
  const freezeTimer = inBattle && g._comboAnim.timer >= 40
  if (!freezeTimer) g._comboAnim.timer++
  const t = g._comboAnim.timer
  if (t <= 10) {
    const p = t / 10
    const initScale = g._comboAnim._initScale || 2.5
    if (p < 0.4) g._comboAnim.scale = initScale - (initScale - 0.7) * (p / 0.4)
    else if (p < 0.7) g._comboAnim.scale = 0.88 + 0.12 * ((p - 0.4) / 0.3)
    else g._comboAnim.scale = 1.0
    g._comboAnim.alpha = 1
    g._comboAnim.offsetY = 0
  } else if (t <= 40) {
    const breathP = Math.sin((t - 10) * 0.2) * 0.04
    g._comboAnim.scale = 1.0 + breathP
    g._comboAnim.alpha = 1
    g._comboAnim.offsetY = 0
  } else {
    if (inBattle) {
      g._comboAnim.scale = 1.0
      g._comboAnim.alpha = 1
      g._comboAnim.offsetY = 0
    } else {
      const fadeP = (t - 40) / 20
      g._comboAnim.scale = 1.0 - 0.12 * fadeP
      g._comboAnim.alpha = 1 - fadeP
      g._comboAnim.offsetY = -fadeP * 25 * S
    }
  }
  // 伤害部分延迟5帧后弹入
  const dt = t - 5
  if (dt > 0 && dt <= 8) {
    const dp = dt / 8
    if (dp < 0.5) g._comboAnim.dmgScale = 2.0 - 2.0 * (dp / 0.5)
    else if (dp < 0.8) g._comboAnim.dmgScale = 0.9 + 0.1 * ((dp - 0.5) / 0.3)
    else g._comboAnim.dmgScale = 1.0
    g._comboAnim.dmgAlpha = Math.min(1, dt / 4)
  } else if (dt > 8) {
    g._comboAnim.dmgScale = 1.0
    g._comboAnim.dmgAlpha = 1
  } else {
    g._comboAnim.dmgScale = 0
    g._comboAnim.dmgAlpha = 0
  }
  // 百分比标签延迟10帧后飞入
  const pt = t - 10
  if (pt > 0 && pt <= 10) {
    const pp = pt / 10
    if (pp < 0.5) g._comboAnim.pctOffX = (1 - pp / 0.5) * 80 * S
    else if (pp < 0.8) g._comboAnim.pctOffX = -8 * S * ((pp - 0.5) / 0.3)
    else g._comboAnim.pctOffX = 0
    if (pp < 0.3) g._comboAnim.pctScale = 0.5 + 1.5 * (pp / 0.3)
    else if (pp < 0.6) g._comboAnim.pctScale = 2.0 - 1.2 * ((pp - 0.3) / 0.3)
    else if (pp < 0.85) g._comboAnim.pctScale = 0.8 + 0.3 * ((pp - 0.6) / 0.25)
    else g._comboAnim.pctScale = 1.1
    g._comboAnim.pctAlpha = Math.min(1, pt / 5)
  } else if (pt > 10 && pt <= 30) {
    g._comboAnim.pctOffX = 0
    g._comboAnim.pctScale = 1.1 - 0.1 * Math.min(1, (pt - 10) / 5)
    g._comboAnim.pctAlpha = 1
  } else if (pt > 30) {
    g._comboAnim.pctOffX = 0
    g._comboAnim.pctScale = 1.0
    g._comboAnim.pctAlpha = 1
  } else {
    g._comboAnim.pctOffX = 80 * S
    g._comboAnim.pctScale = 0
    g._comboAnim.pctAlpha = 0
  }
}

function updateBattleAnims(g) {
  [g.heroAttackAnim, g.enemyHurtAnim, g.heroHurtAnim, g.enemyAttackAnim, g.skillCastAnim].forEach(a => {
    if (a.active) { a.progress += 1/a.duration; if (a.progress >= 1) { a.active = false; a.progress = 0 } }
  })
}

function updateSwapAnim(g) {
  if (!g.swapAnim) return
  g.swapAnim.t++
  if (g.swapAnim.t >= g.swapAnim.dur) g.swapAnim = null
}

function updateHpAnims(g) {
  if (g._enemyHpLoss) { g._enemyHpLoss.timer++; if (g._enemyHpLoss.timer >= 45) g._enemyHpLoss = null }
  if (g._heroHpLoss) { g._heroHpLoss.timer++; if (g._heroHpLoss.timer >= 45) g._heroHpLoss = null }
  if (g._heroHpGain) { g._heroHpGain.timer++; if (g._heroHpGain.timer >= 40) g._heroHpGain = null }
}

function updateSkillPreview(g) {
  if (g.skillPreview) {
    g.skillPreview.timer++
    if (g.skillPreview.timer >= g.skillPreview.duration) {
      g.skillPreview = null
    }
  }
}

module.exports = { updateAnimations, updateBattleAnims, updateSwapAnim, updateHpAnims, updateSkillPreview }
