/**
 * 龙珠战纪 - 本地数据存储
 */
class Storage {
  constructor() {
    this.load()
  }

  load() {
    this.passedLevels = this._get('passedLevels', [])
    this.currentLevel = this._get('currentLevel', 1)
    this.unlockedChars = this._get('unlockedChars', [1001, 1006])
    this.gold = this._get('gold', 0)
    this.teamData = this._get('teamData', [1001, 1006, null, null, null, null])
    this.firstEnter = this._get('firstEnter', false)
  }

  _get(key, def) {
    try {
      const v = wx.getStorageSync(key)
      return v !== '' && v !== undefined && v !== null ? v : def
    } catch (e) {
      return def
    }
  }

  _set(key, val) {
    try {
      wx.setStorageSync(key, val)
    } catch (e) {}
  }

  save() {
    this._set('passedLevels', this.passedLevels)
    this._set('currentLevel', this.currentLevel)
    this._set('unlockedChars', this.unlockedChars)
    this._set('gold', this.gold)
    this._set('teamData', this.teamData)
    this._set('firstEnter', this.firstEnter)
  }

  passLevel(levelId, reward) {
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
    this.save()
  }

  isLevelUnlocked(levelId) {
    return levelId <= this.currentLevel
  }

  isLevelPassed(levelId) {
    return this.passedLevels.includes(levelId)
  }

  setFirstEnter() {
    this.firstEnter = true
    this.save()
  }
}

module.exports = Storage
