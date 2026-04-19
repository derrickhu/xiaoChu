/**
 * 关卡结算页 — 全屏水墨风格
 * 胜利：金色光芒 + 评价星级 + 奖励高亮展示
 * 失败：败因分析 + 变强建议
 * 渲染入口：rStageResult  触摸入口：tStageResult
 */
const V = require('./env')
const { ATTR_COLOR, ATTR_NAME } = require('../data/tower')
const { getPetById, getPetAvatarPath, getPetRarity } = require('../data/pets')
const { getWeaponById, getWeaponRarity } = require('../data/weapons')
const { rarityVisualForAttr, rgbaFromHex } = require('../data/rewardVisual')
const { MAX_LEVEL, expToNextLevel, currentRealm, getRealmByLv } = require('../data/cultivationConfig')
const { POOL_STAR_FRAG_COST } = require('../data/petPoolConfig')
const { getNextStageId, getStageById, getChapterById, isStageUnlocked } = require('../data/stages')
const { analyzeDefeat } = require('../engine/strategyAdvisor')
const MusicMgr = require('../runtime/music')
const AdManager = require('../adManager')
const { drawCelebrationBackdrop, drawLingHeader, drawShareIconBtn } = require('./uiComponents')
const shareCelebrate = require('./shareCelebrate')
const { SHARE_SCENES } = require('../data/shareConfig')
const { LING } = require('../data/lingIdentity')
const { drawCultLvUpRow: _drawCultLvUpRow, drawCultSubRealmUpRow: _drawCultSubRealmUpRow } = require('./cultFeedbackUi')
const goalHint = require('./goalHintView')
const C = require('./uiColors')
const lingCheer = require('./lingCheer')
const buttonFx = require('./buttonFx')
const shareHooks = require('../data/shareHooks')

const _rects = {
  backBtnRect: null,
  nextBtnRect: null,
  shareBtnRect: null,
  adDoubleBtnRect: null,
  staminaRefundBtnRect: null,
  goalTailRect: null,    // 胜利结算页底部"下一里程碑"整条命中区
  goalTailBtnRect: null, // 上述右侧"查看 >"按钮命中区
}

let _animTimer = 0
// 以 result 对象引用变化作为"首次进入结算页"的判据：
//   每次 settleStage 都会构造新的 g._stageResult 对象，引用必然变化；
//   若沿用 _lastScene === 'stageResult' 的判据，离开结算页时不会触发重置，
//   下次再进入（如 1-2/1-3 通关）会认为"场景未切换"，导致首帧逻辑（lingCheer、
//   shareHooks、tierCeremony、chapterComplete 等）全部哑火。
let _lastResultRef = null

// ===== 主动分享按钮（胜/败/首通/重玩常驻，游戏标准 gold 款按钮样式）=====
// 位置：贴底部按钮行右下外侧，按钮高度 36*S（和"下一关"等高，宽 84*S）
// 行为：
//   · shareCelebrate 被动卡片正在展示时，隐藏按钮，避免主被动入口打架
//   · 首通胜利加呼吸金光，把情绪高点引流到主动分享
//   · 失败胜利都显示；失败时的文案走 activeStageShare 的 victory=false 分支（"来帮我一起"）
//   · 上"分享" + 下"灵石icon +20"：主动作零歧义 + 奖励明牌提升转化
const _SHARE_CAPSULE_H = 36
function _drawShareIconBtnOnResult(g, rightEdgeX, btnY, btnH, result, scroll, isVictory) {
  const { S, ctx: c, R } = V
  if (shareCelebrate && shareCelebrate.isActive && shareCelebrate.isActive()) {
    _rects.shareBtnRect = null
    return
  }
  const h = _SHARE_CAPSULE_H * S
  const y = btnY + btnH + 8 * S
  const glow = !!(isVictory && result && result.victory && result.isFirstClear)
  // 按钮上的"+N"要和实际入账完全对齐：
  //   · 包含每日基础 + 首次永久(+100) + 场景(+20) 三档合并后的灵石数
  //   · 只取场景奖 20 会出现"按钮显示 +20，实发 +120"的错位（玩家反馈）
  const { previewShareReward } = require('../data/shareRewardCalc')
  const preview = previewShareReward(g.storage, 'activeStageShare')
  const reward = (preview && preview.soulStone) || 0
  const rect = drawShareIconBtn(c, R, S, rightEdgeX, y, h, { glow, reward })
  _rects.shareBtnRect = [rect.x, rect.y - scroll, rect.w, rect.h]
}

/** 胜利结算奖励面板：总可滚高度超出屏高时，在面板可视区内滚动 */
let _victoryRewardScroll = 0
let _victoryRewardScrollMax = 0
let _victoryRewardViewport = null
let _victScrollActive = false
let _victScrollStartY = 0
let _victScrollLastY = 0
let _victScrollMoved = false

function rStageResult(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V

  const result = g._stageResult
  // 以 result 引用变化判定"首次进入结算页"：每关 settleStage 生成新对象，引用必变。
  //   必须放在 if(!result) 之前判断，否则 null → 新对象 的切换会漏。
  const sceneSwitched = _lastResultRef !== result
  if (sceneSwitched) {
    _animTimer = 0
    _lastResultRef = result
    _victoryRewardScroll = 0
    _victoryRewardScrollMax = 0
    _victoryRewardViewport = null
  }
  _animTimer++
  const at = _animTimer
  const fadeIn = Math.min(1, at / 20)

  if (!result) return

  if (!result.victory) {
    _victoryRewardScrollMax = 0
    _victoryRewardViewport = null
  }

  // 首通庆贺横条：在结算页首帧由小灵露脸夸一句（不打断逐个庆祝 / 全屏总览）
  if (at === 1 && !result._lingCheered && result.victory && result.isFirstClear) {
    result._lingCheered = true
    const stage = getStageById(result.stageId)
    const stageName = (stage && stage.name) || ''
    const msg = _isFinalBossStageResult(result)
      ? LING.cheer.stageFirstClearBoss()
      : LING.cheer.stageFirstClear(stageName)
    lingCheer.show(msg, { tone: 'epic', duration: 2400 })
  }

  // 情绪峰值：首通 / 首宠 / 首 S / 逆风翻盘 → 触发炫耀卡弹窗（shareHooks 内部幂等 + 静默名单）
  //
  // 【触发时机的节奏设计（方向 A+B）】
  //   1-1 首通：静默（教学关，玩家还没形成"我在玩一个游戏"的认知，炫耀阈值太低）
  //   1-2 首通：静默（继续让玩家沉浸熟悉节奏）
  //   1-3 首通：弹 firstPet（此时玩家刚看完 _newbieTeamOverview 首队总览，情绪峰值最高）
  //   1-4 起 ：按关弹 stageFirstClear
  //   任一关 S：firstSRating（但 1-1/1-2 的 S 不点燃"一生一次"，避免浪费在低含金量事件）
  //   任一关"血量 <=10% 翻盘胜利"：弹 comebackWin（1-1/1-2 同样静默）
  //   章节圆满：chapterComplete 不受新手静默限制（里程碑事件罕见）
  //   具体静默名单在 shareHooks 内部收口，这里只负责"把语义事件报出去"
  if (at === 1 && !result._shareCelebrated && result.victory && result.isFirstClear) {
    result._shareCelebrated = true
    const stage = getStageById(result.stageId)
    const stageName = (stage && stage.name) || ''
    const isFinalBoss = !!(stage && stage.chapter === 12 && stage.order === 8)
    const isElite = !!(stage && stage.difficulty === 'elite')
    const turns = result.turns || result.turnCount || 0

    // 【方案 A · 2026-04】触发优先级（后者会被前面已占位的 shareCelebrate 让位吞掉）：
    //   chapterComplete（章节圆满仪式感）
    //     > firstSRating（首次 S，章≥2 才弹炫耀卡）
    //     > firstPet（1-3 首队成型）
    //     > stageFirstClear（仅 lingCheer，不占位）
    // 原实现把 stageFirstClear 放第一位，导致章末 S + chapterComplete 场景下常被 stageFirstClear 抢先
    // 1. 章节圆满最高优先级
    if (result.chapterClearReward && stage && stage.chapter) {
      const { CHAPTERS } = require('../data/stages')
      const ch = CHAPTERS.find(c => c.id === stage.chapter)
      shareHooks.onChapterComplete(g, {
        chapterId: `ch_${stage.chapter}`,
        chapterName: (ch && ch.name) || `第${stage.chapter}章`,
      })
    }
    // 2. 首次 S（shareHooks 内部会区分第 1 章只 cheer / 第 2 章起弹炫耀卡）
    if (result.rating === 'S') {
      shareHooks.onFirstSRating(g, { stageId: result.stageId, stageName, turns })
    }
    // 3. 1-3 首队成型
    if (result.stageId === 'stage_1_3') {
      const firstPet = (g.storage.petPool || [])[0]
      const petMeta = firstPet ? getPetById(firstPet.id) : null
      const petName = (petMeta && petMeta.name) || '灵宠'
      shareHooks.onFirstPet(g, { petName })
    } else {
      // 4. 普通关首通：只 lingCheer，不弹炫耀卡（不会与前面事件冲突）
      shareHooks.onStageFirstClear(g, {
        stageId: result.stageId, stageName,
        rating: result.rating, isFinalBoss, isElite, turns,
      })
    }
  }

  // 逆风翻盘：任意胜利（不必首通）且战斗中最低血量 ≤ 10%
  //   与 firstPet/stageFirstClear 互斥由 shareCelebrate._state 幂等保证（已有其他弹窗则让位）
  if (at === 1 && !result._comebackChecked && result.victory) {
    result._comebackChecked = true
    const minRatio = typeof result.heroMinHpRatio === 'number' ? result.heroMinHpRatio : 1
    if (minRatio > 0 && minRatio <= 0.10) {
      const stage = getStageById(result.stageId)
      const stageName = (stage && stage.name) || ''
      shareHooks.onComebackWin(g, {
        stageId: result.stageId,
        stageName,
        hpPct: Math.round(minRatio * 100),
      })
    }
  }

  // 境界晋升（A1 重构后）：由 stageManager 的 addCultExp 已记录 result.cultRealmUp
  //   · 大境界跨档（major）在结算页入场首帧弹全屏仪式
  //   · 小阶跨档（minor）在结算页中以金光行形式展示（见 _drawRealmMinorUpLine）
  if (at === 1 && !result._tierCeremonyChecked && result.victory) {
    result._tierCeremonyChecked = true
    const up = result.cultRealmUp
    if (up && up.kind === 'major') {
      const tierCeremony = require('./tierCeremony')
      tierCeremony.trigger(g, up.prev, up.curr)
    }
  }

  // 1-1 / 1-2 首通：静默入池，跳过逐个庆祝和总览卡，直接显示结算让玩家"下一关"
  // 1-3 首通：跳过逐个庆祝，直接集中展示全部灵宠（5 只 + 法宝）
  if (at === 1 && !result._celebrateTriggered && result.victory && result.isFirstClear) {
    if (result.stageId === 'stage_1_1' || result.stageId === 'stage_1_2') {
      result._celebrateTriggered = true
      // 1-1 通关后标记引导已完成，兼容后续检查
      if (result.stageId === 'stage_1_1') {
        g.storage.markGuideShown('newbie_stage_continue')
      }
    } else if (result.stageId === 'stage_1_3') {
      result._celebrateTriggered = true
      const allPetIds = g.storage.petPool.map(p => p.id)
      const weaponIds = (result.rewards || [])
        .filter(r => r.type === 'weapon' && r.weaponId && r.isNew)
        .map(r => r.weaponId)
      g._newbieTeamOverview = { pets: allPetIds, weapons: weaponIds, alpha: 0, timer: 0 }
    }
  }

  // 新手灵宠/法宝庆祝阶段（全屏覆盖，点击后切到队伍总览卡）
  if (g._newbiePetCelebrate) {
    _drawNewbiePetCelebration(g, c, R, W, H, S, safeTop)
    return
  }

  // 新手队伍总览卡（本关新入队灵宠 + 属性珠示意，点击后切正常结算）
  if (g._newbieTeamOverview) {
    _drawNewbieTeamOverview(g, c, R, W, H, S, safeTop)
    return
  }

  // === 全屏背景 ===
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  if (result.victory) {
    _drawVictoryScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn)
  } else {
    _drawDefeatScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn)
  }
}

// ===== 描边文字工具 =====
function _strokeText(c, text, x, y, strokeColor, strokeWidth) {
  c.save()
  c.strokeStyle = strokeColor
  c.lineWidth = strokeWidth
  c.lineJoin = 'round'
  c.strokeText(text, x, y)
  c.restore()
  c.fillText(text, x, y)
}

// drawCelebrationBackdrop 已抽取到 uiComponents.js → drawCelebrationBackdrop

function _drawPedestalCloud(c, R, S, cx, avatarBottomY, width) {
  const cy = avatarBottomY - 4 * S
  const rx = width * 0.5
  const ry = 14 * S
  const grd = c.createRadialGradient(cx, cy - 4 * S, 0, cx, cy, rx * 1.1)
  grd.addColorStop(0, 'rgba(255,250,240,0.82)')
  grd.addColorStop(0.45, 'rgba(255,235,210,0.4)')
  grd.addColorStop(1, 'rgba(255,210,170,0)')
  c.fillStyle = grd
  c.beginPath()
  if (typeof c.ellipse === 'function') {
    c.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
  } else {
    R.rr(cx - rx, cy - ry, rx * 2, ry * 2, ry)
  }
  c.fill()
}

function _drawRarityDiamondBadge(c, S, cx, cy, rv, tag) {
  const r = 11 * S
  c.save()
  c.translate(cx, cy)
  c.rotate(-0.1)
  c.beginPath()
  c.moveTo(0, -r)
  c.lineTo(r * 0.92, 0)
  c.lineTo(0, r)
  c.lineTo(-r * 0.92, 0)
  c.closePath()
  c.shadowColor = rv.glowColor || 'rgba(180,100,255,0.35)'
  c.shadowBlur = 8 * S
  c.fillStyle = rv.badgeBg || 'rgba(80,30,120,0.5)'
  c.fill()
  c.shadowBlur = 0
  c.strokeStyle = rv.borderColor
  c.lineWidth = 1.2 * S
  c.stroke()
  c.fillStyle = rv.badgeColor
  c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(tag, 0, 0.5 * S)
  c.restore()
}

/** 顶部「恭喜获得」并排展示：首通灵宠 + 本次新入库法宝（与 _isFeaturedNewDrop 一致） */
function _heroSpotlightItems(result) {
  if (!result || !result.rewards) return []
  return result.rewards.filter(_isFeaturedNewDrop)
}

function _heroSpotlightRewardKeys(result) {
  const keys = new Set()
  for (const r of _heroSpotlightItems(result)) {
    if (r.type === 'pet' && r.petId) keys.add(`pet:${r.petId}`)
    if (r.type === 'weapon' && r.weaponId) keys.add(`weapon:${r.weaponId}`)
  }
  return keys
}

function _spotlightRarityTag(rarityKey, attrKey) {
  const rv = rarityVisualForAttr(rarityKey, attrKey || 'metal')
  return { rv, tag: rv.label }
}

/** 恭喜获得区：每张卡左上角稀有度菱形中心（统一规则，并排仅靠 gap 留缝） */
function _heroSpotlightRarityBadgeCenter(avatarX, avatarY, S) {
  return { cx: avatarX - 4 * S, cy: avatarY - 2 * S }
}

/** 恭喜获得区：每张卡右上角 New 丝带锚点（与稀有标对称的统一规则） */
function _heroSpotlightNewRibbonAnchor(avatarX, avatarY, avatarSize, S) {
  return { tx: avatarX + avatarSize + 4 * S, ty: avatarY - 2 * S }
}

/** 并排多张时名称锚在各自图标中心，略向左右分开，避免长文案在中间挤在一起 */
function _heroSpotlightLabelCx(tileCx, S, heroCount, heroIndex) {
  if (heroCount <= 1) return tileCx
  if (heroCount === 2) return tileCx + (heroIndex === 0 ? -12 * S : 12 * S)
  if (heroIndex === 0) return tileCx - 8 * S
  if (heroIndex === heroCount - 1) return tileCx + 8 * S
  return tileCx
}

function _isDuplicatePetSpotlightReward(reward) {
  return !!(reward && reward.type === 'fragment' && reward.petId && reward.wasPet)
}

function _isDuplicateWeaponSpotlightReward(reward) {
  return !!(reward && reward.type === 'weapon' && reward.weaponId && !reward.isNew && reward.dupeSoulStone)
}

function _isPetSpotlightReward(reward) {
  return !!(reward && ((reward.type === 'pet' && reward.petId) || _isDuplicatePetSpotlightReward(reward)))
}

function _getStageResultMeta(result) {
  if (!result || !result.stageId) return null
  return getStageById(result.stageId)
}

function _isFinalBossStageResult(result) {
  const stage = _getStageResultMeta(result)
  return !!(stage && stage.chapter === 12 && stage.order === 8)
}

function _victoryHeadline(result) {
  if (_isFinalBossStageResult(result)) return result.isFirstClear ? '终章通关' : '终章凯旋'
  if (result.isFirstClear && (result.stageId === 'stage_1_1' || result.stageId === 'stage_1_2')) {
    return '完美通关！'
  }
  return '关卡通关'
}

function _victorySubHeadline(result) {
  if (!_isFinalBossStageResult(result)) return ''
  return result.isFirstClear ? '终章守关奖励已解锁' : '终章守关已再次击破'
}

function _victoryHeroTitle(result) {
  if (_isFinalBossStageResult(result)) return result.isFirstClear ? '终章赐宝' : '终章战利品'
  return '恭喜获得'
}

function _victoryRewardSectionTitle(result) {
  return _isFinalBossStageResult(result) ? '终章掉落' : '掉落奖励'
}

function _victoryFirstClearTag(result) {
  if (!result || !result.isFirstClear) return ''
  return _isFinalBossStageResult(result) ? '✦ 终章首通' : '✦ 首通奖励'
}

/** 关卡通关后：恭喜获得区高度（多卡并排时略压缩单卡尺寸） */
function _victoryHeroBlockHeight(S, result) {
  const items = _heroSpotlightItems(result)
  const n = items.length
  if (n === 0) return 0
  const avatarSz = n <= 1 ? 86 * S : n === 2 ? 74 * S : 64 * S
  const hasPet = items.some(_isPetSpotlightReward)
  const hasConversionReward = items.some(r => _isDuplicatePetSpotlightReward(r) || _isDuplicateWeaponSpotlightReward(r))
  // 星级叠在头像左下角内侧，不再占头像下方一整行
  const below = hasPet
    ? (16 * S + 12 * S + (hasConversionReward ? 10 * S : 0))
    : (24 * S + 12 * S + (hasConversionReward ? 10 * S : 0))
  const titleBelow = n >= 2 ? 40 * S : 34 * S
  return titleBelow + avatarSz + below
}

function _drawHeroSpotlightRibbon(c, R, S, tx, ty, text, fillStyle) {
  c.save()
  c.translate(tx, ty)
  c.rotate(-0.22)
  c.fillStyle = fillStyle || 'rgba(180,120,20,0.95)'
  R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.fill()
  c.strokeStyle = 'rgba(255,240,200,0.7)'
  c.lineWidth = 1 * S
  R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.stroke()
  c.fillStyle = '#FFF8E0'
  c.font = `bold ${text.length > 2 ? 8 * S : 9 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillText(text, 0, 0)
  c.restore()
}

function _drawVictoryHeroPetTile(g, c, R, S, result, reward, cx, avatarX, avatarY, avatarSize, at, heroCount, heroIndex) {
  const petId = reward.petId
  const pet = getPetById(petId)
  if (!pet) return
  const rarityKey = getPetRarity(petId)
  const { rv, tag } = _spotlightRarityTag(rarityKey, pet.attr)
  const poolPet = g.storage.getPoolPet(petId)
  const starLv = (poolPet && poolPet.star) ? poolPet.star : 1

  const { cx: badgeCx, cy: badgeCy } = _heroSpotlightRarityBadgeCenter(avatarX, avatarY, S)
  _drawRarityDiamondBadge(c, S, badgeCx, badgeCy, rv, tag)

  const { tx: newTx, ty: newTy } = _heroSpotlightNewRibbonAnchor(avatarX, avatarY, avatarSize, S)
  _drawHeroSpotlightRibbon(c, R, S, newTx, newTy, 'New')

  const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
  const avatarPath = getPetAvatarPath({ ...pet, star: starLv })
  R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 14 * S, shadow: ac.main, shadowBlur: 18, strokeStyle: ac.main, strokeWidth: 2.5 })

  const starN = Math.min(Math.max(starLv, 1), 5)
  const starFontPx = Math.min(24 * S, avatarSize * 0.34)
  const starStep = starFontPx * 0.78
  const padL = 8 * S
  const padB = 10 * S
  const starY = avatarY + avatarSize - padB
  const starX0 = avatarX + padL
  c.font = `bold ${starFontPx}px "PingFang SC",sans-serif`
  c.textAlign = 'left'
  c.textBaseline = 'middle'
  for (let si = 0; si < starN; si++) {
    const sx = starX0 + si * starStep
    const sy = starY
    c.strokeStyle = 'rgba(0,0,0,0.55)'
    c.lineWidth = 2.2 * S
    c.strokeText('★', sx, sy)
    c.fillStyle = ac.main
    c.shadowColor = rgbaFromHex(ac.main, 0.5)
    c.shadowBlur = 5 * S
    c.fillText('★', sx, sy)
    c.shadowBlur = 0
  }

  const subY = avatarY + avatarSize + 16 * S
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const nameCx = _heroSpotlightLabelCx(cx, S, heroCount, heroIndex)
  c.font = `bold ${(heroCount <= 1 ? 11 : 10) * S}px "PingFang SC",sans-serif`
  c.fillStyle = '#fff5e0'
  if (heroCount <= 1) {
    _strokeText(c, `获得灵宠「${pet.name}」`, nameCx, subY, 'rgba(0,0,0,0.45)', 2.5 * S)
  } else {
    const shortName = pet.name.length > 6 ? pet.name.slice(0, 6) + '…' : pet.name
    _strokeText(c, `灵宠「${shortName}」`, nameCx, subY, 'rgba(0,0,0,0.45)', 2 * S)
  }
}

function _drawVictoryHeroDuplicatePetTile(g, c, R, S, reward, cx, avatarX, avatarY, avatarSize, at, heroCount, heroIndex) {
  const petId = reward.petId
  const pet = getPetById(petId)
  if (!pet) return

  const rarityKey = getPetRarity(petId)
  const { rv, tag } = _spotlightRarityTag(rarityKey, pet.attr)
  const poolPet = g.storage.getPoolPet(petId)
  const starLv = (poolPet && poolPet.star) ? poolPet.star : 1
  const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
  const avatarPath = getPetAvatarPath({ ...pet, star: starLv })
  const centerX = avatarX + avatarSize / 2
  const centerY = avatarY + avatarSize / 2
  const convert = Math.min(1, Math.max(0, (at - 34) / 20))
  const petAlpha = 1 - convert
  const shardAlpha = Math.min(1, Math.max(0, (convert - 0.2) / 0.8))
  const nameCx = _heroSpotlightLabelCx(cx, S, heroCount, heroIndex)

  const { cx: badgeCx, cy: badgeCy } = _heroSpotlightRarityBadgeCenter(avatarX, avatarY, S)
  _drawRarityDiamondBadge(c, S, badgeCx, badgeCy, rv, tag)

  const { tx: ribbonTx, ty: ribbonTy } = _heroSpotlightNewRibbonAnchor(avatarX, avatarY, avatarSize, S)
  _drawHeroSpotlightRibbon(c, R, S, ribbonTx, ribbonTy, '已有', 'rgba(150,105,40,0.96)')

  if (petAlpha > 0.01) {
    c.save()
    c.globalAlpha *= petAlpha
    c.translate(centerX, centerY)
    const petScale = 1 - convert * 0.12
    c.scale(petScale, petScale)
    R.drawCoverImg(R.getImg(avatarPath), -avatarSize / 2, -avatarSize / 2, avatarSize, avatarSize, {
      radius: 14 * S,
      shadow: ac.main,
      shadowBlur: 18,
      strokeStyle: ac.main,
      strokeWidth: 2.5,
    })

    const starN = Math.min(Math.max(starLv, 1), 5)
    const starFontPx = Math.min(24 * S, avatarSize * 0.34)
    const starStep = starFontPx * 0.78
    const padL = 8 * S
    const padB = 10 * S
    const starY = avatarSize / 2 - padB
    const starX0 = -avatarSize / 2 + padL
    c.font = `bold ${starFontPx}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.textBaseline = 'middle'
    for (let si = 0; si < starN; si++) {
      const sx = starX0 + si * starStep
      c.strokeStyle = 'rgba(0,0,0,0.55)'
      c.lineWidth = 2.2 * S
      c.strokeText('★', sx, starY)
      c.fillStyle = ac.main
      c.shadowColor = rgbaFromHex(ac.main, 0.5)
      c.shadowBlur = 5 * S
      c.fillText('★', sx, starY)
      c.shadowBlur = 0
    }
    c.restore()
  }

  if (convert > 0.02) {
    for (let i = 0; i < 8; i++) {
      const ang = i / 8 * Math.PI * 2 + at * 0.03
      const radius = (12 + (i % 3) * 4) * S * convert
      const px = centerX + Math.cos(ang) * radius
      const py = centerY + Math.sin(ang) * radius
      const pr = (2.8 + (i % 2) * 0.9) * S * (0.65 + 0.35 * convert)
      c.save()
      c.globalAlpha *= convert * 0.9
      c.translate(px, py)
      c.rotate(ang)
      c.fillStyle = i % 2 === 0 ? '#FFE7A8' : ac.lt || '#FFD57A'
      c.beginPath()
      c.moveTo(0, -pr)
      c.lineTo(pr * 0.85, 0)
      c.lineTo(0, pr)
      c.lineTo(-pr * 0.85, 0)
      c.closePath()
      c.fill()
      c.restore()
    }
  }

  if (shardAlpha > 0.01) {
    c.save()
    c.globalAlpha *= shardAlpha
    c.translate(centerX, centerY)
    const shardScale = 0.6 + 0.4 * shardAlpha + 0.05 * Math.sin(at * 0.09)
    c.scale(shardScale, shardScale)
    c.fillStyle = 'rgba(255,245,210,0.28)'
    c.beginPath()
    c.arc(0, 0, avatarSize * 0.24, 0, Math.PI * 2)
    c.fill()
    c.rotate(0.22)
    c.fillStyle = '#F4C86B'
    c.strokeStyle = 'rgba(255,248,225,0.85)'
    c.lineWidth = 1.4 * S
    c.beginPath()
    c.moveTo(0, -11 * S)
    c.lineTo(9 * S, -2 * S)
    c.lineTo(4 * S, 10 * S)
    c.lineTo(-5 * S, 8 * S)
    c.lineTo(-10 * S, -1 * S)
    c.closePath()
    c.fill()
    c.stroke()
    c.restore()
  }

  const nameY = avatarY + avatarSize + 16 * S
  const statusY = nameY + 12 * S
  const shortName = pet.name.length > 6 ? pet.name.slice(0, 6) + '…' : pet.name
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#fff5e0'
  c.font = `bold ${(heroCount <= 1 ? 11 : 10) * S}px "PingFang SC",sans-serif`
  _strokeText(c, heroCount <= 1 ? `获得灵宠「${pet.name}」` : `灵宠「${shortName}」`, nameCx, nameY, 'rgba(0,0,0,0.45)', heroCount <= 1 ? 2.5 * S : 2 * S)

  const preAlpha = 1 - Math.min(1, Math.max(0, (convert - 0.05) / 0.5))
  const postAlpha = Math.min(1, Math.max(0, (convert - 0.15) / 0.85))
  if (preAlpha > 0.01) {
    c.save()
    c.globalAlpha *= preAlpha
    c.fillStyle = '#FFEAB8'
    c.font = `${8.5 * S}px "PingFang SC",sans-serif`
    _strokeText(c, '重复灵宠转化中...', nameCx, statusY, 'rgba(0,0,0,0.35)', 1.6 * S)
    c.restore()
  }
  if (postAlpha > 0.01) {
    c.save()
    c.globalAlpha *= postAlpha
    c.fillStyle = '#FFEAB8'
    c.font = `${8.5 * S}px "PingFang SC",sans-serif`
    _strokeText(c, `已拥有，转为碎片×${reward.count || 0}`, nameCx, statusY, 'rgba(0,0,0,0.35)', 1.6 * S)
    c.restore()
  }
}

function _drawVictoryHeroWeaponTile(g, c, R, S, reward, cx, avatarX, avatarY, avatarSize, nameY, heroCount, heroIndex) {
  const wid = reward.weaponId
  const w = getWeaponById(wid)
  if (!w) return
  const rarityKey = getWeaponRarity(wid) || 'R'
  const { rv, tag } = _spotlightRarityTag(rarityKey, w.attr || 'metal')

  const { cx: badgeCxW, cy: badgeCyW } = _heroSpotlightRarityBadgeCenter(avatarX, avatarY, S)
  _drawRarityDiamondBadge(c, S, badgeCxW, badgeCyW, rv, tag)

  if (reward.isNew) {
    const { tx: newTxW, ty: newTyW } = _heroSpotlightNewRibbonAnchor(avatarX, avatarY, avatarSize, S)
    _drawHeroSpotlightRibbon(c, R, S, newTxW, newTyW, 'New')
  }

  const wAc = w.attr ? (ATTR_COLOR[w.attr] || ATTR_COLOR.metal) : null
  const strokeAttr = wAc ? wAc.main : rv.borderColor

  const iconPath = `assets/equipment/fabao_${wid}.png`
  R.drawCoverImg(R.getImg(iconPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 14 * S, shadow: strokeAttr, shadowBlur: 16, strokeStyle: strokeAttr, strokeWidth: 2.5 })

  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const nameCx = _heroSpotlightLabelCx(cx, S, heroCount, heroIndex)
  c.font = `bold ${(heroCount <= 1 ? 11 : 10) * S}px "PingFang SC",sans-serif`
  c.fillStyle = '#fff5e0'
  if (heroCount <= 1) {
    _strokeText(c, `获得法宝「${w.name}」`, nameCx, nameY, 'rgba(0,0,0,0.45)', 2.5 * S)
  } else {
    const shortName = w.name.length > 6 ? w.name.slice(0, 6) + '…' : w.name
    _strokeText(c, `法宝「${shortName}」`, nameCx, nameY, 'rgba(0,0,0,0.45)', 2 * S)
  }
}

function _drawVictoryHeroDuplicateWeaponTile(g, c, R, S, reward, cx, avatarX, avatarY, avatarSize, at, heroCount, heroIndex) {
  const wid = reward.weaponId
  const w = getWeaponById(wid)
  if (!w) return

  const rarityKey = getWeaponRarity(wid) || 'R'
  const { rv, tag } = _spotlightRarityTag(rarityKey, w.attr || 'metal')
  const wAc = w.attr ? (ATTR_COLOR[w.attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
  const centerX = avatarX + avatarSize / 2
  const centerY = avatarY + avatarSize / 2
  const convert = Math.min(1, Math.max(0, (at - 34) / 18))
  const weaponAlpha = 1 - convert * 0.92
  const soulAlpha = Math.min(1, Math.max(0, (convert - 0.12) / 0.88))
  const nameCx = _heroSpotlightLabelCx(cx, S, heroCount, heroIndex)

  const { cx: badgeCxW, cy: badgeCyW } = _heroSpotlightRarityBadgeCenter(avatarX, avatarY, S)
  _drawRarityDiamondBadge(c, S, badgeCxW, badgeCyW, rv, tag)

  const { tx: ribbonTx, ty: ribbonTy } = _heroSpotlightNewRibbonAnchor(avatarX, avatarY, avatarSize, S)
  _drawHeroSpotlightRibbon(c, R, S, ribbonTx, ribbonTy, '已有', 'rgba(150,105,40,0.96)')

  const iconPath = `assets/equipment/fabao_${wid}.png`
  if (weaponAlpha > 0.01) {
    c.save()
    c.globalAlpha *= weaponAlpha
    c.translate(centerX, centerY)
    const weaponScale = 1 - convert * 0.1
    c.scale(weaponScale, weaponScale)
    R.drawCoverImg(R.getImg(iconPath), -avatarSize / 2, -avatarSize / 2, avatarSize, avatarSize, {
      radius: 14 * S,
      shadow: wAc.main,
      shadowBlur: 16,
      strokeStyle: wAc.main,
      strokeWidth: 2.5,
    })
    c.restore()
  }

  if (convert > 0.03) {
    for (let i = 0; i < 7; i++) {
      const ang = i / 7 * Math.PI * 2 + at * 0.025
      const radius = (10 + (i % 3) * 4) * S * convert
      const px = centerX + Math.cos(ang) * radius
      const py = centerY + Math.sin(ang) * radius
      c.save()
      c.globalAlpha *= convert * 0.8
      c.fillStyle = i % 2 === 0 ? '#FFE8A8' : (wAc.lt || '#FFD36B')
      c.beginPath()
      c.arc(px, py, (2.4 + (i % 2) * 0.8) * S, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
  }

  if (soulAlpha > 0.01) {
    const soulIcon = R.getImg('assets/ui/icon_soul_stone.png')
    c.save()
    c.globalAlpha *= soulAlpha
    c.translate(centerX, centerY)
    const soulScale = 0.7 + 0.3 * soulAlpha + 0.04 * Math.sin(at * 0.09)
    c.scale(soulScale, soulScale)
    c.fillStyle = 'rgba(255,236,170,0.26)'
    c.beginPath()
    c.arc(0, 0, avatarSize * 0.22, 0, Math.PI * 2)
    c.fill()
    if (soulIcon && soulIcon.width > 0) {
      c.drawImage(soulIcon, -16 * S, -16 * S, 32 * S, 32 * S)
    } else {
      c.fillStyle = '#69B9FF'
      c.beginPath()
      c.arc(0, 0, 10 * S, 0, Math.PI * 2)
      c.fill()
    }
    c.restore()
  }

  const nameY = avatarY + avatarSize + 20 * S
  const statusY = nameY + 12 * S
  const shortName = w.name.length > 6 ? w.name.slice(0, 6) + '…' : w.name
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.fillStyle = '#fff5e0'
  c.font = `bold ${(heroCount <= 1 ? 11 : 10) * S}px "PingFang SC",sans-serif`
  _strokeText(c, heroCount <= 1 ? `获得法宝「${w.name}」` : `法宝「${shortName}」`, nameCx, nameY, 'rgba(0,0,0,0.45)', heroCount <= 1 ? 2.5 * S : 2 * S)

  const preAlpha = 1 - Math.min(1, Math.max(0, (convert - 0.03) / 0.45))
  const postAlpha = Math.min(1, Math.max(0, (convert - 0.1) / 0.9))
  if (preAlpha > 0.01) {
    c.save()
    c.globalAlpha *= preAlpha
    c.fillStyle = '#FFEAB8'
    c.font = `${8.5 * S}px "PingFang SC",sans-serif`
    _strokeText(c, '已有法宝熔炼中...', nameCx, statusY, 'rgba(0,0,0,0.35)', 1.6 * S)
    c.restore()
  }
  if (postAlpha > 0.01) {
    c.save()
    c.globalAlpha *= postAlpha
    c.fillStyle = '#FFEAB8'
    c.font = `${8.5 * S}px "PingFang SC",sans-serif`
    _strokeText(c, `已拥有，熔炼为灵石+${reward.dupeSoulStone || 0}`, nameCx, statusY, 'rgba(0,0,0,0.35)', 1.6 * S)
    c.restore()
  }
}

function _drawVictoryHeroSpotlight(g, c, R, W, S, result, blockTop, at, fadeIn) {
  const items = _heroSpotlightItems(result)
  if (!items.length) return
  const enter = Math.min(1, Math.max(0, (at - 6) / 16))
  const bounce = enter < 1 ? (0.88 + 0.12 * Math.sin(enter * Math.PI)) : (1 + 0.02 * Math.sin(at * 0.07))

  c.save()
  c.globalAlpha = fadeIn * enter

  const n = items.length
  // 双卡时留足缝：左卡 New 丝向外伸、右卡稀有菱形居左上角外侧，统一锚点下需 gap ≳ 0.5×卡宽（74S 卡用 ~42S）
  const gap = n <= 1 ? 12 * S : n === 2 ? 42 * S : 22 * S
  const avatarSize = (n <= 1 ? 86 * S : n === 2 ? 74 * S : 64 * S) * bounce
  const rowW = n * avatarSize + (n - 1) * gap
  const startX = (W - rowW) / 2

  let y = blockTop
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFF5E0'
  c.font = `bold ${17 * S}px "PingFang SC",sans-serif`
  _strokeText(c, '恭喜获得', W / 2, y + 12 * S, 'rgba(55,35,18,0.55)', 3 * S)
  y += (n >= 2 ? 40 : 34) * S

  const avatarY = y
  const hasPet = items.some(_isPetSpotlightReward)
  const nameY = hasPet ? avatarY + avatarSize + 16 * S : avatarY + avatarSize + 20 * S

  _drawPedestalCloud(c, R, S, W / 2, avatarY + avatarSize, Math.max(rowW * 0.5, avatarSize * 1.15))

  for (let i = 0; i < n; i++) {
    const reward = items[i]
    const tileCx = startX + i * (avatarSize + gap) + avatarSize / 2
    const avatarX = tileCx - avatarSize / 2
    const delay = i * 5
    const tileIn = Math.min(1, Math.max(0, (at - 8 - delay) / 12))
    c.save()
    c.globalAlpha *= tileIn
    const rowSlide = (1 - tileIn) * 16 * S
    c.translate(rowSlide, 0)
    if (reward.type === 'pet' && reward.petId) {
      _drawVictoryHeroPetTile(g, c, R, S, result, reward, tileCx, avatarX, avatarY, avatarSize, at, n, i)
    } else if (_isDuplicatePetSpotlightReward(reward)) {
      _drawVictoryHeroDuplicatePetTile(g, c, R, S, reward, tileCx, avatarX, avatarY, avatarSize, at, n, i)
    } else if (_isDuplicateWeaponSpotlightReward(reward)) {
      _drawVictoryHeroDuplicateWeaponTile(g, c, R, S, reward, tileCx, avatarX, avatarY, avatarSize, at, n, i)
    } else if (reward.type === 'weapon' && reward.weaponId) {
      _drawVictoryHeroWeaponTile(g, c, R, S, reward, tileCx, avatarX, avatarY, avatarSize, nameY, n, i)
    }
    c.restore()
  }

  c.restore()
}

// ===== 胜利全屏 =====
function _drawVictoryScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn) {
  const spotlightCenterY = safeTop + 115 * S
  drawCelebrationBackdrop(c, W, H, S, spotlightCenterY, at, fadeIn)

  c.fillStyle = 'rgba(255,240,200,0.06)'
  c.fillRect(0, 0, W, H)

  c.save()
  c.globalAlpha = fadeIn

  // === 标题 ===
  const headline = _victoryHeadline(result)
  const subHeadline = _victorySubHeadline(result)
  const headerExtra = subHeadline ? 16 * S : 0
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.save()
  c.shadowColor = 'rgba(120,80,0,0.7)'; c.shadowBlur = 10 * S
  c.fillStyle = '#FFD700'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _strokeText(c, headline, W * 0.5, safeTop + 46 * S, 'rgba(100,60,0,0.6)', 4 * S)
  c.restore()

  const divW = W * 0.22
  c.strokeStyle = 'rgba(180,140,40,0.5)'; c.lineWidth = 1.5 * S
  c.beginPath()
  c.moveTo(W * 0.5 - divW, safeTop + 62 * S)
  c.lineTo(W * 0.5 + divW, safeTop + 62 * S)
  c.stroke()

  c.fillStyle = '#5A4020'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  _strokeText(c, result.stageName || '', W * 0.5, safeTop + 80 * S, 'rgba(255,240,200,0.6)', 3 * S)
  if (subHeadline) {
    c.save()
    c.fillStyle = '#B8860B'
    c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    _strokeText(c, subHeadline, W * 0.5, safeTop + 96 * S, 'rgba(255,245,220,0.55)', 2.5 * S)
    c.restore()
  }

  // === 评价星级（大尺寸，动画入场） ===
  const starY = safeTop + 108 * S + headerExtra
  const starSize = 30 * S
  const starGap = 6 * S
  const starCount = result.starCount || (result.rating === 'S' ? 3 : result.rating === 'A' ? 2 : 1)
  const newStars = result.newStars || []
  const totalStarsW = 3 * starSize + 2 * starGap
  const starStartX = (W - totalStarsW) / 2

  for (let i = 0; i < 3; i++) {
    const sx = starStartX + i * (starSize + starGap) + starSize / 2
    const delay = i * 8
    const starProgress = Math.min(1, Math.max(0, (at - 10 - delay) / 12))
    if (starProgress <= 0) continue

    const isNew = newStars.includes(i + 1)
    const bounce = i < starCount ? (1 + 0.15 * Math.sin((at - delay) * 0.08)) : 1
    const scale = (0.3 + 0.7 * starProgress) * bounce

    c.save()
    c.translate(sx, starY)
    c.scale(scale, scale)
    c.globalAlpha = starProgress
    c.font = `${starSize}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    if (i < starCount) {
      c.shadowColor = 'rgba(255,200,0,0.8)'; c.shadowBlur = 14 * S
      c.fillStyle = '#FFD700'
      _strokeText(c, '★', 0, 0, 'rgba(160,100,0,0.5)', 2 * S)
    } else {
      c.fillStyle = 'rgba(160,140,100,0.35)'
      c.fillText('★', 0, 0)
    }
    c.restore()

    if (isNew && starProgress > 0.8) {
      c.save()
      const newAlpha = Math.min(1, (starProgress - 0.8) / 0.2)
      c.globalAlpha = newAlpha * (0.8 + 0.2 * Math.sin(at * 0.1))
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#FF4444'
      c.shadowColor = 'rgba(255,0,0,0.6)'; c.shadowBlur = 4 * S
      c.fillText('NEW', sx, starY - starSize * 0.55)
      c.restore()
    }
  }

  // 评价等级
  const ratingColor = result.rating === 'S' ? '#FFD700' : result.rating === 'A' ? '#C0C0C0' : '#A87040'
  c.fillStyle = ratingColor; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  _strokeText(c, `评价  ${result.rating}`, W * 0.5, starY + starSize / 2 + 20 * S, 'rgba(0,0,0,0.3)', 3 * S)

  c.fillStyle = 'rgba(90,70,40,0.7)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  _strokeText(c, `总回合数：${result.totalTurns}`, W * 0.5, starY + starSize / 2 + 38 * S, 'rgba(255,255,255,0.4)', 2 * S)

  // 操作评分：最高 Combo + 挑战完成
  let skillLineY = starY + starSize / 2 + 52 * S
  if (result.maxCombo >= 2) {
    const { getComboMul } = require('../engine/battle/damageFormula')
    const mul = getComboMul(result.maxCombo)
    c.fillStyle = '#ffcc80'; c.font = `${10*S}px "PingFang SC",sans-serif`
    _strokeText(c, `最高连击：${result.maxCombo}（伤害 x${mul.toFixed(1)}）`, W * 0.5, skillLineY, 'rgba(255,255,255,0.3)', 2 * S)
    skillLineY += 15 * S
  }
  if (result.challengeDesc) {
    // 使用 uiColors 的成功绿 / 警告金棕，避免原 #a5d6a7 在亮底上对比不足的问题
    const cColor = result.challengeDone ? C.success : C.warn
    const cIcon = result.challengeDone ? '✓' : '✗'
    const cExtra = result.challengeRewardSS > 0 ? `  灵石+${result.challengeRewardSS}` : ''
    c.fillStyle = cColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    _strokeText(c, `${cIcon} 挑战：${result.challengeDesc}${result.challengeDone ? cExtra : '  未完成'}`, W * 0.5, skillLineY, 'rgba(0,0,0,0.18)', 2.2 * S)
    skillLineY += 16 * S
  }

  // 星级结算加成已反映在下方灵石/碎片等总额中，此处只作提示，不再单独列数字，避免与面板重复
  const hasStarSettleBonus =
    (result.starBonusSoulStone > 0 || result.starBonusAwakenStone > 0 || result.starBonusFragments > 0)
  const starBandExtra = hasStarSettleBonus ? 16 * S : 0
  if (hasStarSettleBonus) {
    const hintY = starY + starSize / 2 + 52 * S
    const hintIn = Math.min(1, Math.max(0, (at - 26) / 14))
    c.save()
    c.globalAlpha *= hintIn
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `${9 * S}px "PingFang SC",sans-serif`
    c.fillStyle = 'rgba(140,100,50,0.92)'
    const mxNew = result.newStars && result.newStars.length ? Math.max(...result.newStars) : starCount
    const starTag = mxNew > 0 ? `${'★'.repeat(Math.min(mxNew, 3))} ` : ''
    c.fillText(`${starTag}本关星级奖励已计入下方总收益`, W * 0.5, hintY)
    c.restore()
  }

  // === 核心奖励高光（灵宠/法宝） + 奖励明细面板 ===
  let panelTop = starY + starSize / 2 + 56 * S + starBandExtra
  if (_heroSpotlightItems(result).length > 0) {
    _drawVictoryHeroSpotlight(g, c, R, W, S, result, panelTop, at, fadeIn)
    panelTop += _victoryHeroBlockHeight(S, result)
  }
  _drawVictoryRewardPanel(g, c, R, W, H, S, result, panelTop, at)

  c.restore()
}

// ===== 失败全屏 =====
function _drawDefeatScreen(g, c, R, W, H, S, safeTop, result, at, fadeIn) {
  c.fillStyle = 'rgba(0,0,0,0.35)'
  c.fillRect(0, 0, W, H)

  c.save()
  c.globalAlpha = fadeIn
  const glow = c.createRadialGradient(W * 0.5, safeTop + 60 * S, 0, W * 0.5, safeTop + 60 * S, W * 0.4)
  glow.addColorStop(0, 'rgba(180,40,50,0.18)')
  glow.addColorStop(1, 'rgba(180,40,50,0)')
  c.fillStyle = glow; c.fillRect(0, 0, W, H)
  c.restore()

  c.save()
  c.globalAlpha = fadeIn

  // 标题
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#E06060'; c.font = `bold ${24*S}px "PingFang SC",sans-serif`
  _strokeText(c, '挑战失败', W * 0.5, safeTop + 46 * S, 'rgba(60,0,0,0.5)', 4 * S)

  // 装饰线
  const divW = W * 0.18
  c.strokeStyle = 'rgba(180,60,70,0.35)'; c.lineWidth = 1 * S
  c.beginPath()
  c.moveTo(W * 0.5 - divW, safeTop + 62 * S)
  c.lineTo(W * 0.5 + divW, safeTop + 62 * S)
  c.stroke()

  // 关卡名 + 回合
  c.fillStyle = 'rgba(80,50,40,0.8)'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
  _strokeText(c, result.stageName || '', W * 0.5, safeTop + 78 * S, 'rgba(255,220,200,0.5)', 3 * S)
  c.fillStyle = 'rgba(120,80,60,0.6)'; c.font = `${10*S}px "PingFang SC",sans-serif`
  _strokeText(c, `总回合数：${result.totalTurns}`, W * 0.5, safeTop + 94 * S, 'rgba(255,255,255,0.3)', 2 * S)

  // === 败因分析面板 ===
  const panelTop = safeTop + 112 * S
  _drawDefeatAnalysisPanel(g, c, R, W, H, S, result, panelTop, at)

  c.restore()
}

// ===== 败因分析面板 =====
function _drawDefeatAnalysisPanel(g, c, R, W, H, S, result, panelTop, at) {
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 14 * S
  const innerW = pw - pad * 2

  const tipsData = _generateDefeatTips(g, result)
  const tips = tipsData.items || []

  // 预算面板高度
  let contentH = pad * 0.6
  const hasEnemy = result.enemyMaxHp > 0
  if (hasEnemy) contentH += 62 * S
  if (result.waveTotal > 1) contentH += 22 * S
  contentH += 6 * S // 分隔线间距

  // 战力对比条
  if (tipsData.powerPct < 100) contentH += 40 * S

  // 变强建议区
  if (tips.length > 0) contentH += 24 * S + tips.length * 34 * S + 6 * S

  // 获得的经验/灵石（失败仍有保底）
  if (result.soulStone > 0) contentH += 28 * S
  if (result.cultExp > 0) {
    contentH += 28 * S
    if (result.cultLevelUps > 0) contentH += 16 * S
    if (result.cultRealmUp && result.cultRealmUp.kind === 'minor') contentH += 18 * S
    contentH += 24 * S
  }

  // 看广告退还体力
  const canRefund = !result.staminaRefunded && result.staminaCost > 0 && AdManager.canShow('staminaRefund')
  if (canRefund || result.staminaRefunded) contentH += 44 * S

  contentH += pad + 48 * S
  // 主动分享小图标挂在底部按钮右下外侧，预留一行空间
  contentH += 40 * S
  const ph = contentH

  R.drawInfoPanel(px, panelTop, pw, ph)

  let cy = panelTop + pad * 0.6

  // ── 区块1：战斗分析 ──
  if (hasEnemy) {
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8B5040'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('战斗分析', px + pad, cy + 6 * S)
    cy += 20 * S

    // 敌人头像 + 名称 + 血量条
    const avatarSz = 34 * S
    const avatarX = px + pad
    const avatarY = cy
    const enemyAvatarPath = result.enemyAvatar
      ? `assets/${result.enemyAvatar}.png`
      : ''
    const enemyImg = enemyAvatarPath ? R.getImg(enemyAvatarPath) : null
    if (enemyImg && enemyImg.width > 0) {
      c.save()
      c.beginPath(); c.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2, 0, Math.PI * 2); c.clip()
      const aw = enemyImg.width, ah = enemyImg.height
      const sc = Math.max(avatarSz / aw, avatarSz / ah)
      const dw = aw * sc, dh = ah * sc
      c.drawImage(enemyImg, avatarX + (avatarSz - dw) / 2, avatarY + (avatarSz - dh) / 2, dw, dh)
      c.restore()
      c.strokeStyle = 'rgba(160,60,60,0.5)'; c.lineWidth = 1.5 * S
      c.beginPath(); c.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2, 0, Math.PI * 2); c.stroke()
    } else {
      c.save()
      c.fillStyle = 'rgba(160,60,60,0.15)'
      c.beginPath(); c.arc(avatarX + avatarSz / 2, avatarY + avatarSz / 2, avatarSz / 2, 0, Math.PI * 2); c.fill()
      c.fillStyle = '#A05050'; c.font = `bold ${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText(result.enemyName ? result.enemyName[0] : '?', avatarX + avatarSz / 2, avatarY + avatarSz / 2)
      c.textAlign = 'left'
      c.restore()
    }

    // 名称 + 属性
    const infoX = avatarX + avatarSz + 8 * S
    const ac = ATTR_COLOR[result.enemyAttr] || ATTR_COLOR.metal
    c.fillStyle = '#5A3830'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillText(result.enemyName || '未知', infoX, avatarY + 10 * S)
    const attrLabel = ATTR_NAME[result.enemyAttr] || ''
    if (attrLabel) {
      c.fillStyle = ac.main; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(`${attrLabel}属性`, infoX + c.measureText(result.enemyName || '').width + 6 * S, avatarY + 10 * S)
    }

    // 血量条
    const barX = infoX
    const barY = avatarY + 22 * S
    const barW = innerW - avatarSz - 8 * S
    const barH = 8 * S
    const hpPct = Math.max(0, Math.min(1, result.enemyHp / result.enemyMaxHp))
    const animPct = Math.min(1, at / 30) * hpPct

    c.fillStyle = 'rgba(0,0,0,0.08)'
    R.rr(barX, barY, barW, barH, barH / 2); c.fill()
    if (animPct > 0) {
      const fillW = Math.max(barH, barW * animPct)
      const barGrad = c.createLinearGradient(barX, barY, barX + fillW, barY)
      barGrad.addColorStop(0, '#cc3030'); barGrad.addColorStop(1, '#e85050')
      c.fillStyle = barGrad
      R.rr(barX, barY, fillW, barH, barH / 2); c.fill()
    }
    c.fillStyle = '#8B5040'; c.font = `${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'
    c.fillText(`${Math.ceil(hpPct * 100)}%`, barX + barW, barY + barH + 10 * S)
    c.textAlign = 'left'

    // 动态文案
    let hpMsg = ''
    let hpMsgColor = '#8B5040'
    if (hpPct < 0.3) { hpMsg = '差一点就赢了！再来一次！'; hpMsgColor = '#D4A030' }
    else if (hpPct > 0.7) { hpMsg = '敌强我弱，先提升再挑战'; hpMsgColor = '#A04040' }
    else { hpMsg = '稍加提升即可通关'; hpMsgColor = '#8B6540' }
    c.fillStyle = hpMsgColor; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(hpMsg, barX, barY + barH + 10 * S)

    cy = avatarY + avatarSz + 8 * S
  }

  // 波次进度
  if (result.waveTotal > 1) {
    const waveBarX = px + pad
    const waveBarW = innerW
    c.fillStyle = '#8B5040'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillText(`波次进度：第 ${(result.waveIdx || 0) + 1} / ${result.waveTotal} 波`, waveBarX, cy + 10 * S)
    cy += 22 * S
  }

  // 分隔线
  cy += 2 * S
  c.strokeStyle = 'rgba(180,120,100,0.2)'; c.lineWidth = 1 * S
  c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
  cy += 6 * S

  // ── 战力对比条 ──
  if (tipsData.powerPct < 100) {
    const barX = px + pad, barW = innerW, barH = 10 * S
    const pct = Math.min(1, Math.max(0, tipsData.powerPct / 100))
    const animPct = Math.min(1, at / 30) * pct
    const barColor = pct < 0.5 ? '#cc3030' : pct < 0.8 ? '#D4A030' : '#40A060'

    c.textAlign = 'left'; c.fillStyle = '#8B5040'; c.font = `${9*S}px "PingFang SC",sans-serif`
    c.fillText(`我方 ${tipsData.teamAtk}`, barX, cy + 4 * S)
    c.textAlign = 'right'; c.fillStyle = '#606050'
    c.fillText(`建议 ${tipsData.suggestedAtk}+`, barX + barW, cy + 4 * S)
    cy += 14 * S

    c.fillStyle = 'rgba(0,0,0,0.06)'
    R.rr(barX, cy, barW, barH, barH / 2); c.fill()
    if (animPct > 0) {
      const fillW = Math.max(barH, barW * animPct)
      const barGrad = c.createLinearGradient(barX, cy, barX + fillW, cy)
      barGrad.addColorStop(0, barColor); barGrad.addColorStop(1, barColor + '80')
      c.fillStyle = barGrad
      R.rr(barX, cy, fillW, barH, barH / 2); c.fill()
    }
    cy += barH + 8 * S
    c.textAlign = 'center'; c.fillStyle = barColor; c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.fillText(`战力达标 ${tipsData.powerPct}%`, barX + barW / 2, cy)
    cy += 12 * S
  }

  // ── 区块2：变强建议（小灵点评） ──
  if (tips.length > 0) {
    const lingHdr = drawLingHeader(c, S, px + pad, cy, {
      avatarImg: R.getImg(LING.avatar),
      title: '小灵支招 · 如何变强',
      subtitle: '主人别灰心，下面这些照着练就行啦～',
    })
    cy += lingHdr.height + 8 * S

    _rects.tipRects = []
    for (let i = 0; i < tips.length; i++) {
      const tip = tips[i]
      const tipDelay = 20 + i * 10
      const tipAlpha = Math.min(1, Math.max(0, (at - tipDelay) / 15))
      if (tipAlpha <= 0) { cy += 34 * S; continue }

      c.save()
      c.globalAlpha *= tipAlpha

      const tipH = 28 * S
      const tipBg = c.createLinearGradient(px + pad, cy, px + pw - pad, cy)
      tipBg.addColorStop(0, tip.bgColor || 'rgba(200,180,140,0.1)')
      tipBg.addColorStop(1, 'rgba(200,180,140,0.02)')
      c.fillStyle = tipBg
      R.rr(px + pad, cy, innerW, tipH, 6 * S); c.fill()
      c.strokeStyle = tip.borderColor || 'rgba(180,160,120,0.2)'; c.lineWidth = 0.8 * S
      R.rr(px + pad, cy, innerW, tipH, 6 * S); c.stroke()

      // 图标
      const iconSz = 18 * S
      const iconX = px + pad + 6 * S
      const iconCY = cy + tipH / 2
      c.fillStyle = tip.iconColor || '#B8860B'
      c.font = `${14*S}px "PingFang SC",sans-serif`
      c.textAlign = 'center'
      c.fillText(tip.icon, iconX + iconSz / 2, iconCY)

      // 文字
      c.textAlign = 'left'
      c.fillStyle = '#5A4830'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText(tip.title, iconX + iconSz + 4 * S, iconCY - 4 * S)
      c.fillStyle = '#8B7355'; c.font = `${9*S}px "PingFang SC",sans-serif`
      c.fillText(tip.desc, iconX + iconSz + 4 * S, iconCY + 8 * S)

      // 跳转箭头
      if (tip.action) {
        c.fillStyle = '#B8A080'; c.font = `bold ${13*S}px "PingFang SC",sans-serif`
        c.textAlign = 'right'
        c.fillText('›', px + pw - pad - 6 * S, iconCY)
        _rects.tipRects.push({ rect: [px + pad, cy, innerW, tipH], action: tip.action, stageId: result.stageId })
      }

      c.restore()
      cy += 34 * S
    }

    cy += 2 * S
    c.strokeStyle = 'rgba(180,120,100,0.2)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 6 * S
  }

  // ── 保底奖励（灵石/经验）──
  if (result.soulStone > 0) {
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '灵石', `+${result.soulStone}`, C.soulLabel, C.soulValue)
    cy += 28 * S
  }
  if (result.cultExp > 0) {
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${result.cultExp}`, C.cultExpLabel, C.cultExpValue)
    cy += 22 * S
    if (result.cultLevelUps > 0) {
      const cult = g.storage.cultivation
      _drawCultLvUpRow(c, R, S, W / 2, cy, result.cultPrevLevel, cult.level, result.cultLevelUps)
      cy += 16 * S
    }
    // 小阶跨档金光行（A1：感气·二重 → 感气·三重 等）
    if (result.cultRealmUp && result.cultRealmUp.kind === 'minor') {
      _drawCultSubRealmUpRow(c, R, S, W / 2, cy, result.cultRealmUp.curr.fullName)
      cy += 18 * S
    }
    const cult = g.storage.cultivation
    const barX = px + pad, barW = innerW, barH = 7 * S
    c.fillStyle = 'rgba(0,0,0,0.06)'
    R.rr(barX, cy, barW, barH, barH / 2); c.fill()
    if (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      const pct = Math.min(cult.exp / needed, 1)
      if (pct > 0) {
        const fillW = Math.max(barH, barW * pct)
        const barGrad = c.createLinearGradient(barX, cy, barX + fillW, cy)
        barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
        c.fillStyle = barGrad
        R.rr(barX, cy, fillW, barH, barH / 2); c.fill()
      }
      c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level}  ${cult.exp}/${needed}  ${getRealmByLv(cult.level).fullName}`, px + pw - pad, cy + barH + 9 * S)
    }
    cy += barH + 18 * S
  }

  // ── 看广告退还体力 ──
  if (canRefund) {
    const rfBtnW = innerW * 0.7, rfBtnH = 36 * S
    const rfBtnX = (W - rfBtnW) / 2, rfBtnY = cy
    R.drawDialogBtn(rfBtnX, rfBtnY, rfBtnW, rfBtnH, `▶ 看广告 退还${result.staminaCost}体力`, 'adReward')
    _rects.staminaRefundBtnRect = [rfBtnX, rfBtnY, rfBtnW, rfBtnH]
    cy += 44 * S
  } else if (result.staminaRefunded) {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#60A060'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText('✓ 体力已退还', W / 2, cy + 10 * S)
    _rects.staminaRefundBtnRect = null
    cy += 28 * S
  } else {
    _rects.staminaRefundBtnRect = null
  }

  // ── 底部按钮 ──
  const btnH = 38 * S
  const btnGap = 12 * S
  const btnW = (innerW - btnGap) / 2
  const btnY = cy + 4 * S

  R.drawDialogBtn(px + pad, btnY, btnW, btnH, '返回', 'cancel')
  _rects.backBtnRect = [px + pad, btnY, btnW, btnH]

  R.drawDialogBtn(px + pad + btnW + btnGap, btnY, btnW, btnH, '再次挑战', 'confirm')
  _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY, btnW, btnH]

  // 主动分享小图标（失败页也有入口——"来帮我一起玩"也是自然分享场景）
  _drawShareIconBtnOnResult(g, px + pad + innerW, btnY, btnH, result, 0, false)
}

// ===== 失败建议生成（数据驱动，由 strategyAdvisor 提供） =====
function _generateDefeatTips(g, result) {
  const analysis = analyzeDefeat(g.storage, result)
  const COLOR_MAP = {
    '📊': { bg: 'rgba(200,80,60,0.10)',  border: 'rgba(200,100,80,0.25)' },
    '⚔':  { bg: 'rgba(180,140,60,0.12)', border: 'rgba(180,160,80,0.3)' },
    '★':  { bg: 'rgba(200,180,40,0.10)', border: 'rgba(200,180,60,0.3)' },
    '⬆':  { bg: 'rgba(60,120,200,0.08)', border: 'rgba(60,120,200,0.2)' },
    '🧘': { bg: 'rgba(140,80,200,0.08)', border: 'rgba(140,80,200,0.2)' },
    '🎨': { bg: 'rgba(60,100,160,0.08)', border: 'rgba(60,100,160,0.2)' },
  }
  return {
    powerPct: analysis.powerPct,
    teamAtk: analysis.teamTotalAtk,
    suggestedAtk: analysis.suggestedAtk,
    items: analysis.tips.map(t => ({
      ...t,
      bgColor: (COLOR_MAP[t.icon] || {}).bg || 'rgba(200,180,140,0.1)',
      borderColor: (COLOR_MAP[t.icon] || {}).border || 'rgba(180,160,120,0.2)',
    })),
  }
}

/** 首通灵宠 + isNew 法宝等并排展示 */
function _isFeaturedNewDrop(r) {
  if (!r) return false
  if (r.type === 'pet' && r.petId) return true
  if (_isDuplicatePetSpotlightReward(r)) return true
  if (_isDuplicateWeaponSpotlightReward(r)) return true
  if (r.type === 'weapon' && r.weaponId && r.isNew) return true
  return false
}

/**
 * 掉落区：去掉灵石/经验配置项；去掉已在顶部「恭喜获得」并排展示的御灵/新法宝，避免重复。
 */
function _victoryDropRewardsForDisplay(result) {
  const rewards = result && result.rewards
  if (!rewards || !rewards.length) return []
  const skip = _heroSpotlightRewardKeys(result)
  return rewards.filter(r => {
    if (r.type === 'exp' || r.type === 'soulStone') return false
    if (r.type === 'pet' && r.petId && skip.has(`pet:${r.petId}`)) return false
    if (r.type === 'weapon' && r.weaponId && skip.has(`weapon:${r.weaponId}`)) return false
    return true
  })
}

function _partitionDropRewards(rewards) {
  if (!rewards || !rewards.length) return []
  const out = []
  let i = 0
  while (i < rewards.length) {
    const isInlineNewGroupReward = rewards[i]
      && (((rewards[i].type === 'pet' && rewards[i].petId) || (rewards[i].type === 'weapon' && rewards[i].weaponId && rewards[i].isNew)))
    if (isInlineNewGroupReward) {
      const items = []
      while (i < rewards.length && rewards[i]
        && (((rewards[i].type === 'pet' && rewards[i].petId) || (rewards[i].type === 'weapon' && rewards[i].weaponId && rewards[i].isNew)))) {
        items.push(rewards[i])
        i++
      }
      out.push({ kind: 'newGroup', items })
    } else {
      out.push({ kind: 'single', reward: rewards[i] })
      i++
    }
  }
  return out
}

function _newDropRowHeight(S) {
  return 92 * S
}

function _heightForDropPart(part, S) {
  if (part.kind === 'newGroup') return _newDropRowHeight(S)
  const r = part.reward
  return (r.type === 'pet' ? 46 : r.type === 'fragment' ? 40 : r.type === 'weapon' ? 56 : 30) * S
}

function _drawNewDropTile(c, R, S, left, cy, tileW, reward, g, at, subDelay) {
  const pulse = 0.85 + 0.15 * Math.sin((at + subDelay) * 0.07)
  const padTop = 5 * S
  const iconSz = Math.min(46 * S, Math.max(28 * S, tileW - 8 * S))
  const iconX = left + (tileW - iconSz) / 2
  const iconY = cy + padTop

  const drawNewRibbon = () => {
    c.save()
    c.translate(iconX + 2 * S, iconY - 1 * S)
    c.rotate(0.18)
    c.globalAlpha *= pulse
    c.fillStyle = 'rgba(180,120,20,0.95)'
    R.rr(-15 * S, -6 * S, 30 * S, 12 * S, 3 * S); c.fill()
    c.strokeStyle = 'rgba(255,240,200,0.75)'; c.lineWidth = 1 * S
    R.rr(-15 * S, -6 * S, 30 * S, 12 * S, 3 * S); c.stroke()
    c.fillStyle = '#FFF8E0'
    c.font = `bold ${7.5 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('New', 0, 0)
    c.restore()
  }

  if (reward.type === 'pet' && reward.petId) {
    const pet = getPetById(reward.petId)
    if (!pet) return
    const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
    const strokeC = ac.main
    const rarityKey = getPetRarity(reward.petId)
    const rv = rarityVisualForAttr(rarityKey, pet.attr)

    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    R.drawCoverImg(R.getImg(avatarPath), iconX, iconY, iconSz, iconSz, { radius: 8 * S, strokeStyle: strokeC, strokeWidth: 2 })

    const badgeW = Math.max(rv.label.length * 6.5 * S + 4 * S, 22 * S)
    const badgeH = 11 * S
    const badgeX = iconX + iconSz - badgeW - 1 * S
    const badgeY = iconY + 1 * S
    c.fillStyle = rv.badgeBg
    R.rr(badgeX, badgeY, badgeW, badgeH, 2 * S); c.fill()
    c.strokeStyle = 'rgba(255,248,225,0.4)'; c.lineWidth = 0.85 * S
    R.rr(badgeX, badgeY, badgeW, badgeH, 2 * S); c.stroke()
    c.fillStyle = rv.badgeColor; c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(rv.label, badgeX + badgeW / 2, badgeY + badgeH / 2)

    drawNewRibbon()

    const nameY = iconY + iconSz + 5 * S
    const displayName = pet.name.length > 5 ? pet.name.slice(0, 5) + '…' : pet.name
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
    c.fillStyle = ac.main
    c.fillText(displayName, left + tileW / 2, nameY)
  } else if (reward.type === 'weapon' && reward.weaponId) {
    const w = getWeaponById(reward.weaponId)
    if (!w) return
    const rarityKey = getWeaponRarity(reward.weaponId) || 'R'
    const rv = rarityVisualForAttr(rarityKey, w.attr || 'metal')
    const wAc = w.attr ? (ATTR_COLOR[w.attr] || ATTR_COLOR.metal) : null
    const strokeC = wAc ? wAc.main : rv.borderColor

    const iconPath = `assets/equipment/fabao_${reward.weaponId}.png`
    R.drawCoverImg(R.getImg(iconPath), iconX, iconY, iconSz, iconSz, { radius: 8 * S, strokeStyle: strokeC, strokeWidth: 2 })

    const badgeW = Math.max(rv.label.length * 6.5 * S + 4 * S, 22 * S)
    const badgeH = 11 * S
    const badgeX = iconX + iconSz - badgeW - 1 * S
    const badgeY = iconY + 1 * S
    c.fillStyle = rv.badgeBg
    R.rr(badgeX, badgeY, badgeW, badgeH, 2 * S); c.fill()
    c.strokeStyle = 'rgba(255,248,225,0.4)'; c.lineWidth = 0.85 * S
    R.rr(badgeX, badgeY, badgeW, badgeH, 2 * S); c.stroke()
    c.fillStyle = rv.badgeColor; c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(rv.label, badgeX + badgeW / 2, badgeY + badgeH / 2)

    if (reward.isNew) drawNewRibbon()

    const nameY = iconY + iconSz + 5 * S
    const displayName = w.name.length > 5 ? w.name.slice(0, 5) + '…' : w.name
    c.textAlign = 'center'; c.textBaseline = 'top'
    c.font = `bold ${8.5 * S}px "PingFang SC",sans-serif`
    c.fillStyle = wAc ? wAc.main : '#6B5038'
    c.fillText(displayName, left + tileW / 2, nameY)
  }
}

function _drawNewDropsRow(c, R, S, x, cy, innerW, items, g, at, rowDelay) {
  const n = items.length
  if (n <= 0) return
  const gap = 5 * S
  const tileW = (innerW - gap * (n - 1)) / n
  for (let i = 0; i < n; i++) {
    _drawNewDropTile(c, R, S, x + i * (tileW + gap), cy, tileW, items[i], g, at, rowDelay + i * 3)
  }
}

// 奖励滚动区高度（不含底部操作区：看广告翻倍 + 返回/下一关 + 分享胶囊）
//   · 底部操作区独立绘制、钉在面板底部，不随滚动裁剪
//   · 看广告翻倍按钮也放固定区，避免滚动没拉到底直接看不到（Boss 关关键转化入口）
//   · 这里新增 firstClearSoulStone 分支的高度计入，修正原先预留不足导致"最后一行被按钮盖住"的残留问题
function _computeVictoryScrollContentHeight(result, S, pad) {
  const dropRewards = _victoryDropRewardsForDisplay(result)
  const hasRewards = dropRewards.length > 0
  const hasChapterClear = !!result.chapterClearReward
  let contentH = pad * 0.5
  if (hasRewards) {
    contentH += 24 * S
    for (const part of _partitionDropRewards(dropRewards)) {
      contentH += _heightForDropPart(part, S)
    }
    contentH += 10 * S
  }
  if (hasChapterClear) contentH += 10 * S + 28 * S
  if (result.chapterMilestones && result.chapterMilestones.length > 0) {
    for (const ms of result.chapterMilestones) {
      contentH += _chapterMilestoneCardHeight(ms, S) + 8 * S
    }
  }
  if (result.chapterBadgeUnlocked) contentH += 36 * S + 6 * S
  if (result.soulStone > 0) contentH += 32 * S
  if (result.firstClearSoulStone > 0) contentH += 32 * S
  if (result.cultExp > 0) {
    contentH += 28 * S
    if (result.cultLevelUps > 0) contentH += 16 * S
    if (result.cultRealmUp && result.cultRealmUp.kind === 'minor') contentH += 18 * S
    contentH += 26 * S
  }
  contentH += 24 * S
  return contentH
}

// Boss 关"看广告翻倍"是否处于可点状态（用于固定操作区预留空间）
function _hasAdDoubleBtn(result) {
  return !!(result && result.victory && result.isBossStage && !result.adDoubled && AdManager.canShow('settleDouble'))
}

// 固定操作区高度：
//   · 基础：4*S 顶距 + 38*S 按钮行 + 8*S 间距 + 36*S 分享胶囊 + pad 底距 = 86*S + pad
//   · Boss 关可看广告：上方再加 36*S 按钮 + 8*S 间距
//   · Boss 关已翻倍：上方加 22*S 提示条 + 4*S 间距
// 固定操作区总高度：tail（下一里程碑，26*S+6*S）+ 广告翻倍（0/36+8*S/22+4*S）+ 返回/下一关（38*S+4*S）+ 分享胶囊（36*S+8*S）+ 底 pad
//   · 老版本漏算了 tail 高度：首通+Boss 关同时存在 tail 和广告翻倍时，分享胶囊会被挤出屏幕底部（玩家反馈）
//   · storage：用于预测 tail 是否显示（computeNextMilestone 为 null 时 drawGoalTail 返回 0，这里同口径）
function _victoryActionsHeight(result, S, pad, storage) {
  let h = 4 * S + 38 * S + 8 * S + 36 * S + pad
  if (_hasAdDoubleBtn(result)) h += 36 * S + 8 * S
  else if (result && result.adDoubled) h += 22 * S + 4 * S
  // tail 只在胜利且本章还有下一里程碑时显示
  if (result && result.victory && storage) {
    const stage = getStageById(result.stageId)
    const chapterId = stage ? stage.chapter : null
    if (chapterId) {
      const nextMs = goalHint.computeNextMilestone(storage, chapterId)
      if (nextMs) h += 26 * S + 6 * S
    }
  }
  return h
}

// ===== 章节里程碑大奖卡片 =====
// 设计意图（plan B 节）：
//   · 跨过 8/16/24 阈值时，给玩家一张"明显比普通奖励行更重"的金色卡片
//   · 卡片包含：TIER 徽章（★8/★16/★24）+ 章节名 + 奖励 icon 行
//   · 使用主题色金色（仿章节通关宝箱）+ 内阴影 + 微光动画，强化仪式感
//   · 高度因奖励条数而异，最少 46*S，最多 ~62*S（4 种奖励混合时）

function _chapterMilestoneCardHeight(ms, S) {
  // 标题行 18*S + 奖励图标行 28*S + pad 8*S = 54*S（单行奖励）
  // 超过 3 条奖励则换两行：+24*S
  const rewardCount = (ms && ms.rewards) ? ms.rewards.length : 0
  const baseH = 54 * S
  return rewardCount > 3 ? baseH + 24 * S : baseH
}

function _drawChapterMilestoneCard(c, R, S, x, cy, innerW, ms, at) {
  const cardH = _chapterMilestoneCardHeight(ms, S)

  // 金色主题底板（比章节通关宝箱更浓，让里程碑更"大"）
  const grad = c.createLinearGradient(x, cy, x, cy + cardH)
  grad.addColorStop(0, 'rgba(220,175,70,0.22)')
  grad.addColorStop(1, 'rgba(220,175,70,0.08)')
  c.fillStyle = grad
  R.rr(x, cy, innerW, cardH, 8 * S); c.fill()
  const pulse = 0.8 + 0.2 * Math.sin((at || 0) * 0.08)
  c.strokeStyle = `rgba(230,180,60,${0.45 * pulse})`
  c.lineWidth = 1.5 * S
  R.rr(x, cy, innerW, cardH, 8 * S); c.stroke()

  // 左侧 TIER 徽章（★8/★16/★24 圆形勋章）
  const badgeR = 18 * S
  const badgeCx = x + 10 * S + badgeR
  const badgeCy = cy + 10 * S + badgeR
  c.fillStyle = 'rgba(255,230,140,0.9)'
  c.beginPath(); c.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2); c.fill()
  c.strokeStyle = '#b8860b'; c.lineWidth = 1.5 * S
  c.beginPath(); c.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2); c.stroke()
  c.fillStyle = '#7a4a00'
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(`★${ms.tier}`, badgeCx, badgeCy + 0.5 * S)

  // 右上：标题"本章 X★ 达成！"
  const titleX = badgeCx + badgeR + 8 * S
  c.textAlign = 'left'; c.textBaseline = 'top'
  c.fillStyle = '#A05010'
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  const tierLabel = ms.tier === 24 ? '章节全3★达成！' : `本章累计 ${ms.tier}★ 达成！`
  c.fillText(tierLabel, titleX, cy + 10 * S)

  // 奖励图标行
  const rewardCy = cy + 32 * S
  _drawMilestoneRewardIcons(c, R, S, titleX, rewardCy, x + innerW - 10 * S - titleX, ms.rewards || [])

  return cardH
}

function _drawMilestoneRewardIcons(c, R, S, x, y, maxW, rewards) {
  const iconSz = 20 * S
  const textGap = 3 * S
  const segGap = 10 * S
  let cx = x
  const cy = y + iconSz / 2
  c.textBaseline = 'middle'
  c.textAlign = 'left'

  for (const r of rewards) {
    let iconPath = null
    let text = ''
    if (r.type === 'soulStone') {
      iconPath = 'assets/ui/icon_soul_stone.png'
      text = `+${r.amount}`
    } else if (r.type === 'awakenStone') {
      iconPath = 'assets/ui/icon_awaken_stone.png'
      text = `+${r.amount}`
    } else if (r.type === 'universalFragment') {
      iconPath = 'assets/ui/icon_universal_frag.png'
      text = `×${r.count}`
    } else if (r.type === 'fragment' && r.petId) {
      // SSR 碎片：用宠物头像（小一圈），旁边写"碎片×N"
      const pet = getPetById(r.petId)
      if (pet) {
        const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
        const img = R.getImg(avatarPath)
        if (img && img.width > 0) {
          R.drawCoverImg(img, cx, y, iconSz, iconSz, { radius: 4 * S, strokeStyle: '#b8860b', strokeWidth: 1 })
        }
        cx += iconSz + textGap
      }
      c.fillStyle = '#A05010'
      c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      text = `碎片×${r.count}`
      c.fillText(text, cx, cy)
      cx += c.measureText(text).width + segGap
      continue
    } else if (r.type === 'ssrWeapon') {
      // 24★ 现货 SSR 法宝：icon 与章节里程碑一致（底栏法宝 Tab）
      const fabaoIcon = R.getImg('assets/ui/nav_weapon.png')
      if (fabaoIcon && fabaoIcon.width > 0) c.drawImage(fabaoIcon, cx, cy, iconSz, iconSz)
      cx += iconSz + textGap
      c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      text = r.weaponName ? `SSR法宝「${r.weaponName}」` : 'SSR法宝×1'
      c.fillText(text, cx, cy)
      cx += c.measureText(text).width + segGap
      continue
    } else if (r.type === 'weaponTicket') {
      // 历史兼容：v1 旧存档里可能残留的 weaponTicket（新存档已不再产生）
      c.fillStyle = '#A05010'
      c.font = `${iconSz}px "PingFang SC",sans-serif`
      c.fillText('🎫', cx, cy)
      cx += iconSz + textGap
      c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      text = `SSR法宝保底券×${r.count}`
      c.fillText(text, cx, cy)
      cx += c.measureText(text).width + segGap
      continue
    }
    if (iconPath) {
      const img = R.getImg(iconPath)
      if (img && img.width > 0) c.drawImage(img, cx, y, iconSz, iconSz)
      cx += iconSz + textGap
    }
    if (text) {
      c.fillStyle = '#A05010'
      c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText(text, cx, cy)
      cx += c.measureText(text).width + segGap
    }
    // 换行：超过可用宽度就跳下一行（高度已在 _chapterMilestoneCardHeight 中预留）
    if (cx - x > maxW - 40 * S) {
      cx = x
      y += iconSz + 4 * S
    }
  }
}

// ===== 章节徽章解锁行（24★ 全通关） =====
function _drawChapterBadgeUnlockedRow(c, R, S, x, cy, innerW, result, at) {
  const rowH = 36 * S
  const pulse = 0.7 + 0.3 * Math.sin((at || 0) * 0.1)

  // 紫金底板（徽章 = 成就感，区别于普通金色里程碑）
  const grad = c.createLinearGradient(x, cy, x + innerW, cy)
  grad.addColorStop(0, 'rgba(180,120,200,0.22)')
  grad.addColorStop(1, 'rgba(220,175,70,0.22)')
  c.fillStyle = grad
  R.rr(x, cy, innerW, rowH, 6 * S); c.fill()
  c.strokeStyle = `rgba(200,150,220,${0.45 * pulse})`
  c.lineWidth = 1.2 * S
  R.rr(x, cy, innerW, rowH, 6 * S); c.stroke()

  const stage = getStageById(result.stageId)
  const chapter = stage ? getChapterById(stage.chapter) : null
  const chapterName = chapter ? chapter.name : ''

  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.font = `${20*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#a05010'
  c.fillText('🏅', x + 10 * S, cy + rowH / 2)
  c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#7a3a8a'
  c.fillText(`章节徽章点亮！`, x + 38 * S, cy + rowH / 2 - 6 * S)
  c.font = `${9*S}px "PingFang SC",sans-serif`
  c.fillStyle = '#8B7355'
  c.fillText(`${chapterName}·全3★成就 · 章节主线页可查看`, x + 38 * S, cy + rowH / 2 + 7 * S)
  return rowH
}

// 看广告翻倍按钮内部绘制：借用 adReward 金色底板，自己绘制"▶ 看广告翻倍 + 图标奖励"
//   · 纯文字"灵石+64 碎片+8"玩家要识别多半拍，图标化后一眼能扫到
function _drawAdDoubleRewardBtn(c, R, S, x, y, w, h, result) {
  R.drawDialogBtn(x, y, w, h, '', 'adReward')

  const ss = result.soulStone || 0
  const frag = result.totalFragCount || 0

  const labelFont = `bold ${Math.min(12 * S, h * 0.36)}px "PingFang SC",sans-serif`
  const valFont = `bold ${Math.min(12 * S, h * 0.36)}px "PingFang SC",sans-serif`
  const iconSz = Math.min(16 * S, h * 0.55)
  const iconTextGap = 3 * S
  const segGap = 8 * S
  const label = '▶ 看广告翻倍'

  c.save()
  c.textBaseline = 'middle'
  c.textAlign = 'left'

  c.font = labelFont
  const labelW = c.measureText(label).width

  c.font = valFont
  const segs = []
  if (ss > 0) segs.push({ icon: 'assets/ui/icon_soul_stone.png', text: '+' + ss, textW: c.measureText('+' + ss).width })
  if (frag > 0) segs.push({ icon: 'assets/ui/icon_universal_frag.png', text: '+' + frag, textW: c.measureText('+' + frag).width })

  const segsW = segs.reduce((acc, s) => acc + segGap + iconSz + iconTextGap + s.textW, 0)
  const totalW = labelW + segsW

  let cx = x + (w - totalW) / 2
  const cy = y + h * 0.5

  c.fillStyle = '#4A2020'
  c.shadowColor = 'rgba(255,255,255,0.3)'
  c.shadowBlur = 1 * S
  c.font = labelFont
  c.fillText(label, cx, cy)
  c.shadowBlur = 0
  cx += labelW

  for (const seg of segs) {
    cx += segGap
    const img = R.getImg(seg.icon)
    if (img && img.width > 0) c.drawImage(img, cx, cy - iconSz / 2, iconSz, iconSz)
    cx += iconSz + iconTextGap
    c.fillStyle = '#4A2020'
    c.font = valFont
    c.fillText(seg.text, cx, cy)
    cx += seg.textW
  }
  c.restore()
}

// ===== 胜利奖励面板（增强版：大图标 + 分区高亮 + 入场动画；过长时可滑动） =====
function _drawVictoryRewardPanel(g, c, R, W, H, S, result, panelTop, at) {
  const pw = W * 0.88
  const px = (W - pw) / 2
  const pad = 14 * S
  const innerW = pw - pad * 2
  const panelRad = 14 * S

  const dropRewards = _victoryDropRewardsForDisplay(result)
  const hasRewards = dropRewards.length > 0
  const hasChapterClear = !!result.chapterClearReward

  // 奖励明细走滚动区；看广告翻倍 + 返回/下一关 + 分享胶囊钉在面板底，不随滚动裁剪，保证始终可见可点
  const scrollContentH = _computeVictoryScrollContentHeight(result, S, pad)
  const actionsH = _victoryActionsHeight(result, S, pad, g.storage)
  const marginBottom = 10 * S
  const screenBottom = H - marginBottom

  let scrollViewportH = scrollContentH
  let scrollMax = 0
  if (panelTop + scrollContentH + actionsH > screenBottom) {
    const avail = Math.max(0, screenBottom - panelTop - actionsH)
    scrollViewportH = Math.max(100 * S, avail)
    scrollMax = Math.max(0, scrollContentH - scrollViewportH)
  }
  if (_victoryRewardScroll > scrollMax) _victoryRewardScroll = scrollMax
  if (_victoryRewardScroll < 0) _victoryRewardScroll = 0
  const scroll = _victoryRewardScroll

  _victoryRewardScrollMax = scrollMax
  _victoryRewardViewport = scrollMax > 0 ? [px, panelTop, pw, scrollViewportH] : null

  const totalPanelH = scrollViewportH + actionsH
  R.drawInfoPanel(px, panelTop, pw, totalPanelH)

  c.save()
  R.rr(px, panelTop, pw, scrollViewportH, panelRad)
  c.clip()
  c.translate(0, -scroll)

  let cy = panelTop + pad * 0.6
  let rowIdx = 0

  // === 掉落奖励 ===
  if (hasRewards) {
    const rewardSectionTitle = _victoryRewardSectionTitle(result)
    const firstClearTag = _victoryFirstClearTag(result)
    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#8B7355'; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
    c.fillText(rewardSectionTitle, px + pad, cy + 6 * S)
    if (firstClearTag) {
      c.save()
      c.textAlign = 'right'
      c.shadowColor = 'rgba(200,150,0,0.5)'; c.shadowBlur = 6 * S
      c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
      c.fillText(firstClearTag, px + pw - pad, cy + 6 * S)
      c.restore()
    }
    cy += 24 * S

    for (const part of _partitionDropRewards(dropRewards)) {
      const rowDelay = 15 + rowIdx * 6
      const rowAlpha = Math.min(1, Math.max(0, (at - rowDelay) / 12))
      const rowSlide = (1 - rowAlpha) * 20 * S
      const stepH = _heightForDropPart(part, S)

      if (rowAlpha <= 0) {
        cy += stepH
        rowIdx++
        continue
      }

      c.save()
      c.globalAlpha *= rowAlpha
      c.translate(rowSlide, 0)

      if (part.kind === 'newGroup') {
        _drawNewDropsRow(c, R, S, px + pad, cy, innerW, part.items, g, at, rowDelay)
        cy += _newDropRowHeight(S)
      } else {
        const r = part.reward
        if (r.type === 'pet' && r.petId) {
          _drawPetRowEnhanced(c, R, S, px + pad, cy, innerW, r, at, rowDelay)
          cy += 46 * S
        } else if (r.type === 'fragment' && r.petId) {
          _drawFragmentRowEnhanced(c, R, S, px + pad, cy, innerW, r, g)
          cy += 40 * S
        } else if (r.type === 'weapon' && r.weaponId) {
          _drawWeaponRowEnhanced(c, R, S, px + pad, cy, innerW, r, at)
          cy += 56 * S
        }
      }

      c.restore()
      rowIdx++
    }

    cy += 2 * S
    c.strokeStyle = 'rgba(180,160,120,0.3)'; c.lineWidth = 1 * S
    c.beginPath(); c.moveTo(px + pad, cy); c.lineTo(px + pw - pad, cy); c.stroke()
    cy += 8 * S
  }

  // === 章节通关宝箱 ===
  if (hasChapterClear) {
    const cr = result.chapterClearReward
    const msDelay = 15 + rowIdx * 6
    const msAlpha = Math.min(1, Math.max(0, (at - msDelay) / 12))
    c.save()
    c.globalAlpha *= msAlpha

    const msH = 22 * S
    c.fillStyle = 'rgba(200,160,40,0.10)'
    R.rr(px + pad, cy, innerW, msH, 5 * S); c.fill()

    c.textAlign = 'left'; c.textBaseline = 'middle'
    c.fillStyle = '#D4A030'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    c.fillText('章节通关宝箱！', px + pad + 6 * S, cy + msH / 2)
    c.textAlign = 'right'; c.font = `bold ${10*S}px "PingFang SC",sans-serif`
    const mParts = []
    if (cr.soulStone) mParts.push(`灵石+${cr.soulStone}`)
    if (cr.fragment) mParts.push(`碎片+${cr.fragment}`)
    if (cr.awakenStone) mParts.push(`觉醒石+${cr.awakenStone}`)
    c.fillStyle = '#B8860B'
    c.fillText(mParts.join(' '), px + pw - pad - 6 * S, cy + msH / 2)
    c.restore()
    cy += 28 * S
    rowIdx++
    cy += 10 * S
  }

  // === 章节星级里程碑大奖（8★/16★/24★） ===
  // plan B 节核心：跨过 8/16/24 阈值时立刻展示金色大卡，让"章节终点"有仪式感
  //   · 每档一张独立卡片（多档同时达成时依次展示）
  //   · 24★ 达成时额外亮出"章节徽章解锁"小条（C 节）
  if (result.chapterMilestones && result.chapterMilestones.length > 0) {
    for (const ms of result.chapterMilestones) {
      const msDelay = 15 + rowIdx * 6
      const msAlpha = Math.min(1, Math.max(0, (at - msDelay) / 12))
      c.save(); c.globalAlpha *= msAlpha
      const cardH = _drawChapterMilestoneCard(c, R, S, px + pad, cy, innerW, ms, at)
      c.restore()
      cy += cardH + 8 * S
      rowIdx++
    }
  }
  if (result.chapterBadgeUnlocked) {
    const bgDelay = 15 + rowIdx * 6
    const bgAlpha = Math.min(1, Math.max(0, (at - bgDelay) / 12))
    c.save(); c.globalAlpha *= bgAlpha
    const bgH = _drawChapterBadgeUnlockedRow(c, R, S, px + pad, cy, innerW, result, at)
    c.restore()
    cy += bgH + 6 * S
    rowIdx++
  }

  // === 本关灵石 / 修炼经验 ===
  if (result.soulStone > 0) {
    const ssDelay = 15 + rowIdx * 6
    const ssAlpha = Math.min(1, Math.max(0, (at - ssDelay) / 12))
    c.save(); c.globalAlpha *= ssAlpha
    const ssLabel = result.duplicateWeaponSoulStone > 0
      ? (hasChapterClear ? '本关灵石（含法宝熔炼）' : '灵石（含法宝熔炼）')
      : (hasChapterClear ? '本关灵石' : '灵石')
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', ssLabel, `+${result.soulStone}`, C.soulLabel, C.soulValue)
    c.restore()
    cy += 32 * S
    rowIdx++
  }

  // === 首通里程碑灵石 ===
  if (result.firstClearSoulStone > 0) {
    const msDelay = 15 + rowIdx * 6
    const msAlpha = Math.min(1, Math.max(0, (at - msDelay) / 12))
    c.save(); c.globalAlpha *= msAlpha
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_soul_stone', '首通灵石奖励', `+${result.firstClearSoulStone}`, C.soulAccent, C.soulAccent)
    c.restore()
    cy += 32 * S
    rowIdx++
  }

  // === 修炼经验 ===
  if (result.cultExp > 0) {
    const expDelay = 15 + rowIdx * 6
    const expAlpha = Math.min(1, Math.max(0, (at - expDelay) / 12))
    c.save(); c.globalAlpha *= expAlpha
    _drawExpRow(c, R, S, px + pad, cy, innerW, 'icon_cult_exp', '修炼经验', `+${result.cultExp}`, C.cultExpLabel, C.cultExpValue)
    c.restore()
    cy += 22 * S

    if (result.cultLevelUps > 0) {
      const cult = g.storage.cultivation
      _drawCultLvUpRow(c, R, S, W / 2, cy, result.cultPrevLevel, cult.level, result.cultLevelUps)
      cy += 16 * S
    }
    // 小阶跨档金光行（胜利面板版）
    if (result.cultRealmUp && result.cultRealmUp.kind === 'minor') {
      _drawCultSubRealmUpRow(c, R, S, W / 2, cy, result.cultRealmUp.curr.fullName)
      cy += 18 * S
    }

    const cult = g.storage.cultivation
    const barX = px + pad, barW = innerW, barH = 7 * S
    c.fillStyle = 'rgba(0,0,0,0.06)'
    R.rr(barX, cy, barW, barH, barH / 2); c.fill()
    if (cult.level < MAX_LEVEL) {
      const needed = expToNextLevel(cult.level)
      const pct = Math.min(cult.exp / needed, 1)
      if (pct > 0) {
        const fillW = Math.max(barH, barW * pct)
        const barGrad = c.createLinearGradient(barX, cy, barX + fillW, cy)
        barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
        c.fillStyle = barGrad
        R.rr(barX, cy, fillW, barH, barH / 2); c.fill()
      }
      c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level}  ${cult.exp}/${needed}  ${getRealmByLv(cult.level).fullName}`, px + pw - pad, cy + barH + 9 * S)
    } else {
      const barGrad = c.createLinearGradient(barX, cy, barX + barW, cy)
      barGrad.addColorStop(0, '#D4A843'); barGrad.addColorStop(1, '#F0C860')
      c.fillStyle = barGrad
      R.rr(barX, cy, barW, barH, barH / 2); c.fill()
      c.textAlign = 'right'; c.fillStyle = '#A09070'; c.font = `${8*S}px "PingFang SC",sans-serif`
      c.fillText(`Lv.${cult.level} 已满级  ${getRealmByLv(cult.level).fullName}`, px + pw - pad, cy + barH + 9 * S)
    }
    cy += barH + 20 * S
    rowIdx++
  }

  // === 汇总行 ===
  const summaryDelay = 15 + rowIdx * 6
  const summaryAlpha = Math.min(1, Math.max(0, (at - summaryDelay) / 12))
  if (summaryAlpha > 0) {
    c.save()
    c.globalAlpha *= summaryAlpha
    const sumParts = []
    const stageSS = result.soulStone || 0
    const totalExp = result.cultExp || 0
    let dropFrags = 0
    const starAwaken = result.starBonusAwakenStone || 0
    if (result.rewards) result.rewards.forEach(r => { if (r.type === 'fragment') dropFrags += r.count })
    let boxSS = 0, boxFrags = 0, boxAwaken = 0
    if (result.chapterClearReward) {
      const cr = result.chapterClearReward
      boxSS = cr.soulStone || 0
      boxFrags = cr.fragment || 0
      boxAwaken = cr.awakenStone || 0
    }
    const totalSS = stageSS + boxSS
    const totalFrags = dropFrags + boxFrags
    const totalAwaken = starAwaken + boxAwaken
    if (totalSS > 0) {
      if (boxSS > 0) sumParts.push(`灵石 +${totalSS}（本关+${stageSS} 宝箱+${boxSS}）`)
      else sumParts.push(`灵石 +${totalSS}`)
    }
    if (totalFrags > 0) {
      if (boxFrags > 0) sumParts.push(`碎片 +${totalFrags}（掉落+${dropFrags} 宝箱+${boxFrags}）`)
      else sumParts.push(`碎片 +${totalFrags}`)
    }
    if (totalAwaken > 0) {
      if (boxAwaken > 0 && starAwaken > 0) {
        sumParts.push(`觉醒石 +${totalAwaken}（星级+${starAwaken} 宝箱+${boxAwaken}）`)
      } else {
        sumParts.push(`觉醒石 +${totalAwaken}`)
      }
    }
    if (totalExp > 0) sumParts.push(`经验 +${totalExp}`)
    if (sumParts.length > 0) {
      c.textAlign = 'center'; c.textBaseline = 'middle'
      c.fillStyle = '#A09070'; c.font = `${8.5*S}px "PingFang SC",sans-serif`
      c.fillText(`本次共获得：${sumParts.join('、')}`, W / 2, cy + 6 * S)
    }
    c.restore()
  }
  cy += 24 * S

  c.restore()

  // === 固定操作区（不随滚动裁剪，钉在面板底部）===
  //   · Boss 关"看广告翻倍"放在最上方：常驻可点，不再被滚动遮住；奖励改用图标，识别更快
  //   · 返回 / 下一关 放在中间一行
  //   · 分享胶囊挂在下一关右下外缘，常驻可点
  //   · shareCelebrate 正在展示时分享胶囊内部会自动隐藏，避免主被动入口并存打架
  //   · 首通胜利时分享胶囊带呼吸发光，把"情绪高点"引流到主动分享
  let actionsCy = panelTop + scrollViewportH

  // 胜利结算页尾部：常驻"下一里程碑"提示（plan E3）
  //   · 贴在固定操作区最上沿，不受滚动裁剪，确保玩家下一关之前必然扫一眼"下一目标"
  //   · 若本章所有里程碑已全部领取，drawGoalTail 返回 0，自动不占用空间
  _rects.goalTailRect = null; _rects.goalTailBtnRect = null
  if (result.victory) {
    const tailStage = getStageById(result.stageId)
    const tailChapterId = tailStage ? tailStage.chapter : null
    if (tailChapterId) {
      const tailH = goalHint.drawGoalTail(c, R, S, px + pad, actionsCy, innerW, {
        storage: g.storage,
        chapterId: tailChapterId,
        onRegisterRect: ({ btnRect, tailRect }) => {
          _rects.goalTailRect = tailRect
          _rects.goalTailBtnRect = btnRect
        },
      })
      if (tailH > 0) actionsCy += tailH + 6 * S
    }
  }

  if (_hasAdDoubleBtn(result)) {
    const adBtnW = innerW * 0.7, adBtnH = 36 * S
    const adBtnX = (W - adBtnW) / 2, adBtnY = actionsCy
    _drawAdDoubleRewardBtn(c, R, S, adBtnX, adBtnY, adBtnW, adBtnH, result)
    _rects.adDoubleBtnRect = [adBtnX, adBtnY, adBtnW, adBtnH]
    actionsCy += adBtnH + 8 * S
  } else if (result.adDoubled) {
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#60A060'; c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
    c.fillText('✓ 奖励已翻倍', W / 2, actionsCy + 11 * S)
    _rects.adDoubleBtnRect = null
    actionsCy += 22 * S + 4 * S
  } else {
    _rects.adDoubleBtnRect = null
  }

  const btnH = 38 * S
  const btnGap = 12 * S
  const btnW = (innerW - btnGap) / 2
  const btnY = actionsCy + 4 * S

  R.drawDialogBtn(px + pad, btnY, btnW, btnH, '返回', 'cancel')
  _rects.backBtnRect = [px + pad, btnY, btnW, btnH]

  const nextId = getNextStageId(result.stageId)
  const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
  const isNewbieContinuous = result.victory && result.isFirstClear
    && (result.stageId === 'stage_1_1' || result.stageId === 'stage_1_2')
  const rightLabel = isNewbieContinuous ? '下一关！' : (hasNext ? '下一关' : '再次挑战')
  R.drawDialogBtn(px + pad + btnW + btnGap, btnY, btnW, btnH, rightLabel, isNewbieContinuous ? 'gold' : 'confirm')
  _rects.nextBtnRect = [px + pad + btnW + btnGap, btnY, btnW, btnH]

  // 分享胶囊：已在 clip 外绘制，scroll 传 0 即可
  _drawShareIconBtnOnResult(g, px + pad + innerW, btnY, btnH, result, 0, true)

  if (scrollMax > 0) {
    const trackX = px + pw - 5 * S
    const trackY = panelTop + 8 * S
    const trackH = scrollViewportH - 16 * S
    const thumbH = Math.max(22 * S, (scrollViewportH / scrollContentH) * trackH)
    const thumbTravel = Math.max(0, trackH - thumbH)
    const thumbY = trackY + (scrollMax > 0 ? (scroll / scrollMax) * thumbTravel : 0)
    c.fillStyle = 'rgba(90,70,50,0.2)'
    R.rr(trackX - 2 * S, trackY, 4 * S, trackH, 2 * S); c.fill()
    c.fillStyle = 'rgba(170,130,70,0.55)'
    R.rr(trackX - 2 * S, thumbY, 4 * S, thumbH, 2 * S); c.fill()
  }
}

// ===== 首通宠物奖励行（增强版：大图标 + 光效） =====
function _drawPetRowEnhanced(c, R, S, x, cy, innerW, reward, at, rowDelay) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const ac = pet ? (ATTR_COLOR[attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
  const attrColor = ac.main || '#888'

  // 高亮背景条
  const hlH = 40 * S
  const hlGrad = c.createLinearGradient(x, cy, x + innerW, cy)
  hlGrad.addColorStop(0, rgbaFromHex(ac.main, 0.12))
  hlGrad.addColorStop(1, rgbaFromHex(ac.main, 0.02))
  c.fillStyle = hlGrad
  R.rr(x, cy, innerW, hlH, 6 * S); c.fill()
  c.strokeStyle = rgbaFromHex(ac.main, 0.28)
  c.lineWidth = 0.8 * S
  R.rr(x, cy, innerW, hlH, 6 * S); c.stroke()

  const iconSz = 36 * S
  const iconX = x + 4 * S
  const iconY = cy + (hlH - iconSz) / 2

  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    R.drawCoverImg(R.getImg(avatarPath), iconX, iconY, iconSz, iconSz, { radius: 7 * S, shadow: attrColor, shadowBlur: 8, strokeStyle: attrColor, strokeWidth: 2 })
  }

  const rv2 = rarityVisualForAttr(getPetRarity(reward.petId), attr)
  const badgeW = rv2.label.length * 8 * S + 6 * S
  const badgeH = 13 * S
  const badgeX = iconX + iconSz - badgeW + 2 * S
  const badgeY = iconY - 2 * S
  c.fillStyle = rv2.badgeBg
  R.rr(badgeX, badgeY, badgeW, badgeH, 3 * S); c.fill()
  c.strokeStyle = 'rgba(255,248,225,0.4)'; c.lineWidth = 0.9 * S
  R.rr(badgeX, badgeY, badgeW, badgeH, 3 * S); c.stroke()
  c.fillStyle = rv2.badgeColor; c.font = `bold ${8*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillText(rv2.label, badgeX + badgeW / 2, badgeY + badgeH / 2)

  // 宠物名
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = attrColor; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.fillText(name, iconX + iconSz + 8 * S, cy + hlH / 2 - 4 * S)

  // "获得灵宠！"闪烁
  const glowAlpha = 0.7 + 0.3 * Math.sin(at * 0.08)
  c.save()
  c.globalAlpha *= glowAlpha
  c.fillStyle = ac.main
  c.font = `bold ${10*S}px "PingFang SC",sans-serif`
  c.shadowColor = rgbaFromHex(ac.main, 0.5)
  c.shadowBlur = 4 * S
  c.fillText('获得灵宠！', iconX + iconSz + 8 * S, cy + hlH / 2 + 10 * S)
  c.restore()
}

// ===== 碎片奖励行（增强版：含进度提示 + 星级） =====
function _drawFragmentRowEnhanced(c, R, S, x, cy, innerW, reward, g) {
  const pet = getPetById(reward.petId)
  const name = pet ? pet.name : reward.petId
  const attr = pet ? pet.attr : 'metal'
  const ac = pet ? (ATTR_COLOR[attr] || ATTR_COLOR.metal) : ATTR_COLOR.metal
  const attrColor = ac.main || '#888'

  const iconSz = 32 * S
  const rowH = 34 * S
  const iconX = x + 4 * S
  const iconY = cy + (rowH - iconSz) / 2

  const poolPet = g.storage.getPoolPet(reward.petId)
  const star = poolPet ? poolPet.star : 1

  if (pet) {
    const avatarPath = getPetAvatarPath({ ...pet, star })
    R.drawCoverImg(R.getImg(avatarPath), iconX, iconY, iconSz, iconSz, { radius: 5 * S, strokeStyle: attrColor, strokeWidth: 1.5 })

    const rv = rarityVisualForAttr(getPetRarity(reward.petId), attr)
    const badgeW = rv.label.length * 7 * S + 4 * S
    const badgeH = 11 * S
    const badgeX = iconX - 1 * S
    const badgeY = iconY - 1 * S
    c.fillStyle = rv.badgeBg
    R.rr(badgeX, badgeY, badgeW, badgeH, 3 * S); c.fill()
    c.strokeStyle = 'rgba(255,248,225,0.4)'; c.lineWidth = 0.85 * S
    R.rr(badgeX, badgeY, badgeW, badgeH, 3 * S); c.stroke()
    c.fillStyle = rv.badgeColor; c.font = `bold ${7*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(rv.label, badgeX + badgeW / 2, badgeY + badgeH / 2)
  }

  // 名称 + 数量
  const textX = iconX + iconSz + 8 * S
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = attrColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(`${name}碎片`, textX, cy + rowH / 2 - 4 * S)

  c.fillStyle = ac.dk || ac.main
  c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(`×${reward.count}`, x + innerW, cy + rowH / 2 - 4 * S)

  // 碎片进度提示
  if (poolPet) {
    const nextStar = poolPet.star + 1
    const cost = POOL_STAR_FRAG_COST[nextStar]
    if (cost) {
      const current = poolPet.fragments || 0
      c.textAlign = 'left'
      c.fillStyle = current >= cost ? (ac.lt || ac.main) : '#A09070'
      c.font = `${8*S}px "PingFang SC",sans-serif`
      const progressText = current >= cost
        ? `碎片足够升${nextStar}★！`
        : `升${nextStar}★ 进度 ${current}/${cost}`
      c.fillText(progressText, textX, cy + rowH / 2 + 8 * S)
    }
  }
}

// ===== 法宝掉落行（胜利结算） =====
function _drawWeaponRowEnhanced(c, R, S, x, cy, innerW, reward, at) {
  const w = getWeaponById(reward.weaponId)
  const name = w ? w.name : reward.weaponId
  const desc = w ? w.desc : ''
  const wAttr = (w && w.attr) || 'metal'
  const wAc = ATTR_COLOR[wAttr] || ATTR_COLOR.metal

  const hlH = 56 * S
  const hlGrad = c.createLinearGradient(x, cy, x + innerW, cy)
  hlGrad.addColorStop(0, rgbaFromHex(wAc.main, 0.1))
  hlGrad.addColorStop(1, rgbaFromHex(wAc.main, 0.02))
  c.fillStyle = hlGrad
  R.rr(x, cy, innerW, hlH, 6 * S); c.fill()
  c.strokeStyle = rgbaFromHex(wAc.main, 0.22)
  c.lineWidth = 0.8 * S
  R.rr(x, cy, innerW, hlH, 6 * S); c.stroke()

  const iconSz = 40 * S
  const iconX = x + 4 * S
  const iconY = cy + (hlH - iconSz) / 2
  const fabaoPath = `assets/equipment/fabao_${reward.weaponId}.png`
  R.drawCoverImg(R.getImg(fabaoPath), iconX, iconY, iconSz, iconSz, { radius: 6 * S, shadow: wAc.main, shadowBlur: 6, strokeStyle: wAc.main, strokeWidth: 2 })

  if (reward.isNew) {
    const newPulse = 0.75 + 0.25 * Math.sin((at || 0) * 0.1)
    c.save()
    c.globalAlpha *= newPulse
    c.font = `bold ${8 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'right'; c.textBaseline = 'bottom'
    c.fillStyle = '#FF4444'
    c.shadowColor = 'rgba(255,0,0,0.5)'; c.shadowBlur = 4 * S
    c.fillText('NEW', iconX + iconSz, iconY - 2 * S)
    c.restore()
  }

  const textX = iconX + iconSz + 8 * S
  c.textAlign = 'left'
  c.fillStyle = wAc.main
  c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
  c.shadowColor = rgbaFromHex(wAc.main, 0.35)
  c.shadowBlur = 3 * S
  c.textBaseline = 'top'
  c.fillText(name, textX, cy + 10 * S)
  c.shadowBlur = 0
  c.fillStyle = 'rgba(160,150,140,0.95)'; c.font = `${9 * S}px "PingFang SC",sans-serif`
  const maxDescW = innerW - (textX - x) - 4 * S
  _fillTextWrapped(c, desc, textX, cy + 24 * S, maxDescW, 10 * S, 2)
}

function _fillTextWrapped(c, text, x, startY, maxWidth, lineHeight, maxLines) {
  if (!text) return
  c.textAlign = 'left'; c.textBaseline = 'top'
  const limit = maxLines || 2
  const chars = Array.from(text)
  const lines = []
  let line = ''
  for (let i = 0; i < chars.length; i++) {
    const test = line + chars[i]
    if (c.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = chars[i]
    } else {
      line = test
    }
  }
  if (line) lines.push(line)

  let toDraw = lines
  if (lines.length > limit) {
    const restJoined = lines.slice(limit - 1).join('')
    let tail = restJoined
    const suffix = '…'
    while (tail.length > 0 && c.measureText(tail + suffix).width > maxWidth) tail = tail.slice(0, -1)
    toDraw = lines.slice(0, limit - 1).concat(tail + suffix)
  }

  let y = startY
  for (let i = 0; i < toDraw.length; i++) {
    c.fillText(toDraw[i], x, y)
    y += lineHeight
  }
}

// ===== 经验行（图标+文字+数值） =====
function _drawExpRow(c, R, S, x, cy, innerW, iconName, label, value, labelColor, valueColor) {
  const iconSz = 22 * S
  const iconImg = R.getImg(`assets/ui/${iconName}.png`)
  if (iconImg && iconImg.width > 0) {
    c.drawImage(iconImg, x, cy, iconSz, iconSz)
  }
  c.textAlign = 'left'; c.textBaseline = 'middle'
  c.fillStyle = labelColor; c.font = `bold ${11*S}px "PingFang SC",sans-serif`
  c.fillText(label, x + iconSz + 6 * S, cy + iconSz / 2)
  c.fillStyle = valueColor; c.font = `bold ${12*S}px "PingFang SC",sans-serif`
  c.textAlign = 'right'
  c.fillText(value, x + innerW, cy + iconSz / 2)
}

// ===== 新手庆祝全屏（灵宠 + 法宝同一队列逐页展示） =====
function _drawNewbiePetCelebration(g, c, R, W, H, S, safeTop) {
  const cel = g._newbiePetCelebrate
  const queue = cel && cel.queue
  if (!cel || !queue || queue.length === 0) { g._newbiePetCelebrate = null; return }
  cel.timer++
  cel.alpha = Math.min(1, cel.timer / 20)
  g._dirty = true

  const idx = cel.currentIdx || 0
  const item = queue[idx]
  if (!item) { g._newbiePetCelebrate = null; return }

  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  const centerY = H * 0.38
  drawCelebrationBackdrop(c, W, H, S, centerY, cel.timer, cel.alpha)

  c.save()
  c.globalAlpha = cel.alpha
  c.fillStyle = 'rgba(255,240,200,0.06)'
  c.fillRect(0, 0, W, H)
  c.textAlign = 'center'; c.textBaseline = 'middle'

  if (queue.length > 1) {
    c.fillStyle = 'rgba(200,170,80,0.85)'
    c.font = `${11 * S}px "PingFang SC",sans-serif`
    c.fillText(`${idx + 1} / ${queue.length}`, W / 2, safeTop + 62 * S)
  }

  if (item.kind === 'weapon') {
    c.fillStyle = '#FFF5E0'
    c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
    _strokeText(c, '恭喜获得法宝', W / 2, safeTop + 40 * S, 'rgba(55,35,18,0.5)', 3 * S)

    const w = getWeaponById(item.id)
    const bounceProgress = Math.min(1, cel.timer / 25)
    const bounce = bounceProgress < 1
      ? (1 + 0.2 * Math.sin(bounceProgress * Math.PI))
      : (1 + 0.03 * Math.sin(cel.timer * 0.06))
    const iconSz = 130 * S * bounce
    const iconX = (W - iconSz) / 2
    const iconY = centerY - iconSz / 2 - 6 * S
    _drawPedestalCloud(c, R, S, W / 2, iconY + iconSz, iconSz * 1.2)

    const fabaoPath = `assets/equipment/fabao_${item.id}.png`
    R.drawCoverImg(R.getImg(fabaoPath), iconX, iconY, iconSz, iconSz, { radius: 16 * S, shadow: 'rgba(180,130,40,0.5)', shadowBlur: 16, strokeStyle: '#c9a227', strokeWidth: 3 })

    const nameY = iconY + iconSz + 30 * S
    c.fillStyle = '#B8860B'
    c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
    _strokeText(c, w ? w.name : item.id, W / 2, nameY, 'rgba(0,0,0,0.3)', 3 * S)

    const msgY = nameY + 32 * S
    c.fillStyle = 'rgba(90,70,40,0.9)'
    c.font = `${13 * S}px "PingFang SC",sans-serif`
    const desc = w && w.desc ? w.desc : '战斗中获得属性加成'
    c.fillText(desc, W / 2, msgY)
    c.fillStyle = 'rgba(120,90,50,0.85)'
    c.font = `bold ${14 * S}px "PingFang SC",sans-serif`
    _strokeText(c, '已自动装备，下一场战斗即可生效', W / 2, msgY + 26 * S, 'rgba(0,0,0,0.2)', 2 * S)
  } else {
    const petId = item.id
    const pet = getPetById(petId)
    if (!pet) { g._newbiePetCelebrate = null; return }

    c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
    _strokeText(c, '恭喜获得', W / 2, safeTop + 40 * S, 'rgba(55,35,18,0.5)', 3 * S)

    const bounceProgress = Math.min(1, cel.timer / 25)
    const bounce = bounceProgress < 1
      ? (1 + 0.2 * Math.sin(bounceProgress * Math.PI))
      : (1 + 0.03 * Math.sin(cel.timer * 0.06))
    const avatarSize = 130 * S * bounce
    const avatarX = (W - avatarSize) / 2
    const avatarY = centerY - avatarSize / 2 - 6 * S

    _drawPedestalCloud(c, R, S, W / 2, avatarY + avatarSize, avatarSize * 1.2)
    const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
    const rkNewbie = getPetRarity(petId)
    const spotRv = _spotlightRarityTag(rkNewbie, pet.attr)
    _drawRarityDiamondBadge(c, S, avatarX + 10 * S, avatarY + 20 * S, spotRv.rv, spotRv.tag)

    c.save()
    c.translate(avatarX + avatarSize - 8 * S, avatarY - 4 * S)
    c.rotate(-0.2)
    c.fillStyle = 'rgba(180,120,20,0.95)'
    R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.fill()
    c.strokeStyle = 'rgba(255,240,200,0.75)'; c.lineWidth = 1 * S
    R.rr(-18 * S, -7 * S, 36 * S, 14 * S, 3 * S); c.stroke()
    c.fillStyle = '#FFF8E0'
    c.font = `bold ${9 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('New', 0, 0)
    c.restore()

    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    R.drawCoverImg(R.getImg(avatarPath), avatarX, avatarY, avatarSize, avatarSize, { radius: 16 * S, shadow: ac.main, shadowBlur: 20, strokeStyle: ac.main, strokeWidth: 3 })

    const nameY = avatarY + avatarSize + 30 * S
    c.fillStyle = ac.main
    c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
    _strokeText(c, pet.name, W / 2, nameY, 'rgba(0,0,0,0.3)', 3 * S)

    const msgY = nameY + 32 * S
    c.fillStyle = ac.lt || ac.main
    c.font = `bold ${16 * S}px "PingFang SC",sans-serif`
    c.save()
    c.shadowColor = rgbaFromHex(ac.main, 0.55)
    c.shadowBlur = 6 * S
    _strokeText(c, '正式加入你的队伍！', W / 2, msgY, 'rgba(0,0,0,0.35)', 3 * S)
    c.restore()

    const _ATTR_DESC = { metal: '消除金色灵珠时发动攻击', wood: '消除绿色灵珠时发动攻击', water: '消除蓝色灵珠时发动攻击', fire: '消除红色灵珠时发动攻击', earth: '消除棕色灵珠时发动攻击' }
    c.fillStyle = 'rgba(90,70,40,0.8)'
    c.font = `${12 * S}px "PingFang SC",sans-serif`
    c.fillText(_ATTR_DESC[pet.attr] || '战斗中为你冲锋陷阵', W / 2, msgY + 28 * S)
  }

  const blinkAlpha = 0.35 + 0.3 * Math.sin(Date.now() * 0.004)
  c.globalAlpha = cel.alpha * blinkAlpha
  c.fillStyle = '#8B7355'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  const tipText = idx < queue.length - 1 ? '点击查看下一项奖励' : '点击屏幕继续'
  c.fillText(tipText, W / 2, H - safeTop - 40 * S)

  c.restore()
}

// ===== 新手队伍总览卡（多只宠物横排 + 属性珠色标） =====
function _drawNewbieTeamOverview(g, c, R, W, H, S, safeTop) {
  const overview = g._newbieTeamOverview
  if (!overview) return
  overview.timer++
  overview.alpha = Math.min(1, overview.timer / 20)
  g._dirty = true

  // 背景
  const poolBg = R.getImg('assets/backgrounds/petpool_bg.jpg')
  if (poolBg && poolBg.width > 0) {
    R._drawCoverImg(poolBg, 0, 0, W, H)
  } else {
    R.drawHomeBg(0)
  }

  c.save()
  c.globalAlpha = overview.alpha

  // 暖色叠加
  c.fillStyle = 'rgba(255,240,200,0.12)'
  c.fillRect(0, 0, W, H)

  // 标题
  const titleY = safeTop + 60 * S
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#FFD700'
  c.font = `bold ${20 * S}px "PingFang SC",sans-serif`
  c.save()
  c.shadowColor = 'rgba(120,80,0,0.7)'; c.shadowBlur = 8 * S
  _strokeText(c, '你的初始队伍', W / 2, titleY, 'rgba(0,0,0,0.3)', 3 * S)
  c.restore()

  // 副标题
  c.fillStyle = 'rgba(90,70,40,0.8)'
  c.font = `${13 * S}px "PingFang SC",sans-serif`
  c.fillText('消除对应颜色灵珠，灵宠就会攻击', W / 2, titleY + 28 * S)

  const weaponIdsOv = overview.weapons || []
  let yCursor = titleY + 50 * S
  if (weaponIdsOv.length > 0) {
    c.fillStyle = 'rgba(100,75,35,0.9)'
    c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    c.fillText('法宝（已装备，编队中可更换）', W / 2, yCursor)
    yCursor += 22 * S
    const wGap = 20 * S
    const wIcon = 48 * S
    const wTotal = weaponIdsOv.length * wIcon + (weaponIdsOv.length - 1) * wGap
    let wx = (W - wTotal) / 2
    weaponIdsOv.forEach(wid => {
      const w = getWeaponById(wid)
      const fabaoPath = `assets/equipment/fabao_${wid}.png`
      R.drawCoverImg(R.getImg(fabaoPath), wx, yCursor, wIcon, wIcon, { radius: 8 * S, strokeStyle: '#c9a227', strokeWidth: 1.5 })
      c.fillStyle = '#5a4020'
      c.font = `${9 * S}px "PingFang SC",sans-serif`
      c.fillText(w ? w.name : wid, wx + wIcon / 2, yCursor + wIcon + 12 * S)
      wx += wIcon + wGap
    })
    yCursor += wIcon + 36 * S
  }

  const pets = (overview.pets || []).map(id => getPetById(id)).filter(Boolean)
  let cardW = 80 * S
  let gap = 16 * S
  const n = pets.length
  let totalCardsW = n * cardW + (n > 0 ? (n - 1) * gap : 0)
  if (n > 0 && totalCardsW > W * 0.9) {
    gap = Math.max(8 * S, gap * 0.7)
    cardW = (W * 0.9 - (n - 1) * gap) / n
    totalCardsW = n * cardW + (n - 1) * gap
  }
  const startX = (W - totalCardsW) / 2
  const cardTopY = yCursor + 8 * S

  const _ATTR_LABEL = { metal: '金', wood: '木', earth: '土', water: '水', fire: '火' }

  pets.forEach((pet, i) => {
    const delay = 10 + i * 12
    const petAlpha = Math.min(1, Math.max(0, (overview.timer - delay) / 15))
    c.save()
    c.globalAlpha = overview.alpha * petAlpha

    const cx = startX + i * (cardW + gap) + cardW / 2
    const cy = cardTopY

    // 头像
    const avatarSize = 68 * S
    const ax = cx - avatarSize / 2
    const ay = cy
    const avatarPath = getPetAvatarPath({ ...pet, star: 1 })
    const ac = ATTR_COLOR[pet.attr] || ATTR_COLOR.metal
    R.drawCoverImg(R.getImg(avatarPath), ax, ay, avatarSize, avatarSize, { radius: 10 * S, shadow: ac.main, shadowBlur: 8, strokeStyle: ac.main, strokeWidth: 2 })

    // 宠物名称
    c.fillStyle = ac.main
    c.font = `bold ${12 * S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(pet.name, cx, ay + avatarSize + 16 * S)

    // 对应属性灵珠示意（小圆球）
    const orbY = ay + avatarSize + 36 * S
    const orbR = 10 * S
    c.beginPath(); c.arc(cx, orbY, orbR, 0, Math.PI * 2)
    const orbGrad = c.createRadialGradient(cx - orbR * 0.3, orbY - orbR * 0.3, 0, cx, orbY, orbR)
    orbGrad.addColorStop(0, ac.lt || ac.main)
    orbGrad.addColorStop(1, ac.dk || ac.main)
    c.fillStyle = orbGrad; c.fill()
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1.2 * S; c.stroke()

    // 属性标签
    c.fillStyle = '#5a4020'
    c.font = `${10 * S}px "PingFang SC",sans-serif`
    c.fillText(`消${_ATTR_LABEL[pet.attr] || '金'}珠攻击`, cx, orbY + orbR + 14 * S)

    c.restore()
  })

  // 底部提示
  const blinkAlpha = 0.35 + 0.3 * Math.sin(Date.now() * 0.004)
  c.globalAlpha = overview.alpha * blinkAlpha
  c.fillStyle = '#8B7355'
  c.font = `${11 * S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'
  c.fillText('点击屏幕继续', W / 2, H - safeTop - 40 * S)

  c.restore()
}

// ===== 触摸 =====
function tStageResult(g, x, y, type) {
  const result = g._stageResult
  if (!result) return

  // 新手流程仅处理抬起
  if (g._newbiePetCelebrate || g._newbieTeamOverview) {
    if (type !== 'end') return
  }

  // 新手庆祝阶段：灵宠 + 法宝同一队列，最后一项后切到团队概览卡
  if (g._newbiePetCelebrate) {
    const cel = g._newbiePetCelebrate
    const idx = cel.currentIdx || 0
    const q = cel.queue || []
    if (idx < q.length - 1) {
      cel.currentIdx = idx + 1
      cel.timer = 0; cel.alpha = 0
    } else {
      const petIds = q.filter(x => x.kind === 'pet').map(x => x.id)
      const weapons = q.filter(x => x.kind === 'weapon').map(x => x.id)
      g._newbiePetCelebrate = null
      g._newbieTeamOverview = { pets: petIds, weapons, alpha: 0, timer: 0 }
    }
    _animTimer = 0
    g._dirty = true
    return
  }

  // 新手队伍总览卡（仅 1-3 首通触发：集中展示 5 只灵宠后引导养成）
  if (g._newbieTeamOverview) {
    g._newbieTeamOverview = null
    if (result && result.victory && result.isFirstClear && result.stageId === 'stage_1_3') {
      g._stageIdxInitialized = false
      g.setScene('petPool')
      return
    }
    _animTimer = 0
    g._dirty = true
    return
  }

  const canScroll = result.victory && _victoryRewardViewport && _victoryRewardScrollMax > 0
  if (canScroll) {
    if (type === 'start') {
      if (g._hitRect(x, y, ..._victoryRewardViewport)) {
        _victScrollActive = true
        _victScrollStartY = y
        _victScrollLastY = y
        _victScrollMoved = false
      } else {
        _victScrollActive = false
      }
      return
    }
    if (type === 'move' && _victScrollActive) {
      const dy = y - _victScrollLastY
      _victScrollLastY = y
      if (Math.abs(y - _victScrollStartY) > 6 * V.S) _victScrollMoved = true
      _victoryRewardScroll -= dy
      if (_victoryRewardScroll < 0) _victoryRewardScroll = 0
      if (_victoryRewardScroll > _victoryRewardScrollMax) _victoryRewardScroll = _victoryRewardScrollMax
      return
    }
    if (type === 'end') {
      if (_victScrollActive && _victScrollMoved) {
        _victScrollActive = false
        _victScrollMoved = false
        return
      }
      _victScrollActive = false
      _victScrollMoved = false
    }
  } else if (type !== 'end') {
    return
  }

  if (type !== 'end') return

  // 失败建议条跳转
  if (_rects.tipRects && !result.victory) {
    for (const tr of _rects.tipRects) {
      if (g._hitRect(x, y, ...tr.rect)) {
        MusicMgr.playClick && MusicMgr.playClick()
        if (tr.action === 'petPool') { g.setScene('petPool'); return }
        if (tr.action === 'cultivation') { g.setScene('cultivation'); return }
        if (tr.action === 'stageTeam') {
          g._selectedStageId = tr.stageId
          // 失败跳到编队页前先把"当前已保存编队"灌入选中列表，
          // 否则 stageTeamView 会看到空的 _stageTeamSelected，
          // 玩家进入后会误以为"全体被清空"。
          g._stageTeamSelected = g.storage.getValidSavedTeam().slice()
          g._stageTeamFilter = 'all'
          g.setScene('stageTeam')
          return
        }
      }
    }
  }

  // 看广告退还体力（失败）
  if (_rects.staminaRefundBtnRect && g._hitRect(x, y, ..._rects.staminaRefundBtnRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('staminaRefund', {
      fallbackToShare: true,
      onRewarded: () => {
        const r = g._stageResult
        if (!r || r.staminaRefunded) return
        r.staminaRefunded = true
        const cost = r.staminaCost || 0
        if (cost > 0) g.storage.addBonusStamina(cost)
        g._dirty = true
      },
      rewardPopup: () => {
        const r = g._stageResult
        if (!r || !r.staminaRefunded) return null
        const cost = r.staminaCost || 0
        if (cost <= 0) return null
        return {
          title: '体力已退还',
          subtitle: '失败不扣体力',
          lines: [{ icon: 'icon_stamina', label: '体力', amount: '+' + cost }],
        }
      },
    })
    return
  }

  const _firstClearGuide = _getFirstClearGuide(result)

  // 胜利结算页尾部"下一里程碑"条：点击跳章节主线页
  if (_rects.goalTailBtnRect && g._hitRect(x, y, ..._rects.goalTailBtnRect)) {
    g.setScene('chapterMap')
    return
  }
  if (_rects.goalTailRect && g._hitRect(x, y, ..._rects.goalTailRect)) {
    g.setScene('chapterMap')
    return
  }

  // 看广告翻倍（仅 Boss 关胜利）
  if (_rects.adDoubleBtnRect && g._hitRect(x, y, ..._rects.adDoubleBtnRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    AdManager.showRewardedVideo('settleDouble', {
      fallbackToShare: true,
      onRewarded: () => {
        g._stageSettleAdJustGranted = false
        const r = g._stageResult
        if (!r || r.adDoubled) return
        r.adDoubled = true
        const bonusSS = r.soulStone || 0
        if (bonusSS > 0) g.storage.addSoulStone(bonusSS)
        // 碎片翻倍：对掉落碎片再发一份
        const fragRewards = (r.rewards || []).filter(rw => rw.type === 'fragment' && rw.petId && !rw.fromStar)
        fragRewards.forEach(rw => {
          g.storage.addFragments(rw.petId, rw.count || 0)
        })
        g._stageSettleAdJustGranted = bonusSS > 0 || fragRewards.length > 0
        g._dirty = true
      },
      rewardPopup: () => {
        if (!g._stageSettleAdJustGranted) return null
        g._stageSettleAdJustGranted = false
        const r = g._stageResult
        const ss = r && r.soulStone ? r.soulStone : 0
        const frag = r && r.totalFragCount ? r.totalFragCount : 0
        if (ss <= 0 && frag <= 0) return null
        const lines = []
        if (ss > 0) lines.push({ icon: 'icon_soul_stone', label: '灵石', amount: '+' + ss })
        if (frag > 0) lines.push({ icon: 'icon_fragment', label: '碎片', amount: '+' + frag })
        return {
          title: '奖励翻倍',
          subtitle: 'Boss 关额外奖励',
          lines,
        }
      },
    })
    return
  }

  if (_rects.shareBtnRect && g._hitRect(x, y, ..._rects.shareBtnRect)) {
    // 主动分享：走邀请型专用场景 activeStageShare（胜/败/首通/重玩都复用）
    //   · 胜利 + 首通还会额外触发 shareHooks.onFirstSRating 等被动卡（方案 A 后章≥2 才触发）
    //   · 主动点击不受里程碑 flag 限制，可反复点（奖励有 24h 场景冷却保护）
    const { shareCore } = require('../share')
    const stage = getStageById(result.stageId)
    shareCore(g, 'activeStageShare', {
      victory: !!result.victory,
      stageName: stage ? stage.name : '',
      rating: result.victory ? (result.rating || '') : '',
    }, { mode: 'friend' })
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  if (_rects.backBtnRect && g._hitRect(x, y, ..._rects.backBtnRect)) {
    if (_firstClearGuide) {
      g._pendingGuide = _firstClearGuide
      g.setScene('title')
    } else {
      g.setScene('title')
    }
    MusicMgr.playClick && MusicMgr.playClick()
    return
  }

  if (_rects.nextBtnRect && g._hitRect(x, y, ..._rects.nextBtnRect)) {
    MusicMgr.playClick && MusicMgr.playClick()
    // 主推 CTA：金光爆点 —— 让"再次挑战 / 下一关"那一下有打击感
    buttonFx.trigger(_rects.nextBtnRect.slice(), 'upgrade')
    // 新手前 2 关首通：直接进入下一关战斗，不经过选关/编队
    if (result.victory && result.isFirstClear
        && (result.stageId === 'stage_1_1' || result.stageId === 'stage_1_2')) {
      const nextId = getNextStageId(result.stageId)
      if (nextId) {
        const stageMgr = require('../engine/stageManager')
        const teamIds = g.storage.petPool.map(p => p.id)
        stageMgr.startStage(g, nextId, teamIds)
        return
      }
    }
    if (_firstClearGuide) {
      g._pendingGuide = _firstClearGuide
      g.setScene('title')
    } else {
      const nextId = result.victory ? getNextStageId(result.stageId) : null
      const hasNext = nextId && isStageUnlocked(nextId, g.storage.stageClearRecord, g.storage.petPoolCount)
      if (hasNext) {
        g._selectedStageId = nextId
        g._stageInfoEnemyDetail = null
        g.setScene('stageInfo')
      } else {
        g._selectedStageId = result.stageId
        g._stageInfoEnemyDetail = null
        g.setScene('stageInfo')
      }
    }
    return
  }
}

// 1-3 首通胜利时，返回首页并触发养成引导（1-1/1-2 由结算页直接进下一关，无需引导）
function _getFirstClearGuide(result) {
  if (!result || !result.victory || !result.isFirstClear) return null
  if (result.stageId === 'stage_1_3') return 'newbie_team_ready'
  return null
}

module.exports = { rStageResult, tStageResult }
