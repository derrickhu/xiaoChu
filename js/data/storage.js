/**
 * 存储管理 - 适配修仙消消乐法宝系统
 * 本地缓存 + 云数据库双重存储
 */
const { generateEquipment } = require('./equipment')

const LOCAL_KEY = 'xiuxianXXL_v1'
const CLOUD_ENV = 'cloud1-9glro17fb6f566a8'

// 默认玩家数据
function defaultData() {
  // 初始法宝：一把凡品赤焰飞剑
  const starterWeapon = generateEquipment('weapon', 'fire', 'N')
  const starterArmor  = generateEquipment('armor', 'water', 'N')
  return {
    // 修士固定属性
    hero: { baseAtk: 120, baseHp: 3000 },
    // 当前佩戴法宝（6槽位）
    equipped: { weapon:starterWeapon, armor:starterArmor, boots:null, cloak:null, helmet:null, trinket:null },
    // 乾坤袋（永久法宝列表）
    inventory: [starterWeapon, starterArmor],
    // 关卡进度
    levelProgress: {}, // { levelId_difficulty: true }
    currentTheme: 'fire',
    currentLevel: 101,
    // 灵石
    gold: 1000,
    // 每日修炼
    dailyTask: {
      tasks: [
        { id:'dt1', name:'闯秘境1次', target:1, progress:0, done:false, reward:{ gold:200 } },
        { id:'dt2', name:'施展仙术10次', target:10, progress:0, done:false, reward:{ gold:100 } },
        { id:'dt3', name:'获得1件法宝', target:1, progress:0, done:false, reward:{ gold:150 } },
      ],
      allClaimed: false,
      allReward: { equipTier:'R' },
      lastReset: '',
    },
    // 成就（修仙成就）
    achievements: {
      ach_clear_normal:  { name:'初入仙途',    desc:'练气难度通关所有秘境', done:false, claimed:false },
      ach_clear_hard:    { name:'筑基有成',    desc:'筑基难度通关所有秘境', done:false, claimed:false },
      ach_clear_extreme: { name:'金丹大成',    desc:'金丹难度通关所有秘境', done:false, claimed:false },
      ach_combo8:        { name:'天机连珠',    desc:'单次达成8连消', done:false, claimed:false },
      ach_equip_ssr:     { name:'神兵入手',    desc:'拥有1件神品法宝', done:false, claimed:false },
      ach_full_equip:    { name:'法宝齐备',    desc:'同时佩戴6件法宝', done:false, claimed:false },
    },
    // 统计
    stats: { totalBattles:0, totalCombos:0, maxCombo:0, totalSkills:0 },
    // 排行
    bestRecords: {},
  }
}

class Storage {
  constructor() {
    this._d = null
    this._cloudReady = false
    this._openid = ''
    this._load()
    this._initCloud()
  }

  // ===== 数据访问快捷属性 =====
  get hero()         { return this._d.hero }
  get equipped()     { return this._d.equipped }
  get inventory()    { return this._d.inventory }
  get gold()         { return this._d.gold }
  set gold(v)        { this._d.gold = v; this._save() }
  get currentLevel() { return this._d.currentLevel }
  set currentLevel(v){ this._d.currentLevel = v; this._save() }
  get currentTheme() { return this._d.currentTheme }
  set currentTheme(v){ this._d.currentTheme = v; this._save() }
  get dailyTask()    { return this._d.dailyTask }
  get achievements() { return this._d.achievements }
  get stats()        { return this._d.stats }
  get bestRecords()  { return this._d.bestRecords }
  get levelProgress(){ return this._d.levelProgress }

  // ===== 计算修士最终属性（含法宝被动加成） =====
  getHeroStats() {
    let atk = this._d.hero.baseAtk
    let hp  = this._d.hero.baseHp
    let def = 0
    const eq = this._d.equipped
    Object.values(eq).forEach(e => {
      if (!e) return
      e.passives.forEach(p => {
        if (p.field === 'atk') atk += p.val
        if (p.field === 'hp')  hp  += p.val
        if (p.field === 'def') def += p.val
      })
    })
    return { atk, hp, def }
  }

  // ===== 法宝操作 =====
  equipItem(uid) {
    const item = this._d.inventory.find(e => e.uid === uid)
    if (!item) return false
    // 卸下同槽位旧法宝
    this._d.equipped[item.slot] = item
    this._save()
    return true
  }

  unequipSlot(slot) {
    this._d.equipped[slot] = null
    this._save()
  }

  addToInventory(equip) {
    this._d.inventory.push(equip)
    this._save()
  }

  removeFromInventory(uid) {
    this._d.inventory = this._d.inventory.filter(e => e.uid !== uid)
    // 如果正在佩戴则卸下
    Object.keys(this._d.equipped).forEach(slot => {
      if (this._d.equipped[slot] && this._d.equipped[slot].uid === uid) {
        this._d.equipped[slot] = null
      }
    })
    this._save()
  }

  // ===== 关卡进度 =====
  isLevelPassed(levelId, difficulty) {
    return !!this._d.levelProgress[`${levelId}_${difficulty}`]
  }

  passLevel(levelId, difficulty) {
    this._d.levelProgress[`${levelId}_${difficulty}`] = true
    // 自动推进
    if (levelId >= this._d.currentLevel) {
      this._d.currentLevel = levelId + 1
    }
    this._save()
  }

  getPassedCount(difficulty) {
    return Object.keys(this._d.levelProgress).filter(k => k.endsWith('_'+difficulty)).length
  }

  // ===== 每日任务 =====
  updateTaskProgress(taskId, amount) {
    const t = this._d.dailyTask.tasks.find(t => t.id === taskId)
    if (!t || t.done) return
    t.progress = Math.min(t.target, t.progress + amount)
    if (t.progress >= t.target) t.done = true
    this._save()
  }

  claimTaskReward(taskId) {
    const t = this._d.dailyTask.tasks.find(t => t.id === taskId)
    if (!t || !t.done) return null
    if (t.reward.gold) this._d.gold += t.reward.gold
    // 标记已领取(用done+reward清空)
    t.reward = {}
    this._save()
    return true
  }

  checkDailyReset() {
    const today = new Date().toDateString()
    if (this._d.dailyTask.lastReset === today) return
    this._d.dailyTask = defaultData().dailyTask
    this._d.dailyTask.lastReset = today
    this._save()
  }

  // ===== 成就 =====
  checkAchievements(extra) {
    const a = this._d.achievements
    // 天机连珠
    if (extra && extra.combo >= 8 && !a.ach_combo8.done) {
      a.ach_combo8.done = true
    }
    // 神兵入手
    if (this._d.inventory.some(e => e.quality === 'SSR') && !a.ach_equip_ssr.done) {
      a.ach_equip_ssr.done = true
    }
    // 法宝齐备
    if (Object.values(this._d.equipped).every(e => e !== null) && !a.ach_full_equip.done) {
      a.ach_full_equip.done = true
    }
    // 通关成就
    if (this.getPassedCount('normal') >= 70 && !a.ach_clear_normal.done) a.ach_clear_normal.done = true
    if (this.getPassedCount('hard') >= 70 && !a.ach_clear_hard.done)     a.ach_clear_hard.done = true
    if (this.getPassedCount('extreme') >= 70 && !a.ach_clear_extreme.done) a.ach_clear_extreme.done = true
    this._save()
  }

  claimAchievement(achId) {
    const a = this._d.achievements[achId]
    if (!a || !a.done || a.claimed) return false
    a.claimed = true
    this._d.gold += 500
    this._save()
    return true
  }

  // ===== 统计 =====
  recordBattle(combo, skillCount) {
    this._d.stats.totalBattles++
    this._d.stats.totalCombos += combo
    this._d.stats.maxCombo = Math.max(this._d.stats.maxCombo, combo)
    this._d.stats.totalSkills += skillCount
    this._save()
  }

  // ===== 持久化 =====
  _load() {
    try {
      const raw = wx.getStorageSync(LOCAL_KEY)
      if (raw) {
        this._d = JSON.parse(raw)
        // 补全新字段
        const def = defaultData()
        Object.keys(def).forEach(k => {
          if (this._d[k] === undefined) this._d[k] = def[k]
        })
      } else {
        this._d = defaultData()
      }
    } catch(e) {
      console.warn('Storage load error:', e)
      this._d = defaultData()
    }
  }

  _save() {
    try {
      wx.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
      this._syncToCloud()
    } catch(e) {
      console.warn('Storage save error:', e)
    }
  }

  // ===== 云同步 =====
  async _initCloud() {
    try {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
      this._cloudReady = true
      await this._ensureCollections()
      await this._getOpenid()
      await this._syncFromCloud()
    } catch(e) {
      console.warn('Cloud init failed:', e)
    }
  }

  async _ensureCollections() {
    try {
      const r = await wx.cloud.callFunction({ name:'initCollections' })
      if (r.result && r.result.errors && r.result.errors.length) {
        console.warn('创建集合异常:', r.result.errors)
      }
    } catch(e) { /* ignore */ }
  }

  async _getOpenid() {
    try {
      const r = await wx.cloud.callFunction({ name:'getOpenid' })
      this._openid = r.result.openid || ''
    } catch(e) { /* ignore */ }
  }

  async _syncFromCloud() {
    if (!this._cloudReady || !this._openid) return
    try {
      const db = wx.cloud.database()
      const res = await db.collection('playerData').where({ _openid: this._openid }).get()
      if (res.data && res.data.length > 0) {
        const cloud = res.data[0]
        // 云端数据较新时合并（以背包物品数量为简单判断）
        if (cloud.inventory && cloud.inventory.length > this._d.inventory.length) {
          Object.assign(this._d, cloud)
          delete this._d._id
          delete this._d._openid
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
      const data = { ...this._d, _openid: this._openid, _updateTime: Date.now() }
      if (res.data && res.data.length > 0) {
        await col.doc(res.data[0]._id).update({ data })
      } else {
        await col.add({ data })
      }
    } catch(e) { /* debounce/ignore */ }
  }
}

module.exports = Storage
