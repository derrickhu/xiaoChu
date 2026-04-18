/**
 * 战斗内「状态图标条」
 *
 * 目标：
 *   - 玩家必须能在整个持续期间看到自己和敌人身上有什么状态、还剩几回合
 *   - 每个 icon 走其状态色（紫 = 瘴毒 / 灰 = 碎甲 / 暗紫 = 噬灵 / 蓝 = 禁珠 / 金 = 眩晕 / 红 = 狂暴 / 金 = 护盾 / 金 = 通用增益）
 *   - 配合持续粒子，让玩家"一瞥即知"
 *
 * 渲染位置：
 *   - 玩家状态：宠物头像栏上方 14*S 处，一排图标
 *   - 敌人状态：敌人 HP 条下方 14*S 处
 *
 * Icon 来源：
 *   - 优先读 assets/ui/battle/status/status_*.png（AI 生成的一套国风图标）
 *   - 未加载到则 fallback 走纯 Canvas 画（色块 + 首字）
 */

const V = require('../env')
const { getBattleLayout } = require('./battleLayout')
const { resolveSubKindByBuffType, SUB } = require('../../data/fx/skillBadge')

// buff.type / buff.field / buff.dotType → 状态语义 key
// 语义 key 对应 icon 文件名和色板
function _resolveStatusKey(buff) {
  if (!buff) return null
  const t = buff.type
  const field = buff.field
  const dot = buff.dotType
  const bad = !!buff.bad

  if (t === 'dot' || t === 'regen') {
    if (dot === 'burn') return 'burn'
    if (dot === 'poison' || bad) return 'poison'
    return 'regen'
  }
  if (t === 'stun' || t === 'heroStun') return 'stun'
  if (t === 'seal') return 'seal'
  if (t === 'vulnerable') return 'vulnerable'
  if (t === 'buff' && field === 'atk' && !bad) return 'atkBuff'
  if (t === 'buff' && field === 'def' && !bad) return 'defBuff'
  if (t === 'debuff' && field === 'def') return 'defDown'
  if (t === 'debuff' && field === 'heal') return 'healBlock'
  if (t === 'debuff' && field === 'dragTime') return 'timePress'
  if (t === 'debuff') return 'debuff'
  if (t === 'reduceDmg' || t === 'dmgImmune' || t === 'immuneCtrl') return 'shield'
  if (t === 'reflectPct') return 'reflect'

  // 预载类 / 状态类先细分，再 fallback 通用 buff
  const sub = resolveSubKindByBuffType(buff)
  if (sub === SUB.preloadAttr) return 'preloadAttr'
  if (sub === SUB.preloadAll) return 'preloadAll'
  if (sub === SUB.preloadCrit) return 'preloadCrit'
  if (sub === SUB.preloadCombo) return 'preloadCombo'
  if (sub === SUB.preloadExec) return 'preloadExec'
  if (sub === SUB.stateTime) return 'stateTime'

  if (t === 'dmgBoost' || t === 'allAtkUp' || t === 'allDmgUp' || t === 'allDefUp'
      || t === 'critBoost' || t === 'critBoostPerCombo' || t === 'critDmgUp' || t === 'comboDmgUp'
      || t === 'heartBoost' || t === 'guaranteeCrit' || t === 'ignoreDefPct'
      || t === 'healOnElim' || t === 'shieldOnElim' || t === 'lowHpDmgUp'
      || t === 'onKillHeal' || t === 'hpMaxUp' || t === 'allHpMaxUp'
  ) return 'buff'
  return 'generic'
}

// key → 颜色 + 首字标签（fallback 画法用）
const STATUS_META = {
  poison:    { bad: true,  color: '#8450dd', bg: '#2a1440', label: '毒' },
  burn:      { bad: true,  color: '#ff6020', bg: '#401810', label: '烧' },
  regen:     { bad: false, color: '#4dff90', bg: '#10401c', label: '复' },
  stun:      { bad: true,  color: '#ffd042', bg: '#4a3808', label: '晕' },
  seal:      { bad: true,  color: '#4dabff', bg: '#18284a', label: '封' },
  vulnerable:{ bad: true,  color: '#ff6060', bg: '#401616', label: '易' },
  atkBuff:   { bad: false, color: '#ff4d4d', bg: '#3a1515', label: '攻' },
  defBuff:   { bad: false, color: '#ffce4a', bg: '#3a2a10', label: '防' },
  defDown:   { bad: true,  color: '#a0a0a0', bg: '#2a2a2a', label: '破' },
  healBlock: { bad: true,  color: '#8450dd', bg: '#2a1440', label: '噬' },
  timePress: { bad: true,  color: '#b088ff', bg: '#281840', label: '压' },
  debuff:    { bad: true,  color: '#c868ff', bg: '#2a1040', label: '负' },
  shield:    { bad: false, color: '#ffd042', bg: '#3a2a10', label: '盾' },
  reflect:   { bad: false, color: '#40e8ff', bg: '#0a3040', label: '反' },
  buff:      { bad: false, color: '#ffce4a', bg: '#3a2a10', label: '益' },
  // 预载类：一次性"蓄力待发"感；用沙漏/预字 + 橙金边，区别于持续 buff
  preloadAttr:  { bad: false, color: '#ff8040', bg: '#3a1d10', label: '×', preload: true },
  preloadAll:   { bad: false, color: '#ff6a6a', bg: '#3a1515', label: '强', preload: true },
  preloadCrit:  { bad: false, color: '#ffd860', bg: '#3a2a10', label: '暴', preload: true },
  preloadCombo: { bad: false, color: '#fff1a0', bg: '#3a3012', label: '连', preload: true },
  preloadExec:  { bad: false, color: '#ff4d4d', bg: '#3a1010', label: '绝', preload: true },
  stateTime:    { bad: false, color: '#b088ff', bg: '#201438', label: '时' },
  generic:   { bad: false, color: '#cccccc', bg: '#222222', label: '?' },
}

// 去重 + 取剩余回合最大的
function _collectStatus(buffs) {
  if (!buffs || !buffs.length) return []
  const map = new Map()
  for (const b of buffs) {
    const key = _resolveStatusKey(b)
    if (!key) continue
    const cur = map.get(key)
    const dur = (b.dur != null) ? b.dur : 99
    if (!cur) {
      map.set(key, { key, dur, stacks: 1, bad: !!b.bad, raw: b })
    } else {
      cur.dur = Math.max(cur.dur, dur)
      cur.stacks++
    }
  }
  return Array.from(map.values())
}

// 已交付的 AI 图标白名单（assets/ui/battle/status/status_<key>.png 实际存在）
// 其余 key 直接走 Canvas fallback 画（色块 + 首字），避免微信开发工具读不到文件报 ENOENT
// 新增图标交付后把 key 加入此集合即可
const STATUS_ICON_AVAILABLE = new Set([
  'atkBuff', 'buff', 'defDown', 'healBlock',
  'poison', 'seal', 'shield', 'stun',
])

function _getStatusImg(g, key) {
  const R = V.R
  if (!R || !R.getImg) return null
  if (!STATUS_ICON_AVAILABLE.has(key)) return null
  const img = R.getImg(`assets/ui/battle/status/status_${key}.png`)
  return (img && img.width > 0) ? img : null
}

// 绘制一个状态图标（带剩余回合小圈）
// compact=true：敌人侧用，限制光晕/虚线环半径，避免往外溢出盖到血条
function _drawStatusIcon(g, cx, cy, size, item, af, compact) {
  const { ctx, R, S } = V
  const meta = STATUS_META[item.key] || STATUS_META.generic
  const half = size / 2
  const img = _getStatusImg(g, item.key)

  ctx.save()
  if (img) {
    ctx.drawImage(img, cx - half, cy - half, size, size)
  } else {
    // fallback：色块圆 + 首字
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, half)
    grd.addColorStop(0, meta.color)
    grd.addColorStop(1, meta.bg)
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(cx, cy, half, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = meta.color
    ctx.lineWidth = 1.4 * S
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${Math.round(size * 0.55)}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(meta.label, cx, cy + 0.6 * S)
  }

  // 剩余回合数（右下角小圆）
  if (item.dur > 0 && item.dur < 99) {
    const br = 6 * S
    const bx = cx + half - 2 * S
    const by = cy + half - 2 * S
    ctx.fillStyle = 'rgba(20,10,5,0.85)'
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = meta.color
    ctx.lineWidth = 1 * S
    ctx.stroke()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${item.dur}`, bx, by + 0.5 * S)
  }

  // 呼吸光晕：负面红紫，正面金色
  // compact 模式下光晕压到 icon 本体内（half - 0.5*S），避免往外溢出挤血条
  const pulseA = 0.5 + 0.4 * Math.sin(af * 0.09)
  ctx.globalAlpha = pulseA * (meta.preload ? 0.85 : 0.45)
  ctx.strokeStyle = meta.color
  ctx.lineWidth = (meta.preload ? 1.8 : 1.2) * S
  const glowR = compact ? (half - 0.5 * S) : (half + 1.5 * S)
  ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.stroke()

  // 预载类：再叠一圈旋转虚线环，明显传达"蓄力待发"（compact 模式贴合本体半径）
  if (meta.preload) {
    ctx.globalAlpha = 0.7
    ctx.strokeStyle = meta.color
    ctx.lineWidth = 1.2 * S
    ctx.setLineDash([3 * S, 3 * S])
    ctx.lineDashOffset = -af * 0.35
    const dashR = compact ? (half + 1 * S) : (half + 3.2 * S)
    ctx.beginPath(); ctx.arc(cx, cy, dashR, 0, Math.PI * 2); ctx.stroke()
    ctx.setLineDash([])
  }

  ctx.restore()

  // 持续粒子（负面或预载类都加，强化"状态活跃中"）
  if (meta.bad) _drawStatusParticles(cx, cy, size, item.key, af, meta.color)
  else if (meta.preload) _drawStatusParticles(cx, cy, size, item.key, af, meta.color)
}

function _drawStatusParticles(cx, cy, size, key, af, color) {
  const { ctx, S } = V
  const count = key === 'poison' || key === 'burn' ? 5 : 3
  ctx.save()
  for (let i = 0; i < count; i++) {
    const seed = (af * 0.05 + i * 37) % 60
    const t = seed / 60
    const alpha = (1 - t) * 0.65
    if (alpha <= 0) continue
    const ang = (i / count) * Math.PI * 2 + af * 0.01
    const r = size * 0.2 + t * size * 0.6
    const px = cx + Math.cos(ang) * (size * 0.3)
    const py = cy - t * size * 0.9
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(px, py, (2 - t) * S, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()
}

// 画一排图标
// opts.withBg=true：给整排加一个半透明深色圆角背景槽（敌人侧用，和血条分离）
// opts.compact=true：icon 光晕贴合本体，不往外溢出
function _drawStatusRow(g, items, centerX, centerY, size, af, opts) {
  if (!items.length) return
  const { ctx, R, S } = V
  const gap = 4 * S
  const totalW = items.length * size + (items.length - 1) * gap
  const startX = centerX - totalW / 2 + size / 2
  const compact = opts && opts.compact
  if (opts && opts.withBg) {
    // 半透明深色底槽：给 icon 一个独立视觉边界，不会和血条/图像糊在一起
    const bgPadX = 6 * S
    const bgPadY = 3 * S
    const bgW = totalW + bgPadX * 2
    const bgH = size + bgPadY * 2
    const bgX = centerX - bgW / 2
    const bgY = centerY - bgH / 2
    ctx.save()
    ctx.fillStyle = 'rgba(14,10,18,0.72)'
    ctx.strokeStyle = 'rgba(255,230,180,0.35)'
    ctx.lineWidth = 1 * S
    if (R && R.rr) {
      R.rr(bgX, bgY, bgW, bgH, bgH / 2); ctx.fill()
      R.rr(bgX, bgY, bgW, bgH, bgH / 2); ctx.stroke()
    } else {
      ctx.fillRect(bgX, bgY, bgW, bgH)
      ctx.strokeRect(bgX, bgY, bgW, bgH)
    }
    ctx.restore()
  }
  items.forEach((it, i) => {
    const cx = startX + i * (size + gap)
    _drawStatusIcon(g, cx, centerY, size, it, af, compact)
  })
}

// ==== 对外入口 ====
function drawBattleStatusBars(g) {
  if (!g) return
  const { W, S } = V
  const L = getBattleLayout()
  const af = g.af || 0

  // 己方状态：宠物栏上方 14*S 居中一行
  // 开启 compact 模式限制光晕半径 —— 防止往上溢出到敌人区、往下溢出到宠物栏
  const heroItems = _collectStatus(g.heroBuffs)
  if (heroItems.length > 0) {
    const size = 20 * S
    const cx = W * 0.5
    const cy = L.teamBarY - 14 * S
    _drawStatusRow(g, heroItems, cx, cy, size, af, { compact: true })
  }

  // 敌人状态：画在敌人血条下方的"独立 debuff 行"（见 battleLayout.enemyBuffRowY）
  // 这个区域是专门为 debuff 腾出来的 22*S 高空间，和血条、宠物栏、敌人图都无重叠
  const enemyItems = _collectStatus(g.enemyBuffs)
  if (enemyItems.length > 0) {
    const size = 18 * S
    const cx = W * 0.5
    const cy = L.enemyBuffRowY
    _drawStatusRow(g, enemyItems, cx, cy, size, af, { compact: true })
  }
}

module.exports = { drawBattleStatusBars }
