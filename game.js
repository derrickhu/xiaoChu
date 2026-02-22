console.log('灵宠消消塔开始初始化...')

// 创建主Canvas并挂到全局，供main.js复用
const _canvas = wx.createCanvas()
GameGlobal.__mainCanvas = _canvas

// 立即填充背景色，然后加载主包内的 loading 背景图覆盖上去
const _ctx = _canvas.getContext('2d')
const _winInfo = wx.getWindowInfo()
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
const _splashImg = wx.createImage()
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
    ctx.fillText(e.stack?.substring(0,200), 20, 80)
    wx.showModal({ title: '初始化失败', content: e.message, showCancel: false })
  }
}

wx.loadSubpackage({
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

wx.loadSubpackage({
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
