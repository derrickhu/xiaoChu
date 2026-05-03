/**
 * 开场漫画 — 单页全屏插画 + 叙事文字
 * 首次打开游戏时播放，播放完成/跳过后标记 introDone
 */
const V = require('./env')

const PAGES = [
  {
    img: 'assets/intro/intro_2.jpg',
    lines: [
      '妖王挡路，通天塔妖气冲天',
      '五行灵宠从天而降，护你脱险',
      '拖动灵珠，立刻打出五行合击！',
    ],
  },
]

let _page = 0
let _lineIdx = 0
let _lineAlpha = []
let _timer = 0
let _fadeDir = 0       // 0=idle 1=fadingIn -1=fadingOut
let _pageFade = 1      // 整页透明度
let _allLinesShown = false
let _breathT = 0
let _btnReady = false  // 最后一页全部显示后的按钮
let _introShowTracked = false
let _finished = false

const FADE_SPEED = 0.04
const AUTO_START_FRAMES = 180

function init(g) {
  _page = 0
  _lineIdx = PAGES[0].lines.length
  _lineAlpha = PAGES[0].lines.map(() => 1)
  _timer = 0
  _fadeDir = 1
  _pageFade = 0
  _allLinesShown = true
  _breathT = 0
  _btnReady = PAGES.length === 1
  _introShowTracked = false
  _finished = false
  _recordIntroEvent(g, 'intro_show', { page: 1, totalPages: PAGES.length })
}

function update(g) {
  _timer++
  _breathT += 0.05

  if (_fadeDir === 1) {
    _pageFade = Math.min(1, _pageFade + FADE_SPEED)
    if (_pageFade >= 1) _fadeDir = 0
  } else if (_fadeDir === -1) {
    _pageFade = Math.max(0, _pageFade - FADE_SPEED)
    if (_pageFade <= 0) {
      _page++
      if (_page >= PAGES.length) {
        _finish(g)
        return
      }
      _lineIdx = PAGES[_page].lines.length
      _lineAlpha = PAGES[_page].lines.map(() => 1)
      _allLinesShown = true
      _btnReady = _page === PAGES.length - 1
      _timer = 0
      _fadeDir = 1
    }
  }

  if (_fadeDir === 0) {
    // 投放用户更重视首战速度：每页文字一次性展示，点击即可翻页。
    _lineIdx = PAGES[_page].lines.length
    _lineAlpha = PAGES[_page].lines.map(() => 1)
    _allLinesShown = true
    if (_allLinesShown && _page === PAGES.length - 1) {
      _btnReady = true
    }
    if (_page === PAGES.length - 1 && _timer >= AUTO_START_FRAMES) {
      _finish(g, 'auto')
      return
    }
  }
  g._dirty = true
}

function render(g) {
  const c = V.ctx, W = V.W, H = V.H, S = V.S, R = V.R
  const page = PAGES[_page]

  c.save()
  c.globalAlpha = _pageFade

  // 全屏背景图
  const img = R.getImg(page.img)
  if (img && img.width > 0) {
    const imgRatio = img.width / img.height
    const scrRatio = W / H
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    if (imgRatio > scrRatio) {
      sw = img.height * scrRatio
      sx = (img.width - sw) / 2
    } else {
      sh = img.width / scrRatio
      sy = (img.height - sh) / 2
    }
    c.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
  } else {
    c.fillStyle = '#0b0b15'
    c.fillRect(0, 0, W, H)
  }

  // 底部渐变遮罩
  const maskH = H * 0.42
  const maskY = H - maskH
  const grad = c.createLinearGradient(0, maskY, 0, H)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.3, 'rgba(0,0,0,0.6)')
  grad.addColorStop(1, 'rgba(0,0,0,0.88)')
  c.fillStyle = grad
  c.fillRect(0, maskY, W, maskH)

  // 叙事文字
  const fontSize = 15 * S
  c.font = `bold ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`
  c.textAlign = 'center'
  const lineH = fontSize * 1.8
  const textStartY = H - maskH * 0.55

  for (let i = 0; i < page.lines.length; i++) {
    if (_lineAlpha[i] <= 0) continue
    c.save()
    c.globalAlpha = _pageFade * _lineAlpha[i]
    const ty = textStartY + i * lineH
    c.strokeStyle = 'rgba(0,0,0,0.8)'
    c.lineWidth = 3 * S
    c.lineJoin = 'round'
    c.strokeText(page.lines[i], W / 2, ty)
    c.fillStyle = '#fff'
    c.fillText(page.lines[i], W / 2, ty)
    c.restore()
  }

  // 翻页 / 按钮提示
  if (_allLinesShown && _fadeDir === 0) {
    const isLast = _page === PAGES.length - 1
    c.save()
    c.globalAlpha = _pageFade

    if (isLast) {
      // 真新用户优先开战：最后一页主 CTA 直接进序章爽局。
      const [bx, by, bw, bh] = _primaryBtnRect(W, H, S)
      const br = bh / 2  // 全圆角胶囊
      const pulse = 0.85 + 0.15 * Math.sin(_breathT * 2)

      // 外层光晕
      c.save()
      c.globalAlpha = _pageFade * 0.35 * pulse
      c.shadowColor = '#f5d06a'
      c.shadowBlur = 22 * S
      _roundRect(c, bx - 4 * S, by - 4 * S, bw + 8 * S, bh + 8 * S, br + 4 * S)
      c.fillStyle = '#c8900a'
      c.fill()
      c.restore()

      // 按钮主体渐变
      c.save()
      c.globalAlpha = _pageFade * pulse
      const grad = c.createLinearGradient(bx, by, bx, by + bh)
      grad.addColorStop(0, '#ffe27a')
      grad.addColorStop(0.45, '#d4860c')
      grad.addColorStop(1, '#9c5a00')
      _roundRect(c, bx, by, bw, bh, br)
      c.fillStyle = grad
      c.fill()

      // 顶部高光条
      const hlGrad = c.createLinearGradient(bx, by, bx, by + bh * 0.48)
      hlGrad.addColorStop(0, 'rgba(255,255,255,0.28)')
      hlGrad.addColorStop(1, 'rgba(255,255,255,0)')
      _roundRect(c, bx + 2 * S, by + 2 * S, bw - 4 * S, bh * 0.48, br)
      c.fillStyle = hlGrad
      c.fill()

      // 细边框
      _roundRect(c, bx, by, bw, bh, br)
      c.strokeStyle = 'rgba(255,220,100,0.6)'
      c.lineWidth = 1.5 * S
      c.stroke()
      c.restore()

      // 文字 + 文字阴影
      c.save()
      c.globalAlpha = _pageFade
      c.shadowColor = 'rgba(100,40,0,0.7)'
      c.shadowBlur = 4 * S
      c.fillStyle = '#fff8e8'
      c.font = `bold ${17 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
      c.textAlign = 'center'
      c.fillText('立即开打', W / 2, by + bh * 0.67)
      const remainSec = Math.max(1, Math.ceil((AUTO_START_FRAMES - _timer) / 60))
      c.shadowBlur = 0
      c.fillStyle = 'rgba(255,255,255,0.82)'
      c.font = `${12 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
      c.fillText(`${remainSec} 秒后自动开战`, W / 2, by + bh + 22 * S)
      c.restore()
    } else {
      const [bx, by, bw, bh] = _primaryBtnRect(W, H, S)
      const br = bh / 2
      const pulse = 0.9 + 0.1 * Math.sin(_breathT * 2)

      c.save()
      c.globalAlpha = _pageFade * pulse
      const grad = c.createLinearGradient(bx, by, bx, by + bh)
      grad.addColorStop(0, '#ffe27a')
      grad.addColorStop(1, '#b86b05')
      _roundRect(c, bx, by, bw, bh, br)
      c.fillStyle = grad
      c.fill()
      c.strokeStyle = 'rgba(255,230,130,0.62)'
      c.lineWidth = 1.2 * S
      c.stroke()
      c.restore()

      c.fillStyle = '#fff8e8'
      c.font = `bold ${16 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
      c.textAlign = 'center'
      c.fillText('立即开打', W / 2, by + bh * 0.66)
      c.fillStyle = 'rgba(255,255,255,0.82)'
      c.font = `${12 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
      c.fillText('点击画面继续看剧情', W / 2, H - 36 * S)
    }
    c.restore()
  }

  // 右上角 "跳过" 按钮
  c.save()
  c.globalAlpha = 0.6
  c.fillStyle = 'rgba(0,0,0,0.4)'
  const skipW = 60 * S, skipH = 30 * S
  const skipX = W - skipW - 15 * S, skipY = V.safeTop + 52 * S  // 下移避开微信胶囊
  R.rr(skipX, skipY, skipW, skipH, 8 * S)
  c.fill()
  c.fillStyle = '#fff'
  c.font = `${12 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText('跳过', skipX + skipW / 2, skipY + skipH * 0.68)
  c.restore()

  c.restore()
}

function onTouch(g, type, x, y) {
  if (type !== 'start') return

  const W = V.W, H = V.H, S = V.S

  // 跳过按钮（与 render 中位置一致，下移避开微信胶囊）
  const skipW = 60 * S, skipH = 30 * S
  const skipX = W - skipW - 15 * S, skipY = V.safeTop + 52 * S
  if (x >= skipX && x <= skipX + skipW && y >= skipY && y <= skipY + skipH) {
    _recordIntroEvent(g, 'intro_skip_click', { page: _page + 1 })
    _finish(g, 'skip')
    return
  }

  if (_fadeDir !== 0) return

  if (_allLinesShown) {
    if (_isInRect(x, y, _primaryBtnRect(W, H, S))) {
      _finish(g, _page === PAGES.length - 1 ? 'cta_last' : 'cta_fast_start')
      return
    }
    if (_page === PAGES.length - 1) {
      _finish(g, 'page_tap')
    } else {
      _recordIntroEvent(g, 'intro_next_click', { page: _page + 1 })
      _fadeDir = -1
    }
  }
}

function _finish(g, source) {
  if (_finished) return
  _finished = true
  V.P.setStorageSync('introDone', true)
  g.storage.markGuideShown('intro_done')
  if (g.storage.recordFunnelEvent) {
    g.storage.recordFunnelEvent('intro_finish', { scene: source || 'unknown' })
    g.storage.recordFunnelEvent('first_screen_show', { scene: 'intro_done' })
  }
  const MusicMgr = require('../runtime/music')
  MusicMgr.playBgm()

  // 真新用户直接进入 1-1 序章爽局，减少广告点击后的首战前流失。
  const shouldFastStart = g.storage
    && g.storage.petPoolCount === 0
    && !g.storage.isStageCleared('stage_1_1')
  if (shouldFastStart) {
    const stageMgr = require('../engine/stageManager')
    if (g.storage.recordFunnelEvent) {
      g.storage.recordFunnelEvent('newbie_prologue_prompt_show', { scene: 'intro_fast_start', stageId: 'newbie_prologue' })
    }
    if (stageMgr.startNewbiePrologue && stageMgr.startNewbiePrologue(g)) return
    if (g.storage.recordFunnelEvent) {
      g.storage.recordFunnelEvent('newbie_prologue_start_fail', {
        scene: 'intro_fast_start',
        reason: 'start_returned_false',
      })
    }
  }

  // 兜底：无法直达战斗时仍进入首页并触发原有新手秘境指引。
  g._pendingGuide = 'newbie_stage_start'
  g.setScene('title')
}

function _recordIntroEvent(g, eventId, params) {
  if (!g || !g.storage || !g.storage.recordFunnelEvent) return
  if (eventId === 'intro_show') {
    if (_introShowTracked) return
    _introShowTracked = true
  }
  g.storage.recordFunnelEvent(eventId, params || {})
}

function _primaryBtnRect(W, H, S) {
  const bw = 220 * S
  const bh = 52 * S
  return [(W - bw) / 2, H - 90 * S, bw, bh]
}

function _isInRect(x, y, rect) {
  return rect && x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

module.exports = { init, update, render, onTouch }
