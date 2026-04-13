/**
 * GM 调试面板 — 灵宠消消塔
 * 仅 GM 白名单玩家可见，从签到弹窗中打开
 * 提供签到/翻倍/广告/资源等快捷调试功能
 */
const V = require('./env')
const { isCurrentUserGM } = require('../data/gmConfig')
const { LOGIN_CYCLE_DAYS } = require('../data/giftConfig')
const MusicMgr = require('../runtime/music')
const P = require('../platform')

// 按钮点击区域缓存
const _rects = {
  closeBtnRect: null,
  btns: [],   // [{ id, rect:[x,y,w,h] }]
}

function _rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y); c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

function _drawBtn(c, x, y, w, h, label, color, u) {
  const r = 6 * u
  c.fillStyle = color || '#D32F2F'
  _rr(c, x, y, w, h, r)
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.3)'
  c.lineWidth = 1.5 * u
  _rr(c, x, y, w, h, r)
  c.stroke()
  c.fillStyle = '#FFFFFF'
  c.font = `bold ${12 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(label, x + w / 2, y + h / 2)
  return [x, y, w, h]
}

function rGMPanel(g) {
  if (!g._showGMPanel) return
  if (!isCurrentUserGM()) { g._showGMPanel = false; return }

  const { ctx: c, W, H } = V
  const u = W / 750

  _rects.btns = []

  c.save()
  // 半透明遮罩
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)

  // 面板尺寸（宽度占屏 92%，高度自适应）
  const pw = W * 0.92
  const ph = Math.min(440 * u, H - 80 * u)
  const px = (W - pw) / 2
  const py = (H - ph) / 2

  // 面板背景
  c.fillStyle = '#1A1A2E'
  _rr(c, px, py, pw, ph, 16 * u)
  c.fill()
  c.strokeStyle = '#E53935'
  c.lineWidth = 3 * u
  _rr(c, px, py, pw, ph, 16 * u)
  c.stroke()

  // 标题栏
  const titleH = 44 * u
  c.fillStyle = '#C62828'
  _rr(c, px, py, pw, titleH, 16 * u)
  c.fill()
  // 遮住标题栏底部圆角
  c.fillStyle = '#C62828'
  c.fillRect(px, py + titleH - 16 * u, pw, 16 * u)

  c.fillStyle = '#FFFFFF'
  c.font = `bold ${18 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText('🔴 GM 调试面板', W / 2, py + titleH / 2)

  // 关闭按钮
  const closeR = 14 * u
  const closeX = px + pw - 24 * u
  const closeY = py + titleH / 2
  c.fillStyle = 'rgba(255,255,255,0.2)'
  c.beginPath(); c.arc(closeX, closeY, closeR, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#fff'
  c.font = `bold ${14 * u}px sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('✕', closeX, closeY)
  _rects.closeBtnRect = [closeX - closeR, closeY - closeR, closeR * 2, closeR * 2]

  // 内容区域
  const padX = 24 * u
  const innerL = px + padX
  const innerW = pw - padX * 2
  let cy = py + titleH + 12 * u

  // 读取签到数据
  const sign = g.storage.loginSign
  const canSign = g.storage.canSignToday

  // ── 签到信息行 ──
  c.fillStyle = '#B0BEC5'
  c.font = `${13 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'top'
  const cycleDayDisplay = sign.totalSignDays > 0 ? ((sign.totalSignDays - 1) % LOGIN_CYCLE_DAYS) + 1 : 0
  const infoText = `📅 累计: ${sign.totalSignDays}天  轮次: ${cycleDayDisplay}/${LOGIN_CYCLE_DAYS}  ${sign.isNewbie ? '首轮' : '轮回'}  ${canSign ? '🟢可签' : '🔴已签'}`
  c.fillText(infoText, innerL, cy)
  cy += 24 * u

  // ── 签到调试 ──
  c.fillStyle = '#78909C'
  c.font = `bold ${12 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('签到调试', innerL, cy + 4 * u)

  const btnH = 30 * u
  const btnGap = 8 * u
  const dayBtns = [
    { id: 'day_dec', label: '−1', w: 46 * u, color: '#546E7A' },
    { id: 'day_inc', label: '下一天', w: 72 * u, color: '#546E7A' },
  ]
  let bx = innerL + 72 * u
  for (const btn of dayBtns) {
    const rect = _drawBtn(c, bx, cy, btn.w, btnH, btn.label, btn.color, u)
    _rects.btns.push({ id: btn.id, rect })
    bx += btn.w + btnGap
  }
  cy += btnH + 10 * u

  // ── 签到操作 ──
  const row2Btns = [
    { id: 'reset_sign', label: '重置签到', w: 90 * u, color: '#E65100' },
    { id: 'reset_double', label: '重置翻倍', w: 90 * u, color: '#E65100' },
    { id: 'toggle_cycle', label: '切轮', w: 62 * u, color: '#00695C' },
  ]
  bx = innerL
  for (const btn of row2Btns) {
    const rect = _drawBtn(c, bx, cy, btn.w, btnH, btn.label, btn.color, u)
    _rects.btns.push({ id: btn.id, rect })
    bx += btn.w + btnGap
  }
  cy += btnH + 14 * u

  // ── 分割线 ──
  c.strokeStyle = 'rgba(255,255,255,0.1)'
  c.lineWidth = 1 * u
  c.beginPath()
  c.moveTo(innerL, cy); c.lineTo(innerL + innerW, cy)
  c.stroke()
  cy += 10 * u

  // ── 资源信息 & 操作（按钮靠右对齐，自适应面板宽度）──
  const resBtnW = 90 * u
  const resBtnX = px + pw - padX - resBtnW

  c.fillStyle = '#B0BEC5'
  c.font = `${13 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'top'
  c.fillText(`💰 灵石: ${g.storage.soulStone}`, innerL, cy + 4 * u)
  const soulRect = _drawBtn(c, resBtnX, cy, resBtnW, btnH, '灵石+1000', '#F57F17', u)
  _rects.btns.push({ id: 'add_soul', rect: soulRect })
  cy += btnH + 8 * u

  c.fillStyle = '#B0BEC5'
  c.font = `${13 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'top'
  c.fillText(`⚡ 体力: ${g.storage.currentStamina}/${g.storage.maxStamina}`, innerL, cy + 4 * u)
  const staminaRect = _drawBtn(c, resBtnX, cy, resBtnW, btnH, '回满体力', '#2E7D32', u)
  _rects.btns.push({ id: 'refill_stamina', rect: staminaRect })
  cy += btnH + 8 * u

  // ── 觉醒石 ──
  c.fillStyle = '#B0BEC5'
  c.font = `${13 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'top'
  c.fillText(`💎 觉醒石: ${g.storage.awakenStone}`, innerL, cy + 4 * u)
  const awakenRect = _drawBtn(c, resBtnX, cy, resBtnW, btnH, '觉醒石+10', '#4A148C', u)
  _rects.btns.push({ id: 'add_awaken', rect: awakenRect })
  cy += btnH + 12 * u

  // ── 翻倍状态信息 ──
  const doubleState = g.storage.loginRewardDoubleState
  c.fillStyle = '#78909C'
  c.font = `${10 * u}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'top'
  const doubleInfo = `翻倍: ${doubleState.eligible ? '✅可翻倍' : doubleState.claimed ? '⬜已翻倍' : '⬜不可翻倍'}  pending: ${doubleState.pendingRewards ? '有' : '无'}`
  c.fillText(doubleInfo, innerL, cy)

  c.restore()
}

function tGMPanel(g, x, y, type) {
  if (!g._showGMPanel) return false
  // 非 end 事件也必须返回 true 以阻止穿透到下层面板
  if (type !== 'end') return true
  if (!isCurrentUserGM()) { g._showGMPanel = false; return true }

  // 关闭按钮
  if (_rects.closeBtnRect && _hitRect(x, y, ..._rects.closeBtnRect)) {
    g._showGMPanel = false
    MusicMgr.playClick && MusicMgr.playClick()
    return true
  }

  // 功能按钮
  for (const btn of _rects.btns) {
    if (_hitRect(x, y, ...btn.rect)) {
      MusicMgr.playClick && MusicMgr.playClick()
      _handleBtn(g, btn.id)
      g._dirty = true
      return true
    }
  }

  // 点击面板内其他区域，阻止穿透
  return true
}

function _handleBtn(g, id) {
  const st = g.storage
  switch (id) {
    case 'day_dec':
      st.gmSetSignDay(Math.max(0, (st.loginSign.totalSignDays || 0) - 1))
      P.showGameToast(`签到天数: ${st.loginSign.totalSignDays}`)
      break
    case 'day_inc':
      // 仅推进到下一天，不直接篡改签到数据；连续签到会在真正签到时自然 +1
      st.gmAdvanceDay(1)
      P.showGameToast(`已前进到下一天，可继续签到`)
      break
    case 'reset_sign':
      st.gmResetSignToday()
      P.showGameToast('✅ 签到已重置，可重新签到')
      break
    case 'reset_double':
      st.gmResetDouble()
      P.showGameToast('✅ 翻倍已重置')
      break
    case 'toggle_cycle':
      if (st.loginSign.isNewbie) {
        st.gmSetSignDay(LOGIN_CYCLE_DAYS)
        P.showGameToast('已切换到轮回模式')
      } else {
        st.gmSetSignDay(0)
        P.showGameToast('已切换到首轮模式')
      }
      break
    case 'add_soul':
      st.addSoulStone(1000)
      P.showGameToast(`灵石+1000 → ${st.soulStone}`)
      break
    case 'refill_stamina':
      st.gmRefillStamina()
      P.showGameToast(`体力已回满 → ${st.currentStamina}`)
      break
    case 'add_awaken':
      st.addAwakenStone(10)
      P.showGameToast(`觉醒石+10 → ${st.awakenStone}`)
      break
  }
}

function _hitRect(x, y, rx, ry, rw, rh) {
  return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
}

module.exports = { rGMPanel, tGMPanel }
