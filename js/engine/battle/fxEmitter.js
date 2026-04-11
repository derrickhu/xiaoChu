const V = require('../../views/env')
const { TH } = require('../../render')
const MusicMgr = require('../../runtime/music')
const { ATTR_COLOR } = require('../../data/tower')
const { getBattleLayout } = require('../../views/battle/battleLayout')
const DF = require('../dmgFloat')

function getAttrColor(attr, fallback) {
  return (ATTR_COLOR[attr] && ATTR_COLOR[attr].main) || fallback || TH.accent
}

function getEnemyCenterY() {
  const L = getBattleLayout()
  const eAreaBottom = L.teamBarY - 4 * V.S
  const eAreaH = eAreaBottom - L.eAreaTop
  return L.eAreaTop + eAreaH * 0.42
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
    case 'enemyTotalDmg':
      DF.enemyTotalDmg(g, payload.dmg, payload.isCrit)
      break
    case 'petSkillDmg':
      DF.petSkillDmg(g, payload.dmg, payload.color)
      break
    case 'petMultiHitDmg':
      DF.petMultiHitDmg(g, payload.dmg, payload.color, payload.hitIdx, payload.totalHits)
      break
    case 'petTeamAtkDmg':
      DF.petTeamAtkDmg(g, payload.dmg, payload.color, payload.petIdx, payload.totalPets)
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

function emitPetSkillIntro(g, payload) {
  if (!g || !payload) return
  const color = payload.color || getAttrColor(payload.attr, TH.accent)
  if (payload.showWave !== false) {
    g._petSkillWave = {
      petIdx: payload.petIdx,
      attr: payload.attr,
      color,
      timer: 0,
      duration: payload.waveDuration || 24,
      targetX: payload.targetX == null ? V.W * 0.5 : payload.targetX,
      targetY: payload.targetY == null ? getEnemyCenterY() : payload.targetY,
    }
  }
  g._skillFlash = {
    petName: payload.petName || '',
    skillName: payload.skillName || '',
    skillDesc: payload.skillDesc || '',
    color,
    timer: 0,
    duration: payload.flashDuration || 24,
    petIdx: payload.petIdx,
  }
  if (payload.comboFlash) emitFlash(g, 'combo', { timer: payload.comboFlash })
  if (payload.shake) emitShake(g, payload.shake)
}

module.exports = {
  getAttrColor,
  getEnemyCenterY,
  emitNotice,
  emitFloat,
  emitShake,
  emitFlash,
  emitCast,
  emitPetSkillIntro,
}
