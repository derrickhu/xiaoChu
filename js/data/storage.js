/**
 * 存储管理 — 五行通天塔
 * Roguelike：无局外养成，死亡即重开
 * 仅持久化：最高层数记录 + 统计 + 设置
 * 本地缓存 + 云数据库双重存储
 */

const LOCAL_KEY = 'wxtower_v1'
const CLOUD_ENV = 'cloud1-9glro17fb6f566a8'

// 持久化数据（跨局保留）
function defaultPersist() {
  return {
    bestFloor: 0,         // 历史最高层数
    totalRuns: 0,         // 总挑战次数
    stats: {
      totalBattles: 0,
      totalCombos: 0,
      maxCombo: 0,
      bestFloorPets: [],  // 最高层时的宠物阵容
      bestFloorWeapon: null,
    },
    settings: {
      bgmOn: true,
      sfxOn: true,
    },
  }
}

class Storage {
  constructor() {
    this._d = null          // 持久化数据
    this._cloudReady = false
    this._openid = ''
    this._cloudSyncTimer = null
    this._cloudInitDone = false
    this._pendingSync = false
    this.onCloudReady = null
    this._load()
    this._initCloud()
  }

  // ===== 持久化数据访问 =====
  get bestFloor()   { return this._d.bestFloor }
  get totalRuns()   { return this._d.totalRuns }
  get stats()       { return this._d.stats }
  get settings()    { return this._d.settings }

  // 更新最高层数
  updateBestFloor(floor, pets, weapon) {
    if (floor > this._d.bestFloor) {
      this._d.bestFloor = floor
      this._d.stats.bestFloorPets = (pets || []).map(p => ({ name: p.name, attr: p.attr, atk: p.atk }))
      this._d.stats.bestFloorWeapon = weapon ? { name: weapon.name, attr: weapon.attr } : null
    }
    this._d.totalRuns++
    this._save()
  }

  // 记录战斗统计
  recordBattle(combo) {
    this._d.stats.totalBattles++
    this._d.stats.totalCombos += combo
    this._d.stats.maxCombo = Math.max(this._d.stats.maxCombo, combo)
    this._save()
  }

  // 设置
  toggleBgm() {
    this._d.settings.bgmOn = !this._d.settings.bgmOn
    this._save()
    return this._d.settings.bgmOn
  }
  toggleSfx() {
    this._d.settings.sfxOn = !this._d.settings.sfxOn
    this._save()
    return this._d.settings.sfxOn
  }

  // ===== 局内暂存（暂存退出用）=====
  saveRunState(runState) {
    this._d.savedRun = runState
    this._save()
  }

  loadRunState() {
    return this._d.savedRun || null
  }

  clearRunState() {
    delete this._d.savedRun
    this._save()
  }

  hasSavedRun() {
    return !!this._d.savedRun
  }

  // 彻底重置
  async resetAll() {
    this._d = defaultPersist()
    try { wx.removeStorageSync(LOCAL_KEY) } catch(e) {}
    this._save()
    if (this._cloudReady && this._openid) {
      try {
        const db = wx.cloud.database()
        const res = await db.collection('playerData').where({ _openid: this._openid }).get()
        if (res.data && res.data.length > 0) {
          await db.collection('playerData').doc(res.data[0]._id).remove()
        }
      } catch(e) { console.warn('[Storage] 云端重置失败:', e) }
    }
    return true
  }

  // ===== 本地存储 =====
  _load() {
    try {
      const raw = wx.getStorageSync(LOCAL_KEY)
      if (raw) {
        this._d = JSON.parse(raw)
        const def = defaultPersist()
        Object.keys(def).forEach(k => {
          if (this._d[k] === undefined) this._d[k] = def[k]
        })
      } else {
        this._d = defaultPersist()
      }
    } catch(e) {
      console.warn('Storage load error:', e)
      this._d = defaultPersist()
    }
  }

  _save() {
    try {
      wx.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
      this._debounceSyncToCloud()
    } catch(e) {
      console.warn('Storage save error:', e)
    }
  }

  // ===== 云同步 =====
  _debounceSyncToCloud() {
    if (!this._cloudInitDone) {
      this._pendingSync = true
      return
    }
    if (this._cloudSyncTimer) clearTimeout(this._cloudSyncTimer)
    this._cloudSyncTimer = setTimeout(() => {
      this._cloudSyncTimer = null
      this._syncToCloud()
    }, 2000)
  }

  async _initCloud() {
    try {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
      this._cloudReady = true
    } catch(e) {
      console.warn('Cloud init failed:', e)
      return
    }
    try { await this._ensureCollections() } catch(e) {}
    try { await this._getOpenid() } catch(e) { console.warn('Get openid failed:', e) }
    if (this._openid) await this._syncFromCloud()
    this._cloudInitDone = true
    if (typeof this.onCloudReady === 'function') {
      try { this.onCloudReady() } catch(e) {}
    }
    if (this._pendingSync) {
      this._pendingSync = false
      this._syncToCloud()
    }
  }

  async _ensureCollections() {
    const r = await wx.cloud.callFunction({ name: 'initCollections' })
    if (r.result && r.result.errors && r.result.errors.length) {
      console.warn('创建集合异常:', r.result.errors)
    }
  }

  async _getOpenid() {
    const r = await wx.cloud.callFunction({ name: 'getOpenid' })
    this._openid = (r.result && r.result.openid) || ''
  }

  async _syncFromCloud() {
    if (!this._cloudReady || !this._openid) return
    try {
      const db = wx.cloud.database()
      const res = await db.collection('playerData').where({ _openid: this._openid }).get()
      if (res.data && res.data.length > 0) {
        const cloud = res.data[0]
        const cloudTime = cloud._updateTime || 0
        const localTime = this._d._updateTime || 0
        if (cloudTime > localTime) {
          delete cloud._id
          delete cloud._openid
          Object.assign(this._d, cloud)
          wx.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
        }
      }
    } catch(e) { console.warn('Sync from cloud error:', e) }
  }

  async _syncToCloud() {
    if (!this._cloudReady || !this._openid) return
    try {
      const db = wx.cloud.database()
      const col = db.collection('playerData')
      const res = await col.where({ _openid: this._openid }).get()
      const saveData = { ...this._d, _updateTime: Date.now() }
      delete saveData._id
      delete saveData._openid
      if (res.data && res.data.length > 0) {
        await col.doc(res.data[0]._id).update({ data: saveData })
      } else {
        await col.add({ data: saveData })
      }
    } catch(e) {
      console.warn('[Storage] 云同步失败:', e.message || e)
    }
  }
}

module.exports = Storage
