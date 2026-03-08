/**
 * 修炼洞府界面 — 放射型天赋星盘
 * 中央修炼者头像 + 5 个属性节点环绕 + 灵气连线
 *
 * 渲染函数拆分到 cultivationDraw.js，本文件负责布局组装、状态管理和触摸处理
 */
const V = require('./env')
const {
  CULT_CONFIG, CULT_KEYS, MAX_LEVEL, expToNextLevel,
  effectValue, usedPoints, currentRealm, nextRealm,
} = require('../data/cultivationConfig')
const MusicMgr = require('../runtime/music')
const { drawBottomBar, getLayout } = require('./titleView')
const Draw = require('./cultivationDraw')

// 可选角色形象列表
const CHARACTERS = [
  { id: 'boy1',  label: '修仙少年',  sit: 'assets/hero/char_boy1.png',  avatar: 'assets/hero/hero_cultivation.jpg', unlocked: true },
  { id: 'girl1', label: '灵木仙子',  sit: 'assets/hero/char_girl1.png', avatar: 'assets/hero/avatar_girl1.jpg',     unlocked: true },
  { id: 'boy2',  label: '剑灵少侠',  sit: 'assets/hero/char_boy2.png',  avatar: 'assets/hero/avatar_boy2.jpg',      unlocked: true },
  { id: 'girl2', label: '星月仙子',  sit: 'assets/hero/char_girl2.png', avatar: 'assets/hero/avatar_girl2.jpg',     unlocked: true },
  { id: 'boy3',  label: '天罡道童',  sit: 'assets/hero/char_boy3.png',  avatar: 'assets/hero/avatar_boy3.jpg',      unlocked: false },
  { id: 'girl3', label: '花灵仙子',  sit: 'assets/hero/char_girl3.png', avatar: 'assets/hero/avatar_girl3.jpg',     unlocked: false },
]

// ===== 交互状态（统一管理） =====
const _state = {
  selectedNode: null,      // 当前展开详情的节点 key
  showAvatarPanel: false,  // 形象选择面板
  upgradeFlash: null,      // { key, timer }
  realmBreakAnim: null,    // { name, timer, duration }
  animFrame: 0,            // 全局动画帧计数
}

// 模块级触摸区域（不挂到 g 上，减少全局属性污染）
const _rects = {
  nodePositions: null,     // { key: { x, y, angle } }
  nodeR: 28,               // 节点半径（S单位前）
  avatarCenter: null,      // { x, y, r } 打坐角色触摸区域
  detailBtnRect: null,     // [x, y, w, h] 升级按钮
  detailPanelRect: null,   // [x, y, w, h] 详情面板
  avatarRects: [],         // [{ id, rect, unlocked }] 角色选择卡片
  avatarPanelRect: null,   // [x, y, w, h] 角色选择面板
}

function resetState() {
  _state.selectedNode = null
  _state.showAvatarPanel = false
  _state.upgradeFlash = null
}

function _getCharacter(g) {
  const selectedId = g.storage.selectedAvatar
  return CHARACTERS.find(a => a.id === selectedId) || CHARACTERS[0]
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

  c.save()
  c.fillStyle = '#7A5C30'
  c.font = `bold ${18*S}px "PingFang SC",sans-serif`
  c.textAlign = 'center'; c.textBaseline = 'middle'
  c.shadowColor = 'rgba(212,168,67,0.3)'; c.shadowBlur = 4*S
  c.fillText('修炼洞府', W * 0.5, topY + topH * 0.5)
  c.shadowBlur = 0
  c.restore()

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
  const expBarH = 10*S
  const expBarX = (W - expBarW) / 2

  c.fillStyle = 'rgba(0,0,0,0.1)'
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
    c.fillStyle = '#7A5C30'
    c.font = `${9*S}px "PingFang SC",sans-serif`
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillText(`${cult.exp} / ${needed}`, W * 0.5, expBarY + expBarH * 0.5)
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
    c.fillText('已满级', W * 0.5, expBarY + expBarH * 0.5)
    c.restore()
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

  // 详情面板
  if (_state.selectedNode) {
    Draw.drawDetailPanel(c, W, H, S, _state.selectedNode, cult, pts, _rects, _state.animFrame)
  }

  // 形象选择面板
  if (_state.showAvatarPanel) {
    Draw.drawAvatarPanel(g, c, R, W, H, S, CHARACTERS, _rects)
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
}

// ===== 境界突破检查 =====
function checkRealmBreak(g) {
  const cult = g.storage.cultivation
  const realm = currentRealm(cult.level)
  const { REALMS } = require('../data/cultivationConfig')
  const realmIdx = REALMS.indexOf(realm)
  if (realmIdx > cult.realmBreakSeen) {
    cult.realmBreakSeen = realmIdx
    g.storage._save()
    _state.realmBreakAnim = { name: realm.name, timer: 0, duration: 90 }
    MusicMgr.playLevelUp()
  }
}

// ===== 红点判断 =====
function hasCultUpgradeAvailable(storage) {
  const cult = storage._d.cultivation
  if (!cult || !cult.skillPoints || cult.skillPoints <= 0) return false
  for (const key of CULT_KEYS) {
    if (cult.levels[key] < CULT_CONFIG[key].maxLv) return true
  }
  return false
}

// ===== 触摸处理 =====
function tCultivation(g, x, y, type) {
  if (type !== 'end') return

  // 境界突破动画中点击跳过
  if (_state.realmBreakAnim && _state.realmBreakAnim.timer < _state.realmBreakAnim.duration) {
    _state.realmBreakAnim.timer = _state.realmBreakAnim.duration
    return
  }

  // 形象选择面板
  if (_state.showAvatarPanel) {
    if (_rects.avatarRects) {
      for (const av of _rects.avatarRects) {
        if (av.rect && Draw.hitRect(x, y, av.rect) && av.unlocked) {
          g.storage.setSelectedAvatar(av.id)
          _state.showAvatarPanel = false
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
    if (_rects.detailBtnRect && Draw.hitRect(x, y, _rects.detailBtnRect)) {
      const ok = g.storage.upgradeCultivation(_state.selectedNode)
      if (ok) {
        MusicMgr.playLevelUp()
        _state.upgradeFlash = { key: _state.selectedNode, timer: 20 }
        checkRealmBreak(g)
        const cult = g.storage.cultivation
        const cfg = CULT_CONFIG[_state.selectedNode]
        if (cult.skillPoints <= 0 || cult.levels[_state.selectedNode] >= cfg.maxLv) {
          _state.selectedNode = null
        }
      }
      return
    }
    if (_rects.detailPanelRect && Draw.hitRect(x, y, _rects.detailPanelRect)) {
      return
    }
    _state.selectedNode = null
    return
  }

  // 底部导航栏
  if (g._bottomBarRects) {
    const { BAR_ITEMS } = require('./titleView')
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
          if (item.key === 'battle' || item.key === 'stage') { g.scene = 'title'; return }
          if (item.key === 'dex') { g.scene = 'dex'; return }
          if (item.key === 'rank') { g.scene = 'ranking'; return }
          if (item.key === 'stats') { g.scene = 'stats'; return }
          if (item.key === 'more') { g.scene = 'title'; return }
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
        return
      }
    }
  }
}

module.exports = {
  rCultivation, tCultivation,
  hasCultUpgradeAvailable,
  resetState, checkRealmBreak,
  // 兼容旧调用名
  resetScroll: resetState,
}
