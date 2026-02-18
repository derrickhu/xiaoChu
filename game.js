console.log('五行通天塔开始初始化...')

// 分包加载：assets 和 audio 目录作为分包，不占主包体积
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
    try {
      const canvas = wx.createCanvas()
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#f00'
      ctx.font = '16px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText('游戏初始化失败', 20, 20)
      ctx.fillText(e.message, 20, 50)
      ctx.fillText(e.stack?.substring(0,200), 20, 80)
    } catch (e2) {}
    wx.showModal({
      title: '初始化失败',
      content: e.message,
      showCancel: false
    })
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
    // 失败也继续启动（本地调试时资源可能已在主包）
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
