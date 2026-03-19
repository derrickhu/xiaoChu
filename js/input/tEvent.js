/**
 * 触摸处理：事件 (event) 场景
 */
const V = require('../views/env')
const { hasSameIdOnTeam } = require('../data/pets')

function _doEventPetSwap(g, drag, drop) {
  if (drag.source === drop.type) return
  const si = drag.source === 'team' ? drag.index : drop.index
  const bi = drag.source === 'bag' ? drag.index : drop.index

  if (drag.source === 'team') {
    if (bi < g.petBag.length) {
      const bagPet = g.petBag[bi]
      if (hasSameIdOnTeam(g.pets, bagPet.id, si)) return
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
    if (si < g.pets.length) {
      const bagPet = g.petBag[bi]
      if (hasSameIdOnTeam(g.pets, bagPet.id, si)) return
      const tmp = g.pets[si]
      g.pets[si] = g.petBag[bi]
      g.pets[si].currentCd = 0
      g.petBag[bi] = tmp
    } else {
      if (g.pets.length < 5) {
        const pet = g.petBag[bi]
        if (hasSameIdOnTeam(g.pets, pet.id, -1)) return
        g.petBag.splice(bi, 1)[0]
        pet.currentCd = 0
        g.pets.push(pet)
      }
    }
  }
}

function _doEventWpnSwap(g, drag, drop) {
  if (drag.source === drop.type) return
  if (drag.source === 'equipped' && drop.type === 'bag') {
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
    const bi = drag.index
    const old = g.weapon
    g.weapon = g.weaponBag[bi]
    if (old) { g.weaponBag[bi] = old }
    else { g.weaponBag.splice(bi, 1) }
  }
}

function tEvent(g, type, x, y) {
  // 通天塔玩法介绍覆盖层（教学后首次进入）
  if (g._rogueIntro) {
    if (type === 'end') {
      g._rogueIntro.page++
      g._rogueIntro.alpha = 0
      if (g._rogueIntro.page >= 2) {  // 与 _ROGUE_INTRO_CARDS 数量一致
        g._rogueIntro = null
      }
      g._dirty = true
    }
    return
  }

  // ★3满星庆祝画面（商店升星触发）
  if (type === 'end' && g._star3Celebration && g._star3Celebration.phase === 'ready') {
    g._star3Celebration = null
    if (g._pendingPoolEntry) { g._petPoolEntryPopup = g._pendingPoolEntry; g._pendingPoolEntry = null }
    return
  }
  if (g._star3Celebration) return
  // === 弹窗层：只处理 end ===
  if (type === 'end') {
    if (g._petPoolEntryPopup) { g._petPoolEntryPopup = null; return }
    if (g._fragmentObtainedPopup) { g._fragmentObtainedPopup = null; return }
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
  if (g._shopPetObtained) return

  // === 拖拽灵宠 / 法宝 ===
  const drag = g._eventDragPet
  const wpnDrag = g._eventDragWpn
  if (type === 'start') {
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
    if (wpnDrag) {
      if (wpnDrag.moved) {
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
        const wp = wpnDrag.source === 'equipped' ? g.weapon : g.weaponBag[wpnDrag.index]
        if (wp) {
          g._eventWpnDetail = true
          g._eventWpnDetailData = wp
        }
      }
      g._eventDragWpn = null
      return
    }

    if (drag) {
      if (drag.moved) {
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

    if (g._eventBtnRect && g._hitRect(x,y,...g._eventBtnRect)) {
      const ev = g.curEvent; if (!ev) return
      switch(ev.type) {
        case 'battle': case 'elite': case 'boss':
          g._enterBattle(ev.data); break
        case 'adventure':
          g._nextFloor(); break
        case 'shop':
          g._nextFloor(); break
      }
    }

    // 商店交互
    const ev = g.curEvent
    if (ev && ev.type === 'shop') {
      if (g._shopSelectAttr) {
        if (g._shopAttrConfirmRect && g._shopAttrSelectedVal && g._hitRect(x,y,...g._shopAttrConfirmRect)) {
          g._applyShopPetByAttr(g._shopAttrSelectedVal)
          g._shopSelectAttr = false
          g._shopSelectAttrItem = null
          g._shopAttrSelectedVal = null
          return
        }
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
        return
      }
      if (g._shopSelectPet) {
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
        return
      }
      const shopUsedCount = g._eventShopUsedCount || 0
      if (shopUsedCount < 2 && g._eventShopRects) {
        for (let i = 0; i < g._eventShopRects.length; i++) {
          const rect = g._eventShopRects[i]
          if (!rect) continue
          if (g._hitRect(x,y,...rect)) {
            const item = ev.data[i]
            if (!item) return
            if (shopUsedCount === 1) {
              const cost = Math.round(g.heroHp * 15 / 100)
              g.heroHp = Math.max(1, g.heroHp - cost)
              if (cost > 0) {
                g.dmgFloats.push({ x: V.W * 0.5, y: V.H * 0.35, text: `-${cost} HP`, color: '#ff4444', t: 0, alpha: 1, scale: 1.1 })
              }
            }
            g._eventShopUsedItems = g._eventShopUsedItems || []
            g._eventShopUsedItems.push(i)
            g._eventShopUsedCount = shopUsedCount + 1
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
            g._applyShopItem(item)
            return
          }
        }
      }
    }

    // 休息选项点击
    if (ev && ev.type === 'rest' && g._eventRestRects) {
      for (let i = 0; i < g._eventRestRects.length; i++) {
        if (g._hitRect(x,y,...g._eventRestRects[i])) {
          g._applyRestOption(ev.data[i]); g._nextFloor(); return
        }
      }
    }
  }
}

module.exports = tEvent
