/**
 * 云函数：微信平台礼包发货回调
 *
 * 通过 CloudBase HTTP 访问服务对外暴露 HTTPS URL，
 * 接收微信 MP 后台「消息推送」的 GET 验证和 POST 发货通知。
 *
 * 发货消息写入 pendingGifts 集合，客户端登录时拉取并发放。
 */
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// ===== 与 MP 后台「消息推送配置」保持一致 =====
const TOKEN = 'xiao_chu_gift_2026'

// ========== HTTP 入口 ==========
exports.main = async (event, context) => {
  // CloudBase HTTP 触发时，event 含 httpMethod / queryStringParameters / body 等
  const method = (event.httpMethod || '').toUpperCase()

  if (method === 'GET') {
    return _handleVerify(event)
  }

  if (method === 'POST') {
    return _handlePost(event)
  }

  // callFunction：查询待领取礼包
  if (event.action === 'queryPending') {
    const wxCtx = cloud.getWXContext()
    const openid = wxCtx.OPENID
    if (!openid) return { gifts: [] }
    const res = await db.collection('pendingGifts')
      .where({ openid, status: 'pending' })
      .orderBy('createdAt', 'asc')
      .limit(20)
      .get()
    return { gifts: res.data || [] }
  }

  // callFunction：批量标记已领取
  if (event.action === 'markGranted') {
    const ids = event.ids
    if (!ids || !Array.isArray(ids) || ids.length === 0) return { updated: 0 }
    let updated = 0
    for (const id of ids) {
      try {
        await db.collection('pendingGifts').doc(id).update({
          data: { status: 'granted', grantedAt: db.serverDate() },
        })
        updated++
      } catch (e) {
        console.warn('[giftDeliver] markGranted 失败', id, e.message || e)
      }
    }
    return { updated }
  }

  // callFunction 直接调用（测试 / 运维）
  if (event.action === 'test') {
    return { ok: true, msg: 'giftDeliver alive' }
  }

  return _resp(200, { ErrCode: 0, ErrMsg: 'Ignored' })
}

// ========== GET：MP 后台验证签名 ==========
function _handleVerify(event) {
  const qs = event.queryStringParameters || {}
  const { signature, timestamp, nonce, echostr } = qs

  if (!_checkSignature(signature, timestamp, nonce)) {
    console.warn('[giftDeliver] GET 验签失败', qs)
    return _resp(403, 'signature mismatch')
  }

  console.log('[giftDeliver] GET 验签通过，返回 echostr')
  // 必须原样返回 echostr 字符串
  return _resp(200, echostr, 'text/plain')
}

// ========== POST：消息分发 ==========
async function _handlePost(event) {
  let body = event.body || ''
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf-8')
  }

  let msg
  try {
    msg = typeof body === 'string' ? JSON.parse(body) : body
  } catch (e) {
    console.error('[giftDeliver] JSON 解析失败', body)
    return _resp(200, { ErrCode: 0, ErrMsg: 'Parse error, ignored' })
  }

  console.log('[giftDeliver] POST 收到消息', JSON.stringify(msg).slice(0, 500))

  // 礼包发货
  if (msg.MsgType === 'event' && msg.Event === 'minigame_deliver_goods') {
    return await _handleDeliverGoods(msg.MiniGame || {})
  }

  // 平台通知（版本审核/违规等），仅记日志
  if (msg.MsgType === 'event' && msg.Event === 'minigame_notify_msg') {
    console.log('[giftDeliver] 平台通知', msg.Title, msg.Content)
    return _resp(200, { ErrCode: 0, ErrMsg: 'Notified' })
  }

  return _resp(200, { ErrCode: 0, ErrMsg: 'Unknown event, ignored' })
}

// ========== 礼包发货处理 ==========
async function _handleDeliverGoods(mini) {
  const orderId = mini.OrderId
  if (!orderId) {
    console.error('[giftDeliver] 缺少 OrderId', mini)
    return _resp(200, { ErrCode: -1, ErrMsg: 'Missing OrderId' })
  }

  const col = db.collection('pendingGifts')

  // 幂等：同一 OrderId 只写一次
  try {
    const exist = await col.where({ orderId }).count()
    if (exist.total > 0) {
      console.log('[giftDeliver] OrderId 已存在，跳过', orderId)
      return _resp(200, { ErrCode: 0, ErrMsg: 'Already processed' })
    }
  } catch (e) {
    console.error('[giftDeliver] 查询幂等失败', e)
  }

  // GoodsList → 游戏奖励映射
  const rewards = {}
  const goodsList = mini.GoodsList || []
  for (const item of goodsList) {
    if (item.Id && item.Num > 0) {
      rewards[item.Id] = (rewards[item.Id] || 0) + item.Num
    }
  }

  try {
    await col.add({
      data: {
        orderId,
        openid: mini.ToUserOpenid || '',
        giftTypeId: mini.GiftTypeId || 0,
        giftId: mini.GiftId || '',
        isPreview: mini.IsPreview || 0,
        rewards,
        status: 'pending',
        createdAt: db.serverDate(),
      },
    })
    console.log('[giftDeliver] 写入成功', orderId, rewards)
  } catch (e) {
    // 可能是并发写入导致的重复，视为成功
    console.warn('[giftDeliver] 写入异常（可能重复）', e.message || e)
  }

  return _resp(200, { ErrCode: 0, ErrMsg: 'Success' })
}

// ========== 工具函数 ==========
function _checkSignature(signature, timestamp, nonce) {
  if (!signature || !timestamp || !nonce) return false
  const arr = [TOKEN, timestamp, nonce].sort()
  const hash = crypto.createHash('sha1').update(arr.join('')).digest('hex')
  return hash === signature
}

function _resp(statusCode, body, contentType) {
  const isStr = typeof body === 'string'
  return {
    isBase64Encoded: false,
    statusCode,
    headers: { 'content-type': contentType || (isStr ? 'text/plain' : 'application/json') },
    body: isStr ? body : JSON.stringify(body),
  }
}
