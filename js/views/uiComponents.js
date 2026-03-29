/**
 * 统一 UI 面板组件 —— 精美中国风游戏弹窗
 * 投影 + 多层渐变 + 双边框 + 金色装饰条 + 角落菱形装饰
 *
 * 使用方式：
 *   const { drawPanel, wrapText } = require('./uiComponents')
 *   drawPanel(c, S, x, y, w, h, { ribbonH: 44*S })
 */

// ===== 圆角矩形路径（自包含，不依赖外部 R） =====
function _rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y); c.lineTo(x + w - r, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()
}

/**
 * 绘制精美面板底板（背景 + 阴影 + 双边框 + 装饰条 + 角落装饰）
 * 内容（标题/正文/图标等）由调用方自行绘制
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S  缩放倍率
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {object} [opts]
 * @param {number} [opts.radius]     圆角半径，默认 14*S
 * @param {number} [opts.ribbonH]    顶部装饰条高度，0 = 不绘制
 * @param {boolean} [opts.shadow]    是否绘制投影，默认 true
 * @param {boolean} [opts.corners]   是否绘制角落菱形，默认 true
 * @returns {{ ribbonCY: number }}   装饰条垂直中心 Y（便于在条上放标题文字）
 */
function drawPanel(c, S, x, y, w, h, opts) {
  opts = opts || {}
  const r = opts.radius != null ? opts.radius : 14 * S
  const ribbonH = opts.ribbonH || 0
  const hasShadow = opts.shadow !== false
  const hasCorners = opts.corners !== false

  // ---- 1. 背景 + 投影 ----
  c.save()
  if (hasShadow) {
    c.shadowColor = 'rgba(40,20,0,0.45)'
    c.shadowBlur = 20 * S
    c.shadowOffsetX = 0
    c.shadowOffsetY = 5 * S
  }
  var bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#fffef6')
  bg.addColorStop(0.12, '#faf4e4')
  bg.addColorStop(0.5, '#f2eace')
  bg.addColorStop(1, '#e8dbb8')
  _rr(c, x, y, w, h, r)
  c.fillStyle = bg
  c.fill()
  c.restore()

  // ---- 2. 外边框（金色） ----
  _rr(c, x, y, w, h, r)
  c.strokeStyle = 'rgba(175,135,48,0.8)'
  c.lineWidth = 2.5 * S
  c.stroke()

  // ---- 3. 内高光边框 ----
  var ins = 3.5 * S
  var ir = Math.max(2, r - ins)
  _rr(c, x + ins, y + ins, w - ins * 2, h - ins * 2, ir)
  c.strokeStyle = 'rgba(230,205,130,0.45)'
  c.lineWidth = 1 * S
  c.stroke()

  // ---- 4. 装饰条（金色 metallic 渐变） ----
  var ribbonCY = 0
  if (ribbonH > 0) {
    c.save()
    _rr(c, x + 1, y + 1, w - 2, ribbonH, r)
    c.clip()

    var rib = c.createLinearGradient(x, y, x + w, y)
    rib.addColorStop(0, 'rgba(165,125,40,0.92)')
    rib.addColorStop(0.25, 'rgba(198,162,58,0.95)')
    rib.addColorStop(0.5, 'rgba(230,198,85,1)')
    rib.addColorStop(0.75, 'rgba(198,162,58,0.95)')
    rib.addColorStop(1, 'rgba(165,125,40,0.92)')
    c.fillStyle = rib
    c.fillRect(x, y, w, ribbonH)

    // 顶部高光线
    c.strokeStyle = 'rgba(255,240,180,0.4)'
    c.lineWidth = 1 * S
    c.beginPath()
    c.moveTo(x + r, y + 2 * S)
    c.lineTo(x + w - r, y + 2 * S)
    c.stroke()

    // 底部分割线
    c.strokeStyle = 'rgba(140,105,30,0.4)'
    c.lineWidth = 1 * S
    c.beginPath()
    c.moveTo(x + 8 * S, y + ribbonH - 0.5)
    c.lineTo(x + w - 8 * S, y + ribbonH - 0.5)
    c.stroke()

    c.restore()
    ribbonCY = y + ribbonH / 2
  }

  // ---- 5. 角落菱形装饰 ----
  if (hasCorners) {
    var co = 10 * S
    var ds = 3.5 * S
    c.fillStyle = 'rgba(195,160,55,0.65)'
    // 有装饰条时跳过顶部两角（会融入金色条）
    var pts = ribbonH > 0
      ? [[x + co, y + h - co], [x + w - co, y + h - co]]
      : [[x + co, y + co], [x + w - co, y + co],
         [x + co, y + h - co], [x + w - co, y + h - co]]
    for (var i = 0; i < pts.length; i++) {
      var cx = pts[i][0], cy = pts[i][1]
      c.beginPath()
      c.moveTo(cx, cy - ds)
      c.lineTo(cx + ds, cy)
      c.lineTo(cx, cy + ds)
      c.lineTo(cx - ds, cy)
      c.closePath()
      c.fill()
    }
  }

  return { ribbonCY: ribbonCY }
}

/**
 * 在装饰条左侧绘制图标圆（白底 + 图标字符）
 * 适用于带 ribbon 的面板
 */
function drawRibbonIcon(c, S, x, ribbonCY, icon) {
  var iconR = 22 * S
  var iconX = x + 38 * S
  c.beginPath()
  c.arc(iconX, ribbonCY, iconR, 0, Math.PI * 2)
  c.fillStyle = 'rgba(255,255,255,0.3)'
  c.fill()
  c.strokeStyle = 'rgba(255,255,255,0.7)'
  c.lineWidth = 1.5 * S
  c.stroke()
  c.fillStyle = '#5a3000'
  c.font = 'bold ' + (16 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(icon, iconX, ribbonCY)
}

/**
 * 文字自动换行（支持 \n 显式换行 + 宽度自动换行）
 */
function wrapText(c, text, maxWidth) {
  var paragraphs = text.split('\n')
  var lines = []
  for (var p = 0; p < paragraphs.length; p++) {
    var para = paragraphs[p]
    if (para.length === 0) { lines.push(''); continue }
    var line = ''
    for (var i = 0; i < para.length; i++) {
      var test = line + para[i]
      if (c.measureText(test).width > maxWidth && line.length > 0) {
        lines.push(line)
        line = para[i]
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

module.exports = { drawPanel, drawRibbonIcon, wrapText }
