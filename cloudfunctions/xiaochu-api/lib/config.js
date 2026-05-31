const DEFAULT_GAME_KEY = 'xiaochu'
const DEFAULT_TTL_SEC = 7 * 24 * 3600
const DEFAULT_MAX_BYTES = 1024 * 1024

function getGameKey() {
  const value = String(process.env.GAME_KEY || '').trim().toLowerCase()
  if (!value) return DEFAULT_GAME_KEY
  if (!/^[a-z][a-z0-9_\-]{0,31}$/.test(value)) {
    throw new Error(`非法 GAME_KEY: ${value}`)
  }
  return value
}

function gameKeyUpper() {
  return getGameKey().toUpperCase().replace(/[^A-Z0-9]/g, '_')
}

function readEnvPrefer(...keys) {
  for (const key of keys) {
    const value = process.env[key]
    if (value !== undefined && value !== null && String(value).length > 0) {
      return String(value)
    }
  }
  return ''
}

function getCollectionName(suffix) {
  const normalizedSuffix = String(suffix || '').replace(/^_+/, '')
  const overrideKey = `${gameKeyUpper()}_${normalizedSuffix.toUpperCase()}_COLLECTION`
  const override = process.env[overrideKey]
  if (override) return String(override)
  return `${getGameKey()}_${normalizedSuffix}`
}

function getJwtSecret() {
  return readEnvPrefer(`${gameKeyUpper()}_JWT_SECRET`)
}

function getTtlSec() {
  const value = Number(readEnvPrefer(`${gameKeyUpper()}_TOKEN_TTL_SEC`))
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_TTL_SEC
}

function getMaxBytes() {
  const value = Number(readEnvPrefer(`${gameKeyUpper()}_SAVE_MAX_BYTES`))
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_MAX_BYTES
}

function getPlatformCredential(platform, field) {
  const upper = gameKeyUpper()
  const platformUpper = String(platform || '').toUpperCase()
  const aliases = platformUpper === 'WX'
    ? ['WX', 'WECHAT']
    : platformUpper === 'TT' || platformUpper === 'DY'
      ? ['TT', 'DY', 'DOUYIN']
      : [platformUpper]
  const keys = []
  aliases.forEach((alias) => {
    keys.push(`${upper}_${alias}_${field}`)
    keys.push(`${alias}_${field}`)
  })
  return readEnvPrefer(...keys)
}

function getCdnPublicBaseUrl() {
  return readEnvPrefer(`${gameKeyUpper()}_CDN_PUBLIC_BASE_URL`)
}

function getCdnFilePrefix() {
  return readEnvPrefer(`${gameKeyUpper()}_CDN_FILE_PREFIX`) || `${getGameKey()}/assets_cdn`
}

module.exports = {
  getGameKey,
  gameKeyUpper,
  getCollectionName,
  getJwtSecret,
  getTtlSec,
  getMaxBytes,
  getPlatformCredential,
  getCdnPublicBaseUrl,
  getCdnFilePrefix,
}
