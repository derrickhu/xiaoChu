// 云函数：排行榜（提交分数 + 查询排行）
// 支持4种排行：速通榜(all)、今日榜(daily)、图鉴榜(dex)、连击榜(combo)
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

    const now = new Date()
    const cnNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const today = `${cnNow.getFullYear()}-${String(cnNow.getMonth()+1).padStart(2,'0')}-${String(cnNow.getDate()).padStart(2,'0')}`

    const baseRecord = {
      nickName: nickName || '修士',
      avatarUrl: avatarUrl || '',
      floor,
      pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
      weapon: weapon ? { name: weapon.name } : null,
      totalTurns: totalTurns || 0,
      date: today,
      timestamp: db.serverDate(),
    }

    try {
      // 更新总排行/速通榜（通关者按回合数升序，未通关按层数降序）
      const existing = await db.collection('rankAll').where({ _openid: openid }).get()
      if (existing.data.length > 0) {
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

      // 更新今日排行
      const todayExist = await db.collection('rankDaily').where({ _openid: openid, date: today }).get()
      if (todayExist.data.length > 0) {
        const old = todayExist.data[0]
        const isBetter = _isBetterScore(floor, totalTurns, old.floor, old.totalTurns)
        if (isBetter) {
          await db.collection('rankDaily').doc(old._id).update({ data: baseRecord })
        }
      } else {
        await db.collection('rankDaily').add({ data: baseRecord })
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
  if (action === 'getAll') {
    try {
      // 先按floor降序，通关者（floor>=30）再按totalTurns升序
      // 云数据库不支持复杂排序，先取所有通关者+未通关者分开排
      const cleared = await db.collection('rankAll')
        .where({ floor: _.gte(30) })
        .orderBy('totalTurns', 'asc')
        .limit(50)
        .get()
      const notCleared = await db.collection('rankAll')
        .where({ floor: _.lt(30) })
        .orderBy('floor', 'desc')
        .limit(50)
        .get()
      const list = [...cleared.data, ...notCleared.data].slice(0, 50)

      // 查自己的排名
      let myRank = -1
      const myRes = await db.collection('rankAll').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const my = myRes.data[0]
        if (my.floor >= 30 && my.totalTurns > 0) {
          // 通关者：排在所有通关且回合更少的人后面
          const betterCount = await db.collection('rankAll').where({
            floor: _.gte(30),
            totalTurns: _.gt(0).and(_.lt(my.totalTurns))
          }).count()
          myRank = betterCount.total + 1
        } else {
          // 未通关者：排在所有通关者后面 + 层数更高的未通关者后面
          const clearedCount = await db.collection('rankAll').where({ floor: _.gte(30) }).count()
          const higherCount = await db.collection('rankAll').where({
            floor: _.lt(30).and(_.gt(my.floor))
          }).count()
          myRank = clearedCount.total + higherCount.total + 1
        }
      }
      return { code: 0, list, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询今日排行 =====
  if (action === 'getDaily') {
    const now = new Date()
    const cnNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const today = `${cnNow.getFullYear()}-${String(cnNow.getMonth()+1).padStart(2,'0')}-${String(cnNow.getDate()).padStart(2,'0')}`
    try {
      const cleared = await db.collection('rankDaily')
        .where({ date: today, floor: _.gte(30) })
        .orderBy('totalTurns', 'asc')
        .limit(50)
        .get()
      const notCleared = await db.collection('rankDaily')
        .where({ date: today, floor: _.lt(30) })
        .orderBy('floor', 'desc')
        .limit(50)
        .get()
      const list = [...cleared.data, ...notCleared.data].slice(0, 50)

      let myRank = -1
      const myRes = await db.collection('rankDaily').where({ _openid: openid, date: today }).get()
      if (myRes.data.length > 0) {
        const my = myRes.data[0]
        if (my.floor >= 30 && my.totalTurns > 0) {
          const betterCount = await db.collection('rankDaily').where({
            date: today, floor: _.gte(30),
            totalTurns: _.gt(0).and(_.lt(my.totalTurns))
          }).count()
          myRank = betterCount.total + 1
        } else {
          const clearedCount = await db.collection('rankDaily').where({ date: today, floor: _.gte(30) }).count()
          const higherCount = await db.collection('rankDaily').where({
            date: today, floor: _.lt(30).and(_.gt(my.floor))
          }).count()
          myRank = clearedCount.total + higherCount.total + 1
        }
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
        .limit(50)
        .get()
      let myRank = -1
      const myRes = await db.collection('rankDex').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const myCount = myRes.data[0].petDexCount
        const betterCount = await db.collection('rankDex').where({ petDexCount: _.gt(myCount) }).count()
        myRank = betterCount.total + 1
      }
      return { code: 0, list: res.data, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  // ===== 查询连击榜 =====
  if (action === 'getCombo') {
    try {
      const res = await db.collection('rankCombo')
        .orderBy('maxCombo', 'desc')
        .limit(50)
        .get()
      let myRank = -1
      const myRes = await db.collection('rankCombo').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const myCombo = myRes.data[0].maxCombo
        const betterCount = await db.collection('rankCombo').where({ maxCombo: _.gt(myCombo) }).count()
        myRank = betterCount.total + 1
      }
      return { code: 0, list: res.data, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  return { code: -1, msg: '未知操作' }
}

// 判断新成绩是否优于旧成绩
function _isBetterScore(newFloor, newTurns, oldFloor, oldTurns) {
  // 通关 > 未通关
  if (newFloor >= 30 && oldFloor < 30) return true
  if (newFloor < 30 && oldFloor >= 30) return false
  // 都通关：回合数更少更好
  if (newFloor >= 30 && oldFloor >= 30) {
    if (newTurns > 0 && oldTurns > 0) return newTurns < oldTurns
    if (newTurns > 0) return true
    return false
  }
  // 都未通关：层数更高更好
  return newFloor > oldFloor
}

// 更新图鉴榜和连击榜
async function _updateDexCombo(openid, nickName, avatarUrl, petDexCount, maxCombo) {
  // 图鉴榜
  if (petDexCount > 0) {
    const dexExist = await db.collection('rankDex').where({ _openid: openid }).get()
    const dexRecord = {
      nickName, avatarUrl, petDexCount,
      timestamp: db.serverDate(),
    }
    if (dexExist.data.length > 0) {
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
    if (comboExist.data.length > 0) {
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
