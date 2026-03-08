/**
 * 简单场景渲染：Loading / Title / Gameover / Ranking / Stats
 * 以及通用 UI 组件：返回按钮、弹窗
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetAvatarPath, MAX_STAR, PETS, getPetSkillDesc, getPetLore, getPetStarAtk, getStar3Override, petHasSkill } = require('../data/pets')

// ===== Loading =====
function rLoading(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawLoadingBg(g.af)

  // 使用实际资源加载进度（由 preloadImages 回调更新）
  const pct = g._loadPct || 0

  // 进度条参数 — 位于画面底部
  const barW = W * 0.6
  const barH = 10 * S
  const barX = (W - barW) / 2
  const barY = H - 60 * S
  const radius = barH / 2

  // 进度条底槽（半透明白色，圆角）
  ctx.save()
  ctx.beginPath()
  R.rr(barX, barY, barW, barH, radius)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
  ctx.fill()

  // 进度条填充（金色渐变，圆角，带发光）
  const fillW = Math.max(barH, barW * pct)
  if (pct > 0) {
    ctx.beginPath()
    R.rr(barX, barY, fillW, barH, radius)
    const grad = ctx.createLinearGradient(barX, barY, barX + fillW, barY)
    grad.addColorStop(0, '#f0a030')
    grad.addColorStop(0.5, '#ffd700')
    grad.addColorStop(1, '#ffe066')
    ctx.fillStyle = grad
    ctx.fill()

    // 高光条纹
    ctx.beginPath()
    R.rr(barX, barY, fillW, barH * 0.45, radius)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.fill()

    // 外发光
    ctx.shadowColor = '#ffd700'
    ctx.shadowBlur = 8 * S
    ctx.beginPath()
    R.rr(barX, barY, fillW, barH, radius)
    ctx.fillStyle = 'rgba(255, 215, 0, 0.15)'
    ctx.fill()
    ctx.shadowBlur = 0
  }

  // 百分比数字（进度条右侧，带描边）
  const pctText = `${Math.round(pct * 100)}%`
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3*S; ctx.lineJoin = 'round'
  ctx.strokeText(pctText, barX + barW, barY - 10*S)
  ctx.fillStyle = '#ffd700'
  ctx.fillText(pctText, barX + barW, barY - 10*S)
  ctx.textBaseline = 'alphabetic'

  ctx.restore()
}

// 图鉴按钮上的"选宠出战"角标
function _drawDexBtnBadge(ctx, S, bx, by, bw, bh) {
  const tag = '选宠出战'
  const fs = 7 * S
  const padH = 2 * S, padW = 4 * S
  const tw = fs * tag.length + padW * 2
  const th = fs + padH * 2
  const tx = bx + bw - tw + 2 * S  // 右上偏移
  const ty = by - th + 3 * S
  // 红色圆角底
  const grad = ctx.createLinearGradient(tx, ty, tx, ty + th)
  grad.addColorStop(0, '#ff5252'); grad.addColorStop(1, '#d32f2f')
  ctx.fillStyle = grad
  ctx.beginPath()
  const r = th * 0.4
  ctx.moveTo(tx + r, ty); ctx.lineTo(tx + tw - r, ty)
  ctx.arcTo(tx + tw, ty, tx + tw, ty + r, r)
  ctx.lineTo(tx + tw, ty + th - r)
  ctx.arcTo(tx + tw, ty + th, tx + tw - r, ty + th, r)
  ctx.lineTo(tx + r, ty + th)
  ctx.arcTo(tx, ty + th, tx, ty + th - r, r)
  ctx.lineTo(tx, ty + r)
  ctx.arcTo(tx, ty, tx + r, ty, r)
  ctx.closePath(); ctx.fill()
  // 文字
  ctx.fillStyle = '#fff'
  ctx.font = `bold ${fs}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(tag, tx + tw / 2, ty + th / 2)
}

// ===== Title =====
function _drawImgBtn(ctx, R, img, x, y, w, h, text, fontSize, S) {
  if (img && img.width > 0) {
    ctx.drawImage(img, x, y, w, h)
  } else {
    // fallback: 金色渐变圆角按钮
    const r = h * 0.4
    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, '#f5d98a'); grad.addColorStop(0.5, '#d4a84b'); grad.addColorStop(1, '#b8862d')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath(); ctx.fill()
  }
  // 按钮上叠加文字
  if (text) {
    ctx.save()
    ctx.fillStyle = '#5a2d0c'
    ctx.font = `bold ${fontSize * S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(255,230,180,0.6)'; ctx.shadowBlur = 2 * S
    ctx.fillText(text, x + w / 2, y + h / 2)
    ctx.shadowBlur = 0
    ctx.restore()
  }
}

// 意见反馈文字按钮（低调风格）
function _drawFeedbackBtn(ctx, S, W, y) {
  const text = '意见反馈'
  const fs = 10*S
  ctx.save()
  ctx.font = `${fs}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'top'
  ctx.fillStyle = 'rgba(210,190,160,0.7)'
  ctx.fillText('📝 ' + text, W*0.5, y + 3*S)
  // 下划线
  const tw = ctx.measureText('📝 ' + text).width
  ctx.strokeStyle = 'rgba(210,190,160,0.35)'; ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(W*0.5 - tw*0.5, y + fs + 5*S)
  ctx.lineTo(W*0.5 + tw*0.5, y + fs + 5*S)
  ctx.stroke()
  ctx.restore()
}

function rTitle(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawHomeBg(g.af)

  // 游戏标题Logo
  const titleLogo = R.getImg('assets/ui/title_logo.png')
  if (titleLogo && titleLogo.width > 0) {
    const logoW = W * 0.7
    const logoH = logoW * (titleLogo.height / titleLogo.width)
    const logoX = (W - logoW) / 2
    const logoY = H * 0.08
    ctx.drawImage(titleLogo, logoX, logoY, logoW, logoH)
  }

  const imgContinue = R.getImg('assets/ui/btn_continue.png')
  const imgStart = R.getImg('assets/ui/btn_start.png')
  const imgRank = R.getImg('assets/ui/btn_rank.png')

  // 按钮宽度占屏幕60%，高度按 4:1 宽高比
  const btnW = W * 0.6, btnH = btnW / 4
  const btnX = (W - btnW) / 2

  // 图鉴按钮（独立一行，较大醒目）
  const dexW = W * 0.5, dexH = dexW / 4
  const dexX = (W - dexW) / 2
  // 底部小按钮（统计+排行并排）
  const smGap = 8 * S
  const smW = (W * 0.5 - smGap) / 2, smH = smW / 3.2
  const smStartX = (W - smW * 2 - smGap) / 2

  const hasSave = g.storage.hasSavedRun()
  if (hasSave) {
    const saved = g.storage.loadRunState()
    // 继续挑战
    const cby = H * 0.46
    _drawImgBtn(ctx, R, imgContinue, btnX, cby, btnW, btnH, `继续挑战 (第${saved.floor}层)`, 16, S)
    g._titleContinueRect = [btnX, cby, btnW, btnH]
    // 开始挑战
    const sby = H * 0.57
    _drawImgBtn(ctx, R, imgStart, btnX, sby, btnW, btnH, '开始挑战', 15, S)
    g._titleBtnRect = [btnX, sby, btnW, btnH]
    // 图鉴（独立一行，醒目）
    const dexY = H * 0.68
    _drawImgBtn(ctx, R, imgRank, dexX, dexY, dexW, dexH, '图鉴', 15, S)
    _drawDexBtnBadge(ctx, S, dexX, dexY, dexW, dexH)
    g._dexBtnRect = [dexX, dexY, dexW, dexH]
    // 统计+排行（并排小按钮）
    const smY = H * 0.78
    _drawImgBtn(ctx, R, imgRank, smStartX, smY, smW, smH, '统计', 12, S)
    g._statBtnRect = [smStartX, smY, smW, smH]
    _drawImgBtn(ctx, R, imgRank, smStartX + smW + smGap, smY, smW, smH, '排行', 12, S)
    g._rankBtnRect = [smStartX + smW + smGap, smY, smW, smH]
    // 意见反馈（底部小文字按钮）
    const fbY = smY + smH + 12*S
    _drawFeedbackBtn(ctx, S, W, fbY)
    g._feedbackBtnRect = [W*0.5 - 40*S, fbY, 80*S, 22*S]
  } else {
    g._titleContinueRect = null
    // 开始挑战
    const sby = H * 0.50
    _drawImgBtn(ctx, R, imgStart, btnX, sby, btnW, btnH, '开始挑战', 18, S)
    g._titleBtnRect = [btnX, sby, btnW, btnH]
    // 图鉴（独立一行，醒目）
    const dexY = H * 0.62
    _drawImgBtn(ctx, R, imgRank, dexX, dexY, dexW, dexH, '图鉴', 15, S)
    _drawDexBtnBadge(ctx, S, dexX, dexY, dexW, dexH)
    g._dexBtnRect = [dexX, dexY, dexW, dexH]
    // 统计+排行（并排小按钮）
    const smY = H * 0.72
    _drawImgBtn(ctx, R, imgRank, smStartX, smY, smW, smH, '统计', 12, S)
    g._statBtnRect = [smStartX, smY, smW, smH]
    _drawImgBtn(ctx, R, imgRank, smStartX + smW + smGap, smY, smW, smH, '排行', 12, S)
    g._rankBtnRect = [smStartX + smW + smGap, smY, smW, smH]
    // 意见反馈（底部小文字按钮）
    const fbY = smY + smH + 12*S
    _drawFeedbackBtn(ctx, S, W, fbY)
    g._feedbackBtnRect = [W*0.5 - 40*S, fbY, 80*S, 22*S]
  }

  if (g.showNewRunConfirm) drawNewRunConfirm(g)
}

// ===== Gameover =====
function rGameover(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawBg(g.af)

  if (g.cleared) {
    // ===== 通关界面 =====
    // 金色光芒背景
    ctx.save()
    const glow = ctx.createRadialGradient(W*0.5, H*0.25, 0, W*0.5, H*0.25, W*0.6)
    glow.addColorStop(0, 'rgba(255,215,0,0.3)')
    glow.addColorStop(0.5, 'rgba(255,200,0,0.1)')
    glow.addColorStop(1, 'rgba(255,215,0,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.save()
    ctx.shadowColor = 'rgba(255,200,0,0.5)'; ctx.shadowBlur = 8*S
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${28*S}px "PingFang SC",sans-serif`
    ctx.fillText('通天塔·通关', W*0.5, H*0.16)
    ctx.restore()
    // 装饰线
    const cdivW = W*0.28, cdivY = H*0.18
    ctx.strokeStyle = 'rgba(212,175,55,0.4)'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.moveTo(W*0.5 - cdivW, cdivY); ctx.lineTo(W*0.5 + cdivW, cdivY); ctx.stroke()

    ctx.fillStyle = '#f0e0c0'; ctx.font = `${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('恭喜修士登顶通天塔！', W*0.5, H*0.24)

    ctx.fillStyle = '#e8a840'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
    ctx.fillText(`通关层数：第 ${g.floor > 60 ? 60 : g.floor} 层`, W*0.5, H*0.32)

    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(`历史最高：第 ${g.storage.bestFloor} 层`, W*0.5, H*0.38)
  } else {
    // ===== 失败界面 =====
    // 暗红光晕
    ctx.save()
    const dGlow = ctx.createRadialGradient(W*0.5, H*0.2, 0, W*0.5, H*0.2, W*0.4)
    dGlow.addColorStop(0, 'rgba(200,50,60,0.15)')
    dGlow.addColorStop(1, 'rgba(200,50,60,0)')
    ctx.fillStyle = dGlow; ctx.fillRect(0, 0, W, H)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
    ctx.fillStyle = TH.danger; ctx.font = `bold ${26*S}px "PingFang SC",sans-serif`
    ctx.fillText('挑战结束', W*0.5, H*0.18)
    ctx.restore()
    // 装饰线
    const ddivW = W*0.22, ddivY = H*0.2
    ctx.strokeStyle = 'rgba(200,60,80,0.3)'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.moveTo(W*0.5 - ddivW, ddivY); ctx.lineTo(W*0.5 + ddivW, ddivY); ctx.stroke()

    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
    ctx.fillText(`本次到达：第 ${g.floor} 层`, W*0.5, H*0.30)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(`历史最高：第 ${g.storage.bestFloor} 层`, W*0.5, H*0.38)
  }

  // 阵容信息面板
  const panelW = W*0.86, panelH = 120*S
  const panelX = (W - panelW)/2, panelY = H*0.44
  const pbg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  pbg.addColorStop(0, 'rgba(30,25,18,0.8)'); pbg.addColorStop(1, 'rgba(20,18,12,0.85)')
  ctx.fillStyle = pbg; R.rr(panelX, panelY, panelW, panelH, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.2)'; ctx.lineWidth = 1*S
  R.rr(panelX, panelY, panelW, panelH, 10*S); ctx.stroke()

  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.fillText('上场灵兽', W*0.5, panelY + 20*S)
  g.pets.forEach((p, i) => {
    const ac = ATTR_COLOR[p.attr]
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(p.name, W*0.1 + i*W*0.18, panelY + 42*S)
  })
  if (g.weapon) {
    ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    const _wpnLabel = '法宝·'
    const _wpnFull = _wpnLabel + g.weapon.name
    const _wpnFullW = ctx.measureText(_wpnFull).width
    const _wpnLabelW = ctx.measureText(_wpnLabel).width
    const _wpnStartX = W*0.5 - _wpnFullW/2
    ctx.fillStyle = '#e0a020'
    ctx.textAlign = 'left'
    ctx.fillText(_wpnLabel, _wpnStartX, panelY + 68*S)
    ctx.fillStyle = TH.accent
    ctx.fillText(g.weapon.name, _wpnStartX + _wpnLabelW, panelY + 68*S)
    ctx.textAlign = 'center'
  }
  ctx.fillStyle = TH.dim; ctx.font = `${11*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`灵兽背包：${g.petBag.length}只  法宝背包：${g.weaponBag.length}件`, W*0.5, panelY + 92*S)

  // 修炼经验获得展示
  let expPanelBottom = panelY + panelH
  if (g._lastRunExp != null && g._lastRunExp > 0) {
    const { MAX_LEVEL, expToNextLevel, currentRealm } = require('../data/cultivationConfig')
    const cult = g.storage.cultivation
    const levelUps = g._lastRunLevelUps || 0
    const expH = levelUps > 0 ? 96*S : 80*S
    const expY = panelY + panelH + 10*S
    const epx = (W - panelW)/2
    const epBg = ctx.createLinearGradient(epx, expY, epx, expY + expH)
    epBg.addColorStop(0, 'rgba(50,40,20,0.7)'); epBg.addColorStop(1, 'rgba(30,25,12,0.75)')
    ctx.fillStyle = epBg; R.rr(epx, expY, panelW, expH, 8*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.15)'; ctx.lineWidth = 1*S
    R.rr(epx, expY, panelW, expH, 8*S); ctx.stroke()

    ctx.textAlign = 'center'
    // 经验获得
    ctx.fillStyle = '#E8D5A3'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.fillText(`获得修炼经验 +${g._lastRunExp}`, W*0.5, expY + 16*S)

    // 经验明细
    const d = g._lastRunExpDetail
    if (d) {
      ctx.fillStyle = '#A89878'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
      const details = []
      if (d.elimExp > 0) details.push(`消除+${d.elimExp}`)
      if (d.comboExp > 0) details.push(`连击+${d.comboExp}`)
      if (d.killExp > 0) details.push(`击杀+${d.killExp}`)
      if (d.layerExp > 0) details.push(`层数+${d.layerExp}`)
      if (d.clearBonus > 0) details.push(`通关+${d.clearBonus}`)
      ctx.fillText(details.join('  '), W*0.5, expY + 32*S)
      if (!d.isCleared) {
        ctx.fillStyle = '#886655'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
        ctx.fillText(`(未通关保底 60%)`, W*0.5, expY + 44*S)
      }
    }

    // 升级提示
    let curLine = d && !d.isCleared ? 56*S : 48*S
    if (levelUps > 0) {
      ctx.fillStyle = '#FFD700'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.shadowColor = 'rgba(255,215,0,0.4)'; ctx.shadowBlur = 6*S
      ctx.fillText(`升级！Lv.${g._lastRunPrevLevel || 0} → Lv.${cult.level}  获得 ${levelUps} 修炼点`, W*0.5, expY + curLine)
      ctx.shadowBlur = 0
      curLine += 16*S
    }

    // 经验条 + 等级
    const barX = epx + 14*S, barW = panelW - 28*S, barH = 10*S
    const barY = expY + curLine
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    R.rr(barX, barY, barW, barH, barH/2); ctx.fill()
    if (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      const pct = Math.min(cult.exp / needed, 1)
      if (pct > 0) {
        const fillW = Math.max(barH, barW * pct)
        const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY)
        barGrad.addColorStop(0, '#d4a843'); barGrad.addColorStop(1, '#f0c860')
        ctx.fillStyle = barGrad
        R.rr(barX, barY, fillW, barH, barH/2); ctx.fill()
      }
      ctx.fillStyle = '#C8B78A'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText(`Lv.${cult.level}  ${cult.exp}/${needed}`, epx + panelW - 14*S, barY + barH + 12*S)
    } else {
      const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY)
      barGrad.addColorStop(0, '#d4a843'); barGrad.addColorStop(1, '#f0c860')
      ctx.fillStyle = barGrad
      R.rr(barX, barY, barW, barH, barH/2); ctx.fill()
      ctx.fillStyle = '#C8B78A'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'right'
      ctx.fillText(`Lv.${cult.level} 已满级`, epx + panelW - 14*S, barY + barH + 12*S)
    }
    ctx.textAlign = 'center'
    // 境界
    ctx.fillStyle = '#8a7a5a'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(`${currentRealm(cult.level).name}`, epx + 14*S, barY + barH + 12*S)
    ctx.textAlign = 'center'

    expPanelBottom = expY + expH
  }

  // 宠物经验获得展示
  if (g._lastRunPetExp > 0) {
    const petExpH = 30 * S
    const pePx = W * 0.08, pePanelW = W * 0.84
    const peY = expPanelBottom + 4 * S
    ctx.fillStyle = 'rgba(80,160,255,0.08)'
    R.rr(pePx, peY, pePanelW, petExpH, 8 * S); ctx.fill()
    ctx.fillStyle = '#8ac8ff'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`宠物经验池 +${g._lastRunPetExp}`, W * 0.5, peY + petExpH / 2 + 1)
    expPanelBottom = peY + petExpH
  }

  const bx = W*0.25, by = expPanelBottom + 16*S, bw = W*0.5, bh = 48*S
  R.drawBtn(bx, by, bw, bh, g.cleared ? '再次挑战' : '重新挑战', TH.accent, 18)
  g._goBtnRect = [bx, by, bw, bh]

  // "前往修炼"快捷按钮
  if (g._lastRunExp > 0) {
    const { hasCultUpgradeAvailable } = require('./cultivationView')
    if (hasCultUpgradeAvailable(g.storage)) {
      const cbw = W*0.35, cbh = 36*S
      const cbx = (W - cbw)/2, cby = by + bh + 10*S
      R.drawBtn(cbx, cby, cbw, cbh, '前往修炼', '#6a5a3a', 14)
      g._cultBtnRect = [cbx, cby, cbw, cbh]
    } else {
      g._cultBtnRect = null
    }
  } else {
    g._cultBtnRect = null
  }

  // "前往灵宠"快捷按钮
  if (g._lastRunPetExp > 0 && g.storage.petPoolCount > 0) {
    const goBtnBottom = g._cultBtnRect ? g._cultBtnRect[1] + g._cultBtnRect[3] : by + bh
    const pbw = W*0.35, pbh = 36*S
    const pbx = (W - pbw)/2, pby = goBtnBottom + 10*S
    R.drawBtn(pbx, pby, pbw, pbh, '前往灵宠', '#3a5a6a', 14)
    g._petPoolBtnRect = [pbx, pby, pbw, pbh]
  } else {
    g._petPoolBtnRect = null
  }

  drawBackBtn(g)
}

// ===== Ranking =====
function rRanking(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H)

  const padX = 12*S
  const tab = g.rankTab || 'all'

  // ── 标题区 ──
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('排行榜', W*0.5, safeTop + 40*S)
  ctx.restore()
  // 刷新按钮（紧跟标题文字右侧）
  ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  const titleW = ctx.measureText('排行榜').width || 66*S
  const rfW = 40*S, rfH = 22*S
  const rfX = W*0.5 + titleW/2 + 8*S
  const rfY = safeTop + 40*S - rfH*0.7
  ctx.fillStyle = g.storage.rankLoading ? 'rgba(40,30,15,0.5)' : 'rgba(40,30,15,0.75)'
  R.rr(rfX, rfY, rfW, rfH, rfH*0.5); ctx.fill()
  ctx.strokeStyle = g.storage.rankLoading ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.35)'
  ctx.lineWidth = 0.5*S; R.rr(rfX, rfY, rfW, rfH, rfH*0.5); ctx.stroke()
  ctx.fillStyle = g.storage.rankLoading ? 'rgba(240,220,160,0.35)' : 'rgba(240,220,160,0.8)'
  ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(g.storage.rankLoading ? '刷新中' : '刷新', rfX + rfW/2, rfY + rfH/2)
  ctx.textBaseline = 'alphabetic'
  g._rankRefreshRect = [rfX, rfY, rfW, rfH]
  const rdivW = W*0.22, rdivY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - rdivW, rdivY); ctx.lineTo(W*0.5 + rdivW, rdivY); ctx.stroke()

  // ── 4-Tab 切换 ──
  const tabY = safeTop + 56*S, tabH = 28*S
  const tabs = [
    { key: 'all', label: '速通榜' },
    { key: 'dex', label: '图鉴榜' },
    { key: 'combo', label: '连击榜' },
  ]
  const tabGap = 6*S
  const totalTabW = W - padX*2 - tabGap*(tabs.length-1)
  const singleTabW = totalTabW / tabs.length
  g._rankTabRects = {}
  tabs.forEach((t, i) => {
    const tx = padX + i * (singleTabW + tabGap)
    const isActive = tab === t.key
    if (isActive) {
      const tg = ctx.createLinearGradient(tx, tabY, tx, tabY + tabH)
      tg.addColorStop(0, '#f0c040'); tg.addColorStop(1, '#d4a020')
      ctx.fillStyle = tg
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
    }
    R.rr(tx, tabY, singleTabW, tabH, tabH*0.5); ctx.fill()
    if (isActive) {
      ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 1*S
      R.rr(tx, tabY, singleTabW, tabH, tabH*0.5); ctx.stroke()
    }
    ctx.fillStyle = isActive ? '#2a1a00' : TH.sub
    ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(t.label, tx + singleTabW*0.5, tabY + tabH*0.65)
    g._rankTabRects[t.key] = [tx, tabY, singleTabW, tabH]
  })

  // ── 列表区域 ──
  const listTop = tabY + tabH + 10*S
  const myBarH = 52*S
  const listBottom = H - myBarH - 16*S
  const rowH = 64*S

  // 根据Tab选择数据
  const listMap = { all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
  const rankMap = { all: 'rankAllMyRank', dex: 'rankDexMyRank', combo: 'rankComboMyRank' }
  const list = g.storage[listMap[tab]] || []
  const myRank = g.storage[rankMap[tab]] || -1

  // 列表面板背景
  const lpbg = ctx.createLinearGradient(padX, listTop, padX, listBottom)
  lpbg.addColorStop(0, 'rgba(30,25,18,0.7)'); lpbg.addColorStop(1, 'rgba(20,18,12,0.75)')
  ctx.fillStyle = lpbg; R.rr(padX, listTop, W - padX*2, listBottom - listTop, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.15)'; ctx.lineWidth = 0.5*S
  R.rr(padX, listTop, W - padX*2, listBottom - listTop, 10*S); ctx.stroke()

  // 表头（根据Tab显示不同列）
  const headerH = 26*S
  ctx.fillStyle = 'rgba(212,175,55,0.08)'
  R.rr(padX + 1, listTop + 1, W - padX*2 - 2, headerH, 8*S); ctx.fill()
  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'; ctx.fillText('排名', padX + 10*S, listTop + 17*S)
  ctx.fillText('玩家', padX + 52*S, listTop + 17*S)
  ctx.textAlign = 'right'
  if (tab === 'dex') ctx.fillText('图鉴数', W - padX - 10*S, listTop + 17*S)
  else if (tab === 'combo') ctx.fillText('最高连击', W - padX - 10*S, listTop + 17*S)
  else ctx.fillText('成绩', W - padX - 10*S, listTop + 17*S)

  const contentTop = listTop + headerH + 2*S
  ctx.save()
  ctx.beginPath(); ctx.rect(padX, contentTop, W - padX*2, listBottom - contentTop - 4*S); ctx.clip()

  if (g.storage.rankLoading && list.length === 0) {
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    const msg = g.storage.rankLoadingMsg || '加载中...'
    ctx.fillText(msg, W*0.5, contentTop + 60*S)
    // 加载动画：三个点闪烁
    const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4)
    ctx.fillStyle = TH.dim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(dots, W*0.5, contentTop + 85*S)
  } else if (list.length === 0) {
    ctx.fillStyle = TH.dim; ctx.font = `${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('暂无数据', W*0.5, contentTop + 60*S)
  } else {
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const ry = contentTop + i * rowH + (g.rankScrollY || 0)
      if (ry + rowH < contentTop || ry > listBottom) continue

      // 行背景（前三名特殊高亮）
      if (i < 3) {
        const rowGradColors = [
          ['rgba(255,215,0,0.12)', 'rgba(255,215,0,0.04)'],
          ['rgba(200,200,220,0.10)', 'rgba(200,200,220,0.03)'],
          ['rgba(205,127,50,0.10)', 'rgba(205,127,50,0.03)'],
        ]
        const rg = ctx.createLinearGradient(padX, ry, W - padX, ry)
        rg.addColorStop(0, rowGradColors[i][0]); rg.addColorStop(1, rowGradColors[i][1])
        ctx.fillStyle = rg
      } else {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.06)'
      }
      ctx.fillRect(padX + 2*S, ry + 1*S, W - padX*2 - 4*S, rowH - 3*S)

      // 排名序号（奖牌）
      _drawRankMedal(ctx, R, TH, S, padX, ry, rowH, i)

      // 头像
      const avatarX = padX + 40*S, avatarY = ry + (rowH - 34*S)/2, avatarSz = 34*S
      _drawAvatar(ctx, R, TH, S, item.avatarUrl, avatarX, avatarY, avatarSz, i)

      // 昵称 + 副信息
      const textX = avatarX + avatarSz + 8*S
      ctx.textAlign = 'left'
      ctx.fillStyle = i < 3 ? '#f0dca0' : TH.text; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
      ctx.fillText((item.nickName || '修士').substring(0, 8), textX, ry + 26*S)

      // 副信息行（根据Tab不同）
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      if (tab === 'all') {
        const petNames = (item.pets || []).map(p => p.name || '?').join(' ')
        const wpnName = item.weapon ? `⚔${item.weapon.name}` : ''
        const subText = `${petNames} ${wpnName}`
        const maxSubW = W - padX - 12*S - 30*S - textX
        const subW = ctx.measureText(subText).width
        if (subW > maxSubW && maxSubW > 0) {
          ctx.save()
          const subScale = maxSubW / subW
          ctx.font = `${Math.max(7, Math.floor(9 * subScale))*S}px "PingFang SC",sans-serif`
        }
        ctx.fillText(subText, textX, ry + 44*S)
        if (subW > maxSubW && maxSubW > 0) ctx.restore()
      } else if (tab === 'dex') {
        ctx.fillText(`已收集 ${item.petDexCount || 0}/100`, textX, ry + 44*S)
      } else if (tab === 'combo') {
        ctx.fillText(`最高连击记录`, textX, ry + 44*S)
      }

      // 右侧数值（根据Tab不同）
      ctx.textAlign = 'right'
      if (tab === 'all') {
        // 速通榜：同时显示层数和回合数
        const turns = item.totalTurns || 0
        ctx.fillStyle = i < 3 ? '#ffd700' : TH.accent; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        ctx.save(); if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${item.floor}`, W - padX - 12*S, ry + 24*S)
        ctx.restore()
        ctx.fillStyle = TH.dim; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('层', W - padX - 12*S, ry + 36*S)
        if (turns > 0) {
          ctx.fillStyle = i < 3 ? 'rgba(240,220,160,0.7)' : TH.sub; ctx.font = `${10*S}px "PingFang SC",sans-serif`
          ctx.fillText(`${turns}回合`, W - padX - 12*S, ry + 50*S)
        }
      } else if (tab === 'dex') {
        const dexCount = item.petDexCount || 0
        ctx.fillStyle = i < 3 ? '#ffd700' : '#4dcc4d'; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        ctx.save(); if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${dexCount}`, W - padX - 12*S, ry + 30*S)
        ctx.restore()
        ctx.fillStyle = TH.dim; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('/100', W - padX - 12*S, ry + 44*S)
      } else if (tab === 'combo') {
        const combo = item.maxCombo || 0
        ctx.fillStyle = i < 3 ? '#ffd700' : '#ff6b6b'; ctx.font = `bold ${20*S}px "PingFang SC",sans-serif`
        ctx.save(); if (i < 3) { ctx.shadowColor = 'rgba(255,215,0,0.25)'; ctx.shadowBlur = 4*S }
        ctx.fillText(`${combo}`, W - padX - 12*S, ry + 30*S)
        ctx.restore()
        ctx.fillStyle = TH.dim; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('连击', W - padX - 12*S, ry + 44*S)
      }
    }
  }
  ctx.restore()

  // ── 底部我的排名栏 ──
  const myBarY = listBottom + 6*S
  _drawMyRankBar(g, ctx, R, TH, W, S, padX, myBarY, myBarH, myRank, tab)

  drawBackBtn(g)
}

// 绘制排名奖牌/序号
function _drawRankMedal(ctx, R, TH, S, padX, ry, rowH, i) {
  ctx.textAlign = 'left'
  if (i < 3) {
    const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32']
    const medalBg = ['rgba(255,215,0,0.2)', 'rgba(192,192,192,0.15)', 'rgba(205,127,50,0.15)']
    const mx = padX + 18*S, my = ry + rowH*0.5
    const mr = 13*S
    ctx.fillStyle = medalBg[i]
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.fill()
    ctx.strokeStyle = medalColors[i] + '66'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI*2); ctx.stroke()
    ctx.fillStyle = medalColors[i]; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(`${i + 1}`, mx, my)
    ctx.textBaseline = 'alphabetic'
  } else {
    ctx.fillStyle = TH.dim; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(`${i + 1}`, padX + 18*S, ry + rowH*0.5 + 4*S)
  }
}

// 绘制头像
function _drawAvatar(ctx, R, TH, S, avatarUrl, avatarX, avatarY, avatarSz, rankIdx) {
  const avCx = avatarX + avatarSz/2, avCy = avatarY + avatarSz/2
  if (avatarUrl) {
    const avatarImg = R.getImg(avatarUrl)
    if (avatarImg && avatarImg.width > 0) {
      ctx.save()
      ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2, 0, Math.PI*2); ctx.clip()
      ctx.drawImage(avatarImg, avatarX, avatarY, avatarSz, avatarSz)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2, 0, Math.PI*2); ctx.fill()
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = TH.dim; ctx.font = `${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('?', avCx, avCy + 5*S)
  }
  if (rankIdx < 3) {
    const bc = ['#ffd700', '#c0c0c0', '#cd7f32']
    ctx.strokeStyle = bc[rankIdx] + '88'; ctx.lineWidth = 1.5*S
    ctx.beginPath(); ctx.arc(avCx, avCy, avatarSz/2 + 1*S, 0, Math.PI*2); ctx.stroke()
  }
}

// 底部我的排名栏
function _drawMyRankBar(g, ctx, R, TH, W, S, padX, myBarY, myBarH, myRank, tab) {
  const mbg = ctx.createLinearGradient(padX, myBarY, padX, myBarY + myBarH)
  mbg.addColorStop(0, 'rgba(50,40,20,0.88)'); mbg.addColorStop(1, 'rgba(30,25,12,0.92)')
  ctx.fillStyle = mbg; R.rr(padX, myBarY, W - padX*2, myBarH, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1.5*S
  R.rr(padX, myBarY, W - padX*2, myBarH, 10*S); ctx.stroke()
  ctx.save(); ctx.globalAlpha = 0.08
  const mhlg = ctx.createLinearGradient(padX, myBarY, padX, myBarY + 6*S)
  mhlg.addColorStop(0, '#fff'); mhlg.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = mhlg; R.rr(padX + 2*S, myBarY + 1, W - padX*2 - 4*S, 6*S, 10*S); ctx.fill()
  ctx.restore()

  // 头像
  const myAvatarSz = 36*S
  const myAvX = padX + 10*S, myAvY = myBarY + (myBarH - myAvatarSz) / 2
  const myAvCx = myAvX + myAvatarSz/2, myAvCy = myAvY + myAvatarSz/2
  const myAvatarUrl = g.storage.userInfo ? g.storage.userInfo.avatarUrl : ''
  if (myAvatarUrl) {
    const myAvImg = R.getImg(myAvatarUrl)
    if (myAvImg && myAvImg.width > 0) {
      ctx.save()
      ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2, 0, Math.PI*2); ctx.clip()
      ctx.drawImage(myAvImg, myAvX, myAvY, myAvatarSz, myAvatarSz)
      ctx.restore()
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)'
      ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2, 0, Math.PI*2); ctx.fill()
      ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
      ctx.fillText('我', myAvCx, myAvCy + 5*S)
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2, 0, Math.PI*2); ctx.fill()
    ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('我', myAvCx, myAvCy + 5*S)
  }
  ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 1.5*S
  ctx.beginPath(); ctx.arc(myAvCx, myAvCy, myAvatarSz/2 + 1*S, 0, Math.PI*2); ctx.stroke()

  // 昵称 + 排名
  const myTextX = myAvX + myAvatarSz + 8*S
  const myNick = g.storage.userInfo ? g.storage.userInfo.nickName : '我'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(`${myNick}`, myTextX, myBarY + 22*S)
  if (myRank > 0) {
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`第 ${myRank} 名`, myTextX, myBarY + 40*S)
  } else {
    ctx.fillStyle = TH.dim; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText('未上榜', myTextX, myBarY + 40*S)
  }

  // 右侧我的数值
  ctx.textAlign = 'right'
  if (tab === 'all') {
    const bestTurns = g.storage.stats.bestTotalTurns || 0
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(255,215,0,0.2)'; ctx.shadowBlur = 4*S
    ctx.fillText(`${g.storage.bestFloor}`, W - padX - 30*S, myBarY + 24*S)
    ctx.restore()
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('层', W - padX - 14*S, myBarY + 24*S)
    if (bestTurns > 0) {
      ctx.fillStyle = 'rgba(240,220,160,0.7)'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(`${bestTurns}回合`, W - padX - 14*S, myBarY + 42*S)
    }
  } else if (tab === 'dex') {
    const dexCount = (g.storage.petDex || []).length
    ctx.fillStyle = '#4dcc4d'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(77,204,77,0.2)'; ctx.shadowBlur = 4*S
    ctx.fillText(`${dexCount}`, W - padX - 38*S, myBarY + 34*S)
    ctx.restore()
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('/100', W - padX - 14*S, myBarY + 34*S)
  } else if (tab === 'combo') {
    const mc = g.storage.stats.maxCombo || 0
    ctx.fillStyle = '#ff6b6b'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
    ctx.save(); ctx.shadowColor = 'rgba(255,107,107,0.2)'; ctx.shadowBlur = 4*S
    ctx.fillText(`${mc}`, W - padX - 46*S, myBarY + 34*S)
    ctx.restore()
    ctx.fillStyle = TH.dim; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('连击', W - padX - 14*S, myBarY + 34*S)
  }
}

// ===== Stats =====
function rStats(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, W, H)

  const padX = 14*S
  const st = g.storage.stats
  const heroW = W - padX*2

  // ── 标题区 ──
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('我的战绩', W*0.5, safeTop + 40*S)
  ctx.restore()
  const sdivW = W*0.22, sdivY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - sdivW, sdivY); ctx.lineTo(W*0.5 + sdivW, sdivY); ctx.stroke()

  // ── 核心成就：大卡片（最高层 + 最快通关）──
  const heroY = safeTop + 58*S
  const heroH = 70*S
  const hbg = ctx.createLinearGradient(padX, heroY, padX, heroY + heroH)
  hbg.addColorStop(0, 'rgba(252,247,238,0.95)'); hbg.addColorStop(1, 'rgba(244,237,222,0.95)')
  ctx.fillStyle = hbg; R.rr(padX, heroY, heroW, heroH, 12*S); ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5*S
  R.rr(padX, heroY, heroW, heroH, 12*S); ctx.stroke()

  // 左侧：最高层数
  const bestFloor = g.storage.bestFloor
  const isCleared = bestFloor >= 30
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8B6914'; ctx.font = `bold ${28*S}px "PingFang SC",sans-serif`
  ctx.fillText(isCleared ? '通关' : `第 ${bestFloor} 层`, W*0.3, heroY + 34*S)
  ctx.fillStyle = '#9B8B70'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(isCleared ? '已登顶通天塔' : '最高层数', W*0.3, heroY + 52*S)

  // 分隔线
  ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5, heroY + 12*S); ctx.lineTo(W*0.5, heroY + heroH - 12*S); ctx.stroke()

  // 右侧：最快通关 / 暂无
  const bestTurns = st.bestTotalTurns || 0
  if (bestTurns > 0) {
    ctx.fillStyle = '#C0392B'; ctx.font = `bold ${28*S}px "PingFang SC",sans-serif`
    ctx.fillText(`${bestTurns}`, W*0.7, heroY + 34*S)
    ctx.fillStyle = '#9B8B70'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('最速通关回合', W*0.7, heroY + 52*S)
  } else {
    ctx.fillStyle = '#bbb0a0'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
    ctx.fillText('—', W*0.7, heroY + 34*S)
    ctx.fillStyle = '#bbb0a0'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('通关后解锁', W*0.7, heroY + 52*S)
  }

  // ── 6项统计数据：三列两行 ──
  const gridY = heroY + heroH + 10*S
  const colCount = 3, rowCount = 2
  const colGap = 6*S, rowGap = 6*S
  const colW = (heroW - colGap * (colCount - 1)) / colCount
  const cardH = 56*S
  const dexCount = (g.storage.petDex || []).length
  const avgVal = st.totalBattles > 0 ? (st.totalCombos / st.totalBattles).toFixed(1) : '0'
  const statCards = [
    { label: '总挑战', value: `${g.storage.totalRuns}`, unit: '次', color: TH.accent },
    { label: '总战斗', value: `${st.totalBattles}`, unit: '场', color: '#4dabff' },
    { label: '图鉴收集', value: `${dexCount}`, unit: '/100', color: '#4dcc4d' },
    { label: '最高连击', value: `${st.maxCombo}`, unit: '连', color: '#ff6b6b' },
    { label: '总Combo', value: `${st.totalCombos}`, unit: '次', color: '#e0a020' },
    { label: '场均Combo', value: `${avgVal}`, unit: '次', color: '#c084fc' },
  ]
  statCards.forEach((card, i) => {
    const col = i % colCount, row = Math.floor(i / colCount)
    const cx = padX + col * (colW + colGap)
    const cy = gridY + row * (cardH + rowGap)
    ctx.fillStyle = 'rgba(248,242,230,0.93)'
    R.rr(cx, cy, colW, cardH, 8*S); ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.25)'; ctx.lineWidth = 0.5*S
    R.rr(cx, cy, colW, cardH, 8*S); ctx.stroke()
    ctx.textAlign = 'center'
    ctx.fillStyle = card.color; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
    const valW2 = ctx.measureText(card.value).width
    // 数值+单位整体居中
    const unitFont = `bold ${9*S}px "PingFang SC",sans-serif`
    ctx.font = unitFont
    const unitW = ctx.measureText(card.unit).width
    const totalW = valW2 + 3*S + unitW
    const valX = cx + (colW - totalW) / 2 + valW2 / 2
    ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
    ctx.fillText(card.value, valX, cy + 24*S)
    ctx.fillStyle = '#8B7B60'; ctx.font = unitFont
    ctx.textAlign = 'left'
    ctx.fillText(card.unit, valX + valW2/2 + 3*S, cy + 24*S)
    ctx.textAlign = 'center'
    ctx.fillStyle = '#6B5B40'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(card.label, cx + colW*0.5, cy + 43*S)
  })

  // ── 图鉴进度条 ──
  const barY = gridY + rowCount * (cardH + rowGap) + 4*S
  const barH = 30*S
  ctx.fillStyle = 'rgba(248,242,230,0.93)'
  R.rr(padX, barY, heroW, barH, 8*S); ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.25)'; ctx.lineWidth = 0.5*S
  R.rr(padX, barY, heroW, barH, 8*S); ctx.stroke()
  // 进度条
  const pbX = padX + 80*S, pbY = barY + 10*S, pbW = heroW - 94*S, pbH = 10*S
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  R.rr(pbX, pbY, pbW, pbH, pbH*0.5); ctx.fill()
  const pct = Math.min(dexCount / 100, 1)
  if (pct > 0) {
    const pg = ctx.createLinearGradient(pbX, pbY, pbX + pbW * pct, pbY)
    pg.addColorStop(0, '#4dcc4d'); pg.addColorStop(1, '#80ff80')
    ctx.fillStyle = pg
    R.rr(pbX, pbY, pbW * pct, pbH, pbH*0.5); ctx.fill()
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = '#8B7B60'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('图鉴进度', padX + 10*S, barY + barH*0.62)
  ctx.textAlign = 'right'
  ctx.fillStyle = '#2d8c2d'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(`${dexCount}/100`, W - padX - 10*S, barY + barH*0.62)

  // ── 最高记录阵容 ──
  const teamY = barY + barH + 10*S
  const teamH = 70*S
  ctx.fillStyle = 'rgba(248,242,230,0.93)'
  R.rr(padX, teamY, heroW, teamH, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.3)'; ctx.lineWidth = 1*S
  R.rr(padX, teamY, heroW, teamH, 10*S); ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#8B6914'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('✦ 最高记录阵容 ✦', W*0.5, teamY + 16*S)
  const bfPets = st.bestFloorPets || []
  const bfWeapon = st.bestFloorWeapon
  if (bfPets.length > 0) {
    const petW = heroW / Math.max(bfPets.length, 1)
    bfPets.forEach((p, i) => {
      const px = padX + petW * i + petW*0.5
      const ac = ATTR_COLOR[p.attr]
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(p.name, px, teamY + 38*S)
      ctx.beginPath(); ctx.arc(px, teamY + 45*S, 2.5*S, 0, Math.PI*2)
      ctx.fillStyle = ac ? ac.main : TH.dim; ctx.fill()
    })
    if (bfWeapon) {
      ctx.font = `${10*S}px "PingFang SC",sans-serif`
      const _bfLabel = '法宝·'
      const _bfLabelW = ctx.measureText(_bfLabel).width
      const _bfFull = _bfLabel + bfWeapon.name
      const _bfFullW = ctx.measureText(_bfFull).width
      const _bfStartX = W*0.5 - _bfFullW/2
      ctx.textAlign = 'left'
      ctx.fillStyle = '#8B6914'
      ctx.fillText(_bfLabel, _bfStartX, teamY + 60*S)
      ctx.fillStyle = '#6B5014'
      ctx.fillText(bfWeapon.name, _bfStartX + _bfLabelW, teamY + 60*S)
      ctx.textAlign = 'center'
    }
  } else {
    ctx.fillStyle = '#bbb0a0'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText('暂无记录', W*0.5, teamY + 42*S)
  }

  // ── 分享战绩按钮（暖金扁平风格） ──
  const shareBtnW = W*0.52, shareBtnH = 36*S
  const shareBtnX = (W - shareBtnW) / 2
  const shareBtnY = teamY + teamH + 14*S
  ctx.save()
  ctx.fillStyle = '#d4a840'
  R.rr(shareBtnX, shareBtnY, shareBtnW, shareBtnH, shareBtnH*0.5); ctx.fill()
  ctx.strokeStyle = 'rgba(160,130,40,0.35)'; ctx.lineWidth = 1*S
  R.rr(shareBtnX, shareBtnY, shareBtnW, shareBtnH, shareBtnH*0.5); ctx.stroke()
  ctx.fillStyle = '#4A3010'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('分享战绩给好友', shareBtnX + shareBtnW/2, shareBtnY + shareBtnH/2)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
  g._statsShareBtnRect = [shareBtnX, shareBtnY, shareBtnW, shareBtnH]

  drawBackBtn(g)
}

// ===== Reward =====
function _wrapText(text, maxW, fontSize) {
  const S = V.S
  const charW = fontSize * S * 0.55
  const maxChars = Math.floor(maxW / charW)
  if (maxChars <= 0) return [text]
  const result = []
  let rest = text
  while (rest.length > 0) {
    result.push(rest.substring(0, maxChars))
    rest = rest.substring(maxChars)
  }
  return result.length > 0 ? result : [text]
}

function rReward(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const { REWARD_TYPES } = require('../data/tower')
  R.drawRewardBg(g.af)
  ctx.textAlign = 'center'
  const evtType = g.curEvent ? g.curEvent.type : ''
  let title = '战斗胜利 - 选择奖励'
  if (evtType === 'elite') title = '精英击败 - 选择灵兽'
  else if (evtType === 'boss') title = 'BOSS击败 - 选择奖励'
  // 标题
  const titleBaseY = safeTop + 58*S
  ctx.fillStyle = '#5C3A1E'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  ctx.fillText(title, W*0.5, titleBaseY)
  // 标题下方装饰分割线
  const divW = W*0.36, divY = titleBaseY + 6*S
  ctx.strokeStyle = 'rgba(139,105,20,0.4)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  let headerOffset = 0
  if (g.lastSpeedKill) {
    ctx.fillStyle = '#8B6914'; ctx.font = `${12*S}px "PingFang SC",sans-serif`
    ctx.fillText(`⚡ 速通达成 (${g.lastTurnCount}回合) — 额外选项已解锁`, W*0.5, titleBaseY + 22*S)
    headerOffset = 22*S
  }
  if (!g.rewards) return
  const rewardCount = g.rewards.length
  const isPetOrWeapon = g.rewards.some(rw => rw.type === REWARD_TYPES.NEW_PET || rw.type === REWARD_TYPES.NEW_WEAPON)
  const maxCardArea = H * 0.65
  const gap = 10*S
  const defaultCardH = isPetOrWeapon ? 170*S : 105*S
  const cardH = Math.min(defaultCardH, (maxCardArea - (rewardCount-1)*gap) / rewardCount)
  const cardW = W*0.96
  const cardX = (W - cardW) / 2
  const startY = H*0.17 + headerOffset
  g._rewardRects = []

  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }

  g.rewards.forEach((rw, i) => {
    const cy = startY + i*(cardH+gap)
    const selected = g.selectedReward === i
    const isSpeedBuff = rw.isSpeed === true

    // 卡片背景：深琥珀金，厚重暖调
    let bgColor = selected ? 'rgba(75,50,20,0.93)' : 'rgba(65,45,18,0.88)'
    let borderColor = selected ? '#E8C060' : 'rgba(180,150,90,0.4)'
    if (rw.type === REWARD_TYPES.NEW_PET) {
      const ac = ATTR_COLOR[rw.data.attr]
      if (selected && ac) borderColor = ac.main
    }

    const rewardCardBg = R.getImg('assets/ui/reward_card_bg.png')
    const _useScrollBg = rewardCardBg && rewardCardBg.width > 0

    // 卷轴绘制区域比内容区左右各多延伸，让木轴完整显示
    const scrollPadX = 6 * S
    const scrollPadY = 4 * S
    const scrollX = cardX - scrollPadX
    const scrollY = cy - scrollPadY
    const scrollW = cardW + scrollPadX * 2
    const scrollH = cardH + scrollPadY * 2

    if (_useScrollBg) {
      // 卷轴模式：投影打在卷轴形状上，不画矩形底色
      ctx.save()
      ctx.shadowColor = 'rgba(40,25,10,0.45)'
      ctx.shadowBlur = 12 * S
      ctx.shadowOffsetY = 4 * S
      ctx.drawImage(rewardCardBg, scrollX, scrollY, scrollW, scrollH)
      ctx.restore()
      // 选中态：卷轴外围发光
      if (selected) {
        ctx.save()
        ctx.shadowColor = borderColor
        ctx.shadowBlur = 16 * S
        ctx.globalAlpha = 0.6
        ctx.drawImage(rewardCardBg, scrollX, scrollY, scrollW, scrollH)
        ctx.restore()
      }
    } else {
      // 无卷轴图降级：矩形底色 + 投影
      ctx.save()
      ctx.shadowColor = 'rgba(40,25,10,0.5)'
      ctx.shadowBlur = 14 * S
      ctx.shadowOffsetY = 5 * S
      ctx.fillStyle = bgColor
      R.rr(cardX, cy, cardW, cardH, 10*S); ctx.fill()
      ctx.restore()
      ctx.save()
      ctx.shadowColor = selected ? 'rgba(230,200,100,0.6)' : 'rgba(180,150,80,0.2)'
      ctx.shadowBlur = selected ? 18 * S : 8 * S
      ctx.strokeStyle = selected ? 'rgba(230,200,100,0.7)' : 'rgba(180,150,90,0.35)'
      ctx.lineWidth = selected ? 2.5 * S : 1.5 * S
      R.rr(cardX, cy, cardW, cardH, 10*S); ctx.stroke()
      ctx.restore()
      if (selected) {
        ctx.strokeStyle = borderColor; ctx.lineWidth = 2.5*S
        R.rr(cardX, cy, cardW, cardH, 10*S); ctx.stroke()
      }
    }

    // 卷轴亮底 vs 降级深底的文字配色切换
    const _darkText = _useScrollBg
    const _txtMain   = _darkText ? '#2A1A10' : '#FFF2D0'
    const _txtSub    = _darkText ? '#3F3025' : 'rgba(235,225,200,0.9)'
    const _txtDim    = _darkText ? '#4A3A2E' : 'rgba(220,205,170,0.75)'
    const _txtGold   = _darkText ? '#7A590A' : '#FFD870'
    const _txtGreen  = _darkText ? '#1E7A42' : '#6EEE9A'
    const _txtOrange = _darkText ? '#A85C00' : '#F0C050'
    const _txtStroke = _darkText ? 'rgba(255,248,232,0.7)' : 'rgba(30,20,5,0.6)'

    // 卷轴模式下头像右移，避开左侧木轴
    const _contentPadL = _useScrollBg ? 38*S : 12*S

    if (rw.type === REWARD_TYPES.NEW_PET && rw.data) {
      // ====== 灵兽卡片：头像框 + 详细信息 ======
      const p = rw.data
      const ac = ATTR_COLOR[p.attr]
      const avSz = Math.min(56*S, cardH - 16*S)
      const avX = cardX + _contentPadL
      const avY = cy + (cardH - avSz) / 2

      // 头像背景
      ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
      R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()

      // 头像图片
      const petAvatar = R.getImg(getPetAvatarPath(p))
      if (petAvatar && petAvatar.width > 0) {
        ctx.save()
        ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
        const aw = petAvatar.width, ah = petAvatar.height
        const dw = avSz - 2, dh = dw * (ah/aw)
        ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
        ctx.restore()
      } else {
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${avSz*0.35}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(ATTR_NAME[p.attr] || '', avX + avSz/2, avY + avSz/2)
        ctx.textBaseline = 'alphabetic'
      }

      // 头像框
      const petFrame = framePetMap[p.attr] || framePetMap.metal
      if (petFrame && petFrame.width > 0) {
        const fScale = 1.12, fSz = avSz * fScale, fOff = (fSz - avSz)/2
        ctx.drawImage(petFrame, avX - fOff, avY - fOff, fSz, fSz)
      }

      // 已拥有判断（用于头像下方星级 & 名称后升星标注）
      const allOwned = [...(g.pets || []), ...(g.petBag || [])]
      const ownedPet = allOwned.find(op => op.id === p.id)

      // 头像下方标签：已拥有显示星级，未拥有显示"新"
      ctx.textAlign = 'center'
      if (ownedPet) {
        const ownedStar = ownedPet.star || 1
        const starFontSz = 12*S
        const starGap = 14*S
        const totalStarW = ownedStar * starGap
        const starStartX = avX + avSz/2 - totalStarW/2 + starGap/2
        const starY = avY + avSz + 15*S
        ctx.save()
        ctx.font = `bold ${starFontSz}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        for (let si = 0; si < ownedStar; si++) {
          const sx = starStartX + si * starGap
          ctx.strokeStyle = '#3A2A10'; ctx.lineWidth = 3*S
          ctx.strokeText('★', sx, starY)
          ctx.fillStyle = '#FFD700'
          ctx.fillText('★', sx, starY)
        }
        ctx.restore()
      } else {
        ctx.save()
        const newX = avX + avSz/2, newY = avY + avSz + 15*S
        ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'
        ctx.fillStyle = '#E04040'
        ctx.fillText('新', newX, newY)
        ctx.restore()
      }

      // 右侧文字信息
      const _contentPadR = _useScrollBg ? 32*S : 10*S
      const infoX = avX + avSz + 14*S
      const textMaxW = cardX + cardW - infoX - _contentPadR
      let iy = cy + 36*S

      // 名称 + 属性球 + 升星标注
      ctx.textAlign = 'left'
      ctx.fillStyle = _txtMain; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 2 * S; ctx.strokeText(p.name, infoX, iy) }
      ctx.fillText(p.name, infoX, iy)
      let nameEndX = infoX + ctx.measureText(p.name).width
      const orbR = 7*S
      R.drawBead(nameEndX + 7*S + orbR, iy - orbR*0.4, orbR, p.attr, 0)
      nameEndX += 7*S + orbR*2 + 4*S

      if (ownedPet) {
        const ownedStar = ownedPet.star || 1
        if (ownedStar >= MAX_STAR) {
          ctx.fillStyle = _txtOrange; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
          ctx.fillText('已满星', nameEndX, iy)
        } else {
          ctx.fillStyle = _txtGreen; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
          ctx.fillText(`可升至${ownedStar+1}星`, nameEndX, iy)
        }
      }

      // ATK + CD
      iy += 22*S
      ctx.fillStyle = _txtSub; ctx.font = `${13*S}px "PingFang SC",sans-serif`
      ctx.fillText(`ATK: ${p.atk}    CD: ${p.cd}回合`, infoX, iy)

      // 技能
      if (p.skill) {
        iy += 20*S
        if (petHasSkill(p)) {
          ctx.fillStyle = _txtGold; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
          if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.5 * S; ctx.strokeText(`技能：${p.skill.name}`, infoX, iy) }
          ctx.fillText(`技能：${p.skill.name}`, infoX, iy)
          iy += 18*S
          ctx.fillStyle = _txtDim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
          const descLines = _wrapText(getPetSkillDesc(p), textMaxW, 12)
          descLines.forEach(line => {
            if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(line, infoX, iy) }
            ctx.fillText(line, infoX, iy)
            iy += 16*S
          })
        } else {
          ctx.fillStyle = _txtDim; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
          if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.5 * S; ctx.strokeText('技能：升至★2解锁', infoX, iy) }
          ctx.fillText('技能：升至★2解锁', infoX, iy)
          iy += 18*S
          ctx.fillStyle = _txtDim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
          const lockedSkillLines = _wrapText(`（${p.skill.name}：${p.skill.desc}）`, textMaxW, 12)
          lockedSkillLines.forEach(line => {
            if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(line, infoX, iy) }
            ctx.fillText(line, infoX, iy)
            iy += 16*S
          })
          iy -= 16*S
        }
      }

    } else if (rw.type === REWARD_TYPES.NEW_WEAPON && rw.data) {
      // ====== 法宝卡片：图标 + 详细信息 ======
      const w = rw.data
      const avSz = Math.min(56*S, cardH - 16*S)
      const avX = cardX + _contentPadL
      const avY = cy + (cardH - avSz) / 2

      // 法宝图标背景
      ctx.fillStyle = '#f0e8d8'
      R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()

      // 法宝图标（尝试加载图片）
      const wpnImg = R.getImg(`assets/equipment/fabao_${w.id}.png`)
      if (wpnImg && wpnImg.width > 0) {
        ctx.save()
        ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
        const aw = wpnImg.width, ah = wpnImg.height
        const dw = avSz - 2, dh = dw * (ah/aw)
        ctx.drawImage(wpnImg, avX+1, avY+1+(avSz-2-dh), dw, dh)
        ctx.restore()
      } else {
        // 降级：绘制法宝文字符号
        ctx.fillStyle = '#ffd700'; ctx.font = `bold ${avSz*0.4}px "PingFang SC",sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', avX + avSz/2, avY + avSz/2)
        ctx.textBaseline = 'alphabetic'
      }

      // 法宝框
      R.drawWeaponFrame(avX, avY, avSz)

      // 右侧文字信息
      const _contentPadR = _useScrollBg ? 32*S : 10*S
      const infoX = avX + avSz + 14*S
      const textMaxW = cardX + cardW - infoX - _contentPadR
      let iy = cy + 36*S

      // 法宝名称
      ctx.textAlign = 'left'
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 2 * S }
      const _rwLabel = '法宝·'
      ctx.fillStyle = _txtGold; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      if (_txtStroke) ctx.strokeText(_rwLabel, infoX, iy)
      ctx.fillText(_rwLabel, infoX, iy)
      const _rwLabelW = ctx.measureText(_rwLabel).width
      ctx.fillStyle = _txtMain
      if (_txtStroke) ctx.strokeText(w.name, infoX + _rwLabelW, iy)
      ctx.fillText(w.name, infoX + _rwLabelW, iy)

      const nameW = ctx.measureText(w.name).width

      // 法宝效果描述
      iy += 24*S
      ctx.fillStyle = _txtSub; ctx.font = `${13*S}px "PingFang SC",sans-serif`
      if (w.desc) {
        const descLines = _wrapText(w.desc, textMaxW, 13)
        descLines.forEach(line => {
          if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(line, infoX, iy) }
          ctx.fillText(line, infoX, iy)
          iy += 18*S
        })
      }

      // 属性相关提示（属性球代替文字）
      if (w.attr) {
        ctx.fillStyle = _txtDim; ctx.font = `${12*S}px "PingFang SC",sans-serif`
        if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText('对应属性：', infoX, iy) }
        ctx.fillText('对应属性：', infoX, iy)
        const labelW = ctx.measureText('对应属性：').width
        const orbR = 7*S
        R.drawBead(infoX + labelW + orbR, iy - orbR*0.4, orbR, w.attr, 0)
      }

    } else {
      // ====== 普通Buff卡片：图标 + 文字 ======
      const buffData = rw.data || {}
      const buffKey = buffData.buff || ''
      // 根据图标分类显示不同加成类型名称
      const BUFF_TYPE_NAMES = {
        buff_icon_atk: '攻击加成', buff_icon_heal: '治疗加成', buff_icon_def: '防御加成',
        buff_icon_elim: '消除加成', buff_icon_time: '时间加成', buff_icon_hp: '血量加成',
        buff_icon_weaken: '削弱加成', buff_icon_special: '特殊加成',
      }
      let typeTag = '', tagColor = _txtDim
      if (isSpeedBuff) { typeTag = '⚡速通'; tagColor = _txtGold }
      else { typeTag = '加成'; tagColor = _txtDim }

      // buff图标（左侧，放大）
      const iconSz = Math.min(48*S, cardH - 10*S)
      const iconX = cardX + _contentPadL + 2*S, iconY = cy + (cardH - iconSz) / 2
      const BUFF_ICON_IMGS = {
        allAtkPct:'buff_icon_atk', allDmgPct:'buff_icon_atk', counterDmgPct:'buff_icon_atk', skillDmgPct:'buff_icon_atk',
        healNow:'buff_icon_heal', postBattleHeal:'buff_icon_heal', regenPerTurn:'buff_icon_heal',
        dmgReducePct:'buff_icon_def', nextDmgReduce:'buff_icon_def', grantShield:'buff_icon_def', immuneOnce:'buff_icon_def',
        comboDmgPct:'buff_icon_elim', elim3DmgPct:'buff_icon_elim', elim4DmgPct:'buff_icon_elim', elim5DmgPct:'buff_icon_elim', bonusCombo:'buff_icon_elim',
        extraTimeSec:'buff_icon_time', skillCdReducePct:'buff_icon_time', resetAllCd:'buff_icon_time',
        hpMaxPct:'buff_icon_hp',
        enemyAtkReducePct:'buff_icon_weaken', enemyHpReducePct:'buff_icon_weaken', eliteAtkReducePct:'buff_icon_weaken',
        eliteHpReducePct:'buff_icon_weaken', bossAtkReducePct:'buff_icon_weaken', bossHpReducePct:'buff_icon_weaken',
        nextStunEnemy:'buff_icon_weaken', stunDurBonus:'buff_icon_weaken',
        extraRevive:'buff_icon_special', skipNextBattle:'buff_icon_special', nextFirstTurnDouble:'buff_icon_special', heartBoostPct:'buff_icon_special',
      }
      const iconName = BUFF_ICON_IMGS[buffKey]
      const iconImg = iconName ? R.getImg(`assets/ui/${iconName}.png`) : null
      if (iconImg && iconImg.width > 0) {
        ctx.drawImage(iconImg, iconX, iconY, iconSz, iconSz)
      }
      // 根据图标类型覆盖加成名称
      if (!isSpeedBuff && iconName && BUFF_TYPE_NAMES[iconName]) {
        typeTag = BUFF_TYPE_NAMES[iconName]
      }

      // 类型标签（图标右上方）
      const textX = iconX + iconSz + 10*S
      ctx.fillStyle = tagColor; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText(typeTag, textX, cy + cardH*0.38) }
      ctx.fillText(typeTag, textX, cy + cardH*0.38)

      // 名称（居中偏右）
      ctx.fillStyle = _txtMain; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.5 * S; ctx.strokeText(rw.label, textX, cy + cardH*0.62) }
      ctx.fillText(rw.label, textX, cy + cardH*0.62)

      // 底部提示
      ctx.fillStyle = _txtDim; ctx.font = `${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
      if (_txtStroke) { ctx.strokeStyle = _txtStroke; ctx.lineWidth = 1.2 * S; ctx.strokeText('全队永久生效', textX, cy + cardH*0.84) }
      ctx.fillText('全队永久生效', textX, cy + cardH*0.84)
    }
    g._rewardRects.push([cardX, cy, cardW, cardH])
  })

  // 确认按钮
  if (g.selectedReward >= 0) {
    const bx = W*0.25, by = H*0.86, bw = W*0.5, bh = 44*S
    const confirmBtnImg = R.getImg('assets/ui/btn_reward_confirm.png')
    if (confirmBtnImg && confirmBtnImg.width) {
      ctx.drawImage(confirmBtnImg, bx, by, bw, bh)
      ctx.fillStyle = '#4A2020'; ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('确认', bx + bw*0.5, by + bh*0.48)
      ctx.textBaseline = 'alphabetic'
    } else {
      R.drawBtn(bx, by, bw, bh, '确认', TH.accent, 16)
    }
    g._rewardConfirmRect = [bx, by, bw, bh]
  }
  // 从战斗胜利进入奖励页时不显示返回按钮
  if (g.bState !== 'victory') {
    drawBackBtn(g)
  } else {
    g._backBtnRect = null
  }
}

// ===== Shop =====
function rShop(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawShopBg(g.af)
  // 标题区域：仙侠书法风
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('神秘商店', W*0.5, safeTop + 40*S)
  ctx.restore()
  // 装饰分割线
  const divW = W*0.25, divY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  ctx.fillStyle = g.shopUsed ? TH.dim : '#e8a840'; ctx.font = `${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(g.shopUsed ? '已选择物品' : '免费选择一件', W*0.5, safeTop + 68*S)
  if (!g.shopItems) return
  const cardW = W*0.84, cardH = 62*S, gap = 10*S, startY = safeTop + 90*S
  g._shopRects = []
  g.shopItems.forEach((item, i) => {
    const cx = (W - cardW) / 2, cy = startY + i*(cardH+gap)
    // 卡片背景：暗色渐变+金边
    const cbg = ctx.createLinearGradient(cx, cy, cx, cy + cardH)
    cbg.addColorStop(0, 'rgba(30,25,18,0.88)'); cbg.addColorStop(1, 'rgba(20,18,12,0.92)')
    ctx.fillStyle = cbg; R.rr(cx, cy, cardW, cardH, 10*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1*S
    R.rr(cx, cy, cardW, cardH, 10*S); ctx.stroke()
    // 左侧装饰竖条
    ctx.fillStyle = 'rgba(212,175,55,0.4)'
    R.rr(cx + 4*S, cy + 6*S, 3*S, cardH - 12*S, 1.5*S); ctx.fill()
    // 名称（左对齐，带描述）
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
    ctx.fillText(item.name, cx + 16*S, cy + 26*S)
    if (item.desc) {
      ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
      ctx.fillText(item.desc, cx + 16*S, cy + 46*S)
    }
    ctx.textAlign = 'center'
    g._shopRects.push([cx, cy, cardW, cardH])
  })
  const bx = W*0.3, by = H*0.82, bw = W*0.4, bh = 40*S
  R.drawBtn(bx, by, bw, bh, '离开', TH.info, 14)
  g._shopLeaveRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== Rest =====
function rRest(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawRestBg(g.af)
  // 标题
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('休息之地', W*0.5, safeTop + 40*S)
  ctx.restore()
  const divW = W*0.25, divY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('选择一项恢复方式', W*0.5, safeTop + 66*S)
  if (!g.restOpts) return
  const cardW = W*0.78, cardH = 72*S, gap = 14*S, startY = safeTop + 90*S
  g._restRects = []
  const restIcons = ['🧘', '💊', '🛡']
  g.restOpts.forEach((opt, i) => {
    const cx = (W - cardW) / 2, cy = startY + i*(cardH+gap)
    // 卡片背景
    const cbg = ctx.createLinearGradient(cx, cy, cx, cy + cardH)
    cbg.addColorStop(0, 'rgba(30,25,18,0.85)'); cbg.addColorStop(1, 'rgba(20,18,12,0.9)')
    ctx.fillStyle = cbg; R.rr(cx, cy, cardW, cardH, 10*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.25)'; ctx.lineWidth = 1*S
    R.rr(cx, cy, cardW, cardH, 10*S); ctx.stroke()
    // 左侧图标区
    const iconSz = 36*S, iconX = cx + 14*S, iconY = cy + (cardH - iconSz)/2
    ctx.fillStyle = 'rgba(212,175,55,0.1)'
    R.rr(iconX, iconY, iconSz, iconSz, 8*S); ctx.fill()
    ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 0.5*S
    R.rr(iconX, iconY, iconSz, iconSz, 8*S); ctx.stroke()
    ctx.font = `${20*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(restIcons[i] || '✨', iconX + iconSz/2, iconY + iconSz/2)
    ctx.textBaseline = 'alphabetic'
    // 右侧文字
    ctx.textAlign = 'left'
    ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
    ctx.fillText(opt.name, iconX + iconSz + 12*S, cy + 30*S)
    ctx.fillStyle = TH.sub; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(opt.desc, iconX + iconSz + 12*S, cy + 50*S)
    ctx.textAlign = 'center'
    g._restRects.push([(W - cardW)/2, cy, cardW, cardH])
  })
  drawBackBtn(g)
}

// ===== Adventure =====
function rAdventure(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawAdventureBg(g.af)
  // 标题
  ctx.save()
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`
  ctx.fillText('奇遇', W*0.5, safeTop + 40*S)
  ctx.restore()
  const divW = W*0.18, divY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  if (!g.adventureData) return
  // 内容面板
  const panelW = W*0.82, panelH = 160*S
  const panelX = (W - panelW)/2, panelY = H*0.26
  const pbg = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH)
  pbg.addColorStop(0, 'rgba(30,25,18,0.88)'); pbg.addColorStop(1, 'rgba(20,18,12,0.92)')
  ctx.fillStyle = pbg; R.rr(panelX, panelY, panelW, panelH, 12*S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.3)'; ctx.lineWidth = 1*S
  R.rr(panelX, panelY, panelW, panelH, 12*S); ctx.stroke()
  // 奇遇名
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`
  ctx.fillText(g.adventureData.name, W*0.5, panelY + 42*S)
  // 描述
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3*S
  ctx.fillStyle = '#fff'; ctx.font = `${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(g.adventureData.desc, W*0.5, panelY + 72*S)
  // 显示具体获得结果
  if (g._adventureResult) {
    ctx.fillStyle = '#ffd54f'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
    ctx.fillText(g._adventureResult, W*0.5, panelY + 94*S)
  }
  ctx.restore()
  // 效果标记
  ctx.save()
  ctx.shadowColor = 'rgba(212,175,55,0.4)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#ffe066'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText('✦ 效果已生效 ✦', W*0.5, panelY + (g._adventureResult ? 120 : 116)*S)
  ctx.restore()
  const bx = W*0.3, by = H*0.68, bw = W*0.4, bh = 44*S
  R.drawBtn(bx, by, bw, bh, '继续', TH.accent, 16)
  g._advBtnRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== 通用左上角返回首页按钮（仙侠风格） =====
function drawBackBtn(g) {
  const { ctx, R, TH, S, safeTop } = V
  const btnW = 64*S, btnH = 30*S
  const bx = 8*S, by = safeTop + 6*S
  ctx.save()
  // 暗金底板
  const bg = ctx.createLinearGradient(bx, by, bx, by + btnH)
  bg.addColorStop(0, 'rgba(40,30,15,0.8)')
  bg.addColorStop(1, 'rgba(25,18,8,0.85)')
  ctx.fillStyle = bg
  R.rr(bx, by, btnW, btnH, btnH*0.5); ctx.fill()
  // 金色描边
  ctx.strokeStyle = 'rgba(212,175,55,0.5)'; ctx.lineWidth = 1*S
  R.rr(bx, by, btnW, btnH, btnH*0.5); ctx.stroke()
  // 内侧高光
  ctx.strokeStyle = 'rgba(255,230,160,0.12)'; ctx.lineWidth = 0.5*S
  R.rr(bx+1*S, by+1*S, btnW-2*S, btnH-2*S, (btnH-2*S)*0.5); ctx.stroke()
  // 文字
  ctx.fillStyle = '#f0dca0'; ctx.font = `bold ${12*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 2*S
  ctx.fillText('◁ 首页', bx + btnW*0.5, by + btnH*0.5)
  ctx.restore()
  ctx.textBaseline = 'alphabetic'
  g._backBtnRect = [bx, by, btnW, btnH]
}

// ===== 首页"开始挑战"确认弹窗（info_panel_bg图片版） =====
function drawNewRunConfirm(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H)
  const pw = W * 0.82, ph = 175*S
  const px = (W - pw) / 2, py = (H - ph) / 2

  // 面板背景图
  const panelImg = R.getImg('assets/ui/info_panel_bg.png')
  if (panelImg && panelImg.width > 0) {
    ctx.drawImage(panelImg, px, py, pw, ph)
  } else {
    const rad = 14*S
    ctx.fillStyle = 'rgba(248,242,230,0.97)'
    R.rr(px, py, pw, ph, rad); ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5*S
    R.rr(px, py, pw, ph, rad); ctx.stroke()
  }

  // 标题
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6B5014'
  ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
  ctx.fillText('开始新挑战', px + pw*0.5, py + 32*S)

  // 说明文字
  ctx.fillStyle = '#7B7060'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('当前有未完成的挑战进度', px + pw*0.5, py + 68*S)
  ctx.fillStyle = '#C0392B'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('开始新挑战将清空之前的记录！', px + pw*0.5, py + 88*S)

  // 按钮（使用图片资源）
  const btnW = pw * 0.34, btnH = 34*S, gap = 14*S
  const btn1X = px + pw*0.5 - btnW - gap*0.5
  const btn2X = px + pw*0.5 + gap*0.5
  const btnY = py + 110*S
  R.drawDialogBtn(btn1X, btnY, btnW, btnH, '取消', 'cancel')
  g._newRunCancelRect = [btn1X, btnY, btnW, btnH]
  R.drawDialogBtn(btn2X, btnY, btnW, btnH, '确认开始', 'confirm')
  g._newRunConfirmRect = [btn2X, btnY, btnW, btnH]
}

// ===== Dex（灵兽图鉴） =====
const DEX_ATTRS = ['metal','wood','water','fire','earth']
const DEX_ATTR_LABEL = { metal:'金', wood:'木', water:'水', fire:'火', earth:'土' }

function rDex(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H)

  // 标题
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4*S
  ctx.fillStyle = '#f5e6c8'; ctx.font = `bold ${22*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('灵兽图鉴', W*0.5, safeTop + 40*S)
  ctx.restore()
  // 分割线
  const sdivW = W*0.22, sdivY = safeTop + 48*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - sdivW, sdivY); ctx.lineTo(W*0.5 + sdivW, sdivY); ctx.stroke()

  // 收集进度
  const dex = g.storage.petDex || []
  const totalPets = DEX_ATTRS.reduce((sum, a) => sum + PETS[a].length, 0)
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`已收集：${dex.length} / ${totalPets}`, W*0.5, safeTop + 64*S)

  // 出战提示 + 收集规则提示条
  const tipY = safeTop + 74*S
  const tipPadX = 14 * S, tipH = 36 * S
  const tipX = tipPadX, tipW = W - tipPadX * 2
  // 暖色半透明底
  ctx.fillStyle = 'rgba(255,235,180,0.12)'
  ctx.beginPath(); R.rr(tipX, tipY, tipW, tipH, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(212,175,55,0.25)'; ctx.lineWidth = 1*S
  ctx.beginPath(); R.rr(tipX, tipY, tipW, tipH, 6*S); ctx.stroke()
  // 第一行：出战提示（醒目）
  ctx.fillStyle = '#ffd54f'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('💡 点击已收集灵兽可选择「带它出战」', W*0.5, tipY + 13*S)
  // 第二行：收集规则
  ctx.fillStyle = 'rgba(245,230,200,0.65)'; ctx.font = `${8.5*S}px "PingFang SC",sans-serif`
  ctx.fillText('收集规则：灵兽在冒险中升至满星（★★★）即永久录入图鉴', W*0.5, tipY + 28*S)

  // 滚动区域
  const contentTop = safeTop + 74*S + tipH + 6*S
  const contentBottom = H - 8*S
  const scrollY = g._dexScrollY || 0

  ctx.save()
  ctx.beginPath()
  ctx.rect(0, contentTop, W, contentBottom - contentTop)
  ctx.clip()

  const padX = 12*S
  const cols = 5
  const cellGap = 4*S
  const cellW = (W - padX*2 - (cols-1)*cellGap) / cols
  const cellH = cellW + 18*S  // 头像+名字

  let y = contentTop + scrollY
  g._dexTotalH = 0  // 用于滚动限制
  g._dexCellRects = []  // 存储已收集宠物的点击区域

  for (const attr of DEX_ATTRS) {
    const pets = PETS[attr]
    const ac = ATTR_COLOR[attr]
    // 属性标题
    ctx.fillStyle = ac.main; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(`${DEX_ATTR_LABEL[attr]}属性 (${pets.filter(p=>dex.includes(p.id)).length}/${pets.length})`, padX, y + 14*S)
    y += 22*S

    // 宠物网格
    const rows = Math.ceil(pets.length / cols)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        if (idx >= pets.length) break
        const pet = pets[idx]
        const cx = padX + c * (cellW + cellGap)
        const cy = y + r * (cellH + cellGap)
        const collected = dex.includes(pet.id)

        // 卡片背景
        ctx.fillStyle = collected ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.2)'
        R.rr(cx, cy, cellW, cellH, 4*S); ctx.fill()

        if (collected) {
          // 显示3星头像
          const fakePet = { id: pet.id, star: MAX_STAR }
          const avatarPath = getPetAvatarPath(fakePet)
          const img = R.getImg(avatarPath)
          const imgPad = 3*S
          const imgSz = cellW - imgPad*2
          if (img && img.width > 0) {
            ctx.save()
            ctx.beginPath(); R.rr(cx+imgPad, cy+imgPad, imgSz, imgSz, 3*S); ctx.clip()
            // 保持比例居中
            const iR = img.width / img.height
            let dw = imgSz, dh = imgSz
            if (iR > 1) { dh = imgSz / iR } else { dw = imgSz * iR }
            ctx.drawImage(img, cx+imgPad+(imgSz-dw)/2, cy+imgPad+(imgSz-dh)/2, dw, dh)
            ctx.restore()
          }
          // 金色边框
          ctx.strokeStyle = ac.main + '88'; ctx.lineWidth = 1*S
          R.rr(cx, cy, cellW, cellH, 4*S); ctx.stroke()
          // 名字
          ctx.fillStyle = ac.lt; ctx.font = `${8*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          const shortName = pet.name.length > 4 ? pet.name.substring(0,4) : pet.name
          ctx.fillText(shortName, cx + cellW/2, cy + cellW - imgPad + 14*S)
          // 存储点击区域（仅在可视范围内）
          if (cy + cellH > contentTop && cy < contentBottom) {
            g._dexCellRects.push({ id: pet.id, attr: attr, x: cx, y: cy, w: cellW, h: cellH })
          }
          // 新获得未查看的红点
          const seen = g.storage.petDexSeen
          if (!seen.includes(pet.id)) {
            const dotR = 4*S
            const dotX = cx + cellW - imgPad - dotR + 2*S
            const dotY = cy + imgPad + dotR - 2*S
            ctx.fillStyle = '#e04040'
            ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI*2); ctx.fill()
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1*S
            ctx.beginPath(); ctx.arc(dotX, dotY, dotR, 0, Math.PI*2); ctx.stroke()
          }
        } else {
          // 问号
          ctx.fillStyle = 'rgba(255,255,255,0.08)'
          const qSz = cellW * 0.5
          ctx.beginPath()
          ctx.arc(cx + cellW/2, cy + cellW*0.4, qSz/2, 0, Math.PI*2); ctx.fill()
          ctx.fillStyle = TH.dim; ctx.font = `bold ${18*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
          ctx.fillText('?', cx + cellW/2, cy + cellW*0.4 + 6*S)
          // 暗色名字
          ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.font = `${8*S}px "PingFang SC",sans-serif`
          ctx.fillText('???', cx + cellW/2, cy + cellW + 10*S)
        }
      }
    }
    y += rows * (cellH + cellGap) + 8*S
  }

  g._dexTotalH = y - scrollY - contentTop
  ctx.restore()

  drawBackBtn(g)

  // 宠物详情弹窗（大图+故事）
  if (g._dexDetailPetId) {
    _drawDexPetDetail(g)
  }
}

// ===== 图鉴宠物详情弹窗 =====
function _drawDexPetDetail(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const petId = g._dexDetailPetId
  let pet = null, petAttr = ''
  for (const attr of DEX_ATTRS) {
    const found = PETS[attr].find(p => p.id === petId)
    if (found) { pet = found; petAttr = attr; break }
  }
  if (!pet) { g._dexDetailPetId = null; return }

  const ac = ATTR_COLOR[petAttr]
  const lore = getPetLore(petId)
  // 图鉴始终以满星形态展示
  const curStar = MAX_STAR
  const fakePet = { id: petId, star: curStar, attr: petAttr, skill: pet.skill, atk: pet.atk, cd: pet.cd }
  const curAtk = getPetStarAtk(fakePet)
  const skillDesc = getPetSkillDesc(fakePet) || pet.skill.desc
  const isMaxStar = curStar >= MAX_STAR

  // 下一级数据（非满星时）
  let nextStarAtk = 0, nextSkillDesc = '', nextSkillDescLines = []
  if (!isMaxStar) {
    const nextPet = { ...fakePet, star: curStar + 1 }
    nextStarAtk = getPetStarAtk(nextPet)
    nextSkillDesc = getPetSkillDesc(nextPet) || pet.skill.desc
  }

  // 遮罩
  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'
  ctx.fillRect(0, 0, W, H)

  // 面板参数
  const panelW = W * 0.88
  const panelX = (W - panelW) / 2
  const pad = 14*S
  const maxTextW = panelW - pad * 2
  const imgSize = Math.min(panelW * 0.48, H * 0.28)
  const gapH = 6*S
  const lineH_name = 18*S
  const lineH_attr = 14*S
  const lineH_skillTitle = 16*S
  const lineH_skillDesc = 12*S
  const lineH_lore = 13*S
  const closeH = 18*S

  // 预计算文本行
  const loreLines = _wrapTextDex(lore, maxTextW, 11)
  const skillDescLines = _wrapTextDex(skillDesc, maxTextW - 8*S, 10)
  if (!isMaxStar) {
    nextSkillDescLines = _wrapTextDex(nextSkillDesc, maxTextW - 8*S, 10)
  }

  const btnH = 34*S
  let panelH = pad + imgSize + gapH + lineH_name + lineH_attr + gapH
    + lineH_skillTitle + skillDescLines.length * lineH_skillDesc + gapH
  // 下一级数据区域（非满星时）
  if (!isMaxStar) {
    panelH += gapH + 14*S + lineH_attr + lineH_skillTitle + nextSkillDescLines.length * lineH_skillDesc + gapH
  }
  panelH += gapH + loreLines.length * lineH_lore + gapH + btnH + closeH + pad

  const maxPanelH = H - safeTop - 10*S
  const finalH = Math.min(panelH, maxPanelH)
  const panelY = Math.max(safeTop + 5*S, (H - finalH) / 2)
  const rad = 14*S

  // 浅色面板
  const bgGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + finalH)
  bgGrad.addColorStop(0, 'rgba(248,242,230,0.97)')
  bgGrad.addColorStop(0.5, 'rgba(244,237,224,0.97)')
  bgGrad.addColorStop(1, 'rgba(238,230,218,0.97)')
  ctx.fillStyle = bgGrad
  R.rr(panelX, panelY, panelW, finalH, rad); ctx.fill()
  ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5*S
  R.rr(panelX, panelY, panelW, finalH, rad); ctx.stroke()

  g._dexDetailRect = [panelX, panelY, panelW, finalH]

  // 裁剪
  ctx.save()
  ctx.beginPath(); R.rr(panelX, panelY, panelW, finalH, rad); ctx.clip()

  let curY = panelY + pad

  // 大图
  const avatarPath = getPetAvatarPath(fakePet)
  const img = R.getImg(avatarPath)
  const imgX = (W - imgSize) / 2
  if (img && img.width > 0) {
    ctx.save()
    ctx.beginPath(); R.rr(imgX, curY, imgSize, imgSize, 8*S); ctx.clip()
    const iR = img.width / img.height
    let dw = imgSize, dh = imgSize
    if (iR > 1) { dh = imgSize / iR } else { dw = imgSize * iR }
    ctx.drawImage(img, imgX + (imgSize - dw) / 2, curY + (imgSize - dh) / 2, dw, dh)
    ctx.restore()
  }
  curY += imgSize + gapH

  // 名称 + 星星（同一行）
  ctx.textAlign = 'center'
  const nameFs = 14*S
  const starStr = '★'.repeat(curStar)
  ctx.font = `bold ${nameFs}px "PingFang SC",sans-serif`
  const nameW = ctx.measureText(pet.name).width
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  const starW = ctx.measureText(starStr).width
  const nameStarGap = 4*S
  const totalNameW = nameW + nameStarGap + starW
  const nameStartX = W * 0.5 - totalNameW / 2
  // 画名字
  ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${nameFs}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(pet.name, nameStartX, curY + 13*S)
  // 画星星
  ctx.fillStyle = '#C89510'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(starStr, nameStartX + nameW + nameStarGap, curY + 13*S)
  curY += lineH_name

  // 属性珠 + ATK（仅当前值）
  const orbR = 6*S
  const atkLabel = 'ATK：'
  const atkVal = String(curAtk)
  ctx.font = `${10*S}px "PingFang SC",sans-serif`
  const atkLabelW = ctx.measureText(atkLabel).width
  ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  const atkValW = ctx.measureText(atkVal).width
  const attrBlockW = orbR * 2 + 6*S + atkLabelW + atkValW
  const attrStartX = W * 0.5 - attrBlockW / 2
  R.drawBead(attrStartX + orbR, curY + 8*S, orbR, petAttr, 0)
  ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  ctx.fillText(atkLabel, attrStartX + orbR * 2 + 6*S, curY + 11*S)
  // ATK 数值用高亮色
  ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText(atkVal, attrStartX + orbR * 2 + 6*S + atkLabelW, curY + 11*S)
  curY += lineH_attr + gapH

  // 技能标题
  ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  const skillTitle = `技能：${pet.skill.name}`
  const cdText = `CD ${pet.cd}`
  ctx.fillText(skillTitle, panelX + pad, curY + 11*S)
  // CD 用高亮色
  const skillTitleW = ctx.measureText(skillTitle).width
  ctx.fillStyle = '#c06020'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
  ctx.fillText(cdText, panelX + pad + skillTitleW + 4*S, curY + 11*S)
  curY += lineH_skillTitle

  // 技能描述（数值高亮）
  _drawHighlightedLines(ctx, skillDescLines, panelX + pad + 4*S, curY, lineH_skillDesc, 10*S, S)
  curY += skillDescLines.length * lineH_skillDesc
  curY += gapH

  // 分割线
  ctx.strokeStyle = 'rgba(160,140,100,0.25)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(panelX + pad, curY); ctx.lineTo(panelX + panelW - pad, curY); ctx.stroke()
  curY += gapH

  // 下一级数据（非满星时）
  if (!isMaxStar) {
    const nextStarLabel = `下一级 ★${curStar + 1}`
    ctx.fillStyle = '#8B6E4E'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'left'
    ctx.fillText(nextStarLabel, panelX + pad, curY + 10*S)
    curY += 14*S
    // 下一级ATK
    const nAtkLabel = 'ATK：'
    const nAtkVal = String(nextStarAtk)
    ctx.fillStyle = '#6B5B50'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(nAtkLabel, panelX + pad, curY + 10*S)
    const nAtkLabelW = ctx.measureText(nAtkLabel).width
    ctx.fillStyle = '#c06020'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(nAtkVal, panelX + pad + nAtkLabelW, curY + 10*S)
    curY += lineH_attr
    // 下一级技能
    ctx.fillStyle = '#7A5C30'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`技能：${pet.skill.name}`, panelX + pad, curY + 10*S)
    curY += lineH_skillTitle
    _drawHighlightedLines(ctx, nextSkillDescLines, panelX + pad + 4*S, curY, lineH_skillDesc, 10*S, S)
    curY += nextSkillDescLines.length * lineH_skillDesc
    curY += gapH
    // 分割线
    ctx.strokeStyle = 'rgba(160,140,100,0.25)'; ctx.lineWidth = 1*S
    ctx.beginPath(); ctx.moveTo(panelX + pad, curY); ctx.lineTo(panelX + panelW - pad, curY); ctx.stroke()
    curY += gapH
  }

  // 故事
  ctx.fillStyle = '#5C4A3A'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'left'
  loreLines.forEach(line => {
    ctx.fillText(line, panelX + pad, curY + 10*S)
    curY += lineH_lore
  })
  curY += gapH

  // "带它出战"按钮
  const btnW = panelW * 0.6
  const btnX = (W - btnW) / 2
  const btnY = curY
  const btnRad = 8*S
  const btnGrad = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
  btnGrad.addColorStop(0, '#d4a840')
  btnGrad.addColorStop(1, '#b8922e')
  ctx.fillStyle = btnGrad
  R.rr(btnX, btnY, btnW, btnH, btnRad); ctx.fill()
  ctx.save()
  ctx.beginPath(); R.rr(btnX, btnY, btnW, btnH * 0.45, btnRad); ctx.clip()
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(btnX, btnY, btnW, btnH * 0.45)
  ctx.restore()
  ctx.fillStyle = '#fff'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('带它出战（1星）', W * 0.5, btnY + btnH * 0.5)
  ctx.textBaseline = 'alphabetic'
  g._dexBattleBtnRect = [btnX, btnY, btnW, btnH]

  ctx.restore() // 结束裁剪

  // 关闭提示
  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击其他区域关闭', W * 0.5, panelY + finalH - 6*S)

  ctx.restore()
}

// 绘制带数值高亮的文本行（数字用橙色粗体）
function _drawHighlightedLines(ctx, lines, x, startY, lineH, fontSize, S) {
  let y = startY
  const normalColor = '#5C4A3A'
  const highlightColor = '#c06020'
  const font = `${fontSize}px "PingFang SC",sans-serif`
  const boldFont = `bold ${fontSize}px "PingFang SC",sans-serif`
  // 匹配数值片段（数字、百分号、倍数等）
  const numRe = /(\d+[\d.]*%?倍?)/g

  lines.forEach(line => {
    ctx.textAlign = 'left'
    let cx = x
    let lastIdx = 0
    let match
    numRe.lastIndex = 0
    while ((match = numRe.exec(line)) !== null) {
      // 画数值前的普通文字
      if (match.index > lastIdx) {
        const before = line.substring(lastIdx, match.index)
        ctx.fillStyle = normalColor; ctx.font = font
        ctx.fillText(before, cx, y + fontSize * 0.9)
        cx += ctx.measureText(before).width
      }
      // 画高亮数值
      ctx.fillStyle = highlightColor; ctx.font = boldFont
      ctx.fillText(match[0], cx, y + fontSize * 0.9)
      cx += ctx.measureText(match[0]).width
      lastIdx = match.index + match[0].length
    }
    // 画剩余文字
    if (lastIdx < line.length) {
      ctx.fillStyle = normalColor; ctx.font = font
      ctx.fillText(line.substring(lastIdx), cx, y + fontSize * 0.9)
    }
    // 如果整行没有数字，直接画
    if (lastIdx === 0) {
      ctx.fillStyle = normalColor; ctx.font = font
      ctx.fillText(line, x, y + fontSize * 0.9)
    }
    y += lineH
  })
}

// 图鉴文本换行辅助（按实际像素宽度换行）
function _wrapTextDex(text, maxW, fontSize) {
  if (!text) return ['']
  const S = V.S
  const fullW = fontSize * S       // 中文全角字符宽度
  const halfW = fontSize * S * 0.55 // 英文/数字半角字符宽度
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
  return result.length > 0 ? result : ['']
}

module.exports = {
  rLoading, rTitle, rGameover, rRanking, rStats,
  rReward, rShop, rRest, rAdventure,
  drawBackBtn, drawNewRunConfirm, rDex,
}
