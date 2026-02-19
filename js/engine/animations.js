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
  // 敌人受击闪白
  if (g._enemyHitFlash > 0) g._enemyHitFlash--
  // 敌人死亡爆裂
  if (g._enemyDeathAnim) {
    g._enemyDeathAnim.timer++
    if (g._enemyDeathAnim.timer >= g._enemyDeathAnim.duration) g._enemyDeathAnim = null
  }
  // 英雄受击红闪
  if (g._heroHurtFlash > 0) g._heroHurtFlash--
  // 敌人回合预警
  if (g._enemyWarning > 0) g._enemyWarning--
  // Boss入场特效
  if (g._bossEntrance > 0) g._bossEntrance--
  // 克制闪光
  if (g._counterFlash && g._counterFlash.timer > 0) g._counterFlash.timer--
  // 宠物就绪闪光
  if (g._petReadyFlash) {
    for (const k in g._petReadyFlash) {
      if (g._petReadyFlash[k] > 0) g._petReadyFlash[k]--
    }
  }
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
    // 前30帧停留（缓慢上移），30-60帧正常上飘，60帧后加速消失
    if (f.t <= 30) { f.y -= 0.15*S }
    else if (f.t <= 60) { f.y -= 0.5*S; f.alpha -= 0.005 }
    else { f.y -= 0.8*S; f.alpha -= 0.04 }
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
  // 消除棋子处飘字动画（加大 + 弹入 + 缓出）
  g.elimFloats = g.elimFloats.filter(f => {
    f.t++
    // 前10帧：弹入（scale从大到1.0，几乎不移动）
    if (f.t <= 10) {
      const bp = f.t / 10
      f.scale = (f._baseScale || 1) * (1 + (1.5 - 1) * Math.max(0, 1 - bp * bp))
      f.y -= 0.1*S
    }
    // 10-50帧：缓慢上浮，持续显示
    else if (f.t <= 50) {
      f.scale = f._baseScale || 1
      f.y -= 0.3*S
    }
    // 50-80帧：加速上浮 + 淡出
    else {
      f.y -= 0.6*S
      f.alpha -= 0.035
    }
    return f.alpha > 0 && f.t < 80
  })
  // 珠子变换动画（convertBead / replaceBeads / 敌方convert）
  _updateBeadConvertAnim(g)
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

/**
 * 珠子变换动画更新
 * 3阶段升级版：聚能(0-6帧) → 爆变(7-10帧，切换属性) → 余韵(11-24帧)
 */
function _updateBeadConvertAnim(g) {
  const anim = g._beadConvertAnim
  if (!anim) return
  anim.timer++
  const CHARGE_END = 6
  const MORPH_FRAME = 7
  const TOTAL_END = 24

  if (anim.timer === MORPH_FRAME) {
    // 在爆变帧切换珠子属性
    anim.phase = 'burst'
    MusicMgr.playBeadConvert(anim.cells.length)  // 变珠音效
    for (const cell of anim.cells) {
      if (g.board[cell.r] && g.board[cell.r][cell.c]) {
        g.board[cell.r][cell.c].attr = cell.toAttr
      }
    }
  } else if (anim.timer < MORPH_FRAME) {
    anim.phase = 'charge'
  } else if (anim.timer > 10) {
    anim.phase = 'glow'
  }

  if (anim.timer >= TOTAL_END) {
    g._beadConvertAnim = null
  }
}

function _updateComboAnim(g, S) {
  if (!g._comboAnim) return
  const inBattle = g.bState === 'elimAnim' || g.bState === 'dropping' || g.bState === 'preAttack' || g.bState === 'petAtkShow'
  // 战斗中且弹入动画已完成(timer>=14)时冻结timer，确保combo文字持续可见
  const freezeTimer = inBattle && g._comboAnim.timer >= 14
  if (!freezeTimer && g._comboAnim.timer < 70) g._comboAnim.timer++
  const t = g._comboAnim.timer
  if (t <= 14) {
    // 弹入阶段（14帧）：从大缩小到1.0，更有弹性
    const p = t / 14
    const initScale = g._comboAnim._initScale || 2.5
    if (p < 0.35) g._comboAnim.scale = initScale - (initScale - 0.75) * (p / 0.35)
    else if (p < 0.55) g._comboAnim.scale = 0.75 + 0.35 * ((p - 0.35) / 0.2)
    else if (p < 0.75) g._comboAnim.scale = 1.1 - 0.1 * ((p - 0.55) / 0.2)
    else g._comboAnim.scale = 1.0
    g._comboAnim.alpha = 1
    g._comboAnim.offsetY = 0
  } else if (inBattle) {
    const breathP = Math.sin((t - 14) * 0.15) * 0.04
    g._comboAnim.scale = 1.0 + breathP
    g._comboAnim.alpha = 1
    g._comboAnim.offsetY = 0
  } else if (t <= 50) {
    const breathP = Math.sin((t - 14) * 0.15) * 0.04
    g._comboAnim.scale = 1.0 + breathP
    g._comboAnim.alpha = 1
    g._comboAnim.offsetY = 0
  } else {
    // 淡出阶段
    const fadeP = Math.min(1, (t - 50) / 20)
    g._comboAnim.scale = 1.0 - 0.12 * fadeP
    g._comboAnim.alpha = 1 - fadeP
    g._comboAnim.offsetY = -fadeP * 25 * S
  }
  // 伤害部分延迟6帧后弹入（10帧展开）
  const dt = t - 6
  if (dt > 0 && dt <= 10) {
    const dp = dt / 10
    if (dp < 0.4) g._comboAnim.dmgScale = 2.0 - 2.0 * (dp / 0.4)
    else if (dp < 0.7) g._comboAnim.dmgScale = 0.85 + 0.15 * ((dp - 0.4) / 0.3)
    else g._comboAnim.dmgScale = 1.0
    g._comboAnim.dmgAlpha = Math.min(1, dt / 5)
  } else if (dt > 10) {
    g._comboAnim.dmgScale = 1.0
    g._comboAnim.dmgAlpha = 1
  } else {
    g._comboAnim.dmgScale = 0
    g._comboAnim.dmgAlpha = 0
  }
  // 百分比标签延迟12帧后飞入（12帧展开）
  const pt = t - 12
  if (pt > 0 && pt <= 12) {
    const pp = pt / 12
    if (pp < 0.5) g._comboAnim.pctOffX = (1 - pp / 0.5) * 80 * S
    else if (pp < 0.8) g._comboAnim.pctOffX = -8 * S * ((pp - 0.5) / 0.3)
    else g._comboAnim.pctOffX = 0
    if (pp < 0.3) g._comboAnim.pctScale = 0.5 + 1.5 * (pp / 0.3)
    else if (pp < 0.6) g._comboAnim.pctScale = 2.0 - 1.2 * ((pp - 0.3) / 0.3)
    else if (pp < 0.85) g._comboAnim.pctScale = 0.8 + 0.3 * ((pp - 0.6) / 0.25)
    else g._comboAnim.pctScale = 1.1
    g._comboAnim.pctAlpha = Math.min(1, pt / 6)
  } else if (pt > 12) {
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
  if (g._heroHpGain) { g._heroHpGain.timer++; if (g._heroHpGain.timer >= 55) g._heroHpGain = null }
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
