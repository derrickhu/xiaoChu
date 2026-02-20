/**
 * 战斗界面渲染：棋盘、队伍栏、怪物区、Combo、倒计时、胜利/失败覆盖
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL, ENEMY_SKILLS, REWARD_TYPES } = require('../data/tower')
const { getPetStarAtk, getPetAvatarPath, MAX_STAR } = require('../data/pets')

function rBattle(g) {
  const { ctx, R, TH, W, H, S, safeTop, COLS, ROWS } = V
  R.drawBattleBg(g.af)
  const padX = 8*S

  // 布局计算
  const boardPad = 6*S
  const cellSize = (W - boardPad*2) / COLS
  g.cellSize = cellSize; g.boardX = boardPad
  const boardH = ROWS * cellSize
  const bottomPad = 8*S
  const boardTop = H - bottomPad - boardH
  g.boardY = boardTop
  const sidePad = 8*S
  const petGap = 8*S
  const wpnGap = 12*S
  const totalGapW = wpnGap + petGap * 4 + sidePad * 2
  const iconSize = (W - totalGapW) / 6
  const teamBarH = iconSize + 6*S
  const hpBarH = 18*S
  const hpBarY = boardTop - hpBarH - 4*S
  const teamBarY = hpBarY - teamBarH - 2*S
  const eAreaTop = safeTop + 4*S
  const eAreaBottom = teamBarY - 4*S
  const exitBtnSize = 32*S
  const exitBtnX = 8*S
  const exitBtnY = eAreaTop

  // 怪物区
  if (g.enemy) {
    const eAreaH = eAreaBottom - eAreaTop
    const ac = ATTR_COLOR[g.enemy.attr]
    const themeBg = 'theme_' + (g.enemy.attr || 'metal')
    R.drawEnemyAreaBg(g.af, themeBg, eAreaTop, eAreaBottom, g.enemy.attr, g.enemy.battleBg)

    // --- 血条（加大样式） ---
    const eHpH = 14*S
    const hpY = eAreaBottom - 26*S
    const hpBarW = W * 0.72
    const hpBarX = (W - hpBarW) / 2
    // Boss/精英血条发光边框
    if (g.enemy.isBoss || g.enemy.isElite) {
      ctx.save()
      const hpGlowColor = ac ? ac.main : '#ff4040'
      ctx.shadowColor = hpGlowColor; ctx.shadowBlur = 10*S
      ctx.strokeStyle = hpGlowColor + '88'; ctx.lineWidth = 2*S
      R.rr(hpBarX - 2*S, hpY - 2*S, hpBarW + 4*S, eHpH + 4*S, (eHpH + 4*S)/2); ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }
    R.drawHp(hpBarX, hpY, hpBarW, eHpH, g.enemy.hp, g.enemy.maxHp, ac ? ac.main : TH.danger, g._enemyHpLoss, true)

    // --- 怪物图片（胜利状态且死亡动画结束后不再绘制） ---
    const avatarPath = g.enemy.avatar ? g.enemy.avatar + '.png' : null
    const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
    const imgBottom = hpY - 6*S  // 图片底部贴近血条上方
    let imgDrawY = eAreaTop  // 默认值
    const hideEnemy = g.bState === 'victory' && !g._enemyDeathAnim
    if (enemyImg && enemyImg.width > 0 && !hideEnemy) {
      const maxImgH = eAreaH * 0.58
      const maxImgW = W * 0.5
      const imgRatio = enemyImg.width / enemyImg.height
      let imgW = maxImgH * imgRatio, imgH = maxImgH
      if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / imgRatio }
      const imgX = (W - imgW) / 2
      imgDrawY = imgBottom - imgH

      // 敌人受击抖动+闪红+squash形变（使用离屏canvas避免source-atop透明底图问题）
      ctx.save()
      let hitOffX = 0, hitOffY = 0
      if (g._enemyHitFlash > 0) {
        const hitIntensity = g._enemyHitFlash / 12
        hitOffX = (Math.random() - 0.5) * 10 * S * hitIntensity
        hitOffY = (Math.random() - 0.5) * 6 * S * hitIntensity
        const squashP = Math.min(1, g._enemyHitFlash / 6)
        const scaleX = 1 - squashP * 0.08
        const scaleY = 1 + squashP * 0.06
        ctx.translate(imgX + imgW/2, imgDrawY + imgH)
        ctx.scale(scaleX, scaleY)
        ctx.translate(-(imgX + imgW/2), -(imgDrawY + imgH))
      }
      // 死亡爆裂时缩小+淡出
      if (g._enemyDeathAnim) {
        const dp = g._enemyDeathAnim.timer / g._enemyDeathAnim.duration
        const deathScale = 1 - dp * 0.5
        const deathAlpha = 1 - dp
        ctx.globalAlpha = Math.max(0, deathAlpha)
        ctx.translate(imgX + imgW/2, imgDrawY + imgH/2)
        ctx.scale(deathScale, deathScale)
        ctx.translate(-(imgX + imgW/2), -(imgDrawY + imgH/2))
      }
      // 受击闪白脉冲（不使用composite操作，避免透明底图边框问题）
      if (g._enemyHitFlash > 0) {
        const flashP = g._enemyHitFlash / 12
        // 透明度脉冲：快速闪烁2次
        const blinkAlpha = flashP > 0.5 ? (Math.sin(g._enemyHitFlash * 1.5) * 0.3 + 0.7) : 1
        ctx.globalAlpha = (ctx.globalAlpha || 1) * blinkAlpha
      }
      ctx.drawImage(enemyImg, imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
      // 受击时在图片上方叠一层同尺寸的敌人图片（lighter模式，产生泛白发光效果）
      if (g._enemyHitFlash > 0) {
        const glowAlpha = Math.min(0.5, g._enemyHitFlash / 12 * 0.5)
        ctx.globalAlpha = glowAlpha
        ctx.globalCompositeOperation = 'lighter'
        ctx.drawImage(enemyImg, imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }
      ctx.restore()

      // --- 敌人 debuff 视觉特效（替代图标显示） ---
      _drawEnemyDebuffVFX(g, imgX, imgDrawY, imgW, imgH, enemyImg)

      // 死亡特效：多层粒子+光柱+扩散环
      if (g._enemyDeathAnim) {
        const da = g._enemyDeathAnim
        const dp = da.timer / da.duration
        ctx.save()
        const centerX = imgX + imgW/2, centerY = imgDrawY + imgH/2
        const deathColor = ac ? ac.main : '#ff6040'

        // 光柱（从敌人位置向上冲天）
        if (dp < 0.6) {
          const pillarP = dp / 0.6
          const pillarW = 20*S * (1 - pillarP * 0.5)
          const pillarH = 200*S * pillarP
          ctx.globalAlpha = (1 - pillarP) * 0.6
          const pillarGrd = ctx.createLinearGradient(centerX, centerY, centerX, centerY - pillarH)
          pillarGrd.addColorStop(0, '#fff')
          pillarGrd.addColorStop(0.3, deathColor)
          pillarGrd.addColorStop(0.7, deathColor + '44')
          pillarGrd.addColorStop(1, 'transparent')
          ctx.fillStyle = pillarGrd
          ctx.fillRect(centerX - pillarW, centerY - pillarH, pillarW*2, pillarH)
        }

        // 多层扩散环
        for (let ring = 0; ring < 3; ring++) {
          const ringDelay = ring * 0.1
          const ringP = Math.max(0, dp - ringDelay) / (1 - ringDelay)
          if (ringP <= 0 || ringP > 1) continue
          const ringR = ringP * (60 + ring * 30) * S
          ctx.globalAlpha = (1 - ringP) * (0.6 - ring * 0.15)
          ctx.strokeStyle = ring === 0 ? '#fff' : deathColor
          ctx.lineWidth = (3 - ringP * 2 - ring * 0.5) * S
          ctx.beginPath(); ctx.arc(centerX, centerY, ringR, 0, Math.PI*2); ctx.stroke()
        }

        // 密集碎片粒子（外层大粒子+内层小粒子）
        const particleCount = 24
        for (let pi = 0; pi < particleCount; pi++) {
          const angle = (pi / particleCount) * Math.PI * 2 + da.timer * 0.08
          const speed = 20 + (pi % 5) * 15
          const dist = dp * speed * S
          const px = centerX + Math.cos(angle) * dist
          const py = centerY + Math.sin(angle) * dist
          const pAlpha = (1 - dp) * 0.85
          const pSize = (pi % 3 === 0 ? 3.5 : pi % 3 === 1 ? 2.5 : 1.5) * S * (1 - dp * 0.5)
          ctx.globalAlpha = pAlpha
          ctx.fillStyle = pi % 4 === 0 ? '#fff' : pi % 4 === 1 ? deathColor : pi % 4 === 2 ? '#ffd700' : deathColor + 'cc'
          ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI*2); ctx.fill()
        }

        // 核心闪光（前半段）
        if (dp < 0.3) {
          const flashR = 25*S * (1 + dp / 0.3)
          ctx.globalAlpha = (0.3 - dp) / 0.3 * 0.7
          ctx.globalCompositeOperation = 'lighter'
          const flashGrd = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, flashR)
          flashGrd.addColorStop(0, '#fff')
          flashGrd.addColorStop(0.5, deathColor)
          flashGrd.addColorStop(1, 'transparent')
          ctx.fillStyle = flashGrd
          ctx.beginPath(); ctx.arc(centerX, centerY, flashR, 0, Math.PI*2); ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
        }

        ctx.restore()
      }
    }

    // --- 怪物技能倒计时（名称上方，醒目位置） ---
    const hasSkillCd = g.enemy.skills && g.enemy.skills.length > 0 && g.enemySkillCd >= 0
    const skillCdBlockH = hasSkillCd ? 28*S : 0  // 倒计时占据的垂直空间

    // --- 怪物名（图片头顶，上移留出技能倒计时+抗性空间） ---
    const nameY = imgDrawY - 20*S - skillCdBlockH
    const nameFontSize = 14*S
    ctx.textAlign = 'center'
    ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4*S
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
    ctx.fillText(g.enemy.name, W*0.5, nameY)
    ctx.restore()

    // 绘制技能倒计时（名称和弱点/抵抗之间）
    if (hasSkillCd) {
      const cdNum = g.enemySkillCd
      const isUrgent = cdNum <= 1
      const skFontSize = 10*S
      ctx.font = `bold ${skFontSize}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const cdText = isUrgent ? '⚠ 下回合释放技能！' : `技能蓄力 ${cdNum} 回合`
      const cdTextW = ctx.measureText(cdText).width
      const cdTagW = cdTextW + 20*S
      const cdTagH = 20*S
      const cdTagX = (W - cdTagW) / 2
      const cdTagY = nameY + 6*S
      ctx.save()
      if (isUrgent) {
        const pulse = 0.7 + 0.3 * Math.sin(g.af * 0.12)
        ctx.globalAlpha = pulse
        ctx.fillStyle = 'rgba(200,40,40,0.8)'
      } else {
        ctx.globalAlpha = 0.75
        ctx.fillStyle = 'rgba(60,50,80,0.7)'
      }
      ctx.beginPath()
      R.rr(cdTagX, cdTagY, cdTagW, cdTagH, cdTagH / 2); ctx.fill()
      ctx.strokeStyle = isUrgent ? 'rgba(255,80,80,0.9)' : 'rgba(180,170,200,0.5)'
      ctx.lineWidth = 1*S
      R.rr(cdTagX, cdTagY, cdTagW, cdTagH, cdTagH / 2); ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = isUrgent ? '#ffcccc' : '#d0c8e0'
      ctx.fillText(cdText, W * 0.5, cdTagY + cdTagH / 2)
      ctx.restore()
      ctx.textBaseline = 'alphabetic'
    }

    // --- 弱点 & 抵抗（药丸标签化，Boss弱点呼吸脉冲） ---
    const weakAttr = COUNTER_BY[g.enemy.attr]
    const resistAttr = COUNTER_MAP[g.enemy.attr]
    const orbR = 7*S
    const infoFontSize = 11*S
    const infoY = nameY + (hasSkillCd ? skillCdBlockH + 8*S : 14*S)
    const tagH = 22*S, tagR = tagH/2
    ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
    const weakTagW = weakAttr ? ctx.measureText('弱点').width + orbR*2 + 16*S : 0
    const resistTagW = resistAttr ? ctx.measureText('抵抗').width + orbR*2 + 16*S : 0
    const infoGap = (weakAttr && resistAttr) ? 10*S : 0
    const totalInfoW = weakTagW + infoGap + resistTagW
    let curX = W*0.5 - totalInfoW/2
    // 弱点标签
    if (weakAttr) {
      const wac = ATTR_COLOR[weakAttr]
      const weakMain = wac ? wac.main : '#fff'
      const isBoss = g.enemy.isBoss || g.enemy.isElite
      // Boss/精英弱点呼吸脉冲
      const pulseAlpha = isBoss ? (0.75 + 0.25 * Math.sin(g.af * 0.08)) : 0.85
      const pulseScale = isBoss ? (1 + 0.03 * Math.sin(g.af * 0.08)) : 1
      ctx.save()
      if (isBoss) {
        ctx.translate(curX + weakTagW/2, infoY - tagH*0.5 + tagH/2)
        ctx.scale(pulseScale, pulseScale)
        ctx.translate(-(curX + weakTagW/2), -(infoY - tagH*0.5 + tagH/2))
      }
      ctx.globalAlpha = pulseAlpha
      // 药丸底色
      ctx.fillStyle = weakMain + '40'
      ctx.beginPath()
      R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.fill()
      ctx.strokeStyle = weakMain + '99'; ctx.lineWidth = 1.5*S
      R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.stroke()
      // Boss额外发光
      if (isBoss) {
        ctx.shadowColor = weakMain; ctx.shadowBlur = 8*S
        ctx.strokeStyle = weakMain + 'cc'; ctx.lineWidth = 1*S
        R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.stroke()
        ctx.shadowBlur = 0
      }
      // 文字 + 珠子
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff'; ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('弱点', curX + 6*S, infoY)
      const lw = ctx.measureText('弱点').width
      R.drawBead(curX + 6*S + lw + orbR + 3*S, infoY, orbR, weakAttr, g.af)
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
      curX += weakTagW + infoGap
    }
    // 抵抗标签
    if (resistAttr) {
      const rac = ATTR_COLOR[resistAttr]
      const resistMain = rac ? rac.main : '#888'
      ctx.save()
      ctx.globalAlpha = 0.65
      ctx.fillStyle = 'rgba(60,60,80,0.6)'
      ctx.beginPath()
      R.rr(curX, infoY - tagH*0.5, resistTagW, tagH, tagR); ctx.fill()
      ctx.strokeStyle = 'rgba(150,150,170,0.4)'; ctx.lineWidth = 1*S
      R.rr(curX, infoY - tagH*0.5, resistTagW, tagH, tagR); ctx.stroke()
      ctx.globalAlpha = 0.8
      ctx.fillStyle = '#aaa'; ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('抵抗', curX + 6*S, infoY)
      const lw2 = ctx.measureText('抵抗').width
      R.drawBead(curX + 6*S + lw2 + orbR + 3*S, infoY, orbR, resistAttr, g.af)
      ctx.textBaseline = 'alphabetic'
      ctx.restore()
    }

    // --- 层数标记（最顶部，使用标签框底图） ---
    ctx.textAlign = 'center'
    const evType = g.curEvent ? g.curEvent.type : 'battle'
    const floorLabelImg = R.getImg('assets/ui/floor_label_bg.png')
    const labelW = W * 0.45, labelH = labelW / 4
    const labelX = (W - labelW) / 2, labelY = eAreaTop + 2*S
    if (floorLabelImg && floorLabelImg.width > 0) {
      ctx.drawImage(floorLabelImg, labelX, labelY, labelW, labelH)
    }
    const labelCY = labelY + labelH * 0.52
    if (evType === 'boss') {
      const floorText = `第 ${g.floor} 层`
      const bossTag = '⚠ BOSS ⚠'
      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
      ctx.fillText(floorText, W*0.5, labelCY - 2*S)
      ctx.restore()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      ctx.fillText(bossTag, W*0.5, labelCY + 9*S)
    } else if (evType === 'elite') {
      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
      ctx.fillText(`第 ${g.floor} 层`, W*0.5, labelCY - 2*S)
      ctx.restore()
      ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      ctx.fillText('★ 精英战斗', W*0.5, labelCY + 9*S)
    } else {
      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
      ctx.fillText(`第 ${g.floor} 层`, W*0.5, labelCY)
      ctx.restore()
    }

    // 敌方Buff — 已改为怪物身上的视觉特效显示，不再使用图标
    g._enemyAreaRect = [0, eAreaTop, W, eAreaBottom - eAreaTop]
  }

  // 己方buffs
  drawBuffIconsLabeled(g.heroBuffs, W*0.3, teamBarY - 16*S, '己方', false)
  // 左侧全局增益图标列（已移至战斗准备页面显示）
  // drawRunBuffIcons(g, eAreaTop + 42*S, eAreaBottom - 54*S)

  // 退出按钮
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
  R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✕', exitBtnX + exitBtnSize*0.5, exitBtnY + exitBtnSize*0.5)
  ctx.textBaseline = 'alphabetic'
  g._exitBtnRect = [exitBtnX, exitBtnY, exitBtnSize, exitBtnSize]

  // [DEV] 调试按钮已移除
  g._devKillRect = null

  // 队伍栏
  drawTeamBar(g, teamBarY, teamBarH, iconSize)
  // 英雄血条
  R.drawHp(padX, hpBarY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', g._heroHpLoss, true, '#4dcc4d', g.heroShield, g._heroHpGain, g.af)
  // 怒气进度条（右侧竖条，怪物区内）
  _drawRageBar(g, eAreaTop, eAreaBottom)
  // 棋盘
  drawBoard(g)
  // 消除飘字
  g.elimFloats.forEach(f => R.drawElimFloat(f))

  // Combo显示
  _drawCombo(g, cellSize, boardTop)

  // 技能快闪
  if (g._skillFlash) _drawSkillFlash(g)

  // 宠物攻击技能光波特效
  if (g._petSkillWave) _drawPetSkillWave(g)

  // 宠物头像攻击数值翻滚
  g.petAtkNums.forEach(f => R.drawPetAtkNum(f))

  // 拖拽倒计时
  if (g.dragging && g.bState === 'playerTurn') {
    _drawDragTimer(g, cellSize, boardTop)
  }

  // 敌方回合过渡横条
  if (g._pendingEnemyAtk && g.bState === 'playerTurn') {
    _drawEnemyTurnBanner(g)
  }

  // 胜利/失败覆盖
  if (g.bState === 'victory') drawVictoryOverlay(g)
  if (g.bState === 'defeat') drawDefeatOverlay(g)
  if (g.bState === 'adReviveOffer') drawAdReviveOverlay(g)
  // 弹窗层
  if (g.showEnemyDetail) g._drawEnemyDetailDialog()
  if (g.showExitDialog) g._drawExitDialog()
  if (g.showWeaponDetail) g._drawWeaponDetailDialog()
  if (g.showBattlePetDetail != null) g._drawBattlePetDetailDialog()
  if (g.skillPreview) _drawSkillPreviewPopup(g)
  if (g.runBuffDetail) g._drawRunBuffDetailDialog()
}

// ===== 宠物攻击技能光波特效 =====
function _drawPetSkillWave(g) {
  const { ctx, R, TH, W, H, S } = V
  const wave = g._petSkillWave
  if (!wave) return
  wave.timer++
  if (wave.timer > wave.duration) { g._petSkillWave = null; return }

  const t = wave.timer
  const dur = wave.duration
  const p = t / dur  // 0→1 进度
  const clr = wave.color || TH.accent

  // 计算宠物头像位置（光波起点）
  const L = g._getBattleLayout()
  const iconSize = L.iconSize
  const iconY = L.teamBarY + (L.teamBarH - iconSize) / 2
  const sidePad = 8*S, wpnGap = 12*S, petGap = 8*S
  let ix
  if (wave.petIdx === 0) { ix = sidePad }
  else { ix = sidePad + iconSize + wpnGap + (wave.petIdx - 1) * (iconSize + petGap) }
  const startX = ix + iconSize * 0.5
  const startY = iconY
  const targetX = wave.targetX
  const targetY = wave.targetY

  // 安全检查：坐标值必须是有限数值，否则 createRadialGradient 会抛异常导致渲染循环中断
  if (!isFinite(startX) || !isFinite(startY) || !isFinite(targetX) || !isFinite(targetY) || !isFinite(iconSize)) {
    g._petSkillWave = null; return
  }

  ctx.save()

  // 阶段1（0-0.15）：宠物头像蓄力光环
  if (p < 0.15) {
    const chargeP = p / 0.15
    const chargeR = iconSize * 0.4 * chargeP
    if (chargeR > 0) {
      ctx.globalAlpha = 0.6 + chargeP * 0.4
      const chargeGrd = ctx.createRadialGradient(startX, startY, 0, startX, startY, chargeR)
      chargeGrd.addColorStop(0, '#fff')
      chargeGrd.addColorStop(0.5, clr)
      chargeGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = chargeGrd
      ctx.beginPath(); ctx.arc(startX, startY, chargeR, 0, Math.PI*2); ctx.fill()
    }
  }

  // 阶段2（0.1-0.6）：光波从宠物飞向敌人
  if (p >= 0.1 && p < 0.6) {
    const flyP = (p - 0.1) / 0.5  // 0→1
    const easedP = 1 - Math.pow(1 - flyP, 2)  // ease-out
    const curX = startX + (targetX - startX) * easedP
    const curY = startY + (targetY - startY) * easedP
    const waveR = 18*S + flyP * 12*S

    // 光波主体
    ctx.globalAlpha = 0.9 - flyP * 0.3
    const waveGrd = ctx.createRadialGradient(curX, curY, 0, curX, curY, waveR)
    waveGrd.addColorStop(0, '#fff')
    waveGrd.addColorStop(0.3, clr)
    waveGrd.addColorStop(0.7, clr + '88')
    waveGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = waveGrd
    ctx.beginPath(); ctx.arc(curX, curY, waveR, 0, Math.PI*2); ctx.fill()

    // 光波拖尾
    ctx.globalAlpha = 0.4 * (1 - flyP)
    const tailLen = 40*S
    const tailAngle = Math.atan2(targetY - startY, targetX - startX)
    const tailX = curX - Math.cos(tailAngle) * tailLen * flyP
    const tailY = curY - Math.sin(tailAngle) * tailLen * flyP
    const tailGrd = ctx.createLinearGradient(tailX, tailY, curX, curY)
    tailGrd.addColorStop(0, 'transparent')
    tailGrd.addColorStop(0.5, clr + '44')
    tailGrd.addColorStop(1, clr + 'aa')
    ctx.strokeStyle = tailGrd
    ctx.lineWidth = 6*S
    ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(curX, curY); ctx.stroke()

    // 光波碎片
    for (let i = 0; i < 4; i++) {
      const angle = Math.PI*2 / 4 * i + flyP * 3
      const dist = waveR * 0.6
      const px = curX + Math.cos(angle) * dist
      const py = curY + Math.sin(angle) * dist
      ctx.globalAlpha = 0.5 * (1 - flyP)
      ctx.fillStyle = i % 2 === 0 ? '#fff' : clr
      ctx.beginPath(); ctx.arc(px, py, 3*S, 0, Math.PI*2); ctx.fill()
    }
  }

  // 阶段3（0.5-1.0）：命中 — 密集碎片+速度线+闪光（非大爆炸）
  if (p >= 0.5) {
    const hitP = (p - 0.5) / 0.5  // 0→1

    // 紧凑闪光核心（半径小，衰减快）
    if (hitP < 0.3) {
      const coreR = 15*S + hitP / 0.3 * 20*S
      ctx.globalAlpha = (0.3 - hitP) / 0.3 * 0.8
      const coreGrd = ctx.createRadialGradient(targetX, targetY, 0, targetX, targetY, coreR)
      coreGrd.addColorStop(0, '#fff')
      coreGrd.addColorStop(0.5, clr)
      coreGrd.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGrd
      ctx.beginPath(); ctx.arc(targetX, targetY, coreR, 0, Math.PI*2); ctx.fill()
    }

    // 速度线（从命中点向外放射的短线）
    if (hitP < 0.6) {
      const lineP = hitP / 0.6
      ctx.save()
      ctx.globalAlpha = (1 - lineP) * 0.7
      ctx.strokeStyle = clr; ctx.lineWidth = 2*S
      ctx.shadowColor = clr; ctx.shadowBlur = 6*S
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + wave.timer * 0.05
        const innerR = 10*S + lineP * 25*S
        const outerR = innerR + (8 + Math.random() * 12) * S * (1 - lineP)
        ctx.beginPath()
        ctx.moveTo(targetX + Math.cos(angle) * innerR, targetY + Math.sin(angle) * innerR)
        ctx.lineTo(targetX + Math.cos(angle) * outerR, targetY + Math.sin(angle) * outerR)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
      ctx.restore()
    }

    // 密集碎片粒子（小而多，快速扩散）
    ctx.save()
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + hitP * 2
      const speed = 15 + (i % 3) * 8
      const dist = hitP * speed * S
      const px = targetX + Math.cos(angle) * dist
      const py = targetY + Math.sin(angle) * dist
      const pr = (1 - hitP) * (1.5 + (i % 4) * 0.5) * S
      ctx.globalAlpha = (1 - hitP * hitP) * 0.7
      ctx.fillStyle = i % 3 === 0 ? '#fff' : i % 3 === 1 ? clr : clr + 'cc'
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI*2); ctx.fill()
    }
    ctx.restore()

    // 薄冲击环（比原来小很多，仅一个快速扩散环）
    if (hitP < 0.4) {
      const ringR = 12*S + hitP / 0.4 * 35*S
      ctx.globalAlpha = (0.4 - hitP) / 0.4 * 0.5
      ctx.strokeStyle = clr; ctx.lineWidth = (2 - hitP * 4) * S
      ctx.beginPath(); ctx.arc(targetX, targetY, ringR, 0, Math.PI*2); ctx.stroke()
    }
  }

  ctx.restore()
}

// ===== 技能快闪（替代横幅，0.33秒即时反馈） =====
function _drawSkillFlash(g) {
  const { ctx, R, TH, W, H, S } = V
  const f = g._skillFlash
  if (!f) return
  f.timer++
  if (f.timer > f.duration) { g._skillFlash = null; return }

  const t = f.timer
  const dur = f.duration
  const p = t / dur  // 0→1 进度

  ctx.save()

  // 全屏属性色闪光（快速衰减）
  if (t <= 6) {
    const flashAlpha = (1 - t / 6) * 0.3
    const flashGrd = ctx.createRadialGradient(W*0.5, H*0.38, 0, W*0.5, H*0.38, W*0.6)
    flashGrd.addColorStop(0, f.color)
    flashGrd.addColorStop(0.5, f.color + '44')
    flashGrd.addColorStop(1, 'transparent')
    ctx.globalAlpha = flashAlpha
    ctx.fillStyle = flashGrd
    ctx.fillRect(0, 0, W, H)
  }

  // 整体弹入缩放
  const mainScale = t <= 6
    ? 2.0 - (t / 6) * 1.0  // 2.0→1.0 放大弹入
    : t <= 12
      ? 1.0 + Math.sin((t - 6) / 6 * Math.PI) * 0.05  // 微微呼吸
      : 1.0 - (t - 12) / (dur - 12) * 0.3  // 缩小消失
  const mainAlpha = t <= 12 ? 1 : 1 - (t - 12) / (dur - 12)

  const hasDesc = !!f.skillDesc
  // 有描述时：技能名在上方做小标签，描述居中做主体；无描述时技能名做主体
  const centerY = hasDesc ? H * 0.36 : H * 0.36

  ctx.globalAlpha = mainAlpha
  ctx.translate(W*0.5, centerY)
  ctx.scale(mainScale, mainScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'

  if (hasDesc) {
    // --- 技能名（弱化：小字号、半透明、属性色，在描述上方） ---
    ctx.save()
    ctx.globalAlpha = mainAlpha * 0.6
    ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2*S
    ctx.strokeText(f.skillName, 0, -20*S)
    ctx.fillStyle = f.color
    ctx.fillText(f.skillName, 0, -20*S)
    ctx.shadowBlur = 0
    ctx.restore()

    // --- 技能描述（主体：大字号、高亮、发光） ---
    ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
    ctx.shadowColor = f.color; ctx.shadowBlur = 16*S
    ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4*S
    ctx.strokeText(f.skillDesc, 0, 6*S)
    ctx.fillStyle = '#fff'
    ctx.fillText(f.skillDesc, 0, 6*S)
    ctx.shadowBlur = 0
  } else {
    // --- 无描述：技能名做主体（攻击技能等） ---
    ctx.font = `italic 900 ${24*S}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
    ctx.shadowColor = f.color; ctx.shadowBlur = 20*S
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 4*S
    ctx.strokeText(f.skillName, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillText(f.skillName, 0, 0)
    ctx.shadowBlur = 0
  }

  // 属性色光环扩散
  if (t <= 10) {
    const ringR = 30*S + (t / 10) * 80*S
    const ringAlpha = (1 - t / 10) * 0.6
    ctx.globalAlpha = ringAlpha
    ctx.beginPath()
    ctx.arc(0, 0, ringR, 0, Math.PI*2)
    ctx.strokeStyle = f.color
    ctx.lineWidth = (4 - t / 10 * 3) * S
    ctx.stroke()
  }

  ctx.restore()
}

// ===== 技能预览弹窗（长按宠物显示） =====
function _drawSkillPreviewPopup(g) {
  const { ctx, R, TH, W, H, S } = V
  const sp = g.skillPreview
  if (!sp) return
  const pet = sp.pet
  const sk = pet.skill
  if (!sk) return

  const popW = W * 0.6, popH = 80*S
  const popX = Math.max(4*S, Math.min(W - popW - 4*S, sp.x - popW/2))
  const popY = sp.y

  // 入场动画
  const fadeIn = Math.min(1, sp.timer / 8)
  const scale = 0.8 + 0.2 * fadeIn

  ctx.save()
  ctx.globalAlpha = fadeIn
  ctx.translate(popX + popW/2, popY)
  ctx.scale(scale, scale)
  ctx.translate(-(popX + popW/2), -popY)

  // 背景
  ctx.fillStyle = 'rgba(16,16,32,0.95)'
  R.rr(popX, popY, popW, popH, 10*S); ctx.fill()
  // 属性色上边条
  const attrColor = ATTR_COLOR[pet.attr]?.main || TH.accent
  ctx.fillStyle = attrColor
  ctx.save()
  ctx.beginPath(); R.rr(popX, popY, popW, 4*S, 10*S); ctx.clip()
  ctx.fillRect(popX, popY, popW, 4*S)
  ctx.restore()
  // 边框
  ctx.strokeStyle = attrColor + '88'; ctx.lineWidth = 1.5*S
  R.rr(popX, popY, popW, popH, 10*S); ctx.stroke()

  // 宠物名 + 技能名
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillStyle = attrColor; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(pet.name, popX + 10*S, popY + 20*S)
  ctx.fillStyle = '#fff'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText(sk.name, popX + 10*S, popY + 40*S)
  // 技能描述
  ctx.fillStyle = '#bbb'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(sk.desc || '无描述', popX + 10*S, popY + 58*S)
  // CD
  ctx.textAlign = 'right'
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(`CD: ${pet.cd}回合`, popX + popW - 10*S, popY + 20*S)

  // 三角箭头指向头像
  ctx.fillStyle = 'rgba(16,16,32,0.95)'
  const triX = Math.max(popX + 15*S, Math.min(popX + popW - 15*S, sp.x))
  ctx.beginPath()
  ctx.moveTo(triX - 8*S, popY)
  ctx.lineTo(triX, popY - 8*S)
  ctx.lineTo(triX + 8*S, popY)
  ctx.fill()

  ctx.restore()
}

// ===== 怒气进度条（右侧精致短竖条） =====
function _drawRageBar(g, eAreaTop, eAreaBottom) {
  const { ctx, R, W, H, S } = V
  const rage = g.rage || 0
  const maxRage = 100
  const pct = Math.min(1, rage / maxRage)
  const ready = !!g._rageReady

  // 尺寸：短条，居中放在怪物区右侧中段
  const barW = 7 * S
  const barH = 80 * S                   // 固定短高度
  const barPad = 8 * S
  const barX = W - barW - barPad
  const midY = (eAreaTop + eAreaBottom) / 2
  const barTopY = midY - barH / 2
  const barBotY = midY + barH / 2
  if (barH <= 0) return

  ctx.save()

  // ---- 顶部圆形图标（替代"怒"字，用火焰符号风格化） ----
  const iconR = 10 * S
  const iconCX = barX + barW / 2
  const iconCY = barTopY - iconR - 3 * S
  // 图标底圆
  const iconBgAlpha = ready ? 0.9 : (pct > 0 ? 0.6 : 0.3)
  ctx.globalAlpha = iconBgAlpha
  const iconGrd = ctx.createRadialGradient(iconCX, iconCY, 0, iconCX, iconCY, iconR)
  if (ready) {
    iconGrd.addColorStop(0, '#ff4040')
    iconGrd.addColorStop(1, '#8B1A1A')
  } else if (pct > 0) {
    iconGrd.addColorStop(0, '#cc3520')
    iconGrd.addColorStop(1, '#4a1008')
  } else {
    iconGrd.addColorStop(0, 'rgba(80,40,30,0.8)')
    iconGrd.addColorStop(1, 'rgba(30,15,10,0.6)')
  }
  ctx.fillStyle = iconGrd
  ctx.beginPath(); ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2); ctx.fill()
  ctx.globalAlpha = 1
  // 图标边框
  ctx.strokeStyle = ready ? 'rgba(255,80,60,0.8)' : 'rgba(255,255,255,0.15)'
  ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.arc(iconCX, iconCY, iconR, 0, Math.PI * 2); ctx.stroke()
  // 满怒气图标发光
  if (ready) {
    ctx.save()
    const glowA = 0.4 + 0.4 * Math.sin(g.af * 0.12)
    ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 10 * S
    ctx.globalAlpha = glowA
    ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 2 * S
    ctx.beginPath(); ctx.arc(iconCX, iconCY, iconR + 1 * S, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
  }
  // 图标内火焰符号 🔥 用绘制代替文字，画一个简笔火焰
  ctx.save()
  ctx.translate(iconCX, iconCY)
  const fS = iconR * 0.55  // 火焰缩放
  ctx.beginPath()
  ctx.moveTo(0, -fS * 1.1)
  ctx.bezierCurveTo(fS * 0.5, -fS * 0.5, fS * 0.7, fS * 0.2, fS * 0.35, fS * 0.8)
  ctx.quadraticCurveTo(fS * 0.15, fS * 0.4, 0, fS * 0.1)
  ctx.quadraticCurveTo(-fS * 0.15, fS * 0.4, -fS * 0.35, fS * 0.8)
  ctx.bezierCurveTo(-fS * 0.7, fS * 0.2, -fS * 0.5, -fS * 0.5, 0, -fS * 1.1)
  ctx.closePath()
  const flameGrd = ctx.createLinearGradient(0, -fS, 0, fS * 0.8)
  if (ready) {
    flameGrd.addColorStop(0, '#ffdd44')
    flameGrd.addColorStop(0.5, '#ff6030')
    flameGrd.addColorStop(1, '#cc2010')
  } else if (pct > 0) {
    flameGrd.addColorStop(0, '#ff9966')
    flameGrd.addColorStop(0.5, '#cc4422')
    flameGrd.addColorStop(1, '#661510')
  } else {
    flameGrd.addColorStop(0, 'rgba(160,100,80,0.6)')
    flameGrd.addColorStop(1, 'rgba(80,40,30,0.4)')
  }
  ctx.fillStyle = flameGrd; ctx.fill()
  ctx.restore()

  // ---- 底槽（暗色圆角条 + 精致边框） ----
  // 外层阴影
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4 * S
  ctx.fillStyle = 'rgba(10,5,5,0.6)'
  R.rr(barX, barTopY, barW, barH, barW / 2); ctx.fill()
  ctx.restore()
  // 内槽
  ctx.fillStyle = 'rgba(20,10,8,0.7)'
  R.rr(barX, barTopY, barW, barH, barW / 2); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.5 * S
  R.rr(barX, barTopY, barW, barH, barW / 2); ctx.stroke()

  // ---- 填充条（从底向上） ----
  if (pct > 0) {
    const fillH = barH * pct
    const fillY = barTopY + barH - fillH

    ctx.save()
    ctx.beginPath()
    R.rr(barX, barTopY, barW, barH, barW / 2); ctx.clip()

    // 渐变色
    const grd = ctx.createLinearGradient(0, barBotY, 0, barTopY)
    grd.addColorStop(0, '#6B1800')
    grd.addColorStop(0.3, '#cc3300')
    grd.addColorStop(0.6, '#ff4500')
    grd.addColorStop(0.85, '#ff6030')
    grd.addColorStop(1.0, '#ffaa44')
    ctx.fillStyle = grd
    ctx.fillRect(barX, fillY, barW, fillH)

    // 满怒气脉冲
    if (ready) {
      const pulseAlpha = 0.35 + 0.35 * Math.sin(g.af * 0.15)
      ctx.globalAlpha = pulseAlpha
      ctx.fillStyle = '#ff4040'
      ctx.fillRect(barX, fillY, barW, fillH)
      ctx.globalAlpha = 1
    }

    // 高光
    if (fillH > 4 * S) {
      const hlH = Math.min(6 * S, fillH * 0.3)
      const hlGrd = ctx.createLinearGradient(0, fillY, 0, fillY + hlH)
      hlGrd.addColorStop(0, 'rgba(255,255,255,0.45)')
      hlGrd.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = hlGrd
      ctx.fillRect(barX + 1 * S, fillY, barW - 2 * S, hlH)
    }

    ctx.restore()
  }

  // ---- 满怒气外发光 ----
  if (ready) {
    ctx.save()
    const glowAlpha = 0.25 + 0.25 * Math.sin(g.af * 0.15)
    ctx.shadowColor = '#ff2020'; ctx.shadowBlur = 6 * S
    ctx.globalAlpha = glowAlpha
    ctx.strokeStyle = '#ff4040'; ctx.lineWidth = 1.5 * S
    R.rr(barX - 1 * S, barTopY - 1 * S, barW + 2 * S, barH + 2 * S, barW / 2 + 1 * S); ctx.stroke()
    ctx.restore()
  }

  // ---- 底部百分比数字 ----
  if (rage > 0) {
    ctx.fillStyle = ready ? '#ffd700' : 'rgba(255,200,180,0.5)'
    ctx.font = `bold ${6 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    ctx.fillText(`${Math.round(rage)}`, barX + barW / 2, barBotY + 3 * S)
  }

  ctx.restore()
}

function _drawCombo(g, cellSize, boardTop) {
  const { ctx, R, TH, W, H, S, COLS, ROWS } = V
  if (g.combo < 2 || !(g.bState === 'elimAnim' || g.bState === 'dropping' || g.bState === 'preAttack' || g.bState === 'petAtkShow')) return

  const ca = g._comboAnim || { num: g.combo, scale: 1, alpha: 1, offsetY: 0, dmgScale: 1, dmgAlpha: 1, pctScale: 1, pctAlpha: 1, pctOffX: 0 }
  const comboScale = ca.scale || 1
  // 动画端已保证战斗中 alpha=1，这里直接取值
  const comboAlpha = ca.alpha != null ? Math.max(ca.alpha, 0) : 1
  const comboOffY = ca.offsetY || 0
  const dmgScale = ca.dmgScale || 0
  const dmgAlpha = ca.dmgAlpha || 0
  const pctScale = ca.pctScale || 0
  const pctAlpha = ca.pctAlpha || 0
  const pctOffX = ca.pctOffX || 0

  const comboCx = W * 0.5
  const isLow = g.combo < 4
  const comboCy = isLow
    ? g.boardY + (ROWS * g.cellSize) * 0.12 + comboOffY  // 低combo上移到棋盘顶部
    : g.boardY + (ROWS * g.cellSize) * 0.32 + comboOffY
  const isHigh = g.combo >= 5
  const isSuper = g.combo >= 8
  const isMega = g.combo >= 12
  const mainColor = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : isHigh ? '#ff8c00' : '#ffd700'
  const glowColor = isMega ? '#ff4060' : isSuper ? '#ff6080' : isHigh ? '#ffaa33' : '#ffe066'
  const baseSz = isMega ? 52*S : isSuper ? 44*S : isHigh ? 38*S : isLow ? 22*S : 32*S
  // 低combo弱化透明度
  const lowAlphaMul = isLow ? 0.5 : 1.0

  // 预算伤害数据
  const comboMulVal = 1 + (g.combo - 1) * 0.35
  const comboBonusPct = g.runBuffs.comboDmgPct || 0
  const totalMul = comboMulVal * (1 + comboBonusPct / 100)
  const extraPct = Math.round((totalMul - 1) * 100)
  let estTotalDmg = 0
  const pdm = g._pendingDmgMap || {}
  for (const attr in pdm) {
    let d = pdm[attr] * totalMul
    d *= 1 + (g.runBuffs.allDmgPct || 0) / 100
    d *= 1 + ((g.runBuffs.attrDmgPct && g.runBuffs.attrDmgPct[attr]) || 0) / 100
    if (g.weapon && g.weapon.type === 'attrDmgUp' && g.weapon.attr === attr) d *= 1 + g.weapon.pct / 100
    if (g.weapon && g.weapon.type === 'allAtkUp') d *= 1 + g.weapon.pct / 100
    if (g.enemy) {
      if (COUNTER_MAP[attr] === g.enemy.attr) d *= COUNTER_MUL
      else if (COUNTER_BY[attr] === g.enemy.attr) d *= COUNTERED_MUL
    }
    estTotalDmg += d
  }
  estTotalDmg = Math.round(estTotalDmg)

  ctx.save()
  ctx.globalAlpha = comboAlpha * lowAlphaMul

  // 低combo跳过背景遮罩和爆炸特效
  if (!isLow) {
  // 半透明背景遮罩
  const maskH = baseSz * 2.8
  const maskCy = comboCy + baseSz * 0.35
  const maskGrd = ctx.createLinearGradient(0, maskCy - maskH*0.5, 0, maskCy + maskH*0.5)
  maskGrd.addColorStop(0, 'transparent')
  maskGrd.addColorStop(0.15, 'rgba(0,0,0,0.4)')
  maskGrd.addColorStop(0.5, 'rgba(0,0,0,0.55)')
  maskGrd.addColorStop(0.85, 'rgba(0,0,0,0.4)')
  maskGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = maskGrd
  ctx.fillRect(0, maskCy - maskH*0.5, W, maskH)

  // 背景光晕爆炸
  if (g.combo >= 3) {
    const burstR = baseSz * (isSuper ? 2.2 : 1.5) * (ca.timer < 10 ? (2.0 - ca.timer / 10) : 1.0)
    const burstGrd = ctx.createRadialGradient(comboCx, comboCy, 0, comboCx, comboCy, burstR)
    burstGrd.addColorStop(0, glowColor + (isSuper ? '66' : '44'))
    burstGrd.addColorStop(0.5, glowColor + '18')
    burstGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = burstGrd
    ctx.fillRect(comboCx - burstR, comboCy - burstR, burstR*2, burstR*2)
  }

  // 放射线条
  if (isSuper && ca.timer < 20) {
    ctx.save()
    ctx.translate(comboCx, comboCy)
    const rayCount = isMega ? 18 : 12
    const rayLen = baseSz * 2.0 * Math.min(1, ca.timer / 8)
    const rayAlpha = Math.max(0, 1 - ca.timer / 20) * 0.7
    ctx.globalAlpha = comboAlpha * rayAlpha
    for (let r = 0; r < rayCount; r++) {
      const angle = (r / rayCount) * Math.PI * 2 + ca.timer * 0.08
      ctx.beginPath()
      ctx.moveTo(Math.cos(angle) * baseSz * 0.25, Math.sin(angle) * baseSz * 0.25)
      ctx.lineTo(Math.cos(angle) * rayLen, Math.sin(angle) * rayLen)
      ctx.strokeStyle = glowColor
      ctx.lineWidth = (isMega ? 4 : 2.5) * S
      ctx.stroke()
    }
    ctx.restore()
  }

  // 层级突破扩散环
  if ((g.combo === 5 || g.combo === 8 || g.combo === 12) && ca.timer < 18) {
    ctx.save()
    const ringP = ca.timer / 18
    const ringR = baseSz * (0.5 + ringP * 3.5)
    const ringAlpha = (1 - ringP) * 0.8
    ctx.globalAlpha = comboAlpha * ringAlpha
    ctx.beginPath()
    ctx.arc(comboCx, comboCy, ringR, 0, Math.PI * 2)
    ctx.strokeStyle = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : '#ffd700'
    ctx.lineWidth = (6 - ringP * 4) * S
    ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = 15 * S
    ctx.stroke()
    if (ca.timer > 3) {
      const ringP2 = (ca.timer - 3) / 18
      const ringR2 = baseSz * (0.3 + ringP2 * 3)
      ctx.globalAlpha = comboAlpha * (1 - ringP2) * 0.5
      ctx.beginPath()
      ctx.arc(comboCx, comboCy, ringR2, 0, Math.PI * 2)
      ctx.lineWidth = (4 - ringP2 * 3) * S
      ctx.stroke()
    }
    ctx.shadowBlur = 0
    ctx.restore()
  }

  } // end if (!isLow)

  // 第一行："N 连击"
  ctx.save()
  ctx.translate(comboCx, comboCy)
  ctx.scale(comboScale, comboScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const comboFont = `italic 900 ${baseSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
  const comboText = `${g.combo} 连击`
  ctx.font = comboFont
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 5*S
  ctx.strokeText(comboText, 0, 0)
  ctx.fillStyle = mainColor
  ctx.fillText(comboText, 0, 0)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-baseSz*2, -baseSz*0.5)
  ctx.lineTo(baseSz*1.5, -baseSz*0.5)
  ctx.lineTo(baseSz*1.2, baseSz*0.05)
  ctx.lineTo(-baseSz*2.3, baseSz*0.05)
  ctx.clip()
  ctx.fillStyle = glowColor
  ctx.globalAlpha = 0.55
  ctx.fillText(comboText, 0, 0)
  ctx.restore()
  if (isHigh) {
    ctx.font = comboFont
    ctx.shadowColor = mainColor
    ctx.shadowBlur = (isMega ? 30 : isSuper ? 20 : 12) * S
    ctx.fillStyle = mainColor
    ctx.globalAlpha = 0.3
    ctx.fillText(comboText, 0, 0)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }
  if (isSuper) {
    ctx.save()
    const flameTime = ca.timer * 0.15
    const flameW = isMega ? 5 : 3.5
    for (let fl = 0; fl < (isMega ? 3 : 2); fl++) {
      const flOff = fl * 0.7
      ctx.font = comboFont
      ctx.strokeStyle = isMega
        ? `rgba(255,${80 + Math.sin(flameTime + flOff) * 40},${20 + Math.sin(flameTime * 1.3 + flOff) * 20},${0.25 - fl * 0.08})`
        : `rgba(255,${120 + Math.sin(flameTime + flOff) * 40},${60 + Math.sin(flameTime * 1.3 + flOff) * 30},${0.2 - fl * 0.06})`
      ctx.lineWidth = (flameW + fl * 3) * S
      ctx.strokeText(comboText, Math.sin(flameTime * 2 + fl) * 1.5*S, Math.cos(flameTime * 1.5 + fl) * 1.5*S - fl * 1.5*S)
    }
    ctx.restore()
  }
  ctx.restore()

  // 第二行："额外伤害 N"
  if (dmgAlpha > 0) {
    ctx.save()
    ctx.globalAlpha = comboAlpha * dmgAlpha
    const dmgCy = comboCy + baseSz * 0.72
    ctx.translate(comboCx, dmgCy)
    ctx.scale(dmgScale, dmgScale)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const dmgSz = baseSz * 0.7
    const dmgFont = `italic 900 ${dmgSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
    const dmgText = estTotalDmg > 0 ? `额外伤害 ${estTotalDmg}` : `额外伤害 ${extraPct}%`
    ctx.font = dmgFont
    const dmgGrd = ctx.createLinearGradient(0, -dmgSz*0.45, 0, dmgSz*0.4)
    if (extraPct >= 300) {
      dmgGrd.addColorStop(0, '#ff6666'); dmgGrd.addColorStop(0.4, '#ff1030'); dmgGrd.addColorStop(1, '#990018')
    } else if (extraPct >= 200) {
      dmgGrd.addColorStop(0, '#ff8080'); dmgGrd.addColorStop(0.4, '#ff2040'); dmgGrd.addColorStop(1, '#aa0020')
    } else if (extraPct >= 100) {
      dmgGrd.addColorStop(0, '#ff9999'); dmgGrd.addColorStop(0.4, '#ff3350'); dmgGrd.addColorStop(1, '#bb1530')
    } else {
      dmgGrd.addColorStop(0, '#ffaaaa'); dmgGrd.addColorStop(0.4, '#ff4d60'); dmgGrd.addColorStop(1, '#cc2040')
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 5*S
    ctx.strokeText(dmgText, 0, 0)
    ctx.fillStyle = dmgGrd
    ctx.fillText(dmgText, 0, 0)
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(-dmgSz*3, -dmgSz*0.45)
    ctx.lineTo(dmgSz*3, -dmgSz*0.45)
    ctx.lineTo(dmgSz*2.7, -dmgSz*0.05)
    ctx.lineTo(-dmgSz*3.3, -dmgSz*0.05)
    ctx.clip()
    ctx.font = dmgFont
    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.35
    ctx.fillText(dmgText, 0, 0)
    ctx.restore()
    ctx.save()
    const glowStr = extraPct >= 200 ? 28 : extraPct >= 100 ? 20 : 12
    ctx.shadowColor = '#ff2040'
    ctx.shadowBlur = glowStr * S
    ctx.font = dmgFont
    ctx.fillStyle = '#ff2040'
    ctx.globalAlpha = 0.3
    ctx.fillText(dmgText, 0, 0)
    ctx.restore()

    // 百分比标签飞入
    if (pctAlpha > 0 && extraPct > 0) {
      ctx.save()
      const pctSz = baseSz * 0.72
      const pctFont = `italic 900 ${pctSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
      const pctText = `${extraPct}%`
      const pctY = dmgSz * 0.6 + pctSz * 0.3
      const pctBaseX = baseSz * 0.3 + pctOffX
      ctx.translate(pctBaseX, pctY)
      ctx.scale(pctScale, pctScale)
      ctx.globalAlpha = comboAlpha * dmgAlpha * pctAlpha
      ctx.font = pctFont
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const pctGrd = ctx.createLinearGradient(0, -pctSz*0.4, 0, pctSz*0.35)
      if (extraPct >= 200) {
        pctGrd.addColorStop(0, '#ff8888'); pctGrd.addColorStop(0.4, '#ff2244'); pctGrd.addColorStop(1, '#bb0020')
      } else if (extraPct >= 100) {
        pctGrd.addColorStop(0, '#ffaaaa'); pctGrd.addColorStop(0.4, '#ff4466'); pctGrd.addColorStop(1, '#cc2040')
      } else {
        pctGrd.addColorStop(0, '#ffbbbb'); pctGrd.addColorStop(0.4, '#ff5577'); pctGrd.addColorStop(1, '#dd3355')
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 4*S
      ctx.strokeText(pctText, 0, 0)
      ctx.fillStyle = pctGrd
      ctx.fillText(pctText, 0, 0)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(-pctSz*1.5, -pctSz*0.4)
      ctx.lineTo(pctSz*1.5, -pctSz*0.4)
      ctx.lineTo(pctSz*1.3, -pctSz*0.05)
      ctx.lineTo(-pctSz*1.7, -pctSz*0.05)
      ctx.clip()
      ctx.font = pctFont; ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.4
      ctx.fillText(pctText, 0, 0)
      ctx.restore()
      ctx.save()
      ctx.shadowColor = '#ff3060'; ctx.shadowBlur = (extraPct >= 200 ? 24 : 14) * S
      ctx.font = pctFont; ctx.fillStyle = '#ff3060'; ctx.globalAlpha = 0.35
      ctx.fillText(pctText, 0, 0)
      ctx.restore()
      ctx.restore()
    }

    // 倍率说明（加大字号+增强可见度）
    const tipSz = baseSz * 0.26
    const tipY = dmgSz * 0.5 + (pctAlpha > 0 ? baseSz * 0.52 * 0.6 + baseSz * 0.26 * 0.5 : tipSz * 1.0)
    ctx.font = `bold ${tipSz}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
    const tipText = comboBonusPct > 0
      ? `x${totalMul.toFixed(2)}倍率 (含Combo加成${comboBonusPct}%)`
      : `x${totalMul.toFixed(2)}倍率`
    ctx.strokeText(tipText, 0, tipY)
    ctx.fillStyle = 'rgba(255,230,210,0.95)'
    ctx.fillText(tipText, 0, tipY)
    ctx.restore()
  }

  ctx.restore()

  // Combo粒子特效
  if (g._comboParticles.length > 0) {
    ctx.save()
    g._comboParticles.forEach(p => {
      const lifeP = p.t / p.life
      const alpha = lifeP < 0.3 ? 1 : 1 - (lifeP - 0.3) / 0.7
      const sz = p.size * (lifeP < 0.2 ? 0.5 + lifeP / 0.2 * 0.5 : 1 - (lifeP - 0.2) * 0.4)
      ctx.globalAlpha = alpha * 0.9
      ctx.fillStyle = p.color
      if (p.type === 'star') {
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.t * 0.15)
        ctx.beginPath()
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI) / 5 - Math.PI / 2
          const r = i % 2 === 0 ? sz * 1.2 : sz * 0.5
          i === 0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r) : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r)
        }
        ctx.closePath(); ctx.fill()
        ctx.restore()
      } else {
        ctx.shadowColor = p.color; ctx.shadowBlur = sz * 2
        ctx.beginPath(); ctx.arc(p.x, p.y, sz, 0, Math.PI * 2); ctx.fill()
        ctx.shadowBlur = 0
      }
    })
    ctx.restore()
  }

  // Combo白色闪光冲击
  if (g._comboFlash > 0 && g.combo >= 2) {
    ctx.save()
    const flashAlpha = (g._comboFlash / 8) * (g.combo >= 12 ? 0.4 : g.combo >= 8 ? 0.3 : 0.2)
    const flashCy = g.boardY + (ROWS * g.cellSize) * 0.32
    const flashR = (g.combo >= 12 ? 120 : g.combo >= 8 ? 90 : g.combo >= 5 ? 70 : 50) * S
    const flashGrd = ctx.createRadialGradient(W*0.5, flashCy, 0, W*0.5, flashCy, flashR)
    flashGrd.addColorStop(0, `rgba(255,255,255,${flashAlpha})`)
    flashGrd.addColorStop(0.5, `rgba(255,255,240,${flashAlpha * 0.5})`)
    flashGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = flashGrd
    ctx.fillRect(W*0.5 - flashR, flashCy - flashR, flashR * 2, flashR * 2)
    ctx.restore()
  }

  // 格挡/护盾闪光冲击（青色）
  if (g._blockFlash > 0) {
    ctx.save()
    const bfAlpha = (g._blockFlash / 12) * 0.35
    const bfGrd = ctx.createRadialGradient(W*0.5, H*0.5, 0, W*0.5, H*0.5, 200*S)
    bfGrd.addColorStop(0, `rgba(64,232,255,${bfAlpha})`)
    bfGrd.addColorStop(0.4, `rgba(125,223,255,${bfAlpha * 0.5})`)
    bfGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = bfGrd
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
    g._blockFlash--
  }

  // 英雄受击红闪（加强视觉冲击）
  if (g._heroHurtFlash > 0) {
    ctx.save()
    const hfP = g._heroHurtFlash / 18
    // 前6帧强闪，后面渐退
    const hfAlpha = g._heroHurtFlash > 12 ? 0.4 : hfP * 0.35
    ctx.fillStyle = `rgba(255,30,30,${hfAlpha})`
    ctx.fillRect(0, 0, W, H)
    // 屏幕边缘红色暗角
    if (g._heroHurtFlash > 6) {
      const vigR = Math.min(W, H) * 0.7
      const vigGrd = ctx.createRadialGradient(W*0.5, H*0.5, vigR*0.5, W*0.5, H*0.5, vigR)
      vigGrd.addColorStop(0, 'transparent')
      vigGrd.addColorStop(1, `rgba(180,0,0,${hfP * 0.3})`)
      ctx.fillStyle = vigGrd
      ctx.fillRect(0, 0, W, H)
    }
    ctx.restore()
    g._heroHurtFlash--
  }

  // 敌人回合预警红闪
  if (g._enemyWarning > 0) {
    ctx.save()
    const ewP = g._enemyWarning / 15
    const ewAlpha = ewP * 0.2 * (1 + Math.sin(g._enemyWarning * 0.8) * 0.5)
    ctx.fillStyle = `rgba(255,60,30,${ewAlpha})`
    ctx.fillRect(0, H * 0.6, W, H * 0.4)
    ctx.restore()
    g._enemyWarning--
  }

  // 克制属性色闪光
  if (g._counterFlash && g._counterFlash.timer > 0) {
    ctx.save()
    const cfAlpha = (g._counterFlash.timer / 10) * 0.35
    const cfColor = g._counterFlash.color || '#ffd700'
    const cfGrd = ctx.createRadialGradient(W*0.5, g._getEnemyCenterY(), 0, W*0.5, g._getEnemyCenterY(), W*0.5)
    cfGrd.addColorStop(0, cfColor)
    cfGrd.addColorStop(0.4, cfColor + '88')
    cfGrd.addColorStop(1, 'transparent')
    ctx.globalAlpha = cfAlpha
    ctx.fillStyle = cfGrd
    ctx.fillRect(0, 0, W, H)
    ctx.restore()
  }
}

function _drawDragTimer(g, cellSize, boardTop) {
  const { ctx, S } = V
  const pct = Math.max(0, Math.min(1, (g.dragTimeLimit - g.dragTimer) / g.dragTimeLimit))
  const barColor = pct < 0.25 ? '#ff4d6a' : pct < 0.5 ? '#ff8c00' : '#4dcc4d'

  // 珠子周围进度环
  const ringR = (g.cellSize - g.cellSize*0.08*2) * 0.5 + 6*S
  const cx = g.dragCurX, cy = g.dragCurY
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'
  ctx.lineWidth = 4*S
  ctx.beginPath()
  ctx.arc(cx, cy, ringR, 0, Math.PI*2)
  ctx.stroke()
  const startAngle = -Math.PI/2
  const endAngle = startAngle + Math.PI*2 * pct
  ctx.strokeStyle = barColor
  ctx.lineWidth = 4*S
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.arc(cx, cy, ringR, startAngle, endAngle)
  ctx.stroke()
  ctx.restore()
}

// ===== 敌方回合过渡横条（画面顶部，不遮挡血条） =====
function _drawEnemyTurnBanner(g) {
  const { ctx, R, W, H, S, safeTop } = V
  const pea = g._pendingEnemyAtk
  if (!pea) return
  const p = Math.min(1, pea.timer / 16)
  const bannerH = 38*S
  // 定位在画面顶部安全区下方
  const bannerY = safeTop + 8*S
  ctx.save()
  // 从右侧滑入
  const slideX = (1 - p) * W * 0.4
  ctx.translate(slideX, 0)
  ctx.globalAlpha = Math.min(1, p * 1.5)
  // 半透明暗条
  const bgGrd = ctx.createLinearGradient(0, bannerY - 6*S, 0, bannerY + bannerH + 6*S)
  bgGrd.addColorStop(0, 'transparent')
  bgGrd.addColorStop(0.12, 'rgba(120,20,15,0.8)')
  bgGrd.addColorStop(0.5, 'rgba(90,10,10,0.9)')
  bgGrd.addColorStop(0.88, 'rgba(120,20,15,0.8)')
  bgGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = bgGrd
  ctx.fillRect(0, bannerY - 6*S, W, bannerH + 12*S)
  // 左右红色光条
  ctx.fillStyle = 'rgba(255,50,30,0.85)'
  ctx.fillRect(0, bannerY, 4*S, bannerH)
  ctx.fillStyle = 'rgba(255,50,30,0.65)'
  ctx.fillRect(W - 4*S, bannerY, 4*S, bannerH)
  // 两侧速度线
  ctx.save()
  ctx.globalAlpha = Math.min(1, p * 2) * 0.4
  ctx.strokeStyle = '#ff6644'; ctx.lineWidth = 1.5*S
  for (let i = 0; i < 6; i++) {
    const ly = bannerY + 4*S + i * (bannerH - 8*S) / 5
    const lOffset = Math.sin(pea.timer * 0.3 + i * 0.8) * 15*S
    ctx.beginPath(); ctx.moveTo(8*S + lOffset, ly); ctx.lineTo(40*S + lOffset, ly); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W - 8*S - lOffset, ly); ctx.lineTo(W - 40*S - lOffset, ly); ctx.stroke()
  }
  ctx.restore()
  // 文字（加大字号 + 粗描边 + 脉动）
  const textPulse = 1 + Math.sin(pea.timer * 0.25) * 0.06
  ctx.save()
  ctx.translate(W*0.5, bannerY + bannerH/2)
  ctx.scale(textPulse, textPulse)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  // 深色描边确保可读性
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 3.5*S
  ctx.strokeText('敌 方 回 合', 0, 0)
  ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 12*S
  ctx.fillStyle = '#ffccaa'
  ctx.fillText('敌 方 回 合', 0, 0)
  ctx.shadowBlur = 0
  ctx.restore()
  ctx.restore()
}

// ===== 棋盘 =====
function drawBoard(g) {
  const { ctx, R, TH, W, H, S, COLS, ROWS } = V
  const cs = g.cellSize, bx = g.boardX, by = g.boardY
  const boardW = COLS * cs, boardH = ROWS * cs

  ctx.fillStyle = 'rgba(8,8,18,0.85)'
  R.rr(bx-3*S, by-3*S, boardW+6*S, boardH+6*S, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(80,80,120,0.5)'; ctx.lineWidth = 1.5*S
  R.rr(bx-3*S, by-3*S, boardW+6*S, boardH+6*S, 6*S); ctx.stroke()

  const tileDark = R.getImg('assets/backgrounds/board_bg_dark1.jpg')
  const tileLight = R.getImg('assets/backgrounds/board_bg_light1.jpg')

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = bx + c*cs, y = by + r*cs
      const isDark = (r+c)%2===0
      const tileImg = isDark ? tileDark : tileLight
      if (tileImg && tileImg.width > 0) {
        ctx.drawImage(tileImg, x, y, cs, cs)
      } else {
        ctx.fillStyle = isDark ? 'rgba(28,28,48,0.9)' : 'rgba(18,18,35,0.9)'
        ctx.fillRect(x, y, cs, cs)
      }
      const cell = g.board[r] && g.board[r][c]
      if (!cell) continue
      if (g.elimAnimCells && g.elimAnimCells.some(ec => ec.r === r && ec.c === c)) {
        const ep = g.elimAnimTimer / 16  // 0→1 消除进度（16帧）
        const elimColor = ATTR_COLOR[g.elimAnimCells[0].attr]?.main || '#ffffff'
        // 阶段1（0-0.3）：高亮放大脉冲
        // 阶段2（0.3-0.7）：缩小 + 属性色发光
        // 阶段3（0.7-1.0）：快速缩到0 + 爆散粒子光效
        let beadAlpha = 1, beadScale = 1
        if (ep < 0.3) {
          const p1 = ep / 0.3
          beadAlpha = 1
          beadScale = 1 + 0.15 * Math.sin(p1 * Math.PI)
        } else if (ep < 0.7) {
          const p2 = (ep - 0.3) / 0.4
          beadAlpha = 1 - p2 * 0.3
          beadScale = 1 - p2 * 0.4
        } else {
          const p3 = (ep - 0.7) / 0.3
          beadAlpha = 0.7 * (1 - p3)
          beadScale = 0.6 * (1 - p3)
        }
        ctx.globalAlpha = beadAlpha
        // 属性色光晕（全程）
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        const glowIntensity = ep < 0.3 ? ep / 0.3 * 0.7 : (1 - ep) * 0.8
        ctx.globalAlpha = glowIntensity
        const glowR2 = cs * (0.5 + ep * 0.3)
        const grd = ctx.createRadialGradient(x+cs*0.5, y+cs*0.5, 0, x+cs*0.5, y+cs*0.5, glowR2)
        grd.addColorStop(0, '#fff')
        grd.addColorStop(0.4, elimColor + 'aa')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.beginPath(); ctx.arc(x+cs*0.5, y+cs*0.5, glowR2, 0, Math.PI*2); ctx.fill()
        ctx.restore()
        // 4+消除额外强光
        if (g.elimAnimCells.length >= 4) {
          ctx.save()
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = glowIntensity * (g.elimAnimCells.length >= 5 ? 0.6 : 0.35)
          const bigGlowR = cs * (0.7 + ep * 0.4)
          const grd2 = ctx.createRadialGradient(x+cs*0.5, y+cs*0.5, 0, x+cs*0.5, y+cs*0.5, bigGlowR)
          grd2.addColorStop(0, '#fff')
          grd2.addColorStop(0.3, elimColor)
          grd2.addColorStop(1, 'transparent')
          ctx.fillStyle = grd2
          ctx.beginPath(); ctx.arc(x+cs*0.5, y+cs*0.5, bigGlowR, 0, Math.PI*2); ctx.fill()
          ctx.restore()
        }
        // 缩放珠子（消除进行中始终开启save，确保配对）
        ctx.save()
        if (beadScale !== 1) {
          ctx.translate(x+cs*0.5, y+cs*0.5)
          ctx.scale(beadScale, beadScale)
          ctx.translate(-(x+cs*0.5), -(y+cs*0.5))
        }
      }
      if (g.dragging && g.dragR === r && g.dragC === c) {
        ctx.globalAlpha = 0.3
      }
      let drawX = x, drawY = y
      if (g.swapAnim) {
        const sa = g.swapAnim, t = sa.t/sa.dur
        if (sa.r1===r && sa.c1===c) { drawX = x+(sa.c2-sa.c1)*cs*t; drawY = y+(sa.r2-sa.r1)*cs*t }
        else if (sa.r2===r && sa.c2===c) { drawX = x+(sa.c1-sa.c2)*cs*t; drawY = y+(sa.r1-sa.r2)*cs*t }
      }
      const attr = typeof cell === 'string' ? cell : cell.attr
      const beadPad = cs * 0.08
      const beadR = (cs - beadPad*2) * 0.5
      R.drawBead(drawX+cs*0.5, drawY+cs*0.5, beadR, attr, g.af)
      // 关闭消除缩放
      if (g.elimAnimCells && g.elimAnimCells.some(ec => ec.r === r && ec.c === c)) {
        ctx.restore()
      }
      // 变珠升级特效（三阶段：聚能→爆变→余韵）
      if (g._beadConvertAnim) {
        const bca = g._beadConvertAnim
        const convertCell = bca.cells.find(cc => cc.r === r && cc.c === c)
        if (convertCell) {
          const cx = drawX + cs*0.5, cy = drawY + cs*0.5
          const toColor = ATTR_COLOR[convertCell.toAttr]?.main || '#ffffff'
          ctx.save()
          if (bca.phase === 'charge') {
            // 阶段1：聚能 — 属性色光柱从天而降 + 珠子缩小
            const chargeP = bca.timer / 6
            // 光柱
            const pillarAlpha = 0.3 + chargeP * 0.5
            const pillarW = beadR * (0.3 + chargeP * 0.7)
            const pillarGrd = ctx.createLinearGradient(cx, cy - cs*2, cx, cy)
            pillarGrd.addColorStop(0, 'transparent')
            pillarGrd.addColorStop(0.3, toColor + '44')
            pillarGrd.addColorStop(0.7, toColor + 'aa')
            pillarGrd.addColorStop(1, '#fff')
            ctx.globalAlpha = pillarAlpha
            ctx.fillStyle = pillarGrd
            ctx.fillRect(cx - pillarW, cy - cs*2 * chargeP, pillarW*2, cs*2 * chargeP)
            // 珠子脉冲
            const pulseR = beadR * (1.1 + Math.sin(bca.timer * 1.5) * 0.15)
            const pulseGrd = ctx.createRadialGradient(cx, cy, beadR*0.2, cx, cy, pulseR)
            pulseGrd.addColorStop(0, '#ffffff88')
            pulseGrd.addColorStop(0.6, toColor + '66')
            pulseGrd.addColorStop(1, 'transparent')
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = 0.5 + chargeP * 0.4
            ctx.fillStyle = pulseGrd
            ctx.beginPath(); ctx.arc(cx, cy, pulseR, 0, Math.PI*2); ctx.fill()
          } else if (bca.phase === 'burst') {
            // 阶段2：爆变 — 白光爆发 + 属性色碎片粒子
            const burstP = (bca.timer - 7) / 3
            // 白光爆发
            const burstR = beadR * (1.5 + burstP * 1.5)
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = (1 - burstP) * 0.9
            const burstGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, burstR)
            burstGrd.addColorStop(0, '#ffffff')
            burstGrd.addColorStop(0.3, '#ffffffcc')
            burstGrd.addColorStop(0.6, toColor + '88')
            burstGrd.addColorStop(1, 'transparent')
            ctx.fillStyle = burstGrd
            ctx.beginPath(); ctx.arc(cx, cy, burstR, 0, Math.PI*2); ctx.fill()
            // 碎片粒子
            for (let pi = 0; pi < 6; pi++) {
              const angle = (pi / 6) * Math.PI * 2 + bca.timer * 0.5
              const dist = beadR * (0.5 + burstP * 2.5)
              const px = cx + Math.cos(angle) * dist
              const py = cy + Math.sin(angle) * dist
              ctx.globalAlpha = (1 - burstP) * 0.8
              ctx.fillStyle = pi % 2 === 0 ? '#fff' : toColor
              ctx.beginPath(); ctx.arc(px, py, (2.5 - burstP * 1.5) * S, 0, Math.PI*2); ctx.fill()
            }
          } else {
            // 阶段3：余韵 — 新珠发光脉冲渐弱
            const glowP = (bca.timer - 10) / 14
            const intensity = (1 - glowP) * 0.6
            if (intensity > 0.05) {
              const glowR = beadR * (1.3 - glowP * 0.3)
              const glowGrd = ctx.createRadialGradient(cx, cy, beadR*0.2, cx, cy, glowR)
              glowGrd.addColorStop(0, `rgba(255,255,255,${intensity})`)
              glowGrd.addColorStop(0.5, toColor + Math.round(intensity * 128).toString(16).padStart(2, '0'))
              glowGrd.addColorStop(1, 'transparent')
              ctx.globalCompositeOperation = 'lighter'
              ctx.fillStyle = glowGrd
              ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI*2); ctx.fill()
            }
          }
          ctx.restore()
        }
      }
      ctx.globalAlpha = 1
      if (cell.sealed) {
        const cx = x + cs*0.5, cy = y + cs*0.5, hr = cs*0.42
        const sealPulse = 0.7 + 0.3 * Math.sin(g.af * 0.1 + r * 1.3 + c * 0.7)
        ctx.save()
        // 暗色遮罩（灵珠变暗表示被封）
        ctx.fillStyle = 'rgba(20,0,0,0.45)'
        ctx.beginPath(); ctx.arc(cx, cy, hr, 0, Math.PI*2); ctx.fill()
        // 锁链纹理：画十字交叉锁链
        ctx.strokeStyle = `rgba(160,80,40,${sealPulse * 0.85})`; ctx.lineWidth = 2.5*S; ctx.lineCap = 'round'
        // 横链
        ctx.beginPath(); ctx.moveTo(x+5*S, cy-2*S); ctx.lineTo(x+cs-5*S, cy-2*S); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x+5*S, cy+2*S); ctx.lineTo(x+cs-5*S, cy+2*S); ctx.stroke()
        // 竖链
        ctx.beginPath(); ctx.moveTo(cx-2*S, y+5*S); ctx.lineTo(cx-2*S, y+cs-5*S); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(cx+2*S, y+5*S); ctx.lineTo(cx+2*S, y+cs-5*S); ctx.stroke()
        // 中心锁扣（小圆环）
        ctx.strokeStyle = `rgba(200,120,40,${sealPulse * 0.9})`; ctx.lineWidth = 2*S
        ctx.beginPath(); ctx.arc(cx, cy, 5*S, 0, Math.PI*2); ctx.stroke()
        ctx.fillStyle = `rgba(80,30,10,${sealPulse * 0.8})`
        ctx.beginPath(); ctx.arc(cx, cy, 3.5*S, 0, Math.PI*2); ctx.fill()
        // 外圈暗红光环脉冲
        ctx.strokeStyle = `rgba(180,40,20,${sealPulse * 0.35})`; ctx.lineWidth = 1.5*S
        ctx.beginPath(); ctx.arc(cx, cy, hr + 1*S, 0, Math.PI*2); ctx.stroke()
        ctx.restore()
      }
    }
  }
  if (g.dragging && g.dragAttr) {
    const beadR = (cs - cs*0.08*2) * 0.5
    const dragColor = ATTR_COLOR[g.dragAttr]?.main || '#ffffff'

    // 拖尾粒子（每3帧生成，最多保留12个）
    if (!g._dragTrailParticles) g._dragTrailParticles = []
    if (g.dragTimer % 3 === 0) {
      g._dragTrailParticles.push({
        x: g.dragCurX + (Math.random()-0.5)*beadR*0.6,
        y: g.dragCurY + (Math.random()-0.5)*beadR*0.6,
        r: (2 + Math.random()*2) * S,
        alpha: 0.7,
        color: Math.random() < 0.3 ? '#fff' : dragColor
      })
      if (g._dragTrailParticles.length > 12) g._dragTrailParticles.shift()
    }
    // 绘制拖尾
    g._dragTrailParticles = g._dragTrailParticles.filter(tp => {
      tp.alpha -= 0.06; tp.r *= 0.93
      if (tp.alpha <= 0) return false
      ctx.save()
      ctx.globalAlpha = tp.alpha
      ctx.fillStyle = tp.color
      ctx.beginPath(); ctx.arc(tp.x, tp.y, tp.r, 0, Math.PI*2); ctx.fill()
      ctx.restore()
      return true
    })

    // 拖拽珠子脉冲+发光效果
    ctx.save()
    const dragScale = 1.1 + Math.sin(g.dragTimer * 0.15) * 0.05
    ctx.translate(g.dragCurX, g.dragCurY)
    ctx.scale(dragScale, dragScale)
    ctx.translate(-g.dragCurX, -g.dragCurY)
    // 拖拽发光光晕
    const dragGlow = ctx.createRadialGradient(g.dragCurX, g.dragCurY, beadR*0.5, g.dragCurX, g.dragCurY, beadR*1.6)
    dragGlow.addColorStop(0, dragColor + '44')
    dragGlow.addColorStop(1, 'transparent')
    ctx.fillStyle = dragGlow
    ctx.beginPath(); ctx.arc(g.dragCurX, g.dragCurY, beadR*1.6, 0, Math.PI*2); ctx.fill()
    R.drawBead(g.dragCurX, g.dragCurY, beadR, g.dragAttr, g.af)
    ctx.restore()
  } else {
    // 不拖拽时清空拖尾粒子
    g._dragTrailParticles = null
  }

  // 消除冲击波纹（多层扩散 + 属性色碎片粒子，匹配16帧消除）
  if (g.elimAnimCells && g.elimAnimTimer <= 16) {
    const eP = g.elimAnimTimer / 16
    const elimAttrColor = ATTR_COLOR[g.elimAnimCells[0]?.attr]?.main || '#ffffff'
    let eCx = 0, eCy = 0
    g.elimAnimCells.forEach(ec => { eCx += bx + ec.c*cs + cs*0.5; eCy += by + ec.r*cs + cs*0.5 })
    eCx /= g.elimAnimCells.length; eCy /= g.elimAnimCells.length
    ctx.save()
    // 主波纹（较快扩散）
    const waveR = cs * (0.5 + eP * 2.5)
    ctx.globalAlpha = (1 - eP) * 0.55
    ctx.strokeStyle = elimAttrColor
    ctx.lineWidth = (3 - eP * 2) * S
    ctx.beginPath(); ctx.arc(eCx, eCy, waveR, 0, Math.PI*2); ctx.stroke()
    // 内层波纹（稍慢，跟随）
    if (eP > 0.1) {
      const innerP = (eP - 0.1) / 0.9
      const waveR2 = cs * (0.3 + innerP * 2)
      ctx.globalAlpha = (1 - innerP) * 0.35
      ctx.lineWidth = (2 - innerP * 1.5) * S
      ctx.beginPath(); ctx.arc(eCx, eCy, waveR2, 0, Math.PI*2); ctx.stroke()
    }
    // 4+消额外强波纹
    if (g.elimAnimCells.length >= 4 && eP > 0.15) {
      const outerP = (eP - 0.15) / 0.85
      const waveR3 = cs * (0.6 + outerP * 3)
      ctx.globalAlpha = (1 - outerP) * 0.25
      ctx.lineWidth = (2.5 - outerP * 2) * S
      ctx.strokeStyle = '#fff'
      ctx.beginPath(); ctx.arc(eCx, eCy, waveR3, 0, Math.PI*2); ctx.stroke()
    }
    // 消除爆散粒子（在消除中后期，从消除中心向外射出小光点）
    if (eP > 0.25 && eP < 0.85) {
      const sparkP = (eP - 0.25) / 0.6
      const sparkCount = g.elimAnimCells.length >= 5 ? 10 : g.elimAnimCells.length >= 4 ? 7 : 5
      for (let si = 0; si < sparkCount; si++) {
        const angle = (si / sparkCount) * Math.PI * 2 + g.elimAnimTimer * 0.2
        const dist = cs * (0.3 + sparkP * 1.8)
        const sx = eCx + Math.cos(angle) * dist
        const sy = eCy + Math.sin(angle) * dist
        const sparkR = (1.5 + (si % 3) * 0.5) * S * (1 - sparkP * 0.6)
        ctx.globalAlpha = (1 - sparkP) * 0.75
        ctx.fillStyle = si % 3 === 0 ? '#fff' : elimAttrColor
        ctx.beginPath(); ctx.arc(sx, sy, sparkR, 0, Math.PI*2); ctx.fill()
      }
    }
    ctx.restore()
  }
}

// ===== 队伍栏 =====
function drawTeamBar(g, topY, barH, iconSize) {
  const { ctx, R, TH, W, H, S } = V
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'

  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }
  const totalSlots = 6
  const sidePad = 8*S
  const petGap = 8*S
  const wpnGap = 12*S
  const iconY = topY + (barH - iconSize) / 2
  const frameScale = 1.12
  const frameSize = iconSize * frameScale
  const frameOff = (frameSize - iconSize) / 2

  g._petBtnRects = []

  for (let i = 0; i < totalSlots; i++) {
    let ix
    if (i === 0) {
      ix = sidePad
    } else {
      ix = sidePad + iconSize + wpnGap + (i - 1) * (iconSize + petGap)
    }
    const cx = ix + iconSize * 0.5
    const cy = iconY + iconSize * 0.5

    if (i === 0) {
      // 法宝
      ctx.fillStyle = g.weapon ? '#1a1510' : 'rgba(25,22,18,0.8)'
      ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
      if (g.weapon) {
        const wpnImg = R.getImg(`assets/equipment/fabao_${g.weapon.id}.png`)
        ctx.save()
        ctx.beginPath(); ctx.rect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2); ctx.clip()
        if (wpnImg && wpnImg.width > 0) {
          ctx.drawImage(wpnImg, ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
        } else {
          const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, iconSize*0.38)
          grd.addColorStop(0, '#ffd70044')
          grd.addColorStop(1, 'transparent')
          ctx.fillStyle = grd
          ctx.fillRect(ix, iconY, iconSize, iconSize)
          ctx.fillStyle = '#ffd700'
          ctx.font = `bold ${iconSize*0.38}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('⚔', cx, cy)
        }
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(80,70,60,0.3)'
        ctx.font = `${iconSize*0.26}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', cx, cy)
      }
      // 金色边框
      ctx.save()
      const bPad = 2*S
      const bx2 = ix - bPad, by2 = iconY - bPad, bsz = iconSize + bPad*2, brd = 6*S
      const goldGrd = ctx.createLinearGradient(bx2, by2, bx2 + bsz, by2 + bsz)
      goldGrd.addColorStop(0, '#ffd700')
      goldGrd.addColorStop(0.3, '#ffec80')
      goldGrd.addColorStop(0.5, '#ffd700')
      goldGrd.addColorStop(0.7, '#c8a200')
      goldGrd.addColorStop(1, '#ffd700')
      ctx.strokeStyle = goldGrd
      ctx.lineWidth = 3*S
      R.rr(bx2, by2, bsz, bsz, brd); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,236,128,0.5)'
      ctx.lineWidth = 1*S
      R.rr(bx2 + 2*S, by2 + 2*S, bsz - 4*S, bsz - 4*S, 4*S); ctx.stroke()
      const cornerOff = 3*S, cornerR = 3.5*S
      const corners = [
        [bx2 + cornerOff, by2 + cornerOff],
        [bx2 + bsz - cornerOff, by2 + cornerOff],
        [bx2 + cornerOff, by2 + bsz - cornerOff],
        [bx2 + bsz - cornerOff, by2 + bsz - cornerOff],
      ]
      corners.forEach(([ccx, ccy]) => {
        ctx.save()
        ctx.translate(ccx, ccy)
        ctx.rotate(Math.PI/4)
        ctx.fillStyle = '#ffd700'
        ctx.fillRect(-cornerR, -cornerR, cornerR*2, cornerR*2)
        ctx.strokeStyle = '#fff8'
        ctx.lineWidth = 0.5*S
        ctx.strokeRect(-cornerR, -cornerR, cornerR*2, cornerR*2)
        ctx.restore()
      })
      ctx.shadowColor = '#ffd700'
      ctx.shadowBlur = 6*S
      ctx.strokeStyle = 'rgba(255,215,0,0.3)'
      ctx.lineWidth = 1*S
      R.rr(bx2, by2, bsz, bsz, brd); ctx.stroke()
      ctx.restore()
      g._weaponBtnRect = [ix, iconY, iconSize, iconSize]
    } else {
      // 宠物
      const petIdx = i - 1
      const petFrame = petIdx < g.pets.length
        ? (framePetMap[g.pets[petIdx].attr] || framePetMap.metal)
        : framePetMap.metal

      if (petIdx < g.pets.length) {
        const p = g.pets[petIdx]
        const ac = ATTR_COLOR[p.attr]
        const ready = p.currentCd <= 0
        let bounceY = 0
        const atkAnim = g.petAtkNums && g.petAtkNums.find(f => f.petIdx === petIdx && f.t <= f.rollFrames)
        if (atkAnim) {
          const progress = atkAnim.t / atkAnim.rollFrames
          bounceY = -Math.sin(progress * Math.PI) * 6 * S
        }
        ctx.save()
        ctx.translate(0, bounceY)
        ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
        ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
        ctx.save()
        const grd = ctx.createRadialGradient(cx, cy - iconSize*0.06, 0, cx, cy - iconSize*0.06, iconSize*0.38)
        grd.addColorStop(0, (ac ? ac.main : '#888') + '40')
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.fillRect(ix, iconY, iconSize, iconSize)
        ctx.restore()
        const petAvatar = R.getImg(getPetAvatarPath(p))
        const hasPetImg = petAvatar && petAvatar.width > 0
        if (hasPetImg) {
          const aw = petAvatar.width, ah = petAvatar.height
          const drawW = iconSize - 2, drawH = drawW * (ah / aw)
          const dy = iconY + 1 + (iconSize - 2) - drawH
          ctx.save()
          ctx.beginPath(); ctx.rect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2); ctx.clip()
          ctx.drawImage(petAvatar, ix + 1, dy, drawW, drawH)
          ctx.restore()
        } else {
          ctx.fillStyle = ac ? ac.main : TH.text
          ctx.font = `bold ${iconSize*0.35}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(ATTR_NAME[p.attr] || '', cx, cy - iconSize*0.08)
          ctx.font = `bold ${iconSize*0.14}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
          ctx.strokeText(p.name.substring(0,3), cx, cy + iconSize*0.25)
          ctx.fillStyle = '#fff'
          ctx.fillText(p.name.substring(0,3), cx, cy + iconSize*0.25)
        }
        if (petFrame && petFrame.width > 0) {
          ctx.drawImage(petFrame, ix - frameOff, iconY - frameOff, frameSize, frameSize)
        }
        // ★ 星级标记（左下角）
        if ((p.star || 1) >= 1) {
          const starText = '★'.repeat(p.star || 1)
          ctx.save()
          ctx.font = `bold ${iconSize * 0.14}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
          ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
          ctx.strokeText(starText, ix + 2*S, iconY + iconSize - 2*S)
          ctx.fillStyle = '#ffd700'
          ctx.fillText(starText, ix + 2*S, iconY + iconSize - 2*S)
          ctx.textBaseline = 'alphabetic'
          ctx.restore()
        }
        if (!ready) {
          // 冷却中 — 暗化头像 + 显示CD标记
          ctx.save()
          // 暗化遮罩
          ctx.fillStyle = 'rgba(0,0,0,0.45)'
          ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
          // CD 圆形标签（右下角）
          const cdR = iconSize * 0.2
          const cdX = ix + iconSize - cdR - 2*S
          const cdY = iconY + iconSize - cdR - 2*S
          ctx.fillStyle = 'rgba(0,0,0,0.75)'
          ctx.beginPath(); ctx.arc(cdX + cdR, cdY + cdR, cdR, 0, Math.PI*2); ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1*S
          ctx.beginPath(); ctx.arc(cdX + cdR, cdY + cdR, cdR, 0, Math.PI*2); ctx.stroke()
          ctx.fillStyle = '#ffd700'; ctx.font = `bold ${iconSize*0.22}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(`${p.currentCd}`, cdX + cdR, cdY + cdR)
          // "CD" 小标签（右上角）
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          const cdLabelW = iconSize * 0.38, cdLabelH = iconSize * 0.18
          const cdLabelX = ix + iconSize - cdLabelW - 1*S, cdLabelY = iconY + 1*S
          R.rr(cdLabelX, cdLabelY, cdLabelW, cdLabelH, 3*S); ctx.fill()
          ctx.fillStyle = '#aaa'; ctx.font = `bold ${iconSize*0.12}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('冷却', cdLabelX + cdLabelW/2, cdLabelY + cdLabelH/2)
          ctx.restore()
        }
        // 首次就绪闪光脉冲
        if (ready && g._petReadyFlash && g._petReadyFlash[petIdx] > 0) {
          ctx.save()
          const rfP = g._petReadyFlash[petIdx] / 15
          const rfColor = ac ? ac.main : '#ffd700'
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = rfP * 0.7
          const rfGrd = ctx.createRadialGradient(cx, cy, iconSize*0.1, cx, cy, iconSize*0.7)
          rfGrd.addColorStop(0, '#ffffff')
          rfGrd.addColorStop(0.4, rfColor)
          rfGrd.addColorStop(1, 'transparent')
          ctx.fillStyle = rfGrd
          ctx.beginPath(); ctx.arc(cx, cy, iconSize*0.7, 0, Math.PI*2); ctx.fill()
          // 扩散环
          const rfRingR = iconSize * (0.5 + (1-rfP) * 0.8)
          ctx.globalAlpha = rfP * 0.5
          ctx.strokeStyle = rfColor; ctx.lineWidth = (2 + rfP*2)*S
          ctx.beginPath(); ctx.arc(cx, cy, rfRingR, 0, Math.PI*2); ctx.stroke()
          ctx.restore()
        }
        if (ready && g.bState === 'playerTurn' && !g.dragging) {
          ctx.save()
          const glowColor2 = ac ? ac.main : TH.accent
          const glowAlpha = 0.5 + 0.4 * Math.sin(g.af * 0.1)
          // 向上箭头特效（浮动动画）
          const arrowSize = iconSize * 0.2
          const arrowYOffset = 2 + Math.sin(g.af * 0.1) * 3
          const arrowX = cx
          const arrowY = iconY - arrowSize - 4*S - arrowYOffset
          
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = 10*S
          ctx.globalAlpha = glowAlpha
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY)
          ctx.lineTo(arrowX - arrowSize*0.7, arrowY + arrowSize)
          ctx.lineTo(arrowX + arrowSize*0.7, arrowY + arrowSize)
          ctx.closePath()
          ctx.fillStyle = glowColor2
          ctx.fill()
          
          ctx.shadowBlur = 0
          ctx.globalAlpha = glowAlpha * 1.2
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY + arrowSize*0.2)
          ctx.lineTo(arrowX - arrowSize*0.5, arrowY + arrowSize*0.9)
          ctx.lineTo(arrowX + arrowSize*0.5, arrowY + arrowSize*0.9)
          ctx.closePath()
          ctx.fillStyle = '#fff'
          ctx.fill()
          
          // 脉冲发光边框
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = 8*S
          ctx.strokeStyle = glowColor2
          ctx.lineWidth = 2*S
          ctx.globalAlpha = glowAlpha * 0.6
          ctx.strokeRect(ix - 1, iconY - 1, iconSize + 2, iconSize + 2)
          ctx.restore()
        } else if (ready) {
          // 技能就绪但不在玩家回合或正在拖拽：显示静态箭头和边框
          ctx.save()
          const glowColor2 = ac ? ac.main : TH.accent
          // 静态向上箭头
          const arrowSize = iconSize * 0.18
          const arrowX = cx
          const arrowY = iconY - arrowSize - 4*S
          
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = 6*S
          ctx.globalAlpha = 0.6
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY)
          ctx.lineTo(arrowX - arrowSize*0.7, arrowY + arrowSize)
          ctx.lineTo(arrowX + arrowSize*0.7, arrowY + arrowSize)
          ctx.closePath()
          ctx.fillStyle = glowColor2
          ctx.fill()
          
          // 静态发光边框
          ctx.shadowBlur = 4*S
          ctx.strokeStyle = glowColor2
          ctx.lineWidth = 2*S
          ctx.globalAlpha = 0.5
          ctx.strokeRect(ix - 1, iconY - 1, iconSize + 2, iconSize + 2)
          ctx.restore()
        }
        g._petBtnRects.push([ix, iconY, iconSize, iconSize])
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(18,18,30,0.6)'
        ctx.fillRect(ix + 1, iconY + 1, iconSize - 2, iconSize - 2)
        if (petFrame && petFrame.width > 0) {
          ctx.save(); ctx.globalAlpha = 0.35
          ctx.drawImage(petFrame, ix - frameOff, iconY - frameOff, frameSize, frameSize)
          ctx.restore()
        }
        g._petBtnRects.push([ix, iconY, iconSize, iconSize])
      }
    }
  }
  ctx.restore()
}

// ===== 敌人 Debuff 染色离屏canvas =====
let _debuffOC = null
let _debuffOCCtx = null
function _getDebuffTintCanvas(enemyImg, w, h, tintColor) {
  if (!enemyImg || !enemyImg.width) return null
  // 微信小游戏环境下创建离屏canvas
  try {
    const iw = Math.ceil(w)
    const ih = Math.ceil(h)
    if (!_debuffOC || _debuffOC.width !== iw || _debuffOC.height !== ih) {
      _debuffOC = wx.createOffscreenCanvas({ type: '2d', width: iw, height: ih })
      _debuffOCCtx = _debuffOC.getContext('2d')
    }
    const oc = _debuffOCCtx
    oc.clearRect(0, 0, iw, ih)
    oc.globalCompositeOperation = 'source-over'
    oc.globalAlpha = 1
    oc.drawImage(enemyImg, 0, 0, iw, ih)
    // source-atop：仅在已有像素（敌人轮廓）上着色
    oc.globalCompositeOperation = 'source-atop'
    oc.fillStyle = tintColor
    oc.fillRect(0, 0, iw, ih)
    oc.globalCompositeOperation = 'source-over'
    return _debuffOC
  } catch (e) {
    return null
  }
}

// ===== 敌人 Debuff 视觉特效 =====
function _drawEnemyDebuffVFX(g, imgX, imgY, imgW, imgH, enemyImg) {
  const { ctx, S } = V
  const hasBuffs = g.enemyBuffs && g.enemyBuffs.length > 0
  const hasBreakDef = g.enemy && g.enemy.def === 0 && g.enemy.baseDef > 0
  if (!hasBuffs && !hasBreakDef) return
  if (g._enemyDeathAnim) return // 死亡中不画

  const af = g.af || 0
  const cx = imgX + imgW / 2
  const cy = imgY + imgH / 2
  const hasStun = hasBuffs && g.enemyBuffs.some(b => b.type === 'stun')
  const hasDot = hasBuffs && g.enemyBuffs.some(b => b.type === 'dot')
  const hasBuff = hasBuffs && g.enemyBuffs.some(b => b.type === 'buff' && !b.bad)

  // --- 1. 中毒/灼烧：身体染色叠加 + 毒液/火焰粒子 ---
  if (hasDot) {
    const dots = g.enemyBuffs.filter(b => b.type === 'dot')
    const isBurn = dots.some(b => b.dotType === 'burn' || b.name === '灼烧')
    const isPoison = dots.some(b => b.dotType === 'poison' || (b.dotType !== 'burn' && b.name !== '灼烧'))

    ctx.save()
    if (isPoison) {
      // 中毒：用离屏canvas生成绿色染色蒙版
      const tintAlpha = 0.22 + 0.08 * Math.sin(af * 0.1)
      const oc = _getDebuffTintCanvas(enemyImg, imgW, imgH, '#00ff40')
      if (oc) {
        ctx.globalAlpha = tintAlpha
        ctx.drawImage(oc, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }

      // 毒液滴落粒子
      for (let i = 0; i < 6; i++) {
        const px = imgX + imgW * 0.15 + (i / 6) * imgW * 0.7
        const speed = 0.06 + (i % 3) * 0.02
        const py = imgY + imgH * 0.3 + ((af * speed + i * 37) % (imgH * 0.6))
        const pAlpha = 0.5 - ((af * speed + i * 37) % (imgH * 0.6)) / (imgH * 0.6) * 0.5
        const pSize = (2 + (i % 3)) * S
        ctx.globalAlpha = pAlpha
        ctx.fillStyle = '#40ff60'
        ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill()
        // 毒液拖尾
        ctx.fillStyle = '#20cc40'
        ctx.globalAlpha = pAlpha * 0.4
        ctx.beginPath(); ctx.arc(px, py - pSize * 2, pSize * 0.6, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (isBurn) {
      // 灼烧：用离屏canvas生成橙红色染色蒙版
      const burnTintAlpha = 0.2 + 0.08 * Math.sin(af * 0.12)
      const oc = _getDebuffTintCanvas(enemyImg, imgW, imgH, '#ff4400')
      if (oc) {
        ctx.globalAlpha = burnTintAlpha
        ctx.drawImage(oc, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }

      // 火焰粒子（从底部向上飘）
      for (let i = 0; i < 8; i++) {
        const baseX = imgX + imgW * 0.1 + (i / 8) * imgW * 0.8
        const speed = 0.08 + (i % 4) * 0.02
        const phase = (af * speed + i * 47) % (imgH * 0.7)
        const py = imgY + imgH - phase
        const pAlpha = 0.7 - phase / (imgH * 0.7) * 0.7
        const wobble = Math.sin(af * 0.15 + i * 2.5) * 4 * S
        const pSize = (2.5 + (i % 3) * 1.2) * S * (1 - phase / (imgH * 0.7) * 0.5)
        ctx.globalAlpha = pAlpha
        ctx.fillStyle = i % 3 === 0 ? '#ff6020' : i % 3 === 1 ? '#ffaa00' : '#ffdd44'
        ctx.beginPath(); ctx.arc(baseX + wobble, py, pSize, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  // --- 2. 眩晕：头顶旋转星星 + 晕圈 ---
  if (hasStun) {
    ctx.save()
    const stunCx = cx
    const stunCy = imgY + imgH * 0.05 // 头顶位置
    const starCount = 5
    const orbitR = imgW * 0.22

    // 晕圈（椭圆环）
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(af * 0.08)
    ctx.strokeStyle = '#ffdd44'
    ctx.lineWidth = 1.5 * S
    ctx.beginPath()
    ctx.ellipse(stunCx, stunCy, orbitR, orbitR * 0.35, 0, 0, Math.PI * 2)
    ctx.stroke()

    // 旋转星星
    for (let i = 0; i < starCount; i++) {
      const angle = (af * 0.06) + (i / starCount) * Math.PI * 2
      const sx = stunCx + Math.cos(angle) * orbitR
      const sy = stunCy + Math.sin(angle) * orbitR * 0.35
      const starSize = (3 + Math.sin(af * 0.15 + i) * 1) * S
      const starAlpha = 0.7 + 0.3 * Math.sin(af * 0.12 + i * 1.5)
      ctx.globalAlpha = starAlpha
      ctx.fillStyle = i % 2 === 0 ? '#ffee44' : '#ffaa00'
      _drawStar(ctx, sx, sy, starSize)
    }
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 3. 破甲（防御为0）：裂纹特效 ---
  if (g.enemy && g.enemy.def === 0 && g.enemy.baseDef > 0) {
    ctx.save()
    ctx.globalAlpha = 0.6 + 0.15 * Math.sin(af * 0.1)
    ctx.strokeStyle = '#ff4444'
    ctx.lineWidth = 2 * S
    ctx.shadowColor = '#ff0000'
    ctx.shadowBlur = 4 * S

    // 几道裂纹
    const cracks = [
      [0.5, 0.25, 0.3, 0.55, 0.55, 0.45],
      [0.5, 0.25, 0.7, 0.5, 0.6, 0.7],
      [0.45, 0.4, 0.25, 0.65],
      [0.55, 0.35, 0.75, 0.6],
    ]
    cracks.forEach(c => {
      ctx.beginPath()
      ctx.moveTo(imgX + imgW * c[0], imgY + imgH * c[1])
      for (let j = 2; j < c.length; j += 2) {
        ctx.lineTo(imgX + imgW * c[j], imgY + imgH * c[j + 1])
      }
      ctx.stroke()
    })

    // 碎片飘散粒子
    for (let i = 0; i < 4; i++) {
      const px = imgX + imgW * (0.3 + (i / 4) * 0.4)
      const py = imgY + imgH * 0.3 + Math.sin(af * 0.05 + i * 2) * imgH * 0.15
      ctx.globalAlpha = 0.4 + 0.2 * Math.sin(af * 0.08 + i)
      ctx.fillStyle = '#ff6644'
      ctx.fillRect(px - 2 * S, py - 1 * S, 4 * S, 2 * S)
    }

    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 4. 敌方增益buff：红色气场脉冲 ---
  if (hasBuff) {
    ctx.save()
    const auraAlpha = 0.15 + 0.1 * Math.sin(af * 0.08)
    const auraR = Math.max(imgW, imgH) * 0.55 + Math.sin(af * 0.06) * 5 * S
    const grd = ctx.createRadialGradient(cx, cy, auraR * 0.3, cx, cy, auraR)
    grd.addColorStop(0, 'rgba(255,60,60,0)')
    grd.addColorStop(0.7, `rgba(255,40,40,${auraAlpha})`)
    grd.addColorStop(1, 'rgba(255,20,20,0)')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(cx, cy, auraR, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }
}

// 画五角星
function _drawStar(ctx, x, y, r) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI / 5)
    const outerX = x + Math.cos(angle) * r
    const outerY = y + Math.sin(angle) * r
    if (i === 0) ctx.moveTo(outerX, outerY)
    else ctx.lineTo(outerX, outerY)
    const innerAngle = angle + Math.PI / 5
    const innerR = r * 0.4
    ctx.lineTo(x + Math.cos(innerAngle) * innerR, y + Math.sin(innerAngle) * innerR)
  }
  ctx.closePath()
  ctx.fill()
}

// ===== Buff图标 =====
function drawBuffIcons(buffs, x, y) {
  const { ctx, R, S } = V
  if (!buffs || buffs.length === 0) return
  buffs.forEach((b, i) => {
    const bx = x + i*24*S
    ctx.fillStyle = b.bad ? 'rgba(200,40,40,0.7)' : 'rgba(40,160,40,0.7)'
    R.rr(bx, y, 22*S, 16*S, 3*S); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `${8*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(b.name || b.type, bx+11*S, y+12*S)
  })
}

function drawBuffIconsLabeled(buffs, x, y, label, isEnemy) {
  const { ctx, R, S } = V
  if (!buffs || buffs.length === 0) return
  ctx.fillStyle = isEnemy ? 'rgba(200,80,80,0.8)' : 'rgba(60,160,200,0.8)'
  ctx.font = `bold ${7*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
  ctx.fillText(label, x, y - 1*S)
  const startX = x
  buffs.forEach((b, i) => {
    const bx = startX + i * 28*S
    ctx.fillStyle = b.bad ? 'rgba(180,30,30,0.75)' : 'rgba(30,140,50,0.75)'
    R.rr(bx, y + 2*S, 26*S, 16*S, 3*S); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `${7*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(b.name || b.type, bx + 13*S, y + 12*S)
    if (b.dur !== undefined && b.dur < 99) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath(); ctx.arc(bx + 24*S, y + 4*S, 5*S, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${6*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${b.dur}`, bx + 24*S, y + 4*S)
      ctx.textBaseline = 'alphabetic'
    }
  })
}

// ===== 全局增益图标列 =====
function drawRunBuffIcons(g, topY, bottomY) {
  const { ctx, R, TH, S } = V
  g._runBuffIconRects = []
  const log = g.runBuffLog
  if (!log || log.length === 0) return
  const merged = {}
  const BUFF_LABELS = {
    allAtkPct:'攻', allDmgPct:'伤', heartBoostPct:'回', weaponBoostPct:'武',
    extraTimeSec:'时', hpMaxPct:'血', comboDmgPct:'连', elim3DmgPct:'3消',
    elim4DmgPct:'4消', elim5DmgPct:'5消', counterDmgPct:'克', skillDmgPct:'技',
    skillCdReducePct:'CD', regenPerTurn:'生', dmgReducePct:'防', bonusCombo:'C+',
    stunDurBonus:'晕', enemyAtkReducePct:'弱攻', enemyHpReducePct:'弱血',
    enemyDefReducePct:'弱防', eliteAtkReducePct:'E攻', eliteHpReducePct:'E血',
    bossAtkReducePct:'B攻', bossHpReducePct:'B血',
    nextDmgReducePct:'减伤', postBattleHealPct:'战回', extraRevive:'复活',
  }
  const DEBUFF_KEYS = ['enemyAtkReducePct','enemyHpReducePct','enemyDefReducePct',
    'eliteAtkReducePct','eliteHpReducePct','bossAtkReducePct','bossHpReducePct']
  for (const entry of log) {
    const k = entry.buff
    if (!merged[k]) merged[k] = { buff: k, val: 0, label: BUFF_LABELS[k] || k, entries: [] }
    merged[k].val += entry.val
    merged[k].entries.push(entry)
  }
  const items = Object.values(merged)
  if (items.length === 0) return
  const iconSz = 24*S
  const gap = 4*S
  const maxShow = Math.floor((bottomY - topY) / (iconSz + gap))
  const showItems = items.slice(0, maxShow)
  const leftX = 4*S
  for (let i = 0; i < showItems.length; i++) {
    const it = showItems[i]
    const iy = topY + i * (iconSz + gap)
    const isDebuff = DEBUFF_KEYS.includes(it.buff)
    ctx.fillStyle = isDebuff ? 'rgba(180,60,60,0.7)' : 'rgba(30,100,60,0.7)'
    R.rr(leftX, iy, iconSz, iconSz, 4*S); ctx.fill()
    ctx.strokeStyle = isDebuff ? 'rgba(255,100,100,0.5)' : 'rgba(100,255,150,0.4)'
    ctx.lineWidth = 1*S
    R.rr(leftX, iy, iconSz, iconSz, 4*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(it.label, leftX + iconSz/2, iy + iconSz*0.38)
    ctx.textBaseline = 'alphabetic'
    const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}` :
                   it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                   `${it.val > 0 ? '+' : ''}${it.val}%`
    ctx.fillStyle = '#ffd700'; ctx.font = `${6*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(valTxt, leftX + iconSz/2, iy + iconSz*0.78)
    g._runBuffIconRects.push({ rect: [leftX, iy, iconSz, iconSz], data: it })
  }
  if (items.length > maxShow) {
    ctx.fillStyle = TH.dim; ctx.font = `${8*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`+${items.length - maxShow}`, leftX + iconSz/2, topY + maxShow * (iconSz + gap) + 8*S)
  }
}

// ===== 胜利弹窗（内嵌奖励选择）=====
function drawVictoryOverlay(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H)

  const hasSpeed = g.lastSpeedKill
  const panelW = W * 0.82
  const panelX = (W - panelW) / 2
  const innerPad = 22*S

  // 如果奖励尚未生成，只显示胜利标题
  if (!g.rewards || g.rewards.length === 0) {
    const miniH = 60*S, miniY = (H - miniH) / 2
    R.drawInfoPanel(panelX, miniY, panelW, miniH)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
    ctx.fillText('战斗胜利', W*0.5, miniY + miniH*0.55)
    return
  }

  // ---- 布局计算 ----
  const rewardCount = g.rewards.length
  const headerH = 24*S
  const speedLineH = hasSpeed ? 18*S : 0
  const subTitleH = 18*S
  const btnAreaH = 36*S
  const itemGap = 4*S

  // 紧凑的奖励项高度：加成类型不需要很高
  const hasPetOrWpn = g.rewards.some(rw => (rw.type === REWARD_TYPES.NEW_PET || rw.type === REWARD_TYPES.NEW_WEAPON) && rw.data)
  const baseItemH = hasPetOrWpn ? 44*S : 36*S
  // 动态调整：如果奖励很多就稍微压缩
  const maxPanel = H * 0.85
  const fixedH = innerPad + headerH + speedLineH + subTitleH + btnAreaH + innerPad + 6*S
  const availForItems = maxPanel - fixedH
  const itemH = Math.min(baseItemH, Math.max(32*S, Math.floor((availForItems - (rewardCount - 1) * itemGap) / rewardCount)))

  const totalH = fixedH + rewardCount * itemH + (rewardCount - 1) * itemGap
  const panelY = Math.max(8*S, Math.floor((H - totalH) / 2))

  R.drawInfoPanel(panelX, panelY, panelW, totalH)

  let curY = panelY + innerPad

  // ---- 标题 ----
  ctx.textAlign = 'center'
  ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
  ctx.fillText('战斗胜利', W*0.5, curY + 14*S)
  curY += headerH

  // ---- 速通信息 ----
  if (hasSpeed) {
    ctx.fillStyle = '#C07000'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(`⚡ 速通达成 (${g.lastTurnCount}回合) — 额外奖励已解锁`, W*0.5, curY + 10*S)
    curY += speedLineH
  }

  // ---- 子标题 ----
  ctx.fillStyle = '#8B7B70'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('选择一项奖励', W*0.5, curY + 10*S)
  curY += subTitleH

  // ---- 奖励选项 ----
  g._rewardRects = []
  g._rewardAvatarRects = []

  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }
  const frameWeapon = R.getImg('assets/ui/frame_weapon.png')
  const cardX = panelX + innerPad
  const cardW = panelW - innerPad * 2

  g.rewards.forEach((rw, i) => {
    const iy = curY + i * (itemH + itemGap)
    const selected = g.selectedReward === i
    const isSpeedBuff = rw.isSpeed === true
    const midY = iy + itemH * 0.5

    // 卡片底色
    ctx.save()
    let bgColor, borderColor
    if (selected) {
      bgColor = 'rgba(201,168,76,0.18)'; borderColor = 'rgba(201,168,76,0.7)'
    } else {
      bgColor = isSpeedBuff ? 'rgba(224,192,112,0.12)' : 'rgba(220,210,195,0.3)'
      borderColor = 'rgba(180,170,155,0.35)'
    }
    ctx.fillStyle = bgColor
    R.rr(cardX, iy, cardW, itemH, 6*S); ctx.fill()
    ctx.strokeStyle = borderColor; ctx.lineWidth = selected ? 1.5*S : 0.5*S
    R.rr(cardX, iy, cardW, itemH, 6*S); ctx.stroke()
    if (selected) {
      ctx.fillStyle = 'rgba(201,168,76,0.6)'
      R.rr(cardX, iy, 3*S, itemH, 1.5*S); ctx.fill()
    }
    ctx.restore()

    g._rewardRects.push([cardX, iy, cardW, itemH])

    if (rw.type === REWARD_TYPES.NEW_PET && rw.data) {
      const p = rw.data
      const ac = ATTR_COLOR[p.attr]
      const avSz = Math.min(itemH - 8*S, 34*S)
      const avX = cardX + 8*S, avY = midY - avSz/2

      ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
      R.rr(avX, avY, avSz, avSz, 4*S); ctx.fill()
      const petAvatar = R.getImg(getPetAvatarPath(p))
      if (petAvatar && petAvatar.width > 0) {
        ctx.save(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 3*S); ctx.clip()
        const dw = avSz - 2, dh = dw * (petAvatar.height/petAvatar.width)
        ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
        ctx.restore()
      }
      const petFrame = framePetMap[p.attr] || framePetMap.metal
      if (petFrame && petFrame.width > 0) {
        const fSz = avSz * 1.12, fOff = (fSz - avSz)/2
        ctx.drawImage(petFrame, avX - fOff, avY - fOff, fSz, fSz)
      }
      g._rewardAvatarRects.push({ idx: i, rect: [avX, avY, avSz, avSz], type: 'pet', data: p })

      const infoX = avX + avSz + 10*S
      ctx.textAlign = 'left'
      ctx.fillStyle = ac ? (ac.dk || ac.main) : '#7A5C30'
      ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.fillText(p.name, infoX, midY - 2*S)
      const nameW = ctx.measureText(p.name).width
      R.drawBead(infoX + nameW + 5*S + 4*S, midY - 6*S, 4*S, p.attr, 0)
      // 已拥有标注
      const _allOwned = [...(g.pets || []), ...(g.petBag || [])]
      const _ownedPet = _allOwned.find(op => op.id === p.id)
      if (_ownedPet) {
        const _os = _ownedPet.star || 1
        const _sTxt = _os >= MAX_STAR ? `已拥有★${_os}（满星）` : `已拥有★${_os} 选择升星`
        ctx.fillStyle = _os >= MAX_STAR ? '#C07000' : '#27864A'
        ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
        ctx.fillText(_sTxt, infoX, midY + 10*S)
      } else {
        ctx.fillStyle = '#6B5B50'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText(`ATK ${p.atk}  ${p.skill ? p.skill.name : ''}`, infoX, midY + 10*S)
      }

    } else if (rw.type === REWARD_TYPES.NEW_WEAPON && rw.data) {
      const w = rw.data
      const avSz = Math.min(itemH - 8*S, 34*S)
      const avX = cardX + 8*S, avY = midY - avSz/2

      ctx.fillStyle = '#2a2030'
      R.rr(avX, avY, avSz, avSz, 4*S); ctx.fill()
      const wpnImg = R.getImg(`assets/equipment/fabao_${w.id}.png`)
      if (wpnImg && wpnImg.width > 0) {
        ctx.save(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 3*S); ctx.clip()
        const dw = avSz - 2, dh = dw * (wpnImg.height/wpnImg.width)
        ctx.drawImage(wpnImg, avX+1, avY+1+(avSz-2-dh), dw, dh)
        ctx.restore()
      }
      if (frameWeapon && frameWeapon.width > 0) {
        const fSz = avSz * 1.12, fOff = (fSz - avSz)/2
        ctx.drawImage(frameWeapon, avX - fOff, avY - fOff, fSz, fSz)
      }
      g._rewardAvatarRects.push({ idx: i, rect: [avX, avY, avSz, avSz], type: 'weapon', data: w })

      const infoX = avX + avSz + 10*S
      ctx.textAlign = 'left'
      ctx.fillStyle = '#8B6914'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.fillText(w.name, infoX, midY - 2*S)
      ctx.fillStyle = '#6B5B50'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      const descShort = w.desc ? (w.desc.length > 14 ? w.desc.slice(0,14)+'…' : w.desc) : ''
      ctx.fillText(descShort, infoX, midY + 10*S)

    } else {
      // 加成类奖励 — 紧凑单行布局：左侧标签 + 居中奖励名 + 右侧小字说明
      const isSpeedTag = isSpeedBuff
      const tagText = isSpeedTag ? '⚡速通' : '加成'
      const tagColor = isSpeedTag ? '#C07000' : '#8B7B70'

      // 左侧标签
      ctx.textAlign = 'left'
      ctx.fillStyle = tagColor; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      ctx.fillText(tagText, cardX + 10*S, midY - 4*S)

      // 奖励名（居中）
      ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      const cardCenterX = cardX + cardW / 2
      ctx.fillText(rw.label, cardCenterX, midY - 2*S)

      // 描述
      ctx.fillStyle = '#8B7B70'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      ctx.fillText('全队永久生效', cardCenterX, midY + 11*S)
    }
  })

  curY += rewardCount * (itemH + itemGap) - itemGap + 6*S

  // ---- 确认按钮 ----
  if (g.selectedReward >= 0) {
    const btnW = cardW * 0.6, btnH = 32*S
    const btnX = cardX + (cardW - btnW) / 2, btnY = curY
    R.drawDialogBtn(btnX, btnY, btnW, btnH, '确认选择', 'confirm')
    g._rewardConfirmRect = [btnX, btnY, btnW, btnH]
  } else {
    g._rewardConfirmRect = null
  }

  // ---- 宠物/法宝详情浮层 ----
  if (g._rewardDetailShow != null) {
    _drawRewardDetailOverlay(g)
  }
}

// 文字换行辅助
function _wrapTextBV(text, maxW, fontSize) {
  const charW = fontSize * V.S * 0.55
  const maxChars = Math.floor(maxW / charW)
  if (maxChars <= 0) return [text]
  const result = []
  for (let i = 0; i < text.length; i += maxChars) result.push(text.slice(i, i + maxChars))
  return result
}

// 宠物/法宝详情浮层（从奖励选择弹窗中点击头像触发）
function _drawRewardDetailOverlay(g) {
  const { ctx, R, W, H, S } = V
  const detail = g._rewardDetailShow
  if (!detail) return

  // 深色遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H)

  const padX = 30*S, padY = 28*S
  const tipW = W * 0.82

  if (detail.type === 'pet') {
    const p = detail.data
    const ac = ATTR_COLOR[p.attr]
    const sk = p.skill
    const lineH = 20*S, smallLineH = 16*S

    let lines = []
    lines.push({ text: p.name, color: ac ? ac.dk || ac.main : '#8B6914', bold: true, size: 15, h: lineH + 4*S })
    lines.push({ text: `__ATTR_ORB__${p.attr}　　攻击力：${p.atk}`, color: '#6B5B50', size: 11, h: smallLineH, attrOrb: p.attr })
    lines.push({ text: '', size: 0, h: 6*S })
    if (sk) {
      lines.push({ text: `技能：${sk.name}`, color: '#7A5C30', bold: true, size: 12, h: lineH })
      const descLines = _wrapTextBV(sk.desc || '无描述', tipW - padX*2 - 10*S, 11)
      descLines.forEach(dl => lines.push({ text: dl, color: '#3D2B1F', size: 11, h: smallLineH }))
      lines.push({ text: '', size: 0, h: 4*S })
      lines.push({ text: `冷却：${p.cd}回合`, color: '#6B5B50', size: 10, h: smallLineH })
    } else {
      lines.push({ text: '该灵兽没有主动技能', color: '#8B7B70', size: 11, h: smallLineH })
    }
    lines.push({ text: '', size: 0, h: 4*S })
    lines.push({ text: '消除对应属性珠时该灵兽发动攻击', color: '#8B7B70', size: 10, h: smallLineH })

    let totalH = padY * 2 + 20*S
    lines.forEach(l => totalH += l.h)
    const tipX = (W - tipW) / 2, tipY = (H - totalH) / 2
    R.drawInfoPanel(tipX, tipY, tipW, totalH)

    let curY = tipY + padY
    ctx.textAlign = 'left'
    lines.forEach(l => {
      if (l.size === 0) { curY += l.h; return }
      curY += l.h
      ctx.fillStyle = l.color || '#3D2B1F'
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
      if (l.attrOrb) {
        const orbR = 6*S, orbX = tipX + padX + orbR, orbY = curY - 4*S - orbR*0.4
        R.drawBead(orbX, orbY, orbR, l.attrOrb, 0)
        ctx.fillText(l.text.replace(`__ATTR_ORB__${l.attrOrb}`, ''), orbX + orbR + 4*S, curY - 4*S)
      } else {
        ctx.fillText(l.text, tipX + padX, curY - 4*S)
      }
    })
    ctx.fillStyle = '#9B8B80'; ctx.font = `${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 8*S)

  } else if (detail.type === 'weapon') {
    const w = detail.data
    const lineH = 20*S, smallLineH = 16*S
    let lines = []
    lines.push({ text: w.name, color: '#8B6914', bold: true, size: 15, h: lineH + 4*S })
    lines.push({ text: '法宝', color: '#B89840', size: 10, h: smallLineH })
    lines.push({ text: '', size: 0, h: 6*S })
    if (w.desc) {
      const descLines = _wrapTextBV(w.desc, tipW - padX*2 - 10*S, 11)
      descLines.forEach(dl => lines.push({ text: dl, color: '#3D2B1F', size: 11, h: smallLineH }))
    }
    if (w.attr) {
      lines.push({ text: '', size: 0, h: 4*S })
      lines.push({ text: `对应属性：${ATTR_NAME[w.attr] || w.attr}`, color: '#6B5B50', size: 10, h: smallLineH, attrOrb: w.attr })
    }

    let totalH = padY * 2 + 20*S
    lines.forEach(l => totalH += l.h)
    const tipX = (W - tipW) / 2, tipY = (H - totalH) / 2
    R.drawInfoPanel(tipX, tipY, tipW, totalH)

    let curY = tipY + padY
    ctx.textAlign = 'left'
    lines.forEach(l => {
      if (l.size === 0) { curY += l.h; return }
      curY += l.h
      ctx.fillStyle = l.color || '#3D2B1F'
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
      if (l.attrOrb) {
        const orbR = 6*S, orbX = tipX + padX + orbR, orbY = curY - 4*S - orbR*0.4
        R.drawBead(orbX, orbY, orbR, l.attrOrb, 0)
        ctx.fillText(l.text.replace(`__ATTR_ORB__${l.attrOrb}`, ''), orbX + orbR + 4*S, curY - 4*S)
      } else {
        ctx.fillText(l.text, tipX + padX, curY - 4*S)
      }
    })
    ctx.fillStyle = '#9B8B80'; ctx.font = `${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 8*S)
  }
  ctx.restore()
}

function drawDefeatOverlay(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H)

  const panelW = W * 0.72, panelH = 120*S
  const panelX = (W - panelW) / 2, panelY = (H - panelH) / 2
  R.drawDialogPanel(panelX, panelY, panelW, panelH)

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText('修士陨落...', W*0.5, panelY + 42*S)

  ctx.fillStyle = 'rgba(220,215,200,0.8)'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`止步第 ${g.floor} 层`, W*0.5, panelY + 62*S)

  const btnW = panelW * 0.7, btnH = 40*S
  const btnX = (W - btnW) / 2, btnY = panelY + panelH - btnH - 14*S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '结算', 'cancel')
  g._defeatBtnRect = [btnX, btnY, btnW, btnH]
}

function drawAdReviveOverlay(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)
  const panelW = W * 0.78, panelH = 240*S
  const panelX = (W - panelW) / 2, panelY = H * 0.28
  R.drawDialogPanel(panelX, panelY, panelW, panelH)
  ctx.save()
  ctx.beginPath()
  R.rr(panelX, panelY, panelW, 4*S, 14*S); ctx.clip()
  ctx.fillStyle = '#ffd700'
  ctx.fillRect(panelX, panelY, panelW, 4*S)
  ctx.restore()
  ctx.textAlign = 'center'
  ctx.fillStyle = TH.danger; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('修士陨落', W*0.5, panelY + 40*S)
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
  ctx.fillText('🎬 观看广告，满血复活！', W*0.5, panelY + 72*S)
  ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`当前第 ${g.floor} 层，复活后从本层继续挑战`, W*0.5, panelY + 98*S)
  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('每轮通关仅有一次复活机会', W*0.5, panelY + 116*S)
  const btnW = panelW * 0.7, btnH = 44*S
  const btnX = (W - btnW) / 2, btnY = panelY + 140*S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '▶ 观看广告复活', 'confirm')
  g._adReviveBtnRect = [btnX, btnY, btnW, btnH]
  const skipW = panelW * 0.5, skipH = 36*S
  const skipX = (W - skipW) / 2, skipY = panelY + 196*S
  R.drawDialogBtn(skipX, skipY, skipW, skipH, '放弃治疗', 'cancel')
  g._adReviveSkipRect = [skipX, skipY, skipW, skipH]
}

module.exports = {
  rBattle, drawBoard, drawTeamBar,
  drawBuffIcons, drawBuffIconsLabeled, drawRunBuffIcons,
  drawVictoryOverlay, drawDefeatOverlay, drawAdReviveOverlay,
}
