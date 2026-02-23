// 云函数：排行榜（提交分数 + 查询排行）
// 支持3种排行：速通榜(all)、图鉴榜(dex)、连击榜(combo)
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  // ===== 提交/更新分数（通关时调用）=====
  if (action === 'submit') {
    const { nickName, avatarUrl, floor, pets, weapon, totalTurns, petDexCount, maxCombo } = event
    if (!floor || floor <= 0) return { code: -1, msg: '无效层数' }

    const baseRecord = {
      nickName: nickName || '修士',
      avatarUrl: avatarUrl || '',
      floor,
      pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
      weapon: weapon ? { name: weapon.name } : null,
      totalTurns: totalTurns || 0,
      timestamp: db.serverDate(),
    }

    try {
      // 更新总排行/速通榜（通关者按回合数升序，未通关按层数降序）
      const existing = await db.collection('rankAll').where({ _openid: openid }).get()
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

      // 同时更新图鉴榜和连击榜
      await _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo)

      return { code: 0, msg: '提交成功' }
    } catch (e) {
      console.error('排行榜提交失败:', e)
      return { code: -1, msg: e.message }
    }
  }

  // ===== 单独提交图鉴/连击（非通关时）=====
  if (action === 'submitDexCombo') {
    const { nickName, avatarUrl, petDexCount, maxCombo } = event
    try {
      await _updateDexCombo(openid, nickName || '修士', avatarUrl || '', petDexCount, maxCombo)
      return { code: 0, msg: '提交成功' }
    } catch (e) {
      return { code: -1, msg: e.message }
    }
  }

  // ===== 查询速通榜（总排行）=====
  // 排序规则：层数高的在前，层数相同时回合数少的在前，都相同时更新时间靠后的在前
  if (action === 'getAll') {
    try {
      // 云数据库不支持多字段混合排序，取全部后在内存中排序
      const res = await db.collection('rankAll')
        .orderBy('floor', 'desc')
        .limit(100)
        .get()
      // 按 _openid 去重：同一用户保留最佳记录
      const deduped = _deduplicateByOpenid(res.data, (a, b) => {
        if (a.floor !== b.floor) return b.floor - a.floor
        const aT = a.totalTurns || 0, bT = b.totalTurns || 0
        if (aT !== bT) {
          if (aT > 0 && bT > 0) return aT - bT
          if (aT > 0) return -1
          if (bT > 0) return 1
        }
        // 层数和回合都相同：更新时间靠后的在前
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      const list = deduped.slice(0, 50)

      // 查自己的排名
      let myRank = -1
      const myRes = await db.collection('rankAll').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const my = myRes.data[0]
        // 比自己成绩好的：层数更高的 + 层数相同但回合更少的
        const higherFloor = await db.collection('rankAll').where({
          floor: _.gt(my.floor)
        }).count()
        let sameFloorBetter = { total: 0 }
        if (my.totalTurns > 0) {
          sameFloorBetter = await db.collection('rankAll').where({
            floor: _.eq(my.floor),
            totalTurns: _.gt(0).and(_.lt(my.totalTurns))
          }).count()
        }
        myRank = higherFloor.total + sameFloorBetter.total + 1
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询图鉴榜 =====
  if (action === 'getDex') {
    try {
      const res = await db.collection('rankDex')
        .orderBy('petDexCount', 'desc')
        .limit(100)
        .get()
      // 按 _openid 去重：同一用户保留图鉴数最高的
      const deduped = _deduplicateByOpenid(res.data, (a, b) => {
        if ((b.petDexCount || 0) !== (a.petDexCount || 0)) return (b.petDexCount || 0) - (a.petDexCount || 0)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      const list = deduped.slice(0, 50)

      let myRank = -1
      const myRes = await db.collection('rankDex').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const myCount = myRes.data[0].petDexCount
        const betterCount = await db.collection('rankDex').where({ petDexCount: _.gt(myCount) }).count()
        myRank = betterCount.total + 1
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
      // 按 _openid 去重：同一用户保留最高连击的
      const deduped = _deduplicateByOpenid(res.data, (a, b) => {
        if ((b.maxCombo || 0) !== (a.maxCombo || 0)) return (b.maxCombo || 0) - (a.maxCombo || 0)
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
        return bTime - aTime
      })
      const list = deduped.slice(0, 50)

      let myRank = -1
      const myRes = await db.collection('rankCombo').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const myCombo = myRes.data[0].maxCombo
        const betterCount = await db.collection('rankCombo').where({ maxCombo: _.gt(myCombo) }).count()
        myRank = betterCount.total + 1
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  return { code: -1, msg: '未知操作' }
}

// 按 _openid 去重：同一用户只保留最佳记录（由 compareFn 决定排序）
function _deduplicateByOpenid(records, compareFn) {
  const map = {}
  for (const r of records) {
    const key = r._openid
    if (!key) continue
    if (!map[key]) {
      map[key] = r
    } else {
      // compareFn 返回 <0 表示 a 更好
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

// 更新图鉴榜和连击榜（带去重逻辑）
async function _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo) {
  // 图鉴榜
  if (petDexCount > 0) {
    const dexExist = await db.collection('rankDex').where({ _openid: openid }).get()
    const dexRecord = {
      nickName, avatarUrl, petDexCount,
      timestamp: db.serverDate(),
    }
    if (dexExist.data.length > 1) {
      // 去重
      const sorted = dexExist.data.sort((a, b) => (b.petDexCount || 0) - (a.petDexCount || 0))
      for (let i = 1; i < sorted.length; i++) {
        await db.collection('rankDex').doc(sorted[i]._id).remove()
      }
      if (petDexCount >= (sorted[0].petDexCount || 0)) {
        await db.collection('rankDex').doc(sorted[0]._id).update({ data: dexRecord })
      } else {
        await db.collection('rankDex').doc(sorted[0]._id).update({ data: { nickName, avatarUrl } })
      }
    } else if (dexExist.data.length === 1) {
      if (petDexCount >= (dexExist.data[0].petDexCount || 0)) {
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
    const comboExist = await db.collection('rankCombo').where({ _openid: openid }).get()
    const comboRecord = {
      nickName, avatarUrl, maxCombo,
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
