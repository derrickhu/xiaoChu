const { getGameKey } = require('./config')

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Max-Age': '86400',
}

function respond(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
      ...(extraHeaders || {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  }
}

function preflight() {
  return { statusCode: 204, headers: { ...CORS_HEADERS }, body: '', isBase64Encoded: false }
}

function parseEvent(event) {
  const input = event || {}
  if (input.httpMethod) {
    let rawBody = input.body || ''
    if (input.isBase64Encoded && rawBody) {
      try { rawBody = Buffer.from(rawBody, 'base64').toString('utf8') } catch (_) {}
    }
    return {
      method: String(input.httpMethod || 'POST').toUpperCase(),
      path: normalizePath(input.path || '/'),
      body: parseJsonBody(rawBody),
      headers: lowercaseHeaders(input.headers || {}),
      query: input.queryStringParameters || {},
      raw: input,
    }
  }

  const action = String(input.action || '').replace(/^\/+/, '')
  return {
    method: 'POST',
    path: action ? `/${action}` : '/',
    body: input.body || input,
    headers: lowercaseHeaders(input.headers || {}),
    query: {},
    raw: input,
  }
}

function normalizePath(path) {
  let value = String(path || '/')
  if (!value.startsWith('/')) value = `/${value}`
  const gameKey = getGameKey()
  const gameKeyHyphen = gameKey.replace(/_/g, '-')
  const prefixes = [
    `/${gameKey}-api`,
    `/${gameKeyHyphen}-api`,
  ]
  for (const prefix of prefixes) {
    if (value === prefix || value.startsWith(prefix + '/')) {
      value = value.slice(prefix.length) || '/'
      break
    }
  }
  if (!value) value = '/'
  if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1)
  return value
}

function parseJsonBody(rawBody) {
  if (!rawBody) return {}
  if (typeof rawBody === 'object') return rawBody
  try { return JSON.parse(rawBody) } catch (_) { return {} }
}

function lowercaseHeaders(headers) {
  const out = {}
  Object.keys(headers || {}).forEach((key) => { out[key.toLowerCase()] = headers[key] })
  return out
}

function httpError(status, code, message, data) {
  const error = new Error(message || code)
  error.status = status
  error.code = code
  if (data !== undefined) error.data = data
  return error
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  respond,
  preflight,
  parseEvent,
  httpError,
}
