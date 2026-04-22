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

// 上一 ISO 周 periodKey（"YYYY-Www"）：用于周榜领奖查询「上周」成绩
function _lastPeriodKey() {
  const d = new Date(Date.now() - 7 * 86400000)
  return _currentPeriodKey(d.getTime())
}

// 周榜奖励档位：改数值只动这一张表（配置集中）
//   rank 为本周周榜最终名次；未上榜（无记录）不发奖
const WEEKLY_REWARD_TIERS = [
  { maxRank: 1,   soulStone: 100, uniFrag: 3, label: 'top1' },
  { maxRank: 3,   soulStone: 60,  uniFrag: 2, label: 'top3' },
  { maxRank: 10,  soulStone: 30,  uniFrag: 1, label: 'top10' },
  { maxRank: Infinity, soulStone: 10, uniFrag: 0, label: 'participate' },
]
function _pickWeeklyRewardTier(rank) {
  if (!rank || rank <= 0) return null
  for (const tier of WEEKLY_REWARD_TIERS) {
    if (rank <= tier.maxRank) return tier
  }
  return null
}

// 档位（realmTier）合法集合：客户端传值之外兜底用 qi_refine
//   与 js/data/realmTier.js TIER_BOUNDS 保持一致！
const VALID_TIERS = ['qi_refine', 'core', 'spirit', 'mahayana', 'ascend']
function _normalizeTier(t) {
  return VALID_TIERS.indexOf(t) >= 0 ? t : 'qi_refine'
}

// GM 黑名单：这些 openid 的提交操作一律拦截，只允许查询
const GM_OPENIDS = [
  "oEnZR3VWQoOEG0U9fhgFCatXLsY4",
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
    const { nickName, avatarUrl, floor, pets, weapon, totalTurns, petDexCount, maxCombo, masteredCount, collectedCount, realmTier } = event
    if (!floor || floor <= 0) return { code: -1, msg: '无效层数' }

    const baseRecord = {
      uid: openid,
      nickName: nickName || '修士',
      avatarUrl: avatarUrl || '',
      floor,
      pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
      weapon: weapon ? { name: weapon.name } : null,
      totalTurns: totalTurns || 0,
      realmTier: _normalizeTier(realmTier),
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

      await _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo, masteredCount, collectedCount, realmTier)
      const weeklyRes = await _upsertWeekly(openid, baseRecord)
      console.log('[submit] 周榜写入结果:', JSON.stringify(weeklyRes))

      console.log('[submit] 完成, 总耗时', Date.now() - t0, 'ms')
      return { code: 0, msg: '提交成功', ms: Date.now() - t0, weekly: weeklyRes }
    } catch (e) {
      console.error('排行榜提交失败:', e, '耗时', Date.now() - t0, 'ms')
      return { code: -1, msg: e.message }
    }
  }

  // ===== 单独提交图鉴/连击（非通关时）=====
  if (action === 'submitDexCombo') {
    const { nickName, avatarUrl, petDexCount, maxCombo, masteredCount, collectedCount, realmTier } = event
    try {
      await _updateDexCombo(openid, nickName || '修士', avatarUrl || '', petDexCount, maxCombo, masteredCount, collectedCount, realmTier)
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
      realmTier,
    } = event
    try {
      await _updateStageRank(openid, nickName || '修士', avatarUrl || '', totalStars || 0, clearCount || 0, eliteClearCount || 0, farthestChapter || 0, {
        farthestNormalChapter: farthestNormalChapter || 0,
        farthestNormalOrder: farthestNormalOrder || 0,
        farthestEliteChapter: farthestEliteChapter || 0,
        farthestEliteOrder: farthestEliteOrder || 0,
        realmTier,
      })
      return { code: 0, msg: '提交成功' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }

  // ===== 查询秘境榜 =====
  //   可选 realmTier：限定只看同档位玩家
  if (action === 'getStage') {
    const tierFilter = event.realmTier ? _normalizeTier(event.realmTier) : null
    try {
      // 拉足够多的记录做内存排序：老数据缺 totalStars/eliteClearCount 字段时 _.eq/_.gt 匹配不到，
      // 会把"星数=0 的新玩家"误算成并列第 1。改为内存排序，字段统一 || 0 兜底。
      let query = db.collection('rankStage')
      if (tierFilter) query = query.where({ realmTier: tierFilter })
      const res = await query
        .orderBy('totalStars', 'desc')
        .orderBy('eliteClearCount', 'desc')
        .limit(500)
        .get()
      const cmp = (a, b) => {
        if ((b.totalStars || 0) !== (a.totalStars || 0)) return (b.totalStars || 0) - (a.totalStars || 0)
        if ((b.eliteClearCount || 0) !== (a.eliteClearCount || 0)) return (b.eliteClearCount || 0) - (a.eliteClearCount || 0)
        return 0
      }
      const deduped = _deduplicateByOpenid(res.data, cmp)
      const list = deduped.slice(0, 50)

      let myRank = -1
      const myIdxInList = deduped.findIndex(r => (r.uid === openid) || (r._openid === openid))
      if (myIdxInList >= 0) {
        myRank = myIdxInList + 1
      } else {
        const myWhere = tierFilter
          ? _.and([{ realmTier: tierFilter }, _.or([{ uid: openid }, { _openid: openid }])])
          : _.or([{ uid: openid }, { _openid: openid }])
        const myRes = await db.collection('rankStage').where(myWhere).get()
        if (myRes.data.length > 0) {
          const my = myRes.data.sort(cmp)[0]
          const betterCount = deduped.filter(r => cmp(r, my) < 0).length
          myRank = betterCount + 1
        }
      }
      return { code: 0, list, myRank, realmTier: tierFilter }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 提交 + 查询一体化（减少云函数调用次数）=====
  //   可选 queryRealmTier：查询阶段按档位过滤；realmTier 写入记录
  if (action === 'submitAndGetAll') {
    const t0 = Date.now()
    const debug = { openid }
    const queryTier = event.queryRealmTier ? _normalizeTier(event.queryRealmTier) : null
    try {
      // 1. 提交分数（如果有）
      const { nickName, avatarUrl, floor, pets, weapon, totalTurns, petDexCount, maxCombo, masteredCount, collectedCount, realmTier } = event
      if (floor && floor > 0) {
        const baseRecord = {
          uid: openid,
          nickName: nickName || '修士',
          avatarUrl: avatarUrl || '',
          floor,
          pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
          weapon: weapon ? { name: weapon.name } : null,
          totalTurns: totalTurns || 0,
          realmTier: _normalizeTier(realmTier),
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

        await _updateDexCombo(openid, nickName || '修士', avatarUrl || '', petDexCount, maxCombo, masteredCount, collectedCount, realmTier)
        const weeklyRes = await _upsertWeekly(openid, baseRecord)
        debug.weekly = weeklyRes
        console.log('[submitAndGetAll] 周榜写入结果:', JSON.stringify(weeklyRes))
        debug.dexComboMs = Date.now() - t0
      }

      // 2. 拉取排行榜（可选按档位过滤）
      debug.queryTier = queryTier
      let query = db.collection('rankAll')
      if (queryTier) query = query.where({ realmTier: queryTier })
      const getRes = await query
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      debug.getCount = getRes.data.length
      debug.fetchMs = Date.now() - t0

      const records = getRes.data
      if (records.length === 0) {
        debug.totalMs = Date.now() - t0
        return { code: 0, list: [], myRank: -1, realmTier: queryTier, debug }
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
        const myWhere = queryTier
          ? _.and([{ realmTier: queryTier }, _.or([{ uid: openid }, { _openid: openid }])])
          : _.or([{ uid: openid }, { _openid: openid }])
        const myRes = await db.collection('rankAll').where(myWhere).get()
        debug.myCount = myRes.data.length
        if (myRes.data.length > 0) {
          const my = myRes.data.sort((a, b) => _isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns) ? -1 : 1)[0]
          const higherWhere = queryTier
            ? { realmTier: queryTier, floor: _.gt(my.floor) }
            : { floor: _.gt(my.floor) }
          const sameFloorWhere = queryTier
            ? { realmTier: queryTier, floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }
            : { floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAll').where(higherWhere).count(),
            my.totalTurns > 0 ? db.collection('rankAll').where(sameFloorWhere).count() : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
          debug.myFoundIn = 'query'
        }
      }
      debug.totalMs = Date.now() - t0
      return { code: 0, list, myRank, realmTier: queryTier, debug }
    } catch (e) {
      debug.totalMs = Date.now() - t0
      return { code: -1, msg: e.message, list: [], debug }
    }
  }

  // ===== 查询速通榜（总排行）=====
  //   可选 realmTier：限定档位查询
  if (action === 'getAll') {
    const debug = {}
    const t0 = Date.now()
    const tierFilter = event.realmTier ? _normalizeTier(event.realmTier) : null
    debug.tierFilter = tierFilter
    try {
      debug.openid = openid

      // 拉取排行榜（1次DB查询）
      let query = db.collection('rankAll')
      if (tierFilter) query = query.where({ realmTier: tierFilter })
      const getRes = await query
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      debug.getCount = getRes.data.length
      debug.fetchMs = Date.now() - t0

      const records = getRes.data
      if (records.length === 0) {
        debug.totalMs = Date.now() - t0
        return { code: 0, list: [], myRank: -1, realmTier: tierFilter, debug }
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
          const higherWhere = tierFilter
            ? { realmTier: tierFilter, floor: _.gt(myRecord.floor) }
            : { floor: _.gt(myRecord.floor) }
          const sameFloorWhere = tierFilter
            ? { realmTier: tierFilter, floor: _.eq(myRecord.floor), totalTurns: _.gt(0).and(_.lt(myRecord.totalTurns)) }
            : { floor: _.eq(myRecord.floor), totalTurns: _.gt(0).and(_.lt(myRecord.totalTurns)) }
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAll').where(higherWhere).count(),
            myRecord.totalTurns > 0 ? db.collection('rankAll').where(sameFloorWhere).count() : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
        }
        debug.myFoundIn = 'cache'
      } else {
        // 不在前 100 条里，需要额外查询（1次DB）
        const myWhere = tierFilter
          ? _.and([{ realmTier: tierFilter }, _.or([{ uid: openid }, { _openid: openid }])])
          : _.or([{ uid: openid }, { _openid: openid }])
        const myRes = await db.collection('rankAll').where(myWhere).get()
        debug.myCount = myRes.data.length
        if (myRes.data.length > 0) {
          const my = myRes.data.sort((a, b) => {
            if (_isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns)) return -1
            return 1
          })[0]
          const higherWhere = tierFilter
            ? { realmTier: tierFilter, floor: _.gt(my.floor) }
            : { floor: _.gt(my.floor) }
          const sameFloorWhere = tierFilter
            ? { realmTier: tierFilter, floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }
            : { floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAll').where(higherWhere).count(),
            my.totalTurns > 0 ? db.collection('rankAll').where(sameFloorWhere).count() : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
          debug.myFoundIn = 'query'
        }
      }
      debug.totalMs = Date.now() - t0
      return { code: 0, list, myRank, realmTier: tierFilter, debug }
    } catch (e) {
      debug.totalMs = Date.now() - t0
      return { code: -1, msg: e.message, list: [], debug, stack: e.stack }
    }
  }

  // ===== 查询图鉴榜（精通优先；单字段 orderBy 避免缺复合索引时整段失败） =====
  if (action === 'getDex') {
    try {
      // 拉足够多的记录做内存排序：老数据里 masteredCount/collectedCount 可能缺字段，
      // 用 _.eq(0) / _.gt() 之类的 where 查询会漏掉缺字段文档，必须把所有记录拿出来按统一规则 || 0 后比较，
      // 否则"比我好的人数"会算少，导致 myRank 被误算成 1。
      const res = await db.collection('rankDex')
        .orderBy('masteredCount', 'desc')
        .limit(500)
        .get()
      const cmp = (a, b) => {
        const am = a.masteredCount || 0, bm = b.masteredCount || 0
        if (bm !== am) return bm - am
        const ac = a.collectedCount || 0, bc = b.collectedCount || 0
        if (bc !== ac) return bc - ac
        if ((b.petDexCount || 0) !== (a.petDexCount || 0)) return (b.petDexCount || 0) - (a.petDexCount || 0)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      }
      const deduped = _deduplicateByOpenid(res.data, cmp)
      const list = deduped.slice(0, 50)

      let myRank = -1
      // 先在 deduped 里找自己，找到直接用 index（和前端看到的列表顺序一致）
      const myIdxInList = deduped.findIndex(r => (r.uid === openid) || (r._openid === openid))
      if (myIdxInList >= 0) {
        myRank = myIdxInList + 1
      } else {
        // 超出 top 500 或没上榜 → 再回退查一次自己的记录，按总数估算
        const myRes = await db.collection('rankDex').where(_.or([
          { uid: openid },
          { _openid: openid }
        ])).get()
        if (myRes.data.length > 0) {
          const my = myRes.data.sort(cmp)[0]
          const betterCount = deduped.filter(r => cmp(r, my) < 0).length
          myRank = betterCount + 1
          // 注：超 500 名时这里仍是近似值，实际数据量上来后可以改为 count 查询
        }
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询连击榜 =====
  if (action === 'getCombo') {
    try {
      // 同 getDex/getStage：用内存排序，避免老数据缺 maxCombo 字段时 _.gt 漏算
      const res = await db.collection('rankCombo')
        .orderBy('maxCombo', 'desc')
        .limit(500)
        .get()
      const cmp = (a, b) => {
        if ((b.maxCombo || 0) !== (a.maxCombo || 0)) return (b.maxCombo || 0) - (a.maxCombo || 0)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      }
      const deduped = _deduplicateByOpenid(res.data, cmp)
      const list = deduped.slice(0, 50)

      let myRank = -1
      const myIdxInList = deduped.findIndex(r => (r.uid === openid) || (r._openid === openid))
      if (myIdxInList >= 0) {
        myRank = myIdxInList + 1
      } else {
        const myRes = await db.collection('rankCombo').where(_.or([
          { uid: openid },
          { _openid: openid }
        ])).get()
        if (myRes.data.length > 0) {
          const my = myRes.data.sort(cmp)[0]
          const betterCount = deduped.filter(r => cmp(r, my) < 0).length
          myRank = betterCount + 1
        }
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询通天塔周榜（本周进度） =====
  //   与 getAll 逻辑一致，但限定 periodKey = 本周；可选 realmTier 同档位
  //   自愈：若当前用户在 rankAll 有最佳记录但 rankAllWeekly 无当周记录，自动回填一条
  //         解决"周榜功能上线前已有通关但从未触发过 weekly 写入"的历史数据断层
  if (action === 'getAllWeekly') {
    const debug = {}
    const t0 = Date.now()
    const periodKey = event.periodKey || _currentPeriodKey()
    const tierFilter = event.realmTier ? _normalizeTier(event.realmTier) : null
    debug.periodKey = periodKey
    debug.tierFilter = tierFilter
    try {
      // 自愈回填：当前用户若有 rankAll 记录但当周 rankAllWeekly 无记录，先补一条
      //   注意：写失败不影响查询主流程，异常吞掉
      try {
        const weeklyMineCheck = await db.collection('rankAllWeekly')
          .where(_.and([{ periodKey }, _.or([{ uid: openid }, { _openid: openid }])]))
          .limit(1)
          .get()
        if (weeklyMineCheck.data.length === 0) {
          const mainMine = await db.collection('rankAll')
            .where(_.or([{ uid: openid }, { _openid: openid }]))
            .limit(1)
            .get()
          if (mainMine.data.length > 0 && mainMine.data[0].floor > 0) {
            const backfill = await _upsertWeekly(openid, mainMine.data[0])
            debug.backfill = backfill
            console.log('[getAllWeekly] 自愈回填:', JSON.stringify(backfill))
          }
        }
      } catch (bfErr) {
        debug.backfillErr = bfErr.message || String(bfErr)
      }

      const baseWhere = tierFilter ? { periodKey, realmTier: tierFilter } : { periodKey }
      const getRes = await db.collection('rankAllWeekly')
        .where(baseWhere)
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      debug.getCount = getRes.data.length
      debug.fetchMs = Date.now() - t0

      const records = getRes.data
      if (records.length === 0) {
        debug.totalMs = Date.now() - t0
        return { code: 0, list: [], myRank: -1, periodKey, realmTier: tierFilter, debug }
      }

      const deduped = _deduplicateByOpenid(records, _rankAllComparator)
      const list = deduped.slice(0, 50)

      let myRank = -1
      const idx = deduped.findIndex(r => (r._openid === openid || r.uid === openid))
      if (idx >= 0) {
        myRank = idx + 1
        debug.myFoundIn = 'cache'
      } else {
        const myWhere = tierFilter
          ? _.and([{ periodKey, realmTier: tierFilter }, _.or([{ uid: openid }, { _openid: openid }])])
          : _.and([{ periodKey }, _.or([{ uid: openid }, { _openid: openid }])])
        const myRes = await db.collection('rankAllWeekly').where(myWhere).get()
        if (myRes.data.length > 0) {
          const my = myRes.data.sort((a, b) => _isBetterScore(a.floor, a.totalTurns, b.floor, b.totalTurns) ? -1 : 1)[0]
          const higherWhere = tierFilter
            ? { periodKey, realmTier: tierFilter, floor: _.gt(my.floor) }
            : { periodKey, floor: _.gt(my.floor) }
          const sameFloorWhere = tierFilter
            ? { periodKey, realmTier: tierFilter, floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }
            : { periodKey, floor: _.eq(my.floor), totalTurns: _.gt(0).and(_.lt(my.totalTurns)) }
          const [higherFloor, sameFloorBetter] = await Promise.all([
            db.collection('rankAllWeekly').where(higherWhere).count(),
            my.totalTurns > 0 ? db.collection('rankAllWeekly').where(sameFloorWhere).count() : Promise.resolve({ total: 0 })
          ])
          myRank = higherFloor.total + sameFloorBetter.total + 1
          debug.myFoundIn = 'query'
        }
      }
      debug.totalMs = Date.now() - t0
      return { code: 0, list, myRank, periodKey, realmTier: tierFilter, debug }
    } catch (e) {
      debug.totalMs = Date.now() - t0
      return { code: -1, msg: e.message, list: [], periodKey, debug }
    }
  }

  // ===== 通天塔周榜领奖 · check =====
  // 返回上一周领奖状态（不消费），用于客户端首页挂件显示
  //   return: { code: 0, periodKey, rank, reward: {soulStone, uniFrag, label}, claimed: boolean, canClaim: boolean }
  if (action === 'checkWeeklyReward') {
    const periodKey = event.periodKey || _lastPeriodKey()
    try {
      const claimRes = await db.collection('weeklyReward').where({
        uid: openid, periodKey,
      }).get()
      const claimed = claimRes.data.length > 0
      const rank = await _computeWeeklyRank(openid, periodKey)
      const tier = _pickWeeklyRewardTier(rank)
      if (!tier) {
        return { code: 0, periodKey, rank: -1, reward: null, claimed, canClaim: false }
      }
      return {
        code: 0,
        periodKey,
        rank,
        reward: { soulStone: tier.soulStone, uniFrag: tier.uniFrag, label: tier.label },
        claimed,
        canClaim: !claimed,
      }
    } catch (e) {
      return { code: -1, msg: e.message, periodKey }
    }
  }

  // ===== 通天塔周榜领奖 · claim =====
  // 真正领奖（幂等，写入 weeklyReward 唯一约束 (uid, periodKey)）
  //   return: { code: 0, periodKey, rank, reward, justGranted: boolean, claimed: true }
  if (action === 'claimWeeklyReward') {
    const periodKey = event.periodKey || _lastPeriodKey()
    try {
      const rank = await _computeWeeklyRank(openid, periodKey)
      const tier = _pickWeeklyRewardTier(rank)
      if (!tier) {
        return { code: 0, periodKey, rank: -1, reward: null, justGranted: false, claimed: false }
      }
      // 去重：查是否已 claimed
      const claimRes = await db.collection('weeklyReward').where({
        uid: openid, periodKey,
      }).get()
      if (claimRes.data.length > 0) {
        return {
          code: 0,
          periodKey, rank,
          reward: { soulStone: tier.soulStone, uniFrag: tier.uniFrag, label: tier.label },
          justGranted: false,
          claimed: true,
        }
      }
      // 写 claim 记录（单条）
      await db.collection('weeklyReward').add({
        data: {
          uid: openid,
          periodKey,
          rank,
          soulStone: tier.soulStone,
          uniFrag: tier.uniFrag,
          label: tier.label,
          claimedAt: db.serverDate(),
        },
      })
      return {
        code: 0,
        periodKey, rank,
        reward: { soulStone: tier.soulStone, uniFrag: tier.uniFrag, label: tier.label },
        justGranted: true,
        claimed: true,
      }
    } catch (e) {
      return { code: -1, msg: e.message, periodKey }
    }
  }

  return { code: -1, msg: '未知操作' }
}

// 计算玩家在指定周 periodKey 的最终名次（基于 rankAllWeekly 去重后的顺序）
async function _computeWeeklyRank(openid, periodKey) {
  const getRes = await db.collection('rankAllWeekly')
    .where({ periodKey })
    .orderBy('floor', 'desc')
    .limit(100)
    .get()
  const records = getRes.data
  if (!records.length) return -1
  const deduped = _deduplicateByOpenid(records, _rankAllComparator)
  const idx = deduped.findIndex(r => (r._openid === openid || r.uid === openid))
  if (idx >= 0) return idx + 1
  // 兜底：deduped 可能只拿了 top 100，玩家可能在更深处 → 用计数 query
  const myRes = await db.collection('rankAllWeekly').where(_.and([
    { periodKey },
    _.or([{ uid: openid }, { _openid: openid }]),
  ])).get()
  if (myRes.data.length === 0) return -1
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
  return higherFloor.total + sameFloorBetter.total + 1
}

// 周榜 upsert：每周每用户一条，落后不覆盖核心成绩但更新昵称/头像
// 返回 { ok: bool, reason?: string, periodKey }，让上层调用方能在日志里看到写入结果
// （以前错误完全静默，导致"周榜集合从未建过"这种根因难以定位）
async function _upsertWeekly(openid, baseRecord) {
  const periodKey = _currentPeriodKey()
  if (!baseRecord || !baseRecord.floor || baseRecord.floor <= 0) {
    return { ok: false, reason: 'no_floor', periodKey }
  }
  const weeklyRecord = { ...baseRecord, periodKey }
  // 集合不存在时的自愈：第一次 collection-not-found 就 createCollection 后重试一次
  let retried = false
  while (true) {
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
        return { ok: true, reason: 'dedup', periodKey }
      }
      if (existing.data.length === 1) {
        const old = existing.data[0]
        if (_isBetterScore(weeklyRecord.floor, weeklyRecord.totalTurns, old.floor, old.totalTurns)) {
          await db.collection('rankAllWeekly').doc(old._id).update({ data: weeklyRecord })
          return { ok: true, reason: 'update_better', periodKey }
        } else {
          await db.collection('rankAllWeekly').doc(old._id).update({
            data: { nickName: weeklyRecord.nickName, avatarUrl: weeklyRecord.avatarUrl }
          })
          return { ok: true, reason: 'update_profile_only', periodKey }
        }
      }
      await db.collection('rankAllWeekly').add({ data: weeklyRecord })
      return { ok: true, reason: 'insert', periodKey }
    } catch (e) {
      const msg = (e && (e.message || e.errMsg)) || String(e)
      const missingCollection = !retried && /(not exist|not found|DATABASE_COLLECTION_NOT_EXIST|-502005|-501007)/i.test(msg)
      if (missingCollection) {
        console.warn('[_upsertWeekly] rankAllWeekly 不存在，尝试建集合并重试:', msg)
        try { await db.createCollection('rankAllWeekly') } catch (_) { /* 可能已在创建 */ }
        retried = true
        continue
      }
      console.error('[_upsertWeekly] 失败, periodKey=', periodKey, 'err=', msg)
      return { ok: false, reason: `exception:${msg}`, periodKey }
    }
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
    realmTier: _normalizeTier(coords && coords.realmTier),
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
async function _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo, masteredCount, collectedCount, realmTier) {
  const tier = _normalizeTier(realmTier)
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
      realmTier: tier,
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
      realmTier: tier,
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
