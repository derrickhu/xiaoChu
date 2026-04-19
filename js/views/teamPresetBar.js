/**
 * 预设编队 Tab Bar — 秘境编队页 / 通天塔编队页 共用组件
 *
 * 职责单一：
 *   · 绘制一行预设 tab（已解锁 = 正常，未解锁 = 🔒）+ 右侧「保存」按钮
 *   · 点击已解锁 tab（非空预设）→ applyTeamPreset，并通知调用方"槽位已变，请刷新选中列表"
 *   · 点击未解锁 tab → 交给调用方走看广告解锁
 *   · 点击空预设 tab → 只切 active 并提示玩家来"保存"，不覆盖屏幕上已调好的队伍
 *   · 点击"保存"按钮 → **一键保存到当前激活 tab**（无二级菜单），自动按阵容属性智能命名
 *
 * 这样交互尽量简化：tab 是"选哪套"，保存是"存这套"，不让玩家再做一步选择。
 *
 * 调用方关心的只有两个方法：
 *   · draw(g, x, y, w, opts?)       — opts 可传 { scope, highlightPresetId }
 *   · onTouch(g, x, y, type, opts?) — opts 可传 { onApply, onUnlockClick, afterSave,
 *                                                 prepareSaveCurrent, onActiveChanged }
 *
 * 为什么 tab bar 写成独立模块：
 *   · 秘境/塔两个编队页都需要挂，统一位置统一行为，避免两份拷贝代码走样
 *   · 未来做引导高亮（guideManager）时只需 focus 一个 rect
 */

const V = require('./env')
const gameToast = require('./gameToast')
const { TEAM_PRESET_MAX } = require('../data/constants')

// 尺寸常量：单位 S（按屏幕缩放）
// 布局目标：5 个 tab + 右侧保存按钮在 360pt 宽左右的窄屏下能完整并排，
// 不出现"保存按钮盖住最后一个 🔒 tab"的重叠。
const BAR_H = 38
const TAB_H = 30
const TAB_MIN_W = 40        // 窄屏绝对下限；低于此值 tab 点击区过小
const TAB_GAP = 4
const SAVE_BTN_W = 34       // 图标化后缩小，不占过多横向空间
const SIDE_PAD = 6
const BAR_ROUND = 10
const TAB_ROUND = 8

// 当前帧的命中区：每帧 draw 里重建
const _rects = {
  barRect: null,
  tabRects: [],      // [{ id, locked, rect }]
  saveBtnRect: null,
}

/**
 * 绘制 preset tab bar。
 *   x,y,w 指定整条 bar 的左上角 + 宽度；高度固定 BAR_H*S。
 *   返回绘制占用的高度（S 后的像素），方便调用方继续往下排版。
 */
function draw(g, x, y, w, opts) {
  const { ctx: c, R, S } = V
  const storage = g.storage
  const presets = storage.getTeamPresetsForView()
  const unlocked = storage.teamPresetSlotUnlocked
  const activeId = storage.teamPresetActiveId
  const hPx = BAR_H * S

  // 底板：深色衬底 + 细金边
  c.fillStyle = 'rgba(40,30,20,0.7)'
  R.rr(x, y, w, hPx, BAR_ROUND * S); c.fill()
  c.strokeStyle = 'rgba(200,180,120,0.22)'; c.lineWidth = 1 * S
  R.rr(x, y, w, hPx, BAR_ROUND * S); c.stroke()
  _rects.barRect = [x, y, w, hPx]

  // 去掉左侧的"预设"文字标签：玩家看 tab 样式就懂，留出宝贵横向空间给 5 个 tab。
  const tabsStartX = x + SIDE_PAD * S

  // 右侧"保存"按钮（图标化，缩小占用）
  const saveBtnW = SAVE_BTN_W * S
  const saveBtnH = TAB_H * S
  const saveBtnX = x + w - SIDE_PAD * S - saveBtnW
  const saveBtnY = y + (hPx - saveBtnH) / 2
  const tabsMaxX = saveBtnX - 4 * S   // 与保存按钮之间留一点气口

  // tab 区：在有限宽度内平均分配；绝对不允许越过 tabsMaxX 盖住保存按钮。
  const tabsAreaW = Math.max(0, tabsMaxX - tabsStartX)
  const tabCount = Math.min(TEAM_PRESET_MAX, presets.length)
  const evenTabW = (tabsAreaW - (tabCount - 1) * TAB_GAP * S) / tabCount
  // evenTabW 就是"平均分下来每个 tab 多宽"；若低于 TAB_MIN_W 说明屏太窄，
  // 就按下限保底但自动收缩 gap，保证总宽仍然 ≤ tabsAreaW（宁可挤 gap 也不重叠按钮）。
  let tabW, tabGap
  if (evenTabW >= TAB_MIN_W * S) {
    tabW = evenTabW
    tabGap = TAB_GAP * S
  } else {
    tabW = TAB_MIN_W * S
    const usedByTabs = tabW * tabCount
    tabGap = Math.max(0, (tabsAreaW - usedByTabs) / Math.max(1, tabCount - 1))
  }
  const tabY = y + (hPx - TAB_H * S) / 2

  _rects.tabRects = []
  for (let i = 0; i < tabCount; i++) {
    const p = presets[i]
    const tx = tabsStartX + i * (tabW + tabGap)
    const locked = p.locked
    const isActive = !locked && p.id === activeId
    // tab 填色
    if (locked) {
      c.fillStyle = 'rgba(20,16,10,0.55)'
    } else if (isActive) {
      c.fillStyle = 'rgba(212,160,48,0.95)'
    } else {
      c.fillStyle = 'rgba(80,65,40,0.75)'
    }
    R.rr(tx, tabY, tabW, TAB_H * S, TAB_ROUND * S); c.fill()
    // 边框
    c.strokeStyle = isActive ? 'rgba(255,240,190,0.9)' : 'rgba(200,180,120,0.35)'
    c.lineWidth = (isActive ? 1.5 : 1) * S
    R.rr(tx, tabY, tabW, TAB_H * S, TAB_ROUND * S); c.stroke()

    c.textAlign = 'center'; c.textBaseline = 'middle'
    if (locked) {
      c.fillStyle = 'rgba(200,180,120,0.6)'
      c.font = `${11 * S}px "PingFang SC",sans-serif`
      c.fillText('🔒', tx + tabW / 2, tabY + TAB_H * S / 2)
    } else {
      c.fillStyle = isActive ? '#2A1A08' : '#F5E6C8'
      c.font = `bold ${11 * S}px "PingFang SC",sans-serif`
      // 超长名截断
      let name = p.name || `预设 ${i + 1}`
      const maxW = tabW - 10 * S
      if (c.measureText(name).width > maxW) {
        const ell = '…'
        while (name.length > 0 && c.measureText(name + ell).width > maxW) {
          name = name.slice(0, -1)
        }
        name = name + ell
      }
      const empty = !p.petIds || p.petIds.length === 0
      // 为"未保存"副文字留出空间：tab 里的主名字稍微上移；宽度不够时只画主名字。
      const canShowSub = empty && tabW >= 52 * S
      c.fillText(name, tx + tabW / 2, tabY + TAB_H * S / 2 + (canShowSub ? -1 * S : 0))
      if (canShowSub) {
        c.fillStyle = isActive ? 'rgba(50,30,10,0.7)' : 'rgba(200,180,120,0.55)'
        c.font = `${8 * S}px "PingFang SC",sans-serif`
        c.fillText('未保存', tx + tabW / 2, tabY + TAB_H * S - 7 * S)
      } else if (empty) {
        // 窄屏不画文字，用一个右上角的小圆点暗示"空"
        const dotR = 2 * S
        c.fillStyle = isActive ? 'rgba(50,30,10,0.55)' : 'rgba(200,180,120,0.55)'
        c.beginPath()
        c.arc(tx + tabW - 6 * S, tabY + 6 * S, dotR, 0, Math.PI * 2)
        c.fill()
      }
    }

    // 推荐徽标（上层调用方通过 opts.highlightPresetId 指定）
    if (opts && opts.highlightPresetId && p.id === opts.highlightPresetId && !locked) {
      const badgeR = 6 * S
      const bx = tx + tabW - badgeR - 2 * S
      const by = tabY + badgeR + 2 * S
      c.fillStyle = '#E4413A'
      c.beginPath(); c.arc(bx, by, badgeR, 0, Math.PI * 2); c.fill()
      c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 1 * S; c.stroke()
      c.fillStyle = '#fff'; c.font = `bold ${7 * S}px "PingFang SC",sans-serif`
      c.fillText('荐', bx, by)
    }

    _rects.tabRects.push({ id: p.id, locked, rect: [tx, tabY, tabW, TAB_H * S] })
  }

  // 保存按钮：金色描边 + "保存"二字；按钮本身做得窄些，给 tab 区让空间。
  {
    c.fillStyle = 'rgba(60,45,25,0.9)'
    R.rr(saveBtnX, saveBtnY, saveBtnW, saveBtnH, TAB_ROUND * S); c.fill()
    c.strokeStyle = 'rgba(232,197,71,0.9)'; c.lineWidth = 1.2 * S
    R.rr(saveBtnX, saveBtnY, saveBtnW, saveBtnH, TAB_ROUND * S); c.stroke()
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.fillStyle = '#FFE9A8'
    c.font = `bold ${10.5 * S}px "PingFang SC",sans-serif`
    c.fillText('保存', saveBtnX + saveBtnW / 2, saveBtnY + saveBtnH / 2)
    _rects.saveBtnRect = [saveBtnX, saveBtnY, saveBtnW, saveBtnH]
  }

  return hPx
}

/**
 * 触摸入口：返回 true 表示事件已被本组件处理，调用方应 return。
 * opts:
 *   onApply(presetId, applied)    — 应用某预设成功后回调。applied = { petIds, weaponId }
 *   onUnlockClick(presetId)       — 点未解锁 tab 时回调（由调用方弹广告确认）
 *   afterSave(presetId)           — 保存到某预设成功后回调
 *   prepareSaveCurrent()          — 保存前的同步钩子（塔页用来把会话态灌进 savedStageTeam）
 *   onActiveChanged(presetId)     — 仅切 active 但不 apply（空预设场景）；调用方可据此刷新 UI
 */
function onTouch(g, x, y, type, opts) {
  opts = opts || {}
  // 只吃 end：start/move 交给编队页本身（不吃的话页面列表滚动会被卡住）
  if (type !== 'end') return false

  // tab 命中
  for (const t of _rects.tabRects) {
    if (!g._hitRect(x, y, ...t.rect)) continue
    if (t.locked) {
      if (opts.onUnlockClick) opts.onUnlockClick(t.id)
      return true
    }
    const peek = g.storage.getTeamPreset(t.id)
    // 空预设：只切 active 提示玩家来保存，不覆盖屏幕上已有的队伍
    if (!peek || peek.petIds.length === 0) {
      const activeId = g.storage.teamPresetActiveId
      if (t.id !== activeId) {
        g.storage.applyTeamPreset(t.id) // 空预设内部只改 activeId，不动当前编队
        if (opts.onActiveChanged) opts.onActiveChanged(t.id)
      }
      gameToast.show('这套还没保存·点右边「保存」存入当前队伍')
      return true
    }
    const activeId = g.storage.teamPresetActiveId
    if (t.id === activeId) {
      // 已激活：提醒玩家一下当前就是这套，免得他以为没反应
      gameToast.show(`当前已是「${peek.name}」`)
      return true
    }
    const applied = g.storage.applyTeamPreset(t.id)
    if (!applied) {
      gameToast.show('预设不可用')
      return true
    }
    gameToast.show(`已切换「${applied.name}」·${applied.petIds.length}只上阵`)
    if (opts.onApply) opts.onApply(t.id, applied)
    return true
  }

  // 保存按钮：一键写入当前激活预设（无菜单）
  if (_rects.saveBtnRect && g._hitRect(x, y, ..._rects.saveBtnRect)) {
    if (typeof opts.prepareSaveCurrent === 'function') opts.prepareSaveCurrent()
    const activeId = g.storage.teamPresetActiveId
    const ok = g.storage.saveCurrentToPreset(activeId)
    if (!ok) {
      // 失败 = 当前编队为空，或者槽位锁了（正常路径下 active 不会是锁定槽）
      gameToast.show('先选几只灵宠再来保存吧~')
      return true
    }
    const saved = g.storage.getTeamPreset(activeId)
    gameToast.show(`已保存到「${saved ? saved.name : activeId}」`)
    if (opts.afterSave) opts.afterSave(activeId)
    return true
  }

  return false
}

/** 场景切换时调用，复位命中区 */
function reset() {
  _rects.barRect = null
  _rects.tabRects = []
  _rects.saveBtnRect = null
}

/** 返回整条 bar 的像素高度（供调用方预留空间） */
function getBarHeight() {
  return BAR_H * V.S
}

/**
 * 通用的"看广告解锁下一个槽位"流程。
 *   · 已解锁到 TEAM_PRESET_MAX 时给 toast 并不走广告
 *   · 否则弹确认框，确认后调 AdManager.showRewardedVideo('unlockTeamPreset')
 *     成功回调 → storage.unlockNextTeamPresetSlot + adRewardPopup 反馈
 * 调用方可传 onSuccess(newUnlocked) 做后续刷新。
 */
function triggerUnlockAd(g, onSuccess) {
  const storage = g.storage
  const { TEAM_PRESET_MAX } = require('../data/constants')
  const cur = storage.teamPresetSlotUnlocked
  if (cur >= TEAM_PRESET_MAX) {
    gameToast.show('预设槽位已满')
    return
  }
  const nextSlotNo = cur + 1
  g._confirmDialog = {
    title: '解锁预设槽位',
    content: `看一段短广告可解锁「预设 ${nextSlotNo}」\n当前已解锁 ${cur} / ${TEAM_PRESET_MAX} 套`,
    confirmText: '看广告',
    cancelText: '再想想',
    onConfirm() {
      const AdManager = require('../adManager')
      AdManager.showRewardedVideo('unlockTeamPreset', {
        onRewarded() {
          const after = storage.unlockNextTeamPresetSlot()
          if (!after) {
            gameToast.show('预设槽位已满')
            return
          }
          if (typeof onSuccess === 'function') onSuccess(after)
        },
        rewardPopup() {
          return {
            title: '编队槽位 +1',
            subtitle: `已解锁「预设 ${nextSlotNo}」，现在可以保存新的阵容啦`,
            lines: [{ icon: null, label: '预设编队', amount: `槽位 +1 (${nextSlotNo}/${TEAM_PRESET_MAX})` }],
          }
        },
      })
    },
  }
}

module.exports = {
  draw,
  onTouch,
  reset,
  getBarHeight,
  triggerUnlockAd,
  BAR_H,
}
