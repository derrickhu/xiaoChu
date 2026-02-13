/**
 * 龙珠战纪 - 云开发存储管理
 * 云数据库 + 本地缓存双重保障
 */
const CLOUD_ENV = 'cloud1-9glro17fb6f566a8'

class Storage {
  constructor() {
    this.openid = ''
    this.cloudReady = false
    this._initCloud()
    this.load() // 先从本地加载，云端就绪后同步
  }

  // 初始化云开发
  _initCloud() {
    try {
      wx.cloud.init({ env: CLOUD_ENV, traceUser: true })
      this.db = wx.cloud.database()
      this._ = this.db.command
      this.cloudReady = true
      console.log('云开发初始化成功')
      this._getOpenid()
    } catch (e) {
      console.error('云开发初始化失败:', e)
      this.cloudReady = false
    }
  }

  // 获取用户openid
  _getOpenid() {
    wx.cloud.callFunction({ name: 'getOpenid' }).then(res => {
      this.openid = res.result && res.result.openid || ''
      if (this.openid) {
        console.log('获取openid成功')
        this._syncFromCloud()
      }
    }).catch(e => {
      console.warn('获取openid失败，使用本地存储:', e)
    })
  }

  // 本地加载
  load() {
    this.passedLevels = this._get('passedLevels', [])
    this.currentLevel = this._get('currentLevel', 1)
    this.unlockedChars = this._get('unlockedChars', [1001, 1006])
    this.gold = this._get('gold', 0)
    this.teamData = this._get('teamData', [1001, 1006, null, null, null, null])
    this.firstEnter = this._get('firstEnter', false)

    // 难度进度 { normal: [bool x8], hard: [bool x8], extreme: [bool x8] }
    this.levelProgress = this._get('levelProgress', {
      normal: [false,false,false,false,false,false,false,false],
      hard: [false,false,false,false,false,false,false,false],
      extreme: [false,false,false,false,false,false,false,false]
    })
    // 当前选择的难度
    this.currentDifficulty = this._get('currentDifficulty', 'normal')

    // 角色养成数据 { charId: { level, exp, skillLevel, breakCount } }
    this.charGrowth = this._get('charGrowth', {})

    // 材料数据
    this.materials = this._get('materials', {
      expItem: 0,      // 经验道具
      normalMat: 0,    // 普通升级材料
      skillMat: 0,     // 技能升级材料
      rareMat: 0,      // 稀有突破材料
      attrStone: { '火':0, '水':0, '木':0, '光':0, '暗':0 }
    })

    // 每日任务
    this.dailyTask = this._get('dailyTask', {
      tasks: [false, false, false],
      rewardGot: false,
      lastReset: '',
      comboChallengeCount: 0, // 今日combo>=5次数
      levelChallengeCount: 0  // 今日关卡挑战次数
    })

    // 周回挑战
    this.weeklyChallenge = this._get('weeklyChallenge', {
      count: 3,
      bestCombo: 0,
      lastReset: '',
      weeklyLevelId: 1
    })

    // 成就
    this.achievements = this._get('achievements', {})

    // 排行榜本地缓存
    this.bestRecords = this._get('bestRecords', {})

    // 统计数据
    this.stats = this._get('stats', {
      totalChallenges: 0,
      totalCombos: 0,
      maxCombo: 0
    })
  }

  _get(key, def) {
    try {
      const v = wx.getStorageSync(key)
      return v !== '' && v !== undefined && v !== null ? v : def
    } catch (e) { return def }
  }

  _set(key, val) {
    try { wx.setStorageSync(key, val) } catch (e) {}
  }

  save() {
    this._set('passedLevels', this.passedLevels)
    this._set('currentLevel', this.currentLevel)
    this._set('unlockedChars', this.unlockedChars)
    this._set('gold', this.gold)
    this._set('teamData', this.teamData)
    this._set('firstEnter', this.firstEnter)
    this._set('levelProgress', this.levelProgress)
    this._set('currentDifficulty', this.currentDifficulty)
    this._set('charGrowth', this.charGrowth)
    this._set('materials', this.materials)
    this._set('dailyTask', this.dailyTask)
    this._set('weeklyChallenge', this.weeklyChallenge)
    this._set('achievements', this.achievements)
    this._set('bestRecords', this.bestRecords)
    this._set('stats', this.stats)
    this._syncToCloud()
  }

  // ===== 关卡进度 =====
  passLevel(levelId, reward, difficulty) {
    difficulty = difficulty || 'normal'
    const idx = levelId - 1
    if (idx >= 0 && idx < 8) {
      this.levelProgress[difficulty][idx] = true
    }
    if (!this.passedLevels.includes(levelId)) {
      this.passedLevels.push(levelId)
    }
    if (levelId >= this.currentLevel) {
      this.currentLevel = levelId + 1
    }
    if (reward) {
      if (reward.gold) this.gold += reward.gold
      if (reward.charId && !this.unlockedChars.includes(reward.charId)) {
        this.unlockedChars.push(reward.charId)
      }
    }
    // 更新统计
    this.stats.totalChallenges++
    // 每日任务：完成关卡挑战
    this.dailyTask.levelChallengeCount++
    if (!this.dailyTask.tasks[0]) this.dailyTask.tasks[0] = true
    this.save()
  }

  // 记录combo
  recordCombo(combo) {
    if (combo > this.stats.maxCombo) this.stats.maxCombo = combo
    this.stats.totalCombos++
    if (combo >= 5) {
      this.dailyTask.comboChallengeCount++
      if (!this.dailyTask.tasks[1]) this.dailyTask.tasks[1] = true
    }
    this.save()
  }

  isLevelUnlocked(levelId) {
    return levelId <= this.currentLevel
  }

  isLevelPassed(levelId) {
    return this.passedLevels.includes(levelId)
  }

  isDifficultyUnlocked(difficulty) {
    if (difficulty === 'normal') return true
    if (difficulty === 'hard') return this.levelProgress.normal.every(v => v)
    if (difficulty === 'extreme') return this.levelProgress.hard.every(v => v)
    return false
  }

  getLevelPassedInDifficulty(levelId, difficulty) {
    const idx = levelId - 1
    if (idx < 0 || idx >= 8) return false
    return this.levelProgress[difficulty] && this.levelProgress[difficulty][idx]
  }

  setFirstEnter() {
    this.firstEnter = true
    this.save()
  }

  // ===== 角色养成 =====
  getCharGrowth(charId) {
    if (!this.charGrowth[charId]) {
      this.charGrowth[charId] = { level: 1, exp: 0, skillLevel: 1, breakCount: 0 }
    }
    return this.charGrowth[charId]
  }

  // 获取角色实际属性（含养成加成）
  getCharStats(baseChar) {
    const g = this.getCharGrowth(baseChar.charId)
    const levelMult = 1 + (g.level - 1) * 0.1
    const breakMult = 1 + g.breakCount * 0.2
    return {
      atk: Math.floor(baseChar.baseAtk * levelMult * breakMult),
      hp: Math.floor(baseChar.baseHp * levelMult * breakMult),
      cd: baseChar.activeSkill ? Math.max(2, baseChar.activeSkill.cd - (g.skillLevel - 1) * 0.4) : 0
    }
  }

  // 角色升级
  levelUp(charId) {
    const g = this.getCharGrowth(charId)
    const maxLevel = 20 + g.breakCount * 5
    if (g.level >= maxLevel) return { success: false, msg: '已满级' }
    const needExp = Math.floor(100 * Math.pow(1.2, g.level - 1))
    if (this.materials.expItem < needExp) return { success: false, msg: '经验道具不足' }
    this.materials.expItem -= needExp
    g.level++
    this.save()
    return { success: true, msg: `升级到 ${g.level} 级` }
  }

  // 技能强化
  skillUpgrade(charId) {
    const g = this.getCharGrowth(charId)
    if (g.skillLevel >= 5) return { success: false, msg: '技能已满级' }
    if (this.materials.skillMat < 1) return { success: false, msg: '技能材料不足' }
    const success = Math.random() < 0.8
    if (success) {
      this.materials.skillMat--
      g.skillLevel++
      this.save()
      return { success: true, msg: `技能升至 ${g.skillLevel} 级` }
    }
    return { success: false, msg: '强化失败（未消耗材料）' }
  }

  // 角色突破
  charBreak(charId, attr) {
    const g = this.getCharGrowth(charId)
    if (g.level < 20 + g.breakCount * 5) return { success: false, msg: '未达到满级' }
    if (g.breakCount >= 3) return { success: false, msg: '已突破至上限' }
    if (this.materials.rareMat < 1) return { success: false, msg: '突破材料不足' }
    const stoneKey = attr
    if (!this.materials.attrStone[stoneKey] || this.materials.attrStone[stoneKey] < 5) {
      return { success: false, msg: '属性强化石不足' }
    }
    this.materials.rareMat--
    this.materials.attrStone[stoneKey] -= 5
    g.breakCount++
    this.save()
    return { success: true, msg: `突破成功！等级上限提升至 ${20 + g.breakCount * 5}` }
  }

  // 添加材料（通关奖励）
  addMaterials(difficulty) {
    if (difficulty === 'normal') {
      this.materials.expItem += 2
      this.materials.normalMat += 1
    } else if (difficulty === 'hard') {
      this.materials.expItem += 4
      this.materials.normalMat += 2
      this.materials.skillMat += 1
    } else if (difficulty === 'extreme') {
      this.materials.expItem += 6
      this.materials.normalMat += 3
      this.materials.skillMat += 2
      this.materials.rareMat += 1
    }
    this.save()
  }

  // ===== 每日任务 =====
  checkDailyReset() {
    const today = this._getDateStr()
    if (this.dailyTask.lastReset !== today) {
      this.dailyTask = {
        tasks: [false, false, false],
        rewardGot: false,
        lastReset: today,
        comboChallengeCount: 0,
        levelChallengeCount: 0
      }
      this.save()
    }
  }

  claimDailyReward() {
    if (this.dailyTask.rewardGot) return { success: false, msg: '已领取' }
    if (!this.dailyTask.tasks.every(v => v)) return { success: false, msg: '任务未完成' }
    this.dailyTask.rewardGot = true
    this.materials.rareMat += 1
    this.save()
    return { success: true, msg: '领取稀有材料×1' }
  }

  // ===== 周回挑战 =====
  checkWeeklyReset() {
    const today = this._getDateStr()
    const d = new Date()
    if (d.getDay() === 1 && this.weeklyChallenge.lastReset !== today) {
      this.weeklyChallenge = {
        count: 3,
        bestCombo: 0,
        lastReset: today,
        weeklyLevelId: Math.floor(Math.random() * 8) + 1
      }
      this.save()
    }
  }

  useWeeklyChallenge(combo) {
    if (this.weeklyChallenge.count <= 0) return { success: false, msg: '今日次数已用完' }
    this.weeklyChallenge.count--
    if (combo > this.weeklyChallenge.bestCombo) this.weeklyChallenge.bestCombo = combo
    // 每日任务第3项：挑战周回
    if (!this.dailyTask.tasks[2]) this.dailyTask.tasks[2] = true
    // 奖励
    this.materials.expItem += 3
    this.materials.skillMat += 1
    this.save()
    return { success: true, msg: '周回挑战完成' }
  }

  // ===== 成就 =====
  checkAchievements() {
    const ach = this.achievements
    const checks = [
      { id: 'normalAll', name: '普通全通关', desc: '通关普通难度所有关卡', check: () => this.levelProgress.normal.every(v => v), reward: { rareMat: 1 } },
      { id: 'hardAll', name: '困难全通关', desc: '通关困难难度所有关卡', check: () => this.levelProgress.hard.every(v => v), reward: { rareMat: 2 } },
      { id: 'extremeAll', name: '极难全通关', desc: '通关极难难度所有关卡', check: () => this.levelProgress.extreme.every(v => v), reward: { rareMat: 3 } },
      { id: 'combo10', name: 'Combo大师', desc: '单次转珠达成Combo≥10', check: () => this.stats.maxCombo >= 10, reward: { skillMat: 3 } },
      { id: 'challenge50', name: '挑战达人', desc: '累计挑战关卡50次', check: () => this.stats.totalChallenges >= 50, reward: { expItem: 20 } },
      { id: 'chars10', name: '收藏家', desc: '累计获得10个角色', check: () => this.unlockedChars.length >= 10, reward: { rareMat: 1 } },
    ]
    const newlyCompleted = []
    checks.forEach(c => {
      if (!ach[c.id] && c.check()) {
        ach[c.id] = { completed: true, claimedReward: false }
        newlyCompleted.push(c)
      }
    })
    if (newlyCompleted.length > 0) this.save()
    return newlyCompleted
  }

  claimAchievementReward(achId) {
    const ach = this.achievements[achId]
    if (!ach || !ach.completed || ach.claimedReward) return false
    ach.claimedReward = true
    this.save()
    return true
  }

  getAchievementList() {
    return [
      { id: 'normalAll', name: '普通全通关', desc: '通关普通难度所有关卡' },
      { id: 'hardAll', name: '困难全通关', desc: '通关困难难度所有关卡' },
      { id: 'extremeAll', name: '极难全通关', desc: '通关极难难度所有关卡' },
      { id: 'combo10', name: 'Combo大师', desc: '单次转珠达成Combo≥10' },
      { id: 'challenge50', name: '挑战达人', desc: '累计挑战关卡50次' },
      { id: 'chars10', name: '收藏家', desc: '累计获得10个角色' },
    ]
  }

  // ===== 排行榜 =====
  updateBestRecord(levelId, difficulty, turns, combo) {
    const key = `${levelId}_${difficulty}`
    const prev = this.bestRecords[key]
    if (!prev || turns < prev.turns || (turns === prev.turns && combo > prev.combo)) {
      this.bestRecords[key] = { turns, combo, time: Date.now() }
      this.save()
      this._uploadRecord(levelId, difficulty, turns, combo)
      return true
    }
    return false
  }

  // ===== 云同步 =====
  _syncToCloud() {
    if (!this.cloudReady || !this.openid) return
    try {
      const data = {
        openid: this.openid,
        passedLevels: this.passedLevels,
        currentLevel: this.currentLevel,
        unlockedChars: this.unlockedChars,
        gold: this.gold,
        teamData: this.teamData,
        levelProgress: this.levelProgress,
        charGrowth: this.charGrowth,
        materials: this.materials,
        dailyTask: this.dailyTask,
        weeklyChallenge: this.weeklyChallenge,
        achievements: this.achievements,
        bestRecords: this.bestRecords,
        stats: this.stats,
        updatedAt: this.db.serverDate()
      }
      this.db.collection('playerData').where({ openid: this.openid }).count().then(res => {
        if (res.total > 0) {
          this.db.collection('playerData').where({ openid: this.openid }).update({ data })
        } else {
          this.db.collection('playerData').add({ data })
        }
      }).catch(e => console.warn('云同步失败:', e))
    } catch (e) { console.warn('云同步异常:', e) }
  }

  _syncFromCloud() {
    if (!this.cloudReady || !this.openid) return
    this.db.collection('playerData').where({ openid: this.openid }).get().then(res => {
      if (res.data && res.data.length > 0) {
        const d = res.data[0]
        // 云端数据合并（取更新的）
        if (d.passedLevels && d.passedLevels.length > this.passedLevels.length) {
          this.passedLevels = d.passedLevels
        }
        if (d.currentLevel && d.currentLevel > this.currentLevel) {
          this.currentLevel = d.currentLevel
        }
        if (d.unlockedChars && d.unlockedChars.length > this.unlockedChars.length) {
          this.unlockedChars = d.unlockedChars
        }
        if (d.gold && d.gold > this.gold) this.gold = d.gold
        if (d.levelProgress) this.levelProgress = d.levelProgress
        if (d.charGrowth) this.charGrowth = d.charGrowth
        if (d.materials) this.materials = d.materials
        if (d.dailyTask) this.dailyTask = d.dailyTask
        if (d.weeklyChallenge) this.weeklyChallenge = d.weeklyChallenge
        if (d.achievements) this.achievements = d.achievements
        if (d.bestRecords) this.bestRecords = d.bestRecords
        if (d.stats) this.stats = d.stats
        this.save() // 更新本地
        console.log('云端数据同步成功')
      }
    }).catch(e => console.warn('云端拉取失败:', e))
  }

  _uploadRecord(levelId, difficulty, turns, combo) {
    if (!this.cloudReady || !this.openid) return
    try {
      this.db.collection('leaderboard').add({
        data: {
          openid: this.openid,
          levelId, difficulty, turns, combo,
          createdAt: this.db.serverDate()
        }
      }).catch(() => {})
    } catch (e) {}
  }

  _getDateStr() {
    const d = new Date()
    return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`
  }
}

module.exports = Storage
