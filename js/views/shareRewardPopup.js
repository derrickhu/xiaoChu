/**
 * 分享奖励弹窗：图标展示 + 点击「领取」后播放与新手礼包一致的抛物线飞入顶栏动效。
 * 注意：storage.recordShare 已在唤起分享时入账，此处仅视觉反馈，不再加数值。
 */
const V = require('./env')
const { drawGoldBtn } = require('./uiUtils')
const buttonFx = require('./buttonFx')
const MusicMgr = require('../runtime/music')

const FLY_DURATION = 30
const FLY_STAGGER = 12
const CLAIM_BOUNCE_DUR = 16
const OPEN_DUR = 10

// reward_card_bg 顶部为木轴装饰；标题须下移并进羊皮纸区，避免「压轴」错位
const SCROLL_TOP_INSET_S = 50
const TITLE_AREA_BELOW_INSET_S = 38
const TITLE_LINE_OFFSET_S = 10
const SUBTITLE_LINE_OFFSET_S = 24
const TITLE_FONT_S = 14
const SUBTITLE_FONT_S = 9

function _easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}

function _buildItems(rewarded) {
  const items = []
  if (!rewarded) return items
  if (rewarded.soulStone) {
    items.push({
      icon: 'assets/ui/icon_soul_stone.png',
      label: '灵石',
      amount: `+${rewarded.soulStone}`,
      num: rewarded.soulStone,
    })
  }
  if (rewarded.stamina) {
    items.push({
      icon: 'assets/ui/icon_stamina.png',
      label: '体力',
      amount: `+${rewarded.stamina}`,
      num: rewarded.stamina,
    })
  }
  if (rewarded.fragment) {
    items.push({
      icon: 'assets/ui/icon_universal_frag.png',
      label: '万能碎片',
      amount: `+${rewarded.fragment}`,
      num: rewarded.fragment,
    })
  }
  return items
}

function _panelMetrics(d, S, W, H) {
  const n = d.items.length
  const panelW = W * 0.8
  const headerH = (SCROLL_TOP_INSET_S + TITLE_AREA_BELOW_INSET_S) * S
  const itemH = 48 * S
  const footerH = 58 * S
  const panelH = headerH + n * itemH + footerH
  const panelCY = H * 0.44
  const panelX = (W - panelW) / 2
  const panelY = panelCY - panelH / 2
  const titleY = panelY + SCROLL_TOP_INSET_S * S + TITLE_LINE_OFFSET_S * S
  const subtitleY = panelY + SCROLL_TOP_INSET_S * S + SUBTITLE_LINE_OFFSET_S * S
  return {
    panelW, panelH, panelX, panelY, panelCY, headerH, itemH, footerH,
    itemStartY: panelY + headerH, titleY, subtitleY,
  }
}

function _getItemCenter(d, i, S, W, H) {
  const m = _panelMetrics(d, S, W, H)
  const cy = m.itemStartY + i * m.itemH + m.itemH / 2
  return { x: W / 2, y: cy }
}

function _mergeReward(base, add) {
  return {
    stamina: (base.stamina || 0) + (add.stamina || 0),
    soulStone: (base.soulStone || 0) + (add.soulStone || 0),
    fragment: (base.fragment || 0) + (add.fragment || 0),
  }
}

function open(g, rewarded) {
  if (!g || !rewarded) return
  const cur = g._shareRewardPopup
  if (cur && !cur.claimed) {
    cur.accum = _mergeReward(cur.accum || { stamina: 0, soulStone: 0, fragment: 0 }, rewarded)
    cur.items = _buildItems(cur.accum)
    g._dirty = true
    return
  }
  const accum = _mergeReward({ stamina: 0, soulStone: 0, fragment: 0 }, rewarded)
  const items = _buildItems(accum)
  if (!items.length) return
  g._shareRewardPopup = {
    timer: 0,
    phase: 'open',
    accum,
    items,
    claimed: false,
    claimTimer: 0,
    flyParticles: [],
    _btnRect: null,
    closeTimer: 0,
    canDismiss: false,
  }
}

function isActive(g) {
  return !!(g && g._shareRewardPopup)
}

function _drawFlyParticles(d, c, R, S, W, H) {
  if (!d.flyParticles || !d.flyParticles.length) return
  d.flyParticles.forEach((fp) => {
    fp.age++
    const p = Math.min(fp.age / FLY_DURATION, 1)
    const ep = _easeOutCubic(p)
    const cx = fp.sx + (fp.tx - fp.sx) * ep
    const cy = fp.sy + (fp.ty - fp.sy) * ep - Math.sin(ep * Math.PI) * 40 * S
    const alpha = p < 0.8 ? 1 : (1 - p) / 0.2
    const sz = (20 + 10 * Math.sin(p * Math.PI)) * S
    c.save()
    c.globalAlpha = alpha
    const img = R.getImg(fp.icon)
    if (img && img.width > 0) {
      c.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz)
    }
    c.beginPath()
    c.arc(cx, cy, sz * 0.6, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,215,0,${alpha * 0.3})`
    c.fill()
    c.restore()
  })
  d.flyParticles = d.flyParticles.filter((fp) => fp.age < FLY_DURATION)
}

function _spawnFlyParticles(d, S, W, H, g) {
  void g
  const safeTop = V.safeTop || 0
  const defaultTY = safeTop + 22 * S
  d.items.forEach((item, i) => {
    const src = _getItemCenter(d, i, S, W, H)
    const tx0 = W * (0.28 + i * 0.22)
    const ty0 = defaultTY
    for (let j = 0; j < 3; j++) {
      d.flyParticles.push({
        icon: item.icon,
        sx: src.x + (j - 1) * 12 * S,
        sy: src.y,
        tx: tx0 + (j - 1) * 8 * S,
        ty: ty0,
        age: -(i * FLY_STAGGER + j * 3),
      })
    }
  })
}

function draw(g) {
  const d = g._shareRewardPopup
  if (!d) return
  const { ctx: c, R, S, W, H } = V

  d.timer++
  if (d.claimed) d.claimTimer++

  if (d.phase === 'closing') {
    d.closeTimer++
    const alpha = Math.max(0, 1 - d.closeTimer / 14) * 0.72
    c.save()
    c.fillStyle = `rgba(10,8,20,${alpha})`
    c.fillRect(0, 0, W, H)
    c.restore()
    if (d.closeTimer >= 14) g._shareRewardPopup = null
    return
  }

  const openP = Math.min(d.timer / OPEN_DUR, 1)
  const overlayAlpha = openP * 0.72
  c.save()
  c.fillStyle = `rgba(10,8,20,${overlayAlpha})`
  c.fillRect(0, 0, W, H)

  const m = _panelMetrics(d, S, W, H)
  const scrollBg = R.getImg('assets/ui/reward_card_bg.png')
  c.save()
  c.globalAlpha = openP
  if (scrollBg && scrollBg.width > 0) {
    c.shadowColor = 'rgba(180,140,60,0.35)'
    c.shadowBlur = 16 * S
    c.drawImage(scrollBg, m.panelX, m.panelY, m.panelW, m.panelH)
    c.shadowBlur = 0
  } else {
    c.fillStyle = 'rgba(255,248,230,0.95)'
    R.rr(m.panelX, m.panelY, m.panelW, m.panelH, 12 * S)
    c.fill()
  }

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.font = `bold ${TITLE_FONT_S * S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(255,248,235,0.55)'
  c.lineWidth = 2.5 * S
  c.strokeText('分享奖励', W / 2, m.titleY)
  c.fillStyle = '#4A2810'
  c.fillText('分享奖励', W / 2, m.titleY)

  c.fillStyle = 'rgba(90,60,30,0.75)'
  c.font = `${SUBTITLE_FONT_S * S}px "PingFang SC",sans-serif`
  c.fillText('轻触「领取」收下奖励', W / 2, m.subtitleY)

  d.items.forEach((item, i) => {
    const cy = m.itemStartY + i * m.itemH + m.itemH / 2
    const rowH = m.itemH - 6 * S
    const rowY = cy - rowH / 2
    const itemW = m.panelW * 0.82
    const itemX = (W - itemW) / 2

    c.fillStyle = 'rgba(255,240,200,0.55)'
    c.strokeStyle = 'rgba(200,170,100,0.45)'
    c.lineWidth = 1 * S
    R.rr(itemX, rowY, itemW, rowH, 8 * S)
    c.fill()
    R.rr(itemX, rowY, itemW, rowH, 8 * S)
    c.stroke()

    const iconImg = R.getImg(item.icon)
    const iSz = 32 * S
    const iX = itemX + 12 * S
    const iY = cy - iSz / 2
    if (iconImg && iconImg.width > 0) {
      c.drawImage(iconImg, iX, iY, iSz, iSz)
    }

    c.fillStyle = '#5A3A15'
    c.font = `bold ${13 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    c.fillText(item.label, iX + iSz + 10 * S, cy)

    const numCY = cy
    if (d.claimed) {
      const bounceAge = d.claimTimer - i * 6
      if (bounceAge > 0 && bounceAge < CLAIM_BOUNCE_DUR) {
        const bp = bounceAge / CLAIM_BOUNCE_DUR
        const bs = 1 + 0.35 * Math.sin(bp * Math.PI)
        c.save()
        c.translate(itemX + itemW - 14 * S, numCY)
        c.scale(bs, bs)
        c.translate(-(itemX + itemW - 14 * S), -numCY)
        c.fillStyle = '#D4A030'
        c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
        c.textAlign = 'right'
        c.fillText(`+${item.num}`, itemX + itemW - 14 * S, numCY)
        c.restore()
      } else if (bounceAge >= CLAIM_BOUNCE_DUR) {
        c.fillStyle = '#2E8B2E'
        c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
        c.textAlign = 'right'
        c.fillText(`+${item.num} \u2713`, itemX + itemW - 14 * S, numCY)
      } else {
        c.fillStyle = '#B8860B'
        c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
        c.textAlign = 'right'
        c.fillText(item.amount, itemX + itemW - 14 * S, numCY)
      }
    } else {
      c.fillStyle = '#B8860B'
      c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'right'
      c.fillText(item.amount, itemX + itemW - 14 * S, numCY)
    }
  })

  const btnW = m.panelW * 0.52
  const btnH = 38 * S
  const btnX = (W - btnW) / 2
  const btnY = m.panelY + m.panelH - btnH - 16 * S

  if (d.claimed) {
    if (d.canDismiss) {
      c.fillStyle = 'rgba(90,60,30,0.65)'
      c.font = `${11 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillText('点击空白处关闭', W / 2, btnY + btnH * 0.45)
    }
    d._btnRect = null
  } else {
    drawGoldBtn(c, R, S, btnX, btnY, btnW, btnH, '领取', false, 14)
    d._btnRect = [btnX, btnY, btnW, btnH]
  }

  c.restore()
  c.restore()

  _drawFlyParticles(d, c, R, S, W, H)

  if (d.claimed && (!d.flyParticles || d.flyParticles.length === 0) && d.claimTimer > 18) {
    d.canDismiss = true
  }
}

function onTouch(g, x, y, type) {
  const d = g._shareRewardPopup
  if (!d) return false
  if (type !== 'end') return true
  if (d.phase === 'closing') return true

  if (!d.claimed && d._btnRect) {
    const [bx, by, bw, bh] = d._btnRect
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      MusicMgr.playClick && MusicMgr.playClick()
      buttonFx.trigger(d._btnRect.slice(), 'reward')
      d.claimed = true
      d.claimTimer = 0
      d.canDismiss = false
      const { S, W, H } = V
      _spawnFlyParticles(d, S, W, H, g)
      g._dirty = true
      return true
    }
    return true
  }

  if (d.canDismiss) {
    d.phase = 'closing'
    d.closeTimer = 0
    g._dirty = true
    return true
  }

  return true
}

module.exports = { open, draw, onTouch, isActive }
