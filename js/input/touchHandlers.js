/**
 * 触摸/输入处理：各场景的触摸事件分发
 * 所有函数接收 g (Main实例) 以读写状态
 */
const V = require('../views/env')
const MusicMgr = require('../runtime/music')
const { generateRewards, MAX_FLOOR } = require('../data/tower')
const { hasSameIdOnTeam, petHasSkill } = require('../data/pets')
const { prepBagScrollStart, prepBagScrollMove, prepBagScrollEnd } = require('../views/prepareView')
const tutorial = require('../engine/tutorial')
const runMgr = require('../engine/runManager')

function tTitle(g, type, x, y) {
  if (type !== 'end') return
  const { S } = V
  // 新挑战确认弹窗（优先级最高）
  if (g.showNewRunConfirm) {
    if (g._newRunConfirmRect && g._hitRect(x,y,...g._newRunConfirmRect)) {
      g.showNewRunConfirm = false
      g.storage.clearRunState()
      g._startRun(); return
    }
    if (g._newRunCancelRect && g._hitRect(x,y,...g._newRunCancelRect)) {
      g.showNewRunConfirm = false; return
    }
    return
  }
  if (g._titleContinueRect && g._hitRect(x,y,...g._titleContinueRect)) { g._resumeRun(); return }
  if (g._titleBtnRect && g._hitRect(x,y,...g._titleBtnRect)) {
    if (g.storage.hasSavedRun()) { g.showNewRunConfirm = true; return }
    g._startRun(); return
  }
  if (g._statBtnRect && g._hitRect(x,y,...g._statBtnRect)) { console.log('[Touch] Stats button clicked'); g.scene = 'stats'; return }
  if (g._rankBtnRect && g._hitRect(x,y,...g._rankBtnRect)) {
    // 未授权时排行按钮上有透明UserInfoButton，canvas不处理（让UserInfoButton拦截）
    if (!g.storage.userAuthorized && g.storage._userInfoBtn) {
      console.log('[Touch] Rank button clicked but UserInfoButton active, skip canvas handler')
      return
    }
    console.log('[Touch] Rank button clicked'); g._openRanking(); return
  }
  if (g._dexBtnRect && g._hitRect(x,y,...g._dexBtnRect)) { console.log('[Touch] Dex button clicked'); g._dexScrollY = 0; g.scene = 'dex'; return }
  console.log('[Touch] Title tap missed, rankBtnRect exists?', !!g._rankBtnRect)
}

let _prepScrolling = false
let _prepScrollMoved = false
let _prepDragWpn = null // 法宝拖拽状态

function tPrepare(g, type, x, y) {
  if (type === 'start') {
    _prepScrollMoved = false
    // 法宝Tab：检测是否开始拖拽法宝
    if (g.prepareTab === 'weapon') {
      if (g.weapon && g._prepCurWpnRect && g._hitRect(x,y,...g._prepCurWpnRect)) {
        _prepDragWpn = { source:'equipped', index:0, weapon:g.weapon, x, y, startX:x, startY:y, moved:false }
        g._prepDragWpn = _prepDragWpn
        return
      }
      if (g._prepWpnBagRects) {
        for (let i = 0; i < g._prepWpnBagRects.length; i++) {
          const [bx,by,bw,bh] = g._prepWpnBagRects[i]
          if (g._hitRect(x,y,bx,by,bw,bh) && g.weaponBag[i]) {
            _prepDragWpn = { source:'bag', index:i, weapon:g.weaponBag[i], x, y, startX:x, startY:y, moved:false }
            g._prepDragWpn = _prepDragWpn
            return
          }
        }
      }
    }
    _prepScrolling = prepBagScrollStart(g, y)
    return
  }
  if (type === 'move') {
    if (_prepDragWpn) {
      _prepDragWpn.x = x; _prepDragWpn.y = y
      const dx = x - _prepDragWpn.startX, dy = y - _prepDragWpn.startY
      if (dx*dx + dy*dy > 100) _prepDragWpn.moved = true
      return
    }
    if (_prepScrolling) {
      prepBagScrollMove(y)
      _prepScrollMoved = true
    }
    return
  }
  // type === 'end'
  if (_prepDragWpn) {
    const drag = _prepDragWpn
    _prepDragWpn = null
    g._prepDragWpn = null
    if (drag.moved) {
      // 查找落点
      if (drag.source === 'bag') {
        // 从背包拖到装备位
        if (g._prepCurWpnRect && g._hitRect(x,y,...g._prepCurWpnRect)) {
          const old = g.weapon
          g.weapon = g.weaponBag[drag.index]
          if (old) { g.weaponBag[drag.index] = old }
          else { g.weaponBag.splice(drag.index, 1) }
        }
      } else {
        // 从装备位拖到背包某位置
        if (g._prepWpnBagRects) {
          for (let i = 0; i < g._prepWpnBagRects.length; i++) {
            const [bx,by,bw,bh] = g._prepWpnBagRects[i]
            if (g._hitRect(x,y,bx,by,bw,bh) && g.weaponBag[i]) {
              const old = g.weapon
              g.weapon = g.weaponBag[i]
              if (old) { g.weaponBag[i] = old }
              return
            }
          }
        }
      }
    } else {
      // 没移动 = 单击 → 查看详情
      if (drag.source === 'equipped') {
        g.prepareTip = { type:'weapon', data: drag.weapon, x, y }
      } else {
        g.prepareTip = { type:'weapon', data: drag.weapon, x, y }
      }
    }
    return
  }
  if (_prepScrolling) {
    prepBagScrollEnd()
    _prepScrolling = false
    if (_prepScrollMoved) return // 滚动手势，不触发点击
  }

  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g.scene = 'event'; return }
  if (g.prepareTip) { g.prepareTip = null; return }
  if (g._prepPetTabRect && g._hitRect(x,y,...g._prepPetTabRect)) { g.prepareTab = 'pets'; g.prepareSelBagIdx = -1; g.prepareSelSlotIdx = -1; g.prepareTip = null; return }
  if (g._prepWpnTabRect && g._hitRect(x,y,...g._prepWpnTabRect)) { g.prepareTab = 'weapon'; g.prepareTip = null; return }

  if (g.prepareTab === 'pets') {
    if (g._prepSlotRects) {
      for (let i = 0; i < g._prepSlotRects.length; i++) {
        if (g._hitRect(x,y,...g._prepSlotRects[i])) {
          if (g.prepareSelSlotIdx === i && g.pets[i]) {
            g.prepareTip = { type:'pet', data: g.pets[i], x, y }; return
          }
          g.prepareSelSlotIdx = i; return
        }
      }
    }
    if (g._prepBagRects) {
      for (let i = 0; i < g._prepBagRects.length; i++) {
        if (g._hitRect(x,y,...g._prepBagRects[i]) && g.petBag[i]) {
          if (g.prepareSelBagIdx === i) {
            g.prepareTip = { type:'pet', data: g.petBag[i], x, y }; return
          }
          g.prepareSelBagIdx = i; return
        }
      }
    }
    if (g._prepSwapBtnRect && g._hitRect(x,y,...g._prepSwapBtnRect)) {
      const si = g.prepareSelSlotIdx, bi = g.prepareSelBagIdx
      if (si >= 0 && bi >= 0 && g.petBag[bi]) {
        if (hasSameIdOnTeam(g.pets, g.petBag[bi].id, si)) return
        const tmp = g.pets[si]
        g.pets[si] = g.petBag[bi]
        g.pets[si].currentCd = 0
        if (tmp) { g.petBag[bi] = tmp }
        else { g.petBag.splice(bi, 1) }
        g.prepareSelSlotIdx = -1; g.prepareSelBagIdx = -1
      }
      return
    }
  }
  if (g._prepGoBtnRect && g._hitRect(x,y,...g._prepGoBtnRect)) {
    g._enterEvent(); return
  }
}



function tEvent(g, type, x, y) {
  // ★3满星庆祝画面（商店升星触发）
  if (type === 'end' && g._star3Celebration && g._star3Celebration.phase === 'ready') {
    g._star3Celebration = null; return
  }
  if (g._star3Celebration) return
  // === 弹窗层：只处理 end ===
  if (type === 'end') {
    // 商店灵兽获得弹窗
    if (g._shopPetObtained) {
      g._shopPetObtained = null; return
    }
    if (g._eventPetDetail != null) {
      g._eventPetDetail = null; g._eventPetDetailData = null; return
    }
    if (g._eventWpnDetail != null) {
      g._eventWpnDetail = null; g._eventWpnDetailData = null; return
    }
  }
  // 弹窗打开时屏蔽其他交互
  if (g._shopPetObtained) return

  // === 拖拽灵宠 / 法宝 ===
  const drag = g._eventDragPet
  const wpnDrag = g._eventDragWpn
  if (type === 'start') {
    // 检测是否按在法宝上开始拖拽
    if (g._eventWpnSlots) {
      for (const slot of g._eventWpnSlots) {
        if (g._hitRect(x, y, ...slot.rect)) {
          let wp = null
          if (slot.type === 'equipped') wp = g.weapon
          else if (slot.type === 'bag' && slot.index < g.weaponBag.length) wp = g.weaponBag[slot.index]
          if (wp) {
            g._eventDragWpn = { source: slot.type, index: slot.index, weapon: wp, x, y, startX: x, startY: y, moved: false }
          }
          return
        }
      }
    }
    // 检测是否按在灵宠上开始拖拽
    if (g._eventPetSlots) {
      for (const slot of g._eventPetSlots) {
        if (g._hitRect(x, y, ...slot.rect)) {
          let pet = null
          if (slot.type === 'team' && slot.index < g.pets.length) pet = g.pets[slot.index]
          else if (slot.type === 'bag' && slot.index < g.petBag.length) pet = g.petBag[slot.index]
          if (pet) {
            g._eventDragPet = { source: slot.type, index: slot.index, pet, x, y, startX: x, startY: y, moved: false }
          }
          return
        }
      }
    }
    return
  }

  if (type === 'move') {
    if (drag) {
      drag.x = x; drag.y = y
      const dx = x - drag.startX, dy = y - drag.startY
      if (dx*dx + dy*dy > 100) drag.moved = true
    }
    if (wpnDrag) {
      wpnDrag.x = x; wpnDrag.y = y
      const dx = x - wpnDrag.startX, dy = y - wpnDrag.startY
      if (dx*dx + dy*dy > 100) wpnDrag.moved = true
    }
    return
  }

  if (type === 'end') {
    // 法宝拖拽结束
    if (wpnDrag) {
      if (wpnDrag.moved) {
        // 查找落点是否在法宝槽上
        let dropSlot = null
        if (g._eventWpnSlots) {
          for (const slot of g._eventWpnSlots) {
            if (g._hitRect(x, y, ...slot.rect)) { dropSlot = slot; break }
          }
        }
        if (dropSlot && dropSlot !== undefined) {
          _doEventWpnSwap(g, wpnDrag, dropSlot)
        }
      } else {
        // 没有移动 = 单击 → 查看详情
        const wp = wpnDrag.source === 'equipped' ? g.weapon : g.weaponBag[wpnDrag.index]
        if (wp) {
          g._eventWpnDetail = true
          g._eventWpnDetailData = wp
        }
      }
      g._eventDragWpn = null
      return
    }

    // 灵宠拖拽结束 — 检测落点
    if (drag) {
      if (drag.moved) {
        // 查找落点目标
        let dropSlot = null
        if (g._eventPetSlots) {
          for (const slot of g._eventPetSlots) {
            if (g._hitRect(x, y, ...slot.rect)) { dropSlot = slot; break }
          }
        }
        if (dropSlot) {
          _doEventPetSwap(g, drag, dropSlot)
        }
      } else {
        // 没有移动 = 单击 → 查看详情
        const pet = drag.source === 'team' ? g.pets[drag.index] : g.petBag[drag.index]
        if (pet) {
          g._eventPetDetail = drag.index
          g._eventPetDetailData = pet
        }
      }
      g._eventDragPet = null
      return
    }

    // === 非拖拽的 end 事件 ===
    if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }

    // 进入战斗 / 非战斗事件内联交互
    if (g._eventBtnRect && g._hitRect(x,y,...g._eventBtnRect)) {
      const ev = g.curEvent; if (!ev) return
      switch(ev.type) {
        case 'battle': case 'elite': case 'boss':
          g._enterBattle(ev.data); break
        case 'adventure':
          // 效果已在渲染时自动应用，直接进入下一层
          g._nextFloor(); break
        case 'shop':
          // "离开"按钮
          g._nextFloor(); break
      }
    }

    // 商店交互（新版：属性选择/灵兽选择/商品点击）
    const ev = g.curEvent
    if (ev && ev.type === 'shop') {
      // 属性选择面板（点击选中，确认执行）
      if (g._shopSelectAttr) {
        // 确认按钮
        if (g._shopAttrConfirmRect && g._shopAttrSelectedVal && g._hitRect(x,y,...g._shopAttrConfirmRect)) {
          g._applyShopPetByAttr(g._shopAttrSelectedVal)
          g._shopSelectAttr = false
          g._shopSelectAttrItem = null
          g._shopAttrSelectedVal = null
          return
        }
        // 点击属性按钮 → 选中/切换
        if (g._shopAttrRects) {
          for (const rect of g._shopAttrRects) {
            if (g._hitRect(x,y,rect[0],rect[1],rect[2],rect[3])) {
              g._shopAttrSelectedVal = rect[4]
              return
            }
          }
        }
        if (g._shopAttrCancelRect && g._hitRect(x,y,...g._shopAttrCancelRect)) {
          g._shopSelectAttr = false; g._shopSelectAttrItem = null; g._shopAttrSelectedVal = null; return
        }
        return  // 面板打开时不响应其他点击
      }
      // 灵兽选择面板（点击选中，确认执行）
      if (g._shopSelectPet) {
        // 确认按钮
        if (g._shopPetConfirmRect && g._shopPetSelectedIdx != null && g._hitRect(x,y,...g._shopPetConfirmRect)) {
          const petIdx = g._shopPetSelectedIdx
          const selectType = g._shopSelectPet.type
          if (selectType === 'starUp') g._applyShopStarUp(petIdx)
          else if (selectType === 'upgradePet') g._applyShopUpgradePet(petIdx, g._shopSelectPet.pct)
          else if (selectType === 'cdReduce') g._applyShopCdReduce(petIdx)
          g._shopSelectPet = null
          g._shopPetSelectedIdx = null
          return
        }
        // 点击灵兽头像 → 选中/切换
        if (g._shopPetRects) {
          for (const rect of g._shopPetRects) {
            if (g._hitRect(x,y,rect[0],rect[1],rect[2],rect[3])) {
              g._shopPetSelectedIdx = rect[4]
              return
            }
          }
        }
        if (g._shopPetCancelRect && g._hitRect(x,y,...g._shopPetCancelRect)) {
          g._shopSelectPet = null; g._shopPetSelectedIdx = null; return
        }
        return  // 面板打开时不响应其他点击
      }
      // 商品点击
      const shopUsedCount = g._eventShopUsedCount || 0
      if (shopUsedCount < 2 && g._eventShopRects) {
        for (let i = 0; i < g._eventShopRects.length; i++) {
          const rect = g._eventShopRects[i]
          if (!rect) continue  // 已购买的占位
          if (g._hitRect(x,y,...rect)) {
            const item = ev.data[i]
            if (!item) return
            // 第2件需消耗血量
            if (shopUsedCount === 1) {
              const cost = Math.round(g.heroHp * 15 / 100)
              g.heroHp = Math.max(1, g.heroHp - cost)
              // 血量减少飘字提醒
              if (cost > 0) {
                g.dmgFloats.push({ x: V.W * 0.5, y: V.H * 0.35, text: `-${cost} HP`, color: '#ff4444', t: 0, alpha: 1, scale: 1.1 })
              }
            }
            // 标记已购买
            g._eventShopUsedItems = g._eventShopUsedItems || []
            g._eventShopUsedItems.push(i)
            g._eventShopUsedCount = shopUsedCount + 1
            // 需要选择的效果：弹出面板
            if (item.effect === 'getPetByAttr') {
              g._shopSelectAttr = true; g._shopSelectAttrItem = item; g._shopAttrSelectedVal = null; return
            }
            if (item.effect === 'starUp') {
              g._shopSelectPet = { type: 'starUp' }; g._shopPetSelectedIdx = null; return
            }
            if (item.effect === 'upgradePet') {
              g._shopSelectPet = { type: 'upgradePet', pct: item.pct || 25 }; g._shopPetSelectedIdx = null; return
            }
            if (item.effect === 'cdReduce') {
              g._shopSelectPet = { type: 'cdReduce' }; g._shopPetSelectedIdx = null; return
            }
            // 直接生效的效果
            g._applyShopItem(item)
            return
          }
        }
      }
    }

    // 休息选项点击（内联在 event 页面）
    if (ev && ev.type === 'rest' && g._eventRestRects) {
      for (let i = 0; i < g._eventRestRects.length; i++) {
        if (g._hitRect(x,y,...g._eventRestRects[i])) {
          g._applyRestOption(ev.data[i]); g._nextFloor(); return
        }
      }
    }
  }
}

// 灵宠拖拽交换：只允许队伍↔背包，禁止同ID上场
function _doEventPetSwap(g, drag, drop) {
  // 同区域不允许交换
  if (drag.source === drop.type) return
  const si = drag.source === 'team' ? drag.index : drop.index  // 队伍索引
  const bi = drag.source === 'bag' ? drag.index : drop.index   // 背包索引

  if (drag.source === 'team') {
    // 队伍 → 背包位置
    if (bi < g.petBag.length) {
      // 检查：背包宠物上场后是否与队伍中其他宠物同ID
      const bagPet = g.petBag[bi]
      if (hasSameIdOnTeam(g.pets, bagPet.id, si)) return // 禁止同ID上场
      const tmp = g.pets[si]
      g.pets[si] = g.petBag[bi]
      g.pets[si].currentCd = 0
      g.petBag[bi] = tmp
    } else {
      if (g.pets.length > 1) {
        g.petBag.push(g.pets[si])
        g.pets.splice(si, 1)
      }
    }
  } else {
    // 背包 → 队伍位置
    if (si < g.pets.length) {
      // 检查：背包宠物上场后是否与队伍中其他宠物同ID
      const bagPet = g.petBag[bi]
      if (hasSameIdOnTeam(g.pets, bagPet.id, si)) return // 禁止同ID上场
      const tmp = g.pets[si]
      g.pets[si] = g.petBag[bi]
      g.pets[si].currentCd = 0
      g.petBag[bi] = tmp
    } else {
      if (g.pets.length < 5) {
        const pet = g.petBag[bi]
        if (hasSameIdOnTeam(g.pets, pet.id, -1)) return // 禁止同ID上场
        g.petBag.splice(bi, 1)[0]
        pet.currentCd = 0
        g.pets.push(pet)
      }
    }
  }
}

// 法宝拖拽交换：装备↔背包
function _doEventWpnSwap(g, drag, drop) {
  if (drag.source === drop.type) return  // 同区域不交换
  if (drag.source === 'equipped' && drop.type === 'bag') {
    // 装备 → 背包位置
    const bi = drop.index
    if (bi < g.weaponBag.length) {
      const tmp = g.weapon
      g.weapon = g.weaponBag[bi]
      g.weaponBag[bi] = tmp
    } else {
      g.weaponBag.push(g.weapon)
      g.weapon = null
    }
  } else if (drag.source === 'bag' && drop.type === 'equipped') {
    // 背包 → 装备位置
    const bi = drag.index
    const old = g.weapon
    g.weapon = g.weaponBag[bi]
    if (old) { g.weaponBag[bi] = old }
    else { g.weaponBag.splice(bi, 1) }
  }
}

function tBattle(g, type, x, y) {
  const { S, W, H, COLS, ROWS } = V
  // === 教学系统拦截 ===
  if (tutorial.isActive()) {
    // 跳过按钮检测（非总结页）
    if (!tutorial.isSummary() && type === 'end' && g._tutorialSkipRect && g._hitRect(x, y, ...g._tutorialSkipRect)) {
      g._tutorialSkipRect = null
      tutorial.skip(g)
      return
    }
    // 总结页点击
    if (tutorial.isSummary()) {
      if (type === 'end') tutorial.onSummaryTap(g)
      return
    }
    // intro阶段点击跳过
    if (tutorial.getPhase() === 'intro') {
      if (type === 'end') tutorial.onIntroTap(g)
      return
    }
    // 教学中胜利 — 点击切下一步（所有步骤统一，无奖励选择）
    if (g.bState === 'victory') {
      if (type === 'end') tutorial.onVictory(g)
      return
    }
    // 教学中禁用退出/弹窗等UI
    if (g.showExitDialog || g.showEnemyDetail || g.showRunBuffDetail || g.showWeaponDetail || g.showBattlePetDetail != null) {
      if (type === 'end') {
        g.showExitDialog = false; g.showEnemyDetail = false
        g.showRunBuffDetail = false; g.showWeaponDetail = false
        g.showBattlePetDetail = null
      }
      return
    }
  }
  // === 教学拦截结束，以下为原逻辑 ===
  // 退出弹窗
  if (g.showExitDialog) {
    if (type !== 'end') return
    if (g._exitSaveRect && g._hitRect(x,y,...g._exitSaveRect)) { g._saveAndExit(); return }
    if (g._exitRestartRect && g._hitRect(x,y,...g._exitRestartRect)) {
      MusicMgr.stopBossBgm()
      g.showExitDialog = false; g.storage.clearRunState(); g._startRun(); return
    }
    if (g._exitCancelRect && g._hitRect(x,y,...g._exitCancelRect)) { g.showExitDialog = false; return }
    return
  }
  if (g.showEnemyDetail) { if (type === 'end') g.showEnemyDetail = false; return }
  if (g.showRunBuffDetail) { if (type === 'end') g.showRunBuffDetail = false; return }
  if (g.showWeaponDetail) { if (type === 'end') g.showWeaponDetail = false; return }
  if (g.showBattlePetDetail != null) { if (type === 'end') g.showBattlePetDetail = null; return }
  if (type === 'end' && g._exitBtnRect && g._hitRect(x,y,...g._exitBtnRect)) { g.showExitDialog = true; return }
  // 胜利/失败
  if (g.bState === 'victory' && type === 'end') {
    // 第30层通关面板：点击确认直接结束
    if (g.floor >= MAX_FLOOR && g._clearConfirmRect && g._hitRect(x,y,...g._clearConfirmRect)) {
      if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm()
      g.cleared = true
      g._endRun()
      return
    }
    if (g.floor >= MAX_FLOOR) return
    // 宠物获得/升星弹窗：点击关闭后进入下一层
    if (g._petObtainedPopup) {
      g._petObtainedPopup = null
      g._nextFloor()
      return
    }
    // ★3满星庆祝画面：点击关闭后进入下一层
    if (g._star3Celebration && g._star3Celebration.phase === 'ready') {
      g._star3Celebration = null
      g._nextFloor()
      return
    }
    if (g._star3Celebration) return
    // 点击任意处：动画结束后跳转到独立奖励选择页面
    if (g._victoryTapReady && g.rewards && g.rewards.length > 0) {
      g.selectedReward = -1
      g._victoryAnimTimer = null  // 重置动画计时器
      g.scene = 'reward'
      MusicMgr.playReward()
      return
    }
    return
  }
  if (g.bState === 'defeat' && type === 'end') {
    if (g._defeatBtnRect && g._hitRect(x,y,...g._defeatBtnRect)) { if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm(); g._endRun(); return }
  }
  // 广告复活
  if (g.bState === 'adReviveOffer' && type === 'end') {
    if (g._adReviveBtnRect && g._hitRect(x,y,...g._adReviveBtnRect)) { g._doAdRevive(); return }
    if (g._adReviveSkipRect && g._hitRect(x,y,...g._adReviveSkipRect)) { g.adReviveUsed = true; g.bState = 'defeat'; return }
    return
  }
  // 道具菜单交互（优先拦截所有触摸）
  if (g._showItemMenu && type === 'end') {
    // 分享获取后短暂冷却，防止分享返回时误触使用
    if (g._itemObtainCooldown && Date.now() - g._itemObtainCooldown < 800) {
      return
    }
    let hitItem = false
    if (g._itemMenuRects) {
      for (const item of g._itemMenuRects) {
        if (g._hitRect(x, y, ...item.rect)) {
          if (item.action === 'obtain') {
            // 分享获取道具（不立即使用）
            if (item.key === 'reset') runMgr.obtainItemReset(g)
            else if (item.key === 'heal') runMgr.obtainItemHeal(g)
            g._itemObtainCooldown = Date.now()
          } else if (item.action === 'use') {
            // 使用已获取的道具
            if (item.key === 'reset') runMgr.useItemReset(g)
            else if (item.key === 'heal') runMgr.useItemHeal(g)
          }
          hitItem = true; break
        }
      }
    }
    if (!hitItem) g._showItemMenu = false
    return
  }
  // 宝箱道具按钮
  if (type === 'end' && g.bState === 'playerTurn' && !g.dragging
      && g._chestBtnRect && g._hitRect(x, y, ...g._chestBtnRect)) {
    g._showItemMenu = true; return
  }
  // 全局增益图标
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat' && g._runBuffIconRects) {
    for (const item of g._runBuffIconRects) {
      if (g._hitRect(x, y, ...item.rect)) { g.showRunBuffDetail = true; return }
    }
  }
  // 敌人详情（技能释放/动画播放期间不弹出）
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat'
      && !g._petSwipeTriggered && !g._skillFlash && !g._petSkillWave
      && g.enemy && g._enemyAreaRect && g._hitRect(x,y,...g._enemyAreaRect)) {
    if (!g._exitBtnRect || !g._hitRect(x,y,...g._exitBtnRect)) { g.showEnemyDetail = true; return }
  }
  // 法宝详情
  if (type === 'end' && g.bState !== 'victory' && g.bState !== 'defeat'
      && g.weapon && g._weaponBtnRect && g._hitRect(x,y,...g._weaponBtnRect)) {
    g.showWeaponDetail = true; return
  }
  // 宠物头像框交互：上划释放技能，点击查看详情
  if (g._petBtnRects && g.bState !== 'victory' && g.bState !== 'defeat') {
    // end事件：如果之前已触发上划技能，直接清理状态，不做任何处理（防止弹详情）
    if (type === 'end' && g._petSwipeTriggered) {
      if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
      g._petSwipeIndex = -1; g._petSwipeTriggered = false
      g._petLongPressIndex = -1; g._petLongPressTriggered = false
      return
    }
    for (let i = 0; i < g._petBtnRects.length; i++) {
      if (i < g.pets.length && g._hitRect(x,y,...g._petBtnRects[i])) {
        const pet = g.pets[i]
        const skillReady = g.bState === 'playerTurn' && !g.dragging && petHasSkill(pet) && pet.currentCd <= 0 && !g._petSkillWave && !g._skillFlash
        if (type === 'start') {
          // 记录滑动起始位置
          g._petSwipeIndex = i
          g._petSwipeStartX = x
          g._petSwipeStartY = y
          g._petSwipeTriggered = false
          // 保留长按预览功能（500ms）
          if (skillReady) {
            g._petLongPressIndex = i
            g._petLongPressTriggered = false
            if (g._petLongPressTimer) clearTimeout(g._petLongPressTimer)
            g._petLongPressTimer = setTimeout(() => {
              g._petLongPressTriggered = true
              g._showSkillPreview(pet, i)
            }, 500)
          }
          return
        } else if (type === 'move') {
          // 检测上划手势：向上滑动超过30像素且技能就绪
          if (g._petSwipeIndex === i && skillReady) {
            const dy = g._petSwipeStartY - y  // 向上为正
            if (dy > 30 * V.S && !g._petSwipeTriggered) {
              g._petSwipeTriggered = true
              // 取消长按定时器
              if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
              // 触发技能释放
              g._triggerPetSkill(pet, i)
              return
            }
          }
          // 如果移动距离较大，取消长按预览（使用滑动起始位置）
          if (g._petLongPressIndex === i && g._petLongPressTimer) {
            const dx = x - g._petSwipeStartX
            const dy = y - g._petSwipeStartY
            if (dx*dx + dy*dy > 100) {
              clearTimeout(g._petLongPressTimer)
              g._petLongPressTimer = null; g._petLongPressIndex = -1
            }
          }
          return
        } else if (type === 'end') {
          // 清理长按定时器
          if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
          // 如果触发了长按预览，结束时不处理点击
          if (g._petLongPressTriggered && g._petLongPressIndex === i) {
            g._petLongPressIndex = -1; g._petLongPressTriggered = false
            g._petSwipeIndex = -1
            return
          }
          // 没有触发上划技能，视为点击，显示宠物详情
          g.showBattlePetDetail = i
          // 重置滑动状态
          g._petSwipeIndex = -1
          g._petSwipeTriggered = false
          g._petLongPressIndex = -1
          return
        }
      }
    }
    // 触摸开始后移出头像框：仍允许触发上划（只要技能就绪）
    if (type === 'move' && g._petSwipeIndex >= 0) {
      const pet = g.pets[g._petSwipeIndex]
      const skillReady = g.bState === 'playerTurn' && !g.dragging && pet.currentCd <= 0 && !g._petSkillWave && !g._skillFlash
      if (skillReady && !g._petSwipeTriggered) {
        const dy = g._petSwipeStartY - y
        if (dy > 30 * V.S) {
          g._petSwipeTriggered = true
          if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
          g._triggerPetSkill(pet, g._petSwipeIndex)
        }
      }
    }
    // end事件且有未清理的swipe状态（手指在头像框外释放）：清理状态
    if (type === 'end' && g._petSwipeIndex >= 0) {
      if (g._petLongPressTimer) { clearTimeout(g._petLongPressTimer); g._petLongPressTimer = null }
      g._petSwipeIndex = -1; g._petSwipeTriggered = false
      g._petLongPressIndex = -1; g._petLongPressTriggered = false
    }
  }
  // 转珠（技能动画播放期间锁定操作）
  if (g.bState !== 'playerTurn') return
  if (g._petSkillWave || g._skillFlash) return
  const cs = g.cellSize, bx = g.boardX, by = g.boardY
  if (type === 'start') {
    const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && g.board[r][c] && !g.board[r][c].sealed && tutorial.canDrag(g, r, c)) {
      g.dragging = true; g.dragR = r; g.dragC = c
      g.dragStartX = x; g.dragStartY = y; g.dragCurX = x; g.dragCurY = y
      const cell = g.board[r][c]
      g.dragAttr = typeof cell === 'string' ? cell : cell.attr
      g.dragTimer = 0
      MusicMgr.playPickUp()
    }
  } else if (type === 'move' && g.dragging) {
    g.dragCurX = Math.max(bx, Math.min(bx + COLS * cs, x))
    g.dragCurY = Math.max(by, Math.min(by + ROWS * cs, y))
    const c = Math.floor((x-bx)/cs), r = Math.floor((y-by)/cs)
    if (r >= 0 && r < ROWS && c >= 0 && c < COLS && (r !== g.dragR || c !== g.dragC) && !(g.board[r][c] && g.board[r][c].sealed)) {
      const or = g.dragR, oc = g.dragC
      const tmp = g.board[or][oc]; g.board[or][oc] = g.board[r][c]; g.board[r][c] = tmp
      g.swapAnim = { r1:or, c1:oc, r2:r, c2:c, t:0, dur:6 }
      g.dragR = r; g.dragC = c
      MusicMgr.playSwap()
    }
  } else if (type === 'end' && g.dragging) {
    g.dragging = false; g.dragAttr = null; g.dragTimer = 0
    MusicMgr.playDragEnd()
    g._checkAndElim()
  }
}

function tReward(g, type, x, y) {
  if (type !== 'end') return
  // 宠物获得/升星弹窗：点击关闭后进入下一层
  if (g._petObtainedPopup) {
    g._petObtainedPopup = null
    g._nextFloor()
    return
  }
  // ★3满星庆祝画面：点击关闭后进入下一层
  if (g._star3Celebration && g._star3Celebration.phase === 'ready') {
    g._star3Celebration = null
    g._nextFloor()
    return
  }
  if (g._star3Celebration) return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._rewardRects) {
    for (let i = 0; i < g._rewardRects.length; i++) {
      if (g._hitRect(x,y,...g._rewardRects[i])) { g.selectedReward = i; return }
    }
  }
  if (g._rewardConfirmRect && g.selectedReward >= 0 && g._hitRect(x,y,...g._rewardConfirmRect)) {
    // 从战斗胜利进入奖励页时，需要清理战斗状态
    if (g.bState === 'victory') {
      if (g.enemy && g.enemy.isBoss) MusicMgr.resumeNormalBgm()
      g._restoreBattleHpMax()
      g.heroBuffs = []; g.enemyBuffs = []
    }
    g._applyReward(g.rewards[g.selectedReward])
    if (g._star3Celebration || g._petObtainedPopup) return
    g._nextFloor()
  }
}

function tShop(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (!g.shopUsed && g._shopRects) {
    for (let i = 0; i < g._shopRects.length; i++) {
      if (g._hitRect(x,y,...g._shopRects[i])) {
        g._applyShopItem(g.shopItems[i]); g.shopUsed = true; return
      }
    }
  }
  if (g._shopLeaveRect && g._hitRect(x,y,...g._shopLeaveRect)) { g._nextFloor() }
}

function tRest(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._restRects) {
    for (let i = 0; i < g._restRects.length; i++) {
      if (g._hitRect(x,y,...g._restRects[i])) {
        g._applyRestOption(g.restOpts[i]); g._nextFloor(); return
      }
    }
  }
}

function tAdventure(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._advBtnRect && g._hitRect(x,y,...g._advBtnRect)) { g._nextFloor() }
}

function tGameover(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x,y,...g._backBtnRect)) { g._handleBackToTitle(); return }
  if (g._goBtnRect && g._hitRect(x,y,...g._goBtnRect)) { g.scene = 'title' }
}

function tRanking(g, type, x, y) {
  const { S, H } = V
  const safeTop = V.safeTop
  if (type === 'start') {
    g._rankTouchStartY = y
    g._rankScrollStart = g.rankScrollY || 0
    return
  }
  if (type === 'move') {
    const dy = y - (g._rankTouchStartY || y)
    const tab = g.rankTab || 'all'
    const listMap = { all: 'rankAllList', dex: 'rankDexList', combo: 'rankComboList' }
    const list = g.storage[listMap[tab]] || []
    const rowH = 64*S
    const maxScroll = 0
    const minScroll = -Math.max(0, list.length * rowH - (H - 70*S - safeTop - 130*S))
    g.rankScrollY = Math.max(minScroll, Math.min(maxScroll, g._rankScrollStart + dy))
    return
  }
  if (type !== 'end') return
  const dy = Math.abs(y - (g._rankTouchStartY || y))
  if (dy > 10*S) return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.scene = 'title'; return }
  if (g._rankRefreshRect && g._hitRect(x, y, ...g._rankRefreshRect)) { g.storage.fetchRanking(g.rankTab, true); return }
  // 4-Tab 切换
  if (g._rankTabRects) {
    for (const key of ['all', 'dex', 'combo']) {
      const rect = g._rankTabRects[key]
      if (rect && g._hitRect(x, y, ...rect)) {
        g.rankTab = key; g.rankScrollY = 0; g.storage.fetchRanking(key); return
      }
    }
  }
}

function tStats(g, type, x, y) {
  if (type !== 'end') return
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.scene = 'title'; return }
  if (g._statsShareBtnRect && g._hitRect(x, y, ...g._statsShareBtnRect)) { g._shareStats(); return }
}

function tDex(g, type, x, y) {
  // 如果弹窗正在显示
  if (g._dexDetailPetId) {
    if (type === 'end') {
      // 检测"带它出战"按钮
      if (g._dexBattleBtnRect) {
        const [bx, by, bw, bh] = g._dexBattleBtnRect
        if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) {
          // TODO: 接入广告后，在此处调用激励视频广告，播放完成后再执行下方逻辑
          const petId = g._dexDetailPetId
          g._dexDetailPetId = null
          g._dexBattleBtnRect = null
          g._designatedPetId = petId
          g._startRun()
          return
        }
      }
      // 点击其他区域关闭弹窗
      g._dexDetailPetId = null
      g._dexBattleBtnRect = null
    }
    return
  }
  if (type === 'start') {
    g._dexTouchStartY = y
    g._dexScrollStart = g._dexScrollY || 0
    return
  }
  if (type === 'move') {
    const dy = y - (g._dexTouchStartY || y)
    const { H, S, safeTop } = V
    const contentH = H - safeTop - 78*S - 8*S
    const maxScroll = 0
    const minScroll = -Math.max(0, (g._dexTotalH || 0) - contentH)
    g._dexScrollY = Math.max(minScroll, Math.min(maxScroll, g._dexScrollStart + dy))
    return
  }
  if (type !== 'end') return
  const dy = Math.abs(y - (g._dexTouchStartY || y))
  if (dy > 10 * V.S) return  // 滚动手势，不触发点击
  // 检测宠物格子点击
  if (g._dexCellRects) {
    for (const cell of g._dexCellRects) {
      if (x >= cell.x && x <= cell.x + cell.w && y >= cell.y && y <= cell.y + cell.h) {
        g._dexDetailPetId = cell.id
        g.storage.markDexSeen(cell.id)
        return
      }
    }
  }
  if (g._backBtnRect && g._hitRect(x, y, ...g._backBtnRect)) { g.scene = 'title'; return }
}

module.exports = {
  tTitle, tPrepare, tEvent, tBattle,
  tReward, tShop, tRest, tAdventure, tGameover,
  tRanking, tStats, tDex,
}
