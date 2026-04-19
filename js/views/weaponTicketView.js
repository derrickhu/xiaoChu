/**
 * SSR 法宝定向保底券兑换页 weaponTicket
 *
 * 设计意图（plan C1 / E：里程碑 24★ 发放"保底券"，玩家自选 SSR 法宝）：
 *   · 展示所有 SSR 法宝（不含通天塔专属）
 *   · 已拥有的置灰不可兑换（避免券浪费）
 *   · 点击未拥有的 SSR 卡片，弹确认框
 *   · 确认后调用 storage.useWeaponWildcardTicket(id)，消耗 1 张 → 加入背包
 *   · 券数为 0 时整页半透明 + 提示
 *
 * 入口：
 *   · chapterMap 页右下"保底券×N"按钮 → setScene('weaponTicket')
 *   · 也可后续在 weaponBag 顶部入口挂一个 chip（未做）
 *
 * 触摸入口：tWeaponTicket
 * 渲染入口：rWeaponTicket
 */

const V = require('./env')
const { getWeaponsByRarity, TOWER_ONLY_WEAPONS } = require('../data/weapons')
const gameToast = require('./gameToast')

const _rects = {
  backBtnRect: null,
  cards: [], // [{ weaponId, rect }]
}

const GRID_COLS = 3
const CARD_ASPECT = 1.25 // 高/宽 比

function rWeaponTicket(g) {
  const { ctx: c, R, W, H, S, safeTop } = V

  R.drawEventBg(g.af || 0)
  c.save()
  c.fillStyle = 'rgba(60,40,18,0.5)'
  c.fillRect(0, 0, W, H)
  c.restore()

  _drawTopBar(c, R, S, W, safeTop, g.storage.weaponWildcardTickets || 0)

  const available = getWeaponsByRarity('SSR').filter(w => !TOWER_ONLY_WEAPONS.includes(w.id))

  // 网格：Grid, 3 列
  const pad = 14 * S
  const gap = 10 * S
  const gridTopY = safeTop + 52 * S + 6 * S
  const gridW = W - pad * 2
  const cardW = (gridW - gap * (GRID_COLS - 1)) / GRID_COLS
  const cardH = cardW * CARD_ASPECT

  _rects.cards = []
  let col = 0, row = 0
  for (const wpn of available) {
    const cx = pad + col * (cardW + gap)
    const cy = gridTopY + row * (cardH + gap)
    const owned = g.storage.hasWeapon(wpn.id)
    _drawWeaponCard(c, R, S, cx, cy, cardW, cardH, wpn, owned)
    _rects.cards.push({ weaponId: wpn.id, owned, rect: [cx, cy, cardW, cardH] })
    col++
    if (col >= GRID_COLS) { col = 0; row++ }
  }

  // 底部提示
  const tipY = H - 30 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = 'rgba(255,232,176,0.82)'
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText('※ 每张券可兑换一件未拥有的 SSR 法宝；已拥有的不可兑换', W / 2, tipY)
}

function _drawTopBar(c, R, S, W, safeTop, ticketCount) {
  const topH = 42 * S
  const y = safeTop + 4 * S
  c.fillStyle = 'rgba(255,248,224,0.94)'
  R.rr(6 * S, y, W - 12 * S, topH, 8 * S); c.fill()
  c.strokeStyle = 'rgba(212,168,67,0.7)'
  c.lineWidth = 1 * S
  R.rr(6 * S, y, W - 12 * S, topH, 8 * S); c.stroke()

  // 返回按钮
  const backW = 54 * S
  c.fillStyle = 'rgba(180,130,50,0.9)'
  R.rr(10 * S, y + 6 * S, backW, topH - 12 * S, 6 * S); c.fill()
  c.fillStyle = '#fff8e0'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText('‹ 返回', 10 * S + backW / 2, y + topH / 2)
  _rects.backBtnRect = [10 * S, y + 6 * S, backW, topH - 12 * S]

  // 标题
  c.textAlign = 'center'
  c.fillStyle = '#8b5a1a'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText('SSR 法宝兑换', W / 2, y + topH / 2)

  // 右上：券数量
  c.textAlign = 'right'
  c.fillStyle = ticketCount > 0 ? '#c04020' : '#8b7355'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText(`🎫 券 × ${ticketCount}`, W - 14 * S, y + topH / 2)
}

function _drawWeaponCard(c, R, S, x, y, w, h, wpn, owned) {
  // 卡片底板
  const grad = c.createLinearGradient(x, y, x, y + h)
  if (owned) {
    grad.addColorStop(0, 'rgba(120,110,90,0.6)')
    grad.addColorStop(1, 'rgba(80,70,55,0.5)')
  } else {
    grad.addColorStop(0, 'rgba(255,215,80,0.28)')
    grad.addColorStop(1, 'rgba(180,120,40,0.22)')
  }
  c.fillStyle = grad
  R.rr(x, y, w, h, 8 * S); c.fill()
  c.strokeStyle = owned ? 'rgba(140,120,90,0.6)' : 'rgba(220,170,70,0.85)'
  c.lineWidth = owned ? 0.8 * S : 1.4 * S
  R.rr(x, y, w, h, 8 * S); c.stroke()

  // 法宝图
  const iconSz = w * 0.62
  const iconX = x + (w - iconSz) / 2
  const iconY = y + 8 * S
  const img = R.getImg(`assets/equipment/fabao_${wpn.id}.png`)
  if (img && img.width > 0) {
    c.save()
    if (owned) c.globalAlpha = 0.5
    c.drawImage(img, iconX, iconY, iconSz, iconSz)
    c.restore()
  }

  // 名称
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.fillStyle = owned ? 'rgba(220,210,190,0.7)' : '#fff8e0'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillText(wpn.name || wpn.id, x + w / 2, iconY + iconSz + 3 * S)

  // 状态标签
  const tagY = y + h - 22 * S
  const tagH = 16 * S
  const tagW = w - 12 * S
  if (owned) {
    c.fillStyle = 'rgba(60,90,60,0.85)'
    R.rr(x + 6 * S, tagY, tagW, tagH, tagH / 2); c.fill()
    c.fillStyle = '#d0e8c0'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('已拥有', x + w / 2, tagY + tagH / 2)
  } else {
    c.fillStyle = 'rgba(220,90,40,0.92)'
    R.rr(x + 6 * S, tagY, tagW, tagH, tagH / 2); c.fill()
    c.fillStyle = '#fff8e0'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('🎫 1 张兑换', x + w / 2, tagY + tagH / 2)
  }
}

function tWeaponTicket(g, x, y, type) {
  if (type !== 'end') return

  if (_rects.backBtnRect && _hit(x, y, _rects.backBtnRect)) {
    // 从章节主线进入的就回章节主线；否则回首页
    g.setScene(g._prevSceneBeforeTicket || 'chapterMap')
    g._prevSceneBeforeTicket = null
    return
  }

  for (const card of _rects.cards) {
    if (_hit(x, y, card.rect)) {
      if (card.owned) {
        gameToast.show('已拥有该法宝，无需兑换')
        return
      }
      if ((g.storage.weaponWildcardTickets || 0) <= 0) {
        gameToast.show('券数不足', { type: 'warn' })
        return
      }
      _confirmExchange(g, card.weaponId)
      return
    }
  }
}

function _confirmExchange(g, weaponId) {
  const { getWeaponById } = require('../data/weapons')
  const w = getWeaponById(weaponId)
  if (!w) return
  g._confirmDialog = {
    title: '兑换 SSR 法宝',
    content: `消耗 1 张保底券，兑换「${w.name}」？`,
    confirmText: '兑换',
    cancelText: '取消',
    timer: 0,
    onConfirm: () => {
      const ok = g.storage.useWeaponWildcardTicket(weaponId)
      if (ok) {
        gameToast.show(`已兑换「${w.name}」`, { type: 'success' })
      } else {
        gameToast.show('兑换失败', { type: 'warn' })
      }
    },
  }
}

function _hit(x, y, rect) {
  if (!rect) return false
  return x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]
}

module.exports = {
  rWeaponTicket,
  tWeaponTicket,
}
