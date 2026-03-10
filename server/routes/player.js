/**
 * 玩家数据接口 — 云存档同步
 */
const express = require('express')
const { getDb } = require('../db')
const authMiddleware = require('../middleware/auth')
const router = express.Router()

router.use(authMiddleware)

// GET /api/player/data — 拉取云端存档
router.get('/data', async (req, res) => {
  try {
    const col = (await getDb()).collection('players')
    const doc = await col.findOne({
      platform: req.userPlatform,
      platformOpenId: req.userOpenId,
    })
    res.json({ code: 0, data: doc || null })
  } catch (e) {
    console.error('[Player] get data error:', e.message)
    res.json({ code: -1, msg: e.message })
  }
})

// POST /api/player/sync — 上传本地存档，与云端合并
router.post('/sync', async (req, res) => {
  const localData = req.body.data
  if (!localData) return res.json({ code: -1, msg: 'missing data' })

  try {
    const col = (await getDb()).collection('players')
    const filter = {
      platform: req.userPlatform,
      platformOpenId: req.userOpenId,
    }

    const existing = await col.findOne(filter)

    if (!existing) {
      // 首次同步，直接写入
      await col.insertOne({
        ...filter,
        ...localData,
        updatedAt: Date.now(),
      })
      return res.json({ code: 0, data: localData, action: 'created' })
    }

    // 合并策略：数值字段取较优值
    const merged = _mergePlayerData(existing, localData)
    merged.updatedAt = Date.now()

    await col.updateOne(filter, { $set: merged })
    res.json({ code: 0, data: merged, action: 'merged' })
  } catch (e) {
    console.error('[Player] sync error:', e.message)
    res.json({ code: -1, msg: e.message })
  }
})

function _mergePlayerData(cloud, local) {
  const result = { ...cloud, ...local }
  // 数值字段取较优值
  result.bestFloor = Math.max(cloud.bestFloor || 0, local.bestFloor || 0)
  result.totalRuns = Math.max(cloud.totalRuns || 0, local.totalRuns || 0)
  if (result.stats) {
    result.stats.maxCombo = Math.max(cloud.stats?.maxCombo || 0, local.stats?.maxCombo || 0)
    result.stats.totalBattles = Math.max(cloud.stats?.totalBattles || 0, local.stats?.totalBattles || 0)
    if ((cloud.stats?.bestTotalTurns || 0) > 0 && (local.stats?.bestTotalTurns || 0) > 0) {
      result.stats.bestTotalTurns = Math.min(cloud.stats.bestTotalTurns, local.stats.bestTotalTurns)
    } else {
      result.stats.bestTotalTurns = cloud.stats?.bestTotalTurns || local.stats?.bestTotalTurns || 0
    }
  }
  // 图鉴取并集
  const cloudDex = new Set(cloud.petDex || [])
  const localDex = new Set(local.petDex || [])
  result.petDex = [...new Set([...cloudDex, ...localDex])]
  // 不覆盖 _id 和平台标识
  delete result._id
  return result
}

module.exports = router
