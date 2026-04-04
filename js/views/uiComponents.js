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
 * 在装饰条左侧绘制图标（小菱形底座 + 图标字符，与金色条融合）
 * 适用于带 ribbon 的面板
 */
function drawRibbonIcon(c, S, x, ribbonCY, icon) {
  var iconX = x + 28 * S
  var ds = 12 * S
  // 菱形金色底座
  c.save()
  c.beginPath()
  c.moveTo(iconX, ribbonCY - ds)
  c.lineTo(iconX + ds, ribbonCY)
  c.lineTo(iconX, ribbonCY + ds)
  c.lineTo(iconX - ds, ribbonCY)
  c.closePath()
  c.fillStyle = 'rgba(90,48,0,0.25)'
  c.fill()
  c.strokeStyle = 'rgba(255,240,180,0.5)'
  c.lineWidth = 1 * S
  c.stroke()
  // 图标字符
  c.fillStyle = '#fff'
  c.font = 'bold ' + (14 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.shadowColor = 'rgba(255,240,180,0.6)'; c.shadowBlur = 4 * S
  c.fillText(icon, iconX, ribbonCY)
  c.restore()
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

/**
 * 全屏弹窗对话框（遮罩 + drawPanel + 标题栏 + 入场动画 + 底部按钮）
 * 高频复用的"精美提示/指南/确认"弹窗壳子，内容区由调用方通过 renderContent 回调自行绘制
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} W  画布宽
 * @param {number} H  画布高
 * @param {object} opts
 * @param {string}   opts.title          标题文字
 * @param {string}   [opts.icon]         装饰条左侧图标字符（如 '💡'）
 * @param {number}   [opts.panelW]       面板宽度，默认 W*0.86
 * @param {number}   [opts.panelH]       面板高度，默认 240*S
 * @param {number}   [opts.timer]        当前帧计数（用于入场动画，0 开始递增）
 * @param {number}   [opts.frame]        全局帧号（用于脉冲动画）
 * @param {string}   [opts.btnText]      底部按钮文字，默认 '知道了'；传 null 则不绘制按钮
 * @param {Function} opts.renderContent  内容区回调 (c, S, contentArea) => void
 *   contentArea = { x, y, w, h } 可用内容区域矩形
 * @param {object}   [opts.rr]           圆角矩形函数所在对象（需有 rr 方法），用于底部按钮
 * @returns {{ panelX, panelY, panelW, panelH, btnRect }}
 */
function drawDialog(c, S, W, H, opts) {
  opts = opts || {}
  var timer = opts.timer || 0
  var frame = opts.frame || 0
  var alpha = Math.min(1, timer / 15)

  c.save()

  // ---- 1. 全屏径向渐变遮罩 ----
  c.globalAlpha = alpha * 0.65
  var maskGrd = c.createRadialGradient(W / 2, H * 0.42, 0, W / 2, H * 0.42, H * 0.7)
  maskGrd.addColorStop(0, 'rgba(20,15,5,0.3)')
  maskGrd.addColorStop(1, 'rgba(10,8,2,0.95)')
  c.fillStyle = maskGrd
  c.fillRect(0, 0, W, H)
  c.globalAlpha = alpha

  // ---- 2. 面板尺寸与入场动画 ----
  var panelW = opts.panelW || W * 0.86
  var panelH = opts.panelH || 240 * S
  var px = (W - panelW) / 2
  var targetY = (H - panelH) / 2 - 10 * S
  var py = timer < 15
    ? targetY + (H * 0.15) * (1 - timer / 15)
    : targetY
  var scale = timer < 12
    ? 0.85 + 0.15 * (timer / 12) + 0.04 * Math.sin(timer / 12 * Math.PI)
    : 1

  c.save()
  c.translate(W / 2, py + panelH / 2)
  c.scale(scale, scale)
  c.translate(-W / 2, -(py + panelH / 2))

  // ---- 3. 绘制面板 ----
  var ribbonH = 44 * S
  var panelResult = drawPanel(c, S, px, py, panelW, panelH, { ribbonH: ribbonH })
  var ribbonCY = panelResult.ribbonCY

  // ---- 4. 标题栏（图标与文字内联居中） ----
  var titleText = opts.title || ''
  c.font = 'bold ' + (16 * S) + 'px "PingFang SC",sans-serif'
  if (opts.icon) {
    // 图标+标题作为整体居中
    var iconGap = 6 * S
    var titleW = c.measureText(titleText).width
    var iconFontSz = 16 * S
    var totalTitleW = iconFontSz + iconGap + titleW
    var titleStartX = W / 2 - totalTitleW / 2
    // 图标
    c.fillStyle = '#fff'
    c.font = (iconFontSz) + 'px "PingFang SC",sans-serif'
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.shadowColor = 'rgba(255,240,180,0.5)'; c.shadowBlur = 3 * S
    c.fillText(opts.icon, titleStartX, ribbonCY)
    c.shadowBlur = 0
    // 标题文字
    c.fillStyle = '#5a3000'
    c.font = 'bold ' + (16 * S) + 'px "PingFang SC",sans-serif'
    c.fillText(titleText, titleStartX + iconFontSz + iconGap, ribbonCY)
  } else {
    c.fillStyle = '#5a3000'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(titleText, W / 2, ribbonCY)
  }

  // ---- 5. 内容区回调 ----
  var contentArea = {
    x: px + 22 * S,
    y: py + ribbonH + 16 * S,
    w: panelW - 44 * S,
    h: panelH - ribbonH - 32 * S,
  }
  if (typeof opts.renderContent === 'function') {
    opts.renderContent(c, S, contentArea)
  }

  c.restore()

  // ---- 6. 底部按钮（面板外，不受缩放影响） ----
  var btnRect = null
  var btnText = opts.btnText !== undefined ? opts.btnText : '知道了'
  if (btnText) {
    var btnW = 140 * S, btnH = 36 * S
    var btnX = (W - btnW) / 2, btnY = py + panelH + 18 * S
    var pulse = 0.7 + 0.3 * Math.sin(frame * 0.08)

    c.globalAlpha = alpha * pulse
    var btnGrd = c.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
    btnGrd.addColorStop(0, 'rgba(198,162,58,0.9)')
    btnGrd.addColorStop(1, 'rgba(165,125,40,0.9)')
    c.fillStyle = btnGrd
    _rr(c, btnX, btnY, btnW, btnH, btnH / 2); c.fill()
    c.strokeStyle = 'rgba(255,240,180,0.5)'; c.lineWidth = 1 * S
    _rr(c, btnX, btnY, btnW, btnH, btnH / 2); c.stroke()

    c.globalAlpha = alpha
    c.fillStyle = '#4a2800'
    c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(btnText, W / 2, btnY + btnH / 2)

    btnRect = [btnX, btnY, btnW, btnH]
  }

  c.restore()
  return { panelX: px, panelY: py, panelW: panelW, panelH: panelH, btnRect: btnRect }
}

/**
 * 图标+标签+描述 的内容行（适用于提示面板、指南列表等）
 * icon 支持两种模式：
 *   字符串 → 绘制在圆形底座内（如 '♥'）
 *   对象 { shape:'sword'|'circle'|'heart', color } → 手绘矢量图标（跨平台一致）
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} x          行起始 X
 * @param {number} y          行起始 Y
 * @param {number} lineH      行高
 * @param {string|object} icon  图标
 * @param {string} label      加粗标签
 * @param {string} desc       描述文字
 * @param {string} labelColor 标签/图标颜色
 * @param {string} [descColor] 描述颜色，默认 '#6B5B50'
 */
function drawTipRow(c, S, x, y, lineH, icon, label, desc, labelColor, descColor) {
  var iconR = 10 * S
  var iconCX = x + iconR, iconCY = y + lineH / 2

  c.save()
  // 圆形底座（柔和填充+边框）
  c.fillStyle = labelColor + '18'
  c.beginPath(); c.arc(iconCX, iconCY, iconR, 0, Math.PI * 2); c.fill()
  c.strokeStyle = labelColor + '44'; c.lineWidth = 1 * S
  c.beginPath(); c.arc(iconCX, iconCY, iconR, 0, Math.PI * 2); c.stroke()

  // 根据 icon 类型绘制图标
  if (icon && typeof icon === 'object') {
    _drawTipIcon(c, S, iconCX, iconCY, iconR, icon, labelColor)
  } else {
    c.fillStyle = labelColor
    c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(icon || '', iconCX, iconCY)
  }
  c.restore()

  // 标签
  var textLeft = x + iconR * 2 + 8 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = labelColor
  c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
  c.fillText(label, textLeft, iconCY)
  // 描述
  var labelW = c.measureText(label).width
  c.fillStyle = descColor || '#6B5B50'
  c.font = (10.5 * S) + 'px "PingFang SC",sans-serif'
  c.fillText(desc, textLeft + labelW + 6 * S, iconCY)
}

/**
 * 内部：绘制手绘矢量图标（不依赖 Unicode，跨平台一致）
 */
function _drawTipIcon(c, S, cx, cy, r, iconObj, fallbackColor) {
  var color = iconObj.color || fallbackColor
  var shape = iconObj.shape
  c.fillStyle = color
  c.strokeStyle = color

  if (shape === 'sword' || shape === 'burst' || shape === 'bolt') {
    // 闪电⚡（通用攻击/伤害符号，与棋盘标记一致）
    var bw = r * 1.1, bh = r * 1.5
    var blx = cx - bw * 0.3, bty = cy - bh * 0.5
    c.beginPath()
    c.moveTo(blx + bw * 0.55, bty)
    c.lineTo(blx + bw * 0.15, bty + bh * 0.48)
    c.lineTo(blx + bw * 0.5,  bty + bh * 0.44)
    c.lineTo(blx + bw * 0.2,  bty + bh)
    c.lineTo(blx + bw * 0.85, bty + bh * 0.38)
    c.lineTo(blx + bw * 0.48, bty + bh * 0.42)
    c.lineTo(blx + bw * 0.75, bty + bh * 0.05)
    c.closePath()
    c.fill()
  } else if (shape === 'dim') {
    // 暗淡圆（虚线圆环表示无效）
    c.globalAlpha = 0.5
    c.setLineDash([2 * S, 2 * S]); c.lineWidth = 1.5 * S
    c.beginPath(); c.arc(cx, cy, r * 0.5, 0, Math.PI * 2); c.stroke()
    c.setLineDash([])
    c.globalAlpha = 1
  } else if (shape === 'heart') {
    // 实心爱心
    var s = r * 0.45
    c.beginPath()
    c.moveTo(cx, cy + s * 0.7)
    c.bezierCurveTo(cx - s * 1.3, cy - s * 0.1, cx - s * 0.7, cy - s * 1.1, cx, cy - s * 0.45)
    c.bezierCurveTo(cx + s * 0.7, cy - s * 1.1, cx + s * 1.3, cy - s * 0.1, cx, cy + s * 0.7)
    c.fill()
  }
}

/**
 * 水平分割线（金色，适用于面板内分区）
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} x1   左端 X
 * @param {number} x2   右端 X
 * @param {number} y    Y 坐标
 */
function drawDivider(c, S, x1, x2, y) {
  c.strokeStyle = 'rgba(175,135,48,0.25)'
  c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke()
}

/**
 * 游戏风格确认弹窗（双按钮：取消 + 确认）
 * 用于替代系统 showModal，保持游戏 UI 一致性。
 *
 * 调用方在 g 上设置 g._confirmDialog = { title, content, confirmText, cancelText, onConfirm, onCancel, timer:0 }
 * 每帧调 drawConfirmDialog(g) 绘制；触摸用 handleConfirmDialogTouch(g,x,y) 处理点击。
 * 弹窗结束后自动置 g._confirmDialog = null。
 *
 * @param {object} g - 游戏状态
 */
function drawConfirmDialog(g) {
  var d = g._confirmDialog
  if (!d) return
  var V = require('./env')
  var c = V.ctx, S = V.S, W = V.W, H = V.H, R = V.R
  d.timer = (d.timer || 0) + 1
  var timer = d.timer
  var alpha = Math.min(1, timer / 12)

  c.save()

  // 全屏遮罩
  c.globalAlpha = alpha * 0.65
  c.fillStyle = 'rgba(10,8,2,0.85)'
  c.fillRect(0, 0, W, H)
  c.globalAlpha = alpha

  // 面板尺寸
  var panelW = W * 0.82
  c.font = (12 * S) + 'px "PingFang SC",sans-serif'
  var contentLines = wrapText(c, d.content || '', panelW - 52 * S)
  var lineH = 20 * S
  var contentH = contentLines.length * lineH
  var ribbonH = 42 * S
  var btnAreaH = 52 * S
  var panelH = ribbonH + 24 * S + contentH + 18 * S + btnAreaH + 18 * S
  var px = (W - panelW) / 2
  var targetY = (H - panelH) / 2 - 8 * S
  var py = timer < 12 ? targetY + 30 * S * (1 - timer / 12) : targetY

  // 入场缩放
  var scale = timer < 10 ? 0.88 + 0.12 * (timer / 10) : 1
  c.save()
  c.translate(W / 2, py + panelH / 2)
  c.scale(scale, scale)
  c.translate(-W / 2, -(py + panelH / 2))

  // 面板底板
  var panelResult = drawPanel(c, S, px, py, panelW, panelH, { ribbonH: ribbonH })
  var ribbonCY = panelResult.ribbonCY

  // 标题
  c.fillStyle = '#5a3000'
  c.font = 'bold ' + (15 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(d.title || '提示', W / 2, ribbonCY)

  // 正文（自动换行）
  var textY = py + ribbonH + 24 * S
  c.fillStyle = '#4a3820'
  c.font = (12 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'top'
  for (var i = 0; i < contentLines.length; i++) {
    c.fillText(contentLines[i], W / 2, textY + i * lineH)
  }

  c.restore() // 缩放 restore

  // 双按钮（面板底部，不受缩放影响以保持点击精度）
  var btnGap = 14 * S
  var btnW = (panelW - 52 * S - btnGap) / 2
  var btnH = 38 * S
  var btnY = py + panelH - btnAreaH - 8 * S
  var btnLeftX = px + 26 * S
  var btnRightX = btnLeftX + btnW + btnGap

  // 取消按钮（浅灰底 + 金边）
  _rr(c, btnLeftX, btnY, btnW, btnH, btnH / 2)
  c.fillStyle = 'rgba(220,210,190,0.95)'; c.fill()
  c.strokeStyle = 'rgba(175,135,48,0.5)'; c.lineWidth = 1.5 * S
  _rr(c, btnLeftX, btnY, btnW, btnH, btnH / 2); c.stroke()
  c.fillStyle = '#6B5B40'
  c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(d.cancelText || '取消', btnLeftX + btnW / 2, btnY + btnH / 2)

  // 确认按钮（金色渐变底）
  var cfmGrd = c.createLinearGradient(btnRightX, btnY, btnRightX, btnY + btnH)
  cfmGrd.addColorStop(0, '#B8451A'); cfmGrd.addColorStop(0.5, '#9C3512'); cfmGrd.addColorStop(1, '#7A2A0E')
  _rr(c, btnRightX, btnY, btnW, btnH, btnH / 2)
  c.fillStyle = cfmGrd; c.fill()
  c.strokeStyle = '#D4A843'; c.lineWidth = 1.5 * S
  _rr(c, btnRightX, btnY, btnW, btnH, btnH / 2); c.stroke()
  // 高光
  c.save(); c.globalAlpha = 0.18
  var hl = c.createLinearGradient(btnRightX, btnY, btnRightX, btnY + btnH * 0.4)
  hl.addColorStop(0, '#fff'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hl
  _rr(c, btnRightX + 2*S, btnY + 2*S, btnW - 4*S, btnH * 0.4, btnH / 2); c.fill()
  c.restore()
  c.fillStyle = '#FFE8B8'
  c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(d.confirmText || '确认', btnRightX + btnW / 2, btnY + btnH / 2)

  // 缓存按钮区域供触摸使用
  d._cancelRect = [btnLeftX, btnY, btnW, btnH]
  d._confirmRect = [btnRightX, btnY, btnW, btnH]
  d._fullRect = [0, 0, W, H]

  c.restore()
}

/**
 * 处理确认弹窗的触摸事件（仅 end 生效）
 * @returns {boolean} 是否拦截了此次触摸
 */
function handleConfirmDialogTouch(g, x, y, type) {
  var d = g._confirmDialog
  if (!d) return false
  if (type !== 'end') return true // 非 end 事件也拦截，防止穿透
  function _hit(rx, ry, rw, rh) {
    return x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
  }
  if (d._confirmRect && _hit.apply(null, d._confirmRect)) {
    var onConfirm = d.onConfirm
    g._confirmDialog = null
    if (typeof onConfirm === 'function') onConfirm()
    return true
  }
  if (d._cancelRect && _hit.apply(null, d._cancelRect)) {
    var onCancel = d.onCancel
    g._confirmDialog = null
    if (typeof onCancel === 'function') onCancel()
    return true
  }
  // 点击面板外 = 取消
  g._confirmDialog = null
  if (typeof d.onCancel === 'function') d.onCancel()
  return true
}

/**
 * 庆祝背景特效：暗角 + 16 道旋转射线 + 中心光晕 + 金粉/闪点粒子
 * 用于胜利结算等全屏庆祝页面
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} W  画布宽
 * @param {number} H  画布高
 * @param {number} S  缩放倍率
 * @param {number} centerY  射线中心 Y
 * @param {number} at       帧计数器
 * @param {number} fadeIn   淡入 alpha (0~1)
 */
function drawCelebrationBackdrop(c, W, H, S, centerY, at, fadeIn) {
  c.save()
  c.globalAlpha = fadeIn
  var vig = c.createRadialGradient(W * 0.5, H * 0.45, Math.min(W, H) * 0.12, W * 0.5, H * 0.45, Math.max(W, H) * 0.72)
  vig.addColorStop(0, 'rgba(55,38,22,0)')
  vig.addColorStop(1, 'rgba(18,12,8,0.62)')
  c.fillStyle = vig
  c.fillRect(0, 0, W, H)
  c.fillStyle = 'rgba(90,55,28,0.14)'
  c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn * (0.14 + 0.07 * Math.sin(at * 0.034))
  c.translate(W * 0.5, centerY)
  c.rotate(at * 0.0023)
  var nRays = 16
  for (var i = 0; i < nRays; i++) {
    c.rotate((Math.PI * 2) / nRays)
    c.beginPath(); c.moveTo(0, 0)
    c.lineTo(-24 * S, -H * 0.55); c.lineTo(24 * S, -H * 0.55)
    c.closePath()
    var rg = c.createLinearGradient(0, 0, 0, -H * 0.52)
    rg.addColorStop(0, 'rgba(255,235,160,0.95)')
    rg.addColorStop(0.35, 'rgba(255,200,80,0.35)')
    rg.addColorStop(1, 'rgba(255,180,40,0)')
    c.fillStyle = rg
    c.fill()
  }
  c.restore()

  c.save()
  c.globalAlpha = fadeIn * 0.88
  var glow = c.createRadialGradient(W * 0.5, centerY, 0, W * 0.5, centerY, W * 0.68)
  glow.addColorStop(0, 'rgba(255,220,120,0.38)')
  glow.addColorStop(0.42, 'rgba(255,170,70,0.14)')
  glow.addColorStop(1, 'rgba(255,200,80,0)')
  c.fillStyle = glow
  c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn * 0.5
  var t = at * 0.018
  for (var j = 0; j < 26; j++) {
    var sx = ((Math.sin(j * 12.9898 + t * 1.1) * 0.5 + 0.5) * 0.92 + 0.04) * W
    var sy = ((Math.cos(j * 7.1234 + t * 0.75) * 0.5 + 0.5) * 0.78 + 0.06) * H
    var pr = (2.5 + (j % 6)) * S * (0.85 + 0.15 * Math.sin(at * 0.048 + j * 0.7))
    var ga = 0.12 + 0.14 * Math.sin(at * 0.07 + j)
    c.beginPath(); c.arc(sx, sy, pr, 0, Math.PI * 2)
    c.fillStyle = 'rgba(255,230,180,' + ga + ')'
    c.fill()
  }
  c.globalAlpha = fadeIn * 0.65
  for (var k = 0; k < 36; k++) {
    var px = (k * 113 + at * 1.7 + Math.sin(k) * 40) % (W - 4 * S)
    var py = (k * 67 + at * 1.1) % (H * 0.92)
    var tw = (1 + (k % 3)) * S
    c.fillStyle = 'rgba(255,255,255,' + (0.18 + 0.22 * Math.sin(at * 0.11 + k)) + ')'
    c.fillRect(px, py, tw, tw)
  }
  c.restore()
}

/**
 * 奖励/收益行：左侧图标 + 标签 + 右侧数值
 * 通天塔结算和过层胜利共用
 *
 * @param {CanvasRenderingContext2D} c
 * @param {object} R  资源管理器
 * @param {number} S  缩放倍率
 * @param {number} x  行左边 X
 * @param {number} cy 行顶部 Y
 * @param {number} innerW  行总宽
 * @param {string} iconName  图标资源名（assets/ui/ 下，不含路径前缀和扩展名）
 * @param {string} label  标签文字
 * @param {string} value  右侧数值文字
 * @param {string} labelColor
 * @param {string} valueColor
 */
function drawRewardRow(c, R, S, x, cy, innerW, iconName, label, value, labelColor, valueColor) {
  var iconSz = 22 * S
  var iconImg = R.getImg('assets/ui/' + iconName + '.png')
  if (iconImg && iconImg.width > 0) {
    c.drawImage(iconImg, x, cy, iconSz, iconSz)
  }
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = labelColor; c.font = 'bold ' + (11 * S) + 'px "PingFang SC",sans-serif'
  c.fillText(label, x + iconSz + 6 * S, cy + iconSz / 2)
  c.fillStyle = valueColor; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'right'
  c.fillText(value, x + innerW, cy + iconSz / 2)
}

// Buff→图标映射（模块级常量，供 drawBuffCard 使用）
var BUFF_ICON_IMGS = {
  allAtkPct:'buff_icon_atk', allDmgPct:'buff_icon_atk', counterDmgPct:'buff_icon_atk', skillDmgPct:'buff_icon_atk',
  healNow:'buff_icon_heal', postBattleHeal:'buff_icon_heal', regenPerTurn:'buff_icon_heal',
  dmgReducePct:'buff_icon_def', nextDmgReduce:'buff_icon_def', grantShield:'buff_icon_def', immuneOnce:'buff_icon_def',
  comboDmgPct:'buff_icon_elim', elim3DmgPct:'buff_icon_elim', elim4DmgPct:'buff_icon_elim', elim5DmgPct:'buff_icon_elim', bonusCombo:'buff_icon_elim',
  extraTimeSec:'buff_icon_time', skillCdReducePct:'buff_icon_time', resetAllCd:'buff_icon_time',
  hpMaxPct:'buff_icon_hp',
  enemyAtkReducePct:'buff_icon_weaken', enemyHpReducePct:'buff_icon_weaken', eliteAtkReducePct:'buff_icon_weaken',
  eliteHpReducePct:'buff_icon_weaken', bossAtkReducePct:'buff_icon_weaken', bossHpReducePct:'buff_icon_weaken',
  nextStunEnemy:'buff_icon_weaken', stunDurBonus:'buff_icon_weaken',
  extraRevive:'buff_icon_special', skipNextBattle:'buff_icon_special', nextFirstTurnDouble:'buff_icon_special', heartBoostPct:'buff_icon_special',
}
var BUFF_TYPE_NAMES = {
  buff_icon_atk: '攻击加成', buff_icon_heal: '治疗加成', buff_icon_def: '防御加成',
  buff_icon_elim: '消除加成', buff_icon_time: '时间加成', buff_icon_hp: '血量加成',
  buff_icon_weaken: '削弱加成', buff_icon_special: '特殊加成',
}

/**
 * Buff 奖励卡片绘制（卷轴/降级背景 + 图标 + 类型标签 + 名称 + 全队永久生效）
 * 通天塔结算页内嵌奖励 和 独立 rReward 场景共用
 *
 * @param {CanvasRenderingContext2D} c
 * @param {object} R        资源管理器
 * @param {number} S        缩放倍率
 * @param {number} x        卡片左 X（逻辑区域，不含卷轴延伸）
 * @param {number} y        卡片顶 Y
 * @param {number} w        卡片宽
 * @param {number} h        卡片高
 * @param {object} rw       奖励对象 { label, data:{buff,...}, isSpeed? }
 * @param {boolean} isSelected 是否选中态
 */
function drawBuffCard(c, R, S, x, y, w, h, rw, isSelected) {
  var buffData = rw.data || {}
  var buffKey = buffData.buff || ''
  var isSpeedBuff = rw.isSpeed === true

  var bgColor = isSelected ? 'rgba(75,50,20,0.93)' : 'rgba(65,45,18,0.88)'
  var borderColor = isSelected ? '#E8C060' : 'rgba(180,150,90,0.4)'

  var rewardCardBg = R.getImg('assets/ui/reward_card_bg.png')
  var _useScrollBg = rewardCardBg && rewardCardBg.width > 0

  var scrollPadX = 6 * S, scrollPadY = 4 * S
  var scrollX = x - scrollPadX, scrollY = y - scrollPadY
  var scrollW = w + scrollPadX * 2, scrollH = h + scrollPadY * 2

  if (_useScrollBg) {
    c.save()
    c.shadowColor = 'rgba(40,25,10,0.45)'; c.shadowBlur = 12 * S; c.shadowOffsetY = 4 * S
    c.drawImage(rewardCardBg, scrollX, scrollY, scrollW, scrollH)
    c.restore()
    if (isSelected) {
      c.save()
      c.shadowColor = borderColor; c.shadowBlur = 16 * S; c.globalAlpha = 0.6
      c.drawImage(rewardCardBg, scrollX, scrollY, scrollW, scrollH)
      c.restore()
    }
  } else {
    c.save()
    c.shadowColor = 'rgba(40,25,10,0.5)'; c.shadowBlur = 14 * S; c.shadowOffsetY = 5 * S
    c.fillStyle = bgColor
    R.rr(x, y, w, h, 10 * S); c.fill()
    c.restore()
    c.save()
    c.shadowColor = isSelected ? 'rgba(230,200,100,0.6)' : 'rgba(180,150,80,0.2)'
    c.shadowBlur = isSelected ? 18 * S : 8 * S
    c.strokeStyle = isSelected ? 'rgba(230,200,100,0.7)' : 'rgba(180,150,90,0.35)'
    c.lineWidth = isSelected ? 2.5 * S : 1.5 * S
    R.rr(x, y, w, h, 10 * S); c.stroke()
    c.restore()
    if (isSelected) {
      c.strokeStyle = borderColor; c.lineWidth = 2.5 * S
      R.rr(x, y, w, h, 10 * S); c.stroke()
    }
  }

  var _darkText = _useScrollBg
  var _txtMain  = _darkText ? '#2A1A10' : '#FFF2D0'
  var _txtDim   = _darkText ? '#4A3A2E' : 'rgba(220,205,170,0.75)'
  var _txtGold  = _darkText ? '#7A590A' : '#FFD870'
  var _txtStroke = _darkText ? 'rgba(255,248,232,0.7)' : 'rgba(30,20,5,0.6)'

  var _contentPadL = _useScrollBg ? 38 * S : 12 * S

  var typeTag = '', tagColor = _txtDim
  if (isSpeedBuff) { typeTag = '⚡速通'; tagColor = _txtGold }
  else { typeTag = '加成'; tagColor = _txtDim }

  var iconSz = Math.min(48 * S, h - 10 * S)
  var iconX = x + _contentPadL + 2 * S, iconY = y + (h - iconSz) / 2
  var iconName = BUFF_ICON_IMGS[buffKey]
  var iconImg = iconName ? R.getImg('assets/ui/battle/' + iconName + '.png') : null
  if (iconImg && iconImg.width > 0) {
    c.drawImage(iconImg, iconX, iconY, iconSz, iconSz)
  }
  if (!isSpeedBuff && iconName && BUFF_TYPE_NAMES[iconName]) {
    typeTag = BUFF_TYPE_NAMES[iconName]
  }

  var textX = iconX + iconSz + 10 * S
  c.fillStyle = tagColor; c.font = 'bold ' + (12 * S) + 'px "PingFang SC",sans-serif'; c.textAlign = 'left'
  if (_txtStroke) { c.strokeStyle = _txtStroke; c.lineWidth = 1.2 * S; c.strokeText(typeTag, textX, y + h * 0.38) }
  c.fillText(typeTag, textX, y + h * 0.38)

  c.fillStyle = _txtMain; c.font = 'bold ' + (15 * S) + 'px "PingFang SC",sans-serif'; c.textAlign = 'left'
  if (_txtStroke) { c.strokeStyle = _txtStroke; c.lineWidth = 1.5 * S; c.strokeText(rw.label, textX, y + h * 0.62) }
  c.fillText(rw.label, textX, y + h * 0.62)

  c.fillStyle = _txtDim; c.font = (10 * S) + 'px "PingFang SC",sans-serif'; c.textAlign = 'left'
  if (_txtStroke) { c.strokeStyle = _txtStroke; c.lineWidth = 1.2 * S; c.strokeText('全队永久生效', textX, y + h * 0.84) }
  c.fillText('全队永久生效', textX, y + h * 0.84)
}

module.exports = {
  drawPanel, drawRibbonIcon, wrapText, drawDialog, drawTipRow, drawDivider,
  drawConfirmDialog, handleConfirmDialogTouch,
  drawCelebrationBackdrop, drawRewardRow, drawBuffCard,
}
