/**
 * 玩家数据管理工具 — 后端服务
 * 通过微信 HTTP API 读写云数据库 playerData 集合
 *
 * 用法: node server.js
 * 访问: http://localhost:3200
 */
'use strict'
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { loadWxSecret } = require(path.join(__dirname, '..', '..', 'scripts', 'loadWxSecret'))

const APPID = 'wx53b03390106eff65'
const ENV_ID = 'cloud1-6g8y0x2i39e768eb'
const PORT = 3200

// ===== 宠物 & 关卡元数据（从游戏源码抽取，避免 require 游戏模块带来的平台依赖） =====
function loadGameMeta() {
  // 宠物列表：直接从 pets.js 解析核心数据
  const ALL_PETS = []
  const ATTRS = ['metal', 'wood', 'water', 'fire', 'earth']
  const ATTR_CN = { metal: '金', wood: '木', water: '水', fire: '火', earth: '土' }
  const PET_RARITY_SSR = ['m10','m18','m19','m20','w10','w20','s10','s17','f4','f10','f16','f17','e10','e18','e20']
  const PET_RARITY_SR = ['m4','m5','m6','m9','m11','m13','m14','m15','m16','m17','w5','w6','w7','w12','w14','w15','w16','w17','w18','w19','s4','s6','s8','s11','s12','s14','s15','s16','s18','s19','s20','f3','f5','f6','f7','f8','f11','f12','f13','f14','f15','f18','f19','f20','e4','e5','e8','e9','e11','e12','e13','e14','e15','e16','e17','e19']

  // 简化版宠物数据（id, name, attr, atk, rarity）
  const petNames = {
    m1:'金锋灵猫',m2:'锐金鼠将',m3:'玄甲金狮',m4:'天罡金鹏',m5:'碎金战将',m6:'金光剑灵',m7:'金罡守卫',m8:'鸣金神雀',m9:'破甲金将',m10:'九天金凰',m11:'锐金斥候',m12:'金纹战将',m13:'金影刺客',m14:'金甲神卫',m15:'金虹使者',m16:'金罡战魂',m17:'金翎神使',m18:'金锋战神',m19:'金耀星君',m20:'万钧金神',
    w1:'青灵木鹿',w2:'藤萝灵蛇',w3:'苍木灵熊',w4:'万木灵狐',w5:'灵木仙子',w6:'青木战灵',w7:'缠枝藤君',w8:'枯木老妖',w9:'木灵使者',w10:'万木之主',w11:'青藤守卫',w12:'翠竹灵蟋',w13:'灵芝仙菇',w14:'苍蟒木蛟',w15:'木灵仙鹿',w16:'千年古藤',w17:'碧玉螳螂',w18:'青鸾翠雀',w19:'万木神龟',w20:'神木麒麟',
    s1:'沧澜水雀',s2:'冰魄灵龟',s3:'海灵蛟童',s4:'玄水蛟龙',s5:'碧波灵蛙',s6:'流水灵鱼',s7:'寒冰灵蟹',s8:'海魂巨鲸',s9:'凝水灵蚌',s10:'沧海龙神',s11:'冰玄灵蛾',s12:'沧澜海蛇',s13:'玄水灵蟾',s14:'冰魄灵鹤',s15:'海灵水母',s16:'水镜灵蝶',s17:'沧澜鲲鹏',s18:'玄水神蛟',s19:'水纹灵獭',s20:'冰凰神鸟',
    f1:'赤焰火狐',f2:'焚天火狼',f3:'烈阳火凰',f4:'炎狱火麟',f5:'爆炎火蟾',f6:'火莲灵花',f7:'焚天火鸦',f8:'赤炎火蝎',f9:'火灵赤蛇',f10:'朱雀神火',f11:'焚天火猿',f12:'炎狱火蜥',f13:'烈阳火鹰',f14:'火凰灵蝶',f15:'炎爆火鼠',f16:'焚天火蟒',f17:'赤焰麒麟',f18:'火元灵龟',f19:'炎狱火龙',f20:'火灵神猫',
    e1:'厚土石灵',e2:'山岳石怪',e3:'镇地石犀',e4:'玄武圣兽',e5:'裂地穿山甲',e6:'山岩石蟹',e7:'镇山石狮',e8:'大地灵鼹',e9:'玄土石蟒',e10:'后土神兽',e11:'厚土灵虫',e12:'山岳灵兔',e13:'镇地石龙',e14:'玄土灵蛤',e15:'裂地灵蚁',e16:'山岩石象',e17:'后土灵蚕',e18:'镇地神牛',e19:'厚土灵龟',e20:'玄武神君',
  }
  const ATTR_PREFIX = { metal: 'm', wood: 'w', water: 's', fire: 'f', earth: 'e' }
  for (const attr of ATTRS) {
    const prefix = ATTR_PREFIX[attr]
    for (let i = 1; i <= 20; i++) {
      const id = prefix + i
      const rarity = PET_RARITY_SSR.includes(id) ? 'SSR' : PET_RARITY_SR.includes(id) ? 'SR' : 'R'
      ALL_PETS.push({ id, name: petNames[id] || id, attr, attrCn: ATTR_CN[attr], rarity })
    }
  }

  // 章节
  const CHAPTERS = []
  const chNames = ['灵山试炼','幽冥秘境','天劫雷域','仙灵古域','万妖禁地','苍穹裂谷','精英试炼','九幽深渊','太古战场','天罡圣域','混沌秘界','终焉之地']
  for (let i = 0; i < 12; i++) CHAPTERS.push({ id: i + 1, name: chNames[i] })

  // 法宝
  const ALL_WEAPONS = [
    {id:'w1',name:'天机镜',rarity:'R'},{id:'w2',name:'破军钟',rarity:'R'},{id:'w3',name:'碧落仙葫',rarity:'R'},{id:'w4',name:'沧海玄珠',rarity:'R'},{id:'w5',name:'赤霄神灯',rarity:'R'},{id:'w6',name:'昆仑玉璧',rarity:'R'},{id:'w7',name:'八卦金盘',rarity:'R'},{id:'w8',name:'流云仙扇',rarity:'R'},{id:'w9',name:'燎原宝塔',rarity:'R'},
    {id:'w10',name:'火凤令牌',rarity:'SR'},{id:'w11',name:'紫金葫芦',rarity:'SR'},{id:'w12',name:'焚心宝印',rarity:'SR'},
    {id:'w13',name:'玄铁如意',rarity:'R'},{id:'w14',name:'藤甲天衣',rarity:'R'},{id:'w15',name:'寒冰宝鉴',rarity:'R'},{id:'w16',name:'厚土宝甲',rarity:'R'},{id:'w17',name:'烈焰神甲',rarity:'R'},
    {id:'w18',name:'万寿青莲',rarity:'R'},{id:'w19',name:'九转金丹',rarity:'R'},{id:'w20',name:'缠枝灵索',rarity:'R'},
    {id:'w21',name:'凤血丹炉',rarity:'SR'},{id:'w22',name:'长生玉牌',rarity:'SR'},{id:'w23',name:'玲珑玉净瓶',rarity:'SR'},
    {id:'w24',name:'建木神符',rarity:'SR'},{id:'w25',name:'磐石仙鼎',rarity:'SR'},{id:'w26',name:'水月宝镜',rarity:'SR'},{id:'w27',name:'开山神斧',rarity:'SR'},{id:'w28',name:'山河社稷图',rarity:'SR'},{id:'w29',name:'不灭金身',rarity:'SR'},
    {id:'w30',name:'聚灵金铃',rarity:'SR'},{id:'w31',name:'扶桑神木',rarity:'SR'},{id:'w32',name:'潮汐法螺',rarity:'SR'},{id:'w33',name:'三昧真火扇',rarity:'SR'},{id:'w34',name:'息壤神珠',rarity:'SR'},
    {id:'w35',name:'金翼飞轮',rarity:'SR'},{id:'w36',name:'定水神针',rarity:'SR'},{id:'w37',name:'踏火风火轮',rarity:'SR'},
    {id:'w38',name:'炎龙法珠',rarity:'SSR'},{id:'w39',name:'蛊雕毒珠',rarity:'SSR'},{id:'w40',name:'玄龟宝印',rarity:'SSR'},{id:'w41',name:'玄武宝令',rarity:'SSR'},{id:'w42',name:'碧波神灯',rarity:'SSR'},{id:'w43',name:'浴火金莲',rarity:'SSR'},
    {id:'w44',name:'鲛人泪珠',rarity:'SSR'},{id:'w45',name:'灵木仙屏',rarity:'SSR'},{id:'w46',name:'镇妖宝塔',rarity:'SSR'},{id:'w47',name:'混元宝伞',rarity:'SSR'},
    {id:'w48',name:'镇岳金印',rarity:'SSR'},{id:'w49',name:'九鼎神印',rarity:'SSR'},{id:'w50',name:'玄冰琉璃',rarity:'SSR'},
  ]

  return { ALL_PETS, CHAPTERS, ATTR_CN, ALL_WEAPONS }
}

const GAME_META = loadGameMeta()

// ===== 微信 HTTP API =====
let _cachedToken = null
let _tokenExpire = 0

function httpsReq(url, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const u = new URL(url)
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search,
      method: data ? 'POST' : 'GET',
      headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
    }
    const req = https.request(opts, res => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => { try { resolve(JSON.parse(buf)) } catch { resolve(buf) } })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function getToken() {
  if (_cachedToken && Date.now() < _tokenExpire) return _cachedToken
  const secret = loadWxSecret()
  if (!secret) throw new Error('未配置 WX_SECRET')
  const res = await httpsReq(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${secret}`)
  if (res.errcode) {
    _cachedToken = null; _tokenExpire = 0
    throw new Error(`token 失败: ${res.errcode} ${res.errmsg}`)
  }
  _cachedToken = res.access_token
  _tokenExpire = Date.now() + (res.expires_in - 120) * 1000  // 提前2分钟过期
  console.log(`[Token] 已刷新，有效期 ${Math.round(res.expires_in / 60)} 分钟`)
  return _cachedToken
}

/** 带 token 过期自动重试的请求封装 */
async function dbQuerySafe(query) {
  try { return await dbQuery(query) }
  catch (e) {
    if (e.message && e.message.includes('40001')) {
      console.log('[Token] 40001 过期，重新获取...')
      _cachedToken = null; _tokenExpire = 0
      return await dbQuery(query)
    }
    throw e
  }
}
async function dbUpdateSafe(query) {
  try { return await dbUpdate(query) }
  catch (e) {
    if (e.message && e.message.includes('40001')) {
      _cachedToken = null; _tokenExpire = 0
      return await dbUpdate(query)
    }
    throw e
  }
}

async function dbQuery(query) {
  const token = await getToken()
  const res = await httpsReq(`https://api.weixin.qq.com/tcb/databasequery?access_token=${token}`, { env: ENV_ID, query })
  if (res.errcode && res.errcode !== 0) throw new Error(`查询失败: ${res.errcode} ${res.errmsg}`)
  return (res.data || []).map(item => JSON.parse(item))
}

async function dbUpdate(query) {
  const token = await getToken()
  const res = await httpsReq(`https://api.weixin.qq.com/tcb/databaseupdate?access_token=${token}`, { env: ENV_ID, query })
  if (res.errcode && res.errcode !== 0) throw new Error(`更新失败: ${res.errcode} ${res.errmsg}`)
  return res
}

async function dbAdd(query) {
  const token = await getToken()
  const res = await httpsReq(`https://api.weixin.qq.com/tcb/databaseadd?access_token=${token}`, { env: ENV_ID, query })
  if (res.errcode && res.errcode !== 0) throw new Error(`添加失败: ${res.errcode} ${res.errmsg}`)
  return res
}

// ===== HTTP Server =====
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.on('data', c => buf += c)
    req.on('end', () => { try { resolve(JSON.parse(buf)) } catch { resolve({}) } })
    req.on('error', reject)
  })
}

function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(data))
}

const server = http.createServer(async (req, res) => {
  // CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
    res.end()
    return
  }

  try {
    const url = new URL(req.url, `http://localhost:${PORT}`)

    // --- API: 获取游戏元数据 ---
    if (url.pathname === '/api/meta') {
      return json(res, { ok: true, data: GAME_META })
    }

    // --- API: 按 openid 查询玩家 ---
    if (url.pathname === '/api/player' && req.method === 'GET') {
      const openid = url.searchParams.get('openid')
      if (!openid) return json(res, { ok: false, error: '缺少 openid' }, 400)
      const rows = await dbQuerySafe(`db.collection("playerData").where({_openid:"${openid}"}).limit(1).get()`)
      if (!rows.length) return json(res, { ok: false, error: '未找到该玩家' }, 404)
      return json(res, { ok: true, data: rows[0] })
    }

    // --- API: 更新玩家数据（局部） ---
    if (url.pathname === '/api/player' && req.method === 'POST') {
      const body = await parseBody(req)
      const { openid, patch } = body
      if (!openid || !patch) return json(res, { ok: false, error: '参数不全' }, 400)

      // 先查出 _id（where 查询可读，但 update 必须用 doc._id）
      const rows = await dbQuerySafe(`db.collection("playerData").where({_openid:"${openid}"}).limit(1).get()`)
      if (!rows.length) return json(res, { ok: false, error: '未找到该玩家' }, 404)
      const docId = rows[0]._id

      // 强制写入 _updateTime 确保云同步时云端数据优先
      patch._updateTime = Date.now()
      const setParts = []
      for (const [k, v] of Object.entries(patch)) {
        setParts.push(`${k}: ${JSON.stringify(v)}`)
      }
      const query = `db.collection("playerData").doc("${docId}").update({data:{${setParts.join(',')}}})`
      console.log(`[UPDATE] openid=${openid}, docId=${docId}, fields=${Object.keys(patch).join(',')}, query_len=${query.length}`)
      const result = await dbUpdateSafe(query)
      console.log(`[UPDATE] result: matched=${result.matched}, modified=${result.modified}`)
      return json(res, { ok: true, matched: result.matched, modified: result.modified })
    }

    // --- API: 全量覆盖玩家数据（先查_id，再用 set 覆盖） ---
    if (url.pathname === '/api/player/replace' && req.method === 'POST') {
      const body = await parseBody(req)
      const { openid, data } = body
      if (!openid || !data) return json(res, { ok: false, error: '参数不全' }, 400)

      // 先查出 _id
      const rows = await dbQuerySafe(`db.collection("playerData").where({_openid:"${openid}"}).limit(1).get()`)
      if (!rows.length) return json(res, { ok: false, error: '未找到该玩家' }, 404)
      const docId = rows[0]._id

      // 清理系统字段（不能写入，但 update 不会删除未提及的字段）
      delete data._id
      delete data._openid

      // 强制写入 _updateTime 确保云同步时云端数据优先
      data._updateTime = Date.now()

      // 用 doc.update 逐字段覆盖（不是 set，避免丢失 _openid 等系统字段）
      const token = await getToken()
      const setParts = []
      for (const [k, v] of Object.entries(data)) {
        setParts.push(`${k}: ${JSON.stringify(v)}`)
      }
      const updateQuery = `db.collection("playerData").doc("${docId}").update({data:{${setParts.join(',')}}})`
      console.log(`[REPLACE] openid=${openid}, docId=${docId}, fields=${Object.keys(data).length}, query_len=${updateQuery.length}`)
      const setRes = await httpsReq(`https://api.weixin.qq.com/tcb/databaseupdate?access_token=${token}`, { env: ENV_ID, query: updateQuery })
      console.log(`[REPLACE] result:`, JSON.stringify(setRes).slice(0, 200))
      if (setRes.errcode && setRes.errcode !== 0) {
        return json(res, { ok: false, error: `覆盖失败: ${setRes.errcode} ${setRes.errmsg}` }, 500)
      }
      return json(res, { ok: true, matched: setRes.matched, modified: setRes.modified })
    }

    // --- API: 创建新玩家记录（用于恢复） ---
    if (url.pathname === '/api/player/create' && req.method === 'POST') {
      const body = await parseBody(req)
      const { openid, data } = body
      if (!openid || !data) return json(res, { ok: false, error: '参数不全' }, 400)
      data._openid = openid
      const query = `db.collection("playerData").add({data:${JSON.stringify(data)}})`
      const result = await dbAdd(query)
      return json(res, { ok: true, id_list: result.id_list })
    }

    // --- 静态文件 ---
    if (url.pathname === '/' || url.pathname === '/index.html') {
      const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }

    json(res, { error: 'Not Found' }, 404)
  } catch (e) {
    console.error('Error:', e)
    json(res, { ok: false, error: e.message || String(e) }, 500)
  }
})

server.listen(PORT, () => {
  const secret = loadWxSecret()
  console.log(`\n🎮 灵宠消消塔 — 玩家数据管理工具`)
  console.log(`   地址: http://localhost:${PORT}`)
  console.log(`   WX_SECRET: ${secret ? '✓ 已配置' : '✗ 未配置（功能不可用）'}`)
  console.log('')
})
