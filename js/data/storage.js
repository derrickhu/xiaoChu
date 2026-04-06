const P = require('../platform')
const api = require('../api')
const cloudSync = require('./cloudSync')
const RankingService = require('./rankingService')
const {
  STAMINA_RECOVER_INTERVAL_MS,
  STAMINA_INITIAL,
  STAMINA_SIDEBAR_REWARD,
} = require('./constants')
/**
 * 存储管理 — 灵宠消消塔
 * Roguelike：无局外养成，死亡即重开
 * 仅持久化：最高层数记录 + 统计 + 设置
 * 本地缓存 + 云数据库双重存储（微信用 wx.cloud，抖音用 HTTP API）
 */

const LOCAL_KEY = 'wxtower_v1'

/** 本地日历 YYYY-MM-DD（签到/每日任务等，避免 UTC 与玩家所在地跨日不一致） */
function localDateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// 当前存档版本号，每次结构变更时递增
const CURRENT_VERSION = 15

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
      bgmVolume: 50,  // 背景音乐音量 0~100，默认50
    },
    petDex: [],  // 图鉴：历史收集到3星的宠物ID列表（兼容旧版）
    petDexSeen: [],  // 图鉴：已查看过详情的宠物ID列表
    dexMilestonesClaimed: [],  // 图鉴里程碑：已领取的里程碑ID列表
    cultivation: {
      level: 1,              // 人物等级（从1级起始）
      exp: 0,                // 当前等级已积累经验
      totalExpEarned: 0,     // 历史累计获得经验（统计用）
      skillPoints: 0,        // 可用修炼点
      levels: { body:0, spirit:0, wisdom:0, defense:0, sense:0 },
      realmBreakSeen: 0,     // 已看过突破动画的最高境界索引
    },
    selectedAvatar: 'boy1',   // 当前选择的头像ID
    unlockedAvatars: ['boy1', 'girl1'], // 已解锁的形象列表
    // Phase 2：灵宠池
    petPool: [],             // 灵宠池宠物列表
    soulStone: 0,            // 灵石（共享宠物升级货币）
    awakenStone: 0,          // 觉醒石数量
    // Phase 2：体力系统（仅固定关卡消耗，肉鸽不消耗）
    stamina: {
      current: STAMINA_INITIAL,
      max: STAMINA_INITIAL,
      lastRecoverTime: 0,   // 首次进入时初始化为 Date.now()
    },
    // Phase 3：固定关卡
    stageClearRecord: {},    // { 'stage_1_1': { cleared, bestRating, clearCount, starsClaimed:[bool,bool,bool] } }
    chapterStarMilestones: {},  // { 1: [false,false,false], ... } 对应 5★/10★/15★
    dailyChallenges: { date: '', counts: {} },  // 每日挑战次数
    savedStageTeam: [],      // 持久化保存的编队（灵宠ID列表）
    sidebarRewardDate: '',   // 侧边栏复访奖励最后领取日期
    // Phase 4：灵宠派遣（挂机）
    idleDispatch: {
      slots: [],              // [{ petId, startTime }]  最多3个
      lastCollect: 0,         // 上次收取时间戳
    },
    // Phase 5：碎片银行
    fragmentBank: {},          // { petId: count } 未入池宠物的碎片
    towerDaily: { date: '', runs: 0, adRuns: 0 },  // 通天塔每日挑战次数
    guideFlags: {},            // { guideId: true } 新手指引已完成标记
    weaponCollection: [],      // 已获得法宝ID: ['w1','w5',...]
    equippedWeaponId: null,    // 当前装备的法宝ID
    // 签到系统
    loginSign: {
      day: 0,                  // 当前签到天数 (1-7)
      lastDate: '',            // 上次签到日期 'YYYY-MM-DD'
      isNewbie: true,          // 是否仍在新手 7 日周期
    },
    // 每日任务
    dailyTaskProgress: {
      date: '',
      tasks: {},               // { taskId: currentCount }
      claimed: {},             // { taskId: true }
      allClaimed: false,
    },
    // 分享追踪
    shareTracking: {
      date: '',
      rewardCount: 0,          // 当日已领奖次数
      firstEverDone: false,    // 是否完成过首次分享
    },
    // 邀请追踪
    inviteCount: 0,
    invitedBy: null,
    // 广告观看记录（每日频控）
    adWatchLog: {},            // { [slotId]: { date: 'YYYY-MM-DD', count: N } }
    // 回归 / 删档
    lastActiveDate: '',
    dataVersion: 0,
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
        level: 1, exp: 0, totalExpEarned: 0, skillPoints: 0,
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
    if (!d.stamina) d.stamina = { current: STAMINA_INITIAL, max: STAMINA_INITIAL, lastRecoverTime: Date.now() }
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
  // v6→v7：灵宠派遣（挂机）
  6: (d) => {
    if (!d.idleDispatch) d.idleDispatch = { slots: [], lastCollect: 0 }
  },
  // v7→v8：碎片银行
  7: (d) => {
    if (!d.fragmentBank) d.fragmentBank = {}
  },
  // v8→v9：新手指引标记
  8: (d) => {
    if (!d.guideFlags) d.guideFlags = {}
    if (d.tutorialDone) d.guideFlags.battle_tutorial = true
  },
  // v9→v10：灵石重命名 + 觉醒石
  9: (d) => {
    if (d.petExpPool !== undefined) {
      d.soulStone = d.petExpPool
      delete d.petExpPool
    }
    if (d.soulStone === undefined) d.soulStone = 0
    if (d.awakenStone === undefined) d.awakenStone = 0
  },
  // v10→v11：关卡星级奖励 + 章节里程碑
  10: (d) => {
    const RATING_TO_STARS = { S: 3, A: 2, B: 1 }
    const record = d.stageClearRecord || {}
    for (const sid of Object.keys(record)) {
      const r = record[sid]
      if (!r.starsClaimed) {
        // 根据历史最佳评级补发标记（已通关的按最佳评级设定已领取标记）
        const best = RATING_TO_STARS[r.bestRating] || 0
        r.starsClaimed = [best >= 1, best >= 2, best >= 3]
      }
    }
    if (!d.chapterStarMilestones) d.chapterStarMilestones = {}
  },
  // v11→v12：法宝背包 + 装备系统
  11: (d) => {
    if (!d.weaponCollection) d.weaponCollection = []
    if (d.equippedWeaponId === undefined) d.equippedWeaponId = null
  },
  // v12→v13：图鉴系统重设计 — 里程碑字段 + 旧petDex数据迁移入池
  12: (d) => {
    if (!d.dexMilestonesClaimed) d.dexMilestonesClaimed = []
    const pool = d.petPool || []
    const poolIds = new Set(pool.map(p => p.id))
    const oldDex = d.petDex || []
    for (const petId of oldDex) {
      if (!poolIds.has(petId)) {
        const { getPetById } = require('./pets')
        const pet = getPetById(petId)
        if (pet) {
          pool.push({
            id: petId, attr: pet.attr, star: 3,
            level: 10, fragments: 0,
            source: 'dex_migrate', obtainedAt: Date.now(),
          })
        }
      }
    }
    if (!d.petPool) d.petPool = pool
  },
  // v13→v14：广告观看频控字段
  13: (d) => {
    if (!d.adWatchLog) d.adWatchLog = {}
  },
  // v14→v15：通天塔每日挑战次数
  14: (d) => {
    if (!d.towerDaily) d.towerDaily = { date: '', runs: 0, adRuns: 0 }
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
    // 用户信息（微信授权）
    this.userInfo = null      // { nickName, avatarUrl }
    this.userAuthorized = false
    this._load()
    this._loadUserInfo()
    // 抖音端没有 createUserInfoButton，先用默认身份允许提交
    // 后续通过 requestDouyinUserProfile 在 tap 事件中获取真实信息
    if (P.isDouyin && !this.userAuthorized) {
      this.userInfo = { nickName: '冒险者', avatarUrl: '' }
      this.userAuthorized = true
    }
    this._ranking = new RankingService({
      getContext: () => {
        const { getDexProgress } = require('./dexConfig')
        const pool = this._d.petPool || []
        const dexProg = getDexProgress(pool)
        const farN = this.getFarthestClearedStageCoords(false)
        const farE = this.getFarthestClearedStageCoords(true)
        return {
          userAuthorized: this.userAuthorized,
          userInfo: this.userInfo,
          petDexCount: pool.length,
          masteredCount: dexProg.mastered.length,
          collectedCount: dexProg.collected.length,
          maxCombo: this._d.stats.maxCombo || 0,
          avgCombo: this._d.stats.totalBattles > 0 ? Math.round(this._d.stats.totalCombos / this._d.stats.totalBattles * 10) / 10 : 0,
          bestFloor: this.bestFloor,
          bestFloorPets: this.stats.bestFloorPets || [],
          bestFloorWeapon: this.stats.bestFloorWeapon,
          bestTotalTurns: this.stats.bestTotalTurns || 0,
          stageTotalStars: this.getStageTotalStars(),
          stageClearCount: this.getStageClearCount(),
          stageEliteClearCount: this.getStageEliteClearCount(),
          farthestChapter: this.getFarthestChapter(),
          farthestNormalChapter: farN ? farN.chapter : 0,
          farthestNormalOrder: farN ? farN.order : 0,
          farthestEliteChapter: farE ? farE.chapter : 0,
          farthestEliteOrder: farE ? farE.order : 0,
        }
      },
      markDirty: () => { if (this._eventBus) this._eventBus.emit('ranking:dirty') },
    })
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

  /** 设置背景音乐音量（0~100） */
  setBgmVolume(vol) {
    this._d.settings.bgmVolume = Math.max(0, Math.min(100, Math.round(vol)))
    this._save()
    return this._d.settings.bgmVolume
  }

  // 图鉴：记录收集到3星的宠物（兼容旧版，新版由 petPool 派生）
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

  // ===== 图鉴里程碑系统 =====
  get dexMilestonesClaimed() { return this._d.dexMilestonesClaimed || [] }

  claimDexMilestone(milestoneId) {
    const { ALL_MILESTONES, isMilestoneReached } = require('./dexConfig')
    const m = ALL_MILESTONES.find(ms => ms.id === milestoneId)
    if (!m) return { success: false, message: '里程碑不存在' }
    if (!this._d.dexMilestonesClaimed) this._d.dexMilestonesClaimed = []
    if (this._d.dexMilestonesClaimed.includes(milestoneId)) return { success: false, message: '已领取' }
    if (!isMilestoneReached(m, this._d.petPool || [])) return { success: false, message: '未达成' }
    this._d.dexMilestonesClaimed.push(milestoneId)
    if (m.reward) {
      if (m.reward.soulStone) this._d.soulStone = (this._d.soulStone || 0) + m.reward.soulStone
      if (m.reward.awakenStone) this._d.awakenStone = (this._d.awakenStone || 0) + m.reward.awakenStone
    }
    this._save()
    return { success: true, reward: m.reward || null, buff: m.buff || null }
  }

  getDexBuffs() {
    const { getDexBuffs } = require('./dexConfig')
    return getDexBuffs(this._d.dexMilestonesClaimed || [])
  }

  // ===== 修炼系统 =====
  get cultivation() { return this._d.cultivation }

  get selectedAvatar() { return this._d.selectedAvatar || 'boy1' }
  setSelectedAvatar(id) { this._d.selectedAvatar = id; this._save() }

  get unlockedAvatars() {
    if (!Array.isArray(this._d.unlockedAvatars)) this._d.unlockedAvatars = ['boy1', 'girl1']
    return this._d.unlockedAvatars
  }

  isAvatarUnlocked(avatarId) {
    return this.unlockedAvatars.includes(avatarId)
  }

  unlockAvatar(avatarId) {
    if (!Array.isArray(this._d.unlockedAvatars)) this._d.unlockedAvatars = ['boy1', 'girl1']
    if (!this._d.unlockedAvatars.includes(avatarId)) {
      this._d.unlockedAvatars.push(avatarId)
      this._save()
    }
  }

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
    if (amount <= 0) return this._tryCultLevelUp()  // amount=0时仍尝试补升（经验表变更导致的历史溢出）
    const { MAX_LEVEL, expToNextLevel } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (cult.level == null || cult.level < 1) cult.level = 1
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

  /**
   * 尝试消化已有溢出经验（经验表下调后旧存档可能经验已够升级）
   * 返回补升的次数
   */
  _tryCultLevelUp() {
    const { MAX_LEVEL, expToNextLevel } = require('./cultivationConfig')
    const cult = this._d.cultivation
    if (!cult || cult.level == null || cult.level < 1) return 0
    if (cult.skillPoints == null) cult.skillPoints = 0
    let levelUps = 0
    while (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      if (cult.exp < needed) break
      cult.exp -= needed
      cult.level++
      cult.skillPoints++
      levelUps++
    }
    if (levelUps > 0) this._save()
    return levelUps
  }

  // ===== 新手指引 =====

  isGuideShown(id) { return !!(this._d.guideFlags && this._d.guideFlags[id]) }
  markGuideShown(id) {
    if (!this._d.guideFlags) this._d.guideFlags = {}
    this._d.guideFlags[id] = true
    this._save()
  }

  // ===== 灵宠池系统 =====

  get petPool() { return this._d.petPool || [] }
  get petPoolCount() { return (this._d.petPool || []).length }
  get soulStone() { return this._d.soulStone || 0 }
  // 向后兼容旧名
  get petExpPool() { return this.soulStone }

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
    const banked = (this._d.fragmentBank && this._d.fragmentBank[petId]) || 0
    pool.push({
      id: petId,
      attr: pet.attr,
      star: 1,
      level: ENTRY_LEVEL,
      fragments: ENTRY_FRAGMENTS + banked,
      source,
      obtainedAt: Date.now(),
    })
    if (banked > 0) delete this._d.fragmentBank[petId]
    this._save()
    const count = pool.length
    if (this._eventBus) {
      this._eventBus.emit('petPool:add', { petId, count, source })
    }
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
    this._d.soulStone = (this._d.soulStone || 0) + expGained
    this._save()
    return expGained
  }

  /** 增加灵石 */
  addSoulStone(amount) {
    if (amount <= 0) return
    this._d.soulStone = (this._d.soulStone || 0) + amount
    this._save()
  }

  /** 消耗灵石，返回是否成功 */
  consumeAwakenStone(amount) {
    if (amount <= 0) return false
    if ((this._d.awakenStone || 0) < amount) return false
    this._d.awakenStone -= amount
    this._save()
    return true
  }

  /** 增加觉醒石 */
  addAwakenStone(amount) {
    if (amount <= 0) return
    this._d.awakenStone = (this._d.awakenStone || 0) + amount
    this._save()
  }

  /** 读取觉醒石数量 */
  get awakenStone() { return this._d.awakenStone || 0 }

  /**
   * 从灵石池投入经验给指定宠物，返回升级次数
   * @param {string} petId - 目标宠物ID
   * @param {number} amount - 投入灵石量
   */
  investSoulStone(petId, amount) {
    const { petExpToNextLevel, POOL_MAX_LV, POOL_ADV_MAX_LV } = require('./petPoolConfig')
    const { getPetRarity } = require('./pets')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry || amount <= 0) return 0
    const available = Math.min(amount, this._d.soulStone || 0)
    if (available <= 0) return 0
    const maxLv = entry.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
    if (entry.level >= maxLv) return 0
    const rarity = getPetRarity(entry.id)
    let spent = 0, levelUps = 0
    let remaining = available
    while (entry.level < maxLv && remaining > 0) {
      const needed = petExpToNextLevel(entry.level, rarity)
      if (remaining >= needed) {
        remaining -= needed
        spent += needed
        entry.level++
        levelUps++
      } else {
        break
      }
    }
    if (spent > 0) {
      this._d.soulStone -= spent
      this.addDailyTaskProgress('pet_feed', 1)
      this._save()
    }
    return levelUps
  }

  /**
   * 升星（消耗碎片，需满足等级门槛）
   */
  upgradePoolPetStar(petId) {
    const { POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_STAR_AWAKEN_COST } = require('./petPoolConfig')
    const entry = (this._d.petPool || []).find(p => p.id === petId)
    if (!entry) return { ok: false, reason: 'not_found' }
    const nextStar = entry.star + 1
    const maxStar = entry.source === 'stage' ? 4 : 3
    if (nextStar > maxStar) return { ok: false, reason: 'max_star' }
    const lvReq = POOL_STAR_LV_REQ[nextStar]
    if (entry.level < lvReq) return { ok: false, reason: 'level_low', required: lvReq }
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    if (entry.fragments < fragCost) return { ok: false, reason: 'fragments_low', required: fragCost }
    const awakenCost = (nextStar >= 4 && POOL_STAR_AWAKEN_COST[nextStar]) || 0
    if (awakenCost > 0 && (this._d.awakenStone || 0) < awakenCost) {
      return { ok: false, reason: 'awaken_stone_low', required: awakenCost }
    }
    entry.fragments -= fragCost
    if (awakenCost > 0) this._d.awakenStone -= awakenCost
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
    // 节流：每 5 秒最多触发一次恢复计算，避免每帧 Date.now() 开销
    const now = Date.now()
    if (!this._staminaLastCheck || now - this._staminaLastCheck > 5000) {
      this._recoverStamina()
      this._staminaLastCheck = now
    }
    return this._d.stamina.current
  }

  get maxStamina() {
    const cultLv = (this._d.cultivation && this._d.cultivation.level) || 1
    // 基础上限 = STAMINA_INITIAL；修炼 Lv1 不额外加，从 Lv2 起每级 +1
    return STAMINA_INITIAL + Math.max(0, cultLv - 1)
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
    const elapsed = Date.now() - (s.lastRecoverTime || Date.now())
    const remain = STAMINA_RECOVER_INTERVAL_MS - (elapsed % STAMINA_RECOVER_INTERVAL_MS)
    return Math.ceil(remain / 1000)
  }

  _recoverStamina() {
    let s = this._d.stamina
    if (!s || typeof s !== 'object' || typeof s.current !== 'number') {
      this._d.stamina = { current: STAMINA_INITIAL, max: STAMINA_INITIAL, lastRecoverTime: Date.now() }
      s = this._d.stamina
      this._save()
    }
    const dynMax = this.maxStamina
    s.max = dynMax
    const cultLv = (this._d.cultivation && this._d.cultivation.level) || 1
    const legacyNaturalCap = STAMINA_INITIAL + cultLv
    if (s.current === legacyNaturalCap && legacyNaturalCap === dynMax + 1) {
      s.current = dynMax
    }
    if (!s.lastRecoverTime) { s.lastRecoverTime = Date.now(); return }
    const now = Date.now()
    const elapsed = now - s.lastRecoverTime
    const recovered = Math.floor(elapsed / STAMINA_RECOVER_INTERVAL_MS)
    if (recovered > 0) {
      // 仅在本体低于自然上限时累计时间恢复；签到/任务等奖励可使 current > dynMax，不得被 min 扣回
      if (s.current < dynMax) {
        s.current = Math.min(dynMax, s.current + recovered)
      }
      s.lastRecoverTime += recovered * STAMINA_RECOVER_INTERVAL_MS
    }
  }

  /** 签到、任务、广告等奖励体力：可超过 cultivation 决定的体力上限 */
  addBonusStamina(amount) {
    const n = Math.floor(Number(amount) || 0)
    if (n <= 0) return
    this._recoverStamina()
    this._d.stamina.current += n
    this._save()
  }

  // ===== 侧边栏复访奖励（抖音必接） =====

  get sidebarRewardClaimedToday() {
    return this._d.sidebarRewardDate === localDateKey()
  }

  claimSidebarReward() {
    if (this.sidebarRewardClaimedToday) return false
    this._recoverStamina()
    this._d.stamina.current += STAMINA_SIDEBAR_REWARD
    this._d.sidebarRewardDate = localDateKey()
    this._save()
    return true
  }

  // ===== 签到系统 =====

  _ensureLoginSign() {
    if (!this._d.loginSign) this._d.loginSign = { day: 0, lastDate: '', isNewbie: true }
  }

  get loginSign() { this._ensureLoginSign(); return this._d.loginSign }

  get canSignToday() {
    this._ensureLoginSign()
    return this._d.loginSign.lastDate !== localDateKey()
  }

  claimLoginReward() {
    if (!this.canSignToday) return null
    this._ensureLoginSign()
    const sign = this._d.loginSign
    sign.day = (sign.day % 7) + 1
    if (sign.day === 1 && sign.lastDate) sign.isNewbie = false
    sign.lastDate = localDateKey()
    const { LOGIN_REWARDS, LOGIN_WEEKLY_RATIO } = require('./giftConfig')
    const base = LOGIN_REWARDS[sign.day - 1]
    if (!base) { this._save(); return null }
    const ratio = sign.isNewbie ? 1 : LOGIN_WEEKLY_RATIO
    const r = base.rewards
    if (r.soulStone) this.addSoulStone(Math.floor(r.soulStone * ratio))
    if (r.awakenStone) this.addAwakenStone(Math.floor(r.awakenStone * ratio))
    if (r.stamina) this.addBonusStamina(Math.floor(r.stamina * ratio))
    if (r.fragment) this.addRandomFragments(Math.floor(r.fragment * ratio))
    this._save()
    return { day: sign.day, rewards: r, isNewbie: sign.isNewbie, ratio }
  }

  // ===== 每日任务 =====

  _ensureDailyTask() {
    const today = localDateKey()
    if (!this._d.dailyTaskProgress || this._d.dailyTaskProgress.date !== today) {
      this._d.dailyTaskProgress = { date: today, tasks: {}, claimed: {}, allClaimed: false }
    }
  }

  get dailyTaskProgress() { this._ensureDailyTask(); return this._d.dailyTaskProgress }

  /** 首页「每日奖励」入口红点：今日未签到、任一条任务可领未领、或全完成但未领额外奖 */
  get hasDailyRewardEntryBadge() {
    if (this.canSignToday) return true
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    const { DAILY_TASKS } = require('./giftConfig')
    for (const task of DAILY_TASKS) {
      const cur = p.tasks[task.id] || 0
      if (cur >= task.condition.count && !p.claimed[task.id]) return true
    }
    const allDone = DAILY_TASKS.every(t => p.claimed[t.id])
    if (allDone && !p.allClaimed) return true
    return false
  }

  addDailyTaskProgress(taskId, amount) {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    p.tasks[taskId] = (p.tasks[taskId] || 0) + (amount || 1)
    this._save()
  }

  claimDailyTask(taskId) {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    if (p.claimed[taskId]) return false
    const { DAILY_TASKS, getScaledDailyTaskReward } = require('./giftConfig')
    const task = DAILY_TASKS.find(t => t.id === taskId)
    if (!task) return false
    if ((p.tasks[taskId] || 0) < task.condition.count) return false
    p.claimed[taskId] = true
    const r = getScaledDailyTaskReward(task, this.currentChapter)
    if (r.soulStone) this.addSoulStone(r.soulStone)
    if (r.fragment) this.addRandomFragments(r.fragment)
    if (r.awakenStone) this.addAwakenStone(r.awakenStone)
    if (r.stamina) this.addBonusStamina(r.stamina)
    this._save()
    return true
  }

  claimDailyAllBonus() {
    this._ensureDailyTask()
    const p = this._d.dailyTaskProgress
    if (p.allClaimed) return false
    const { DAILY_TASKS, getScaledDailyAllBonus } = require('./giftConfig')
    const allDone = DAILY_TASKS.every(t => p.claimed[t.id])
    if (!allDone) return false
    p.allClaimed = true
    const r = getScaledDailyAllBonus(this.currentChapter)
    if (r.soulStone) this.addSoulStone(r.soulStone)
    if (r.fragment) this.addRandomFragments(r.fragment)
    if (r.stamina) this.addBonusStamina(r.stamina)
    this._save()
    return true
  }

  // ===== 分享追踪 =====

  _ensureShareTracking() {
    const today = localDateKey()
    if (!this._d.shareTracking || this._d.shareTracking.date !== today) {
      this._d.shareTracking = { date: today, rewardCount: this._d.shareTracking ? 0 : 0, firstEverDone: (this._d.shareTracking && this._d.shareTracking.firstEverDone) || false }
    }
  }

  get shareTracking() { this._ensureShareTracking(); return this._d.shareTracking }

  recordShare() {
    this._ensureShareTracking()
    const st = this._d.shareTracking
    const { SHARE_DAILY_MAX, SHARE_PER_REWARD, SHARE_FIRST_EVER_BONUS } = require('./giftConfig')
    let rewarded = false
    if (st.rewardCount < SHARE_DAILY_MAX) {
      st.rewardCount++
      if (SHARE_PER_REWARD.stamina) this.addBonusStamina(SHARE_PER_REWARD.stamina)
      rewarded = true
    }
    if (!st.firstEverDone) {
      st.firstEverDone = true
      if (SHARE_FIRST_EVER_BONUS.soulStone) this.addSoulStone(SHARE_FIRST_EVER_BONUS.soulStone)
    }
    this.addDailyTaskProgress('share_1', 1)
    this._save()
    return rewarded
  }

  // ===== 回归检测 =====

  checkComeback() {
    const now = Date.now()
    const last = this._d.lastActiveDate
    this._d.lastActiveDate = localDateKey()
    if (!last) { this._save(); return false }
    const lastTs = new Date(last + 'T00:00:00').getTime()
    const { COMEBACK_THRESHOLD_MS, COMEBACK_REWARD } = require('./giftConfig')
    if (now - lastTs < COMEBACK_THRESHOLD_MS) { this._save(); return false }
    if (COMEBACK_REWARD.staminaFull) { this._recoverStamina(); this._d.stamina.current = this._d.stamina.max }
    if (COMEBACK_REWARD.soulStone) this.addSoulStone(COMEBACK_REWARD.soulStone)
    this._save()
    return true
  }

  updateActiveDate() {
    this._d.lastActiveDate = localDateKey()
    this._save()
  }

  // ===== 邀请系统 =====

  processInvite(inviterId) {
    if (!inviterId) return false
    if (this._d.invitedBy) return false
    const { INVITE_REWARD } = require('./giftConfig')
    this._d.invitedBy = inviterId
    if (INVITE_REWARD.soulStone) this.addSoulStone(INVITE_REWARD.soulStone)
    this._save()
    return true
  }

  // ===== 固定关卡记录 =====

  /** 根据已通关记录推算玩家当前所在章节（1-5），用于经济体系缩放 */
  get currentChapter() {
    const rec = this._d.stageClearRecord || {}
    let maxCh = 1
    for (const sid of Object.keys(rec)) {
      if (rec[sid] && rec[sid].cleared) {
        const m = sid.match(/^stage_(\d+)_/)
        if (m) { const ch = parseInt(m[1], 10); if (ch > maxCh) maxCh = ch }
      }
    }
    return Math.min(maxCh, 12)
  }

  get stageClearRecord() {
    return this._d.stageClearRecord || (this._d.stageClearRecord = {})
  }

  isStageCleared(stageId) {
    return !!(this._d.stageClearRecord && this._d.stageClearRecord[stageId] && this._d.stageClearRecord[stageId].cleared)
  }

  getStageBestRating(stageId) {
    return (this._d.stageClearRecord && this._d.stageClearRecord[stageId] && this._d.stageClearRecord[stageId].bestRating) || null
  }

  getStageClearCount(stageId) {
    return (this._d.stageClearRecord && this._d.stageClearRecord[stageId] && this._d.stageClearRecord[stageId].clearCount) || 0
  }

  recordStageClear(stageId, rating, isFirst) {
    const RATING_ORDER = { B: 1, A: 2, S: 3 }
    const record = this._d.stageClearRecord || (this._d.stageClearRecord = {})
    if (!record[stageId]) record[stageId] = { cleared: false, bestRating: null, clearCount: 0, starsClaimed: [false, false, false] }
    const r = record[stageId]
    r.cleared = true
    r.clearCount++
    if (!r.bestRating || RATING_ORDER[rating] > RATING_ORDER[r.bestRating]) {
      r.bestRating = rating
    }
    if (!r.starsClaimed) r.starsClaimed = [false, false, false]
    this._save()
  }

  // ===== 星级奖励领取 =====

  getStageStarsClaimed(stageId) {
    const r = this._d.stageClearRecord && this._d.stageClearRecord[stageId]
    return (r && r.starsClaimed) || [false, false, false]
  }

  claimStageStar(stageId, starIndex) {
    const record = this._d.stageClearRecord || (this._d.stageClearRecord = {})
    if (!record[stageId]) record[stageId] = { cleared: false, bestRating: null, clearCount: 0, starsClaimed: [false, false, false] }
    if (!record[stageId].starsClaimed) record[stageId].starsClaimed = [false, false, false]
    record[stageId].starsClaimed[starIndex] = true
    this._save()
  }

  // ===== 章节通关宝箱 =====

  isChapterClearClaimed(chapterId) {
    const m = this._d.chapterClearClaimed || {}
    return !!m[chapterId]
  }

  claimChapterClear(chapterId) {
    if (!this._d.chapterClearClaimed) this._d.chapterClearClaimed = {}
    this._d.chapterClearClaimed[chapterId] = true
    this._save()
  }

  getChapterTotalStars(chapterId, difficulty) {
    const RATING_TO_STARS = { S: 3, A: 2, B: 1 }
    const { getChapterStages } = require('./stages')
    const stages = getChapterStages(chapterId, difficulty || 'normal')
    let total = 0
    for (const s of stages) {
      const best = this.getStageBestRating(s.id)
      total += RATING_TO_STARS[best] || 0
    }
    return total
  }

  // ===== 秘境排行统计 =====

  getStageTotalStars() {
    const RATING_TO_STARS = { S: 3, A: 2, B: 1 }
    const rec = this._d.stageClearRecord || {}
    let total = 0
    for (const id of Object.keys(rec)) {
      if (rec[id].cleared) total += RATING_TO_STARS[rec[id].bestRating] || 0
    }
    return total
  }

  getStageClearCount() {
    const rec = this._d.stageClearRecord || {}
    let count = 0
    for (const id of Object.keys(rec)) {
      if (rec[id].cleared && !id.endsWith('_elite')) count++
    }
    return count
  }

  getStageEliteClearCount() {
    const rec = this._d.stageClearRecord || {}
    let count = 0
    for (const id of Object.keys(rec)) {
      if (rec[id].cleared && id.endsWith('_elite')) count++
    }
    return count
  }

  getFarthestChapter() {
    const rec = this._d.stageClearRecord || {}
    let max = 0
    for (const id of Object.keys(rec)) {
      if (!rec[id].cleared) continue
      const m = id.match(/^stage_(\d+)_/)
      if (m) max = Math.max(max, parseInt(m[1], 10))
    }
    return max
  }

  /**
   * 已通关关卡中，按章节/关卡序号最远的一关（用于排行展示，不暴露总关卡数）
   * @param {boolean} elite true=精英 stage_*_*_elite，false=普通 stage_*_*
   * @returns {{ chapter: number, order: number } | null}
   */
  getFarthestClearedStageCoords(elite) {
    const rec = this._d.stageClearRecord || {}
    let bestCh = 0
    let bestOrd = 0
    const re = elite ? /^stage_(\d+)_(\d+)_elite$/ : /^stage_(\d+)_(\d+)$/
    for (const id of Object.keys(rec)) {
      if (!rec[id].cleared) continue
      if (elite !== !!id.endsWith('_elite')) continue
      const m = id.match(re)
      if (!m) continue
      const ch = parseInt(m[1], 10)
      const ord = parseInt(m[2], 10)
      if (ch > bestCh || (ch === bestCh && ord > bestOrd)) {
        bestCh = ch
        bestOrd = ord
      }
    }
    if (bestCh === 0) return null
    return { chapter: bestCh, order: bestOrd }
  }

  // ===== 每日挑战次数 =====

  _refreshDailyChallenges() {
    const today = localDateKey()
    if (!this._d.dailyChallenges || this._d.dailyChallenges.date !== today) {
      this._d.dailyChallenges = { date: today, counts: {} }
    }
  }

  canChallengeStage(stageId, dailyLimit) {
    if (!dailyLimit) return true
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

  // ===== 通天塔每日次数 =====

  _refreshTowerDaily() {
    const today = localDateKey()
    if (!this._d.towerDaily || this._d.towerDaily.date !== today) {
      this._d.towerDaily = { date: today, runs: 0, adRuns: 0 }
    }
  }

  getTowerDailyRuns() {
    this._refreshTowerDaily()
    return this._d.towerDaily.runs
  }

  getTowerDailyAdRuns() {
    this._refreshTowerDaily()
    return this._d.towerDaily.adRuns
  }

  canStartTowerRun() {
    const { TOWER_DAILY } = require('./economyConfig')
    this._refreshTowerDaily()
    const td = this._d.towerDaily
    return (td.runs < TOWER_DAILY.freeRuns) || (td.adRuns < TOWER_DAILY.adExtraRuns)
  }

  canStartTowerRunFree() {
    const { TOWER_DAILY } = require('./economyConfig')
    this._refreshTowerDaily()
    return this._d.towerDaily.runs < TOWER_DAILY.freeRuns
  }

  recordTowerRun() {
    this._refreshTowerDaily()
    this._d.towerDaily.runs++
    this._save()
  }

  recordTowerAdRun() {
    this._refreshTowerDaily()
    this._d.towerDaily.adRuns++
    this._save()
  }

  // ===== 持久化编队 =====

  get savedStageTeam() {
    return this._d.savedStageTeam || []
  }

  /** 保存编队：保留顺序，可多属性重复；过滤不在池中的 ID、同一只灵宠不重复入队 */
  saveStageteam(teamIds) {
    const poolIds = new Set((this._d.petPool || []).map(p => p.id))
    const seen = new Set()
    const out = []
    for (const id of teamIds || []) {
      if (!id || !poolIds.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
    this._d.savedStageTeam = out
    this._save()
  }

  /** 获取有效的已保存编队（排除已不在池中的、非法重复 ID） */
  getValidSavedTeam() {
    const saved = this._d.savedStageTeam || []
    if (saved.length === 0) return []
    const poolIds = new Set((this._d.petPool || []).map(p => p.id))
    const seen = new Set()
    const out = []
    for (const id of saved) {
      if (!poolIds.has(id) || seen.has(id)) continue
      seen.add(id)
      out.push(id)
    }
    const same = out.length === saved.length && out.every((id, i) => id === saved[i])
    if (!same) {
      this._d.savedStageTeam = out
      this._save()
    }
    return out
  }

  // ===== 灵宠派遣（挂机）系统 =====

  get idleDispatch() { return this._d.idleDispatch || (this._d.idleDispatch = { slots: [], lastCollect: 0 }) }

  /** 派遣一只宠物（添加到槽位） */
  idleAssign(petId) {
    const { IDLE_MAX_SLOTS } = require('./petPoolConfig')
    const dispatch = this.idleDispatch
    if (dispatch.slots.length >= IDLE_MAX_SLOTS) return false
    if (dispatch.slots.find(s => s.petId === petId)) return false
    const pool = this._d.petPool || []
    if (!pool.find(p => p.id === petId)) return false
    dispatch.slots.push({ petId, startTime: Date.now() })
    this._save()
    return true
  }

  /** 撤回一只派遣中的宠物 */
  idleRecall(petId) {
    const dispatch = this.idleDispatch
    const idx = dispatch.slots.findIndex(s => s.petId === petId)
    if (idx < 0) return false
    dispatch.slots.splice(idx, 1)
    this._save()
    return true
  }

  /** 检查是否有可收取的派遣产出 */
  idleHasReward() {
    const { IDLE_FRAG_INTERVAL } = require('./petPoolConfig')
    const dispatch = this.idleDispatch
    if (dispatch.slots.length === 0) return false
    const now = Date.now()
    return dispatch.slots.some(s => (now - s.startTime) >= IDLE_FRAG_INTERVAL)
  }

  /**
   * 收取所有派遣产出（碎片归各宠物，经验归共享池）
   * @returns {{ totalFragments: number, totalSoulStone: number, details: Array }} 产出明细
   */
  idleCollect() {
    const { calcIdleReward } = require('./petPoolConfig')
    const dispatch = this.idleDispatch
    if (dispatch.slots.length === 0) return null
    const now = Date.now()
    let totalFragments = 0, totalSoulStone = 0
    const details = []
    for (const slot of dispatch.slots) {
      const elapsed = now - slot.startTime
      const poolPet = (this._d.petPool || []).find(p => p.id === slot.petId)
      if (!poolPet) continue
      const reward = calcIdleReward(elapsed, poolPet.level)
      if (reward.fragments > 0) {
        poolPet.fragments = (poolPet.fragments || 0) + reward.fragments
        totalFragments += reward.fragments
      }
      if (reward.soulStone > 0) {
        totalSoulStone += reward.soulStone
      }
      details.push({ petId: slot.petId, fragments: reward.fragments, soulStone: reward.soulStone })
      slot.startTime = now
    }
    if (totalSoulStone > 0) {
      this._d.soulStone = (this._d.soulStone || 0) + totalSoulStone
    }
    dispatch.lastCollect = now
    this.addDailyTaskProgress('idle_collect', 1)
    this._save()
    return { totalFragments, totalSoulStone, details }
  }

  /** 获取当前派遣中的宠物ID列表 */
  get idleSlotPetIds() {
    return (this.idleDispatch.slots || []).map(s => s.petId)
  }

  // ===== 法宝背包 & 装备 =====

  get weaponCollection() {
    return this._d.weaponCollection || []
  }

  get equippedWeaponId() {
    return this._d.equippedWeaponId || null
  }

  addWeapon(weaponId) {
    if (!this._d.weaponCollection) this._d.weaponCollection = []
    if (!this._d.weaponCollection.includes(weaponId)) {
      this._d.weaponCollection.push(weaponId)
      this._save()
      return true
    }
    return false
  }

  equipWeapon(weaponId) {
    if (weaponId && !this._d.weaponCollection.includes(weaponId)) return false
    this._d.equippedWeaponId = weaponId
    this._save()
    return true
  }

  unequipWeapon() {
    this._d.equippedWeaponId = null
    this._save()
  }

  hasWeapon(weaponId) {
    return (this._d.weaponCollection || []).includes(weaponId)
  }

  // ===== 碎片银行 =====

  /** 给碎片银行中某宠物加碎片 */
  addFragmentToBank(petId, count = 1) {
    this._ensureCultivationFields()
    if (!this._d.fragmentBank[petId]) this._d.fragmentBank[petId] = 0
    this._d.fragmentBank[petId] += count
    this._save()
  }

  /**
   * 智能添加碎片：已入池→直接加到宠物上，未入池→进银行
   */
  addFragmentSmart(petId, count = 1) {
    const pet = this.getPoolPet(petId)
    if (pet) {
      pet.fragments = (pet.fragments || 0) + count
      this._save()
    } else {
      this.addFragmentToBank(petId, count)
    }
  }

  /**
   * 按品质权重分配碎片给随机宠物（一次分配 count 片给同一只宠物）
   * @param {number} count
   * @param {object} [rarityWeights] - 缺省时使用 chestConfig.DEFAULT_RANDOM_FRAG_WEIGHTS
   * @returns {{ petId, count }}
   */
  addRandomFragments(count, rarityWeights) {
    const { rollPetByRarity } = require('./chestConfig')
    const petId = rollPetByRarity(rarityWeights)
    this.addFragmentSmart(petId, count)
    return { petId, count }
  }

  /** 获取碎片银行全部数据 */
  get fragmentBank() {
    this._ensureCultivationFields()
    return this._d.fragmentBank
  }

  /** 获取碎片银行中某宠物的碎片数 */
  getBankFragments(petId) {
    this._ensureCultivationFields()
    return this._d.fragmentBank[petId] || 0
  }

  // ===== 碎片召唤 =====

  /**
   * 用碎片银行的碎片召唤宠物
   * @returns {{ success, message }}
   */
  summonPet(petId) {
    const { SUMMON_FRAG_COST } = require('./chestConfig')
    const { getPetRarity } = require('./pets')

    this._ensureCultivationFields()
    const banked = this._d.fragmentBank[petId] || 0
    const rarity = getPetRarity(petId)
    const cost = SUMMON_FRAG_COST[rarity] || 15

    if (banked < cost) return { success: false, message: `碎片不足（需${cost}，有${banked}）` }
    if (this.getPoolPet(petId)) return { success: false, message: '已拥有该灵宠' }

    this._d.fragmentBank[petId] -= cost
    if (this._d.fragmentBank[petId] <= 0) delete this._d.fragmentBank[petId]

    this.addToPetPool(petId, 'summon')
    return { success: true, message: '召唤成功' }
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
    if (cloudSync.isReady()) {
      try {
        if (P.isDouyin) {
          await api.syncPlayerData(this._d)
        } else if (cloudSync.getOpenid()) {
          const db = P.cloud.database()
          const res = await db.collection('playerData').where({ _openid: cloudSync.getOpenid() }).get()
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

  /**
   * 抖音端获取用户信息（通过 tt.getUserInfo）
   * 成功后更新 userInfo 和 userAuthorized
   */
  requestDouyinUserInfo(callback) {
    console.log('[Douyin] 尝试获取用户信息...')
    P.getUserInfo({
      withCredentials: false,
      success: (res) => {
        console.log('[Douyin] getUserInfo 返回:', JSON.stringify(res).slice(0, 300))
        if (res.userInfo && res.userInfo.nickName) {
          const info = {
            nickName: res.userInfo.nickName,
            avatarUrl: res.userInfo.avatarUrl || '',
          }
          console.log('[Douyin] 获取用户信息成功:', info.nickName)
          this._saveUserInfo(info)
          if (callback) callback(true, info)
        } else {
          console.warn('[Douyin] getUserInfo 返回空信息')
          if (callback) callback(false)
        }
      },
      fail: (err) => {
        console.warn('[Douyin] getUserInfo 失败:', err.errMsg || err)
        if (callback) callback(false)
      },
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

  // ===== 排行榜（委托 RankingService）=====

  get rankAllList() { return this._ranking.rankAllList }
  set rankAllList(v) { this._ranking.rankAllList = v }
  get rankDexList() { return this._ranking.rankDexList }
  set rankDexList(v) { this._ranking.rankDexList = v }
  get rankComboList() { return this._ranking.rankComboList }
  set rankComboList(v) { this._ranking.rankComboList = v }
  get rankStageList() { return this._ranking.rankStageList }
  set rankStageList(v) { this._ranking.rankStageList = v }
  get rankStageMyRank() { return this._ranking.rankStageMyRank }
  set rankStageMyRank(v) { this._ranking.rankStageMyRank = v }
  get rankAllMyRank() { return this._ranking.rankAllMyRank }
  set rankAllMyRank(v) { this._ranking.rankAllMyRank = v }
  get rankDexMyRank() { return this._ranking.rankDexMyRank }
  set rankDexMyRank(v) { this._ranking.rankDexMyRank = v }
  get rankComboMyRank() { return this._ranking.rankComboMyRank }
  set rankComboMyRank(v) { this._ranking.rankComboMyRank = v }
  get rankLoading() { return this._ranking.rankLoading }
  set rankLoading(v) { this._ranking.rankLoading = v }
  get rankLoadingMsg() { return this._ranking.rankLoadingMsg }
  set rankLoadingMsg(v) { this._ranking.rankLoadingMsg = v }
  get rankLastFetch() { return this._ranking.rankLastFetch }
  set rankLastFetch(v) { this._ranking.rankLastFetch = v }
  get rankLastFetchTab() { return this._ranking.rankLastFetchTab }
  set rankLastFetchTab(v) { this._ranking.rankLastFetchTab = v }

  submitScore(floor, pets, weapon, totalTurns) {
    return this._ranking.submitScore(floor, pets, weapon, totalTurns)
  }
  submitDexAndCombo() {
    return this._ranking.submitDexAndCombo()
  }
  submitStageRanking() {
    return this._ranking.submitStageRanking()
  }
  fetchRanking(tab, force) {
    return this._ranking.fetchRanking(tab, force)
  }
  fetchRankingCombined(tab, needSubmit) {
    return this._ranking.fetchRankingCombined(tab, needSubmit)
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
        // 二测删档检测
        this._checkDataVersion()
      } else {
        this._d = defaultPersist()
      }
    } catch(e) {
      console.warn('Storage load error:', e)
      this._d = defaultPersist()
    }
  }

  _checkDataVersion() {
    const { DATA_VERSION, WIPE_COMPENSATION } = require('./giftConfig')
    if ((this._d.dataVersion || 0) < DATA_VERSION) {
      const playerId = this._d.playerId || null
      this._d = defaultPersist()
      if (playerId) this._d.playerId = playerId
      this._d.dataVersion = DATA_VERSION
      if (WIPE_COMPENSATION.staminaFull) this._d.stamina.current = this._d.stamina.max
      if (WIPE_COMPENSATION.soulStone) this._d.soulStone = WIPE_COMPENSATION.soulStone
      if (WIPE_COMPENSATION.awakenStone) this._d.awakenStone = WIPE_COMPENSATION.awakenStone
      if (WIPE_COMPENSATION.fragment) {
        const targets = ['m1', 'w1', 's1', 'e1', 'f1']
        const each = Math.floor(WIPE_COMPENSATION.fragment / targets.length)
        targets.forEach(id => { this._d.fragmentBank[id] = each })
      }
      this._d._pendingWipeNotice = true
      this._d._updateTime = Date.now()
      this._save()
      P.removeStorageSync('introDone')
      P.removeStorageSync('tutorialDone')
      console.log('[Storage] 大版本清档完成，已发放补偿')
    }
  }

  clearWipeNotice() {
    this._d._pendingWipeNotice = false
    this._save()
  }

  // 补全持久化子字段（兼容任何版本的存档残缺）
  _ensureCultivationFields() {
    const cult = this._d.cultivation
    if (!cult) { this._d.cultivation = defaultPersist().cultivation; return }
    if (cult.level == null || cult.level < 1) cult.level = 1
    if (cult.exp == null) cult.exp = 0
    if (cult.totalExpEarned == null) cult.totalExpEarned = 0
    if (cult.skillPoints == null) cult.skillPoints = 0
    if (!cult.levels) cult.levels = { body:0, spirit:0, wisdom:0, defense:0, sense:0 }
    if (cult.realmBreakSeen == null) cult.realmBreakSeen = 0
    if (!this._d.selectedAvatar) this._d.selectedAvatar = 'boy1'
    if (!Array.isArray(this._d.unlockedAvatars)) this._d.unlockedAvatars = ['boy1', 'girl1']
    // Phase 2 字段补全
    if (!this._d.petPool) this._d.petPool = []
    if (this._d.soulStone == null) this._d.soulStone = 0
    if (this._d.awakenStone == null) this._d.awakenStone = 0
    if (!this._d.stamina) this._d.stamina = { current: STAMINA_INITIAL, max: STAMINA_INITIAL, lastRecoverTime: Date.now() }
    // Phase 3 字段补全
    if (!this._d.stageClearRecord) this._d.stageClearRecord = {}
    if (!this._d.dailyChallenges) this._d.dailyChallenges = { date: '', counts: {} }
    if (!this._d.savedStageTeam) this._d.savedStageTeam = []
    if (!this._d.sidebarRewardDate) this._d.sidebarRewardDate = ''
    // Phase 4 字段补全
    if (!this._d.idleDispatch) this._d.idleDispatch = { slots: [], lastCollect: 0 }
    // Phase 5 字段补全
    if (!this._d.fragmentBank) this._d.fragmentBank = {}
    if (!this._d.chestRewards) this._d.chestRewards = { claimed: {} }
    if (!this._d.adWatchLog) this._d.adWatchLog = {}
    if (!this._d.towerDaily) this._d.towerDaily = { date: '', runs: 0, adRuns: 0 }
  }

  _save() {
    try {
      P.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
      cloudSync.debounceSyncToCloud(this._d)
      if (this._eventBus) this._eventBus.emit('data:save')
    } catch(e) {
      console.warn('Storage save error:', e)
    }
  }

  async _initCloud() {
    await cloudSync.init(this._d, {
      localKey: LOCAL_KEY,
      currentVersion: CURRENT_VERSION,
      runMigrations,
      onSyncDone: () => this._onCloudSyncDone(),
    })
    this._ranking.preheatRanking()
  }

  /**
   * 云同步首次拉取完成后的回调
   * 修复：清除缓存后重进，云端数据证明是老玩家时补写 introDone/tutorialDone
   */
  _onCloudSyncDone() {
    const isVeteran = this._d.bestFloor > 0 || this._d.totalRuns > 0
    if (!isVeteran) return

    // 补写独立 key，防止下次启动还走新手流程
    if (!P.getStorageSync('introDone')) {
      P.setStorageSync('introDone', true)
      console.log('[Storage] 云端为老玩家，补写 introDone')
    }
    if (!P.getStorageSync('tutorialDone')) {
      P.setStorageSync('tutorialDone', true)
      console.log('[Storage] 云端为老玩家，补写 tutorialDone')
    }

    // 通知主循环：如果当前还在 intro/教学中，应跳转回首页
    if (this._eventBus) {
      this._eventBus.emit('cloud:veteranRestored')
    }
  }

}

module.exports = Storage
