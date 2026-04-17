/**
 * 新手冒险者礼包 — 仙风卷轴弹窗
 * g._newbieGift = { timer, phase, claimed, items, flyParticles, claimTimer, ... }
 */
const V = require('./env')
const { NEWBIE_GIFT_REWARDS } = require('../data/constants')

const ANIM_SCROLL_DUR = 18
const ANIM_ITEM_DELAY = 8
const ANIM_ITEM_DUR = 10
const FLY_DURATION = 30       // 资源飞入动画帧数
const FLY_STAGGER = 12        // 每项飞入间隔帧
const CLAIM_BOUNCE_DUR = 16   // 数字弹跳帧数

function _easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3) }

function _buildItems() {
  const items = []
  if (NEWBIE_GIFT_REWARDS.soulStone) {
    items.push({ icon: 'assets/ui/icon_soul_stone.png', label: '灵石', amount: `×${NEWBIE_GIFT_REWARDS.soulStone}`, num: NEWBIE_GIFT_REWARDS.soulStone })
  }
  if (NEWBIE_GIFT_REWARDS.universalFragment) {
    items.push({ icon: 'assets/ui/icon_universal_frag.png', label: '万能碎片', amount: `×${NEWBIE_GIFT_REWARDS.universalFragment}`, num: NEWBIE_GIFT_REWARDS.universalFragment })
  }
  if (NEWBIE_GIFT_REWARDS.stamina) {
    items.push({ icon: 'assets/ui/icon_stamina.png', label: '体力', amount: `×${NEWBIE_GIFT_REWARDS.stamina}`, num: NEWBIE_GIFT_REWARDS.stamina })
  }
  return items
}

function show(g) {
  g._newbieGift = {
    timer: 0,
    phase: 'opening',
    claimed: false,
    items: _buildItems(),
    closeTimer: 0,
    claimTimer: 0,
    flyParticles: [],
    _btnRect: null,
  }
}

// 计算奖励项在弹窗中的位置（供飞入起点用）
function _getItemCenterPos(d, i, S, W, H) {
  const scrollW = W * 0.82
  const scrollCY = H * 0.44
  const scrollH = H * 0.58
  const scrollY = scrollCY - scrollH / 2
  const iconSz = 80 * S
  const iconY = scrollY + 12 * S
  const bannerH = 32 * S
  const bannerY = iconY + iconSz + 4 * S
  const subtitleY = bannerY + bannerH + 14 * S
  const itemStartY = subtitleY + 28 * S
  const itemH = 52 * S
  const itemW = scrollW * 0.7
  const itemX = (W - itemW) / 2
  const cy = itemStartY + i * itemH
  return { x: itemX + itemW / 2, y: cy + (itemH - 6 * S) / 2 }
}

function draw(g) {
  const d = g._newbieGift
  if (!d) return
  const { ctx: c, R, S, W, H } = V

  d.timer++
  if (d.claimed) d.claimTimer++

  // 半透明遮罩
  c.save()
  const overlayAlpha = d.phase === 'closing'
    ? Math.max(0, 1 - d.closeTimer / 12) * 0.72
    : Math.min(d.timer / 10, 1) * 0.72
  c.fillStyle = `rgba(10,8,20,${overlayAlpha})`
  c.fillRect(0, 0, W, H)

  const scrollP = Math.min(d.timer / ANIM_SCROLL_DUR, 1)
  const scaleY = _easeOutBack(scrollP)

  const scrollW = W * 0.82
  const scrollH = H * 0.58
  const scrollX = (W - scrollW) / 2
  const scrollCY = H * 0.44
  const scrollY = scrollCY - scrollH / 2

  // 卷轴背景
  c.save()
  c.translate(W / 2, scrollCY)
  c.scale(1, d.phase === 'closing' ? Math.max(0, 1 - d.closeTimer / 12) : scaleY)
  c.translate(-W / 2, -scrollCY)

  const scrollBg = R.getImg('assets/ui/reward_card_bg.png')
  if (scrollBg && scrollBg.width > 0) {
    c.shadowColor = 'rgba(180,140,60,0.35)'
    c.shadowBlur = 20 * S
    c.drawImage(scrollBg, scrollX, scrollY, scrollW, scrollH)
    c.shadowBlur = 0
  } else {
    c.fillStyle = 'rgba(255,248,230,0.95)'
    R.rr(scrollX, scrollY, scrollW, scrollH, 12 * S)
    c.fill()
  }

  if (scrollP >= 0.85) {
    const contentAlpha = Math.min((scrollP - 0.85) / 0.15, 1)
    c.globalAlpha = contentAlpha

    // 礼包图标
    const giftIcon = R.getImg('assets/ui/newbie_gift_icon.png')
    const iconSz = 80 * S
    const iconY = scrollY + 12 * S
    if (giftIcon && giftIcon.width > 0) {
      c.drawImage(giftIcon, W / 2 - iconSz / 2, iconY, iconSz, iconSz)
    }

    // 金色横幅标题
    const banner = R.getImg('assets/ui/banner_reward.png')
    const bannerW = scrollW * 0.72
    const bannerH = 32 * S
    const bannerY = iconY + iconSz + 4 * S
    if (banner && banner.width > 0) {
      c.drawImage(banner, W / 2 - bannerW / 2, bannerY, bannerW, bannerH)
    }
    c.fillStyle = '#5A3010'
    c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('冒险者礼包', W / 2, bannerY + bannerH * 0.48)

    // 副文案
    const subtitleY = bannerY + bannerH + 14 * S
    c.fillStyle = 'rgba(90,60,30,0.75)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.fillText('欢迎来到灵兽世界！这份礼物助你踏上修仙之路', W / 2, subtitleY)

    // 奖励项
    const itemStartY = subtitleY + 28 * S
    const itemH = 52 * S
    const itemW = scrollW * 0.7
    const itemX = (W - itemW) / 2

    d.items.forEach((item, i) => {
      const itemAppearFrame = ANIM_SCROLL_DUR + i * ANIM_ITEM_DELAY
      const itemAge = d.timer - itemAppearFrame
      if (itemAge < 0) return

      const p = Math.min(itemAge / ANIM_ITEM_DUR, 1)
      const bounceScale = _easeOutBack(p)
      const alpha = Math.min(p * 2, 1)

      c.save()
      c.globalAlpha *= alpha
      const cy = itemStartY + i * itemH
      const centerX = W / 2
      const centerY = cy + itemH / 2

      c.translate(centerX, centerY)
      c.scale(bounceScale, bounceScale)
      c.translate(-centerX, -centerY)

      c.fillStyle = 'rgba(255,240,200,0.6)'
      c.strokeStyle = 'rgba(200,170,100,0.5)'
      c.lineWidth = 1 * S
      R.rr(itemX, cy, itemW, itemH - 6 * S, 8 * S)
      c.fill()
      R.rr(itemX, cy, itemW, itemH - 6 * S, 8 * S)
      c.stroke()

      const iconImg = R.getImg(item.icon)
      const iSz = 30 * S
      const iX = itemX + 12 * S
      const iY = cy + (itemH - 6 * S) / 2 - iSz / 2
      if (iconImg && iconImg.width > 0) {
        c.drawImage(iconImg, iX, iY, iSz, iSz)
      }

      c.fillStyle = '#5A3A15'
      c.font = `bold ${13 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'
      c.textBaseline = 'middle'
      c.fillText(item.label, iX + iSz + 10 * S, cy + (itemH - 6 * S) / 2)

      // 数字（领取后弹跳动画）
      const numCY = cy + (itemH - 6 * S) / 2
      if (d.claimed) {
        const bounceAge = d.claimTimer - i * 6
        if (bounceAge > 0 && bounceAge < CLAIM_BOUNCE_DUR) {
          const bp = bounceAge / CLAIM_BOUNCE_DUR
          const bs = 1 + 0.4 * Math.sin(bp * Math.PI)
          c.save()
          c.translate(itemX + itemW - 14 * S, numCY)
          c.scale(bs, bs)
          c.translate(-(itemX + itemW - 14 * S), -numCY)
          c.fillStyle = '#D4A030'
          c.font = `bold ${16 * S}px "PingFang SC",sans-serif`
          c.textAlign = 'right'
          c.fillText(`+${item.num}`, itemX + itemW - 14 * S, numCY)
          c.restore()
        } else if (bounceAge >= CLAIM_BOUNCE_DUR) {
          c.fillStyle = '#2E8B2E'
          c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
          c.textAlign = 'right'
          c.fillText(`+${item.num} ✓`, itemX + itemW - 14 * S, numCY)
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

      c.restore()
    })

    // 按钮区域
    const allItemsShown = d.timer >= ANIM_SCROLL_DUR + d.items.length * ANIM_ITEM_DELAY + ANIM_ITEM_DUR
    if (allItemsShown) {
      const btnW = scrollW * 0.52
      const btnH = 38 * S
      const btnX = (W - btnW) / 2
      const btnY = scrollY + scrollH - btnH - 20 * S

      if (d.claimed) {
        // 领取后显示提示文字
        c.fillStyle = 'rgba(90,60,30,0.6)'
        c.font = `${12 * S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'
        c.textBaseline = 'middle'
        c.fillText('点击任意位置继续', W / 2, btnY + btnH * 0.48)
      } else {
        const btnImg = R.getImg('assets/ui/btn_reward_confirm.png')
        if (btnImg && btnImg.width > 0) {
          c.drawImage(btnImg, btnX, btnY, btnW, btnH)
          c.fillStyle = '#4A2020'
          c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText('✦ 开启礼包 ✦', btnX + btnW / 2, btnY + btnH * 0.48)
        } else {
          c.fillStyle = '#C8A040'
          R.rr(btnX, btnY, btnW, btnH, 8 * S)
          c.fill()
          c.fillStyle = '#fff'
          c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'
          c.textBaseline = 'middle'
          c.fillText('✦ 开启礼包 ✦', btnX + btnW / 2, btnY + btnH * 0.48)
        }
        d._btnRect = [btnX, btnY, btnW, btnH]
      }
    }
  }

  c.restore() // scale transform
  c.restore() // save

  // 飞入粒子绘制（在卷轴 transform 之外，使用屏幕坐标）
  _drawFlyParticles(d, c, R, S, W, H)

  // 关闭动画
  if (d.phase === 'closing') {
    d.closeTimer++
    if (d.closeTimer >= 14) {
      g._newbieGift = null
    }
  }
}

// 飞入粒子：从卷轴中奖励项位置飞向屏幕顶部
function _drawFlyParticles(d, c, R, S, W, H) {
  if (!d.flyParticles || d.flyParticles.length === 0) return
  d.flyParticles.forEach(fp => {
    fp.age++
    const p = Math.min(fp.age / FLY_DURATION, 1)
    const ep = _easeOutCubic(p)
    const cx = fp.sx + (fp.tx - fp.sx) * ep
    const cy = fp.sy + (fp.ty - fp.sy) * ep - Math.sin(ep * Math.PI) * 40 * S  // 抛物线弧度
    const alpha = p < 0.8 ? 1 : (1 - p) / 0.2
    const sz = (20 + 10 * Math.sin(p * Math.PI)) * S

    c.save()
    c.globalAlpha = alpha
    const img = R.getImg(fp.icon)
    if (img && img.width > 0) {
      c.drawImage(img, cx - sz / 2, cy - sz / 2, sz, sz)
    }
    // 拖尾光效
    c.beginPath()
    c.arc(cx, cy, sz * 0.6, 0, Math.PI * 2)
    c.fillStyle = `rgba(255,215,0,${alpha * 0.3})`
    c.fill()
    c.restore()
  })
  // 清理已完成的粒子
  d.flyParticles = d.flyParticles.filter(fp => fp.age < FLY_DURATION)
}

function _spawnFlyParticles(d, S, W, H, g) {
  // 尝试取主页顶栏每个资源胶囊的位置作为飞入终点（视觉上资源"落"到真实胶囊上）
  // 失败时退化为屏幕顶部均匀分布
  const iconToRect = {
    'assets/ui/icon_soul_stone.png': g && g._soulStonePillRect,
    'assets/ui/icon_stamina.png': g && g._staminaPillRect,
    'assets/ui/icon_universal_frag.png': g && g._uniFragPillRect,
  }
  const defaultTY = 20 * S
  d.items.forEach((item, i) => {
    const src = _getItemCenterPos(d, i, S, W, H)
    const rect = iconToRect[item.icon]
    const tx0 = rect ? rect[0] + rect[2] / 2 : W * (0.3 + i * 0.2)
    const ty0 = rect ? rect[1] + rect[3] / 2 : defaultTY
    // 每项生成 3 个粒子，轻微散开
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

function onTouch(g, x, y, type) {
  const d = g._newbieGift
  if (!d) return false
  if (type !== 'end') return true
  if (d.phase === 'closing') return true

  // 点击领取按钮
  if (!d.claimed && d._btnRect) {
    const [bx, by, bw, bh] = d._btnRect
    if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
      _claimRewards(g)
      d.claimed = true
      d.phase = 'claimed'
      d.claimTimer = 0
      const { S, W, H } = V
      _spawnFlyParticles(d, S, W, H, g)
      return true
    }
  }

  // 已领取且弹跳动画结束后，点击任意位置关闭
  if (d.claimed && d.claimTimer > CLAIM_BOUNCE_DUR + d.items.length * 6) {
    d.phase = 'closing'
    return true
  }

  return true
}

function _claimRewards(g) {
  const r = NEWBIE_GIFT_REWARDS
  if (r.soulStone) g.storage.addSoulStone(r.soulStone)
  if (r.stamina) g.storage.noticeStaminaOverflow(g.storage.addBonusStamina(r.stamina))
  if (r.universalFragment) g.storage.addUniversalFragment(r.universalFragment)
  g.storage.markGuideShown('newbie_gift_claimed')
  // 礼包关闭后，主页万能碎片胶囊脉冲高亮一次，告诉玩家资源去了哪
  g._uniFragPulse = { timer: 0 }
}

module.exports = { show, draw, onTouch }
