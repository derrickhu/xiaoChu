/**
 * 五行通天塔 - 国风音效管理
 * 音色风格：古筝、竹笛、钟磬、玉石、鼓点
 */
class MusicManager {
  constructor() {
    this.enabled = true
    this.bgmEnabled = true
  }

  // ============ 背景音乐 ============

  playBgm() {
    if (!this.bgmEnabled) return
    if (!this._bgm) {
      this._bgm = wx.createInnerAudioContext()
      this._bgm.src = 'audio/bgm.m4a'
      this._bgm.loop = true
      this._bgm.volume = 0.3
    }
    this._bgm.play()
  }

  stopBgm() {
    if (this._bgm) this._bgm.stop()
  }

  // ============ 战斗音效 ============

  /** 珠子消除：玉石碰撞清脆声 */
  playEliminate() {
    if (!this.enabled) return
    this._playSfx('audio/eliminate.wav')
  }

  /** 宠物攻击：灵力破空声 */
  playAttack() {
    if (!this.enabled) return
    this._playSfx('audio/attack.wav')
  }

  /** Combo连击：递升叮声 */
  playCombo() {
    if (!this.enabled) return
    this._playSfx('audio/combo.wav')
  }

  /** 技能释放：法阵激活 */
  playSkill() {
    if (!this.enabled) return
    this._playSfx('audio/skill.wav')
  }

  /** 怪物攻击：沉重铁锤砸击 */
  playEnemyAttack() {
    if (!this.enabled) return
    this._playSfx('audio/enemy_attack.wav')
  }

  /** 英雄受击：肉感打击+痛感反馈 */
  playHeroHurt() {
    if (!this.enabled) return
    this._playSfx('audio/hero_hurt.wav')
  }

  /** 格挡成功：金属盾牌碰撞+火花弹开 */
  playBlock() {
    if (!this.enabled) return
    this._playSfx('audio/block.wav')
  }

  /** 敌方技能：暗黑能量涌动+爆裂 */
  playEnemySkill() {
    if (!this.enabled) return
    this._playSfx('audio/enemy_skill.wav')
  }

  /** 数值翻滚：竹简翻动短促音（带200ms防抖） */
  playRolling() {
    if (!this.enabled) return
    if (this._rollingPlaying) return
    this._rollingPlaying = true
    const a = wx.createInnerAudioContext()
    a.src = 'audio/rolling.wav'
    a.volume = 0.2
    a.play()
    a.onEnded(() => { a.destroy(); this._rollingPlaying = false })
    setTimeout(() => { this._rollingPlaying = false }, 200)
  }

  // ============ 场景音效 ============

  /** BOSS出场：低沉钟声+威压鼓点 */
  playBoss() {
    if (!this.enabled) return
    this._playSfx('audio/boss.wav')
  }

  /** 层数推进：仙钟+上行音阶 */
  playLevelUp() {
    if (!this.enabled) return
    this._playSfx('audio/levelup.wav')
  }

  /** 战斗胜利：号角+胜利鼓点+华丽琶音（2.2秒） */
  playVictory() {
    if (!this.enabled) return
    this._playSfx('audio/victory.wav')
  }

  /** 奖励/奇遇：灵光闪现 */
  playReward() {
    if (!this.enabled) return
    this._playSfx('audio/reward.wav')
  }

  /** 游戏结束：下行古筝+钟声余韵 */
  playGameOver() {
    if (!this.enabled) return
    this._playSfx('audio/gameover.wav')
  }

  // ============ 开关 ============

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled
    if (this.bgmEnabled) this.playBgm()
    else this.stopBgm()
    return this.bgmEnabled
  }

  toggleSfx() {
    this.enabled = !this.enabled
    return this.enabled
  }

  // ============ 内部方法 ============

  _playSfx(src, volume) {
    const a = wx.createInnerAudioContext()
    a.src = src
    if (volume !== undefined) a.volume = volume
    a.play()
    a.onEnded(() => a.destroy())
  }
}

module.exports = new MusicManager()
