// 云函数：排行榜（提交分数 + 查询排行）
// 支持4种排行：秘境榜(stage)、通天塔(all + allWeekly)、图鉴榜(dex)、连击榜(combo)
//
// 周榜（rankAllWeekly）说明：
//   - periodKey = ISO 周字符串 "YYYY-Www"（如 "2026-W16"）
//   - 每周每用户只保留当周最佳一条（uid + periodKey 复合去重）
//   - 提交总榜时双写一条周榜；周榜查询走 getAllWeekly
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// ===== ISO 周计算：UTC 下的 ISO-8601 周号（周一为一周起点） =====
function _currentPeriodKey(dateOverride) {
  const d = new Date(dateOverride || Date.now())
  // ISO 周算法：把日期 shift 到 周四，取其所在年份的第几周
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (tmp.getUTCDay() + 6) % 7  // 周一=0 周日=6
  tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// GM 黑名单：这些 openid 的提交操作一律拦截，只允许查询
const GM_OPENIDS = [
  'oEnZR3VWQoOEG0U9fhgFCatXLsY4',  // dk
  'oEnZR3f8CpsDLsQ30705CumlkpuM',  // rosa
]

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  // GM 拦截：提交类操作直接返回成功但不写入
  const isSubmitAction = ['submit', 'submitStage', 'submitAndGetAll', 'submitDexCombo'].includes(action)
  if (isSubmitAction && GM_OPENIDS.includes(openid)) {
    console.log(`[Ranking] GM ${openid} 提交被拦截, action=${action}`)
    // submitAndGetAll 需要返回查询结果，转为 getAll
    if (action === 'submitAndGetAll') {
      event.action = 'getAll'
      return exports.main(event, context)
    }
    // submitStage 转为 getStage
    if (action === 'submitStage') {
      return { code: 0, msg: 'GM跳过提交' }
    }
    return { code: 0, msg: 'GM跳过提交' }
  }

  // ===== 提交/更新分数（通关时调用）=====
  if (action === 'submit') {
    const t0 = Date.now()
    const { nickName, avatarUrl, floor, pets, weapon, totalTurns, petDexCount, maxCombo, masteredCount, collectedCount } = event
    if (!floor || floor <= 0) return { code: -1, msg: '无效层数' }

    const baseRecord = {
      uid: openid,
      nickName: nickName || '修士',
      avatarUrl: avatarUrl || '',
      floor,
      pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
      weapon: weapon ? { name: weapon.name } : null,
      totalTurns: totalTurns || 0,
      timestamp: db.serverDate(),
    }

    try {
      // 同时用 _openid 和 uid 查找，避免漏查导致重复插入
      const existing = await db.collection('rankAll').where(_.or([
        { _openid: openid },
        { uid: openid }
      ])).get()
      console.log('[submit] 查已有记录:', existing.data.length, '条, 耗时', Date.now() - t0, 'ms')
      if (existing.data.length > 1) {
        // 去重：保留最佳记录，删除多余的
        const sorted = existing.data.sort((a, b) => {
          if (_isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns)) return -1
          return 1
        })
        for (let i = 1; i < sorted.length; i++) {
          await db.collection('rankAll').doc(sorted[i]._id).remove()
        }
        const old = sorted[0]
        const isBetter = _isBetterScore(floor, totalTurns, old.floor, old.totalTurns)
        if (isBetter) {
          await db.collection('rankAll').doc(old._id).update({ data: baseRecord })
        } else {
          await db.collection('rankAll').doc(old._id).update({
            data: { nickName: baseRecord.nickName, avatarUrl: baseRecord.avatarUrl }
          })
        }
      } else if (existing.data.length === 1) {
        const old = existing.data[0]
        const isBetter = _isBetterScore(floor, totalTurns, old.floor, old.totalTurns)
        if (isBetter) {
          await db.collection('rankAll').doc(old._id).update({ data: baseRecord })
        } else {
          await db.collection('rankAll').doc(old._id).update({
            data: { nickName: baseRecord.nickName, avatarUrl: baseRecord.avatarUrl }
          })
        }
      } else {
        await db.collection('rankAll').add({ data: baseRecord })
      }

      await _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo, masteredCount, collectedCount)
      await _upsertWeekly(openid, baseRecord)

      console.log('[submit] 完成, 总耗时', Date.now() - t0, 'ms')
      return { code: 0, msg: '提交成功', ms: Date.now() - t0 }
    } catch (e) {
      console.error('排行榜提交失败:', e, '耗时', Date.now() - t0, 'ms')
      return { code: -1, msg: e.message }
    }
  }

  // ===== 单独提交图鉴/连击（非通关时）=====
  if (action === 'submitDexCombo') {
    const { nickName, avatarUrl, petDexCount, maxCombo, masteredCount, collectedCount } = event
    try {
      await _updateDexCombo(openid, nickName || '修士', avatarUrl || '', petDexCount, maxCombo, masteredCount, collectedCount)
      return { code: 0, msg: '提交成功' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }

  // ===== 提交秘境排行 =====
  if (action === 'submitStage') {
    const {
      nickName, avatarUrl, totalStars, clearCount, eliteClearCount, farthestChapter,
      farthestNormalChapter, farthestNormalOrder, farthestEliteChapter, farthestEliteOrder,
    } = event
    try {
      await _updateStageRank(openid, nickName || '修士', avatarUrl || '', totalStars || 0, clearCount || 0, eliteClearCount || 0, farthestChapter || 0, {
        farthestNormalChapter: farthestNormalChapter || 0,
        farthestNormalOrder: farthestNormalOrder || 0,
        farthestEliteChapter: farthestEliteChapter || 0,
        farthestEliteOrder: farthestEliteOrder || 0,
      })
      return { code: 0, msg: '提交成功' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }

  // ===== 查询秘境榜 =====
  if (action === 'getStage') {
    try {
      const res = await db.collection('rankStage')
        .orderBy('totalStars', 'desc')
        .orderBy('eliteClearCount', 'desc')
        .limit(100)
        .get()
      const deduped = _deduplicateByOpenid(res.data, (a, b) => {
        if ((b.totalStars || 0) !== (a.totalStars || 0)) return (b.totalStars || 0) - (a.totalStars || 0)
        if ((b.eliteClearCount || 0) !== (a.eliteClearCount || 0)) return (b.eliteClearCount || 0) - (a.eliteClearCount || 0)
        return 0
      })
      const list = deduped.slice(0, 50)
      let myRank = -1
      const myRes = await db.collection('rankStage').where(_.or([
        { uid: openid }, { _openid: openid }
      ])).get()
      if (myRes.data.length > 0) {
        const my = myRes.data.sort((a, b) => (b.totalStars || 0) - (a.totalStars || 0))[0]
        const betterCount = await db.collection('rankStage').where({ totalStars: _.gt(my.totalStars || 0) }).count()
        myRank = betterCount.total + 1
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 提交 + 查询一体化（减少云函数调用次数）=====
  if (action === 'submitAndGetAll') {
    const t0 = Date.now()
    const debug = { openid }
    try {
      // 1. 提交分数（如果有）
      const { nickName, avatarUrl, floor, pets, weapon, totalTurns, petDexCount, maxCombo, masteredCount, collectedCount } = event
      if (floor && floor > 0) {
        const baseRecord = {
          uid: openid,
          nickName: nickName || '修士',
          avatarUrl: avatarUrl || '',
          floor,
          pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
          weapon: weapon ? { name: weapon.name } : null,
          totalTurns: totalTurns || 0,
          timestamp: db.serverDate(),
        }
        const existing = await db.collection('rankAll').where(_.or([
          { _openid: openid }, { uid: openid }
        ])).get()
        if (existing.data.length > 1) {
          const sorted = existing.data.sort((a, b) => _isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns) ? -1 : 1)
          for (let i = 1; i < sorted.length; i++) {
            await db.collection('rankAll').doc(sorted[i]._id).remove()
          }
          const old = sorted[0]
          if (_isBetterScore(floor, totalTurns, old.floor, old.totalTurns)) {
            await db.collection('rankAll').doc(old._id).update({ data: baseRecord })
          } else {
            await db.collection('rankAll').doc(old._id).update({ data: { nickName: baseRecord.nickName, avatarUrl: baseRecord.avatarUrl } })
          }
        } else if (existing.data.length === 1) {
          const old = existing.data[0]
          if (_isBetterScore(floor, totalTurns, old.floor, old.totalTurns)) {
            await db.collection('rankAll').doc(old._id).update({ data: baseRecord })
          } else {
            await db.collection('rankAll').doc(old._id).update({ data: { nickName: baseRecord.nickName, avatarUrl: baseRecord.avatarUrl } })
          }
        } else {
          await db.collection('rankAll').add({ data: baseRecord })
        }
        debug.submitMs = Date.now() - t0

        await _updateDexCombo(openid, nickName || '修士', avatarUrl || '', petDexCount, maxCombo, masteredCount, collectedCount)
        await _upsertWeekly(openid, baseRecord)
        debug.dexComboMs = Date.now() - t0
      }

      // 2. 拉取排行榜
      const getRes = await db.collection('rankAll')
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      debug.getCount = getRes.data.length
      debug.fetchMs = Date.now() - t0

      const records = getRes.data
      if (records.length === 0) {
        debug.totalMs = Date.now() - t0
        return { code: 0, list: [], myRank: -1, debug }
      }

      const deduped = _deduplicateByOpenid(records, _rankAllComparator)
      debug.dedupedCount = deduped.length
      const list = deduped.slice(0, 50)

      // 3. 从已拉到的数据中找自己排名
      let myRank = -1
      const idx = deduped.findIndex(r => (r._openid === openid || r.uid === openid))
      if (idx >= 0) {
        myRank = idx + 1
        debug.myFoundIn = 'cache'
      } else {
        // 不在前100条里
        const myRes = await db.collection('rankAll').where(_.or([
          { uid: openid }, { _openid: openid }
        ])).get()
        debug.myCount = myRes.data.length
        if (myRes.data.length > 0) {
          const my = myRes.data.sort((a, b) => _isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns) ? -1 : 1)[0]
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAll').where({ floor: _.gt(my.floor) }).count(),
            my.totalTurns > 0
              ? db.collection('rankAll').where({ floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }).count()
              : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
          debug.myFoundIn = 'query'
        }
      }
      debug.totalMs = Date.now() - t0
      return { code: 0, list, myRank, debug }
    } catch (e) {
      debug.totalMs = Date.now() - t0
      return { code: -1, msg: e.message, list: [], debug }
    }
  }

  // ===== 查询速通榜（总排行）=====
  if (action === 'getAll') {
    const debug = {}
    const t0 = Date.now()
    try {
      debug.openid = openid

      // 拉取排行榜（1次DB查询）
      const getRes = await db.collection('rankAll')
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      debug.getCount = getRes.data.length
      debug.fetchMs = Date.now() - t0

      const records = getRes.data
      if (records.length === 0) {
        debug.totalMs = Date.now() - t0
        return { code: 0, list: [], myRank: -1, debug }
      }

      // 构建排行列表
      const deduped = _deduplicateByOpenid(records, (a, b) => {
        if (a.floor !== b.floor) return b.floor - a.floor
        const aT = a.totalTurns || 0, bT = b.totalTurns || 0
        if (aT !== bT) {
          if (aT > 0 && bT > 0) return aT - bT
          if (aT > 0) return -1
          if (bT > 0) return 1
        }
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      debug.dedupedCount = deduped.length
      const list = deduped.slice(0, 50)

      // 先尝试从已有的 100 条数据中找到自己（避免额外查询）
      let myRank = -1
      let myRecord = records.find(r => r._openid === openid || r.uid === openid)
      if (myRecord) {
        // 直接从 deduped 列表中算排名
        const idx = deduped.findIndex(r => (r._openid === openid || r.uid === openid))
        if (idx >= 0) {
          myRank = idx + 1
        } else {
          // 数据在 100 条内但被去重掉了，用 count 查
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAll').where({ floor: _.gt(myRecord.floor) }).count(),
            myRecord.totalTurns > 0
              ? db.collection('rankAll').where({
                  floor: _.eq(myRecord.floor),
                  totalTurns: _.gt(0).and(_.lt(myRecord.totalTurns))
                }).count()
              : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
        }
        debug.myFoundIn = 'cache'
      } else {
        // 不在前 100 条里，需要额外查询（1次DB）
        const myRes = await db.collection('rankAll').where(_.or([
          { uid: openid },
          { _openid: openid }
        ])).get()
        debug.myCount = myRes.data.length
        if (myRes.data.length > 0) {
          const my = myRes.data.sort((a, b) => {
            if (_isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns)) return -1
            return 1
          })[0]
          // 两次 count 并行查询
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAll').where({ floor: _.gt(my.floor) }).count(),
            my.totalTurns > 0
              ? db.collection('rankAll').where({
                  floor: _.eq(my.floor),
                  totalTurns: _.gt(0).and(_.lt(my.totalTurns))
                }).count()
              : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
          debug.myFoundIn = 'query'
        }
      }
      debug.totalMs = Date.now() - t0
      return { code: 0, list, myRank, debug }
    } catch (e) {
      debug.totalMs = Date.now() - t0
      return { code: -1, msg: e.message, list: [], debug, stack: e.stack }
    }
  }

  // ===== 查询图鉴榜（精通优先；单字段 orderBy 避免缺复合索引时整段失败） =====
  if (action === 'getDex') {
    try {
      const res = await db.collection('rankDex')
        .orderBy('masteredCount', 'desc')
        .limit(100)
        .get()
      const deduped = _deduplicateByOpenid(res.data, (a, b) => {
        const am = a.masteredCount || 0, bm = b.masteredCount || 0
        if (bm !== am) return bm - am
        const ac = a.collectedCount || 0, bc = b.collectedCount || 0
        if (bc !== ac) return bc - ac
        if ((b.petDexCount || 0) !== (a.petDexCount || 0)) return (b.petDexCount || 0) - (a.petDexCount || 0)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      const list = deduped.slice(0, 50)

      let myRank = -1
      const myRes = await db.collection('rankDex').where(_.or([
        { uid: openid },
        { _openid: openid }
      ])).get()
      if (myRes.data.length > 0) {
        const my = myRes.data.sort((a, b) => {
          const am = a.masteredCount || 0, bm = b.masteredCount || 0
          if (bm !== am) return bm - am
          const ac = a.collectedCount || 0, bc = b.collectedCount || 0
          if (bc !== ac) return bc - ac
          return (b.petDexCount || 0) - (a.petDexCount || 0)
        })[0]
        const myM = my.masteredCount || 0
        const betterM = await db.collection('rankDex').where({ masteredCount: _.gt(myM) }).count()
        myRank = betterM.total + 1
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询连击榜 =====
  if (action === 'getCombo') {
    try {
      const res = await db.collection('rankCombo')
        .orderBy('maxCombo', 'desc')
        .limit(100)
        .get()
      const deduped = _deduplicateByOpenid(res.data, (a, b) => {
        if ((b.maxCombo || 0) !== (a.maxCombo || 0)) return (b.maxCombo || 0) - (a.maxCombo || 0)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      const list = deduped.slice(0, 50)

      let myRank = -1
      const myRes = await db.collection('rankCombo').where(_.or([
        { uid: openid },
        { _openid: openid }
      ])).get()
      if (myRes.data.length > 0) {
        const myCombo = myRes.data.sort((a, b) => (b.maxCombo || 0) - (a.maxCombo || 0))[0].maxCombo
        const betterCount = await db.collection('rankCombo').where({ maxCombo: _.gt(myCombo) }).count()
        myRank = betterCount.total + 1
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询通天塔周榜（本周进度） =====
  //   与 getAll 逻辑一致，但限定 periodKey = 本周，一个用户每周只保留当周最佳
  if (action === 'getAllWeekly') {
    const debug = {}
    const t0 = Date.now()
    const periodKey = event.periodKey || _currentPeriodKey()
    debug.periodKey = periodKey
    try {
      const getRes = await db.collection('rankAllWeekly')
        .where({ periodKey })
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      debug.getCount = getRes.data.length
      debug.fetchMs = Date.now() - t0

      const records = getRes.data
      if (records.length === 0) {
        debug.totalMs = Date.now() - t0
        return { code: 0, list: [], myRank: -1, periodKey, debug }
      }

      const deduped = _deduplicateByOpenid(records, _rankAllComparator)
      const list = deduped.slice(0, 50)

      let myRank = -1
      const idx = deduped.findIndex(r => (r._openid === openid || r.uid === openid))
      if (idx >= 0) {
        myRank = idx + 1
        debug.myFoundIn = 'cache'
      } else {
        const myRes = await db.collection('rankAllWeekly').where(_.and([
          { periodKey },
          _.or([{ uid: openid }, { _openid: openid }]),
        ])).get()
        if (myRes.data.length > 0) {
          const my = myRes.data.sort((a, b) => _isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns) ? -1 : 1)[0]
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAllWeekly').where({ periodKey, floor: _.gt(my.floor) }).count(),
            my.totalTurns > 0
              ? db.collection('rankAllWeekly').where({
                  periodKey,
                  floor: _.eq(my.floor),
                  totalTurns: _.gt(0).and(_.lt(my.totalTurns))
                }).count()
              : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
          debug.myFoundIn = 'query'
        }
      }
      debug.totalMs = Date.now() - t0
      return { code: 0, list, myRank, periodKey, debug }
    } catch (e) {
      debug.totalMs = Date.now() - t0
      return { code: -1, msg: e.message, list: [], periodKey, debug }
    }
  }

  return { code: -1, msg: '未知操作' }
}

// 周榜 upsert：每周每用户一条，落后不覆盖核心成绩但更新昵称/头像
async function _upsertWeekly(openid, baseRecord) {
  if (!baseRecord || !baseRecord.floor || baseRecord.floor <= 0) return
  const periodKey = _currentPeriodKey()
  const weeklyRecord = { ...baseRecord, periodKey }
  try {
    const existing = await db.collection('rankAllWeekly').where(_.and([
      { periodKey },
      _.or([{ _openid: openid }, { uid: openid }]),
    ])).get()
    if (existing.data.length > 1) {
      // 去重：同周同用户多条，保留最佳
      const sorted = existing.data.sort((a, b) => _isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns) ? -1 : 1)
      for (let i = 1; i < sorted.length; i++) {
        await db.collection('rankAllWeekly').doc(sorted[i]._id).remove()
      }
      const old = sorted[0]
      if (_isBetterScore(weeklyRecord.floor, weeklyRecord.totalTurns, old.floor, old.totalTurns)) {
        await db.collection('rankAllWeekly').doc(old._id).update({ data: weeklyRecord })
      } else {
        await db.collection('rankAllWeekly').doc(old._id).update({
          data: { nickName: weeklyRecord.nickName, avatarUrl: weeklyRecord.avatarUrl }
        })
      }
    } else if (existing.data.length === 1) {
      const old = existing.data[0]
      if (_isBetterScore(weeklyRecord.floor, weeklyRecord.totalTurns, old.floor, old.totalTurns)) {
        await db.collection('rankAllWeekly').doc(old._id).update({ data: weeklyRecord })
      } else {
        await db.collection('rankAllWeekly').doc(old._id).update({
          data: { nickName: weeklyRecord.nickName, avatarUrl: weeklyRecord.avatarUrl }
        })
      }
    } else {
      await db.collection('rankAllWeekly').add({ data: weeklyRecord })
    }
  } catch (e) {
    console.warn('[_upsertWeekly] 失败:', e.message || e)
  }
}

// 速通榜排序比较器
function _rankAllComparator(a, b) {
  if (a.floor !== b.floor) return b.floor - a.floor
  const aT = a.totalTurns || 0, bT = b.totalTurns || 0
  if (aT !== bT) {
    if (aT > 0 && bT > 0) return aT - bT
    if (aT > 0) return -1
    if (bT > 0) return 1
  }
  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
  return bTime - aTime
}

// 按用户去重：优先用 _openid，没有则用 uid 字段，都没有则用 _id（不跳过）
function _deduplicateByOpenid(records, compareFn) {
  const map = {}
  for (const r of records) {
    const key = r._openid || r.uid || r._id
    if (!key) continue
    if (!map[key]) {
      map[key] = r
    } else {
      if (compareFn(r, map[key]) < 0) {
        map[key] = r
      }
    }
  }
  return Object.values(map).sort(compareFn)
}

// 判断新成绩是否优于旧成绩
function _isBetterScore(newFloor, newTurns, oldFloor, oldTurns) {
  // 通关 > 未通关
  if (newFloor >= 30 && oldFloor < 30) return true
  if (newFloor < 30 && oldFloor >= 30) return false
  // 都通关：有回合数的优于没回合数的，都有则回合数更少更好
  if (newFloor >= 30 && oldFloor >= 30) {
    if (newTurns > 0 && oldTurns > 0) return newTurns < oldTurns
    if (newTurns > 0) return true
    return false
  }
  // 都未通关：层数更高更好
  return newFloor > oldFloor
}

// 更新秘境排行（带去重逻辑）
async function _updateStageRank(openid, nickName, avatarUrl, totalStars, clearCount, eliteClearCount, farthestChapter, coords) {
  if (totalStars <= 0 && clearCount <= 0) return
  const record = {
    uid: openid,
    nickName,
    avatarUrl,
    totalStars,
    clearCount,
    eliteClearCount,
    farthestChapter,
    farthestNormalChapter: coords && coords.farthestNormalChapter,
    farthestNormalOrder: coords && coords.farthestNormalOrder,
    farthestEliteChapter: coords && coords.farthestEliteChapter,
    farthestEliteOrder: coords && coords.farthestEliteOrder,
    timestamp: db.serverDate(),
  }
  const exist = await db.collection('rankStage').where(_.or([
    { _openid: openid }, { uid: openid }
  ])).get()
  if (exist.data.length > 1) {
    const sorted = exist.data.sort((a, b) => (b.totalStars || 0) - (a.totalStars || 0))
    for (let i = 1; i < sorted.length; i++) {
      await db.collection('rankStage').doc(sorted[i]._id).remove()
    }
    if (totalStars >= (sorted[0].totalStars || 0)) {
      await db.collection('rankStage').doc(sorted[0]._id).update({ data: record })
    } else {
      await db.collection('rankStage').doc(sorted[0]._id).update({ data: { nickName, avatarUrl } })
    }
  } else if (exist.data.length === 1) {
    if (totalStars >= (exist.data[0].totalStars || 0)) {
      await db.collection('rankStage').doc(exist.data[0]._id).update({ data: record })
    } else {
      await db.collection('rankStage').doc(exist.data[0]._id).update({ data: { nickName, avatarUrl } })
    }
  } else {
    await db.collection('rankStage').add({ data: record })
  }
}

// 更新图鉴榜和连击榜（带去重逻辑）
async function _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo, masteredCount, collectedCount) {
  // 图鉴榜（精通优先排序）
  if (petDexCount > 0) {
    const dexExist = await db.collection('rankDex').where(_.or([
      { _openid: openid },
      { uid: openid }
    ])).get()
    const dexRecord = {
      uid: openid, nickName, avatarUrl, petDexCount,
      masteredCount: masteredCount || 0,
      collectedCount: collectedCount || 0,
      timestamp: db.serverDate(),
    }
    const _isBetterDex = (newR, oldR) => {
      const nm = newR.masteredCount || 0, om = oldR.masteredCount || 0
      if (nm !== om) return nm > om
      const nc = newR.collectedCount || 0, oc = oldR.collectedCount || 0
      if (nc !== oc) return nc > oc
      return (newR.petDexCount || 0) >= (oldR.petDexCount || 0)
    }
    if (dexExist.data.length > 1) {
      const sorted = dexExist.data.sort((a, b) => (b.masteredCount || b.petDexCount || 0) - (a.masteredCount || a.petDexCount || 0))
      for (let i = 1; i < sorted.length; i++) {
        await db.collection('rankDex').doc(sorted[i]._id).remove()
      }
      if (_isBetterDex(dexRecord, sorted[0])) {
        await db.collection('rankDex').doc(sorted[0]._id).update({ data: dexRecord })
      } else {
        await db.collection('rankDex').doc(sorted[0]._id).update({ data: { nickName, avatarUrl } })
      }
    } else if (dexExist.data.length === 1) {
      if (_isBetterDex(dexRecord, dexExist.data[0])) {
        await db.collection('rankDex').doc(dexExist.data[0]._id).update({ data: dexRecord })
      } else {
        await db.collection('rankDex').doc(dexExist.data[0]._id).update({
          data: { nickName, avatarUrl }
        })
      }
    } else {
      await db.collection('rankDex').add({ data: dexRecord })
    }
  }

  // 连击榜
  if (maxCombo > 0) {
    const comboExist = await db.collection('rankCombo').where(_.or([
      { _openid: openid },
      { uid: openid }
    ])).get()
    const comboRecord = {
      uid: openid, nickName, avatarUrl, maxCombo,
      timestamp: db.serverDate(),
    }
    if (comboExist.data.length > 1) {
      // 去重
      const sorted = comboExist.data.sort((a, b) => (b.maxCombo || 0) - (a.maxCombo || 0))
      for (let i = 1; i < sorted.length; i++) {
        await db.collection('rankCombo').doc(sorted[i]._id).remove()
      }
      if (maxCombo > (sorted[0].maxCombo || 0)) {
        await db.collection('rankCombo').doc(sorted[0]._id).update({ data: comboRecord })
      } else {
        await db.collection('rankCombo').doc(sorted[0]._id).update({ data: { nickName, avatarUrl } })
      }
    } else if (comboExist.data.length === 1) {
      if (maxCombo > (comboExist.data[0].maxCombo || 0)) {
        await db.collection('rankCombo').doc(comboExist.data[0]._id).update({ data: comboRecord })
      } else {
        await db.collection('rankCombo').doc(comboExist.data[0]._id).update({
          data: { nickName, avatarUrl }
        })
      }
    } else {
      await db.collection('rankCombo').add({ data: comboRecord })
    }
  }
}
