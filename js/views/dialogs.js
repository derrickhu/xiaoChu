/**
 * 对话框/弹窗渲染：退出确认、敌人详情、法宝详情、宠物详情、全局增益详情
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME, ENEMY_SKILLS } = require('../data/tower')
const { getPetStarAtk, MAX_STAR, getPetSkillDesc, petHasSkill } = require('../data/pets')

// ===== 退出确认弹窗 =====
function drawExitDialog(g) {
  const { ctx, R, TH, W, H, S } = V
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0,0,W,H)
  const pw = W * 0.78, ph = 200*S
  const px = (W - pw) / 2, py = (H - ph) / 2
  R.drawDialogPanel(px, py, pw, ph)

  // 标题 — 暗金色仙侠风
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f0e0c0'
  ctx.font = `bold ${17*S}px "PingFang SC",sans-serif`
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3*S
  ctx.fillText('退出战斗', px + pw*0.5, py + 36*S)
  ctx.restore()

  // 副标题
  ctx.fillStyle = 'rgba(200,190,170,0.7)'
  ctx.font = `${11*S}px "PingFang SC",sans-serif`
  ctx.fillText('请选择退出方式', px + pw*0.5, py + 58*S)

  // 两个主按钮
  const btnW = pw * 0.38, btnH = 42*S, gap = 12*S
  const btn1X = px + pw*0.5 - btnW - gap*0.5
  const btn2X = px + pw*0.5 + gap*0.5
  const btnY = py + 84*S
  R.drawDialogBtn(btn1X, btnY, btnW, btnH, '暂存退出', 'cancel')
  g._exitSaveRect = [btn1X, btnY, btnW, btnH]
  R.drawDialogBtn(btn2X, btnY, btnW, btnH, '重新开局', 'confirm')
  g._exitRestartRect = [btn2X, btnY, btnW, btnH]

  // 取消按钮 — 使用半透明描边风格
  const cancelW = pw * 0.36, cancelH = 34*S
  const cancelX = px + (pw - cancelW) / 2, cancelY = btnY + btnH + 16*S
  ctx.save()
  ctx.fillStyle = 'rgba(40,35,50,0.6)'
  R.rr(cancelX, cancelY, cancelW, cancelH, 8*S); ctx.fill()
  ctx.strokeStyle = 'rgba(180,170,150,0.3)'; ctx.lineWidth = 1*S
  R.rr(cancelX, cancelY, cancelW, cancelH, 8*S); ctx.stroke()
  ctx.fillStyle = 'rgba(200,190,170,0.6)'
  ctx.font = `${12*S}px "PingFang SC",sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText('取消', cancelX + cancelW*0.5, cancelY + cancelH*0.5)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
  g._exitCancelRect = [cancelX, cancelY, cancelW, cancelH]
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
  lines.push({ text: `${typeTag}${e.name}`, color: '#3D2B1F', bold: true, size: 14, h: lineH + 2*S })
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
  lines.push({ text: w.name, color: '#8B6914', bold: true, size: 14, h: lineH + 2*S })
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
    ctx.fillStyle = l.color || '#3D2B1F'
    ctx.font = `${l.bold ? 'bold ' : ''}${l.size*S}px "PingFang SC",sans-serif`
    ctx.fillText(l.text, tipX + padX, curY - 4*S)
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
  const lineH = 18*S, smallLineH = 15*S
  const tipW = W * 0.84
  const maxTextW = tipW - padX * 2

  let lines = []
  const starText = '★'.repeat(p.star || 1) + (p.star < MAX_STAR ? '☆'.repeat(MAX_STAR - (p.star || 1)) : '')
  lines.push({ text: p.name, color: '#3D2B1F', bold: true, size: 14, h: lineH + 2*S, starSuffix: starText })
  const starAtk = getPetStarAtk(p)
  const atkDisplay = (p.star || 1) > 1 ? `${p.atk}→${starAtk}` : `${p.atk}`
  lines.push({ text: `__ATTR_ORB__${p.attr}　ATK：${atkDisplay}`, color: '#6B5B50', size: 10, h: smallLineH, attrOrb: p.attr })
  lines.push({ text: '', size: 0, h: 4*S })

  if (sk && petHasSkill(p)) {
    lines.push({ text: `技能：${sk.name}`, color: '#7A5C30', bold: true, size: 11, h: lineH })
    const descLines = _wrapTextDialog(getPetSkillDesc(p) || '无描述', maxTextW - 8*S, 10)
    descLines.forEach(dl => {
      lines.push({ text: dl, color: '#3D2B1F', size: 10, h: smallLineH })
    })
    lines.push({ text: '', size: 0, h: 3*S })
    let cdBase = p.cd
    let cdActual = cdBase
    if (g.runBuffs && g.runBuffs.skillCdReducePct > 0) {
      cdActual = Math.max(1, Math.round(cdBase * (1 - g.runBuffs.skillCdReducePct / 100)))
    }
    const cdReduced = cdActual < cdBase
    const cdText = cdReduced ? `冷却：${cdActual}回合（原${cdBase}，CD缩短${g.runBuffs.skillCdReducePct}%）` : `冷却：${cdBase}回合`
    lines.push({ text: cdText, color: '#6B5B50', size: 9, h: smallLineH })
    const ready = p.currentCd <= 0
    if (ready) {
      lines.push({ text: '✦ 技能已就绪，上划头像发动技能！', color: '#27864A', bold: true, size: 10, h: smallLineH })
    } else {
      lines.push({ text: `◈ 冷却中：还需 ${p.currentCd} 回合`, color: '#C07000', size: 10, h: smallLineH })
    }
  } else if (sk && !petHasSkill(p)) {
    // ★1 有技能定义但未解锁
    lines.push({ text: '技能：未解锁', color: '#8B7B70', bold: true, size: 11, h: lineH })
    lines.push({ text: `升至★2解锁：${sk.name}`, color: '#A08060', size: 10, h: smallLineH })
    const descLines = _wrapTextDialog(sk.desc || '', maxTextW - 8*S, 10)
    descLines.forEach(dl => {
      lines.push({ text: dl, color: '#9B8B80', size: 10, h: smallLineH })
    })
  } else {
    lines.push({ text: '该宠物没有主动技能', color: '#8B7B70', size: 10, h: smallLineH })
  }

  lines.push({ text: '', size: 0, h: 4*S })
  lines.push({ text: '提示：消除对应属性珠时该宠物发动攻击', color: '#8B7B70', size: 9, h: smallLineH })

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
        ctx.fillStyle = '#ffd700'
        ctx.fillText(l.starSuffix, tipX + padX + nameW + 4*S, curY - 4*S)
      }
    }
  })

  ctx.restore() // 结束裁剪

  ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'center'
  ctx.fillText('点击任意位置关闭', W*0.5, tipY + totalH - 6*S)
  ctx.restore()
}

// 弹窗文本换行辅助（按实际像素宽度换行）
function _wrapTextDialog(text, maxW, fontSize) {
  if (!text) return ['']
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
  return result.length > 0 ? result : ['']
}

module.exports = {
  drawExitDialog,
  drawRunBuffDetailDialog,
  drawEnemyDetailDialog,
  drawWeaponDetailDialog,
  drawBattlePetDetailDialog,
}
