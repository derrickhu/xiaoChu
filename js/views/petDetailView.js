/**
 * 宠物详情全屏页面 — 从灵宠池点击宠物进入
 * 参考：竖版角色展示页 + 左右滑动切换宠物
 * 无底部导航栏，左上角返回按钮
 * 渲染入口：rPetDetail  触摸入口：tPetDetail
 */
const V = require('./env')
const uiUtils = require('./uiUtils')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetTier, getPetSkillDesc, getPetAvatarPath, petHasSkill, getPetLore } = require('../data/pets')
const { getPoolPetAtk, petExpToNextLevel, POOL_STAR_FRAG_COST, POOL_STAR_LV_REQ, POOL_MAX_LV, POOL_ADV_MAX_LV, POOL_STAR_ATK_MUL, FRAGMENT_TO_EXP } = require('../data/petPoolConfig')
const MusicMgr = require('../runtime/music')

// 触摸区域
const _rects = {
  backBtnRect: null,
  levelUpBtnRect: null,
  starUpBtnRect: null,
  decomposeBtnRect: null,
  summonBtnRect: null,
  leftArrowRect: null,
  rightArrowRect: null,
}

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
  _rects.summonBtnRect = null
  if (!isUnowned && !_swiping && !_slideAnim) {
    const pool = _getFilteredPool(g)
    const idx = _getCurrentIndex(g)
    const arrowY = safeTop + 72 * S + W * 0.30 / 2
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
  const tier = getPetTier(petId)
  const attrColor = ATTR_COLOR[basePet.attr]
  const attrName = ATTR_NAME[basePet.attr] || basePet.attr
  const ac = attrColor ? attrColor.main : '#666'
  const { SUMMON_FRAG_COST } = require('../data/chestConfig')
  const cost = SUMMON_FRAG_COST[tier] || 15
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
  const img = R.getImg(avatarPath)
  if (img && img.width > 0) {
    c.save()
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 10 * S)
    c.clip()
    const aw = img.width, ah = img.height
    const scale = Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * scale, dh = ah * scale
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
    c.restore()
  }

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
  const totalNameW = orbSz + 4 * S + nameW
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

  cy += 28 * S

  // 档位标签
  const tierColor = tier === 'T1' ? '#FFD700' : tier === 'T2' ? '#8DF' : '#AAA'
  c.fillStyle = tierColor; c.globalAlpha = 0.2
  const tagW = 40 * S, tagH = 18 * S
  R.rr((W - tagW) / 2, cy, tagW, tagH, 4 * S); c.fill()
  c.globalAlpha = 1
  c.strokeStyle = tierColor; c.lineWidth = 1 * S
  R.rr((W - tagW) / 2, cy, tagW, tagH, 4 * S); c.stroke()
  c.fillStyle = tierColor
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(tier, W / 2, cy + tagH / 2)

  cy += tagH + 16 * S

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

  // 技能预览
  c.fillStyle = '#5A4530'
  c.font = `bold ${15*S}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('技能', indent, cy)
  const fakePet = { ...basePet, star: 2 }
  const hasSkill = petHasSkill(fakePet)
  if (hasSkill) {
    c.fillStyle = '#2E8B2E'
    c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText(basePet.skill.name, rightEdge, cy + 1 * S)
    cy += 20 * S
    const skillDesc = getPetSkillDesc(fakePet)
    c.fillStyle = 'rgba(70,50,30,0.85)'
    c.font = `${12*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    wrapTextDraw(c, skillDesc || '', indent, cy, contentW, 16 * S)
    cy += 20 * S
  } else {
    cy += 20 * S
    c.fillStyle = 'rgba(90,70,40,0.7)'
    c.font = `${13*S}px "PingFang SC",sans-serif`
    c.fillText('此灵宠无技能', indent, cy)
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

  // 进度条
  const barW2 = contentW * 0.6
  const barH3 = 14 * S
  const barX2 = indent
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

  // 碎片数字
  c.fillStyle = canSummon ? '#7ecf6a' : 'rgba(90,70,40,0.75)'
  c.font = `${13*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'; c.textBaseline = 'top'
  c.fillText(`${bankFrag} / ${cost}`, rightEdge, cy)
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

  const tier = getPetTier(petId)
  const atk = getPoolPetAtk(poolPet)
  const attrColor = ATTR_COLOR[poolPet.attr]
  const attrName = ATTR_NAME[poolPet.attr] || poolPet.attr
  const expPool = g.storage.petExpPool || 0
  const nextLvExp = petExpToNextLevel(poolPet.level, tier)
  const maxLv = poolPet.source === 'stage' ? POOL_ADV_MAX_LV : POOL_MAX_LV
  const isMaxLv = poolPet.level >= maxLv
  const ac = attrColor ? attrColor.main : '#666'
  const maxStar = poolPet.source === 'stage' ? 4 : 3

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

  // === 经验池图标+数值（返回按钮右侧） ===
  const expIcon = R.getImg('assets/ui/icon_pet_exp.png')
  const expIconCenterY = safeTop + 26 * S
  if (expIcon && expIcon.width > 0) {
    const iconSz = 32 * S
    const iconX = 52 * S
    const iconY = expIconCenterY - iconSz / 2
    // 先量文字宽度，画胶囊（从图标中心延伸到数字右侧），再画图标压上去
    const txtX = iconX + iconSz + 4 * S
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
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
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillText(`${expPool}`, 56 * S, expIconCenterY)
  }

  // === 顶部大图展示区 ===
  const avatarAreaTop = safeTop + 72 * S
  const avatarSize = W * 0.30
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

  // 头像
  const avatarPath = getPetAvatarPath({ ...basePet, star: poolPet.star })
  const img = R.getImg(avatarPath)
  if (img && img.width > 0) {
    c.save()
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 10 * S)
    c.clip()
    const aw = img.width, ah = img.height
    const scale = Math.max(avatarSize / aw, avatarSize / ah)
    const dw = aw * scale, dh = ah * scale
    c.drawImage(img, avatarX + (avatarSize - dw) / 2, avatarY + (avatarSize - dh) / 2, dw, dh)
    c.restore()
  } else {
    c.fillStyle = ac
    c.globalAlpha = 0.2
    R.rr(avatarX, avatarY, avatarSize, avatarSize, 10 * S)
    c.fill()
    c.globalAlpha = 1
    c.fillStyle = '#fff'
    c.font = `bold ${28*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(basePet.name.slice(0, 2), avatarX + avatarSize / 2, avatarY + avatarSize / 2)
  }

  // 属性对应头像框
  const _ATTR_FRAME = { metal: 'yellow', wood: 'green', water: 'blue', fire: 'red', earth: 'brown' }
  const frameColor = _ATTR_FRAME[poolPet.attr] || 'blue'
  const frameImg = R.getImg(`assets/ui/frame_fragment_${frameColor}.png`)
  if (frameImg && frameImg.width > 0) {
    const frameSz = avatarSize * 1.22
    const frameX = avatarX + (avatarSize - frameSz) / 2
    const frameY = avatarY + (avatarSize - frameSz) / 2
    c.drawImage(frameImg, frameX, frameY, frameSz, frameSz)
  }

  // === 名称区域（头像下方）：转珠 + 名称 + 等级 ===
  let cy = avatarY + avatarSize * 1.11 + 10 * S

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
  const totalNameW = orbSz + orbGap + nameW + nameGap + tierTagW
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

  // 等级标签（名称右侧，醒目白底深色字）
  const tierTagX = nameX + nameW + nameGap
  const tierTagY = cy + 3 * S
  c.fillStyle = 'rgba(255,255,255,0.85)'
  R.rr(tierTagX, tierTagY, tierTagW, tierTagH, 4 * S); c.fill()
  c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1 * S
  R.rr(tierTagX, tierTagY, tierTagW, tierTagH, 4 * S); c.stroke()
  c.fillStyle = '#5A4530'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(lvLabel, tierTagX + tierTagW / 2, tierTagY + tierTagH / 2)

  cy += 24 * S

  // === 星星（名称下方，居中横排） ===
  const starSize = 14 * S
  c.font = `${starSize}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  let starTotalStr = ''
  for (let i = 0; i < maxStar; i++) starTotalStr += '★'
  const starTotalW = c.measureText(starTotalStr).width
  let starDrawX = (W - starTotalW) / 2
  for (let i = 0; i < maxStar; i++) {
    c.fillStyle = i < poolPet.star ? '#FFD700' : 'rgba(120,120,120,0.6)'
    c.fillText('★', starDrawX, cy)
    starDrawX += c.measureText('★').width
  }

  cy += starSize + 6 * S

  // === 下方信息卡片区域（两个区块） ===
  const cardX = 6 * S
  const cardW = W - 12 * S
  const cardTop = cy
  const cardBottom = H - safeTop - 24 * S
  const cardH = cardBottom - cardTop
  const cardRad = 14 * S

  // 卡片背景（使用pet_card_bg图片）
  const cardBg = R.getImg('assets/ui/pet_card_bg.png')
  if (cardBg && cardBg.width > 0) {
    c.save()
    R.rr(cardX, cardTop, cardW, cardH, cardRad)
    c.clip()
    // 拉伸填充整个卡片区域
    c.drawImage(cardBg, cardX, cardTop, cardW, cardH)
    c.restore()
  } else {
    c.save()
    c.fillStyle = 'rgba(20,15,10,0.75)'
    R.rr(cardX, cardTop, cardW, cardH, cardRad)
    c.fill()
    c.strokeStyle = 'rgba(201,168,76,0.3)'
    c.lineWidth = 1 * S
    R.rr(cardX, cardTop, cardW, cardH, cardRad)
    c.stroke()
    c.restore()
  }

  // pet_card_bg 有装饰性边框（金色花纹+祥云），按卡片尺寸比例计算内边距
  const borderL = Math.round(cardW * 0.25)   // 左边框 ~25%
  const borderR = Math.round(cardW * 0.10)   // 右边框 ~10%
  const borderT = Math.round(cardH * 0.15)   // 顶部边框 ~15%（继续下移）
  const borderB = Math.round(cardH * 0.14)   // 底部祥云 ~14%
  const indent = cardX + borderL
  const rightEdge = cardX + cardW - borderR
  const contentW = rightEdge - indent

  // 内容可用高度
  const innerTop = cardTop + borderT
  const innerBottom = cardBottom - borderB
  const innerH = innerBottom - innerTop

  // 固定字号（加大，保证清晰可读）
  const fSec = 12 * S      // 区块标题
  const fTitle = 15 * S    // 行标题
  const fBig = 22 * S      // 攻击力数值
  const fBody = 13 * S     // 正文/条件
  const fSmall = 11 * S    // 辅助说明
  const fSkillT = 13 * S   // 技能名
  const fSkillD = 12 * S   // 技能描述
  const fBtn = 12 * S      // 按钮字号
  const lineH = 16 * S     // 技能描述行高
  const barH = 14 * S      // 经验条高
  const btnH = 30 * S      // 按钮高

  // 根据可用高度计算间距（让内容均匀填满）
  const fixedContentH = fSec + fBig + fSmall + fTitle + fBody + // 第一区块
                         fSec + fTitle + fSmall + fTitle + fBody + fBody + btnH // 第二区块
  const remainH = innerH - fixedContentH
  const gap = Math.max(4 * S, Math.min(10 * S, remainH / 18))
  const gapL = gap * 1.6

  cy = innerTop

  // ═══════════════════════════════
  // 第一区块：宠物状态（攻击力 + 技能）
  // ═══════════════════════════════

  // ── 攻击力 ──
  c.fillStyle = '#5A4530'
  c.font = `bold ${fTitle}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  const atkLabelW = c.measureText('攻击力').width
  c.fillText('攻击力', indent, cy + fBig / 2)
  c.fillStyle = '#CC6600'
  c.font = `bold ${fBig}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillText(`${atk}`, indent + atkLabelW + 8 * S, cy + fBig / 2)
  cy += fBig + gap

  const baseAtk = basePet.atk
  const lvBonus = tier === 'T3' ? Math.floor(poolPet.level * 0.8) : poolPet.level
  const starMul = POOL_STAR_ATK_MUL[poolPet.star] || 1.0
  c.fillStyle = 'rgba(90,70,40,0.75)'
  c.font = `${fSmall}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(`基础${baseAtk} + 等级+${lvBonus} × 星级×${starMul}`, indent, cy)
  cy += fSmall + gapL

  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += gap

  // ── 技能 ──
  const fakePet = { ...basePet, star: poolPet.star }
  const hasSkill = petHasSkill(fakePet)
  c.fillStyle = '#5A4530'
  c.font = `bold ${fTitle}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('技能', indent, cy)

  if (hasSkill) {
    const skillDesc = getPetSkillDesc(fakePet)
    c.fillStyle = '#2E8B2E'
    c.font = `bold ${fSkillT}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText(basePet.skill.name, rightEdge, cy + 1 * S)
    cy += fTitle + gap * 0.6
    c.fillStyle = 'rgba(70,50,30,0.85)'
    c.font = `${fSkillD}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    const wrappedLines = wrapTextDraw(c, skillDesc || '', indent, cy, contentW, lineH)
    cy += Math.max(1, wrappedLines) * lineH + gap * 0.5
    if (basePet.skill.cd || basePet.cd) {
      c.fillStyle = 'rgba(90,70,40,0.7)'
      c.font = `${fSmall}px "PingFang SC",sans-serif`
      c.fillText(`冷却: ${basePet.cd || basePet.skill.cd} 回合`, indent, cy)
      cy += fSmall + gap * 0.5
    }
  } else {
    cy += fTitle + gap * 0.6
    c.fillStyle = 'rgba(90,70,40,0.7)'
    c.font = `${fBody}px "PingFang SC",sans-serif`
    c.fillText('★2解锁技能', indent, cy)
    cy += fBody + gap
  }

  cy += gap * 0.5

  // ═══════════════════════════════
  // 分隔：状态区 vs 操作区
  // ═══════════════════════════════
  drawSeparator(c, indent, cy, rightEdge, '180,140,60', 0.5, 0.15, 0.85, 1.5 * S)
  cy += gapL

  // ═══════════════════════════════
  // 第二区块：能力提升（升级 + 升星）
  // ═══════════════════════════════

  c.fillStyle = 'rgba(160,120,50,0.7)'
  c.font = `bold ${fSec}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText('— 能力提升 —', indent, cy)
  cy += fSec + gap

  // ── 等级 + 经验条 + 升级 ──
  c.fillStyle = '#5A4530'
  c.font = `bold ${fTitle}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'

  if (isMaxLv) {
    c.fillText(`Lv.${poolPet.level}`, indent, cy)
    c.fillStyle = '#B8860B'
    c.font = `${fBody}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText('MAX', rightEdge, cy + 1 * S)
    if (isCurrentPet) _rects.levelUpBtnRect = null
  } else {
    c.fillText(`Lv.${poolPet.level}`, indent, cy)
    const lvLabelW2 = c.measureText(`Lv.${poolPet.level}`).width + 8 * S
    const lvBtnW = 52 * S
    const barX = indent + lvLabelW2
    const barW = Math.min(contentW * 0.45, contentW - lvLabelW2 - lvBtnW - 8 * S)
    const barY = cy + (fTitle - barH) / 2
    const lvProgress = Math.min(1, expPool / Math.max(1, nextLvExp))
    c.fillStyle = 'rgba(0,0,0,0.15)'
    R.rr(barX, barY, barW, barH, barH / 2); c.fill()
    if (lvProgress > 0) {
      const fillGrad = c.createLinearGradient(barX, barY, barX + barW * lvProgress, barY)
      fillGrad.addColorStop(0, '#5CB8FF')
      fillGrad.addColorStop(1, '#3A8ADF')
      c.fillStyle = fillGrad
      R.rr(barX, barY, barW * lvProgress, barH, barH / 2); c.fill()
    }
    c.strokeStyle = 'rgba(100,180,255,0.4)'; c.lineWidth = 1 * S
    R.rr(barX, barY, barW, barH, barH / 2); c.stroke()
    const canLvUp = expPool >= nextLvExp
    const lvBtnH = btnH * 0.85
    const btnX = barX + barW + 6 * S, btnY2 = cy + (fTitle - lvBtnH) / 2 - 1 * S
    _drawBtn(c, R, S, btnX, btnY2, lvBtnW, lvBtnH, '升级', canLvUp, '#5CB8FF', fBtn)
    if (isCurrentPet) _rects.levelUpBtnRect = [btnX, btnY2, lvBtnW, lvBtnH]
  }
  cy += fTitle + gap * 0.6
  c.fillStyle = 'rgba(90,70,40,0.75)'
  c.font = `${fSmall}px "PingFang SC",sans-serif`
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillText(`经验池：${expPool}` + (isMaxLv ? '' : ` / 本次需${nextLvExp}`), indent, cy)
  cy += fSmall + gap

  drawSeparator(c, indent, cy, rightEdge, '180,140,60')
  cy += gap

  // ── 升星信息 ──
  const nextStar = poolPet.star + 1
  if (isCurrentPet) {
    _rects.starUpBtnRect = null
    _rects.decomposeBtnRect = null
  }

  if (nextStar <= maxStar) {
    const lvReq = POOL_STAR_LV_REQ[nextStar]
    const fragCost = POOL_STAR_FRAG_COST[nextStar]
    const lvOk = poolPet.level >= lvReq
    const fragOk = poolPet.fragments >= fragCost

    c.fillStyle = '#5A4530'
    c.font = `bold ${fTitle}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    const starUpLabel = '升至 '
    const starUpLabelW = c.measureText(starUpLabel).width
    c.fillText(starUpLabel, indent, cy)
    // 星星逐个绘制：满星黄色，空星深灰色，统一用★
    let starX = indent + starUpLabelW
    for (let i = 0; i < maxStar; i++) {
      c.fillStyle = i < nextStar ? '#FFD700' : 'rgba(120,120,120,0.6)'
      c.fillText('★', starX, cy)
      starX += c.measureText('★').width
    }
    cy += fTitle + gap * 0.6

    c.fillStyle = lvOk ? '#2E8B2E' : '#CC3333'
    c.font = `${fBody}px "PingFang SC",sans-serif`
    c.fillText(`等级 Lv.${poolPet.level} / Lv.${lvReq}`, indent, cy)
    c.textAlign = 'right'
    c.fillText(lvOk ? '✓' : '✗', rightEdge, cy)
    cy += fBody + gap * 0.5

    c.textAlign = 'left'
    c.fillStyle = fragOk ? '#2E8B2E' : '#CC3333'
    c.fillText(`碎片 ${poolPet.fragments} / ${fragCost}`, indent, cy)
    c.textAlign = 'right'
    c.fillText(fragOk ? '✓' : '✗', rightEdge, cy)
    cy += fBody + gapL

    const canStarUp = lvOk && fragOk
    const sBtnW = 72 * S
    _drawBtn(c, R, S, indent, cy, sBtnW, btnH, '升星', canStarUp, '#FFD700', fBtn)
    if (isCurrentPet) _rects.starUpBtnRect = [indent, cy, sBtnW, btnH]

    if (poolPet.fragments > 0) {
      const dBtnW = 96 * S
      const dBtnX = indent + sBtnW + 8 * S
      _drawBtn(c, R, S, dBtnX, cy, dBtnW, btnH, `分解1碎→${FRAGMENT_TO_EXP}经验`, true, '#B8A0E0', fBtn)
      if (isCurrentPet) _rects.decomposeBtnRect = [dBtnX, cy, dBtnW, btnH]
    }
  } else {
    c.fillStyle = '#5A4530'
    c.font = `bold ${fTitle}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'top'
    const fullLabel = '满星 '
    const fullLabelW = c.measureText(fullLabel).width
    c.fillText(fullLabel, indent, cy)
    // 满星星星：黄色填充，无描边
    c.fillStyle = '#FFD700'
    let fullStarStr = ''
    for (let i = 0; i < maxStar; i++) fullStarStr += '★'
    c.fillText(fullStarStr, indent + fullLabelW, cy)
    c.fillStyle = '#FFD700'
    c.fillText(fullStarStr, indent + fullLabelW, cy)
    cy += fTitle + gap * 0.6
    c.fillStyle = 'rgba(90,70,40,0.75)'
    c.font = `${fBody}px "PingFang SC",sans-serif`
    c.fillText(`剩余碎片：${poolPet.fragments}`, indent, cy)
    cy += fBody + gapL
    if (poolPet.fragments > 0) {
      const dBtnW = 110 * S
      _drawBtn(c, R, S, indent, cy, dBtnW, btnH, `分解1碎→${FRAGMENT_TO_EXP}经验`, true, '#B8A0E0', fBtn)
      if (isCurrentPet) _rects.decomposeBtnRect = [indent, cy, dBtnW, btnH]
    }
  }
}

// ===== 按钮 =====
function _drawBtn(c, R, S, x, y, w, h, text, enabled, color, fontSize) {
  const fs = fontSize || (10 * S)
  const r = 6 * S
  if (enabled) {
    c.save()
    c.shadowColor = color; c.shadowBlur = 6 * S
    c.fillStyle = color
    c.globalAlpha = 0.15
    R.rr(x, y, w, h, r); c.fill()
    c.restore()
    c.strokeStyle = color; c.lineWidth = 1.5 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = color
  } else {
    c.fillStyle = 'rgba(80,80,80,0.2)'
    R.rr(x, y, w, h, r); c.fill()
    c.strokeStyle = '#666'; c.lineWidth = 1 * S
    R.rr(x, y, w, h, r); c.stroke()
    c.fillStyle = '#888'
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
      g.scene = g._petDetailReturnScene || 'petPool'
      g._petDetailReturnScene = null
      g._petDetailId = null
      g._petDetailUnowned = false
      MusicMgr.playClick && MusicMgr.playClick()
      return
    }

    // 召唤按钮（未拥有宠物）
    if (_rects.summonBtnRect && g._petDetailUnowned && g._hitRect(x, y, ..._rects.summonBtnRect)) {
      const result = g.storage.summonPet(g._petDetailId)
      if (result.success) {
        g._petDetailUnowned = false
        MusicMgr.playStar3Unlock && MusicMgr.playStar3Unlock()
      }
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
  MusicMgr.playClick && MusicMgr.playClick()
}

function _doLevelUp(g) {
  const petId = g._petDetailId
  if (!petId) return
  const poolPet = g.storage.getPoolPet(petId)
  if (!poolPet) return
  const tier = getPetTier(petId)
  const needed = petExpToNextLevel(poolPet.level, tier)
  if ((g.storage.petExpPool || 0) < needed) return
  const ups = g.storage.investPetExp(petId, needed)
  if (ups > 0) {
    MusicMgr.playLevelUp && MusicMgr.playLevelUp()
  }
}

function _doStarUp(g) {
  const petId = g._petDetailId
  if (!petId) return
  const result = g.storage.upgradePoolPetStar(petId)
  if (result.ok) {
    MusicMgr.playStar3Unlock && MusicMgr.playStar3Unlock()
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
    const tier = getPetTier(g._petDetailId)
    const needed = petExpToNextLevel(poolPet.level, tier)
    if ((g.storage.petExpPool || 0) >= needed) {
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
