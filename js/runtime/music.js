/**
 * 五行通天塔 - 国风音效管理（增强版）
 * 音色风格：古筝、竹笛、钟磬、玉石、鼓点
 * 
 * 核心设计理念：
 * 1. 连击递进爽感 - combo音效随连击数音高递升+音量渐强，爽感拉满
 * 2. 里程碑突破感 - 5/8/12连击播放特殊升阶音效，强化成就感
 * 3. 消除层次感   - 3/4/5消音高递升，区分消除规模
 * 4. 交互反馈感   - 拾起、交换、暴击等细节音效全覆盖
 * 5. 打击节奏感   - 攻击/受击音效精确时序编排
 */
class MusicManager {
  constructor() {
    this.enabled = true
    this.bgmEnabled = true
    // 音效实例池：复用高频音效实例，减少GC
    this._sfxPool = {}
    this._poolSize = 3
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

  // ============ 连击音效系统（核心爽感） ============

  /**
   * 连击递进音效 - 根据连击数动态调整音高、音量、播放速率
   * 参考：Puzzle & Dragons / 神魔之塔的连击递升音阶设计
   * @param {number} comboNum 当前连击数（1开始）
   */
  playComboHit(comboNum) {
    if (!this.enabled) return
    const pitchStep = 0.06
    const basePitch = 0.94
    const pitch = Math.min(2.0, basePitch + (comboNum - 1) * pitchStep)
    const baseVol = 0.35
    const maxVol = 0.85
    const vol = Math.min(maxVol, baseVol + (comboNum - 1) * 0.05)
    this._playSfxEx('audio/combo.wav', vol, pitch)
  }

  /**
   * 连击里程碑突破音效
   * @param {number} comboNum 当前连击数
   */
  playComboMilestone(comboNum) {
    if (!this.enabled) return
    if (comboNum === 5) {
      this._playSfxEx('audio/levelup.wav', 0.5, 1.3)
    } else if (comboNum === 8) {
      this._playSfxEx('audio/skill.wav', 0.65, 1.2)
    } else if (comboNum >= 12) {
      this._playSfxEx('audio/boss.wav', 0.5, 1.5)
      setTimeout(() => {
        if (this.enabled) this._playSfxEx('audio/victory.wav', 0.35, 1.4)
      }, 60)
    }
  }

  // ============ 消除音效（层次化） ============

  playEliminate(count) {
    if (!this.enabled) return
    if (count >= 5) {
      this._playSfxEx('audio/eliminate.wav', 0.7, 1.2)
    } else if (count === 4) {
      this._playSfxEx('audio/eliminate.wav', 0.55, 1.1)
    } else {
      this._playSfx('audio/eliminate.wav', 0.4)
    }
  }

  // ============ 交互细节音效 ============

  playPickUp() {
    if (!this.enabled) return
    this._playSfxEx('audio/eliminate.wav', 0.15, 1.5)
  }

  playSwap() {
    if (!this.enabled) return
    if (this._swapPlaying) return
    this._swapPlaying = true
    this._playSfxEx('audio/rolling.wav', 0.12, 1.8)
    setTimeout(() => { this._swapPlaying = false }, 80)
  }

  playCritHit() {
    if (!this.enabled) return
    this._playSfxEx('audio/combo.wav', 0.7, 1.6)
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/attack.wav', 0.6, 0.7)
    }, 50)
  }

  playShieldGain() {
    if (!this.enabled) return
    this._playSfxEx('audio/block.wav', 0.3, 1.4)
  }

  playHeal() {
    if (!this.enabled) return
    this._playSfxEx('audio/reward.wav', 0.3, 1.2)
  }

  playDragEnd() {
    if (!this.enabled) return
    this._playSfxEx('audio/eliminate.wav', 0.2, 0.8)
  }

  // ============ 战斗音效（增强版） ============

  playAttack() {
    if (!this.enabled) return
    this._playSfx('audio/attack.wav', 0.5)
  }

  playAttackCrit() {
    if (!this.enabled) return
    this._playSfxEx('audio/attack.wav', 0.65, 1.15)
    this.playCritHit()
  }

  playCombo() {
    if (!this.enabled) return
    this._playSfx('audio/combo.wav')
  }

  playSkill() {
    if (!this.enabled) return
    this._playSfx('audio/skill.wav', 0.6)
  }

  playEnemyAttack(dmgRatio) {
    if (!this.enabled) return
    const vol = dmgRatio != null
      ? Math.min(0.8, 0.4 + dmgRatio * 0.6)
      : 0.5
    this._playSfxEx('audio/enemy_attack.wav', vol, 1.0)
  }

  playHeroHurt(dmgRatio) {
    if (!this.enabled) return
    const vol = dmgRatio != null
      ? Math.min(0.7, 0.3 + dmgRatio * 0.5)
      : 0.4
    this._playSfxEx('audio/hero_hurt.wav', vol, 1.0)
  }

  playBlock() {
    if (!this.enabled) return
    this._playSfx('audio/block.wav', 0.55)
  }

  playEnemySkill() {
    if (!this.enabled) return
    this._playSfx('audio/enemy_skill.wav', 0.6)
  }

  /** 数值翻滚：竹简翻动短促音（带200ms防抖） */
  playRolling() {
    if (!this.enabled) return
    if (this._rollingPlaying) return
    this._rollingPlaying = true
    const a = wx.createInnerAudioContext()
    a.src = 'audio/rolling.wav'; a.volume = 0.2; a.play()
    a.onEnded(() => { a.destroy(); this._rollingPlaying = false })
    setTimeout(() => { this._rollingPlaying = false }, 200)
  }

  // ============ 场景音效 ============

  playBoss() {
    if (!this.enabled) return
    this._playSfx('audio/boss.wav', 0.7)
  }

  playLevelUp() {
    if (!this.enabled) return
    this._playSfx('audio/levelup.wav', 0.5)
  }

  playVictory() {
    if (!this.enabled) return
    this._playSfx('audio/victory.wav', 0.6)
  }

  playReward() {
    if (!this.enabled) return
    this._playSfx('audio/reward.wav', 0.5)
  }

  playGameOver() {
    if (!this.enabled) return
    this._playSfx('audio/gameover.wav', 0.6)
  }

  playRevive() {
    if (!this.enabled) return
    this._playSfxEx('audio/reward.wav', 0.5, 1.1)
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/levelup.wav', 0.4, 1.2)
    }, 100)
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

  /** 基础音效播放 */
  _playSfx(src, volume) {
    const a = wx.createInnerAudioContext()
    a.src = src
    if (volume !== undefined) a.volume = volume
    a.play()
    a.onEnded(() => a.destroy())
  }

  /**
   * 增强音效播放 - 支持播放速率（音高）调节
   * @param {string} src 音频文件路径
   * @param {number} volume 音量 0-1
   * @param {number} playbackRate 播放速率 0.5-2.0（>1升调，<1降调）
   */
  _playSfxEx(src, volume, playbackRate) {
    const a = wx.createInnerAudioContext()
    a.src = src
    if (volume !== undefined) a.volume = volume
    if (playbackRate !== undefined && playbackRate !== 1.0) {
      a.playbackRate = playbackRate
    }
    a.play()
    a.onEnded(() => a.destroy())
  }
}

module.exports = new MusicManager()
