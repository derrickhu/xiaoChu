/**
 * 战斗界面渲染：棋盘、队伍栏、怪物区、Combo、倒计时、胜利/失败覆盖
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL } = require('../data/tower')

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

    // --- 血条（细窄样式） ---
    const hpY = eAreaBottom - 18*S
    const hpBarW = W * 0.55
    const hpBarX = (W - hpBarW) / 2
    R.drawHp(hpBarX, hpY, hpBarW, 10*S, g.enemy.hp, g.enemy.maxHp, ac ? ac.main : TH.danger, g._enemyHpLoss, true)

    // --- 怪物图片 ---
    const avatarPath = g.enemy.avatar ? g.enemy.avatar + '.png' : null
    const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
    const imgBottom = hpY - 6*S  // 图片底部贴近血条上方
    let imgDrawY = eAreaTop  // 默认值
    if (enemyImg && enemyImg.width > 0) {
      const maxImgH = eAreaH * 0.58
      const maxImgW = W * 0.5
      const imgRatio = enemyImg.width / enemyImg.height
      let imgW = maxImgH * imgRatio, imgH = maxImgH
      if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / imgRatio }
      const imgX = (W - imgW) / 2
      imgDrawY = imgBottom - imgH
      ctx.drawImage(enemyImg, imgX, imgDrawY, imgW, imgH)
    }

    // --- 怪物名（图片头顶，上移留出抗性空间） ---
    const nameY = imgDrawY - 16*S
    const nameFontSize = 14*S
    ctx.textAlign = 'center'
    // 半透明底衬让名称在任何背景下都清晰
    ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
    const nameW = ctx.measureText(g.enemy.name).width
    const namePadX = 12*S, namePadY = 6*S
    const nameBgX = W*0.5 - nameW/2 - namePadX
    const nameBgW = nameW + namePadX*2
    const nameBgH = namePadY*2 + nameFontSize
    const nameBgY = nameY - nameFontSize + 2*S - namePadY
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    R.rr(nameBgX, nameBgY, nameBgW, nameBgH, 6*S); ctx.fill()
    // 名称文字：暖米色，柔和阴影
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4*S
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
    ctx.fillText(g.enemy.name, W*0.5, nameY)
    ctx.restore()

    // --- 弱点 & 抵抗（名称正下方居中） ---
    const weakAttr = COUNTER_BY[g.enemy.attr]
    const resistAttr = COUNTER_MAP[g.enemy.attr]
    const orbR = 5*S
    const infoFontSize = 9*S
    const infoY = nameY + 12*S
    // 预计算总宽度以实现居中
    ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
    let totalInfoW = 0
    const weakLabelW = weakAttr ? ctx.measureText('弱:').width + orbR*2 + 4*S : 0
    const resistLabelW = resistAttr ? ctx.measureText('抗:').width + orbR*2 + 4*S : 0
    const infoGap = (weakAttr && resistAttr) ? 10*S : 0
    totalInfoW = weakLabelW + infoGap + resistLabelW
    let curX = W*0.5 - totalInfoW/2
    ctx.textAlign = 'left'
    if (weakAttr) {
      ctx.fillStyle = 'rgba(240,224,192,0.9)'; ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2*S
      ctx.fillText('弱:', curX, infoY)
      ctx.restore()
      const lw = ctx.measureText('弱:').width
      R.drawBead(curX + lw + orbR + 2*S, infoY - 3*S, orbR, weakAttr, g.af)
      curX += weakLabelW + infoGap
    }
    if (resistAttr) {
      ctx.fillStyle = 'rgba(240,224,192,0.9)'; ctx.font = `bold ${infoFontSize}px "PingFang SC",sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2*S
      ctx.fillText('抗:', curX, infoY)
      ctx.restore()
      const lw = ctx.measureText('抗:').width
      R.drawBead(curX + lw + orbR + 2*S, infoY - 3*S, orbR, resistAttr, g.af)
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
      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
      ctx.fillText(floorText, W*0.5, labelCY - 2*S)
      ctx.restore()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${9*S}px sans-serif`
      ctx.fillText(bossTag, W*0.5, labelCY + 9*S)
    } else if (evType === 'elite') {
      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
      ctx.fillText(`第 ${g.floor} 层`, W*0.5, labelCY - 2*S)
      ctx.restore()
      ctx.fillStyle = '#e0c0ff'; ctx.font = `bold ${9*S}px sans-serif`
      ctx.fillText('★ 精英战斗', W*0.5, labelCY + 9*S)
    } else {
      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${13*S}px sans-serif`
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
      ctx.fillText(`第 ${g.floor} 层`, W*0.5, labelCY)
      ctx.restore()
    }

    // 敌方Buff
    drawBuffIconsLabeled(g.enemyBuffs, padX+8*S, nameY - 18*S, '敌方', true)
    g._enemyAreaRect = [0, eAreaTop, W, eAreaBottom - eAreaTop]
  }

  // 己方buffs
  drawBuffIconsLabeled(g.heroBuffs, W*0.3, teamBarY - 16*S, '己方', false)
  // 左侧全局增益图标列
  drawRunBuffIcons(g, eAreaTop + 42*S, eAreaBottom - 54*S)

  // 退出按钮
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
  R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✕', exitBtnX + exitBtnSize*0.5, exitBtnY + exitBtnSize*0.5)
  ctx.textBaseline = 'alphabetic'
  g._exitBtnRect = [exitBtnX, exitBtnY, exitBtnSize, exitBtnSize]

  // [DEV] 一键过关调试按钮
  if (g.enemy && g.bState !== 'victory' && g.bState !== 'defeat') {
    const dbgX = exitBtnX + exitBtnSize + 6*S, dbgY = exitBtnY
    const dbgW = 44*S, dbgH = exitBtnSize
    ctx.fillStyle = 'rgba(200,50,50,0.6)'
    R.rr(dbgX, dbgY, dbgW, dbgH, 6*S); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${10*S}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('秒杀', dbgX + dbgW*0.5, dbgY + dbgH*0.5)
    ctx.textBaseline = 'alphabetic'
    g._devKillRect = [dbgX, dbgY, dbgW, dbgH]
  }

  // 队伍栏
  drawTeamBar(g, teamBarY, teamBarH, iconSize)
  // 英雄血条
  R.drawHp(padX, hpBarY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', g._heroHpLoss, true, '#4dcc4d', g.heroShield, g._heroHpGain)
  // 棋盘
  drawBoard(g)
  // 消除飘字
  g.elimFloats.forEach(f => R.drawElimFloat(f))

  // Combo显示
  _drawCombo(g, cellSize, boardTop)

  // 技能释放横幅
  if (g._skillBanner) _drawSkillBanner(g)

  // 宠物头像攻击数值翻滚
  g.petAtkNums.forEach(f => R.drawPetAtkNum(f))

  // 拖拽倒计时
  if (g.dragging && g.bState === 'playerTurn') {
    _drawDragTimer(g, cellSize, boardTop)
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

// ===== 技能释放横幅动画 =====
function _drawSkillBanner(g) {
  const { ctx, R, TH, W, H, S } = V
  const b = g._skillBanner
  if (!b) return
  b.timer++
  if (b.timer > b.duration) { g._skillBanner = null; return }

  const t = b.timer
  const dur = b.duration
  // 动画阶段：入场(0-12帧) → 持续(12-dur-15帧) → 退场(dur-15~dur帧)
  let alpha, slideX
  if (t <= 12) {
    const p = t / 12
    alpha = p
    slideX = (1 - p) * W * 0.3  // 从右侧滑入
  } else if (t >= dur - 15) {
    const p = (t - (dur - 15)) / 15
    alpha = 1 - p
    slideX = -p * W * 0.3  // 向左侧滑出
  } else {
    alpha = 1
    slideX = 0
  }

  ctx.save()
  ctx.globalAlpha = alpha

  // 半透明背景条（全宽）
  const bannerH = 80 * S
  const bannerY = H * 0.33
  const bgGrd = ctx.createLinearGradient(0, bannerY, 0, bannerY + bannerH)
  bgGrd.addColorStop(0, 'transparent')
  bgGrd.addColorStop(0.15, (b.bgColor || '#1a1a2e') + 'dd')
  bgGrd.addColorStop(0.5, (b.bgColor || '#1a1a2e') + 'ee')
  bgGrd.addColorStop(0.85, (b.bgColor || '#1a1a2e') + 'dd')
  bgGrd.addColorStop(1, 'transparent')
  ctx.fillStyle = bgGrd
  ctx.fillRect(0, bannerY, W, bannerH)

  // 属性色上边线 + 下边线
  ctx.fillStyle = b.color
  ctx.globalAlpha = alpha * 0.8
  ctx.fillRect(0, bannerY + 2*S, W, 2*S)
  ctx.fillRect(0, bannerY + bannerH - 4*S, W, 2*S)
  ctx.globalAlpha = alpha

  const cx = W * 0.5 + slideX

  // 宠物名称（小字，技能名上方）
  ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = b.color
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2*S
  ctx.strokeText(b.petName, cx, bannerY + 20*S)
  ctx.fillText(b.petName, cx, bannerY + 20*S)

  // 技能名称（大字，居中）
  const nameScale = t <= 12 ? 1 + (1 - t/12) * 0.5 : 1
  ctx.save()
  ctx.translate(cx, bannerY + 42*S)
  ctx.scale(nameScale, nameScale)
  ctx.font = `italic 900 ${22*S}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 3*S
  ctx.shadowColor = b.color; ctx.shadowBlur = 15*S
  ctx.strokeText(b.skillName, 0, 0)
  ctx.fillText(b.skillName, 0, 0)
  ctx.shadowBlur = 0
  ctx.restore()

  // 技能描述（小字，技能名下方）
  if (b.skillDesc) {
    ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillStyle = '#ddd'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2*S
    ctx.strokeText(b.skillDesc, cx, bannerY + 62*S)
    ctx.fillText(b.skillDesc, cx, bannerY + 62*S)
  }

  // 两侧装饰光点
  if (t <= 20) {
    const sparkAlpha = Math.min(1, t / 6) * (1 - Math.max(0, (t - 12)) / 8)
    ctx.globalAlpha = alpha * sparkAlpha * 0.7
    for (let i = 0; i < 6; i++) {
      const sx = cx + (i - 2.5) * 30*S + Math.sin(t * 0.5 + i) * 5*S
      const sy = bannerY + bannerH * 0.5 + Math.cos(t * 0.3 + i * 2) * 10*S
      const sr = (2 + Math.random()) * S
      ctx.fillStyle = i % 2 === 0 ? '#fff' : b.color
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI*2); ctx.fill()
    }
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
  const comboCy = g.boardY + (ROWS * g.cellSize) * 0.32 + comboOffY
  const isHigh = g.combo >= 5
  const isSuper = g.combo >= 8
  const isMega = g.combo >= 12
  const mainColor = isMega ? '#ff2050' : isSuper ? '#ff4d6a' : isHigh ? '#ff8c00' : '#ffd700'
  const glowColor = isMega ? '#ff4060' : isSuper ? '#ff6080' : isHigh ? '#ffaa33' : '#ffe066'
  const baseSz = isMega ? 52*S : isSuper ? 44*S : isHigh ? 38*S : 32*S

  // 预算伤害数据
  const comboMulVal = 1 + (g.combo - 1) * 0.25
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
  ctx.globalAlpha = comboAlpha

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

    // 倍率说明
    const tipSz = baseSz * 0.17
    const tipY = dmgSz * 0.5 + (pctAlpha > 0 ? baseSz * 0.52 * 0.6 + baseSz * 0.17 * 0.5 : tipSz * 1.0)
    ctx.font = `bold ${tipSz}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5*S
    const tipText = comboBonusPct > 0
      ? `x${totalMul.toFixed(2)}倍率 (含Combo加成${comboBonusPct}%)`
      : `x${totalMul.toFixed(2)}倍率`
    ctx.strokeText(tipText, 0, tipY)
    ctx.fillStyle = 'rgba(255,200,200,0.75)'
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
        const flash = Math.sin(g.elimAnimTimer * 0.5) * 0.5 + 0.5
        ctx.globalAlpha = flash
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
      ctx.globalAlpha = 1
      if (cell.sealed) {
        ctx.strokeStyle = 'rgba(180,0,0,0.7)'; ctx.lineWidth = 2*S
        ctx.strokeRect(x+3*S, y+3*S, cs-6*S, cs-6*S)
      }
    }
  }
  if (g.dragging && g.dragAttr) {
    const beadR = (cs - cs*0.08*2) * 0.5
    R.drawBead(g.dragCurX, g.dragCurY, beadR, g.dragAttr, g.af)
  }
}

// ===== 队伍栏 =====
function drawTeamBar(g, topY, barH, iconSize) {
  const { ctx, R, TH, W, H, S } = V
  ctx.save()
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = 'rgba(8,8,20,0.88)'
  ctx.fillRect(0, topY, W, barH)
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
          ctx.font = `bold ${iconSize*0.38}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('⚔', cx, cy)
        }
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(80,70,60,0.3)'
        ctx.font = `${iconSize*0.26}px sans-serif`
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
        const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
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
          ctx.font = `bold ${iconSize*0.35}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(ATTR_NAME[p.attr] || '', cx, cy - iconSize*0.08)
          ctx.font = `bold ${iconSize*0.14}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
          ctx.strokeText(p.name.substring(0,3), cx, cy + iconSize*0.25)
          ctx.fillStyle = '#fff'
          ctx.fillText(p.name.substring(0,3), cx, cy + iconSize*0.25)
        }
        if (petFrame && petFrame.width > 0) {
          ctx.drawImage(petFrame, ix - frameOff, iconY - frameOff, frameSize, frameSize)
        }
        if (!ready) {
          // 冷却中 — 不变暗头像，仅显示CD标记
          ctx.save()
          // CD 圆形标签（右下角）
          const cdR = iconSize * 0.2
          const cdX = ix + iconSize - cdR - 2*S
          const cdY = iconY + iconSize - cdR - 2*S
          ctx.fillStyle = 'rgba(0,0,0,0.75)'
          ctx.beginPath(); ctx.arc(cdX + cdR, cdY + cdR, cdR, 0, Math.PI*2); ctx.fill()
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1*S
          ctx.beginPath(); ctx.arc(cdX + cdR, cdY + cdR, cdR, 0, Math.PI*2); ctx.stroke()
          ctx.fillStyle = '#ffd700'; ctx.font = `bold ${iconSize*0.22}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(`${p.currentCd}`, cdX + cdR, cdY + cdR)
          // "CD" 小标签（右上角）
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          const cdLabelW = iconSize * 0.38, cdLabelH = iconSize * 0.18
          const cdLabelX = ix + iconSize - cdLabelW - 1*S, cdLabelY = iconY + 1*S
          R.rr(cdLabelX, cdLabelY, cdLabelW, cdLabelH, 3*S); ctx.fill()
          ctx.fillStyle = '#aaa'; ctx.font = `bold ${iconSize*0.12}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('冷却', cdLabelX + cdLabelW/2, cdLabelY + cdLabelH/2)
          ctx.restore()
        }
        if (ready && g.bState === 'playerTurn' && !g.dragging) {
          ctx.save()
          const glowColor2 = ac ? ac.main : TH.accent
          const glowAlpha = 0.5 + 0.4 * Math.sin(g.af * 0.1)
          // 旋转弧线光环
          ctx.save()
          ctx.translate(cx, cy)
          ctx.rotate(g.af * 0.04)
          const arcR = iconSize * 0.58
          for (let a = 0; a < 4; a++) {
            ctx.beginPath()
            ctx.arc(0, 0, arcR, a * Math.PI/2, a * Math.PI/2 + Math.PI/3)
            ctx.strokeStyle = glowColor2
            ctx.lineWidth = 2.5*S
            ctx.globalAlpha = glowAlpha * 0.8
            ctx.shadowColor = glowColor2
            ctx.shadowBlur = 10*S
            ctx.stroke()
          }
          ctx.restore()
          // 脉冲发光边框
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = 12*S
          ctx.strokeStyle = glowColor2
          ctx.lineWidth = 2.5*S
          ctx.globalAlpha = glowAlpha
          ctx.strokeRect(ix - 2, iconY - 2, iconSize + 4, iconSize + 4)
          const glowGrd = ctx.createRadialGradient(cx, cy, iconSize*0.15, cx, cy, iconSize*0.55)
          glowGrd.addColorStop(0, glowColor2 + '30')
          glowGrd.addColorStop(1, 'transparent')
          ctx.fillStyle = glowGrd
          ctx.shadowBlur = 0
          ctx.globalAlpha = glowAlpha * 0.6
          ctx.fillRect(ix, iconY, iconSize, iconSize)
          // "技能就绪" 提示标签（头像上方）
          ctx.globalAlpha = glowAlpha
          const tagW = iconSize * 0.9, tagH = iconSize * 0.22
          const tagX = cx - tagW/2, tagY = iconY - tagH - 4*S
          ctx.fillStyle = glowColor2 + 'cc'
          R.rr(tagX, tagY, tagW, tagH, 4*S); ctx.fill()
          ctx.fillStyle = '#fff'; ctx.font = `bold ${iconSize*0.14}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3*S
          ctx.fillText('点击放技能', tagX + tagW/2, tagY + tagH/2)
          ctx.shadowBlur = 0
          ctx.restore()
        } else if (ready) {
          // 技能就绪但不在玩家回合或正在拖拽：只显示静态发光
          ctx.save()
          const glowColor2 = ac ? ac.main : TH.accent
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

// ===== Buff图标 =====
function drawBuffIcons(buffs, x, y) {
  const { ctx, R, S } = V
  if (!buffs || buffs.length === 0) return
  buffs.forEach((b, i) => {
    const bx = x + i*24*S
    ctx.fillStyle = b.bad ? 'rgba(200,40,40,0.7)' : 'rgba(40,160,40,0.7)'
    R.rr(bx, y, 22*S, 16*S, 3*S); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `${8*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(b.name || b.type, bx+11*S, y+12*S)
  })
}

function drawBuffIconsLabeled(buffs, x, y, label, isEnemy) {
  const { ctx, R, S } = V
  if (!buffs || buffs.length === 0) return
  ctx.fillStyle = isEnemy ? 'rgba(200,80,80,0.8)' : 'rgba(60,160,200,0.8)'
  ctx.font = `bold ${7*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText(label, x, y - 1*S)
  const startX = x
  buffs.forEach((b, i) => {
    const bx = startX + i * 28*S
    ctx.fillStyle = b.bad ? 'rgba(180,30,30,0.75)' : 'rgba(30,140,50,0.75)'
    R.rr(bx, y + 2*S, 26*S, 16*S, 3*S); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.font = `${7*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(b.name || b.type, bx + 13*S, y + 12*S)
    if (b.dur !== undefined && b.dur < 99) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.beginPath(); ctx.arc(bx + 24*S, y + 4*S, 5*S, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${6*S}px sans-serif`
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
    ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(it.label, leftX + iconSz/2, iy + iconSz*0.38)
    ctx.textBaseline = 'alphabetic'
    const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}` :
                   it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                   `${it.val > 0 ? '+' : ''}${it.val}%`
    ctx.fillStyle = '#ffd700'; ctx.font = `${6*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(valTxt, leftX + iconSz/2, iy + iconSz*0.78)
    g._runBuffIconRects.push({ rect: [leftX, iy, iconSz, iconSz], data: it })
  }
  if (items.length > maxShow) {
    ctx.fillStyle = TH.dim; ctx.font = `${8*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`+${items.length - maxShow}`, leftX + iconSz/2, topY + maxShow * (iconSz + gap) + 8*S)
  }
}

// ===== 胜利/失败/复活覆盖 =====
function drawVictoryOverlay(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H)

  const hasSpeed = g.lastSpeedKill
  const panelH = hasSpeed ? 150*S : 120*S
  const panelW = W * 0.72
  const panelX = (W - panelW) / 2
  const panelY = (H - panelH) / 2
  R.drawDialogPanel(panelX, panelY, panelW, panelH)

  ctx.textAlign = 'center'
  // 标题 — 与首页弹窗风格一致：米色
  ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${14*S}px sans-serif`
  ctx.fillText('战斗胜利', W*0.5, panelY + 42*S)

  if (hasSpeed) {
    ctx.fillStyle = '#e8a840'; ctx.font = `bold ${11*S}px sans-serif`
    ctx.fillText(`⚡ 速通达成！(${g.lastTurnCount}回合击败)`, W*0.5, panelY + 64*S)
    ctx.fillStyle = 'rgba(220,215,200,0.8)'; ctx.font = `${10*S}px sans-serif`
    ctx.fillText('额外获得速通奖励', W*0.5, panelY + 80*S)
  }

  const btnW = panelW * 0.7, btnH = 40*S
  const btnX = (W - btnW) / 2, btnY = panelY + panelH - btnH - 14*S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '选择奖励', 'confirm')
  g._victoryBtnRect = [btnX, btnY, btnW, btnH]
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
  ctx.fillStyle = TH.danger; ctx.font = `bold ${22*S}px sans-serif`
  ctx.fillText('修士陨落', W*0.5, panelY + 40*S)
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px sans-serif`
  ctx.fillText('🎬 观看广告，满血复活！', W*0.5, panelY + 72*S)
  ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
  ctx.fillText(`当前第 ${g.floor} 层，复活后从本层继续挑战`, W*0.5, panelY + 98*S)
  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
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
