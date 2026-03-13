/**
 * 对话框/弹窗渲染：退出确认、敌人详情、法宝详情、宠物详情、全局增益详情
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, ENEMY_SKILLS } = require('../data/tower')
const { getPetStarAtk, MAX_STAR, getPetSkillDesc, petHasSkill, getPetAvatarPath, getStar3Override, getPetById } = require('../data/pets')
const { getPoolPetAtk } = require('../data/petPoolConfig')
const { wrapText: _uiWrapText } = require('./uiUtils')

// ===== 退出确认弹窗 =====
function drawExitDialog(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H)
  const pw = W * 0.82, ph = 155*S
  const px = (W - pw) / 2, py = (H - ph) / 2
  const panelImg = R.getImg('assets/ui/info_panel_bg.png')
  if (panelImg && panelImg.width > 0) {
    ctx.drawImage(panelImg, px, py, pw, ph)
  } else {
    const rad = 14 * S
    ctx.fillStyle = 'rgba(248,242,230,0.97)'
    R.rr(px, py, pw, ph, rad); ctx.fill()
    ctx.strokeStyle = 'rgba(201,168,76,0.4)'; ctx.lineWidth = 1.5 * S
    R.rr(px, py, pw, ph, rad); ctx.stroke()
  }

  // 取消交互：点击任意位置取消（按钮区域优先由触摸逻辑先处理）
  g._exitCancelRect = [0, 0, W, H]

  // 标题
  ctx.textAlign = 'center'
  ctx.fillStyle = '#6B5014'
  ctx.font = `bold ${16*S}px "PingFang SC",sans-serif`
  ctx.fillText('退出战斗', px + pw*0.5, py + 32*S)

  // 说明文字
  ctx.fillStyle = '#7B7060'
  ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('请选择退出方式', px + pw*0.5, py + 60*S)
  ctx.fillStyle = '#C0392B'
  ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('重新开局将清空当前战斗进度', px + pw*0.5, py + 78*S)
  ctx.fillStyle = '#8A7A62'
  ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('点击任意位置取消', px + pw*0.5, py + 94*S)

  // 按钮
  const btnW = pw * 0.34, btnH = 34*S, gap = 12*S
  const btn1X = px + pw*0.5 - btnW - gap*0.5
  const btn2X = px + pw*0.5 + gap*0.5
  const btnY = py + 106*S
  R.drawDialogBtn(btn1X, btnY, btnW, btnH, '暂存退出', 'cancel')
  g._exitSaveRect = [btn1X, btnY, btnW, btnH]
  R.drawDialogBtn(btn2X, btnY, btnW, btnH, '重新开局', 'confirm')
  g._exitRestartRect = [btn2X, btnY, btnW, btnH]
}

// ===== 全局增益详情弹窗 =====
function drawRunBuffDetailDialog(g) {
  const { ctx, R, TH, W, H, S } = V
  const log = g.runBuffLog
  if (!log || log.length === 0) { g.showRunBuffDetail = false; return }
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(0, 0, W, H)
  const padX = 16*S, padY = 14*S
  const tipW = W * 0.88
  const lineH = 18*S
  const titleH = 24*S
  const merged = {}
  const BUFF_FULL_LABELS = {
    allAtkPct:'全队攻击', allDmgPct:'全属性伤害', heartBoostPct:'心珠回复', weaponBoostPct:'法宝效果',
    extraTimeSec:'转珠时间', hpMaxPct:'血量上限', comboDmgPct:'Combo伤害', elim3DmgPct:'3消伤害',
    elim4DmgPct:'4消伤害', elim5DmgPct:'5消伤害', counterDmgPct:'克制伤害', skillDmgPct:'技能伤害',
    skillCdReducePct:'技能CD缩短', regenPerTurn:'每回合回血', dmgReducePct:'受伤减少',
    bonusCombo:'额外连击', stunDurBonus:'眩晕延长', enemyAtkReducePct:'怪物攻击降低',
    enemyHpReducePct:'怪物血量降低', enemyDefReducePct:'怪物防御降低',
    eliteAtkReducePct:'精英攻击降低', eliteHpReducePct:'精英血量降低',
    bossAtkReducePct:'BOSS攻击降低', bossHpReducePct:'BOSS血量降低',
    nextDmgReducePct:'下场受伤减少', postBattleHealPct:'战后回血', extraRevive:'额外复活',
  }
  for (const entry of log) {
    const k = entry.buff
    if (!merged[k]) merged[k] = { buff: k, val: 0, count: 0 }
    merged[k].val += entry.val
    merged[k].count++
  }
  const items = Object.values(merged)
  const totalLines = items.length
  const contentH = titleH + totalLines * lineH + padY * 2 + 10*S
  const tipH = Math.min(contentH, H * 0.7)
  const tipX = (W - tipW) / 2
  const tipY = (H - tipH) / 2
  R.drawDialogPanel(tipX, tipY, tipW, tipH)
  ctx.fillStyle = '#ffd700'; ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('全局增益一览', W*0.5, tipY + padY + 12*S)
  let ly = tipY + padY + titleH + 4*S
  ctx.textAlign = 'left'
  for (const it of items) {
    if (ly + lineH > tipY + tipH - padY) break
    const name = BUFF_FULL_LABELS[it.buff] || it.buff
    const valTxt = it.buff === 'extraTimeSec' ? `+${it.val.toFixed(1)}s` :
                   it.buff === 'bonusCombo' || it.buff === 'stunDurBonus' || it.buff === 'extraRevive' || it.buff === 'regenPerTurn' ? `+${it.val}` :
                   `${it.val > 0 ? '+' : ''}${it.val}%`
    const countTxt = it.count > 1 ? ` (x${it.count})` : ''
    ctx.fillStyle = '#ddd'; ctx.font = `${11*S}px "PingFang SC",sans-serif`
    ctx.fillText(`· ${name}`, tipX + padX, ly + 12*S)
    ctx.fillStyle = '#ffd700'; ctx.font = `bold ${11*S}px "PingFang SC",sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText(`${valTxt}${countTxt}`, tipX + tipW - padX, ly + 12*S)
    ctx.textAlign = 'left'
    ly += lineH
  }
  ctx.fillStyle = TH.dim; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + tipH - 8*S)
}

// ===== 敌人详情弹窗（程序绘制浅色面板） =====
function drawEnemyDetailDialog(g) {
  const { ctx, R, TH, W, H, S } = V
  if (!g.enemy) return
  const e = g.enemy
  const ac = ATTR_COLOR[e.attr]
  const padX = 16*S, padY = 14*S
  const tipW = W * 0.86
  const lineH = 18*S
  const smallLineH = 15*S
  const maxTextW = tipW - padX * 2

  let lines = []
  const typeTag = e.isBoss ? '【BOSS】' : (e.isElite ? '【精英】' : '')
  const tagColor = e.isBoss ? '#C0392B' : (e.isElite ? '#7B2FBE' : null)
  lines.push({ text: `${typeTag}${e.name}`, color: '#3D2B1F', bold: true, size: 14, h: lineH + 2*S, typeTag, tagColor })
  lines.push({ text: `__ATTR_ORB__${e.attr}　　第 ${g.floor} 层`, color: '#6B5B50', size: 10, h: smallLineH, attrOrb: e.attr })
  lines.push({ text: `HP：${Math.round(e.hp)} / ${Math.round(e.maxHp)}　ATK：${e.atk}　DEF：${e.def || 0}`, color: '#3D2B1F', size: 10, h: smallLineH })

  if (e.skills && e.skills.length > 0) {
    lines.push({ text: '', size: 0, h: 4*S })
    lines.push({ text: '技能列表：', color: '#8B6914', bold: true, size: 11, h: smallLineH })
    e.skills.forEach(sk => {
      const skData = ENEMY_SKILLS[sk]
      if (skData) {
        lines.push({ text: `· ${skData.name}`, color: '#7A5C30', bold: true, size: 10, h: smallLineH })
        let desc = skData.desc || ''
        if (desc.includes('{val}')) {
          const val = skData.type === 'dot' ? Math.round(e.atk * 0.3) : Math.round(e.atk * 0.8)
          desc = desc.replace('{val}', val)
        }
        const descLines = _wrapTextDialog(desc, maxTextW - 8*S, 9)
        descLines.forEach(dl => {
          lines.push({ text: `  ${dl}`, color: '#6B5B50', size: 9, h: smallLineH - 2*S })
        })
      }
    })
  }

  if (g.enemyBuffs && g.enemyBuffs.length > 0) {
    lines.push({ text: '', size: 0, h: 4*S })
    lines.push({ text: '敌方状态：', color: '#C0392B', bold: true, size: 11, h: smallLineH })
    g.enemyBuffs.forEach(b => {
      const durTxt = b.dur < 99 ? ` (${b.dur}回合)` : ''
      const color = b.bad ? '#C0392B' : '#27864A'
      lines.push({ text: `· ${b.name || b.type}${durTxt}`, color, size: 9, h: smallLineH - 2*S })
    })
  }

  // 破防状态（法宝镇妖宝塔：def被置0但不在enemyBuffs中）
  const hasBreakDef = g.enemy && g.enemy.def === 0 && g.enemy.baseDef > 0
  if (hasBreakDef) {
    if (!(g.enemyBuffs && g.enemyBuffs.length > 0)) {
      lines.push({ text: '', size: 0, h: 4*S })
      lines.push({ text: '敌方状态：', color: '#C0392B', bold: true, size: 11, h: smallLineH })
    }
    lines.push({ text: `· 破防（防御 ${g.enemy.baseDef} → 0）`, color: '#C0392B', size: 9, h: smallLineH - 2*S })
  }

  if (g.heroBuffs && g.heroBuffs.length > 0) {
    lines.push({ text: '', size: 0, h: 4*S })
    lines.push({ text: '己方状态：', color: '#2E6DA4', bold: true, size: 11, h: smallLineH })
    g.heroBuffs.forEach(b => {
      const durTxt = b.dur < 99 ? ` (${b.dur}回合)` : ''
      const color = b.bad ? '#C0392B' : '#27864A'
      lines.push({ text: `· ${b.name || b.type}${durTxt}`, color, size: 9, h: smallLineH - 2*S })
    })
  }

  let totalH = padY * 2
  lines.forEach(l => { totalH += l.h })
  totalH += 18*S
  const maxH = H * 0.8
  if (totalH > maxH) totalH = maxH
  const tipX = (W - tipW) / 2
  const tipY = (H - totalH) / 2
  const rad = 14*S

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)
  R.drawInfoPanel(tipX, tipY, tipW, totalH)

  // 裁剪防溢出
  ctx.save()
  ctx.beginPath(); R.rr(tipX, tipY, tipW, totalH, rad); ctx.clip()

  let curY = tipY + padY
  ctx.textAlign = 'left'
  lines.forEach(l => {
    if (l.size === 0) { curY += l.h; return }
    curY += l.h
    if (curY > tipY + totalH - 18*S) return
    ctx.fillStyle = l.color || '#3D2B1F'
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
    if (l.attrOrb) {
      const orbR = 5*S
      const orbX = tipX + padX + orbR
      const orbY = curY - 4*S - orbR*0.4
      R.drawBead(orbX, orbY, orbR, l.attrOrb, 0)
      const restText = l.text.replace(`__ATTR_ORB__${l.attrOrb}`, '')
      ctx.fillText(restText, orbX + orbR + 4*S, curY - 4*S)
    } else if (l.typeTag && l.tagColor) {
      // 精英/BOSS标签用醒目颜色
      ctx.fillStyle = l.tagColor
      ctx.fillText(l.typeTag, tipX + padX, curY - 4*S)
      const tagW = ctx.measureText(l.typeTag).width
      ctx.fillStyle = l.color || '#3D2B1F'
      ctx.fillText(l.text.replace(l.typeTag, ''), tipX + padX + tagW, curY - 4*S)
    } else {
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
    }
  })

  ctx.restore() // 结束裁剪

  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 6*S)
  ctx.restore()
}

// ===== 法宝详情弹窗（程序绘制浅色面板） =====
function drawWeaponDetailDialog(g) {
  const { ctx, R, TH, W, H, S } = V
  if (!g.weapon) { g.showWeaponDetail = false; return }
  const w = g.weapon
  const padX = 16*S, padY = 14*S
  const lineH = 18*S, smallLineH = 15*S
  const tipW = W * 0.84
  const maxTextW = tipW - padX * 2

  let lines = []
  lines.push({ text: w.name, color: '#8B6914', bold: true, size: 14, h: lineH + 2*S, wpnPrefix: true })
  lines.push({ text: '', size: 0, h: 4*S })
  lines.push({ text: '法宝效果：', color: '#8B6914', bold: true, size: 11, h: smallLineH })
  const descLines = _wrapTextDialog(w.desc || '无', maxTextW - 8*S, 10)
  descLines.forEach(dl => {
    lines.push({ text: dl, color: '#3D2B1F', size: 10, h: smallLineH })
  })
  lines.push({ text: '', size: 0, h: 4*S })
  lines.push({ text: '提示：法宝为被动效果，全程自动生效', color: '#8B7B70', size: 9, h: smallLineH })

  let totalH = padY * 2
  lines.forEach(l => { totalH += l.h })
  totalH += 18*S
  const _wdImgPre = R.getImg(`assets/equipment/fabao_${w.id}.png`)
  if (_wdImgPre && _wdImgPre.width > 0) totalH += 56*S + 6*S
  const tipX = (W - tipW) / 2
  const tipY = (H - totalH) / 2
  const rad = 14*S

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)
  R.drawInfoPanel(tipX, tipY, tipW, totalH)

  ctx.save()
  ctx.beginPath(); R.rr(tipX, tipY, tipW, totalH, rad); ctx.clip()

  const wdImg = R.getImg(`assets/equipment/fabao_${w.id}.png`)
  const wdImgSz = 56*S
  if (wdImg && wdImg.width > 0) {
    const wdImgX = tipX + (tipW - wdImgSz) / 2
    const wdImgY = tipY + padY
    ctx.save(); R.rr(wdImgX, wdImgY, wdImgSz, wdImgSz, 8*S); ctx.clip()
    ctx.drawImage(wdImg, wdImgX, wdImgY, wdImgSz, wdImgSz)
    ctx.restore()
    ctx.strokeStyle = 'rgba(139,105,20,0.3)'; ctx.lineWidth = 1*S
    R.rr(wdImgX, wdImgY, wdImgSz, wdImgSz, 8*S); ctx.stroke()
  }

  let curY = tipY + padY + (wdImg && wdImg.width > 0 ? wdImgSz + 6*S : 0)
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
    ctx.fillText(l.text, tx, curY - 4*S)
  })

  ctx.restore() // 结束裁剪

  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 6*S)
  ctx.restore()
}

// ===== 宠物详情弹窗（战斗中，程序绘制浅色面板）=====
function drawBattlePetDetailDialog(g) {
  const { ctx, R, TH, W, H, S } = V
  const idx = g.showBattlePetDetail
  if (idx == null || idx >= g.pets.length) { g.showBattlePetDetail = null; return }
  const p = g.pets[idx]
  const ac = ATTR_COLOR[p.attr]
  const sk = p.skill
  const padX = 16*S, padY = 14*S
  const lineH = 22*S, smallLineH = 18*S
  const tipW = W * 0.84
  const maxTextW = tipW - padX * 2

  let lines = []
  const starText = '★'.repeat(p.star || 1) + (p.star < MAX_STAR ? '☆'.repeat(MAX_STAR - (p.star || 1)) : '')
  lines.push({ text: p.name, color: '#3D2B1F', bold: true, size: 16, h: lineH + 2*S, starSuffix: starText })
  const starAtk = getPetStarAtk(p)
  const atkDisplay = (p.star || 1) > 1 ? `${p.atk}→${starAtk}` : `${p.atk}`
  lines.push({ text: `__ATTR_ORB__${p.attr}　ATK：${atkDisplay}`, color: '#6B5B50', size: 12, h: smallLineH, attrOrb: p.attr })
  lines.push({ text: '', size: 0, h: 4*S })

  if (sk && petHasSkill(p)) {
    lines.push({ text: `技能：${sk.name}`, color: '#B8860B', bold: true, size: 14, h: lineH })
    const descLines = _wrapTextDialog(getPetSkillDesc(p) || '无描述', maxTextW - 8*S, 12)
    descLines.forEach(dl => {
      lines.push({ text: dl, color: '#2A1F10', bold: true, size: 12, h: smallLineH })
    })
    lines.push({ text: '', size: 0, h: 3*S })
    let cdBase = p.cd
    let cdActual = cdBase
    if (g.runBuffs && g.runBuffs.skillCdReducePct > 0) {
      cdActual = Math.max(1, Math.round(cdBase * (1 - g.runBuffs.skillCdReducePct / 100)))
    }
    const cdReduced = cdActual < cdBase
    const cdText = cdReduced ? `冷却：${cdActual}回合（原${cdBase}，CD缩短${g.runBuffs.skillCdReducePct}%）` : `冷却：${cdBase}回合`
    lines.push({ text: cdText, color: '#6B5B50', size: 11, h: smallLineH })
    const ready = p.currentCd <= 0
    if (ready) {
      lines.push({ text: '✦ 技能已就绪，上划头像发动技能！', color: '#27864A', bold: true, size: 12, h: smallLineH })
    } else {
      lines.push({ text: `◈ 冷却中：还需 ${p.currentCd} 回合`, color: '#C07000', size: 12, h: smallLineH })
    }
  } else if (sk && !petHasSkill(p)) {
    // ★1 有技能定义但未解锁 — 只显示未解锁，不展示下一级技能描述
    lines.push({ text: '技能：未解锁（升至★2解锁）', color: '#8B7B70', bold: true, size: 13, h: lineH })
  } else {
    lines.push({ text: '该宠物没有主动技能', color: '#8B7B70', size: 12, h: smallLineH })
  }

  lines.push({ text: '', size: 0, h: 4*S })
  lines.push({ text: '提示：消除对应属性珠时该宠物发动攻击', color: '#8B7B70', size: 11, h: smallLineH })

  let totalH = padY * 2
  lines.forEach(l => { totalH += l.h })
  totalH += 18*S
  const maxH = H * 0.8
  if (totalH > maxH) totalH = maxH
  const tipX = (W - tipW) / 2
  const tipY = (H - totalH) / 2
  const rad = 14*S

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillRect(0, 0, W, H)
  R.drawInfoPanel(tipX, tipY, tipW, totalH)

  ctx.save()
  ctx.beginPath(); R.rr(tipX, tipY, tipW, totalH, rad); ctx.clip()

  let curY = tipY + padY
  ctx.textAlign = 'left'
  lines.forEach(l => {
    if (l.size === 0) { curY += l.h; return }
    curY += l.h
    if (curY > tipY + totalH - 18*S) return
    ctx.fillStyle = l.color || '#3D2B1F'
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
    if (l.attrOrb) {
      const orbR = 5*S
      const orbX = tipX + padX + orbR
      const orbY = curY - 4*S - orbR*0.4
      R.drawBead(orbX, orbY, orbR, l.attrOrb, 0)
      const restText = l.text.replace(`__ATTR_ORB__${l.attrOrb}`, '')
      ctx.fillText(restText, orbX + orbR + 4*S, curY - 4*S)
    } else {
      ctx.fillText(l.text, tipX + padX, curY - 4*S)
      if (l.starSuffix) {
        const nameW = ctx.measureText(l.text).width
        ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.fillStyle = '#C89510'
        ctx.fillText(l.starSuffix, tipX + padX + nameW + 4*S, curY - 4*S)
      }
    }
  })

  ctx.restore() // 结束裁剪

  ctx.fillStyle = '#9B8B80'; ctx.font = `${10*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 6*S)
  ctx.restore()
}

const _wrapTextDialog = _uiWrapText

// ===== ★3 满星庆祝画面 =====
function drawStar3Celebration(g) {
  const { ctx, R, TH, W, H, S } = V
  const c = g._star3Celebration
  if (!c) return
  c.timer++
  const t = c.timer
  const pet = c.pet

  // --- 阶段控制 ---
  // fadeIn: 0~20帧  show: 21~40帧(旧→新变身)  ready: 41+帧(可点击关闭)
  if (t <= 20) c.phase = 'fadeIn'
  else if (t <= 40) c.phase = 'show'
  else c.phase = 'ready'

  // --- 遮罩 ---
  const maskAlpha = t <= 20 ? t / 20 * 0.85 : 0.85
  ctx.save()
  ctx.fillStyle = `rgba(5,5,15,${maskAlpha})`
  ctx.fillRect(0, 0, W, H)

  if (t < 5) { ctx.restore(); return }  // 前5帧只显示遮罩

  const cx = W * 0.5, cy = H * 0.38
  const ac = ATTR_COLOR[pet.attr]
  const mainColor = ac ? ac.main : '#ffd700'

  // --- 粒子系统 ---
  if (t >= 22 && t <= 50 && t % 2 === 0) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 1.5 + Math.random() * 3
      c.particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed * S,
        vy: Math.sin(angle) * speed * S - 1.5 * S,
        life: 40 + Math.random() * 30,
        t: 0,
        size: (2 + Math.random() * 3) * S,
        color: Math.random() > 0.5 ? '#ffd700' : mainColor,
      })
    }
  }
  c.particles = c.particles.filter(p => {
    p.t++
    p.x += p.vx; p.y += p.vy
    p.vy += 0.06 * S
    p.vx *= 0.98
    return p.t < p.life
  })
  c.particles.forEach(p => {
    const alpha = Math.max(0, 1 - p.t / p.life)
    ctx.globalAlpha = alpha * 0.8
    ctx.fillStyle = p.color
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - p.t / p.life * 0.5), 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = alpha * 0.3
    ctx.fillStyle = '#fff'
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.5, 0, Math.PI * 2); ctx.fill()
  })
  ctx.globalAlpha = 1

  // --- 中心光晕 ---
  if (t >= 20) {
    const burstP = Math.min(1, (t - 20) / 15)
    const glowR = (60 + burstP * 80) * S
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR)
    grd.addColorStop(0, mainColor + (burstP < 1 ? 'aa' : '44'))
    grd.addColorStop(0.4, mainColor + '33')
    grd.addColorStop(1, 'transparent')
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = grd
    ctx.beginPath(); ctx.arc(cx, cy, glowR, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  // --- 宠物头像 ---
  const portraitSize = 120 * S
  const portraitX = cx - portraitSize / 2
  const portraitY = cy - portraitSize / 2

  if (t < 24) {
    // 旧形象（★2）: 缩小居中
    const oldSize = 80 * S
    const fakePetOld = { id: pet.id, star: 2 }
    const oldAvatar = R.getImg(getPetAvatarPath(fakePetOld))
    const ox = cx - oldSize / 2, oy = cy - oldSize / 2
    const fadeOutA = t >= 20 ? Math.max(0, 1 - (t - 20) / 4) : 1
    ctx.globalAlpha = Math.min(1, (t - 5) / 10) * fadeOutA
    // 圆角裁剪
    ctx.save()
    ctx.beginPath(); R.rr(ox, oy, oldSize, oldSize, 10 * S); ctx.clip()
    ctx.fillStyle = ac ? ac.bg : '#1a1a2e'; ctx.fillRect(ox, oy, oldSize, oldSize)
    if (oldAvatar && oldAvatar.width > 0) {
      const aw = oldAvatar.width, ah = oldAvatar.height
      const dw = oldSize, dh = dw * (ah / aw)
      ctx.drawImage(oldAvatar, ox, oy + oldSize - dh, dw, dh)
    }
    ctx.restore()
    ctx.globalAlpha = 1
  } else {
    // 新形象（★3水墨国风）: 弹跳缩放入场
    const entryT = t - 24
    let scale = 1
    if (entryT < 8) {
      const p = entryT / 8
      scale = p < 0.4 ? 1.4 - 0.6 * (p / 0.4) :
              p < 0.7 ? 0.8 + 0.3 * ((p - 0.4) / 0.3) :
              1.1 - 0.1 * ((p - 0.7) / 0.3)
    }
    const newAvatar = R.getImg(getPetAvatarPath(pet))
    const sSize = portraitSize * scale
    const sx = cx - sSize / 2, sy = cy - sSize / 2
    // 边框光晕
    ctx.save()
    ctx.shadowColor = mainColor; ctx.shadowBlur = 20 * S
    ctx.beginPath(); R.rr(sx, sy, sSize, sSize, 12 * S); ctx.clip()
    ctx.fillStyle = ac ? ac.bg : '#1a1a2e'; ctx.fillRect(sx, sy, sSize, sSize)
    if (newAvatar && newAvatar.width > 0) {
      const aw = newAvatar.width, ah = newAvatar.height
      const dw = sSize, dh = dw * (ah / aw)
      ctx.drawImage(newAvatar, sx, sy + sSize - dh, dw, dh)
    }
    ctx.restore()
    // 属性边框
    ctx.save()
    ctx.strokeStyle = mainColor; ctx.lineWidth = 2.5 * S
    ctx.shadowColor = mainColor; ctx.shadowBlur = 8 * S
    ctx.beginPath(); R.rr(sx, sy, sSize, sSize, 12 * S); ctx.stroke()
    ctx.restore()
  }

  // --- ★★★ 星级逐颗亮起 ---
  if (t >= 28) {
    const starY = cy + portraitSize / 2 + 20 * S
    const starSpacing = 22 * S
    const starFontSize = 20 * S
    ctx.font = `bold ${starFontSize}px "PingFang SC",sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    for (let si = 0; si < 3; si++) {
      const starX = cx + (si - 1) * starSpacing
      const starDelay = si * 5
      const starT = t - 28 - starDelay
      if (starT < 0) {
        ctx.fillStyle = 'rgba(100,100,100,0.3)'
        ctx.fillText('★', starX, starY)
      } else {
        const sScale = starT < 6 ? 1 + (1.5 - 1) * Math.max(0, 1 - starT / 6) : 1
        ctx.save()
        ctx.translate(starX, starY)
        ctx.scale(sScale, sScale)
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2 * S
        ctx.strokeText('★', 0, 0)
        ctx.fillStyle = '#ffd700'
        ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 10 * S
        ctx.fillText('★', 0, 0)
        ctx.restore()
      }
    }
  }

  // --- 标题文字 ---
  if (t >= 38) {
    const titleAlpha = Math.min(1, (t - 38) / 12)
    ctx.globalAlpha = titleAlpha
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'

    // "图鉴解锁！"
    const titleY = cy - portraitSize / 2 - 36 * S
    ctx.font = `bold ${18 * S}px "PingFang SC",sans-serif`
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3 * S
    ctx.strokeText('✦ 图鉴解锁 ✦', cx, titleY)
    ctx.fillStyle = '#ffd700'
    ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 12 * S
    ctx.fillText('✦ 图鉴解锁 ✦', cx, titleY)
    ctx.shadowBlur = 0

    // 宠物名称
    const nameY = cy + portraitSize / 2 + 50 * S
    const attrName = ATTR_NAME[pet.attr] || ''
    ctx.font = `bold ${15 * S}px "PingFang SC",sans-serif`
    ctx.fillStyle = mainColor
    ctx.fillText(`${attrName}·${pet.name}`, cx, nameY)

    // 满星形态
    ctx.font = `${11 * S}px "PingFang SC",sans-serif`
    ctx.fillStyle = '#ccc'
    ctx.fillText('达到满星，解锁终极形态！', cx, nameY + 20 * S)

    // ★3技能强化说明
    const s3 = getStar3Override(pet.id)
    if (s3 && s3.desc) {
      ctx.font = `${10 * S}px "PingFang SC",sans-serif`
      ctx.fillStyle = '#ffa040'
      ctx.fillText(`★3技能：${s3.desc}`, cx, nameY + 40 * S)
    }

    ctx.globalAlpha = 1
  }

  // --- "点击继续" 提示 ---
  if (c.phase === 'ready') {
    const blinkA = 0.4 + 0.4 * Math.sin(t * 0.08)
    ctx.globalAlpha = blinkA
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = '#aaa'; ctx.font = `${11 * S}px "PingFang SC",sans-serif`
    ctx.fillText('— 点击屏幕继续 —', cx, H - 40 * S)
    ctx.globalAlpha = 1
    // 保存全屏点击区域
    g._star3CelebDismissRect = [0, 0, W, H]
  }

  ctx.restore()
}

// ===== 灵宠入池弹窗 =====
function drawPetPoolEntryPopup(g) {
  if (!g._petPoolEntryPopup) return
  const { ctx, R, TH, W, H, S } = V
  const { getPetById: _getPet } = require('../data/pets')
  const pet = _getPet(g._petPoolEntryPopup.petId)
  if (!pet) { g._petPoolEntryPopup = null; return }

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H)

  const pw = W * 0.72, ph = 140 * S
  const px = (W - pw) / 2, py = H * 0.35
  ctx.fillStyle = 'rgba(248,242,230,0.97)'
  R.rr(px, py, pw, ph, 12 * S); ctx.fill()
  ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 2 * S
  R.rr(px, py, pw, ph, 12 * S); ctx.stroke()

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ffd700'
  ctx.font = `bold ${14*S}px "PingFang SC",sans-serif`
  ctx.fillText('灵宠入池！', px + pw / 2, py + 24 * S)

  const attrColor = ATTR_COLOR[pet.attr]
  ctx.fillStyle = attrColor ? attrColor.main : '#fff'
  ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.fillText(pet.name, px + pw / 2, py + 50 * S)

  ctx.fillStyle = '#6B5014'
  ctx.font = `${10*S}px "PingFang SC",sans-serif`
  ctx.fillText('★1 Lv.5 + 2碎片 加入灵宠池', px + pw / 2, py + 74 * S)

  // 首只入池解锁提示
  if (g.storage.petPoolCount === 1) {
    ctx.fillStyle = '#e0a030'
    ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
    ctx.fillText('底部"灵宠"标签已解锁！', px + pw / 2, py + 96 * S)
  }

  const blink = 0.4 + 0.4 * Math.sin(Date.now() * 0.005)
  ctx.globalAlpha = blink
  ctx.fillStyle = '#aaa'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('点击继续', px + pw / 2, py + ph - 14 * S)
  ctx.globalAlpha = 1

  ctx.restore()
}

// ===== 碎片获得弹窗 =====
function drawFragmentPopup(g) {
  if (!g._fragmentObtainedPopup) return
  const { ctx, R, TH, W, H, S } = V
  const { getPetById: _getPet } = require('../data/pets')
  const info = g._fragmentObtainedPopup
  const pet = _getPet(info.petId)
  if (!pet) { g._fragmentObtainedPopup = null; return }

  ctx.save()
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, H)

  const pw = W * 0.65, ph = 100 * S
  const px = (W - pw) / 2, py = H * 0.38
  ctx.fillStyle = 'rgba(248,242,230,0.97)'
  R.rr(px, py, pw, ph, 12 * S); ctx.fill()
  ctx.strokeStyle = 'rgba(180,140,60,0.6)'; ctx.lineWidth = 1.5 * S
  R.rr(px, py, pw, ph, 12 * S); ctx.stroke()

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillStyle = '#6B5014'
  ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`
  ctx.fillText('获得碎片', px + pw / 2, py + 22 * S)

  const attrColor = ATTR_COLOR[pet.attr]
  ctx.fillStyle = attrColor ? attrColor.main : '#fff'
  ctx.font = `${12*S}px "PingFang SC",sans-serif`
  ctx.fillText(`${pet.name} ×${info.count}`, px + pw / 2, py + 48 * S)

  const blink = 0.4 + 0.4 * Math.sin(Date.now() * 0.005)
  ctx.globalAlpha = blink
  ctx.fillStyle = '#aaa'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
  ctx.fillText('点击继续', px + pw / 2, py + ph - 14 * S)
  ctx.globalAlpha = 1

  ctx.restore()
}

// ===== 灵宠池宠物详情弹窗（图2样式：浅色面板，当前星+下一星信息） =====
/**
 * 显示灵宠池宠物详情弹窗
 * @param {object} g - 游戏状态
 * @param {string} petId - 宠物ID
 * @param {object} storage - storage对象，用于获取 poolPet 数据
 */
function drawPoolPetDetailPopup(g, petId, storage) {
  const { ctx: c, R, W, H, S } = V
  const basePet = getPetById(petId)
  const poolPet = storage ? storage.getPoolPet(petId) : null
  if (!basePet || !poolPet) return

  const ac = ATTR_COLOR[basePet.attr]
  const curStar = poolPet.star || 1
  const curPet = { ...basePet, star: curStar }
  const curAtk = getPoolPetAtk(poolPet)
  const skillLocked = !petHasSkill(curPet)
  const skillDesc = skillLocked ? null : getPetSkillDesc(curPet)

  // 下一星信息
  const hasNextStar = curStar < MAX_STAR
  const nextStar = curStar + 1
  const nextAtk = hasNextStar ? getPoolPetAtk({ ...poolPet, star: nextStar }) : null
  const nextPet = hasNextStar ? { ...basePet, star: nextStar } : null
  const nextSkillDesc = hasNextStar ? getPetSkillDesc(nextPet) : null
  const nextSkillUnlocked = hasNextStar ? petHasSkill(nextPet) : false

  // 计算弹窗高度
  const padX = 16 * S, padY = 14 * S
  const avatarSz = 50 * S
  const sectionH = avatarSz + padY
  const skillLines = skillDesc ? _wrapTextDialog(skillDesc, W * 0.82 - padX * 2, 10) : []
  const nextSkillLines = nextSkillDesc ? _wrapTextDialog(nextSkillDesc, W * 0.82 - padX * 2, 10) : []
  let ph = padY + sectionH + 10 * S + (skillLocked ? 16 * S : skillLines.length * 14 * S + 30 * S)
  if (hasNextStar) {
    ph += 8 * S + 14 * S + 14 * S // 分隔线 + 下一级header + atk
    if (nextSkillUnlocked) ph += 14 * S + nextSkillLines.length * 14 * S
  }
  ph += padY

  const pw = W * 0.82
  const px = (W - pw) / 2
  const py = (H - ph) / 2

  // 遮罩
  c.save()
  c.fillStyle = 'rgba(0,0,0,0.5)'
  c.fillRect(0, 0, W, H)

  // 面板（浅色，使用 drawInfoPanel 或自绘）
  R.drawInfoPanel(px, py, pw, ph)

  c.save()
  const rad = 14 * S
  c.beginPath(); R.rr(px, py, pw, ph, rad); c.clip()

  let dy = py + padY
  const indent = px + padX
  const rightEdge = px + pw - padX

  // ── 头像区（左）+ 信息区（右） ──
  const frameScale = 1.12
  const frameSz = avatarSz * frameScale
  const frameOf = (frameSz - avatarSz) / 2
  const avatarImg = R.getImg(getPetAvatarPath(curPet))
  const frameKey = basePet.attr || 'metal'

  // 属性色背景
  c.fillStyle = ac ? ac.bg || ac.main + '30' : '#1a2a3a'
  c.fillRect(indent, dy, avatarSz, avatarSz)

  // 头像
  if (avatarImg && avatarImg.width > 0) {
    const aw = avatarImg.width, ah = avatarImg.height
    const drawW = avatarSz - 2
    const drawH = drawW * (ah / aw)
    const avDy = dy + (avatarSz - 2) - drawH
    c.save()
    c.beginPath(); c.rect(indent + 1, dy + 1, avatarSz - 2, avatarSz - 2); c.clip()
    c.drawImage(avatarImg, indent + 1, avDy, drawW, drawH)
    c.restore()
  } else {
    c.fillStyle = ac ? ac.main : '#888'
    c.globalAlpha = 0.3
    c.fillRect(indent + 1, dy + 1, avatarSz - 2, avatarSz - 2)
    c.globalAlpha = 1
    c.fillStyle = '#3D2B1F'; c.font = `bold ${20*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(basePet.name.slice(0, 1), indent + avatarSz / 2, dy + avatarSz / 2)
  }

  // 属性边框
  c.strokeStyle = ac ? ac.main : '#C9A84C'; c.lineWidth = 2 * S
  c.strokeRect(indent, dy, avatarSz, avatarSz)

  // 尝试绘制头像框
  const frameImg = R.getImg(`assets/ui/frame_pet_${frameKey}.png`)
  if (frameImg && frameImg.width > 0) {
    c.drawImage(frameImg, indent - frameOf, dy - frameOf, frameSz, frameSz)
  }

  // 信息区（右侧）
  const infoX = indent + avatarSz + 12 * S
  const infoRight = rightEdge

  // 名称
  c.fillStyle = '#3D2B1F'; c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(basePet.name, infoX, dy + 2 * S)

  // 星级
  let starX = infoX
  c.font = `${12*S}px "PingFang SC",sans-serif`
  for (let i = 0; i < MAX_STAR; i++) {
    c.fillStyle = i < curStar ? '#FFD700' : 'rgba(0,0,0,0.2)'
    c.fillText('★', starX, dy + 22 * S)
    starX += 14 * S
  }

  // 属性orb + ATK
  const orbR = 5 * S
  const orbX = infoX + orbR
  const orbY = dy + 40 * S + orbR * 0.5
  R.drawBead(orbX, orbY, orbR, basePet.attr, 0)
  c.fillStyle = '#6B5B50'; c.font = `${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText(`ATK：${curAtk}`, infoX + orbR * 2 + 4 * S, orbY)

  // Lv显示（右上角）
  c.fillStyle = '#9B8B80'; c.font = `${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'; c.textBaseline = 'top'
  c.fillText(`Lv.${poolPet.level}`, infoRight, dy + 2 * S)

  dy += sectionH

  // 技能行
  c.textAlign = 'left'; c.textBaseline = 'top'
  if (skillLocked) {
    c.fillStyle = '#9B8B80'; c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText('技能：升至★2解锁', indent, dy)
    dy += 16 * S
  } else {
    c.fillStyle = '#B8860B'; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
    c.fillText(`技能：${basePet.skill ? basePet.skill.name : ''}  CD ${basePet.cd || '?'}`, indent, dy)
    dy += 16 * S
    c.fillStyle = '#2A1F10'; c.font = `${11*S}px "PingFang SC",sans-serif`
    for (const line of skillLines) {
      c.fillText(line, indent + 4 * S, dy)
      dy += 14 * S
    }
    dy += 4 * S
  }

  // ── 下一星分隔线 + 信息 ──
  if (hasNextStar) {
    // 分隔线
    c.strokeStyle = 'rgba(180,150,80,0.25)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(indent, dy + 4 * S); c.lineTo(rightEdge, dy + 4 * S); c.stroke()
    dy += 12 * S

    // 下一级 header
    const nextStarStr = '★'.repeat(nextStar) + '☆'.repeat(MAX_STAR - nextStar)
    c.fillStyle = '#6B5014'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(`下一级  ${nextStarStr}`, indent, dy)
    dy += 16 * S

    // 下一级 ATK
    c.fillStyle = '#6B5B50'; c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText(`ATK：${nextAtk}`, indent, dy)
    dy += 14 * S

    // 下一级技能
    if (nextSkillUnlocked && basePet.skill) {
      c.fillStyle = ac ? ac.main : '#B8860B'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
      c.fillText(`解锁技能：${basePet.skill.name}  CD ${basePet.cd || '?'}`, indent, dy)
      dy += 14 * S
      c.fillStyle = '#2A1F10'; c.font = `${10*S}px "PingFang SC",sans-serif`
      for (const line of nextSkillLines) {
        c.fillText(line, indent + 4 * S, dy)
        dy += 13 * S
      }
    }
  }

  c.restore() // 结束 clip

  // 关闭提示
  c.fillStyle = '#9B8B80'; c.font = `${9*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'bottom'
  c.fillText('点击任意处关闭', W / 2, py + ph - 6 * S)

  c.restore()
}

module.exports = {
  drawExitDialog,
  drawRunBuffDetailDialog,
  drawEnemyDetailDialog,
  drawWeaponDetailDialog,
  drawBattlePetDetailDialog,
  drawStar3Celebration,
  drawPetPoolEntryPopup,
  drawFragmentPopup,
  drawPoolPetDetailPopup,
}
