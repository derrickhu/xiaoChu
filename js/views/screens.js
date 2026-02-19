/**
 * 简单场景渲染：Loading / Title / Gameover / Ranking / Stats
 * 以及通用 UI 组件：返回按钮、弹窗
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')

// ===== Loading =====
function rLoading(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawLoadingBg(g.af)

  // 简单的加载动画进度条（基于时间流逝）
  const elapsed = Date.now() - g._loadStart
  const pct = Math.min(1, elapsed / 1000)

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
    ctx.font = `bold ${fontSize * S}px sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.shadowColor = 'rgba(255,230,180,0.6)'; ctx.shadowBlur = 2 * S
    ctx.fillText(text, x + w / 2, y + h / 2)
    ctx.shadowBlur = 0
    ctx.restore()
  }
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
  // 底部小按钮
  const smallW = (W * 0.7 - 8 * S) / 2, smallH = smallW / 4, gap = 8 * S, smallX = W * 0.15

  const hasSave = g.storage.hasSavedRun()
  if (hasSave) {
    const saved = g.storage.loadRunState()
    // 继续挑战
    const cby = H * 0.48
    _drawImgBtn(ctx, R, imgContinue, btnX, cby, btnW, btnH, `继续挑战 (第${saved.floor}层)`, 16, S)
    g._titleContinueRect = [btnX, cby, btnW, btnH]
    // 开始挑战
    const sby = H * 0.60
    _drawImgBtn(ctx, R, imgStart, btnX, sby, btnW, btnH, '开始挑战', 15, S)
    g._titleBtnRect = [btnX, sby, btnW, btnH]
    // 底部两按钮
    const rowY = H * 0.72
    _drawImgBtn(ctx, R, imgRank, smallX, rowY, smallW, smallH, '历史统计', 13, S)
    g._statBtnRect = [smallX, rowY, smallW, smallH]
    _drawImgBtn(ctx, R, imgRank, smallX + smallW + gap, rowY, smallW, smallH, '排行榜', 13, S)
    g._rankBtnRect = [smallX + smallW + gap, rowY, smallW, smallH]
  } else {
    g._titleContinueRect = null
    // 开始挑战
    const sby = H * 0.55
    _drawImgBtn(ctx, R, imgStart, btnX, sby, btnW, btnH, '开始挑战', 18, S)
    g._titleBtnRect = [btnX, sby, btnW, btnH]
    // 底部两按钮
    const rowY = H * 0.67
    _drawImgBtn(ctx, R, imgRank, smallX, rowY, smallW, smallH, '历史统计', 13, S)
    g._statBtnRect = [smallX, rowY, smallW, smallH]
    _drawImgBtn(ctx, R, imgRank, smallX + smallW + gap, rowY, smallW, smallH, '排行榜', 13, S)
    g._rankBtnRect = [smallX + smallW + gap, rowY, smallW, smallH]
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
    const glow = ctx.createRadialGradient(W*0.5, H*0.28, 0, W*0.5, H*0.28, W*0.5)
    glow.addColorStop(0, 'rgba(255,215,0,0.25)')
    glow.addColorStop(1, 'rgba(255,215,0,0)')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    ctx.restore()

    ctx.textAlign = 'center'
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${28*S}px sans-serif`
    ctx.fillText('通天塔·通关', W*0.5, H*0.18)

    ctx.fillStyle = '#f0e0c0'; ctx.font = `${16*S}px sans-serif`
    ctx.fillText('恭喜修士登顶通天塔！', W*0.5, H*0.26)

    ctx.fillStyle = '#e8a840'; ctx.font = `bold ${18*S}px sans-serif`
    ctx.fillText(`通关层数：第 ${g.floor > 60 ? 60 : g.floor} 层`, W*0.5, H*0.34)

    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    ctx.fillText(`历史最高：第 ${g.storage.bestFloor} 层`, W*0.5, H*0.40)
  } else {
    // ===== 失败界面 =====
    ctx.textAlign = 'center'
    ctx.fillStyle = TH.danger; ctx.font = `bold ${26*S}px sans-serif`
    ctx.fillText('挑战结束', W*0.5, H*0.2)
    ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`
    ctx.fillText(`本次到达：第 ${g.floor} 层`, W*0.5, H*0.32)
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
    ctx.fillText(`历史最高：第 ${g.storage.bestFloor} 层`, W*0.5, H*0.40)
  }

  ctx.textAlign = 'center'
  ctx.fillText('上场灵兽：', W*0.5, H*0.50)
  g.pets.forEach((p, i) => {
    const ac = ATTR_COLOR[p.attr]
    ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `${12*S}px sans-serif`
    ctx.fillText(p.name, W*0.1 + i*W*0.18, H*0.55)
  })
  if (g.weapon) {
    ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(`法宝：${g.weapon.name}`, W*0.5, H*0.62)
  }
  ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText(`灵兽背包：${g.petBag.length}只  法宝背包：${g.weaponBag.length}件`, W*0.5, H*0.68)
  const bx = W*0.25, by = H*0.75, bw = W*0.5, bh = 48*S
  R.drawBtn(bx, by, bw, bh, g.cleared ? '再次挑战' : '重新挑战', TH.accent, 18)
  g._goBtnRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== Ranking =====
function rRanking(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

  const padX = 12*S
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${22*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('🏆 排行榜', W*0.5, safeTop + 40*S)

  const tabY = safeTop + 56*S, tabH = 34*S, tabW = W*0.35
  const tabAllX = W*0.08, tabDailyX = W*0.57
  ctx.fillStyle = g.rankTab === 'all' ? '#e6a817' : 'rgba(255,255,255,0.08)'
  R.rr(tabAllX, tabY, tabW, tabH, 8*S); ctx.fill()
  ctx.fillStyle = g.rankTab === 'all' ? '#1a1a2e' : TH.sub
  ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('总排行', tabAllX + tabW*0.5, tabY + tabH*0.65)
  g._rankTabAllRect = [tabAllX, tabY, tabW, tabH]
  ctx.fillStyle = g.rankTab === 'daily' ? '#e6a817' : 'rgba(255,255,255,0.08)'
  R.rr(tabDailyX, tabY, tabW, tabH, 8*S); ctx.fill()
  ctx.fillStyle = g.rankTab === 'daily' ? '#1a1a2e' : TH.sub
  ctx.fillText('今日排行', tabDailyX + tabW*0.5, tabY + tabH*0.65)
  g._rankTabDailyRect = [tabDailyX, tabY, tabW, tabH]

  const listTop = tabY + tabH + 12*S
  const listBottom = H - 70*S
  const rowH = 62*S
  const list = g.rankTab === 'all' ? g.storage.rankAllList : g.storage.rankDailyList
  const myRank = g.rankTab === 'all' ? g.storage.rankAllMyRank : g.storage.rankDailyMyRank

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  ctx.fillRect(padX, listTop, W - padX*2, 24*S)
  ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`; ctx.textAlign = 'left'
  ctx.fillText('排名', padX + 8*S, listTop + 16*S)
  ctx.fillText('玩家', padX + 50*S, listTop + 16*S)
  ctx.textAlign = 'right'
  ctx.fillText('最高层', W - padX - 8*S, listTop + 16*S)

  const contentTop = listTop + 26*S
  ctx.save()
  ctx.beginPath(); ctx.rect(0, contentTop, W, listBottom - contentTop); ctx.clip()

  if (g.storage.rankLoading && list.length === 0) {
    ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('加载中...', W*0.5, contentTop + 60*S)
  } else if (list.length === 0) {
    ctx.fillStyle = TH.dim; ctx.font = `${14*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('暂无数据', W*0.5, contentTop + 60*S)
  } else {
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      const ry = contentTop + i * rowH + g.rankScrollY
      if (ry + rowH < contentTop || ry > listBottom) continue
      if (i < 3) {
        const medalColors = ['rgba(255,215,0,0.12)', 'rgba(192,192,192,0.10)', 'rgba(205,127,50,0.10)']
        ctx.fillStyle = medalColors[i]
      } else {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.1)'
      }
      ctx.fillRect(padX, ry, W - padX*2, rowH - 2*S)
      ctx.textAlign = 'left'
      if (i < 3) {
        const medals = ['🥇', '🥈', '🥉']
        ctx.font = `${18*S}px sans-serif`
        ctx.fillText(medals[i], padX + 8*S, ry + 28*S)
      } else {
        ctx.fillStyle = TH.sub; ctx.font = `bold ${14*S}px sans-serif`
        ctx.fillText(`${i + 1}`, padX + 12*S, ry + 28*S)
      }
      const avatarX = padX + 44*S, avatarY = ry + 6*S, avatarSz = 32*S
      if (item.avatarUrl) {
        const avatarImg = R.getImg(item.avatarUrl)
        if (avatarImg && avatarImg.width > 0) {
          ctx.save()
          ctx.beginPath()
          ctx.arc(avatarX + avatarSz/2, avatarY + avatarSz/2, avatarSz/2, 0, Math.PI*2)
          ctx.clip()
          ctx.drawImage(avatarImg, avatarX, avatarY, avatarSz, avatarSz)
          ctx.restore()
        } else {
          ctx.fillStyle = 'rgba(255,255,255,0.1)'
          ctx.beginPath(); ctx.arc(avatarX + avatarSz/2, avatarY + avatarSz/2, avatarSz/2, 0, Math.PI*2); ctx.fill()
        }
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.beginPath(); ctx.arc(avatarX + avatarSz/2, avatarY + avatarSz/2, avatarSz/2, 0, Math.PI*2); ctx.fill()
        ctx.fillStyle = TH.dim; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
        ctx.fillText('?', avatarX + avatarSz/2, avatarY + avatarSz/2 + 4*S)
      }
      ctx.textAlign = 'left'
      ctx.fillStyle = i < 3 ? '#ffd700' : TH.text; ctx.font = `bold ${13*S}px sans-serif`
      const nick = (item.nickName || '修士').substring(0, 8)
      ctx.fillText(nick, avatarX + avatarSz + 8*S, ry + 22*S)
      const petNames = (item.pets || []).map(p => p.name ? p.name.substring(0, 2) : '?').join(' ')
      const wpnName = item.weapon ? `⚔${item.weapon.name.substring(0,3)}` : ''
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`
      ctx.fillText(`${petNames} ${wpnName}`, avatarX + avatarSz + 8*S, ry + 40*S)
      ctx.textAlign = 'right'
      ctx.fillStyle = i < 3 ? '#ffd700' : TH.accent; ctx.font = `bold ${18*S}px sans-serif`
      ctx.fillText(`${item.floor}`, W - padX - 10*S, ry + 24*S)
      ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
      ctx.fillText('层', W - padX - 10*S, ry + 40*S)
    }
  }
  ctx.restore()

  const myBarY = listBottom + 4*S, myBarH = 40*S
  ctx.fillStyle = 'rgba(230,168,23,0.12)'
  ctx.fillRect(padX, myBarY, W - padX*2, myBarH)
  ctx.strokeStyle = '#e6a81744'; ctx.lineWidth = 1*S
  R.rr(padX, myBarY, W - padX*2, myBarH, 6*S); ctx.stroke()
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${12*S}px sans-serif`; ctx.textAlign = 'left'
  const myNick = g.storage.userInfo ? g.storage.userInfo.nickName : '我'
  ctx.fillText(`我：${myNick}`, padX + 12*S, myBarY + myBarH*0.6)
  ctx.textAlign = 'right'
  if (myRank > 0) {
    ctx.fillText(`第 ${myRank} 名`, W*0.6, myBarY + myBarH*0.6)
  } else {
    ctx.fillStyle = TH.dim
    ctx.fillText('未上榜', W*0.6, myBarY + myBarH*0.6)
  }
  ctx.fillStyle = TH.accent; ctx.font = `bold ${14*S}px sans-serif`
  ctx.fillText(`${g.storage.bestFloor} 层`, W - padX - 10*S, myBarY + myBarH*0.6)

  if (g.storage.rankLoading) {
    ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText('刷新中...', W*0.5, myBarY + myBarH + 14*S)
  }

  drawBackBtn(g)
  const rfX = W - 68*S, rfY = safeTop + 6*S, rfW = 60*S, rfH = 30*S
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  R.rr(rfX, rfY, rfW, rfH, 6*S); ctx.fill()
  ctx.fillStyle = g.storage.rankLoading ? TH.dim : TH.sub; ctx.font = `${12*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('刷新', rfX + rfW/2, rfY + rfH*0.65)
  g._rankRefreshRect = [rfX, rfY, rfW, rfH]
}

// ===== Stats =====
function rStats(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H)

  const padX = 16*S
  ctx.fillStyle = '#7ec8f0'; ctx.font = `bold ${22*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('📊 历史统计', W*0.5, safeTop + 40*S)

  const st = g.storage.stats
  const startY = safeTop + 70*S
  const lineH = 38*S

  const panelH = lineH * 8 + 20*S
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  R.rr(padX, startY - 10*S, W - padX*2, panelH, 10*S); ctx.fill()
  ctx.strokeStyle = 'rgba(126,200,240,0.2)'; ctx.lineWidth = 1*S
  R.rr(padX, startY - 10*S, W - padX*2, panelH, 10*S); ctx.stroke()

  const items = [
    { label: '历史最高层数', value: `第 ${g.storage.bestFloor} 层`, color: '#ffd700' },
    { label: '总挑战次数', value: `${g.storage.totalRuns} 次`, color: TH.accent },
    { label: '总战斗场次', value: `${st.totalBattles} 场`, color: TH.text },
    { label: '总消除Combo', value: `${st.totalCombos} 次`, color: TH.text },
    { label: '最高单次Combo', value: `${st.maxCombo} 连`, color: '#ff6b6b' },
    { label: '平均每场Combo', value: st.totalBattles > 0 ? `${(st.totalCombos / st.totalBattles).toFixed(1)} 次` : '-', color: TH.text },
  ]

  items.forEach((item, i) => {
    const y = startY + i * lineH + 16*S
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.03)'
      ctx.fillRect(padX + 4*S, y - 14*S, W - padX*2 - 8*S, lineH - 2*S)
    }
    ctx.textAlign = 'left'
    ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
    ctx.fillText(item.label, padX + 16*S, y)
    ctx.textAlign = 'right'
    ctx.fillStyle = item.color; ctx.font = `bold ${14*S}px sans-serif`
    ctx.fillText(item.value, W - padX - 16*S, y)
  })

  const teamY = startY + 6 * lineH + 16*S
  ctx.textAlign = 'left'
  ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
  ctx.fillText('最高记录阵容：', padX + 16*S, teamY)

  const bfPets = st.bestFloorPets || []
  const bfWeapon = st.bestFloorWeapon
  if (bfPets.length > 0) {
    const petStr = bfPets.map(p => p.name).join('、')
    ctx.fillStyle = TH.text; ctx.font = `${11*S}px sans-serif`
    ctx.fillText(petStr, padX + 16*S, teamY + 20*S)
    if (bfWeapon) {
      ctx.fillStyle = '#ffd700'; ctx.font = `${11*S}px sans-serif`
      ctx.fillText(`法宝：${bfWeapon.name}`, padX + 16*S, teamY + 38*S)
    }
  } else {
    ctx.fillStyle = TH.dim; ctx.font = `${11*S}px sans-serif`
    ctx.fillText('暂无记录', padX + 16*S, teamY + 20*S)
  }

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
  else if (evtType === 'boss') title = 'BOSS击败 - 选择法宝'
  // 标题：米金色书法风
  const titleBaseY = safeTop + 58*S
  ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${18*S}px sans-serif`
  ctx.fillText(title, W*0.5, titleBaseY)
  // 标题下方装饰分割线
  const divW = W*0.36, divY = titleBaseY + 6*S
  ctx.strokeStyle = 'rgba(212,175,55,0.35)'; ctx.lineWidth = 1*S
  ctx.beginPath(); ctx.moveTo(W*0.5 - divW, divY); ctx.lineTo(W*0.5 + divW, divY); ctx.stroke()
  let headerOffset = 0
  if (g.lastSpeedKill) {
    ctx.fillStyle = '#e8a840'; ctx.font = `${12*S}px sans-serif`
    ctx.fillText(`⚡ 速通达成 (${g.lastTurnCount}回合) — 额外选项已解锁`, W*0.5, titleBaseY + 22*S)
    headerOffset = 22*S
  }
  if (!g.rewards) return
  const rewardCount = g.rewards.length
  const isPetOrWeapon = g.rewards.some(rw => rw.type === REWARD_TYPES.NEW_PET || rw.type === REWARD_TYPES.NEW_WEAPON)
  const maxCardArea = H * 0.58
  const gap = 10*S
  const defaultCardH = isPetOrWeapon ? 120*S : 78*S
  const cardH = Math.min(defaultCardH, (maxCardArea - (rewardCount-1)*gap) / rewardCount)
  const cardW = W*0.88
  const cardX = (W - cardW) / 2
  const startY = H*0.20 + headerOffset
  g._rewardRects = []

  const framePetMap = {
    metal: R.getImg('assets/ui/frame_pet_metal.png'),
    wood:  R.getImg('assets/ui/frame_pet_wood.png'),
    water: R.getImg('assets/ui/frame_pet_water.png'),
    fire:  R.getImg('assets/ui/frame_pet_fire.png'),
    earth: R.getImg('assets/ui/frame_pet_earth.png'),
  }
  const frameWeapon = R.getImg('assets/ui/frame_weapon.png')

  g.rewards.forEach((rw, i) => {
    const cy = startY + i*(cardH+gap)
    const selected = g.selectedReward === i
    const isSpeedBuff = rw.isSpeed === true

    // 卡片背景
    let bgColor = TH.card
    let borderColor = selected ? TH.accent : TH.cardB
    if (isSpeedBuff) bgColor = selected ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)'
    else if (rw.type === REWARD_TYPES.NEW_PET) {
      const ac = ATTR_COLOR[rw.data.attr]
      bgColor = selected ? (ac ? ac.main + '33' : 'rgba(77,204,77,0.2)') : (ac ? ac.bg + 'cc' : 'rgba(77,204,77,0.08)')
      if (selected && ac) borderColor = ac.main
    }
    else if (rw.type === REWARD_TYPES.NEW_WEAPON) bgColor = selected ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)'
    else if (rw.type === REWARD_TYPES.BUFF) bgColor = selected ? 'rgba(77,171,255,0.2)' : 'rgba(77,171,255,0.06)'

    const rewardCardBg = R.getImg('assets/ui/reward_card_bg.png')
    if (rewardCardBg && rewardCardBg.width) {
      ctx.drawImage(rewardCardBg, cardX, cy, cardW, cardH)
      if (selected) {
        ctx.strokeStyle = borderColor; ctx.lineWidth = 2.5*S
        R.rr(cardX, cy, cardW, cardH, 10*S); ctx.stroke()
      }
    } else {
      ctx.fillStyle = bgColor
      R.rr(cardX, cy, cardW, cardH, 10*S); ctx.fill()
      ctx.strokeStyle = borderColor; ctx.lineWidth = selected ? 2.5*S : 1.5*S; ctx.stroke()
    }

    if (rw.type === REWARD_TYPES.NEW_PET && rw.data) {
      // ====== 灵兽卡片：头像框 + 详细信息 ======
      const p = rw.data
      const ac = ATTR_COLOR[p.attr]
      const avSz = Math.min(56*S, cardH - 16*S)
      const avX = cardX + 12*S
      const avY = cy + (cardH - avSz) / 2

      // 头像背景
      ctx.fillStyle = ac ? ac.bg : '#1a1a2e'
      R.rr(avX, avY, avSz, avSz, 6*S); ctx.fill()

      // 头像图片
      const petAvatar = R.getImg(`assets/pets/pet_${p.id}.png`)
      if (petAvatar && petAvatar.width > 0) {
        ctx.save()
        ctx.beginPath(); R.rr(avX+1, avY+1, avSz-2, avSz-2, 5*S); ctx.clip()
        const aw = petAvatar.width, ah = petAvatar.height
        const dw = avSz - 2, dh = dw * (ah/aw)
        ctx.drawImage(petAvatar, avX+1, avY+1+(avSz-2-dh), dw, dh)
        ctx.restore()
      } else {
        ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${avSz*0.35}px sans-serif`
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

      // 右侧文字信息
      const infoX = avX + avSz + 14*S
      const textMaxW = cardX + cardW - infoX - 10*S
      let iy = cy + 16*S

      // 名称 + 属性标签
      ctx.textAlign = 'left'
      ctx.fillStyle = ac ? ac.main : TH.text; ctx.font = `bold ${14*S}px sans-serif`
      ctx.fillText(p.name, infoX, iy)
      const nameW = ctx.measureText(p.name).width
      // 属性球代替文字
      const orbR = 6*S
      R.drawBead(infoX + nameW + 6*S + orbR, iy - orbR*0.4, orbR, p.attr, 0)

      // ATK + CD
      iy += 18*S
      ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
      ctx.fillText(`ATK: ${p.atk}    CD: ${p.cd}回合`, infoX, iy)

      // 技能
      if (p.skill) {
        iy += 18*S
        ctx.fillStyle = '#e0c070'; ctx.font = `bold ${11*S}px sans-serif`
        ctx.fillText(`技能：${p.skill.name}`, infoX, iy)
        iy += 16*S
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        const descLines = _wrapText(p.skill.desc, textMaxW, 10)
        descLines.forEach(line => {
          ctx.fillText(line, infoX, iy)
          iy += 14*S
        })
      }

      // 背包容量
      ctx.textAlign = 'right'
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`
      ctx.fillText(`背包 ${g.petBag.length}/8`, cardX + cardW - 12*S, cy + cardH - 8*S)

    } else if (rw.type === REWARD_TYPES.NEW_WEAPON && rw.data) {
      // ====== 法宝卡片：图标 + 详细信息 ======
      const w = rw.data
      const avSz = Math.min(56*S, cardH - 16*S)
      const avX = cardX + 12*S
      const avY = cy + (cardH - avSz) / 2

      // 法宝图标背景
      ctx.fillStyle = '#2a2030'
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
        ctx.fillStyle = '#ffd700'; ctx.font = `bold ${avSz*0.4}px sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('⚔', avX + avSz/2, avY + avSz/2)
        ctx.textBaseline = 'alphabetic'
      }

      // 法宝框
      if (frameWeapon && frameWeapon.width > 0) {
        const fScale = 1.12, fSz = avSz * fScale, fOff = (fSz - avSz)/2
        ctx.drawImage(frameWeapon, avX - fOff, avY - fOff, fSz, fSz)
      }

      // 右侧文字信息
      const infoX = avX + avSz + 14*S
      const textMaxW = cardX + cardW - infoX - 10*S
      let iy = cy + 18*S

      // 法宝名称
      ctx.textAlign = 'left'
      ctx.fillStyle = '#ffd700'; ctx.font = `bold ${14*S}px sans-serif`
      ctx.fillText(w.name, infoX, iy)

      // 法宝类型标签
      const nameW = ctx.measureText(w.name).width
      ctx.fillStyle = '#ffd700aa'; ctx.font = `${10*S}px sans-serif`
      ctx.fillText('法宝', infoX + nameW + 6*S, iy)

      // 法宝效果描述
      iy += 20*S
      ctx.fillStyle = TH.sub; ctx.font = `${11*S}px sans-serif`
      if (w.desc) {
        const descLines = _wrapText(w.desc, textMaxW, 11)
        descLines.forEach(line => {
          ctx.fillText(line, infoX, iy)
          iy += 16*S
        })
      }

      // 属性相关提示（属性球代替文字）
      if (w.attr) {
        ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
        ctx.fillText('对应属性：', infoX, iy)
        const labelW = ctx.measureText('对应属性：').width
        const orbR = 6*S
        R.drawBead(infoX + labelW + orbR, iy - orbR*0.4, orbR, w.attr, 0)
      }

      // 背包容量
      ctx.textAlign = 'right'
      ctx.fillStyle = TH.dim; ctx.font = `${9*S}px sans-serif`
      ctx.fillText(`背包 ${g.weaponBag.length}/4`, cardX + cardW - 12*S, cy + cardH - 8*S)

    } else {
      // ====== 普通Buff卡片（保持原样式但更紧凑） ======
      let typeTag = '', tagColor = '#999'
      if (isSpeedBuff) { typeTag = '⚡速通'; tagColor = '#e0c070' }
      else { typeTag = '加成'; tagColor = '#8ab4d8' }

      ctx.fillStyle = tagColor; ctx.font = `bold ${10*S}px sans-serif`; ctx.textAlign = 'left'
      ctx.fillText(typeTag, cardX + 14*S, cy + cardH*0.4)

      ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${13*S}px sans-serif`; ctx.textAlign = 'center'
      ctx.fillText(rw.label, W*0.5, cy + cardH*0.55)

      ctx.fillStyle = '#999'; ctx.font = `${10*S}px sans-serif`
      ctx.fillText('全队永久生效', W*0.5, cy + cardH*0.8)
    }
    g._rewardRects.push([cardX, cy, cardW, cardH])
  })

  // 确认按钮
  if (g.selectedReward >= 0) {
    const bx = W*0.25, by = H*0.86, bw = W*0.5, bh = 44*S
    const confirmBtnImg = R.getImg('assets/ui/btn_reward_confirm.png')
    if (confirmBtnImg && confirmBtnImg.width) {
      ctx.drawImage(confirmBtnImg, bx, by, bw, bh)
      ctx.fillStyle = '#4A2020'; ctx.font = `bold ${16*S}px sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('确认', bx + bw*0.5, by + bh*0.48)
      ctx.textBaseline = 'alphabetic'
    } else {
      R.drawBtn(bx, by, bw, bh, '确认', TH.accent, 16)
    }
    g._rewardConfirmRect = [bx, by, bw, bh]
  }
  drawBackBtn(g)
}

// ===== Shop =====
function rShop(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawShopBg(g.af)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('神秘商店', W*0.5, safeTop + 40*S)
  ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
  ctx.fillText(g.shopUsed ? '已选择物品' : '免费选择一件', W*0.5, safeTop + 62*S)
  if (!g.shopItems) return
  const cardW = W*0.8, cardH = 55*S, gap = 10*S, startY = H*0.22
  g._shopRects = []
  g.shopItems.forEach((item, i) => {
    const cy = startY + i*(cardH+gap)
    ctx.fillStyle = TH.card; R.rr(W*0.1, cy, cardW, cardH, 8*S); ctx.fill()
    ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(item.name, W*0.5, cy + cardH*0.5 + 5*S)
    g._shopRects.push([W*0.1, cy, cardW, cardH])
  })
  const bx = W*0.3, by = H*0.82, bw = W*0.4, bh = 40*S
  R.drawBtn(bx, by, bw, bh, '离开', TH.info, 14)
  g._shopLeaveRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== Rest =====
function rRest(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawBg(g.af)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('休息之地', W*0.5, safeTop + 40*S)
  if (!g.restOpts) return
  const cardW = W*0.7, cardH = 65*S, gap = 16*S, startY = H*0.3
  g._restRects = []
  g.restOpts.forEach((opt, i) => {
    const cy = startY + i*(cardH+gap)
    ctx.fillStyle = TH.card; R.rr(W*0.15, cy, cardW, cardH, 8*S); ctx.fill()
    ctx.fillStyle = TH.text; ctx.font = `bold ${15*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(opt.name, W*0.5, cy + 28*S)
    ctx.fillStyle = TH.sub; ctx.font = `${12*S}px sans-serif`
    ctx.fillText(opt.desc, W*0.5, cy + 48*S)
    g._restRects.push([W*0.15, cy, cardW, cardH])
  })
  drawBackBtn(g)
}

// ===== Adventure =====
function rAdventure(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawAdventureBg(g.af)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('奇遇', W*0.5, safeTop + 40*S)
  if (!g.adventureData) return
  ctx.fillStyle = TH.text; ctx.font = `bold ${18*S}px sans-serif`
  ctx.fillText(g.adventureData.name, W*0.5, H*0.35)
  ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
  ctx.fillText(g.adventureData.desc, W*0.5, H*0.43)
  ctx.fillStyle = TH.success; ctx.font = `bold ${14*S}px sans-serif`
  ctx.fillText('效果已生效！', W*0.5, H*0.52)
  const bx = W*0.3, by = H*0.65, bw = W*0.4, bh = 44*S
  R.drawBtn(bx, by, bw, bh, '继续', TH.accent, 16)
  g._advBtnRect = [bx, by, bw, bh]
  drawBackBtn(g)
}

// ===== 通用左上角返回首页按钮 =====
function drawBackBtn(g) {
  const { ctx, R, TH, S, safeTop } = V
  const btnW = 60*S, btnH = 30*S
  const bx = 8*S, by = safeTop + 6*S
  ctx.fillStyle = 'rgba(0,0,0,0.5)'
  R.rr(bx, by, btnW, btnH, 6*S); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1
  R.rr(bx, by, btnW, btnH, 6*S); ctx.stroke()
  ctx.fillStyle = '#fff'; ctx.font = `bold ${13*S}px sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('< 首页', bx + btnW*0.5, by + btnH*0.5)
  ctx.textBaseline = 'alphabetic'
  g._backBtnRect = [bx, by, btnW, btnH]
}

// ===== 首页"开始挑战"确认弹窗 =====
function drawNewRunConfirm(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)
  const pw = W * 0.78, ph = 200*S
  const px = (W - pw) / 2, py = (H - ph) / 2
  R.drawDialogPanel(px, py, pw, ph)

  // 标题
  ctx.fillStyle = '#f0e0c0'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('开始新挑战', px + pw*0.5, py + 48*S)

  // 说明文字
  ctx.fillStyle = 'rgba(220,215,200,0.8)'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('当前有未完成的挑战进度', px + pw*0.5, py + 72*S)
  ctx.fillStyle = '#e8a840'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('开始新挑战将清空之前的记录！', px + pw*0.5, py + 92*S)

  // 按钮
  const btnW = pw * 0.32, btnH = 34*S, gap = 14*S
  const btn1X = px + pw*0.5 - btnW - gap*0.5
  const btn2X = px + pw*0.5 + gap*0.5
  const btnY = py + 124*S
  R.drawDialogBtn(btn1X, btnY, btnW, btnH, '取消', 'cancel')
  g._newRunCancelRect = [btn1X, btnY, btnW, btnH]
  R.drawDialogBtn(btn2X, btnY, btnW, btnH, '确认开始', 'confirm')
  g._newRunConfirmRect = [btn2X, btnY, btnW, btnH]
}

module.exports = {
  rLoading, rTitle, rGameover, rRanking, rStats,
  rReward, rShop, rRest, rAdventure,
  drawBackBtn, drawNewRunConfirm,
}
