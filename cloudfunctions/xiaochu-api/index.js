const { handleLogin } = require('./lib/auth')
const { handlePull, handlePush } = require('./lib/save')
const { handleSubmit, handleList, handleAction } = require('./lib/ranking')
const { handleQueryPending, handleMarkGranted, handleVerify, handleCallback } = require('./lib/gift')
const { handleRecordInvite, handleClaimInvites } = require('./lib/share')
const { handleInitCollections, handleImportBatch, handleStats, handleListKeys } = require('./lib/admin')
const { respond, parseEvent, preflight } = require('./lib/http')
const { getGameKey } = require('./lib/config')

const ROUTES = {
  'GET /health': async () => ({ ok: true, gameKey: getGameKey(), ts: Date.now() }),
  'POST /health': async () => ({ ok: true, gameKey: getGameKey(), ts: Date.now() }),
  'POST /login': handleLogin,
  'POST /save/pull': handlePull,
  'POST /save/push': handlePush,
  'POST /ranking/submit': handleSubmit,
  'POST /ranking/list': handleList,
  'GET /ranking/list': handleList,
  'POST /ranking/action': handleAction,
  'POST /gift/queryPending': handleQueryPending,
  'POST /gift/markGranted': handleMarkGranted,
  'GET /gift/callback': handleVerify,
  'POST /gift/callback': handleCallback,
  'GET /giftDeliver': handleVerify,
  'POST /giftDeliver': handleCallback,
  'POST /share/recordInvite': handleRecordInvite,
  'POST /share/claimInvites': handleClaimInvites,
  'POST /admin/initCollections': handleInitCollections,
  'POST /admin/importBatch': handleImportBatch,
  'POST /admin/stats': handleStats,
  'POST /admin/listKeys': handleListKeys,
}

exports.main = async (event, context) => {
  try {
    if (event && event.httpMethod === 'OPTIONS') return preflight()

    const req = parseEvent(event)
    const key = `${req.method} ${req.path}`
    const handler = ROUTES[key]
    if (!handler) {
      return respond(404, { ok: false, code: 'NOT_FOUND', error: `no route: ${key}`, gameKey: getGameKey() })
    }

    const result = await handler(req, context)
    if (result && typeof result === 'object' && 'statusCode' in result) return result
    return respond(200, { ok: true, data: result, gameKey: getGameKey() })
  } catch (error) {
    const code = error && error.code ? error.code : 'INTERNAL'
    const status = error && error.status ? error.status : 500
    const message = (error && error.message) || String(error)
    console.error('[xiaochu-api] error:', code, message, error && error.stack)
    const body = { ok: false, code, error: message, gameKey: getGameKey() }
    if (error && error.data !== undefined) body.data = error.data
    return respond(status, body)
  }
}
