// 云函数：每日/每周重置（定时触发 + 主动调用）
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const now = new Date()
  // UTC+8时区
  const cnNow = new Date(now.getTime() + 8 * 60 * 60 * 1000)
  const today = `${cnNow.getFullYear()}-${cnNow.getMonth()+1}-${cnNow.getDate()}`
  const day = cnNow.getDay() // 0=周日，1=周一

  try {
    // 如果是定时触发，批量重置所有玩家
    if (!event.openid) {
      const allPlayers = await db.collection('playerData').limit(1000).get()
      let resetCount = 0
      for (const player of allPlayers.data) {
        const updates = {}
        // 每日任务重置
        if (!player.dailyTask || player.dailyTask.lastReset !== today) {
          updates.dailyTask = {
            tasks: [false, false, false],
            rewardGot: false,
            lastReset: today,
            comboChallengeCount: 0,
            levelChallengeCount: 0
          }
        }
        // 每周一重置周回挑战
        if (day === 1 && (!player.weeklyChallenge || player.weeklyChallenge.lastReset !== today)) {
          updates.weeklyChallenge = {
            count: 3,
            bestCombo: 0,
            lastReset: today,
            weeklyLevelId: Math.floor(Math.random() * 8) + 1
          }
        }
        if (Object.keys(updates).length > 0) {
          await db.collection('playerData').doc(player._id).update({ data: updates })
          resetCount++
        }
      }
      return { code: 0, msg: `批量重置完成，重置${resetCount}个玩家` }
    }

    // 单个玩家主动调用
    const openid = event.openid
    const res = await db.collection('playerData').where({ openid }).get()
    if (res.data.length === 0) return { code: -1, msg: '玩家数据不存在' }

    const player = res.data[0]
    const updates = {}

    // 每日任务重置
    if (!player.dailyTask || player.dailyTask.lastReset !== today) {
      updates.dailyTask = {
        tasks: [false, false, false],
        rewardGot: false,
        lastReset: today,
        comboChallengeCount: 0,
        levelChallengeCount: 0
      }
    }

    // 每周一重置周回挑战
    if (day === 1 && (!player.weeklyChallenge || player.weeklyChallenge.lastReset !== today)) {
      updates.weeklyChallenge = {
        count: 3,
        bestCombo: 0,
        lastReset: today,
        weeklyLevelId: Math.floor(Math.random() * 8) + 1
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('playerData').doc(player._id).update({ data: updates })
      Object.assign(player, updates)
    }

    return { code: 0, msg: '重置成功', progress: player }
  } catch (err) {
    console.error('云函数重置失败：', err)
    return { code: -1, msg: '重置失败', err: err.message }
  }
}
