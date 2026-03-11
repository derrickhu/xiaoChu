/**
 * 关卡选择界面 — 章节列表 + 关卡卡片（可滚动）
 * 渲染入口：rStageSelect  触摸入口：tStageSelect
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { CHAPTERS, getChapterStages, isChapterUnlocked, isStageUnlocked, getStageAttr } = require('../data/stages')
const MusicMgr = require('../runtime/music')

// 模块内触摸区域
const _rects = {
  backBtnRect: null,
  stageRects: [],  // [{ stageId, rect: [x,y,w,h] }]
}

let _scrollY = 0
let _touchStartY = 0
let _touchLastY = 0
let _scrolling = false

// ===== 渲染 =====
function rStageSelect(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(0)
  c.fillStyle = 'rgba(0,0,0,0.45)'
  c.fillRect(0, 0, W, H)

  const topY = safeTop + 4 * S
  const contentTop = topY + 40 * S
  const contentBottom = H - 12 * S

  // 顶栏
  c.save()
  c.fillStyle = 'rgba(40,30,20,0.85)'
  R.rr(0, topY, W, 36 * S, 0); c.fill()
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = '#E8D5A3'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.fillText('固定关卡', 14 * S, topY + 18 * S)

  // 体力显示
  const stamina = g.storage.currentStamina
  const maxStamina = g.storage.maxStamina
  c.textAlign = 'right'
  c.fillStyle = '#3aaeff'; c.font = `${12*S}px "PingFang SC",sans-serif`
  c.fillText(`⚡${stamina}/${maxStamina}`, W - 14 * S, topY + 18 * S)

  // 返回按钮
  c.textAlign = 'left'
  c.fillStyle = '#ccc'; c.font = `${12*S}px "PingFang SC",sans-serif`
  const backText = '< 返回'
  const backW = c.measureText(backText).width + 16 * S
  _rects.backBtnRect = [6 * S, topY, backW, 36 * S]
  // （返回按钮文字已在标题左侧）

  c.restore()

  // 滚动内容区
  c.save()
  c.beginPath()
  c.rect(0, contentTop, W, contentBottom - contentTop)
  c.clip()

  _rects.stageRects = []
  const poolCount = g.storage.petPoolCount
  const clearRecord = g.storage.stageClearRecord
  const cardW = W - 24 * S
  const cardH = 64 * S
  const cardGap = 10 * S
  const chapterGap = 18 * S
  let curY = contentTop + 8 * S + _scrollY

  for (const chapter of CHAPTERS) {
    const unlocked = isChapterUnlocked(chapter.id, poolCount)

    // 章节标题
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = unlocked ? '#E8D5A3' : '#888'
    c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.fillText(`${chapter.name}`, 14 * S, curY + 10 * S)

    if (!unlocked) {
      c.fillStyle = '#666'; c.font = `${10*S}px "PingFang SC",sans-serif`
      c.fillText(`🔒 灵宠池需达 ${chapter.unlockPool} 只解锁`, 14 * S, curY + 28 * S)
      curY += 42 * S + chapterGap
      continue
    }

    c.fillStyle = '#887'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText(chapter.desc, 14 * S, curY + 26 * S)
    curY += 38 * S

    // 关卡卡片
    const stages = getChapterStages(chapter.id)
    for (const stage of stages) {
      const stageUnlocked = isStageUnlocked(stage.id, clearRecord, poolCount)
      const cardX = 12 * S
      const cardRect = [cardX, curY, cardW, cardH]

      // 卡片背景
      c.fillStyle = stageUnlocked ? 'rgba(60,50,35,0.85)' : 'rgba(40,35,30,0.6)'
      R.rr(cardX, curY, cardW, cardH, 8 * S); c.fill()
      if (stageUnlocked) {
        c.strokeStyle = 'rgba(200,180,120,0.3)'; c.lineWidth = 1 * S
        R.rr(cardX, curY, cardW, cardH, 8 * S); c.stroke()
      }

      const indent = cardX + 12 * S
      const midY = curY + cardH / 2

      if (!stageUnlocked) {
        // 未解锁
        c.textAlign = 'left'; c.textBaseline = 'middle'
        c.fillStyle = '#666'; c.font = `${12*S}px "PingFang SC",sans-serif`
        c.fillText(`🔒 ${stage.name}`, indent, midY - 6 * S)
        if (stage.unlockCondition && stage.unlockCondition.prevStage) {
          c.fillStyle = '#555'; c.font = `${9*S}px "PingFang SC",sans-serif`
          const _prev = stages.find(s => s.id === stage.unlockCondition.prevStage)
          const prevName = (_prev && _prev.name) || '前置关卡'
          c.fillText(`需通关：${prevName}`, indent, midY + 10 * S)
        }
      } else {
        // 已解锁卡片
        const attr = getStageAttr(stage.id)
        const attrColor = ATTR_COLOR[attr]

        // 名称
        c.textAlign = 'left'; c.textBaseline = 'middle'
        c.fillStyle = '#E8D5A3'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
        c.fillText(stage.name, indent, curY + 16 * S)

        // 属性 | 波次 | 每日剩余
        c.fillStyle = attrColor ? attrColor.main : '#ccc'
        c.font = `${10*S}px "PingFang SC",sans-serif`
        const attrName = ATTR_NAME[attr] || '?'
        const waveCount = stage.waves.length
        const dailyUsed = g.storage.getStageDailyCount(stage.id)
        const dailyLeft = stage.dailyLimit - dailyUsed
        c.fillText(`${attrName}属性 | ${waveCount}波 | 今日${dailyLeft}/${stage.dailyLimit}`, indent, curY + 34 * S)

        // 通关状态 + 评价
        const bestRating = g.storage.getStageBestRating(stage.id)
        if (bestRating) {
          c.textAlign = 'right'
          const stars = bestRating === 'S' ? '★★★' : bestRating === 'A' ? '★★☆' : '★☆☆'
          c.fillStyle = bestRating === 'S' ? '#ffd700' : bestRating === 'A' ? '#c0c0c0' : '#a87040'
          c.font = `bold ${12*S}px "PingFang SC",sans-serif`
          c.fillText(`${stars} ${bestRating}`, cardX + cardW - 12 * S, curY + 16 * S)
          c.fillStyle = '#8a8'; c.font = `${9*S}px "PingFang SC",sans-serif`
          c.fillText('已通关', cardX + cardW - 12 * S, curY + 34 * S)
        }

        // 体力消耗
        c.textAlign = 'right'; c.fillStyle = '#8ac8ff'
        c.font = `${10*S}px "PingFang SC",sans-serif`
        c.fillText(`⚡${stage.staminaCost}`, cardX + cardW - 12 * S, curY + cardH - 14 * S)

        _rects.stageRects.push({ stageId: stage.id, rect: cardRect })
      }

      curY += cardH + cardGap
    }

    curY += chapterGap
  }

  // 记录内容总高度用于限制滚动
  const totalContentH = curY - _scrollY - contentTop
  const maxScroll = Math.max(0, totalContentH - (contentBottom - contentTop))
  if (_scrollY < -maxScroll) _scrollY = -maxScroll
  if (_scrollY > 0) _scrollY = 0

  c.restore()

  // 底部返回按钮
  const btnW = W * 0.4, btnH = 40 * S
  const btnX = (W - btnW) / 2, btnY = contentBottom - btnH - 8 * S
  R.drawBtn(btnX, btnY, btnW, btnH, '返回首页', '#5a4a3a', 14)
  _rects.backBtnRect = [btnX, btnY, btnW, btnH]
}

// ===== 触摸 =====
function tStageSelect(g, x, y, type) {
  if (type === 'start') {
    _touchStartY = y
    _touchLastY = y
    _scrolling = false
    return
  }

  if (type === 'move') {
    const dy = y - _touchLastY
    _touchLastY = y
    if (Math.abs(y - _touchStartY) > 5 * V.S) _scrolling = true
    if (_scrolling) _scrollY += dy
    return
  }

  if (type === 'end') {
    if (_scrolling) return

    // 返回按钮
    if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
      g.scene = 'title'
      return
    }

    // 关卡卡片点击 → 进入关卡信息页
    for (const item of _rects.stageRects) {
      if (g._hitRect(x, y, ...item.rect)) {
        g._selectedStageId = item.stageId
        g._stageInfoEnemyDetail = null
        g.scene = 'stageInfo'
        return
      }
    }
  }
}

function resetScroll() {
  _scrollY = 0
}

module.exports = { rStageSelect, tStageSelect, resetScroll }
