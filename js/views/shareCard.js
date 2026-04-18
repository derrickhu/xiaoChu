/**
 * 动态炫耀卡合成 — shareCard
 *
 * 职责：按情绪峰值场景合成 tempFilePath，用作 shareAppMessage({ imageUrl })
 *
 * 流程：
 *   1. 取 SHARE_SCENES[sceneKey] → cardTemplate
 *   2. 离屏 canvas(750×600) 画底图 + 玩家昵称/头像 + 战绩文案 + 小灵 + 邀请文字
 *   3. canvas.toTempFilePath(fileType='jpg') 返回 tempFilePath
 *   4. 失败回落 null（shareCore 自动用 cfg.imageUrl 静态图）
 *
 * 设计要点：
 *   - 纯离屏，不打扰主画布
 *   - 底图缺失 / 平台不支持 createOffscreenCanvas 时静默回落
 *   - 用户头像网络加载失败 → 画默认圆形 + "仙" 字
 *   - 卡片尺寸 750×600（5:4）是微信分享封面推荐比
 */
const P = require('../platform')
const { SHARE_SCENES } = require('../data/shareConfig')
const { LING } = require('../data/lingIdentity')

// ===== 尺寸常量 =====
const CARD_W = 750
const CARD_H = 600
const BASE_DIR = 'assets/share/card_base/'

// ===== 图片缓存（避免反复 createImage / 下载） =====
const _imgCache = new Map()

function _loadImage(src) {
  if (!src) return Promise.resolve(null)
  if (_imgCache.has(src)) return Promise.resolve(_imgCache.get(src))
  return new Promise((resolve) => {
    try {
      const img = P.createImage()
      img.onload = () => { _imgCache.set(src, img); resolve(img) }
      img.onerror = () => resolve(null)
      img.src = src
    } catch (_e) { resolve(null) }
  })
}

// ===== 文本裁剪：超宽加省略号 =====
function _clipText(ctx, text, maxWidth) {
  if (!text) return ''
  if (ctx.measureText(text).width <= maxWidth) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (ctx.measureText(text.substring(0, mid) + '...').width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.substring(0, lo) + '...'
}

// ===== 画圆形头像（带金边） =====
function _drawCircleAvatar(ctx, img, cx, cy, r) {
  ctx.save()
  // 金边
  ctx.beginPath()
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(220,180,80,0.95)'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.clip()
  if (img && img.width > 0) {
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  } else {
    // 降级：默认"仙"字
    ctx.fillStyle = '#3a2b5a'
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
    ctx.fillStyle = '#ffe082'
    ctx.font = `bold ${r * 1.1}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('仙', cx, cy + r * 0.05)
  }
  ctx.restore()
}

// ===== 画带描边的文字（金字 / 红字） =====
function _drawStrokedText(ctx, text, x, y, opts) {
  ctx.save()
  ctx.textAlign = opts.align || 'center'
  ctx.textBaseline = opts.baseline || 'middle'
  ctx.font = `${opts.bold ? 'bold ' : ''}${opts.size}px "PingFang SC",sans-serif`
  if (opts.strokeColor) {
    ctx.lineWidth = opts.strokeWidth || 6
    ctx.strokeStyle = opts.strokeColor
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)
  }
  ctx.fillStyle = opts.color
  ctx.fillText(text, x, y)
  ctx.restore()
}

// ===== 场景文本定义：(sceneKey -> (data) -> { mainText, subText }) =====
//   底图留白是中下部：mainText 画在偏上，subText 画在下方
const _sceneText = {
  firstPet: (d) => ({
    mainText: `收服「${d.petName || '首只灵宠'}」`,
    subText: '修仙之旅 · 伙伴同行',
  }),
  stageFirstClear: (d) => ({
    mainText: d.isFinalBoss ? `终章通关 · ${d.stageName || ''}` : `首通 · ${d.stageName || '秘境'}`,
    subText: d.rating ? `${d.rating} 评价` : '',
  }),
  firstSRating: (d) => ({
    mainText: `S 评价首度达成`,
    subText: `${d.stageName ? d.stageName + ' · ' : ''}${d.turns ? d.turns + ' 回合' : ''}`,
  }),
  petStarUp: (d) => ({
    mainText: `${d.petName || '灵宠'} · ${d.star || ''}★`,
    subText: '养成之道 · 步步登天',
  }),
  chapterComplete: (d) => ({
    mainText: `${d.chapterName || '章节'} · 圆满`,
    subText: '下一卷画等你继续',
  }),
  towerNewBest: (d) => ({
    mainText: `通天塔 · 第 ${d.floor || '?'} 层`,
    subText: d.turns ? `${d.turns} 回合登顶` : '新纪录达成',
  }),
}

// ===== 将 OffscreenCanvas.toTempFilePath 包成 Promise =====
function _canvasToTemp(canvas) {
  return new Promise((resolve) => {
    try {
      canvas.toTempFilePath({
        fileType: 'jpg',
        quality: 0.9,
        destWidth: CARD_W,
        destHeight: CARD_H,
        success: (res) => resolve(res && res.tempFilePath ? res.tempFilePath : null),
        fail: () => resolve(null),
      })
    } catch (_e) { resolve(null) }
  })
}

// ===== 超时包装：真机上 _loadImage / toTempFilePath 偶发挂起不 resolve =====
// 没有超时时，上游 shareCelebrate 弹窗会永远停留在"炫耀卡合成中..."。
// 给 generateCard 一个硬超时（默认 4000ms），超时按失败处理，让上游降级展示底图。
function _withTimeout(promise, ms, fallback) {
  return new Promise((resolve) => {
    let settled = false
    const t = setTimeout(() => { if (!settled) { settled = true; resolve(fallback) } }, ms)
    promise.then(
      (v) => { if (!settled) { settled = true; clearTimeout(t); resolve(v) } },
      () => { if (!settled) { settled = true; clearTimeout(t); resolve(fallback) } },
    )
  })
}

/**
 * 合成一张炫耀卡
 * @param {object} storage - 用于取 userInfo.nickName / avatarUrl
 * @param {string} sceneKey - SHARE_SCENES 中的场景 key
 * @param {object} [data] - 场景数据（petName / stageName / rating / floor / turns / chapterName 等）
 * @returns {Promise<string|null>} tempFilePath 或 null（回落静态图）
 */
async function generateCard(storage, sceneKey, data) {
  return _withTimeout(_generateCardInner(storage, sceneKey, data), 4000, null)
}

async function _generateCardInner(storage, sceneKey, data) {
  const cfg = SHARE_SCENES[sceneKey]
  if (!cfg || !cfg.useCard || !cfg.cardTemplate) return null
  if (!P.createOffscreenCanvas) return null

  const textFn = _sceneText[sceneKey]
  if (!textFn) return null
  const txt = textFn(data || {})

  // 并行预加载：底图 + 小灵头像 + 用户头像
  // 每张图自带 3000ms 超时，避免任一张卡住就拖垮整张卡（头像/底图任一挂起都不会让 Promise.all 吊死）
  const ui = (storage && storage.userInfo) || {}
  const [bgImg, lingImg, avatarImg] = await Promise.all([
    _withTimeout(_loadImage(`${BASE_DIR}${cfg.cardTemplate}.jpg`), 3000, null),
    _withTimeout(_loadImage(LING && LING.avatar), 3000, null),
    _withTimeout(_loadImage(ui.avatarUrl), 3000, null),
  ])
  if (!bgImg) return null

  let canvas
  try {
    canvas = P.createOffscreenCanvas({ type: '2d', width: CARD_W, height: CARD_H })
  } catch (_e) { return null }
  const ctx = canvas.getContext('2d')

  // 1) 底图铺满
  ctx.drawImage(bgImg, 0, 0, CARD_W, CARD_H)

  // 2) 半透明深色蒙层覆盖下方 45% 区域，保证文字可读
  //    蒙层从 55% 位置开始淡入，到底部完全覆盖
  const maskTop = CARD_H * 0.52
  const grad = ctx.createLinearGradient(0, maskTop, 0, CARD_H)
  grad.addColorStop(0, 'rgba(10,8,20,0)')
  grad.addColorStop(0.35, 'rgba(10,8,20,0.55)')
  grad.addColorStop(1, 'rgba(10,8,20,0.85)')
  ctx.fillStyle = grad
  ctx.fillRect(0, maskTop, CARD_W, CARD_H - maskTop)

  // 3) 主标题（金色 · 黑描边）
  _drawStrokedText(ctx, txt.mainText, CARD_W / 2, CARD_H * 0.62, {
    size: 42, bold: true,
    color: '#ffe082',
    strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 6,
  })

  // 4) 副标题（浅金）
  if (txt.subText) {
    _drawStrokedText(ctx, txt.subText, CARD_W / 2, CARD_H * 0.72, {
      size: 22,
      color: '#f5d08a',
      strokeColor: 'rgba(0,0,0,0.55)', strokeWidth: 4,
    })
  }

  // 5) 玩家区（左下角头像 + 昵称 + 境界头衔）
  const avatarR = 34
  const avatarCx = 60
  const avatarCy = CARD_H - 70
  _drawCircleAvatar(ctx, avatarImg, avatarCx, avatarCy, avatarR)
  const nickName = _clipText(ctx, ui.nickName || '仙途修者', 280)
  _drawStrokedText(ctx, nickName, avatarCx + avatarR + 16, avatarCy - 10, {
    size: 22, bold: true,
    color: '#ffffff',
    strokeColor: 'rgba(0,0,0,0.7)', strokeWidth: 4,
    align: 'left',
  })
  // 副标：境界头衔 + 邀请语（A1：境界由修炼 Lv 决定）
  let subLabel = '邀你同游灵宠消消塔'
  try {
    const { getRealmByLv } = require('../data/cultivationConfig')
    const info = getRealmByLv((storage && storage.cultLv) || 0)
    if (info && info.fullName && !info.isMortal) {
      subLabel = `境界·${info.fullName} · 邀你同游`
    }
  } catch (_e) { /* 兜底使用默认副标 */ }
  _drawStrokedText(ctx, subLabel, avatarCx + avatarR + 16, avatarCy + 16, {
    size: 15,
    color: '#c8b280',
    strokeColor: 'rgba(0,0,0,0.5)', strokeWidth: 3,
    align: 'left',
  })

  // 6) 小灵挂件（右下角圆形小头像 + 品牌）
  const lingR = 26
  const lingCx = CARD_W - 60
  const lingCy = CARD_H - 70
  _drawCircleAvatar(ctx, lingImg, lingCx, lingCy, lingR)
  _drawStrokedText(ctx, (LING && LING.speaker) || '仙宠·小灵', lingCx, lingCy + lingR + 18, {
    size: 13,
    color: '#ffd580',
    strokeColor: 'rgba(0,0,0,0.6)', strokeWidth: 3,
  })

  // 7) 导出临时文件
  return await _canvasToTemp(canvas)
}

// 清理缓存（主要是测试/热更用）
function clearCache() { _imgCache.clear() }

// 供 shareCelebrate 在动态合成失败时做降级预览：返回该场景的静态底图路径
function getCardTemplatePath(sceneKey) {
  const cfg = SHARE_SCENES[sceneKey]
  if (!cfg || !cfg.cardTemplate) return null
  return `${BASE_DIR}${cfg.cardTemplate}.jpg`
}

module.exports = { generateCard, clearCache, getCardTemplatePath, CARD_W, CARD_H }
