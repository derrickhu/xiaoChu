/**
 * 技能视觉效果渲染（L1 释放者光晕 + L2 六类效果 + L2.6 到期淡出）
 *
 * 责任边界：
 *   - 输入：读 g._casterGlow / g._skillEffectFx 数组
 *   - 输出：Canvas 绘制 + tick 推进计时器，duration 到了就移除
 *   - 不改业务状态，不派生伤害/治疗等数值
 *
 * 数据契约（由 fxEmitter.emitPetSkillEffect 推入）：
 *   item = {
 *     kind: 'attack'|'heal'|'shield'|'buff'|'convert'|'cc'|'expire',
 *     tier: 'small'|'normal'|'ult',
 *     palette: { core, glow, burst, ring, flash, text },
 *     side: 'hero'|'enemy',
 *     petIdx?: 0..5,
 *     x, y,
 *     timer, duration, delay,
 *     buffType?, mode? (仅 expire)
 *   }
 */

const V = require('../env')
const P = require('../../platform')
const FXComposer = require('../../engine/effectComposer')

function _quality(g) {
  return (g && g._battleFxQuality) || 'full'
}

// ========================================================================
// L1 释放者光晕（所有技能共用）
// ========================================================================
function drawCasterGlow(g) {
  const glow = g._casterGlow
  if (!glow) return
  glow.timer++
  if (glow.timer > glow.duration) { g._casterGlow = null; return }

  const { ctx, S } = V
  const p = glow.timer / glow.duration
  // 0→0.4 快速淡入，0.4→1 缓慢淡出
  const alphaCurve = p < 0.4 ? (p / 0.4) : (1 - (p - 0.4) / 0.6)
  const alpha = Math.max(0, Math.min(1, alphaCurve))
  if (alpha <= 0.01) return

  const palette = glow.palette || null
  const core = (palette && palette.core) || glow.color || '#ffffff'
  const ring = (palette && palette.ring) || glow.color || '#ffffff'

  // 椭圆光晕：宽 > 高，模拟脚下投影
  const baseR = 36 * S
  const rScale = 1 + p * 0.4
  const rx = baseR * 1.15 * rScale
  const ry = baseR * 0.55 * rScale

  ctx.save()
  ctx.globalAlpha = alpha * 0.75
  ctx.translate(glow.x, glow.y)
  const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  grd.addColorStop(0, core)
  grd.addColorStop(0.5, ring + 'aa')
  grd.addColorStop(1, ring + '00')
  ctx.scale(1, ry / rx)
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(0, 0, rx, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 描边脉冲环（快速向外扩散）
  if (_quality(g) !== 'lite') {
    const pulseP = (glow.timer % 18) / 18
    ctx.save()
    ctx.globalAlpha = alpha * (1 - pulseP) * 0.55
    ctx.strokeStyle = ring
    ctx.lineWidth = 1.8 * S
    const pr = 22 * S + pulseP * 26 * S
    ctx.translate(glow.x, glow.y)
    ctx.scale(1, 0.5)
    ctx.beginPath()
    ctx.arc(0, 0, pr, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// ========================================================================
// L2 效果层主调度
// ========================================================================
function drawSkillEffectFx(g) {
  const list = g._skillEffectFx
  if (!list || !list.length) return
  for (let i = list.length - 1; i >= 0; i--) {
    const fx = list[i]
    if (fx.delay && fx.delay > 0) { fx.delay--; continue }
    fx.timer++
    if (fx.timer > fx.duration) { list.splice(i, 1); continue }
    try {
      switch (fx.kind) {
        case 'attack': _drawAttackFx(g, fx); break
        case 'heal': _drawHealFx(g, fx); break
        case 'shield': _drawShieldFx(g, fx); break
        case 'buff': _drawBuffFx(g, fx); break
        case 'convert': _drawConvertFx(g, fx); break
        case 'cc': _drawCcFx(g, fx); break
        case 'expire': _drawExpireFx(g, fx); break
      }
    } catch (e) {
      list.splice(i, 1)
    }
  }
}

// ------------------------------------------------------------------------
// attack（补强，现有 _petSkillWave 已经管住飞行光波，这里只补命中冲击圈）
// ------------------------------------------------------------------------
function _drawAttackFx(g, fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  if (p < 0.4) return  // 等光波飞到后再出冲击圈
  const hitP = (p - 0.4) / 0.6
  const palette = fx.palette
  const color = palette.glow
  ctx.save()
  ctx.globalAlpha = (1 - hitP) * 0.55
  ctx.strokeStyle = color
  ctx.lineWidth = (2 - hitP) * S
  ctx.beginPath()
  ctx.arc(fx.x, fx.y, 18 * S + hitP * 44 * S, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

// ------------------------------------------------------------------------
// heal — 头顶绿十字 + 脚下金绿光柱
// ------------------------------------------------------------------------
function _drawHealFx(g, fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  const palette = fx.palette
  const core = palette.core
  const glow = palette.glow

  // 脚下金绿光柱：从目标往上吹起
  const pillarH = 80 * S * (1 - Math.pow(1 - p, 2))  // ease-out
  const pillarW = (18 + (1 - p) * 6) * S
  const pillarAlpha = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
  ctx.save()
  ctx.globalAlpha = pillarAlpha * 0.75
  const px = fx.x
  const pyBot = fx.y + 24 * S
  const pyTop = pyBot - pillarH
  const grd = ctx.createLinearGradient(px, pyBot, px, pyTop)
  grd.addColorStop(0, glow + 'cc')
  grd.addColorStop(0.5, core + 'aa')
  grd.addColorStop(1, core + '00')
  ctx.fillStyle = grd
  ctx.fillRect(px - pillarW / 2, pyTop, pillarW, pillarH)
  ctx.restore()

  // 头顶绿十字（淡入飘出）
  if (p < 0.8) {
    const crossP = p / 0.8
    const crossAlpha = crossP < 0.3 ? crossP / 0.3 : (1 - (crossP - 0.3) / 0.7)
    const crossY = fx.y - 32 * S - crossP * 18 * S
    ctx.save()
    ctx.globalAlpha = crossAlpha
    ctx.fillStyle = core
    ctx.shadowColor = glow
    ctx.shadowBlur = 10 * S
    const armLen = 9 * S, armThick = 3 * S
    ctx.fillRect(fx.x - armLen, crossY - armThick / 2, armLen * 2, armThick)
    ctx.fillRect(fx.x - armThick / 2, crossY - armLen, armThick, armLen * 2)
    ctx.restore()
  }

  // 环绕小光点
  if (_quality(g) !== 'lite' && p < 0.7) {
    const dotCount = 6
    ctx.save()
    for (let i = 0; i < dotCount; i++) {
      const ang = (i / dotCount) * Math.PI * 2 + p * 3
      const r = 22 * S + Math.sin(p * 3 + i) * 6 * S
      const dx = fx.x + Math.cos(ang) * r
      const dy = fx.y + Math.sin(ang) * r * 0.8
      ctx.globalAlpha = (1 - p) * 0.75
      ctx.fillStyle = i % 2 ? core : glow
      ctx.beginPath(); ctx.arc(dx, dy, 2 * S, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
  }
}

// ------------------------------------------------------------------------
// shield — 六边形结界
// ------------------------------------------------------------------------
function _drawShieldFx(g, fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  const palette = fx.palette
  const ring = palette.ring
  const core = palette.core
  // 扩散（0→1）
  const scale = 0.4 + p * 0.9
  const alpha = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
  const r = 30 * S * scale

  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(fx.x, fx.y)
  ctx.strokeStyle = ring
  ctx.lineWidth = 2.2 * S
  ctx.shadowColor = ring
  ctx.shadowBlur = 8 * S
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 - Math.PI / 2
    const px = Math.cos(ang) * r
    const py = Math.sin(ang) * r
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.stroke()

  // 内层淡色六边形
  ctx.globalAlpha = alpha * 0.28
  ctx.fillStyle = core
  ctx.fill()

  // 顶点亮斑
  if (_quality(g) !== 'lite') {
    ctx.shadowBlur = 0
    ctx.globalAlpha = alpha * 0.9
    ctx.fillStyle = core
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 - Math.PI / 2
      const px = Math.cos(ang) * r
      const py = Math.sin(ang) * r
      ctx.beginPath(); ctx.arc(px, py, 2.4 * S, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.restore()
}

// ------------------------------------------------------------------------
// buff — 向上金色箭头 + 金色能量环
// ------------------------------------------------------------------------
// buff 类视觉按 subKind 分化：
//   preloadCrit  → 金色星爆（能感受到"暴"）
//   preloadAttr  → 元素色双重能量环 + 中心"×N"符号
//   preloadAll   → 多层红色上扬箭头
//   preloadCombo → 旋转金色连击圈
//   stateTime    → 紫色沙漏螺旋
//   其他         → 默认金色三箭头 + 能量环（兼容旧）
function _drawBuffFx(g, fx) {
  switch (fx.subKind) {
    case 'preloadCrit':  _drawBuffPreloadCrit(fx); return
    case 'preloadAttr':  _drawBuffPreloadAttr(fx); return
    case 'preloadAll':   _drawBuffPreloadAll(fx); return
    case 'preloadCombo': _drawBuffPreloadCombo(fx); return
    case 'preloadExec':  _drawBuffPreloadAll(fx); return
    case 'stateTime':    _drawBuffStateTime(fx); return
    default:             _drawBuffDefault(fx); return
  }
}

// 默认：金色三箭头上扬 + 脚下金环（原有实现）
function _drawBuffDefault(fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  const palette = fx.palette
  const core = palette.core
  const glow = palette.glow
  for (let i = 0; i < 3; i++) {
    const arrowP = Math.max(0, Math.min(1, p - i * 0.12))
    if (arrowP <= 0 || arrowP >= 1) continue
    const ay = fx.y + 16 * S - arrowP * 46 * S
    const alpha = arrowP < 0.25 ? arrowP / 0.25 : (1 - (arrowP - 0.25) / 0.75)
    const ax = fx.x + (i - 1) * 12 * S
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.fillStyle = core
    ctx.shadowColor = glow
    ctx.shadowBlur = 8 * S
    ctx.beginPath()
    const halfW = 6 * S, h = 10 * S
    ctx.moveTo(ax, ay - h)
    ctx.lineTo(ax - halfW, ay)
    ctx.lineTo(ax - halfW / 2, ay)
    ctx.lineTo(ax - halfW / 2, ay + h * 0.8)
    ctx.lineTo(ax + halfW / 2, ay + h * 0.8)
    ctx.lineTo(ax + halfW / 2, ay)
    ctx.lineTo(ax + halfW, ay)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }
  if (p < 0.7) {
    const ringP = p / 0.7
    const r = 24 * S * (0.4 + ringP * 0.9)
    const alpha = ringP < 0.4 ? ringP / 0.4 : (1 - (ringP - 0.4) / 0.6)
    ctx.save()
    ctx.globalAlpha = alpha * 0.7
    ctx.strokeStyle = glow
    ctx.lineWidth = 1.8 * S
    ctx.translate(fx.x, fx.y + 22 * S)
    ctx.scale(1, 0.4)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

// preloadAttr：属性色双重环 + 脚下能量鼓动（传达"元素力蓄积完毕"）
function _drawBuffPreloadAttr(fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  const { core, glow } = fx.palette
  ctx.save()
  // 双重扩散环
  for (let k = 0; k < 2; k++) {
    const kp = Math.max(0, Math.min(1, p - k * 0.25))
    if (kp <= 0) continue
    const r = 18 * S + kp * 38 * S
    ctx.globalAlpha = (1 - kp) * 0.7
    ctx.strokeStyle = k === 0 ? core : glow
    ctx.lineWidth = (2.2 - kp) * S
    ctx.beginPath(); ctx.arc(fx.x, fx.y, r, 0, Math.PI * 2); ctx.stroke()
  }
  // 脚下光柱 + 粒子上升
  const pillarAlpha = p < 0.4 ? p / 0.4 : (1 - (p - 0.4) / 0.6)
  ctx.globalAlpha = pillarAlpha * 0.55
  const pGrd = ctx.createLinearGradient(fx.x, fx.y + 20 * S, fx.x, fx.y - 30 * S)
  pGrd.addColorStop(0, glow + 'cc')
  pGrd.addColorStop(1, core + '00')
  ctx.fillStyle = pGrd
  ctx.fillRect(fx.x - 10 * S, fx.y - 30 * S, 20 * S, 50 * S)
  // 上升粒子
  for (let i = 0; i < 5; i++) {
    const pp = (p + i * 0.2) % 1
    const py = fx.y + 18 * S - pp * 46 * S
    const px = fx.x + Math.sin(p * 10 + i) * 8 * S
    const pa = (1 - pp) * 0.8
    ctx.globalAlpha = pa
    ctx.fillStyle = core
    ctx.beginPath(); ctx.arc(px, py, 1.8 * S, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// preloadCrit：金色星爆（6 条射线 + 中心光点）
function _drawBuffPreloadCrit(fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  ctx.save()
  const rays = 6
  const starAlpha = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
  ctx.globalAlpha = starAlpha
  ctx.strokeStyle = '#ffd860'
  ctx.lineWidth = 2.4 * S
  ctx.shadowColor = '#ffd860'
  ctx.shadowBlur = 10 * S
  for (let i = 0; i < rays; i++) {
    const ang = (i / rays) * Math.PI * 2 + p * 1.2
    const inner = 6 * S + p * 6 * S
    const outer = inner + (16 + (i % 2) * 10) * S * (1 - p * 0.3)
    ctx.beginPath()
    ctx.moveTo(fx.x + Math.cos(ang) * inner, fx.y + Math.sin(ang) * inner)
    ctx.lineTo(fx.x + Math.cos(ang) * outer, fx.y + Math.sin(ang) * outer)
    ctx.stroke()
  }
  ctx.globalAlpha = starAlpha * 0.8
  ctx.fillStyle = '#fff8c0'
  ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 * S + p * 3 * S, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

// preloadAll：多层红色上扬箭头，更强冲击感
function _drawBuffPreloadAll(fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  ctx.save()
  const layers = 5
  for (let i = 0; i < layers; i++) {
    const arrowP = Math.max(0, Math.min(1, p - i * 0.08))
    if (arrowP <= 0 || arrowP >= 1) continue
    const ay = fx.y + 14 * S - arrowP * 58 * S
    const alpha = (arrowP < 0.2 ? arrowP / 0.2 : (1 - (arrowP - 0.2) / 0.8)) * 0.88
    const ax = fx.x + ((i % 3) - 1) * 14 * S
    ctx.globalAlpha = alpha
    ctx.fillStyle = '#ff6a6a'
    ctx.shadowColor = '#ff6a6a'
    ctx.shadowBlur = 10 * S
    ctx.beginPath()
    const hw = 7 * S, h = 12 * S
    ctx.moveTo(ax, ay - h)
    ctx.lineTo(ax - hw, ay)
    ctx.lineTo(ax - hw / 2, ay)
    ctx.lineTo(ax - hw / 2, ay + h * 0.8)
    ctx.lineTo(ax + hw / 2, ay + h * 0.8)
    ctx.lineTo(ax + hw / 2, ay)
    ctx.lineTo(ax + hw, ay)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

// preloadCombo：旋转金色连击圈（文字 C 的旋转环 + 多个飞速光点）
function _drawBuffPreloadCombo(fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  ctx.save()
  const ringAlpha = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
  ctx.globalAlpha = ringAlpha * 0.9
  ctx.strokeStyle = '#fff1a0'
  ctx.lineWidth = 2 * S
  ctx.shadowColor = '#fff1a0'
  ctx.shadowBlur = 8 * S
  const r = 22 * S
  ctx.beginPath()
  ctx.arc(fx.x, fx.y, r, 0, Math.PI * 1.6)
  ctx.stroke()
  // 飞速光点
  for (let i = 0; i < 4; i++) {
    const ang = p * 8 + i * (Math.PI / 2)
    const px = fx.x + Math.cos(ang) * r
    const py = fx.y + Math.sin(ang) * r
    ctx.globalAlpha = ringAlpha * (0.9 - i * 0.15)
    ctx.fillStyle = '#fff8d8'
    ctx.beginPath(); ctx.arc(px, py, 2.2 * S, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// stateTime：紫色沙漏螺旋（时间加成/连击保护）
function _drawBuffStateTime(fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  ctx.save()
  const alpha = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
  ctx.globalAlpha = alpha
  // 沙漏：两个三角对顶
  ctx.fillStyle = '#b088ff'
  ctx.shadowColor = '#b088ff'
  ctx.shadowBlur = 8 * S
  const hw = 10 * S, h = 14 * S
  ctx.beginPath()
  ctx.moveTo(fx.x - hw, fx.y - h)
  ctx.lineTo(fx.x + hw, fx.y - h)
  ctx.lineTo(fx.x, fx.y)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(fx.x - hw, fx.y + h)
  ctx.lineTo(fx.x + hw, fx.y + h)
  ctx.lineTo(fx.x, fx.y)
  ctx.closePath()
  ctx.fill()
  // 下滑粒子
  for (let i = 0; i < 3; i++) {
    const pp = (p * 2 + i * 0.33) % 1
    const py = fx.y - h * 0.6 + pp * h * 1.4
    ctx.globalAlpha = alpha * (1 - pp) * 0.9
    ctx.fillStyle = '#e0c8ff'
    ctx.beginPath(); ctx.arc(fx.x, py, 1.8 * S, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// ------------------------------------------------------------------------
// convert — 棋盘格子高亮（target 是珠位）
// ------------------------------------------------------------------------
function _drawConvertFx(g, fx) {
  // 变珠已有专属动画（_beadConvertAnim），这里补一个高亮闪白
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  if (p > 0.6) return
  const palette = fx.palette
  const alpha = (1 - p / 0.6) * 0.5
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = palette.core
  ctx.beginPath()
  ctx.arc(fx.x, fx.y, 16 * S, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// ------------------------------------------------------------------------
// cc — 控制类（眩晕星/毒雾/净化光柱）
// ------------------------------------------------------------------------
function _drawCcFx(g, fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  const palette = fx.palette
  const core = palette.core
  const glow = palette.glow

  // 环绕星星（暂用通用视觉）
  const starCount = 4
  ctx.save()
  for (let i = 0; i < starCount; i++) {
    const ang = (i / starCount) * Math.PI * 2 + p * Math.PI * 2
    const r = 22 * S
    const sx = fx.x + Math.cos(ang) * r
    const sy = fx.y - 28 * S + Math.sin(ang) * r * 0.45
    const alpha = p < 0.3 ? p / 0.3 : (1 - (p - 0.3) / 0.7)
    ctx.globalAlpha = alpha
    ctx.fillStyle = core
    ctx.shadowColor = glow
    ctx.shadowBlur = 6 * S
    ctx.beginPath()
    // 四角星：两个旋转 45 度的矩形代替
    ctx.save()
    ctx.translate(sx, sy)
    ctx.rotate(Math.PI / 4)
    const ss = 4 * S
    ctx.fillRect(-ss / 2, -ss * 2, ss, ss * 4)
    ctx.fillRect(-ss * 2, -ss / 2, ss * 4, ss)
    ctx.restore()
  }
  ctx.restore()
}

// ------------------------------------------------------------------------
// expire — 状态到期/净化消散
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// expire / dispel — 状态到期（dur=0）或被净化消散（purify/clearDebuff）
//   mode='dispel'  → 白金光环破碎 + 粒子上扬（主动驱散，存在感强）
//   mode='fade'    → 同色系雾气淡出（自然到期，柔和）
//   mode='purify'  → 金白闪光 + 放射线（主动净化兼容）
// ------------------------------------------------------------------------
function _drawExpireFx(g, fx) {
  const { ctx, S } = V
  const p = fx.timer / fx.duration
  let color = '#b088ff'
  if (fx.mode === 'purify') color = '#ffeab0'
  else if (fx.buffType === 'shield') color = '#ffd042'
  else if (fx.buffType === 'defDown' || fx.buffType === 'debuff') color = '#a6a6c8'
  else if (fx.buffType === 'poison' || fx.buffType === 'dot') color = '#b88cff'
  else if (fx.buffType === 'heroStun' || fx.buffType === 'stun') color = '#c8a4ff'
  else if (fx.buffType === 'regen' || fx.buffType === 'allAtkUp' || fx.buffType === 'allDefUp') color = '#ffe08a'

  const dotCount = (fx.mode === 'dispel') ? 12 : 8
  ctx.save()
  if (fx.mode === 'dispel') {
    const rr = 16 * S + p * 26 * S
    ctx.globalAlpha = (1 - p) * 0.55
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = (1 - p) * 2.4 * S
    ctx.beginPath(); ctx.arc(fx.x, fx.y, rr, 0, Math.PI * 2); ctx.stroke()
    ctx.globalAlpha = (1 - p) * 0.35
    ctx.strokeStyle = color
    ctx.lineWidth = (1 - p) * 4 * S
    ctx.beginPath(); ctx.arc(fx.x, fx.y, rr * 1.15, 0, Math.PI * 2); ctx.stroke()
  }
  for (let i = 0; i < dotCount; i++) {
    const ang = (i / dotCount) * Math.PI * 2
    const r = 14 * S + p * 24 * S
    const dx = fx.x + Math.cos(ang) * r
    const dy = fx.y - p * 30 * S + Math.sin(ang) * r * 0.4
    const alpha = (1 - p) * 0.72
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(dx, dy, (fx.mode === 'dispel' ? 3 : 2.4) * S, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

// =========================================================================
// 宠物头顶 badge 飘字（"×2 火"/"必暴"/"激活" 等预载与生效提示）
// =========================================================================
function drawPetBadges(g) {
  const list = g && g._petBadges
  if (!list || !list.length) return
  const { ctx, S } = V
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i]
    b.timer++
    if (b.timer > b.duration) { list.splice(i, 1); continue }
    const p = b.timer / b.duration
    // 入场 [0..0.18] 放大回弹，稳定 [0.18..0.72]，退场 [0.72..1] 上飘淡出
    let scale, alpha, floatDy
    if (p < 0.18) {
      const q = p / 0.18
      scale = 0.4 + q * 0.85
      alpha = q
      floatDy = 0
    } else if (p < 0.72) {
      const q = (p - 0.18) / 0.54
      scale = 1.25 - Math.sin(q * Math.PI) * 0.05
      alpha = 1
      floatDy = -q * 6 * S
    } else {
      const q = (p - 0.72) / 0.28
      scale = 1.2 - q * 0.1
      alpha = 1 - q
      floatDy = -6 * S - q * 14 * S
    }
    const cx = b.x
    const cy = b.startY + floatDy
    const isActive = b.style === 'active'
    const label = b.label || ''
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    // 胶囊底
    const fontSize = isActive ? 14 : 16
    ctx.font = `italic 900 ${fontSize * S}px "Avenir-Black","PingFang SC",sans-serif`
    const textW = ctx.measureText(label).width
    const padX = 8 * S
    const padY = 5 * S
    const capW = textW + padX * 2
    const capH = fontSize * S + padY * 2
    const capX = -capW / 2
    const capY = -capH / 2
    ctx.fillStyle = 'rgba(14,8,2,0.88)'
    const rr = capH / 2
    ctx.beginPath()
    ctx.moveTo(capX + rr, capY)
    ctx.arcTo(capX + capW, capY, capX + capW, capY + capH, rr)
    ctx.arcTo(capX + capW, capY + capH, capX, capY + capH, rr)
    ctx.arcTo(capX, capY + capH, capX, capY, rr)
    ctx.arcTo(capX, capY, capX + capW, capY, rr)
    ctx.fill()
    ctx.strokeStyle = b.color
    ctx.lineWidth = 1.5 * S
    ctx.stroke()
    // 外发光脉冲
    const pulse = 0.4 + 0.6 * Math.sin(b.timer * 0.18)
    ctx.shadowColor = b.color
    ctx.shadowBlur = (isActive ? 12 : 16) * S * pulse
    // 文字
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'
    ctx.lineWidth = 3 * S
    ctx.strokeText(label, 0, 0.5 * S)
    ctx.fillStyle = b.color
    ctx.shadowBlur = 0
    ctx.fillText(label, 0, 0.5 * S)
    ctx.restore()
  }
}

module.exports = {
  drawCasterGlow,
  drawSkillEffectFx,
  drawPetBadges,
}
