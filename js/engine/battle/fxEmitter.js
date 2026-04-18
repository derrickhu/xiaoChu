const V = require('../../views/env')
const { TH } = require('../../render')
const MusicMgr = require('../../runtime/music')
const { ATTR_COLOR } = require('../../data/tower')
const { getBattleLayout } = require('../../views/battle/battleLayout')
const DF = require('../dmgFloat')
const { getTierFx } = require('../../data/fx/skillTier')
const { getSkillPalette } = require('../../data/fx/skillFxPalette')

function getAttrColor(attr, fallback) {
  return (ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || fallback || TH.accent
}

function getEnemyCenterY() {
  const L = getBattleLayout()
  const eAreaBottom = L.teamBarY - 4 * V.S
  const eAreaH = eAreaBottom - L.eAreaTop
  return L.eAreaTop + eAreaH * 0.42
}

// 取宠物头像中心 —— 传入的 petIdx 是 g.pets 数组索引（武器槽不计入）
// 实际栏位布局：[武器][g.pets[0]][g.pets[1]]...，所以要 +1 个 iconSize + wpnGap 跳过武器槽
// 与 battleTeamBarView.drawTeamBar 保持一致
function getPetIconCenter(petIdx) {
  const L = getBattleLayout()
  const { S } = V
  const iconSize = L.iconSize
  const iconY = L.teamBarY + (L.teamBarH - iconSize) / 2
  const sidePad = 8 * S, wpnGap = 12 * S, petGap = 8 * S
  const ix = sidePad + iconSize + wpnGap + petIdx * (iconSize + petGap)
  return { x: ix + iconSize * 0.5, y: iconY + iconSize * 0.5, iconSize, iconTopY: iconY }
}

function ensureSkillEffects(g) {
  if (!g.skillEffects) g.skillEffects = []
  return g.skillEffects
}

function emitNotice(g, payload) {
  if (!g || !payload) return null
  const notice = Object.assign({ t: 0, alpha: 1 }, payload)
  ensureSkillEffects(g).push(notice)
  return notice
}

function emitFloat(g, kind, payload) {
  if (!g || !kind || !payload) return
  switch (kind) {
    case 'petNormalAtkDmg':
      DF.petNormalAtkDmg(g, payload.dmg, payload.color, payload.petIdx, payload.attr, payload.isCrit, payload.orderIdx, payload.critFxTier)
      break
    case 'petSkillDmg':
      DF.petSkillDmg(g, payload.dmg, payload.color, payload.petIdx, payload.attr)
      break
    case 'petMultiHitDmg':
      DF.petMultiHitDmg(g, payload.dmg, payload.color, payload.hitIdx, payload.totalHits, payload.petIdx, payload.attr)
      break
    case 'petTeamAtkDmg':
      DF.petTeamAtkDmg(g, payload.dmg, payload.color, payload.petIdx, payload.totalPets, payload.attr)
      break
    case 'enemyTotal':
      DF.enemyTotal(g, payload.dmg, payload.color, payload.isCrit, payload.critFxTier)
      break
    case 'aoeDmg':
      DF.aoeDmg(g, payload.dmg, payload.color)
      break
    case 'dotOnEnemy':
      DF.dotOnEnemy(g, payload.dmg, payload.dotType, payload.idx || 0)
      break
    case 'reflectToEnemy':
      DF.reflectToEnemy(g, payload.dmg, payload.color)
      break
    case 'enemyHeal':
      DF.enemyHeal(g, payload.amt)
      break
    case 'heroHeal':
      DF.heroHeal(g, payload.amt, payload.color)
      break
    case 'heroDmg':
      DF.heroDmg(g, payload.dmg, payload.color)
      break
    case 'heroShieldGain':
      DF.heroShieldGain(g, payload.val)
      break
    case 'heroShieldBlock':
      DF.heroShieldBlock(g, payload.dmg)
      break
    case 'heroShieldBreak':
      DF.heroShieldBreak(g, payload.shieldAbs)
      break
  }
}

function emitShake(g, payload) {
  if (!g || !payload) return
  const t = Math.max(0, payload.t || 0)
  const i = Math.max(0, payload.i || 0)
  const mode = payload.mode || 'set'
  if (mode === 'max') {
    g.shakeT = Math.max(g.shakeT || 0, t)
    g.shakeI = Math.max(g.shakeI || 0, i)
  } else {
    g.shakeT = t
    g.shakeI = i
  }
  if (payload.decay != null) g.shakeDecay = payload.decay
}

function emitFlash(g, kind, payload) {
  if (!g || !kind) return
  const data = payload || {}
  switch (kind) {
    case 'counter':
      g._counterFlash = {
        color: data.color || '#ffd700',
        timer: data.timer || 10,
      }
      break
    case 'block':
      g._blockFlash = data.timer || 0
      break
    case 'combo':
      g._comboFlash = data.timer || 0
      g._comboFlashMeta = g._comboFlash > 0 ? {
        maxTimer: data.maxTimer || data.timer || 1,
        focus: data.focus || 'board',
        color: data.color || '#fffff0',
        x: data.x,
        y: data.y,
        radius: data.radius || 0,
        alphaMul: data.alphaMul == null ? 1 : data.alphaMul,
        allowLowCombo: !!data.allowLowCombo,
        style: data.style || '',
        ringColor: data.ringColor || '',
        rayColor: data.rayColor || '',
        rays: data.rays || 0,
        ringCount: data.ringCount || 0,
      } : null
      break
    case 'screen':
      g._screenFlash = data.timer || 0
      g._screenFlashMax = data.max || data.timer || 1
      g._screenFlashColor = data.color || '#fff'
      break
    case 'heroHurt':
      g._heroHurtFlash = data.timer || 0
      break
  }
}

function emitCast(g, payload) {
  if (!g || !payload || !payload.kind) return
  const L = getBattleLayout()
  switch (payload.kind) {
    case 'heroAttack': {
      const color = getAttrColor(payload.attr, TH.accent)
      g.heroAttackAnim = { active: true, progress: 0, duration: payload.heroDuration || 24 }
      g.enemyHurtAnim = { active: true, progress: 0, duration: payload.enemyDuration || 18 }
      g._enemyHitFlash = payload.hitFlash == null ? 12 : payload.hitFlash
      g._enemyTintFlash = payload.tintFlash == null ? 8 : payload.tintFlash
      g._hitStopFrames = payload.hitStop == null ? 3 : payload.hitStop
      emitFlash(g, 'screen', { timer: 4, max: 4, color: '#fff' })
      g.skillCastAnim = {
        active: true,
        progress: 0,
        duration: payload.castDuration || 30,
        type: payload.type || 'slash',
        color,
        skillName: payload.skillName || '',
        targetX: payload.targetX == null ? V.W * 0.5 : payload.targetX,
        targetY: payload.targetY == null ? getEnemyCenterY() : payload.targetY,
      }
      break
    }
    case 'enemyAttack': {
      const heroReact = payload.heroReact !== false
      g.enemyAttackAnim = { active: true, progress: 0, duration: payload.enemyDuration || 20 }
      if (heroReact) {
        g.heroHurtAnim = { active: true, progress: 0, duration: payload.heroDuration || 18 }
        g._hitStopFrames = payload.hitStop == null ? 2 : payload.hitStop
        emitFlash(g, 'screen', { timer: 3, max: 3, color: '#ff2244' })
        emitFlash(g, 'heroHurt', { timer: payload.hurtFlash == null ? 10 : payload.hurtFlash })
      } else {
        if (g.heroHurtAnim) {
          g.heroHurtAnim.active = false
          g.heroHurtAnim.progress = 0
          g.heroHurtAnim.duration = payload.heroDuration || g.heroHurtAnim.duration || 18
        }
        g._hitStopFrames = 0
        emitFlash(g, 'heroHurt', { timer: 0 })
      }
      g.skillCastAnim = {
        active: true,
        progress: 0,
        duration: payload.castDuration || 30,
        type: 'enemyAtk',
        color: payload.color || TH.danger,
        skillName: payload.skillName || '',
        targetX: payload.targetX == null ? V.W * 0.5 : payload.targetX,
        targetY: payload.targetY == null ? L.hpBarY : payload.targetY,
      }
      break
    }
    case 'heal':
      g.skillCastAnim = {
        active: true,
        progress: 0,
        duration: payload.castDuration || 25,
        type: 'heal',
        color: payload.color || '#4dcc4d',
        skillName: payload.skillName || '',
        targetX: payload.targetX == null ? V.W * 0.5 : payload.targetX,
        targetY: payload.targetY == null ? L.hpBarY : payload.targetY,
      }
      if (payload.playSound !== false) MusicMgr.playHeal()
      break
    case 'dot':
      g.skillCastAnim = {
        active: true,
        progress: 0,
        duration: payload.castDuration || 20,
        type: 'dot',
        color: payload.color || '#ff6020',
        skillName: payload.skillName || '',
        targetX: payload.targetX == null ? V.W * 0.5 : payload.targetX,
        targetY: payload.targetY == null ? getEnemyCenterY() : payload.targetY,
        dotType: payload.dotType,
      }
      break
  }
}

// =========================================================================
// Layer 1: 释放者前摇（所有技能共用底）
// =========================================================================
// 作用：让玩家"看到谁在放技能"，不论是攻击/治疗/护盾/buff
// 组成：脚下光晕 + 描边脉冲 + 技能名快闪 + 可选震屏
// =========================================================================
function emitPetSkillIntro(g, payload) {
  if (!g || !payload) return
  const tier = payload.tier || 'normal'
  const tf = getTierFx(tier)
  const palette = payload.palette || null
  const color = payload.color || (palette && palette.glow) || getAttrColor(payload.attr, TH.accent)
  const kind = payload.kind || 'attack'

  // —— L1a 释放者脚下光晕 + 描边脉冲（所有技能共用，仅宠物有 petIdx） ——
  if (payload.petIdx != null) {
    const pc = getPetIconCenter(payload.petIdx)
    g._casterGlow = {
      side: 'hero',
      petIdx: payload.petIdx,
      x: pc.x,
      y: pc.y + pc.iconSize * 0.48,
      color,
      palette,
      timer: 0,
      duration: Math.round(tf.flashDur * 0.9),
      tier,
    }
  } else if (payload.enemyCaster) {
    // 敌人作为释放者：光晕画在敌人身下
    const ey = payload.casterY != null ? payload.casterY : getEnemyCenterY()
    g._casterGlow = {
      side: 'enemy',
      x: payload.casterX != null ? payload.casterX : V.W * 0.5,
      y: ey + 40 * V.S,
      color,
      palette,
      timer: 0,
      duration: Math.round(tf.flashDur * 0.9),
      tier,
    }
  }

  // —— L1b 攻击类保留现有 _petSkillWave（飞向敌人的光波） ——
  if (kind === 'attack' && payload.showWave !== false) {
    g._petSkillWave = {
      petIdx: payload.petIdx,
      attr: payload.attr,
      color,
      timer: 0,
      duration: payload.waveDuration || tf.waveDur,
      targetX: payload.targetX == null ? V.W * 0.5 : payload.targetX,
      targetY: payload.targetY == null ? getEnemyCenterY() : payload.targetY,
    }
  }

  // —— L1c 技能名快闪 ——
  g._skillFlash = {
    petName: payload.petName || '',
    skillName: payload.skillName || '',
    skillDesc: payload.skillDesc || '',
    color,
    timer: 0,
    duration: payload.flashDuration || tf.flashDur,
    petIdx: payload.petIdx,
  }

  // —— L1d 屏幕闪屏（按 tier 的 alpha） ——
  if (payload.screenFlash !== false) {
    const flashTimer = Math.max(6, Math.round(tf.flashDur * 0.25))
    emitFlash(g, 'screen', {
      timer: flashTimer,
      max: flashTimer,
      color: (palette && palette.flash) || color,
    })
  }

  const comboFlash = payload.comboFlash != null ? payload.comboFlash : tf.comboFlash
  if (comboFlash) emitFlash(g, 'combo', { timer: comboFlash })

  const shake = payload.shake !== undefined
    ? payload.shake
    : { t: tf.shakeT, i: tf.shakeI }
  if (shake) emitShake(g, shake)
}

// =========================================================================
// Layer 2: 按 kind 分发的效果层
// =========================================================================
// 每个 effect 压入 g._skillEffectFx 数组，由 battleSkillEffectView 统一渲染。
// 支持的 kind：attack | heal | shield | buff | convert | cc
// payload:
//   { kind, tier, casterSide?, casterPetIdx?, casterX?, casterY?,
//     targets?: [{ side, petIdx?, x?, y? }], palette?, attr? }
// =========================================================================
function ensureSkillEffectFx(g) {
  if (!g._skillEffectFx) g._skillEffectFx = []
  return g._skillEffectFx
}

function _resolveTargetXY(target) {
  if (target.x != null && target.y != null) return { x: target.x, y: target.y }
  if (target.side === 'hero' && target.petIdx != null) {
    const pc = getPetIconCenter(target.petIdx)
    return { x: pc.x, y: pc.y }
  }
  if (target.side === 'enemy') {
    return { x: V.W * 0.5, y: getEnemyCenterY() }
  }
  return { x: V.W * 0.5, y: V.H * 0.5 }
}

function emitPetSkillEffect(g, payload) {
  if (!g || !payload) return
  const tier = payload.tier || 'normal'
  const tf = getTierFx(tier)
  const kind = payload.kind || 'buff'
  const palette = payload.palette || getSkillPalette(kind, payload.attr)

  // 归一化 targets 坐标
  const rawTargets = payload.targets || []
  const targets = rawTargets.map(t => {
    const xy = _resolveTargetXY(t)
    return Object.assign({}, t, xy)
  })

  // 为每个 target 生成一条 fx
  if (targets.length === 0) {
    // 无目标（自增益/状态）：挂在释放者身上作为唯一目标
    if (payload.casterPetIdx != null) {
      targets.push(Object.assign({ side: 'hero', petIdx: payload.casterPetIdx },
        _resolveTargetXY({ side: 'hero', petIdx: payload.casterPetIdx })))
    }
  }

  const list = ensureSkillEffectFx(g)
  const baseDur = Math.max(24, Math.round(tf.flashDur * 1.1))

  targets.forEach((target, idx) => {
    list.push({
      kind,
      tier,
      palette,
      subKind: payload.subKind || null,   // buff 类再细分 preloadAttr/preloadCrit/...，用于 _drawBuffFx 分化视觉
      side: target.side,
      petIdx: target.petIdx,
      x: target.x,
      y: target.y,
      timer: 0,
      duration: baseDur,
      delay: idx * 3,
    })
  })
}

// =========================================================================
// 预载 badge（L1.5） · 技能释放瞬间 / buff 生效瞬间 的 "×2 火"、"必暴"、"激活" 飘字
// =========================================================================
function ensurePetBadges(g) {
  if (!g._petBadges) g._petBadges = []
  return g._petBadges
}

// 对一只宠物（petIdx）头顶弹一个大号 badge 飘字
// payload: { petIdx, label, color, style }
//   style: 'preload' (放技能时) / 'active' (buff 真的生效时)
function emitPetBadge(g, payload) {
  if (!g || !payload || !payload.label) return
  const { iconSize, iconTopY, x } = getPetIconCenter(payload.petIdx || 0)
  const y = iconTopY - 6 * V.S
  ensurePetBadges(g).push({
    petIdx: payload.petIdx || 0,
    label: payload.label,
    color: payload.color || '#ffd860',
    style: payload.style || 'preload',
    x, y, startY: y,
    iconSize,
    timer: 0,
    duration: payload.style === 'active' ? 40 : 56,
  })
}

// =========================================================================
// 状态到期/净化/盾破动画（L2.6）
// =========================================================================
function emitBuffExpire(g, payload) {
  if (!g || !payload) return
  const list = ensureSkillEffectFx(g)
  const xy = _resolveTargetXY(payload)
  list.push({
    kind: 'expire',
    mode: payload.mode || 'fade',
    buffType: payload.buffType || 'generic',
    side: payload.side,
    petIdx: payload.petIdx,
    x: xy.x,
    y: xy.y,
    timer: 0,
    duration: 28,
  })
}

module.exports = {
  getAttrColor,
  getEnemyCenterY,
  getPetIconCenter,
  emitNotice,
  emitFloat,
  emitShake,
  emitFlash,
  emitCast,
  emitPetSkillIntro,
  emitPetSkillEffect,
  emitBuffExpire,
  emitPetBadge,
}
