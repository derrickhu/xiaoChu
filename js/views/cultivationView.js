/**
 * 修炼洞府界面 — 放射型天赋星盘
 * 中央修炼者头像 + 5 个属性节点环绕 + 灵气连线
 *
 * 渲染函数拆分到 cultivationDraw.js，本文件负责布局组装、状态管理和触摸处理
 */
const V = require('./env')
const P = require('../platform')
const { drawPanel, drawRibbonIcon, drawLingCard, wrapText } = require('./uiComponents')
const { LING } = require('../data/lingIdentity')
const {
  CULT_CONFIG, CULT_KEYS, MAX_LEVEL, expToNextLevel,
  effectValue, usedPoints, currentRealm, nextRealm,
} = require('../data/cultivationConfig')
const MusicMgr = require('../runtime/music')
const { drawBottomBar, getLayout, drawPageTitle } = require('./bottomBar')
const Draw = require('./cultivationDraw')
const floatText = require('./floatText')
const lingCheer = require('./lingCheer')

// 可选角色形象列表
// avatar 为 fallback 头像（打坐图加载失败时使用），暂统一用已有资源占位
const _defaultAvatar = 'assets/hero/hero_cultivation.jpg'
// unlocked 字段为静态默认值，实际解锁状态在渲染时从 storage.unlockedAvatars 动态合并
const CHARACTERS = [
  { id: 'boy1',  label: '修仙少年',  sit: 'assets/hero/char_boy1.png',  avatar: _defaultAvatar, unlockHint: null },
  { id: 'girl1', label: '灵木仙子',  sit: 'assets/hero/char_girl1.png', avatar: _defaultAvatar, unlockHint: null },
  { id: 'boy2',  label: '剑灵少侠',  sit: 'assets/hero/char_boy2.png',  avatar: _defaultAvatar, unlockHint: '修炼5级奖励解锁' },
  { id: 'girl2', label: '星月仙子',  sit: 'assets/hero/char_girl2.png', avatar: _defaultAvatar, unlockHint: '修炼10级奖励解锁' },
  { id: 'boy3',  label: '天罡道童',  sit: 'assets/hero/char_boy3.png',  avatar: _defaultAvatar, unlockHint: '敬请期待' },
  { id: 'girl3', label: '花灵仙子',  sit: 'assets/hero/char_girl3.png', avatar: _defaultAvatar, unlockHint: '敬请期待' },
]

/** 将 CHARACTERS 与 storage 解锁状态合并，返回带 unlocked 字段的列表 */
function _buildCharacters(g) {
  const unlocked = g.storage.unlockedAvatars
  return CHARACTERS.map(ch => ({ ...ch, unlocked: unlocked.includes(ch.id) }))
}

// ===== 交互状态（统一管理） =====
const _state = {
  selectedNode: null,      // 当前展开详情的节点 key
  showAvatarPanel: false,  // 形象选择面板
  upgradeFlash: null,      // { key, timer }
  realmBreakAnim: null,    // { name, timer, duration }
  animFrame: 0,            // 全局动画帧计数
  upgradeAmount: 1,        // 当前面板选择的加点数量
  cultIntro: null,         // { page: 0|1, alpha: 0~1 } 首次进入介绍卡
}

// ===== 修炼介绍卡内容（小灵讲解口吻） =====
const _CULT_INTRO_CARDS = [
  {
    subLabel: '第 1/2 课 · 什么是修炼',
    title: '修炼是你自己的道行',
    lines: [
      '主人～ 修炼积攒的是你自身的道行，',
      '不管是通天塔、灵兽秘境还是别的挑战，',
      '每一局都会为你积累修炼经验哦！',
    ],
    note: '☆ 胜负皆有收获，每一局都在成长',
  },
  {
    subLabel: '第 2/2 课 · 修炼与通天塔',
    title: '修炼和通天塔的关系',
    lines: [
      '通天塔里是"修炼全无"的考验，',
      '只能靠主人自己的基本功；',
      '但修炼加成在灵兽秘境里可是全开的——',
      '体、灵、悟、根、识，五维齐飞！',
    ],
    note: '✦ 先把修炼打扎实，小灵陪你征服秘境～',
  },
]

// 模块级触摸区域（不挂到 g 上，减少全局属性污染）
const _rects = {
  nodePositions: null,     // { key: { x, y, angle } }
  nodeR: 28,               // 节点半径（S单位前）
  avatarCenter: null,      // { x, y, r } 打坐角色触摸区域
  detailBtnRect: null,     // [x, y, w, h] 升级按钮
  detailPanelRect: null,   // [x, y, w, h] 详情面板
  detailMinusRect: null,   // [x, y, w, h] 减号按钮
  detailPlusRect: null,    // [x, y, w, h] 加号按钮
  detailMaxRect: null,     // [x, y, w, h] 加满按钮
  avatarRects: [],         // [{ id, rect, unlocked }] 角色选择卡片
  avatarPanelRect: null,   // [x, y, w, h] 角色选择面板
}

function resetState() {
  _state.selectedNode = null
  _state.showAvatarPanel = false
  _state.upgradeFlash = null
  _state.upgradeAmount = 1
}

function _getCharacter(g) {
  const selectedId = g.storage.selectedAvatar
  const chars = _buildCharacters(g)
  return chars.find(a => a.id === selectedId) || chars[0]
}

// ===== 主渲染 =====
function rCultivation(g) {
  const { ctx: c, R, TH, W, H, S, safeTop } = V
  const cult = g.storage.cultivation
  if (cult.level == null) cult.level = 0
  if (cult.skillPoints == null) cult.skillPoints = 0
  _state.animFrame++

  // 背景
  Draw.drawBackground(c, R, W, H, S, _state.animFrame)

  // 顶部栏
  const topH = 44 * S
  const topY = safeTop + 16*S

  drawPageTitle(c, R, W, S, W * 0.5, topY + topH * 0.5, '修炼洞府')

  // 境界 + 等级
  const realm = currentRealm(cult.level)
  const infoY = topY + topH + 4*S

  c.save()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.fillStyle = '#8B6914'
  c.font = `bold ${16*S}px "PingFang SC",sans-serif`
  c.shadowColor = 'rgba(212,168,67,0.3)'; c.shadowBlur = 6*S
  c.fillText(`「${realm.name}」 Lv.${cult.level}`, W * 0.5, infoY + 12*S)
  c.shadowBlur = 0
  c.restore()

  // 经验条
  const expBarY = infoY + 26*S
  const expBarW = W * 0.6
  const expBarH = 14*S
  const expBarX = (W - expBarW) / 2
  const expBarCY = expBarY + expBarH / 2

  c.fillStyle = 'rgba(0,0,0,0.12)'
  Draw.roundRect(c, expBarX, expBarY, expBarW, expBarH, expBarH/2)
  c.fill()

  if (cult.level < MAX_LEVEL) {
    const needed = expToNextLevel(cult.level)
    const pct = Math.min(cult.exp / needed, 1)
    if (pct > 0) {
      const fillW = Math.max(expBarH, expBarW * pct)
      const grad = c.createLinearGradient(expBarX, expBarY, expBarX + fillW, expBarY)
      grad.addColorStop(0, '#d4a843'); grad.addColorStop(1, '#f0c860')
      c.fillStyle = grad
      Draw.roundRect(c, expBarX, expBarY, fillW, expBarH, expBarH/2)
      c.fill()
    }
    c.save()
    c.fillStyle = '#6a4a18'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`${cult.exp} / ${needed}`, W * 0.5, expBarCY)
    c.restore()
  } else {
    const grad = c.createLinearGradient(expBarX, expBarY, expBarX + expBarW, expBarY)
    grad.addColorStop(0, '#d4a843'); grad.addColorStop(1, '#f0c860')
    c.fillStyle = grad
    Draw.roundRect(c, expBarX, expBarY, expBarW, expBarH, expBarH/2)
    c.fill()
    c.save()
    c.fillStyle = '#5a3a10'
    c.font = `bold ${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText('已满级', W * 0.5, expBarCY)
    c.restore()
  }

  // 经验图标（压在经验条左端上方）
  const cultExpIcon = R.getImg('assets/ui/icon_cult_exp.png')
  if (cultExpIcon && cultExpIcon.width > 0) {
    const iconSz = 28 * S
    const iconX = expBarX - iconSz * 0.5
    const iconY = expBarCY - iconSz / 2
    c.drawImage(cultExpIcon, iconX, iconY, iconSz, iconSz)
  }

  // 修炼点
  const pts = cult.skillPoints || 0
  const ptsY = expBarY + expBarH + 6*S
  c.save()
  c.textAlign = 'center'; c.textBaseline = 'middle'
  if (pts > 0) {
    c.fillStyle = '#8B6914'
    c.font = `bold ${13*S}px "PingFang SC",sans-serif`
    c.shadowColor = 'rgba(212,168,67,0.3)'; c.shadowBlur = 4*S
    c.fillText(`可用修炼点：${pts}`, W * 0.5, ptsY + 8*S)
    c.shadowBlur = 0
  } else {
    c.fillStyle = '#9a8a6a'
    c.font = `${11*S}px "PingFang SC",sans-serif`
    c.fillText('修炼点：0（升级后获得）', W * 0.5, ptsY + 8*S)
  }
  // 下次境界突破提示
  const nr = nextRealm(cult.level)
  if (nr) {
    c.fillStyle = '#9a8a6a'
    c.font = `${10*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`下次境界突破：Lv.${nr.minLv}「${nr.name}」`, W * 0.5, ptsY + 22*S)
  }
  c.restore()

  // 放射型星盘
  const chartTop = ptsY + (nr ? 34 : 20)*S
  const chartBottom = H - 30*S
  const chartCenterX = W * 0.5
  const chartCenterY = chartTop + (chartBottom - chartTop) * 0.38
  const avatarR = 38*S
  const orbitR = Math.min(W * 0.40, (chartBottom - chartTop) * 0.40)
  const nodeR = 28*S

  // 计算节点位置
  const nodePositions = {}
  for (let i = 0; i < CULT_KEYS.length; i++) {
    const key = CULT_KEYS[i]
    const angle = -Math.PI / 2 + i * (Math.PI * 2 / 5)
    nodePositions[key] = {
      x: chartCenterX + Math.cos(angle) * orbitR,
      y: chartCenterY + Math.sin(angle) * orbitR,
      angle,
    }
  }
  _rects.nodePositions = nodePositions
  _rects.nodeR = nodeR

  // 灵气连线
  Draw.drawEnergyLines(c, chartCenterX, chartCenterY, avatarR, nodePositions, orbitR, nodeR, S, cult, _state.animFrame)

  // 法阵特效
  Draw.drawFormation(c, chartCenterX, chartCenterY, orbitR, S, cult, _state.animFrame)

  // 属性节点
  for (const key of CULT_KEYS) {
    const pos = nodePositions[key]
    const cfg = CULT_CONFIG[key]
    const lv = cult.levels[key]
    const isMax = lv >= cfg.maxLv
    const canUpgrade = !isMax && pts > 0
    const isSelected = _state.selectedNode === key
    Draw.drawNode(c, pos.x, pos.y, nodeR, key, lv, cfg, isMax, canUpgrade, isSelected, S, _state.animFrame)
  }

  // 中央打坐角色
  const ch = _getCharacter(g)
  Draw.drawAvatar(g, c, R, chartCenterX, chartCenterY, avatarR, S, cult.level, H, ch, _state.animFrame)

  // 记录打坐角色触摸区域
  const charPlatformY = H * 0.76
  const charTouchCenterY = charPlatformY - avatarR * 2.0
  _rects.avatarCenter = { x: chartCenterX, y: charTouchCenterY, r: avatarR * 2.0 }

  // 左上角属性加成面板
  if (!_state.selectedNode && !_state.showAvatarPanel) {
    _drawStatsSummary(c, S, chartTop, cult)
  }

  // 详情面板
  if (_state.selectedNode) {
    Draw.drawDetailPanel(c, W, H, S, _state.selectedNode, cult, pts, _rects, _state.animFrame, _state.upgradeAmount)
  }

  // 形象选择面板
  if (_state.showAvatarPanel) {
    Draw.drawAvatarPanel(g, c, R, W, H, S, _buildCharacters(g), _rects)
  }

  // 升级闪光
  if (_state.upgradeFlash && _state.upgradeFlash.timer > 0) {
    const pos = nodePositions[_state.upgradeFlash.key]
    if (pos) {
      c.save()
      c.globalAlpha = _state.upgradeFlash.timer / 20 * 0.6
      c.fillStyle = '#FFD700'
      c.beginPath()
      c.arc(pos.x, pos.y, nodeR + 6*S, 0, Math.PI * 2)
      c.fill()
      c.restore()
    }
    _state.upgradeFlash.timer--
  }

  // 底部导航栏
  drawBottomBar(g)

  // 境界突破动画
  if (_state.realmBreakAnim && _state.realmBreakAnim.timer < _state.realmBreakAnim.duration) {
    Draw.drawRealmBreak(c, W, H, S, _state.realmBreakAnim)
    _state.realmBreakAnim.timer++
  }

  // 首次进入修炼介绍卡
  if (_state.cultIntro) {
    _drawCultIntro(c, R, g, W, H, S)
  }
}

// ===== 修炼介绍卡渲染（小灵讲解 · 卷轴 drawLingCard 版）=====
function _drawCultIntro(c, R, g, W, H, S) {
  const intro = _state.cultIntro
  if (!intro) return
  intro.alpha = Math.min(1, (intro.alpha || 0) + 0.08)
  g._dirty = true

  const card = _CULT_INTRO_CARDS[intro.page]
  if (!card) return

  c.save()
  // 背后暗遮罩
  c.globalAlpha = intro.alpha * 0.72
  c.fillStyle = '#000'
  c.fillRect(0, 0, W, H)
  c.globalAlpha = intro.alpha

  // 根据文本行数动态估算卡高（wrap 后）
  const pw = Math.min(W - 32 * S, 360 * S)
  const bodyFs = 14 * S
  const lineH = 26 * S
  const textMaxW = pw - 40 * S
  c.font = `${bodyFs}px "PingFang SC",sans-serif`
  const lines = []
  ;(card.lines || []).forEach(line => {
    wrapText(c, line, textMaxW).forEach(l => lines.push(l))
  })
  const headerH = 50 * S   // 头像 + 分隔线
  const titleH = 46 * S
  const bodyH = lines.length * lineH
  const noteH = card.note ? 30 * S : 0
  const footerH = 46 * S
  const ph = headerH + titleH + bodyH + noteH + footerH
  const px = (W - pw) / 2
  const py = (H - ph) / 2 - 10 * S

  drawLingCard(c, S, px, py, pw, ph, {
    avatarImg: V.R.getImg(LING.avatar),
    speaker: LING.speaker,
    subLabel: card.subLabel,
    title: card.title,
    lines,
    note: card.note,
    fontSizeBody: bodyFs,
    lineH,
    pageIdx: intro.page,
    totalPages: _CULT_INTRO_CARDS.length,
    continueText: intro.page >= _CULT_INTRO_CARDS.length - 1 ? '点击进入修炼 ›' : '点击继续 ›',
    animT: intro.alpha,
    pulseT: _state.animFrame * 0.1,
  })

  c.restore()
}

function _riRR(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ===== 境界突破检查 =====
function checkRealmBreak(g) {
  // 先尝试补升（经验表下调后旧存档可能有溢出经验未消化）
  g.storage._tryCultLevelUp()
  const cult = g.storage.cultivation
  const realm = currentRealm(cult.level)
  const { REALMS } = require('../data/cultivationConfig')
  const realmIdx = REALMS.indexOf(realm)
  if (realmIdx > cult.realmBreakSeen) {
    cult.realmBreakSeen = realmIdx
    g.storage._save()
    _state.realmBreakAnim = { name: realm.name, timer: 0, duration: 90 }
    MusicMgr.playLevelUp()
    // 境界突破：全屏仪式完成后由小灵横条补一句祝贺，把"仪式感"和"陪伴感"串起来
    lingCheer.show(LING.cheer.realmBreak(realm.name), { tone: 'epic', duration: 2600 })
  }
  // 首次进入修炼页：展示玩法介绍卡
  if (!g.storage.isGuideShown('cult_intro')) {
    _state.cultIntro = { page: 0, alpha: 0 }
  }
}

// ===== 触摸处理 =====
function tCultivation(g, x, y, type) {
  if (type !== 'end') return

  // 首次介绍卡拦截
  if (_state.cultIntro) {
    _state.cultIntro.page++
    _state.cultIntro.alpha = 0
    if (_state.cultIntro.page >= _CULT_INTRO_CARDS.length) {
      _state.cultIntro = null
      g.storage.markGuideShown('cult_intro')
    }
    return
  }

  // 境界突破动画中点击跳过
  if (_state.realmBreakAnim && _state.realmBreakAnim.timer < _state.realmBreakAnim.duration) {
    _state.realmBreakAnim.timer = _state.realmBreakAnim.duration
    return
  }

  // 形象选择面板
  if (_state.showAvatarPanel) {
    if (_rects.avatarRects) {
      for (const av of _rects.avatarRects) {
        if (av.rect && Draw.hitRect(x, y, av.rect)) {
          if (av.unlocked) {
            g.storage.setSelectedAvatar(av.id)
            _state.showAvatarPanel = false
          } else if (av.unlockHint) {
            P.showGameToast(av.unlockHint)
          }
          return
        }
      }
    }
    if (_rects.avatarPanelRect && Draw.hitRect(x, y, _rects.avatarPanelRect)) return
    _state.showAvatarPanel = false
    return
  }

  // 详情面板
  if (_state.selectedNode) {
    // 减号
    if (_rects.detailMinusRect && Draw.hitRect(x, y, _rects.detailMinusRect)) {
      if (_state.upgradeAmount > 1) _state.upgradeAmount--
      return
    }
    // 加号
    if (_rects.detailPlusRect && Draw.hitRect(x, y, _rects.detailPlusRect)) {
      const cult = g.storage.cultivation
      const cfg = CULT_CONFIG[_state.selectedNode]
      const maxAdd = Math.min(cfg.maxLv - cult.levels[_state.selectedNode], cult.skillPoints)
      if (_state.upgradeAmount < maxAdd) _state.upgradeAmount++
      return
    }
    // 加满
    if (_rects.detailMaxRect && Draw.hitRect(x, y, _rects.detailMaxRect)) {
      const cult = g.storage.cultivation
      const cfg = CULT_CONFIG[_state.selectedNode]
      _state.upgradeAmount = Math.min(cfg.maxLv - cult.levels[_state.selectedNode], cult.skillPoints)
      return
    }
    // 确认升级按钮
    if (_rects.detailBtnRect && Draw.hitRect(x, y, _rects.detailBtnRect)) {
      const nodeKey = _state.selectedNode
      const actual = g.storage.upgradeCultivation(nodeKey, _state.upgradeAmount)
      if (actual > 0) {
        MusicMgr.playLevelUp()
        _state.upgradeFlash = { key: nodeKey, timer: 20 }
        // 按钮爆点（金光 + 金星）+ 飘字，让玩家立刻看到"这次投入换回来了什么"
        const buttonFx = require('./buttonFx')
        buttonFx.trigger(_rects.detailBtnRect, 'upgrade')
        const cfg = CULT_CONFIG[nodeKey]
        if (cfg) {
          const delta = +(actual * cfg.perLv).toFixed(2)
          const btn = _rects.detailBtnRect
          if (btn) {
            const [bx, by, bw, bh] = btn
            floatText.spawn(bx + bw / 2, by + bh / 2, `${cfg.name} +${delta}`, {
              color: '#FFE080', size: 16, dy: -10,
            })
          }
        }
        checkRealmBreak(g)
        const cult = g.storage.cultivation
        if (cult.skillPoints <= 0 || cult.levels[_state.selectedNode] >= cfg.maxLv) {
          _state.selectedNode = null
          _state.upgradeAmount = 1
        } else {
          // 重新约束 upgradeAmount
          const newMax = Math.min(cfg.maxLv - cult.levels[_state.selectedNode], cult.skillPoints)
          _state.upgradeAmount = Math.min(_state.upgradeAmount, newMax)
        }
      }
      return
    }
    // 面板内其他区域不处理
    if (_rects.detailPanelRect && Draw.hitRect(x, y, _rects.detailPanelRect)) {
      return
    }
    // 面板外点击关闭
    _state.selectedNode = null
    _state.upgradeAmount = 1
    return
  }

  // 底部导航栏
  if (g._bottomBarRects) {
    const { BAR_ITEMS } = require('./bottomBar')
    const L = getLayout()
    if (y >= L.bottomBarY) {
      for (let i = 0; i < g._bottomBarRects.length; i++) {
        const rect = g._bottomBarRects[i]
        if (Draw.hitRect(x, y, rect)) {
          const item = BAR_ITEMS[i]
          if (item.locked) return
          _state.selectedNode = null
          _state.showAvatarPanel = false
          if (item.key === 'cultivation') return
          if (item.key === 'battle' || item.key === 'stage') { g.setScene('title'); return }
          if (item.key === 'pets') {
            if (g.storage.petPoolCount > 0) {
              g._petPoolFilter = 'all'; g._petPoolRarityFilter = 'all'; g._petPoolScroll = 0; g._petPoolDetail = null
              g.setScene('petPool')
            }
            return
          }
          if (item.key === 'dex') { g.setScene('dex'); return }
          if (item.key === 'weapons') {
            g._weaponPoolFilter = 'all'; g._weaponPoolScroll = 0; g._weaponPoolDetail = null
            g.setScene('weaponPool'); return
          }
          if (item.key === 'rank') { g._openRanking(); return }
          if (item.key === 'more') { g.setScene('title'); return }
          return
        }
      }
      return
    }
  }

  // 中央打坐角色点击
  if (_rects.avatarCenter) {
    const ac = _rects.avatarCenter
    const dx = x - ac.x, dy = y - ac.y
    if (dx*dx + dy*dy <= ac.r * ac.r) {
      _state.showAvatarPanel = true
      return
    }
  }

  // 节点点击
  if (_rects.nodePositions) {
    const nR = _rects.nodeR || 28 * V.S
    for (const key of CULT_KEYS) {
      const pos = _rects.nodePositions[key]
      if (!pos) continue
      const dx = x - pos.x, dy = y - pos.y
      if (dx*dx + dy*dy <= (nR + 8*V.S) * (nR + 8*V.S)) {
        _state.selectedNode = key
        _state.upgradeAmount = 1
        return
      }
    }
  }
}

// ===== 左上角属性加成面板 =====
// base: 灵兽秘境基础值, maxBonus: 修炼满级最大加成
const _STAT_ROWS = [
  { key: 'body',    label: 'HP',      color: '#E85050', icon: '体', base: 100, unit: '' },
  { key: 'sense',   label: '护盾',    color: '#A070D0', icon: '识', base: 0,   unit: '' },
  { key: 'spirit',  label: '心珠回复', color: '#50C878', icon: '灵', base: 12,  unit: '' },
  { key: 'defense', label: '减伤',    color: '#C89648', icon: '根', base: 0,   unit: '' },
  { key: 'wisdom',  label: '转珠',    color: '#5098E8', icon: '悟', base: 8,   unit: 's' },
]

function _drawStatsSummary(c, S, startY, cult) {
  const px = 6 * S
  const py = startY + 4 * S
  const rowH = 22 * S
  const panelW = 138 * S
  const panelH = _STAT_ROWS.length * rowH + 16 * S
  const rad = 8 * S

  c.save()
  c.fillStyle = 'rgba(30,20,10,0.5)'
  _riRR(c, px, py, panelW, panelH, rad)
  c.fill()

  const iconR = 7 * S
  const barW = 46 * S
  const barH = 7 * S
  const barX = px + 54 * S

  for (let i = 0; i < _STAT_ROWS.length; i++) {
    const row = _STAT_ROWS[i]
    const cfg = CULT_CONFIG[row.key]
    const lv = cult.levels[row.key] || 0
    const bonus = effectValue(row.key, lv)
    const maxBonus = effectValue(row.key, cfg.maxLv)
    const total = row.base + bonus
    const totalMax = row.base + maxBonus
    const ry = py + 8 * S + i * rowH
    const cy = ry + rowH / 2

    // 彩色圆形底色 + 白色图标文字
    const iconCx = px + 6 * S + iconR
    c.fillStyle = row.color + '90'
    c.beginPath()
    c.arc(iconCx, cy, iconR, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = '#fff'
    c.font = `bold ${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(row.icon, iconCx, cy)

    // 属性名
    const labelX = iconCx + iconR + 3 * S
    c.fillStyle = 'rgba(255,240,210,0.85)'
    c.font = `${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'
    c.fillText(row.label, labelX, cy)

    // 双色进度条：灰底 → 暗色(基础) → 亮色(加成)
    const barY = ry + (rowH - barH) / 2
    c.fillStyle = 'rgba(255,255,255,0.1)'
    _riRR(c, barX, barY, barW, barH, barH / 2)
    c.fill()

    if (totalMax > 0) {
      const basePct = row.base / totalMax
      const totalPct = total / totalMax
      // 基础值部分（该属性的浅色）
      if (basePct > 0) {
        const baseW = Math.max(barH, barW * basePct)
        c.fillStyle = row.color + '40'
        _riRR(c, barX, barY, baseW, barH, barH / 2)
        c.fill()
      }
      // 修炼加成部分（该属性的亮色，覆盖到总值位置）
      if (bonus > 0) {
        const totalW = Math.max(barH, barW * totalPct)
        c.fillStyle = row.color + 'C0'
        _riRR(c, barX, barY, totalW, barH, barH / 2)
        c.fill()
        // 基础部分用半透明白覆盖，使之比加成段更浅
        if (basePct > 0) {
          const baseW2 = Math.max(barH, barW * basePct)
          c.fillStyle = 'rgba(255,255,255,0.2)'
          _riRR(c, barX, barY, baseW2, barH, barH / 2)
          c.fill()
        }
      }
    }

    // 总数值 = 基础+加成
    const u = row.unit
    c.font = `${8*S}px "PingFang SC",sans-serif`
    c.textAlign = 'left'; c.textBaseline = 'middle'
    if (bonus > 0) {
      c.fillStyle = 'rgba(255,240,210,0.7)'
      const baseStr = `${row.base}${u}`
      c.fillText(baseStr, barX + barW + 4 * S, cy)
      const baseStrW = c.measureText(baseStr).width
      c.fillStyle = '#fff'
      c.font = `bold ${8*S}px "PingFang SC",sans-serif`
      c.fillText(`+${bonus}${u}`, barX + barW + 4 * S + baseStrW + 1 * S, cy)
    } else {
      c.fillStyle = 'rgba(255,240,210,0.5)'
      c.fillText(`${row.base}${u}`, barX + barW + 4 * S, cy)
    }
  }

  c.restore()
}

module.exports = {
  rCultivation, tCultivation,
  resetState, checkRealmBreak,
  // 兼容旧调用名
  resetScroll: resetState,
}
