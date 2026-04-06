console.log('灵宠消消塔开始初始化...')

// 全局错误监听
;(function () {
  if (typeof wx === 'undefined') return
  if (typeof wx.onError === 'function') {
    wx.onError(function (msg) { console.error('[Global]', msg) })
  }
})()

// 平台检测（game.js 在 require 之前执行，需内联检测）
const P = (typeof tt !== 'undefined') ? tt : wx
GameGlobal.__platform = P

// 侧边栏复访（抖音必接）：必须在 game.js 运行时机同步监听 onShow
GameGlobal.__launchInfo = {}
GameGlobal.__sidebarSupported = false
if (typeof P.onShow === 'function') {
  P.onShow(function (res) {
    console.log('[Sidebar] onShow:', JSON.stringify(res))
    GameGlobal.__launchInfo = res || {}
    if (res && res.query && res.query.inviter) {
      GameGlobal.__inviterId = res.query.inviter
    }
  })
}
if (typeof P.checkScene === 'function') {
  P.checkScene({
    scene: 'sidebar',
    success: function (res) {
      GameGlobal.__sidebarSupported = !!(res && res.isExist)
      console.log('[Sidebar] checkScene supported:', GameGlobal.__sidebarSupported)
    },
    fail: function () { GameGlobal.__sidebarSupported = false }
  })
}

// 兼容：抖音无 getWindowInfo，用 getSystemInfoSync 代替
function _getWinInfo() {
  if (typeof P.getWindowInfo === 'function') return P.getWindowInfo()
  const s = P.getSystemInfoSync()
  return { windowWidth: s.windowWidth || s.screenWidth, windowHeight: s.windowHeight || s.screenHeight, pixelRatio: s.pixelRatio || 2, safeArea: s.safeArea || { top: 0 } }
}

// 创建主Canvas并挂到全局，供main.js复用
const _canvas = P.createCanvas()
GameGlobal.__mainCanvas = _canvas

// 立即填充背景色，然后加载主包内的 loading 背景图覆盖上去
const _ctx = _canvas.getContext('2d')
const _winInfo = _getWinInfo()
const _dpr = _winInfo.pixelRatio || 2
_canvas.width = _winInfo.windowWidth * _dpr
_canvas.height = _winInfo.windowHeight * _dpr
const _W = _canvas.width, _H = _canvas.height

var _subPkgNames = [
  'pets', 'enemies', 'stage_enemies', 'stage_avatars', 'backgrounds', 'ui', 'hero',
  'share', 'equipment', 'battle', 'orbs', 'intro',
  'audio', 'audio_bgm'
]
var SUBPKG_ENTRY = {
  pets: './assets/pets/game.js',
  enemies: './assets/enemies/game.js',
  stage_enemies: './assets/stage_enemies/game.js',
  stage_avatars: './assets/stage_avatars/game.js',
  backgrounds: './assets/backgrounds/game.js',
  ui: './assets/ui/game.js',
  hero: './assets/hero/game.js',
  share: './assets/share/game.js',
  equipment: './assets/equipment/game.js',
  battle: './assets/battle/game.js',
  orbs: './assets/orbs/game.js',
  intro: './assets/intro/game.js',
  audio: './audio/game.js',
  audio_bgm: './audio_bgm/game.js'
}
var _totalPkgs = _subPkgNames.length
/** 已完成下载的分包数（并行加载时乱序完成，仅用于进度条） */
var _finishedSubPkgs = 0

// 先画纯色兜底
const _bg = _ctx.createLinearGradient(0, 0, 0, _H)
_bg.addColorStop(0, '#0b0b15')
_bg.addColorStop(1, '#1a1035')
_ctx.fillStyle = _bg
_ctx.fillRect(0, 0, _W, _H)
// loading 图（src 在 _drawBg / _drawProgress 定义之后再赋值，避免同步 onload 报错）
let _splashReady = false
const _splashImg = P.createImage()

// 绘制背景（背景图就绪时铺满 canvas，否则用渐变兜底）
function _drawBg() {
  if (_splashReady) {
    var iw = _splashImg.width, ih = _splashImg.height
    var scale = Math.max(_W / iw, _H / ih)
    var dw = iw * scale, dh = ih * scale
    _ctx.drawImage(_splashImg, (_W - dw) / 2, (_H - dh) / 2, dw, dh)
  } else {
    _ctx.fillStyle = _bg
    _ctx.fillRect(0, 0, _W, _H)
  }
}

// 绘制分包加载进度条（与 screens.js rLoading 风格一致）
function _drawProgress(pct) {
  var S = _dpr
  var barW = _W * 0.6
  var barH = 10 * S
  var barX = (_W - barW) / 2
  var barY = _H - 60 * S
  var r = barH / 2

  _ctx.save()

  // 底槽
  _ctx.beginPath()
  _roundRect(barX, barY, barW, barH, r)
  _ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  _ctx.fill()

  // 填充
  var fillW = Math.max(barH, barW * pct)
  if (pct > 0) {
    _ctx.beginPath()
    _roundRect(barX, barY, fillW, barH, r)
    var grad = _ctx.createLinearGradient(barX, barY, barX + fillW, barY)
    grad.addColorStop(0, '#f0a030')
    grad.addColorStop(0.5, '#ffd700')
    grad.addColorStop(1, '#ffe066')
    _ctx.fillStyle = grad
    _ctx.fill()

    // 高光
    _ctx.beginPath()
    _roundRect(barX, barY, fillW, barH * 0.45, r)
    _ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    _ctx.fill()
  }

  // 百分比文字
  var pctText = Math.round(pct * 100) + '%'
  _ctx.font = 'bold ' + (11 * S) + 'px "PingFang SC",sans-serif'
  _ctx.textAlign = 'right'
  _ctx.textBaseline = 'middle'
  _ctx.strokeStyle = '#000'
  _ctx.lineWidth = 3 * S
  _ctx.lineJoin = 'round'
  _ctx.strokeText(pctText, barX + barW, barY - 10 * S)
  _ctx.fillStyle = '#ffd700'
  _ctx.fillText(pctText, barX + barW, barY - 10 * S)

  // 提示文字
  _ctx.font = (12 * S) + 'px "PingFang SC",sans-serif'
  _ctx.textAlign = 'center'
  _ctx.strokeText('加载中...', _W / 2, barY - 28 * S)
  _ctx.fillStyle = '#fff'
  _ctx.fillText('加载中...', _W / 2, barY - 28 * S)

  _ctx.restore()
}

// Canvas 圆角矩形（兼容无 roundRect 的低版本）
function _roundRect(x, y, w, h, r) {
  _ctx.moveTo(x + r, y)
  _ctx.arcTo(x + w, y, x + w, y + h, r)
  _ctx.arcTo(x + w, y + h, x, y + h, r)
  _ctx.arcTo(x, y + h, x, y, r)
  _ctx.arcTo(x, y, x + w, y, r)
  _ctx.closePath()
}

// 分包加载：并行 download 全部子包（总耗时≈最慢几个包之和，明显快于串行累加），再按固定顺序 require 占位入口。
function _requireSubpkgEntry(name) {
  var rel = SUBPKG_ENTRY[name]
  if (!rel) return
  try {
    require(rel)
  } catch (e) {
    console.warn('[SubPkg] 分包入口 require 异常: ' + name, e)
  }
}

function _startGameFromMain() {
  console.log('[SubPkg] 全部 ' + _totalPkgs + ' 个分包已处理，启动游戏')
  try {
    require('./js/main')
    console.log('游戏初始化成功')
  } catch (e) {
    console.error('游戏初始化失败:', e)
    var ctx = _canvas.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, _canvas.width, _canvas.height)
    ctx.fillStyle = '#f00'; ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('游戏初始化失败', 20, 20)
    ctx.fillText(e.message, 20, 50)
    ctx.fillText(e.stack ? e.stack.substring(0, 200) : '', 20, 80)
    P.showModal({ title: '初始化失败', content: e.message, showCancel: false })
  }
}

function _loadAllSubpackagesParallel() {
  var need = _totalPkgs
  var started = false
  function onOneDone() {
    _finishedSubPkgs++
    _drawBg()
    _drawProgress(Math.min(_finishedSubPkgs, need) / need)
    if (_finishedSubPkgs < need || started) return
    started = true
    for (var i = 0; i < _subPkgNames.length; i++) {
      _requireSubpkgEntry(_subPkgNames[i])
    }
    _startGameFromMain()
  }
  for (var j = 0; j < _subPkgNames.length; j++) {
    ;(function (name) {
      P.loadSubpackage({
        name: name,
        success: function () {
          console.log('[SubPkg] ' + name + ' 加载成功')
          onOneDone()
        },
        fail: function () {
          console.warn('[SubPkg] ' + name + ' 加载失败')
          onOneDone()
        },
      })
    })(_subPkgNames[j])
  }
}

_splashImg.onload = function () {
  _splashReady = true
  _drawBg()
  _drawProgress(_finishedSubPkgs / _totalPkgs)
}
_splashImg.src = 'loading_bg.jpg'

_drawBg()
_drawProgress(0)
_loadAllSubpackagesParallel()
