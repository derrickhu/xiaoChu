const crypto = require('crypto')
const { collection } = require('./db')
const { respond, httpError } = require('./http')
const { requireUser } = require('./auth')
const { gameKeyUpper, getGameKey } = require('./config')
const { resolveRequestServer, zoneToServerId } = require('./server')

const TOKEN = process.env[`${gameKeyUpper()}_GIFT_TOKEN`] || `${getGameKey()}_gift_2026`

const PLATFORM_GIFT_GOODS_MAP = {
  soulStone: 'soulStone',
  awakenStone: 'awakenStone',
  stamina: 'stamina',
  universalFragment: 'universalFragment',
}

async function handleQueryPending(req) {
  const user = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  const col = collection('pendingGifts')
  const res = await col
    .where({ userId: user.userId, serverId, status: 'pending' })
    .orderBy('createdAt', 'asc')
    .limit(20)
    .get()
  const gifts = (res && res.data) || []
  if (serverId === 's1' && gifts.length < 20) {
    const legacyRes = await col
      .where({ userId: user.userId, status: 'pending' })
      .orderBy('createdAt', 'asc')
      .limit(20 - gifts.length)
      .get()
    const seen = new Set(gifts.map((g) => g && g._id).filter(Boolean))
    for (const item of ((legacyRes && legacyRes.data) || [])) {
      if (item.serverId || seen.has(item._id)) continue
      gifts.push(item)
      if (item._id) seen.add(item._id)
    }
  }
  return { gifts }
}

async function handleMarkGranted(req) {
  const user = requireUser(req)
  const { serverId } = await resolveRequestServer(req, { requireOpen: true })
  const body = req.body || {}
  const ids = Array.isArray(body.ids) ? body.ids : []
  if (!ids.length) return { updated: 0 }
  let updated = 0
  for (const id of ids) {
    try {
      const doc = await collection('pendingGifts').doc(id).get()
      const data = doc && doc.data && (Array.isArray(doc.data) ? doc.data[0] : doc.data)
      if (data && data.userId && data.userId !== user.userId) continue
      if (data && data.serverId && data.serverId !== serverId) continue
      if (data && !data.serverId && serverId !== 's1') continue
      await collection('pendingGifts').doc(id).update({ status: 'granted', serverId, grantedAt: Date.now() })
      updated++
    } catch (error) {
      console.warn('[gift] markGranted failed', id, error && error.message ? error.message : error)
    }
  }
  return { updated }
}

function handleVerify(req) {
  const qs = req.query || {}
  const { signature, timestamp, nonce, echostr } = qs
  if (!checkSignature(signature, timestamp, nonce)) return respond(403, 'signature mismatch', { 'Content-Type': 'text/plain' })
  return respond(200, echostr || '', { 'Content-Type': 'text/plain' })
}

async function handleCallback(req) {
  let body = (req.raw && req.raw.body) || ''
  if (req.raw && req.raw.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf-8')
  }
  let msg
  try {
    msg = typeof body === 'string' ? parsePostBody(body) : body
  } catch (error) {
    console.error('[gift] parse callback failed', String(body).slice(0, 500))
    return respond(200, { ErrCode: 0, ErrMsg: 'Parse error, ignored' })
  }

  if (msg.MsgType === 'event' && msg.Event === 'minigame_deliver_goods') {
    return await handleDeliverGoods(msg.MiniGame || {})
  }
  if (msg.MsgType === 'event' && msg.Event === 'minigame_notify_msg') {
    console.log('[gift] notify', msg.Title || '', msg.Content || '')
    return respond(200, { ErrCode: 0, ErrMsg: 'Notified' })
  }
  return respond(200, { ErrCode: 0, ErrMsg: 'Unknown event, ignored' })
}

async function handleDeliverGoods(mini) {
  const orderId = mini.OrderId
  if (!orderId) return respond(200, { ErrCode: -1, ErrMsg: 'Missing OrderId' })
  const col = collection('pendingGifts')
  const existed = await col.where({ orderId }).limit(1).get()
  if (existed && existed.data && existed.data.length > 0) {
    return respond(200, { ErrCode: 0, ErrMsg: 'Already processed' })
  }

  const openId = mini.ToUserOpenid || ''
  const userId = openId ? `wx:${openId}` : ''
  const serverId = await zoneToServerId(mini.Zone)
  const mapped = normalizePlatformGiftGoods(mini.GoodsList || [])
  if (Object.keys(mapped.rewards).length === 0) {
    console.error('[gift] no supported goods', { orderId, giftId: mini.GiftId || '', unknownGoods: mapped.unknownGoods })
    return respond(200, { ErrCode: -1, ErrMsg: 'No supported goods' })
  }

  await col.add({
    orderId,
    openId,
    openid: openId,
    userId,
    serverId,
    zone: mini.Zone || 0,
    platform: 'wx',
    giftTypeId: mini.GiftTypeId || 0,
    giftId: mini.GiftId || '',
    isPreview: mini.IsPreview || 0,
    rewards: mapped.rewards,
    rawGoodsList: mapped.rawGoodsList,
    unknownGoods: mapped.unknownGoods,
    status: 'pending',
    createdAt: Date.now(),
  })
  return respond(200, { ErrCode: 0, ErrMsg: 'Success' })
}

function normalizePlatformGiftGoods(goodsList) {
  const rewards = {}
  const unknownGoods = []
  const rawGoodsList = Array.isArray(goodsList) ? goodsList : []
  rawGoodsList.forEach((item) => {
    const id = item && item.Id != null ? String(item.Id) : ''
    const num = Number(item && item.Num)
    if (!id || !Number.isFinite(num) || num <= 0) return
    const key = PLATFORM_GIFT_GOODS_MAP[id]
    if (!key) {
      unknownGoods.push({ id, num })
      return
    }
    rewards[key] = (rewards[key] || 0) + num
  })
  return { rewards, unknownGoods, rawGoodsList }
}

function parsePostBody(body) {
  const text = String(body || '').trim()
  if (!text) return {}
  if (text[0] === '{') return JSON.parse(text)
  if (text[0] === '<') return parseXmlMessage(text)
  throw new Error('unknown body format')
}

function xmlText(xml, tag) {
  const reg = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = String(xml || '').match(reg)
  if (!m) return ''
  return String(m[1] || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim()
}

function xmlNumber(xml, tag) {
  const n = Number(xmlText(xml, tag))
  return Number.isFinite(n) ? n : 0
}

function parseXmlMessage(xml) {
  const msg = {
    CreateTime: xmlNumber(xml, 'CreateTime'),
    MsgType: xmlText(xml, 'MsgType'),
    Event: xmlText(xml, 'Event'),
    Title: xmlText(xml, 'Title'),
    Content: xmlText(xml, 'Content'),
  }
  const miniXml = xmlText(xml, 'MiniGame')
  if (miniXml) {
    const goodsList = []
    const goodsReg = /<GoodsList>([\s\S]*?)<\/GoodsList>/gi
    let match
    while ((match = goodsReg.exec(miniXml))) {
      const itemXml = match[1]
      goodsList.push({ Id: xmlText(itemXml, 'Id'), Num: xmlNumber(itemXml, 'Num') })
    }
    msg.MiniGame = {
      OrderId: xmlText(miniXml, 'OrderId'),
      IsPreview: xmlNumber(miniXml, 'IsPreview'),
      ToUserOpenid: xmlText(miniXml, 'ToUserOpenid'),
      Zone: xmlNumber(miniXml, 'Zone'),
      GiftTypeId: xmlNumber(miniXml, 'GiftTypeId'),
      GiftId: xmlText(miniXml, 'GiftId'),
      SendTime: xmlNumber(miniXml, 'SendTime'),
      GoodsList: goodsList,
    }
  }
  return msg
}

function checkSignature(signature, timestamp, nonce) {
  if (!signature || !timestamp || !nonce) return false
  const hash = crypto.createHash('sha1').update([TOKEN, timestamp, nonce].sort().join('')).digest('hex')
  return hash === signature
}

module.exports = {
  handleQueryPending,
  handleMarkGranted,
  handleVerify,
  handleCallback,
}
