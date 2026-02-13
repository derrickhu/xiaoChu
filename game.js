console.log('龙珠战纪开始初始化...')
try {
  const Main = require('./js/main')
  console.log('Main模块加载成功')
  new Main()
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
    ctx.fillText(e.stack, 20, 80)
  } catch (e2) {}
  wx.showModal({
    title: '初始化失败',
    content: e.message,
    showCancel: false
  })
}
