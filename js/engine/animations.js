/**
 * 动画更新模块 — 所有每帧tick的动画逻辑
 * 从 main.js update() 中提取
 */
const MusicMgr = require('../runtime/music')
const ViewEnv = require('../views/env')
const { ANIM_CFG: _animCfg } = require('./dmgFloat')

let _compactFrame = 0

function _lerp(a, b, p) {
  return a + (b - a) * p
}

function _easeOutCubic(p) {
  const x = Math.max(0, Math.min(1, p))
  return 1 - Math.pow(1 - x, 3)
}

function _updateDmgFloatList(list, S) {
  if (!list || list.length === 0) return
  const AC_D = _animCfg.dmgFloat
  for (let i = 0; i < list.length; i++) {
    const f = list[i]
    if (f._dead) continue
    if (f.delay > 0) {
      f.delay--
      continue
    }
    f.t++
    const motion = f.motion || AC_D
    const popFrames = Math.max(1, motion.popFrames || 4)
    const settleFrames = Math.max(popFrames + 1, motion.settleFrames || popFrames + 4)
    const riseFrames = Math.max(1, motion.riseFrames || 14)
    const driftFrames = Math.max(0, motion.driftFrames || 0)
    const lifeFrames = Math.max(settleFrames + 1, motion.lifeFrames || 24)
    const fadeStart = Math.min(lifeFrames - 1, Math.max(settleFrames, motion.fadeStart || lifeFrames - 8))
    const startScale = motion.startScale == null ? 0.78 : motion.startScale
    const peakScale = motion.peakScale == null ? 1.18 : motion.peakScale
    const settleScale = motion.settleScale == null ? 1 : motion.settleScale

    if (f.t <= popFrames) {
      const p = _easeOutCubic(f.t / popFrames)
      f.scale = f._baseScale * _lerp(startScale, peakScale, p)
    } else if (f.t <= settleFrames) {
      const p = _easeOutCubic((f.t - popFrames) / (settleFrames - popFrames))
      f.scale = f._baseScale * _lerp(peakScale, settleScale, p)
    } else {
      f.scale = f._baseScale * settleScale
    }

    const riseP = Math.min(1, f.t / riseFrames)
    const riseDist = (motion.riseDist || 0) * S
    const returnFrames = Math.max(0, motion.returnFrames || 0)
    const holdFrames = Math.max(0, motion.holdFrames || 0)
    const returnTo = (motion.returnTo || 0) * S
    let yOffset = -_easeOutCubic(riseP) * riseDist
    if (returnFrames > 0 && f.t > riseFrames) {
      const returnP = Math.min(1, (f.t - riseFrames) / returnFrames)
      yOffset = _lerp(-riseDist, -returnTo, _easeOutCubic(returnP))
    } else if (f.t > riseFrames && driftFrames > 0) {
      const driftP = Math.min(1, (f.t - riseFrames) / driftFrames)
      yOffset -= _easeOutCubic(driftP) * (motion.driftDist || 0) * S
    }
    if (returnFrames > 0 && f.t > riseFrames + returnFrames + holdFrames && driftFrames > 0) {
      const driftP = Math.min(1, (f.t - riseFrames - returnFrames - holdFrames) / driftFrames)
      yOffset = -returnTo - _easeOutCubic(driftP) * (motion.driftDist || 0) * S
    }
    if (f.anchorLane) {
      f._anchorYOffset = yOffset
    } else {
      f.y = f._baseY + yOffset
    }

    let shakeOffset = 0
    if (f._shake && motion.shakeDur > 0 && f.t <= motion.shakeDur) {
      shakeOffset += Math.sin(f.t * 3.5) * motion.shakeAmp * S * (1 - f.t / motion.shakeDur)
    }
    if (motion.jitterFrames > 0 && f.t <= motion.jitterFrames) {
      shakeOffset += Math.sin(f.t * 5.2) * motion.jitterAmp * S * (1 - f.t / motion.jitterFrames)
    }
    f._shakeOffset = shakeOffset

    const targetAlpha = f._targetAlpha == null ? 1 : f._targetAlpha
    if (f.t < fadeStart) {
      f.alpha = targetAlpha
    } else {
      const fadeDur = Math.max(1, lifeFrames - fadeStart)
      f.alpha = Math.max(0, targetAlpha * (1 - (f.t - fadeStart) / fadeDur))
    }
    if (f.t >= lifeFrames || f.alpha <= 0) f._dead = true
  }
}

function updateAnimations(g) {
  const { S } = ViewEnv
  _compactFrame++
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
  // 敌方受击染色
  if (g._enemyTintFlash > 0) g._enemyTintFlash--
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
  // 粒子更新（倒序遍历，即时清理死亡粒子）
  for (let i = g._comboParticles.length - 1; i >= 0; i--) {
    const p = g._comboParticles[i]
    if (p._dead) { g._comboParticles.splice(i, 1); continue }
    p.t++
    p.x += p.vx; p.y += p.vy
    p.vy += p.gravity
    p.vx *= 0.98
    if (p.t >= p.life) { g._comboParticles.splice(i, 1) }
  }
  _updateDmgFloatList(g.dmgFloats, S)
  _updateDmgFloatList(g._petSlotFloats, S)
  for (let i = 0; i < g.skillEffects.length; i++) {
    const e = g.skillEffects[i]
    if (e._dead) continue
    e.t++; e.y -= 0.6*S; e.alpha -= 0.012
    // 缩放弹跳动画：从大到1.0快速收缩
    if (e._initScale && e.t < 15) {
      e.scale = 1.0 + (e._initScale - 1.0) * Math.max(0, 1 - e.t / 12) * (1 + 0.2 * Math.sin(e.t * 0.8))
    } else if (e._initScale) {
      e.scale = 1.0
    }
    if (e.alpha <= 0) e._dead = true
  }
  const AC_E = _animCfg.elimFloat
  for (let i = 0; i < g.elimFloats.length; i++) {
    const f = g.elimFloats[i]
    if (f._dead) continue
    f.t++
    if (f.t <= AC_E.bounceDur) {
      const bp = f.t / AC_E.bounceDur
      f.scale = (f._baseScale || 1) * (1 + AC_E.bounceAmp * Math.max(0, 1 - bp * bp))
      f.y -= AC_E.bounceSpeed*S
    }
    else if (f.t <= AC_E.stayFrames) {
      f.scale = f._baseScale || 1
      f.y -= AC_E.staySpeed*S
    }
    else {
      f.y -= AC_E.fadeSpeed*S
      f.alpha -= AC_E.fadeAlphaDec
    }
    if (f.alpha <= 0 || f.t >= AC_E.lifeFrames) f._dead = true
  }
  // 经验飘字飞行动画
  if (g._expFloats) {
    for (let i = 0; i < g._expFloats.length; i++) {
      const f = g._expFloats[i]
      if (f._dead) continue
      f.t++
      if (f.t >= f.duration) {
        g._expIndicatorPulse = 12
        f._dead = true
        continue
      }
      if (f.alpha <= 0) f._dead = true
    }
  }
  // 经验指示器脉冲衰减
  if (g._expIndicatorPulse > 0) g._expIndicatorPulse--
  // 过层经验汇总淡出
  if (g._floorExpSummary && g._floorExpSummary.timer > 0) {
    g._floorExpSummary.timer--
  }
  // 珠子变换动画（convertBead / replaceBeads / 敌方convert）
  _updateBeadConvertAnim(g)
  // Combo弹出动画
  _updateComboAnim(g, S)
  if (_compactFrame % 60 === 0) {
    g.dmgFloats = g.dmgFloats.filter(x => !x._dead)
    if (g._petSlotFloats) g._petSlotFloats = g._petSlotFloats.filter(x => !x._dead)
    g.skillEffects = g.skillEffects.filter(x => !x._dead)
    g.elimFloats = g.elimFloats.filter(x => !x._dead)
    if (g._expFloats) g._expFloats = g._expFloats.filter(x => !x._dead)
  }
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
