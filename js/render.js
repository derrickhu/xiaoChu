/**
 * 渲染模块 - 适配修仙消消乐法宝系统
 * 纯Canvas 2D，支持图片缓存、动画、粒子
 */
const { ATTR_COLOR, ATTR_NAME, BEAD_ATTR_COLOR, BEAD_ATTR_NAME } = require('./data/tower')
// 旧装备系统兼容常量（渲染方法中仍有引用，提供空默认值）
const QUALITY = {}, EQUIP_SLOT = {}, STAT_DEFS = {}

// 属性配色（含心珠，渲染用）
const A = {}
Object.keys(BEAD_ATTR_COLOR).forEach(k => {
  const c = BEAD_ATTR_COLOR[k]
  A[k] = { bg:c.bg, main:c.main, lt:c.lt, dk:c.dk, ic:BEAD_ATTR_NAME[k],
    ltr:`${c.lt}88`, gw:c.main+'40', orb:c.main }
})

// 主题色
const TH = {
  bg:'#0b0b15', card:'rgba(22,22,38,0.92)', cardB:'rgba(60,60,90,0.3)',
  text:'#eee', sub:'rgba(200,200,210,0.7)', dim:'rgba(140,140,160,0.5)',
  accent:'#ffd700', danger:'#ff4d6a', success:'#4dcc4d', info:'#4dabff',
  hard:'#ff8c00', extreme:'#ff4d6a',
}

// 云存储文件ID前缀
const CLOUD_FILE_PREFIX = 'cloud://cloud1-9glro17fb6f566a8.636c-cloud1-9glro17fb6f566a8-1404581587/'

// 需要从云存储加载的资源映射：本地路径 → 云存储相对路径
// 将大体积资源放在云端，突破4MB包体限制
const CLOUD_ASSETS = {
  // 灵珠图片（云端加载）
  'assets/orbs/orb_metal.png': 'assets/orbs/orb_metal.png',
  'assets/orbs/orb_wood.png': 'assets/orbs/orb_wood.png',
  'assets/orbs/orb_earth.png': 'assets/orbs/orb_earth.png',
  'assets/orbs/orb_water.png': 'assets/orbs/orb_water.png',
  'assets/orbs/orb_fire.png': 'assets/orbs/orb_fire.png',
  'assets/orbs/orb_heart.png': 'assets/orbs/orb_heart.png',
  // 法宝图片（50件，云端加载，已压缩至512x512）
  'assets/equipment/fabao_w1.png': 'assets/equipment/fabao_w1.png',
  'assets/equipment/fabao_w2.png': 'assets/equipment/fabao_w2.png',
  'assets/equipment/fabao_w3.png': 'assets/equipment/fabao_w3.png',
  'assets/equipment/fabao_w4.png': 'assets/equipment/fabao_w4.png',
  'assets/equipment/fabao_w5.png': 'assets/equipment/fabao_w5.png',
  'assets/equipment/fabao_w6.png': 'assets/equipment/fabao_w6.png',
  'assets/equipment/fabao_w7.png': 'assets/equipment/fabao_w7.png',
  'assets/equipment/fabao_w8.png': 'assets/equipment/fabao_w8.png',
  'assets/equipment/fabao_w9.png': 'assets/equipment/fabao_w9.png',
  'assets/equipment/fabao_w10.png': 'assets/equipment/fabao_w10.png',
  'assets/equipment/fabao_w11.png': 'assets/equipment/fabao_w11.png',
  'assets/equipment/fabao_w12.png': 'assets/equipment/fabao_w12.png',
  'assets/equipment/fabao_w13.png': 'assets/equipment/fabao_w13.png',
  'assets/equipment/fabao_w14.png': 'assets/equipment/fabao_w14.png',
  'assets/equipment/fabao_w15.png': 'assets/equipment/fabao_w15.png',
  'assets/equipment/fabao_w16.png': 'assets/equipment/fabao_w16.png',
  'assets/equipment/fabao_w17.png': 'assets/equipment/fabao_w17.png',
  'assets/equipment/fabao_w18.png': 'assets/equipment/fabao_w18.png',
  'assets/equipment/fabao_w19.png': 'assets/equipment/fabao_w19.png',
  'assets/equipment/fabao_w20.png': 'assets/equipment/fabao_w20.png',
  'assets/equipment/fabao_w21.png': 'assets/equipment/fabao_w21.png',
  'assets/equipment/fabao_w22.png': 'assets/equipment/fabao_w22.png',
  'assets/equipment/fabao_w23.png': 'assets/equipment/fabao_w23.png',
  'assets/equipment/fabao_w24.png': 'assets/equipment/fabao_w24.png',
  'assets/equipment/fabao_w25.png': 'assets/equipment/fabao_w25.png',
  'assets/equipment/fabao_w26.png': 'assets/equipment/fabao_w26.png',
  'assets/equipment/fabao_w27.png': 'assets/equipment/fabao_w27.png',
  'assets/equipment/fabao_w28.png': 'assets/equipment/fabao_w28.png',
  'assets/equipment/fabao_w29.png': 'assets/equipment/fabao_w29.png',
  'assets/equipment/fabao_w30.png': 'assets/equipment/fabao_w30.png',
  'assets/equipment/fabao_w31.png': 'assets/equipment/fabao_w31.png',
  'assets/equipment/fabao_w32.png': 'assets/equipment/fabao_w32.png',
  'assets/equipment/fabao_w33.png': 'assets/equipment/fabao_w33.png',
  'assets/equipment/fabao_w34.png': 'assets/equipment/fabao_w34.png',
  'assets/equipment/fabao_w35.png': 'assets/equipment/fabao_w35.png',
  'assets/equipment/fabao_w36.png': 'assets/equipment/fabao_w36.png',
  'assets/equipment/fabao_w37.png': 'assets/equipment/fabao_w37.png',
  'assets/equipment/fabao_w38.png': 'assets/equipment/fabao_w38.png',
  'assets/equipment/fabao_w39.png': 'assets/equipment/fabao_w39.png',
  'assets/equipment/fabao_w40.png': 'assets/equipment/fabao_w40.png',
  'assets/equipment/fabao_w41.png': 'assets/equipment/fabao_w41.png',
  'assets/equipment/fabao_w42.png': 'assets/equipment/fabao_w42.png',
  'assets/equipment/fabao_w43.png': 'assets/equipment/fabao_w43.png',
  'assets/equipment/fabao_w44.png': 'assets/equipment/fabao_w44.png',
  'assets/equipment/fabao_w45.png': 'assets/equipment/fabao_w45.png',
  'assets/equipment/fabao_w46.png': 'assets/equipment/fabao_w46.png',
  'assets/equipment/fabao_w47.png': 'assets/equipment/fabao_w47.png',
  'assets/equipment/fabao_w48.png': 'assets/equipment/fabao_w48.png',
  'assets/equipment/fabao_w49.png': 'assets/equipment/fabao_w49.png',
  'assets/equipment/fabao_w50.png': 'assets/equipment/fabao_w50.png',
  // 宠物头像（99张，云端加载）
  'assets/pets/pet_e1.png': 'assets/pets/pet_e1.png',
  'assets/pets/pet_e2.png': 'assets/pets/pet_e2.png',
  'assets/pets/pet_e3.png': 'assets/pets/pet_e3.png',
  'assets/pets/pet_e4.png': 'assets/pets/pet_e4.png',
  'assets/pets/pet_e5.png': 'assets/pets/pet_e5.png',
  'assets/pets/pet_e6.png': 'assets/pets/pet_e6.png',
  'assets/pets/pet_e7.png': 'assets/pets/pet_e7.png',
  'assets/pets/pet_e8.png': 'assets/pets/pet_e8.png',
  'assets/pets/pet_e9.png': 'assets/pets/pet_e9.png',
  'assets/pets/pet_e10.png': 'assets/pets/pet_e10.png',
  'assets/pets/pet_e11.png': 'assets/pets/pet_e11.png',
  'assets/pets/pet_e12.png': 'assets/pets/pet_e12.png',
  'assets/pets/pet_e13.png': 'assets/pets/pet_e13.png',
  'assets/pets/pet_e14.png': 'assets/pets/pet_e14.png',
  'assets/pets/pet_e15.png': 'assets/pets/pet_e15.png',
  'assets/pets/pet_e16.png': 'assets/pets/pet_e16.png',
  'assets/pets/pet_e17.png': 'assets/pets/pet_e17.png',
  'assets/pets/pet_e18.png': 'assets/pets/pet_e18.png',
  'assets/pets/pet_e19.png': 'assets/pets/pet_e19.png',
  'assets/pets/pet_e20.png': 'assets/pets/pet_e20.png',
  'assets/pets/pet_f1.png': 'assets/pets/pet_f1.png',
  'assets/pets/pet_f2.png': 'assets/pets/pet_f2.png',
  'assets/pets/pet_f3.png': 'assets/pets/pet_f3.png',
  'assets/pets/pet_f4.png': 'assets/pets/pet_f4.png',
  'assets/pets/pet_f5.png': 'assets/pets/pet_f5.png',
  'assets/pets/pet_f6.png': 'assets/pets/pet_f6.png',
  'assets/pets/pet_f7.png': 'assets/pets/pet_f7.png',
  'assets/pets/pet_f8.png': 'assets/pets/pet_f8.png',
  'assets/pets/pet_f9.png': 'assets/pets/pet_f9.png',
  'assets/pets/pet_f10.png': 'assets/pets/pet_f10.png',
  'assets/pets/pet_f11.png': 'assets/pets/pet_f11.png',
  'assets/pets/pet_f12.png': 'assets/pets/pet_f12.png',
  'assets/pets/pet_f13.png': 'assets/pets/pet_f13.png',
  'assets/pets/pet_f14.png': 'assets/pets/pet_f14.png',
  'assets/pets/pet_f15.png': 'assets/pets/pet_f15.png',
  'assets/pets/pet_f16.png': 'assets/pets/pet_f16.png',
  'assets/pets/pet_f17.png': 'assets/pets/pet_f17.png',
  'assets/pets/pet_f18.png': 'assets/pets/pet_f18.png',
  'assets/pets/pet_f19.png': 'assets/pets/pet_f19.png',
  'assets/pets/pet_f20.png': 'assets/pets/pet_f20.png',
  'assets/pets/pet_m1.png': 'assets/pets/pet_m1.png',
  'assets/pets/pet_m2.png': 'assets/pets/pet_m2.png',
  'assets/pets/pet_m3.png': 'assets/pets/pet_m3.png',
  'assets/pets/pet_m4.png': 'assets/pets/pet_m4.png',
  'assets/pets/pet_m5.png': 'assets/pets/pet_m5.png',
  'assets/pets/pet_m6.png': 'assets/pets/pet_m6.png',
  'assets/pets/pet_m7.png': 'assets/pets/pet_m7.png',
  'assets/pets/pet_m8.png': 'assets/pets/pet_m8.png',
  'assets/pets/pet_m9.png': 'assets/pets/pet_m9.png',
  'assets/pets/pet_m10.png': 'assets/pets/pet_m10.png',
  'assets/pets/pet_m11.png': 'assets/pets/pet_m11.png',
  'assets/pets/pet_m12.png': 'assets/pets/pet_m12.png',
  'assets/pets/pet_m13.png': 'assets/pets/pet_m13.png',
  'assets/pets/pet_m14.png': 'assets/pets/pet_m14.png',
  'assets/pets/pet_m15.png': 'assets/pets/pet_m15.png',
  'assets/pets/pet_m16.png': 'assets/pets/pet_m16.png',
  'assets/pets/pet_m17.png': 'assets/pets/pet_m17.png',
  'assets/pets/pet_m18.png': 'assets/pets/pet_m18.png',
  'assets/pets/pet_m19.png': 'assets/pets/pet_m19.png',
  'assets/pets/pet_m20.png': 'assets/pets/pet_m20.png',
  'assets/pets/pet_s1.png': 'assets/pets/pet_s1.png',
  'assets/pets/pet_s2.png': 'assets/pets/pet_s2.png',
  'assets/pets/pet_s3.png': 'assets/pets/pet_s3.png',
  'assets/pets/pet_s4.png': 'assets/pets/pet_s4.png',
  'assets/pets/pet_s5.png': 'assets/pets/pet_s5.png',
  'assets/pets/pet_s6.png': 'assets/pets/pet_s6.png',
  'assets/pets/pet_s7.png': 'assets/pets/pet_s7.png',
  'assets/pets/pet_s8.png': 'assets/pets/pet_s8.png',
  'assets/pets/pet_s9.png': 'assets/pets/pet_s9.png',
  'assets/pets/pet_s10.png': 'assets/pets/pet_s10.png',
  'assets/pets/pet_s11.png': 'assets/pets/pet_s11.png',
  'assets/pets/pet_s12.png': 'assets/pets/pet_s12.png',
  'assets/pets/pet_s13.png': 'assets/pets/pet_s13.png',
  'assets/pets/pet_s14.png': 'assets/pets/pet_s14.png',
  'assets/pets/pet_s15.png': 'assets/pets/pet_s15.png',
  'assets/pets/pet_s16.png': 'assets/pets/pet_s16.png',
  'assets/pets/pet_s17.png': 'assets/pets/pet_s17.png',
  'assets/pets/pet_s18.png': 'assets/pets/pet_s18.png',
  'assets/pets/pet_s19.png': 'assets/pets/pet_s19.png',
  'assets/pets/pet_s20.png': 'assets/pets/pet_s20.png',
  'assets/pets/pet_w1.png': 'assets/pets/pet_w1.png',
  'assets/pets/pet_w2.png': 'assets/pets/pet_w2.png',
  'assets/pets/pet_w3.png': 'assets/pets/pet_w3.png',
  'assets/pets/pet_w4.png': 'assets/pets/pet_w4.png',
  'assets/pets/pet_w5.png': 'assets/pets/pet_w5.png',
  'assets/pets/pet_w6.png': 'assets/pets/pet_w6.png',
  'assets/pets/pet_w7.png': 'assets/pets/pet_w7.png',
  'assets/pets/pet_w8.png': 'assets/pets/pet_w8.png',
  'assets/pets/pet_w9.png': 'assets/pets/pet_w9.png',
  'assets/pets/pet_w10.png': 'assets/pets/pet_w10.png',
  'assets/pets/pet_w11.png': 'assets/pets/pet_w11.png',
  'assets/pets/pet_w12.png': 'assets/pets/pet_w12.png',
  'assets/pets/pet_w13.png': 'assets/pets/pet_w13.png',
  'assets/pets/pet_w14.png': 'assets/pets/pet_w14.png',
  'assets/pets/pet_w15.png': 'assets/pets/pet_w15.png',
  'assets/pets/pet_w16.png': 'assets/pets/pet_w16.png',
  'assets/pets/pet_w17.png': 'assets/pets/pet_w17.png',
  'assets/pets/pet_w18.png': 'assets/pets/pet_w18.png',
  'assets/pets/pet_w19.png': 'assets/pets/pet_w19.png',
  'assets/pets/pet_w20.png': 'assets/pets/pet_w20.png',
  // 敌人图片（26张，云端加载）
  'assets/enemies/enemy_metal_1.jpg': 'assets/enemies/enemy_metal_1.jpg',
  'assets/enemies/enemy_metal_2.jpg': 'assets/enemies/enemy_metal_2.jpg',
  'assets/enemies/enemy_metal_3.jpg': 'assets/enemies/enemy_metal_3.jpg',
  'assets/enemies/enemy_wood_1.jpg': 'assets/enemies/enemy_wood_1.jpg',
  'assets/enemies/enemy_wood_2.jpg': 'assets/enemies/enemy_wood_2.jpg',
  'assets/enemies/enemy_wood_3.jpg': 'assets/enemies/enemy_wood_3.jpg',
  'assets/enemies/enemy_earth_1.jpg': 'assets/enemies/enemy_earth_1.jpg',
  'assets/enemies/enemy_earth_2.jpg': 'assets/enemies/enemy_earth_2.jpg',
  'assets/enemies/enemy_earth_3.jpg': 'assets/enemies/enemy_earth_3.jpg',
  'assets/enemies/enemy_water_1.jpg': 'assets/enemies/enemy_water_1.jpg',
  'assets/enemies/enemy_water_2.jpg': 'assets/enemies/enemy_water_2.jpg',
  'assets/enemies/enemy_water_3.jpg': 'assets/enemies/enemy_water_3.jpg',
  'assets/enemies/enemy_fire_1.jpg': 'assets/enemies/enemy_fire_1.jpg',
  'assets/enemies/enemy_fire_2.jpg': 'assets/enemies/enemy_fire_2.jpg',
  'assets/enemies/enemy_fire_3.jpg': 'assets/enemies/enemy_fire_3.jpg',
  'assets/enemies/enemy_dark_1.jpg': 'assets/enemies/enemy_dark_1.jpg',
  'assets/enemies/enemy_dark_2.jpg': 'assets/enemies/enemy_dark_2.jpg',
  'assets/enemies/enemy_dark_3.jpg': 'assets/enemies/enemy_dark_3.jpg',
  'assets/enemies/enemy_light_1.jpg': 'assets/enemies/enemy_light_1.jpg',
  'assets/enemies/enemy_light_2.jpg': 'assets/enemies/enemy_light_2.jpg',
  'assets/enemies/enemy_light_3.jpg': 'assets/enemies/enemy_light_3.jpg',
  'assets/enemies/enemy_heart_1.jpg': 'assets/enemies/enemy_heart_1.jpg',
  'assets/enemies/enemy_heart_2.jpg': 'assets/enemies/enemy_heart_2.jpg',
  'assets/enemies/enemy_heart_3.jpg': 'assets/enemies/enemy_heart_3.jpg',
  'assets/enemies/enemy_mixed_1.jpg': 'assets/enemies/enemy_mixed_1.jpg',
  'assets/enemies/enemy_mixed_2.jpg': 'assets/enemies/enemy_mixed_2.jpg',
  // 精英战斗背景（15张，5属性×3张）
  'assets/enemies/bg_elite_m_1.jpg': 'assets/enemies/bg_elite_m_1.jpg',
  'assets/enemies/bg_elite_m_2.jpg': 'assets/enemies/bg_elite_m_2.jpg',
  'assets/enemies/bg_elite_m_3.jpg': 'assets/enemies/bg_elite_m_3.jpg',
  'assets/enemies/bg_elite_w_1.jpg': 'assets/enemies/bg_elite_w_1.jpg',
  'assets/enemies/bg_elite_w_2.jpg': 'assets/enemies/bg_elite_w_2.jpg',
  'assets/enemies/bg_elite_w_3.jpg': 'assets/enemies/bg_elite_w_3.jpg',
  'assets/enemies/bg_elite_s_1.jpg': 'assets/enemies/bg_elite_s_1.jpg',
  'assets/enemies/bg_elite_s_2.jpg': 'assets/enemies/bg_elite_s_2.jpg',
  'assets/enemies/bg_elite_s_3.jpg': 'assets/enemies/bg_elite_s_3.jpg',
  'assets/enemies/bg_elite_f_1.jpg': 'assets/enemies/bg_elite_f_1.jpg',
  'assets/enemies/bg_elite_f_2.jpg': 'assets/enemies/bg_elite_f_2.jpg',
  'assets/enemies/bg_elite_f_3.jpg': 'assets/enemies/bg_elite_f_3.jpg',
  'assets/enemies/bg_elite_e_1.jpg': 'assets/enemies/bg_elite_e_1.jpg',
  'assets/enemies/bg_elite_e_2.jpg': 'assets/enemies/bg_elite_e_2.jpg',
  'assets/enemies/bg_elite_e_3.jpg': 'assets/enemies/bg_elite_e_3.jpg',
  // BOSS战斗背景（10张）
  'assets/enemies/bg_boss_1.jpg': 'assets/enemies/bg_boss_1.jpg',
  'assets/enemies/bg_boss_2.jpg': 'assets/enemies/bg_boss_2.jpg',
  'assets/enemies/bg_boss_3.jpg': 'assets/enemies/bg_boss_3.jpg',
  'assets/enemies/bg_boss_4.jpg': 'assets/enemies/bg_boss_4.jpg',
  'assets/enemies/bg_boss_5.jpg': 'assets/enemies/bg_boss_5.jpg',
  'assets/enemies/bg_boss_6.jpg': 'assets/enemies/bg_boss_6.jpg',
  'assets/enemies/bg_boss_7.jpg': 'assets/enemies/bg_boss_7.jpg',
  'assets/enemies/bg_boss_8.jpg': 'assets/enemies/bg_boss_8.jpg',
  'assets/enemies/bg_boss_9.jpg': 'assets/enemies/bg_boss_9.jpg',
  'assets/enemies/bg_boss_10.jpg': 'assets/enemies/bg_boss_10.jpg',
}

class Render {
  constructor(ctx, W, H, S, safeTop) {
    this.ctx = ctx; this.W = W; this.H = H; this.S = S; this.safeTop = safeTop
    this._imgCache = {}
    this._cloudUrlCache = {}   // fileID → tempURL 缓存
    this._cloudLoading = {}    // 正在加载的云资源标记（防重复请求）
    // 背景星点
    this.bgStars = Array.from({length:40}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: 0.5+Math.random()*1.5, sp: 0.3+Math.random()*0.7, ph: Math.random()*6.28
    }))
  }

  // ===== 云存储预加载 =====
  // 在wx.cloud初始化完成后调用，批量获取云资源临时链接
  // onDone(successCount, failCount) 全部完成后回调
  preloadCloudAssets(onProgress, onDone) {
    this._cloudAssetsReady = false
    const total = Object.keys(CLOUD_ASSETS).length
    const fileList = Object.values(CLOUD_ASSETS).map(p => CLOUD_FILE_PREFIX + p)
    if (fileList.length === 0) { this._cloudAssetsReady = true; onDone && onDone(0,0); return }
    console.log('[Cloud] 开始预加载云资源, 数量:', total)
    
    const MAX_BATCH_SIZE = 50
    let urlCount = 0, failedCount = 0, loadedCount = 0, batchIndex = 0
    
    const checkAllLoaded = () => {
      if (loadedCount + failedCount >= total) {
        this._cloudAssetsReady = true
        console.log(`[Cloud] 全部图片加载完成, 成功:${loadedCount}, 失败:${failedCount}`)
        onDone && onDone(loadedCount, failedCount)
      }
      onProgress && onProgress(loadedCount, failedCount, total)
    }
    
    const processNextBatch = () => {
      const start = batchIndex * MAX_BATCH_SIZE
      const end = Math.min(start + MAX_BATCH_SIZE, fileList.length)
      const batch = fileList.slice(start, end)
      
      if (batch.length === 0) return
      
      wx.cloud.getTempFileURL({
        fileList: batch,
        success: (res) => {
          if (!res.fileList) return
          res.fileList.forEach(item => {
            if (item.status === 0 && item.tempFileURL) {
              this._cloudUrlCache[item.fileID] = item.tempFileURL
              const localPath = this._fileIdToLocalPath(item.fileID)
              if (localPath && !this._imgCache[localPath]) {
                const img = wx.createImage()
                img.onload = () => { this._imgCache[localPath] = img; loadedCount++; checkAllLoaded() }
                img.onerror = () => { failedCount++; checkAllLoaded() }
                img.src = item.tempFileURL
              } else {
                loadedCount++; checkAllLoaded()
              }
              urlCount++
            } else {
              console.warn('[Cloud] 文件不存在:', item.fileID.split('/').pop(), item.errMsg)
              failedCount++; checkAllLoaded()
            }
          })
          batchIndex++
          processNextBatch()
        },
        fail: (err) => {
          console.warn(`[Cloud] 批次${batchIndex + 1}请求失败:`, err)
          const batchSize = batch.length
          failedCount += batchSize; checkAllLoaded()
          batchIndex++
          processNextBatch()
        }
      })
    }
    
    processNextBatch()
  }

  // fileID → 本地路径的反向映射
  _fileIdToLocalPath(fileID) {
    for (const [local, cloud] of Object.entries(CLOUD_ASSETS)) {
      if (fileID === CLOUD_FILE_PREFIX + cloud) return local
    }
    return null
  }

  // ===== 基础绘制 =====
  rr(x,y,w,h,r) {
    const c = this.ctx
    c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r)
    c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h)
    c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath()
  }

  getImg(path) {
    // 已有缓存直接返回（无论是本地还是云端加载的）
    if (this._imgCache[path]) return this._imgCache[path]
    // 如果是云存储资源，走异步加载
    if (CLOUD_ASSETS[path]) {
      this._loadCloudImg(path)
      // 返回一个空占位，等云端加载完毕后下一帧自动渲染
      return null
    }
    // 本地资源
    const img = wx.createImage()
    img.src = path
    this._imgCache[path] = img
    return img
  }

  // 异步加载云存储图片
  _loadCloudImg(localPath) {
    if (this._cloudLoading[localPath]) return
    this._cloudLoading[localPath] = true
    const fileID = CLOUD_FILE_PREFIX + CLOUD_ASSETS[localPath]
    if (this._cloudUrlCache[fileID]) {
      const img = wx.createImage()
      img.onload = () => { this._imgCache[localPath] = img; delete this._cloudLoading[localPath] }
      img.onerror = () => {
        delete this._cloudLoading[localPath]
        delete this._cloudUrlCache[fileID]
      }
      img.src = this._cloudUrlCache[fileID]
      return
    }
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res) => {
        const item = res.fileList && res.fileList[0]
        if (item && item.status === 0 && item.tempFileURL) {
          this._cloudUrlCache[fileID] = item.tempFileURL
          const img = wx.createImage()
          img.onload = () => { this._imgCache[localPath] = img; delete this._cloudLoading[localPath] }
          img.onerror = () => {
            console.warn('[Cloud] 图片加载失败:', localPath)
            delete this._cloudLoading[localPath]
          }
          img.src = item.tempFileURL
        } else {
          console.warn('[Cloud] 获取链接失败:', localPath, item?.errMsg)
          delete this._cloudLoading[localPath]
        }
      },
      fail: (err) => {
        console.warn('[Cloud] getTempFileURL失败:', localPath, err)
        delete this._cloudLoading[localPath]
      }
    })
  }

  // ===== 背景 =====
  drawBg(frame) {
    const {ctx:c,W,H,S} = this
    const g = c.createLinearGradient(0,0,0,H)
    g.addColorStop(0,'#0d0d1a'); g.addColorStop(0.5,'#141428'); g.addColorStop(1,'#0a0a14')
    c.fillStyle = g; c.fillRect(0,0,W,H)
    const t = frame*0.01
    this.bgStars.forEach(s => {
      c.fillStyle = `rgba(255,255,255,${0.15+0.2*Math.sin(t*s.sp*5+s.ph)})`
      c.beginPath(); c.arc(s.x,(s.y+frame*s.sp*0.3)%H,s.r*S,0,Math.PI*2); c.fill()
    })
  }

  drawHomeBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
    } else {
      const g = c.createLinearGradient(0,0,0,H)
      g.addColorStop(0,'#1a1035'); g.addColorStop(0.5,'#0d0d2a'); g.addColorStop(1,'#050510')
      c.fillStyle = g; c.fillRect(0,0,W,H)
    }

  }

  drawLoadingBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/loading_bg.png')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      c.drawImage(img,(W-iw*scale)/2,(H-ih*scale)/2,iw*scale,ih*scale)
    } else {
      this.drawBg(frame)
    }
  }

  drawShopBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/shop_bg.png')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      c.drawImage(img,(W-iw*scale)/2,(H-ih*scale)/2,iw*scale,ih*scale)
      c.save(); c.globalAlpha=0.35; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawAdventureBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/adventure_bg.png')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      c.drawImage(img,(W-iw*scale)/2,(H-ih*scale)/2,iw*scale,ih*scale)
      c.save(); c.globalAlpha=0.35; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  // 各主题的背景色调配置
  static THEME_BG = {
    theme_metal: { top:'#1a1520', mid:'#2a2035', bot:'#0e0b12', accent:'#c0a060', particle:'#ffd700' },
    theme_wood:  { top:'#0d1a0d', mid:'#1a2e1a', bot:'#081208', accent:'#5daf5d', particle:'#90ee90' },
    theme_earth: { top:'#1a1510', mid:'#2e2518', bot:'#120e08', accent:'#c8a060', particle:'#deb887' },
    theme_water: { top:'#0a1220', mid:'#152535', bot:'#080e18', accent:'#4090d0', particle:'#87ceeb' },
    theme_fire:  { top:'#200a0a', mid:'#351515', bot:'#180808', accent:'#d05040', particle:'#ff6347' },
    theme_mixed: { top:'#150a1a', mid:'#251535', bot:'#100818', accent:'#a050c0', particle:'#da70d6' },
  }

  drawBattleBg(frame, themeBg) {
    const {ctx:c,W,H,S} = this
    // 下半部（棋盘区）纯暗色背景，不用背景图
    const bg = c.createLinearGradient(0,0,0,H)
    bg.addColorStop(0,'#0e0b15'); bg.addColorStop(0.5,'#161220'); bg.addColorStop(1,'#0a0810')
    c.fillStyle = bg; c.fillRect(0,0,W,H)
  }

  /** 绘制怪物区主题背景（仅覆盖怪物区域） */
  drawEnemyAreaBg(frame, themeBg, areaTop, areaBottom, battleTheme, customBg) {
    const {ctx:c,W,S} = this
    const theme = Render.THEME_BG[themeBg] || Render.THEME_BG.theme_metal
    const areaH = areaBottom - areaTop

    // 优先使用Boss/精英专属背景，其次按属性匹配
    let bgImg = null
    if (customBg) {
      bgImg = this.getImg(`assets/${customBg}.jpg`)
      if (!bgImg || !bgImg.width) bgImg = null
    }
    if (!bgImg && battleTheme) {
      bgImg = this.getImg(`assets/battle/battle_${battleTheme}.jpg`)
      if (!bgImg || !bgImg.width) bgImg = null
    }
    if (!bgImg) bgImg = this.getImg('assets/battle/battle_metal.jpg')
    if (bgImg && bgImg.width > 0) {
      c.save()
      c.beginPath(); c.rect(0, areaTop, W, areaH); c.clip()
      // 图片底部对齐技能栏上方，顶部向上延伸（上方可留空显示关卡信息）
      const imgScale = W / bgImg.width
      const drawH = bgImg.height * imgScale
      const drawY = areaBottom - drawH  // 底部对齐 areaBottom
      c.drawImage(bgImg, 0, drawY, W, drawH)
      // 轻微暗化遮罩，让怪物和UI更清晰
      c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, areaTop, W, areaH)
      // 底部渐变过渡（让图片底边自然融入技能栏）
      const fadeH = areaH * 0.2
      const fadeG = c.createLinearGradient(0, areaBottom - fadeH, 0, areaBottom)
      fadeG.addColorStop(0, 'transparent')
      fadeG.addColorStop(1, 'rgba(0,0,0,0.5)')
      c.fillStyle = fadeG
      c.fillRect(0, areaBottom - fadeH, W, fadeH)
      c.restore()
    } else {
      // 降级：渐变背景
      c.save()
      const bg = c.createLinearGradient(0, areaTop, 0, areaBottom)
      bg.addColorStop(0, theme.top)
      bg.addColorStop(0.5, theme.mid)
      bg.addColorStop(1, theme.bot)
      c.fillStyle = bg
      c.fillRect(0, areaTop, W, areaH)
      c.restore()
    }
  }

  drawLevelBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
      c.save(); c.globalAlpha=0.25; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  drawEquipBg(frame) {
    const {ctx:c,W,H} = this
    const img = this.getImg('assets/backgrounds/home_bg.jpg')
    if (img && img.width > 0) {
      const iw=img.width, ih=img.height, scale=Math.max(W/iw,H/ih)
      const dw=iw*scale, dh=ih*scale
      c.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)
      c.save(); c.globalAlpha=0.25; c.fillStyle='#000'; c.fillRect(0,0,W,H); c.restore()
    } else {
      this.drawBg(frame)
    }
  }

  // ===== 顶部栏 =====
  drawTopBar(title, showBack) {
    const {ctx:c,W,S,safeTop:st} = this, barH = st+44*S
    const g = c.createLinearGradient(0,0,0,barH)
    g.addColorStop(0,'rgba(8,8,20,0.85)'); g.addColorStop(1,'rgba(8,8,20,0.6)')
    c.fillStyle = g; c.fillRect(0,0,W,barH)
    // 底线
    c.strokeStyle='rgba(255,255,255,0.06)'; c.lineWidth=1
    c.beginPath(); c.moveTo(0,barH); c.lineTo(W,barH); c.stroke()
    // 标题
    c.fillStyle=TH.text; c.font=`bold ${17*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(title,W/2,st+22*S)
    // 返回
    if (showBack) {
      c.fillStyle=TH.accent; c.font=`${20*S}px "PingFang SC",sans-serif`
      c.textAlign='left'; c.fillText('‹',14*S,st+22*S)
      c.font=`${13*S}px "PingFang SC",sans-serif`; c.fillText('返回',28*S,st+22*S)
    }
  }

  // ===== 灵珠 =====
  drawBead(x,y,r,attr,frame) {
    const {ctx:c,S} = this
    const a = A[attr]
    if (!a) return
    const img = this.getImg(`assets/orbs/orb_${attr}.png`)
    if (img && img.width > 0) {
      // 圆形裁剪：只显示球体，隐藏背景色
      c.save()
      c.imageSmoothingEnabled = true
      c.imageSmoothingQuality = 'high'
      c.beginPath(); c.arc(x, y, r, 0, Math.PI*2); c.clip()
      // 1:1绘制，珠子图案刚好填满圆形裁剪区域
      const sz = r * 2
      c.drawImage(img, x - sz/2, y - sz/2, sz, sz)
      c.restore()
    } else {
      // 降级渐变球体
      const g = c.createRadialGradient(x-r*0.25,y-r*0.3,r*0.1,x,y,r)
      g.addColorStop(0,a.lt); g.addColorStop(0.7,a.main); g.addColorStop(1,a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
      c.fillStyle='rgba(255,255,255,0.35)'
      c.beginPath(); c.ellipse(x-r*0.15,y-r*0.25,r*0.45,r*0.3,0,0,Math.PI*2); c.fill()
    }
    // 外发光
    if (frame !== undefined) {
      c.save(); c.globalAlpha = 0.15 + 0.08*Math.sin((frame||0)*0.06)
      c.strokeStyle = a.main; c.lineWidth = 2*S
      c.beginPath(); c.arc(x,y,r+1*S,0,Math.PI*2); c.stroke()
      c.restore()
    }
  }

  // ===== 敌人 =====
  drawEnemy(x,y,r,attr,hp,maxHp,name,avatar,frame,opts) {
    const {ctx:c,S} = this
    const a = A[attr]
    const hideLabel = opts && opts.hideLabel  // 隐藏名字和HP条
    // 脉冲光环
    const pulse = 1 + 0.04*Math.sin((frame||0)*0.05)
    c.save(); c.globalAlpha=0.25
    c.strokeStyle=a.main; c.lineWidth=3*S*pulse
    c.beginPath(); c.arc(x,y,r+4*S,0,Math.PI*2); c.stroke()
    c.restore()
    // 图片或渐变
    const img = avatar ? this.getImg(avatar) : null
    if (img && img.width > 0) {
      c.save(); c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.clip()
      c.drawImage(img,x-r,y-r,r*2,r*2); c.restore()
    } else {
      const g = c.createRadialGradient(x,y-r*0.3,r*0.1,x,y,r)
      g.addColorStop(0,a.lt); g.addColorStop(1,a.dk)
      c.fillStyle=g; c.beginPath(); c.arc(x,y,r,0,Math.PI*2); c.fill()
    }
    if (!hideLabel) {
      // 名字
      c.fillStyle=TH.text; c.font=`bold ${12*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='top'; c.fillText(name||'敌人',x,y+r+6*S)
      // HP条
      this.drawHp(x-r,y+r+22*S,r*2,5*S,hp,maxHp,a.main)
    }
  }

  // ===== HP条（立体槽+发光填充+掉血灰色残影+数值） =====
  // showNum: 是否在条上显示 hp/maxHp 数值; shield: 护盾值; hpGain: 加血动画
  drawHp(x,y,w,h,hp,maxHp,color,hpLoss,showNum,numColor,shield,hpGain) {
    const {ctx:c,S} = this
    const pct = Math.max(0,Math.min(1,hp/maxHp))
    // 凹槽背景
    c.save()
    c.fillStyle='rgba(0,0,0,0.5)'; this.rr(x,y,w,h,h/2); c.fill()
    // 内阴影
    c.save(); c.globalAlpha=0.3
    const ig=c.createLinearGradient(x,y,x,y+h*0.4)
    ig.addColorStop(0,'rgba(0,0,0,0.4)'); ig.addColorStop(1,'rgba(0,0,0,0)')
    c.fillStyle=ig; this.rr(x,y,w,h*0.4,h/2); c.fill()
    c.restore()

    // 掉血灰色残影（在当前血量之前绘制）
    if (hpLoss && hpLoss.fromPct > pct) {
      const totalFrames = 45
      const t = hpLoss.timer / totalFrames
      let lossPct
      if (hpLoss.timer <= 15) {
        lossPct = hpLoss.fromPct
      } else {
        const shrinkT = (hpLoss.timer - 15) / (totalFrames - 15)
        const ease = shrinkT * shrinkT
        lossPct = hpLoss.fromPct + (pct - hpLoss.fromPct) * ease
      }
      const alpha = t < 0.7 ? 0.6 : 0.6 * (1 - (t-0.7)/0.3)
      c.save(); c.globalAlpha = alpha
      c.fillStyle = 'rgba(180,180,180,0.8)'
      this.rr(x, y, w*lossPct, h, h/2); c.fill()
      c.restore()
    }

    // 加血绿色底层（先画绿色增量，再画粉色血条覆盖到旧血量位置，增量部分露出绿色）
    const gainActive = hpGain && hpGain.fromPct < pct
    if (gainActive) {
      const greenAlpha = hpGain.timer <= 15 ? 1 : Math.max(0, 1 - (hpGain.timer - 15) / 25)
      // 绿色增量条（fromPct → pct）
      c.save(); c.globalAlpha = greenAlpha
      const gg = c.createLinearGradient(x, y, x, y+h)
      gg.addColorStop(0, '#6eff6e'); gg.addColorStop(0.5, '#4dcc4d'); gg.addColorStop(1, '#2d9a2d')
      c.fillStyle = gg
      this.rr(x, y, w*pct, h, h/2); c.fill()
      // 绿色高光
      c.globalAlpha = greenAlpha * 0.4
      c.fillStyle = '#fff'
      this.rr(x+2*S, y+1, w*pct-4*S, h*0.35, h/4); c.fill()
      c.restore()
    }

    if (pct > 0) {
      const barColor = color || (pct>0.5?TH.success:pct>0.2?TH.hard:TH.danger)
      const fg=c.createLinearGradient(x,y,x,y+h)
      fg.addColorStop(0,this._lighten(barColor,0.15)); fg.addColorStop(0.5,barColor); fg.addColorStop(1,this._darken(barColor))
      // 加血动画中：粉色只画到旧血量(fromPct)，增量部分露出下面的绿色
      const drawPct = gainActive ? hpGain.fromPct : pct
      if (drawPct > 0) {
        c.fillStyle=fg; this.rr(x,y,w*drawPct,h,h/2); c.fill()
      }
      // 绿色渐隐后，粉色逐渐扩展覆盖增量部分
      if (gainActive && hpGain.timer > 15) {
        const expandT = (hpGain.timer - 15) / 25
        const coverPct = hpGain.fromPct + (pct - hpGain.fromPct) * expandT
        c.fillStyle=fg; this.rr(x,y,w*coverPct,h,h/2); c.fill()
      }
      // 顶部高光条
      c.save(); c.globalAlpha=0.35
      c.fillStyle='#fff'; this.rr(x+2*S,y+1,w*pct-4*S,h*0.35,h/4); c.fill()
      c.restore()
    }
    // 护盾层（在血条右侧紧接着，用青色显示）
    if (shield && shield > 0) {
      const shieldPct = Math.min(shield / maxHp, 1 - pct) // 护盾占比，不超过剩余槽
      const shieldStartX = x + w * pct
      const shieldW = w * shieldPct
      if (shieldW > 0) {
        const sg = c.createLinearGradient(shieldStartX, y, shieldStartX, y+h)
        sg.addColorStop(0, '#7ddfff'); sg.addColorStop(0.5, '#40b8e0'); sg.addColorStop(1, '#2891b5')
        c.fillStyle = sg; this.rr(shieldStartX, y, shieldW, h, h/2); c.fill()
        // 护盾高光
        c.save(); c.globalAlpha = 0.4
        c.fillStyle = '#fff'; this.rr(shieldStartX+1*S, y+1, shieldW-2*S, h*0.35, h/4); c.fill()
        c.restore()
      }
    }
    // 槽边框
    c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=1; this.rr(x,y,w,h,h/2); c.stroke()
    // HP数值（条上居中）
    if (showNum) {
      const fontSize = Math.max(8*S, h * 0.7)
      c.font = `bold ${fontSize}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2*S
      const hpTxt = `${Math.round(hp)}/${Math.round(maxHp)}`
      if (shield && shield > 0) {
        // HP数值 + 护盾数值（分颜色绘制）
        const shieldTxt = `+${Math.round(shield)}`
        const fullTxt = hpTxt + ' ' + shieldTxt
        const fullW = c.measureText(fullTxt).width
        const hpW = c.measureText(hpTxt + ' ').width
        const startX = x + w/2 - fullW/2
        c.textAlign = 'left'
        // 绘制HP部分
        c.strokeText(hpTxt, startX, y + h/2)
        c.fillStyle = numColor || '#fff'
        c.fillText(hpTxt, startX, y + h/2)
        // 绘制护盾部分（青色）
        c.strokeText(shieldTxt, startX + hpW, y + h/2)
        c.fillStyle = '#7ddfff'
        c.fillText(shieldTxt, startX + hpW, y + h/2)
      } else {
        c.strokeText(hpTxt, x + w/2, y + h/2)
        c.fillStyle = numColor || '#fff'
        c.fillText(hpTxt, x + w/2, y + h/2)
      }
    }
    c.restore()
  }

  // ===== 按钮（立体凸起质感） =====
  drawBtn(x,y,w,h,text,color,pressed) {
    const {ctx:c,S} = this
    const clr = color||TH.accent
    const rad = Math.min(10*S, h/2)
    c.save()
    c.translate(x, y)

    if (pressed) {
      // 按压态：下沉1px，阴影缩小
      c.translate(0, 2*S)
      // 微弱外阴影
      c.fillStyle='rgba(0,0,0,0.15)'; this.rr(1*S,1*S,w,h,rad); c.fill()
    } else {
      // 常态：底部厚阴影模拟凸起
      c.fillStyle='rgba(0,0,0,0.25)'; this.rr(0,4*S,w,h,rad); c.fill()
      c.fillStyle='rgba(0,0,0,0.12)'; this.rr(0,2*S,w,h,rad); c.fill()
    }

    // 底边深色层（凸起立体感的"厚度"）
    c.fillStyle=this._darken(clr); this.rr(0,2*S,w,h,rad); c.fill()

    // 主体渐变
    const g = c.createLinearGradient(0,0,0,h)
    const lt = this._lighten(clr, 0.25)
    g.addColorStop(0, lt)
    g.addColorStop(0.45, clr)
    g.addColorStop(1, this._darken(clr))
    c.fillStyle=g; this.rr(0,0,w,h,rad); c.fill()

    // 上半部内高光（玻璃反射）
    c.save(); c.globalAlpha=0.3
    const hg = c.createLinearGradient(0,0,0,h*0.5)
    hg.addColorStop(0,'rgba(255,255,255,0.6)'); hg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=hg; this.rr(1*S,1*S,w-2*S,h*0.5,rad); c.fill()
    c.restore()

    // 边框：外暗+内亮双线
    c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1.5*S; this.rr(0,0,w,h,rad); c.stroke()
    c.strokeStyle='rgba(255,255,255,0.15)'; c.lineWidth=1; this.rr(1*S,1*S,w-2*S,h-2*S,rad-1*S); c.stroke()

    // 底边高光线（分隔线立体感）
    c.save(); c.globalAlpha=0.1
    c.strokeStyle='#fff'; c.lineWidth=1
    c.beginPath(); c.moveTo(rad, h-1); c.lineTo(w-rad, h-1); c.stroke()
    c.restore()

    // 文字（带描边增强可读性）
    c.fillStyle='#fff'; c.font=`bold ${Math.min(14*S, h*0.45)}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.25)'; c.lineWidth=2*S; c.strokeText(text,w/2,h/2)
    c.fillText(text,w/2,h/2)

    c.restore()
  }

  // ===== 法宝卡片（立体质感） =====
  drawEquipCard(x,y,w,h,equip,selected,frame) {
    const {ctx:c,S} = this
    if (!equip) {
      // 空槽位 - 凹陷虚线框
      c.save()
      c.fillStyle='rgba(0,0,0,0.15)'; this.rr(x,y,w,h,8*S); c.fill()
      c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; c.setLineDash([4*S,4*S])
      this.rr(x,y,w,h,8*S); c.stroke()
      c.setLineDash([])
      c.fillStyle=TH.dim; c.font=`${24*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='middle'; c.fillText('+',x+w/2,y+h/2)
      c.restore()
      return
    }
    const q = QUALITY[equip.quality]
    const a = ATTR_COLOR[equip.attr]
    c.save()
    // 底部投影
    c.fillStyle='rgba(0,0,0,0.2)'; this.rr(x+1*S,y+3*S,w,h,8*S); c.fill()
    // 背景渐变
    const bg = c.createLinearGradient(x,y,x,y+h)
    bg.addColorStop(0,'rgba(30,30,48,0.94)'); bg.addColorStop(1,'rgba(18,18,32,0.96)')
    c.fillStyle=bg; this.rr(x,y,w,h,8*S); c.fill()
    // 顶部高光
    c.save(); c.globalAlpha=0.08
    const tg=c.createLinearGradient(x,y,x,y+h*0.35)
    tg.addColorStop(0,'rgba(255,255,255,0.4)'); tg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=tg; this.rr(x,y,w,h*0.35,8*S); c.fill()
    c.restore()
    // 品质边框
    if (selected) {
      c.strokeStyle=TH.accent; c.lineWidth=2.5*S
      // 选中光效
      c.save(); c.globalAlpha=0.1
      c.fillStyle=TH.accent; this.rr(x,y,w,h,8*S); c.fill()
      c.restore()
    } else {
      c.strokeStyle=q.color+'66'; c.lineWidth=1.5*S
    }
    this.rr(x,y,w,h,8*S); c.stroke()
    // 品质光效
    if (equip.quality === 'orange' || equip.quality === 'purple') {
      c.save(); c.globalAlpha = 0.06 + 0.04*Math.sin((frame||0)*0.04)
      c.fillStyle = q.color; this.rr(x,y,w,h,8*S); c.fill()
      c.restore()
    }
    // 属性色条（圆角）
    c.fillStyle = a.main
    this.rr(x+3*S,y+4*S,3*S,h-8*S,1.5*S); c.fill()
    // 装备图标
    const eqIcon = this.getImg(`assets/equipment/icon_${equip.slot}_${equip.attr}.jpg`)
    const iconSz = h - 8*S
    if (eqIcon && eqIcon.width > 0) {
      c.drawImage(eqIcon, x+8*S, y+4*S, iconSz, iconSz)
    }
    const textOff = (eqIcon && eqIcon.width > 0) ? iconSz + 10*S : 12*S
    // 名称
    c.fillStyle=TH.text; c.font=`bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign='left'; c.textBaseline='top'
    c.fillText(equip.name, x+textOff, y+6*S)
    // 品质标签 + 等级
    c.fillStyle=q.color; c.font=`bold ${9*S}px "PingFang SC",sans-serif`
    c.fillText(q.name + (equip.level ? ` Lv.${equip.level}` : ''), x+12*S, y+20*S)
    // 槽位图标
    const slot = EQUIP_SLOT[equip.slot]
    c.fillStyle=TH.sub; c.font=`${10*S}px "PingFang SC",sans-serif`
    c.textAlign='right'; c.fillText(slot.icon+' '+slot.name, x+w-8*S, y+6*S)
    // 属性概要（显示stats，兜底显示绝技名）
    c.fillStyle=TH.sub; c.font=`${9*S}px "PingFang SC",sans-serif`
    c.textAlign='left'
    if (equip.stats && Object.keys(equip.stats).length > 0) {
      const statText = Object.entries(equip.stats).map(([k,v]) => {
        const sd = STAT_DEFS[k]
        return `${sd ? sd.name : k}+${v}`
      }).join(' ')
      c.fillText(statText, x+12*S, y+34*S)
    } else {
      c.fillText(equip.ult ? equip.ult.name : '', x+12*S, y+34*S)
    }
    c.restore()
  }

  // ===== 法宝详情面板 =====
  drawEquipDetail(x,y,w,equip,frame) {
    if (!equip) return
    const {ctx:c,S} = this
    const q = QUALITY[equip.quality]
    const a = ATTR_COLOR[equip.attr]
    const lineH = 18*S, padX = 12*S
    let cy = y

    // 名称行
    c.fillStyle = q.color; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText(equip.name, x+padX, cy); cy += 22*S
    // 品质+属性+等级
    c.fillStyle = TH.sub; c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText(`${q.name} · ${ATTR_NAME[equip.attr]}属性 · ${EQUIP_SLOT[equip.slot].name}${equip.level ? ' · Lv.'+equip.level : ''}`, x+padX, cy); cy += lineH

    // 属性加成
    if (equip.stats && Object.keys(equip.stats).length > 0) {
      cy += 4*S
      c.fillStyle = TH.accent; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.fillText('▸ 属性加成:', x+padX, cy); cy += 14*S
      const statColors = {
        stamina:'#ff5555',metalAtk:'#ffd700',woodAtk:'#4dcc4d',earthAtk:'#d4a056',waterAtk:'#4dabff',fireAtk:'#ff4d4d',
        metalDef:'#ffd700',woodDef:'#4dcc4d',earthDef:'#d4a056',waterDef:'#4dabff',fireDef:'#ff4d4d',recovery:'#ff69b4'}
      Object.entries(equip.stats).forEach(([k,v]) => {
        const sd = STAT_DEFS[k]
        c.fillStyle = statColors[k] || TH.text; c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`  ${sd ? sd.name : k} +${v}`, x+padX, cy); cy += 14*S
      })
    }

    // 绝技
    if (equip.ult) {
      cy += 6*S
      c.fillStyle = TH.accent; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
      c.fillText('★ 绝技: '+equip.ult.name+` (需${equip.ultTrigger}次蓄力)`, x+padX, cy); cy += lineH
      c.fillStyle = TH.sub; c.font = `${10*S}px "PingFang SC",sans-serif`
      // 格式化绝技描述
      const desc = equip.ult.desc.replace(/{(\w+)}/g, (m,k) => {
        if (k === 'dur') return equip.ult.buffDur || ''
        return equip.ult[k] || m
      })
      c.fillText('  '+desc, x+padX, cy); cy += lineH
    }

    return cy - y  // 返回占用高度
  }

  // ===== 难度标签（立体胶囊按钮） =====
  drawDiffTag(x,y,w,h,text,color,active) {
    const {ctx:c,S} = this
    const rad = h/2
    c.save()
    if (active) {
      // 底层厚度
      c.fillStyle=this._darken(color); this.rr(x,y+2*S,w,h,rad); c.fill()
      // 主体渐变
      const g = c.createLinearGradient(x,y,x,y+h)
      g.addColorStop(0,this._lighten(color,0.2)); g.addColorStop(0.5,color); g.addColorStop(1,this._darken(color))
      c.fillStyle=g; this.rr(x,y,w,h,rad); c.fill()
      // 内高光
      c.save(); c.globalAlpha=0.25
      const hg=c.createLinearGradient(x,y,x,y+h*0.45)
      hg.addColorStop(0,'rgba(255,255,255,0.5)'); hg.addColorStop(1,'rgba(255,255,255,0)')
      c.fillStyle=hg; this.rr(x+1*S,y+1*S,w-2*S,h*0.5,rad); c.fill()
      c.restore()
      // 双边框
      c.strokeStyle='rgba(0,0,0,0.2)'; c.lineWidth=1.5*S; this.rr(x,y,w,h,rad); c.stroke()
      c.strokeStyle='rgba(255,255,255,0.12)'; c.lineWidth=1; this.rr(x+1,y+1,w-2,h-2,rad-1); c.stroke()
      c.fillStyle='#fff'
    } else {
      // 非激活：凹陷内嵌感
      c.fillStyle='rgba(0,0,0,0.2)'; this.rr(x,y,w,h,rad); c.fill()
      c.strokeStyle='rgba(255,255,255,0.08)'; c.lineWidth=1; this.rr(x,y,w,h,rad); c.stroke()
      // 内部微弱顶部阴影（凹入感）
      c.save(); c.globalAlpha=0.15
      const ig=c.createLinearGradient(x,y,x,y+h*0.3)
      ig.addColorStop(0,'rgba(0,0,0,0.4)'); ig.addColorStop(1,'rgba(0,0,0,0)')
      c.fillStyle=ig; this.rr(x,y,w,h*0.3,rad); c.fill()
      c.restore()
      c.fillStyle=TH.dim
    }
    c.font=`bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'; c.fillText(text,x+w/2,y+h/2)
    c.restore()
  }

  // ===== 毛玻璃卡片（立体浮起质感） =====
  drawGlassCard(x,y,w,h,r) {
    const {ctx:c,S} = this
    const rad = r||12*S
    c.save()
    // 底部投影
    c.fillStyle='rgba(0,0,0,0.15)'; this.rr(x+1*S,y+3*S,w,h,rad); c.fill()
    // 主体
    c.fillStyle='rgba(240,240,245,0.9)'; this.rr(x,y,w,h,rad); c.fill()
    // 顶部高光边
    c.save(); c.globalAlpha=0.5
    const tg=c.createLinearGradient(x,y,x,y+h*0.08)
    tg.addColorStop(0,'rgba(255,255,255,0.8)'); tg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=tg; this.rr(x+2*S,y+1,w-4*S,h*0.08,rad); c.fill()
    c.restore()
    // 双边框
    c.strokeStyle='rgba(255,255,255,0.7)'; c.lineWidth=1.5; this.rr(x,y,w,h,rad); c.stroke()
    c.strokeStyle='rgba(0,0,0,0.06)'; c.lineWidth=1; this.rr(x+1,y+1,w-2,h-2,rad-1); c.stroke()
    c.restore()
  }

  // ===== 深色面板（内凹容器质感） =====
  drawDarkPanel(x,y,w,h,r) {
    const {ctx:c,S} = this
    const rad = r||10*S
    c.save()
    // 内凹：顶部内阴影
    c.fillStyle='rgba(0,0,0,0.15)'; this.rr(x,y-1*S,w,h+1*S,rad); c.fill()
    // 主体
    const g = c.createLinearGradient(x,y,x,y+h)
    g.addColorStop(0,'rgba(22,22,35,0.94)'); g.addColorStop(1,'rgba(32,32,45,0.92)')
    c.fillStyle=g; this.rr(x,y,w,h,rad); c.fill()
    // 顶部内阴影（凹入感）
    c.save(); c.globalAlpha=0.2
    const ig=c.createLinearGradient(x,y,x,y+6*S)
    ig.addColorStop(0,'rgba(0,0,0,0.5)'); ig.addColorStop(1,'rgba(0,0,0,0)')
    c.fillStyle=ig; this.rr(x,y,w,6*S,rad); c.fill()
    c.restore()
    // 底部高光边（凹槽底亮线）
    c.save(); c.globalAlpha=0.08
    c.strokeStyle='#fff'; c.lineWidth=1
    c.beginPath(); c.moveTo(x+rad,y+h); c.lineTo(x+w-rad,y+h); c.stroke()
    c.restore()
    // 外边框
    c.strokeStyle='rgba(60,60,80,0.4)'; c.lineWidth=1; this.rr(x,y,w,h,rad); c.stroke()
    c.restore()
  }

  // ===== 底部导航按钮（立体图标+文字） =====
  drawNavBtn(x,y,w,h,icon,text,active) {
    const {ctx:c,S} = this
    c.save()
    if (active) {
      // 激活态底板
      const ag = c.createLinearGradient(x,y,x,y+h)
      ag.addColorStop(0,'rgba(255,215,0,0.18)'); ag.addColorStop(1,'rgba(255,215,0,0.05)')
      c.fillStyle=ag; this.rr(x+2*S,y+2*S,w-4*S,h-4*S,8*S); c.fill()
      // 顶部亮线
      c.save(); c.globalAlpha=0.5
      c.strokeStyle=TH.accent; c.lineWidth=2*S
      c.beginPath(); c.moveTo(x+w*0.25,y+2*S); c.lineTo(x+w*0.75,y+2*S); c.stroke()
      c.restore()
    }
    // 图标
    const img = this.getImg(icon)
    const iconS = 22*S
    if (img && img.width > 0) {
      c.globalAlpha = active ? 1 : 0.55
      // 图标阴影
      if (active) {
        c.save(); c.globalAlpha=0.3
        c.drawImage(img, x+(w-iconS)/2+1*S, y+5*S, iconS, iconS)
        c.restore(); c.globalAlpha=1
      }
      c.drawImage(img, x+(w-iconS)/2, y+4*S, iconS, iconS)
      c.globalAlpha = 1
    }
    // 文字
    c.fillStyle = active ? TH.accent : TH.dim
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='top'
    if (active) {
      c.strokeStyle='rgba(0,0,0,0.3)'; c.lineWidth=2*S
      c.strokeText(text, x+w/2, y+28*S)
    }
    c.fillText(text, x+w/2, y+28*S)
    c.restore()
  }

  // ===== 任务卡片（立体条目） =====
  drawTaskCard(x,y,w,h,task) {
    const {ctx:c,S} = this
    c.save()
    // 底部投影
    c.fillStyle='rgba(0,0,0,0.12)'; this.rr(x,y+2*S,w,h,8*S); c.fill()
    // 主体
    const bg = task.done ? 'rgba(77,204,77,0.12)' : 'rgba(30,30,50,0.85)'
    c.fillStyle=bg; this.rr(x,y,w,h,8*S); c.fill()
    // 顶部高光
    c.save(); c.globalAlpha=0.08
    const tg=c.createLinearGradient(x,y,x,y+h*0.4)
    tg.addColorStop(0,'rgba(255,255,255,0.3)'); tg.addColorStop(1,'rgba(255,255,255,0)')
    c.fillStyle=tg; this.rr(x,y,w,h*0.4,8*S); c.fill()
    c.restore()
    // 边框
    c.strokeStyle = task.done ? TH.success+'55' : 'rgba(80,80,100,0.3)'
    c.lineWidth=1; this.rr(x,y,w,h,8*S); c.stroke()
    // 状态图标
    if (task.done) {
      c.fillStyle=TH.success
      c.beginPath(); c.arc(x+16*S, y+h/2, 8*S, 0, Math.PI*2); c.fill()
      c.fillStyle='#fff'; c.font=`bold ${12*S}px "PingFang SC",sans-serif`
      c.textAlign='center'; c.textBaseline='middle'; c.fillText('✓',x+16*S,y+h/2)
    } else {
      c.strokeStyle=TH.dim; c.lineWidth=1.5*S
      c.beginPath(); c.arc(x+16*S, y+h/2, 8*S, 0, Math.PI*2); c.stroke()
    }
    // 名称
    c.fillStyle = TH.text; c.font = `${12*S}px "PingFang SC",sans-serif`
    c.textAlign='left'; c.textBaseline='middle'
    c.fillText(task.name, x+30*S, y+h/2-7*S)
    // 进度
    c.fillStyle = TH.sub; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(`${task.progress}/${task.target}`, x+30*S, y+h/2+8*S)
    c.restore()
  }

  // ===== 掉落弹窗 =====
  drawDropPopup(x,y,w,h,equip,frame) {
    const {ctx:c,S} = this
    if (!equip) return
    const q = QUALITY[equip.quality]
    c.save()
    // 遮罩
    c.fillStyle='rgba(0,0,0,0.6)'; c.fillRect(0,0,this.W,this.H)
    // 面板
    const g = c.createLinearGradient(x,y,x,y+h)
    g.addColorStop(0,'rgba(30,30,55,0.96)'); g.addColorStop(1,'rgba(18,18,35,0.98)')
    c.fillStyle=g; this.rr(x,y,w,h,14*S); c.fill()
    // 品质光框
    c.save(); c.globalAlpha = 0.3 + 0.1*Math.sin((frame||0)*0.06)
    c.strokeStyle=q.color; c.lineWidth=2*S; this.rr(x,y,w,h,14*S); c.stroke()
    c.restore()
    // 标题
    c.fillStyle=TH.accent; c.font=`bold ${16*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='top'
    c.fillText('🎉 获得法宝!', x+w/2, y+12*S)
    // 法宝详情
    this.drawEquipDetail(x, y+36*S, w, equip, frame)
    c.restore()
  }

  // ===== 仙技蓄力指示器 =====
  drawUltGauge(x,y,w,h,current,max,ready,color,frame) {
    const {ctx:c,S} = this
    const pct = Math.min(1, current/max)
    // 背景
    c.fillStyle='rgba(0,0,0,0.3)'; this.rr(x,y,w,h,h/2); c.fill()
    // 填充
    if (pct > 0) {
      const fc = ready ? TH.accent : (color || TH.info)
      c.fillStyle = fc; this.rr(x,y,w*pct,h,h/2); c.fill()
      if (ready) {
        c.save(); c.globalAlpha = 0.3+0.2*Math.sin((frame||0)*0.08)
        c.fillStyle = '#fff'; this.rr(x,y,w*pct,h,h/2); c.fill()
        c.restore()
      }
    }
    // 文字
    c.fillStyle=ready?'#fff':TH.sub; c.font=`bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.fillText(ready?'仙技就绪':`${current}/${max}`, x+w/2, y+h/2)
  }

  // ===== 绝技图标（棋盘下方，含蓄力次数+就绪特效+上滑提示） =====
  drawUltSkillIcon(x, y, size, equip, current, max, ready, frame, swipeProgress) {
    if (!equip) return
    const {ctx:c, S} = this
    const a = ATTR_COLOR[equip.attr]
    const q = QUALITY[equip.quality]
    const slot = EQUIP_SLOT[equip.slot]

    c.save()

    // 上滑时的偏移
    const swipeOff = (swipeProgress || 0) * (-30*S)
    c.translate(0, swipeOff)

    // ===== 就绪时外围旋转光环特效 =====
    if (ready) {
      const pulse = 1 + 0.06*Math.sin(frame*0.08)
      const cx = x + size/2, cy = y + size/2
      // 外圈呼吸光环
      c.save()
      c.globalAlpha = 0.25 + 0.15*Math.sin(frame*0.06)
      const auraR = size*0.7*pulse
      const auraG = c.createRadialGradient(cx, cy, size*0.3, cx, cy, auraR)
      auraG.addColorStop(0, a.main+'88'); auraG.addColorStop(0.6, a.main+'44'); auraG.addColorStop(1, 'transparent')
      c.fillStyle = auraG; c.beginPath(); c.arc(cx, cy, auraR, 0, Math.PI*2); c.fill()
      c.restore()

      // 旋转光点
      c.save()
      for (let i=0; i<4; i++) {
        const angle = frame*0.04 + (Math.PI*2/4)*i
        const pr = size*0.52
        const px = cx + Math.cos(angle)*pr
        const py = cy + Math.sin(angle)*pr
        c.globalAlpha = 0.5 + 0.3*Math.sin(frame*0.1+i)
        c.fillStyle = '#fff'
        c.beginPath(); c.arc(px, py, 2.5*S, 0, Math.PI*2); c.fill()
      }
      c.restore()

      // 底部金色上箭头提示（闪烁）
      c.save()
      c.globalAlpha = 0.4 + 0.4*Math.sin(frame*0.1)
      c.fillStyle = TH.accent
      c.font = `${10*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'top'
      c.fillText('↑', x+size/2, y-12*S)
      c.restore()
    }

    // ===== 图标底板 =====
    // 底部阴影
    c.fillStyle = 'rgba(0,0,0,0.3)'
    this.rr(x+1*S, y+2*S, size, size, 8*S); c.fill()
    // 主体背景渐变
    const bgG = c.createLinearGradient(x, y, x, y+size)
    bgG.addColorStop(0, 'rgba(30,30,50,0.95)'); bgG.addColorStop(1, 'rgba(18,18,35,0.98)')
    c.fillStyle = bgG; this.rr(x, y, size, size, 8*S); c.fill()
    // 属性色叠加
    c.save(); c.globalAlpha = 0.12
    c.fillStyle = a.main; this.rr(x, y, size, size, 8*S); c.fill()
    c.restore()

    // ===== 边框（品质色/就绪时金色） =====
    if (ready) {
      c.strokeStyle = TH.accent; c.lineWidth = 2*S
      // 金色发光
      c.save(); c.globalAlpha = 0.15 + 0.1*Math.sin(frame*0.07)
      c.fillStyle = TH.accent; this.rr(x, y, size, size, 8*S); c.fill()
      c.restore()
    } else {
      c.strokeStyle = q.color+'66'; c.lineWidth = 1.5*S
    }
    this.rr(x, y, size, size, 8*S); c.stroke()

    // ===== 槽位图标（大）- 优先使用图片 =====
    const eqIconImg = this.getImg(`assets/equipment/icon_${equip.slot}_${equip.attr}.jpg`)
    const iconPad = size * 0.15
    if (eqIconImg && eqIconImg.width > 0) {
      const iSz = size - iconPad*2
      c.drawImage(eqIconImg, x+iconPad, y+iconPad*0.6, iSz, iSz*0.7)
    } else {
      c.fillStyle = ready ? '#fff' : a.main
      c.font = `${size*0.38}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(slot.icon, x+size/2, y+size*0.38)
    }

    // ===== 属性小标（左上角） =====
    c.save()
    c.fillStyle = a.main
    c.beginPath(); c.arc(x+10*S, y+10*S, 6*S, 0, Math.PI*2); c.fill()
    c.fillStyle = '#fff'; c.font = `bold ${6*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ATTR_NAME[equip.attr], x+10*S, y+10*S)
    c.restore()

    // ===== 蓄力次数（底部） =====
    const countY = y + size*0.7
    // 进度小条
    const barW = size*0.7, barH = 3*S
    const barX = x + (size-barW)/2
    const pct = Math.min(1, current/max)
    c.fillStyle = 'rgba(0,0,0,0.4)'; this.rr(barX, countY, barW, barH, barH/2); c.fill()
    if (pct > 0) {
      c.fillStyle = ready ? TH.accent : a.main
      this.rr(barX, countY, barW*pct, barH, barH/2); c.fill()
    }
    // 次数文字
    c.fillStyle = ready ? TH.accent : TH.sub
    c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${current}/${max}`, x+size/2, countY+barH+2*S)

    // ===== 上滑进行中的透明度渐变 =====
    if (swipeProgress && swipeProgress > 0) {
      c.globalAlpha = 1 - swipeProgress*0.5
    }

    c.restore()
  }

  // ===== 战斗角色立绘（修士，带装备图标） =====
  drawBattleHero(x, y, size, equipped, hp, maxHp, frame, attackAnim) {
    const {ctx:c, S} = this
    c.save()
    // 攻击动画偏移
    let ox = 0, oy = 0
    if (attackAnim && attackAnim.active) {
      const p = attackAnim.progress
      if (p < 0.3) { ox = p/0.3 * 30*S } // 冲刺
      else if (p < 0.5) { ox = 30*S - (p-0.3)/0.2 * 35*S } // 回弹
      else { ox = -5*S * (1-(p-0.5)/0.5) } // 归位
    }
    c.translate(ox, oy)

    // 脚底光环
    const pulse = 1 + 0.03*Math.sin(frame*0.05)
    c.save(); c.globalAlpha = 0.12
    const footG = c.createRadialGradient(x, y+size*0.45, 0, x, y+size*0.45, size*0.5)
    footG.addColorStop(0, TH.accent); footG.addColorStop(1, 'transparent')
    c.fillStyle = footG; c.beginPath(); c.ellipse(x, y+size*0.45, size*0.5*pulse, size*0.15, 0, 0, Math.PI*2); c.fill()
    c.restore()

    // 角色主体图片
    const heroImg = this.getImg('assets/hero/hero_body.jpg')
    const imgSize = size * 0.85
    if (heroImg && heroImg.width > 0) {
      c.drawImage(heroImg, x-imgSize/2, y-imgSize*0.4, imgSize, imgSize)
    } else {
      // 占位角色
      c.save()
      const bg = c.createRadialGradient(x, y, 5*S, x, y, size*0.4)
      bg.addColorStop(0, '#ffd700'); bg.addColorStop(0.7, '#ff6b35'); bg.addColorStop(1, 'rgba(255,107,53,0)')
      c.fillStyle = bg; c.beginPath(); c.arc(x, y, size*0.4, 0, Math.PI*2); c.fill()
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.font = `${size*0.5}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('🧙', x, y)
      c.restore()
    }

    // 已装备法宝小图标（角色脚下）— 当前法宝系统不使用此块

    // HP条
    const hpW = size*0.9, hpH = 6*S
    const hpX = x - hpW/2, hpY = y + size*0.5 + 4*S
    this.drawHp(hpX, hpY, hpW, hpH, hp, maxHp, TH.success)
    // HP数字
    c.fillStyle = TH.text; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${hp}/${maxHp}`, x, hpY+hpH+2*S)
    // 名字
    c.fillStyle = TH.accent; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('修仙者', x, hpY+hpH+14*S)

    c.restore()
  }

  // ===== 战斗妖兽立绘 =====
  drawBattleEnemy(x, y, size, attr, hp, maxHp, name, avatar, frame, hurtAnim) {
    const {ctx:c, S} = this
    const a = A[attr]
    if (!a) return
    c.save()
    // 受击动画
    let shake = 0
    if (hurtAnim && hurtAnim.active) {
      shake = Math.sin(hurtAnim.progress * Math.PI * 6) * 4*S * (1 - hurtAnim.progress)
    }
    c.translate(shake, 0)

    // 妖气光环
    const pulse = 1 + 0.05*Math.sin(frame*0.04)
    c.save(); c.globalAlpha = 0.15
    const auraG = c.createRadialGradient(x, y, size*0.15, x, y, size*0.55*pulse)
    auraG.addColorStop(0, a.main); auraG.addColorStop(1, 'transparent')
    c.fillStyle = auraG; c.beginPath(); c.arc(x, y, size*0.55*pulse, 0, Math.PI*2); c.fill()
    c.restore()

    // 脚底暗影
    c.save(); c.globalAlpha = 0.15
    c.fillStyle = a.dk
    c.beginPath(); c.ellipse(x, y+size*0.4, size*0.4, size*0.12, 0, 0, Math.PI*2); c.fill()
    c.restore()

    // 怪物主体
    const img = avatar ? this.getImg(avatar) : null
    const imgSize = size * 0.8
    if (img && img.width > 0) {
      c.drawImage(img, x-imgSize/2, y-imgSize*0.45, imgSize, imgSize)
    } else {
      const g = c.createRadialGradient(x, y-size*0.1, size*0.05, x, y, size*0.4)
      g.addColorStop(0, a.lt); g.addColorStop(0.6, a.main); g.addColorStop(1, a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x, y, size*0.38, 0, Math.PI*2); c.fill()
      // 高光
      c.fillStyle = 'rgba(255,255,255,0.2)'
      c.beginPath(); c.ellipse(x-size*0.08, y-size*0.12, size*0.2, size*0.14, 0, 0, Math.PI*2); c.fill()
    }

    // 属性标识
    c.save(); c.globalAlpha = 0.7
    c.fillStyle = a.main
    c.beginPath(); c.arc(x+size*0.35, y-size*0.35, 8*S, 0, Math.PI*2); c.fill()
    c.fillStyle = '#fff'; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ATTR_NAME[attr], x+size*0.35, y-size*0.35)
    c.restore()

    // HP条
    const hpW = size*0.85, hpH = 6*S
    const hpX = x - hpW/2, hpY = y + size*0.45 + 2*S
    this.drawHp(hpX, hpY, hpW, hpH, hp, maxHp, a.main)
    // HP数字
    c.fillStyle = TH.text; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${hp}/${maxHp}`, x, hpY+hpH+2*S)
    // 名字
    c.fillStyle = a.main; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(name||'妖兽', x, hpY+hpH+14*S)

    c.restore()
  }

  // ===== 战斗怪物全屏立绘（新布局：占满上半区域） =====
  drawBattleEnemyFull(x, y, size, attr, hp, maxHp, name, avatar, frame, hurtAnim, hpLoss) {
    const {ctx:c, S, W} = this
    const a = A[attr]
    if (!a) return
    c.save()
    // 受击动画
    let shake = 0
    if (hurtAnim && hurtAnim.active) {
      shake = Math.sin(hurtAnim.progress * Math.PI * 6) * 6*S * (1 - hurtAnim.progress)
    }
    c.translate(shake, 0)

    // 妖气光环（大范围）
    const pulse = 1 + 0.05*Math.sin(frame*0.04)
    c.save(); c.globalAlpha = 0.12
    const auraG = c.createRadialGradient(x, y, size*0.1, x, y, size*0.7*pulse)
    auraG.addColorStop(0, a.main); auraG.addColorStop(1, 'transparent')
    c.fillStyle = auraG; c.beginPath(); c.arc(x, y, size*0.7*pulse, 0, Math.PI*2); c.fill()
    c.restore()

    // 脚底暗影
    c.save(); c.globalAlpha = 0.2
    c.fillStyle = a.dk
    c.beginPath(); c.ellipse(x, y+size*0.42, size*0.5, size*0.12, 0, 0, Math.PI*2); c.fill()
    c.restore()

    // 怪物主体（大图）
    const img = avatar ? this.getImg(avatar) : null
    const imgSize = size * 0.9
    if (img && img.width > 0) {
      c.drawImage(img, x-imgSize/2, y-imgSize*0.5, imgSize, imgSize)
    } else {
      const g = c.createRadialGradient(x, y-size*0.1, size*0.05, x, y, size*0.45)
      g.addColorStop(0, a.lt); g.addColorStop(0.6, a.main); g.addColorStop(1, a.dk)
      c.fillStyle = g; c.beginPath(); c.arc(x, y, size*0.45, 0, Math.PI*2); c.fill()
      c.fillStyle = 'rgba(255,255,255,0.2)'
      c.beginPath(); c.ellipse(x-size*0.1, y-size*0.15, size*0.22, size*0.16, 0, 0, Math.PI*2); c.fill()
    }

    // 属性标识（右上角）
    c.save(); c.globalAlpha = 0.85
    c.fillStyle = a.main
    c.beginPath(); c.arc(x+size*0.4, y-size*0.4, 10*S, 0, Math.PI*2); c.fill()
    c.fillStyle = '#fff'; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(ATTR_NAME[attr], x+size*0.4, y-size*0.4)
    c.restore()

    // 名字
    c.fillStyle = a.main; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2*S
    c.strokeText(name||'妖兽', x, y+size*0.46)
    c.fillText(name||'妖兽', x, y+size*0.46)

    // HP条（宽，在怪物下方）
    const hpW = W * 0.7, hpH = 8*S
    const hpX = x - hpW/2, hpY = y + size*0.46 + 18*S
    this.drawHp(hpX, hpY, hpW, hpH, hp, maxHp, a.main, hpLoss)
    // HP数字
    c.fillStyle = TH.text; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(`${hp}/${maxHp}`, x, hpY+hpH+2*S)

    c.restore()
  }

  // ===== 技能图标栏（棋盘上方，类似智龙迷城队伍栏） =====
  // 左侧大角色头像 | 分隔线 | 右侧技能图标
  drawSkillBar(x, y, w, h, equipped, skillTriggers, frame, heroAttr) {
    const {ctx:c, S} = this
    // 背景
    c.save()
    const bg = c.createLinearGradient(x, y, x, y+h)
    bg.addColorStop(0, 'rgba(10,10,25,0.95)'); bg.addColorStop(1, 'rgba(20,20,40,0.9)')
    c.fillStyle = bg; c.fillRect(x, y, w, h)
    // 顶部金色分割线
    c.strokeStyle = 'rgba(255,215,0,0.3)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x, y); c.lineTo(x+w, y); c.stroke()
    // 底部分割线
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x, y+h); c.lineTo(x+w, y+h); c.stroke()

    // 只展示有绝技的装备（无绝技的不展示）
    const ultList = Object.values(equipped).filter(e => e && e.ult)
    const iconSize = 40*S          // 绝技图标尺寸
    const gap = 5*S
    const heroSize = h - 6*S       // 角色头像撑满栏高（留3px上下边距）
    const heroPad = 6*S            // 头像左侧内边距
    const dividerGap = 8*S         // 分隔线两侧间距
    const iconY = y + (h - iconSize) / 2

    // ===== 绘制角色头像（左侧，更大） =====
    const heroX = heroPad
    const heroY = y + (h - heroSize) / 2
    this._drawHeroIcon(heroX, heroY, heroSize, frame, heroAttr)

    // ===== 竖分隔线 =====
    const divX = heroX + heroSize + dividerGap
    c.strokeStyle = 'rgba(255,215,0,0.25)'; c.lineWidth = 1*S
    c.beginPath(); c.moveTo(divX, y + 6*S); c.lineTo(divX, y + h - 6*S); c.stroke()

    // ===== 绘制绝技图标（分隔线右侧，只展示有绝技的装备） =====
    const skillStartX = divX + dividerGap
    if (ultList.length === 0) {
      c.fillStyle = TH.dim; c.font = `${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('无绝技', skillStartX + 50*S, y+h/2)
      c.restore()
      return
    }

    // 绝技区域可用宽度，图标在其中均匀排列
    const skillAreaW = w - skillStartX - 6*S
    const actualGap = ultList.length > 1
      ? Math.min(gap, (skillAreaW - ultList.length * iconSize) / (ultList.length - 1))
      : 0
    const skillsTotalW = ultList.length * iconSize + Math.max(0, ultList.length-1) * actualGap
    const skillOffsetX = skillStartX + (skillAreaW - skillsTotalW) / 2

    ultList.forEach((eq, idx) => {
      const ix = skillOffsetX + idx * (iconSize + actualGap)
      const cur = (skillTriggers || {})[eq.attr] || 0
      const ready = cur >= eq.ultTrigger
      const a = ATTR_COLOR[eq.attr]
      const q = QUALITY[eq.quality]
      const ult = eq.ult

      // 底部阴影
      c.fillStyle = 'rgba(0,0,0,0.3)'
      this.rr(ix+1*S, iconY+2*S, iconSize, iconSize, 6*S); c.fill()

      // 图标背景
      const ibg = c.createLinearGradient(ix, iconY, ix, iconY+iconSize)
      ibg.addColorStop(0, 'rgba(35,35,55,0.95)'); ibg.addColorStop(1, 'rgba(22,22,38,0.98)')
      c.fillStyle = ibg; this.rr(ix, iconY, iconSize, iconSize, 6*S); c.fill()

      // 属性色叠加
      c.save(); c.globalAlpha = 0.15
      c.fillStyle = a.main; this.rr(ix, iconY, iconSize, iconSize, 6*S); c.fill()
      c.restore()

      // 绝技图标：用绝技名首字 + 属性色渐变圆形
      const icx = ix + iconSize/2, icy = iconY + iconSize*0.38
      const icR = iconSize * 0.28
      const skG = c.createRadialGradient(icx-icR*0.2, icy-icR*0.2, icR*0.1, icx, icy, icR)
      skG.addColorStop(0, a.lt); skG.addColorStop(0.7, a.main); skG.addColorStop(1, a.dk)
      c.fillStyle = skG; c.beginPath(); c.arc(icx, icy, icR, 0, Math.PI*2); c.fill()
      // 绝技名首字
      const ultChar = (ult.name || '').charAt(0) || '技'
      c.fillStyle = '#fff'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(ultChar, icx, icy)

      // 绝技名（图标下方小字）
      c.fillStyle = TH.sub; c.font = `${6*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'top'
      c.fillText(ult.name, ix+iconSize/2, iconY+iconSize*0.7)

      // 边框（就绪时金色脉冲）
      if (ready) {
        c.strokeStyle = TH.accent; c.lineWidth = 2*S
        c.save(); c.globalAlpha = 0.2 + 0.15*Math.sin(frame*0.07)
        c.fillStyle = TH.accent; this.rr(ix, iconY, iconSize, iconSize, 6*S); c.fill()
        c.restore()
        // 闪烁"释放"提示
        c.save(); c.globalAlpha = 0.6 + 0.35*Math.sin(frame*0.1)
        c.fillStyle = TH.accent; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'bottom'
        c.fillText('点击释放', ix+iconSize/2, iconY-1*S)
        c.restore()
      } else {
        c.strokeStyle = q.color+'66'; c.lineWidth = 1.5*S
      }
      this.rr(ix, iconY, iconSize, iconSize, 6*S); c.stroke()

      // 蓄力进度条（底部）
      const barW2 = iconSize - 4*S, barH2 = 3*S
      const barX2 = ix + 2*S, barY2 = iconY + iconSize - 6*S
      const pct = Math.min(1, cur / eq.ultTrigger)
      c.fillStyle = 'rgba(0,0,0,0.4)'; this.rr(barX2, barY2, barW2, barH2, barH2/2); c.fill()
      if (pct > 0) {
        c.fillStyle = ready ? TH.accent : a.main
        this.rr(barX2, barY2, barW2*pct, barH2, barH2/2); c.fill()
      }

      // 属性小标（左上角）
      c.fillStyle = a.main
      c.beginPath(); c.arc(ix+7*S, iconY+7*S, 4.5*S, 0, Math.PI*2); c.fill()
      c.fillStyle = '#fff'; c.font = `bold ${5*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText(ATTR_NAME[eq.attr], ix+7*S, iconY+7*S)
    })

    c.restore()
  }

  /** 绘制角色头像（技能栏左侧，大尺寸） */
  _drawHeroIcon(x, y, size, frame, heroAttr) {
    const {ctx:c, S} = this

    // 底部阴影
    c.fillStyle = 'rgba(0,0,0,0.5)'
    this.rr(x+2*S, y+2*S, size, size, 10*S); c.fill()

    // 背景（比技能图标亮，突出角色）
    const bg = c.createLinearGradient(x, y, x, y+size)
    bg.addColorStop(0, 'rgba(50,45,70,0.95)'); bg.addColorStop(1, 'rgba(35,32,50,0.98)')
    c.fillStyle = bg; this.rr(x, y, size, size, 10*S); c.fill()

    // 角色头像图片（圆角裁切）
    const imgPad = 2*S
    c.save()
    this.rr(x+imgPad, y+imgPad, size-imgPad*2, size-imgPad*2, 8*S); c.clip()
    const heroImg = this.getImg('assets/hero/hero_avatar.jpg')
    if (heroImg && heroImg.width > 0) {
      c.drawImage(heroImg, x+imgPad, y+imgPad, size-imgPad*2, size-imgPad*2)
    } else {
      const fg = c.createRadialGradient(x+size/2, y+size*0.4, size*0.1, x+size/2, y+size/2, size*0.4)
      fg.addColorStop(0, '#9999dd'); fg.addColorStop(1, '#555577')
      c.fillStyle = fg; c.fillRect(x+imgPad, y+imgPad, size-imgPad*2, size-imgPad*2)
      c.fillStyle = '#fff'; c.font = `bold ${Math.round(size*0.35)}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('修', x+size/2, y+size*0.42)
    }
    c.restore()

    // 金色边框（呼吸灯）
    const borderAlpha = 0.7 + 0.2 * Math.sin(frame * 0.04)
    c.save(); c.globalAlpha = borderAlpha
    c.strokeStyle = TH.accent; c.lineWidth = 2.5*S
    this.rr(x, y, size, size, 10*S); c.stroke()
    c.restore()

    // 属性小标（左上角）
    if (heroAttr) {
      const ha = ATTR_COLOR[heroAttr]
      if (ha) {
        c.fillStyle = ha.main
        c.beginPath(); c.arc(x+8*S, y+8*S, 6*S, 0, Math.PI*2); c.fill()
        c.fillStyle = '#fff'; c.font = `bold ${6*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        c.fillText(ATTR_NAME[heroAttr], x+8*S, y+8*S)
      }
    }
  }

  // ===== 人物血条（宽横条，棋盘上方） =====
  drawHeroHpBar(x, y, w, h, hp, maxHp, frame, hpLoss) {
    const {ctx:c, S} = this
    c.save()
    // 背景
    const bg = c.createLinearGradient(x, y, x, y+h)
    bg.addColorStop(0, 'rgba(15,15,30,0.9)'); bg.addColorStop(1, 'rgba(10,10,22,0.85)')
    c.fillStyle = bg; c.fillRect(x, y, w, h)

    // HP条
    const padX = 12*S, padY = 6*S
    const barW = w - padX*2, barH = h - padY*2 - 10*S
    const barX = x + padX, barY = y + padY

    // 槽背景
    c.fillStyle = 'rgba(0,0,0,0.5)'; this.rr(barX, barY, barW, barH, barH/2); c.fill()

    // 掉血灰色残影
    const pct = Math.max(0, Math.min(1, hp/maxHp))
    if (hpLoss && hpLoss.fromPct > pct) {
      const totalFrames = 45
      const t = hpLoss.timer / totalFrames
      let lossPct
      if (hpLoss.timer <= 15) {
        lossPct = hpLoss.fromPct
      } else {
        const shrinkT = (hpLoss.timer - 15) / (totalFrames - 15)
        lossPct = hpLoss.fromPct + (pct - hpLoss.fromPct) * shrinkT * shrinkT
      }
      const alpha = t < 0.7 ? 0.6 : 0.6 * (1 - (t-0.7)/0.3)
      c.save(); c.globalAlpha = alpha
      c.fillStyle = 'rgba(180,180,180,0.8)'
      this.rr(barX, barY, barW*lossPct, barH, barH/2); c.fill()
      c.restore()
    }

    // 填充
    if (pct > 0) {
      const barColor = pct > 0.5 ? TH.success : pct > 0.2 ? TH.hard : TH.danger
      const fg = c.createLinearGradient(barX, barY, barX, barY+barH)
      fg.addColorStop(0, this._lighten(barColor, 0.15)); fg.addColorStop(0.5, barColor); fg.addColorStop(1, this._darken(barColor))
      c.fillStyle = fg; this.rr(barX, barY, barW*pct, barH, barH/2); c.fill()
      // 高光
      c.save(); c.globalAlpha = 0.3
      c.fillStyle = '#fff'; this.rr(barX+2*S, barY+1, barW*pct-4*S, barH*0.35, barH/4); c.fill()
      c.restore()
    }
    // 边框
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 1; this.rr(barX, barY, barW, barH, barH/2); c.stroke()

    // HP数字（在条上居中）
    c.fillStyle = '#fff'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 2*S
    c.strokeText(`${hp} / ${maxHp}`, x+w/2, barY+barH/2)
    c.fillText(`${hp} / ${maxHp}`, x+w/2, barY+barH/2)

    // 底部分割线
    c.strokeStyle = 'rgba(255,255,255,0.06)'; c.lineWidth = 1
    c.beginPath(); c.moveTo(x, y+h); c.lineTo(x+w, y+h); c.stroke()
    c.restore()
  }


  drawSkillCast(anim, frame) {
    if (!anim || !anim.active) return
    const {ctx:c, W, H, S} = this
    const p = anim.progress
    const clr = anim.color || TH.accent
    const tx = anim.targetX || W*0.5
    const ty = anim.targetY || H*0.3

    c.save()
    switch(anim.type) {
      case 'slash': {
        c.globalAlpha = Math.min(1, (1-p)*2)
        const slashX = W * 0.2 + p * W * 0.6
        const slashW = 120*S
        const g = c.createLinearGradient(slashX-slashW/2, 0, slashX+slashW/2, 0)
        g.addColorStop(0, 'transparent')
        g.addColorStop(0.3, clr+'88')
        g.addColorStop(0.5, '#fff')
        g.addColorStop(0.7, clr+'88')
        g.addColorStop(1, 'transparent')
        c.fillStyle = g
        c.save()
        c.translate(slashX, ty)
        c.rotate(-0.3)
        c.fillRect(-slashW/2, -3*S, slashW, 6*S)
        for (let i=0; i<5; i++) {
          const px = (Math.random()-0.5)*slashW*0.8
          const py = (Math.random()-0.5)*30*S
          const pr = 2*S + Math.random()*3*S
          c.globalAlpha = Math.random()*0.6*(1-p)
          c.fillStyle = clr
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        c.restore()
        break
      }
      case 'burst': {
        const cx = tx, cy = ty
        const maxR = 80*S
        const r = p * maxR
        c.globalAlpha = (1-p)*0.8
        c.strokeStyle = clr; c.lineWidth = (1-p)*8*S
        c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.stroke()
        c.globalAlpha = (1-p)*0.3
        const rg = c.createRadialGradient(cx, cy, 0, cx, cy, r)
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.4, clr); rg.addColorStop(1, 'transparent')
        c.fillStyle = rg; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI*2); c.fill()
        for (let i=0; i<8; i++) {
          const angle = (Math.PI*2/8)*i + frame*0.02
          const dist = r * (0.5 + Math.random()*0.5)
          const px2 = cx + Math.cos(angle)*dist
          const py2 = cy + Math.sin(angle)*dist
          c.globalAlpha = (1-p)*0.5
          c.fillStyle = i%2===0 ? '#fff' : clr
          c.beginPath(); c.arc(px2, py2, (1-p)*4*S, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'heal': {
        const cx = tx, cy = ty
        c.globalAlpha = (1-p)*0.6
        const healClr = clr || TH.success
        const pillarG = c.createLinearGradient(cx, cy+60*S, cx, cy-80*S)
        pillarG.addColorStop(0, 'transparent')
        pillarG.addColorStop(0.3, healClr+'66')
        pillarG.addColorStop(0.5, healClr+'cc')
        pillarG.addColorStop(0.8, healClr+'66')
        pillarG.addColorStop(1, 'transparent')
        c.fillStyle = pillarG
        c.fillRect(cx-15*S, cy-80*S, 30*S, 140*S)
        for (let i=0; i<6; i++) {
          const px = cx + (Math.random()-0.5)*40*S
          const py = cy + 40*S - p*120*S - i*15*S
          const pr = 2*S + Math.random()*2*S
          c.globalAlpha = Math.max(0, (1-p)*0.7 - i*0.08)
          c.fillStyle = i%2===0 ? healClr : '#f09ab0'
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'enemyAtk': {
        c.globalAlpha = (1-p)*0.7
        const cx = tx
        const cy = ty
        const impactR = 30*S + p*30*S
        const ig = c.createRadialGradient(cx, cy, 0, cx, cy, impactR)
        ig.addColorStop(0, '#ff4d6a'); ig.addColorStop(0.5, '#ff4d6a88'); ig.addColorStop(1, 'transparent')
        c.fillStyle = ig; c.beginPath(); c.arc(cx, cy, impactR, 0, Math.PI*2); c.fill()
        for (let i=0; i<4; i++) {
          const ly = cy + (i-1.5)*12*S
          c.strokeStyle = `rgba(255,77,106,${(1-p)*0.4})`
          c.lineWidth = 2*S
          c.beginPath(); c.moveTo(cx+20*S, ly); c.lineTo(cx+60*S+Math.random()*20*S, ly); c.stroke()
        }
        break
      }
      case 'shield': {
        // 护盾特效：六边形护盾展开 + 蓝光脉冲
        const cx2 = tx, cy2 = ty
        const shieldR = 50*S * Math.min(1, p*3) // 快速展开
        const fadeAlpha = p < 0.3 ? p/0.3 : (1-p)*1.4
        c.globalAlpha = Math.max(0, fadeAlpha) * 0.7
        // 护盾光圈
        c.strokeStyle = clr; c.lineWidth = (3 + (1-p)*3)*S
        c.beginPath()
        for (let i=0; i<=6; i++) {
          const ang = (Math.PI*2/6)*i - Math.PI/2
          const sx = cx2 + Math.cos(ang)*shieldR
          const sy = cy2 + Math.sin(ang)*shieldR*0.8
          i===0 ? c.moveTo(sx,sy) : c.lineTo(sx,sy)
        }
        c.closePath(); c.stroke()
        // 护盾内部填充
        c.globalAlpha = Math.max(0, fadeAlpha) * 0.15
        c.fillStyle = clr; c.fill()
        // 向上飘散的护盾粒子
        c.globalAlpha = Math.max(0, fadeAlpha) * 0.6
        for (let i=0; i<6; i++) {
          const seed = i*60
          const px = cx2 + Math.cos(seed)*shieldR*(0.3+Math.random()*0.5)
          const py = cy2 - p*40*S - i*8*S
          const pr = (2+Math.random()*2)*S*(1-p)
          c.fillStyle = i%2===0 ? '#fff' : clr
          c.beginPath(); c.arc(px, py, pr, 0, Math.PI*2); c.fill()
        }
        break
      }
      case 'debuff': {
        // 减攻特效：向下的紫色锁链 + 暗化
        const cx3 = tx, cy3 = ty
        const expandP = Math.min(1, p*2.5)
        const fadeAlpha2 = p < 0.2 ? p/0.2 : (1-p)*1.25
        c.globalAlpha = Math.max(0, fadeAlpha2) * 0.6
        // 暗色光环笼罩敌人
        const debuffR = 60*S * expandP
        const dg = c.createRadialGradient(cx3, cy3, 0, cx3, cy3, debuffR)
        dg.addColorStop(0, clr+'66'); dg.addColorStop(0.6, clr+'33'); dg.addColorStop(1, 'transparent')
        c.fillStyle = dg; c.beginPath(); c.arc(cx3, cy3, debuffR, 0, Math.PI*2); c.fill()
        // 向下箭头链
        c.globalAlpha = Math.max(0, fadeAlpha2) * 0.8
        c.fillStyle = clr; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
        c.textAlign = 'center'; c.textBaseline = 'middle'
        for (let i=0; i<3; i++) {
          const ay = cy3 - 20*S + i*18*S + p*15*S
          const arrowAlpha = Math.max(0, fadeAlpha2 - i*0.15)
          c.globalAlpha = arrowAlpha * 0.7
          c.fillText('▼', cx3 + (i-1)*20*S, ay)
        }
        // 锁链粒子
        for (let i=0; i<5; i++) {
          const angle2 = (Math.PI*2/5)*i + p*2
          const dist2 = debuffR * 0.6
          const px2 = cx3 + Math.cos(angle2)*dist2
          const py2 = cy3 + Math.sin(angle2)*dist2
          c.globalAlpha = Math.max(0, fadeAlpha2)*0.5
          c.fillStyle = '#fff'
          c.beginPath(); c.arc(px2, py2, (1-p)*3*S, 0, Math.PI*2); c.fill()
        }
        break
      }
    }
    if (anim.skillName && p < 0.7) {
      c.globalAlpha = p < 0.1 ? p/0.1 : (p < 0.5 ? 1 : (0.7-p)/0.2)
      c.fillStyle = clr; c.font = `bold ${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 3*S
      const textY = ty - p*10*S - 30*S
      c.strokeText(anim.skillName, W/2, textY)
      c.fillText(anim.skillName, W/2, textY)
    }
    c.restore()
  }

  // ===== VS分隔标记 =====
  drawVsBadge(x, y, frame) {
    const {ctx:c, S} = this
    const pulse = 1 + 0.04*Math.sin(frame*0.06)
    c.save()
    // 背景圆
    c.globalAlpha = 0.7
    c.fillStyle = 'rgba(0,0,0,0.5)'
    c.beginPath(); c.arc(x, y, 14*S*pulse, 0, Math.PI*2); c.fill()
    // 边框
    c.strokeStyle = TH.accent+'88'; c.lineWidth = 1.5*S
    c.beginPath(); c.arc(x, y, 14*S*pulse, 0, Math.PI*2); c.stroke()
    // 文字
    c.globalAlpha = 1
    c.fillStyle = TH.accent; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('VS', x, y)
    c.restore()
  }

  // ===== 技能触发特效 =====
  drawSkillEffect(f) {
    const {ctx:c,S} = this
    const {x,y,text,color,alpha,scale,big} = f
    c.save(); c.globalAlpha=alpha
    const sz = big ? 28 : 16
    const sc = scale || 1
    c.fillStyle=color||TH.accent; c.font=`bold ${sz*sc*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.6)'; c.lineWidth=(big?4:3)*S; c.strokeText(text,x,y)
    c.fillText(text,x,y)
    // 大字光晕
    if (big && alpha > 0.5) {
      c.shadowColor = color || '#40e8ff'
      c.shadowBlur = 20*S*alpha
      c.fillText(text,x,y)
      c.shadowBlur = 0
    }
    c.restore()
  }

  // ===== 伤害飘字 =====
  drawDmgFloat(f) {
    const {ctx:c,S} = this
    const {x,y,text,color,alpha,scale} = f
    c.save(); c.globalAlpha=alpha||1
    c.fillStyle=color||TH.danger; c.font=`bold ${(18*(scale||1))*S}px "PingFang SC",sans-serif`
    c.textAlign='center'; c.textBaseline='middle'
    c.strokeStyle='rgba(0,0,0,0.6)'; c.lineWidth=2*S; c.strokeText(text,x,y)
    c.fillText(text,x,y)
    c.restore()
  }

  // ===== 消除数值飘字（棋子处） =====
  drawElimFloat(f) {
    const {ctx:c,S} = this
    const {x,y,text,color,alpha,scale,subText} = f
    c.save(); c.globalAlpha = alpha || 1
    // 主数值（伤害/回复值）
    const sz = (14*(scale||1))*S
    c.font = `bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 2.5*S
    c.strokeText(text, x, y)
    c.fillStyle = color || '#fff'
    c.fillText(text, x, y)
    // 副文字（Combo N）
    if (subText) {
      const subSz = 10*S
      c.font = `bold ${subSz}px "PingFang SC",sans-serif`
      c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 2*S
      c.strokeText(subText, x, y + sz*0.7)
      c.fillStyle = '#ffd700'
      c.fillText(subText, x, y + sz*0.7)
    }
    c.restore()
  }

  // ===== 宠物头像攻击数值（翻滚效果） =====
  drawPetAtkNum(f) {
    const {ctx:c,S} = this
    const {x, y, text, color, alpha, scale, isHeal} = f
    c.save(); c.globalAlpha = alpha || 1
    const sz = (16 * (scale || 1)) * S
    c.font = `bold ${sz}px "PingFang SC",sans-serif`
    c.textAlign = isHeal ? 'right' : 'center'
    c.textBaseline = isHeal ? 'middle' : 'bottom'
    // 发光效果
    c.shadowColor = color || '#ffd700'
    c.shadowBlur = 6 * S
    c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3*S
    c.strokeText(text, x, y)
    c.fillStyle = color || '#ffd700'
    c.fillText(text, x, y)
    c.shadowBlur = 0
    c.restore()
  }

  // 工具 - 颜色加深
  _darken(hex) {
    try {
      const r = parseInt(hex.slice(1,3),16)*0.7
      const g = parseInt(hex.slice(3,5),16)*0.7
      const b = parseInt(hex.slice(5,7),16)*0.7
      return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    } catch(e) { return hex }
  }

  // 工具 - 颜色提亮
  _lighten(hex, amount) {
    try {
      const amt = amount || 0.3
      const r = Math.min(255, parseInt(hex.slice(1,3),16) + 255*amt)
      const g = Math.min(255, parseInt(hex.slice(3,5),16) + 255*amt)
      const b = Math.min(255, parseInt(hex.slice(5,7),16) + 255*amt)
      return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
    } catch(e) { return hex }
  }
}

module.exports = { Render, A, TH }
