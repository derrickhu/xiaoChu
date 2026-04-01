/**
 * 新手引导绘制：可消除珠组高亮、长拖拽BFS路径演示、提示条、Combo庆祝横幅
 */
const V = require('../env')
const { ATTR_COLOR } = require('../../data/tower')
const tutorial = require('../../engine/tutorial')

// ===== 新手棋盘引导：扫描可消除的宠物属性珠组 =====
let _newbieHighlightCache = null
let _newbieHighlightFrame = -1

function _getNewbieHighlightCells(g) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn' || g.dragging) return null
  if (_newbieHighlightFrame === g.af) return _newbieHighlightCache

  const { ROWS, COLS } = V
  const petAttrs = new Set()
  if (g.pets) g.pets.forEach(p => petAttrs.add(p.attr))

  const highlighted = new Set()
  const _attr = (r, c) => {
    const cell = g.board[r] && g.board[r][c]
    return cell ? (typeof cell === 'string' ? cell : cell.attr) : null
  }

  // 扫描横向连续 3+
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      const a = _attr(r, c)
      if (!a || !petAttrs.has(a)) continue
      let end = c + 1
      while (end < COLS && _attr(r, end) === a) end++
      if (end - c >= 3) {
        for (let cc = c; cc < end; cc++) highlighted.add(r * COLS + cc)
      }
      if (end - c >= 3) c = end - 1
    }
  }
  // 扫描纵向连续 3+
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      const a = _attr(r, c)
      if (!a || !petAttrs.has(a)) continue
      let end = r + 1
      while (end < ROWS && _attr(end, c) === a) end++
      if (end - r >= 3) {
        for (let rr = r; rr < end; rr++) highlighted.add(rr * COLS + c)
      }
      if (end - r >= 3) r = end - 1
    }
  }

  _newbieHighlightCache = highlighted.size > 0 ? highlighted : null
  _newbieHighlightFrame = g.af
  return _newbieHighlightCache
}

// ===== 新手推荐长拖拽：搜索将同色珠拖到配对位的多步路径 =====
let _longDragCache = null
let _longDragFrame = -1

function _bfsGridPath(sr, sc, tr, tc, ROWS, COLS) {
  if (sr === tr && sc === tc) return [[sr, sc]]
  var visited = new Set()
  var parent = new Map()
  var startKey = sr * COLS + sc
  visited.add(startKey)
  var queue = [[sr, sc]]
  while (queue.length > 0) {
    var cur = queue.shift()
    var r = cur[0], c = cur[1]
    if (r === tr && c === tc) {
      var path = []
      var cr = tr, cc = tc
      while (cr !== sr || cc !== sc) {
        path.unshift([cr, cc])
        var prev = parent.get(cr * COLS + cc)
        cr = prev[0]; cc = prev[1]
      }
      path.unshift([sr, sc])
      return path
    }
    var nbrs = [[0,1],[0,-1],[1,0],[-1,0]]
    for (var d = 0; d < 4; d++) {
      var nr = r + nbrs[d][0], nc = c + nbrs[d][1]
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      var nk = nr * COLS + nc
      if (visited.has(nk)) continue
      visited.add(nk)
      parent.set(nk, [r, c])
      queue.push([nr, nc])
    }
  }
  return null
}

function _findLongDragHint(g) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn' || g.dragging) return null
  if (_longDragFrame === g.af) return _longDragCache

  var ROWS = V.ROWS, COLS = V.COLS
  var petAttrs = new Set()
  if (g.pets) g.pets.forEach(function (p) { petAttrs.add(p.attr) })

  // 构建属性网格用于模拟
  var grid = []
  for (var r = 0; r < ROWS; r++) {
    grid[r] = []
    for (var c = 0; c < COLS; c++) {
      var cell = g.board[r] && g.board[r][c]
      grid[r][c] = cell ? (typeof cell === 'string' ? cell : cell.attr) : null
    }
  }

  // 模拟拖拽后统计消除组数（即 Combo 数）
  function _simDragMatches(path) {
    var sim = []
    for (var r = 0; r < ROWS; r++) sim[r] = grid[r].slice()
    var held = sim[path[0][0]][path[0][1]]
    for (var i = 0; i < path.length - 1; i++)
      sim[path[i][0]][path[i][1]] = sim[path[i + 1][0]][path[i + 1][1]]
    sim[path[path.length - 1][0]][path[path.length - 1][1]] = held

    var count = 0
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc <= COLS - 3; cc++) {
        var a = sim[rr][cc]
        if (!a) continue
        var end = cc + 1
        while (end < COLS && sim[rr][end] === a) end++
        if (end - cc >= 3) { count++; cc = end - 1 }
      }
    }
    for (var cc = 0; cc < COLS; cc++) {
      for (var rr = 0; rr <= ROWS - 3; rr++) {
        var a = sim[rr][cc]
        if (!a) continue
        var end = rr + 1
        while (end < ROWS && sim[end][cc] === a) end++
        if (end - rr >= 3) { count++; rr = end - 1 }
      }
    }
    return count
  }

  var best = null

  // 遍历所有宠物属性格，尝试拖到不同位置，模拟后挑选 Combo 最高的路径
  for (var sr = 0; sr < ROWS; sr++) {
    for (var sc = 0; sc < COLS; sc++) {
      if (!petAttrs.has(grid[sr][sc])) continue
      for (var tr = 0; tr < ROWS; tr++) {
        for (var tc = 0; tc < COLS; tc++) {
          if (tr === sr && tc === sc) continue
          var dist = Math.abs(sr - tr) + Math.abs(sc - tc)
          if (dist < 3 || dist > 8) continue

          var path = _bfsGridPath(sr, sc, tr, tc, ROWS, COLS)
          if (!path || path.length < 4 || path.length > 9) continue

          var matches = _simDragMatches(path)
          if (matches < 1) continue

          var score = matches * 1000 + path.length * 10
          if (!best || score > best.score) {
            best = { path: path, attr: grid[sr][sc], score: score, matches: matches }
          }
        }
      }
      if (best && best.matches >= 3) break
    }
    if (best && best.matches >= 3) break
  }

  _longDragCache = best
  _longDragFrame = g.af
  return _longDragCache
}

// ===== 新手手指引导动画：长路径拖拽演示 =====
function _drawNewbieFingerGuide(g, cs, bx, by) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn' || g.dragging) return
  if (tutorial.isActive()) return

  var ctx = V.ctx, S = V.S, COLS = V.COLS

  // 优先：棋盘上已有可消除组 → 在高亮珠上画呼吸手指
  var highlight = _getNewbieHighlightCells(g)
  if (highlight && highlight.size > 0) {
    var groups = _groupHighlightCells(highlight, COLS)
    for (var i = 0; i < Math.min(groups.length, 2); i++) {
      var cell = groups[i]
      var cx = bx + cell.c * cs + cs * 0.5
      var cy = by + cell.r * cs + cs * 0.5
      var bounce = Math.sin(g.af * 0.06 + i * 1.5) * 5 * S
      var alpha = 0.6 + 0.3 * Math.sin(g.af * 0.08 + i * 2)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = (30 * S) + 'px "PingFang SC",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('\uD83D\uDC46', cx, cy + cs * 0.45 + bounce)
      ctx.restore()
    }
    return
  }

  // 搜索长拖拽路径（转珠演示）
  var hint = _findLongDragHint(g)
  if (hint && hint.path) {
    _drawLongDragAnim(g, ctx, S, cs, bx, by, hint)
    return
  }
}

function _drawLongDragAnim(g, ctx, S, cs, bx, by, hint) {
  var path = hint.path
  var len = path.length
  var cycleDur = 50 + len * 22
  var t = (g.af % cycleDur) / cycleDur
  var attrColor = (ATTR_COLOR[hint.attr] && ATTR_COLOR[hint.attr].main) || '#ffd700'

  // 计算手指当前位置
  var fx, fy, pathProgress, alpha = 1

  if (t < 0.08) {
    // 淡入 + 起点脉冲
    alpha = t / 0.08
    fx = bx + path[0][1] * cs + cs * 0.5
    fy = by + path[0][0] * cs + cs * 0.5
    pathProgress = 0
  } else if (t < 0.72) {
    // 沿路径移动
    var moveT = (t - 0.08) / 0.64
    var segIdx = Math.min(Math.floor(moveT * (len - 1)), len - 2)
    var segT = moveT * (len - 1) - segIdx
    var r1 = path[segIdx][0], c1 = path[segIdx][1]
    var r2 = path[segIdx + 1][0], c2 = path[segIdx + 1][1]
    fx = bx + (c1 + (c2 - c1) * segT) * cs + cs * 0.5
    fy = by + (r1 + (r2 - r1) * segT) * cs + cs * 0.5
    pathProgress = moveT
  } else if (t < 0.85) {
    // 终点停留
    fx = bx + path[len - 1][1] * cs + cs * 0.5
    fy = by + path[len - 1][0] * cs + cs * 0.5
    pathProgress = 1
  } else {
    // 淡出
    alpha = 1 - (t - 0.85) / 0.15
    fx = bx + path[len - 1][1] * cs + cs * 0.5
    fy = by + path[len - 1][0] * cs + cs * 0.5
    pathProgress = 1
  }

  ctx.save()
  ctx.globalAlpha = alpha

  // 绘制完整预定路径（浅色圆点标记每个经过的格子）
  for (var i = 0; i < len; i++) {
    var px = bx + path[i][1] * cs + cs * 0.5
    var py = by + path[i][0] * cs + cs * 0.5
    ctx.save()
    ctx.globalAlpha = alpha * 0.18
    ctx.beginPath()
    ctx.arc(px, py, 4 * S, 0, Math.PI * 2)
    ctx.fillStyle = attrColor
    ctx.fill()
    ctx.restore()
  }

  // 已走过的轨迹（渐变虚线）
  var visitedCount = Math.floor(pathProgress * (len - 1)) + 1
  if (visitedCount >= 2 || pathProgress > 0) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.55
    ctx.strokeStyle = attrColor
    ctx.lineWidth = 3.5 * S
    ctx.setLineDash([5 * S, 4 * S])
    ctx.beginPath()
    ctx.moveTo(bx + path[0][1] * cs + cs * 0.5, by + path[0][0] * cs + cs * 0.5)
    for (var vi = 1; vi < visitedCount && vi < len; vi++) {
      ctx.lineTo(bx + path[vi][1] * cs + cs * 0.5, by + path[vi][0] * cs + cs * 0.5)
    }
    ctx.lineTo(fx, fy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // 起点光晕
  if (pathProgress < 0.4) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.3 * (1 - pathProgress / 0.4)
    var sx = bx + path[0][1] * cs + cs * 0.5
    var sy = by + path[0][0] * cs + cs * 0.5
    var grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, cs * 0.55)
    grd.addColorStop(0, attrColor)
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(sx, sy, cs * 0.55, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // 终点光晕 + Combo 预告（到达后）
  if (pathProgress > 0.85) {
    ctx.save()
    var endPulse = 0.5 + 0.5 * Math.sin(g.af * 0.12)
    ctx.globalAlpha = alpha * 0.3 * endPulse
    var ex = bx + path[len - 1][1] * cs + cs * 0.5
    var ey = by + path[len - 1][0] * cs + cs * 0.5
    var egrd = ctx.createRadialGradient(ex, ey, 0, ex, ey, cs * 0.6)
    egrd.addColorStop(0, attrColor)
    egrd.addColorStop(1, 'transparent')
    ctx.fillStyle = egrd
    ctx.beginPath(); ctx.arc(ex, ey, cs * 0.6, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Combo 预告标签
    if (hint.matches && hint.matches >= 2) {
      var labelAlpha = alpha * Math.min(1, (pathProgress - 0.85) / 0.1)
      var labelScale = 1 + 0.08 * Math.sin(g.af * 0.15)
      ctx.save()
      ctx.globalAlpha = labelAlpha * 0.95
      ctx.font = 'bold ' + (14 * S * labelScale) + 'px "PingFang SC",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffd700'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4 * S
      var labelText = 'Combo x' + hint.matches + '!'
      ctx.fillText(labelText, ex, ey - cs * 0.6)
      ctx.restore()
    }
  }

  // 手指图标
  ctx.save()
  ctx.globalAlpha = alpha * 0.92
  ctx.font = (30 * S) + 'px "PingFang SC",sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('\uD83D\uDC46', fx, fy + cs * 0.38)
  ctx.restore()

  ctx.restore()
}

// 把高亮 Set 按连通区域分组，返回每组代表格
function _groupHighlightCells(highlight, COLS) {
  const cells = []
  const visited = new Set()
  for (const idx of highlight) {
    if (visited.has(idx)) continue
    visited.add(idx)
    const r = Math.floor(idx / COLS), c = idx % COLS
    cells.push({ r, c })
    // BFS 跳过同组其它格
    const q = [idx]
    while (q.length) {
      const cur = q.shift()
      const cr = Math.floor(cur / COLS), cc = cur % COLS
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const ni = (cr + dr) * COLS + (cc + dc)
        if (highlight.has(ni) && !visited.has(ni)) { visited.add(ni); q.push(ni) }
      }
    }
  }
  return cells
}

// ===== 新手浮动提示条（循环显示，覆盖整个首关） =====
const _NEWBIE_HINTS = [
  '按住珠子沿长路径拖动，经过的珠全部交换！',
  '消除金色珠→金宠攻击，绿色珠→木宠攻击！',
  '一次拖动可穿越整个棋盘，排出多组三连！',
  '连消多种颜色珠子触发 Combo，伤害叠加！',
  '拖得越远、排列越多颜色，Combo 越高！',
  '一次消 4 颗以上灵珠，伤害翻倍！',
  '克制属性攻击伤害 ×2.5，善用五行克制！',
  'Combo 越高伤害加成越大，试试挑战高连击！',
]

function _drawNewbieHint(g, boardTop, padX) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn') return
  const turn = g.turnCount || 0

  const { ctx, W, S } = V
  const text = _NEWBIE_HINTS[turn % _NEWBIE_HINTS.length]
  const barH = 28 * S
  const barY = boardTop - barH - 6 * S

  ctx.save()
  ctx.globalAlpha = 0.88
  ctx.fillStyle = 'rgba(50,30,10,0.75)'
  const rad = 8 * S
  ctx.beginPath()
  ctx.moveTo(padX + rad, barY)
  ctx.lineTo(W - padX - rad, barY)
  ctx.quadraticCurveTo(W - padX, barY, W - padX, barY + rad)
  ctx.lineTo(W - padX, barY + barH - rad)
  ctx.quadraticCurveTo(W - padX, barY + barH, W - padX - rad, barY + barH)
  ctx.lineTo(padX + rad, barY + barH)
  ctx.quadraticCurveTo(padX, barY + barH, padX, barY + barH - rad)
  ctx.lineTo(padX, barY + rad)
  ctx.quadraticCurveTo(padX, barY, padX + rad, barY)
  ctx.closePath()
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.fillStyle = '#ffe9a0'
  ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, W / 2, barY + barH / 2)
  ctx.restore()
}

// ===== 新手 Combo 庆祝横幅（分级激情提示） =====
var _COMBO_MSGS = [
  { min: 2, main: '触发 Combo 连击！', sub: '转珠排列多种颜色，连击更多！', color1: 'rgba(160,120,30,0.9)', color2: 'rgba(200,160,40,0.95)' },
  { min: 3, main: '三连击！伤害飙升！', sub: '转得越远越好，继续排列更多颜色！', color1: 'rgba(180,80,20,0.92)', color2: 'rgba(230,130,30,0.95)' },
  { min: 5, main: '五连击！超强攻势！', sub: '你已经掌握转珠精髓了！', color1: 'rgba(200,40,30,0.92)', color2: 'rgba(240,80,40,0.95)' },
  { min: 7, main: '超级连击！转珠大师！', sub: '势不可挡！敌人在颤抖！', color1: 'rgba(120,20,180,0.92)', color2: 'rgba(180,40,240,0.95)' },
]

function _getComboMsg(combo) {
  var msg = _COMBO_MSGS[0]
  for (var i = _COMBO_MSGS.length - 1; i >= 0; i--) {
    if (combo >= _COMBO_MSGS[i].min) { msg = _COMBO_MSGS[i]; break }
  }
  return msg
}

function _drawNewbieComboBanner(g, boardTop, padX) {
  var banner = g._newbieComboBanner
  if (!banner) return
  banner.timer++
  g._dirty = true
  var combo = banner.combo || 2
  var dur = combo >= 5 ? 120 : 100
  if (banner.timer > dur) { g._newbieComboBanner = null; return }

  var ctx = V.ctx, W = V.W, S = V.S
  var msg = _getComboMsg(combo)

  var alpha
  if (banner.timer < 15) alpha = banner.timer / 15
  else if (banner.timer > dur - 20) alpha = (dur - banner.timer) / 20
  else alpha = 1

  // 高 combo 时横幅更大
  var barH = (combo >= 5 ? 60 : 52) * S
  var barY = boardTop - barH - 10 * S
  // 入场弹性缩放
  var scaleX = 1
  if (banner.timer < 20) {
    var st = banner.timer / 20
    scaleX = 0.6 + 0.5 * st - 0.1 * Math.sin(st * Math.PI)
  }

  ctx.save()
  ctx.globalAlpha = alpha * 0.96

  // 高级渐变背景
  var cx = W / 2, hw = (W - padX * 2) * 0.5 * scaleX
  var grd = ctx.createLinearGradient(cx - hw, barY, cx + hw, barY)
  grd.addColorStop(0, msg.color1)
  grd.addColorStop(0.5, msg.color2)
  grd.addColorStop(1, msg.color1)
  ctx.fillStyle = grd
  var rad = 10 * S
  var lx = cx - hw, rx = cx + hw
  ctx.beginPath()
  ctx.moveTo(lx + rad, barY)
  ctx.lineTo(rx - rad, barY)
  ctx.quadraticCurveTo(rx, barY, rx, barY + rad)
  ctx.lineTo(rx, barY + barH - rad)
  ctx.quadraticCurveTo(rx, barY + barH, rx - rad, barY + barH)
  ctx.lineTo(lx + rad, barY + barH)
  ctx.quadraticCurveTo(lx, barY + barH, lx, barY + barH - rad)
  ctx.lineTo(lx, barY + rad)
  ctx.quadraticCurveTo(lx, barY, lx + rad, barY)
  ctx.closePath()
  ctx.fill()

  // 边框
  ctx.strokeStyle = combo >= 5 ? 'rgba(255,180,60,0.85)' : 'rgba(255,215,0,0.7)'
  ctx.lineWidth = (combo >= 5 ? 2.5 : 1.5) * S
  ctx.stroke()

  // 闪光条纹（高 combo）
  if (combo >= 3 && banner.timer < dur - 20) {
    ctx.save()
    ctx.clip()
    ctx.globalAlpha = 0.12
    var stripeX = lx + ((banner.timer * 4 * S) % (hw * 4)) - hw
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(stripeX, barY); ctx.lineTo(stripeX + 30 * S, barY)
    ctx.lineTo(stripeX + 15 * S, barY + barH); ctx.lineTo(stripeX - 15 * S, barY + barH)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  // 主文字（含 combo 数）
  ctx.globalAlpha = alpha
  var mainSize = (combo >= 5 ? 16 : 14) * S
  var pulse = combo >= 5 ? (1 + 0.04 * Math.sin(banner.timer * 0.2)) : 1
  ctx.fillStyle = '#fff'
  ctx.font = 'bold ' + (mainSize * pulse) + 'px "PingFang SC",sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3 * S
  ctx.fillText(combo + ' Combo！' + msg.main, W / 2, barY + barH * 0.38)

  // 副文字
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffecc0'
  ctx.font = (11 * S) + 'px "PingFang SC",sans-serif'
  ctx.fillText(msg.sub, W / 2, barY + barH * 0.72)

  ctx.restore()
}

module.exports = {
  getNewbieHighlightCells: _getNewbieHighlightCells,
  drawNewbieFingerGuide: _drawNewbieFingerGuide,
  drawNewbieHint: _drawNewbieHint,
  drawNewbieComboBanner: _drawNewbieComboBanner,
}
