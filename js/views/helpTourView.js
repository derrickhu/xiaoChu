/**
 * 功能导览 — 「更多」菜单中的一键总览
 * 6 页图文卡片：秘境 / 通天塔 / 灵宠池 / 修炼 / 法宝 / 签到每日任务
 * g._helpTour = { page, animIn, closeAnim, _btnRects }
 */
const V = require('./env')

// 注意：icon 路径必须指向 assets/ui 下实际存在的 PNG，bottomBar.js 里没有为
// 秘境/塔/灵宠/修炼单独准备 nav_stage / nav_tower / nav_pet / nav_cult，
// 直接复用 bottomBar 已装载的同义图，避免 ENOENT 打断加载。
const PAGES = [
  {
    title: '灵兽秘境',
    icon: 'assets/ui/nav_battle.png',
    lines: [
      '章节式推关玩法，是主要成长途径',
      '首通获得固定奖励：灵宠/碎片/灵石/法宝',
      '每关消耗体力（体力恢复间隔 5 分钟）',
      'S / A / B 评级：回合越少评级越高',
    ],
  },
  {
    title: '通天塔',
    icon: 'assets/ui/tower_rogue.png',
    lines: [
      '无尽挑战玩法，考验阵容深度',
      '不消耗体力！每日 3 次免费挑战',
      '每日 0 点刷新免费次数和奖励',
      '通关第 1 章（1-8）后解锁',
    ],
  },
  {
    title: '灵宠池',
    icon: 'assets/ui/nav_icons.png',
    lines: [
      '你收集到的所有灵宠都在这里',
      '消耗灵石 → 升级 → 提升攻击力',
      '等级够 + 碎片够 → 升星 → 解锁技能',
      '万能碎片可用于任意灵宠升星',
    ],
  },
  {
    title: '修炼',
    icon: 'assets/ui/nav_hero.png',
    lines: [
      '主角属性强化：体质 / 灵力 / 悟性等',
      '获得修炼点 → 加点强化全局属性',
      '影响全队：血量、护盾、转珠时间等',
      '建议优先体质与防御',
    ],
  },
  {
    title: '法宝',
    icon: 'assets/ui/nav_weapon.png',
    lines: [
      '被动神器，战斗中自动生效',
      '击败精英与 BOSS 有几率掉落',
      '同时只能装备 1 件，可自由切换',
      '不同稀有度（R/SR/SSR）效果差异大',
    ],
  },
  {
    title: '签到 & 每日任务',
    icon: 'assets/ui/daily_sign_icon.png',
    lines: [
      '每日签到免费领灵石、体力、碎片',
      '每日任务通过正常游玩自动完成',
      '完成全部任务可看广告翻倍奖励',
      '每天上线务必来领取！',
    ],
  },
]

function show(g) {
  g._helpTour = {
    page: 0,
    timer: 0,
    closing: false,
    closeTimer: 0,
    _btnRects: null,
  }
}

function draw(g) {
  const d = g._helpTour
  if (!d) return
  const { ctx: c, R, W, H, S } = V

  d.timer++
  const alpha = d.closing
    ? Math.max(0, 1 - d.closeTimer / 10) * 0.72
    : Math.min(d.timer / 10, 1) * 0.72

  c.save()
  c.fillStyle = `rgba(10,8,20,${alpha})`
  c.fillRect(0, 0, W, H)

  const panelW = W * 0.88
  const panelH = H * 0.72
  const panelX = (W - panelW) / 2
  const panelY = (H - panelH) / 2

  const scrollP = Math.min(d.timer / 14, 1)
  const ease = 1 - Math.pow(1 - scrollP, 3)
  const scale = d.closing ? Math.max(0, 1 - d.closeTimer / 10) : ease

  c.save()
  c.translate(W / 2, H / 2)
  c.scale(scale, scale)
  c.translate(-W / 2, -H / 2)

  c.fillStyle = 'rgba(255,248,230,0.98)'
  R.rr(panelX, panelY, panelW, panelH, 16 * S); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.55)'
  c.lineWidth = 2 * S
  R.rr(panelX, panelY, panelW, panelH, 16 * S); c.stroke()

  const page = PAGES[d.page]

  c.fillStyle = '#8B6914'
  c.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'top'
  c.fillText('功能导览', W / 2, panelY + 16 * S)

  c.fillStyle = 'rgba(100,80,40,0.6)'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.fillText(`${d.page + 1} / ${PAGES.length}`, W / 2, panelY + 40 * S)

  // 图标
  const iconSz = 80 * S
  const iconX = W / 2 - iconSz / 2
  const iconY = panelY + 64 * S
  const iconImg = R.getImg(page.icon)
  if (iconImg && iconImg.width > 0) {
    c.drawImage(iconImg, iconX, iconY, iconSz, iconSz)
  }

  // 标题
  c.fillStyle = '#5A3A15'
  c.font = `bold ${18 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText(page.title, W / 2, iconY + iconSz + 10 * S)

  // 说明
  c.fillStyle = '#5A4530'
  c.font = `${13 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  let ly = iconY + iconSz + 46 * S
  const textX = panelX + 24 * S
  page.lines.forEach(line => {
    c.fillStyle = 'rgba(200,170,80,0.9)'
    c.fillText('·', textX, ly)
    c.fillStyle = '#5A4530'
    c.fillText(line, textX + 14 * S, ly)
    ly += 22 * S
  })

  // 按钮区
  const btnY = panelY + panelH - 52 * S
  const btnH = 34 * S
  const prevEnable = d.page > 0
  const nextEnable = d.page < PAGES.length - 1

  const prevW = 70 * S
  const prevX = panelX + 16 * S
  c.fillStyle = prevEnable ? 'rgba(100,80,40,0.85)' : 'rgba(100,80,40,0.3)'
  R.rr(prevX, btnY, prevW, btnH, 6 * S); c.fill()
  c.fillStyle = '#fff'
  c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText('上一页', prevX + prevW / 2, btnY + btnH / 2)

  const nextW = 70 * S
  const nextX = panelX + panelW - nextW - 16 * S
  c.fillStyle = nextEnable ? '#C9A74D' : 'rgba(201,167,77,0.35)'
  R.rr(nextX, btnY, nextW, btnH, 6 * S); c.fill()
  c.fillStyle = '#fff'
  c.fillText(nextEnable ? '下一页' : '已是最后', nextX + nextW / 2, btnY + btnH / 2)

  const closeW = 80 * S
  const closeX = W / 2 - closeW / 2
  c.fillStyle = 'rgba(80,60,30,0.7)'
  R.rr(closeX, btnY, closeW, btnH, 6 * S); c.fill()
  c.fillStyle = '#fff'
  c.fillText('关闭', closeX + closeW / 2, btnY + btnH / 2)

  c.restore()

  d._btnRects = {
    prev: [prevX, btnY, prevW, btnH],
    next: [nextX, btnY, nextW, btnH],
    close: [closeX, btnY, closeW, btnH],
  }

  if (d.closing) {
    d.closeTimer++
    if (d.closeTimer >= 10) g._helpTour = null
  }

  c.restore()
}

function onTouch(g, x, y, type) {
  const d = g._helpTour
  if (!d) return false
  if (type !== 'end') return true
  if (d.closing) return true
  const rects = d._btnRects
  if (!rects) return true
  if (g._hitRect(x, y, ...rects.prev)) {
    if (d.page > 0) d.page--
    return true
  }
  if (g._hitRect(x, y, ...rects.next)) {
    if (d.page < PAGES.length - 1) d.page++
    return true
  }
  if (g._hitRect(x, y, ...rects.close)) {
    d.closing = true
    return true
  }
  return true
}

module.exports = { show, draw, onTouch }
