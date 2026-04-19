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
 * 调用方在 g 上设置 g._confirmDialog = { title, content, confirmText, cancelText, confirmBtnType?, onConfirm, onCancel, timer:0 }
 * confirmBtnType: 'adReward' 时使用 assets/ui/btn_reward_confirm.png（看广告），缺省为普通确认按钮
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

  // 面板尺寸（看广告确认与失败结算一致：略宽 + infoPanel）
  var useInfoPanel = d.confirmBtnType === 'adReward'
  var panelW = useInfoPanel ? W * 0.88 : W * 0.82
  c.font = (12 * S) + 'px "PingFang SC",sans-serif'
  var contentLines = wrapText(c, d.content || '', panelW - 52 * S)
  var lineH = 20 * S
  var contentH = contentLines.length * lineH
  var btnAreaH = 52 * S
  var ribbonH = 42 * S
  var panelH = useInfoPanel
    ? (14 * S + 24 * S + 16 * S + contentH + 14 * S + btnAreaH)
    : (ribbonH + 24 * S + contentH + 18 * S + btnAreaH + 18 * S)
  var px = (W - panelW) / 2
  var targetY = (H - panelH) / 2 - 8 * S
  var py = timer < 12 ? targetY + 30 * S * (1 - timer / 12) : targetY

  // 入场缩放
  var scale = timer < 10 ? 0.88 + 0.12 * (timer / 10) : 1
  c.save()
  c.translate(W / 2, py + panelH / 2)
  c.scale(scale, scale)
  c.translate(-W / 2, -(py + panelH / 2))

  var titleCY
  var textY
  if (useInfoPanel) {
    R.drawInfoPanel(px, py, panelW, panelH)
    titleCY = py + 14 * S + 12 * S
    textY = py + 14 * S + 24 * S + 16 * S
  } else {
    var panelResult = drawPanel(c, S, px, py, panelW, panelH, { ribbonH: ribbonH })
    titleCY = panelResult.ribbonCY
    textY = py + ribbonH + 24 * S
  }

  // 标题
  c.fillStyle = '#5a3000'
  c.font = 'bold ' + (15 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(d.title || '提示', W / 2, titleCY)

  // 正文（自动换行）
  c.fillStyle = '#4a3820'
  c.font = (12 * S) + 'px "PingFang SC",sans-serif'
  c.textAlign = 'center'; c.textBaseline = 'top'
  for (var i = 0; i < contentLines.length; i++) {
    c.fillText(contentLines[i], W / 2, textY + i * lineH)
  }

  c.restore() // 缩放 restore

  // 双按钮（面板底部，不受缩放影响以保持点击精度）— btn_cancel / btn_confirm 或看广告 btn_reward_confirm
  var btnGap = 14 * S
  var btnW = (panelW - 52 * S - btnGap) / 2
  var btnH = 38 * S
  var btnY = py + panelH - btnAreaH - 8 * S
  var btnLeftX = px + 26 * S
  var btnRightX = btnLeftX + btnW + btnGap

  R.drawDialogBtn(btnLeftX, btnY, btnW, btnH, d.cancelText || '取消', 'cancel')
  const confirmKind = d.confirmBtnType === 'adReward' ? 'adReward' : 'confirm'
  R.drawDialogBtn(btnRightX, btnY, btnW, btnH, d.confirmText || '确认', confirmKind)

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

/**
 * drawLingCard — 模态讲解卡（小灵主讲 · 多页翻页 · 卷轴底板）
 *
 * 与 drawGuideBubble 视觉同源（纸底/金边/纸纹/两端卷轴），但用于**全屏模态讲解**：
 *   - 左上角圆头像 + 说话人名 + 副标签（"第 1/2 课" 之类）
 *   - 居中大标题 + 金线下划线
 *   - 左对齐正文行（对话式，不再全部居中）
 *   - 可选金棕色备注行
 *   - 底部分页点 + "点击继续 ›" 呼吸高亮
 *
 * 调用方负责画背后的全屏暗遮罩；本函数只画卡本体。
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} x,y,w,h  卡片位置 + 尺寸
 * @param {object} opts
 *   avatarImg   HTMLImageElement | null   左上头像
 *   speaker     string                     说话人（如 '仙宠 · 小灵'）
 *   subLabel    string | null              说话人后的副标签（'第 1/2 课'、'战前要诀'）
 *   title       string                     大标题
 *   lines       string[]                   正文行（由调用方 wrap 后传入）
 *   note        string | null              金棕色备注行
 *   fontSizeBody number                     正文字号
 *   lineH       number                     行高
 *   pageIdx     number                     当前页（0-based）
 *   totalPages  number                     总页数（<=1 时不画分页点）
 *   continueText string                    底部呼吸文字（默认"点击继续 ›"）
 *   animT       0..1                       入场 scaleY 动画
 *   pulseT      number                     呼吸相位（调用方传 g.af * 0.1 即可）
 */
function drawLingCard(c, S, x, y, w, h, opts) {
  opts = opts || {}
  const animT = opts.animT != null ? opts.animT : 1
  const lines = opts.lines || []
  const bodyFs = opts.fontSizeBody || 14 * S
  const lineH = opts.lineH || 28 * S
  const radius = 14 * S

  // 入场：轻微 scaleY（卷轴从上下拉开感）+ alpha
  c.save()
  const cx = x + w / 2
  const cy = y + h / 2
  c.translate(cx, cy)
  c.scale(1, 0.6 + 0.4 * animT)
  c.globalAlpha *= animT
  c.translate(-cx, -cy)

  // 卷轴底 + 两端滚轴（复用 _drawScrollBody / _drawScrollRollers）
  _drawScrollBody(c, S, x, y, w, h, radius)
  _drawScrollRollers(c, S, x, y, w, h)

  // ---- 左上：头像 + 说话人 + 副标签 ----
  const padL = 16 * S
  const padR = 16 * S
  const padT = 12 * S
  let headerCY = y + padT + 18 * S
  let textLeft = x + padL

  const hasAvatar = opts.avatarImg && opts.avatarImg.width > 0
  if (hasAvatar) {
    const ar = 22 * S
    const acx = x + padL + ar
    const acy = headerCY
    _drawAvatarBadge(c, S, acx, acy, ar, opts.avatarImg)
    textLeft = acx + ar + 10 * S
  }

  if (opts.speaker) {
    c.save()
    c.fillStyle = 'rgba(155,110,30,0.95)'
    c.font = `${11 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText(opts.speaker, textLeft, headerCY - 6 * S)
    if (opts.subLabel) {
      c.fillStyle = 'rgba(130,95,40,0.7)'
      c.font = `${10 * S}px "PingFang SC",sans-serif`
      c.fillText(opts.subLabel, textLeft, headerCY + 8 * S)
    }
    c.restore()
  }

  // 分隔线
  const sepY = y + padT + 38 * S
  c.save()
  const sepGrad = c.createLinearGradient(x, 0, x + w, 0)
  sepGrad.addColorStop(0, 'rgba(170,130,45,0.0)')
  sepGrad.addColorStop(0.15, 'rgba(200,160,60,0.55)')
  sepGrad.addColorStop(0.85, 'rgba(200,160,60,0.55)')
  sepGrad.addColorStop(1, 'rgba(170,130,45,0.0)')
  c.strokeStyle = sepGrad
  c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(x + padL, sepY)
  c.lineTo(x + w - padR, sepY)
  c.stroke()
  c.restore()

  // ---- 大标题（居中） ----
  const titleY = sepY + 24 * S
  if (opts.title) {
    c.save()
    c.fillStyle = '#3a1a00'
    c.font = `bold ${17 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.shadowColor = 'rgba(255,255,255,0.7)'; c.shadowBlur = 2 * S
    c.fillText(opts.title, x + w / 2, titleY)
    c.restore()
  }

  // ---- 正文行（左对齐，对话式） ----
  const bodyStartY = (opts.title ? (titleY + 26 * S) : (sepY + 18 * S))
  c.save()
  c.fillStyle = '#4a3820'
  c.font = `${bodyFs}px "PingFang SC","Microsoft YaHei",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  for (let i = 0; i < lines.length; i++) {
    c.fillText(lines[i], x + padL + 6 * S, bodyStartY + i * lineH)
  }
  c.restore()

  // ---- 备注行 ----
  let noteBottomY = bodyStartY + lines.length * lineH
  if (opts.note) {
    noteBottomY += 12 * S
    c.save()
    c.fillStyle = '#b06010'
    c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.fillText(opts.note, x + w / 2, noteBottomY)
    c.restore()
    noteBottomY += 18 * S
  }

  // ---- 底部：分页点 + 点击继续 ----
  const bottomY = y + h - 14 * S
  const total = opts.totalPages || 1
  if (total > 1) {
    const dotR = 4 * S, dotGap = 14 * S
    const dotsStartX = x + w / 2 - ((total - 1) * dotGap) / 2
    const dotsY = bottomY - 22 * S
    const pageIdx = opts.pageIdx || 0
    for (let i = 0; i < total; i++) {
      c.beginPath()
      c.arc(dotsStartX + i * dotGap, dotsY, dotR, 0, Math.PI * 2)
      c.fillStyle = i === pageIdx ? '#c07820' : 'rgba(160,120,40,0.3)'
      c.fill()
    }
  }

  const continueText = opts.continueText || '点击继续 ›'
  const pulse = 0.55 + 0.45 * Math.sin((opts.pulseT || 0))
  c.save()
  c.globalAlpha *= (0.55 + 0.4 * pulse)
  c.fillStyle = '#8a6030'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'
  c.fillText(continueText, x + w / 2, bottomY)
  c.restore()

  c.restore()
}

/**
 * drawLingHeader — 小尺寸"小灵点评"标题栏
 *
 * 用于模块内小区块（如失败页"如何变强"标题左侧）：
 *   [Ⓒ] 如何变强              ← 主标题（深棕色 bold 11*S）
 *        主人别灰心，...       ← 副标题（金棕色 9.5*S，可选）
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} x,y       左上基点
 * @param {object} opts
 *   avatarImg  HTMLImageElement | null
 *   title      string
 *   subtitle   string | null
 *   titleColor string         默认 '#6B6040'
 * @returns {{ height: number, rightEdge: number }}  绘制完成后的高度与末尾 X
 */
function drawLingHeader(c, S, x, y, opts) {
  opts = opts || {}
  const ar = 13 * S
  let cursorX = x
  if (opts.avatarImg && opts.avatarImg.width > 0) {
    _drawAvatarBadge(c, S, x + ar, y + ar, ar, opts.avatarImg)
    cursorX = x + ar * 2 + 8 * S
  }
  c.save()
  c.fillStyle = opts.titleColor || '#6B6040'
  c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const titleY = opts.subtitle ? (y + ar - 6 * S) : (y + ar)
  c.fillText(opts.title || '', cursorX, titleY)
  if (opts.subtitle) {
    c.fillStyle = 'rgba(140,100,40,0.85)'
    c.font = `${9.5 * S}px "PingFang SC",sans-serif`
    c.fillText(opts.subtitle, cursorX, titleY + 14 * S)
  }
  c.restore()
  const h = ar * 2 + 2 * S
  return { height: h, rightEdge: cursorX }
}

/**
 * drawGuideBubble — 新手引导气泡（竹简卷轴 · 左侧头像 · 可选尾巴指向高亮按钮）
 *
 * 与通用 drawPanel 的区别：
 *   - 专门为"有人在和玩家说话"设计：左侧圆形头像 + 头像金边 + 右上小标题（说话人）
 *   - 面板左右两端绘制「卷轴圆柱」装饰（代替老版四角菱形）
 *   - 纸底叠一层极淡斜纹纸纹（createPattern 动态生成，无额外资源）
 *   - 支持底部尾巴指向任意点（通常是被高亮的按钮中心）
 *   - 支持入场"展开"动画 animT: 0→1 面板从中心向两端拉开
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} x  气泡左上
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {object} opts
 *   opts.avatarImg   HTMLImageElement | null
 *   opts.speaker     string  右上角说话人（如 '仙宠 · 小灵'），空则不画
 *   opts.lines       string[] 正文行（由调用方 wrapText 后传入）
 *   opts.fontSize    number   正文字号（px）
 *   opts.lineH       number   行高
 *   opts.tailTo      {x,y} | null  尾巴指向的屏幕坐标，null 不画
 *   opts.animT       0..1     入场展开进度
 *   opts.R           渲染器（可选，用于共享 rr / 图片 tint）
 */
function drawGuideBubble(c, S, x, y, w, h, opts) {
  opts = opts || {}
  const animT = opts.animT != null ? opts.animT : 1
  const lines = opts.lines || []
  const fontSize = opts.fontSize || 15 * S
  const lineH = opts.lineH || fontSize * 1.5
  const radius = 14 * S

  // 入场展开：水平从中心往两端拉开（scaleX）
  c.save()
  const cx = x + w / 2
  const cy = y + h / 2
  c.translate(cx, cy)
  c.scale(animT, 1)
  c.globalAlpha *= animT
  c.translate(-cx, -cy)

  // ---- 卷轴底板 ----
  _drawScrollBody(c, S, x, y, w, h, radius)

  // ---- 左右两端卷轴圆柱 ----
  _drawScrollRollers(c, S, x, y, w, h)

  // ---- 左侧头像 ----
  const avatarPad = 14 * S
  const avatarR = Math.min(36 * S, (h - avatarPad * 2) / 2)
  const avatarCx = x + avatarPad + avatarR
  const avatarCy = y + h / 2
  const hasAvatar = opts.avatarImg && opts.avatarImg.width > 0
  if (hasAvatar) {
    _drawAvatarBadge(c, S, avatarCx, avatarCy, avatarR, opts.avatarImg)
  }

  // ---- 说话人小标签（右上角） + 分隔线 ----
  const contentLeft = hasAvatar ? (avatarCx + avatarR + 12 * S) : (x + 20 * S)
  const contentRight = x + w - 20 * S
  const contentW = contentRight - contentLeft
  const textTop = y + (opts.speaker ? 10 * S : 14 * S)

  if (opts.speaker) {
    c.save()
    c.fillStyle = 'rgba(155,110,30,0.9)'
    c.font = `${11 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText(opts.speaker, contentLeft, textTop)
    // 说话人下的细金线
    c.strokeStyle = 'rgba(180,140,60,0.35)'
    c.lineWidth = 0.8 * S
    c.beginPath()
    c.moveTo(contentLeft, textTop + 15 * S)
    c.lineTo(contentRight, textTop + 15 * S)
    c.stroke()
    c.restore()
  }

  // ---- 正文 ----
  const textStartY = opts.speaker ? (textTop + 22 * S) : textTop
  c.save()
  c.fillStyle = '#3a1a00'
  c.font = `bold ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.shadowColor = 'rgba(255,255,255,0.6)'
  c.shadowBlur = 2 * S
  for (let i = 0; i < lines.length; i++) {
    c.fillText(lines[i], contentLeft, textStartY + i * lineH)
  }
  c.restore()

  c.restore()  // scaleX 动画 restore

  // ---- 尾巴（不跟随 scaleX 动画，等气泡完全展开后浮现）----
  if (animT >= 0.95 && opts.tailTo) {
    _drawTail(c, S, x, y, w, h, opts.tailTo, (animT - 0.95) / 0.05)
  }
}

/** 卷轴主体：米黄纸底 + 双边 + 上下横向金线 + 纸纹颗粒 */
function _drawScrollBody(c, S, x, y, w, h, radius) {
  c.save()
  c.shadowColor = 'rgba(40,20,0,0.35)'
  c.shadowBlur = 16 * S
  c.shadowOffsetX = 0
  c.shadowOffsetY = 4 * S
  const bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#fffdf1')
  bg.addColorStop(0.5, '#f6ecd0')
  bg.addColorStop(1, '#ecddb4')
  _rr(c, x, y, w, h, radius)
  c.fillStyle = bg
  c.fill()
  c.restore()

  // 纸纹（极淡的 45° 斜线）
  c.save()
  _rr(c, x, y, w, h, radius)
  c.clip()
  c.globalAlpha = 0.08
  c.strokeStyle = '#8a6a2a'
  c.lineWidth = 0.5 * S
  const step = 5 * S
  for (let i = -h; i < w + h; i += step) {
    c.beginPath()
    c.moveTo(x + i, y)
    c.lineTo(x + i + h, y + h)
    c.stroke()
  }
  c.restore()

  // 外金边（单道细）+ 内高光边
  _rr(c, x, y, w, h, radius)
  c.strokeStyle = 'rgba(170,130,45,0.75)'
  c.lineWidth = 1.5 * S
  c.stroke()
  const ins = 2.5 * S
  _rr(c, x + ins, y + ins, w - ins * 2, h - ins * 2, Math.max(2, radius - ins))
  c.strokeStyle = 'rgba(255,240,190,0.5)'
  c.lineWidth = 0.8 * S
  c.stroke()

  // 顶底两道金线（卷轴"竹简"横线意象）
  c.save()
  const grad = c.createLinearGradient(x, 0, x + w, 0)
  grad.addColorStop(0, 'rgba(170,130,45,0.0)')
  grad.addColorStop(0.2, 'rgba(200,160,60,0.85)')
  grad.addColorStop(0.8, 'rgba(200,160,60,0.85)')
  grad.addColorStop(1, 'rgba(170,130,45,0.0)')
  c.strokeStyle = grad
  c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(x + 20 * S, y + 6 * S); c.lineTo(x + w - 20 * S, y + 6 * S); c.stroke()
  c.beginPath(); c.moveTo(x + 20 * S, y + h - 6 * S); c.lineTo(x + w - 20 * S, y + h - 6 * S); c.stroke()
  c.restore()
}

/** 左右两端卷轴圆柱（立式金色圆柱，顶底带深褐盖） */
function _drawScrollRollers(c, S, x, y, w, h) {
  const rollerW = 10 * S
  const rollerH = h + 12 * S
  const rollerY = y - 6 * S
  const ends = [x - rollerW * 0.5, x + w - rollerW * 0.5]
  for (const rx of ends) {
    c.save()
    // 阴影
    c.shadowColor = 'rgba(40,20,0,0.35)'
    c.shadowBlur = 4 * S
    c.shadowOffsetX = 0
    c.shadowOffsetY = 2 * S
    // 圆柱主体（金属渐变）
    const g = c.createLinearGradient(rx, 0, rx + rollerW, 0)
    g.addColorStop(0,    'rgba(140,100,30,1)')
    g.addColorStop(0.35, 'rgba(220,180,80,1)')
    g.addColorStop(0.55, 'rgba(245,215,140,1)')
    g.addColorStop(0.75, 'rgba(210,170,70,1)')
    g.addColorStop(1,    'rgba(130,90,25,1)')
    c.fillStyle = g
    _rr(c, rx, rollerY, rollerW, rollerH, rollerW * 0.5)
    c.fill()
    c.restore()

    // 顶底深褐盖
    c.save()
    c.fillStyle = 'rgba(78,48,12,0.95)'
    const capH = 4 * S
    _rr(c, rx - 1 * S, rollerY, rollerW + 2 * S, capH, capH * 0.5)
    c.fill()
    _rr(c, rx - 1 * S, rollerY + rollerH - capH, rollerW + 2 * S, capH, capH * 0.5)
    c.fill()
    c.restore()
  }
}

/** 左侧圆形头像徽章：圆形裁剪 + 金边 + 下沉阴影 */
function _drawAvatarBadge(c, S, cx, cy, r, img) {
  // 外发光金晕
  c.save()
  const aura = c.createRadialGradient(cx, cy, r * 0.3, cx, cy, r + 6 * S)
  aura.addColorStop(0, 'rgba(255,220,130,0.0)')
  aura.addColorStop(0.7, 'rgba(255,220,130,0.0)')
  aura.addColorStop(1, 'rgba(255,220,130,0.35)')
  c.fillStyle = aura
  c.beginPath(); c.arc(cx, cy, r + 6 * S, 0, Math.PI * 2); c.fill()
  c.restore()

  // 圆底（防透明洞感）
  c.save()
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2)
  c.fillStyle = '#fffdf3'; c.fill()
  c.clip()
  c.drawImage(img, cx - r, cy - r, r * 2, r * 2)
  c.restore()

  // 金边
  c.save()
  c.strokeStyle = 'rgba(200,160,60,0.9)'
  c.lineWidth = 2 * S
  c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke()
  // 内高光圈
  c.strokeStyle = 'rgba(255,240,190,0.55)'
  c.lineWidth = 0.8 * S
  c.beginPath(); c.arc(cx, cy, r - 2 * S, 0, Math.PI * 2); c.stroke()
  c.restore()
}

/** 气泡底部指向 tailTo 的小三角 + 虚线牵引 */
function _drawTail(c, S, x, y, w, h, tailTo, t) {
  const bubbleBottom = y + h
  const bubbleCenterX = x + w / 2
  // 三角的尖端在气泡底边正中偏 tailTo 一点
  const tipX = bubbleCenterX + Math.max(-w * 0.25, Math.min(w * 0.25, (tailTo.x - bubbleCenterX) * 0.3))
  const triHalf = 9 * S
  const triH = 10 * S
  c.save()
  c.globalAlpha *= t
  // 三角底色（与气泡主底一致）
  c.beginPath()
  c.moveTo(tipX - triHalf, bubbleBottom - 1)
  c.lineTo(tipX + triHalf, bubbleBottom - 1)
  c.lineTo(tipX, bubbleBottom + triH)
  c.closePath()
  c.fillStyle = '#f2e4b8'
  c.fill()
  // 三角金边
  c.strokeStyle = 'rgba(170,130,45,0.75)'
  c.lineWidth = 1.2 * S
  c.beginPath()
  c.moveTo(tipX - triHalf, bubbleBottom)
  c.lineTo(tipX, bubbleBottom + triH)
  c.lineTo(tipX + triHalf, bubbleBottom)
  c.stroke()

  // 虚线牵引（从三角尖到目标点）
  const endX = tailTo.x
  const endY = tailTo.y - 6 * S
  if (endY > bubbleBottom + triH + 4 * S) {
    c.setLineDash([3 * S, 3 * S])
    c.strokeStyle = 'rgba(200,160,60,0.55)'
    c.lineWidth = 1 * S
    c.beginPath()
    c.moveTo(tipX, bubbleBottom + triH)
    c.lineTo(endX, endY)
    c.stroke()
    c.setLineDash([])
  }
  c.restore()
}

/**
 * drawPressOverlay — 统一的按钮"按下态"反馈
 *
 * 各 View 自行画按钮底色（保持原有样式），按下态只需在最上层叠一个深色蒙版即可。
 * View 维护一个 `_pressedId`（字符串）标记当前按下的按钮 id，
 * 绘制时把 id 传给本函数：是当前按下 id 就绘制蒙版。
 *
 * 用法：
 *   drawPressOverlay(c, R, rect, S, isPressed)
 */
function drawPressOverlay(c, R, rect, S, isPressed) {
  if (!isPressed || !rect) return
  const [x, y, w, h] = rect
  c.save()
  c.fillStyle = 'rgba(0,0,0,0.18)'
  if (R && R.rr) {
    R.rr(x, y, w, h, 6 * S)
    c.fill()
  } else {
    c.fillRect(x, y, w, h)
  }
  c.restore()
}

/**
 * registerTouchRect / dispatchTouchRect — 声明式触摸命中框（可选接入）
 *
 * 帮助 View 用同一套方式注册矩形 + 处理器，避免一串 if-else 错位。
 * View 持有一个 `_touchMap = {}`，渲染时：
 *   registerTouchRect(_touchMap, 'backBtn', rect, () => { ... })
 * onTouch end 时：
 *   if (dispatchTouchRect(_touchMap, x, y, g._hitRect)) return
 *
 * 已存在的 View 不强制迁移，仅为新代码提供规范。
 */
function registerTouchRect(map, id, rect, handler) {
  if (!map || !id || !rect || !handler) return
  map[id] = { rect, handler }
}
function dispatchTouchRect(map, x, y, hitTest) {
  if (!map) return false
  for (const id of Object.keys(map)) {
    const entry = map[id]
    if (!entry || !entry.rect) continue
    if (hitTest(x, y, ...entry.rect)) {
      entry.handler()
      return true
    }
  }
  return false
}
function clearTouchRects(map) {
  if (!map) return
  for (const k of Object.keys(map)) delete map[k]
}

/**
 * drawScrollablePanel — 可滚动内容容器
 *
 * 用法：
 *   const { scrollY, contentH } = drawScrollablePanel(
 *     ctx, S, { x, y, w, h }, state, (ctx, innerW) => {
 *       // 在此绘制内容，y 从 0 开始；返回绘制完的实际高度
 *       return totalHeight
 *     },
 *     { paddingX, paddingY, showScrollBar }
 *   )
 *
 * state 必须是一个可持久化对象 { scrollY: 0, maxScrollY: 0, dragging: bool, dragStartY, dragStartScrollY }
 * View 应创建一份 state 并在宠物/tab 切换时 reset。
 *
 * 触摸：View 在 onTouch 里分发到 handleScrollablePanelTouch(state, rect, x, y, type) 即可。
 */
function drawScrollablePanel(c, S, rect, state, drawContent, opts) {
  opts = opts || {}
  const padX = opts.paddingX != null ? opts.paddingX : 0
  const padY = opts.paddingY != null ? opts.paddingY : 0
  const showBar = opts.showScrollBar !== false
  const { x, y, w, h } = rect

  // clip 到面板矩形
  c.save()
  c.beginPath()
  c.rect(x, y, w, h)
  c.clip()

  const innerX = x + padX
  const innerY = y + padY
  const innerW = w - padX * 2
  const innerH = h - padY * 2

  c.save()
  c.translate(innerX, innerY - (state.scrollY || 0))
  const contentH = drawContent(c, innerW, innerH) || 0
  c.restore()

  // 更新滚动范围（向上对齐）
  state.maxScrollY = Math.max(0, contentH - innerH)
  if (state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY
  if (state.scrollY < 0) state.scrollY = 0

  // 滚动条（右侧 3px，内容超长才出现）
  if (showBar && state.maxScrollY > 0) {
    const barW = 3 * S
    const barTrackH = innerH
    const barH = Math.max(24 * S, barTrackH * innerH / contentH)
    const barRatio = state.scrollY / state.maxScrollY
    const barY = innerY + barRatio * (barTrackH - barH)
    const barX = x + w - barW - 2 * S
    c.save()
    c.globalAlpha = 0.55
    c.fillStyle = '#9A7A40'
    _rrFallback(c, barX, barY, barW, barH, barW / 2)
    c.fill()
    c.restore()
  }

  c.restore()
  return { scrollY: state.scrollY, contentH, maxScrollY: state.maxScrollY }
}

function _rrFallback(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y,     x + w, y + h, r)
  c.arcTo(x + w, y + h, x,     y + h, r)
  c.arcTo(x,     y + h, x,     y,     r)
  c.arcTo(x,     y,     x + w, y,     r)
  c.closePath()
}

/**
 * 处理可滚动面板的触摸：
 *   返回 true 表示触摸被消费（View 不需再向下派发）
 */
function handleScrollablePanelTouch(state, rect, x, y, type) {
  const { x: rx, y: ry, w: rw, h: rh } = rect
  const inside = x >= rx && x <= rx + rw && y >= ry && y <= ry + rh
  if (type === 'start') {
    if (!inside) return false
    state.dragging = true
    state.dragStartY = y
    state.dragStartScrollY = state.scrollY || 0
    state._dragDelta = 0
    return false  // 触摸开始不消费，让下层 View 判断点击
  }
  if (type === 'move' && state.dragging) {
    const dy = y - state.dragStartY
    state._dragDelta = Math.max(state._dragDelta || 0, Math.abs(dy))
    state.scrollY = state.dragStartScrollY - dy
    if (state.scrollY < 0) state.scrollY = 0
    if (state.maxScrollY && state.scrollY > state.maxScrollY) state.scrollY = state.maxScrollY
    // 滑动幅度超过阈值时消费后续事件，避免被当作点击
    return (state._dragDelta || 0) > 6
  }
  if (type === 'end' || type === 'cancel') {
    const wasDragging = state.dragging && (state._dragDelta || 0) > 6
    state.dragging = false
    state._dragDelta = 0
    return wasDragging
  }
  return false
}

/** 创建默认滚动状态对象 */
function createScrollState() {
  return { scrollY: 0, maxScrollY: 0, dragging: false, dragStartY: 0, dragStartScrollY: 0, _dragDelta: 0 }
}

// ===== 统一 CTA/次级/危险/虚按钮 drawPrimaryButton =====
/**
 * 全站通用「功能性按钮」—— 金棕卷轴调性、多 style、多状态
 *
 * 为什么单独抽出来：
 *   - 原来每个页面（pet/修炼/签到/商城…）都写自己的 _drawBtn，色号/圆角/字号不统一；
 *     改 UI 时要改 N 处。
 *   - 这里统一一处：视觉语言与 drawLingCard / drawGuideBubble 对齐，金色 CTA / 里程碑金紫 /
 *     次级银 / 危险红 / ghost 虚线，五种即可覆盖全部业务。
 *
 * 调用：
 *   const { drawPrimaryButton } = require('./uiComponents')
 *   drawPrimaryButton(ctx, S, x, y, w, h, {
 *     text: '升级', subText: '611/132 灵石',
 *     style: 'gold', enabled: true, pressed: false, glow: true, flashT: 0,
 *   })
 *
 * 响应交互的方式：
 *   调用方负责点击命中与 pressed 状态（touchstart=true / end=false），
 *   flashT 由 buttonFx 驱动（0 → 1 → 0 一个往返）。
 *
 * @param {CanvasRenderingContext2D} c
 * @param {number} S
 * @param {number} x,y,w,h
 * @param {object} opts
 *   text       主文案（必填）
 *   subText    副文字（可选，下方小字，如"611/132 灵石"）
 *   style      'gold' | 'milestone' | 'silver' | 'danger' | 'ghost' (默认 'gold')
 *   enabled    默认 true；false 时绘制禁用态（灰色 + alpha）
 *   pressed    默认 false；true 时整体下压 + 底色变暗（按压反馈）
 *   glow       默认 false；true 时金边呼吸（用于"可升级"引导）
 *   flashT     0~1，默认 0；成功后瞬间金白高光（buttonFx 驱动）
 *   fontSize   主文字字号（默认根据按钮高度自动）
 *   subFontSize  副文字字号（默认 10*S）
 */
/**
 * 主动分享按钮（底图：btn_reward_confirm.png 金色卷轴）
 *
 * 设计思路：
 *   v5 单行横向：「分享」· [灵石icon] +N（动作与奖励同一行扫读）。
 *   锚点略偏右（~0.56w）避开底板左侧云纹；底图仍为 btn_reward_confirm.png。
 *
 * @param {CanvasRenderingContext2D} c
 * @param {Object} R 渲染模块（getImg）
 * @param {number} S 缩放倍率
 * @param {number} rightX 按钮右边界 x（函数内部右对齐计算左上 x）
 * @param {number} y 按钮左上 y
 * @param {number} h 按钮高度（推荐 36~44 * S，宽度按 3.5:1 自适应）
 * @param {Object} opts
 *   · glow - 呼吸金边（情绪峰值：首通胜利 / 通天塔破境）
 *   · reward - 奖励灵石数量（默认 20，来自 shareConfig.activeStageShare.reward.soulStone）
 * @returns {{x:number, y:number, w:number, h:number}} 实际命中区域
 */
function drawShareIconBtn(c, R, S, rightX, y, h, opts) {
  opts = opts || {}
  const reward = opts.reward != null ? opts.reward : 20
  const glow = !!opts.glow
  const pulse = glow ? 0.35 + 0.35 * Math.sin(Date.now() * 0.004) : 0

  // reward <= 0（场景每日上限已耗尽）时，不再画"· 灵石 +0"尾巴
  //   · 显示 +0 既无意义又误导玩家"分享没奖励"，直接隐藏数字区，胶囊整体收窄到只容纳"分享"
  const showReward = reward > 0

  // 胶囊宽度：btn_reward_confirm 原图比例 ≈ 3.5:1 作基础
  //   · 奖励数字从 2 位（+20）升到 3 位甚至 4 位（+120/+160）时，老固定宽度会裁掉文案
  //   · 改成按"内容所需宽 + 左右留白"自适应，最低仍保持 3.4h 的视觉比例
  const mainFontSz = Math.max(12 * S, h * 0.34)
  const rewardFontSz = Math.max(11 * S, h * 0.30)
  const iconSz = h * 0.48
  const gapShareSep = 5 * S
  const gapSepIcon = 4 * S
  const iconToNumGap = 2 * S
  const rewardText = '+' + reward
  const sep = '·'
  c.save()
  c.font = `bold ${mainFontSz}px "PingFang SC",sans-serif`
  const wShare = c.measureText('分享').width
  const wSep = showReward ? c.measureText(sep).width : 0
  let wReward = 0
  if (showReward) {
    c.font = `bold ${rewardFontSz}px "PingFang SC",sans-serif`
    wReward = c.measureText(rewardText).width
  }
  c.restore()
  const contentW = showReward
    ? (wShare + gapShareSep + wSep + gapSepIcon + iconSz + iconToNumGap + wReward)
    : wShare
  const minW = showReward ? h * 3.4 : h * 2.2
  //   · 图底纹有左右云纹占位 ≈ 0.22w + 0.22w（不能被文字压住），所以把内容塞进中间 56% 区域
  //   · capsule 目标宽 = contentW / 0.56 + 视觉余量
  const fitW = contentW / 0.56 + 6 * S
  const w = Math.max(minW, fitW)
  const x = rightX - w

  c.save()

  // 呼吸金光（外层柔和发光）
  if (glow) {
    c.save()
    c.shadowColor = 'rgba(255,210,90,0.95)'
    c.shadowBlur = (9 + 6 * pulse) * S
    c.strokeStyle = 'rgba(255,225,120,' + (0.55 + 0.25 * pulse) + ')'
    c.lineWidth = 2 * S
    _rr(c, x - 1.5 * S, y - 1.5 * S, w + 3 * S, h + 3 * S, h * 0.3)
    c.stroke()
    c.restore()
  }

  // ① 底图：btn_reward_confirm.png（金色卷轴带云纹装饰）
  const bgImg = R && R.getImg ? R.getImg('assets/ui/btn_reward_confirm.png') : null
  if (bgImg && bgImg.width > 0) {
    c.drawImage(bgImg, x, y, w, h)
  } else {
    drawPrimaryButton(c, S, x, y, w, h, { style: 'gold' })
  }

  // ② 单行：分享 · [灵石icon] +N（垂直居中，锚点略偏右避开左侧云纹）
  //   · mainFontSz / rewardFontSz / iconSz / gap* 变量已在胶囊宽度自适应段落中测出
  const midY = y + h * 0.5
  const totalW = contentW
  const contentCx = x + w * 0.56
  c.save()
  c.textBaseline = 'middle'
  let curX = contentCx - totalW / 2

  c.font = `bold ${mainFontSz}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillStyle = '#4A2020'
  c.shadowColor = 'rgba(255,255,255,0.35)'
  c.shadowBlur = 1 * S
  c.fillText('分享', curX, midY)
  c.shadowBlur = 0
  curX += wShare + gapShareSep

  // reward > 0 时才画"· 灵石 +N"；= 0 时上面 contentW 已收窄，"分享"已在胶囊中心
  if (showReward) {
    c.fillStyle = 'rgba(74,32,0,0.45)'
    c.fillText(sep, curX, midY)
    curX += wSep + gapSepIcon

    const iconImg = R && R.getImg ? R.getImg('assets/ui/icon_soul_stone.png') : null
    if (iconImg && iconImg.width > 0) {
      c.drawImage(iconImg, curX, midY - iconSz / 2, iconSz, iconSz)
    }
    curX += iconSz + iconToNumGap

    c.font = `bold ${rewardFontSz}px "PingFang SC",sans-serif`
    c.fillStyle = 'rgba(74,32,0,0.92)'
    c.fillText(rewardText, curX, midY)
  }
  c.restore()

  c.restore()

  return { x, y, w, h }
}

function drawPrimaryButton(c, S, x, y, w, h, opts) {
  opts = opts || {}
  const text = opts.text || ''
  const subText = opts.subText || ''
  const style = opts.style || 'gold'
  const enabled = opts.enabled !== false
  const pressed = !!opts.pressed && enabled
  const glow = !!opts.glow && enabled
  const flashT = enabled ? Math.max(0, Math.min(1, opts.flashT || 0)) : 0
  const radius = opts.radius != null ? opts.radius : 8 * S

  // 按下态整体下压 2*S（视觉"被按进去"）
  const dy = pressed ? 2 * S : 0
  const bx = x, by = y + dy, bw = w, bh = h - dy

  // 色板：每 style 一套"顶色 / 底色 / 字色 / 边色"
  // —— 调性：gold=正向 CTA；milestone=金+紫渐变里程碑；silver=次级；danger=破坏；ghost=弱回绕
  const P = _btnPalette(style)

  c.save()

  // 呼吸金边（glow）：先画一层柔和外发光，让"可升级"按钮主动吸引视线
  if (glow) {
    const pulse = 0.35 + 0.35 * Math.sin(Date.now() * 0.004)
    c.save()
    c.shadowColor = P.glow
    c.shadowBlur = (8 + 6 * pulse) * S
    c.strokeStyle = P.glow
    c.globalAlpha = 0.55 + 0.35 * pulse
    c.lineWidth = 2 * S
    _rr(c, bx - 1 * S, by - 1 * S, bw + 2 * S, bh + 2 * S, radius + 1 * S); c.stroke()
    c.restore()
  }

  // 底：渐变（ghost 无底）
  if (style !== 'ghost') {
    const grad = c.createLinearGradient(bx, by, bx, by + bh)
    grad.addColorStop(0, pressed ? P.topDark : P.top)
    grad.addColorStop(0.55, pressed ? P.midDark : P.mid)
    grad.addColorStop(1, pressed ? P.bottomDark : P.bottom)
    c.fillStyle = enabled ? grad : P.disabledBg
    _rr(c, bx, by, bw, bh, radius); c.fill()
  } else {
    // ghost：半透纸白
    c.fillStyle = enabled ? 'rgba(255,248,228,0.35)' : 'rgba(200,195,180,0.2)'
    _rr(c, bx, by, bw, bh, radius); c.fill()
  }

  // 顶部高光条（内侧 1px 亮金线，让按钮立体）
  if (style !== 'ghost' && enabled) {
    const hiGrad = c.createLinearGradient(bx, by, bx, by + bh * 0.4)
    hiGrad.addColorStop(0, 'rgba(255,255,220,0.45)')
    hiGrad.addColorStop(1, 'rgba(255,255,220,0)')
    c.fillStyle = hiGrad
    _rr(c, bx + 1 * S, by + 1 * S, bw - 2 * S, bh * 0.4, radius * 0.7); c.fill()
  }

  // 内阴影（pressed 时强化"压下去"的感觉）
  if (pressed) {
    c.save()
    c.globalAlpha = 0.35
    c.fillStyle = '#000'
    _rr(c, bx, by, bw, 3 * S, radius); c.fill()
    c.restore()
  }

  // 边框（双层：外金边 + 内暗线）
  if (style === 'ghost') {
    // 虚线金边
    c.strokeStyle = enabled ? P.border : 'rgba(150,135,95,0.5)'
    c.lineWidth = 1.2 * S
    c.setLineDash([4 * S, 3 * S])
    _rr(c, bx, by, bw, bh, radius); c.stroke()
    c.setLineDash([])
  } else {
    c.strokeStyle = enabled ? P.border : 'rgba(140,130,110,0.5)'
    c.lineWidth = 1.5 * S
    _rr(c, bx, by, bw, bh, radius); c.stroke()
    // 内侧暗线（1*S），加边厚度感
    if (enabled) {
      c.strokeStyle = P.borderInner
      c.lineWidth = 0.8 * S
      _rr(c, bx + 1.5 * S, by + 1.5 * S, bw - 3 * S, bh - 3 * S, Math.max(2 * S, radius - 1.5 * S))
      c.stroke()
    }
  }

  // flashT 高光（成功闪光），叠在文字之前
  if (flashT > 0) {
    c.save()
    c.globalAlpha = flashT * 0.6
    c.fillStyle = '#fff8d8'
    _rr(c, bx, by, bw, bh, radius); c.fill()
    c.restore()
  }

  // 主文字（副文字在则主文字上移 6*S，副文字下移 9*S；否则主文字居中）
  const hasSub = subText && subText.length > 0
  const fs = opts.fontSize || Math.max(11 * S, Math.min(16 * S, bh * 0.44))
  c.fillStyle = enabled ? P.text : '#888'
  c.font = `bold ${fs}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  // 字描边（金棕 1px，让金底白字/深底金字更锐利）
  if (enabled && P.textStroke) {
    c.save()
    c.lineWidth = 2 * S
    c.strokeStyle = P.textStroke
    c.strokeText(text, bx + bw / 2, by + (hasSub ? bh * 0.38 : bh / 2))
    c.restore()
  }
  c.fillText(text, bx + bw / 2, by + (hasSub ? bh * 0.38 : bh / 2))

  if (hasSub) {
    const sfs = opts.subFontSize || 10 * S
    c.fillStyle = enabled ? P.subText : '#888'
    c.font = `${sfs}px "PingFang SC",sans-serif`
    c.fillText(subText, bx + bw / 2, by + bh * 0.72)
  }

  c.restore()
}

// 按钮调色板：集中在一处，外观升级只改这里一处即可影响全站
function _btnPalette(style) {
  switch (style) {
    case 'milestone':  // 升星/突破 · 金+紫渐变
      return {
        top: '#ffe090', mid: '#f0a2e0', bottom: '#6a3a8a',
        topDark: '#d8b870', midDark: '#b080b0', bottomDark: '#4a2070',
        text: '#fff8e0', textStroke: 'rgba(70,20,90,0.6)',
        subText: 'rgba(255,240,220,0.8)',
        border: '#c89028', borderInner: 'rgba(80,30,100,0.5)',
        glow: '#e0a0ff',
        disabledBg: 'rgba(120,100,120,0.22)',
      }
    case 'silver':  // 分解/确认
      return {
        top: '#f0ead4', mid: '#d9d1b8', bottom: '#9a907a',
        topDark: '#d4ccb0', midDark: '#b8ae94', bottomDark: '#7a7058',
        text: '#3a2800', textStroke: 'rgba(255,248,220,0.45)',
        subText: 'rgba(58,40,0,0.7)',
        border: '#9a8858', borderInner: 'rgba(80,60,20,0.3)',
        glow: '#ffe8a8',
        disabledBg: 'rgba(120,115,100,0.22)',
      }
    case 'danger':  // 删除/重置
      return {
        top: '#d95566', mid: '#b8303f', bottom: '#7a1d25',
        topDark: '#b8404e', midDark: '#9a2430', bottomDark: '#5a1018',
        text: '#fff8e0', textStroke: 'rgba(70,10,15,0.6)',
        subText: 'rgba(255,240,220,0.8)',
        border: '#8a2530', borderInner: 'rgba(40,0,5,0.4)',
        glow: '#ff8080',
        disabledBg: 'rgba(120,80,85,0.22)',
      }
    case 'ghost':  // 取消/返回 · 透底虚线
      return {
        top: 'transparent', mid: 'transparent', bottom: 'transparent',
        topDark: 'transparent', midDark: 'transparent', bottomDark: 'transparent',
        text: '#5a3000', textStroke: null,
        subText: 'rgba(90,48,0,0.7)',
        border: '#b8801a', borderInner: null,
        glow: '#ffd060',
        disabledBg: 'transparent',
      }
    case 'gold':
    default:  // 升级/领取/确认 · CTA 金
      return {
        top: '#ffe0a0', mid: '#f0b060', bottom: '#b88018',
        topDark: '#d8b870', midDark: '#c08040', bottomDark: '#8a5a0a',
        text: '#3a1a00', textStroke: 'rgba(255,245,200,0.55)',
        subText: 'rgba(58,26,0,0.75)',
        border: '#b8801a', borderInner: 'rgba(90,48,0,0.35)',
        glow: '#ffd060',
        disabledBg: 'rgba(120,110,90,0.22)',
      }
  }
}

module.exports = {
  drawPanel, drawRibbonIcon, wrapText, drawDialog, drawTipRow, drawDivider,
  drawConfirmDialog, handleConfirmDialogTouch,
  drawCelebrationBackdrop, drawRewardRow, drawBuffCard,
  drawScrollablePanel, handleScrollablePanelTouch, createScrollState,
  drawPressOverlay,
  registerTouchRect, dispatchTouchRect, clearTouchRects,
  drawGuideBubble,
  drawLingCard, drawLingHeader,
  drawPrimaryButton,
  drawShareIconBtn,
}
