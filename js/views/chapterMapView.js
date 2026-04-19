/**
 * 章节主线页 chapterMap — 12 章横向翻页卡
 *
 * 设计意图（plan D2 节）：
 *   · 首页章节带点击进入
 *   · 一屏一卡，左右翻页（横向 swipe + 左右箭头）
 *   · 每卡包含：章节 Boss 剪影、章节名、副标题、主题色、进度条、3 档里程碑槽、徽章
 *   · 底部"继续闯关"按钮 → 跳到该章下一未通关关（若本章全通关则跳下一章第一关；未解锁则 toast）
 *
 * 场景状态：
 *   · g._chapterMapSelected: number  当前查看章节 id（1~12）
 *   · g._chapterMapSwipeDx: number   拖动偏移（渲染时用于缓动）
 *
 * 触摸区（_rects）：
 *   · backBtnRect   返回
 *   · leftArrowRect 左箭头
 *   · rightArrowRect 右箭头
 *   · enterBtnRect  继续闯关
 *   · ticketBtnRect 保底券兑换（历史兼容：仅当玩家持有 v1 版本遗留的保底券时才显示）
 *   · claimRects    [{ tier, rect }] 里程碑槽点击（claimRect 触发"主动领取"，rect 其他区域展示说明）
 *
 * 章节 24★ 奖励设计：
 *   · 直接随机发放一件未拥有的 SSR 法宝（2026-04 后的新方案）
 *   · v1 曾用 weaponTicket 让玩家到兑换页选，玩家反馈"关了找不到兑换页"，已简化为现货发放
 */

const V = require('./env')
const { CHAPTERS, getChapterById, getChapterStages, isStageUnlocked, getStageById, getStageBossAvatar, getStageBossName } = require('../data/stages')
const { MILESTONE_TIERS, getChapterMilestoneReward, getChapterSsrPetId } = require('../data/chapterMilestoneConfig')
const { getPetById, getPetAvatarPath } = require('../data/pets')
const gameToast = require('./gameToast')
const guideMgr = require('../engine/guideManager')
const stageManager = require('../engine/stageManager')
const flyParticles = require('./resourceFlyParticles')

const _rects = {
  backBtnRect: null,
  leftArrowRect: null,
  rightArrowRect: null,
  enterBtnRect: null,
  ticketBtnRect: null,
  milestoneRects: [],   // [{ tier, rect, claimRect? }] — claimRect 仅"可领"状态存在
}

// ==================== 渲染 ====================
function rChapterMap(g) {
  const { ctx: c, R, W, H, S, safeTop } = V

  // 初始化：默认选当前主线章
  if (!g._chapterMapSelected) {
    g._chapterMapSelected = _detectCurrentChapter(g.storage)
  }
  // 已解锁上限：仅允许浏览到"当前可进入"的最深章节，防止提前暴露未解锁剧情 Boss/章名/描述
  //   · 玩家反馈：未解锁章节虽有半透明遮罩，但仍能透过来看到 Boss 剪影和名字
  //   · 对策：箭头硬性只能切到 highestUnlocked，被卡住时页面只展示一句文案，不预告内容
  const highestUnlocked = _computeHighestUnlockedChapter(g.storage)
  if (g._chapterMapSelected > highestUnlocked) g._chapterMapSelected = highestUnlocked
  const chapterId = Math.max(1, Math.min(12, g._chapterMapSelected))
  const chapter = getChapterById(chapterId)
  const themeColor = (chapter && chapter.theme) || '#b89068'

  // 水墨背景：用 event_bg 做底（含主题色遮罩）
  R.drawEventBg(g.af || 0)
  c.save()
  c.fillStyle = _hexToRgba(themeColor, 0.12)
  c.fillRect(0, 0, W, H)
  c.restore()

  const topY = safeTop + 44 * S
  _drawTopBar(c, R, W, S, safeTop, themeColor, chapterId)

  // 主卡片区域（卡片在中间，左右箭头在两侧）
  const cardW = W * 0.84
  const cardX = (W - cardW) / 2
  const cardY = topY + 6 * S
  const cardH = H - cardY - 100 * S // 底部给"继续闯关"按钮区
  _drawChapterCard(c, R, S, cardX, cardY, cardW, cardH, chapterId, g.storage)

  // 左右箭头
  const arrowSz = 32 * S
  const arrowY = cardY + (cardH - arrowSz) / 2
  if (chapterId > 1) {
    _drawArrow(c, R, S, 6 * S, arrowY, arrowSz, 'left', themeColor)
    _rects.leftArrowRect = [6 * S, arrowY, arrowSz, arrowSz]
  } else {
    _rects.leftArrowRect = null
  }
  if (chapterId < highestUnlocked) {
    _drawArrow(c, R, S, W - arrowSz - 6 * S, arrowY, arrowSz, 'right', themeColor)
    _rects.rightArrowRect = [W - arrowSz - 6 * S, arrowY, arrowSz, arrowSz]
  } else {
    _rects.rightArrowRect = null
  }

  // 底部按钮区：只保留"继续闯关"
  //   · v2 已把 24★ 保底券改成直接发 SSR 法宝，玩家不再持有券 → 不再渲染兑换入口
  //   · 旧版残留的 weaponWildcardTickets 由 storage 迁移 v24→v25 自动兑换清零
  const btnH = 44 * S
  const btnY = H - btnH - 28 * S
  _drawPrimaryBtn(c, R, S, cardX, btnY, cardW, btnH, '继续闯关 ›', themeColor)
  _rects.enterBtnRect = [cardX, btnY, cardW, btnH]
  _rects.ticketBtnRect = null

  // 首次进入触发「章节主线」引导
  // 注意：此处每帧都会调用 trigger；guideManager 内已对「同 id 已展示/已在队列」去重，避免队列塞满导致连播死循环
  guideMgr.trigger(g, 'chapter_map_intro')
}

function _detectCurrentChapter(storage) {
  // 取当前玩家未全通关的最低章节，找不到就 12
  for (let ch = 1; ch <= 12; ch++) {
    const stages = getChapterStages(ch, 'normal')
    if (stages.some(s => !storage.isStageCleared(s.id))) return ch
  }
  return 12
}

/**
 * 计算当前玩家可浏览到的最高章节
 *
 * 定义：前一章 stage_8（章末 Boss）已通关 → 下一章解锁
 *   · 第 1 章默认解锁
 *   · 返回值是"玩家被允许查看详情"的最高章 id（不含预告）
 *   · UI 侧用它来限制右箭头 / 钳位 _chapterMapSelected
 */
function _computeHighestUnlockedChapter(storage) {
  for (let ch = 12; ch >= 2; ch--) {
    if (storage.isStageCleared(`stage_${ch - 1}_8`)) return ch
  }
  return 1
}

function _drawTopBar(c, R, W, S, safeTop, themeColor, chapterId) {
  const topH = 40 * S
  const y = safeTop + 4 * S
  c.fillStyle = 'rgba(255,255,255,0.88)'
  R.rr(6 * S, y, W - 12 * S, topH, 6 * S); c.fill()
  c.strokeStyle = _hexToRgba(themeColor, 0.45)
  c.lineWidth = 0.8 * S
  R.rr(6 * S, y, W - 12 * S, topH, 6 * S); c.stroke()

  // 返回按钮
  const backW = 50 * S
  c.fillStyle = _hexToRgba(themeColor, 0.85)
  R.rr(10 * S, y + 6 * S, backW, topH - 12 * S, 4 * S); c.fill()
  c.fillStyle = '#fff8e0'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText('‹ 返回', 10 * S + backW / 2, y + topH / 2)
  _rects.backBtnRect = [10 * S, y + 6 * S, backW, topH - 12 * S]

  // 标题
  c.textAlign = 'center'
  c.fillStyle = '#3d2f22'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText('章节主线', W / 2, y + topH / 2)
  // 右侧：第 X / 12 章指示
  c.textAlign = 'right'
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.fillStyle = themeColor
  c.fillText(`第 ${chapterId} / 12 章`, W - 14 * S, y + topH / 2)
}

function _drawChapterCard(c, R, S, x, y, w, h, chapterId, storage) {
  const chapter = getChapterById(chapterId) || {}
  const themeColor = chapter.theme || '#b89068'

  // 卡片底板（主题色渐变 + 描边）
  const grad = c.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, _hexToRgba(themeColor, 0.35))
  grad.addColorStop(1, 'rgba(255,255,255,0.85)')
  c.fillStyle = grad
  R.rr(x, y, w, h, 10 * S); c.fill()
  c.strokeStyle = _hexToRgba(themeColor, 0.65)
  c.lineWidth = 1.2 * S
  R.rr(x, y, w, h, 10 * S); c.stroke()

  // 是否解锁：前一章主线 stage_8 已通关
  const prevCleared = chapterId === 1 || storage.isStageCleared(`stage_${chapterId - 1}_8`)

  // 顶部：Boss 剪影 + 章名 + 副标题（固定高度）
  const headerH = 110 * S
  _drawCardHeader(c, R, S, x, y, w, headerH, chapterId, chapter, storage, prevCleared)

  // 中部：进度条 + 3 档里程碑槽
  const msAreaY = y + headerH + 8 * S
  _drawCardMilestones(c, R, S, x, msAreaY, w, chapterId, storage, prevCleared)

  // 底部（章末）：徽章 + "本版本起累计" 提示
  const badgeAreaY = y + h - 80 * S
  _drawCardBadge(c, R, S, x, badgeAreaY, w, chapterId, chapter, storage)

  // 未解锁遮罩
  if (!prevCleared) {
    c.save()
    c.fillStyle = 'rgba(30,20,10,0.45)'
    R.rr(x, y, w, h, 10 * S); c.fill()
    c.fillStyle = '#fff8e0'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.font = `bold ${14*S}px "PingFang SC",sans-serif`
    c.fillText(`🔒 通关第${chapterId - 1}章解锁`, x + w / 2, y + h / 2)
    c.restore()
  }
}

function _drawCardHeader(c, R, S, x, y, w, h, chapterId, chapter, storage, prevCleared) {
  const themeColor = chapter.theme || '#b89068'
  // Boss 剪影：取本章 stage_{ch}_8 的 Boss 头像
  const bossStage = getStageById(`stage_${chapterId}_8`)
  const bossAvatar = bossStage ? getStageBossAvatar(bossStage) : null
  if (bossAvatar) {
    const iconSz = 78 * S
    const iconX = x + 14 * S
    const iconY = y + (h - iconSz) / 2
    const img = R.getImg(bossAvatar)
    if (img && img.width > 0) {
      c.save()
      c.globalAlpha = 0.85
      R.drawCoverImg(img, iconX, iconY, iconSz, iconSz, { radius: 8 * S, strokeStyle: themeColor, strokeWidth: 1.5 })
      c.restore()
    }
  }

  const textX = x + 100 * S
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = themeColor
  c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  c.fillText(`第${chapterId}章 · ${chapter.name || ''}`, textX, y + 18 * S)
  c.fillStyle = '#7a5028'
  c.font = `${11*S}px "PingFang SC",sans-serif`
  c.fillText(chapter.subtitle || chapter.desc || '', textX, y + 46 * S)

  // 星数
  const stars = storage.getChapterTotalStars(chapterId, 'normal') || 0
  c.fillStyle = '#3d2f22'
  c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.fillText(`★ ${stars}/24`, textX, y + 72 * S)
}

function _drawCardMilestones(c, R, S, x, y, w, chapterId, storage, prevCleared) {
  const pad = 14 * S
  const innerW = w - pad * 2
  _rects.milestoneRects = []

  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#7a5028'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText('章节里程碑', x + pad, y)

  const currStars = storage.getChapterTotalStars(chapterId, 'normal') || 0

  // 进度条
  const barY = y + 18 * S
  const barH = 6 * S
  c.fillStyle = 'rgba(120,90,40,0.2)'
  R.rr(x + pad, barY, innerW, barH, barH / 2); c.fill()
  const themeColor = (getChapterById(chapterId) && getChapterById(chapterId).theme) || '#d4a843'
  if (currStars > 0) {
    c.fillStyle = themeColor
    R.rr(x + pad, barY, Math.max(barH, innerW * Math.min(1, currStars / 24)), barH, barH / 2); c.fill()
  }

  // 节点
  for (const tier of MILESTONE_TIERS) {
    const tx = x + pad + (tier / 24) * innerW
    const claimed = storage.isChapterMilestoneClaimed(chapterId, tier)
    c.fillStyle = claimed ? '#d4a843' : (currStars >= tier ? '#ff7a28' : 'rgba(160,130,80,0.6)')
    c.beginPath(); c.arc(tx, barY + barH / 2, 5 * S, 0, Math.PI * 2); c.fill()
    c.strokeStyle = '#fff8e0'; c.lineWidth = 1 * S
    c.beginPath(); c.arc(tx, barY + barH / 2, 5 * S, 0, Math.PI * 2); c.stroke()
  }

  // 3 档里程碑槽（横排）
  //   · 每档奖励条目数不同（tier 16 固定 4 条），slotH 动态取"本章三档里最多条目数"
  //   · 槽内顶行固定 32*S（★标签 + 领取按钮），之后每条奖励占 20*S，底部 8*S 内边距
  const slotY = barY + 16 * S
  const slotGap = 8 * S
  const slotW = (innerW - slotGap * 2) / 3
  let maxRewardRows = 0
  for (const t of MILESTONE_TIERS) {
    maxRewardRows = Math.max(maxRewardRows, (getChapterMilestoneReward(chapterId, t) || []).length)
  }
  const slotH = 32 * S + maxRewardRows * 20 * S + 8 * S
  for (let i = 0; i < MILESTONE_TIERS.length; i++) {
    const tier = MILESTONE_TIERS[i]
    const sx = x + pad + i * (slotW + slotGap)
    const claimRect = _drawMilestoneSlot(c, R, S, sx, slotY, slotW, slotH, chapterId, tier, currStars, storage, themeColor)
    _rects.milestoneRects.push({ tier, rect: [sx, slotY, slotW, slotH], claimRect })
  }

  // 说明文案（老玩家"本版本起累计"）
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#8b7355'
  c.font = `${8.5*S}px "PingFang SC",sans-serif`
  c.fillText('* 历史通关的星会自动计入，可直接「领取」章节奖励', x + pad, slotY + slotH + 8 * S)
}

/**
 * 里程碑槽位（重构版）
 *
 * 布局改动（v2）：
 *   · 原设计在槽里放长句"已达成（下次打关发放）"+ 奖励列，文字 11 字在 ~91px 宽槽里必溢出
 *   · 新设计：顶行 "★N" 左对齐 + 右侧小 chip（已领 ✓ / 差 N★ / [领取] 按钮）
 *     奖励行缩短用语、全部 4~7 字内可放
 *
 * 可领状态：
 *   · 返回 claimRect 写入 _rects.milestoneRects，点击触发手动领取（老玩家补发）
 */
function _drawMilestoneSlot(c, R, S, x, y, w, h, chapterId, tier, currStars, storage, themeColor) {
  const claimed = storage.isChapterMilestoneClaimed(chapterId, tier)
  const canClaim = currStars >= tier && !claimed
  const locked = currStars < tier

  c.fillStyle = claimed
    ? 'rgba(180,220,180,0.4)'
    : canClaim ? _hexToRgba(themeColor, 0.3) : 'rgba(200,190,170,0.35)'
  R.rr(x, y, w, h, 6 * S); c.fill()
  c.strokeStyle = claimed ? 'rgba(80,160,80,0.8)' : canClaim ? themeColor : 'rgba(160,130,80,0.4)'
  c.lineWidth = claimed ? 1.4 * S : canClaim ? 1.6 * S : 0.8 * S
  R.rr(x, y, w, h, 6 * S); c.stroke()

  // ── 顶行：左"★N" 徽章 + 右状态 chip / 领取按钮 ──
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = claimed ? '#3d7a3d' : canClaim ? '#a05010' : '#7a5028'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText(`★${tier}`, x + 8 * S, y + 14 * S)

  let claimRect = null
  if (canClaim) {
    // [领取] 按钮：绿色实心胶囊，点击手动发奖
    const btnW = 40 * S
    const btnH = 18 * S
    const btnX = x + w - btnW - 6 * S
    const btnY = y + 14 * S - btnH / 2
    const grad = c.createLinearGradient(btnX, btnY, btnX, btnY + btnH)
    grad.addColorStop(0, '#5fbf5f')
    grad.addColorStop(1, '#3d7a3d')
    c.fillStyle = grad
    R.rr(btnX, btnY, btnW, btnH, btnH / 2); c.fill()
    c.strokeStyle = '#2d5a2d'; c.lineWidth = 0.8 * S
    R.rr(btnX, btnY, btnW, btnH, btnH / 2); c.stroke()
    c.fillStyle = '#fff8e0'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('领取', btnX + btnW / 2, btnY + btnH / 2)
    claimRect = [btnX, btnY, btnW, btnH]
  } else if (claimed) {
    // 已领小 chip
    c.fillStyle = 'rgba(80,160,80,0.22)'
    const chipW = 36 * S, chipH = 16 * S
    const chipX = x + w - chipW - 6 * S, chipY = y + 14 * S - chipH / 2
    R.rr(chipX, chipY, chipW, chipH, chipH / 2); c.fill()
    c.fillStyle = '#3d7a3d'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.fillText('已领', chipX + chipW / 2, chipY + chipH / 2)
  } else {
    // 未达成：差 N★
    c.textAlign = 'right'; c.textBaseline = 'middle'
    c.fillStyle = '#8b7355'
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`差${tier - currStars}★`, x + w - 6 * S, y + 14 * S)
  }

  // ── 奖励 icon 列：短文案（≤7 字）+ icon ──
  const rewards = getChapterMilestoneReward(chapterId, tier)
  const iconSz = 16 * S
  const rowGap = 4 * S
  let ry = y + 32 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  for (const r of rewards) {
    const lineY = ry + iconSz / 2
    let ix = x + 8 * S
    let iconPath = null, emoji = null
    let text = ''
    if (r.type === 'soulStone')          { iconPath = 'assets/ui/icon_soul_stone.png'; text = `+${r.amount}` }
    else if (r.type === 'awakenStone')   { iconPath = 'assets/ui/icon_awaken_stone.png'; text = `+${r.amount}` }
    else if (r.type === 'universalFragment') { iconPath = 'assets/ui/icon_universal_frag.png'; text = `×${r.count}` }
    else if (r.type === 'ssrFragment')   { emoji = '💠'; text = `SSR碎×${r.count}` }
    // SSR 法宝：用底栏「法宝」Tab 同款 icon（nav_weapon），避免 ⚔️ 像武器不像法宝
    else if (r.type === 'ssrWeapon')     { iconPath = 'assets/ui/nav_weapon.png'; text = `SSR法宝×1` }
    else if (r.type === 'weaponTicket')  { emoji = '🎫'; text = `法宝保底券×${r.count}` }

    if (iconPath) {
      const img = R.getImg(iconPath)
      if (img && img.width > 0) c.drawImage(img, ix, ry, iconSz, iconSz)
      ix += iconSz + 3 * S
    } else if (emoji) {
      c.font = `${iconSz}px "PingFang SC",sans-serif`
      c.fillStyle = '#7a5028'
      c.fillText(emoji, ix, lineY)
      ix += iconSz + 3 * S
    }
    // SSR 法宝作为终极奖励，单独放一行并加深颜色，视觉上拉开与其他奖励的差距
    if (r.type === 'ssrWeapon' || r.type === 'weaponTicket') {
      c.textAlign = 'left'; c.textBaseline = 'middle'
      c.font = `bold ${9.5*S}px "PingFang SC",sans-serif`
      c.fillStyle = claimed ? '#3d7a3d' : '#a05010'
      c.fillText(text, ix, lineY)
    } else {
      c.font = `bold ${9*S}px "PingFang SC",sans-serif`
      c.fillStyle = claimed ? '#3d7a3d' : '#7a5028'
      c.fillText(text, ix, lineY)
    }
    ry += iconSz + rowGap
  }

  return claimRect
}

function _drawCardBadge(c, R, S, x, y, w, chapterId, chapter, storage) {
  const unlocked = storage.isChapterBadgeUnlocked(chapterId)
  const pad = 14 * S
  const rowH = 56 * S
  c.fillStyle = unlocked ? 'rgba(230,180,60,0.18)' : 'rgba(160,130,80,0.1)'
  R.rr(x + pad, y, w - pad * 2, rowH, 6 * S); c.fill()
  c.strokeStyle = unlocked ? 'rgba(230,180,60,0.7)' : 'rgba(160,130,80,0.3)'
  c.lineWidth = 0.8 * S
  R.rr(x + pad, y, w - pad * 2, rowH, 6 * S); c.stroke()

  const badgePath = chapter.badgeKey ? `assets/ui/badges/${chapter.badgeKey}.png` : null
  const img = badgePath ? R.getImg(badgePath) : null
  const iconSz = 38 * S
  const iconX = x + pad + 10 * S
  const iconY = y + (rowH - iconSz) / 2
  if (img && img.width > 0) {
    c.save()
    if (!unlocked) c.globalAlpha = 0.35
    c.drawImage(img, iconX, iconY, iconSz, iconSz)
    c.restore()
  } else {
    // 占位：金色圆 + 🏅
    c.fillStyle = unlocked ? 'rgba(255,220,140,0.95)' : 'rgba(180,160,120,0.5)'
    c.beginPath(); c.arc(iconX + iconSz / 2, iconY + iconSz / 2, iconSz / 2, 0, Math.PI * 2); c.fill()
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.font = `${iconSz * 0.6}px "PingFang SC",sans-serif`
    c.fillStyle = unlocked ? '#a05010' : '#7a5028'
    c.fillText('🏅', iconX + iconSz / 2, iconY + iconSz / 2)
  }

  const textX = iconX + iconSz + 10 * S
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = unlocked ? '#a05010' : '#7a5028'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(unlocked ? `${chapter.name}·徽章已点亮` : `${chapter.name}·徽章（未解锁）`, textX, y + 12 * S)
  c.fillStyle = '#8b7355'
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillText(unlocked ? '全 3 星成就 · 章节主线页可查看' : '达成本章全 3 星后点亮', textX, y + 30 * S)
}

function _drawArrow(c, R, S, x, y, sz, dir, themeColor) {
  c.save()
  c.fillStyle = _hexToRgba(themeColor, 0.85)
  c.beginPath(); c.arc(x + sz / 2, y + sz / 2, sz / 2, 0, Math.PI * 2); c.fill()
  c.fillStyle = '#fff8e0'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${sz * 0.55}px "PingFang SC",sans-serif`
  c.fillText(dir === 'left' ? '‹' : '›', x + sz / 2, y + sz / 2)
  c.restore()
}

function _drawPrimaryBtn(c, R, S, x, y, w, h, label, themeColor) {
  const grad = c.createLinearGradient(x, y, x, y + h)
  grad.addColorStop(0, _shadeHex(themeColor, 1.08))
  grad.addColorStop(1, _shadeHex(themeColor, 0.85))
  c.fillStyle = grad
  R.rr(x, y, w, h, h / 2); c.fill()
  c.strokeStyle = _shadeHex(themeColor, 0.6)
  c.lineWidth = 1 * S
  R.rr(x, y, w, h, h / 2); c.stroke()
  c.fillStyle = '#fff8e0'
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  c.fillText(label, x + w / 2, y + h / 2)
}

function _drawSecondaryBtn(c, R, S, x, y, w, h, label, themeColor) {
  c.fillStyle = 'rgba(255,255,255,0.88)'
  R.rr(x, y, w, h, h / 2); c.fill()
  c.strokeStyle = _hexToRgba(themeColor, 0.85)
  c.lineWidth = 1.2 * S
  R.rr(x, y, w, h, h / 2); c.stroke()
  c.fillStyle = themeColor
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(label, x + w / 2, y + h / 2)
}

// ==================== 触摸 ====================
function tChapterMap(g, x, y, type) {
  if (type !== 'end') return

  if (_rects.backBtnRect && _hit(x, y, _rects.backBtnRect)) {
    g.setScene('title')
    return
  }
  if (_rects.leftArrowRect && _hit(x, y, _rects.leftArrowRect)) {
    g._chapterMapSelected = Math.max(1, (g._chapterMapSelected || 1) - 1)
    return
  }
  if (_rects.rightArrowRect && _hit(x, y, _rects.rightArrowRect)) {
    g._chapterMapSelected = Math.min(12, (g._chapterMapSelected || 1) + 1)
    return
  }
  if (_rects.enterBtnRect && _hit(x, y, _rects.enterBtnRect)) {
    _enterChapter(g, g._chapterMapSelected)
    return
  }
  if (_rects.ticketBtnRect && _hit(x, y, _rects.ticketBtnRect)) {
    g._prevSceneBeforeTicket = 'chapterMap'
    g.setScene('weaponTicket')
    return
  }
  // 先判"领取"按钮（小热区），命中就手动发奖；否则把整个 slot 作为"详情 toast"
  for (const m of _rects.milestoneRects) {
    if (m.claimRect && _hit(x, y, m.claimRect)) {
      _handleClaim(g, g._chapterMapSelected, m.tier, m.claimRect)
      return
    }
  }
  for (const m of _rects.milestoneRects) {
    if (_hit(x, y, m.rect)) {
      _showMilestoneDetail(g, g._chapterMapSelected, m.tier)
      return
    }
  }
}

/**
 * 手动领取里程碑奖励
 *
 * · 发奖后触发资源飞入特效（起点 = 领取按钮中心），给玩家一次"爽点"
 * · 再 toast 提示档位已领取
 * · 保底券类奖励飞不出图标（没有对应 icon_*.png），靠 toast 提示补位
 */
function _handleClaim(g, chapterId, tier, claimRect) {
  const result = stageManager.grantChapterMilestoneManually(g, chapterId, tier)
  if (!result) {
    gameToast.show('未达成或已领取')
    return
  }
  const { S } = V
  const sx = claimRect[0] + claimRect[2] / 2
  const sy = claimRect[1] + claimRect[3] / 2
  let ssrWeaponName = null
  let ssrFallbackCount = 0
  for (const reward of result.rewards) {
    if (reward.type === 'ssrWeapon') ssrWeaponName = reward.weaponName
    if (reward.type === 'universalFragment' && reward.fromSsrWeaponFallback) ssrFallbackCount = reward.count
    // 所有奖励统一飞向顶栏（resourceFlyParticles 内按 type 映射到对应图标）
    //   · soulStone / awakenStone / universalFragment / ssrFragment / ssrWeapon 全部有飞效
    //   · ssrWeapon 飞效用 nav_weapon 与里程碑槽内 icon 一致
    flyParticles.spawnFromReward(g, reward, sx, sy)
  }
  gameToast.show(`章节里程碑 ★${tier} 已领取`)
  // SSR 法宝当场到手：延迟一条 toast 播报具体法宝名，让玩家明确知道拿到了什么
  //   · 全拥有走兜底：提示"万能碎片 ×60（重复补偿）"，不留 ambiguity
  if (ssrWeaponName) {
    setTimeout(() => gameToast.show(`获得 SSR 法宝「${ssrWeaponName}」`, { type: 'success' }), 700)
  } else if (ssrFallbackCount > 0) {
    setTimeout(() => gameToast.show(`已拥有全部 SSR 法宝，补偿万能碎片 ×${ssrFallbackCount}`, { type: 'success' }), 700)
  }
  g._dirty = true
}

/**
 * 非"领取按钮"的点击 → toast 展示该档状态/用途说明
 *
 * 保底券这件物品玩家之前没见过，额外给一句"可兑换 SSR 法宝"的解释
 */
function _showMilestoneDetail(g, chapterId, tier) {
  const claimed = g.storage.isChapterMilestoneClaimed(chapterId, tier)
  const currStars = g.storage.getChapterTotalStars(chapterId, 'normal') || 0
  const rewards = getChapterMilestoneReward(chapterId, tier) || []
  const hasSsrWeapon = rewards.some(r => r.type === 'ssrWeapon' || r.type === 'weaponTicket')
  if (claimed) {
    gameToast.show('该里程碑已领取')
  } else if (currStars >= tier) {
    gameToast.show('可领取 · 点击右侧「领取」按钮')
  } else {
    gameToast.show(hasSsrWeapon
      ? `还差 ${tier - currStars}★ 达成 · 奖励含 SSR 法宝 ×1`
      : `还差 ${tier - currStars}★ 达成`)
  }
}

function _enterChapter(g, chapterId) {
  // 前一章未通关 → 提示
  if (chapterId > 1 && !g.storage.isStageCleared(`stage_${chapterId - 1}_8`)) {
    gameToast.show(`需先通关第${chapterId - 1}章`, { type: 'warn' })
    return
  }
  // 找本章第一个未通关关；若全通关则进入 stage_{ch}_1（回刷）
  const stages = getChapterStages(chapterId, 'normal')
  let target = null
  for (const s of stages) {
    if (!g.storage.isStageCleared(s.id) && isStageUnlocked(s.id, g.storage.stageClearRecord, g.storage.petPoolCount)) {
      target = s
      break
    }
  }
  if (!target) target = stages[0]
  g._selectedStageId = target.id
  g._stageDifficulty = 'normal'
  g.setScene('stageInfo')
}

function _hit(x, y, rect) {
  if (!rect) return false
  return x >= rect[0] && x <= rect[0] + rect[2] && y >= rect[1] && y <= rect[1] + rect[3]
}

function _hexToRgba(hex, alpha) {
  if (!hex) return `rgba(180,144,104,${alpha})`
  const h = hex.replace('#', '')
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255
  return `rgba(${r},${g},${b},${alpha})`
}

function _shadeHex(hex, factor) {
  if (!hex) return '#b89068'
  const h = hex.replace('#', '')
  const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16)
  let r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255
  r = Math.round(Math.min(255, Math.max(0, r * factor)))
  g = Math.round(Math.min(255, Math.max(0, g * factor)))
  b = Math.round(Math.min(255, Math.max(0, b * factor)))
  return `rgb(${r},${g},${b})`
}

module.exports = {
  rChapterMap,
  tChapterMap,
}
