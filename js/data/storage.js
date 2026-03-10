const P = require('../platform')
const api = require('../api')
/**
 * 存储管理 — 灵宠消消塔
 * Roguelike：无局外养成，死亡即重开
 * 仅持久化：最高层数记录 + 统计 + 设置
 * 本地缓存 + 云数据库双重存储（微信用 wx.cloud，抖音用 HTTP API）
 */

const LOCAL_KEY = 'wxtower_v1'
const CLOUD_ENV = 'cloud1-6g8y0x2i39e768eb'

// 当前存档版本号，每次结构变更时递增
const CURRENT_VERSION = 6

// 持久化数据（跨局保留）
function defaultPersist() {
  return {
    _version: CURRENT_VERSION,
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
    cultivation: {
      level: 0,              // 人物等级
      exp: 0,                // 当前等级已积累经验
      totalExpEarned: 0,     // 历史累计获得经验（统计用）
      skillPoints: 0,        // 可用修炼点
      levels: { body:0, spirit:0, wisdom:0, defense:0, sense:0 },
      realmBreakSeen: 0,     // 已看过突破动画的最高境界索引
    },
    selectedAvatar: 'boy1',  // 当前选择的头像ID
    // Phase 2：灵宠池
    petPool: [],             // 灵宠池宠物列表
    petExpPool: 0,           // 共享宠物经验池（未分配）
    // Phase 2：体力系统（仅固定关卡消耗，肉鸽不消耗）
    stamina: {
      current: 100,
      max: 100,
      lastRecoverTime: 0,   // 首次进入时初始化为 Date.now()
    },
    // Phase 3：固定关卡
    stageClearRecord: {},    // { 'stage_1_1': { cleared: true, bestRating: 'S', clearCount: 5 } }
    dailyChallenges: { date: '', counts: {} },  // 每日挑战次数
    savedStageTeam: [],      // 持久化保存的编队（灵宠ID列表）
  }
}

/**
 * 存档迁移注册表：key 为源版本号，value 为迁移函数
 * 每个迁移函数接收 data 并就地修改，将其升级到下一个版本
 * 示例：当 CURRENT_VERSION 升至 2 时，在此添加 migrations[1] = (d) => { ... }
 */
const migrations = {
  1: (d) => {
    if (!d.cultivation) {
      d.cultivation = {
        level: 0, exp: 0, totalExpEarned: 0, skillPoints: 0,
        levels: { body:0, spirit:0, wisdom:0, defense:0, sense:0 },
        realmBreakSeen: 0,
      }
    }
  },
  // v2→v3：修炼系统从"经验直接消耗"改为"等级+加点制"
  2: (d) => {
    const cult = d.cultivation || {}
    const { usedPoints: calcUsed } = require('./cultivationConfig')
    const used = calcUsed(cult.levels || {})
    cult.level = used
    cult.skillPoints = 0
    cult.exp = cult.exp || 0
    cult.totalExpEarned = cult.totalExpEarned || 0
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.realmBreakSeen === undefined) cult.realmBreakSeen = 0
    d.cultivation = cult
  },
  // v3→v4：Phase 2 灵宠池 + 共享经验池 + 体力系统
  3: (d) => {
    if (!d.petPool) d.petPool = []
    if (d.petExpPool == null) d.petExpPool = 0
    if (!d.stamina) d.stamina = { current: 100, max: 100, lastRecoverTime: Date.now() }
  },
  // v4→v5：Phase 3 固定关卡通关记录 + 每日挑战次数
  4: (d) => {
    if (!d.stageClearRecord) d.stageClearRecord = {}
    if (!d.dailyChallenges) d.dailyChallenges = { date: '', counts: {} }
  },
  // v5→v6：持久化编队
  5: (d) => {
    if (!d.savedStageTeam) d.savedStageTeam = []
  },
}

/** 从 oldVer 逐步迁移到 CURRENT_VERSION */
function runMigrations(data) {
  let v = data._version || 0
  while (v < CURRENT_VERSION) {
    const fn = migrations[v]
    if (fn) {
      console.log(`[Storage] 执行迁移 v${v} → v${v + 1}`)
      fn(data)
    }
    v++
    data._version = v
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
    this.rankLoadingMsg = ''   // 加载状态详细提示
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
      this._d.stats.bestFloorPets = (pets || []).map(p => ({ id: p.id, name: p.name, attr: p.attr, atk: p.atk, star: p.star || 1 }))
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

  // ===== 修炼系统 =====
  get cultivation() { return this._d.cultivation }

  get selectedAvatar() { return this._d.selectedAvatar || 'boy1' }
  setSelectedAvatar(id) { this._d.selectedAvatar = id; this._save() }

  /**
   * 消耗修炼点升级指定属性
   * @param {string} key - 属性键名
   * @param {number} [amount=1] - 加点数量
   * @returns {number} 实际升级的点数（0 表示失败）
   */
  upgradeCultivation(key, amount) {
    const { CULT_CONFIG } = require('./cultivationConfig')
    const cfg = CULT_CONFIG[key]
    if (!cfg) return 0
    const cult = this._d.cultivation
    if (cult.skillPoints <= 0) return 0
    const remaining = cfg.maxLv - cult.levels[key]
    if (remaining <= 0) return 0
    const actual = Math.min(amount || 1, remaining, cult.skillPoints)
    if (actual <= 0) return 0
    cult.skillPoints -= actual
    cult.levels[key] += actual
    this._save()
    return actual
  }

  /**
   * 增加修炼经验并自动升级，返回升级次数
   * 每升一级获得 1 修炼点
   */
  addCultExp(amount) {
    if (amount <= 0) return 0
    const { MAX_LEVEL, expToNextLevel } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (cult.level == null) cult.level = 0
    if (cult.skillPoints == null) cult.skillPoints = 0
    cult.exp += amount
    cult.totalExpEarned += amount
    let levelUps = 0
    while (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      if (cult.exp < needed) break
      cult.exp -= needed
      cult.level++
      cult.skillPoints++
      levelUps++
    }
    // 满级后经验仍然累积（显示用），但不再升级
    this._save()
    return levelUps
  }

  // ===== 灵宠池系统 =====

  get petPool() { return this._d.petPool || [] }
  get petPoolCount() { return (this._d.petPool || []).length }
  get petExpPool() { return this._d.petExpPool || 0 }

  /**
   * 宠物入池（★3图鉴首次解锁时调用）
   * 入池初始状态：★1 Lv.5 + 2碎片
   */
  addToPetPool(petId, source = 'roguelike') {
    const { getPetById } = require('./pets')
    const { ENTRY_LEVEL, ENTRY_FRAGMENTS } = require('./petPoolConfig')
    const pet = getPetById(petId)
    if (!pet) return false
    const pool = this._d.petPool || (this._d.petPool = [])
    if (pool.find(p => p.id === petId)) return false
    pool.push({
      id: petId,
      attr: pet.attr,
      star: 1,
      level: ENTRY_LEVEL,
      fragments: ENTRY_FRAGMENTS,
      source,
      obtainedAt: Date.now(),
    })
    this._save()
    return true
  }

  /** 增加碎片（特定宠物） */
  addFragments(petId, count) {
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry) return false
    entry.fragments += count
    this._save()
    return true
  }

  /**
   * 分解碎片为经验（1碎片 = FRAGMENT_TO_EXP 宠物经验）
   * @returns {number} 获得的经验量，0表示失败
   */
  decomposeFragments(petId, count) {
    const { FRAGMENT_TO_EXP } = require('./petPoolConfig')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry || entry.fragments < count || count <= 0) return 0
    entry.fragments -= count
    const expGained = count * FRAGMENT_TO_EXP
    this._d.petExpPool = (this._d.petExpPool || 0) + expGained
    this._save()
    return expGained
  }

  /** 增加共享宠物经验池 */
  addPetExp(amount) {
    if (amount <= 0) return
    this._d.petExpPool = (this._d.petExpPool || 0) + amount
    this._save()
  }

  /**
   * 从共享经验池投入经验给指定宠物，返回升级次数
   * @param {string} petId - 目标宠物ID
   * @param {number} amount - 投入经验量
   */
  investPetExp(petId, amount) {
    const { petExpToNextLevel, POOL_MAX_LV, POOL_ADV_MAX_LV } = require('./petPoolConfig')
    const { getPetTier } = require('./pets')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry || amount <= 0) return 0
    const available = Math.min(amount, this._d.petExpPool || 0)
    if (available <= 0) return 0
    const maxLv = entry.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
    if (entry.level >= maxLv) return 0
    const tier = getPetTier(entry.id)
    let spent = 0, levelUps = 0
    // 模拟投入经验逐级升级
    let remaining = available
    while (entry.level < maxLv && remaining > 0) {
      const needed = petExpToNextLevel(entry.level, tier)
      if (remaining >= needed) {
        remaining -= needed
        spent += needed
        entry.level++
        levelUps++
      } else {
        break // 剩余不够升级，不扣经验（避免经验被吃掉但没升级）
      }
    }
    if (spent > 0) {
      this._d.petExpPool -= spent
      this._save()
    }
    return levelUps
  }

  /**
   * 升星（消耗碎片，需满足等级门槛）
   */
  upgradePoolPetStar(petId) {
    const { POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ } = require('./petPoolConfig')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry) return { ok: false, reason: 'not_found' }
    const nextStar = entry.star + 1
    const maxStar = entry.source === 'stage' ? 4 : 3
    if (nextStar > maxStar) return { ok: false, reason: 'max_star' }
    const lvReq = POOL_STAR_LV_REQ[nextStar]
    if (entry.level < lvReq) return { ok: false, reason: 'level_low', required: lvReq }
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    if (entry.fragments < fragCost) return { ok: false, reason: 'fragments_low', required: fragCost }
    entry.fragments -= fragCost
    entry.star = nextStar
    this._save()
    return { ok: true, newStar: nextStar }
  }

  /** 获取灵宠池中指定宠物 */
  getPoolPet(petId) {
    return (this._d.petPool || []).find(p => p.id === petId) || null
  }

  // ===== 体力系统（仅固定关卡消耗） =====

  get currentStamina() {
    this._recoverStamina()
    return this._d.stamina.current
  }

  get maxStamina() {
    return this._d.stamina.max
  }

  consumeStamina(amount) {
    this._recoverStamina()
    if (this._d.stamina.current < amount) return false
    this._d.stamina.current -= amount
    this._save()
    return true
  }

  /** 下一点体力恢复的剩余秒数 */
  get staminaRecoverSec() {
    const s = this._d.stamina
    if (s.current >= s.max) return 0
    const INTERVAL = 30 * 60 * 1000
    const elapsed = Date.now() - (s.lastRecoverTime || Date.now())
    const remain = INTERVAL - (elapsed % INTERVAL)
    return Math.ceil(remain / 1000)
  }

  _recoverStamina() {
    const s = this._d.stamina
    if (!s.lastRecoverTime) { s.lastRecoverTime = Date.now(); return }
    const now = Date.now()
    const INTERVAL = 30 * 60 * 1000
    const elapsed = now - s.lastRecoverTime
    const recovered = Math.floor(elapsed / INTERVAL)
    if (recovered > 0) {
      s.current = Math.min(s.max, s.current + recovered)
      s.lastRecoverTime += recovered * INTERVAL
    }
  }

  // ===== 固定关卡记录 =====

  get stageClearRecord() {
    return this._d.stageClearRecord || (this._d.stageClearRecord = {})
  }

  isStageCleared(stageId) {
    return !!(this._d.stageClearRecord && this._d.stageClearRecord[stageId]?.cleared)
  }

  getStageBestRating(stageId) {
    return this._d.stageClearRecord?.[stageId]?.bestRating || null
  }

  getStageClearCount(stageId) {
    return this._d.stageClearRecord?.[stageId]?.clearCount || 0
  }

  recordStageClear(stageId, rating, isFirst) {
    const RATING_ORDER = { B: 1, A: 2, S: 3 }
    const record = this._d.stageClearRecord || (this._d.stageClearRecord = {})
    if (!record[stageId]) record[stageId] = { cleared: false, bestRating: null, clearCount: 0 }
    const r = record[stageId]
    r.cleared = true
    r.clearCount++
    if (!r.bestRating || RATING_ORDER[rating] > RATING_ORDER[r.bestRating]) {
      r.bestRating = rating
    }
    this._save()
  }

  // ===== 每日挑战次数 =====

  _refreshDailyChallenges() {
    const today = new Date().toISOString().slice(0, 10)
    if (!this._d.dailyChallenges || this._d.dailyChallenges.date !== today) {
      this._d.dailyChallenges = { date: today, counts: {} }
    }
  }

  canChallengeStage(stageId, dailyLimit) {
    this._refreshDailyChallenges()
    const counts = this._d.dailyChallenges.counts
    return (counts[stageId] || 0) < dailyLimit
  }

  getStageDailyCount(stageId) {
    this._refreshDailyChallenges()
    return this._d.dailyChallenges.counts[stageId] || 0
  }

  recordStageChallenge(stageId) {
    this._refreshDailyChallenges()
    const counts = this._d.dailyChallenges.counts
    counts[stageId] = (counts[stageId] || 0) + 1
    this._save()
  }

  // ===== 持久化编队 =====

  get savedStageTeam() {
    return this._d.savedStageTeam || []
  }

  /** 保存编队，同时过滤掉已不在灵宠池中的宠物 */
  saveStageteam(teamIds) {
    const pool = this._d.petPool || []
    const poolIds = new Set(pool.map(p => p.id))
    this._d.savedStageTeam = (teamIds || []).filter(id => poolIds.has(id))
    this._save()
  }

  /** 获取有效的已保存编队（排除已不在池中的） */
  getValidSavedTeam() {
    const saved = this._d.savedStageTeam || []
    if (saved.length === 0) return []
    const pool = this._d.petPool || []
    const poolIds = new Set(pool.map(p => p.id))
    return saved.filter(id => poolIds.has(id))
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
    try { P.removeStorageSync(LOCAL_KEY) } catch(e) {}
    this._save()
    if (this._cloudReady) {
      try {
        if (P.isDouyin) {
          await api.syncPlayerData(this._d)
        } else if (this._openid) {
          const db = P.cloud.database()
          const res = await db.collection('playerData').where({ _openid: this._openid }).get()
          if (res.data && res.data.length > 0) {
            await db.collection('playerData').doc(res.data[0]._id).remove()
          }
        }
      } catch(e) { console.warn('[Storage] 云端重置失败:', e) }
    }
    return true
  }

  // ===== 本地存储 =====
  _loadUserInfo() {
    try {
      const raw = P.getStorageSync('wxtower_userinfo')
      if (raw) {
        const info = JSON.parse(raw)
        // 验证数据有效性：过滤掉之前getUserProfile返回的无效默认值
        if (info && info.nickName && info.nickName !== '微信用户' && info.avatarUrl && info.avatarUrl.length > 10) {
          this.userInfo = info
          this.userAuthorized = true
          console.log('[Storage] 已加载用户信息:', info.nickName)
        } else {
          console.warn('[Storage] 缓存的用户信息无效，清除:', info)
          P.removeStorageSync('wxtower_userinfo')
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
    try { P.setStorageSync('wxtower_userinfo', JSON.stringify(info)) } catch(e) {}
  }

  // 微信用户信息授权（头像+昵称）
  // 小游戏必须通过 createUserInfoButton 获取真实头像昵称
  // 预创建透明按钮覆盖在排行按钮上，用户点击即触发授权
  // rect: { left, top, width, height } — 逻辑像素（CSS像素）
  showUserInfoBtn(rect, callback) {
    this.destroyUserInfoBtn()
    console.log('[UserInfoBtn] 开始创建, rect:', JSON.stringify(rect))
    try {
      const btn = P.createUserInfoButton({
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
      if (!btn) {
        if (callback) callback(false, null)
        return
      }
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
    P.getSetting({
      success: (settingRes) => {
        console.log('[UserInfo] getSetting:', JSON.stringify(settingRes.authSetting))
        if (settingRes.authSetting['scope.userInfo'] === false) {
          // 之前明确拒绝过，需要引导到设置页
          P.showModal({
            title: '授权提示',
            content: '需要获取您的昵称和头像用于排行榜展示，请在设置中开启',
            confirmText: '去设置',
            cancelText: '暂不',
            success: (modalRes) => {
              if (modalRes.confirm) {
                P.openSetting({
                  success: (openRes) => {
                    console.log('[UserInfo] openSetting result:', JSON.stringify(openRes.authSetting))
                    if (openRes.authSetting['scope.userInfo']) {
                      // 用户在设置中开启了授权，重新获取信息
                      P.getUserInfo({
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

  /**
   * 统一排行榜调用：微信走云函数，抖音走 HTTP API
   * 返回值格式统一为 { code, list?, myRank?, msg? }
   */
  async _callRanking(data) {
    if (P.isWeChat) {
      const r = await P.cloud.callFunction({ name: 'ranking', data })
      return r.result
    }
    // 抖音端走 HTTP API
    const { action, ...rest } = data
    if (action === 'submit' || action === 'submitDexCombo') {
      return api.submitRanking({ action, ...rest })
    }
    if (action === 'getAll') return api.getRankingList('all')
    if (action === 'getDex') return api.getRankingList('dex')
    if (action === 'getCombo') return api.getRankingList('combo')
    if (action === 'submitAndGetAll') {
      await api.submitRanking({ action: 'submit', ...rest })
      return api.getRankingList('all')
    }
    return { code: -1, msg: 'unknown action' }
  }

  // 提交分数到排行榜
  async submitScore(floor, pets, weapon, totalTurns) {
    if (!this._cloudReady || !this.userAuthorized) {
      console.warn('[Ranking] 提交跳过: cloudReady=', this._cloudReady, 'authorized=', this.userAuthorized)
      return
    }
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交分数: floor=', floor, 'turns=', totalTurns)
      const result = await this._callRanking({
        action: 'submit',
        nickName: this.userInfo.nickName,
        avatarUrl: this.userInfo.avatarUrl,
        floor,
        pets: (pets || []).map(p => ({ name: p.name, attr: p.attr })),
        weapon: weapon ? { name: weapon.name } : null,
        totalTurns: totalTurns || 0,
        petDexCount: (this._d.petDex || []).length,
        maxCombo: this._d.stats.maxCombo || 0,
      })
      console.log('[Ranking] 提交分数完成, 耗时', Date.now() - t0, 'ms, 结果:', JSON.stringify(result).slice(0, 200))
      // 提交成功后清掉缓存，下次打开排行榜会重新拉取最新数据
      this.rankLastFetch = 0
    } catch(e) {
      console.error('[Ranking] 提交分数失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
  }

  // 单独提交图鉴/连击排行（非通关时也可以触发）
  async submitDexAndCombo() {
    if (!this._cloudReady || !this.userAuthorized) return
    const t0 = Date.now()
    try {
      console.log('[Ranking] 提交图鉴/连击: dex=', (this._d.petDex || []).length, 'combo=', this._d.stats.maxCombo || 0)
      await this._callRanking({
        action: 'submitDexCombo',
        nickName: this.userInfo.nickName,
        avatarUrl: this.userInfo.avatarUrl,
        petDexCount: (this._d.petDex || []).length,
        maxCombo: this._d.stats.maxCombo || 0,
      })
      console.log('[Ranking] 提交图鉴/连击完成, 耗时', Date.now() - t0, 'ms')
    } catch(e) {
      console.warn('[Ranking] 提交图鉴/连击失败, 耗时', Date.now() - t0, 'ms:', e)
    }
  }

  // 拉取排行榜（带30秒缓存，支持4个tab）
  async fetchRanking(tab, force) {
    if (!this._cloudReady) {
      console.warn('[Ranking] 云环境未就绪，跳过拉取')
      return
    }
    const now = Date.now()
    const listMap = { all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const listKey = listMap[tab] || 'rankAllList'
    if (!force && now - this.rankLastFetch < 30000 && this.rankLastFetchTab === tab && this[listKey].length > 0) {
      console.log('[Ranking] 命中缓存, 跳过拉取:', tab)
      return
    }
    if (this.rankLoading) return
    this.rankLoading = true
    this.rankLoadingMsg = '拉取排行中...'
    const t0 = Date.now()
    try {
      const actionMap = { all: 'getAll', dex: 'getDex', combo: 'getCombo' }
      const action = actionMap[tab] || 'getAll'
      console.log('[Ranking] 开始拉取:', action)
      const result = await this._callRanking({ action })
      const elapsed = Date.now() - t0
      console.log('[Ranking] 拉取完成, 耗时', elapsed, 'ms, 结果:', JSON.stringify(result).slice(0, 800))
      if (result && result.debug) {
        console.log('[Ranking] DEBUG:', JSON.stringify(result.debug))
      }
      if (result && result.code === 0) {
        console.log('[Ranking] 获取到', (result.list || []).length, '条记录, myRank=', result.myRank)
        this[listKey] = result.list || []
        const rankKey = listKey.replace('List', 'MyRank')
        this[rankKey] = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = tab
      } else {
        console.warn('[Ranking] 返回错误:', result)
      }
    } catch(e) {
      console.error('[Ranking] 拉取失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
    this.rankLoading = false
    this.rankLoadingMsg = ''
  }

  // 一体化：提交分数 + 拉取排行（一次云函数调用）
  async fetchRankingCombined(tab, needSubmit) {
    if (!this._cloudReady) return
    this.rankLoading = true
    this.rankLoadingMsg = needSubmit ? '提交并加载中...' : '加载排行中...'
    const t0 = Date.now()
    try {
      const data = { action: 'submitAndGetAll' }
      if (needSubmit && this.userAuthorized) {
        data.nickName = this.userInfo.nickName
        data.avatarUrl = this.userInfo.avatarUrl
        data.floor = this.bestFloor
        data.pets = (this.stats.bestFloorPets || []).map(p => ({ name: p.name, attr: p.attr }))
        data.weapon = this.stats.bestFloorWeapon ? { name: this.stats.bestFloorWeapon.name } : null
        data.totalTurns = this.stats.bestTotalTurns || 0
        data.petDexCount = (this._d.petDex || []).length
        data.maxCombo = this._d.stats.maxCombo || 0
      }
      console.log('[Ranking] 一体化调用, needSubmit=', needSubmit)
      const result = await this._callRanking(data)
      const elapsed = Date.now() - t0
      console.log('[Ranking] 一体化完成, 耗时', elapsed, 'ms')
      if (result && result.debug) {
        console.log('[Ranking] DEBUG:', JSON.stringify(result.debug))
      }
      if (result && result.code === 0) {
        const listKey = 'rankAllList'
        this[listKey] = result.list || []
        this.rankAllMyRank = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = 'all'
        console.log('[Ranking] 获取到', this[listKey].length, '条记录, myRank=', this.rankAllMyRank)
      } else {
        console.warn('[Ranking] 返回错误:', result)
      }
    } catch(e) {
      console.error('[Ranking] 一体化调用失败, 耗时', Date.now() - t0, 'ms:', e.message || e)
    }
    this.rankLoading = false
    this.rankLoadingMsg = ''
  }

  _load() {
    try {
      const raw = P.getStorageSync(LOCAL_KEY)
      if (raw) {
        this._d = JSON.parse(raw)
        // 补全新版本新增的默认字段
        const def = defaultPersist()
        Object.keys(def).forEach(k => {
          if (this._d[k] === undefined) this._d[k] = def[k]
        })
        // 版本迁移：旧存档升级到当前版本
        if ((this._d._version || 0) < CURRENT_VERSION) {
          runMigrations(this._d)
          this._save()
        }
        // 确保 cultivation 字段完整（防止迁移失败或字段缺失）
        this._ensureCultivationFields()
      } else {
        this._d = defaultPersist()
      }
    } catch(e) {
      console.warn('Storage load error:', e)
      this._d = defaultPersist()
    }
  }

  // 补全持久化子字段（兼容任何版本的存档残缺）
  _ensureCultivationFields() {
    const cult = this._d.cultivation
    if (!cult) { this._d.cultivation = defaultPersist().cultivation; return }
    if (cult.level == null) cult.level = 0
    if (cult.exp == null) cult.exp = 0
    if (cult.totalExpEarned == null) cult.totalExpEarned = 0
    if (cult.skillPoints == null) cult.skillPoints = 0
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.realmBreakSeen == null) cult.realmBreakSeen = 0
    if (!this._d.selectedAvatar) this._d.selectedAvatar = 'boy1'
    // Phase 2 字段补全
    if (!this._d.petPool) this._d.petPool = []
    if (this._d.petExpPool == null) this._d.petExpPool = 0
    if (!this._d.stamina) this._d.stamina = { current: 100, max: 100, lastRecoverTime: Date.now() }
    // Phase 3 字段补全
    if (!this._d.stageClearRecord) this._d.stageClearRecord = {}
    if (!this._d.dailyChallenges) this._d.dailyChallenges = { date: '', counts: {} }
    if (!this._d.savedStageTeam) this._d.savedStageTeam = []
  }

  _save() {
    try {
      P.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
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
    if (P.isDouyin) {
      // 抖音端：通过 HTTP API 登录（抖音云会自动注入 openid）
      try {
        await api.login()
        this._cloudReady = true
        console.log('[Storage] 抖音端 API 登录成功')
      } catch(e) {
        console.warn('[Storage] 抖音端 API 登录失败:', e.message || e)
        this._cloudReady = true // 抖音云自动注入 openid，即使 login 失败也可用
      }
    } else {
      // 微信端：使用 wx.cloud
      try {
        P.cloud.init({ env: CLOUD_ENV, traceUser: true })
        this._cloudReady = true
      } catch(e) {
        console.warn('Cloud init failed:', e)
        return
      }
      try { await this._ensureCollections() } catch(e) {}
      try { await this._getOpenid() } catch(e) { console.warn('Get openid failed:', e) }
    }
    if (P.isWeChat && this._openid) await this._syncFromCloud()
    if (P.isDouyin) await this._syncFromCloud()
    this._cloudInitDone = true
    if (this._pendingSync) {
      this._pendingSync = false
      this._syncToCloud()
    }
    this._preheatRanking()
  }

  async _preheatRanking() {
    try {
      const t0 = Date.now()
      console.log('[Ranking] 预热: 后台静默拉取排行榜...')
      const result = await this._callRanking({ action: 'getAll' })
      const elapsed = Date.now() - t0
      if (result && result.code === 0) {
        this.rankAllList = result.list || []
        this.rankAllMyRank = result.myRank || -1
        this.rankLastFetch = Date.now()
        this.rankLastFetchTab = 'all'
        console.log('[Ranking] 预热完成, 耗时', elapsed, 'ms, 记录数:', this.rankAllList.length)
      }
    } catch(e) {
      console.warn('[Ranking] 预热失败(不影响使用):', e.message || e)
    }
  }

  async _ensureCollections() {
    const r = await P.cloud.callFunction({ name: 'initCollections' })
    if (r.result && r.result.errors && r.result.errors.length) {
      console.warn('创建集合异常:', r.result.errors)
    }
  }

  async _getOpenid() {
    const r = await P.cloud.callFunction({ name: 'getOpenid' })
    this._openid = (r.result && r.result.openid) || ''
  }

  async _syncFromCloud() {
    if (!this._cloudReady) return
    try {
      let cloudData = null
      if (P.isWeChat) {
        if (!this._openid) return
        const db = P.cloud.database()
        const res = await db.collection('playerData').where({ _openid: this._openid }).get()
        if (res.data && res.data.length > 0) {
          cloudData = res.data[0]
          delete cloudData._id
          delete cloudData._openid
        }
      } else {
        // 抖音端走 HTTP API
        const res = await api.getPlayerData()
        if (res && res.data) cloudData = res.data
      }
      if (cloudData) {
        const cloudTime = cloudData._updateTime || cloudData.updatedAt || 0
        const localTime = this._d._updateTime || 0
        if (cloudTime > localTime) {
          this._deepMerge(this._d, cloudData)
          if ((this._d._version || 0) < CURRENT_VERSION) {
            runMigrations(this._d)
          }
          P.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
          console.log('[Storage] 云端数据已合并到本地')
        }
      }
    } catch(e) { console.warn('Sync from cloud error:', e) }
  }

  // 深度合并：cloud 的值覆盖 target，但对嵌套对象递归合并
  // 保留 target 中有但 cloud 中没有的字段（如后来新增的 bestTotalTurns）
  _deepMerge(target, source) {
    for (const key of Object.keys(source)) {
      const sv = source[key]
      const tv = target[key]
      if (sv && typeof sv === 'object' && !Array.isArray(sv) && tv && typeof tv === 'object' && !Array.isArray(tv)) {
        this._deepMerge(tv, sv)
      } else {
        // 数值字段：保留较大/较好的值（bestFloor取大，bestTotalTurns取小且>0）
        if (key === 'bestFloor') {
          target[key] = Math.max(tv || 0, sv || 0)
        } else if (key === 'bestTotalTurns') {
          if ((tv || 0) > 0 && (sv || 0) > 0) target[key] = Math.min(tv, sv)
          else target[key] = (tv || 0) > 0 ? tv : (sv || 0)
        } else if (key === 'maxCombo') {
          target[key] = Math.max(tv || 0, sv || 0)
        } else if (key === 'totalBattles' || key === 'totalCombos' || key === 'totalRuns') {
          target[key] = Math.max(tv || 0, sv || 0)
        } else {
          target[key] = sv
        }
      }
    }
  }

  async _syncToCloud() {
    if (!this._cloudReady) return
    try {
      if (P.isDouyin) {
        // 抖音端走 HTTP API
        await api.syncPlayerData({ ...this._d, _updateTime: Date.now() })
        return
      }
      // 微信端走 wx.cloud
      if (!this._openid) return
      const db = P.cloud.database()
      const col = db.collection('playerData')
      const res = await col.where({ _openid: this._openid }).get()
      const saveData = { ...this._d, _updateTime: Date.now() }
      delete saveData._id
      delete saveData._openid
      if (res.data && res.data.length > 1) {
        await col.doc(res.data[0]._id).update({ data: saveData })
        for (let i = 1; i < res.data.length; i++) {
          try { await col.doc(res.data[i]._id).remove() } catch(e) {}
        }
        console.log('[Storage] 云同步完成，清理了', res.data.length - 1, '条重复记录')
      } else if (res.data && res.data.length === 1) {
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
