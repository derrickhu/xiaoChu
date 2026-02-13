/**
 * 修仙消消乐 - 音效管理
 */
class MusicManager {
  constructor() {
    this.enabled = true
    this.bgmEnabled = true
  }

  playBgm() {
    if (!this.bgmEnabled) return
    if (!this._bgm) {
      this._bgm = wx.createInnerAudioContext()
      this._bgm.src = 'audio/bgm.mp3'
      this._bgm.loop = true
      this._bgm.volume = 0.3
    }
    this._bgm.play()
  }

  stopBgm() {
    if (this._bgm) this._bgm.stop()
  }

  playEliminate() {
    if (!this.enabled) return
    const a = wx.createInnerAudioContext()
    a.src = 'audio/boom.mp3'
    a.play()
    a.onEnded(() => a.destroy())
  }

  playAttack() {
    if (!this.enabled) return
    const a = wx.createInnerAudioContext()
    a.src = 'audio/bullet.mp3'
    a.play()
    a.onEnded(() => a.destroy())
  }

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
}

module.exports = new MusicManager()
