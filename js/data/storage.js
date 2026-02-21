/**
 * 存储管理 — 灵宠消消塔
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
      bestFloorWeapon: null, // 最高层时的法宝
    },
    settings: {
      bgmOn: true,
      sfxOn: true,
    },
    petDex: [],  // 图鉴：历史收集到3星的宠物ID列表
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
    // 用户信息（微信授权）
    this.userInfo = null      // { nickName, avatarUrl }
    this.userAuthorized = false
    // 排行榜缓存
    this.rankAllList = []
    this.rankDailyList = []
    this.rankAllMyRank = -1
    this.rankDailyMyRank = -1
    this.rankLoading = false
    this.rankLastFetch = 0    // 上次拉取时间戳
    this._load()
    this._loadUserInfo()
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
      this._d.stats.bestFloorWeapon = weapon ? { name: weapon.name } : null
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

  // 图鉴：记录收集到3星的宠物
  get petDex()    { return this._d.petDex || [] }
  addPetDex(petId) {
    if (!this._d.petDex) this._d.petDex = []
    if (!this._d.petDex.includes(petId)) {
      this._d.petDex.push(petId)
      this._save()
    }
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
  _loadUserInfo() {
    try {
      const raw = wx.getStorageSync('wxtower_userinfo')
      if (raw) {
        this.userInfo = JSON.parse(raw)
        this.userAuthorized = true
      }
    } catch(e) {}
  }

  _saveUserInfo(info) {
    this.userInfo = info
    this.userAuthorized = true
    try { wx.setStorageSync('wxtower_userinfo', JSON.stringify(info)) } catch(e) {}
  }

  // 微信用户信息授权（头像+昵称）
  requestUserInfo(callback) {
    // 微信小游戏使用 wx.getUserInfo（需用户主动触发）
    // 这里通过 wx.createUserInfoButton 实现
    // 但 canvas 游戏中无法直接用 button，所以用 getUserProfile
    wx.getUserProfile({
      desc: '用于排行榜展示',
      success: (res) => {
        const info = {
          nickName: res.userInfo.nickName,
          avatarUrl: res.userInfo.avatarUrl,
        }
        this._saveUserInfo(info)
        if (callback) callback(true, info)
      },
      fail: (err) => {
        console.warn('用户拒绝授权:', err)
        // getUserProfile 不支持时，尝试 getUserInfo
        wx.getUserInfo({
          success: (res2) => {
            const info = {
              nickName: res2.userInfo.nickName,
              avatarUrl: res2.userInfo.avatarUrl,
            }
            this._saveUserInfo(info)
            if (callback) callback(true, info)
          },
          fail: () => {
            if (callback) callback(false, null)
          }
        })
      }
    })
  }

  // ===== 排行榜 =====
  // 提交分数到排行榜
  async submitScore(floor, pets, weapon) {
    if (!this._cloudReady || !this.userAuthorized) return
    try {
      await wx.cloud.callFunction({
        name: 'ranking',
        data: {
          action: 'submit',
          nickName: this.userInfo.nickName,
          avatarUrl: this.userInfo.avatarUrl,
          floor,
          pets: (pets || []).map(p => ({ name: p.name, attr: p.attr })),
          weapon: weapon ? { name: weapon.name } : null,
        }
      })
    } catch(e) {
      console.warn('[Ranking] 提交失败:', e)
    }
  }

  // 拉取排行榜（带30秒缓存）
  async fetchRanking(tab, force) {
    const now = Date.now()
    if (!force && now - this.rankLastFetch < 30000 && (tab === 'all' ? this.rankAllList.length : this.rankDailyList.length) > 0) {
      return // 30秒内不重复拉取
    }
    if (this.rankLoading) return
    this.rankLoading = true
    try {
      const action = tab === 'all' ? 'getAll' : 'getDaily'
      const r = await wx.cloud.callFunction({ name: 'ranking', data: { action } })
      if (r.result && r.result.code === 0) {
        if (tab === 'all') {
          this.rankAllList = r.result.list || []
          this.rankAllMyRank = r.result.myRank || -1
        } else {
          this.rankDailyList = r.result.list || []
          this.rankDailyMyRank = r.result.myRank || -1
        }
        this.rankLastFetch = now
      }
    } catch(e) {
      console.warn('[Ranking] 拉取失败:', e)
    }
    this.rankLoading = false
  }

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
