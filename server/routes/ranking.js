/**
 * 排行榜接口 — 速通榜/图鉴榜/连击榜
 * 字段命名与微信云函数保持一致：floor, totalTurns, petDexCount, maxCombo
 */
const express = require('express')
const { getDb } = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

// POST /api/ranking/submit — 提交/更新分数（支持 submit 和 submitDexCombo）
router.post('/submit', async (req, res) => {
  const { action, nickName, avatarUrl, floor, pets, weapon, totalTurns, petDexCount, maxCombo } = req.body

  try {
    const col = (await getDb()).collection('rankings')
    const filter = {
      platform: req.userPlatform,
      platformOpenId: req.userOpenId,
    }

    const existing = await col.findOne(filter)

    if (action === 'submitDexCombo') {
      const update = {
        $set: {
          ...filter,
          nickName: nickName || '修士',
          avatarUrl: avatarUrl || '',
          petDexCount: petDexCount || 0,
          maxCombo: maxCombo || 0,
          updatedAt: Date.now(),
        },
      }
      if (existing) {
        update.$set.petDexCount = Math.max(existing.petDexCount || 0, petDexCount || 0)
        update.$set.maxCombo = Math.max(existing.maxCombo || 0, maxCombo || 0)
      }
      await col.updateOne(filter, update, { upsert: true })
      return res.json({ code: 0, msg: '提交成功' })
    }

    // action === 'submit' 或默认
    const record = {
      ...filter,
      nickName: nickName || '修士',
      avatarUrl: avatarUrl || '',
      floor: floor || 0,
      pets: (pets || []).slice(0, 5),
      weapon: weapon || null,
      totalTurns: totalTurns || 0,
      petDexCount: petDexCount || 0,
      maxCombo: maxCombo || 0,
      updatedAt: Date.now(),
    }

    if (existing) {
      // 速通榜：只保留更优成绩
      if (_isBetterScore(record.floor, record.totalTurns, existing.floor || 0, existing.totalTurns || 0)) {
        await col.updateOne(filter, { $set: record })
      } else {
        // 成绩没变好，但更新昵称头像 + 图鉴/连击
        await col.updateOne(filter, { $set: {
          nickName: record.nickName,
          avatarUrl: record.avatarUrl,
          petDexCount: Math.max(existing.petDexCount || 0, record.petDexCount),
          maxCombo: Math.max(existing.maxCombo || 0, record.maxCombo),
          updatedAt: Date.now(),
        }})
      }
    } else {
      await col.insertOne(record)
    }

    res.json({ code: 0, msg: '提交成功' })
  } catch (e) {
    console.error('[Ranking] submit error:', e.message)
    res.json({ code: -1, msg: e.message })
  }
})

// GET /api/ranking/list?tab=all|dex|combo&limit=100 — 拉取排行榜
//   默认 100 条，和云函数 LIST_SIZE 对齐；上限 200 防止误传超大 limit 打爆 db
router.get('/list', async (req, res) => {
  const tab = req.query.tab || 'all'
  const limit = Math.min(parseInt(req.query.limit) || 100, 200)

  const sortMap = {
    all:   { floor: -1, totalTurns: 1, updatedAt: -1 },
    dex:   { petDexCount: -1, updatedAt: -1 },
    combo: { maxCombo: -1, updatedAt: -1 },
  }
  const sort = sortMap[tab] || sortMap.all

  try {
    const col = (await getDb()).collection('rankings')
    const list = await col.find({})
      .sort(sort)
      .limit(limit)
      .project({ _id: 0, platformOpenId: 0, platform: 0 })
      .toArray()

    // 查找当前用户排名
    let myRank = -1
    const myDoc = await col.findOne({
      platform: req.userPlatform,
      platformOpenId: req.userOpenId,
    })
    if (myDoc) {
      const sortField = tab === 'dex' ? 'petDexCount' : tab === 'combo' ? 'maxCombo' : 'floor'
      const myVal = myDoc[sortField] || 0
      if (sortField === 'floor') {
        // 速通榜：层数更高 或 同层回合更少 → 排名更前
        const higherFloor = await col.countDocuments({ floor: { $gt: myVal } })
        const myTurns = myDoc.totalTurns || 0
        let sameFloorBetter = 0
        if (myTurns > 0) {
          sameFloorBetter = await col.countDocuments({
            floor: myVal,
            totalTurns: { $gt: 0, $lt: myTurns },
          })
        }
        myRank = higherFloor + sameFloorBetter + 1
      } else {
        myRank = await col.countDocuments({ [sortField]: { $gt: myVal } }) + 1
      }
    }

    res.json({ code: 0, list, myRank })
  } catch (e) {
    console.error('[Ranking] list error:', e.message)
    res.json({ code: -1, msg: e.message })
  }
})

function _isBetterScore(newFloor, newTurns, oldFloor, oldTurns) {
  if (newFloor >= 30 && oldFloor < 30) return true
  if (newFloor < 30 && oldFloor >= 30) return false
  if (newFloor >= 30 && oldFloor >= 30) {
    if (newTurns > 0 && oldTurns > 0) return newTurns < oldTurns
    if (newTurns > 0) return true
    return false
  }
  return newFloor > oldFloor
}

module.exports = router
