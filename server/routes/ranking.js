/**
 * 排行榜接口 — 通关榜/图鉴榜/连击榜
 */
const express = require('express')
const { getDb } = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

// POST /api/ranking/submit — 提交/更新排行榜分数
router.post('/submit', async (req, res) => {
  const { nickName, avatarUrl, bestFloor, petDexCount, maxCombo, bestTotalTurns, pets, weapon } = req.body

  try {
    const col = getDb().collection('rankings')
    const filter = {
      platform: req.userPlatform,
      platformOpenId: req.userOpenId,
    }

    const update = {
      $set: {
        ...filter,
        nickName: nickName || '冒险者',
        avatarUrl: avatarUrl || '',
        bestFloor: bestFloor || 0,
        petDexCount: petDexCount || 0,
        maxCombo: maxCombo || 0,
        bestTotalTurns: bestTotalTurns || 0,
        pets: pets || [],
        weapon: weapon || null,
        updatedAt: Date.now(),
      },
    }

    // 只允许分数变好，不允许变差
    const existing = await col.findOne(filter)
    if (existing) {
      const s = update.$set
      s.bestFloor = Math.max(existing.bestFloor || 0, s.bestFloor)
      s.petDexCount = Math.max(existing.petDexCount || 0, s.petDexCount)
      s.maxCombo = Math.max(existing.maxCombo || 0, s.maxCombo)
      if ((existing.bestTotalTurns || 0) > 0 && s.bestTotalTurns > 0) {
        s.bestTotalTurns = Math.min(existing.bestTotalTurns, s.bestTotalTurns)
      } else {
        s.bestTotalTurns = existing.bestTotalTurns || s.bestTotalTurns || 0
      }
    }

    await col.updateOne(filter, update, { upsert: true })
    res.json({ code: 0, msg: 'ok' })
  } catch (e) {
    console.error('[Ranking] submit error:', e.message)
    res.json({ code: -1, msg: e.message })
  }
})

// GET /api/ranking/list?tab=all|dex|combo&limit=50 — 拉取排行榜
router.get('/list', async (req, res) => {
  const tab = req.query.tab || 'all'
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)

  const sortMap = {
    all:   { bestFloor: -1, bestTotalTurns: 1, updatedAt: -1 },
    dex:   { petDexCount: -1, updatedAt: -1 },
    combo: { maxCombo: -1, updatedAt: -1 },
  }
  const sort = sortMap[tab] || sortMap.all

  try {
    const col = getDb().collection('rankings')
    const list = await col.find({})
      .sort(sort)
      .limit(limit)
      .project({ _id: 0, platformOpenId: 0 })
      .toArray()

    // 查找当前用户排名
    let myRank = -1
    const myDoc = await col.findOne({
      platform: req.userPlatform,
      platformOpenId: req.userOpenId,
    })
    if (myDoc) {
      const sortField = tab === 'dex' ? 'petDexCount' : tab === 'combo' ? 'maxCombo' : 'bestFloor'
      const myVal = myDoc[sortField] || 0
      myRank = await col.countDocuments({ [sortField]: { $gt: myVal } }) + 1
    }

    res.json({ code: 0, list, myRank })
  } catch (e) {
    console.error('[Ranking] list error:', e.message)
    res.json({ code: -1, msg: e.message })
  }
})

module.exports = router
