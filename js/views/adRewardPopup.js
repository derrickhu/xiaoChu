/**
 * 激励视频/分享领奖后的奖励展示弹窗 — 图标 + 名称 + 金色数量
 */
const V = require('./env')
const { drawPanel } = require('./uiComponents')

function _resolveIconPath(icon) {
  if (!icon) return null
  if (icon.indexOf('assets/') === 0) return icon
  return 'assets/ui/' + icon + '.png'
}

/**
 * @param {object} g  Main 实例
 * @param {{ title?: string, subtitle?: string, lines: Array<{ icon?: string|null, label: string, amount: string }> }} spec
 */
function showAdRewardPopup(g, spec) {
  if (!g || !spec || !spec.lines || !spec.lines.length) return
  g._adRewardPopup = {
    title: spec.title || '奖励已发放',
    subtitle: spec.subtitle || '',
    lines: spec.lines,
    timer: 0,
    _btnRect: null,
  }
  g._dirty = true
}

function drawAdRewardPopup(g) {
  const p = g._adRewardPopup
  if (!p) return
  const c = V.ctx
  const S = V.S
  const W = V.W
  const H = V.H
  const R = V.R

  p.timer = (p.timer || 0) + 1
  const timer = p.timer
  const alpha = Math.min(1, timer / 12)
  const lines = p.lines
  const rowH = 38 * S
  const ribbonH = 44 * S
  const subtitleH = p.subtitle ? 20 * S : 0
  const contentH = subtitleH + lines.length * rowH + 10 * S
  const btnAreaH = 54 * S
  const panelW = W * 0.84
  const panelH = ribbonH + 18 * S + contentH + btnAreaH

  c.save()

  c.globalAlpha = alpha * 0.68
  var maskGrd = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.72)
  maskGrd.addColorStop(0, 'rgba(20,15,5,0.35)')
  maskGrd.addColorStop(1, 'rgba(10,8,2,0.92)')
  c.fillStyle = maskGrd
  c.fillRect(0, 0, W, H)
  c.globalAlpha = alpha

  const px = (W - panelW) / 2
  const targetY = (H - panelH) / 2 - 10 * S
  const py = timer < 14 ? targetY + 36 * S * (1 - timer / 14) : targetY
  const scale = timer < 11 ? 0.88 + 0.12 * (timer / 11) : 1

  c.save()
  c.translate(W / 2, py + panelH / 2)
  c.scale(scale, scale)
  c.translate(-W / 2, -(py + panelH / 2))

  const panelResult = drawPanel(c, S, px, py, panelW, panelH, { ribbonH })
  const ribbonCY = panelResult.ribbonCY

  c.fillStyle = '#5a3000'
  c.font = 'bold ' + (16 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(p.title, W / 2, ribbonCY)

  let cy = py + ribbonH + 14 * S
  if (p.subtitle) {
    c.fillStyle = '#7a6848'
    c.font = (11 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(p.subtitle, W / 2, cy + subtitleH / 2)
    cy += subtitleH
  }

  const innerPad = 20 * S
  const innerW = panelW - innerPad * 2
  const iconSz = 28 * S

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const ry = cy + i * rowH
    const rx = px + innerPad
    const rowInnerH = rowH - 6 * S

    c.fillStyle = 'rgba(198,162,58,0.11)'
    R.rr(rx - 4 * S, ry, innerW + 8 * S, rowInnerH, 9 * S)
    c.fill()

    const ip = _resolveIconPath(line.icon)
    let iconLeft = 0
    if (ip) {
      const img = R.getImg(ip)
      if (img && img.width > 0) {
        const iy = ry + (rowInnerH - iconSz) / 2
        c.drawImage(img, rx, iy, iconSz, iconSz)
        iconLeft = iconSz + 10 * S
      }
    }

    const midY = ry + rowInnerH / 2
    const textX = rx + iconLeft
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillStyle = '#4a3820'
    c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(line.label || '', textX, midY)

    const amountStr = String(line.amount != null ? line.amount : '')
    c.textAlign = 'right'
    c.textBaseline = 'middle'
    c.font = 'bold ' + (15 * S) + 'px "PingFang SC",sans-serif'
    c.fillStyle = '#6b4810'
    c.fillText(amountStr, rx + innerW, midY)
  }

  c.restore()

  const btnW = 176 * S
  const btnH = 42 * S
  const btnX = (W - btnW) / 2
  const btnY = py + panelH - btnAreaH + 8 * S
  c.globalAlpha = alpha
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '确认', 'confirm')

  p._btnRect = [btnX, btnY, btnW, btnH]

  c.restore()
}

/** @returns {boolean} 是否吞掉此次触摸 */
function handleAdRewardPopupTouch(g, x, y, type) {
  const p = g._adRewardPopup
  if (!p) return false
  if (type !== 'end') return true
  const hit = g._hitRect.bind(g)
  if (p._btnRect && hit(x, y, ...p._btnRect)) {
    g._adRewardPopup = null
    g._dirty = true
    return true
  }
  g._adRewardPopup = null
  g._dirty = true
  return true
}

/** 根据通用奖励对象生成弹窗行（签到/日活/里程碑等） */
function linesFromRewards(r) {
  const L = []
  if (!r) return L
  if (r.soulStone) L.push({ icon: 'icon_soul_stone', label: '灵石', amount: '+' + r.soulStone })
  if (r.stamina) L.push({ icon: 'icon_stamina', label: '体力', amount: '+' + r.stamina })
  if (r.awakenStone) L.push({ icon: 'icon_chest', label: '觉醒石', amount: '+' + r.awakenStone })
  if (r.fragment) L.push({ icon: 'frame_fragment', label: '随机碎片', amount: '+' + r.fragment })
  if (r.petChoice) L.push({ icon: 'daily_sign_icon', label: '灵宠', amount: 'SR 自选×1' })
  return L
}

/** 结算翻倍：按灵宠拆分碎片行 */
function linesFromFragmentDetails(details) {
  const L = []
  if (!details || !details.length) return L
  const { getPetById, getPetAvatarPath } = require('../data/pets')
  for (let i = 0; i < details.length; i++) {
    const fd = details[i]
    const pet = getPetById(fd.petId)
    const name = pet ? pet.name : '灵宠'
    const icon = pet ? getPetAvatarPath(pet) : 'frame_fragment'
    L.push({ icon: icon, label: name + '碎片', amount: '+' + fd.count })
  }
  return L
}

module.exports = {
  showAdRewardPopup,
  drawAdRewardPopup,
  handleAdRewardPopupTouch,
  linesFromRewards,
  linesFromFragmentDetails,
}
