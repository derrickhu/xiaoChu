/**
 * 宠物详情全屏页面 — 灵宠池 / 图鉴「查看详情」共用（云景背景 + 浅色信息区）
 * 参考：竖版角色展示页 + 左右滑动切换宠物
 * 无底部导航栏，左上角返回按钮
 * 渲染入口：rPetDetail  触摸入口：tPetDetail
 */
const V = require('./env')
const uiUtils = require('./uiUtils')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetRarity, getPetSkillDesc, getPetSkillBaseDesc, getPetAvatarPath, petHasSkill, getPetLore, getStar3Override, getStar4Passive, getStar5Override } = require('../data/pets')
const { getPoolPetAtk, getPoolPetMaxLv, getPoolPetMaxStar, petExpToNextLevel, POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_MAX_LV, POOL_ADV_MAX_LV, POOL_STAR_ATK_MUL, POOL_STAR_AWAKEN_COST, FRAGMENT_TO_EXP } = require('../data/petPoolConfig')
const MusicMgr = require('../runtime/music')
const P = require('../platform')
const { RARITY_VISUAL, STAR_VISUAL } = require('../data/economyConfig')
const { POOL_STAR_LV_CAP } = require('../data/petPoolConfig')

/** 已拥有详情页头像占屏宽比例（rPetDetail 翻页箭头垂直位置须与此一致；无头像框时可略大） */
const PET_DETAIL_AVATAR_FRAC = 0.38

// 触摸区域
const _rects = {
  backBtnRect: null,
  levelUpBtnRect: null,
  starUpBtnRect: null,
  decomposeBtnRect: null,
  summonBtnRect: null,
  leftArrowRect: null,
  rightArrowRect: null,
  roadmapRowRects: [],    // [{ star, rect: [x,y,w,h] }]
}

// 当前展开的成长路线星级（0 表示全收起，1-5 表示该星级展开）
let _expandedRoadmapStar = 0

// 长按升级
let _longPressTimer = null
let _longPressActive = false

// 滑动切换
let _swipeStartX = 0
let _swipeStartY = 0
let _swipeDeltaX = 0
let _swiping = false
let _swipeStartTime = 0

// 滑动动画
let _slideAnim = null  // { from, to, progress, duration, direction }

// 缓动函数：ease-out
function _easeOut(t) {
  return 1 - (1 - t) * (1 - t)
}

const { drawSeparator, wrapTextDraw, getFilteredPool } = uiUtils
const _getFilteredPool = getFilteredPool

function _getCurrentIndex(g) {
  const pool = _getFilteredPool(g)
  return pool.findIndex(p => p.id === g._petDetailId)
}

/** 升至 nextStar 时可获得的养成收益文案（用于详情面板） */
function _getStarUpBenefitLines(petId, poolPet, basePet, nextStar) {
  const lines = []
  const curStar = poolPet.star || 1
  const atkNow = getPoolPetAtk(poolPet)
  const atkNext = getPoolPetAtk({ ...poolPet, star: nextStar })
  if (atkNext > atkNow) {
    lines.push(`攻击 ${atkNow} → ${atkNext}`)
  }
  if (nextStar === 2 && curStar < 2 && basePet.skill) {
    lines.push(`★2「${basePet.skill.name}」`)
    const sd = getPetSkillBaseDesc(basePet)
    if (sd) lines.push(sd)
    const cdVal = basePet.cd != null ? basePet.cd : (basePet.skill && basePet.skill.cd)
    if (cdVal != null) lines.push(`CD ${cdVal}回合`)
  }
  if (nextStar === 3) {
    const s3 = getStar3Override(petId)
    if (s3 && s3.desc) lines.push(`★3 ${s3.desc}`)
  }
  if (nextStar === 4) {
    const p = getStar4Passive(petId)
    if (p) lines.push(`★4 ${p.name}：${p.desc}`)
  }
  if (nextStar === 5) {
    const s5 = getStar5Override(petId)
    if (s5 && s5.desc) lines.push(`★5 ${s5.desc}`)
  }
  const curMax = getPoolPetMaxLv(poolPet)
  const nextMax = getPoolPetMaxLv({ ...poolPet, star: nextStar })
  if (nextMax > curMax) {
    lines.push(`上限 Lv.${nextMax}`)
  }
  return lines
}

/** 构建展开态的详细行（每行 { text, color }） */
function _buildExpandedRoadmapLines(row, petId, basePet, poolPet) {
  const lines = []
  const star = row.star
  // 攻击力
  if (poolPet) {
    const atkStar = getPoolPetAtk({ ...poolPet, star })
    lines.push({ text: `攻击力 ${atkStar}（倍率 ×${row.atkMul}）`, color: '#5A3A15' })
  } else {
    lines.push({ text: `攻击倍率 ×${row.atkMul}`, color: '#5A3A15' })
  }
  // 技能详情
  if (star === 1) {
    lines.push({ text: '未解锁技能（仅普通攻击）', color: 'rgba(90,70,40,0.7)' })
  } else if (star === 2 && basePet.skill) {
    const skillName = basePet.skill.name
    const sd = getPetSkillBaseDesc(basePet)
    const cdVal = basePet.cd != null ? basePet.cd : (basePet.skill && basePet.skill.cd)
    lines.push({ text: `技能「${skillName}」`, color: '#2E6B8B' })
    if (sd) lines.push({ text: sd, color: '#5A4530' })
    if (cdVal != null) lines.push({ text: `冷却 ${cdVal} 回合`, color: 'rgba(90,70,40,0.75)' })
  } else if (star === 3) {
    const s3 = getStar3Override(petId)
    if (s3 && s3.desc) {
      lines.push({ text: `★3 强化：${s3.desc}`, color: '#2E6B8B' })
      if (s3.cd != null) lines.push({ text: `冷却 ${s3.cd} 回合`, color: 'rgba(90,70,40,0.75)' })
    } else {
      lines.push({ text: '攻击提升（无技能变化）', color: 'rgba(90,70,40,0.7)' })
    }
  } else if (star === 4) {
    const p = getStar4Passive(petId)
    if (p) {
      lines.push({ text: `★4 被动「${p.name}」`, color: '#8B2E2E' })
      lines.push({ text: p.desc, color: '#5A4530' })
    } else {
      lines.push({ text: '攻击提升（无被动）', color: 'rgba(90,70,40,0.7)' })
    }
  } else if (star === 5) {
    const s5 = getStar5Override(petId)
    if (s5 && s5.desc) {
      lines.push({ text: `★5 终极：${s5.desc}`, color: '#B84E2E' })
      if (s5.cd != null) lines.push({ text: `冷却 ${s5.cd} 回合`, color: 'rgba(90,70,40,0.75)' })
    } else {
      lines.push({ text: '攻击飞跃（无技能变化）', color: 'rgba(90,70,40,0.7)' })
    }
  }
  // 等级上限
  const lvCap = require('../data/petPoolConfig').POOL_STAR_LV_CAP[star] || 0
  if (lvCap > 0) {
    lines.push({ text: `等级上限 Lv.${lvCap}`, color: 'rgba(90,70,40,0.75)' })
  }
  // 升星需求
  if (row.fragCost > 0) {
    const parts = [`等级≥${row.lvReq}`, `碎片×${row.fragCost}（可用万能碎片补齐）`]
    if (row.awakenCost > 0) parts.push(`觉醒石×${row.awakenCost}`)
    lines.push({ text: `升星条件：${parts.join('，')}`, color: 'rgba(90,70,40,0.75)' })
  }
  return lines
}

/** 构建 ★1→★5 的完整成长路线数据 */
function _buildGrowthRoadmap(petId, basePet) {
  const rows = []
  for (let star = 1; star <= 5; star++) {
    const sv = STAR_VISUAL[star] || {}
    const atkMul = POOL_STAR_ATK_MUL[star] || 1
    const fragCost = POOL_STAR_FRAG_COST[star] || 0
    const lvReq = POOL_STAR_LV_REQ[star] || 0
    const awakenCost = POOL_STAR_AWAKEN_COST[star] || 0
    const lvCap = POOL_STAR_LV_CAP[star] || 40
    const unlocks = []
    if (star === 1) unlocks.push('基础形态')
    if (star === 2 && basePet.skill) unlocks.push(`技能「${basePet.skill.name}」`)
    if (star === 3) {
      const s3 = getStar3Override(petId)
      unlocks.push(s3 ? '技能强化' : '攻击提升')
    }
    if (star === 4) {
      const p = getStar4Passive(petId)
      if (p) unlocks.push(`被动「${p.name}」`)
      unlocks.push(`上限Lv.${lvCap}`)
    }
    if (star === 5) {
      const s5 = getStar5Override(petId)
      unlocks.push(s5 ? '终极强化' : '攻击飞跃')
      unlocks.push(`上限Lv.${lvCap}`)
    }
    rows.push({ star, name: sv.name || '', atkMul, fragCost, lvReq, awakenCost, unlocks })
  }
  return rows
}

// ===== 主渲染 =====
function rPetDetail(g) {
  const { ctx: c, R, W, H, S, safeTop } = V
  const petId = g._petDetailId
  const _returnScene = g._petDetailReturnScene || 'petPool'
  if (!petId) { g.scene = _returnScene; g._petDetailReturnScene = null; return }

  const isUnowned = !!g._petDetailUnowned
  const poolPet = isUnowned ? null : g.storage.getPoolPet(petId)
  if (!isUnowned && !poolPet) { g.scene = _returnScene; g._petDetailReturnScene = null; return }
  const basePet = getPetById(petId)
  if (!basePet) { g.scene = _returnScene; g._petDetailReturnScene = null; return }

  // 未拥有宠物：直接渲染召唤页，不支持滑动
  if (isUnowned) {
    _drawUnownedPage(g, petId, c, R, W, H, S, safeTop)
  } else {
    // 处理滑动动画
    if (_slideAnim) {
      _slideAnim.progress += 1 / _slideAnim.duration
      if (_slideAnim.progress >= 1) {
        g._petDetailId = _slideAnim.to
        _slideAnim = null
      }
    }

    if (_slideAnim) {
      const ease = _easeOut(_slideAnim.progress)
      const curOffset = _slideAnim.direction * W * ease
      c.save()
      c.translate(curOffset, 0)
      _drawDetailPage(g, petId, c, R, W, H, S, safeTop)
      c.restore()
      const tgtOffset = -_slideAnim.direction * W * (1 - ease)
      c.save()
      c.translate(tgtOffset, 0)
      _drawDetailPage(g, _slideAnim.to, c, R, W, H, S, safeTop)
      c.restore()
    } else if (_swiping) {
      c.save()
      c.translate(_swipeDeltaX, 0)
      _drawDetailPage(g, petId, c, R, W, H, S, safeTop)
      c.restore()
      if (Math.abs(_swipeDeltaX) > 5 * S) {
        const pool = _getFilteredPool(g)
        const idx = _getCurrentIndex(g)
        const nextIdx = _swipeDeltaX > 0 ? idx - 1 : idx + 1
        if (nextIdx >= 0 && nextIdx < pool.length) {
          c.save()
          const sideOffset = _swipeDeltaX > 0 ? (_swipeDeltaX - W) : (_swipeDeltaX + W)
          c.translate(sideOffset, 0)
          _drawDetailPage(g, pool[nextIdx].id, c, R, W, H, S, safeTop)
          c.restore()
        }
      }
    } else {
      _drawDetailPage(g, petId, c, R, W, H, S, safeTop)
    }
  }

  // === 返回按钮（始终在最上层，不随滑动偏移）===
  const btnX = 12 * S
  const btnY = safeTop + 8 * S
  const btnW = 36 * S
  const btnH = 36 * S
  c.save()
  // 背景圆
  c.fillStyle = 'rgba(0,0,0,0.4)'
  c.beginPath()
  c.arc(btnX + btnW / 2, btnY + btnH / 2, btnW / 2, 0, Math.PI * 2)
  c.fill()
  // 箭头 <
  c.strokeStyle = '#fff'
  c.lineWidth = 2.5 * S
  c.lineCap = 'round'
  c.lineJoin = 'round'
  const ax = btnX + btnW / 2 + 3 * S
  const ay = btnY + btnH / 2
  c.beginPath()
  c.moveTo(ax, ay - 8 * S)
  c.lineTo(ax - 8 * S, ay)
  c.lineTo(ax, ay + 8 * S)
  c.stroke()
  c.restore()
  _rects.backBtnRect = [btnX, btnY, btnW, btnH]

  // 左右翻页箭头（头像两侧，半透明，可点击）— 未拥有宠物不显示
  _rects.leftArrowRect = null
  _rects.rightArrowRect = null
  if (!isUnowned) _rects.summonBtnRect = null   // 仅非召唤页时重置，避免覆盖 _drawUnownedPage 设置的值
  if (!isUnowned && !_swiping && !_slideAnim) {
    const pool = _getFilteredPool(g)
    const idx = _getCurrentIndex(g)
    const arrowY = safeTop + 72 * S + W * PET_DETAIL_AVATAR_FRAC / 2
    const arrowSz = 12 * S
    const hitW = 36 * S, hitH = 48 * S
    c.save()
    c.globalAlpha = 0.3
    c.strokeStyle = '#fff'
    c.lineWidth = 2.5 * S
    c.lineCap = 'round'
    c.lineJoin = 'round'
    if (idx > 0) {
      const lx = 16 * S
      c.beginPath()
      c.moveTo(lx + arrowSz * 0.6, arrowY - arrowSz)
      c.lineTo(lx, arrowY)
      c.lineTo(lx + arrowSz * 0.6, arrowY + arrowSz)
      c.stroke()
      _rects.leftArrowRect = [lx - 8 * S, arrowY - hitH / 2, hitW, hitH]
    }
    if (idx < pool.length - 1) {
      const rx = W - 16 * S
      c.beginPath()
      c.moveTo(rx - arrowSz * 0.6, arrowY - arrowSz)
      c.lineTo(rx, arrowY)
      c.lineTo(rx - arrowSz * 0.6, arrowY + arrowSz)
      c.stroke()
      _rects.rightArrowRect = [rx - hitW + 8 * S, arrowY - hitH / 2, hitW, hitH]
    }
    c.restore()
  }

  // 底部页码指示器（未拥有宠物不显示）
  if (isUnowned) return
  const pool = _getFilteredPool(g)
  const idx = _getCurrentIndex(g)
  if (pool.length > 1) {
    const dotR = 3 * S
    const dotGap = 10 * S
    const totalDotsW = pool.length * dotR * 2 + (pool.length - 1) * dotGap
    const dotsX = (W - totalDotsW) / 2
    const dotsY = H - safeTop - 10 * S
    c.save()
    for (let i = 0; i < pool.length; i++) {
      const dx = dotsX + i * (dotR * 2 + dotGap) + dotR
      c.fillStyle = i === idx ? '#fff' : 'rgba(255,255,255,0.3)'
      c.beginPath()
      c.arc(dx, dotsY, i === idx ? dotR * 1.3 : dotR, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }
}

// ===== 未拥有宠物召唤页 =====
function _drawUnownedPage(g, petId, c, R, W, H, S, safeTop) {
  const basePet = getPetById(petId)
  if (!basePet) return
  const rarity = getPetRarity(petId)
  const rv = RARITY_VISUAL[rarity] || RARITY_VISUAL.R
  const attrColor = ATTR_COLOR[basePet.attr]
  const attrName = ATTR_NAME[basePet.attr] || basePet.attr
  const ac = attrColor ? attrColor.main : '#666'
  const { SUMMON_FRAG_COST } = require('../data/chestConfig')
  const cost = SUMMON_FRAG_COST[rarity] || 15
  const bankFrag = g.storage.getBankFragments(petId)
  const canSummon = bankFrag >= cost

  // 背景
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }
  c.fillStyle = 'rgba(0,0,0,0.25)'
  c.fillRect(0, 0, W, H)

  // 头像
  const avatarAreaTop = safeTop + 72 * S
  const avatarSize = W * 0.30
  const avatarX = (W - avatarSize) / 2
  const avatarY = avatarAreaTop

  // 属性光环
  c.save()
  const glowCx = avatarX + avatarSize / 2
  const glowCy = avatarY + avatarSize / 2
  const glowR = avatarSize * 0.72
  const glow = c.createRadialGradient(glowCx, glowCy, glowR * 0.2, glowCx, glowCy, glowR)
  glow.addColorStop(0, ac + '45')
  glow.addColorStop(0.5, ac + '15')
  glow.addColorStop(1, ac + '00')
  c.fillStyle = glow
  c.beginPath(); c.arc(glowCx, glowCy, glowR, 0, Math.PI * 2); c.fill()
  c.restore()

  const avatarPath = getPetAvatarPath({ ...basePet, star: 1 })
  R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 10 * S })

  // 碎片宠物头像框（灰色通用框）
  const fragFrame = R.getImg('assets/ui/frame_fragment.png')
  if (fragFrame && fragFrame.width > 0) {
    const frameSz = avatarSize * 1.22
    const frameX = avatarX + (avatarSize - frameSz) / 2
    const frameY = avatarY + (avatarSize - frameSz) / 2
    c.drawImage(fragFrame, frameX, frameY, frameSz, frameSz)
  }

  // 名称区域
  let cy = avatarY + avatarSize * 1.11 + 10 * S
  const orbPath = `assets/orbs/orb_${basePet.attr || 'metal'}.png`
  const orbImg = R.getImg(orbPath)
  const orbSz = 22 * S
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  const nameW = c.measureText(basePet.name).width
  // 品质标签尺寸
  const badgeText = `[${rv.label}]`
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  const badgeW = c.measureText(badgeText).width
  const badgeGap = 4 * S
  const totalNameW = orbSz + 4 * S + nameW + badgeGap + badgeW
  const nameStartX = (W - totalNameW) / 2

  if (orbImg && orbImg.width > 0) {
    c.drawImage(orbImg, nameStartX, cy - 1 * S, orbSz, orbSz)
  }
  const nameX = nameStartX + orbSz + 4 * S
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.6)'; c.lineWidth = 4 * S
  c.strokeText(basePet.name, nameX, cy)
  c.fillStyle = 'rgba(200,200,220,0.8)'
  c.fillText(basePet.name, nameX, cy)

  // 品质标签（名字右侧）
  c.save()
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillStyle = rv.badgeColor
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(badgeText, nameX + nameW + badgeGap, cy + 5 * S)
  c.restore()

  cy += 28 * S
  // 未召唤页不展示 T1/T2/T3 档位标签（避免与「未获得」状态混淆）
  cy += 16 * S

  // 信息卡片
  const cardX = 6 * S
  const cardW2 = W - 12 * S
  const cardTop = cy
  const cardBottom = H - safeTop - 24 * S
  const cardH2 = cardBottom - cardTop
  const cardRad = 14 * S

  const cardBg = R.getImg('assets/ui/pet_card_bg.png')
  if (cardBg && cardBg.width > 0) {
    c.save()
    R.rr(cardX, cardTop, cardW2, cardH2, cardRad); c.clip()
    c.drawImage(cardBg, cardX, cardTop, cardW2, cardH2)
    c.restore()
  } else {
    c.fillStyle = 'rgba(20,15,10,0.75)'
    R.rr(cardX, cardTop, cardW2, cardH2, cardRad); c.fill()
  }

  // 品质色调叠加
  c.save()
  R.rr(cardX, cardTop, cardW2, cardH2, cardRad); c.clip()
  const rarityGrad = c.createLinearGradient(cardX, cardTop, cardX, cardTop + cardH2 * 0.5)
  rarityGrad.addColorStop(0, rv.bgGradient[0] + '30')
  rarityGrad.addColorStop(1, rv.bgGradient[1] + '00')
  c.fillStyle = rarityGrad
  c.fillRect(cardX, cardTop, cardW2, cardH2)
  c.restore()

  const borderL = Math.round(cardW2 * 0.25)
  const borderR = Math.round(cardW2 * 0.10)
  const borderT = Math.round(cardH2 * 0.15)
  const indent = cardX + borderL
  const rightEdge = cardX + cardW2 - borderR
  const contentW = rightEdge - indent
  const innerTop = cardTop + borderT

  cy = innerTop

  // 基础攻击力
  c.fillStyle = '#5A4530'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const atkLabelW = c.measureText('攻击力').width
  c.fillText('攻击力', indent, cy + 11 * S)
  c.fillStyle = '#CC6600'
  c.font = `bold ${22*S}px "PingFang SC",sans-serif`
  c.fillText(`${basePet.atk}`, indent + atkLabelW + 8 * S, cy + 11 * S)
  cy += 30 * S

  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += 10 * S

  // 技能预览（未召唤：展示二星基础效果 + 备注二星解锁）
  c.fillStyle = '#5A4530'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('技能', indent, cy)
  const skillLabelW = c.measureText('技能').width
  const lineHSkill = 17 * S
  if (basePet.skill) {
    c.fillStyle = '#2E8B2E'
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillText(basePet.skill.name, indent + skillLabelW + 10 * S, cy + 1 * S)
    cy += 20 * S
    const skillDesc = getPetSkillBaseDesc(basePet)
    c.fillStyle = 'rgba(70,50,30,0.85)'
    c.font = `${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    const skillLines = wrapTextDraw(c, skillDesc || '', indent, cy, contentW, lineHSkill)
    cy += Math.max(1, skillLines) * lineHSkill + 4 * S
    if (basePet.skill.cd || basePet.cd) {
      c.fillStyle = 'rgba(90,70,40,0.7)'
      c.font = `${12*S}px "PingFang SC",sans-serif`
      c.fillText(`CD ${basePet.cd || basePet.skill.cd}回合`, indent, cy)
      cy += 14 * S
    }
    c.fillStyle = 'rgba(180,100,30,0.95)'
    c.font = `${12*S}px "PingFang SC",sans-serif`
    c.fillText('★2 解锁', indent, cy)
    cy += 18 * S
  } else {
    cy += 20 * S
    c.fillStyle = 'rgba(90,70,40,0.7)'
    c.font = `${13*S}px "PingFang SC",sans-serif`
    c.fillText('无主动', indent, cy)
    cy += 20 * S
  }

  cy += 10 * S
  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += 16 * S

  // 碎片进度
  c.fillStyle = '#5A4530'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('碎片召唤', indent, cy)
  cy += 22 * S

  // 进度条 + 右侧碎片数字（避免长数字顶到卷轴右缘）
  const barH3 = 14 * S
  const barX2 = indent
  const gapMid = 8 * S
  const marginR = 14 * S
  const fragStr = `${bankFrag} / ${cost}`
  const textRight = rightEdge - marginR
  let fragFs = 13 * S
  c.font = `${fragFs}px "PingFang SC",sans-serif`
  let fragW = c.measureText(fragStr).width
  let availForBar = contentW - marginR - fragW - gapMid
  if (availForBar < 36 * S && fragFs > 11 * S) {
    fragFs = 11 * S
    c.font = `${fragFs}px "PingFang SC",sans-serif`
    fragW = c.measureText(fragStr).width
    availForBar = contentW - marginR - fragW - gapMid
  }
  // 条 + gapMid + 数字宽度 ≤ contentW - marginR；条宽优先取 60% 内容区以内
  const barW2 = Math.min(contentW * 0.6, Math.max(0, availForBar))
  const progress = Math.min(1, bankFrag / cost)
  c.fillStyle = 'rgba(0,0,0,0.15)'
  R.rr(barX2, cy, barW2, barH3, barH3 / 2); c.fill()
  if (progress > 0) {
    const fillGrad = c.createLinearGradient(barX2, cy, barX2 + barW2 * progress, cy)
    fillGrad.addColorStop(0, '#9b7aff')
    fillGrad.addColorStop(1, '#6b4adf')
    c.fillStyle = fillGrad
    R.rr(barX2, cy, barW2 * progress, barH3, barH3 / 2); c.fill()
  }
  c.strokeStyle = 'rgba(120,100,200,0.4)'; c.lineWidth = 1 * S
  R.rr(barX2, cy, barW2, barH3, barH3 / 2); c.stroke()

  c.fillStyle = canSummon ? '#7ecf6a' : 'rgba(90,70,40,0.75)'
  c.font = `${fragFs}px "PingFang SC",sans-serif`
  c.textAlign = 'right'; c.textBaseline = 'top'
  c.fillText(fragStr, textRight, cy + (barH3 - fragFs) * 0.15)
  cy += barH3 + 16 * S

  // 召唤按钮
  const sBtnW = 100 * S, sBtnH = 34 * S
  const sBtnX = indent
  _drawBtn(c, R, S, sBtnX, cy, sBtnW, sBtnH, canSummon ? '召唤灵宠' : '碎片不足', canSummon, '#9b7aff', 13 * S)
  _rects.summonBtnRect = [sBtnX, cy, sBtnW, sBtnH]
}

// ===== 绘制单个宠物详情页 =====
function _drawDetailPage(g, petId, c, R, W, H, S, safeTop) {
  const poolPet = g.storage.getPoolPet(petId)
  if (!poolPet) return
  const basePet = getPetById(petId)
  if (!basePet) return

  const rarity = getPetRarity(petId)
  const rv = RARITY_VISUAL[rarity] || RARITY_VISUAL.R
  const atk = getPoolPetAtk(poolPet)
  const attrColor = ATTR_COLOR[poolPet.attr]
  const expPool = g.storage.soulStone || 0
  const nextLvExp = petExpToNextLevel(poolPet.level, rarity)
  const maxLv = poolPet.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
  const isMaxLv = poolPet.level >= maxLv
  const ac = attrColor ? attrColor.main : '#666'
  const maxStar = getPoolPetMaxStar(poolPet)
  const STAR_GOLD_ON = '#E8B820'
  const STAR_GOLD_OFF = 'rgba(232,184,32,0.4)'

  // 只为当前展示的宠物绘制按钮
  const isCurrentPet = (petId === g._petDetailId && !_slideAnim)

  // === 背景 ===
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }
  c.fillStyle = 'rgba(0,0,0,0.15)'
  c.fillRect(0, 0, W, H)

  // === 灵石图标+数值（返回按钮右侧） ===
  const expIcon = R.getImg('assets/ui/icon_soul_stone.png')
  const expIconCenterY = safeTop + 26 * S
  if (expIcon && expIcon.width > 0) {
    const iconSz = 32 * S
    const iconX = 52 * S
    const iconY = expIconCenterY - iconSz / 2
    // 先量文字宽度，画胶囊（从图标中心延伸到数字右侧），再画图标压上去
    const txtX = iconX + iconSz + 4 * S
    c.font = `bold ${15*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    const txtW = c.measureText(`${expPool}`).width
    const padX = 8 * S
    const capH = 26 * S, capR = capH / 2
    const capX = iconX + iconSz * 0.38
    const capW = txtX + txtW + padX - capX
    const capY = expIconCenterY - capH / 2
    c.save()
    c.beginPath()
    c.moveTo(capX + capR, capY); c.lineTo(capX + capW - capR, capY)
    c.quadraticCurveTo(capX + capW, capY, capX + capW, capY + capR)
    c.lineTo(capX + capW, capY + capH - capR)
    c.quadraticCurveTo(capX + capW, capY + capH, capX + capW - capR, capY + capH)
    c.lineTo(capX + capR, capY + capH)
    c.quadraticCurveTo(capX, capY + capH, capX, capY + capH - capR)
    c.lineTo(capX, capY + capR)
    c.quadraticCurveTo(capX, capY, capX + capR, capY)
    c.closePath()
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fill()
    c.restore()

    // 数字
    c.fillStyle = '#fff'
    c.fillText(`${expPool}`, txtX, expIconCenterY)

    // 图标压在胶囊上方
    c.drawImage(expIcon, iconX, iconY, iconSz, iconSz)
  } else {
    c.fillStyle = '#fff'
    c.font = `bold ${15*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText(`${expPool}`, 56 * S, expIconCenterY)
  }

  // === 顶部大图展示区 ===
  const avatarAreaTop = safeTop + 66 * S
  const avatarSize = W * PET_DETAIL_AVATAR_FRAC
  const avatarX = (W - avatarSize) / 2
  const avatarY = avatarAreaTop

  // 属性色光环
  c.save()
  const glowCx = avatarX + avatarSize / 2
  const glowCy = avatarY + avatarSize / 2
  const glowR = avatarSize * 0.72
  const glow = c.createRadialGradient(glowCx, glowCy, glowR * 0.2, glowCx, glowCy, glowR)
  glow.addColorStop(0, ac + '50')
  glow.addColorStop(0.5, ac + '18')
  glow.addColorStop(1, ac + '00')
  c.fillStyle = glow
  c.beginPath(); c.arc(glowCx, glowCy, glowR, 0, Math.PI * 2); c.fill()
  c.restore()

  const avatarPath = getPetAvatarPath({ ...basePet, star: poolPet.star })
  R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 10 * S })

  // === 名称区域（头像下方）：转珠 + 名称 + 等级 ===
  let cy = avatarY + avatarSize * 1.06 + 6 * S

  const orbPath = `assets/orbs/orb_${poolPet.attr || 'metal'}.png`
  const orbImg = R.getImg(orbPath)
  const orbSz = 22 * S
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  const nameW = c.measureText(basePet.name).width
  // 等级标签
  const lvLabel = `Lv.${poolPet.level}`
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  const lvLabelTagW = c.measureText(lvLabel).width + 10 * S
  const tierTagW = lvLabelTagW
  const tierTagH = 17 * S
  const nameGap = 6 * S
  const orbGap = 4 * S
  // 品质标签尺寸
  const badgeText = `[${rv.label}]`
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  const badgeW = c.measureText(badgeText).width
  const badgeGap = 4 * S
  const totalNameW = orbSz + orbGap + nameW + badgeGap + badgeW + nameGap + tierTagW
  const nameStartX = (W - totalNameW) / 2

  // 转珠图标（名称前面）
  if (orbImg && orbImg.width > 0) {
    c.drawImage(orbImg, nameStartX, cy - 1 * S, orbSz, orbSz)
  }

  // 名称
  const nameX = nameStartX + orbSz + orbGap
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.font = `bold ${20*S}px "PingFang SC",sans-serif`
  c.strokeStyle = 'rgba(0,0,0,0.6)'
  c.lineWidth = 4 * S
  c.strokeText(basePet.name, nameX, cy)
  c.fillStyle = '#fff'
  c.fillText(basePet.name, nameX, cy)

  // 品质标签（名字右侧）
  c.save()
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillStyle = rv.badgeColor
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(badgeText, nameX + nameW + badgeGap, cy + 5 * S)
  c.restore()

  // 等级标签（品质标签右侧，醒目白底深色字）
  const tierTagX = nameX + nameW + badgeGap + badgeW + nameGap
  const tierTagY = cy + 3 * S
  c.fillStyle = 'rgba(255,255,255,0.85)'
  R.rr(tierTagX, tierTagY, tierTagW, tierTagH, 4 * S); c.fill()
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1 * S
  R.rr(tierTagX, tierTagY, tierTagW, tierTagH, 4 * S); c.stroke()
  c.fillStyle = '#5A4530'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(lvLabel, tierTagX + tierTagW / 2, tierTagY + tierTagH / 2)

  cy += 26 * S

  // === 星星（名称下方；统一金黄色，未满星为浅金半透明） ===
  const starSize = 14 * S
  const curStar = poolPet.star || 1
  const sv = STAR_VISUAL[curStar] || STAR_VISUAL[1]
  c.font = `${starSize}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  const singleStarW = c.measureText('★').width
  const starsW = singleStarW * maxStar
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  const starNameW = c.measureText(sv.name).width
  const starGap = 4 * S
  const starTotalW = starsW + starGap + starNameW
  let starDrawX = (W - starTotalW) / 2
  c.font = `${starSize}px "PingFang SC",sans-serif`
  for (let i = 0; i < maxStar; i++) {
    c.fillStyle = i < curStar ? STAR_GOLD_ON : STAR_GOLD_OFF
    c.fillText('★', starDrawX, cy)
    starDrawX += singleStarW
  }
  c.fillStyle = '#C9A227'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(sv.name, starDrawX + starGap, cy + (starSize - 12 * S) / 2)

  cy += starSize + 5 * S

  // === 下方信息区：纯色淡底 + 细金边（不用卷轴图，避免装饰边框挤占内容导致溢出） ===
  const cardX = 8 * S
  const cardW = W - 16 * S
  const cardTop = cy + 3 * S
  const cardBottom = H - safeTop - 17 * S
  const cardH = Math.max(80 * S, cardBottom - cardTop)
  const cardRad = 12 * S

  c.fillStyle = 'rgba(255,252,245,0.92)'
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.fill()
  c.strokeStyle = 'rgba(201,168,76,0.5)'; c.lineWidth = 1.2 * S
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.stroke()

  c.save()
  R.rr(cardX, cardTop, cardW, cardH, cardRad); c.clip()
  const rarityGradPanel = c.createLinearGradient(cardX, cardTop, cardX, cardTop + cardH * 0.45)
  rarityGradPanel.addColorStop(0, rv.bgGradient[0] + '18')
  rarityGradPanel.addColorStop(1, rv.bgGradient[1] + '00')
  c.fillStyle = rarityGradPanel
  c.fillRect(cardX, cardTop, cardW, cardH)
  c.restore()

  const padX = 12 * S
  const padY = 8 * S
  const indent = cardX + padX
  const rightEdge = cardX + cardW - padX
  const contentW = rightEdge - indent
  const innerTop = cardTop + padY

  const fBtnPanel = 12 * S
  const lvBarH = 12 * S
  const starBtnH = 27 * S

  cy = innerTop

  // ── 攻击力（左标签右数值） ──
  c.fillStyle = '#5A4530'
  c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('攻击力', indent, cy)
  c.fillStyle = '#CC6600'
  c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`${atk}`, rightEdge, cy)
  cy += 18 * S

  const baseAtk = basePet.atk
  const lvBonus = rarity === 'R' ? Math.floor(poolPet.level * 0.8) : poolPet.level
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  c.fillStyle = 'rgba(90,70,40,0.78)'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.fillText(`基${baseAtk} · 等级+${lvBonus} · 星×${starMul}`, indent, cy)
  cy += 14 * S

  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += 8 * S

  // ── 等级 + 灵石条 + 升级 ──
  c.fillStyle = '#5A4530'
  c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  if (isMaxLv) {
    c.fillText(`Lv.${poolPet.level}`, indent, cy)
    c.fillStyle = '#B8860B'
    c.font = `${13 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText('满级', rightEdge, cy + 1 * S)
    if (isCurrentPet) _rects.levelUpBtnRect = null
  } else {
    c.fillText(`Lv.${poolPet.level}`, indent, cy)
    const barX = indent + 44 * S
    const barW = Math.max(32 * S, contentW - 44 * S - 70 * S)
    const barY = cy + 2 * S
    const lvProgress = Math.min(1, expPool / Math.max(1, nextLvExp))
    c.fillStyle = 'rgba(0,0,0,0.12)'
    R.rr(barX, barY, barW, lvBarH, lvBarH / 2); c.fill()
    if (lvProgress > 0) {
      const fillGrad = c.createLinearGradient(barX, barY, barX + barW * lvProgress, barY)
      fillGrad.addColorStop(0, '#5CB8FF')
      fillGrad.addColorStop(1, '#3A8ADF')
      c.fillStyle = fillGrad
      R.rr(barX, barY, barW * lvProgress, lvBarH, lvBarH / 2); c.fill()
    }
    c.strokeStyle = 'rgba(100,180,255,0.4)'; c.lineWidth = 1 * S
    R.rr(barX, barY, barW, lvBarH, lvBarH / 2); c.stroke()
    const btnWLv = 64 * S
    const btnHLv = 22 * S
    const btnXLv = rightEdge - btnWLv
    const btnYLv = cy - 1 * S
    const canLvUp = expPool >= nextLvExp
    _drawBtn(c, R, S, btnXLv, btnYLv, btnWLv, btnHLv, '升级', canLvUp, '#5CB8FF', fBtnPanel, canLvUp)
    if (isCurrentPet) _rects.levelUpBtnRect = [btnXLv, btnYLv, btnWLv, btnHLv]
  }
  cy += 19 * S
  c.fillStyle = 'rgba(90,70,40,0.78)'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(isMaxLv ? `灵石 ${expPool}` : `灵石 ${expPool}/${nextLvExp}`, indent, cy)
  cy += 14 * S

  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += 8 * S

  // ── 技能（升星解锁时金色高亮） ──
  const skillSectionY = cy
  const fakePet = { ...basePet, star: poolPet.star }
  const hasSkill = petHasSkill(fakePet)
  const lineSkill = 14 * S
  if (g._petSkillUnlockGlow > 0) {
    const gp = g._petSkillUnlockGlow / 30
    c.save()
    c.shadowColor = `rgba(255,200,50,${gp * 0.6})`
    c.shadowBlur = 16 * S * gp
    c.fillStyle = `rgba(255,215,0,${gp * 0.12})`
    R.rr(indent - 6 * S, cy - 4 * S, contentW + 12 * S, 80 * S, 8 * S)
    c.fill()
    c.restore()
    g._petSkillUnlockGlow--
  }
  c.fillStyle = '#5A4530'
  c.font = `bold ${15 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('技能', indent, cy)
  cy += 15 * S

  if (hasSkill) {
    c.fillStyle = 'rgba(90,70,40,0.68)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText('生效中', indent, cy)
    cy += 13 * S
    const skillDesc = getPetSkillDesc(fakePet)
    c.fillStyle = '#2E8B2E'
    c.font = `bold ${13 * S}px "PingFang SC",sans-serif`
    c.fillText(basePet.skill.name, indent, cy)
    cy += 14 * S
    c.fillStyle = 'rgba(70,50,30,0.88)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    const lineCount = wrapTextDraw(c, skillDesc || '', indent, cy, contentW, lineSkill)
    cy += Math.max(1, lineCount) * lineSkill + 2 * S
    if (basePet.skill.cd || basePet.cd) {
      c.fillStyle = 'rgba(90,70,40,0.72)'
      c.font = `${11 * S}px "PingFang SC",sans-serif`
      c.fillText(`CD ${basePet.cd || basePet.skill.cd}回合`, indent, cy)
      cy += 13 * S
    }
  } else if (basePet.skill) {
    c.fillStyle = 'rgba(90,70,40,0.78)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText(`无主动（${sv.name}）`, indent, cy)
    cy += 13 * S
    c.fillStyle = 'rgba(90,70,40,0.55)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.fillText('详情见「升星获得」', indent, cy)
    cy += 12 * S
  } else {
    c.fillStyle = 'rgba(90,70,40,0.72)'
    c.font = `${12 * S}px "PingFang SC",sans-serif`
    c.fillText('无主动', indent, cy)
    cy += 13 * S
  }

  if (curStar >= 4) {
    const passive = getStar4Passive(petId)
    if (passive) {
      c.fillStyle = STAR_VISUAL[4].color
      c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'; c.textBaseline = 'top'
      c.fillText(`被动 ${passive.name}`, indent, cy)
      cy += 12 * S
      c.fillStyle = 'rgba(70,50,30,0.88)'
      c.font = `${11 * S}px "PingFang SC",sans-serif`
      const passiveLines = wrapTextDraw(c, passive.desc, indent, cy, contentW, lineSkill)
      cy += Math.max(1, passiveLines) * lineSkill + 2 * S
    }
  }
  if (curStar >= 5) {
    const star5Data = getStar5Override(petId)
    if (star5Data) {
      c.fillStyle = STAR_VISUAL[5].color
      c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'; c.textBaseline = 'top'
      c.fillText('★5 超越', indent, cy)
      cy += 13 * S
    }
  }

  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += 8 * S

  // ── 升星 + 分解（纵向排布，保留觉醒石条件） ──
  const nextStar = poolPet.star + 1
  if (isCurrentPet) {
    _rects.starUpBtnRect = null
    _rects.decomposeBtnRect = null
  }

  if (nextStar <= maxStar) {
    const lvReq = POOL_STAR_LV_REQ[nextStar]
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    const uniOwn = g.storage.universalFragment || 0
    const petOwn = poolPet.fragments || 0
    const lvOk = poolPet.level >= lvReq
    const fragOk = petOwn + uniOwn >= fragCost
    const uniNeeded = Math.max(0, fragCost - petOwn)

    c.fillStyle = '#5A4530'
    c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    const upLabel = '目标 '
    c.fillText(upLabel, indent, cy)
    let sx = indent + c.measureText(upLabel).width
    c.font = `${starSize}px "PingFang SC",sans-serif`
    const upStarW = c.measureText('★').width
    for (let i = 0; i < maxStar; i++) {
      c.fillStyle = i < nextStar ? STAR_GOLD_ON : STAR_GOLD_OFF
      c.fillText('★', sx, cy)
      sx += upStarW
    }
    cy += 16 * S

    c.font = `${12 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillStyle = lvOk ? '#2E8B2E' : '#CC3333'
    c.fillText(`等级 ${poolPet.level}/${lvReq}`, indent, cy)
    cy += 14 * S

    c.fillStyle = fragOk ? '#2E8B2E' : '#CC3333'
    let fragLine = `碎片 ${petOwn}/${fragCost}`
    if (petOwn < fragCost) {
      fragLine += `（万能 ${Math.min(uniOwn, uniNeeded)}/${uniNeeded}）`
    }
    c.fillText(fragLine, indent, cy)
    cy += 14 * S

    const awakenCost = POOL_STAR_AWAKEN_COST[nextStar] || 0
    const playerAwaken = g.storage.awakenStone || 0
    const awakenOk = awakenCost === 0 || playerAwaken >= awakenCost
    if (awakenCost > 0) {
      c.fillStyle = awakenOk ? '#2E8B2E' : '#CC3333'
      c.fillText(`觉醒 ${playerAwaken}/${awakenCost}`, indent, cy)
      cy += 14 * S
    }

    const canStarUp = lvOk && fragOk && awakenOk
    const sBtnW = Math.min(contentW, rightEdge - indent)
    const sBtnX = indent
    _drawBtn(c, R, S, sBtnX, cy, sBtnW, starBtnH, '升星', canStarUp, '#FFD700', fBtnPanel, canStarUp)
    if (isCurrentPet) _rects.starUpBtnRect = [sBtnX, cy, sBtnW, starBtnH]
    cy += starBtnH + 6 * S
  } else {
    c.fillStyle = '#B8860B'
    c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    let fullStarStr = ''
    for (let i = 0; i < maxStar; i++) fullStarStr += '★'
    c.fillText(`满星 ${fullStarStr}`, indent, cy)
    cy += 16 * S
  }

  // ── 成长路线图（★1→★5 全星级一览）──
  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += 8 * S
  c.fillStyle = '#5A4530'
  c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('成长路线', indent, cy)
  cy += 18 * S

  const roadmap = _buildGrowthRoadmap(petId, basePet)
  const baseRowH = 28 * S
  const starDotR = 5 * S
  const lineX = indent + starDotR   // 时间线 x 坐标
  const textStartX = lineX + 16 * S // 文字起始 x
  const contentRight = rightEdge

  if (isCurrentPet) _rects.roadmapRowRects = []

  let roadmapCursorY = cy
  for (let ri = 0; ri < roadmap.length; ri++) {
    const row = roadmap[ri]
    const isReached = curStar >= row.star
    const isNext = curStar + 1 === row.star
    const isExpanded = _expandedRoadmapStar === row.star

    // 计算该行高度（展开时动态增加）
    let rowH = baseRowH
    const expandedLines = isExpanded ? _buildExpandedRoadmapLines(row, petId, basePet, poolPet) : null
    if (isExpanded) {
      rowH = baseRowH + expandedLines.length * 13 * S + 8 * S
    } else if (isNext && row.fragCost > 0) {
      rowH = baseRowH + 12 * S
    }

    const rowY = roadmapCursorY

    // 整行命中区域（用于点击展开/收起）
    if (isCurrentPet) {
      _rects.roadmapRowRects.push({ star: row.star, rect: [indent, rowY, contentRight - indent, rowH] })
    }

    // 时间线竖线（从当前节点到下一节点）
    if (ri < roadmap.length - 1) {
      c.strokeStyle = isReached ? 'rgba(232,184,32,0.5)' : 'rgba(160,140,100,0.25)'
      c.lineWidth = 1.5 * S
      c.beginPath()
      c.moveTo(lineX, rowY + starDotR * 2)
      c.lineTo(lineX, rowY + rowH)
      c.stroke()
    }

    // 节点圆点
    c.beginPath()
    c.arc(lineX, rowY + starDotR, starDotR, 0, Math.PI * 2)
    if (isReached) {
      c.fillStyle = '#E8B820'
      c.fill()
    } else if (isNext) {
      c.fillStyle = 'rgba(232,184,32,0.4)'
      c.fill()
      c.strokeStyle = '#E8B820'
      c.lineWidth = 1.5 * S
      c.stroke()
    } else {
      c.fillStyle = 'rgba(160,140,100,0.25)'
      c.fill()
    }

    // 展开态底色
    if (isExpanded) {
      c.fillStyle = 'rgba(232,184,32,0.07)'
      R.rr(textStartX - 6 * S, rowY - 2 * S, contentRight - textStartX + 4 * S, rowH - 2 * S, 4 * S)
      c.fill()
    }

    // 星级标签
    const labelColor = isReached ? '#C9A227' : (isNext ? '#8B7535' : 'rgba(120,100,70,0.6)')
    c.fillStyle = labelColor
    c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText(`★${row.star} ${row.name}`, textStartX, rowY + starDotR)

    // 攻击倍率
    const mulX = textStartX + 58 * S
    c.fillStyle = isReached ? '#CC6600' : 'rgba(130,100,50,0.6)'
    c.font = `${10 * S}px "PingFang SC",sans-serif`
    c.fillText(`×${row.atkMul}`, mulX, rowY + starDotR)

    // 解锁内容概述（仅收起态）
    if (!isExpanded) {
      const unlockX = mulX + 28 * S
      const unlockText = row.unlocks.join(' / ')
      c.fillStyle = isReached ? '#2E8B2E' : (isNext ? '#5A4530' : 'rgba(90,70,40,0.55)')
      c.font = `${10 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'
      const maxUnlockW = contentRight - unlockX - 12 * S  // 留出三角指示器空间
      let displayText = unlockText
      if (c.measureText(displayText).width > maxUnlockW) {
        while (displayText.length > 0 && c.measureText(displayText + '…').width > maxUnlockW) {
          displayText = displayText.slice(0, -1)
        }
        displayText += '…'
      }
      c.fillText(displayText, unlockX, rowY + starDotR)
    }

    // 三角指示器（▶ 收起 / ▼ 展开）
    c.fillStyle = 'rgba(120,100,70,0.55)'
    c.font = `${9 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'; c.textBaseline = 'middle'
    c.fillText(isExpanded ? '▼' : '▶', contentRight - 4 * S, rowY + starDotR)

    // 展开态详情
    if (isExpanded) {
      let ly = rowY + baseRowH - 4 * S
      c.textAlign = 'left'; c.textBaseline = 'top'
      c.font = `${10.5 * S}px "PingFang SC",sans-serif`
      for (const line of expandedLines) {
        c.fillStyle = line.color || '#5A4530'
        c.fillText(line.text, textStartX, ly)
        ly += 13 * S
      }
    } else if (isNext && row.fragCost > 0) {
      // 下一星：简略需求提示
      const reqY = rowY + starDotR + 10 * S
      c.fillStyle = 'rgba(90,70,40,0.55)'
      c.font = `${9 * S}px "PingFang SC",sans-serif`
      c.textAlign = 'left'; c.textBaseline = 'middle'
      const reqParts = [`Lv.${row.lvReq}`, `碎×${row.fragCost}`]
      if (row.awakenCost > 0) reqParts.push(`觉×${row.awakenCost}`)
      c.fillText(reqParts.join('  '), textStartX, reqY)
    }

    roadmapCursorY += rowH
  }
  cy = roadmapCursorY + 6 * S

  // ── 分解 ──
  if (poolPet.fragments > 0) {
    drawSeparator(c, indent, cy, rightEdge, '180,140,60')
    cy += 7 * S
    c.fillStyle = 'rgba(90,70,40,0.78)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    c.fillText(`碎片 ${poolPet.fragments}`, indent, cy)
    cy += 14 * S
    const dBtnW = Math.min(contentW, rightEdge - indent)
    _drawBtn(c, R, S, indent, cy, dBtnW, starBtnH, `分解1碎→${FRAGMENT_TO_EXP}灵石`, true, '#B8A0E0', fBtnPanel)
    if (isCurrentPet) _rects.decomposeBtnRect = [indent, cy, dBtnW, starBtnH]
    cy += starBtnH + 4 * S
    c.fillStyle = '#CC3333'
    c.font = `${10 * S}px "PingFang SC",sans-serif`
    c.fillText('分解不可撤回', indent, cy)
  }
}

// ===== 按钮 =====
function _drawBtn(c, R, S, x, y, w, h, text, enabled, color, fontSize, glow) {
  const fs = fontSize || (10 * S)
  const r = 6 * S
  if (enabled) {
    // 呼吸发光（glow=true 时）
    if (glow) {
      const pulse = 0.25 + 0.25 * Math.sin(Date.now() * 0.004)
      c.save()
      c.shadowColor = color
      c.shadowBlur = 10 * S * pulse
      c.strokeStyle = color
      c.lineWidth = 2.5 * S
      c.globalAlpha = 0.5 + pulse
      R.rr(x - 1 * S, y - 1 * S, w + 2 * S, h + 2 * S, r + 1 * S); c.stroke()
      c.restore()
    }
    const grad = c.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, color + '30')
    grad.addColorStop(1, color + '18')
    c.fillStyle = grad
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = color; c.lineWidth = 1.5 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = color
  } else {
    c.fillStyle = 'rgba(80,80,80,0.12)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = 'rgba(120,120,120,0.4)'; c.lineWidth = 1 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#999'
  }
  c.font = `bold ${fs}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(text, x + w / 2, y + h / 2)
}

// ===== 触摸处理 =====
function tPetDetail(g, x, y, type) {
  const { S, W } = V

  if (type === 'start') {
    _swipeStartX = x
    _swipeStartY = y
    _swipeDeltaX = 0
    _swiping = false
    _swipeStartTime = Date.now()

    // 长按升级检测
    if (_rects.levelUpBtnRect && g._hitRect(x, y, ..._rects.levelUpBtnRect)) {
      _longPressTimer = setTimeout(() => {
        _longPressActive = true
        _longPressLoop(g)
      }, 400)
    }
    return
  }

  if (type === 'move') {
    const dx = x - _swipeStartX
    const dy = y - _swipeStartY
    // 水平滑动判定
    if (!_swiping && Math.abs(dx) > 8 * S && Math.abs(dx) > Math.abs(dy) * 1.2) {
      _swiping = true
      _cancelLongPress()
    }
    if (_swiping) {
      _swipeDeltaX = dx
    }
    if (Math.abs(dx) > 3 * S || Math.abs(dy) > 3 * S) {
      _cancelLongPress()
    }
    return
  }

  if (type === 'end') {
    _cancelLongPress()

    // 召唤按钮（未拥有宠物）— 优先检测，避免被 _swiping 误拦截
    if (_rects.summonBtnRect && g._petDetailUnowned && g._hitRect(x, y, ..._rects.summonBtnRect)) {
      _swiping = false
      _swipeDeltaX = 0
      const result = g.storage.summonPet(g._petDetailId)
      if (result.success) {
        g._petDetailUnowned = false
        MusicMgr.playStar3Unlock && MusicMgr.playStar3Unlock()
      }
      return
    }

    // 处理滑动结束
    if (_swiping) {
      _swiping = false
      const elapsed = Date.now() - _swipeStartTime
      const velocity = Math.abs(_swipeDeltaX) / Math.max(1, elapsed)
      const threshold = W * 0.2

      // 快速滑动或超过阈值
      if (Math.abs(_swipeDeltaX) > threshold || (velocity > 0.3 && Math.abs(_swipeDeltaX) > 30 * S)) {
        const pool = _getFilteredPool(g)
        const idx = _getCurrentIndex(g)
        if (_swipeDeltaX > 0 && idx > 0) {
          // 向右滑 → 上一个
          _slideAnim = { from: g._petDetailId, to: pool[idx - 1].id, progress: 0, duration: 12, direction: 1 }
          _swipeDeltaX = 0
          return
        } else if (_swipeDeltaX < 0 && idx < pool.length - 1) {
          // 向左滑 → 下一个
          _slideAnim = { from: g._petDetailId, to: pool[idx + 1].id, progress: 0, duration: 12, direction: -1 }
          _swipeDeltaX = 0
          return
        }
      }
      _swipeDeltaX = 0
      return
    }

    // 返回按钮
    if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
      const returnTo = g._petDetailReturnScene || 'petPool'
      g._petDetailReturnScene = null
      g._petDetailId = null
      g._petDetailUnowned = false
      g.setScene(returnTo)
      MusicMgr.playClick && MusicMgr.playClick()
      return
    }

    // 左箭头翻页
    if (_rects.leftArrowRect && g._hitRect(x, y, ..._rects.leftArrowRect)) {
      _navigatePet(g, -1)
      return
    }

    // 右箭头翻页
    if (_rects.rightArrowRect && g._hitRect(x, y, ..._rects.rightArrowRect)) {
      _navigatePet(g, 1)
      return
    }

    // 升级
    if (_rects.levelUpBtnRect && g._hitRect(x, y, ..._rects.levelUpBtnRect)) {
      _doLevelUp(g)
      return
    }

    // 升星
    if (_rects.starUpBtnRect && g._hitRect(x, y, ..._rects.starUpBtnRect)) {
      _doStarUp(g)
      return
    }

    // 分解
    if (_rects.decomposeBtnRect && g._hitRect(x, y, ..._rects.decomposeBtnRect)) {
      _doDecompose(g)
      return
    }

    // 成长路线图行点击（展开/收起）
    if (_rects.roadmapRowRects && _rects.roadmapRowRects.length > 0) {
      for (const item of _rects.roadmapRowRects) {
        if (g._hitRect(x, y, ...item.rect)) {
          _expandedRoadmapStar = (_expandedRoadmapStar === item.star) ? 0 : item.star
          MusicMgr.playClick && MusicMgr.playClick()
          return
        }
      }
    }
  }
}

function _navigatePet(g, delta) {
  if (_slideAnim) return
  const { W } = V
  const pool = _getFilteredPool(g)
  const idx = _getCurrentIndex(g)
  const newIdx = idx + delta
  if (newIdx < 0 || newIdx >= pool.length) return
  // delta > 0 = 下一个 = 当前页向左滑出, direction = -1
  // delta < 0 = 上一个 = 当前页向右滑出, direction = 1
  _slideAnim = { from: g._petDetailId, to: pool[newIdx].id, progress: 0, duration: 12, direction: delta > 0 ? -1 : 1 }
  _expandedRoadmapStar = 0  // 切换宠物时收起成长路线展开
  MusicMgr.playClick && MusicMgr.playClick()
}

function _doLevelUp(g) {
  const petId = g._petDetailId
  if (!petId) return
  const poolPet = g.storage.getPoolPet(petId)
  if (!poolPet) return
  const rarity = getPetRarity(petId)
  const needed = petExpToNextLevel(poolPet.level, rarity)
  if ((g.storage.soulStone || 0) < needed) return
  const ups = g.storage.investSoulStone(petId, needed)
  if (ups > 0) {
    MusicMgr.playLevelUp && MusicMgr.playLevelUp()
  }
}

function _doStarUp(g) {
  const petId = g._petDetailId
  if (!petId) return
  const prevStar = (g.storage.getPoolPet(petId) || {}).star || 1
  const result = g.storage.upgradePoolPetStar(petId)
  if (result.ok) {
    MusicMgr.playStar3Unlock && MusicMgr.playStar3Unlock()
    g._pendingShareScene = { scene: 'petStarUp', data: { petName: (require('../data/pets').getPetById(petId) || {}).name || petId, star: result.newStar } }
    // ★1 → ★2 首次解锁技能：显示技能名称提示 + 技能区高亮
    if (prevStar === 1 && result.newStar === 2) {
      const basePet = require('../data/pets').getPetById(petId)
      const skillName = basePet && basePet.skill ? basePet.skill.name : ''
      if (skillName && P.showGameToast) {
        P.showGameToast(`技能「${skillName}」已解锁！`)
      }
      g._petSkillUnlockGlow = 30  // 30帧金色高亮动画
    }
  } else {
    const msgMap = {
      max_star: '已达当前灵宠最高星级',
      level_low: `等级需达到 ${result.required} 级`,
      fragments_low: `碎片不足（含万能），需要 ${result.required}`,
      awaken_stone_low: `觉醒石不足，需要 ${result.required}`,
      not_found: '灵宠数据异常',
    }
    const msg = msgMap[result.reason] || '升星失败'
    if (P.showGameToast) P.showGameToast(msg)
  }
}

function _doDecompose(g) {
  const petId = g._petDetailId
  if (!petId) return
  const gained = g.storage.decomposeFragments(petId, 1)
  if (gained > 0) {
    MusicMgr.playReward && MusicMgr.playReward()
  }
}

function _longPressLoop(g) {
  if (!_longPressActive) return
  _doLevelUp(g)
  const poolPet = g.storage.getPoolPet(g._petDetailId)
  const maxLv = poolPet && poolPet.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
  if (poolPet && poolPet.level < maxLv) {
    const rarity = getPetRarity(g._petDetailId)
    const needed = petExpToNextLevel(poolPet.level, rarity)
    if ((g.storage.soulStone || 0) >= needed) {
      _longPressTimer = setTimeout(() => _longPressLoop(g), 120)
      return
    }
  }
  _longPressActive = false
}

function _cancelLongPress() {
  if (_longPressTimer) { clearTimeout(_longPressTimer); _longPressTimer = null }
  _longPressActive = false
}

module.exports = { rPetDetail, tPetDetail }
