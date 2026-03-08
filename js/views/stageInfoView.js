/**
 * 关卡信息页 — 进入关卡后的第一个页面
 * 展示：关卡名称、挑战目标、奖励预览、敌方阵容、当前编队、开始战斗按钮
 * 触摸编队区域 → 跳转到编队页（stageTeam）
 * 渲染入口：rStageInfo  触摸入口：tStageInfo
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetAvatarPath } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { getStageById, getStageAttr } = require('../data/stages')

const _rects = {
  backBtnRect: null,
  startBtnRect: null,
  teamAreaRect: null,
  enemyRects: [],     // [{ waveIdx, enemyIdx, rect }]
}

// ===== 渲染 =====
function rStageInfo(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  R.drawHomeBg(0)
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fillRect(0, 0, W, H)

  const stage = getStageById(g._selectedStageId)
  if (!stage) return

  const stageAttr = getStageAttr(g._selectedStageId)
  const attrColor = ATTR_COLOR[stageAttr]
  const attrName = ATTR_NAME[stageAttr] || '?'
  const bestRating = g.storage.getStageBestRating(stage.id)
  const isFirstClear = !g.storage.isStageCleared(stage.id)
  const dailyUsed = g.storage.getStageDailyCount(stage.id)
  const dailyLeft = stage.dailyLimit - dailyUsed

  const topY = safeTop + 4 * S
  const px = 14 * S
  const contentW = W - 28 * S
  let cy = topY

  // ── 返回按钮 ──
  c.save()
  c.fillStyle = 'rgba(255,255,255,0.6)'
  c.font = `${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText('‹ 返回', px, cy + 16 * S)
  _rects.backBtnRect = [0, cy, 80 * S, 32 * S]

  // ── 体力显示 ──
  c.textAlign = 'right'
  c.fillStyle = '#8ac8ff'; c.font = `${12*S}px "PingFang SC",sans-serif`
  c.fillText(`⚡${g.storage.currentStamina}/${g.storage.maxStamina}`, W - px, cy + 16 * S)
  c.restore()
  cy += 36 * S

  // ── 关卡标题 ──
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#F5E6C8'
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.fillText(stage.name, W / 2, cy + 10 * S)
  cy += 24 * S

  // 属性 + 波次 + 今日次数
  c.fillStyle = attrColor ? attrColor.main : '#ccc'
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`${attrName}属性  |  ${stage.waves.length}波  |  消耗⚡${stage.staminaCost}  |  今日${dailyLeft}/${stage.dailyLimit}`, W / 2, cy + 6 * S)
  cy += 16 * S

  // 历史最佳评价
  if (bestRating) {
    const stars = bestRating === 'S' ? '★★★' : bestRating === 'A' ? '★★☆' : '★☆☆'
    c.fillStyle = bestRating === 'S' ? '#ffd700' : bestRating === 'A' ? '#c0c0c0' : '#a87040'
    c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(`最佳：${stars} ${bestRating}`, W / 2, cy + 6 * S)
    cy += 16 * S
  }

  // ── 分隔线 ──
  _drawDivider(c, px, cy, W - px, S)
  cy += 8 * S

  // ── 挑战目标 ──
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#C8B78A'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText('◆ 挑战目标', px, cy)
  cy += 18 * S

  c.fillStyle = 'rgba(220,200,160,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.fillText(`◇ ${stage.rating.s}回合内通关 → S评价`, px + 8 * S, cy); cy += 14 * S
  c.fillText(`◇ ${stage.rating.a}回合内通关 → A评价`, px + 8 * S, cy); cy += 14 * S
  c.fillText(`◇ 通关即可 → B评价`, px + 8 * S, cy); cy += 18 * S

  // ── 分隔线 ──
  _drawDivider(c, px, cy, W - px, S)
  cy += 8 * S

  // ── 通关奖励 ──
  c.fillStyle = '#C8B78A'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('◆ 通关奖励', px, cy)
  cy += 18 * S

  c.fillStyle = 'rgba(220,200,160,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  if (isFirstClear && stage.rewards.firstClear) {
    c.fillStyle = '#ffd700'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('✦ 首通奖励：', px + 8 * S, cy); cy += 14 * S
    c.fillStyle = 'rgba(255,230,150,0.8)'; c.font = `${10*S}px "PingFang SC",sans-serif`
    for (const r of stage.rewards.firstClear) {
      if (r.type === 'fragment') c.fillText(`  灵宠碎片 ×${r.count}`, px + 16 * S, cy)
      else if (r.type === 'exp') c.fillText(`  修炼经验 +${r.amount}`, px + 16 * S, cy)
      else if (r.type === 'petExp') c.fillText(`  宠物经验 +${r.amount}`, px + 16 * S, cy)
      cy += 13 * S
    }
    cy += 2 * S
  }
  c.fillStyle = 'rgba(220,200,160,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  const rep = stage.rewards.repeatClear
  c.fillText(`碎片 ×${rep.fragments.min}~${rep.fragments.max}  |  修炼经验 +${rep.exp}  |  宠物经验 +${rep.petExp}`, px + 8 * S, cy)
  cy += 18 * S

  // ── 分隔线 ──
  _drawDivider(c, px, cy, W - px, S)
  cy += 8 * S

  // ── 敌方阵容 ──
  c.fillStyle = '#C8B78A'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText('◆ 敌方阵容', px, cy)
  cy += 20 * S

  _rects.enemyRects = []
  const enemySize = 42 * S
  const enemyGap = 10 * S
  const allEnemies = []
  stage.waves.forEach((w, wi) => w.enemies.forEach((e, ei) => allEnemies.push({ ...e, waveIdx: wi, enemyIdx: ei })))
  const enemyRowW = allEnemies.length * (enemySize + enemyGap) - enemyGap
  let ex = (W - enemyRowW) / 2

  for (const enemy of allEnemies) {
    const eAttrColor = ATTR_COLOR[enemy.attr]
    // 圆形背景
    const ecx = ex + enemySize / 2, ecy = cy + enemySize / 2
    c.fillStyle = 'rgba(60,40,30,0.8)'
    c.beginPath(); c.arc(ecx, ecy, enemySize / 2, 0, Math.PI * 2); c.fill()
    c.strokeStyle = eAttrColor ? eAttrColor.main : '#888'; c.lineWidth = 2 * S
    c.beginPath(); c.arc(ecx, ecy, enemySize / 2, 0, Math.PI * 2); c.stroke()
    // 名称首字
    c.fillStyle = eAttrColor ? eAttrColor.main : '#ccc'
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(enemy.name.slice(0, 1), ecx, ecy)
    // HP
    c.fillStyle = 'rgba(200,180,140,0.6)'; c.font = `${8*S}px "PingFang SC",sans-serif`
    c.textBaseline = 'top'
    c.fillText(`${enemy.hp}`, ecx, cy + enemySize + 2 * S)

    _rects.enemyRects.push({ waveIdx: enemy.waveIdx, enemyIdx: enemy.enemyIdx, rect: [ex, cy, enemySize, enemySize] })
    ex += enemySize + enemyGap
  }
  cy += enemySize + 16 * S

  // ── 敌人详情弹窗 ──
  if (g._stageInfoEnemyDetail != null) {
    const eIdx = g._stageInfoEnemyDetail
    const flatEnemies = []
    stage.waves.forEach(w => w.enemies.forEach(e => flatEnemies.push(e)))
    if (eIdx < flatEnemies.length) {
      _drawEnemyDetailPopup(c, R, S, W, H, flatEnemies[eIdx])
    }
  }

  // ── 分隔线 ──
  _drawDivider(c, px, cy, W - px, S)
  cy += 8 * S

  // ── 当前编队 ──
  c.fillStyle = '#C8B78A'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('◆ 编队', px, cy)
  c.fillStyle = 'rgba(180,160,120,0.5)'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText('点击编队区域可调整 ›', W - px, cy + 2 * S)
  cy += 20 * S

  const savedTeam = g.storage.getValidSavedTeam()
  const slotSize = 50 * S
  const slotGap = 8 * S
  const maxSlots = stage.teamSize.max
  const slotsW = maxSlots * slotSize + (maxSlots - 1) * slotGap
  const slotStartX = (W - slotsW) / 2
  const teamAreaTop = cy

  for (let i = 0; i < maxSlots; i++) {
    const sx = slotStartX + i * (slotSize + slotGap)
    const sy = cy

    // 槽位背景
    c.fillStyle = 'rgba(60,50,35,0.6)'
    R.rr(sx, sy, slotSize, slotSize, 8 * S); c.fill()
    c.strokeStyle = 'rgba(200,180,120,0.3)'; c.lineWidth = 1 * S
    R.rr(sx, sy, slotSize, slotSize, 8 * S); c.stroke()

    if (i < savedTeam.length) {
      const pid = savedTeam[i]
      const pet = getPetById(pid)
      const poolPet = g.storage.getPoolPet(pid)
      if (pet && poolPet) {
        const pAttrColor = ATTR_COLOR[pet.attr]
        // 属性色顶条
        c.fillStyle = pAttrColor ? pAttrColor.main : '#888'
        R.rr(sx, sy, slotSize, 4 * S, 4 * S); c.fill()
        // 头像
        const avatarPath = getPetAvatarPath({ ...pet, star: poolPet.star })
        const img = R.getImg(avatarPath)
        if (img && img.width > 0) {
          c.save()
          R.rr(sx + 3*S, sy + 6*S, slotSize - 6*S, slotSize - 20*S, 4*S); c.clip()
          c.drawImage(img, sx + 3*S, sy + 6*S, slotSize - 6*S, slotSize - 20*S)
          c.restore()
        } else {
          c.fillStyle = pAttrColor ? pAttrColor.main : '#555'
          c.globalAlpha = 0.3
          R.rr(sx + 3*S, sy + 6*S, slotSize - 6*S, slotSize - 20*S, 4*S); c.fill()
          c.globalAlpha = 1
          c.fillStyle = '#fff'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
          c.textAlign = 'center'; c.textBaseline = 'middle'
          c.fillText(pet.name.slice(0, 1), sx + slotSize / 2, sy + slotSize / 2 - 4 * S)
        }
        // 名称 + 等级
        c.textAlign = 'center'; c.textBaseline = 'bottom'
        c.fillStyle = '#E8D5A3'; c.font = `${8*S}px "PingFang SC",sans-serif`
        c.fillText(`${pet.name.slice(0,3)} Lv.${poolPet.level}`, sx + slotSize / 2, sy + slotSize - 2 * S)
        // 队长标记
        if (i === 0) {
          c.fillStyle = '#ffd700'; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
          c.textAlign = 'left'; c.textBaseline = 'top'
          c.fillText('队长', sx + 2 * S, sy + 1 * S)
        }
      }
    } else {
      c.fillStyle = '#666'; c.font = `${20*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillText('+', sx + slotSize / 2, sy + slotSize / 2)
    }
  }

  _rects.teamAreaRect = [slotStartX - 4*S, teamAreaTop - 4*S, slotsW + 8*S, slotSize + 8*S]
  cy += slotSize + 8 * S

  // 编队状态提示
  const teamCount = savedTeam.length
  const minTeam = stage.teamSize.min
  c.textAlign = 'center'; c.textBaseline = 'top'
  if (teamCount < minTeam) {
    c.fillStyle = '#E06060'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`需要至少${minTeam}只灵宠编队才能出战`, W / 2, cy)
  } else {
    c.fillStyle = 'rgba(180,160,120,0.5)'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`${teamCount}/${maxSlots}`, W / 2, cy)
  }
  cy += 14 * S

  // ── 底部按钮 ──
  const btnH = 42 * S
  const btnY = H - btnH - 14 * S
  const canGo = teamCount >= minTeam

  // 开始战斗按钮
  const goBtnW = W * 0.55
  const goBtnX = (W - goBtnW) / 2
  if (canGo) {
    _drawGoldBtn(c, R, S, goBtnX, btnY, goBtnW, btnH, '开始战斗')
    _rects.startBtnRect = [goBtnX, btnY, goBtnW, btnH]
  } else {
    _drawGoldBtn(c, R, S, goBtnX, btnY, goBtnW, btnH, '编队出战', true)
    _rects.startBtnRect = [goBtnX, btnY, goBtnW, btnH]
  }
}

// ===== 触摸 =====
function tStageInfo(g, x, y, type) {
  if (type !== 'end') return

  // 敌人详情弹窗打开时，点击关闭
  if (g._stageInfoEnemyDetail != null) {
    g._stageInfoEnemyDetail = null
    return
  }

  // 返回
  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    g.scene = 'stageSelect'
    return
  }

  // 编队区域 → 进入编队页
  if (_rects.teamAreaRect && g._hitRect(x, y, ..._rects.teamAreaRect)) {
    const savedTeam = g.storage.getValidSavedTeam()
    g._stageTeamSelected = savedTeam.slice()
    g._stageTeamFilter = 'all'
    g.scene = 'stageTeam'
    return
  }

  // 开始战斗
  if (_rects.startBtnRect && g._hitRect(x, y, ..._rects.startBtnRect)) {
    const stage = getStageById(g._selectedStageId)
    if (!stage) return
    const savedTeam = g.storage.getValidSavedTeam()
    if (savedTeam.length < stage.teamSize.min) {
      // 编队不足，跳转到编队页
      g._stageTeamSelected = savedTeam.slice()
      g._stageTeamFilter = 'all'
      g.scene = 'stageTeam'
      return
    }
    // 检查体力
    if (g.storage.currentStamina < stage.staminaCost) {
      g._toastMsg = '体力不足'
      return
    }
    // 检查每日次数
    if (!g.storage.canChallengeStage(g._selectedStageId, stage.dailyLimit)) {
      g._toastMsg = '今日挑战次数已用完'
      return
    }
    // 直接开始战斗
    const stageMgr = require('../engine/stageManager')
    stageMgr.startStage(g, g._selectedStageId, savedTeam)
    return
  }

  // 敌人头像点击
  for (let i = 0; i < _rects.enemyRects.length; i++) {
    const item = _rects.enemyRects[i]
    if (g._hitRect(x, y, ...item.rect)) {
      g._stageInfoEnemyDetail = i
      return
    }
  }
}

// ===== 绘制工具 =====

function _drawDivider(c, x1, y, x2, S) {
  const grad = c.createLinearGradient(x1, y, x2, y)
  grad.addColorStop(0, 'rgba(201,168,76,0)')
  grad.addColorStop(0.2, 'rgba(201,168,76,0.3)')
  grad.addColorStop(0.8, 'rgba(201,168,76,0.3)')
  grad.addColorStop(1, 'rgba(201,168,76,0)')
  c.strokeStyle = grad; c.lineWidth = 1
  c.beginPath(); c.moveTo(x1, y); c.lineTo(x2, y); c.stroke()
}

/** 金色主按钮（类似参考图中的红底金边按钮） */
function _drawGoldBtn(c, R, S, x, y, w, h, text, disabled) {
  const r = h / 2

  if (disabled) {
    c.fillStyle = 'rgba(80,70,50,0.6)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = '#666'; c.lineWidth = 1.5 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#888'
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(text, x + w / 2, y + h / 2)
    return
  }

  // 阴影
  c.save()
  c.shadowColor = 'rgba(180,120,30,0.4)'; c.shadowBlur = 10 * S; c.shadowOffsetY = 3 * S
  // 渐变底色
  const bg = c.createLinearGradient(x, y, x, y + h)
  bg.addColorStop(0, '#B8451A')
  bg.addColorStop(0.5, '#9C3512')
  bg.addColorStop(1, '#7A2A0E')
  c.fillStyle = bg
  R.rr(x, y, w, h, r); c.fill()
  c.restore()

  // 金色边框
  c.strokeStyle = '#D4A843'; c.lineWidth = 2 * S
  R.rr(x, y, w, h, r); c.stroke()
  // 内侧高光
  c.save(); c.globalAlpha = 0.2
  const hl = c.createLinearGradient(x, y, x, y + h * 0.4)
  hl.addColorStop(0, '#fff'); hl.addColorStop(1, 'rgba(255,255,255,0)')
  c.fillStyle = hl
  R.rr(x + 2*S, y + 2*S, w - 4*S, h * 0.4, r); c.fill()
  c.restore()

  // 文字
  c.fillStyle = '#FFE8B8'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 4 * S
  c.fillText(text, x + w / 2, y + h / 2)
  c.shadowBlur = 0
}

/** 敌人详情弹窗 */
function _drawEnemyDetailPopup(c, R, S, W, H, enemy) {
  // 遮罩
  c.fillStyle = 'rgba(0,0,0,0.6)'
  c.fillRect(0, 0, W, H)

  const pw = W * 0.75, ph = 160 * S
  const px = (W - pw) / 2, py = (H - ph) / 2
  const rad = 12 * S

  // 面板背景
  const bg = c.createLinearGradient(px, py, px, py + ph)
  bg.addColorStop(0, '#3D2B15')
  bg.addColorStop(1, '#1A120A')
  c.fillStyle = bg
  R.rr(px, py, pw, ph, rad); c.fill()
  c.strokeStyle = '#C9A84C'; c.lineWidth = 2 * S
  R.rr(px, py, pw, ph, rad); c.stroke()

  const indent = px + 16 * S
  let dy = py + 18 * S
  const eAttrColor = ATTR_COLOR[enemy.attr]

  // 名称
  c.fillStyle = '#F5E6C8'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(enemy.name, indent, dy)
  // 属性标签
  c.fillStyle = eAttrColor ? eAttrColor.main : '#888'
  c.font = `${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${ATTR_NAME[enemy.attr] || '?'}属性`, px + pw - 16 * S, dy + 2 * S)
  dy += 24 * S

  // 属性值
  c.fillStyle = '#E8D5A8'; c.font = `${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText(`生命：${enemy.hp}`, indent, dy)
  c.fillText(`攻击：${enemy.atk}`, indent + pw * 0.35, dy)
  c.fillText(`防御：${enemy.def}`, indent + pw * 0.7, dy)
  dy += 20 * S

  // 技能
  if (enemy.skills && enemy.skills.length > 0) {
    c.fillStyle = '#B8A0E0'; c.font = `${10*S}px "PingFang SC",sans-serif`
    const skillNames = {
      atkBuff: '攻击增强', defBuff: '防御增强', healPct: '百分比回复',
      critStrike: '暴击一击', shieldBreak: '破盾', stunStrike: '眩晕攻击',
      reflect: '伤害反射', multiStrike: '连续攻击', selfHeal: '自我治愈',
    }
    const names = enemy.skills.map(s => skillNames[s] || s).join('、')
    c.fillText(`技能：${names}`, indent, dy)
  } else {
    c.fillStyle = 'rgba(200,180,140,0.4)'; c.font = `${10*S}px "PingFang SC",sans-serif`
    c.fillText('无特殊技能', indent, dy)
  }
  dy += 22 * S

  // 关闭提示
  c.fillStyle = 'rgba(200,180,140,0.3)'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击任意处关闭', W / 2, py + ph - 8 * S)
}

module.exports = { rStageInfo, tStageInfo }
