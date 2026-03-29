/**
 * 战斗界面渲染：棋盘、队伍栏、怪物区、Combo、倒计时、胜利/失败覆盖
 */
const V = require('./env')
const { ATTRS, ATTR_COLOR, ATTR_NAME, BEAD_ATTR_COLOR, COUNTER_MAP, COUNTER_BY, COUNTER_MUL, COUNTERED_MUL, ENEMY_SKILLS, REWARD_TYPES, getRealmInfo, REALM_TABLE, MAX_FLOOR } = require('../data/tower')
const { getPetStarAtk, getPetAvatarPath, MAX_STAR, getPetSkillDesc, petHasSkill, getPetRarity } = require('../data/pets')
const { RARITY_VISUAL, STAR_VISUAL } = require('../data/economyConfig')
const tutorial = require('../engine/tutorial')
const MusicMgr = require('../runtime/music')
const Particles = require('../engine/particles')
const FXComposer = require('../engine/effectComposer')
const { isCurrentUserGM } = require('../data/gmConfig')
const { COMBO_MILESTONES, getComboTier, isComboMilestone } = require('../data/constants')
const { expToNextLevel, MAX_LEVEL: CULT_MAX_LEVEL } = require('../data/cultivationConfig')
const { getStageById } = require('../data/stages')
const { drawPanel, drawRibbonIcon, drawDialog, drawTipRow, drawDivider } = require('./uiComponents')

// ===== 战斗布局缓存（避免每帧重算常量布局值） =====
let _layoutCache = null
let _layoutKey = ''

function _getBattleLayout() {
  const { W, H, S, safeTop, COLS, ROWS } = V
  const key = `${W}|${H}|${S}|${safeTop}|${COLS}|${ROWS}`
  if (_layoutCache && _layoutKey === key) return _layoutCache
  const boardPad = 6 * S
  const cellSize = (W - boardPad * 2) / COLS
  const boardH = ROWS * cellSize
  const bottomPad = 8 * S
  const boardTop = H - bottomPad - boardH
  const sidePad = 8 * S
  const petGap = 8 * S
  const wpnGap = 12 * S
  const totalGapW = wpnGap + petGap * 4 + sidePad * 2
  const iconSize = (W - totalGapW) / 6
  const teamBarH = iconSize + 6 * S
  const hpBarH = 18 * S
  const hpBarY = boardTop - hpBarH - 4 * S
  const teamBarY = hpBarY - teamBarH - 2 * S
  const eAreaTop = safeTop + 4 * S
  const eAreaBottom = teamBarY - 4 * S
  _layoutCache = { boardPad, cellSize, boardH, boardTop, sidePad, petGap, wpnGap, totalGapW, iconSize, teamBarH, hpBarH, hpBarY, teamBarY, eAreaTop, eAreaBottom }
  _layoutKey = key
  return _layoutCache
}

// ===== 战斗界面：怪物区域绘制 =====
function _drawBattleEnemyArea(g, eAreaTop, eAreaBottom) {
  const { ctx, R, TH, W, H, S } = V
  const eAreaH = eAreaBottom - eAreaTop
  const ac = ATTR_COLOR[g.enemy.attr]
  const themeBg = 'theme_' + (g.enemy.attr || 'metal')
  R.drawEnemyAreaBg(g.af, themeBg, eAreaTop, eAreaBottom, g.enemy.attr, g.enemy.battleBg)

  const eHpH = 14*S
  const hpY = eAreaBottom - 26*S
  const hpBarW = W * 0.72
  const hpBarX = (W - hpBarW) / 2
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

  const avatarPath = g.enemy.avatar ? g.enemy.avatar + '.png' : null
  const enemyImg = avatarPath ? R.getImg(`assets/${avatarPath}`) : null
  const imgBottom = hpY - 6*S
  const eAreaH_local = eAreaBottom - eAreaTop
  let imgDrawY = imgBottom - eAreaH_local * 0.5
  const hideEnemy = g.bState === 'victory' && !g._enemyDeathAnim
  if (enemyImg && enemyImg.width > 0 && !hideEnemy) {
    const maxImgH = eAreaH * 0.58
    const maxImgW = W * 0.5
    const imgRatio = enemyImg.width / enemyImg.height
    let imgW = maxImgH * imgRatio, imgH = maxImgH
    if (imgW > maxImgW) { imgW = maxImgW; imgH = imgW / imgRatio }
    const imgX = (W - imgW) / 2
    imgDrawY = imgBottom - imgH

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
    if (g._enemyDeathAnim) {
      const dp = g._enemyDeathAnim.timer / g._enemyDeathAnim.duration
      const deathScale = 1 - dp * 0.5
      const deathAlpha = 1 - dp
      ctx.globalAlpha = Math.max(0, deathAlpha)
      ctx.translate(imgX + imgW/2, imgDrawY + imgH/2)
      ctx.scale(deathScale, deathScale)
      ctx.translate(-(imgX + imgW/2), -(imgDrawY + imgH/2))
    }
    if (g._enemyHitFlash > 0) {
      const flashP = g._enemyHitFlash / 12
      const blinkAlpha = flashP > 0.5 ? (Math.sin(g._enemyHitFlash * 1.5) * 0.3 + 0.7) : 1
      ctx.globalAlpha = (ctx.globalAlpha || 1) * blinkAlpha
    }
    ctx.drawImage(enemyImg, imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
    if (g._enemyHitFlash > 0) {
      const glowAlpha = Math.min(0.5, g._enemyHitFlash / 12 * 0.5)
      ctx.globalAlpha = glowAlpha
      ctx.globalCompositeOperation = 'lighter'
      ctx.drawImage(enemyImg, imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
    }
    if (g._enemyTintFlash > 0) {
      const tintAlpha = (g._enemyTintFlash / 8) * 0.3
      ctx.save()
      ctx.globalAlpha = tintAlpha
      ctx.globalCompositeOperation = 'source-atop'
      ctx.fillStyle = '#ff2244'
      ctx.fillRect(imgX + hitOffX, imgDrawY + hitOffY, imgW, imgH)
      ctx.restore()
    }
    ctx.restore()

    _drawEnemyDebuffVFX(g, imgX, imgDrawY, imgW, imgH, enemyImg)

    if (g._enemyDeathAnim) {
      const da = g._enemyDeathAnim
      const dp = da.timer / da.duration
      ctx.save()
      const centerX = imgX + imgW/2, centerY = imgDrawY + imgH/2
      const deathColor = ac ? ac.main : '#ff6040'

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

  const hasSkillCd = g.enemy.skills && g.enemy.skills.length > 0 && g.enemySkillCd >= 0
  const skillCdBlockH = hasSkillCd ? 28*S : 0

  const nameY = imgDrawY - 20*S - skillCdBlockH
  const nameFontSize = 14*S
  ctx.textAlign = 'center'
  ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${nameFontSize}px "PingFang SC",sans-serif`
  ctx.fillText(g.enemy.name, W*0.5, nameY)
  ctx.restore()

  if (hasSkillCd) {
    const cdNum = g.enemySkillCd
    const isUrgent = cdNum <= 1
    const skFontSize = 10*S
    ctx.font = `bold ${skFontSize}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    const nextSkKey = g._nextEnemySkill
    const nextSkData = nextSkKey ? ENEMY_SKILLS[nextSkKey] : null
    const nextSkName = nextSkData ? nextSkData.name : ''
    let cdText
    if (isUrgent && nextSkName) {
      cdText = `⚠ 即将释放【${nextSkName}】！`
    } else if (isUrgent) {
      cdText = '⚠ 下回合释放技能！'
    } else if (nextSkName) {
      cdText = `蓄力【${nextSkName}】${cdNum}回合`
    } else {
      cdText = `技能蓄力 ${cdNum} 回合`
    }
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
  if (weakAttr) {
    const wac = ATTR_COLOR[weakAttr]
    const weakMain = wac ? wac.main : '#fff'
    const isBoss = g.enemy.isBoss || g.enemy.isElite
    const pulseAlpha = isBoss ? (0.75 + 0.25 * Math.sin(g.af * 0.08)) : 0.85
    const pulseScale = isBoss ? (1 + 0.03 * Math.sin(g.af * 0.08)) : 1
    ctx.save()
    if (isBoss) {
      ctx.translate(curX + weakTagW/2, infoY - tagH*0.5 + tagH/2)
      ctx.scale(pulseScale, pulseScale)
      ctx.translate(-(curX + weakTagW/2), -(infoY - tagH*0.5 + tagH/2))
    }
    ctx.globalAlpha = pulseAlpha
    ctx.fillStyle = weakMain + '40'
    ctx.beginPath()
    R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.fill()
    ctx.strokeStyle = weakMain + '99'; ctx.lineWidth = 1.5*S
    R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.stroke()
    if (isBoss) {
      ctx.shadowColor = weakMain; ctx.shadowBlur = 8*S
      ctx.strokeStyle = weakMain + 'cc'; ctx.lineWidth = 1*S
      R.rr(curX, infoY - tagH*0.5, weakTagW, tagH, tagR); ctx.stroke()
      ctx.shadowBlur = 0
    }
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

  ctx.textAlign = 'center'
  const evType = g.curEvent ? g.curEvent.type : 'battle'
  const floorLabelImg = R.getImg('assets/ui/floor_label_bg.png')
  const labelW = W * 0.45, labelH = labelW / 4
  const labelX = (W - labelW) / 2, labelY = eAreaTop + 2*S
  if (floorLabelImg && floorLabelImg.width > 0) {
    ctx.drawImage(floorLabelImg, labelX, labelY, labelW, labelH)
  }
  const labelCY = labelY + labelH * 0.52
  const _isTutorial = tutorial.isActive()
  if (_isTutorial) {
    const tData = tutorial.getGuideData()
    const stepTitle = tData ? tData.title : '新手教学'
    ctx.fillStyle = '#b0e0ff'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText('新手教学', W*0.5, labelCY - 2*S)
    ctx.restore()
    ctx.fillStyle = '#80d0ff'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(`第${tutorial.getStep()+1}课 · ${stepTitle}`, W*0.5, labelCY + 9*S)
  } else if (g.battleMode === 'stage') {
    const { getStageById } = require('../data/stages')
    const stageData = getStageById(g._stageId)
    const stageName = stageData ? stageData.name : '关卡'
    const waveTotal = g._stageWaves ? g._stageWaves.length : 1
    const waveCur = (g._stageWaveIdx || 0) + 1
    ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 2*S
    ctx.fillText(stageName, W*0.5, labelCY - 2*S)
    ctx.restore()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(`第 ${waveCur}/${waveTotal} 波`, W*0.5, labelCY + 9*S)
  } else if (evType === 'boss') {
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

  g._enemyAreaRect = [0, eAreaTop, W, eAreaBottom - eAreaTop]
}

// ===== 战斗界面：UI控制区域（退出、经验、宝箱、buff） =====
function _drawBattleUIControls(g, eAreaTop, eAreaBottom, teamBarY, exitBtnSize) {
  const { ctx, R, W, S } = V
  const exitBtnX = 8*S
  const exitBtnY = eAreaTop

  drawBuffIconsLabeled(g.heroBuffs, W*0.3, teamBarY - 16*S, '己方', false)

  if (!tutorial.isActive()) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1
    R.rr(exitBtnX, exitBtnY, exitBtnSize, exitBtnSize, 6*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('✕', exitBtnX + exitBtnSize*0.5, exitBtnY + exitBtnSize*0.5)
    ctx.textBaseline = 'alphabetic'
    g._exitBtnRect = [exitBtnX, exitBtnY, exitBtnSize, exitBtnSize]
  } else {
    g._exitBtnRect = null
  }

  if (!tutorial.isActive() && g.bState !== 'none') {
    _drawExpIndicator(g, exitBtnX, exitBtnY + exitBtnSize + 6*S, exitBtnSize, S)
  }

  if (!tutorial.isActive() && g.bState !== 'victory' && g.bState !== 'defeat' && g.battleMode !== 'stage') {
    const chestSz = 36*S
    const chestX = W - chestSz - 8*S
    // 宝箱上移至敌人区域右侧，与怪物肩部/头部同高
    const chestY = eAreaTop + (eAreaBottom - eAreaTop) * 0.32
    const allUsed = g.itemResetUsed && g.itemHealUsed
    const pendingCount = (!g.itemResetUsed ? 1 : 0) + (!g.itemHealUsed ? 1 : 0)
    ctx.save()
    ctx.globalAlpha = allUsed ? 0.4 : 0.85
    const chestImg = R.getImg('assets/ui/icon_chest.png')
    if (chestImg && chestImg.width > 0) {
      ctx.drawImage(chestImg, chestX, chestY, chestSz, chestSz)
    } else {
      ctx.fillStyle = 'rgba(80,50,20,0.8)'
      R.rr(chestX, chestY, chestSz, chestSz, 6*S); ctx.fill()
      ctx.strokeStyle = '#d4a844'; ctx.lineWidth = 1.5*S
      R.rr(chestX, chestY, chestSz, chestSz, 6*S); ctx.stroke()
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('📦', chestX + chestSz*0.5, chestY + chestSz*0.5)
      ctx.textBaseline = 'alphabetic'
    }
    ctx.restore()
    if (!allUsed) {
      const badgeSz = 12*S
      const bx = chestX + chestSz - badgeSz*0.3, by = chestY - badgeSz*0.3
      ctx.fillStyle = '#e04040'
      ctx.beginPath(); ctx.arc(bx, by, badgeSz*0.5, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(`${pendingCount}`, bx, by)
      ctx.textBaseline = 'alphabetic'
    }
    g._chestBtnRect = [chestX, chestY, chestSz, chestSz]
  } else {
    g._chestBtnRect = null
  }
}

// ===== 战斗主入口（分发函数） =====
function rBattle(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawBattleBg(g.af)
  const padX = 8 * S
  const { cellSize, boardPad, boardTop, iconSize, teamBarH, hpBarH, hpBarY, teamBarY, eAreaTop, eAreaBottom } = _getBattleLayout()
  g.cellSize = cellSize; g.boardX = boardPad; g.boardY = boardTop
  const exitBtnSize = 32 * S

  // 首次珠子攻击机制提示：延迟弹出检测
  _initOrbAttackTip(g)
  if (g._orbTipDelay > 0) {
    g._orbTipDelay--
    if (g._orbTipDelay === 0) g._showOrbAttackTip = true
  }

  if (g.enemy) _drawBattleEnemyArea(g, eAreaTop, eAreaBottom)
  _drawBattleUIControls(g, eAreaTop, eAreaBottom, teamBarY, exitBtnSize)

  drawTeamBar(g, teamBarY, teamBarH, iconSize)
  R.drawHp(padX, hpBarY, W - padX*2, hpBarH, g.heroHp, g.heroMaxHp, '#d4607a', g._heroHpLoss, true, '#4dcc4d', g.heroShield, g._heroHpGain, g.af)
  _drawAttrCoverageBar(g, hpBarY + hpBarH + 1 * S, boardTop, padX)
  if (g._isNewbieStage) _drawNewbieHint(g, boardTop, padX)
  drawBoard(g)
  if (g._isNewbieStage) _drawNewbieFingerGuide(g, cellSize, boardPad, boardTop)
  g.elimFloats.forEach(f => R.drawElimFloat(f))
  _drawExpFloats(g)
  _drawCombo(g, cellSize, boardTop)
  if (g._newbieComboBanner) _drawNewbieComboBanner(g, boardTop, padX)
  if (g._skillFlash) _drawSkillFlash(g)
  if (g._petSkillWave) _drawPetSkillWave(g)
  if (g.dragging && g.bState === 'playerTurn') _drawDragTimer(g, cellSize, boardTop)
  if (g._pendingEnemyAtk && g.bState === 'playerTurn') _drawEnemyTurnBanner(g)

  g._debugSkipRect = null
  g._gmSkipRect = null

  // GM按钮区域（仅GM玩家在战斗中可见，实时检查openid）
  const _isGM = g._isGM || isCurrentUserGM()
  if (_isGM) g._isGM = true
  if (_isGM && (g.bState === 'playerTurn' || g.bState === 'enemyTurn')) {
    // GM跳过按钮
    const gmBtnW = 60*S, gmBtnH = 28*S
    const gmBtnX = 76*S, gmBtnY = safeTop + 8*S
    ctx.save()
    ctx.fillStyle = 'rgba(200,30,60,0.85)'
    R.rr(gmBtnX, gmBtnY, gmBtnW, gmBtnH, 8*S); ctx.fill()
    ctx.strokeStyle = '#ff6688'; ctx.lineWidth = 1*S
    R.rr(gmBtnX, gmBtnY, gmBtnW, gmBtnH, 8*S); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('GM跳过', gmBtnX + gmBtnW/2, gmBtnY + gmBtnH/2)
    ctx.restore()
    g._gmSkipRect = [gmBtnX, gmBtnY, gmBtnW, gmBtnH]
  }

  if (g.bState === 'waveTransition') _drawWaveTransition(g)
  if (g.bState === 'victory' && !tutorial.isActive()) drawVictoryOverlay(g)
  if (g.bState === 'defeat') drawDefeatOverlay(g)
  if (g.bState === 'adReviveOffer') drawAdReviveOverlay(g)
  if (g.showEnemyDetail) g._drawEnemyDetailDialog()
  if (g.showExitDialog) g._drawExitDialog()
  if (g.showWeaponDetail) g._drawWeaponDetailDialog()
  if (g.showBattlePetDetail != null) g._drawBattlePetDetailDialog()
  if (g.skillPreview) _drawSkillPreviewPopup(g)
  if (g.runBuffDetail) g._drawRunBuffDetailDialog()
  if (g._showItemMenu) _drawItemMenu(g)

  // 玩法帮助按钮（战斗未结束时显示）
  if (g.bState !== 'victory' && g.bState !== 'defeat' && g.bState !== 'adReviveOffer') {
    _drawHelpButton(g, safeTop)
  }
  // 首次珠子攻击机制提示
  if (g._showOrbAttackTip) _drawOrbAttackTip(g)

  // 帮助面板（最上层绘制）
  if (g._showBattleHelp) _drawBattleHelpPanel(g)
}

// ===== 首次珠子攻击提示 =====
const ORB_TIP_FLAG = 'orb_attack_tip'

function _initOrbAttackTip(g) {
  if (g._orbTipChecked) return
  g._orbTipChecked = true
  if (g.storage && g.storage.isGuideShown(ORB_TIP_FLAG)) return
  // 延迟几帧再弹出，让玩家先看到棋盘
  g._orbTipDelay = 30
}

function _drawOrbAttackTip(g) {
  const { ctx, W, H, S } = V
  if (!g._orbTipTimer) g._orbTipTimer = 0
  g._orbTipTimer++
  const lineH = 28 * S

  drawDialog(ctx, S, W, H, {
    title: '珠子攻击指南',
    icon: '💡',
    timer: g._orbTipTimer,
    frame: g.af,
    panelH: 240 * S,
    renderContent: function (c, _S, area) {
      var y = area.y
      drawTipRow(c, _S, area.x, y, lineH, { shape: 'burst', color: '#b8860b' }, '有效珠', '匹配宠物属性，消除造成伤害', '#b8860b', '#8B7355')
      y += lineH
      drawTipRow(c, _S, area.x, y, lineH, { shape: 'dim', color: '#999' }, '无效珠', '暗淡显示，不造成伤害', '#999', '#8B7355')
      y += lineH
      drawTipRow(c, _S, area.x, y, lineH, { shape: 'heart', color: '#e04080' }, '心珠', '始终有效，消除回复生命', '#e04080', '#8B7355')
      y += lineH + 4 * _S
      drawDivider(c, _S, area.x + 10 * _S, area.x + area.w - 10 * _S, y)
      y += 12 * _S
      c.fillStyle = '#a08860'
      c.font = (11 * _S) + 'px "PingFang SC",sans-serif'
      c.textAlign = 'center'
      c.fillText('💡 消除无效珠仍可触发 Combo 增加连击倍率', area.x + area.w / 2, y)
      y += 18 * _S
      c.fillStyle = '#8a7a60'
      c.font = (10 * _S) + 'px "PingFang SC",sans-serif'
      c.fillText('合理搭配队伍属性以覆盖更多珠子颜色', area.x + area.w / 2, y)
    },
  })
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
  const attrColor = (ATTR_COLOR[pet.attr] && ATTR_COLOR[pet.attr].main) || TH.accent
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
  ctx.fillText(getPetSkillDesc(pet) || '无描述', popX + 10*S, popY + 58*S)
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

// ===== Combo背景特效（遮罩、爆炸光晕、放射线、扩散环） =====
function _drawComboBgEffects(cs) {
  const { ctx, S, W, comboCx, comboCy, baseSz, comboAlpha, isSuper, isMega, glowColor, ca } = cs
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

  if (cs.combo >= 3) {
    const burstR = baseSz * (isSuper ? 2.2 : 1.5) * (ca.timer < 10 ? (2.0 - ca.timer / 10) : 1.0)
    const burstGrd = ctx.createRadialGradient(comboCx, comboCy, 0, comboCx, comboCy, burstR)
    burstGrd.addColorStop(0, glowColor + (isSuper ? '66' : '44'))
    burstGrd.addColorStop(0.5, glowColor + '18')
    burstGrd.addColorStop(1, 'transparent')
    ctx.fillStyle = burstGrd
    ctx.fillRect(comboCx - burstR, comboCy - burstR, burstR*2, burstR*2)
  }

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

  if (isComboMilestone(cs.combo) && ca.timer < 18) {
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
}

// ===== Combo里程碑文字（3/6/9/12连击，配置化） =====
function _drawComboMilestone(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboScale, comboAlpha, ca, combo } = cs
  
  // 判断是否命中配置的里程碑
  const milestone = COMBO_MILESTONES.find(m => combo === m.threshold)
  if (!milestone || !ca || ca.timer > 50) return
  
  const mt = milestone.text
  
  ctx.save()
  // 位置在连击数字上方更高处，避免重叠
  const mileY = comboCy - baseSz * 1.8
  ctx.translate(comboCx, mileY)
  // 缩放动画：先大后小，动画更夸张
  const animProgress = Math.max(0, 1 - ca.timer / 30)
  const ms = comboScale * (1.0 + animProgress * 0.5)
  ctx.scale(ms, ms)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // 里程碑字体更大
  ctx.font = `italic 900 ${baseSz * 1.1}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

  // 使用配置的颜色作为渐变
  const mg = ctx.createLinearGradient(-80*S, 0, 80*S, 0)
  mg.addColorStop(0, milestone.color)
  mg.addColorStop(0.5, '#ffffff')
  mg.addColorStop(1, milestone.color)

  // 黑色描边
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'
  ctx.lineWidth = 6 * S
  ctx.strokeText(mt, 0, 0)

  // 填充（带外发光）
  ctx.shadowColor = milestone.color
  ctx.shadowBlur = 20 * S
  ctx.fillStyle = mg
  ctx.fillText(mt, 0, 0)
  ctx.shadowBlur = 0

  // 闪光效果（前20帧）
  if (ca.timer < 20) {
    ctx.globalAlpha = (1 - ca.timer / 20) * 0.9
    ctx.shadowColor = '#fff'
    ctx.shadowBlur = 30 * S
    ctx.fillStyle = '#fff'
    ctx.fillText(mt, 0, 0)
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
  }

  ctx.restore()
}

// ===== Combo主文字（简化版：数字+"连击"分开绘制） =====
function _drawComboMainText(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboScale, mainColor, glowColor, combo, comboFont } = cs
  ctx.save()
  ctx.translate(comboCx, comboCy)
  ctx.scale(comboScale, comboScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  
  // 分离数字和"连击"二字，整体居中布局
  const numText = String(combo)
  const suffixText = '连击'
  
  // 测量文字宽度
  ctx.font = comboFont
  const numMetrics = ctx.measureText(numText)
  const numWidth = numMetrics.width
  
  // "连击"使用缩小字体
  const suffixSz = baseSz * 0.5
  ctx.font = `italic 700 ${suffixSz}px "PingFang SC",sans-serif`
  const suffixMetrics = ctx.measureText(suffixText)
  const suffixWidth = suffixMetrics.width
  
  // 计算整体居中位置：数字偏左，连击在右侧
  const gap = 4 * S  // 数字和"连击"之间的间隙
  const totalWidth = numWidth + gap + suffixWidth
  const startX = -totalWidth / 2  // 从左侧开始
  const numX = startX + numWidth / 2  // 数字居中位置
  const suffixX = startX + numWidth + gap + suffixWidth / 2  // "连击"居中位置
  
  // 绘制数字（主视觉）
  ctx.font = comboFont
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 5*S
  ctx.strokeText(numText, numX, 0)
  ctx.fillStyle = mainColor
  ctx.fillText(numText, numX, 0)
  
  // 简单的剪切高光（仅数字）
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(numX - baseSz*0.8, -baseSz*0.5)
  ctx.lineTo(numX + baseSz*0.6, -baseSz*0.5)
  ctx.lineTo(numX + baseSz*0.4, baseSz*0.05)
  ctx.lineTo(numX - baseSz, baseSz*0.05)
  ctx.clip()
  ctx.fillStyle = glowColor
  ctx.globalAlpha = 0.55
  ctx.fillText(numText, numX, 0)
  ctx.restore()
  
  // 绘制"连击"二字（弱化显示，灰色无彩色）
  ctx.font = `italic 700 ${suffixSz}px "PingFang SC",sans-serif`
  ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.lineWidth = 2*S
  ctx.strokeText(suffixText, suffixX, baseSz * 0.05)  // 稍微下沉对齐
  ctx.fillStyle = '#aaaaaa'  // 统一灰色，不随 tier 变化
  ctx.globalAlpha = 0.8
  ctx.fillText(suffixText, suffixX, baseSz * 0.05)
  ctx.globalAlpha = 1
  
  ctx.restore()
}

// ===== Combo伤害数值文字 =====
function _drawComboDmgText(cs) {
  const { ctx, S, comboCx, comboCy, baseSz, comboAlpha, dmgAlpha, dmgScale, extraPct, estTotalDmg, comboBonusPct } = cs
  if (dmgAlpha <= 0) return

  ctx.save()
  ctx.globalAlpha = comboAlpha * dmgAlpha
  // 位置下移，避免和主文字重叠
  const dmgCy = comboCy + baseSz * 0.9
  ctx.translate(comboCx, dmgCy)
  ctx.scale(dmgScale, dmgScale)
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  const dmgSz = baseSz * 0.65
  const dmgFont = `italic 700 ${dmgSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`
  // 整合百分比到主文字
  let dmgText
  if (estTotalDmg > 0 && comboBonusPct > 0) {
    dmgText = `额外伤害 ${estTotalDmg} (+${comboBonusPct}%)`
  } else if (estTotalDmg > 0) {
    dmgText = `额外伤害 ${estTotalDmg}`
  } else {
    dmgText = `额外伤害 ${extraPct}%`
  }
  ctx.font = dmgFont
  // 简化：只保留描边+填充+简单高光
  const dmgGrd = ctx.createLinearGradient(0, -dmgSz*0.45, 0, dmgSz*0.4)
  dmgGrd.addColorStop(0, '#ff8888')
  dmgGrd.addColorStop(0.5, '#ff2040')
  dmgGrd.addColorStop(1, '#cc0020')
  ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 4*S
  ctx.strokeText(dmgText, 0, 0)
  ctx.fillStyle = dmgGrd
  ctx.fillText(dmgText, 0, 0)
  // 简单高光
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(-dmgSz*2.5, -dmgSz*0.4)
  ctx.lineTo(dmgSz*2.5, -dmgSz*0.4)
  ctx.lineTo(dmgSz*2.2, -dmgSz*0.05)
  ctx.lineTo(-dmgSz*2.8, -dmgSz*0.05)
  ctx.clip()
  ctx.fillStyle = '#fff'
  ctx.globalAlpha = 0.4
  ctx.fillText(dmgText, 0, 0)
  ctx.restore()

  ctx.restore()
}

// ===== Combo粒子与全屏闪光特效 =====
function _drawComboVFX(g) {
  const { ctx, R, W, H, S, ROWS } = V

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

  if (g._heroHurtFlash > 0) {
    ctx.save()
    const hfP = g._heroHurtFlash / 18
    const hfAlpha = g._heroHurtFlash > 12 ? 0.4 : hfP * 0.35
    ctx.fillStyle = `rgba(255,30,30,${hfAlpha})`
    ctx.fillRect(0, 0, W, H)
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

  if (g._enemyWarning > 0) {
    ctx.save()
    const ewP = g._enemyWarning / 15
    const ewAlpha = ewP * 0.2 * (1 + Math.sin(g._enemyWarning * 0.8) * 0.5)
    ctx.fillStyle = `rgba(255,60,30,${ewAlpha})`
    ctx.fillRect(0, H * 0.6, W, H * 0.4)
    ctx.restore()
    g._enemyWarning--
  }

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

// ===== Combo显示（分发函数） =====
function _drawCombo(g, cellSize, boardTop) {
  const { ctx, R, TH, W, H, S, COLS, ROWS } = V
  if (g.combo < 2 || !(g.bState === 'elimAnim' || g.bState === 'dropping' || g.bState === 'preAttack' || g.bState === 'petAtkShow')) return

  const ca = g._comboAnim || { num: g.combo, scale: 1, alpha: 1, offsetY: 0, dmgScale: 1, dmgAlpha: 1 }
  const comboScale = ca.scale || 1
  const comboAlpha = ca.alpha != null ? Math.max(ca.alpha, 0) : 1
  const comboOffY = ca.offsetY || 0
  const dmgScale = ca.dmgScale || 0
  const dmgAlpha = ca.dmgAlpha || 0

  const comboCx = W * 0.5
  const tier = getComboTier(g.combo)
  const isLow = tier === 0
  const comboCy = isLow
    ? g.boardY + (ROWS * g.cellSize) * 0.12 + comboOffY
    : g.boardY + (ROWS * g.cellSize) * 0.32 + comboOffY
  const isHigh = tier >= 1
  const isSuper = tier >= 2
  const isMega = tier >= 4
  // 颜色从配置中读取
  const milestone = COMBO_MILESTONES.find(m => m.tier === tier)
  const mainColor = milestone ? milestone.color : '#ffd700'
  const glowColor = isMega ? '#ff4060' : isSuper ? '#ff6080' : isHigh ? '#ffaa33' : '#ffe066'
  // 字体大小根据 tier 递增
  const baseSz = tier >= 4 ? 52*S : tier >= 3 ? 46*S : tier >= 2 ? 40*S : tier >= 1 ? 34*S : isLow ? 22*S : 32*S
  const lowAlphaMul = isLow ? 0.5 : 1.0

  let comboMulVal
  if (g.combo <= 8) {
    comboMulVal = 1 + (g.combo - 1) * 0.35
  } else if (g.combo <= 12) {
    comboMulVal = 1 + 7 * 0.35 + (g.combo - 8) * 0.20
  } else {
    comboMulVal = 1 + 7 * 0.35 + 4 * 0.20 + (g.combo - 12) * 0.10
  }
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

  const comboText = `${g.combo} 连击`
  const comboFont = `italic 900 ${baseSz}px "Avenir-Black","Helvetica Neue","PingFang SC",sans-serif`

  const cs = {
    ctx, S, W, H, ROWS, comboCx, comboCy, baseSz, comboScale, comboAlpha, lowAlphaMul,
    mainColor, glowColor, comboText, comboFont,
    isLow, isHigh, isSuper, isMega,
    dmgAlpha, dmgScale,
    extraPct, estTotalDmg, comboBonusPct,
    ca, combo: g.combo
  }

  ctx.save()
  ctx.globalAlpha = comboAlpha * lowAlphaMul

  if (!isLow) {
    _drawComboBgEffects(cs)
  }

  _drawComboMainText(cs)
  _drawComboMilestone(cs)

  _drawComboDmgText(cs)

  ctx.restore()

  _drawComboVFX(g)
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

// ===== 属性覆盖指示条（宠物栏下方，HP条与棋盘之间） =====
function _drawAttrCoverageBar(g, topY, boardTop, padX) {
  const { ctx, R, W, S } = V
  const barH = boardTop - topY
  if (barH < 6 * S) return
  const teamAttrs = _getTeamAttrSet(g)
  const orbR = Math.min(barH * 0.36, 7 * S)
  const gap = 10 * S
  const totalW = ATTRS.length * orbR * 2 + (ATTRS.length - 1) * gap
  let x = (W - totalW) / 2 + orbR

  ctx.save()
  for (let i = 0; i < ATTRS.length; i++) {
    const a = ATTRS[i]
    const covered = teamAttrs.has(a)
    const ac = ATTR_COLOR[a]
    const cy = topY + barH / 2

    if (covered) {
      // 有效属性：属性色珠子 + 迷你⚔
      ctx.globalAlpha = 0.9
      R.drawBead(x, cy, orbR, a, g.af)
      // 右上角迷你⚔标记
      const mkSz = orbR * 0.5, mkX = x + orbR * 0.55, mkY = cy - orbR * 0.55
      ctx.fillStyle = ac.main
      ctx.globalAlpha = 0.85
      ctx.font = `bold ${mkSz * 1.6}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowColor = ac.main; ctx.shadowBlur = 2 * S
      ctx.fillText('⚔', mkX, mkY)
      ctx.shadowBlur = 0
    } else {
      // 未覆盖：灰色半透明珠子 + ✕
      ctx.globalAlpha = 0.3
      R.drawBead(x, cy, orbR, a, 0)
      ctx.globalAlpha = 0.7
      const mkSz = orbR * 0.8
      ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1.5 * S
      ctx.beginPath()
      ctx.moveTo(x - mkSz * 0.4, cy - mkSz * 0.4)
      ctx.lineTo(x + mkSz * 0.4, cy + mkSz * 0.4)
      ctx.moveTo(x + mkSz * 0.4, cy - mkSz * 0.4)
      ctx.lineTo(x - mkSz * 0.4, cy + mkSz * 0.4)
      ctx.stroke()
    }
    x += orbR * 2 + gap
  }
  ctx.globalAlpha = 1
  ctx.restore()
}

// ===== 珠子有效性标记（剑=攻击 / +=回复） =====
function _drawOrbIndicator(ctx, cellX, cellY, cs, beadR, attr, frame, S) {
  const iconSz = cs * 0.32
  const icx = cellX + cs - iconSz * 0.5 - cs * 0.04
  const icy = cellY + cs - iconSz * 0.5 - cs * 0.04
  const pulse = 0.75 + 0.2 * Math.sin(frame * 0.06)

  ctx.save()
  ctx.globalAlpha = pulse

  // 半透明深色圆底
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  ctx.beginPath(); ctx.arc(icx, icy, iconSz * 0.5, 0, Math.PI * 2); ctx.fill()

  if (attr === 'heart') {
    ctx.fillStyle = '#ff99cc'
    ctx.shadowColor = '#ff69b4'; ctx.shadowBlur = 3 * S
    ctx.font = `bold ${iconSz * 0.8}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('+', icx, icy + 0.5 * S)
  } else {
    // 攻击属性：简洁的剑（45°斜置，粗线条，属性色）
    const ac = ATTR_COLOR[attr] || BEAD_ATTR_COLOR[attr]
    const color = (ac && ac.lt) || (ac && ac.main) || '#fff'
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.shadowColor = color; ctx.shadowBlur = 2 * S
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const sz = iconSz * 0.35
    // 45°旋转绘制
    ctx.save()
    ctx.translate(icx, icy)
    ctx.rotate(-Math.PI / 4)
    // 剑刃（粗竖线，从上到中）
    ctx.lineWidth = 2.2 * S
    ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(0, sz * 0.3); ctx.stroke()
    // 剑尖（三角形顶端）
    ctx.beginPath()
    ctx.moveTo(0, -sz - 1.5 * S)
    ctx.lineTo(-2 * S, -sz + 2.5 * S)
    ctx.lineTo(2 * S, -sz + 2.5 * S)
    ctx.closePath()
    ctx.fill()
    // 护手（短横线）
    ctx.lineWidth = 2 * S
    ctx.beginPath(); ctx.moveTo(-sz * 0.5, sz * 0.15); ctx.lineTo(sz * 0.5, sz * 0.15); ctx.stroke()
    // 剑柄（短粗线）
    ctx.lineWidth = 2.5 * S
    ctx.beginPath(); ctx.moveTo(0, sz * 0.25); ctx.lineTo(0, sz * 0.75); ctx.stroke()
    ctx.restore()
  }
  ctx.restore()
}

// ===== 队伍属性覆盖集（每帧缓存） =====
let _teamAttrSetCache = null
let _teamAttrSetFrame = -1

function _getTeamAttrSet(g) {
  if (_teamAttrSetFrame === g.af && _teamAttrSetCache) return _teamAttrSetCache
  const s = new Set()
  if (g.pets) g.pets.forEach(p => { if (p && p.attr) s.add(p.attr) })
  _teamAttrSetCache = s
  _teamAttrSetFrame = g.af
  return s
}

// ===== 棋盘 =====
function drawBoard(g) {
  const { ctx, R, TH, W, H, S, COLS, ROWS } = V
  const cs = g.cellSize, bx = g.boardX, by = g.boardY
  const boardW = COLS * cs, boardH = ROWS * cs
  const _nbHighlight = _getNewbieHighlightCells(g)
  const teamAttrs = _getTeamAttrSet(g)

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
        const elimColor = (ATTR_COLOR[g.elimAnimCells[0].attr] && ATTR_COLOR[g.elimAnimCells[0].attr].main) || '#ffffff'
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
      // 掉落补间偏移
      if (cell._dropOffY) drawY += cell._dropOffY
      if (g.swapAnim) {
        const sa = g.swapAnim, t = sa.t/sa.dur
        if (sa.r1===r && sa.c1===c) { drawX = x+(sa.c2-sa.c1)*cs*t; drawY = y+(sa.r2-sa.r1)*cs*t }
        else if (sa.r2===r && sa.c2===c) { drawX = x+(sa.c1-sa.c2)*cs*t; drawY = y+(sa.r1-sa.r2)*cs*t }
      }
      const attr = typeof cell === 'string' ? cell : cell.attr
      const beadPad = cs * 0.08
      const beadR = (cs - beadPad*2) * 0.5
      R.drawBead(drawX+cs*0.5, drawY+cs*0.5, beadR, attr, g.af)
      // 有效珠子：攻击属性剑标记 / 心珠+标记（仅标记有效珠，不暗化无效珠）
      const _isEffective = attr === 'heart' || teamAttrs.has(attr)
      if (_isEffective && !(g.elimAnimCells && g.elimAnimCells.some(ec => ec.r === r && ec.c === c))) {
        _drawOrbIndicator(ctx, drawX, drawY, cs, beadR, attr, g.af, S)
      }
      // 新手引导：高亮可消除的宠物属性珠组
      if (_nbHighlight && _nbHighlight.has(r * COLS + c)) {
        const _nbc = ATTR_COLOR[attr]
        const _nbPulse = 0.25 + 0.2 * Math.sin(g.af * 0.1 + r * 0.5 + c * 0.7)
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = _nbPulse
        const _nbGrd = ctx.createRadialGradient(drawX+cs*0.5, drawY+cs*0.5, 0, drawX+cs*0.5, drawY+cs*0.5, beadR * 1.2)
        _nbGrd.addColorStop(0, '#fff')
        _nbGrd.addColorStop(0.5, (_nbc && _nbc.main) || '#ffd700')
        _nbGrd.addColorStop(1, 'transparent')
        ctx.fillStyle = _nbGrd
        ctx.beginPath(); ctx.arc(drawX+cs*0.5, drawY+cs*0.5, beadR * 1.2, 0, Math.PI*2); ctx.fill()
        ctx.restore()
      }
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
          const toColor = (ATTR_COLOR[convertCell.toAttr] && ATTR_COLOR[convertCell.toAttr].main) || '#ffffff'
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
    const dragColor = (ATTR_COLOR[g.dragAttr] && ATTR_COLOR[g.dragAttr].main) || '#ffffff'

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

  // 消除冲击波纹（增强版：多层扩散 + 辉光 + 粒子引擎爆发）
  if (g.elimAnimCells && g.elimAnimTimer <= 16) {
    const eP = g.elimAnimTimer / 16
    const elimAttrColor = (g.elimAnimCells[0] && ATTR_COLOR[g.elimAnimCells[0].attr] && ATTR_COLOR[g.elimAnimCells[0].attr].main) || '#ffffff'
    let eCx = 0, eCy = 0
    g.elimAnimCells.forEach(ec => { eCx += bx + ec.c*cs + cs*0.5; eCy += by + ec.r*cs + cs*0.5 })
    eCx /= g.elimAnimCells.length; eCy /= g.elimAnimCells.length
    ctx.save()
    // 中心辉光光斑
    const glowRadius = cs * (0.8 + eP * 1.5)
    FXComposer.drawGlowSpot(ctx, eCx, eCy, glowRadius, elimAttrColor, (1 - eP) * 0.5)
    // 主波纹（较快扩散，加粗）
    const waveR = cs * (0.5 + eP * 2.8)
    ctx.globalAlpha = (1 - eP) * 0.65
    ctx.strokeStyle = elimAttrColor
    ctx.lineWidth = (4 - eP * 3) * S
    ctx.beginPath(); ctx.arc(eCx, eCy, waveR, 0, Math.PI*2); ctx.stroke()
    // 内层波纹（稍慢，跟随）
    if (eP > 0.08) {
      const innerP = (eP - 0.08) / 0.92
      const waveR2 = cs * (0.3 + innerP * 2.2)
      ctx.globalAlpha = (1 - innerP) * 0.4
      ctx.lineWidth = (2.5 - innerP * 1.5) * S
      ctx.beginPath(); ctx.arc(eCx, eCy, waveR2, 0, Math.PI*2); ctx.stroke()
    }
    // 4+消额外强波纹 + 辉光
    if (g.elimAnimCells.length >= 4 && eP > 0.12) {
      const outerP = (eP - 0.12) / 0.88
      const waveR3 = cs * (0.6 + outerP * 3.5)
      ctx.globalAlpha = (1 - outerP) * 0.3
      ctx.lineWidth = (3 - outerP * 2.5) * S
      ctx.strokeStyle = '#fff'
      ctx.beginPath(); ctx.arc(eCx, eCy, waveR3, 0, Math.PI*2); ctx.stroke()
      FXComposer.drawGlowSpot(ctx, eCx, eCy, waveR3 * 0.6, elimAttrColor, (1 - outerP) * 0.3)
    }
    // 在消除第3帧用粒子引擎发射一次纹理粒子（仅触发一次）
    if (g.elimAnimTimer === 3 && !g._elimParticlesFired) {
      g._elimParticlesFired = true
      const elimCount = g.elimAnimCells.length
      const pCount = elimCount >= 5 ? 24 : elimCount >= 4 ? 16 : 10
      const comboMul = Math.min(2, 1 + (g.combo || 0) * 0.05)
      Particles.burst({
        x: eCx, y: eCy, count: Math.round(pCount * comboMul),
        speed: (3 + elimCount * 0.5) * S, size: (3 + elimCount * 0.3) * S,
        life: 18 + elimCount * 3, gravity: 0.1 * S, drag: 0.96,
        colors: ['#fff', elimAttrColor, elimAttrColor, '#ffe8b0'],
        shape: elimCount >= 5 ? 'star' : 'glow',
      })
    }
    // 传统爆散粒子保留作为补充
    if (eP > 0.25 && eP < 0.85) {
      const sparkP = (eP - 0.25) / 0.6
      const sparkCount = g.elimAnimCells.length >= 5 ? 10 : g.elimAnimCells.length >= 4 ? 7 : 5
      for (let si = 0; si < sparkCount; si++) {
        const angle = (si / sparkCount) * Math.PI * 2 + g.elimAnimTimer * 0.2
        const dist = cs * (0.3 + sparkP * 2)
        const sx = eCx + Math.cos(angle) * dist
        const sy = eCy + Math.sin(angle) * dist
        const sparkR = (2 + (si % 3) * 0.6) * S * (1 - sparkP * 0.5)
        ctx.globalAlpha = (1 - sparkP) * 0.8
        ctx.fillStyle = si % 3 === 0 ? '#fff' : elimAttrColor
        ctx.beginPath(); ctx.arc(sx, sy, sparkR, 0, Math.PI*2); ctx.fill()
      }
    }
    ctx.restore()
  } else if (!g.elimAnimCells) {
    g._elimParticlesFired = false
  }
}

// ===== 新手棋盘引导：扫描可消除的宠物属性珠组 =====
let _newbieHighlightCache = null
let _newbieHighlightFrame = -1

function _getNewbieHighlightCells(g) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn' || g.dragging) return null
  if (_newbieHighlightFrame === g.af) return _newbieHighlightCache

  const { ROWS, COLS } = V
  const petAttrs = new Set()
  if (g.pets) g.pets.forEach(p => petAttrs.add(p.attr))

  const highlighted = new Set()
  const _attr = (r, c) => {
    const cell = g.board[r] && g.board[r][c]
    return cell ? (typeof cell === 'string' ? cell : cell.attr) : null
  }

  // 扫描横向连续 3+
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS - 2; c++) {
      const a = _attr(r, c)
      if (!a || !petAttrs.has(a)) continue
      let end = c + 1
      while (end < COLS && _attr(r, end) === a) end++
      if (end - c >= 3) {
        for (let cc = c; cc < end; cc++) highlighted.add(r * COLS + cc)
      }
      if (end - c >= 3) c = end - 1
    }
  }
  // 扫描纵向连续 3+
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS - 2; r++) {
      const a = _attr(r, c)
      if (!a || !petAttrs.has(a)) continue
      let end = r + 1
      while (end < ROWS && _attr(end, c) === a) end++
      if (end - r >= 3) {
        for (let rr = r; rr < end; rr++) highlighted.add(rr * COLS + c)
      }
      if (end - r >= 3) r = end - 1
    }
  }

  _newbieHighlightCache = highlighted.size > 0 ? highlighted : null
  _newbieHighlightFrame = g.af
  return _newbieHighlightCache
}

// ===== 新手推荐长拖拽：搜索将同色珠拖到配对位的多步路径 =====
let _longDragCache = null
let _longDragFrame = -1

function _bfsGridPath(sr, sc, tr, tc, ROWS, COLS) {
  if (sr === tr && sc === tc) return [[sr, sc]]
  var visited = new Set()
  var parent = new Map()
  var startKey = sr * COLS + sc
  visited.add(startKey)
  var queue = [[sr, sc]]
  while (queue.length > 0) {
    var cur = queue.shift()
    var r = cur[0], c = cur[1]
    if (r === tr && c === tc) {
      var path = []
      var cr = tr, cc = tc
      while (cr !== sr || cc !== sc) {
        path.unshift([cr, cc])
        var prev = parent.get(cr * COLS + cc)
        cr = prev[0]; cc = prev[1]
      }
      path.unshift([sr, sc])
      return path
    }
    var nbrs = [[0,1],[0,-1],[1,0],[-1,0]]
    for (var d = 0; d < 4; d++) {
      var nr = r + nbrs[d][0], nc = c + nbrs[d][1]
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue
      var nk = nr * COLS + nc
      if (visited.has(nk)) continue
      visited.add(nk)
      parent.set(nk, [r, c])
      queue.push([nr, nc])
    }
  }
  return null
}

function _findLongDragHint(g) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn' || g.dragging) return null
  if (_longDragFrame === g.af) return _longDragCache

  var ROWS = V.ROWS, COLS = V.COLS
  var petAttrs = new Set()
  if (g.pets) g.pets.forEach(function (p) { petAttrs.add(p.attr) })

  // 构建属性网格用于模拟
  var grid = []
  for (var r = 0; r < ROWS; r++) {
    grid[r] = []
    for (var c = 0; c < COLS; c++) {
      var cell = g.board[r] && g.board[r][c]
      grid[r][c] = cell ? (typeof cell === 'string' ? cell : cell.attr) : null
    }
  }

  // 模拟拖拽后统计消除组数（即 Combo 数）
  function _simDragMatches(path) {
    var sim = []
    for (var r = 0; r < ROWS; r++) sim[r] = grid[r].slice()
    var held = sim[path[0][0]][path[0][1]]
    for (var i = 0; i < path.length - 1; i++)
      sim[path[i][0]][path[i][1]] = sim[path[i + 1][0]][path[i + 1][1]]
    sim[path[path.length - 1][0]][path[path.length - 1][1]] = held

    var count = 0
    for (var rr = 0; rr < ROWS; rr++) {
      for (var cc = 0; cc <= COLS - 3; cc++) {
        var a = sim[rr][cc]
        if (!a) continue
        var end = cc + 1
        while (end < COLS && sim[rr][end] === a) end++
        if (end - cc >= 3) { count++; cc = end - 1 }
      }
    }
    for (var cc = 0; cc < COLS; cc++) {
      for (var rr = 0; rr <= ROWS - 3; rr++) {
        var a = sim[rr][cc]
        if (!a) continue
        var end = rr + 1
        while (end < ROWS && sim[end][cc] === a) end++
        if (end - rr >= 3) { count++; rr = end - 1 }
      }
    }
    return count
  }

  var best = null

  // 遍历所有宠物属性格，尝试拖到不同位置，模拟后挑选 Combo 最高的路径
  for (var sr = 0; sr < ROWS; sr++) {
    for (var sc = 0; sc < COLS; sc++) {
      if (!petAttrs.has(grid[sr][sc])) continue
      for (var tr = 0; tr < ROWS; tr++) {
        for (var tc = 0; tc < COLS; tc++) {
          if (tr === sr && tc === sc) continue
          var dist = Math.abs(sr - tr) + Math.abs(sc - tc)
          if (dist < 3 || dist > 8) continue

          var path = _bfsGridPath(sr, sc, tr, tc, ROWS, COLS)
          if (!path || path.length < 4 || path.length > 9) continue

          var matches = _simDragMatches(path)
          if (matches < 1) continue

          var score = matches * 1000 + path.length * 10
          if (!best || score > best.score) {
            best = { path: path, attr: grid[sr][sc], score: score, matches: matches }
          }
        }
      }
      if (best && best.matches >= 3) break
    }
    if (best && best.matches >= 3) break
  }

  _longDragCache = best
  _longDragFrame = g.af
  return _longDragCache
}

// ===== 新手手指引导动画：长路径拖拽演示 =====
function _drawNewbieFingerGuide(g, cs, bx, by) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn' || g.dragging) return
  if (tutorial.isActive()) return

  var ctx = V.ctx, S = V.S, COLS = V.COLS

  // 优先：棋盘上已有可消除组 → 在高亮珠上画呼吸手指
  var highlight = _getNewbieHighlightCells(g)
  if (highlight && highlight.size > 0) {
    var groups = _groupHighlightCells(highlight, COLS)
    for (var i = 0; i < Math.min(groups.length, 2); i++) {
      var cell = groups[i]
      var cx = bx + cell.c * cs + cs * 0.5
      var cy = by + cell.r * cs + cs * 0.5
      var bounce = Math.sin(g.af * 0.06 + i * 1.5) * 5 * S
      var alpha = 0.6 + 0.3 * Math.sin(g.af * 0.08 + i * 2)
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.font = (30 * S) + 'px "PingFang SC",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('\uD83D\uDC46', cx, cy + cs * 0.45 + bounce)
      ctx.restore()
    }
    return
  }

  // 搜索长拖拽路径（转珠演示）
  var hint = _findLongDragHint(g)
  if (hint && hint.path) {
    _drawLongDragAnim(g, ctx, S, cs, bx, by, hint)
    return
  }
}

function _drawLongDragAnim(g, ctx, S, cs, bx, by, hint) {
  var path = hint.path
  var len = path.length
  var cycleDur = 50 + len * 22
  var t = (g.af % cycleDur) / cycleDur
  var attrColor = (ATTR_COLOR[hint.attr] && ATTR_COLOR[hint.attr].main) || '#ffd700'

  // 计算手指当前位置
  var fx, fy, pathProgress, alpha = 1

  if (t < 0.08) {
    // 淡入 + 起点脉冲
    alpha = t / 0.08
    fx = bx + path[0][1] * cs + cs * 0.5
    fy = by + path[0][0] * cs + cs * 0.5
    pathProgress = 0
  } else if (t < 0.72) {
    // 沿路径移动
    var moveT = (t - 0.08) / 0.64
    var segIdx = Math.min(Math.floor(moveT * (len - 1)), len - 2)
    var segT = moveT * (len - 1) - segIdx
    var r1 = path[segIdx][0], c1 = path[segIdx][1]
    var r2 = path[segIdx + 1][0], c2 = path[segIdx + 1][1]
    fx = bx + (c1 + (c2 - c1) * segT) * cs + cs * 0.5
    fy = by + (r1 + (r2 - r1) * segT) * cs + cs * 0.5
    pathProgress = moveT
  } else if (t < 0.85) {
    // 终点停留
    fx = bx + path[len - 1][1] * cs + cs * 0.5
    fy = by + path[len - 1][0] * cs + cs * 0.5
    pathProgress = 1
  } else {
    // 淡出
    alpha = 1 - (t - 0.85) / 0.15
    fx = bx + path[len - 1][1] * cs + cs * 0.5
    fy = by + path[len - 1][0] * cs + cs * 0.5
    pathProgress = 1
  }

  ctx.save()
  ctx.globalAlpha = alpha

  // 绘制完整预定路径（浅色圆点标记每个经过的格子）
  for (var i = 0; i < len; i++) {
    var px = bx + path[i][1] * cs + cs * 0.5
    var py = by + path[i][0] * cs + cs * 0.5
    ctx.save()
    ctx.globalAlpha = alpha * 0.18
    ctx.beginPath()
    ctx.arc(px, py, 4 * S, 0, Math.PI * 2)
    ctx.fillStyle = attrColor
    ctx.fill()
    ctx.restore()
  }

  // 已走过的轨迹（渐变虚线）
  var visitedCount = Math.floor(pathProgress * (len - 1)) + 1
  if (visitedCount >= 2 || pathProgress > 0) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.55
    ctx.strokeStyle = attrColor
    ctx.lineWidth = 3.5 * S
    ctx.setLineDash([5 * S, 4 * S])
    ctx.beginPath()
    ctx.moveTo(bx + path[0][1] * cs + cs * 0.5, by + path[0][0] * cs + cs * 0.5)
    for (var vi = 1; vi < visitedCount && vi < len; vi++) {
      ctx.lineTo(bx + path[vi][1] * cs + cs * 0.5, by + path[vi][0] * cs + cs * 0.5)
    }
    ctx.lineTo(fx, fy)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
  }

  // 起点光晕
  if (pathProgress < 0.4) {
    ctx.save()
    ctx.globalAlpha = alpha * 0.3 * (1 - pathProgress / 0.4)
    var sx = bx + path[0][1] * cs + cs * 0.5
    var sy = by + path[0][0] * cs + cs * 0.5
    var grd = ctx.createRadialGradient(sx, sy, 0, sx, sy, cs * 0.55)
    grd.addColorStop(0, attrColor)
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(sx, sy, cs * 0.55, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
  }

  // 终点光晕 + Combo 预告（到达后）
  if (pathProgress > 0.85) {
    ctx.save()
    var endPulse = 0.5 + 0.5 * Math.sin(g.af * 0.12)
    ctx.globalAlpha = alpha * 0.3 * endPulse
    var ex = bx + path[len - 1][1] * cs + cs * 0.5
    var ey = by + path[len - 1][0] * cs + cs * 0.5
    var egrd = ctx.createRadialGradient(ex, ey, 0, ex, ey, cs * 0.6)
    egrd.addColorStop(0, attrColor)
    egrd.addColorStop(1, 'transparent')
    ctx.fillStyle = egrd
    ctx.beginPath(); ctx.arc(ex, ey, cs * 0.6, 0, Math.PI * 2); ctx.fill()
    ctx.restore()

    // Combo 预告标签
    if (hint.matches && hint.matches >= 2) {
      var labelAlpha = alpha * Math.min(1, (pathProgress - 0.85) / 0.1)
      var labelScale = 1 + 0.08 * Math.sin(g.af * 0.15)
      ctx.save()
      ctx.globalAlpha = labelAlpha * 0.95
      ctx.font = 'bold ' + (14 * S * labelScale) + 'px "PingFang SC",sans-serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffd700'
      ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4 * S
      var labelText = 'Combo x' + hint.matches + '!'
      ctx.fillText(labelText, ex, ey - cs * 0.6)
      ctx.restore()
    }
  }

  // 手指图标
  ctx.save()
  ctx.globalAlpha = alpha * 0.92
  ctx.font = (30 * S) + 'px "PingFang SC",sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('\uD83D\uDC46', fx, fy + cs * 0.38)
  ctx.restore()

  ctx.restore()
}

// 把高亮 Set 按连通区域分组，返回每组代表格
function _groupHighlightCells(highlight, COLS) {
  const cells = []
  const visited = new Set()
  for (const idx of highlight) {
    if (visited.has(idx)) continue
    visited.add(idx)
    const r = Math.floor(idx / COLS), c = idx % COLS
    cells.push({ r, c })
    // BFS 跳过同组其它格
    const q = [idx]
    while (q.length) {
      const cur = q.shift()
      const cr = Math.floor(cur / COLS), cc = cur % COLS
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        const ni = (cr + dr) * COLS + (cc + dc)
        if (highlight.has(ni) && !visited.has(ni)) { visited.add(ni); q.push(ni) }
      }
    }
  }
  return cells
}

// ===== 新手浮动提示条（循环显示，覆盖整个首关） =====
const _NEWBIE_HINTS = [
  '按住珠子沿长路径拖动，经过的珠全部交换！',
  '消除金色珠→金宠攻击，绿色珠→木宠攻击！',
  '一次拖动可穿越整个棋盘，排出多组三连！',
  '连消多种颜色珠子触发 Combo，伤害叠加！',
  '拖得越远、排列越多颜色，Combo 越高！',
  '一次消 4 颗以上灵珠，伤害翻倍！',
  '克制属性攻击伤害 ×2.5，善用五行克制！',
  'Combo 越高伤害加成越大，试试挑战高连击！',
]

function _drawNewbieHint(g, boardTop, padX) {
  if (!g._isNewbieStage || g.bState !== 'playerTurn') return
  const turn = g.turnCount || 0

  const { ctx, W, S } = V
  const text = _NEWBIE_HINTS[turn % _NEWBIE_HINTS.length]
  const barH = 28 * S
  const barY = boardTop - barH - 6 * S

  ctx.save()
  ctx.globalAlpha = 0.88
  ctx.fillStyle = 'rgba(50,30,10,0.75)'
  const rad = 8 * S
  ctx.beginPath()
  ctx.moveTo(padX + rad, barY)
  ctx.lineTo(W - padX - rad, barY)
  ctx.quadraticCurveTo(W - padX, barY, W - padX, barY + rad)
  ctx.lineTo(W - padX, barY + barH - rad)
  ctx.quadraticCurveTo(W - padX, barY + barH, W - padX - rad, barY + barH)
  ctx.lineTo(padX + rad, barY + barH)
  ctx.quadraticCurveTo(padX, barY + barH, padX, barY + barH - rad)
  ctx.lineTo(padX, barY + rad)
  ctx.quadraticCurveTo(padX, barY, padX + rad, barY)
  ctx.closePath()
  ctx.fill()

  ctx.globalAlpha = 1
  ctx.fillStyle = '#ffe9a0'
  ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, W / 2, barY + barH / 2)
  ctx.restore()
}

// ===== 新手 Combo 庆祝横幅（分级激情提示） =====
var _COMBO_MSGS = [
  { min: 2, main: '触发 Combo 连击！', sub: '转珠排列多种颜色，连击更多！', color1: 'rgba(160,120,30,0.9)', color2: 'rgba(200,160,40,0.95)' },
  { min: 3, main: '三连击！伤害飙升！', sub: '转得越远越好，继续排列更多颜色！', color1: 'rgba(180,80,20,0.92)', color2: 'rgba(230,130,30,0.95)' },
  { min: 5, main: '五连击！超强攻势！', sub: '你已经掌握转珠精髓了！', color1: 'rgba(200,40,30,0.92)', color2: 'rgba(240,80,40,0.95)' },
  { min: 7, main: '超级连击！转珠大师！', sub: '势不可挡！敌人在颤抖！', color1: 'rgba(120,20,180,0.92)', color2: 'rgba(180,40,240,0.95)' },
]

function _getComboMsg(combo) {
  var msg = _COMBO_MSGS[0]
  for (var i = _COMBO_MSGS.length - 1; i >= 0; i--) {
    if (combo >= _COMBO_MSGS[i].min) { msg = _COMBO_MSGS[i]; break }
  }
  return msg
}

function _drawNewbieComboBanner(g, boardTop, padX) {
  var banner = g._newbieComboBanner
  if (!banner) return
  banner.timer++
  g._dirty = true
  var combo = banner.combo || 2
  var dur = combo >= 5 ? 120 : 100
  if (banner.timer > dur) { g._newbieComboBanner = null; return }

  var ctx = V.ctx, W = V.W, S = V.S
  var msg = _getComboMsg(combo)

  var alpha
  if (banner.timer < 15) alpha = banner.timer / 15
  else if (banner.timer > dur - 20) alpha = (dur - banner.timer) / 20
  else alpha = 1

  // 高 combo 时横幅更大
  var barH = (combo >= 5 ? 60 : 52) * S
  var barY = boardTop - barH - 10 * S
  // 入场弹性缩放
  var scaleX = 1
  if (banner.timer < 20) {
    var st = banner.timer / 20
    scaleX = 0.6 + 0.5 * st - 0.1 * Math.sin(st * Math.PI)
  }

  ctx.save()
  ctx.globalAlpha = alpha * 0.96

  // 高级渐变背景
  var cx = W / 2, hw = (W - padX * 2) * 0.5 * scaleX
  var grd = ctx.createLinearGradient(cx - hw, barY, cx + hw, barY)
  grd.addColorStop(0, msg.color1)
  grd.addColorStop(0.5, msg.color2)
  grd.addColorStop(1, msg.color1)
  ctx.fillStyle = grd
  var rad = 10 * S
  var lx = cx - hw, rx = cx + hw
  ctx.beginPath()
  ctx.moveTo(lx + rad, barY)
  ctx.lineTo(rx - rad, barY)
  ctx.quadraticCurveTo(rx, barY, rx, barY + rad)
  ctx.lineTo(rx, barY + barH - rad)
  ctx.quadraticCurveTo(rx, barY + barH, rx - rad, barY + barH)
  ctx.lineTo(lx + rad, barY + barH)
  ctx.quadraticCurveTo(lx, barY + barH, lx, barY + barH - rad)
  ctx.lineTo(lx, barY + rad)
  ctx.quadraticCurveTo(lx, barY, lx + rad, barY)
  ctx.closePath()
  ctx.fill()

  // 边框
  ctx.strokeStyle = combo >= 5 ? 'rgba(255,180,60,0.85)' : 'rgba(255,215,0,0.7)'
  ctx.lineWidth = (combo >= 5 ? 2.5 : 1.5) * S
  ctx.stroke()

  // 闪光条纹（高 combo）
  if (combo >= 3 && banner.timer < dur - 20) {
    ctx.save()
    ctx.clip()
    ctx.globalAlpha = 0.12
    var stripeX = lx + ((banner.timer * 4 * S) % (hw * 4)) - hw
    ctx.fillStyle = '#fff'
    ctx.beginPath()
    ctx.moveTo(stripeX, barY); ctx.lineTo(stripeX + 30 * S, barY)
    ctx.lineTo(stripeX + 15 * S, barY + barH); ctx.lineTo(stripeX - 15 * S, barY + barH)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }

  // 主文字（含 combo 数）
  ctx.globalAlpha = alpha
  var mainSize = (combo >= 5 ? 16 : 14) * S
  var pulse = combo >= 5 ? (1 + 0.04 * Math.sin(banner.timer * 0.2)) : 1
  ctx.fillStyle = '#fff'
  ctx.font = 'bold ' + (mainSize * pulse) + 'px "PingFang SC",sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3 * S
  ctx.fillText(combo + ' Combo！' + msg.main, W / 2, barY + barH * 0.38)

  // 副文字
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffecc0'
  ctx.font = (11 * S) + 'px "PingFang SC",sans-serif'
  ctx.fillText(msg.sub, W / 2, barY + barH * 0.72)

  ctx.restore()
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
  const isStage = g.battleMode === 'stage'
  const totalSlots = isStage ? Math.min(g.pets.length, 5) : 6
  const sidePad = 8*S
  const petGap = 8*S
  const wpnGap = 12*S
  const iconY = topY + (barH - iconSize) / 2
  const frameScale = 1.12
  const frameSize = iconSize * frameScale
  const frameOff = (frameSize - iconSize) / 2

  g._petBtnRects = []

  const stageTotalW = isStage ? (totalSlots * iconSize + (totalSlots - 1) * petGap) : 0
  const stageStartX = isStage ? (W - stageTotalW) / 2 : 0

  for (let i = 0; i < totalSlots; i++) {
    let ix
    if (isStage) {
      ix = stageStartX + i * (iconSize + petGap)
    } else if (i === 0) {
      ix = sidePad
    } else {
      ix = sidePad + iconSize + wpnGap + (i - 1) * (iconSize + petGap)
    }
    const cx = ix + iconSize * 0.5
    const cy = iconY + iconSize * 0.5

    if (i === 0 && !isStage) {
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
      R.drawWeaponFrame(ix, iconY, iconSize)
      g._weaponBtnRect = [ix, iconY, iconSize, iconSize]
    } else {
      // 宠物
      const petIdx = isStage ? i : i - 1
      const petFrame = petIdx < g.pets.length
        ? (framePetMap[g.pets[petIdx].attr] || framePetMap.metal)
        : framePetMap.metal

      if (petIdx < g.pets.length) {
        const p = g.pets[petIdx]
        const ac = ATTR_COLOR[p.attr]
        const ready = petHasSkill(p) && p.currentCd <= 0
        ctx.save()
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
        // 品质色边框（R/SR/SSR）
        const rv = RARITY_VISUAL[getPetRarity(p.id)] || RARITY_VISUAL.R
        ctx.save()
        ctx.strokeStyle = rv.borderColor
        ctx.lineWidth = 2 * S
        ctx.strokeRect(ix, iconY, iconSize, iconSize)
        ctx.restore()
        // ★ 星级标记（左下角，根据 STAR_VISUAL 着色）
        if ((p.star || 1) >= 1) {
          const pStar = p.star || 1
          const starText = '★'.repeat(pStar)
          const starClr = (STAR_VISUAL[pStar] || STAR_VISUAL[1]).color
          ctx.save()
          ctx.font = `bold ${iconSize * 0.14}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'
          ctx.strokeStyle = 'rgba(0,0,0,0.8)'; ctx.lineWidth = 2*S
          ctx.strokeText(starText, ix + 2*S, iconY + iconSize - 2*S)
          ctx.fillStyle = starClr
          ctx.fillText(starText, ix + 2*S, iconY + iconSize - 2*S)
          ctx.textBaseline = 'alphabetic'
          ctx.restore()
        }
        if (!ready && petHasSkill(p) && p.currentCd > 0) {
          // 有技能但冷却中 — 仅显示CD标记，不暗化头像
          ctx.save()
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
        if (ready) {
          const canAct = g.bState === 'playerTurn' && !g.dragging
          ctx.save()
          const glowColor2 = ac ? ac.main : TH.accent
          const t = g.af * 0.08  // 统一动画时间
          const pulse = 0.5 + 0.5 * Math.sin(t * 1.2)  // 慢脉冲

          // === 1. 持续旋转光环（围绕头像四角的光弧） ===
          const ringR = iconSize * 0.58
          const ringAngle = g.af * 0.03
          ctx.globalAlpha = canAct ? 0.6 + pulse * 0.3 : 0.4
          ctx.strokeStyle = glowColor2
          ctx.lineWidth = 2.5*S
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = 8*S
          for (let a = 0; a < 4; a++) {
            const startA = ringAngle + a * Math.PI * 0.5
            ctx.beginPath()
            ctx.arc(cx, cy, ringR, startA, startA + Math.PI * 0.3)
            ctx.stroke()
          }
          ctx.shadowBlur = 0

          // === 2. 粒子上升特效（4颗小光点沿头像边缘上升） ===
          if (canAct) {
            for (let pi = 0; pi < 4; pi++) {
              const pPhase = (g.af * 0.04 + pi * 0.25) % 1.0
              const pX = ix + iconSize * (0.15 + pi * 0.23)
              const pY = iconY + iconSize * (1.0 - pPhase)
              const pAlpha = pPhase < 0.7 ? 1.0 : (1.0 - pPhase) / 0.3
              const pSize = (2 + pulse * 1.5) * S
              ctx.globalAlpha = pAlpha * 0.8
              ctx.fillStyle = '#fff'
              ctx.beginPath(); ctx.arc(pX, pY, pSize, 0, Math.PI*2); ctx.fill()
              ctx.globalAlpha = pAlpha * 0.5
              ctx.fillStyle = glowColor2
              ctx.beginPath(); ctx.arc(pX, pY, pSize * 1.8, 0, Math.PI*2); ctx.fill()
            }
          }

          // === 3. 醒目双箭头（上方浮动） ===
          const arrowSize = iconSize * (canAct ? 0.26 : 0.2)
          const bounce = canAct ? Math.sin(t * 1.5) * 4*S : 0
          const arrowX = cx
          const arrowY1 = iconY - arrowSize - 3*S - bounce
          const arrowY2 = arrowY1 - arrowSize * 0.5

          ctx.globalAlpha = canAct ? 0.7 + pulse * 0.3 : 0.5
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = canAct ? 12*S : 6*S
          // 下层箭头
          ctx.fillStyle = glowColor2
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY1)
          ctx.lineTo(arrowX - arrowSize*0.7, arrowY1 + arrowSize*0.7)
          ctx.lineTo(arrowX + arrowSize*0.7, arrowY1 + arrowSize*0.7)
          ctx.closePath(); ctx.fill()
          // 上层箭头（更小、半透明，制造纵深感）
          if (canAct) {
            ctx.globalAlpha = 0.4 + pulse * 0.3
            ctx.beginPath()
            ctx.moveTo(arrowX, arrowY2)
            ctx.lineTo(arrowX - arrowSize*0.5, arrowY2 + arrowSize*0.5)
            ctx.lineTo(arrowX + arrowSize*0.5, arrowY2 + arrowSize*0.5)
            ctx.closePath(); ctx.fill()
          }
          // 箭头内白芯
          ctx.shadowBlur = 0
          ctx.globalAlpha = canAct ? 0.9 : 0.6
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY1 + arrowSize*0.15)
          ctx.lineTo(arrowX - arrowSize*0.4, arrowY1 + arrowSize*0.6)
          ctx.lineTo(arrowX + arrowSize*0.4, arrowY1 + arrowSize*0.6)
          ctx.closePath(); ctx.fill()

          // === 4. "技能" 文字提示标签（头像下方） ===
          if (canAct) {
            const lblW = iconSize * 0.7, lblH = iconSize * 0.2
            const lblX = cx - lblW/2, lblY = iconY + iconSize + 2*S
            ctx.globalAlpha = 0.85 + pulse * 0.15
            ctx.fillStyle = glowColor2
            ctx.shadowColor = glowColor2; ctx.shadowBlur = 6*S
            R.rr(lblX, lblY, lblW, lblH, 3*S); ctx.fill()
            ctx.shadowBlur = 0
            ctx.fillStyle = '#fff'
            ctx.font = `bold ${iconSize*0.13}px "PingFang SC",sans-serif`
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText('▲技能', cx, lblY + lblH/2)
          }

          // === 5. 强脉冲发光边框 ===
          const bw = canAct ? (2.5 + pulse * 1.5) * S : 2*S
          ctx.globalAlpha = canAct ? 0.6 + pulse * 0.35 : 0.45
          ctx.shadowColor = glowColor2
          ctx.shadowBlur = canAct ? (10 + pulse * 6) * S : 4*S
          ctx.strokeStyle = glowColor2
          ctx.lineWidth = bw
          ctx.strokeRect(ix - 2, iconY - 2, iconSize + 4, iconSize + 4)

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
      const P = V.P
      _debuffOC = P && P.createOffscreenCanvas ? P.createOffscreenCanvas({ type: '2d', width: iw, height: ih }) : null
      if (!_debuffOC) return null
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

// ===== 敌人 Buff/Debuff 视觉特效（重构版） =====
function _drawEnemyDebuffVFX(g, imgX, imgY, imgW, imgH, enemyImg) {
  const { ctx, R, S } = V
  const bufs = g.enemyBuffs
  const hasBuffs = bufs && bufs.length > 0
  const hasBreakDef = g.enemy && g.enemy.def === 0 && g.enemy.baseDef > 0
  if (!hasBuffs && !hasBreakDef) return
  if (g._enemyDeathAnim) return

  const af = g.af || 0
  const cx = imgX + imgW / 2
  const cy = imgY + imgH / 2

  // 分类检测
  const hasStun = hasBuffs && bufs.some(b => b.type === 'stun')
  const hasDot = hasBuffs && bufs.some(b => b.type === 'dot')
  const hasAtkBuff = hasBuffs && bufs.some(b => b.type === 'buff' && b.field === 'atk')
  const hasDefBuff = hasBuffs && bufs.some(b => b.type === 'buff' && b.field === 'def')
  const hasMirror = hasBuffs && bufs.some(b => b.type === 'bossMirror')
  const hasVulnerable = hasBuffs && bufs.some(b => b.type === 'vulnerable')

  // --- 1. 中毒/灼烧 ---
  if (hasDot) {
    const dots = bufs.filter(b => b.type === 'dot')
    const isBurn = dots.some(b => b.dotType === 'burn' || b.name === '灼烧')
    const isPoison = dots.some(b => b.dotType === 'poison' || (b.dotType !== 'burn' && b.name !== '灼烧'))

    ctx.save()
    if (isPoison) {
      const tintAlpha = 0.3 + 0.1 * Math.sin(af * 0.1)
      const oc = _getDebuffTintCanvas(enemyImg, imgW, imgH, '#00ff40')
      if (oc) {
        ctx.globalAlpha = tintAlpha
        ctx.drawImage(oc, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }
      // 底部毒雾
      const fogY = imgY + imgH * 0.7
      const fogH = imgH * 0.35
      const fogGrd = ctx.createLinearGradient(cx, fogY + fogH, cx, fogY)
      fogGrd.addColorStop(0, 'rgba(30,200,60,0.35)')
      fogGrd.addColorStop(0.5, 'rgba(30,200,60,0.15)')
      fogGrd.addColorStop(1, 'rgba(30,200,60,0)')
      ctx.fillStyle = fogGrd
      const fogWobble = Math.sin(af * 0.04) * 6 * S
      ctx.fillRect(imgX - 8 * S + fogWobble, fogY, imgW + 16 * S, fogH)
      // 毒液滴落粒子（更大更多）
      for (let i = 0; i < 10; i++) {
        const px = imgX + imgW * 0.1 + (i / 10) * imgW * 0.8
        const speed = 0.05 + (i % 4) * 0.015
        const py = imgY + imgH * 0.2 + ((af * speed + i * 31) % (imgH * 0.7))
        const pAlpha = 0.7 - ((af * speed + i * 31) % (imgH * 0.7)) / (imgH * 0.7) * 0.7
        const pSize = (3 + (i % 3) * 1.5) * S
        ctx.globalAlpha = pAlpha
        ctx.fillStyle = '#40ff60'
        ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#20cc40'
        ctx.globalAlpha = pAlpha * 0.5
        ctx.beginPath(); ctx.arc(px, py - pSize * 2.5, pSize * 0.7, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    if (isBurn) {
      const burnAlpha = 0.3 + 0.1 * Math.sin(af * 0.12)
      const oc = _getDebuffTintCanvas(enemyImg, imgW, imgH, '#ff4400')
      if (oc) {
        ctx.globalAlpha = burnAlpha
        ctx.drawImage(oc, imgX, imgY, imgW, imgH)
        ctx.globalAlpha = 1
      }
      // 底部橙色光晕
      const glowR = imgW * 0.45
      const glowY = imgY + imgH * 0.85
      const glowAlpha = 0.25 + 0.1 * Math.sin(af * 0.1)
      const grd = ctx.createRadialGradient(cx, glowY, 0, cx, glowY, glowR)
      grd.addColorStop(0, `rgba(255,120,20,${glowAlpha})`)
      grd.addColorStop(1, 'rgba(255,80,0,0)')
      ctx.fillStyle = grd
      ctx.beginPath(); ctx.arc(cx, glowY, glowR, 0, Math.PI * 2); ctx.fill()
      // 火焰粒子（更大更亮）
      for (let i = 0; i < 12; i++) {
        const baseX = imgX + imgW * 0.05 + (i / 12) * imgW * 0.9
        const speed = 0.07 + (i % 4) * 0.02
        const phase = (af * speed + i * 43) % (imgH * 0.8)
        const py = imgY + imgH - phase
        const pAlpha = 0.85 - phase / (imgH * 0.8) * 0.85
        const wobble = Math.sin(af * 0.15 + i * 2.3) * 5 * S
        const pSize = (3.5 + (i % 3) * 1.5) * S * (1 - phase / (imgH * 0.8) * 0.4)
        ctx.globalAlpha = pAlpha
        const colors = ['#ff4010', '#ff8020', '#ffbb30', '#ffdd60']
        ctx.fillStyle = colors[i % 4]
        ctx.beginPath(); ctx.arc(baseX + wobble, py, pSize, 0, Math.PI * 2); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    ctx.restore()
  }

  // --- 2. 眩晕：头顶旋转星星 + 晕圈 + 文字 ---
  if (hasStun) {
    ctx.save()
    const stunCx = cx
    const stunCy = imgY + imgH * 0.02
    const starCount = 5
    const orbitR = imgW * 0.28

    // 双层晕圈
    for (let layer = 0; layer < 2; layer++) {
      ctx.globalAlpha = (0.4 + 0.2 * Math.sin(af * 0.08 + layer)) * (layer === 0 ? 1 : 0.5)
      ctx.strokeStyle = layer === 0 ? '#ffee55' : '#ffcc22'
      ctx.lineWidth = (layer === 0 ? 2.5 : 1.5) * S
      ctx.beginPath()
      ctx.ellipse(stunCx, stunCy, orbitR * (1 + layer * 0.15), orbitR * 0.35 * (1 + layer * 0.15), 0, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 旋转星星（更大更亮）
    for (let i = 0; i < starCount; i++) {
      const angle = (af * 0.07) + (i / starCount) * Math.PI * 2
      const sx = stunCx + Math.cos(angle) * orbitR
      const sy = stunCy + Math.sin(angle) * orbitR * 0.35
      const starSize = (5 + Math.sin(af * 0.15 + i) * 1.5) * S
      ctx.globalAlpha = 0.85 + 0.15 * Math.sin(af * 0.12 + i * 1.5)
      ctx.fillStyle = i % 2 === 0 ? '#ffee44' : '#ffbb22'
      _drawStar(ctx, sx, sy, starSize)
      // 星星光晕
      ctx.globalAlpha = 0.3
      ctx.fillStyle = '#ffee44'
      ctx.beginPath(); ctx.arc(sx, sy, starSize * 1.8, 0, Math.PI * 2); ctx.fill()
    }

    // "眩晕" 文字
    ctx.globalAlpha = 0.7 + 0.2 * Math.sin(af * 0.1)
    ctx.fillStyle = '#ffee44'
    ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2 * S
    ctx.strokeText('眩晕', stunCx, stunCy - orbitR * 0.35 - 8 * S)
    ctx.fillText('眩晕', stunCx, stunCy - orbitR * 0.35 - 8 * S)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 3. 破甲（防御为0）---
  if (hasBreakDef) {
    ctx.save()
    const bkPulse = 0.7 + 0.3 * Math.sin(af * 0.12)
    ctx.globalAlpha = bkPulse

    const tagW = 46 * S, tagH = 18 * S
    const tagX = cx - tagW / 2
    const tagY = imgY + imgH - 6 * S

    // 标签背景
    ctx.fillStyle = 'rgba(200,30,30,0.85)'
    R.rr(tagX, tagY, tagW, tagH, 4 * S); ctx.fill()
    ctx.strokeStyle = 'rgba(255,100,100,0.6)'; ctx.lineWidth = 1.5 * S
    R.rr(tagX, tagY, tagW, tagH, 4 * S); ctx.stroke()

    ctx.fillStyle = '#fff'
    ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2 * S
    ctx.strokeText('破 防', cx, tagY + tagH / 2)
    ctx.fillText('破 防', cx, tagY + tagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 4. 攻击增益 buff：红色光晕 + 上升粒子 ---
  if (hasAtkBuff) {
    ctx.save()
    // 红色径向光晕（脉冲呼吸）
    const atkGlow = 0.2 + 0.12 * Math.sin(af * 0.1)
    const atkAuraR = Math.max(imgW, imgH) * 0.55
    const atkGrd = ctx.createRadialGradient(cx, cy, atkAuraR * 0.2, cx, cy, atkAuraR)
    atkGrd.addColorStop(0, `rgba(255,50,30,${atkGlow * 0.5})`)
    atkGrd.addColorStop(0.6, `rgba(255,40,40,${atkGlow})`)
    atkGrd.addColorStop(1, 'rgba(255,20,20,0)')
    ctx.fillStyle = atkGrd
    ctx.beginPath(); ctx.arc(cx, cy, atkAuraR, 0, Math.PI * 2); ctx.fill()

    // 上升红色能量粒子
    for (let i = 0; i < 6; i++) {
      const px = imgX + imgW * 0.15 + (i / 6) * imgW * 0.7
      const speed = 0.06 + (i % 3) * 0.02
      const phase = (af * speed + i * 53) % (imgH * 0.6)
      const py = imgY + imgH * 0.8 - phase
      const pAlpha = 0.6 - phase / (imgH * 0.6) * 0.6
      ctx.globalAlpha = pAlpha
      ctx.fillStyle = '#ff4040'
      const pSize = (2.5 + (i % 2)) * S
      ctx.beginPath(); ctx.arc(px, py, pSize, 0, Math.PI * 2); ctx.fill()
    }

    // "攻↑" 标签
    ctx.globalAlpha = 0.8 + 0.15 * Math.sin(af * 0.1)
    const atkTagW = 32 * S, atkTagH = 14 * S
    const atkTagX = imgX + imgW - atkTagW - 2 * S
    const atkTagY = imgY + 2 * S
    ctx.fillStyle = 'rgba(200,30,30,0.8)'
    R.rr(atkTagX, atkTagY, atkTagW, atkTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('攻↑', atkTagX + atkTagW / 2, atkTagY + atkTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 5. 防御增益 buff：蓝金盾形光环 ---
  if (hasDefBuff) {
    ctx.save()
    const defPulse = 0.3 + 0.15 * Math.sin(af * 0.08)
    // 蓝金色半透明椭圆护盾
    ctx.globalAlpha = defPulse
    const shieldRx = imgW * 0.55 + Math.sin(af * 0.06) * 3 * S
    const shieldRy = imgH * 0.5 + Math.sin(af * 0.06) * 2 * S
    ctx.strokeStyle = '#60aaff'
    ctx.lineWidth = 3 * S
    ctx.shadowColor = '#4090ff'; ctx.shadowBlur = 8 * S
    ctx.beginPath()
    ctx.ellipse(cx, cy, shieldRx, shieldRy, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.shadowBlur = 0
    // 内层金色薄环
    ctx.globalAlpha = defPulse * 0.6
    ctx.strokeStyle = '#ffd700'
    ctx.lineWidth = 1.5 * S
    ctx.beginPath()
    ctx.ellipse(cx, cy, shieldRx * 0.9, shieldRy * 0.9, 0, 0, Math.PI * 2)
    ctx.stroke()

    // "防↑" 标签
    ctx.globalAlpha = 0.8 + 0.15 * Math.sin(af * 0.1 + 1)
    const defTagW = 32 * S, defTagH = 14 * S
    const defTagX = imgX + 2 * S
    const defTagY = imgY + 2 * S
    ctx.fillStyle = 'rgba(40,100,200,0.8)'
    R.rr(defTagX, defTagY, defTagW, defTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('防↑', defTagX + defTagW / 2, defTagY + defTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 6. bossMirror（妖力护体/反弹）：紫色旋转护盾 ---
  if (hasMirror) {
    ctx.save()
    const mirrorBuf = bufs.find(b => b.type === 'bossMirror')
    const reflectPct = mirrorBuf ? (mirrorBuf.reflectPct || 30) : 30
    const mPulse = 0.35 + 0.15 * Math.sin(af * 0.09)
    const mR = Math.max(imgW, imgH) * 0.55

    // 旋转六边形护盾
    const segCount = 6
    const rotAngle = af * 0.03
    ctx.globalAlpha = mPulse
    ctx.strokeStyle = '#cc66ff'
    ctx.lineWidth = 2.5 * S
    ctx.shadowColor = '#aa44ff'; ctx.shadowBlur = 10 * S
    ctx.beginPath()
    for (let i = 0; i <= segCount; i++) {
      const a = rotAngle + (i / segCount) * Math.PI * 2
      const px = cx + Math.cos(a) * mR * 0.52
      const py = cy + Math.sin(a) * mR * 0.48
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.stroke()
    ctx.shadowBlur = 0

    // 闪烁顶点光点
    for (let i = 0; i < segCount; i++) {
      const a = rotAngle + (i / segCount) * Math.PI * 2
      const px = cx + Math.cos(a) * mR * 0.52
      const py = cy + Math.sin(a) * mR * 0.48
      ctx.globalAlpha = 0.5 + 0.4 * Math.sin(af * 0.15 + i * 1.2)
      ctx.fillStyle = '#dd88ff'
      ctx.beginPath(); ctx.arc(px, py, 3 * S, 0, Math.PI * 2); ctx.fill()
    }

    // "反弹X%" 标签
    ctx.globalAlpha = 0.85
    const mTagW = 46 * S, mTagH = 14 * S
    const mTagX = cx - mTagW / 2
    const mTagY = imgY + imgH + 2 * S
    ctx.fillStyle = 'rgba(140,50,200,0.8)'
    R.rr(mTagX, mTagY, mTagW, mTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#eeddff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`反弹${reflectPct}%`, cx, mTagY + mTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
    ctx.restore()
  }

  // --- 7. vulnerable（易伤）：黄色闪烁光晕 ---
  if (hasVulnerable) {
    ctx.save()
    const vPulse = 0.2 + 0.15 * Math.abs(Math.sin(af * 0.15))
    const vAuraR = Math.max(imgW, imgH) * 0.5
    const vGrd = ctx.createRadialGradient(cx, cy, vAuraR * 0.3, cx, cy, vAuraR)
    vGrd.addColorStop(0, `rgba(255,220,0,${vPulse * 0.4})`)
    vGrd.addColorStop(0.6, `rgba(255,200,0,${vPulse})`)
    vGrd.addColorStop(1, 'rgba(255,180,0,0)')
    ctx.fillStyle = vGrd
    ctx.beginPath(); ctx.arc(cx, cy, vAuraR, 0, Math.PI * 2); ctx.fill()

    // "易伤" 标签
    ctx.globalAlpha = 0.8
    const vTagW = 34 * S, vTagH = 14 * S
    const vTagX = cx - vTagW / 2
    const vTagY = imgY - vTagH - 2 * S
    ctx.fillStyle = 'rgba(200,160,0,0.8)'
    R.rr(vTagX, vTagY, vTagW, vTagH, 3 * S); ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('易伤', cx, vTagY + vTagH / 2)
    ctx.textBaseline = 'alphabetic'
    ctx.globalAlpha = 1
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

    // 图标（优先用图片，回退用文字缩写）
    const iconInfo = _getBuffIcon(R, it.buff)
    if (iconInfo.type === 'img') {
      const imgSz = iconSz * 0.7
      ctx.drawImage(iconInfo.img, leftX + (iconSz - imgSz)/2, iy + iconSz*0.06, imgSz, imgSz)
    } else {
      ctx.fillStyle = '#fff'; ctx.font = `bold ${8*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(it.label, leftX + iconSz/2, iy + iconSz*0.38)
      ctx.textBaseline = 'alphabetic'
    }
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

// ===== buff类型 → 图标图片路径映射 =====
const BUFF_ICON_IMG_MAP = {
  allAtkPct:       'assets/ui/battle/buff_icon_atk.png',
  allDmgPct:       'assets/ui/battle/buff_icon_atk.png',
  counterDmgPct:   'assets/ui/battle/buff_icon_atk.png',
  skillDmgPct:     'assets/ui/battle/buff_icon_atk.png',
  healNow:         'assets/ui/battle/buff_icon_heal.png',
  postBattleHeal:  'assets/ui/battle/buff_icon_heal.png',
  regenPerTurn:    'assets/ui/battle/buff_icon_heal.png',
  dmgReducePct:    'assets/ui/battle/buff_icon_def.png',
  nextDmgReduce:   'assets/ui/battle/buff_icon_def.png',
  grantShield:     'assets/ui/battle/buff_icon_def.png',
  immuneOnce:      'assets/ui/battle/buff_icon_def.png',
  comboDmgPct:     'assets/ui/battle/buff_icon_elim.png',
  elim3DmgPct:     'assets/ui/battle/buff_icon_elim.png',
  elim4DmgPct:     'assets/ui/battle/buff_icon_elim.png',
  elim5DmgPct:     'assets/ui/battle/buff_icon_elim.png',
  bonusCombo:      'assets/ui/battle/buff_icon_elim.png',
  extraTimeSec:    'assets/ui/battle/buff_icon_time.png',
  skillCdReducePct:'assets/ui/battle/buff_icon_time.png',
  resetAllCd:      'assets/ui/battle/buff_icon_time.png',
  hpMaxPct:        'assets/ui/battle/buff_icon_hp.png',
  enemyAtkReducePct:'assets/ui/battle/buff_icon_weaken.png',
  enemyHpReducePct:'assets/ui/battle/buff_icon_weaken.png',
  enemyDefReducePct:'assets/ui/battle/buff_icon_weaken.png',
  eliteAtkReducePct:'assets/ui/battle/buff_icon_weaken.png',
  eliteHpReducePct:'assets/ui/battle/buff_icon_weaken.png',
  bossAtkReducePct:'assets/ui/battle/buff_icon_weaken.png',
  bossHpReducePct: 'assets/ui/battle/buff_icon_weaken.png',
  nextStunEnemy:   'assets/ui/battle/buff_icon_weaken.png',
  stunDurBonus:    'assets/ui/battle/buff_icon_weaken.png',
  extraRevive:     'assets/ui/battle/buff_icon_special.png',
  skipNextBattle:  'assets/ui/battle/buff_icon_special.png',
  nextFirstTurnDouble:'assets/ui/battle/buff_icon_special.png',
  heartBoostPct:   'assets/ui/battle/buff_icon_special.png',
}

// emoji回退映射（图片未加载时使用）
const BUFF_ICON_MAP = {
  allAtkPct:       '⚔️', allDmgPct:       '⚔️',
  heartBoostPct:   '💗', comboDmgPct:     '🔥',
  elim3DmgPct:     '③', elim4DmgPct:     '④', elim5DmgPct:     '⑤',
  extraTimeSec:    '⏱️', regenPerTurn:    '💚', dmgReducePct:    '🛡️',
  enemyAtkReducePct:'👹', enemyHpReducePct:'👹', enemyDefReducePct:'👹',
  healNow:         '❤️‍🩹', postBattleHeal:  '💊',
  counterDmgPct:   '⚡', skillDmgPct:     '✨', skillCdReducePct:'⏳',
  bonusCombo:      '🔥', stunDurBonus:    '💫',
  eliteAtkReducePct:'💀', eliteHpReducePct:'💀',
  bossAtkReducePct:'👑', bossHpReducePct: '👑',
  nextDmgReduce:   '🛡️', extraRevive:     '♻️',
  grantShield:     '🛡️', resetAllCd:      '⏳', skipNextBattle:  '🚫',
  immuneOnce:      '✨', nextFirstTurnDouble:'⚔️', nextStunEnemy:   '💫',
}

// 获取buff图标：优先用图片，回退用emoji
function _getBuffIcon(R, buffKey) {
  const imgPath = BUFF_ICON_IMG_MAP[buffKey]
  if (imgPath) {
    const img = R.getImg(imgPath)
    if (img && img.width > 0) return { type: 'img', img }
  }
  return { type: 'emoji', emoji: BUFF_ICON_MAP[buffKey] || '✦' }
}

// ===== buff标签简短化 =====
function _shortBuffLabel(label) {
  return label
    .replace(/^\[速通\]\s*/, '')
    .replace(/全队/g, '')
    .replace(/持续本局/g, '')
    .replace(/永久/g, '')
}

// ===== 通关面板（第30层胜利后显示）=====
function _drawClearPanel(g) {
  const { ctx, R, TH, W, H, S } = V

  // 动画计时器
  if (g._clearPanelTimer == null) { g._clearPanelTimer = 0; g._clearParticles = [] }
  g._clearPanelTimer++
  const t = g._clearPanelTimer
  const fadeIn = Math.min(1, t / 30)

  // ── 全屏金色光芒背景 ──
  ctx.save()
  ctx.globalAlpha = fadeIn * 0.6
  const glow = ctx.createRadialGradient(W*0.5, H*0.3, 0, W*0.5, H*0.3, W*0.7)
  glow.addColorStop(0, 'rgba(255,215,0,0.4)')
  glow.addColorStop(0.4, 'rgba(255,180,0,0.15)')
  glow.addColorStop(1, 'rgba(255,215,0,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
  ctx.restore()

  // ── 金色粒子/星星 ──
  const particles = g._clearParticles
  if (t % 3 === 0 && particles.length < 40) {
    particles.push({
      x: Math.random() * W, y: H + 5,
      vx: (Math.random() - 0.5) * 1.5 * S,
      vy: -(1.5 + Math.random() * 2.5) * S,
      sz: (2 + Math.random() * 3) * S,
      alpha: 0.5 + Math.random() * 0.5,
      rot: Math.random() * Math.PI * 2,
      gold: Math.random() > 0.3,
    })
  }
  ctx.save()
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i]
    p.x += p.vx; p.y += p.vy; p.alpha -= 0.004; p.rot += 0.05
    if (p.alpha <= 0 || p.y < -20) { particles.splice(i, 1); continue }
    ctx.save()
    ctx.globalAlpha = p.alpha * fadeIn
    ctx.translate(p.x, p.y); ctx.rotate(p.rot)
    ctx.fillStyle = p.gold ? '#ffd700' : '#fff'
    // 四角星形状
    const sz = p.sz
    ctx.beginPath()
    ctx.moveTo(0, -sz); ctx.lineTo(sz*0.3, -sz*0.3)
    ctx.lineTo(sz, 0); ctx.lineTo(sz*0.3, sz*0.3)
    ctx.lineTo(0, sz); ctx.lineTo(-sz*0.3, sz*0.3)
    ctx.lineTo(-sz, 0); ctx.lineTo(-sz*0.3, -sz*0.3)
    ctx.closePath(); ctx.fill()
    ctx.restore()
  }
  ctx.restore()

  // ── 面板 ──
  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const innerPad = 16*S
  const petIconSz = 38*S
  const petNameH = 16*S
  const petRowH = petIconSz + petNameH + 6*S
  const wpnIconSz = 38*S
  const wpnRowH = wpnIconSz + 16*S + 6*S
  const statsH = 58*S
  const totalH = innerPad + 44*S + 28*S + 14*S + 20*S + petRowH + wpnRowH + 10*S + statsH + 14*S + 36*S + innerPad

  const panelY = Math.max(4*S, Math.floor((H - totalH) / 2))

  ctx.save()
  ctx.globalAlpha = fadeIn
  R.drawInfoPanel(panelX, panelY, panelW, totalH)

  // 金色边框光晕
  ctx.save()
  ctx.shadowColor = 'rgba(255,200,0,0.4)'; ctx.shadowBlur = 12*S
  ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 2*S
  R.rr(panelX, panelY, panelW, totalH, 12*S); ctx.stroke()
  ctx.restore()

  let curY = panelY + innerPad

  // ── 标题：金色大字 + 呼吸光效 ──
  const titleGlow = 0.3 + 0.2 * Math.sin(t * 0.06)
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = `rgba(255,200,0,${titleGlow})`; ctx.shadowBlur = 16*S
  ctx.fillStyle = '#D4A020'
  ctx.font = `bold ${24*S}px "PingFang SC",sans-serif`
  ctx.fillText('✦ 通天塔·通关 ✦', W*0.5, curY + 28*S)
  ctx.restore()
  curY += 44*S

  // 装饰分隔线
  const divLineW = panelW * 0.5
  ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divLineW/2, curY); ctx.lineTo(W*0.5 + divLineW/2, curY); ctx.stroke()
  curY += 6*S

  // 副标题
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8B6914'; ctx.font = `${13*S}px "PingFang SC",sans-serif`
  ctx.fillText('恭喜修士登顶通天塔！', W*0.5, curY + 14*S)
  curY += 28*S

  // 分割线
  ctx.strokeStyle = 'rgba(160,140,110,0.25)'; ctx.lineWidth = 0.5*S
  ctx.beginPath(); ctx.moveTo(panelX + innerPad, curY); ctx.lineTo(panelX + panelW - innerPad, curY); ctx.stroke()
  curY += 14*S

  // ── 通关阵容 ──
  ctx.fillStyle = '#A09080'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('通关阵容', W*0.5, curY + 12*S)
  curY += 20*S

  // 宠物列表
  if (g.pets && g.pets.length > 0) {
    const petCount = g.pets.length
    const petGap = 10*S
    const totalPetW = petCount * petIconSz + (petCount - 1) * petGap
    let px = (W - totalPetW) / 2
    for (let pi = 0; pi < petCount; pi++) {
      const p = g.pets[pi]
      const ac = ATTR_COLOR[p.attr]
      const showDelay = Math.max(0, t - 20 - pi * 8)
      const petAlpha = Math.min(1, showDelay / 10)
      const petScale = 0.6 + 0.4 * Math.min(1, showDelay / 8)
      ctx.save()
      ctx.globalAlpha = petAlpha
      const pcx = px + petIconSz/2, pcy = curY + petIconSz/2
      ctx.translate(pcx, pcy); ctx.scale(petScale, petScale); ctx.translate(-pcx, -pcy)
      ctx.fillStyle = ac ? ac.bg : '#E8E0D8'
      R.rr(px, curY, petIconSz, petIconSz, 5*S); ctx.fill()
      const petImg = R.getImg(getPetAvatarPath(p))
      if (petImg && petImg.width > 0) {
        ctx.save()
        ctx.beginPath(); R.rr(px+1, curY+1, petIconSz-2, petIconSz-2, 4*S); ctx.clip()
        const aw = petImg.width, ah = petImg.height
        const dw = petIconSz - 2, dh = dw * (ah / aw)
        ctx.drawImage(petImg, px+1, curY+1+(petIconSz-2-dh), dw, dh)
        ctx.restore()
      }
      ctx.strokeStyle = ac ? ac.border : '#C0A880'; ctx.lineWidth = 1.5*S
      R.rr(px, curY, petIconSz, petIconSz, 5*S); ctx.stroke()
      // 星级（根据 STAR_VISUAL 着色）
      const star = p.star || 1
      ctx.fillStyle = (STAR_VISUAL[star] || STAR_VISUAL[1]).color
      ctx.font = `${7*S}px sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('★'.repeat(star), px + petIconSz/2, curY + petIconSz + 9*S)
      // 名称
      ctx.fillStyle = '#5C4A3A'; ctx.font = `${8*S}px "PingFang SC",sans-serif`
      ctx.fillText(p.name, px + petIconSz/2, curY + petIconSz + 18*S)
      ctx.restore()
      px += petIconSz + petGap
    }
  }
  curY += petRowH

  // 法宝
  if (g.weapon) {
    const w = g.weapon
    const wx = (W - wpnIconSz) / 2
    ctx.fillStyle = '#1a1510'
    R.rr(wx, curY, wpnIconSz, wpnIconSz, 5*S); ctx.fill()
    const wpnImg = R.getImg(`assets/equipment/fabao_${w.id}.png`)
    if (wpnImg && wpnImg.width > 0) {
      ctx.save()
      ctx.beginPath(); R.rr(wx+1, curY+1, wpnIconSz-2, wpnIconSz-2, 4*S); ctx.clip()
      const dw = wpnIconSz - 2, dh = dw * (wpnImg.height / wpnImg.width)
      ctx.drawImage(wpnImg, wx+1, curY+1+(wpnIconSz-2-dh), dw, dh)
      ctx.restore()
    }
    R.drawWeaponFrame(wx, curY, wpnIconSz)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#8B6914'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.fillText(`法宝·${w.name}`, W*0.5, curY + wpnIconSz + 11*S)
  }
  curY += wpnRowH + 10*S

  // ── 战斗统计 ──
  ctx.strokeStyle = 'rgba(160,140,110,0.25)'; ctx.lineWidth = 0.5*S
  ctx.beginPath(); ctx.moveTo(panelX + innerPad, curY); ctx.lineTo(panelX + panelW - innerPad, curY); ctx.stroke()
  curY += 8*S

  const totalTurns = g.runTotalTurns || 0
  const petBagCount = (g.petBag || []).length
  const wpnBagCount = (g.weaponBag || []).length
  const buffCount = (g.runBuffLog || []).length

  ctx.save()
  ctx.fillStyle = 'rgba(255,245,220,0.06)'
  R.rr(panelX + innerPad, curY, panelW - innerPad*2, statsH - 16*S, 8*S); ctx.fill()

  const statsY = curY + 14*S
  const col1X = panelX + panelW * 0.25
  const col2X = panelX + panelW * 0.75

  ctx.textAlign = 'center'
  ctx.fillStyle = '#C09A40'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
  ctx.fillText(String(totalTurns), col1X, statsY)
  ctx.fillStyle = '#8B7B60'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('总回合数', col1X, statsY + 14*S)

  ctx.fillStyle = '#C09A40'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
  ctx.fillText(String(buffCount), col2X, statsY)
  ctx.fillStyle = '#8B7B60'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('获得增益', col2X, statsY + 14*S)
  ctx.restore()
  curY += statsH

  // ── 确认按钮 ──
  const btnW = (panelW - innerPad*2) * 0.6, confirmBtnH = 34*S
  const btnX = panelX + (panelW - btnW) / 2, btnY = curY
  R.drawDialogBtn(btnX, btnY, btnW, confirmBtnH, '查看结算', 'confirm')
  g._clearConfirmRect = [btnX, btnY, btnW, confirmBtnH]

  ctx.restore()
}

// ===== 胜利粒子系统 =====
let _victoryParticles = null
function _initVictoryParticles(cx, cy, S) {
  _victoryParticles = []
  for (let i = 0; i < 10; i++) {
    _victoryParticles.push({
      x: cx + (Math.random() - 0.5) * 200 * S,
      y: cy + 60 * S + Math.random() * 120 * S,
      speed: 0.3 + Math.random() * 0.5,
      size: (1.5 + Math.random() * 2) * S,
      alpha: Math.random(),
      phase: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.3 * S,
    })
  }
}
function _updateAndDrawParticles(ctx, S, cx, baseY, h) {
  if (!_victoryParticles) return
  for (const p of _victoryParticles) {
    p.y -= p.speed * S
    p.x += p.drift + Math.sin(p.phase) * 0.2 * S
    p.phase += 0.03
    p.alpha = 0.15 + 0.45 * Math.sin(p.phase * 2)
    if (p.y < baseY - 20 * S) {
      p.y = baseY + h + 10 * S
      p.x = cx + (Math.random() - 0.5) * 200 * S
    }
    ctx.save()
    ctx.globalAlpha = Math.max(0, p.alpha)
    ctx.fillStyle = '#ffd700'
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 4 * S
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}

// ===== 秘境胜利：等待死亡动画后自动结算 =====
function _handleStageVictory(g) {
  if (g._stageSettlePending) return
  if (g._enemyDeathAnim) return
  g._stageSettlePending = true
  const stageMgr = require('../engine/stageManager')
  stageMgr.settleStage(g)
}

// ===== 胜利弹窗（内嵌奖励选择）=====
function drawVictoryOverlay(g) {
  const { ctx, R, TH, W, H, S } = V

  // 秘境模式：跳过弹窗，等死亡动画结束后自动进入结算页
  if (g.battleMode === 'stage') {
    _handleStageVictory(g)
    return
  }

  // ==== 第30层（最终层）胜利：显示通关面板，不显示奖励 ====
  if (g.floor >= MAX_FLOOR) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,H)
    _drawClearPanel(g)
    return
  }

  // ==== 初始化胜利动画计时器 ====
  if (g._victoryAnimTimer == null) {
    g._victoryAnimTimer = 0
    _victoryParticles = null
  }
  g._victoryAnimTimer++
  const vt = g._victoryAnimTimer
  const animDuration = 30
  const enterDuration = 15

  const hasSpeed = g.lastSpeedKill
  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const innerPad = 18 * S

  // ==== 计算通关后即将获得的成长信息 ====
  const floor = g.floor
  const nextFL = floor + 1
  const curRealm = getRealmInfo(floor)
  const nextRealm = getRealmInfo(nextFL)
  const curRealmName = curRealm ? curRealm.name : '凡人'
  const nextRealmName = nextRealm ? nextRealm.name : curRealmName
  const realmChanged = nextRealmName !== curRealmName
  const hpUp = nextRealm ? nextRealm.hpUp : 0
  const curMaxHp = g.heroMaxHp
  const nextMaxHp = curMaxHp + hpUp
  let atkBonus = 0
  const curAtkPct = g.runBuffs ? g.runBuffs.allAtkPct : 0
  if (nextFL > 1 && nextFL % 5 === 1) {
    const tier = Math.floor((nextFL - 1) / 5)
    atkBonus = 10 + tier * 2
  }

  // ==== 成长信息行 ====
  const inRunLines = []
  const outRunLines = []
  const contentStart = Math.max(0, vt - enterDuration)
  const animProgress = Math.min(1, contentStart / animDuration)
  const easeP = 1 - Math.pow(1 - animProgress, 3)

  if (hpUp > 0) {
    const animVal = Math.round(curMaxHp + hpUp * easeP)
    inRunLines.push({ label: '血量上限', text: `${curMaxHp} → ${animVal}`, color: '#27864A', bold: true, hasAnim: true, from: curMaxHp, to: nextMaxHp, cur: animVal })
  }
  if (atkBonus > 0) {
    const animVal = Math.round((curAtkPct + atkBonus * easeP) * 10) / 10
    inRunLines.push({ label: '全队攻击', text: `${curAtkPct}% → ${animVal}%`, color: '#C06020', bold: true, hasAnim: true })
  }
  if (g.weapon && g.weapon.type === 'perFloorBuff' && nextFL > 1 && (nextFL - 1) % g.weapon.per === 0) {
    if (g.weapon.field === 'atk') {
      const curVal = curAtkPct + atkBonus
      const animVal = Math.round((curVal + g.weapon.pct * easeP) * 10) / 10
      inRunLines.push({ label: '法宝加成', text: `攻击 ${curVal}% → ${animVal}%`, color: '#8B6914', bold: true, hasAnim: true })
    } else if (g.weapon.field === 'hpMax') {
      const inc = Math.round(nextMaxHp * g.weapon.pct / 100)
      const animVal = Math.round(nextMaxHp + inc * easeP)
      inRunLines.push({ label: '法宝加成', text: `血量 ${nextMaxHp} → ${animVal}`, color: '#8B6914', bold: true, hasAnim: true })
    }
  }
  const floorExp = (g.runExp || 0) - (g._floorStartExp || 0)
  if (floorExp > 0) {
    const animExp = Math.round(floorExp * easeP)
    outRunLines.push({ label: '修炼经验', text: `+${animExp}`, color: '#5b48b0', bold: true, hasAnim: true, icon: 'assets/ui/icon_cult_exp.png' })
  }
  const soulStone = g._lastRunSoulStone || 0
  if (soulStone > 0) {
    const animSoulStone = Math.round(soulStone * easeP)
    outRunLines.push({ label: '灵石', text: `+${animSoulStone}`, color: '#2E9E6B', bold: true, hasAnim: true, icon: 'assets/ui/icon_soul_stone.png' })
  }

  const allLines = [...inRunLines, ...outRunLines]
  if (contentStart > 0 && contentStart <= animDuration && contentStart % 5 === 1 && allLines.some(l => l.hasAnim)) {
    MusicMgr.playNumberTick()
  }

  // ==== 布局计算 ====
  const titleH = 48 * S
  const dividerH = 12 * S
  const speedLineH = hasSpeed ? 30 * S : 0
  const growthLineH = 36 * S
  const sectionTitleH = 28 * S
  const sectionGap = 14 * S
  const hpBarSectionH = hpUp > 0 ? 42 * S : 0
  const inRunAreaH = inRunLines.length > 0 ? sectionTitleH + inRunLines.length * growthLineH + hpBarSectionH : 0
  const cultBarH = outRunLines.length > 0 ? 36 * S : 0
  const outRunAreaH = outRunLines.length > 0 ? sectionTitleH + outRunLines.length * growthLineH + cultBarH : 0
  const growthAreaH = inRunAreaH + (inRunAreaH > 0 && outRunAreaH > 0 ? sectionGap : 0) + outRunAreaH
  const tipH = 42 * S

  const totalH = innerPad * 1.5 + titleH + dividerH + speedLineH + growthAreaH + tipH + innerPad
  const panelCY = Math.floor(H / 2)
  const panelY = Math.max(4 * S, panelCY - totalH / 2)

  // ==== 入场动画 ====
  const enterP = Math.min(1, vt / enterDuration)
  const enterEase = 1 - Math.pow(1 - enterP, 3)
  const panelAlpha = enterEase
  const panelOffsetY = (1 - enterEase) * 30 * S

  // ===== 维度一：氛围层 =====
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(0, 0, W, H)

  ctx.save()
  ctx.globalAlpha = panelAlpha

  // 旋转金色光芒
  ctx.save()
  ctx.globalAlpha = panelAlpha * (0.06 + 0.03 * Math.sin(vt * 0.04))
  ctx.translate(W * 0.5, panelCY + panelOffsetY)
  ctx.rotate(vt * 0.003)
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6)
    ctx.beginPath(); ctx.moveTo(0, 0)
    ctx.lineTo(-14 * S, -H * 0.32); ctx.lineTo(14 * S, -H * 0.32)
    ctx.closePath(); ctx.fillStyle = '#ffd700'; ctx.fill()
  }
  ctx.restore()

  // 金色径向光晕
  const glowR = panelW * 0.7
  const glow = ctx.createRadialGradient(W * 0.5, panelCY + panelOffsetY, 0, W * 0.5, panelCY + panelOffsetY, glowR)
  glow.addColorStop(0, 'rgba(255,215,0,0.12)')
  glow.addColorStop(0.5, 'rgba(255,200,0,0.04)')
  glow.addColorStop(1, 'rgba(255,215,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)

  // 浮动金色粒子
  if (!_victoryParticles) _initVictoryParticles(W * 0.5, panelCY, S)
  _updateAndDrawParticles(ctx, S, W * 0.5, panelY + panelOffsetY, totalH)

  // ===== 维度二：使用统一面板组件 =====
  const py = panelY + panelOffsetY
  drawPanel(ctx, S, panelX, py, panelW, totalH, { ribbonH: 0 })

  // ===== 维度三：标题 + 排版 =====
  let curY = py + innerPad

  // 标题 — 深棕描边+暖金填色（浅色面板上更有质感）
  ctx.save()
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.font = `bold ${26 * S}px "PingFang SC",sans-serif`
  const titleCY = curY + titleH * 0.45
  ctx.save()
  ctx.strokeStyle = 'rgba(120,70,10,0.35)'
  ctx.lineWidth = 3 * S; ctx.lineJoin = 'round'
  ctx.strokeText('战斗胜利', W * 0.5, titleCY)
  ctx.restore()
  const titleGrd = ctx.createLinearGradient(W * 0.3, titleCY - 14 * S, W * 0.7, titleCY + 14 * S)
  titleGrd.addColorStop(0, '#a0720a')
  titleGrd.addColorStop(0.5, '#c8960e')
  titleGrd.addColorStop(1, '#8a6008')
  ctx.fillStyle = titleGrd
  ctx.shadowColor = 'rgba(180,140,40,0.3)'; ctx.shadowBlur = 8 * S
  ctx.fillText('战斗胜利', W * 0.5, titleCY)
  ctx.restore()
  curY += titleH

  // 装饰分割线 ───✦───
  const divCY = curY + dividerH * 0.4
  const divLineW = panelW * 0.22
  ctx.save()
  ctx.strokeStyle = 'rgba(175,135,48,0.45)'; ctx.lineWidth = 1 * S
  ctx.beginPath(); ctx.moveTo(W * 0.5 - divLineW, divCY); ctx.lineTo(W * 0.5 - 6 * S, divCY); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(W * 0.5 + 6 * S, divCY); ctx.lineTo(W * 0.5 + divLineW, divCY); ctx.stroke()
  ctx.fillStyle = '#af8730'
  ctx.beginPath()
  ctx.moveTo(W * 0.5, divCY - 3.5 * S)
  ctx.lineTo(W * 0.5 + 3.5 * S, divCY)
  ctx.lineTo(W * 0.5, divCY + 3.5 * S)
  ctx.lineTo(W * 0.5 - 3.5 * S, divCY)
  ctx.closePath(); ctx.fill()
  ctx.restore()
  curY += dividerH

  // 速通标签（说明具体额外奖励内容）
  if (hasSpeed) {
    const eventType = g.curEvent ? g.curEvent.type : 'battle'
    const bonusDesc = eventType === 'boss' || eventType === 'elite'
      ? '额外法宝选项' : '额外灵宠选项'
    const speedLine1 = `⚡ 速通达成 (${g.lastTurnCount}回合)`
    const speedLine2 = `奖励：${bonusDesc}（共4选1）`
    ctx.save()
    const sbh = 36 * S
    const sbw = panelW * 0.72
    const sbx = (W - sbw) / 2, sby = curY + (speedLineH - sbh) / 2 + 2 * S
    ctx.fillStyle = 'rgba(192,112,0,0.08)'
    R.rr(sbx, sby, sbw, sbh, 8 * S); ctx.fill()
    ctx.strokeStyle = 'rgba(192,112,0,0.3)'; ctx.lineWidth = 1 * S
    R.rr(sbx, sby, sbw, sbh, 8 * S); ctx.stroke()
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#a05800'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    ctx.fillText(speedLine1, W * 0.5, sby + sbh * 0.32)
    ctx.fillStyle = '#c87020'; ctx.font = `${9 * S}px "PingFang SC",sans-serif`
    ctx.fillText(speedLine2, W * 0.5, sby + sbh * 0.72)
    ctx.restore()
    curY += speedLineH
  }

  // ==== 成长信息区 ====
  const growthX = panelX + innerPad
  const iconColW = 30 * S
  const valueX = panelX + panelW - innerPad

  // 区块标题绘制（带左侧竖条装饰）
  function _drawSectionTitle(title, accentColor) {
    const midY = curY + sectionTitleH * 0.5
    ctx.fillStyle = accentColor
    R.rr(growthX, midY - 8 * S, 3 * S, 16 * S, 1.5 * S); ctx.fill()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#5a4a30'; ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    ctx.fillText(title, growthX + 8 * S, midY)
    ctx.save()
    ctx.strokeStyle = 'rgba(175,135,48,0.25)'; ctx.lineWidth = 1 * S
    ctx.setLineDash([3 * S, 3 * S])
    ctx.beginPath(); ctx.moveTo(growthX, curY + sectionTitleH - 2 * S); ctx.lineTo(valueX, curY + sectionTitleH - 2 * S); ctx.stroke()
    ctx.setLineDash([])
    ctx.restore()
    curY += sectionTitleH
  }

  // 数值行绘制（带回弹效果）
  function _drawGrowthLines(lines, lineDelay) {
    lines.forEach((line, idx) => {
      const midY = curY + growthLineH * 0.5
      // 逐行延迟入场
      const lineStart = Math.max(0, vt - enterDuration - idx * 3 - (lineDelay || 0))
      const lineAlpha = Math.min(1, lineStart / 8)
      if (lineAlpha <= 0) { curY += growthLineH; return }
      ctx.save()
      ctx.globalAlpha = panelAlpha * lineAlpha

      // 图标
      if (line.icon) {
        const iconSz = 26 * S
        const iconImg = R.getImg(line.icon)
        if (iconImg && iconImg.width > 0) {
          ctx.drawImage(iconImg, growthX, midY - iconSz / 2, iconSz, iconSz)
        }
      }

      // 标签
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#6b5d4d'
      ctx.font = `${12 * S}px "PingFang SC",sans-serif`
      ctx.fillText(line.label, growthX + iconColW, midY)

      // 数值（含回弹效果）
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
      ctx.fillStyle = line.color
      let valueFontSize = 14 * S
      if (line.hasAnim && animProgress >= 1) {
        const bounceFrame = contentStart - animDuration
        if (bounceFrame > 0 && bounceFrame < 8) {
          const bP = bounceFrame / 8
          const scale = 1 + 0.15 * Math.sin(bP * Math.PI)
          valueFontSize = 14 * S * scale
        }
      }
      ctx.font = `${line.bold ? 'bold ' : ''}${valueFontSize}px "PingFang SC",sans-serif`

      if (line.hasAnim && animProgress < 1) {
        ctx.save()
        ctx.shadowColor = line.color; ctx.shadowBlur = 8 * S
        ctx.fillText(line.text, valueX, midY)
        ctx.restore()
      } else {
        ctx.fillText(line.text, valueX, midY)
      }

      // 方向箭头
      if (line.hasAnim && animProgress > 0.5) {
        ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
        ctx.fillStyle = line.color
        ctx.globalAlpha = panelAlpha * lineAlpha * 0.6
        ctx.fillText(' ↑', valueX + 1 * S, midY - 1 * S)
      }

      ctx.restore()
      curY += growthLineH
    })
  }

  // ---- 局内加成区 ----
  if (inRunLines.length > 0) {
    _drawSectionTitle('本局加成', '#af8730')
    _drawGrowthLines(inRunLines, 0)

    // ==== 血条展示（升级版） ====
    if (hpUp > 0) {
      curY += 4 * S
      const hpBarW = panelW - innerPad * 3
      const hpBarX = panelX + innerPad * 1.5
      const hpBarH = 24 * S
      const heroHp = g.heroHp
      const animMaxHp = Math.round(curMaxHp + hpUp * easeP)
      const hpPct = Math.min(1, heroHp / animMaxHp)
      ctx.save()
      // 血条底
      ctx.fillStyle = 'rgba(80,60,30,0.15)'
      R.rr(hpBarX, curY, hpBarW, hpBarH, hpBarH / 2); ctx.fill()
      ctx.strokeStyle = 'rgba(80,60,30,0.2)'; ctx.lineWidth = 1 * S
      R.rr(hpBarX, curY, hpBarW, hpBarH, hpBarH / 2); ctx.stroke()
      // 当前血量填充
      const fillW = hpBarW * hpPct
      if (fillW > 0) {
        const hpGrd = ctx.createLinearGradient(hpBarX, curY, hpBarX, curY + hpBarH)
        hpGrd.addColorStop(0, '#5ddd5d')
        hpGrd.addColorStop(0.5, '#3cb83c')
        hpGrd.addColorStop(1, '#2a9a2a')
        ctx.fillStyle = hpGrd
        R.rr(hpBarX, curY, fillW, hpBarH, hpBarH / 2); ctx.fill()
        // 高光条
        ctx.globalAlpha = 0.3
        ctx.fillStyle = '#fff'
        R.rr(hpBarX + 2 * S, curY + 2 * S, fillW - 4 * S, hpBarH * 0.28, hpBarH / 2); ctx.fill()
        ctx.globalAlpha = 1
      }
      // 新增 HP 脉冲
      if (animProgress > 0 && animMaxHp > curMaxHp) {
        const newMaxPct = hpUp * easeP / animMaxHp
        const growStart = hpBarW * (1 - newMaxPct)
        const growW = hpBarW * newMaxPct
        if (growW > 0) {
          const pulseA = 0.35 + 0.25 * Math.sin(vt * 0.15)
          ctx.globalAlpha = pulseA
          ctx.fillStyle = '#ffa500'
          R.rr(hpBarX + growStart, curY, growW, hpBarH, hpBarH / 2); ctx.fill()
          // 动画结束闪白
          if (animProgress >= 1 && contentStart - animDuration < 6) {
            ctx.globalAlpha = 0.5 * (1 - (contentStart - animDuration) / 6)
            ctx.fillStyle = '#fff'
            R.rr(hpBarX + growStart, curY, growW, hpBarH, hpBarH / 2); ctx.fill()
          }
          ctx.globalAlpha = 1
        }
      }
      // 血条文字
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#fff'; ctx.font = `bold ${11 * S}px "PingFang SC",sans-serif`
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3 * S
      ctx.fillText(`${heroHp} / ${animMaxHp}`, hpBarX + hpBarW / 2, curY + hpBarH * 0.52)
      ctx.restore()
      ctx.restore()
      curY += hpBarH + 8 * S
    }
  }

  // ---- 局外加成区 ----
  if (outRunLines.length > 0) {
    if (inRunLines.length > 0) curY += sectionGap
    _drawSectionTitle('修炼收益', '#7c5cc5')
    _drawGrowthLines(outRunLines, inRunLines.length * 3)

    // ==== 修炼经验进度条 ====
    const cult = g.storage.cultivation
    if (cult && cult.level < CULT_MAX_LEVEL) {
      curY += 4 * S
      const needed = expToNextLevel(cult.level)
      const curExp = cult.exp || 0
      const expPct = needed > 0 && needed < Infinity ? Math.min(1, curExp / needed) : 0
      const barW = panelW - innerPad * 3
      const barX = panelX + innerPad * 1.5
      const barH = 18 * S
      const barR = barH / 2

      ctx.save()
      // 等级标签
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillStyle = '#7a6a55'
      ctx.font = `bold ${10 * S}px "PingFang SC",sans-serif`
      const lvText = `Lv.${cult.level}`
      const lvW = ctx.measureText(lvText).width
      ctx.fillText(lvText, barX, curY + barH * 0.5)

      // 进度条区域（紧跟等级标签后）
      const pBarX = barX + lvW + 6 * S
      const pBarW = barX + barW - pBarX

      // 进度条底色
      ctx.fillStyle = 'rgba(80,50,30,0.12)'
      R.rr(pBarX, curY, pBarW, barH, barR); ctx.fill()
      ctx.strokeStyle = 'rgba(80,50,30,0.15)'; ctx.lineWidth = 1 * S
      R.rr(pBarX, curY, pBarW, barH, barR); ctx.stroke()

      // 紫色进度填充
      const fillW = pBarW * expPct
      if (fillW > 1) {
        const expGrd = ctx.createLinearGradient(pBarX, curY, pBarX, curY + barH)
        expGrd.addColorStop(0, '#9b7fdf')
        expGrd.addColorStop(0.5, '#7c5cc5')
        expGrd.addColorStop(1, '#6345a8')
        ctx.fillStyle = expGrd
        R.rr(pBarX, curY, fillW, barH, barR); ctx.fill()
        // 高光条
        ctx.save()
        ctx.beginPath()
        R.rr(pBarX, curY, fillW, barH, barR); ctx.clip()
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        R.rr(pBarX + 2 * S, curY + 1.5 * S, fillW - 4 * S, barH * 0.32, barR); ctx.fill()
        ctx.restore()
      }

      // 经验数值文字
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      const pctText = `${curExp} / ${needed}`
      const expTextColor = fillW > pBarW * 0.4 ? '#fff' : '#7a6a55'
      ctx.fillStyle = expTextColor
      ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
      if (fillW > pBarW * 0.4) {
        ctx.save()
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 2 * S
        ctx.fillText(pctText, pBarX + pBarW / 2, curY + barH * 0.52)
        ctx.restore()
      } else {
        ctx.fillText(pctText, pBarX + pBarW / 2, curY + barH * 0.52)
      }

      ctx.restore()
      curY += barH + 4 * S
    }
  }

  // ===== 维度四：底部按钮 =====
  const isReady = vt > enterDuration + animDuration + 10
  if (isReady) {
    ctx.save()
    const btnW = panelW * 0.52, btnH = 38 * S
    const btnX = (W - btnW) / 2
    const btnY = py + totalH - innerPad - btnH + 4 * S
    const btnR = btnH / 2

    // 金色胶囊实体按钮
    const btnGrd = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
    btnGrd.addColorStop(0, '#e8c55a')
    btnGrd.addColorStop(0.45, '#d4a830')
    btnGrd.addColorStop(0.55, '#c49a28')
    btnGrd.addColorStop(1, '#a87d18')
    ctx.fillStyle = btnGrd
    ctx.shadowColor = 'rgba(180,140,40,0.4)'; ctx.shadowBlur = 8 * S
    R.rr(btnX, btnY, btnW, btnH, btnR); ctx.fill()
    ctx.shadowBlur = 0

    // 高光条
    ctx.save()
    ctx.beginPath()
    R.rr(btnX, btnY, btnW, btnH, btnR); ctx.clip()
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    R.rr(btnX + 4 * S, btnY + 2 * S, btnW - 8 * S, btnH * 0.35, btnR); ctx.fill()
    ctx.restore()

    // 边框
    ctx.strokeStyle = 'rgba(140,105,20,0.5)'; ctx.lineWidth = 1.5 * S
    R.rr(btnX, btnY, btnW, btnH, btnR); ctx.stroke()

    // 文字
    const arrowOff = 2 * S * Math.sin(vt * 0.08)
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = '#fff'
    ctx.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    ctx.save()
    ctx.shadowColor = 'rgba(100,60,0,0.4)'; ctx.shadowBlur = 2 * S
    ctx.fillText('选择奖励', W * 0.5 - 6 * S, btnY + btnH * 0.5)
    ctx.fillText('▸', W * 0.5 + 32 * S + arrowOff, btnY + btnH * 0.5)
    ctx.restore()
    ctx.restore()
  }

  ctx.restore()

  g._victoryTapReady = isReady
  g._rewardRects = null
  g._rewardConfirmRect = null
}

// NEW角标（右下角）
function _drawNewBadge(ctx, S, rx, ry) {
  const tw = 22*S, th = 11*S
  const tx = rx - tw, ty = ry - th
  ctx.save()
  const grad = ctx.createLinearGradient(tx, ty, tx, ty + th)
  grad.addColorStop(0, '#ff5252'); grad.addColorStop(1, '#d32f2f')
  ctx.fillStyle = grad
  ctx.beginPath()
  const r = th * 0.35
  ctx.moveTo(tx + r, ty); ctx.lineTo(tx + tw - r, ty)
  ctx.arcTo(tx + tw, ty, tx + tw, ty + r, r)
  ctx.lineTo(tx + tw, ty + th - r)
  ctx.arcTo(tx + tw, ty + th, tx + tw - r, ty + th, r)
  ctx.lineTo(tx + r, ty + th)
  ctx.arcTo(tx, ty + th, tx, ty + th - r, r)
  ctx.lineTo(tx, ty + r)
  ctx.arcTo(tx, ty, tx + r, ty, r)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${7*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('NEW', tx + tw/2, ty + th/2)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

// 速通角标
function _drawSpeedBadge(ctx, S, rx, ry) {
  const tw = 18*S, th = 11*S
  const tx = rx - tw, ty = ry - th + 2*S
  ctx.save()
  const grad = ctx.createLinearGradient(tx, ty, tx, ty + th)
  grad.addColorStop(0, '#f0a030'); grad.addColorStop(1, '#c07000')
  ctx.fillStyle = grad
  ctx.beginPath()
  const r = th * 0.35
  ctx.moveTo(tx + r, ty); ctx.lineTo(tx + tw - r, ty)
  ctx.arcTo(tx + tw, ty, tx + tw, ty + r, r)
  ctx.lineTo(tx + tw, ty + th - r)
  ctx.arcTo(tx + tw, ty + th, tx + tw - r, ty + th, r)
  ctx.lineTo(tx + r, ty + th)
  ctx.arcTo(tx, ty + th, tx, ty + th - r, r)
  ctx.lineTo(tx, ty + r)
  ctx.arcTo(tx, ty, tx + r, ty, r)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${7*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('⚡', tx + tw/2, ty + th/2)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

// 文字换行辅助（按实际像素宽度换行）
function _wrapTextBV(text, maxW, fontSize) {
  const S = V.S
  const fullW = fontSize * S
  const halfW = fontSize * S * 0.55
  const result = []
  let line = '', lineW = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const cw = ch.charCodeAt(0) > 127 ? fullW : halfW
    if (lineW + cw > maxW && line.length > 0) {
      result.push(line)
      line = ch; lineW = cw
    } else {
      line += ch; lineW += cw
    }
  }
  if (line) result.push(line)
  return result.length > 0 ? result : [text]
}

// ===== 道具选择菜单 =====
function _drawItemMenu(g) {
  const { ctx, R, TH, W, H, S } = V
  // 半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H)

  const menuW = W * 0.78
  const itemH = 64*S
  const padY = 14*S, padX = 14*S
  const gap = 10*S
  const titleH = 30*S
  const menuH = padY + titleH + itemH * 2 + gap + padY + 20*S
  const menuX = (W - menuW) / 2
  const menuY = (H - menuH) / 2

  // 手绘面板底板（不依赖图片）
  ctx.save()
  // 外层阴影
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16*S; ctx.shadowOffsetY = 4*S
  // 底板
  ctx.fillStyle = '#1a1410'
  R.rr(menuX, menuY, menuW, menuH, 10*S); ctx.fill()
  ctx.shadowColor = 'transparent'
  // 内层渐变
  const grad = ctx.createLinearGradient(menuX, menuY, menuX, menuY + menuH)
  grad.addColorStop(0, 'rgba(60,45,30,0.95)')
  grad.addColorStop(0.5, 'rgba(35,25,15,0.95)')
  grad.addColorStop(1, 'rgba(45,35,20,0.95)')
  ctx.fillStyle = grad
  R.rr(menuX + 2*S, menuY + 2*S, menuW - 4*S, menuH - 4*S, 9*S); ctx.fill()
  // 金色描边
  ctx.strokeStyle = '#c8a84e'; ctx.lineWidth = 2*S
  R.rr(menuX, menuY, menuW, menuH, 10*S); ctx.stroke()
  // 内描边
  ctx.strokeStyle = 'rgba(200,168,78,0.25)'; ctx.lineWidth = 1*S
  R.rr(menuX + 4*S, menuY + 4*S, menuW - 8*S, menuH - 8*S, 8*S); ctx.stroke()
  ctx.restore()

  // 标题
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'
  ctx.fillText('灵宝匣', W * 0.5, menuY + padY + 16*S)

  let cy = menuY + padY + titleH

  // 道具列表
  const items = [
    { key: 'reset', name: '乾坤重置', desc: '重排棋盘上所有灵珠', obtained: g.itemResetObtained, used: g.itemResetUsed, icon: 'assets/ui/battle/icon_item_reset.png', color: '#66ccff' },
    { key: 'heal',  name: '回春妙术', desc: '立即恢复全部气血', obtained: g.itemHealObtained, used: g.itemHealUsed, icon: 'assets/ui/battle/icon_item_heal.png', color: '#44ff88' },
  ]

  g._itemMenuRects = []

  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const iy = cy + i * (itemH + gap)
    const isUsed = it.used
    const isObtained = it.obtained && !it.used
    const isHealFull = it.key === 'heal' && g.heroHp >= g.heroMaxHp
    const isDisabled = isUsed || (isObtained && isHealFull)

    // 卡片背景
    ctx.save()
    ctx.globalAlpha = isDisabled ? 0.4 : 1.0
    ctx.fillStyle = 'rgba(40,30,20,0.85)'
    R.rr(menuX + padX, iy, menuW - padX*2, itemH, 8*S); ctx.fill()
    ctx.strokeStyle = isDisabled ? 'rgba(100,100,100,0.4)' : it.color
    ctx.lineWidth = 1.5*S
    R.rr(menuX + padX, iy, menuW - padX*2, itemH, 8*S); ctx.stroke()

    // 图标
    const iconSz = 42*S
    const iconX = menuX + padX + 10*S
    const iconY = iy + (itemH - iconSz) / 2
    const itemImg = R.getImg(it.icon)
    if (itemImg && itemImg.width > 0) {
      ctx.drawImage(itemImg, iconX, iconY, iconSz, iconSz)
    } else {
      ctx.fillStyle = it.color; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(it.key === 'reset' ? '🔄' : '💚', iconX + iconSz*0.5, iconY + iconSz*0.5)
      ctx.textBaseline = 'alphabetic'
    }
    // 已获取未使用：图标右上角红点"1"提醒
    if (isObtained && !isHealFull) {
      const dotSz = 10*S
      const dx = iconX + iconSz - dotSz*0.2, dy = iconY - dotSz*0.2
      ctx.fillStyle = '#e04040'
      ctx.beginPath(); ctx.arc(dx, dy, dotSz*0.5, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#fff'; ctx.font = `bold ${7*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('1', dx, dy)
      ctx.textBaseline = 'alphabetic'
    }

    // 名称
    const textX = iconX + iconSz + 10*S
    ctx.fillStyle = it.color; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(it.name, textX, iy + itemH * 0.38)

    // 描述
    ctx.fillStyle = '#bbb'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(it.desc, textX, iy + itemH * 0.62)

    // 状态标签
    ctx.textAlign = 'right'
    if (isUsed) {
      ctx.fillStyle = '#888'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      ctx.fillText('已使用', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
    } else if (isObtained) {
      if (isHealFull) {
        ctx.fillStyle = '#888'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('气血已满', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
      } else {
        ctx.fillStyle = '#44ff88'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.fillText('点击使用', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
      }
    } else {
      ctx.fillStyle = '#e8c870'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      ctx.fillText('分享获取', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
    }

    ctx.restore()

    if (!isDisabled) {
      const action = isObtained ? 'use' : 'obtain'
      g._itemMenuRects.push({ rect: [menuX + padX, iy, menuW - padX*2, itemH], key: it.key, action })
    }
  }

  // 关闭提示
  ctx.fillStyle = TH.dim; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击空白处关闭', W * 0.5, menuY + menuH - 10*S)
}

// 宠物/法宝详情浮层（从奖励选择弹窗中点击头像触发）
function _drawRewardDetailOverlay(g) {
  const { ctx, R, W, H, S } = V
  const detail = g._rewardDetailShow
  if (!detail) return

  // 深色遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H)

  const padX = 16*S, padY = 14*S
  const tipW = W * 0.84

  if (detail.type === 'pet') {
    const p = detail.data
    const ac = ATTR_COLOR[p.attr]
    const isNew = !!detail.isNew
    const lineH = 14*S
    const maxTextW = tipW - padX * 2

    // 已拥有时用实际拥有的宠物数据（含当前星级）
    const allOwned = [...(g.pets || []), ...(g.petBag || [])]
    const ownedPet = allOwned.find(op => op.id === p.id)
    const displayPet = isNew ? { ...p, star: 1 } : (ownedPet || p)
    const curStar = displayPet.star || 1
    const isMaxStar = curStar >= MAX_STAR
    const curAtk = getPetStarAtk(displayPet)
    const skillDesc = petHasSkill(displayPet) ? (getPetSkillDesc(displayPet) || (displayPet.skill ? displayPet.skill.desc : '')) : ''
    const descLines = skillDesc ? _wrapTextBV(skillDesc, maxTextW - 4*S, 10) : []

    // 下一级数据
    let nextAtk = 0, nextSkillDesc = '', nextDescLines = []
    if (!isMaxStar) {
      const nextPet = { ...displayPet, star: curStar + 1 }
      nextAtk = getPetStarAtk(nextPet)
      nextSkillDesc = petHasSkill(nextPet) ? (getPetSkillDesc(nextPet) || (displayPet.skill ? displayPet.skill.desc : '')) : ''
      nextDescLines = nextSkillDesc ? _wrapTextBV(nextSkillDesc, maxTextW - 4*S, 9) : []
    }

    // 头像尺寸
    const avSz = 36*S, avPad = 12*S

    // 预计算卡片高度
    let cardH = padY * 2
    const headerH = Math.max(avSz, 16*S + 16*S) + 4*S
    cardH += headerH
    cardH += 6*S
    cardH += lineH  // 技能标题+CD
    cardH += descLines.length * (lineH - 1*S)
    if (isNew && !petHasSkill(displayPet) && displayPet.skill) {
      cardH += lineH  // "二星技能预览："
      cardH += lineH  // 技能名+CD
      cardH += nextDescLines.length * (lineH - 1*S)  // 技能描述
    }
    if (!isNew && !isMaxStar) {
      cardH += 10*S   // 分割线上间距
      cardH += 2*S    // 分割线
      cardH += 10*S   // 分割线下间距
      cardH += lineH  // 下一级标题
      cardH += lineH  // 下一级ATK
      cardH += lineH  // 下一级技能标题
      cardH += nextDescLines.length * (lineH - 1*S)
    }
    cardH += 18*S  // 关闭提示
    cardH = Math.max(cardH, 120*S)

    const tipX = (W - tipW) / 2, tipY2 = (H - cardH) / 2
    const rad = 14*S
    R.drawInfoPanel(tipX, tipY2, tipW, cardH)

    ctx.save()
    ctx.beginPath(); R.rr(tipX, tipY2, tipW, cardH, rad); ctx.clip()

    let iy = tipY2 + padY
    const lx = tipX + padX

    // === 头像 ===
    const avX = lx, avY = iy
    ctx.fillStyle = ac ? ac.bg : '#E8E0D8'
    R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()
    const petAvatar = R.getImg(getPetAvatarPath(displayPet))
    if (petAvatar && petAvatar.width > 0) {
      ctx.save()
      ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
      const dw = avSz - 2, dh = dw * (petAvatar.height/petAvatar.width)
      ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
      ctx.restore()
    }

    // === 名称 + 星星 ===
    const txL = avX + avSz + avPad
    iy += 14*S
    ctx.textAlign = 'left'
    ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.fillText(displayPet.name, txL, iy)
    const nameW = ctx.measureText(displayPet.name).width
    const starStr = '★'.repeat(curStar) + (curStar < MAX_STAR ? '☆'.repeat(MAX_STAR - curStar) : '')
    ctx.fillStyle = '#C89510'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(starStr, txL + nameW + 6*S, iy)
    if (isNew) {
      const newTxt = 'NEW'
      ctx.fillStyle = '#ff5252'; ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      const starW = ctx.measureText(starStr).width
      ctx.fillText(newTxt, txL + nameW + 6*S + starW + 6*S, iy)
    }

    // === 属性珠 + ATK ===
    iy += 16*S
    const orbR = 5*S
    R.drawBead(txL + orbR, iy - 3*S, orbR, displayPet.attr, 0)
    const atkLabel = ' ATK：'
    ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(atkLabel, txL + orbR*2 + 4*S, iy)
    const atkLabelW = ctx.measureText(atkLabel).width
    ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(String(curAtk), txL + orbR*2 + 4*S + atkLabelW, iy)

    iy = Math.max(iy, avY + avSz)
    iy += 6*S

    // === 技能 ===
    iy += lineH
    if (petHasSkill(displayPet)) {
      const skillTitle = `技能：${displayPet.skill.name}`
      ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(skillTitle, lx, iy)
      const skillTitleW = ctx.measureText(skillTitle).width
      ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(`CD ${displayPet.cd}`, lx + skillTitleW + 6*S, iy)
      descLines.forEach(line => {
        iy += lineH - 1*S
        ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(line, lx + 4*S, iy)
      })
    } else {
      ctx.fillStyle = '#8B7B70'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText('技能：升至★2解锁', lx, iy)
      // NEW宠物：展示★2解锁后的具体技能描述
      if (isNew && displayPet.skill) {
        iy += lineH
        ctx.fillStyle = '#8B7B70'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText('二星技能预览：', lx, iy)
        iy += lineH
        const unlockTitle = `${displayPet.skill.name}`
        ctx.fillStyle = '#4A3B30'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(unlockTitle, lx + 4*S, iy)
        const unlockTitleW = ctx.measureText(unlockTitle).width
        ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`CD ${displayPet.cd}`, lx + 4*S + unlockTitleW + 6*S, iy)
        nextDescLines.forEach(line => {
          iy += lineH - 1*S
          ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'
          ctx.fillText(line, lx + 8*S, iy)
        })
      }
    }

    // === 已拥有宠物：显示升星后信息 ===
    if (!isNew && !isMaxStar) {
      iy += 10*S
      ctx.strokeStyle = 'rgba(160,140,100,0.3)'; ctx.lineWidth = 1*S
      ctx.beginPath(); ctx.moveTo(lx, iy); ctx.lineTo(tipX + tipW - padX, iy); ctx.stroke()
      iy += 2*S + 10*S

      // "升星后 ★X" 标题
      iy += lineH
      const nextStarLabel = `选择后即将升星 ${'★'.repeat(curStar + 1)}`
      ctx.fillStyle = '#8B6E4E'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'
      ctx.fillText(nextStarLabel, lx, iy)

      // 下一级ATK
      iy += lineH
      const nAtkLabel = 'ATK：'
      const atkChanged = nextAtk !== curAtk
      ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(nAtkLabel, lx, iy)
      const nAtkLabelW = ctx.measureText(nAtkLabel).width
      ctx.fillStyle = atkChanged ? '#c06020' : '#4A3B30'
      ctx.font = atkChanged ? `bold ${10*S}px "PingFang SC",sans-serif` : `${10*S}px "PingFang SC",sans-serif`
      ctx.fillText(String(nextAtk), lx + nAtkLabelW, iy)

      // 下一级技能
      const nextPetFake = { ...displayPet, star: curStar + 1 }
      const nextHasSkill = petHasSkill(nextPetFake)
      const curHasSkill = petHasSkill(displayPet)
      if (nextHasSkill && !curHasSkill) {
        iy += lineH
        const nextSkillTitle = `解锁技能：${displayPet.skill.name}`
        ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(nextSkillTitle, lx, iy)
        const nextSkillTitleW = ctx.measureText(nextSkillTitle).width
        ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`CD ${displayPet.cd}`, lx + nextSkillTitleW + 6*S, iy)
        nextDescLines.forEach(line => {
          iy += lineH - 1*S
          ctx.fillStyle = '#c06020'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'left'
          ctx.fillText(line, lx + 4*S, iy)
        })
      } else if (nextHasSkill) {
        iy += lineH
        const nextSkillTitle = `技能：${displayPet.skill ? displayPet.skill.name : '无'}`
        ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'left'
        ctx.fillText(nextSkillTitle, lx, iy)
        const nextSkillTitleW = ctx.measureText(nextSkillTitle).width
        ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`CD ${displayPet.cd}`, lx + nextSkillTitleW + 6*S, iy)
        const descChanged = nextSkillDesc !== skillDesc
        nextDescLines.forEach(line => {
          iy += lineH - 1*S
          if (descChanged) {
            ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
          } else {
            ctx.fillStyle = '#4A3B30'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          }
          ctx.textAlign = 'left'
          ctx.fillText(line, lx + 4*S, iy)
        })
      }
    }

    ctx.restore()
    ctx.fillStyle = '#9B8B80'; ctx.font = `${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY2 + cardH - 6*S)

  } else if (detail.type === 'weapon') {
    const w = detail.data
    const lineH = 18*S, smallLineH = 15*S
    let lines = []
    lines.push({ text: w.name, color: '#8B6914', bold: true, size: 14, h: lineH + 2*S, wpnPrefix: true })
    lines.push({ text: '', size: 0, h: 4*S })
    if (w.desc) {
      const descLines = _wrapTextBV(w.desc, tipW - padX*2 - 8*S, 11)
      descLines.forEach(dl => lines.push({ text: dl, color: '#3D2B1F', size: 11, h: smallLineH }))
    }
    if (w.attr) {
      lines.push({ text: '', size: 0, h: 3*S })
      lines.push({ text: `对应属性：${ATTR_NAME[w.attr] || w.attr}`, color: '#6B5B50', size: 10, h: smallLineH, attrOrb: w.attr })
    }

    let totalH = padY * 2 + 18*S
    lines.forEach(l => totalH += l.h)
    const tipX = (W - tipW) / 2, tipY = (H - totalH) / 2
    const rad = 14*S
    R.drawInfoPanel(tipX, tipY, tipW, totalH)

    ctx.save()
    ctx.beginPath(); R.rr(tipX, tipY, tipW, totalH, rad); ctx.clip()

    let curY = tipY + padY
    ctx.textAlign = 'left'
    lines.forEach(l => {
      if (l.size === 0) { curY += l.h; return }
      curY += l.h
      ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
      let tx = tipX + padX
      if (l.wpnPrefix) {
        const pfx = '法宝·'
        ctx.fillStyle = '#e0a020'
        ctx.fillText(pfx, tx, curY - 4*S)
        tx += ctx.measureText(pfx).width
      }
      ctx.fillStyle = l.color || '#3D2B1F'
      if (l.attrOrb) {
        const orbR = 5*S, orbX = tx + orbR, orbY = curY - 4*S - orbR*0.4
        R.drawBead(orbX, orbY, orbR, l.attrOrb, 0)
        ctx.fillText(l.text.replace(`__ATTR_ORB__${l.attrOrb}`, ''), orbX + orbR + 4*S, curY - 4*S)
      } else {
        ctx.fillText(l.text, tx, curY - 4*S)
      }
    })
    ctx.restore()
    ctx.fillStyle = '#9B8B80'; ctx.font = `${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 6*S)

  } else if (detail.type === 'buff') {
    // ===== Buff加成详情弹窗 =====
    const buffData = detail.data || {}
    const buffKey = buffData.buff || ''
    const label = detail.label || buffData.label || '加成'
    const val = buffData.val || 0
    const lineH = 16*S

    // 格式化数值显示
    let valText = ''
    if (buffKey === 'extraTimeSec') valText = `+${val.toFixed ? val.toFixed(1) : val} 秒`
    else if (['bonusCombo','stunDurBonus','extraRevive','regenPerTurn'].includes(buffKey)) valText = `+${val}`
    else if (['healNow','postBattleHeal','grantShield'].includes(buffKey)) valText = `${val}${buffKey === 'grantShield' ? ' 点护盾' : '% 血量'}`
    else if (['skipNextBattle','resetAllCd','immuneOnce','nextFirstTurnDouble','nextStunEnemy'].includes(buffKey)) valText = '一次性效果'
    else valText = `+${val}%`

    // buff类别名称
    const BUFF_CATEGORY = {
      allAtkPct:'攻击强化', allDmgPct:'攻击强化', counterDmgPct:'攻击强化', skillDmgPct:'攻击强化',
      healNow:'生命回复', postBattleHeal:'生命回复', regenPerTurn:'生命回复',
      dmgReducePct:'防御减伤', nextDmgReduce:'防御减伤', grantShield:'防御减伤', immuneOnce:'防御减伤',
      comboDmgPct:'消除增幅', elim3DmgPct:'消除增幅', elim4DmgPct:'消除增幅', elim5DmgPct:'消除增幅', bonusCombo:'消除增幅',
      extraTimeSec:'时间操控', skillCdReducePct:'时间操控', resetAllCd:'时间操控',
      hpMaxPct:'血量强化',
      enemyAtkReducePct:'削弱敌人', enemyHpReducePct:'削弱敌人', eliteAtkReducePct:'削弱敌人',
      eliteHpReducePct:'削弱敌人', bossAtkReducePct:'削弱敌人', bossHpReducePct:'削弱敌人',
      nextStunEnemy:'削弱敌人', stunDurBonus:'削弱敌人',
      extraRevive:'特殊效果', skipNextBattle:'特殊效果', nextFirstTurnDouble:'特殊效果', heartBoostPct:'特殊效果',
    }
    const category = BUFF_CATEGORY[buffKey] || '加成'
    const catColors = {
      '攻击强化':'#c06020', '生命回复':'#2d8a4e', '防御减伤':'#3a6aaa',
      '消除增幅':'#b88a20', '时间操控':'#7a5aaa', '血量强化':'#2d8a4e',
      '削弱敌人':'#7a4aaa', '特殊效果':'#b8881e',
    }
    const catColor = catColors[category] || '#6B5B50'

    // 描述文字
    const BUFF_DESC = {
      allAtkPct:'全队消除攻击伤害按百分比提升', allDmgPct:'全队所有伤害按百分比提升',
      counterDmgPct:'五行克制额外伤害提升', skillDmgPct:'灵兽技能伤害提升',
      healNow:'立即回复当前最大血量的一定比例', postBattleHeal:'每场战斗胜利后回复一定比例血量',
      regenPerTurn:'每回合结算后自动回复固定生命值',
      dmgReducePct:'受到所有伤害降低（永久生效）', nextDmgReduce:'下一场战斗受到伤害降低（单场）',
      grantShield:'立即获得护盾，吸收等量伤害', immuneOnce:'免疫下一次敌方控制技能',
      comboDmgPct:'Combo连击倍率额外加成', elim3DmgPct:'3消基础伤害倍率提升',
      elim4DmgPct:'4消伤害倍率提升', elim5DmgPct:'5消伤害倍率提升',
      bonusCombo:'每回合首次消除额外增加连击数',
      extraTimeSec:'转珠操作时间增加', skillCdReducePct:'灵兽技能冷却回合缩短',
      resetAllCd:'立即重置所有灵兽技能冷却',
      hpMaxPct:'主角最大血量按百分比提升（立即生效）',
      enemyAtkReducePct:'所有怪物攻击力降低', enemyHpReducePct:'所有怪物血量降低',
      eliteAtkReducePct:'精英怪攻击力降低', eliteHpReducePct:'精英怪血量降低',
      bossAtkReducePct:'BOSS攻击力降低', bossHpReducePct:'BOSS血量降低',
      nextStunEnemy:'下一场战斗敌人开局眩晕', stunDurBonus:'5消眩晕效果延长回合数',
      extraRevive:'获得额外复活机会', skipNextBattle:'直接跳过下一场普通战斗',
      nextFirstTurnDouble:'下场战斗首回合伤害翻倍', heartBoostPct:'心珠回复效果提升',
    }
    const desc = BUFF_DESC[buffKey] || '全队永久生效'
    const descLines = _wrapTextBV(desc, tipW - padX*2, 10)

    // 计算卡片高度（无图标，无单独数值行）
    let cardH = padY * 2
    cardH += lineH  // 类别
    cardH += lineH + 4*S  // 名称（含高亮数值）
    cardH += 6*S    // 分割线
    cardH += descLines.length * (lineH - 2*S)  // 描述
    cardH += 20*S   // 关闭提示
    cardH = Math.max(cardH, 80*S)

    const tipX = (W - tipW) / 2, tipY = (H - cardH) / 2
    const rad = 14*S
    R.drawInfoPanel(tipX, tipY, tipW, cardH)

    ctx.save()
    ctx.beginPath(); R.rr(tipX, tipY, tipW, cardH, rad); ctx.clip()

    let iy = tipY + padY
    const lx = tipX + padX

    // 类别标签（不再显示图标）
    ctx.textAlign = 'center'
    ctx.fillStyle = catColor; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(category, W/2, iy)
    iy += lineH

    // 名称（数值部分用醒目颜色高亮）
    const nameText = label.replace(/^\[速通\]\s*/, '')
    const numMatch = nameText.match(/(.*?)([\+\-－＋]?\d+[\.\d]*%?\s*[^\d]*)$/)
    if (numMatch && numMatch[2]) {
      // 拆分：前半段普通色 + 后半段(含数值)高亮
      const prefix = numMatch[1]
      const numPart = numMatch[2]
      ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      const prefixW = ctx.measureText(prefix).width
      const numW = ctx.measureText(numPart).width
      const totalW = prefixW + numW
      const startX = W/2 - totalW/2
      ctx.textAlign = 'left'
      ctx.fillStyle = '#3D2B1F'
      ctx.fillText(prefix, startX, iy)
      // 数值部分：醒目大字 + 发光
      ctx.save()
      ctx.shadowColor = catColor; ctx.shadowBlur = 6*S
      ctx.fillStyle = catColor; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      ctx.fillText(numPart, startX + prefixW, iy)
      ctx.restore()
      ctx.textAlign = 'center'
    } else {
      ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
      ctx.fillText(nameText, W/2, iy)
    }
    iy += lineH + 4*S

    // 分割线
    ctx.strokeStyle = 'rgba(160,140,100,0.25)'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.moveTo(lx, iy); ctx.lineTo(tipX + tipW - padX, iy); ctx.stroke()
    iy += 6*S

    // 描述
    descLines.forEach(line => {
      iy += lineH - 2*S
      ctx.fillStyle = '#5C4A3A'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(line, W/2, iy)
    })

    ctx.restore()
    ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('点击任意位置关闭', W*0.5, tipY + cardH - 6*S)
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
  ctx.fillText('分享给好友，获得满血复活！', W*0.5, panelY + 72*S)
  ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`当前第 ${g.floor} 层，复活后从本层继续挑战`, W*0.5, panelY + 98*S)
  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('每轮仅有一次分享复活机会', W*0.5, panelY + 116*S)
  const btnW = panelW * 0.7, btnH = 44*S
  const btnX = (W - btnW) / 2, btnY = panelY + 140*S
  R.drawDialogBtn(btnX, btnY, btnW, btnH, '📤 分享复活', 'confirm')
  g._adReviveBtnRect = [btnX, btnY, btnW, btnH]
  const skipW = panelW * 0.5, skipH = 36*S
  const skipX = (W - skipW) / 2, skipY = panelY + 196*S
  R.drawDialogBtn(skipX, skipY, skipW, skipH, '放弃治疗', 'cancel')
  g._adReviveSkipRect = [skipX, skipY, skipW, skipH]
}

// ===== 教学引导覆盖层 =====
function drawTutorialOverlay(g) {
  if (!tutorial.isActive()) return
  const { ctx, R, TH, W, H, S } = V
  const data = tutorial.getGuideData()
  if (!data) return

  // ---- 跳过按钮（非总结页时显示，放在战斗背景右下角） ----
  if (!data.isSummary) {
    const skipW = 76*S, skipH = 34*S, skipR = 8*S
    // 放在棋盘上方区域的右下角（紧贴棋盘上边）
    const boardTop = g.boardY || H * 0.55
    const skipX = W - skipW - 10*S, skipY = boardTop - skipH - 8*S
    ctx.save()
    // 半透明渐变背景
    const skipGrd = ctx.createLinearGradient(skipX, skipY, skipX + skipW, skipY + skipH)
    skipGrd.addColorStop(0, 'rgba(60,50,40,0.85)')
    skipGrd.addColorStop(1, 'rgba(40,30,25,0.9)')
    ctx.fillStyle = skipGrd
    R.rr(skipX, skipY, skipW, skipH, skipR); ctx.fill()
    // 金色边框
    ctx.strokeStyle = 'rgba(255,200,80,0.6)'; ctx.lineWidth = 1.5*S
    R.rr(skipX, skipY, skipW, skipH, skipR); ctx.stroke()
    // 跳过文字 + 箭头图标
    ctx.fillStyle = '#ffd080'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('跳过 ▶', skipX + skipW/2, skipY + skipH/2)
    ctx.restore()
    // 存储按钮位置供触摸检测
    g._tutorialSkipRect = [skipX, skipY, skipW, skipH]
  }

  // ---- 总结页 ----
  if (data.isSummary) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H)
    const panelW = W * 0.82, panelH = 285*S
    const panelX = (W - panelW) / 2, panelY = (H - panelH) / 2
    R.drawInfoPanel(panelX, panelY, panelW, panelH)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#C07000'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('修仙要诀', W*0.5, panelY + 36*S)

    const tips = [
      '① 按住拖动灵珠，沿途交换排列三连消除',
      '② Combo越多，伤害越高',
      '③ 克制x2.5伤害，被克x0.5伤害',
      '④ 上划释放宠物技能',
      '⑤ 粉色心珠可回复生命',
      '⑥ 法宝自动生效，给你额外的战斗优势',
    ]
    ctx.fillStyle = '#3D2B1F'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    tips.forEach((t, i) => {
      ctx.fillText(t, W*0.5, panelY + 66*S + i * 24*S)
    })

    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    const pulse = 0.6 + 0.4 * Math.sin(g.af * 0.08)
    ctx.globalAlpha = pulse
    ctx.fillText('大道已明，开始通天之旅！', W*0.5, panelY + panelH - 30*S)
    ctx.globalAlpha = 1.0

    ctx.fillStyle = '#8B7B70'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.fillText('点击屏幕继续', W*0.5, panelY + panelH - 10*S)
    return
  }

  // ---- preIntro阶段：代入式故事卡 ----
  if (data.phase === 'preIntro') {
    const card = data.storyCards[data.storyPage]
    if (!card) return
    const alpha = data.storyAlpha
    ctx.save()
    // 全屏暗底
    ctx.globalAlpha = alpha * 0.75
    ctx.fillStyle = '#0a0814'
    ctx.fillRect(0, 0, W, H)

    // 面板
    const pw = W * 0.86, ph = 300 * S
    const px = (W - pw) / 2, py = (H - ph) / 2 - 20 * S
    ctx.globalAlpha = alpha
    const _ribbonH = 44 * S

    const { ribbonCY } = drawPanel(ctx, S, px, py, pw, ph, { ribbonH: _ribbonH })
    drawRibbonIcon(ctx, S, px, ribbonCY, card.icon || '★')

    // 标题
    ctx.fillStyle = '#3a1a00'
    ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(card.heading, W / 2 + 12 * S, ribbonCY)

    // 正文行
    const lineH = 28 * S
    const textStartY = py + _ribbonH + 28 * S
    ctx.fillStyle = '#4a3820'
    ctx.font = `${13 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ;(card.lines || []).forEach((line, i) => {
      ctx.fillText(line, W / 2, textStartY + i * lineH)
    })

    // 备注行
    if (card.note) {
      const noteY = textStartY + (card.lines || []).length * lineH + 16 * S
      ctx.fillStyle = '#b06010'
      ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
      ctx.fillText(card.note, W / 2, noteY)
    }

    // 翻页进度点
    const total = data.storyCards.length
    if (total > 1) {
      const dotR = 4 * S, dotGap = 14 * S
      const dotsW = total * dotGap
      const dotsX = W / 2 - dotsW / 2 + dotGap / 2
      const dotsY = py + ph - 38 * S
      for (let i = 0; i < total; i++) {
        ctx.beginPath()
        ctx.arc(dotsX + i * dotGap, dotsY, dotR, 0, Math.PI * 2)
        ctx.fillStyle = i === data.storyPage ? '#c07820' : 'rgba(160,120,40,0.3)'
        ctx.fill()
      }
    }

    // 点击继续提示
    const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.1)
    ctx.globalAlpha = alpha * (0.5 + 0.4 * pulse)
    ctx.fillStyle = '#8a6030'
    ctx.font = `${10 * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const isLast = data.storyPage >= total - 1
    ctx.fillText(isLast ? '点击进入战斗' : '点击继续', W / 2, py + ph - 16 * S)

    ctx.restore()
    return
  }

  // ---- Intro阶段：步骤标题卡 ----
  if (data.phase === 'intro') {
    const alpha = Math.min(1, data.introTimer / 30)
    ctx.save()
    ctx.globalAlpha = alpha * 0.72
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = alpha

    // 面板
    const pw = W * 0.86, ph = data.round === 0 ? 220 * S : 120 * S
    const px = (W - pw) / 2, py = (H - ph) / 2 - 10 * S
    const ribbonH = 40 * S

    const { ribbonCY: _rcy } = drawPanel(ctx, S, px, py, pw, ph, { ribbonH })

    if (data.round === 0) {
      // 步骤首回合：完整标题卡
      // 课数标签（装饰条内左侧）
      ctx.fillStyle = '#5a3000'
      ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(`第${data.step + 1}课`, px + 20 * S, _rcy)

      // 步骤标题（装饰条内居中）
      ctx.fillStyle = '#3a1a00'
      ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText(data.title, W * 0.5 + 16 * S, _rcy)

      // 说明文字
      const startMsg = data.msgs.find(m => m.timing === 'start')
      if (startMsg) {
        ctx.fillStyle = '#4a3820'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(startMsg.text, W * 0.5, py + ribbonH + (ph - ribbonH) * 0.42)
      }

      // 点击提示
      const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.1)
      ctx.globalAlpha = alpha * (0.45 + 0.45 * pulse)
      ctx.fillStyle = '#8a6030'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText('点击屏幕开始', W * 0.5, py + ph - 14 * S)
    } else {
      // 后续回合：轻量提示横幅
      const startMsg = data.msgs.find(m => m.timing === 'start')
      ctx.fillStyle = '#3a1a00'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      if (startMsg) ctx.fillText(startMsg.text, W * 0.5, _rcy)

      const pulse = 0.5 + 0.5 * Math.sin(g.af * 0.1)
      ctx.globalAlpha = alpha * (0.45 + 0.45 * pulse)
      ctx.fillStyle = '#8a6030'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillText('点击屏幕继续', W * 0.5, py + ph - 14 * S)
    }

    ctx.restore()
    return
  }

  // ---- Play阶段：引导箭头 + 提示文字 ----
  if (data.phase === 'play') {
    const cs = g.cellSize, bx = g.boardX, by = g.boardY

    // 步骤标签（左上角小标签）
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    const lblW = 80*S, lblH = 22*S, lblX = (W - lblW)/2, lblY = by - 32*S
    R.rr(lblX, lblY, lblW, lblH, 4*S); ctx.fill()
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`教学 ${data.step + 1}/4`, lblX + lblW/2, lblY + lblH/2)
    ctx.restore()

    // 引导箭头动画（仅未完成引导时显示）
    if (data.guide && !data.guideDone && g.bState === 'playerTurn' && !g.dragging) {
      const guide = data.guide
      const fromX = bx + guide.fromC * cs + cs/2
      const fromY = by + guide.fromR * cs + cs/2
      const path = guide.path
      const t = data.arrowTimer

      // === 起始珠：强脉冲外发光+粗亮边框 ===
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.12)
      const startCX = bx + guide.fromC * cs + cs/2
      const startCY = by + guide.fromR * cs + cs/2
      ctx.save()
      // 外发光（大范围扩散光晕）
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = pulse * 0.5
      const startGlow = ctx.createRadialGradient(startCX, startCY, cs*0.2, startCX, startCY, cs*0.75)
      startGlow.addColorStop(0, '#ffee55')
      startGlow.addColorStop(0.5, '#ffd700aa')
      startGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = startGlow
      ctx.beginPath(); ctx.arc(startCX, startCY, cs*0.75, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      // 粗亮金色边框
      ctx.globalAlpha = 0.7 + pulse * 0.3
      ctx.strokeStyle = '#ffcc00'
      ctx.lineWidth = 3.5*S
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10*S
      ctx.strokeRect(bx + guide.fromC * cs + 1, by + guide.fromR * cs + 1, cs - 2, cs - 2)
      ctx.shadowBlur = 0
      // "起点"文字标记
      ctx.globalAlpha = 0.85
      ctx.fillStyle = '#fff'
      ctx.font = `bold ${9*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3*S
      ctx.fillText('按住', startCX, by + guide.fromR * cs - 2*S)
      ctx.shadowBlur = 0
      ctx.restore()

      // === 路径格子：醒目高亮+序号+依次闪烁波浪 ===
      if (path.length > 2) {
        ctx.save()
        for (let pi = 1; pi < path.length; pi++) {
          const [pr, pc] = path[pi]
          const cellCX = bx + pc * cs + cs/2, cellCY = by + pr * cs + cs/2
          const cellX = bx + pc * cs, cellY = by + pr * cs
          const wavePhase = (t * 0.1 + pi * 1.2) % (Math.PI * 2)
          const waveAlpha = 0.25 + 0.2 * Math.sin(wavePhase)
          // 圆形发光底色（cyan-白渐变）
          ctx.globalCompositeOperation = 'lighter'
          ctx.globalAlpha = waveAlpha * 0.6
          const cellGlow = ctx.createRadialGradient(cellCX, cellCY, 0, cellCX, cellCY, cs*0.5)
          cellGlow.addColorStop(0, '#ffffff')
          cellGlow.addColorStop(0.4, '#44ddff')
          cellGlow.addColorStop(1, 'transparent')
          ctx.fillStyle = cellGlow
          ctx.beginPath(); ctx.arc(cellCX, cellCY, cs*0.5, 0, Math.PI*2); ctx.fill()
          ctx.globalCompositeOperation = 'source-over'
          // 亮色边框
          ctx.globalAlpha = waveAlpha + 0.15
          ctx.strokeStyle = '#44ddff'
          ctx.lineWidth = 2*S
          ctx.strokeRect(cellX + 2, cellY + 2, cs - 4, cs - 4)
          // 序号标记（大号+描边）
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(wavePhase)
          ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 2.5*S
          ctx.strokeText(`${pi}`, cellCX, cellCY)
          ctx.fillStyle = '#fff'
          ctx.fillText(`${pi}`, cellCX, cellCY)
        }
        ctx.restore()
      }

      // === 手指拖拽动画 ===
      const animDur = Math.max(150, path.length * 35)
      const progress = (t % animDur) / animDur
      let fingerCX, fingerCY
      if (path.length >= 2) {
        const totalSegs = path.length - 1
        const segFloat = progress * totalSegs
        const segIdx = Math.min(Math.floor(segFloat), totalSegs - 1)
        const segProg = segFloat - segIdx
        const [r1, c1] = path[segIdx]
        const [r2, c2] = path[Math.min(segIdx + 1, path.length - 1)]
        fingerCX = bx + (c1 + (c2 - c1) * segProg) * cs + cs/2
        fingerCY = by + (r1 + (r2 - r1) * segProg) * cs + cs/2
      } else {
        fingerCX = fromX; fingerCY = fromY
      }

      // === 路径线：发光粗线+亮色虚线+流光效果 ===
      ctx.save()
      ctx.lineJoin = 'round'; ctx.lineCap = 'round'
      // 底层发光粗线（带shadow）
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8*S
      ctx.strokeStyle = 'rgba(255,200,0,0.4)'
      ctx.lineWidth = 6*S
      ctx.beginPath()
      for (let i = 0; i < path.length; i++) {
        const px = bx + path[i][1] * cs + cs/2
        const py = by + path[i][0] * cs + cs/2
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.shadowBlur = 0
      // 中层亮线
      ctx.strokeStyle = 'rgba(255,230,100,0.65)'
      ctx.lineWidth = 3*S
      ctx.beginPath()
      for (let i = 0; i < path.length; i++) {
        const px = bx + path[i][1] * cs + cs/2
        const py = by + path[i][0] * cs + cs/2
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      // 上层白色虚线（流动感）
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 1.5*S
      ctx.setLineDash([5*S, 5*S])
      ctx.lineDashOffset = -t * 0.8
      ctx.beginPath()
      for (let i = 0; i < path.length; i++) {
        const px = bx + path[i][1] * cs + cs/2
        const py = by + path[i][0] * cs + cs/2
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([]); ctx.lineDashOffset = 0
      // === 终点标记：双圈脉冲+十字准星 ===
      const lastP = path[path.length - 1]
      const endX = bx + lastP[1] * cs + cs/2
      const endY = by + lastP[0] * cs + cs/2
      const endPulse = 0.5 + 0.5 * Math.sin(t * 0.15)
      // 外圈发光
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = endPulse * 0.4
      const endGlow = ctx.createRadialGradient(endX, endY, cs*0.1, endX, endY, cs*0.6)
      endGlow.addColorStop(0, '#ff6644')
      endGlow.addColorStop(0.5, '#ff440066')
      endGlow.addColorStop(1, 'transparent')
      ctx.fillStyle = endGlow
      ctx.beginPath(); ctx.arc(endX, endY, cs*0.6, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      // 内圈
      ctx.globalAlpha = 0.6 + endPulse * 0.4
      ctx.strokeStyle = '#ff6644'; ctx.lineWidth = 2.5*S
      ctx.shadowColor = '#ff4422'; ctx.shadowBlur = 6*S
      ctx.beginPath(); ctx.arc(endX, endY, cs * 0.35, 0, Math.PI * 2); ctx.stroke()
      ctx.shadowBlur = 0
      // 外圈
      ctx.globalAlpha = 0.3 + endPulse * 0.3
      ctx.strokeStyle = '#ff8866'; ctx.lineWidth = 1.5*S
      ctx.beginPath(); ctx.arc(endX, endY, cs * 0.48, 0, Math.PI * 2); ctx.stroke()
      ctx.restore()

      // === 手指图标（更大、更亮、带拖尾光效） ===
      ctx.save()
      const fingerAlpha = progress < 0.08 ? progress / 0.08 : (progress > 0.88 ? (1 - progress) / 0.12 : 1)
      ctx.globalAlpha = fingerAlpha * 0.92
      // 拖尾光效（手指移动方向的淡化尾迹）
      if (progress > 0.05 && progress < 0.9) {
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = fingerAlpha * 0.25
        const trailGrd = ctx.createRadialGradient(fingerCX, fingerCY, 2*S, fingerCX, fingerCY, 22*S)
        trailGrd.addColorStop(0, '#ffd700')
        trailGrd.addColorStop(0.5, '#ffd70044')
        trailGrd.addColorStop(1, 'transparent')
        ctx.fillStyle = trailGrd
        ctx.beginPath(); ctx.arc(fingerCX, fingerCY, 22*S, 0, Math.PI*2); ctx.fill()
        ctx.globalCompositeOperation = 'source-over'
      }
      ctx.globalAlpha = fingerAlpha * 0.92
      // 大外圈光环
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12*S
      ctx.fillStyle = 'rgba(255,215,0,0.35)'
      ctx.beginPath(); ctx.arc(fingerCX, fingerCY + 6*S, 20*S, 0, Math.PI*2); ctx.fill()
      ctx.shadowBlur = 0
      // 手指主体（更大的圆+三角形）
      ctx.fillStyle = '#ffffffee'
      ctx.beginPath(); ctx.arc(fingerCX, fingerCY + 10*S, 10*S, 0, Math.PI*2); ctx.fill()
      ctx.beginPath()
      ctx.moveTo(fingerCX, fingerCY - 4*S)
      ctx.lineTo(fingerCX - 7*S, fingerCY + 10*S)
      ctx.lineTo(fingerCX + 7*S, fingerCY + 10*S)
      ctx.closePath(); ctx.fill()
      // 指尖高光
      ctx.fillStyle = '#ffd700'
      ctx.beginPath(); ctx.arc(fingerCX, fingerCY - 1*S, 3*S, 0, Math.PI*2); ctx.fill()
      ctx.restore()
    }

    // afterElim消息
    if (data.afterElimShown) {
      const afterMsg = data.msgs.find(m => m.timing === 'afterElim')
      if (afterMsg) {
        ctx.save()
        const msgW = W * 0.85, msgH = 30*S
        const msgX = (W - msgW) / 2, msgY = by - 60*S
        ctx.fillStyle = 'rgba(0,0,0,0.7)'
        R.rr(msgX, msgY, msgW, msgH, 6*S); ctx.fill()
        ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(afterMsg.text, W*0.5, msgY + msgH/2)
        ctx.restore()
      }
    }

    // skillReady提示（step 3）
    if (data.step === 3) {
      const readyPetIdx = g.pets.findIndex(p => petHasSkill(p) && p.currentCd <= 0)
      if (readyPetIdx >= 0 && g.bState === 'playerTurn' && !g.dragging) {
        const skillMsg = data.msgs.find(m => m.timing === 'skillReady')
        if (skillMsg && g._petBtnRects && g._petBtnRects[readyPetIdx]) {
          ctx.save()
          const [px, py, pw, ph] = g._petBtnRects[readyPetIdx]
          // 上方箭头
          const arrowX = px + pw/2
          const arrowY = py - 20*S - Math.sin(g.af * 0.1) * 5*S
          ctx.fillStyle = '#ffd700'
          ctx.globalAlpha = 0.8 + 0.2 * Math.sin(g.af * 0.08)
          ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8*S
          ctx.beginPath()
          ctx.moveTo(arrowX, arrowY)
          ctx.lineTo(arrowX - 8*S, arrowY - 12*S)
          ctx.lineTo(arrowX + 8*S, arrowY - 12*S)
          ctx.closePath(); ctx.fill()
          ctx.shadowBlur = 0
          // 文字提示
          const msgW = W * 0.78, msgH = 28*S
          const msgX = (W - msgW) / 2, msgY = py - 60*S
          ctx.fillStyle = 'rgba(0,0,0,0.7)'
          ctx.globalAlpha = 1
          R.rr(msgX, msgY, msgW, msgH, 6*S); ctx.fill()
          ctx.fillStyle = '#ffd700'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText(skillMsg.text, W*0.5, msgY + msgH/2)
          ctx.restore()
        }
      }
    }

    // 教学中胜利提示（step 0-3，非最终步骤）
    if (g.bState === 'victory' && data.step < 3) {
      ctx.save()
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H)
      ctx.textAlign = 'center'
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
      ctx.fillText('通过！', W*0.5, H*0.42)
      const stepMsgs = [
        '记住：拖珠与路上的珠子交换位置！',
        'Combo让你更强！心珠是你的生命线！',
        '克制属性造成2.5倍伤害，被克只有0.5倍！',
      ]
      ctx.fillStyle = '#fff'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
      ctx.fillText(stepMsgs[data.step], W*0.5, H*0.50)
      const pulseA = 0.5 + 0.5 * Math.sin(g.af * 0.08)
      ctx.globalAlpha = pulseA
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      ctx.fillText('点击继续', W*0.5, H*0.58)
      ctx.restore()
    }

  }
}

// ===== 经验指示器（图标 + 暗色胶囊数值，风格同首页修炼经验）=====
function _drawExpIndicator(g, x, y, w, S) {
  const { ctx: c, R } = V
  const exp = g.runExp || 0
  const pulse = g._expIndicatorPulse || 0

  const iconSz = 28 * S
  const iconX = x + (w - iconSz) / 2
  const iconY = y
  const centerY = iconY + iconSz / 2

  // 记录图标中心位置供飘字飞向
  g._expIndicatorX = iconX + iconSz / 2
  g._expIndicatorY = centerY

  c.save()

  // 数值胶囊背景（从图标右侧 38% 处开始，向右延伸）
  const expText = `${exp}`
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const txtW = c.measureText(expText).width
  const padX = 5 * S
  const capH = 20 * S, capR = capH / 2
  const txtX = iconX + iconSz + 2 * S
  const capX = iconX + iconSz * 0.38
  const capW = txtX + txtW + padX - capX
  const capY = centerY - capH / 2

  // 胶囊
  c.beginPath()
  c.moveTo(capX + capR, capY)
  c.lineTo(capX + capW - capR, capY)
  c.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
  c.lineTo(capX + capW, capY + capH - capR)
  c.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
  c.lineTo(capX + capR, capY + capH)
  c.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
  c.lineTo(capX, capY + capR)
  c.quadraticCurveTo(capX, capY, capX + capR, capY)
  c.closePath()
  c.fillStyle = pulse > 0 ? 'rgba(180,130,10,0.75)' : 'rgba(0,0,0,0.52)'
  c.fill()

  // 数值文字
  c.fillStyle = pulse > 0 ? '#FFD700' : '#fff8cc'
  c.fillText(expText, txtX, centerY)

  // 经验图标（压在胶囊左端上层）
  const expIcon = R.getImg('assets/ui/icon_cult_exp.png')
  if (expIcon && expIcon.width > 0) {
    c.drawImage(expIcon, iconX, iconY, iconSz, iconSz)
  } else {
    c.fillStyle = '#E8D5A3'
    c.font = `${iconSz * 0.7}px sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('✨', iconX + iconSz / 2, centerY)
  }

  c.restore()
}

// ===== 经验飘字绘制 =====
function _drawExpFloats(g) {
  const { ctx, S } = V
  const floats = g._expFloats
  if (!floats || floats.length === 0) return

  for (const f of floats) {
    if (f.alpha <= 0) continue
    const p = Math.min(f.t / f.duration, 1)
    // easeInQuad 先慢后快（吸入感）
    const ep = p * p
    // 贝塞尔控制点：起点正上方偏移，模拟弧线
    const cpX = f.startX + (f.targetX - f.startX) * 0.3
    const cpY = f.startY - 40 * S
    // 二次贝塞尔插值
    const t = ep
    const oneMinusT = 1 - t
    const curX = oneMinusT * oneMinusT * f.startX + 2 * oneMinusT * t * cpX + t * t * f.targetX
    const curY = oneMinusT * oneMinusT * f.startY + 2 * oneMinusT * t * cpY + t * t * f.targetY

    ctx.save()
    // 越接近目标越小越透明
    const scale = 1 - ep * 0.5
    ctx.globalAlpha = f.alpha * (1 - ep * 0.3)
    ctx.fillStyle = f.color || '#FFD700'
    ctx.font = `bold ${Math.round(12 * scale)*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2*S
    ctx.strokeText(f.text, curX, curY)
    ctx.fillText(f.text, curX, curY)
    ctx.restore()
  }
}

// ===== 波间过渡（固定关卡） =====
function _drawWaveTransition(g) {
  const { ctx, W, H, S } = V
  ctx.save()
  // 半透明遮罩
  const alpha = Math.min(1, (60 - (g._waveTransTimer || 0)) / 15) * 0.6
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  ctx.fillRect(0, 0, W, H)
  // "第 X 波"文字
  const nextWave = (g._stageWaveIdx || 0) + 2
  const totalWaves = g._stageWaves ? g._stageWaves.length : 0
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.shadowColor = 'rgba(255,215,0,0.5)'; ctx.shadowBlur = 10*S
  ctx.fillText(`第 ${nextWave} 波`, W * 0.5, H * 0.42)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ccc'
  ctx.font = `${12*S}px "PingFang SC",sans-serif`
  ctx.fillText(`共 ${totalWaves} 波`, W * 0.5, H * 0.42 + 28*S)
  // 闪烁提示
  const blink = 0.4 + 0.4 * Math.sin(g.af * 0.1)
  ctx.globalAlpha = blink
  ctx.fillStyle = '#aaa'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('点击跳过', W * 0.5, H * 0.58)
  ctx.globalAlpha = 1
  ctx.restore()
}


// ===== 局内帮助按钮 =====
function _drawHelpButton(g, safeTop) {
  const { ctx, R, S, W } = V
  const sz = 28 * S
  const bx = W - sz - 8 * S
  const by = safeTop + 8 * S
  g._helpBtnRect = [bx, by, sz, sz]

  ctx.save()
  // 圆形底座
  const cx = bx + sz / 2, cy = by + sz / 2, radius = sz / 2
  ctx.globalAlpha = 0.7
  ctx.fillStyle = 'rgba(40,30,15,0.8)'
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = 'rgba(200,170,80,0.7)'; ctx.lineWidth = 1.5 * S
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke()

  // "?" 文字
  ctx.globalAlpha = 0.9
  ctx.fillStyle = '#ffe8a0'
  ctx.font = `bold ${16 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('?', cx, cy + 1 * S)
  ctx.restore()
}

// ===== 局内玩法帮助面板 =====
const _HELP_PAGES = [
  {
    title: '五行克制',
    render: function (ctx, cx, cy, w, h, S) {
      // 五行相克环形图
      const attrs = ['metal', 'wood', 'earth', 'water', 'fire']
      const names = ['金', '木', '土', '水', '火']
      const colors = ['#ffd700', '#4dcc4d', '#d4a056', '#4dabff', '#ff4d4d']
      const icons = ['⚔️', '🌿', '🪨', '💧', '🔥']
      const r = Math.min(w, h) * 0.26
      const pts = attrs.map((_, i) => {
        const a = -Math.PI / 2 + i * (Math.PI * 2 / 5)
        return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r * 0.95 }
      })

      // 克制箭头（顺序：金→木→土→水→火→金）
      ctx.lineWidth = 2 * S
      for (let i = 0; i < 5; i++) {
        const from = pts[i], to = pts[(i + 1) % 5]
        const dx = to.x - from.x, dy = to.y - from.y
        const len = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / len, uy = dy / len
        const startX = from.x + ux * 18 * S, startY = from.y + uy * 18 * S
        const endX = to.x - ux * 18 * S, endY = to.y - uy * 18 * S

        ctx.strokeStyle = colors[i]
        ctx.globalAlpha = 0.6
        ctx.beginPath()
        ctx.moveTo(startX, startY); ctx.lineTo(endX, endY)
        ctx.stroke()
        // 箭头
        const arrowLen = 6 * S
        ctx.fillStyle = colors[i]; ctx.globalAlpha = 0.8
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - ux * arrowLen - uy * arrowLen * 0.5, endY - uy * arrowLen + ux * arrowLen * 0.5)
        ctx.lineTo(endX - ux * arrowLen + uy * arrowLen * 0.5, endY - uy * arrowLen - ux * arrowLen * 0.5)
        ctx.closePath(); ctx.fill()
      }
      ctx.globalAlpha = 1

      // 属性节点
      for (let i = 0; i < 5; i++) {
        const p = pts[i]
        ctx.fillStyle = 'rgba(20,15,8,0.85)'
        ctx.beginPath(); ctx.arc(p.x, p.y, 16 * S, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = colors[i]; ctx.lineWidth = 1.5 * S
        ctx.beginPath(); ctx.arc(p.x, p.y, 16 * S, 0, Math.PI * 2); ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = `${14 * S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(icons[i], p.x, p.y - 1 * S)
        ctx.font = `bold ${9 * S}px "PingFang SC",sans-serif`
        ctx.fillStyle = colors[i]
        ctx.fillText(names[i], p.x, p.y + 13 * S)
      }

      // 说明
      ctx.fillStyle = '#e8d8b0'
      ctx.font = `${11 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('克制：伤害 ×2.5  |  被克：伤害 ×0.5', cx, cy + r + 36 * S)
      ctx.fillText('金→木→土→水→火→金', cx, cy + r + 52 * S)
    },
  },
  {
    title: '转珠与伤害',
    render: function (ctx, cx, cy, w, h, S) {
      const startY = cy - h * 0.32
      let y = startY
      const lineH = 22 * S
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const leftX = cx - w * 0.38

      const _row = (label, desc, color) => {
        ctx.fillStyle = color || '#ffe8a0'
        ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
        ctx.fillText(label, leftX, y)
        ctx.fillStyle = '#d0c8a8'
        ctx.font = `${11 * S}px "PingFang SC",sans-serif`
        ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
        y += lineH
      }

      _row('🔮 消珠攻击', '消除 3+ 同色珠 → 对应属性宠物攻击')
      _row('✨ 4 颗消除', '伤害 ×1.5')
      _row('💥 5 颗消除', '伤害 ×2.0 + 眩晕敌人 1 回合')
      y += 6 * S
      _row('🔥 Combo', '连续消除不同颜色，每段 +35% 伤害', '#ff9966')
      _row('❤️ 心珠', '消除粉色心珠可回复生命值', '#ff88aa')
      y += 6 * S
      _row('⚡ 残血爆发', 'HP≤30% 伤害 ×1.5，HP≤15% 伤害 ×2.0', '#ff6060')
      y += 6 * S
      ctx.fillStyle = '#a0a0a0'
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('拖动灵珠会与路径上的珠子交换位置', cx, y)
      y += lineH * 0.7
      ctx.fillText('松手后自动检测并消除所有 3 连及以上的组合', cx, y)
    },
  },
  {
    title: '宠物与技能',
    render: function (ctx, cx, cy, w, h, S) {
      const startY = cy - h * 0.28
      let y = startY
      const lineH = 22 * S
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const leftX = cx - w * 0.38

      const _row = (label, desc, color) => {
        ctx.fillStyle = color || '#ffe8a0'
        ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
        ctx.fillText(label, leftX, y)
        ctx.fillStyle = '#d0c8a8'
        ctx.font = `${11 * S}px "PingFang SC",sans-serif`
        const maxW = w * 0.76 - ctx.measureText(label).width - 8 * S
        ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
        y += lineH
      }

      _row('🐾 属性关联', '宠物属性 = 消除的珠子颜色')
      _row('⬆️ 星级升级', '强化宠物提升攻击力')
      _row('🎯 主动技能', '★2+宠物拥有技能，上滑头像释放')
      y += 6 * S
      ctx.fillStyle = '#a0a0a0'
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('技能有冷却时间，就绪时头像发光提示', cx, y)
      y += lineH * 0.8
      ctx.fillText('长按宠物头像可预览技能效果', cx, y)
      y += lineH
      ctx.fillStyle = '#ffe8a0'
      ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('队伍最多 5 只宠物同时上阵', cx, y)
    },
  },
  {
    title: '珠子与攻击',
    render: function (ctx, cx, cy, w, h, S) {
      const startY = cy - h * 0.32
      let y = startY
      const lineH = 22 * S
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      const leftX = cx - w * 0.38

      const _row = (label, desc, color) => {
        ctx.fillStyle = color || '#ffe8a0'
        ctx.font = `bold ${12 * S}px "PingFang SC",sans-serif`
        ctx.fillText(label, leftX, y)
        ctx.fillStyle = '#d0c8a8'
        ctx.font = `${11 * S}px "PingFang SC",sans-serif`
        ctx.fillText(desc, leftX + ctx.measureText(label).width + 8 * S, y)
        y += lineH
      }

      _row('⚔ 有效珠', '匹配队伍宠物属性的珠子，带⚔标记')
      _row('🔆 亮珠消除', '→ 对应属性宠物发动攻击', '#ffd700')
      y += 4 * S
      _row('⬛ 暗淡珠', '队伍中无该属性宠物')
      _row('❌ 消除无伤害', '但仍可触发 Combo 增加连击倍率', '#999')
      y += 4 * S
      _row('❤ 心珠', '始终有效，消除回复生命值', '#ff88aa')
      y += 8 * S
      ctx.fillStyle = '#a0a0a0'
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'
      ctx.fillText('宠物栏下方的属性条可查看当前覆盖情况', cx, y)
      y += lineH * 0.7
      ctx.fillText('编队时尽量覆盖更多属性以提高伤害', cx, y)
    },
  },
]

function _drawBattleHelpPanel(g) {
  const { ctx, R, W, H, S, safeTop } = V
  if (!g._battleHelpPage) g._battleHelpPage = 0
  const page = Math.min(g._battleHelpPage, _HELP_PAGES.length - 1)
  const pageData = _HELP_PAGES[page]

  ctx.save()
  // 全屏半透明遮罩
  ctx.fillStyle = 'rgba(0,0,0,0.78)'
  ctx.fillRect(0, 0, W, H)

  // 面板
  const panelW = W * 0.88, panelH = H * 0.62
  const panelX = (W - panelW) / 2
  const panelY = safeTop + (H - safeTop - panelH) * 0.4
  const br = 14 * S

  // 面板背景
  const grd = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  grd.addColorStop(0, 'rgba(45,35,20,0.97)')
  grd.addColorStop(1, 'rgba(30,22,12,0.97)')
  R.rr(panelX, panelY, panelW, panelH, br); ctx.fillStyle = grd; ctx.fill()
  // 边框
  ctx.strokeStyle = 'rgba(200,170,80,0.5)'; ctx.lineWidth = 1.5 * S
  R.rr(panelX, panelY, panelW, panelH, br); ctx.stroke()

  // 标题
  ctx.fillStyle = '#ffe8a0'
  ctx.font = `bold ${18 * S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(pageData.title, W / 2, panelY + 28 * S)

  // 分页指示器
  const dotY = panelY + panelH - 22 * S
  const dotCount = _HELP_PAGES.length
  const dotSpacing = 16 * S
  const dotStartX = W / 2 - (dotCount - 1) * dotSpacing / 2
  for (let i = 0; i < dotCount; i++) {
    ctx.fillStyle = i === page ? '#ffe8a0' : 'rgba(200,180,120,0.3)'
    ctx.beginPath(); ctx.arc(dotStartX + i * dotSpacing, dotY, 4 * S, 0, Math.PI * 2); ctx.fill()
  }

  // 页面内容区域
  const contentCx = W / 2
  const contentCy = panelY + panelH * 0.48
  pageData.render(ctx, contentCx, contentCy, panelW, panelH, S)

  // 翻页箭头
  if (page > 0) {
    ctx.fillStyle = '#ffe8a0'; ctx.globalAlpha = 0.7
    ctx.font = `bold ${22 * S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('‹', panelX + 18 * S, panelY + panelH / 2)
    ctx.globalAlpha = 1
  }
  if (page < _HELP_PAGES.length - 1) {
    ctx.fillStyle = '#ffe8a0'; ctx.globalAlpha = 0.7
    ctx.font = `bold ${22 * S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('›', panelX + panelW - 18 * S, panelY + panelH / 2)
    ctx.globalAlpha = 1
  }

  // 关闭按钮
  const closeSz = 28 * S
  const closeX = panelX + panelW - closeSz - 6 * S
  const closeY = panelY + 6 * S
  ctx.fillStyle = 'rgba(180,80,60,0.8)'
  ctx.beginPath(); ctx.arc(closeX + closeSz / 2, closeY + closeSz / 2, closeSz / 2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff'; ctx.font = `bold ${14 * S}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('✕', closeX + closeSz / 2, closeY + closeSz / 2)

  // 底部提示
  ctx.fillStyle = '#8a7a60'; ctx.globalAlpha = 0.6
  ctx.font = `${10 * S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('左右滑动翻页 · 点击空白关闭', W / 2, panelY + panelH + 20 * S)
  ctx.globalAlpha = 1

  // 存储面板区域供触摸使用
  g._helpPanelRect = [panelX, panelY, panelW, panelH]
  g._helpCloseRect = [closeX, closeY, closeSz, closeSz]
  ctx.restore()
}

module.exports = {
  rBattle, drawBoard, drawTeamBar,
  drawBuffIcons, drawBuffIconsLabeled, drawRunBuffIcons,
  drawVictoryOverlay, drawDefeatOverlay, drawAdReviveOverlay,
  drawTutorialOverlay,
}
