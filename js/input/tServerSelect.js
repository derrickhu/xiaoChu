const P = require('../platform')
const serverConfig = require('../data/serverConfig')

function tServerSelect(g, type, x, y) {
  if (type !== 'end') return
  const list = g.serverList || []
  const tabRects = g._serverCategoryRects || []
  for (let i = 0; i < tabRects.length; i++) {
    const r = tabRects[i]
    if (!g._hitRect(x, y, r.x, r.y, r.w, r.h)) continue
    g._serverCategory = r.key
    g._dirty = true
    return
  }

  const enterRects = g._serverEnterRects || []
  for (let i = 0; i < enterRects.length; i++) {
    const r = enterRects[i]
    if (!g._hitRect(x, y, r.x, r.y, r.w, r.h)) continue
    const server = list.find((s) => s.serverId === r.serverId)
    if (!server) return
    g.selectedServerId = server.serverId
    g._dirty = true
    if (!serverConfig.canEnterServer(server)) {
      P.showGameToast((server.notice || '服务器暂不可进入'), { type: 'warn' })
      return
    }
    if (g.enterServer) g.enterServer(server)
    return
  }

  const rects = g._serverSelectRects || []
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i]
    if (!g._hitRect(x, y, r.x, r.y, r.w, r.h)) continue
    const server = list.find((s) => s.serverId === r.serverId)
    if (!server) return
    g.selectedServerId = server.serverId
    g._dirty = true
    if (!serverConfig.canEnterServer(server)) {
      P.showGameToast((server.notice || '服务器暂不可进入'), { type: 'warn' })
    }
    return
  }

  if (g._serverEnterRect && g._hitRect(x, y, ...g._serverEnterRect)) {
    const server = list.find((s) => s.serverId === g.selectedServerId) || list[0]
    if (!server) return
    if (!serverConfig.canEnterServer(server)) {
      P.showGameToast((server.notice || '服务器暂不可进入'), { type: 'warn' })
      return
    }
    if (g.enterServer) g.enterServer(server)
  }
}

module.exports = tServerSelect
