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
    // 音高递升：每段combo音高升半音，营造"越打越高"的爽感
    // playbackRate: 1.0 → 1.06 → 1.12 → ... 每段+0.06（约一个半音）
    // 最高到 2.0 避免音色失真
    const pitchStep = 0.06
    const basePitch = 0.94  // 从略低于原音开始，让1combo不突兀
    const pitch = Math.min(2.0, basePitch + (comboNum - 1) * pitchStep)
    
    // 音量递增：低连击柔和，高连击有力
    // 0.35 → 0.85，线性递增
    const baseVol = 0.35
    const maxVol = 0.85
    const vol = Math.min(maxVol, baseVol + (comboNum - 1) * 0.05)

    this._playSfxEx('audio/combo.wav', vol, pitch)
  }

  /**
   * 连击里程碑突破音效 - 到达特定连击数时的"升阶"爆发音
   * 5连: 播放 levelup.wav（中音量+略加速），营造"突破"感
   * 8连: 播放 skill.wav（高音量+加速），营造"超越"感  
   * 12连: 播放 boss.wav（爆满音量+低沉），营造"极限"感 + victory.wav叠加
   * @param {number} comboNum 当前连击数
   */
  playComboMilestone(comboNum) {
    if (!this.enabled) return
    if (comboNum === 5) {
      // 5连突破：仙钟升阶音 + 加速让音效更紧凑有力
      this._playSfxEx('audio/levelup.wav', 0.5, 1.3)
    } else if (comboNum === 8) {
      // 8连超越：技能激活音 + 更高音调更兴奋
      this._playSfxEx('audio/skill.wav', 0.65, 1.2)
    } else if (comboNum >= 12) {
      // 12连极限：双层叠加 - 低沉威压鼓 + 胜利号角，史诗感拉满
      this._playSfxEx('audio/boss.wav', 0.5, 1.5)
      setTimeout(() => {
        if (this.enabled) this._playSfxEx('audio/victory.wav', 0.35, 1.4)
      }, 60)
    }
  }

  // ============ 消除音效（层次化） ============

  /**
   * 消除音效 - 根据消除珠子数量调整音高和音量
   * 3消：标准音高，轻快清脆
   * 4消：升半音，略响，有"加分"的愉悦感
   * 5消+：升全音，饱满有力，配合眩晕效果的"大招"感
   * @param {number} count 消除的珠子数量（3/4/5+）
   */
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

  /**
   * 珠子拾起：轻触反馈 - 用消除音效的低音量快速版
   * 参考：PAD拾起珠子时的短促"叮"
   */
  playPickUp() {
    if (!this.enabled) return
    this._playSfxEx('audio/eliminate.wav', 0.15, 1.5)
  }

  /**
   * 珠子交换：每次经过新位置的微妙反馈
   * 用rolling音效的变调版，短促轻快，不干扰主音效
   * 带防抖：快速拖拽时不会堆叠
   */
  playSwap() {
    if (!this.enabled) return
    if (this._swapPlaying) return
    this._swapPlaying = true
    this._playSfxEx('audio/rolling.wav', 0.12, 1.8)
    setTimeout(() => { this._swapPlaying = false }, 80)
  }

  /**
   * 暴击命中：在普通攻击音效基础上叠加一层高亢的爆发音
   * 用combo音效的高音调+高音量版本，营造"致命一击"的冲击感
   */
  playCritHit() {
    if (!this.enabled) return
    this._playSfxEx('audio/combo.wav', 0.7, 1.6)
    // 延迟叠加一层低沉的冲击感
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/attack.wav', 0.6, 0.7)
    }, 50)
  }

  /**
   * 护盾获得：清脆的防御音
   * 用block音效的轻柔高调版
   */
  playShieldGain() {
    if (!this.enabled) return
    this._playSfxEx('audio/block.wav', 0.3, 1.4)
  }

  /**
   * 回血效果：温暖的治愈音
   * 用reward音效的轻柔版
   */
  playHeal() {
    if (!this.enabled) return
    this._playSfxEx('audio/reward.wav', 0.3, 1.2)
  }

  /**
   * 拖拽松手/转珠结束：标志转珠阶段结束的短促确认音
   */
  playDragEnd() {
    if (!this.enabled) return
    this._playSfxEx('audio/eliminate.wav', 0.2, 0.8)
  }

  // ============ 战斗音效（增强版） ============

  /** 宠物攻击：灵力破空声 */
  playAttack() {
    if (!this.enabled) return
    this._playSfx('audio/attack.wav', 0.5)
  }

  /**
   * 宠物攻击（暴击版）：更有冲击力
   * 普通攻击音+暴击叠加层
   */
  playAttackCrit() {
    if (!this.enabled) return
    this._playSfxEx('audio/attack.wav', 0.65, 1.15)
    this.playCritHit()
  }

  /** Combo连击（保留兼容，建议使用playComboHit） */
  playCombo() {
    if (!this.enabled) return
    this._playSfx('audio/combo.wav')
  }

  /** 技能释放：法阵激活 */
  playSkill() {
    if (!this.enabled) return
    this._playSfx('audio/skill.wav', 0.6)
  }

  /**
   * 敌方普攻：沉重铁锤砸击
   * 增强版：根据伤害占比调整音量（重击更响）
   * @param {number} dmgRatio 伤害占英雄最大血量的比例 0-1
   */
  playEnemyAttack(dmgRatio) {
    if (!this.enabled) return
    const vol = dmgRatio != null
      ? Math.min(0.8, 0.4 + dmgRatio * 0.6)
      : 0.5
    this._playSfxEx('audio/enemy_attack.wav', vol, 1.0)
  }

  /**
   * 英雄受击：肉感打击+痛感反馈
   * 增强：根据伤害占比调音量，重伤更有痛感
   * @param {number} dmgRatio 伤害占比
   */
  playHeroHurt(dmgRatio) {
    if (!this.enabled) return
    const vol = dmgRatio != null
      ? Math.min(0.7, 0.3 + dmgRatio * 0.5)
      : 0.4
    this._playSfxEx('audio/hero_hurt.wav', vol, 1.0)
  }

  /** 格挡成功：金属盾牌碰撞+火花弹开 */
  playBlock() {
    if (!this.enabled) return
    this._playSfx('audio/block.wav', 0.55)
  }

  /** 敌方技能：暗黑能量涌动+爆裂 */
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

  /** BOSS出场：低沉钟声+威压鼓点 */
  playBoss() {
    if (!this.enabled) return
    this._playSfx('audio/boss.wav', 0.7)
  }

  /** 层数推进：仙钟+上行音阶 */
  playLevelUp() {
    if (!this.enabled) return
    this._playSfx('audio/levelup.wav', 0.5)
  }

  /** 战斗胜利：号角+胜利鼓点+华丽琶音 */
  playVictory() {
    if (!this.enabled) return
    this._playSfx('audio/victory.wav', 0.6)
  }

  /** 奖励/奇遇：灵光闪现 */
  playReward() {
    if (!this.enabled) return
    this._playSfx('audio/reward.wav', 0.5)
  }

  /** 游戏结束：下行古筝+钟声余韵 */
  playGameOver() {
    if (!this.enabled) return
    this._playSfx('audio/gameover.wav', 0.6)
  }

  /**
   * 复活音效：希望重燃的上行音阶
   * 叠加reward + levelup营造"绝地重生"感
   */
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
      // 微信小游戏 InnerAudioContext 支持 playbackRate
      a.playbackRate = playbackRate
    }
    a.play()
    a.onEnded(() => a.destroy())
  }
}

module.exports = new MusicManager()
