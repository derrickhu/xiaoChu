/**
 * 龙珠战纪 - 转珠消除RPG微信小游戏
 * Canvas 2D 实现，复刻智龙迷城核心玩法
 */
const CHARACTERS = require('./data/characters')
const LEVELS = require('./data/levels')
const Storage = require('./data/storage')
const music = require('./runtime/music')

const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')
const W = canvas.width
const H = canvas.height
const scale = W / 375
const sysInfo = wx.getSystemInfoSync()
let safeTop = 40 // 默认安全区域
try {
  const menuBtn = wx.getMenuButtonBoundingClientRect()
  if (menuBtn && menuBtn.bottom) {
    safeTop = (menuBtn.bottom + 8) * (W / sysInfo.windowWidth)
  }
} catch (e) {
  console.warn('获取菜单按钮失败，使用默认安全区域', e)
}

// 属性配色
const ATTR_COLORS = {
  '火': { main: '#e74c3c', light: '#ff7675', dark: '#c0392b', glow: 'rgba(231,76,60,0.4)' },
  '水': { main: '#3498db', light: '#74b9ff', dark: '#2980b9', glow: 'rgba(52,152,219,0.4)' },
  '木': { main: '#27ae60', light: '#55efc4', dark: '#229954', glow: 'rgba(39,174,96,0.4)' },
  '光': { main: '#f39c12', light: '#ffeaa7', dark: '#e67e22', glow: 'rgba(243,156,18,0.4)' },
  '暗': { main: '#8e44ad', light: '#a29bfe', dark: '#6c3483', glow: 'rgba(142,68,173,0.4)' },
  '心': { main: '#e84393', light: '#fd79a8', dark: '#c2185b', glow: 'rgba(232,67,147,0.4)' }
}

const ATTR_SYMBOLS = { '火': '🔥', '水': '💧', '木': '🌿', '光': '✨', '暗': '🌑', '心': '💗' }
const BEAD_ATTRS = ['火', '水', '木', '光', '暗', '心']

// 属性克制映射：key克制value
const COUNTER_MAP = { '火': '木', '木': '水', '水': '火', '光': '暗', '暗': '光' }

// 宝珠纹理符号（用文字渲染替代图片）
const BEAD_ICONS = { '火': '炎', '水': '水', '木': '木', '光': '光', '暗': '暗', '心': '心' }

class Main {
  constructor() {
    this.storage = new Storage()
    this.scene = 'home' // home, levelSelect, teamEdit, battle, battlePrepare
    this.animFrame = 0

    // 转珠棋盘
    this.cols = 6
    this.rows = 5
    this.beadSize = W / 7
    this.beads = []
    this.isDragging = false
    this.selectedBead = null
    this.lastSwapTarget = null
    this.boardOffsetX = (W - this.cols * this.beadSize) / 2
    this.boardOffsetY = H * 0.50

    // 战斗状态
    this.battleState = 'idle' // idle, playerTurn, eliminating, settling, enemyTurn, victory, defeat
    this.currentLevelData = null
    this.enemyHp = 0
    this.enemyMaxHp = 0
    this.teamHp = 0
    this.teamMaxHp = 0
    this.turnCount = 0
    this.combo = 0
    this.comboDisplay = 0
    this.comboTimer = 0
    this.damageFloats = []
    this.eliminateAnim = 0
    this.eliminateGroups = []
    this.settleResult = null

    // 队伍数据（运行时）
    this.teamChars = []

    // 动画
    this.particles = []
    this.shakeTimer = 0
    this.shakeIntensity = 0

    // 新手引导
    this.guideStep = 0
    this.showGuide = false

    // UI状态
    this.scrollY = 0
    this.selectedSlot = -1

    this.bindTouch()
    this.loop()
    music.playBgm()
  }

  // ===== 游戏循环 =====
  loop() {
    this.animFrame++
    this.update()
    this.render()
    requestAnimationFrame(() => this.loop())
  }

  update() {
    // 更新粒子
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx
      p.y += p.vy
      p.life -= 0.02
      if (p.life <= 0) this.particles.splice(i, 1)
    }

    // 更新伤害飘字
    for (let i = this.damageFloats.length - 1; i >= 0; i--) {
      const d = this.damageFloats[i]
      d.y -= 1.5 * scale
      d.life -= 0.02
      if (d.life <= 0) this.damageFloats.splice(i, 1)
    }

    // Combo显示计时
    if (this.comboTimer > 0) this.comboTimer--

    // 屏幕震动
    if (this.shakeTimer > 0) this.shakeTimer--

    // 消除动画
    if (this.battleState === 'eliminating' && this.eliminateAnim > 0) {
      this.eliminateAnim--
      if (this.eliminateAnim <= 0) {
        this.afterEliminate()
      }
    }
  }

  render() {
    ctx.save()
    // 屏幕震动
    if (this.shakeTimer > 0) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity
      const sy = (Math.random() - 0.5) * this.shakeIntensity
      ctx.translate(sx, sy)
    }

    switch (this.scene) {
      case 'home': this.renderHome(); break
      case 'levelSelect': this.renderLevelSelect(); break
      case 'teamEdit': this.renderTeamEdit(); break
      case 'battlePrepare': this.renderBattlePrepare(); break
      case 'battle': this.renderBattle(); break
    }
    ctx.restore()
  }

  // ===== 首页 =====
  renderHome() {
    // 深色渐变背景
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(0.5, '#16213e')
    grad.addColorStop(1, '#0f3460')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // 装饰粒子
    this.renderBgParticles()

    // 标题
    const titleY = H * 0.22
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // 标题光晕
    ctx.shadowColor = '#f39c12'
    ctx.shadowBlur = 20 * scale
    ctx.fillStyle = '#f39c12'
    ctx.font = `bold ${42 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('龙珠战纪', W / 2, titleY)
    ctx.shadowBlur = 0

    // 副标题
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${14 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('— 转珠消除 × 回合RPG —', W / 2, titleY + 36 * scale)

    // 属性宝珠装饰
    const orbY = titleY + 70 * scale
    BEAD_ATTRS.forEach((attr, i) => {
      const x = W / 2 + (i - 2.5) * 36 * scale
      this.drawBead(x, orbY, 14 * scale, attr, 1, 0.7 + 0.3 * Math.sin(this.animFrame * 0.05 + i))
    })

    // 按钮
    const btnW = W * 0.55
    const btnH = 48 * scale
    const btnX = (W - btnW) / 2
    const btnStartY = H * 0.50

    // 开始战斗
    this.drawButton(btnX, btnStartY, btnW, btnH, '开始战斗', '#e74c3c', '#c0392b')
    // 关卡选择
    this.drawButton(btnX, btnStartY + 65 * scale, btnW, btnH, '关卡选择', '#3498db', '#2980b9')
    // 编辑队伍
    this.drawButton(btnX, btnStartY + 130 * scale, btnW, btnH, '编辑队伍', '#27ae60', '#229954')

    // 底部信息
    ctx.fillStyle = 'rgba(255,255,255,0.4)'
    ctx.font = `${12 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`金币: ${this.storage.gold}  |  已解锁角色: ${this.storage.unlockedChars.length}/${CHARACTERS.length}`, W / 2, H - 30 * scale)
  }

  // ===== 关卡选择 =====
  renderLevelSelect() {
    this.renderDarkBg()
    this.renderTopBar('关卡选择', true)

    const barH = safeTop + 44 * scale
    const startY = barH + 20 * scale
    const iconSize = W / 5
    const cols = 3
    const gapX = (W - cols * iconSize) / (cols + 1)
    const gapY = 20 * scale

    LEVELS.forEach((lv, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const x = gapX + col * (iconSize + gapX)
      const y = startY + row * (iconSize + gapY + 20 * scale)
      const cx = x + iconSize / 2
      const cy = y + iconSize / 2
      const unlocked = this.storage.isLevelUnlocked(lv.levelId)
      const passed = this.storage.isLevelPassed(lv.levelId)

      // 圆形背景
      ctx.beginPath()
      ctx.arc(cx, cy, iconSize / 2, 0, Math.PI * 2)
      const enemyAttr = lv.enemy.attr
      if (unlocked) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, iconSize / 2)
        g.addColorStop(0, ATTR_COLORS[enemyAttr].light)
        g.addColorStop(1, ATTR_COLORS[enemyAttr].main)
        ctx.fillStyle = g
      } else {
        ctx.fillStyle = '#333'
      }
      ctx.fill()

      // 边框
      ctx.strokeStyle = passed ? '#f39c12' : unlocked ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'
      ctx.lineWidth = passed ? 3 : 1.5
      ctx.stroke()

      // 关卡号
      ctx.globalAlpha = unlocked ? 1 : 0.4
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${22 * scale}px "PingFang SC", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(unlocked ? lv.levelId : '🔒', cx, cy - 4 * scale)

      // 关卡名
      ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
      ctx.fillText(lv.levelName, cx, cy + iconSize / 2 + 14 * scale)

      // 通关标记
      if (passed) {
        ctx.fillStyle = '#f39c12'
        ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
        ctx.fillText('✓ 已通关', cx, cy + 14 * scale)
      }

      ctx.globalAlpha = 1
    })
  }

  // ===== 战斗准备界面 =====
  renderBattlePrepare() {
    this.renderDarkBg()
    this.renderTopBar('战斗准备', true)

    const barH = safeTop + 44 * scale
    const lv = this.currentLevelData

    // 关卡名称
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${20 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`第${lv.levelId}关 · ${lv.levelName}`, W / 2, barH + 30 * scale)

    // 敌方信息
    const enemyY = barH + 70 * scale
    const eColor = ATTR_COLORS[lv.enemy.attr]

    // 敌方头像
    ctx.beginPath()
    ctx.arc(W / 2, enemyY + 40 * scale, 40 * scale, 0, Math.PI * 2)
    const eg = ctx.createRadialGradient(W / 2, enemyY + 40 * scale, 0, W / 2, enemyY + 40 * scale, 40 * scale)
    eg.addColorStop(0, eColor.light)
    eg.addColorStop(1, eColor.dark)
    ctx.fillStyle = eg
    ctx.fill()
    ctx.strokeStyle = eColor.main
    ctx.lineWidth = 2
    ctx.stroke()

    // 敌方名称
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${14 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(BEAD_ICONS[lv.enemy.attr], W / 2, enemyY + 36 * scale)
    ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(lv.enemy.enemyName, W / 2, enemyY + 90 * scale)

    // 属性信息
    ctx.fillStyle = eColor.main
    ctx.font = `${12 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(`属性: ${lv.enemy.attr}  |  HP: ${lv.enemy.hp}  |  ATK: ${lv.enemy.atk}`, W / 2, enemyY + 110 * scale)

    // 我方队伍预览
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${13 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('— 我方队伍 —', W / 2, enemyY + 145 * scale)

    const teamY = enemyY + 170 * scale
    const iconR = 22 * scale
    const team = this.getTeamChars()
    team.forEach((ch, i) => {
      if (!ch) return
      const x = W / 2 + (i - (team.length - 1) / 2) * (iconR * 2 + 10 * scale)
      this.drawCharIcon(x, teamY, iconR, ch, false)
    })

    // 按钮
    const btnW = W * 0.4
    const btnH = 44 * scale
    const btnY = H * 0.78

    this.drawButton(W / 2 - btnW - 10 * scale, btnY, btnW, btnH, '编辑队伍', '#3498db', '#2980b9')
    this.drawButton(W / 2 + 10 * scale, btnY, btnW, btnH, '开始战斗', '#e74c3c', '#c0392b')
  }

  // ===== 队伍编辑 =====
  renderTeamEdit() {
    this.renderDarkBg()
    this.renderTopBar('编辑队伍', true)

    const barH = safeTop + 44 * scale

    // 右侧：队伍槽位
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    ctx.fillRect(0, barH, W, 120 * scale)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `${12 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('当前队伍（点击移除角色）', W / 2, barH + 16 * scale)

    const slotY = barH + 40 * scale
    const slotR = 22 * scale
    for (let i = 0; i < 6; i++) {
      const x = W / 2 + (i - 2.5) * (slotR * 2 + 12 * scale)
      const charId = this.storage.teamData[i]
      const ch = charId ? CHARACTERS.find(c => c.charId === charId) : null

      if (ch) {
        this.drawCharIcon(x, slotY, slotR, ch, false)
      } else {
        // 空槽位
        ctx.beginPath()
        ctx.arc(x, slotY, slotR, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])

        ctx.fillStyle = 'rgba(255,255,255,0.3)'
        ctx.font = `${20 * scale}px "PingFang SC", sans-serif`
        ctx.fillText('+', x, slotY)
      }

      // 队长标记
      if (i === 0) {
        ctx.fillStyle = '#f39c12'
        ctx.font = `${9 * scale}px "PingFang SC", sans-serif`
        ctx.fillText('队长', x, slotY + slotR + 12 * scale)
      } else if (i === 5) {
        ctx.fillStyle = '#8e44ad'
        ctx.font = `${9 * scale}px "PingFang SC", sans-serif`
        ctx.fillText('友队长', x, slotY + slotR + 12 * scale)
      }
    }

    // 左侧：角色列表
    const listY = barH + 130 * scale
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `${12 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('可用角色（点击添加到队伍）', W / 2, listY)

    const cardH = 60 * scale
    const cardW = W * 0.9
    const cardX = (W - cardW) / 2

    this.storage.unlockedChars.forEach((charId, i) => {
      const ch = CHARACTERS.find(c => c.charId === charId)
      if (!ch) return
      const y = listY + 16 * scale + i * (cardH + 8 * scale)
      const inTeam = this.storage.teamData.includes(charId)

      // 卡片背景
      ctx.fillStyle = inTeam ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'
      this.roundRect(cardX, y, cardW, cardH, 8 * scale)
      ctx.fill()

      // 左边框色条
      const ac = ATTR_COLORS[ch.attr]
      ctx.fillStyle = ac.main
      this.roundRect(cardX, y, 4 * scale, cardH, 2 * scale)
      ctx.fill()

      // 头像
      this.drawCharIcon(cardX + 35 * scale, y + cardH / 2, 18 * scale, ch, false)

      // 信息
      ctx.globalAlpha = inTeam ? 0.4 : 1
      ctx.fillStyle = '#fff'
      ctx.textAlign = 'left'
      ctx.font = `bold ${14 * scale}px "PingFang SC", sans-serif`
      ctx.fillText(ch.charName, cardX + 60 * scale, y + 18 * scale)

      ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
      ctx.fillStyle = ac.light
      ctx.fillText(`${ch.attr}属性`, cardX + 60 * scale, y + 34 * scale)

      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillText(`ATK:${ch.baseAtk}  HP:${ch.baseHp}`, cardX + 60 * scale, y + 48 * scale)

      // 技能
      if (ch.activeSkill) {
        ctx.textAlign = 'right'
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = `${10 * scale}px "PingFang SC", sans-serif`
        ctx.fillText(`技能: ${ch.activeSkill.skillName}`, cardX + cardW - 10 * scale, y + 20 * scale)
        ctx.fillText(`CD: ${ch.activeSkill.cd}回合`, cardX + cardW - 10 * scale, y + 34 * scale)
      }

      if (inTeam) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.textAlign = 'right'
        ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
        ctx.fillText('已在队伍中', cardX + cardW - 10 * scale, y + 48 * scale)
      }

      ctx.globalAlpha = 1
      ctx.textAlign = 'center'
    })

    // 确认按钮
    const btnW2 = W * 0.5
    const btnH2 = 44 * scale
    this.drawButton((W - btnW2) / 2, H - 70 * scale, btnW2, btnH2, '确认', '#27ae60', '#229954')
  }

  // ===== 战斗界面 =====
  renderBattle() {
    // 战斗背景
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#0f0f23')
    grad.addColorStop(0.4, '#1a1a35')
    grad.addColorStop(1, '#0a0a1a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    const lv = this.currentLevelData
    if (!lv) return

    // --- 顶部区域(20%)：敌方信息 ---
    const topH = H * 0.18
    const topContentY = safeTop + 10 * scale

    // 回合数
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${12 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'top'
    ctx.fillText(`回合: ${this.turnCount}`, W - 16 * scale, topContentY)

    // 敌方头像
    const enemyIconX = 50 * scale
    const enemyIconY = topContentY + 28 * scale
    const eColor = ATTR_COLORS[lv.enemy.attr]
    ctx.beginPath()
    ctx.arc(enemyIconX, enemyIconY, 26 * scale, 0, Math.PI * 2)
    const eGrad = ctx.createRadialGradient(enemyIconX, enemyIconY, 0, enemyIconX, enemyIconY, 26 * scale)
    eGrad.addColorStop(0, eColor.light)
    eGrad.addColorStop(1, eColor.dark)
    ctx.fillStyle = eGrad
    ctx.fill()
    ctx.strokeStyle = eColor.main
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = `bold ${16 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(BEAD_ICONS[lv.enemy.attr], enemyIconX, enemyIconY)

    // 敌方名称
    ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(lv.enemy.enemyName, enemyIconX, enemyIconY + 36 * scale)

    // 敌方HP条
    const hpBarX = 90 * scale
    const hpBarY = enemyIconY - 5 * scale
    const hpBarW = W * 0.55
    const hpBarH = 14 * scale
    this.drawHpBar(hpBarX, hpBarY, hpBarW, hpBarH, this.enemyHp, this.enemyMaxHp, '#e74c3c')

    // 敌方HP文字
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `${10 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(`${Math.ceil(this.enemyHp)} / ${this.enemyMaxHp}`, hpBarX, hpBarY + hpBarH + 14 * scale)

    // 敌方技能倒计时
    if (lv.enemy.skill) {
      const turnsLeft = lv.enemy.skill.triggerTurn - ((this.turnCount - 1) % lv.enemy.skill.triggerTurn + 1)
      ctx.textAlign = 'right'
      ctx.fillStyle = turnsLeft <= 1 ? '#e74c3c' : 'rgba(255,255,255,0.5)'
      ctx.font = `${11 * scale}px "PingFang SC", sans-serif`
      ctx.fillText(`攻击倒计时: ${turnsLeft + 1}`, W - 16 * scale, hpBarY + hpBarH + 14 * scale)
    }

    // --- 中部区域(30%)：我方队伍 ---
    const midY = topH + safeTop
    const midH = H * 0.28
    const charIconR = W / 16
    const charSpacing = W / (this.teamChars.length + 1)

    // 我方HP条
    const teamHpBarY = midY + 4 * scale
    this.drawHpBar(16 * scale, teamHpBarY, W - 32 * scale, 10 * scale, this.teamHp, this.teamMaxHp, '#27ae60')
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${10 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`HP: ${Math.ceil(this.teamHp)} / ${this.teamMaxHp}`, W / 2, teamHpBarY + 20 * scale)

    // 角色头像
    const charY = midY + 50 * scale
    this.teamChars.forEach((ch, i) => {
      if (!ch) return
      const x = charSpacing * (i + 1)
      const cdReady = ch._cd === 0 && ch.activeSkill
      this.drawCharIcon(x, charY, charIconR, ch, cdReady)

      // CD倒计时
      if (ch.activeSkill) {
        if (ch._cd > 0) {
          ctx.beginPath()
          ctx.arc(x + charIconR * 0.6, charY - charIconR * 0.6, 9 * scale, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0,0,0,0.8)'
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.font = `bold ${9 * scale}px "PingFang SC", sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(ch._cd, x + charIconR * 0.6, charY - charIconR * 0.6)
        } else {
          // CD就绪闪烁
          ctx.beginPath()
          ctx.arc(x + charIconR * 0.6, charY - charIconR * 0.6, 9 * scale, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(243,156,18,${0.5 + 0.5 * Math.sin(this.animFrame * 0.1)})`
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.font = `bold ${9 * scale}px "PingFang SC", sans-serif`
          ctx.fillText('!', x + charIconR * 0.6, charY - charIconR * 0.6)
        }
      }

      // 角色名
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = `${9 * scale}px "PingFang SC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(ch.charName, x, charY + charIconR + 12 * scale)
    })

    // 状态提示
    const stateY = charY + charIconR + 28 * scale
    ctx.textAlign = 'center'
    ctx.font = `bold ${13 * scale}px "PingFang SC", sans-serif`
    if (this.battleState === 'playerTurn') {
      ctx.fillStyle = '#f39c12'
      ctx.fillText('▶ 你的回合 — 滑动转珠', W / 2, stateY)
    } else if (this.battleState === 'eliminating' || this.battleState === 'settling') {
      ctx.fillStyle = '#e74c3c'
      ctx.fillText('⚡ 结算中...', W / 2, stateY)
    } else if (this.battleState === 'enemyTurn') {
      ctx.fillStyle = '#e74c3c'
      ctx.fillText('⚠ 敌方回合', W / 2, stateY)
    } else if (this.battleState === 'victory') {
      ctx.fillStyle = '#27ae60'
      ctx.fillText('🎉 战斗胜利！', W / 2, stateY)
    } else if (this.battleState === 'defeat') {
      ctx.fillStyle = '#e74c3c'
      ctx.fillText('💀 战斗失败', W / 2, stateY)
    }

    // --- 底部区域(50%)：转珠棋盘 ---
    this.renderBoard()

    // Combo显示
    if (this.comboTimer > 0 && this.comboDisplay > 0) {
      const comboAlpha = Math.min(1, this.comboTimer / 15)
      const comboScale = 1 + 0.3 * (1 - comboAlpha)
      ctx.save()
      ctx.globalAlpha = comboAlpha
      ctx.translate(W / 2, this.boardOffsetY - 20 * scale)
      ctx.scale(comboScale, comboScale)
      ctx.fillStyle = '#f39c12'
      ctx.font = `bold ${36 * scale}px "PingFang SC", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(`${this.comboDisplay} Combo!`, 0, 0)
      ctx.restore()
    }

    // 伤害飘字
    this.damageFloats.forEach(d => {
      ctx.globalAlpha = Math.min(1, d.life * 2)
      ctx.fillStyle = d.color
      ctx.font = `bold ${d.size}px "PingFang SC", sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(d.text, d.x, d.y)
      ctx.globalAlpha = 1
    })

    // 消除粒子
    this.particles.forEach(p => {
      ctx.globalAlpha = p.life
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    })

    // 胜利/失败弹窗
    if (this.battleState === 'victory') this.renderVictoryModal()
    if (this.battleState === 'defeat') this.renderDefeatModal()

    // 新手引导
    if (this.showGuide) this.renderGuide()
  }

  // ===== 转珠棋盘渲染 =====
  renderBoard() {
    const ox = this.boardOffsetX
    const oy = this.boardOffsetY
    const bs = this.beadSize

    // 棋盘背景
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    this.roundRect(ox - 6 * scale, oy - 6 * scale, this.cols * bs + 12 * scale, this.rows * bs + 12 * scale, 10 * scale)
    ctx.fill()

    // 棋盘格子线
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= this.rows; i++) {
      ctx.beginPath()
      ctx.moveTo(ox, oy + i * bs)
      ctx.lineTo(ox + this.cols * bs, oy + i * bs)
      ctx.stroke()
    }
    for (let j = 0; j <= this.cols; j++) {
      ctx.beginPath()
      ctx.moveTo(ox + j * bs, oy)
      ctx.lineTo(ox + j * bs, oy + this.rows * bs)
      ctx.stroke()
    }

    // 绘制宝珠
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols; j++) {
        const bead = this.beads[i] && this.beads[i][j]
        if (!bead || bead.alpha <= 0) continue
        const cx = ox + j * bs + bs / 2
        const cy = oy + i * bs + bs / 2
        const r = (bs / 2 - 3 * scale) * bead.scale

        // 偏移（抖动等）
        const dx = bead.offsetX || 0
        const dy = bead.offsetY || 0

        ctx.globalAlpha = bead.alpha
        this.drawBead(cx + dx, cy + dy, r, bead.attr, bead.scale, bead.alpha)

        // 选中高亮
        if (this.selectedBead && this.selectedBead.row === i && this.selectedBead.col === j) {
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2.5 * scale
          ctx.beginPath()
          ctx.arc(cx + dx, cy + dy, r + 2 * scale, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.globalAlpha = 1
      }
    }
  }

  // ===== 绘制单个宝珠 =====
  drawBead(cx, cy, r, attr, beadScale, alpha) {
    const color = ATTR_COLORS[attr]
    ctx.save()
    ctx.globalAlpha = alpha || 1

    // 外圈光晕
    ctx.beginPath()
    ctx.arc(cx, cy, r + 2 * scale, 0, Math.PI * 2)
    ctx.fillStyle = color.glow
    ctx.fill()

    // 主体渐变球
    const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r)
    g.addColorStop(0, color.light)
    g.addColorStop(0.6, color.main)
    g.addColorStop(1, color.dark)
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()

    // 高光
    ctx.beginPath()
    ctx.arc(cx - r * 0.25, cy - r * 0.25, r * 0.35, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fill()

    // 属性文字
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${r * 0.9}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 3
    ctx.fillText(BEAD_ICONS[attr], cx, cy + 1)
    ctx.shadowBlur = 0

    ctx.restore()
  }

  // ===== 绘制角色头像 =====
  drawCharIcon(x, y, r, ch, highlight) {
    const color = ATTR_COLORS[ch.attr]
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, color.light)
    g.addColorStop(1, color.dark)
    ctx.fillStyle = g
    ctx.fill()

    if (highlight) {
      ctx.strokeStyle = '#f39c12'
      ctx.lineWidth = 3
      ctx.shadowColor = '#f39c12'
      ctx.shadowBlur = 10 * scale
    } else {
      ctx.strokeStyle = color.main
      ctx.lineWidth = 1.5
    }
    ctx.stroke()
    ctx.shadowBlur = 0

    // 角色名首字
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${r * 0.8}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(ch.charName[0], x, y)
  }

  // ===== HP条 =====
  drawHpBar(x, y, w, h, current, max, color) {
    // 背景
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    this.roundRect(x, y, w, h, h / 2)
    ctx.fill()

    // 进度
    const ratio = Math.max(0, current / max)
    if (ratio > 0) {
      const g = ctx.createLinearGradient(x, y, x + w * ratio, y)
      g.addColorStop(0, color)
      g.addColorStop(1, color === '#e74c3c' ? '#c0392b' : '#229954')
      ctx.fillStyle = g
      this.roundRect(x, y, w * ratio, h, h / 2)
      ctx.fill()
    }
  }

  // ===== 按钮 =====
  drawButton(x, y, w, h, text, color1, color2) {
    const g = ctx.createLinearGradient(x, y, x, y + h)
    g.addColorStop(0, color1)
    g.addColorStop(1, color2)
    ctx.fillStyle = g
    this.roundRect(x, y, w, h, h / 2)
    ctx.fill()

    // 按钮光泽
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    this.roundRect(x, y, w, h / 2, h / 2)
    ctx.fill()

    ctx.fillStyle = '#fff'
    ctx.font = `bold ${16 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x + w / 2, y + h / 2)
  }

  // ===== 通用方法 =====
  renderDarkBg() {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#1a1a2e')
    grad.addColorStop(0.5, '#16213e')
    grad.addColorStop(1, '#0f3460')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
    this.renderBgParticles()
  }

  renderBgParticles() {
    const t = this.animFrame * 0.01
    for (let i = 0; i < 20; i++) {
      const x = ((i * 137 + t * 30) % W)
      const y = ((i * 97 + t * 15) % H)
      const alpha = 0.1 + 0.1 * Math.sin(t * 2 + i)
      ctx.fillStyle = `rgba(243,156,18,${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, 2 * scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  renderTopBar(title, showBack) {
    const barH = safeTop + 44 * scale
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(0, 0, W, barH)

    ctx.strokeStyle = 'rgba(255,255,255,0.1)'
    ctx.lineWidth = 0.5
    ctx.beginPath()
    ctx.moveTo(0, barH)
    ctx.lineTo(W, barH)
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = `bold ${18 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(title, W / 2, safeTop + 22 * scale)

    if (showBack) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.font = `${14 * scale}px "PingFang SC", sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText('< 返回', 16 * scale, safeTop + 22 * scale)
    }
  }

  roundRect(x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  // ===== 胜利弹窗 =====
  renderVictoryModal() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    const modalW = W * 0.8
    const modalH = 280 * scale
    const mx = (W - modalW) / 2
    const my = (H - modalH) / 2

    // 弹窗背景
    ctx.fillStyle = '#1e1e3a'
    this.roundRect(mx, my, modalW, modalH, 16 * scale)
    ctx.fill()
    ctx.strokeStyle = '#f39c12'
    ctx.lineWidth = 2
    this.roundRect(mx, my, modalW, modalH, 16 * scale)
    ctx.stroke()

    // 顶部装饰
    const tg = ctx.createLinearGradient(mx, my, mx + modalW, my)
    tg.addColorStop(0, '#f39c12')
    tg.addColorStop(1, '#e74c3c')
    ctx.fillStyle = tg
    this.roundRect(mx, my, modalW, 6 * scale, 16 * scale)
    ctx.fill()

    // 胜利文字
    ctx.fillStyle = '#f39c12'
    ctx.font = `bold ${28 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('战斗胜利！', W / 2, my + 50 * scale)

    // 奖励信息
    const lv = this.currentLevelData
    ctx.fillStyle = '#fff'
    ctx.font = `${14 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(`获得金币: +${lv.reward.gold}`, W / 2, my + 90 * scale)

    if (lv.reward.charId) {
      const newChar = CHARACTERS.find(c => c.charId === lv.reward.charId)
      if (newChar) {
        ctx.fillStyle = ATTR_COLORS[newChar.attr].light
        ctx.fillText(`解锁角色: ${newChar.charName}`, W / 2, my + 115 * scale)
      }
    }

    // 战斗统计
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `${12 * scale}px "PingFang SC", sans-serif`
    ctx.fillText(`用时 ${this.turnCount} 回合`, W / 2, my + 145 * scale)

    // 按钮
    const btnW2 = modalW * 0.38
    const btnH2 = 40 * scale
    const btnY = my + modalH - 65 * scale

    this.drawButton(mx + 15 * scale, btnY, btnW2, btnH2, '返回关卡', '#3498db', '#2980b9')

    const nextLevel = LEVELS.find(l => l.levelId === lv.levelId + 1)
    if (nextLevel) {
      this.drawButton(mx + modalW - btnW2 - 15 * scale, btnY, btnW2, btnH2, '下一关', '#e74c3c', '#c0392b')
    }
  }

  // ===== 失败弹窗 =====
  renderDefeatModal() {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, W, H)

    const modalW = W * 0.8
    const modalH = 220 * scale
    const mx = (W - modalW) / 2
    const my = (H - modalH) / 2

    ctx.fillStyle = '#1e1e3a'
    this.roundRect(mx, my, modalW, modalH, 16 * scale)
    ctx.fill()
    ctx.strokeStyle = '#e74c3c'
    ctx.lineWidth = 2
    this.roundRect(mx, my, modalW, modalH, 16 * scale)
    ctx.stroke()

    ctx.fillStyle = '#e74c3c'
    ctx.font = `bold ${28 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('战斗失败', W / 2, my + 55 * scale)

    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.font = `${14 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('不要放弃，再试一次！', W / 2, my + 95 * scale)

    const btnW2 = modalW * 0.38
    const btnH2 = 40 * scale
    const btnY = my + modalH - 60 * scale

    this.drawButton(mx + 15 * scale, btnY, btnW2, btnH2, '返回关卡', '#3498db', '#2980b9')
    this.drawButton(mx + modalW - btnW2 - 15 * scale, btnY, btnW2, btnH2, '重新挑战', '#e74c3c', '#c0392b')
  }

  // ===== 新手引导 =====
  renderGuide() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, W, H)

    const guideTexts = [
      '滑动宝珠，连成3个及以上\n即可消除！',
      '消除宝珠可触发攻击\n对敌方造成伤害！',
      '点击角色头像\n可释放主动技能！',
      '通关可获得奖励\n解锁新角色！'
    ]
    const text = guideTexts[this.guideStep] || ''
    const lines = text.split('\n')

    const boxW = W * 0.7
    const boxH = 120 * scale
    const bx = (W - boxW) / 2
    const by = H * 0.35

    ctx.fillStyle = 'rgba(30,30,58,0.95)'
    this.roundRect(bx, by, boxW, boxH, 12 * scale)
    ctx.fill()
    ctx.strokeStyle = '#f39c12'
    ctx.lineWidth = 1.5
    this.roundRect(bx, by, boxW, boxH, 12 * scale)
    ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = `${15 * scale}px "PingFang SC", sans-serif`
    ctx.textAlign = 'center'
    lines.forEach((line, i) => {
      ctx.fillText(line, W / 2, by + 35 * scale + i * 24 * scale)
    })

    // 继续按钮
    ctx.fillStyle = '#f39c12'
    ctx.font = `${13 * scale}px "PingFang SC", sans-serif`
    ctx.fillText('点击继续 ▶', W / 2, by + boxH - 16 * scale)
  }

  // ===== 棋盘逻辑 =====
  initBoard() {
    let attempts = 0
    do {
      this.beads = []
      for (let i = 0; i < this.rows; i++) {
        const row = []
        for (let j = 0; j < this.cols; j++) {
          let attr
          do {
            attr = BEAD_ATTRS[Math.floor(Math.random() * 6)]
          } while (
            (j >= 2 && row[j - 1].attr === attr && row[j - 2].attr === attr) ||
            (i >= 2 && this.beads[i - 1][j].attr === attr && this.beads[i - 2][j].attr === attr)
          )
          row.push({ attr, scale: 1.0, alpha: 1.0, offsetX: 0, offsetY: 0 })
        }
        this.beads.push(row)
      }
      attempts++
    } while (this.checkEliminate().length > 0 && attempts < 100)
  }

  checkEliminate() {
    const groups = []
    const marked = Array.from({ length: this.rows }, () => Array(this.cols).fill(false))

    // 横向检测
    for (let i = 0; i < this.rows; i++) {
      for (let j = 0; j < this.cols - 2; j++) {
        const attr = this.beads[i][j].attr
        if (attr === this.beads[i][j + 1].attr && attr === this.beads[i][j + 2].attr) {
          let end = j + 2
          while (end + 1 < this.cols && this.beads[i][end + 1].attr === attr) end++
          const group = { attr, cells: [] }
          for (let k = j; k <= end; k++) {
            if (!marked[i][k]) {
              group.cells.push({ row: i, col: k })
              marked[i][k] = true
            }
          }
          if (group.cells.length > 0) groups.push(group)
          j = end
        }
      }
    }

    // 纵向检测
    for (let j = 0; j < this.cols; j++) {
      for (let i = 0; i < this.rows - 2; i++) {
        const attr = this.beads[i][j].attr
        if (attr === this.beads[i + 1][j].attr && attr === this.beads[i + 2][j].attr) {
          let end = i + 2
          while (end + 1 < this.rows && this.beads[end + 1][j].attr === attr) end++
          const group = { attr, cells: [] }
          for (let k = i; k <= end; k++) {
            if (!marked[k][j]) {
              group.cells.push({ row: k, col: j })
              marked[k][j] = true
            }
          }
          if (group.cells.length > 0) groups.push(group)
          i = end
        }
      }
    }

    return groups
  }

  executeEliminate(groups) {
    this.battleState = 'eliminating'
    this.eliminateGroups = groups
    this.eliminateAnim = 30 // 0.5秒@60fps

    let heartCount = 0

    // 标记消除宝珠+播放消除动画
    groups.forEach(group => {
      group.cells.forEach(({ row, col }) => {
        const bead = this.beads[row][col]
        bead._eliminating = true
        if (bead.attr === '心') heartCount++

        // 生成消除粒子
        const cx = this.boardOffsetX + col * this.beadSize + this.beadSize / 2
        const cy = this.boardOffsetY + row * this.beadSize + this.beadSize / 2
        const color = ATTR_COLORS[bead.attr].light
        for (let p = 0; p < 6; p++) {
          this.particles.push({
            x: cx, y: cy,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            r: 3 * scale,
            color,
            life: 1
          })
        }
      })
    })

    // 累计Combo
    this.combo += groups.length
    this.comboDisplay = this.combo
    this.comboTimer = 60

    music.playEliminate()

    // 保存heartCount供结算用
    this._pendingHeartCount = (this._pendingHeartCount || 0) + heartCount
  }

  afterEliminate() {
    // 移除消除的宝珠，下落填充
    for (let j = 0; j < this.cols; j++) {
      const newCol = []
      for (let i = this.rows - 1; i >= 0; i--) {
        if (!this.beads[i][j]._eliminating) {
          newCol.unshift(this.beads[i][j])
        }
      }
      // 补充新宝珠
      while (newCol.length < this.rows) {
        let attr
        do {
          attr = BEAD_ATTRS[Math.floor(Math.random() * 6)]
        } while (newCol.length >= 2 && newCol[0].attr === attr && newCol[1].attr === attr)
        newCol.unshift({ attr, scale: 1.0, alpha: 1.0, offsetX: 0, offsetY: 0 })
      }
      for (let i = 0; i < this.rows; i++) {
        this.beads[i][j] = newCol[i]
      }
    }

    // 检查连锁消除
    const newGroups = this.checkEliminate()
    if (newGroups.length > 0) {
      setTimeout(() => this.executeEliminate(newGroups), 300)
    } else {
      // 连锁结束，进入结算
      this.settleBattle()
    }
  }

  // ===== 战斗结算 =====
  settleBattle() {
    this.battleState = 'settling'
    const heartCount = this._pendingHeartCount || 0
    this._pendingHeartCount = 0

    // 获取队长技能倍率
    const leaderRate = this.getLeaderSkillRate()

    // 统计消除的属性数量
    const attrCounts = {}
    this.eliminateGroups.forEach(group => {
      const attr = group.attr
      attrCounts[attr] = (attrCounts[attr] || 0) + group.cells.length
    })

    // 计算伤害
    let totalDamage = 0
    const comboRate = Math.pow(1.2, this.combo - 1)

    this.teamChars.forEach(ch => {
      if (!ch) return
      if (attrCounts[ch.attr]) {
        let dmg = ch.baseAtk * comboRate * leaderRate

        // 属性克制
        if (COUNTER_MAP[ch.attr] === this.currentLevelData.enemy.attr) {
          dmg *= 1.5
        }

        totalDamage += Math.floor(dmg)
      }
    })

    // 回血
    const totalHeal = heartCount * 1000

    // 应用伤害
    this.enemyHp = Math.max(0, this.enemyHp - totalDamage)

    // 应用回血
    this.teamHp = Math.min(this.teamMaxHp, this.teamHp + totalHeal)

    // 伤害飘字
    if (totalDamage > 0) {
      this.damageFloats.push({
        x: W / 2, y: safeTop + 60 * scale,
        text: `-${totalDamage}`,
        color: '#e74c3c',
        size: 24 * scale,
        life: 1.5
      })
      this.shakeTimer = 10
      this.shakeIntensity = 5 * scale
      music.playAttack()
    }

    if (totalHeal > 0) {
      this.damageFloats.push({
        x: W / 2, y: H * 0.35,
        text: `+${totalHeal}`,
        color: '#27ae60',
        size: 18 * scale,
        life: 1.5
      })
    }

    // 判定
    setTimeout(() => {
      if (this.enemyHp <= 0) {
        this.battleVictory()
      } else {
        this.enemyTurn()
      }
    }, 1000)
  }

  getLeaderSkillRate() {
    const leader = this.teamChars[0]
    if (!leader || !leader.leaderSkill) return 1.0
    return leader.leaderSkill.effectRate
  }

  // ===== 敌方回合 =====
  enemyTurn() {
    this.battleState = 'enemyTurn'
    this.turnCount++

    // 减少所有技能CD
    this.teamChars.forEach(ch => {
      if (ch && ch.activeSkill && ch._cd > 0) {
        ch._cd--
      }
    })

    const enemy = this.currentLevelData.enemy
    const shouldAttack = enemy.skill && (this.turnCount % enemy.skill.triggerTurn === 0)

    setTimeout(() => {
      if (shouldAttack) {
        // 敌方攻击
        const dmg = enemy.atk
        this.teamHp = Math.max(0, this.teamHp - dmg)

        this.damageFloats.push({
          x: W / 2, y: H * 0.30,
          text: `-${dmg}`,
          color: '#ff6b6b',
          size: 22 * scale,
          life: 1.5
        })
        this.shakeTimer = 15
        this.shakeIntensity = 8 * scale
        music.playAttack()

        setTimeout(() => {
          if (this.teamHp <= 0) {
            this.battleState = 'defeat'
          } else {
            this.startPlayerTurn()
          }
        }, 1000)
      } else {
        // 敌方不攻击
        this.startPlayerTurn()
      }
    }, 800)
  }

  startPlayerTurn() {
    this.battleState = 'playerTurn'
    this.combo = 0
    this._pendingHeartCount = 0
    this.eliminateGroups = []
  }

  battleVictory() {
    this.battleState = 'victory'
    this.storage.passLevel(this.currentLevelData.levelId, this.currentLevelData.reward)
  }

  // ===== 战斗初始化 =====
  startBattle(levelData) {
    this.currentLevelData = levelData
    this.scene = 'battle'

    // 加载队伍
    this.teamChars = this.getTeamChars()

    // 初始化HP
    this.enemyMaxHp = levelData.enemy.hp
    this.enemyHp = levelData.enemy.hp
    this.teamMaxHp = this.teamChars.reduce((sum, ch) => sum + (ch ? ch.baseHp : 0), 0)
    this.teamHp = this.teamMaxHp

    // 初始化技能CD
    this.teamChars.forEach(ch => {
      if (ch && ch.activeSkill) {
        ch._cd = ch.activeSkill.currentCd
      }
    })

    this.turnCount = 1
    this.combo = 0
    this.damageFloats = []
    this.particles = []
    this._pendingHeartCount = 0

    // 初始化棋盘
    this.initBoard()
    this.battleState = 'playerTurn'

    // 新手引导
    if (!this.storage.firstEnter) {
      this.showGuide = true
      this.guideStep = 0
    }
  }

  getTeamChars() {
    return this.storage.teamData.map(id => {
      if (!id) return null
      const ch = CHARACTERS.find(c => c.charId === id)
      if (!ch) return null
      return JSON.parse(JSON.stringify(ch))
    })
  }

  // ===== 主动技能 =====
  useSkill(charIndex) {
    const ch = this.teamChars[charIndex]
    if (!ch || !ch.activeSkill || ch._cd > 0) return
    if (this.battleState !== 'playerTurn') return

    const skill = ch.activeSkill
    if (skill.effectType === 'beadConvert') {
      // 宝珠转换
      for (let i = 0; i < this.rows; i++) {
        for (let j = 0; j < this.cols; j++) {
          if (this.beads[i][j].attr === skill.param.fromBead) {
            this.beads[i][j].attr = skill.param.toBead
          }
        }
      }
    }

    ch._cd = skill.cd
    music.playEliminate()

    // 技能使用后检查消除
    const groups = this.checkEliminate()
    if (groups.length > 0) {
      this.executeEliminate(groups)
    }
  }

  // ===== 触摸事件 =====
  bindTouch() {
    canvas.addEventListener('touchstart', (e) => {
      const touch = e.touches[0]
      const x = touch.clientX * (W / sysInfo.windowWidth)
      const y = touch.clientY * (W / sysInfo.windowWidth)
      this.handleTouch(x, y)
    })

    canvas.addEventListener('touchmove', (e) => {
      if (!this.isDragging || this.scene !== 'battle') return
      const touch = e.touches[0]
      const x = touch.clientX * (W / sysInfo.windowWidth)
      const y = touch.clientY * (W / sysInfo.windowWidth)
      this.handleTouchMove(x, y)
    })

    canvas.addEventListener('touchend', () => {
      if (this.isDragging && this.scene === 'battle') {
        this.handleTouchEnd()
      }
      this.isDragging = false
    })
  }

  handleTouch(x, y) {
    // 新手引导点击
    if (this.showGuide) {
      this.guideStep++
      if (this.guideStep >= 4) {
        this.showGuide = false
        this.storage.setFirstEnter()
      }
      return
    }

    switch (this.scene) {
      case 'home': this.handleHomeTouch(x, y); break
      case 'levelSelect': this.handleLevelSelectTouch(x, y); break
      case 'teamEdit': this.handleTeamEditTouch(x, y); break
      case 'battlePrepare': this.handleBattlePrepareTouch(x, y); break
      case 'battle': this.handleBattleTouch(x, y); break
    }
  }

  handleHomeTouch(x, y) {
    const btnW = W * 0.55
    const btnH = 48 * scale
    const btnX = (W - btnW) / 2
    const btnStartY = H * 0.50

    // 开始战斗
    if (this.inRect(x, y, btnX, btnStartY, btnW, btnH)) {
      const lv = LEVELS.find(l => l.levelId === this.storage.currentLevel) || LEVELS[0]
      this.currentLevelData = lv
      this.scene = 'battlePrepare'
      return
    }
    // 关卡选择
    if (this.inRect(x, y, btnX, btnStartY + 65 * scale, btnW, btnH)) {
      this.scene = 'levelSelect'
      return
    }
    // 编辑队伍
    if (this.inRect(x, y, btnX, btnStartY + 130 * scale, btnW, btnH)) {
      this.scene = 'teamEdit'
      return
    }
  }

  handleLevelSelectTouch(x, y) {
    const barH = safeTop + 44 * scale

    // 返回按钮
    if (this.inRect(x, y, 0, safeTop, 100 * scale, 44 * scale)) {
      this.scene = 'home'
      return
    }

    const startY = barH + 20 * scale
    const iconSize = W / 5
    const cols = 3
    const gapX = (W - cols * iconSize) / (cols + 1)
    const gapY = 20 * scale

    LEVELS.forEach((lv, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const cx = gapX + col * (iconSize + gapX) + iconSize / 2
      const cy = startY + row * (iconSize + gapY + 20 * scale) + iconSize / 2

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist <= iconSize / 2 && this.storage.isLevelUnlocked(lv.levelId)) {
        this.currentLevelData = lv
        this.scene = 'battlePrepare'
      }
    })
  }

  handleBattlePrepareTouch(x, y) {
    const barH = safeTop + 44 * scale

    // 返回按钮
    if (this.inRect(x, y, 0, safeTop, 100 * scale, 44 * scale)) {
      this.scene = 'levelSelect'
      return
    }

    const btnW = W * 0.4
    const btnH = 44 * scale
    const btnY = H * 0.78

    // 编辑队伍
    if (this.inRect(x, y, W / 2 - btnW - 10 * scale, btnY, btnW, btnH)) {
      this.scene = 'teamEdit'
      return
    }
    // 开始战斗
    if (this.inRect(x, y, W / 2 + 10 * scale, btnY, btnW, btnH)) {
      this.startBattle(this.currentLevelData)
      return
    }
  }

  handleTeamEditTouch(x, y) {
    const barH = safeTop + 44 * scale

    // 返回按钮
    if (this.inRect(x, y, 0, safeTop, 100 * scale, 44 * scale)) {
      this.scene = this.currentLevelData ? 'battlePrepare' : 'home'
      return
    }

    // 队伍槽位点击（移除角色）
    const slotY = barH + 40 * scale
    const slotR = 22 * scale
    for (let i = 0; i < 6; i++) {
      const sx = W / 2 + (i - 2.5) * (slotR * 2 + 12 * scale)
      if (Math.sqrt((x - sx) ** 2 + (y - slotY) ** 2) <= slotR) {
        if (this.storage.teamData[i]) {
          this.storage.teamData[i] = null
          this.storage.save()
        }
        return
      }
    }

    // 角色列表点击（添加到队伍）
    const listY = barH + 130 * scale
    const cardH = 60 * scale
    const cardW = W * 0.9
    const cardX = (W - cardW) / 2

    this.storage.unlockedChars.forEach((charId, i) => {
      const cy = listY + 16 * scale + i * (cardH + 8 * scale)
      if (this.inRect(x, y, cardX, cy, cardW, cardH)) {
        if (this.storage.teamData.includes(charId)) return
        const emptySlot = this.storage.teamData.indexOf(null)
        if (emptySlot !== -1) {
          this.storage.teamData[emptySlot] = charId
          this.storage.save()
        }
      }
    })

    // 确认按钮
    const btnW2 = W * 0.5
    const btnH2 = 44 * scale
    if (this.inRect(x, y, (W - btnW2) / 2, H - 70 * scale, btnW2, btnH2)) {
      this.scene = this.currentLevelData ? 'battlePrepare' : 'home'
    }
  }

  handleBattleTouch(x, y) {
    // 胜利弹窗
    if (this.battleState === 'victory') {
      const modalW = W * 0.8
      const modalH = 280 * scale
      const mx = (W - modalW) / 2
      const my = (H - modalH) / 2
      const btnW2 = modalW * 0.38
      const btnH2 = 40 * scale
      const btnY = my + modalH - 65 * scale

      // 返回关卡
      if (this.inRect(x, y, mx + 15 * scale, btnY, btnW2, btnH2)) {
        this.scene = 'levelSelect'
        return
      }
      // 下一关
      const nextLevel = LEVELS.find(l => l.levelId === this.currentLevelData.levelId + 1)
      if (nextLevel && this.inRect(x, y, mx + modalW - btnW2 - 15 * scale, btnY, btnW2, btnH2)) {
        this.currentLevelData = nextLevel
        this.startBattle(nextLevel)
        return
      }
      return
    }

    // 失败弹窗
    if (this.battleState === 'defeat') {
      const modalW = W * 0.8
      const modalH = 220 * scale
      const mx = (W - modalW) / 2
      const my = (H - modalH) / 2
      const btnW2 = modalW * 0.38
      const btnH2 = 40 * scale
      const btnY = my + modalH - 60 * scale

      // 返回关卡
      if (this.inRect(x, y, mx + 15 * scale, btnY, btnW2, btnH2)) {
        this.scene = 'levelSelect'
        return
      }
      // 重新挑战
      if (this.inRect(x, y, mx + modalW - btnW2 - 15 * scale, btnY, btnW2, btnH2)) {
        this.startBattle(this.currentLevelData)
        return
      }
      return
    }

    if (this.battleState !== 'playerTurn') return

    // 技能释放（点击角色头像）
    const midY = H * 0.18 + safeTop
    const charIconR = W / 16
    const charSpacing = W / (this.teamChars.length + 1)
    const charY = midY + 50 * scale

    for (let i = 0; i < this.teamChars.length; i++) {
      const ch = this.teamChars[i]
      if (!ch) continue
      const cx = charSpacing * (i + 1)
      if (Math.sqrt((x - cx) ** 2 + (y - charY) ** 2) <= charIconR) {
        this.useSkill(i)
        return
      }
    }

    // 转珠开始
    const ox = this.boardOffsetX
    const oy = this.boardOffsetY
    const bs = this.beadSize
    const col = Math.floor((x - ox) / bs)
    const row = Math.floor((y - oy) / bs)

    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
      this.isDragging = true
      this.selectedBead = { row, col }
      this.lastSwapTarget = null
      this.beads[row][col].scale = 1.1
    }
  }

  handleTouchMove(x, y) {
    if (!this.selectedBead || this.battleState !== 'playerTurn') return

    const ox = this.boardOffsetX
    const oy = this.boardOffsetY
    const bs = this.beadSize
    const col = Math.floor((x - ox) / bs)
    const row = Math.floor((y - oy) / bs)

    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return
    if (row === this.selectedBead.row && col === this.selectedBead.col) return

    // 仅相邻
    const dr = Math.abs(row - this.selectedBead.row)
    const dc = Math.abs(col - this.selectedBead.col)
    if (dr + dc !== 1) return

    // 交换
    const sr = this.selectedBead.row
    const sc = this.selectedBead.col
    const temp = this.beads[sr][sc]
    this.beads[sr][sc] = this.beads[row][col]
    this.beads[row][col] = temp

    this.lastSwapTarget = { row, col }
    this.selectedBead = { row, col }
  }

  handleTouchEnd() {
    if (!this.selectedBead) return
    if (this.battleState !== 'playerTurn') return

    // 恢复宝珠缩放
    if (this.selectedBead) {
      this.beads[this.selectedBead.row][this.selectedBead.col].scale = 1.0
    }

    // 检查消除
    const groups = this.checkEliminate()
    if (groups.length > 0) {
      this.executeEliminate(groups)
    } else if (this.lastSwapTarget) {
      // 无消除，恢复位置
      const sr = this.selectedBead.row
      const sc = this.selectedBead.col
      const tr = this.lastSwapTarget.row
      const tc = this.lastSwapTarget.col
      const temp = this.beads[sr][sc]
      this.beads[sr][sc] = this.beads[tr][tc]
      this.beads[tr][tc] = temp
    }

    this.selectedBead = null
    this.lastSwapTarget = null
  }

  inRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh
  }
}

module.exports = Main
