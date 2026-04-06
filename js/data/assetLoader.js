/**
 * CDN 资源加载器 — 灵宠消消塔
 * 本地优先 + 微信云存储 CDN 按需下载 + 本地缓存
 *
 * 核心原则：无模式开关，靠"本地文件是否存在"自动判定
 * - 开发时资源在本地 → 直接用本地路径
 * - 线上包已排除 CDN 资源 → 自动走云端下载 + 本地缓存
 */

const P = require('../platform')
const cdnCfg = require('./cdnConfig')

const CLOUD_ENV = cdnCfg.cloudEnv
const CLOUD_BUCKET = cdnCfg.cloudBucket
const CDN_FILE_PREFIX = cdnCfg.filePrefix
const BUNDLED_PREFIXES = cdnCfg.bundledDirs.map(d => d.endsWith('/') ? d : d + '/')
const CDN_DIRS = cdnCfg.cdnDirs.map(d => d.endsWith('/') ? d : d + '/')

const _fs = typeof wx !== 'undefined' && wx.getFileSystemManager
  ? wx.getFileSystemManager()
  : null

const _userDataPath = typeof wx !== 'undefined' && wx.env
  ? wx.env.USER_DATA_PATH
  : ''

const CACHE_ROOT = _userDataPath + '/cdn_cache'

let _manifest = null
let _manifestReady = false
let _localFileExistsCache = {}
let _downloadQueue = {}
let _cacheAccessLog = {}
let _cacheAccessFrame = 0

function _isCdnPath(path) {
  for (let i = 0; i < CDN_DIRS.length; i++) {
    if (path.startsWith(CDN_DIRS[i])) return true
  }
  return false
}

function _isBundledPath(path) {
  for (let i = 0; i < BUNDLED_PREFIXES.length; i++) {
    if (path.startsWith(BUNDLED_PREFIXES[i])) return true
  }
  return false
}

function _getCachePath(logicalPath) {
  return CACHE_ROOT + '/' + logicalPath
}

function _getCloudFileID(logicalPath) {
  return 'cloud://' + CLOUD_ENV + '.' + CLOUD_BUCKET + '/' + CDN_FILE_PREFIX + '/' + logicalPath
}

function _ensureCacheDir(filePath) {
  if (!_fs) return
  const parts = filePath.split('/')
  let dir = parts.slice(0, -1).join('/')
  try { _fs.accessSync(dir) } catch (_) {
    const segments = dir.replace(_userDataPath + '/', '').split('/')
    let cur = _userDataPath
    for (const seg of segments) {
      cur += '/' + seg
      try { _fs.accessSync(cur) } catch (__) {
        try { _fs.mkdirSync(cur, true) } catch (___) { /* ignore */ }
      }
    }
  }
}

function _localFileExists(path) {
  if (_localFileExistsCache[path] !== undefined) return _localFileExistsCache[path]
  if (!_fs) {
    _localFileExistsCache[path] = true
    return true
  }
  try {
    _fs.accessSync(path)
    _localFileExistsCache[path] = true
    return true
  } catch (_) {
    _localFileExistsCache[path] = false
    return false
  }
}

function _cacheFileExists(logicalPath) {
  return _localFileExists(_getCachePath(logicalPath))
}

function _getCachedHash(logicalPath) {
  try {
    const metaPath = _getCachePath(logicalPath) + '.meta'
    const meta = _fs.readFileSync(metaPath, 'utf-8')
    return meta.trim()
  } catch (_) {
    return null
  }
}

function _isCacheValid(logicalPath) {
  if (!_cacheFileExists(logicalPath)) return false
  if (!_manifest || !_manifest.files) return true
  const entry = _manifest.files[logicalPath]
  if (!entry || !entry.hash) return true
  return _getCachedHash(logicalPath) === entry.hash
}

/**
 * 解析资源路径：
 * - bundled 目录 → 直接返回原路径
 * - CDN 目录 → 跳过本地检查（避免模拟器警告），直接查 CDN 缓存
 * - 其他路径 → 返回原路径
 */
function resolveAsset(path) {
  if (_isBundledPath(path)) return path
  if (!_isCdnPath(path)) return path

  _cacheAccessFrame++
  _cacheAccessLog[path] = _cacheAccessFrame

  if (_isCacheValid(path)) {
    return _getCachePath(path)
  }
  return null
}

/**
 * 下载 CDN 资源并缓存，完成后调用回调
 */
function downloadAndNotify(logicalPath, onComplete) {
  if (_downloadQueue[logicalPath]) {
    if (onComplete) _downloadQueue[logicalPath].push(onComplete)
    return
  }
  _downloadQueue[logicalPath] = onComplete ? [onComplete] : []

  const fileID = _getCloudFileID(logicalPath)
  const cachePath = _getCachePath(logicalPath)
  _ensureCacheDir(cachePath)

  let retries = 0
  const maxRetries = 2

  function doDownload() {
    if (!P.cloud || typeof P.cloud.downloadFile !== 'function') {
      _finishDownload(logicalPath, false)
      return
    }
    P.cloud.downloadFile({
      fileID: fileID,
      success: function(res) {
        if (res.tempFilePath) {
          try {
            _fs.copyFileSync(res.tempFilePath, cachePath)
            _localFileExistsCache[cachePath] = true
            if (_manifest && _manifest.files && _manifest.files[logicalPath]) {
              const hash = _manifest.files[logicalPath].hash || ''
              try { _fs.writeFileSync(cachePath + '.meta', hash, 'utf-8') } catch (_) {}
            }
            _finishDownload(logicalPath, true)
          } catch (_) {
            _retryOrFail(logicalPath)
          }
        } else {
          _retryOrFail(logicalPath)
        }
      },
      fail: function() { _retryOrFail(logicalPath) },
    })
  }

  function _retryOrFail(lp) {
    retries++
    if (retries <= maxRetries) {
      setTimeout(doDownload, 500 * retries)
    } else {
      _finishDownload(lp, false)
    }
  }

  doDownload()
}

function _finishDownload(logicalPath, success) {
  const callbacks = _downloadQueue[logicalPath] || []
  delete _downloadQueue[logicalPath]
  if (success) {
    _localFileExistsCache[_getCachePath(logicalPath)] = true
  }
  for (const cb of callbacks) {
    try { cb(success) } catch (_) {}
  }
}

/**
 * 批量预下载某类资源
 */
function preloadCategory(category, onProgress) {
  if (!_manifest || !_manifest.files) {
    if (onProgress) onProgress(0, 0)
    return Promise.resolve()
  }
  const prefix = category.endsWith('/') ? category : category + '/'
  const files = Object.keys(_manifest.files).filter(function(f) { return f.startsWith(prefix) })
  const toDownload = files.filter(function(f) { return !_isCacheValid(f) })

  if (toDownload.length === 0) {
    if (onProgress) onProgress(files.length, files.length)
    return Promise.resolve()
  }

  let done = 0
  const total = toDownload.length
  return new Promise(function(resolve) {
    let settled = false
    const timeout = setTimeout(function() {
      if (!settled) { settled = true; resolve() }
    }, 30000)

    for (const f of toDownload) {
      downloadAndNotify(f, function() {
        done++
        if (onProgress) onProgress(files.length - total + done, files.length)
        if (done >= total && !settled) {
          settled = true
          clearTimeout(timeout)
          resolve()
        }
      })
    }
  })
}

function isReady(logicalPath) {
  if (_isBundledPath(logicalPath)) return true
  if (_isCdnPath(logicalPath)) return _isCacheValid(logicalPath)
  return true
}

/**
 * 按路径列表静默预下载（跳过已缓存的）
 */
function preloadPaths(paths, onProgress) {
  const cdnPaths = paths.filter(function(p) { return _isCdnPath(p) && !_isCacheValid(p) })
  if (cdnPaths.length === 0) {
    if (onProgress) onProgress(paths.length, paths.length)
    return Promise.resolve()
  }
  let done = 0
  const total = cdnPaths.length
  return new Promise(function(resolve) {
    let settled = false
    const timeout = setTimeout(function() {
      if (!settled) { settled = true; resolve() }
    }, 30000)
    for (const f of cdnPaths) {
      downloadAndNotify(f, function() {
        done++
        if (onProgress) onProgress(paths.length - total + done, paths.length)
        if (done >= total && !settled) {
          settled = true
          clearTimeout(timeout)
          resolve()
        }
      })
    }
  })
}

/**
 * 拉取远程 manifest.json
 */
function fetchManifest(onDone) {
  const fileID = _getCloudFileID('manifest.json')
  if (!P.cloud || typeof P.cloud.downloadFile !== 'function') {
    _loadCachedManifest()
    if (onDone) onDone(false)
    return
  }
  P.cloud.downloadFile({
    fileID: fileID,
    success: function(res) {
      if (res.tempFilePath) {
        try {
          const text = _fs.readFileSync(res.tempFilePath, 'utf-8')
          _manifest = JSON.parse(text)
          _manifestReady = true
          _ensureCacheDir(CACHE_ROOT + '/manifest.json')
          try { _fs.writeFileSync(CACHE_ROOT + '/manifest.json', text, 'utf-8') } catch (_) {}
          if (onDone) onDone(true)
        } catch (_) {
          _loadCachedManifest()
          if (onDone) onDone(false)
        }
      } else {
        _loadCachedManifest()
        if (onDone) onDone(false)
      }
    },
    fail: function() {
      _loadCachedManifest()
      if (onDone) onDone(false)
    },
  })
}

function _loadCachedManifest() {
  try {
    const text = _fs.readFileSync(CACHE_ROOT + '/manifest.json', 'utf-8')
    _manifest = JSON.parse(text)
    _manifestReady = true
  } catch (_) {
    _manifest = { files: {} }
    _manifestReady = true
  }
}

/**
 * 清理过期缓存（LRU 淘汰最久未访问的 20%）
 */
function clearCache() {
  if (!_fs) return
  const entries = Object.keys(_cacheAccessLog).map(function(k) { return [k, _cacheAccessLog[k]] })
  if (entries.length === 0) return
  entries.sort(function(a, b) { return a[1] - b[1] })
  const evictCount = Math.ceil(entries.length * 0.2)
  for (let i = 0; i < evictCount; i++) {
    const path = entries[i][0]
    const cp = _getCachePath(path)
    try { _fs.unlinkSync(cp) } catch (_) {}
    try { _fs.unlinkSync(cp + '.meta') } catch (_) {}
    delete _localFileExistsCache[cp]
    delete _cacheAccessLog[path]
  }
}

function isManifestReady() { return _manifestReady }
function getManifest() { return _manifest }

module.exports = {
  resolveAsset,
  downloadAndNotify,
  preloadCategory,
  preloadPaths,
  isReady,
  fetchManifest,
  clearCache,
  isManifestReady,
  getManifest,
  BUNDLED_PREFIXES,
  CDN_DIRS,
}
