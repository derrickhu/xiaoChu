/**
 * 队伍栏绘制：宠物槽、法宝槽、CD特效、Buff图标、全局增益列
 */
const V = require('../env')
const { ATTR_COLOR, ATTR_NAME, ENEMY_SKILLS, COUNTER_MAP, COUNTER_BY } = require('../../data/tower')
const { getPetAvatarPath, petHasSkill } = require('../../data/pets')
const { STAR_VISUAL } = require('../../data/economyConfig')
const tutorial = require('../../engine/tutorial')
const MusicMgr = require('../../runtime/music')
const { BUFF_LABELS, DEBUFF_KEYS, getBuffIcon, shortBuffLabel } = require('../../data/buffConfig')
const { FLOAT_CFG } = require('../../engine/dmgFloat')

function _getPetFloatFrameRect(rect) {
  const frameScale = 1.12
  const frameW = rect[2] * frameScale
  const frameH = rect[3] * frameScale
  return {
    x: rect[0] - (frameW - rect[2]) / 2,
    y: rect[1] - (frameH - rect[3]) / 2,
    w: frameW,
    h: frameH,
  }
}

function _resolvePetFloatAnchor(rect, floatObj) {
  const frameRect = _getPetFloatFrameRect(rect)
  const multiCfg = FLOAT_CFG.petMultiHit
  const mainCfg = FLOAT_CFG.petNormalAtk || FLOAT_CFG.petSkill
  const teamCfg = FLOAT_CFG.petTeamAtk
  let x = frameRect.x + frameRect.w * 0.5
  let y = frameRect.y + frameRect.h * (mainCfg.slotYRatio || 0.58)

  if (floatObj.anchorLane === 'team') {
    y = frameRect.y + frameRect.h * (teamCfg.slotYRatio || 0.58)
  } else if (floatObj.anchorLane === 'minor') {
    const hitIdx = floatObj.hitIdx || 0
    const totalHits = floatObj.totalHits || 1
    const spread = (hitIdx - (totalHits - 1) / 2) * (multiCfg.xStep || 0) * V.S
    x += spread
    y = frameRect.y + frameRect.h * (hitIdx === 0 ? (multiCfg.upperYRatio || 0.52) : (multiCfg.lowerYRatio || 0.76))
  }

  return { x, y }
}

function _drawPetSlotFloats(g) {
  const floats = g._petSlotFloats || []
  if (floats.length === 0 || !g._petBtnRects || g._petBtnRects.length === 0) return

  for (let i = 0; i < floats.length; i++) {
    const f = floats[i]
    if (!f || f._dead || f.delay > 0) continue
    const rect = g._petBtnRects[f.petIdx]
    if (!rect) continue
    const anchor = _resolvePetFloatAnchor(rect, f)
    const drawFloat = Object.assign({}, f, {
      x: anchor.x,
      y: anchor.y + (f._anchorYOffset || 0),
    })
    V.R.drawDmgFloat(drawFloat)
  }
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
  const petCount = Math.min(g.pets.length, 5)
  const hasWeapon = true
  const totalSlots = hasWeapon ? petCount + 1 : petCount
  const sidePad = 8*S
  const petGap = 8*S
  const wpnGap = 12*S
  const iconY = topY + (barH - iconSize) / 2
  const frameScale = 1.12
  const frameSize = iconSize * frameScale
  const frameOff = (frameSize - iconSize) / 2

  g._petBtnRects = []
  g._weaponBtnRect = null

  for (let i = 0; i < totalSlots; i++) {
    let ix
    if (i === 0 && hasWeapon) {
      ix = sidePad
    } else {
      const petOff = hasWeapon ? 1 : 0
      ix = sidePad + (hasWeapon ? iconSize + wpnGap : 0) + (i - petOff) * (iconSize + petGap)
    }
    const cx = ix + iconSize * 0.5
    const cy = iconY + iconSize * 0.5

    if (i === 0 && hasWeapon) {
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
      const petIdx = hasWeapon ? i - 1 : i
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
        // 品质不再单独画矩形描边，避免绿/紫/金与五行相框、珠子属性混淆；稀有度可由星级与养成界面区分
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

          // 不再画整格矩形描边，减少与五行相框叠色误解；光弧、箭头与「技能」标签已足够提示

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
  _drawPetSlotFloats(g)
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
    const iconInfo = getBuffIcon(R, it.buff)
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

module.exports = {
  drawTeamBar,
  drawBuffIcons,
  drawBuffIconsLabeled,
  drawRunBuffIcons,
}
