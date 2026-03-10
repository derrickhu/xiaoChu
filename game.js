console.log('灵宠消消塔开始初始化...')

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
// 先画纯色兜底
const _bg = _ctx.createLinearGradient(0, 0, 0, _H)
_bg.addColorStop(0, '#0b0b15')
_bg.addColorStop(1, '#1a1035')
_ctx.fillStyle = _bg
_ctx.fillRect(0, 0, _W, _H)
// 加载主包内的 loading 背景图（不依赖分包）
const _splashImg = P.createImage()
_splashImg.src = 'loading_bg.jpg'
_splashImg.onload = () => {
  // 铺满整个 canvas（cover 模式）
  const iw = _splashImg.width, ih = _splashImg.height
  const scale = Math.max(_W / iw, _H / ih)
  const dw = iw * scale, dh = ih * scale
  _ctx.drawImage(_splashImg, (_W - dw) / 2, (_H - dh) / 2, dw, dh)
}

// 分包加载
let assetsLoaded = false
let audioLoaded = false

function tryStartGame() {
  if (!assetsLoaded || !audioLoaded) return
  console.log('[SubPkg] 分包全部加载完成，启动游戏')
  try {
    require('./js/main')
    console.log('游戏初始化成功')
  } catch (e) {
    console.error('游戏初始化失败:', e)
    const ctx = _canvas.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, _canvas.width, _canvas.height)
    ctx.fillStyle = '#f00'; ctx.font = '16px sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('游戏初始化失败', 20, 20)
    ctx.fillText(e.message, 20, 50)
    ctx.fillText(e.stack ? e.stack.substring(0,200) : '', 20, 80)
    P.showModal({ title: '初始化失败', content: e.message, showCancel: false })
  }
}

P.loadSubpackage({
  name: 'assets',
  success: () => {
    console.log('[SubPkg] assets 分包加载成功')
    assetsLoaded = true
    tryStartGame()
  },
  fail: (err) => {
    console.error('[SubPkg] assets 分包加载失败:', err)
    assetsLoaded = true
    tryStartGame()
  }
})

P.loadSubpackage({
  name: 'audio',
  success: () => {
    console.log('[SubPkg] audio 分包加载成功')
    audioLoaded = true
    tryStartGame()
  },
  fail: (err) => {
    console.error('[SubPkg] audio 分包加载失败:', err)
    audioLoaded = true
    tryStartGame()
  }
})
