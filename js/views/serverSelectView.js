const V = require('./env')
const serverConfig = require('../data/serverConfig')

function _rr(c, x, y, w, h, r) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function _text(c, text, x, y, size, color, weight, align) {
  c.font = `${weight || ''} ${size}px "PingFang SC","Microsoft YaHei",serif`.trim()
  c.textAlign = align || 'left'
  c.textBaseline = 'middle'
  c.fillStyle = color
  c.fillText(text, x, y)
}

function _fitText(c, text, maxW) {
  let s = String(text || '')
  if (c.measureText(s).width <= maxW) return s
  while (s.length > 1 && c.measureText(`${s}…`).width > maxW) s = s.slice(0, -1)
  return `${s}…`
}

function _serverNo(server) {
  return String((server && server.serverId) || 's1').replace(/^s/i, '')
}

function _serverName(server) {
  const id = server && server.serverId
  const name = String((server && server.name) || '').trim()
  if (id === 's1' && (!name || name === '一服')) return '紫霄仙域'
  if (id === 's2' && (!name || name === '二服')) return '逍遥剑宗'
  return name || String(id || 'S1').toUpperCase()
}

function _serverTitle(server) {
  return `S${_serverNo(server)} · ${_serverName(server)}`
}

function _statusMeta(server) {
  const status = server && server.status
  if (status === 'maintenance') return { text: '维护', color: '#87909A' }
  if (status === 'upcoming') return { text: '维护', color: '#87909A' }
  if (status === 'closed') return { text: '维护', color: '#87909A' }
  if (server && server.isRecommended) return { text: '流畅', color: '#43B985' }
  return { text: '流畅', color: '#43B985' }
}

function _serverNumValue(server) {
  const n = parseInt(String((server && server.serverId) || '').replace(/^s/i, ''), 10)
  return Number.isFinite(n) ? n : 1
}

function _getRecentServer(list) {
  const lastId = serverConfig.getStoredSelectedServerId ? serverConfig.getStoredSelectedServerId() : ''
  if (!lastId) return null
  return list.find((s) => s.serverId === lastId) || null
}

function _buildTabs(list) {
  const tabs = []
  if (list.some((s) => s.isRecommended)) tabs.push({ key: 'recommend', label: '推荐' })
  if (_getRecentServer(list)) tabs.push({ key: 'recent', label: '最近登录' })
  const ranges = {}
  list.forEach((server) => {
    const n = _serverNumValue(server)
    const start = Math.floor((n - 1) / 10) * 10 + 1
    ranges[start] = true
  })
  Object.keys(ranges).map(Number).sort((a, b) => a - b).forEach((start) => {
    tabs.push({ key: `range:${start}`, label: `S${start}-S${start + 9}`, start, end: start + 9 })
  })
  return tabs.length ? tabs : [{ key: 'recent', label: '最近登录' }]
}

function _activeTab(g, tabs) {
  const exists = tabs.some((t) => t.key === g._serverCategory)
  if (!exists) g._serverCategory = tabs[0].key
  return tabs.find((t) => t.key === g._serverCategory) || tabs[0]
}

function _serversForTab(list, tab) {
  if (!tab) return list
  if (tab.key === 'recommend') {
    const recommended = list.filter((s) => s.isRecommended)
    return recommended.length ? recommended : list.slice(0, 1)
  }
  if (tab.key === 'recent') return [_getRecentServer(list)].filter(Boolean)
  if (tab.start) return list.filter((s) => {
    const n = _serverNumValue(s)
    return n >= tab.start && n <= tab.end
  })
  return list
}

function _drawBg(g) {
  const { ctx: c, W, H, S } = V
  const grad = c.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, '#edf3ea')
  grad.addColorStop(0.36, '#b9cbc2')
  grad.addColorStop(0.72, '#6f8790')
  grad.addColorStop(1, '#273b49')
  c.fillStyle = grad
  c.fillRect(0, 0, W, H)

  c.save()
  c.globalAlpha = 0.25
  c.fillStyle = '#ffffff'
  for (let i = 0; i < 8; i++) {
    const cx = ((i * 83 + (g.af || 0) * 0.05) % (W + 120 * S)) - 60 * S
    const cy = V.safeTop + 28 * S + i * 42 * S
    c.beginPath()
    c.ellipse(cx, cy, 48 * S, 15 * S, -0.2, 0, Math.PI * 2)
    c.ellipse(cx + 34 * S, cy + 2 * S, 42 * S, 13 * S, 0.1, 0, Math.PI * 2)
    c.fill()
  }
  c.globalAlpha = 0.18
  c.strokeStyle = '#e5d79b'
  c.lineWidth = 1.2 * S
  for (let i = 0; i < 5; i++) {
    const y = V.safeTop + 38 * S + i * 72 * S
    c.beginPath()
    c.moveTo(20 * S, y)
    c.bezierCurveTo(W * 0.28, y - 26 * S, W * 0.48, y + 28 * S, W - 18 * S, y - 8 * S)
    c.stroke()
  }
  c.restore()
}

function _drawSectionTitle(c, x, y, text, S) {
  c.save()
  c.fillStyle = 'rgba(255,255,255,0.78)'
  c.beginPath(); c.arc(x, y, 2.2 * S, 0, Math.PI * 2); c.fill()
  _text(c, text, x + 13 * S, y, 13 * S, '#F2EBD6', 'bold')
  c.strokeStyle = 'rgba(236,224,183,0.34)'
  c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(x + 88 * S, y); c.lineTo(x + 220 * S, y); c.stroke()
  c.restore()
}

function _drawEnterButton(c, x, y, w, h, enabled, S) {
  c.save()
  const r = 7 * S
  c.shadowColor = enabled ? 'rgba(72,48,18,0.08)' : 'rgba(0,0,0,0.08)'
  c.shadowBlur = 1.5 * S
  c.shadowOffsetY = 0.6 * S

  c.beginPath()
  c.moveTo(x + r, y)
  c.lineTo(x + w - 8 * S, y)
  c.quadraticCurveTo(x + w, y, x + w, y + r)
  c.lineTo(x + w, y + h - r)
  c.quadraticCurveTo(x + w, y + h, x + w - 8 * S, y + h)
  c.lineTo(x + r, y + h)
  c.quadraticCurveTo(x, y + h, x, y + h - r)
  c.lineTo(x, y + r)
  c.quadraticCurveTo(x, y, x + r, y)
  c.closePath()

  c.fillStyle = enabled ? '#F3D89C' : '#BFC6C0'
  c.fill()

  c.shadowColor = 'transparent'
  c.strokeStyle = enabled ? 'rgba(132,99,49,0.24)' : 'rgba(80,80,80,0.18)'
  c.lineWidth = 0.7 * S
  c.stroke()

  c.save()
  c.globalAlpha = enabled ? 0.18 : 0.10
  c.fillStyle = '#FFF7DF'
  c.beginPath()
  c.moveTo(x + r, y + 1.5 * S)
  c.lineTo(x + w - 8 * S, y + 1.5 * S)
  c.quadraticCurveTo(x + w - 1.5 * S, y + 1.5 * S, x + w - 1.5 * S, y + r)
  c.lineTo(x + w - 1.5 * S, y + h * 0.42)
  c.lineTo(x + 1.5 * S, y + h * 0.42)
  c.lineTo(x + 1.5 * S, y + r)
  c.quadraticCurveTo(x + 1.5 * S, y + 1.5 * S, x + r, y + 1.5 * S)
  c.closePath()
  c.fill()
  c.restore()

  _text(c, '进入', x + w / 2, y + h / 2 + 0.2 * S, 12 * S, enabled ? '#5F421D' : '#F0EEE6', '700', 'center')
  c.restore()
}

function _drawTag(c, x, y, text, color, S) {
  const w = Math.max(26 * S, 14 * S + String(text).length * 12 * S)
  const h = 18 * S
  c.save()
  _rr(c, x, y - h / 2, w, h, 4 * S)
  c.fillStyle = color
  c.fill()
  _text(c, text, x + w / 2, y, 10 * S, '#FFFFFF', 'bold', 'center')
  c.restore()
  return w
}

function _drawServerCard(g, server, idx, x, y, w, h, opts) {
  const { ctx: c, S } = V
  const selected = (g.selectedServerId || 's1') === server.serverId
  const enterable = serverConfig.canEnterServer(server)
  const recommended = !!(server.isRecommended || opts.recommended)
  const meta = _statusMeta(server)
  const title = _serverTitle(server)

  c.save()
  c.globalAlpha = enterable ? 1 : 0.68
  _rr(c, x, y, w, h, 10 * S)
  const grad = c.createLinearGradient(x, y, x + w, y + h)
  grad.addColorStop(0, recommended ? 'rgba(238,252,247,0.94)' : 'rgba(255,251,239,0.94)')
  grad.addColorStop(1, recommended ? 'rgba(207,232,227,0.86)' : 'rgba(246,240,224,0.88)')
  c.fillStyle = grad
  c.fill()
  c.strokeStyle = selected ? 'rgba(212,176,84,0.98)' : 'rgba(218,203,162,0.62)'
  c.lineWidth = selected ? 2.2 * S : 1 * S
  c.stroke()

  const ribbonW = recommended ? 34 * S : 30 * S
  if (recommended) {
    c.save()
    c.translate(x + 16 * S, y)
    c.fillStyle = '#5AB17F'
    c.beginPath()
    c.moveTo(0, 0); c.lineTo(ribbonW, 0); c.lineTo(ribbonW, 32 * S); c.lineTo(ribbonW / 2, 25 * S); c.lineTo(0, 32 * S)
    c.closePath(); c.fill()
    _text(c, '推荐', ribbonW / 2, 14.5 * S, 9.5 * S, '#FFFFFF', 'bold', 'center')
    c.restore()
  }

  const btnW = 58 * S
  const btnH = 29 * S
  const btnX = x + w - 70 * S
  const btnY = y + h / 2 - btnH / 2
  const hasSideRibbon = !!(server.isRecommended || recommended)
  const titleX = x + (hasSideRibbon ? 55 : 15) * S
  const titleY = y + (opts.large ? 36 : 23) * S
  const lineY = y + (opts.large ? 63 : 45) * S
  c.font = `600 ${opts.large ? 18 * S : 14.2 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
  c.fillStyle = '#213848'
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const titleMaxW = Math.max(86 * S, btnX - titleX - 10 * S)
  const fittedTitle = _fitText(c, title, titleMaxW)
  c.fillText(fittedTitle, titleX, titleY)
  if (server.isRecommended && !recommended) {
    c.save()
    c.translate(x + 16 * S, y)
    c.fillStyle = '#5AB17F'
    c.beginPath()
    c.moveTo(0, 0); c.lineTo(ribbonW, 0); c.lineTo(ribbonW, 32 * S); c.lineTo(ribbonW / 2, 25 * S); c.lineTo(0, 32 * S)
    c.closePath(); c.fill()
    _text(c, '推荐', ribbonW / 2, 14.5 * S, 9.5 * S, '#FFFFFF', 'bold', 'center')
    c.restore()
  }

  c.font = `${10.5 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = meta.color
  c.beginPath(); c.arc(titleX + 3.5 * S, lineY, 3.5 * S, 0, Math.PI * 2); c.fill()
  _text(c, meta.text, titleX + 13 * S, lineY, 10.8 * S, meta.color, '600')

  _drawEnterButton(c, btnX, btnY, btnW, btnH, enterable, S)
  c.restore()
  return [btnX, btnY, btnW, btnH]
}

function _drawSideTabs(g, tabs, activeTab, x, y, w, S) {
  const { ctx: c } = V
  g._serverCategoryRects = []
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i]
    const h = 34 * S
    const ty = y + i * (h + 4 * S)
    const active = tab.key === activeTab.key
    c.save()
    _rr(c, x, ty, w, h, 8 * S)
    c.fillStyle = active ? 'rgba(244,248,237,0.92)' : 'rgba(31,55,62,0.44)'
    c.fill()
    if (active) {
      c.strokeStyle = 'rgba(223,207,146,0.45)'
      c.lineWidth = 1 * S
      c.stroke()
      c.fillStyle = '#5D7068'
      c.beginPath(); c.arc(x + 10 * S, ty + h / 2, 2.4 * S, 0, Math.PI * 2); c.fill()
    }
    c.font = `600 ${10.2 * S}px "PingFang SC","Microsoft YaHei",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = active ? '#52645D' : 'rgba(238,240,226,0.76)'
    c.fillText(tab.label, x + w / 2 + (active ? 3 * S : 0), ty + h / 2 + 0.5 * S)
    g._serverCategoryRects.push({ x, y: ty, w, h, key: tab.key })
    c.restore()
  }
}

function render(g) {
  const { ctx: c, W, H, S, safeTop } = V
  _drawBg(g)

  const list = g.serverList && g.serverList.length ? g.serverList : serverConfig.getFallbackServers()
  const tabs = _buildTabs(list)
  const activeTab = _activeTab(g, tabs)
  const recent = _getRecentServer(list)
  const selected = list.find((s) => s.serverId === g.selectedServerId) || recent || list[0]
  const recommended = list.find((s) => s.isRecommended && serverConfig.canEnterServer(s)) || selected
  const heroServer = recent || recommended || selected

  g._serverSelectRects = []
  g._serverEnterRects = []
  g._serverEnterRect = null

  const margin = 24 * S
  const top = safeTop + 24 * S
  c.save()
  _text(c, '灵宠消消塔', margin + 6 * S, top + 28 * S, 34 * S, '#142938', '900')
  _text(c, '选择修行仙域', margin + 60 * S, top + 68 * S, 14 * S, '#647C82', 'bold')
  c.strokeStyle = 'rgba(84,112,116,0.28)'
  c.beginPath(); c.moveTo(margin + 40 * S, top + 68 * S); c.lineTo(margin + 52 * S, top + 68 * S); c.stroke()
  c.beginPath(); c.moveTo(margin + 150 * S, top + 68 * S); c.lineTo(margin + 170 * S, top + 68 * S); c.stroke()

  const badgeR = 38 * S
  const bx = W - 58 * S
  const by = top + 58 * S
  c.beginPath(); c.arc(bx, by, badgeR, 0, Math.PI * 2)
  c.fillStyle = 'rgba(50,132,128,0.82)'; c.fill()
  c.strokeStyle = 'rgba(236,220,150,0.78)'; c.lineWidth = 1.5 * S; c.stroke()
  _text(c, '推荐服', bx, by - 7 * S, 14 * S, '#FFFFFF', 'bold', 'center')
  _text(c, '新服活动多', bx, by + 12 * S, 10 * S, '#E8F7ED', '', 'center')
  c.restore()

  const recentTop = top + 128 * S
  _drawSectionTitle(c, margin, recentTop, recent ? '最近登录' : '推荐服务器', S)
  const recentX = margin + 8 * S
  const recentY = recentTop + 22 * S
  const recentW = W - margin * 2 - 16 * S
  const recentH = 78 * S
  const recentBtn = _drawServerCard(g, heroServer, 0, recentX, recentY, recentW, recentH, { recommended: !!heroServer.isRecommended, large: true })
  g._serverSelectRects.push({ x: recentX, y: recentY, w: recentW, h: recentH, serverId: heroServer.serverId })
  g._serverEnterRects.push({ x: recentBtn[0], y: recentBtn[1], w: recentBtn[2], h: recentBtn[3], serverId: heroServer.serverId })

  const allTop = recentY + recentH + 36 * S
  _drawSectionTitle(c, margin, allTop, '所有服务器', S)

  const legends = [
    ['流畅', '#43B985'], ['繁忙', '#F39A28'], ['爆满', '#D95757'], ['维护', '#87909A'],
  ]
  let lx = W - 176 * S
  const legendY = allTop
  for (const item of legends) {
    c.fillStyle = item[1]
    c.beginPath(); c.arc(lx, legendY, 3 * S, 0, Math.PI * 2); c.fill()
    _text(c, item[0], lx + 7 * S, legendY, 9.2 * S, '#E8E5D4')
    lx += 41 * S
  }

  const sideX = margin
  const sideW = 64 * S
  const listX = sideX + sideW + 12 * S
  const listY = allTop + 22 * S
  _drawSideTabs(g, tabs, activeTab, sideX, listY, sideW, S)

  const rowsAll = _serversForTab(list, activeTab)
  const rowW = W - listX - margin
  const rowH = Math.min(62 * S, Math.max(54 * S, (H - listY - 24 * S) / Math.max(4, Math.min(6, rowsAll.length || 1))))
  const gap = 10 * S
  const maxRows = Math.max(1, Math.floor((H - listY - 16 * S) / (rowH + gap)))
  const rows = rowsAll.slice(0, Math.min(rowsAll.length, maxRows))
  for (let i = 0; i < rows.length; i++) {
    const server = rows[i]
    const y = listY + i * (rowH + gap)
    const btn = _drawServerCard(g, server, i, listX, y, rowW, rowH, { recommended: false, large: false })
    g._serverSelectRects.push({ x: listX, y, w: rowW, h: rowH, serverId: server.serverId })
    g._serverEnterRects.push({ x: btn[0], y: btn[1], w: btn[2], h: btn[3], serverId: server.serverId })
  }

  if (g.serverListLoading) {
    c.save()
    c.fillStyle = 'rgba(20,40,48,0.38)'
    _rr(c, W / 2 - 82 * S, H - 46 * S, 164 * S, 26 * S, 13 * S)
    c.fill()
    _text(c, '正在观星寻服...', W / 2, H - 33 * S, 12 * S, '#F7E9C7', 'bold', 'center')
    c.restore()
  } else if (g.serverListFallback) {
    c.save()
    c.fillStyle = 'rgba(20,40,48,0.38)'
    _rr(c, W / 2 - 96 * S, H - 46 * S, 192 * S, 26 * S, 13 * S)
    c.fill()
    _text(c, '当前使用本地服务器列表', W / 2, H - 33 * S, 12 * S, '#F7E9C7', '', 'center')
    c.restore()
  }
}

module.exports = { render }
