/**
 * 胜利/失败/复活覆盖层：通关面板、胜利弹窗+奖励选择、失败对话、广告复活
 */
const V = require('../env')
const { ATTRS, ATTR_COLOR, ATTR_NAME, REWARD_TYPES, getRealmInfo, REALM_TABLE, MAX_FLOOR } = require('../../data/tower')
const { getPetStarAtk, getPetAvatarPath, MAX_STAR, getPetSkillDesc, petHasSkill, getPetRarity } = require('../../data/pets')
const { RARITY_VISUAL, STAR_VISUAL } = require('../../data/economyConfig')
const { drawPanel, drawRibbonIcon } = require('../uiComponents')
const Particles = require('../../engine/particles')
const MusicMgr = require('../../runtime/music')
const { getStageById } = require('../../data/stages')
const { expToNextLevel, MAX_LEVEL: CULT_MAX_LEVEL } = require('../../data/cultivationConfig')

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
  const stageMgr = require('../../engine/stageManager')
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

module.exports = {
  drawVictoryOverlay,
  drawDefeatOverlay,
  drawAdReviveOverlay,
}
