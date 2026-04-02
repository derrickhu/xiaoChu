/**
 * 奖励详情浮层：宠物/法宝/Buff详情弹窗、灵宝匣道具菜单
 */
const V = require('../env')
const { ATTR_COLOR, ATTR_NAME } = require('../../data/tower')
const { getPetStarAtk, getPetAvatarPath, MAX_STAR, getPetSkillDesc, petHasSkill } = require('../../data/pets')
const { RARITY_VISUAL, STAR_VISUAL } = require('../../data/economyConfig')
const { BUFF_CATEGORY, BUFF_CATEGORY_COLORS, BUFF_DESC, formatBuffValue } = require('../../data/buffConfig')

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

  R.drawInfoPanel(menuX, menuY, menuW, menuH)

  // 标题
  ctx.fillStyle = '#6B5014'; ctx.font = `bold ${15*S}px "PingFang SC",sans-serif`
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
    ctx.fillStyle = 'rgba(255,252,240,0.9)'
    R.rr(menuX + padX, iy, menuW - padX*2, itemH, 8*S); ctx.fill()
    ctx.strokeStyle = isDisabled ? 'rgba(175,135,48,0.2)' : 'rgba(175,135,48,0.5)'
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
    ctx.fillStyle = '#3D2B1F'; ctx.font = `bold ${13*S}px "PingFang SC",sans-serif`; ctx.textAlign = 'left'
    ctx.fillText(it.name, textX, iy + itemH * 0.38)

    // 描述
    ctx.fillStyle = '#6B5B50'; ctx.font = `${10*S}px "PingFang SC",sans-serif`
    ctx.fillText(it.desc, textX, iy + itemH * 0.62)

    // 状态标签
    ctx.textAlign = 'right'
    if (isUsed) {
      ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
      ctx.fillText('已使用', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
    } else if (isObtained) {
      if (isHealFull) {
        ctx.fillStyle = '#9B8B80'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
        ctx.fillText('气血已满', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
      } else {
        ctx.fillStyle = '#27864A'; ctx.font = `bold ${10*S}px "PingFang SC",sans-serif`
        ctx.fillText('点击使用', menuX + menuW - padX - 10*S, iy + itemH * 0.5)
      }
    } else {
      ctx.fillStyle = '#8B6914'; ctx.font = `${9*S}px "PingFang SC",sans-serif`
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

    const valText = formatBuffValue(buffKey, val)
    const category = BUFF_CATEGORY[buffKey] || '\u52A0\u6210'
    const catColor = BUFF_CATEGORY_COLORS[category] || '#6B5B50'
    const desc = BUFF_DESC[buffKey] || '\u5168\u961F\u6C38\u4E45\u751F\u6548'
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

module.exports = {
  drawRewardDetailOverlay: _drawRewardDetailOverlay,
  drawItemMenu: _drawItemMenu,
}
