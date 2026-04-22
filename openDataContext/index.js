/**
 * 好友榜 openDataContext 入口
 * ----------------------------------------------------
 * 运行在独立 JS 上下文（WeChat Mini-Game 的 openDataContext 沙箱）中，
 * 只能访问受限 wx API：
 *   - wx.getSharedCanvas()       获取共享 canvas，主域通过 drawImage 引用
 *   - wx.onMessage(cb)           接收主域发来的渲染参数
 *   - wx.getUserCloudStorage()   自己的 KVDataList
 *   - wx.getFriendCloudStorage() 好友 KVDataList（含自己），仅授权后可用
 *
 * 主域消息协议（见 js/data/friendRanking.js）：
 *   { action: 'render',  tab, pixelRatio, width, height, scrollY, selfOpenId }
 *   { action: 'refresh', keep }   重新拉取并重绘（keep=true 表示用上次参数）
 *
 * 绘制产物作为共享纹理，主域通过：
 *   ctx.drawImage(wx.getOpenDataContext().canvas, dx, dy, dw, dh)
 * 显示到主场景画面上。
 */

/* eslint-disable */

var CANVAS = null
var CTX = null

try {
  CANVAS = wx.getSharedCanvas()
  CTX = CANVAS.getContext('2d')
} catch (e) {
  // 非小游戏环境（例如开发工具预览），无 sharedCanvas
}

// 四维度分数：与主域 friendRanking.SCORE_KEYS 保持一致
var TAB_META = {
  tower:   { key: 'towerFloor',  label: '通天塔', unit: '层',  color: '#FFD700' },
  stage:   { key: 'stageStars',  label: '秘境榜', unit: '★',  color: '#e88520' },
  dex:     { key: 'dexBoard', label: '图鉴榜', unit: '精通', color: '#4dcc4d' },
  combo:   { key: 'comboMax',    label: '连击榜', unit: '连击', color: '#ff6b6b' },
}

// 主域请求的渲染配置（来自 render / refresh 消息）
var state = {
  tab: 'tower',
  pixelRatio: 2,
  width: 0,
  height: 0,
  scrollY: 0,
  selfOpenId: '',
  listCache: {},          // tab -> { ts, list: [{openid, nickname, avatarUrl, value, selfFlag}] }
  loading: false,
  avatarImgs: {},          // avatarUrl -> Image
  pendingRender: null,    // 拉取结束后待重绘
}

var CACHE_TTL_MS = 60 * 1000   // 好友数据 60s 缓存，避免频繁拉接口
var FONT_FALLBACK = '"PingFang SC","Microsoft YaHei",sans-serif'

// ---------- 工具 ----------
function _safeNum(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n }

/** 图鉴好友榜：读 dexBoard（复合分）或旧 dexMastered；与全服榜排序一致 */
function _parseDexFriendRow(kvList) {
  var board = _parseWxgameData(kvList, 'dexBoard')
  var legacy = _parseWxgameData(kvList, 'dexMastered')
  var m = 0, c = 0, p = 0
  if (board >= 100000000) {
    var rest = board - 100000000
    m = Math.floor(rest / 1000000)
    c = Math.floor((rest % 1000000) / 1000)
    p = rest % 1000
  } else if (board > 0) {
    m = board
  }
  if (m <= 0 && c <= 0 && p <= 0 && legacy > 0) {
    m = legacy
  }
  if (m + c + p <= 0) return null
  var sort = m * 1000000 + c * 1000 + p
  return { m: m, c: c, p: p, sort: sort }
}

function _parseWxgameData(kvList, tabKey) {
  // kvList: [{ key, value }]，value 是 JSON 字符串 { wxgame: { score, update_time } }
  if (!kvList || !kvList.length) return 0
  var target = null
  for (var i = 0; i < kvList.length; i++) {
    if (kvList[i] && kvList[i].key === tabKey) { target = kvList[i]; break }
  }
  if (!target) return 0
  try {
    var obj = JSON.parse(target.value || '{}')
    if (obj && obj.wxgame && obj.wxgame.score != null) return _safeNum(obj.wxgame.score)
    if (obj && obj.score != null) return _safeNum(obj.score)
    return _safeNum(target.value)
  } catch (_) {
    return _safeNum(target.value)
  }
}

function _roundRect(c, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function _ensureAvatar(url) {
  if (!url) return null
  var cached = state.avatarImgs[url]
  if (cached) return cached
  try {
    var img = wx.createImage()
    img.onload = function () { state.avatarImgs[url] = img; _renderIfReady() }
    img.onerror = function () { state.avatarImgs[url] = null }
    img.src = url
    state.avatarImgs[url] = img
    return img
  } catch (_) {
    return null
  }
}

// ---------- 数据拉取 ----------
function _fetchFriendCloudStorage(tab, cb) {
  var meta = TAB_META[tab]
  if (!meta) { cb([]); return }
  if (typeof wx === 'undefined' || !wx.getFriendCloudStorage) { cb([]); return }
  state.loading = true
  try {
    var keyList = tab === 'dex' ? [meta.key, 'dexMastered'] : [meta.key]
    wx.getFriendCloudStorage({
      keyList: keyList,
      success: function (res) {
        state.loading = false
        var rows = (res && res.data) || []
        var list = []
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i]
          var value = 0
          var dexM, dexC, dexP
          if (tab === 'dex') {
            var dexRow = _parseDexFriendRow(r.KVDataList)
            if (!dexRow) continue
            value = dexRow.sort
            dexM = dexRow.m
            dexC = dexRow.c
            dexP = dexRow.p
          } else {
            value = _parseWxgameData(r.KVDataList, meta.key)
            if (value <= 0) continue
          }
          var row = {
            openid: r.openid || '',
            nickname: r.nickname || '修士',
            avatarUrl: r.avatarUrl || '',
            value: value,
          }
          if (tab === 'dex') {
            row.dexM = dexM
            row.dexC = dexC
            row.dexP = dexP
          }
          list.push(row)
        }
        // 高分在前；相同分保留微信返回的原顺序
        list.sort(function (a, b) { return b.value - a.value })
        state.listCache[tab] = { ts: Date.now(), list: list }
        cb(list)
      },
      fail: function (err) {
        state.loading = false
        // 失败场景分类（微信小游戏好友榜无"授权弹窗"，失败基本是以下三种）：
        //   a) 隐私协议未同意：errMsg 含 "privacy"
        //   b) 基础库 / 客户端不支持：errMsg 含 "not support"
        //   c) 其他（通常好友都没玩过本游戏）
        try { console.warn('[openData] getFriendCloudStorage fail', err && (err.errMsg || err)) } catch (_) {}
        var errMsg = (err && (err.errMsg || err.message)) || ''
        var kind = 'empty'
        if (/privacy/i.test(errMsg)) kind = 'privacy'
        else if (/not support|unsupport|fail/i.test(errMsg) && !/auth/i.test(errMsg)) kind = 'unsupported'
        state.listCache[tab] = { ts: Date.now(), list: [], err: { kind: kind, msg: errMsg } }
        cb([])
      }
    })
  } catch (_) {
    state.loading = false
    cb([])
  }
}

function _getListForTab(tab, forceRefresh, cb) {
  var cached = state.listCache[tab]
  if (!forceRefresh && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    cb(cached.list, cached.err)
    return
  }
  _fetchFriendCloudStorage(tab, function (list) {
    var entry = state.listCache[tab] || { ts: Date.now(), list: list }
    cb(entry.list, entry.err)
  })
}

// ---------- 渲染 ----------
function _clear() {
  if (!CTX || !CANVAS) return
  CTX.clearRect(0, 0, CANVAS.width, CANVAS.height)
}

function _renderIfReady() {
  if (state.pendingRender) _render(state.pendingRender)
}

function _drawHint(text, sub) {
  if (!CTX) return
  var w = CANVAS.width, h = CANVAS.height
  var S = state.pixelRatio || 2
  _clear()
  CTX.save()
  CTX.fillStyle = '#8B7060'
  CTX.textAlign = 'center'
  CTX.textBaseline = 'middle'
  CTX.font = 'bold ' + (14 * S) + 'px ' + FONT_FALLBACK
  CTX.fillText(text || '暂无好友数据', w / 2, h / 2 - 10 * S)
  if (sub) {
    CTX.fillStyle = '#b0a090'
    CTX.font = (11 * S) + 'px ' + FONT_FALLBACK
    CTX.fillText(sub, w / 2, h / 2 + 16 * S)
  }
  CTX.restore()
}

function _drawAvatar(x, y, size, url) {
  if (!CTX) return
  var cx = x + size / 2, cy = y + size / 2
  CTX.save()
  CTX.beginPath()
  CTX.arc(cx, cy, size / 2, 0, Math.PI * 2)
  CTX.clip()
  var img = _ensureAvatar(url)
  if (img && img.width > 0) {
    try { CTX.drawImage(img, x, y, size, size) } catch (_) {}
  } else {
    CTX.fillStyle = 'rgba(200,158,60,0.18)'
    CTX.fillRect(x, y, size, size)
  }
  CTX.restore()
}

function _drawList(list) {
  var S = state.pixelRatio || 2
  var w = CANVAS.width, h = CANVAS.height
  var padX = 12 * S
  var rowH = 64 * S
  // 主域不知道好友 list 长度（数据在沙箱内），传来的 scrollY 可能越界；这里按实际 list 长度 clamp，
  // 保证拖到底时最后一行完整露出，而不是继续滑出空白（"拖不满"观感的根源）
  var rawScrollY = state.scrollY || 0
  var totalH = list.length * rowH
  var minScrollY = Math.min(0, h - totalH)
  var scrollY = Math.max(minScrollY, Math.min(0, rawScrollY))
  var meta = TAB_META[state.tab] || TAB_META.tower

  _clear()
  // 背景
  var grad = CTX.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, 'rgba(252,246,228,0.96)')
  grad.addColorStop(1, 'rgba(244,234,208,0.96)')
  CTX.fillStyle = grad
  CTX.fillRect(0, 0, w, h)

  // 列表裁剪
  CTX.save()
  CTX.beginPath()
  CTX.rect(0, 0, w, h)
  CTX.clip()

  for (var i = 0; i < list.length; i++) {
    var item = list[i]
    var ry = i * rowH + scrollY
    if (ry + rowH < 0 || ry > h) continue
    var isSelf = state.selfOpenId && item.openid === state.selfOpenId
    var topRank = i < 3

    // 行背景：Top3 金银铜色调；自己高亮紫色
    if (isSelf) {
      CTX.fillStyle = 'rgba(170,120,200,0.18)'
    } else if (topRank) {
      var rowGradColors = [
        ['rgba(255,215,0,0.18)', 'rgba(255,215,0,0.06)'],
        ['rgba(190,190,200,0.14)', 'rgba(190,190,200,0.04)'],
        ['rgba(180,110,40,0.14)', 'rgba(180,110,40,0.04)'],
      ]
      var rg = CTX.createLinearGradient(padX, ry, w - padX, ry)
      rg.addColorStop(0, rowGradColors[i][0])
      rg.addColorStop(1, rowGradColors[i][1])
      CTX.fillStyle = rg
    } else {
      CTX.fillStyle = i % 2 === 0 ? 'rgba(200,158,60,0.04)' : 'rgba(0,0,0,0.02)'
    }
    CTX.fillRect(padX + 2 * S, ry + 1 * S, w - padX * 2 - 4 * S, rowH - 3 * S)

    // 名次
    CTX.textAlign = 'center'
    CTX.textBaseline = 'middle'
    if (topRank) {
      var medalColors = ['#ffd700', '#c0c0c0', '#cd7f32']
      var medalBg = ['rgba(255,215,0,0.2)', 'rgba(192,192,192,0.15)', 'rgba(205,127,50,0.15)']
      var mx = padX + 18 * S, my = ry + rowH * 0.5, mr = 13 * S
      CTX.fillStyle = medalBg[i]
      CTX.beginPath(); CTX.arc(mx, my, mr, 0, Math.PI * 2); CTX.fill()
      CTX.strokeStyle = medalColors[i] + '66'
      CTX.lineWidth = 1 * S
      CTX.beginPath(); CTX.arc(mx, my, mr, 0, Math.PI * 2); CTX.stroke()
      CTX.fillStyle = medalColors[i]
      CTX.font = 'bold ' + (14 * S) + 'px ' + FONT_FALLBACK
      CTX.fillText(String(i + 1), mx, my)
    } else {
      CTX.fillStyle = '#8B7060'
      CTX.font = 'bold ' + (13 * S) + 'px ' + FONT_FALLBACK
      CTX.fillText(String(i + 1), padX + 18 * S, ry + rowH * 0.5)
    }

    // 头像
    var avatarX = padX + 40 * S
    var avatarSz = 34 * S
    var avatarY = ry + (rowH - avatarSz) / 2
    _drawAvatar(avatarX, avatarY, avatarSz, item.avatarUrl)
    if (topRank) {
      var bc = ['#ffd700', '#c0c0c0', '#cd7f32']
      CTX.strokeStyle = bc[i] + '88'
      CTX.lineWidth = 1.5 * S
      CTX.beginPath(); CTX.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2 + 1 * S, 0, Math.PI * 2)
      CTX.stroke()
    }

    // 昵称
    var textX = avatarX + avatarSz + 8 * S
    CTX.textAlign = 'left'
    CTX.textBaseline = 'alphabetic'
    CTX.fillStyle = isSelf ? '#6B2BA0' : (topRank ? '#7A4800' : '#3a1a00')
    CTX.font = 'bold ' + (13 * S) + 'px ' + FONT_FALLBACK
    var nick = (item.nickname || '修士').substring(0, 8)
    if (isSelf) nick = nick + ' · 我'
    CTX.fillText(nick, textX, ry + 26 * S)

    // 副标签
    CTX.fillStyle = '#8B7060'
    CTX.font = (9 * S) + 'px ' + FONT_FALLBACK
    if (state.tab === 'dex' && item.dexM != null) {
      CTX.fillText('收录 ' + item.dexC + ' · 发现 ' + item.dexP, textX, ry + 44 * S)
    } else {
      CTX.fillText('微信好友', textX, ry + 44 * S)
    }

    // 分数
    var valRight = w - padX - 12 * S
    CTX.textAlign = 'right'
    CTX.font = 'bold ' + (20 * S) + 'px ' + FONT_FALLBACK
    CTX.fillStyle = topRank ? '#ffd700' : meta.color
    CTX.save()
    if (topRank) { CTX.shadowColor = 'rgba(255,215,0,0.25)'; CTX.shadowBlur = 4 * S }
    var valX = valRight - (meta.unit ? 18 * S : 0)
    var mainNum = (state.tab === 'dex' && item.dexM != null) ? item.dexM : (item.value || 0)
    CTX.fillText(String(mainNum), valX, ry + 28 * S)
    CTX.restore()
    CTX.fillStyle = '#8B7060'
    CTX.font = (9 * S) + 'px ' + FONT_FALLBACK
    if (meta.unit) CTX.fillText(meta.unit, valRight, ry + 28 * S)
  }

  CTX.restore()
}

function _render(msg) {
  state.pendingRender = msg
  if (!CTX || !CANVAS) return

  state.tab = msg.tab || state.tab
  state.pixelRatio = msg.pixelRatio || state.pixelRatio
  state.scrollY = msg.scrollY != null ? msg.scrollY : state.scrollY
  state.selfOpenId = msg.selfOpenId || state.selfOpenId
  // 注意：sharedCanvas 的 width/height 在新基础库里对 openDataContext 是只读的
  //   直接赋值会每帧抛 "Cannot assign to read only canvas" 警告 → 日志刷屏
  //   sharedCanvas 尺寸由主域负责（见 friendRanking.ensureSharedCanvasSize），这里只读
  state.width = CANVAS.width
  state.height = CANVAS.height

  _getListForTab(state.tab, !!msg.force, function (list, err) {
    // 微信小游戏好友榜没有"好友授权"弹窗，wx.getFriendCloudStorage 静默返回：
    //   · privacy     → 小游戏后台隐私协议未配置好，玩家也无从自己解
    //   · unsupported → 客户端 / 基础库不支持
    //   · empty       → 调用成功但列表空（大概率：好友都没玩过本游戏）
    if (err && err.kind === 'privacy') {
      _drawHint('好友榜暂不可用', '游戏隐私协议未配置完整')
      return
    }
    if (err && err.kind === 'unsupported') {
      _drawHint('好友榜暂不可用', '请升级微信到最新版本重试')
      return
    }
    if (!list || !list.length) {
      _drawHint('暂无好友上榜', '邀请微信好友一起来玩即可上榜')
      return
    }
    _drawList(list)
  })
}

// ---------- 消息入口 ----------
if (typeof wx !== 'undefined' && wx.onMessage) {
  wx.onMessage(function (data) {
    if (!data || !data.action) return
    if (data.action === 'render' || data.action === 'refresh') {
      _render(data)
    } else if (data.action === 'invalidate') {
      // 主域刚更新了分数，清缓存让下次 render 重新拉
      state.listCache = {}
    }
  })
}
