/**
 * 存储管理 - 适配五行转珠战斗系统
 * 本地缓存 + 云数据库双重存储
 */
const { generateEquipment, ATTRS, ATK_KEY, DEF_KEY } = require('./equipment')

const LOCAL_KEY = 'xiuxianXXL_v3'
const CLOUD_ENV = 'cloud1-9glro17fb6f566a8'

// 默认玩家数据
function defaultData() {
  // 初始装备：一把凡阶火灵飞剑 Lv1 + 一件凡阶水灵衣服 Lv1
  const starterWeapon = generateEquipment('weapon', 'fire', 'white', 1)
  const starterArmor  = generateEquipment('armor', 'water', 'white', 1)
  return {
    // 当前佩戴装备（5槽位）
    equipped: { weapon:starterWeapon, armor:starterArmor, helmet:null, cloak:null, trinket:null },
    // 乾坤袋（永久装备列表）
    inventory: [starterWeapon, starterArmor],
    // 关卡进度
    levelProgress: {},
    currentTheme: 'metal',
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
      allReward: { equipTier:'green' },
      lastReset: '',
    },
    // 成就
    achievements: {
      ach_clear_normal:  { name:'初入仙途', desc:'练气难度通关所有秘境', done:false, claimed:false },
      ach_clear_hard:    { name:'筑基有成', desc:'筑基难度通关所有秘境', done:false, claimed:false },
      ach_clear_extreme: { name:'金丹大成', desc:'金丹难度通关所有秘境', done:false, claimed:false },
      ach_combo8:        { name:'天机连珠', desc:'单次达成8连消', done:false, claimed:false },
      ach_equip_ssr:     { name:'神兵入手', desc:'拥有1件神阶法宝', done:false, claimed:false },
      ach_full_equip:    { name:'法宝齐备', desc:'同时佩戴5件法宝', done:false, claimed:false },
    },
    // 统计
    stats: { totalBattles:0, totalCombos:0, maxCombo:0, totalSkills:0 },
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

  // 计算修士最终属性（气力+五行攻防+回复）
  getHeroStats() {
    // 基础值
    const s = {
      stamina: 800,  // 气力值（影响血量）
      metalAtk: 50, woodAtk: 50, earthAtk: 50, waterAtk: 50, fireAtk: 50,
      metalDef: 15,  woodDef: 15,  earthDef: 15,  waterDef: 15,  fireDef: 15,
      recovery: 30,  // 回复值（心珠回血基础）
    }
    const eq = this._d.equipped
    Object.values(eq).forEach(e => {
      if (!e) return
      // 装备属性直接叠加
      if (e.stats) {
        Object.entries(e.stats).forEach(([k, v]) => {
          if (s[k] !== undefined) s[k] += v
        })
      }
      // 被动技能加成
      if (e.passives) {
        e.passives.forEach(p => {
          if (p.field === 'stamina') s.stamina += p.val
          if (p.field === 'recovery') s.recovery += p.val
          if (p.field === 'atk') {
            // 提升对应装备五行的攻击
            const atkKey = ATK_KEY[e.attr]
            if (atkKey && s[atkKey] !== undefined) s[atkKey] += p.val
          }
          if (p.field === 'def') {
            const defKey = DEF_KEY[e.attr]
            if (defKey && s[defKey] !== undefined) s[defKey] += p.val
          }
        })
      }
    })
    // hp = 气力值（直接作为血量上限）
    s.hp = s.stamina
    return s
  }

  equipItem(uid) {
    const item = this._d.inventory.find(e => e.uid === uid)
    if (!item) return false
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
    Object.keys(this._d.equipped).forEach(slot => {
      if (this._d.equipped[slot] && this._d.equipped[slot].uid === uid) {
        this._d.equipped[slot] = null
      }
    })
    this._save()
  }

  isLevelPassed(levelId, difficulty) {
    return !!this._d.levelProgress[`${levelId}_${difficulty}`]
  }

  passLevel(levelId, difficulty) {
    this._d.levelProgress[`${levelId}_${difficulty}`] = true
    if (levelId >= this._d.currentLevel) {
      this._d.currentLevel = levelId + 1
    }
    this._save()
  }

  getPassedCount(difficulty) {
    return Object.keys(this._d.levelProgress).filter(k => k.endsWith('_'+difficulty)).length
  }

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

  checkAchievements(extra) {
    const a = this._d.achievements
    if (extra && extra.combo >= 8 && !a.ach_combo8.done) a.ach_combo8.done = true
    if (this._d.inventory.some(e => e.quality === 'orange') && !a.ach_equip_ssr.done) a.ach_equip_ssr.done = true
    if (Object.values(this._d.equipped).every(e => e !== null) && !a.ach_full_equip.done) a.ach_full_equip.done = true
    if (this.getPassedCount('normal') >= 60 && !a.ach_clear_normal.done) a.ach_clear_normal.done = true
    if (this.getPassedCount('hard') >= 60 && !a.ach_clear_hard.done) a.ach_clear_hard.done = true
    if (this.getPassedCount('extreme') >= 60 && !a.ach_clear_extreme.done) a.ach_clear_extreme.done = true
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

  recordBattle(combo, skillCount) {
    this._d.stats.totalBattles++
    this._d.stats.totalCombos += combo
    this._d.stats.maxCombo = Math.max(this._d.stats.maxCombo, combo)
    this._d.stats.totalSkills += skillCount
    this._save()
  }

  _load() {
    try {
      const raw = wx.getStorageSync(LOCAL_KEY)
      if (raw) {
        this._d = JSON.parse(raw)
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
