/**
 * 存储管理 - 适配五行转珠战斗系统
 * 本地缓存 + 云数据库双重存储
 */
const { generateEquipment } = require('./equipment')
const { ALL_LEVELS } = require('./levels')

const LOCAL_KEY = 'xiuxianXXL_v3'
const CLOUD_ENV = 'cloud1-9glro17fb6f566a8'

// 默认玩家数据
function defaultData() {
  // 初始装备：一把凡阶火灵飞剑 Lv1 + 一件凡阶水灵衣服 Lv1（均无绝技）
  const starterWeapon = generateEquipment('weapon', 'fire', 'white', 1)
  delete starterWeapon.ult          // 新手初始白装无绝技
  starterWeapon.ultTrigger = 999    // 不可触发
  const starterArmor  = generateEquipment('armor', 'water', 'white', 1)
  delete starterArmor.ult
  starterArmor.ultTrigger = 999
  return {
    // 当前佩戴装备（5槽位）
    equipped: { weapon:starterWeapon, armor:starterArmor, helmet:null, cloak:null, trinket:null },
    // 乾坤袋（永久装备列表）
    inventory: [starterWeapon, starterArmor],
    // 关卡进度
    levelProgress: {},
    currentTheme: 'tutorial',
    currentLevel: 1,   // 从新手引导第1关开始
    // 灵石
    gold: 200,
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
    this._cloudSyncTimer = null   // 防抖定时器
    this._cloudInitDone = false   // 云端初始化是否完成
    this._pendingSync = false     // 初始化期间是否有待同步数据
    this.onCloudReady = null      // 云初始化完成回调（用于通知render预加载云资源）
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
      stamina: 60,   // 气力值（影响血量）— 低基础值增加战斗紧张感
      metalAtk: 18, woodAtk: 18, earthAtk: 18, waterAtk: 18, fireAtk: 18,
      metalDef: 5,   woodDef: 5,  earthDef: 5,  waterDef: 5,  fireDef: 5,
      recovery: 8,   // 回复值（心珠回血基础）
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
    // 推进 currentLevel：如果通关的是当前关或更高关，推进到下一关
    if (levelId >= this._d.currentLevel) {
      const idx = ALL_LEVELS.findIndex(l => l.levelId === levelId)
      if (idx >= 0 && idx + 1 < ALL_LEVELS.length) {
        this._d.currentLevel = ALL_LEVELS[idx + 1].levelId
      }
      // 最后一关通关则保持不变
    }
    console.log('[passLevel] levelId:', levelId, 'diff:', difficulty, '-> currentLevel:', this._d.currentLevel)
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

  /** 彻底重置所有数据（本地+云端） */
  async resetAll() {
    this._d = defaultData()
    try { wx.removeStorageSync(LOCAL_KEY) } catch(e) {}
    this._save()
    // 同时清空云端
    if (this._cloudReady && this._openid) {
      try {
        const db = wx.cloud.database()
        const res = await db.collection('playerData').where({ _openid: this._openid }).get()
        if (res.data && res.data.length > 0) {
          await db.collection('playerData').doc(res.data[0]._id).remove()
          console.log('[Storage] 云端数据已删除')
        }
      } catch(e) { console.warn('[Storage] 云端重置失败:', e) }
    }
    console.log('[Storage] 数据已彻底重置')
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
        // 修复无效的 currentLevel（旧版本 bug 可能产生不存在的 levelId）
        if (!ALL_LEVELS.find(l => l.levelId === this._d.currentLevel)) {
          console.warn('[Storage] 修复无效 currentLevel:', this._d.currentLevel)
          // 根据已通关记录找到最高已通关的下一关
          const passedIds = Object.keys(this._d.levelProgress || {}).map(k => parseInt(k.split('_')[0]))
          if (passedIds.length > 0) {
            const maxPassed = Math.max(...passedIds)
            const idx = ALL_LEVELS.findIndex(l => l.levelId === maxPassed)
            this._d.currentLevel = (idx >= 0 && idx + 1 < ALL_LEVELS.length) 
              ? ALL_LEVELS[idx + 1].levelId 
              : ALL_LEVELS[0].levelId
          } else {
            this._d.currentLevel = ALL_LEVELS[0].levelId
          }
          console.log('[Storage] 修正后 currentLevel:', this._d.currentLevel)
        }
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
      this._debounceSyncToCloud()
    } catch(e) {
      console.warn('Storage save error:', e)
    }
  }

  /** 防抖：2秒内多次_save只触发一次云同步 */
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
    try {
      await this._ensureCollections()
    } catch(e) { /* ignore */ }
    try {
      await this._getOpenid()
    } catch(e) {
      console.warn('Get openid failed:', e)
    }
    if (this._openid) {
      await this._syncFromCloud()
    }
    this._cloudInitDone = true
    console.log('[Storage] Cloud init done, openid:', this._openid ? 'OK' : 'EMPTY')
    // 通知外部云已就绪（用于预加载云存储资源）
    if (typeof this.onCloudReady === 'function') {
      try { this.onCloudReady() } catch(e) { console.warn('[Storage] onCloudReady callback error:', e) }
    }
    // 如果初始化期间有待同步的数据，立即同步
    if (this._pendingSync) {
      this._pendingSync = false
      this._syncToCloud()
    }
  }

  async _ensureCollections() {
    const r = await wx.cloud.callFunction({ name:'initCollections' })
    if (r.result && r.result.errors && r.result.errors.length) {
      console.warn('创建集合异常:', r.result.errors)
    }
  }

  async _getOpenid() {
    const r = await wx.cloud.callFunction({ name:'getOpenid' })
    this._openid = (r.result && r.result.openid) || ''
    if (!this._openid) {
      console.warn('[Storage] openid 获取为空，云存储将不可用')
    }
  }

  async _syncFromCloud() {
    if (!this._cloudReady || !this._openid) return
    try {
      const db = wx.cloud.database()
      const res = await db.collection('playerData').where({ _openid: this._openid }).get()
      if (res.data && res.data.length > 0) {
        const cloud = res.data[0]
        // 用云端 _updateTime 判断：如果云端数据更新则同步到本地
        const cloudTime = cloud._updateTime || 0
        const localTime = this._d._updateTime || 0
        if (cloudTime > localTime) {
          const _id = cloud._id
          delete cloud._id
          delete cloud._openid
          // 合并：保留云端的关键进度数据
          Object.assign(this._d, cloud)
          wx.setStorageSync(LOCAL_KEY, JSON.stringify(this._d))
          console.log('[Storage] 已从云端同步数据')
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
      // 构建要同步的数据，排除系统字段
      const saveData = { ...this._d, _updateTime: Date.now() }
      delete saveData._id
      delete saveData._openid
      if (res.data && res.data.length > 0) {
        // update 时 data 内不能包含 _openid/_id 等系统字段
        await col.doc(res.data[0]._id).update({ data: saveData })
        console.log('[Storage] 云端数据已更新')
      } else {
        await col.add({ data: saveData })
        console.log('[Storage] 云端数据已创建')
      }
    } catch(e) {
      console.warn('[Storage] 云同步失败:', e.message || e)
    }
  }
}

module.exports = Storage
