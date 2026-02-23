/**
 * 存储管理 — 灵宠消消塔
 * Roguelike：无局外养成，死亡即重开
 * 仅持久化：最高层数记录 + 统计 + 设置
 * 本地缓存 + 云数据库双重存储
 */

const LOCAL_KEY = 'wxtower_v1'
const CLOUD_ENV = 'cloud1-6g8y0x2i39e768eb'

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
    petDexSeen: [],  // 图鉴：已查看过详情的宠物ID列表
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
    this.rankDexList = []
    this.rankComboList = []
    this.rankAllMyRank = -1
    this.rankDexMyRank = -1
    this.rankComboMyRank = -1
    this.rankLoading = false
    this.rankLastFetch = 0    // 上次拉取时间戳
    this.rankLastFetchTab = '' // 上次拉取的tab
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
  updateBestFloor(floor, pets, weapon, totalTurns) {
    if (floor > this._d.bestFloor) {
      this._d.bestFloor = floor
      this._d.stats.bestFloorPets = (pets || []).map(p => ({ name: p.name, attr: p.attr, atk: p.atk }))
      this._d.stats.bestFloorWeapon = weapon ? { name: weapon.name } : null
    }
    // 记录最快通关回合数（仅通关时，即totalTurns > 0）
    if (totalTurns > 0 && (!this._d.stats.bestTotalTurns || totalTurns < this._d.stats.bestTotalTurns)) {
      this._d.stats.bestTotalTurns = totalTurns
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

  // 图鉴：标记宠物已查看详情（红点消失）
  get petDexSeen() { return this._d.petDexSeen || [] }
  markDexSeen(petId) {
    if (!this._d.petDexSeen) this._d.petDexSeen = []
    if (!this._d.petDexSeen.includes(petId)) {
      this._d.petDexSeen.push(petId)
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
        const info = JSON.parse(raw)
        // 验证数据有效性：过滤掉之前getUserProfile返回的无效默认值
        if (info && info.nickName && info.nickName !== '微信用户' && info.avatarUrl && info.avatarUrl.length > 10) {
          this.userInfo = info
          this.userAuthorized = true
          console.log('[Storage] 已加载用户信息:', info.nickName)
        } else {
          console.warn('[Storage] 缓存的用户信息无效，清除:', info)
          wx.removeStorageSync('wxtower_userinfo')
          this.userInfo = null
          this.userAuthorized = false
        }
      }
    } catch(e) {
      console.warn('[Storage] 加载用户信息失败:', e)
    }
  }

  _saveUserInfo(info) {
    this.userInfo = info
    this.userAuthorized = true
    try { wx.setStorageSync('wxtower_userinfo', JSON.stringify(info)) } catch(e) {}
  }

  // 微信用户信息授权（头像+昵称）
  // 小游戏必须通过 createUserInfoButton 获取真实头像昵称
  // 预创建透明按钮覆盖在排行按钮上，用户点击即触发授权
  // rect: { left, top, width, height } — 逻辑像素（CSS像素）
  showUserInfoBtn(rect, callback) {
    this.destroyUserInfoBtn()
    console.log('[UserInfoBtn] 开始创建, rect:', JSON.stringify(rect))
    try {
      const btn = wx.createUserInfoButton({
        type: 'text',
        text: '',
        style: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: 'rgba(0,0,0,0)',
          borderColor: 'rgba(0,0,0,0)',
          borderWidth: 0,
          borderRadius: 0,
          color: 'rgba(0,0,0,0)',
          fontSize: 1,
          textAlign: 'center',
          lineHeight: rect.height,
        },
        withCredentials: false,
      })
      console.log('[UserInfoBtn] 创建成功, btn:', !!btn)
      this._userInfoBtn = btn
      this._userInfoBtnCallback = callback
      btn.onTap((res) => {
        console.log('[UserInfoBtn] onTap触发, res:', JSON.stringify(res))
        btn.destroy()
        this._userInfoBtn = null
        const cb = this._userInfoBtnCallback
        this._userInfoBtnCallback = null

        // 检查是否因隐私API未配置导致失败
        const errMsg = res.errMsg || ''
        if (errMsg.indexOf('no privacy api permission') !== -1 || res.err_code === -12034) {
          console.warn('[UserInfo] 隐私API未配置，需在公众平台配置用户隐私保护指引')
          // 隐私API未配置时直接放行进入排行榜
          if (cb) cb(false, null)
          return
        }

        if (res.userInfo && res.userInfo.nickName && res.userInfo.nickName !== '微信用户') {
          const info = {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl,
          }
          console.log('[UserInfoBtn] 获取到用户信息:', info.nickName, info.avatarUrl)
          this._saveUserInfo(info)
          if (cb) cb(true, info)
        } else if (res.errMsg && res.errMsg.indexOf('fail') !== -1) {
          // 用户拒绝授权 → 尝试引导去设置页
          console.warn('[UserInfo] 授权失败，尝试openSetting')
          this._tryOpenSetting(cb)
        } else {
          console.warn('[UserInfo] 未获取到有效信息，跳过')
          if (cb) cb(false, null)
        }
      })
    } catch(e) {
      console.warn('[UserInfo] createUserInfoButton失败:', e)
      if (callback) callback(false, null)
    }
  }

  // 引导用户到设置页开启 userInfo 授权
  _tryOpenSetting(callback) {
    wx.getSetting({
      success: (settingRes) => {
        console.log('[UserInfo] getSetting:', JSON.stringify(settingRes.authSetting))
        if (settingRes.authSetting['scope.userInfo'] === false) {
          // 之前明确拒绝过，需要引导到设置页
          wx.showModal({
            title: '授权提示',
            content: '需要获取您的昵称和头像用于排行榜展示，请在设置中开启',
            confirmText: '去设置',
            cancelText: '暂不',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (openRes) => {
                    console.log('[UserInfo] openSetting result:', JSON.stringify(openRes.authSetting))
                    if (openRes.authSetting['scope.userInfo']) {
                      // 用户在设置中开启了授权，重新获取信息
                      wx.getUserInfo({
                        success: (infoRes) => {
                          if (infoRes.userInfo && infoRes.userInfo.nickName !== '微信用户') {
                            const info = {
                              nickName: infoRes.userInfo.nickName,
                              avatarUrl: infoRes.userInfo.avatarUrl,
                            }
                            this._saveUserInfo(info)
                            if (callback) callback(true, info)
                          } else {
                            if (callback) callback(false, null)
                          }
                        },
                        fail: () => { if (callback) callback(false, null) }
                      })
                    } else {
                      if (callback) callback(false, null)
                    }
                  },
                  fail: () => { if (callback) callback(false, null) }
                })
              } else {
                if (callback) callback(false, null)
              }
            },
            fail: () => { if (callback) callback(false, null) }
          })
        } else {
          // 未被明确拒绝，可能是首次（但 userInfo 为空），直接放行
          console.warn('[UserInfo] 授权状态非拒绝但信息为空，跳过')
          if (callback) callback(false, null)
        }
      },
      fail: () => { if (callback) callback(false, null) }
    })
  }

  // 更新按钮位置（排行按钮位置可能因有无存档而变化）
  updateUserInfoBtnPos(rect) {
    if (!this._userInfoBtn) return
    try {
      this._userInfoBtn.style.left = rect.left
      this._userInfoBtn.style.top = rect.top
      this._userInfoBtn.style.width = rect.width
      this._userInfoBtn.style.height = rect.height
    } catch(e) {}
  }

  // 销毁授权按钮
  destroyUserInfoBtn() {
    if (this._userInfoBtn) {
      try { this._userInfoBtn.destroy() } catch(e) {}
      this._userInfoBtn = null
      this._userInfoBtnCallback = null
    }
  }

  // ===== 排行榜 =====
  // 提交分数到排行榜
  async submitScore(floor, pets, weapon, totalTurns) {
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
          totalTurns: totalTurns || 0,
          petDexCount: (this._d.petDex || []).length,
          maxCombo: this._d.stats.maxCombo || 0,
        }
      })
    } catch(e) {
      console.warn('[Ranking] 提交失败:', e)
    }
  }

  // 单独提交图鉴/连击排行（非通关时也可以触发）
  async submitDexAndCombo() {
    if (!this._cloudReady || !this.userAuthorized) return
    try {
      await wx.cloud.callFunction({
        name: 'ranking',
        data: {
          action: 'submitDexCombo',
          nickName: this.userInfo.nickName,
          avatarUrl: this.userInfo.avatarUrl,
          petDexCount: (this._d.petDex || []).length,
          maxCombo: this._d.stats.maxCombo || 0,
        }
      })
    } catch(e) {
      console.warn('[Ranking] 提交图鉴/连击失败:', e)
    }
  }

  // 拉取排行榜（带30秒缓存，支持4个tab）
  async fetchRanking(tab, force) {
    const now = Date.now()
    const listMap = { all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const listKey = listMap[tab] || 'rankAllList'
    if (!force && now - this.rankLastFetch < 30000 && this.rankLastFetchTab === tab && this[listKey].length > 0) {
      return
    }
    if (this.rankLoading) return
    this.rankLoading = true
    try {
      const actionMap = { all: 'getAll', dex: 'getDex', combo: 'getCombo' }
      const action = actionMap[tab] || 'getAll'
      const r = await wx.cloud.callFunction({ name: 'ranking', data: { action } })
      if (r.result && r.result.code === 0) {
        this[listKey] = r.result.list || []
        const rankKey = listKey.replace('List', 'MyRank')
        this[rankKey] = r.result.myRank || -1
        this.rankLastFetch = now
        this.rankLastFetchTab = tab
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
