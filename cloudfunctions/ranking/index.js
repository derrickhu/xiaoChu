// 云函数：排行榜（提交分数 + 查询排行）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const { action } = event

  // ===== 提交/更新分数 =====
  if (action === 'submit') {
    const { nickName, avatarUrl, floor, pets, weapon } = event
    if (!floor || floor <= 0) return { code: -1, msg: '无效层数' }

    const now = new Date()
    const cnNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const today = `${cnNow.getFullYear()}-${String(cnNow.getMonth()+1).padStart(2,'0')}-${String(cnNow.getDate()).padStart(2,'0')}`

    const record = {
      nickName: nickName || '修士',
      avatarUrl: avatarUrl || '',
      floor,
      pets: (pets || []).slice(0, 5).map(p => ({ name: p.name, attr: p.attr })),
      weapon: weapon ? { name: weapon.name } : null,
      date: today,
      timestamp: db.serverDate(),
    }

    try {
      // 更新总排行（只保留最高记录）
      const existing = await db.collection('rankAll').where({ _openid: openid }).get()
      if (existing.data.length > 0) {
        const old = existing.data[0]
        if (floor > (old.floor || 0)) {
          await db.collection('rankAll').doc(old._id).update({ data: record })
        } else {
          // 即使没刷新总记录，也更新头像昵称
          await db.collection('rankAll').doc(old._id).update({
            data: { nickName: record.nickName, avatarUrl: record.avatarUrl }
          })
        }
      } else {
        await db.collection('rankAll').add({ data: record })
      }

      // 更新今日排行（每天只保留最高记录）
      const todayExist = await db.collection('rankDaily').where({ _openid: openid, date: today }).get()
      if (todayExist.data.length > 0) {
        const old = todayExist.data[0]
        if (floor > (old.floor || 0)) {
          await db.collection('rankDaily').doc(old._id).update({ data: record })
        }
      } else {
        await db.collection('rankDaily').add({ data: record })
      }

      return { code: 0, msg: '提交成功' }
    } catch (e) {
      console.error('排行榜提交失败:', e)
      return { code: -1, msg: e.message }
    }
  }

  // ===== 查询排行榜 =====
  if (action === 'getAll') {
    try {
      const res = await db.collection('rankAll')
        .orderBy('floor', 'desc')
        .limit(50)
        .get()
      // 查自己的排名
      let myRank = -1
      const myRes = await db.collection('rankAll').where({ _openid: openid }).get()
      if (myRes.data.length > 0) {
        const myFloor = myRes.data[0].floor
        const countRes = await db.collection('rankAll').where({ floor: _.gt(myFloor) }).count()
        myRank = countRes.total + 1
      }
      return { code: 0, list: res.data, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  if (action === 'getDaily') {
    const now = new Date()
    const cnNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
    const today = `${cnNow.getFullYear()}-${String(cnNow.getMonth()+1).padStart(2,'0')}-${String(cnNow.getDate()).padStart(2,'0')}`
    try {
      const res = await db.collection('rankDaily')
        .where({ date: today })
        .orderBy('floor', 'desc')
        .limit(50)
        .get()
      let myRank = -1
      const myRes = await db.collection('rankDaily').where({ _openid: openid, date: today }).get()
      if (myRes.data.length > 0) {
        const myFloor = myRes.data[0].floor
        const countRes = await db.collection('rankDaily').where({ date: today, floor: _.gt(myFloor) }).count()
        myRank = countRes.total + 1
      }
      return { code: 0, list: res.data, myRank }
    } catch (e) {
      return { code: -1, msg: e.message, list: [] }
    }
  }

  return { code: -1, msg: '未知操作' }
}
