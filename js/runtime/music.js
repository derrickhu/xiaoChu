const P = require('../platform')
const { COMBO_MILESTONES, getComboTier } = require('../data/constants')
/**
 * 灵宠消消塔 - 国风音效管理（增强版）
 * 音色风格：古筝、竹笛、钟磬、玉石、鼓点
 * 
 * 核心设计理念：
 * 1. 连击递进爽感 - combo音效随连击数音高递升+音量渐强，爽感拉满
 * 2. 里程碑突破感 - 3/6/9/12连击播放特殊升阶音效，强化成就感（配置化）
 * 3. 消除层次感   - 3/4/5消音高递升，区分消除规模
 * 4. 交互反馈感   - 拾起、交换、暴击等细节音效全覆盖
 * 5. 打击节奏感   - 攻击/受击音效精确时序编排
 */
class MusicManager {
  constructor() {
    this.enabled = true
    this.bgmEnabled = true
    this._bgmVolume = 0.5  // 0~1，对应用户设置 0~100
    // 音效实例池：复用高频音效实例，减少GC
    this._sfxPool = {}
    this._poolSize = 4
  }

  /** 设置BGM音量（0~1），实时生效 */
  setBgmVolume(vol) {
    this._bgmVolume = Math.max(0, Math.min(1, vol))
    if (this._bgm) this._bgm.volume = this._bgmVolume
    if (this._bossBgm) this._bossBgm.volume = Math.min(1, this._bgmVolume * 1.2)
  }

  // ============ 背景音乐 ============

  playBgm() {
    if (!this.bgmEnabled) return
    // 销毁之前的 BGM 实例，确保重新创建时 playbackRate 生效
    if (this._bgm) {
      this._bgm.stop()
      this._bgm.destroy()
      this._bgm = null
    }
    this._bgm = P.createInnerAudioContext()
    this._bgm.src = 'audio_bgm/bgm.mp3'
    this._bgm.loop = true
    this._bgm.volume = this._bgmVolume
    this._bgm.playbackRate = 1.0
    this._bgm.onCanplay(() => {
      this._bgm.playbackRate = 1.0
    })
    this._bgm.onPlay(() => {
      this._bgm.playbackRate = 1.0
    })
    this._bgm.play()
    // 延迟再次设置，确保在播放后生效
    setTimeout(() => {
      if (this._bgm) this._bgm.playbackRate = 1.0
    }, 50)
  }

  stopBgm() {
    if (this._bgm) this._bgm.stop()
  }

  playBossBgm() {
    if (!this.bgmEnabled) return
    // 停止通用BGM
    if (this._bgm) this._bgm.stop()
    // 创建或复用boss BGM实例
    if (!this._bossBgm) {
      this._bossBgm = P.createInnerAudioContext()
      this._bossBgm.src = 'audio_bgm/boss_bgm.mp3'
      this._bossBgm.loop = true
      this._bossBgm.volume = Math.min(1, this._bgmVolume * 1.2)
      this._bossBgm.playbackRate = 1.0
    }
    this._bossBgm.play()
  }

  stopBossBgm() {
    if (this._bossBgm) this._bossBgm.stop()
  }

  /** boss战结束后恢复通用BGM */
  resumeNormalBgm() {
    this.stopBossBgm()
    this.playBgm()
  }

  // ============ 连击音效系统（核心爽感） ============

  // 音阶频率比（十二平均律）：Do Re Mi Fa Sol La Si Do'
  // combo 1-8 对应第一个八度，9-15 对应第二个八度（×2），16+ 顶到最高
  // playbackRate 范围 0.5-2.0，以 combo.mp3 原始音高为 Do 基准
  static get SCALE() {
    return [
      1.0,     // 1  Do
      1.122,   // 2  Re
      1.260,   // 3  Mi
      1.335,   // 4  Fa
      1.498,   // 5  Sol
      1.682,   // 6  La
      1.888,   // 7  Si
      2.0,     // 8  Do'（高八度）
    ]
  }

  /**
   * 连击递进音效 - 钢琴音阶式 Do Re Mi Fa Sol La Si Do
   * combo 1-8：第一个八度，音量逐步增大
   * combo 9+：高八度用 levelup 音色叠加，持续递升刺激感
   * @param {number} comboNum 当前连击数（1开始）
   */
  playComboHit(comboNum) {
    if (!this.enabled) return
    const scale = MusicManager.SCALE
    const n = Math.min(comboNum, 8)
    const pitch = scale[n - 1]
    // 音量：从0.85平滑递增到1.0
    const vol = Math.min(1.0, 0.85 + (comboNum - 1) * 0.025)
    // 音阶整体提高：基础pitch × 1.3（约高大三度）
    this._playSfxEx('audio/combo.mp3', vol, Math.min(2.0, pitch * 1.3))

    // combo 9+：进入第二个八度，用 levelup 音色叠加出更高音阶
    // 第二八度 idx: combo 9→Do(1.0), 10→Re(1.122) ...
    if (comboNum > 8) {
      const idx2 = Math.min(comboNum - 9, scale.length - 1)
      const pitch2 = scale[idx2]
      const vol2 = Math.min(0.6, 0.3 + (comboNum - 9) * 0.05)
      this._playSfxEx('audio/levelup.mp3', vol2, pitch2)
    }

    // 5连击(Sol)开始叠加轻打击音，增加节奏冲击感
    if (comboNum >= 8) {
      this._playSfxEx('audio/attack.mp3', 0.3, pitch)
    } else if (comboNum >= 5) {
      this._playSfxEx('audio/eliminate.mp3', 0.2, pitch)
    }
  }

  /**
   * 连击里程碑突破音效 — 和弦式爆发（配置化）
   * 根据 COMBO_MILESTONES 配置的阈值播放不同层级音效
   * tier 1-2: 和弦铺垫
   * tier 3-4: 力量和弦  
   * tier 5-6: 全爆发扫弦
   * @param {number} comboNum 当前连击数
   */
  playComboMilestone(comboNum) {
    if (!this.enabled) return
    const scale = MusicManager.SCALE
    const tier = getComboTier(comboNum)
    
    // 获取当前里程碑配置
    const milestone = COMBO_MILESTONES.find(m => m.threshold === comboNum)
    
    if (tier === 1 || tier === 2) {
      // 初级/中级里程碑：Sol大三和弦
      this._playSfxEx('audio/levelup.mp3', 0.6, scale[4])  // Sol
      setTimeout(() => {
        if (this.enabled) {
          this._playSfxEx('audio/combo.mp3', 0.45, scale[6])  // Si
          this._playSfxEx('audio/eliminate.mp3', 0.35, scale[7]) // Do'
        }
      }, 40)
    } else if (tier === 3 || tier === 4) {
      // 高级/顶级里程碑：高八度力量和弦
      this._playSfxEx('audio/skill.mp3', 0.7, scale[7])  // Do'
      setTimeout(() => {
        if (this.enabled) {
          this._playSfxEx('audio/combo.mp3', 0.5, scale[4])  // Sol
          this._playSfxEx('audio/attack.mp3', 0.4, scale[7]) // Do'
        }
      }, 50)
    } else if (tier >= 5) {
      // 传说/神话里程碑：全爆发
      this._playSfxEx('audio/boss.mp3', 0.6, scale[0])
      setTimeout(() => {
        if (this.enabled) {
          this._playSfxEx('audio/victory.mp3', 0.5, scale[4])  // Sol
          this._playSfxEx('audio/skill.mp3', 0.4, scale[7])    // Do'
          this._playSfxEx('audio/combo.mp3', 0.35, scale[7])   // Do' 叠加
        }
      }, 60)
    }
    
    // 整3倍数里程碑额外冲击音（在配置的间隔基础上）
    const interval = COMBO_MILESTONES[1] ? COMBO_MILESTONES[1].threshold - COMBO_MILESTONES[0].threshold : 3
    if (comboNum >= 9 && comboNum % interval === 0) {
      const impactVol = Math.min(0.8, 0.5 + (comboNum / 10) * 0.1)
      this._playSfxEx('audio/boss.mp3', impactVol, 0.6)
      setTimeout(() => {
        if (this.enabled) this._playSfxEx('audio/victory.mp3', impactVol * 0.7, 1.0)
      }, 80)
    }
  }

  // ============ 消除音效（层次化+叠加） ============

  playEliminate(count) {
    if (!this.enabled) return
    if (count >= 5) {
      // 5消：主消除音 + 冲击低音叠加 + 高光扫弦
      this._playSfxEx('audio/eliminate.mp3', 0.7, 1.2)
      this._playSfxEx('audio/skill.mp3', 0.3, 0.8)
      setTimeout(() => {
        if (this.enabled) this._playSfxEx('audio/combo.mp3', 0.25, 1.5)
      }, 30)
    } else if (count === 4) {
      // 4消：主消除音 + 轻冲击叠加
      this._playSfxEx('audio/eliminate.mp3', 0.55, 1.1)
      this._playSfxEx('audio/combo.mp3', 0.2, 1.3)
    } else {
      this._playSfx('audio/eliminate.mp3', 0.4)
    }
  }

  // ============ 交互细节音效 ============

  playPickUp() {
    if (!this.enabled) return
    this._playSfxEx('audio/eliminate.mp3', 0.55, 1.3)
  }

  playSwap() {
    if (!this.enabled) return
    if (this._swapPlaying) return
    this._swapPlaying = true
    this._playSfxEx('audio/rolling.mp3', 0.50, 1.3)
    setTimeout(() => { this._swapPlaying = false }, 80)
  }

  playCritHit() {
    if (!this.enabled) return
    this._playSfxEx('audio/combo.mp3', 0.7, 1.6)
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/attack.mp3', 0.6, 0.7)
    }, 50)
  }

  playShieldGain() {
    if (!this.enabled) return
    this._playSfxEx('audio/block.mp3', 0.3, 1.4)
  }

  playHeal() {
    if (!this.enabled) return
    this._playSfxEx('audio/reward.mp3', 0.3, 1.2)
  }

  /** 变珠音效：清脆变化音，珠子越多音量越大 */
  playBeadConvert(count) {
    if (!this.enabled) return
    const vol = Math.min(0.6, 0.25 + (count || 1) * 0.05)
    this._playSfxEx('audio/skill.mp3', vol, 1.5)
  }

  /** DOT伤害音效：低沉的灼烧/中毒声 */
  playDotDmg() {
    if (!this.enabled) return
    this._playSfxEx('audio/enemy_attack.mp3', 0.2, 0.7)
  }

  playDragEnd() {
    if (!this.enabled) return
    this._playSfxEx('audio/eliminate.mp3', 0.55, 0.8)
  }

  // ============ 战斗音效（增强版） ============

  /** 技能蓄力预兆音效 */
  playSkillCharge() {
    if (!this.enabled) return
    this._playSfxEx('audio/skill.mp3', 0.25, 0.6)
  }

  playAttack() {
    if (!this.enabled) return
    this._playSfx('audio/attack.mp3', 0.5)
    // 叠加轻微低频冲击，增强打击顿感
    this._playSfxEx('audio/combo.mp3', 0.15, 0.5)
  }

  playAttackCrit() {
    if (!this.enabled) return
    this._playSfxEx('audio/attack.mp3', 0.65, 1.15)
    this.playCritHit()
  }

  playCombo() {
    if (!this.enabled) return
    this._playSfx('audio/combo.mp3')
  }

  playSkill() {
    if (!this.enabled) return
    this._playSfx('audio/skill.mp3', 0.6)
  }

  playPetSkill() {
    if (!this.enabled) return
    this._playSfx('audio/pet_skill.mp3', 0.7)
  }

  playEnemyAttack(dmgRatio) {
    if (!this.enabled) return
    const vol = dmgRatio != null
      ? Math.min(0.8, 0.4 + dmgRatio * 0.6)
      : 0.5
    this._playSfxEx('audio/enemy_attack.mp3', vol, 1.0)
  }

  playHeroHurt(dmgRatio) {
    if (!this.enabled) return
    const vol = dmgRatio != null
      ? Math.min(0.7, 0.3 + dmgRatio * 0.5)
      : 0.4
    this._playSfxEx('audio/hero_hurt.mp3', vol, 1.0)
  }

  playBlock() {
    if (!this.enabled) return
    this._playSfx('audio/block.mp3', 0.55)
  }

  playEnemySkill() {
    if (!this.enabled) return
    this._playSfx('audio/enemy_skill.mp3', 0.6)
  }

  /** 宠物伤害数值弹出：清脆跳跃的"叮弹"音，与攻击音明显区分 */
  playPetDmgHit(isCrit) {
    if (!this.enabled) return
    // 主体：reward 高速播放，清脆短促的"叮"
    this._playSfxEx('audio/reward.mp3', isCrit ? 0.5 : 0.38, 1.8)
    // 叠加 eliminate 高速，增加弹跳的"嘣"感
    this._playSfxEx('audio/eliminate.mp3', 0.2, 1.6)
    if (isCrit) {
      this._playSfxEx('audio/levelup.mp3', 0.3, 1.5)
    }
  }

  /** 数值翻滚：竹简翻动短促音（带200ms防抖） */
  playRolling() {
    if (!this.enabled) return
    if (this._rollingPlaying) return
    this._rollingPlaying = true
    const a = P.createInnerAudioContext()
    a.src = 'audio/rolling.mp3'; a.volume = 0.2; a.play()
    a.onEnded(() => { a.destroy(); this._rollingPlaying = false })
    setTimeout(() => { this._rollingPlaying = false }, 200)
  }

  // ============ 场景音效 ============

  playBoss() {
    if (!this.enabled) return
    this._playSfx('audio/boss.mp3', 0.7)
  }

  playLevelUp() {
    if (!this.enabled) return
    this._playSfx('audio/levelup.mp3', 0.5)
  }

  /** 进入下一层：崭新开始感，上行明亮和弦 */
  playNextFloor() {
    if (!this.enabled) return
    // 第一声：清亮的起始音（Do高八度）
    this._playSfxEx('audio/skill.mp3', 0.4, 1.3)
    // 第二声：40ms后上行到Mi，增添向上感
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/reward.mp3', 0.45, 1.5)
    }, 40)
    // 第三声：90ms后到Sol，完成大三和弦，明亮开阔
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/levelup.mp3', 0.4, 1.3)
    }, 90)
  }

  playVictory() {
    if (!this.enabled) return
    this._playSfx('audio/victory.mp3', 0.6)
  }

  playReward() {
    if (!this.enabled) return
    this._playSfx('audio/reward.mp3', 0.5)
  }

  /** 数值翻转音效（用于胜利面板数值滚动动画）：快节奏清脆短促 */
  playNumberTick() {
    if (!this.enabled) return
    this._playSfxEx('audio/combo.mp3', 0.3, 2.0)
  }

  /** 新宠物获得/宠物升星提示音效：明亮清脆的叮咚声 */
  playPetObtained() {
    if (!this.enabled) return
    // 第一声：高音清脆叮
    this._playSfxEx('audio/reward.mp3', 0.55, 1.6)
    // 第二声：延迟80ms，更高音的回响
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/levelup.mp3', 0.45, 1.4)
    }, 80)
  }

  /** 三星图鉴解锁庆祝音效 */
  playStar3Unlock() {
    if (!this.enabled) return
    this._playSfx('audio/update3.mp3', 0.7)
  }

  playGameOver() {
    if (!this.enabled) return
    this._playSfx('audio/gameover.mp3', 0.6)
  }

  playRevive() {
    if (!this.enabled) return
    this._playSfxEx('audio/reward.mp3', 0.5, 1.1)
    setTimeout(() => {
      if (this.enabled) this._playSfxEx('audio/levelup.mp3', 0.4, 1.2)
    }, 100)
  }

  // ============ 开关 ============

  toggleBgm() {
    this.bgmEnabled = !this.bgmEnabled
    if (this.bgmEnabled) this.playBgm()
    else { this.stopBgm(); this.stopBossBgm() }
    return this.bgmEnabled
  }

  toggleSfx() {
    this.enabled = !this.enabled
    return this.enabled
  }

  // ============ 内部方法 ============

  /**
   * 从实例池获取音频实例（避免连击时频繁创建/销毁导致音效丢失）
   * 每个 src 维护 _poolSize 个实例，轮询复用
   */
  _getPooled(src) {
    if (!this._sfxPool[src]) {
      this._sfxPool[src] = { idx: 0, items: [] }
      for (let i = 0; i < this._poolSize; i++) {
        const a = P.createInnerAudioContext()
        a.src = src
        this._sfxPool[src].items.push(a)
      }
    }
    const pool = this._sfxPool[src]
    const a = pool.items[pool.idx % pool.items.length]
    pool.idx++
    return a
  }

  /** 基础音效播放 */
  _playSfx(src, volume) {
    const a = this._getPooled(src)
    if (volume !== undefined) a.volume = volume
    a.playbackRate = 1.0
    a.stop()
    a.seek(0)
    a.play()
  }

  /**
   * 增强音效播放 - 支持播放速率（音高）调节
   * 微信小游戏中 playbackRate 需在 play() 后设置才可靠生效
   * @param {string} src 音频文件路径
   * @param {number} volume 音量 0-1
   * @param {number} playbackRate 播放速率 0.5-2.0（>1升调，<1降调）
   */
  _playSfxEx(src, volume, playbackRate) {
    const a = this._getPooled(src)
    if (volume !== undefined) a.volume = volume
    a.stop()
    a.seek(0)
    // 先设一次 playbackRate，再 play，play 后再设一次（双保险）
    const rate = (playbackRate !== undefined && playbackRate !== 1.0) ? playbackRate : 1.0
    a.playbackRate = rate
    a.play()
    // play 后再设一次确保生效（部分机型/版本需要 play 后才接受 playbackRate）
    if (rate !== 1.0) {
      a.playbackRate = rate
    }
  }
}

module.exports = new MusicManager()
