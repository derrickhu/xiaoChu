/**
 * 简单场景渲染：Loading / Title / Gameover / Ranking / Stats
 * 以及通用 UI 组件：返回按钮、弹窗
 */
const V = require('./env')
const { ATTR_COLOR } = require('../data/tower')

// ===== Loading =====
function rLoading(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawLoadingBg(g.af)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${28*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('五行通天塔', W*0.5, H*0.4)
  ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
  const p = g._cloudLoadProgress
  if (p.total > 0) {
    const done = p.loaded + p.failed
    const pct = Math.floor(done / p.total * 100)
    ctx.fillText(`加载资源中... ${pct}%`, W*0.5, H*0.5)
    const barW = W * 0.5, barH = 6 * S, barX = W * 0.25, barY = H * 0.54
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillRect(barX, barY, barW, barH)
    ctx.fillStyle = TH.accent
    ctx.fillRect(barX, barY, barW * (done / p.total), barH)
  } else {
    ctx.fillText('正在连接...', W*0.5, H*0.5)
  }
}

// ===== Title =====
function rTitle(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawHomeBg(g.af)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${32*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('五行通天塔', W*0.5, H*0.22)
  ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
  ctx.fillText(`最高记录：第 ${g.storage.bestFloor} 层`, W*0.5, H*0.30)
  ctx.fillText(`挑战次数：${g.storage.totalRuns}`, W*0.5, H*0.35)

  const hasSave = g.storage.hasSavedRun()
  if (hasSave) {
    const saved = g.storage.loadRunState()
    const cbx = W*0.25, cby = H*0.48, cbw = W*0.5, cbh = 50*S
    R.drawBtn(cbx, cby, cbw, cbh, `继续挑战 (第${saved.floor}层)`, TH.accent, 16)
    g._titleContinueRect = [cbx, cby, cbw, cbh]
    const bx = W*0.25, by = H*0.60, bw = W*0.5, bh = 44*S
    R.drawBtn(bx, by, bw, bh, '开始挑战', TH.info, 15)
    g._titleBtnRect = [bx, by, bw, bh]
    const rowY = H*0.72, btnH2 = 40*S, gap = 8*S
    const halfW = (W*0.7 - gap) / 2, startX = W*0.15
    R.drawBtn(startX, rowY, halfW, btnH2, '历史统计', TH.info, 14)
    g._statBtnRect = [startX, rowY, halfW, btnH2]
    R.drawBtn(startX + halfW + gap, rowY, halfW, btnH2, '🏆 排行榜', '#e6a817', 14)
    g._rankBtnRect = [startX + halfW + gap, rowY, halfW, btnH2]
  } else {
    g._titleContinueRect = null
    const bx = W*0.25, by = H*0.55, bw = W*0.5, bh = 50*S
    R.drawBtn(bx, by, bw, bh, '开始挑战', TH.accent, 18)
    g._titleBtnRect = [bx, by, bw, bh]
    const rowY = H*0.67, btnH2 = 40*S, gap = 8*S
    const halfW = (W*0.7 - gap) / 2, startX = W*0.15
    R.drawBtn(startX, rowY, halfW, btnH2, '历史统计', TH.info, 14)
    g._statBtnRect = [startX, rowY, halfW, btnH2]
    R.drawBtn(startX + halfW + gap, rowY, halfW, btnH2, '🏆 排行榜', '#e6a817', 14)
    g._rankBtnRect = [startX + halfW + gap, rowY, halfW, btnH2]
  }

  if (g.showNewRunConfirm) drawNewRunConfirm(g)
}

// ===== Gameover =====
function rGameover(g) {
  const { ctx, R, TH, W, H, S } = V
  R.drawBg(g.af)
  ctx.fillStyle = TH.danger; ctx.font = `bold ${26*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('挑战结束', W*0.5, H*0.2)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`
  ctx.fillText(`本次到达：第 ${g.floor} 层`, W*0.5, H*0.32)
  ctx.fillStyle = TH.sub; ctx.font = `${14*S}px sans-serif`
  ctx.fillText(`历史最高：第 ${g.storage.bestFloor} 层`, W*0.5, H*0.40)
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
  R.drawBtn(bx, by, bw, bh, '重新挑战', TH.accent, 18)
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
function rReward(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  const { REWARD_TYPES } = require('../data/tower')
  R.drawBg(g.af)
  ctx.fillStyle = TH.accent; ctx.font = `bold ${20*S}px sans-serif`; ctx.textAlign = 'center'
  const evtType = g.curEvent ? g.curEvent.type : ''
  let title = '战斗胜利 - 选择奖励'
  if (evtType === 'elite') title = '精英击败 - 选择灵兽'
  else if (evtType === 'boss') title = 'BOSS击败 - 选择法宝'
  ctx.fillText(title, W*0.5, safeTop + 40*S)
  let headerOffset = 0
  if (g.lastSpeedKill) {
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${13*S}px sans-serif`
    ctx.fillText(`⚡ 速通达成 (${g.lastTurnCount}回合) — 额外选项已解锁！`, W*0.5, safeTop + 60*S)
    headerOffset = 22*S
  }
  if (!g.rewards) return
  const rewardCount = g.rewards.length
  const maxCardArea = H * 0.58
  const gap = 10*S
  const cardH = Math.min(78*S, (maxCardArea - (rewardCount-1)*gap) / rewardCount)
  const cardW = W*0.8
  const startY = H*0.16 + headerOffset
  g._rewardRects = []
  g.rewards.forEach((rw, i) => {
    const cy = startY + i*(cardH+gap)
    const selected = g.selectedReward === i
    const isSpeedBuff = rw.isSpeed === true
    let bgColor = TH.card
    if (isSpeedBuff) bgColor = selected ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)'
    else if (rw.type === REWARD_TYPES.NEW_PET) bgColor = selected ? 'rgba(77,204,77,0.2)' : 'rgba(77,204,77,0.08)'
    else if (rw.type === REWARD_TYPES.NEW_WEAPON) bgColor = selected ? 'rgba(255,215,0,0.25)' : 'rgba(255,215,0,0.08)'
    else if (rw.type === REWARD_TYPES.BUFF) bgColor = selected ? 'rgba(77,171,255,0.2)' : 'rgba(77,171,255,0.06)'
    ctx.fillStyle = bgColor
    R.rr(W*0.1, cy, cardW, cardH, 10*S); ctx.fill()
    ctx.strokeStyle = selected ? TH.accent : TH.cardB; ctx.lineWidth = 2*S; ctx.stroke()
    let typeTag = ''
    let tagColor = TH.dim
    if (isSpeedBuff) { typeTag = '【速通】'; tagColor = '#ffd700' }
    else if (rw.type === REWARD_TYPES.NEW_PET) { typeTag = '【灵兽】'; tagColor = '#4dcc4d' }
    else if (rw.type === REWARD_TYPES.NEW_WEAPON) { typeTag = '【法宝】'; tagColor = '#ffd700' }
    else if (rw.type === REWARD_TYPES.BUFF) { typeTag = '【加成】'; tagColor = '#4dabff' }
    ctx.fillStyle = tagColor; ctx.font = `bold ${11*S}px sans-serif`; ctx.textAlign = 'center'
    ctx.fillText(typeTag, W*0.5, cy + 16*S)
    ctx.fillStyle = TH.text; ctx.font = `bold ${14*S}px sans-serif`
    ctx.fillText(rw.label, W*0.5, cy + cardH*0.5)
    if (rw.type === REWARD_TYPES.NEW_PET) {
      ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
      ctx.fillText(`→ 进入灵兽背包 (${g.petBag.length}/8)`, W*0.5, cy + cardH*0.78)
    } else if (rw.type === REWARD_TYPES.NEW_WEAPON) {
      ctx.fillStyle = TH.sub; ctx.font = `${10*S}px sans-serif`
      ctx.fillText(`→ 进入法宝背包 (${g.weaponBag.length}/4)`, W*0.5, cy + cardH*0.78)
    } else if (rw.type === REWARD_TYPES.BUFF) {
      ctx.fillStyle = TH.dim; ctx.font = `${10*S}px sans-serif`
      ctx.fillText('全队永久生效', W*0.5, cy + cardH*0.78)
    }
    g._rewardRects.push([W*0.1, cy, cardW, cardH])
  })
  if (g.selectedReward >= 0) {
    const bx = W*0.25, by = H*0.82, bw = W*0.5, bh = 44*S
    R.drawBtn(bx, by, bw, bh, '确认', TH.accent, 16)
    g._rewardConfirmRect = [bx, by, bw, bh]
  }
  drawBackBtn(g)
}

// ===== Shop =====
function rShop(g) {
  const { ctx, R, TH, W, H, S, safeTop } = V
  R.drawBg(g.af)
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
  R.drawBg(g.af)
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
  const pw = W * 0.78, ph = 180*S
  const px = (W - pw) / 2, py = (H - ph) / 2
  ctx.fillStyle = 'rgba(20,20,40,0.95)'
  R.rr(px, py, pw, ph, 12*S); ctx.fill()
  ctx.strokeStyle = TH.accent + '66'; ctx.lineWidth = 2*S
  R.rr(px, py, pw, ph, 12*S); ctx.stroke()
  ctx.fillStyle = TH.accent; ctx.font = `bold ${18*S}px sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('开始新挑战', px + pw*0.5, py + 36*S)
  ctx.fillStyle = TH.sub; ctx.font = `${13*S}px sans-serif`
  ctx.fillText('当前有未完成的挑战进度', px + pw*0.5, py + 62*S)
  ctx.fillStyle = '#ffaa44'; ctx.font = `bold ${13*S}px sans-serif`
  ctx.fillText('开始新挑战将清空之前的记录！', px + pw*0.5, py + 82*S)
  const btnW = pw * 0.38, btnH = 42*S, gap = 12*S
  const btn1X = px + pw*0.5 - btnW - gap*0.5
  const btn2X = px + pw*0.5 + gap*0.5
  const btnY = py + 105*S
  R.drawBtn(btn1X, btnY, btnW, btnH, '取消', TH.info, 14)
  g._newRunCancelRect = [btn1X, btnY, btnW, btnH]
  R.drawBtn(btn2X, btnY, btnW, btnH, '确认开始', TH.danger, 14)
  g._newRunConfirmRect = [btn2X, btnY, btnW, btnH]
}

module.exports = {
  rLoading, rTitle, rGameover, rRanking, rStats,
  rReward, rShop, rRest, rAdventure,
  drawBackBtn, drawNewRunConfirm,
}
