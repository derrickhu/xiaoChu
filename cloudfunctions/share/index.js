/**
 * 云函数：分享裂变与邀请奖励
 *
 * 提供两个 action，走客户端 callFunction：
 *
 *   1. recordInvite
 *      新玩家首登时（processInvite 本地发奖后）调用
 *      参数：{ inviter }   —— inviter 为老玩家的 openid（从 query.inviter 来）
 *      内部取当前调用者（新用户 openid），写一条 inviteRecords
 *      防刷：
 *        - 同一 newUser 只能被首次 inviter 记录（unique）
 *        - inviter === newUser 时拒绝（防自邀）
 *      返回：{ recorded: true/false, reason? }
 *
 *   2. claimInvites
 *      老玩家登录 / 打开分享面板时调用，拉取待领取的邀请奖励计数
 *      内部：inviter = 当前调用者 openid
 *      查 {inviter, granted: false}，取前 N 条，标记 granted = true
 *      返回：{ count, total }
 *        - count：本次新领取的人数
 *        - total：该 inviter 历史累计被邀请成功的总人数
 */
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 单次拉取上限（防止单次请求超时 + 对齐前端 INVITE_MAX_COUNT 节奏）
const CLAIM_BATCH_LIMIT = 20

// 反作弊：同一 inviter 每日可登记的新用户上限
const INVITE_DAILY_PER_INVITER = 20
// 反作弊：同一 inviter 的历史总邀请上限（远大于前端 INVITE_MAX_COUNT，只兜底）
const INVITE_TOTAL_PER_INVITER = 200

exports.main = async (event) => {
  const wxCtx = cloud.getWXContext()
  const openid = wxCtx.OPENID

  if (!openid) return { errno: -1, msg: 'no openid' }

  if (event.action === 'recordInvite') {
    return await _recordInvite(openid, event.inviter)
  }
  if (event.action === 'claimInvites') {
    return await _claimInvites(openid)
  }
  return { errno: -2, msg: 'unknown action' }
}

// ===== recordInvite =====
async function _recordInvite(newUser, inviter) {
  if (!inviter) return { recorded: false, reason: 'no_inviter' }
  if (inviter === newUser) return { recorded: false, reason: 'self' }

  // 防重：同一 newUser 只能被记录一次（无论谁邀请）
  try {
    const exists = await db.collection('inviteRecords')
      .where({ newUser })
      .limit(1)
      .get()
    if (exists.data && exists.data.length > 0) {
      return { recorded: false, reason: 'already_recorded' }
    }
  } catch (e) {
    console.warn('[share] check duplicate failed', e.message || e)
  }

  // 反作弊：同 inviter 总量上限（远大于前端 INVITE_MAX_COUNT，仅做兜底拦截）
  try {
    const totalCr = await db.collection('inviteRecords').where({ inviter }).count()
    if ((totalCr.total || 0) >= INVITE_TOTAL_PER_INVITER) {
      return { recorded: false, reason: 'total_limit' }
    }
  } catch (e) {
    console.warn('[share] total limit check failed', e.message || e)
  }

  // 反作弊：同 inviter 当日新增上限（时间按服务端 UTC 日计算，粗粒度够用）
  try {
    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const dailyCr = await db.collection('inviteRecords')
      .where({
        inviter,
        createdAt: _.gte(dayStart),
      })
      .count()
    if ((dailyCr.total || 0) >= INVITE_DAILY_PER_INVITER) {
      return { recorded: false, reason: 'daily_limit' }
    }
  } catch (e) {
    console.warn('[share] daily limit check failed', e.message || e)
  }

  try {
    await db.collection('inviteRecords').add({
      data: {
        inviter,
        newUser,
        granted: false,
        createdAt: db.serverDate(),
      },
    })
    return { recorded: true }
  } catch (e) {
    console.warn('[share] recordInvite failed', e.message || e)
    return { recorded: false, reason: 'db_error' }
  }
}

// ===== claimInvites =====
async function _claimInvites(inviter) {
  let newly = []
  try {
    const res = await db.collection('inviteRecords')
      .where({ inviter, granted: false })
      .limit(CLAIM_BATCH_LIMIT)
      .get()
    newly = res.data || []
  } catch (e) {
    console.warn('[share] claimInvites query failed', e.message || e)
    return { count: 0, total: 0 }
  }

  // 串行标记以避免并发超额写入（批量不大，串行即可）
  let count = 0
  for (const rec of newly) {
    try {
      await db.collection('inviteRecords').doc(rec._id).update({
        data: { granted: true, grantedAt: db.serverDate() },
      })
      count++
    } catch (e) {
      console.warn('[share] mark granted failed', rec._id, e.message || e)
    }
  }

  // 总累计（包括本次已标记 granted）
  let total = 0
  try {
    const cr = await db.collection('inviteRecords')
      .where({ inviter })
      .count()
    total = cr.total || 0
  } catch (e) { /* ignore */ }

  return { count, total }
}
