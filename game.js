console.log('五行通天塔开始初始化...')

// ========== 临时上传代码 — 上传完成后删除 ==========
;(function uploadAssets() {
  wx.cloud.init({ env: 'cloud1-3gi97kso46c88f27', traceUser: true })
  const files = [
    // backgrounds
    'assets/backgrounds/loading_bg.jpg',
    'assets/backgrounds/shop_bg.jpg',
    'assets/backgrounds/adventure_bg.jpg',
    // UI
    'assets/ui/dialog_bg.png',
    'assets/ui/btn_continue.png',
    'assets/ui/btn_start.png',
    'assets/ui/btn_cancel.png',
    'assets/ui/btn_confirm.png',
    'assets/ui/btn_rank.png',
    // 头像框
    'assets/ui/frame_pet_metal.png',
    'assets/ui/frame_pet_wood.png',
    'assets/ui/frame_pet_water.png',
    'assets/ui/frame_pet_fire.png',
    'assets/ui/frame_pet_earth.png',
    'assets/ui/frame_weapon.png',
  ]
  let done = 0, fail = 0
  const total = files.length
  console.log(`[Upload] 开始上传 ${total} 个资源文件...`)
  files.forEach(f => {
    const cloudPath = f   // 云端路径与本地一致
    wx.cloud.uploadFile({
      cloudPath,
      filePath: f,
      success: res => { done++; console.log(`[Upload] ✓ ${f} (${done+fail}/${total})`) },
      fail: err => { fail++; console.warn(`[Upload] ✗ ${f}:`, err.errMsg) },
      complete: () => {
        if (done + fail >= total) {
          console.log(`[Upload] 全部完成！成功:${done} 失败:${fail}`)
          wx.showModal({ title: '上传完成', content: `成功:${done} 失败:${fail}`, showCancel: false })
        }
      }
    })
  })
})()
// ========== 临时上传代码结束 ==========

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
